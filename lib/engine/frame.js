// «الإطار» — قالب قرار يولّده النموذج لخيارين بعينهما، بدل قالب ثابت
// معلّق بالفئة.
//
// الفكرة الحاكمة: `lib/engine/score.js` ما يعرف من وين جاء القالب —
// يعرف شكله فقط (`criteria[]` و `questions[]` و `moodCriteria`). فلو
// ولّد النموذج كائناً بنفس الشكل، اشتغل المحرك عليه بلا سطر يتغيّر،
// وبقي الحساب في JS والنموذج يفسّر ولا يحسب.
//
// وهذا الملف هو العقد: مخطط ما نطلبه من النموذج، والمدقّق الذي يحوّل
// مخرَجه إلى شيء يصح رسمه. القاعدة القائمة في المشروع: البرومبت طلبٌ
// قد يفوت النموذج، و`shape()` كود يشتغل دائماً — فكل ضمانة هنا لا هناك.

import { Type } from "@google/genai";
import { CATEGORIES, getCategory } from "./categories.js";
import { toArabicDigits } from "../text/digits.js";
import { normalizeArabic } from "../voice/match.js";

// الفئات ليست تصنيفاً تجميلياً بل قيد `CHECK` على `decisions.category`.
// خروج النموذج عنها يكسر الحفظ *بعد* ظهور النتيجة — أسوأ لحظة للانكسار.
// نشتقها من الملف نفسه حتى تبقى مربوطة بمصدر واحد.
export const FRAME_CATEGORIES = CATEGORIES.map((c) => c.id);

// عند الشك نسقط لـ «حياة»: أوسع الخمس معنى، فالتصنيف الخاطئ فيها
// أقل ضرراً من رفض القرار كله
const FALLBACK_CATEGORY = "life";

// المفاتيح معرّفات داخلية لا تُعرض أبداً: تُخزَّن في `answers.question_key`
// (عمود `text` بلا سقف)، وتُستعمل مفاتيح كائنات و`key` لعناصر React —
// ولا تلمس معرّف DOM ولا رابطاً، فأي حرف فيها آمن.
//
// القاعدة بدأت `[a-z_]{2,20}` وسقط عليها ٤٠٪ من الأزواج المختبرة،
// ثم ضُيّقت ثلاث مرات على ثلاثة أعطال قاسها التشخيص لا التخمين:
//   • أسماء وصفية أطول من ٢٠ — `importance_of_other_devices` ٢٧ حرفاً.
//   • مفاتيح عربية مع الأزواج المجرّدة («الحاجة_الفورية»)، ٣ من ٥.
//   • تشكيل داخل المفتاح («احتاجه_بشدة_وفوراً») — والتنوين علامة
//     تركيبية لا حرف، فـ `\p{L}` وحدها ترفضه.
//
// وكل هذي كانت في البرومبت أصلاً والنموذج يخالفها. فبدل ترقيع رابع،
// نكتب ما تحرسه القاعدة فعلاً: أن يكون المفتاح **معرّفاً** — لا جملة
// ولا فراغاً ولا تسمية معروضة. أما أبجديته وطوله فلا يضرّان أحداً:
// المفتاح لا يُعرض أبداً، ويُخزَّن في عمود `text` بلا سقف، ويُستعمل
// مفتاحَ كائن و`key` لعنصر React — ولا يلمس معرّف DOM ولا رابطاً.
//
// البرومبت يبقى يطلب ASCII لأن المفتاح الإنجليزي أسهل عند التنقيح،
// والكود يقبل ما لا يضر. هذا هو الفرق بين الطلب والضمانة.
const KEY = /^[\p{L}\p{M}][\p{L}\p{M}\p{N}_]{1,47}$/u;
const MIN_CRITERIA = 3;
const MAX_CRITERIA = 4;
const CHOICES_PER_QUESTION = 3;
const MAX_TEXT = 90;

// ---------------------------------------------------------------
// مخطط الطلب — ما نطلبه من النموذج
// ---------------------------------------------------------------

// `priors` و `confidence` خرائط مفاتيحها ديناميكية (نص الخيار، مفتاح
// المعيار)، و`responseSchema` ما يعبّر عن مفاتيح حرة — فنطلبها مصفوفات
// ونحوّلها لخرائط في `shapeFrame`. الشكل الموثّق يبقى خريطة.
const CRITERION = {
  type: Type.OBJECT,
  properties: {
    key: { type: Type.STRING, description: "lowercase ascii [a-z_], 2-40 chars" },
    label: { type: Type.STRING },
    low: { type: Type.STRING, description: "Arabic phrase for the low pole." },
    mid: { type: Type.STRING },
    high: { type: Type.STRING, description: "Arabic phrase for the high pole." },
  },
  required: ["key", "label", "low", "mid", "high"],
  propertyOrdering: ["key", "label", "low", "mid", "high"],
};

const QUESTION = {
  type: Type.OBJECT,
  properties: {
    key: { type: Type.STRING },
    affects: { type: Type.STRING, description: "A criterion key." },
    label: { type: Type.STRING },
    choices: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          value: { type: Type.STRING, description: "lowercase ascii id [a-z_], 2-40" },
          label: { type: Type.STRING },
          weight: { type: Type.INTEGER, description: "3, 2 or 1 — one each." },
        },
        required: ["value", "label", "weight"],
        propertyOrdering: ["value", "label", "weight"],
      },
    },
  },
  required: ["key", "affects", "label", "choices"],
  propertyOrdering: ["key", "affects", "label", "choices"],
};

export const FRAME_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    category: { type: Type.STRING },
    headline: { type: Type.STRING, description: "One Arabic line naming the real trade-off." },
    criteria: { type: Type.ARRAY, items: CRITERION },
    moodEnergy: { type: Type.STRING, description: "Criterion key that an eager user favours." },
    moodEase: { type: Type.STRING, description: "Criterion key that a drained user favours." },
    first: QUESTION,
    branches: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          answer: { type: Type.STRING, description: "Copies a value from first.choices." },
          next: QUESTION,
        },
        required: ["answer", "next"],
        propertyOrdering: ["answer", "next"],
      },
    },
    priors: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          option: { type: Type.STRING, description: "Copied verbatim from the user's two options." },
          ratings: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                criterion: { type: Type.STRING },
                value: { type: Type.INTEGER, description: "1, 2 or 3" },
              },
              required: ["criterion", "value"],
              propertyOrdering: ["criterion", "value"],
            },
          },
        },
        required: ["option", "ratings"],
        propertyOrdering: ["option", "ratings"],
      },
    },
    confidence: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          criterion: { type: Type.STRING },
          level: { type: Type.STRING, description: "high or low" },
          note: { type: Type.STRING, description: "Short Arabic line — only when level is low." },
        },
        required: ["criterion", "level"],
        propertyOrdering: ["criterion", "level", "note"],
      },
    },
  },
  required: [
    "category",
    "headline",
    "criteria",
    "moodEnergy",
    "moodEase",
    "first",
    "branches",
    "priors",
    "confidence",
  ],
  propertyOrdering: [
    "category",
    "headline",
    "criteria",
    "moodEnergy",
    "moodEase",
    "first",
    "branches",
    "priors",
    "confidence",
  ],
};

// ---------------------------------------------------------------
// النظام والبرومبت — هنا لا في الراوت، لأنهما نصف العقد: المخطط
// يصف الشكل والتعليمات تصف المعنى، وفصلهما يخلي أحدهما يتغيّر بلا
// الآخر. و`refine` في المرحلة القادمة يعيد استعمالهما.
// ---------------------------------------------------------------

export const FRAME_SYSTEM =
  "You build a decision frame for an Arabic-first app that compares exactly TWO options. " +
  "The frame replaces a hand-written template: its criteria and questions must be about THESE " +
  "two options, never about their general category. " +
  "HARD RULES: " +
  "1. Output 3 or 4 criteria that genuinely separate these two options. Never generic ones. " +
  "2. Every key and every choice value is lowercase English ASCII letters and underscores " +
  "only, 2 to 40 characters, starting with a letter. No digits, no hyphens, no Arabic, " +
  "no spaces. " +
  "3. Every criterion has two OPPOSITE poles: low and high are different concrete Arabic " +
  "phrases naming the two ends. Never a quality scale like ضعيف/ممتاز. " +
  "4. first targets exactly one criterion via affects. Every branch's next targets a " +
  "DIFFERENT criterion than first does. affects always names a key from your criteria list. " +
  "5. Every question has exactly 3 choices whose weights are exactly 3, 2 and 1 — one each, " +
  "never repeated. The heaviest weight goes to the answer that makes that criterion matter MOST. " +
  "6. branches has exactly 3 items, one per choice of first, in the same order; each answer " +
  "copies that choice's value verbatim. " +
  "7. priors has exactly one entry per option, with the option text copied VERBATIM from the " +
  "user, rating it 1 to 3 on every criterion. " +
  "8. confidence is high or low per criterion. Say low honestly when the rating depends on " +
  "facts you do not have, and give a short Arabic note explaining what it depends on. " +
  "9. category is exactly one of: food, entertainment, shopping, time, life. " +
  "10. headline is one short Arabic line naming the real trade-off. " +
  "11. All user-facing text is short Saudi-dialect Arabic. Digits are Arabic-Indic. " +
  "No decorative labels, no explanatory prose, no English.";

export function framePrompt(options) {
  return [
    `الخياران: «${options[0]}» ضد «${options[1]}».`,
    "",
    "ولّد الإطار: المعايير التي تفرّق بين هذين الخيارين تحديداً،",
    "والسؤال الأول، ثم لكل إجابة من إجاباته الثلاث السؤالَ التالي",
    "المناسب لها، وتقديرك المبدئي لكل خيار في كل معيار.",
    "",
    `مفاتيح priors تُنسخ حرفياً: «${options[0]}» و«${options[1]}».`,
  ].join("\n");
}

// ---------------------------------------------------------------
// أدوات التدقيق
// ---------------------------------------------------------------

// كل نص معروض يمر من هنا: القَص يمنع تسميةً تكسر التخطيط، وتحويل
// الأرقام ضمانة لا رجاء — الخط العربي يرسم بعض الأرقام اللاتينية
// هندية وبعضها لا، فيطلع السطر بنظامين
const text = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return toArabicDigits(trimmed.slice(0, MAX_TEXT));
};

const sameText = (a, b) => normalizeArabic(a) === normalizeArabic(b);

function shapeCriteria(raw) {
  if (!Array.isArray(raw)) return null;
  if (raw.length < MIN_CRITERIA || raw.length > MAX_CRITERIA) return null;

  const seen = new Set();
  const out = [];

  for (const c of raw) {
    if (!c || typeof c !== "object") return null;
    if (typeof c.key !== "string" || !KEY.test(c.key)) return null;
    if (seen.has(c.key)) return null;

    const label = text(c.label);
    const low = text(c.low);
    const high = text(c.high);
    // قطبان متقابلان لا مقياس جودة. بدونهما تسقط الشاشة للمقياس العام
    // «ضعيف/ممتاز» — وهذا بالضبط ما نهرب منه بكل هذا العمل
    if (!label || !low || !high || sameText(low, high)) return null;

    seen.add(c.key);
    out.push({ key: c.key, label, low, mid: text(c.mid) ?? undefined, high });
  }

  return out;
}

// يرجّع السؤال مُنظَّفاً أو null. `taken` مفاتيح المعايير المحجوزة على
// نفس المسار — معيار يغطيه سؤالان يعني وزناً يُكتب مرتين ويضيع أحدهما
function shapeQuestion(raw, criteriaKeys, taken = []) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.key !== "string" || !KEY.test(raw.key)) return null;
  if (typeof raw.affects !== "string" || !criteriaKeys.has(raw.affects)) return null;
  if (taken.includes(raw.affects)) return null;

  const label = text(raw.label);
  if (!label) return null;

  if (!Array.isArray(raw.choices) || raw.choices.length !== CHOICES_PER_QUESTION) {
    return null;
  }

  const values = new Set();
  const choices = [];

  for (const ch of raw.choices) {
    if (!ch || typeof ch !== "object") return null;
    if (typeof ch.value !== "string" || !KEY.test(ch.value)) return null;
    if (values.has(ch.value)) return null;
    const chLabel = text(ch.label);
    if (!chLabel) return null;
    if (!Number.isInteger(ch.weight)) return null;
    values.add(ch.value);
    choices.push({ value: ch.value, label: chLabel, weight: ch.weight });
  }

  // الأوزان مجموعة {١,٢,٣} بالضبط: سؤال بثلاث إجابات كلها ٢ سؤال بلا
  // أثر — يأخذ من المستخدم وقتاً ولا يحرّك الحساب
  const weights = choices.map((c) => c.weight).sort((a, b) => a - b);
  if (weights.join() !== "1,2,3") return null;

  return { key: raw.key, affects: raw.affects, label, choices };
}

// الشجرة: فرع لكل إجابة ممكنة من السؤال الأول، فيُقرأ السؤال الثاني من
// الذاكرة عند الضغط بدل نداء جديد. القياس قال إن كلفتها صفر تقريباً
// (٣٠٦٧ms للشجرة مقابل ٣٣٢٥ms للمسطّح)، فهي ربح خالص.
//
// أي خلل فيها يُسقطها كلها لا يفشّل الطلب: الشجرة تسريع، وفقدانها
// يرجّعنا لسؤالين ثابتين — وهذا أسوأ ما يحصل.
function shapeBranches(raw, first, criteriaKeys) {
  if (!Array.isArray(raw) || raw.length !== CHOICES_PER_QUESTION) return null;

  const answers = first.choices.map((c) => c.value);
  const seen = new Set();
  const out = [];

  for (const b of raw) {
    if (!b || typeof b !== "object") return null;
    if (typeof b.answer !== "string" || !answers.includes(b.answer)) return null;
    if (seen.has(b.answer)) return null;

    const next = shapeQuestion(b.next, criteriaKeys, [first.affects]);
    if (!next) return null;

    seen.add(b.answer);
    out.push({ answer: b.answer, next });
  }

  // كل إجابة لها فرع — فرع ناقص يعني مساراً يقف عند سؤال واحد
  return seen.size === answers.length ? out : null;
}

// تقدير النموذج المبدئي لكل خيار. تحسين اختياري لا شرط: مفاتيح لا
// تطابق نصّي الخيارين = تُلغى وتبدأ المقابض من الوسط، ولا يفشل الطلب
function shapePriors(raw, options, criteriaKeys) {
  if (!Array.isArray(raw)) return null;

  const out = {};
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const matched = options.find((o) => sameText(o, entry.option ?? ""));
    if (!matched || out[matched]) continue;
    if (!Array.isArray(entry.ratings)) continue;

    const ratings = {};
    for (const r of entry.ratings) {
      if (!r || typeof r !== "object") continue;
      if (!criteriaKeys.has(r.criterion)) continue;
      if (!Number.isInteger(r.value) || r.value < 1 || r.value > 3) continue;
      ratings[r.criterion] = r.value;
    }

    if (Object.keys(ratings).length) out[matched] = ratings;
  }

  // تقدير لخيار واحد يخلي المقارنة عرجاء — إما الاثنان أو لا شيء
  return Object.keys(out).length === options.length ? out : null;
}

// صراحة الآلة عن حدودها تبني ثقة أكثر من ثقة مزيّفة: المعيار المنخفض
// الثقة يُرسم مقطّعاً ومعه سبب، بدل ما يُقدَّم كأنه معلوم
function shapeConfidence(raw, criteriaKeys) {
  if (!Array.isArray(raw)) return { confidence: null, notes: null };

  const confidence = {};
  const notes = {};

  for (const c of raw) {
    if (!c || typeof c !== "object") continue;
    if (!criteriaKeys.has(c.criterion)) continue;
    if (c.level !== "high" && c.level !== "low") continue;
    confidence[c.criterion] = c.level;
    // السبب يخص المعيار المشكوك فيه — سطر تحت مقبض واثق ضجيج
    if (c.level === "low") {
      const note = text(c.note);
      if (note) notes[c.criterion] = note;
    }
  }

  return {
    confidence: Object.keys(confidence).length ? confidence : null,
    notes: Object.keys(notes).length ? notes : null,
  };
}

// ---------------------------------------------------------------
// المدقّق — يستعمله /api/frame و /api/decide
// ---------------------------------------------------------------

/**
 * يحوّل مخرَج النموذج الخام إلى إطار يصح رسمه، أو يرفضه.
 *
 * @param {unknown} raw مخرَج النموذج بعد JSON.parse
 * @param {{ options: string[] }} context نصّا الخيارين كما كتبهما المستخدم
 * @returns {{ ok: true, frame: object } | { ok: false, reason: string }}
 */
export function shapeFrame(raw, { options }) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "NOT_OBJECT" };
  }

  const criteria = shapeCriteria(raw.criteria);
  if (!criteria) return { ok: false, reason: "BAD_CRITERIA" };
  const criteriaKeys = new Set(criteria.map((c) => c.key));

  const headline = text(raw.headline);
  // العنوان أطروحة الإطار: بدونه تبقى الشاشة مقارنة بلا اسم
  if (!headline) return { ok: false, reason: "NO_HEADLINE" };

  const first = shapeQuestion(raw.first, criteriaKeys);
  if (!first) return { ok: false, reason: "BAD_FIRST" };

  const branches = shapeBranches(raw.branches, first, criteriaKeys);

  // الشجرة سقطت؟ نأخذ منها سؤالاً ثابتاً واحداً بدل ما نخسر المستوى
  // الثاني كله — المستخدم يجاوب سؤالين في الحالتين، والفرق تخصيص
  // السؤال الثاني لإجابته
  let then = null;
  if (!branches && Array.isArray(raw.branches)) {
    for (const b of raw.branches) {
      const next = shapeQuestion(b?.next, criteriaKeys, [first.affects]);
      if (next) {
        then = next;
        break;
      }
    }
  }

  const { confidence, notes } = shapeConfidence(raw.confidence, criteriaKeys);
  const priors = shapePriors(raw.priors, options, criteriaKeys);

  // مزاج يشير لمعيار وهمي أسوأ من مزاج بلا هدف — `moodTarget` يرجّع
  // null بأمان، فحذف الحقل كله هو التصرف الصحيح
  const energy = raw.moodEnergy;
  const ease = raw.moodEase;
  const moodCriteria =
    criteriaKeys.has(energy) && criteriaKeys.has(ease) && energy !== ease
      ? { energy, ease }
      : null;

  return {
    ok: true,
    frame: {
      category: FRAME_CATEGORIES.includes(raw.category)
        ? raw.category
        : FALLBACK_CATEGORY,
      headline,
      criteria,
      first,
      ...(branches ? { branches } : {}),
      ...(then ? { then } : {}),
      ...(moodCriteria ? { moodCriteria } : {}),
      ...(priors ? { priors } : {}),
      ...(confidence ? { confidence } : {}),
      ...(notes ? { notes } : {}),
    },
  };
}

// ---------------------------------------------------------------
// قراءة الإطار
// ---------------------------------------------------------------

/**
 * أسئلة المسار الذي سلكه المستخدم فعلاً. مع الشجرة يُقرأ الفرع من
 * الذاكرة — صفر ملّي ثانية، لا نداء سريع.
 */
export function pathQuestions(frame, answers) {
  if (!frame?.first) return [];
  const out = [frame.first];

  if (frame.branches) {
    const picked = answers?.[frame.first.key];
    const branch = frame.branches.find((b) => b.answer === picked);
    if (branch) out.push(branch.next);
  } else if (frame.then) {
    out.push(frame.then);
  }

  return out;
}

/**
 * الإطار بشكل «فئة» حتى يقرأه `score.js` بلا أن يعرف الفرق. هذي هي
 * الوصلة كلها: `getCategory(id)` صار `frameToCategory(frame)`.
 */
export function frameToCategory(frame, answers) {
  return {
    id: frame.category,
    label: getCategory(frame.category)?.label ?? "قرار",
    criteria: frame.criteria,
    questions: pathQuestions(frame, answers),
    moodCriteria: frame.moodCriteria ?? null,
  };
}

/**
 * تدقيق إطار وصل من العميل (‎/api/decide‎ يستقبله في الـ body). ما
 * نثق بشكل جاء من المتصفح أكثر مما نثق بمخرَج النموذج.
 */
export function isUsableFrame(frame) {
  if (!frame || typeof frame !== "object") return false;
  if (!FRAME_CATEGORIES.includes(frame.category)) return false;
  if (!shapeCriteria(frame.criteria)) return false;
  return Boolean(shapeQuestion(frame.first, new Set(frame.criteria.map((c) => c.key))));
}
