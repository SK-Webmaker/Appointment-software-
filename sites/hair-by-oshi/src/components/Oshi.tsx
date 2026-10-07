import { motion, useScroll, useTransform } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/motion";
import { useRef } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { Heart } from "./Logo";
import { MaskLines, Reveal } from "./Reveal";
import { SITE, STORY } from "@/site.config";

/** Chapter I — the girl behind the chair. */
export function Oshi() {
  const collage = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({ target: collage, offset: ["start end", "end start"] });
  const yMain = useTransform(scrollYProgress, [0, 1], ["-5%", "5%"]);
  const yPortrait = useTransform(scrollYProgress, [0, 1], [90, -70]);
  const yMirror = useTransform(scrollYProgress, [0, 1], [40, -110]);

  return (
    <section id="oshi" className="relative overflow-hidden bg-cream pb-24 pt-24 md:pb-36 md:pt-36" aria-labelledby="oshi-title">
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="oshi" />

        <div className="mt-10 grid items-center gap-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
          {/* Collage */}
          <div ref={collage} className="relative mx-auto w-full max-w-[640px] pb-24 sm:pb-16" data-qa="layered">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-sand shadow-[0_40px_80px_-40px_rgba(34,22,31,0.55)]">
              <motion.div className="absolute inset-x-0 -top-[6%] h-[112%] will-change-transform" style={{ y: reduce ? "0%" : yMain }}>
                <Img
                  name="oshi-coat"
                  widths={[480, 840]}
                  sizes="(min-width:1024px) 640px, 92vw"
                  alt="Oshi’s mirror selfie in a long black coat and white top, framed by an arched mirror"
                  className="h-full w-full object-cover"
                  style={{ objectPosition: "50% 45%" }}
                />
              </motion.div>
            </div>
            <motion.figure
              className="absolute -bottom-2 right-3 w-[34%] will-change-transform max-w-[190px] overflow-hidden rounded-full border-[6px] border-cream bg-card shadow-[0_30px_60px_-30px_rgba(34,22,31,0.55)] sm:right-6"
              style={{ y: reduce ? 0 : yPortrait }}
            >
              <Img name="oshi-portrait" widths={[440]} sizes="190px" alt="Portrait of Oshi Dias, honey-blonde ribbons in her dark hair, wrapped in a cream knit" className="aspect-[9/16] w-full object-cover" style={{ objectPosition: "50% 22%" }} />
            </motion.figure>
            <motion.figure
              className="absolute -bottom-6 left-3 hidden w-[26%] will-change-transform max-w-[150px] overflow-hidden rounded-t-full border-[6px] border-cream shadow-[0_30px_60px_-30px_rgba(34,22,31,0.55)] sm:block"
              style={{ y: reduce ? 0 : yMirror }}
            >
              <Img name="oshi-blowdry" widths={[440]} sizes="150px" alt="Oshi at work in a black top, blow-drying a client’s hair with a round brush" className="aspect-[3/4] w-full object-cover" style={{ objectPosition: "50% 20%" }} />
            </motion.figure>
          </div>

          {/* Words */}
          <div>
            <p className="eyebrow">Meet {SITE.fullName}</p>
            <h2 id="oshi-title" className="mt-5 text-[clamp(44px,7vw,84px)] font-light leading-[1] text-ink">
              <MaskLines lines={[<>Hi, it’s</>]} />
              <Signature />
            </h2>
            <Reveal delay={0.1}>
              <p className="mt-7 max-w-[46ch] text-[16.5px] leading-[1.8] text-mocha md:text-[17.5px]">
                {SITE.fullName} is the colourist behind {SITE.name}. She trained at Box Hill Institute, built a loyal clientele in Glen Waverley and Doncaster, and on {SITE.movedIn} opened her own permanent suite in {SITE.suburbShort} — “such a huge milestone for me, and I couldn’t have done it without my amazing clients.”
              </p>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-8 flex items-start gap-3 font-display text-[clamp(22px,2.6vw,30px)] font-light italic leading-[1.25] text-cocoa">
                <Heart className="mt-2 h-5 w-[22px] shrink-0 text-mauve" strokeWidth={2} />
                “I love what I do, so I enjoy every minute of it.”
              </p>
            </Reveal>
            <ol className="mt-10 grid gap-x-8 gap-y-6 border-t border-ink/10 pt-8 sm:grid-cols-2">
              {STORY.map((s, i) => (
                <Reveal as="li" key={s.when} delay={i * 0.06}>
                  <p className="text-[11.5px] font-medium uppercase tracking-[0.22em] text-cocoa">{s.when}</p>
                  <p className="mt-1.5 text-[15.5px] leading-relaxed text-ink/85">{s.text}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>

        {/* Two moments from her feed */}
        <div className="mt-24 grid gap-6 md:mt-32 md:grid-cols-2">
          <Reveal className="grid overflow-hidden rounded-[28px] bg-sand sm:grid-cols-[0.9fr_1.1fr]">
            <Img name="big-chop" widths={[480, 640]} sizes="(min-width:640px) 340px, 100vw" alt="A client and her stylist smiling and holding up a long ponytail cut for donation" className="aspect-[4/3] h-full w-full object-cover sm:aspect-auto" style={{ objectPosition: "50% 62%" }} />
            <div className="flex flex-col justify-center p-7 md:p-8">
              <p className="text-[11.5px] font-medium uppercase tracking-[0.22em] text-cocoa">A big chop, donated</p>
              <p className="mt-3 font-display text-[23px] font-light leading-[1.25] text-ink md:text-[26px]">“So proud to be part of moments like this — new hair, new confidence, and a beautiful cause.” 💛</p>
              <p className="mt-3 text-[14.5px] leading-relaxed text-mocha">Every bit donated to support cancer patients.</p>
            </div>
          </Reveal>
          <Reveal delay={0.08} className="grid overflow-hidden rounded-[28px] bg-cocoa text-cream sm:grid-cols-[0.9fr_1.1fr]">
            <Img name="oshi-basin" widths={[480, 660]} sizes="(min-width:640px) 340px, 100vw" alt="At the basin, washing a client’s hair before a colour" className="aspect-[4/3] h-full w-full object-cover sm:aspect-auto" style={{ objectPosition: "50% 66%" }} />
            <div className="flex flex-col justify-center p-7 md:p-8">
              <p className="text-[11.5px] font-medium uppercase tracking-[0.22em] text-champagne">Start a business</p>
              <p className="mt-3 font-display text-[23px] font-light leading-[1.25] md:text-[26px]">“No matter what you do in life, someone will always have an opinion. So don’t let them shrink you.” 💞</p>
              <p className="mt-3 text-[14.5px] leading-relaxed text-cream/80">Build that business. Book that flight. Love, grow — find yourself.</p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/** Her name in the script from her logo, with the heart drawing itself in. */
function Signature() {
  const reduce = useReducedMotionSafe();
  return (
    <motion.span
      className="relative mt-1 inline-block pr-[0.42em] font-script text-[1.55em] font-normal leading-[0.95] text-cocoa"
      initial={reduce ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      variants={{
        hidden: { opacity: 0, y: 24 },
        show: { opacity: 1, y: 0, transition: { duration: 1.2, delay: 0.15, ease: [0.22, 1, 0.36, 1] } },
      }}
    >
      Oshi
      <svg viewBox="0 0 24 22" className="absolute right-0 top-[0.1em] h-[0.32em] w-[0.35em] overflow-visible text-mauve" fill="none" aria-hidden="true">
        <motion.path
          d="M12 20.2s-7.6-4.6-9.6-9.2C.9 7.4 3.1 3 6.9 3c2.1 0 3.7 1.3 5.1 3.2C13.4 4.3 15 3 17.1 3c3.8 0 6 4.4 4.5 8-2 4.6-9.6 9.2-9.6 9.2z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          variants={{
            hidden: { pathLength: 0 },
            show: { pathLength: 1, transition: { duration: 1.1, delay: 0.75, ease: [0.65, 0, 0.35, 1] } },
          }}
        />
      </svg>
    </motion.span>
  );
}
