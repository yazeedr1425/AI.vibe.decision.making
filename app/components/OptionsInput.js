"use client";

import { MAX_OPTIONS, MIN_OPTIONS } from "@/lib/engine/score";
import { PrimaryButton, GhostButton } from "./ui";

export default function OptionsInput({ category, options, setOptions, onNext, onBack }) {
  const filled = options.filter((o) => o.label.trim()).length;
  const canContinue = filled >= MIN_OPTIONS;

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
    <div className="flex flex-col gap-6">
      <header className="text-center">
        <h2 className="text-2xl font-bold">
          {category.emoji} إيش الخيارات المطروحة؟
        </h2>
        <p className="mt-1 text-sm opacity-60">
          من {MIN_OPTIONS} إلى {MAX_OPTIONS} خيارات
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {options.map((o, i) => (
          <div key={o.id} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-center text-sm opacity-40">
              {i + 1}
            </span>
            <input
              value={o.label}
              onChange={(e) => update(o.id, e.target.value)}
              placeholder={`الخيار ${i + 1}`}
              maxLength={60}
              className="w-full rounded-xl border border-foreground/15 bg-transparent px-4 py-3 outline-none transition-colors focus:border-foreground/50"
            />
            {options.length > MIN_OPTIONS && (
              <button
                type="button"
                onClick={() => remove(o.id)}
                aria-label={`احذف الخيار ${i + 1}`}
                className="shrink-0 rounded-full px-3 py-1 text-lg opacity-40 transition-opacity hover:opacity-100"
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
          className="self-start text-sm opacity-60 transition-opacity hover:opacity-100"
        >
          + أضف خيار
        </button>
      )}

      <div className="flex items-center justify-between gap-3">
        <GhostButton onClick={onBack}>رجوع</GhostButton>
        <PrimaryButton onClick={onNext} disabled={!canContinue}>
          يالله نكمل
        </PrimaryButton>
      </div>
    </div>
  );
}
