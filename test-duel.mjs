// اختبار تحويل المبارزة — الادعاء المركزي أن المقبض الواحد لا يفقد
// معلومة مقابل خانتين، وأن `score.js` يرتّب نفس الترتيب في الحالتين.

import {
  DUEL_STOPS,
  duelLead,
  positionFrom,
  positionText,
  ratingsAt,
  withPriors,
} from "./lib/engine/duel.js";
import { scoreOptions } from "./lib/engine/score.js";

let pass = 0;
let fail = 0;
const check = (name, got, want) => {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `  — توقعنا ${want} وجاء ${got}`}`);
};

const A = { id: "a", label: "كبسة" };
const B = { id: "b", label: "برجر" };
const criteria = [
  { key: "speed", label: "الجاهزية", low: "يبي وقت", high: "جاهز" },
  { key: "cost", label: "التكلفة", low: "غالي", high: "رخيص" },
  { key: "crave", label: "الرغبة", low: "ما أشتهيه", high: "نفسي فيه" },
];

// ---- الجدول ذهاباً وإياباً ----
for (const p of DUEL_STOPS) {
  const { first, second } = ratingsAt(p);
  check(`الموضع ${p} يرجع من تقييميه`, positionFrom(first, second), p);
}
check("الموضع خارج المدى يُقصّ", positionFrom(3, 1), 2);
check("تقييم ناقص = متعادل", positionFrom(null, 3), 0);

// ---- بيت القصيد: الفارق وحده يحدد الترتيب ----
// كل زوج تقييمات له نفس الفارق لازم يعطي نفس الفائز. لو كان المقبض
// فاقداً للمعلومة، لاختلف الترتيب بين زوج وآخر بنفس الفارق.
const weights = { speed: 3, cost: 2, crave: 4 };
const category = { criteria };
const winnerFor = (ratings) =>
  scoreOptions(category, [A, B], ratings, weights)[0].id;

// نفس الفوارق (+1, -1, +2) معبَّراً عنها بأزواج مختلفة من ١–٣
const viaDuel = {
  a: { speed: 3, cost: 2, crave: 3 },
  b: { speed: 2, cost: 3, crave: 1 },
};
const viaGrid = {
  a: { speed: 2, cost: 1, crave: 3 },
  b: { speed: 1, cost: 2, crave: 1 },
};
check("نفس الفوارق = نفس الفائز", winnerFor(viaDuel), winnerFor(viaGrid));
check("والفائز هو الأول هنا", winnerFor(viaDuel), "a");

// معيار واحد ثقيل يقلب النتيجة رغم خسارة الاثنين الباقيين
const flipped = {
  a: { speed: 1, cost: 1, crave: 3 },
  b: { speed: 3, cost: 3, crave: 1 },
};
check("الوزن الأثقل يقلب الحكم", winnerFor(flipped), "b");

// ---- التقدير المبدئي ----
const frame = {
  criteria,
  priors: {
    كبسة: { speed: 1, cost: 3, crave: 3 },
    برجر: { speed: 3, cost: 2, crave: 2 },
  },
};
const seeded = withPriors({}, frame, [A, B]);
check("التقدير يملأ المقبض", positionFrom(seeded.a.speed, seeded.b.speed), -2);
check("… ولكل معيار", positionFrom(seeded.a.cost, seeded.b.cost), 1);
check("… بتقييمات من الجدول", seeded.a.crave, 3);

// ما لمسه المستخدم لا يُمسح — وهذا ما يجعل الاشتقاق عند الرندر آمناً
const touched = withPriors({ a: { speed: 3 }, b: { speed: 1 } }, frame, [A, B]);
check("تعديل المستخدم يغلب التقدير", touched.a.speed, 3);
check("… وباقي المعايير تأخذ التقدير", touched.a.cost, 3);

check("بلا تقدير ما يتغيّر شي", withPriors({}, { criteria }, [A, B]).a, undefined);
check("ثلاثة خيارات خارج المبارزة", withPriors({}, frame, [A, B, { id: "c", label: "ج" }]).a, undefined);

// ---- الشريط الحي ----
const lead = duelLead(criteria, viaDuel, weights, [A, B]);
check("الشريط يعرف القائد", lead.leader.id, "a");
check("والنسبة داخل المدى", lead.ratio > 0 && lead.ratio <= 1, true);
check("التعادل بلا قائد", duelLead(criteria, {}, weights, [A, B]).leader, null);
check("التعادل نسبته صفر", duelLead(criteria, {}, weights, [A, B]).ratio, 0);

// ---- نص قارئ الشاشة ----
check("الطرف الأقصى يذكر الخيار", positionText(2, "كبسة", "برجر"), "يميل لـكبسة بوضوح");
check("الطرف المقابل", positionText(-1, "كبسة", "برجر"), "يميل لـبرجر");
check("المنتصف", positionText(0, "كبسة", "برجر"), "متعادل");

console.log(`\n${pass} نجحت · ${fail} فشلت`);
process.exit(fail ? 1 : 0);
