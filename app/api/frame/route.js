import { GoogleGenAI } from "@google/genai";
import {
  FRAME_SCHEMA,
  FRAME_SYSTEM,
  framePrompt,
  shapeFrame,
} from "@/lib/engine/frame";
import { MAX_OPTIONS, MIN_OPTIONS } from "@/lib/engine/score";
import { clientIp, createLimiter } from "@/lib/rate-limit";
import { toArabicDigits as hindi } from "@/lib/text/digits";
import { normalizeArabic } from "@/lib/voice/match";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// نداء نموذج كامل على المسار الحرج — أضيق من `decide` لأن كل طلب هنا
// يولّد مخرَجاً أكبر، وأوسع من `plan` لأنه ما يمس حصص خدمات أخرى
const allowed = createLimiter({ max: 8 });

const MODEL = "gemini-2.5-flash";

// مقيس لا مفترض (‎bench-frame.mjs‎): الوسيط ‎٣٠٦٧ms‎ والأقصى المرصود
// ‎٤٢٧٧ms‎ على زوج سهل بتفكير مطفأ. الأزواج المجرّدة أبطأ، والمهلة
// الضيقة تفشل *صامتة* كواجهة ناقصة — فالهامش هنا مقصود لا كسل.
const GEMINI_TIMEOUT_MS = 20000;

// القياس أثبت أن الحقل مُطبَّق فعلاً: `thoughtsTokenCount` نزل من
// ‎٢٧١٢‎ إلى ‎٠‎، والوسيط من ‎٨٨٥٣ms‎ إلى ‎٣٣٢٥ms‎. الدليل هو العدّاد لا
// غياب الخطأ — والحقل المجهول يُتجاهل بصمت.
//
// `thinkingLevel` جُرِّب ورجّع ‎400‎ («not supported for this model»)،
// و`gemini-2.5-flash-lite` رجّع ‎404‎ (سُحب) — فما بقي إلا هذا.
const THINKING = { thinkingBudget: 0 };

const MAX_LABEL_LENGTH = 60;
const MIN_LABEL_LENGTH = 2;

function fail(status, message) {
  return Response.json({ ok: false, error: message }, { status });
}

// ---------------------------------------------------------------
// التحقق من المدخلات
// ---------------------------------------------------------------

// الإطار يخدم المدى كله لا الخيارين وحدهما: المعايير والأسئلة ما
// تعرف عدد الخيارات أصلاً، و`priors` مصفوفة لكل خيار. ولو بقي
// الراوت على اثنين، لَبقي مسار ٣–٥ بلا فئة بعد حذف المنتقي — فتطلع
// شاشة نتيجة فاضية، وهو أسوأ من قالب.
//
// شاشة المبارزة وحدها تخص الخيارين، وهي في الواجهة لا هنا.
function validate(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "الطلب لازم يكون كائن JSON." };
  }

  const { options } = body;

  if (
    !Array.isArray(options) ||
    options.length < MIN_OPTIONS ||
    options.length > MAX_OPTIONS
  ) {
    return {
      ok: false,
      message: hindi(
        `عدد الخيارات لازم يكون بين ${MIN_OPTIONS} و${MAX_OPTIONS}.`,
      ),
    };
  }

  const cleaned = options
    .filter((o) => typeof o === "string")
    .map((o) => o.trim());

  if (cleaned.length !== options.length) {
    return { ok: false, message: "كل خيار لازم يكون نص." };
  }
  if (cleaned.some((o) => o.length < MIN_LABEL_LENGTH)) {
    return { ok: false, message: "اكتب خياراتك قبل." };
  }
  if (cleaned.some((o) => o.length > MAX_LABEL_LENGTH)) {
    return {
      ok: false,
      message: hindi(`طول الخيار الواحد ما يتجاوز ${MAX_LABEL_LENGTH} حرف.`),
    };
  }
  // التطبيع قبل المقارنة: «أطلب» و«اطلب» خيار واحد، ومعيار يفرّق
  // بينهما مستحيل
  if (new Set(cleaned.map(normalizeArabic)).size !== cleaned.length) {
    return { ok: false, message: "فيه خيارات مكررة — غيّر واحد منها." };
  }

  return { ok: true, value: { options: cleaned } };
}

// ---------------------------------------------------------------
// الكاش
// ---------------------------------------------------------------

// «كبسة/برجر» يتكرر كثيراً، والإطار أغلى نداء في المسار. الرقم يرتفع
// مع أي تغيير في البرومبت أو العقد — وإلا تُخدَم إدخالات بشكل قديم.
// والفرز في المفتاح يخلي ترتيب الخيارات لا يصنع إدخالاً جديداً
const VERSION = "v4-any-count";
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 300;
const store = new Map();

// مرتّب بعد التطبيع: «كبسة ضد برجر» و«برجر ضد كبسة» نفس المفاضلة
const cacheKey = (options) =>
  [VERSION, ...options.map(normalizeArabic).sort()].join("|");

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
// نداء Gemini
// ---------------------------------------------------------------

async function askGemini(options) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error("GEMINI_API_KEY is not set");
    err.code = "NO_API_KEY";
    throw err;
  }

  const ai = new GoogleGenAI({ apiKey });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let response;
  try {
    response = await ai.models.generateContent({
      model: MODEL,
      contents: framePrompt(options),
      config: {
        systemInstruction: FRAME_SYSTEM,
        responseMimeType: "application/json",
        responseSchema: FRAME_SCHEMA,
        // أقل من `decide` (‎٠٫٩‎): هنا بنية صحيحة لا طرافة
        temperature: 0.7,
        thinkingConfig: THINKING,
        abortSignal: controller.signal,
      },
    });
  } finally {
    clearTimeout(timeout);
  }

  const text = response?.text;
  if (!text) {
    const err = new Error("Gemini returned an empty response");
    err.code = "EMPTY";
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const err = new Error(`Gemini returned non-JSON: ${text.slice(0, 200)}`);
    err.code = "BAD_JSON";
    throw err;
  }

  const shaped = shapeFrame(parsed, { options });
  if (!shaped.ok) {
    const err = new Error(`Frame failed validation: ${shaped.reason}`);
    err.code = shaped.reason;
    throw err;
  }

  return shaped.frame;
}

// ---------------------------------------------------------------
// POST /api/frame
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

  // ما فيه تحقق هوية هنا عمداً: الإطار ما يقرأ سجلاً ولا يخصّص لأحد،
  // فنداء Supabase للتوكن يضيف قفزة شبكة على المسار الذي كل هذا
  // القياس لتقصيره. و`userId` من الـ body غير مقروء أصلاً فلا يُوثق به.

  // الكاش قبل السقف — نفس ترتيب `third`. السقف يحرس نداء النموذج
  // لأنه هو الذي يكلّف مالاً، وضربة كاش ما تكلّف شيئاً. والترتيب
  // المعكوس يؤذي مستخدماً حقيقياً: الإطار يُطلق عند خروج المؤشر من
  // حقل الخيار الثاني، فدخول وخروج متكرر يستهلك حصته على ردود مجانية.
  const key = cacheKey(options);
  const cached = readCache(key);
  if (cached) {
    return Response.json({ ok: true, frame: cached, source: "cache" });
  }

  if (!allowed(clientIp(request))) return fail(429, "محاولات كثيرة — انتظر دقيقة.");

  let frame;
  try {
    frame = await askGemini(options);
  } catch (err) {
    console.error(`[api/frame] failed (${err.code ?? "UNKNOWN"}):`, err);

    if (err.code === "NO_API_KEY") {
      return fail(503, "محرك القرار غير مهيأ — GEMINI_API_KEY مفقود.");
    }
    if (err.name === "AbortError") {
      return fail(504, "قراءة خياراتك تأخرت، جرب مرة ثانية.");
    }
    // مخرَج مرفوض من `shapeFrame` أو خطأ من الـ API نفسه. لا قالب
    // بديل: سؤال من قالب يتنكّر كتوليد أسوأ من خطأ صريح
    return fail(502, "ما قدرنا نقرأ خياراتك الحين، جرب مرة ثانية.");
  }

  writeCache(key, frame);
  return Response.json({ ok: true, frame, source: "model" });
}
