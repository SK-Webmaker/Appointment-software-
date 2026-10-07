/**
 * ALL business content for Empress Hair lives in this file. Change a line
 * here and the whole site follows — no component holds a fact of its own.
 *
 * Every fact and every quote comes from their public Instagram,
 * @empresshairaus (read 7 October 2026): the "My Goals as your stylist"
 * carousel and the "Quality > Quantity" post. Nothing else is public yet, so
 * the site deliberately does NOT name a stylist, list styles or prices, give
 * an address or set opening hours. Sources and open questions: BRAND-BRIEF.md.
 *
 * TODO: confirm with Empress Hair before launch —
 *   - the stylist's name (the site says "we", as their posts do)
 *   - the suburb / studio address (only "Melbourne, VIC" is public)
 *   - the style menu and prices (the booking form asks the client instead)
 *   - the days and hours they take bookings
 */

export const SITE = {
  name: "Empress Hair",
  wordmark: "Empress Hair",
  role: "Braids & protective styling",
  // Her post: "Quality > Quantity 🤍"
  tagline: "Quality > Quantity",
  values: ["Scalp health", "Clean & low-tox", "Length retention", "Comfort & confidence"],
  city: "Melbourne",
  state: "VIC",
  instagramHandle: "empresshairaus",
  instagramUrl: "https://www.instagram.com/empresshairaus/",
  // Opens a DM thread directly in the Instagram app (or web).
  instagramDm: "https://ig.me/m/empresshairaus",
  // TODO: replace with the real domain once it's live; used for canonical and social cards.
  url: "https://empress-hair.lovable.app",
} as const;

export const CHAPTERS = [
  { id: "goals", numeral: "I", label: "Our goals" },
  { id: "products", numeral: "II", label: "Clean products" },
  { id: "book", numeral: "III", label: "Book" },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]["id"];

// ------------------------------------------------------- my goals as your stylist
// Her carousel "My Goals as your stylist 🤍", one card per goal, verbatim.
export const GOALS = [
  {
    title: "Scalp health",
    text: "No more gels that leave you with an irritated scalp and dull build up. We prioritise moisture through oils and the highest quality products to protect your scalp while having your style last.",
    image: "braids",
    widths: [480, 800, 1200],
    position: "50% 30%",
    alt: "Neat braids with clean, even zig-zag parts, seen from above",
  },
  {
    title: "Clean & low-tox styling",
    text: "Instead of putting random chemicals on your scalp in the name of effectiveness and/or price, we research each and every product and ingredient that touches your head. Our aim is to keep the results without compromising your health and wellbeing while promoting clean product options into braiding culture.",
    image: "products",
    widths: [480, 800, 1080],
    position: "50% 55%",
    alt: "The styling station: a braid gel, heat protection, a rat-tail comb, sectioning clips and scissors",
  },
  {
    title: "Length retention",
    text: "We specialise in length retention and protective styling that actually helps your hair grow AND keep that length.",
    image: "length",
    widths: [480, 800, 1080],
    position: "50% 40%",
    alt: "Long, healthy natural hair, freshly washed, seen from behind",
  },
  {
    title: "Comfort & confidence",
    text: "Everyone who sits in our chair is not only provided a service but also is given a comfortable, clean and warming environment that keeps you coming back. Our aim is to have women feeling their most confident after being in our chair and being able to comfortably enjoy their fresh style.",
    image: "coils",
    widths: [480, 962],
    position: "50% 45%",
    alt: "Soft, defined coils catching the light",
  },
] as const;

// ---------------------------------------------------- booking message chips
// The client describes the style she wants; nothing here claims a menu.
export const HAIR_LENGTHS = ["Short", "Shoulder", "Mid-back", "Waist or longer"] as const;
// Days that suit the client — a preference, not a promise of availability.
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Day = (typeof DAYS)[number];
