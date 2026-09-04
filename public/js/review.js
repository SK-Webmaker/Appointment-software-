// Public review page: a client taps a link from their receipt/review-request
// message, lands here (token in the URL path), rates 1-5 stars, optionally
// leaves a comment. Happy clients (4-5★) get an extra nudge to also post on
// Google if the business has set a review link.
import { esc, icon, fmtDate } from './ui.js';
import { resolveScheme, applyScheme } from './schemes.js';

const root = document.getElementById('review');
const token = decodeURIComponent(location.pathname.replace(/^\/review\/?/, ''));

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
  // Nothing arriving is the same failure as something arriving half-written:
  // every reply this API sends has a JSON body, so an empty one means the
  // transfer was cut off.
  let unreadable = !text;
  if (text) {
    try { data = JSON.parse(text); } catch { unreadable = true; }
  }
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  if (unreadable) throw new Error('The reply was cut short — please try again.');
  return data;
}

function applyBrand(brand) {
  if (!brand) return;
  const root = document.documentElement;
  applyScheme(resolveScheme(brand)); // same full colour scheme as the booking page
  if (brand.font && brand.font !== 'modern') root.dataset.brandFont = brand.font;
  const accent = /^#[0-9a-fA-F]{6}$/.test(brand.accent || '') ? brand.accent : '#38bdf8';
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(accent.slice(i, i + 2), 16));
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-ink', luminance > 0.56 ? '#0b1220' : '#ffffff');
  // Filled surfaces take the brand colour flat. A gradient here would fight
  // whatever the business actually uses on its own signage.
  root.style.setProperty('--accent-fill', accent);
  root.style.setProperty('--accent-hover', `color-mix(in srgb, ${accent} 86%, #fff)`);
}

const STAR_LABELS = ['', 'Not great', 'Could be better', 'Good', 'Great!', 'Excellent!'];
const starIcon = (filled) => `<svg viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

async function boot() {
  if (!token) {
    root.innerHTML = `<div class="rv-card">${icon('alert', 26)}<h2 style="margin-top:12px">Link not found</h2></div>`;
    return;
  }
  let info;
  try {
    info = await getJson(`/api/public/review?token=${encodeURIComponent(token)}`);
  } catch (err) {
    root.innerHTML = `
      <div class="rv-card">${icon('alert', 26)}<h2 style="margin-top:12px">This link isn't active</h2>
        <div class="visit-sub">${esc(err.message)}</div></div>`;
    return;
  }
  applyBrand(info.brand);
  document.title = `Rate your visit — ${info.business_name}`;

  if (info.already_reviewed) {
    renderThankYou(info, { rating: info.existing_rating, alreadyDone: true });
    return;
  }
  renderForm(info);
}

function headHtml(info) {
  return `
    <div class="rv-head">
      <h1>${esc(info.business_name)}</h1>
      <div class="sub">${esc(info.service_name)}${info.staff_name ? ` with ${esc(info.staff_name)}` : ''} · ${fmtDate(info.date)}</div>
    </div>`;
}

function renderForm(info) {
  let rating = 0;
  root.innerHTML = `
    ${headHtml(info)}
    <div class="rv-card">
      <h2>How was your visit?</h2>
      <div class="visit-sub">Hi ${esc(info.first_name || 'there')} — a quick rating helps ${esc(info.business_name)} a lot.</div>
      <div class="stars" id="rv-stars">
        ${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="star-btn" data-n="${n}">${starIcon(false)}</button>`).join('')}
      </div>
      <div class="star-label" id="rv-star-label">&nbsp;</div>
      <textarea class="rv-comment" id="rv-comment" placeholder="Anything you'd like to add? (optional)"></textarea>
      <button class="btn primary" id="rv-submit" style="width:100%;justify-content:center" disabled>${icon('check')} Submit review</button>
    </div>
    <div class="powered">Powered by <b>◆ Kairo</b></div>`;

  const stars = [...root.querySelectorAll('.star-btn')];
  const paint = (n) => stars.forEach((s, i) => s.classList.toggle('on', i < n));
  stars.forEach((btn) => {
    btn.addEventListener('mouseenter', () => paint(Number(btn.dataset.n)));
    btn.addEventListener('click', () => {
      rating = Number(btn.dataset.n);
      paint(rating);
      root.querySelector('#rv-star-label').textContent = STAR_LABELS[rating];
      root.querySelector('#rv-submit').disabled = false;
    });
  });
  root.querySelector('#rv-stars').addEventListener('mouseleave', () => paint(rating));

  root.querySelector('#rv-submit').addEventListener('click', async (e) => {
    if (!rating) return;
    e.target.disabled = true;
    try {
      const res = await getJson('/api/public/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, rating, comment: root.querySelector('#rv-comment').value }),
      });
      renderThankYou(info, { rating, googleUrl: res.google_review_url });
    } catch (err) {
      e.target.disabled = false;
      alert(err.message);
    }
  });
}

function renderThankYou(info, { rating, googleUrl, alreadyDone } = {}) {
  root.innerHTML = `
    ${headHtml(info)}
    <div class="rv-card">
      <div class="rv-done-icon">${icon('check', 28)}</div>
      <h2>${alreadyDone ? 'You already reviewed this visit' : 'Thanks for the feedback!'}</h2>
      <div class="visit-sub">
        ${alreadyDone ? `You rated this visit ${rating} star${rating === 1 ? '' : 's'}.` : `Your ${rating}-star review has been sent to ${esc(info.business_name)}.`}
      </div>
      ${!alreadyDone && rating >= 4 && googleUrl ? `
        <div style="margin-top:6px">
          <div class="visit-sub" style="margin-bottom:12px">Loved it? Sharing on Google helps others find us too.</div>
          <a class="rv-google" id="rv-google" href="${esc(googleUrl)}" target="_blank" rel="noopener noreferrer">${icon('link', 15)} Leave a Google review</a>
        </div>` : ''}
    </div>
    <div class="powered">Powered by <b>◆ Kairo</b></div>`;

  // Tell Kairo they went through, but never stand in the way of it. The link
  // opens Google directly — routing it through a redirect would put this app in
  // the path of the one thing that has to work, and an outage here would
  // silently stop every Google review the salon was about to get. If this
  // request never lands, the review still happens and only the count is short.
  const g = root.querySelector('#rv-google');
  if (g) {
    g.addEventListener('click', () => {
      fetch('/api/public/review-clicked', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
        keepalive: true,
      }).catch(() => { /* the review matters, the count does not */ });
    });
  }
}

boot();
