"use client";

import { useEffect, useRef, useState } from "react";
import { GhostButton } from "./ui";
import { Scale, TriangleAlert } from "./icons";

/**
 * محامي الخيار الخاسر.
 *
 * التوصية بلا اعتراض تنقرأ كرمية عملة، ومعها اعتراض جاد تنقرأ كقرار
 * مدروس. المتردد أحياناً ما يرتاح إلا لما يسمع أقوى ما يُقال ضد اللي
 * اختاره: يا يصمد القرار فيرتاح له، يا يكتشف إنه كان يبي الخيار
 * الثاني وينتظر من يأذن له.
 *
 * خلف زر لا تلقائي: نداء يكلّف على شاشة تظهر مع كل قرار، ومو كل
 * مستخدم يبي يسمع الطرف الثاني. الزر يختفي بعد المرافعة — محامي
 * يعيد مرافعته بصياغة ثانية يفقد هيبته.
 */
export default function DevilsAdvocate({
  options,
  chosen,
  challenger,
  categoryId,
  answers,
  reason,
}) {
  const [state, setState] = useState({ status: "idle" });
  const abort = useRef(null);

  useEffect(() => () => abort.current?.abort(), []);

  const plead = async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setState({ status: "loading" });

    try {
      const res = await fetch("/api/advocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          options,
          chosen,
          challenger,
          categoryId,
          answers,
          reason,
        }),
        signal: controller.signal,
      });
      const payload = await res.json().catch(() => null);
      if (controller.signal.aborted) return;

      if (!res.ok || !payload?.ok) {
        setState({
          status: "error",
          message: payload?.error ?? "ما قدرنا نجهز المرافعة، جرب مرة ثانية.",
        });
        return;
      }
      setState({
        status: "ready",
        argument: payload.argument,
        question: payload.question,
      });
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("[advocate] failed:", err);
      setState({ status: "error", message: "ما وصلنا للمحامي — تأكد من اتصالك." });
    }
  };

  if (state.status === "ready") {
    return (
      // مقلوبة عن فقاعة احسم: المتكلم غيره، والعين تلقطها كصوت ثاني
      <div role="status" className="flex flex-row-reverse items-start gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 rotate-3 items-center justify-center rounded-2xl border border-dashed border-line bg-card text-muted"
        >
          <Scale size={20} />
        </span>
        <div className="relative rounded-2xl rounded-se-sm border border-dashed border-line bg-card px-5 py-4">
          <span
            aria-hidden
            className="absolute -end-1.5 top-3 h-3 w-3 rotate-45 border-e border-t border-dashed border-line bg-card"
          />
          <p className="text-sm text-muted">محامي «{challenger}» يعترض:</p>
          <p className="mt-1.5 leading-relaxed">{state.argument}</p>
          <p className="mt-2 font-medium">{state.question}</p>
          <p className="mt-3 text-xs text-muted-soft">
            القرار لك دائمًا — المرافعة بس عشان تتأكد منه.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <GhostButton
        onClick={plead}
        disabled={state.status === "loading"}
        className="flex items-center gap-1.5"
      >
        <Scale size={16} />
        {state.status === "loading"
          ? "… يجهز مرافعته"
          : `وش يقول محامي «${challenger}»؟`}
      </GhostButton>

      {state.status === "error" && (
        <p role="alert" className="flex items-center gap-1.5 text-sm text-muted">
          <TriangleAlert size={15} className="shrink-0" />
          {state.message}
        </p>
      )}
    </div>
  );
}
