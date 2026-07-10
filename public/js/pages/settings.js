// Settings: business profile, hours, billing defaults, notifications,
// payments/deposits, locations, booking link, password.
import { api } from '../api.js';
import { esc, icon, toast, timeOptions, setCurrency, confirmDialog, openModal } from '../ui.js';
import { state, refreshLookups } from '../app.js';

// Secret keys are never sent to the browser — the API returns a `<key>_set`
// flag instead. These render the "already saved" affordance.
const keySaved = (set) => (set === '1'
  ? ' <span style="color:var(--green);font-weight:600;font-size:11px">● saved</span>' : '');
const keyPlaceholder = (set, empty) => (set === '1' ? '•••••••••• — leave blank to keep' : empty);

function parseGallery(raw) {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s) => typeof s === 'string' && s.startsWith('data:image/')).slice(0, 4) : [];
  } catch { return []; }
}

export async function renderSettings(container) {
  const s = state.settings;
  const bookingUrl = `${location.origin}/book`;

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
          <div class="field"><label>Online booking slot interval</label>
            <select name="slot_interval">${[10, 15, 20, 30, 60].map((v) => `<option value="${v}" ${Number(s.slot_interval) === v ? 'selected' : ''}>${v} minutes</option>`).join('')}</select></div>
          <div class="field">
            <label style="display:flex;align-items:center;gap:8px;font-weight:500;color:var(--text-2);cursor:pointer">
              <input type="checkbox" name="booking_enabled" ${s.booking_enabled === '1' ? 'checked' : ''} style="width:15px;height:15px;accent-color:var(--accent)">
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
          <div class="form-grid">
            <div class="field"><label>Style</label>
              <select name="brand_theme">
                <option value="dark" ${s.brand_theme !== 'light' ? 'selected' : ''}>Dark (sleek, tech)</option>
                <option value="light" ${s.brand_theme === 'light' ? 'selected' : ''}>Light (bright, airy)</option>
              </select></div>
            <div class="field"><label>Font style</label>
              <select name="brand_font">
                <option value="modern" ${s.brand_font !== 'classic' && s.brand_font !== 'rounded' ? 'selected' : ''}>Modern (clean sans)</option>
                <option value="classic" ${s.brand_font === 'classic' ? 'selected' : ''}>Classic (elegant serif)</option>
                <option value="rounded" ${s.brand_font === 'rounded' ? 'selected' : ''}>Rounded (friendly)</option>
              </select></div>
          </div>
          <div class="field"><label>Brand colour</label>
            <div style="display:flex;gap:9px;align-items:center;flex-wrap:wrap" id="brand-swatches">
              ${['#38bdf8', '#d55181', '#a855f7', '#f59e0b', '#10b981', '#e11d48', '#c2874a'].map((c) =>
                `<button type="button" data-c="${c}" style="width:28px;height:28px;border-radius:50%;background:${c};border:2px solid ${(s.brand_accent || '#38bdf8').toLowerCase() === c ? '#fff' : 'transparent'}"></button>`).join('')}
              <input type="color" name="brand_accent" value="${esc(/^#[0-9a-fA-F]{6}$/.test(s.brand_accent || '') ? s.brand_accent : '#38bdf8')}"
                style="width:44px;height:30px;padding:2px;border:1px solid var(--border);border-radius:8px;background:var(--bg-raise);cursor:pointer" title="Custom colour">
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
          <div class="field"><label>Photo gallery (optional)</label>
            <div id="brand-gallery-strip" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"></div>
            <div style="display:flex;gap:10px;align-items:center">
              <button type="button" class="btn small" id="brand-gallery-pick">${icon('plus')} Add photos</button>
              <span class="hint" style="margin:0">Up to 4 photos of your work, shown to clients when they book.</span>
              <input type="file" id="brand-gallery-file" accept="image/png,image/jpeg,image/webp" multiple style="display:none">
            </div></div>
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
        <div class="card-sub" style="margin-bottom:16px">Automatic booking confirmations &amp; reminders.
          Email uses <a href="https://resend.com" target="_blank" rel="noreferrer">Resend</a> (free tier: 3,000/mo),
          SMS uses <a href="https://www.twilio.com" target="_blank" rel="noreferrer">Twilio</a>. Paste keys, hit save, send a test from the
          <a href="#/messages">Messages</a> page.</div>
        <form id="set-notif" style="display:flex;flex-direction:column;gap:13px">
          <div class="form-grid">
            <div class="field">
              <label style="display:flex;align-items:center;gap:8px;font-weight:600;color:var(--text-2);cursor:pointer">
                <input type="checkbox" name="confirm_enabled" ${s.confirm_enabled === '1' ? 'checked' : ''} style="width:15px;height:15px;accent-color:var(--accent)">
                Send booking confirmations</label></div>
            <div class="field">
              <label style="display:flex;align-items:center;gap:8px;font-weight:600;color:var(--text-2);cursor:pointer">
                <input type="checkbox" name="reminders_enabled" ${s.reminders_enabled === '1' ? 'checked' : ''} style="width:15px;height:15px;accent-color:var(--accent)">
                Send reminders</label></div>
          </div>
          <div class="field"><label>Remind clients this many hours before</label>
            <select name="reminder_hours">${[2, 4, 12, 24, 48].map((h) => `<option value="${h}" ${Number(s.reminder_hours) === h ? 'selected' : ''}>${h} hours</option>`).join('')}</select></div>
          <div class="form-grid">
            <div class="field"><label>Resend API key (email)${keySaved(s.resend_api_key_set)}</label>
              <input name="resend_api_key" type="password" value="" placeholder="${keyPlaceholder(s.resend_api_key_set, 're_…')}" autocomplete="off"></div>
            <div class="field"><label>From email (verified in Resend)</label>
              <input name="notif_from_email" value="${esc(s.notif_from_email || '')}" placeholder="bookings@yourdomain.com"></div>
          </div>
          <div class="form-grid">
            <div class="field"><label>Twilio Account SID (SMS)</label>
              <input name="twilio_sid" value="${esc(s.twilio_sid || '')}" placeholder="AC…" autocomplete="off"></div>
            <div class="field"><label>Twilio Auth Token${keySaved(s.twilio_token_set)}</label>
              <input name="twilio_token" type="password" value="" placeholder="${keyPlaceholder(s.twilio_token_set, '')}" autocomplete="off"></div>
          </div>
          <div class="field"><label>Twilio phone number (sender)</label>
            <input name="twilio_from" value="${esc(s.twilio_from || '')}" placeholder="+15551234567"></div>
          <button class="btn primary" style="align-self:flex-start">${icon('check')} Save notifications</button>
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
        <form id="set-password" style="display:flex;flex-direction:column;gap:13px">
          <div class="field"><label>Current password</label><input name="current" type="password" autocomplete="current-password" required></div>
          <div class="field"><label>New password (min 8 chars)</label><input name="next" type="password" autocomplete="new-password" required minlength="8"></div>
          <button class="btn primary" style="align-self:flex-start">${icon('check')} Change password</button>
        </form>
        <div style="border-top:1px solid var(--border);margin-top:20px;padding-top:16px">
          <div class="card-title" style="font-size:13.5px">Demo data</div>
          <div class="card-sub" style="margin-bottom:12px">Wipe everything and restore the sample dataset — useful before a sales demo.</div>
          <button class="btn danger" id="reset-demo">${icon('zap')} Reset to demo data</button>
        </div>
      </div>
    </div>`;

  const saveSettings = async (form, fields) => {
    const fd = new FormData(form);
    const payload = {};
    for (const f of fields) {
      payload[f] = f === 'booking_enabled' ? (fd.get(f) === 'on' ? '1' : '0') : (fd.get(f) ?? '');
    }
    state.settings = await api.put('/api/settings', payload);
    setCurrency(state.settings.currency);
    toast('Settings saved');
  };

  container.querySelector('#set-profile').addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings(e.target, ['business_name', 'business_phone', 'business_email', 'business_address']);
  });
  container.querySelector('#set-hours').addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings(e.target, ['open_min', 'close_min', 'slot_interval', 'booking_enabled']);
  });
  container.querySelector('#set-billing').addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings(e.target, ['currency', 'tax_rate', 'invoice_prefix', 'invoice_due_days', 'invoice_footer']);
  });
  // booking page appearance
  let brandLogo = s.brand_logo || '';
  let brandCover = s.brand_cover || '';
  let brandGallery = Array.isArray(state.settings.brand_gallery)
    ? state.settings.brand_gallery
    : parseGallery(s.brand_gallery);
  const brandForm = container.querySelector('#set-brand');

  container.querySelector('#brand-swatches').addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]');
    if (!b) return;
    brandForm.querySelector('[name=brand_accent]').value = b.dataset.c;
    container.querySelectorAll('#brand-swatches [data-c]').forEach((x) =>
      (x.style.borderColor = x.dataset.c === b.dataset.c ? '#fff' : 'transparent'));
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

  // gallery
  const galleryStrip = container.querySelector('#brand-gallery-strip');
  const drawGallery = () => {
    galleryStrip.innerHTML = brandGallery.map((src, i) => `
      <div style="position:relative">
        <img src="${esc(src)}" alt="" style="height:56px;width:56px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">
        <button type="button" data-rm-photo="${i}" class="icon-btn" style="position:absolute;top:-8px;right:-8px;width:20px;height:20px;background:var(--panel-3);border:1px solid var(--border);border-radius:50%">${icon('x', 11)}</button>
      </div>`).join('');
    galleryStrip.querySelectorAll('[data-rm-photo]').forEach((b) => {
      b.onclick = () => { brandGallery.splice(Number(b.dataset.rmPhoto), 1); drawGallery(); };
    });
  };
  drawGallery();
  const galleryFile = container.querySelector('#brand-gallery-file');
  container.querySelector('#brand-gallery-pick').onclick = () => galleryFile.click();
  galleryFile.addEventListener('change', async () => {
    for (const file of [...galleryFile.files]) {
      if (brandGallery.length >= 4) { toast('Up to 4 gallery photos', 'err'); break; }
      try { brandGallery.push(await readImage(file, 500)); } catch (err) { toast(err.message, 'err'); }
    }
    galleryFile.value = '';
    drawGallery();
  });

  brandForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(brandForm);
    try {
      state.settings = await api.put('/api/settings', {
        brand_theme: fd.get('brand_theme'),
        brand_font: fd.get('brand_font'),
        brand_accent: fd.get('brand_accent'),
        brand_tagline: fd.get('brand_tagline'),
        brand_logo: brandLogo,
        brand_cover: brandCover,
        brand_gallery: JSON.stringify(brandGallery),
      });
      toast('Booking page updated — open it to see the new look');
    } catch (err) {
      toast(err.message.includes('large') ? 'Those images are too large together — remove one or use smaller files' : err.message, 'err');
    }
  });

  container.querySelector('#set-notif').addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings(e.target, ['confirm_enabled', 'reminders_enabled', 'reminder_hours',
      'resend_api_key', 'notif_from_email', 'twilio_sid', 'twilio_token', 'twilio_from']);
  });
  container.querySelector('#set-payments').addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings(e.target, ['stripe_secret_key', 'deposit_type', 'deposit_value', 'currency_code']);
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
  container.querySelector('#reset-demo').onclick = async () => {
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
