import { MotionConfig } from "framer-motion";
import { useEffect } from "react";
import { About } from "./About";
import { Book } from "./Book";
import { BookingBar } from "./BookingBar";
import { BookingSheet } from "./BookingSheet";
import { Footer } from "./Footer";
import { Help } from "./Help";
import { Hero } from "./Hero";
import { Nav } from "./Nav";
import { Problems } from "./Problems";
import { Services } from "./Services";
import { Work } from "./Work";
import { Wordmark } from "./Logo";
import { Cursor } from "./fx/Cursor";
import { Preloader } from "./fx/Preloader";
import { ScrollBar } from "./fx/ScrollBar";
import { BookingProvider } from "@/context/booking";
import { settleHashJump, startSmoothScroll } from "@/lib/smooth";

/** The whole page, section by section. Composition only. */
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
        <Preloader>
          <span className="inline-block origin-center scale-[0.7] sm:scale-100">
            <Wordmark size={72} tone="light" />
          </span>
        </Preloader>
        <ScrollBar />
        <Cursor />
        <Nav />
        <main>
          <Hero />
          <Services />
          <Problems />
          <About />
          <Work />
          <Help />
          <Book />
        </main>
        <Footer />
        <BookingBar />
        <BookingSheet />
      </BookingProvider>
    </MotionConfig>
  );
}
