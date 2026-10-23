// Reading Fun v2: pet, Stretchy Sounds, Write It (tracing), Today's Treat. iPad + phone sizes.
const { chromium } = require('./lib').pw; const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = process.argv[2] || require('./lib').BASE, OUT = require('./lib').shots('reading-v2');
const VPS = [{ n: 'ipad', w: 1024, h: 768 }, { n: 'ipad-portrait', w: 820, h: 1180 }, { n: 'phone', w: 390, h: 844 }].filter(v => !process.env.VP || v.n === process.env.VP);
const fails = []; let passes = 0; const ok = (c, m) => { if (!c) { fails.push(m); console.log('FAIL', m); } else passes++; };
async function until(p, fn, ms = 20000, arg) { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn, arg)) return true; await sleep(100); } return false; }
const st = p => p.evaluate(() => __tp.cur().state && __tp.cur().state());
async function drag(p, sel, f0, f1, steps, pause) {
  const r = await p.evaluate(s => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; }, sel);
  const y = r.y + r.h / 2; await p.mouse.move(r.x + r.w * f0, y); await p.mouse.down();
  for (let i = 1; i <= steps; i++) { await p.mouse.move(r.x + r.w * (f0 + (f1 - f0) * i / steps), y); if (pause) await sleep(pause); }
  await p.mouse.up();
}
async function traceStroke(p, si, upto) {
  const pts = await p.evaluate(si => { const s = __tp.cur().state(), svg = document.querySelector('#trsvg'), m = svg.getScreenCTM();
    return s.strokes[si].slice(s.stroke === si ? s.k : 0).map(([x, y]) => { const pt = svg.createSVGPoint(); pt.x = x; pt.y = y; const q = pt.matrixTransform(m); return [q.x, q.y]; }); }, si);
  const n = Math.floor(pts.length * (upto || 1));
  await p.mouse.move(pts[0][0], pts[0][1]); await p.mouse.down();
  for (let i = 1; i < n; i += 2) await p.mouse.move(pts[i][0] + 3, pts[i][1] - 2);
  if (!upto || upto >= 1) await p.mouse.move(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  if (!upto || upto >= 1) await p.mouse.up();
}
(async () => {
  const b = await chromium.launch({ ...require('./lib').exe(), args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const vp of VPS) {
    const shot = n => p.screenshot({ path: OUT + vp.n + '-' + n + '.png' });
    const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: true, isMobile: vp.w < 500 });
    const p = await ctx.newPage(); const errs = [], ext = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    p.on('request', r => { const u = r.url(); if (!u.startsWith(BASE.replace(/typing-pals\/$/, '')) && !u.startsWith('data:') && !u.startsWith('blob:')) ext.push(u); });
    await p.goto(BASE); await sleep(900);
    await p.tap('.pcard.read'); await sleep(1200);
    ok(await p.evaluate(() => __tp.voiceLog.includes('pt-hi')), vp.n + ' first visit introduces the pet');
    await shot('01-hub-egg');
    const off = await p.evaluate(() => [...document.querySelectorAll('.rgame,.rd-daily,.pet-card')].filter(e => { const r = e.getBoundingClientRect(); return r.bottom > innerHeight + 1 || r.right > innerWidth + 1 || r.width < 60; }).map(e => e.className));
    ok(off.length === 0, vp.n + ' hub fits: ' + off);
    ok(await p.evaluate(() => document.querySelectorAll('.rgame').length) === 5, vp.n + ' five game tiles');

    /* ---- Stretchy Sounds: real audio for word 1, slow slide ---- */
    await p.tap('.rgame.st');
    ok(await until(p, () => { const s = __tp.cur().state && __tp.cur().state(); return s && s.idx === 0 && s.phase === 'slide'; }), vp.n + ' stretchy starts');
    await sleep(2600);
    const w0 = (await st(p)).target; const before = await p.evaluate(() => __tp.voiceLog.length);
    // a fast swipe: the snail must stop at each letter until its sound starts
    await drag(p, '#track', 0.02, 0.99, 8, 20);
    const s1 = await st(p); ok(s1.pos < 0.97 && s1.phase === 'slide', vp.n + ' fast swipe does not skip sounds (pos ' + s1.pos.toFixed(2) + ')');
    await shot('02-stretchy-sliding');
    for (let k = 0; k < 6 && (await st(p)).phase === 'slide'; k++) { await sleep(700); await drag(p, '#track', (await st(p)).pos, 1.0, 10, 40); }
    ok(await until(p, () => __tp.cur().state().phase === 'pick', 15000), vp.n + ' snaps and shows pictures');
    const phs = (await p.evaluate(() => __tp.voiceLog.slice())).slice(before).filter(x => /^ph-/.test(x));
    ok(phs.slice(0, 3).join() === w0.split('').map(c => 'ph-' + c).join(), vp.n + ' stretched sounds in order ' + phs.join() + ' for ' + w0);
    ok(phs.length >= 6, vp.n + ' then said fast (blend) ' + phs.length);
    ok(await p.evaluate(() => __tp.voiceLog.includes('st-snap')), vp.n + ' says "Now say it fast"');
    await shot('03-stretchy-snapped-pick');
    const wrong = await p.evaluate(() => [...document.querySelectorAll('.pic-btn')].map(b => b.dataset.w).find(w => w !== __tp.cur().state().target));
    await p.evaluate(() => { __tp.state().muted = true; });
    await p.tap(`.pic-btn[data-w="${wrong}"]`); await sleep(400);
    ok(await p.evaluate(w => __tp.state().read.miss['w:' + w] === 1, w0), vp.n + ' missed word remembered for review');
    await p.tap(`.pic-btn[data-w="${w0}"]`);
    for (let i = 1; i < 5; i++) {
      await until(p, () => __tp.cur().state().idx >= 1 && __tp.cur().state().phase === 'slide');
      for (let k = 0; k < 10 && (await st(p)).phase === 'slide'; k++) { await drag(p, '#track', (await st(p)).pos, 1.0, 6, 15); await sleep(450); }
      await until(p, () => __tp.cur().state().phase === 'pick', 15000);
      const t = (await st(p)).target; await p.tap(`.pic-btn[data-w="${t}"]`);
      await until(p, () => __tp.cur().state().phase !== 'pick' && __tp.cur().state().phase !== 'won' || !!document.querySelector('.modal'), 8000);
    }
    ok(await until(p, () => !!document.querySelector('.modal.results')), vp.n + ' stretchy result');
    await sleep(1200); await shot('04-stretchy-result-pet');
    ok(await p.evaluate(() => __tp.state().read.pet.fed) >= 2, vp.n + ' stars fed the pet');
    await p.tap('[data-hub]'); await sleep(700);

    /* ---- Write It ---- */
    await p.tap('.rgame.tr');
    ok(await until(p, () => { const s = __tp.cur().state && __tp.cur().state(); return s && s.idx === 0 && !s.busy; }, 15000), vp.n + ' write-it demo finishes');
    ok((await st(p)).letter === 'b', vp.n + ' starts with b');
    // wrong place: start at the tummy instead of the top of the stick -> nothing drawn
    const s0 = await st(p); ok(s0.stroke === 0 && s0.k === 0, vp.n + ' stroke 1 first');
    await traceStroke(p, 0, 0.5); await sleep(200);
    await shot('05-write-b-halfway');
    await p.mouse.up();
    ok((await st(p)).k > 10, vp.n + ' tracing advances along the stick');
    await p.evaluate(() => { __tp.state().muted = true; });
    for (let L = 0; L < 4; L++) {
      await until(p, L => { const s = __tp.cur().state(); return !s.busy && s.idx === L; }, 15000, L);
      const s = await st(p);
      for (let k = s.stroke; k < s.strokes.length; k++) { await traceStroke(p, k); await sleep(150); }
      if (L === 1) { await sleep(150); await shot('06-write-d-done'); }
      await until(p, L => __tp.cur().state().idx > L || !!document.querySelector('.modal'), 6000, L);
      await sleep(300);
      if (await p.$('.modal.results')) break;
    }
    ok(await until(p, () => !!document.querySelector('.modal.results'), 15000), vp.n + ' write-it result');
    ok(await p.evaluate(() => __tp.voiceLog.includes('tr-b-how') && __tp.voiceLog.includes('tr-d-how') && __tp.voiceLog.includes('tr-b-made')), vp.n + ' how-to and made clips');
    await p.tap('[data-hub]'); await sleep(600);

    /* ---- Today's Treat (pet set to hatch) ---- */
    await p.evaluate(() => { __tp.state().read.pet.fed = 3; });
    await p.tap('.rd-daily');
    ok(await until(p, () => { const s = __tp.cur().state && __tp.cur().state(); return s && s.idx === 0 && !s.busy; }), vp.n + ' treat starts');
    const items = (await st(p)).items; ok(items[0].t === 'so' && items[0].w === w0, vp.n + ' missed word comes back first: ' + items[0].w + ' vs ' + w0);
    await sleep(800); await shot('07-treat-q1');
    for (let i = 0; i < 5; i++) {
      await until(p, () => { const s = __tp.cur().state(); return !s.busy && s.idx >= 0; });
      const it = (await st(p)).item;
      if (i === 2) { const bad = await p.evaluate(() => [...document.querySelectorAll('#ch [data-w]')].map(b => b.dataset.w).find(w => w !== __tp.cur().state().item.want)); await p.tap(`#ch [data-w="${bad}"]`); await sleep(300); await shot('08-treat-bd-oops'); }
      if (i === 1) await shot('08-treat-big-little');
      await p.tap(`#ch [data-w="${it.want}"]`);
      await until(p, i => __tp.cur().state().idx > i || !!document.querySelector('.modal'), 6000, i); await sleep(700);
    }
    ok(await until(p, () => !!document.querySelector('.modal.results')), vp.n + ' treat result');
    await sleep(1800); await shot('09-treat-result-hatch');
    ok(await p.evaluate(() => __tp.voiceLog.includes('pt-hatch') && __tp.voiceLog.includes('dy-done')), vp.n + ' egg hatches with treat bonus');
    ok(await p.evaluate(() => !!document.querySelector('.rd-bonus')), vp.n + ' +2 bonus shown');
    await p.tap('[data-hub]'); await sleep(700);
    ok(await p.evaluate(() => document.querySelector('.rd-daily').classList.contains('done')), vp.n + ' treat marked done for today');
    await p.evaluate(() => { const P = __tp.state().read.pet; P.done = [0, 1]; P.i = 2; P.fed = 11; __tp.go('read'); }); await sleep(600);
    await shot('10-hub-grown-pet-shelf');
    // old games still work: quick smoke of so / bl / bd openers
    for (const g of ['so', 'bl', 'bd']) { await p.evaluate(g => __tp.go(g), g); ok(await until(p, () => { const s = __tp.cur().state && __tp.cur().state(); return s && s.idx === 0; }, 8000), vp.n + ' ' + g + ' still starts'); }
    ok(await p.evaluate(() => __tp.voiceStats.fallback) === 0, vp.n + ' no speech fallback');
    ok(errs.length === 0, vp.n + ' no errors ' + errs.join(' | '));
    ok(ext.length === 0, vp.n + ' no external requests ' + ext.join(' '));
    await ctx.close();
  }
  await b.close();
  console.log(fails.length ? 'FAILED ' + fails.length + ' / ' + (passes + fails.length) : 'ALL ' + passes + ' PASS');
  process.exit(fails.length ? 1 : 0);
})();
