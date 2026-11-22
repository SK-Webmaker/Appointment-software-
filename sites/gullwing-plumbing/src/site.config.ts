/**
 * ALL content for Gullwing Plumbing lives in this file. Change a line here
 * and the whole site follows — no component holds a fact of its own.
 *
 * Gullwing is a CONCEPT business: the name, prices, service area, response
 * times and phone number are made up to show what a trade website can do.
 * The phone number is from the range the ACMA sets aside for fiction, so it
 * can never ring a real person. Photos: Unsplash (public/images/CREDITS.md).
 */

export const SITE = {
  name: "Gullwing Plumbing",
  shortName: "Gullwing",
  role: "Plumbers",
  area: "Inner West & Eastern Suburbs",
  city: "Sydney",
  tagline: "Leaks don't wait. Neither do we.",
  phone: "(02) 5550 0199",
  phoneHref: "tel:+61255500199",
  email: "jobs@gullwing.example",
  est: "2012",
  // TODO: replace with the real domain once it's live; used for canonical and social cards.
  url: "https://gullwing-plumbing.lovable.app",
  concept:
    "Gullwing Plumbing is a concept business, made to show what a trade website can do. No jobs are booked and no van is sent.",
  refPrefix: "GW",
} as const;

/** Office hours (for booked jobs). Emergencies are 24/7. 0 = Sunday. */
export const OPEN: Record<number, readonly [number, number] | null> = {
  0: null,
  1: [7, 18],
  2: [7, 18],
  3: [7, 18],
  4: [7, 18],
  5: [7, 18],
  6: [8, 14],
};

export const HOURS = [
  { days: "Emergencies", time: "24 / 7" },
  { days: "Mon – Fri", time: "7 am – 6 pm" },
  { days: "Saturday", time: "8 am – 2 pm" },
] as const;

/** Booked jobs arrive inside a two-hour window. */
export const WINDOWS = [
  { id: "7-9", label: "7 – 9 am", from: 7 },
  { id: "9-11", label: "9 – 11 am", from: 9 },
  { id: "11-1", label: "11 am – 1 pm", from: 11 },
  { id: "1-3", label: "1 – 3 pm", from: 13 },
  { id: "3-5", label: "3 – 5 pm", from: 15 },
] as const;

export const CHAPTERS = [
  { id: "problems", numeral: "01", label: "What's wrong" },
  { id: "prices", numeral: "02", label: "Fixed prices" },
  { id: "area", numeral: "03", label: "Where we go" },
  { id: "how", numeral: "04", label: "How it works" },
  { id: "book", numeral: "05", label: "Book a plumber" },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]["id"];

// ------------------------------------------------------------ problems (chapter 01)
export type ProblemId = "burst" | "drain" | "hotwater" | "tap" | "toilet" | "gas";
export const PROBLEMS: {
  id: ProblemId;
  name: string;
  image: string;
  position: string;
  alt: string;
  signs: string[];
  from: number;
  to: number;
  urgent: boolean;
}[] = [
  {
    id: "burst",
    name: "Burst pipe",
    image: "roughin",
    position: "50% 50%",
    alt: "Copper and PEX pipes inside an open wall",
    signs: ["Water where it shouldn't be", "A hiss inside the wall", "Pressure suddenly drops"],
    from: 280,
    to: 650,
    urgent: true,
  },
  {
    id: "drain",
    name: "Blocked drain",
    image: "sink2",
    position: "50% 50%",
    alt: "A plumber reaches under a blue-lit sink to the trap",
    signs: [
      "Water sitting in the sink or shower",
      "Gurgling after you flush",
      "A smell that won't go",
    ],
    from: 180,
    to: 420,
    urgent: false,
  },
  {
    id: "hotwater",
    name: "No hot water",
    image: "hws",
    position: "50% 40%",
    alt: "A hand turns the valve on a hot water system",
    signs: ["Cold showers", "Water pooling under the tank", "The pilot keeps going out"],
    from: 220,
    to: 2600,
    urgent: false,
  },
  {
    id: "tap",
    name: "Leaking tap",
    image: "drip",
    position: "50% 40%",
    alt: "Black and white: a single drop falling from a chrome tap",
    signs: ["A drip you hear at night", "A tap you have to force shut", "Water around the base"],
    from: 140,
    to: 260,
    urgent: false,
  },
  {
    id: "toilet",
    name: "Toilet trouble",
    image: "tile",
    position: "50% 40%",
    alt: "A plumber in red gloves works on a wall beside a toilet",
    signs: ["It runs and runs", "It won't flush", "Water on the floor around it"],
    from: 160,
    to: 380,
    urgent: false,
  },
  {
    id: "gas",
    name: "Gas fitting",
    image: "gas",
    position: "50% 50%",
    alt: "A gas bottle valve with a red handle and a pressure gauge",
    signs: ["New cooktop or heater", "A smell of gas (call now)", "Bayonet or line moved"],
    from: 190,
    to: 480,
    urgent: true,
  },
];
export const problemOf = (id: string) => PROBLEMS.find((p) => p.id === id);

// ------------------------------------------------------------ the price gauge (chapter 02)
export const GAUGE = {
  /** price for the chosen problem, scaled by how much there is, and when */
  quantities: ["Just one", "Two or three", "The whole house"] as const,
  afterHoursLoading: 1.6,
  max: 3000,
};

// ------------------------------------------------------------ the area (chapter 03)
// Postcodes we cover (real Sydney postcodes; the business is fictional).
export const AREA: Record<string, string> = {
  "2000": "Sydney CBD",
  "2007": "Ultimo",
  "2008": "Chippendale",
  "2009": "Pyrmont",
  "2010": "Surry Hills",
  "2011": "Potts Point",
  "2015": "Alexandria",
  "2016": "Redfern",
  "2017": "Waterloo",
  "2021": "Paddington",
  "2022": "Bondi Junction",
  "2024": "Bronte",
  "2025": "Woollahra",
  "2026": "Bondi",
  "2031": "Randwick",
  "2037": "Glebe",
  "2038": "Annandale",
  "2039": "Rozelle",
  "2040": "Leichhardt",
  "2041": "Balmain",
  "2042": "Newtown",
  "2043": "Erskineville",
  "2044": "St Peters",
  "2045": "Haberfield",
  "2046": "Five Dock",
  "2048": "Stanmore",
  "2049": "Petersham",
  "2050": "Camperdown",
  "2130": "Summer Hill",
  "2131": "Ashfield",
  "2203": "Dulwich Hill",
  "2204": "Marrickville",
};
/** Minutes for a van to reach each postcode in a quiet hour (fictional). */
export const etaFor = (postcode: string) => {
  const n = Number(postcode);
  const base = n >= 2200 ? 34 : n >= 2130 ? 38 : n >= 2036 ? 26 : n >= 2021 ? 41 : 30;
  return base;
};

// ------------------------------------------------------------ how it works (chapter 04)
export const HOW = [
  {
    title: "You call, or book here",
    text: "A real person answers, day or night. Tell us what's wrong — a photo helps.",
  },
  {
    title: "A fixed price first",
    text: "We price the job before we touch it. The price we quote is the price you pay.",
  },
  {
    title: "We fix it properly",
    text: "Licensed plumbers, stocked vans, so most jobs are done in one visit.",
  },
  {
    title: "Clean up, then a guarantee",
    text: "Drop sheets down, mess gone, and 12 months on our workmanship.",
  },
] as const;

// ------------------------------------------------------------ emergency mode
export const EMERGENCY_STEPS = [
  {
    title: "Turn the water off at the mains",
    text: "Usually at the front boundary, near the water meter. Turn the tap clockwise until it stops.",
  },
  {
    title: "Switch off the hot water system",
    text: "Electric: the hot water switch on the meter box. Gas: turn the dial to 'pilot' or 'off'.",
  },
  {
    title: "Keep water away from power",
    text: "If water is near outlets or lights, switch the power off at the meter box — only if it's dry to reach.",
  },
  {
    title: "Move what matters, then wait",
    text: "Towels down, valuables up. Take photos for your insurer. We'll call when we're five minutes out.",
  },
] as const;

// ------------------------------------------------------------ FAQ
export const FAQ = [
  {
    q: "Do you charge a call-out fee?",
    a: "Not if we do the work. If you decide not to go ahead after our fixed quote, it's $95.",
  },
  {
    q: "Are you really 24/7?",
    a: "Yes. After 6 pm, on Sundays and on public holidays an after-hours rate applies — we tell you before we leave.",
  },
  {
    q: "Can you send a photo quote?",
    a: "For many jobs, yes: add a photo when you book and we'll come back with a price.",
  },
  {
    q: "Is the work guaranteed?",
    a: "Twelve months on our workmanship, plus the manufacturer's warranty on anything we install.",
  },
] as const;

export const MARQUEE = [
  "24/7 emergencies",
  "Fixed prices, upfront",
  "No call-out fee if we fix it",
  "Licensed & insured",
  "12-month guarantee",
  "Clean-up included",
] as const;
