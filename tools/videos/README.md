# The how-to videos

Two videos ship in `public/videos/` (and on the website, in the guide):

| File | Length | Where it plays |
| --- | --- | --- |
| `kairo-welcome` | 48 s | The first screen of setup (starts by itself, muted, with captions and a **Sound on** button), Help, the guide |
| `kairo-sms-setup` | 1 min 8 s | Settings → Messages, the text setup walkthrough, Help, the guide |

Each is an `.mp4` (H.264 and AAC, what every Apple device plays) and a `.webm`
(VP9 and Opus, for browsers without H.264), a `.jpg` still shown until it is
pressed, and a `.vtt` of the captions. The server answers byte ranges for the
videos, which Safari needs to play anything.

## The voice and the music

Both are narrated by ElevenLabs' **Charlie**, an Australian voice, speaking as
a tutor rather than reading the screen. Each video's narration is one take,
kept in `voice/`; `stage/narration.js` holds its sentences, timed in that take,
one line per scene. From that one file:

- each stage page stretches its scenes to fit what is said over them (the
  entrances and exits keep their speed; only the held part in the middle
  slows), so nothing has to be re-keyframed when the words change;
- `mix.mjs` places each line on its scene and writes the captions.

The music is written by `music.mjs` rather than licensed: a slow D major
progression on a soft pad, a few felt-piano notes and a quiet bass, in a room.
It sits about 13 dB under the voice and dips a few more decibels while someone
is talking. The voice is mixed to about -16 LUFS.

To change what is said: generate a new take for that video (Picsart's
`eleven-v4` model, voice `IKne3meq5aSn9XLyUdCD`, about one credit), transcribe
it for the sentence times, put both in `voice/` and `stage/narration.js`, and
render again.

Nothing in them is a mockup except one labelled picture: the Kairo screens are
captures of Kairo running against a scratch database, and the ClickSend sign-up
page is ClickSend's real page. ClickSend's API Credentials screen needs an
account to see, so the video draws a simplified version of it and says so on
screen. If ClickSend's layout changes, that picture is the one to check.

## Making them again

The page under `stage/` is a scripted animation; `render.mjs` steps it one
frame at a time and pipes the frames to ffmpeg, so every render is identical.

```bash
npm i --no-save playwright-core    # the only thing this needs, and only here
cd tools/videos

# 1. capture the screens into ./shots (a scratch Kairo, a stand-in ClickSend —
#    nothing real is sent)
node capture-kairo.mjs
node capture-welcome.mjs
# ClickSend's real sign-up and login pages (needs network; behind a TLS proxy,
# pass its key pin in SPKI and HTTPS_PROXY)
node capture-clicksend.mjs

# 2. stills and videos
node render.mjs "stage/poster.html?a=Text%20reminders&b=Set%20up%20in%20four%20steps&c=On%20the%20real%20ClickSend%20pages&d=1%20min" ../../public/videos/kairo-sms-setup.jpg 30 1 0
node render.mjs "stage/poster.html?a=Start%20here&b=Welcome%20to%20Kairo&c=A%20quick%20tour%20of%20what%27s%20ready%20for%20you&d=48%20sec" ../../public/videos/kairo-welcome.jpg 30 1 0
mkdir -p out
node render.mjs stage/welcome.html out/welcome.mp4 30 1
node render.mjs stage/sms.html out/sms.mp4 30 1.5

# 3. the soundtracks and captions (voice placed on each scene, music under it)
node mix.mjs welcome out
node mix.mjs sms out

# 4. picture and sound together
ffmpeg -y -i out/welcome.mp4 -i out/welcome.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 128k -movflags +faststart -shortest ../../public/videos/kairo-welcome.mp4
ffmpeg -y -i out/sms.mp4 -i out/sms.wav -map 0:v -map 1:a -c:v libx264 -preset slow -crf 23 -tune stillimage -pix_fmt yuv420p \
  -c:a aac -b:a 128k -movflags +faststart -shortest ../../public/videos/kairo-sms-setup.mp4
for n in kairo-welcome kairo-sms-setup; do
  ffmpeg -y -i ../../public/videos/$n.mp4 -c:v libvpx-vp9 -b:v 0 -crf 36 -row-mt 1 -c:a libopus -b:a 96k ../../public/videos/$n.webm
done
cp out/welcome.vtt ../../public/videos/kairo-welcome.vtt
cp out/sms.vtt ../../public/videos/kairo-sms-setup.vtt
```

`node render.mjs <page> <out.png> 30 1 <seconds>` renders one frame — the
quick way to check a moment before rendering the whole thing (the time is on
the stretched timeline, the one the voice is on). Copy the four video files,
two stills and two caption files into the website's `public/videos/`
afterwards. The SMS video is re-encoded a little smaller because a test keeps
every video under 10 MB for phones.
