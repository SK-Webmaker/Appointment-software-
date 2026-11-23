/**
 * ALL content for Tidewell Plumbing lives in this file. Change a line here
 * and the whole site follows — no component holds a fact of its own.
 *
 * Tidewell is a CONCEPT business: the name, prices, service area, times and
 * phone number are made up to show what a trade website can do. The phone
 * number is from the range the ACMA sets aside for fiction, so it can never
 * ring a real person. Photos: Unsplash (public/images/CREDITS.md).
 */

export const SITE = {
  name: "Tidewell Plumbing",
  shortName: "Tidewell",
  role: "Family plumbers",
  area: "Northern Beaches",
  city: "Sydney",
  tagline: "Little leak or big one, we're on our way.",
  phone: "(02) 5550 0128",
  phoneHref: "tel:+61255500128",
  email: "hello@tidewell.example",
  est: "1998",
  url: "https://tidewell-plumbing.lovable.app",
  concept:
    "Tidewell Plumbing is a concept business, made to show what a trade website can do. No jobs are booked and no plumber is sent.",
  refPrefix: "TW",
} as const;

/** Office hours for booked jobs (0 = Sunday). Urgent jobs 7 days. */
export const OPEN: Record<number, readonly [number, number] | null> = {
  0: null,
  1: [7, 17],
  2: [7, 17],
  3: [7, 17],
  4: [7, 17],
  5: [7, 17],
  6: [8, 13],
};

export const HOURS = [
  { days: "Urgent jobs", time: "7 days, 6 am – 10 pm" },
  { days: "Mon – Fri", time: "7 am – 5 pm" },
  { days: "Saturday", time: "8 am – 1 pm" },
] as const;

export const WINDOWS = [
  { id: "7-9", label: "7 – 9 am", from: 7 },
  { id: "9-11", label: "9 – 11 am", from: 9 },
  { id: "11-1", label: "11 am – 1 pm", from: 11 },
  { id: "1-3", label: "1 – 3 pm", from: 13 },
  { id: "3-5", label: "3 – 5 pm", from: 15 },
] as const;

export const CHAPTERS = [
  { id: "house", numeral: "01", label: "Around the house" },
  { id: "drip", numeral: "02", label: "That drip" },
  { id: "diy", numeral: "03", label: "DIY or call?" },
  { id: "work", numeral: "04", label: "Our work" },
  { id: "book", numeral: "05", label: "Book" },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]["id"];

// ------------------------------------------------------------ problems
export type ProblemId =
  "tap" | "drain" | "toilet" | "hotwater" | "shower" | "washer" | "stormwater" | "gas" | "reno";
export const PROBLEMS: {
  id: ProblemId;
  name: string;
  from: number;
  to: number;
  urgent: boolean;
  note: string;
}[] = [
  {
    id: "tap",
    name: "Dripping tap",
    from: 140,
    to: 260,
    urgent: false,
    note: "New washer or cartridge, or a whole new mixer.",
  },
  {
    id: "drain",
    name: "Blocked sink or drain",
    from: 180,
    to: 420,
    urgent: false,
    note: "Cleared with a camera so we know why it blocked.",
  },
  {
    id: "toilet",
    name: "Running or blocked toilet",
    from: 160,
    to: 380,
    urgent: true,
    note: "Cistern parts, pans and pipes.",
  },
  {
    id: "hotwater",
    name: "No hot water",
    from: 220,
    to: 2600,
    urgent: true,
    note: "Repairs same day; replacements next day.",
  },
  {
    id: "shower",
    name: "Leaking shower",
    from: 190,
    to: 650,
    urgent: false,
    note: "Mixers, wastes and the seal behind the tiles.",
  },
  {
    id: "washer",
    name: "Laundry & dishwasher",
    from: 150,
    to: 320,
    urgent: false,
    note: "Taps, hoses and the drains they empty into.",
  },
  {
    id: "stormwater",
    name: "Stormwater & gutters",
    from: 240,
    to: 900,
    urgent: false,
    note: "Downpipes, pits and the soggy patch in the lawn.",
  },
  {
    id: "gas",
    name: "Gas cooktop or heater",
    from: 190,
    to: 480,
    urgent: true,
    note: "Smell gas? Leave, then call.",
  },
  {
    id: "reno",
    name: "Bathroom or kitchen reno",
    from: 2800,
    to: 18000,
    urgent: false,
    note: "Rough-in to fit-off, fixed-priced from your plans.",
  },
];
export const problemOf = (id: string) => PROBLEMS.find((p) => p.id === id);

// ------------------------------------------------------------ the house (chapter 01)
// Rooms in the cutaway drawing (viewBox 800 × 520) and what goes wrong in each.
export type RoomId = "kitchen" | "bathroom" | "ensuite" | "laundry" | "outside" | "roof";
export const ROOMS: {
  id: RoomId;
  name: string;
  pin: [number, number];
  problems: ProblemId[];
  line: string;
}[] = [
  {
    id: "bathroom",
    name: "Bathroom",
    pin: [540, 230],
    problems: ["shower", "toilet", "tap", "reno"],
    line: "Where most of our callouts start — and most renovations end.",
  },
  {
    id: "ensuite",
    name: "Ensuite",
    pin: [290, 230],
    problems: ["toilet", "shower", "tap"],
    line: "Small room, same pipes. Usually the toilet.",
  },
  {
    id: "kitchen",
    name: "Kitchen",
    pin: [290, 405],
    problems: ["drain", "tap", "gas", "reno"],
    line: "Fat, rice and coffee grounds: the drain's three enemies.",
  },
  {
    id: "laundry",
    name: "Laundry",
    pin: [540, 405],
    problems: ["washer", "drain", "tap"],
    line: "Hoses burst quietly. Check yours are braided.",
  },
  {
    id: "outside",
    name: "Outside",
    pin: [720, 470],
    problems: ["hotwater", "stormwater", "gas"],
    line: "Hot water unit, gas meter and every drain out to the street.",
  },
  {
    id: "roof",
    name: "Roof & gutters",
    pin: [415, 70],
    problems: ["stormwater"],
    line: "Gutters overflow, downpipes block, ceilings stain.",
  },
];

// ------------------------------------------------------------ the drip (chapter 02)
export const WATER = {
  /** ml in one drip */
  dropMl: 0.25,
  /** Sydney-ish usage price, $ per kilolitre (illustrative). */
  dollarsPerKl: 2.7,
  /** a bath, in litres */
  bathL: 150,
};

// ------------------------------------------------------------ DIY or call (chapter 03)
export const QUIZ = [
  {
    q: "What's going on?",
    options: [
      { label: "A drip or a slow drain", next: 1 },
      { label: "Water where it shouldn't be", verdict: "call" },
      { label: "No hot water", next: 2 },
      { label: "I can smell gas", verdict: "gas" },
    ],
  },
  {
    q: "Is it just one sink, basin or shower?",
    options: [
      { label: "Yes, just one", verdict: "diy-drain" },
      { label: "More than one / the toilet gurgles", verdict: "call" },
    ],
  },
  {
    q: "Is your hot water electric or gas?",
    options: [
      { label: "Electric", verdict: "diy-electric" },
      { label: "Gas", verdict: "diy-pilot" },
      { label: "No idea", verdict: "call" },
    ],
  },
] as const;

export const VERDICTS: Record<
  string,
  { title: string; text: string; problem?: ProblemId; diy: boolean }
> = {
  "diy-drain": {
    diy: true,
    title: "Try this first",
    text: "Pour a kettle of hot (not boiling) water, then plunge with the overflow covered. Still slow after two goes? It's further down — book us.",
    problem: "drain",
  },
  "diy-electric": {
    diy: true,
    title: "Check the switchboard",
    text: "Look for a tripped switch marked 'HWS' or 'Off-peak' and reset it once. If it trips again, leave it off and book us.",
    problem: "hotwater",
  },
  "diy-pilot": {
    diy: true,
    title: "Relight the pilot",
    text: "The instructions are on the unit's front panel. If it won't stay lit, or you smell gas, stop and call us.",
    problem: "hotwater",
  },
  call: {
    diy: false,
    title: "Call us — don't wait",
    text: "Turn the water off at the meter (usually by the front boundary) and call. Water spreads faster than you'd think.",
    problem: "toilet",
  },
  gas: {
    diy: false,
    title: "Leave the house, then call",
    text: "Don't switch anything on or off. Turn the gas off at the meter if it's safe, get everyone outside, then call us — or 000 if it's strong.",
    problem: "gas",
  },
};

// ------------------------------------------------------------ the area
export const AREA: Record<string, string> = {
  "2084": "Terrey Hills",
  "2085": "Belrose",
  "2086": "Frenchs Forest",
  "2087": "Forestville",
  "2092": "Seaforth",
  "2093": "Balgowlah",
  "2094": "Fairlight",
  "2095": "Manly",
  "2096": "Freshwater",
  "2097": "Collaroy",
  "2099": "Dee Why",
  "2100": "Brookvale",
  "2101": "Narrabeen",
  "2102": "Warriewood",
  "2103": "Mona Vale",
  "2104": "Bayview",
  "2105": "Church Point",
  "2106": "Newport",
  "2107": "Avalon",
  "2108": "Palm Beach",
};
export const etaFor = (postcode: string) => 25 + Math.abs(Number(postcode) - 2099) * 3;

export const GAUGE = {
  quantities: ["Just one", "Two or three", "The whole house"] as const,
  afterHoursLoading: 1.4,
  max: 3000,
};

// ------------------------------------------------------------ our work (chapter 04)
export const WORK = [
  {
    image: "hero",
    alt: "A bright bathroom with a freestanding bath, timber vanity and a tall plant",
    caption: "Freestanding bath, Freshwater",
  },
  {
    image: "shower",
    alt: "A walk-in glass shower and white vanity with a wide mirror",
    caption: "Walk-in shower, Dee Why",
  },
  {
    image: "tap",
    alt: "A black gooseneck tap over a stainless steel sink beside a timber board",
    caption: "Kitchen mixer, Manly",
  },
  {
    image: "bath",
    alt: "A white bath under a window with a timber-framed vanity",
    caption: "Family bathroom, Collaroy",
  },
  {
    image: "vanity",
    alt: "A concrete-look bathroom with a stone basin and black fittings",
    caption: "Ensuite, Avalon",
  },
  {
    image: "window",
    alt: "A kitchen sink under a wide window with a view of trees",
    caption: "Kitchen, Balgowlah",
  },
  {
    image: "round",
    alt: "A bathroom with a round mirror, timber vanity and wall-hung toilet",
    caption: "Ensuite, Mona Vale",
  },
  {
    image: "blacktap",
    alt: "A matte black tap over a white farmhouse sink",
    caption: "Butler's pantry, Seaforth",
  },
  {
    image: "plants",
    alt: "A white bathroom with plants on the windowsill",
    caption: "Bathroom, Newport",
  },
  {
    image: "chrome",
    alt: "A chrome pull-out kitchen mixer over a double sink",
    caption: "Kitchen, Narrabeen",
  },
] as const;

export const FAQ = [
  {
    q: "Do you charge a call-out fee?",
    a: "A flat $79 to come out, taken off the job if you go ahead. We tell you the fixed price before we start.",
  },
  {
    q: "How soon can you come?",
    a: "Urgent jobs the same day across the Northern Beaches, usually within the hour. Booked jobs in a two-hour window.",
  },
  {
    q: "Are you licensed?",
    a: "Yes — every plumber is licensed for water, drainage and gas, and we leave a compliance certificate where one's needed.",
  },
  {
    q: "Do you do renovations?",
    a: "Bathrooms, kitchens and laundries, from rough-in to the last tap. Send plans or photos for a fixed quote.",
  },
] as const;

export const MARQUEE = [
  "Leaking taps",
  "Blocked drains",
  "Hot water",
  "Toilets",
  "Gas fitting",
  "Bathroom renos",
  "Northern Beaches",
] as const;
