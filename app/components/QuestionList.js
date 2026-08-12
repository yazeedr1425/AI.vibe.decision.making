"use client";

import { Choice, PrimaryButton, GhostButton } from "./ui";

export default function QuestionList({ category, answers, setAnswers, onNext, onBack }) {
  const answered = category.questions.filter((q) => answers[q.key]).length;
  const allAnswered = answered === category.questions.length;

  return (
    <div className="flex flex-col gap-6">
      <header className="text-center">
        <h2 className="text-2xl font-bold">أسئلة سريعة</h2>
        <p className="mt-1 text-sm opacity-60">
          إجاباتك تحدد إيش الأهم في القرار
        </p>
      </header>

      <div className="flex flex-col gap-6">
        {category.questions.map((q) => (
          <fieldset key={q.key} className="flex flex-col gap-3">
            <legend className="mb-2 font-medium">{q.label}</legend>
            <div className="flex flex-wrap gap-2">
              {q.choices.map((c) => (
                <Choice
                  key={c.value}
                  selected={answers[q.key] === c.value}
                  onClick={() =>
                    setAnswers((prev) => ({ ...prev, [q.key]: c.value }))
                  }
                >
                  {c.label}
                </Choice>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <GhostButton onClick={onBack}>رجوع</GhostButton>
        <PrimaryButton onClick={onNext} disabled={!allAnswered}>
          {allAnswered ? "تمام، كمل" : `باقي ${category.questions.length - answered}`}
        </PrimaryButton>
      </div>
    </div>
  );
}
