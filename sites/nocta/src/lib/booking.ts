import { GASES, SITE } from "@/site.config";

export type BriefDetails = {
  offer: string;
  words: string;
  gas: string;
  place: string;
  name: string;
  contact: string;
};

/** The commission brief, written out in full from what the visitor picked. */
export function composeBrief(d: BriefDetails): string {
  const g = GASES.find((x) => x.symbol === d.gas);
  const lines: string[] = [`Hi ${SITE.name} — let's light something.`];
  const details = [
    d.offer && `Commission: ${d.offer}`,
    d.words.trim() && `The words: "${d.words.trim()}"`,
    g && `Light: ${g.name} (${g.glow})`,
    d.place.trim() && `Where it lives: ${d.place.trim()}`,
    d.name.trim() && `From: ${d.name.trim()}`,
    d.contact.trim() && `Reach me at: ${d.contact.trim()}`,
  ].filter(Boolean) as string[];
  if (details.length) {
    lines.push("");
    lines.push(...details);
  }
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
