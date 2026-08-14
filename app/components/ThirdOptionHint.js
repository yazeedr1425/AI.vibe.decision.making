"use client";

import { useEffect, useState } from "react";
import { MAX_OPTIONS, MIN_OPTIONS } from "@/lib/engine/score";
import { thirdService } from "@/lib/services/third";
import { Lightbulb } from "./icons";

// المستخدم يكتب حرفاً حرفاً، والنداء بعد كل حرف هدر. ننتظر توقّفه.
// ٩٠٠ مللي: أطول من الوقفة بين كلمتين، وأقصر من أن يحس بتأخير.
const DEBOUNCE_MS = 900;

/**
 * "ولا مشاوي؟" — الخيار اللي ما فكر فيه.
 *
 * أحياناً الحيرة بين شيئين ما هي لأن أحدهما أفضل، بل لأن الاثنين
 * غلط. الاقتراح يجي بلا ما يطلبه: من يعرف إنه ناقصه خيار ثالث ما
 * كان محتاراً من الأصل.
 *
 * يظهر عند وجود اقتراح فقط. لا حالة تحميل ولا رسالة فشل — إضافة
 * ما طلبها المستخدم ما تستاهل تشوّش عليه وهو يكتب.
 */
export default function ThirdOptionHint({ options, onPick }) {
  // النتيجة موسومة بالخيارات اللي جُلبت لها. الاشتقاق بدل التصفير
  // داخل أثر: أول ما يعدّل المستخدم خياراً يسقط الاقتراح القديم من
  // نفسه، فما يبقى معروضاً اقتراح لزوجٍ ما عاد موجوداً.
  const [fetched, setFetched] = useState(null);

  // مفتاح نصي: مصفوفة جديدة كل رندر تعيد تشغيل الأثر بلا داعٍ
  const key = options.join("|");
  const enough = options.length >= MIN_OPTIONS;
  const room = options.length < MAX_OPTIONS;

  useEffect(() => {
    if (!enough || !room) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      thirdService
        .suggest({ options: key.split("|"), signal: controller.signal })
        .then((next) => {
          if (!controller.signal.aborted) {
            setFetched({ key, suggestions: next });
          }
        })
        .catch(() => {});
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, enough, room]);

  const suggestions =
    enough && room && fetched?.key === key ? fetched.suggestions : [];

  if (!suggestions.length) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-sm text-muted">
        <Lightbulb size={15} className="text-accent" />
        ولا
      </span>

      {suggestions.map((s) => (
        <button
          key={s.label}
          type="button"
          onClick={() => onPick(s.label)}
          className="group flex items-center gap-1.5 rounded-full border border-dashed border-line px-3 py-1.5 text-sm transition-colors hover:border-accent hover:bg-accent hover:text-accent-ink"
        >
          <span className="font-medium">{s.label}</span>
          {s.note && (
            <span className="text-xs text-muted-soft group-hover:text-accent-ink/70">
              {s.note}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
