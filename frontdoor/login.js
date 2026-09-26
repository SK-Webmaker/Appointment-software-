// The sign-in form at login.kairobookings.com.
//
// Standalone on purpose — no imports. The front door serves this file and very
// little else, and the less it serves the less there is to get wrong.
//
// What happens when somebody signs in:
//   1. email + password go to /api/login, on this same address
//   2. the server finds the business that account belongs to and checks the
//      password there
//   3. it answers with where to go next — their business's own address, with a
//      single-use pass — and the browser goes there
//   4. that address signs them in and opens their workspace
//
// If one account opens more than one business, step 3 answers with the list
// instead, and they pick.
(() => {
  const $ = (id) => document.getElementById(id);
  const card = $('card');
  const form = $('signin');
  const email = $('email');
  const password = $('password');
  const err = $('error');
  const go = $('go');
  const goLabel = $('go-label');
  const pick = $('pick');
  const pickList = $('pick-list');
  const pickErr = $('pick-error');
  const notice = $('notice');

  const support = card.dataset.support || '';
  document.querySelectorAll('#support-link, .support-link').forEach((a) => {
    a.href = `mailto:${support}?subject=${encodeURIComponent('Help signing in to Kairo')}`;
  });

  // Sent back here from a business's address because the pass had expired or
  // was already used — the usual cause is a slow connection, or opening the
  // sign-in in two tabs. Nothing is wrong with their account.
  const params = new URLSearchParams(location.search);
  if (params.has('expired')) {
    notice.textContent = 'That sign-in timed out before it finished. Please sign in again — it only takes a moment.';
    notice.hidden = false;
    history.replaceState(null, '', location.pathname);
  }

  // ── Show / hide the password ──────────────────────────────────────────────
  $('pw-toggle').addEventListener('click', (e) => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    e.currentTarget.textContent = show ? 'Hide' : 'Show';
    e.currentTarget.setAttribute('aria-pressed', String(show));
    password.focus();
  });

  // ── The optional "are you a person" check ─────────────────────────────────
  const tsKey = card.dataset.turnstile || '';
  let tsWidget = null;
  let tsToken = '';
  if (tsKey) {
    window.kairoTurnstileReady = () => {
      tsWidget = window.turnstile.render('#ts', {
        sitekey: tsKey,
        theme: 'dark',
        action: 'login',
        callback: (t) => { tsToken = t; },
        'expired-callback': () => { tsToken = ''; },
        'error-callback': () => { tsToken = ''; },
      });
    };
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=kairoTurnstileReady';
    s.async = true;
    document.head.appendChild(s);
  }
  const resetTurnstile = () => {
    tsToken = '';
    if (tsWidget !== null && window.turnstile) { try { window.turnstile.reset(tsWidget); } catch { /* gone */ } }
  };

  const busy = (on, label) => {
    go.disabled = on;
    go.classList.toggle('busy', on);
    goLabel.textContent = label;
  };

  /** One call to /api/login. Returns the parsed reply, or throws a readable Error. */
  async function attempt(body) {
    let res;
    try {
      res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'same-origin',
      });
    } catch {
      throw new Error("Couldn't reach Kairo. Check your connection and try again.");
    }
    const text = await res.text().catch(() => '');
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { /* handled below */ }
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    return data;
  }

  /** Where the server says to go next — only ever a Kairo address. */
  function follow(data) {
    let url;
    try { url = new URL(data.redirect); } catch { url = null; }
    // Never follow a redirect anywhere but a Kairo business address. The
    // server is the only thing that writes this, but a page that will send a
    // browser wherever it is told is a page somebody will try to tell.
    const base = (card.dataset.base || '').toLowerCase();
    if (!url || !(url.hostname === base || url.hostname.endsWith(`.${base}`))) {
      throw new Error('Something went wrong. Please try again.');
    }
    busy(true, data.business ? `Opening ${data.business}…` : 'Signing you in…');
    location.assign(url.href);
  }

  function showPicker(choices) {
    form.hidden = true;
    $('help').hidden = true;
    $('title').textContent = 'Which business?';
    $('lede').textContent = 'Your account opens more than one business. Choose the one you want.';
    pickList.replaceChildren(...choices.map((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pick-btn';
      const name = document.createElement('b');
      name.textContent = c.business;
      const who = document.createElement('span');
      who.textContent = c.name ? `as ${c.name}` : '';
      b.append(name, who);
      b.addEventListener('click', async () => {
        pickErr.textContent = '';
        pickList.querySelectorAll('button').forEach((x) => { x.disabled = true; });
        try {
          follow(await attempt({ email: email.value, password: password.value, slug: c.slug }));
        } catch (e) {
          pickErr.textContent = e.message;
          pickList.querySelectorAll('button').forEach((x) => { x.disabled = false; });
        }
      });
      return b;
    }));
    pick.hidden = false;
    pickList.querySelector('button')?.focus();
  }

  $('pick-back').addEventListener('click', () => {
    pick.hidden = true;
    form.hidden = false;
    $('help').hidden = false;
    $('title').textContent = TITLE;
    $('lede').textContent = LEDE;
    password.value = '';
    busy(false, 'Sign in');
    password.focus();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    if (!email.value.trim() || !password.value) {
      err.textContent = 'Please enter your email and password.';
      (email.value.trim() ? password : email).focus();
      return;
    }
    if (tsKey && !tsToken) {
      err.textContent = 'Please complete the "I am human" check first.';
      return;
    }
    busy(true, 'Signing in…');
    try {
      const data = await attempt({ email: email.value.trim(), password: password.value, turnstile_token: tsToken });
      if (Array.isArray(data.choose) && data.choose.length) {
        busy(false, 'Sign in');
        showPicker(data.choose);
        return;
      }
      follow(data);
    } catch (e2) {
      err.textContent = e2.message;
      busy(false, 'Sign in');
      resetTurnstile();
      password.select();
    }
  });

  // ── Forgot password ───────────────────────────────────────────────────────
  //
  // Asks for the email, and says the same thing whatever happens: the server
  // never tells this page whether the account exists or was sent anything,
  // so neither can the page tell anybody else.
  const forgot = $('forgot');
  const fForm = $('forgot-form');
  const fEmail = $('f-email');
  const fErr = $('f-error');
  const fGo = $('f-go');
  const fLabel = $('f-label');
  const fDone = $('f-done');
  const TITLE = 'Sign in to Kairo';
  const LEDE = "Use the email and password you already sign in with. We'll take you straight to your business.";
  let fWidget = null;
  let fToken = '';

  function openForgot() {
    form.hidden = true;
    $('help').hidden = true;
    notice.hidden = true;
    $('title').textContent = 'Reset your password';
    $('lede').textContent = "Enter the email you sign in with and we'll send you a link to choose a new password.";
    fEmail.value = email.value.trim();
    fErr.textContent = '';
    fDone.hidden = true;
    fForm.hidden = false;
    forgot.hidden = false;
    if (tsKey && window.turnstile && fWidget === null) {
      fWidget = window.turnstile.render('#ts-forgot', {
        sitekey: tsKey, theme: 'dark', action: 'forgot',
        callback: (t) => { fToken = t; },
        'expired-callback': () => { fToken = ''; },
        'error-callback': () => { fToken = ''; },
      });
    }
    fEmail.focus();
  }

  function closeForgot() {
    forgot.hidden = true;
    form.hidden = false;
    $('help').hidden = false;
    $('title').textContent = TITLE;
    $('lede').textContent = LEDE;
    if (fEmail.value.trim() && !email.value.trim()) email.value = fEmail.value.trim();
    (email.value ? password : email).focus();
  }

  $('forgot-open').addEventListener('click', openForgot);
  $('f-back').addEventListener('click', closeForgot);

  fForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    fErr.textContent = '';
    const address = fEmail.value.trim();
    if (!address || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
      fErr.textContent = 'Enter the email you sign in with.';
      fEmail.focus();
      return;
    }
    if (tsKey && !fToken) {
      fErr.textContent = 'Please complete the "I am human" check first.';
      return;
    }
    fGo.disabled = true;
    fGo.classList.add('busy');
    fLabel.textContent = 'Sending…';
    try {
      let res;
      try {
        res = await fetch('/api/forgot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: address, turnstile_token: fToken }),
          credentials: 'same-origin',
        });
      } catch {
        throw new Error("Couldn't reach Kairo. Check your connection and try again.");
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      fForm.hidden = true;
      fDone.textContent = data.message;
      fDone.hidden = false;
      $('f-back').focus();
    } catch (e2) {
      fErr.textContent = e2.message;
      fToken = '';
      if (fWidget !== null && window.turnstile) { try { window.turnstile.reset(fWidget); } catch { /* gone */ } }
    } finally {
      fGo.disabled = false;
      fGo.classList.remove('busy');
      fLabel.textContent = 'Send reset link';
    }
  });

  // A salon's "this link has expired" page sends people here to ask again.
  if (params.has('forgot')) {
    history.replaceState(null, '', location.pathname);
    openForgot();
  }

  // Back-button from their workspace lands here again with the button still
  // saying "Opening…" — put it back.
  window.addEventListener('pageshow', (e) => { if (e.persisted) busy(false, 'Sign in'); });

  if (forgot.hidden) email.focus();
})();
