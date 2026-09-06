// The screens that sell Kairo, shot at the exact 6.9" iPhone size Apple asks
// for (440 x 956 logical at 3x = 1320 x 2868).
//
// Every one is the real product against a real database. Nothing is a mockup,
// which is both the honest thing to do and the reason a reviewer comparing the
// screenshots against the app will find they match.
const PHONE = { w: 440, h: 956, dpr: 3 };
const BUSY = '2026-09-09';

// Past the page header, so the screen itself fills the frame.
const past = (y) => `window.scrollTo(0, ${y}); (() => { const s=[...document.querySelectorAll('*')].find(e => e.scrollHeight > e.clientHeight + 40 && e.clientHeight > 200 && e !== document.body); if (s) s.scrollTop = 120; })()`;

export default async function ({ shoot, BASE }) {
  await shoot('calendar', `${BASE}/#/calendar?date=${BUSY}`, { ...PHONE, wait: 3200, before: past(520) });
  await shoot('dashboard', `${BASE}/#/dashboard`, { ...PHONE, wait: 3000 });
  await shoot('clients', `${BASE}/#/clients`, { ...PHONE, wait: 2800, before: past(150) });
  await shoot('booking-page', `${BASE}/book`, { ...PHONE, wait: 2800 });
  await shoot('invoices', `${BASE}/#/invoices`, { ...PHONE, wait: 2800, before: past(150) });
  await shoot('messages', `${BASE}/#/messages`, { ...PHONE, wait: 2800, before: past(150) });
}
