// مطابقة الكلام المنطوق بالخيارات والإجابات.
// التعرف على الكلام يرجّع نصاً حراً، فنحتاج تطبيع عربي قبل أي مقارنة.

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

const ORDINALS = [
  { words: ["الاول", "اول", "واحد", "1", "رقم واحد"], index: 0 },
  { words: ["الثاني", "ثاني", "اثنين", "2", "رقم اثنين"], index: 1 },
  { words: ["الثالث", "ثالث", "ثلاثه", "3", "رقم ثلاثه"], index: 2 },
  { words: ["الرابع", "رابع", "اربعه", "4", "رقم اربعه"], index: 3 },
  { words: ["الخامس", "خامس", "خمسه", "5", "رقم خمسه"], index: 4 },
];

export function matchOrdinal(transcript, length) {
  const text = normalizeArabic(transcript);
  for (const { words, index } of ORDINALS) {
    if (index >= length) continue;
    if (words.some((w) => text.split(" ").includes(normalizeArabic(w)))) return index;
  }
  return -1;
}

// تداخل الكلمات — نحسبه في الاتجاهين.
// "مستعجل" مقابل "مستعجل، أبغى شي سريع": اتجاه واحد يعطي 0.25 فقط،
// بينما نسبة كلمات المنطوق الموجودة في العبارة = 1، وهو المقصود.
function overlapScore(spoken, candidate) {
  const a = normalizeArabic(spoken).split(" ").filter(Boolean);
  const b = normalizeArabic(candidate).split(" ").filter(Boolean);
  if (!a.length || !b.length) return 0;

  const setA = new Set(a);
  const setB = new Set(b);
  const candidateCovered = b.filter((w) => setA.has(w)).length / b.length;
  const spokenCovered = a.filter((w) => setB.has(w)).length / a.length;
  return Math.max(candidateCovered, spokenCovered);
}

/**
 * يطابق المنطوق بأحد العناصر.
 * @param {string} transcript
 * @param {Array<{value: string, labels: string[]}>} candidates
 * @returns {string|null} value المطابق
 */
export function matchCandidate(transcript, candidates, { minScore = 0.5 } = {}) {
  if (!transcript) return null;
  const spoken = normalizeArabic(transcript);

  // مطابقة كاملة أولاً
  for (const c of candidates) {
    if (c.labels.some((l) => normalizeArabic(l) === spoken)) return c.value;
  }

  // ثم احتواء مباشر
  for (const c of candidates) {
    if (c.labels.some((l) => l && spoken.includes(normalizeArabic(l)))) return c.value;
  }

  // ثم أعلى تداخل كلمات
  let best = null;
  let bestScore = 0;
  for (const c of candidates) {
    const score = Math.max(...c.labels.map((l) => overlapScore(transcript, l)), 0);
    if (score > bestScore) {
      bestScore = score;
      best = c.value;
    }
  }
  return bestScore >= minScore ? best : null;
}

// ملاحظة: \b في JavaScript مبني على الحروف اللاتينية، فما يشتغل مع
// العربية إطلاقاً. لذلك نعتمد على المسافات صراحةً حول كلمات الفصل.
const SPLITTERS = /\s*(?:،|,|\/|\n)\s*|\s+(?:أو|او|ولا|ثم)\s+/g;

/**
 * يفصل جملة منطوقة إلى خيارات: "برجر أو سوشي ولا أطبخ بالبيت"
 */
export function parseSpokenOptions(transcript, { max = 5 } = {}) {
  if (!transcript) return [];

  return transcript
    .split(SPLITTERS)
    .map((part) => part.trim())
    .filter(Boolean)
    // نحذف المكرر بعد التطبيع مع الاحتفاظ بالنص الأصلي
    .filter((part, i, all) => {
      const key = normalizeArabic(part);
      return key && all.findIndex((p) => normalizeArabic(p) === key) === i;
    })
    .slice(0, max);
}

// أوامر عامة أثناء المحادثة.
// نقارن على مستوى الكلمات بعد التطبيع (أ→ا، ة→ه) بدل \b غير الصالح للعربية.
const COMMAND_WORDS = {
  back: ["رجوع", "ارجع", "السابق"],
  repeat: ["اعد", "كرر", "اعيد"],
  stop: ["توقف", "وقف", "الغاء", "خلاص", "بس"],
};

const COMMAND_PHRASES = {
  repeat: ["مره ثانيه", "ما فهمت", "عيد عليي"],
};

export function matchCommand(transcript) {
  const text = normalizeArabic(transcript);
  if (!text) return null;

  const tokens = text.split(" ").filter(Boolean);
  // الجملة كاملة لازم تكون أمراً — حتى لا نبتلع خياراً اسمه "خلاص"
  if (tokens.length <= 2) {
    for (const [command, words] of Object.entries(COMMAND_WORDS)) {
      if (tokens.some((t) => words.includes(t))) return command;
    }
  }

  for (const [command, phrases] of Object.entries(COMMAND_PHRASES)) {
    if (phrases.some((p) => text.includes(normalizeArabic(p)))) return command;
  }

  return null;
}
