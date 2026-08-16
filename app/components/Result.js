"use client";

import { useEffect, useRef, useState } from "react";
import { chancesFor, weightedRandomPick } from "@/lib/engine/score";
import { detailedBreakdown, reasonPhrase } from "@/lib/engine/explain";
import { voice } from "@/lib/engine/tone";
import { useScreenAnnounce } from "@/lib/voice/VoiceProvider";
import { Card, GhostButton, PrimaryButton, QuietButton, hindi } from "./ui";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  Dices,
  Scale,
  TriangleAlert,
  Trophy,
} from "./icons";

const SPIN_MS = 1200;

// الحكم حبري والحساب ورقي — نفس البطاقة الغامقة العائمة في الهيرو،
// لكن بالحجم الكامل: اللي شافه المستخدم وعداً أول ما دخل يشوفه
// الآن حقيقةً.
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
    <div className="flex flex-col gap-6">
      {/* الحكم — يُعلن ويستقبل التركيز أول ما تظهر النتيجة */}
      <section className="on-ink card-shadow rounded-[var(--radius-card)] bg-ink p-7 text-on-ink sm:p-10">
        <p className="text-sm text-on-ink-muted">قرارك هو</p>
        <h2
          tabIndex={-1}
          data-step-heading
          className="display mt-3 text-5xl font-bold sm:text-6xl"
        >
          {chosen}
        </h2>
        {/* نص مكافئ للقارئ: النتيجة والسبب في جملة واحدة */}
        <p className="sr-only">
          قرارك هو {chosen}. {reason}
        </p>

        {/* فقاعة المحادثة */}
        <div className="mt-8 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 -rotate-3 items-center justify-center rounded-2xl bg-accent text-lg font-bold text-accent-ink">
            حـ
          </span>
          <div className="rounded-2xl rounded-ss-sm border border-line-ink bg-white/5 px-5 py-4">
            <p className="leading-relaxed">{reason}</p>
          </div>
        </div>
      </section>

      {apiError && (
        <p
          role="alert"
          className="rounded-2xl border border-dashed border-line-strong bg-card px-5 py-4 text-sm text-muted"
        >
          <TriangleAlert size={15} className="me-1.5 inline align-text-bottom" />
          {apiError} — هذي نتيجة الحساب المحلي بالأوزان.
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="ms-2 text-accent-strong underline underline-offset-4"
            >
              جرب مرة ثانية
            </button>
          )}
        </p>
      )}

      {disagrees && (
        <p className="rounded-2xl border border-dashed border-line-strong bg-card px-5 py-4 text-sm text-muted">
          <Scale size={15} className="me-1.5 inline align-text-bottom" />
          حسابي بالأوزان يقول «{localWinner.label}»، بس شفت إن «{chosen}» أنسب
          لك اليوم.
        </p>
      )}

      {/* الترتيب حسب الأوزان */}
      <Card className="flex flex-col gap-4">
        <h3 className="text-lg font-bold">حسابك بالأوزان</h3>

        {scored.map((s) => (
          <div key={s.id} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span
                className={
                  "flex items-center gap-1.5 " +
                  (s.label === chosen ? "font-semibold" : "text-muted")
                }
              >
                {s.label === chosen && <Trophy size={15} />}
                {s.label}
              </span>
              <span className="text-sm text-muted">{hindi(s.percent)}٪</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className={
                  "h-full rounded-full transition-all duration-700 " +
                  (s.label === chosen ? "bg-accent" : "bg-muted-soft/60")
                }
                style={{ width: `${s.percent}%` }}
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="flex items-center gap-1 self-start text-sm text-accent-strong underline underline-offset-4"
        >
          {showDetails ? "أخفِ التفاصيل" : "وضّح أكثر"}
          {showDetails ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
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
      </Card>

      {/* أنا متردد جدًا */}
      <section className="rounded-[var(--radius-card)] border border-dashed border-line-strong bg-card-sunken p-6">
        <p className="text-sm text-muted">{say.hesitantPrompt}</p>

        {(spinning || randomPick) && (
          <p className="mt-4 flex items-center justify-center gap-2 text-center text-3xl font-bold">
            {spinning ? (
              flash
            ) : (
              <>
                <Dices size={28} className="shrink-0" />
                {randomPick.label}
              </>
            )}
          </p>
        )}

        {randomPick && !spinning && (
          <p className="mt-2 text-center text-sm text-muted">
            {say.randomResult(randomPick.label)}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <GhostButton
            onClick={spin}
            disabled={spinning}
            className="flex items-center gap-1.5"
          >
            {spinning ? (
              "…"
            ) : (
              <>
                <Dices size={16} />
                {randomPick ? "مرة ثانية" : "أنا متردد جدًا"}
              </>
            )}
          </GhostButton>
          <span className="text-xs text-muted">
            الحظوظ:{" "}
            {withChances
              .map((c) => `${c.label} ${hindi(c.chance)}٪`)
              .join(" · ")}
          </span>
        </div>
      </section>

      {/* حالة الحفظ */}
      {saveState && (
        <p
          role="status"
          className="flex items-center gap-1.5 text-sm text-muted"
        >
          {saveState.status === "saving" && "… يحفظ في سجلك"}
          {saveState.status === "saved" && (
            <>
              <CircleCheck size={15} />
              انحفظ في سجلك
            </>
          )}
          {saveState.status === "failed" && (
            <>
              <TriangleAlert size={15} />
              {saveState.message}
            </>
          )}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <QuietButton onClick={onBack} className="flex items-center gap-1.5">
          <ArrowRight size={15} />
          عدّل التقييمات
        </QuietButton>
        <PrimaryButton onClick={onRestart}>{say.restart}</PrimaryButton>
      </div>
    </div>
  );
}
