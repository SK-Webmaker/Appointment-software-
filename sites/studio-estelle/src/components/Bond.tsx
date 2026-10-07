import { Instagram } from "lucide-react";
import { ChapterLabel } from "./ChapterLabel";
import { MaskLines, Reveal, ScrollWords } from "./Reveal";
import { BOND, SITE } from "@/site.config";

/** Chapter IV — her "what is a bond" carousel, on the mint of her bond posts. */
export function Bond() {
  return (
    <section id="bond" className="sheet bg-mint [--sheet-prev:var(--color-candy)] pb-24 pt-24 md:pb-32 md:pt-36" aria-labelledby="bond-title">
      <div className="glow-clip" aria-hidden="true">
        <div className="absolute -right-56 -top-24 h-[640px] w-[640px] bg-[radial-gradient(closest-side,rgb(255_253_252/0.85),transparent)]" />
      </div>
      <div className="relative mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="bond" />
        <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-20">
          <h2 id="bond-title" className="max-w-[15ch] text-[clamp(36px,8.4vw,88px)] leading-[1.02] text-ink">
            <MaskLines lines={[<>What is a bond</>, <em className="text-rose">and why do I</em>, <em className="text-rose">ask for one?</em>]} />
          </h2>
          <div className="lg:pt-3">
            <ScrollWords className="max-w-[18ch] font-display text-[clamp(28px,4.6vw,50px)] leading-[1.14] text-ink" text="“A bond is a safety net, not a test.”" />
            <Reveal>
              <p className="mt-6 max-w-[46ch] text-[16.5px] leading-[1.8] text-ash">
                The vast majority of bonds are returned in full, every time. It exists to protect the pieces in my collection so I can keep them beautiful for the next person to wear, not to catch people out.
              </p>
            </Reveal>
          </div>
        </div>

        <ol className="mt-16 grid gap-4 sm:grid-cols-2 md:mt-24 lg:grid-cols-4">
          {BOND.map((b, i) => (
            <Reveal as="li" key={b.title} delay={i * 0.06} className="flex flex-col rounded-[28px] bg-card p-7 shadow-[0_24px_50px_-34px_rgba(46,29,20,0.35)] md:p-8">
              <span className="font-display text-[40px] italic leading-none text-rose">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-5 font-script text-[34px] leading-[1.15] tracking-normal text-ink">{b.title}</h3>
              <p className="mt-3 text-[15px] leading-[1.75] text-ash">{b.text}</p>
            </Reveal>
          ))}
        </ol>

        <Reveal className="mt-14 flex flex-col items-start gap-6 rounded-[28px] border border-ink/10 bg-ivory p-7 md:flex-row md:items-center md:justify-between md:gap-10 md:p-10">
          <p className="max-w-[44ch] font-display text-[21px] leading-snug text-ink md:text-[25px]">
            Got a bond question specific to your booking? <em className="text-rose">Send me a message,</em> I am always happy to walk you through it.
          </p>
          <a href={SITE.instagramDm} target="_blank" rel="noreferrer" className="btn-primary sheen shrink-0">
            <Instagram size={17} strokeWidth={1.7} /> Message {SITE.founder}
          </a>
        </Reveal>
      </div>
    </section>
  );
}
