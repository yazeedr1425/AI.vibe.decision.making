"use client";

import { useEffect } from "react";
import { useVoice } from "@/lib/voice/VoiceProvider";

// نتجاهل الاختصارات وقت الكتابة حتى لا تُسرق حروف المستخدم
function isTyping(target) {
  const tag = target?.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || target?.isContentEditable;
}

/**
 * اختصارات الصوت فقط — بلا أي عنصر مرئي.
 *
 * كان هذا المكوّن يرسم زرّي القراءة والإعادة في الهيدر وانحذفا. الاختصارات
 * بقيت عمداً: القراءة الصوتية تشتغل فعلاً (QuestionStep و Result
 * ينادون useScreenAnnounce)، و readAloud هو اللي يقرر تنطق أو لا.
 * صفحة الإعدادات تضبط نفس التفضيل لكنها تحتاج تسجيل دخول، فحذف
 * الاختصارات معها كان بيترك الزائر غير المسجّل بلا أي طريقة يشغّل
 * القراءة أو يعيدها — وهي أصلاً ميزة مبنية لمن لا يرى الأزرار.
 *
 * S: تشغيل/إيقاف القراءة · R: أعد قراءة الشاشة · V: المحادثة الصوتية
 * (حرف M داخل Landing لأنه يخص حقول الخيارات)
 * وكلها موثّقة في صفحة «كيف يعمل».
 */
export default function VoiceShortcuts({ onVoiceMode }) {
  const { toggleReadAloud, repeat } = useVoice();

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

  return null;
}
