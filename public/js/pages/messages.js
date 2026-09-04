// Messages: every confirmation & reminder Kairo queued, sent, skipped or
// failed — with retry. The truth log that makes notifications trustworthy.
import { api } from '../api.js';
import { esc, icon, fmtDate, fmtTime, money, openModal, toast } from '../ui.js';
import { state } from '../app.js';
import { mountSmsCredit } from '../sms-credit.js';

let filter = '';

export async function renderMessages(container) {
  const messages = await api.get(`/api/messages${filter ? `?status=${filter}` : ''}`);
  // Secret values never reach the browser; the API sends `<key>_set` flags instead.
  const configuredEmail = Boolean(state.settings.resend_api_key_set === '1' && state.settings.notif_from_email);
  // SMS is configured when the CHOSEN provider's own credentials are filled in.
  // Checking Twilio alone told every salon on ClickSend — the default — that its
  // texting wasn't set up, while the texts were going out perfectly well.
  const s = state.settings;
  const configuredSms = {
    clicksend: Boolean(s.clicksend_username && s.clicksend_api_key_set === '1' && s.clicksend_from),
    telnyx: Boolean(s.telnyx_api_key_set === '1' && s.telnyx_from),
    twilio: Boolean(s.twilio_sid && s.twilio_token_set === '1' && s.twilio_from),
  }[s.sms_provider || 'clicksend'] || false;

  const KIND = {
    confirmation: 'Confirmation', reminder: 'Reminder', receipt: 'Receipt',
    reschedule: 'Time changed', cancellation: 'Cancellation',
    owner_cancellation: 'Cancellation alert',
    review_request: 'Review request', owner_new_booking: 'New booking alert', test: 'Test',
  };
  const STATUS_CHIP = {
    queued: '<span class="chip s-booked"><span class="dot"></span>Queued</span>',
    sent: '<span class="chip s-paid"><span class="dot"></span>Sent</span>',
    failed: '<span class="chip s-no_show"><span class="dot"></span>Failed</span>',
    skipped: '<span class="chip s-draft"><span class="dot"></span>Skipped</span>',
  };

  container.innerHTML = `
    <div class="page-head">
      <div class="ph-icon">${icon('send', 20)}</div>
      <div><h1>Messages</h1>
        <div class="ph-sub">Booking confirmations &amp; appointment reminders, sent automatically</div></div>
      <div class="ph-actions">
        <button class="btn" id="msg-test-email">${icon('mail')} Test email</button>
        <button class="btn" id="msg-test-sms">${icon('phone')} Test SMS</button>
      </div>
    </div>

    ${!configuredEmail && !configuredSms ? `
      <div class="insight" style="text-align:left;margin:0 0 16px">
        <b>Setup needed:</b> messages are being logged but not delivered yet.
        Add a free <b>Resend</b> key (email) and/or your <b>SMS provider</b> details in
        <a href="#/settings">Settings → Notifications</a> — everything queued here will show
        exactly what happened.
      </div>` : ''}

    ${state.settings.sms_notifications_enabled === '1'
      ? '<div id="sms-credit" class="sms-credit is-loading"></div>' : ''}

    <div class="toolbar">
      <div class="seg" id="msg-filter">
        ${['', 'queued', 'sent', 'failed', 'skipped'].map((s) =>
          `<button data-status="${s}" class="${filter === s ? 'active' : ''}">${s === '' ? 'All' : s[0].toUpperCase() + s.slice(1)}</button>`).join('')}
      </div>
    </div>

    <div class="card" style="padding:0"><div class="table-wrap">
      <table class="data reflow msg-table">
        <thead><tr>
          <th>To</th><th>Type</th><th>Channel</th><th>Appointment</th><th>Led to</th><th>Send at</th><th>Status</th><th></th>
        </tr></thead>
        <tbody id="msg-rows">
          ${messages.length ? messages.map((m) => `
            <tr data-id="${m.id}">
              <td data-th="To" class="rf-head"><div class="cell-main">${esc(m.client_name || m.to_addr)}</div>
                  <div class="cell-sub">${esc(m.to_addr)}</div></td>
              <td data-th="Type">${esc(KIND[m.kind] || m.kind)}</td>
              <td data-th="Channel">${m.channel === 'sms' ? '💬 SMS' : '✉️ Email'}</td>
              <td data-th="Appointment">${m.appt_date ? `${fmtDate(m.appt_date)} · ${fmtTime(m.appt_start)}` : '—'}</td>
              <td data-th="Led to">${m.led_to_bookings
                ? `<span class="led-to">${m.led_to_bookings === 1 ? 'booked' : `${m.led_to_bookings} booked`}${
                    m.led_to_cents ? ` · ${money(m.led_to_cents)}` : ''}</span>`
                : '<span class="cell-sub">—</span>'}</td>
              <td data-th="Send at" class="cell-sub">${esc(m.send_after || 'immediately')}</td>
              <td data-th="Status">${STATUS_CHIP[m.status] || esc(m.status)}</td>
              <td class="num rf-action">${m.status === 'failed' || m.status === 'skipped' ? `<button class="btn small" data-retry="${m.id}">Retry</button>` : ''}</td>
            </tr>`).join('') : `
            <tr><td colspan="8"><div class="empty">${icon('send')}<div>No messages yet — they appear here when appointments are booked.</div></div></td></tr>`}
        </tbody>
      </table>
    </div></div>`;

  // Texting is prepaid, so the balance belongs on the page where the owner
  // watches messages go out — not buried three taps deep in Settings.
  const creditEl = container.querySelector('#sms-credit');
  if (creditEl) {
    mountSmsCredit(creditEl, api);
    creditEl.addEventListener('click', (e) => {
      if (e.target.closest('[data-credit-refresh]')) mountSmsCredit(creditEl, api, { refresh: true });
    });
  }

  container.querySelector('#msg-filter').addEventListener('click', (e) => {
    const b = e.target.closest('[data-status]');
    if (!b) return;
    filter = b.dataset.status;
    renderMessages(container);
  });

  container.querySelector('#msg-rows').addEventListener('click', async (e) => {
    const retry = e.target.closest('[data-retry]');
    if (retry) {
      e.stopPropagation();
      const res = await api.post(`/api/messages/${retry.dataset.retry}/retry`, {});
      toast(res.ok ? 'Message sent' : res.detail, res.ok ? 'ok' : 'err');
      renderMessages(container);
      return;
    }
    const row = e.target.closest('tr[data-id]');
    if (!row) return;
    const m = messages.find((x) => x.id === Number(row.dataset.id));
    if (!m) return;
    openModal({
      title: `${KIND[m.kind] || 'Message'} — ${m.channel.toUpperCase()}`,
      body: `
        <div class="cell-sub" style="margin-bottom:10px">To <b style="color:var(--text)">${esc(m.to_addr)}</b>
          ${m.detail ? `<br>Status: ${esc(m.detail)}` : ''}</div>
        ${m.subject ? `<div class="cell-main" style="margin-bottom:8px">${esc(m.subject)}</div>` : ''}
        <pre style="white-space:pre-wrap;font-family:inherit;background:var(--bg-raise);border:1px solid var(--border);border-radius:10px;padding:14px;font-size:13px;line-height:1.6">${esc(m.body)}</pre>`,
    });
  });

  const runTest = async (channel) => {
    try {
      const res = await api.post('/api/messages/test', { channel });
      toast(res.ok ? `Test ${channel} sent — check your inbox` : res.detail, res.ok ? 'ok' : 'err');
      renderMessages(container);
    } catch (err) { toast(err.message, 'err'); }
  };
  container.querySelector('#msg-test-email').onclick = () => runTest('email');
  container.querySelector('#msg-test-sms').onclick = () => runTest('sms');
}
