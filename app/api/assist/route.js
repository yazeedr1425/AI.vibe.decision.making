import { GoogleGenAI, Type } from "@google/genai";
import { CATEGORIES, getCategory } from "@/lib/engine/categories";
import { MAX_OPTIONS, MIN_OPTIONS } from "@/lib/engine/score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "gemini-2.5-flash";
const TIMEOUT_MS = 12000;

// وكيل محادثة، مش مطابقة كلمات. المستخدم يتكلم طبيعي —
// "أنا تعبان ومستعجل وما عندي مزاج أطبخ" — والنموذج يستخرج منها
// الفئة والخيارات والإجابات دفعة وحدة، ويسأل فقط عن الناقص.
const SYSTEM_INSTRUCTION = `You are Ahsem's voice assistant, talking to a user who may be blind and is speaking to you in Arabic. Your entire output is spoken aloud, so keep every reply short, warm, and free of any markup, emoji, lists, or English.

Your job across turns is to fill three slots:
1. category_id — which decision template fits
2. options — the 2 to 5 things they are choosing between
3. answers — their answer to each of that category's questions

Rules that matter:
- Extract EVERYTHING the user implies in one utterance. If they say they are rushed and broke, that answers the time and budget questions immediately. Never re-ask something they already told you.
- Only ever emit question_key and choice_value that exist in the template given to you. Map their natural words onto the closest existing choice; never invent one.
- Ask for only ONE missing thing per reply, in a single short sentence.
- If they gave options but no category, infer the category yourself rather than asking.
- Set ready to true only once category_id, at least ${MIN_OPTIONS} options, and every question for that category are filled.
- When ready is true, your reply should be a brief handoff like "تمام، خلني أحسمها لك" and nothing more.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    category_id: {
      type: Type.STRING,
      description: "One of the template ids, or empty string if still unknown.",
    },
    options: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "The choices the user is deciding between, verbatim.",
    },
    answers: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question_key: { type: Type.STRING },
          choice_value: { type: Type.STRING },
        },
        required: ["question_key", "choice_value"],
      },
    },
    reply: { type: Type.STRING, description: "What to say aloud, in Arabic." },
    ready: { type: Type.BOOLEAN },
  },
  required: ["reply", "ready"],
  propertyOrdering: ["category_id", "options", "answers", "reply", "ready"],
};

// القوالب تنحقن في البرومبت حتى ما يخترع النموذج مفاتيح
function templatesForPrompt() {
  return CATEGORIES.map((c) => {
    const questions = c.questions
      .map(
        (q) =>
          `    - ${q.key}: "${q.label}" → ${q.choices
            .map((ch) => `${ch.value} ("${ch.label}")`)
            .join(" | ")}`,
      )
      .join("\n");
    return `- ${c.id} ("${c.label}"): ${c.hint}\n${questions}`;
  }).join("\n");
}

function fail(status, message) {
  return Response.json({ ok: false, error: message }, { status });
}

// النموذج ممكن يرجّع مفاتيح ما لها وجود — نقبل الصالح ونطرح الباقي
function sanitize(raw) {
  const categoryId = getCategory(raw.category_id) ? raw.category_id : null;
  const category = categoryId ? getCategory(categoryId) : null;

  const options = Array.isArray(raw.options)
    ? raw.options
        .filter((o) => typeof o === "string" && o.trim())
        .map((o) => o.trim().slice(0, 60))
        .filter((o, i, all) => all.indexOf(o) === i)
        .slice(0, MAX_OPTIONS)
    : [];

  const answers = {};
  const dropped = [];
  if (category && Array.isArray(raw.answers)) {
    for (const entry of raw.answers) {
      const question = category.questions.find(
        (q) => q.key === entry?.question_key,
      );
      const choice = question?.choices.find(
        (c) => c.value === entry?.choice_value,
      );
      if (question && choice) answers[question.key] = choice.value;
      else dropped.push(`${entry?.question_key}=${entry?.choice_value}`);
    }
  }

  // ما نثق بـ ready من النموذج — نحسبها من الحالة الفعلية
  const ready = Boolean(
    category &&
    options.length >= MIN_OPTIONS &&
    category.questions.every((q) => answers[q.key]),
  );

  return { categoryId, options, answers, ready, dropped };
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "الطلب لازم يكون JSON صالح.");
  }

  const utterance =
    typeof body?.utterance === "string" ? body.utterance.trim() : "";
  if (!utterance) return fail(400, "ما وصلنا نص.");
  if (utterance.length > 500) return fail(400, "النص طويل زيادة.");

  const state = body?.state ?? {};
  const history = Array.isArray(body?.history) ? body.history.slice(-6) : [];

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fail(503, "محرك المحادثة غير مهيأ.");

  const prompt = [
    "Available templates:",
    templatesForPrompt(),
    "",
    "Filled so far:",
    `- category_id: ${state.categoryId ?? "(none)"}`,
    `- options: ${(state.options ?? []).join(" | ") || "(none)"}`,
    `- answers: ${
      Object.entries(state.answers ?? {})
        .map(([k, v]) => `${k}=${v}`)
        .join(", ") || "(none)"
    }`,
    "",
    history.length ? "Recent conversation:" : "",
    ...history.map((h) => `${h.who === "user" ? "User" : "You"}: ${h.text}`),
    "",
    `User just said: "${utterance}"`,
  ]
    .filter(Boolean)
    .join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.4,
        abortSignal: controller.signal,
      },
    });

    const parsed = JSON.parse(response.text ?? "{}");
    const clean = sanitize(parsed);

    if (clean.dropped.length) {
      console.warn("[api/assist] dropped invalid keys:", clean.dropped);
    }

    const reply =
      typeof parsed.reply === "string" && parsed.reply.trim()
        ? parsed.reply.trim()
        : "ما وضحت لي — عيد عليّ؟";

    return Response.json({
      ok: true,
      reply,
      ready: clean.ready,
      state: {
        categoryId: clean.categoryId,
        options: clean.options,
        answers: clean.answers,
      },
    });
  } catch (err) {
    console.error("[api/assist] failed:", err);
    if (err.name === "AbortError") return fail(504, "تأخرت بالرد، عيد عليّ؟");
    return fail(502, "ما قدرت أفهمك الحين، عيد عليّ؟");
  } finally {
    clearTimeout(timeout);
  }
}
