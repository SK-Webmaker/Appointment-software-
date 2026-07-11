// Reviews: post-visit client feedback collected automatically after
// checkout. Owners see the average rating, read comments, and can post a
// short public-style reply (stored on the review, shown back to the client
// if you later choose to surface it).
import { api } from '../api.js';
import { esc, icon, fmtDate, starsHtml, toast } from '../ui.js';

let onlyLow = false;

export async function renderReviews(container) {
  const data = await api.get(`/api/reviews${onlyLow ? '?max_rating=3' : ''}`);

  container.innerHTML = `
    <div class="page-head">
      <div class="ph-icon">${icon('star', 20)}</div>
      <div><h1>Reviews</h1><div class="ph-sub">Automatic feedback requests sent after checkout</div></div>
    </div>

    <div class="stats-row" style="grid-template-columns:repeat(3,1fr)">
      <div class="card stat-tile">
        <div class="st-top"><span class="st-label">Average rating</span><span class="st-icon tint-amber">${icon('star')}</span></div>
        <div class="st-value">${data.total ? data.average.toFixed(1) : '—'}</div>
        <div class="st-foot">${data.total ? starsHtml(data.average, 12) : 'No reviews yet'}</div>
      </div>
      <div class="card stat-tile">
        <div class="st-top"><span class="st-label">Total reviews</span><span class="st-icon tint-cyan">${icon('users')}</span></div>
        <div class="st-value">${data.total}</div>
        <div class="st-foot">All time</div>
      </div>
      <div class="card stat-tile">
        <div class="st-top"><span class="st-label">This month</span><span class="st-icon tint-green">${icon('trendUp')}</span></div>
        <div class="st-value">${data.last_30d}</div>
        <div class="st-foot">Last 30 days</div>
      </div>
    </div>

    <div class="toolbar">
      <div class="seg" id="rv-filter">
        <button data-low="0" class="${!onlyLow ? 'active' : ''}">All reviews</button>
        <button data-low="1" class="${onlyLow ? 'active' : ''}">3★ &amp; under</button>
      </div>
    </div>

    <div class="card" id="rv-list">
      ${data.reviews.length ? data.reviews.map(rowHtml).join('') : `
        <div class="empty">${icon('star')}<div>No reviews ${onlyLow ? 'in this range' : 'yet'} — they're requested automatically once a visit is marked Completed.</div></div>`}
    </div>`;

  container.querySelector('#rv-filter').addEventListener('click', (e) => {
    const b = e.target.closest('[data-low]');
    if (!b) return;
    onlyLow = b.dataset.low === '1';
    renderReviews(container);
  });

  container.querySelector('#rv-list').addEventListener('click', (e) => {
    const replyBtn = e.target.closest('[data-reply-open]');
    if (replyBtn) {
      const row = replyBtn.closest('.review-row');
      row.querySelector('.review-reply-form').style.display = 'flex';
      row.querySelector('.review-reply-form input').focus();
      replyBtn.style.display = 'none';
    }
  });
  container.querySelector('#rv-list').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    if (!form.classList.contains('review-reply-form')) return;
    const id = form.dataset.id;
    const input = form.querySelector('input');
    try {
      await api.put(`/api/reviews/${id}/response`, { response: input.value });
      toast('Reply saved');
      renderReviews(container);
    } catch (err) { toast(err.message, 'err'); }
  });
}

function rowHtml(r) {
  const name = r.client_name || 'A client';
  return `
    <div class="review-row">
      <div class="rr-top">
        ${starsHtml(r.rating)}
        <span class="cell-main">${esc(name)}</span>
        <span class="rr-meta">${r.service_name ? esc(r.service_name) + ' · ' : ''}${r.staff_name ? esc(r.staff_name) + ' · ' : ''}${r.appt_date ? fmtDate(r.appt_date, { weekday: false }) : fmtDate(r.created_at.slice(0, 10), { weekday: false })}</span>
      </div>
      ${r.comment ? `<div class="rr-comment">"${esc(r.comment)}"</div>` : ''}
      ${r.response ? `<div class="rr-response"><b>Your reply:</b> ${esc(r.response)}</div>` : `
        <button class="btn small ghost" style="align-self:flex-start;margin-left:14px" data-reply-open>${icon('reply', 13)} Reply</button>`}
      <form class="review-reply-form" data-id="${r.id}" style="display:none">
        <input placeholder="Write a short reply…" maxlength="2000">
        <button class="btn small primary" type="submit">Save</button>
      </form>
    </div>`;
}
