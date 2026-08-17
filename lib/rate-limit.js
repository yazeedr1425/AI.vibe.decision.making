// حدّ معدّل الطلبات لكل IP.
//
// المسارات القديمة (signup, magic-link, third, breakdown, group) تحمل
// نسخة مكتوبة بيدها من هذا المنطق. هنا نصنعه مرة واحدة بدل ما نلصقه
// في خمسة مسارات أخرى ويصير عشر نسخ من دالة واحدة.
//
// ما يحميه: كل مسار من هذي المسارات ينادي جيميناي، وكل نداء يكلّف
// مالاً. بلا حدّ، حلقة من خمسة أسطر على /api/decide تصرف الرصيد كله
// بلا سقف. و/api/plan أغلى: ينادي أماكن جوجل والطقس مع كل طلب.
//
// ⚠️ القيد المهم: الذاكرة هنا داخل العملية نفسها. على فيرسل كل نسخة
// من الدالة لها ذاكرتها، فالحدّ يتضاعف بعدد النسخ الحيّة، ويُصفَّر مع
// كل إعادة تشغيل. هذا مصدّ للعبث العابر لا سقف حقيقي — السقف الحقيقي
// يحتاج مخزناً مشتركاً (Vercel KV أو Upstash).

// حرس تسريب الذاكرة: بلا تنظيف تكبر الخريطة بعدد الـ IP إلى ما لا نهاية
const MAX_TRACKED_IPS = 1000;

/**
 * يصنع دالة allowed(ip) مستقلة بذاكرتها — كل مسار له عدّاده الخاص
 * حتى لا يستهلك مسارٌ حدَّ غيره.
 *
 * @param {{ max: number, windowMs?: number }} options
 * @returns {(ip: string) => boolean} صح = مسموح، خطأ = تجاوز الحد
 */
export function createLimiter({ max, windowMs = 60_000 }) {
  const hits = new Map();

  return function allowed(ip) {
    const now = Date.now();
    const seen = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
    seen.push(now);
    hits.set(ip, seen);

    if (hits.size > MAX_TRACKED_IPS) {
      for (const [key, times] of hits) {
        if (!times.some((t) => now - t < windowMs)) hits.delete(key);
      }
    }

    return seen.length <= max;
  };
}

/**
 * الـ IP من ترويسة الوكيل. x-forwarded-for قد يحمل سلسلة وكلاء،
 * وأولها هو العميل الأصلي. "local" للتطوير حيث ما فيه ترويسة.
 */
export function clientIp(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local"
  );
}
