"""Voice each beat with Piper, lay them on one timeline, and write timeline.json + narration.wav."""
import json, subprocess, wave, pathlib, sys

HERE = pathlib.Path(__file__).parent
VOICE = HERE / "voices" / (sys.argv[1] if len(sys.argv) > 1 else "en_GB-cori-high")
RATE = 22050
CARD = 2.8        # chapter title card, silent
LEAD = 0.5        # pause before first beat of a scene
GAP = 0.55        # pause between beats
TAIL = 0.9        # pause after last beat

script = json.loads((HERE / "script.json").read_text())
clips = HERE / "clips"; clips.mkdir(exist_ok=True)
pcm = bytearray(); t = 0.0; timeline = []

def silence(sec):
    global t
    n = int(sec * RATE); pcm.extend(b"\0\0" * n); t += n / RATE

for s in script:
    scene = {"id": s["id"], "start": round(t, 3), "beats": []}
    for k in ("chapter", "title", "caption"):
        if k in s: scene[k] = s[k]
    if "chapter" in s:
        scene["card"] = CARD; silence(CARD)
    silence(LEAD)
    for i, text in enumerate(s["beats"]):
        f = clips / f"{s['id']}-{i}.wav"
        subprocess.run([str(HERE / "venv/bin/piper"), "-m", f"{VOICE}.onnx", "-f", str(f),
                        "--length-scale", "1.06", "--sentence-silence", "0.25"],
                       input=text.encode(), check=True, capture_output=True)
        with wave.open(str(f)) as w:
            assert w.getframerate() == RATE and w.getsampwidth() == 2 and w.getnchannels() == 1
            data = w.readframes(w.getnframes())
        b0 = t; pcm.extend(data); t += len(data) / 2 / RATE
        scene["beats"].append({"start": round(b0 - scene["start"], 3), "end": round(t - scene["start"], 3), "text": text})
        silence(GAP if i < len(s["beats"]) - 1 else TAIL)
    if s.get("hold"): silence(s["hold"])
    scene["dur"] = round(t - scene["start"], 3)
    timeline.append(scene)

with wave.open(str(HERE / "narration.wav"), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE); w.writeframes(bytes(pcm))
(HERE / "timeline.json").write_text(json.dumps({"total": round(t, 3), "scenes": timeline}, indent=1))
print(f"total {t:.1f}s")
for sc in timeline: print(f"  {sc['id']:8s} start {sc['start']:6.1f}  dur {sc['dur']:5.1f}  beats {len(sc['beats'])}")
