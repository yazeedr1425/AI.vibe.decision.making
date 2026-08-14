"use client";

/**
 * هيكل السؤال أثناء التوليد.
 *
 * ليش هيكل لا شاشة تحميل: الانتظار يقع بين ضغطة "احسمها لي" وظهور
 * أول سؤال، فشاشة تحميل كاملة تقطع السياق. الهيكل يحجز نفس التخطيط
 * فتحلّ الأسئلة محلّه بلا قفزة في الصفحة.
 *
 * الأشكال مخفية عن قارئ الشاشة — مستطيلات رمادية لا تعني له شيئاً —
 * وبدلها سطر في role="status" يقول وش يصير.
 */
export default function QuestionSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <p role="status" aria-live="polite" className="sr-only">
        نجهّز أسئلة على مقاس خياراتك…
      </p>

      <div aria-hidden="true" className="flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <span className="h-6 w-12 animate-pulse rounded-full bg-line" />
          <span className="h-1 flex-1 rounded-full bg-line" />
        </div>

        <div className="flex flex-col gap-2">
          <span className="h-4 w-24 animate-pulse rounded bg-line" />
          <span className="h-8 w-2/3 animate-pulse rounded bg-line [animation-delay:100ms]" />
        </div>

        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <span
              key={i}
              className="h-16 animate-pulse rounded-2xl border border-line bg-card"
              style={{ animationDelay: `${i * 140}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
