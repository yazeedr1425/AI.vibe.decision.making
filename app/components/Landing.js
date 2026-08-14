"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CATEGORIES, getCategory } from "@/lib/engine/categories";
import { MOODS, getMood } from "@/lib/engine/mood";
import { looksOversized } from "@/lib/engine/oversized";
import { MAX_OPTIONS, MIN_OPTIONS } from "@/lib/engine/score";
import { listenOnce } from "@/lib/voice/speech";
import { parseSpokenOptions } from "@/lib/voice/match";
import { useVoice } from "@/lib/voice/VoiceProvider";
import ThirdOptionHint from "./ThirdOptionHint";
import {
  ArrowLeft,
  CategoryIcon,
  Headphones,
  Mic,
  MoodIcon,
  Plus,
  Scale,
  Sparkles,
  TriangleAlert,
  Users,
} from "./icons";

// أمثلة الواجهة — كل واحد يعبّي الفئة والخيارات مباشرة.
// الأيقونة تُشتق من الفئة، مثل التصميم.
const EXAMPLES = [
  {
    label: "أطلب ولا أطبخ؟",
    categoryId: "food",
    options: ["أطلب من مطعم", "أطبخ بالبيت"],
  },
  {
    label: "أشتري أو أنتظر؟",
    categoryId: "shopping",
    options: ["أشتري الآن", "أنتظر التخفيض"],
  },
  {
    label: "أكمّل أو أغيّر؟",
    categoryId: "life",
    options: ["أكمّل بمكاني", "أغيّر مساري"],
  },
  {
    label: "أفكّر أو أبدأ؟",
    categoryId: "time",
    options: ["أفكّر أكثر", "أبدأ الحين"],
  },
];

export default function Landing({
  mood,
  setMood,
  categoryId,
  setCategoryId,
  options,
  setOptions,
  onStart,
  onVoiceMode,
  onBreakdown,
  onGroup,
  groupBusy,
  groupHighlight,
}) {
  const { stt } = useVoice();
  const [dictating, setDictating] = useState(false);
  const [dictationError, setDictationError] = useState(null);
  // مفتاح الرفض هو نص الخيارات وقت الرفض — تغيير الخيارات يرجّع
  // البانر لأن القرار صار غيره
  const [dismissedKey, setDismissedKey] = useState(null);
  const stopRef = useRef(() => {});
  const groupBtnRef = useRef(null);

  // زر «قرار جماعي» في الشريط العلوي يوصل هنا: تمرير للزر وحلقة
  // ضوء مؤقتة. تلاعب DOM مباشر عمداً — هذا مؤثر بصري عابر لا حالة.
  useEffect(() => {
    if (!groupHighlight) return;
    const el = groupBtnRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-accent", "ring-offset-2");
    const timer = setTimeout(
      () => el.classList.remove("ring-2", "ring-accent", "ring-offset-2"),
      2600,
    );
    return () => clearTimeout(timer);
  }, [groupHighlight]);

  useEffect(() => () => stopRef.current?.(), []);

  const filledLabels = options
    .map((o) => o.label.trim())
    .filter(Boolean);
  const filled = filledLabels.length;
  const ready = filled >= MIN_OPTIONS && categoryId;
  const category = categoryId ? getCategory(categoryId) : null;
  const activeMood = getMood(mood);

  // بانر التفكيك: كشف محلي بلا نداء، والدخول بيد المستخدم دائماً
  const oversizedKey = filledLabels.join("|");
  const showBreakdown =
    filled >= MIN_OPTIONS &&
    dismissedKey !== oversizedKey &&
    looksOversized(filledLabels, categoryId);

  const update = (id, label) =>
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, label } : o)));

  const add = () =>
    setOptions((prev) =>
      prev.length >= MAX_OPTIONS
        ? prev
        : [...prev, { id: crypto.randomUUID(), label: "" }],
    );

  const remove = (id) =>
    setOptions((prev) =>
      prev.length <= MIN_OPTIONS ? prev : prev.filter((o) => o.id !== id),
    );

  // الاقتراح يعبّي أول خانة فاضية إن وجدت، وإلا يضيف صفاً — نفس
  // سلوك الإملاء الصوتي، حتى ما يفاجأ المستخدم بترتيب مختلف
  const addWithLabel = (label) =>
    setOptions((prev) => {
      if (prev.length >= MAX_OPTIONS) return prev;
      const empty = prev.findIndex((o) => !o.label.trim());
      if (empty !== -1)
        return prev.map((o, i) => (i === empty ? { ...o, label } : o));
      return [...prev, { id: crypto.randomUUID(), label }];
    });

  const applyExample = (example) => {
    setCategoryId(example.categoryId);
    setOptions(example.options.map((label, i) => ({ id: `ex-${i}`, label })));
  };

  const dictate = useCallback(() => {
    if (!stt || dictating) return;
    setDictationError(null);
    setDictating(true);

    stopRef.current = listenOnce({
      onResult: (text) => {
        setDictating(false);
        const spoken = parseSpokenOptions(text, { max: MAX_OPTIONS });
        if (!spoken.length) {
          setDictationError("ما التقطت خيارات — عيد أو اكتبها.");
          return;
        }
        setOptions((prev) => {
          const next = [...prev];
          for (const label of spoken) {
            const empty = next.findIndex((o) => !o.label.trim());
            if (empty !== -1) next[empty] = { ...next[empty], label };
            else if (next.length < MAX_OPTIONS)
              next.push({ id: crypto.randomUUID(), label });
          }
          return next;
        });
      },
      onError: (code) => {
        setDictating(false);
        setDictationError(
          code === "not-allowed"
            ? "الميكروفون ممنوع — اكتب خياراتك بدل الإملاء."
            : "ما سمعت شي — عيد أو اكتبها.",
        );
      },
    });
  }, [stt, dictating, setOptions]);

  // اختصار حرف M
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || e.target?.isContentEditable)
        return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.toLowerCase() === "m") {
        e.preventDefault();
        dictate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dictate]);

  return (
    <div className="grid items-start gap-8 md:grid-cols-2 md:gap-8 lg:gap-14">
      {/* ------------ العمود التعريفي ------------ */}
      <section className="flex flex-col gap-6" id="examples">
        <span className="pill self-start">
          <Sparkles size={14} />
          مساعد قرارك اليومي
        </span>

        <h1 className="text-4xl font-semibold leading-[1.15] sm:text-5xl lg:text-[3.25rem]">
          خلّ الحيرة تنتهي عندك.
        </h1>

        <p className="max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          أضف خياراتك، جاوب على أسئلة خفيفة، وخذ ترشيحًا واضحًا مبنيًا على وقتك
          ومزاجك وأولوياتك.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => applyExample(ex)}
              className="card-shadow flex flex-col items-start gap-2 rounded-2xl border border-line bg-card p-4 text-start transition-transform hover:-translate-y-0.5"
            >
              <CategoryIcon
                categoryId={ex.categoryId}
                size={22}
                className="text-accent"
              />
              <span className="font-medium">{ex.label}</span>
            </button>
          ))}
        </div>

        {/* الشريط الرمادي */}
        <div className="mt-2 rounded-2xl border border-line bg-[color:var(--line)]/40 p-5">
          <p className="font-medium">يومك فيه قرارات أكثر مما تتوقع.</p>
          <p className="text-sm text-muted">رتّبها على كيفك، والباقي علينا.</p>
        </div>
      </section>

      {/* ------------ بطاقة القرار ------------ */}
      <section
        id="how"
        className="card-shadow rounded-3xl border border-line bg-card p-5 sm:p-7"
      >
        <div className="flex items-center justify-between gap-3">
          <span lang="ar" dir="rtl" className="tag">
            قرار جديد · ٠١
          </span>
          <span className="pill">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            جاهز أساعدك
          </span>
        </div>

        <h2 className="mt-4 text-2xl font-semibold sm:text-[1.7rem]">
          وش القرار اللي محتار فيه؟
        </h2>

        {/* سطر يلخّص اختيارك — الفئة والمزاج معاً، ويتحدث فوراً
            مع الضغط على الشرائح تحته */}
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-line bg-background px-4 py-3">
          <span className="flex items-center gap-2 font-medium">
            <CategoryIcon
              categoryId={categoryId}
              size={20}
              className="text-accent"
            />
            {category?.label ?? "اختر نوع القرار"}
            {activeMood && (
              <span className="text-sm text-muted">· {activeMood.label}</span>
            )}
          </span>
        </div>

        {/* مفتوح دائماً. كان خلف زر «غيّر» فتُفتح بضغطة إضافية، ونوع
            القرار مطلوب أصلاً قبل «احسمها لي» — إخفاء خطوة إجبارية
            خلف زر يخلي المستخدم يدوّر على شي ما يعرف إنه موجود. */}
        <div className="mt-3 flex flex-col gap-4 rounded-2xl border border-line p-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted">نوع القرار</span>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  aria-pressed={categoryId === c.id}
                  className={
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors " +
                    (categoryId === c.id
                      ? "border-accent bg-accent text-accent-ink"
                      : "border-line hover:border-muted-soft")
                  }
                >
                  <CategoryIcon categoryId={c.id} size={16} />
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted">
              مزاجك — يغيّر لون الصفحة ووزن معيار واحد
            </span>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMood(mood === m.id ? null : m.id)}
                  aria-pressed={mood === m.id}
                  className={
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors " +
                    (mood === m.id
                      ? "border-accent bg-accent text-accent-ink"
                      : "border-line hover:border-muted-soft")
                  }
                >
                  <MoodIcon moodId={m.id} size={16} />
                  {m.label}
                </button>
              ))}
            </div>
            {activeMood && (
              <p className="text-sm text-muted">{activeMood.line}</p>
            )}
          </div>
        </div>

        {/* الخيارات */}
        <ul className="mt-3 flex flex-col gap-2">
          {options.map((o, i) => (
            <li key={o.id} className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-medium text-white">
                {i + 1}
              </span>
              <input
                value={o.label}
                onChange={(e) => update(o.id, e.target.value)}
                placeholder={`الخيار ${i + 1}`}
                aria-label={`الخيار رقم ${i + 1}`}
                maxLength={60}
                className="w-full rounded-2xl border border-line bg-background px-4 py-3 outline-none transition-colors focus:border-accent"
              />
              {options.length > MIN_OPTIONS && (
                <button
                  type="button"
                  onClick={() => remove(o.id)}
                  aria-label={`احذف الخيار رقم ${i + 1}`}
                  className="shrink-0 rounded-full px-2 text-lg text-muted-soft transition-colors hover:text-foreground"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>

        <ThirdOptionHint options={filledLabels} onPick={addWithLabel} />

        <div className="mt-3 flex flex-wrap items-center gap-4">
          {options.length < MAX_OPTIONS && (
            <button
              type="button"
              onClick={add}
              className="flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
            >
              <Plus size={16} />
              أضف خيارًا {options.length === 2 ? "ثالثًا" : "آخر"}
            </button>
          )}
          {stt && (
            <button
              type="button"
              onClick={dictate}
              disabled={dictating}
              aria-label="أملِ خياراتك بالصوت — اختصار حرف M"
              className="flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground disabled:opacity-50"
            >
              <Mic size={16} />
              {dictating ? "أسمعك…" : "أملِ بالصوت"}
            </button>
          )}
          <button
            type="button"
            onClick={onVoiceMode}
            aria-label="وضع المحادثة الصوتية — اختصار حرف V"
            className="flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
          >
            <Headphones size={16} />
            محادثة صوتية
          </button>
        </div>

        {dictationError && (
          <p
            role="status"
            className="mt-2 flex items-center gap-1.5 text-sm text-muted"
          >
            <TriangleAlert size={15} />
            {dictationError}
          </p>
        )}

        {showBreakdown && (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-dashed border-accent/50 bg-accent-soft/40 p-4">
            <p className="flex items-start gap-2 text-sm leading-relaxed">
              <Scale size={17} className="mt-0.5 shrink-0 text-accent" />
              هذا يشبه قرارات المصير — ما ينحسم بمزاج اليوم. نفكه لك
              لفحوصات صغيرة لها جواب، وبعدها الحكم؟
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onBreakdown}
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
              >
                فكّه أول
              </button>
              <button
                type="button"
                onClick={() => setDismissedKey(oversizedKey)}
                className="rounded-full border border-line px-4 py-2 text-sm text-muted transition-colors hover:border-muted-soft"
              >
                لا، كمّل عادي
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onStart}
          disabled={!ready}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-4 text-lg font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          احسمها لي
          <ArrowLeft size={20} />
        </button>

        {/* الحيرة الجماعية أعوص من الفردية — "وين نتعشى" عطّلت
            سهرات أكثر من أي قرار فردي. الرابط للقروب والكل يصوت. */}
        <button
          ref={groupBtnRef}
          type="button"
          onClick={onGroup}
          disabled={!ready || groupBusy}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-card px-6 py-3 font-medium transition-all hover:border-muted-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Users size={18} />
          {groupBusy ? "… نجهز الرابط" : "خلّه جماعي — القروب يصوت"}
        </button>

        <p className="mt-3 text-center text-xs text-muted-soft">
          {ready
            ? "ما نحفظ قرارك إلا إذا طلبت. القرار لك دائمًا."
            : !categoryId
              ? "اختر نوع القرار فوق أول."
              : `اكتب ${MIN_OPTIONS} خيارات على الأقل.`}
        </p>
      </section>
    </div>
  );
}
