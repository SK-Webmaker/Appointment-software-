# Special requests

A way for a customer to say "can you do Tuesday at seven?" when Tuesday at
seven is not on the page.

## The gap

A salon's booking page offers what the diary can offer. A customer who wants
something else — a Sunday, half seven, a colour correction they want to talk
through first, two heads in one visit — finds nothing that suits and closes the
tab. The salon never learns it happened, and never learns how often.

That customer was not a difficult booking. They were a booking.

## What this is not

**Not the waitlist.** The waitlist answers "tell me if *this day* frees up" and
answers it automatically: a slot is cancelled, offers go out, somebody takes
it. It only works for a day the salon already offers, and it never involves a
person.

A special request is the opposite on both counts. It can ask for a time the
salon does not offer at all, and it is *meant* to reach a human — the reply is
the product. The two sit side by side on the page and say different things.

**Not consultation-first mode.** That closes the booking page and routes
everybody through a DM. This is for the salon that keeps its booking page and
wants one escape hatch under it.

## What is built

A setting, `enquiries_enabled`, and a panel under the booking form:

> **Can't find a time that works?**
> Tell us what you're after and we'll see what we can do.

Opening it asks for a name, a way to be reached, optionally the day and time
they were hoping for, and what they want. It is protected by Turnstile where
the salon has it on, and rate-limited either way: it is a public write
endpoint and its whole purpose is to accept free text.

It appears in three places, all of them the moment somebody is about to give
up:

1. **Under the time grid** — quiet, so it never competes with a time they could
   actually take.
2. **On a day with nothing free** — loudly, beside the waitlist offer.
3. **At the foot of the page** — for somebody who never got as far as picking
   a service.

## What the owner gets

A request lands in one place and is hard to miss:

- **A card at the top of the Dashboard** when any are unanswered. These are
  people waiting for a reply, so they sit above the day's analysis rather than
  inside it.
- **A push notification**, under its own switch alongside the others in
  Settings → Phone notifications.

Each one shows who, how to reach them, when they were hoping for, and what they
said, with **Reply by email**, **Text them** and **Mark as done**. Kairo does
not write the reply: the salon knows whether it can do Tuesday at seven, and a
templated "thanks for your enquiry" is worse than nothing.

## Decisions

**On by default.** Unlike the waitlist, this sends nothing to anybody on its
own — it puts a message in front of the owner and stops. The failure mode of
having it off is a customer who silently leaves, which is the exact thing it
exists to prevent. It is one tick to turn off, and the setting says so.

**Nothing is auto-replied and nothing is auto-booked.** A request is a
conversation the salon has not had yet. Turning it into a provisional booking
would put a time in the diary that the owner never agreed to.

**The preferred time is free-form, on purpose.** "Any evening after 6" and
"Sunday if you ever do them" are the two most useful things a customer can say
here, and neither fits a date picker. There is a date field for the common case
and a text box for the real one.
