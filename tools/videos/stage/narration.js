// What is said in each video, and when. Shared by the stage pages (which
// stretch each scene to fit its words) and by mix.mjs (which places the words
// and writes the captions), so picture, voice and captions can't drift apart.
//
// The voice is ElevenLabs' "Charlie", an Australian voice, generated once per
// video as a single take; `cues` are its sentences, timed in that take.

const VIDEOS = {
  welcome: {
    voice: 'voice/welcome.mp3',
    // where each scene starts and ends in the authored animation
    bounds: [0, 3.1, 7.75, 12.35, 16.7, 22.6, 26.55, 29.5],
    // one line per scene: [start, end, caption] in the voice take
    lines: [
      [[0.05, 1.77, 'Hi, and welcome to Kairo.'], [2.15, 3.13, 'Let me show you around.']],
      [[3.77, 5.45, 'This is your day at a glance:'], [6.07, 9.41, 'every appointment, for everyone on your team, in one place.']],
      [[10.01, 16.41, 'Clients book themselves from your own booking page, on their phone, any time of day, and it lands straight in your calendar.']],
      [[16.93, 22.60, "Each client keeps their visits and notes, like colour formulas, and your dashboard shows how the week's tracking."]],
      [[23.06, 24.70, "And there's no chasing anyone."], [25.10, 29.70, 'Kairo emails your clients before and after every visit, with your name on it,'], [30.18, 31.06, "and it's free."]],
      [[31.50, 32.83, 'Want text reminders as well?'], [33.23, 35.72, "There's a one-minute video for that, whenever you're ready."]],
      [[36.24, 38.13, "Right, let's get your business set up."], [38.53, 39.94, 'It only takes about five minutes.']],
    ],
  },
  sms: {
    voice: 'voice/sms.mp3',
    bounds: [0, 4.95, 9.35, 18.4, 26.7, 34.5, 41.1, 46.95, 54.3, 61],
    lines: [
      [[0.07, 1.47, "Let's switch on text reminders."], [1.89, 4.40, "It's four quick steps, and I'll be with you the whole way."]],
      [[5.00, 9.86, 'In Kairo, open Settings, then Messages, and tap Set up text messages.']],
      [[10.42, 15.39, 'Texts go through ClickSend, an Aussie company you pay directly, just a few cents a text.'], [15.93, 16.85, 'Open a free account.'], [17.15, 18.55, "It's like signing up for anything else."]],
      [[19.17, 21.91, "Once you're in, tap the little key icon up the top."], [22.33, 25.91, "You're after two things: your username and your API key."]],
      [[26.33, 28.71, 'Copy each one into Kairo and tap Connect.'], [29.15, 32.46, "Kairo checks them with ClickSend straight away, so you know they're right."]],
      [[32.88, 34.44, 'Your free credit covers the test.'], [34.90, 37.42, 'Before you go live, pop about $20 on.'], [37.72, 38.84, "That's a few hundred texts."]],
      [[39.34, 41.66, 'Reminders and confirmations are already ticked.'], [42.10, 44.79, 'Check your mobile number, then send yourself a test.']],
      [[45.23, 50.50, 'Texts only switch on once that test goes through, so your clients never get anything half-working.']],
      [[50.94, 51.44, "And that's it!"], [51.92, 54.26, 'Reminders now go by text and email.'], [54.70, 56.75, 'If you ever need a hand, just tap Help.']],
    ],
  },
};

const LEAD = 0.65;     // the scene settles, then the voice starts
const TAIL = 0.75;     // a breath after the last word before the next scene
const EDGE = 0.9;      // entrances and exits keep their authored speed

/**
 * Lay a video out: each scene as long as its words need (never shorter than
 * it was drawn), the warp that stretches the drawing to fit, where each line
 * of voice goes, and the captions.
 */
export function plan(name) {
  const v = VIDEOS[name];
  const n = v.lines.length;
  const warp = [];
  const placed = [];
  const cues = [];
  let at = 0;
  for (let i = 0; i < n; i++) {
    const a = v.bounds[i], b = v.bounds[i + 1], drawn = b - a;
    const line = v.lines[i];
    const said = line[line.length - 1][1] - line[0][0];
    const last = i === n - 1;
    const lead = last ? 0.85 : i === 0 ? 0.7 : LEAD;
    const len = Math.max(drawn, lead + said + (last ? 1.9 : TAIL));
    const inT = Math.min(EDGE, drawn / 3), outT = last ? 0 : Math.min(0.6, drawn / 3);
    warp.push([at, a], [at + inT, a + inT]);
    if (outT) warp.push([at + len - outT, b - outT]);
    warp.push([at + len, b]);
    const start = at + lead;
    placed.push({ start, from: line[0][0], to: line[line.length - 1][1] });
    for (const [s, e, text] of line) cues.push(...splitCue(start + (s - line[0][0]), start + (e - line[0][0]), text));
    at += len;
  }
  // drop repeated points where two scenes meet
  const pts = warp.filter((p, i) => i === 0 || p[0] > warp[i - 1][0] + 1e-6);
  return { voice: v.voice, duration: at, warp: pts, placed, cues };
}

/** A long sentence becomes two captions, split at the comma nearest its middle. */
function splitCue(s, e, text) {
  if (text.length <= 64) return [[s, e, text]];
  const mid = text.length / 2;
  let best = -1;
  for (let i = 0; i < text.length; i++) if (text[i] === ',' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  if (best < 0) return [[s, e, text]];
  const k = (best + 1) / text.length;
  const t = s + (e - s) * k;
  return [[s, t, text.slice(0, best + 1).trim()], [t, e, text.slice(best + 1).trim()]];
}
