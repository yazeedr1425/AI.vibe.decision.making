"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CATEGORIES } from "@/lib/engine/categories";
import { MOODS } from "@/lib/engine/mood";
import { looksOversized } from "@/lib/engine/oversized";
import { MAX_OPTIONS, MIN_OPTIONS } from "@/lib/engine/score";
import { listenOnce } from "@/lib/voice/speech";
import { parseSpokenOptions } from "@/lib/voice/match";
import { useVoice } from "@/lib/voice/VoiceProvider";
import ThirdOptionHint from "./ThirdOptionHint";
import Reveal from "./Reveal";
import { Field } from "./ui";
import {
  Activity,
  ArrowLeft,
  Brain,
  CategoryIcon,
  Clock,
  Headphones,
  Mic,
  MoodIcon,
  Plus,
  Scale,
  Sparkles,
  TriangleAlert,
  Users,
} from "./icons";

// أمثلة تعبّي الفئة والخيارات بضغطة — مدخل مختصر لا ميزة تُعرض
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

// عبارات الشريط الجاري — حيرة يومية يعرفها الكل، تجميلية بحتة
const MARQUEE = [
  "وين نتعشى الليلة؟",
  "أطلب ولا أطبخ؟",
  "أشتري الحين أو أنتظر التخفيض؟",
  "أروح الجيم ولا أرتاح؟",
  "أكمّل المسلسل ولا أنام؟",
  "قهوة ثالثة… فكرة زينة؟",
  "أرد على الرسالة الحين ولا بكرة؟",
];

// أرقام هندية — الصفحة كلها عربية والرقم اللاتيني ينشز
const ORDINALS = ["١", "٢", "٣", "٤", "٥"];

const STEPS = [
  {
    number: "٠١",
    title: "اكتب خياراتك",
    sub: "خيارين أو أكثر، بكلماتك. أو أملِها بصوتك وخلنا نرتبها.",
  },
  {
    number: "٠٢",
    title: "جاوب أسئلة خفيفة",
    sub: "وقتك، مزاجك، أولوياتك — أسئلة تضبط الميزان قبل الحكم.",
  },
  {
    number: "٠٣",
    title: "خذ الترشيح والسبب",
    sub: "جواب واحد واضح، مع ليش. مو قائمة إيجابيات تحسمها أنت.",
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
}) {
  const scrollToComposer = () =>
    document.getElementById("how")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="flex flex-col">
      <Hero onCta={scrollToComposer} />
      <MarqueeBand />
      <ComposerSection
        mood={mood}
        setMood={setMood}
        categoryId={categoryId}
        setCategoryId={setCategoryId}
        options={options}
        setOptions={setOptions}
        onStart={onStart}
        onVoiceMode={onVoiceMode}
        onBreakdown={onBreakdown}
        onGroup={onGroup}
        groupBusy={groupBusy}
      />
      <StepsSection />
      <FeaturesSection onVoiceMode={onVoiceMode} onCta={scrollToComposer} />
    </div>
  );
}

/* ---------------------------------------------------------------
   الهيرو: الوعد بأكبر خط في الموقع، وجنبه معاينة حية للمنتج —
   بطاقتا سؤال وحكم تطفوان فوق بعض. المعاينة تبيع الفكرة أسرع
   من أي فقرة شرح.
   --------------------------------------------------------------- */
function Hero({ onCta }) {
  return (
    <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[7fr_5fr] lg:gap-8">
      <Reveal className="flex flex-col items-start gap-6">
        <h1 className="display text-5xl font-bold sm:text-6xl lg:text-[4.5rem]">
          خلّ الحيرة{" "}
          <br aria-hidden />
          <span className="text-accent">تنتهي عندك.</span>
        </h1>

        <p className="max-w-xl text-lg leading-relaxed text-muted sm:text-xl">
          اكتب خياراتك، جاوب أسئلة خفيفة، وخذ ترشيحًا واضحًا مبنيًا على وقتك
          ومزاجك وأولوياتك — مع السبب.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onCta}
            className="glow flex items-center gap-2 rounded-full bg-accent px-8 py-4 text-lg font-semibold text-accent-ink transition-all hover:brightness-95 active:translate-y-px"
          >
            ابدأ قرارك
            <ArrowLeft size={20} />
          </button>
          <Link
            href="/how"
            className="rounded-full border border-line-strong px-6 py-4 font-medium transition-colors hover:border-ink"
          >
            كيف يعمل؟
          </Link>
        </div>

        <p className="text-sm text-muted-soft">
          بدون حساب — الحساب للحفظ فقط، وقرارك ما يطلع لأحد.
        </p>
      </Reveal>

      {/* المعاينة: سؤال ورقي وحكم حبري يركب على زاويته السفلية.
          الحكم مطلق الموضع، فالحاوية تحجز له فراغاً تحتها حتى ما
          يبلع شرائح الخيارات ولا يلمس الشريط الجاري */}
      <Reveal
        delay={150}
        className="relative mx-auto hidden w-full max-w-sm pb-24 sm:block lg:max-w-none"
      >
        <div
          aria-hidden
          className="floaty card-shadow rounded-[1.75rem] border border-line bg-card p-6 pb-10"
          style={{ "--tilt": "2deg" }}
        >
          <p className="text-2xl font-bold">وين نتعشى الليلة؟</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-line-strong px-4 py-1.5 text-sm">
              برجر
            </span>
            <span className="rounded-full border border-line-strong px-4 py-1.5 text-sm">
              سوشي
            </span>
            <span className="rounded-full border border-line-strong px-4 py-1.5 text-sm">
              أطبخ بالبيت
            </span>
          </div>
        </div>

        <div
          aria-hidden
          className="floaty-slow on-ink absolute bottom-0 left-2 w-[70%] rounded-[1.5rem] bg-ink p-5 text-on-ink shadow-[0_24px_48px_-16px_rgb(23_20_15/0.5)]"
          style={{ "--tilt": "-3deg" }}
        >
          <p className="flex items-center gap-1.5 text-xs font-semibold text-accent">
            <Sparkles size={13} />
            انحسمت
          </p>
          <p className="mt-1 text-xl font-bold">سوشي.</p>
          <p className="mt-1 text-sm leading-relaxed text-on-ink-muted">
            خفيف، يناسب مزاجك الليلة، وما يأخّرك عن نومك.
          </p>
        </div>
      </Reveal>
    </section>
  );
}

/* ---------------------------------------------------------------
   شريط جارٍ بميل خفيف — حيرة الناس كلها تمر من هنا.
   --------------------------------------------------------------- */
function MarqueeBand() {
  return (
    <div aria-hidden className="-rotate-1 scale-[1.02] bg-ink py-4 text-on-ink">
      <div className="marquee">
        <div className="marquee-track">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center gap-12">
              {MARQUEE.map((phrase) => (
                <span
                  key={phrase}
                  className="flex items-center gap-12 whitespace-nowrap text-lg font-medium"
                >
                  {phrase}
                  <span className="text-accent">✳</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   المؤلّف: هنا المنتج نفسه. لوح ورقي للكتابة ولوح حبري للأمثلة —
   نفس انقسام شاشة الدخول.
   --------------------------------------------------------------- */
function ComposerSection({
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
}) {
  const { stt } = useVoice();
  const [dictating, setDictating] = useState(false);
  const [dictationError, setDictationError] = useState(null);
  // مفتاح الرفض هو نص الخيارات وقت الرفض — تغيير الخيارات يرجّع
  // البانر لأن القرار صار غيره
  const [dismissedKey, setDismissedKey] = useState(null);
  const stopRef = useRef(() => {});

  useEffect(() => () => stopRef.current?.(), []);

  const filledLabels = options.map((o) => o.label.trim()).filter(Boolean);
  const filled = filledLabels.length;
  const ready = filled >= MIN_OPTIONS && categoryId;

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

  // شريحة الفئة والمزاج — نفس الهيكل، فدالة واحدة تكفي
  const chip = (active) =>
    "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm transition-all " +
    (active
      ? "bg-ink text-on-ink"
      : "border border-line-strong text-ink hover:border-ink hover:bg-card");

  return (
    <section id="how" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6">
      <Reveal>
        <div className="card-shadow grid overflow-hidden rounded-[2rem] border border-line lg:grid-cols-[3fr_2fr]">
          {/* ------------ لوح الكتابة ------------ */}
          <div className="flex flex-col gap-7 bg-card p-6 sm:p-10 lg:p-12">
            <header className="flex flex-col gap-2.5">
              <h2 className="display text-3xl font-bold sm:text-[2.4rem]">
                وش القرار اللي محتار فيه؟
              </h2>
            </header>

            {/* سطر تحت الكلام لا صندوق حوله — نفس حقول شاشة الدخول،
                وهو اللي يخلي الصفحة تبان ورقة تُملأ */}
            <ul className="flex flex-col gap-4">
              {options.map((o, i) => (
                <li key={o.id} className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="w-4 shrink-0 text-lg font-bold text-muted-soft"
                  >
                    {ORDINALS[i]}
                  </span>
                  <Field
                    value={o.label}
                    onChange={(e) => update(o.id, e.target.value)}
                    placeholder={`الخيار ${ORDINALS[i]}`}
                    aria-label={`الخيار رقم ${i + 1}`}
                    maxLength={60}
                  />
                  {options.length > MIN_OPTIONS && (
                    <button
                      type="button"
                      onClick={() => remove(o.id)}
                      aria-label={`احذف الخيار رقم ${i + 1}`}
                      className="shrink-0 rounded-full px-1.5 text-xl leading-none text-muted-soft transition-colors hover:text-ink"
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>

            <ThirdOptionHint options={filledLabels} onPick={addWithLabel} />

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
              {options.length < MAX_OPTIONS && (
                <button
                  type="button"
                  onClick={add}
                  className="flex items-center gap-1.5 transition-colors hover:text-ink"
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
                  className="flex items-center gap-1.5 transition-colors hover:text-ink disabled:opacity-50"
                >
                  <Mic size={16} />
                  {dictating ? "أسمعك…" : "أملِ بالصوت"}
                </button>
              )}
              <button
                type="button"
                onClick={onVoiceMode}
                aria-label="وضع المحادثة الصوتية — اختصار حرف V"
                className="flex items-center gap-1.5 transition-colors hover:text-ink"
              >
                <Headphones size={16} />
                محادثة صوتية
              </button>
            </div>

            {dictationError && (
              <p
                role="status"
                className="flex items-center gap-1.5 text-sm text-muted"
              >
                <TriangleAlert size={15} />
                {dictationError}
              </p>
            )}

            {/* نوع القرار والمزاج: مفتوحان دائماً. نوع القرار مطلوب قبل
                «احسمها لي»، وإخفاء خطوة إجبارية خلف زر يخلي المستخدم
                يدوّر على شي ما يعرف إنه موجود. */}
            <div className="flex flex-col gap-5 border-t border-line pt-6">
              <fieldset>
                <legend className="mb-2.5 text-sm text-muted">نوع القرار</legend>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategoryId(c.id)}
                      aria-pressed={categoryId === c.id}
                      className={chip(categoryId === c.id)}
                    >
                      <CategoryIcon categoryId={c.id} size={16} />
                      {c.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2.5 text-sm text-muted">مزاجك</legend>
                <div className="flex flex-wrap gap-2">
                  {MOODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMood(mood === m.id ? null : m.id)}
                      aria-pressed={mood === m.id}
                      className={chip(mood === m.id)}
                    >
                      <MoodIcon moodId={m.id} size={16} />
                      {m.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            {showBreakdown && (
              <div className="flex flex-col gap-3 rounded-2xl bg-accent-soft p-4">
                <p className="flex items-start gap-2.5 text-sm leading-relaxed">
                  <Scale
                    size={17}
                    className="mt-0.5 shrink-0 text-accent-strong"
                  />
                  هذا يشبه قرارات المصير — ما ينحسم بمزاج اليوم. نفكه لك
                  لفحوصات صغيرة لها جواب، وبعدها الحكم؟
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={onBreakdown}
                    className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-on-ink transition-opacity hover:opacity-90"
                  >
                    فكّه أول
                  </button>
                  <button
                    type="button"
                    onClick={() => setDismissedKey(oversizedKey)}
                    className="text-sm text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink"
                  >
                    لا، كمّل عادي
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={onStart}
                disabled={!ready}
                className="glow flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-4 text-lg font-semibold text-accent-ink transition-all hover:brightness-95 active:translate-y-px disabled:cursor-not-allowed disabled:bg-line disabled:text-muted disabled:shadow-none disabled:brightness-100"
              >
                احسمها لي
                <ArrowLeft size={20} />
              </button>

              {/* الحيرة الجماعية أعوص من الفردية — "وين نتعشى" عطّلت
                  سهرات أكثر من أي قرار فردي. الرابط للقروب والكل يصوت. */}
              <button
                type="button"
                onClick={onGroup}
                disabled={!ready || groupBusy}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-line-strong px-6 py-3 font-medium transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Users size={18} />
                {groupBusy ? "… نجهز الرابط" : "خلّه جماعي — القروب يصوت"}
              </button>

              <p className="text-center text-xs text-muted-soft">
                {ready
                  ? "ما نحفظ قرارك إلا إذا طلبت. القرار لك دائمًا."
                  : !categoryId
                    ? "اختر نوع القرار فوق أول."
                    : `اكتب ${MIN_OPTIONS} خيارات على الأقل.`}
              </p>
            </div>
          </div>

          {/* ------------ اللوح الحبري: الأمثلة ------------ */}
          <aside
            id="examples"
            className="on-ink flex flex-col gap-8 bg-ink p-6 text-on-ink sm:p-10 lg:p-12"
          >
            {/* فوق المنتصف بقليل — المنتصف الهندسي يبان نازلاً للعين */}
            <div className="my-auto flex flex-col gap-6 lg:-translate-y-4">
              <h3 className="display text-2xl font-bold sm:text-3xl">
                مو عارف من وين تبدأ؟
              </h3>
              <p className="text-sm leading-relaxed text-on-ink-muted">
                جرّب واحدة من هذي — تتعبى لك جاهزة وتعدّلها على كيفك:
              </p>

              <div className="flex flex-col gap-1">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.label}
                    type="button"
                    onClick={() => applyExample(ex)}
                    className="group -mx-3 flex items-center gap-3 rounded-xl px-3 py-3 text-start transition-colors hover:bg-white/5"
                  >
                    <CategoryIcon
                      categoryId={ex.categoryId}
                      size={19}
                      className="shrink-0 text-accent"
                    />
                    <span className="text-[1.05rem]">{ex.label}</span>
                    <ArrowLeft
                      size={16}
                      className="mr-auto shrink-0 text-on-ink-muted opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </button>
                ))}
              </div>
            </div>

            <p className="border-t border-line-ink pt-6 text-sm leading-relaxed text-on-ink-muted">
              تقدر تستخدم احسم بدون حساب. الحساب للحفظ فقط — وما نشارك
              قراراتك مع أحد.
            </p>
          </aside>
        </div>
      </Reveal>
    </section>
  );
}

/* ---------------------------------------------------------------
   الخطوات الثلاث — أرقام هندية ضخمة بالمرعى، تنكشف بالتتابع.
   --------------------------------------------------------------- */
function StepsSection() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <Reveal className="mb-10">
        <h2 className="display text-3xl font-bold sm:text-4xl">
          ثلاث خطوات وتنحسم.
        </h2>
      </Reveal>

      <div className="grid gap-6 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <Reveal key={step.number} delay={i * 120}>
            <div className="flex h-full flex-col gap-3 rounded-[1.75rem] border border-line bg-card/60 p-7 transition-all hover:-translate-y-1 hover:bg-card hover:shadow-[0_18px_40px_-24px_rgb(23_20_15/0.3)]">
              <span
                aria-hidden
                className="display text-5xl font-bold text-accent"
                style={{
                  fontFamily:
                    "var(--font-heading), var(--font-arabic), sans-serif",
                }}
              >
                {step.number}
              </span>
              <h3 className="text-xl font-bold">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{step.sub}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------
   الميزات — ست بطاقات، كل وحدة توديك لمكانها: الصوتية تفتح
   المحادثة، والخطة والتحليل صفحات، والبقية ترجعك للمؤلّف.
   --------------------------------------------------------------- */
function FeaturesSection({ onVoiceMode, onCta }) {
  const features = [
    {
      icon: Users,
      title: "القروب يصوت",
      sub: "رابط واحد، الكل يصوت من جواله، والنتيجة لحظة بلحظة.",
      onClick: onCta,
    },
    {
      icon: Scale,
      title: "قرارات المصير تنفك",
      sub: "أستقيل؟ أتزوج؟ نفكها لفحوصات صغيرة لها جواب قبل أي حكم.",
      onClick: onCta,
    },
    {
      icon: Brain,
      title: "شخصيتك القرارية",
      sub: "من سجلك: وش تطرح ولا تختار، ومتى تحتار، ووش تندم عليه.",
      href: "/#history",
    },
    {
      icon: Headphones,
      title: "محادثة صوتية",
      sub: "احسم وأنت ماسك قهوتك — تتكلم، وهو يسأل ويحسم.",
      onClick: onVoiceMode,
    },
    {
      icon: Clock,
      title: "خطة اليوم",
      sub: "يومك كله قرارات؟ رتّبها مرة وحدة وخذ خطة تمشي عليها.",
      href: "/plan",
    },
    {
      icon: Activity,
      title: "تحليل المخاطر",
      sub: "وش أسوأ سيناريو فعلاً؟ تحليل هادئ بدل القلق العائم.",
      href: "/analyze",
    },
  ];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 pb-20 sm:px-6">
      <Reveal className="mb-10">
        <h2 className="display text-3xl font-bold sm:text-4xl">
          كل أنواع الحيرة، لها أداة.
        </h2>
      </Reveal>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => {
          const Icon = f.icon;
          const inner = (
            <>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong transition-colors group-hover:bg-accent group-hover:text-accent-ink">
                <Icon size={22} />
              </span>
              <span className="text-lg font-bold">{f.title}</span>
              <span className="text-sm leading-relaxed text-muted">
                {f.sub}
              </span>
            </>
          );
          const cardClass =
            "group flex h-full flex-col items-start gap-3 rounded-[1.75rem] border border-line bg-card p-7 text-start transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_-24px_rgb(23_20_15/0.35)]";

          return (
            <Reveal key={f.title} delay={(i % 3) * 120}>
              {f.href ? (
                <Link href={f.href} className={cardClass}>
                  {inner}
                </Link>
              ) : (
                <button type="button" onClick={f.onClick} className={cardClass + " w-full"}>
                  {inner}
                </button>
              )}
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
