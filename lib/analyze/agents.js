import { Type } from "@google/genai";

// خط وكلاء متسلسل. كل وكيل نداء Gemini مستقل بتعليماته ومخرجاته،
// ومخرجات كل واحد تدخل للي بعده.
//
// قيد مهم في الـ API: googleSearch ما يشتغل مع responseSchema —
// النداء الواحد إما مؤصَّل بالبحث أو منظّم بمخطط، مو الاثنين.
// لذلك الباحث وحده يستخدم البحث ويرجع نصاً، والبقية ياخذون نصه
// ويرجعون JSON منظّماً.

export const RESEARCH = {
  id: "research",
  label: "الباحث",
  en: "RESEARCH",
  note: "يجمع حقائق السوق مع مصادرها",
  grounded: true,
  instruction: `You are the research agent inside Ahsem's strategic decision analyst. The user is weighing a real business or financial decision and will act on what you find, so accuracy outranks completeness.

Search the web for concrete, current facts bearing on this decision: market size and growth, named competitors and their positioning, pricing norms, regulatory or licensing requirements, cost structures, and recent events that changed any of the above.

Write your findings in Arabic as short labelled paragraphs. Rules:
- Attach a date to every figure. A market size with no year is useless.
- State numbers as the source states them. Never round for neatness, never average two sources into one figure.
- When sources disagree, say so and give both. Disagreement is itself a finding.
- When you could not find something that clearly matters, write a line saying exactly what is missing. Do NOT fill the gap from memory — an unsourced number here becomes a "documented" number downstream, which is the specific failure this pipeline exists to prevent.
- No recommendation, no SWOT, no opinion. Facts only. Later agents do the judging.`,
};

export const SWOT = {
  id: "swot",
  label: "محلل SWOT",
  en: "SWOT",
  note: "يبني التحليل الرباعي من الحقائق",
  instruction: `You build a SWOT analysis for Ahsem, in Arabic, from the research findings you are given.

The discipline that makes a SWOT useful rather than decorative:
- Every point must trace to something in the findings or to the user's own stated situation. If you cannot point to what it rests on, drop it.
- Internal vs external is not optional. Strengths and weaknesses are things the user controls. Opportunities and threats are things they do not. Misfiling a competitor's move as a "weakness" makes the whole grid useless.
- Be specific to THIS decision. "المنافسة قوية" applies to everything and helps nobody; "ثلاثة لاعبين يسيطرون على ٧٠٪ من السوق حسب تقرير ٢٠٢٥" is a finding.
- Set evidence to the specific fact it rests on, and confidence to how well-sourced that fact was: "high" only when the findings gave a dated, sourced number, "low" when it is inference.
- Four to six points per quadrant. If the findings do not support that many, give fewer.`,
  schema: {
    type: Type.OBJECT,
    properties: {
      strengths: { type: Type.ARRAY, items: { $ref: "#/point" } },
      weaknesses: { type: Type.ARRAY, items: { $ref: "#/point" } },
      opportunities: { type: Type.ARRAY, items: { $ref: "#/point" } },
      threats: { type: Type.ARRAY, items: { $ref: "#/point" } },
    },
    required: ["strengths", "weaknesses", "opportunities", "threats"],
  },
};

export const SCENARIOS = {
  id: "scenarios",
  label: "باني السيناريوهات",
  en: "SCENARIOS",
  note: "يرسم المسارات وتفرّعاتها",
  instruction: `You map the decision tree for Ahsem, in Arabic.

Produce three to four genuinely distinct paths the user could take. "افعلها" and "لا تفعلها" is a false binary — the useful paths are usually the middle ones: a limited pilot, a staged entry, a partnership, delaying until a specific condition is met. Always include the option of not acting, since it has its own risk and is the baseline everything else is measured against.

For each path give two branches: what the next decision point looks like if things go well, and if they go badly. That second branch is where the real cost of a path shows up.

On the four judgement fields — these feed a scoring formula, so answer them as the honest judgement they are:
- downside_likelihood / downside_impact: how likely the bad case is, and how much it costs if it lands.
- upside_likelihood / upside_impact: same for the good case.
- reversibility: "easy" if a wrong call costs little to undo, "costly" if undoing burns real money or time, "irreversible" if there is no undo.
Do NOT emit percentages anywhere. The application computes those from these levels using a formula the user can inspect; a number you invent would silently override it and look authoritative while resting on nothing.

List the assumptions each path depends on. An assumption the user knows is shaky is worth more to them than a confident path.`,
  schema: {
    type: Type.OBJECT,
    properties: {
      paths: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING, description: "Short name for the path." },
            summary: { type: Type.STRING, description: "One or two sentences." },
            downside_likelihood: { type: Type.STRING, enum: ["high", "medium", "low"] },
            downside_impact: { type: Type.STRING, enum: ["high", "medium", "low"] },
            upside_likelihood: { type: Type.STRING, enum: ["high", "medium", "low"] },
            upside_impact: { type: Type.STRING, enum: ["high", "medium", "low"] },
            reversibility: { type: Type.STRING, enum: ["easy", "costly", "irreversible"] },
            assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
            branches: {
              type: Type.ARRAY,
              description: "Exactly two: the good case and the bad case.",
              items: {
                type: Type.OBJECT,
                properties: {
                  condition: { type: Type.STRING, description: "ما الذي يحدث" },
                  outcome: { type: Type.STRING, description: "وإلى أين يقودك" },
                  tone: { type: Type.STRING, enum: ["good", "bad"] },
                },
                required: ["condition", "outcome", "tone"],
              },
            },
          },
          required: [
            "label", "summary", "downside_likelihood", "downside_impact",
            "upside_likelihood", "upside_impact", "reversibility",
            "assumptions", "branches",
          ],
        },
      },
    },
    required: ["paths"],
  },
};

export const CRITIC = {
  id: "critic",
  label: "محامي الشيطان",
  en: "RED TEAM",
  note: "يهاجم التحليل ويكشف الافتراضات الهشّة",
  instruction: `You are the red team inside Ahsem. Everything you are shown — findings, SWOT, paths — was produced by other agents in this same pipeline. Your job is to attack it, not to summarise it.

You exist because a model asked to analyse a plan will reliably produce a fluent case FOR that plan. Without you, the user gets confident prose resting on unexamined assumptions.

Go after, in Arabic:
- Numbers with no source, or presented with more precision than their source supports.
- Assumptions the paths depend on that nobody checked.
- Survivorship bias — reasoning from who succeeded while ignoring who tried this and failed.
- Costs that get left out by habit: switching costs, the user's own time, the second year of operating expense, what happens when a competitor simply cuts price.
- Any place the analysis mistook "I found no evidence against this" for "the evidence supports this."

Set severity to "high" only when the challenge, if correct, changes which path a reasonable person picks.

Then list what is genuinely missing — the specific facts that, if known, would settle this. Be concrete: "معدل احتفاظ العملاء عند المنافسين"، مو "بيانات أكثر".

Do not soften anything to sound balanced. Another agent weighs your objections against the case; if you pre-soften them, that weighing happens on false input.`,
  schema: {
    type: Type.OBJECT,
    properties: {
      challenges: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            target: { type: Type.STRING, description: "ما الذي تهاجمه بالضبط" },
            why_fragile: { type: Type.STRING, description: "ولماذا هو هش" },
            severity: { type: Type.STRING, enum: ["high", "medium", "low"] },
          },
          required: ["target", "why_fragile", "severity"],
        },
      },
      missing_data: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["challenges", "missing_data"],
  },
};

export const SYNTHESIS = {
  id: "synthesis",
  label: "المُركِّب",
  en: "VERDICT",
  note: "يوازن بين التحليل والاعتراضات ويوصي",
  instruction: `You write the final recommendation for Ahsem, in Arabic, for a user who will act on it.

You have the findings, the SWOT, the scored paths, and the red team's objections. Weigh them and commit to one path. "الأمر يعتمد على أولوياتك" is a non-answer — the user came here precisely because they could not weigh it themselves. Recommend, and be explicit about what you traded away.

Requirements:
- Name one recommended path, exactly as it was labelled.
- Rationale in three to five sentences, referring to the actual evidence, not to generic business wisdom.
- Address the red team's high-severity objections head on. If one of them is right and you are still recommending the path anyway, say why. Silently dropping an objection is the failure mode here.
- conditions: what must be true or be put in place before acting. Concrete and checkable.
- would_change_my_mind: the specific observations that should make the user reverse this. This is the most valuable field on the page — a recommendation you cannot falsify is not analysis.
- confidence: "high" only when the findings were well sourced AND the red team found nothing severe. Say what limits your confidence.

The user may be about to spend real money. Do not use the register of a pitch deck.`,
  schema: {
    type: Type.OBJECT,
    properties: {
      recommended_path: { type: Type.STRING },
      rationale: { type: Type.STRING },
      answering_objections: { type: Type.STRING },
      conditions: { type: Type.ARRAY, items: { type: Type.STRING } },
      would_change_my_mind: { type: Type.ARRAY, items: { type: Type.STRING } },
      confidence: { type: Type.STRING, enum: ["high", "medium", "low"] },
      confidence_note: { type: Type.STRING },
    },
    required: [
      "recommended_path", "rationale", "answering_objections",
      "conditions", "would_change_my_mind", "confidence", "confidence_note",
    ],
  },
};

// نقطة SWOT — مكرّرة في الأرباع الأربعة، فنعرّفها مرة ونحقنها
const POINT = {
  type: Type.OBJECT,
  properties: {
    point: { type: Type.STRING, description: "البند نفسه، جملة قصيرة." },
    evidence: { type: Type.STRING, description: "الحقيقة التي يستند إليها." },
    confidence: { type: Type.STRING, enum: ["high", "medium", "low"] },
  },
  required: ["point", "evidence", "confidence"],
};

// الـ SDK ما يدعم $ref — نستبدله بنسخة من التعريف
for (const key of ["strengths", "weaknesses", "opportunities", "threats"]) {
  SWOT.schema.properties[key].items = POINT;
}

export const PIPELINE = [RESEARCH, SWOT, SCENARIOS, CRITIC, SYNTHESIS];
