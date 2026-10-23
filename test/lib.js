// Shared settings for the QA tests. Local default: http://127.0.0.1:8765/typing-pals/ and the box's Chrome.
// CI sets BASE, SHOTS and leaves CHROME_PATH empty so Playwright's own Chromium is used.
const fs = require('fs'), path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const BASE = process.env.BASE || 'http://127.0.0.1:8765/typing-pals/';
const ORIGIN = new URL(BASE).origin;
const SHOTS = (process.env.SHOTS || path.join(__dirname, '..', 'test-results')) + '/';
const CHROME = process.env.CHROME_PATH !== undefined ? process.env.CHROME_PATH : (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : '');
function exe() { return CHROME ? { executablePath: CHROME } : {}; }
function shots(sub) { const d = SHOTS + (sub ? sub + '/' : ''); fs.mkdirSync(d, { recursive: true }); return d; }
const VIEWPORTS = [{ n: 'ipad', w: 1024, h: 768 }, { n: 'ipad-portrait', w: 820, h: 1180 }, { n: 'phone', w: 390, h: 844 }];
module.exports = { pw, BASE, ORIGIN, SHOTS, exe, shots, VIEWPORTS };
