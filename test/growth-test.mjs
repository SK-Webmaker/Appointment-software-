// Growth: the plan, the content ideas, and Kai's pathway answers.
//
// The plan's whole claim is that it CHECKS ITSELF — a step is done because the
// setting is on, not because somebody ticked a box. So most of this suite is
// the same shape repeated: read the plan, change the setting, read it again,
// assert the step moved. A checklist that does not move when the thing it
// describes changes is decoration.
//
// What it holds to:
//
//   1. IT MOVES WITH THE BUSINESS. Switch review requests on, the review step
//      ticks. Switch it off, it un-ticks. No caching, no remembering.
//   2. A MANUAL STEP IS HONEST ABOUT IT. Claiming a Google listing happens on
//      Google. Those steps say so and tick by hand — and nothing else does.
//   3. EVERY NUMBER IN A CAPTION IS REAL. The content ideas are templates with
//      the business's own figures in them. A figure that does not match the
//      database is the one failure that would matter.
//   4. ADVICE CHANGES NOTHING. A pathway returns links. It must never write a
//      setting, so asking Kai how to grow can never alter the business.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4947;
const B = `http://localhost:${PORT}`;
const DIR = '/tmp/kairo-growth-test';
let pass = 0, fail = 0;
const ok = (n, c, e = '') => { console.log((c ? '✅' : '❌') + ' ' + n + (e ? ' — ' + e : '')); c ? pass++ : fail++; };

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
process.env.KAIRO_DATA_DIR = DIR;

const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), KAIRO_DATA_DIR: DIR, KAIRO_RATELIMIT: 'off' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
srv.stdout.on('data', () => {}); srv.stderr.on('data', () => {});
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`${B}/api/version`)).ok) break; } catch { /* not up */ }
  await new Promise((r) => setTimeout(r, 250));
}

let cookie = '';
const json = async (m, p, b) => {
  const h = {};
  if (cookie) h.cookie = cookie;
  if (b !== undefined) h['content-type'] = 'application/json';
  const r = await fetch(B + p, { method: m, headers: h, body: b === undefined ? undefined : JSON.stringify(b) });
  if (!cookie && r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0];
  const t = await r.text();
  let d; try { d = JSON.parse(t); } catch { d = t; }
  return { status: r.status, data: d };
};
const say = async (q, turn = 0) => (await json('POST', '/api/ask/do', { q, turn })).data;
const plan = async () => (await json('GET', '/api/growth/plan')).data;
const content = async () => (await json('GET', '/api/growth/content')).data;
const stepOf = (p, id) => p.stages.flatMap((s) => s.steps).find((s) => s.id === id);

try {
  await json('POST', '/api/auth/login', { email: 'admin@kairo.local', password: 'admin123' });
  await json('POST', '/api/setup/skip', {});

  console.log('\n── 1. the plan is a plan');
  {
    const p = await plan();
    ok('five stages', p.stages.length === 5, String(p.stages.length));
    ok('in the order the money arrives',
      p.stages.map((s) => s.id).join(',') === 'found,easy,back,bring,prove',
      p.stages.map((s) => s.id).join(','));
    ok('every step belongs to a stage',
      p.stages.every((s) => s.steps.every((x) => x.stage === s.id)));
    ok('every step says why it matters',
      p.stages.flatMap((s) => s.steps).every((x) => x.why && x.why.length > 20));
    // Three, because sixteen at once is a wall somebody bounces off.
    ok('it asks for three at a time', p.next.length <= 3, String(p.next.length));
    ok('and the three it asks for are undone ones', p.next.every((x) => !x.done));
    ok('the counts add up',
      p.total === p.stages.reduce((n, s) => n + s.total, 0)
      && p.done === p.stages.reduce((n, s) => n + s.done, 0));
  }

  console.log('\n── 2. it checks itself against the business');
  {
    // Review requests off → the step is undone. On → it is done. Nothing is
    // ticked by hand anywhere in this block.
    await json('PUT', '/api/settings', { review_requests_enabled: '0' });
    ok('a switch that is off reads as undone', stepOf(await plan(), 'review-requests').done === false);

    await json('PUT', '/api/settings', { review_requests_enabled: '1' });
    const after = await plan();
    ok('switching it on ticks the step', stepOf(after, 'review-requests').done === true);
    ok('and the total moves with it', after.done >= 1);

    await json('PUT', '/api/settings', { review_requests_enabled: '0' });
    ok('switching it off un-ticks it', stepOf(await plan(), 'review-requests').done === false);

    // The referral step needs BOTH a type and a value — a reward of "$0 off"
    // is an offer nobody acts on, and a plan that counted it would be lying.
    await json('PUT', '/api/settings', { referral_reward_type: 'fixed', referral_reward_value: '0' });
    ok('a reward of nothing is not a referral offer',
      stepOf(await plan(), 'referral-offer').done === false);
    await json('PUT', '/api/settings', { referral_reward_type: 'fixed', referral_reward_value: '10' });
    ok('a real one is', stepOf(await plan(), 'referral-offer').done === true);
  }

  console.log('\n── 3. a manual step is honest about being manual');
  {
    const p = await plan();
    const manual = p.stages.flatMap((s) => s.steps).filter((x) => x.manual);
    ok('some steps happen outside Kairo', manual.length >= 3, String(manual.length));
    ok('and every one of them says so', manual.every((x) => x.manual.length > 10));
    ok('they are exactly the ones that cannot check themselves',
      manual.every((x) => x.checks_itself === false));

    const g = await json('PUT', '/api/growth/plan/google-profile', { done: true });
    ok('ticking one sticks', stepOf(g.data, 'google-profile').done === true);
    ok('and it records when', !!stepOf(g.data, 'google-profile').ticked_on);
    const u = await json('PUT', '/api/growth/plan/google-profile', { done: false });
    ok('un-ticking it sticks too', stepOf(u.data, 'google-profile').done === false);

    const bad = await json('PUT', '/api/growth/plan/not-a-real-step', { done: true });
    ok('a step that does not exist is refused', bad.status === 404, String(bad.status));
  }

  console.log('\n── 4. a tick can never un-do what the setting says');
  {
    // An owner who did it another way may tick a self-checking step. Nobody
    // may make a step that IS on look off — the screen would be telling them
    // to go and do something already done.
    await json('PUT', '/api/settings', { review_requests_enabled: '1' });
    await json('PUT', '/api/growth/plan/review-requests', { done: false });
    ok('the setting wins over the tick', stepOf(await plan(), 'review-requests').done === true);
    await json('PUT', '/api/settings', { review_requests_enabled: '0' });
  }

  console.log('\n── 5. the content ideas come from the business');
  {
    const c = await content();
    ok('there are always ideas', c.ideas.length >= 4, String(c.ideas.length));
    ok('every idea says why it is being suggested',
      c.ideas.every((i) => i.reason && i.reason.length > 20));
    ok('every idea is either a post or something to send',
      c.ideas.every((i) => i.kind === 'post' || i.kind === 'campaign'));
    ok('the posts all carry copy to use',
      c.ideas.filter((i) => i.kind === 'post').every((i) => i.caption && i.caption.length > 20));
    ok('four weeks of it', c.calendar.weeks.length >= 1 && c.calendar.weeks.length <= 4,
      String(c.calendar.weeks.length));
    ok('twice a week, not daily', c.calendar.weeks.every((w) => w.ideas.length <= 2));

    // The numbers have to match the database, or the owner posts something
    // untrue about their own business.
    const top = c.facts.top_service;
    if (top) {
      const idea = c.ideas.find((i) => i.id === 'top-service-proof');
      ok('the top service in the caption is the top service on the books',
        idea && idea.title.includes(top.name), idea?.title);
    } else {
      ok('a business with no history still gets ideas', c.ideas.length >= 4);
    }

    // No booking address set: the caption must not carry an empty hole.
    ok('no link set means "link in bio", not a blank',
      c.ideas.filter((i) => i.caption).every((i) => !/\n\n$/.test(i.caption) && !i.caption.includes('undefined')),
      'a caption ended with nothing after its call to action');
  }

  console.log('\n── 6. Kai lays out a pathway');
  {
    const asks = [
      'how do i get more clients', 'how can i grow my business',
      'what should i do next', 'my business is quiet lately', 'growth plan',
    ];
    for (const q of asks) {
      const r = await say(q);
      ok(`"${q}"`, r.kind === 'pathway' && (r.steps || []).length > 0, `${r.kind}: ${r.said}`);
    }
    const post = await say('what should i post');
    ok('"what should i post" answers with content',
      post.kind === 'pathway' && (post.steps || []).length > 0, `${post.kind}: ${post.said}`);
    ok('and every step has somewhere to go',
      (post.steps || []).every((s) => String(s.href || '').startsWith('#/')),
      JSON.stringify((post.steps || []).map((s) => s.href)));
    ok('the spoken sentence does not repeat the first step word for word',
      !post.said.includes(post.steps[0].detail), post.said);
  }

  console.log('\n── 7. advice changes nothing');
  {
    const before = (await json('GET', '/api/settings')).data;
    for (const q of ['how do i get more clients', 'what should i post', 'i need marketing ideas']) {
      await say(q);
    }
    const after = (await json('GET', '/api/settings')).data;
    ok('no setting moved', JSON.stringify(before) === JSON.stringify(after));
    const r = await say('how do i get more clients');
    ok('and there is nothing to undo', !r.undo_token, String(r.undo_token));
  }

  console.log('\n── 8. it does not swallow the sentences that are not questions');
  {
    const cases = [
      ['show me my clients', 'went'],
      ['open growth', 'went'],
      ['show me the calendar tomorrow', 'went'],
      ['turn on review requests', 'done'],
      ['close the salon on mondays', 'done'],
    ];
    for (const [q, want] of cases) {
      const r = await say(q);
      ok(`"${q}" is still ${want}`, r.kind === want, `${r.kind}: ${r.said}`);
    }
  }

  console.log('\n── 9. the voice says it the way a person would');
  {
    const { forSpeech, speak } = await import(`${ROOT}/src/kai-voice.js`);
    const cases = [
      ['Sunday is 2pm–6pm now', '2pm to 6pm'],
      ['Saturday is 10am–3pm now', '10am to 3pm'],
      ['Amara Osei · Balayage · 2pm', 'Amara Osei, Balayage, 2pm'],
      ['That is $85.00', '85 dollars'],
      ['You took $1,507.09 last week', '1,507 dollars and 9 cents'],
      ['43% quieter', '43 percent'],
    ];
    for (const [raw, want] of cases) {
      ok(`"${raw}" reads as "${want}"`, forSpeech(raw).includes(want), forSpeech(raw));
    }
    // An ISO date is not a range. "2026 to 08 to 29" is what a careless
    // version of that rule does to a patch-test record.
    ok('a date is left alone', forSpeech('Pass · 2026-08-29').includes('2026-08-29'),
      forSpeech('Pass · 2026-08-29'));
    // The invariant the whole voice module exists to protect.
    for (const kind of ['done', 'went', 'already', 'pathway', 'undone', 'unknown']) {
      const fact = 'Sunday is 2pm–6pm now';
      ok(`${kind}: warm still ends with said`, speak(kind, fact, 3).endsWith(fact), speak(kind, fact, 3));
    }
    ok('advice never sounds like a change',
      !/^(Done|Sorted|No worries|All good)/.test(speak('pathway', 'x', 0)), speak('pathway', 'x', 0));
  }

  console.log('\n── 10. a stranger gets none of it');
  {
    const saved = cookie; cookie = '';
    const a = await json('GET', '/api/growth/plan');
    const b = await json('GET', '/api/growth/content');
    const c = await json('PUT', '/api/growth/plan/google-profile', { done: true });
    ok('the plan needs a session', a.status === 401, String(a.status));
    ok('so do the ideas', b.status === 401, String(b.status));
    ok('and so does ticking a step', c.status === 401, String(c.status));
    cookie = saved;
  }
} catch (err) {
  ok('the suite ran', false, err.stack || err.message);
} finally {
  srv.kill('SIGKILL');
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
