// The soundtrack and captions for one video: each line of narration placed on
// its scene (narration.js), the music under it, dipping while someone talks.
//
//   node mix.mjs <welcome|sms> <out-dir>
// writes <out-dir>/<name>.wav (stereo, 44.1 kHz) and <out-dir>/<name>.vtt
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { plan } from './stage/narration.js';

const [name, outDir] = process.argv.slice(2);
const p = plan(name);
const here = path.dirname(new URL(import.meta.url).pathname);
const run = (args) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(' ')}`);
};
const music = path.join(outDir, `${name}-music.wav`);
spawnSync(process.execPath, [path.join(here, 'music.mjs'), String(p.duration), music], { stdio: 'inherit' });

// Each line cut from the take with a little air either side, and placed.
const parts = p.placed.map((l, i) => {
  const from = Math.max(0, l.from - 0.12), to = l.to + 0.25;
  const delay = Math.max(0, Math.round((l.start - (l.from - from)) * 1000));
  const len = to - from;
  return `[0:a]atrim=start=${from.toFixed(3)}:end=${to.toFixed(3)},asetpts=PTS-STARTPTS,`
    + `afade=t=in:d=0.02,afade=t=out:st=${(len - 0.08).toFixed(3)}:d=0.08,adelay=${delay}[v${i}]`;
});
const voices = p.placed.map((_, i) => `[v${i}]`).join('');
const D = p.duration.toFixed(3);
const graph = [
  ...parts,
  // the voice: a gentle high-pass, lifted to about -16 LUFS in stereo (the take is -28 mono)
  `${voices}amix=inputs=${p.placed.length}:normalize=0,highpass=f=70,volume=10dB,apad,atrim=end=${D},asplit=2[vo][key]`,
  // the music about 13 dB under, and dipping a few more while someone talks
  `[1:a]volume=-13dB[mus]`,
  `[mus][key]sidechaincompress=threshold=0.015:ratio=3.5:attack=140:release=1100:knee=4[duck]`,
  `[vo]pan=stereo|c0=c0|c1=c0[vs]`,
  `[vs][duck]amix=inputs=2:normalize=0,alimiter=limit=0.84:level=false,atrim=end=${D}[out]`,
];
const wav = path.join(outDir, `${name}.wav`);
run(['-i', path.join(here, p.voice), '-i', music, '-filter_complex', graph.join(';'), '-map', '[out]', '-ar', '44100', '-ac', '2', wav]);

// Captions, for anyone watching with the sound off.
const ts = (t) => { const ms = Math.round(t * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`; };
// each caption stays up a beat after its last word, but never onto the next one
const vtt = ['WEBVTT', '', ...p.cues.flatMap(([s, e, text], i) => {
  const next = p.cues[i + 1]?.[0] ?? Infinity;
  return [`${i + 1}`, `${ts(s)} --> ${ts(Math.min(e + 0.25, next - 0.04))}`, text, ''];
})].join('\n');
fs.writeFileSync(path.join(outDir, `${name}.vtt`), vtt);
console.log('mixed', wav, D, 's;', p.cues.length, 'captions');
