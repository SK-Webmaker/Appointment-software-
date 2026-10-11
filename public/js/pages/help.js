// Help: the way to the guide, to Kai, and to a person.
//
// An owner stuck on something wants one of three things — to read how it
// works, to ask, or to talk to somebody. This page offers all three in that
// order, with the guide split into the topics an owner would look under.
import { esc, icon } from '../ui.js';
import { state } from '../app.js';
import { guideUrl, SUPPORT_EMAIL } from '../help.js';
import { videoCard, wireVideos } from '../video.js';

const TOPICS = [
  ['getting-started', 'Getting started', 'Signing in, the setup journey and the checklist', 'zap'],
  ['calendar', 'Your calendar', 'Booking, moving and cancelling appointments, blocking time', 'calendar'],
  ['booking-page', 'Your booking page', 'Your link, what clients see, deposits and the waitlist', 'globe'],
  ['consultations', 'Consultations', 'Talking to clients first, then sending a booking link', 'send'],
  ['clients', 'Clients', 'Records, notes, importing a client list, patch tests', 'users'],
  ['services', 'Services & products', 'Your menu, prices, stock', 'tag'],
  ['team', 'Your team', 'People, hours, days off and locations', 'user'],
  ['point-of-sale', 'Getting paid', 'Checkout, card payments, invoices and receipts', 'card'],
  ['messages', 'Messages to clients', 'Confirmations, reminders and text messages', 'mail'],
  ['kai', 'Kai, your assistant', 'Asking Kai, talking to Kai, what it can change', 'zap'],
  ['iphone-app', 'The iPhone app', 'Installing it and booking notifications', 'phone'],
  ['account', 'Your account', 'Password, backups, refunds and closing', 'lock'],
];

export async function renderHelp(container) {
  const biz = state.settings?.business_name || '';
  const subject = encodeURIComponent(`Help with Kairo${biz ? ` — ${biz}` : ''}`);
  container.innerHTML = `
    <div class="page-head">
      <div class="ph-icon">${icon('help', 20)}</div>
      <div><h1>Help</h1><div class="ph-sub">Step-by-step guides, Kai, and a real person when you need one</div></div>
    </div>

    <div class="help-hero card">
      <div>
        <div class="help-hero-t">The Kairo guide</div>
        <div class="help-hero-s">How to do everything in Kairo, step by step — from your first booking to your last refund.</div>
      </div>
      <a class="btn primary" href="${esc(guideUrl())}" target="_blank" rel="noopener noreferrer">${icon('external', 14)} Open the guide</a>
    </div>

    <div class="help-watch">
      ${videoCard('welcome', { id: 'help-v-welcome', sub: 'What Kairo does for you, and what is already switched on.' })}
      ${videoCard('sms', { id: 'help-v-sms', sub: 'Turn on text reminders with ClickSend, on the real pages.' })}
      <div class="ss-video help-tour">
        <span class="help-tour-ic">${icon('grid', 20)}</span>
        <div class="ss-video-text">
          <b>Take the tour again</b>
          <span>A quick lap of every part of Kairo, pointing at the real thing.</span>
          <button type="button" class="btn" id="help-tour">${icon('chevR', 14)} Start the tour</button>
        </div>
      </div>
    </div>

    <div class="help-grid">
      ${TOPICS.map(([id, title, sub, ic]) => `
        <a class="help-topic" href="${esc(guideUrl(id))}" target="_blank" rel="noopener noreferrer">
          <span class="help-ic">${icon(ic, 17)}</span>
          <span class="help-tx"><b>${esc(title)}</b><small>${esc(sub)}</small></span>
          <span class="help-go">${icon('chevR', 14)}</span>
        </a>`).join('')}
    </div>

    <div class="help-two">
      <div class="card help-card">
        <div class="card-title">${icon('zap', 15)} Ask Kai</div>
        <div class="card-sub">Kai knows your business. Ask “how do I take a deposit?”, or just say what you want done —
          “move Jane's 3 o'clock to Friday”, “show me next Tuesday”.</div>
        <button type="button" class="btn" id="help-kai">${icon('zap', 14)} Ask Kai</button>
      </div>
      <div class="card help-card">
        <div class="card-title">${icon('mail', 15)} Talk to a person</div>
        <div class="card-sub">Email us and someone at Kairo replies — Monday to Friday, 9am to 5pm Melbourne time,
          usually the same day. A screenshot helps. Put <b>urgent</b> in the subject if your booking page is down.</div>
        <a class="btn" href="mailto:${esc(SUPPORT_EMAIL)}?subject=${subject}">${icon('mail', 14)} ${esc(SUPPORT_EMAIL)}</a>
      </div>
    </div>

    <div class="card help-card help-small">
      <div class="card-title">Start over with setup</div>
      <div class="card-sub">Walk through the setup journey again to change your hours, look, menu or how clients book.
        Nothing is lost — it starts from what you have now.</div>
      <a class="btn" href="#/settings?open=account">${icon('settings', 14)} Settings → Account &amp; data</a>
    </div>
    <div class="help-foot">Kairo v${esc(state.version || '')}</div>`;

  wireVideos(container);
  container.querySelector('#help-tour').addEventListener('click', async () => {
    const { runTour } = await import('../tour.js');
    location.hash = '#/dashboard';
    setTimeout(() => runTour({ force: true }), 600);
  });
  container.querySelector('#help-kai').addEventListener('click', async () => {
    const { open } = await import('../kai.js');
    open();
  });
}
