// "ليش هذا القرار؟" — تفسير مبني على الأوزان الفعلية، مو أرقام مرمية.

import { RATING_SCALE } from "./score.js";

const WEIGHT_WORDS = {
  3: "كان الأهم عندك اليوم",
  2: "كان مهم",
  1: "ما كان يفرق كثير",
};

const RATING_WORDS = {
  3: "ممتاز",
  2: "متوسط",
  1: "ضعيف",
};

// المعيار اللي صنع الفرق: أكبر (فرق الدرجة × الوزن) بين الفائز والوصيف.
export function decidingCriterion(scored) {
  const [winner, runnerUp] = scored;
  if (!winner || !runnerUp) return null;

  const gaps = winner.breakdown.map((b) => {
    const rival = runnerUp.breakdown.find((r) => r.key === b.key);
    return { ...b, gain: (b.rating - (rival?.rating ?? 0)) * b.weight };
  });

  const best = gaps.sort((a, b) => b.gain - a.gain)[0];
  return best && best.gain > 0 ? best : null;
}

// جملة السبب المختصرة، تُركّب داخل رد الشخصية في tone.js
export function reasonPhrase(scored) {
  const deciding = decidingCriterion(scored);
  if (!deciding) return "الفرق بينهم بسيط، بس هذا اللي طلع أعلى شوي";

  const weightWord = WEIGHT_WORDS[deciding.weight] ?? "كان مهم";
  return `${deciding.label} ${weightWord}، وهو الأفضل فيها`;
}

// تفاصيل "وضّح أكثر" — بجمل مفهومة لكل معيار
export function detailedBreakdown(scored) {
  const [winner, runnerUp] = scored;
  if (!winner) return [];

  return winner.breakdown.map((b) => {
    const rival = runnerUp?.breakdown.find((r) => r.key === b.key);
    const diff = rival ? b.rating - rival.rating : 0;

    let verdict;
    if (!rival) verdict = `تقييمه ${RATING_WORDS[b.rating]}`;
    else if (diff > 0) verdict = `أفضل من «${runnerUp.label}» هنا`;
    else if (diff < 0) verdict = `أقل من «${runnerUp.label}» هنا`;
    else verdict = `متساوي مع «${runnerUp.label}» هنا`;

    return {
      key: b.key,
      label: b.label,
      importance: WEIGHT_WORDS[b.weight] ?? "كان مهم",
      rating: RATING_WORDS[b.rating],
      verdict,
      // للعرض البصري
      ratingValue: b.rating,
      ratingMax: RATING_SCALE.length,
      weight: b.weight,
    };
  });
}
