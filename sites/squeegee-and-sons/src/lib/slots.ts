import { AREA, CLEANS, EXTRAS, FREQS, OPEN, PRICING, SITE, WINDOWS } from "@/site.config";

/**
 * The cleaning diary, simulated. Free arrival times and prices are derived
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

/** Arrival times still free on a day. */
export function freeWindows(day: string) {
  const hours = OPEN[parseDay(day).getDay()];
  if (!hours) return [];
  return WINDOWS.filter(
    (w) => w.from >= hours[0] && w.from + 2 <= hours[1] && hash(`${day}|${w.id}`) % 100 >= 30,
  );
}

/** The next `n` days, starting tomorrow. */
export function openDays(n = 10, now = new Date()) {
  const out: { iso: string; closed: boolean }[] = [];
  for (let i = 1; out.length < n && i < 21; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    out.push({ iso: isoDay(d), closed: !OPEN[d.getDay()] });
  }
  return out;
}

export const suburbOf = (postcode: string) => AREA[postcode.trim()];

/** "Out cleaning until 5 pm" */
export function openStatus(now = new Date()) {
  const h = OPEN[now.getDay()];
  const t = now.getHours() + now.getMinutes() / 60;
  const fmt = (x: number) => `${((x + 11) % 12) + 1} ${x < 12 ? "am" : "pm"}`;
  if (h && t >= h[0] && t < h[1]) return { open: true, text: `Out cleaning until ${fmt(h[1])}` };
  return { open: false, text: `Family cleaners since ${SITE.est}` };
}

export type QuoteInput = {
  bedrooms: number;
  bathrooms: number;
  clean: string;
  freq: string;
  extras: readonly string[];
};

/** Price per clean (before and after the regular discount), team and time. */
export function quote({ bedrooms, bathrooms, clean, freq, extras }: QuoteInput) {
  const c = CLEANS.find((x) => x.id === clean) ?? CLEANS[0]!;
  const f = c.id === "lease" ? FREQS[0]! : (FREQS.find((x) => x.id === freq) ?? FREQS[0]!);
  const ex = EXTRAS.filter((e) => extras.includes(e.id));
  const rooms = PRICING.base + bedrooms * PRICING.perBedroom + bathrooms * PRICING.perBathroom;
  const full = Math.round(
    rooms * c.k + (c.id === "lease" ? 60 : 0) + ex.reduce((a, e) => a + e.price, 0),
  );
  const price = Math.round(full * (1 - f.off));
  const mins =
    (PRICING.baseMins + bedrooms * PRICING.bedroomMins + bathrooms * PRICING.bathroomMins) * c.k +
    ex.reduce((a, e) => a + e.mins, 0);
  const team = mins > PRICING.pairOver ? 2 : 1;
  const hours = Math.max(1, Math.round((mins / team / 60) * 2) / 2);
  return { full, price, off: f.off, team, hours, freq: f };
}

/** "2½ hours" */
export const hoursLabel = (h: number) =>
  `${Math.floor(h)}${h % 1 ? "½" : ""} ${h === 1 ? "hour" : "hours"}`;

const hm = (h: number) => `${pad(Math.floor(h))}${pad(Math.round((h % 1) * 60))}`;

export function icsFor({
  ref,
  title,
  day,
  from,
  hours,
  location,
}: {
  ref: string;
  title: string;
  day: string;
  from: number;
  hours: number;
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
    "PRODID:-//Squeegee & Sons//Cleans//EN",
    "BEGIN:VEVENT",
    `UID:${ref}@squeegee.example`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${d}T${hm(from)}00`,
    `DTEND:${d}T${hm(from + hours)}00`,
    `SUMMARY:${title}`,
    `LOCATION:${location}`,
    "DESCRIPTION:We text when we arrive and when we lock up.",
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
