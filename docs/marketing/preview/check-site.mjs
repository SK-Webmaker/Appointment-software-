// Does this business pass the checks in ../OUTREACH.md ("Who gets one")?
// Fetches the home page plus any price, contact and booking pages it links
// to, and reports what a person would look for. It decides nothing: the
// session reads the report and the pages.
//
//   node docs/marketing/preview/check-site.mjs https://example.com.au [more urls…]
//
// Prints one JSON object per site. Nothing is saved.
const BOOKING_HINTS = [
  // Any online booking at all means this business is not a fit today.
  'fresha.com', 'gettimely.com', 'timely.com', 'square.site', 'squareup.com/appointments', 'app.squareup.com/appointments',
  'setmore.com', 'simplybook', 'acuityscheduling', 'vagaro.com', 'booksy.com', 'phorest', 'kitomba', 'shortcutssoftware',
  'mindbodyonline', 'bookwell.com.au', 'salonist', 'zenoti', 'calendly.com', 'bookedin', 'glossgenius', 'schedulicity',
  'styleseat', 'treatwell', 'nookal', 'cliniko', 'halaxy', 'hotdoc', 'appointfix', 'timetap', 'bookeo', 'youcanbook.me',
  'picktime', 'zoho.com/bookings', 'wix.com/booking', 'book-online', 'booking-calendar', 'wp-content/plugins/bookly',
  'amelia', 'latepoint',
];
const BOOK_ONLINE_TEXT = /\b(book (now )?online|online booking|book an appointment online|book your appointment online)\b/i;
const HOW = [
  ['text', /\b(text|sms)\b[^.\n]{0,40}\b(book|appointment)|\b(book|appointment)[^.\n]{0,40}\b(text|sms)\b/i],
  ['DM', /\b(dm|direct message|message us)\b[^.\n]{0,40}\b(book|appointment)|\bdm to book\b/i],
  ['phone', /\b(call|phone|ring)\b[^.\n]{0,40}\b(book|appointment)|\b(book|appointment)[^.\n]{0,40}\b(call|phone|ring)\b/i],
  ['email', /\bemail\b[^.\n]{0,30}\b(book|appointment)/i],
];
const NO_MARKETING = /no (unsolicited|marketing|spam|sales) (emails?|calls?|contact)|do not (send|contact)[^.]{0,40}(marketing|solicit)/i;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const text = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#64;|&commat;/g, '@').replace(/\s+/g, ' ');

async function get(url) {
  try {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; Kairo site check)' } });
    if (!r.ok) return { url, status: r.status, html: '' };
    return { url: r.url, status: r.status, html: (await r.text()).slice(0, 1_500_000) };
  } catch (e) {
    return { url, status: 0, html: '', error: e.message };
  }
}

async function check(home) {
  const first = await get(home);
  const pages = [first];
  if (first.html) {
    const base = new URL(first.url);
    const links = [...first.html.matchAll(/href=["']([^"'#]+)["']/gi)].map((m) => { try { return new URL(m[1], base).href; } catch { return null; } })
      .filter((u) => u && new URL(u).host === base.host && /price|menu|service|treatment|contact|book|about/i.test(u));
    for (const u of [...new Set(links)].slice(0, 6)) pages.push(await get(u));
  }
  const html = pages.map((p) => p.html).join('\n');
  const all = text(html);
  const emails = [...new Set([...html.matchAll(/mailto:([^"'?>\s]+)/gi)].map((m) => decodeURIComponent(m[1]).toLowerCase())
    .concat((all.match(EMAIL) || []).map((e) => e.toLowerCase())))]
    .filter((e) => !/\.(png|jpe?g|gif|webp|svg)$/.test(e) && !/example\.|sentry|wixpress|godaddy|domain\.com|yourdomain/.test(e));
  const bookingLinks = BOOKING_HINTS.filter((h) => html.toLowerCase().includes(h));
  const years = (all.match(/\b20(2[4-9]|3\d)\b/g) || []).map(Number);
  return {
    site: first.url,
    status: first.status,
    pages_read: pages.filter((p) => p.html).length,
    emails,
    online_booking_signs: bookingLinks.concat(BOOK_ONLINE_TEXT.test(all) ? ['"book online" text'] : []),
    books_by: HOW.filter(([, re]) => re.test(all)).map(([k]) => k),
    prices_seen: (all.match(/\$\s?\d{2,3}(\.\d{2})?/g) || []).length,
    latest_year_mentioned: years.length ? Math.max(...years) : null,
    asks_no_marketing: NO_MARKETING.test(all),
    australian: /\b(VIC|NSW|QLD|SA|WA|TAS|ACT|NT)\b\s*\d{4}|\+61|\(0[2378]\)|\b04\d{2}\s?\d{3}\s?\d{3}\b|Australia/.test(all),
  };
}

for (const u of process.argv.slice(2)) console.log(JSON.stringify(await check(u)));
