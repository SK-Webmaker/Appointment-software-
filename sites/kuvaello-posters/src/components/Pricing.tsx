import { ArrowRight, Mail } from "lucide-react";
import { ChapterLabel } from "./ChapterLabel";
import { MaskLines, Reveal } from "./Reveal";
import { FAQ, PRODUCTS, SITE } from "@/site.config";
import { useBooking } from "@/context/booking";

/** Chapter IV — their price list. Tap a product to put it in your order; their FAQ underneath. */
export function Pricing() {
  const { openSheet, product, setProduct } = useBooking();

  return (
    <section id="pricing" className="sheet bg-noir pb-24 pt-24 text-ivory md:pb-32 md:pt-36" aria-labelledby="pricing-title">
      <div className="glow-clip" aria-hidden="true">
        <div className="absolute -right-48 top-1/3 h-[700px] w-[700px] bg-[radial-gradient(closest-side,rgb(242_165_65/0.16),transparent)]" />
      </div>
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="pricing" light />
        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2 id="pricing-title" className="text-[clamp(48px,10vw,120px)] leading-[0.95]">
            <MaskLines lines={[<>Choose your</>, <em className="text-pearl">Kuvaello.</em>]} />
          </h2>
          <Reveal>
            <p className="max-w-[38ch] text-[16px] leading-[1.8] text-ivory/80 md:text-[17px]">
              Digital from {SITE.from}. Shipping to one address is included in the listed prices of standard printed posters.
            </p>
          </Reveal>
        </div>

        <ul className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 md:mt-20">
          {PRODUCTS.map((p, i) => {
            const on = product === p.name;
            return (
              <Reveal as="li" key={p.name} delay={i * 0.05}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setProduct(on ? "" : p.name)}
                  className={`flex h-full min-h-[190px] w-full flex-col justify-between rounded-[14px] border p-6 text-left transition-colors duration-300 ${on ? "border-silk bg-silk text-noir" : "border-ivory/15 bg-coal text-ivory hover:border-ivory/40"}`}
                >
                  <span className="block">
                    <span className={`block text-[11px] font-semibold uppercase tracking-[0.2em] ${on ? "text-noir" : "text-pearl"}`}>{p.tag || " "}</span>
                    <span className="mt-2 block font-display text-[28px] uppercase leading-none">{p.name}</span>
                    <span className={`mt-3 block text-[14px] leading-snug ${on ? "text-noir/80" : "text-ivory/75"}`}>{p.detail}</span>
                  </span>
                  <span className="mt-6 flex items-baseline justify-between">
                    <span className="font-display text-[40px] leading-none">{p.price}</span>
                    <span className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${on ? "text-noir" : "text-ivory/70"}`}>{on ? "Chosen ✓" : "Choose"}</span>
                  </span>
                </button>
              </Reveal>
            );
          })}
        </ul>

        <Reveal className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <button onClick={openSheet} className="btn-honey sheen">
            {product ? `Create my ${product}` : "Create yours"} <ArrowRight size={16} strokeWidth={1.8} />
          </button>
          <a href={`mailto:${SITE.email}?subject=${encodeURIComponent("Kuvaello for a team")}`} className="btn-ghost-light">
            <Mail size={16} strokeWidth={1.7} /> Ask about team packages
          </a>
        </Reveal>

        <div className="mt-20 grid gap-x-12 border-t border-ivory/10 pt-12 md:mt-28 lg:grid-cols-[0.8fr_1.2fr]">
          <h3 className="text-[clamp(32px,4.4vw,52px)] leading-[1]">Before you order</h3>
          <div className="mt-6 lg:mt-0">
            {FAQ.map((f) => (
              <details key={f.q} className="group border-b border-ivory/10 py-4">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-semibold text-ivory">
                  {f.q}
                  <span className="text-[22px] text-pearl transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-ivory/75">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
