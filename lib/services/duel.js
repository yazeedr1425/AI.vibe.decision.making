/**
 * أسئلة المواجهة المباشرة، مولّدة من الخيارات.
 *
 * ما ترمي إلا عند الإلغاء: أي عطل شبكة يرجّع أسئلة محايدة تشتغل مع
 * أي مفاضلة، فيكمل المستخدم بدل ما يعلق على شاشة خطأ. والمسار نفسه
 * يطبّق نفس القاعدة على فشل النموذج أو الشكل.
 */
const NEUTRAL = [
  { key: "want", label: "ايش نفسك فيه؟", en: "CRAVING" },
  { key: "fits", label: "ايش يناسب وضعك الحين؟", en: "FITS NOW" },
  { key: "after", label: "ايش بترتاح له بعدين؟", en: "NO REGRETS" },
];

export const duelService = {
  async questionsFor({ options, signal }) {
    try {
      const res = await fetch("/api/duel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ options }),
        signal,
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok || !Array.isArray(payload.questions)) {
        console.warn("[duel] falling back to neutral questions");
        return { questions: NEUTRAL, source: "fallback" };
      }
      return { questions: payload.questions, source: payload.source };
    } catch (err) {
      if (err.name === "AbortError") throw err;
      console.warn("[duel] request failed:", err.message);
      return { questions: NEUTRAL, source: "fallback" };
    }
  },
};
