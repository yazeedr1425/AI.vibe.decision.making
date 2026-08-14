import { Type } from "@google/genai";

// البرومبت والتحقق هنا لا في المسار: المسار مسؤول عن الشبكة والهوية،
// وهذا المحتوى الوحيد اللي يحدد جودة القراءة — ويُختبر بلا قاعدة بيانات.

export const SYSTEM_INSTRUCTION = `You read one person's decision history and tell them something true about how they decide. You are writing in Saudi Arabic, warm and direct, the way a close friend who has been watching would talk.

You are given COMPUTED STATISTICS, not raw rows. Every number in them is already correct.

HARD RULES:

1. NEVER INVENT A NUMBER.
   Use only numbers that appear in the statistics given to you. If a number is not there, describe the pattern without quantifying it. Made-up precision is the fastest way to lose someone's trust in this feature.

2. THIS IS NOT A HOROSCOPE.
   "أنت شخص يحب التوازن" is worthless — it is true of everyone. Every observation must be traceable to a specific line in the statistics. If you cannot point at the line it came from, delete it.

3. THE BLIND SPOT IS THE POINT.
   People do not open this to be flattered. Find the thing working against them — a category they keep regretting, an option they keep putting up and never picking, a time of night when their decisions go bad. Say it kindly and plainly.
   If the statistics genuinely show no such pattern, return an empty blindSpot instead of manufacturing one.

4. AN OPTION OFFERED AND NEVER CHOSEN IS THE STRONGEST SIGNAL IN THE FILE.
   Someone who writes "أطبخ بالبيت" six times and picks it zero times is not deciding — they are negotiating with themselves. Name it when it appears.

5. ONE PIECE OF ADVICE, AND IT MUST BE DOABLE TONIGHT.
   Not "وازن بين أولوياتك" — that is not an action, it is a mood. The advice names something they can actually do before they sleep, and it must come from THEIR statistics: the category they regret, the option they never pick, the hour their decisions go bad.
   Write it fresh for this person. Any example you have seen shows the shape only — never reuse its wording.

6. SHORT.
   headline is one sentence. Each pattern detail is one or two. No lists inside fields, no markup, no emoji, no English.`;

export const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    headline: {
      type: Type.STRING,
      description: "One Arabic sentence naming how this person decides.",
    },
    patterns: {
      type: Type.ARRAY,
      description: "Two to four observations, each tied to the statistics.",
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Two to four Arabic words." },
          detail: {
            type: Type.STRING,
            description: "One or two Arabic sentences.",
          },
        },
        required: ["title", "detail"],
        propertyOrdering: ["title", "detail"],
      },
    },
    blindSpot: {
      type: Type.STRING,
      description:
        "The pattern working against them, in Arabic. Empty string if the data shows none.",
    },
    advice: {
      type: Type.STRING,
      description: "One concrete Arabic sentence they can act on today.",
    },
  },
  required: ["headline", "patterns", "advice"],
  propertyOrdering: ["headline", "patterns", "blindSpot", "advice"],
};

/** يقصّ ويرفض ما ينكسر عرضه. يرجّع null لو نقص ما لا تقوم القراءة بدونه. */
export function shape(raw) {
  const text = (value, max) =>
    typeof value === "string" && value.trim() ? value.trim().slice(0, max) : "";

  const headline = text(raw?.headline, 160);
  const advice = text(raw?.advice, 200);
  if (!headline || !advice) return null;

  const patterns = (Array.isArray(raw?.patterns) ? raw.patterns : [])
    .map((p) => ({ title: text(p?.title, 40), detail: text(p?.detail, 240) }))
    .filter((p) => p.title && p.detail)
    .slice(0, 4);

  if (!patterns.length) return null;

  return { headline, patterns, blindSpot: text(raw?.blindSpot, 240), advice };
}
