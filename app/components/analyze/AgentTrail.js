"use client";

import { Tag } from "../ui";

// خط الوكلاء وهو يشتغل. التحليل يأخذ حوالي دقيقة — بدون هذا
// المستخدم يشوف شاشة معلّقة ويفترض أنها تعطّلت.
//
// aria-live="polite" على الحاوية: قارئ الشاشة يعلن كل مرحلة
// عند بدايتها بدل ما يترك المستخدم بلا أي إشارة طوال الدقيقة.

const STATE_LABEL = {
  done: "اكتمل",
  running: "جارٍ",
  pending: "بالانتظار",
};

export default function AgentTrail({ steps, current, failed }) {
  return (
    <ol
      aria-live="polite"
      aria-busy={Boolean(current)}
      className="flex flex-col gap-3"
    >
      {steps.map((s) => {
        const state = s.done
          ? "done"
          : s.id === current
            ? "running"
            : "pending";
        const isFailed = failed === s.id;

        return (
          <li
            key={s.id}
            className={
              "flex items-start gap-3 rounded-2xl border p-4 transition-colors " +
              (isFailed
                ? "border-accent-strong bg-accent-soft"
                : state === "done"
                  ? "border-line bg-card"
                  : state === "running"
                    ? "border-accent bg-card"
                    : "border-line/60 bg-transparent opacity-55")
            }
          >
            <span
              aria-hidden="true"
              className={
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold " +
                (isFailed
                  ? "bg-accent-strong text-accent-ink"
                  : state === "done"
                    ? "bg-accent text-accent-ink"
                    : state === "running"
                      ? "border-2 border-accent bg-card"
                      : "border border-line bg-card text-muted")
              }
            >
              {isFailed ? "!" : state === "done" ? "✓" : s.index}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{s.label}</span>
                <Tag>{s.en}</Tag>
                {state === "running" && !isFailed && (
                  <span className="pill animate-pulse">يشتغل الآن…</span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-muted">{s.note}</p>
              {s.detail && (
                <p className="mt-1 text-sm text-accent-strong">{s.detail}</p>
              )}
              {/* الحالة نصاً لقارئ الشاشة — العلامة أعلاه aria-hidden */}
              <span className="sr-only">{STATE_LABEL[state]}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
