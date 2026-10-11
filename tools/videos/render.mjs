// Render a stage page frame by frame and encode it: node render.mjs <page.html> <out.mp4> [fps] [scale] [from] [to]
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
const [page, out, fpsArg = '30', scaleArg = '1.5', fromArg, toArg] = process.argv.slice(2);
const fps = Number(fpsArg), scale = Number(scaleArg);
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--allow-file-access-from-files', '--force-color-profile=srgb'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: scale });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const u = new URL(page, 'file://' + process.cwd() + '/'); await p.goto(u.href);
await p.waitForFunction(() => window.ready && window.DURATION);
await p.evaluate(() => window.ready);
const dur = await p.evaluate(() => window.DURATION);
const from = fromArg ? Number(fromArg) : 0, to = toArg ? Number(toArg) : dur;
if (out.endsWith('.jpg') || out.endsWith('.png')) {
  await p.evaluate((t) => window.seek(t), from); await p.waitForTimeout(50);
  await p.screenshot({ path: out, type: out.endsWith('.jpg') ? 'jpeg' : 'png', quality: out.endsWith('.jpg') ? 88 : undefined });
  console.log('still', out, errs.length ? errs : ''); await b.close(); process.exit(0);
}
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.0',
  '-movflags', '+faststart', '-tune', 'stillimage', out], { stdio: ['pipe', 'inherit', 'inherit'] });
const frames = Math.round((to - from) * fps);
const t0 = Date.now();
for (let i = 0; i < frames; i++) {
  await p.evaluate((t) => window.seek(t), from + i / fps);
  const buf = await p.screenshot({ type: 'jpeg', quality: 94 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % 300 === 0) console.log(`frame ${i}/${frames} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
console.log('done', out, frames, 'frames', errs.length ? errs : 'no errors');
await b.close();
