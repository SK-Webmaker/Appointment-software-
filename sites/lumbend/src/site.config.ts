/**
 * ALL content for LUMBEND lives in this file. Change a line here and the
 * whole site follows — no component holds a fact of its own.
 *
 * LUMBEND is a concept product, made up to show what a site can do: the
 * lamp, its prices and specs are fictional, and the site says so in the
 * footer and the order sheet. The physics is real: each noble gas glows its
 * own colour.
 */

export const SITE = {
  name: "LUMBEND",
  product: "LUMBEND One",
  fullName: "LUMBEND One — the real-glass neon desk lamp",
  role: "Real-glass neon desk lamp",
  tagline: "Real glass. Real gas. Real glow.",
  bio: "LUMBEND One is a neon desk lamp made the old way: a glass tube bent by hand over a flame, filled with noble gas, set on a weighted base. A concept product.",
  currency: "$",
  // TODO: replace with the real domain once it's live; used for canonical and social cards.
  url: "https://insane-website.lovable.app",
} as const;

export const CHAPTERS = [
  { id: "why", numeral: "01", label: "Why real neon" },
  { id: "inside", numeral: "02", label: "What's inside" },
  { id: "shapes", numeral: "03", label: "Five shapes" },
  { id: "colours", numeral: "04", label: "Five colours" },
  { id: "made", numeral: "05", label: "How it's made" },
  { id: "specs", numeral: "06", label: "Specs" },
  { id: "preorder", numeral: "07", label: "Pre-order" },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]["id"];

// ------------------------------------------------------------ why real neon
export const MANIFESTO =
  "Most glowing lamps are LED strips in a plastic costume. LUMBEND One is the real thing: a glass tube bent by hand and filled with gas that glows when you switch it on.";
/** Words in the manifesto that light up in the glow colour. */
export const MANIFESTO_GLOW = ["real", "thing:", "glows", "switch", "on."];

export const STATS = [
  { value: 100, suffix: "%", label: "Glass tube, bent by hand" },
  { value: 5, suffix: "", label: "Noble gases to choose from" },
  { value: 0, suffix: "", label: "LEDs inside" },
] as const;

// ------------------------------------------------------------ what's inside
export const PARTS = [
  { id: "tube", name: "The tube", text: "Lead-free glass, 10 mm, bent by hand over a ribbon burner." },
  { id: "gas", name: "The gas", text: "A noble gas at low pressure. It's what glows — and it decides the colour." },
  { id: "electrodes", name: "Electrodes", text: "Sealed into each end of the tube. Current goes in here." },
  { id: "base", name: "The base", text: "Weighted, with the transformer inside, so the lamp sits steady." },
  { id: "cable", name: "Cable & dimmer", text: "Braided cable with an in-line dimmer. Plugs into the wall." },
] as const;

// ------------------------------------------------------------ five shapes
export const SHAPES = [
  { name: "Loop", price: 189, note: "One unbroken line that comes back to where it started." },
  { name: "Bolt", price: 189, note: "A lightning bolt for the desk. Loud on purpose." },
  { name: "Wave", price: 169, note: "A soft sine wave. The easiest light to live with." },
  { name: "Moon", price: 199, note: "A crescent that turns any room into the last hour of the night." },
  { name: "Word", price: 249, note: "Your own word, written in glass. Up to 12 letters." },
] as const;
export type Shape = (typeof SHAPES)[number]["name"];
export const SHAPE_NAMES = SHAPES.map((s) => s.name) as Shape[];

// ------------------------------------------------------------ five colours
// Real: the colour each noble gas glows when current runs through it.
export const GASES = [
  { symbol: "Ne", number: 10, name: "Neon", colour: "#ff5a36", glow: "red-orange", note: "The one that named the craft. Pure neon burns a warm red-orange — the colour of every OPEN sign you have ever trusted." },
  { symbol: "Ar", number: 18, name: "Argon", colour: "#4fa3ff", glow: "violet → blue", note: "On its own a pale violet. Add a drop of mercury and it turns electric blue." },
  { symbol: "He", number: 2, name: "Helium", colour: "#ff9e8a", glow: "pink-peach", note: "Light as it gets, and it glows like it: a soft pink-peach, gentle on skin and on rooms." },
  { symbol: "Kr", number: 36, name: "Krypton", colour: "#e9e2ff", glow: "silver-white", note: "A cool, silvery white with a hint of lilac. For when the light should feel like moonlight." },
  { symbol: "Xe", number: 54, name: "Xenon", colour: "#9b8cff", glow: "blue-violet", note: "Heavy and rare. A deep blue-violet that makes a room feel like the last hour of the night." },
] as const;
export type GasSymbol = (typeof GASES)[number]["symbol"];
export const GAS_SYMBOLS = GASES.map((g) => g.symbol) as GasSymbol[];

// ------------------------------------------------------------ how it's made
export const STEPS = [
  { title: "Sketch", text: "Each shape is drawn full size on paper. Every curve on the page becomes a bend in the glass." },
  { title: "Bend", text: "Glass tube heated over a ribbon burner until it gives, then shaped over the pattern by hand." },
  { title: "Fill", text: "The air pumped out, your noble gas let in. Neon for red, argon for blue, and the rest from there." },
  { title: "Ignite", text: "Electrodes on, current through, a night on the test bench — then it's packed and on its way to you." },
] as const;

// ------------------------------------------------------------ specs
export const SPECS = [
  { name: "Size", detail: "About 30 cm tall and 22 cm wide, on a 12 cm weighted base. Big enough to light a desk, small enough to keep one." },
  { name: "Glass & gas", detail: "Lead-free 10 mm glass tube, bent by hand and filled with the noble gas you choose." },
  { name: "Power", detail: "Transformer built into the base. Plugs into the wall; in-line dimmer on the braided cable." },
  { name: "In the box", detail: "The lamp, its cable and dimmer, a soft wrap, and a card that names the person who bent your tube." },
  { name: "Delivery & care", detail: "Packed in moulded pulp and shipped insured. Wipe the glass with a dry cloth — and never pull on the tube." },
] as const;

export const MARQUEE = ["Real glass", "Real gas", "Real glow", "Bent by hand", "Switch it on"] as const;

export const price = (n: number) => `${SITE.currency}${n}`;
