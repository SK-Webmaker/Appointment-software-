# The one strategy: "Your booking page, already built"

Every weekday a scheduled session finds a handful of Australian beauty, nail,
lash, brow, hair and barber businesses that **still take bookings by phone,
text or DM**. For each one it builds a picture of **their own Kairo booking
page**, with their name, their colours and their real menu and prices. It
emails that picture to the address they publish, with one plain question:
"Want me to send you the link to set it up?"

It costs nothing. The owner only steps in when someone replies.

This file is the playbook that session follows. Read all of it each run.

> **This repo is public.** Never commit a prospect's name, email, website or
> picture here. The private record is the Kairo Gmail. Pictures live in the
> private website repo. `LOG.md` gets numbers only.

---

## Why this one (research, 19 Nov 2026)

What we've tried, and what happened:

| Channel | Result so far |
|---|---|
| Generic cold email (84 sent since 29 Aug, each with one follow-up, many about websites rather than Kairo) | 0 replies, 0 bounces |
| SEO (34 pages, weekly run since Oct) | 10–16 visitors a week, none yet from search |
| Instagram DMs (owner, by hand) | Running; Instagram does not let software start a DM, so it can't be automated |
| Product Hunt | Booked by the owner for Tue 24 Nov |

What the research says:

- **The first customers of a small vertical software business come from
  direct outreach, not search.** SEO takes 6–12 months to pay off. The usual
  advice is one fast channel plus one slow one. Our slow one (SEO) already
  runs every week.
  ([SaaS Club](https://saasclub.io/podcast/first-customers/),
  [Promptstoproduct](https://www.promptstoproduct.com/complete-guide-to-saas-customer-acquisition),
  [Rapid Product Growth](https://podcast.rapidproductgrowth.com/how-to-find-first-saas-customers-for-bootstrapped-founders/))
- **Local small businesses reply more than big companies, and a specific,
  checkable gap is what makes them reply.** Typical cold email gets 1–4%.
  Emails that name a real gap in that business are reported at 15–20%.
  Personalisation lifts replies by roughly 30–140%, depending on the study.
  ([Belkins](https://belkins.io/blog/cold-email-response-rates),
  [RevenueFlow](https://www.revenueflow.com/blog/smb-cold-email-benchmarks),
  [B2B Lead Finder](https://b2bleadfinder.io/blog/cold-email-templates-for-web-design-agencies-2026))
- **Giving beats asking.** A ready-made asset "flips the dynamic from
  salesperson asking to professional giving". Showing a prospect a working
  version built on their own business (a "reverse demo") is how
  demo-personalisation tools sell. Personalised visuals are reported to
  lift replies 2–4×. Treat all these figures as directional: they come from
  vendors.
  ([Leadomos](https://leadomos.com/en/blog/cold-email-templates-web-designers),
  [Ciela](https://ciela.ai/blogs/reverse-demo-method-ai-agencies),
  [Sendspark](https://www.sendspark.com/resources/outbound-video-plays))
- **The best-fit owners are the ones still booking by hand.** Directories
  mark many Australian salons "Call to book": there's no online booking at
  all. Owners who only offer "DM to book" are also seen as less trustworthy
  by clients ([BBY](https://home.bby.site/blog/dm-to-book)). They have the
  problem and nothing to switch away from, and Kairo's first promise, your
  own booking link, is exactly that.
- **Deliverability is checked, not guessed.** Zero replies from 84 could
  mean the emails were never seen. Every run sends the day's first email
  through [mail-tester](https://www.mail-tester.com/) (free, 3 a day) and
  stops if it scores under 8/10. Emails stay plain, there's no tracking
  pixel (tracking is reported to lower replies), and volume stays small.
  ([MailReach](https://www.mailreach.co/blog/gmail-warmup))
- **Legal (Australia).** The Spam Act allows inferred consent where a
  business publishes its address and the message relates to its business.
  Booking software for a business that takes bookings qualifies. Every email
  identifies Kairo and honours "no thanks" at once.
  ([Spam Act 2003, Sch 2 s4](https://www.legislation.gov.au/C2004A01214/latest/text),
  [LegalVision on the Oneflare case](https://legalvision.com.au/oneflare-spam-act-lessons-for-business-owners))

What changed from the emails that got nothing: Kairo only; only businesses
with a visible gap; a picture of their own page instead of a pitch; one
question to answer instead of a link to click; and a spam check first.

**Honest maths.** At 10 new emails per weekday (50 a week), a 5% reply rate
is about 2–3 replies a week. If 1 in 5 of those buys, the first sale comes
within about 2–4 weeks. If replies stay at zero after 100 emails, the run
says so in `LOG.md` and tries the next subject line and segment in
"If it isn't working" below.

---

## Who gets one

All of these must be true. Check each on the business's **own website**,
not on a directory:

1. An Australian beauty, nail, lash, brow, hair, barber or brow/lash-and-skin
   business with a physical address or suburb.
2. **No online booking.** The site says to call, text, DM, email or "contact
   to book", and has no booking widget or link to any booking platform.
3. **A published business email** in the site's text or a `mailto:` link
   (not hidden in an image, not only a contact form).
4. **A menu with at least 3 services and prices** on the site.
5. Looks active: something dated 2025 or later (posts, copyright, specials).
6. Nowhere on the site says it doesn't want marketing or unsolicited email.
7. **Never emailed before** from the Kairo Gmail. Search the Sent folder for
   the address and for `@domain`. Any hit means skip it, whoever sent it.

Where to find them (free, rotate daily):
- Web search for directory pages, by suburb or city and niche, that list
  venues as "Call to book". Then search `<venue name> <suburb>` for the
  business's own site.
- Web search the business's own sites directly, e.g. `nail salon <suburb>
  "call to book" prices` or `lash studio <city> "text to book"`.
- Cities: Melbourne suburbs, Geelong, Ballarat, Bendigo, Sydney suburbs,
  Newcastle, Wollongong, Brisbane suburbs, Gold Coast, Sunshine Coast,
  Toowoomba, Adelaide, Perth, Hobart, Launceston, Canberra, Darwin, Cairns,
  Townsville.
- Niches: nails, lashes, brows, hair, barber, beauty/skin.

Run `node docs/marketing/preview/check-site.mjs <url> [more urls]` on each
candidate's own site. For each one it reports the emails on the site, any
sign of online booking, how they say to book, how many prices it saw, and
the latest year mentioned. Then read the price page yourself for the menu.
Firecrawl is not needed, and its credits are not ours to spend.

What to expect (first run, 19 Nov): about 1 in 7 candidates passes. Most
salons with a website already book online, and most that don't have no
website or email. Directories are useful for names only: a salon listed
there with no site of its own can't be emailed. Searches that worked:
`<niche> "price list" "phone to book"` or `"call or text to book"`, with
directory and social sites excluded. **3 to 5 good businesses a day is a
good day.**

---

## The daily run (weekdays)

### 1. Replies first
Search the Kairo Gmail (account `gmail_basoid-tun`), all folders including
spam: `subject:"booking page" -from:me newer_than:45d`. Handle each new one:

| Reply | Do |
|---|---|
| Yes / send it / how? | Send **Reply: yes** (below). Push the owner: "<business> said yes to the booking page." |
| A question (price, features, how it works) | Answer it truthfully from `docs/KAIRO-INFO.md` and the app's code, in 3–6 plain lines, ending with the link offer. Say what Kairo doesn't do if that's the question. If you're not sure, don't guess: push the owner with the question. |
| No thanks / stop / unsubscribe / not interested | Reply once: "No worries at all, I won't email again. All the best with <business>. Sachi". Never contact them again (the Sent search already guarantees it). |
| Angry or a complaint | Don't reply. Push the owner with the text. |
| Bounce | Nothing to do. Count it. |

### 2. Follow-ups
For every first email sent 3–5 days ago that has no reply in its thread,
send the **Follow-up** in the same thread. Send only one, ever.

### 3. Find today's businesses
Find **up to 10** that pass every check in "Who gets one". Fewer is fine. Never
lower the bar to reach 10. For each, note: business name, first name if the
site gives one, suburb, email, how they take bookings (call / text / DM /
email), a site colour if obvious, opening days and hours if shown, and up to
8 services (name, price, minutes if shown; otherwise a sensible length for
that service). Keep these notes in the scratchpad only.

### 4. Make the pictures
For each business, write a lead file in the scratchpad and run:

```
node docs/marketing/preview/make-preview.cjs <lead.json> <scratch>/<token>.jpg
```

`<token>` is 24 random hex characters (`head -c 12 /dev/urandom | od -An -tx1 | tr -d ' \n'`).
Scheme: `blush` for lashes, brows and beauty; `cream` for nails and hair;
`noir` for barbers. Open each picture and look at it before it goes
anywhere. A wrong price or a broken page means fix it or skip that business.

### 5. Put the pictures online (private website repo)
- Copy them to `my-creative-space/public/p/<token>.jpg`. Delete any file in
  `public/p/` added more than 30 days ago.
- Commit with the message "Preview pictures: N added, M removed", with **no
  business names**, plus the session's Co-Authored-By and Claude-Session
  lines. Push `main`. Never force-push.
- Wait until Lovable's `get_project` shows that commit as
  `latest_commit_sha`, then `deploy_project`
  (`1f3abd6d-0918-48f1-b44f-fc9e97297421`). Poll each
  `https://kairobookings.com/p/<token>.jpg` until it answers 200.
- `robots.txt` already keeps every crawler out of `/p/`, and nothing on the
  site links there.

### 6. Spam check
Pick a fresh id like `test-kairo<6 random letters>`. Send the day's first
email, exactly as it will go out (picture attached), to
`<id>@srv1.mail-tester.com`. Then read `https://www.mail-tester.com/<id>`.
- **8/10 or better:** send.
- **Under 8:** don't send today. Fix what it flags (wording, attachment
  size) and note it in `LOG.md`.

Do this at most once a day.

### 7. Send
Send through the Composio workbench, in one cell:
- For each picture, `requests.get` the kairobookings.com URL, save it, and
  `upload_local_file` it to get an `s3key`.
- Send with `GMAIL_SEND_EMAIL` from `gmail_basoid-tun`, plain text
  (`is_html: false`), attachment `{name: "<Business> booking page.jpg",
  mimetype: "image/jpeg", s3key}`.
- **One email per tool call.** The workbench tool gives up after 60
  seconds while the cell keeps running, so a cell that sleeps between
  sends looks like a failure even though it isn't. Wait 60–120 seconds
  between calls with a shell `until` loop on the clock.
- **Before any retry, check Sent** (`in:sent subject:"booking page"
  after:<yesterday>`). A timed-out call may still have sent its email.
  Never send twice.

**Cap:** count today's emails from the Kairo Gmail to anyone except the
owner (`in:sent after:<today>`). The other daily funnel sends from the same
inbox. If the count reaches **25**, stop for the day.

### 8. Log and tell
- Add one line to `LOG.md` under a "Preview outreach" heading for the
  week: date, sent, follow-ups, replies (yes / question / no), bounces,
  mail-tester score. **Numbers only.** Commit and push to
  `claude/markdown-file-analysis-a5ppnf`.
- Push-notify the owner **only** for a yes, a question you couldn't answer,
  a complaint, or a sale. A quiet day stays quiet.

---

## The words

**Subject:** `<Business> booking page`

**First email**

> Hi <first name, or "there">,
>
> I saw bookings at <Business> are by <phone / text / DM / email>, so I put
> your menu into an online booking page to see how it would look. It's
> attached: <service 1>, <service 2> and the rest, at your prices.
>
> Clients tap a service, pick a time you're actually free, and it goes
> straight into your diary. They get a reminder the day before, so fewer
> no-shows.
>
> It's Kairo, which I make here in Melbourne. It's A$400 once (or 3 × A$150),
> no monthly fee, and a full refund within 14 days if it's not for you.
>
> Want me to send you the link to set it up? I'll help you put your menu in.
>
> Sachi
> Kairo · kairobookings.com
>
> Not for you? Just reply "no thanks" and I won't email again.

**Follow-up** (same thread, 3–5 days later, once)

> Hi <first name, or "there">, just bringing this back up in case it got
> buried. Happy to send the link, or answer anything first.
>
> Sachi

**Reply: yes**

> Great! Here's the link: https://start.kairobookings.com/start?from=preview
>
> It takes about four minutes. Your menu goes in under Services. Here it is
> to copy across:
> <the services and prices, one per line>
>
> If you'd rather go through it together, reply with a time that suits and
> I'll call you.
>
> Sachi

Every claim above is true in the app today: the cancel and confirm link,
the 24-hour default reminder, live free times, the price and the refund.
Check `docs/KAIRO-INFO.md` before adding a new one.

---

## Rules (never broken)

- Only from the Kairo Gmail (`gmail_basoid-tun`). **Never through Resend**:
  the salons' booking emails depend on that account, and its policy forbids
  cold email.
- One first email and one follow-up per business, ever.
- Never name another booking platform, in an email or anywhere else.
- Never "special offer" or "limited time". The prices are the normal prices.
- No mention of AI.
- Never name a customer's salon, and never touch `hairbysha` or
  `horahaircutz`.
- No money: no paid tools, no credits, no ads.
- Nothing personal in this public repo. Pictures live only in
  `my-creative-space/public/p/` and are deleted after 30 days.

## Measuring it

- Sign-ups from the link carry `from=preview`. The daily sale check reads
  `signup: paid <slug> from preview` in the kairo-platform log.
- The weekly run adds the week's totals to its `LOG.md` entry.

## If it isn't working

After 100 first emails:
- **Mail-tester always 8+ but 0 replies:** change the subject to
  "Quick question about <Business> bookings", and switch the segment to
  businesses whose online booking costs them a monthly fee (pitch: same
  booking page, no monthly fee, without naming the platform).
- **Replies but no sales:** read every objection in the replies, write them
  into `LOG.md`, and tell the owner the most common one. It's probably the
  price or paying up front, and changing either is the owner's decision.
