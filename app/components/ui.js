"use client";

// عناصر مشتركة مبنية على لوحة التصميم الجديدة

// lang="en" مهم: قارئ الشاشة العربي ينطق "scoreboard" بحروف عربية
// ويطلع كلام غير مفهوم. الوسم يخلّيه يبدّل الصوت للإنجليزي.
export function Tag({ children, className = "", lang = "en" }) {
  return (
    <span lang={lang} className={"tag " + className}>
      {children}
    </span>
  );
}

export function Choice({ selected, children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={
        "rounded-full px-4 py-2 text-sm transition-all " +
        (selected
          ? "bg-accent text-accent-ink shadow-[0_2px_0_0_var(--foreground)]"
          : "border border-line bg-card hover:border-foreground/40") +
        " " +
        className
      }
      {...props}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={
        "rounded-full bg-accent px-7 py-3.5 font-semibold text-accent-ink " +
        "shadow-[0_3px_0_0_var(--foreground)] transition-all " +
        "hover:translate-y-px hover:shadow-[0_2px_0_0_var(--foreground)] " +
        "disabled:cursor-not-allowed disabled:bg-line disabled:text-muted disabled:shadow-none " +
        className
      }
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
      className={
        "rounded-full border border-line bg-card px-5 py-2.5 text-sm " +
        "transition-colors hover:border-foreground/40 disabled:opacity-40 " +
        className
      }
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = "" }) {
  return (
    <section
      className={
        "rounded-3xl border border-line bg-card p-6 sm:p-8 " + className
      }
    >
      {children}
    </section>
  );
}

// عنوان قسم: ليبل لاتيني صغير فوق عنوان عربي
// العنوان يستقبل التركيز عند تغيّر الخطوة: بدونه يضيع مستخدم قارئ
// الشاشة، لأن الزر اللي كان مركّزاً عليه يختفي مع الشاشة السابقة.
export function SectionHeading({ tag, title, sub, className = "" }) {
  return (
    <header className={"flex flex-col gap-1.5 " + className}>
      {tag && <Tag>{tag}</Tag>}
      <h2
        tabIndex={-1}
        data-step-heading
        className="text-2xl font-bold sm:text-3xl"
      >
        {title}
      </h2>
      {sub && <p className="text-sm text-muted">{sub}</p>}
    </header>
  );
}

export function Progress({ current, total }) {
  return (
    <div className="flex items-center gap-3">
      <Tag>
        {current}/{total}
      </Tag>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
    </div>
  );
}
