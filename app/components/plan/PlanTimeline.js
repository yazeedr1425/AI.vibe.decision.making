"use client";

import {
  Car,
  Clock,
  Droplet,
  Lightbulb,
  MapPin,
  Shuffle,
  Star,
  Thermometer,
} from "../icons";
import { formatClock, minutesOfDay } from "@/lib/plan/config";

// الأوقات والمسافات أرقام لاتينية داخل نص عربي. بدون عزلها صراحةً
// تنقلب "14:30" على بعض المتصفحات وتطلع "30:14".
function Ltr({ children }) {
  return (
    <span dir="ltr" style={{ unicodeBidi: "isolate" }}>
      {children}
    </span>
  );
}

function mapsUrl(stop) {
  const params = new URLSearchParams({
    api: "1",
    query: `${stop.lat},${stop.lng}`,
    query_place_id: stop.place_id,
  });
  return `https://www.google.com/maps/search/?${params}`;
}

// كنا نكرّر ﷼ حسب المستوى، لكن الرمز (U+FDFC) رباط يرسمه الخط
// متداخلاً فيطلع لطخة غير مقروءة عند التكرار. الكلمة أوضح وأقصر.
const PRICE_WORDS = ["مجاني", "رخيص", "متوسط", "غالي", "فاخر"];

function duration(minutes) {
  if (minutes < 60) return `${minutes} دقيقة`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h === 1 ? "ساعة" : h === 2 ? "ساعتان" : `${h} ساعات`;
  return m ? `${hours} و${m} دقيقة` : hours;
}

function Travel({ leg, toName }) {
  if (!leg) return null;
  const km = leg.meters != null ? (leg.meters / 1000).toFixed(1) : null;

  return (
    <p className="mt-4 flex items-center gap-1.5 text-sm text-muted">
      <Car size={15} />
      <span>
        <Ltr>{leg.minutes}</Ltr> دقيقة بالسيارة
        {km && (
          <>
            {" · "}
            <Ltr>{km}</Ltr> كم
          </>
        )}{" "}
        إلى {toName}
      </span>
    </p>
  );
}

// محطة واحدة = عنصر قائمة واحد. زمن التنقّل يعيش داخل المحطة التي
// ينطلق منها، مو كعنصر مستقل: لو صار <li> خاصاً به يعلن قارئ الشاشة
// "٥ عناصر" لخطة من ثلاث محطات.
function Stop({ stop, index, total, next }) {
  const arrival = minutesOfDay(stop.arrival_time) ?? 0;
  const leaves = formatClock(arrival + stop.duration_minutes);

  return (
    <li className="flex gap-4">
      {/* العمود والنقطة على اليمين — الخط يتوقف عند آخر محطة */}
      <div className="flex flex-col items-center">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-on-ink"
        >
          {index + 1}
        </span>
        {index < total - 1 && (
          <span aria-hidden="true" className="mt-1 w-px flex-1 bg-line-strong" />
        )}
      </div>

      <div className="flex-1 pb-6">
        <div className="card-shadow rounded-[1.5rem] border border-line bg-card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="text-lg font-semibold">{stop.name}</h3>
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <Clock size={15} />
              <Ltr>
                {stop.arrival_time} – {leaves}
              </Ltr>
            </p>
          </div>

          <p className="mt-1 text-sm text-muted">
            {duration(stop.duration_minutes)}
            {stop.rating != null && (
              <>
                {" · "}
                <span className="inline-flex items-center gap-1 align-middle">
                  <Star size={13} />
                  <Ltr>{stop.rating}</Ltr>
                </span>
              </>
            )}
            {PRICE_WORDS[stop.price_level] && (
              <>{" · " + PRICE_WORDS[stop.price_level]}</>
            )}
          </p>

          {stop.why && <p className="mt-3 leading-relaxed">{stop.why}</p>}

          <a
            href={mapsUrl(stop)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-accent-strong underline-offset-4 hover:underline"
          >
            <MapPin size={15} />
            افتح في الخرائط
            <span className="sr-only">
              {" "}
              — {stop.name} (يفتح في تبويب جديد)
            </span>
          </a>
        </div>

        {next && <Travel leg={stop.travel_to_next} toName={next.name} />}
      </div>
    </li>
  );
}

// شريط الطقس — يختفي كلياً بلا بيانات.
//
// ما نعرض "الطقس غير متاح": الطقس تحسين للخطة لا جزء منها، ورسالة
// عطل عن شي المستخدم ما طلبه تضيف ضجيجاً وتخليه يظن إن في خلل.
function WeatherStrip({ weather }) {
  if (!weather) return null;

  return (
    <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
      <span className="flex items-center gap-1.5">
        <Thermometer size={15} />
        <span>
          الإحساس{" "}
          <Ltr>
            {weather.minFeels}–{weather.maxFeels}
            {weather.unit}
          </Ltr>
        </span>
      </span>
      {weather.maxRain != null && (
        <span className="flex items-center gap-1.5">
          <Droplet size={15} />
          <span>
            احتمال المطر <Ltr>{weather.maxRain}%</Ltr>
          </span>
        </span>
      )}
    </p>
  );
}

export default function PlanTimeline({ plan, weather, onSwap, busy }) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h2
          tabIndex={-1}
          data-step-heading
          className="display text-2xl font-bold sm:text-3xl"
        >
          {plan.title}
        </h2>
        <p className="text-sm text-muted">
          {plan.stops.length} محطات · تبدأ{" "}
          <Ltr>{plan.stops[0].arrival_time}</Ltr>
        </p>
        <WeatherStrip weather={weather} />
      </header>

      <ol className="flex flex-col">
        {plan.stops.map((stop, i) => (
          <Stop
            key={stop.place_id}
            stop={stop}
            index={i}
            total={plan.stops.length}
            next={plan.stops[i + 1]}
          />
        ))}
      </ol>

      {plan.note && (
        <p className="flex items-start gap-2 rounded-2xl bg-card-sunken p-4 text-sm leading-relaxed text-muted">
          <Lightbulb size={16} className="mt-0.5 shrink-0" />
          {plan.note}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted">
          ما عجبتك محطة؟ نستبعدها ونعيد ترتيب اليوم من جديد — يعني باقي
          المحطات ممكن تتغير أوقاتها.
        </p>
        <div className="flex flex-wrap gap-2">
          {plan.stops.map((stop) => (
            <button
              key={stop.place_id}
              type="button"
              disabled={busy}
              onClick={() => onSwap(stop)}
              className="flex items-center gap-1.5 rounded-full border border-line-strong px-3.5 py-2 text-xs transition-colors hover:border-ink disabled:opacity-40"
            >
              <Shuffle size={13} />
              بدّل {stop.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
