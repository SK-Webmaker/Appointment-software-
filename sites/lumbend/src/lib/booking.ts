import { GASES, SHAPES, SITE, price } from "@/site.config";

export type OrderDetails = {
  shape: string;
  gas: string;
  words: string;
  name: string;
  contact: string;
};

/** The pre-order, written out in full from what the visitor picked. */
export function composeOrder(d: OrderDetails): string {
  const s = SHAPES.find((x) => x.name === d.shape);
  const g = GASES.find((x) => x.symbol === d.gas);
  const lines: string[] = [`Hi ${SITE.name} — I'd like to pre-order a ${SITE.product}.`];
  const details = [
    s && `Shape: ${s.name} (${price(s.price)})`,
    s?.name === "Word" && d.words.trim() && `My word: "${d.words.trim()}"`,
    g && `Light: ${g.name} (${g.glow})`,
    d.name.trim() && `Name: ${d.name.trim()}`,
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
