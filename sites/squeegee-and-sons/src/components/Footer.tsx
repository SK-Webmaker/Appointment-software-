import { Mail, Phone } from "lucide-react";
import { Wordmark } from "./Logo";
import { SplitText } from "./fx/SplitText";
import { AREA, CHAPTERS, HOURS, SERVICES, SITE } from "@/site.config";
import { useBooking } from "@/context/booking";

/** A plain footer: who we are, what we do, when we're open, how to reach us. */
export function Footer() {
  const { openSheet } = useBooking();
  return (
    <footer className="bg-noir text-ivory" aria-label="Footer">
      <div className="mx-auto grid max-w-[1320px] gap-10 px-5 py-16 md:px-8 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div>
          <Wordmark size={42} tone="light" />
          <p className="mt-5 max-w-[34ch] text-[15px] leading-relaxed text-ivory/75">
            Family-run house cleaning in Sydney's {SITE.area} since {SITE.est}. Regular, deep and
            end-of-lease cleans.
          </p>
          <button onClick={() => openSheet()} className="btn-honey mt-6">
            Book a clean
          </button>
        </div>
        <div>
          <p className="text-[15px] font-semibold">Services</p>
          <ul className="mt-3 text-[15px] text-ivory/75">
            {SERVICES.map((s) => (
              <li key={s.id}>
                <a
                  href="#services"
                  className="inline-flex min-h-[44px] items-center hover:text-ivory"
                >
                  {s.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[15px] font-semibold">Hours</p>
          <ul className="mt-3 space-y-2 text-[15px] text-ivory/75">
            {HOURS.map((h) => (
              <li key={h.days}>
                <span className="block text-ivory">{h.days}</span>
                {h.time}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[15px] font-semibold">On this page</p>
          <ul className="mt-2 text-[15px] text-ivory/75">
            {CHAPTERS.map((c) => (
              <li key={c.id}>
                <a
                  href={`#${c.id}`}
                  className="inline-flex min-h-[44px] items-center hover:text-ivory"
                >
                  {c.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[15px] font-semibold">Contact</p>
          <ul className="mt-3 text-[15px] text-ivory/75">
            <li>
              <a
                href={SITE.phoneHref}
                className="inline-flex min-h-[44px] items-center gap-2.5 hover:text-ivory"
              >
                <Phone size={16} /> {SITE.phone}
              </a>
            </li>
            <li>
              <a
                href={`mailto:${SITE.email}`}
                className="inline-flex min-h-[44px] items-center gap-2.5 break-all hover:text-ivory"
              >
                <Mail size={16} className="shrink-0" /> {SITE.email}
              </a>
            </li>
          </ul>
          <p className="mt-4 text-[14px] leading-relaxed text-ivory/65">
            Servicing {Object.values(AREA).slice(0, 6).join(", ")} and the rest of the Eastern
            Suburbs.
          </p>
        </div>
      </div>
      <div aria-hidden="true" className="overflow-hidden px-3">
        <SplitText
          as="p"
          text="Squeegee"
          stagger={0.06}
          className="text-center text-[21vw] font-extrabold leading-[0.82] tracking-[-0.06em] text-ivory/[0.08]"
        />
      </div>
      <div className="border-t border-ivory/10">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-2 px-5 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-[13px] text-ivory/60 md:flex-row md:justify-between md:gap-8 md:px-8">
          <p className="shrink-0">
            © {__BUILD_YEAR__} {SITE.name}
          </p>
          <p className="md:text-right">{SITE.concept} Photos from Unsplash.</p>
        </div>
      </div>
    </footer>
  );
}
