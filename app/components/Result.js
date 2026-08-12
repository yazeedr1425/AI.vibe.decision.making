"use client";

import { useEffect, useRef, useState } from "react";
import { chancesFor, isTie, weightedRandomPick } from "@/lib/engine/score";
import { detailedBreakdown, reasonPhrase } from "@/lib/engine/explain";
import { voice } from "@/lib/engine/tone";
import { Card, GhostButton, PrimaryButton } from "./ui";

const SPIN_MS = 1200;

export default function Result({ category, scored, tone, onRestart, onBack }) {
  const [showDetails, setShowDetails] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [flash, setFlash] = useState(null);
  const [randomPick, setRandomPick] = useState(null);
  const timers = useRef([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearInterval);
  }, []);

  const winner = scored[0];
  const say = voice(tone);
  const tied = isTie(scored);
  const withChances = chancesFor(scored);

  const spin = () => {
    if (spinning) return;
    setRandomPick(null);
    setSpinning(true);

    // الاختيار النهائي محسوب من البداية — الوميض عرض بصري فقط
    const chosen = weightedRandomPick(scored);
    const interval = setInterval(() => {
      setFlash(scored[Math.floor(Math.random() * scored.length)].label);
    }, 80);
    timers.current.push(interval);

    setTimeout(() => {
      clearInterval(interval);
      setFlash(null);
      setSpinning(false);
      setRandomPick(chosen);
    }, SPIN_MS);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="text-center">
        <p className="text-sm opacity-60">
          {category.emoji} {category.label}
        </p>
        <h2 className="mt-2 text-2xl font-bold leading-relaxed">
          {tied ? say.tie(winner.label) : say.headline(winner.label, reasonPhrase(scored))}
        </h2>
      </header>

      {/* الترتيب */}
      <div className="flex flex-col gap-3">
        {scored.map((s, i) => (
          <div key={s.id} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className={i === 0 ? "font-semibold" : "opacity-70"}>
                {i === 0 && "🏆 "}
                {s.label}
              </span>
              <span className="text-sm tabular-nums opacity-50">
                {s.percent}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
              <div
                className={
                  "h-full rounded-full transition-all duration-700 " +
                  (i === 0 ? "bg-foreground" : "bg-foreground/30")
                }
                style={{ width: `${s.percent}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* ليش هذا القرار؟ */}
      <div>
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="text-sm underline underline-offset-4 opacity-70 transition-opacity hover:opacity-100"
        >
          {showDetails ? "أخفِ التفاصيل" : "💡 وضّح أكثر"}
        </button>

        {showDetails && (
          <Card className="mt-3 bg-foreground/[0.03]">
            <ul className="flex flex-col gap-3 text-sm">
              {detailedBreakdown(scored).map((d) => (
                <li key={d.key} className="flex flex-col gap-1">
                  <span className="font-medium">{d.label}</span>
                  <span className="opacity-70">
                    {d.importance} — {d.verdict}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {/* مود أنا متردد جدًا */}
      <Card className="bg-foreground/[0.03]">
        <p className="text-sm opacity-70">{say.hesitantPrompt}</p>

        {(spinning || randomPick) && (
          <p className="mt-4 text-center text-2xl font-bold">
            {spinning ? flash : `🎲 ${randomPick.label}`}
          </p>
        )}

        {randomPick && !spinning && (
          <p className="mt-2 text-center text-sm opacity-70">
            {say.randomResult(randomPick.label)}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <GhostButton onClick={spin} disabled={spinning}>
            {spinning ? "…" : randomPick ? "مرة ثانية 🎲" : "أنا متردد جدًا 🎲"}
          </GhostButton>
          <span className="text-xs opacity-50">
            الحظوظ: {withChances.map((c) => `${c.label} ${c.chance}%`).join(" · ")}
          </span>
        </div>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <GhostButton onClick={onBack}>عدّل التقييمات</GhostButton>
        <PrimaryButton onClick={onRestart}>{say.restart}</PrimaryButton>
      </div>
    </div>
  );
}
