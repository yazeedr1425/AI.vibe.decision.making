import { supabase } from "@/lib/supabase";

// القراءة فقط. الكتابة تصير في app/api/analyze لأن التحليل يُبنى
// على الخادم أصلاً، وحفظه هناك يوفّر رحلة ذهاب وإياب كاملة
// لحمولة كبيرة (نص الباحث + SWOT + المسارات).

export const analysisService = {
  async recentAnalyses(limit = 6) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return { ok: false, reason: "unauthenticated", analyses: [] };

    const { data, error } = await supabase
      .from("analyses")
      .select("id, statement, recommendation, created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error)
      return { ok: false, reason: "query_failed", message: error.message, analyses: [] };

    return {
      ok: true,
      analyses: (data ?? []).map((a) => ({
        id: a.id,
        statement: a.statement,
        recommended: a.recommendation?.recommended_path ?? null,
        confidence: a.recommendation?.confidence ?? null,
        createdAt: a.created_at,
      })),
    };
  },

  async getAnalysis(id) {
    const { data, error } = await supabase
      .from("analyses")
      .select("*")
      .eq("id", id)
      .single();

    if (error) return { ok: false, message: error.message };
    return { ok: true, analysis: data };
  },
};
