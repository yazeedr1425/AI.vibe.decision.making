import Link from "next/link";
import SiteNav from "../components/SiteNav";
import SiteFooter from "../components/SiteFooter";
import {
  ArrowLeft,
  Brain,
  CircleCheck,
  Headphones,
  Mic,
  Plus,
  Sparkles,
} from "../components/icons";

export const metadata = {
  title: "كيف يعمل احسم؟",
  description:
    "من الحيرة إلى قرار في أقل من دقيقة: خياراتك، ثلاثة أسئلة، وترشيح مع السبب.",
};

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
          <span className="pill self-start">
            <Sparkles size={14} />
            كيف يعمل
          </span>
          <h1 className="text-4xl font-semibold leading-[1.15] sm:text-5xl">
            من الحيرة إلى قرار، في أقل من دقيقة.
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-muted">
            احسم ما يرمي لك اسم عشوائي. يسألك سؤالين ثلاثة، يفهم إيش يهمك اليوم،
            ويوزن خياراتك على أساسه — ويقول لك ليش.
          </p>
        </section>

        {/* الخطوات */}
        <section className="flex flex-col gap-5">
          <h2 className="text-2xl font-semibold sm:text-3xl">الخطوات الأربع</h2>
          <ol className="grid gap-4 sm:grid-cols-2">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.title}
                  className="card-shadow flex flex-col gap-3 rounded-2xl border border-line bg-card p-5"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
                      <Icon size={18} />
                    </span>
                    <span className="tag">{`step 0${i + 1}`}</span>
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

        {/* ليش سؤالين مختلفين */}
        <section className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-6 sm:p-8">
          <span className="tag">the math, briefly</span>
          <h2 className="text-2xl font-semibold">
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
          <p className="rounded-xl bg-background px-4 py-3 text-center font-medium">
            درجة الخيار = مجموع (وزن المعيار × تقييم الخيار فيه)
          </p>
          <p className="text-sm leading-relaxed text-muted">
            وعشان كذا النِّسب اللي تشوفها في «حسابك بالأوزان» محسوبة فعلاً من
            إجاباتك، مو أرقام مزخرفة.
          </p>
        </section>

        {/* المزاج */}
        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold sm:text-3xl">والمزاج؟</h2>
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
        <section className="flex flex-col gap-4 rounded-2xl border border-dashed border-line p-6 sm:p-8">
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
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
            <li>🔊 حرف S — تشغيل أو إيقاف القراءة</li>
            <li>🔁 حرف R — أعد قراءة الشاشة</li>
          </ul>
        </section>

        {/* الخصوصية */}
        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold sm:text-3xl">وقرارك لك</h2>
          <p className="leading-relaxed text-muted">
            بدون تسجيل دخول، ما ينحفظ شي — تقدر تستخدم احسم كامل وما يترك أثراً.
            ولو سجّلت دخولك، نحفظ قراراتك في سجلك عشان نفهم عاداتك ونحسّن
            الترشيحات مع الوقت.
          </p>
        </section>

        {/* دعوة */}
        <section className="flex flex-col items-start gap-4 border-t border-line pt-10">
          <h2 className="text-2xl font-semibold">
            جرّبه على قرار محتار فيه الحين.
          </h2>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-2xl bg-accent px-6 py-3.5 text-lg font-semibold text-accent-ink transition-opacity hover:opacity-90"
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
