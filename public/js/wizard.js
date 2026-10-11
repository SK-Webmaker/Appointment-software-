// The owner's first ten minutes: setting up their business, as a journey.
//
// Shown on first sign-in (and re-runnable from Settings). It walks through what
// the business is, its details, hours, look, menu, team and messages, then
// applies everything in one call — the same payload /api/setup/apply has always
// taken, so nothing on the server changes with the way it looks.
//
// What makes it feel like opening a business rather than filling in a form:
//   - a journey bar across the top that fills as they go;
//   - their own booking page, live in a phone beside the steps, building up as
//     they answer (name, colours, logo, hours, menu, team);
//   - their name and their business's name in the words, and themselves already
//     on the team;
//   - steps that slide forwards and back, a short "building it" moment, and a
//     quiet tick when it is live. (It was confetti once. Confetti over the
//     link they need to copy is a party nobody asked for.)
// Everything that moves stops for anyone who has asked their device for less
// motion, and nothing depends on an animation finishing.
import { api } from './api.js';
import { esc, icon, toast, LOGO_SVG, copyText } from './ui.js';
import { inApp } from './native.js';
import { guideUrl, SUPPORT_EMAIL } from './help.js';

// Starter service menus by business type: [name, category, duration_min,
// price, price_type?]. price_type omitted = 'fixed'; 'from' marks services
// whose true price depends on the client (hair length, skin area, etc.) —
// the same distinction Fresha's service menu makes; 'free' marks consults.
const STARTER = {
  salon: { label: 'Hair salon', icon: 'scissors', services: [
    ['Cut & Finish', 'Hair', 60, 55], ['Blow Dry', 'Hair', 45, 35],
    ['Root Colour', 'Colour', 105, 85], ['Full Colour', 'Colour', 120, 110, 'from'],
    ['Balayage', 'Colour', 150, 150, 'from'], ['Toner & Gloss', 'Colour', 45, 45],
    ['Deep Treatment', 'Treatments', 30, 30],
  ] },
  barber: { label: 'Barbershop', icon: 'pole', services: [
    ['Skin Fade', 'Cuts', 45, 30], ['Haircut', 'Cuts', 30, 25],
    ['Beard Trim', 'Grooming', 20, 15], ['Cut & Beard', 'Cuts', 50, 38],
    ['Hot Towel Shave', 'Grooming', 40, 35], ['Kids Cut', 'Cuts', 20, 18],
  ] },
  nails: { label: 'Nails', icon: 'polish', services: [
    ['Gel Manicure', 'Nails', 45, 35], ['Classic Manicure', 'Nails', 30, 25],
    ['Gel Pedicure', 'Nails', 60, 45], ['Acrylic Full Set', 'Nails', 90, 60, 'from'],
    ['Infills', 'Nails', 60, 40], ['Nail Art', 'Nails', 30, 20, 'from'],
  ] },
  spa: { label: 'Spa & massage', icon: 'leaf', services: [
    ['Swedish Massage', 'Massage', 60, 75], ['Deep Tissue Massage', 'Massage', 60, 85],
    ['Hot Stone Massage', 'Massage', 90, 120], ['Facial', 'Skincare', 60, 70],
    ['Body Scrub', 'Body', 45, 60],
  ] },
  aesthetics: { label: 'Aesthetics / clinic', icon: 'drop', services: [
    ['Consultation', 'Consults', 30, 0, 'free'], ['Skin Treatment', 'Treatments', 45, 120, 'from'],
    ['Dermal Filler', 'Injectables', 45, 250, 'from'], ['Anti-wrinkle', 'Injectables', 30, 180, 'from'],
    ['Follow-up', 'Consults', 20, 35],
  ] },
  fitness: { label: 'Fitness / trainer', icon: 'dumbbell', services: [
    ['Personal Training (60m)', 'Training', 60, 60], ['Personal Training (30m)', 'Training', 30, 35],
    ['Fitness Assessment', 'Training', 45, 40, 'free'], ['Small Group Session', 'Training', 60, 25],
  ] },
  tattoo: { label: 'Tattoo & piercing', icon: 'pen', services: [
    ['Consultation', 'Tattoo', 30, 0, 'free'], ['Small Tattoo', 'Tattoo', 60, 120, 'from'],
    ['Half-Day Session', 'Tattoo', 240, 450, 'from'], ['Piercing', 'Piercing', 30, 40],
  ] },
  other: { label: 'Something else', icon: 'calendar', services: [
    ['Standard Appointment', 'General', 60, 50], ['Short Appointment', 'General', 30, 30],
    ['Consultation', 'General', 45, 0, 'free'],
  ] },
};

// The journey, in the owner's words. 'install' rides on the last milestone.
const STEPS = ['welcome', 'type', 'details', 'hours', 'brand', 'services', 'team', 'booking', 'comms', 'done', 'install'];
const MILESTONES = [
  ['welcome', 'Hello'], ['type', 'Your craft'], ['details', 'Details'], ['hours', 'Hours'],
  ['brand', 'Your look'], ['services', 'Menu'], ['team', 'Team'], ['booking', 'Bookings'], ['comms', 'Messages'], ['done', 'Open!'],
];
// Where a consultation-first business takes its first conversation. The same
// choices Settings → Online booking offers, each with a placeholder that shows
// what kind of answer it wants.
const CHANNELS = [
  ['instagram', 'Instagram', '@yoursalon'], ['whatsapp', 'WhatsApp', '0412 345 678'],
  ['facebook', 'Facebook Messenger', 'facebook.com/yoursalon'], ['phone', 'Phone', '0412 345 678'],
  ['email', 'Email', 'hello@yourbusiness.com'], ['other', 'Somewhere else', 'https://…'],
];
const channelName = (v) => (CHANNELS.find(([k]) => k === v) || CHANNELS[0])[1];
const isConsultService = (sv) => /consult/i.test(String(sv.name || ''));
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SWATCHES = ['#38bdf8', '#d55181', '#a855f7', '#f59e0b', '#10b981', '#e11d48', '#c2874a', '#0ea5e9'];
// Names a fresh install starts with — never somebody's business.
const PLACEHOLDER_NAMES = new Set(['demo studio', 'luxe hair studio', 'kairo']);

const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function clock(min) {
  const h = Math.floor(min / 60) % 24, m = min % 60, ap = h >= 12 ? 'pm' : 'am', hh = h % 12 || 12;
  return m ? `${hh}:${String(m).padStart(2, '0')}${ap}` : `${hh}${ap}`;
}

const timeOpts = (sel) => {
  let out = '';
  for (let t = 360; t <= 1440; t += 30) {
    const h = Math.floor(t / 60), m = t % 60, ap = h >= 12 ? 'PM' : 'AM', hh = h % 12 || 12;
    out += `<option value="${t}" ${t === sel ? 'selected' : ''}>${hh}:${String(m).padStart(2, '0')} ${ap}</option>`;
  }
  return out;
};

/** "Tue–Sat", "Mon, Wed & Fri", "Every day" — open days the way a sign says them. */
export function daysPhrase(days) {
  const d = [...new Set(days)].filter((x) => x >= 0 && x <= 6).sort((a, b) => a - b);
  if (!d.length) return 'Closed';
  if (d.length === 7) return 'Every day';
  // Runs, treating the week as Mon..Sun so "Sat–Sun" and "Mon–Fri" read naturally.
  const order = [1, 2, 3, 4, 5, 6, 0].filter((x) => d.includes(x));
  const pos = (x) => (x + 6) % 7;
  const runs = [];
  for (const x of order) {
    const last = runs[runs.length - 1];
    if (last && pos(x) === pos(last[last.length - 1]) + 1) last.push(x); else runs.push([x]);
  }
  const parts = runs.map((r) => (r.length >= 3 ? `${DAY[r[0]]}–${DAY[r[r.length - 1]]}` : r.map((x) => DAY[x]).join(', ')));
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} & ${parts[parts.length - 1]}` : parts[0];
}

const initials = (name) => String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '·';

export function runSetupWizard({ firstRun = true, settings = {}, user = null, hasSamples = false, onDone } = {}) {
  const s = settings || {};
  // The address customers should use. On the platform each business is deployed
  // with its own domain already set, so prefer that over whatever the owner
  // happens to have in their address bar — otherwise the very first link they
  // are shown, and copy, is the raw hosting URL.
  const siteUrl = (s.public_url_effective || location.origin).replace(/\/+$/, '');
  // A placeholder is not a name: "Hi Owner" is worse than no name at all.
  const rawName = String(user?.name || '').trim();
  const ownerName = /^(owner|admin|administrator|the owner)$/i.test(rawName) ? '' : rawName;
  const firstName = ownerName.split(/\s+/)[0] || '';
  // A paying business arrives with the name it signed up under; a fresh install
  // arrives with a placeholder, and the samples' name is not theirs either.
  const knownName = String(s.business_name || '').trim();
  const startName = (!firstRun || (!hasSamples && !PLACEHOLDER_NAMES.has(knownName.toLowerCase()))) ? knownName : '';

  const data = {
    fresh: firstRun,
    type: '',
    settings: {
      business_name: startName,
      business_phone: s.business_phone || '',
      business_address: s.business_address || '',
      business_email: s.business_email || '',
      currency: s.currency || '$',
      tax_rate: s.tax_rate || '0',
      open_min: Number(s.open_min || 540),
      close_min: Number(s.close_min || 1140),
      open_days: String(s.open_days || '1,2,3,4,5,6').split(',').map(Number).filter((d) => d >= 0 && d <= 6),
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
    // How clients book: by themselves online, or by talking to the owner first.
    booking: {
      mode: s.consult_mode === '1' ? 'consult' : 'online',
      channel: CHANNELS.some(([k]) => k === s.consult_channel) ? s.consult_channel : 'instagram',
      handle: s.consult_handle || '',
      note: s.consult_note || '',
    },
    logo: '', cover: '',
    appStore: '',   // the iPhone app's listing, once Apple has one (/api/app/config)
    services: [],   // {name, category, duration_min, price, price_type, on}
    // They are the first person who takes bookings, so they are already here.
    team: firstRun ? [{ name: ownerName, title: '' }] : [],
  };

  let idx = 0;
  let busy = false;
  const biz = () => String(data.settings.business_name || '').trim() || 'your business';
  const Biz = () => String(data.settings.business_name || '').trim() || 'Your business';
  const cur = () => data.settings.currency || '$';

  const overlay = document.createElement('div');
  overlay.className = 'wiz-overlay wz';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Set up your business');
  document.body.appendChild(overlay);

  api.get('/api/app/config').then((c) => {
    data.appStore = c.app_store_url || '';
    if (data.appStore && STEPS[idx] === 'install') paintStep(0);
  }).catch(() => { /* the home-screen steps stand */ });

  const readImage = (file, maxKb) => new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('Please choose an image file')); return; }
    if (file.size > maxKb * 1024) { reject(new Error(`Image must be under ${maxKb} KB`)); return; }
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Could not read that file'));
    r.readAsDataURL(file);
  });

  // ---- the steps --------------------------------------------------------------

  /** One line on each step saying why it matters, or where to change it later. */
  const tip = (text) => `<p class="wz-tip"><span aria-hidden="true">${icon('bulb', 15)}</span><span>${esc(text)}</span></p>`;

  /**
   * "You're ready": everything that is now true about their business, read
   * back from what they chose — then the optional extras, and where help is.
   * The point is that an owner closes setup knowing, not hoping.
   */
  function readiness() {
    const st = data.settings;
    const svcs = data.services.filter((x) => x.on && String(x.name || '').trim());
    const priced = svcs.filter((x) => x.price_type !== 'free' && Number(x.price) > 0).map((x) => Number(x.price));
    const team = data.team.filter((m) => String(m.name || '').trim());
    const consult = data.booking.mode === 'consult';
    const sends = [st.confirm_enabled && 'confirmations', st.reminders_enabled && `reminders ${st.reminder_hours} hours before`,
      st.receipts_enabled && 'receipts', st.review_requests_enabled && 'review requests'].filter(Boolean);
    const sendSay = sends.length ? `${sends.join(', ').replace(/^./, (c) => c.toUpperCase())} — sent by email, free` : 'Client emails are off — switch them on any time in Settings → Messages';
    const ready = [
      ['Your booking page is live', `${siteUrl}/book`],
      [`Open ${daysPhrase(st.open_days)}`, `${clock(st.open_min)} – ${clock(st.close_min)}`],
      consult
        ? ['Bookings by consultation', `Clients message you on ${channelName(data.booking.channel)}${data.booking.handle ? ` (${data.booking.handle})` : ''}; you send the booking link`]
        : [`${svcs.length} service${svcs.length === 1 ? '' : 's'} on your menu`, priced.length ? `From ${cur()}${Math.min(...priced)}` : 'Clients book themselves, any hour'],
      [team.length ? `${team.length === 1 ? team[0].name.split(/\s+/)[0] : `${team.length} people`} taking bookings` : 'Your calendar is ready', team.length > 1 ? team.map((m) => m.name.split(/\s+/)[0]).join(', ') : 'Add more people any time in Team'],
      ['Clients hear from you automatically', sendSay],
    ];
    const next = [
      ['Text reminders', 'Settings → Messages — a one-minute video shows every step'],
      [st.deposit_type !== 'none' && !consult ? 'Card payments (needed for your deposits)' : 'Card payments online', 'Settings → Payments'],
      ['The Kairo iPhone app', 'Next screen'],
    ];
    return `
      <div class="wz-ready">
        <div class="wz-ready-h">${firstName ? `${esc(firstName)}, here's` : "Here's"} what's ready</div>
        <ul class="wz-ready-list">${ready.map(([h, d]) => `<li><span class="wz-ok">${icon('check', 13)}</span><span><b>${esc(h)}</b><small>${esc(d)}</small></span></li>`).join('')}</ul>
        <div class="wz-ready-h small">When you're ready — optional</div>
        <ul class="wz-ready-list next">${next.map(([h, d]) => `<li><span class="wz-later"></span><span><b>${esc(h)}</b><small>${esc(d)}</small></span></li>`).join('')}</ul>
        <p class="wz-help">Questions? <a href="${esc(guideUrl())}" target="_blank" rel="noopener noreferrer">Read the Kairo guide</a>
          or email <a href="mailto:${esc(SUPPORT_EMAIL)}">${esc(SUPPORT_EMAIL)}</a> — a real person answers.</p>
      </div>`;
  }

  // Thirty seconds of what Kairo does and what is already switched on, the
  // first time somebody opens it. Muted and inline, so it plays by itself
  // without startling anybody; a still with a play button for anyone who has
  // asked their phone for less motion, or whose browser won't autoplay.
  let introSeen = false;
  const introVideo = () => `
      <div class="wz-intro ${firstRun && !introSeen && !still() ? 'autoplay' : ''}" id="wz-intro">
        <video poster="/videos/kairo-welcome.jpg" muted playsinline preload="metadata"
          aria-label="Welcome to Kairo — a 30-second video of what Kairo does and what is already switched on">
          <source src="/videos/kairo-welcome.mp4" type="video/mp4"><source src="/videos/kairo-welcome.webm" type="video/webm"></video>
        <button type="button" class="wz-intro-play" aria-label="Play the welcome video">${icon('play', 20)}</button>
        <span class="wz-intro-len">30 sec</span>
      </div>`;

  const views = {
    welcome: () => `
      ${introVideo()}
      <h1>${firstName ? `Hi ${esc(firstName)}` : 'Welcome to Kairo'}</h1>
      <p class="wiz-lede">${startName
        ? `Let's get <b>${esc(startName)}</b> ready to take bookings.`
        : "Let's get your business ready to take bookings."} About five minutes, and you'll watch
        your booking page come to life as you go.</p>
      <ol class="wz-map">
        ${[['tag', 'What you do', 'We draft your menu'], ['clock', 'When you open', 'Your hours and details'],
          ['palette', 'How it looks', 'Colours, logo, photo'], ['users', 'How you work', 'Your team, bookings and messages']]
          .map(([e, t, sub], i) => `<li style="--i:${i}"><span class="wz-map-e">${icon(e, 17)}</span><span><b>${t}</b><small>${sub}</small></span></li>`).join('')}
      </ol>
      ${firstRun && hasSamples ? `
        <div class="wiz-samples">
          <div class="wiz-samples-h">Kairo came with a sample salon — example clients, services and
            made-up history — so the screens are not empty while you look around.
            What would you like done with it?</div>
          <label class="wiz-sample-opt">
            <input type="radio" name="wiz_samples" value="clear" ${data.fresh ? 'checked' : ''}>
            <span><b>Clear it out — this is my real business</b>
              <span>You start with an empty diary and the services you pick next. Recommended.</span></span>
          </label>
          <label class="wiz-sample-opt">
            <input type="radio" name="wiz_samples" value="keep" ${data.fresh ? '' : 'checked'}>
            <span><b>Leave the examples for now</b>
              <span>Useful for having a look first. They stay clearly labelled
                <em>Sample</em>, are never messaged, and you can remove them any time from Clients.</span></span>
          </label>
        </div>` : ''}`,

    type: () => `
      <h2>What does ${esc(biz())} do?</h2>
      <p class="wiz-sub">Pick the closest one — we'll draft a menu for you to change however you like.</p>
      <div class="wiz-grid">
        ${Object.entries(STARTER).map(([k, v], i) => `
          <button type="button" class="wiz-tile ${data.type === k ? 'sel' : ''}" data-type="${k}" style="--i:${i}" aria-pressed="${data.type === k}">
            <span class="wiz-emoji">${icon(v.icon, 22)}</span><span>${esc(v.label)}</span>
          </button>`).join('')}
      </div>
      <p class="wz-chip" id="w-type-note" ${data.type ? '' : 'hidden'}>${data.type
        ? `${icon('check', 14)} Drafted ${STARTER[data.type].services.length} ${esc(STARTER[data.type].label.toLowerCase())} services for you` : ''}</p>`,

    details: () => `
      <h2>How do clients find you?</h2>
      <p class="wiz-sub">It goes on your booking page, confirmations and invoices.</p>
      <div class="wiz-form">
        <div class="field"><label>Business name *</label>
          <input id="w-name" value="${esc(data.settings.business_name)}" placeholder="e.g. Luxe Hair Studio" autocomplete="organization"></div>
        <div class="wiz-2col">
          <div class="field"><label>Phone</label><input id="w-phone" inputmode="tel" value="${esc(data.settings.business_phone)}" placeholder="0412 345 678"></div>
          <div class="field"><label>Email</label><input id="w-email" type="email" value="${esc(data.settings.business_email)}" placeholder="hello@yourbusiness.com"></div>
        </div>
        <div class="field"><label>Address</label><input id="w-address" value="${esc(data.settings.business_address)}" placeholder="12 Market Street, Fitzroy"></div>
        <div class="wiz-2col">
          <div class="field"><label>Currency symbol</label><input id="w-currency" maxlength="4" value="${esc(data.settings.currency)}"></div>
          <div class="field"><label>GST % on invoices</label><input id="w-tax" type="number" min="0" step="0.1" value="${esc(data.settings.tax_rate)}">
            <div class="hint" style="font-size:11.5px;color:var(--muted)">0 unless you're registered for GST.</div></div>
        </div>
      </div>
      ${tip('Your phone and address appear on your booking page and every confirmation, so clients can find you and call.')}`,

    hours: () => `
      <h2>When is ${esc(biz())} open?</h2>
      <p class="wiz-sub">Your calendar, and the times clients can book online.</p>
      <div class="wiz-form">
        <div class="field"><label>Days you're open</label>
          <div id="w-days" class="wz-days">
            ${DAY.map((d, i) => {
              const on = data.settings.open_days.includes(i);
              return `<button type="button" class="wz-day ${on ? 'on' : ''}" data-day="${i}" aria-pressed="${on}">${d}</button>`;
            }).join('')}
          </div></div>
        <div class="wiz-2col">
          <div class="field"><label>Opens</label><select id="w-open">${timeOpts(data.settings.open_min)}</select></div>
          <div class="field"><label>Closes</label><select id="w-close">${timeOpts(data.settings.close_min)}</select></div>
        </div>
        <p class="wz-chip" id="w-hours-say"></p>
        <div class="field"><label>Booking slots every</label>
          <select id="w-slot">${[10, 15, 20, 30, 60].map((v) => `<option value="${v}" ${String(data.settings.slot_interval) === String(v) ? 'selected' : ''}>${v} minutes</option>`).join('')}</select></div>
      </div>
      ${tip('Clients can only book inside these hours. Breaks, holidays and each person\'s own shifts can be set any time from Team.')}`,

    brand: () => `
      <h2>Make ${esc(biz())} look like you</h2>
      <p class="wiz-sub">Watch your booking page change as you pick.</p>
      <div class="wiz-form">
        <div class="field"><label>Your colour</label>
          <div class="wiz-swatches" id="w-swatches">
            ${SWATCHES.map((c) => `<button type="button" data-c="${c}" aria-label="Colour ${c}"
              class="${data.settings.brand_accent.toLowerCase() === c ? 'sel' : ''}" style="--c:${c}"></button>`).join('')}
            <label class="wz-own-colour" title="Any colour"><input type="color" id="w-accent" value="${esc(data.settings.brand_accent)}"></label>
          </div></div>
        <div class="wiz-2col">
          <div class="field"><label>Style</label>
            <div class="wz-seg" id="w-theme-seg">
              <button type="button" data-theme="dark" class="${data.settings.brand_theme === 'dark' ? 'on' : ''}">${icon('moon', 14)} Dark</button>
              <button type="button" data-theme="light" class="${data.settings.brand_theme === 'light' ? 'on' : ''}">${icon('sun', 14)} Light</button>
            </div><input type="hidden" id="w-theme" value="${esc(data.settings.brand_theme)}"></div>
          <div class="field"><label>Lettering</label>
            <select id="w-font"><option value="modern" ${data.settings.brand_font === 'modern' ? 'selected' : ''}>Modern</option><option value="classic" ${data.settings.brand_font === 'classic' ? 'selected' : ''}>Classic serif</option><option value="rounded" ${data.settings.brand_font === 'rounded' ? 'selected' : ''}>Rounded</option></select></div>
        </div>
        <div class="wiz-2col">
          <div class="field"><label>Logo</label>
            <div class="wiz-upl"><img id="w-logo-prev" alt="" ${data.logo ? `src="${data.logo}"` : 'style="display:none"'}>
              <button type="button" class="btn small" id="w-logo-btn">${icon('upload')} ${data.logo ? 'Change' : 'Upload'}</button>
              <input type="file" id="w-logo-file" accept="image/*" hidden></div></div>
          <div class="field"><label>Cover photo</label>
            <div class="wiz-upl"><img id="w-cover-prev" alt="" ${data.cover ? `src="${data.cover}"` : 'style="display:none"'}>
              <button type="button" class="btn small" id="w-cover-btn">${icon('upload')} ${data.cover ? 'Change' : 'Upload'}</button>
              <input type="file" id="w-cover-file" accept="image/*" hidden></div></div>
        </div>
        <div class="field"><label>A line to welcome clients</label>
          <input id="w-tagline" value="${esc(data.settings.brand_tagline)}" maxlength="120" placeholder="e.g. Colour, cuts & care in the heart of town"></div>
        <div class="wz-inline-preview" id="w-inline-preview"></div>
      </div>
      ${tip('A square logo and a wide photo of your space look best. Change them whenever you like in Settings → Online booking.')}`,

    services: () => {
      const on = data.services.filter((x) => x.on && String(x.name || '').trim());
      return `
      <h2>${esc(Biz())}'s menu</h2>
      <p class="wiz-sub">Untick what you don't do and set your own prices and times. Use <b>From</b> when the
        price depends on the client — you set the exact amount at checkout.</p>
      <p class="wz-chip" id="w-menu-say" ${on.length ? '' : 'hidden'}>${esc(menuSay())}</p>
      <div class="wiz-services" id="w-services">
        ${data.services.length ? data.services.map((sv, i) => `
          <div class="wiz-svc ${sv.on ? 'on' : ''}">
            <label class="wiz-svc-check"><input type="checkbox" data-svc-on="${i}" ${sv.on ? 'checked' : ''} aria-label="Offer ${esc(sv.name || 'this service')}"></label>
            <input class="wiz-svc-name" data-svc-name="${i}" value="${esc(sv.name)}" placeholder="Service name">
            <input class="wiz-svc-dur" type="number" min="5" step="5" data-svc-dur="${i}" value="${sv.duration_min}" aria-label="Minutes"><span class="wiz-u">min</span>
            <select class="wiz-svc-ptype" data-svc-ptype="${i}" aria-label="Price type">
              <option value="fixed" ${sv.price_type === 'fixed' ? 'selected' : ''}>Fixed</option>
              <option value="from" ${sv.price_type === 'from' ? 'selected' : ''}>From</option>
              <option value="free" ${sv.price_type === 'free' ? 'selected' : ''}>Free</option>
            </select>
            ${sv.price_type === 'free'
              ? '<span class="wiz-u" style="width:64px;text-align:right">—</span>'
              : `<span class="wiz-u">${esc(cur())}</span><input class="wiz-svc-price" type="number" min="0" step="1" data-svc-price="${i}" value="${sv.price}" aria-label="Price">`}
          </div>`).join('') : '<div class="wiz-empty">Pick what your business does (one step back) for a starter menu — or add your own below.</div>'}
      </div>
      <button type="button" class="btn small" id="w-add-svc">${icon('plus')} Add a service</button>
      ${tip('Set each time to cover the whole appointment, including any clean-up. Add more services, prices and photos later in Services.')}`;
    },

    team: () => `
      <h2>Who takes bookings?</h2>
      <p class="wiz-sub">Everyone here gets their own column in the calendar, and clients can pick them.${
        ownerName ? ' You\'re already on it.' : ' Add yourself at least.'}</p>
      <div id="w-team">
        ${data.team.map((m, i) => `
          <div class="wz-team-row">
            <span class="wz-avatar" style="--c:${['#3987e5', '#199e70', '#9085e9', '#e5a039', '#d55181', '#2dd4bf'][i % 6]}">${esc(initials(m.name))}</span>
            <input data-team-name="${i}" value="${esc(m.name)}" placeholder="Name" aria-label="Name">
            <input data-team-title="${i}" value="${esc(m.title)}" placeholder="Title (optional)" aria-label="Title">
            ${data.team.length > 1 ? `<button type="button" class="btn small ghost" data-team-rm="${i}" aria-label="Remove">${icon('x')}</button>` : ''}
          </div>`).join('')}
      </div>
      <button type="button" class="btn small" id="w-add-team">${icon('plus')} Add someone</button>
      ${tip('Each person gets their own column, their own hours, and clients can choose who they see. Add or change people any time in Team.')}`,

    booking: () => {
      const b = data.booking;
      const ch = CHANNELS.find(([k]) => k === b.channel) || CHANNELS[0];
      const offering = data.services.some((sv) => sv.on && isConsultService(sv));
      return `
      <h2>How do clients book ${esc(biz())}?</h2>
      <p class="wiz-sub">Pick the way you like to work. You can change it any time in Settings → Online booking.</p>
      <div class="wz-modes" role="radiogroup" aria-label="How clients book">
        <button type="button" class="wz-mode ${b.mode === 'online' ? 'sel' : ''}" data-mode="online" role="radio" aria-checked="${b.mode === 'online'}">
          <span class="wz-mode-e">${icon('calendar', 20)}</span>
          <span><b>They book themselves, online</b>
            <span>Clients pick a service, a time and who with, any hour, from your booking link. Every booking lands in your calendar and pings your phone.</span></span>
        </button>
        <button type="button" class="wz-mode ${b.mode === 'consult' ? 'sel' : ''}" data-mode="consult" role="radio" aria-checked="${b.mode === 'consult'}">
          <span class="wz-mode-e">${icon('send', 20)}</span>
          <span><b>A consultation first</b>
            <span>Clients message you before anything is booked. Once you've agreed what they need, you send them a booking link for that exact service and time.</span></span>
        </button>
      </div>
      <div id="w-mode-online" ${b.mode === 'online' ? '' : 'hidden'}>
        <label class="wiz-toggle"><input type="checkbox" id="w-offer-consult" ${offering ? 'checked' : ''}>
          <span><b>Also offer a free consultation</b><br><span class="wiz-muted">Adds a free 15-minute "Consultation" to your menu,
            so a new client can book a quick chat before committing — like any other appointment.</span></span></label>
      </div>
      <div id="w-mode-consult" class="wiz-form" ${b.mode === 'consult' ? '' : 'hidden'}>
        <div class="wiz-2col">
          <div class="field"><label>Where should clients message you?</label>
            <select id="w-cchan">${CHANNELS.map(([k, label]) => `<option value="${k}" ${b.channel === k ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
          <div class="field"><label>Your handle, number or link *</label>
            <input id="w-chandle" value="${esc(b.handle)}" placeholder="${esc(ch[2])}" autocomplete="off"></div>
        </div>
        <div class="field"><label>A line for your booking page (optional)</label>
          <textarea id="w-cnote" rows="2" maxlength="600" placeholder="We like a quick chat before every appointment so we can get everything right for you.">${esc(b.note)}</textarea></div>
        <div class="wiz-note">${icon('send', 14)} <span><b>How it works:</b> your booking page shows a <b>Message us</b> button instead of times.
          After your chat, open the <b>Calendar</b>, tap <b>Booking link</b>, choose the service and time you agreed, and send it.
          They confirm from their phone and it lands in your calendar.</span></div>
      </div>`;
    },

    comms: () => `
      <h2>Keep clients coming back</h2>
      <p class="wiz-sub">Kairo sends these for you, by email, from day one — free.</p>
      <div class="wiz-form">
        <label class="wiz-toggle"><input type="checkbox" id="w-confirm" ${data.settings.confirm_enabled ? 'checked' : ''}>
          <span><b>Booking confirmations</b><br><span class="wiz-muted">The moment someone books</span></span></label>
        <label class="wiz-toggle"><input type="checkbox" id="w-remind" ${data.settings.reminders_enabled ? 'checked' : ''}>
          <span><b>Appointment reminders</b><br><span class="wiz-muted">The best cure for no-shows</span></span></label>
        <div class="field"><label>Remind clients this long before</label>
          <select id="w-remind-hrs">${[2, 4, 12, 24, 48].map((h) => `<option value="${h}" ${String(data.settings.reminder_hours) === String(h) ? 'selected' : ''}>${h} hours</option>`).join('')}</select></div>
        <label class="wiz-toggle"><input type="checkbox" id="w-receipts" ${data.settings.receipts_enabled ? 'checked' : ''}>
          <span><b>Payment receipts</b><br><span class="wiz-muted">Whenever a payment or deposit is recorded</span></span></label>
        <label class="wiz-toggle"><input type="checkbox" id="w-reviews" ${data.settings.review_requests_enabled ? 'checked' : ''}>
          <span><b>Review requests</b><br><span class="wiz-muted">A quick "how was your visit?" after checkout</span></span></label>
        <div class="wiz-note">${icon('send', 14)} <span><b>Text reminders too?</b> Once you're in, go to
          <b>Settings → Messages → Set up text messages</b>. About five minutes, with a one-minute video that shows every step.</span></div>
        <label class="wiz-toggle" ${data.booking.mode === 'consult' ? 'hidden' : ''}><input type="checkbox" id="w-deposit" ${data.settings.deposit_type !== 'none' ? 'checked' : ''}>
          <span><b>Take a deposit on online bookings</b><br><span class="wiz-muted">The strongest no-show protection (needs card payments connected later)</span></span></label>
        <div class="wiz-2col" id="w-deposit-opts" style="${data.settings.deposit_type !== 'none' ? '' : 'display:none'}">
          <div class="field"><label>Deposit type</label>
            <select id="w-deposit-type"><option value="fixed" ${data.settings.deposit_type === 'fixed' ? 'selected' : ''}>Fixed amount</option><option value="percent" ${data.settings.deposit_type === 'percent' ? 'selected' : ''}>% of price</option></select></div>
          <div class="field"><label>Amount (${esc(cur())} or %)</label><input id="w-deposit-val" type="number" min="0" step="1" value="${esc(data.settings.deposit_value)}"></div>
        </div>
      </div>
      ${tip('Emails go out with your business name on them, and when a client replies it comes straight to your inbox.')}`,

    done: () => `
      <div class="wiz-hero wiz-done wz-pop">${icon('check', 34)}</div>
      <h1>${esc(Biz())} is open for bookings</h1>
      <p class="wiz-lede">Your booking page is live. Share it, and bookings land straight in your calendar.</p>
      <div class="wiz-linkbox">
        <span>${esc(siteUrl)}/book</span>
        <button type="button" class="btn small" id="w-copy">${icon('link')} Copy</button>
      </div>
      <div class="wz-done-actions">
        <a class="btn" href="${esc(siteUrl)}/book" target="_blank" rel="noopener noreferrer">${icon('external', 14)} See it as a client</a>
      </div>
      <p class="wiz-sub" style="text-align:center">Put it in your Instagram bio, Google profile and WhatsApp auto-reply.</p>
      ${readiness()}`,

    install: () => `
      <div class="wiz-hero">${icon('phone', 32)}</div>
      <h1>Put Kairo on your phone</h1>
      <p class="wiz-lede">So you hear the moment somebody books, wherever you are.</p>
      <div class="wiz-install">
        <div class="wi-col">
          ${inApp() ? `
          <div class="wi-head">${icon('phone', 15)} iPhone</div>
          <ol><li>You're in the Kairo app already — nothing to do</li></ol>` : data.appStore ? `
          <div class="wi-head">${icon('phone', 15)} iPhone</div>
          <ol>
            <li><a class="btn primary small" href="${esc(data.appStore)}" target="_blank" rel="noopener noreferrer">Get Kairo on the App Store</a></li>
            <li>Open it and sign in with the email and password you use here</li>
            <li>Allow notifications<span>That's how you hear the moment somebody books</span></li>
          </ol>` : `
          <div class="wi-head">${icon('phone', 15)} iPhone &amp; iPad</div>
          <ol>
            <li>Open <b>${esc(siteUrl)}</b> in <b>Safari</b><span>It has to be Safari — Chrome on iPhone can't do this</span></li>
            <li>Tap the <b>Share</b> button${icon('share', 13)}<span>The square with an arrow, at the bottom</span></li>
            <li>Scroll down and tap <b>Add to Home Screen</b></li>
            <li>Tap <b>Add</b> — done</li>
          </ol>`}
        </div>
        <div class="wi-col">
          <div class="wi-head">${icon('grid', 15)} Android</div>
          <ol>
            <li>Open <b>${esc(siteUrl)}</b> in <b>Chrome</b></li>
            <li>Tap the <b>⋮</b> menu, top right</li>
            <li>Tap <b>Install app</b> or <b>Add to Home screen</b></li>
            <li>Tap <b>Install</b> — done</li>
          </ol>
        </div>
      </div>
      <p class="wiz-sub">You can do this later from <b>Settings</b> if you're on a computer right now.</p>`,
  };

  /** "6 services · from $30" — the menu, summed up as it is edited. */
  function menuSay() {
    const on = data.services.filter((x) => x.on && String(x.name || '').trim());
    const priced = on.filter((x) => x.price_type !== 'free' && Number(x.price) > 0).map((x) => Number(x.price));
    return `${on.length} service${on.length === 1 ? '' : 's'}${priced.length ? ` · from ${cur()}${Math.min(...priced)}` : ''}`;
  }

  // ---- the live booking page ------------------------------------------------

  function previewHtml() {
    const st = data.settings;
    const light = st.brand_theme === 'light';
    const fam = st.brand_font === 'classic' ? 'Georgia, serif' : st.brand_font === 'rounded' ? "'Trebuchet MS', 'Arial Rounded MT Bold', sans-serif" : 'system-ui, sans-serif';
    const svcs = data.services.filter((x) => x.on && String(x.name || '').trim()).slice(0, 4);
    const team = data.team.filter((m) => String(m.name || '').trim()).slice(0, 5);
    const price = (x) => (x.price_type === 'free' ? 'Free' : `${x.price_type === 'from' ? 'from ' : ''}${esc(cur())}${Number(x.price) || 0}`);
    return `
      <div class="wz-pp ${light ? 'light' : ''}" style="--a:${esc(st.brand_accent)};font-family:${fam}">
        <div class="wz-pp-cover" ${data.cover ? `style="background-image:url('${data.cover}')"` : ''}></div>
        <div class="wz-pp-id">
          <span class="wz-pp-logo">${data.logo ? `<img src="${data.logo}" alt="">` : esc(initials(st.business_name || 'K'))}</span>
          <div class="wz-pp-name">${esc(st.business_name || 'Your business')}</div>
          <div class="wz-pp-tag">${esc(st.brand_tagline || 'Book an appointment online')}</div>
          <div class="wz-pp-hours">${esc(daysPhrase(st.open_days))} · ${esc(clock(st.open_min))}–${esc(clock(st.close_min))}</div>
        </div>
        ${data.booking.mode === 'consult' ? `
        <div class="wz-pp-consult">
          <b>Book with a quick chat first</b>
          <p>${esc(data.booking.note || 'We like a quick chat before every appointment so we can get everything right for you.')}</p>
        </div>
        <div class="wz-pp-btn">Message us on ${esc(channelName(data.booking.channel))}</div>` : `
        <div class="wz-pp-list">
          ${svcs.length ? svcs.map((x) => `<div class="wz-pp-svc"><span>${esc(x.name)}<small>${Number(x.duration_min) || 0} min</small></span><b>${price(x)}</b></div>`).join('')
            : '<div class="wz-pp-ghost"></div><div class="wz-pp-ghost"></div><div class="wz-pp-ghost short"></div>'}
        </div>
        ${team.length ? `<div class="wz-pp-team">${team.map((m) => `<span title="${esc(m.name)}">${esc(initials(m.name))}</span>`).join('')}</div>` : ''}
        <div class="wz-pp-btn">Book now</div>`}
      </div>`;
  }

  // Redrawn only when it would look different, so typing a price does not make
  // the whole page flicker under the owner's eyes.
  const drawn = new WeakMap(); // kept off the DOM: a photo makes this string large
  function paintPreview() {
    const html = previewHtml();
    for (const el of [overlay.querySelector('#wz-phone-screen'), overlay.querySelector('#w-inline-preview')]) {
      if (el && drawn.get(el) !== html) { el.innerHTML = html; drawn.set(el, html); }
    }
  }

  // ---- reading the current step back into `data` ----------------------------

  function capture() {
    const id = STEPS[idx];
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
      const days = [...overlay.querySelectorAll('#w-days [data-day]')]
        .filter((b) => b.getAttribute('aria-pressed') === 'true')
        .map((b) => Number(b.dataset.day));
      data.settings.open_days = days;
    } else if (id === 'brand') {
      data.settings.brand_theme = val('#w-theme');
      data.settings.brand_font = val('#w-font');
      data.settings.brand_accent = val('#w-accent');
      data.settings.brand_tagline = val('#w-tagline');
    } else if (id === 'booking') {
      if (overlay.querySelector('#w-cchan')) {
        data.booking.channel = val('#w-cchan');
        data.booking.handle = String(val('#w-chandle') || '').trim();
        data.booking.note = String(val('#w-cnote') || '').trim();
      }
    } else if (id === 'comms') {
      data.settings.confirm_enabled = overlay.querySelector('#w-confirm').checked;
      data.settings.reminders_enabled = overlay.querySelector('#w-remind').checked;
      data.settings.reminder_hours = val('#w-remind-hrs');
      data.settings.receipts_enabled = overlay.querySelector('#w-receipts').checked;
      data.settings.review_requests_enabled = overlay.querySelector('#w-reviews').checked;
      data.settings.deposit_type = overlay.querySelector('#w-deposit').checked && data.booking.mode !== 'consult' ? val('#w-deposit-type') : 'none';
      data.settings.deposit_value = val('#w-deposit-val') || '20';
    }
    // services & team capture live via their own input handlers
  }

  // ---- the frame: journey bar, stage, phone ----------------------------------

  overlay.innerHTML = `
    <div class="wz-shell">
      <nav class="wz-track" aria-label="Your setup journey">
        <div class="wz-track-line"><div class="wz-track-fill" id="wz-fill"></div></div>
        <ol>${MILESTONES.map(([id, label]) => `<li data-m="${id}"><span class="wz-dot"></span><span class="wz-ml">${label}</span></li>`).join('')}</ol>
        <div class="wz-track-mobile" id="wz-track-mobile" aria-live="polite"></div>
      </nav>
      <div class="wz-main">
        <section class="wiz-card wz-card">
          <div class="wz-viewport"><div class="wiz-body" id="wz-body"></div></div>
          <div class="wiz-foot" id="wz-foot"></div>
        </section>
        <aside class="wz-phone" aria-label="Your booking page, as clients will see it">
          <div class="wz-phone-label">${icon('eye', 13)} Your booking page, live</div>
          <div class="wz-phone-frame"><div class="wz-phone-notch"></div><div class="wz-phone-screen" id="wz-phone-screen"></div></div>
        </aside>
      </div>
    </div>`;

  function paintTrack() {
    const id = STEPS[idx];
    const at = Math.max(0, MILESTONES.findIndex(([m]) => m === (id === 'install' ? 'done' : id)));
    overlay.querySelectorAll('.wz-track li').forEach((li, i) => {
      li.classList.toggle('done', i < at || (id === 'install'));
      li.classList.toggle('now', i === at && id !== 'install');
      li.setAttribute('aria-current', i === at ? 'step' : 'false');
    });
    overlay.querySelector('#wz-fill').style.width = `${(at / (MILESTONES.length - 1)) * 100}%`;
    overlay.querySelector('#wz-track-mobile').textContent = id === 'install' || id === 'done'
      ? 'Open for bookings' : `Step ${at + 1} of ${MILESTONES.length - 1} · ${MILESTONES[at][1]}`;
    // The phone joins once there is something of theirs to show, and leaves for
    // the celebration, which has the stage to itself.
    overlay.querySelector('.wz-main').classList.toggle('with-phone', !['welcome', 'done', 'install', 'building'].includes(id));
  }

  function footHtml(id) {
    const isLast = id === 'install';
    const canSkip = firstRun && idx === 0;
    const finishing = idx === STEPS.length - 3; // the step before 'done'
    if (id === 'done') {
      return `<span></span><div class="wiz-foot-right">
        <button type="button" class="btn primary" id="w-next">Nearly done ${icon('chevR')}</button></div>`;
    }
    return `
      ${idx > 0 && !isLast ? `<button type="button" class="btn ghost" id="w-back">${icon('chevL', 14)} Back</button>` : '<span></span>'}
      <div class="wiz-foot-right">
        ${canSkip ? '<button type="button" class="btn ghost" id="w-skip">Skip for now</button>' : ''}
        ${isLast
          ? `<button type="button" class="btn ghost" id="w-skip-tour">Skip the tour</button>
             <button type="button" class="btn primary" id="w-finish">${icon('zap')} Show me around</button>`
          : `<button type="button" class="btn primary" id="w-next">${idx === 0 ? "Let's go" : finishing ? `Open ${esc(biz())}` : 'Continue'} ${icon('chevR')}</button>`}
      </div>`;
  }

  function wireIntro() {
    const box = overlay.querySelector('#wz-intro');
    const v = box?.querySelector('video');
    if (!v) return;
    const play = () => {
      box.classList.add('playing');
      v.play().then(() => { introSeen = true; }).catch(() => box.classList.remove('playing'));
    };
    box.querySelector('.wz-intro-play').addEventListener('click', () => { v.currentTime = 0; play(); });
    v.addEventListener('click', () => { if (!v.paused) v.pause(); else play(); });
    v.addEventListener('pause', () => box.classList.remove('playing'));
    v.addEventListener('ended', () => { box.classList.remove('playing'); box.classList.add('ended'); });
    if (box.classList.contains('autoplay')) play();
  }

  /** Swap the stage to the current step, sliding in the direction of travel. */
  function paintStep(direction = 1) {
    const id = STEPS[idx];
    const body = overlay.querySelector('#wz-body');
    const html = views[id]();
    const done = () => {
      body.innerHTML = html;
      overlay.querySelector('#wz-foot').innerHTML = footHtml(id);
      paintTrack();
      paintPreview();
      wire(id);
      focusFirst();
    };
    if (still() || !direction || !body.firstChild || typeof body.animate !== 'function') { done(); return; }
    const out = body.animate([{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(${-28 * direction}px)` }],
      { duration: 150, easing: 'cubic-bezier(.4,0,1,1)' });
    out.onfinish = () => {
      done();
      body.animate([{ opacity: 0, transform: `translateX(${28 * direction}px)` }, { opacity: 1, transform: 'translateX(0)' }],
        { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
      overlay.querySelector('.wz-viewport').scrollTop = 0;
    };
  }

  function focusFirst() {
    // On a phone the keyboard leaping up on every step is worse than tapping
    // a field, so only on a pointer that hovers.
    if (!matchMedia('(hover: hover)').matches) return;
    const el = overlay.querySelector('#wz-body input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=file]), #wz-body select');
    el?.focus({ preventScroll: true });
  }

  function go(delta) {
    if (busy) return;
    capture();
    idx = Math.min(STEPS.length - 1, Math.max(0, idx + delta));
    paintStep(delta);
  }

  // ---- wiring --------------------------------------------------------------

  function wire(id) {
    if (id === 'welcome') wireIntro();
    overlay.querySelectorAll('input[name="wiz_samples"]').forEach((r) => {
      r.addEventListener('change', () => { data.fresh = r.value === 'clear'; });
    });
    overlay.querySelector('#w-back')?.addEventListener('click', () => go(-1));
    overlay.querySelector('#w-skip')?.addEventListener('click', async () => {
      // Skipping still honours the choice they just made. Somebody who said
      // "leave the examples" and then skipped meant both things.
      await api.post('/api/setup/skip', { keep_samples: !data.fresh });
      close(); onDone?.();
    });
    overlay.querySelector('#w-next')?.addEventListener('click', onNext);
    // Two ways out of the last step: take the walkthrough, or go straight in.
    // Both finish setup identically — the tour is an offer, never a gate.
    overlay.querySelector('#w-finish')?.addEventListener('click', () => { close(); onDone?.({ tour: true }); });
    overlay.querySelector('#w-skip-tour')?.addEventListener('click', () => { close(); onDone?.({ tour: false }); });
    overlay.querySelector('#w-copy')?.addEventListener('click', () => {
      copyText(`${siteUrl}/book`).then((ok) => {
        toast(ok ? 'Booking link copied' : 'Could not copy — open Settings to copy it there', ok ? 'ok' : 'err');
      });
    });

    if (id === 'type') {
      overlay.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => {
        const first = !data.type;
        data.type = b.dataset.type;
        data.services = STARTER[data.type].services.map(([name, category, duration_min, price, price_type]) =>
          ({ name, category, duration_min, price, price_type: price_type || 'fixed', on: true }));
        overlay.querySelectorAll('[data-type]').forEach((x) => {
          x.classList.toggle('sel', x === b); x.setAttribute('aria-pressed', String(x === b));
        });
        const note = overlay.querySelector('#w-type-note');
        note.hidden = false;
        note.innerHTML = `${icon('check', 14)} Drafted ${data.services.length} ${esc(STARTER[data.type].label.toLowerCase())} services for you`;
        paintPreview();
        // The first choice carries them on; a change of mind stays put.
        if (first) setTimeout(() => { if (STEPS[idx] === 'type') go(1); }, still() ? 0 : 650);
      }));
    }

    if (id === 'details') {
      overlay.querySelector('#wz-body').addEventListener('input', () => { capture(); paintPreview(); });
    }

    if (id === 'hours') {
      const say = () => {
        capture();
        const st = data.settings;
        overlay.querySelector('#w-hours-say').textContent = st.open_days.length
          ? `Open ${daysPhrase(st.open_days)}, ${clock(st.open_min)} – ${clock(st.close_min)}`
          : 'Pick at least one day you open';
        paintPreview();
      };
      overlay.querySelector('#w-days').addEventListener('click', (e) => {
        const b = e.target.closest('[data-day]');
        if (!b) return;
        const on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', String(on));
        b.classList.toggle('on', on);
        say();
      });
      ['#w-open', '#w-close', '#w-slot'].forEach((sel) => overlay.querySelector(sel).addEventListener('change', say));
      say();
    }

    if (id === 'brand') {
      const repaint = () => { capture(); paintPreview(); };
      overlay.querySelectorAll('#w-swatches [data-c]').forEach((b) => b.addEventListener('click', () => {
        overlay.querySelector('#w-accent').value = b.dataset.c;
        overlay.querySelectorAll('#w-swatches [data-c]').forEach((x) => x.classList.toggle('sel', x === b));
        repaint();
      }));
      overlay.querySelector('#w-accent').addEventListener('input', () => {
        overlay.querySelectorAll('#w-swatches [data-c]').forEach((x) => x.classList.remove('sel'));
        repaint();
      });
      overlay.querySelectorAll('#w-theme-seg [data-theme]').forEach((b) => b.addEventListener('click', () => {
        overlay.querySelector('#w-theme').value = b.dataset.theme;
        overlay.querySelectorAll('#w-theme-seg [data-theme]').forEach((x) => x.classList.toggle('on', x === b));
        repaint();
      }));
      ['#w-font', '#w-tagline'].forEach((sel) => overlay.querySelector(sel).addEventListener('input', repaint));
      const upload = (btn, file, prev, key, maxKb) => {
        overlay.querySelector(btn).addEventListener('click', () => overlay.querySelector(file).click());
        overlay.querySelector(file).addEventListener('change', async (e) => {
          if (!e.target.files[0]) return;
          try {
            data[key] = await readImage(e.target.files[0], maxKb);
            const img = overlay.querySelector(prev); img.src = data[key]; img.style.display = '';
            paintPreview();
          } catch (err) { toast(err.message, 'err'); }
        });
      };
      upload('#w-logo-btn', '#w-logo-file', '#w-logo-prev', 'logo', 250);
      upload('#w-cover-btn', '#w-cover-file', '#w-cover-prev', 'cover', 600);
    }

    if (id === 'services') {
      overlay.querySelector('#w-services')?.addEventListener('input', (e) => {
        const t = e.target;
        if (t.dataset.svcOn != null) { data.services[t.dataset.svcOn].on = t.checked; t.closest('.wiz-svc').classList.toggle('on', t.checked); }
        else if (t.dataset.svcName != null) data.services[t.dataset.svcName].name = t.value;
        else if (t.dataset.svcDur != null) data.services[t.dataset.svcDur].duration_min = Number(t.value);
        else if (t.dataset.svcPrice != null) data.services[t.dataset.svcPrice].price = Number(t.value);
        else if (t.dataset.svcPtype != null) { data.services[t.dataset.svcPtype].price_type = t.value; paintStep(0); return; }
        const say = overlay.querySelector('#w-menu-say');
        if (say) { say.textContent = menuSay(); say.hidden = !data.services.some((x) => x.on && String(x.name || '').trim()); }
        paintPreview();
      });
      overlay.querySelector('#w-add-svc')?.addEventListener('click', () => {
        data.services.push({ name: '', category: 'General', duration_min: 45, price: 0, price_type: 'fixed', on: true });
        paintStep(0);
        const names = overlay.querySelectorAll('[data-svc-name]');
        names[names.length - 1]?.focus();
      });
    }

    if (id === 'team') {
      overlay.querySelector('#w-team')?.addEventListener('input', (e) => {
        const t = e.target;
        if (t.dataset.teamName != null) {
          data.team[t.dataset.teamName].name = t.value;
          const av = t.closest('.wz-team-row')?.querySelector('.wz-avatar');
          if (av) av.textContent = initials(t.value);
        } else if (t.dataset.teamTitle != null) data.team[t.dataset.teamTitle].title = t.value;
        paintPreview();
      });
      overlay.querySelectorAll('[data-team-rm]').forEach((b) => b.addEventListener('click', () => {
        data.team.splice(Number(b.dataset.teamRm), 1); paintStep(0);
      }));
      overlay.querySelector('#w-add-team')?.addEventListener('click', () => {
        data.team.push({ name: '', title: '' }); paintStep(0);
        const names = overlay.querySelectorAll('[data-team-name]');
        names[names.length - 1]?.focus();
      });
    }

    if (id === 'booking') {
      overlay.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
        capture();
        data.booking.mode = b.dataset.mode;
        overlay.querySelectorAll('[data-mode]').forEach((x) => {
          x.classList.toggle('sel', x === b); x.setAttribute('aria-checked', String(x === b));
        });
        overlay.querySelector('#w-mode-online').hidden = data.booking.mode !== 'online';
        overlay.querySelector('#w-mode-consult').hidden = data.booking.mode !== 'consult';
        if (data.booking.mode === 'consult') overlay.querySelector('#w-chandle')?.focus({ preventScroll: true });
        paintPreview();
      }));
      overlay.querySelector('#w-offer-consult')?.addEventListener('change', (e) => {
        const existing = data.services.find(isConsultService);
        if (existing) existing.on = e.target.checked;
        else if (e.target.checked) data.services.push({ name: 'Consultation', category: 'General', duration_min: 15, price: 0, price_type: 'free', on: true });
        paintPreview();
      });
      overlay.querySelector('#w-cchan')?.addEventListener('change', (e) => {
        const ch = CHANNELS.find(([k]) => k === e.target.value);
        overlay.querySelector('#w-chandle').placeholder = ch ? ch[2] : '';
        capture(); paintPreview();
      });
      overlay.querySelector('#w-mode-consult')?.addEventListener('input', () => { capture(); paintPreview(); });
    }

    if (id === 'comms') {
      overlay.querySelector('#w-deposit')?.addEventListener('change', (e) => {
        overlay.querySelector('#w-deposit-opts').style.display = e.target.checked ? '' : 'none';
      });
    }

  }

  // Enter moves on, the way a form would — but never from a list being edited,
  // a button that has its own job, or while setup is being applied.
  overlay.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey || busy) return;
    const t = e.target;
    if (t.closest('#w-services, #w-team') || t.tagName === 'BUTTON' || t.tagName === 'TEXTAREA' || t.tagName === 'A') return;
    const next = overlay.querySelector('#w-next');
    if (next) { e.preventDefault(); next.click(); }
  });

  async function onNext() {
    capture();
    const id = STEPS[idx];
    if (id === 'details' && !String(data.settings.business_name || '').trim()) {
      toast('Please enter your business name', 'err');
      overlay.querySelector('#w-name')?.focus();
      return;
    }
    if (id === 'hours' && !data.settings.open_days.length) {
      toast('Pick at least one day you open', 'err');
      return;
    }
    if (id === 'booking' && data.booking.mode === 'consult' && !data.booking.handle) {
      toast(`Add your ${channelName(data.booking.channel)} so clients know where to message you`, 'err');
      overlay.querySelector('#w-chandle')?.focus();
      return;
    }
    if (id === 'done') { go(1); return; }
    if (idx === STEPS.length - 3) { await apply(); return; } // the step before 'done'
    go(1);
  }

  // ---- building it ---------------------------------------------------------

  async function apply() {
    busy = true;
    const svcs = data.services.filter((sv) => sv.on && String(sv.name || '').trim());
    const team = data.team.filter((m) => String(m.name || '').trim());
    const payload = {
      fresh: data.fresh,
      settings: {
        ...data.settings,
        open_days: data.settings.open_days.join(','),
        confirm_enabled: data.settings.confirm_enabled ? '1' : '0',
        reminders_enabled: data.settings.reminders_enabled ? '1' : '0',
        receipts_enabled: data.settings.receipts_enabled ? '1' : '0',
        review_requests_enabled: data.settings.review_requests_enabled ? '1' : '0',
        sms_notifications_enabled: data.settings.sms_notifications_enabled ? '1' : '0',
        consult_mode: data.booking.mode === 'consult' ? '1' : '0',
        consult_channel: data.booking.channel,
        consult_handle: data.booking.handle,
        consult_note: data.booking.note,
        brand_logo: data.logo || '',
        brand_cover: data.cover || '',
        // The URL used to administer the app right now IS the URL customers
        // should use for booking/review links — captured automatically. Ignored
        // by the server when the address is pinned by the environment.
        public_url: siteUrl,
        // The owner's own time zone drives the booking page's "no past times"
        // filter — captured automatically from their browser.
        business_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      },
      team,
      services: svcs.map((sv) => ({ name: sv.name, category: sv.category || 'General', duration_min: sv.duration_min, price: sv.price, price_type: sv.price_type || 'fixed' })),
    };

    // What is being built, said as it happens. The list is real — it is what
    // the payload contains — and the server call runs alongside it.
    const lines = [
      `Setting your hours · ${daysPhrase(data.settings.open_days)}`,
      `Adding ${svcs.length || 'your'} service${svcs.length === 1 ? '' : 's'} to the menu`,
      team.length ? `Making ${team.length === 1 ? `${team[0].name.split(/\s+/)[0]}'s calendar` : `${team.length} calendars`}` : 'Making your calendar',
      'Painting your booking page in your colours',
      data.booking.mode === 'consult' ? `Pointing new clients to your ${channelName(data.booking.channel)}` : 'Opening your diary to online bookings',
      data.settings.reminders_enabled ? 'Switching on reminders' : 'Setting up your messages',
    ];
    const body = overlay.querySelector('#wz-body');
    overlay.querySelector('#wz-foot').innerHTML = '';
    overlay.querySelector('.wz-main').classList.remove('with-phone');
    body.innerHTML = `
      <div class="wz-build">
        <div class="wz-build-orb" style="--a:${esc(data.settings.brand_accent)}"></div>
        <h2>Building ${esc(biz())}…</h2>
        <ul class="wz-build-list">${lines.map((l) => `<li><span class="wz-tick"></span>${esc(l)}</li>`).join('')}</ul>
      </div>`;
    const items = [...body.querySelectorAll('.wz-build-list li')];
    const step = still() ? 0 : 380;
    const ticking = (async () => {
      for (const li of items) { await wait(step); li.classList.add('done'); }
      await wait(step ? 300 : 0);
    })();
    try {
      await Promise.all([api.post('/api/setup/apply', payload), ticking]);
      busy = false;
      idx++; // -> done
      paintStep(0);
    } catch (err) {
      busy = false;
      toast(err.message || 'Setup failed — please try again', 'err');
      paintStep(0); // back to the messages step, with everything they chose still there
    }
  }

  function close() { overlay.remove(); }

  paintStep(0);
}
