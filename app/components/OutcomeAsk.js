"use client";

import { useState } from "react";
import { OUTCOMES, feedbackService } from "@/lib/services/feedback";
import { Check, Scale, TriangleAlert } from "./icons";

const ICONS = { good: Check, mixed: Scale, regret: TriangleAlert };

/**
 * "كان قرار صح؟" تحت كل قرار في السجل.
 *
 * هذا نصف الحلقة الناقص: /api/decide كان يقرأ satisfaction من أول يوم
 * ويحطه في البرومبت، وما كان فيه شي يكتبه. من هنا يبدأ التعلم.
 *
 * الأزرار الثلاثة تبقى ظاهرة حتى بعد الحفظ — المستخدم يغيّر رأيه بعد
 * أسبوع، وإخفاء الأزرار يخليه يظن إن الحكم نهائي.
 */
export default function OutcomeAsk({ decisionId, satisfaction, onRecorded }) {
  const [saved, setSaved] = useState(satisfaction ?? null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const record = async (outcome) => {
    if (busy) return;
    setBusy(outcome.id);
    setError(null);

    const previous = saved;
    setSaved(outcome.value); // تفاؤلي — الضغطة تبان فوراً

    const result = await feedbackService.record(decisionId, outcome.value);
    setBusy(null);

    if (!result.ok) {
      setSaved(previous); // نرجّعها: لا نُظهر رأياً ما انحفظ
      setError(result.message);
      return;
    }
    onRecorded?.(decisionId, outcome.value);
  };

  return (
    <div className="mt-auto flex flex-col gap-2 border-t border-line pt-3">
      <p className="text-xs text-muted">
        {saved == null ? "كان قرار صح؟" : "رأيك فيه"}
      </p>

      <div
        role="group"
        aria-label="نتيجة القرار"
        className="flex flex-wrap gap-1.5"
      >
        {OUTCOMES.map((outcome) => {
          const Icon = ICONS[outcome.id];
          const active = saved === outcome.value;
          return (
            <button
              key={outcome.id}
              type="button"
              onClick={() => record(outcome)}
              disabled={busy !== null}
              aria-pressed={active}
              className={
                "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-60 " +
                (active
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-line text-muted hover:border-muted-soft hover:text-foreground")
              }
            >
              <Icon size={13} />
              {outcome.label}
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="text-xs text-muted">
          {error}
        </p>
      )}
    </div>
  );
}
