"use client";

import { CATEGORIES } from "@/lib/engine/categories";
import { MOODS, getMood } from "@/lib/engine/mood";
import { MAX_OPTIONS, MIN_OPTIONS } from "@/lib/engine/score";
import { PrimaryButton, SectionHeading, Tag } from "./ui";

export default function Landing({
  mood,
  setMood,
  categoryId,
  setCategoryId,
  options,
  setOptions,
  onStart,
}) {
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

  return (
    <div className="flex flex-col gap-10">
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

        {options.length < MAX_OPTIONS && (
          <button
            type="button"
            onClick={add}
            className="self-start text-sm text-muted transition-colors hover:text-foreground"
          >
            + أضف خيار
          </button>
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
