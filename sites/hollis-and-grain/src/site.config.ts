/**
 * ALL content for Hollis & Grain lives in this file. Change a line here and
 * the whole site follows — no component holds a fact of its own.
 *
 * Hollis & Grain is a CONCEPT business: the name, barbers, prices, hours and
 * phone number are made up to show what a barbershop website can do. The
 * phone number is from the range the ACMA sets aside for fiction, so it can
 * never ring a real person. Photos: Unsplash (see public/images/CREDITS.md).
 */

export const SITE = {
  name: "Hollis & Grain",
  shortName: "Hollis & Grain",
  role: "Barbers",
  area: "Newtown",
  city: "Sydney",
  tagline: "Sharp cuts, hot towels and no rush.",
  phone: "(02) 5550 0142",
  phoneHref: "tel:+61255500142",
  email: "chair@hollisandgrain.example",
  est: "2019",
  from: "$35",
  // TODO: replace with the real domain once it's live; used for canonical and social cards.
  url: "https://hollis-and-grain.lovable.app",
  concept:
    "Hollis & Grain is a concept business, made to show what a barbershop website can do. No bookings are taken.",
} as const;

/**
 * Opening hours by weekday (0 = Sunday), in 24-hour time. `null` = closed.
 * The booking times, the "open now" line and the hours table all read this.
 */
export const OPEN: Record<number, readonly [number, number] | null> = {
  0: [10, 15],
  1: null,
  2: [9, 19],
  3: [9, 19],
  4: [9, 20],
  5: [9, 19],
  6: [8, 16],
};

export const HOURS = [
  { days: "Monday", time: "Closed" },
  { days: "Tue · Wed · Fri", time: "9 am – 7 pm" },
  { days: "Thursday", time: "9 am – 8 pm" },
  { days: "Saturday", time: "8 am – 4 pm" },
  { days: "Sunday", time: "10 am – 3 pm" },
] as const;

export const POLICY =
  "Can't make it? Move or cancel up to 12 hours before — no charge. Walk-ins welcome whenever a chair is free.";

export const CHAPTERS = [
  { id: "cuts", numeral: "01", label: "The cuts" },
  { id: "barbers", numeral: "02", label: "The barbers" },
  { id: "ritual", numeral: "03", label: "The ritual" },
  { id: "prices", numeral: "04", label: "Prices" },
  { id: "book", numeral: "05", label: "Book" },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]["id"];

// ------------------------------------------------------------ services
export type Service = { name: string; price: number; mins: number; note: string };

export const MENU: { group: string; items: Service[] }[] = [
  {
    group: "Cuts",
    items: [
      {
        name: "Signature Cut",
        price: 55,
        mins: 45,
        note: "Consult, cut, wash, hot-towel finish and style.",
      },
      {
        name: "Skin Fade",
        price: 60,
        mins: 45,
        note: "Bald to blended, foil-shaver clean, any length on top.",
      },
      {
        name: "Scissor Cut",
        price: 65,
        mins: 60,
        note: "Longer hair and textured crops, all by hand.",
      },
      {
        name: "Buzz Cut",
        price: 35,
        mins: 20,
        note: "One length all over, neck and edges tidied.",
      },
      {
        name: "Kids Cut",
        price: 35,
        mins: 30,
        note: "Under 12s. Lollipop optional, patience included.",
      },
    ],
  },
  {
    group: "Beards & shaves",
    items: [
      { name: "Beard Trim", price: 35, mins: 30, note: "Shape, line-up and hot oil." },
      {
        name: "Hot Towel Shave",
        price: 55,
        mins: 45,
        note: "Straight razor, two hot towels, cold finish.",
      },
      { name: "Cut + Beard", price: 85, mins: 60, note: "Any cut with a full beard trim." },
    ],
  },
  {
    group: "The works",
    items: [
      {
        name: "The Full Hollis",
        price: 110,
        mins: 90,
        note: "Cut, beard or shave, scalp massage, face mask, a cold drink.",
      },
      {
        name: "Grey Blending",
        price: 40,
        mins: 30,
        note: "Soft colour that takes the edge off the grey, not the character.",
      },
    ],
  },
];

export const SERVICES = MENU.flatMap((g) => g.items);
export const SERVICE_NAMES = SERVICES.map((s) => s.name);
export const serviceOf = (name: string) => SERVICES.find((s) => s.name === name);
export const priceOf = (name: string) => serviceOf(name)?.price;

// The quick picks in the booking chapter and the sheet.
export const QUICK = [
  "Signature Cut",
  "Skin Fade",
  "Cut + Beard",
  "Beard Trim",
  "Hot Towel Shave",
  "The Full Hollis",
] as const;

// ------------------------------------------------------------ the cuts (chapter 01)
export const CUTS = [
  {
    service: "Signature Cut",
    image: "comb",
    widths: [480, 800, 1200],
    position: "50% 40%",
    alt: "A barber combs and cuts a client's hair, scissors raised",
    line: "The one most people come back for.",
  },
  {
    service: "Skin Fade",
    image: "fade",
    widths: [480, 800, 1200],
    position: "50% 35%",
    alt: "A barber fading the sides of a client's curly hair with clippers",
    line: "Blended so you can't find the line.",
  },
  {
    service: "Scissor Cut",
    image: "side",
    widths: [480, 800, 1200, 1600, 2000],
    position: "60% 40%",
    alt: "A side profile of a fresh scissor cut with a short beard",
    line: "For hair with somewhere to go.",
  },
  {
    service: "Beard Trim",
    image: "line",
    widths: [480, 800, 1200],
    position: "50% 30%",
    alt: "A barber in black gloves lines up a client's beard",
    line: "Shape first, then the edges.",
  },
  {
    service: "Hot Towel Shave",
    image: "shave",
    widths: [480, 800, 1200, 1600, 2000],
    position: "50% 45%",
    alt: "A client leans back for a straight-razor shave",
    line: "Ten minutes of nobody needing you.",
  },
  {
    service: "The Full Hollis",
    image: "result",
    widths: [480, 800, 1200],
    position: "50% 30%",
    alt: "A finished look: a high pompadour and a full, shaped beard",
    line: "Everything we do, in one sitting.",
  },
] as const;

// ------------------------------------------------------------ the barbers (chapter 02)
export type BarberId = "theo" | "rafa" | "jun";
export const BARBERS: {
  id: BarberId;
  name: string;
  title: string;
  years: number;
  known: string;
  tools: string;
}[] = [
  {
    id: "theo",
    name: "Theo",
    title: "Head barber",
    years: 14,
    known: "Skin fades and tapers that grow out clean.",
    tools: "Foil shaver · detailer · steady hands",
  },
  {
    id: "rafa",
    name: "Rafa",
    title: "Scissor specialist",
    years: 9,
    known: "Longer hair, curls and textured crops.",
    tools: "Japanese shears · thinning scissors · patience",
  },
  {
    id: "jun",
    name: "Jun",
    title: "Beard & shave",
    years: 7,
    known: "Beard sculpting and straight-razor shaves.",
    tools: "Straight razor · hot towels · beard oil",
  },
];
export const barberName = (id: string) =>
  id === "any" ? "First available" : (BARBERS.find((b) => b.id === id)?.name ?? "");

// ------------------------------------------------------------ the ritual (chapter 03)
export const RITUAL = [
  {
    title: "The chat",
    text: "Five minutes before the clippers come out: how it grows, how you wear it, how long until you're back. We'd rather ask than guess.",
    image: "gloves",
    widths: [480, 800, 1200],
    position: "50% 35%",
    alt: "A barber in black gloves holds a comb against a client's hair",
  },
  {
    title: "The cut",
    text: "Clippers for the sides, scissors where it matters, a detailer for the edges. Nothing rushed — every booking has its own time.",
    image: "scissor",
    widths: [480, 800, 1200],
    position: "50% 40%",
    alt: "Scissors and comb working through the top of a client's hair",
  },
  {
    title: "The hot towel",
    text: "A steaming towel, a cold one after. It's on every cut, not just the shaves.",
    image: "beardbw",
    widths: [480, 800, 1200],
    position: "50% 30%",
    alt: "Black and white: a barber trims a reclining client's beard",
  },
  {
    title: "The finish",
    text: "Styled the way you'll actually wear it tomorrow, with a word on which product does what — never a hard sell.",
    image: "result",
    widths: [480, 800, 1200],
    position: "50% 28%",
    alt: "A finished pompadour and shaped beard under warm light",
  },
] as const;

// ------------------------------------------------------------ FAQ
export const FAQ = [
  {
    q: "Do you take walk-ins?",
    a: "Yes — whenever a chair is free. A booking keeps your time, a walk-in takes its chances. The live times on this page show who's free today.",
  },
  { q: "What if I need to move my booking?", a: POLICY },
  { q: "How do I pay?", a: "Card, phone or cash at the chair. No deposits." },
  {
    q: "Do you cut kids' hair?",
    a: "Under 12s are $35. The first cut is a big day — we take our time.",
  },
  {
    q: "Can I bring a reference photo?",
    a: "Please do. Add a note when you book, or show us in the chair.",
  },
] as const;

// Words for the brass band.
export const MARQUEE = [
  "Skin fades",
  "Scissor cuts",
  "Hot towel shaves",
  "Beard sculpting",
  "Kids cuts",
  "Walk-ins welcome",
] as const;
