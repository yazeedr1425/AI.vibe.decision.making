// إملاء داخل حقل المساعد — إدخال فقط.
//
// هذا كل ما بقي من طبقة الصوت المحذوفة، وعمداً: المحذوف كان النطق
// (التطبيق يتكلم فوق قارئ الشاشة) والدورة التلقائية. أما تحويل
// الكلام لنص فإدخال محض، ما يزاحم أحداً — مستخدم قارئ الشاشة يكتب
// بصوته ويقرأ الرد بقارئه.

export function dictationSupported() {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * يستمع مرة وحدة ويرجّع دالة إيقاف.
 * @param {{lang?: string, onResult: (text: string) => void,
 *          onError?: (code: string) => void, onEnd?: () => void}} handlers
 */
export function listenOnce({ lang = "ar-SA", onResult, onError, onEnd } = {}) {
  if (!dictationSupported()) {
    onError?.("unsupported");
    onEnd?.();
    return () => {};
  }

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new Recognition();
  recognition.lang = lang;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  let settled = false;

  recognition.onresult = (event) => {
    settled = true;
    onResult?.(event.results[0][0].transcript.trim());
  };

  recognition.onerror = (event) => {
    settled = true;
    onError?.(event.error ?? "unknown");
  };

  // onend بلا نتيجة يعني ما سمع شيئاً — بدون هذا يعلق الزر على
  // "أسمعك…" للأبد
  recognition.onend = () => {
    if (!settled) onError?.("no-speech");
    onEnd?.();
  };

  try {
    recognition.start();
  } catch {
    onError?.("start-failed");
    onEnd?.();
  }

  return () => {
    try {
      recognition.abort();
    } catch {
      /* المتصفح أغلقه أصلاً */
    }
  };
}
