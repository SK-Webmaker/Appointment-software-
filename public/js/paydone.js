// After paying at the counter by card: a page in the salon's own colours that
// says, plainly, whether it worked. Shown on the client's phone or the salon's,
// so it carries the salon's name and logo rather than Kairo's or Stripe's.
import { resolveScheme, applyScheme } from './schemes.js';

const $ = (id) => document.getElementById(id);
const cancelled = new URLSearchParams(location.search).get('cancelled');
const ICON = {
  ok: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  no: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 8v5M12 16.5v.5"/><circle cx="12" cy="12" r="9.5"/></svg>',
};

$('card').className = `card ${cancelled ? 'no' : 'ok'}`;
$('badge').innerHTML = cancelled ? ICON.no : ICON.ok;
if (cancelled) {
  $('title').textContent = 'Payment not completed';
  $('msg').textContent = 'No charge was made. Hand the phone back to try again, or pay another way.';
}

fetch('/api/public/brand').then((r) => (r.ok ? r.json() : null)).then((b) => {
  if (!b) return;
  applyScheme(resolveScheme(b));
  if (/^#[0-9a-f]{6}$/i.test(b.accent || '')) document.documentElement.style.setProperty('--accent', b.accent);
  if (b.business_name) {
    $('biz').textContent = b.business_name;
    document.title = `${cancelled ? 'Payment not completed' : 'Paid'} · ${b.business_name}`;
    if (!cancelled) $('title').textContent = `Thank you for visiting ${b.business_name}`;
  }
  if (b.logo) {
    const img = new Image();
    img.alt = b.business_name || '';
    img.onload = () => $('logo').replaceChildren(img);
    img.src = '/api/public/logo';
  }
}).catch(() => { /* the plain page still says whether it worked */ });
