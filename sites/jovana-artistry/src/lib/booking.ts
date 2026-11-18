import { SITE } from "@/site.config";

export type BookingDetails = {
  service: string;
  price?: number | undefined;
  mode: "studio" | "mobile" | "";
  when: string;
  name: string;
  notes: string;
  contact: string;
};

/** The booking message Jovana receives by DM — what she needs to confirm a spot. */
export function composeMessage(d: BookingDetails): string {
  const lines: string[] = [`Hi ${SITE.shortName}! I'd love to book with you 🤍`];
  const details = [
    d.service && `Service: ${d.service}${d.price ? ` ($${d.price})` : ""}`,
    d.mode && `Where: ${d.mode === "studio" ? `In studio (${SITE.area})` : "Mobile — at my place"}`,
    d.when.trim() && `Date / occasion: ${d.when.trim()}`,
    d.name.trim() && `Name: ${d.name.trim()}`,
    d.notes.trim() && `Notes: ${d.notes.trim()}`,
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
  lines.push("Thank you!");
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
