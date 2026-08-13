// إعدادات مولّد خطة اليوم — يستوردها الخادم والمتصفح معاً،
// فلا تضع فيها أي مفتاح ولا نداء شبكة.

export const VIBES = [
  {
    id: "chill",
    label: "هادي",
    emoji: "☕",
    // أنواع Places API (New) — الجدول A
    types: ["cafe", "book_store", "art_gallery", "park", "library"],
  },
  {
    id: "active",
    label: "نشيط",
    emoji: "🏃",
    types: ["gym", "park", "bowling_alley", "amusement_park", "sports_complex"],
  },
  {
    id: "foodie",
    label: "أكل",
    emoji: "🍽️",
    types: ["restaurant", "bakery", "ice_cream_shop", "cafe"],
  },
  {
    id: "outdoors",
    label: "برّا",
    emoji: "🌳",
    types: ["park", "hiking_area", "tourist_attraction", "zoo"],
  },
  {
    id: "nightlife",
    label: "سهر",
    emoji: "🌙",
    types: ["bar", "night_club", "casino", "movie_theater"],
  },
];

export const GROUPS = [
  { id: "solo", label: "لحالي", emoji: "🧍" },
  { id: "couple", label: "أنا وشريكي", emoji: "💑" },
  { id: "family_kids", label: "عائلة وأطفال", emoji: "👨‍👩‍👧" },
  { id: "friends", label: "مع الأصحاب", emoji: "👯" },
];

export const BUDGETS = [
  { id: "low", label: "اقتصادي", hint: "مجاني إلى رخيص", maxPriceLevel: 1 },
  { id: "medium", label: "متوسط", hint: "معقول", maxPriceLevel: 2 },
  { id: "high", label: "مفتوح", hint: "ما يهم السعر", maxPriceLevel: 4 },
];

export const DURATIONS = [
  { id: 3, label: "٣ ساعات" },
  { id: 5, label: "٥ ساعات" },
  { id: 8, label: "يوم كامل" },
];

export const DEFAULT_RADIUS_KM = 15;
export const MIN_RADIUS_KM = 1;
export const MAX_RADIUS_KM = 50;

export const MIN_DURATION_HOURS = 1;
export const MAX_DURATION_HOURS = 12;

// المرشّحون: نجيب ٢٠–٣٠ ونقصّهم قبل ما نرسلهم للنموذج
export const MAX_CANDIDATES = 30;

export const vibe = (id) => VIBES.find((v) => v.id === id) ?? null;
export const group = (id) => GROUPS.find((g) => g.id === id) ?? null;
export const budget = (id) => BUDGETS.find((b) => b.id === id) ?? null;

// "14:30" ← دقائق من منتصف الليل. نستخدمها في فلترة أوقات العمل.
export function minutesOfDay(hhmm) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? "");
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function formatClock(totalMinutes) {
  // نلفّ حول منتصف الليل حتى لا تظهر ٢٥:٠٠ في خطة تمتد للفجر
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const h = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const m = String(wrapped % 60).padStart(2, "0");
  return `${h}:${m}`;
}
