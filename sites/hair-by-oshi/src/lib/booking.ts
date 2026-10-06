import { SERVICE_BY_ID, SITE, VIBES, type Service, type VibeId } from "@/site.config";

export type BookingDetails = {
  name: string;
  length: string;
  texture: string;
  history: string[];
  vibe: VibeId | null;
  days: readonly string[];
  note: string;
};

/** The DM she'll receive — written so she can quote and book straight from it. */
export function composeMessage(ids: string[], d: BookingDetails): string {
  const lines: string[] = [];
  const name = d.name.trim();
  lines.push(`Hi ${SITE.founder}! ${name ? `It's ${name}. ` : ""}I'd love to book in with you 💜`);

  const items = ids.map((id) => SERVICE_BY_ID[id]).filter((s): s is Service => s !== undefined);
  if (items.length) {
    lines.push("");
    lines.push(items.length > 1 ? "I'm interested in:" : `I'm interested in: ${items[0]?.name ?? ""}`);
    if (items.length > 1) for (const s of items) lines.push(`• ${s.name}`);
  }

  const hair = [d.length && `${d.length.toLowerCase()} length`, d.texture && `${d.texture.toLowerCase()} texture`].filter(Boolean).join(", ");
  if (hair || d.history.length) {
    lines.push("");
    if (hair) lines.push(`My hair: ${hair}`);
    if (d.history.length) lines.push(`Hair history: ${d.history.join(", ").toLowerCase()}`);
  }

  if (d.days.length) {
    lines.push("");
    lines.push(`Days that suit me: ${d.days.join(", ")}`);
  }

  const vibe = VIBES.find((v) => v.id === d.vibe);
  if (vibe) lines.push(`Appointment vibe: ${vibe.label.toLowerCase()}`);

  if (d.note.trim()) {
    lines.push("");
    lines.push(d.note.trim());
  }

  lines.push("");
  lines.push("I'll send a photo of my hair as it is now (and my inspo). Thank you!");
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
