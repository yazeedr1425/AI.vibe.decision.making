"use client";

import { useEffect } from "react";
import { useVoice } from "@/lib/voice/VoiceProvider";

// نتجاهل الاختصارات وقت الكتابة حتى لا تُسرق حروف المستخدم
function isTyping(target) {
  const tag = target?.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || target?.isContentEditable;
}

// اختصار حرف M يُعالج داخل Landing لأنه يخص حقول الخيارات
export default function VoiceControls({ onVoiceMode }) {
  const { readAloud, toggleReadAloud, repeat, tts } = useVoice();

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const key = e.key.toLowerCase();

      if (key === "s") {
        e.preventDefault();
        toggleReadAloud();
      } else if (key === "r") {
        e.preventDefault();
        repeat();
      } else if (key === "v") {
        e.preventDefault();
        onVoiceMode?.();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleReadAloud, repeat, onVoiceMode]);

  if (!tts) return null;

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={toggleReadAloud}
        aria-pressed={readAloud}
        aria-label="تشغيل أو إيقاف القراءة الصوتية — اختصار حرف S"
        title="القراءة الصوتية (S)"
        className={
          "rounded-full border px-3 py-1 text-xs transition-colors " +
          (readAloud
            ? "border-foreground bg-accent text-accent-ink"
            : "border-line bg-card hover:border-foreground/40")
        }
      >
        {readAloud ? "🔊" : "🔇"}
      </button>

      <button
        type="button"
        onClick={repeat}
        aria-label="أعد قراءة الشاشة الحالية — اختصار حرف R"
        title="أعد القراءة (R)"
        className="rounded-full border border-line bg-card px-3 py-1 text-xs transition-colors hover:border-foreground/40"
      >
        🔁
      </button>
    </div>
  );
}
