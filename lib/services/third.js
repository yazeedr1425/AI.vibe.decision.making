/**
 * اقتراح الخيار الثالث.
 *
 * تحسين لا ركن: المسار يرجّع قائمة فاضية عند أي فشل بدل خطأ، وهنا
 * نبتلع ما تبقّى. المستخدم ما طلب اقتراحاً، فسقوطه ما يستاهل رسالة
 * تشوّش عليه وهو يكتب.
 */
export const thirdService = {
  async suggest({ options, signal }) {
    try {
      const res = await fetch("/api/third", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ options }),
        signal,
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok || !Array.isArray(payload.suggestions)) {
        return [];
      }
      return payload.suggestions;
    } catch (err) {
      if (err.name === "AbortError") throw err;
      console.warn("[third] suggest failed:", err);
      return [];
    }
  },
};
