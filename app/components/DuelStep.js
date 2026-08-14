"use client";

import { useScreenAnnounce } from "@/lib/voice/VoiceProvider";
import { GhostButton, Progress, SectionHeading } from "./ui";
import { ArrowRight } from "./icons";

/**
 * سؤال واحد، وإجاباته هي الخيارات نفسها.
 *
 * كانت الأسئلة عن ظرف المستخدم (كم عندك وقت؟) لتحديد أوزان المعايير،
 * ثم يقيّم كل خيار في شبكة منفصلة. الحين السؤال نفسه هو التقييم:
 * تختار مين يكسب هذا البُعد، واللي يكسب أكثر أبعاد يفوز.
 *
 * "تعادل" خيار مقصود: إجبار المستخدم يفاضل في بُعد ما يفرّق عنده
 * يزيّف النتيجة. التعادل ما يعطي أحداً شيئاً، فيسقط البُعد من الحساب.
 */
export default function DuelStep({
  question,
  index,
  total,
  options,
  answers,
  setAnswers,
  onAnswer,
  onBack,
}) {
  useScreenAnnounce(
    `${question.label} ${options.map((o) => o.label).join("، أو ")}`,
  );

  const pick = (value) => {
    setAnswers((prev) => ({ ...prev, [question.key]: value }));
    onAnswer();
  };

  const chosen = answers?.[question.key];

  return (
    <div className="flex flex-col gap-8">
      <Progress current={index + 1} total={total} />

      <SectionHeading tag={question.en} title={question.label} />

      <div
        role="radiogroup"
        aria-label={question.label}
        className="flex flex-col gap-2"
      >
        {options.map((o) => {
          const selected = chosen === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => pick(o.id)}
              className={
                "rounded-2xl border px-5 py-4 text-start text-lg transition-all " +
                (selected
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-line bg-card hover:-translate-y-0.5 hover:border-foreground/40")
              }
            >
              {o.label}
            </button>
          );
        })}

        <button
          type="button"
          role="radio"
          aria-checked={chosen === "tie"}
          onClick={() => pick("tie")}
          className={
            "mt-1 rounded-2xl border border-dashed px-5 py-3 text-start text-sm transition-colors " +
            (chosen === "tie"
              ? "border-accent text-accent-strong"
              : "border-line text-muted hover:border-foreground/40")
          }
        >
          ما يفرق عندي
        </button>
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
