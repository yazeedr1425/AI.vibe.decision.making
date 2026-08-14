import { GoogleGenAI, Type } from "@google/genai";
import { MAX_OPTIONS, MIN_OPTIONS } from "@/lib/engine/score";
import { normalizeArabic } from "@/lib/voice/match";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "gemini-2.5-flash";
// الصور أبطأ من النص — درس المهلات: تُقاس ولا تُخمَّن، والضيقة تفشل بصمت
const TIMEOUT_MS = 25000;
const MAX_LABEL_LENGTH = 60;

// المتصفح يصغّر قبل الرفع، وهذا سقف أمان لو تجاوزه أحد يدوياً.
// ٤ ميغا بعد base64 ≈ ٣ ميغا صورة — تحت حد فيرسل (٤٫٥) بهامش.
const MAX_BASE64_LENGTH = 4 * 1024 * 1024;
const MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// استخراج الخيارات من صورة: منيو مطعم، منتجان على رف، عرضا عمل.
//
// أخطر فشل هنا مو "ما لقينا شي" — هو اختراع خيارات ما في الصورة.
// المستخدم بيثق بالمستخرج أكثر من المكتوب بيده، فقائمة نظيفة فيها
// عنصر مخترع أسوأ من رسالة "صوّر أوضح".
const SYSTEM_PROMPT = `You look at one photo and pull out the things the person is choosing BETWEEN. They will tap one of them as their decision, so each option must be a real, distinct, pickable thing visible in the image.

WHAT COUNTS AS AN OPTION:
- Menu photo → dish names (not sections, not sides, not the restaurant name).
- Products on a shelf or two items side by side → the product names.
- Two documents / job offers / screenshots → a 2-4 word label for each.
- A movie list, a shop window, two destinations on a map — same idea.

HARD RULES:

1. ONLY WHAT IS IN THE IMAGE. Never add an option that is not visibly there. If you can read only one choosable thing, or none, return an empty list — that is a correct answer, and inventing a second option to fill the quota is the worst possible failure.

2. AT MOST ${MAX_OPTIONS}. A menu can show thirty dishes; pick the ${MAX_OPTIONS} most prominent DISTINCT mains (not a dish and its own variant). If the photo clearly centers on two things, return exactly those two.

3. NAMES AS THE MENU WRITES THEM. If the item has an Arabic name in the image, use it. If it is written only in Latin script, keep it as written — do not translate "Big Mac" into a description. Strip prices, numbers, and descriptions: "شاورما دجاج" not "شاورما دجاج بالثوم مع بطاطس ١٨ ريال".

4. SHORT. Each option is a name, five words at most.

5. "scene" is one short Arabic sentence saying what you saw, spoken casually: "منيو مطعم — طلعنا لك الأطباق الرئيسية" · "جوالان جنب بعض". It is shown to the user so they know the photo was understood.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    options: {
      type: Type.ARRAY,
      description: `Zero to ${MAX_OPTIONS} distinct choosable things visible in the image.`,
      items: { type: Type.STRING },
    },
    scene: {
      type: Type.STRING,
      description: "One short Arabic sentence describing what the image is.",
    },
  },
  required: ["options", "scene"],
  propertyOrdering: ["options", "scene"],
};

// نداء بصورة أغلى من نداء نصي، والرفع ينضغط بضغطة زر — حد أشد
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
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;

  const image = typeof body.image === "string" ? body.image.trim() : "";
  const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";

  if (!image || image.length > MAX_BASE64_LENGTH) return null;
  if (!MIME_TYPES.has(mimeType)) return null;
  // base64 خام بلا بادئة data: — المتصفح يقصها قبل الإرسال
  if (!/^[A-Za-z0-9+/]+=*$/.test(image)) return null;

  return { image, mimeType };
}

/** يقص، يكرر، يطوّل — نقبل الصالح ونطرح الباقي */
function shape(raw) {
  const seen = new Set();
  const out = [];

  for (const item of Array.isArray(raw?.options) ? raw.options : []) {
    const label = typeof item === "string" ? item.trim().slice(0, MAX_LABEL_LENGTH) : "";
    const key = normalizeArabic(label);
    if (!label || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length === MAX_OPTIONS) break;
  }

  return {
    options: out,
    scene: (typeof raw?.scene === "string" ? raw.scene.trim() : "").slice(0, 120),
  };
}

// ---------------------------------------------------------------
// POST /api/vision
// ---------------------------------------------------------------

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "ما قدرنا نقرأ الطلب.");
  }

  const parsed = validate(body);
  if (!parsed) return fail(400, "صورة غير صالحة — jpeg أو png أو webp وبحجم معقول.");

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allowed(ip)) {
    return fail(429, "صور كثيرة — انتظر دقيقة وجرب.");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fail(503, "قارئ الصور غير مهيأ — GEMINI_API_KEY مفقود.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        { inlineData: { mimeType: parsed.mimeType, data: parsed.image } },
        "طلّع الخيارات اللي يحتار بينها صاحب هذي الصورة. أرجع كائن JSON فقط.",
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        // الاستخراج نسخ لا إبداع — حرارة منخفضة عمداً
        temperature: 0.2,
        abortSignal: controller.signal,
      },
    });

    const { options, scene } = shape(JSON.parse(response.text ?? "{}"));

    // أقل من خيارين = ما فيه قرار. رسالة صادقة أفضل من تعبئة نصف
    // الخانات وترك المستخدم يفسّر وش صار.
    if (options.length < MIN_OPTIONS) {
      return fail(
        422,
        scene
          ? `شفنا الصورة (${scene}) بس ما لقينا خيارين واضحين — جرب صورة أقرب.`
          : "ما لقينا خيارين واضحين في الصورة — جرب صورة أوضح.",
      );
    }

    return Response.json({ ok: true, options, scene });
  } catch (err) {
    console.error("[api/vision] failed:", err);
    if (err.name === "AbortError") {
      return fail(504, "قراءة الصورة تأخرت — جرب مرة ثانية.");
    }
    if (err.status === 503) {
      return fail(503, "القارئ مزدحم الحين — انتظر شوي وجرب.");
    }
    return fail(502, "ما قدرنا نقرأ الصورة — جرب مرة ثانية.");
  } finally {
    clearTimeout(timer);
  }
}
