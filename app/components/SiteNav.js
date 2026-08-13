"use client";

import { useAuth } from "@/lib/auth/AuthProvider";
import VoiceControls from "./VoiceControls";

const LINKS = [
  { id: "how", label: "كيف يعمل" },
  { id: "examples", label: "أمثلة" },
  { id: "history", label: "سجل القرارات" },
];

export default function SiteNav({ onHome, onVoiceMode, onSignIn, onStart }) {
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-background/85 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* الشعار — يمين في الاتجاه العربي */}
        <button
          type="button"
          onClick={onHome}
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
              <li key={l.id}>
                <a
                  href={`#${l.id}`}
                  className="rounded-full px-3 py-2 text-sm text-muted transition-colors hover:text-foreground"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>

          <VoiceControls onVoiceMode={onVoiceMode} />

          {user ? (
            <button
              type="button"
              onClick={signOut}
              title={user.email}
              className="rounded-full border border-line bg-card px-4 py-2 text-sm transition-colors hover:border-muted-soft"
            >
              خروج
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="rounded-full border border-line bg-card px-4 py-2 text-sm transition-colors hover:border-muted-soft"
            >
              دخول
            </button>
          )}

          <button
            type="button"
            onClick={onStart}
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85"
          >
            ابدأ الآن
          </button>
        </div>
      </nav>
    </header>
  );
}
