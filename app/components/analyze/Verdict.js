"use client";

import { Tag } from "../ui";

const CONFIDENCE = {
  high: "ثقة عالية",
  medium: "ثقة متوسطة",
  low: "ثقة منخفضة",
};

const SEVERITY = {
  high: { label: "خطير", className: "bg-accent-strong text-accent-ink" },
  medium: { label: "متوسط", className: "bg-accent-soft text-accent-strong" },
  low: { label: "بسيط", className: "bg-line text-foreground/70" },
};

export function Recommendation({ recommendation }) {
  if (!recommendation) return null;
  const r = recommendation;

  return (
    <section className="rounded-3xl border-2 border-accent bg-card p-6 sm:p-8">
      <header className="flex flex-wrap items-center gap-2">
        <Tag>VERDICT</Tag>
        <span className="pill">{CONFIDENCE[r.confidence] ?? "ثقة متوسطة"}</span>
      </header>

      <h2 tabIndex={-1} data-step-heading className="mt-2 text-2xl font-bold sm:text-3xl">
        {r.recommended_path}
      </h2>

      <p className="mt-3 leading-relaxed">{r.rationale}</p>

      {r.answering_objections && (
        <div className="mt-5 rounded-2xl bg-background/70 p-4">
          <Tag>ON THE OBJECTIONS</Tag>
          <p className="mt-1.5 text-sm leading-relaxed">{r.answering_objections}</p>
        </div>
      )}

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        {r.conditions?.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold">قبل ما تتحرك</h3>
            <ul className="mt-2 list-disc space-y-1 pr-5 text-sm text-muted">
              {r.conditions.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {/* أهم حقل في الصفحة: توصية ما تقدر تنقضها مو تحليل */}
        {r.would_change_my_mind?.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold">وش يخليني أغيّر رأيي</h3>
            <ul className="mt-2 list-disc space-y-1 pr-5 text-sm text-muted">
              {r.would_change_my_mind.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {r.confidence_note && (
        <p className="mt-5 border-t border-line pt-4 text-sm text-muted">
          {r.confidence_note}
        </p>
      )}
    </section>
  );
}

export function RedTeam({ challenges }) {
  if (!challenges) return null;
  const items = challenges.challenges ?? [];
  const missing = challenges.missing_data ?? [];

  return (
    <section className="rounded-3xl border border-line bg-card p-6">
      <header className="flex flex-col gap-1">
        <Tag>RED TEAM</Tag>
        <h3 className="text-lg font-semibold">اعتراضات على التحليل</h3>
        <p className="text-sm text-muted">
          وكيل مستقل مهمته يهاجم ما بناه بقية الوكلاء — بدونه التحليل يميل
          يبرر أي مسار.
        </p>
      </header>

      {items.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {items.map((c, i) => {
            const s = SEVERITY[c.severity] ?? SEVERITY.medium;
            return (
              <li key={i} className="rounded-2xl border border-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{c.target}</p>
                  <span
                    className={"shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] " + s.className}
                  >
                    {s.label}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted">{c.why_fragile}</p>
              </li>
            );
          })}
        </ul>
      )}

      {missing.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <h4 className="text-sm font-semibold">بيانات ناقصة تفرق فعلاً</h4>
          <ul className="mt-2 list-disc space-y-1 pr-5 text-sm text-muted">
            {missing.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function Sources({ sources, findings }) {
  const list = sources ?? [];

  return (
    <section className="rounded-3xl border border-line bg-card p-6">
      <header className="flex flex-col gap-1">
        <Tag>SOURCES</Tag>
        <h3 className="text-lg font-semibold">
          المصادر {list.length > 0 && `(${list.length})`}
        </h3>
      </header>

      {list.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          ما رجع البحث بمصادر لهذا القرار — تعامل مع الأرقام أدناه كتقديرات
          غير موثقة.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {list.map((s, i) => (
            <li key={i}>
              <a
                href={s.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent-strong underline underline-offset-4 hover:opacity-80"
              >
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      )}

      {findings && (
        <details className="mt-4 border-t border-line pt-4">
          <summary className="cursor-pointer text-sm text-muted">
            الحقائق الخام اللي بُني عليها التحليل
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
            {findings}
          </p>
        </details>
      )}
    </section>
  );
}
