"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DUEL_MAX,
  DUEL_MIN,
  DUEL_STOPS,
  duelLead,
  positionFrom,
  positionText,
  ratingsAt,
} from "@/lib/engine/duel";
import { useScreenAnnounce } from "@/lib/voice/VoiceProvider";
import { PrimaryButton, QuietButton, SectionHeading, hindi } from "./ui";
import { ArrowLeft, ArrowRight } from "./icons";

// قارئ الشاشة يُعلَن له عند استقرار المقبض لا مع كل حركة — الإعلان
// على كل بكسل ضجيج متصل يغطي على ما قبله
const SETTLE_MS = 700;

/**
 * المبارزة — شاشة تقييم الخيارين.
 *
 * الفرق عن `RatingGrid` ليس شكلياً: هناك ست خانات (٢ خيار × ٣ معايير)
 * وهنا ثلاث حركات على الأكثر، لأن الفارق وحده هو ما يدخل الحساب مع
 * خيارين. والمقابض تفتح على تقدير النموذج، فشغل المستخدم يتحوّل من
 * «عبّي» إلى «صحّح اللي غلط» — وغالباً ما يصحّح ولا واحد.
 */
export default function Duel({
  frame,
  options,
  ratings,
  setRatings,
  weights,
  onNext,
  onBack,
}) {
  const [first, second] = options;

  // «ما أعرف» علامة عرض بحتة: الموضع صفر أصلاً محايد في الحساب،
  // والباهت يقول «تركته عمداً» بدل «ما وصلته بعد»
  const [unsure, setUnsure] = useState(() => new Set());

  // المعايير الأثقل أولاً — الأهم يُقرأ قبل ما ينزل النظر
  const criteria = useMemo(
    () => [...frame.criteria].sort((a, b) => weights[b.key] - weights[a.key]),
    [frame.criteria, weights],
  );

  // وسم كل شي يساوي وسم لا شي
  const weightValues = criteria.map((c) => weights[c.key] ?? 0);
  const topWeight = Math.max(...weightValues);
  const hasTop = weightValues.some((v) => v !== topWeight);

  const lead = duelLead(criteria, ratings, weights, options);

  const move = (criterionKey, position) => {
    const { first: a, second: b } = ratingsAt(position);
    setRatings((prev) => ({
      ...prev,
      [first.id]: { ...prev[first.id], [criterionKey]: a },
      [second.id]: { ...prev[second.id], [criterionKey]: b },
    }));
    setUnsure((prev) => {
      if (!prev.has(criterionKey)) return prev;
      const next = new Set(prev);
      next.delete(criterionKey);
      return next;
    });
  };

  const markUnsure = (criterionKey) => {
    move(criterionKey, 0);
    setUnsure((prev) => new Set(prev).add(criterionKey));
  };

  // الإعلان بعد الاستقرار. الضبط داخل المؤقّت لا في جسم الأثر —
  // ‎set-state-in-effect‎ مفعّلة، والتنظيف يلغي المؤقّت قبل أن يضبط
  const summary = lead.leader
    ? `الحصيلة الآن: يميل لـ${lead.leader.label}`
    : "الحصيلة الآن: متعادل";
  const [settled, setSettled] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setSettled(summary), SETTLE_MS);
    return () => clearTimeout(id);
  }, [summary]);
  useScreenAnnounce(settled);

  return (
    <div className="flex flex-col gap-8">
      <SectionHeading
        title={frame.headline}
        sub="حرّك المقبض ناحية الأقرب لك. بدأناها بتقديرنا — عدّل اللي تحس فيه فرق."
      />

      {/* الحصيلة حيّة: كل حركة تحرّك الحكم أمام العين، وهذا اللي يخلي
          الشاشة تبان حيّة بدل استمارة تُملأ */}
      <div
        className="flex flex-col gap-2 rounded-2xl bg-card-sunken p-4"
        aria-hidden
      >
        {/* الخيار الأول أولاً في الـ DOM = يمين الشاشة في RTL = الطرف
            الموجب للمقبض. أي ترتيب آخر يخلي الشريط يشير عكس المقبض */}
        <div className="flex items-center justify-between text-sm font-semibold">
          <span className={lead.leader === first ? "" : "text-muted-soft"}>
            {first.label}
          </span>
          <span className="text-xs font-medium text-muted">
            {lead.leader ? `يميل لـ${lead.leader.label}` : "متعادل"}
          </span>
          <span className={lead.leader === second ? "" : "text-muted-soft"}>
            {second.label}
          </span>
        </div>

        {/* مسار واحد وعلامة منتصف، والتعبئة تنمو من المنتصف ناحية
            الفائز. اللون هنا للفائز فقط — بقية الشاشة حبر */}
        <div className="relative h-2 rounded-full bg-line" dir="ltr">
          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line-strong" />
          <span
            className="absolute inset-y-0 rounded-full bg-accent transition-all duration-300"
            style={{
              left: lead.ratio >= 0 ? "50%" : `${50 + lead.ratio * 50}%`,
              width: `${Math.abs(lead.ratio) * 50}%`,
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-7">
        {criteria.map((c) => {
          const position = positionFrom(
            ratings[first.id]?.[c.key],
            ratings[second.id]?.[c.key],
          );
          const isTop = hasTop && weights[c.key] === topWeight;
          const shaky = frame.confidence?.[c.key] === "low";
          const idle = unsure.has(c.key);

          return (
            <div
              key={c.key}
              className={"flex flex-col gap-2 transition-opacity " + (idle ? "opacity-45" : "")}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={
                    "flex items-center gap-2 " +
                    (isTop ? "text-base font-bold" : "text-sm text-muted")
                  }
                >
                  {c.label}
                  {isTop && <span className="pill py-0.5">الأهم</span>}
                </span>
                <button
                  type="button"
                  onClick={() => markUnsure(c.key)}
                  className="text-xs text-muted-soft underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink"
                >
                  ما أعرف
                </button>
              </div>

              {/* طرفا المقبض هما الخياران لا قطبا المعيار: السؤال هنا
                  «أيهما أفضل في هذا المعيار» لا «أين يقع المعيار».
                  والقطبان يظلان مستعملين — يحملهما تفصيل النتيجة.

                  الأول أولاً في الـ DOM ليقع يمين الشاشة في RTL، وهو
                  الطرف الموجب للمقبض تحته */}
              <div className="flex items-center gap-3">
                <span className="w-20 shrink-0 truncate text-start text-xs font-medium sm:w-28">
                  {first.label}
                </span>

                {/* ‎dir="ltr"‎ صريح على المدخل نفسه: المدى داخل صفحة
                    ‎rtl‎ ينعكس في كروم وفايرفوكس ولا ينعكس في سفاري
                    تاريخياً. بالفرض هنا يصير الموجب = اليمين = الخيار
                    الأول في كل متصفح وفي لوحة المفاتيح */}
                <input
                  type="range"
                  dir="ltr"
                  className={"duel-range flex-1 " + (isTop ? "duel-range-top" : "") + (shaky ? " duel-range-shaky" : "")}
                  min={DUEL_MIN}
                  max={DUEL_MAX}
                  step={1}
                  value={position}
                  onChange={(e) => move(c.key, Number(e.target.value))}
                  aria-label={`${c.label} — ${second.label} مقابل ${first.label}`}
                  aria-valuetext={positionText(position, first.label, second.label)}
                />

                <span className="w-20 shrink-0 truncate text-end text-xs font-medium sm:w-28">
                  {second.label}
                </span>
              </div>

              {/* صراحة الآلة عن حدودها تبني ثقة أكثر من ثقة مزيّفة */}
              {shaky && frame.notes?.[c.key] && (
                <p className="text-xs leading-relaxed text-muted-soft">
                  {frame.notes[c.key]}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <QuietButton onClick={onBack} className="flex items-center gap-1.5">
          <ArrowRight size={15} />
          رجوع
        </QuietButton>
        <PrimaryButton onClick={onNext} className="flex items-center gap-2">
          احسمها لي
          <ArrowLeft size={18} />
        </PrimaryButton>
      </div>

      {/* المحطات مذكورة للقارئ فقط — العدد يقول له إن المدى خمس درجات */}
      <p className="sr-only">
        كل معيار له {hindi(DUEL_STOPS.length)} درجات بين الطرفين.
      </p>
    </div>
  );
}
