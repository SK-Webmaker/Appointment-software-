// The music under the narration, written from scratch rather than licensed: a
// slow D major progression on a soft pad, a few felt-piano notes, a quiet
// bass, and a room around them. Seeded, so every render is identical.
//
//   node music.mjs <seconds> <out.wav>
import fs from 'node:fs';

const [secArg, out] = process.argv.slice(2);
const SR = 44100;
const DUR = Number(secArg);
const N = Math.ceil(DUR * SR);

// ── a seeded random, for the human touch in the piano ──
let seed = 0x5eed1e;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12); // MIDI note → Hz
const BEAT = 60 / 70;               // 70 bpm
const CHORD = BEAT * 8;             // two bars of 4/4 per chord
// Voiced so only one note moves at each change.
const PROG = [
  { bass: 38, pad: [54, 57, 61, 64], keys: [69, 76, 78, 73, 69] }, // Dmaj9
  { bass: 35, pad: [54, 57, 61, 62], keys: [66, 74, 73, 69, 66] }, // Bm9
  { bass: 43, pad: [54, 57, 59, 62], keys: [74, 71, 78, 69, 74] }, // Gmaj9
  { bass: 33, pad: [54, 57, 59, 64], keys: [76, 71, 78, 76, 69] }, // Asus2(6)
];
const KEY_BEATS = [0, 1.5, 3, 4.5, 6];
const KEY_VEL = [0.8, 0.55, 0.66, 0.5, 0.6];

const dry = [new Float32Array(N), new Float32Array(N)];
const send = new Float32Array(N); // into the room

// ── the pad: one warm single-cycle wave (a rounded-off saw), three detuned voices a note ──
const TABLE = 4096;
const wave = new Float32Array(TABLE + 1);
for (let i = 0; i <= TABLE; i++) {
  let v = 0;
  for (let n = 1; n <= 10; n++) v += Math.sin((2 * Math.PI * n * i) / TABLE) * (1 / n) * Math.exp(-(n - 1) / 2.4);
  wave[i] = v;
}
const peak = Math.max(...wave.map(Math.abs));
for (let i = 0; i <= TABLE; i++) wave[i] /= peak;
const look = (ph) => { const x = ph * TABLE; const i = x | 0; return wave[i] + (wave[i + 1] - wave[i]) * (x - i); };

const chords = Math.max(1, Math.ceil((DUR - 2) / CHORD));
for (let c = 0; c < chords; c++) {
  const last = c === chords - 1;
  const ch = last ? PROG[0] : PROG[c % PROG.length];       // always come home to D
  const t0 = c * CHORD;
  const t1 = last ? DUR : t0 + CHORD;
  const ATT = c === 0 ? 2.6 : 1.9, REL = 2.8;
  const i0 = Math.floor(t0 * SR), i1 = Math.min(N, Math.ceil((t1 + REL) * SR));
  const env = (t) => {
    const a = Math.min(1, (t - t0) / ATT);
    const up = Math.sin((a * Math.PI) / 2) ** 2;
    return t < t1 ? up : up * Math.exp(-(t - t1) / (REL / 3.2));
  };
  ch.pad.forEach((m, k) => {
    [[-7, -0.55], [0, 0], [7, 0.55]].forEach(([cents, pan], vi) => {
      const f = hz(m) * Math.pow(2, cents / 1200);
      let ph = rnd();
      const lfo = 0.13 + 0.05 * vi + 0.02 * k, lph = rnd() * 6.28;
      const gL = Math.cos(((pan + 1) * Math.PI) / 4), gR = Math.sin(((pan + 1) * Math.PI) / 4);
      for (let i = i0; i < i1; i++) {
        const t = i / SR;
        ph += f / SR; if (ph >= 1) ph -= 1;
        const s = look(ph) * env(t) * 0.045 * (1 + 0.1 * Math.sin(6.283 * lfo * t + lph));
        dry[0][i] += s * gL; dry[1][i] += s * gR; send[i] += s * 0.9;
      }
    });
  });
  // the bass: a round sine, very low in the mix
  { const f = hz(ch.bass); let ph = 0;
    for (let i = i0; i < i1; i++) {
      const t = i / SR; ph += f / SR;
      const s = Math.sin(6.283185 * ph) * env(t) * 0.06;
      dry[0][i] += s; dry[1][i] += s;
    } }
  // the piano: a handful of notes across the two bars; the last chord just rings
  const beats = last ? [0, 0.04] : KEY_BEATS;
  beats.forEach((b, j) => {
    const m = last ? [74, 69][j] : ch.keys[j];
    const vel = last ? 0.7 : KEY_VEL[j] * (0.92 + rnd() * 0.12);
    const at = t0 + b * BEAT + (c === 0 && j === 0 ? 0.5 : (rnd() - 0.5) * 0.024);
    if (at > DUR - 2.5) return;
    piano(m, at, vel, (j % 2 ? 0.25 : -0.2));
  });
}

function piano(m, at, vel, pan) {
  const f = hz(m), B = 0.00035;
  const i0 = Math.floor(at * SR), len = Math.floor(4.5 * SR);
  const gL = Math.cos(((pan + 1) * Math.PI) / 4), gR = Math.sin(((pan + 1) * Math.PI) / 4);
  const parts = [];
  for (let n = 1; n <= 8; n++) parts.push({ f: n * f * Math.sqrt(1 + B * n * n), a: 1 / Math.pow(n, 1.35), tau: 2.4 / (1 + 0.45 * (n - 1)) });
  for (let k = 0; k < len && i0 + k < N; k++) {
    const t = k / SR;
    const att = Math.min(1, t / 0.008);
    let s = 0;
    for (const p of parts) s += Math.sin(6.283185 * p.f * t) * p.a * Math.exp(-t / p.tau);
    s *= att * vel * 0.085;
    dry[0][i0 + k] += s * gL; dry[1][i0 + k] += s * gR; send[i0 + k] += s * 1.15;
  }
}

// ── the room: Freeverb, stereo ──
function room(input, spread) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((d) => ({ buf: new Float32Array(d + spread), i: 0, store: 0 }));
  const alls = [556, 441, 341, 225].map((d) => ({ buf: new Float32Array(d + spread), i: 0 }));
  const fb = 0.84, damp = 0.45, o = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    const x = input[n] * 0.015;
    let y = 0;
    for (const c of combs) {
      const v = c.buf[c.i];
      c.store = v * (1 - damp) + c.store * damp;
      c.buf[c.i] = x + c.store * fb;
      if (++c.i >= c.buf.length) c.i = 0;
      y += v;
    }
    for (const a of alls) {
      const v = a.buf[a.i];
      a.buf[a.i] = y + v * 0.5;
      if (++a.i >= a.buf.length) a.i = 0;
      y = v - y;
    }
    o[n] = y;
  }
  return o;
}
const wet = [room(send, 0), room(send, 23)];
// A room fed held notes rings louder on one side than the other, so each side
// is set to the same level: about 5 dB under the dry sound.
const rms = (a) => Math.sqrt(a.reduce((n, v) => n + v * v, 0) / a.length);
const target = 0.56 * (rms(dry[0]) + rms(dry[1])) / 2;
for (const w of wet) { const g = target / rms(w); for (let n = 0; n < N; n++) w[n] *= g; }

// ── master: wet and dry together, the rumble off, faded in and out, to -3 dBFS ──
const mix = [new Float32Array(N), new Float32Array(N)];
let top = 0;
for (let ch = 0; ch < 2; ch++) {
  let hp = 0, prev = 0;
  for (let n = 0; n < N; n++) {
    const x = dry[ch][n] + wet[ch][n];
    hp = 0.9943 * (hp + x - prev); prev = x;   // ~40 Hz high-pass
    const t = n / SR;
    const fade = Math.min(1, t / 1.6) * Math.min(1, (DUR - t) / 3.5);
    mix[ch][n] = hp * Math.max(0, fade);
    top = Math.max(top, Math.abs(mix[ch][n]));
  }
}
const gain = 0.708 / top;
const pcm = Buffer.alloc(44 + N * 4);
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 4, 4); pcm.write('WAVE', 8);
pcm.write('fmt ', 12); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22);
pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34);
pcm.write('data', 36); pcm.writeUInt32LE(N * 4, 40);
for (let n = 0; n < N; n++) for (let ch = 0; ch < 2; ch++) {
  pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(mix[ch][n] * gain * 32767))), 44 + n * 4 + ch * 2);
}
fs.writeFileSync(out, pcm);
console.log('music', out, DUR.toFixed(2), 's');
