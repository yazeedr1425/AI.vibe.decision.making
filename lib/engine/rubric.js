// التحقق من المعايير والأسئلة المولّدة.
//
// بنفس روح lib/plan/parse.js: مخطط Gemini يضمن الشكل (حقول موجودة
// وأنواع صحيحة) لكنه لا يضمن المعنى — أن affects يشير لمعيار موجود
// فعلاً، أو أن المفاتيح فريدة. هذا الملف يفحص ما لا يفحصه المخطط.
//
// أي فشل هنا يرجّع ok:false، والمنادي يسقط للقالب الثابت.

import { MAX_WEIGHT } from "./score.js";

export const CRITERIA_COUNT = 3;
export const QUESTION_COUNT = 3;
export const CHOICE_COUNT = 3;

// أوزان الاختيارات: ٣ يعني "هذا المعيار يهمني اليوم" و١ يعني "ما يهمني".
// نشترط المجموعة كاملة لأن سؤالاً بأوزان {2,2,2} لا يرجّح شيئاً —
// يظهر للمستخدم كأنه مؤثّر وهو لا يغيّر النتيجة إطلاقاً.
const REQUIRED_WEIGHTS = [1, 2, 3];

// مفتاح برمجي: يدخل في weights[key] و ratings[optionId][key].
//
// الحد الأدنى حرف واحد لا حرفان: مفتاح بحرف واحد رديء أسلوباً لكنه
// يشتغل تماماً، ووظيفة هذا الملف رفض ما يكسر المحرك لا ما لا يعجبنا.
// كان {1,23} أي حرفان فأكثر، فيسقط توليداً سليماً للقالب بلا سبب.
const SLUG = /^[a-z][a-z0-9_]{0,23}$/;

const text = (v, max) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

function fail(reason, detail) {
  return { ok: false, reason, detail };
}

/**
 * يتحقق من كائن مولّد ويعيده مطبّعاً وجاهزاً للمحرك.
 *
 * base: قالب الفئة الثابت — منه ناخذ id و label و en و hint.
 * المولّد يغيّر المعايير والأسئلة فقط، لأن decisions.category في
 * قاعدة البيانات مقيّد بـ CHECK على المعرّفات الخمسة المعروفة،
 * فتوليد id جديد يفشل الحفظ.
 */
export function validateRubric(raw, base) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return fail("NOT_OBJECT");
  }

  // ---------- المعايير ----------
  if (!Array.isArray(raw.criteria) || raw.criteria.length !== CRITERIA_COUNT) {
    return fail("CRITERIA_COUNT", raw.criteria?.length);
  }

  const criteria = [];
  const keys = new Set();

  for (const c of raw.criteria) {
    const key = text(c?.key, 24);
    if (!key || !SLUG.test(key)) return fail("CRITERION_KEY", c?.key);
    if (keys.has(key)) return fail("CRITERION_DUPLICATE", key);

    const label = text(c?.label, 40);
    const low = text(c?.low, 20);
    const high = text(c?.high, 20);
    // low/high/mid هي أزرار التقييم الثلاثة في RatingGrid لهذا المعيار
    // تحديداً. كانت الشبكة تعرض ضعيف/متوسط/ممتاز للجميع، وهذا مقياس
    // جودة لا يصلح لمعيار مثل "الدسامة" — دسم ليس "ممتاز" ولا "ضعيف"،
    // هو طرف في مقياس. كل معيار يجيب سلّمه معه.
    if (!label || !low || !high) return fail("CRITERION_TEXT", key);

    keys.add(key);
    // الوسط اختياري: "وسط" تصلح لأي مقياس تقريباً، فما نسقط توليداً
    // سليماً لأجل كلمة واحدة يمكن استنتاجها
    criteria.push({ key, label, low, mid: text(c?.mid, 20) ?? "وسط", high });
  }

  // ---------- الأسئلة ----------
  if (!Array.isArray(raw.questions) || raw.questions.length !== QUESTION_COUNT) {
    return fail("QUESTION_COUNT", raw.questions?.length);
  }

  const questions = [];
  const questionKeys = new Set();

  for (const q of raw.questions) {
    const key = text(q?.key, 24);
    if (!key || !SLUG.test(key)) return fail("QUESTION_KEY", q?.key);
    if (questionKeys.has(key)) return fail("QUESTION_DUPLICATE", key);

    // القيد الجوهري: السؤال بلا معيار موجود لا يفعل شيئاً.
    // weightsFor تكتب weights[q.affects]، فمفتاح مخترع يضيف وزناً
    // لمعيار لا يقرأه scoreOptions أبداً — سؤال يظهر ولا أثر له.
    const affects = text(q?.affects, 24);
    if (!affects || !keys.has(affects)) return fail("AFFECTS_UNKNOWN", affects);

    const label = text(q?.label, 90);
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

      const chLabel = text(ch?.label, 70);
      if (!chLabel) return fail("CHOICE_TEXT", value);

      const weight = Number(ch?.weight);
      if (!Number.isInteger(weight) || weight < 1 || weight > MAX_WEIGHT) {
        return fail("CHOICE_WEIGHT", ch?.weight);
      }

      values.add(value);
      // en اختياري: عنوان لاتيني صغير للزينة، وغيابه يعطي span فاضياً
      // لا ينكسر معه شي — ما يستاهل إسقاط التوليد كله لأجله
      choices.push({ value, label: chLabel, en: text(ch?.en, 20) ?? "", weight });
    }

    const weights = choices.map((c) => c.weight).sort((a, b) => a - b);
    if (weights.join() !== REQUIRED_WEIGHTS.join()) {
      return fail("WEIGHT_SET", weights.join());
    }

    questionKeys.add(key);
    questions.push({
      key,
      affects,
      label,
      en: text(q?.en, 24) ?? "",
      // الترتيب تنازلي: الأهم أولاً، مثل القوالب الثابتة
      choices: choices.sort((a, b) => b.weight - a.weight),
    });
  }

  // ---------- moodCriteria ----------
  // ⚠️ هذا الحقل يُنسى بسهولة ويفشل بصمت: weightsFor تنادي moodTarget
  // اللي يقرأ category.moodCriteria، وغيابه يرجّع null بلا خطأ —
  // فيوقف أثر المزاج كلياً بينما الواجهة تكمل تعرض شرائح المزاج
  // وكأنها تعمل. لذلك إلزامي هنا لا اختياري.
  const mood = raw.moodCriteria;
  if (!mood || typeof mood !== "object") return fail("MOOD_MISSING");

  const energy = text(mood.energy, 24);
  const ease = text(mood.ease, 24);
  if (!energy || !keys.has(energy)) return fail("MOOD_ENERGY", energy);
  if (!ease || !keys.has(ease)) return fail("MOOD_EASE", ease);

  return {
    ok: true,
    rubric: {
      // الهوية من القالب الثابت — قيد CHECK في قاعدة البيانات
      id: base.id,
      label: base.label,
      en: base.en,
      hint: base.hint,
      generated: true,
      moodCriteria: { energy, ease },
      criteria,
      questions,
    },
  };
}
