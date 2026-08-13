"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getCategory } from "@/lib/engine/categories";
import { scoreOptions, weightsFor } from "@/lib/engine/score";
import { DEFAULT_TONE, TONES } from "@/lib/engine/tone";
import { decisionService } from "@/lib/services/decisions";
import { profileService } from "@/lib/services/profile";
import { useAuth } from "@/lib/auth/AuthProvider";
import Landing from "./components/Landing";
import QuestionStep from "./components/QuestionStep";
import RatingGrid from "./components/RatingGrid";
import HistorySection from "./components/HistorySection";
import Result from "./components/Result";
import SiteFooter from "./components/SiteFooter";
import SiteNav from "./components/SiteNav";
import Thinking from "./components/Thinking";
import VoiceMode from "./components/VoiceMode";
import { Card } from "./components/ui";

// معرّفات ثابتة للخيارين الأوليين حتى لا يختلف الرندر بين الخادم والمتصفح
const initialOptions = () => [
  { id: "opt-1", label: "" },
  { id: "opt-2", label: "" },
];

export default function Home() {
  const { user, signOut, accessToken } = useAuth();
  const router = useRouter();
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

  // تفضيلات البروفايل تسبق الحالة المحلية عند تسجيل الدخول،
  // عشان اللي يحفظه المستخدم في الإعدادات يكون له أثر فعلي هنا
  useEffect(() => {
    if (!user) return;
    let active = true;

    profileService.get().then((result) => {
      if (!active || !result.ok) return;
      if (result.profile.tone) setTone(result.profile.tone);
      if (result.profile.default_mood) setMood(result.profile.default_mood);
    });

    profileService.touchLastSeen();

    return () => {
      active = false;
    };
  }, [user]);

  // نقل التركيز لعنوان الخطوة الجديدة.
  // بدونه، مستخدم قارئ الشاشة يضيع: الزر اللي كان مركّزاً عليه يختفي
  // مع الشاشة السابقة فيرجع التركيز لأول الصفحة بدون أي إعلان.
  // نتجاهل أول رندر حتى ما نخطف التركيز عند فتح الصفحة.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const heading = document.querySelector("[data-step-heading]");
    heading?.focus();
  }, [step, questionIndex]);

  // الثيم يتبع المزاج: نكتب data-mood على <html> فتتبدل متغيرات CSS كلها
  useEffect(() => {
    const root = document.documentElement;
    if (mood) root.dataset.mood = mood;
    else delete root.dataset.mood;
    return () => {
      delete root.dataset.mood;
    };
  }, [mood]);

  const category = categoryId ? getCategory(categoryId) : null;

  const filledOptions = useMemo(
    () =>
      options
        .filter((o) => o.label.trim())
        .map((o) => ({ ...o, label: o.label.trim() })),
    [options],
  );

  const weights = useMemo(
    () => (category ? weightsFor(category, answers, mood) : {}),
    [category, answers, mood],
  );

  const scored = useMemo(
    () =>
      category && filledOptions.length
        ? scoreOptions(category, filledOptions, ratings, weights)
        : [],
    [category, filledOptions, ratings, weights],
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
  const decide = useCallback(
    async (override) => {
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
              : { status: "failed", message: saved.message },
          );
        } catch (err) {
          console.error("[decide] save failed:", err);
          setSaveState({ status: "failed", message: "تعذر الحفظ في السجل." });
        }
      }
    },
    [filledOptions, answers, categoryId, weights, accessToken],
  );

  // المحادثة الصوتية تعطينا كل شي دفعة واحدة، بدون مرحلة التقييم
  const fromVoice = useCallback(
    (payload) => {
      setCategoryId(payload.categoryId);
      setOptions(
        payload.options.map((label, i) => ({ id: `voice-${i}`, label })),
      );
      setAnswers(payload.answers);
      setRatings({});
      decide(payload);
    },
    [decide],
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

  const isLanding = step === "landing";

  return (
    <>
      <SiteNav
        onHome={restart}
        onVoiceMode={() => setStep("voice")}
        onSignIn={() => router.push("/login")}
        onStart={() => {
          setStep("landing");
          document
            .getElementById("main")
            ?.scrollIntoView({ behavior: "smooth" });
        }}
      />

      <main
        id="main"
        className={
          "mx-auto flex w-full flex-1 flex-col gap-16 px-4 py-8 sm:px-6 sm:py-12 " +
          (isLanding ? "max-w-6xl" : "max-w-3xl")
        }
      >
        {/* شاشة الهبوط لها تخطيطها الخاص، وباقي الخطوات داخل بطاقة */}
        {isLanding ? (
          <>
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

            <HistorySection
              onSignIn={() => router.push("/login")}
              refreshKey={saveState?.status === "saved" ? "saved" : "idle"}
            />
          </>
        ) : (
          <Card>
            {step === "voice" && (
              <VoiceMode
                onComplete={fromVoice}
                onCancel={() => setStep("landing")}
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
        )}
      </main>

      <SiteFooter />
    </>
  );
}
