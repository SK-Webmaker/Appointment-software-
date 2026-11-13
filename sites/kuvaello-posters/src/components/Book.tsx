import { motion, useScroll, useTransform } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { ArrowRight, ArrowUpRight, Instagram, Mail } from "lucide-react";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Wordmark } from "./Logo";
import { MaskLines, Reveal } from "./Reveal";
import { PRODUCTS, SITE } from "@/site.config";
import { useBooking } from "@/context/booking";

const STEPS = [
  { n: "01", t: "Choose", d: "Digital, A3, DUO or the Complete Collection." },
  { n: "02", t: "Send", d: "Your order message is written for you — send it with your photo." },
  { n: "03", t: "Get it", d: "Digital designs are typically ready in 1–3 business days." },
];

/** Chapter V — the call to action: a poster frame rising out of the dark. */
export function Book() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotionSafe();
  const { openSheet, started, product, setProduct } = useBooking();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  // The frame rises into place (a translate, so it can glide on the GPU without softening the text).
  const cardY = useTransform(scrollYProgress, [0, 0.4], [80, 0]);
  const glowY = useTransform(scrollYProgress, [0, 1], ["-20%", "20%"]);

  return (
    <section id="order" ref={ref} className="sheet bg-coal pb-24 pt-24 md:pb-32 md:pt-32" aria-labelledby="order-title">
      <div className="glow-clip" aria-hidden="true">
        <motion.div className="absolute left-1/2 top-0 h-[1100px] w-[1100px] -translate-x-1/2 will-change-transform bg-[radial-gradient(closest-side,rgb(242_165_65/0.26),transparent)]" style={{ y: reduce ? "0%" : glowY }} />
      </div>

      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="order" light className="justify-center" />

        <motion.div style={{ y: reduce ? 0 : cardY }} className="relative mx-auto mt-10 max-w-[780px] will-change-transform">
          <div className="rounded-[14px] border-[10px] border-noir bg-ivory px-6 pb-12 pt-14 text-center shadow-[0_40px_90px_-40px_rgba(0,0,0,0.9)] sm:px-14 sm:pt-16 md:pb-16">
            <Wordmark size={56} />
            <h2 id="order-title" className="mx-auto mt-8 max-w-[14ch] text-[clamp(44px,9.4vw,92px)] leading-[0.95] text-ink">
              <MaskLines lines={[<>Create your</>, <em className="text-rose">Kuvaello.</em>]} />
            </h2>
            <Reveal>
              <p className="mx-auto mt-6 max-w-[42ch] text-[16px] leading-[1.75] text-ash">
                Send a photo. We take care of the rest. Choose a product, add one photo and the basic details — no unnecessary questions.
              </p>
            </Reveal>

            <Reveal delay={0.06} className="mx-auto mt-10 max-w-[600px] text-left">
              <fieldset>
                <legend className="text-[12px] font-semibold uppercase tracking-[0.22em] text-ink">Choose a product</legend>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {PRODUCTS.slice(0, 3).map((p) => {
                    const on = product === p.name;
                    return (
                      <button
                        key={p.name}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setProduct(on ? "" : p.name)}
                        className={`flex min-h-[56px] items-center justify-between gap-2 rounded-[10px] border px-4 text-[13.5px] font-semibold uppercase tracking-[0.1em] transition-colors duration-300 ${
                          on ? "border-onyx bg-onyx text-ivory" : "border-ink/20 bg-card text-ink hover:border-onyx"
                        }`}
                      >
                        {p.name} <span className={on ? "text-pearl" : "text-rose"}>{p.price}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[13px] text-ash">More in the price list above · not sure yet? Leave it blank.</p>
              </fieldset>
            </Reveal>

            <Reveal delay={0.1} className="mt-10 flex flex-col items-center gap-3">
              <button onClick={openSheet} className="btn-primary sheen w-full max-w-[380px] px-5 tracking-[0.16em]">
                {started ? "Write my order" : "Create yours"} <ArrowRight size={16} strokeWidth={1.8} />
              </button>
              <div className="flex flex-wrap items-center justify-center gap-x-6">
                <a href={SITE.shopUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-onyx underline decoration-onyx/30 underline-offset-4 hover:decoration-onyx">
                  <ArrowUpRight size={16} strokeWidth={1.8} /> Order &amp; pay online
                </a>
                <a href={SITE.instagramDm} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-onyx underline decoration-onyx/30 underline-offset-4 hover:decoration-onyx">
                  <Instagram size={16} strokeWidth={1.7} /> DM us
                </a>
              </div>
            </Reveal>

            <ol className="mx-auto mt-12 grid max-w-[620px] gap-6 border-t border-ink/10 pt-10 text-left sm:grid-cols-3 sm:gap-5">
              {STEPS.map((s, i) => (
                <Reveal as="li" key={s.n} delay={0.06 * i} className="flex gap-4 sm:block">
                  <span className="font-display text-[36px] leading-none text-rose">{s.n}</span>
                  <span className="block">
                    <span className="block text-[12px] font-semibold uppercase tracking-[0.2em] text-ink sm:mt-3">{s.t}</span>
                    <span className="mt-1.5 block text-[14.5px] leading-relaxed text-ash">{s.d}</span>
                  </span>
                </Reveal>
              ))}
            </ol>

            <p className="mt-12 flex items-center justify-center gap-2 text-[14px] text-ash">
              <Mail size={15} strokeWidth={1.6} className="text-rose" /> {SITE.email}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
