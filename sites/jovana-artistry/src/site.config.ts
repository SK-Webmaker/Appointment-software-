/**
 * ALL business content for Jovana Artistry lives in this file. Change a line
 * here and the whole site follows — no component holds a fact of its own.
 *
 * Every fact and quote comes from her own channels (read 18 November 2026):
 * her Instagram bio and post captions (@jovanaartistry) and her public Square
 * booking page (the link in her bio). Sources: BRAND-BRIEF.md.
 *
 * Deliberately left out: the studio's street address and her full legal name
 * (both appear only inside the booking system — her bio says "Liverpool
 * 2170" and "Jovana").
 *
 * TODO: confirm with Jovana before launch —
 *   - that this demo may use her portfolio photos
 *   - whether deposits / Afterpay should be mentioned (both are set up in Square)
 */

export const SITE = {
  name: "Jovana Artistry",
  shortName: "Jovana",
  role: "Sydney makeup, brow & spray tan artist",
  // Her bio, verbatim apart from punctuation.
  bio: "Sydney Makeup Artist & Brow Specialist — Occasions · Formal · Bridal · Brows · Spray Tans",
  area: "Liverpool 2170",
  city: "Sydney",
  instagramHandle: "jovanaartistry",
  instagramUrl: "https://www.instagram.com/jovanaartistry/",
  // Opens a DM thread directly in the Instagram app (or web). Her bio: "Mobile bookings via DM".
  instagramDm: "https://ig.me/m/jovanaartistry",
  // Her bio: "In studio bookings ↓" — the Square link in her bio.
  bookingUrl: "https://www.squareup.com/appointments/book/LQ94A6JB3NB9A",
  from: "$20",
  // TODO: replace with the real domain once it's live; used for canonical and social cards.
  url: "https://jovana-artistry.lovable.app",
} as const;

// In-studio booking hours, as her Square booking page offers them.
export const HOURS = [
  { days: "Monday – Friday", time: "4:30 – 7:30 pm" },
  { days: "Saturday & Sunday", time: "6 am – 5 pm" },
] as const;

// Her Square booking page, verbatim.
export const POLICY = "Please reschedule or cancel at least 2 days before the beginning of your appointment.";

export const CHAPTERS = [
  { id: "glam", numeral: "I", label: "The glam" },
  { id: "brows", numeral: "II", label: "Brows" },
  { id: "tan", numeral: "III", label: "Spray tans" },
  { id: "bridal", numeral: "IV", label: "Bridal" },
  { id: "menu", numeral: "V", label: "Prices" },
  { id: "book", numeral: "VI", label: "Book" },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]["id"];

// ------------------------------------------------------------ the glam
// Her looks, each with her own caption.
export const LOOKS = [
  { image: "babydoll-side", widths: [480, 800, 1200, 1600], title: "Babydoll glam", caption: "Babydoll glam of my dreams 💗🎀", alt: "Babydoll glam: soft pink blush, winged liner and a voluminous half-up do" },
  { image: "bridal", widths: [480, 800, 1080], title: "Enhanced bridal glam", caption: "Obsessed with this enhanced bridal glam 🤍", alt: "Enhanced bridal glam with lifted liner, pink cheeks and a sleek bun" },
  { image: "smokey", widths: [480, 800, 1200, 1600], title: "Smokey eye", caption: "Smokey eye with a full coverage base 🤌✨", alt: "Smokey eye with a full coverage base and nude lips" },
  { image: "doll", widths: [480, 800, 1080], title: "A literal doll", caption: "A literal DOLL 🎀", alt: "Bronzed glam with soft lashes and a pink lip" },
  { image: "new-mua", widths: [480, 800, 1080], title: "Bronzed glam", caption: "POV: you just found your new MUA 🤍🔥", alt: "Bronzed glam with warm eyes and long dark hair" },
] as const;

// ------------------------------------------------------------ brows
// Her Square menu, verbatim (includes + what each creates).
export const BROWS = [
  {
    name: "HD Brows",
    price: 40,
    time: "1 hr 20 min",
    creates: "Defined, fuller brows with soft skin stain + long-lasting colour",
    includes: ["Full consultation", "Custom brow mapping", "Hybrid dye application", "Brow shaping (wax + tidy)", "Styling + finishing"],
  },
  {
    name: "HD Brow Lamination",
    price: 65,
    time: "1 hr 30 min",
    creates: "Lifted, fuller, structured brows that still look soft and natural",
    includes: ["Full consultation", "Custom brow mapping", "Signature lamination technique", "Brow shaping (wax + tidy)", "Styling + finishing"],
  },
  {
    name: "Brow Lamination",
    price: 50,
    time: "1 hr",
    creates: "Fuller, defined brows with a natural and polished look — lasts 4–6 weeks with proper maintenance",
    includes: ["Brow waxing included"],
  },
  {
    name: "Brow Wax",
    price: 20,
    time: "40 min",
    creates: "Clean, natural, face-framing brows",
    includes: ["Consultation", "Precise shaping", "Wax + tidy", "Styling"],
  },
] as const;

// ------------------------------------------------------------ the full menu
type MenuItem = { name: string; price: number; time: string; note: string };
export const MENU: { group: string; items: MenuItem[] }[] = [
  {
    group: "Makeup — in studio",
    items: [
      { name: "Full Glam", price: 90, time: "1 hr 30 min", note: "Smokey eyes, glitter eyes, winged liner, full coverage base with cream contour and complimentary lashes. Excludes cut crease." },
      { name: "Soft Glam", price: 80, time: "1 hr 30 min", note: "Soft eyeshadows, winged eyeliner and complimentary lashes, personalised to suit your face. Excludes heavy glam and cut crease." },
    ],
  },
  {
    group: "Brows",
    items: BROWS.map((b) => ({ name: b.name, price: b.price, time: b.time, note: b.creates })),
  },
  {
    group: "Spray tan",
    items: [{ name: "Spray Tan", price: 40, time: "30 min", note: "Spray tans now available 🎀✨" }],
  },
  {
    group: "Bridal",
    items: [
      { name: "Bride", price: 150, time: "1 hr 30 min", note: "" },
      { name: "Bridesmaid", price: 100, time: "1 hr 30 min", note: "" },
      { name: "Mother of the Bride", price: 100, time: "1 hr 30 min", note: "" },
      { name: "Mother of the Groom", price: 100, time: "1 hr 30 min", note: "" },
      { name: "Travel fee", price: 120, time: "", note: "" },
    ],
  },
];

export const SERVICE_NAMES = MENU.flatMap((g) => g.items.map((i) => i.name)).filter((n) => n !== "Travel fee");
export type Service = string;
export const priceOf = (name: string) => MENU.flatMap((g) => g.items).find((i) => i.name === name)?.price;

// The quick picks in the booking chapter and the sheet.
export const QUICK = ["Full Glam", "Soft Glam", "HD Brows", "HD Brow Lamination", "Spray Tan", "Bride"] as const;

// ------------------------------------------------------------ bridal
export const BRIDAL = {
  // Her caption on the bridal look from her pro course, verbatim (handle kept as she tagged it).
  course: "A flawless bridal full glam found in my 1:1 5 Week Pro course with @dinakhouchabamakeup",
  party: ["Bride · $150", "Bridesmaid · $100", "Mother of the Bride · $100", "Mother of the Groom · $100"],
} as const;

// ------------------------------------------------------------ FAQ (from her bio and booking page)
export const FAQ = [
  { q: "Do you come to me, or do I come to you?", a: "Both. In-studio appointments are in Liverpool 2170 and booked online. For mobile bookings, send me a DM." },
  { q: "Are lashes included?", a: "Yes — Full Glam and Soft Glam both include complimentary lashes." },
  { q: "Can I get a cut crease?", a: "Cut crease makeup isn't included in Full Glam or Soft Glam." },
  { q: "How long does brow lamination last?", a: "4–6 weeks with proper maintenance — and it includes brow waxing." },
  { q: "What if I need to change my booking?", a: POLICY },
] as const;

// Words for the slow band.
export const MARQUEE = ["Occasions", "Formal", "Bridal", "Brows", "Spray tans", "Soft glam", "Full glam"] as const;
