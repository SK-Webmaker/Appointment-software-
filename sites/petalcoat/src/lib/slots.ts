import { STAFF, OPEN } from "@/site.config";

/**
 * The appointment book, simulated. Every chair has a believable spread of
 * free and taken times that stays the same for a given day (it's derived
 * from the date, not random), so the page behaves like a real booking
 * system without a server. Swap `isTaken` for a real API call to go live.
 */

export const STEP = 30; // minutes between start times

const pad = (n: number) => String(n).padStart(2, "0");

/** yyyy-mm-dd in local time. */
export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};

/** "09:30" → 570 */
export const toMins = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
export const fromMins = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/** "14:30" → "2:30 pm" */
export function pretty(t: string) {
  const m = toMins(t);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}${mm ? `:${pad(mm)}` : ""} ${h < 12 ? "am" : "pm"}`;
}

export const dayLabel = (
  iso: string,
  opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" },
) => parseDay(iso).toLocaleDateString("en-AU", opts);

// Small, stable string hash (FNV-1a).
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function isTaken(day: string, artist: string, start: number) {
  // Busier on Saturdays and after work.
  const dow = parseDay(day).getDay();
  const busy = (dow === 6 ? 52 : 34) + (start >= 17 * 60 ? 14 : 0);
  return hash(`${day}|${artist}|${start}`) % 100 < busy;
}

/** Start times (HH:MM) free for a service of `mins` with this artist ("any" = whoever is free). */
export function freeTimes(day: string, artist: string, mins: number, now = new Date()): string[] {
  const hours = OPEN[parseDay(day).getDay()];
  if (!hours) return [];
  const [open, close] = hours;
  const ids = artist === "any" ? STAFF.map((b) => b.id) : [artist];
  const today = day === isoDay(now);
  const earliest = today ? now.getHours() * 60 + now.getMinutes() + 30 : 0;
  const out: string[] = [];
  for (let t = open * 60; t + mins <= close * 60; t += STEP) {
    if (t < earliest) continue;
    // Free for the whole length of the service.
    const steps = Math.ceil(mins / STEP);
    const ok = ids.some((id) =>
      Array.from({ length: steps }, (_, k) => t + k * STEP).every((s) => !isTaken(day, id, s)),
    );
    if (ok) out.push(fromMins(t));
  }
  return out;
}

/** The next `n` days the shop is open, from today. */
export function openDays(n = 10, now = new Date()) {
  const out: { iso: string; closed: boolean }[] = [];
  for (let i = 0; out.length < n && i < 21; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    out.push({ iso: isoDay(d), closed: !OPEN[d.getDay()] });
  }
  return out;
}

/** The soonest free time for this artist, today or on a later open day. */
export function nextFree(artist: string, mins: number, now = new Date()) {
  for (const d of openDays(10, now)) {
    if (d.closed) continue;
    const t = freeTimes(d.iso, artist, mins, now)[0];
    if (t) return { day: d.iso, time: t, today: d.iso === isoDay(now) };
  }
  return null;
}

/** "Open now · until 7 pm" / "Closed · opens Tue 9 am". */
export function openStatus(now = new Date()) {
  const h = OPEN[now.getDay()];
  const mins = now.getHours() * 60 + now.getMinutes();
  if (h && mins >= h[0] * 60 && mins < h[1] * 60)
    return { open: true, text: `Open now · until ${pretty(fromMins(h[1] * 60))}` };
  for (let i = 0; i < 8; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const oh = OPEN[d.getDay()];
    if (!oh) continue;
    if (i === 0 && mins >= oh[0] * 60) continue;
    const when =
      i === 0
        ? "today"
        : i === 1
          ? "tomorrow"
          : d.toLocaleDateString("en-AU", { weekday: "short" });
    return { open: false, text: `Closed · opens ${when} ${pretty(fromMins(oh[0] * 60))}` };
  }
  return { open: false, text: "Closed" };
}

/** A calendar file for the booking, so it lands in the visitor's own calendar. */
export function icsFor({
  ref,
  title,
  day,
  time,
  mins,
  location,
}: {
  ref: string;
  title: string;
  day: string;
  time: string;
  mins: number;
  location: string;
}) {
  const d = day.replace(/-/g, "");
  const start = toMins(time);
  const end = start + mins;
  const t = (m: number) => `${pad(Math.floor(m / 60))}${pad(m % 60)}00`;
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Petalcoat//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${ref}@petalcoat.example`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${d}T${t(start)}`,
    `DTEND:${d}T${t(end)}`,
    `SUMMARY:${title}`,
    `LOCATION:${location}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function downloadFile(name: string, text: string, type = "text/calendar") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A short, readable booking reference: PC-7K2Q. */
export function makeRef(prefix: string, seed: string) {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let h = hash(seed + Date.now());
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += abc[h % abc.length];
    h = Math.floor(h / abc.length) || hash(out + i);
  }
  return `${prefix}-${out}`;
}

/** Which artist takes a booking made with "first available". */
export function whoIsFree(day: string, time: string, mins: number) {
  const t = toMins(time);
  const steps = Math.ceil(mins / STEP);
  return (
    STAFF.find((b) =>
      Array.from({ length: steps }, (_, k) => t + k * STEP).every((s) => !isTaken(day, b.id, s)),
    )?.id ?? STAFF[0]!.id
  );
}

/** An Australian phone number: mobile or landline, spaces and +61 allowed. */
export const validPhone = (s: string) => /^(\+?61|0)[2-478]\d{8}$/.test(s.replace(/[\s()-]/g, ""));
