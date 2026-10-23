// Plays every Reading Fun game end-to-end (iPad + phone sizes), checks voice order, no external requests, no errors.
const { chromium } = require('./lib').pw; const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = require('./lib').BASE, OUT = require('./lib').shots('reading');
const VPS = [{ n: 'ipad', w: 1024, h: 768 }, { n: 'ipad-portrait', w: 820, h: 1180 }, { n: 'phone', w: 390, h: 844 }];
const fails = []; const ok = (c, m) => { if (!c) { fails.push(m); console.log('FAIL', m); } };
async function until(p, fn, ms = 20000) { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn)) return true; await sleep(100); } return false; }
(async () => {
  const b = await chromium.launch({ ...require('./lib').exe(), args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const vp of VPS) {
    const shot = n => p.screenshot({ path: OUT + vp.n + '-' + n + '.png' });
    const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: true, isMobile: vp.w < 500 });
    const p = await ctx.newPage(); const errs = [], ext = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    p.on('request', r => { if (!r.url().startsWith(require('./lib').ORIGIN + '/') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) ext.push(r.url()); });
    await p.goto(BASE); await sleep(900);
    await shot('01-home');
    ok(await p.$('.pcard.read'), vp.n + ' home has Reading Fun card');
    await p.tap('.pcard.read'); await sleep(900);
    ok(await p.evaluate(() => __tp.screen()) === 'read', vp.n + ' hub opens');
    await shot('02-reading-hub');
    // overflow check: every big target is on-screen
    const off = await p.evaluate(() => [...document.querySelectorAll('.rgame')].filter(e => { const r = e.getBoundingClientRect(); return r.bottom > innerHeight + 1 || r.right > innerWidth + 1 || r.width < 60; }).length);
    ok(off === 0, vp.n + ' hub tiles fit');

    /* ---- Sound It Out with real (unmuted) audio for the first word ---- */
    await p.tap('.rgame.so');
    ok(await until(p, () => __tp.cur().state && __tp.cur().state().target && __tp.voiceLog.filter(x => /^ph-/.test(x)).length >= 3), vp.n + ' sound-it-out plays the sounds');
    const st0 = await p.evaluate(() => __tp.cur().state());
    const log0 = await p.evaluate(() => __tp.voiceLog.slice());
    const phs = log0.filter(x => /^ph-/.test(x)).slice(0, 3).join(',');
    ok(phs === st0.target.split('').map(c => 'ph-' + c).join(','), vp.n + ' sounds in order ' + phs + ' for ' + st0.target);
    ok(st0.look === false, vp.n + ' level 1 is listening only');
    ok(await p.evaluate(() => document.querySelector('#tiles').classList.contains('hide')), vp.n + ' level 1 hides letters');
    ok(await p.evaluate(() => __tp.voiceStats.fallback) === 0, vp.n + ' no speech fallback ' + JSON.stringify(await p.evaluate(() => __tp.voiceStats.failed)));
    await shot('03-sound-it-out-listen');
    // wrong tap first
    const wrongW = await p.evaluate(() => [...document.querySelectorAll('.pic-btn')].map(b => b.dataset.w).find(w => w !== __tp.cur().state().target));
    await p.evaluate(() => { __tp.state().muted = true; });
    await p.tap(`.pic-btn[data-w="${wrongW}"]`); await sleep(300);
    await shot('04-sound-it-out-wrong');
    await until(p, () => __tp.voiceLog.slice(-8).includes('so-again'));
    // play all 5 words correctly
    for (let i = 0; i < 5; i++) {
      await until(p, () => { const s = __tp.cur().state && __tp.cur().state(); return s && !s.busy && s.idx >= 0; });
      const t = await p.evaluate(() => __tp.cur().state().target);
      await p.tap(`.pic-btn[data-w="${t}"]`);
      if (i === 1) { await sleep(1200); await shot('05-sound-it-out-blend'); }
      await until(p, () => { const s = __tp.cur().state(); return s.idx !== ' + i + ' && (s.busy === false || document.querySelector('.modal')); });
      await sleep(150);
    }
    ok(await until(p, () => !!document.querySelector('.modal.results')), vp.n + ' sound-it-out result shows');
    await shot('06-sound-it-out-stars');
    const so = await p.evaluate(() => __tp.state().read.so);
    ok(so.stage === 1, vp.n + ' 4/5 first try unlocks a-look stage: ' + JSON.stringify(so));
    await p.tap('[data-again]'); await sleep(400);
    await until(p, () => { const s = __tp.cur().state(); return s && s.idx === 0 && !s.busy; });
    ok(await p.evaluate(() => __tp.cur().state().look) === true, vp.n + ' level 2 shows letters');
    await p.evaluate(() => { __tp.state().muted = false; }); await p.tap('[data-replay]'); await sleep(900);
    await shot('07-sound-it-out-look-lit');
    await p.evaluate(() => { __tp.state().muted = true; });
    await p.tap('[data-map]'); await sleep(400); await shot('08-sound-it-out-levels');
    // every stage has enough playable words
    const pools = await p.evaluate(() => __tp.soStages.map(s => __tp.soPool(s).length));
    ok(pools.every(n => n >= 5), vp.n + ' pools ' + pools);

    /* ---- Big and Little ---- */
    await p.evaluate(() => __tp.go('bl')); await until(p, () => { const s = __tp.cur().state(); return s.idx === 0 && !s.busy; });
    await shot('09-big-little');
    const w0 = await p.evaluate(() => [...document.querySelectorAll('.lt-btn')].map(b => b.dataset.l).find(l => l !== __tp.cur().state().want));
    await p.tap(`.lt-btn[data-l="${w0}"]`); await sleep(300);
    for (let i = 0; i < 6; i++) {
      await until(p, () => { const s = __tp.cur().state(); return s.idx === ' + i + ' || !s.busy; });
      await until(p, () => !__tp.cur().state().busy);
      const wt = await p.evaluate(() => __tp.cur().state().want);
      await p.tap(`.lt-btn[data-l="${wt}"]`);
      if (i === 0) { await sleep(400); await shot('10-big-little-match'); }
      await until(p, () => __tp.cur().state().busy === false || !!document.querySelector('.modal'));
    }
    ok(await until(p, () => !!document.querySelector('.modal.results')), vp.n + ' big-little result');
    ok(await p.evaluate(() => __tp.voiceLog.some(x => /^bl-[a-z]-(little|big)$/.test(x)) && __tp.voiceLog.some(x => /^bl-[a-z]-match$/.test(x))), vp.n + ' big-little voice');

    /* ---- b or d? ---- */
    await p.evaluate(() => __tp.go('bd')); await until(p, () => { const s = __tp.cur().state(); return s.idx === 0 && !s.busy; });
    await shot('11-b-or-d');
    const tw = await p.evaluate(() => { const T = __tp.cur().state().target; return [...document.querySelectorAll('.bd-t')].findIndex(b => b.dataset.l !== T); });
    await (await p.$$('.bd-t'))[tw].tap(); await sleep(250);
    await shot('12-b-or-d-gentle-fix');
    ok(await p.evaluate(() => __tp.voiceLog.slice(-4).includes('bd-bed')), vp.n + ' wrong tap explains the bed trick');
    for (let r = 0; r < 5; r++) {
      await until(p, () => !__tp.cur().state().busy);
      const idxs = await p.evaluate(() => { const T = __tp.cur().state().target; return [...document.querySelectorAll('.bd-t')].map((b, i) => b.dataset.l === T && !b.classList.contains('found') ? i : -1).filter(i => i >= 0); });
      const tl = await p.$$('.bd-t');
      for (const i of idxs) { await tl[i].tap(); await sleep(60); }
      await until(p, () => __tp.cur().state().busy === false || !!document.querySelector('.modal'));
    }
    ok(await until(p, () => !!document.querySelector('.modal.results')), vp.n + ' b-or-d result');
    await shot('13-b-or-d-stars');
    ok(await p.evaluate(() => __tp.state().read.bd.pq) === true, vp.n + ' p/q unlocked');
    await p.tap('[data-again]'); await sleep(300);
    // jump to a p/q round to capture the clue
    await until(p, () => !__tp.cur().state().busy);
    const plan = await p.evaluate(() => __tp.cur().state().plan);
    ok(plan.includes('p') && plan.includes('q'), vp.n + ' p/q rounds join: ' + plan);
    for (let r = 0; r < 5; r++) {
      await until(p, () => !__tp.cur().state().busy);
      const T = await p.evaluate(() => __tp.cur().state().target);
      if (T === 'p' || T === 'q') { await sleep(300); await shot('14-p-or-q'); break; }
      const idxs = await p.evaluate(() => { const T = __tp.cur().state().target; return [...document.querySelectorAll('.bd-t')].map((b, i) => b.dataset.l === T ? i : -1).filter(i => i >= 0); });
      const tl = await p.$$('.bd-t'); for (const i of idxs) { await tl[i].tap(); await sleep(60); }
      await until(p, () => __tp.cur().state().busy === false);
    }
    // all other modes still open
    for (const s of ['home', 'ex', 'ninja', 'read']) { await p.evaluate(s => __tp.go(s), s); await sleep(500); ok(await p.evaluate(() => __tp.screen()) === s, vp.n + ' screen ' + s); }
    await shot('15-hub-with-stars');
    ok(errs.length === 0, vp.n + ' errors ' + JSON.stringify(errs));
    ok(ext.length === 0, vp.n + ' external requests ' + JSON.stringify(ext));
    console.log(vp.n, 'done; stars', await p.evaluate(() => __tp.state().read.stars));
    await ctx.close();
  }
  await b.close();
  console.log(fails.length ? 'FAILURES ' + fails.length : 'ALL READING TESTS PASSED');
  process.exit(fails.length ? 1 : 0);
})();
