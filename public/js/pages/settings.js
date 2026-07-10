// Settings: business profile, hours, billing defaults, booking link, password.
import { api } from '../api.js';
import { esc, icon, toast, timeOptions, setCurrency, confirmDialog } from '../ui.js';
import { state } from '../app.js';

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
