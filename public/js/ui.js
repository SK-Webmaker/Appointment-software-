// DOM helpers, icons, modal, toast, formatting.

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  invoice: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  chevL: '<polyline points="15 18 9 12 15 6"/>',
  chevR: '<polyline points="9 18 15 12 9 6"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  dollar: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  print: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  card: '<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
  alert: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  trendUp: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  bar: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  reply: '<polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
  filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  sort: '<polyline points="8 9 12 5 16 9"/><polyline points="8 15 12 19 16 15"/>',
  menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  note: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="14 3 14 9 20 9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
};

export function icon(name, size = 16) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}

// Human labels for stored payment-method codes.
const METHOD_LABELS = { card: 'Card', square: 'Square', cash: 'Cash', transfer: 'Bank transfer', other: 'Other', stripe: 'Card (Stripe)' };
export function methodLabel(m) { return METHOD_LABELS[m] || (m ? m.charAt(0).toUpperCase() + m.slice(1) : ''); }

// Brand mark — an abstract "K" whose upper arm sweeps like a clock hand toward
// a separated dot: kairos, the opportune moment. Drawn as strokes so it stays
// legible from 16px up. `kairoMark()` returns the open mark (for dark UI
// surfaces); `kairoTile()` returns the filled app-icon tile.
export function kairoMark(size = 30, id = 'km') {
  return `
<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" aria-hidden="true">
  <defs><linearGradient id="${id}" x1="12" y1="9" x2="36" y2="39" gradientUnits="userSpaceOnUse">
    <stop stop-color="#e0f2fe"/><stop offset="1" stop-color="#38bdf8"/>
  </linearGradient></defs>
  <path d="M13.75 10.5V37.5" stroke="url(#${id})" stroke-width="5.5" stroke-linecap="round"/>
  <path d="M17.2 25.6A16 16 0 0 1 29.6 13.9" stroke="url(#${id})" stroke-width="5.5" stroke-linecap="round"/>
  <path d="M17.2 25.6L33.6 37.5" stroke="url(#${id})" stroke-width="5.5" stroke-linecap="round"/>
  <circle cx="35.2" cy="10.4" r="3.9" fill="#38bdf8"/>
</svg>`;
}

export function kairoTile(size = 30, id = 'kt') {
  return `
<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">
  <defs><linearGradient id="${id}" x1="2" y1="2" x2="46" y2="46" gradientUnits="userSpaceOnUse">
    <stop stop-color="#38bdf8"/><stop offset="1" stop-color="#1d4ed8"/>
  </linearGradient></defs>
  <rect width="48" height="48" rx="12.5" fill="url(#${id})"/>
  <path d="M15.6 13V35" stroke="#fff" stroke-width="4.6" stroke-linecap="round"/>
  <path d="M18.5 25.4A13 13 0 0 1 28.6 15.9" stroke="#fff" stroke-width="4.6" stroke-linecap="round"/>
  <path d="M18.5 25.4L31.6 35" stroke="#fff" stroke-width="4.6" stroke-linecap="round"/>
  <circle cx="33" cy="13.2" r="3.2" fill="#bae6fd"/>
</svg>`;
}

export const LOGO_SVG = kairoMark(30, 'kg');

// ---------- formatting ----------

let CURRENCY = '$';
export function setCurrency(c) { CURRENCY = c || '$'; }

export function money(cents) {
  const v = (Number(cents) || 0) / 100;
  const s = v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${CURRENCY}${s}`;
}

/**
 * How a service's price reads on a menu: "$85.00" (fixed), "From $85.00"
 * (price varies — length/thickness/complexity — staff set the real amount at
 * checkout), or "Free" (consults, patch tests). Matches Fresha's three price
 * types. Always use this for menu/listing display; checkout still starts
 * from the stored price_cents as an editable number either way.
 */
export function priceLabel(service) {
  if (service?.price_type === 'free') return 'Free';
  if (service?.price_type === 'from') return `From ${money(service.price_cents)}`;
  return money(service?.price_cents);
}

export function fmtTime(min) {
  let h = Math.floor(min / 60), m = min % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return m === 0 ? `${h}:00 ${ap}` : `${h}:${String(m).padStart(2, '0')} ${ap}`;
}

export function fmtTimeShort(min) {
  let h = Math.floor(min / 60), m = min % 60;
  h = h % 12 || 12;
  return m === 0 ? `${h}` : `${h}:${String(m).padStart(2, '0')}`;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseDate(s) { return new Date(`${s}T12:00:00`); }
export function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function todayStr(offset = 0) {
  const d = new Date(); d.setDate(d.getDate() + offset); return dateToStr(d);
}
export function fmtDate(s, { weekday = true } = {}) {
  if (!s) return '—';
  const d = parseDate(s);
  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return weekday ? `${DAYS[d.getDay()]}, ${base}` : `${base}, ${d.getFullYear()}`;
}
export function addDaysStr(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return dateToStr(d); }

export function initials(name) {
  return String(name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

const AVATAR_COLORS = ['#38bdf8', '#34d399', '#9085e9', '#fbbf24', '#f472b6', '#60a5fa', '#2dd4bf'];
export function avatarColor(name) {
  let h = 0;
  for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export const STATUS_LABELS = {
  booked: 'Booked', confirmed: 'Confirmed', completed: 'Completed',
  cancelled: 'Cancelled', no_show: 'No-show',
  draft: 'Draft', sent: 'Sent', paid: 'Paid', void: 'Void', online: 'Online',
};
export function statusChip(status) {
  return `<span class="chip s-${esc(status)}"><span class="dot"></span>${esc(STATUS_LABELS[status] || status)}</span>`;
}

/** Static 1-5 star display for review ratings (list rows, summaries). */
export function starsHtml(rating, size = 14) {
  const n = Math.round(Number(rating) || 0);
  return `<span class="stars-static" aria-label="${n} out of 5 stars">${[1, 2, 3, 4, 5].map((i) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${i <= n ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
  ).join('')}</span>`;
}

// ---------- modal ----------

export function openModal({ title, body, footer = '', wide = false, onClose = null }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-label="${esc(title)}">
      <div class="modal-head"><h2>${esc(title)}</h2>
        <button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); onClose?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('[data-close]').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
  overlay.close = close;
  return overlay;
}

// `cancelText` exists because the dismiss button is not always "Cancel" — on a
// dialog that cancels an appointment, two buttons both reading Cancel is a
// coin toss rather than a choice.
/**
 * `checkbox: { label, hint, checked }` adds one decision to the dialog — for a
 * choice that belongs with the confirmation rather than in Settings, like
 * whether to tell the client an appointment is off.
 *
 * `choices: { name, value, options: [{ value, label, hint }] }` asks for one
 * pick out of several instead — "email them / text them / don't". A radio list
 * rather than a dropdown, because the whole point is that every option is
 * visible without a tap.
 *
 * Resolves `false` when dismissed, so `if (!ok) return` keeps working. With a
 * checkbox or choices it resolves `{ checked, choice }` on confirm, which is
 * truthy, instead of plain `true`.
 */
export function confirmDialog(title, message, {
  danger = false, okText = 'Confirm', cancelText = 'Cancel', checkbox = null, choices = null,
} = {}) {
  return new Promise((resolve) => {
    const name = `cd-${Math.random().toString(36).slice(2, 8)}`;
    const m = openModal({
      title,
      body: `<p style="color:var(--text-2);line-height:1.6">${message}</p>`
        + (checkbox ? `
        <label class="confirm-opt">
          <input type="checkbox" class="chk" data-opt ${checkbox.checked === false ? '' : 'checked'}>
          <span>
            <b>${esc(checkbox.label)}</b>
            ${checkbox.hint ? `<span class="co-hint">${esc(checkbox.hint)}</span>` : ''}
          </span>
        </label>` : '')
        + (choices ? `<div class="confirm-choices" role="radiogroup">${choices.options.map((o, i) => `
          <label class="confirm-opt">
            <input type="radio" name="${name}" class="chk" data-choice value="${esc(o.value)}"
              ${(choices.value ? choices.value === o.value : i === 0) ? 'checked' : ''}>
            <span>
              <b>${esc(o.label)}</b>
              ${o.hint ? `<span class="co-hint">${esc(o.hint)}</span>` : ''}
            </span>
          </label>`).join('')}</div>` : ''),
      footer: `<div class="spacer"></div>
        <button class="btn" data-cancel>${esc(cancelText)}</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(okText)}</button>`,
      onClose: () => resolve(false),
    });
    const opt = m.querySelector('[data-opt]');
    m.querySelector('[data-cancel]').onclick = () => { m.close(); };
    m.querySelector('[data-ok]').onclick = () => {
      resolve(checkbox || choices
        ? {
          checked: checkbox ? Boolean(opt?.checked) : true,
          choice: m.querySelector('[data-choice]:checked')?.value || '',
        }
        : true);
      m.close();
    };
  });
}

// ---------- toast ----------

let toastWrap;
export function toast(message, type = 'ok', { action = null, ms = 3200 } = {}) {
  if (!toastWrap) {
    toastWrap = document.createElement('div');
    toastWrap.className = 'toasts';
    document.body.appendChild(toastWrap);
  }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `${icon(type === 'ok' ? 'check' : 'alert')}<span>${esc(message)}</span>`;

  let timer = null;
  const dismiss = () => {
    clearTimeout(timer);
    t.style.opacity = '0';
    t.style.transition = 'opacity 0.3s';
    setTimeout(() => t.remove(), 320);
  };

  // An action turns the toast into the undo affordance: the only place the
  // owner can reverse something they've just done, so it has to stay put long
  // enough to be read, noticed and reached for.
  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-action';
    btn.textContent = action.label;
    btn.onclick = async () => {
      btn.disabled = true;
      dismiss();
      await action.onClick();
    };
    t.appendChild(btn);
  }

  toastWrap.appendChild(t);
  timer = setTimeout(dismiss, ms);
  return { dismiss };
}

// time <select> options in `step`-minute increments
export function timeOptions(selected, { from = 0, to = 1440, step = 15 } = {}) {
  let out = '';
  for (let t = from; t <= to; t += step) {
    out += `<option value="${t}" ${t === selected ? 'selected' : ''}>${fmtTime(t)}</option>`;
  }
  return out;
}

export function downloadText(filename, text, mime = 'text/csv') {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** True when Kairo was opened from the home screen, with no browser chrome. */
export function isStandalone() {
  return window.navigator.standalone === true
    || window.matchMedia?.('(display-mode: standalone)').matches === true
    || window.matchMedia?.('(display-mode: fullscreen)').matches === true;
}

/**
 * Hand a URL to the phone's own browser instead of opening it inside Kairo.
 *
 * The booking page is same-origin and sits inside the app's manifest scope, so
 * an ordinary link keeps it in the home-screen app — where there is no address
 * bar and no back button, stranding the owner on their own customer page with
 * no way out but force-quitting. A target="_blank" click is what Safari and
 * Chrome both read as "send this to the browser": the owner keeps their place
 * in Kairo, and over in the browser they get an address bar and a share button.
 */
export function openExternal(url) {
  const a = document.createElement('a');
  a.href = new URL(url, location.href).href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Copy text to the clipboard, and say honestly whether it worked.
 *
 * `navigator.clipboard` only exists in a secure context, so it is simply
 * missing whenever Kairo is opened over plain HTTP — a salon reaching it on the
 * shop's own network by IP, or a demo before the certificate is set up. The old
 * code called it unguarded, which meant the Copy button either did nothing at
 * all or, worse, reported success while copying nothing. The textarea fallback
 * is the pre-Clipboard-API technique and still works on HTTP.
 */
export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    // Off-screen but still focusable — display:none would make the copy a no-op.
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const done = document.execCommand('copy');
    ta.remove();
    return done;
  } catch {
    return false;
  }
}

/**
 * Push a link out through the phone's share sheet — the shortest path from
 * Kairo to an Instagram bio. Falls back to the clipboard on desktop, and says
 * which of the two happened so the caller can word the confirmation honestly.
 */
export async function shareLink(url, title = '') {
  if (navigator.share) {
    try { await navigator.share({ title, url }); return 'shared'; } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }
  return (await copyText(url)) ? 'copied' : 'failed';
}
