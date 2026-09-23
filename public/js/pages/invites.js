// Booking links, from the owner's side.
//
// The salon has just finished a consultation — in a DM, on the phone, across
// the counter — and now has to turn "Thursday at two, balayage, $185" into
// something the client can tap. That is all this screen does.
//
// It is one modal rather than a page, because it is opened in the middle of a
// conversation with somebody waiting for a reply. Everything is on it: the
// links already out, and the form to send another.
import { api } from '../api.js';
import {
  esc, icon, money, fmtTime, fmtDate, todayStr, openModal, confirmDialog, toast,
} from '../ui.js';
import { state } from '../app.js';

/** Plain-English status, and the colour it should read as. */
const STATUS = {
  open: ['Sent', 'wait', 'Waiting for them to open it'],
  claimed: ['Opened', 'wait', 'They have put their details in'],
  paid: ['Says paid', 'act', 'Check the money arrived, then confirm'],
};

function statusPill(inv) {
  const [label, tone] = STATUS[inv.status] || [inv.status, 'wait'];
  return `<span class="inv-pill ${tone}">${esc(label)}</span>`;
}

/** "in 3 hours" / "in 2 days" — how long the slot is still being held. */
function heldFor(expiresAt) {
  if (!expiresAt) return '';
  const when = new Date(String(expiresAt).replace(' ', 'T') + 'Z');
  const mins = Math.round((when.getTime() - Date.now()) / 60000);
  if (!Number.isFinite(mins) || mins <= 0) return 'expiring now';
  if (mins < 90) return `held ${mins} more min`;
  const hrs = Math.round(mins / 60);
  return hrs < 48 ? `held ${hrs} more hours` : `held ${Math.round(hrs / 24)} more days`;
}

function rowHtml(inv) {
  const who = inv.client_name || 'Not opened yet';
  const svc = inv.services.map((s) => s.name).join(' + ');
  const hint = (STATUS[inv.status] || [])[2] || '';
  return `
    <div class="inv-row" data-id="${inv.id}">
      <div class="inv-main">
        <div class="inv-who">${esc(who)} ${statusPill(inv)}</div>
        <div class="inv-sub">${esc(svc)} · ${esc(fmtDate(inv.date))} ${esc(fmtTime(inv.start_min))}${
  inv.price_cents > 0 ? ` · ${esc(money(inv.price_cents))}` : ''}</div>
        <div class="inv-hint">${esc(hint)}${hint && inv.expires_at ? ' · ' : ''}${esc(heldFor(inv.expires_at))}</div>
      </div>
      <div class="inv-acts">
        <button class="btn small" data-copy="${inv.id}">${icon('link', 13)} Copy link</button>
        ${inv.status === 'paid'
    ? `<button class="btn small primary" data-confirm="${inv.id}">${icon('check', 13)} Confirm &amp; book</button>`
    : ''}
        <button class="icon-btn" data-cancel="${inv.id}" title="Withdraw this link"
          aria-label="Withdraw this link">${icon('trash', 14)}</button>
      </div>
    </div>`;
}

/**
 * Copy, with the honest fallback.
 *
 * navigator.clipboard is unavailable over plain http and inside some in-app
 * browsers, which is exactly where an owner pasting into Instagram often is.
 * Silently failing there would be the worst version of this button, so the
 * link is shown to be copied by hand instead.
 */
async function copyLink(url) {
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied — paste it into the chat');
  } catch {
    openModal({
      title: 'Copy this link',
      body: `<p style="color:var(--text-2);line-height:1.6">Your browser won't let us copy for you here.
        Select it and copy it by hand.</p>
        <input class="inv-copy-box" readonly value="${esc(url)}">`,
    }).querySelector('.inv-copy-box')?.select();
  }
}

export async function openInvites() {
  const data = await api.get('/api/invites');
  const services = (state.services || []).filter((s) => s.active !== 0);
  const staff = (state.staff || []).filter((s) => s.active !== 0);

  const payWarning = data.pay_route === 'link' && !data.payment_link
    ? `<div class="inv-warn">${icon('alert', 15)}<div><b>No payment link is set.</b>
         Links will be sent without a payment step until you add one in
         <a href="#/settings?sec=consult">Settings → Consultation first</a>.</div></div>`
    : data.pay_route === 'link'
      ? `<div class="inv-note">${icon('alert', 15)}<div>Clients pay through your own payment link, which
           can't report back to Kairo. They tap <b>I've paid</b>, you check the money, then
           <b>Confirm &amp; book</b> here.</div></div>`
      : '';

  const m = openModal({
    title: 'Booking links',
    wide: true,
    body: `
      ${payWarning}
      <div class="inv-list" id="inv-list">
        ${data.invites.length
    ? data.invites.map(rowHtml).join('')
    : `<div class="inv-empty">${icon('send', 22)}<div>No links out at the moment.<br>
         Send one below after you've agreed a time with someone.</div></div>`}
      </div>

      <div class="inv-new-title">Send a new link</div>
      <form id="inv-new" class="inv-form">
        <div class="field"><label>Who is it for</label>
          <input name="client_name" placeholder="Their name" autocomplete="off">
          <div class="hint">Optional — they fill this in themselves when they open the link.</div></div>
        <div class="field"><label>Service</label>
          <select name="service_id" class="nice-select" required>
            <option value="">Choose…</option>
            ${services.map((s) => `<option value="${s.id}">${esc(s.name)} · ${esc(money(s.price_cents))}</option>`).join('')}
          </select></div>
        <div class="field"><label>With</label>
          <select name="staff_id" class="nice-select" required>
            ${staff.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
          </select></div>
        <div class="inv-when">
          <div class="field"><label>Date</label>
            <input name="date" type="date" min="${todayStr()}" value="${todayStr()}" required></div>
          <div class="field"><label>Time</label>
            <select name="start_min" class="nice-select" id="inv-slots" required>
              <option value="">Pick a service first</option>
            </select></div>
        </div>
        <div class="field"><label>Price</label>
          <input name="price" inputmode="decimal" placeholder="Leave blank to use the menu price">
          <div class="hint">Override it if you quoted something different in the consultation.</div></div>
        <div class="field"><label>Note for them</label>
          <input name="note" maxlength="300" placeholder="Balayage + toner, as discussed">
          <div class="hint">Shown on their page, so they know it's the right booking.</div></div>
        <div class="login-error" id="inv-err"></div>
        <button class="btn primary" type="submit">${icon('send', 14)} Create link</button>
      </form>`,
  });

  const $ = (sel) => m.querySelector(sel);
  const form = $('#inv-new');
  const slotSel = $('#inv-slots');

  /** Reload the free times whenever the service, stylist or date changes. */
  async function loadSlots() {
    const fd = new FormData(form);
    const serviceId = fd.get('service_id');
    const staffId = fd.get('staff_id');
    const date = fd.get('date');
    if (!serviceId || !staffId || !date) {
      slotSel.innerHTML = '<option value="">Pick a service first</option>';
      return;
    }
    slotSel.innerHTML = '<option value="">Looking…</option>';
    try {
      const out = await api.get(`/api/invites/slots?date=${encodeURIComponent(date)}`
        + `&staff_id=${encodeURIComponent(staffId)}&service_ids=${encodeURIComponent(serviceId)}`);
      slotSel.innerHTML = out.slots.length
        ? out.slots.map((s) => `<option value="${s.start_min}">${esc(fmtTime(s.start_min))}</option>`).join('')
        : '<option value="">Nothing free that day</option>';
    } catch (e) {
      slotSel.innerHTML = `<option value="">${esc(e.message)}</option>`;
    }
  }
  form.addEventListener('change', (e) => {
    if (['service_id', 'staff_id', 'date'].includes(e.target.name)) loadSlots();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#inv-err');
    const btn = form.querySelector('button[type=submit]');
    err.textContent = '';
    btn.disabled = true;
    const fd = new FormData(form);
    // A price typed as dollars, stored as cents. Blank means "use the menu",
    // which is not the same as zero and must not become it.
    const typed = String(fd.get('price') || '').trim();
    const priceCents = typed === '' ? undefined : Math.round(Number(typed.replace(/[^0-9.]/g, '')) * 100);
    try {
      const out = await api.post('/api/invites', {
        service_ids: [Number(fd.get('service_id'))],
        staff_id: Number(fd.get('staff_id')),
        date: fd.get('date'),
        start_min: Number(fd.get('start_min')),
        note: String(fd.get('note') || ''),
        client_name: String(fd.get('client_name') || ''),
        ...(priceCents === undefined || Number.isNaN(priceCents) ? {} : { price_cents: priceCents }),
      });
      m.close();
      await copyLink(out.invite.url);
      openInvites();
    } catch (e2) {
      err.textContent = e2.message;
      btn.disabled = false;
    }
  });

  m.addEventListener('click', async (e) => {
    const copy = e.target.closest('[data-copy]');
    if (copy) {
      const inv = data.invites.find((x) => x.id === Number(copy.dataset.copy));
      if (inv) await copyLink(inv.url);
      return;
    }
    const conf = e.target.closest('[data-confirm]');
    if (conf) {
      const inv = data.invites.find((x) => x.id === Number(conf.dataset.confirm));
      const yes = await confirmDialog('Confirm this booking',
        `Only do this once <b>${esc(inv?.client_name || 'their')}</b> payment has actually landed in your
         account. Confirming books them in and sends their confirmation.`,
        { okText: 'Yes, it\'s paid' });
      if (!yes) return;
      conf.disabled = true;
      try {
        await api.post(`/api/invites/${conf.dataset.confirm}/confirm`, {});
        toast('Booked in — their confirmation is on its way');
        m.close();
        openInvites();
      } catch (e2) { toast(e2.message, 'bad'); conf.disabled = false; }
      return;
    }
    const del = e.target.closest('[data-cancel]');
    if (del) {
      const yes = await confirmDialog('Withdraw this link',
        'The link stops working and the time goes back on sale.', { okText: 'Withdraw' });
      if (!yes) return;
      try {
        await api.del(`/api/invites/${del.dataset.cancel}`);
        m.close();
        openInvites();
      } catch (e2) { toast(e2.message, 'bad'); }
    }
  });

  return m;
}
