"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { GhostButton, PrimaryButton, SectionHeading, Tag } from "./ui";

export default function AuthPanel({ onDone }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    const result =
      mode === "signin"
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password);

    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (result.needsConfirmation) {
      setNotice("أرسلنا لك رابط تأكيد على إيميلك. أكّده وبعدها سجّل دخولك.");
      return;
    }
    onDone?.();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <SectionHeading
        tag={mode === "signin" ? "sign in" : "create account"}
        title={mode === "signin" ? "سجّل دخولك" : "أنشئ حسابك"}
        sub="عشان نحفظ قراراتك ونتعلم من عاداتك."
      />

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">الإيميل</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-line bg-card px-4 py-3 outline-none transition-colors focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">كلمة المرور</span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-line bg-card px-4 py-3 outline-none transition-colors focus:border-accent"
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-dashed border-line bg-card px-4 py-3 text-sm">
          ⚠️ {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl border border-dashed border-line bg-card px-4 py-3 text-sm">
          📩 {notice}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton type="submit" disabled={busy}>
          {busy ? "…" : mode === "signin" ? "دخول" : "إنشاء حساب"}
        </PrimaryButton>
        <GhostButton
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setNotice(null);
          }}
        >
          {mode === "signin" ? "ما عندي حساب" : "عندي حساب"}
        </GhostButton>
      </div>

      <Tag>your data stays yours</Tag>
    </form>
  );
}
