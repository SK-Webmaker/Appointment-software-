# Onboarding a business onto Kairo

Every business that joins gets its own everything: its own Render service, its
own database on its own disk, its own Resend account, its own ClickSend account,
and its own address on the platform domain — `<business>.kairobookings.com`.

Nothing is shared. No cross-tenant data, no shared keys, no shared sending
reputation. That is the strongest isolation there is, and it is also why this is
a runbook rather than a settings screen: the same six steps, in the same order,
for the fifth business as for the first, at 9pm, without thinking.

---

## Before you start

One Cloudflare API token, scoped to the `kairobookings.com` zone. See the token
permissions listed in [README.md](README.md#optional-put-the-domain-behind-cloudflare).

```bash
export CLOUDFLARE_API_TOKEN=...      # never on the command line — that lands in shell history and ps
```

Pick the business's **slug** now and use it everywhere: lowercase, no spaces.
`Hair by Sha` → `hairbysha`. It becomes the subdomain, the Render service name,
and the email address you sign the accounts up with, so choosing it once and
sticking to it is what keeps the six steps from drifting apart.

---

## 1. Their email address on your domain

`hairbysha@kairobookings.com` → your Gmail, via Cloudflare Email Routing's
catch-all. You sign the business's Resend and ClickSend accounts up with it, so
password resets and billing notices reach you rather than being lost in a
handover, and the business never has to create accounts it doesn't understand.

Nothing to do per business if the catch-all is already on — that is the point of
a catch-all.

## 2. DNS

```bash
# Look first. This changes nothing.
node scripts/onboard-business.mjs --business hairbysha --service hairbysha-booking

# Then, once Resend has given you the DKIM value (step 4):
node scripts/onboard-business.mjs --business hairbysha --service hairbysha-booking \
  --dkim "p=MIGfMA0GCSqGSIb3..." --apply
```

Four records, and the script knows which ones already exist:

| Type | Name | Purpose |
|---|---|---|
| CNAME | `hairbysha` | the booking page → the Render service |
| MX | `send.hairbysha` | where bounces go back to Resend |
| TXT | `send.hairbysha` | SPF — proves Resend may send as you |
| TXT | `resend._domainkey.hairbysha` | DKIM — signs each message |

The CNAME is created **DNS-only (grey cloud)** on purpose. Render verifies the
domain and issues its certificate by talking to the origin; behind Cloudflare's
proxy it sees Cloudflare instead, and the certificate never issues. The proxy
goes on in step 3, after the green tick.

**`_dmarc` is added once for the whole domain, ever.** The script checks and
leaves it alone if it exists. Two DMARC records is not more protection — mail
receivers see an ambiguous policy and treat the domain as having none at all,
for every business on it. This is the single most damaging mistake available in
this runbook, which is why it is checked rather than remembered.

The script also refuses a DKIM value shorter than 200 characters. A key
truncated on the way through a dashboard produces mail that sends perfectly and
fails authentication everywhere, and nothing reports it.

## 3. The Render service

```bash
node scripts/onboard-business.mjs --business hairbysha --render
```

prints `render.yaml` filled in for this business. Render blueprints have no
variables and refuse a duplicate service name, so the file in the repo is a
template and this is what turns it into one business's copy.

Then, in Render:

1. **New → Blueprint** → this repo → Apply. (Or create the service by hand and
   set `name` and `region` to the two values the command printed.)
2. Fill in `KAIRO_ADMIN_EMAIL` and `KAIRO_ADMIN_PASSWORD` when prompted — they
   are read **only on the very first boot**, when the owner's account is created.
   Setting them later does nothing.
3. Wait for the first deploy.
4. **Settings → Custom Domains → Add Custom Domain** →
   `hairbysha.kairobookings.com`. Wait for the green tick — that is Render
   issuing the certificate.
5. Now turn the Cloudflare proxy **on** for that record (orange cloud). That is
   the moment Cloudflare's filtering starts applying to this business at all.

Check the region. Render has no Australian region and Singapore is roughly half
the round trip of Oregon to Melbourne — every page load pays that difference.

## 4. Resend (email)

- Sign up as `hairbysha@kairobookings.com`.
- **Domains → Add Domain** → `hairbysha.kairobookings.com`.
- Copy the DKIM value it shows, run step 2 with `--dkim`, then hit **Verify**.
- Leave Resend's **inbound MX** option **off**. Kairo never reads incoming mail —
  `sendEmail()` only posts outbound — so an inbound route would collect messages
  nobody ever looks at.
- Create an API key.

## 5. ClickSend (SMS)

Sign up as `hairbysha@kairobookings.com`. Then pick a sender identity — there
are two paths and they trade off against each other, so offer the business both
rather than deciding for them:

**Alpha tag** — texts arrive from "HairBySha" rather than a number. Free to
register, but needs the business's ABN and legal name/address for ACMA. Nobody's
phone has to be verified. Collect the ABN during the setup call, alongside the
phone number and opening hours, and this is the better answer.

**A phone number** — works the same day. Shows a number rather than a name.

If the business isn't ready to decide, register **your own** number so their
keys work from day one, and record it as the starter (below) so Kairo keeps
asking them to replace it.

## 6. Your one pass through the app, before handover

Log in once as the admin account, go to **Settings**, and set:

| Where | What | Why it matters |
|---|---|---|
| Notifications | Resend API key | nothing sends without it |
| Notifications | From email — `hello@send.hairbysha.kairobookings.com` | must match the verified domain |
| Notifications | **Replies go to** — the owner's real inbox | mail is sent from a domain with no inbox; without this a client who hits Reply gets a bounce and nobody is told |
| Notifications | Your website address — `https://hairbysha.kairobookings.com` | every cancel link, review link, QR code **and the booking link the owner copies** is built from it. Skip it and they hand out the raw hosting URL, which works — which is exactly why nobody notices |
| SMS | ClickSend username + API key | |
| SMS | Sender name or number | |
| Business profile | Business email **and** phone | the owner's own booking alerts are email-only and silently off if the email is blank |
| Backups | confirm the address, then **Send one now** | see below |

Then hit the test buttons on the **Messages** page and watch both actually
arrive. Then log out.

**Better than setting the website address by hand:** put it on the Render
service as an environment variable instead —

```
KAIRO_PUBLIC_URL = https://hairbysha.kairobookings.com
```

It's already in the blueprint, so a business created from `--render` has it
from the first boot. Set that way it wins over the settings field, the field is
shown disabled with an explanation, and there is nothing for anyone to forget
after the fact. Changing it later is a Render → Environment edit, which
restarts the service on its own.

**And if it does get forgotten, it no longer stays quiet.** This is the one
setting that gets copied out of Kairo into places nobody can edit later — an
Instagram bio, a shopfront QR code, a print run of cards — and because the raw
hosting address *works*, nothing ever complains about it. So two things now say
so, without waiting for anyone to look:

- **In the deploy log**, on every boot, if the address customers are being given
  is still a hosting hostname (`.onrender.com`, `.up.railway.app`, `.fly.dev`,
  `.herokuapp.com`, `.vercel.app`, `.netlify.app`, `.ondigitalocean.app`) — or
  if nothing has been set at all on a hosted service.
- **In Settings**, directly beneath the booking link the owner copies, in place
  of the usual "this link never changes" note. If the address came from the
  wizard they get a button that takes them to the field; if it's pinned by
  `KAIRO_PUBLIC_URL` they're told to ask whoever set the system up, because the
  field is theirs to read and yours to change.

Neither fires on `localhost` with nothing configured — that is just how you run
it on your own machine, and a warning that cries wolf on every dev boot is a
warning nobody reads.

**If you lent them your number**, also set the starter sender so the app keeps
asking them to replace it:

```
Settings → SMS → Sender name or number:  +61412000111
```
and record the same value in `clicksend_starter_from`. Kairo compares the two on
every read: while they match, a banner appears in Settings asking the owner to
put their own sender in. The moment they change it, the banner is gone — there
is no flag to remember to clear, and no way for the app to claim it is resolved
when it isn't. Kairo has no access to their ClickSend account and cannot make
the swap for them; all it can do is keep saying so.

**Take one backup and confirm it lands in the inbox.** A backup that was never
tested is not a backup. The status line on that card is what you are proving.

Setting keys before handover is safe: the owner's own run through the setup
wizard, including its "start fresh" option, never touches the `settings` table.

---

## Handing over

The owner signs in, meets the guided setup wizard, and fills in their own
details, hours, services and team. They never see a key.

Tell them two things:

- Their booking link is **`https://hairbysha.kairobookings.com/book`**. The
  `.onrender.com` address keeps working forever, which is what makes it safe to
  move a business onto its own domain later — links already sitting in clients'
  text messages never break.
- Their password. They change it on first sign-in; until they do, Kairo says so
  on every screen.

---

## Optional, once they're settled

[SECURITY.md §6b](SECURITY.md) covers putting the business behind Cloudflare's
filtering properly:

```bash
node scripts/cloudflare-setup.mjs --domain kairobookings.com --host hairbysha.kairobookings.com
```

Dry-run first — it reports and changes nothing. It checks the three things that
are easy to get wrong by hand, and `--turnstile` will create the bot-check
widget and print both keys.
