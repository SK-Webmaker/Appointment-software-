// The Marketing automations card in Settings.
//
// Six switches that can each message a client list, so the screen's job is to
// make the consequence obvious BEFORE the switch is flipped: who it would
// reach, what it would cost, and what the message actually says with a real
// client's name in it. An owner should never be surprised by something they
// turned on here.
import { esc, icon, toast, money } from './ui.js';

const CHANNELS = [['sms', 'Text message'], ['email', 'Email'], ['both', 'Both']];

/**
 * Where an automation needs something the owner has to know about, said before
 * the switch rather than discovered after it.
 *
 * The abandoned-booking one is not a nicety. Switching it on changes the PUBLIC
 * booking page — it starts holding a client's name and number for a week — and
 * the salon, not Kairo, is the one answering for that. Nobody should find that
 * out by reading the privacy notice on their own booking page.
 */
const NEEDS = {
  birthday: 'Only reaches clients with a birthday saved on their record — the '
    + 'month and day, on the client\'s card. Nobody else is messaged.',
  abandoned_booking: 'Turning this on changes your booking page: if a client already '
    + 'on your list starts booking and leaves without confirming, their details are '
    + 'kept for 7 days so this can follow up, then deleted. The page says so, above '
    + 'the button. Somebody booking with you for the first time is never recorded — '
    + 'they never agreed to be contacted, so this leaves them alone.',
};

/** One automation's row: the switch, the state, and the detail behind it. */
function row(a, preview) {
  const reach = preview
    ? `${preview.total_eligible} ${preview.total_eligible === 1 ? 'client' : 'clients'} right now`
    : '…';
  const cost = preview && preview.cost.cents
    ? ` · about ${money(preview.cost.cents)} to send`
    : preview ? ' · free by email' : '';

  return `
    <details class="auto" data-kind="${esc(a.kind)}">
      <summary>
        <label class="auto-switch" title="${a.enabled ? 'On' : 'Off'}">
          <input type="checkbox" class="chk" data-toggle ${a.enabled ? 'checked' : ''}>
        </label>
        <span class="auto-name">
          <b>${esc(a.label)}</b>
          <span class="auto-blurb">${esc(a.blurb)}</span>
        </span>
        <span class="auto-state">${a.enabled
          ? `<span class="chip s-paid"><span class="dot"></span>On</span>`
          : '<span class="chip s-draft"><span class="dot"></span>Off</span>'}</span>
      </summary>

      <div class="auto-body">
        <div class="auto-reach">
          ${icon('users', 15)} <span data-reach>Would reach ${reach}${cost}</span>
        </div>
        ${NEEDS[a.kind] ? `<div class="auto-needs">${icon('alert', 14)} ${esc(NEEDS[a.kind])}</div>` : ''}

        <div class="form-grid">
          <div class="field"><label>Send by</label>
            <select data-f="channel" class="nice-select">
              ${CHANNELS.map(([v, l]) => `<option value="${v}" ${a.channel === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select></div>
          <div class="field"><label>Most per day</label>
            <input type="number" data-f="max_per_day" min="1" max="60" value="${a.max_per_day}"></div>
          <div class="field"><label>Leave alone for (days)</label>
            <input type="number" data-f="cooldown_days" min="0" max="365" value="${a.cooldown_days}"></div>
        </div>

        <div class="field" style="margin-top:12px"><label>Message</label>
          <textarea data-f="body" rows="5" class="cmp-text">${esc(a.body)}</textarea></div>
        <div class="cmp-hint">
          <b>{first_name}</b> becomes each person's name. <b>{booking_link}</b> becomes your booking
          page — a different link for each person, so you can see who booked because of it.
          <b>{business_name}</b> is your salon.
        </div>

        ${preview?.example ? `
          <div class="auto-example">
            <div class="auto-example-label">What they'll actually get</div>
            <div class="auto-example-body">${esc(preview.example)}</div>
          </div>` : ''}

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
          <button class="btn primary" data-save>${icon('check')} Save</button>
          <button class="btn" data-run>${icon('send')} Run it now</button>
        </div>
        <div class="auto-note">
          Runs once each morning. Nothing goes out between 6pm and 10am, and never to
          someone who has opted out or heard from you in the last ${a.cooldown_days} days.
        </div>
      </div>
    </details>`;
}

export async function mountAutomations(el, api) {
  const load = async () => {
    el.classList.add('is-loading');
    let data;
    try {
      data = await api.get('/api/automations');
    } catch (err) {
      el.classList.remove('is-loading');
      el.innerHTML = `<div class="cell-sub">Couldn't load automations — ${esc(err.message)}</div>`;
      return;
    }

    // Previews in parallel: each one is a read, and the reach figure is the
    // whole point of the card.
    const previews = Object.fromEntries(await Promise.all(
      data.automations.map(async (a) => {
        try { return [a.kind, await api.get(`/api/automations/${a.kind}/preview`)]; }
        catch { return [a.kind, null]; }
      })
    ));

    el.classList.remove('is-loading');
    el.innerHTML = data.automations.map((a) => row(a, previews[a.kind])).join('');
  };

  await load();

  el.addEventListener('change', async (e) => {
    const box = e.target.closest('[data-toggle]');
    if (!box) return;
    const kind = box.closest('.auto').dataset.kind;
    try {
      await api.put(`/api/automations/${kind}`, { enabled: box.checked });
      toast(box.checked ? 'Automation on — first run tomorrow morning' : 'Automation off', 'ok');
      await load();
    } catch (err) {
      box.checked = !box.checked;
      toast(err.message, 'err');
    }
  });

  el.addEventListener('click', async (e) => {
    const wrap = e.target.closest('.auto');
    if (!wrap) return;
    const kind = wrap.dataset.kind;
    const read = () => {
      const v = {};
      wrap.querySelectorAll('[data-f]').forEach((f) => { v[f.dataset.f] = f.value; });
      return v;
    };

    if (e.target.closest('[data-save]')) {
      e.preventDefault();
      try {
        await api.put(`/api/automations/${kind}`, read());
        toast('Saved', 'ok');
        await load();
      } catch (err) { toast(err.message, 'err'); }
      return;
    }

    if (e.target.closest('[data-run]')) {
      e.preventDefault();
      try {
        // Save first, so "run it now" uses what's on screen rather than what
        // was last saved — otherwise an owner tests a message they didn't write.
        await api.put(`/api/automations/${kind}`, read());
        const r = await api.post(`/api/automations/${kind}/run`, {});
        toast(
          r.reason === 'off' ? 'Turn it on first'
            : r.queued ? `Queued ${r.queued} — they'll go out from 10am`
              : 'Nobody is due right now',
          r.queued ? 'ok' : 'err'
        );
        await load();
      } catch (err) { toast(err.message, 'err'); }
    }
  });
}
