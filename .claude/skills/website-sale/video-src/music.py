"""Soft ambient bed: slow warm chord pads + a gentle plucked arpeggio. Writes music.wav (stereo, 44.1k)."""
import json, wave, numpy as np, pathlib
HERE = pathlib.Path(__file__).parent
SR = 44100
total = json.loads((HERE / "timeline.json").read_text())["total"] + 1.0
n = int(total * SR); t = np.arange(n) / SR
f = lambda m: 440 * 2 ** ((m - 69) / 12)
# Cmaj9 - Am9 - Fmaj9 - Gsus, 8 s each (60 bpm feel)
chords = [[48, 55, 59, 62, 64], [45, 52, 55, 59, 60], [41, 48, 52, 55, 57], [43, 50, 55, 57, 62]]
BAR = 8.0
L = np.zeros(n); R = np.zeros(n)
for ci in range(int(total // BAR) + 2):
    ch = chords[ci % 4]; s0 = ci * BAR
    i0 = int(max(0, s0 - 1.5) * SR); i1 = min(n, int((s0 + BAR + 1.5) * SR))
    if i0 >= n: break
    tt = t[i0:i1] - s0
    env = np.clip((tt + 1.5) / 2.5, 0, 1) * np.clip((BAR + 1.5 - tt) / 2.5, 0, 1)
    env = env ** 1.5
    for k, m in enumerate(ch):
        fr = f(m); det = 1 + 0.0025 * (k - 2)
        tone = (np.sin(2 * np.pi * fr * tt) + 0.35 * np.sin(2 * np.pi * fr * 2 * tt) + 0.5 * np.sin(2 * np.pi * fr * det * tt + 1.3))
        pan = 0.5 + 0.18 * (k - 2) / 2
        L[i0:i1] += tone * env * (1 - pan) * 0.06; R[i0:i1] += tone * env * pan * 0.06
    # arpeggio: one note every 1 s, soft pluck
    for j in range(8):
        ts = s0 + j * 1.0
        if ts >= total: break
        m = ch[[1, 2, 3, 4, 3, 2, 3, 4][j]] + 12
        a0 = int(ts * SR); a1 = min(n, a0 + int(2.2 * SR)); ta = t[a0:a1] - ts
        pl = np.sin(2 * np.pi * f(m) * ta) * np.exp(-ta * 2.6) * (1 - np.exp(-ta * 80)) * 0.05
        p = 0.35 if j % 2 else 0.65
        L[a0:a1] += pl * (1 - p); R[a0:a1] += pl * p
# simple feedback echo for space
d = int(0.375 * SR)
for x in (L, R):
    for i in range(3):
        x[d * (i + 1):] += x[:-d * (i + 1)] * (0.28 / (i + 1))
mx = max(np.abs(L).max(), np.abs(R).max()); L /= mx; R /= mx
fade = np.clip(t / 3, 0, 1) * np.clip((total - t) / 4, 0, 1); L *= fade * 0.8; R *= fade * 0.8
st = (np.stack([L, R], 1) * 32767).astype(np.int16)
with wave.open(str(HERE / "music.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(st.tobytes())
print("music", round(total, 1), "s")
