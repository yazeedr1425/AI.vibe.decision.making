"use client";

import { useEffect, useState } from "react";
import { Tag } from "./ui";
import { Dices } from "./icons";

const LINES = [
  "احسم يفكر…",
  "أوزن خياراتك…",
  "أقلّب في قراراتك السابقة…",
  "أجهز لك سبب مقنع…",
  "لحظة، أبي أطلع بشي ذكي…",
];

export default function Thinking() {
  const [line, setLine] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setLine((i) => (i + 1) % LINES.length), 1100);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="flex flex-col items-center gap-6 py-12"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* عجلة الحظ */}
      <div className="relative h-28 w-28">
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-dashed border-accent [animation-duration:2.4s]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="animate-bounce text-accent [animation-duration:1.2s]">
            <Dices size={40} />
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <p tabIndex={-1} data-step-heading className="text-lg font-semibold">
          {LINES[line]}
        </p>
        <Tag>ahsem is thinking</Tag>
      </div>

      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 animate-pulse rounded-full bg-accent"
            style={{ animationDelay: `${i * 180}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
