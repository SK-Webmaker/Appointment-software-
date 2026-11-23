import { AREA, EXTRAS, OPEN, SITE, STYLES, WINDOWS, projectOf, styleOf } from "@/site.config";

/**
 * The visit diary, simulated. Free visit times and estimates are derived
 * from the date and the inputs (never random), so the page behaves like the
 * real thing without a server. Swap these for calls to a real diary to go
 * live.
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

/** Visit start times still free on a day (today's must be at least 3 hours out). */
export function freeWindows(day: string, now = new Date()) {
  const hours = OPEN[parseDay(day).getDay()];
  if (!hours) return [];
  const today = day === isoDay(now);
  const t = now.getHours() + now.getMinutes() / 60;
  return WINDOWS.filter(
    (w) =>
      w.from >= hours[0] &&
      w.from + 0.75 <= hours[1] &&
      (!today || w.from >= t + 3) &&
      hash(`${day}|${w.id}`) % 100 >= 35,
  );
}

/** The next `n` days, starting tomorrow (site visits need a day's notice). */
export function openDays(n = 10, now = new Date()) {
  const out: { iso: string; closed: boolean }[] = [];
  for (let i = 1; out.length < n && i < 21; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    out.push({ iso: isoDay(d), closed: !OPEN[d.getDay()] });
  }
  return out;
}

export const suburbOf = (postcode: string) => AREA[postcode.trim()];

/** "Out in a garden · back at 4 pm" */
export function openStatus(now = new Date()) {
  const h = OPEN[now.getDay()];
  const t = now.getHours() + now.getMinutes() / 60;
  const fmt = (x: number) => (x === 12 ? "noon" : `${((x + 11) % 12) + 1} ${x < 12 ? "am" : "pm"}`);
  if (h && t >= h[0] && t < h[1]) return { open: true, text: `Out in gardens until ${fmt(h[1])}` };
  return { open: false, text: `${SITE.role} since ${SITE.est}` };
}

/** A price range, plant count and days on site for a garden. */
export function estimate({
  m2,
  project,
  style,
  extras,
}: {
  m2: number;
  project: string;
  style: string;
  extras: readonly string[];
}) {
  const p = projectOf(project);
  const s = styleOf(style) ?? STYLES[0]!;
  if (!p) return null;
  const round = (n: number, to = 50) => Math.round(n / to) * to;
  if (p.id === "care") {
    const lo = Math.max(160, round(m2 * p.rate[0], 10));
    const hi = Math.max(260, round(m2 * p.rate[1], 10));
    return { from: lo, to: hi, plants: 0, days: 1, perVisit: true };
  }
  const extra = EXTRAS.filter((e) => extras.includes(e.id)).reduce((a, e) => a + e.perM2, 0);
  const from = round(m2 * (p.rate[0] * s.k + extra), 100);
  const to = round(m2 * (p.rate[1] * s.k + extra), 100);
  const plants = Math.round(m2 * p.cover * s.density);
  const days = Math.max(1, Math.ceil(m2 / p.perDay));
  return { from, to, plants, days, perVisit: false };
}

const hm = (h: number) => `${pad(Math.floor(h))}${pad(Math.round((h % 1) * 60))}`;

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
    "PRODID:-//Saltbush Landscapes//Visits//EN",
    "BEGIN:VEVENT",
    `UID:${ref}@saltbush.example`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${d}T${hm(from)}00`,
    `DTEND:${d}T${hm(from + 0.75)}00`,
    `SUMMARY:${title}`,
    `LOCATION:${location}`,
    "DESCRIPTION:A 45-minute walk around the garden. Have a think about what you love and what you'd lose.",
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
