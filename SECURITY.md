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
| `GET /api/public/ics/:id` | "Add to calendar" file | service name, time, business address | client name, email, phone |

No public endpoint returns a client's contact details, another customer's
booking, revenue, or any credential. This is verified by an automated test that
fails the build if a secret string ever appears in a public response.

## 2. Secrets never reach the browser

Payment and messaging keys (Stripe secret key, Resend API key, Twilio auth
token) are **write-only from the UI's perspective:**

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

## 3. Passwords & sessions

- Passwords are hashed with **scrypt** and a per-user random salt; the plaintext
  is never stored and password checks use constant-time comparison.
- Sessions are stateless cookies signed with **HMAC-SHA256**, marked
  **HttpOnly** (JavaScript can't read them), **SameSite=Lax** (cross-site
  requests can't ride the cookie), and expire after 30 days.
- Login is rate-limited per IP to blunt brute-force attempts.

## 4. Injection & content safety

- **SQL:** every query uses parameterized statements (`db.prepare(...).run(?, ?)`).
  No user input is ever concatenated into SQL.
- **HTML:** all user-supplied text is escaped before rendering (`esc()` on the
  client, JSON responses server-side). Uploaded logos/photos are constrained to
  `data:image/...` URIs and size-capped.
- **Static files:** the file server normalizes paths and refuses anything that
  escapes the `public/` directory (no path traversal).
- **Headers:** responses set `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, and `Referrer-Policy: same-origin`.

## 5. What the deployer must still do

Software can't do these for you:

- **Serve over HTTPS.** Put Caddy/Render/nginx in front so traffic is encrypted
  and the session cookie is only sent over TLS. (Render and Caddy do this
  automatically.)
- **Change the default admin password** on first sign-in (or set
  `KAIRO_ADMIN_PASSWORD` at first boot).
- **Back up `data/kairo.db`** nightly — it is the entire business.
- **Open Stripe/Twilio/Resend accounts in the business's own name** so money and
  messages flow through their accounts, not yours.

## 6. Verified by automated tests

The end-to-end suite (20 checks) and the load test include, specifically:

- Secrets masked in the authenticated API and **absent** from the public API.
- The public info/ICS endpoints carry no client PII.
- A contended booking slot is won by exactly one request (39 of 40 concurrent
  duplicate bookings correctly rejected) — no overbooking under load.
- 0 HTTP errors across ~30,000 requests at 800–2,300 req/s per endpoint.

## Reporting a concern

This is a self-hosted product. If you find a security issue, contact the person
who deployed your instance. If you operate Kairo for clients, keep your Node
runtime patched and your host's OS updated.
