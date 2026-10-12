---
name: website-sale
description: Selling small-business websites built in Lovable, paid by Stripe payment link (AUD). Two plans, both hosted by us. "setup": A$350 today (includes first year of hosting and domain), then A$20/year from month 12. "managed": A$550 + A$24.99 first month today, then A$24.99/month with unlimited routine updates. Use when the owner says "new website for <business>", "send <business> the payment link", "check website payments", "set up <business>" or "update <business>: <change>".
---

# Website sales: two plans (prices in AUD)

The website hand-off (ZIP) option is retired. Every site now stays hosted by us, on the client's own domain.

| Plan | Today | After that | Content changes |
|---|---|---|---|
| `setup` (Website Setup) | A$350, includes year 1 hosting + domain registration | A$20/year "Annual Domain and Infrastructure", first charged 365 days after checkout | Small updates A$25 each |
| `managed` (Website + Ongoing Management) | A$574.99 (A$550 setup + A$24.99 month 1) | A$24.99/month | Unlimited routine updates to existing content. New pages, redesigns and new features quoted separately |

In both plans the domain is registered to the client and belongs to them. Ask the owner which plan if they don't say.

**Reusable links** (the owner sends these to any client; checkout asks for "Business name"):
- Website Setup: https://buy.stripe.com/fZu8wO0rQ2Xp5mE7o6cfK05 (plink_1UPbgAA3ztX1T5c45DZrNWEw)
- Website + Ongoing Management: https://buy.stripe.com/fZu6oGcayfKbbL25fYcfK06 (plink_1UPbh3A3ztX1T5c4GEzz0oPW)

Retired (switched off 2026-10-12, never reactivate): the A$350 hand-off link and the A$550 + A$30/month link.

Scripts live next to this file. Stripe calls go to `api.stripe.com`; the environment adds the
owner's restricted key automatically, so never ask for, print or store a key. The key is LIVE.

## 1. Intake (owner tells you about the business)
You need: business name, what they do, suburb/city, phone, email, opening hours, socials,
style/vibe, any must-have sections, **real photos** (or permission to use free stock), the client's email.
Ask once for anything missing. Do not invent prices, reviews, awards or follower counts.

## 2. Build in Lovable (uses the owner's Lovable credits)
`create_project` in workspace "sachi's Lovable" with this in the first message, then iterate with `send_message`:
> Simple marketing website for <business>. No login, no database, no forms that need a backend
> (contact = tap-to-call, mailto, Google Maps link, socials). Never mention Lovable anywhere visible:
> page titles, meta tags, social preview image, favicon. Social/canonical URLs use https://<client-domain>/.
Then send the owner the `preview_url` to show the client.

Before a site is sold, it must have: real photos (no "photo to come"), working buttons/links,
real contact details, and no placeholder text.

## 3. Payment
Usually the owner sends a reusable link above. For a link with the client's name on it (one sign-up only):
```bash
.claude/skills/website-sale/stripe-link.sh "<Business Name>" <client@email> setup     # or: managed, monthly-<dollars>
```
Switch off a mistaken or old link at once: `stripe-mark-delivered.sh <plink_id> retired`.

## 4. Check payments (when the owner asks)
```bash
.claude/skills/website-sale/stripe-check.sh   # read-only
```
Reusable links print one `PAID <session> <plan> <business> <email>` line per payment. Match the business name to the client.

## 5. Go live after payment (both plans)
1. Publish the Lovable project, then connect the client's domain in Lovable (Project → Settings → Domains;
   needs the owner's paid Lovable plan). Register the domain in the client's name; give the owner the
   DNS steps Lovable shows, to pass on if the client registers it themselves.
2. Single-sign-up links only: `stripe-mark-delivered.sh <plink_id>`. Never run it on the reusable links.
3. Tell the owner, in one line: "<Business> is live at <domain>."

## 6. Changes
- `managed`: when the owner relays a request ("update <business>: <change>"), `send_message` to that Lovable
  project, check the preview, publish, confirm in one line. Included: routine updates to existing content
  (text, photos, hours, prices). New pages, redesigns and new features: tell the owner it needs a quote.
- `setup`: small content updates are A$25 each. Confirm the owner has charged for it before making the change.

## 7. Cancelling and missed payments
The key can't touch subscriptions. The owner cancels in the Stripe dashboard
(Customers → the client → subscription → Cancel). Stripe retries failed cards and emails the client by itself.
Never take a site offline unless the owner says so.

## Email: preview + payment (sign as the owner's business, never mention AI or Lovable)
> Subject: Your new website is ready to view
> Hi <name>, your website is ready to look at: <preview link>
> Happy with it? Choose a plan:
> - Website Setup: A$350 today, including your first year of hosting and domain. Then A$20 a year from
>   year two. Small updates A$25 each. <setup link>
> - Website + Ongoing Management: A$574.99 today, then A$24.99 a month. Hosting, domain, support and
>   unlimited routine updates included. <managed link>
> Your domain is registered to you and belongs to you either way.

## Never
- Use a client's Stripe key or a Kairo salon's key. Payments go to the owner's own Stripe only.
- Refund, change prices, change tax or payment settings, or touch anything in Stripe beyond the scripts.
- Reactivate a retired link.
