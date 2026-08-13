import { getCategory } from "@/lib/engine/categories";

/**
 * يجيب معايير وأسئلة مفصّلة على الخيارين نفسيهما.
 *
 * ما يرمي أبداً: أي عطل شبكة يرجّع القالب الثابت، فالمستخدم يكمل
 * بالأسئلة العامة بدل ما يعلق على شاشة خطأ. المسار نفسه يطبّق نفس
 * القاعدة على فشل النموذج أو فشل التحقق.
 */
export const criteriaService = {
  async forOptions({ categoryId, options, signal }) {
    const fallback = getCategory(categoryId);

    try {
      const res = await fetch("/api/criteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, options }),
        signal,
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok || !payload.rubric) {
        console.warn("[criteria] falling back to the static template");
        return { rubric: fallback, source: "template" };
      }

      return { rubric: payload.rubric, source: payload.source };
    } catch (err) {
      if (err.name === "AbortError") throw err;
      console.warn("[criteria] request failed:", err.message);
      return { rubric: fallback, source: "template" };
    }
  },
};
