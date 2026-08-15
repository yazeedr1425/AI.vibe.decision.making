// تطبيع النص العربي قبل أي مقارنة.
//
// كان يعيش في lib/voice/match.js لأن التعرف على الكلام أول من احتاجه،
// لكنه ما له علاقة بالصوت: المقارنة بين خيارين مكتوبين تحتاجه بنفس
// القدر — "أطلب" و"اطلب" و"أطلُب" شي واحد. بقي هنا بعد حذف الصوت
// لأن نصف المشروع يستعمله (الإحصاء، المفاضلات، التصويت الجماعي).

const DIACRITICS = /[ً-ْٰـ]/g;

export function normalizeArabic(input = "") {
  return input
    .toString()
    .normalize("NFKC")
    .replace(DIACRITICS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
