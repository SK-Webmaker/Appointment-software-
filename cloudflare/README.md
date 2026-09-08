# The front door

One Cloudflare Worker sits in front of every salon address and forwards it to
one Kairo shard. It exists because Render's wildcard custom domain does not
work on this account, and because Render's plan caps how many custom domains a
workspace may have — a cap that a platform meant to hold many salons cannot
live inside.

## Why the wildcard failed, recorded so nobody retries it

`*.kairobookings.com` was added to `kairo-shard-au`, all three DNS records were
correct, and Render reported **Verified** and **Certificate Issued**. It still
answered Cloudflare **Error 1000 — DNS points to prohibited IP** for every
`x.kairobookings.com`, from a clean network as well as from here.

Error 1000 means Cloudflare resolved the hostname and found a Cloudflare IP.
Render's edge *is* behind Cloudflare (`…origin.onrender.com.cdn.cloudflare.net`
→ `216.24.57.x`), so a salon hostname pointed at Render resolves to a
Cloudflare IP and Cloudflare refuses it as a loop. The two salons that work
avoid this only because each is an **explicit** custom hostname on Render,
which is exactly what the cap limits.

## How this replaces it

```
customer → x.kairobookings.com → Cloudflare Worker
                                    ↓ Host: kairo-shard-au.onrender.com
                                    ↓ X-Kairo-Host: x.kairobookings.com
                                    ↓ X-Kairo-Forward-Secret: …
                                 the shard → that salon's database
```

Render only ever sees its own hostname, which it always answers for, so **no
custom domains are needed at all** and there is no cap. Adding a salon is
creating a folder, as it was always meant to be.

## The one dangerous part

`X-Kairo-Host` decides whose client list is served. Anyone who could set it at
will could read any salon from any address, so the shard believes it **only**
when `X-Kairo-Forward-Secret` matches `KAIRO_FORWARD_SECRET` in its
environment, compared in constant time. Without a match the header is ignored
entirely — not refused, so a stray header can never break a normal request.

With no `KAIRO_FORWARD_SECRET` set the mechanism is off completely, which is
the state of every deployment that has not been deliberately changed. That
case is worth its own attention: "no secret configured" and "no secret sent"
are both empty, and an empty string equals an empty string, so the comparison
must never be reached. It is not, and a mutation that lets it be reached is
caught by the suite.

See `effectiveHost` in [`src/tenant.js`](../src/tenant.js) and the four tests
under *a shard behind a front door* in
[`test/tenants.test.js`](../test/tenants.test.js), including one that tries to
walk from one salon into another.

## Setting it up

1. **On the shard** (Render → `kairo-shard-au` → Environment): add
   `KAIRO_FORWARD_SECRET` with a long random value.
2. **Cloudflare → Workers & Pages → Create → Worker**: paste
   [`salon-router.js`](salon-router.js).
3. **Worker → Settings → Variables**, both as *Secret*:
   - `SHARD_ORIGIN` = `https://kairo-shard-au.onrender.com`
   - `FORWARD_SECRET` = the same value as step 1
4. **Worker → Settings → Domains & Routes → Add route**:
   `*.kairobookings.com/*` on the `kairobookings.com` zone.
5. The `*` DNS record must exist and be **Proxied (orange)** so the Worker
   runs. Its target no longer matters — the Worker replaces the origin — but
   `kairo-shard-au.onrender.com` keeps it honest.

**Leave `hairbysha` and `horahaircutz` alone.** They are explicit custom
domains on Render and they work. A route is more specific than the wildcard
only if you make it so; these two keep their own records and their own path
until they are deliberately moved onto the Worker.

## Checking it

```bash
curl https://demo.kairobookings.com/api/public/info      # a salon on the shard
curl https://nosuchsalon.kairobookings.com/api/public/info   # must be 404
```

And the check that matters, which must return **404**, not another salon:

```bash
curl -H 'x-kairo-host: hairbysha.kairobookings.com' \
     https://kairo-shard-au.onrender.com/api/public/info
```
