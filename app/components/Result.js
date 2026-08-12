"use client";

import { useEffect, useRef, useState } from "react";
import { chancesFor, weightedRandomPick } from "@/lib/engine/score";
import { detailedBreakdown, reasonPhrase } from "@/lib/engine/explain";
import { voice } from "@/lib/engine/tone";
import { useScreenAnnounce } from "@/lib/voice/VoiceProvider";
import { GhostButton, PrimaryButton, Tag } from "./ui";

const SPIN_MS = 1200;

export default function Result({
  scored,
  recommendation,
  apiError,
  saveState,
  tone,
  onRestart,
  onBack,
  onRetry,
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [flash, setFlash] = useState(null);
  const [randomPick, setRandomPick] = useState(null);
  const timers = useRef([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearInterval);
  }, []);

  const say = voice(tone);
  const localWinner = scored[0];
  const withChances = chancesFor(scored);

  // التوصية من الـ API هي الأساس، والحساب المحلي احتياط لو فشل النداء
  const chosen = recommendation?.selected_option ?? localWinner.label;
  const reason = recommendation?.funny_reason ?? `${reasonPhrase(scored)}.`;
  const disagrees =
    recommendation && recommendation.selected_option !== localWinner.label;

  // تُقرأ تلقائياً لو المستخدم مفعّل القراءة، ويعيدها زر R
  useScreenAnnounce(`قرارك هو ${chosen}. ${reason}`);

  const spin = () => {
    if (spinning) return;
    setRandomPick(null);
    setSpinning(true);

    const pick = weightedRandomPick(scored);
    const interval = setInterval(() => {
      setFlash(scored[Math.floor(Math.random() * scored.length)].label);
    }, 80);
    timers.current.push(interval);

    setTimeout(() => {
      clearInterval(interval);
      setFlash(null);
      setSpinning(false);
      setRandomPick(pick);
    }, SPIN_MS);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* القرار */}
      <header className="flex flex-col gap-2">
        <Tag>the call</Tag>
        <p className="text-sm text-muted">قرارك هو</p>
        <h2 className="text-4xl font-bold sm:text-5xl">{chosen}</h2>
      </header>

      {/* فقاعة المحادثة */}
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 -rotate-3 items-center justify-center rounded-2xl bg-accent text-lg font-bold text-accent-ink">
          حـ
        </span>
        <div className="relative rounded-2xl rounded-ss-sm border border-line bg-card px-5 py-4">
          <span
            aria-hidden
            className="absolute -start-1.5 top-3 h-3 w-3 rotate-45 border-b border-s border-line bg-card"
          />
          <p className="leading-relaxed">{reason}</p>
        </div>
      </div>

      {apiError && (
        <p className="rounded-xl border border-dashed border-line bg-card px-4 py-3 text-sm text-muted">
          ⚠️ {apiError} — هذي نتيجة الحساب المحلي بالأوزان.
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="ms-2 text-accent underline underline-offset-4"
            >
              جرب مرة ثانية
            </button>
          )}
        </p>
      )}

      {disagrees && (
        <p className="rounded-xl border border-dashed border-line bg-card px-4 py-3 text-sm text-muted">
          🤔 حسابي بالأوزان يقول «{localWinner.label}»، بس شفت إن «{chosen}» أنسب
          لك اليوم.
        </p>
      )}

      {/* الترتيب حسب الأوزان */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-semibold">حسابك بالأوزان</h3>
          <Tag>scoreboard</Tag>
        </div>

        {scored.map((s, i) => (
          <div key={s.id} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className={s.label === chosen ? "font-semibold" : "text-muted"}>
                {s.label === chosen && "🏆 "}
                {s.label}
              </span>
              <span className="text-sm tabular-nums text-muted">{s.percent}٪</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-line">
              <div
                className={
                  "h-full rounded-full transition-all duration-700 " +
                  (s.label === chosen ? "bg-accent" : "bg-muted/40")
                }
                style={{ width: `${s.percent}%` }}
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="self-start text-sm text-accent underline underline-offset-4"
        >
          {showDetails ? "أخفِ التفاصيل ↑" : "وضّح أكثر ↓"}
        </button>

        {showDetails && (
          <ul className="flex flex-col gap-3 border-t border-line pt-4 text-sm">
            {detailedBreakdown(scored).map((d) => (
              <li key={d.key} className="flex flex-col gap-0.5">
                <span className="font-medium">{d.label}</span>
                <span className="text-muted">
                  {d.importance} — {d.verdict}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* أنا متردد جدًا */}
      <section className="rounded-2xl border border-dashed border-line bg-card p-5">
        <p className="text-sm text-muted">{say.hesitantPrompt}</p>

        {(spinning || randomPick) && (
          <p className="mt-4 text-center text-3xl font-bold">
            {spinning ? flash : `🎲 ${randomPick.label}`}
          </p>
        )}

        {randomPick && !spinning && (
          <p className="mt-2 text-center text-sm text-muted">
            {say.randomResult(randomPick.label)}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <GhostButton onClick={spin} disabled={spinning}>
            {spinning ? "…" : randomPick ? "مرة ثانية 🎲" : "🎲 أنا متردد جدًا"}
          </GhostButton>
          <span className="text-xs text-muted">
            الحظوظ: {withChances.map((c) => `${c.label} ${c.chance}٪`).join(" · ")}
          </span>
        </div>
      </section>

      {/* حالة الحفظ */}
      {saveState && (
        <p className="text-sm text-muted">
          {saveState.status === "saving" && "… يحفظ في سجلك"}
          {saveState.status === "saved" && "✅ انحفظ في سجلك"}
          {saveState.status === "failed" && `💾 ${saveState.message}`}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <GhostButton onClick={onBack}>→ عدّل التقييمات</GhostButton>
        <PrimaryButton onClick={onRestart}>{say.restart}</PrimaryButton>
      </div>
    </div>
  );
}
