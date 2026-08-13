// تحليل رد النموذج والتحقق منه.
//
// Sonnet 4.6 ما يدعم structured outputs (وصلت مع Sonnet 5 و Opus 4.8)،
// يعني ما نقدر نفرض الشكل على مستوى الـ API. فالرد قد يجي ملفوفاً
// بـ ```json أو معه جملة قبله. التنظيف هنا مو احتياطاً زائداً — هو
// الطبقة الوحيدة اللي تضمن الشكل.

import { minutesOfDay } from "./config";

const MAX_STOP_MINUTES = 8 * 60;

// يشيل ```json … ``` ويلتقط أول كائن JSON لو النموذج حشا كلاماً حوله
function extractJson(text) {
  let cleaned = text.trim();

  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(cleaned);
  if (fenced) cleaned = fenced[1].trim();

  if (cleaned.startsWith("{")) return cleaned;

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) return cleaned.slice(start, end + 1);

  return cleaned;
}

const text = (value, max) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

/**
 * يرجّع { ok, plan, dropped } — dropped عدد المحطات المرفوضة.
 * ok:false فقط لو الرد نفسه غير صالح؛ خطة بلا محطات صالحة ترجع
 * ok:true مع stops فاضية، والمسار يترجمها لحالة فاضية ودّية.
 */
export function parsePlan(raw, candidates) {
  const byId = new Map(candidates.map((c) => [c.id, c]));

  let parsed;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    return {
      ok: false,
      reason: "BAD_JSON",
      sample: raw.slice(0, 200),
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "NOT_OBJECT", sample: raw.slice(0, 200) };
  }

  if (!Array.isArray(parsed.stops)) {
    return { ok: false, reason: "NO_STOPS", sample: raw.slice(0, 200) };
  }

  const stops = [];
  const dropped = [];
  const used = new Set();

  for (const stop of parsed.stops) {
    if (!stop || typeof stop !== "object") {
      dropped.push({ reason: "not-an-object" });
      continue;
    }

    // القاعدة الصلبة: المعرّف لازم يكون من القائمة التي أرسلناها.
    // النموذج قد يخترع مكاناً معقولاً تماماً — وهذا بالضبط ما نمنعه.
    const place = byId.get(stop.place_id);
    if (!place) {
      dropped.push({ reason: "unknown-place_id", place_id: stop.place_id });
      continue;
    }

    if (used.has(place.id)) {
      dropped.push({ reason: "duplicate", place_id: place.id });
      continue;
    }

    const arrival = text(stop.arrival_time, 5);
    if (!arrival || minutesOfDay(arrival) === null) {
      dropped.push({ reason: "bad-arrival_time", place_id: place.id });
      continue;
    }

    const duration = Number(stop.duration_minutes);
    if (!Number.isFinite(duration) || duration <= 0) {
      dropped.push({ reason: "bad-duration", place_id: place.id });
      continue;
    }

    used.add(place.id);
    stops.push({
      place_id: place.id,
      // الاسم من قائمتنا لا من رد النموذج — لو أعاد صياغته أو ترجمه
      // نبقى على الاسم اللي يعرفه المستخدم على الخريطة
      name: place.name ?? text(stop.name, 120) ?? place.id,
      arrival_time: arrival,
      duration_minutes: Math.min(Math.round(duration), MAX_STOP_MINUTES),
      why: text(stop.why, 300) ?? "",
      lat: place.lat,
      lng: place.lng,
      address: place.address,
      rating: place.rating,
      price_level: place.price_level,
      category: place.category,
    });
  }

  if (dropped.length) {
    console.warn(
      `[plan] dropped ${dropped.length} stop(s):`,
      JSON.stringify(dropped),
    );
  }

  return {
    ok: true,
    dropped: dropped.length,
    plan: {
      title: text(parsed.title, 120) ?? "خطة يومك",
      note: text(parsed.note, 400) ?? "",
      stops,
    },
  };
}
