"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { CATEGORIES, getCategory } from "@/lib/engine/categories";
import { MAX_OPTIONS, MIN_OPTIONS } from "@/lib/engine/score";
import { listenOnce, speak, stopSpeaking } from "@/lib/voice/speech";
import { matchCandidate, matchCommand, parseSpokenOptions } from "@/lib/voice/match";
import { useVoice } from "@/lib/voice/VoiceProvider";
import { GhostButton, PrimaryButton, SectionHeading, Tag } from "./ui";

const INTRO =
  "كلّمني وأنا أعبّي الخيارات وأسألك وأحسمها. ولو الميكروفون ممنوع، بيظهر لك مربع كتابة ونكمل نفس المحادثة.";

// ---------------------------------------------------------------
// آلة الحالة — كل المنطق في reducer نقي، والأثر الجانبي (كلام/استماع)
// يتبع state.pending. هذا يلغي الاعتماد الدائري بين "اسأل" و"استقبل".
// ---------------------------------------------------------------

const stepsOf = (categoryId) => {
  const cat = categoryId ? getCategory(categoryId) : null;
  return ["category", "options", ...(cat?.questions.map((q) => q.key) ?? [])];
};

function promptFor(stage, categoryId) {
  const step = stepsOf(categoryId)[stage];
  if (!step) return null;
  if (step === "category") {
    return `وش نوع القرار؟ ${CATEGORIES.map((c) => c.label).join("، ")}؟`;
  }
  if (step === "options") {
    return `وش الخيارات؟ قل لي من ${MIN_OPTIONS} إلى ${MAX_OPTIONS} خيارات، وافصل بينها بكلمة "أو".`;
  }
  const question = getCategory(categoryId)?.questions.find((q) => q.key === step);
  return question
    ? `${question.label} ${question.choices.map((c) => c.label).join("، أو ")}؟`
    : null;
}

const initialState = {
  started: false,
  stage: 0,
  draft: { categoryId: null, options: [], answers: {} },
  log: [],
  pending: null, // { text, id } — ما يجب نطقه ثم الاستماع بعده
  result: null,
  cancelled: false,
};

let pendingId = 0;
const say = (state, text) => ({
  ...state,
  log: [...state.log, { who: "ahsem", text }],
  pending: { text, id: ++pendingId },
});

function reducer(state, action) {
  switch (action.type) {
    case "start": {
      const text = promptFor(0, null);
      return { ...initialState, started: true, log: [{ who: "ahsem", text }], pending: { text, id: ++pendingId } };
    }

    case "mic-blocked":
      return say({ ...state, pending: null }, "الميكروفون ممنوع — اكتب لي هنا ونكمل نفس المحادثة.");

    case "misheard":
      return say(state, "ما سمعت شي — عيد أو اكتبها.");

    case "input": {
      const text = (action.text ?? "").trim();
      if (!text) return state;

      const withUser = { ...state, log: [...state.log, { who: "user", text }] };
      const command = matchCommand(text);

      if (command === "stop") return { ...withUser, cancelled: true, pending: null };
      if (command === "repeat") {
        return say(withUser, promptFor(state.stage, state.draft.categoryId));
      }
      if (command === "back") {
        const stage = Math.max(0, state.stage - 1);
        return say({ ...withUser, stage }, promptFor(stage, state.draft.categoryId));
      }

      const steps = stepsOf(state.draft.categoryId);
      const step = steps[state.stage];

      if (step === "category") {
        const picked = matchCandidate(
          text,
          CATEGORIES.map((c) => ({ value: c.id, labels: [c.label, c.en, c.hint] }))
        );
        if (!picked) return say(withUser, "ما ضبطت معي. قل مثلاً: أكل، أو ترفيه.");
        const next = { ...withUser, draft: { ...withUser.draft, categoryId: picked }, stage: 1 };
        return say(next, promptFor(1, picked));
      }

      if (step === "options") {
        const parsed = parseSpokenOptions(text, { max: MAX_OPTIONS });
        if (parsed.length < MIN_OPTIONS) {
          return say(withUser, `أبغى ${MIN_OPTIONS} خيارات على الأقل. مثلاً: برجر أو سوشي.`);
        }
        const next = {
          ...withUser,
          draft: { ...withUser.draft, options: parsed },
          stage: 2,
          log: [...withUser.log, { who: "ahsem", text: `تمام: ${parsed.join("، ")}.` }],
        };
        return say(next, promptFor(2, withUser.draft.categoryId));
      }

      const category = getCategory(state.draft.categoryId);
      const question = category?.questions.find((q) => q.key === step);
      if (!question) return withUser;

      const picked = matchCandidate(
        text,
        question.choices.map((c) => ({ value: c.value, labels: [c.label, c.en] }))
      );
      if (!picked) {
        return say(
          withUser,
          `ما فهمت. اختر: ${question.choices.map((c) => c.label).join("، أو ")}.`
        );
      }

      const answers = { ...state.draft.answers, [question.key]: picked };
      const draft = { ...state.draft, answers };
      const nextStage = state.stage + 1;

      if (nextStage >= steps.length) {
        return {
          ...say({ ...withUser, draft }, "تمام، خلني أحسمها لك."),
          result: draft,
        };
      }

      return say({ ...withUser, draft, stage: nextStage }, promptFor(nextStage, draft.categoryId));
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------

export default function VoiceMode({ onComplete, onCancel }) {
  const { stt } = useVoice();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [listening, setListening] = useState(false);
  const [micBlocked, setMicBlocked] = useState(false);
  const [typed, setTyped] = useState("");
  const stopListening = useRef(null);

  const { started, stage, draft, log, pending, result, cancelled } = state;
  const steps = stepsOf(draft.categoryId);
  const textOnly = !stt || micBlocked;

  // ينطق الرسالة المعلّقة ثم يستمع
  useEffect(() => {
    if (!pending || cancelled || result) return;
    let dead = false;

    speak(pending.text, {
      onEnd: () => {
        if (dead || !stt || micBlocked) return;
        setListening(true);
        stopListening.current = listenOnce({
          onResult: (text) => {
            setListening(false);
            dispatch({ type: "input", text });
          },
          onError: (code) => {
            setListening(false);
            if (code === "not-allowed" || code === "service-not-allowed") {
              setMicBlocked(true);
              dispatch({ type: "mic-blocked" });
            } else if (code === "no-speech") {
              dispatch({ type: "misheard" });
            }
          },
        });
      },
    });

    return () => {
      dead = true;
      stopSpeaking();
      stopListening.current?.();
    };
  }, [pending, cancelled, result, stt, micBlocked]);

  useEffect(() => {
    if (result) onComplete?.(result);
  }, [result, onComplete]);

  useEffect(() => {
    if (cancelled) onCancel?.();
  }, [cancelled, onCancel]);

  useEffect(() => () => stopSpeaking(), []);

  const listenAgain = () => {
    if (!stt || listening) return;
    setListening(true);
    stopListening.current = listenOnce({
      onResult: (text) => {
        setListening(false);
        dispatch({ type: "input", text });
      },
      onError: () => setListening(false),
    });
  };

  const submitTyped = (e) => {
    e.preventDefault();
    const value = typed.trim();
    if (!value) return;
    setTyped("");
    dispatch({ type: "input", text: value });
  };

  if (!started) {
    return (
      <div className="flex flex-col gap-5">
        <SectionHeading tag="talk to ehsim" title="وضع المحادثة الصوتية" sub={INTRO} />
        {!stt && (
          <p className="rounded-xl border border-dashed border-line bg-card px-4 py-3 text-sm text-muted">
            متصفحك ما يدعم التعرف على الكلام — بنكمل بالكتابة، ونفس المحادثة تشتغل.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <PrimaryButton onClick={() => dispatch({ type: "start" })}>
            🎧 ابدأ المحادثة الصوتية
          </PrimaryButton>
          <GhostButton onClick={onCancel}>رجوع</GhostButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-bold">المحادثة</h2>
        <Tag>{`step ${Math.min(stage + 1, steps.length)} / ${steps.length}`}</Tag>
      </div>

      <div className="flex max-h-80 flex-col gap-3 overflow-y-auto" aria-live="polite">
        {log.map((entry, i) => (
          <div
            key={i}
            className={"flex " + (entry.who === "user" ? "justify-start" : "justify-end")}
          >
            <p
              className={
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed " +
                (entry.who === "user"
                  ? "border border-line bg-card"
                  : "bg-accent text-accent-ink")
              }
            >
              {entry.text}
            </p>
          </div>
        ))}
      </div>

      {listening && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <span className="inline-block h-2 w-2 animate-ping rounded-full bg-accent" />
          أسمعك…
        </p>
      )}

      <form onSubmit={submitTyped} className="flex items-center gap-2">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={textOnly ? "اكتب ردك هنا" : "أو اكتبها"}
          aria-label="اكتب ردك"
          className="w-full rounded-xl border border-line bg-card px-4 py-3 outline-none transition-colors focus:border-accent"
        />
        <PrimaryButton type="submit" className="shrink-0 px-5 py-3">
          أرسل
        </PrimaryButton>
      </form>

      <div className="flex flex-wrap gap-3">
        {stt && !micBlocked && (
          <GhostButton onClick={listenAgain} disabled={listening}>
            🎙️ {listening ? "أسمعك…" : "تكلم"}
          </GhostButton>
        )}
        <GhostButton onClick={onCancel}>إلغاء</GhostButton>
      </div>
    </div>
  );
}
