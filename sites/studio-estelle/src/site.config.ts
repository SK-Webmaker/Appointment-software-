/**
 * ALL business content for Studio Estelle lives in this file. Change a line
 * here and the whole site follows — no component holds a fact of its own.
 *
 * Every fact and every quote comes from her public Instagram,
 * @studio.estelle_ (read 7 October 2026): her bio, her introduction post,
 * the "garment hire myths" and "bonds" carousels, the Nara post and her
 * fitting-room reel. Sources and open questions: BRAND-BRIEF.md.
 *
 * TODO: confirm with Estelle before launch —
 *   - the price guide (copied from the price list she posts in comments)
 *   - her T&Cs (hire length, bond amount) — the site only says "T&Cs apply"
 *   - try-on days and times (the site asks the client's preference)
 */

export const SITE = {
  name: "Studio Estelle",
  founder: "Estelle",
  role: "Dress & suit hire",
  // From her flyer: "Luxury looks without the luxury price tag · Hire the
  // perfect look for your next event · Located in Mulgrave".
  tagline: "Luxury looks without the luxury price tag",
  promise: "Hire the perfect look for your next event",
  suburb: "Mulgrave",
  postcode: "3170",
  city: "Melbourne",
  state: "VIC",
  // Her bio: "Dress and suit hire · Located in Mulgrave 3170 · Sizes 4-14 ·
  // Please dm me to book a try on · T&Cs apply · Email: …".
  sizes: "4–14",
  email: "studio.estelle.vic@gmail.com",
  instagramHandle: "studio.estelle_",
  instagramUrl: "https://www.instagram.com/studio.estelle_/",
  // Opens a DM thread directly in the Instagram app (or web).
  instagramDm: "https://ig.me/m/studio.estelle_",
  // TODO: replace with the real domain once it's live; used for canonical and social cards.
  url: "https://studio-estelle.lovable.app",
} as const;

export const CHAPTERS = [
  { id: "estelle", numeral: "I", label: "Meet Estelle" },
  { id: "prices", numeral: "II", label: "Price guide" },
  { id: "myths", numeral: "III", label: "Hire myths" },
  { id: "bond", numeral: "IV", label: "The bond" },
  { id: "book", numeral: "V", label: "Book a try-on" },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]["id"];

// ------------------------------------------------------------ price guide
// The price list she posts: "Mini dresses from $50+ Midi dresses from $60+
// Gowns from $100+ Suit jacket only $50 Suit jacket and pants from $80+".
export const PRICES = [
  { item: "Mini dresses", price: "from $50" },
  { item: "Midi dresses", price: "from $60" },
  { item: "Gowns", price: "from $100" },
  { item: "Suit jacket", price: "$50" },
  { item: "Suit jacket & pants", price: "from $80" },
] as const;

// Her "Myth 2" reality, in her own list.
export const OCCASIONS = ["School formals", "Uni balls", "Birthdays", "Engagement parties", "The races", "Work functions", "Weddings"] as const;

// ------------------------------------------------------------ garment hire myths
// Her carousel "Still believe these garment hire myths? It's time to clear
// them up." — verbatim, one card each.
export const MYTHS = [
  {
    myth: "“Hire dresses always look worn.”",
    reality: "Every dress is professionally cleaned and steamed before it reaches you. Most customers tell me it feels brand new the moment they pick up their dress.",
    image: "nara-front",
    widths: [480, 720],
    position: "50% 30%",
    alt: "The Nara: an off-shoulder lilac sequin maxi dress, from the front",
  },
  {
    myth: "“Hire is only for weddings.”",
    reality: "Birthdays, school formals, university balls, engagement parties, races, work functions, if it matters, I have probably dressed someone for it. Any event deserves the right outfit.",
    image: "red-hall",
    widths: [480, 828],
    position: "50% 35%",
    alt: "A fitted red sequin gown with a train, worn in a hallway",
  },
  {
    myth: "“It’s more expensive than just buying something cheap.”",
    reality: "Factor in cost-per-wear against a piece you’ll wear once and never touch again. Hire almost always wins, and you get something far better than “cheap.”",
    image: "gowns",
    widths: [480, 720],
    position: "50% 40%",
    alt: "A rail of gowns in purple sequins, champagne, pink satin, black and teal",
  },
  {
    myth: "“If anything goes wrong, you’re on the hook for the full cost.”",
    reality: "Normal wear is never charged. I am realistic about what a night out actually involves, dancing included.",
    image: "red-train",
    widths: [480, 972],
    position: "50% 40%",
    alt: "The red sequin gown from behind, its train pooling on the floor",
  },
] as const;

// ------------------------------------------------------------ the bond
// Her carousel "What is a bond and why do I ask for one?" — verbatim.
export const BOND = [
  { title: "What it is", text: "It’s not a fee. A bond is a fully refundable security amount held while you have the dress or suit, and it’s released once the dress or suit is back with me in the condition it left in." },
  { title: "Why I take one", text: "A bond protects both sides of the booking. It means I can keep offering beautiful, well-made pieces without needing to price every single dress or suit as if it might not come back." },
  { title: "When you get it back", text: "Most bonds are refunded within 2 business days of your dress or suit being returned and checked. No chasing, no drama, no fine print." },
  { title: "What could affect it", text: "Only genuine damage beyond normal wear, think structural damage or a stain that doesn’t lift with professional cleaning. Everyday creasing or a very faint mark from a big night out is expected and never charged." },
] as const;

// ---------------------------------------------------- booking message chips
// The looks from her price guide, the sizes from her bio, and the events from
// her "hire is only for weddings" myth.
export const LOOKS = ["Mini", "Midi", "Gown", "Suit"] as const;
export const SIZES = ["4", "6", "8", "10", "12", "14"] as const;
export const EVENTS = ["School formal", "Uni ball", "Birthday", "Engagement party", "The races", "Work function", "Wedding", "Something else"] as const;
export type Look = (typeof LOOKS)[number];
export type Size = (typeof SIZES)[number];
export type Occasion = (typeof EVENTS)[number];
