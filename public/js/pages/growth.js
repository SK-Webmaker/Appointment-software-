// Growth: where new clients actually come from.
//
// The page exists to answer one question an owner cannot currently answer at
// all — "is any of this working?" — and to answer it in numbers that survive
// being checked. Referrals and discovery are shown apart, because a friend's
// recommendation would never have come through a marketplace and folding the
// two together produces a comparison that falls over the moment somebody
// thinks about it.
import { api } from '../api.js';
import { esc, icon, money, toast, copyText } from '../ui.js';

const REWARD_TYPES = [['none', 'Nothing'], ['fixed', 'A fixed amount'], ['percent', 'A percentage']];

/** A funnel step, with the drop from the one before it stated rather than implied. */
function step(label, value, of) {
  const pct = of > 0 ? Math.round((value / of) * 100) : null;
  return `
    <div class="gr-step">
      <div class="gr-step-v">${value}</div>
      <div class="gr-step-l">${esc(label)}</div>
      ${pct === null ? '' : `<div class="gr-step-p">${pct}% of those sent</div>`}
    </div>`;
}

export async function renderGrowth(container) {
  const since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  // Guarded rather than trusted. A reply with no body — a request abandoned
  // because the owner navigated away mid-load — resolves as null, and reading
  // a field off it throws a TypeError on a line that has nothing to do with the
  // cause. The page says so instead.
  const d = await api.get(`/api/growth?since=${since}`);
  if (!d || !d.referral) {
    container.innerHTML = `
      <div class="page-head">
        <div class="ph-icon">${icon('trendUp', 20)}</div>
        <div><h1>Growth</h1><div class="ph-sub">Where new clients came from</div></div>
      </div>
      <div class="card"><div class="gr-empty">${icon('alert', 15)}
        <span>Couldn't load this just now. Pull down to try again.</span></div></div>`;
    return;
  }

  const refs = d.referral;
  const heard = d.heard;

  container.innerHTML = `
    <div class="page-head">
      <div class="ph-icon">${icon('trendUp', 20)}</div>
      <div><h1>Growth</h1>
        <div class="ph-sub">Where new clients came from, last 90 days</div></div>
    </div>

    <div class="stats-row stats-3">
      <div class="card stat-tile">
        <div class="st-top"><span class="st-label">Sent by a client</span><span class="st-icon tint-cyan">${icon('users')}</span></div>
        <div class="st-value">${refs.visits}</div>
        <div class="st-foot">${refs.visits === 0 && refs.people > 0
          ? `${refs.people} booked, none turned up yet`
          : 'Visits that actually happened'}</div>
      </div>
      <div class="card stat-tile">
        <div class="st-top"><span class="st-label">Worth</span><span class="st-icon tint-green">${icon('dollar')}</span></div>
        <div class="st-value">${money(refs.earned_cents)}</div>
        <div class="st-foot">From those visits</div>
      </div>
      <div class="card stat-tile">
        <div class="st-top"><span class="st-label">Found you themselves</span><span class="st-icon tint-amber">${icon('search')}</span></div>
        <div class="st-value">${heard.discovery_count}</div>
        <div class="st-foot">Google, socials, walking past</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Referrals</div>
      <div class="card-sub" style="margin-bottom:16px">Every client gets their own link, on their record.
        Somebody who books through it is credited to them — but only if they're new to you, and only
        once they've actually been in. <b>A client you already had can't be referred to you</b>, or the
        number would flatter itself.</div>

      <form id="gr-reward" class="form-grid" style="margin-bottom:18px">
        <div class="field"><label>The client who refers gets</label>
          <select name="referral_reward_type" class="nice-select">
            ${REWARD_TYPES.map(([v, l]) => `<option value="${v}" ${refs.type === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></div>
        <div class="field"><label>How much</label>
          <input name="referral_reward_value" type="number" min="0" step="1" value="${refs.value || ''}" placeholder="0">
          <div class="hint">Dollars, or a percentage — whichever you picked.</div></div>
        <div class="field"><label>Their friend gets</label>
          <select name="referral_friend_type" class="nice-select">
            ${REWARD_TYPES.map(([v, l]) => `<option value="${v}" ${refs.friend_type === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></div>
        <div class="field"><label>How much</label>
          <input name="referral_friend_value" type="number" min="0" step="1" value="${refs.friend_value || ''}" placeholder="0">
          <div class="hint">Often the half that matters — the friend needs a reason to try somewhere new.</div></div>
        <div class="span2"><button class="btn primary" type="submit">${icon('check')} Save the offer</button></div>
      </form>

      ${refs.referrers.length ? `
        <div class="mini-label" style="margin-bottom:8px">Who has sent you people</div>
        ${refs.referrers.map((r) => `
          <div class="gr-row">
            <span class="gr-who"><b>${esc(`${r.first_name} ${r.last_name || ''}`.trim())}</b>
              <span>${r.people} booked · ${r.visits} turned up</span></span>
            <span class="money">${money(r.earned_cents)}</span>
            <a class="btn small" href="#/clients?q=${encodeURIComponent(r.first_name)}">Open</a>
          </div>`).join('')}`
        : `<div class="gr-empty">${icon('users', 15)}
             <span>Nobody has been referred yet. Open any client and copy their link — the most
             effective place to hand it over is at the counter, while they're happy.</span></div>`}
    </div>

    <div class="card">
      <div class="card-title">How they say they found you</div>
      <div class="card-sub" style="margin-bottom:14px">One optional question on the booking form.
        Every question costs you a few people who would otherwise have finished booking, so whether
        it's worth knowing is your call — and somebody arriving on a referral link is never asked,
        because they have already answered it.</div>
      <label class="opt-out" style="margin-bottom:16px">
        <input type="checkbox" class="chk" id="gr-ask" ${d.ask_heard_from ? 'checked' : ''}>
        <span><b>Ask how they found you</b>
          <span>Added to the details step, above the button, with "rather not say" as an answer.</span></span>
      </label>
      ${heard.sources.length ? `
        ${heard.sources.map((x) => `
          <div class="gr-row">
            <span class="gr-who"><b>${esc(x.label)}</b>
              <span>${x.discovery ? 'Found you on their own' : 'Came through someone'}</span></span>
            <span class="gr-count">${x.n}</span>
            <span class="money">${money(x.earned_cents)}</span>
          </div>`).join('')}
        <div class="gr-note">${icon('alert', 13)}
          <span>Only the <b>${heard.discovery_count}</b> who found you on their own are people a
          listing site could claim to have sent. A friend's recommendation was never theirs to
          take a commission on, and counting it would make the comparison one you couldn't
          defend if anyone checked.</span></div>`
        : `<div class="gr-empty">${icon('search', 15)}
             <span>${d.ask_heard_from
               ? 'Nothing recorded yet — it fills in from the next booking.'
               : 'Nothing recorded, because the question is switched off above.'}</span></div>`}
    </div>

    <div class="card">
      <div class="card-title">Reviews</div>
      <div class="card-sub" style="margin-bottom:16px">Sent, opened, and gone through to Google are
        three different numbers. Which one drops tells you what to fix.</div>
      <div class="gr-funnel">
        ${step('Requests sent', d.reviews.sent, 0)}
        ${step('Opened', d.reviews.opened, d.reviews.sent)}
        ${step('Rated', d.reviews.left, d.reviews.sent)}
        ${step('Went to Google', d.reviews.clicked, d.reviews.sent)}
      </div>
      ${!d.reviews.google_url_set ? `
        <div class="gr-note">${icon('alert', 13)}
          <span><b>No Google review link set.</b> Happy clients are being thanked and then sent
          nowhere. Add it in <a href="#/settings">Settings → Notifications</a> — the checklist below
          says where to find it.</span></div>` : ''}
      <div class="mini-label" style="margin:18px 0 8px">Getting found on Google</div>
      <div class="card-sub" style="margin-bottom:12px">Kairo can't do these for you — they happen on
        Google's own site, once, and then they keep working. In the order that pays off fastest:</div>
      <ol class="gr-check">
        <li><b>Claim your Business Profile.</b> Search your salon's name on Google. If there's a
          panel on the right with "Own this business?", that's yours to claim — it's free, and it
          takes a postcard or a phone call to verify.</li>
        <li><b>Put your booking link in the "Appointments" field.</b> Not the website field —
          the appointments one. It puts a Book button on your listing.</li>
        <li><b>Photos, and keep adding them.</b> Listings with photos get materially more clicks,
          and Google favours ones that are still being updated. Ten good ones beat forty rushed.</li>
        <li><b>Your hours, including the odd ones.</b> Public holidays especially — a client who
          turns up to a closed door leaves a review about it.</li>
        <li><b>Grab your review link and paste it into Settings.</b> On your profile, "Ask for
          reviews" gives you a short link. That's what goes in the Google review URL field, and it's
          what four- and five-star clients get sent to automatically.</li>
        <li><b>Answer every review, especially the bad ones.</b> A calm reply to a one-star is read
          by everyone who comes after, and it is worth more than the review cost you.</li>
      </ol>
    </div>`;

  // Saved on the spot rather than behind a Save button: it is one switch, and
  // the number it fills sits directly underneath it.
  container.querySelector('#gr-ask').onchange = async (e) => {
    const box = e.currentTarget;
    try {
      await api.put('/api/settings', { ask_heard_from: box.checked ? '1' : '0' });
      toast(box.checked ? 'The question is on your booking form' : 'The question is off');
    } catch (err) {
      box.checked = !box.checked;
      toast(err.message, 'err');
    }
  };

  container.querySelector('#gr-reward').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await api.put('/api/settings', {
        referral_reward_type: f.get('referral_reward_type'),
        referral_reward_value: String(Number(f.get('referral_reward_value')) || 0),
        referral_friend_type: f.get('referral_friend_type'),
        referral_friend_value: String(Number(f.get('referral_friend_value')) || 0),
      });
      toast('Offer saved', 'ok');
      renderGrowth(container);
    } catch (err) { toast(err.message, 'err'); }
  });
}
