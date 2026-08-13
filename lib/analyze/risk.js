// تحويل أحكام النموذج النوعية إلى أرقام — في الكود، مو في النموذج.
//
// ليش؟ لو سألنا النموذج مباشرة "كم نسبة المخاطرة؟" بيرجع رقماً
// مثل 34% يبدو دقيقاً وهو في الحقيقة نص مولّد، ما وراه أي حساب.
// عرضه كتوقع مالي مضلّل.
//
// بدل ذلك: النموذج يعطي أحكاماً نوعية يجيدها فعلاً (احتمال مرتفع/
// متوسط/منخفض، أثر، قابلية تراجع)، والكود يحوّلها لرقم بمعادلة
// ثابتة ومكشوفة. الرقم يصير قابلاً للتفسير والتكرار، ولو اختلفت
// معه تقدر تشوف من وين جاء.
//
// نفس فلسفة lib/engine/score.js — الحساب في الكود، والنموذج للحكم.

export const LEVELS = {
  high: { value: 3, label: "مرتفع" },
  medium: { value: 2, label: "متوسط" },
  low: { value: 1, label: "منخفض" },
};

// قابلية التراجع مُعدِّل، مو عامل كامل — وهذا مقصود.
//
// جرّبناها أولاً كعامل يُضرب (١ إلى ٣) والنتيجة كانت خاطئة: مسار
// ضرره مرجّح وشديد لكن يمكن التراجع عنه كان يطلع بمخاطرة ٣٣٪
// ويُصنَّف "فرصة واضحة". سهولة التراجع تخفّف الضرر، لكنها ما
// تلغيه — الخسارة تقع فعلاً قبل ما تتراجع.
export const REVERSIBILITY = {
  easy: { factor: 0.6, label: "أقدر أرجع عنه بسهولة" },
  costly: { factor: 1.0, label: "الرجوع مكلف" },
  irreversible: { factor: 1.35, label: "ما فيه رجعة" },
};

const level = (key) => LEVELS[key]?.value ?? 2;
const reversal = (key) => REVERSIBILITY[key]?.factor ?? 1.0;

/**
 * درجة المخاطرة = (احتمال الضرر × شدته) منسوبة للحد الأقصى،
 * ثم مُعدَّلة بقابلية التراجع ومحدودة بـ ١٠٠.
 */
export function riskScore(path) {
  const base =
    (level(path?.downside_likelihood) * level(path?.downside_impact)) / 9;

  return Math.min(100, Math.round(base * reversal(path?.reversibility) * 100));
}

/**
 * درجة الجاذبية = احتمال المكسب × حجمه.
 * منفصلة عن المخاطرة عمداً — مسار ممكن يكون عالي الاثنين،
 * ودمجهما في رقم واحد يخفي هذي المفارقة بالضبط.
 */
export function upsideScore(path) {
  const raw = level(path?.upside_likelihood) * level(path?.upside_impact);
  return Math.round((raw / 9) * 100);
}

// تصنيف المسار في ربع من أربعة — أوضح من رقمين منفصلين
export function quadrant(risk, upside) {
  const hiRisk = risk >= 50;
  const hiUpside = upside >= 50;

  if (hiUpside && !hiRisk) return { key: "sweet", label: "فرصة واضحة" };
  if (hiUpside && hiRisk) return { key: "bet", label: "رهان كبير" };
  if (!hiUpside && !hiRisk) return { key: "safe", label: "آمن بلا عائد يذكر" };
  return { key: "trap", label: "مخاطرة بلا مقابل" };
}

export function enrichPath(path) {
  const risk = riskScore(path);
  const upside = upsideScore(path);

  return {
    ...path,
    risk,
    upside,
    quadrant: quadrant(risk, upside),
    // نخزّن المدخلات اللي بُني عليها الرقم حتى تنعرض للمستخدم
    basis: {
      downsideLikelihood: LEVELS[path?.downside_likelihood]?.label ?? "متوسط",
      downsideImpact: LEVELS[path?.downside_impact]?.label ?? "متوسط",
      upsideLikelihood: LEVELS[path?.upside_likelihood]?.label ?? "متوسط",
      upsideImpact: LEVELS[path?.upside_impact]?.label ?? "متوسط",
      reversibility: REVERSIBILITY[path?.reversibility]?.label ?? "الرجوع مكلف",
    },
  };
}

export function rankPaths(paths) {
  return (paths ?? [])
    .map(enrichPath)
    .sort((a, b) => b.upside - b.risk - (a.upside - a.risk));
}
