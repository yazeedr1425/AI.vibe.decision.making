import { GoogleGenAI, Type } from "@google/genai";
import { getCategory } from "@/lib/engine/categories";
import { MAX_OPTIONS, MIN_OPTIONS } from "@/lib/engine/score";
import { CHOICE_COUNT, validateQuestions } from "@/lib/engine/questions";
import {
  buildQuestionsPrompt,
  SYSTEM_PROMPT,
} from "@/lib/engine/questions-prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "gemini-2.5-flash";
const TIMEOUT_MS = 15000;
const MAX_LABEL_LENGTH = 60;

// ---------------------------------------------------------------
// كاش بمفتاح الخيارين بعد التطبيع
//
// التوليد نداء حاجز بين إدخال الخيارات وظهور الأسئلة، والمفاضلات
// تتكرر كثيراً بين الناس. النسخة في المفتاح تُرفع مع أي تغيير في
// الشكل أو البرومبت، وإلا خُدمت مدخلات قديمة بعقد جديد.
// ⚠️ داخل الذاكرة: لكل نسخة على Vercel كاشها الخاص.
// ---------------------------------------------------------------
const VERSION = "v1";
const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_ENTRIES = 300;
const store = new Map();

// أ/إ/آ→ا و ة→ه و ى→ي: الناس يكتبونها بالطريقتين بلا تمييز،
// والتشكيل والتطويل زينة كتابية لا تغيّر الكلمة.
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
const cacheKey = (categoryId, options) =>
  [VERSION, categoryId, ...options.map(normalize).sort()].join("|");

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

// ---------------------------------------------------------------

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      description: "One question per criterion given, in the same order.",
      items: {
        type: Type.OBJECT,
        properties: {
          key: { type: Type.STRING, description: "lowercase slug" },
          affects: {
            type: Type.STRING,
            description: "Copy the criterion key verbatim.",
          },
          label: {
            type: Type.STRING,
            description: "Arabic, short and spoken. Two to five words.",
          },
          en: { type: Type.STRING, description: "Short uppercase Latin caption" },
          choices: {
            type: Type.ARRAY,
            description: `Exactly ${CHOICE_COUNT} choices with weights 3, 2 and 1.`,
            items: {
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING, description: "lowercase slug" },
                label: { type: Type.STRING, description: "Arabic" },
                en: { type: Type.STRING },
                weight: { type: Type.INTEGER, description: "3, 2 or 1" },
              },
              required: ["value", "label", "en", "weight"],
              propertyOrdering: ["value", "label", "en", "weight"],
            },
          },
        },
        required: ["key", "affects", "label", "en", "choices"],
        propertyOrdering: ["key", "affects", "label", "en", "choices"],
      },
    },
  },
  required: ["questions"],
  propertyOrdering: ["questions"],
};

const fail = (status, message) =>
  Response.json({ ok: false, error: message }, { status });

function validate(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "الطلب لازم يكون كائن JSON." };
  }

  const category = getCategory(body.categoryId);
  if (!category) {
    return { ok: false, message: `فئة غير معروفة: ${body.categoryId}` };
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

  return { ok: true, value: { options, category } };
}

async function generate({ options, category }) {
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
      contents: buildQuestionsPrompt({ options, category }),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        // منخفضة: نبي صياغة دقيقة ومختصرة لا طرافة
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
// POST /api/questions
//
// ما يرجّع خطأ إلا على مدخلات غير صالحة. أي فشل في النداء أو التحقق
// يرجّع القالب الثابت بحالة 200 — الصياغة تحسين وسقوطه يعيدنا
// للسلوك القديم لا لشاشة خطأ.
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

  const { options, category } = parsed.value;
  const key = cacheKey(category.id, options);

  const cached = readCache(key);
  if (cached) return Response.json({ ok: true, category: cached, source: "cache" });

  let raw;
  try {
    raw = await generate({ options, category });
  } catch (err) {
    console.error(`[api/questions] generation failed (${err.code ?? "?"}):`, err);
    return Response.json({ ok: true, category, source: "template" });
  }

  const result = validateQuestions(raw, category);
  if (!result.ok) {
    // تكرار نفس reason يعني خللاً في البرومبت لا حظاً سيئاً
    console.warn(
      `[api/questions] rejected (${result.reason}):`,
      JSON.stringify(result.detail ?? null),
    );
    return Response.json({ ok: true, category, source: "template" });
  }

  writeCache(key, result.category);
  return Response.json({
    ok: true,
    category: result.category,
    source: "generated",
  });
}
