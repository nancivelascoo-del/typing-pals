const { chromium } = require('./lib').pw; const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = require('./lib').BASE;
(async () => {
  const b = await chromium.launch({ ...require('./lib').exe() });
  for (const vp of [{ n: 'desk', w: 1280, h: 800 }, { n: 'ipad', w: 1024, h: 768, touch: true }, { n: 'phone', w: 390, h: 844, touch: true }]) {
    const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: !!vp.touch, isMobile: !!vp.touch && vp.w < 500 });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
    await p.goto(BASE); await sleep(800);
    await p.screenshot({ path: `/tmp/s-${vp.n}-home.png` });
    await p.click('.pcard.kid'); await sleep(3500);
    await p.screenshot({ path: `/tmp/s-${vp.n}-ex.png` });
    await p.evaluate(() => __tp.go('ninja')); await sleep(400);
    await p.screenshot({ path: `/tmp/s-${vp.n}-nj.png` });
    await p.evaluate(() => { __tp.state().ninja.introSeen = true; __tp.go('lesson', 6); }); await sleep(400);
    await p.keyboard.press('d'); await p.keyboard.press('e'); await p.keyboard.press('x'); await sleep(200);
    await p.screenshot({ path: `/tmp/s-${vp.n}-lesson.png` });
    console.log(vp.n, JSON.stringify(errs));
    await ctx.close();
  }
  await b.close();
})();
