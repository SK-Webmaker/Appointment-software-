import { MotionConfig } from "framer-motion";
import { useEffect } from "react";
import { Atelier } from "./Atelier";
import { Book } from "./Book";
import { BookingBar } from "./BookingBar";
import { BookingSheet } from "./BookingSheet";
import { Curtain } from "./Curtain";
import { Footer } from "./Footer";
import { Founder } from "./Founder";
import { Hero } from "./Hero";
import { JourneyRail } from "./JourneyRail";
import { Marquee } from "./Marquee";
import { Menu } from "./Menu";
import { NailArt } from "./NailArt";
import { Nav } from "./Nav";
import { Pillars } from "./Pillars";
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
          href="#menu"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-full focus:bg-espresso focus:px-5 focus:py-3 focus:text-cream"
        >
          Skip to the menu
        </a>
        <Curtain />
        <Nav />
        <JourneyRail />
        <main>
          <Hero />
          <Atelier />
          <Marquee />
          <Menu />
          <NailArt />
          <Founder />
          <Pillars />
          <Book />
        </main>
        <Footer />
        <BookingBar />
        <BookingSheet />
      </BookingProvider>
    </MotionConfig>
  );
}
