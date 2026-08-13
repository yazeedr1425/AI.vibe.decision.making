// أزمنة التنقّل الحقيقية بين محطات الخطة — خادم فقط.
//
// نحسبها بعد ما يختار النموذج المحطات ويرتّبها، مو قبل: مصفوفة كاملة
// لثلاثين مرشّحاً = ٩٠٠ عنصر محاسَب، بينما الخطة النهائية ما تحتاج
// إلا ثلاث أو أربع أرجل متتالية.

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const TIMEOUT_MS = 8000;

const point = (stop) => ({
  location: {
    latLng: { latitude: stop.lat, longitude: stop.lng },
  },
});

async function computeLeg(from, to, key) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(ROUTES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: point(from),
        destination: point(to),
        travelMode: "DRIVE",
        // TRAFFIC_UNAWARE أرخص ولا يحتاج وقت انطلاق؛ الخطة تقديرية أصلاً
        routingPreference: "TRAFFIC_UNAWARE",
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error?.message ?? `Routes API ${res.status}`);
    }

    const payload = await res.json();
    const route = payload.routes?.[0];
    if (!route) return null;

    // duration يجي كنص بالثواني: "930s"
    const seconds = Number.parseInt(String(route.duration ?? ""), 10);
    if (!Number.isFinite(seconds)) return null;

    return {
      minutes: Math.max(1, Math.round(seconds / 60)),
      meters: route.distanceMeters ?? null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * يرجّع مصفوفة بطول stops.length - 1: زمن الانتقال من كل محطة للتالية.
 * أي رجل تفشل ترجع null — الخطة تظهر بدون زمن تنقّل بدل ما تنكسر.
 */
export async function travelLegs(stops) {
  if (stops.length < 2) return [];

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return stops.slice(1).map(() => null);

  const pairs = stops.slice(0, -1).map((from, i) => [from, stops[i + 1]]);

  const results = await Promise.allSettled(
    pairs.map(([from, to]) => computeLeg(from, to, key)),
  );

  return results.map((result) => {
    if (result.status === "fulfilled") return result.value;
    console.error("[routing] leg failed:", result.reason);
    return null;
  });
}
