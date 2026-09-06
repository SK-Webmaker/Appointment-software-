# App Store screenshots, made from the running product

Nothing here is a mockup. Every screen in the listing is a capture of Kairo
running against a real database; the only things added afterwards are the
caption and the device frame, which is what every App Store listing does and
what Apple's guidelines expect. A reviewer comparing the screenshots to the
app will find they match, which is the whole point.

Zero dependencies, like everything else: Chromium is driven straight over the
DevTools Protocol using Node's built-in `WebSocket`.

## Running it

```bash
# 1. a scratch Kairo with the demo data
KAIRO_DATA_DIR=/tmp/shots PORT=4899 npm start

# 2. stage it — a salon that is up and running, not one mid-setup
node tools/appstore/stage.mjs /tmp/shots/kairo.db

# 3. capture the screens (1320 x 2868, the 6.9" size Apple asks for)
KAIRO_PASSWORD='…' node tools/appstore/shoot.mjs ./raw tools/appstore/shotlist.mjs

# 4. caption and frame them
node tools/appstore/compose.mjs ./raw docs/app-store/screenshots
```

`stage.mjs` invents a salon — **Aurelia Hair Studio**, which does not exist —
and fills in the things a real salon would have done in its first week, so the
listing does not show a half-configured product. It changes no behaviour.

## What is where

| Path | What |
|---|---|
| `docs/app-store/screenshots/*.png` | the five finished listing images, 1320 x 2868 |
| `docs/app-store/screenshots/raw/*.png` | the untouched captures they are built from |
| `shoot.mjs` | drives Chromium: signs in, sets the device metrics, captures |
| `shotlist.mjs` | which screens, and how each is framed |
| `compose.mjs` | caption + device frame |
| `stage.mjs` | the demo salon |

## If a screen changes

Re-run steps 3 and 4 and commit the new PNGs. Apple wants the screenshots to
match the current version; a listing showing last year's calendar is the sort
of thing that gets a build rejected under 2.3.
