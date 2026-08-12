"use client";

import { DEFAULT_RATING, RATING_SCALE } from "@/lib/engine/score";
import { Choice, PrimaryButton, GhostButton } from "./ui";

// شبكة تقييم مضغوطة: كل خيار × كل معيار.
// الافتراضي "متوسط"، فيقدر المستخدم يتخطاها كلها لو استعجل.
export default function RatingGrid({
  category,
  options,
  ratings,
  setRatings,
  weights,
  onNext,
  onBack,
}) {
  const set = (optionId, criterionKey, value) =>
    setRatings((prev) => ({
      ...prev,
      [optionId]: { ...prev[optionId], [criterionKey]: value },
    }));

  // نعرض المعايير الأهم أولاً حسب أوزان إجابات المستخدم
  const criteria = [...category.criteria].sort(
    (a, b) => weights[b.key] - weights[a.key]
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="text-center">
        <h2 className="text-2xl font-bold">قيّم كل خيار بسرعة</h2>
        <p className="mt-1 text-sm opacity-60">
          كل شي على «متوسط» — غيّر اللي تحس فيه فرق وبس
        </p>
      </header>

      <div className="flex flex-col gap-5">
        {options.map((o) => (
          <div
            key={o.id}
            className="rounded-2xl border border-foreground/10 p-4"
          >
            <h3 className="mb-3 font-medium">{o.label}</h3>
            <div className="flex flex-col gap-3">
              {criteria.map((c) => (
                <div
                  key={c.key}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <span className="text-sm opacity-70">
                    {c.label}
                    {weights[c.key] === 3 && (
                      <span className="ms-2 rounded-full bg-foreground/10 px-2 py-0.5 text-xs">
                        الأهم
                      </span>
                    )}
                  </span>
                  <div className="flex gap-1.5">
                    {RATING_SCALE.map((r) => (
                      <Choice
                        key={r.value}
                        selected={
                          (ratings[o.id]?.[c.key] ?? DEFAULT_RATING) === r.value
                        }
                        onClick={() => set(o.id, c.key, r.value)}
                        className="px-3 py-1 text-xs"
                      >
                        {r.label}
                      </Choice>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <GhostButton onClick={onBack}>رجوع</GhostButton>
        <PrimaryButton onClick={onNext}>احسمها لي</PrimaryButton>
      </div>
    </div>
  );
}
