"use client";

import { useCallback, useMemo, useState } from "react";
import { getCategory } from "@/lib/engine/categories";
import { scoreOptions, weightsFor } from "@/lib/engine/score";
import { DEFAULT_TONE, TONES } from "@/lib/engine/tone";
import { decisionService } from "@/lib/services/decisions";
import Landing from "./components/Landing";
import QuestionStep from "./components/QuestionStep";
import RatingGrid from "./components/RatingGrid";
import Result from "./components/Result";
import Thinking from "./components/Thinking";
import { Card, Choice } from "./components/ui";

// معرّفات ثابتة للخيارين الأوليين حتى لا يختلف الرندر بين الخادم والمتصفح
const initialOptions = () => [
  { id: "opt-1", label: "" },
  { id: "opt-2", label: "" },
];

export default function Home() {
  const [step, setStep] = useState("landing");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [categoryId, setCategoryId] = useState(null);
  const [mood, setMood] = useState(null);
  const [options, setOptions] = useState(initialOptions);
  const [answers, setAnswers] = useState({});
  const [ratings, setRatings] = useState({});
  const [tone, setTone] = useState(DEFAULT_TONE);
  const [recommendation, setRecommendation] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [saveState, setSaveState] = useState(null);

  const category = categoryId ? getCategory(categoryId) : null;

  const filledOptions = useMemo(
    () =>
      options
        .filter((o) => o.label.trim())
        .map((o) => ({ ...o, label: o.label.trim() })),
    [options]
  );

  const weights = useMemo(
    () => (category ? weightsFor(category, answers, mood) : {}),
    [category, answers, mood]
  );

  const scored = useMemo(
    () =>
      category && filledOptions.length
        ? scoreOptions(category, filledOptions, ratings, weights)
        : [],
    [category, filledOptions, ratings, weights]
  );

  const start = () => {
    setAnswers({});
    setRatings({});
    setQuestionIndex(0);
    setStep("questions");
  };

  const nextQuestion = () => {
    if (questionIndex + 1 < category.questions.length) {
      setQuestionIndex((i) => i + 1);
    } else {
      setStep("ratings");
    }
  };

  const backFromQuestion = () => {
    if (questionIndex === 0) setStep("landing");
    else setQuestionIndex((i) => i - 1);
  };

  // نداء المحرك: التوصية تجي من /api/decide، والحساب المحلي يبقى
  // كخط رجعة لو النداء فشل حتى ما تنكسر الشاشة على المستخدم.
  const decide = useCallback(async () => {
    setStep("thinking");
    setApiError(null);
    setRecommendation(null);
    setSaveState(null);

    const labels = filledOptions.map((o) => o.label);
    let result = null;

    try {
      const userId = await decisionService.currentUserId();
      const res = await fetch("/api/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          options: labels,
          answers,
          categoryId,
          ...(userId ? { userId } : {}),
        }),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.ok) {
        setApiError(payload?.error ?? `تعذر الوصول للمحرك (${res.status})`);
      } else {
        result = {
          selected_option: payload.selected_option,
          funny_reason: payload.funny_reason,
        };
        setRecommendation(result);
      }
    } catch (err) {
      console.error("[decide] request failed:", err);
      setApiError("ما قدرنا نوصل للمحرك — تأكد من اتصالك.");
    }

    setStep("result");

    // الحفظ بعد ما تظهر النتيجة — ما نخلي المستخدم ينتظره
    if (result) {
      setSaveState({ status: "saving" });
      try {
        const saved = await decisionService.saveDecision({
          categoryId,
          options: labels,
          chosen: result.selected_option,
          reason: result.funny_reason,
          answers,
          weights,
        });
        setSaveState(
          saved.ok
            ? { status: "saved" }
            : { status: "failed", message: saved.message }
        );
      } catch (err) {
        console.error("[decide] save failed:", err);
        setSaveState({ status: "failed", message: "تعذر الحفظ في السجل." });
      }
    }
  }, [filledOptions, answers, categoryId, weights]);

  const restart = () => {
    setStep("landing");
    setQuestionIndex(0);
    setCategoryId(null);
    setMood(null);
    setOptions(initialOptions());
    setAnswers({});
    setRatings({});
    setRecommendation(null);
    setApiError(null);
    setSaveState(null);
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10 sm:py-16">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 -rotate-3 items-center justify-center rounded-2xl bg-accent text-2xl font-bold text-accent-ink"
            style={{ boxShadow: "0 3px 0 0 var(--foreground)" }}
          >
            حـ
          </span>
          <div>
            <h1 className="text-lg font-bold">احسم</h1>
            <p className="text-xs text-muted">مساعد القرارات</p>
          </div>
        </div>

        <div className="flex gap-1.5">
          {TONES.map((t) => (
            <Choice
              key={t.id}
              selected={tone === t.id}
              onClick={() => setTone(t.id)}
              className="px-3 py-1 text-xs"
            >
              {t.label}
            </Choice>
          ))}
        </div>
      </header>

      <Card>
        {step === "landing" && (
          <Landing
            mood={mood}
            setMood={setMood}
            categoryId={categoryId}
            setCategoryId={setCategoryId}
            options={options}
            setOptions={setOptions}
            onStart={start}
          />
        )}

        {step === "questions" && category && (
          <QuestionStep
            category={category}
            index={questionIndex}
            answers={answers}
            setAnswers={setAnswers}
            onAnswer={nextQuestion}
            onBack={backFromQuestion}
          />
        )}

        {step === "ratings" && category && (
          <RatingGrid
            category={category}
            options={filledOptions}
            ratings={ratings}
            setRatings={setRatings}
            weights={weights}
            onNext={decide}
            onBack={() => {
              setQuestionIndex(category.questions.length - 1);
              setStep("questions");
            }}
          />
        )}

        {step === "thinking" && <Thinking />}

        {step === "result" && scored.length > 0 && (
          <Result
            scored={scored}
            recommendation={recommendation}
            apiError={apiError}
            saveState={saveState}
            tone={tone}
            onRestart={restart}
            onBack={() => setStep("ratings")}
            onRetry={decide}
          />
        )}
      </Card>
    </main>
  );
}
