// Growth: the plan, the content ideas, and the pathways Kai lays out.
//
// The plan's whole claim is that it CHECKS ITSELF — a step is done because the
// setting is on, not because somebody ticked a box. So most of this suite is
// one shape repeated: read the plan, change the business, read it again,
// assert the step moved. A checklist that does not move when the thing it
// describes changes is decoration.
//
// The lines it holds:
//
//   1. IT MOVES WITH THE BUSINESS. No caching and no remembering — the
//      assertion is that switching a setting changes what the plan says.
//   2. A TICK CAN ADD, NEVER TAKE AWAY. An owner who did something another way
//      can tick it off; nobody can make a step that IS done look undone, or
//      the screen sends them to do it twice.
//   3. A MANUAL STEP ADMITS IT. "Done" meaning two different things on one
//      list is how a checklist stops being believed.
//   4. EVERY NUMBER IN A CAPTION IS REAL. The ideas are templates with the
//      business's own figures in them; a figure that does not match the
//      database is the one failure that would actually matter.
//   5. ADVICE CHANGES NOTHING. A pathway is links. Asking Kai how to grow must
//      never alter the business.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startKairo } from './helpers/kairo.js';
import { forSpeech, speak } from '../src/kai-voice.js';

let k, cookie;

const get = async (p) => (await k.api('GET', p, { cookie })).json;
const put = (p, body) => k.api('PUT', p, { cookie, body });
const say = async (q, turn = 0) => (await k.api('POST', '/api/ask/do', { cookie, body: { q, turn } })).json;
const plan = () => get('/api/growth/plan');
const stepOf = (p, id) => p.stages.flatMap((s) => s.steps).find((s) => s.id === id);

before(async () => {
  k = await startKairo();
  ({ cookie } = await k.login());
});
after(async () => { await k.stop(); });

test('the plan is a plan: five stages, in the order the money arrives', async () => {
  const p = await plan();
  assert.equal(p.stages.length, 5);
  assert.equal(p.stages.map((s) => s.id).join(','), 'found,easy,back,bring,prove');
  assert.ok(p.stages.every((s) => s.steps.every((x) => x.stage === s.id)));
  assert.ok(p.stages.flatMap((s) => s.steps).every((x) => x.why.length > 20),
    'every step says why it matters');
  // Three, because nineteen at once is a wall somebody bounces off.
  assert.ok(p.next.length <= 3, `asks for ${p.next.length}`);
  assert.ok(p.next.every((x) => !x.done), 'and the three it asks for are undone');
  assert.equal(p.total, p.stages.reduce((n, s) => n + s.total, 0));
  assert.equal(p.done, p.stages.reduce((n, s) => n + s.done, 0));
});

test('a step is done because the setting is on, not because anyone said so', async () => {
  await put('/api/settings', { review_requests_enabled: '0' });
  assert.equal(stepOf(await plan(), 'review-requests').done, false);

  await put('/api/settings', { review_requests_enabled: '1' });
  assert.equal(stepOf(await plan(), 'review-requests').done, true);

  await put('/api/settings', { review_requests_enabled: '0' });
  assert.equal(stepOf(await plan(), 'review-requests').done, false, 'and it goes back');

  // A reward of "$0 off" is an offer nobody acts on, and a plan that counted
  // it would be flattering itself.
  await put('/api/settings', { referral_reward_type: 'fixed', referral_reward_value: '0' });
  assert.equal(stepOf(await plan(), 'referral-offer').done, false);
  await put('/api/settings', { referral_reward_type: 'fixed', referral_reward_value: '10' });
  assert.equal(stepOf(await plan(), 'referral-offer').done, true);
});

test('a manual step says it is manual, and ticks by hand', async () => {
  const p = await plan();
  const manual = p.stages.flatMap((s) => s.steps).filter((x) => x.manual);
  assert.ok(manual.length >= 3, `${manual.length} steps happen outside Kairo`);
  assert.ok(manual.every((x) => x.manual.length > 10), 'and every one of them says so');
  assert.ok(manual.every((x) => x.checks_itself === false),
    'they are exactly the ones that cannot check themselves');

  const on = await put('/api/growth/plan/google-profile', { done: true });
  assert.equal(stepOf(on.json, 'google-profile').done, true);
  assert.ok(stepOf(on.json, 'google-profile').ticked_on, 'and it records when');
  const off = await put('/api/growth/plan/google-profile', { done: false });
  assert.equal(stepOf(off.json, 'google-profile').done, false);

  const bad = await put('/api/growth/plan/not-a-real-step', { done: true });
  assert.equal(bad.status, 404);
});

test('a tick can add to what the database says, never take away', async () => {
  // Otherwise the screen sends an owner off to do something already done.
  await put('/api/settings', { review_requests_enabled: '1' });
  await put('/api/growth/plan/review-requests', { done: false });
  assert.equal(stepOf(await plan(), 'review-requests').done, true, 'the setting wins');
  await put('/api/settings', { review_requests_enabled: '0' });
});

test('the content ideas are built out of the business, not a blank page', async () => {
  const c = await get('/api/growth/content');
  assert.ok(c.ideas.length >= 4, `${c.ideas.length} ideas`);
  assert.ok(c.ideas.every((i) => i.reason.length > 20), 'every idea says why');
  assert.ok(c.ideas.every((i) => i.kind === 'post' || i.kind === 'campaign'));
  assert.ok(c.ideas.filter((i) => i.kind === 'post').every((i) => i.caption.length > 20),
    'the posts carry copy to use');
  assert.ok(c.calendar.weeks.length >= 1 && c.calendar.weeks.length <= 4);
  assert.ok(c.calendar.weeks.every((w) => w.ideas.length <= 2), 'twice a week, not daily');

  if (c.facts.top_service) {
    const idea = c.ideas.find((i) => i.id === 'top-service-proof');
    assert.ok(idea?.title.includes(c.facts.top_service.name),
      'the service named in the caption is the one the books say earns most');
  }
  // A business with no public address gets "link in bio", never a sentence
  // with a hole in it.
  assert.ok(c.ideas.filter((i) => i.caption).every((i) => !i.caption.includes('undefined')));
});

test('Kai lays out a pathway for a question that names no setting', async () => {
  for (const q of ['how do i get more clients', 'how can i grow my business',
    'what should i do next', 'my business is quiet lately', 'growth plan']) {
    const r = await say(q);
    assert.equal(r.kind, 'pathway', `"${q}" → ${r.kind}: ${r.said}`);
    assert.ok(r.steps.length > 0);
  }
  const post = await say('what should i post');
  assert.equal(post.kind, 'pathway');
  assert.ok(post.steps.every((s) => String(s.href).startsWith('#/')), 'every step is somewhere to go');
  assert.ok(!post.said.includes(post.steps[0].detail),
    'the spoken sentence does not repeat the first step word for word');
});

test('advice changes nothing', async () => {
  const before_ = await get('/api/settings');
  for (const q of ['how do i get more clients', 'what should i post', 'i need marketing ideas']) {
    await say(q);
  }
  assert.deepEqual(await get('/api/settings'), before_);
  assert.ok(!(await say('how do i get more clients')).undo_token, 'nothing to undo');
});

test('it does not swallow the sentences that were never questions', async () => {
  // "How do I get more clients" was being answered by opening the Clients
  // list, which is the one response nobody asking it wants. Moving the reader
  // in front of navigation is what fixed it — and this is the other half of
  // that, which must not break.
  for (const [q, want] of [
    ['show me my clients', 'went'], ['open growth', 'went'],
    ['show me the calendar tomorrow', 'went'],
    ['turn on review requests', 'done'], ['close the salon on mondays', 'done'],
  ]) {
    const r = await say(q);
    assert.equal(r.kind, want, `"${q}" → ${r.kind}: ${r.said}`);
  }
});

test('the voice says a sentence the way a person would', async () => {
  for (const [raw, want] of [
    ['Sunday is 2pm–6pm now', '2pm to 6pm'],
    ['Saturday is 10am–3pm now', '10am to 3pm'],
    ['Amara Osei · Balayage · 2pm', 'Amara Osei, Balayage, 2pm'],
    ['That is $85.00', '85 dollars'],
    ['You took $1,507.09 last week', '1,507 dollars and 9 cents'],
    ['43% quieter', '43 percent'],
  ]) {
    assert.ok(forSpeech(raw).includes(want), `"${raw}" → "${forSpeech(raw)}"`);
  }
  // A date is not a range. "2026 to 08 to 29" is what a careless version of
  // that rule does to a patch-test record read out loud.
  assert.ok(forSpeech('Pass · 2026-08-29').includes('2026-08-29'));
});

test('the personality never gets between the owner and the receipt', async () => {
  const fact = 'Sunday is 2pm–6pm now';
  for (const kind of ['done', 'went', 'already', 'pathway', 'undone', 'unknown']) {
    assert.ok(speak(kind, fact, 3).endsWith(fact), `${kind}: ${speak(kind, fact, 3)}`);
  }
  // Advice did not DO anything. "Done — 9 of 19 done" reads as though it had.
  assert.ok(!/^(Done|Sorted|No worries|All good)/.test(speak('pathway', 'x', 0)));
});

test('nobody who is not signed in gets any of it', async () => {
  assert.equal((await k.api('GET', '/api/growth/plan')).status, 401);
  assert.equal((await k.api('GET', '/api/growth/content')).status, 401);
  assert.equal((await k.api('PUT', '/api/growth/plan/google-profile', { body: { done: true } })).status, 401);
});
