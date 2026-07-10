// Settings: business profile, hours, billing defaults, notifications,
// payments/deposits, locations, booking link, password.
import { api } from '../api.js';
import { esc, icon, toast, timeOptions, setCurrency, confirmDialog, openModal } from '../ui.js';
import { state, refreshLookups } from '../app.js';

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
            <div class="field"><label>Resend API key (email)</label>
              <input name="resend_api_key" value="${esc(s.resend_api_key || '')}" placeholder="re_…" autocomplete="off"></div>
            <div class="field"><label>From email (verified in Resend)</label>
              <input name="notif_from_email" value="${esc(s.notif_from_email || '')}" placeholder="bookings@yourdomain.com"></div>
          </div>
          <div class="form-grid">
            <div class="field"><label>Twilio Account SID (SMS)</label>
              <input name="twilio_sid" value="${esc(s.twilio_sid || '')}" placeholder="AC…" autocomplete="off"></div>
            <div class="field"><label>Twilio Auth Token</label>
              <input name="twilio_token" type="password" value="${esc(s.twilio_token || '')}" autocomplete="off"></div>
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
          <div class="field"><label>Stripe secret key</label>
            <input name="stripe_secret_key" type="password" value="${esc(s.stripe_secret_key || '')}" placeholder="sk_live_… (or sk_test_… to try it)" autocomplete="off"></div>
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
