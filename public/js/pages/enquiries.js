// Special requests, from the owner's side.
//
// Somebody could not find a time and said so. That person is sitting waiting
// for an answer, which makes these different from everything else on the
// dashboard: the Opportunities panel is analysis the owner can read on Sunday,
// and this is a customer who will book somewhere else by Friday.
//
// So it is loud, it sits at the top, and every request carries the two things
// needed to act on it — how to reach them, and what they asked for — with the
// reply one tap away. Kairo does not write that reply. The salon knows whether
// it can do Tuesday at seven, and a templated "thanks for your enquiry" is
// worse than nothing.
import { api } from '../api.js';
import { esc, icon, fmtDate, openModal, confirmDialog, toast } from '../ui.js';

/** "2 days ago" — how long somebody has been waiting, which is the whole point. */
function waitedFor(createdAt) {
  if (!createdAt) return '';
  const then = new Date(String(createdAt).replace(' ', 'T') + 'Z').getTime();
  if (!Number.isFinite(then)) return '';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** What they asked for, in one line. */
function askedFor(e) {
  const bits = [];
  if (e.want_date) bits.push(fmtDate(e.want_date));
  if (e.when_text) bits.push(e.when_text);
  if (e.service_name) bits.push(e.service_name);
  return bits.join(' · ');
}

/**
 * Reply links, not a reply box.
 *
 * mailto: and sms: hand the conversation to the app the owner already answers
 * people in, with their own signature and their own history of that client.
 * Kairo sending it instead would mean the reply lands from a no-reply
 * subdomain and the customer's answer goes nowhere.
 */
function replyLinks(e) {
  const subject = encodeURIComponent('About your request');
  const body = encodeURIComponent(`Hi ${String(e.name || '').split(/\s+/)[0]},\n\n`);
  const out = [];
  if (e.email) {
    out.push(`<a class="btn small primary" href="mailto:${esc(e.email)}?subject=${subject}&body=${body}">
      ${icon('send', 13)} Reply by email</a>`);
  }
  if (e.phone) {
    out.push(`<a class="btn small" href="sms:${esc(String(e.phone).replace(/[^0-9+]/g, ''))}">
      ${icon('phone', 13)} Text them</a>`);
  }
  return out.join('');
}

function rowHtml(e) {
  const asked = askedFor(e);
  return `
    <div class="enq ${e.status === 'done' ? 'is-done' : ''}" data-id="${e.id}">
      <div class="enq-head">
        <div class="enq-who">
          ${esc(e.name)}
          ${e.known ? `<span class="enq-tag">${e.known.visits > 0
    ? `client · ${e.known.visits} visit${e.known.visits === 1 ? '' : 's'}` : 'client'}</span>` : ''}
        </div>
        <div class="enq-when">${esc(waitedFor(e.created_at))}</div>
      </div>
      ${asked ? `<div class="enq-asked">${icon('clock', 13)} ${esc(asked)}</div>` : ''}
      <div class="enq-msg">${esc(e.message)}</div>
      <div class="enq-contact">${[e.email, e.phone].filter(Boolean).map(esc).join(' · ')}</div>
      <div class="enq-acts">
        ${replyLinks(e)}
        ${e.status === 'done'
    ? `<button class="btn small" data-reopen="${e.id}">${icon('clock', 13)} Not done</button>`
    : `<button class="btn small" data-done="${e.id}">${icon('check', 13)} Mark as done</button>`}
        <button class="icon-btn" data-del="${e.id}" title="Delete this request"
          aria-label="Delete this request">${icon('trash', 14)}</button>
      </div>
    </div>`;
}

export async function openEnquiries({ onChange = null } = {}) {
  const data = await api.get('/api/enquiries?all=1');
  const open = data.enquiries.filter((e) => e.status === 'new');
  const done = data.enquiries.filter((e) => e.status !== 'new');

  const m = openModal({
    title: 'Special requests',
    wide: true,
    body: `
      ${data.enabled ? '' : `<div class="inv-warn">${icon('alert', 15)}<div>
        <b>Requests are switched off</b> on your booking page, so no new ones can arrive.
        Turn them back on in <a href="#/settings?sec=requests">Settings → Special requests</a>.</div></div>`}
      ${open.length
    ? `<div class="enq-list">${open.map(rowHtml).join('')}</div>`
    : `<div class="inv-empty">${icon('check', 22)}<div>Nothing waiting on you.<br>
         Requests from your booking page land here.</div></div>`}
      ${done.length ? `
        <details class="enq-done-wrap">
          <summary>${done.length} already dealt with</summary>
          <div class="enq-list">${done.map(rowHtml).join('')}</div>
        </details>` : ''}`,
  });

  const refresh = async () => { m.close(); onChange?.(); await openEnquiries({ onChange }); };

  m.addEventListener('click', async (e) => {
    const done_ = e.target.closest('[data-done]');
    if (done_) {
      await api.post(`/api/enquiries/${done_.dataset.done}/done`, {});
      toast('Marked as done');
      await refresh();
      return;
    }
    const re = e.target.closest('[data-reopen]');
    if (re) {
      await api.post(`/api/enquiries/${re.dataset.reopen}/done`, { reopen: true });
      await refresh();
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del) {
      const yes = await confirmDialog('Delete this request',
        'It goes for good, along with what they wrote.', { okText: 'Delete' });
      if (!yes) return;
      await api.del(`/api/enquiries/${del.dataset.del}`);
      await refresh();
    }
  });

  return m;
}

/**
 * The dashboard card. Drawn only when somebody is actually waiting.
 *
 * A card that says "0 requests" every morning is a card the owner stops
 * seeing, and then the one morning it says 2 they miss it.
 */
export async function drawEnquiries(slot, { onChange = null } = {}) {
  if (!slot) return;
  let data;
  try { data = await api.get('/api/enquiries'); } catch { return; }
  const list = data?.enquiries || [];
  if (!list.length) { slot.innerHTML = ''; return; }

  slot.innerHTML = `
    <div class="card enq-card">
      <div class="enq-card-head">
        <span class="enq-card-icon">${icon('send', 18)}</span>
        <div style="min-width:0">
          <h2>${list.length} ${list.length === 1 ? 'person is' : 'people are'} waiting on you</h2>
          <div class="enq-card-sub">Asked for a time you don't have on your booking page.</div>
        </div>
        <button class="btn primary" id="enq-open">Read ${list.length === 1 ? 'it' : 'them'}</button>
      </div>
      <div class="enq-peek">
        ${list.slice(0, 2).map((e) => `
          <div class="enq-peek-row">
            <b>${esc(e.name)}</b>
            <span>${esc(askedFor(e) || String(e.message).slice(0, 60))}</span>
            <i>${esc(waitedFor(e.created_at))}</i>
          </div>`).join('')}
        ${list.length > 2 ? `<div class="enq-peek-more">and ${list.length - 2} more</div>` : ''}
      </div>
    </div>`;

  slot.querySelector('#enq-open').onclick = () => openEnquiries({ onChange });
}
