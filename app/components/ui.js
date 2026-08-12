"use client";

// عناصر مشتركة بسيطة — تشتغل في الوضع الفاتح والغامق بدون إعداد إضافي

export function Choice({ selected, children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={
        "rounded-full px-4 py-2 text-sm transition-colors " +
        (selected
          ? "bg-foreground text-background"
          : "border border-foreground/15 hover:border-foreground/40") +
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
        "rounded-full bg-foreground px-6 py-3 font-medium text-background " +
        "transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30 " +
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
        "rounded-full border border-foreground/15 px-5 py-2.5 text-sm " +
        "transition-colors hover:border-foreground/40 " +
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
        "rounded-3xl border border-foreground/10 p-6 sm:p-8 " + className
      }
    >
      {children}
    </section>
  );
}

export function Stepper({ steps, current }) {
  const index = steps.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((s, i) => (
        <span
          key={s.id}
          title={s.label}
          className={
            "h-1.5 rounded-full transition-all " +
            (i === index
              ? "w-8 bg-foreground"
              : i < index
                ? "w-4 bg-foreground/40"
                : "w-4 bg-foreground/15")
          }
        />
      ))}
    </div>
  );
}
