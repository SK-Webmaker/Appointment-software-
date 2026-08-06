// Public cancellation page: a client taps the link in their confirmation or
// reminder message and lands here (token in the URL path). One decision to
// make, stated plainly, with the notice period shown before they commit — and
// a phone number instead of a dead end when they've left it too late.
import { esc, icon, fmtDate, fmtTime } from './ui.js';
import { resolveScheme, applyScheme } from './schemes.js';
import { lockZoom } from './nozoom.js';

const root = document.getElementById('cancel');
const token = decodeURIComponent(location.pathname.replace(/^\/cancel\/?/, ''));

async function getJson(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function applyBrand(brand) {
  if (!brand) return;
  const el = document.documentElement;
  applyScheme(resolveScheme(brand));
  if (brand.font && brand.font !== 'modern') el.dataset.brandFont = brand.font;
  const accent = /^#[0-9a-fA-F]{6}$/.test(brand.accent || '') ? brand.accent : '#38bdf8';
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(accent.slice(i, i + 2), 16));
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  el.style.setProperty('--accent', accent);
  el.style.setProperty('--accent-ink', luminance > 0.56 ? '#0b1220' : '#ffffff');
  el.style.setProperty('--accent-grad', `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 72%, #000))`);
}

/** "12 hours" / "24 hours" / "2 days" — reads naturally mid-sentence. */
const hoursLabel = (h) => (h >= 48 && h % 24 === 0 ? `${h / 24} days` : h === 1 ? '1 hour' : `${h} hours`);

const headHtml = (info) => `
  <div class="cx-head">
    ${info.brand?.logo ? `<img class="brand-logo" src="${esc(info.brand.logo)}" alt="${esc(info.business_name || '')}">` : ''}
    <h1>${esc(info.business_name || 'Your appointment')}</h1>
    ${info.business_phone ? `<div class="sub">${esc(info.business_phone)}</div>` : ''}
  </div>`;

const detailsHtml = (info) => `
  <dl class="cx-details">
    <div class="cx-row"><dt>Service</dt><dd>${esc(info.service_name || '')}</dd></div>
    ${info.staff_name ? `<div class="cx-row"><dt>With</dt><dd>${esc(info.staff_name)}</dd></div>` : ''}
    <div class="cx-row"><dt>When</dt><dd>${esc(fmtDate(info.date))} · ${esc(fmtTime(info.start_min))}</dd></div>
  </dl>`;

const callHtml = (info, lead) => `
  <div class="cx-callout">${lead}${info.business_phone
    ? ` Please call us on <span class="cx-phone">${esc(info.business_phone)}</span> and we'll sort it out.`
    : ' Please get in touch and we\'ll sort it out.'}</div>`;

const poweredHtml = () => '<div class="powered">Powered by <b>Kairo</b></div>';

function shell(info, inner) {
  root.innerHTML = `${headHtml(info)}<div class="cx-card">${inner}</div>${poweredHtml()}`;
}

function renderError(message) {
  root.innerHTML = `
    <div class="cx-card">
      <div class="cx-mark warn">${icon('alert', 26)}</div>
      <h2>This link isn't active</h2>
      <div class="lede">${esc(message)}</div>
    </div>${poweredHtml()}`;
}

/** Already cancelled — by them or by the salon. Same page, honest wording. */
function renderCancelled(info, justNow) {
  const byUs = info.cancelled_by === 'owner';
  shell(info, `
    <div class="cx-mark done">${icon('check', 28)}</div>
    <h2>${justNow ? 'Your appointment is cancelled' : 'This appointment is already cancelled'}</h2>
    <div class="lede">${justNow
      ? 'That\'s done. The time has been released and we\'ve emailed you a confirmation — nothing else to do.'
      : byUs
        ? 'This booking was cancelled by us. If that\'s a surprise, give us a call.'
        : 'You\'ve already cancelled this one, so there\'s nothing left to do.'}</div>
    ${detailsHtml(info)}
    <div class="cx-actions">
      <a class="cx-btn brand" href="/book">${icon('calendar', 16)} Book another time</a>
    </div>
    ${info.business_phone ? `<div class="cx-note">Questions? Call us on <span class="cx-phone">${esc(info.business_phone)}</span>.</div>` : ''}`);
}

function renderTooLate(info) {
  shell(info, `
    <div class="cx-mark warn">${icon('clock', 26)}</div>
    <h2>It's too close to cancel online</h2>
    <div class="lede">Online cancellation closes ${esc(hoursLabel(info.cancel_window_hours))} before your appointment,
      so we have time to offer the slot to someone else.</div>
    ${detailsHtml(info)}
    ${callHtml(info, 'We can still cancel it for you.')}`);
}

function renderPast(info) {
  shell(info, `
    <div class="cx-mark warn">${icon('clock', 26)}</div>
    <h2>This appointment has passed</h2>
    <div class="lede">There's nothing to cancel — this booking was for a time that's already been and gone.</div>
    ${detailsHtml(info)}
    <div class="cx-actions">
      <a class="cx-btn brand" href="/book">${icon('calendar', 16)} Book another time</a>
    </div>`);
}

function renderDisabled(info) {
  shell(info, `
    <div class="cx-mark warn">${icon('alert', 26)}</div>
    <h2>Cancelling online isn't available</h2>
    <div class="lede">We handle changes personally rather than through the website.</div>
    ${detailsHtml(info)}
    ${callHtml(info, 'To cancel or move this appointment:')}`);
}

function renderConfirm(info) {
  shell(info, `
    <h2>Cancel this appointment?</h2>
    <div class="lede">${info.first_name ? `Hi ${esc(info.first_name)} — ` : ''}here's the booking you're about to cancel.
      You won't be charged anything.</div>
    ${detailsHtml(info)}
    <div class="cx-actions">
      <button class="cx-btn danger" id="cx-go">${icon('x', 16)} Yes, cancel it</button>
      <a class="cx-btn quiet" href="/book">Keep it — I'll be there</a>
    </div>
    <div class="cx-note">${info.cancel_window_hours > 0
      ? `Cancelling online is open until ${esc(hoursLabel(info.cancel_window_hours))} before your appointment.`
      : 'You can cancel online any time before your appointment.'}
      ${info.business_phone ? `After that, call us on <span class="cx-phone">${esc(info.business_phone)}</span>.` : ''}</div>`);

  const btn = root.querySelector('#cx-go');
  btn.onclick = async () => {
    btn.disabled = true;
    btn.innerHTML = 'Cancelling…';
    try {
      const out = await getJson('/api/public/cancel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      renderCancelled({ ...info, ...out }, !out.already);
    } catch (err) {
      // Most likely the window closed while the page sat open — re-read the
      // booking so they see the real state rather than a stale form.
      btn.disabled = false;
      btn.innerHTML = `${icon('x', 16)} Yes, cancel it`;
      const note = document.createElement('div');
      note.className = 'cx-callout';
      note.innerHTML = `<b>${esc(err.message)}</b>`;
      root.querySelector('.cx-card').appendChild(note);
    }
  };
}

async function boot() {
  if (!token) { renderError('That link is missing its code — please use the link from your booking message.'); return; }
  let info;
  try {
    info = await getJson(`/api/public/cancel?token=${encodeURIComponent(token)}`);
  } catch (err) {
    renderError(err.message);
    return;
  }
  applyBrand(info.brand);
  document.title = `Cancel your appointment — ${info.business_name || 'Booking'}`;

  if (info.status === 'cancelled') renderCancelled(info, false);
  else if (info.past) renderPast(info);
  else if (info.disabled) renderDisabled(info);
  else if (info.too_late) renderTooLate(info);
  else renderConfirm(info);
}

lockZoom(); // fixed scale, same as the booking page and the workspace
boot();
