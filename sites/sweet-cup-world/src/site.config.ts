/**
 * ALL business content for Sweet Cup World lives in this file. Change a line
 * here and the whole site follows — no component holds a fact of its own.
 *
 * Every fact and quote comes from their public Instagram, @sweetcupworld
 * (read 7 October 2026): their bio, their welcome post, their flavour menu,
 * their business card and their party and honey-jar posts. Sources and open
 * questions: BRAND-BRIEF.md.
 *
 * TODO: confirm with Sweet Cup World before launch —
 *   - the price ("deliciousness for only $10!!!" in their welcome post)
 *   - delivery area and any delivery fee; minimum order
 *   - what the bee honey jars are (honey, or the honey-pot candles a post mentions)
 */

export const SITE = {
  name: "Sweet Cup World",
  role: "Dessert cups",
  // Their business card: "Dessert cups for any occasion".
  tagline: "Dessert cups for any occasion",
  // Their business card: "Bringing sweetness to your door".
  promise: "Bringing sweetness to your door",
  suburb: "Liverpool",
  city: "Sydney",
  state: "NSW",
  price: "$10",
  instagramHandle: "sweetcupworld",
  instagramUrl: "https://www.instagram.com/sweetcupworld/",
  // Opens a DM thread directly in the Instagram app (or web).
  instagramDm: "https://ig.me/m/sweetcupworld",
  // TODO: replace with the real domain once it's live; used for canonical and social cards.
  url: "https://sweet-cup-world.lovable.app",
} as const;

export const CHAPTERS = [
  { id: "story", numeral: "I", label: "Our story" },
  { id: "flavours", numeral: "II", label: "Flavours" },
  { id: "occasions", numeral: "III", label: "For any occasion" },
  { id: "order", numeral: "IV", label: "Order" },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]["id"];

// ------------------------------------------------------------ the flavours
// Their "Dessert Cup Flavours" menu, in its order and its words.
export const FLAVOURS = [
  { name: "Biscoff", note: "", image: "flavour-biscoff" },
  { name: "Dubai Chocolate", note: "", image: "flavour-dubai" },
  { name: "Pistachio", note: "", image: "flavour-pistachio" },
  { name: "Mehelebi", note: "With crushed pistachio layers", image: "flavour-mehelebi" },
  { name: "Oreo", note: "Cookies & cream", image: "flavour-oreo" },
  { name: "Coconut", note: "Raffaello", image: "flavour-coconut" },
] as const;
export type Flavour = (typeof FLAVOURS)[number]["name"];
export const FLAVOUR_NAMES = FLAVOURS.map((f) => f.name) as Flavour[];

// ------------------------------------------------------------ for any occasion
// Three of their posts, one card each, in their words.
export const OCCASIONS = [
  {
    title: "Dessert cups for any occasion",
    text: "Free customisations to match your party — like the Winnie-the-Pooh toppers on these, our Biscoff cheesecake dessert cups.",
    image: "party-cups",
    widths: [480, 720, 1080],
    position: "50% 55%",
    alt: "Biscoff cheesecake dessert cups with Winnie-the-Pooh toppers on a gold party table",
  },
  {
    title: "Bee honey jars",
    text: "Bee Honey Jars to suit any occasion — birthdays, baby showers, gender reveals. DM to place your order.",
    image: "honey-jars",
    widths: [480, 800, 1080],
    position: "50% 60%",
    alt: "Little honey jars with gold lids, wooden dippers and twine on a gold stand",
  },
  {
    title: "Made fresh to order",
    text: "Every dessert cup is made with insane love & fresh to order — freshly handcrafted by two sisters.",
    image: "prep",
    widths: [480, 720, 1080],
    position: "50% 40%",
    alt: "Making the cups: a jar of Biscoff spread, measuring spoons, a piping bag and a cup of crumb",
  },
] as const;

// Pickup or delivery, from their bio.
export const METHODS = ["Pickup", "Delivery"] as const;
export type Method = (typeof METHODS)[number];
