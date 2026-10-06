/**
 * ALL business content for Hair by Oshi lives in this file. Change a day,
 * the address or a service here and the whole site follows — no component
 * holds a fact of its own.
 *
 * Every fact and every quote comes from Oshi's own public Instagram,
 * @hair_by_oshi_ (read 6 October 2026), or the Freedom Suites Oakleigh
 * listing. Sources and open questions: BRAND-BRIEF.md.
 *
 * Deliberately NOT on the site: prices (she doesn't publish any), keratin
 * (removed at the client's request), reviews, opening hours (only her days
 * are public), and anything the old Lovable draft invented.
 *
 * TODO: confirm with Oshi before launch —
 *   - the address line (suite number at Freedom Suites, 350 Warrigal Rd)
 *   - start and finish times on her four days
 *   - whether she also wants cuts / blow-dries listed as services
 */

export const SITE = {
  name: "Hair by Oshi",
  founder: "Oshi",
  fullName: "Oshi Dias",
  role: "Colourist & Nanoplasty specialist",
  specialty: "Dark hair specialist",
  tagline: "Healthy hair — confident you",
  values: ["Beauty", "Science", "Care"],
  suburb: "Oakleigh South",
  suburbShort: "Oakleigh",
  city: "Melbourne",
  state: "VIC",
  postcode: "3167",
  // TODO: confirm — the Freedom Suites Oakleigh address; her suite number isn't public.
  venue: "Freedom Suites Oakleigh",
  street: "350 Warrigal Rd",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Freedom+Suites+Oakleigh+350+Warrigal+Rd+Oakleigh+South+VIC+3167",
  // From her bio: "🗓️ MON, TUE, FRI & SAT".
  days: ["Mon", "Tue", "Fri", "Sat"] as const,
  daysLong: "Monday, Tuesday, Friday & Saturday",
  movedIn: "1 March 2025",
  instagramHandle: "hair_by_oshi_",
  instagramUrl: "https://www.instagram.com/hair_by_oshi_/",
  // Opens a DM thread directly in the Instagram app (or web).
  instagramDm: "https://ig.me/m/hair_by_oshi_",
  // TODO: replace with the real domain once it's live; used for canonical and social cards.
  url: "https://hair-by-oshi.lovable.app",
} as const;

export const CHAPTERS = [
  { id: "dark-hair", numeral: "I", label: "Dark hair" },
  { id: "work", numeral: "II", label: "The work" },
  { id: "nanoplasty", numeral: "III", label: "Nanoplasty" },
  { id: "always", numeral: "IV", label: "Always" },
  { id: "oshi", numeral: "V", label: "Oshi" },
  { id: "your-time", numeral: "VI", label: "Your time" },
  { id: "book", numeral: "VII", label: "Book" },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]["id"];

// ------------------------------------------------------------- services
// Her bio lists COLOUR + NANOPLASTY (+ keratin, left off at the client's
// request). The colour services are the ones she names herself: "Grey
// blending ✓ Root touch-ups ✓ Lower-maintenance colour ✓ Softer grow-outs
// ✓ Budget-friendly plans" and "If you're booking in for a colour
// correction…". No prices — she quotes by message.

export type Service = {
  id: string;
  name: string;
  short: string;
  note: string;
};

export const SERVICES: Service[] = [
  {
    id: "colour",
    name: "Colour",
    short: "Colour",
    note: "Blended roots, honey blondes, cherry reds and glossy brunettes — built for dark, thick hair.",
  },
  {
    id: "grey",
    name: "Grey blending & root touch-ups",
    short: "Grey blending",
    note: "Lower-maintenance colour and softer grow-outs. There are safer ways to manage greys than black box dye.",
  },
  {
    id: "correction",
    name: "Colour correction",
    short: "Colour correction",
    note: "Moving on from box dye or old colour, gently — sometimes over more than one session.",
  },
  {
    id: "nanoplasty",
    name: "Nanoplasty",
    short: "Nanoplasty",
    note: "Nano-sized collagen, amino acids and proteins for smooth, frizz-free, shiny hair that lasts 4–6 months.",
  },
  {
    id: "advice",
    name: "Not sure yet — help me choose",
    short: "Help me choose",
    note: "Tell Oshi where your hair is now and where you'd love it to be.",
  },
];

export const SERVICE_BY_ID: Record<string, Service> = Object.fromEntries(SERVICES.map((s) => [s.id, s]));

// ---------------------------------------------------- booking message chips
export const HAIR_LENGTHS = ["Short", "Shoulder", "Long", "Very long"] as const;
export const HAIR_TEXTURES = ["Fine", "Medium", "Thick"] as const;
export const HAIR_HISTORY = ["Natural, never coloured", "Box dye", "Salon colour", "Lightened / bleached", "Smoothing treatment"] as const;

/** "My suite is your space for a few hours… I'll match your vibe." */
export const VIBES = [
  {
    id: "chat",
    label: "Chat the whole time",
    line: "I love what I do, so I enjoy every minute of it — and sometimes I talk too much.",
  },
  {
    id: "work",
    label: "Get some work done",
    line: "Bring the laptop. Grab a coffee, get comfortable — the suite is your space for a few hours.",
  },
  {
    id: "unwind",
    label: "Read or watch Netflix",
    line: "Help yourself to some snacks, put your feet up and treat it as your “me time.”",
  },
  {
    id: "quiet",
    label: "A peaceful, quiet one",
    line: "I'll happily pop my headphones on, listen to a podcast, and let you enjoy your time.",
  },
] as const;

export type VibeId = (typeof VIBES)[number]["id"];

// ------------------------------------------------------------- the work
// Every photograph is from her own posts; the caption is hers where she
// wrote one. Credits: public/images/CREDITS.md.
export type Work = {
  image: string;
  widths: number[];
  title: string;
  caption: string;
  alt: string;
  position?: string;
};

export const WORK: Work[] = [
  {
    image: "honey-roots",
    widths: [480, 640],
    title: "Honey blonde",
    caption: "Blended roots with a beautiful honey blonde 🍯",
    alt: "A client with long honey-blonde waves and blended dark roots, smiling in the salon",
  },
  {
    image: "cherry-red",
    widths: [480, 720],
    title: "Cherry red",
    caption: "This colour is still on ♥️",
    alt: "Long, curled cherry-red hair seen from behind, hands lifted to the head",
    position: "50% 40%",
  },
  {
    image: "yours-truly",
    widths: [480, 530],
    title: "Glossy brunette",
    caption: "Real hair, real results and the hands behind them 🤎",
    alt: "Glossy chocolate-brown waves with soft caramel ribbons, seen from behind",
  },
  {
    image: "summer-tones",
    widths: [480, 630],
    title: "Summer tones",
    caption: "Summer tones are really starting strong this year",
    alt: "A client with a bright, creamy blonde with a soft root, being styled",
    position: "50% 30%",
  },
  {
    image: "balayage-back",
    widths: [480, 800, 1200],
    title: "Dark, with light",
    caption: "New colour 🫶🏽",
    alt: "Dark brown hair with caramel pieces, curled into loose waves, from behind",
  },
  {
    image: "volume",
    widths: [480, 720],
    title: "Bouncy volume",
    caption: "If it makes you happy, just do whatever you like, girl 💅",
    alt: "Big, bouncy mushroom-brown layers being lifted at the crown",
    position: "50% 35%",
  },
  {
    image: "freedom-waves",
    widths: [480, 720],
    title: "Soft waves",
    caption: "Oh my ❄️☁️",
    alt: "Long brunette hair with soft blonde ribbons in loose waves, by a window in the salon",
  },
];

// ------------------------------------------------------- things I'll always do
// From her carousel "Things I'll ALWAYS do as your hairdresser… even if you
// don't want to hear them" (verbatim, one card each).
export const ALWAYS = [
  {
    lead: "I will educate you",
    rest: "on what's realistically achievable, how we'll get there and how to care for your hair afterwards.",
    image: "nano-after",
    widths: [480, 720],
    alt: "Long, sleek, smooth hair with soft blonde pieces after Nanoplasty",
  },
  {
    lead: "I will never compromise",
    rest: "the health of your hair just to achieve a lighter result in one appointment.",
    image: "balayage-front",
    widths: [480, 800, 1200],
    alt: "A client looking down at glossy, dark brown waves with caramel pieces",
  },
  {
    lead: "I specialise in dark, thick hair,",
    rest: "so I understand that beautiful transformations can take time, patience and sometimes more than one session.",
    image: "hair-gloss",
    widths: [480, 800],
    alt: "Thick, glossy, dark chocolate-brown hair falling straight down the back",
  },
  {
    lead: "And yes… I will absolutely hype you up",
    rest: "when we turn that chair around, because seeing you feel beautiful is my favourite part.",
    image: "hype",
    widths: [480, 720],
    alt: "A client laughing as she sees her new glossy brunette blow-dry, her stylist smiling behind her",
  },
] as const;

// ------------------------------------------------------------ nanoplasty
// From her own explainer carousel and care guide (Nanoplasty posts, 2026).
export const NANO = {
  what: "Nanoplasty uses nano-technology with collagen, amino acids and proteins to penetrate deep into the hair fibre for maximum smoothing and long-lasting restructuring.",
  layers: [
    { name: "Cuticle", where: "Outer layer", text: "Nano-particles penetrate through the cuticle scales." },
    { name: "Cortex", where: "Middle layer", text: "They reach deep into the cortex, strengthening and nourishing the hair structure." },
    { name: "Medulla", where: "Inner layer", text: "They penetrate to the core, repairing and reorganising from within." },
  ],
  steps: [
    { n: "01", name: "Wash", text: "Cleanses deeply and opens the cuticle, removing oils, silicones and buildup so the hair is ready to absorb." },
    { n: "02", name: "Blow dry", text: "Heat activates the nano-particles in the solution and opens the hair structure, so they reach deep into the cortex." },
    { n: "03", name: "Flat iron", text: "High heat (180–230°C) seals the cuticle and locks the treatment in for long-lasting results." },
  ],
  timeline: [
    { when: "Day 0", text: "Your Nanoplasty treatment" },
    { when: "1 month", text: "Hair looks smooth, frizz-free & healthy" },
    { when: "2–3 months", text: "Results continue to last with proper care" },
    { when: "4–6 months", text: "Results gradually fade naturally" },
    { when: "Touch-up", text: "Book your next one to keep your best results" },
  ],
  care: [
    { title: "Sulfate-free shampoo", text: "Keeps hair smooth, shiny and frizz-free for longer." },
    { title: "Wash after 24 hours", text: "No extended wait needed." },
    { title: "Heat-styling safe", text: "Blow dry, flat iron or curl — it makes hair more resistant to heat." },
    { title: "No special routine", text: "Just wash, dry and go." },
    { title: "Grows out naturally", text: "It fades gradually — no harsh lines or breakage." },
    { title: "Safe to colour & bleach", text: "Enjoy your favourite looks worry-free." },
  ],
  result: "Straighter, smoother, healthier hair that lasts.",
} as const;

// ------------------------------------------------------------ her story
export const STORY = [
  { when: "Trained", text: "Graduated from Box Hill Institute" },
  { when: "Years in", text: "Glen Waverley and Doncaster, building a loyal clientele" },
  { when: "Nanoplasty", text: "Special training — “knowledge is key 🔑”" },
  { when: "1 March 2025", text: "Her own permanent suite in Oakleigh" },
] as const;
