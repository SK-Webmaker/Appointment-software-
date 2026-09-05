# Phase 5 — Hair By Sha and Horahaircutz, with no interruption

*Status: plan for the owner's approval. Nothing here has been done. Both
salons are live and untouched.*

The one hard constraint of the whole brief applies here most of all: *these
two businesses take real bookings from real customers every day; they must
keep working, uninterrupted, through everything.*

---

## 0. What "moving" means, in one paragraph

Today each salon is its own Render service with its own disk. After Phase 6
the shared service (the "shard") exists, tested, in Singapore. Moving a salon
means: **copy its single database file into a folder on the shard, prove the
copy is complete, and change the one Cloudflare record that says where its
address points.** The old service is not modified, not stopped and not
deleted during the move; it keeps running with the salon's data for a week
afterwards. Going back is changing the same record back.

Because both the old service and the shard sit behind Cloudflare's proxy,
customers never see a different IP address: the switch happens inside
Cloudflare and takes effect in seconds, with no DNS caching anywhere in
between.

## 1. Preconditions — none of this starts until all are true

1. The shard runs the tenant-capable Kairo (Phase 6 slice 2) and its tests
   pass, including the two-tenant isolation suite (Phase 2b §4).
2. The **demo tenant** has run on the shard for at least a week.
3. A **rehearsal migration** of each salon has been done on a *copy* of its
   data (§3) and every check in §4 passed.
4. `KAIRO_READ_ONLY` (a small new maintenance mode, §2) is deployed to the two
   old services as part of the same release — in single-tenant mode nothing
   else about them changes.
5. The owner has agreed a quiet window with each salon (§5) and the salon
   knows what to expect.
6. A fresh downloaded backup of each salon exists off Render, and the
   off-site nightly copy is running.

## 2. One small addition to Kairo first: a maintenance switch

Kairo has no way to be told "take no new bookings for five minutes". The move
needs one, and it is useful forever. `KAIRO_READ_ONLY=1` in the environment
(or the tenant's registry row) makes every write to the API answer
`503 — back in a few minutes` with a friendly banner on the booking page and
in the workspace, while every read keeps working. Tested like everything
else: a booking attempt under the flag must fail; without it must succeed;
the test is broken on purpose and must fail.

## 3. The rehearsal — on a copy, weeks before

For each salon, using the owner's existing access and **no change to the
live service**:

1. **Settings → Backups → Download a copy** on the live salon (the existing
   `VACUUM INTO` snapshot; safe while people book).
2. Load it into a tenant folder on the shard under a rehearsal address that
   nobody has (`rehearsal-hairbysha.kairobookings.com`), plan status
   *rehearsal*, messaging **disabled at the registry level** so the rehearsal
   can never email or text a real client (a new registry flag: `muted`).
3. Run the whole §4 checklist against it, including signing in as the owner
   with a temporary password set through the control API (the real password
   hash is copied unchanged for the real move; the rehearsal uses a throwaway).
4. Delete the rehearsal tenant.

Do it twice for Sha, once for Hora. If anything surprises, fix it and repeat.
The rehearsal is where a Friday-6pm problem is found on a Tuesday afternoon.

## 4. What "complete and correct" means — the verification checklist

Run by `scripts/migrate-tenant.mjs --verify`, and read by a human:

| Check | Pass condition |
|---|---|
| Row counts, every table (26 tables) | identical between source snapshot and tenant |
| Sums of money: `payments.amount_cents`, `invoice_items.qty*unit_cents` | identical to the cent |
| Newest appointment id, newest message id, newest invoice number | identical |
| Every setting key present, secrets present and non-empty where they were (Resend key, ClickSend key, Stripe key) | identical count and `_set` flags |
| Owner user row: email, password hash, salt, token_version | identical (their password keeps working; their session cookie does *not* — signed with the same secret, host unchanged, so actually it **does** keep working; verified either way) |
| Business time zone, public URL, from-address | as before (Sha's own-domain From is unchanged; nothing about Resend moves) |
| Booking page renders with the same services, staff and open dates as the live one | side-by-side JSON compare of `/api/public/info` |
| Availability for the next 14 days | identical slot lists per staff per day |
| Scheduler for the tenant | queued messages visible; a test message queued and delivered from the tenant's own Resend to the owner |
| Backups | the tenant's weekly emailed backup shows the right recipient and size |
| File size | within 1% |

Only when every row says pass does the plan proceed.

## 5. The move — one salon at a time

Order: **demo tenant** (already done in Phase 6) → **Horahaircutz** (newer,
smaller, same region, owner reachable) → one week later → **Hair By Sha**.

The window: a time the salon is closed and not about to open — e.g. Sunday
evening; agreed with the salon owner and confirmed the day before. **Never a
Friday.** Expected write-unavailability: three to five minutes. Read
availability (the booking page loading, the owner viewing the calendar):
uninterrupted.

| Step | Action | Who | Time |
|---|---|---|---|
| 0 | Message the salon: *"tonight 9–9:30pm the booking page will say 'back in a few minutes' for about five minutes; nothing else changes"* | owner | day before |
| 1 | Take a downloaded backup and store it off Render | owner / script | T−10 min |
| 2 | Set `KAIRO_READ_ONLY=1` on the old service (Render → Environment; restarts in ~30 s). Writes now refuse with the friendly message; reads continue | owner | T |
| 3 | Confirm read-only from outside (a booking attempt gets 503; the page loads) | script | T+1 |
| 4 | Take the **final** snapshot via the backup endpoint; load it into `tenants/<slug>/`; write `tenant.json` (public URL, plan *active*, price paid *legacy*, created-at = their original) ; insert registry row | script | T+2 |
| 5 | Run §4 verification against the final snapshot. **Any fail → stop; remove `KAIRO_READ_ONLY`; nothing has moved; try another night** | script + owner | T+3 |
| 6 | Cloudflare: change the salon's CNAME target from `<slug>-booking.onrender.com` to the shard's `onrender.com` host (or, equivalently, delete the explicit record so the wildcard applies). Proxied, so it takes effect in seconds | script | T+4 |
| 7 | Verify live: `/api/version` and `/api/public/info` at the salon's address now come from the shard (a response header names the shard); booking page loads; sign in as the owner (their own credentials, with permission, or the owner watches them do it); make and cancel a test booking; see the confirmation email arrive via *their* Resend; check the Messages page | owner + script | T+5 |
| 8 | Leave the old service **running, read-only**, for **7 days** | — | — |
| 9 | Next morning: the salon owner confirms the diary looks right and messages are arriving. Owner checks the tenant's dashboard, message log, backup status | salon owner + owner | T+12 h |
| 10 | After 7 days with no issue: **suspend** the old service (disk kept). After 30 days: archive its final snapshot off-site, then delete the service and disk | owner | T+7 d, T+30 d |

Sha's move also takes her from Oregon to Singapore: every page load gets
faster. Her Render service's stale build command and missing health check
become irrelevant. Her own-domain email is untouched because nothing about
Resend moves; only the file moves.

## 6. Rollback — what to do when it goes wrong

The rule: **rollback is decided by a checklist, not by nerves.** Roll back if,
after step 6, any of these is true and cannot be fixed within 15 minutes:

- the booking page does not load at the salon's address, or shows the wrong
  business;
- the owner cannot sign in;
- the calendar shows different appointments from the old service;
- a test booking does not appear, or its confirmation has not sent within 15
  minutes;
- anything in the §4 checklist fails against the live tenant.

**Rollback, in order (5 minutes, one person):**

1. Cloudflare: point the CNAME back at `<slug>-booking.onrender.com`. Seconds.
2. Remove `KAIRO_READ_ONLY` from the old service. It restarts (~30 s) and
   takes writes again. **The salon is now exactly where it was before T**,
   plus whatever the world did in the last few minutes.
3. Mark the tenant *suspended* in the registry so its address serves nothing
   even if reached by the raw shard host.
4. **Reconcile:** anything written on the shard between step 6 and the
   rollback — new bookings, cancellations, messages — is listed by
   `migrate-tenant.mjs --since T` and re-entered on the old service through
   its API (the same calls the app makes), or, if it is a handful, by hand
   with the salon owner. In a Sunday-night window this is normally zero.
5. Write down what failed. Fix it. Rehearse again. Try another night.

**The Friday-6pm version.** Suppose the problem is not noticed until Friday
evening, five days after a Sunday move, with the salon's busiest day
tomorrow. The old service is still running, read-only, with Sunday's data.
Rolling back to it would lose a week of bookings, so **that is not the
rollback**. The rollback at that point is the shard's own safety net: Render's
daily disk snapshot (restores the whole shard, so only for a shard-wide
failure), the tenant's nightly off-site file copy (restore *this salon* to
last night in one file copy), and the emailed weekly backup. The decision
rule for that case: restore the tenant's file from the most recent copy that
is known good, re-enter today's bookings from the message log, and keep the
service up. The old service is only for the first 72 hours; after that the
shard's backups are the plan — which is why they must be proven (§1.6)
before anyone moves.

## 7. What the salon owners see

- The day before: one message saying five minutes of "back in a few
  minutes" that evening.
- The morning after: *"Done. Nothing has changed for you or your clients:
  same address, same login, same everything. It's now on newer, faster
  hosting. The app is coming next."* And, for Hora: *"while we're here, your
  business phone isn't set in Settings — add it so cancellation emails can
  tell clients who to ring."*

## 8. What this phase produces

- `scripts/migrate-tenant.mjs`: snapshot → tenant folder → verify → (later)
  `--since` reconciliation listing. Dry-run by default, like every script in
  this repo.
- `KAIRO_READ_ONLY` maintenance mode, tested.
- The `muted` registry flag for rehearsals.
- Two rehearsal reports and two move reports, kept in this folder.

---

## Amendment, 2026-09-05 — the owner's window for Sha

- **Sha does not work Mondays or Tuesdays.** Her move happens on a **Monday**,
  in a slot the owner picks (early morning before 8 am, or after 9 pm, when
  online bookings are rarest). Hora moves on the Monday before.
- **Downtime budget: 10 minutes maximum, target 3–5.** Only *writes* stop —
  a customer pressing *Confirm booking* sees "back in a few minutes, please
  try again", and the owner's edits are refused for that window. The booking
  page, the calendar, every read keeps working throughout. If step 5's
  verification is not green by minute 8, the move is abandoned for the day
  by removing `KAIRO_READ_ONLY`; nothing has changed for Sha.
- **Order of events is unchanged:** Phase 6 builds and tests the shared
  service, the maintenance switch and the migration script; the demo tenant
  runs for a week; each salon is rehearsed on a copy; *then* the first
  Monday. The move is the last thing that happens, not the first.
