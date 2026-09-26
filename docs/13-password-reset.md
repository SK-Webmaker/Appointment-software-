# Forgot password

An owner who forgets their password presses **Forgot password?**, types their
email, and gets a link that lets them choose a new one. Nobody at Kairo has to
do anything.

## The one rule

**A reset link only ever goes to a confirmed email address.**

Several accounts were set up under an email the owner does not personally read:
a shared inbox, or an address somebody made for them. A reset link landing
there would hand the business to whoever reads it. So an account whose email
has not been confirmed simply gets no email. It keeps going through support,
exactly as before, until the owner confirms an address of their own.

That makes it safe to switch on for every salon at once. It starts working for
each owner the moment they confirm their email, and not before.

**For an owner to be able to reset their own password:**

1. Sign in → **Account**.
2. Put in an email they actually read → type their current password → **Save**.
3. Press **Send verification email**, then open the link in that inbox.

That's it. From then on, "Forgot password?" works for them.

## Where it appears

| Where | What |
|---|---|
| login.kairobookings.com | **Forgot your password?** under the sign-in form |
| Each salon's own sign-in page (and the phone app, which shows the same page) | **Forgot password?** under **Sign in** |
| The email | "Reset your Kairo password — *Business name*", with one button |
| `/reset` on the salon's address | "Choose a new password", with a strength meter and a confirm box |

## What happens

```
 Forgot password?  ──▶  POST /api/forgot (front door)  or  /api/auth/forgot (salon)
                          │  always answers the same sentence, immediately
                          └─ afterwards, in the background:
                               for each salon with a CONFIRMED account under that email
                                 ├ at most 1 email a minute, 3 an hour, per address
                                 ├ new single-use link; any older link for that person dies
                                 └ email: https://<salon>.kairobookings.com/reset#t=<link>

 /reset#t=…         ──▶  POST /api/auth/reset/check   (is it still good? shows "ow•••@gmail.com")
                    ──▶  POST /api/auth/reset          (new password)
                           ├ password checked FIRST (rules + breach list), so a bad
                           │ choice costs a retry, not the link
                           ├ link used up (DELETE … RETURNING); every other link for them dies
                           ├ every existing session signed out (token_version + 1)
                           ├ the front door's lock on that email lifted
                           ├ this browser signed in, straight to the workspace
                           └ "Your password was changed" by email and to their phone
```

## Why it is built this way

| Decision | Why |
|---|---|
| Confirmed addresses only | See above. This is what makes it safe for the existing salons. |
| The same answer every time | "If that email belongs to an account with a confirmed address, a link is on its way." It is true whether the account exists, is unconfirmed, or was throttled, so the page tells a stranger nothing. The email is sent after the reply, so timing doesn't give it away either. |
| Link after `#` | Browsers never send the part after `#` to a server, so the link never lands in a log or another site's Referer. The page reads it and wipes it from the address bar. |
| Only the hash stored | A copy of the database is not a copy of any live link. |
| 30 minutes, once, newest only | Long enough to find the email. Worthless in an old inbox. Pressing the button twice leaves only the latest email working. |
| Per-salon links | The front door sends one email per salon, each linking to that salon's own address. A link from one salon means nothing at another. |
| Sign everyone out | If somebody else was in, they are not any more. |
| Tell the owner | An email to the address and a push to their phone. If it wasn't them, they hear about it straight away. |

## Changing the sign-in email is now protected too

Once resets exist, the sign-in email is as good as the password: whoever
controls that inbox can reset their way in. So in **Account**:

- Changing the email **asks for the current password**. The field appears the
  moment the email is edited, and not before. It shares the password-change rate
  limit, so a stolen session cannot guess it quickly.
- The **old** address is emailed: "Your sign-in email was changed".
- Any reset link already sitting in the old inbox **stops working**.
- The new address starts **unconfirmed**, so it cannot receive a reset link
  until it has been confirmed.

## Also fixed while doing this

- **"Reset to demo data" on a live salon.** That button, which wipes a salon's
  clients, appointments and invoices, was only hidden once the owner confirmed
  their email. On the shard it is now refused, server-side, everywhere except
  the demo workspace, and it is not shown elsewhere. An unconfirmed email says
  nothing about whether a salon has real clients in it.
- **The demo password on every sign-in page.** Every salon's sign-in screen
  printed `admin@kairo.local / admin123`, including Hair By Sha's,
  Horahaircutz's, and the one Apple's reviewer sees. It now shows only on a
  developer's own machine.
- **The front door's page at a salon's address.** `hairbysha.kairobookings.com/login.html`
  served the front door's sign-in page with its placeholders unfilled. The page
  now lives in `frontdoor/`, which only login.kairobookings.com serves.
- **The Account page's advice** said verifying an email "needs email set up in
  Settings → Notifications first". Every salon on the shard can already send
  email, so that line now only appears where it is true. It now says why
  confirming matters: it is what lets you reset your own password.

## Limits

| What | Limit |
|---|---|
| Forgot requests, per IP address, per salon | 5 per 15 minutes |
| Forgot requests at the front door, per IP address | 5 per 15 minutes |
| Emails to one address | 1 a minute, 3 an hour (in memory; a restart forgives it) |
| Using a link, per IP address, per salon | 20 per 15 minutes |
| Changing the sign-in email | the same bucket as changing the password: 10 per 15 minutes |
| Link lifetime | 30 minutes |

If the front door's optional Turnstile check is switched on, it covers
"Forgot password?" too.

## Code

| File | What |
|---|---|
| `src/password-reset.js` | The link, the throttle, the emails, and the "ask every salon" search |
| `src/api.js` | `/api/auth/forgot`, `/api/auth/reset/check`, `/api/auth/reset`; the email-change rules; the demo-reset guard |
| `src/login-host.js` | `/api/forgot` at the front door |
| `src/db.js` | The `password_resets` table |
| `src/ratelimit.js` | The limits above |
| `public/reset.html`, `public/js/reset.js` | The "Choose a new password" page |
| `public/js/password-judge.js` | The strength meter, shared with the Account page |
| `public/js/app.js` | Forgot password on each salon's sign-in page |
| `frontdoor/index.html`, `frontdoor/login.js` | The front door (moved out of `public/`), with Forgot password |
| `test/password-reset.test.js` | 19 tests on a shard with three salons and a recording email provider |
| `test/falsify.mjs` | 12 mutations, each one a way this could be quietly broken |
