// غلاف رقيق حول Web Speech API.
// كل شي هنا يشتغل في المتصفح فقط — تُستدعى داخل useEffect أو معالجات أحداث.

export const VOICE_LANG = "ar-SA";

export function ttsSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function sttSupported() {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

let currentUtterance = null;

export function speak(text, { lang = VOICE_LANG, rate = 1, onEnd } = {}) {
  if (!ttsSupported() || !text) {
    onEnd?.();
    return () => {};
  }

  // نوقف أي قراءة سابقة حتى ما تتداخل الأصوات
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = rate;

  // نفضّل صوت عربي لو متوفر، وإلا نخلي المتصفح يختار
  const arabic = window.speechSynthesis
    .getVoices()
    .find((v) => v.lang?.toLowerCase().startsWith("ar"));
  if (arabic) utterance.voice = arabic;

  utterance.onend = () => {
    currentUtterance = null;
    onEnd?.();
  };
  utterance.onerror = () => {
    currentUtterance = null;
    onEnd?.();
  };

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);

  return () => {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  };
}

export function stopSpeaking() {
  if (ttsSupported()) window.speechSynthesis.cancel();
  currentUtterance = null;
}

/**
 * يشغّل التعرف على الكلام مرة واحدة ويرجّع دالة إيقاف.
 * onError يستقبل: 'not-allowed' | 'no-speech' | 'unsupported' | غيرها
 */
export function listenOnce({ lang = VOICE_LANG, onResult, onError, onStart, onEnd } = {}) {
  if (!sttSupported()) {
    onError?.("unsupported");
    onEnd?.();
    return () => {};
  }

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new Recognition();
  recognition.lang = lang;
  recognition.interimResults = false;
  recognition.maxAlternatives = 3;
  recognition.continuous = false;

  let settled = false;

  recognition.onstart = () => onStart?.();

  recognition.onresult = (event) => {
    settled = true;
    const alternatives = [...event.results[0]].map((r) => r.transcript.trim());
    onResult?.(alternatives[0] ?? "", alternatives);
  };

  recognition.onerror = (event) => {
    settled = true;
    onError?.(event.error ?? "unknown");
  };

  recognition.onend = () => {
    if (!settled) onError?.("no-speech");
    onEnd?.();
  };

  try {
    recognition.start();
  } catch (err) {
    onError?.(err?.message ?? "start-failed");
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
