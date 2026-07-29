// Minimal SVG bar chart following the house dataviz rules:
// thin marks with 4px rounded data-ends anchored to the baseline, hairline
// grid, muted axis ink, per-mark hover tooltip. Single-series only (no legend).
import { esc } from './ui.js';

let tipEl = null;
function tip() {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'chart-tip';
    tipEl.style.display = 'none';
    document.body.appendChild(tipEl);
  }
  return tipEl;
}

function niceMax(v) {
  if (v <= 0) return 4;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 4, 5, 8, 10]) {
    if (m * pow >= v) return m * pow;
  }
  return 10 * pow;
}

/**
 * Render a single-series bar chart.
 * opts: { data: [{label, value, sub?}], color, height?, format?, barMax? }
 */
export function barChart(container, { data, color = '#3987e5', height = 210, format = (v) => v, barMax = 34 }) {
  const W = 640, H = height;
  const padL = 42, padR = 8, padT = 12, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const ticks = 4;

  const n = data.length || 1;
  const slot = plotW / n;
  const barW = Math.min(barMax, Math.max(6, slot * 0.52));
  const r = Math.min(4, barW / 2);

  let grid = '', labels = '', bars = '';
  for (let i = 0; i <= ticks; i++) {
    const y = padT + plotH - (plotH * i) / ticks;
    grid += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#1a2434" stroke-width="1"/>`;
    labels += `<text x="${padL - 8}" y="${y + 3.5}" text-anchor="end" font-size="10" fill="#64748b">${format((max * i) / ticks, true)}</text>`;
  }

  data.forEach((d, i) => {
    const cx = padL + slot * i + slot / 2;
    const h = max > 0 ? (d.value / max) * plotH : 0;
    const y = padT + plotH - h;
    const x = cx - barW / 2;
    // rounded top only, flat baseline
    const path = h <= r
      ? `M${x},${padT + plotH} v${-h} h${barW} v${h} z`
      : `M${x},${padT + plotH} v${-(h - r)} q0,${-r} ${r},${-r} h${barW - 2 * r} q${r},0 ${r},${r} v${h - r} z`;
    bars += `<path d="${path}" fill="${color}" data-i="${i}" class="bar-mark" style="cursor:default"/>`;
    // hover hit target wider than the mark
    bars += `<rect x="${padL + slot * i}" y="${padT}" width="${slot}" height="${plotH}" fill="transparent" data-i="${i}" class="bar-hit"/>`;
    // Labels are escaped: today they're only hours and dates, but a chart of
    // service or client names would otherwise become a stored-XSS route.
    labels += `<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="10.5" fill="#8b98ad">${esc(d.label)}</text>`;
  });

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" style="display:block">
      ${grid}
      <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="#26334a" stroke-width="1"/>
      ${bars}${labels}
    </svg>`;

  const svg = container.querySelector('svg');
  const marks = [...container.querySelectorAll('.bar-mark')];
  svg.addEventListener('mousemove', (e) => {
    const hit = e.target.closest('.bar-hit, .bar-mark');
    if (!hit) { tip().style.display = 'none'; marks.forEach((m) => (m.style.filter = '')); return; }
    const i = Number(hit.dataset.i);
    const d = data[i];
    marks.forEach((m, j) => (m.style.filter = j === i ? 'brightness(1.25)' : 'brightness(0.75)'));
    const t = tip();
    t.innerHTML = `<div class="t-label">${esc(d.sub || d.label)}</div><div class="t-value">${esc(format(d.value))}</div>`;
    t.style.display = 'block';
    const pad = 12;
    let x = e.clientX + pad, y = e.clientY - 36;
    if (x + t.offsetWidth > window.innerWidth - 8) x = e.clientX - t.offsetWidth - pad;
    t.style.left = `${x}px`;
    t.style.top = `${Math.max(8, y)}px`;
  });
  svg.addEventListener('mouseleave', () => {
    tip().style.display = 'none';
    marks.forEach((m) => (m.style.filter = ''));
  });
}
