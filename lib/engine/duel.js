// المبارزة — مقارنة خيارين بمقبض واحد لكل معيار بدل خانتين.
//
// ليش هذا التحويل غير فاقد للمعلومة: مع خيارين يتحدد الفائز بـ
// ‎Σ w×(rA − rB)‎ — الفارق وحده هو المهم، لا القيمة المطلقة. ومجال
// التقييم ١–٣ يعطي خمسة فوارق ممكنة فقط (‎-2..+2‎)، فخمس محطات تغطيها
// كلها. ولهذا بالضبط تبقى `RatingGrid` للثلاثة فأكثر: هناك القيمة
// المطلقة تدخل الحساب ولا يكفي الفارق.
//
// المخرَج تقييمات عادية يقرأها `scoreOptions` — `score.js` ما يعرف
// أن شاشة المبارزة موجودة أصلاً.

export const DUEL_MIN = -2;
export const DUEL_MAX = 2;
export const DUEL_STOPS = [-2, -1, 0, 1, 2];

// الموجب يميل للخيار الأول. الجدول من الخطة حرفياً.
const RATINGS_AT = {
  "-2": { first: 1, second: 3 },
  "-1": { first: 2, second: 3 },
  0: { first: 2, second: 2 },
  1: { first: 3, second: 2 },
  2: { first: 3, second: 1 },
};

const clamp = (n) => Math.max(DUEL_MIN, Math.min(DUEL_MAX, n));

/** تقييما الخيارين عند موضع مقبض. */
export function ratingsAt(position) {
  return RATINGS_AT[String(clamp(Math.round(position)))] ?? RATINGS_AT[0];
}

/**
 * الموضع المقابل لتقييمين. الفارق هو المعنى، فأي زوج خارج الجدول
 * (قرار قديم قُيِّم بالشبكة) ينحدر لأقرب موضع بدل ما يسقط.
 */
export function positionFrom(first, second) {
  if (first == null || second == null) return 0;
  return clamp(first - second);
}

/**
 * تقييمات ابتدائية من تقدير النموذج: المستخدم يفتح الشاشة على وضعٍ
 * معقول ويصحّح ما يخالفه، بدل ما يعبّي من الصفر.
 *
 * الاشتقاق عند الرندر لا ضبطٌ داخل أثر: المعيار الذي لمسه المستخدم
 * يبقى له، وغير الملموس ياخذ التقدير — فلا يحتاج `setState` في إفكت
 * ولا يمسح تعديلاً وصل قبل الإطار.
 */
export function withPriors(ratings, frame, options) {
  if (!frame?.priors || options.length !== 2) return ratings;

  const [a, b] = options;
  const out = { ...ratings };

  for (const c of frame.criteria) {
    if (out[a.id]?.[c.key] != null && out[b.id]?.[c.key] != null) continue;

    const pa = frame.priors[a.label]?.[c.key];
    const pb = frame.priors[b.label]?.[c.key];
    if (pa == null || pb == null) continue;

    const { first, second } = ratingsAt(positionFrom(pa, pb));
    out[a.id] = { ...out[a.id], [c.key]: first };
    out[b.id] = { ...out[b.id], [c.key]: second };
  }

  return out;
}

/**
 * الفارق التراكمي — ما يعرضه الشريط الحي أعلى الشاشة.
 * `ratio` بين ‎-1‎ و‎+1‎، والموجب للخيار الأول.
 */
export function duelLead(criteria, ratings, weights, options) {
  const [a, b] = options;
  let diff = 0;
  let max = 0;

  for (const c of criteria) {
    const weight = weights[c.key] ?? 0;
    const ra = ratings[a.id]?.[c.key] ?? 2;
    const rb = ratings[b.id]?.[c.key] ?? 2;
    diff += weight * (ra - rb);
    max += weight * DUEL_MAX;
  }

  return {
    diff,
    ratio: max ? diff / max : 0,
    leader: diff === 0 ? null : diff > 0 ? a : b,
  };
}

/**
 * نص المقبض لقارئ الشاشة. الرقم المجرّد («٢») بلا معنى مسموع —
 * المطلوب اتجاه الميل وشدّته.
 */
export function positionText(position, firstLabel, secondLabel) {
  switch (clamp(position)) {
    case -2:
      return `يميل لـ${secondLabel} بوضوح`;
    case -1:
      return `يميل لـ${secondLabel}`;
    case 1:
      return `يميل لـ${firstLabel}`;
    case 2:
      return `يميل لـ${firstLabel} بوضوح`;
    default:
      return "متعادل";
  }
}
