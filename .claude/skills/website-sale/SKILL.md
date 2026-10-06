---
name: website-sale
description: Selling small-business websites built in Lovable, paid by Stripe payment link. Two plans. "handover": $350 once, and the client gets a website they own outright (Netlify Drop ZIP + code ZIP) with no Lovable trace and no support. "managed": $550 today + $30/month, and we keep hosting and updating the site. Use when the owner says "new website for <business>", "send <business> the payment link", "check website payments", or "hand off <business>".
---

# Website sales: two plans

| Plan | Price | After payment |
|---|---|---|
| `handover` | $350 AUD once | Sections 1–5: client gets the files, then we're done |
| `managed` | $550 AUD today + $30 AUD/month | Section 6: we host the site and make changes on request |

Ask the owner which plan if they don't say. Everything below is the handover plan unless marked managed.

# $350 handover: build → pay → hand off → done

The deal: $350 AUD once. We build the site; once paid, the client gets it and owns it. No hosting,
no edits and no support after delivery. Clients must never see that the site was made with Lovable or AI.

Scripts live next to this file. Stripe calls go to `api.stripe.com`; the environment adds the
owner's restricted key automatically, so never ask for, print or store a key.

## 1. Intake (owner tells you about the business)
You need: business name, what they do, suburb/city, phone, email, opening hours, socials,
style/vibe, any must-have sections, **real photos** (or permission to use free stock), the client's email.
Ask once for anything missing. Do not invent prices, reviews, awards or follower counts.

## 2. Build in Lovable (uses the owner's Lovable credits)
`create_project` in workspace "sachi's Lovable" with this in the first message, then iterate with `send_message`:
> Simple marketing website for <business>. Static pages only: no login, no database, no Lovable Cloud,
> no server functions, no forms that need a backend (contact = tap-to-call, mailto, Google Maps link,
> socials). Put every image in public/images/ and reference it as /images/<file> (never import images
> from src/assets). Never mention Lovable anywhere: page titles, meta tags, social preview image, favicon,
> README, package name, comments. Social/canonical URLs use https://<client-domain>/.
Then send the owner the `preview_url` to show the client.

Before a site is sold, it must have: real photos (no "photo to come"), working buttons/links,
real contact details, and no placeholder text.

## 3. Payment link (when the client approves the preview)
```bash
.claude/skills/website-sale/stripe-link.sh "<Business Name>" <client@email> handover   # or: managed
```
Prints the link and `livemode=`. The owner's key is LIVE: every link takes real money, so only
create links for real, approved clients (switch off any mistake at once with stripe-mark-delivered.sh). Each link takes exactly one payment. Send the client the preview + payment link
(email in step 5, or give the owner the text to forward).

## 4. Check payments (hourly routine, or when the owner asks)
```bash
.claude/skills/website-sale/stripe-check.sh   # read-only
```
Act only on `PAID_NOT_DELIVERED` lines. Never deliver on `UNPAID`.

## 5. Hand off a paid site
1. Copy the Lovable project into a scratch folder: `list_files` + `read_file` for every text file
   (skip `.lovable/`, `AGENTS.md`, `roadmap.md`, lockfiles). Images and other binary files (marked
   `binary: true`) can't be read that way; download them from the live site:
   `.claude/skills/website-sale/fetch-assets.sh <preview_url or published url> <dir> public/favicon.ico public/images/...`
2. Remove Lovable code: delete `src/lib/lovable-error-reporting.ts` and its imports/calls; in
   `__root.tsx` and route `head()` replace any `*.lovable.app` URL with the client's domain.
3. Build both ZIPs: `.claude/skills/website-sale/build-handoff.sh <dir> <slug> <out-dir>`
   It stops with exit 2/3 if "lovable" appears anywhere. Fix the files and re-run; never bypass it.
4. Browser check: `node .claude/skills/website-sale/check-site.mjs <SITE_DIR printed above>`
   It must print `OK`. Look at the `check-1280.png` / `check-390.png` screenshots yourself.
5. Send both ZIPs to the owner (SendUserFile) with the delivery email filled in. The owner uploads them
   to Google Drive, shares the links and sends the email. (Uploading the ZIPs to a public host so Drive can
   pick them up was refused for security, and Gmail blocks ZIPs that contain .js files, so they can't be attached.)
   Client emails that need no files (preview + payment link) may be sent from kairobooking18@gmail.com
   (Composio `gmail`, alias "business"). Each send needs the owner's approval in Composio.
   Never use the personal account yewankiri@gmail.com, or Resend's mail.hairbyshacamberwell.com (a client's domain).
6. `.claude/skills/website-sale/stripe-mark-delivered.sh <plink_id>`. This turns the link off and
   records delivery so it is never paid or delivered twice.
7. Tell the owner, in one line: "<Business> paid $350 and the files were delivered."

## 6. Managed plan ($550 + $30/month)
Same intake, build and preview as above. Then:
1. Payment link: `stripe-link.sh "<Business>" <email> managed`. Stripe charges $550 now and $30 every
   month after on the same card, with no action needed from us. Each link takes one sign-up.
2. When `stripe-check.sh` shows it `PAID_NOT_DELIVERED` with plan `managed`, don't build ZIPs. The site
   stays in the owner's Lovable account:
   - Publish the Lovable project, then connect the client's domain in Lovable (Project → Settings → Domains;
     needs the owner's paid Lovable plan). The domain is bought in the client's name; give the owner
     the DNS steps Lovable shows, to pass on.
   - Then run `stripe-mark-delivered.sh <plink_id>` (switches the sign-up link off) and tell the owner it's live.
3. Changes: when the owner relays a client's request ("update <business>: <change>"), `send_message`
   to that Lovable project, check the preview, publish, and confirm to the owner in one line.
   Included: small updates (text, photos, hours, prices, a new section). Anything bigger, ask the owner.
4. Cancelling: the key can't touch subscriptions. The owner cancels in the Stripe dashboard
   (Customers → the client → subscription → Cancel). After that, unpublish the site only if the owner says so.
5. Missed payments: Stripe retries the card and emails the client by itself. The owner sees failures in
   Stripe → Subscriptions. Never take a site offline for non-payment unless the owner says so.

## Emails (sign as the owner's business, never mention AI or Lovable)

**Preview + payment**
> Subject: Your new website is ready to view
> Hi <name>, your website is ready to look at: <preview link>
> Happy with it? Pay here and it's yours to keep: <payment link> ($350, one-time).
> (Managed plan instead: "Pay here to go live: <payment link>. $550 today, then $30 a month for hosting,
> updates and changes. Just message us whenever you need something changed. Cancel any time.")
> Once paid, we'll email your website files with simple steps to put it online. It's a final sale once delivered.

**Delivery**
> Subject: Your website is yours. Here's how to put it online
> Hi <name>, thank you! Here are your two files (download links):
> - <slug>-website.zip: your website
> - <slug>-code.zip: keep this safe. Any web developer can use it to make changes in the future.
>
> Put it online (about 10 minutes, free):
> 1. Go to app.netlify.com/drop and sign up free (Sign up with Google is easiest).
> 2. Unzip <slug>-website.zip, then drag the folder onto the page. Your site is live.
> 3. Buy your domain (e.g. at Namecheap or Cloudflare) in your own name, with auto-renew on.
> 4. In Netlify, open your site → Domain management → Add a domain, and follow the steps shown.
>
> Everything is in your name, so you own it completely. Thanks for your business!

## Never
- Use a client's Stripe key or a Kairo salon's key. Payments go to the owner's own Stripe only.
- Refund, change prices, or touch anything in Stripe beyond the three scripts.
- Deliver before `stripe-check.sh` shows the link as paid.
