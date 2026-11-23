/**
 * ALL content for Saltbush Landscapes lives in this file. Change a line here
 * and the whole site follows — no component holds a fact of its own.
 *
 * Saltbush is a CONCEPT business: the name, prices, service area, hours and
 * phone number are made up to show what a landscaping website can do. The
 * phone number is from the range the ACMA sets aside for fiction, so it can
 * never ring a real person. The plant notes are general gardening knowledge
 * for Sydney, not advice for a particular garden. Photos: Unsplash
 * (public/images/CREDITS.md).
 */

export const SITE = {
  name: "Saltbush Landscapes",
  shortName: "Saltbush",
  role: "Native garden design",
  area: "Hills District",
  city: "Sydney",
  tagline: "Plant it once. Let the weather do the rest.",
  phone: "(02) 5550 0147",
  phoneHref: "tel:+61255500147",
  email: "hello@saltbush.example",
  est: "2009",
  url: "https://saltbush-landscapes.lovable.app",
  concept:
    "Saltbush Landscapes is a concept business, made to show what a landscaping website can do. No visits are booked and nobody will come out.",
  refPrefix: "SB",
} as const;

/** Site-visit hours (0 = Sunday). */
export const OPEN: Record<number, readonly [number, number] | null> = {
  0: null,
  1: [8, 16],
  2: [8, 16],
  3: [8, 16],
  4: [8, 16],
  5: [8, 16],
  6: [8, 12],
};

export const HOURS = [
  { days: "Mon – Fri", time: "8 am – 4 pm" },
  { days: "Saturday", time: "8 am – noon" },
  { days: "Sunday", time: "In the garden" },
] as const;

/** Site visits take about 45 minutes; these are the start times. */
export const WINDOWS = [
  { id: "8", label: "8:00 am", from: 8 },
  { id: "930", label: "9:30 am", from: 9.5 },
  { id: "11", label: "11:00 am", from: 11 },
  { id: "1", label: "1:00 pm", from: 13 },
  { id: "230", label: "2:30 pm", from: 14.5 },
] as const;

export const CHAPTERS = [
  { id: "plants", numeral: "01", label: "Find your plants" },
  { id: "seasons", numeral: "02", label: "The year in flower" },
  { id: "estimate", numeral: "03", label: "What it costs" },
  { id: "gardens", numeral: "04", label: "Our gardens" },
  { id: "visit", numeral: "05", label: "Book a visit" },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]["id"];

// ------------------------------------------------------------ plants (chapter 01)
export type Sun = "sun" | "part" | "shade";
export type Size = "ground" | "small" | "medium" | "tall";
export type Trait = "birds" | "coastal" | "hedge" | "pots";

export const SUN_LABEL: Record<Sun, string> = {
  sun: "Full sun",
  part: "Part shade",
  shade: "Shade",
};
export const SIZE_LABEL: Record<Size, string> = {
  ground: "Groundcover",
  small: "Under 1 m",
  medium: "1 – 3 m",
  tall: "Over 3 m",
};
export const TRAIT_LABEL: Record<Trait, string> = {
  birds: "Brings birds",
  coastal: "Salt & wind",
  hedge: "Hedges & screens",
  pots: "Pots",
};

export type Plant = {
  id: string;
  name: string;
  latin: string;
  image?: string;
  alt?: string;
  /** colour of the flower (or the foliage, if it's grown for its leaves) */
  colour: string;
  sun: Sun[];
  size: Size;
  height: string;
  traits: Trait[];
  /** months in flower, 1 = January */
  flowers: number[];
  note: string;
};

export const PLANTS: Plant[] = [
  {
    id: "paw",
    name: "Kangaroo paw",
    latin: "Anigozanthos",
    image: "paw",
    alt: "Red kangaroo paw flowering above a mound of silver cushion bush",
    colour: "#c2271f",
    sun: ["sun"],
    size: "small",
    height: "0.5 – 1.2 m",
    traits: ["birds", "pots"],
    flowers: [9, 10, 11, 12, 1],
    note: "Velvet paws on tall stems. Cut spent stems to the base and it flowers again.",
  },
  {
    id: "hairpin",
    name: "Hairpin banksia",
    latin: "Banksia spinulosa",
    image: "banksia",
    alt: "An orange hairpin banksia flower among fine green leaves",
    colour: "#d9711c",
    sun: ["sun", "part"],
    size: "medium",
    height: "1 – 2 m",
    traits: ["birds"],
    flowers: [4, 5, 6, 7, 8],
    note: "A local. Autumn and winter candles that honeyeaters hang off upside-down.",
  },
  {
    id: "scarlet",
    name: "Scarlet banksia",
    latin: "Banksia coccinea",
    image: "banksia2",
    alt: "A scarlet banksia flower, red and white stripes, among holly-like leaves",
    colour: "#c4122f",
    sun: ["sun"],
    size: "medium",
    height: "2 – 4 m",
    traits: ["birds"],
    flowers: [6, 7, 8, 9, 10, 11],
    note: "The showstopper. Fussy: it wants sandy, fast-draining soil — we'll tell you honestly if yours suits.",
  },
  {
    id: "wax",
    name: "Geraldton wax",
    latin: "Chamelaucium uncinatum",
    image: "pink",
    alt: "Small pink-purple Geraldton wax flowers on fine needle leaves",
    colour: "#b5307a",
    sun: ["sun"],
    size: "medium",
    height: "1.5 – 3 m",
    traits: ["pots"],
    flowers: [7, 8, 9, 10],
    note: "Waxy winter flowers that last for weeks in a vase. Prune after flowering.",
  },
  {
    id: "greenpaw",
    name: "Green kangaroo paw",
    latin: "Anigozanthos viridis",
    image: "greenpaw",
    alt: "Green kangaroo paw flowers against a blur of pink and white daisies",
    colour: "#7f9a2c",
    sun: ["sun"],
    size: "small",
    height: "0.4 – 0.8 m",
    traits: ["birds", "pots"],
    flowers: [8, 9, 10, 11],
    note: "Lime-green paws. Copes with the soggy corner most paws hate.",
  },
  {
    id: "grevillea",
    name: "Grevillea 'Robyn Gordon'",
    latin: "Grevillea hybrid",
    colour: "#d8344e",
    sun: ["sun", "part"],
    size: "medium",
    height: "1 – 1.5 m",
    traits: ["birds"],
    flowers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    note: "Flowers almost all year. Wear gloves to prune — the leaves can irritate skin.",
  },
  {
    id: "correa",
    name: "Native fuchsia",
    latin: "Correa reflexa",
    colour: "#d14a3a",
    sun: ["part", "shade"],
    size: "small",
    height: "0.5 – 1.5 m",
    traits: ["birds", "pots"],
    flowers: [4, 5, 6, 7, 8],
    note: "Little bells for the shady side of the house, right through winter.",
  },
  {
    id: "westringia",
    name: "Coastal rosemary",
    latin: "Westringia fruticosa",
    colour: "#b9b0d6",
    sun: ["sun", "part"],
    size: "medium",
    height: "1 – 2 m",
    traits: ["coastal", "hedge", "pots"],
    flowers: [8, 9, 10, 11, 12],
    note: "Clips into a tidy grey-green hedge. Shrugs off wind, salt and neglect.",
  },
  {
    id: "lillypilly",
    name: "Lilly pilly",
    latin: "Syzygium australe",
    colour: "#a6345a",
    sun: ["sun", "part"],
    size: "tall",
    height: "3 – 5 m (hedged 2 – 3 m)",
    traits: ["hedge", "birds"],
    flowers: [11, 12, 1],
    note: "The screening hedge. Red new growth, white fluffy flowers, then berries for the birds.",
  },
  {
    id: "dianella",
    name: "Flax lily",
    latin: "Dianella caerulea",
    colour: "#4a5bc4",
    sun: ["sun", "part", "shade"],
    size: "small",
    height: "0.5 – 1 m",
    traits: ["pots"],
    flowers: [9, 10, 11, 12],
    note: "Strappy leaves, starry blue flowers, then bright blue berries.",
  },
  {
    id: "lomandra",
    name: "Mat rush",
    latin: "Lomandra longifolia",
    colour: "#9aa23a",
    sun: ["sun", "part", "shade"],
    size: "small",
    height: "0.6 – 1 m",
    traits: ["coastal", "pots"],
    flowers: [9, 10],
    note: "The tough one. Sun, shade, clay, sand, drought — it grows.",
  },
  {
    id: "cushion",
    name: "Cushion bush",
    latin: "Leucophyta brownii",
    colour: "#c3cbc2",
    sun: ["sun"],
    size: "small",
    height: "0.5 – 1 m",
    traits: ["coastal", "pots"],
    flowers: [],
    note: "A silver cloud of a plant, grown for its leaves. Lovely beside red paws.",
  },
  {
    id: "saltbush",
    name: "Old man saltbush",
    latin: "Atriplex nummularia",
    colour: "#a9b5a2",
    sun: ["sun"],
    size: "medium",
    height: "1 – 3 m",
    traits: ["coastal", "hedge"],
    flowers: [],
    note: "Our namesake. Silver leaves you can cook with, and nearly unkillable in a dry summer.",
  },
  {
    id: "violet",
    name: "Native violet",
    latin: "Viola hederacea",
    colour: "#8a6bc4",
    sun: ["part", "shade"],
    size: "ground",
    height: "about 10 cm",
    traits: ["pots"],
    flowers: [9, 10, 11, 12, 1, 2, 3],
    note: "A soft carpet for between stepping stones and under trees.",
  },
];
export const plantOf = (id: string) => PLANTS.find((p) => p.id === id);

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;
/** Sydney's seasons by month (1 = January). */
export const seasonOf = (m: number) =>
  m === 12 || m <= 2 ? "Summer" : m <= 5 ? "Autumn" : m <= 8 ? "Winter" : "Spring";

// ------------------------------------------------------------ the estimator (chapter 03)
export type ProjectId = "new" | "makeover" | "planting" | "care";
export const PROJECTS: {
  id: ProjectId;
  name: string;
  note: string;
  /** $ per m², low and high (care: per visit) */
  rate: [number, number];
  /** share of the garden that gets new plants */
  cover: number;
  /** m² we finish in a day on site */
  perDay: number;
}[] = [
  {
    id: "new",
    name: "A new garden",
    note: "Design, soil, paths and planting, from bare dirt.",
    rate: [180, 260],
    cover: 0.7,
    perDay: 22,
  },
  {
    id: "makeover",
    name: "A makeover",
    note: "Keep the good bones, replace the tired bits.",
    rate: [110, 180],
    cover: 0.5,
    perDay: 32,
  },
  {
    id: "planting",
    name: "Planting only",
    note: "Beds are there; we fill them with the right plants.",
    rate: [55, 90],
    cover: 0.8,
    perDay: 60,
  },
  {
    id: "care",
    name: "Ongoing care",
    note: "A seasonal visit to prune, feed, mulch and swap.",
    rate: [1.6, 2.4],
    cover: 0,
    perDay: 400,
  },
];
export const projectOf = (id: string) => PROJECTS.find((p) => p.id === id);

export type StyleId = "bush" | "coastal" | "courtyard" | "bird";
export const STYLES: {
  id: StyleId;
  name: string;
  note: string;
  k: number;
  density: number;
  palette: string[];
}[] = [
  {
    id: "bush",
    name: "Bush garden",
    note: "Loose, layered, local.",
    k: 1,
    density: 2.6,
    palette: ["#4c6a3c", "#7f9a2c", "#d9711c", "#9aa23a", "#3d5a3f"],
  },
  {
    id: "coastal",
    name: "Silver coastal",
    note: "Greys, blues and grasses.",
    k: 1.05,
    density: 3,
    palette: ["#a9b5a2", "#c3cbc2", "#b9b0d6", "#4a5bc4", "#7d8b78"],
  },
  {
    id: "courtyard",
    name: "Courtyard",
    note: "Clipped, potted, paved.",
    k: 1.25,
    density: 2,
    palette: ["#3d5a3f", "#6b7f4e", "#b5307a", "#a9b5a2", "#2f4a32"],
  },
  {
    id: "bird",
    name: "Bird garden",
    note: "Nectar, seed and cover.",
    k: 1,
    density: 2.8,
    palette: ["#c2271f", "#d8344e", "#d9711c", "#4c6a3c", "#d14a3a"],
  },
];
export const styleOf = (id: string) => STYLES.find((s) => s.id === id);

export const EXTRAS = [
  { id: "paths", name: "Sandstone path", perM2: 32 },
  { id: "drip", name: "Drip watering", perM2: 16 },
  { id: "mulch", name: "Soil & mulch", perM2: 12 },
] as const;
export type ExtraId = (typeof EXTRAS)[number]["id"];

/** The garden sizes the booking asks about, and a typical m² for each. */
export const SIZES = [
  { id: "xs", name: "Courtyard", note: "under 30 m²", m2: 20 },
  { id: "s", name: "Small", note: "30 – 80 m²", m2: 55 },
  { id: "m", name: "Medium", note: "80 – 200 m²", m2: 140 },
  { id: "l", name: "Large", note: "over 200 m²", m2: 300 },
] as const;
export type SizeId = (typeof SIZES)[number]["id"];
export const sizeFor = (m2: number): SizeId =>
  m2 < 30 ? "xs" : m2 < 80 ? "s" : m2 < 200 ? "m" : "l";

// ------------------------------------------------------------ the area
export const AREA: Record<string, string> = {
  "2118": "Carlingford",
  "2120": "Pennant Hills",
  "2125": "West Pennant Hills",
  "2126": "Cherrybrook",
  "2152": "Northmead",
  "2153": "Baulkham Hills",
  "2154": "Castle Hill",
  "2155": "Kellyville",
  "2156": "Kenthurst",
  "2157": "Glenorie",
  "2158": "Dural",
  "2768": "Glenwood",
  "2769": "The Ponds",
};

// ------------------------------------------------------------ our gardens (chapter 04)
export const GARDENS = [
  {
    image: "front",
    alt: "A front garden of silver and green perennials and grasses in front of a brick house",
    caption: "Front garden, Castle Hill",
    plants: "grasses, westringia, flax lily",
    tilt: -4,
  },
  {
    image: "patio",
    alt: "A small back garden with a lawn, pale paving, a grey shed and a young tree",
    caption: "Courtyard, Kellyville",
    plants: "lilly pilly screen, mat rush",
    tilt: 3,
  },
  {
    image: "path",
    alt: "A curving garden path edged with grey-leaved shrubs and purple flowers",
    caption: "Side path, Cherrybrook",
    plants: "coastal rosemary, cushion bush",
    tilt: -2,
  },
  {
    image: "lush",
    alt: "A lush, shady garden corner with broad leaves and climbing green",
    caption: "Shade garden, Pennant Hills",
    plants: "native violet, correa",
    tilt: 4,
  },
  {
    image: "lavender",
    alt: "A garden bed of lavender and low shrubs beside a timber fence, with a black cat",
    caption: "Cottage makeover, Dural",
    plants: "we kept the lavender — and the cat",
    tilt: -3,
  },
  {
    image: "chair",
    alt: "A wrought-iron chair on a sandstone terrace surrounded by leafy plants",
    caption: "Sandstone terrace, Glenorie",
    plants: "grevillea, kangaroo paw",
    tilt: 2,
  },
] as const;

export const FAQ = [
  {
    q: "What does the site visit cost?",
    a: "Nothing. We walk the garden with you for about 45 minutes, test the soil and talk ideas. A drawn plan is $350, taken off the build if you go ahead.",
  },
  {
    q: "Do you only use native plants?",
    a: "Mostly — they suit our soil and our summers. If there's a rose you love, it stays. We'd rather a garden you love than a rule.",
  },
  {
    q: "How long until it looks finished?",
    a: "Grasses and groundcovers fill in over one spring. Shrubs take about two years. We plant closer when you can't wait.",
  },
  {
    q: "Do you look after it afterwards?",
    a: "If you'd like. A seasonal visit to prune, feed and mulch — or a page of notes so you can do it yourself.",
  },
] as const;

export const MARQUEE = [
  "Kangaroo paw",
  "Banksia",
  "Lomandra",
  "Grevillea",
  "Saltbush",
  "Sandstone",
  "Hills District",
] as const;
