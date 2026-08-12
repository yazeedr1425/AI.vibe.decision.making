"use client";

import { CATEGORIES } from "@/lib/engine/categories";

export default function CategoryPicker({ onPick }) {
  return (
    <div className="flex flex-col gap-6">
      <header className="text-center">
        <h2 className="text-2xl font-bold">على إيش نحسم اليوم؟</h2>
        <p className="mt-1 text-sm opacity-60">اختر نوع القرار</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c.id)}
            className="flex items-center gap-4 rounded-2xl border border-foreground/10 p-4 text-start transition-colors hover:border-foreground/40"
          >
            <span className="text-3xl">{c.emoji}</span>
            <span>
              <span className="block font-medium">{c.label}</span>
              <span className="block text-sm opacity-60">{c.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
