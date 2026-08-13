// عميل Google Places API (New) — خادم فقط.
// المفتاح ما يمرّ للمتصفح أبداً: GOOGLE_MAPS_API_KEY بدون NEXT_PUBLIC_.

import { cacheKey, readCache, writeCache } from "./cache";

const NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";
const TEXT_URL = "https://places.googleapis.com/v1/places:searchText";
const TIMEOUT_MS = 10000;

// نطلب الحقول التي نحتاجها فقط — Places API يحاسب حسب قناع الحقول،
// فطلب الصور والمراجعات يرفع الفاتورة بدون فائدة هنا.
const PLACE_FIELDS = [
  "places.id",
  "places.displayName",
  "places.primaryType",
  "places.types",
  "places.rating",
  "places.priceLevel",
  "places.location",
  "places.regularOpeningHours",
  "places.formattedAddress",
].join(",");

// searchNearby يرجّع ٢٠ نتيجة كحد أقصى للنداء الواحد
const MAX_PER_CALL = 20;

function apiKey() {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    const err = new Error("GOOGLE_MAPS_API_KEY is not set");
    err.code = "NO_MAPS_KEY";
    throw err;
  }
  return key;
}

async function post(url, body, fieldMask) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey(),
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    const err = new Error(
      payload?.error?.message ?? `Places API returned ${res.status}`,
    );
    err.code = "PLACES_FAILED";
    err.status = res.status;
    throw err;
  }

  return payload ?? {};
}

/**
 * يحوّل نصاً كتبه المستخدم ("جدة"، "حي النخيل") لإحداثيات.
 * نستخدم Text Search بدل Geocoding API حتى نبقى على واجهة واحدة.
 */
export async function resolveLocation(query) {
  const payload = await post(
    TEXT_URL,
    { textQuery: query, maxResultCount: 1, languageCode: "ar" },
    "places.location,places.formattedAddress,places.displayName",
  );

  const place = payload.places?.[0];
  const lat = place?.location?.latitude;
  const lng = place?.location?.longitude;

  if (typeof lat !== "number" || typeof lng !== "number") return null;

  return {
    lat,
    lng,
    label: place.displayName?.text ?? place.formattedAddress ?? query,
  };
}

async function searchNearby({ lat, lng, radiusKm, types }) {
  const key = cacheKey({ lat, lng, radiusKm, types });
  const cached = readCache(key);
  if (cached) return cached;

  const payload = await post(
    NEARBY_URL,
    {
      includedTypes: types,
      maxResultCount: MAX_PER_CALL,
      rankPreference: "POPULARITY",
      languageCode: "ar",
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusKm * 1000,
        },
      },
    },
    PLACE_FIELDS,
  );

  const places = payload.places ?? [];
  writeCache(key, places);
  return places;
}

/**
 * يجمع المرشّحين: أنواع المزاج المطلوب + وجبة.
 *
 * نداءان لأن searchNearby سقفه ٢٠ نتيجة، وخطة يوم بلا مطعم ولا مقهى
 * تطلع ناقصة مهما كان المزاج. نداء "سهر" لوحده ما يرجّع مكاناً للغداء.
 */
export async function fetchCandidates({ lat, lng, radiusKm, types }) {
  const foodTypes = ["restaurant", "cafe"];
  const vibeTypes = types.filter((t) => !foodTypes.includes(t));

  const groups = vibeTypes.length ? [vibeTypes, foodTypes] : [foodTypes];

  const results = await Promise.allSettled(
    groups.map((group) => searchNearby({ lat, lng, radiusKm, types: group })),
  );

  const places = [];
  let failures = 0;

  for (const result of results) {
    if (result.status === "fulfilled") places.push(...result.value);
    else {
      failures += 1;
      console.error("[places] nearby search failed:", result.reason);
    }
  }

  // فشل الكل ← نرمي أول خطأ حتى يترجم المسار لرسالة مفهومة.
  // فشل بعضها ← نكمل بالباقي، خطة أضيق أحسن من لا خطة.
  if (failures === results.length) {
    const first = results.find((r) => r.status === "rejected");
    throw first?.reason ?? new Error("Places API returned nothing");
  }

  return places;
}
