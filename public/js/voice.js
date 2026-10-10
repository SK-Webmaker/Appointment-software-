// Listening to the owner, carefully.
//
// The browser's own speech recognition, with the rough edges an owner actually
// hits taken off:
//
//   - It waits for them to finish. Out of the box it stops at the first pause,
//     so "move Jane's three o'clock… to Friday" arrived as "move Jane's three
//     o'clock". Here it listens continuously and ends after a short silence.
//   - It picks the hearing that makes sense. The recogniser offers a few
//     alternatives; the one that names something in Kairo — a page, a day, a
//     thing an owner does — is preferred over a near-homophone that names
//     nothing ("calendar" over "colander").
//   - It recovers from the recogniser quitting before anyone spoke, which some
//     browsers do on the first press, by starting again once.
//   - It says what went wrong in words: no microphone, permission refused, no
//     connection — rather than a mic button that silently does nothing.
//
// Not inside the iPhone app: its web view would need microphone and speech
// permissions the app does not ask for, and the iPhone keyboard's own dictation
// button does this job there.
const SR = typeof window !== 'undefined' && !window.kairoNative
  && (window.SpeechRecognition || window.webkitSpeechRecognition);

export const canListen = () => Boolean(SR);

// Words that mean something in Kairo. A hearing containing more of them wins.
const VOCAB = new Set(`
  calendar diary schedule today tomorrow yesterday week monday tuesday wednesday thursday friday saturday sunday
  next last morning afternoon evening am pm o'clock clock dashboard home clients client customers services menu
  products stock billing invoices invoice payments paid owing messages texts sms emails reviews growth team staff
  settings account hours logo booking bookings book rebook appointment appointments cancel move reschedule
  block note notes price prices deposit refund waitlist open show go take me back point sale till
`.split(/\s+/).filter(Boolean));

const score = (t) => String(t).toLowerCase().split(/[^a-z']+/).filter((w) => VOCAB.has(w)).length;

/** Of the recogniser's alternatives for one phrase, the one that names the most Kairo things. */
function bestOf(result) {
  let best = result[0]?.transcript || '';
  let top = score(best);
  for (let i = 1; i < result.length; i++) {
    const t = result[i]?.transcript || '';
    const s = score(t);
    if (s > top) { best = t; top = s; }
  }
  return best;
}

const SAY = {
  'no-speech': "I didn't hear anything — tap the mic and try again.",
  'audio-capture': 'No microphone found. Plug one in, or type instead.',
  'not-allowed': 'The microphone is blocked for Kairo. Allow it in your browser, then try again.',
  'service-not-allowed': 'The microphone is blocked for Kairo. Allow it in your browser, then try again.',
  network: 'Speech needs an internet connection. Check it, or type instead.',
  'language-not-supported': "Your browser can't listen in this language. Type instead.",
};

/**
 * Listen for one request. Calls `onInterim(text)` as words arrive and
 * `onFinal(text)` once, when they stop talking (or `onError(message)`).
 * Returns `stop()`, which ends listening and delivers what was heard so far.
 */
export function listen({ onInterim = () => {}, onFinal = () => {}, onError = () => {}, silenceMs = 1600, maxMs = 25000 } = {}) {
  if (!SR) { onError('Your browser cannot listen. Type instead.'); return { stop() {} }; }
  const lang = /^en\b/i.test(navigator.language || '') ? navigator.language : 'en-AU';
  let finals = '';
  let interim = '';
  let delivered = false;
  let stopping = false;
  let restarts = 0;
  let heard = false;
  let silence = null;
  const started = Date.now();
  let rec = null;

  const text = () => `${finals} ${interim}`.replace(/\s+/g, ' ').trim();
  const deliver = () => {
    if (delivered) return;
    delivered = true;
    clearTimeout(silence); clearTimeout(cap);
    onFinal(text());
  };
  const finish = () => {
    if (stopping) return;
    stopping = true;
    clearTimeout(silence);
    try { rec.stop(); } catch { deliver(); }
  };

  const start = () => {
    rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    rec.onresult = (e) => {
      heard = true;
      interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finals = `${finals} ${bestOf(r)}`;
        else interim += r[0].transcript;
      }
      onInterim(text());
      clearTimeout(silence);
      silence = setTimeout(finish, silenceMs);
    };
    rec.onerror = (e) => {
      if (e.error === 'aborted' || (e.error === 'no-speech' && heard)) return;
      if (e.error === 'no-speech' && !stopping && restarts < 1) return; // onend restarts
      delivered = true;
      clearTimeout(silence); clearTimeout(cap);
      onError(SAY[e.error] || 'The microphone stopped working. Try again, or type instead.', e.error);
    };
    rec.onend = () => {
      if (delivered) return;
      // Quit before anybody spoke — some browsers do, on the very first press.
      if (!heard && !stopping && restarts < 1 && Date.now() - started < 8000) {
        restarts += 1;
        try { start(); return; } catch { /* fall through and give up */ }
      }
      deliver();
    };
    rec.start();
  };

  const cap = setTimeout(finish, maxMs);
  // Pressed again before a word was said: nothing to deliver, so just stop.
  const cancel = () => {
    delivered = true;
    clearTimeout(cap); clearTimeout(silence);
    try { rec?.abort(); } catch { /* already gone */ }
  };
  try { start(); } catch { cancel(); onError('The microphone could not start. Try again, or type instead.'); }
  return { stop: () => (heard ? finish() : cancel()), abort: cancel };
}

/** Say something out loud, briefly. Silent where the browser has no voice. */
export function speak(text) {
  if (!text || typeof speechSynthesis === 'undefined') return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).slice(0, 300));
    u.lang = /^en\b/i.test(navigator.language || '') ? navigator.language : 'en-AU';
    u.rate = 1.05;
    speechSynthesis.speak(u);
  } catch { /* the answer is on screen either way */ }
}
