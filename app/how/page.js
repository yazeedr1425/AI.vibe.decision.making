import Link from "next/link";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import {
  ArrowLeft,
  Brain,
  CircleCheck,
  Headphones,
  Lightbulb,
  Mic,
  Plus,
  RotateCw,
  Scale,
  Sparkles,
  Users,
  Volume2,
} from "../components/icons";

export const metadata = {
  title: "كيف يعمل احسم؟",
  description:
    "من الحيرة إلى قرار في أقل من دقيقة: خياراتك، ثلاثة أسئلة، وترشيح مع السبب.",
};

// ما حول القرار نفسه — القدرات اللي تشتغل قبل الترشيح وبعده.
// وضع المحادثة الصوتية له قسمه الخاص تحت، فما يتكرر هنا.
const POWERS = [
  {
    icon: Lightbulb,
    title: "الخيار اللي ما فكرت فيه",
    body: "وأنت تكتب خياراتك، أحياناً نقترح واحداً زيادة: «برجر ولا سوشي… ولا مشاوي؟». لأن الحيرة أحياناً سببها إن الخيارين نفسيهما مو صح — والاقتراح يجي من خياراتك أنت، مو من قائمة جاهزة.",
  },
  {
    icon: Scale,
    title: "القرار الأكبر من ثلاثة أسئلة",
    body: "«أستقيل؟» ما تحسمه أسئلة سريعة. لو خياراتك من العيار الثقيل نعرض نفكّها: فحوصات صغيرة لها جواب اليوم — عندك مدخرات؟ جربته جنب الوظيفة؟ — وبعدها حكم واضح: اقدم، أو «مو الحين» ومعها بالضبط وش اللي يقلبها.",
  },
  {
    icon: Users,
    title: "القرار الجماعي",
    body: "«وين نتعشى» مع الربع؟ خلّه جماعي: رابط أو باركود، كل واحد يصوت باسمه بلا حساب، والأعمدة تتحرك قدام الجميع لحظة وصول كل صوت. ولو تعادلتوا، احسم يكسر التعادل بنفسه — ويتحمل اللوم عنكم.",
  },
  {
    icon: Brain,
    title: "سجل يتعلم منك",
    body: "بعد ما تحسم، نسألك لاحقاً: كان قرار صح؟ إجاباتك تبني «شخصيتك القرارية»: وش النوع اللي تندم عليه، ووش الخيار اللي تطرحه كل مرة وما تختاره أبداً، ومتى تكون حيرتك. كل تقييم يخلي الترشيح الجاي أذكى.",
  },
];

const STEPS = [
  {
    icon: Plus,
    title: "اكتب خياراتك",
    body: "من خيارين إلى خمسة. اكتبها، أو أملِها بالصوت، أو خلّ المحادثة الصوتية تعبّيها عنك.",
  },
  {
    icon: Brain,
    title: "جاوب ٣ أسئلة سريعة",
    body: "الأسئلة ما تختار لك — تحدد إيش المهم عندك اليوم: وقتك، ميزانيتك، ومزاجك.",
  },
  {
    icon: CircleCheck,
    title: "قيّم الخيارات بسرعة",
    body: "كل خيار يبدأ على «متوسط»، فغيّر اللي تحس فيه فرق وبس. مستعجل؟ تخطّاها كلها.",
  },
  {
    icon: Sparkles,
    title: "خذ الترشيح مع السبب",
    body: "ترشيح واضح، وجملة تشرح ليش. وإذا بغيت التفاصيل، «وضّح أكثر» يفكّك لك الأوزان بجُمل مفهومة.",
  },
];

export default function HowItWorks() {
  return (
    <>
      <SiteNav />

      <main
        id="main"
        className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-16 px-4 py-10 sm:px-6 sm:py-14"
      >
        {/* المقدمة */}
        <section className="flex flex-col gap-5">
          <h1 className="display text-4xl font-bold sm:text-5xl">
            من الحيرة إلى قرار، في أقل من دقيقة.
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-muted">
            احسم ما يرمي لك اسم عشوائي. يسألك سؤالين ثلاثة، يفهم إيش يهمك اليوم،
            ويوزن خياراتك على أساسه — ويقول لك ليش.
          </p>
        </section>

        {/* الخطوات */}
        <section className="flex flex-col gap-5">
          <h2 className="display text-2xl font-bold sm:text-3xl">الخطوات الأربع</h2>
          <ol className="grid gap-4 sm:grid-cols-2">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.title}
                  className="card-shadow flex flex-col gap-3 rounded-[1.5rem] border border-line bg-card p-6 transition-transform hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
                      <Icon size={18} />
                    </span>
                    <span lang="ar" className="tag">{`الخطوة ${"١٢٣٤"[i]}`}</span>
                  </div>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-muted">
                    {step.body}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>

        {/* حول القرار نفسه */}
        <section className="flex flex-col gap-5">
          <h2 className="display text-2xl font-bold sm:text-3xl">
            وحول القرار، أربع قدرات
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {POWERS.map((power) => {
              const Icon = power.icon;
              return (
                <div
                  key={power.title}
                  className="card-shadow flex flex-col gap-3 rounded-[1.5rem] border border-line bg-card p-6 transition-transform hover:-translate-y-0.5"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
                    <Icon size={18} />
                  </span>
                  <h3 className="text-lg font-semibold">{power.title}</h3>
                  <p className="text-sm leading-relaxed text-muted">
                    {power.body}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ليش سؤالين مختلفين */}
        <section className="card-shadow flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-card p-6 sm:p-8">
          <h2 className="display text-2xl font-bold">
            ليش نسألك مرتين — أسئلة وتقييم؟
          </h2>
          <p className="leading-relaxed text-muted">
            لأنهما شيئان مختلفان. الأسئلة تحدد{" "}
            <strong className="font-semibold text-foreground">وزن</strong> كل
            معيار: لو أنت مستعجل، السرعة تصير أثقل. والتقييم يحدد{" "}
            <strong className="font-semibold text-foreground">درجة</strong> كل
            خيار في ذلك المعيار: أي الخيارات أسرع فعلاً.
          </p>
          <p className="leading-relaxed text-muted">
            بدون الاثنين، نص المعادلة ناقص — نعرف إيش يهمك، بس ما نعرف أي خيار
            يحققه. النتيجة النهائية بسيطة:
          </p>
          <p className="rounded-xl bg-card-sunken px-4 py-3 text-center font-medium">
            درجة الخيار = مجموع (وزن المعيار × تقييم الخيار فيه)
          </p>
          <p className="text-sm leading-relaxed text-muted">
            وعشان كذا النِّسب اللي تشوفها في «حسابك بالأوزان» محسوبة فعلاً من
            إجاباتك، مو أرقام مزخرفة.
          </p>
        </section>

        {/* المزاج */}
        <section className="flex flex-col gap-4">
          <h2 className="display text-2xl font-bold sm:text-3xl">والمزاج؟</h2>
          <p className="leading-relaxed text-muted">
            مزاجك يغيّر لون الصفحة كلها، ويضيف{" "}
            <strong className="font-semibold text-foreground">+١</strong> لوزن
            معيار واحد فقط — لا أكثر. متحمس أو مبسوط؟ نميل للخيار اللي فيه
            تجديد. مرهق؟ نميل للأسهل والأخف. هادي؟ نوزنها بالعدل بدون ميل.
          </p>
          <p className="text-sm leading-relaxed text-muted">
            وأثره معلن: لو المزاج هو اللي رجّح معياراً، بتلقى ذلك مكتوباً في شرح
            النتيجة — «ومزاجك زاده وزن».
          </p>
        </section>

        {/* الصوت */}
        <section className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-dashed border-line-strong bg-card-sunken p-6 sm:p-8">
          <h2 className="flex items-center gap-2 display text-2xl font-bold">
            <Headphones size={22} className="text-accent" />
            تفضّل تتكلم؟
          </h2>
          <p className="leading-relaxed text-muted">
            وضع المحادثة الصوتية يسألك ويسمع ردك ويعبّي كل شي عنك، ويقرأ لك
            النتيجة. وإذا الميكروفون ممنوع أو متصفحك ما يدعمه، يظهر لك مربع
            كتابة وتكمل نفس المحادثة بالضبط.
          </p>
          <ul className="grid gap-2 text-sm text-muted sm:grid-cols-2">
            <li className="flex items-center gap-2">
              <Headphones size={16} className="text-accent" /> حرف V — المحادثة
              الصوتية
            </li>
            <li className="flex items-center gap-2">
              <Mic size={16} className="text-accent" /> حرف M — أملِ خياراتك
            </li>
            <li className="flex items-center gap-2">
              <Volume2 size={16} className="text-accent" /> حرف S — تشغيل أو
              إيقاف القراءة
            </li>
            <li className="flex items-center gap-2">
              <RotateCw size={16} className="text-accent" /> حرف R — أعد قراءة
              الشاشة
            </li>
          </ul>
        </section>

        {/* الخصوصية */}
        <section className="flex flex-col gap-4">
          <h2 className="display text-2xl font-bold sm:text-3xl">وقرارك لك</h2>
          <p className="leading-relaxed text-muted">
            بدون تسجيل دخول، ما ينحفظ شي — تقدر تستخدم احسم كامل وما يترك أثراً.
            ولو سجّلت دخولك، نحفظ قراراتك في سجلك عشان نفهم عاداتك ونحسّن
            الترشيحات مع الوقت.
          </p>
          <p className="text-sm leading-relaxed text-muted">
            وفي القرار الجماعي، اللي يفتح رابطك يشوف الخيارات والأصوات فقط —
            الأسماء اللي صوتت ما تنكشف إلا في إعلان النتيجة، وما يحتاج أحد من
            القروب حساباً أبداً.
          </p>
        </section>

        {/* دعوة */}
        <section className="flex flex-col items-start gap-4 border-t border-line pt-10">
          <h2 className="display text-2xl font-bold">
            جرّبه على قرار محتار فيه الحين.
          </h2>
          <Link
            href="/"
            className="glow flex items-center gap-2 rounded-full bg-accent px-8 py-4 text-lg font-semibold text-accent-ink transition-all hover:brightness-95 active:translate-y-px"
          >
            احسمها لي
            <ArrowLeft size={20} />
          </Link>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
