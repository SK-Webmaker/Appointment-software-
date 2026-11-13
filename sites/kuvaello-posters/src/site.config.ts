/**
 * ALL business content for Kuvaello lives in this file. Change a line here
 * and the whole site follows — no component holds a fact of its own.
 *
 * Every fact and quote comes from their own channels (read 12 November
 * 2026): their Instagram bio @kuvaello_posters and their website
 * kuvaelloposters.fi (English version). Sources: BRAND-BRIEF.md.
 *
 * TODO: confirm with Kuvaello before launch —
 *   - that this demo may reuse their portfolio images
 *   - delivery countries for printed posters
 */

export const SITE = {
  name: "Kuvaello",
  fullName: "Kuvaello Posters",
  role: "Custom sports posters",
  // Their tagline, on every poster: "Where your name becomes art."
  tagline: "Where your name becomes art",
  // Their Instagram bio.
  bio: "Custom sports & cinematic posters. Your photo. Your sport. Your moment.",
  from: "€5",
  email: "info@kuvaelloposters.fi",
  instagramHandle: "kuvaello_posters",
  instagramUrl: "https://www.instagram.com/kuvaello_posters/",
  // Opens a DM thread directly in the Instagram app (or web).
  instagramDm: "https://ig.me/m/kuvaello_posters",
  // Their own site, where orders are paid (PayPal or card).
  shopUrl: "https://kuvaelloposters.fi/en#order",
  // TODO: replace with the real domain once it's live; used for canonical and social cards.
  url: "https://kuvaello-posters.lovable.app",
} as const;

export const CHAPTERS = [
  { id: "work", numeral: "I", label: "The work" },
  { id: "how", numeral: "II", label: "How it works" },
  { id: "seen", numeral: "III", label: "Made to be seen" },
  { id: "pricing", numeral: "IV", label: "Pricing" },
  { id: "order", numeral: "V", label: "Create yours" },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]["id"];

// ------------------------------------------------------------ the work
// Their "Selected work" gallery: sport · style, as they caption it.
export const WORK = [
  { image: "energy", sport: "Volleyball", style: "Energy Core", alt: "Kuvaello volleyball poster, Energy Core style: a player in red holding a glowing ball under arena lights" },
  { image: "pesapallo16", sport: "Pesäpallo", style: "Ultra Dark", alt: "Kuvaello pesäpallo poster #16, Ultra Dark edition: a batter mid-swing in a sparking stadium" },
  { image: "mijic", sport: "Gymnastics", style: "Editorial", alt: "Kuvaello rhythmic gymnastics poster: a gymnast with a ribbon under purple and orange light" },
  { image: "moraca", sport: "Volleyball", style: "Portrait", alt: "Kuvaello volleyball portrait poster, Vukčević #4: a player in yellow on an arena court" },
  { image: "jasperi", sport: "Pesäpallo", style: "Ultra Dark", alt: "Kuvaello pesäpallo poster, Jasperi, Ultra Dark edition: a pitcher under stadium floodlights" },
  { image: "skantz", sport: "Pesäpallo", style: "Energy", alt: "Kuvaello pesäpallo poster, Skantz: a player holding a ball wrapped in fire" },
] as const;

// Sports from their gallery and Instagram, for the marquee.
export const SPORTS = ["Volleyball", "Pesäpallo", "Gymnastics", "Floorball", "Boxing", "MMA", "Motorsport", "Ice hockey"] as const;

// ------------------------------------------------------------ how it works
// "Three steps. One Kuvaello." — verbatim.
export const STEPS = [
  { title: "Upload a photo", text: "A portrait or action photo is enough." },
  { title: "We create it", text: "We handle the design and finishing." },
  { title: "Get your Kuvaello", text: "Digital or printed for your wall." },
] as const;

// ------------------------------------------------------------ made to be seen
// Their "From screen to wall" captions, DUO and teams — verbatim.
export const SEEN = [
  {
    title: "Two players. One story.",
    text: "Friends, siblings or teammates — two athletes together in one unique Kuvaello design. A3 · €40 + digital version.",
    image: "duo-vision",
    widths: [480, 800, 1200],
    position: "50% 40%",
    alt: "Kuvaello DUO poster, Vision: two floorball players' faces above them on the court",
  },
  {
    title: "Your moment.",
    text: "Ready to give as a gift or put on display. A personalised Kuvaello makes a memorable birthday gift or end-of-season keepsake.",
    image: "wall-unboxing",
    widths: [480, 800, 1200],
    position: "50% 55%",
    alt: "A woman lifting a Kuvaello poster out of its box at home",
  },
  {
    title: "Made for the wall.",
    text: "When your player becomes part of the space. From one player to the whole team — player cards, rosters, Game Day graphics and a consistent Kuvaello look for the whole team.",
    image: "wall-team",
    widths: [480, 800, 1200],
    position: "50% 40%",
    alt: "A team in navy tracksuits hanging a Kuvaello ice hockey poster on their wall",
  },
  {
    title: "A finished statement piece.",
    text: "Frame it your way and make it part of your home. More than a poster — a memory that lasts.",
    image: "wall-framed",
    widths: [480, 800, 1200],
    position: "50% 45%",
    alt: "A man setting a framed Kuvaello poster on a table in a warm living room",
  },
] as const;

// ------------------------------------------------------------ pricing
// Their price list — verbatim.
export const PRODUCTS = [
  { name: "Digital", price: "€5", detail: "3 different digital Kuvaello posters", tag: "" },
  { name: "A3", price: "€30", detail: "Printed A3 poster + digital version", tag: "Most popular" },
  { name: "DUO A3", price: "€40", detail: "2 athletes in one A3 poster + digital version", tag: "" },
  { name: "Complete Collection", price: "€150", detail: "15 different A3 posters · delivered", tag: "" },
  { name: "50 × 70 Premium", price: "Quote", detail: "Priced individually", tag: "" },
] as const;
export type Product = (typeof PRODUCTS)[number]["name"];
export const PRODUCT_NAMES = PRODUCTS.map((p) => p.name) as Product[];

// Their FAQ, shortened only where marked.
export const FAQ = [
  { q: "What kind of photo do I need?", a: "A clear portrait or action photo is enough to get started. You can send multiple references to help us capture the uniform and details." },
  { q: "Can I include my name and number?", a: "Yes. Your name, jersey number, sport and team colours can be incorporated into the design." },
  { q: "How long does an order take?", a: "Digital designs are typically ready in 1–3 business days. Printed posters require additional production and shipping time." },
  { q: "Is delivery included?", a: "Shipping to one address is included in the listed prices of standard printed posters." },
  { q: "Why should I not print the Instagram image?", a: "Instagram images are optimised for screens. A sharp wall poster requires a separate high-resolution, print-ready file." },
] as const;
