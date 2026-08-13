"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MOODS } from "@/lib/engine/mood";
import { TONES } from "@/lib/engine/tone";
import { profileService } from "@/lib/services/profile";
import { useMoodTheme } from "@/lib/theme/useMoodTheme";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useVoice } from "@/lib/voice/VoiceProvider";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import {
  ArrowLeft,
  CircleCheck,
  MoodIcon,
  TriangleAlert,
} from "../components/icons";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { setReadAloud, tts } = useVoice();

  const [loaded, setLoaded] = useState(null); // { profile, email } بعد الجلب
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!user) return;
    let active = true;

    profileService.get().then((result) => {
      if (!active) return;
      if (result.ok) {
        setLoaded({
          userId: user.id,
          profile: result.profile,
          email: result.email,
        });
        setForm({
          display_name: result.profile.display_name ?? "",
          tone: result.profile.tone ?? TONES[0].id,
          read_aloud: Boolean(result.profile.read_aloud),
          default_mood: result.profile.default_mood ?? null,
        });
        // البروفايل هو المرجع — نطابق تفضيل القراءة عليه
        setReadAloud(Boolean(result.profile.read_aloud));
      } else {
        setLoaded({
          userId: user.id,
          error: result.message ?? "تعذر جلب بروفايلك.",
        });
      }
    });

    return () => {
      active = false;
    };
  }, [user, setReadAloud]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);

    const result = await profileService.update({
      display_name: form.display_name.trim() || null,
      tone: form.tone,
      read_aloud: form.read_aloud,
      default_mood: form.default_mood,
    });

    setSaving(false);
    if (result.ok) {
      setReadAloud(form.read_aloud);
      setStatus({ ok: true, message: "انحفظت إعداداتك." });
    } else {
      setStatus({
        ok: false,
        message: result.message ?? "ما انحفظت — جرب مرة ثانية.",
      });
    }
  };

  // معاينة حيّة: أول ما تختار مزاجاً يتلوّن الموقع كله، قبل الحفظ.
  // بدونها كنت تختار وما يتغير شي، فتحس إن الإعداد ما اشتغل.
  useMoodTheme(form?.default_mood ?? null);

  const ready = user && form && loaded?.userId === user.id;

  return (
    <>
      <SiteNav />

      <main
        id="main"
        className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14"
      >
        <header className="flex flex-col gap-2">
          <span lang="en" className="tag">
            settings
          </span>
          <h1 className="text-3xl font-semibold sm:text-4xl">الإعدادات</h1>
          <p className="text-muted">
            تفضيلاتك تنحفظ في حسابك، فتلاقيها على أي جهاز تدخل منه.
          </p>
        </header>

        {authLoading && (
          <div className="h-40 animate-pulse rounded-2xl border border-line bg-card" />
        )}

        {!authLoading && !user && (
          <div className="rounded-2xl border border-dashed border-line bg-card p-6 text-center">
            <p className="font-medium">الإعدادات تحتاج تسجيل دخول.</p>
            <p className="mt-1 text-sm text-muted">
              بدون حساب، تفضيلاتك تبقى على هذا المتصفح فقط.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85"
            >
              دخول
            </Link>
          </div>
        )}

        {!authLoading && user && loaded?.error && (
          <p className="flex items-center gap-2 rounded-2xl border border-dashed border-line bg-card p-5 text-sm text-muted">
            <TriangleAlert size={16} />
            {loaded.error}
          </p>
        )}

        {!authLoading && user && !loaded && (
          <div className="h-64 animate-pulse rounded-2xl border border-line bg-card" />
        )}

        {ready && (
          <form onSubmit={save} className="flex flex-col gap-6">
            {/* الحساب */}
            <section className="card-shadow flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 sm:p-6">
              <h2 className="font-semibold">الحساب</h2>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm text-muted">الاسم</span>
                <input
                  value={form.display_name}
                  onChange={(e) =>
                    setForm({ ...form, display_name: e.target.value })
                  }
                  maxLength={60}
                  placeholder="اسمك"
                  className="rounded-xl border border-line bg-background px-4 py-3 outline-none transition-colors focus:border-accent"
                />
              </label>

              <p className="text-sm text-muted">
                الإيميل: <span className="text-foreground">{loaded.email}</span>
              </p>
            </section>

            {/* نبرة الرد */}
            <section className="card-shadow flex flex-col gap-3 rounded-2xl border border-line bg-card p-5 sm:p-6">
              <h2 className="font-semibold">نبرة الرد</h2>
              <p className="text-sm text-muted">
                تحدد أسلوب شرح النتيجة — مرح فيه خفة دم، وجدي مباشر.
              </p>
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setForm({ ...form, tone: t.id })}
                    className={
                      "rounded-full border px-4 py-2 text-sm transition-colors " +
                      (form.tone === t.id
                        ? "border-accent bg-accent text-accent-ink"
                        : "border-line hover:border-muted-soft")
                    }
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </section>

            {/* المزاج الافتراضي */}
            <section className="card-shadow flex flex-col gap-3 rounded-2xl border border-line bg-card p-5 sm:p-6">
              <h2 className="font-semibold">المزاج الافتراضي</h2>
              <p className="text-sm text-muted">
                يُختار لك تلقائياً عند فتح التطبيق — ويغيّر لون الصفحة ووزن
                معيار واحد. تقدر تغيّره وقت أي قرار.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, default_mood: null })}
                  className={
                    "rounded-full border px-4 py-2 text-sm transition-colors " +
                    (form.default_mood === null
                      ? "border-accent bg-accent text-accent-ink"
                      : "border-line hover:border-muted-soft")
                  }
                >
                  بدون
                </button>
                {MOODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setForm({ ...form, default_mood: m.id })}
                    className={
                      "flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors " +
                      (form.default_mood === m.id
                        ? "border-accent bg-accent text-accent-ink"
                        : "border-line hover:border-muted-soft")
                    }
                  >
                    <MoodIcon moodId={m.id} size={16} />
                    {m.label}
                  </button>
                ))}
              </div>
            </section>

            {/* القراءة الصوتية */}
            <section className="card-shadow flex flex-col gap-3 rounded-2xl border border-line bg-card p-5 sm:p-6">
              <h2 className="font-semibold">القراءة الصوتية</h2>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={form.read_aloud}
                  onChange={(e) =>
                    setForm({ ...form, read_aloud: e.target.checked })
                  }
                  className="h-4 w-4 accent-[color:var(--accent)]"
                />
                {/* كان يحيل على زر القراءة في الهيدر — والزر انحذف،
                    فبقيت الإشارة تدل على شي غير موجود */}
                <span className="text-sm">
                  اقرأ لي كل شاشة تلقائياً (اختصار حرف S)
                </span>
              </label>
              {!tts && (
                <p className="flex items-center gap-2 text-sm text-muted">
                  <TriangleAlert size={15} className="shrink-0" />
                  متصفحك ما يدعم القراءة الصوتية — الإعداد بينحفظ بس ما راح
                  يشتغل هنا.
                </p>
              )}
            </section>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-2xl bg-accent px-6 py-3 font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "…" : "احفظ"}
              </button>
              <Link
                href="/"
                className="flex items-center gap-2 rounded-full border border-line bg-card px-5 py-2.5 text-sm transition-colors hover:border-muted-soft"
              >
                <ArrowLeft size={16} />
                رجوع للرئيسية
              </Link>
            </div>

            {status && (
              <p
                role="status"
                className={
                  "flex items-center gap-2 text-sm " +
                  (status.ok ? "text-accent-strong" : "text-muted")
                }
              >
                {status.ok && <CircleCheck size={16} />}
                {status.message}
              </p>
            )}
          </form>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
