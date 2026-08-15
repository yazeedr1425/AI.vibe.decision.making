"use client";

import { GhostButton, Progress, SectionHeading } from "./ui";
import { ArrowRight } from "./icons";

// سؤال واحد في كل شاشة، مثل ملف التصميم
export default function QuestionStep({
  category,
  index,
  answers,
  setAnswers,
  onAnswer,
  onBack,
}) {
  const question = category.questions[index];
  const total = category.questions.length;

  const pick = (value) => {
    setAnswers((prev) => ({ ...prev, [question.key]: value }));
    onAnswer();
  };

  return (
    <div className="flex flex-col gap-8">
      <Progress current={index + 1} total={total} />

      <SectionHeading title={question.label} />

      <div
        role="radiogroup"
        aria-label={question.label}
        className="flex flex-col gap-2"
      >
        {question.choices.map((c) => (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={answers[question.key] === c.value}
            onClick={() => pick(c.value)}
            className={
              "flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 text-start transition-all " +
              (answers[question.key] === c.value
                ? "border-foreground bg-accent text-accent-ink"
                : "border-line bg-card hover:border-foreground/40")
            }
          >
            <span className="font-medium">{c.label}</span>
          </button>
        ))}
      </div>

      <GhostButton
        onClick={onBack}
        className="flex items-center gap-1.5 self-start"
      >
        <ArrowRight size={16} />
        رجوع
      </GhostButton>
    </div>
  );
}
