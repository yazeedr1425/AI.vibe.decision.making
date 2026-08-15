// إحصاء سجل القرارات — يُحسب هنا لا عند النموذج.
//
// النماذج ضعيفة في العدّ وقوية في التفسير. لو أعطينا جيميناي أربعين
// صفاً وقلنا "كم مرة ندم؟" يخترع رقماً معقولاً. فنحسب نحن، ويقرأ هو.
// الفائدة الثانية: هذي دالة صافية، تُختبر بلا شبكة ولا مفتاح.

import { normalizeArabic } from "@/lib/text/arabic";

// سلم الرضا ١..٥. الطرفان واضحان والوسط لا يُحسب في أي اتجاه.
const REGRET_AT_OR_BELOW = 2;
const HAPPY_AT_OR_ABOVE = 4;

// طُرح مرتين على الأقل قبل ما نسمي تكراره نمطاً — مرة وحدة صدفة
const REPEAT_THRESHOLD = 2;

const BUCKETS = [
  { key: "late_night", label: "بعد منتصف الليل", from: 0, to: 4 },
  { key: "morning", label: "بالصباح", from: 5, to: 11 },
  { key: "afternoon", label: "بالعصر", from: 12, to: 16 },
  { key: "evening", label: "بالمغرب والليل", from: 17, to: 23 },
];

const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

/**
 * الساعة المحلية للمستخدم، لا ساعة الخادم.
 *
 * created_at مخزّن UTC، والخادم على فيرسل ممكن يكون بأي منطقة. بدون
 * منطقة المستخدم يصير "قراراتك بالليل" مغلوطاً بثلاث ساعات في الرياض
 * — نفس الفخ اللي وقعنا فيه بالطقس. لو المنطقة غير صالحة نرجّع null
 * ويسقط الإحصاء كله بدل ما نعطي رقماً كاذباً.
 */
function hourIn(iso, timeZone) {
  if (!iso || !timeZone) return null;
  try {
    const formatted = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      hour12: false,
    }).format(new Date(iso));
    const hour = Number(formatted);
    // بعض إصدارات ICU ترجّع "24" لمنتصف الليل بدل "00"
    return Number.isInteger(hour) ? hour % 24 : null;
  } catch {
    return null;
  }
}

const bucketFor = (hour) =>
  BUCKETS.find((b) => hour >= b.from && hour <= b.to) ?? null;

/**
 * @param {Array<{category: string, decidedAt: string, chosen: string|null,
 *                rejected: string[], satisfaction: number|null}>} decisions
 * @param {{timeZone?: string}} options
 */
export function summarize(decisions, { timeZone } = {}) {
  const rated = decisions.filter((d) => d.satisfaction != null);
  const regretted = rated.filter((d) => d.satisfaction <= REGRET_AT_OR_BELOW);
  const happy = rated.filter((d) => d.satisfaction >= HAPPY_AT_OR_ABOVE);

  // ---- حسب الفئة ----
  const categories = new Map();
  for (const d of decisions) {
    const key = d.category ?? "غير مصنّف";
    const entry = categories.get(key) ?? { category: key, count: 0, rated: 0, regretted: 0 };
    entry.count += 1;
    if (d.satisfaction != null) {
      entry.rated += 1;
      if (d.satisfaction <= REGRET_AT_OR_BELOW) entry.regretted += 1;
    }
    categories.set(key, entry);
  }

  // ---- الخيارات المتكررة ----
  // نطبّع قبل التجميع: "أطلب من مطعم" و"اطلب من مطعم" نفس الخيار،
  // وبدون التطبيع يظهران سطرين ويضيع النمط.
  const labels = new Map();
  const note = (label, won) => {
    if (!label) return;
    const key = normalizeArabic(label);
    if (!key) return;
    const entry = labels.get(key) ?? { label, offered: 0, chosen: 0 };
    entry.offered += 1;
    if (won) entry.chosen += 1;
    labels.set(key, entry);
  };

  for (const d of decisions) {
    note(d.chosen, true);
    for (const label of d.rejected ?? []) note(label, false);
  }

  const repeated = [...labels.values()]
    .filter((l) => l.offered >= REPEAT_THRESHOLD)
    .sort((a, b) => b.offered - a.offered);

  // ---- المفاضلات المكررة ----
  // نفس المجموعة ترجع مرة بعد مرة: "البيك ضد شاورما" ثلاث مرات في
  // سجل واحد. هذا أقوى من تكرار خيار مفرد — تكرار الخيار عادة، أما
  // تكرار المفاضلة فسؤال ما انحسم: التطبيق حسمه كل مرة، وراسه لا.
  //
  // المفتاح مرتّب بعد التطبيع حتى تكون "البيك ضد شاورما" و"شاورما
  // ضد البيك" مفاضلة واحدة.
  const matchups = new Map();
  for (const d of decisions) {
    // chosen يكون null لو ما انحفظ فائز، وحينها rejected تحمل كل
    // الخيارات — فالمجموعة كاملة في الحالتين
    const labels = [d.chosen, ...(d.rejected ?? [])].filter(Boolean);
    if (labels.length < 2) continue;

    const key = labels.map(normalizeArabic).sort().join(" ¦ ");
    const entry = matchups.get(key) ?? {
      labels,
      times: 0,
      decided: 0,
      rated: 0,
      regretted: 0,
      winners: new Map(),
    };

    entry.times += 1;
    if (d.chosen) {
      entry.decided += 1;
      const winnerKey = normalizeArabic(d.chosen);
      const winner = entry.winners.get(winnerKey) ?? { label: d.chosen, count: 0 };
      winner.count += 1;
      entry.winners.set(winnerKey, winner);
    }
    if (d.satisfaction != null) {
      entry.rated += 1;
      if (d.satisfaction <= REGRET_AT_OR_BELOW) entry.regretted += 1;
    }
    matchups.set(key, entry);
  }

  const repeatedMatchups = [...matchups.values()]
    .filter((m) => m.times >= REPEAT_THRESHOLD)
    .map((m) => ({
      labels: m.labels,
      times: m.times,
      rated: m.rated,
      regretted: m.regretted,
      winners: [...m.winners.values()].sort((a, b) => b.count - a.count),
      // حسم واحد في كل مرة = يعرف الجواب ويطلب إذناً. تأرجح = المفاضلة
      // نفسها ناقصة شيئاً ما تلتقطه الخيارات.
      settled: m.winners.size === 1 && m.decided === m.times,
    }))
    .sort((a, b) => b.times - a.times);

  // ---- وقت الحيرة ----
  // كل الأوقات لازم تُقرأ، وإلا صار التوزيع على عيّنة ناقصة
  const hours = decisions.map((d) => hourIn(d.decidedAt, timeZone));
  const timing = hours.every((h) => h != null)
    ? BUCKETS.map((b) => ({
        key: b.key,
        label: b.label,
        count: hours.filter((h) => bucketFor(h)?.key === b.key).length,
      })).filter((b) => b.count > 0)
    : null;

  const optionCounts = decisions.map((d) => 1 + (d.rejected?.length ?? 0));

  return {
    total: decisions.length,
    rated: rated.length,
    regretted: regretted.length,
    happy: happy.length,
    regretRate: percent(regretted.length, rated.length),

    byCategory: [...categories.values()]
      .map((c) => ({ ...c, regretRate: percent(c.regretted, c.rated) }))
      .sort((a, b) => b.count - a.count),

    // يُطرح كثيراً وما يفوز أبداً — أقوى نمط في الملف: الخيار اللي
    // يحطه المستخدم كل مرة وما يختاره ولا مرة
    neverChosen: repeated.filter((l) => l.chosen === 0),
    alwaysChosen: repeated.filter((l) => l.chosen === l.offered),
    repeated: repeated.slice(0, 8),

    // المفاضلة اللي رجع لها أكثر من مرة — سؤال ما انحسم
    matchups: repeatedMatchups,

    timing,
    averageOptionCount: optionCounts.length
      ? Number(
          (optionCounts.reduce((a, b) => a + b, 0) / optionCounts.length).toFixed(1),
        )
      : 0,
  };
}

/** الإحصاء كنص عربي مختصر يدخل البرومبت — لا يُعرض للمستخدم */
export function describe(stats) {
  const lines = [
    `عدد القرارات المحفوظة: ${stats.total}`,
    `المقيَّم منها: ${stats.rated} (${stats.happy} ارتاح لها، ${stats.regretted} ندم عليها)`,
  ];

  if (stats.rated) lines.push(`نسبة الندم: ${stats.regretRate}٪`);

  if (stats.byCategory.length > 1) {
    lines.push(
      "حسب النوع: " +
        stats.byCategory
          .map((c) => {
            const suffix = c.rated ? ` وندم على ${c.regretRate}٪ منها` : "";
            return `${c.category} ${c.count}${suffix}`;
          })
          .join("، "),
    );
  }

  if (stats.neverChosen.length) {
    lines.push(
      "خيارات يطرحها ولا يختارها أبداً: " +
        stats.neverChosen.map((l) => `"${l.label}" (طرحه ${l.offered} مرات)`).join("، "),
    );
  }

  if (stats.alwaysChosen.length) {
    lines.push(
      "خيارات يختارها كل مرة يطرحها: " +
        stats.alwaysChosen.map((l) => `"${l.label}" (${l.offered} مرات)`).join("، "),
    );
  }

  if (stats.matchups.length) {
    lines.push(
      "مفاضلات رجع لها أكثر من مرة: " +
        stats.matchups
          .map((m) => {
            const pair = m.labels.map((l) => `"${l}"`).join(" ضد ");
            const verdict = m.settled
              ? `واختار "${m.winners[0].label}" في كل مرة`
              : m.winners.length > 1
                ? `وتأرجح: ${m.winners.map((w) => `"${w.label}" ${w.count}`).join("، ")}`
                : "";
            const regret = m.regretted ? ` وندم على ${m.regretted} منها` : "";
            return `${pair} ${m.times} مرات${verdict ? " " + verdict : ""}${regret}`;
          })
          .join("؛ "),
    );
  }

  if (stats.timing?.length) {
    lines.push(
      "وقت حيرته: " + stats.timing.map((t) => `${t.label} ${t.count}`).join("، "),
    );
  }

  lines.push(`متوسط عدد الخيارات في القرار: ${stats.averageOptionCount}`);

  return lines.join("\n");
}
