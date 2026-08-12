// قوالب القرارات — كل فئة لها معاييرها الخاصة وأسئلتها الديناميكية.
// المعرّفات (id) مطابقة لقيد category في جدول decisions.

export const CATEGORIES = [
  {
    id: "food",
    emoji: "🍽️",
    label: "أكل",
    hint: "مطعم ولا طبخ بالبيت؟",
    criteria: [
      { key: "speed", label: "السرعة", low: "يبي له وقت", high: "جاهز بسرعة" },
      { key: "cost", label: "التكلفة", low: "غالي", high: "على قد الجيب" },
      { key: "crave", label: "الرغبة", low: "ما أشتهيه", high: "نفسي فيه" },
    ],
    questions: [
      {
        key: "time",
        affects: "speed",
        label: "كم عندك وقت؟",
        choices: [
          { value: "rush", label: "مستعجل", weight: 3 },
          { value: "normal", label: "عادي", weight: 2 },
          { value: "free", label: "فاضي", weight: 1 },
        ],
      },
      {
        key: "budget",
        affects: "cost",
        label: "ميزانيتك اليوم؟",
        choices: [
          { value: "tight", label: "مضغوطة", weight: 3 },
          { value: "normal", label: "عادية", weight: 2 },
          { value: "loose", label: "مرنة", weight: 1 },
        ],
      },
      {
        key: "mood",
        affects: "crave",
        label: "مزاجك كيف؟",
        choices: [
          { value: "treat", label: "أبي شي يفرحني", weight: 3 },
          { value: "normal", label: "عادي", weight: 2 },
          { value: "any", label: "ما يفرق", weight: 1 },
        ],
      },
    ],
  },

  {
    id: "entertainment",
    emoji: "🎬",
    label: "ترفيه",
    hint: "فيلم، مسلسل، ولا كتاب؟",
    criteria: [
      { key: "length", label: "يناسب وقتك", low: "طويل", high: "يخلص بسرعة" },
      { key: "mood", label: "يناسب مزاجك", low: "بعيد عن مزاجي", high: "بالضبط مزاجي" },
      { key: "hype", label: "الحماس", low: "هادي", high: "يشد" },
    ],
    questions: [
      {
        key: "window",
        affects: "length",
        label: "كم فاضي عندك؟",
        choices: [
          { value: "short", label: "ساعة أو أقل", weight: 3 },
          { value: "medium", label: "سهرة عادية", weight: 2 },
          { value: "long", label: "الليل كله لي", weight: 1 },
        ],
      },
      {
        key: "vibe",
        affects: "mood",
        label: "تبي شي…",
        choices: [
          { value: "specific", label: "يضبط مزاجي بالضبط", weight: 3 },
          { value: "open", label: "أي شي حلو", weight: 2 },
          { value: "whatever", label: "ما يفرق", weight: 1 },
        ],
      },
      {
        key: "energy",
        affects: "hype",
        label: "تبي شي يشد أعصابك؟",
        choices: [
          { value: "yes", label: "إيه، أبي حماس", weight: 3 },
          { value: "maybe", label: "شوي", weight: 2 },
          { value: "no", label: "لا، أبي أهدأ", weight: 1 },
        ],
      },
    ],
  },

  {
    id: "shopping",
    emoji: "🛍️",
    label: "تسوق",
    hint: "منتج A ضد B",
    criteria: [
      { key: "price", label: "السعر", low: "غالي", high: "سعره ممتاز" },
      { key: "quality", label: "الجودة", low: "عادي", high: "يعمّر" },
      { key: "need", label: "الحاجة الفعلية", low: "رغبة وبس", high: "محتاجه فعلاً" },
    ],
    questions: [
      {
        key: "budget",
        affects: "price",
        label: "الميزانية كيف؟",
        choices: [
          { value: "tight", label: "مضغوطة", weight: 3 },
          { value: "normal", label: "عادية", weight: 2 },
          { value: "loose", label: "مرنة", weight: 1 },
        ],
      },
      {
        key: "horizon",
        affects: "quality",
        label: "تبيه يعمّر معك؟",
        choices: [
          { value: "years", label: "سنين", weight: 3 },
          { value: "while", label: "فترة", weight: 2 },
          { value: "now", label: "المهم الحين", weight: 1 },
        ],
      },
      {
        key: "necessity",
        affects: "need",
        label: "محتاجه ولا نفسك فيه؟",
        choices: [
          { value: "need", label: "محتاجه", weight: 3 },
          { value: "between", label: "بين بين", weight: 2 },
          { value: "want", label: "نفسي فيه وبس", weight: 1 },
        ],
      },
    ],
  },

  {
    id: "time",
    emoji: "⏰",
    label: "إدارة وقت",
    hint: "أسوي مهمة X ولا Y الحين؟",
    criteria: [
      { key: "urgency", label: "الاستعجال", low: "يستنى", high: "الوقت يجري" },
      { key: "effort", label: "سهولة الإنجاز", low: "يبي جهد", high: "أخلصها بسرعة" },
      { key: "impact", label: "الفايدة", low: "أثرها بسيط", high: "تفرق فعلاً" },
    ],
    questions: [
      {
        key: "deadline",
        affects: "urgency",
        label: "فيه شي عليه ديدلاين؟",
        choices: [
          { value: "today", label: "اليوم", weight: 3 },
          { value: "week", label: "هالأسبوع", weight: 2 },
          { value: "none", label: "ولا شي", weight: 1 },
        ],
      },
      {
        key: "energy",
        affects: "effort",
        label: "طاقتك الحين؟",
        choices: [
          { value: "low", label: "تعبان", weight: 3 },
          { value: "ok", label: "عادية", weight: 2 },
          { value: "high", label: "نشيط", weight: 1 },
        ],
      },
      {
        key: "goal",
        affects: "impact",
        label: "إيش يهمك أكثر اليوم؟",
        choices: [
          { value: "progress", label: "أتقدم بشي مهم", weight: 3 },
          { value: "balance", label: "أوازن", weight: 2 },
          { value: "clear", label: "أفضّي القائمة", weight: 1 },
        ],
      },
    ],
  },
];

export function getCategory(id) {
  return CATEGORIES.find((c) => c.id === id) ?? null;
}
