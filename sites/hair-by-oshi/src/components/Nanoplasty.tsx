import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { Check, Plus } from "lucide-react";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Compare } from "./Compare";
import { MaskLines, Reveal } from "./Reveal";
import { NANO } from "@/site.config";
import { useBooking } from "@/context/booking";

/** Chapter III — her signature treatment, explained the way she explains it. */
export function Nanoplasty() {
  const { isSelected, toggle, openSheet } = useBooking();
  const added = isSelected("nanoplasty");

  return (
    <section id="nanoplasty" className="relative overflow-hidden bg-mist pb-24 pt-24 md:pb-36 md:pt-36" aria-labelledby="nano-title">
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="nanoplasty" />
        <div className="mt-8 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-20">
          <h2 id="nano-title" className="max-w-[15ch] text-[clamp(40px,8.6vw,96px)] font-light leading-[0.98] text-ink">
            <MaskLines lines={[<>Deep penetration.</>, <>Deep <em className="text-plum">transformation.</em></>]} />
          </h2>
          <Reveal>
            <p className="max-w-[44ch] text-[16.5px] leading-[1.8] text-mocha md:text-[17.5px]">{NANO.what}</p>
            <p className="mt-5 text-[12px] font-medium uppercase tracking-[0.22em] text-plum">Her most asked question — answered</p>
          </Reveal>
        </div>

        {/* Before / after and her words */}
        <div className="mt-16 grid items-center gap-12 md:mt-24 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <Reveal className="mx-auto w-full max-w-[420px]">
            <Compare />
          </Reveal>
          <Reveal delay={0.1}>
            <p className="font-display text-[clamp(28px,4.2vw,48px)] font-light leading-[1.15] text-ink">
              “An amazing result from Nanoplasty. I just can't get over how amazing this treatment is and how <em className="text-plum">healthy it makes your hair feel.</em>”
            </p>
            <p className="mt-6 max-w-[46ch] text-[15.5px] leading-[1.8] text-mocha">
              Oshi did a special training to learn more and gain more knowledge about the product — “knowledge is key 🔑”. Drag the handle to compare.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-plum/15 pt-8 sm:grid-cols-4">
              {[
                ["Less damage", "Gentle formula"],
                ["Long lasting", "4–6 months"],
                ["More shine", "Silky, smooth"],
                ["Safe & effective", "For most hair types"],
              ].map(([t, d]) => (
                <div key={t}>
                  <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-plum">{t}</p>
                  <p className="mt-1 text-[14.5px] text-mocha">{d}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        {/* Inside a strand */}
        <Layers />

        {/* The process */}
        <Steps />

        {/* How long it lasts */}
        <Timeline />

        {/* Aftercare */}
        <div className="mt-24 md:mt-32">
          <Reveal>
            <p className="eyebrow">Maintenance &amp; care</p>
            <h3 className="mt-4 max-w-[18ch] text-[clamp(32px,5vw,56px)] font-light leading-[1.04] text-ink">
              Simple care for long-lasting, <em className="text-plum">beautiful hair.</em>
            </h3>
          </Reveal>
          <ul className="mt-10 grid gap-px overflow-hidden rounded-[28px] bg-plum/10 sm:grid-cols-2 lg:grid-cols-3">
            {NANO.care.map((c, i) => (
              <Reveal as="li" key={c.title} delay={(i % 3) * 0.06} className="bg-card p-6 md:p-8">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-mist text-plum">
                  <Check size={17} strokeWidth={2} />
                </span>
                <p className="mt-4 font-display text-[22px] font-light leading-tight text-ink">{c.title}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-mocha">{c.text}</p>
              </Reveal>
            ))}
          </ul>
        </div>

        <Reveal className="mt-14 flex flex-col items-start gap-5 rounded-[28px] bg-plum p-7 text-cream sm:flex-row sm:items-center sm:justify-between md:p-10">
          <p className="max-w-[30ch] font-display text-[clamp(24px,3.4vw,34px)] font-light leading-[1.15]">
            Result: <em className="text-lavender">{NANO.result.toLowerCase()}</em>
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <button onClick={() => toggle("nanoplasty")} aria-pressed={added} className="btn-ghost-light px-5 tracking-[0.14em] sm:whitespace-nowrap sm:px-7 sm:tracking-[0.2em]">
              {added ? <Check size={16} strokeWidth={2} /> : <Plus size={16} strokeWidth={2} />} {added ? "Added to my request" : "Add to my request"}
            </button>
            <button onClick={openSheet} className="btn-honey sheen px-5 tracking-[0.14em] sm:whitespace-nowrap sm:px-7 sm:tracking-[0.2em]">
              Book Nanoplasty
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ------------------------------------------------------------- inside a strand

// Nano-particles, spread around the strand by the golden angle. Each one
// travels inwards to the layer it belongs to as you scroll.
const PARTICLES = Array.from({ length: 30 }, (_, i) => {
  const layer = i % 3; // 0 cuticle, 1 cortex, 2 medulla
  const angle = (i * 137.508 * Math.PI) / 180;
  return { i, layer, angle, end: [118, 78, 26][layer] ?? 26, size: 3.2 - layer * 0.5 };
});

function Layers() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "center 0.45"] });
  const glow = useTransform(scrollYProgress, [0.6, 1], [0, 1]);

  return (
    <div ref={ref} className="mt-24 grid items-center gap-12 md:mt-36 lg:grid-cols-2 lg:gap-20">
      <div className="relative mx-auto aspect-square w-full max-w-[460px]" aria-hidden="true" data-qa="layered">
        <svg viewBox="-240 -240 480 480" className="h-full w-full overflow-visible">
          <defs>
            <radialGradient id="nano-core" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="scale(150)">
              <stop offset="0" stopColor="#3B1F57" />
              <stop offset="0.35" stopColor="#5A3A2C" />
              <stop offset="0.7" stopColor="#7A5238" />
              <stop offset="1" stopColor="#4A2E22" />
            </radialGradient>
          </defs>
          <circle r="150" fill="url(#nano-core)" />
          <circle r="150" fill="none" stroke="#22161F" strokeOpacity="0.35" strokeWidth="10" strokeDasharray="3 7" />
          <circle r="100" fill="none" stroke="#FAF6F0" strokeOpacity="0.28" strokeWidth="1.2" />
          <circle r="46" fill="#2A1730" stroke="#FAF6F0" strokeOpacity="0.35" strokeWidth="1.2" />
          <motion.circle r="160" fill="none" stroke="#B8A2D9" strokeWidth="2" style={{ opacity: reduce ? 1 : glow }} />
          {PARTICLES.map((p) => (
            <Particle key={p.i} {...p} progress={scrollYProgress} reduce={reduce} />
          ))}
        </svg>
      </div>

      <div>
        <Reveal>
          <p className="eyebrow">Inside every layer of the hair</p>
          <h3 className="mt-4 max-w-[16ch] text-[clamp(32px,5vw,56px)] font-light leading-[1.04] text-ink">
            Science that goes deep. <em className="text-plum">Beauty that lasts.</em>
          </h3>
        </Reveal>
        <ol className="mt-10 space-y-7">
          {NANO.layers.map((l, i) => (
            <Reveal as="li" key={l.name} delay={i * 0.08} className="flex gap-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-plum font-display text-[16px] text-cream">{i + 1}</span>
              <span>
                <span className="block text-[13px] font-medium uppercase tracking-[0.2em] text-plum">
                  {l.name} <span className="text-mocha">· {l.where}</span>
                </span>
                <span className="mt-1.5 block max-w-[40ch] text-[16px] leading-relaxed text-ink/85">{l.text}</span>
              </span>
            </Reveal>
          ))}
        </ol>
        <Reveal delay={0.2}>
          <p className="mt-9 max-w-[44ch] border-l-2 border-lavender pl-5 text-[15px] leading-relaxed text-mocha">
            Regular treatment molecules are larger, so they stay on the surface and fade faster. Nano-sized collagen, amino acids and proteins reach the cortex for repair from the inside out.
          </p>
        </Reveal>
      </div>
    </div>
  );
}

function Particle({
  layer,
  angle,
  end,
  size,
  progress,
  reduce,
}: {
  layer: number;
  angle: number;
  end: number;
  size: number;
  progress: MotionValue<number>;
  reduce: boolean;
}) {
  const from = 230;
  const t0 = 0.05 + layer * 0.18;
  const r = useTransform(progress, [t0, t0 + 0.45], [from, end], { clamp: true });
  const cx = useTransform(r, (v) => Math.cos(angle) * v);
  const cy = useTransform(r, (v) => Math.sin(angle) * v);
  const opacity = useTransform(progress, [t0 - 0.05, t0 + 0.05], [0, 1]);
  const color = layer === 0 ? "#B8A2D9" : layer === 1 ? "#CDB9EA" : "#E9DDFB";
  return reduce ? (
    <circle cx={Math.cos(angle) * end} cy={Math.sin(angle) * end} r={size} fill={color} />
  ) : (
    <motion.circle cx={cx} cy={cy} r={size} fill={color} style={{ opacity }} />
  );
}

// ------------------------------------------------------------------ steps

function Steps() {
  const ref = useRef<HTMLOListElement>(null);
  const reduce = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.8", "end 0.55"] });
  return (
    <div className="mt-24 md:mt-36">
      <Reveal>
        <p className="eyebrow">The treatment, step by step</p>
        <h3 className="mt-4 max-w-[18ch] text-[clamp(32px,5vw,56px)] font-light leading-[1.04] text-ink">
          Wash. Blow dry. <em className="text-plum">Seal.</em>
        </h3>
      </Reveal>
      <ol ref={ref} className="relative mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
        <span className="absolute left-5 top-5 hidden h-px w-[calc(100%-2.5rem)] bg-plum/15 md:block" aria-hidden="true">
          <motion.span className="absolute inset-0 origin-left bg-plum" style={{ scaleX: reduce ? 1 : scrollYProgress }} />
        </span>
        <span className="absolute bottom-0 left-5 top-5 w-px bg-plum/15 md:hidden" aria-hidden="true">
          <motion.span className="absolute inset-0 origin-top bg-plum" style={{ scaleY: reduce ? 1 : scrollYProgress }} />
        </span>
        {NANO.steps.map((s, i) => (
          <Reveal as="li" key={s.n} delay={i * 0.1} className="relative pl-16 md:pl-0">
            <span className="absolute left-0 top-0 grid h-10 w-10 place-items-center rounded-full border border-plum/30 bg-mist font-display text-[15px] italic text-plum md:relative">
              {s.n}
            </span>
            <p className="font-display text-[28px] font-light leading-tight text-ink md:mt-6">{s.name}</p>
            <p className="mt-2 max-w-[34ch] text-[15.5px] leading-relaxed text-mocha">{s.text}</p>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}

// --------------------------------------------------------------- timeline

function Timeline() {
  const ref = useRef<HTMLOListElement>(null);
  const reduce = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.6"] });
  return (
    <div className="mt-24 rounded-[32px] bg-night px-6 py-12 text-cream md:mt-32 md:px-12 md:py-16">
      <Reveal>
        <p className="text-[11.5px] font-medium uppercase tracking-label text-honey">Lasts 4–6 months</p>
        <h3 className="mt-4 max-w-[20ch] text-[clamp(30px,4.6vw,52px)] font-light leading-[1.05]">
          Results that fade gently, <em className="text-lavender">never harshly.</em>
        </h3>
      </Reveal>
      <ol ref={ref} className="relative mt-12 grid gap-8 md:grid-cols-5 md:gap-4">
        <span className="absolute left-[7px] top-2 hidden h-px w-[calc(100%-14px)] bg-cream/15 md:block" aria-hidden="true">
          <motion.span className="absolute inset-0 origin-left bg-gradient-to-r from-lavender to-honey" style={{ scaleX: reduce ? 1 : scrollYProgress }} />
        </span>
        <span className="absolute bottom-2 left-[7px] top-2 w-px bg-cream/15 md:hidden" aria-hidden="true">
          <motion.span className="absolute inset-0 origin-top bg-gradient-to-b from-lavender to-honey" style={{ scaleY: reduce ? 1 : scrollYProgress }} />
        </span>
        {NANO.timeline.map((t, i) => (
          <Reveal as="li" key={t.when} delay={i * 0.07} className="relative pl-9 md:pl-0">
            <span className={`absolute left-0 top-0.5 h-[15px] w-[15px] rounded-full border-2 md:relative md:block ${i === NANO.timeline.length - 1 ? "border-honey bg-honey" : "border-lavender bg-night"}`} />
            <p className="font-display text-[24px] font-light leading-tight md:mt-5">{t.when}</p>
            <p className="mt-1.5 max-w-[24ch] text-[14.5px] leading-relaxed text-cream/75">{t.text}</p>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}
