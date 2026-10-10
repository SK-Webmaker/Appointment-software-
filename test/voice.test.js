// Kai listening: it waits for the owner to finish, prefers the hearing that
// names something in Kairo, survives the recogniser quitting early, and says
// what went wrong in words. Driven by a stand-in for the browser's recogniser,
// so every case is exact rather than whatever a microphone happens to hear.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

let made = [];
class FakeRecognition {
  constructor() { made.push(this); this.started = 0; }
  start() { this.started += 1; }
  stop() { setTimeout(() => this.onend?.(), 1); }
  abort() { this.aborted = true; setTimeout(() => this.onend?.(), 1); }
  // One result: alternatives are strings; `final` marks the phrase finished.
  say(alts, final) {
    const r = alts.map((t) => ({ transcript: t }));
    r.isFinal = final;
    this.onresult?.({ resultIndex: 0, results: [r] });
  }
}

let voice;
before(async () => {
  globalThis.window = { SpeechRecognition: FakeRecognition };
  // Node has a read-only navigator of its own; this one speaks Australian English.
  Object.defineProperty(globalThis, 'navigator', { value: { language: 'en-AU' }, configurable: true });
  voice = await import('../public/js/voice.js');
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const session = (opts = {}) => {
  made = [];
  const out = { interim: [], final: [], errors: [] };
  const h = voice.listen({
    silenceMs: 40, maxMs: 2000, ...opts,
    onInterim: (t) => out.interim.push(t), onFinal: (t) => out.final.push(t), onError: (m, code) => out.errors.push([m, code]),
  });
  return { out, h, rec: () => made[made.length - 1] };
};

test('it waits through a pause, and hands over the whole sentence once', async () => {
  const { out, rec } = session();
  rec().say(["move jane's three o'clock"], true);
  await wait(20);                       // shorter than the silence: still listening
  assert.equal(out.final.length, 0);
  rec().say(['to friday'], false);
  rec().say(['to friday'], true);
  await wait(90);
  assert.deepEqual(out.final, ["move jane's three o'clock to friday"]);
  assert.ok(out.interim.includes("move jane's three o'clock to friday"), 'the words appear as they are said');
});

test('of the hearings offered, the one that names something in Kairo wins', async () => {
  const { out, rec } = session();
  rec().say(['show me the colander', 'show me the calendar'], true);
  await wait(90);
  assert.deepEqual(out.final, ['show me the calendar']);
});

test('the first hearing stands when none names anything', async () => {
  const { out, rec } = session();
  rec().say(['hello there', 'yellow there'], true);
  await wait(90);
  assert.deepEqual(out.final, ['hello there']);
});

test('a recogniser that quits before anyone spoke is started again, once', async () => {
  const { out } = session();
  const first = made[0];
  first.onend();
  assert.equal(made.length, 2, 'started again');
  made[1].say(['open my clients'], true);
  await wait(90);
  assert.deepEqual(out.final, ['open my clients']);
});

test('a blocked microphone is said in words, not a silent button', async () => {
  const { out, rec } = session();
  rec().onerror({ error: 'not-allowed' });
  assert.equal(out.errors.length, 1);
  assert.match(out.errors[0][0], /microphone is blocked/i);
  assert.equal(out.final.length, 0);
});

test('pressing again before a word is said stops without sending anything', async () => {
  const { out, h, rec } = session();
  h.stop();
  assert.ok(rec().aborted);
  await wait(30);
  assert.deepEqual(out.final, []);
});

test('pressing again mid-sentence sends what was heard', async () => {
  const { out, h, rec } = session();
  rec().say(['show me tomorrow'], false);
  h.stop();
  await wait(20);
  assert.deepEqual(out.final, ['show me tomorrow']);
});

test('closing drops what was heard', async () => {
  const { out, h, rec } = session();
  rec().say(['show me tomorrow'], false);
  h.abort();
  await wait(60);
  assert.deepEqual(out.final, []);
});
