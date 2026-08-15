"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { patternsService } from "@/lib/services/patterns";
import { useAuth } from "@/lib/auth/AuthProvider";
import { hindi } from "./ui";
import { Brain, Lightbulb, RefreshCw, Sparkles, TriangleAlert } from "./icons";

/**
 * "شخصيتك القرارية" — الجهة المقابلة لـ OutcomeAsk.
 *
 * كل ما سجّل المستخدم نتيجة قرار، صارت هذي القراءة أدق. هذا الفرق بين
 * ميزة تُنسخ في يوم وميزة تحتاج شهر استخدام حتى تُقلَّد.
 *
 * القراءة بضغطة لا تلقائياً: النداء يكلّف، والسجل ما يتغيّر بين زيارة
 * وزيارة إلا لو حسم المستخدم قراراً جديداً.
 *
 * البطاقة حبرية عمداً: الحبر في هذا التصميم للأحكام — والقراءة حكمٌ
 * على صاحب السجل نفسه، فتقفل الصفحة بنفس لون بطاقة النتيجة.
 */
export default function PatternsCard() {
  const { user, accessToken } = useAuth();
  // القراءة موسومة بصاحبها: لو تبدّل المستخدم، اللي على الشاشة يخص
  // غيره. الاشتقاق أنظف من تصفير الحالة داخل أثر — التصفير يسبب
  // رندراً متتالياً، والوسم يجعل النتيجة القديمة تسقط من نفسها.
  const [fetched, setFetched] = useState(null);
  const abort = useRef(null);

  useEffect(() => () => abort.current?.abort(), []);

  const read = useCallback(async () => {
    if (!user) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;

    const owner = user.id;
    setFetched({ userId: owner, status: "loading" });

    try {
      const token = await accessToken();
      const payload = await patternsService.read({
        token,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      setFetched(
        payload.ready
          ? {
              userId: owner,
              status: "ready",
              reading: payload.reading,
              stats: payload.stats,
            }
          : {
              userId: owner,
              status: "needs_more",
              need: payload.need,
              rated: payload.rated,
            },
      );
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("[patterns] read failed:", err);
      setFetched({ userId: owner, status: "error", message: err.userMessage });
    }
  }, [accessToken, user]);

  if (!user) return null;

  const state =
    fetched?.userId === user.id ? fetched : { status: "idle" };

  return (
    <div className="on-ink card-shadow rounded-[var(--radius-card)] bg-ink p-6 text-on-ink sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2.5 text-lg font-bold">
          <Brain size={20} className="text-accent" />
          شخصيتك القرارية
        </h3>

        {state.status !== "loading" && (
          <button
            type="button"
            onClick={read}
            className="flex items-center gap-1.5 rounded-full border border-line-ink px-4 py-2 text-sm transition-colors hover:border-on-ink"
          >
            {state.status === "ready" ? (
              <RefreshCw size={14} />
            ) : (
              <Sparkles size={14} className="text-accent" />
            )}
            {state.status === "ready" ? "اقرأها من جديد" : "اقرأ أنماطي"}
          </button>
        )}
      </div>

      {state.status === "idle" && (
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-on-ink-muted">
          كل ما قلت لنا نتيجة قرار، صارت القراءة أدق. اضغط الزر ونقول لك وش
          نشوفه في طريقة حسمك.
        </p>
      )}

      {state.status === "loading" && (
        <div className="mt-5 flex flex-col gap-2.5" aria-live="polite">
          <span className="sr-only">نقرأ سجلك…</span>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-4 animate-pulse rounded-full bg-white/10"
              style={{ width: `${100 - i * 18}%` }}
            />
          ))}
        </div>
      )}

      {state.status === "needs_more" && (
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-on-ink-muted">
          {state.rated === 0
            ? "ما قيّمت أي قرار بعد. قل لنا عن قراراتك السابقة كانت صح ولا لا، وبعدها نقرأ لك."
            : `قيّمت ${hindi(state.rated)} قرارات — باقي ${hindi(state.need)} وتبان أنماطك. أقل من كذا نقرأ صدفة مو نمطاً.`}
        </p>
      )}

      {state.status === "error" && (
        <p
          role="alert"
          className="mt-3 flex items-center gap-2 text-sm text-on-ink-muted"
        >
          <TriangleAlert size={15} className="shrink-0" />
          {state.message}
        </p>
      )}

      {state.status === "ready" && (
        <div className="mt-5 flex flex-col gap-4">
          <p className="display text-2xl font-bold leading-snug">
            {state.reading.headline}
          </p>

          <ul className="flex flex-col gap-3">
            {state.reading.patterns.map((pattern) => (
              <li
                key={pattern.title}
                className="rounded-xl bg-white/5 px-4 py-3"
              >
                <p className="text-sm font-semibold">{pattern.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-on-ink-muted">
                  {pattern.detail}
                </p>
              </li>
            ))}
          </ul>

          {/* الفقرة اللي ما أحد يبي يقرأها وهي اللي تنفع */}
          {state.reading.blindSpot && (
            <div className="rounded-xl border border-dashed border-line-ink px-4 py-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <TriangleAlert size={15} className="shrink-0 text-accent" />
                النقطة العمياء
              </p>
              <p className="mt-1 text-sm leading-relaxed text-on-ink-muted">
                {state.reading.blindSpot}
              </p>
            </div>
          )}

          <p className="glow-sm flex items-start gap-2 rounded-xl bg-accent px-4 py-3 text-sm leading-relaxed text-accent-ink">
            <Lightbulb size={16} className="mt-0.5 shrink-0" />
            {state.reading.advice}
          </p>

          {/* بصيغة "على ٦ قرار" ينكسر العدد المعدود — الصحيح "قرارات"
              للثلاثة حتى العشرة و"قرارًا" فوقها. نتفادى التمييز أصلاً
              بدل ما نبني جدول جمع لسطر واحد. */}
          <p className="text-xs text-on-ink-muted">
            مبنية على القرارات اللي قيّمتها: {hindi(state.stats.rated)} من{" "}
            {hindi(state.stats.total)} محفوظة.
          </p>
        </div>
      )}
    </div>
  );
}
