import { SITE } from "@/site.config";

export type BookingDetails = {
  product: string;
  price: string;
  name: string;
  number: string;
  sport: string;
  request: string;
  contact: string;
};

/** The order message Kuvaello receives — everything their own order form asks for. */
export function composeMessage(d: BookingDetails): string {
  const lines: string[] = [];
  lines.push(`Hi ${SITE.name}! I'd like to create a Kuvaello 🖼️`);
  const details = [
    d.product && `Product: ${d.product}${d.price ? ` (${d.price})` : ""}`,
    d.name.trim() && `Name on the poster: ${d.name.trim()}`,
    d.number.trim() && `Number: ${d.number.trim()}`,
    d.sport.trim() && `Sport: ${d.sport.trim()}`,
    d.request.trim() && `Team, colours or request: ${d.request.trim()}`,
  ].filter(Boolean) as string[];
  if (details.length) {
    lines.push("");
    lines.push(...details);
  }
  if (d.contact.trim()) {
    lines.push("");
    lines.push(`You can reach me at: ${d.contact.trim()}`);
  }
  lines.push("");
  lines.push("I'll attach my photo. Thank you!");
  return lines.join("\n");
}

/** The same message as an email to their inbox. */
export function mailtoHref(message: string): string {
  return `mailto:${SITE.email}?subject=${encodeURIComponent(`Kuvaello order`)}&body=${encodeURIComponent(message)}`;
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
