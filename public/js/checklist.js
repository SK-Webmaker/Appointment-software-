// What is left before the salon is really running, above the day's work.
//
// It is not a tour and not a nag: every line is something that is actually not
// done yet, checked against the system rather than against a tick somebody
// clicked. When the last one is done the whole card goes, for good.
import { api } from './api.js';
import { esc, icon, toast } from './ui.js';

let mounted = null;

export async function mountChecklist(container) {
  mounted = container;
  await refresh();
}

async function refresh() {
  if (!mounted) return;
  let data;
  try { data = await api.get('/api/checklist'); } catch { return; }
  if (!data.show) { mounted.innerHTML = ''; return; }

  const left = data.items.filter((i) => !i.done);
  const urgent = left.filter((i) => i.required);
  mounted.innerHTML = `
    <div class="setup-card${urgent.length ? ' urgent' : ''}">
      <div class="setup-head">
        <div>
          <b>${urgent.length ? 'Two minutes to finish setting up' : 'Finishing touches'}</b>
          <span class="setup-count">${data.done} of ${data.total} done</span>
        </div>
        <button class="setup-toggle" id="setup-toggle" aria-expanded="true" title="Hide">${icon('chevR', 16)}</button>
      </div>
      <div class="setup-body" id="setup-body">
        ${left.map((i) => `
          <div class="setup-item${i.required ? ' req' : ''}">
            <div class="setup-dot"></div>
            <div class="setup-text">
              <b>${esc(i.title)}</b>
              <span>${esc(i.why)}</span>
              ${i.detail ? `<code>${esc(i.detail)}</code>` : ''}
            </div>
            <div class="setup-actions">
              ${i.action ? actionButton(i) : ''}
              ${i.tickable ? `<button class="btn small ghost" data-tick="${esc(i.tickable)}">Done</button>` : ''}
            </div>
          </div>`).join('')}
      </div>
    </div>`;

  mounted.querySelector('#setup-toggle')?.addEventListener('click', (e) => {
    const body = mounted.querySelector('#setup-body');
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : '';
    e.currentTarget.setAttribute('aria-expanded', String(!open));
  });

  mounted.addEventListener('click', async (e) => {
    const copy = e.target.closest('[data-copy]');
    if (copy) {
      try { await navigator.clipboard.writeText(copy.dataset.copy); toast('Link copied'); }
      catch { toast('Copy it from Settings'); }
      return;
    }
    const tick = e.target.closest('[data-tick]');
    if (!tick) return;
    tick.disabled = true;
    try {
      await api.put('/api/settings', { [tick.dataset.tick]: '1' });
      await refresh();
    } catch (err) { tick.disabled = false; toast(err.message); }
  });
}

function actionButton(i) {
  const a = i.action;
  if (a.copy) return `<button class="btn small" data-copy="${esc(a.copy)}">${esc(a.label)}</button>`;
  if (a.url) return `<a class="btn small" href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.label)}</a>`;
  return `<a class="btn small" href="${esc(a.hash || '#/settings')}">${esc(a.label)}</a>`;
}
