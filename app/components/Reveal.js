"use client";

import { useEffect, useRef } from "react";

// كشف عند التمرير: العنصر يبدأ خافتاً منزاحاً ويطفو لمكانه أول ما
// يدخل مجال الرؤية.
//
// الصنف يُضاف على الـ DOM مباشرة بلا حالة React — إعادة رندر لكل
// عنصر يظهر أثناء التمرير كلفة بلا فائدة، والحركة هنا تجميلية بحتة.
// مع تعطيل الحركة في النظام نظهر كل شي فوراً: التلاشي التدريجي
// نفسه حركة.
export default function Reveal({ children, className = "", delay = 0 }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-in");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add("is-in");
            observer.unobserve(el);
          }
        }
      },
      // يكفي ظهور جزء بسيط — انتظار 50٪ يخلي المقاطع الطويلة
      // ما تنكشف أبداً على الشاشات القصيرة
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={"reveal " + className}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
