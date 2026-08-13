"use client";

/**
 * هيكل الأسئلة أثناء التوليد.
 *
 * ليش هيكل لا شاشة تحميل: التوليد يقع بين ضغطة "احسمها لي" وظهور
 * أول سؤال، فشاشة تحميل كاملة تقطع السياق وتخلي المستخدم يحس إنه
 * انتقل لمكان ثاني. الهيكل يحجز نفس التخطيط بالضبط — شريط التقدّم،
 * ثم العنوان، ثم ثلاثة خيارات — فلما تجي الأسئلة تحلّ محلّه بلا
 * قفزة في الصفحة.
 *
 * الأشكال مخفية عن قارئ الشاشة: مستطيلات رمادية لا تعني له شيئاً.
 * بدلها سطر واحد في role="status" يقول وش يصير فعلاً.
 */
export default function QuestionSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <p role="status" aria-live="polite" className="sr-only">
        نجهّز أسئلة مفصّلة على خياراتك…
      </p>

      <div aria-hidden="true" className="flex flex-col gap-8">
        {/* شريط التقدّم */}
        <div className="flex items-center gap-3">
          <span className="h-6 w-12 animate-pulse rounded-full bg-line" />
          <span className="h-1 flex-1 rounded-full bg-line" />
        </div>

        {/* العنوان */}
        <div className="flex flex-col gap-2">
          <span className="h-4 w-24 animate-pulse rounded bg-line" />
          <span className="h-8 w-3/4 animate-pulse rounded bg-line [animation-delay:100ms]" />
        </div>

        {/* الخيارات الثلاثة */}
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-14 animate-pulse rounded-2xl border border-line bg-card"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
