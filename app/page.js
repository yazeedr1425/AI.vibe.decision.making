"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { tallyOptions } from "@/lib/engine/duel";
import { DEFAULT_TONE, TONES } from "@/lib/engine/tone";
import { decisionService } from "@/lib/services/decisions";
import { duelService } from "@/lib/services/duel";
import { profileService } from "@/lib/services/profile";
import { useMoodTheme } from "@/lib/theme/useMoodTheme";
import { useAuth } from "@/lib/auth/AuthProvider";
import Landing from "./components/Landing";
import DuelStep from "./components/DuelStep";
import QuestionSkeleton from "./components/QuestionSkeleton";
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
  const [mood, setMood] = useState(null);
  const [options, setOptions] = useState(initialOptions);
  const [answers, setAnswers] = useState({});
  const [tone, setTone] = useState(DEFAULT_TONE);
  const [recommendation, setRecommendation] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [saveState, setSaveState] = useState(null);

  // أسئلة هذي المفاضلة، مولّدة من الخيارات. تبقى null أثناء التوليد
  // فيظهر الهيكل بدلها.
  const [questions, setQuestions] = useState(null);
  const askAbort = useRef(null);

  useEffect(() => () => askAbort.current?.abort(), []);

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

  // الثيم يتبع المزاج — نفس الـ hook المستخدم في الإعدادات
  useMoodTheme(mood);

  const filledOptions = useMemo(
    () =>
      options
        .filter((o) => o.label.trim())
        .map((o) => ({ ...o, label: o.label.trim() })),
    [options],
  );

  // كل سؤال بُعد، وجوابه الخيار اللي يكسبه. اللي يكسب أكثر أبعاد يفوز.
  const scored = useMemo(
    () =>
      questions && filledOptions.length
        ? tallyOptions(questions, filledOptions, answers)
        : [],
    [questions, filledOptions, answers],
  );

  // ننتقل لشاشة الأسئلة فوراً ونولّد خلفها — إبقاء المستخدم على شاشة
  // الهبوط ينتظر يخليه يظن إن الزر ما اشتغل.
  const start = useCallback(() => {
    setAnswers({});
    setQuestionIndex(0);
    setQuestions(null);
    setStep("questions");

    askAbort.current?.abort();
    const controller = new AbortController();
    askAbort.current = controller;

    duelService
      .questionsFor({
        options: filledOptions.map((o) => o.label),
        signal: controller.signal,
      })
      .then(({ questions: next, source }) => {
        if (controller.signal.aborted) return;
        console.info("[duel] source:", source);
        setQuestions(next);
      })
      .catch((err) => {
        if (err.name !== "AbortError") console.error("[duel] failed:", err);
      });
  }, [filledOptions]);

  // آخر سؤال يحسم مباشرة: السؤال نفسه صار هو التقييم، فما بقي
  // بينه وبين النتيجة خطوة.
  const nextQuestion = () => {
    if (questionIndex + 1 < questions.length) setQuestionIndex((i) => i + 1);
    else decideRef.current?.();
  };

  const backFromQuestion = () => {
    if (questionIndex === 0) setStep("landing");
    else setQuestionIndex((i) => i - 1);
  };

  // nextQuestion معرّفة قبل decide، فنمرّرها عبر مرجع بدل ما نعيد
  // ترتيب الملف كله.
  const decideRef = useRef(null);

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
            categoryId: null,
            options: labels,
            chosen: result.selected_option,
            reason: result.funny_reason,
            answers: finalAnswers,
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
    [filledOptions, answers, accessToken],
  );

  // الإسناد داخل أثر لا أثناء الرندر: الكتابة على ref وقت الرندر
  // تكسر قواعد React وتخلي القيمة غير متوقعة عند إعادة الرندر.
  useEffect(() => {
    decideRef.current = decide;
  }, [decide]);

  // المحادثة الصوتية تعطينا كل شي دفعة واحدة — بما فيه التقييمات.
  // الوكيل يرجّعها مفهرسة بنص الخيار، والمحرك يبيها بمعرّف الخيار.
  const fromVoice = useCallback(
    (payload) => {
      const voiceOptions = payload.options.map((label, i) => ({
        id: `voice-${i}`,
        label,
      }));

      setOptions(voiceOptions);
      setAnswers({});
      // وضع المحادثة يحسم مباشرة: وكيله يجمع كل شي بنفسه، وما يمرّ
      // على أسئلة المواجهة أصلاً.
      setQuestions([]);
      decide(payload);
    },
    [decide],
  );

  const restart = () => {
    askAbort.current?.abort();
    setStep("landing");
    setQuestionIndex(0);
    setMood(null);
    setOptions(initialOptions());
    setAnswers({});
    setQuestions(null);
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

            {/* الهيكل يحجز نفس تخطيط السؤال أثناء التوليد */}
            {step === "questions" && !questions && <QuestionSkeleton />}

            {step === "questions" && questions?.[questionIndex] && (
              <DuelStep
                question={questions[questionIndex]}
                index={questionIndex}
                total={questions.length}
                options={filledOptions}
                answers={answers}
                setAnswers={setAnswers}
                onAnswer={nextQuestion}
                onBack={backFromQuestion}
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
                onBack={() => {
                  setQuestionIndex(questions.length - 1);
                  setStep("questions");
                }}
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
