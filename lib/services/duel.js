/**
 * أسئلة المواجهة، مولّدة من الخيارات.
 *
 * ما فيه أسئلة احتياطية عمداً: سؤال قالبي يبان ذكياً وهو ما يعرف شي
 * عن خيارات المستخدم، وهذا بالضبط اللي نتخلص منه. الفشل يوصل للواجهة
 * كخطأ صريح مع زر إعادة، لا كأسئلة عامة متنكّرة.
 */
export const duelService = {
  async questionsFor({ options, signal }) {
    const res = await fetch("/api/duel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ options }),
      signal,
    });

    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.ok || !Array.isArray(payload.questions)) {
      const err = new Error(payload?.error ?? "تعذر تجهيز الأسئلة.");
      err.userMessage = payload?.error ?? "تعذر تجهيز الأسئلة — جرب مرة ثانية.";
      throw err;
    }
    return { questions: payload.questions, source: payload.source };
  },
};
