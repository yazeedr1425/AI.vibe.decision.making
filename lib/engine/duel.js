// محرك المواجهة المباشرة.
//
// كان الحساب Σ(وزن المعيار × تقييم الخيار فيه): المستخدم يجاوب على
// أسئلة عن ظرفه لتحديد الأوزان، ثم يقيّم كل خيار على كل معيار في
// شبكة منفصلة. خطوتان، والثانية أطول وأملّ.
//
// الحين كل سؤال بُعد واحد، وإجاباته هي الخيارات نفسها. تختار في كل
// بُعد مين يكسبه، واللي يكسب أكثر أبعاد يفوز. خطوة واحدة، والسؤال
// نفسه صار هو التقييم.

const WIN = 3;
const LOSS = 1;

/**
 * يحسب النتيجة من الأجوبة.
 *
 * answers[question.key] = معرّف الخيار الفائز في ذلك البُعد.
 * السؤال بلا جواب لا يعطي أحداً شيئاً — يبقى الجميع على LOSS فيه،
 * فتخطّيه يحيّده بدل ما يرجّح كفة.
 *
 * الشكل المرتجع مطابق لما يتوقعه Result و explain.js: breakdown فيه
 * rating و weight و points. البُعد المكسوب rating=3 والمفقود 1،
 * والوزن ١ للجميع لأن الأبعاد هنا متساوية — ما فيه أسئلة أوزان.
 */
export function tallyOptions(questions, options, answers) {
  const max = questions.length * WIN;

  return options
    .map((option) => {
      const breakdown = questions.map((q) => {
        const won = answers?.[q.key] === option.id;
        const rating = won ? WIN : LOSS;
        return {
          key: q.key,
          label: q.label,
          low: "",
          high: "",
          rating,
          weight: 1,
          points: rating,
          won,
        };
      });

      const total = breakdown.reduce((sum, b) => sum + b.points, 0);
      return {
        ...option,
        breakdown,
        total,
        wins: breakdown.filter((b) => b.won).length,
        percent: max ? Math.round((total / max) * 100) : 0,
      };
    })
    .sort((a, b) => b.total - a.total);
}
