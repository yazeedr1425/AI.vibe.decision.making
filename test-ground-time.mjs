import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname) + "/";
const { shapeNow, cacheSlice, sliceOf, readNow } = await import(pathToFileURL(root + "lib/time/now.js"));
const { framePrompt } = await import(pathToFileURL(root + "lib/engine/frame.js"));

let fail = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "ok  " : "FAIL"}  ${name}${extra ? "  → " + extra : ""}`);
};

const good = { iso: "2026-08-16T20:40:00.000Z", tz: "Asia/Riyadh", weekday: "friday", hour: 23, isWeekend: false };

// ---- shapeNow: العقد ----
const shaped = shapeNow(good);
ok("valid payload accepted", !!shaped);
ok("isWeekend derived server-side, client claim ignored", shaped.isWeekend === true,
   `client sent false, server derived ${shaped.isWeekend}`);
ok("bad tz drops the block (not an error)", shapeNow({ ...good, tz: "Mars/Olympus" }) === null);
ok("injection-shaped tz rejected", shapeNow({ ...good, tz: "'; DROP--" }) === null);
ok("hour 24 rejected", shapeNow({ ...good, hour: 24 }) === null);
ok("hour -1 rejected", shapeNow({ ...good, hour: -1 }) === null);
ok("non-integer hour rejected", shapeNow({ ...good, hour: 12.5 }) === null);
ok("unknown weekday rejected", shapeNow({ ...good, weekday: "funday" }) === null);
ok("unparseable iso rejected", shapeNow({ ...good, iso: "not-a-date" }) === null);
ok("null in → null out", shapeNow(null) === null);
ok("array in → null out", shapeNow([1, 2]) === null);

// ---- الشرائح ومفتاح الكاش ----
const at = (hour, weekday = "monday") => shapeNow({ ...good, hour, weekday });
ok("07:00 → morning", sliceOf(at(7)) === "morning");
ok("13:00 → noon", sliceOf(at(13)) === "noon");
ok("19:00 → evening", sliceOf(at(19)) === "evening");
ok("23:00 → night", sliceOf(at(23)) === "night");
ok("02:00 → night", sliceOf(at(2)) === "night");
ok("midnight decision ≠ noon decision in cache", cacheSlice(at(23)) !== cacheSlice(at(13)),
   `${cacheSlice(at(23))} vs ${cacheSlice(at(13))}`);
ok("7am and 9am share a key (no 24-way split)", cacheSlice(at(7)) === cacheSlice(at(9)));
ok("weekend evening ≠ weekday evening", cacheSlice(at(19, "friday")) !== cacheSlice(at(19, "monday")),
   `${cacheSlice(at(19, "friday"))} vs ${cacheSlice(at(19, "monday"))}`);
ok("no time → stable 'anytime' key", cacheSlice(null) === "anytime");

// ---- البرومبت ----
const opts = ["شاورما", "بروست"];
const withTime = framePrompt(opts, at(23, "friday"));
const without = framePrompt(opts, null);
ok("facts line present when time known", withTime.includes("الوقت عند المستخدم"));
ok("weekday rendered in Arabic", withTime.includes("الجمعة"));
ok("hour in Arabic-Indic digits", withTime.includes("٢٣"), JSON.stringify(withTime.match(/الساعة\s+\S+/)?.[0]));
ok("no Latin digits in the facts line", !/الوقت عند المستخدم[^\n]*[0-9]/.test(withTime));
ok("weekend flagged", withTime.includes("عطلة"));
ok("line dropped entirely when time unknown", !without.includes("الوقت عند المستخدم"));
ok("options still present without time", without.includes("شاورما"));

console.log("\n--- facts line ---");
console.log(withTime.split("\n").find((l) => l.includes("الوقت")));
console.log(fail ? `\n${fail} FAILED` : "\nall passed");
