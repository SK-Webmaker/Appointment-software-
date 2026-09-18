# Do this next

Written 18 September 2026. Five things, in this order. Each one says what to
click, what to send me, and what I do with it.

Nothing here touches Hair By Sha or Horahaircutz. They run on
`kairo-shard-au`. Steps 1-3 all change `kairo-platform`, which is a different
Render service. Restarting it cannot interrupt a booking, because no salon is
served from it.

---

## Step 1 — Recreate the Cloudflare token (2 minutes)

The token you sent works, but it has a start date of 20 September on it, so it
refuses every call until then:

    "not_before": "2026-09-20T00:00:00Z"
    "This API Token can not be used before 2026-09-20 00:00:00+00"

That is a field in the Create Token form, not a mistake in the key.

1. Go to <https://dash.cloudflare.com/profile/api-tokens>
2. **Create Token**
3. Find **Edit zone DNS** and press **Use template**
4. Under **Permissions**, change the one row to:
   - `Zone` · `Email Routing Rules` · `Edit`
5. Under **Zone Resources**:
   - `Include` · `Specific zone` · `kairobookings.com`
6. Under **TTL** — **leave Start Date and End Date completely empty.**
   This is the whole fix. An empty TTL means "valid now".
7. **Continue to summary** → **Create Token**
8. Copy the token and send it to me.

**Then I:** verify a destination address, add the `support@` rule, take the
catch-all off Drop, and send a real message to `support@kairobookings.com` that
I confirm *arrived* — not one Cloudflare merely accepted. Accepted is not
delivered; that has caught us three times on this project.

If you would rather not, the token starts working by itself on 20 September and
I will do it then. But Apple checks the support address during review, so it
wants to be working before you submit.

---

## Step 2 — Set the operator password (3 minutes)

The platform says so on every boot:

    !  PLATFORM_OPERATOR_PASSWORD is not set — the queue cannot be opened

Without it you cannot open `/operator`, which is where refund requests,
disputes and failed provisioning land. A salon could pay and get stuck with
nobody able to see it.

1. Go to <https://dashboard.render.com> → **kairo-platform** → **Environment**
2. **Add Environment Variable**
   - Key: `PLATFORM_OPERATOR_PASSWORD`
   - Value: a password **you** choose
3. **Save, rebuild, and deploy**

**Choose it yourself and do not send it to me.** I have no reason to hold it and
you should be able to lock me out of your own queue. Use your password manager.
Twenty characters or more, not reused from anything.

**Then I:** confirm the boot banner has stopped warning, and that `/operator`
rejects a wrong password.

---

## Step 3 — Switch Stripe to live (15 minutes)

Do this only when you are ready to take real money. Until then the sandbox is
proven and fine.

### 3a. Get the live key

1. <https://dashboard.stripe.com> → turn the **Test mode** toggle (top right) **off**
2. **Developers** → **API keys**
3. Under **Secret key**, press **Reveal live key**
4. Copy it. It starts `sk_live_`

**Do not paste this one to me.** A live secret key can move real money out of
your account. You put it into Render yourself in step 3c. Test keys were fine
to share; this one is not.

### 3b. Create the live webhook

Still with Test mode **off**:

1. **Developers** → **Webhooks** → **Add endpoint**
2. Endpoint URL — exactly this:

       https://kairo-platform.onrender.com/api/stripe/webhook

3. **Select events** — tick exactly these two:
   - `checkout.session.completed`
   - `charge.dispute.created`
4. **Payload style** — choose **Snapshot**, not Thin.
   This matters. The handler reads `event.data.object.payment_status`, and a
   Thin payload does not carry it, so provisioning would silently never fire.
5. **Add endpoint**
6. On the endpoint page, **Signing secret** → **Reveal**. It starts `whsec_`
7. **Send me this one.** A webhook secret only verifies that a message came
   from Stripe. It cannot move money.

### 3c. Put both into Render

1. <https://dashboard.render.com> → **kairo-platform** → **Environment**
2. Change `STRIPE_SECRET_KEY` to the `sk_live_…` from 3a
3. Change `STRIPE_WEBHOOK_SECRET` to the `whsec_…` from 3b
4. **Save, rebuild, and deploy**

Both must change together. A live key with a test webhook secret means every
real payment is rejected at the signature check and no salon is ever created.

**Then I:** confirm the boot banner is clean, that the platform is on a live
key, and that a bad signature is still rejected.

### 3d. The real purchase

Buy Kairo yourself with a real card, the way a customer would. It is the only
test that proves the live path. It costs you the Stripe fee on $410 — roughly
$12 — and I will tell you when to refund.

**Then I:** verify the same chain I verified for the sandbox — signature
verified, `payment_status: paid`, tenant built, booking page answering, login
working. Then you refund it from the Stripe dashboard and I confirm the refund
landed and the test salon is cleaned up.

---

## Step 4 — Apple (when the email arrives)

Nothing to do until Apple confirms the account. When it does, send me the
confirmation and I will walk you through:

- registering App ID `com.kairobookings.kairo`
- the four GitHub secrets
- the APNs key on the shard

Reviewer sign-in is already prepared: `demo@kairobookings.com` against the demo
salon, which has data in it so the reviewer does not open an empty app.

---

## Step 5 — Rotate every credential (do last)

These have all passed through a chat transcript and need replacing once
everything above works. Do not do it earlier — rotating mid-setup will break
the thing you are trying to verify.

| Credential | Where | Why it matters |
|---|---|---|
| `KAIRO_PLATFORM_KEY` | Render, both services | **Most urgent.** Can export any salon's database, including Sha's and Hora's |
| Resend full-access key | Resend dashboard | Can send mail as you |
| Resend sending key | Resend dashboard | Can send mail as you |
| `CLICKSEND_API_KEY` | ClickSend dashboard | Can spend your SMS credit |
| Cloudflare token | Cloudflare | Can change your email routing |
| `STRIPE_SECRET_KEY` (test) | Stripe | Low risk, but replace it anyway |

`KAIRO_PLATFORM_KEY` has to change on `kairo-platform` **and** `kairo-shard-au`
in the same sitting, because it is the shared secret between them. Change one
and the platform can no longer create salons. I will talk you through the order
so there is no window where they disagree.

---

## What is already done

- Sandbox purchase verified end to end: signature → `paid` → tenant built →
  booking page answering → login working
- Live legal text: seller is Shamalka Kiridena throughout, "Kairo Bookings"
  gone as an entity, "including GST" gone
- Shared sending proven in production
- SMS honesty fix — ClickSend can no longer report success while queueing
  nothing
- Reviewer sign-in prepared with demo data
- 307 tests, 127 mutations
