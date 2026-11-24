import { MotionConfig } from "framer-motion";
import { useEffect } from "react";
import { Book } from "./Book";
import { BookingBar } from "./BookingBar";
import { BookingSheet } from "./BookingSheet";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { Nav } from "./Nav";
import { Checklist } from "./Checklist";
import { Kit } from "./Kit";
import { Services } from "./Services";
import { Windows } from "./Windows";
import { Quote } from "./Quote";
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
          Skip to booking a clean
        </a>
        <Nav />
        <main>
          <Hero />
          <Services />
          <Quote />
          <Checklist />
          <Windows />
          <Kit />
          <Book />
        </main>
        <Footer />
        <BookingBar />
        <BookingSheet />
      </BookingProvider>
    </MotionConfig>
  );
}
