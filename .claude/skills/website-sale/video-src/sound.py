"""Upbeat music bed (music.wav) + sound effects track (sfx.wav), both stereo 44.1k."""
import json, wave, pathlib, numpy as np
HERE = pathlib.Path(__file__).parent
SR = 44100
total = json.loads((HERE / "timeline.json").read_text())["total"] + 1.0
N = int(total * SR); t = np.arange(N) / SR
rng = np.random.default_rng(7)
f = lambda m: 440 * 2 ** ((m - 69) / 12)

def lp(x, a):  # one-pole low-pass, a in (0,1): smaller = darker
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)): acc += a * (x[i] - acc); y[i] = acc
    return y

def write(name, L, R):
    mx = max(np.abs(L).max(), np.abs(R).max(), 1e-9)
    st = (np.stack([L, R], 1) / mx * 0.9 * 32767).astype(np.int16)
    with wave.open(str(HERE / name), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(st.tobytes())

# ---------------- music: 100 bpm, C - G - Am - F ----------------
BPM = 100; beat = 60 / BPM; bar = 4 * beat
prog = [[60, 64, 67, 71], [55, 62, 67, 71], [57, 60, 64, 67], [53, 60, 65, 69]]   # Cmaj7 G Am7 Fmaj7
roots = [36, 43, 45, 41]
L = np.zeros(N); R = np.zeros(N)
def add(sig, start, pan=0.5, gain=1.0):
    i0 = int(start * SR); i1 = min(N, i0 + len(sig))
    if i0 >= N: return
    s = sig[: i1 - i0] * gain; L[i0:i1] += s * (1 - pan); R[i0:i1] += s * pan
nbars = int(total / bar) + 1
for b in range(nbars):
    ch = prog[b % 4]; s0 = b * bar
    # pad (whole bar, soft attack)
    n = int((bar + .3) * SR); tt = np.arange(n) / SR
    env = np.clip(tt / .35, 0, 1) * np.clip((bar + .3 - tt) / .5, 0, 1)
    for k, m in enumerate(ch):
        tone = np.sin(2 * np.pi * f(m) * tt) + .3 * np.sin(2 * np.pi * f(m) * 2.003 * tt)
        add(tone * env, s0, .3 + .13 * k, .045)
    # bass: root on 1 and the "and" of 2
    for off in (0, 1.5 * beat, 2 * beat, 3.5 * beat):
        n = int(.45 * SR); tt = np.arange(n) / SR
        bs = np.sin(2 * np.pi * f(roots[b % 4]) * tt) * np.exp(-tt * 5) * (1 - np.exp(-tt * 200))
        add(bs, s0 + off, .5, .32)
    # plucked arpeggio in 8ths
    pat = [0, 1, 2, 3, 2, 1, 2, 3]
    for j in range(8):
        m = ch[pat[j]] + 12; n = int(.5 * SR); tt = np.arange(n) / SR
        pl = (np.sin(2 * np.pi * f(m) * tt) + .25 * np.sin(4 * np.pi * f(m) * tt)) * np.exp(-tt * 9) * (1 - np.exp(-tt * 300))
        add(pl, s0 + j * beat / 2, .25 if j % 2 else .75, .07)
    # soft kick on 1 and 3, clap-ish snare on 2 and 4, quiet shaker on 8ths
    if b >= 2:  # let the intro breathe for two bars
        for kb in (0, 2):
            n = int(.35 * SR); tt = np.arange(n) / SR
            fr = 45 + 75 * np.exp(-tt * 30)
            kick = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-tt * 9)
            add(kick, s0 + kb * beat, .5, .55)
        for sb in (1, 3):
            n = int(.25 * SR); tt = np.arange(n) / SR
            sn = rng.standard_normal(n) * np.exp(-tt * 22)
            sn = sn - lp(sn, .08)  # high-pass-ish
            add(sn, s0 + sb * beat, .55, .10)
        for h in range(8):
            n = int(.06 * SR); tt = np.arange(n) / SR
            hh = rng.standard_normal(n); hh = (hh - lp(hh, .3)) * np.exp(-tt * 70)
            add(hh, s0 + h * beat / 2, .35 if h % 2 else .65, .035 if h % 2 else .02)
fade = np.clip(t / 2.5, 0, 1) * np.clip((total - t) / 4, 0, 1)
write("music.wav", L * fade, R * fade)

# ---------------- sound effects ----------------
L = np.zeros(N); R = np.zeros(N)
def tone(freqs, dur, decay, gain, delay=0.0):
    n = int((dur + delay) * SR); tt = np.arange(n) / SR - delay; out = np.zeros(n)
    m = tt >= 0
    for fr in freqs: out[m] += np.sin(2 * np.pi * fr * tt[m]) * np.exp(-tt[m] * decay) * (1 - np.exp(-tt[m] * 400))
    return out * gain
def noise(dur):
    return rng.standard_normal(int(dur * SR))
S = {}
c = noise(.03); tt = np.arange(len(c)) / SR; c = (c - lp(c, .25)) * np.exp(-tt * 180)
S["click"] = c * .5 + tone([2400], .03, 160, .25)
tt = np.arange(int(.12 * SR)) / SR
S["pop"] = np.sin(2 * np.pi * (520 * tt + 2200 * tt * tt)) * np.exp(-tt * 30) * (1 - np.exp(-tt * 600)) * .28
def whoosh(dur, rise):
    n = noise(dur); tt = np.arange(len(n)) / SR
    env = np.where(tt < rise, (tt / rise) ** 2, np.exp(-(tt - rise) * 6))
    a = np.clip(.02 + .25 * env, .01, .4)
    y = np.empty_like(n); acc = 0.0
    for i in range(len(n)): acc += a[i] * (n[i] - acc); y[i] = acc
    return y * env * 1.2
S["whoosh"] = whoosh(.9, .45); S["whoosh2"] = whoosh(.6, .25) * .7; S["soft"] = whoosh(1.2, .7) * .45
S["chime"] = sum(np.pad(tone([f(m), f(m) * 2], 1.4, 4, .16, delay=d), (0, int(1.7 * SR)))[: int(1.6 * SR)] for m, d in [(84, 0), (88, .07), (91, .14)])
S["ding"] = tone([f(88), f(100) * .3], .9, 5, .2) + np.pad(tone([f(93), f(105) * .3], .9, 5, .22), (int(.09 * SR), 0))[: int(.9 * SR)]
S["tick"] = tone([f(96)], .25, 25, .14)
for k in S: S[k] = np.asarray(S[k], dtype=float)
gain = {"click": 1.0, "pop": .8, "whoosh": .9, "whoosh2": .7, "soft": .8, "chime": 1.0, "ding": 1.0, "tick": .9}
for e in json.loads((HERE / "sfx.json").read_text()):
    sig = S[e["type"]] * gain[e["type"]]; i0 = int(e["t"] * SR); i1 = min(N, i0 + len(sig))
    if i0 < 0 or i0 >= N: continue
    pan = .6 if e["type"] in ("whoosh",) else .5
    L[i0:i1] += sig[: i1 - i0] * (1 - pan) * 2; R[i0:i1] += sig[: i1 - i0] * pan * 2
write("sfx.wav", L, R)
print("music + sfx", round(total, 1), "s")
