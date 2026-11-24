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

/** The page's sections, in order — the nav, footer and booking bar read this. */
export const CHAPTERS = [
  { id: "services", numeral: "01", label: "Services" },
  { id: "problems", numeral: "02", label: "Common problems" },
  { id: "about", numeral: "03", label: "About us" },
  { id: "work", numeral: "04", label: "Recent work" },
  { id: "help", numeral: "05", label: "Before you call" },
  { id: "book", numeral: "06", label: "Book a plumber" },
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

// ------------------------------------------------------------ services
export const SERVICES: {
  id: ProblemId;
  name: string;
  image: string;
  alt: string;
  text: string;
}[] = [
  {
    id: "tap",
    name: "Leaking taps & pipes",
    image: "drip",
    alt: "A chrome tap with a drop of water about to fall",
    text: "Washers, cartridges, new mixers and the leak you can hear in the wall.",
  },
  {
    id: "drain",
    name: "Blocked drains",
    image: "drain",
    alt: "A stainless steel sink plug and drain, close up",
    text: "Cleared with a jetter and checked with a camera, so we know why it blocked.",
  },
  {
    id: "hotwater",
    name: "Hot water",
    image: "hotwater",
    alt: "A heat-pump hot water unit installed beside a house",
    text: "Repairs on the day, replacements next day — gas, electric and heat pump.",
  },
  {
    id: "toilet",
    name: "Toilets",
    image: "toilet",
    alt: "A white basin and toilet in a tiled bathroom",
    text: "Running cisterns, blockages, new suites and the wobble you've been ignoring.",
  },
  {
    id: "gas",
    name: "Gas fitting",
    image: "kitchen",
    alt: "A white kitchen with a gas cooktop and open shelves",
    text: "Cooktops, heaters, bayonets and leak checks, with a compliance certificate.",
  },
  {
    id: "stormwater",
    name: "Gutters & stormwater",
    image: "gutter",
    alt: "A house eave with a white gutter and downpipe",
    text: "Downpipes, pits and the soggy patch in the lawn that never dries out.",
  },
];

// ------------------------------------------------------------ common problems, by room
export type RoomId = "kitchen" | "bathroom" | "outside" | "roof";
export const ROOMS: {
  id: RoomId;
  name: string;
  image: string;
  alt: string;
  problems: ProblemId[];
  line: string;
}[] = [
  {
    id: "kitchen",
    name: "Kitchen & laundry",
    image: "kitchen",
    alt: "A bright kitchen with a gas cooktop, white cabinets and open shelving",
    problems: ["drain", "tap", "gas", "washer"],
    line: "Fat, rice and coffee grounds are the drain's three enemies. Laundry hoses burst quietly — check yours are braided.",
  },
  {
    id: "bathroom",
    name: "Bathroom & ensuite",
    image: "shower",
    alt: "A walk-in glass shower and white vanity with a wide mirror",
    problems: ["shower", "toilet", "tap", "reno"],
    line: "Where most of our callouts start, and most renovations end.",
  },
  {
    id: "outside",
    name: "Outside & hot water",
    image: "hotwater",
    alt: "A hot water unit and pipework on the outside wall of a house",
    problems: ["hotwater", "gas", "stormwater"],
    line: "The hot water unit, the gas meter and every drain out to the street.",
  },
  {
    id: "roof",
    name: "Roof & gutters",
    image: "gutter",
    alt: "The eave of a brick house with a gutter and downpipe",
    problems: ["stormwater"],
    line: "Gutters overflow, downpipes block, ceilings stain. Best found before the next big storm.",
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

// ------------------------------------------------------------ before you call
export const CHECKS = [
  {
    q: "No hot water — electric system",
    a: "Check the switchboard for a tripped switch marked 'HWS' or 'Off-peak' and reset it once. If it trips again, leave it off and book us.",
  },
  {
    q: "No hot water — gas system",
    a: "The relighting steps are on the unit's front panel. If the pilot won't stay lit, or you can smell gas, stop and call us.",
  },
  {
    q: "A slow sink or basin",
    a: "Pour a kettle of hot (not boiling) water, then plunge with the overflow covered. Still slow after two goes? It's further down the line.",
  },
  {
    q: "A toilet that keeps running",
    a: "Lift the cistern lid and check the float isn't caught. If water keeps trickling into the bowl, it's usually a worn seal — a quick fix.",
  },
  {
    q: "Water where it shouldn't be",
    a: "Turn the water off at the meter (usually near the front boundary) and call us. Water spreads faster than you'd think.",
  },
  {
    q: "A smell of gas",
    a: "Don't switch anything on or off. Turn the gas off at the meter if it's safe, get everyone outside, then call us — or 000 if it's strong.",
  },
] as const;

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
