import { MotionConfig } from "framer-motion";
import { useEffect } from "react";
import { Always } from "./Always";
import { Book } from "./Book";
import { BookingBar } from "./BookingBar";
import { BookingSheet } from "./BookingSheet";
import { Curtain } from "./Curtain";
import { DarkHair } from "./DarkHair";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { Marquee } from "./Marquee";
import { Nanoplasty } from "./Nanoplasty";
import { Nav } from "./Nav";
import { Oshi } from "./Oshi";
import { StrandRail } from "./StrandRail";
import { Work } from "./Work";
import { YourTime } from "./YourTime";
import { BookingProvider } from "@/context/booking";
import { settleHashJump, startSmoothScroll } from "@/lib/smooth";

/** The whole page, chapter by chapter. Composition only. */
export function Site() {
  useEffect(() => {
    const stopSmooth = startSmoothScroll();
    const stopHash = settleHashJump();
    return () => {
      stopHash();
      stopSmooth();
    };
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <BookingProvider>
        <a
          href="#book"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-full focus:bg-espresso focus:px-5 focus:py-3 focus:text-cream"
        >
          Skip to booking
        </a>
        <Curtain />
        <Nav />
        <StrandRail />
        <main>
          <Hero />
          <Oshi />
          <DarkHair />
          <Work />
          <Marquee />
          <Nanoplasty />
          <Always />
          <YourTime />
          <Book />
        </main>
        <Footer />
        <BookingBar />
        <BookingSheet />
      </BookingProvider>
    </MotionConfig>
  );
}
