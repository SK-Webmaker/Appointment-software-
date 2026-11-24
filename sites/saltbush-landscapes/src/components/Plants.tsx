import { ArrowRight, Check, Cloud, CloudSun, Plus, Sun } from "lucide-react";
import { Img } from "./Img";
import { Reveal } from "./Reveal";
import { SectionHead } from "./Section";
import { RevealImg } from "./fx/RevealImg";
import { Tilt } from "./fx/Tilt";
import { MONTHS, PLANTS, SUN_LABEL, type Plant } from "@/site.config";
import { useBooking } from "@/context/booking";

const SUN_ICON = { sun: Sun, part: CloudSun, shade: Cloud } as const;

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
 * Plants we love: a few of the natives we plant most, with height, light and
 * when they flower. Save the ones you like — the list comes to the site visit.
 */
export function Plants() {
  const { shortlist, toggleShortlist, openSheet } = useBooking();

  return (
    <section
      id="plants"
      className="bg-white py-20 text-ink md:py-28"
      aria-labelledby="plants-title"
    >
      <div className="mx-auto max-w-[1320px] px-5 md:px-8">
        <SectionHead
          id="plants-title"
          label="Plants we love"
          title="A few of the natives we plant most"
          intro="Tap + to save the ones you like. We'll bring your list to the site visit and tell you honestly which will thrive in your spot."
        />

        <Reveal className="mt-10">
          <div
            className={`flex flex-col gap-3 rounded-[14px] border px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${shortlist.length ? "border-onyx/30 bg-mint" : "border-ink/10 bg-ivory"}`}
          >
            <p className="text-[15.5px]" aria-live="polite">
              <span className="font-bold">My plant list</span>{" "}
              {shortlist.length ? (
                <span className="text-ash">
                  · {shortlist.length} {shortlist.length === 1 ? "plant" : "plants"}
                </span>
              ) : (
                <span className="text-ash">· nothing saved yet</span>
              )}
            </p>
            {shortlist.length > 0 && (
              <button
                type="button"
                onClick={() => openSheet()}
                className="btn-primary min-h-[46px] shrink-0 px-5"
              >
                Bring them to a visit <ArrowRight size={15} strokeWidth={2} />
              </button>
            )}
          </div>
        </Reveal>

        <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {PLANTS.map((p, i) => (
            <Reveal as="li" key={p.id} delay={(i % 4) * 0.04}>
              <Tilt className="h-full" max={7}>
                <Card
                  p={p}
                  i={i}
                  saved={shortlist.includes(p.id)}
                  onSave={() => toggleShortlist(p.id)}
                />
              </Tilt>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Card({
  p,
  i,
  saved,
  onSave,
}: {
  p: Plant;
  i: number;
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[14px] border border-ink/10 bg-white">
      <div className="relative aspect-square overflow-hidden bg-stone">
        {p.image && (
          <RevealImg className="h-full w-full" delay={(i % 4) * 0.07}>
            <Img
              name={p.image}
              widths={[800]}
              sizes="(min-width:1024px) 310px, (min-width:768px) 31vw, 46vw"
              alt={p.alt ?? p.name}
              className="h-full w-full object-cover"
            />
          </RevealImg>
        )}
        <button
          type="button"
          onClick={onSave}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${p.name} from my list` : `Save ${p.name} to my list`}
          className={`absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full shadow-md transition-colors ${saved ? "bg-onyx text-white" : "bg-white text-ink hover:bg-onyx hover:text-white"}`}
        >
          {saved ? <Check size={19} strokeWidth={2.4} /> : <Plus size={19} strokeWidth={2.2} />}
        </button>
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="font-sans text-[16.5px] font-bold leading-tight sm:text-[19px]">{p.name}</h3>
        <p className="mt-0.5 text-[13px] italic leading-snug text-ash">{p.latin}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink">
          <span>{p.height}</span>
          <span className="flex items-center gap-1.5">
            {p.sun.map((s) => {
              const Icon = SUN_ICON[s];
              return <Icon key={s} size={15} strokeWidth={1.9} aria-label={SUN_LABEL[s]} />;
            })}
          </span>
        </div>
        <div className="mt-3">
          <div className="flex gap-[2px]" aria-hidden="true">
            {MONTHS.map((m, i) => (
              <span
                key={m}
                className="h-1.5 flex-1 rounded-full"
                style={{
                  backgroundColor: p.flowers.includes(i + 1) ? p.colour : "rgb(35 40 31 / 0.1)",
                }}
              />
            ))}
          </div>
          <p className="mt-1.5 text-[12.5px] text-ash">
            {p.flowers.length ? "Flowers " : ""}
            {flowerRange(p.flowers)}
          </p>
        </div>
        <p className="mt-3 hidden text-[14.5px] leading-relaxed text-ash sm:block">{p.note}</p>
      </div>
    </article>
  );
}
