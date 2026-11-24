/**
 * ALL content for Squeegee & Sons lives in this file. Change a line here and
 * the whole site follows — no component holds a fact of its own.
 *
 * Squeegee & Sons is a CONCEPT business: the name, prices, service area,
 * hours, products and phone number are made up to show what a cleaning
 * website can do. The phone number is from the range the ACMA sets aside for
 * fiction, so it can never ring a real person. Photos: Unsplash
 * (public/images/CREDITS.md).
 */

export const SITE = {
  name: "Squeegee & Sons",
  shortName: "Squeegee",
  role: "House cleaning",
  area: "Eastern Suburbs",
  city: "Sydney",
  tagline: "So clean, you'll walk into it.",
  phone: "(02) 5550 0196",
  phoneHref: "tel:+61255500196",
  email: "hello@squeegee.example",
  est: "1987",
  url: "https://squeegee-and-sons.lovable.app",
  concept:
    "Squeegee & Sons is a concept business, made to show what a cleaning website can do. No cleans are booked and nobody will come round.",
  refPrefix: "SQ",
} as const;

/** Cleaning days (0 = Sunday). */
export const OPEN: Record<number, readonly [number, number] | null> = {
  0: null,
  1: [8, 17],
  2: [8, 17],
  3: [8, 17],
  4: [8, 17],
  5: [8, 17],
  6: [8, 14],
};

export const HOURS = [
  { days: "Mon – Fri", time: "8 am – 5 pm" },
  { days: "Saturday", time: "8 am – 2 pm" },
  { days: "Sunday", time: "Feet up" },
] as const;

/** Arrival times. */
export const WINDOWS = [
  { id: "8", label: "8:00 am", from: 8 },
  { id: "1030", label: "10:30 am", from: 10.5 },
  { id: "1", label: "1:00 pm", from: 13 },
] as const;

/** The page's sections, in order — the nav, footer and booking bar read this. */
export const CHAPTERS = [
  { id: "services", numeral: "01", label: "Services" },
  { id: "quote", numeral: "02", label: "Prices" },
  { id: "checklist", numeral: "03", label: "What's included" },
  { id: "kit", numeral: "04", label: "Our kit" },
  { id: "book", numeral: "05", label: "Book a clean" },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]["id"];

// ------------------------------------------------------------ the quote (chapter 01)
export type CleanId = "regular" | "deep" | "lease";
export const CLEANS: {
  id: CleanId;
  name: string;
  note: string;
  /** multiplies the base price and time */
  k: number;
  level: 0 | 1 | 2;
}[] = [
  { id: "regular", name: "Regular", note: "Kitchen, bathrooms, floors, dust.", k: 1, level: 0 },
  {
    id: "deep",
    name: "Deep",
    note: "Regular, plus inside, behind and under.",
    k: 1.7,
    level: 1,
  },
  {
    id: "lease",
    name: "End of lease",
    note: "Every surface, ready for the inspection.",
    k: 2.4,
    level: 2,
  },
];
export const cleanOf = (id: string) => CLEANS.find((c) => c.id === id);

export type FreqId = "once" | "weekly" | "fortnightly" | "monthly";
export const FREQS: { id: FreqId; name: string; off: number; every?: string }[] = [
  { id: "once", name: "Just once", off: 0 },
  { id: "weekly", name: "Weekly", off: 0.2, every: "every week" },
  { id: "fortnightly", name: "Fortnightly", off: 0.15, every: "every fortnight" },
  { id: "monthly", name: "Monthly", off: 0.1, every: "every month" },
];
export const freqOf = (id: string) => FREQS.find((f) => f.id === id);

export const EXTRAS = [
  { id: "oven", name: "Inside the oven", price: 65, mins: 45 },
  { id: "fridge", name: "Inside the fridge", price: 45, mins: 30 },
  { id: "windows", name: "Inside windows", price: 70, mins: 60 },
  { id: "balcony", name: "Balcony", price: 40, mins: 30 },
  { id: "ironing", name: "An hour of ironing", price: 55, mins: 60 },
] as const;
export type ExtraId = (typeof EXTRAS)[number]["id"];

export const PRICING = {
  base: 90,
  perBedroom: 28,
  perBathroom: 34,
  /** minutes for one cleaner */
  baseMins: 60,
  bedroomMins: 25,
  bathroomMins: 35,
  /** over this many cleaner-minutes, we send two */
  pairOver: 180,
};

// ------------------------------------------------------------ the checklist (chapter 02)
/** level: 0 = every clean, 1 = deep and end of lease, 2 = end of lease only */
export const ROOMS: {
  id: string;
  name: string;
  image: string;
  alt: string;
  tasks: { t: string; level: 0 | 1 | 2 }[];
}[] = [
  {
    id: "kitchen",
    name: "Kitchen",
    image: "kitchen",
    alt: "A clean white kitchen with a stainless fridge, island bench and black stools",
    tasks: [
      { t: "Benches and splashback wiped", level: 0 },
      { t: "Sink and taps polished", level: 0 },
      { t: "Cupboard fronts and handles", level: 0 },
      { t: "Stovetop degreased", level: 0 },
      { t: "Microwave in and out", level: 0 },
      { t: "Floor vacuumed and mopped", level: 0 },
      { t: "Rangehood filters soaked", level: 1 },
      { t: "Inside cupboards and drawers", level: 1 },
      { t: "Tiles and grout scrubbed", level: 1 },
      { t: "Oven, racks and trays", level: 2 },
      { t: "Dishwasher filter and seals", level: 2 },
    ],
  },
  {
    id: "bathroom",
    name: "Bathroom",
    image: "wipe",
    alt: "A gloved hand wiping a white surface beside a spray bottle",
    tasks: [
      { t: "Toilet, inside and out", level: 0 },
      { t: "Shower screen squeegeed", level: 0 },
      { t: "Basin, taps and mirror", level: 0 },
      { t: "Bath and tiles wiped", level: 0 },
      { t: "Floor mopped", level: 0 },
      { t: "Grout scrubbed", level: 1 },
      { t: "Exhaust fan cover", level: 1 },
      { t: "Soap scum and limescale removed", level: 1 },
      { t: "Inside the vanity", level: 2 },
      { t: "Window tracks and frames", level: 2 },
    ],
  },
  {
    id: "living",
    name: "Living & bedrooms",
    image: "living",
    alt: "A calm living room with a grey sofa, round timber tables and framed prints",
    tasks: [
      { t: "Dusting, high and low", level: 0 },
      { t: "Floors vacuumed and mopped", level: 0 },
      { t: "Beds made (or changed, if you leave linen out)", level: 0 },
      { t: "Mirrors and glass tables", level: 0 },
      { t: "Under the furniture", level: 1 },
      { t: "Skirting boards", level: 1 },
      { t: "Light switches and door frames", level: 1 },
      { t: "Inside wardrobes", level: 2 },
      { t: "Walls spot-cleaned", level: 2 },
    ],
  },
  {
    id: "floors",
    name: "Floors & stairs",
    image: "stairs",
    alt: "A woman carrying a caddy of cleaning things up a staircase",
    tasks: [
      { t: "Hard floors vacuumed, then mopped", level: 0 },
      { t: "Rugs vacuumed both ways", level: 0 },
      { t: "Stairs, tread by tread", level: 0 },
      { t: "Banisters wiped", level: 1 },
      { t: "Corners and edges by hand", level: 1 },
      { t: "Carpets steam-cleaned", level: 2 },
    ],
  },
];

// ------------------------------------------------------------ services
export const SERVICES = [
  {
    id: "regular",
    name: "Regular cleaning",
    image: "living2",
    alt: "A tidy, light-filled living room with a pale sofa and a view of trees",
    text: "Weekly, fortnightly or monthly. Same cleaners, same day, same standard.",
  },
  {
    id: "deep",
    name: "Deep cleaning",
    image: "kitchen3",
    alt: "A spotless kitchen bench with fruit, flowers and a stovetop",
    text: "Inside, behind and under — a reset for a home that needs one.",
  },
  {
    id: "lease",
    name: "End-of-lease cleaning",
    image: "bedroom2",
    alt: "A bright, freshly cleaned bedroom with a made bed",
    text: "Every surface to the standard agents check, with a re-clean if they ask.",
  },
] as const;

// ------------------------------------------------------------ the bucket (chapter 03)
export const BUCKET = [
  {
    id: "squeegee",
    name: "The squeegee",
    image: "squeegee",
    alt: "A squeegee pulling a clean stripe down a wet, soapy window",
    text: "Our namesake. A brass channel and a new rubber blade every month — one pass, no streaks.",
  },
  {
    id: "sprays",
    name: "Refillable sprays",
    image: "amber",
    alt: "Two amber glass spray bottles and a timber brush on a kitchen bench",
    text: "Plant-based and fragrance-free, mixed fresh in amber glass. No aerosols, no headache.",
  },
  {
    id: "cloths",
    name: "Colour-coded cloths",
    image: "spray",
    alt: "A gloved hand holding a blue spray bottle",
    text: "Blue for glass, green for kitchens, pink for bathrooms. A bathroom cloth never meets a bench.",
  },
  {
    id: "duster",
    name: "Lambswool duster",
    image: "duster",
    alt: "A feather duster over a marble kitchen bench and a cane stool",
    text: "It picks dust up instead of pushing it around — top shelves, light fittings, the fan.",
  },
  {
    id: "mop",
    name: "Flat mop",
    image: "mop",
    alt: "A woman mopping a living room floor beside a blue sofa",
    text: "Washable pads, a fresh one for every room. Floors dry in minutes.",
  },
  {
    id: "vacuum",
    name: "HEPA vacuum",
    image: "vacuum",
    alt: "A gloved hand vacuuming a grey upholstered ottoman",
    text: "Traps the fine dust rather than blowing it back round the room. Good news for hay fever.",
  },
] as const;
export type BucketId = (typeof BUCKET)[number]["id"];

// ------------------------------------------------------------ the area
export const AREA: Record<string, string> = {
  "2021": "Paddington",
  "2022": "Bondi Junction",
  "2024": "Bronte",
  "2025": "Woollahra",
  "2026": "Bondi",
  "2027": "Edgecliff",
  "2028": "Double Bay",
  "2029": "Rose Bay",
  "2030": "Vaucluse",
  "2031": "Randwick",
  "2032": "Kingsford",
  "2033": "Kensington",
  "2034": "Coogee",
  "2035": "Maroubra",
};

export const ACCESS = [
  { id: "home", name: "I'll be home" },
  { id: "lockbox", name: "Key in a lockbox" },
  { id: "concierge", name: "Building concierge" },
] as const;

export const FAQ = [
  {
    q: "Do I need to be home?",
    a: "No. Lots of people leave a key in a lockbox or with the concierge. We text when we arrive and when we lock up.",
  },
  {
    q: "Do you bring everything?",
    a: "Everything — sprays, cloths, mops and the vacuum. If you'd like us to use your own products, leave them out and say so.",
  },
  {
    q: "What if I'm not happy?",
    a: "Tell us within 24 hours and we'll come back and redo it, free.",
  },
  {
    q: "Is it the same cleaners each time?",
    a: "For regular cleans, yes — the same pair, on the same day, so they know where the good cups live.",
  },
] as const;

export const MARQUEE = [
  "Kitchens",
  "Bathrooms",
  "Windows",
  "End of lease",
  "Deep cleans",
  "Eastern Suburbs",
] as const;
