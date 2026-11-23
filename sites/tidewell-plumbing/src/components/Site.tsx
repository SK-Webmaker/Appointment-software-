import { MotionConfig } from "framer-motion";
import { useEffect } from "react";
import { Book } from "./Book";
import { BookingBar } from "./BookingBar";
import { BookingSheet } from "./BookingSheet";
import { Curtain } from "./Curtain";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { Marquee } from "./Marquee";
import { Nav } from "./Nav";
import { Diy } from "./Diy";
import { Drip } from "./Drip";
import { House } from "./House";
import { Work } from "./Work";
import { StrandRail } from "./StrandRail";
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
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-full focus:bg-noir focus:px-5 focus:py-3 focus:text-ivory"
        >
          Skip to booking a plumber
        </a>
        <Curtain />
        <Nav />
        <StrandRail />
        <main>
          <Hero />
          <House />
          <Drip />
          <Diy />
          <Marquee />
          <Work />
          <Book />
        </main>
        <Footer />
        <BookingBar />
        <BookingSheet />
      </BookingProvider>
    </MotionConfig>
  );
}
