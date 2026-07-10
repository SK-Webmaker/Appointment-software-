# Selling Kairo — the complete go-to-market playbook

You are not selling software; you are selling **fewer no-shows, a calendar that fills
itself, and money collected on time** — for a flat monthly price, under the business's
own brand.

---

## 1. The business model

**You run one Kairo instance per client and charge monthly.** You are a
micro-SaaS operator: the code is yours, there are no per-seat license fees to anyone,
and your unit cost is hosting (~$5–7/client/month).

| | Starter | Standard | Pro |
|---|---|---|---|
| Suggested price | **$29/mo** | **$49/mo** | **$79/mo** |
| Calendar + clients + billing | ✅ | ✅ | ✅ |
| Online booking page | ✅ | ✅ | ✅ |
| Email confirmations & reminders | — | ✅ | ✅ |
| SMS reminders | — | ✅ | ✅ |
| Card deposits (Stripe) | — | — | ✅ |
| Multi-location | — | — | ✅ |
| Setup + data import (one-time) | $99 | $99 | waived |

Margins: ~$22–72/client/month after hosting. Ten clients ≈ $300–700/mo recurring;
the pilot business is client #1 and should be discounted (or free for 60 days) in
exchange for a testimonial and referrals.

**Anchor against the competition:** Fresha's "free" plan takes ~20% commission on
new-client bookings and markets competing salons to their clients; Square is $29+
per staff member. "Flat price, your brand, your data" is the wedge.

## 2. Who to sell to first

Appointment businesses with 1–6 staff where no-shows hurt: hair salons, barbershops,
nail studios, lash/brow techs, massage & spa, tattoo artists, dog groomers, personal
trainers, tutors, cleaners with time slots. Best entry: businesses still on
**pen-and-paper, Instagram DMs, or WhatsApp** — you're not migrating them off anything,
you're giving them their evenings back.

## 3. The pitch (30 seconds)

> "You know how people book in your DMs and then just… don't show up? I set up booking
> systems for salons. Your clients book themselves from a link in your bio, they get a
> text reminder the day before, and if you want, they pay a deposit up front — so
> no-shows basically stop. Flat $49 a month, everything under your name, and I'll move
> your client list over for you. Want me to show you on your phone right now?"

Then open the **demo instance** on their phone: `/book` first (it's their customers'
experience), then the calendar.

## 4. The demo script (10 minutes, in person or screen share)

Before any demo: *Settings → Reset to demo data* so it always looks alive.

1. **Their problem first** — "How do bookings come in today? What happens when someone
   doesn't show?" (Let them say the pain out loud.)
2. **Booking page on their phone** — book an appointment as a customer in under 60
   seconds. Point out the deposit step if relevant: "That $15 is why they stop no-showing."
3. **The calendar** — "This is your front desk." Show today, drag an appointment to
   another time ("client called to push back an hour — done"), try to double-book so
   they see the warning.
4. **The reminder** — open Messages: "Every booking gets a confirmation now and a
   reminder the day before, automatically. This page proves what was sent."
5. **Checkout** — open an appointment → Checkout → invoice → record payment → Paid.
   "Card, cash, whatever — and it tracks who still owes you."
6. **The dashboard** — "After two weeks this tells you your busiest hours and what's
   actually making money."
7. **Close** — "I'll set it up this week: your services, your client list, your hours.
   You run it for two weeks. If it doesn't make your life easier, you owe me nothing."

**Objections you'll hear:**
- *"Fresha is free."* → "Free until you read the fees: ~20% of every new client they
  send you, paid texts, and your clients see other salons in their app. This is flat,
  and your client list is yours — export it any time."
- *"My clients just DM me."* → "They still can. The link goes in the same bio — the
  difference is they pick a slot themselves and get reminded. You stop being the
  receptionist at 11pm."
- *"Is my data safe?"* → "It's your own private system, not a shared marketplace.
  Passwords are encrypted, and I keep a nightly backup. You can have a full export
  whenever you ask."

## 5. Onboarding runbook — how you hand it to a client

Total ~1 hour of your time per client.

**Day 0 — deploy (20 min, no client needed)**
1. Deploy an instance (see § 6), e.g. `booking.luxehair.com` or `luxehair.yourbrand.app`.
2. Set admin email/password. Reset demo data.
3. Note the two URLs: workspace (for them) and `/book` (for their customers).

**Day 1 — setup call (30–40 min, with the owner)**
1. Settings: name, phone, address, hours, tax, currency.
2. Team: staff + colours (+ locations on Pro).
3. Services: type them in or import their price list CSV.
4. Clients: ask them to export from their old tool (or share their spreadsheet /
   contacts) → import CSV → show them the dedupe summary.
5. Standard/Pro: paste Resend/Twilio/Stripe keys, hit the test buttons together.
   (Open the accounts in *their* name where possible — deposits should settle to
   **their** bank, and you avoid holding client money.)
6. Book one real appointment together; send themselves the confirmation.

**Day 1 — go-live (10 min)**
- Booking link into Instagram bio, Google Business profile, WhatsApp auto-reply,
  Facebook page. Print a QR code for the front desk (any free QR generator).

**Day 14 — review (15 min)** — dashboard walkthrough, count ⚡ online bookings, fix
friction, ask for the testimonial + 2 referrals, convert pilot → paid.

**Ongoing (minutes/month per client)** — you are the support line: a monthly backup
check, occasional "how do I…" texts, and you push product updates when you add features.

## 6. Deployment options (per client)

**Option A — Render.com (recommended: all-browser, ~$7/mo/client)**
1. Render → New → Web Service → connect the GitHub repo.
2. Runtime Node; build command: *(leave empty)*; start command: `npm start`.
3. Add a **Persistent Disk** (1 GB) mounted at `/var/data`; env var `KAIRO_DATA_DIR=/var/data`.
4. Env vars: `KAIRO_ADMIN_EMAIL`, `KAIRO_ADMIN_PASSWORD` (first boot only).
5. Attach the client's subdomain (Render gives free HTTPS automatically).

> The persistent disk matters: it's where the SQLite database lives. Free-tier Render
> has no disk — fine for demos, wrong for a paying client.

**Option B — any $5 VPS (Hetzner/DigitalOcean)**
```bash
apt install -y nodejs npm caddy   # Node 22+
git clone <your-repo> /opt/kairo && cd /opt/kairo
KAIRO_ADMIN_EMAIL=owner@client.com KAIRO_ADMIN_PASSWORD=<strong> PORT=4820 npm start
# Caddyfile: booking.client.com { reverse_proxy localhost:4820 }  → free auto-HTTPS
```
Run it under systemd or `pm2` so it restarts on reboot; cron a nightly
`cp /opt/kairo/data/kairo.db /backups/kairo-$(date +%F).db`.

**Backups (non-negotiable for paying clients):** the entire business is one file,
`data/kairo.db`. A daily copy to object storage (or even emailed to yourself) is a
complete disaster-recovery plan.

## 7. The paperwork (keep it lightweight)

A one-page agreement: monthly price, what's included (hosting, backups, support,
updates), 30-day cancel-any-time, and **"your data is yours — full export within 48h
of request."** That last line closes deals. Invoice them with Kairo itself — you're
a service business too, and it's a great dogfooding story.

## 8. Your 30-day plan

- **Week 1:** onboard the pilot business (free/discounted). Fix friction daily. ✅ *You're here.*
- **Week 2:** collect the numbers — online bookings taken, reminders sent, revenue billed.
- **Week 3:** turn that into proof: 3 screenshots + one owner quote. Visit 10 nearby
  businesses with the pilot's story; demo on their phone; aim for 3 paid setups.
- **Week 4:** raise your setup fee, ask every client for 2 referrals, repeat.
