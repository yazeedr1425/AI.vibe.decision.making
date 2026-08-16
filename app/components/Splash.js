"use client";

import { useEffect, useState } from "react";

// الظهور ثم الانسحاب. لون واحد ثابت ما يحتاج وقتاً ليُقرأ، فالمدة
// رجعت لحدّ اللمسة: تكفي لتثبيت العلامة وما تتحول لانتظار.
const HOLD_MS = 1600;
const FADE_MS = 450;
// مع تعطيل الحركة في النظام: نمر سريعاً بدل ما نلغيها كلياً، حتى
// ما تقفز الصفحة فجأة من سواد إلى محتوى
const REDUCED_HOLD_MS = 400;

/**
 * الشاشة الافتتاحية.
 *
 * تُركّب في التخطيط الجذري، فتظهر عند التحميل الكامل فقط — تنقّل
 * App Router بين الصفحات ما يفكّ التخطيط، فما تتكرر مع كل ضغطة
 * رابط. وهذا المطلوب: مرة عند الدخول، لا مرة كل صفحة.
 *
 * تُرسم من الخادم ضمن أول HTML، فتغطي الشاشة قبل أي جافاسكربت —
 * لو انتظرنا التركيب لبان المحتوى أولاً ثم غطّيناه، وهذا أسوأ من
 * لا شيء.
 */
export default function Splash() {
  const [phase, setPhase] = useState("visible");

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const hold = reduced ? REDUCED_HOLD_MS : HOLD_MS;

    // ضبط الحالة داخل المؤقّت لا في جسم الأثر — القاعدة المفروضة
    // في المشروع، وأيضاً يخلي التركيب المزدوج في StrictMode يلغي
    // مؤقّته وينشئ غيره بلا أثر مرئي
    const toFading = setTimeout(() => setPhase("fading"), hold);
    const toGone = setTimeout(() => setPhase("gone"), hold + FADE_MS);

    return () => {
      clearTimeout(toFading);
      clearTimeout(toGone);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    // aria-hidden لأنها زخرفة محضة: قارئ الشاشة ما ينتظر معها شيئاً،
    // والمحتوى الحقيقي تحتها جاهز أصلاً في الـ DOM
    <div
      aria-hidden
      className={"splash" + (phase === "fading" ? " splash-out" : "")}
      // مصدر واحد لمدة الشريط: ثابت وقت الرندر فيتطابق الخادم
      // والمتصفح، ويتبع HOLD_MS لو تغيّر
      style={{ "--splash-hold": `${HOLD_MS}ms` }}
    >
      <div className="splash-tint flex flex-col items-center gap-5">
        <span className="splash-mark flex h-20 w-20 items-center justify-center rounded-[1.4rem] text-4xl font-bold">
          <span className="text-[color:var(--accent-ink)]">حـ</span>
        </span>

        <span className="text-2xl font-bold text-[color:var(--on-ink)]">
          احسم
        </span>

        <span className="splash-bar h-px w-28 overflow-hidden bg-[color:var(--line-ink)]">
          <span className="block h-full w-full" />
        </span>
      </div>
    </div>
  );
}
