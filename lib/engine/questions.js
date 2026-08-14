// التحقق من الأسئلة المولّدة.
//
// المعايير تبقى ثابتة من القالب — المولّد يعيد صياغة الأسئلة فقط
// لتناسب الخيارين. يعني affects لازم يشير لمعيار موجود أصلاً في
// القالب، وهذي مجموعة معروفة ومغلقة، فالتحقق أبسط وأضمن من توليد
// المعايير نفسها.
//
// أي فشل هنا يرجّع ok:false والمنادي يستخدم أسئلة القالب.

import { MAX_WEIGHT } from "./score.js";

export const QUESTION_COUNT = 3;
export const CHOICE_COUNT = 3;

// ٣ يعني "هذا المعيار يهمني اليوم" و١ يعني "ما يهمني". نشترط
// المجموعة كاملة لأن سؤالاً بأوزان متساوية ما يرجّح شيئاً — يظهر
// للمستخدم كأنه مؤثّر وهو لا يغيّر النتيجة إطلاقاً.
const REQUIRED_WEIGHTS = "1,2,3";
const SLUG = /^[a-z][a-z0-9_]{0,23}$/;

const text = (v, max) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

const fail = (reason, detail) => ({ ok: false, reason, detail });

/**
 * يتحقق من الأسئلة المولّدة ويعيد نسخة من القالب بها.
 * base: قالب الفئة الثابت — معاييره وهويته تبقى كما هي.
 */
export function validateQuestions(raw, base) {
  if (!Array.isArray(raw?.questions) || raw.questions.length !== QUESTION_COUNT) {
    return fail("QUESTION_COUNT", raw?.questions?.length);
  }

  const criterionKeys = new Set(base.criteria.map((c) => c.key));
  const questions = [];
  const seen = new Set();
  const covered = new Set();

  for (const q of raw.questions) {
    const key = text(q?.key, 24);
    if (!key || !SLUG.test(key)) return fail("QUESTION_KEY", q?.key);
    if (seen.has(key)) return fail("QUESTION_DUPLICATE", key);

    // القيد الجوهري: سؤال يشير لمعيار غير موجود لا يفعل شيئاً.
    // weightsFor تكتب weights[q.affects]، فمفتاح مخترع يضيف وزناً
    // لمعيار ما يقرأه scoreOptions — سؤال يظهر ولا أثر له.
    const affects = text(q?.affects, 24);
    if (!affects || !criterionKeys.has(affects)) {
      return fail("AFFECTS_UNKNOWN", affects);
    }

    const label = text(q?.label, 80);
    if (!label) return fail("QUESTION_TEXT", key);

    if (!Array.isArray(q?.choices) || q.choices.length !== CHOICE_COUNT) {
      return fail("CHOICE_COUNT", key);
    }

    const choices = [];
    const values = new Set();

    for (const ch of q.choices) {
      const value = text(ch?.value, 24);
      if (!value || !SLUG.test(value)) return fail("CHOICE_VALUE", ch?.value);
      if (values.has(value)) return fail("CHOICE_DUPLICATE", value);

      const chLabel = text(ch?.label, 60);
      if (!chLabel) return fail("CHOICE_TEXT", value);

      const weight = Number(ch?.weight);
      if (!Number.isInteger(weight) || weight < 1 || weight > MAX_WEIGHT) {
        return fail("CHOICE_WEIGHT", ch?.weight);
      }

      values.add(value);
      // en زينة: عنوان لاتيني صغير، وغيابه يعطي span فاضياً لا ينكسر
      // معه شي — ما يستاهل إسقاط التوليد كله لأجله
      choices.push({ value, label: chLabel, en: text(ch?.en, 20) ?? "", weight });
    }

    const weights = choices
      .map((c) => c.weight)
      .sort((a, b) => a - b)
      .join(",");
    if (weights !== REQUIRED_WEIGHTS) return fail("WEIGHT_SET", weights);

    seen.add(key);
    covered.add(affects);
    questions.push({
      key,
      affects,
      label,
      en: text(q?.en, 24) ?? "",
      // تنازلي: الأهم أولاً، مثل القوالب الثابتة
      choices: choices.sort((a, b) => b.weight - a.weight),
    });
  }

  // كل معيار لازم يوصله سؤال. لو سؤالان يزنان نفس المعيار يبقى
  // الثالث على وزنه المحايد أبداً، فيصير معياراً لا يقدر المستخدم
  // يؤثر فيه — والمقارنة تفقد ثلث حساسيتها بلا ما يبان شي.
  if (covered.size !== base.criteria.length) {
    return fail("CRITERIA_NOT_COVERED", [...covered].join(","));
  }

  return { ok: true, category: { ...base, questions, generated: true } };
}
