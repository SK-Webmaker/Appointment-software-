import { SITE } from "@/site.config";

export type BookingDetails = {
  name: string;
  flavours: readonly string[];
  count: string;
  method: string;
  /** yyyy-mm-dd, from the date picker */
  date: string;
  occasion: string;
  note: string;
};

/** "2026-11-14" → "Sat 14 Nov 2026" (read as a calendar date, never shifted by time zone). */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return "";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** The DM they'll receive — written so they can quote and confirm straight from it. */
export function composeMessage(d: BookingDetails): string {
  const lines: string[] = [];
  const name = d.name.trim();
  lines.push(`Hi ${SITE.name}! ${name ? `It's ${name}. ` : ""}I'd love to order some dessert cups 🎀`);

  const date = formatDate(d.date);
  const occasion = d.occasion.trim();
  const count = d.count.trim();
  const details = [
    d.flavours.length > 0 && `Flavours: ${d.flavours.join(", ")}`,
    count && `How many cups: ${count}`,
    d.method && `Pickup or delivery: ${d.method}`,
    date && `For: ${date}`,
    occasion && `Occasion / theme: ${occasion}`,
  ].filter(Boolean) as string[];
  if (details.length) {
    lines.push("");
    lines.push(...details);
  }

  if (d.note.trim()) {
    lines.push("");
    lines.push(d.note.trim());
  }

  lines.push("");
  lines.push("Thank you! 💕");
  return lines.join("\n");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the textarea route */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
