"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { speak, stopSpeaking, sttSupported, ttsSupported } from "./speech";

const VoiceContext = createContext(null);
const STORAGE_KEY = "ahsem:readAloud";

// ---------------------------------------------------------------
// مخزن خارجي بسيط لتفضيل القراءة الصوتية.
// نستخدم useSyncExternalStore بدل setState داخل useEffect حتى
// يتعامل React مع فرق الخادم/المتصفح بنفسه بدون رندر متتالٍ.
// ---------------------------------------------------------------

let readAloudState = false;
let hydrated = false;
const listeners = new Set();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    readAloudState = window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    /* التخزين ممنوع — نبقى على الافتراضي */
  }
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  hydrate();
  return readAloudState;
}

function getServerSnapshot() {
  return false;
}

function writeReadAloud(next) {
  readAloudState = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    /* تجاهل */
  }
  listeners.forEach((l) => l());
}

// القدرات ثابتة بعد التحميل، فتكفي لقطة واحدة
const noopSubscribe = () => () => {};

export function VoiceProvider({ children }) {
  const readAloud = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const tts = useSyncExternalStore(noopSubscribe, ttsSupported, () => false);
  const stt = useSyncExternalStore(noopSubscribe, sttSupported, () => false);

  const lastText = useRef("");

  const toggleReadAloud = useCallback(() => {
    const next = !readAloudState;
    if (!next) stopSpeaking();
    writeReadAloud(next);
  }, []);

  // تُستدعى عند كل شاشة — تقرأ فقط لو المستخدم مفعّل القراءة
  const announce = useCallback(
    (text) => {
      lastText.current = text ?? "";
      if (readAloud && text) speak(text);
    },
    [readAloud]
  );

  // زر "أعد قراءة الشاشة" — يقرأ حتى لو القراءة التلقائية مطفية
  const repeat = useCallback(() => {
    if (lastText.current) speak(lastText.current);
  }, []);

  const value = useMemo(
    () => ({ readAloud, toggleReadAloud, announce, repeat, stop: stopSpeaking, tts, stt }),
    [readAloud, toggleReadAloud, announce, repeat, tts, stt]
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

export function useVoice() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice must be used inside <VoiceProvider>");
  return ctx;
}

/** يقرأ ملخص الشاشة كل ما تغيّر النص */
export function useScreenAnnounce(text) {
  const { announce } = useVoice();
  useEffect(() => {
    if (text) announce(text);
  }, [text, announce]);
}
