"use client";

import { useScreenAnnounce } from "@/lib/voice/VoiceProvider";
import { Progress, QuietButton, SectionHeading } from "./ui";
import { ArrowRight, Check } from "./icons";

// سؤال واحد في كل شاشة — ورقة تُملأ سطراً سطراً
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

  useScreenAnnounce(
    `${question.label} ${question.choices.map((c) => c.label).join("، أو ")}`,
  );

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
        className="flex flex-col gap-2.5"
      >
        {question.choices.map((c) => {
          const checked = answers[question.key] === c.value;
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => pick(c.value)}
              className={
                "group flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 text-start transition-all " +
                (checked
                  ? "border-ink bg-ink text-on-ink"
                  : "border-line-strong hover:border-ink hover:bg-card-sunken")
              }
            >
              <span className="text-lg font-medium">{c.label}</span>
              {/* الصح يلمّح وين بيوصل الضغط، ويثبت على المختار */}
              <Check
                size={18}
                className={
                  "shrink-0 transition-opacity " +
                  (checked ? "opacity-100" : "opacity-0 group-hover:opacity-30")
                }
              />
            </button>
          );
        })}
      </div>

      <QuietButton
        onClick={onBack}
        className="flex items-center gap-1.5 self-start"
      >
        <ArrowRight size={15} />
        رجوع
      </QuietButton>
    </div>
  );
}
