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

### The thing that would break Hair By Sha

A route of `*.kairobookings.com/*` catches **every** salon, including ones
still running on their own Render service. Forwarding those to the shard would
answer *"no such salon"* for a working business.

So the Worker holds a short list, `STILL_ON_THEIR_OWN_SERVICE`, and sends
those straight to their own origin with the Host untouched — exactly what
Cloudflare does today, so nothing about them changes. `hairbysha` is in it.

**Delete her line the moment she moves**, and not before. Leaving it there
after a move sends her customers to a copy nobody is reading; removing it
early sends them to a salon that is not there yet.

## Checking it

Run these against the live front door. Every line is what was actually
observed on 8 September, after the Worker went in.

```bash
# a salon on the shard, through the Worker
curl -s https://demo.kairobookings.com/api/public/info          # Luxe Hair Studio
curl -s https://horahaircutz.kairobookings.com/api/public/info  # Horahaircutz

# an address that names nobody
curl -s -o /dev/null -w '%{http_code}\n' \
  https://nosuchsalon.kairobookings.com/api/public/info         # 404

# Hair By Sha, still on her own service and untouched
curl -s https://hairbysha.kairobookings.com/api/version         # {"version":"1.55.0"}
```

### The forgery check

A visitor can put `x-kairo-host` on their own request. The Worker overwrites
it, so it never reaches the shard as sent. Every one of these must answer with
the **demo** salon — never Horahaircutz, never Hair By Sha:

```bash
for h in '' 'x-kairo-host: horahaircutz.kairobookings.com'; do
  curl -s ${h:+-H "$h"} https://demo.kairobookings.com/api/public/info
done
```

Also with a wrong secret, a truncated secret, a secret with one character
added, and — the case that looks alarming and is not — the *real* forward
secret. All nine variants answer *Luxe Hair Studio*, because `headers.set()`
in the Worker replaces whatever arrived rather than appending to it.

### Do not expect a 404 from the shard's own address

An earlier version of this file claimed that

```bash
curl -H 'x-kairo-host: hairbysha.kairobookings.com' \
     https://kairo-shard-au.onrender.com/api/public/info
```

must return 404. **It returns the demo salon**, and that is correct. The
forged header is ignored, so the request routes by the real `Host` —
`kairo-shard-au.onrender.com` — which is registered to `demo`. Seeing a salon
name there is the mechanism working, not failing. What proves it is *which*
salon: the demo one, never a real business.

The genuine no-such-salon case is a forwarded host that names nobody, sent
with the correct secret:

```bash
curl -H 'x-kairo-host: nobody.kairobookings.com' \
     -H "x-kairo-forward-secret: $KAIRO_FORWARD_SECRET" \
     https://kairo-shard-au.onrender.com/api/public/info
# {"error":"No salon at this address"}   http 404
```

Confirmed alongside `unregistered.example.com` and `a.b.kairobookings.com`,
which also 404 — the shard never falls back to "some" tenant.

### Proving the check can fail

A check that cannot fail is not a check. Two things establish that the forgery
probes above would have caught a real leak:

1. The probe can see a different salon at all —
   `https://horahaircutz.kairobookings.com/api/public/info` returns
   *Horahaircutz*, so the test would show a different name if one leaked.
2. The header is genuinely live on the shard — sent **directly** to
   `kairo-shard-au.onrender.com` with the correct secret, `x-kairo-host`
   switches the answer between *Horahaircutz* and *Luxe Hair Studio* at will.

So the forged requests do not fail because the header is inert. They fail
because the Worker strips them, which is the property being tested.
