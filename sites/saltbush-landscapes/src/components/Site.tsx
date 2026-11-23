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
import { Estimate } from "./Estimate";
import { Gardens } from "./Gardens";
import { Plants } from "./Plants";
import { Seasons } from "./Seasons";
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
          href="#visit"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-full focus:bg-noir focus:px-5 focus:py-3 focus:text-ivory"
        >
          Skip to booking a visit
        </a>
        <Curtain />
        <Nav />
        <StrandRail />
        <main>
          <Hero />
          <Plants />
          <Seasons />
          <Estimate />
          <Gardens />
          <Marquee />
          <Book />
        </main>
        <Footer />
        <BookingBar />
        <BookingSheet />
      </BookingProvider>
    </MotionConfig>
  );
}
