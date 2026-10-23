// QA sweep: every asset, every screen, every button (and the buttons inside any dialog they open),
// overflow, service worker + offline play, confetti cleanup. Runs at iPad landscape, iPad portrait and phone.
// usage: node qa-sweep.js [baseURL]      env: VP=phone to run one size, SHOTS=dir for screenshots
const { pw, BASE, exe, shots, VIEWPORTS } = require('./lib');
const base = process.argv[2] || BASE, OUT = shots('sweep');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let passes = 0; const fails = [];
const ok = (c, m, d) => { if (c) { passes++; } else { fails.push(m); console.log('FAIL ' + m + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 600) : '')); } };
const ARGS = { lesson: 0, so: 0 };            // screens that take an argument
const DIALOG_SKIP = /data-r=/;                 // reset buttons need a 2.5 s press-and-hold; tested separately below

(async () => {
  const b = await pw.chromium.launch({ ...exe(), args: ['--autoplay-policy=no-user-gesture-required'] });
  const vps = VIEWPORTS.filter(v => !process.env.VP || v.n === process.env.VP);
  for (const [vi, vp] of vps.entries()) {
    const T = m => `[${vp.n}] ${m}`;
    const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: true, isMobile: vp.w < 500 });
    const p = await ctx.newPage(); const errs = [], ext = [], bad = [];
    p.on('pageerror', e => errs.push('pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    p.on('request', r => { const u = r.url(); if (!u.startsWith(new URL(base).origin + '/') && !/^(data|blob):/.test(u)) ext.push(u); });
    p.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
    const r0 = await p.goto(base); await sleep(900);
    ok(r0.status() === 200, T('page loads 200'));

    /* ---------- 1. every asset (once): 200, right type, audio decodes, images load ---------- */
    if (vi === 0) {
      const a = await p.evaluate(async () => {
        const sw = await (await fetch('sw.js', { cache: 'no-store' })).text();
        const listed = [...sw.matchAll(/'\.\/([^']*)'/g)].map(m => m[1] || './').filter(u => u === './' || !u.endsWith('/'));   // skip the './audio/' + id prefix
        const man = await (await fetch('manifest.webmanifest', { cache: 'no-store' })).json();
        const ids = new Set(Object.keys(self.TP_CLIPS || {})); Object.values(self.TP_PHONICS || {}).forEach(x => ids.add(x));
        const out = { files: 0, clips: ids.size, bad: [] };
        const TYPES = { html: /text\/html/, '': /text\/html/, css: /text\/css/, js: /javascript/, webmanifest: /json|manifest/, png: /image\/png/, mp3: /audio\// };
        const urls = [...new Set(listed.concat(man.icons.map(i => i.src)).concat([...ids].map(id => 'audio/' + id + '.mp3')))];
        for (const u of urls) {
          out.files++;
          try {
            const r = await fetch(u, { cache: 'no-store' }); const ext = (u.split('/').pop().split('.')[1] || ''); const t = r.headers.get('content-type') || '';
            const len = (await r.clone().arrayBuffer()).byteLength;
            if (r.status !== 200 || !(TYPES[ext] || /./).test(t) || len < 50) { out.bad.push(u + ' ' + r.status + ' ' + t + ' ' + len); continue; }
            if (ext === 'png') { const good = await new Promise(res => { const im = new Image(); im.onload = () => res(im.naturalWidth > 0); im.onerror = () => res(false); im.src = u; }); if (!good) out.bad.push(u + ' image did not load'); }
          } catch (e) { out.bad.push(u + ' ' + e.message); }
        }
        for (const id of ids) { try { const buf = await __tp.decodeClip(id); if (!(buf && buf.duration > 0.1 && buf.duration < 8)) out.bad.push(id + ' duration ' + (buf && buf.duration)); } catch (e) { out.bad.push(id + ' decode ' + e.message); } }
        return out;
      });
      ok(a.bad.length === 0 && a.clips > 300, T(`all ${a.files} files (incl. ${a.clips} audio clips) return 200 with the right type and decode/load`), a.bad);
      console.log(`[${vp.n}] checked ${a.files} files, decoded ${a.clips} clips`);
    }

    /* ---------- 2. every screen: renders, fits, every button responds ---------- */
    const screens = await p.evaluate(() => __tp.screens);
    ok(screens.length >= 12, T('screens found: ' + screens.join(',')));
    const open = async name => { await p.evaluate(([n, a]) => { __tp.state().muted = true; __tp.go(n, a); }, [name, ARGS[name]]); await sleep(650); };
    const fit = where => p.evaluate(where => {
      const W = innerWidth, H = innerHeight, out = [];
      if (document.documentElement.scrollWidth > W + 1) out.push('page scrolls sideways ' + document.documentElement.scrollWidth + '>' + W);
      const scrollParent = el => { for (let e = el.parentElement; e; e = e.parentElement) { const s = getComputedStyle(e); if (/(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight) return e; } return null; };
      const root = where === 'modal' ? document.querySelector('.modal') : document.querySelector('#app');
      for (const el of root ? root.querySelectorAll('button, [role=button], .pcard, .key, [data-go]') : []) {
        const r = el.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
        const name = String(el.className) + ' "' + (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 20) + '"';
        if (r.left < -1 || r.right > W + 1) out.push('off-screen sideways: ' + name + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
        if ((r.top < -1 || r.bottom > H + 1) && !scrollParent(el)) out.push('off-screen vertically: ' + name + ' ' + Math.round(r.top) + '..' + Math.round(r.bottom));
      }
      return out;
    }, where);
    const targets = where => p.evaluate(where => {
      document.querySelectorAll('[data-qa]').forEach(e => e.removeAttribute('data-qa'));
      const root = where === 'modal' ? document.querySelector('.modal') : document.querySelector('#app');
      if (!root) return [];
      let els = [...new Set(root.querySelectorAll('button, [role=button], .pcard, [data-go]'))].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height && getComputedStyle(e).visibility !== 'hidden'; });
      // on-screen keyboards: every key is the same kind of button, so try four spread across it
      const keys = els.filter(e => e.classList.contains('key')); const step = Math.max(1, Math.floor(keys.length / 4)); const keep = new Set(keys.filter((e, i) => i % step === 0).slice(0, 4));
      els = els.filter(e => !e.classList.contains('key') || keep.has(e));
      return els.map((e, i) => { e.setAttribute('data-qa', i); return { i, label: (e.getAttribute('aria-label') || e.textContent || String(e.className)).trim().replace(/\s+/g, ' ').slice(0, 28), disabled: e.disabled || e.getAttribute('aria-disabled') === 'true' || /\b(locked|off)\b/.test(String(e.className)), html: e.outerHTML.slice(0, 140) }; });
    }, where);
    const snap = () => p.evaluate(() => ({ screen: __tp.screen(), modal: !!document.querySelector('.modal'), voice: __tp.voiceLog.length }));
    const press = async sel => {
      // a real pointer tap at the button's centre, after checking nothing else is on top of it
      const hit = await p.evaluate(sel => {
        const e = document.querySelector(sel); if (!e) return { gone: true };
        e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const t = document.elementFromPoint(x, y);
        window.__qaMut = 0; if (!window.__qaObs) { window.__qaObs = new MutationObserver(m => { window.__qaMut += m.length; }); window.__qaObs.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); }
        return { x, y, covered: !(t && (t === e || e.contains(t))), top: t && String(t.className || t.tagName) };
      }, sel);
      if (hit.gone) return hit;
      await p.mouse.click(hit.x, hit.y); await sleep(450);
      hit.mut = await p.evaluate(() => window.__qaMut);
      return hit;
    };
    let nB = 0, nD = 0;
    for (const name of screens) {
      await open(name);
      await p.screenshot({ path: `${OUT}${vp.n}-${name}.png` });
      const f = await fit('app'); ok(f.length === 0, T(`${name}: nothing off-screen`), f);
      const list = await targets('app'); ok(list.length > 0, T(`${name}: has buttons`));
      for (const t of list) {
        await open(name); await targets('app'); const before = await snap();
        const h = await press(`[data-qa="${t.i}"]`);
        if (h.gone) { ok(false, T(`${name}: "${t.label}" exists after reopening the screen`), t.html); continue; }
        const after = await snap(); nB++;
        ok(!h.covered, T(`${name}: "${t.label}" is not covered by something else`), h.top);
        ok(h.mut > 0 || after.screen !== before.screen || after.modal !== before.modal || after.voice !== before.voice || t.disabled, T(`${name}: "${t.label}" responds to a tap`), t.html);
        ok(await p.evaluate(() => !!window.__tp && document.querySelector('#app').children.length > 0), T(`${name}: "${t.label}" leaves a working screen`));
        if (!before.modal && after.modal) {            // it opened a dialog: check that fits, then tap each of its buttons
          const mf = await fit('modal'); ok(mf.length === 0, T(`${name} > "${t.label}" dialog: nothing off-screen`), mf);
          const ml = (await targets('modal')).filter(x => !DIALOG_SKIP.test(x.html));
          for (const m of ml) {
            await open(name); await targets('app'); await press(`[data-qa="${t.i}"]`);
            if (!(await p.$('.modal'))) break;
            await targets('modal'); const mb = await snap();
            const mh = await press(`[data-qa="${m.i}"]`); if (mh.gone) continue;
            const ma = await snap(); nD++;
            ok(!mh.covered, T(`${name} > "${t.label}" > "${m.label}" is not covered`), mh.top);
            ok(mh.mut > 0 || ma.screen !== mb.screen || ma.modal !== mb.modal || ma.voice !== mb.voice || m.disabled, T(`${name} > "${t.label}" > "${m.label}" responds`), m.html);
          }
        }
      }
    }
    console.log(`[${vp.n}] tapped ${nB} screen buttons and ${nD} dialog buttons across ${screens.length} screens`);

    /* ---------- 3. press-and-hold reset works (Grown-ups) ---------- */
    await p.evaluate(() => { __tp.state().read.stars = 7; __tp.go('home'); }); await sleep(500);
    await p.click('[data-grown]'); await sleep(400);
    const rb = await p.$('[data-r="read"]'); await rb.scrollIntoViewIfNeeded(); const bb = await rb.boundingBox();
    await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await sleep(2900); await p.mouse.up(); await sleep(500);
    ok(await p.evaluate(() => __tp.state().read.stars === 0 && __tp.screen() === 'home'), T('Grown-ups: holding "Reset Reading Fun" resets it'));

    /* ---------- 4. confetti never carries over to the next screen ---------- */
    await p.evaluate(() => { __tp.go('read'); __tp.confetti(); }); await sleep(250);
    await p.evaluate(() => __tp.go('home')); await sleep(1500);
    ok(await p.evaluate(() => document.querySelectorAll('#fx > *').length === 0 && __tp.fxPending() === 0), T('confetti is cleared when the screen changes'));

    /* ---------- 5. service worker + offline play ---------- */
    const V = await p.evaluate(async () => /VERSION = '([^']+)'/.exec(await (await fetch('sw.js', { cache: 'no-store' })).text())[1]);
    const NC = await p.evaluate(() => { const s = new Set(Object.keys(self.TP_CLIPS || {})); Object.values(self.TP_PHONICS || {}).forEach(x => s.add(x)); return s.size; });
    await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 30000 }).catch(() => {});
    await p.waitForFunction(async ([V, N]) => { const c = await caches.open(V); return (await c.keys()).filter(r => r.url.includes('/audio/')).length >= N; }, [V, NC], { timeout: 90000, polling: 1000 }).catch(() => {});
    const sw = await p.evaluate(async V => {
      const c = await caches.open(V); const have = new Set((await c.keys()).map(r => new URL(r.url).pathname.split('/').pop()));
      const ids = new Set(Object.keys(self.TP_CLIPS || {})); Object.values(self.TP_PHONICS || {}).forEach(x => ids.add(x));
      return { ctrl: !!navigator.serviceWorker.controller, missing: [...ids].filter(id => !have.has(id + '.mp3')).concat(['index.html', 'app.js', 'style.css'].filter(x => !have.has(x))) };
    }, V);
    ok(sw.ctrl && sw.missing.length === 0, T(`service worker controls the page and cached all ${NC} clips in ${V}`), sw);
    await ctx.setOffline(true);
    const r2 = await p.reload().catch(() => null); await sleep(1000);
    ok(r2 && r2.status() === 200 && await p.locator('.pcard').count() === 3, T('offline: app reloads from cache'));
    for (const name of screens) { await p.evaluate(([n, a]) => { __tp.state().muted = true; __tp.go(n, a); }, [name, ARGS[name]]); await sleep(400); }
    await p.evaluate(() => { __tp.state().muted = false; __tp.go('so', 0); }); await sleep(3500);
    const off = await p.evaluate(async () => { const d = await __tp.decodeClip('ph-a'); return { stats: JSON.parse(JSON.stringify(__tp.voiceStats)), ph: __tp.voiceLog.filter(x => /^ph-/.test(x)).length, dur: d && d.duration }; });
    ok(off.stats.fallback === 0 && off.stats.failed.length === 0 && off.ph >= 1 && off.dur > 0.1, T('offline: every screen opens and Sound It Out plays the recorded sounds'), off);
    await ctx.setOffline(false);

    ok(errs.length === 0, T('no console errors or uncaught exceptions'), errs);
    ok(bad.length === 0, T('no failed (4xx/5xx) requests'), bad);
    ok(ext.length === 0, T('no requests to other sites'), ext);
    await ctx.close();
  }
  await b.close();
  console.log(fails.length ? `FAILED ${fails.length} of ${passes + fails.length}` : `ALL ${passes} CHECKS PASS`);
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('CRASH', e.stack); process.exit(1); });
