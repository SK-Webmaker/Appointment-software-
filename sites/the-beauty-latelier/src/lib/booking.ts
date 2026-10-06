import { SITE } from "@/site.config";
import { SERVICE_BY_ID, formatPrice, type Service } from "@/site.config";

export type BookingDetails = {
  name: string;
  when: string;
  note: string;
};

export function estimate(ids: string[]) {
  let total = 0;
  let open = false; // any "from" price or price-on-enquiry makes the total a starting point
  for (const id of ids) {
    const s = SERVICE_BY_ID[id];
    if (!s) continue;
    if (s.price === null) open = true;
    else total += s.price;
    if (s.from) open = true;
  }
  return { total, open };
}

export function composeMessage(ids: string[], d: BookingDetails): string {
  const lines: string[] = [];
  lines.push(`Hi ${SITE.founder}! ${d.name.trim() ? `It's ${d.name.trim()}. ` : ""}I'd love to book an appointment at the atelier 🤎`);
  const items = ids.map((id) => SERVICE_BY_ID[id]).filter((s): s is Service => s !== undefined);
  if (items.length) {
    lines.push("");
    lines.push("I'm after:");
    for (const s of items) lines.push(`• ${s.name} (${s.price === null ? "price on enquiry" : formatPrice(s)})`);
    const { total, open } = estimate(ids);
    if (total > 0) lines.push(`Estimated ${open ? "from " : ""}$${total}`);
  }
  if (d.when.trim()) {
    lines.push("");
    lines.push(`Best days / times for me: ${d.when.trim()}`);
  }
  if (d.note.trim()) {
    lines.push("");
    lines.push(d.note.trim());
  }
  lines.push("");
  lines.push("Thank you!");
  return lines.join("\n");
}

function isApple() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) && "ontouchend" in document;
}

export function smsHref(body: string) {
  // iOS reads the body after "&", Android after "?".
  return `sms:${SITE.phoneE164}${isApple() ? "&" : "?"}body=${encodeURIComponent(body)}`;
}

export function mailHref(body: string) {
  const subject = "Booking enquiry — The Beauty L'atelier";
  return `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const telHref = `tel:${SITE.phoneE164}`;

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
