/**
 * ALL content for Lowlight Detailing lives in this file. Change a line here
 * and the whole site follows — no component holds a fact of its own.
 *
 * Lowlight is a CONCEPT business: the name, prices, hours and phone number
 * are made up to show what a car detailing website can do. The phone number
 * is from the range the ACMA sets aside for fiction, so it can never ring a
 * real person. Photos: Unsplash (see public/images/CREDITS.md).
 */

export const SITE = {
  name: "Lowlight Detailing",
  shortName: "Lowlight",
  role: "Detailing studio",
  area: "Alexandria",
  city: "Sydney",
  tagline: "Detailing, after dark.",
  phone: "(02) 5550 0163",
  phoneHref: "tel:+61255500163",
  email: "bay@lowlight.example",
  est: "2020",
  from: "$149",
  url: "https://lowlight-detailing.lovable.app",
  concept:
    "Lowlight Detailing is a concept business, made to show what a detailing website can do. No bookings are taken.",
  refPrefix: "LL",
} as const;

/** Studio drop-off hours by weekday (0 = Sunday). `null` = closed. */
export const OPEN: Record<number, readonly [number, number] | null> = {
  0: null,
  1: [7, 18],
  2: [7, 18],
  3: [7, 18],
  4: [7, 20],
  5: [7, 18],
  6: [8, 16],
};

export const HOURS = [
  { days: "Mon – Wed, Fri", time: "7 am – 6 pm" },
  { days: "Thursday", time: "7 am – 8 pm" },
  { days: "Saturday", time: "8 am – 4 pm" },
  { days: "Sunday", time: "Closed" },
] as const;

export const POLICY =
  "Move or cancel up to 24 hours before at no charge. Paint correction and ceramic jobs need the car for the full day — we'll text when it's ready.";

export const CHAPTERS = [
  { id: "build", numeral: "01", label: "Build a detail" },
  { id: "stages", numeral: "02", label: "The stages" },
  { id: "ceramic", numeral: "03", label: "Ceramic" },
  { id: "book", numeral: "04", label: "Book a bay" },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]["id"];

// ------------------------------------------------------------ the builder (chapter 01)
export type VehicleId = "hatch" | "sedan" | "suv" | "ute";
export const VEHICLES: { id: VehicleId; name: string; k: number; example: string }[] = [
  { id: "hatch", name: "Hatch", k: 1, example: "Golf, Yaris, i30" },
  { id: "sedan", name: "Sedan", k: 1.12, example: "Camry, 3 Series, Model 3" },
  { id: "suv", name: "SUV", k: 1.28, example: "RAV4, X5, Santa Fe" },
  { id: "ute", name: "Ute / 4WD", k: 1.4, example: "Hilux, Ranger, LandCruiser" },
];

export type PackageId = "express" | "correction" | "ceramic" | "interior";
export const PACKAGES: {
  id: PackageId;
  name: string;
  price: number;
  hours: number;
  protects: string;
  months: number;
  blurb: string;
  includes: string[];
}[] = [
  {
    id: "express",
    name: "Express Gloss",
    price: 149,
    hours: 2,
    protects: "6 weeks",
    months: 1.5,
    blurb: "Snow-foam wash, decon, spray sealant. The weekly-driver reset.",
    includes: [
      "pH-neutral snow foam",
      "Two-bucket hand wash",
      "Iron & tar decon",
      "Spray sealant",
      "Glass & tyres",
    ],
  },
  {
    id: "interior",
    name: "Interior Reset",
    price: 229,
    hours: 3,
    protects: "Fabric guard",
    months: 6,
    blurb: "Steam, extract, condition. Smells like nothing, which is the point.",
    includes: [
      "Steam clean every surface",
      "Hot-water carpet extraction",
      "Leather clean & condition",
      "Vents, seams & rails",
      "Odour treatment",
    ],
  },
  {
    id: "correction",
    name: "Paint Correction",
    price: 590,
    hours: 8,
    protects: "6 months",
    months: 6,
    blurb: "Two-stage machine polish that removes swirls, not just hides them.",
    includes: [
      "Everything in Express",
      "Paint-depth readings",
      "Compound + polish stages",
      "Panel wipe inspection",
      "Six-month sealant",
    ],
  },
  {
    id: "ceramic",
    name: "Ceramic Shield",
    price: 1290,
    hours: 16,
    protects: "3 years",
    months: 36,
    blurb: "Correction plus a nine-hardness ceramic coat, cured overnight.",
    includes: [
      "Full paint correction",
      "Two-layer ceramic coat",
      "Wheels & glass coated",
      "Overnight cure in the bay",
      "Free 12-month top-up",
    ],
  },
];

export const ADDONS: { id: string; name: string; price: number; mins: number }[] = [
  { id: "pet", name: "Pet hair removal", price: 60, mins: 45 },
  { id: "engine", name: "Engine bay detail", price: 80, mins: 45 },
  { id: "lights", name: "Headlight restoration", price: 120, mins: 60 },
  { id: "glass", name: "Glass coating", price: 90, mins: 30 },
];

export const packageOf = (id: string) => PACKAGES.find((p) => p.id === id);
export const vehicleOf = (id: string) => VEHICLES.find((v) => v.id === id);

/** The quote for a build: price rounded to $5, time in hours. */
export function quote(vehicle: string, pkg: string, addons: string[]) {
  const v = vehicleOf(vehicle) ?? VEHICLES[1]!;
  const p = packageOf(pkg) ?? PACKAGES[0]!;
  const extras = ADDONS.filter((a) => addons.includes(a.id));
  const price = Math.round((p.price * v.k + extras.reduce((t, a) => t + a.price, 0)) / 5) * 5;
  const hours = p.hours * (0.85 + v.k * 0.15) + extras.reduce((t, a) => t + a.mins, 0) / 60;
  return { price, hours: Math.round(hours * 2) / 2, overnight: hours > 9 };
}

// ------------------------------------------------------------ the stages (chapter 02)
export const STAGES = [
  {
    n: "01",
    title: "Snow foam",
    text: "Thick foam dwells and lifts grit before a mitt touches the paint — most swirls start at the wash.",
    image: "foam",
    position: "50% 40%",
    alt: "A dark Mercedes covered in thick white snow foam",
  },
  {
    n: "02",
    title: "Decontaminate",
    text: "Iron remover bleeds purple off the wheels; clay lifts what's bonded. Smooth as glass to the fingertip.",
    image: "tyre",
    position: "50% 50%",
    alt: "A gloved hand scrubbing a black tyre with a detailing brush",
  },
  {
    n: "03",
    title: "Measure",
    text: "A paint-depth gauge on every panel before a pad spins. We remove microns, not guesses.",
    image: "tape",
    position: "50% 50%",
    alt: "A black bonnet half-polished beside a strip of green masking tape",
  },
  {
    n: "04",
    title: "Correct",
    text: "Compound to cut, polish to refine, under lights that show every defect the sun will.",
    image: "polisher",
    position: "50% 40%",
    alt: "A detailer runs a dual-action polisher across dark paint in a dim studio",
  },
  {
    n: "05",
    title: "Protect",
    text: "Sealant or ceramic, applied panel by panel and levelled before it flashes.",
    image: "restore",
    position: "50% 50%",
    alt: "A detailer leans over a car's headlight, restoring the lens",
  },
  {
    n: "06",
    title: "Inside",
    text: "Steam, brushes and patience for the seams, vents and stitching you touch every day.",
    image: "dash",
    position: "50% 50%",
    alt: "A gloved detailer brushes a classic car's timber dashboard clean",
  },
] as const;

// ------------------------------------------------------------ ceramic (chapter 03)
export const COATINGS = [
  {
    id: "none",
    name: "Nothing",
    months: 0,
    note: "Water sheets and sits; grime bonds to bare clear coat.",
  },
  { id: "wax", name: "Wax", months: 1.5, note: "Warm glow, tight beads — for about six weeks." },
  {
    id: "sealant",
    name: "Sealant",
    months: 6,
    note: "Synthetic, slick and hard-wearing for six months.",
  },
  {
    id: "ceramic",
    name: "Ceramic",
    months: 36,
    note: "A hard glass-like layer. Beads for years, washes in minutes.",
  },
] as const;

export const FAQ = [
  {
    q: "Do you come to me?",
    a: "For Express Gloss and Interior Reset, yes — anywhere within 15 km of the studio, with our own water and power. Correction and ceramic work stays in the bay, under the lights.",
  },
  {
    q: "How long will you have my car?",
    a: "Express and interior jobs are same-day. Paint correction is a full day; ceramic stays overnight to cure. The builder tells you when it'll be ready.",
  },
  {
    q: "Will it remove every scratch?",
    a: "Swirls and light marring, yes. Anything your fingernail catches is through the clear coat — we'll show you before we start and quote touch-up separately.",
  },
  {
    q: "How do I pay?",
    a: "Card or bank transfer when you collect. No deposits for jobs under $600.",
  },
] as const;

export const MARQUEE = [
  "Paint correction",
  "Ceramic coating",
  "Snow-foam wash",
  "Interior steam",
  "Headlight restoration",
  "Mobile service",
] as const;
