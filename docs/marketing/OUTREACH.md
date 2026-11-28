# The one strategy: "Your booking page, already built"

Every weekday a scheduled session finds a handful of Australian appointment
businesses that **still take bookings by phone, text or DM**: higher-value
ones first (cosmetic and skin clinics, tattoo studios, day spas), then
beauty, nail, lash, brow, hair and barber businesses. For each one it builds a picture of **their own Kairo booking
page**, with their name, their colours and their real menu and prices. It
emails that picture to the address they publish, with one plain question:
"Want me to send you the link to set it up?"

It also emails a few service businesses whose website is letting them down,
offering a free demo of a new one (see "The website track" below; owner's
request, 28 Nov 2026: reach high-value service businesses, not only salons).

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

1. An Australian business that sells booked appointments at its own
   premises, with a physical address or suburb. Higher-value ones first:
   cosmetic and skin clinics, tattoo studios, day spas and massage. Then
   beauty, nail, lash, brow, hair and barber businesses. For a clinic, put
   only treatments that aren't prescription medicines on the picture (skin
   treatments, peels, skin needling, LED, laser, IPL, facials) and leave
   injectables off: prescription medicines can't be advertised in
   Australia, and the picture doesn't need them.
2. **No online booking.** The site says to call, text, DM, email or "contact
   to book", and has no booking widget or link to any booking platform.
3. **A published business email** in the site's text or a `mailto:` link
   (not hidden in an image, not only a contact form).
4. **A menu with at least 3 services and prices** on the site.
5. Looks active: something dated 2025 or later (posts, copyright, specials).
6. Nowhere on the site says it doesn't want marketing or unsolicited email.
7. **Never emailed before** from the Kairo Gmail. Search the Sent folder for
   the address and for `@domain`. Any hit means skip it, whoever sent it.

**Second group: businesses that already book online.** The first night
showed that most salons with a website already book online through a booking
app. Most such apps charge every month, and many take commission. These
businesses pass checks 1 and 3–7 above, fail only check 2, and get the
**second-group email** below: the same picture, framed as owning the booking
page outright. Never name or guess which app they use. Fill each day with
first-group businesses first, then second-group ones, up to 10 in all.

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
- Niches, higher-value first: skin and cosmetic clinics (laser, peels, skin
  needling), tattoo studios (only those that publish prices, such as a shop
  minimum, an hourly rate or flash), day spas and massage; then nails,
  lashes, brows, hair, barber, beauty.

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
spam: `(subject:"booking page" OR subject:website) -from:me newer_than:45d`.
Handle each new one (website-track replies are handled as "The website
track" says):

| Reply | Do |
|---|---|
| Yes / send it / how? | Send **Reply: yes** (below). Push the owner: "<business> said yes to the booking page." |
| A question (price, features, how it works) | Answer it truthfully from `docs/KAIRO-INFO.md` and the app's code, in 3–6 plain lines, ending with the link offer. Say what Kairo doesn't do if that's the question. If you're not sure, don't guess: push the owner with the question. |
| No thanks / stop / unsubscribe / not interested | Reply once: "No worries at all, I won't email again. All the best with <business>. Sachi". Never contact them again (the Sent search already guarantees it). |
| Angry or a complaint | Don't reply. Push the owner with the text. |
| Bounce | Nothing to do. Count it. |

### 2. Follow-ups
For every first email sent 3–5 days ago that has no reply in its thread,
send the **Follow-up** in the same thread (**Follow-up B** if the first email
was version B, **Website follow-up** for the website track). Send only one,
ever.

**Now free to try (once, only for the early batches).** Businesses first
emailed before 25 Nov 2026 never heard about the free trial. For each of them
whose follow-up went 7 or more days ago, with no reply of any kind in the
thread and no bounce, send the **Now free to try** note in the same thread.
Once, ever; after it, that business is never emailed again.

### 3. Find today's businesses
Find **up to 10** that pass every check in "Who gets one", then **up to 5**
for the website track that pass every check in "Who gets a website email".
Fewer is fine. Never
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
Scheme: `blush` for lashes, brows and beauty; `cream` for nails, hair,
clinics and spas; `noir` for barbers and tattoo studios. Open each picture and look at it before it goes
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
  week: date, sent (and whether they were version A or B), follow-ups,
  "now free" notes, replies (yes / question / no), bounces, mail-tester
  score. **Numbers only.** Commit and push to
  `claude/markdown-file-analysis-a5ppnf`.
- Log the website track on its own line: website emails sent, follow-ups,
  replies, demos asked for.
- Push-notify the owner **only** for a yes (a booking-page yes or a website
  demo asked for), a question you couldn't answer, a complaint, or a sale. A
  quiet day stays quiet.

---

## The words

Two versions, to learn which gets more replies. **Version A on even dates,
version B on odd dates** (the date in Australia). Log how many of each went
out; replies are compared in the weekly run.

**Subject (A):** `<Business> booking page`
**Subject (B):** `Your <Business> booking page, free for 14 days`

Both keep the words "booking page", which is what step 1 searches for.

**Version A**

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
> It's Kairo, which I make here in Melbourne. You can try it free for 14
> days, no card. If you keep it, it's A$400 once (or 3 × A$150), and no
> monthly fee, ever.
>
> Want me to send you the link? I'll help you put your menu in.
>
> Sachi
> Kairo · kairobookings.com
>
> Not for you? Just reply "no thanks" and I won't email again.

**Second-group email** (they already book online)

> Hi <first name, or "there">,
>
> I put the <Business> menu into Kairo to show you what your booking page
> could look like if you owned it outright. It's attached: <service 1>,
> <service 2> and the rest, at your prices.
>
> Clients tap a service, pick a time you're actually free, and it goes
> straight into your diary, with a reminder the day before so fewer no-shows.
>
> The difference is the price: Kairo is A$400 once (or 3 × A$150), then
> nothing to pay, ever: no monthly fee and no commission on bookings. And
> you can try it free for 14 days first, no card.
>
> Want me to send you the link? I'll help you move your menu across.
>
> Sachi
> Kairo · kairobookings.com
>
> Not for you? Just reply "no thanks" and I won't email again.

**First email B** (no online booking)

> Hi <first name, or "there">,
>
> I made <Business> a booking page with your real menu (<service 1>,
> <service 2> and the rest) to show you how it would look. It's attached.
>
> You can switch it on and use it free for 14 days. No card, nothing to
> cancel. Clients pick a service and a time you're actually free, and it
> lands straight in your diary.
>
> If you love it, it's A$400 once (or 3 × A$150), with no monthly fee after
> that.
>
> Want the link? I'll help you get your menu in.
>
> Sachi
> Kairo · kairobookings.com
>
> Not for you? Just reply "no thanks" and I won't email again.

**Second-group email B** (they already book online)

> Hi <first name, or "there">,
>
> I put the <Business> menu into Kairo to show you a booking page you'd own
> outright. It's attached: <service 1>, <service 2> and the rest, at your
> prices.
>
> You can run your bookings on it free for 14 days, with no card, alongside
> what you use now. If it suits you better, it's A$400 once (or 3 × A$150),
> then nothing to pay, ever: no monthly fee and no commission.
>
> Want me to send you the link? I'll help you move your menu across.
>
> Sachi
> Kairo · kairobookings.com
>
> Not for you? Just reply "no thanks" and I won't email again.

**Follow-up B** (same thread, 3–5 days later, once)

> Hi <first name, or "there">, just checking this reached you. The 14-day
> trial is free and needs no card, so there's nothing to lose by having a
> look. Happy to send the link.
>
> Sachi

**Now free to try** (same thread, once, early batches only; see step 2)

> Hi <first name, or "there">,
>
> One last note from me: since I sent your booking page, Kairo has a free
> 14-day trial. No card, and if it's not for you it simply stops. If you'd
> like to try it with your own menu, reply "link" and I'll send it.
>
> Sachi

A reply of "link" (or anything like yes) gets **Reply: yes** below.

**Follow-up** (same thread, 3–5 days later, once)

> Hi <first name, or "there">, just bringing this back up in case it got
> buried. Happy to send the link, or answer anything first.
>
> Sachi

**Reply: yes**

> Great! Here's the link: https://start.kairobookings.com/start?plan=trial&from=preview
>
> It's free for 14 days, no card, and takes about four minutes. Your menu
> goes in under Services. Here it is to copy across:
> <the services and prices, one per line>
>
> If you'd rather go through it together, reply with a time that suits and
> I'll call you.
>
> Sachi

Every claim above is true in the app today: the cancel and confirm link,
the 24-hour default reminder, live free times, the price, the refund and the
free 14-day trial (from 1.89.0, 24 Nov 2026: no card; Kai, texts, deposits,
automatic messages and own email address come with a plan).
Check `docs/KAIRO-INFO.md` before adding a new one.

---

## The founding offer (owner, 28 Nov 2026)

The first 20 businesses get Kairo for **A$200 once instead of A$400**, in
return for an honest review after their first month. It works only through
a private link, `start.kairobookings.com/start?offer=<code>`. **The link is
in the scheduled task's prompt and the owner's messages, never in this
repo** (it's public). Until all 20 places are gone, every booking-page email
and follow-up carries it instead of versions A and B. Check what's left
before each run: `curl -s "https://start.kairobookings.com/api/offer?code=<code>"`
returns `places_left`. At 0, go back to versions A and B.

A founder can pay A$200 now or start the free trial and keep it for A$200.
A month after paying, the platform emails them once asking for the review.
If a review goes on the website, it's labelled as from a founding customer,
because they paid less for it.

**Founding first email** (no online booking; picture attached)

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
> It's Kairo, which I make here in Melbourne. I'm looking for 20 founding
> businesses to get it for A$200 once instead of A$400, with no monthly fee,
> ever. All I ask in return is an honest review after your first month. You
> can try it free for 14 days first, no card:
> <offer link>
>
> Happy to help you put your menu in.
>
> Sachi
> Kairo · kairobookings.com
>
> Not for you? Just reply "no thanks" and I won't email again.

**Founding second-group email** (they already book online; picture attached)

> Hi <first name, or "there">,
>
> I put the <Business> menu into Kairo to show you what your booking page
> could look like if you owned it outright. It's attached: <service 1>,
> <service 2> and the rest, at your prices.
>
> Clients tap a service, pick a time you're actually free, and it goes
> straight into your diary, with a reminder the day before so fewer no-shows.
>
> The difference is the price. Kairo is normally A$400 once, with no monthly
> fee and no commission, ever. I'm looking for 20 founding businesses to get
> it for A$200 instead, in return for an honest review after their first
> month. You can try it free for 14 days first, no card:
> <offer link>
>
> Happy to help you move your menu across.
>
> (signature and "no thanks" line as above)

**Founding follow-up** (same thread, 3–5 days later, once)

> Hi <first name, or "there">, just bringing this back up, with one change.
> I'm looking for 20 founding businesses to get Kairo for A$200 once instead
> of A$400, still with no monthly fee, in return for an honest review after
> their first month. You can try it free for 14 days first, no card. Here's
> the link if you'd like a look:
> <offer link>
>
> Sachi

Subjects stay `<Business> booking page`, so step 1 still finds replies.
Mail-tester scored the founding first email 9.2/10 on 28 Nov.

---

## The website track

Kairo also builds websites (`.claude/skills/website-sale/SKILL.md`, and
kairobookings.com/websites): A$350 once including the domain and the first
year of hosting (then A$20 a year), or A$550 plus A$24.99 a month with
updates done. We build a free demo first. Higher-value service businesses
with a weak website are the people this pays off for.

### Who gets a website email

All of these must be true:

1. An Australian service business whose jobs are usually worth A$500 or
   more: builders and renovators, kitchens and bathrooms, landscapers, pools,
   fencing, roofing, solar, electricians, plumbers, painters, removalists,
   cosmetic and skin clinics, tattoo studios, photographers, detailers.
2. **A website that is letting them down, by a fact you checked yourself**
   (`check-site.mjs` reports the first three; look at the page as well):
   - `phone_ready: false`, and a 390px-wide screenshot really does show a
     desktop page shrunk onto a phone; or
   - `https: false`, and the `https://` address doesn't work either, so
     browsers mark the site "Not secure"; or
   - `copyright_year` 2021 or earlier and nothing on the site is newer.
   - Or no website at all, with a business email published on the
     business's own listing (not a directory that copied it).
3. **A published business email** (as in "Who gets one").
4. Still trading: something dated 2025 or later, or recent reviews.
5. Nowhere says it doesn't want marketing or unsolicited email.
6. **Never emailed before** from the Kairo Gmail, on either track (search
   Sent for the address and `@domain`).

Find them the same way as the booking-page businesses: search
`<trade> <suburb>` and open the businesses' own sites; use directories for
names only. Rotate trades and cities daily.

### Website words

**Subject:** `<Business> website`

**Website email** (pick the one finding that's true; never more than one)

> Hi <first name, or "there">,
>
> I was looking at the <Business> website. <The finding, one plain sentence:
> "On a phone it opens at desktop size, so the text is tiny and people have
> to pinch and zoom." / "Chrome marks it "Not secure", because it doesn't
> have a security certificate." / "It still says © <year>, so it looks like
> it hasn't been touched in a while." / "I couldn't find a website for you,
> only your <listing>.">
>
> Most people look a business up on their phone before they call, and for a
> bigger job that first look often decides who gets the call.
>
> I build websites for Australian service businesses, and I'd be happy to
> make you a free demo of a new one: your services, your photos and your
> contact details, made for phones. You can look at it on your own phone
> before deciding anything.
>
> If you like it, it's A$350 once, including your domain and the first year
> of hosting (then A$20 a year). If you don't, it costs nothing.
>
> Want me to put one together?
>
> Sachi
> Kairo · kairobookings.com/websites
>
> Not for you? Just reply "no thanks" and I won't email again.

**Website follow-up** (same thread, 3–5 days later, once)

> Hi <first name, or "there">, just bringing this back up in case it got
> buried. Happy to put the demo together, or answer anything first.
>
> Sachi

**Website reply: yes**

> Great! To make the demo I need a few things:
> - the services you'd like on it (or I'll use the ones on your current site)
> - 4 to 8 photos of your work you're happy for me to use (or tell me I can
>   use the ones on your site or Instagram)
> - the phone number, email and area you'd like customers to see
>
> I'll send you a link to look at on your phone as soon as it's ready. No
> cost unless you decide to keep it.
>
> Sachi

Then push-notify the owner: "<business> wants a free website demo." **The
owner builds the demo** (website-sale skill, the owner's Lovable credits);
never start one without them. Questions and "no thanks" replies are handled
as in step 1.

Send website emails as plain text with no attachment, one per tool call,
after the booking-page emails and inside the same daily cap. The first day
the website email is used, give it its own mail-tester check as well.

---

## Rules (never broken)

- Only from the Kairo Gmail (`gmail_basoid-tun`). **Never through Resend**:
  the salons' booking emails depend on that account, and its policy forbids
  cold email.
- One first email and one follow-up per business, ever. The only extra is
  the single **Now free to try** note for businesses first emailed before
  25 Nov 2026 (step 2).
- Never name another booking platform or website builder, in an email or
  anywhere else.
- Never criticise a business or its work. A website email states one fact
  you checked about the site, nothing else.
- Never "special offer" or "limited time". The prices are the normal prices.
- No mention of AI.
- Never name a customer's salon, and never touch `hairbysha` or
  `horahaircutz`.
- No money: no paid tools, no credits, no ads.
- Nothing personal in this public repo. Pictures live only in
  `my-creative-space/public/p/` and are deleted after 30 days.

## Measuring it

- Sign-ups from the link carry `from=preview`. The daily sale check reads
  `signup: paid <slug> from preview` in the kairo-platform log, and trials
  as `signup: trial <slug> from <page>`. A trial kept is logged as
  `signup: paid <slug> from <page> (<plan>, kept from a trial)`.
- Website sales are paid through the website-sale Stripe links, not the
  Kairo sign-up, so the daily sale check won't see them. When a demo is
  asked for, the owner runs "check website payments" after sending it.
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
