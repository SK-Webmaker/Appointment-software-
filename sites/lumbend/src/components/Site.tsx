import { MotionConfig } from "framer-motion";
import { useEffect } from "react";
import { BookingBar } from "./BookingBar";
import { BookingSheet } from "./BookingSheet";
import { Curtain } from "./Curtain";
import { Cursor } from "./Cursor";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { Marquee } from "./Marquee";
import { Nav } from "./Nav";
import { Flashlight } from "./Flashlight";
import { Inside } from "./Inside";
import { Preorder } from "./Preorder";
import { Shapes } from "./Shapes";
import { Sparks } from "./Sparks";
import { Specs } from "./Specs";
import { Process } from "./Process";
import { Spectrum } from "./Spectrum";
import { Studio } from "./Studio";
import { BookingProvider } from "@/context/booking";
import { startPointer } from "@/lib/pointer";
import { settleHashJump, startSmoothScroll } from "@/lib/smooth";

/** The whole page, chapter by chapter. Composition only. */
export function Site() {
  useEffect(() => {
    startPointer();
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
          href="#preorder"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-full focus:bg-amber focus:px-5 focus:py-3 focus:text-void"
        >
          Skip to pre-order
        </a>
        <Curtain />
        <Nav />
        <main>
          <Hero />
          <Studio />
          <Inside />
          <Shapes />
          <Spectrum />
          <Process />
          <Specs />
          <Marquee />
          <Preorder />
        </main>
        <Footer />
        <BookingBar />
        <BookingSheet />
        <Flashlight />
        <Sparks />
        <Cursor />
      </BookingProvider>
    </MotionConfig>
  );
}
