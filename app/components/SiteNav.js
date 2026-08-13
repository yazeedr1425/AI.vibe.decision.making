"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import VoiceControls from "./VoiceControls";

const LINKS = [
  { href: "/how", label: "كيف يعمل" },
  { href: "/#examples", label: "أمثلة" },
  { href: "/#history", label: "سجل القرارات" },
];

// المعالجات اختيارية: الصفحة الرئيسية تمرّرها لأنها تدير حالة الخطوات،
// وأي صفحة أخرى تكتفي بالتنقّل للرئيسية.
export default function SiteNav({ onHome, onVoiceMode, onSignIn, onStart }) {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const goHome = onHome ?? (() => router.push("/"));
  const startDeciding = onStart ?? (() => router.push("/"));
  const signIn = onSignIn ?? (() => router.push("/login"));
  const openVoice = onVoiceMode ?? (() => router.push("/"));

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-background/85 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* الشعار — يمين في الاتجاه العربي */}
        <button
          type="button"
          onClick={goHome}
          className="flex items-center gap-2.5"
          aria-label="احسم — الصفحة الرئيسية"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-lg font-bold text-accent-ink">
            حـ
          </span>
          <span className="text-lg font-semibold">احسم</span>
        </button>

        <div className="flex items-center gap-1 sm:gap-2">
          <ul className="hidden items-center gap-1 md:flex">
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

          <VoiceControls onVoiceMode={openVoice} />

          {user ? (
            <>
              <Link
                href="/settings"
                className="hidden rounded-full border border-line bg-card px-4 py-2 text-sm transition-colors hover:border-muted-soft sm:inline-flex"
              >
                الإعدادات
              </Link>
              <button
                type="button"
                onClick={signOut}
                title={user.email}
                className="rounded-full border border-line bg-card px-4 py-2 text-sm transition-colors hover:border-muted-soft"
              >
                خروج
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={signIn}
              className="rounded-full border border-line bg-card px-4 py-2 text-sm transition-colors hover:border-muted-soft"
            >
              دخول
            </button>
          )}

          <button
            type="button"
            onClick={startDeciding}
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85"
          >
            ابدأ الآن
          </button>
        </div>
      </nav>
    </header>
  );
}
