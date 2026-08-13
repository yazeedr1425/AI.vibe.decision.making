import { supabase } from "@/lib/supabase";

// حفظ القرار في Supabase حتى يتعلم منه النموذج في المرات الجاية.
//
// ⚠️ يحتاج مستخدم مسجّل دخول:
//   - decisions.user_id هو NOT NULL ويشير إلى auth.users
//   - سياسة decisions_owner_all تشترط auth.uid() = user_id
// بدون جلسة، الإدخال يُرفض بـ 42501. لذلك نرجّع سبب واضح
// بدل ما نرمي استثناء ونكسر شاشة النتيجة.

function titleFrom(options) {
  const joined = options.join(" ضد ");
  return joined.length > 80 ? `${joined.slice(0, 77)}…` : joined;
}

export const decisionService = {
  async currentUserId() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return null;
    return data.user.id;
  },

  /**
   * آخر القرارات لعرضها في "سجل القرارات".
   * ملاحظة: لازم نحدد اسم الـ FK — فيه علاقتان بين decisions و options
   * (options.decision_id و decisions.winner_option_id)، وبدونه يرجع PGRST201.
   */
  async recentDecisions(limit = 6) {
    const userId = await this.currentUserId();
    if (!userId) return { ok: false, reason: "unauthenticated", decisions: [] };

    const { data, error } = await supabase
      .from("decisions")
      .select(
        "id, title, category, created_at, winner_option_id, options!options_decision_id_fkey(id, label)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error)
      return {
        ok: false,
        reason: "query_failed",
        message: error.message,
        decisions: [],
      };

    return {
      ok: true,
      decisions: (data ?? []).map((d) => ({
        id: d.id,
        title: d.title,
        category: d.category,
        createdAt: d.created_at,
        chosen:
          (d.options ?? []).find((o) => o.id === d.winner_option_id)?.label ??
          null,
      })),
    };
  },

  /**
   * @param {{categoryId: string, options: string[], chosen: string,
   *          reason: string, answers: Record<string,string>,
   *          weights?: Record<string, number>, rubric?: object}} input
   * @returns {Promise<{ok: boolean, decisionId?: string, reason?: string, message?: string}>}
   */
  async saveDecision({
    categoryId,
    options,
    chosen,
    reason,
    answers,
    weights,
    rubric,
  }) {
    const userId = await this.currentUserId();
    if (!userId) {
      return {
        ok: false,
        reason: "unauthenticated",
        message: "الحفظ يحتاج تسجيل دخول — القرار ما انحفظ.",
      };
    }

    // 1) القرار نفسه
    const row = {
      user_id: userId,
      title: titleFrom(options),
      category: categoryId,
      mode: "solo",
      status: "closed",
    };

    // المعايير صارت لكل قرار لا لكل فئة، فمفاتيح answers مولّدة لهذي
    // المفاضلة تحديداً. بدون حفظ نصوصها معها يصير الصف مفاتيح خام
    // ما نقدر نعيد عرضها ولا نشرحها للنموذج.
    const criteriaValue = rubric
      ? {
          criteria: rubric.criteria,
          questions: rubric.questions,
          moodCriteria: rubric.moodCriteria,
          generated: Boolean(rubric.generated),
        }
      : null;

    let decision;
    {
      let { data, error } = await supabase
        .from("decisions")
        .insert({ ...row, criteria: criteriaValue })
        .select("id")
        .single();

      // العمود يجي من هجرة لازم تُشغَّل يدوياً، وقد تتأخر. بدون هذا
      // المسار يفشل الحفظ كلياً على قاعدة بيانات ما تحدّثت بعد —
      // نفضّل قراراً محفوظاً بلا معاييره على قرار ضائع.
      // PGRST204 = عمود غير موجود في كاش المخطط.
      if (error?.code === "PGRST204") {
        console.warn(
          "[decisions] عمود criteria غير موجود — شغّل هجرة " +
            "20260813150000_add_decision_criteria.sql. حفظنا بدون المعايير.",
        );
        ({ data, error } = await supabase
          .from("decisions")
          .insert(row)
          .select("id")
          .single());
      }

      if (error) {
        return { ok: false, reason: "insert_failed", message: error.message };
      }
      decision = data;
    }

    // 2) الخيارات
    const { data: savedOptions, error: optionsError } = await supabase
      .from("options")
      .insert(options.map((label) => ({ decision_id: decision.id, label })))
      .select("id, label");

    if (optionsError) {
      return {
        ok: false,
        reason: "options_failed",
        message: optionsError.message,
      };
    }

    // 3) الإجابات — مادة خام لطبقة التعلم الشخصي لاحقاً
    const answerRows = Object.entries(answers ?? {}).map(([key, value]) => ({
      decision_id: decision.id,
      question_key: key,
      value,
      weight: weights?.[key] ?? 1,
    }));

    if (answerRows.length) {
      const { error: answersError } = await supabase
        .from("answers")
        .insert(answerRows);
      // الإجابات إضافية — ما نفشّل الحفظ كله بسببها
      if (answersError)
        console.warn(
          "[decisions] answers insert failed:",
          answersError.message,
        );
    }

    // 4) الفائز
    const winner = savedOptions?.find((o) => o.label === chosen);
    if (winner) {
      const { error: winnerError } = await supabase
        .from("decisions")
        .update({ winner_option_id: winner.id })
        .eq("id", decision.id);

      if (winnerError) {
        return {
          ok: false,
          reason: "winner_failed",
          message: winnerError.message,
        };
      }
    }

    return {
      ok: true,
      decisionId: decision.id,
      reason: reason ? "saved" : "saved",
    };
  },
};
