// محرك التقييم الموزون (Weighted Scoring)
//
// الفكرة: إجابات المستخدم على الأسئلة تحدد "وزن" كل معيار،
// وتقييمه لكل خيار يحدد "درجة" الخيار في ذلك المعيار.
//   score(option) = Σ (وزن المعيار × درجة الخيار فيه)

import { moodTarget } from "./mood.js";

export const RATING_SCALE = [
  { value: 1, label: "ضعيف" },
  { value: 2, label: "متوسط" },
  { value: 3, label: "ممتاز" },
];

export const DEFAULT_RATING = 2;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 5;

export const MAX_WEIGHT = 4;

// أوزان المعايير مستخرجة من إجابات الأسئلة، مع لمسة من المزاج العام.
// أي معيار ما جاوب عليه المستخدم يأخذ وزناً محايداً.
export function weightsFor(category, answers, moodId) {
  const weights = {};
  for (const c of category.criteria) weights[c.key] = 2;

  for (const q of category.questions) {
    const chosen = q.choices.find((c) => c.value === answers?.[q.key]);
    if (chosen) weights[q.affects] = chosen.weight;
  }

  // المزاج يرفع وزن معيار واحد فقط — أثر محدود ومعلن للمستخدم
  const target = moodTarget(category, moodId);
  if (target && weights[target] != null) {
    weights[target] = Math.min(weights[target] + 1, MAX_WEIGHT);
  }

  return weights;
}

export function scoreOptions(category, options, ratings, weights) {
  const maxTotal = category.criteria.reduce(
    (sum, c) => sum + weights[c.key] * RATING_SCALE.length,
    0
  );

  return options
    .map((option) => {
      const given = ratings?.[option.id] ?? {};
      const breakdown = category.criteria.map((c) => {
        const rating = given[c.key] ?? DEFAULT_RATING;
        return {
          key: c.key,
          label: c.label,
          low: c.low,
          high: c.high,
          rating,
          weight: weights[c.key],
          points: rating * weights[c.key],
        };
      });

      const total = breakdown.reduce((sum, b) => sum + b.points, 0);
      return {
        ...option,
        breakdown,
        total,
        percent: maxTotal ? Math.round((total / maxTotal) * 100) : 0,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export function isTie(scored) {
  return scored.length > 1 && scored[0].total === scored[1].total;
}

// حظوظ مود "أنا متردد جدًا" — الأعلى تقييماً له فرصة أكبر لكن مو مضمون.
// الأس (sharpness) يتحكم بحدة الفرق: 1 = عادل، أعلى = يميل للفائز.
export function chancesFor(scored, sharpness = 2) {
  const raw = scored.map((s) => Math.pow(s.total, sharpness));
  const sum = raw.reduce((a, b) => a + b, 0);
  return scored.map((s, i) => ({
    ...s,
    chance: sum ? Math.round((raw[i] / sum) * 100) : 0,
    _weight: raw[i],
  }));
}

export function weightedRandomPick(scored, sharpness = 2) {
  const withChances = chancesFor(scored, sharpness);
  const sum = withChances.reduce((a, b) => a + b._weight, 0);
  if (!sum) return withChances[0] ?? null;

  let roll = Math.random() * sum;
  for (const entry of withChances) {
    roll -= entry._weight;
    if (roll <= 0) return entry;
  }
  return withChances[withChances.length - 1];
}
