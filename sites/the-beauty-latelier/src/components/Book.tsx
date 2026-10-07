import { motion, useScroll, useTransform } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { ArrowRight, Instagram, Mail, MapPin, Phone } from "lucide-react";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { RoundBadge } from "./RoundBadge";
import { SITE } from "@/site.config";
import { useBooking } from "@/context/booking";
import { telHref } from "@/lib/booking";

const STEPS = [
  { n: "1", t: "Choose", d: "Add services from the menu — or simply tell Helena what you're after." },
  { n: "2", t: "Send", d: "Your request goes to Helena by Instagram DM, text or email." },
  { n: "3", t: "Confirm", d: "Helena replies to lock in your day, time and quote." },
];

/** Chapter VI — the call to action, set like her price list: an ivory arch on champagne satin. */
export function Book() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotionSafe();
  const { openSheet, selected } = useBooking();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);
  // The arch rises into place (a translate, so it can glide on the GPU without softening the text).
  const archY = useTransform(scrollYProgress, [0, 0.4], [80, 0]);

  return (
    <section id="book" ref={ref} className="relative overflow-hidden bg-champagne pb-24 pt-24 md:pb-32 md:pt-32" aria-labelledby="book-title">
      <motion.div className="absolute inset-0 -top-[10%] h-[120%] will-change-transform" style={{ y: reduce ? "0%" : bgY }} aria-hidden="true">
        <Img name="satin" widths={[480, 800, 1200, 1600]} sizes="(max-width:767px) 200vw, 100vw" alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-champagne/25" />
      </motion.div>

      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="book" ink className="justify-center" />

        <motion.div style={{ y: reduce ? 0 : archY }} className="relative mx-auto mt-10 max-w-[760px] will-change-transform">
          <div className="arch relative bg-card px-6 pb-12 pt-28 text-center shadow-[0_40px_90px_-40px_rgba(36,26,20,0.55)] sm:px-14 sm:pt-36 md:pb-16">
            <div className="absolute left-1/2 top-6 -translate-x-1/2 sm:top-9">
              <RoundBadge size={92} />
            </div>
            <p className="eyebrow">
              Re-opening <span className="sm:hidden">{SITE.reopeningShort}</span>
              <span className="hidden sm:inline">{SITE.reopening}</span>
            </p>
            <h2 id="book-title" className="mx-auto mt-5 max-w-[14ch] text-[clamp(40px,9vw,84px)] leading-[0.98] text-espresso">
              <MaskLines lines={[<>Take a moment</>, <em className="text-bronze">for yourself.</em>]} />
            </h2>
            <Reveal>
              <p className="mx-auto mt-6 max-w-[40ch] text-[16px] leading-[1.75] text-mocha">
                Bookings are by message. Send Helena your request now to secure your place as the atelier re-opens in {SITE.suburb}.
              </p>
            </Reveal>

            <Reveal delay={0.08} className="mt-9 flex flex-col items-center gap-4">
              <button onClick={openSheet} className="btn-primary sheen w-full max-w-[360px] px-5 tracking-[0.16em]">
                {selected.length ? `Request ${selected.length} service${selected.length > 1 ? "s" : ""}` : "Book your appointment"} <ArrowRight size={16} strokeWidth={1.8} />
              </button>
              <div className="grid w-full max-w-[360px] grid-cols-3 gap-2">
                <a href={SITE.instagramDm} target="_blank" rel="noreferrer" className="flex min-h-[60px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-espresso/15 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-espresso transition-colors hover:border-espresso hover:bg-espresso hover:text-cream">
                  <Instagram size={18} strokeWidth={1.6} /> DM
                </a>
                <a href={telHref} className="flex min-h-[60px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-espresso/15 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-espresso transition-colors hover:border-espresso hover:bg-espresso hover:text-cream">
                  <Phone size={18} strokeWidth={1.6} /> Call
                </a>
                <a href={`mailto:${SITE.email}`} className="flex min-h-[60px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-espresso/15 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-espresso transition-colors hover:border-espresso hover:bg-espresso hover:text-cream">
                  <Mail size={18} strokeWidth={1.6} /> Email
                </a>
              </div>
            </Reveal>

            <ol className="mx-auto mt-12 grid max-w-[600px] gap-6 border-t border-espresso/15 pt-10 text-left sm:grid-cols-3 sm:gap-5">
              {STEPS.map((s, i) => (
                <Reveal as="li" key={s.n} delay={0.06 * i} className="flex gap-4 sm:block">
                  <span className="font-display text-[34px] italic leading-none text-bronze">{s.n}</span>
                  <span className="block">
                    <span className="block text-[11.5px] font-semibold uppercase tracking-[0.2em] text-espresso sm:mt-3">{s.t}</span>
                    <span className="mt-1.5 block text-[14px] leading-relaxed text-mocha">{s.d}</span>
                  </span>
                </Reveal>
              ))}
            </ol>

            <address className="mt-12 flex flex-col items-center gap-2 text-[13px] not-italic tracking-[0.04em] text-mocha">
              <span className="flex items-center gap-2">
                <MapPin size={15} strokeWidth={1.6} className="text-bronze" /> {SITE.studio} · {SITE.suburb}, {SITE.city} {SITE.state}
              </span>
              <span>
                <a href={telHref} className="inline-block py-3 underline decoration-bronze/40 underline-offset-4 hover:text-espresso">{SITE.phoneDisplay}</a>
                {"  ·  "}
                <a href={`mailto:${SITE.email}`} className="inline-block py-3 underline decoration-bronze/40 underline-offset-4 hover:text-espresso">{SITE.email}</a>
              </span>
            </address>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
