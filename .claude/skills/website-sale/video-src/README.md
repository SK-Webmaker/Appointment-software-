# Client video: "Put your new website online"

Source for the 4:42 explainer sent to $350 clients. Final MP4 is not committed (52 MB).

Rebuild (from this folder, in a scratch copy):
1. `python3 -m venv venv && ./venv/bin/pip install piper-tts`, then download the voice
   `en_GB-cori-high.onnx` + `.onnx.json` from huggingface.co/rhasspy/piper-voices into `voices/`.
2. Edit narration in `script.json` → `./venv/bin/python build_audio.py` (writes narration.wav + timeline.json).
3. `./venv/bin/python music.py` (soft music bed).
4. `node render.mjs stills 23 60 120` to preview; `node render.mjs video 30` for the full render (~25 min).
5. Mix: see the ffmpeg command in SKILL history (voice loudnorm, music ducked by sidechaincompress).

Scenes live in `index.html` (`SC.<id>`); each animates from the narration beat times in timeline.json.
