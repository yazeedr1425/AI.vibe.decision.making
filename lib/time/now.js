/**
 * وقت المستخدم — يُقرأ في المتصفح، ويُتحقق منه في الخادم.
 *
 * الوقت أرخص حقيقة في المشروع: المتصفح يعرفه بلا نداء ولا حصة، وهو
 * يغيّر المفاضلة فعلاً — «شاورما ولا بروست» الساعة ١١:٤٠ ليلاً غير
 * نفس السؤال الساعة ١ ظهراً.
 *
 * يُقرأ من المتصفح لا من الخادم عمداً: فرق الرياض عن UTC ثلاث ساعات،
 * وساعة الخادم على فيرسل ليست ساعة المستخدم — نفس السبب الذي يجعل
 * lib/insight/stats.js يحسب بمنطقة المستخدم أو يسقط الإحصاء كاملاً.
 */

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

// الجمعة والسبت لا السبت والأحد: التطبيق سعودي أولاً، و«عطلة» عند
// مستخدمه تعني آخر الأسبوع الخليجي. لو اتسع الجمهور لاحقاً فالاشتقاق
// من المنطقة الزمنية أدق من ثابت هنا.
const WEEKEND = new Set(["friday", "saturday"]);

// أسماء مناطق IANA فقط. نفس حارس lib/insight/stats.js: قيمة مصنوعة
// تدخل Intl وترمي، والرمي هنا يسقط الطلب كله على تحسين اختياري.
const TIMEZONE = /^[A-Za-z][A-Za-z0-9+_-]*(\/[A-Za-z0-9+_-]+){0,2}$/;

/**
 * يُنادى في المتصفح فقط. يرجّع null لو تعذّر أي جزء — الوقت تحسين،
 * وغيابه يعني إطاراً بلا تأريض زمني لا خطأً.
 */
export function readNow() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz || !TIMEZONE.test(tz)) return null;

    const at = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
      hour: "2-digit",
      hour12: false,
    }).formatToParts(at);

    const weekday = parts.find((p) => p.type === "weekday")?.value.toLowerCase();
    // بعض إصدارات ICU ترجّع "24" لمنتصف الليل بدل "00"
    const hour = Number(parts.find((p) => p.type === "hour")?.value) % 24;

    if (!WEEKDAYS.includes(weekday)) return null;
    if (!Number.isInteger(hour)) return null;

    return {
      iso: at.toISOString(),
      tz,
      weekday,
      hour,
      isWeekend: WEEKEND.has(weekday),
    };
  } catch {
    return null;
  }
}

/**
 * حارس الخادم. يرجّع null لكل ما لا يُطابق العقد — والمنطقة غير
 * الصالحة تُسقط الكتلة كاملة ولا تفشّل الطلب: الإطار يُبنى بلا وقت
 * منذ أول يوم، فالسقوط هنا مسار طبيعي لا حالة خطأ.
 *
 * isWeekend تُشتق هنا ولا تُقرأ من العميل: القيمة المرسلة تدخل مفتاح
 * الكاش، وقيمة يتحكم بها الطالب تعني إدخالين لنفس الوقت.
 */
export function shapeNow(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const { tz, weekday, hour, iso } = raw;

  if (typeof tz !== "string" || !TIMEZONE.test(tz)) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
  } catch {
    return null;
  }

  if (typeof weekday !== "string" || !WEEKDAYS.includes(weekday)) return null;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;

  const stamp = typeof iso === "string" ? new Date(iso) : null;
  if (!stamp || Number.isNaN(stamp.getTime())) return null;

  return {
    iso: stamp.toISOString(),
    tz,
    weekday,
    hour,
    isWeekend: WEEKEND.has(weekday),
  };
}

// شرائح خشنة لا الساعة نفسها: الساعة تصنع ٢٤ إدخال كاش لكل مفاضلة،
// والفرق بين ٧ و٨ صباحاً لا يغيّر أي حكم. الأربع شرائح هي ما يغيّره.
const SLICES = [
  { key: "morning", from: 5, to: 11 },
  { key: "noon", from: 12, to: 16 },
  { key: "evening", from: 17, to: 21 },
];

export function sliceOf(now) {
  if (!now) return null;
  const found = SLICES.find((s) => now.hour >= s.from && now.hour <= s.to);
  return found ? found.key : "night";
}

/**
 * جزء مفتاح الكاش. بدونه يُخدَم إطار الظهر لقرار منتصف الليل — وهو
 * بالضبط ما يبطل الميزة بينما تبدو شغّالة.
 */
export function cacheSlice(now) {
  const slice = sliceOf(now);
  if (!slice) return "anytime";
  return now.isWeekend ? `${slice}+weekend` : slice;
}
