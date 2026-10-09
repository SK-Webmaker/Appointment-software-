# After approval: what is left, and who does it

*Written 8 October 2026, the day 1.0 (build 19) went "Ready for Distribution".*

Everything below that could be done from code is done and live (server
1.72.0, verified on all three salons). What is left needs your hands, because
it is your Apple account, your money, or your name.

---

## 1. Submit 1.0.1 — about 10 minutes, do it today

Build **1.0.1 (21)** is already uploaded. Apple emails when it has finished
processing (usually under 30 minutes).

1. App Store Connect → **Kairo** → the **+** next to *iOS App* → **1.0.1**.
2. **What's New in This Version:** `Small improvements.`
3. **Build:** pick **1.0.1 (21)**.
4. **Copyright:** `2026 Kairo` (this is the one line on the listing that can
   stop showing your name today — see §2).
5. **App Review Information** → *Sign-in required*: leave the demo email and
   password exactly as they are (they carry over from 1.0). **Notes:** replace
   what is there with `APPLE-1.0.1-NOTES.txt`, pasted as it is — it points
   Apple at the sign-in fields, so no password needs typing. Under 4,000
   characters.
6. The demo password stays as it is, by the owner's decision (8 October). The
   demo holds only sample data; if anyone ever closes it, it can be reopened.
7. **App Privacy** — nothing to change. Kai only handles data types already
   declared (contact info, user content) for App Functionality, and Anthropic
   is a service provider, not tracking.
8. **Add for Review** → **Submit to App Review**. Leave release on automatic.

Why the notes changed: the 1.0 notes say "no AI services of any kind". Kai can
now use Anthropic, so that sentence must not go to Apple again. The new notes
describe Kai and its consent screen (guideline 5.1.2(i)) and are true whether
or not Kai is switched on when the reviewer looks.

## 2. Your name under the app — what can and cannot change

Apple shows the **seller** under the app's name and in *Information*. On an
individual membership the seller is, by Apple's rule, the account holder's
legal name. There is no setting that hides it, and a registered business name
("trading as") does not count: Apple accepts only a **legal entity** (a
company), and "does not accept DBAs, fictitious business names, trade names,
or branches".

What changes it:

1. **Register a company** (a Pty Ltd, through ASIC; about A$600). Talk to an
   accountant first about GST and tax: a company is a different taxpayer from
   you.
2. **Get a D-U-N-S number** for the company. Free, through Apple's D-U-N-S
   lookup at developer.apple.com/enroll/duns-lookup; allow a week or two.
3. **Ask Apple to convert the membership.** Developer account → Membership →
   *update individual to organization*, or Contact Us → Membership and Account.
   The app, its reviews, the Team ID and certificates all stay; only the seller
   changes, to the company's legal name (e.g. "Kairo Bookings Pty Ltd").
4. Then the order in `OWNERSHIP.md`: `platform/seller.js`, Stripe's business
   name, App Store Connect, and the website's Terms and Privacy Policy — all
   on the same day, so no customer sees two different sellers.

Until then the copyright line (§1 step 5) is the only place that can change,
and the website must keep naming you as the seller — that is the law for a
sole trader, not a choice.

## 3. Kai — when you want it on (optional)

Kai stays off until its key is set. To switch it on:

1. **Send the notice** below to Sha and Hora. The Data Processing Addendum
   promises 14 days' notice before a new sub-processor.
2. **Anthropic console** (console.anthropic.com): add credit (US$20 is plenty
   to start), set a **monthly spend limit** under Settings → Limits, and
   create an API key.
3. **Render** → kairo-shard-au → Environment → add `KAIRO_ANTHROPIC_API_KEY`
   with the key → Save. Never paste the key into a chat.
4. Tell me, and I will run the live backtest (put the same key in this
   session's environment settings for that).

Kai's own limits are already set: 20 messages per 10 minutes per person, 150 a
day per salon, about 1–3 US cents a message.

**The notice (copy and send):**

> Subject: A new, optional assistant in Kairo
>
> Hi [name],
>
> From [date, 14 days from today] Kairo will offer Kai, an assistant that can do
> things in your book for you when you ask in plain words ("move Sarah to 3pm",
> "add a note to Tom"). It runs on Claude, made by Anthropic, in the United
> States.
>
> It is off unless you turn it on. The first time you open it, it asks first and
> says exactly what is sent. Nothing about your clients goes to Anthropic unless
> you say yes, and you can turn it off at any time. Anthropic doesn't use it to
> train its AI. Anything that deletes, refunds, cancels or messages clients
> waits for you to press Confirm.
>
> Anthropic is now on our sub-processor list: kairobookings.com/legal/sub-processors
>
> If you'd rather nobody in your business could use it, untick "Allow Kai in
> this business" in Settings (it appears once Kai is live), or reply and
> we'll do it for you.
>
> Kairo

## 4. Small things

- **Refund window: 14 days from payment** (owner's decision, 9 October). The
  signup page, the platform's refund policy, the automatic refund and (since
  9 October) the website's refunds page, FAQ and structured data all say 14.

- **The demo's "close account" from the recording** left a *purge* task in the
  platform's operator queue. Close it **without** deleting anything — the demo
  is what App Review signs in to.
- **Website privacy policy:** the Kai section is live at
  kairobookings.com/legal/privacy (published 9 October).

## 5. What happens by itself

- **App Store links.** The servers ask Apple for Kairo's listing by bundle id.
  As soon as Apple's search lists it (usually within a day of release), these
  switch on with no deploy: the Smart App Banner ("Kairo — Open") in Safari on
  the sign-in page and the workspace, **Get the iPhone app** on the setup
  checklist, the App Store button in the setup wizard, and the link on the
  phone-notifications card. Never on a booking page. If it has not appeared
  after two days, copy the *Apple ID* number from App Store Connect → App
  Information into Render as `KAIRO_APP_STORE_ID`.

---

### The privacy-policy text, for the website

After "Health information in client notes" in `src/data/legal.ts`:

```ts
{ kind: "h", text: "Kai, the in-app assistant" },
{
  kind: "p",
  text: "Kai is an optional assistant inside Kairo. It runs on **Claude**, an AI made by **Anthropic**. Each person is asked in the app before they first use it, and nothing goes to Anthropic until they turn it on.",
},
{
  kind: "ul",
  items: [
    "**What's sent** — what you type to Kai, and the records it looks up or changes to answer you, such as a client's name, appointments or notes. Passwords and connection keys are never sent.",
    "**Where, and for what** — Anthropic processes it in the United States, only to answer you, and doesn't use it to train its AI.",
    "**What we keep** — your Kai conversations are kept in your own Kairo database, like the rest of your records. You can delete them in the app.",
    "**Turning it off** — anyone can turn Kai off for themselves at any time, and an owner can switch it off for the whole business in Settings.",
  ],
},
```
