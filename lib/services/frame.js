/**
 * توليد إطار القرار — المعايير والأسئلة الخاصة بخيارات المستخدم.
 *
 * على عكس اقتراح الخيار الثالث، هذا ركن لا تحسين: بدون الإطار ما فيه
 * أسئلة ولا معايير ولا نتيجة. فالفشل يُرجَّع برسالته العربية ليعرضها
 * المستدعي، ولا يُبتلع ولا يُستبدل بقالب.
 */
export const frameService = {
  async build({ options, signal }) {
    try {
      const res = await fetch("/api/frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ options }),
        signal,
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.ok || !payload.frame) {
        return {
          ok: false,
          message: payload?.error ?? "ما قدرنا نقرأ خياراتك الحين.",
        };
      }

      return { ok: true, frame: payload.frame };
    } catch (err) {
      if (err.name === "AbortError") throw err;
      console.error("[frame] build failed:", err);
      return { ok: false, message: "ما قدرنا نوصل للمحرك — تأكد من اتصالك." };
    }
  },
};
