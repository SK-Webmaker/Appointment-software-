# Signing in from kairobookings.com

An owner goes to **kairobookings.com**, presses **Log in**, types the email and
password they already have, and lands in their own workspace. Nobody has to
remember their own `yourname.kairobookings.com` address first.

## The gap

Every salon lives at its own address — `hairbysha.kairobookings.com` — and its
accounts live in its own database. That is the right design and it is not
changing. What it costs is that an owner has to know the address before they
can sign in. "What was my link again?" is a support request that should never
have to exist, and a website with no **Log in** button looks like a business
that does not expect its customers to come back.

## What it looks like

| Where | What the owner sees |
|---|---|
| kairobookings.com | A nav with **Log in**, **Contact us** and a filled **Sign up** button |
| login.kairobookings.com | "Sign in to Kairo": email, password (with Show), **Sign in** |
| — one business | "Opening Hair By Sha…", then their workspace, already signed in |
| — more than one | "Which business?", a button per business, then that workspace |
| — wrong details | "That email and password don't match a Kairo account." |
| — too many wrong | "Too many wrong passwords for this email. Please try again in 15 minutes." |
| — pass timed out | Back at the form: "That sign-in timed out before it finished…" |

Under the form: **Forgot your password?**, which emails a reset link to a
confirmed address (see `docs/13-password-reset.md`), **Don't know which email
you use?**, and **New to Kairo? Get started**.

## How it works

```
 kairobookings.com                login.kairobookings.com             hairbysha.kairobookings.com
 ─────────────────                ───────────────────────             ───────────────────────────
 [Log in] ──────────────────────▶ form
                                  POST /api/login
                                    ├ rate limit (per address)
                                    ├ lock check (per email)
                                    ├ Turnstile (if configured)
                                    ├ ask every salon, in its own
                                    │ database: is this email here,
                                    │ and is this its password?
                                    └ mint a single-use pass in
                                      THAT salon's database ───────▶ GET /api/auth/handoff?t=…
                                                                       ├ DELETE … RETURNING (use it up)
                                                                       ├ check it has not expired
                                                                       ├ create a normal session
                                                                       ├ set the salon's own cookie
                                                                       └ 302 → /   (the workspace)
```

Three things make this safe to do:

1. **The password is checked where it lives.** The front door asks each
   salon, inside that salon's own context, against that salon's own `users`
   table, with the same `verifyPassword` the salon's own sign-in page uses.
   No account moves, no second copy of a password exists anywhere, and there is
   no central user table to leak.

2. **The pass is a one-shot, one-minute, one-salon credential.**
   - 32 random bytes; only its SHA-256 is stored, so a copy of the database is
     not a copy of any live pass.
   - Written into one salon's database, so a pass for Alpha is meaningless at
     Beta.
   - Redeemed with `DELETE … RETURNING`, so "look it up" and "use it up" are
     one statement — two requests in the same instant cannot both succeed.
   - Dead after 60 seconds whether or not it was used. Swept on the next mint.
   - Stripped from the address bar by an immediate redirect, with
     `Referrer-Policy: no-referrer` on both sides so it is never sent onward.

3. **The session that results is an ordinary salon session.** Same cookie,
   same host-only scope, same expiry, same "sign out everywhere" behaviour.
   Nothing downstream knows or cares that the owner came in through the front
   door.

### Why not a shared cookie across `*.kairobookings.com`?

It would work, and it would mean one salon's pages could read a cookie that
signs somebody into another salon. Every salon is a separate trust boundary;
the cookie stays scoped to the salon's own host.

### Why not an emailed code?

Several accounts use an email the owner does not personally read (a shared
business inbox, or an address set up for them). A code sent there would lock
the owner out of their own business. So the security is on the front door
itself instead — see below.

## The security on the front door

| Layer | What it stops | Setting |
|---|---|---|
| Rate limit per IP | One machine guessing | 12 attempts / 10 min |
| Lock per email | Many machines guessing one account (credential stuffing) | 8 wrong in 15 min → locked 15 min, even for the right password |
| Identical refusals | Finding out whether someone has a Kairo account | Wrong email and wrong password give the same message, in the same time (a decoy hash runs when the email exists nowhere) |
| Picker only after proof | Learning which businesses an email belongs to | The list is returned only once the password is proved |
| Turnstile (optional) | Bots | Off until `KAIRO_LOGIN_TURNSTILE_*` are set |
| New-browser alert | An owner not knowing someone got in | A "New sign-in" push to that owner, the first time a browser signs in this way |
| Strict page | Framing, script injection, leaking the pass | CSP `default-src 'self'`, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, HSTS, `no-referrer` |
| Allow-listed files | The front door serving the owner app with no salon behind it | Only the sign-in page, its script and two icons are served; everything else is a 404 |
| Reserved name | A salon signing up as `login` and hijacking the front door | `login`, `signin`, `auth`, `sso`, `id`, `password`… are refused at signup, the host is decided before any salon is looked up, and a salon with that name is never offered as a target |
| Redirect check | The page being told to send someone elsewhere | The browser only follows a redirect to `*.kairobookings.com` |

## Configuration

All optional. With none set, it works as described with the defaults.

| Variable | Default | Purpose |
|---|---|---|
| `KAIRO_LOGIN_HOST` | `login.<base domain>` | The front door's address |
| `KAIRO_SITE_URL` | `https://<base domain>` | "Back to the website" and footer links |
| `KAIRO_SIGNUP_URL` | `https://kairo-platform.onrender.com/start` | "Get started" |
| `KAIRO_SUPPORT_EMAIL` | `support@<base domain>` | Where owners without a confirmed email are sent for help |
| `KAIRO_LOGIN_TURNSTILE_SITE_KEY` + `KAIRO_LOGIN_TURNSTILE_SECRET` | unset (off) | Cloudflare "I am human" check. Both must be set. Add `login.kairobookings.com` to the widget's hostnames |

On the website (the `my-creative-space` repo), the two nav destinations are in
`src/site.config.ts`: `loginUrl` and `signupUrl`.

## Going live — the order matters

The website's **Log in** must never point at an address the server does not
serve yet. So:

1. **Deploy the shard.** Render → `kairo-shard-au` → Manual Deploy → *Deploy
   latest commit*. The shard has a disk, so there is a gap of roughly 20–30
   seconds while the new instance starts; do it at a quiet time.
2. **Check it.**
   `node scripts/verify-deploy.mjs --url https://kairo-shard-au.onrender.com --salon hairbysha --salon horahaircutz`
   (take `--after` with the time just before you pressed Deploy), then open
   <https://login.kairobookings.com> — it should show "Sign in to Kairo", and
   `/api/version` there should report the new version.
3. **Sign in once for real** with an owner account, and confirm it lands in
   the right workspace.
4. **Publish the website** in Lovable. The nav change is already in its
   `main`; Publish is what puts it on kairobookings.com.

Nothing needs to change in DNS: `*.kairobookings.com` already reaches the
shard, and the certificate already covers `login.`.

## Code

| File | What |
|---|---|
| `src/central-login.js` | Finding accounts, the per-email lock, minting and redeeming passes |
| `src/login-host.js` | The HTTP around it: the page, `/api/login`, security headers |
| `server.js` | Decides "this is the front door" before any salon is looked up |
| `src/api.js` | `GET /api/auth/handoff` on each salon, and the new-browser push |
| `src/db.js` | The `login_handoffs` table |
| `frontdoor/index.html`, `frontdoor/login.js` | The page |
| `platform/signup.js` | The reserved names |
| `test/central-login.test.js` | 22 tests on a shard with two salons and a shared account |
| `test/falsify.mjs` | 10 mutations, each one a way this could be quietly broken |
