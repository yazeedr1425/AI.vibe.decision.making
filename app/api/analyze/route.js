import { GoogleGenAI } from "@google/genai";
import { PIPELINE, RESEARCH, SWOT, SCENARIOS, CRITIC, SYNTHESIS } from "@/lib/analyze/agents";
import { rankPaths } from "@/lib/analyze/risk";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "gemini-2.5-flash";

// الباحث أبطأ من البقية لأنه يطلع للشبكة فعلياً
const TIMEOUT_MS = { research: 45000, default: 30000 };

const MAX_STATEMENT = 600;
const MAX_CONTEXT = 2000;

// ---------------------------------------------------------------
// بروتوكول البث — NDJSON: سطر JSON واحد لكل حدث.
//
// اخترناه على SSE لأن العميل هنا كود نكتبه نحن، مو EventSource،
// فما نحتاج طبقة الأحداث المسمّاة. والقراءة سطراً سطراً كافية.
// خط الوكلاء يأخذ دقيقة تقريباً، والمستخدم لازم يشوف التقدم
// بدل شاشة معلّقة.
// ---------------------------------------------------------------

function ndjson(controller, encoder, event) {
  controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
}

function validate(body) {
  const statement =
    typeof body?.statement === "string" ? body.statement.trim() : "";

  if (!statement) return { ok: false, message: "اكتب القرار اللي تبي تحلله." };
  if (statement.length > MAX_STATEMENT)
    return { ok: false, message: "وصف القرار طويل — اختصره شوي." };

  const context =
    typeof body?.context === "string"
      ? body.context.trim().slice(0, MAX_CONTEXT)
      : "";

  return { ok: true, value: { statement, context } };
}

async function resolveUserId(request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) return null;

  try {
    const { data, error } = await supabaseAdmin().auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch (err) {
    console.error("[api/analyze] token check failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------
// نداء وكيل واحد
// ---------------------------------------------------------------

async function runAgent(ai, agent, prompt) {
  const controller = new AbortController();
  const ms = TIMEOUT_MS[agent.id] ?? TIMEOUT_MS.default;
  const timeout = setTimeout(() => controller.abort(), ms);

  try {
    const config = {
      systemInstruction: agent.instruction,
      abortSignal: controller.signal,
      // الباحث يحتاج حرية أوسع في الصياغة؛ البقية نبيهم منضبطين
      temperature: agent.grounded ? 0.3 : 0.5,
    };

    if (agent.grounded) {
      // البحث والمخطط المنظّم ما يجتمعان في نداء واحد
      config.tools = [{ googleSearch: {} }];
    } else {
      config.responseMimeType = "application/json";
      config.responseSchema = agent.schema;
    }

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config,
    });

    const text = response?.text?.trim();
    if (!text) throw new Error(`${agent.id}: empty response`);

    if (agent.grounded) {
      // المصادر تجي من grounding metadata، مو من نص النموذج —
      // النموذج ممكن يخترع رابطاً، الميتاداتا لأ.
      const chunks =
        response?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];

      const seen = new Set();
      const sources = [];
      for (const c of chunks) {
        const uri = c?.web?.uri;
        if (!uri || seen.has(uri)) continue;
        seen.add(uri);
        sources.push({ uri, title: c.web.title ?? uri });
      }

      return { text, sources };
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`${agent.id}: non-JSON response`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------
// بناء برومبت كل مرحلة من مخرجات ما قبلها
// ---------------------------------------------------------------

const section = (title, body) => `\n\n## ${title}\n${body}`;

function promptFor(agent, state) {
  const head = [
    `القرار المطروح: ${state.statement}`,
    state.context ? `سياق إضافي من المستخدم: ${state.context}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  if (agent.id === RESEARCH.id) return head;

  let prompt = head + section("حقائق جمعها الباحث", state.findings ?? "لا شيء");

  if (agent.id === SWOT.id) return prompt;

  prompt += section("تحليل SWOT", JSON.stringify(state.swot ?? {}, null, 1));

  if (agent.id === SCENARIOS.id) return prompt;

  prompt += section("المسارات المطروحة", JSON.stringify(state.paths ?? [], null, 1));

  if (agent.id === CRITIC.id) return prompt;

  prompt += section(
    "اعتراضات الفريق الأحمر",
    JSON.stringify(state.challenges ?? {}, null, 1),
  );

  // المُركِّب يشوف الدرجات المحسوبة، مو المستويات الخام فقط
  prompt += section(
    "درجات المخاطرة المحسوبة (من الكود، لا تعدّلها)",
    (state.ranked ?? [])
      .map(
        (p) =>
          `- ${p.label}: مخاطرة ${p.risk}٪ · جاذبية ${p.upside}٪ · ${p.quadrant.label}`,
      )
      .join("\n") || "لا شيء",
  );

  return prompt;
}

function absorb(agent, output, state) {
  if (agent.id === RESEARCH.id) {
    state.findings = output.text;
    state.sources = output.sources;
    return { sourceCount: output.sources.length };
  }
  if (agent.id === SWOT.id) {
    state.swot = output;
    return output;
  }
  if (agent.id === SCENARIOS.id) {
    state.paths = output.paths ?? [];
    // الأرقام تتحسب هنا في الكود — انظر lib/analyze/risk.js
    state.ranked = rankPaths(state.paths);
    return { paths: state.ranked };
  }
  if (agent.id === CRITIC.id) {
    state.challenges = output;
    return output;
  }
  state.recommendation = output;
  return output;
}

// ---------------------------------------------------------------
// POST /api/analyze  →  تدفق NDJSON
// ---------------------------------------------------------------

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "الطلب لازم يكون JSON صالح." },
      { status: 400 },
    );
  }

  const parsed = validate(body);
  if (!parsed.ok)
    return Response.json({ ok: false, error: parsed.message }, { status: 400 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey)
    return Response.json(
      { ok: false, error: "محرك التحليل غير مهيأ — GEMINI_API_KEY مفقود." },
      { status: 503 },
    );

  const userId = await resolveUserId(request);
  const state = { ...parsed.value };
  const ai = new GoogleGenAI({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (const agent of PIPELINE) {
          ndjson(controller, encoder, {
            type: "agent_start",
            agent: agent.id,
            label: agent.label,
            en: agent.en,
            note: agent.note,
          });

          let output;
          try {
            output = await runAgent(ai, agent, promptFor(agent, state));
          } catch (err) {
            console.error(`[api/analyze] ${agent.id} failed:`, err);
            ndjson(controller, encoder, {
              type: "fatal",
              agent: agent.id,
              message:
                err.name === "AbortError"
                  ? `${agent.label} تأخر بالرد. جرب مرة ثانية.`
                  : `${agent.label} تعثّر. جرب مرة ثانية.`,
            });
            return; // الإغلاق في finally — استدعاؤه هنا كمان يرمي
          }

          ndjson(controller, encoder, {
            type: "agent_done",
            agent: agent.id,
            data: absorb(agent, output, state),
          });
        }

        const result = {
          statement: state.statement,
          context: state.context,
          findings: state.findings,
          sources: state.sources ?? [],
          swot: state.swot,
          paths: state.ranked ?? [],
          challenges: state.challenges,
          recommendation: state.recommendation,
          model: MODEL,
        };

        // الحفظ إضافة مو شرط — تحليل غير محفوظ أفضل من تحليل ضائع
        let saved = null;
        let saveError = null;

        if (userId) {
          const { data, error } = await supabaseAdmin()
            .from("analyses")
            .insert({
              user_id: userId,
              statement: state.statement,
              context: state.context || null,
              findings: state.findings,
              sources: state.sources ?? [],
              swot: state.swot,
              paths: state.ranked ?? [],
              challenges: state.challenges,
              recommendation: state.recommendation,
              model: MODEL,
            })
            .select("id")
            .single();

          if (error) {
            console.error("[api/analyze] save failed:", error);
            saveError = "التحليل جاهز لكن ما انحفظ في سجلك.";
          } else {
            saved = data.id;
          }
        }

        ndjson(controller, encoder, {
          type: "done",
          result,
          analysisId: saved,
          saveError,
          savedHint: userId ? null : "سجّل دخولك عشان نحفظ تحليلاتك.",
        });
      } catch (err) {
        console.error("[api/analyze] stream failed:", err);
        ndjson(controller, encoder, {
          type: "fatal",
          message: "صار خطأ غير متوقع أثناء التحليل.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      // بدونه بعض الوسطاء يجمّعون الرد ويضيع الغرض من البث
      "X-Accel-Buffering": "no",
    },
  });
}
