import { getCategory } from "@/lib/engine/categories";

/**
 * أسئلة مصاغة على الخيارين. المعايير تبقى من القالب.
 *
 * ما ترمي أبداً إلا عند الإلغاء: أي عطل شبكة يرجّع القالب فيكمل
 * المستخدم بالأسئلة العامة بدل ما يعلق على شاشة خطأ. والمسار نفسه
 * يطبّق نفس القاعدة على فشل النموذج أو التحقق.
 */
export const questionsService = {
  async forOptions({ categoryId, options, signal }) {
    const fallback = getCategory(categoryId);

    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, options }),
        signal,
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok || !payload.category) {
        console.warn("[questions] falling back to the static template");
        return { category: fallback, source: "template" };
      }
      return { category: payload.category, source: payload.source };
    } catch (err) {
      if (err.name === "AbortError") throw err;
      console.warn("[questions] request failed:", err.message);
      return { category: fallback, source: "template" };
    }
  },
};
