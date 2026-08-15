"use client";

// عناصر مشتركة على لغة «الحبر والورق».
//
// قاعدة اللون هنا: الطوبيّ محجوز للفعل الواحد الرئيسي في الشاشة،
// والحبر (الأسود الدافئ) لكل ما هو مختار أو مؤكَّد. لو صار الاختيار
// طوبيّاً أيضاً ضاع الترتيب البصري وما عاد للزر الرئيسي وزن.

const cx = (...parts) => parts.filter(Boolean).join(" ");

// lang="en" مهم: قارئ الشاشة العربي ينطق الكلمة اللاتينية بحروف عربية
// ويطلع كلام غير مفهوم. الوسم يخلّيه يبدّل الصوت.
export function Tag({ children, className = "", lang = "en" }) {
  return (
    <span lang={lang} className={cx("tag", className)}>
      {children}
    </span>
  );
}

export function Eyebrow({ children, className = "", lang = "ar" }) {
  return (
    <span lang={lang} className={cx("eyebrow", className)}>
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------
   الأزرار — كلها حبّة (pill) لأن شاشة الدخول كذلك، والاختلاف
   بينها في الوزن لا في الشكل.
   --------------------------------------------------------------- */

export function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={cx(
        "glow rounded-full bg-accent px-7 py-3.5 font-semibold text-accent-ink",
        "transition-all hover:brightness-95 active:translate-y-px",
        "disabled:cursor-not-allowed disabled:bg-line disabled:text-muted disabled:shadow-none disabled:brightness-100",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// الفعل الثانوي القوي: أسود على ورق. أقوى من الشبح، وما يزاحم الطوبيّ.
export function InkButton({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={cx(
        "rounded-full bg-ink px-6 py-3 font-semibold text-on-ink",
        "transition-all hover:bg-ink/90 active:translate-y-px",
        "disabled:cursor-not-allowed disabled:bg-line disabled:text-muted",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={cx(
        "rounded-full border border-line-strong bg-transparent px-5 py-2.5 text-sm",
        "transition-colors hover:border-ink hover:bg-card disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// زر نصّي بلا إطار — للرجوع والإلغاء، حتى ما تمتلئ الشاشة بالحبّات
export function QuietButton({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={cx(
        "text-sm text-muted underline decoration-line-strong underline-offset-4",
        "transition-colors hover:text-ink hover:decoration-ink disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------
   الاختيار — حبّة تمتلئ حبراً عند الاختيار.
   --------------------------------------------------------------- */

export function Choice({ selected, children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={cx(
        "rounded-full px-4 py-2 text-sm transition-all",
        selected
          ? "bg-ink text-on-ink"
          : "border border-line-strong text-ink hover:border-ink hover:bg-card",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------
   الحقول — سطر تحت الكلام لا صندوق حوله. هذا أبرز ما يميّز
   شاشة الدخول، وهو اللي يخلي الصفحة تبان ورقة مكتوبة.
   --------------------------------------------------------------- */

export function Field({ className = "", ...props }) {
  return (
    <input
      className={cx(
        "w-full border-0 border-b-2 border-line bg-transparent px-0.5 py-2.5",
        "text-lg outline-none transition-colors placeholder:text-muted-soft",
        "focus:border-ink focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}

/* ---------------------------------------------------------------
   الأسطح.
   --------------------------------------------------------------- */

export function Card({ children, className = "", as: As = "section", ...rest }) {
  return (
    <As
      className={cx(
        "card-shadow rounded-[var(--radius-card)] border border-line bg-card p-6 sm:p-8",
        className,
      )}
      {...rest}
    >
      {children}
    </As>
  );
}

// بطاقة غامقة. الصنف on-ink يقلب لون حلقة التركيز في globals.css
export function InkCard({ children, className = "", as: As = "section", ...rest }) {
  return (
    <As
      className={cx(
        "on-ink rounded-[var(--radius-card)] bg-ink p-6 text-on-ink sm:p-8",
        className,
      )}
      {...rest}
    >
      {children}
    </As>
  );
}

/* ---------------------------------------------------------------
   العناوين.
   --------------------------------------------------------------- */

// العنوان يستقبل التركيز عند تغيّر الخطوة: بدونه يضيع مستخدم قارئ
// الشاشة، لأن الزر اللي كان مركّزاً عليه يختفي مع الشاشة السابقة.
export function SectionHeading({ tag, title, sub, className = "" }) {
  return (
    <header className={cx("flex flex-col gap-2", className)}>
      {tag && <Eyebrow>{tag}</Eyebrow>}
      <h2
        tabIndex={-1}
        data-step-heading
        className="display text-3xl font-bold sm:text-4xl"
      >
        {title}
      </h2>
      {sub && <p className="text-[0.95rem] leading-relaxed text-muted">{sub}</p>}
    </header>
  );
}

/* ---------------------------------------------------------------
   التقدّم — سطر رفيع لا شريط سمين. الرقم بجانبه لأن الطول وحده
   ما يقول للمستخدم كم بقي.
   --------------------------------------------------------------- */

// أرقام هندية — الخط العربي يحوّل بعض الأرقام اللاتينية وبعضها لا،
// فتطلع الأعداد خليطاً من النظامين إلا لو حوّلنا نحن
export const hindi = (n) =>
  String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);

export function Progress({ current, total }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold text-muted">
        {hindi(current)}
        <span className="text-muted-soft"> / {hindi(total)}</span>
      </span>
      <div className="h-px flex-1 bg-line-strong">
        <div
          className="h-px bg-ink transition-all duration-500"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

// فاصل ورقي بين أقسام الصفحة
export function Rule({ className = "" }) {
  return <hr className={cx("border-0 border-t border-line", className)} />;
}
