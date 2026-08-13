"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ArrowLeft, CircleCheck } from "./icons";

const MIN_PASSWORD = 6;

export default function AuthPanel({ mode = "signin" }) {
  const { signIn, signUp } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const isSignUp = mode === "signup";

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    const result = isSignUp
      ? await signUp(email.trim(), password, displayName)
      : await signIn(email.trim(), password);

    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    // تأكيد الإيميل مفعّل: ما فيه جلسة إلا بعد ما يضغط الرابط
    if (result.needsConfirmation) {
      setNotice(
        `أرسلنا رابط تأكيد إلى ${email.trim()}. افتحه، وبعدها سجّل دخولك.`,
      );
      return;
    }

    router.push("/");
  };

  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-4 py-14 sm:px-6"
    >
      <header className="flex flex-col gap-2 text-center">
        <Link href="/" className="mx-auto mb-2 flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-lg font-bold text-accent-ink">
            حـ
          </span>
          <span className="text-lg font-semibold">احسم</span>
        </Link>
        <h1 className="text-3xl font-semibold">
          {isSignUp ? "أنشئ حسابك" : "سجّل دخولك"}
        </h1>
        <p className="text-sm text-muted">
          {isSignUp
            ? "عشان نحفظ قراراتك، ونتعلم من عاداتك مع الوقت."
            : "رجعت؟ خلنا نكمل من وين وقفت."}
        </p>
      </header>

      <form
        onSubmit={submit}
        className="card-shadow flex flex-col gap-4 rounded-2xl border border-line bg-card p-6"
      >
        {isSignUp && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">الاسم</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              maxLength={60}
              placeholder="كيف تحب نناديك؟"
              className="rounded-xl border border-line bg-background px-4 py-3 outline-none transition-colors focus:border-accent"
            />
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">الإيميل</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-line bg-background px-4 py-3 outline-none transition-colors focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">كلمة المرور</span>
          <input
            type="password"
            required
            minLength={MIN_PASSWORD}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-line bg-background px-4 py-3 outline-none transition-colors focus:border-accent"
          />
          {isSignUp && (
            <span className="text-xs text-muted-soft">
              {MIN_PASSWORD} أحرف على الأقل.
            </span>
          )}
        </label>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-dashed border-line px-4 py-3 text-sm"
          >
            ⚠️ {error}
          </p>
        )}

        {notice && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent-strong"
          >
            <CircleCheck size={18} className="mt-0.5 shrink-0" />
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-1 flex items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-3.5 font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "…" : isSignUp ? "أنشئ الحساب" : "دخول"}
          {!busy && <ArrowLeft size={18} />}
        </button>
      </form>

      <p className="text-center text-sm text-muted">
        {isSignUp ? "عندك حساب؟ " : "ما عندك حساب؟ "}
        <Link
          href={isSignUp ? "/login" : "/signup"}
          className="text-accent-strong underline underline-offset-4"
        >
          {isSignUp ? "سجّل دخولك" : "أنشئ واحد"}
        </Link>
      </p>

      <p className="text-center text-xs text-muted-soft">
        تقدر تستخدم احسم بدون حساب — الحساب فقط عشان يُحفظ سجلك.
      </p>
    </main>
  );
}
