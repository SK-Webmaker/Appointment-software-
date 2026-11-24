import { CalendarCheck, Phone, RotateCcw, SprayCan, Users } from "lucide-react";
import { Img } from "./Img";
import { Reveal } from "./Reveal";
import { SITE } from "@/site.config";
import { useBooking } from "@/context/booking";
import { quote } from "@/lib/slots";

export const HERO_SIZES = "(min-width:1024px) 52vw, 100vw";

const PROMISES = [
  { icon: Users, title: "The same cleaners each time", text: "For regular cleans." },
  { icon: CalendarCheck, title: "A fixed price per clean", text: "Worked out before we arrive." },
  { icon: SprayCan, title: "We bring everything", text: "Products, cloths, mops, vacuum." },
  { icon: RotateCcw, title: "24-hour re-clean guarantee", text: "Not happy? We come back free." },
];

const EXAMPLE = quote({
  bedrooms: 2,
  bathrooms: 1,
  clean: "regular",
  freq: "fortnightly",
  extras: [],
});

/**
 * The opening: what we do and where, Book and Call, beside a photo of a
 * clean kitchen and a real example price. Four promises underneath.
 */
export function Hero() {
  const { openSheet } = useBooking();
  return (
    <>
      <section id="top" className="bg-ivory pt-16 text-ink" aria-labelledby="hero-title">
        <div className="mx-auto grid max-w-[1320px] items-center gap-10 px-5 py-12 md:px-8 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:py-20">
          <Reveal>
            <p className="text-[15px] font-semibold text-rose">
              House cleaning · {SITE.area} · since {SITE.est}
            </p>
            <h1
              id="hero-title"
              className="mt-4 max-w-[14ch] text-[clamp(40px,10vw,56px)] leading-[1.02] lg:text-[clamp(52px,5vw,76px)]"
            >
              A cleaner home, every other Friday
            </h1>
            <p className="mt-5 max-w-[44ch] text-[17px] leading-relaxed text-ash md:text-[19px]">
              Regular, deep and end-of-lease cleaning across Sydney's {SITE.area}. A family business
              with the same small teams, a fixed price per clean, and everything brought with us.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a href="#quote" className="btn-primary px-7 text-[16.5px]">
                Get your price
              </a>
              <a href={SITE.phoneHref} className="btn-ghost px-6 text-[16.5px]">
                <Phone size={18} /> {SITE.phone}
              </a>
            </div>
            <button
              type="button"
              onClick={() => openSheet()}
              className="mt-4 inline-flex min-h-[44px] items-center text-[15px] font-semibold text-onyx underline underline-offset-4"
            >
              Or book a clean now
            </button>
          </Reveal>

          <Reveal delay={0.05} className="relative">
            <div className="aspect-[4/3] overflow-hidden rounded-[16px] bg-stone lg:aspect-[5/4]">
              <Img
                name="kitchen2"
                widths={[800, 1200, 1600, 2000, 2400]}
                sizes={HERO_SIZES}
                alt="A bright, spotless kitchen with a marble island, timber stools and tall windows"
                priority
                className="h-full w-full object-cover object-[40%_50%]"
              />
            </div>
            <div
              data-qa="layered"
              className="absolute -bottom-5 left-4 rounded-[12px] border border-ink/10 bg-white px-5 py-4 shadow-[0_18px_40px_-20px_rgba(20,33,61,0.35)] sm:left-6"
            >
              <p className="text-[13.5px] text-ash">Fortnightly clean, 2 bed, 1 bath</p>
              <p className="mt-0.5 text-[24px] font-bold leading-none">
                ${EXAMPLE.price}
                <span className="ml-1 text-[14px] font-medium text-ash">per clean</span>
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="border-y border-ink/10 bg-white">
        <ul className="mx-auto grid max-w-[1320px] gap-x-8 gap-y-5 px-5 py-7 sm:grid-cols-2 md:px-8 lg:grid-cols-4">
          {PROMISES.map((p) => (
            <li key={p.title} className="flex items-start gap-3">
              <p.icon size={24} strokeWidth={1.8} className="mt-0.5 shrink-0 text-onyx" />
              <span>
                <span className="block text-[15.5px] font-bold leading-snug">{p.title}</span>
                <span className="block text-[14.5px] text-ash">{p.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
