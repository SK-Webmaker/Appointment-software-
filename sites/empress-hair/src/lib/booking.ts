import { SITE } from "@/site.config";

export type BookingDetails = {
  name: string;
  style: string;
  length: string;
  days: readonly string[];
  note: string;
};

/** The DM they'll receive — written so they can quote and book straight from it. */
export function composeMessage(d: BookingDetails): string {
  const lines: string[] = [];
  const name = d.name.trim();
  lines.push(`Hi ${SITE.name}! ${name ? `It's ${name}. ` : ""}I'd love to book in 🤍`);

  const style = d.style.trim();
  if (style || d.length) {
    lines.push("");
    if (style) lines.push(`Style I'm after: ${style}`);
    if (d.length) lines.push(`My hair now: ${d.length.toLowerCase()} length`);
  }

  if (d.days.length) {
    lines.push("");
    lines.push(`Days that suit me: ${d.days.join(", ")}`);
  }

  if (d.note.trim()) {
    lines.push("");
    lines.push(d.note.trim());
  }

  lines.push("");
  lines.push("I'll send a photo of my hair as it is now and my inspo. Thank you!");
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
