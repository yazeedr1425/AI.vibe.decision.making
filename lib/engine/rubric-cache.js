// كاش المعايير المولّدة — نفس نمط lib/places/cache.js.
//
// التوليد نداء حاجز بين إدخال الخيارات وظهور الأسئلة، فالمستخدم
// ينتظره فعلاً. والمفاضلات تتكرر كثيراً بين الناس: "برجر ولا سوشي"
// و"أطبخ ولا أطلب" تتكرر يومياً، فالإصابة تشيل الانتظار كاملاً.
//
// المهلة طويلة لأن المحتوى شبه ثابت: ما يفرّق بين برجر وسوشي اليوم
// هو نفسه بكرة. وطول المهلة يعطي فائدة ثانية — نفس المفاضلة تعطي
// نفس المعايير لمستخدمين مختلفين، فتصير التجربة متسقة.
//
// ⚠️ داخل الذاكرة فقط: على Vercel لكل نسخة كاشها وينمسح مع إعادة
// التشغيل. الهدف تقليل التكرار لا كاش موزّع.

const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_ENTRIES = 300;

const store = new Map();

// التطبيع يوسّع الإصابة: "برجر" و"البرجر " و"بُرجر" مفاضلة واحدة.
// أ/إ/آ→ا و ة→ه و ى→ي لأن الناس يكتبونها بالطريقتين بلا تمييز،
// والتشكيل والتطويل زينة كتابية لا تغيّر الكلمة.
function normalize(s) {
  return s
    .normalize("NFKC")
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// الترتيب مقصود: "برجر ولا سوشي" و"سوشي ولا برجر" نفس السؤال،
// والمعايير اللي تفرّق بينهما لا تتأثر بترتيب الإدخال.
export function rubricKey({ options, categoryId }) {
  return [categoryId, ...options.map(normalize).sort()].join("|");
}

export function readRubric(key) {
  const hit = store.get(key);
  if (!hit) return null;

  if (Date.now() - hit.at > TTL_MS) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

export function writeRubric(key, value) {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { at: Date.now(), value });
}
