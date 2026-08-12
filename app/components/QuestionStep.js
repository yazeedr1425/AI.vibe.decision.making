"use client";

import { useScreenAnnounce } from "@/lib/voice/VoiceProvider";
import { GhostButton, Progress, SectionHeading } from "./ui";

// سؤال واحد في كل شاشة، مثل ملف التصميم
export default function QuestionStep({ category, index, answers, setAnswers, onAnswer, onBack }) {
  const question = category.questions[index];
  const total = category.questions.length;

  useScreenAnnounce(
    `${question.label} ${question.choices.map((c) => c.label).join("، أو ")}`
  );

  const pick = (value) => {
    setAnswers((prev) => ({ ...prev, [question.key]: value }));
    onAnswer();
  };

  return (
    <div className="flex flex-col gap-8">
      <Progress current={index + 1} total={total} />

      <SectionHeading tag={question.en} title={question.label} />

      <div className="flex flex-col gap-2">
        {question.choices.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => pick(c.value)}
            className={
              "flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 text-start transition-all " +
              (answers[question.key] === c.value
                ? "border-foreground bg-accent text-accent-ink"
                : "border-line bg-card hover:border-foreground/40")
            }
          >
            <span className="font-medium">{c.label}</span>
            <span
              className={
                answers[question.key] === c.value
                  ? "tag !text-accent-ink/70"
                  : "tag"
              }
            >
              {c.en}
            </span>
          </button>
        ))}
      </div>

      <GhostButton onClick={onBack} className="self-start">
        → رجوع
      </GhostButton>
    </div>
  );
}
