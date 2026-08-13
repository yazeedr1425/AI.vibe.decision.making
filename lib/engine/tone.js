// الشخصية المرحة — العنصر الرابط بين كل الميزات.
// وضعان: "مرح" (افتراضي) و"جدي"، مطابقان لقيد tone في جدول profiles.

export const TONES = [
  { id: "مرح", label: "مرح" },
  { id: "جدي", label: "جدي" },
];

export const DEFAULT_TONE = "مرح";

// كانت هذي الجمل تنتهي بإيموجي، وانحذفت بلا بديل: هذي نصوص عادية
// تُعرض كما هي، وما ينحشر داخلها SVG. النبرة المرحة قائمة على
// الصياغة نفسها لا على وجه ضاحك في آخر السطر.
const playful = {
  headline: (winner, reason) => `بصراحة؟ اخترت لك «${winner}»… لأن ${reason}`,
  tie: (winner) => `تعادل حرفياً، بس لازم أختار — فخذ «${winner}»`,
  hesitantPrompt: "لسه متردد؟ خلني أرميها بالحظ… بس حظ موزون",
  hesitantIntro:
    "معك حق تتردد، بس أنا مو هنا أحلها لك — أنا هنا أخليك تحس إنك حليتها بنفسك",
  randomResult: (pick) => `طلعت «${pick}»! ما تعجبك؟ يعني عرفت وش تبي`,
  restart: "يالله من جديد",
};

const serious = {
  headline: (winner, reason) => `التوصية: «${winner}» — ${reason}.`,
  tie: (winner) => `الخياران متعادلان في النتيجة. الترجيح وقع على «${winner}».`,
  hesitantPrompt: "ما زلت مترددًا؟ اختيار عشوائي موزون حسب النتائج.",
  hesitantIntro: "الاختيار العشوائي يعطي الخيار الأعلى فرصة أكبر، لكنه غير مضمون.",
  randomResult: (pick) => `وقع الاختيار على «${pick}».`,
  restart: "ابدأ من جديد",
};

export function voice(tone) {
  return tone === "جدي" ? serious : playful;
}
