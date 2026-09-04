// The client's own page for one appointment. They tap the link in their
// confirmation or reminder and land here, with the token in the URL path.
//
// Three things they might want, in the order that helps the salon most:
// confirm they're coming, move it, or cancel. Confirming is loudest because it
// is the free answer that prevents the expensive outcome. Cancelling is quiet
// but genuinely present — a cancel button that is hard to find does not stop
// the cancellation, it turns it into a no-show, which costs the salon the slot
// AND the chance to sell it.
//
// The notice period is shown before they commit, and there is a phone number
// instead of a dead end when they've left it too late.
import { esc, icon, fmtDate, fmtTime } from './ui.js';
import { resolveScheme, applyScheme } from './schemes.js';
import { lockZoom } from './nozoom.js';

const root = document.getElementById('cancel');
const token = decodeURIComponent(location.pathname.replace(/^\/cancel\/?/, ''));

async function getJson(url, opts) {
  const res = await fetch(url, opts);
  // Read as text, then parse. Going straight to res.json() and falling back to
  // {} turns a 200 whose body was cut off — a dropped connection, a proxy
  // giving up mid-stream — into an empty object, which then travels into the
  // page and surfaces as "cannot read properties of undefined" on some
  // unrelated line. A customer sees a blank screen and blames the salon. A
  // reply that arrived and would not parse is a failure, and saying so here is
  // the difference between "try again" and nothing at all.
  const text = await res.text().catch(() => '');
  let data = {};
  let unreadable = false;
  if (text) {
    try { data = JSON.parse(text); } catch { unreadable = true; }
  }
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  if (unreadable) throw new Error('The reply was cut short — please try again.');
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
  // Filled surfaces take the brand colour flat. A gradient here would fight
  // whatever the business actually uses on its own signage.
  el.style.setProperty('--accent-fill', accent);
  el.style.setProperty('--accent-hover', `color-mix(in srgb, ${accent} 86%, #fff)`);
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
      ? 'That\'s done. The time has been released and we\'ve emailed you a confirmation.'
      : byUs
        ? 'This booking was cancelled by us. If that\'s a surprise, please give us a call.'
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
    <div class="lede">There's nothing to cancel. This booking was for a time that has already been and gone.</div>
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

/** Confirmed and nothing left to do — the happy end of the page. */
function renderConfirmed(info, justNow) {
  shell(info, `
    <div class="cx-mark done">${icon('check', 28)}</div>
    <h2>${justNow ? 'Lovely — see you then' : 'You\'re confirmed for this one'}</h2>
    <div class="lede">${justNow
      ? 'Thanks for letting us know. We\'ve got you down.'
      : 'You\'ve already told us you\'re coming, so there\'s nothing else to do.'}</div>
    ${detailsHtml(info)}
    ${info.can_cancel ? `
      <div class="cx-actions">
        ${info.reschedule_url ? `<a class="cx-btn quiet" href="${esc(info.reschedule_url)}">${icon('calendar', 16)} Change the time</a>` : ''}
        <button class="cx-btn quiet" id="cx-cancel">Something's come up — cancel it</button>
      </div>` : ''}
    ${info.business_phone ? `<div class="cx-note">Running late? Call us on <span class="cx-phone">${esc(info.business_phone)}</span>.</div>` : ''}`);
  wireCancel(info);
}

/**
 * The main page: one appointment, and everything they might want to do with it.
 *
 * The order is the order of usefulness to the salon. Confirming is first and
 * loudest because it is the answer that costs nothing and prevents the
 * expensive outcome. Moving it is second, because a client who is offered a
 * different time often takes one instead of cancelling. Cancelling is last and
 * quiet — but it is genuinely there, because a cancel button that is hard to
 * find does not stop the cancellation, it just turns it into a no-show.
 */
function renderChoices(info) {
  shell(info, `
    <h2>${info.first_name ? `Hi ${esc(info.first_name)}` : 'Your appointment'}</h2>
    <div class="lede">Here's what you've got booked. Let us know how you're placed.</div>
    ${detailsHtml(info)}
    <div class="cx-actions">
      ${info.can_confirm ? `<button class="cx-btn brand" id="cx-yes">${icon('check', 16)} Yes, I'll be there</button>` : ''}
      ${info.can_reschedule && info.reschedule_url
        ? `<a class="cx-btn quiet" href="${esc(info.reschedule_url)}">${icon('calendar', 16)} Change the time</a>` : ''}
      ${info.can_cancel ? `<button class="cx-btn quiet danger-text" id="cx-cancel">Cancel this appointment</button>` : ''}
    </div>
    <div class="cx-note">${info.cancel_window_hours > 0
      ? `Changing or cancelling online is open until ${esc(hoursLabel(info.cancel_window_hours))} before your appointment.`
      : 'You can change or cancel online any time before your appointment.'}
      ${info.business_phone ? `After that, call us on <span class="cx-phone">${esc(info.business_phone)}</span>.` : ''}</div>`);

  const yes = root.querySelector('#cx-yes');
  if (yes) yes.onclick = async () => {
    yes.disabled = true;
    yes.innerHTML = 'Just a moment…';
    try {
      const out = await getJson('/api/public/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      renderConfirmed({ ...info, ...out }, true);
    } catch (err) {
      yes.disabled = false;
      yes.innerHTML = `${icon('check', 16)} Yes, I'll be there`;
      showProblem(err.message);
    }
  };
  wireCancel(info);
}

/**
 * Cancelling, behind a second tap.
 *
 * Not a browser confirm() — that dialog is untranslated, unstyled and reads
 * like an error. The second tap is the same button asking again, in the salon's
 * own words, and it is the only place on this page that is red.
 */
function wireCancel(info) {
  const btn = root.querySelector('#cx-cancel');
  if (!btn) return;
  let armed = false;
  btn.onclick = async () => {
    if (!armed) {
      armed = true;
      btn.classList.add('danger');
      btn.classList.remove('quiet', 'danger-text');
      btn.innerHTML = `${icon('x', 16)} Tap again to cancel`;
      return;
    }
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
      // Most likely the window closed while the page sat open — say so rather
      // than leaving a stale form that looks like it should still work.
      btn.disabled = false;
      btn.innerHTML = `${icon('x', 16)} Tap again to cancel`;
      showProblem(err.message);
    }
  };
}

function showProblem(message) {
  const card = root.querySelector('.cx-card');
  card.querySelector('.cx-problem')?.remove();
  const note = document.createElement('div');
  note.className = 'cx-callout cx-problem';
  note.innerHTML = `<b>${esc(message)}</b>`;
  card.appendChild(note);
}

async function boot() {
  if (!token) { renderError('That link is missing its code. Please use the link from your booking message.'); return; }
  let info;
  try {
    info = await getJson(`/api/public/cancel?token=${encodeURIComponent(token)}`);
  } catch (err) {
    renderError(err.message);
    return;
  }
  applyBrand(info.brand);
  document.title = `Your appointment · ${info.business_name || 'Booking'}`;

  if (info.status === 'cancelled') renderCancelled(info, false);
  else if (info.past) renderPast(info);
  else if (info.confirmed) renderConfirmed(info, false);
  // "Too late to change it online" is not too late to say you're coming, so a
  // client inside the notice window still gets the one button that helps.
  else if (info.disabled || info.too_late) {
    if (info.can_confirm) renderChoices(info);
    else if (info.disabled) renderDisabled(info);
    else renderTooLate(info);
  } else renderChoices(info);
}

lockZoom(); // fixed scale, same as the booking page and the workspace
boot();
