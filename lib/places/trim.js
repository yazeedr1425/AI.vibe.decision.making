// تقليم نتائج Places قبل ما توصل للنموذج.
//
// Places API يرجّع حقولاً كثيرة (صور، مراجعات، أرقام هواتف…) وكلها
// تنحسب توكنز. نحتفظ بالحد الأدنى الذي يحتاجه النموذج ليختار ويرتّب:
// المعرّف، الاسم، النوع، التقييم، السعر، الإحداثيات، أوقات العمل، العنوان.

const PRICE_LEVELS = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

const WEEK_MINUTES = 7 * 1440;

export function trimPlace(raw) {
  if (!raw?.id) return null;

  const lat = raw.location?.latitude;
  const lng = raw.location?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null;

  return {
    id: raw.id,
    name: raw.displayName?.text ?? null,
    category: raw.primaryType ?? raw.types?.[0] ?? null,
    rating: typeof raw.rating === "number" ? raw.rating : null,
    price_level: PRICE_LEVELS[raw.priceLevel] ?? null,
    lat,
    lng,
    // periods فقط — weekdayDescriptions نصوص طويلة ما يحتاجها النموذج
    opening_hours: raw.regularOpeningHours?.periods ?? null,
    address: raw.formattedAddress ?? null,
  };
}

// ---------------------------------------------------------------
// فلترة أوقات العمل
// ---------------------------------------------------------------

// المكان وقت المستخدم في نفس المنطقة الزمنية (البحث داخل ١٥ كم)،
// فنعامل ساعة المستخدم على أنها الساعة المحلية للمكان. لو صار البحث
// يوماً ما عابراً للمناطق الزمنية فهذا أول ما ينكسر.
function periodToRange(period) {
  const open = period?.open;
  if (!open || typeof open.day !== "number") return null;

  const openAbs = open.day * 1440 + (open.hour ?? 0) * 60 + (open.minute ?? 0);

  // غياب close يعني مفتوح ٢٤ ساعة
  const close = period.close;
  if (!close || typeof close.day !== "number") {
    return { open: openAbs, close: openAbs + WEEK_MINUTES };
  }

  let closeAbs =
    close.day * 1440 + (close.hour ?? 0) * 60 + (close.minute ?? 0);

  // الإغلاق بعد منتصف الليل يلفّ للأسبوع التالي (يفتح السبت ٢٢:٠٠ ويغلق الأحد ٠٢:٠٠)
  if (closeAbs <= openAbs) closeAbs += WEEK_MINUTES;

  return { open: openAbs, close: closeAbs };
}

const overlaps = (a, b) => a.open < b.close && b.open < a.close;

/**
 * هل المكان مفتوح في أي جزء من نافذة الخروج؟
 *
 * weekday: 0 = الأحد (نفس ترقيم Places API)
 * startMinutes: دقائق من منتصف ليل ذلك اليوم
 * durationMinutes: طول الخروجة — قد يتجاوز منتصف الليل
 */
export function isOpenDuring(place, { weekday, startMinutes, durationMinutes }) {
  const periods = place.opening_hours;

  // ما عندنا بيانات ← ما نحذفه. الحذف على أساس "مجهول" يخسّرنا
  // أماكن شغّالة فعلاً، والنموذج يقدر يذكر أن الأوقات غير مؤكدة.
  if (!Array.isArray(periods) || periods.length === 0) return true;

  const start = weekday * 1440 + startMinutes;
  const window = { open: start, close: start + durationMinutes };

  for (const period of periods) {
    const range = periodToRange(period);
    if (!range) continue;

    // نقارن النافذة بنسختها قبل الأسبوع وبعده أيضاً، لأن الفترة
    // قد تكون ملفوفة حول نهاية الأسبوع
    if (
      overlaps(range, window) ||
      overlaps(range, {
        open: window.open + WEEK_MINUTES,
        close: window.close + WEEK_MINUTES,
      }) ||
      overlaps(range, {
        open: window.open - WEEK_MINUTES,
        close: window.close - WEEK_MINUTES,
      })
    ) {
      return true;
    }
  }

  return false;
}

/**
 * يقلّم ويفلتر ويرتّب المرشّحين.
 * الترتيب بالتقييم حتى لو قصّينا القائمة نبقي الأفضل.
 */
export function prepareCandidates(rawPlaces, window, limit) {
  const seen = new Set();
  const out = [];

  for (const raw of rawPlaces) {
    const place = trimPlace(raw);
    if (!place || seen.has(place.id)) continue;
    if (!isOpenDuring(place, window)) continue;

    seen.add(place.id);
    out.push(place);
  }

  out.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  return out.slice(0, limit);
}
