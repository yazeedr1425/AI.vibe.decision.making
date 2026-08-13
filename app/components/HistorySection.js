"use client";

import { useEffect, useState } from "react";
import { getCategory } from "@/lib/engine/categories";
import { decisionService } from "@/lib/services/decisions";
import { useAuth } from "@/lib/auth/AuthProvider";

const rtf = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });

function relativeTime(iso) {
  if (!iso) return "";
  const diffMs = new Date(iso).getTime() - Date.now();
  const minutes = Math.round(diffMs / 60000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

export default function HistorySection({ onSignIn, refreshKey }) {
  const { user } = useAuth();
  // النتيجة موسومة بصاحبها حتى نشتق الحالة بدل ما نضبطها داخل effect
  const [fetched, setFetched] = useState(null);

  useEffect(() => {
    if (!user) return;

    let active = true;
    decisionService.recentDecisions(3).then((result) => {
      if (!active) return;
      setFetched(
        result.ok
          ? { userId: user.id, status: "ready", decisions: result.decisions }
          : {
              userId: user.id,
              status: "error",
              decisions: [],
              message: result.message,
            },
      );
    });

    return () => {
      active = false;
    };
  }, [user, refreshKey]);

  const state = !user
    ? { status: "anonymous", decisions: [] }
    : fetched?.userId === user.id
      ? fetched
      : { status: "loading", decisions: [] };

  return (
    <section id="history" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-accent-strong">ارجع لها وقت ما تحتاج</p>
          <h2 className="text-2xl font-semibold sm:text-3xl">سجل القرارات</h2>
        </div>
        {state.status === "ready" && state.decisions.length > 0 && (
          <button
            type="button"
            className="rounded-full border border-line bg-card px-4 py-2 text-sm transition-colors hover:border-muted-soft"
          >
            ← عرض السجل كامل
          </button>
        )}
      </div>

      {state.status === "anonymous" && (
        <div className="rounded-2xl border border-dashed border-line bg-card p-6 text-center">
          <p className="font-medium">سجلك يبدأ بعد أول قرار تحفظه.</p>
          <p className="mt-1 text-sm text-muted">
            سجّل دخولك عشان نحفظ قراراتك ونتعلم من عاداتك.
          </p>
          <button
            type="button"
            onClick={onSignIn}
            className="mt-4 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85"
          >
            دخول
          </button>
        </div>
      )}

      {state.status === "loading" && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl border border-line bg-card"
            />
          ))}
        </div>
      )}

      {state.status === "error" && (
        <p className="rounded-2xl border border-dashed border-line bg-card p-5 text-sm text-muted">
          ⚠️ تعذر جلب السجل. {state.message}
        </p>
      )}

      {state.status === "ready" && state.decisions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-card p-6 text-center text-sm text-muted">
          ما فيه قرارات محفوظة بعد — أول قرار تحسمه بيظهر هنا.
        </div>
      )}

      {state.status === "ready" && state.decisions.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {state.decisions.map((d) => {
            const category = getCategory(d.category);
            return (
              <article
                key={d.id}
                className="card-shadow flex flex-col gap-3 rounded-2xl border border-line bg-card p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="pill">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    {category?.label ?? d.category}
                  </span>
                  <span className="text-xs text-muted-soft">
                    {relativeTime(d.createdAt)}
                  </span>
                </div>

                <h3 className="font-semibold leading-snug">{d.title}</h3>

                {d.chosen && (
                  <p className="flex items-center gap-2 rounded-xl bg-background px-3 py-2 text-sm">
                    <span className="text-accent">✓</span>
                    {d.chosen}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
