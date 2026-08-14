import { GoogleGenAI, Type } from "@google/genai";
import { MAX_OPTIONS, MIN_OPTIONS } from "@/lib/engine/score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "gemini-2.5-flash";
const TIMEOUT_MS = 15000;
const MAX_LABEL_LENGTH = 60;
export const QUESTION_COUNT = 3;

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

2. THE THREE DIMENSIONS MUST BE GENUINELY DIFFERENT FROM EACH OTHER.
   This is the rule most often broken. Two questions that are the same axis in different words give the user three taps but only two real decisions, and silently double that axis's weight in the result.
   For "شاي ولا أخرج للحديقة": "تبغى دفى ولا هوا؟" and "تبغى جو برا ولا جوا؟" are THE SAME AXIS (indoors vs outdoors) asked twice. Keep one, and make the others something else entirely — effort, mood, time, who you are with, how you will feel after.
   Write the three dimensions down before phrasing them, and check no two overlap.

3. DO NOT PUT THE CHOICE INSIDE THE QUESTION.
   The options appear as buttons right below, so phrasing like "تبغى دفى ولا هوا؟" or "برا ولا جوا؟" repeats them and boxes the user into your framing. Ask the dimension openly and let the buttons carry the alternatives: "وش ناقصك الحين؟" · "ايش أنشط؟" · "تبي تتحرك ولا تهدأ؟" — the last only if movement is genuinely the axis.
   Never write "ولا" between two alternatives in the question text.

4. LET THE OPTIONS DECIDE THE ANGLES, NOT A FIXED RECIPE.
   Do not reach for the same three angles every time. Two foods are separated by craving and heaviness; a drink versus going outside is separated by energy, effort and what the evening should feel like; two purchases by need and timing. Read what these particular options are and ask what actually settles THEM.

5. SHORT AND SPOKEN.
   Write how a friend talks. Two to five words where possible: "ايش مشتهي؟" not "وش نوع الأكل اللي تشتهيه اليوم؟". Cut padding like "اليوم", "الحين", "برأيك".

6. THE QUESTION MUST BE ANSWERABLE BY NAMING ONE OPTION.
   The user answers by tapping one of the options, so the question has to make sense that way. "ايش مشتهي؟" → they tap شاورما. "كم عندك وقت؟" does NOT work here, because the answer is not one of the options.
   This is the opposite of a survey question — every question is a head-to-head.

7. KEYS.
   "key" is a lowercase English slug — a program identifier, not user text. "label" is Arabic. "en" is a very short uppercase Latin caption for decoration.`;

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
          label: {
            type: Type.STRING,
            description: "Arabic, short and spoken, answerable by naming one option",
          },
          en: { type: Type.STRING, description: "Short uppercase Latin caption" },
        },
        required: ["key", "label", "en"],
        propertyOrdering: ["key", "label", "en"],
      },
    },
  },
  required: ["questions"],
  propertyOrdering: ["questions"],
};

// ---------- كاش بمفتاح الخيارات بعد التطبيع ----------
// ترفع مع أي تغيير في البرومبت وإلا خُدمت مدخلات مولّدة بالقديم
const VERSION = "v2-distinct";
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

// ---------- احتياطي عام ----------
// بلا فئات ما عاد فيه قالب جاهز، فنبني واحداً محايداً من الخيارات.
// يشتغل مع أي مفاضلة لأنه ما يفترض شيئاً عن نوعها.
function fallbackQuestions() {
  return [
    { key: "want", label: "ايش نفسك فيه؟", en: "CRAVING" },
    { key: "fits", label: "ايش يناسب وضعك الحين؟", en: "FITS NOW" },
    { key: "after", label: "ايش بترتاح له بعدين؟", en: "NO REGRETS" },
  ];
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
  const out = [];

  for (const q of raw.questions) {
    const key = typeof q?.key === "string" ? q.key.trim() : "";
    const label = typeof q?.label === "string" ? q.label.trim() : "";
    if (!key || !SLUG.test(key) || seen.has(key) || !label) return null;
    seen.add(key);
    out.push({
      key,
      label: label.slice(0, 80),
      en: (typeof q?.en === "string" ? q.en.trim() : "").slice(0, 24),
    });
  }
  return out;
}

async function generate(options) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error("GEMINI_API_KEY is not set");
    err.code = "NO_API_KEY";
    throw err;
  }

  const ai = new GoogleGenAI({ apiKey });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        "الخيارات اللي المستخدم محتار بينها:",
        ...options.map((o, i) => `${i + 1}. ${o}`),
        "",
        "اكتب الأسئلة الثلاثة. أرجع كائن JSON فقط.",
      ].join("\n"),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.5,
        abortSignal: controller.signal,
      },
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response?.text) {
    const err = new Error("Gemini returned an empty response");
    err.code = "EMPTY";
    throw err;
  }
  return JSON.parse(response.text);
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

  let questions = null;
  try {
    questions = shape(await generate(options));
    if (!questions) console.warn("[api/duel] rejected the generated shape");
  } catch (err) {
    console.error(`[api/duel] generation failed (${err.code ?? "?"}):`, err);
  }

  if (!questions) {
    return Response.json({
      ok: true,
      questions: fallbackQuestions(),
      source: "fallback",
    });
  }

  writeCache(key, questions);
  return Response.json({ ok: true, questions, source: "generated" });
}
