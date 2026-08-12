// المزاج العام — يُختار في الصفحة الأولى قبل الأسئلة.
//
// أثره الفعلي محدود ومعلن: يضيف +1 لوزن معيار واحد فقط،
// يحدده كل قالب في moodCriteria. ما يخترع نتيجة من فراغ.
//   متحمس / مبسوط  → المعيار الطموح (energy)
//   مرهق            → المعيار الأسهل (ease)
//   هادي            → بدون تعديل

export const MOODS = [
  {
    id: "hyped",
    emoji: "🔥",
    label: "متحمس",
    en: "HYPED",
    lean: "energy",
    line: "مزاجك عالي — أميل لك للخيار اللي فيه حركة وتجديد.",
  },
  {
    id: "calm",
    emoji: "😌",
    label: "هادي",
    en: "CALM",
    lean: null,
    line: "هادي؟ تمام، بوزنها بالعدل بدون ما أميل لك.",
  },
  {
    id: "drained",
    emoji: "🌙",
    label: "مرهق",
    en: "DRAINED",
    lean: "ease",
    line: "مرهق اليوم — بميل لك للأسهل والأخف.",
  },
  {
    id: "happy",
    emoji: "🎉",
    label: "مبسوط",
    en: "HAPPY",
    lean: "energy",
    line: "مبسوط؟ خل نستغلها ونجرب شي يستاهل.",
  },
];

export function getMood(id) {
  return MOODS.find((m) => m.id === id) ?? null;
}

// المعيار اللي تأثر بالمزاج — أو null لو المزاج محايد أو غير مختار
export function moodTarget(category, moodId) {
  const mood = getMood(moodId);
  if (!mood?.lean || !category?.moodCriteria) return null;
  return category.moodCriteria[mood.lean] ?? null;
}
