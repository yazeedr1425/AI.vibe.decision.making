"use client";

import { useCallback, useMemo, useState } from "react";
import { getCategory } from "@/lib/engine/categories";
import { scoreOptions, weightsFor } from "@/lib/engine/score";
import { DEFAULT_TONE, TONES } from "@/lib/engine/tone";
import { decisionService } from "@/lib/services/decisions";
import { useAuth } from "@/lib/auth/AuthProvider";
import AuthPanel from "./components/AuthPanel";
import Landing from "./components/Landing";
import QuestionStep from "./components/QuestionStep";
import RatingGrid from "./components/RatingGrid";
import Result from "./components/Result";
import Thinking from "./components/Thinking";
import VoiceControls from "./components/VoiceControls";
import VoiceMode from "./components/VoiceMode";
import { Card, Choice } from "./components/ui";

// معرّفات ثابتة للخيارين الأوليين حتى لا يختلف الرندر بين الخادم والمتصفح
const initialOptions = () => [
  { id: "opt-1", label: "" },
  { id: "opt-2", label: "" },
];

export default function Home() {
  const { user, signOut, accessToken } = useAuth();
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
  // override يجي من وضع المحادثة الصوتية، لأن الحالة ما تكون تحدّثت بعد
  const decide = useCallback(async (override) => {
    setStep("thinking");
    setApiError(null);
    setRecommendation(null);
    setSaveState(null);

    const labels = override?.options ?? filledOptions.map((o) => o.label);
    const finalAnswers = override?.answers ?? answers;
    const finalCategory = override?.categoryId ?? categoryId;
    let result = null;

    try {
      // التوكن هو الهوية — أوثق من إرسال userId في الـ body
      const token = await accessToken();
      const res = await fetch("/api/decide", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          options: labels,
          answers: finalAnswers,
          categoryId: finalCategory,
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
          categoryId: finalCategory,
          options: labels,
          chosen: result.selected_option,
          reason: result.funny_reason,
          answers: finalAnswers,
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
  }, [filledOptions, answers, categoryId, weights, accessToken]);

  // المحادثة الصوتية تعطينا كل شي دفعة واحدة، بدون مرحلة التقييم
  const fromVoice = useCallback(
    (payload) => {
      setCategoryId(payload.categoryId);
      setOptions(payload.options.map((label, i) => ({ id: `voice-${i}`, label })));
      setAnswers(payload.answers);
      setRatings({});
      decide(payload);
    },
    [decide]
  );

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
    <main
      id="main"
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10 sm:py-16"
    >
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

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <VoiceControls onVoiceMode={() => setStep("voice")} />

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

          {user ? (
            <Choice
              onClick={signOut}
              className="px-3 py-1 text-xs"
              title={user.email}
            >
              خروج
            </Choice>
          ) : (
            <Choice
              onClick={() => setStep("auth")}
              selected={step === "auth"}
              className="px-3 py-1 text-xs"
            >
              دخول
            </Choice>
          )}
        </div>
      </header>

      <Card>
        {step === "auth" && <AuthPanel onDone={() => setStep("landing")} />}

        {step === "voice" && (
          <VoiceMode onComplete={fromVoice} onCancel={() => setStep("landing")} />
        )}

        {step === "landing" && (
          <Landing
            mood={mood}
            setMood={setMood}
            categoryId={categoryId}
            setCategoryId={setCategoryId}
            options={options}
            setOptions={setOptions}
            onStart={start}
            onVoiceMode={() => setStep("voice")}
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
            onNext={() => decide()}
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
