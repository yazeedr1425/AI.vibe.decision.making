// النقاش بعد الحكم — وكيل يدافع عن قراره، ويغيّره بالمعلومة لا بالضغط.
//
// الفكرة الحاكمة: `changes` هي الطريق الوحيد لتحريك الحكم. ردٌّ يوافق
// المستخدم بينما `changes` فاضية كذبةٌ مرئية — البطاقة ما تتحرك والكلام
// يقول إنها تحرّكت. ولهذا يسبق التصنيفُ التعديلَ في المخطط، و`shape()`
// يفرضه: رسالةٌ قرأها النموذج ضغطاً ثم أرفق بها تعديلاً ناقضت نفسها،
// والكود أصدق من النية. القاعدة نفسها لو بقيت في البرومبت وحده لكانت
// رجاءً — والمجاملة أكثر ما ينزلق فيه نموذج عبر دورات متتالية.
//
// وقوة الحجة ما تجي من نبرة البرومبت. النموذج يستلم المعيار الحاسم
// والفارق والأوزان والتقييمات، فيجادل بأرقامٍ أمام عين المستخدم بدل
// ثقةٍ مصنوعة. «حتى لو نزّلت التكامل درجة ما ينقلب» حجة لا تُردّ،
// و«لأن التكامل أهم» رأي يُردّ بمثله.

import { Type } from "@google/genai";
import { MAX_WEIGHT } from "./score.js";
import { toArabicDigits } from "../text/digits.js";
import { normalizeArabic } from "../voice/match.js";

// ---------------------------------------------------------------
// السقوف — كلها ضد الانزلاق لا ضد الكلفة
// ---------------------------------------------------------------

// تعديلان في الدورة الواحدة: رسالة واحدة نادراً ما تحمل أكثر من
// معلومتين، والثالث يعني أن النموذج يعيد تشكيل القرار لا يصحّحه
export const MAX_CHANGES_PER_TURN = 2;

// المعيار الواحد ما يُعاد تقييمه أكثر من مرتين في الجلسة كلها. بدون
// هذا السقف، أربع دورات تكفي لتحويل الحكم إلى «اللي يبيه المستخدم»
// بخطوات كل واحدة منها تبدو معقولة وحدها
export const MAX_EDITS_PER_CRITERION = 2;

// بعد أربع دورات، ما بقي نقاشٌ بل إقناع. الوكيل يقفل بصراحة:
// «أنت حسمتها» — وهي أنفع جملة يقدر يقولها لمتردد يدافع عن خيار
export const MAX_TURNS = 4;

const MAX_REPLY = 240;
const MAX_TEXT = 90;
const KEY = /^[a-z][a-z_]{1,39}$/;
const RATING_MIN = 1;
const RATING_MAX = 3;

// ---------------------------------------------------------------
// المخطط
// ---------------------------------------------------------------

// نوع واحد لكل التعديلات بحقول اختيارية، لا اتحاد أنواع: مخطط الاستجابة
// ما يعبّر عن الاتحاد، ومخطط أوسع مع `shape()` أضيق أقل عطباً من مخطط
// ضيّق يرفض المخرَج كله لأجل حقل زائد
const CHANGE = {
  type: Type.OBJECT,
  properties: {
    type: {
      type: Type.STRING,
      description: "rerate | reweight | add_criterion",
    },
    criterion: {
      type: Type.STRING,
      description:
        "An existing criterion key, or a NEW lowercase ascii key for add_criterion.",
    },
    label: { type: Type.STRING, description: "add_criterion only. Arabic." },
    low: { type: Type.STRING, description: "add_criterion only. Arabic pole." },
    high: { type: Type.STRING, description: "add_criterion only. Arabic pole." },
    weight: {
      type: Type.INTEGER,
      description: "1-4. How much this criterion matters now.",
    },
    ratings: {
      type: Type.ARRAY,
      description: "Per option, 1-3. Required for rerate and add_criterion.",
      items: {
        type: Type.OBJECT,
        properties: {
          option: { type: Type.STRING, description: "Copied verbatim." },
          to: { type: Type.INTEGER },
        },
        required: ["option", "to"],
        propertyOrdering: ["option", "to"],
      },
    },
    why: { type: Type.STRING, description: "Arabic, one short clause." },
  },
  required: ["type", "criterion", "why"],
  propertyOrdering: [
    "type",
    "criterion",
    "label",
    "low",
    "high",
    "weight",
    "ratings",
    "why",
  ],
};

export const DISCUSS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    // أولاً في الترتيب عمداً: التصنيف قبل التعديل يخلي النموذج يقرر
    // طبيعة الرسالة قبل ما يقرر ماذا يفعل بها، لا العكس
    reads_as: {
      type: Type.STRING,
      description: "information | pressure | unrelated",
    },
    understood: { type: Type.STRING, description: "Arabic, one clause." },
    changes: { type: Type.ARRAY, items: CHANGE },
    reply: { type: Type.STRING, description: "Arabic, two sentences max." },
  },
  required: ["reads_as", "understood", "changes", "reply"],
  propertyOrdering: ["reads_as", "understood", "changes", "reply"],
};

// ---------------------------------------------------------------
// النظام
// ---------------------------------------------------------------

export const DISCUSS_SYSTEM =
  "You are Ahsem's decision advocate. A verdict has ALREADY been produced by a weighted " +
  "engine, and the user is looking at it right now. You defend it honestly, and you revise " +
  "it ONLY when the user supplies information the engine did not have. " +
  "You are given the criteria, their weights, each option's rating on each, which criterion " +
  "was decisive, the current margin, and what would flip it. THESE are your arguments — cite " +
  "them specifically. Never argue from tone or confidence. Argue from the numbers you hold. " +
  "HARD RULES: " +
  "1. NEVER name the winning option in reply. The verdict card states the winner; two voices " +
  "naming a winner will contradict each other the moment one of them is stale. " +
  "2. changes is the ONLY way the verdict can move. A reply that agrees with the user while " +
  "changes is empty is a lie. If convinced, emit the change. If not, emit nothing and say why. " +
  "3. New information moves the verdict; pressure does not. «المطعم بعيد عني» is information. " +
  "«لا، أبي الثاني» is pressure — set reads_as to pressure, emit NO changes, and tell them " +
  "plainly that they may have already decided. That is more useful to a hesitant person than " +
  "arguing. " +
  "4. Never invent a criterion the user did not raise, and never re-rate an option on a " +
  "criterion they did not speak about. " +
  "5. Do not re-argue a point you already answered. If an objection repeats, say it is already " +
  "counted and name where. " +
  "6. Do not soften across turns. Your position moves through changes only, never through " +
  "progressively more agreeable wording. " +
  "7. Concede fast and completely when they are right, and say plainly what you had wrong. " +
  "A defensive advisor is as useless as a servile one. " +
  "8. For rerate and add_criterion, ratings must cover EVERY option, with the option text " +
  "copied verbatim. add_criterion needs a new lowercase ascii key plus label, low and high " +
  "as two opposite concrete Arabic phrases. " +
  "9. Short Saudi-dialect Arabic. reply is two sentences maximum. No greetings, no praising " +
  "the question, no offers to help further, no emoji. " +
  "10. If the message does not bear on the decision, set reads_as to unrelated, say so in one " +
  "sentence, and stop. Do not fill the space.";

// ---------------------------------------------------------------
// البرومبت
// ---------------------------------------------------------------

// الأرقام تُكتب صراحةً لا تُلمَّح: النموذج ما يقدر يجادل بفارقٍ ما
// أُعطي له، والحجة العامة («لأنه أهم») تُردّ بمثلها
export function discussPrompt({
  options,
  criteria,
  weights,
  ratings,
  verdict,
  lead,
  turns,
  message,
}) {
  const table = criteria.map((c) => {
    const cells = options
      .map((o) => `${o}: ${ratings?.[o]?.[c.key] ?? 2}`)
      .join(" · ");
    const mark = c.key === verdict.decisive ? " ← الحاسم" : "";
    return `- ${c.label} (${c.key}) · وزنه ${weights?.[c.key] ?? 2} · ${cells}${mark}`;
  });

  const history = turns.length
    ? turns.map((t) => `${t.role === "user" ? "هو" : "أنت"}: ${t.text}`)
    : ["— أول رسالة —"];

  return [
    `الخيارات: ${options.map((o) => `«${o}»`).join(" ضد ")}.`,
    "",
    "المعايير وأرقامها الحالية:",
    ...table,
    "",
    `الفارق الحالي: ${lead.diff} من ${lead.max} — ${lead.gap}.`,
    verdict.flip ? `ينقلب لو: ${verdict.flip}` : "",
    "",
    `حكمك كان مبنياً على: ${verdict.reason}`,
    "",
    "المحادثة حتى الآن:",
    ...history,
    "",
    `رسالته الآن: «${message}»`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------
// أدوات التدقيق
// ---------------------------------------------------------------

const text = (value, max = MAX_TEXT) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return toArabicDigits(trimmed.slice(0, max));
};

const int = (value, min, max) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

// النموذج يعيد صياغة الخيار أحياناً بدل ما ينسخه — نرجّعه للنص الأصلي
// حتى يطابق ما كتبه المستخدم بالضبط، فالتقييمات مفهرسة به
const matchOption = (given, options) => {
  if (typeof given !== "string") return null;
  return (
    options.find((o) => o === given) ??
    options.find((o) => normalizeArabic(o) === normalizeArabic(given)) ??
    null
  );
};

// تقييمات التعديل: لازم تغطي كل الخيارات. تعديلٌ يذكر خياراً واحداً
// يترك الثاني على قيمة قديمة تخص معياراً تغيّر معناه — والنتيجة
// مقارنة بين رقمين من عالمين
function shapeRatings(raw, options) {
  if (!Array.isArray(raw)) return null;

  const out = {};
  for (const entry of raw) {
    const option = matchOption(entry?.option, options);
    const to = int(entry?.to, RATING_MIN, RATING_MAX);
    if (!option || to == null) continue;
    out[option] = to;
  }

  return options.every((o) => out[o] != null) ? out : null;
}

function shapeChange(raw, { options, criteriaKeys, spent }) {
  if (!raw || typeof raw !== "object") return null;

  const why = text(raw.why, 120);
  const type = raw.type;

  if (type === "reweight" || type === "rerate") {
    const criterion = criteriaKeys.includes(raw.criterion) ? raw.criterion : null;
    if (!criterion) return null;
    // السقف التراكمي يُقرأ هنا لا في الواجهة: الواجهة تعرض، والعقد يمنع
    if ((spent?.[criterion] ?? 0) >= MAX_EDITS_PER_CRITERION) return null;

    if (type === "reweight") {
      const weight = int(raw.weight, 1, MAX_WEIGHT);
      return weight == null ? null : { type, criterion, weight, why };
    }

    const ratings = shapeRatings(raw.ratings, options);
    return ratings == null ? null : { type, criterion, ratings, why };
  }

  if (type === "add_criterion") {
    const criterion = typeof raw.criterion === "string" ? raw.criterion : "";
    // مفتاح موجود مسبقاً ليس إضافة بل إعادة تعريف صامتة لمعيارٍ يقرأه
    // الحساب — والنتيجة معياران بمفتاح واحد ووزنٌ يُكتب مرتين
    if (!KEY.test(criterion) || criteriaKeys.includes(criterion)) return null;

    const label = text(raw.label);
    const low = text(raw.low);
    const high = text(raw.high);
    // بلا طرفين مختلفين يسقط المعيار للمقياس العام «ضعيف/ممتاز» —
    // وهو ما هرب منه الإطار كله
    if (!label || !low || !high || normalizeArabic(low) === normalizeArabic(high)) {
      return null;
    }

    const ratings = shapeRatings(raw.ratings, options);
    if (!ratings) return null;

    // المستخدم هو من رفع هذا المعيار الآن، فوزنه الافتراضي عالٍ
    return {
      type,
      criterion,
      label,
      low,
      mid: "وسط",
      high,
      weight: int(raw.weight, 1, MAX_WEIGHT) ?? 3,
      ratings,
      why,
    };
  }

  return null;
}

// ---------------------------------------------------------------
// المدقّق
// ---------------------------------------------------------------

export function shapeDiscussion(raw, { options, criteriaKeys, spent }) {
  if (!raw || typeof raw !== "object") return null;

  const reply = text(raw.reply, MAX_REPLY);
  if (!reply) return null;

  const reads_as = ["information", "pressure", "unrelated"].includes(raw.reads_as)
    ? raw.reads_as
    : "unrelated";

  // ⬅ الضمانة المركزية: المجاملة تُمنع في الكود لا في البرومبت.
  // نموذج صنّف الرسالة ضغطاً ثم أرفق تعديلاً ناقض نفسه، والتصنيف
  // أوثق من التعديل لأنه يسبقه في المخطط — فيُلغى التعديل لا التصنيف.
  const changes =
    reads_as === "information" && Array.isArray(raw.changes)
      ? raw.changes
          .map((c) => shapeChange(c, { options, criteriaKeys, spent }))
          .filter(Boolean)
          .slice(0, MAX_CHANGES_PER_TURN)
      : [];

  return {
    reads_as,
    understood: text(raw.understood, 120) ?? "",
    changes,
    reply,
  };
}

// ---------------------------------------------------------------
// التطبيق — دوال نقية يشتقّ منها الرندر، فلا `setState` داخل أثر
// ---------------------------------------------------------------

export const emptyRevision = () => ({
  criteria: [],
  weights: {},
  ratings: {},
  spent: {},
  count: 0,
});

/**
 * دمج تعديلات دورة في المراجعة. الخيارات تُمرَّر بمعرّفاتها لأن
 * `scoreOptions` يفهرس التقييمات بالمعرّف، والنموذج يتكلم بالنص.
 */
export function mergeChanges(revision, changes, options) {
  if (!changes.length) return revision;

  const next = {
    criteria: [...revision.criteria],
    weights: { ...revision.weights },
    ratings: { ...revision.ratings },
    spent: { ...revision.spent },
    count: revision.count + 1,
  };

  const idOf = (label) => options.find((o) => o.label === label)?.id ?? null;

  for (const change of changes) {
    next.spent[change.criterion] = (next.spent[change.criterion] ?? 0) + 1;

    if (change.type === "add_criterion") {
      const { type, ratings, weight, why, criterion, ...rest } = change;
      next.criteria.push({ key: criterion, ...rest });
      next.weights[criterion] = weight;
    } else if (change.type === "reweight") {
      next.weights[change.criterion] = change.weight;
    }

    if (change.ratings) {
      for (const [label, value] of Object.entries(change.ratings)) {
        const id = idOf(label);
        if (!id) continue;
        next.ratings[id] = { ...next.ratings[id], [change.criterion]: value };
      }
    }
  }

  return next;
}

export const revisedCategory = (category, revision) =>
  !category || !revision.criteria.length
    ? category
    : { ...category, criteria: [...category.criteria, ...revision.criteria] };

export const revisedWeights = (weights, revision) => ({
  ...weights,
  ...revision.weights,
});

export function revisedRatings(ratings, revision) {
  if (!revision.count) return ratings;
  const out = { ...ratings };
  for (const [id, byKey] of Object.entries(revision.ratings)) {
    out[id] = { ...out[id], ...byKey };
  }
  return out;
}

/**
 * وصف الفارق للنموذج. الفارق وحده رقم بلا مرجع — «٤» قد تكون ساحقة
 * أو داخل الضجيج حسب مجموع الأوزان، فنعطيه الحكم لا المادة الخام.
 */
export function describeLead(scored, criteria, weights) {
  const max = criteria.reduce((sum, c) => sum + (weights[c.key] ?? 2) * 2, 0);
  const diff = scored.length > 1 ? scored[0].total - scored[1].total : 0;
  const ratio = max ? diff / max : 0;

  const gap =
    diff === 0
      ? "متعادلان تماماً"
      : ratio < 0.15
        ? "فارق ضيق، تحريك واحد يقلبه"
        : ratio < 0.4
          ? "فارق واضح لكنه ليس ساحقاً"
          : "فارق واسع، ما يقلبه تحريك واحد";

  return { diff, max, ratio, gap };
}
