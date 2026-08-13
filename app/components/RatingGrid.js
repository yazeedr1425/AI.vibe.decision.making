"use client";

import { DEFAULT_RATING, RATING_SCALE } from "@/lib/engine/score";

// سلّم التقييم لكل معيار على حدة.
//
// كانت الشبكة تعرض ضعيف/متوسط/ممتاز لكل المعايير، وهذا مقياس جودة
// ما ينطبق إلا على بعضها. "الدسامة: ضعيف/ممتاز" بلا معنى — دسم ليس
// جودة، هو طرف. والمعيار أصلاً يحمل طرفيه (low و high)، فالشبكة
// كانت تتجاهل ما تحتاجه بالضبط.
//
// الترتيب ١←٣ يبقى كما هو: الأعلى دائماً هو الطرف المرغوب حين يهم
// المعيار، وعليه يقوم حساب scoreOptions.
function scaleFor(criterion) {
  if (!criterion.low || !criterion.high) return RATING_SCALE;
  return [
    { value: 1, label: criterion.low },
    { value: 2, label: criterion.mid ?? "وسط" },
    { value: 3, label: criterion.high },
  ];
}
import { Choice, GhostButton, PrimaryButton, SectionHeading, Tag } from "./ui";
import { ArrowLeft, ArrowRight } from "./icons";

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
    (a, b) => weights[b.key] - weights[a.key],
  );
  const topWeight = Math.max(...Object.values(weights));

  return (
    <div className="flex flex-col gap-8">
      <SectionHeading
        tag="quick ratings"
        title="قيّم كل خيار بسرعة"
        sub="كل شي على «متوسط» — غيّر اللي تحس فيه فرق وبس."
      />

      <div className="flex flex-col gap-4">
        {options.map((o) => (
          <div
            key={o.id}
            className="rounded-2xl border border-line bg-card p-4"
          >
            <h3 className="mb-3 font-semibold">{o.label}</h3>
            <div className="flex flex-col gap-3">
              {criteria.map((c) => (
                <div
                  key={c.key}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-2 text-sm text-muted">
                    {c.label}
                    {weights[c.key] === topWeight && (
                      <Tag className="rounded-full bg-accent/10 px-2 py-0.5 !text-accent">
                        top
                      </Tag>
                    )}
                  </span>
                  {/* اختيار واحد من ثلاثة — دلالات radio تخلي قارئ
                      الشاشة يقول "١ من ٣" بدل ثلاثة أزرار منفصلة */}
                  <div
                    role="radiogroup"
                    aria-label={`${c.label} — ${o.label}`}
                    className="flex gap-1.5"
                  >
                    {scaleFor(c).map((r) => {
                      const checked =
                        (ratings[o.id]?.[c.key] ?? DEFAULT_RATING) === r.value;
                      return (
                        <Choice
                          key={r.value}
                          role="radio"
                          aria-checked={checked}
                          selected={checked}
                          onClick={() => set(o.id, c.key, r.value)}
                          className="px-3 py-1 text-xs"
                        >
                          {r.label}
                        </Choice>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <GhostButton onClick={onBack} className="flex items-center gap-1.5">
          <ArrowRight size={16} />
          رجوع
        </GhostButton>
        <PrimaryButton onClick={onNext} className="flex items-center gap-2">
          احسمها لي
          <ArrowLeft size={18} />
        </PrimaryButton>
      </div>
    </div>
  );
}
