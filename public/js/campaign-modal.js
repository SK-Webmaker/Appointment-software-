// The campaign preview: the screen that makes sending safe.
//
// Shared by the dashboard's Opportunities panel and Kai's week (pages/
// marketing.js). Nothing goes anywhere until the owner has seen the exact
// list, the exact words and the exact cost, and pressed Send.
//
// `campaign` is { kind, weekday?, when?, times?, offer?, service_id?, perk?,
// draft?: { subject, body }, audience? }. A draft Kai wrote is used as the
// starting words in place of the stock ones; the owner can change every word.
import { api } from './api.js';
import { esc, icon, money, openModal, toast, confirmDialog } from './ui.js';


const CH_LABEL = { email: 'Email', sms: 'SMS', both: 'Email + SMS' };

/** "Thu 2:30pm" — the offered slot as the owner would say it out loud. */
function offerLabel(offer) {
  const d = new Date(`${offer.date}T12:00:00`);
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  const h = Math.floor(offer.start_min / 60), mm = offer.start_min % 60;
  const t = `${(h % 12) || 12}${mm ? `:${String(mm).padStart(2, '0')}` : ''}${h >= 12 ? 'pm' : 'am'}`;
  return `${day} ${t}`;
}

export async function openCampaign(campaign, { onSent = null } = {}) {
  // `audience` is the new axis: the same freed slot can go to the handful of
  // people it actually suits, or to the whole list as a long shot. They are not
  // the same message and they are not the same decision, so the switch is the
  // first thing in the dialog rather than a checkbox buried under the draft.
  let state_ = { channel: 'email', audience: campaign.audience === 'everyone' ? 'everyone' : 'matched', data: null, chosen: new Set() };

  /**
   * The most people this send may go to, or null when there is no ceiling.
   *
   * There is one only when a single named slot is attached and it is going to
   * picked-out people. A broadcast has no slot on it, and "we've got room in
   * the diary" cannot run out.
   */
  const capFor = () => (campaign.offer && state_.audience !== 'everyone'
    ? (state_.data?.gap_offer_cap || 5) : null);

  const m = openModal({
    title: 'Draft a message',
    wide: true,
    body: '<div id="cmp-body" class="cmp-loading">Working out who this should go to…</div>',
    footer: `<div class="spacer"></div>
      <button class="btn" data-cancel>Cancel</button>
      <button class="btn primary" id="cmp-send" disabled>Send</button>`,
  });
  m.querySelector('[data-cancel]').onclick = () => m.close();

  const load = async () => {
    const q = new URLSearchParams({
      kind: campaign.kind, channel: state_.channel, audience: state_.audience,
    });
    if (campaign.weekday !== undefined) q.set('weekday', campaign.weekday);
    if (campaign.when) q.set('when', campaign.when);
    if (campaign.times) q.set('times', campaign.times);
    if (campaign.service_id) q.set('service_id', campaign.service_id);
    if (campaign.perk) q.set('perk', campaign.perk);
    try {
      state_.data = await api.get(`/api/campaigns/preview?${q}`);
    } catch (err) {
      const el = m.querySelector('#cmp-body');
      el.className = '';
      el.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
      return;
    }
    // The server decides the channel for a broadcast — it forces email — so
    // take its answer rather than keeping a stale SMS selection on screen.
    state_.channel = state_.data.channel;
    // Kai's words, where Kai wrote some. A gap offer keeps the stock wording,
    // because the broadcast version of it has to say "first come, first served".
    if (campaign.draft && campaign.kind !== 'gap_offer') {
      state_.data.draft = { subject: campaign.draft.subject || state_.data.draft.subject, body: campaign.draft.body || state_.data.draft.body };
    }
    // Everyone reachable starts ticked; anyone inside the cooldown cannot be.
    const live = state_.data.recipients.filter((r) => !r.cooling_off);
    // Unless one actual slot is on offer, in which case only the first few
    // start ticked. Offering 2:30 to everyone who fits would mean telling all
    // but one of them they were too slow — so the default is the cap, and going
    // past it has to be a decision somebody makes.
    const cap = capFor();
    state_.chosen = new Set((cap === null ? live : live.slice(0, cap)).map((r) => r.id));
    paint();
  };

  const paint = () => {
    const d = state_.data;
    const body = m.querySelector('#cmp-body');
    // The loading state centres its text; leaving that class on once the real
    // content is in centres the whole recipient list with it.
    body.className = '';
    const live = d.recipients.filter((r) => !r.cooling_off);
    const cooling = d.recipients.filter((r) => r.cooling_off);
    const picked = live.filter((r) => state_.chosen.has(r.id));
    const broadcast = d.audience === 'everyone';
    const sizes = d.audience_sizes || {};

    body.innerHTML = `
      <div class="cmp-grid">
        <div class="cmp-left">
          <div class="cmp-label">Send to</div>
          <div class="seg" id="cmp-aud">
            <button type="button" data-aud="matched" class="${broadcast ? '' : 'sel'}">
              Best matches${sizes.matched !== undefined ? ` · ${sizes.matched}` : ''}</button>
            <button type="button" data-aud="everyone" class="${broadcast ? 'sel' : ''}">
              Everyone${sizes.everyone !== undefined ? ` · ${sizes.everyone}` : ''}</button>
          </div>
          <div class="cmp-aud-note">${broadcast
            ? `Your whole client list. Nobody has been picked out, so the message says
               <b>first come, first served</b> — and it goes by email, because two hundred
               texts is real money for a long shot and this one is free.`
            : campaign.kind === 'gap_offer'
              ? `The people this actually suits: due for a visit, and they've booked this day
                 of the week before. Fewer names, far more replies.`
              : `The people this is about, each with the reason they're on the list.
                 Untick anyone who shouldn't get it.`}</div>

          ${campaign.offer && !broadcast ? `
            <div class="cmp-offer">
              ${icon('link', 14)}
              <span>Their link opens straight on
              <b>${esc(offerLabel(campaign.offer))}</b> — one tap and it's booked.
              Only ${capFor()} people can be sent it, because the rest would just be
              told it had gone.</span>
            </div>` : ''}

          ${broadcast ? '' : `
          <div class="cmp-label" style="margin-top:16px">Send by</div>
          <div class="seg" id="cmp-seg">
            ${['email', 'sms', 'both'].map((c) => `
              <button type="button" data-ch="${c}" class="${state_.channel === c ? 'sel' : ''}">${CH_LABEL[c]}</button>`).join('')}
          </div>`}
          <div class="cmp-cost ${state_.channel === 'email' ? 'free' : 'paid'}" id="cmp-cost"></div>

          <div class="cmp-label" style="margin-top:16px">Message</div>
          ${state_.channel !== 'sms' ? `
            <input id="cmp-subject" class="cmp-subject" value="${esc(d.draft.subject)}" placeholder="Subject">` : ''}
          <textarea id="cmp-body-text" class="cmp-text" rows="7">${esc(d.draft.body)}</textarea>
          ${campaign.ai ? `
            <div class="cmp-reword-row">
              <button type="button" class="btn small" id="cmp-reword">${icon('pen', 13)} Reword in my style</button>
              <span class="cmp-hint" id="cmp-reword-note">Kai rewords it and keeps every fact. Uses 1 of your Kai messages.</span>
            </div>` : ''}
          <div class="cmp-hint">
            <b>{first_name}</b> becomes each person's name.
            ${d.booking_url
              ? `<b>{booking_link}</b> becomes your booking page — a different link for each
                 person, so you can see who booked because of this message.`
              : '<b style="color:var(--amber)">No booking link yet</b> — set your website address in Settings and it will be included.'}
          </div>
        </div>

        <div class="cmp-right">
          <div class="cmp-label">
            Going to <b id="cmp-count">${picked.length}</b> of ${live.length}
            ${live.length ? '<button type="button" class="cmp-all" id="cmp-all">Select all</button>' : ''}
          </div>
          <div class="cmp-people" id="cmp-people">
            ${live.length ? live.map((r) => `
              <label class="cmp-person">
                <input type="checkbox" class="chk" data-id="${r.id}" ${state_.chosen.has(r.id) ? 'checked' : ''}>
                <span class="cp-main">
                  <b>${esc(`${r.first_name} ${r.last_name}`.trim())}</b>
                  <span>${esc(r.why)}</span>
                </span>
              </label>`).join('')
              : `<div class="empty" style="padding:22px 10px">Nobody fits this right now.
                   ${cooling.length ? 'Everyone who does has heard from you in the last fortnight.' : ''}</div>`}
          </div>
          ${cooling.length ? `
            <div class="cmp-cooling">${icon('clock', 13)}
              <span><b>${cooling.length} left out</b> — messaged in the last ${d.cooldown_days} days.
              Kairo won't contact the same client twice inside that window, whichever campaign it is.</span>
            </div>` : ''}
        </div>
      </div>`;

    const recost = () => {
      const n = live.filter((r) => state_.chosen.has(r.id));
      const text = m.querySelector('#cmp-body-text').value;
      const len = text.length;
      const seg = len <= 160 ? 1 : Math.ceil(len / 153);
      const smsTo = state_.channel === 'email' ? 0 : n.filter((r) => r.phone).length;
      const cents = smsTo * seg * 8;
      const el = m.querySelector('#cmp-cost');
      el.className = `cmp-cost ${state_.channel === 'email' ? 'free' : 'paid'}`;
      el.innerHTML = state_.channel === 'email'
        ? `<b>Free</b> — ${n.filter((r) => r.email).length} of ${n.length} have an email address`
        : `About <b>${money(cents)}</b> in SMS credit · ${smsTo} text${smsTo === 1 ? '' : 's'}`
          + `${seg > 1 ? ` × ${seg} segments (${len} characters)` : ''}`;
      m.querySelector('#cmp-count').textContent = n.length;
      // Over the cap the button says why rather than going grey for no visible
      // reason. The server refuses this too — the screen is the explanation,
      // not the guard.
      const cap = capFor();
      const over = cap !== null && n.length > cap;
      const send = m.querySelector('#cmp-send');
      send.disabled = n.length === 0 || over;
      send.innerHTML = over
        ? `${icon('alert', 14)} ${cap} at most for one slot`
        : `${icon('send', 14)} Send to ${n.length}`;
    };
    recost();

    m.querySelector('#cmp-aud').onclick = (e) => {
      const b = e.target.closest('[data-aud]');
      if (!b || b.dataset.aud === state_.audience) return;
      state_.audience = b.dataset.aud;
      // The draft is rewritten for the new audience, so any edits the owner
      // made are about to be replaced. Only worth asking if they made some.
      load();
    };
    // Absent on a broadcast — that one is email or nothing.
    const seg = m.querySelector('#cmp-seg');
    if (seg) seg.onclick = (e) => {
      const b = e.target.closest('[data-ch]');
      if (!b) return;
      state_.channel = b.dataset.ch;
      load();
    };
    m.querySelector('#cmp-body-text').oninput = recost;
    const reword = m.querySelector('#cmp-reword');
    if (reword) reword.onclick = async () => {
      const box = m.querySelector('#cmp-body-text');
      const was = reword.innerHTML;
      reword.disabled = true;
      reword.innerHTML = 'Rewording…';
      try {
        const r = await api.post('/api/marketing/rewrite', { text: box.value, channel: state_.channel });
        box.value = r.text;
        recost();
        const note = m.querySelector('#cmp-reword-note');
        if (note && r.allowance) note.textContent = `Done. ${r.allowance.left} Kai messages left this month. Edit anything you like.`;
      } catch (err) {
        toast(err.message, 'err', { ms: 6000 });
      } finally {
        reword.disabled = false;
        reword.innerHTML = was;
      }
    };
    m.querySelector('#cmp-people').onchange = (e) => {
      const c = e.target.closest('[data-id]');
      if (!c) return;
      const id = Number(c.dataset.id);
      if (c.checked) state_.chosen.add(id); else state_.chosen.delete(id);
      recost();
    };
    const all = m.querySelector('#cmp-all');
    if (all) all.onclick = () => {
      // "Select all" cannot mean "give one slot to everybody". With a slot
      // attached it fills up to the cap and stops, which is the honest reading
      // of the button — the alternative is a click that lands the owner on a
      // disabled Send with no idea why.
      const cap = capFor();
      const most = cap === null ? live : live.slice(0, cap);
      const already = state_.chosen.size >= most.length;
      state_.chosen = already ? new Set() : new Set(most.map((r) => r.id));
      m.querySelectorAll('#cmp-people [data-id]').forEach((c) => {
        c.checked = state_.chosen.has(Number(c.dataset.id));
      });
      all.textContent = already ? 'Select all' : 'Select none';
      recost();
    };
  };

  m.querySelector('#cmp-send').onclick = async (e) => {
    const btn = e.currentTarget;
    // A speed bump proportionate to the size of the thing. Twelve messages is a
    // normal afternoon; a hundred and ninety is a decision, and it cannot be
    // taken back once the queue starts.
    const n = state_.chosen.size;
    if (n >= 30) {
      const okBig = await confirmDialog(
        `Email ${n} clients?`,
        `This goes out to <b>${n} people</b> at once, and there's no unsending it.`
        + ` Emails cost you nothing, but your inbox may get busy — that's the point.`,
        { okText: `Send to ${n}` },
      );
      if (!okBig) return;
    }
    btn.disabled = true;
    const was = btn.innerHTML;
    btn.innerHTML = 'Sending…';
    try {
      // The slot goes with the send, not with the draft: whoever receives this
      // gets a link that opens on that exact time. Left off a broadcast on
      // purpose — one slot to the whole list is the disappointment the cap
      // exists to prevent, and "we've got room this week" has nothing to run out.
      const offer = campaign.offer && state_.audience !== 'everyone' ? campaign.offer : null;
      const res = await api.post('/api/campaigns/send', {
        kind: campaign.kind,
        ...(campaign.perk_short || campaign.perk ? { perk: campaign.perk_short || campaign.perk } : {}),
        channel: state_.channel,
        subject: m.querySelector('#cmp-subject')?.value || '',
        body: m.querySelector('#cmp-body-text').value,
        client_ids: [...state_.chosen],
        ...(offer ? {
          offer_service_ids: offer.service_ids,
          offer_staff_id: offer.staff_id || undefined,
          offer_date: offer.date,
          offer_start_min: offer.start_min,
        } : {}),
      });
      toast(res.detail, res.queued ? 'ok' : 'err', { ms: 6000 });
      m.close();
      if (onSent) onSent(res);
    } catch (err) {
      toast(err.message, 'err', { ms: 7000 });
      btn.disabled = false; btn.innerHTML = was;
    }
  };

  load();
}
