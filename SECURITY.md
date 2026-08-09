# Kairo — Security & Data Isolation

How Kairo keeps each business's data private and its secrets out of the browser.
Written for a non-specialist owner and for whoever deploys it.

---

## 1. Data isolation — "each business only sees its own data"

Kairo is **single-tenant by design: one business = one private instance = one
database file.** There is no shared database where businesses could see each
other's rows, so the strongest possible isolation is structural, not a policy
that could be misconfigured:

- Luxe Hair Studio runs at `luxehair.yourbrand.app` with its own `data/kairo.db`.
- The Barber Co runs at a different address with a *completely separate* database.
- Neither server can read the other's file. There is no cross-tenant query to get wrong.

This is a stronger guarantee than row-level security inside a shared multi-tenant
database — the two businesses' data never live in the same place to begin with.

**Inside one instance,** access is gated centrally: every `/api/*` route requires
a valid signed session cookie *except* the handful of public booking endpoints
below. A request without a valid session gets `401` before any handler runs
(`handleApi` in `src/api.js`). There is no route that returns business data
without either a session or being an intentional public booking endpoint.

### The only unauthenticated endpoints, and what they expose

| Endpoint | Purpose | Exposes | Never exposes |
|---|---|---|---|
| `POST /api/auth/login` | Sign in | — | — (rate-limited: 20/10min/IP) |
| `POST /api/auth/logout` | Sign out | — | — |
| `GET /api/public/info` | Booking page data | business name/phone/address, brand, service menu, staff first names, deposit *rules* | client list, revenue, any API key |
| `GET /api/public/availability` | Free time slots | open slot times only | who is booked, client details |
| `POST /api/public/book` | Make a booking | the caller's own confirmation | anyone else's booking |
| `POST /api/public/confirm-deposit` | Confirm a Stripe deposit | one booking's own details, only when the caller presents the matching unguessable Stripe session id | other bookings |
| `GET /api/public/ics/:id?t=…` | "Add to calendar" file | service name, time, business address — **only with the signed token issued to whoever made the booking** | client name, email, phone, and anything at all without the token |
| `GET /api/public/review` | Load the review form | business name, brand, service/staff/date for *this* visit only, given a random unguessable per-appointment token | any other appointment, other clients' reviews |
| `POST /api/public/review` | Submit a review | the caller's own new review (requires the same token; rejects a second submission) | any other appointment |

**Every public link that names one booking is token-scoped, never id-scoped.**
Ids are sequential, so an endpoint keyed on the id alone can be walked
(`/1`, `/2`, `/3`…) to read back the whole diary. Review and cancel links use a
32-character random token (`crypto.randomBytes(16)`) stored on the appointment;
the calendar file uses a token derived by HMAC from the server secret
(`recordToken('ics', id)` in `src/auth.js`), so there is nothing extra to store
and a forwarded calendar file never carries the power to cancel the booking.
A missing or wrong token returns **404, not 403**, so the response never
confirms whether that booking exists. A review can only be left once a visit is
marked Completed.

> Fixed in v1.30.0: `GET /api/public/ics/:id` previously accepted the bare
> numeric id, which let an unauthenticated caller enumerate every appointment's
> date, time and service. Found by the security-checklist sweep, which now
> walks the id range on every run and fails if a single booking is readable.

No public endpoint returns a client's contact details, another customer's
booking, revenue, or any credential. This is verified by an automated test that
fails the build if a secret string ever appears in a public response.

## 2. Secrets never reach the browser

Payment and messaging keys (Stripe secret key, Resend API key, and your SMS
provider's key — ClickSend API key, Telnyx API key, or Twilio auth token) are
**write-only from the UI's perspective:**

- They are stored server-side in the settings table.
- The API **never returns their values.** `getSettings()` replaces each secret
  with a `<key>_set` boolean (`"1"` = configured) — so the Settings screen can
  show a green "● saved" marker and a "leave blank to keep" field without the
  value ever crossing the network.
- Saving an empty secret field leaves the stored value untouched; to remove a
  key you send an explicit clear action.
- The server reads the real values directly from the database only when it needs
  to call Stripe/Resend/Twilio — they are never placed in page HTML or JS state.

An automated test asserts that neither the authenticated settings response nor
the public booking response contains any `sk_…`, `re_…`, or auth-token string.

The session-signing secret is generated on first run, kept server-side, and is
never included in any API response.

## 3. Passwords, sessions & email verification

- Passwords are hashed with **scrypt** and a per-user random salt; the plaintext
  is never stored and password checks use constant-time comparison.
- Sessions are stateless cookies signed with **HMAC-SHA256**, marked
  **HttpOnly** (JavaScript can't read them), **SameSite=Lax** (cross-site
  requests can't ride the cookie), **Secure** when served over HTTPS (the
  cookie is never sent in the clear), and expire after 30 days.
- **Changing your password retires every existing session** (v1.6): each token
  carries a version that is bumped on password change, so a stolen or shared
  cookie stops working the instant the password is changed — the current
  browser is handed a fresh one so you stay signed in.
- Login is rate-limited per IP to blunt brute-force attempts, and runs a hash
  comparison even for unknown emails so response timing can't reveal which
  addresses have accounts.
- **Changing a password has its own tight limit** (10 per 15 minutes, v1.30.0).
  The endpoint already required the current password, but at the generic
  authenticated ceiling a hijacked session could have guessed it hundreds of
  times a minute.
- **Password rules are enforced on the server** (v1.30.0, `src/password.js`):
  at least 10 characters, and refused if it is a password from the top of every
  breach list, a keyboard or number run, one character repeated, or essentially
  just the owner's name, email or business name — including run together
  (`LuxeHairStudio`). The Account page shows the same verdict live as you type,
  but the server is the enforcer; the browser only saves you a round trip.
- **Breached passwords are refused** (v1.30.0) using the Have I Been Pwned range
  API with k-anonymity: only the first five characters of the password's SHA-1
  hash leave the server, never the password. It **fails open** — if that service
  is unreachable the change still goes through, because a salon must never be
  locked out of securing its own account by someone else's outage. Set
  `KAIRO_BREACH_CHECK=off` for air-gapped installs.
- There is **no password-reset endpoint**, so there is no reset flow to abuse:
  a locked-out owner is helped by whoever runs their deployment.
- **Default-password warning** (v1.6): a fresh install ships with a default
  password. Until it is changed, a red banner across the top of the app warns
  the owner that anyone who knows it can get in. Set `KAIRO_ADMIN_PASSWORD` at
  first boot to avoid ever using the default. **This is the single most
  important thing a deployer must do.**
- **Owner email verification** (v1.5): the business owner can verify their
  account email from Settings → Security. The link uses a 48-character
  cryptographically random token, expires after 48 hours, and is **single-use**
  — once clicked it is wiped from the database. Verifying proves the owner
  controls the address their receipts, reminders and password-critical mail
  will come from. (This applies to the *business's* account — customers never
  need an account or verification to book.)
- **Owner email verification** (v1.5): the business owner can verify their
  account email from Settings → Security. The link uses a 48-character
  cryptographically random token, expires after 48 hours, and is **single-use**
  — once clicked it is wiped from the database. Verifying proves the owner
  controls the address their receipts, reminders and password-critical mail
  will come from. (This applies to the *business's* account — customers never
  need an account or verification to book.)

## 4. Rate limiting — every endpoint (v1.5)

Every `/api/*` request passes through a fixed-window rate limiter
(`src/ratelimit.js`) **before** any handler runs. Limits are per-IP for public
traffic and per-user-plus-IP for signed-in staff, generous for legitimate use
and tight where abuse hurts:

| Bucket | Limit | Window | Guards against |
|---|---|---|---|
| Login | 20 | 10 min / IP | password brute-force |
| Public booking (`POST /api/public/book`) | 12 | 5 min / IP | booking spam / slot squatting |
| Public review submit | 10 | 10 min / IP | review flooding |
| Deposit confirm | 20 | 10 min / IP | token guessing |
| Public reads (info / availability / ics / review form / verify-email) | 240 | 1 min / IP | scraping, hammering |
| Authenticated API | 600 | 1 min / user+IP | runaway scripts on a stolen session |
| Global ceiling (all API) | 900 | 1 min / IP | anything else |

Over-limit requests are refused **gracefully**: a clean `429` JSON body with a
human-readable message and a `Retry-After` header — never a dropped socket.
Other visitors on other IPs are unaffected (verified by test).

Deployment note: behind Render/Caddy/nginx the limiter reads the proxy's
`x-forwarded-for` header (the default). If you ever expose the Node process
directly with **no** proxy, set `KAIRO_TRUST_PROXY=0` so clients can't spoof
their IP past the limiter.

## 5. Strict input validation — schema-based (v1.5)

Every write endpoint validates its JSON body against an explicit schema
(`src/validate.js`) before touching the database:

- **Unexpected fields are rejected** with a `400` naming the field — including
  nested ones (e.g. `client.is_admin` smuggled into a public booking). Nothing
  unknown is ever silently accepted or stored.
- **Types are checked** (string / number / boolean / enum / object / array) —
  a string where a boolean belongs is a `400`, not a coerced surprise.
- **Length limits** on every string, **min/max ranges** on every number
  (ratings 1–5, payment amounts ≥ 1 cent, durations bounded, etc.).
- The settings endpoint accepts **only whitelisted keys** — attempts to write
  internal keys such as `session_secret` are rejected by the same rule.

## 6. Injection & content safety

- **SQL:** every query uses parameterized statements (`db.prepare(...).run(?, ?)`).
  No user input is ever concatenated into SQL.
- **HTML:** all user-supplied text is escaped before rendering (`esc()` on the
  client, JSON responses server-side). Uploaded logos/photos are constrained to
  `data:image/...` URIs and size-capped.
- **Static files:** the file server normalizes paths and refuses anything that
  escapes the `public/` directory (no path traversal).
- **Content-Security-Policy** (v1.6): a strict CSP locks scripts and network
  connections to the app's **own origin** (`script-src 'self'`, `connect-src
  'self'`, `object-src 'none'`) — so even if an XSS payload slipped past output
  escaping, the browser refuses to run injected `<script>` or exfiltrate data to
  another host. Framing is blocked (`frame-ancestors 'none'`).
- **Headers:** every response sets `Content-Security-Policy`,
  `Strict-Transport-Security` (force HTTPS for 2 years),
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: same-origin`, and a `Permissions-Policy` that disables
  camera, microphone, geolocation and payment APIs the app never uses.

## 7. What the deployer must still do

Software can't do these for you:

- **Serve over HTTPS.** Put Caddy/Render/nginx in front so traffic is encrypted
  and the session cookie is only sent over TLS. (Render and Caddy do this
  automatically.)
- **Change the default admin password** on first sign-in (or set
  `KAIRO_ADMIN_PASSWORD` at first boot).
- **Back up `data/kairo.db`** nightly — it is the entire business.
- **Open Stripe/Twilio/Resend accounts in the business's own name** so money and
  messages flow through their accounts, not yours.

## 7b. Uploaded spreadsheets (v1.17 · hardened v1.21.1)

The client importer reads `.xlsx` files, which are ZIP archives — so a hostile
upload can be a **decompression bomb**: a few hundred kilobytes that expand to
gigabytes and exhaust the server's memory. The reader therefore:

- caps any single part at **64 MB inflated** and the whole workbook at
  **128 MB**, passing `maxOutputLength` to `zlib` so inflation is aborted at the
  limit rather than after the fact;
- caps the archive at **512 entries**;
- bounds-checks every attacker-controlled offset and length in the ZIP
  directory, so a truncated or doctored archive fails as a clean `400` instead
  of a crash;
- never writes to disk and never resolves entry names as paths, so there is no
  zip-slip surface;
- parses the XML with plain string scanning — there is no entity resolution, so
  no XXE / billion-laughs vector.

Verified: a 199 KB bomb that inflates to 200 MB is refused with `400` in under
100 ms and the server stays responsive; non-ZIP, truncated and empty uploads
each return `400`, not `500`.

## 8. Verified by automated tests

The end-to-end suites (66 checks across core, pricing, receipts/reviews, and a
dedicated 27-check security suite) and the load test include, specifically:

- **Session security**: the cookie carries `Secure` over HTTPS; a forged or
  tampered token is rejected (`401`); and **changing the password immediately
  invalidates the old cookie** (it returns `401`) while the new one works —
  proving a stolen session can be revoked.
- **Security headers**: a strict `Content-Security-Policy` (self-only scripts,
  no framing, no objects), plus `HSTS` and `Permissions-Policy`, are present on
  responses.
- **Default-password warning** is surfaced to the app on a fresh install, and
  the internal session epoch is never exposed to the browser.

- A request with an **unknown field** — top-level or nested — gets a `400`
  naming the field; oversized strings, wrong types, and out-of-range numbers
  are all rejected; writing `session_secret` via settings is refused.
- **Rate limits fire and recover gracefully**: the 241st public read in a
  minute, the 21st login attempt, and the 13th booking attempt each get a
  clean `429` with `Retry-After`, while a different IP is unaffected.
- **Email verification**: a fresh account starts unverified; sending without
  email configured gives clear guidance (no crash); an invalid token shows a
  friendly error page; a valid token verifies exactly once and cannot be
  reused.
- **Working days**: a closed day offers zero slots server-side, and a direct
  booking POST for a closed day is refused with `409` even if a client skips
  the UI.

- Secrets masked in the authenticated API and **absent** from the public API.
- The public info/ICS/review endpoints carry no client PII.
- A review link is single-use and scoped to its own appointment (token-based, not
  numeric id); resubmitting shows "already reviewed" rather than creating a duplicate.
- SMS notifications default **off**, verified on a fresh install — no per-text cost is
  ever incurred without the owner explicitly opting in.
- A contended booking slot is won by exactly one request (39 of 40 concurrent
  duplicate bookings correctly rejected) — no overbooking under load.
- 0 HTTP errors across ~30,000 requests at 800–2,300 req/s per endpoint.
- **Malformed input can't crash the server**: a request with a broken
  `Cookie` header (a classic denial-of-service vector) is handled gracefully
  (`401`), and the server stays up. Regression-tested.
- Uploaded logo/cover/gallery images are validated as genuine base64 image
  data URIs on write and escaped on render, so a booking page can't be made
  to carry injected markup.

> An independent audit pass (run on a second model) found and we fixed a
> pre-release crash bug in cookie parsing, a body-size limit that blocked large
> branding uploads, and hardened image handling — all covered by the checks above.

## Reporting a concern

This is a self-hosted product. If you find a security issue, contact the person
who deployed your instance. If you operate Kairo for clients, keep your Node
runtime patched and your host's OS updated.
