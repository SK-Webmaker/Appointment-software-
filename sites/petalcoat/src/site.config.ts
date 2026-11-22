/**
 * ALL content for Petalcoat lives in this file. Change a line here and the
 * whole site follows — no component holds a fact of its own.
 *
 * Petalcoat is a CONCEPT business: the name, artists, prices, hours and phone
 * number are made up to show what a nail studio website can do. The phone
 * number is from the range the ACMA sets aside for fiction, so it can never
 * ring a real person. Photos: Unsplash (see public/images/CREDITS.md).
 */

export const SITE = {
  name: "Petalcoat",
  shortName: "Petalcoat",
  role: "Nail studio",
  area: "Surry Hills",
  city: "Sydney",
  tagline: "Ten tiny canvases, painted properly.",
  phone: "(02) 5550 0187",
  phoneHref: "tel:+61255500187",
  email: "hello@petalcoat.example",
  est: "2021",
  from: "$45",
  // TODO: replace with the real domain once it's live; used for canonical and social cards.
  url: "https://petalcoat.lovable.app",
  concept:
    "Petalcoat is a concept business, made to show what a nail studio website can do. No bookings are taken.",
  refPrefix: "PC",
} as const;

/** Opening hours by weekday (0 = Sunday), 24-hour. `null` = closed. */
export const OPEN: Record<number, readonly [number, number] | null> = {
  0: [10, 16],
  1: null,
  2: [10, 18],
  3: [10, 18],
  4: [10, 20],
  5: [10, 20],
  6: [9, 17],
};

export const HOURS = [
  { days: "Monday", time: "Closed" },
  { days: "Tue · Wed", time: "10 am – 6 pm" },
  { days: "Thu · Fri", time: "10 am – 8 pm" },
  { days: "Saturday", time: "9 am – 5 pm" },
  { days: "Sunday", time: "10 am – 4 pm" },
] as const;

export const POLICY =
  "Need to move it? Reschedule or cancel up to 24 hours before — no fee. Running late? Text us and we'll do what we can.";

export const CHAPTERS = [
  { id: "shades", numeral: "I", label: "The shade bar" },
  { id: "sets", numeral: "II", label: "The sets" },
  { id: "care", numeral: "III", label: "The care" },
  { id: "menu", numeral: "IV", label: "Menu" },
  { id: "book", numeral: "V", label: "Book" },
] as const;

export type ChapterId = (typeof CHAPTERS)[number]["id"];

// ------------------------------------------------------------ services
export type Service = { name: string; price: number; mins: number; note: string };

export const MENU: { group: string; items: Service[] }[] = [
  {
    group: "Hands",
    items: [
      {
        name: "Gel Manicure",
        price: 60,
        mins: 60,
        note: "Shape, cuticle care and long-wear gel colour. Lasts 2–3 weeks.",
      },
      {
        name: "BIAB Overlay",
        price: 75,
        mins: 75,
        note: "Builder gel over your natural nails — strength without length.",
      },
      {
        name: "Gel-X Extensions",
        price: 95,
        mins: 90,
        note: "Soft-gel tips in any shape and length, colour included.",
      },
      {
        name: "Classic Manicure",
        price: 45,
        mins: 45,
        note: "Shape, cuticle care, hand massage and regular polish.",
      },
    ],
  },
  {
    group: "Feet",
    items: [
      {
        name: "Gel Pedicure",
        price: 70,
        mins: 60,
        note: "Soak, shape, cuticle care and gel colour.",
      },
      {
        name: "Spa Pedicure",
        price: 85,
        mins: 75,
        note: "Everything in the gel pedicure, plus scrub, mask and a long massage.",
      },
    ],
  },
  {
    group: "Extras",
    items: [
      {
        name: "Nail Art",
        price: 20,
        mins: 20,
        note: "Hand-painted detail on up to four nails. Full sets quoted in the chair.",
      },
      {
        name: "Gel Removal",
        price: 20,
        mins: 30,
        note: "Gentle soak-off and a nourishing oil. Free with a new set.",
      },
    ],
  },
];

export const SERVICES = MENU.flatMap((g) => g.items);
export const SERVICE_NAMES = SERVICES.map((s) => s.name);
export const serviceOf = (name: string) => SERVICES.find((s) => s.name === name);
export const priceOf = (name: string) => serviceOf(name)?.price;

export const QUICK = [
  "Gel Manicure",
  "BIAB Overlay",
  "Gel-X Extensions",
  "Gel Pedicure",
  "Spa Pedicure",
  "Classic Manicure",
] as const;

// ------------------------------------------------------------ the artists
export type StaffId = "mai" | "sofia" | "ines";
export const STAFF: { id: StaffId; name: string; title: string; known: string }[] = [
  {
    id: "mai",
    name: "Mai",
    title: "Structure & extensions",
    known: "Gel-X and builder gel that never lifts.",
  },
  { id: "sofia", name: "Sofia", title: "Nail art", known: "Chrome, foils and fine-line detail." },
  {
    id: "ines",
    name: "Inès",
    title: "Natural nail care",
    known: "BIAB, repair and the perfect bare nail.",
  },
];
export const staffName = (id: string) =>
  id === "any" ? "First available" : (STAFF.find((b) => b.id === id)?.name ?? "");

// ------------------------------------------------------------ the shade bar (chapter I)
export type Shade = { name: string; hex: string; family: string };
export const SHADES: Shade[] = [
  { name: "Oat Milk", hex: "#e8d4c6", family: "Nudes" },
  { name: "Bare Petal", hex: "#e3b3aa", family: "Nudes" },
  { name: "Latte", hex: "#c39883", family: "Nudes" },
  { name: "Cocoa", hex: "#7a4b3a", family: "Nudes" },
  { name: "Ballet", hex: "#f2c4cd", family: "Pinks" },
  { name: "Peony", hex: "#e2849e", family: "Pinks" },
  { name: "Fuchsia", hex: "#cf2f78", family: "Pinks" },
  { name: "Cherry Lacquer", hex: "#9e1c3a", family: "Reds" },
  { name: "Classic Red", hex: "#c41f2d", family: "Reds" },
  { name: "Merlot", hex: "#5a1423", family: "Reds" },
  { name: "Lilac", hex: "#c6b4e4", family: "Pastels" },
  { name: "Sage", hex: "#a8bea2", family: "Pastels" },
  { name: "Butter", hex: "#f0dd98", family: "Pastels" },
  { name: "Midnight", hex: "#1f2443", family: "Darks" },
  { name: "Espresso", hex: "#3a2622", family: "Darks" },
  { name: "Ink", hex: "#141316", family: "Darks" },
];
export const shadeOf = (name: string) => SHADES.find((s) => s.name === name);

export const FINISHES = ["Gloss", "Matte", "Chrome", "French tip"] as const;
export type Finish = (typeof FINISHES)[number];
export const SHAPES = ["Almond", "Oval", "Square", "Coffin", "Stiletto"] as const;
export type Shape = (typeof SHAPES)[number];
export const LENGTHS = ["Short", "Medium", "Long"] as const;
export type Length = (typeof LENGTHS)[number];

// ------------------------------------------------------------ the sets (chapter II)
export const SETS = [
  {
    image: "white",
    title: "Milk bath",
    caption: "Milky white gel on a soft almond",
    alt: "Two hands with milky white almond nails against a white ruffled sleeve",
    shade: "Oat Milk",
    finish: "Gloss",
    shape: "Almond",
    position: "50% 45%",
  },
  {
    image: "navy",
    title: "Navy & gold",
    caption: "Midnight with hand-laid gold foil",
    alt: "Navy and gold foil nails on hands in a cream knit",
    shade: "Midnight",
    finish: "Gloss",
    shape: "Oval",
    position: "50% 45%",
  },
  {
    image: "chrome",
    title: "Rose chrome",
    caption: "Pink chrome stilettos, sculpted 3D art",
    alt: "Long stiletto nails in rose chrome with raised silver and black art",
    shade: "Peony",
    finish: "Chrome",
    shape: "Stiletto",
    position: "50% 50%",
  },
  {
    image: "redfrench",
    title: "Red french",
    caption: "A cherry tip on a sheer nude",
    alt: "Hands with rings and long nails with red french tips on a wooden table",
    shade: "Cherry Lacquer",
    finish: "French tip",
    shape: "Almond",
    position: "50% 40%",
  },
  {
    image: "lilac",
    title: "Lilac chrome",
    caption: "Lavender pearl, a whisper of chrome",
    alt: "A hand with almond nails in a lilac chrome finish",
    shade: "Lilac",
    finish: "Chrome",
    shape: "Almond",
    position: "50% 45%",
  },
  {
    image: "ombre",
    landscape: true,
    title: "Cherry ombré",
    caption: "Cherry fading into sheer, with swirls",
    alt: "Hands with long pointed nails in a cherry-to-clear ombré with swirl art",
    shade: "Cherry Lacquer",
    finish: "Gloss",
    shape: "Stiletto",
    position: "50% 50%",
  },
  {
    image: "silver",
    landscape: true,
    title: "Silver frost",
    caption: "Smoky silver with frosted detail",
    alt: "Hands with silver and grey art nails resting on white fur",
    shade: "Ink",
    finish: "Chrome",
    shape: "Almond",
    position: "50% 50%",
  },
  {
    image: "pink",
    title: "Bubblegum",
    caption: "Sheer pink on a short oval",
    alt: "Fingers with short pink nails holding a pink lollipop",
    shade: "Ballet",
    finish: "Gloss",
    shape: "Oval",
    position: "50% 40%",
  },
] as const;

// ------------------------------------------------------------ the care (chapter III)
export const CARE = [
  {
    title: "Clean, every time",
    text: "Every metal tool goes through a hospital-grade autoclave between clients; files and buffers are single-use and go home with you.",
    image: "brush",
    widths: [480, 800, 1200, 1600],
    position: "50% 40%",
    alt: "A nail artist in black gloves paints a client's nail with a fine brush",
  },
  {
    title: "Your shade, matched",
    text: "Two hundred gel colours on swatch sticks. Bring a photo, hold them up to your skin in daylight — we'll find it.",
    image: "swatch",
    widths: [480, 800, 1200, 1600],
    position: "50% 50%",
    alt: "A colour chart of painted nail swatches beside a wooden brush",
  },
  {
    title: "Gel that lasts",
    text: "Thin, even coats cured properly. Three weeks without a chip — and if one lifts in the first five days, we fix it free.",
    image: "gel",
    widths: [480, 800, 1200, 1600],
    position: "50% 40%",
    alt: "A gloved hand dips a brush into a pot of nude builder gel",
  },
  {
    title: "Gentle off, too",
    text: "Removal is a soak, never a drill to the nail plate. It's free with your next set, and your natural nails thank you.",
    image: "nude",
    widths: [480, 800, 1200, 1600],
    position: "50% 45%",
    alt: "Two hands with glossy nude almond nails and gold rings",
  },
] as const;

// ------------------------------------------------------------ FAQ
export const FAQ = [
  {
    q: "Can I bring a photo of what I want?",
    a: "Yes, please. Attach a note when you book or show us in the chair — complex art may need extra time, and we'll tell you before we start.",
  },
  {
    q: "How long does gel last?",
    a: "Two to three weeks on hands, four or more on toes. If it lifts in the first five days, come back and we'll fix it free.",
  },
  {
    q: "Do you remove other salons' gel or acrylic?",
    a: "Yes — book Gel Removal with your new set. Acrylic removal takes a little longer; add a note.",
  },
  { q: "What if I need to move my booking?", a: POLICY },
  { q: "How do I pay?", a: "Card, phone or cash after your appointment. No deposits." },
] as const;

export const MARQUEE = [
  "Gel manicures",
  "BIAB",
  "Gel-X",
  "Chrome",
  "French tips",
  "Nail art",
  "Spa pedicures",
] as const;
