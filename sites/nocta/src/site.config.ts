/**
 * ALL content for NOCTA lives in this file. Change a line here and the whole
 * site follows — no component holds a fact of its own.
 *
 * NOCTA is a concept brand, made up to show what a site can do: the studio,
 * its pieces and its places are fictional, and the site says so in the
 * footer. The physics is real: each noble gas glows its own colour.
 */

export const SITE = {
  name: "NOCTA",
  fullName: "NOCTA Light Studio",
  role: "Neon & light studio",
  tagline: "We bend light for a living",
  bio: "Hand-bent neon, light installations and nights that glow. A concept light studio.",
  // TODO: replace with the real domain once it's live; used for canonical and social cards.
  url: "https://insane-website.lovable.app",
} as const;

export const CHAPTERS = [
  { id: "studio", numeral: "01", label: "The studio" },
  { id: "work", numeral: "02", label: "Selected glow" },
  { id: "spectrum", numeral: "03", label: "The spectrum" },
  { id: "process", numeral: "04", label: "How light is made" },
  { id: "offer", numeral: "05", label: "Commissions" },
  { id: "contact", numeral: "06", label: "Switch it on" },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]["id"];

// ------------------------------------------------------------ the studio
export const MANIFESTO =
  "Darkness is our canvas and light is our material. Every room has a mood waiting to be switched on — we bend glass, fill it with gas and give it a voice.";
/** Words in the manifesto that light up in the accent. */
export const MANIFESTO_GLOW = ["light", "mood", "switched", "on", "voice."];

export const STATS = [
  { value: 4, label: "Hands on every bend" },
  { value: 1, label: "Flame, nothing faked" },
  { value: 0, label: "Shortcuts taken" },
] as const;

// ------------------------------------------------------------ selected glow
// Fictional pieces, each lit in a real gas colour.
export const WORKS = [
  { words: "open late", gas: "Ne", colour: "#ff5a36", place: "A noodle bar's front window", year: "2026" },
  { words: "stay a while", gas: "Ar + Hg", colour: "#4fa3ff", place: "A hotel lobby, after midnight", year: "2026" },
  { words: "after hours", gas: "He", colour: "#ff9ec8", place: "A club's door, down the stairs", year: "2025" },
  { words: "no bad nights", gas: "Ne · amber glass", colour: "#ffb547", place: "A rooftop bar", year: "2025" },
  { words: "you are here", gas: "Kr", colour: "#e9e2ff", place: "A gallery's last room", year: "2024" },
] as const;

// ------------------------------------------------------------ the spectrum
// Real: the colour each noble gas glows when current runs through it.
export const GASES = [
  { symbol: "Ne", number: 10, name: "Neon", colour: "#ff4f2a", glow: "red-orange", note: "The one that named the craft. Pure neon burns a warm red-orange — the colour of every OPEN sign you have ever trusted." },
  { symbol: "Ar", number: 18, name: "Argon", colour: "#4fa3ff", glow: "violet → blue", note: "On its own a pale violet. Add a drop of mercury and it turns electric blue — the base for most other colours." },
  { symbol: "He", number: 2, name: "Helium", colour: "#ff9e8a", glow: "pink-peach", note: "Light as it gets, and it glows like it: a soft pink-peach, gentle on skin and on rooms." },
  { symbol: "Kr", number: 36, name: "Krypton", colour: "#e9e2ff", glow: "silver-white", note: "A cool, silvery white with a hint of lilac. For when the light should feel like moonlight." },
  { symbol: "Xe", number: 54, name: "Xenon", colour: "#9b8cff", glow: "blue-violet", note: "Heavy and rare. A deep blue-violet that makes a room feel like the last hour of the night." },
] as const;

// ------------------------------------------------------------ how light is made
export const STEPS = [
  { title: "Sketch", text: "Your words drawn full size on paper. Every curve on the page becomes a bend in the glass." },
  { title: "Bend", text: "Glass tube heated over a ribbon burner until it gives, then shaped over the pattern by hand." },
  { title: "Fill", text: "The air pumped out, a noble gas let in. Neon for red, argon for blue, and the rest from there." },
  { title: "Ignite", text: "Electrodes on, current through — and the room changes its mind about what time it is." },
] as const;

// ------------------------------------------------------------ commissions
export const OFFERS = [
  { name: "Neon sign", detail: "Your words or your mark, bent by hand in real glass. Windows, walls, bars, bedrooms." },
  { name: "Installation", detail: "Light as architecture: ceilings, corridors and rooms that glow from the inside out." },
  { name: "Club & stage", detail: "Rigs that breathe with the music. Tubes, washes and strobes for venues and tours." },
  { name: "Brand night", detail: "Launches and parties lit end to end — one night, one colour story, every guest's camera out." },
] as const;
export type Offer = (typeof OFFERS)[number]["name"];
export const OFFER_NAMES = OFFERS.map((o) => o.name) as Offer[];

export const MARQUEE = ["Switch it on", "After dark", "Hand-bent", "Noble gas", "Glow on"] as const;
