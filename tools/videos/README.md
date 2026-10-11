# The how-to videos

Two videos ship in `public/videos/` (and on the website, in the guide):

| File | Length | Where it plays |
| --- | --- | --- |
| `kairo-welcome` | 30 s | The first screen of setup (plays by itself, muted), Help, the guide |
| `kairo-sms-setup` | 1 min | Settings → Messages, the text setup walkthrough, Help, the guide |

Each is an `.mp4` (H.264, what every Apple device plays) and a `.webm` (VP9,
for browsers without H.264), plus a `.jpg` still shown until it is pressed.
The server answers byte ranges for both, which Safari needs to play anything.

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
node render.mjs "stage/poster.html?a=Start%20here&b=Welcome%20to%20Kairo&c=What%27s%20ready%20for%20you%2C%20in%2030%20seconds&d=30%20sec" ../../public/videos/kairo-welcome.jpg 30 1 0
node render.mjs stage/sms.html ../../public/videos/kairo-sms-setup.mp4 30 1.5
node render.mjs stage/welcome.html ../../public/videos/kairo-welcome.mp4 30 1
for n in kairo-welcome kairo-sms-setup; do
  ffmpeg -y -i ../../public/videos/$n.mp4 -c:v libvpx-vp9 -b:v 0 -crf 36 -row-mt 1 -an ../../public/videos/$n.webm
done
```

`node render.mjs <page> <out.png> 30 1 <seconds>` renders one frame — the
quick way to check a moment before rendering the whole thing. Copy the four
video files and two stills into the website's `public/videos/` afterwards.
