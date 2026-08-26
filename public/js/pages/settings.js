// Settings: business profile, hours, billing defaults, notifications,
// payments/deposits, locations, booking link, password.
import { api } from '../api.js';
import { esc, icon, toast, timeOptions, setCurrency, confirmDialog, openModal, openExternal, shareLink, copyText } from '../ui.js';
import { state, refreshLookups } from '../app.js';
import { SCHEMES } from '../schemes.js';
import { parseDayRules } from '../hours.js';
import { mountSmsCredit } from '../sms-credit.js';

// Secret keys are never sent to the browser — the API returns a `<key>_set`
// flag instead. These render the "already saved" affordance.
const keySaved = (set) => (set === '1'
  ? ' <span style="color:var(--green);font-weight:600;font-size:11px">● saved</span>' : '');
const keyPlaceholder = (set, empty) => (set === '1' ? '•••••••••• (leave blank to keep)' : empty);

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The next date on or after today that falls on weekday `dow` (0=Sun). */
function nextWeekday(dow) {
  const d = new Date();
  d.setDate(d.getDate() + (((dow - d.getDay()) % 7) + 7) % 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * One row per weekday: open or closed, how often it runs, and whether it keeps
 * its own hours. Replaces the old on/off day chips — a day that runs every
 * second week can't be expressed as a single toggle.
 */
function weekRulesHtml(s) {
  const open = String(s.open_days ?? '0,1,2,3,4,5,6').split(',').map(Number);
  const rules = parseDayRules(s.day_rules);
  const usualOpen = Number(s.open_min || 480);
  const usualClose = Number(s.close_min || 1200);

  return DAY_NAMES.map((name, dow) => {
    const isOpen = open.includes(dow);
    const rule = rules[dow] || {};
    const every = isOpen ? (rule.every_weeks || 1) : 0;   // 0 = closed
    const custom = rule.open_min !== undefined;
    const anchor = rule.anchor || nextWeekday(dow);
    return `
      <div class="wk-row${isOpen ? '' : ' off'}" data-day="${dow}">
        <div class="wk-name">${name}</div>
        <select class="wk-freq nice-select" data-freq aria-label="${name} availability">
          <option value="0" ${every === 0 ? 'selected' : ''}>Closed</option>
          <option value="1" ${every === 1 ? 'selected' : ''}>Every week</option>
          <option value="2" ${every === 2 ? 'selected' : ''}>Every 2nd week</option>
          <option value="3" ${every === 3 ? 'selected' : ''}>Every 3rd week</option>
          <option value="4" ${every === 4 ? 'selected' : ''}>Every 4th week</option>
        </select>
        <div class="wk-extra" ${every === 0 ? 'hidden' : ''}>
          <label class="wk-when" ${every > 1 ? '' : 'hidden'}>
            <span>Starting</span>
            <input type="date" data-anchor value="${esc(anchor)}" aria-label="${name} start date">
          </label>
          <div class="wk-hours">
            <label class="wk-custom">
              <input type="checkbox" class="chk" data-custom ${custom ? 'checked' : ''}>
              <span>Own hours</span>
            </label>
            <div class="wk-times" ${custom ? '' : 'hidden'}>
              <select data-open class="nice-select" aria-label="${name} opening time">${timeOptions(custom ? rule.open_min : usualOpen, { from: 0, to: 1410, step: 30 })}</select>
              <span class="wk-to">to</span>
              <select data-close class="nice-select" aria-label="${name} closing time">${timeOptions(custom ? rule.close_min : usualClose, { from: 30, to: 1440, step: 30 })}</select>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');
}

/** Read the week rows back into `open_days` + `day_rules`. */
function readWeekRules(container) {
  const days = [];
  const rules = {};
  for (const row of container.querySelectorAll('#week-rules .wk-row')) {
    const dow = Number(row.dataset.day);
    const every = Number(row.querySelector('[data-freq]').value);
    if (!every) continue;                       // closed — no day, no rule
    days.push(dow);
    const rule = {};
    if (every > 1) {
      rule.every_weeks = every;
      rule.anchor = row.querySelector('[data-anchor]').value || nextWeekday(dow);
    }
    if (row.querySelector('[data-custom]').checked) {
      const open = Number(row.querySelector('[data-open]').value);
      const close = Number(row.querySelector('[data-close]').value);
      if (close <= open) return { error: `${DAY_NAMES[dow]} closes before it opens` };
      rule.open_min = open;
      rule.close_min = close;
    }
    if (Object.keys(rule).length) rules[dow] = rule;
  }
  if (!days.length) return { error: 'Pick at least one open day' };
  return { open_days: days.join(','), day_rules: JSON.stringify(rules) };
}


export async function renderSettings(container) {
  const s = state.settings;
  // The link the owner copies into their Instagram bio. It has to be the
  // business's real address, not whatever they happen to have typed into the
  // address bar — an owner signed in at the raw hosting URL would otherwise
  // copy that one out to every customer, and it would work, which is what
  // makes it so easy to miss.
  const bookingUrl = `${s.public_url_effective || location.origin}/book`;

  // Is that link still the free hosting address the service was born with?
  //
  // This is the one setting that gets copied out of Kairo and into places
  // nobody can edit later — an Instagram bio, a shopfront QR code, 400 printed
  // cards. And because the raw link *works perfectly*, nothing ever complains.
  // The server decides (it knows the hosting hostnames); the only judgement
  // made here is to stay quiet on a developer's machine with nothing set up
  // yet, which is not a business handing anybody a link.
  const onLocalhost = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname);
  const rawLink = s.public_url_is_raw === '1' && !(onLocalhost && !s.public_url_effective);

  // Hour options for the calendar view window ('' = auto).
  const calHourOpts = (cur, autoLabel, isEnd = false) => {
    const fmt = (min) => {
      if (min >= 1440) return '12:00 AM (midnight)';
      const h = Math.floor(min / 60), ap = h >= 12 ? 'PM' : 'AM';
      return `${(h % 12) || 12}:00 ${ap}`;
    };
    let opts = `<option value="" ${!cur ? 'selected' : ''}>${autoLabel}</option>`;
    for (let mn = isEnd ? 60 : 0; mn <= (isEnd ? 1440 : 1380); mn += 60) {
      opts += `<option value="${mn}" ${String(cur) === String(mn) ? 'selected' : ''}>${fmt(mn)}</option>`;
    }
    return opts;
  };

  // One row per customer notification type: an on/off toggle + a channel
  // picker (Email / SMS / Both) so the owner controls each type separately.
  const notifRow = (enKey, chanKey, label, hint) => {
    const chan = ['email', 'sms', 'both'].includes(s[chanKey]) ? s[chanKey] : 'email';
    return `<div class="notif-row">
      <label class="notif-toggle">
        <input type="checkbox" class="chk" name="${enKey}" ${s[enKey] === '1' ? 'checked' : ''}>
        <span>${label}</span>
      </label>
      <select name="${chanKey}" class="notif-chan" aria-label="${label} delivery channel">
        <option value="email" ${chan === 'email' ? 'selected' : ''}>Email</option>
        <option value="sms" ${chan === 'sms' ? 'selected' : ''}>SMS</option>
        <option value="both" ${chan === 'both' ? 'selected' : ''}>Email + SMS</option>
      </select>
    </div>${hint ? `<div class="hint notif-hint">${hint}</div>` : ''}`;
  };

  container.innerHTML = `
    <div class="page-head">
      <div class="ph-icon">${icon('settings', 20)}</div>
      <div><h1>Settings</h1><div class="ph-sub">Your business profile, hours and billing defaults</div></div>
    </div>
    <div class="settings-grid">
      <div class="card">
        <div class="card-title">Business profile</div>
        <div class="card-sub" style="margin-bottom:16px">Shown on your booking page and invoices</div>
        <form id="set-profile" style="display:flex;flex-direction:column;gap:13px">
          <div class="field"><label>Business name</label><input name="business_name" value="${esc(s.business_name || '')}"></div>
          <div class="form-grid">
            <div class="field"><label>Phone</label><input name="business_phone" value="${esc(s.business_phone || '')}"></div>
            <div class="field"><label>Email</label><input name="business_email" value="${esc(s.business_email || '')}"></div>
          </div>
          <div class="field"><label>Address</label><input name="business_address" value="${esc(s.business_address || '')}"></div>
          <button class="btn primary" style="align-self:flex-start">${icon('check')} Save profile</button>
        </form>
      </div>

      <div class="card">
        <div class="card-title">Hours &amp; booking</div>
        <div class="card-sub" style="margin-bottom:16px">Controls the calendar grid and online booking slots</div>
        <form id="set-hours" style="display:flex;flex-direction:column;gap:13px">
          <div class="form-grid">
            <div class="field"><label>Opens</label>
              <select name="open_min">${timeOptions(Number(s.open_min || 480), { from: 240, to: 780, step: 30 })}</select></div>
            <div class="field"><label>Closes</label>
              <select name="close_min">${timeOptions(Number(s.close_min || 1200), { from: 780, to: 1440, step: 30 })}</select></div>
          </div>
          <div class="field"><label>Your week</label>
            <div class="week-rules" id="week-rules">${weekRulesHtml(s)}</div>
            <div class="hint">Set each day to closed, weekly, or <b>every 2nd/3rd/4th week</b>, so you can open every second Sunday with its own hours. Closed days and off weeks never appear on the customer booking page; you can still add a walk-in from the calendar.</div></div>
          <div class="form-grid">
            <div class="field"><label>Online booking slot interval</label>
              <select name="slot_interval">${[10, 15, 20, 30, 60].map((v) => `<option value="${v}" ${Number(s.slot_interval) === v ? 'selected' : ''}>${v} minutes</option>`).join('')}</select></div>
            <div class="field"><label>Minimum booking notice</label>
              <select name="booking_lead_min">${[
                [0, 'None, up to the last minute'], [15, '15 minutes ahead'], [30, '30 minutes ahead'],
                [60, '1 hour ahead'], [120, '2 hours ahead'], [240, '4 hours ahead'], [1440, '1 day ahead'],
              ].map(([v, lbl]) => `<option value="${v}" ${Number(s.booking_lead_min || 0) === v ? 'selected' : ''}>${lbl}</option>`).join('')}</select>
              <div class="hint">How far ahead a customer must book. Past times are never shown regardless.</div></div>
          </div>
          <div class="form-grid">
            <div class="field"><label>Calendar starts at</label>
              <select name="cal_start_min" class="nice-select">${calHourOpts(s.cal_start_min, 'Auto (2h before open)')}</select></div>
            <div class="field"><label>Calendar ends at</label>
              <select name="cal_end_min" class="nice-select">${calHourOpts(s.cal_end_min, 'Auto (2h after close)', true)}</select></div>
          </div>
          <div class="hint" style="margin-top:-4px">How much of the day your calendar shows and scrolls through. Set it wider to slot in early or late walk-ins. Appointments outside this window still always show.</div>
          <div class="form-grid">
            <div class="field"><label>Customers can book up to</label>
              <select name="booking_horizon_days" class="nice-select">${[30, 60, 90, 120, 180, 365]
                .map((d) => `<option value="${d}" ${Number(s.booking_horizon_days || 90) === d ? 'selected' : ''}>${d >= 365 ? '1 year' : `${d / 30} months`} ahead</option>`).join('')}</select>
              <div class="hint">How far into the future your booking page offers dates.</div></div>
            <div class="field"><label>Customers can cancel until</label>
              <select name="cancel_window_hours" class="nice-select">${[
                ['off', 'No online cancelling'], ['0', 'Any time before'], ['2', '2 hours before'],
                ['6', '6 hours before'], ['12', '12 hours before'], ['24', '24 hours before'], ['48', '2 days before'],
              ].map(([v, lbl]) => {
                const cur = s.client_cancel_enabled === '0' ? 'off' : String(Number(s.cancel_window_hours ?? 12));
                return `<option value="${v}" ${cur === v ? 'selected' : ''}>${lbl}</option>`;
              }).join('')}</select>
              <div class="hint">Their confirmation and reminder carry a cancel link. Inside this window it stops working and they are asked to call, so you always get notice.</div></div>
          </div>
          <div class="field"><label>Usual rebooking gap</label>
            <select name="rebook_weeks_default" class="nice-select">${[2, 3, 4, 5, 6, 8, 10, 12]
              .map((w) => `<option value="${w}" ${Number(s.rebook_weeks_default || 4) === w ? 'selected' : ''}>${w} weeks</option>`).join('')}</select>
            <div class="hint">What <b>Rebook</b> suggests when you book a client's next visit from the calendar. You can still change it each time.</div></div>
          <div class="field"><label>Time zone</label>
            <input name="business_tz" value="${esc(s.business_tz || '')}" placeholder="${esc(Intl.DateTimeFormat().resolvedOptions().timeZone || 'e.g. Australia/Melbourne')}">
            <div class="hint">Auto-detected from your device. It keeps the booking page showing the right upcoming times. Only change it if your salon is in a different zone to you.</div></div>
          <div class="field">
            <label style="display:flex;align-items:center;gap:8px;font-weight:500;color:var(--text-2);cursor:pointer">
              <input type="checkbox" name="booking_enabled" ${s.booking_enabled === '1' ? 'checked' : ''} class="chk">
              Accept online bookings</label></div>
          <div class="field"><label>Your booking link</label>
            <div class="copy-row">
              <input readonly value="${esc(bookingUrl)}" id="book-url">
              <button type="button" class="btn" id="copy-url">${icon('link')} Copy</button>
            </div>
            <div class="link-actions">
              <button type="button" class="btn small" id="open-url">${icon('external')} Open in browser</button>
              <button type="button" class="btn small" id="share-url" hidden>${icon('share')} Share</button>
            </div>
            ${rawLink ? `
            <div class="starter-nag" id="raw-link-nag">
              ${icon('link', 16)}
              <div>
                <b>This isn't your proper web address yet.</b>
                ${s.public_url_effective
                  ? `It's the temporary one your system was built on. It works — which is exactly why it's easy to
                     miss — but it isn't your business's name, and once it's in your Instagram bio and on your
                     cards it's very hard to take back.`
                  : `No address has been set, so Kairo is showing whatever you happen to be signed in at. That can
                     change, and any link you hand out now may stop working.`}
                <div class="starter-nag-actions">
                  ${s.public_url_from_env === '1'
                    ? '<span class="hint" style="margin:0">Ask whoever set your system up to point it at your own domain.</span>'
                    : '<button class="btn" type="button" id="fix-raw-link">Set your web address</button>'}
                </div>
              </div>
            </div>` : `
            <div class="live-note">${icon('check', 15)}
              <div><b>This link never changes.</b> Add a service, change a price or close a day and the same link
                shows it the moment you save. You never have to re-post it or send anyone a new one.</div></div>`}
            <div class="hint">Put it in your Instagram bio, Google profile and WhatsApp auto-reply. It opens in Safari
              or Chrome, so you keep your place in Kairo.</div></div>
          <button class="btn primary" style="align-self:flex-start">${icon('check')} Save hours</button>
        </form>
      </div>

      <div class="card">
        <div class="card-title">Booking page appearance</div>
        <div class="card-sub" style="margin-bottom:16px">Make the customer booking page match the business's brand.
          logo, colour and light/dark style. <a href="/book" target="_blank" rel="noopener noreferrer">Open the booking page ↗</a> to preview.</div>
        <form id="set-brand" style="display:flex;flex-direction:column;gap:13px">
          <div class="field"><label>Colour scheme</label>
            <div id="brand-schemes" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:9px">
              ${Object.entries(SCHEMES).map(([id, sc]) => {
                const active = (s.brand_scheme || (s.brand_theme === 'light' ? 'daylight' : 'midnight')) === id;
                return `
                <button type="button" data-scheme="${id}" aria-pressed="${active}"
                  style="display:flex;flex-direction:column;gap:0;overflow:hidden;text-align:left;border-radius:10px;padding:0;cursor:pointer;
                         border:2px solid ${active ? 'var(--accent)' : 'var(--border)'}">
                  <span style="display:block;height:34px;background:${sc.bg};position:relative">
                    <span style="position:absolute;left:8px;top:8px;right:26px;height:7px;border-radius:4px;background:${sc.panel2}"></span>
                    <span style="position:absolute;left:8px;top:20px;width:38px;height:7px;border-radius:4px;background:${sc.panel3}"></span>
                  </span>
                  <span style="display:block;padding:6px 9px;font-size:11.5px;font-weight:600;background:var(--panel-2);color:var(--text-2)">${sc.label}</span>
                </button>`;
              }).join('')}
            </div>
            <input type="hidden" name="brand_scheme" value="${esc(s.brand_scheme || (s.brand_theme === 'light' ? 'daylight' : 'midnight'))}">
            <div class="hint">The whole booking page takes this scheme (background, cards and text); your brand colour below is used for buttons and highlights on top of it.</div></div>
          <div class="field"><label>Font style</label>
            <select name="brand_font">
              <option value="modern" ${s.brand_font !== 'classic' && s.brand_font !== 'rounded' ? 'selected' : ''}>Modern (clean sans)</option>
              <option value="classic" ${s.brand_font === 'classic' ? 'selected' : ''}>Classic (elegant serif)</option>
              <option value="rounded" ${s.brand_font === 'rounded' ? 'selected' : ''}>Rounded (friendly)</option>
            </select></div>
          <div class="field"><label>Brand colour</label>
            <div class="color-row" id="brand-swatches">
              ${['#38bdf8', '#d55181', '#a855f7', '#f59e0b', '#10b981', '#e11d48', '#c2874a'].map((c) =>
                `<button type="button" class="color-dot${(s.brand_accent || '#38bdf8').toLowerCase() === c ? ' is-on' : ''}" data-c="${c}" style="--dot:${c}" aria-label="Brand colour ${esc(c)}"></button>`).join('')}
              <input type="color" class="color-pick" name="brand_accent" value="${esc(/^#[0-9a-fA-F]{6}$/.test(s.brand_accent || '') ? s.brand_accent : '#38bdf8')}" title="Custom colour">
            </div>
            <div class="hint">Buttons, highlights and time slots on the booking page use this colour.</div></div>
          <div class="field"><label>Logo (optional)</label>
            <div style="display:flex;gap:10px;align-items:center">
              <img id="brand-logo-preview" src="${s.brand_logo && s.brand_logo.startsWith('data:image/') ? esc(s.brand_logo) : ''}"
                alt="" style="height:44px;max-width:140px;object-fit:contain;border-radius:8px;border:1px solid var(--border);
                background:var(--bg-raise);padding:4px;${s.brand_logo ? '' : 'display:none'}">
              <button type="button" class="btn small" id="brand-logo-pick">${icon('upload')} Upload logo</button>
              <button type="button" class="btn small danger" id="brand-logo-clear" style="${s.brand_logo ? '' : 'display:none'}">Remove</button>
              <input type="file" id="brand-logo-file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style="display:none">
            </div>
            <div class="hint">PNG/JPG/SVG, up to ~250 KB. Shown at the top of the booking page.</div></div>
          <div class="field"><label>Cover photo (optional)</label>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
              <img id="brand-cover-preview" src="${s.brand_cover && s.brand_cover.startsWith('data:image/') ? esc(s.brand_cover) : ''}"
                alt="" style="height:56px;max-width:180px;object-fit:cover;border-radius:8px;border:1px solid var(--border);${s.brand_cover ? '' : 'display:none'}">
              <button type="button" class="btn small" id="brand-cover-pick">${icon('upload')} Upload cover</button>
              <button type="button" class="btn small danger" id="brand-cover-clear" style="${s.brand_cover ? '' : 'display:none'}">Remove</button>
              <input type="file" id="brand-cover-file" accept="image/png,image/jpeg,image/webp" style="display:none">
            </div>
            <div class="hint">A wide banner (a shot of your space or work) across the top of the booking page. Up to ~600 KB.</div></div>
          <div class="field"><label>Welcome line (optional)</label>
            <input name="brand_tagline" value="${esc(s.brand_tagline || '')}" placeholder="e.g. Colour, cuts & care in the heart of town" maxlength="120"></div>
          <button class="btn primary" style="align-self:flex-start">${icon('check')} Save appearance</button>
        </form>
      </div>

      <div class="card">
        <div class="card-title">Billing defaults</div>
        <div class="card-sub" style="margin-bottom:16px">Applied to new invoices</div>
        <form id="set-billing" style="display:flex;flex-direction:column;gap:13px">
          <div class="form-grid">
            <div class="field"><label>Currency symbol</label><input name="currency" value="${esc(s.currency || '$')}" maxlength="4"></div>
            <div class="field"><label>Tax rate %</label><input name="tax_rate" type="number" step="0.1" min="0" value="${esc(s.tax_rate || '0')}"></div>
            <div class="field"><label>Invoice prefix</label><input name="invoice_prefix" value="${esc(s.invoice_prefix || 'INV-')}"></div>
            <div class="field"><label>Due after (days)</label><input name="invoice_due_days" type="number" min="0" value="${esc(s.invoice_due_days || '7')}"></div>
          </div>
          <div class="field"><label>Invoice footer</label><input name="invoice_footer" value="${esc(s.invoice_footer || '')}"></div>
          <button class="btn primary" style="align-self:flex-start">${icon('check')} Save billing</button>
        </form>
      </div>

      <div class="card">
        <div class="card-title">Notifications</div>
        <div class="card-sub" style="margin-bottom:16px">Automatic confirmations, reminders, payment receipts &amp;
          post-visit review requests. Email uses <a href="https://resend.com" target="_blank" rel="noreferrer">Resend</a>
          (free up to 3,000 a month, plenty for this). Paste keys, hit save, send a test from the
          <a href="#/messages">Messages</a> page.</div>
        <form id="set-notif" style="display:flex;flex-direction:column;gap:13px">
          <div>
            <div class="notif-head"><span>Customer notification</span><span>Send by</span></div>
            ${notifRow('confirm_enabled', 'chan_confirmation', 'Booking confirmations', 'Sent the moment a booking is made.')}
            ${notifRow('reminders_enabled', 'chan_reminder', 'Appointment reminders', 'Sent a set number of hours before the visit.')}
            ${notifRow('receipts_enabled', 'chan_receipt', 'Payment receipts', 'Sent the moment a payment or deposit is recorded.')}
            ${notifRow('review_requests_enabled', 'chan_review_request', 'Review requests', 'Sent after a visit is marked Completed.')}
            <div class="hint" style="margin-top:8px">Choose Email, SMS, or both for each. <b>SMS options only take effect once you turn on “Also send SMS” below</b> and add a provider. Until then everything goes by email (so nothing is billed by accident).</div>
          </div>
          <label style="display:flex;align-items:center;gap:8px;font-weight:600;color:var(--text-2);cursor:pointer;margin-top:4px">
            <input type="checkbox" name="owner_notify_enabled" ${s.owner_notify_enabled === '1' ? 'checked' : ''} class="chk">
            Email me when a customer books online</label>
          <div class="form-grid">
            <div class="field"><label>Remind clients this many hours before</label>
              <select name="reminder_hours">${[2, 4, 12, 24, 48].map((h) => `<option value="${h}" ${Number(s.reminder_hours) === h ? 'selected' : ''}>${h} hours</option>`).join('')}</select></div>
            <div class="field"><label>Ask for a review this many hours after</label>
              <select name="review_delay_hours">${[0, 1, 2, 4, 24].map((h) => `<option value="${h}" ${Number(s.review_delay_hours) === h ? 'selected' : ''}>${h === 0 ? 'Immediately' : `${h} hour${h > 1 ? 's' : ''}`}</option>`).join('')}</select></div>
          </div>
          <div class="field"><label>Google review link (optional)</label>
            <input name="google_review_url" value="${esc(s.google_review_url || '')}" placeholder="https://g.page/r/…/review">
            <div class="hint">Clients who rate you 4-5★ get a one-tap link to also post this on Google.</div></div>
          <div class="field"><label>Your website address</label>
            <input name="public_url" value="${esc(s.public_url_from_env === '1' ? s.public_url_effective : (s.public_url || ''))}"
              placeholder="${esc(location.origin)}" ${s.public_url_from_env === '1' ? 'disabled' : ''}>
            <div class="hint">${s.public_url_from_env === '1'
              ? `Set on the server, so it can't be changed here — that's deliberate, because every cancel link,
                 review link and QR code is built from it. Ask whoever set your system up to change it.`
              : `Every cancel link, review link and QR code in your messages is built from this.
                 Auto-filled during setup — only change it if you move to a custom domain.`}</div></div>
          <div class="field"><label>Resend API key (email)${keySaved(s.resend_api_key_set)}</label>
            <input name="resend_api_key" type="password" value="" placeholder="${keyPlaceholder(s.resend_api_key_set, 're_…')}" autocomplete="off"></div>
          <div class="field"><label>From email (verified in Resend)</label>
            <input name="notif_from_email" value="${esc(s.notif_from_email || '')}" placeholder="bookings@yourdomain.com"></div>
          <div class="field"><label>Replies go to</label>
            <input name="notif_reply_to" value="${esc(s.notif_reply_to || '')}" placeholder="${esc(s.business_email || 'you@yourbusiness.com')}">
            <div class="hint">Messages are <i>sent</i> from an address that can't receive mail, so without this a client
              who hits Reply — "can I move to 3?" — just gets a bounce and you never hear about it.
              ${s.reply_to_invalid === '1'
                ? `<b style="color:var(--amber)">That doesn't look like an email address</b>, so it's being ignored.
                   ${s.reply_to_effective ? `Replies are going to <b>${esc(s.reply_to_effective)}</b> instead.` : 'Replies bounce.'}`
                : s.reply_to_effective
                  ? `Right now replies go to <b>${esc(s.reply_to_effective)}</b>.`
                  : '<b style="color:var(--amber)">Right now replies bounce.</b> Add an address here, or set your business email above.'}</div></div>
          <button class="btn primary" style="align-self:flex-start">${icon('check')} Save notifications</button>
        </form>
      </div>

      <div class="card">
        <div class="card-title">SMS (text messages)</div>
        <!-- Credit is prepaid: when it runs out, texts simply stop. The number
             lives here, next to the switch that spends it. -->
        <div id="sms-credit" class="sms-credit is-loading">
          <div class="sc-main"><span class="sc-amount">·····</span>
            <span class="sc-sub">checking your ClickSend balance…</span></div>
        </div>
        <div class="card-sub" style="margin-bottom:16px">This is the master switch for SMS. Turn it on and the types you set to
          <b>SMS</b> or <b>Email + SMS</b> above will text as well. SMS costs money per message (there's no free option), so
          it's <b>off by default</b>, so nothing is billed unless you turn it on. You're billed by the provider directly, no markup.</div>
        <form id="set-sms" style="display:flex;flex-direction:column;gap:13px">
          <label style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border:1px solid var(--border);border-radius:11px;cursor:pointer">
            <input type="checkbox" name="sms_notifications_enabled" ${s.sms_notifications_enabled === '1' ? 'checked' : ''} class="chk">
            <span><b>Turn SMS on</b>, activating the SMS and Email + SMS choices set per notification type above</span>
          </label>
          <div class="field"><label>SMS provider</label>
            <select name="sms_provider" id="sms-provider">
              <option value="clicksend" ${(s.sms_provider || 'clicksend') === 'clicksend' ? 'selected' : ''}>ClickSend · simplest setup, great for Australia</option>
              <option value="telnyx" ${s.sms_provider === 'telnyx' ? 'selected' : ''}>Telnyx · cheapest per message, more setup</option>
              <option value="twilio" ${s.sms_provider === 'twilio' ? 'selected' : ''}>Twilio · widely used, has monthly number fees</option>
            </select>
            <div class="hint" id="sms-provider-hint"></div>
          </div>

          <div class="sms-fields" data-provider="clicksend">
            <div class="form-grid">
              <div class="field"><label>ClickSend username</label>
                <input name="clicksend_username" value="${esc(s.clicksend_username || '')}" placeholder="your ClickSend login" autocomplete="off"></div>
              <div class="field"><label>ClickSend API key${keySaved(s.clicksend_api_key_set)}</label>
                <input name="clicksend_api_key" type="password" value="" placeholder="${keyPlaceholder(s.clicksend_api_key_set, 'from ClickSend dashboard')}" autocomplete="off"></div>
            </div>
            <div class="field"><label>Sender name or number (optional)</label>
              <input name="clicksend_from" value="${esc(s.clicksend_from || '')}" placeholder="e.g. LuxeHair (business name) or +61…">
              <div class="hint">Two ways to do this. A <b>business-name sender</b> ("LuxeHair") looks best but needs a
                one-off ACMA registration with your ABN — free, and ClickSend handles it. A <b>phone number</b> works
                straight away but shows a number rather than your name. Leave blank for a shared number.</div></div>
            ${s.clicksend_starter_active === '1' && s.clicksend_starter_dismissed !== '1' ? `
            <div class="starter-nag" id="starter-nag">
              ${icon('phone', 16)}
              <div>
                <b>You're texting from our starter number.</b>
                It was set up so your messages worked from day one — but it isn't yours, and your clients can't reply to it
                or save it as your number. Add your own sender in ClickSend, then put it in the box above.
                <div class="starter-nag-actions">
                  <a class="btn" href="https://dashboard.clicksend.com/account/senderIds" target="_blank" rel="noreferrer">${icon('external', 14)} Open ClickSend</a>
                  <button class="btn ghost" type="button" id="starter-dismiss">Not now</button>
                </div>
              </div>
            </div>` : ''}
          </div>

          <div class="sms-fields" data-provider="telnyx">
            <div class="field"><label>Telnyx API key${keySaved(s.telnyx_api_key_set)}</label>
              <input name="telnyx_api_key" type="password" value="" placeholder="${keyPlaceholder(s.telnyx_api_key_set, 'KEY…')}" autocomplete="off"></div>
            <div class="form-grid">
              <div class="field"><label>Sender number or ID</label>
                <input name="telnyx_from" value="${esc(s.telnyx_from || '')}" placeholder="+61… or LuxeHair"></div>
              <div class="field"><label>Messaging profile ID (optional)</label>
                <input name="telnyx_profile_id" value="${esc(s.telnyx_profile_id || '')}" placeholder="from Telnyx portal"></div>
            </div>
          </div>

          <div class="sms-fields" data-provider="twilio">
            <div class="form-grid">
              <div class="field"><label>Twilio Account SID</label>
                <input name="twilio_sid" value="${esc(s.twilio_sid || '')}" placeholder="AC…" autocomplete="off"></div>
              <div class="field"><label>Twilio Auth Token${keySaved(s.twilio_token_set)}</label>
                <input name="twilio_token" type="password" value="" placeholder="${keyPlaceholder(s.twilio_token_set, '')}" autocomplete="off"></div>
            </div>
            <div class="field"><label>Twilio phone number (sender)</label>
              <input name="twilio_from" value="${esc(s.twilio_from || '')}" placeholder="+15551234567"></div>
          </div>

          <button class="btn primary" style="align-self:flex-start">${icon('check')} Save SMS settings</button>
        </form>
      </div>

      <div class="card">
        <div class="card-title">In-person card payments (Point of Sale)</div>
        <div class="card-sub" style="margin-bottom:16px">How you take card payments at the counter. Cash and other methods
          are always available too.</div>
        <form id="set-poscard" style="display:flex;flex-direction:column;gap:10px">
          <label class="pay-opt ${(s.pos_card_method || 'stripe') === 'stripe' ? 'sel' : ''}">
            <input type="radio" name="pos_card_method" value="stripe" ${(s.pos_card_method || 'stripe') === 'stripe' ? 'checked' : ''}>
            <span><b>Stripe</b><br><span class="cell-sub">Kairo creates a secure pay link the customer completes on their phone
              (card, Apple&nbsp;Pay, Google&nbsp;Pay). Marks itself paid automatically. Uses the Stripe key below.</span></span>
          </label>
          <label class="pay-opt ${s.pos_card_method === 'square' ? 'sel' : ''}">
            <input type="radio" name="pos_card_method" value="square" ${s.pos_card_method === 'square' ? 'checked' : ''}>
            <span><b>Square</b><br><span class="cell-sub">Charge on your own Square reader / app the way you already do, then tap
              <b>Paid</b> in Kairo. No key or Square login needed. The bill is tracked here, the card is taken on Square.</span></span>
          </label>
          <button class="btn primary" style="align-self:flex-start;margin-top:4px">${icon('check')} Save card method</button>
        </form>
      </div>

      <div class="card">
        <div class="card-title">Online deposits (Stripe)</div>
        <div class="card-sub" style="margin-bottom:16px">Take a card deposit when clients book online. The single biggest no-show killer.
          Get a secret key from <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer">Stripe</a>;
          deposits are credited automatically when you bill the visit.</div>
        <form id="set-payments" style="display:flex;flex-direction:column;gap:13px">
          <div class="field"><label>Stripe secret key${keySaved(s.stripe_secret_key_set)}</label>
            <input name="stripe_secret_key" type="password" value="" placeholder="${keyPlaceholder(s.stripe_secret_key_set, 'sk_live_… (or sk_test_… to try it)')}" autocomplete="off"></div>
          <div class="form-grid">
            <div class="field"><label>Deposit</label>
              <select name="deposit_type">
                <option value="none" ${s.deposit_type === 'none' ? 'selected' : ''}>No deposit</option>
                <option value="fixed" ${s.deposit_type === 'fixed' ? 'selected' : ''}>Fixed amount</option>
                <option value="percent" ${s.deposit_type === 'percent' ? 'selected' : ''}>% of service price</option>
              </select></div>
            <div class="field"><label>Amount (${esc(s.currency || '$')} or %)</label>
              <input name="deposit_value" type="number" min="0" step="0.5" value="${esc(s.deposit_value || '20')}"></div>
          </div>
          <div class="field"><label>Currency code (for Stripe)</label>
            <input name="currency_code" value="${esc(s.currency_code || 'usd')}" maxlength="3" placeholder="usd">
            <div class="hint">3-letter ISO code: usd, gbp, eur, aud, cad…</div></div>
          <button class="btn primary" style="align-self:flex-start">${icon('check')} Save payments</button>
        </form>
      </div>

      <div class="card">
        <div class="card-title">Waitlist &amp; automatic filling</div>
        <div class="card-sub" style="margin-bottom:16px">A cancellation is money you already earned and
          handed back — and the client who cancelled wanted that time, so somebody else probably does too.
          Let customers put their name down, and Kairo can offer a freed slot the moment it happens.</div>
        <div id="wl-status" class="backup-status is-loading">Checking…</div>
        <form id="set-waitlist" style="display:flex;flex-direction:column;gap:13px;margin-top:14px">
          <label style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border:1px solid var(--border);border-radius:11px;cursor:pointer">
            <input type="checkbox" name="waitlist_enabled" ${s.waitlist_enabled === '1' ? 'checked' : ''} class="chk">
            <span><b>Let customers join a waitlist</b><span class="co-hint">Adds "put me on the waitlist" to your
              booking page when their time isn't free. Nothing is sent — the list just builds up.</span></span>
          </label>
          <label style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border:1px solid var(--border);border-radius:11px;cursor:pointer">
            <input type="checkbox" name="waitlist_autofill" ${s.waitlist_autofill === '1' ? 'checked' : ''} class="chk">
            <span><b>Offer a cancelled slot automatically</b><span class="co-hint">The one thing Kairo does without
              asking you first — because a Saturday that frees up at 8pm on Thursday is worth far more than the same
              slot offered on Friday lunchtime, and you'll be cutting hair. Off unless you turn it on.</span></span>
          </label>
          <div class="form-grid">
            <div class="field"><label>Send offers by</label>
              <select name="waitlist_channel" class="nice-select">
                ${[['email', 'Email — free'], ['sms', 'SMS — costs credit, but gets read'], ['both', 'Email + SMS']]
                  .map(([v, l]) => `<option value="${v}" ${(s.waitlist_channel || 'email') === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select></div>
            <div class="field"><label>How many people per slot</label>
              <select name="waitlist_max_offers" class="nice-select">
                ${[1, 3, 5, 10].map((n) => `<option value="${n}" ${String(s.waitlist_max_offers || '5') === String(n) ? 'selected' : ''}>${n === 1 ? 'Just the first' : `First ${n}`}</option>`).join('')}
              </select>
              <div class="hint">First to book gets it. Nobody else is told it's gone.</div></div>
          </div>
          <button class="btn primary" style="align-self:flex-start">${icon('check')} Save waitlist</button>
        </form>
      </div>

      <div class="card">
        <div class="card-title">Backups</div>
        <div class="card-sub" style="margin-bottom:16px">Your whole business — every client, appointment,
          invoice and payment — lives in one file. If the machine it sits on is ever lost, this is what
          gets it back. A copy is emailed to you so it isn't stored next to the original.</div>
        <div id="backup-status" class="backup-status is-loading">Checking…</div>
        <form id="set-backup" style="display:flex;flex-direction:column;gap:13px;margin-top:14px">
          <label style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border:1px solid var(--border);border-radius:11px;cursor:pointer">
            <input type="checkbox" name="backup_email_enabled" ${s.backup_email_enabled !== '0' ? 'checked' : ''} class="chk">
            <span><b>Email me a backup automatically</b><span class="co-hint">Sent to your business email as a small compressed file.</span></span>
          </label>
          <div class="form-grid">
            <div class="field"><label>How often</label>
              <select name="backup_frequency" class="nice-select">
                ${[['daily', 'Every day'], ['weekly', 'Every week'], ['fortnightly', 'Every fortnight']]
                  .map(([v, l]) => `<option value="${v}" ${(s.backup_frequency || 'weekly') === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select></div>
            <div class="field"><label>Send to</label>
              <input name="backup_email_to" value="${esc(s.backup_email_to || '')}" placeholder="${esc(s.business_email || 'your business email')}"></div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn primary" type="submit">${icon('check')} Save</button>
            <button class="btn" type="button" id="backup-now">${icon('send')} Send one now</button>
            <button class="btn" type="button" id="backup-download">${icon('download')} Download a copy</button>
          </div>
        </form>
      </div>

      ${s.operator_mode !== '1' ? '' : `
      <div class="card">
        <div class="card-title">Cloudflare protection</div>
        <div class="card-sub" style="margin-bottom:16px">Optional. If your booking link runs through Cloudflare,
          these two settings make that protection actually count. Leave them alone and nothing changes —
          Kairo's own limits and checks are on either way.</div>

        <div class="edge-block">
          <div class="edge-head">
            <b>Only accept traffic through Cloudflare</b>
            <span id="edge-mode-pill" class="pill">…</span>
          </div>
          <div class="card-sub" style="margin:6px 0 12px">Cloudflare filters bad traffic, but the address underneath
            stays reachable — anyone who finds it walks straight past the filtering. This makes Kairo refuse
            anything that didn't come through Cloudflare.</div>
          <div id="edge-status" class="backup-status is-loading">Checking…</div>
          <div id="edge-secret-out"></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:13px">
            <button class="btn" type="button" id="edge-secret">${icon('shield')} <span>Generate the secret</span></button>
            <button class="btn" type="button" id="edge-monitor">${icon('eye')} Watch only</button>
            <button class="btn" type="button" id="edge-enforce">${icon('lock')} Turn the lock on</button>
            <button class="btn" type="button" id="edge-off">Turn it off</button>
          </div>
        </div>

        <form id="set-turnstile" class="edge-block" style="display:flex;flex-direction:column;gap:13px;margin-top:16px">
          <div class="edge-head"><b>"I'm not a robot" check on the booking page</b></div>
          <div class="card-sub" style="margin:-4px 0 2px">Your booking page has no login by design, so anything that
            finds it can create appointments. This puts Cloudflare's Turnstile check on the form — most customers
            never have to touch it. Create a free widget at Cloudflare → Turnstile and paste both keys here.</div>
          <label style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border:1px solid var(--border);border-radius:11px;cursor:pointer">
            <input type="checkbox" name="turnstile_enabled" ${s.turnstile_enabled === '1' ? 'checked' : ''} class="chk">
            <span><b>Check visitors before taking a booking</b><span class="co-hint">Only takes effect once both keys below are saved.</span></span>
          </label>
          <div class="field"><label>Site key</label>
            <input name="turnstile_site_key" value="${esc(s.turnstile_site_key || '')}" placeholder="0x4AAAAAAA…">
            <div class="hint">The public half. Safe to be seen.</div></div>
          <div class="field"><label>Secret key</label>
            <input name="turnstile_secret_key" type="password" autocomplete="new-password"
              placeholder="${s.turnstile_secret_key_set ? 'Saved — leave blank to keep it' : '0x4AAAAAAA…'}">
            <div class="hint">Stored write-only. Type <b>__clear__</b> to remove it.</div></div>
          <button class="btn primary" style="align-self:flex-start">${icon('check')} Save check</button>
        </form>
      </div>`}

      <div class="card">
        <div class="card-title">Locations</div>
        <div class="card-sub" style="margin-bottom:16px">Running more than one branch? Each team member belongs to a location;
          the calendar and booking page get a location picker automatically.</div>
        <div id="loc-list">
          ${state.locations.map((l) => `
            <div class="list-item">
              <span class="st-icon tint-cyan" style="width:28px;height:28px">${icon('globe')}</span>
              <div style="flex:1"><div class="cell-main">${esc(l.name)}</div>
                <div class="cell-sub">${esc(l.address || '')}${l.phone ? ` · ${esc(l.phone)}` : ''}</div></div>
              <button class="icon-btn" data-edit-loc="${l.id}">${icon('edit')}</button>
            </div>`).join('')}
        </div>
        <button class="btn" id="loc-add" style="margin-top:12px">${icon('plus')} Add location</button>
      </div>

      <div class="card">
        <div class="card-title">Your account</div>
        <div class="card-sub" style="margin-bottom:16px">Signed in as ${esc(state.user.email)}</div>
        <div class="hint" style="margin-bottom:14px">Your own name, password, email verification and plan live on your
          Account page. This page is for the business itself.</div>
        <a class="btn" href="#/account">${icon('user')} Open your account</a>
        ${state.user.email_verified ? '' : `
        <div style="border-top:1px solid var(--border);margin-top:20px;padding-top:16px">
          <div class="card-title" style="font-size:13.5px">Guided setup</div>
          <div class="card-sub" style="margin-bottom:12px">Re-run the step-by-step setup wizard to adjust your details, hours and branding.</div>
          <button class="btn" id="rerun-setup">${icon('zap')} Re-run setup wizard</button>
          <button class="btn" id="rerun-tour">${icon('grid')} Show me around again</button>
        </div>
        <div style="border-top:1px solid var(--border);margin-top:20px;padding-top:16px">
          <div class="card-title" style="font-size:13.5px">Demo data</div>
          <div class="card-sub" style="margin-bottom:12px">Wipe everything and restore the sample dataset. Useful before a sales demo.</div>
          <button class="btn danger" id="reset-demo">${icon('zap')} Reset to demo data</button>
        </div>`}
      </div>
    </div>`;

  const saveSettings = async (form, fields) => {
    const fd = new FormData(form);
    const payload = {};
    for (const f of fields) {
      const el = form.elements[f];
      // Unchecked checkboxes are absent from FormData; checked ones report
      // "on" — normalize every checkbox field to the '1'/'0' the API expects.
      payload[f] = el?.type === 'checkbox' ? (el.checked ? '1' : '0') : (fd.get(f) ?? '');
    }
    state.settings = await api.put('/api/settings', payload);
    setCurrency(state.settings.currency);
    toast('Settings saved');
  };

  container.querySelector('#set-profile').addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings(e.target, ['business_name', 'business_phone', 'business_email', 'business_address']);
  });
  // Each weekday row reveals only the controls its own answer needs: a start
  // date once it repeats, times once it keeps its own hours.
  const weekRules = container.querySelector('#week-rules');
  weekRules.addEventListener('change', (e) => {
    const row = e.target.closest('.wk-row');
    if (!row) return;
    if (e.target.matches('[data-freq]')) {
      const every = Number(e.target.value);
      row.classList.toggle('off', every === 0);
      row.querySelector('.wk-extra').hidden = every === 0;
      row.querySelector('.wk-when').hidden = every <= 1;
    }
    if (e.target.matches('[data-custom]')) {
      row.querySelector('.wk-times').hidden = !e.target.checked;
    }
  });
  container.querySelector('#set-hours').addEventListener('submit', async (e) => {
    e.preventDefault();
    const week = readWeekRules(container);
    if (week.error) { toast(week.error, 'err'); return; }
    const fd = new FormData(e.target);
    state.settings = await api.put('/api/settings', {
      open_min: fd.get('open_min'), close_min: fd.get('close_min'),
      slot_interval: fd.get('slot_interval'),
      booking_lead_min: fd.get('booking_lead_min'),
      rebook_weeks_default: fd.get('rebook_weeks_default'),
      booking_horizon_days: fd.get('booking_horizon_days'),
      // One control on screen, two settings underneath: "no online cancelling"
      // is the switch, anything else is the notice period.
      client_cancel_enabled: fd.get('cancel_window_hours') === 'off' ? '0' : '1',
      ...(fd.get('cancel_window_hours') === 'off' ? {} : { cancel_window_hours: fd.get('cancel_window_hours') }),
      cal_start_min: fd.get('cal_start_min') || '',
      cal_end_min: fd.get('cal_end_min') || '',
      business_tz: String(fd.get('business_tz') || '').trim(),
      booking_enabled: e.target.elements.booking_enabled.checked ? '1' : '0',
      open_days: week.open_days,
      day_rules: week.day_rules,
    });
    // The server snaps each repeating day's start date onto its own weekday, so
    // redraw the rows from what was actually stored.
    weekRules.innerHTML = weekRulesHtml(state.settings);
    toast('Hours saved');
  });
  container.querySelector('#set-billing').addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings(e.target, ['currency', 'tax_rate', 'invoice_prefix', 'invoice_due_days', 'invoice_footer']);
  });
  // booking page appearance
  let brandLogo = s.brand_logo || '';
  let brandCover = s.brand_cover || '';
  const brandForm = container.querySelector('#set-brand');

  container.querySelector('#brand-schemes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-scheme]');
    if (!b) return;
    brandForm.querySelector('[name=brand_scheme]').value = b.dataset.scheme;
    container.querySelectorAll('#brand-schemes [data-scheme]').forEach((x) => {
      const on = x === b;
      x.setAttribute('aria-pressed', String(on));
      x.style.borderColor = on ? 'var(--accent)' : 'var(--border)';
    });
  });


  container.querySelector('#brand-swatches').addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]');
    if (!b) return;
    brandForm.querySelector('[name=brand_accent]').value = b.dataset.c;
    container.querySelectorAll('#brand-swatches [data-c]').forEach((x) =>
      x.classList.toggle('is-on', x.dataset.c === b.dataset.c));
  });

  const readImage = (file, maxKb) => new Promise((resolve, reject) => {
    if (file.size > maxKb * 1024) { reject(new Error(`Image must be under ${maxKb} KB. Try a smaller one.`)); return; }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.readAsDataURL(file);
  });

  // logo
  const logoFile = container.querySelector('#brand-logo-file');
  container.querySelector('#brand-logo-pick').onclick = () => logoFile.click();
  logoFile.addEventListener('change', async () => {
    if (!logoFile.files[0]) return;
    try {
      brandLogo = await readImage(logoFile.files[0], 250);
      const prev = container.querySelector('#brand-logo-preview');
      prev.src = brandLogo; prev.style.display = '';
      container.querySelector('#brand-logo-clear').style.display = '';
    } catch (err) { toast(err.message, 'err'); }
  });
  container.querySelector('#brand-logo-clear').onclick = (e) => {
    brandLogo = '';
    container.querySelector('#brand-logo-preview').style.display = 'none';
    e.target.style.display = 'none';
  };

  // cover
  const coverFile = container.querySelector('#brand-cover-file');
  container.querySelector('#brand-cover-pick').onclick = () => coverFile.click();
  coverFile.addEventListener('change', async () => {
    if (!coverFile.files[0]) return;
    try {
      brandCover = await readImage(coverFile.files[0], 600);
      const prev = container.querySelector('#brand-cover-preview');
      prev.src = brandCover; prev.style.display = '';
      container.querySelector('#brand-cover-clear').style.display = '';
    } catch (err) { toast(err.message, 'err'); }
  });
  container.querySelector('#brand-cover-clear').onclick = (e) => {
    brandCover = '';
    container.querySelector('#brand-cover-preview').style.display = 'none';
    e.target.style.display = 'none';
  };

  brandForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(brandForm);
    try {
      const schemeId = fd.get('brand_scheme') || 'midnight';
      state.settings = await api.put('/api/settings', {
        brand_scheme: schemeId,
        brand_theme: (SCHEMES[schemeId]?.mode === 'light') ? 'light' : 'dark', // back-compat
        brand_font: fd.get('brand_font'),
        brand_accent: fd.get('brand_accent'),
        brand_tagline: fd.get('brand_tagline'),
        brand_logo: brandLogo,
        brand_cover: brandCover,
      });
      toast('Booking page updated. Open it to see the new look.');
    } catch (err) {
      toast(err.message.includes('large') ? 'Those images are too large together. Remove one or use smaller files.' : err.message, 'err');
    }
  });

  container.querySelector('#set-notif').addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings(e.target, [
      'confirm_enabled', 'reminders_enabled', 'receipts_enabled', 'review_requests_enabled',
      'chan_confirmation', 'chan_reminder', 'chan_receipt', 'chan_review_request',
      'owner_notify_enabled',
      'reminder_hours', 'review_delay_hours', 'google_review_url', 'public_url',
      'resend_api_key', 'notif_from_email',
    ]);
  });
  // Show only the selected provider's credential fields.
  const smsProvider = container.querySelector('#sms-provider');
  const SMS_HINTS = {
    clicksend: 'Australian, pay-as-you-go, no monthly fee (~6¢/text). Sign up at clicksend.com, top up, paste your username + API key.',
    telnyx: 'Cheapest per text (~2–4¢) but onboarding needs KYC + sender registration. Best if you\'re comfortable with a developer console.',
    twilio: 'Reliable and global, but pricier for Australia and rents you a number monthly. Paste your SID, auth token and Twilio number.',
  };
  const syncSmsFields = () => {
    const p = smsProvider.value;
    container.querySelectorAll('.sms-fields').forEach((el) => {
      el.style.display = el.dataset.provider === p ? '' : 'none';
    });
    container.querySelector('#sms-provider-hint').textContent = SMS_HINTS[p] || '';
  };
  smsProvider.addEventListener('change', () => { syncSmsFields(); loadCredit(); });
  syncSmsFields();

  // --- SMS credit ----------------------------------------------------------
  // Prepaid credit is the one thing that stops texts without warning, so it is
  // shown where the owner turns SMS on, and refreshed when they save new keys.
  const creditEl = container.querySelector('#sms-credit');
  const loadCredit = (refresh = false) => mountSmsCredit(creditEl, api, { refresh });
  creditEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-credit-refresh]')) loadCredit(true);
  });
  loadCredit();

  // The starter-sender nag. Dismissing hides it; changing the sender retires it
  // for good, because the flag is derived from comparing the two — there is no
  // stored "resolved" state to go stale.
  const starterNag = container.querySelector('#starter-nag');
  if (starterNag) {
    container.querySelector('#starter-dismiss').onclick = async () => {
      starterNag.remove();
      try { await api.put('/api/settings', { clicksend_starter_dismissed: '1' }); } catch { /* cosmetic */ }
    };
  }

  container.querySelector('#set-sms').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveSettings(e.target, [
      'sms_notifications_enabled', 'sms_provider',
      'clicksend_username', 'clicksend_api_key', 'clicksend_from',
      'telnyx_api_key', 'telnyx_from', 'telnyx_profile_id',
      'twilio_sid', 'twilio_token', 'twilio_from',
    ]);
    loadCredit(true);   // new keys → new account → re-read rather than show the old one
    // Putting their own sender in is what resolves the nag, so re-draw rather
    // than leave a banner up that is no longer true. saveSettings has already
    // refreshed state.settings, so the redraw reflects the server's answer.
    if (starterNag && state.settings.clicksend_starter_active !== '1') renderSettings(container);
  });
  // The tour can always be taken again — an owner who skipped it on day one
  // often wants it in week two, and hunting for a hidden setting is not how
  // they will find it.
  const tourBtn = container.querySelector('#rerun-tour');
  if (tourBtn) {
    tourBtn.onclick = async () => {
      const { runTour } = await import('../tour.js');
      location.hash = '#/dashboard';
      setTimeout(() => runTour({ force: true }), 600);
    };
  }

  // --- Waitlist ------------------------------------------------------------
  // The status line matters more than the switches: an owner who turned
  // auto-fill on months ago should be able to see at a glance whether it has
  // ever actually done anything.
  const wlEl = container.querySelector('#wl-status');
  const paintWaitlist = (d) => {
    if (!d) { wlEl.className = 'backup-status is-warn'; wlEl.textContent = "Couldn't read the waitlist."; return; }
    const { waiting, offered, offers_sent_30d: sent } = d.stats;
    if (!d.enabled) {
      wlEl.className = 'backup-status is-loading';
      wlEl.innerHTML = `${icon('clock', 15)} <span><b>Off.</b> Customers can't join a waitlist yet, so there
        is nobody to offer a cancelled slot to.</span>`;
      return;
    }
    if (!waiting && !offered) {
      wlEl.className = 'backup-status is-loading';
      wlEl.innerHTML = `${icon('users', 15)} <span><b>On, and nobody has joined yet.</b> The option shows on
        your booking page when the time someone wants isn't free.</span>`;
      return;
    }
    wlEl.className = 'backup-status is-ok';
    wlEl.innerHTML = `${icon('check', 15)} <span><b>${waiting} waiting</b>${offered ? `, ${offered} already offered something` : ''}.
      ${d.autofill
        ? `${sent} offer${sent === 1 ? '' : 's'} sent in the last 30 days.`
        : '<b>Automatic offers are off</b> — the list is building, but nothing goes out.'}</span>`;
  };
  const loadWaitlist = async () => { try { paintWaitlist(await api.get('/api/waitlist')); } catch { paintWaitlist(null); } };
  loadWaitlist();

  container.querySelector('#set-waitlist').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveSettings(e.target, ['waitlist_enabled', 'waitlist_autofill', 'waitlist_channel', 'waitlist_max_offers']);
    loadWaitlist();
  });

  // --- Backups -------------------------------------------------------------
  // The status line is the whole point of the panel: a backup that quietly
  // stopped working months ago is worse than none, because it is believed.
  const backupEl = container.querySelector('#backup-status');
  const paintBackup = (st) => {
    if (!st) { backupEl.className = 'backup-status is-loading'; backupEl.textContent = 'Checking…'; return; }
    const when = st.last_at
      ? new Date(st.last_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
      : null;
    const size = st.last_bytes ? ` · ${(st.last_bytes / 1024).toFixed(0)} KB` : '';
    if (!when) {
      backupEl.className = 'backup-status is-warn';
      backupEl.innerHTML = `${icon('alert', 15)} <span><b>No backup has been sent yet.</b>
        Send one now to prove the whole path works before you rely on it.</span>`;
      return;
    }
    backupEl.className = `backup-status ${st.last_ok ? 'is-ok' : 'is-warn'}`;
    backupEl.innerHTML = st.last_ok
      ? `${icon('check', 15)} <span><b>Last backup ${esc(when)}</b>${esc(size)} — ${esc(st.last_detail || '')}</span>`
      : `${icon('alert', 15)} <span><b>Last attempt failed (${esc(when)})</b> — ${esc(st.last_detail || '')}</span>`;
  };
  const loadBackup = async () => { try { paintBackup(await api.get('/api/backup/status')); } catch { paintBackup(null); } };
  loadBackup();

  container.querySelector('#set-backup').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveSettings(e.target, ['backup_email_enabled', 'backup_frequency', 'backup_email_to']);
    loadBackup();
  });
  container.querySelector('#backup-now').onclick = async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const was = btn.innerHTML;
    btn.innerHTML = 'Sending…';
    try {
      const res = await api.post('/api/backup/email', {});
      toast(res.ok ? res.detail : res.detail, res.ok ? 'ok' : 'err', { ms: res.ok ? 5000 : 9000 });
      paintBackup(res.status);
    } catch (err) { toast(err.message, 'err'); }
    btn.disabled = false; btn.innerHTML = was;
  };
  container.querySelector('#backup-download').onclick = () => {
    // A plain navigation, so the browser's own download handles it — this is a
    // multi-megabyte file and should never be held in memory to be re-emitted.
    window.location.href = '/api/backup/download';
  };

  // --- Cloudflare ----------------------------------------------------------
  // The whole panel is written around one hazard: turning the lock on while
  // Cloudflare isn't forwarding the header shuts the owner out of this screen.
  // So the state is always shown, the counter is the evidence, and the server
  // refuses Enforce unless the request asking for it already came through.
  // Operator-only. The card is not rendered for a business owner, so none of
  // this may assume its elements exist — reaching for them unguarded threw and
  // took the whole Settings page down with it.
  if (container.querySelector('#edge-status')) {
    const edgeEl = container.querySelector('#edge-status');
    const edgePill = container.querySelector('#edge-mode-pill');
    const edgeOut = container.querySelector('#edge-secret-out');
    const MODE_LABEL = { off: 'Off', monitor: 'Watching', enforce: 'On' };

    const paintEdge = (st) => {
      if (!st) {
        edgePill.textContent = '—';
        edgeEl.className = 'backup-status is-warn';
        edgeEl.textContent = "Couldn't read the current state.";
        return;
      }
      const o = st.origin;
      edgePill.textContent = MODE_LABEL[o.mode] || o.mode;
      edgePill.className = `pill ${o.mode === 'enforce' ? 'ok' : o.mode === 'monitor' ? 'warn' : ''}`;
      container.querySelector('#edge-secret').querySelector('span').textContent =
        o.secret_set ? 'Generate a new secret' : 'Generate the secret';

      const seen = o.direct_count
        ? `<b>${o.direct_count} request${o.direct_count === 1 ? '' : 's'}</b> reached Kairo without going through Cloudflare`
          + (o.direct_last_path ? ` (last: <code>${esc(o.direct_last_path)}</code>)` : '')
        : 'Nothing has reached Kairo directly since the count started';

      if (o.forced_by_env) {
        edgeEl.className = 'backup-status is-warn';
        edgeEl.innerHTML = `${icon('alert', 15)} <span><b>Overridden on the server.</b>
          KAIRO_ORIGIN_LOCK is set in this service's environment, so it wins over anything chosen here.</span>`;
        return;
      }
      if (!o.secret_set) {
        edgeEl.className = 'backup-status is-loading';
        edgeEl.innerHTML = `${icon('shield', 15)} <span><b>Not set up.</b> Generate the secret below, put it into
          Cloudflare as a request header, then come back and switch this to <b>Watch only</b>.</span>`;
        return;
      }
      if (o.mode === 'off') {
        edgeEl.className = 'backup-status is-loading';
        edgeEl.innerHTML = `${icon('shield', 15)} <span><b>Secret ready, lock off.</b> ${seen}. Switch to
          <b>Watch only</b> to start checking without blocking anything.</span>`;
        return;
      }
      if (o.mode === 'monitor') {
        edgeEl.className = `backup-status ${o.direct_count ? 'is-warn' : 'is-ok'}`;
        edgeEl.innerHTML = `${icon(o.direct_count ? 'alert' : 'check', 15)} <span><b>Watching, not blocking.</b> ${seen}.
          ${o.direct_count
            ? 'Fix the Cloudflare rule first — turning the lock on now would block that traffic too.'
            : 'That is what you want to see before turning the lock on.'}</span>`;
        return;
      }
      edgeEl.className = 'backup-status is-ok';
      edgeEl.innerHTML = `${icon('lock', 15)} <span><b>Lock on.</b> Anything that doesn't come through Cloudflare
        is refused. ${seen} — those were turned away.</span>`;
    };

    const loadEdge = async () => { try { paintEdge(await api.get('/api/edge/status')); } catch { paintEdge(null); } };
    loadEdge();

    const setLock = async (mode) => {
      try {
        paintEdge({ origin: await api.post('/api/edge/lock-mode', { mode }), turnstile: {} });
        toast(mode === 'off' ? 'Lock turned off' : mode === 'monitor' ? 'Watching — nothing is being blocked' : 'Lock on', 'ok');
        loadEdge();
      } catch (err) { toast(err.message, 'err', { ms: 11000 }); }
    };
    container.querySelector('#edge-off').onclick = () => setLock('off');
    container.querySelector('#edge-monitor').onclick = () => setLock('monitor');
    container.querySelector('#edge-enforce').onclick = () => setLock('enforce');

    container.querySelector('#edge-secret').onclick = async () => {
      const ok = await confirmDialog('Generate a new secret?',
        'The old one stops working straight away. Cloudflare has to be updated with the new value, '
        + 'or its traffic will start arriving unrecognised.',
        { okText: 'Generate' });
      if (!ok) return;
      try {
        const res = await api.post('/api/edge/origin-secret', {});
        // Shown once, in full, because it has to be pasted into Cloudflare — and
        // never readable again afterwards.
        edgeOut.innerHTML = `
          <div class="edge-secret">
            <div class="card-sub" style="margin-bottom:8px"><b>Copy this now — it isn't shown again.</b>
              In Cloudflare: <b>Rules → Transform Rules → Modify Request Header → Create rule</b>,
              apply to all incoming requests, and set a static header:</div>
            <div class="kv"><span>Header name</span><code>${esc(res.header)}</code></div>
            <div class="kv"><span>Value</span><code>${esc(res.secret)}</code></div>
            ${res.stepped_down ? `<div class="hint" style="margin-top:8px">The lock was moved back to
              <b>Watch only</b> so the old value can't shut you out while you update Cloudflare.</div>` : ''}
          </div>`;
        loadEdge();
      } catch (err) { toast(err.message, 'err'); }
    };

    container.querySelector('#set-turnstile').addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveSettings(e.target, ['turnstile_enabled', 'turnstile_site_key', 'turnstile_secret_key']);
      loadEdge();
    });

  }

  container.querySelector('#set-payments').addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings(e.target, ['stripe_secret_key', 'deposit_type', 'deposit_value', 'currency_code']);
  });
  const posCardForm = container.querySelector('#set-poscard');
  posCardForm.addEventListener('change', () => {
    posCardForm.querySelectorAll('.pay-opt').forEach((l) => l.classList.toggle('sel', l.querySelector('input').checked));
  });
  posCardForm.addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings(e.target, ['pos_card_method']);
  });
  const openLocationModal = (loc = null) => {
    const m = openModal({
      title: loc ? 'Edit location' : 'Add location',
      body: `
        <form id="loc-form" class="form-grid">
          <div class="field span2"><label>Name *</label><input name="name" required value="${esc(loc?.name || '')}" placeholder="Downtown branch"></div>
          <div class="field"><label>Address</label><input name="address" value="${esc(loc?.address || '')}"></div>
          <div class="field"><label>Phone</label><input name="phone" value="${esc(loc?.phone || '')}"></div>
        </form>`,
      footer: `
        ${loc ? `<button class="btn danger" id="loc-del">${icon('trash')} Remove</button>` : ''}
        <div class="spacer"></div>
        <button class="btn primary" id="loc-save">${icon('check')} ${loc ? 'Save' : 'Add'}</button>`,
    });
    m.querySelector('#loc-save').onclick = async () => {
      const fd = new FormData(m.querySelector('#loc-form'));
      if (!String(fd.get('name') || '').trim()) { toast('Location name is required', 'err'); return; }
      const payload = { name: fd.get('name'), address: fd.get('address'), phone: fd.get('phone'), active: true };
      try {
        if (loc) await api.put(`/api/locations/${loc.id}`, payload);
        else await api.post('/api/locations', payload);
        toast(loc ? 'Location updated' : 'Location added');
        m.close(); await refreshLookups(); renderSettings(container);
      } catch (err) { toast(err.message, 'err'); }
    };
    if (loc) {
      m.querySelector('#loc-del').onclick = async () => {
        const ok = await confirmDialog('Remove location', `Remove <b>${esc(loc.name)}</b>? Locations with team members assigned are deactivated instead.`, { danger: true, okText: 'Remove' });
        if (!ok) return;
        try {
          await api.del(`/api/locations/${loc.id}`);
          toast('Location removed');
          m.close(); await refreshLookups(); renderSettings(container);
        } catch (err) { toast(err.message, 'err'); }
      };
    }
  };
  container.querySelector('#loc-add').onclick = () => openLocationModal();
  container.querySelectorAll('[data-edit-loc]').forEach((b) => {
    b.onclick = () => openLocationModal(state.locations.find((l) => l.id === Number(b.dataset.editLoc)));
  });
  container.querySelector('#copy-url').onclick = async () => {
    const field = container.querySelector('#book-url');
    if (await copyText(field.value)) toast('Booking link copied');
    else { field.select(); toast('Could not copy automatically — the link is selected, press copy', 'err'); }
  };
  container.querySelector('#open-url').onclick = () => openExternal(container.querySelector('#book-url').value);
  // Only offered where there is a share sheet to offer — on a desktop it would
  // be a second Copy button wearing a different name.
  const shareBtn = container.querySelector('#share-url');
  if (navigator.share) {
    shareBtn.hidden = false;
    shareBtn.onclick = async () => {
      const how = await shareLink(container.querySelector('#book-url').value, `Book with ${state.settings.business_name || 'us'}`);
      if (how === 'copied') toast('Booking link copied');
      else if (how === 'failed') toast('Could not share that link', 'err');
    };
  }
  // The nag only appears when the address is wrong, and only carries a button
  // when the owner is actually allowed to change it — so both of these are
  // conditional, and neither may be assumed present.
  const fixRaw = container.querySelector('#fix-raw-link');
  if (fixRaw) fixRaw.onclick = () => {
    // Take them to the field rather than explaining where it is. It lives in a
    // different card further down the page, which is precisely why nobody
    // finds it on their own.
    const field = container.querySelector('[name="public_url"]');
    if (!field) return;
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    field.focus();
    field.select?.();
  };
  // Guided-setup + demo-reset controls only exist before the owner verifies
  // their email (a real, verified business has no need to wipe & reseed).
  const rerunBtn = container.querySelector('#rerun-setup');
  if (rerunBtn) rerunBtn.onclick = async () => {
    const { runSetupWizard } = await import('../wizard.js');
    runSetupWizard({ firstRun: false, settings: state.settings, onDone: () => { location.hash = '#/settings'; location.reload(); } });
  };
  const resetBtn = container.querySelector('#reset-demo');
  if (resetBtn) resetBtn.onclick = async () => {
    const ok = await confirmDialog('Reset to demo data',
      'This <b>deletes all clients, appointments, services and invoices</b> and restores the sample dataset. This cannot be undone.',
      { danger: true, okText: 'Wipe & reseed' });
    if (!ok) return;
    await api.post('/api/settings/reset-demo');
    toast('Demo data restored');
    location.hash = '#/dashboard';
    location.reload();
  };
}
