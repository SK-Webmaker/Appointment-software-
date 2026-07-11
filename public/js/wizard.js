// Owner-facing guided setup wizard. Shows on first login (or re-run from
// Settings) and walks the owner through business details, hours, branding,
// services, team, and reminders — then applies everything in one call.
import { api } from './api.js';
import { esc, icon, toast, LOGO_SVG } from './ui.js';

// Starter service menus by business type: [name, category, duration_min,
// price, price_type?]. price_type omitted = 'fixed'; 'from' marks services
// whose true price depends on the client (hair length, skin area, etc.) —
// the same distinction Fresha's service menu makes; 'free' marks consults.
const STARTER = {
  salon: { label: 'Hair salon', emoji: '💇', services: [
    ['Cut & Finish', 'Hair', 60, 55], ['Blow Dry', 'Hair', 45, 35],
    ['Root Colour', 'Colour', 105, 85], ['Full Colour', 'Colour', 120, 110, 'from'],
    ['Balayage', 'Colour', 150, 150, 'from'], ['Toner & Gloss', 'Colour', 45, 45],
    ['Deep Treatment', 'Treatments', 30, 30],
  ] },
  barber: { label: 'Barbershop', emoji: '💈', services: [
    ['Skin Fade', 'Cuts', 45, 30], ['Haircut', 'Cuts', 30, 25],
    ['Beard Trim', 'Grooming', 20, 15], ['Cut & Beard', 'Cuts', 50, 38],
    ['Hot Towel Shave', 'Grooming', 40, 35], ['Kids Cut', 'Cuts', 20, 18],
  ] },
  nails: { label: 'Nails', emoji: '💅', services: [
    ['Gel Manicure', 'Nails', 45, 35], ['Classic Manicure', 'Nails', 30, 25],
    ['Gel Pedicure', 'Nails', 60, 45], ['Acrylic Full Set', 'Nails', 90, 60, 'from'],
    ['Infills', 'Nails', 60, 40], ['Nail Art', 'Nails', 30, 20, 'from'],
  ] },
  spa: { label: 'Spa & massage', emoji: '💆', services: [
    ['Swedish Massage', 'Massage', 60, 75], ['Deep Tissue Massage', 'Massage', 60, 85],
    ['Hot Stone Massage', 'Massage', 90, 120], ['Facial', 'Skincare', 60, 70],
    ['Body Scrub', 'Body', 45, 60],
  ] },
  aesthetics: { label: 'Aesthetics / clinic', emoji: '✨', services: [
    ['Consultation', 'Consults', 30, 0, 'free'], ['Skin Treatment', 'Treatments', 45, 120, 'from'],
    ['Dermal Filler', 'Injectables', 45, 250, 'from'], ['Anti-wrinkle', 'Injectables', 30, 180, 'from'],
    ['Follow-up', 'Consults', 20, 35],
  ] },
  fitness: { label: 'Fitness / trainer', emoji: '🏋️', services: [
    ['Personal Training (60m)', 'Training', 60, 60], ['Personal Training (30m)', 'Training', 30, 35],
    ['Fitness Assessment', 'Training', 45, 40, 'free'], ['Small Group Session', 'Training', 60, 25],
  ] },
  tattoo: { label: 'Tattoo & piercing', emoji: '🎨', services: [
    ['Consultation', 'Tattoo', 30, 0, 'free'], ['Small Tattoo', 'Tattoo', 60, 120, 'from'],
    ['Half-Day Session', 'Tattoo', 240, 450, 'from'], ['Piercing', 'Piercing', 30, 40],
  ] },
  other: { label: 'Something else', emoji: '📅', services: [
    ['Standard Appointment', 'General', 60, 50], ['Short Appointment', 'General', 30, 30],
    ['Consultation', 'General', 45, 0, 'free'],
  ] },
};

const timeOpts = (sel) => {
  let out = '';
  for (let t = 360; t <= 1440; t += 30) {
    const h = Math.floor(t / 60), m = t % 60, ap = h >= 12 ? 'PM' : 'AM', hh = h % 12 || 12;
    out += `<option value="${t}" ${t === sel ? 'selected' : ''}>${hh}:${String(m).padStart(2, '0')} ${ap}</option>`;
  }
  return out;
};

export function runSetupWizard({ firstRun = true, settings = {}, onDone } = {}) {
  const s = settings || {};
  const data = {
    fresh: firstRun,
    type: '',
    settings: {
      business_name: firstRun ? '' : (s.business_name || ''),
      business_phone: s.business_phone || '',
      business_address: s.business_address || '',
      business_email: s.business_email || '',
      currency: s.currency || '$',
      tax_rate: s.tax_rate || '0',
      open_min: Number(s.open_min || 540),
      close_min: Number(s.close_min || 1140),
      slot_interval: s.slot_interval || '15',
      brand_theme: s.brand_theme || 'dark',
      brand_accent: /^#[0-9a-fA-F]{6}$/.test(s.brand_accent || '') ? s.brand_accent : '#38bdf8',
      brand_font: s.brand_font || 'modern',
      brand_tagline: s.brand_tagline || '',
      brand_logo: '', brand_cover: '',
      confirm_enabled: (s.confirm_enabled ?? '1') === '1',
      reminders_enabled: (s.reminders_enabled ?? '1') === '1',
      reminder_hours: s.reminder_hours || '24',
      receipts_enabled: (s.receipts_enabled ?? '1') === '1',
      review_requests_enabled: (s.review_requests_enabled ?? '1') === '1',
      sms_notifications_enabled: s.sms_notifications_enabled === '1',
      deposit_type: s.deposit_type || 'none',
      deposit_value: s.deposit_value || '20',
    },
    logo: '', cover: '',
    services: [],   // {name, category, duration_min, price, on}
    team: firstRun ? [{ name: '', title: '' }] : [],
  };

  const steps = ['welcome', 'type', 'details', 'hours', 'brand', 'services', 'team', 'comms', 'done'];
  let idx = 0;

  const overlay = document.createElement('div');
  overlay.className = 'wiz-overlay';
  document.body.appendChild(overlay);

  const cur = () => data.settings.currency || '$';

  const readImage = (file, maxKb) => new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('Please choose an image file')); return; }
    if (file.size > maxKb * 1024) { reject(new Error(`Image must be under ${maxKb} KB`)); return; }
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Could not read that file'));
    r.readAsDataURL(file);
  });

  // ---- step renderers -----------------------------------------------------

  const views = {
    welcome: () => `
      <div class="wiz-hero">${LOGO_SVG}</div>
      <h1>Welcome to Kairo</h1>
      <p class="wiz-lede">Let's set up your booking system. It takes about 5 minutes, and you can
        change anything later in Settings.${firstRun ? ' This replaces the sample data with your real business.' : ''}</p>
      <div class="wiz-checklist">
        ${['Your business details & hours', 'Your brand — colours, logo, photos', 'Your services & team', 'Reminders & deposits'].map((t) =>
          `<div class="wiz-check">${icon('check', 14)} ${t}</div>`).join('')}
      </div>`,

    type: () => `
      <h2>What kind of business are you?</h2>
      <p class="wiz-sub">We'll suggest a starter service menu you can edit.</p>
      <div class="wiz-grid">
        ${Object.entries(STARTER).map(([k, v]) => `
          <button type="button" class="wiz-tile ${data.type === k ? 'sel' : ''}" data-type="${k}">
            <span class="wiz-emoji">${v.emoji}</span><span>${esc(v.label)}</span>
          </button>`).join('')}
      </div>`,

    details: () => `
      <h2>Your business details</h2>
      <p class="wiz-sub">This appears on your booking page and invoices.</p>
      <div class="wiz-form">
        <div class="field"><label>Business name *</label>
          <input id="w-name" value="${esc(data.settings.business_name)}" placeholder="e.g. Luxe Hair Studio"></div>
        <div class="wiz-2col">
          <div class="field"><label>Phone</label><input id="w-phone" value="${esc(data.settings.business_phone)}" placeholder="(555) 000-0000"></div>
          <div class="field"><label>Email</label><input id="w-email" type="email" value="${esc(data.settings.business_email)}" placeholder="hello@business.com"></div>
        </div>
        <div class="field"><label>Address</label><input id="w-address" value="${esc(data.settings.business_address)}" placeholder="12 Market Street"></div>
        <div class="wiz-2col">
          <div class="field"><label>Currency symbol</label><input id="w-currency" maxlength="4" value="${esc(data.settings.currency)}"></div>
          <div class="field"><label>Sales tax %</label><input id="w-tax" type="number" min="0" step="0.1" value="${esc(data.settings.tax_rate)}"></div>
        </div>
      </div>`,

    hours: () => `
      <h2>When are you open?</h2>
      <p class="wiz-sub">Sets the calendar grid and the times customers can book online.</p>
      <div class="wiz-form">
        <div class="wiz-2col">
          <div class="field"><label>Opens</label><select id="w-open">${timeOpts(data.settings.open_min)}</select></div>
          <div class="field"><label>Closes</label><select id="w-close">${timeOpts(data.settings.close_min)}</select></div>
        </div>
        <div class="field"><label>Booking slot interval</label>
          <select id="w-slot">${[10, 15, 20, 30, 60].map((v) => `<option value="${v}" ${String(data.settings.slot_interval) === String(v) ? 'selected' : ''}>${v} minutes</option>`).join('')}</select></div>
      </div>`,

    brand: () => `
      <h2>Make it yours</h2>
      <p class="wiz-sub">How your booking page looks to customers.</p>
      <div class="wiz-form">
        <div class="wiz-2col">
          <div class="field"><label>Style</label>
            <select id="w-theme"><option value="dark" ${data.settings.brand_theme === 'dark' ? 'selected' : ''}>Dark (sleek)</option><option value="light" ${data.settings.brand_theme === 'light' ? 'selected' : ''}>Light (bright)</option></select></div>
          <div class="field"><label>Font</label>
            <select id="w-font"><option value="modern" ${data.settings.brand_font === 'modern' ? 'selected' : ''}>Modern</option><option value="classic" ${data.settings.brand_font === 'classic' ? 'selected' : ''}>Classic serif</option><option value="rounded" ${data.settings.brand_font === 'rounded' ? 'selected' : ''}>Rounded</option></select></div>
        </div>
        <div class="field"><label>Brand colour</label>
          <div class="wiz-swatches" id="w-swatches">
            ${['#38bdf8', '#d55181', '#a855f7', '#f59e0b', '#10b981', '#e11d48', '#c2874a', '#0ea5e9'].map((c) =>
              `<button type="button" data-c="${c}" style="background:${c};border-color:${data.settings.brand_accent.toLowerCase() === c ? '#fff' : 'transparent'}"></button>`).join('')}
            <input type="color" id="w-accent" value="${esc(data.settings.brand_accent)}">
          </div></div>
        <div class="wiz-2col">
          <div class="field"><label>Logo</label>
            <div class="wiz-upl"><img id="w-logo-prev" ${data.logo ? `src="${data.logo}"` : 'style="display:none"'}>
              <button type="button" class="btn small" id="w-logo-btn">${icon('upload')} Upload</button>
              <input type="file" id="w-logo-file" accept="image/*" hidden></div></div>
          <div class="field"><label>Cover photo</label>
            <div class="wiz-upl"><img id="w-cover-prev" ${data.cover ? `src="${data.cover}"` : 'style="display:none"'}>
              <button type="button" class="btn small" id="w-cover-btn">${icon('upload')} Upload</button>
              <input type="file" id="w-cover-file" accept="image/*" hidden></div></div>
        </div>
        <div class="field"><label>Welcome line</label>
          <input id="w-tagline" value="${esc(data.settings.brand_tagline)}" maxlength="120" placeholder="e.g. Colour, cuts & care in the heart of town"></div>
        <div class="wiz-preview" id="w-preview"></div>
      </div>`,

    services: () => `
      <h2>Your services</h2>
      <p class="wiz-sub">Tick the ones you offer and tweak price or time. Use <b>From</b> for services whose real
        price depends on the client (hair length, area size…) — you set the exact amount at checkout. You can import a full list later.</p>
      <div class="wiz-services" id="w-services">
        ${data.services.length ? data.services.map((sv, i) => `
          <div class="wiz-svc ${sv.on ? 'on' : ''}">
            <label class="wiz-svc-check"><input type="checkbox" data-svc-on="${i}" ${sv.on ? 'checked' : ''}></label>
            <input class="wiz-svc-name" data-svc-name="${i}" value="${esc(sv.name)}">
            <input class="wiz-svc-dur" type="number" min="5" step="5" data-svc-dur="${i}" value="${sv.duration_min}"><span class="wiz-u">min</span>
            <select class="wiz-svc-ptype" data-svc-ptype="${i}">
              <option value="fixed" ${sv.price_type === 'fixed' ? 'selected' : ''}>Fixed</option>
              <option value="from" ${sv.price_type === 'from' ? 'selected' : ''}>From</option>
              <option value="free" ${sv.price_type === 'free' ? 'selected' : ''}>Free</option>
            </select>
            ${sv.price_type === 'free'
              ? '<span class="wiz-u" style="width:64px;text-align:right">—</span>'
              : `<span class="wiz-u">${esc(cur())}</span><input class="wiz-svc-price" type="number" min="0" step="1" data-svc-price="${i}" value="${sv.price}">`}
          </div>`).join('') : '<div class="wiz-empty">Pick a business type to load a starter menu — or add your own below.</div>'}
      </div>
      <button type="button" class="btn small" id="w-add-svc">${icon('plus')} Add a service</button>`,

    team: () => `
      <h2>Your team</h2>
      <p class="wiz-sub">Everyone who takes bookings gets their own calendar column. Add yourself at least.</p>
      <div id="w-team">
        ${data.team.map((m, i) => `
          <div class="wiz-2col wiz-team-row">
            <div class="field"><input data-team-name="${i}" value="${esc(m.name)}" placeholder="Name"></div>
            <div class="field" style="display:flex;gap:8px">
              <input data-team-title="${i}" value="${esc(m.title)}" placeholder="Title (optional)">
              ${data.team.length > 1 ? `<button type="button" class="btn small danger" data-team-rm="${i}">${icon('x')}</button>` : ''}
            </div>
          </div>`).join('')}
      </div>
      <button type="button" class="btn small" id="w-add-team">${icon('plus')} Add team member</button>`,

    comms: () => `
      <h2>Reminders & deposits</h2>
      <p class="wiz-sub">Turn these on now; add the free provider keys later in Settings to start sending.</p>
      <div class="wiz-form">
        <label class="wiz-toggle"><input type="checkbox" id="w-confirm" ${data.settings.confirm_enabled ? 'checked' : ''}>
          <span><b>Booking confirmations</b><br><span class="wiz-muted">Sent the moment a client books</span></span></label>
        <label class="wiz-toggle"><input type="checkbox" id="w-remind" ${data.settings.reminders_enabled ? 'checked' : ''}>
          <span><b>Appointment reminders</b><br><span class="wiz-muted">Cut no-shows with a nudge before the visit</span></span></label>
        <div class="field"><label>Remind clients this long before</label>
          <select id="w-remind-hrs">${[2, 4, 12, 24, 48].map((h) => `<option value="${h}" ${String(data.settings.reminder_hours) === String(h) ? 'selected' : ''}>${h} hours</option>`).join('')}</select></div>
        <label class="wiz-toggle"><input type="checkbox" id="w-receipts" ${data.settings.receipts_enabled ? 'checked' : ''}>
          <span><b>Payment receipts</b><br><span class="wiz-muted">Sent automatically whenever a payment or deposit is recorded</span></span></label>
        <label class="wiz-toggle"><input type="checkbox" id="w-reviews" ${data.settings.review_requests_enabled ? 'checked' : ''}>
          <span><b>Review requests</b><br><span class="wiz-muted">A quick "how was your visit?" link, sent after checkout</span></span></label>
        <label class="wiz-toggle"><input type="checkbox" id="w-sms" ${data.settings.sms_notifications_enabled ? 'checked' : ''}>
          <span><b>Also send all of these as SMS</b><br><span class="wiz-muted">Email above is free. SMS costs ~1–2¢/text plus a one-time
            carrier setup (~$20–60) — leave this off for now and turn it on later in Settings once you've added Twilio.</span></span></label>
        <label class="wiz-toggle"><input type="checkbox" id="w-deposit" ${data.settings.deposit_type !== 'none' ? 'checked' : ''}>
          <span><b>Take a deposit on online bookings</b><br><span class="wiz-muted">The strongest no-show protection (needs Stripe later)</span></span></label>
        <div class="wiz-2col" id="w-deposit-opts" style="${data.settings.deposit_type !== 'none' ? '' : 'display:none'}">
          <div class="field"><label>Deposit type</label>
            <select id="w-deposit-type"><option value="fixed" ${data.settings.deposit_type === 'fixed' ? 'selected' : ''}>Fixed amount</option><option value="percent" ${data.settings.deposit_type === 'percent' ? 'selected' : ''}>% of price</option></select></div>
          <div class="field"><label>Amount (${esc(cur())} or %)</label><input id="w-deposit-val" type="number" min="0" step="1" value="${esc(data.settings.deposit_value)}"></div>
        </div>
      </div>`,

    done: () => `
      <div class="wiz-hero wiz-done">${icon('check', 34)}</div>
      <h1>You're all set!</h1>
      <p class="wiz-lede">${esc(data.settings.business_name || 'Your business')} is ready. Share your booking link with
        customers, and take bookings from your calendar right away.</p>
      <div class="wiz-linkbox">
        <span>${esc(location.origin)}/book</span>
        <button type="button" class="btn small" id="w-copy">${icon('link')} Copy</button>
      </div>
      <p class="wiz-sub">Put that link in your Instagram bio, Google profile and WhatsApp auto-reply.</p>`,
  };

  // ---- persistence of the current step's inputs into `data` ---------------

  function capture() {
    const id = steps[idx];
    const val = (sel) => overlay.querySelector(sel)?.value;
    if (id === 'details') {
      data.settings.business_name = val('#w-name') ?? data.settings.business_name;
      data.settings.business_phone = val('#w-phone');
      data.settings.business_email = val('#w-email');
      data.settings.business_address = val('#w-address');
      data.settings.currency = val('#w-currency') || '$';
      data.settings.tax_rate = val('#w-tax') || '0';
    } else if (id === 'hours') {
      data.settings.open_min = Number(val('#w-open'));
      data.settings.close_min = Number(val('#w-close'));
      data.settings.slot_interval = val('#w-slot');
    } else if (id === 'brand') {
      data.settings.brand_theme = val('#w-theme');
      data.settings.brand_font = val('#w-font');
      data.settings.brand_accent = val('#w-accent');
      data.settings.brand_tagline = val('#w-tagline');
    } else if (id === 'comms') {
      data.settings.confirm_enabled = overlay.querySelector('#w-confirm').checked;
      data.settings.reminders_enabled = overlay.querySelector('#w-remind').checked;
      data.settings.reminder_hours = val('#w-remind-hrs');
      data.settings.receipts_enabled = overlay.querySelector('#w-receipts').checked;
      data.settings.review_requests_enabled = overlay.querySelector('#w-reviews').checked;
      data.settings.sms_notifications_enabled = overlay.querySelector('#w-sms').checked;
      data.settings.deposit_type = overlay.querySelector('#w-deposit').checked ? val('#w-deposit-type') : 'none';
      data.settings.deposit_value = val('#w-deposit-val') || '20';
    }
    // services & team capture live via their own input handlers
  }

  // ---- render + wiring ----------------------------------------------------

  function render() {
    const id = steps[idx];
    const isLast = id === 'done';
    const canSkip = firstRun && idx === 0;
    overlay.innerHTML = `
      <div class="wiz-card">
        ${idx > 0 && !isLast ? `<div class="wiz-progress"><div class="wiz-bar" style="width:${(idx / (steps.length - 2)) * 100}%"></div></div>` : ''}
        <div class="wiz-body">${views[id]()}</div>
        <div class="wiz-foot">
          ${idx > 0 && !isLast ? `<button type="button" class="btn" id="w-back">Back</button>` : '<span></span>'}
          <div class="wiz-foot-right">
            ${canSkip ? `<button type="button" class="btn ghost" id="w-skip">Skip for now</button>` : ''}
            ${isLast
              ? `<button type="button" class="btn primary" id="w-finish">${icon('check')} Go to dashboard</button>`
              : `<button type="button" class="btn primary" id="w-next">${idx === steps.length - 2 ? 'Finish setup' : 'Continue'} ${icon('chevR')}</button>`}
          </div>
        </div>
      </div>`;
    wire(id);
  }

  function wire(id) {
    overlay.querySelector('#w-back')?.addEventListener('click', () => { capture(); idx--; render(); });
    overlay.querySelector('#w-skip')?.addEventListener('click', async () => {
      await api.post('/api/setup/skip', {});
      close(); onDone?.();
    });
    overlay.querySelector('#w-next')?.addEventListener('click', onNext);
    overlay.querySelector('#w-finish')?.addEventListener('click', () => { close(); onDone?.(); });
    overlay.querySelector('#w-copy')?.addEventListener('click', () => {
      navigator.clipboard.writeText(`${location.origin}/book`); toast('Booking link copied');
    });

    if (id === 'type') {
      overlay.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => {
        data.type = b.dataset.type;
        // load starter menu (only replace if the user hasn't customised yet)
        data.services = STARTER[data.type].services.map(([name, category, duration_min, price, price_type]) =>
          ({ name, category, duration_min, price, price_type: price_type || 'fixed', on: true }));
        render();
      }));
    }

    if (id === 'brand') {
      const preview = () => {
        const p = overlay.querySelector('#w-preview');
        const theme = overlay.querySelector('#w-theme').value;
        const font = overlay.querySelector('#w-font').value;
        const accent = overlay.querySelector('#w-accent').value;
        const fam = font === 'classic' ? 'Georgia, serif' : font === 'rounded' ? "'Trebuchet MS', sans-serif" : 'system-ui, sans-serif';
        p.style.background = theme === 'light' ? '#f5f7fa' : '#0e1520';
        p.style.color = theme === 'light' ? '#131c2b' : '#e9eef7';
        p.innerHTML = `<div style="font-family:${fam};font-weight:700;font-size:16px">${esc(data.settings.business_name || 'Your business')}</div>
          <div style="font-size:12px;opacity:.7;margin:2px 0 10px">${esc(overlay.querySelector('#w-tagline').value || 'Book an appointment')}</div>
          <span style="background:${accent};color:#fff;padding:6px 14px;border-radius:8px;font-size:12px;font-weight:600">Book now</span>`;
      };
      overlay.querySelectorAll('#w-swatches [data-c]').forEach((b) => b.addEventListener('click', () => {
        overlay.querySelector('#w-accent').value = b.dataset.c;
        overlay.querySelectorAll('#w-swatches [data-c]').forEach((x) => (x.style.borderColor = x === b ? '#fff' : 'transparent'));
        preview();
      }));
      ['#w-theme', '#w-font', '#w-accent', '#w-tagline'].forEach((sel) =>
        overlay.querySelector(sel).addEventListener('input', preview));
      const upload = (btn, file, prev, key, maxKb) => {
        overlay.querySelector(btn).addEventListener('click', () => overlay.querySelector(file).click());
        overlay.querySelector(file).addEventListener('change', async (e) => {
          if (!e.target.files[0]) return;
          try {
            data[key] = await readImage(e.target.files[0], maxKb);
            const img = overlay.querySelector(prev); img.src = data[key]; img.style.display = '';
          } catch (err) { toast(err.message, 'err'); }
        });
      };
      upload('#w-logo-btn', '#w-logo-file', '#w-logo-prev', 'logo', 250);
      upload('#w-cover-btn', '#w-cover-file', '#w-cover-prev', 'cover', 600);
      preview();
    }

    if (id === 'services') {
      const el = overlay.querySelector('#w-services');
      el?.addEventListener('input', (e) => {
        const t = e.target;
        if (t.dataset.svcOn != null) { data.services[t.dataset.svcOn].on = t.checked; t.closest('.wiz-svc').classList.toggle('on', t.checked); }
        else if (t.dataset.svcName != null) data.services[t.dataset.svcName].name = t.value;
        else if (t.dataset.svcDur != null) data.services[t.dataset.svcDur].duration_min = Number(t.value);
        else if (t.dataset.svcPrice != null) data.services[t.dataset.svcPrice].price = Number(t.value);
        else if (t.dataset.svcPtype != null) { data.services[t.dataset.svcPtype].price_type = t.value; render(); }
      });
      overlay.querySelector('#w-add-svc')?.addEventListener('click', () => {
        data.services.push({ name: '', category: 'General', duration_min: 45, price: 0, price_type: 'fixed', on: true }); render();
      });
    }

    if (id === 'team') {
      const el = overlay.querySelector('#w-team');
      el?.addEventListener('input', (e) => {
        const t = e.target;
        if (t.dataset.teamName != null) data.team[t.dataset.teamName].name = t.value;
        else if (t.dataset.teamTitle != null) data.team[t.dataset.teamTitle].title = t.value;
      });
      overlay.querySelectorAll('[data-team-rm]').forEach((b) => b.addEventListener('click', () => {
        data.team.splice(Number(b.dataset.teamRm), 1); render();
      }));
      overlay.querySelector('#w-add-team')?.addEventListener('click', () => { data.team.push({ name: '', title: '' }); render(); });
    }

    if (id === 'comms') {
      overlay.querySelector('#w-deposit')?.addEventListener('change', (e) => {
        overlay.querySelector('#w-deposit-opts').style.display = e.target.checked ? '' : 'none';
      });
    }
  }

  async function onNext() {
    capture();
    const id = steps[idx];
    if (id === 'details' && !String(data.settings.business_name || '').trim()) {
      toast('Please enter your business name', 'err');
      return;
    }
    if (idx === steps.length - 2) { await apply(); return; } // step before 'done'
    idx++;
    render();
  }

  async function apply() {
    const nextBtn = overlay.querySelector('#w-next');
    if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = 'Setting up…'; }
    const payload = {
      fresh: data.fresh,
      settings: {
        ...data.settings,
        confirm_enabled: data.settings.confirm_enabled ? '1' : '0',
        reminders_enabled: data.settings.reminders_enabled ? '1' : '0',
        receipts_enabled: data.settings.receipts_enabled ? '1' : '0',
        review_requests_enabled: data.settings.review_requests_enabled ? '1' : '0',
        sms_notifications_enabled: data.settings.sms_notifications_enabled ? '1' : '0',
        brand_logo: data.logo || '',
        brand_cover: data.cover || '',
        // The URL used to administer the app right now IS the URL customers
        // should use for booking/review links — captured automatically.
        public_url: location.origin,
      },
      team: data.team.filter((m) => String(m.name || '').trim()),
      services: data.services.filter((sv) => sv.on && String(sv.name || '').trim())
        .map((sv) => ({ name: sv.name, category: sv.category || 'General', duration_min: sv.duration_min, price: sv.price, price_type: sv.price_type || 'fixed' })),
    };
    try {
      await api.post('/api/setup/apply', payload);
      idx++; // -> done
      render();
    } catch (err) {
      toast(err.message || 'Setup failed — please try again', 'err');
      if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = 'Finish setup'; }
    }
  }

  function close() { overlay.remove(); }

  render();
}
