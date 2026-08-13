// ذاكرة مؤقتة لنتائج Places — نفس الموقع ونفس النطاق ونفس النوع
// يرجّع نفس المطاعم تقريباً، فما فيه داعي ندفع نداءً جديداً كل مرة
// يضغط المستخدم "أعد التوليد".
//
// ⚠️ داخل الذاكرة فقط: على Vercel كل نسخة (instance) لها كاشها الخاص،
// وينمسح مع إعادة التشغيل. هذا مقبول — الهدف تقليل التكرار في نفس
// الجلسة، مو كاش موزّع.

const TTL_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 200;

const store = new Map();

// تقريب الإحداثيات ضروري: GPS الخام ما يتكرر أبداً، فالمفتاح
// بدون تقريب ما يصيب ولا مرة. ٣ خانات ≈ ١٠٠ متر.
const round = (n) => Math.round(n * 1000) / 1000;

export function cacheKey({ lat, lng, radiusKm, types }) {
  return [
    round(lat),
    round(lng),
    radiusKm,
    [...types].sort().join(","),
  ].join("|");
}

export function readCache(key) {
  const hit = store.get(key);
  if (!hit) return null;

  if (Date.now() - hit.at > TTL_MS) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

export function writeCache(key, value) {
  // حذف الأقدم عند الامتلاء — Map يحفظ ترتيب الإدراج
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { at: Date.now(), value });
}
