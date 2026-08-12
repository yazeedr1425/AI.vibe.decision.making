"use client";

import { useMemo, useState } from "react";
import { getCategory } from "@/lib/engine/categories";
import { scoreOptions, weightsFor } from "@/lib/engine/score";
import { DEFAULT_TONE, TONES } from "@/lib/engine/tone";
import CategoryPicker from "./components/CategoryPicker";
import OptionsInput from "./components/OptionsInput";
import QuestionList from "./components/QuestionList";
import RatingGrid from "./components/RatingGrid";
import Result from "./components/Result";
import { Card, Choice, Stepper } from "./components/ui";

const STEPS = [
  { id: "category", label: "الفئة" },
  { id: "options", label: "الخيارات" },
  { id: "questions", label: "الأسئلة" },
  { id: "ratings", label: "التقييم" },
  { id: "result", label: "النتيجة" },
];

// معرّفات ثابتة للخيارين الأوليين حتى لا يختلف الرندر بين الخادم والمتصفح
const initialOptions = () => [
  { id: "opt-1", label: "" },
  { id: "opt-2", label: "" },
];

export default function Home() {
  const [step, setStep] = useState("category");
  const [categoryId, setCategoryId] = useState(null);
  const [options, setOptions] = useState(initialOptions);
  const [answers, setAnswers] = useState({});
  const [ratings, setRatings] = useState({});
  const [tone, setTone] = useState(DEFAULT_TONE);

  const category = categoryId ? getCategory(categoryId) : null;
  const filledOptions = useMemo(
    () => options.filter((o) => o.label.trim()).map((o) => ({ ...o, label: o.label.trim() })),
    [options]
  );

  const weights = useMemo(
    () => (category ? weightsFor(category, answers) : {}),
    [category, answers]
  );

  const scored = useMemo(
    () =>
      category && filledOptions.length
        ? scoreOptions(category, filledOptions, ratings, weights)
        : [],
    [category, filledOptions, ratings, weights]
  );

  const pickCategory = (id) => {
    setCategoryId(id);
    setAnswers({});
    setRatings({});
    setStep("options");
  };

  const restart = () => {
    setStep("category");
    setCategoryId(null);
    setOptions(initialOptions());
    setAnswers({});
    setRatings({});
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10 sm:py-16">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">احسم</h1>
          <p className="text-sm opacity-60">مساعد القرارات الذكي والمرح</p>
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

      <Stepper steps={STEPS} current={step} />

      <Card>
        {step === "category" && <CategoryPicker onPick={pickCategory} />}

        {step === "options" && (
          <OptionsInput
            category={category}
            options={options}
            setOptions={setOptions}
            onNext={() => setStep("questions")}
            onBack={() => setStep("category")}
          />
        )}

        {step === "questions" && (
          <QuestionList
            category={category}
            answers={answers}
            setAnswers={setAnswers}
            onNext={() => setStep("ratings")}
            onBack={() => setStep("options")}
          />
        )}

        {step === "ratings" && (
          <RatingGrid
            category={category}
            options={filledOptions}
            ratings={ratings}
            setRatings={setRatings}
            weights={weights}
            onNext={() => setStep("result")}
            onBack={() => setStep("questions")}
          />
        )}

        {step === "result" && scored.length > 0 && (
          <Result
            category={category}
            scored={scored}
            tone={tone}
            onRestart={restart}
            onBack={() => setStep("ratings")}
          />
        )}
      </Card>
    </main>
  );
}
