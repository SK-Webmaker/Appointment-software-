import { SITE } from "@/site.config";

export type BookingDetails = {
  name: string;
  occasion: string;
  /** yyyy-mm-dd, from the date picker */
  date: string;
  look: string;
  size: string;
  piece: string;
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

/** The message she'll receive — written so she can check the rail and book the try-on straight from it. */
export function composeMessage(d: BookingDetails): string {
  const lines: string[] = [];
  const name = d.name.trim();
  lines.push(`Hi ${SITE.founder}! ${name ? `It's ${name}. ` : ""}I'd love to book a try on 🩷`);

  const date = formatDate(d.date);
  const piece = d.piece.trim();
  const details = [
    d.occasion && `Event: ${d.occasion}`,
    date && `Date: ${date}`,
    d.look && `Look: ${d.look}`,
    d.size && `Size: ${d.size}`,
    piece && `A piece I've seen: ${piece}`,
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
  lines.push("Thank you!");
  return lines.join("\n");
}

/** The same message as an email, for anyone who'd rather not use Instagram. */
export function mailtoHref(message: string): string {
  return `mailto:${SITE.email}?subject=${encodeURIComponent(`Try-on request — ${SITE.name}`)}&body=${encodeURIComponent(message)}`;
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
