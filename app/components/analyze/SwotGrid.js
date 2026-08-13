"use client";

import { Tag } from "../ui";

const QUADRANTS = [
  { key: "strengths", label: "نقاط القوة", en: "STRENGTHS", internal: true },
  { key: "weaknesses", label: "نقاط الضعف", en: "WEAKNESSES", internal: true },
  { key: "opportunities", label: "الفرص", en: "OPPORTUNITIES", internal: false },
  { key: "threats", label: "التهديدات", en: "THREATS", internal: false },
];

const CONFIDENCE = {
  high: { label: "مسنود بمصدر", className: "bg-accent-soft text-accent-strong" },
  medium: { label: "ترجيح", className: "bg-line text-foreground/70" },
  low: { label: "استنتاج", className: "border border-line text-muted" },
};

export default function SwotGrid({ swot }) {
  if (!swot) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {QUADRANTS.map((q) => {
        const points = swot[q.key] ?? [];

        return (
          <section
            key={q.key}
            className="rounded-3xl border border-line bg-card p-5"
          >
            <header className="mb-3 flex items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <h3 className="font-semibold">{q.label}</h3>
                <Tag>{q.en}</Tag>
              </div>
              {/* داخلي/خارجي: الفرق اللي يخلي التحليل مفيداً بدل زينة */}
              <span className="shrink-0 text-xs text-muted">
                {q.internal ? "تحت سيطرتك" : "خارج سيطرتك"}
              </span>
            </header>

            {points.length === 0 ? (
              <p className="text-sm text-muted">ما طلع شي هنا.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {points.map((p, i) => {
                  const c = CONFIDENCE[p.confidence] ?? CONFIDENCE.medium;
                  return (
                    <li key={i} className="border-t border-line/70 pt-3 first:border-0 first:pt-0">
                      <p className="text-sm font-medium">{p.point}</p>
                      {p.evidence && (
                        <p className="mt-1 text-xs leading-relaxed text-muted">
                          {p.evidence}
                        </p>
                      )}
                      <span
                        className={
                          "mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[0.6875rem] " +
                          c.className
                        }
                      >
                        {c.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
