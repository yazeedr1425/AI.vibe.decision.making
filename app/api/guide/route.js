import { GoogleGenAI, Type } from "@google/genai";
import { CATEGORIES, getCategory } from "@/lib/engine/categories";
import { MAX_OPTIONS, MIN_OPTIONS } from "@/lib/engine/score";
import { MOODS } from "@/lib/engine/mood";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "gemini-2.5-flash";
const TIMEOUT_MS = 15000;

// مرشد الوصول — مساعد للمكفوفين وغيرهم ممن يستعملون التطبيق بلا
// نظر أو بلا فأرة.
//
// الفرق الجوهري عن وضع الصوت المحذوف: هذا **ما ينطق**. مستخدم قارئ
// الشاشة عنده صوته وسرعته وإعداداته، وتطبيق ينطق فوقه يزاحمه. فالرد
// نص، والواجهة تحطه في aria-live، وقارئ الشاشة يقرأه بصوت صاحبه.
//
// وظيفتان: يوصف (وين أنا؟ وش الخيارات؟) وينفّذ (حطها برجر وسوشي،
// احسمها) — فالمستخدم ما يحتاج يتنقل بالـ Tab لكل عنصر ليعرف الشاشة.
const SYSTEM_INSTRUCTION = `You are the accessibility guide inside Ahsem, an Arabic decision-making app. You are talking to someone who very likely cannot see the screen and is using a screen reader (NVDA, VoiceOver, TalkBack) or keyboard only.

Your reply is READ ALOUD BY THEIR SCREEN READER, not by the app. So: plain sentences, no markup, no emoji, no bullet characters, no "click here", no colors or spatial words like "top right". Refer to things by their name and by how to reach them ("زر احسمها لي" not "الزر تحت").

You are BILINGUAL: mirror the language of their message. Arabic → spoken Saudi Arabic. English → plain warm English. Set "language" to "ar" or "en".

YOU ARE GIVEN a snapshot of what is currently on screen. Use it. Never guess state you were not given.

YOU DO TWO THINGS:

1. DESCRIBE — "وين أنا؟" / "what's on this screen?" / "وش الخيارات؟" → answer from the snapshot in one or two sentences. Say what matters and what they can do next, not a list of every element.

2. ACT — do it for them instead of making them tab around. Emit actions:
   - set_options: the things they are choosing between (${MIN_OPTIONS}-${MAX_OPTIONS})
   - set_category: a template id from the list given
   - set_mood: one of ${MOODS.map((m) => m.id).join("/")}
   - decide: run the decision now
   - breakdown: they asked to break down a big decision
   - restart: start a new decision
   - go: navigate — page is one of home, how, plan, analyze, settings, login, history
   - read_result: they asked to hear the verdict again

RULES:

1. ACT FIRST, EXPLAIN SECOND. "خليها برجر وسوشي واحسمها" → emit set_options AND decide, and reply in one short sentence saying what you did. Do not ask permission for what they plainly asked for.

2. IF SOMETHING BLOCKS THE ACTION, SAY EXACTLY WHAT IS MISSING. Deciding needs a category and at least ${MIN_OPTIONS} options. Missing category → say so and offer to pick one that fits their options.

3. NEVER INVENT WHAT IS ON SCREEN. If the snapshot does not say, tell them you cannot tell and suggest what would.

4. ONE OR TWO SENTENCES. They are listening, not reading. No preamble like "بالتأكيد" or "sure thing".

5. ORIENT, DON'T NARRATE. When they land somewhere new say where they are and the single most useful next action.

6. Only ever use category ids and mood ids from the lists you are given. Option strings stay exactly as the user said them.`;

const ACTION_TYPES = [
  "set_options",
  "set_category",
  "set_mood",
  "decide",
  "breakdown",
  "restart",
  "go",
  "read_result",
];

const PAGES = new Set([
  "home",
  "how",
  "plan",
  "analyze",
  "settings",
  "login",
  "history",
]);

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reply: {
      type: Type.STRING,
      description: "One or two plain sentences, read by a screen reader.",
    },
    language: { type: Type.STRING, enum: ["ar", "en"] },
    actions: {
      type: Type.ARRAY,
      description: "What the app should do now. Empty if it was only a question.",
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ACTION_TYPES },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          category_id: { type: Type.STRING },
          mood_id: { type: Type.STRING },
          page: { type: Type.STRING },
        },
        required: ["type"],
      },
    },
  },
  required: ["reply", "language", "actions"],
  propertyOrdering: ["reply", "language", "actions"],
};

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
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

const MOOD_IDS = new Set(MOODS.map((m) => m.id));

function sanitizeActions(raw) {
  const out = [];
  for (const action of Array.isArray(raw) ? raw : []) {
    switch (action?.type) {
      case "set_options": {
        const options = (Array.isArray(action.options) ? action.options : [])
          .filter((o) => typeof o === "string" && o.trim())
          .map((o) => o.trim().slice(0, 60))
          .filter((o, i, all) => all.indexOf(o) === i)
          .slice(0, MAX_OPTIONS);
        if (options.length) out.push({ type: "set_options", options });
        break;
      }
      case "set_category":
        if (getCategory(action.category_id)) {
          out.push({ type: "set_category", categoryId: action.category_id });
        }
        break;
      case "set_mood":
        if (MOOD_IDS.has(action.mood_id)) {
          out.push({ type: "set_mood", moodId: action.mood_id });
        }
        break;
      case "go":
        if (PAGES.has(action.page)) out.push({ type: "go", page: action.page });
        break;
      case "decide":
      case "breakdown":
      case "restart":
      case "read_result":
        out.push({ type: action.type });
        break;
      default:
        break;
    }
  }
  return out;
}

// لقطة الشاشة تجي من العميل — نصفها للنموذج بلغة يفهمها، ونقصّها
// حتى لا يحقن أحد برومبتاً عبر أسماء خيارات طويلة
const clip = (value, max = 200) =>
  typeof value === "string" ? value.slice(0, max) : "";

function describeSnapshot(snapshot) {
  const facts = snapshot?.facts ?? {};
  const lines = [
    `الشاشة الحالية: ${clip(snapshot?.screen) || "غير معروفة"}`,
    snapshot?.summary ? `وصفها: ${clip(snapshot.summary, 400)}` : "",
  ];

  if (Array.isArray(facts.options) && facts.options.length) {
    lines.push(`الخيارات المكتوبة: ${facts.options.map((o) => clip(o, 60)).join(" | ")}`);
  } else {
    lines.push("الخيارات المكتوبة: (ما فيه)");
  }

  const category = getCategory(facts.categoryId);
  lines.push(`نوع القرار: ${category ? category.label : "(ما انختار)"}`);
  if (facts.mood) lines.push(`المزاج: ${clip(facts.mood, 30)}`);
  if (facts.question) lines.push(`السؤال المعروض: ${clip(facts.question, 200)}`);
  if (facts.result) lines.push(`النتيجة المعروضة: ${clip(facts.result, 300)}`);
  if (facts.signedIn != null) {
    lines.push(facts.signedIn ? "المستخدم مسجّل دخوله." : "المستخدم غير مسجّل.");
  }
  return lines.filter(Boolean).join("\n");
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "الطلب لازم يكون JSON صالح.");
  }

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return fail(400, "ما وصلنا سؤال.");
  if (message.length > 400) return fail(400, "السؤال طويل زيادة.");

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allowed(ip)) return fail(429, "أسئلة كثيرة بسرعة — انتظر شوي.");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fail(503, "المرشد غير مهيأ — GEMINI_API_KEY مفقود.");

  const history = Array.isArray(body?.history) ? body.history.slice(-6) : [];

  const prompt = [
    "أنواع القرارات المتاحة:",
    CATEGORIES.map((c) => `- ${c.id} ("${c.label}"): ${c.hint}`).join("\n"),
    "",
    "لقطة الشاشة الآن:",
    describeSnapshot(body?.snapshot),
    "",
    history.length ? "آخر ما دار بينكما:" : "",
    ...history.map((h) => `${h.who === "user" ? "المستخدم" : "أنت"}: ${clip(h.text, 200)}`),
    "",
    `المستخدم يقول: "${message}"`,
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
    const reply =
      typeof parsed.reply === "string" && parsed.reply.trim()
        ? parsed.reply.trim().slice(0, 400)
        : "ما فهمت — تقدر تعيد صياغتها؟";

    return Response.json({
      ok: true,
      reply,
      language: parsed.language === "en" ? "en" : "ar",
      actions: sanitizeActions(parsed.actions),
    });
  } catch (err) {
    console.error("[api/guide] failed:", err);
    if (err.name === "AbortError") return fail(504, "تأخرت بالرد — جرب مرة ثانية.");
    if (err.status === 503) return fail(503, "المرشد مزدحم — انتظر شوي.");
    return fail(502, "ما قدرت أساعدك الحين — جرب مرة ثانية.");
  } finally {
    clearTimeout(timeout);
  }
}
