"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import VoiceShortcuts from "./VoiceShortcuts";

// صفحات فقط. «سجل القرارات» و«أمثلة» انحذفا لأنهما مرساتان داخل
// الرئيسية لا وجهتان: القفز لوسط صفحة أخرى ليس تنقّلاً، والخلط
// بينهما يخلي المستخدم ما يدري وين بيوديه الرابط.
//
// القسمان باقيان في مكانهما، ورابط السجل باقٍ في الفوتر. ومرساة
// ‎/#examples‎ باقية كذلك رغم أن لا شيء يشير إليها الآن — الرابط
// المحفوظ عند أحدهم لازم يظل يشتغل.
const LINKS = [
  { href: "/how", label: "كيف يعمل" },
  { href: "/plan", label: "خطة اليوم" },
  { href: "/analyze", label: "تحليل المخاطر" },
];

// المعالجات اختيارية: الصفحة الرئيسية تمرّرها لأنها تدير حالة الخطوات،
// وأي صفحة أخرى تكتفي بالتنقّل للرئيسية.
// نافذة تأكيد الخروج — كافية للضغطة الثانية المقصودة، وقصيرة بما
// يكفي حتى ترجع الزر لحاله لو كانت الأولى بالغلط
const CONFIRM_MS = 4000;

export default function SiteNav({ onHome, onVoiceMode, onSignIn, onStart }) {
  const { user, signOut } = useAuth();
  const router = useRouter();

  // خروج بضغطتين بدل نافذة تأكيد: الأولى تسلّح الزر («متأكد؟»)
  // والثانية تنفذ. confirm() الأصلية بواجهة المتصفح الإنجليزية
  // نشاز وسط التصميم، والمودال حمل زائد لقرار بهذا الحجم.
  const [confirmingOut, setConfirmingOut] = useState(false);
  const revertTimer = useRef(null);

  useEffect(() => () => clearTimeout(revertTimer.current), []);

  // الشريط يتحول عند التمرير: ملتصق شفاف في الأعلى، وحبّة عائمة
  // مضبّبة بعد النزول. شريط التقدم يُحرَّك على الـ DOM مباشرة —
  // حالة React لكل بكسل تمرير تعني رندر لكل بكسل.
  const [scrolled, setScrolled] = useState(false);
  const progressRef = useRef(null);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setScrolled(window.scrollY > 24);
        const doc = document.documentElement;
        const max = doc.scrollHeight - window.innerHeight;
        const ratio = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
        if (progressRef.current)
          progressRef.current.style.transform = `scaleX(${ratio})`;
      });
    };

    // النداء الأول عبر rAF حتى تصح الحالة لو فُتحت الصفحة وسط تمرير
    // محفوظ، بلا setState متزامن داخل جسم الإيفكت
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const handleSignOut = () => {
    if (!confirmingOut) {
      setConfirmingOut(true);
      revertTimer.current = setTimeout(
        () => setConfirmingOut(false),
        CONFIRM_MS,
      );
      return;
    }
    clearTimeout(revertTimer.current);
    setConfirmingOut(false);
    signOut();
  };

  const goHome = onHome ?? (() => router.push("/"));
  const startDeciding = onStart ?? (() => router.push("/"));
  const signIn = onSignIn ?? (() => router.push("/login"));
  const openVoice = onVoiceMode ?? (() => router.push("/"));

  return (
    <header className="sticky top-0 z-40">
      {/* خيط التقدم: ينمو من اليمين لأن القراءة كذلك */}
      <div
        aria-hidden
        ref={progressRef}
        className="absolute inset-x-0 top-0 z-50 h-0.5 origin-right bg-accent"
        style={{ transform: "scaleX(0)" }}
      />

      <div
        className={
          "mx-auto transition-all duration-500 " +
          (scrolled
            ? "card-shadow mt-3 max-w-4xl rounded-full border border-line bg-card/85 px-3 backdrop-blur-md"
            : "max-w-6xl bg-transparent px-4 sm:px-6")
        }
      >
        <nav
          className={
            "flex w-full items-center justify-between gap-4 transition-all duration-500 " +
            (scrolled ? "px-2 py-2" : "py-4")
          }
        >
          {/* الشعار والروابط يبدآن من اليمين ويتدفقان لليسار.
              كانت الروابط مجمّعة مع الأزرار فتنطّ لأقصى اليسار،
              ويطلع فراغ كبير بعد الشعار مباشرة. */}
          <div className="flex items-center gap-2 sm:gap-6">
            <button
              type="button"
              onClick={goHome}
              className="flex items-center gap-2.5"
              aria-label="احسم — الصفحة الرئيسية"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-lg font-bold text-accent-ink">
                حـ
              </span>
              <span
                className={
                  "text-lg font-semibold transition-opacity duration-500 " +
                  (scrolled ? "hidden sm:inline" : "")
                }
              >
                احسم
              </span>
            </button>

            {/* تظهر من lg وفوق. كانت md، وبعد ما صارت الروابط خمسة
                ضاق الشريط عند 768 بالضبط: تنكسر الروابط على سطرين
                ويتضاعف ارتفاع الهيدر. */}
            <ul className="hidden items-center gap-1 lg:flex">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="rounded-full px-3 py-2 text-sm text-muted transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* الحساب في الطرف المقابل. زرّا القراءة الصوتية انحذفا،
              واختصاراتهما باقية في VoiceShortcuts (ما يرسم شيئاً). */}
          <div className="flex items-center gap-1 sm:gap-2">
            <VoiceShortcuts onVoiceMode={openVoice} />

            {user ? (
              <>
                <Link
                  href="/settings"
                  className="hidden rounded-full border border-line-strong px-4 py-2 text-sm transition-colors hover:border-ink sm:inline-flex"
                >
                  الإعدادات
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  title={user.email}
                  aria-live="polite"
                  className={
                    "rounded-full border px-4 py-2 text-sm transition-colors " +
                    (confirmingOut
                      ? "border-accent bg-accent-soft font-medium text-accent-strong"
                      : "border-line-strong hover:border-ink")
                  }
                >
                  {confirmingOut ? "متأكد؟ اضغط ثاني" : "خروج"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={signIn}
                className="rounded-full border border-line-strong px-4 py-2 text-sm transition-colors hover:border-ink"
              >
                دخول
              </button>
            )}

            <button
              type="button"
              onClick={startDeciding}
              className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-on-ink transition-opacity hover:opacity-85"
            >
              ابدأ الآن
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
}
