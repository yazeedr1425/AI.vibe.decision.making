// ذاكرة مؤقتة لتوقّعات Open-Meteo — نفس نمط lib/places/cache.js.
//
// كل ضغطة "أعد التوليد" أو "بدّل" تعيد بناء الخطة كاملة، والطقس
// لنفس الموقع واليوم ما يتغير بينها. بدون كاش نطلب نفس التوقّع
// خمس مرات في دقيقة.
//
// المهلة أطول من كاش الأماكن: Open-Meteo يحدّث التوقّع كل ساعة
// تقريباً، فنصف ساعة تعطي بيانات طازجة بلا نداءات مكررة.
//
// ⚠️ داخل الذاكرة فقط: على Vercel كل نسخة لها كاشها الخاص وينمسح
// مع إعادة التشغيل — الهدف تقليل التكرار داخل الجلسة لا كاش موزّع.

const TTL_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 100;

const store = new Map();

// الإصابة الأساسية تجي من تكرار الطلب نفسه: "أعد التوليد" و"بدّل"
// يرسلان نفس الإحداثيات بالضبط، لأن coords تُضبط مرة واحدة في
// الصفحة و resolveLocation يرجّع نفس النقطة لنفس النص.
//
// التقريب لخانتين (≈ ١ كم) مكسب إضافي لا أكثر: الطقس ما يتغير داخل
// كيلومتر، فنقطتان متجاورتان تتشاركان الكاش غالباً. غالباً لا دائماً
// — نقطتان على طرفي حدّ التقريب (46.6750 و46.6753) تنزلان في دلوين
// مختلفين. هذا نقص كفاءة لا خطأ: أسوأ ما يصير نداء زائد.
const round = (n) => Math.round(n * 100) / 100;

export function weatherKey({ lat, lng, date }) {
  return [round(lat), round(lng), date].join("|");
}

export function readWeather(key) {
  const hit = store.get(key);
  if (!hit) return null;

  if (Date.now() - hit.at > TTL_MS) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

export function writeWeather(key, value) {
  // حذف الأقدم عند الامتلاء — Map يحفظ ترتيب الإدراج
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { at: Date.now(), value });
}
