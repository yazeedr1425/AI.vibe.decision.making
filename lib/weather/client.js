// توقّع الطقس بالساعة من Open-Meteo — مجاني وبلا مفتاح.
//
// النموذج بدونه يرتّب اليوم وهو أعمى عن الجو: يحط لك حديقة الساعة ٣
// العصر في الرياض في أغسطس. نمرّر له توقّع نافذة الخروج فيقدر يزحزح
// المحطات الخارجية لأبرد ساعة فيها.

import { readWeather, weatherKey, writeWeather } from "./cache";

const API = "https://api.open-meteo.com/v1/forecast";
const TIMEOUT_MS = 6000;

// Open-Meteo يعطي ١٦ يوماً للأمام. خارج المدى يرجّع خطأ أو ساعات
// فاضية، ونحن نفضّل نكتشفها هنا بدل ما ندفع نداءً نعرف أنه بيفشل.
const MAX_DAYS_AHEAD = 15;
const MAX_DAYS_BEHIND = 1;

const pad = (n) => String(n).padStart(2, "0");

// "2026-08-13" + ١٣٥٠ دقيقة ← "2026-08-13T22:30"
// وإذا تجاوزت الدقائق منتصف الليل يتقدّم التاريخ معها.
function stamp(date, totalMinutes) {
  const days = Math.floor(totalMinutes / 1440);
  const rest = ((totalMinutes % 1440) + 1440) % 1440;

  const base = new Date(`${date}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);

  const y = base.getUTCFullYear();
  const m = pad(base.getUTCMonth() + 1);
  const d = pad(base.getUTCDate());
  return `${y}-${m}-${d}T${pad(Math.floor(rest / 60))}:${pad(rest % 60)}`;
}

function daysFromToday(date) {
  const now = new Date();
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const target = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(target)) return NaN;
  return Math.round((target - today) / 86400000);
}

/**
 * يرجّع ملخّص طقس نافذة الخروج، أو null.
 *
 * null ليست حالة خطأ يتعامل معها المتصل بشكل خاص — الخطة تُبنى
 * بدون طقس تماماً كما كانت قبل هذه الميزة. أي فشل هنا صامت عمداً.
 */
export async function fetchWeather({
  lat,
  lng,
  date,
  startMinutes,
  durationMinutes,
}) {
  const ahead = daysFromToday(date);
  if (Number.isNaN(ahead) || ahead > MAX_DAYS_AHEAD || ahead < -MAX_DAYS_BEHIND) {
    return null;
  }

  const key = weatherKey({ lat, lng, date });
  const cached = readWeather(key);
  if (cached !== null) return cached;

  const from = stamp(date, startMinutes);
  const to = stamp(date, startMinutes + durationMinutes);

  // النافذة قد تتجاوز منتصف الليل، فنطلب يوم النهاية أيضاً
  const endDate = to.slice(0, 10);

  const url =
    `${API}?latitude=${lat}&longitude=${lng}` +
    `&hourly=apparent_temperature,precipitation_probability` +
    // ⚠️ بدون timezone=auto ترجع الأوقات بـ UTC، والخطة كلها تفكر
    // بالتوقيت المحلي. في الرياض ذلك انزياح ٣ ساعات: "أبرد ساعة"
    // تصير ١٧:٠٠ بدل ٢٠:٠٠ وكل التوصيات تنقلب غلط بصمت.
    `&timezone=auto` +
    `&start_date=${date}&end_date=${endDate}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let payload;
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}`);
    payload = await res.json();
  } catch (err) {
    console.error("[weather] forecast failed:", err.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }

  const times = payload?.hourly?.time;
  // ⚠️ apparent_temperature مو temperature_2m: الإحساس الفعلي هو
  // اللي يحدد إذا كان المكان قابل للزيارة. ٤٠° بظل جاف تختلف عن
  // ٤٠° برطوبة، والفرق بينهما هو الفرق بين خطة تنفع وخطة ما تنفع.
  const feels = payload?.hourly?.apparent_temperature;
  const rain = payload?.hourly?.precipitation_probability;

  if (!Array.isArray(times) || !Array.isArray(feels) || !times.length) {
    console.error("[weather] forecast came back without hourly data");
    return null;
  }

  // أوقات Open-Meteo مع timezone=auto محلية وبصيغة ISO بلا إزاحة،
  // فالمقارنة النصية تكفي وتتفادى أي حساب مناطق زمنية.
  //
  // قصّ الحد الأدنى لأول ١٣ حرفاً ("…T16") ينزل به لبداية الساعة:
  // بداية ١٦:٣٠ لازم تشمل صف ١٦:٠٠ وإلا ضاعت أول ساعة من النافذة.
  const fromHour = from.slice(0, 13);

  const hours = [];
  for (let i = 0; i < times.length; i += 1) {
    const t = times[i];
    if (t < fromHour || t > to) continue;
    if (typeof feels[i] !== "number") continue;
    hours.push({
      time: t.slice(11, 16),
      feels: Math.round(feels[i]),
      rain: typeof rain?.[i] === "number" ? rain[i] : null,
    });
  }

  if (!hours.length) {
    console.error("[weather] no hourly rows fall inside the outing window");
    return null;
  }

  const temps = hours.map((h) => h.feels);
  const rains = hours.map((h) => h.rain).filter((r) => r !== null);
  const hottest = hours.reduce((a, b) => (b.feels > a.feels ? b : a));
  const coolest = hours.reduce((a, b) => (b.feels < a.feels ? b : a));

  const summary = {
    hours,
    hottest,
    coolest,
    minFeels: Math.min(...temps),
    maxFeels: Math.max(...temps),
    maxRain: rains.length ? Math.max(...rains) : null,
    unit: payload.hourly_units?.apparent_temperature ?? "°C",
    timezone: payload.timezone ?? null,
  };

  writeWeather(key, summary);
  return summary;
}
