/**
 * ALL business content for The Beauty L'atelier lives in this file.
 * Change a price, the phone number or the re-opening date here and the
 * whole site follows — no component holds a fact of its own.
 *
 * Every fact comes from the business's own Instagram, @thebeautyatelierrr__
 * (read 6 October 2026). Sources and open questions: BRAND-BRIEF.md.
 *
 * TODO: confirm with Helena before launch —
 *   - phone and email (published in her 5 Sep 2026 launch post, not a bio)
 *   - the exact re-opening date (her bio says Nov–Dec)
 *   - prices for BIAB and upper-lip wax/thread (not on her price list)
 *   - what is inside each "package"
 */

export const SITE = {
  name: "The Beauty L'atelier",
  studio: "Atelier Helena",
  founder: "Helena",
  established: "2024",
  credential: "Certified Beautician",
  suburb: "Doonside",
  city: "Sydney",
  state: "NSW",
  reopening: "November – December",
  reopeningShort: "Nov – Dec",
  instagramHandle: "thebeautyatelierrr__",
  instagramUrl: "https://www.instagram.com/thebeautyatelierrr__/",
  // Opens a DM thread directly in the Instagram app (or web).
  instagramDm: "https://ig.me/m/thebeautyatelierrr__",
  // TODO: confirm — from her 5 Sep 2026 launch post.
  phoneDisplay: "0413 348 497",
  phoneE164: "+61413348497",
  // TODO: confirm — from her 5 Sep 2026 launch post.
  email: "atelierhelena24@gmail.com",
  // TODO: replace with the real domain once it's live; used for canonical and social cards.
  url: "https://the-beauty-latelier.lovable.app",
  pillars: ["Beauty", "Care", "Confidence"],
} as const;

export const CHAPTERS = [
  { id: "atelier", numeral: "I", label: "The atelier" },
  { id: "menu", numeral: "II", label: "The menu" },
  { id: "nail-art", numeral: "III", label: "Nail art" },
  { id: "helena", numeral: "IV", label: "Helena" },
  { id: "promise", numeral: "V", label: "The promise" },
  { id: "book", numeral: "VI", label: "Book" },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]["id"];

// ---------------------------------------------------------------- the menu
// Transcribed from her "Price List" post (19 Sep 2026). A "+" on her list means
// "from"; `from: true` carries that through. BIAB and upper-lip wax/thread come
// from her own replies under the post and had no price, so they're on enquiry.
// The one-line notes describe what each treatment is in general terms only.

export type Service = {
  id: string;
  name: string;
  price: number | null;
  from?: boolean;
  note?: string;
};

export type Category = {
  id: string;
  title: string;
  short: string;
  kicker: string;
  blurb: string;
  image: { name: string; widths: number[]; alt: string; credit?: string; position?: string };
  services: Service[];
};

export const CATEGORIES: Category[] = [
  {
    id: "nails",
    title: "Nails",
    short: "Nails",
    kicker: "Timeless, perfected down to every detail",
    blurb: "Sets built for your hands — from a clean shellac to sculpted Gel-X with art.",
    image: {
      name: "nails-gelx-tier4",
      widths: [480, 800, 1200],
      alt: "Helena's Gel-X almond set with gold bow charms, tortoiseshell and burgundy accents",
      position: "50% 65%",
    },
    services: [
      { id: "gelx", name: "Gel-X set", price: 60, note: "Soft-gel extensions, light and natural-feeling" },
      { id: "acrylic", name: "Acrylic set", price: 65, note: "Sculpted, strong and shaped to you" },
      { id: "sns", name: "SNS set", price: 50, note: "Dip-powder colour that lasts" },
      { id: "biab", name: "BIAB", price: null, note: "Builder gel to strengthen natural nails" },
      { id: "shellac", name: "Shellac nail set", price: 35, note: "Gel polish on your natural nails" },
      { id: "pedicure", name: "Pedicure", price: 35 },
      { id: "manipedi", name: "Mani pedi set", price: 75, note: "Hands and feet, together" },
    ],
  },
  {
    id: "lashes-brows",
    title: "Lashes & Brows",
    short: "Lash & Brow",
    kicker: "Frame the face, lift the look",
    blurb: "Lifted lashes and defined brows that work with what you already have.",
    image: {
      name: "lashes",
      widths: [480, 800, 1200, 1600],
      alt: "A lash treatment in progress, tweezers lifting the lashes",
      credit: "Photo: Unsplash",
      position: "50% 40%",
    },
    services: [
      { id: "lashlift", name: "Lash lift", price: 70, note: "Lifts and curls your natural lashes" },
      { id: "lashbotox", name: "Lash botox", price: 55, note: "Conditioning for glossy, fuller-looking lashes" },
      { id: "lashpackage", name: "Lash package", price: 85 },
      { id: "browshape", name: "Brows shaping", price: 35, note: "Shaped to suit your face" },
      { id: "browtint", name: "Brows tinting", price: 35, note: "Soft colour that defines" },
      { id: "browpackage", name: "Brows package", price: 65 },
      { id: "lip", name: "Upper lip waxing / threading", price: null },
    ],
  },
  {
    id: "skin",
    title: "Facial & Skin",
    short: "Skin",
    kicker: "A moment for yourself",
    blurb: "Facials and treatments for a clear, calm, glowing complexion.",
    image: {
      name: "skin",
      widths: [480, 800, 1200, 1600],
      alt: "A facial treatment being brushed onto the skin",
      credit: "Photo: Unsplash",
      position: "50% 45%",
    },
    services: [
      { id: "basicfacial", name: "Basic facial", price: 60, from: true, note: "Cleanse, refresh and glow" },
      { id: "acnefacial", name: "Acne facial", price: 69, from: true, note: "Focused on congestion and breakouts" },
      { id: "antiaging", name: "Anti-aging facial", price: 80, from: true, note: "Focused on firmness and fine lines" },
      { id: "hydrafacial", name: "Hydra facial", price: 169, from: true, note: "Cleanse, exfoliate and hydrate in one" },
      { id: "peel", name: "Chemical peel", price: 80, from: true, note: "Resurfacing for brighter, smoother skin" },
      { id: "claymask", name: "Clay mask", price: 30, from: true, note: "A purifying clay treatment" },
    ],
  },
  {
    id: "hair",
    title: "Hair",
    short: "Hair",
    kicker: "Healthy, glossy, finished",
    blurb: "Cuts, blow-outs and treatments for hair that feels as good as it looks.",
    image: {
      name: "hair",
      widths: [480, 800, 1200, 1600],
      alt: "Long, glossy brunette waves against soft white linen",
      credit: "Photo: Unsplash",
      position: "60% 50%",
    },
    services: [
      { id: "haircut", name: "Women's haircut", price: 40, from: true },
      { id: "blowout", name: "Blow out", price: 40, note: "Smooth, bouncy and finished" },
      { id: "hairtreatment", name: "Hair treatments", price: 70, from: true, note: "Restoring care for tired lengths" },
      { id: "keratin", name: "Keratin treatment", price: 150, from: true, note: "Smooths frizz for sleek, manageable hair" },
      { id: "hairpackage", name: "Full package", price: 180 },
    ],
  },
];

export const NAIL_ART_TIERS: Service[] = [
  { id: "tier1", name: "Tier 1", price: 15 },
  { id: "tier2", name: "Tier 2", price: 25 },
  { id: "tier3", name: "Tier 3", price: 55 },
  { id: "tier4", name: "Tier 4", price: 80 },
  { id: "tier5", name: "Tier 5", price: 115 },
];

const ALL: Service[] = [...CATEGORIES.flatMap((c) => c.services), ...NAIL_ART_TIERS.map((t) => ({ ...t, name: `Nail art — ${t.name}` }))];

export const SERVICE_BY_ID: Record<string, Service> = Object.fromEntries(ALL.map((s) => [s.id, s]));

export function formatPrice(s: Pick<Service, "price" | "from">): string {
  if (s.price === null) return "On enquiry";
  return `${s.from ? "from " : ""}$${s.price}`;
}
