// المزاج العام — يُختار في الصفحة الأولى قبل الأسئلة.
//
// أثره الفعلي محدود ومعلن: يضيف +1 لوزن معيار واحد فقط،
// يحدده كل قالب في moodCriteria. ما يخترع نتيجة من فراغ.
//   متحمس / مبسوط  → المعيار الطموح (energy)
//   مرهق            → المعيار الأسهل (ease)
//   هادي            → بدون تعديل

// بلا حقل emoji: الأيقونة تُشتق من الـ id عبر MOOD_ICONS في
// app/components/icons.js، مثل الفئات تماماً. هذا الملف بيانات
// يستوردها الخادم كذلك، فلا JSX فيه.
export const MOODS = [
  {
    id: "hyped",
    label: "متحمس",
    en: "HYPED",
    lean: "energy",
    line: "مزاجك عالي — أميل لك للخيار اللي فيه حركة وتجديد.",
  },
  {
    id: "calm",
    label: "هادي",
    en: "CALM",
    lean: null,
    line: "هادي؟ تمام، بوزنها بالعدل بدون ما أميل لك.",
  },
  {
    id: "drained",
    label: "مرهق",
    en: "DRAINED",
    lean: "ease",
    line: "مرهق اليوم — بميل لك للأسهل والأخف.",
  },
  {
    id: "happy",
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
