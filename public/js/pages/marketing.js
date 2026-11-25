// Kai's week: the owner's marketing assistant.
//
// One screen that says how to fill the next seven days, worked out from the
// salon's own diary and clients (src/marketing.js). Every idea has one button,
// and it opens the same campaign preview every Kairo message goes through
// (../campaign-modal.js), where the owner sees the exact list, words and cost
// and presses Send. Kai never sends on its own.
import { api } from '../api.js';
import { esc, icon, money, toast, copyText, fmtDate } from '../ui.js';
import { openCampaign } from '../campaign-modal.js';

const GOALS = [
  ['quiet', 'Fill my quiet days'],
  ['occasion', 'An occasion'],
  ['service', 'Push one service'],
  ['winback', 'Win back lapsed clients'],
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const KIND_LABEL = {
  gap_offer: 'Gap offers', rebook_nudge: 'Rebooking nudges', winback_offer: 'Win-backs',
  birthday_offer: 'Birthdays', promo: 'Promos', due_back: 'Due back', lapsed_winback: 'Win-backs (automatic)',
  first_visit: 'After a first visit', abandoned_booking: 'Unfinished bookings', birthday: 'Birthdays (automatic)',
  no_future_booking: 'Left without rebooking',
};

function playCard(p, i, locked) {
  return `
    <div class="kw-play" data-i="${i}">
      <span class="kw-icon">${icon(p.icon || 'zap', 17)}</span>
      <div class="kw-body">
        <div class="kw-title">${esc(p.title)}</div>
        <div class="kw-why">${esc(p.why)}</div>
        ${p.perk ? `<div class="kw-perk">${icon('tag', 12)} Suggested perk: <b>${esc(p.perk.label)}</b>
          ${p.perk.type === 'addon' ? '<span>a free add-on, not money off</span>' : ''}</div>` : ''}
        ${p.sample ? `<div class="kw-sample">${esc(p.sample.replace(/\{first_name\}/g, p.sample_name || 'there').replace(/\n\nBook here: \{booking_link\}/, '').split('\n\n')[0])}</div>` : ''}
        <div class="kw-actions">
          ${p.promo
            ? `<button class="btn primary" data-promo="${i}">${icon('tag', 14)} Build the promo</button>
               <span class="kw-meta">Kai writes it; you choose who it goes to.</span>`
            : `<button class="btn primary" data-approve="${i}">${icon(locked ? 'lock' : 'send', 14)} ${locked ? 'Review' : 'Review and send'}</button>
               <span class="kw-meta">${p.count ? `${p.count} ${p.count === 1 ? 'person' : 'people'}` : 'To everyone, by email'}</span>`}
        </div>
      </div>
      ${p.worth_cents ? `
        <div class="kw-worth">
          <div class="v">${money(p.worth_cents)}</div>
          <div class="l">${esc(p.worth_label || '')}</div>
        </div>` : ''}
    </div>`;
}

function postCard(post) {
  if (!post) return '';
  return `
    <div class="card kw-post">
      <div class="kw-post-head">${icon('share', 15)} <b>This week's post</b> <span class="kw-meta">${esc(post.channel || '')}</span></div>
      <div class="kw-title" style="margin-top:6px">${esc(post.title)}</div>
      <div class="kw-why">${esc(post.why)}</div>
      ${post.photo ? `<div class="kw-why"><b>Photo:</b> ${esc(post.photo)}</div>` : ''}
      <pre class="kw-caption">${esc(post.caption)}</pre>
      <div class="kw-actions">
        <button class="btn" id="kw-copy-post">${icon('note', 14)} Copy caption</button>
        ${post.promo ? `<button class="btn" id="kw-post-promo">${icon('tag', 14)} Make it a promo</button>` : ''}
      </div>
    </div>`;
}

function resultsCard(r) {
  const rows = (r.by_kind || []).filter((k) => k.bookings);
  const monthName = new Date(`${r.month}-15T12:00:00`).toLocaleDateString('en-AU', { month: 'long' });
  return `
    <div class="card kw-results">
      <div class="kw-post-head">${icon('trendUp', 15)} <b>What your messages brought in</b></div>
      ${r.bookings ? `<div class="kw-res-big">${money(r.revenue_cents)} <span>from ${r.bookings} booking${r.bookings === 1 ? '' : 's'} in ${esc(monthName)}</span></div>`
        : `<div class="kw-title" style="margin-top:8px">Nothing yet in ${esc(monthName)}</div>`}
      <div class="kw-why">Only bookings made from the link in one of your messages are counted, never just "they booked
        after we texted". Last month: ${money(r.last_month?.revenue_cents || 0)} from ${r.last_month?.bookings || 0}.</div>
      ${rows.length ? `<div class="kw-kinds">${rows.map((k) => `
        <span class="earned-kind">${esc(KIND_LABEL[k.kind] || k.kind)} <b>${money(k.revenue_cents)}</b></span>`).join('')}</div>` : ''}
    </div>`;
}

function settingsCard(d) {
  return `
    <details class="card kw-settings">
      <summary>${icon('settings', 14)} Kai's settings</summary>
      <label class="kw-set">
        <span><b>Most Kai may suggest off</b><br><span class="kw-meta">Kai offers a free add-on first. Money off only when there isn't one, and never more than this.</span></span>
        <span class="kw-cap"><input type="number" id="kw-cap" min="0" max="50" step="1" value="${d.discount_cap}"> %</span>
      </label>
      <label class="kw-set">
        <span><b>Monday notification</b><br><span class="kw-meta">Your week's plan on your phone, Monday morning.</span></span>
        <input type="checkbox" class="chk" id="kw-push" ${d.settings.weekly_push ? 'checked' : ''}>
      </label>
      <label class="kw-set">
        <span><b>Monthly report by email</b><br><span class="kw-meta">Last month's numbers in your inbox on the 1st.</span></span>
        <input type="checkbox" class="chk" id="kw-report" ${d.settings.monthly_report ? 'checked' : ''}>
      </label>
      ${d.ai.available ? `<div class="kw-meta" style="margin-top:10px">Kai's AI: ${d.ai.used} of ${d.ai.allowance} messages used this month. It resets on the 1st.</div>` : ''}
    </details>`;
}

/** The promo builder, as its own panel under the plan. */
function promoPanel(state) {
  const p = state.promo;
  const goal = state.goal;
  return `
    <div class="card kw-promo">
      <div class="kw-post-head">${icon('tag', 15)} <b>Make a promo</b></div>
      <div class="seg kw-goals" id="kw-goals">
        ${GOALS.map(([k, l]) => `<button type="button" data-goal="${k}" class="${goal === k ? 'sel' : ''}">${esc(l)}</button>`).join('')}
      </div>
      ${goal === 'occasion' && p?.occasions?.length ? `
        <div class="kw-pick">
          <span class="kw-meta">Occasion</span>
          <select id="kw-occasion" class="nice-select">${p.occasions.map((o) => `
            <option value="${esc(o.key)}" ${state.occasion === o.key ? 'selected' : ''}>${esc(o.label)} · ${esc(fmtDate(o.date, { weekday: false }))}</option>`).join('')}</select>
        </div>` : ''}
      ${goal === 'quiet' ? `
        <div class="kw-pick"><span class="kw-meta">Days</span>
          <div class="seg" id="kw-days">${[1, 2, 3, 4, 5, 6, 0].map((d) => `
            <button type="button" data-day="${d}" class="${(p?.weekdays || []).includes(d) ? 'sel' : ''}">${DAYS[d]}</button>`).join('')}</div>
        </div>` : ''}
      ${goal === 'service' || goal === 'occasion' ? `
        <div class="kw-pick"><span class="kw-meta">Service</span>
          <select id="kw-service" class="nice-select"><option value="">${goal === 'occasion' ? 'Your most booked' : 'Pick one'}</option>
            ${(state.services || []).map((s) => `<option value="${s.id}" ${Number(state.serviceId) === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
          </select>
        </div>` : ''}
      <div id="kw-promo-body">${state.promoError ? `<div class="empty" style="padding:14px 4px">${esc(state.promoError)}</div>` : p ? `
        <div class="kw-title" style="margin-top:12px">${esc(p.title)}</div>
        <ul class="kw-reasons">${p.why.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
        ${p.perk ? `<div class="kw-perk">${icon('tag', 12)} Perk: <b>${esc(p.perk.label)}</b>${p.until ? ` · until ${esc(fmtDate(p.until, { weekday: false }))}` : ''}</div>` : ''}
        <div class="kw-two">
          <div>
            <div class="kw-meta">Text and email</div>
            <pre class="kw-caption">${esc(p.body.replace(/\{first_name\}/g, 'there').replace(/\{booking_link\}/g, 'your booking link'))}</pre>
          </div>
          ${p.caption ? `<div>
            <div class="kw-meta">Instagram caption</div>
            <pre class="kw-caption">${esc(p.caption)}</pre>
            <button class="btn small" id="kw-copy-caption">${icon('note', 13)} Copy caption</button>
          </div>` : ''}
        </div>
        <div class="kw-actions">
          <button class="btn primary" id="kw-promo-send">${icon(state.locked ? 'lock' : 'send', 14)} ${state.locked ? 'Review' : 'Review and send'}</button>
          <span class="kw-meta">You'll see who it goes to, and can change every word.</span>
        </div>` : '<div class="kw-meta" style="padding:12px 0">Working it out…</div>'}
      </div>
    </div>`;
}

export async function renderMarketing(container) {
  let d;
  try {
    d = await api.get('/api/marketing/week');
  } catch (err) {
    container.innerHTML = `
      <div class="page-head"><div class="ph-icon">${icon('zap', 20)}</div>
        <div><h1>Your week</h1><div class="ph-sub">Kai, your marketing assistant</div></div></div>
      <div class="card"><div class="empty">${icon('lock', 18)}<div>${esc(err?.status === 403 ? 'Only the business owner can see this.' : (err?.message || "Couldn't load this just now."))}</div></div></div>`;
    return;
  }
  const state = { goal: 'quiet', occasion: '', serviceId: 0, promo: null, promoError: '', services: [], locked: d.locked, weekdays: null };
  try {
    const sv = await api.get('/api/services');
    state.services = (Array.isArray(sv) ? sv : sv.services || []).filter((s) => s.active !== 0 && s.price_cents > 0);
  } catch { state.services = []; }

  const draw = () => {
    container.innerHTML = `
      <div class="page-head">
        <div class="ph-icon">${icon('zap', 20)}</div>
        <div><h1>Your week</h1><div class="ph-sub">Kai, your marketing assistant · week of ${esc(fmtDate(d.week_of, { weekday: false }))}</div></div>
      </div>
      ${d.locked ? `<div class="card kw-locked">${icon('lock', 15)} <span>This is what Kai would do for you this week. Sending comes with a plan,
        and everything here stays as it is when you choose one.</span></div>` : ''}
      <div class="card kw-hero">
        <div class="kw-headline">${esc(d.headline)}</div>
        <div class="kw-sub">${esc(d.sub)}</div>
        <div class="kw-promise">${icon('shield', 13)} Kai always asks first. Nothing is sent until you've seen who it goes to and pressed Send.</div>
      </div>
      <div class="kw-plays">${d.plays.map((p, i) => playCard(p, i, d.locked)).join('')
        || '<div class="card"><div class="empty">Nothing worth sending this week. Kai looks again every day.</div></div>'}</div>
      <div class="kw-grid">
        ${postCard(d.post)}
        ${resultsCard(d.results)}
      </div>
      ${promoPanel(state)}
      ${settingsCard(d)}`;
    wire();
  };

  const loadPromo = async () => {
    const q = new URLSearchParams({ goal: state.goal });
    if (state.goal === 'occasion' && state.occasion) q.set('occasion', state.occasion);
    if (state.serviceId) q.set('service_id', state.serviceId);
    if (state.goal === 'quiet' && state.weekdays) q.set('weekdays', state.weekdays.join(','));
    state.promoError = '';
    try {
      state.promo = await api.get(`/api/marketing/promo?${q}`);
      if (state.goal === 'occasion' && !state.occasion && state.promo.occasions?.length) state.occasion = state.promo.occasions[0].key;
    } catch (err) {
      state.promo = null;
      state.promoError = err.message;
    }
    draw();
  };

  const wire = () => {
    container.querySelectorAll('[data-approve]').forEach((b) => {
      b.onclick = () => {
        const p = d.plays[Number(b.dataset.approve)];
        openCampaign({ ...p.campaign, ai: d.ai.available }, { onSent: () => renderMarketing(container) });
      };
    });
    container.querySelectorAll('[data-promo]').forEach((b) => {
      b.onclick = () => {
        const p = d.plays[Number(b.dataset.promo)];
        state.goal = p.promo.goal;
        state.occasion = p.promo.occasion || '';
        state.weekdays = null;
        state.serviceId = 0;
        loadPromo().then(() => container.querySelector('.kw-promo')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      };
    });
    const copyPost = container.querySelector('#kw-copy-post');
    if (copyPost) copyPost.onclick = async () => toast(await copyText(d.post.caption) ? 'Caption copied' : 'Could not copy', 'ok');
    const postPromo = container.querySelector('#kw-post-promo');
    if (postPromo) postPromo.onclick = () => {
      state.goal = 'quiet';
      state.weekdays = d.post.promo.weekdays;
      loadPromo().then(() => container.querySelector('.kw-promo')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };
    container.querySelector('#kw-goals').onclick = (e) => {
      const b = e.target.closest('[data-goal]');
      if (!b || b.dataset.goal === state.goal) return;
      state.goal = b.dataset.goal;
      state.weekdays = null;
      state.serviceId = 0;
      state.promo = null;
      draw();
      loadPromo();
    };
    const occ = container.querySelector('#kw-occasion');
    if (occ) occ.onchange = () => { state.occasion = occ.value; loadPromo(); };
    const svc = container.querySelector('#kw-service');
    if (svc) svc.onchange = () => { state.serviceId = Number(svc.value) || 0; loadPromo(); };
    const days = container.querySelector('#kw-days');
    if (days) days.onclick = (e) => {
      const b = e.target.closest('[data-day]');
      if (!b) return;
      const n = Number(b.dataset.day);
      const cur = new Set(state.weekdays || state.promo?.weekdays || []);
      if (cur.has(n)) cur.delete(n); else cur.add(n);
      state.weekdays = [...cur].slice(0, 3);
      if (!state.weekdays.length) state.weekdays = null;
      loadPromo();
    };
    const cc = container.querySelector('#kw-copy-caption');
    if (cc) cc.onclick = async () => toast(await copyText(state.promo.caption) ? 'Caption copied' : 'Could not copy', 'ok');
    const ps = container.querySelector('#kw-promo-send');
    if (ps) ps.onclick = () => openCampaign({ ...state.promo.campaign, ai: d.ai.available }, { onSent: () => renderMarketing(container) });

    const save = async (patch, ok) => {
      try { await api.put('/api/settings', patch); toast(ok, 'ok'); } catch (err) { toast(err.message, 'err'); }
    };
    const cap = container.querySelector('#kw-cap');
    if (cap) cap.onchange = async () => {
      const v = Math.max(0, Math.min(50, Math.round(Number(cap.value) || 0)));
      cap.value = v;
      await save({ kai_discount_cap: String(v) }, `Kai will suggest at most ${v}% off`);
      d.discount_cap = v;
      if (state.promo) loadPromo();
    };
    const push = container.querySelector('#kw-push');
    if (push) push.onchange = () => save({ kai_weekly_push: push.checked ? '1' : '0' }, push.checked ? 'Monday notification on' : 'Monday notification off');
    const rep = container.querySelector('#kw-report');
    if (rep) rep.onchange = () => save({ monthly_report_enabled: rep.checked ? '1' : '0' }, rep.checked ? 'Monthly report on' : 'Monthly report off');
  };

  draw();
  loadPromo();
}
