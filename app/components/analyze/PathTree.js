"use client";

import { useState } from "react";
import { Tag } from "../ui";
import { ArrowLeft } from "../icons";

// شجرة القرار. كل مسار بطاقة قابلة للفتح، وتحته فرعان:
// ماذا لو مشت الأمور، وماذا لو ما مشت.
//
// الرقمان (مخاطرة/جاذبية) محسوبان في lib/analyze/risk.js من
// أحكام نوعية، مو مطلوبين من النموذج. نعرض المدخلات اللي بُنيا
// عليها داخل البطاقة حتى يكون الرقم قابلاً للمساءلة.

const QUADRANT_STYLE = {
  sweet: "bg-accent text-accent-ink",
  bet: "bg-accent-soft text-accent-strong",
  safe: "bg-line text-foreground/70",
  trap: "bg-accent-strong text-accent-ink",
};

function Meter({ label, value, tone }) {
  return (
    <div className="flex-1">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs text-muted">{label}</span>
        <span className="text-sm font-semibold tabular-nums">{value}٪</span>
      </div>
      <div
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-1.5 overflow-hidden rounded-full bg-line"
      >
        <div
          className={
            "h-full rounded-full " +
            (tone === "risk" ? "bg-accent-strong" : "bg-accent")
          }
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function Path({ path, index, recommended, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const isRecommended = recommended && path.label === recommended;

  return (
    <li
      className={
        "rounded-3xl border bg-card transition-colors " +
        (isRecommended ? "border-accent" : "border-line")
      }
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-5 text-right"
      >
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-sm font-semibold"
        >
          {index + 1}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{path.label}</span>
            {isRecommended && <span className="pill">التوصية</span>}
            <span
              className={
                "rounded-full px-2 py-0.5 text-[0.6875rem] " +
                (QUADRANT_STYLE[path.quadrant?.key] ?? QUADRANT_STYLE.safe)
              }
            >
              {path.quadrant?.label}
            </span>
          </span>
          <span className="mt-1 block text-sm leading-relaxed text-muted">
            {path.summary}
          </span>
        </span>

        <span aria-hidden="true" className="mt-1 shrink-0 text-muted">
          {open ? "▲" : "▼"}
        </span>
      </button>

      <div className="flex gap-4 px-5 pb-4">
        <Meter label="المخاطرة" value={path.risk} tone="risk" />
        <Meter label="الجاذبية" value={path.upside} tone="upside" />
      </div>

      {open && (
        <div className="border-t border-line px-5 py-4">
          {/* الفرعان — هنا تظهر تكلفة المسار الحقيقية */}
          <Tag lang="ar">الفروع</Tag>
          <ul className="mt-2 flex flex-col gap-2">
            {(path.branches ?? []).map((b, i) => (
              <li
                key={i}
                className={
                  "rounded-2xl border-r-4 bg-background/60 p-3 " +
                  (b.tone === "good" ? "border-accent" : "border-accent-strong")
                }
              >
                <p className="text-sm font-medium">{b.condition}</p>
                <p className="mt-0.5 flex items-start gap-1.5 text-sm text-muted">
                  <ArrowLeft size={14} className="mt-0.5 shrink-0" />
                  {b.outcome}
                </p>
              </li>
            ))}
          </ul>

          {path.assumptions?.length > 0 && (
            <>
              <Tag lang="ar" className="mt-4 block">الافتراضات</Tag>
              <ul className="mt-2 list-disc space-y-1 pr-5 text-sm text-muted">
                {path.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </>
          )}

          {/* من وين جاء الرقم — بدون هذا يصير الرقم ادعاءً بلا سند */}
          {path.basis && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-muted">
                كيف انحسبت هذي الأرقام؟
              </summary>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted">
                <dt>احتمال الضرر</dt>
                <dd className="text-foreground/80">{path.basis.downsideLikelihood}</dd>
                <dt>حجم الضرر</dt>
                <dd className="text-foreground/80">{path.basis.downsideImpact}</dd>
                <dt>احتمال المكسب</dt>
                <dd className="text-foreground/80">{path.basis.upsideLikelihood}</dd>
                <dt>حجم المكسب</dt>
                <dd className="text-foreground/80">{path.basis.upsideImpact}</dd>
                <dt>قابلية التراجع</dt>
                <dd className="text-foreground/80">{path.basis.reversibility}</dd>
              </dl>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                المخاطرة = احتمال الضرر × حجمه، ثم تُعدَّل بقابلية التراجع
                (تخفّفها بسهولة الرجوع، وترفعها إذا ما فيه رجعة). الجاذبية =
                احتمال المكسب × حجمه. النموذج يعطي التقديرات النوعية فقط؛
                الأرقام تُحسب في الكود بمعادلة ثابتة.
              </p>
            </details>
          )}
        </div>
      )}
    </li>
  );
}

export default function PathTree({ paths, recommended }) {
  if (!paths?.length) return null;

  // المسار الموصى به يُفتح افتراضياً — هو اللي جاء المستخدم لأجله.
  // لو ما تطابق أي مسار مع التوصية، نفتح الأول حتى ما تطلع الشجرة مطوية كلها.
  const openIndex = Math.max(
    0,
    paths.findIndex((p) => p.label === recommended),
  );

  return (
    <ul className="flex flex-col gap-3">
      {paths.map((p, i) => (
        <Path
          key={p.label ?? i}
          path={p}
          index={i}
          recommended={recommended}
          defaultOpen={i === openIndex}
        />
      ))}
    </ul>
  );
}
