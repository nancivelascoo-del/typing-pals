# Testing Typing Pals

Every push and pull request runs the QA checks in GitHub Actions (`.github/workflows/qa-and-deploy.yml`).
The site is published to GitHub Pages **only from `main` and only when every check passes**. After it deploys,
one more job opens the live site and checks it installs and plays offline.

## What the checks cover

| Suite | What it checks |
| --- | --- |
| `qa-sweep.js` (runs once per size: iPad landscape 1024×768, iPad portrait 820×1180, phone 390×844) | Every file the app uses (pages, scripts, icons, manifest and all ~400 voice clips) returns 200 with the right type. Every clip decodes and every image loads. Every screen opens, nothing sits off-screen or scrolls sideways, and every button (plus each button inside a dialog it opens) is tappable, isn't covered by something else, and responds. Holding the Grown-ups reset button resets progress. Confetti never carries over to the next screen. The service worker installs and caches everything, and the app reloads and plays recorded sounds offline. No console errors, uncaught exceptions, failed requests or requests to other sites. |
| `full-test.js` | Letter Explorer and Ninja Keys flows end to end, on desktop, iPad and phone. |
| `reading-test.js`, `reading-v2-test.js` | Each Reading Fun game is played through (Sound It Out, Stretchy Sounds, Blend, b or d, Write It, Today's Treat), including the reading pet and missed-word review. |
| `audio-progress-test.js` | Every clip plays as audio, and stars and levels progress correctly. |
| `live-offline.js` | The service worker caches every clip and the app works with the network off. In CI this also runs against the live site after each deploy. |
| `check-data.js` | Ninja lesson text only uses keys that have already been taught. |

Screenshots from each run are saved as artifacts on the Actions run page.

## Run them yourself

```bash
cd test && npm ci && npx playwright install chromium
# serve the repo at /typing-pals/, the same path GitHub Pages uses
mkdir -p /tmp/site && ln -sfn "$PWD/.." /tmp/site/typing-pals && (cd /tmp/site && python3 -m http.server 8765 &)
node qa-sweep.js            # VP=phone node qa-sweep.js runs one size only
node full-test.js chromium
node reading-v2-test.js
```

Settings: `BASE` sets the site URL (default `http://127.0.0.1:8765/typing-pals/`), `SHOTS` sets the screenshot folder, and `CHROME_PATH` points at a Chrome build (leave it empty to use Playwright's).

## After changing app files

Bump `VERSION` in `sw.js`. Otherwise installed copies on the iPad keep the old files. To update the iPad, close the app and reopen it.
