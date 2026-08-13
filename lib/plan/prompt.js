// بناء البرومبت لمولّد خطة اليوم.

import { budget, formatClock, group, vibe } from "./config";

export const SYSTEM_PROMPT = `You are a local day-planner. You build a realistic outing itinerary from a fixed list of candidate places.

HARD RULES — these are not suggestions:
1. Use ONLY places from the provided candidate list. NEVER invent a place, and never alter a place_id. Every place_id you output must appear verbatim in the candidates.
2. Order the stops to minimize travel. Group nearby places together; do not zig-zag across the map.
3. Respect the total time available. The sum of stop durations plus realistic travel between them must fit inside the window. Fewer good stops beat a rushed schedule.
4. Match the budget and the group type. A "low" budget means free or inexpensive places. A family with kids gets NO nightlife, NO bars, and NO night clubs — this rule has no exceptions.
5. Return ONLY valid JSON matching the schema. No markdown, no code fences, no commentary before or after.

Schema:
{
  "title": string,
  "stops": [
    {
      "place_id": string,
      "name": string,
      "arrival_time": string,
      "duration_minutes": number,
      "why": string
    }
  ],
  "note": string
}

Field rules:
- "arrival_time" is 24-hour "HH:MM". The first stop starts at the given start time.
- "duration_minutes" is how long they stay at that stop.
- "title", "why", and "note" MUST be written in Arabic, in a warm, friendly, slightly playful voice — like a friend who knows the city. "why" is one short sentence on why this stop suits them specifically.
- "note" is one practical line: parking, timing, booking, or what to watch out for.
- Aim for 3 to 5 stops. If the candidates genuinely cannot fill the window, return fewer stops rather than padding with poor matches.`;

function describePlace(place, index) {
  const bits = [`${index + 1}. [${place.id}] ${place.name}`];
  if (place.category) bits.push(`type=${place.category}`);
  if (place.rating != null) bits.push(`rating=${place.rating}`);
  if (place.price_level != null) bits.push(`price=${place.price_level}/4`);
  bits.push(`coords=${place.lat.toFixed(4)},${place.lng.toFixed(4)}`);
  if (place.address) bits.push(place.address);
  if (!place.opening_hours) bits.push("hours=unknown");
  return bits.join(" · ");
}

export function buildUserPrompt({
  candidates,
  startMinutes,
  durationHours,
  vibeId,
  groupId,
  budgetId,
  locationLabel,
}) {
  const v = vibe(vibeId);
  const g = group(groupId);
  const b = budget(budgetId);

  const endMinutes = startMinutes + durationHours * 60;

  return [
    `Area: ${locationLabel}`,
    `Window: ${formatClock(startMinutes)} to ${formatClock(endMinutes)} (${durationHours} hours total)`,
    `Group: ${g?.id ?? groupId}`,
    `Budget: ${b?.id ?? budgetId} (price level ${b?.maxPriceLevel ?? 4} or below)`,
    `Vibe: ${v?.id ?? vibeId}`,
    "",
    `Candidate places (${candidates.length}) — you may use ONLY these:`,
    ...candidates.map(describePlace),
    "",
    "Build the itinerary now. Return only the JSON object.",
  ].join("\n");
}
