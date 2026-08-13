"use client";

import { useScreenAnnounce } from "@/lib/voice/VoiceProvider";
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

  // السؤال بلا سياق يبان اعتباطياً: المستخدم يشوف "وش خاطرك اليوم؟"
  // وما يدري ليش انسأل ولا وش يسوّي بجوابه. كل سؤال وظيفته واحدة —
  // يحدد وزن معيار واحد — فنقولها صراحة تحته.
  const affected = category.criteria.find((c) => c.key === question.affects);

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

      <SectionHeading
        tag={question.en}
        title={question.label}
        sub={
          affected ? `جوابك يحدد كم يهمّك «${affected.label}» في هذا القرار` : undefined
        }
      />

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
