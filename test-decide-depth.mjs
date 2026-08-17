// اختبار عمق النتيجة على الراوت الحي: الحقول الأربعة تصل، ومفتاح
// المعيار الحاسم يطابق معياراً حقيقياً، والحسم ما ينكسر بلا إطار.

const BASE = "http://localhost:3000/api";

// مهلة بين النداءات: الدفعة السريعة تصطدم بسقف جيميناي نفسه فترجع
// ٥٠٢ لا علاقة لها بالكود — وهذا كذّب أول تشغيل للاختبار
const PACE_MS = 11000;
const pace = () => new Promise((r) => setTimeout(r, PACE_MS));

const post = async (path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

const PAIRS = [
  ["كبسة", "برجر"],
  ["أستقيل", "أصبر سنة ثانية"],
  ["آيفون", "سامسونج"],
];

let pass = 0;
let fail = 0;
const check = (name, ok, extra = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `  ${extra}`}`);
};

for (const options of PAIRS) {
  await pace();
  const framed = await post("/frame", { options });
  if (!framed.body.ok) {
    check(`${options.join("/")}: الإطار`, false, framed.body.error);
    continue;
  }
  const frame = framed.body.frame;

  // نجاوب السؤال الأول بأول إجابة، فالمسار واقعي لا فاضٍ
  const answers = { [frame.first.key]: frame.first.choices[0].value };
  await pace();
  const decided = await post("/decide", { options, answers, frame });

  const tag = options.join("/").padEnd(22);
  if (!decided.body.ok) {
    check(`${tag} الحسم`, false, `${decided.status} ${decided.body.error}`);
    continue;
  }

  const d = decided.body;
  const keys = new Set(frame.criteria.map((c) => c.key));
  check(`${tag} الحقول القديمة باقية`, Boolean(d.selected_option && d.funny_reason));
  check(`${tag} decisive_criterion معيار حقيقي`, keys.has(d.decisive_criterion), String(d.decisive_criterion));
  check(`${tag} edge`, Boolean(d.edge));
  check(`${tag} cost_of_switching`, Boolean(d.cost_of_switching));
  check(`${tag} flip_condition`, Boolean(d.flip_condition));
  check(
    `${tag} بلا رقم لاتيني`,
    ![d.funny_reason, d.edge, d.cost_of_switching, d.flip_condition].some((t) => /[0-9]/.test(t ?? "")),
  );
  console.log(`   الحاسم: ${d.decisive_criterion} · ${d.edge}`);
  console.log(`   لو اخترت الثاني: ${d.cost_of_switching}`);
  console.log(`   ينقلب لو: ${d.flip_condition}`);
}

// بلا إطار — المسار القديم (الصوت) لازم يظل يشتغل
await pace();
const legacy = await post("/decide", {
  options: ["شاي", "قهوة"],
  answers: {},
  categoryId: "food",
});
check("بلا إطار: الحسم يشتغل", legacy.body.ok === true, JSON.stringify(legacy.body).slice(0, 120));
check(
  "بلا إطار: ما فيه معيار حاسم مخترع",
  legacy.body.decisive_criterion === undefined,
  String(legacy.body.decisive_criterion),
);

// إطار مشوّه يُسقَط ولا يفشّل الطلب
await pace();
const junk = await post("/decide", {
  options: ["شاي", "قهوة"],
  answers: {},
  frame: { category: "food", criteria: "لا شي" },
});
check("إطار مشوّه: الحسم يكمل", junk.body.ok === true, JSON.stringify(junk.body).slice(0, 120));

console.log(`\n${pass} نجحت · ${fail} فشلت`);
process.exit(fail ? 1 : 0);
