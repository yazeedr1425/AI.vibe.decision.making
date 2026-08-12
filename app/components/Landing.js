"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CATEGORIES } from "@/lib/engine/categories";
import { MOODS, getMood } from "@/lib/engine/mood";
import { MAX_OPTIONS, MIN_OPTIONS } from "@/lib/engine/score";
import { listenOnce } from "@/lib/voice/speech";
import { parseSpokenOptions } from "@/lib/voice/match";
import { useVoice } from "@/lib/voice/VoiceProvider";
import { GhostButton, PrimaryButton, SectionHeading, Tag } from "./ui";

export default function Landing({
  mood,
  setMood,
  categoryId,
  setCategoryId,
  options,
  setOptions,
  onStart,
  onVoiceMode,
}) {
  const { stt } = useVoice();
  const [dictating, setDictating] = useState(false);
  const [dictationError, setDictationError] = useState(null);
  const stopRef = useRef(() => {});

  useEffect(() => () => stopRef.current?.(), []);
  const filled = options.filter((o) => o.label.trim()).length;
  const ready = filled >= MIN_OPTIONS && categoryId;
  const activeMood = getMood(mood);

  const update = (id, label) =>
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, label } : o)));

  const add = () =>
    setOptions((prev) =>
      prev.length >= MAX_OPTIONS
        ? prev
        : [...prev, { id: crypto.randomUUID(), label: "" }]
    );

  const remove = (id) =>
    setOptions((prev) =>
      prev.length <= MIN_OPTIONS ? prev : prev.filter((o) => o.id !== id)
    );

  // إملاء الخيارات بالصوت: "برجر أو سوشي ولا أطبخ بالبيت"
  const dictate = useCallback(() => {
    if (!stt || dictating) return;
    setDictationError(null);
    setDictating(true);

    stopRef.current = listenOnce({
      onResult: (text) => {
        setDictating(false);
        const spoken = parseSpokenOptions(text, { max: MAX_OPTIONS });
        if (!spoken.length) {
          setDictationError("ما التقطت خيارات — عيد أو اكتبها.");
          return;
        }
        setOptions((prev) => {
          const next = [...prev];
          for (const label of spoken) {
            const empty = next.findIndex((o) => !o.label.trim());
            if (empty !== -1) next[empty] = { ...next[empty], label };
            else if (next.length < MAX_OPTIONS)
              next.push({ id: crypto.randomUUID(), label });
          }
          return next;
        });
      },
      onError: (code) => {
        setDictating(false);
        setDictationError(
          code === "not-allowed"
            ? "الميكروفون ممنوع — اكتب خياراتك بدل الإملاء."
            : "ما سمعت شي — عيد أو اكتبها."
        );
      },
    });
  }, [stt, dictating, setOptions]);

  // اختصار حرف M
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || e.target?.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.toLowerCase() === "m") {
        e.preventDefault();
        dictate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dictate]);

  return (
    <div className="flex flex-col gap-10">
      {/* وضع المحادثة الصوتية */}
      <section className="flex flex-col gap-3 rounded-2xl border border-dashed border-line bg-card p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-semibold">وضع المحادثة الصوتية</h2>
          <Tag>talk to ehsim</Tag>
        </div>
        <p className="text-sm text-muted">
          كلّمني وأنا أعبّي الخيارات وأسألك وأحسمها. ولو الميكروفون ممنوع، بيظهر
          لك مربع كتابة ونكمل نفس المحادثة.
        </p>
        <PrimaryButton
          onClick={onVoiceMode}
          aria-label="وضع المحادثة الصوتية — اختصار حرف V"
          className="self-start"
        >
          🎧 ابدأ المحادثة الصوتية
        </PrimaryButton>
      </section>

      <SectionHeading
        tag="Step 01 — what's the call?"
        title="وش نقرر اليوم؟"
        sub="اكتب خياراتك، جاوب أسئلة سريعة، وأنا أحسمها لك — مع السبب."
      />

      {/* المزاج */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-semibold">كيف مزاجك الحين؟</h3>
          <Tag>mood sets the mood</Tag>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MOODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMood(mood === m.id ? null : m.id)}
              className={
                "flex flex-col items-center gap-1 rounded-2xl border px-3 py-3 transition-all " +
                (mood === m.id
                  ? "border-foreground bg-accent text-accent-ink"
                  : "border-line bg-card hover:border-foreground/40")
              }
            >
              <span className="text-2xl">{m.emoji}</span>
              <span className="text-sm font-medium">{m.label}</span>
            </button>
          ))}
        </div>
        {activeMood && (
          <p className="text-sm text-muted">{activeMood.line}</p>
        )}
      </section>

      {/* الفئة */}
      <section className="flex flex-col gap-3">
        <h3 className="font-semibold">نوع القرار</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={
                "flex flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-start transition-all " +
                (categoryId === c.id
                  ? "border-foreground bg-accent text-accent-ink"
                  : "border-line bg-card hover:border-foreground/40")
              }
            >
              <span className="text-2xl">{c.emoji}</span>
              <span className="font-medium">{c.label}</span>
              <span
                className={
                  categoryId === c.id ? "tag !text-accent-ink/70" : "tag"
                }
              >
                {c.en}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* الخيارات */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-semibold">الخيارات</h3>
          <Tag>
            your options · {MIN_OPTIONS}–{MAX_OPTIONS}
          </Tag>
        </div>

        <div className="flex flex-col gap-2">
          {options.map((o, i) => (
            <div key={o.id} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-center text-sm text-muted">
                {i + 1}
              </span>
              <input
                value={o.label}
                onChange={(e) => update(o.id, e.target.value)}
                placeholder={`الخيار ${i + 1}`}
                maxLength={60}
                className="w-full rounded-xl border border-line bg-card px-4 py-3 outline-none transition-colors focus:border-accent"
              />
              {options.length > MIN_OPTIONS && (
                <button
                  type="button"
                  onClick={() => remove(o.id)}
                  aria-label={`احذف الخيار ${i + 1}`}
                  className="shrink-0 rounded-full px-2 text-lg text-muted transition-colors hover:text-foreground"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {stt && (
            <GhostButton
              onClick={dictate}
              disabled={dictating}
              aria-label="أملِ خياراتك بالصوت — اختصار حرف M"
            >
              🎙️ {dictating ? "أسمعك…" : "تكلم + أضف خيار"}
            </GhostButton>
          )}
          {options.length < MAX_OPTIONS && (
            <button
              type="button"
              onClick={add}
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              + أضف خيار
            </button>
          )}
        </div>

        {dictationError && (
          <p role="status" className="text-sm text-muted">
            ⚠️ {dictationError}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-line pt-6">
        <Tag>ready?</Tag>
        <p className="text-sm text-muted">
          {ready
            ? "تمام، خلنا نبدأ."
            : !categoryId
              ? "اختر نوع القرار أول."
              : `اكتب ${MIN_OPTIONS} خيارات على الأقل وأبدأ معك.`}
        </p>
        <PrimaryButton onClick={onStart} disabled={!ready} className="self-start">
          احسمها لي ←
        </PrimaryButton>
        <p className="text-xs text-muted">
          ٣ أسئلة فقط · نتيجة مع السبب · وإذا ما اقتنعت، عجلة الحظ الموزونة
          تنتظرك 🎲
        </p>
      </section>
    </div>
  );
}
