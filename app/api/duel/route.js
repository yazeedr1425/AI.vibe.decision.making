import { GoogleGenAI, Type } from "@google/genai";
import { MAX_OPTIONS, MIN_OPTIONS } from "@/lib/engine/score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "gemini-2.5-flash";
// مرحلتان، فالمهلة أوسع من نداء واحد
const TIMEOUT_MS = 25000;
const MAX_LABEL_LENGTH = 60;
export const QUESTION_COUNT = 3;
// نقترح أكثر مما نحتاج حتى يكون للمرحلة الثانية من أين تختار
const CANDIDATE_COUNT = 6;

const SLUG = /^[a-z][a-z0-9_]{0,23}$/;

// النموذج يرجّع صياغة الأسئلة فقط — الاختيارات نبنيها نحن من
// الخيارات نفسها. لو تركناه يكتبها، أي حرف زائد في "بروست" يخلي
// المطابقة تفشل، ونخسر توليداً سليماً لأجل نسخ نص. هو يفكّر بالأبعاد،
// ونحن نتولى الميكانيكا.
const SYSTEM_PROMPT = `You look at two or more options someone is torn between, and work out the questions that actually settle it.

Return exactly ${QUESTION_COUNT} questions. Each one is a SINGLE dimension on which these options genuinely differ, phrased as a short spoken Arabic question. The app will attach the options themselves as the answers, so the user picks which option wins that dimension.

HARD RULES:

1. EACH QUESTION IS ONE DIMENSION, AND THE OPTIONS MUST DIFFER ON IT.
   Before keeping a question, ask: would someone plausibly answer it with different options? If both options are the obvious same answer, the question decides nothing — drop it and find another.
   For "شاورما ولا بروست": "ايش مشتهي؟" is good. "أيهما أكل؟" is not — both are.

2. CHOOSE FROM THE CANDIDATE AXES YOU ARE GIVEN, THEN PHRASE.
   Stage one proposed candidate axes with a note on where each option sits. Pick the three most decisive AND most different from each other, then write one Arabic question for each. Copy the chosen axis into "axis" verbatim.
   Judge overlap by MEANING, not wording: "energy level" and "alertness" are the same axis; "what wakes you up" and "what relaxes you" are two ends of ONE scale. Reject the weaker of any overlapping pair and take the next-best distinct candidate.
   Prefer a slightly less decisive axis over a second one that echoes an axis you already took — three real decisions beat two plus an echo.

3. NAME THE AXIS FIRST, THEN PHRASE THE QUESTION.
   Every question carries an "axis": two or three English words naming the dimension it measures (e.g. "energy level", "effort required", "how filling", "social vs alone", "cost", "novelty"). Decide all three axes BEFORE writing any Arabic, and make sure no two describe the same underlying thing.
   This is the rule most often broken. Two questions on the same axis in different words give the user three taps but only two real decisions, and silently double that axis's weight in the result.
   For "شاي ولا أخرج للحديقة": "تبغى دفى ولا هوا؟" and "تبغى جو برا ولا جوا؟" are BOTH the axis "indoors vs outdoors" — one of them must be replaced by a different axis entirely.
   Reject your own draft if two axes are synonyms, opposites of each other, or two ends of one scale ("what wakes you up" and "what relaxes you" are ONE axis, not two).

4. DO NOT PUT THE CHOICE INSIDE THE QUESTION.
   The options appear as buttons right below, so phrasing like "تبغى دفى ولا هوا؟" or "برا ولا جوا؟" repeats them and boxes the user into your framing. Ask the dimension openly and let the buttons carry the alternatives: "وش ناقصك الحين؟" · "ايش أنشط؟" · "تبي تتحرك ولا تهدأ؟" — the last only if movement is genuinely the axis.
   Never write "ولا" between two alternatives in the question text.

5. LET THE OPTIONS DECIDE THE ANGLES, NOT A FIXED RECIPE.
   Do not reach for the same three angles every time. Two foods are separated by craving and heaviness; a drink versus going outside is separated by energy, effort and what the evening should feel like; two purchases by need and timing. Read what these particular options are and ask what actually settles THEM.

6. SHORT AND SPOKEN.
   Write how a friend talks. Two to five words where possible: "ايش مشتهي؟" not "وش نوع الأكل اللي تشتهيه اليوم؟". Cut padding like "اليوم", "الحين", "برأيك".

7. THE QUESTION MUST BE ANSWERABLE BY NAMING ONE OPTION.
   The user answers by tapping one of the options, so the question has to make sense that way. "ايش مشتهي؟" → they tap شاورما. "كم عندك وقت؟" does NOT work here, because the answer is not one of the options.
   This is the opposite of a survey question — every question is a head-to-head.

8. KEYS.
   "key" is a lowercase English slug — a program identifier, not user text. "label" is Arabic. "en" is a very short uppercase Latin caption for decoration.`;

// المرحلة الأولى: يقترح محاور أكثر مما نحتاج، ولكل محور يقول أين يقف
// كل خيار عليه. إجباره يكتب موقع الخيارين يكشف المحور الميت مبكراً:
// إذا ما قدر يفرّق بينهما في جملة، ما راح يفرّق في سؤال.
const PROPOSER_PROMPT = `You are the first stage of a two-stage agent that builds a decision quiz.

Your only job: propose ${CANDIDATE_COUNT} candidate AXES on which the given options genuinely differ. Do not write questions yet.

For each axis give:
- "axis": two or three English words naming the dimension ("energy level", "effort required", "how filling").
- "split": one short English clause saying where EACH option sits on it ("tea is calm, park is active").
- "decisive": integer 1-5, how much a real person torn between these would actually weigh this axis.

Rules:
- If you cannot state a clear "split", the axis is dead — replace it.
- Span genuinely different kinds of consideration: desire, effort, time, mood, cost, aftermath, who you are with. Do not give ${CANDIDATE_COUNT} variations of one theme.
- Read what these particular options ARE. Two foods differ on craving and heaviness; a drink versus going outside differs on energy and effort; two purchases on need and timing.`;

const PROPOSER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    candidates: {
      type: Type.ARRAY,
      description: `Exactly ${CANDIDATE_COUNT} candidate axes.`,
      items: {
        type: Type.OBJECT,
        properties: {
          axis: { type: Type.STRING },
          split: { type: Type.STRING },
          decisive: { type: Type.INTEGER },
        },
        required: ["axis", "split", "decisive"],
        propertyOrdering: ["axis", "split", "decisive"],
      },
    },
  },
  required: ["candidates"],
  propertyOrdering: ["candidates"],
};

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      description: `Exactly ${QUESTION_COUNT} head-to-head questions.`,
      items: {
        type: Type.OBJECT,
        properties: {
          key: { type: Type.STRING, description: "lowercase slug" },
          axis: {
            type: Type.STRING,
            description:
              "Two or three English words naming the dimension. Must differ from the other two.",
          },
          label: {
            type: Type.STRING,
            description: "Arabic, short and spoken, answerable by naming one option",
          },
          en: { type: Type.STRING, description: "Short uppercase Latin caption" },
        },
        required: ["key", "axis", "label", "en"],
        propertyOrdering: ["key", "axis", "label", "en"],
      },
    },
  },
  required: ["questions"],
  propertyOrdering: ["questions"],
};

// ---------- كاش بمفتاح الخيارات بعد التطبيع ----------
// ترفع مع أي تغيير في البرومبت وإلا خُدمت مدخلات مولّدة بالقديم
const VERSION = "v3-agent";
const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_ENTRIES = 300;
const store = new Map();

const normalize = (s) =>
  s
    .normalize("NFKC")
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

// الترتيب مقصود: "شاورما ولا بروست" و"بروست ولا شاورما" نفس السؤال
const cacheKey = (options) =>
  [VERSION, ...options.map(normalize).sort()].join("|");

function readCache(key) {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

function writeCache(key, value) {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { at: Date.now(), value });
}

const fail = (status, message) =>
  Response.json({ ok: false, error: message }, { status });

function validate(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "الطلب لازم يكون كائن JSON." };
  }
  if (!Array.isArray(body.options)) {
    return { ok: false, message: "options لازم تكون مصفوفة." };
  }

  const options = body.options
    .filter((o) => typeof o === "string")
    .map((o) => o.trim())
    .filter(Boolean);

  if (options.length !== body.options.length) {
    return { ok: false, message: "كل خيار لازم يكون نص غير فاضي." };
  }
  if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
    return {
      ok: false,
      message: `عدد الخيارات لازم يكون بين ${MIN_OPTIONS} و${MAX_OPTIONS}.`,
    };
  }
  if (options.some((o) => o.length > MAX_LABEL_LENGTH)) {
    return { ok: false, message: `طول الخيار ما يتجاوز ${MAX_LABEL_LENGTH} حرف.` };
  }
  if (new Set(options).size !== options.length) {
    return { ok: false, message: "فيه خيارات مكررة." };
  }

  return { ok: true, value: { options } };
}

// يرفض ما يكسر: عدد غير مطابق، مفاتيح مكررة أو غير slug، نص فاضي.
function shape(raw) {
  if (!Array.isArray(raw?.questions) || raw.questions.length !== QUESTION_COUNT) {
    return null;
  }
  const seen = new Set();
  const axes = new Set();
  const out = [];

  for (const q of raw.questions) {
    const key = typeof q?.key === "string" ? q.key.trim() : "";
    const label = typeof q?.label === "string" ? q.label.trim() : "";
    if (!key || !SLUG.test(key) || seen.has(key) || !label) return null;

    // محوران متطابقان نصاً = سؤالان يقيسان نفس الشي، فيتضاعف وزنه
    // بلا ما يبان. التطابق النصي ما يمسك المترادفات، لكنه يمسك
    // الحالة الشائعة بلا تكلفة.
    const axis = (typeof q?.axis === "string" ? q.axis.trim() : "").toLowerCase();
    if (axis && axes.has(axis)) return null;
    if (axis) axes.add(axis);

    // "ولا" داخل نص السؤال يكرّر الأزرار تحته ويحصر المستخدم في
    // تأطير النموذج بدل ما تحمل الأزرار البدائل
    if (/\sولا\s/.test(label)) return null;

    seen.add(key);
    out.push({
      key,
      label: label.slice(0, 80),
      en: (typeof q?.en === "string" ? q.en.trim() : "").slice(0, 24),
    });
  }
  return out;
}

function client() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error("GEMINI_API_KEY is not set");
    err.code = "NO_API_KEY";
    throw err;
  }
  return new GoogleGenAI({ apiKey });
}

async function call(ai, { system, schema, contents, signal, temperature }) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature,
      abortSignal: signal,
    },
  });

  if (!response?.text) {
    const err = new Error("Gemini returned an empty response");
    err.code = "EMPTY";
    throw err;
  }
  return JSON.parse(response.text);
}

/**
 * وكيل من مرحلتين.
 *
 * نداء واحد كان يقترح ويصفّي ويصوغ في خطوة، فيقع في فخّ متكرر: يكتب
 * أول ثلاثة محاور تخطر له، واثنان منها نفس الشي بصياغتين. الفصل
 * يعطي المرحلة الثانية قائمة كاملة تقارنها ببعضها — والتكرار ما
 * ينكشف إلا لما تشوف البدائل جنب بعض.
 *
 * ورخيصة: مخرجات المرحلة الأولى إنجليزية قصيرة، محور وجملة.
 */
async function generate(options, signal) {
  const ai = client();
  const listed = options.map((o, i) => (i + 1) + ". " + o).join("\n");

  // ١ — اقتراح المحاور. حرارة أعلى: نبي تنوّعاً في المطروح.
  const proposed = await call(ai, {
    system: PROPOSER_PROMPT,
    schema: PROPOSER_SCHEMA,
    temperature: 0.8,
    signal,
    contents:
      "الخيارات اللي المستخدم محتار بينها:\n" +
      listed +
      "\n\nاقترح المحاور. أرجع كائن JSON فقط.",
  });

  const candidates = Array.isArray(proposed?.candidates)
    ? proposed.candidates
    : [];
  if (!candidates.length) {
    const err = new Error("proposer returned no candidates");
    err.code = "NO_CANDIDATES";
    throw err;
  }

  // ٢ — الاختيار والصياغة. حرارة أقل: القرار هنا لا الابتكار.
  const described = candidates
    .map((c) => "- " + c.axis + " (decisive " + c.decisive + "/5): " + c.split)
    .join("\n");

  return call(ai, {
    system: SYSTEM_PROMPT,
    schema: RESPONSE_SCHEMA,
    temperature: 0.4,
    signal,
    contents: [
      "الخيارات اللي المستخدم محتار بينها:",
      listed,
      "",
      "المحاور المقترحة من المرحلة الأولى:",
      described,
      "",
      "اختر " + QUESTION_COUNT + " محاور متباينة فعلاً وصُغ سؤالاً لكل واحد. أرجع كائن JSON فقط.",
    ].join("\n"),
  });
}

// ---------------------------------------------------------------
// POST /api/duel
//
// ما يرجّع خطأ إلا على مدخلات غير صالحة. أي فشل في النداء أو الشكل
// يرجّع الأسئلة المحايدة بحالة 200 — الصياغة تحسين وسقوطها ما يمنع
// المستخدم من الحسم.
// ---------------------------------------------------------------

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "ما قدرنا نقرأ الطلب — لازم يكون JSON صالح.");
  }

  const parsed = validate(body);
  if (!parsed.ok) return fail(400, parsed.message);

  const { options } = parsed.value;
  const key = cacheKey(options);

  const cached = readCache(key);
  if (cached) return Response.json({ ok: true, questions: cached, source: "cache" });

  // محاولتان: الرفض غالباً محوران متطابقان أو "ولا" في النص، وهذي
  // تتصلّح بإعادة التوليد. ما نستبدلها بأسئلة جاهزة — سؤال قالبي
  // يبان ذكياً وهو ما يعرف شي عن خيارات المستخدم، وهذا بالضبط اللي
  // نتخلص منه. الفشل الصريح أصدق من قالب متنكّر.
  let questions = null;
  let lastError = null;

  for (let attempt = 1; attempt <= 2 && !questions; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      questions = shape(await generate(options, controller.signal));
      if (!questions) {
        console.warn(`[api/duel] rejected the generated shape (attempt ${attempt})`);
      }
    } catch (err) {
      lastError = err;
      console.error(`[api/duel] attempt ${attempt} failed (${err.code ?? "?"}):`, err);
      if (err.code === "NO_API_KEY") break;
    } finally {
      clearTimeout(timer);
    }
  }

  if (!questions) {
    if (lastError?.code === "NO_API_KEY") {
      return fail(503, "مولّد الأسئلة غير مهيأ — GEMINI_API_KEY مفقود.");
    }
    if (lastError?.name === "AbortError") {
      return fail(504, "المولّد تأخر بالرد، جرب مرة ثانية.");
    }
    return fail(502, "ما قدرنا نجهّز أسئلة لخياراتك، جرب مرة ثانية.");
  }

  writeCache(key, questions);
  return Response.json({ ok: true, questions, source: "generated" });
}
