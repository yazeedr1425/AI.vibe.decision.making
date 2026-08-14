import { GoogleGenAI, Type } from "@google/genai";
import { getCategory } from "@/lib/engine/categories";
import { MAX_OPTIONS, MIN_OPTIONS } from "@/lib/engine/score";
import { normalizeArabic } from "@/lib/voice/match";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "gemini-2.5-flash";
// درس /api/third: النداء الناجح ياخذ ٤ إلى ١٦ ثانية، والمهلة الضيقة
// تفشل بصمت. طويلة ما تضر — المستخدم ضغط زراً وينتظر جواباً.
const TIMEOUT_MS = 20000;
const MAX_LABEL_LENGTH = 60;
const MAX_REASON_LENGTH = 300;

// محامي الخيار الخاسر.
//
// التوصية بلا اعتراض تنقرأ كرمية عملة، ومعها اعتراض جاد تنقرأ
// كقرار مدروس. والمتردد تحديداً أحياناً ما يرتاح إلا لما يسمع أقوى
// ما يُقال ضد اللي اختاره — فيكتشف إنه يصمد، أو إنه فعلاً يبي
// الخيار الثاني وكان يدور من يأذن له.
const SYSTEM_INSTRUCTION = `You are the devil's advocate in a decision app. The app just recommended one option. Your job is to make the best genuine case for the option you are assigned — the one that lost.

You will be given: the full list of options, which one the app picked and its stated reason, what the user said about their situation, and the option you must defend.

HARD RULES:

1. ARGUE FOR YOUR OPTION, NOT AGAINST THE APP.
   Build the case on what your option actually offers this person. One respectful jab at the recommendation is fine; a demolition of it is not, and you never call the app or its pick stupid.

2. FLIP THEIR OWN REASONS — THIS IS YOUR STRONGEST MOVE.
   Take what the user said about their situation and show it cuts the other way. "مستعجل؟ عشان كذا بالذات خذ الجاهز" beats any generic praise. If their answers are listed, build on at least one of them.

3. CONCRETE TO THIS CHOICE.
   "لكل خيار مميزاته" is filler. Every sentence must be true of THIS option for THIS situation — if it would survive being pasted under a completely different pair of options, delete it.

4. TWO TO FOUR SENTENCES. It is a closing argument, not an essay.

5. THE QUESTION IS THE POINT.
   End with one short question the user would have to answer honestly before dismissing your option — the actual crux, not rhetorical fluff. Good shape: "متى آخر مرة جربت X وندمت؟".

6. SPOKEN SAUDI ARABIC. No English, no emoji, no lists, no markup. Warm and sharp, like the one friend at the table who disagrees with everyone.

7. NEVER INVENT FACTS about the user or the options. You know only what you are given. Do not suggest new options — your client is the losing option, nobody else.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    argument: {
      type: Type.STRING,
      description:
        "Two to four sentences of spoken Saudi Arabic making the losing option's best case.",
    },
    question: {
      type: Type.STRING,
      description:
        "One short Arabic question — the crux the user must answer before dismissing it.",
    },
  },
  required: ["argument", "question"],
  propertyOrdering: ["argument", "question"],
};

// ---------- حد للمعدل ----------
// نداء بضغطة زر، فالحد أدنى من /api/third اللي ينضرب أثناء الكتابة.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const hits = new Map();

function allowed(ip) {
  const now = Date.now();
  const seen = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  seen.push(now);
  hits.set(ip, seen);

  if (hits.size > 1000) {
    for (const [key, times] of hits) {
      if (!times.some((t) => now - t < RATE_WINDOW_MS)) hits.delete(key);
    }
  }
  return seen.length <= RATE_MAX;
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

  if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
    return { ok: false, message: "عدد الخيارات غير صالح." };
  }
  if (options.some((o) => o.length > MAX_LABEL_LENGTH)) {
    return { ok: false, message: "خيار أطول من المسموح." };
  }

  const chosen = typeof body.chosen === "string" ? body.chosen.trim() : "";
  const challenger =
    typeof body.challenger === "string" ? body.challenger.trim() : "";

  const inList = (label) =>
    options.some((o) => normalizeArabic(o) === normalizeArabic(label));

  if (!chosen || !inList(chosen)) {
    return { ok: false, message: "chosen لازم يكون من الخيارات." };
  }
  if (!challenger || !inList(challenger)) {
    return { ok: false, message: "challenger لازم يكون من الخيارات." };
  }
  if (normalizeArabic(chosen) === normalizeArabic(challenger)) {
    return { ok: false, message: "المحامي ما يدافع عن الفائز نفسه." };
  }

  const answers =
    body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
      ? Object.fromEntries(
          Object.entries(body.answers).filter(
            ([, v]) => typeof v === "string",
          ),
        )
      : {};

  const category = body.categoryId ? getCategory(body.categoryId) : null;
  const reason =
    typeof body.reason === "string"
      ? body.reason.trim().slice(0, MAX_REASON_LENGTH)
      : "";

  return { ok: true, value: { options, chosen, challenger, answers, category, reason } };
}

// نفس فكرة /api/decide: المفاتيح الخام مثل time=rush ما تفيد النموذج،
// نترجمها لجُمل من القالب
function describeAnswers(category, answers) {
  const entries = Object.entries(answers);
  if (!entries.length) return "ما قال شي عن ظرفه.";

  return entries
    .map(([key, value]) => {
      const question = category?.questions.find((q) => q.key === key);
      const choice = question?.choices.find((c) => c.value === value);
      return `- ${question?.label ?? key}: ${choice?.label ?? value}`;
    })
    .join("\n");
}

function shape(raw) {
  const argument =
    typeof raw?.argument === "string" ? raw.argument.trim().slice(0, 600) : "";
  const question =
    typeof raw?.question === "string" ? raw.question.trim().slice(0, 160) : "";

  // مرافعة من سطر واحد ما تستاهل العرض — الغالب أنها رد مبتور
  if (argument.length < 20 || !question) return null;
  return { argument, question };
}

// ---------------------------------------------------------------
// POST /api/advocate
//
// بلا كاش عمداً: النداء بضغطة زر، مرة لكل شاشة نتيجة، والزر يختفي
// بعد الرد — فالتكرار الوحيد هو "جرب مرة ثانية" بعد فشل، وهذا
// بالذات ما نبيه يرجع من الكاش.
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

  const { options, chosen, challenger, answers, category, reason } = parsed.value;

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allowed(ip)) {
    return fail(429, "كثرت المرافعات — انتظر دقيقة.");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fail(503, "المحامي غير مهيأ — GEMINI_API_KEY مفقود.");

  const prompt = [
    "الخيارات المطروحة:",
    ...options.map((o, i) => `${i + 1}. ${o}`),
    "",
    `التطبيق اختار: "${chosen}"`,
    reason ? `وسببه: "${reason}"` : "",
    "",
    "اللي قاله المستخدم عن ظرفه:",
    describeAnswers(category, answers),
    "",
    `موكّلك: "${challenger}". اصنع أقوى مرافعة صادقة له. أرجع كائن JSON فقط.`,
  ]
    .filter(Boolean)
    .join("\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.8,
        abortSignal: controller.signal,
      },
    });

    const plea = shape(JSON.parse(response.text ?? "{}"));
    if (!plea) return fail(502, "المحامي تلعثم — جرب مرة ثانية.");

    return Response.json({ ok: true, ...plea });
  } catch (err) {
    console.error("[api/advocate] failed:", err);
    if (err.name === "AbortError") {
      return fail(504, "المحامي تأخر بالمرافعة، جرب مرة ثانية.");
    }
    if (err.status === 503) {
      return fail(503, "المحامي مشغول الحين — انتظر شوي وجرب مرة ثانية.");
    }
    return fail(502, "ما قدرنا نجهز المرافعة، جرب مرة ثانية.");
  } finally {
    clearTimeout(timer);
  }
}
