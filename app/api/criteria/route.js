import { GoogleGenAI, Type } from "@google/genai";
import { getCategory } from "@/lib/engine/categories";
import { MAX_OPTIONS, MIN_OPTIONS } from "@/lib/engine/score";
import {
  CHOICE_COUNT,
  CRITERIA_COUNT,
  QUESTION_COUNT,
  validateRubric,
} from "@/lib/engine/rubric";
import { buildRubricPrompt, SYSTEM_PROMPT } from "@/lib/engine/rubric-prompt";
import { readRubric, rubricKey, writeRubric } from "@/lib/engine/rubric-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "gemini-2.5-flash";
const TIMEOUT_MS = 20000;
const MAX_LABEL_LENGTH = 60;

// المخطط يضمن الشكل، وlib/engine/rubric.js يضمن المعنى — أن affects
// يشير لمعيار موجود وأن المفاتيح فريدة. المخطط وحده لا يعرف ذلك.
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    criteria: {
      type: Type.ARRAY,
      description: `Exactly ${CRITERIA_COUNT} criteria that separate these specific options.`,
      items: {
        type: Type.OBJECT,
        properties: {
          key: { type: Type.STRING, description: "lowercase slug identifier" },
          label: { type: Type.STRING, description: "Arabic, short" },
          low: {
            type: Type.STRING,
            description: "Arabic rating button, 1-2 words, the lesser end",
          },
          mid: {
            type: Type.STRING,
            description: "Arabic rating button, 1-2 words, the middle",
          },
          high: {
            type: Type.STRING,
            description: "Arabic rating button, 1-2 words, the greater end",
          },
        },
        required: ["key", "label", "low", "mid", "high"],
        propertyOrdering: ["key", "label", "low", "mid", "high"],
      },
    },
    questions: {
      type: Type.ARRAY,
      description: `Exactly ${QUESTION_COUNT} questions about the USER's situation, never about the options.`,
      items: {
        type: Type.OBJECT,
        properties: {
          key: { type: Type.STRING, description: "lowercase slug identifier" },
          affects: {
            type: Type.STRING,
            description: "Must copy one of the criteria keys verbatim.",
          },
          label: { type: Type.STRING, description: "Arabic question text" },
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
    moodCriteria: {
      type: Type.OBJECT,
      description: "Both values must be keys from the criteria above.",
      properties: {
        energy: { type: Type.STRING },
        ease: { type: Type.STRING },
      },
      required: ["energy", "ease"],
      propertyOrdering: ["energy", "ease"],
    },
  },
  required: ["criteria", "questions", "moodCriteria"],
  propertyOrdering: ["criteria", "questions", "moodCriteria"],
};

function fail(status, message) {
  return Response.json({ ok: false, error: message }, { status });
}

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
      contents: buildRubricPrompt({
        options,
        categoryLabel: `${category.label} (${category.en})`,
      }),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        // منخفضة عمداً: نبي معايير تفرّق فعلاً لا معايير طريفة.
        // الحرارة العالية تولّد أسماء لمّاعة تتشابه في الأثر.
        temperature: 0.4,
        abortSignal: controller.signal,
      },
    });
  } finally {
    clearTimeout(timeout);
  }

  const raw = response?.text;
  if (!raw) {
    const err = new Error("Gemini returned an empty response");
    err.code = "EMPTY";
    throw err;
  }

  return JSON.parse(raw);
}

// ---------------------------------------------------------------
// POST /api/criteria
//
// ما يرجّع خطأ إلا على مدخلات غير صالحة. أي فشل في النداء أو في
// التحقق يرجّع القالب الثابت بحالة 200 — التوليد تحسين، وسقوطه
// يعيدنا للسلوك القديم لا لشاشة خطأ.
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
  const key = rubricKey({ options, categoryId: category.id });

  const cached = readRubric(key);
  if (cached) {
    return Response.json({ ok: true, rubric: cached, source: "cache" });
  }

  let raw;
  try {
    raw = await generate({ options, category });
  } catch (err) {
    console.error(`[api/criteria] generation failed (${err.code ?? "UNKNOWN"}):`, err);
    return Response.json({ ok: true, rubric: category, source: "template" });
  }

  const result = validateRubric(raw, category);
  if (!result.ok) {
    // نسجّل السبب: تكرار نفس reason يعني خللاً في البرومبت لا حظاً سيئاً
    console.warn(
      `[api/criteria] rubric rejected (${result.reason}):`,
      JSON.stringify(result.detail ?? null),
    );
    return Response.json({ ok: true, rubric: category, source: "template" });
  }

  writeRubric(key, result.rubric);
  return Response.json({ ok: true, rubric: result.rubric, source: "generated" });
}
