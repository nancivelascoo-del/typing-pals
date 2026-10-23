const pw = require('./lib').pw;
const BASE = process.argv[2] || require('./lib').BASE, engines = (process.argv[3] || 'chromium').split(',');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => { let fails = 0; const ok = (n, c, d) => { console.log((c ? 'PASS' : 'FAIL') + ' ' + n + (c ? '' : ' ' + JSON.stringify(d))); if (!c) fails++; };
for (const name of engines) {
  const b = name === 'chromium' ? await pw.chromium.launch({ ...require('./lib').exe(), args: ['--autoplay-policy=no-user-gesture-required'] }) : await pw.webkit.launch();
  const ctx = await b.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(BASE); await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 30000 }).catch(() => {});
  // expected cache name and clip count come from the deployed sw.js / clips.js, so this never needs editing
  const want = await p.evaluate(async () => { const t = await (await fetch('sw.js', { cache: 'no-store' })).text(); return { v: /VERSION = '([^']+)'/.exec(t)[1] }; });
  const V = want.v, NCLIPS = await p.evaluate(() => { const ids = new Set(Object.keys(self.TP_CLIPS || {})); Object.values(self.TP_PHONICS || {}).forEach(x => ids.add(x)); return ids.size; });
  await p.waitForFunction(async ([V, N]) => { const c = await caches.open(V); return (await c.keys()).filter(r => r.url.includes('/audio/')).length >= N; }, [V, NCLIPS], { timeout: 90000, polling: 1000 }).catch(() => {});
  const info = await p.evaluate(async (V) => { const ks = await caches.keys(); const c = await caches.open(V); const k = await c.keys(); return { ks, audio: k.filter(r => r.url.includes('/audio/')).length, total: k.length, ctrl: !!navigator.serviceWorker.controller }; }, V);
  ok(`[${name}] SW controls page, cache ${V} holds all ${NCLIPS} clips`, info.ctrl && info.ks.includes(V) && info.audio >= NCLIPS, info);
  await ctx.setOffline(true); await p.reload(); await sleep(1500);
  ok(`[${name}] offline reload renders app`, await p.locator('.pcard.kid').count() === 1);
  await p.tap('.pcard.kid'); await p.waitForFunction(() => __tp.voiceLog.includes('a-find'), null, { timeout: 20000 }).catch(() => {});
  const vs = await p.evaluate(async () => { const d = await __tp.decodeClip('a-name'); return { stats: JSON.parse(JSON.stringify(__tp.voiceStats)), log: __tp.voiceLog.slice(), dur: d && d.duration }; });
  ok(`[${name}] offline: letter clips play from cache via Web Audio (no fallback)`, vs.stats.played >= 3 && vs.stats.fallback === 0 && vs.stats.failed.length === 0 && vs.dur > 0.3 && vs.log.includes('a-name'), vs);
  ok(`[${name}] no page errors`, errs.length === 0, errs);
  await b.close();
}
console.log(fails + ' failures'); process.exit(fails ? 1 : 0); })();
