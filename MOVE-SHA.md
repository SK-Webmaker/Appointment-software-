# Hair By Sha — the runsheet

**Tuesday 16 September 2026.** One salon, already trading, moving from her own
Render service onto the shard. Written 12 September, after a full rehearsal on
the exact code she will land on.

Read *The three corrections* first. Two of them change what you actually click,
and one of them is the reason this file exists instead of `MOVE-DAY.md`.

---

## The three corrections

### 1. This is not a same-version move

Both her service and the shard report **v1.60.0**, and on 11 September that led
me to call this a same-version move. It is not. The version string has not been
bumped in 48 commits.

| | commit | |
|---|---|---|
| Her service today | `a623405` | *A clash is one stylist's diary* |
| The shard today | `2d68cfb` | the merge of that change into the shard |

Between them: **1,623 lines of runtime code** — `db` becomes a per-tenant proxy,
a `devices` table appears, `publicUrl()` prefers the address pinned in
`tenant.json`, `notify.js` gains the mute, `automations.js` moves its
once-a-day marker onto per-tenant state.

That sounds alarming and tests out clean. Booting **the same snapshot** on both
versions and comparing them gave **Identical: 37 checks** — the booking page,
the public info and the next fortnight of availability, staff by staff. So the
code differs and the behaviour does not.

The comparison was then falsified rather than believed: inserting one booking
inside opening hours on 13 September moved that day from 15 slots to 12, and the
comparison reported it. A check that cannot fail is not a check.

**What this changes:** nothing about the steps. It changes what "verified"
means, and it means `verify --across-versions` is expected to be needed.

### 2. The cutover is a Worker deploy, not a custom-domain swap

`MOVE-DAY.md` says to remove `hairbysha.kairobookings.com` from
`hairbysha-booking` and add it to `kairo-shard-au`. That was right before the
front door existed. **It is wrong now**, and following it would take her offline
for no reason.

Read `cloudflare/salon-router.js` beside `resolveHost` in `src/tenant.js`. For a
salon that has moved, the Worker sets `host` to the shard's own `onrender.com`
address and carries her real hostname in `X-Kairo-Host`. Render therefore routes
on the shard's own address, and the shard picks the salon out of the header:

```js
// src/tenant.js — resolveHost
const slug = host.slice(0, -suffix.length);   // hairbysha.kairobookings.com → "hairbysha"
if (slug.includes('.')) return null;          // a.b.<domain> is nobody
return getTenant(slug);
```

> **The shard needs neither her custom domain nor a `domains` entry.** The
> subdomain label *is* the slug. Her folder is called `hairbysha`, so
> `hairbysha.kairobookings.com` finds it with nothing else configured.

(`MOVE-DAY.md` also describes swapping the custom domain onto the shard to stay
under Render's 2-domain cap. That was written before the front door existed. The
cap does not apply to a salon reached through the Worker, because nothing about
her is registered with Render at all.)

What still routes her to her old service is one line in the Worker:

```js
const STILL_ON_THEIR_OWN_SERVICE = {
  'hairbysha.kairobookings.com': 'hairbysha-booking.onrender.com',
};
```

Deleting that line and deploying the Worker *is* the cutover. It takes seconds
and reverses in seconds.

**So: do not remove her custom domain from `hairbysha-booking`.** That
registration is what the passthrough path matches on, and the passthrough path
is the rollback. Removing it throws the rollback away to no purpose.

### 3. Her old service will keep sending unless it is stopped

Both copies run their own minute scheduler. The guard against messaging a client
twice is a unique index on `automation_sends`, which lives **inside one
database** and cannot see the other. Reminders fire at *appointment time minus
24 hours*, spread across the day — so there is no quiet window to rely on.

I proved this the expensive way on 12 September: rehearsing, I booted her real
database on her own code, and its scheduler delivered four queued reminders to
four real clients — two emails, two SMS, all confirmed delivered by Resend. One
went to a client who had cancelled. Her code has no mute; the shard's does, and
the muted copy skipped those exact four messages.

**So:** the copy is imported **muted**, unmuted only at the cutover, and her old
service is **suspended** the moment the Worker flips.

---

## Before the night

**Mine to have ready.**

```
KAIRO_SHARD_URL=https://kairo-shard-au.onrender.com
KAIRO_PLATFORM_KEY=…            # the value set on kairo-shard-au
```

I have both in this session and checked them against the live shard on
12 September — they work. **But this container is temporary and may be
reclaimed before Tuesday**, taking the key with it. Have it to hand so you can
give it to me if I ask; do not assume I will still have it.

The same check confirmed the shard is ready for her:

| | |
|---|---|
| Shard | `v1.60.0`, multi-tenant, healthy |
| Salons on it | `demo`, `horahaircutz` |
| `hairbysha` | **not taken** — the import will not be refused |
| Hora | unmuted, not read-only, serving at his own address |

**Leave the shard alone.** It is pinned at `2d68cfb`, auto-deploy is already
off, and that is the code Hora has been live on since 10 September without
incident. Do not deploy the shard before Tuesday. A move onto code that has
served a real salon for six days is a much better bet than a move onto code
whose first customer is Sha.

**Yours to have open:** the Cloudflare dashboard (Workers) and the Render
dashboard. The Cloudflare API tokens were deleted on 9 September, correctly, so
the Worker deploy is a dashboard job.

**Tell Sha:** roughly fifteen minutes with her booking page off, at a time
nobody is booking — midnight worked for Hora. Ask her not to add or change
anything in Kairo during the window. That is the only thing that can make the
two copies differ.

---

## The night, in order

Times are the whole window, not each step.

### Phase 1 — Freeze · Sha or you · 2 min

1. Her Kairo → **Settings → Online booking → Off**
2. Then **Settings → Backup → Download**, and send me the file

In that order. Online booking is the only thing that writes to her salon with
nobody present, so switching it off is enough of a freeze and needs no deploy.
The backup is the same button she would press herself, and I move the file you
hand me rather than one I fetched with her password.

### Phase 2 — Copy, muted · me · 5 min

```
node scripts/move-tenant.mjs --slug hairbysha \
  --from <her backup>.db.gz \
  --old https://hairbysha.kairobookings.com \
  --muted
```

`--muted` is not optional. Until the Worker flips, her old service is still the
live one, and an unmuted copy on the shard is the second sender described in
correction 3.

**The gate.** All of these, or stop:

- `verify` — 38 checks, every row, every cent, every setting
- `verify --across-versions` — only ever the four known rows: the added
  `devices` table (empty), two settings-count rows, the version stamp
- `compare` — **0 differences**

On 12 September the rehearsal showed 2 availability differences. Those were the
snapshot being four days stale — one booking taken since accounts for 13
September exactly. **A snapshot taken minutes earlier has no such excuse. On
Tuesday this must be zero. If it is not, stop and read it.**

Then, before unmuting, check nothing in her queue is already overdue:

```
node -e "…"   # or just look: messages where status='queued' and send_after <= now
```

Her old service has been running right up to the snapshot, so anything due has
already gone out and this should be empty. If it is not, those messages will
send the instant the copy is unmuted — as duplicates.

### Phase 3 — Cutover · 2 min

3. **I say, in plain words, that the copy is verified.** If I have not said it,
   nothing below happens.

4. Me — unmute, and prove it took:

   ```
   node scripts/shard-mute.mjs --slug hairbysha --off
   ```

   It must print **unmuted**. If it says the salon has no way to send email at
   all, stop: that is her Resend settings not having travelled, and it means no
   confirmations for anyone who books.

   On *this* shard it will also say the sending side is **unverified**, and
   that is expected rather than a fault: `2d68cfb` predates the field that
   reports how a salon sends, so the shard genuinely cannot answer. The script
   says so instead of printing a reassurance it has not earned. The thing that
   proves it either way is the confirmation email in Phase 4 — which is why
   that step is not optional.

   Unmute happens *before* the flip, deliberately. Muted messages are marked
   **skipped**, not queued — so a booking that lands while she is still muted
   loses its confirmation permanently. A few seconds of the shard being unmuted
   before it is reachable costs nothing at a quiet hour.

5. You — **Cloudflare → Workers → the salon router → Edit code.** Delete these
   three lines so the object is empty:

   ```js
   const STILL_ON_THEIR_OWN_SERVICE = {
     'hairbysha.kairobookings.com': 'hairbysha-booking.onrender.com',   ← delete this line
   };
   ```

   **Save and Deploy.** This is the cutover. Her address now reaches the shard.

6. You — **Render → `hairbysha-booking` → Settings → Suspend Service.**

   This stops her old service's scheduler. Do not skip it and do not leave it
   for the morning: the next reminder due is the next appointment minus 24
   hours, which can be any minute. Suspending keeps the disk, so the rollback
   still works.

   **While you are on that page, check one thing I could not:** that
   `hairbysha.kairobookings.com` is *still listed* under the suspended service's
   Custom Domains. Suspension is documented to keep configuration, and I have
   not tested whether it releases a domain — the only way to find out is to do
   it. If the domain has gone, say so before we go any further: the rollback in
   the next section assumes it is there, and would need re-adding first.

### Phase 4 — Prove it · you · 5 min

7. Book yourself in through her public page, as a customer would
8. Check it lands in her calendar **and the confirmation email arrives**
9. Cancel it, remove the test client
10. **Settings → Online booking → On**

Step 8 is the one that matters. Everything before it proves the data copied;
only this proves the salon *works*, which is a different question and the only
one Sha cares about on Wednesday morning.

---

## Rollback

Three steps, and **the order matters** — the Worker must not be pointed at a
suspended service.

1. **Render → `hairbysha-booking` → Resume.** Wait for it to report live, 1–2
   minutes.
2. **Cloudflare → Worker →** put her line back → **Save and Deploy**.
3. Me: `node scripts/shard-mute.mjs --slug hairbysha --on`, so the shard copy
   cannot send alongside her again.

Her old service keeps her data untouched the whole time — nothing in this
runsheet writes to it.

If anything was written on the shard between the snapshot and the rollback, it
is recoverable rather than guessed at:

```
node scripts/migrate-tenant.mjs since --slug hairbysha --since "<UTC of the snapshot>"
```

That lists every appointment, client, payment and message written after that
moment, to be re-entered by hand on her old service.

---

## Afterwards

- Leave `hairbysha-booking` suspended, with its disk, for **two weeks**. It is
  the rollback for as long as it exists, and it costs a suspended instance.
- Delete her line from `cloudflare/salon-router.js` in the repo too, so the file
  matches what is deployed.
- **Hora's old service has the same problem and has not been suspended.** It is
  still running, still holds his data, and by the mechanism in correction 3 it
  has been *able* to send reminders to his clients since 8 September. Online
  booking is off there, which stops new bookings and does nothing about
  reminders.

  Whether it actually has is **not established**. Render returns no logs for
  that service to this account, and the one query that would settle it reads a
  live business's message history, which needs a decision rather than an
  assumption:

  ```
  GET https://horahaircutz-booking.onrender.com/api/messages?limit=200
  ```

  counting rows with `status = 'sent'` and `sent_at >= 2026-09-08`. Any at all
  means his clients have been getting doubles for a week; none means the risk
  stayed theoretical.

  Either way, suspending that service is the same one-click fix as Sha's and
  his move is six days proven. Do it whether or not the query gets run.
