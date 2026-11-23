import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Cloud, CloudSun, Plus, Sun, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ChapterLabel } from "./ChapterLabel";
import { Img } from "./Img";
import { MaskLines, Reveal } from "./Reveal";
import { PlantArt, type PlantKind } from "./PlantArt";
import {
  MONTHS,
  PLANTS,
  SIZE_LABEL,
  SUN_LABEL,
  TRAIT_LABEL,
  type Plant,
  type Size,
  type Sun as SunId,
  type Trait,
} from "@/site.config";
import { useBooking } from "@/context/booking";

const EASE = [0.22, 1, 0.36, 1] as const;
const SUN_ICON = { sun: Sun, part: CloudSun, shade: Cloud } as const;
/** Drawings for the plants we don't have a photo of. */
const ART: Record<string, { kind: PlantKind; leaf?: string }> = {
  grevillea: { kind: "grevillea" },
  correa: { kind: "shrub", leaf: "#3f5a33" },
  westringia: { kind: "shrub", leaf: "#7d8b78" },
  lillypilly: { kind: "shrub", leaf: "#4c6a3c" },
  dianella: { kind: "tuft" },
  lomandra: { kind: "lomandra" },
  cushion: { kind: "cushion" },
  saltbush: { kind: "saltbush" },
  violet: { kind: "carpet" },
};

/** "Sep – Jan" from [9, 10, 11, 12, 1] (runs that wrap the year are fine). */
export function flowerRange(months: number[]) {
  if (!months.length) return "Grown for its leaves";
  if (months.length === 12) return "almost all year";
  const short = (m: number) => MONTHS[m - 1]!.slice(0, 3);
  const start = months.find((m) => !months.includes(m === 1 ? 12 : m - 1)) ?? months[0]!;
  const end = months.find((m) => !months.includes(m === 12 ? 1 : m + 1)) ?? months.at(-1)!;
  return start === end ? short(start) : `${short(start)} – ${short(end)}`;
}

/**
 * Chapter 01 — find your plants. Filter fourteen natives by how much sun the
 * spot gets, how big you want them and what you want from them; save the
 * ones you like to a list that comes with you to the site visit.
 */
export function Plants() {
  const { shortlist, toggleShortlist, openSheet } = useBooking();
  const [sun, setSun] = useState<SunId | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  const [traits, setTraits] = useState<Trait[]>([]);

  const shown = useMemo(
    () =>
      PLANTS.filter(
        (p) =>
          (!sun || p.sun.includes(sun)) &&
          (!size || p.size === size) &&
          traits.every((t) => p.traits.includes(t)),
      ),
    [sun, size, traits],
  );
  const filtered = !!sun || !!size || traits.length > 0;
  const clear = () => {
    setSun(null);
    setSize(null);
    setTraits([]);
  };

  return (
    <section
      id="plants"
      className="sheet bg-ivory pb-24 pt-24 text-ink md:pb-32 md:pt-36"
      aria-labelledby="plants-title"
    >
      <div className="mx-auto max-w-[1440px] px-5 md:px-10 xl:px-24">
        <ChapterLabel id="plants" />
        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2
            id="plants-title"
            className="max-w-[12ch] text-[clamp(40px,8.4vw,104px)] leading-[0.96]"
          >
            <MaskLines lines={[<>Find your</>, <em className="text-rose">plants.</em>]} />
          </h2>
          <Reveal>
            <p className="max-w-[42ch] text-[16px] leading-[1.75] text-ash md:text-[17px]">
              Tell us about the spot. Save the ones you like — we'll bring your list to the visit
              and tell you honestly which will thrive.
            </p>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[300px_1fr] lg:gap-12">
          {/* filters */}
          <Reveal className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <div className="space-y-6 rounded-[24px] bg-stone p-5 md:p-6">
              <Filter label="How much sun?">
                {(Object.keys(SUN_LABEL) as SunId[]).map((k) => {
                  const Icon = SUN_ICON[k];
                  return (
                    <Chip key={k} on={sun === k} onClick={() => setSun(sun === k ? null : k)}>
                      <Icon size={15} strokeWidth={1.9} /> {SUN_LABEL[k]}
                    </Chip>
                  );
                })}
              </Filter>
              <Filter label="How big?">
                {(Object.keys(SIZE_LABEL) as Size[]).map((k) => (
                  <Chip key={k} on={size === k} onClick={() => setSize(size === k ? null : k)}>
                    {SIZE_LABEL[k]}
                  </Chip>
                ))}
              </Filter>
              <Filter label="Good for">
                {(Object.keys(TRAIT_LABEL) as Trait[]).map((k) => (
                  <Chip
                    key={k}
                    on={traits.includes(k)}
                    onClick={() =>
                      setTraits((t) => (t.includes(k) ? t.filter((x) => x !== k) : [...t, k]))
                    }
                  >
                    {TRAIT_LABEL[k]}
                  </Chip>
                ))}
              </Filter>
              <div className="flex min-h-[44px] items-center justify-between gap-3 border-t border-ink/10 pt-4">
                <p className="text-[14px] font-semibold" aria-live="polite">
                  {shown.length} of {PLANTS.length} plants
                </p>
                {filtered && (
                  <button
                    type="button"
                    onClick={clear}
                    className="inline-flex min-h-[44px] items-center gap-1 text-[13.5px] font-semibold text-rose hover:text-ink"
                  >
                    <X size={14} /> Clear
                  </button>
                )}
              </div>
            </div>
          </Reveal>

          <div className="min-w-0">
            {/* the list you're building */}
            <div
              className={`mb-5 flex flex-col gap-3 rounded-[20px] border-2 border-dashed px-5 py-4 transition-colors duration-500 sm:flex-row sm:items-center sm:justify-between ${shortlist.length ? "border-onyx/40 bg-mint" : "border-ink/15"}`}
            >
              <p className="text-[15px]" aria-live="polite">
                <span className="font-bold">My plant list</span>{" "}
                {shortlist.length ? (
                  <span className="text-ash">
                    · {shortlist.length} {shortlist.length === 1 ? "plant" : "plants"}
                  </span>
                ) : (
                  <span className="text-ash">· tap + on a plant to save it</span>
                )}
              </p>
              {shortlist.length > 0 && (
                <button
                  type="button"
                  onClick={() => openSheet()}
                  className="btn-primary min-h-[46px] shrink-0 px-5"
                >
                  Bring them to a visit <ArrowRight size={15} strokeWidth={1.8} />
                </button>
              )}
            </div>

            {shown.length ? (
              <motion.ul layout className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
                <AnimatePresence mode="popLayout" initial={false}>
                  {shown.map((p) => (
                    <motion.li
                      key={p.id}
                      layout
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.94 }}
                      transition={{ duration: 0.4, ease: EASE }}
                    >
                      <Card
                        p={p}
                        saved={shortlist.includes(p.id)}
                        onSave={() => toggleShortlist(p.id)}
                      />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </motion.ul>
            ) : (
              <div className="rounded-[22px] bg-stone p-8 text-center">
                <p className="font-display text-[26px]">Nothing native ticks every box.</p>
                <p className="mt-2 text-ash">Loosen a filter — or ask us at the visit.</p>
                <button type="button" onClick={clear} className="btn-ghost mt-5">
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Card({ p, saved, onSave }: { p: Plant; saved: boolean; onSave: () => void }) {
  const art = ART[p.id];
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[22px] bg-card shadow-[0_24px_50px_-36px_rgba(35,40,31,0.45)]">
      <div
        className="relative aspect-square overflow-hidden sm:aspect-[4/3]"
        style={p.image ? undefined : { backgroundColor: `${p.colour}26` }}
      >
        {p.image ? (
          <Img
            name={p.image}
            widths={[800]}
            sizes="(min-width:1280px) 340px, 45vw"
            alt={p.alt ?? p.name}
            className="h-full w-full object-cover"
          />
        ) : art ? (
          <div className="flex h-full items-end justify-center px-4 pt-6 sm:px-8 sm:pt-8">
            <PlantArt
              kind={art.kind}
              leaf={art.leaf}
              flower={p.colour}
              className="h-[78%] w-auto max-w-full"
            />
          </div>
        ) : null}
        <button
          type="button"
          onClick={onSave}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${p.name} from my list` : `Save ${p.name} to my list`}
          className={`absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full shadow-md transition-colors duration-300 ${saved ? "bg-onyx text-white" : "bg-white/95 text-ink hover:bg-onyx hover:text-white"}`}
        >
          {saved ? <Check size={19} strokeWidth={2.4} /> : <Plus size={19} strokeWidth={2.2} />}
        </button>
      </div>
      <div className="flex flex-1 flex-col p-3.5 sm:p-5">
        <h3 className="text-[17px] leading-tight sm:text-[23px]">{p.name}</h3>
        <p className="mt-0.5 text-[12.5px] italic leading-snug text-ash sm:text-[14px]">
          {p.latin}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink sm:mt-3 sm:gap-x-4 sm:text-[13px]">
          <span>{p.height}</span>
          <span className="flex items-center gap-1.5">
            {p.sun.map((s) => {
              const Icon = SUN_ICON[s];
              return <Icon key={s} size={15} strokeWidth={1.9} aria-label={SUN_LABEL[s]} />;
            })}
          </span>
        </div>
        <div className="mt-3">
          <div className="flex gap-[2px] sm:gap-[3px]" aria-hidden="true">
            {MONTHS.map((m, i) => (
              <span
                key={m}
                className="h-1.5 flex-1 rounded-full sm:h-2"
                style={{
                  backgroundColor: p.flowers.includes(i + 1) ? p.colour : "rgb(35 40 31 / 0.1)",
                }}
              />
            ))}
          </div>
          <p className="mt-1.5 text-[12px] text-ash sm:text-[12.5px]">
            {p.flowers.length ? "Flowers " : ""}
            {flowerRange(p.flowers)}
          </p>
        </div>
        <p className="mt-3 hidden text-[14.5px] leading-relaxed text-ash sm:block">{p.note}</p>
      </div>
    </article>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-ink">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 text-[14px] font-medium transition-colors duration-300 ${on ? "border-onyx bg-onyx text-white" : "border-ink/15 bg-card text-ink hover:border-ink"}`}
    >
      {children}
    </button>
  );
}
