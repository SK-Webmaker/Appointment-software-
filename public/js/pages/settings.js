// Settings: business profile, hours, billing defaults, notifications,
// payments/deposits, locations, booking link, password.
import { api } from '../api.js';
import { esc, icon, toast, timeOptions, setCurrency, confirmDialog, openModal } from '../ui.js';
import { state, refreshLookups } from '../app.js';
import { SCHEMES } from '../schemes.js';

// Secret keys are never sent to the browser — the API returns a `<key>_set`
// flag instead. These render the "already saved" affordance.
const keySaved = (set) => (set === '1'
  ? ' <span style="color:var(--green);font-weight:600;font-size:11px">● saved</span>' : '');
const keyPlaceholder = (set, empty) => (set === '1' ? '•••••••••• — leave blank to keep' : empty);


export async function renderSettings(container) {
  const s = state.settings;
  const bookingUrl = `${location.origin}/book`;

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
      <select name="${chanKey}" class="notif-chan" aria-label="${label} — send by">
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
          <div class="field"><label>Days you're open</label>
            <div id="open-days" style="display:flex;gap:6px;flex-wrap:wrap">
              ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => {
                const on = String(s.open_days ?? '0,1,2,3,4,5,6').split(',').map(Number).includes(i);
                return `<button type="button" class="btn small ${on ? 'primary' : ''}" data-day="${i}" aria-pressed="${on}">${d}</button>`;
              }).join('')}
            </div>
            <div class="hint">Closed days never appear as options on the customer booking page. Staff can still add walk-ins on closed days from the calendar.</div></div>
          <div class="form-grid">
            <div class="field"><label>Online booking slot interval</label>
              <select name="slot_interval">${[10, 15, 20, 30, 60].map((v) => `<option value="${v}" ${Number(s.slot_interval) === v ? 'selected' : ''}>${v} minutes</option>`).join('')}</select></div>
            <div class="field"><label>Minimum booking notice</label>
              <select name="booking_lead_min">${[
                [0, 'None — up to the last minute'], [15, '15 minutes ahead'], [30, '30 minutes ahead'],
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
          <div class="hint" style="margin-top:-4px">How much of the day your calendar shows and scrolls through — set it wider to slot in early/late walk-ins. Appointments outside this window still always show.</div>
          <div class="field"><label>Usual rebooking gap</label>
            <select name="rebook_weeks_default" class="nice-select">${[2, 3, 4, 5, 6, 8, 10, 12]
              .map((w) => `<option value="${w}" ${Number(s.rebook_weeks_default || 4) === w ? 'selected' : ''}>${w} weeks</option>`).join('')}</select>
            <div class="hint">What <b>Rebook</b> suggests when you book a client's next visit from the calendar. You can still change it each time.</div></div>
          <div class="field"><label>Time zone</label>
            <input name="business_tz" value="${esc(s.business_tz || '')}" placeholder="${esc(Intl.DateTimeFormat().resolvedOptions().timeZone || 'e.g. Australia/Melbourne')}">
            <div class="hint">Auto-detected from your device — it keeps the booking page showing the right upcoming times. Only change it if your salon is in a different zone to you.</div></div>
          <div class="field">
            <label style="display:flex;align-items:center;gap:8px;font-weight:500;color:var(--text-2);cursor:pointer">
              <input type="checkbox" name="booking_enabled" ${s.booking_enabled === '1' ? 'checked' : ''} class="chk">
              Accept online bookings</label></div>
          <div class="field"><label>Your booking link</label>
            <div class="copy-row">
              <input readonly value="${esc(bookingUrl)}" id="book-url">
              <button type="button" class="btn" id="copy-url">${icon('link')} Copy</button>
            </div>
            <div class="hint">Put this link in your Instagram bio, Google profile and WhatsApp auto-reply.</div></div>
          <button class="btn primary" style="align-self:flex-start">${icon('check')} Save hours</button>
        </form>
      </div>

      <div class="card">
        <div class="card-title">Booking page appearance</div>
        <div class="card-sub" style="margin-bottom:16px">Make the customer booking page match the business's brand —
          logo, colour and light/dark style. <a href="/book" target="_blank">Open the booking page ↗</a> to preview.</div>
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
            <div class="hint">The whole booking page — background, cards, text — takes this scheme; your brand colour below is used for buttons and highlights on top of it.</div></div>
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
          (free up to 3,000/mo — plenty for this). Paste keys, hit save, send a test from the
          <a href="#/messages">Messages</a> page.</div>
        <form id="set-notif" style="display:flex;flex-direction:column;gap:13px">
          <div>
            <div class="notif-head"><span>Customer notification</span><span>Send by</span></div>
            ${notifRow('confirm_enabled', 'chan_confirmation', 'Booking confirmations', 'Sent the moment a booking is made.')}
            ${notifRow('reminders_enabled', 'chan_reminder', 'Appointment reminders', 'Sent a set number of hours before the visit.')}
            ${notifRow('receipts_enabled', 'chan_receipt', 'Payment receipts', 'Sent the moment a payment or deposit is recorded.')}
            ${notifRow('review_requests_enabled', 'chan_review_request', 'Review requests', 'Sent after a visit is marked Completed.')}
            <div class="hint" style="margin-top:8px">Choose Email, SMS, or both for each. <b>SMS options only take effect once you turn on “Also send SMS” below</b> and add a provider — until then everything goes by email (so nothing is billed by accident).</div>
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
            <input name="public_url" value="${esc(s.public_url || '')}" placeholder="${esc(location.origin)}">
            <div class="hint">Used to build review links in messages. Auto-filled during setup — only change this if you move to a custom domain.</div></div>
          <div class="field"><label>Resend API key (email)${keySaved(s.resend_api_key_set)}</label>
            <input name="resend_api_key" type="password" value="" placeholder="${keyPlaceholder(s.resend_api_key_set, 're_…')}" autocomplete="off"></div>
          <div class="field"><label>From email (verified in Resend)</label>
            <input name="notif_from_email" value="${esc(s.notif_from_email || '')}" placeholder="bookings@yourdomain.com"></div>
          <button class="btn primary" style="align-self:flex-start">${icon('check')} Save notifications</button>
        </form>
      </div>

      <div class="card">
        <div class="card-title">SMS (text messages)</div>
        <div class="card-sub" style="margin-bottom:16px">This is the master switch for SMS. Turn it on and the types you set to
          <b>SMS</b> or <b>Email + SMS</b> above will text as well. SMS costs money per message (there's no free option), so
          it's <b>off by default</b> — nothing is billed unless you turn it on. You're billed by the provider directly, no markup.</div>
        <form id="set-sms" style="display:flex;flex-direction:column;gap:13px">
          <label style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border:1px solid var(--border);border-radius:11px;cursor:pointer">
            <input type="checkbox" name="sms_notifications_enabled" ${s.sms_notifications_enabled === '1' ? 'checked' : ''} class="chk">
            <span><b>Turn SMS on</b> — activates the SMS / Email + SMS choices you set per notification type above</span>
          </label>
          <div class="field"><label>SMS provider</label>
            <select name="sms_provider" id="sms-provider">
              <option value="clicksend" ${(s.sms_provider || 'clicksend') === 'clicksend' ? 'selected' : ''}>ClickSend — simplest setup, great for Australia</option>
              <option value="telnyx" ${s.sms_provider === 'telnyx' ? 'selected' : ''}>Telnyx — cheapest per message, more setup</option>
              <option value="twilio" ${s.sms_provider === 'twilio' ? 'selected' : ''}>Twilio — widely used, has monthly number fees</option>
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
              <div class="hint">A business-name sender needs one-off registration with ClickSend (they handle ACMA). Leave blank to use a shared number.</div></div>
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
              <b>Paid</b> in Kairo. No key or Square login needed — the bill is tracked here, the card is taken on Square.</span></span>
          </label>
          <button class="btn primary" style="align-self:flex-start;margin-top:4px">${icon('check')} Save card method</button>
        </form>
      </div>

      <div class="card">
        <div class="card-title">Online deposits (Stripe)</div>
        <div class="card-sub" style="margin-bottom:16px">Take a card deposit when clients book online — the #1 no-show killer.
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
        <div class="card-title">Security</div>
        <div class="card-sub" style="margin-bottom:16px">Signed in as ${esc(state.user.email)}</div>
        <div class="field" style="margin-bottom:16px"><label>Email verification</label>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            ${state.user.email_verified
              ? `<span class="chip s-paid"><span class="dot"></span>Verified</span>
                 <span class="hint" style="margin:0">${esc(state.user.email)} is confirmed.</span>`
              : `<span class="chip s-sent"><span class="dot"></span>Not verified</span>
                 <button type="button" class="btn small" id="send-verify">${icon('mail')} Send verification email</button>`}
          </div>
          ${state.user.email_verified ? '' : '<div class="hint">Confirms you own this address. Needs email set up (Notifications card) first.</div>'}
        </div>
        <form id="set-password" style="display:flex;flex-direction:column;gap:13px">
          <div class="field"><label>Current password</label><input name="current" type="password" autocomplete="current-password" required></div>
          <div class="field"><label>New password (min 8 chars)</label><input name="next" type="password" autocomplete="new-password" required minlength="8"></div>
          <button class="btn primary" style="align-self:flex-start">${icon('check')} Change password</button>
        </form>
        ${state.user.email_verified ? '' : `
        <div style="border-top:1px solid var(--border);margin-top:20px;padding-top:16px">
          <div class="card-title" style="font-size:13.5px">Guided setup</div>
          <div class="card-sub" style="margin-bottom:12px">Re-run the step-by-step setup wizard to adjust your details, hours and branding.</div>
          <button class="btn" id="rerun-setup">${icon('zap')} Re-run setup wizard</button>
        </div>
        <div style="border-top:1px solid var(--border);margin-top:20px;padding-top:16px">
          <div class="card-title" style="font-size:13.5px">Demo data</div>
          <div class="card-sub" style="margin-bottom:12px">Wipe everything and restore the sample dataset — useful before a sales demo.</div>
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
  // day-of-week toggles for "Days you're open"
  container.querySelector('#open-days').addEventListener('click', (e) => {
    const b = e.target.closest('[data-day]');
    if (!b) return;
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on));
    b.classList.toggle('primary', on);
  });
  container.querySelector('#set-hours').addEventListener('submit', async (e) => {
    e.preventDefault();
    const days = [...container.querySelectorAll('#open-days [data-day]')]
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
      .map((b) => b.dataset.day);
    if (!days.length) { toast('Pick at least one open day', 'err'); return; }
    const fd = new FormData(e.target);
    state.settings = await api.put('/api/settings', {
      open_min: fd.get('open_min'), close_min: fd.get('close_min'),
      slot_interval: fd.get('slot_interval'),
      booking_lead_min: fd.get('booking_lead_min'),
      rebook_weeks_default: fd.get('rebook_weeks_default'),
      cal_start_min: fd.get('cal_start_min') || '',
      cal_end_min: fd.get('cal_end_min') || '',
      business_tz: String(fd.get('business_tz') || '').trim(),
      booking_enabled: e.target.elements.booking_enabled.checked ? '1' : '0',
      open_days: days.join(','),
    });
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

  container.querySelector('#send-verify')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      const res = await api.post('/api/auth/send-verification', {});
      toast(res.already_verified ? 'Already verified' : `Verification email sent to ${res.sent_to}`);
    } catch (err) {
      toast(err.message, 'err');
      e.target.disabled = false;
    }
  });

  container.querySelector('#brand-swatches').addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]');
    if (!b) return;
    brandForm.querySelector('[name=brand_accent]').value = b.dataset.c;
    container.querySelectorAll('#brand-swatches [data-c]').forEach((x) =>
      x.classList.toggle('is-on', x.dataset.c === b.dataset.c));
  });

  const readImage = (file, maxKb) => new Promise((resolve, reject) => {
    if (file.size > maxKb * 1024) { reject(new Error(`Image must be under ${maxKb} KB — try a smaller one`)); return; }
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
      toast('Booking page updated — open it to see the new look');
    } catch (err) {
      toast(err.message.includes('large') ? 'Those images are too large together — remove one or use smaller files' : err.message, 'err');
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
  smsProvider.addEventListener('change', syncSmsFields);
  syncSmsFields();

  container.querySelector('#set-sms').addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings(e.target, [
      'sms_notifications_enabled', 'sms_provider',
      'clicksend_username', 'clicksend_api_key', 'clicksend_from',
      'telnyx_api_key', 'telnyx_from', 'telnyx_profile_id',
      'twilio_sid', 'twilio_token', 'twilio_from',
    ]);
  });
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
    await navigator.clipboard.writeText(container.querySelector('#book-url').value);
    toast('Booking link copied');
  };
  container.querySelector('#set-password').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.put('/api/auth/password', { current: fd.get('current'), next: fd.get('next') });
      toast('Password changed');
      e.target.reset();
    } catch (err) { toast(err.message, 'err'); }
  });
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
