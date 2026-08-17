// اختبار `shapeFrame` على مخرَجات مشوّهة — الطرق التي لا يسلكها
// النموذج في المسار السعيد، فما تُختبر أبداً باختبار الراوت وحده.
//
// وآخر حالة هي بيت القصيد: إطار مولّد يمر على `score.js` بلا سطر
// واحد تغيّر فيه.

import {
  frameToCategory,
  pathAnswers,
  pathQuestions,
  shapeFrame,
} from "./lib/engine/frame.js";
import { scoreOptions, weightsFor } from "./lib/engine/score.js";

const OPTIONS = ["كبسة", "برجر"];

const question = (key, affects, values) => ({
  key,
  affects,
  label: `سؤال ${key}`,
  choices: values.map((v, i) => ({ value: v, label: `جواب ${v}`, weight: 3 - i })),
});

// إطار صحيح كامل — كل حالة تشوّه نسخة منه
const base = () => ({
  category: "food",
  headline: "سرعة مقابل شهية",
  criteria: [
    { key: "speed", label: "الجاهزية", low: "يبي وقت", mid: "عادي", high: "جاهز" },
    { key: "cost", label: "التكلفة", low: "غالي", mid: "معقول", high: "رخيص" },
    { key: "crave", label: "الرغبة", low: "ما أشتهيه", mid: "عادي", high: "نفسي فيه" },
  ],
  moodEnergy: "crave",
  moodEase: "speed",
  first: question("time", "speed", ["rush", "normal", "free"]),
  branches: [
    { answer: "rush", next: question("bud_a", "cost", ["tight", "mid", "loose"]) },
    { answer: "normal", next: question("bud_b", "cost", ["tight", "mid", "loose"]) },
    { answer: "free", next: question("bud_c", "cost", ["tight", "mid", "loose"]) },
  ],
  priors: [
    { option: "كبسة", ratings: [{ criterion: "speed", value: 1 }, { criterion: "crave", value: 3 }] },
    { option: "برجر", ratings: [{ criterion: "speed", value: 3 }, { criterion: "crave", value: 2 }] },
  ],
  confidence: [
    { criterion: "speed", level: "high" },
    { criterion: "crave", level: "low", note: "يعتمد على وين بتطلبه" },
  ],
});

const mut = (fn) => {
  const raw = base();
  fn(raw);
  return shapeFrame(raw, { options: OPTIONS });
};

let pass = 0;
let fail = 0;
const check = (name, got, want) => {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `  — توقعنا ${want} وجاء ${got}`}`);
};

// ---- المسار السعيد ----
const good = shapeFrame(base(), { options: OPTIONS });
check("إطار صحيح يمر", good.ok, true);
check("الشجرة محفوظة", good.frame.branches?.length, 3);
check("المزاج محفوظ", good.frame.moodCriteria?.energy, "crave");
check("priors صارت خريطة", good.frame.priors?.["كبسة"]?.speed, 1);
check("الشك محفوظ", good.frame.notes?.crave, "يعتمد على وين بتطلبه");
check("الثقة العالية بلا سطر شك", good.frame.notes?.speed, undefined);

// ---- الشجرة تسقط بهدوء ----
const badAnswer = mut((r) => (r.branches[1].answer = "nope"));
check("إجابة فرع لا تطابق → الشجرة تسقط", badAnswer.frame.branches, undefined);
check("… ويبقى سؤال ثانٍ ثابت", badAnswer.frame.then?.affects, "cost");
check("… والطلب ما يفشل", badAnswer.ok, true);

const reuse = mut((r) => r.branches.forEach((b) => (b.next.affects = "speed")));
check("كل الفروع تكرر معيار الأول → لا شجرة", reuse.frame.branches, undefined);
check("… ولا سؤال ثانٍ", reuse.frame.then, undefined);
check("… والسؤال الأول باقٍ", reuse.frame.first?.key, "time");

const dupAnswers = mut((r) => (r.branches[2].answer = "rush"));
check("فرعان لنفس الإجابة → الشجرة تسقط", dupAnswers.frame.branches, undefined);

// ---- priors تحسين لا شرط ----
check("مفاتيح priors غلط → تُلغى", mut((r) => (r.priors[0].option = "شي ثاني")).frame.priors, undefined);
check("priors لخيار واحد → تُلغى", mut((r) => r.priors.pop()).frame.priors, undefined);
check("قيمة خارج ١-٣ تُهمل", mut((r) => (r.priors[0].ratings[0].value = 9)).frame.priors?.["كبسة"]?.speed, undefined);
check("… وباقي التقديرات تبقى", mut((r) => (r.priors[0].ratings[0].value = 9)).frame.priors?.["كبسة"]?.crave, 3);

// ---- المزاج ----
check("مزاج لمعيار وهمي → يُحذف", mut((r) => (r.moodEnergy = "ghost")).frame.moodCriteria, undefined);
check("مزاج بمعيار واحد للاثنين → يُحذف", mut((r) => (r.moodEnergy = r.moodEase)).frame.moodCriteria, undefined);

// ---- الفئة قيد قاعدة بيانات ----
check("فئة غير مسموحة → life", mut((r) => (r.category = "sports")).frame.category, "life");
check("فئة مفقودة → life", mut((r) => delete r.category).frame.category, "life");

// ---- ما يفشّل الطلب فعلاً ----
check("قطبان متطابقان", mut((r) => (r.criteria[0].high = r.criteria[0].low)).reason, "BAD_CRITERIA");
check("معياران فقط", mut((r) => r.criteria.pop()).reason, "BAD_CRITERIA");
check("مفاتيح مكررة", mut((r) => (r.criteria[1].key = "speed")).reason, "BAD_CRITERIA");
check("مفتاح جملة (فراغات)", mut((r) => (r.criteria[0].key = "how fast is it")).reason, "BAD_CRITERIA");
check("مفتاح أطول من ٤٨", mut((r) => (r.criteria[0].key = "a".repeat(60))).reason, "BAD_CRITERIA");
check("مفتاح بحرف واحد", mut((r) => (r.criteria[0].key = "a")).reason, "BAD_CRITERIA");
check("مفتاح فاضي", mut((r) => (r.criteria[0].key = "")).reason, "BAD_CRITERIA");
check("بلا عنوان", mut((r) => delete r.headline).reason, "NO_HEADLINE");
check("أوزان مكررة", mut((r) => r.first.choices.forEach((c) => (c.weight = 2))).reason, "BAD_FIRST");
check("affects وهمي", mut((r) => (r.first.affects = "ghost")).reason, "BAD_FIRST");
check("إجابتان فقط", mut((r) => r.first.choices.pop()).reason, "BAD_FIRST");


// المفاتيح المقبولة: ما دام معرّفاً، أبجديته لا تعني شيئاً لأحد
const accepted = (key) => {
  const r = mut((raw) => {
    raw.criteria[0].key = key;
    raw.first.affects = key;
    raw.branches.forEach((b) => (b.next.affects = raw.criteria[1].key));
    raw.priors.forEach((p) => (p.ratings[0].criterion = key));
    raw.confidence[0].criterion = key;
    raw.moodEase = key;
  });
  return r.ok && r.frame.criteria[0].key === key;
};
check("مفتاح فيه رقم مقبول", accepted("speed2"), true);
check("مفتاح عربي مقبول", accepted("الحاجة_الفورية"), true);
check("مفتاح بتشكيل مقبول", accepted("احتاجه_فوراً"), true);

// ---- الأرقام ----
const digits = mut((r) => {
  r.headline = "خيار 1 مقابل 2";
  r.first.label = "كم عندك من 30 دقيقة؟";
});
check("رقم لاتيني في العنوان يُحوَّل", digits.frame.headline, "خيار ١ مقابل ٢");
check("رقم لاتيني في السؤال يُحوَّل", digits.frame.first.label, "كم عندك من ٣٠ دقيقة؟");

// ---- قراءة المسار ----
// العدد ثابت من أول شاشة: `QuestionStep.pick` ينادي setAnswers ثم
// onAnswer في نفس المعالج، فطولٌ متغيّر يخلي onAnswer يقرأ «سؤال
// واحد» ويقفز للتقييم مبتلعاً سؤال الفرع
const f = good.frame;
check("بلا إجابة → سؤالان (النائب)", pathQuestions(f, {}).length, 2);
check("النائب هو فرع الإجابة الأولى", pathQuestions(f, {})[1]?.key, "bud_a");
check("مع إجابة → الفرع الصحيح", pathQuestions(f, { time: "normal" })[1]?.key, "bud_b");
check("إجابة مجهولة → النائب", pathQuestions(f, { time: "zzz" })[1]?.key, "bud_a");
check("بلا شجرة → السؤال الثابت", pathQuestions(badAnswer.frame, {})[1]?.affects, "cost");
check("بلا شجرة ولا ثابت → سؤال واحد", pathQuestions(reuse.frame, {}).length, 1);

// ---- إجابات المسار وحدها ----
// الرجوع وتغيير السؤال الأول يبدّل الفرع، فتبقى إجابة الفرع القديم
// بمفتاح ما عاد أحد يسأل عنه
const stale = { time: "normal", bud_b: "tight", bud_a: "loose" };
check("إجابة فرع مهجور تُسقَط", pathAnswers(f, stale).bud_a, undefined);
check("… وإجابة الفرع الحالي تبقى", pathAnswers(f, stale).bud_b, "tight");
check("… وإجابة السؤال الأول تبقى", pathAnswers(f, stale).time, "normal");

// ---- بيت القصيد: المحرك يقرأ الإطار كأنه فئة ----
const category = frameToCategory(f, { time: "rush", bud_a: "tight" });
const weights = weightsFor(category, { time: "rush", bud_a: "tight" }, "drained");
check("وزن معيار السؤال الأول", weights.speed, 3 + 1); // +1 من مزاج «مرهق» على ease=speed
check("وزن معيار الفرع", weights.cost, 3);
check("معيار بلا سؤال يبقى محايداً", weights.crave, 2);

const scored = scoreOptions(
  category,
  [{ id: "a", label: "كبسة" }, { id: "b", label: "برجر" }],
  { a: { speed: 1, cost: 3, crave: 3 }, b: { speed: 3, cost: 2, crave: 2 } },
  weights,
);
check("المحرك رتّب خيارين", scored.length, 2);
check("الفائز محسوب لا مخترع", scored[0].id, "b"); // 3×4 + 2×3 + 2×2 = 22 > 1×4 + 3×3 + 3×2 = 19
check("التفصيل يحمل القطبين", scored[0].breakdown[0].low, "يبي وقت");

console.log(`\n${pass} نجحت · ${fail} فشلت`);
process.exit(fail ? 1 : 0);
