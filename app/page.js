"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getCategory } from "@/lib/engine/categories";
import { frameToCategory, pathAnswers } from "@/lib/engine/frame";
import { withPriors } from "@/lib/engine/duel";
import { MIN_OPTIONS, scoreOptions, weightsFor } from "@/lib/engine/score";
import { DEFAULT_TONE, TONES } from "@/lib/engine/tone";
import { decisionService } from "@/lib/services/decisions";
import { frameService } from "@/lib/services/frame";
import { groupService } from "@/lib/services/group";
import { profileService } from "@/lib/services/profile";
import { useMood } from "@/lib/theme/MoodProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import Landing from "./components/Landing";
import QuestionStep from "./components/QuestionStep";
import RatingGrid from "./components/RatingGrid";
import Duel from "./components/Duel";
import HistorySection from "./components/HistorySection";
import Result from "./components/Result";
import SiteFooter from "./components/SiteFooter";
import SiteNav from "./components/SiteNav";
import Thinking from "./components/Thinking";
import BreakdownFlow from "./components/BreakdownFlow";
import VoiceMode from "./components/VoiceMode";
import Reveal from "./components/Reveal";
import { Card } from "./components/ui";

// معرّفات ثابتة للخيارين الأوليين حتى لا يختلف الرندر بين الخادم والمتصفح
// نفس ما يفرضه ‎/api/frame‎: نداء بخيار من حرف واحد مرفوض سلفاً
const MIN_LABEL_LENGTH = 2;

const initialOptions = () => [
  { id: "opt-1", label: "" },
  { id: "opt-2", label: "" },
];

export default function Home() {
  const { user, signOut, accessToken } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState("landing");
  const [questionIndex, setQuestionIndex] = useState(0);
  // الإطار المولّد بدل الفئة المختارة. المحادثة الصوتية خارج نطاق
  // هذي الجولة فتظل ترجّع معرّف فئة ثابتة — مصدران للقالب، ومخرَج
  // واحد يقرأه المحرك.
  //
  // موسوم بالخيارات التي بُني لها: الإطلاق المبكر يعني أن الإطار قد
  // يسبق تعديلاً على النص، وإطارٌ لخيارٍ ما عاد موجوداً يسأل عن قرار
  // غير الذي أمام المستخدم. الاشتقاق عند الرندر يخلي القديم يسقط من
  // نفسه بلا تصفير داخل أثر.
  const [framed, setFramed] = useState(null);
  const [voiceCategoryId, setVoiceCategoryId] = useState(null);
  const [frameError, setFrameError] = useState(null);
  // المزاج يعيش في المزوّد الجذري حتى يبقى اللون عبر كل الصفحات
  const { mood, setMood } = useMood();
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

  const filledOptions = useMemo(
    () =>
      options
        .filter((o) => o.label.trim())
        .map((o) => ({ ...o, label: o.label.trim() })),
    [options],
  );

  const optionsKey = filledOptions.map((o) => o.label).join("|");
  const frame = framed?.key === optionsKey ? framed.frame : null;

  // القالب الذي يقرأه المحرك: مولّد من الإطار، أو فئة ثابتة لو جاء
  // القرار من المحادثة الصوتية. `frameToCategory` يعتمد على الإجابات
  // لأن الشجرة تختار سؤالها الثاني حسب الأولى، فالاشتقاق عند الرندر
  // لا في حالة مخزَّنة.
  const category = useMemo(
    () =>
      frame
        ? frameToCategory(frame, answers)
        : voiceCategoryId
          ? getCategory(voiceCategoryId)
          : null,
    [frame, answers, voiceCategoryId],
  );

  // الفئة المحفوظة في السجل — قيد `CHECK` على العمود، فلها قيمة دائماً
  const decisionCategory = frame?.category ?? voiceCategoryId ?? "life";

  const weights = useMemo(
    () => (category ? weightsFor(category, answers, mood) : {}),
    [category, answers, mood],
  );

  // تقدير النموذج يملأ ما لم يلمسه المستخدم — اشتقاقاً عند الرندر لا
  // ضبطاً داخل أثر، فتعديلٌ سبق وصول الإطار ما ينمسح
  const seeded = useMemo(
    () => withPriors(ratings, frame, filledOptions),
    [ratings, frame, filledOptions],
  );

  const scored = useMemo(
    () =>
      category && filledOptions.length
        ? scoreOptions(category, filledOptions, seeded, weights)
        : [],
    [category, filledOptions, seeded, weights],
  );

  // المبارزة للخيارين بإطار مولّد. المحادثة الصوتية بلا إطار، وثلاثة
  // خيارات فأكثر تبقى على الشبكة لأن القيمة المطلقة تهم هناك
  const isDuel = filledOptions.length === 2 && Boolean(frame);

  // الإطار يُبنى قبل أول سؤال، لأن الأسئلة نفسها منه. النداء الجاري
  // محفوظ في مرجع لا حالة: الضغط أثناء البناء ينتظر النداء نفسه بدل
  // ما يطلق ثانياً، والمرجع لا يسبب رندراً.
  const pendingRef = useRef({ key: null, promise: null });

  const buildFrame = useCallback((key, labels) => {
    if (pendingRef.current.key === key) return pendingRef.current.promise;

    const promise = frameService
      .build({ options: labels })
      .then((result) => {
        if (pendingRef.current.key === key) {
          pendingRef.current = { key: null, promise: null };
        }
        if (!result.ok) {
          setFrameError(result.message);
          return null;
        }
        setFrameError(null);
        setFramed({ key, frame: result.frame });
        return result.frame;
      });

    pendingRef.current = { key, promise };
    return promise;
  }, []);

  // الإطلاق المبكر: عند خروج المؤشر من حقل خيار، لا عند الضغط على
  // «احسمها لي». المستخدم عادةً يقرأ ما كتبه قبل ما يمد يده للزر،
  // فهذي ثانيتان إلى أربع مجاناً — وضربة الكاش في المسار تخلي الخروج
  // والدخول المتكرر بلا كلفة.
  //
  // الشرط أن تكون كل الحقول المعروضة مكتوبة: حقل فاضٍ يعني أن
  // المستخدم ما خلّص، وبناء إطار لخيارات ناقصة يُرمى بعد سطر.
  const prefetchFrame = useCallback(() => {
    const labels = options.map((o) => o.label.trim());
    if (labels.length < MIN_OPTIONS) return;
    if (labels.some((l) => l.length < MIN_LABEL_LENGTH)) return;

    const key = labels.join("|");
    if (framed?.key === key || pendingRef.current.key === key) return;
    buildFrame(key, labels);
  }, [options, framed, buildFrame]);

  const start = async () => {
    setAnswers({});
    setRatings({});
    setQuestionIndex(0);
    setFrameError(null);

    // جاهز من الإطلاق المبكر؟ انتقال فوري بلا شاشة انتظار
    if (frame) {
      setStep("questions");
      return;
    }

    setStep("reading");
    const labels = filledOptions.map((o) => o.label);
    const built = await buildFrame(labels.join("|"), labels);
    setStep(built ? "questions" : "landing");
  };

  // القرار الجماعي: ينشئ ويوجه لصفحة التصويت — المنشئ يشارك الرابط
  // من هناك. يحتاج دخولاً لأن القرار يُملك، والضيوف يصوتون بلا حساب.
  const [groupBusy, setGroupBusy] = useState(false);
  const createGroup = async () => {
    if (groupBusy) return;
    if (!user) {
      router.push("/login");
      return;
    }
    setGroupBusy(true);
    // التصويت يحتاج فئة للحفظ لا أسئلة، فالإطار هنا وسيلة لا غاية.
    // ولو فشل نكمل بـ«حياة» بدل ما نمنع إنشاء تصويت لأجل حقل تصنيف —
    // هذا سقوط في وسم داخلي، لا محتوى مصنوع يُعرض على أنه مولّد.
    const labels = filledOptions.map((o) => o.label);
    const built = frame ?? (await buildFrame(labels.join("|"), labels));
    const result = await groupService.createGroup({
      categoryId: built?.category ?? "life",
      options: labels,
    });
    if (!result.ok) {
      setGroupBusy(false);
      if (result.reason === "unauthenticated") router.push("/login");
      else setApiError(result.message ?? "ما قدرنا ننشئ التصويت.");
      return;
    }
    router.push(`/vote/${result.code}`);
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
      // إجابات المسار وحدها: الرجوع وتغيير السؤال الأول يبدّل الفرع،
      // فتبقى إجابة الفرع القديم بمفتاح ما عاد أحد يسأل عنه — وإرسالها
      // للنموذج يعني موقفاً تراجع عنه المستخدم
      const finalAnswers =
        override?.answers ?? (frame ? pathAnswers(frame, answers) : answers);
      const finalCategory = override?.categoryId ?? decisionCategory;
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
            // الإطار يحمل الأسئلة والمعايير بنصوصها، فيصف البرومبت
            // إجابات المستخدم بكلامه بدل مفاتيح مولّدة
            frame: override?.frame ?? frame,
          }),
        });

        const payload = await res.json().catch(() => null);

        if (!res.ok || !payload?.ok) {
          setApiError(payload?.error ?? `تعذر الوصول للمحرك (${res.status})`);
        } else {
          result = {
            selected_option: payload.selected_option,
            funny_reason: payload.funny_reason,
            // الطبقة الأعمق اختيارية — الحقل الغائب يعني بطاقة أقل
            decisive_criterion: payload.decisive_criterion,
            edge: payload.edge,
            cost_of_switching: payload.cost_of_switching,
            flip_condition: payload.flip_condition,
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
    [filledOptions, answers, frame, decisionCategory, weights, accessToken],
  );

  // المحادثة الصوتية تعطينا كل شي دفعة واحدة — بما فيه التقييمات.
  // الوكيل يرجّعها مفهرسة بنص الخيار، والمحرك يبيها بمعرّف الخيار.
  const fromVoice = useCallback(
    (payload) => {
      const voiceOptions = payload.options.map((label, i) => ({
        id: `voice-${i}`,
        label,
      }));

      const byId = {};
      for (const option of voiceOptions) {
        const given = payload.ratings?.[option.label];
        if (given) byId[option.id] = given;
      }

      setFramed(null);
      setVoiceCategoryId(payload.categoryId);
      setOptions(voiceOptions);
      setAnswers(payload.answers);
      setRatings(byId);
      decide({ ...payload, ratings: byId });
    },
    [decide],
  );

  const restart = () => {
    setStep("landing");
    setQuestionIndex(0);
    setFramed(null);
    setVoiceCategoryId(null);
    setFrameError(null);
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
          "flex w-full flex-1 flex-col " +
          (isLanding
            ? ""
            : "mx-auto max-w-3xl gap-16 px-4 py-8 sm:px-6 sm:py-12")
        }
      >
        {/* شاشة الهبوط أشرطة بعرض الشاشة تدير حاوياتها بنفسها،
            وباقي الخطوات داخل بطاقة ضيقة */}
        {isLanding ? (
          <>
            <Landing
              mood={mood}
              setMood={setMood}
              frame={frame}
              frameError={frameError}
              onOptionBlur={prefetchFrame}
              options={options}
              setOptions={setOptions}
              onStart={start}
              onVoiceMode={() => setStep("voice")}
              onBreakdown={() => setStep("breakdown")}
              onGroup={createGroup}
              groupBusy={groupBusy}
            />

            <Reveal className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
              <HistorySection
                onSignIn={() => router.push("/login")}
                refreshKey={saveState?.status === "saved" ? "saved" : "idle"}
              />
            </Reveal>
          </>
        ) : step === "reading" || step === "thinking" ? (
          // التفكير والنتيجة يجيبان سطحهما الحبري بنفسهما —
          // البطاقة الورقية للخطوات اللي يكتب فيها المستخدم
          <Thinking reading={step === "reading"} />
        ) : step === "result" && scored.length > 0 ? (
          <Result
            scored={scored}
            frame={frame}
            recommendation={recommendation}
            apiError={apiError}
            saveState={saveState}
            tone={tone}
            onRestart={restart}
            onBack={() => setStep("ratings")}
            onRetry={decide}
          />
        ) : (
          <Card>
            {step === "voice" && (
              <VoiceMode
                onComplete={fromVoice}
                onCancel={() => setStep("landing")}
              />
            )}

            {/* المفتاح يعيد التفكيك من أوله لو تغيرت الخيارات */}
            {step === "breakdown" && (
              <BreakdownFlow
                key={filledOptions.map((o) => o.label).join("|")}
                options={filledOptions.map((o) => o.label)}
                categoryId={frame?.category ?? null}
                onCancel={() => setStep("landing")}
                onRestart={restart}
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

            {step === "ratings" &&
              category &&
              (isDuel ? (
                <Duel
                  frame={frame}
                  options={filledOptions}
                  ratings={seeded}
                  setRatings={setRatings}
                  weights={weights}
                  onNext={() => decide()}
                  onBack={() => {
                    setQuestionIndex(category.questions.length - 1);
                    setStep("questions");
                  }}
                />
              ) : (
                <RatingGrid
                  category={category}
                  options={filledOptions}
                  ratings={seeded}
                  setRatings={setRatings}
                  weights={weights}
                  onNext={() => decide()}
                  onBack={() => {
                    setQuestionIndex(category.questions.length - 1);
                    setStep("questions");
                  }}
                />
              ))}
          </Card>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
