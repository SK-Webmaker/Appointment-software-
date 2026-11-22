import { AREA, GAUGE, OPEN, WINDOWS, etaFor, problemOf } from "@/site.config";

/**
 * The job book, simulated. Window availability, van ETAs and fixed-price
 * ranges are derived from the date and the inputs (never random), so the
 * page behaves like the real thing without a server. Swap these for calls
 * to the dispatch system to go live.
 */

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};
export const dayLabel = (
  iso: string,
  opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" },
) => parseDay(iso).toLocaleDateString("en-AU", opts);

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** After 6 pm, before 7 am, Sundays: emergencies only, at the after-hours rate. */
export function isAfterHours(now = new Date()) {
  const h = OPEN[now.getDay()];
  const t = now.getHours() + now.getMinutes() / 60;
  return !h || t < h[0] || t >= h[1];
}

/** Two-hour windows still open on a day (today's must start at least 90 minutes out). */
export function freeWindows(day: string, now = new Date()) {
  const hours = OPEN[parseDay(day).getDay()];
  if (!hours) return [];
  const today = day === isoDay(now);
  const t = now.getHours() + now.getMinutes() / 60;
  return WINDOWS.filter(
    (w) =>
      w.from >= hours[0] &&
      w.from + 2 <= hours[1] &&
      (!today || w.from >= t + 1.5) &&
      hash(`${day}|${w.id}`) % 100 >= 30,
  );
}

/** The next `n` days we take booked jobs on. */
export function openDays(n = 8, now = new Date()) {
  const out: { iso: string; closed: boolean }[] = [];
  for (let i = 0; out.length < n && i < 21; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    out.push({ iso: isoDay(d), closed: !OPEN[d.getDay()] });
  }
  return out;
}

/** The van's ETA right now: the postcode's base, plus traffic at peak hour. */
export function etaNow(postcode: string, now = new Date()) {
  const h = now.getHours();
  const peak = (h >= 7 && h < 9) || (h >= 16 && h < 19) ? 14 : h >= 22 || h < 6 ? -6 : 0;
  return Math.max(20, etaFor(postcode) + peak);
}

export const suburbOf = (postcode: string) => AREA[postcode.trim()];

/** A fixed-price range for a problem, how much of it there is, and when. */
export function estimate(problemId: string, qty: number, afterHours: boolean) {
  const p = problemOf(problemId);
  if (!p) return null;
  const k = [1, 1.7, 2.6][qty] ?? 1;
  const load = afterHours ? GAUGE.afterHoursLoading : 1;
  const round = (n: number) => Math.round(n / 10) * 10;
  return { from: round(p.from * k * load), to: round(p.to * (0.6 + k * 0.4) * load) };
}

/** "On call now · office open until 6 pm" */
export function openStatus(now = new Date()) {
  const h = OPEN[now.getDay()];
  const t = now.getHours() + now.getMinutes() / 60;
  const fmt = (x: number) => `${((x + 11) % 12) + 1} ${x < 12 ? "am" : "pm"}`;
  if (h && t >= h[0] && t < h[1])
    return { office: true, text: `On call now · office open until ${fmt(h[1])}` };
  return { office: false, text: "On call now · after-hours emergencies" };
}

/** Three vans out right now, somewhere in the area (fictional), for the map. */
export function vansOut(now = new Date()) {
  return 2 + (hash(`${isoDay(now)}|${now.getHours()}`) % 3);
}

export function icsFor({
  ref,
  title,
  day,
  from,
  location,
}: {
  ref: string;
  title: string;
  day: string;
  from: number;
  location: string;
}) {
  const d = day.replace(/-/g, "");
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Gullwing Plumbing//Jobs//EN",
    "BEGIN:VEVENT",
    `UID:${ref}@gullwing.example`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${d}T${pad(from)}0000`,
    `DTEND:${d}T${pad(from + 2)}0000`,
    `SUMMARY:${title}`,
    `LOCATION:${location}`,
    "DESCRIPTION:Your plumber arrives inside this two-hour window and calls 20 minutes before.",
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

export function makeRef(prefix: string, seed: string) {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let h = hash(seed + Date.now());
  let out = "";
  for (let i = 0; i < 5; i++) {
    out += abc[h % abc.length];
    h = Math.floor(h / abc.length) || hash(out + i);
  }
  return `${prefix}-${out}`;
}

export const validPhone = (s: string) => /^(\+?61|0)[2-478]\d{8}$/.test(s.replace(/[\s()-]/g, ""));
