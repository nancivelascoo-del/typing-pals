// usage: node full-test.js chromium,webkit
const pw = require('./lib').pw; const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = require('./lib').BASE; const SHOTS = require('./lib').shots('main');
const res = []; const ok = (n, c, i) => { res.push((c ? 'PASS ' : 'FAIL ') + n + (i !== undefined && !c ? '  ' + JSON.stringify(i).slice(0, 400) : '')); };
const spyInit = () => {
  window.__spoken = [];
  if (window.speechSynthesis) { const orig = speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak = u => { window.__spoken.push(u.text); try { orig(u); } catch (e) {} setTimeout(() => u.onend && u.onend(), 150); }; }
};
(async () => {
  for (const name of (process.argv[2] || 'chromium').split(',')) {
    const P = n => `[${name}] ${n}`;
    const b = await pw[name].launch(name === 'chromium' ? { ...require('./lib').exe() } : {});
    const errs = [], ext = []; let offline = false;
    const watch = (page, tag) => {
      page.on('pageerror', e => errs.push(tag + ' ' + e.message));
      page.on('console', m => { if (m.type() === 'error' || /Content.Security.Policy|Refused/i.test(m.text())) errs.push(tag + ' ' + m.type() + ': ' + m.text()); });
      page.on('request', r => { const u = r.url(); if (!u.startsWith(require('./lib').ORIGIN + '/') && !u.startsWith('data:') && !u.startsWith('blob:')) ext.push(u); });
    };
    /* ---------- desktop context: keyboard ---------- */
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript(spyInit);
    const page = await ctx.newPage(); watch(page, '[desk]');
    const r1 = await page.goto(BASE); await sleep(900);
    ok(P('loads at repo-style subpath (200)'), r1.status() === 200);
    ok(P('start screen shows three home cards'), await page.locator('.pcard').count() === 3);
    if (name === 'chromium') await page.screenshot({ path: SHOTS + '1-start-screen.png' });
    // customize kid: robot + color + nickname
    await page.click('.pcard.kid .edit'); await sleep(300);
    await page.click('[data-av="robot"]'); await page.click('[data-col="#339af0"]'); await page.click('[data-nick="Turbo"]'); await sleep(200);
    if (name === 'chromium') await page.screenshot({ path: SHOTS + '6-customize-profile.png' });
    await page.click('[data-done]'); await sleep(300);
    const kidP = await page.evaluate(() => JSON.parse(localStorage.getItem('typingPals.v1')).kid);
    ok(P('profile customization saved (avatar/color/nickname)'), kidP.avatar === 'robot' && kidP.color === '#339af0' && kidP.nick === 'Turbo', kidP);
    // ninja customize
    await page.click('.pcard.ninja .edit'); await sleep(300);
    await page.locator('[data-av]').nth(1).click(); await page.click('[data-nick="Blaze"]'); await page.keyboard.press('Enter'); await sleep(300);
    const njP = await page.evaluate(() => JSON.parse(localStorage.getItem('typingPals.v1')).ninja);
    ok(P('ninja profile saved separately'), njP.nick === 'Blaze' && njP.avatar !== '\u{1F977}', njP);

    /* ---------- Letter Explorer via physical keyboard ---------- */
    const vlog = () => page.evaluate(() => __tp.voiceLog.slice());
    await page.click('.pcard.kid'); await sleep(3600);
    let st = await page.evaluate(() => __tp.cur().state());
    ok(P('Letter Explorer starts at A (A-to-Z path)'), st.mode === 'learn' && st.target === 'A', st);
    ok(P('target key glows on on-screen keyboard'), await page.locator('.kbd.kid .key.glow[data-k="A"]').count() === 1);
    ok(P('progress trail shows 26 dots, current = A'), await page.locator('.trail .td').count() === 26 && await page.locator('.trail .td.cur[data-l="A"]').count() === 1);
    const waitLog = (ids, t = 12000) => page.waitForFunction(ids => ids.every(id => __tp.voiceLog.includes(id)), ids, { timeout: t }).catch(() => {});
    const waitAny = (ids, t = 12000) => page.waitForFunction(ids => ids.some(id => __tp.voiceLog.includes(id)), ids, { timeout: t }).catch(() => {});
    const waitLast = (id, t = 12000) => page.waitForFunction(id => __tp.voiceLog.slice(-1)[0] === id, id, { timeout: t }).catch(() => {});
    await waitLog(['a-name', 'a-word', 'a-find']);
    let vl = await vlog();
    ok(P('recorded voice prompt: "Letter A! / A is for Apple / Can you find A?"'), ['a-name', 'a-word', 'a-find'].every(id => vl.includes(id)), vl);
    await page.keyboard.press('q'); await sleep(300); await waitAny(['q-that', 'a-glow']);
    st = await page.evaluate(() => __tp.cur().state()); vl = await vlog();
    ok(P('wrong key: gentle try-again naming letters, no sticker, no penalty'), st.wrong === 1 && st.target === 'A' && !(await page.evaluate(() => __tp.state().kid.stickers.A)) && (vl.includes('q-that') || vl.includes('a-glow')), { st, last: vl.slice(-3) });
    await page.keyboard.press('a'); await sleep(700);
    if (name === 'chromium') await page.screenshot({ path: SHOTS + '2b-letter-explorer-celebration.png' });
    ok(P('right key: reward (stars/moment) + sticker A saved'), (await page.evaluate(() => __tp.state().kid.stickers.A === true && document.querySelectorAll('#fx .mo, #fx .pt').length > 0)));
    await page.waitForFunction(() => __tp.cur().state().target === 'B' && !__tp.cur().state().busy, null, { timeout: 15000 }).catch(() => {});
    st = await page.evaluate(() => __tp.cur().state());
    ok(P('advances to next letter (B)'), st.target === 'B', st);
    ok(P('trail marks A as earned'), await page.locator('.trail .td.got[data-l="A"]').count() === 1);
    if (name === 'chromium') await page.screenshot({ path: SHOTS + '2-letter-explorer.png' });
    await page.keyboard.press('b'); await sleep(400);
    ok(P('sticker B saved'), await page.evaluate(() => __tp.state().kid.stickers.B === true));
    await sleep(600);
    const vs = await page.evaluate(() => JSON.parse(JSON.stringify(__tp.voiceStats)));
    ok(P('voice clips played through Web Audio (no speech-engine fallback)'), vs.played > 3 && vs.fallback === 0, vs);
    await page.click('#buddyWrap'); await sleep(200);
    ok(P('tapping buddy makes it react/talk'), await page.evaluate(() => /silly|dance|highfive|spin/.test(document.querySelector('.buddy').getAttribute('class'))));
    await page.click('[data-tab="free"]'); await sleep(300); await page.keyboard.press('d'); await sleep(400); await waitLast('d-word');
    vl = await vlog();
    ok(P('free play: any key shows + says letter with picture'), (await page.textContent('#lcard')).includes('D') && vl.slice(-2).join() === 'd-name,d-word', vl.slice(-3));
    if (name === 'chromium') { await sleep(500); await page.screenshot({ path: SHOTS + '3-letter-explorer-free-play.png' }); }
    await page.click('[data-tab="book"]'); await sleep(400);
    ok(P('sticker book shows earned stickers'), await page.locator('.stk.got').count() === 2);
    await page.click('.stk[data-l="A"]'); await sleep(300); await waitLast('a-word');
    ok(P('tapping a sticker replays it'), await page.evaluate(() => document.querySelectorAll('#fx .mo').length > 0 && __tp.voiceLog.slice(-1)[0] === 'a-word'));
    if (name === 'chromium') await page.screenshot({ path: SHOTS + '4-sticker-book.png' });
    await page.keyboard.press('Escape'); await sleep(400);
    await page.click('[data-tab="learn"]'); await sleep(600);
    st = await page.evaluate(() => __tp.cur().state());
    ok(P('closing the book resumes the same path (next = C, no re-roll)'), st.target === 'C', st);

    /* ---------- Ninja Academy via physical keyboard ---------- */
    await page.evaluate(() => __tp.go('ninja')); await sleep(400);
    if (name === 'chromium') await page.screenshot({ path: SHOTS + '5-finger-ninja-academy.png' });
    ok(P('only mission 1 unlocked at start'), await page.locator('.mbtn:not(.locked)').count() === 1);
    await page.click('[data-play]'); await sleep(300);
    ok(P('F/J bump intro shown before first mission'), await page.locator('.bumpdemo').count() === 1);
    await page.keyboard.press('Enter'); await sleep(400);
    ok(P('lesson screen open'), await page.evaluate(() => __tp.screen() === 'lesson'));
    ok(P('hands overlay highlights correct finger (left pointer for F)'), await page.evaluate(() => [...document.querySelectorAll('.hands .fg.on')].map(e => e.getAttribute('data-f')).join() === 'li'));
    const lines = await page.evaluate(() => __tp.cur().mission.lines);
    await page.keyboard.press('k'); // one deliberate error
    await sleep(100);
    const coach = await page.textContent('#coach');
    ok(P('error coaching names the finger'), /left pointer/i.test(coach), coach);
    for (const ln of lines) { await page.keyboard.type(ln, { delay: 25 }); }
    await sleep(900);
    const rec = await page.evaluate(() => __tp.state().ninja.m.z1m1);
    ok(P('mission finished: stars + accuracy saved'), rec && rec.stars >= 2 && rec.acc > 95, rec);
    ok(P('results modal shows stars/WPM/XP'), (await page.locator('.modal.results .res-stars').count()) === 1 && /WPM/.test(await page.textContent('.modal.results')));
    if (name === 'chromium') await page.screenshot({ path: SHOTS + '7-finger-ninja-results.png' });
    const n1 = await page.evaluate(() => __tp.state().ninja);
    ok(P('XP, badges, day streak updated'), n1.xp > 0 && n1.badges.first && n1.badges.bumps && n1.days.count === 1, { xp: n1.xp, b: n1.badges, d: n1.days });
    await page.keyboard.press('Enter'); await sleep(500);
    ok(P('Enter goes to next mission (Left Hand Base)'), await page.evaluate(() => __tp.screen() === 'lesson' && __tp.cur().mission.id === 'z1m2'));
    await page.keyboard.type('asd', { delay: 30 }); await sleep(100);
    if (name === 'chromium') await page.screenshot({ path: SHOTS + '8-finger-ninja-lesson.png' });
    ok(P('typing advances lesson cursor'), await page.evaluate(() => __tp.cur().state().ci === 3));
    // boss: unlock zone 1 boss and fail it with mistakes
    await page.evaluate(() => { const m = __tp.state().ninja.m; ['z1m2', 'z1m3', 'z1m4', 'z1m5'].forEach(id => m[id] = { stars: 1, acc: 90, wpm: 10, plays: 1 }); __tp.go('lesson', 5); });
    await sleep(300);
    ok(P('boss battle has HP bar + shields'), await page.locator('.boss-bar .hp').count() === 1 && (await page.textContent('#shields')).length > 0);
    await page.keyboard.type('a lad', { delay: 30 }); await sleep(150);
    if (name === 'chromium') await page.screenshot({ path: SHOTS + '9-boss-battle.png' });
    for (let i = 0; i < 8; i++) { await page.keyboard.press('z'); await sleep(40); }
    await sleep(800);
    ok(P('boss: running out of shields = escape, 0 stars'), /escaped/i.test(await page.textContent('.modal')) && (await page.evaluate(() => (__tp.state().ninja.m.z1b || {}).stars === 0)));
    await page.keyboard.press('Escape'); await sleep(300);
    // arcade
    await page.evaluate(() => __tp.go('arcade')); await sleep(300);
    await page.keyboard.press(' '); await sleep(1300);
    const ch = await page.evaluate(() => (__tp.cur().state().met[0] || {}).ch);
    if (ch) await page.keyboard.press(ch); await sleep(200);
    const ar = await page.evaluate(() => ({ score: __tp.cur().state().score, blasted: __tp.cur().state().blasted, keys: __tp.cur().keys.join('') }));
    ok(P('arcade: meteors use unlocked keys and typing blasts them'), ch && ar.blasted === 1 && ar.score >= 10 && ar.keys.indexOf(ch) >= 0, { ch, ar });
    if (name === 'chromium') { for (let k = 0; k < 6; k++) { await sleep(700); const c2 = await page.evaluate(() => (__tp.cur().state().met.sort((a, b) => b.y - a.y)[1] || {}).ch); if (c2 && k % 2) await page.keyboard.press(c2); } await page.screenshot({ path: SHOTS + '10-meteor-strike.png' }); }
    // mute
    await page.click('#muteBtn'); await sleep(100);
    // reload -> persistence
    await page.reload(); await sleep(800);
    const after = await page.evaluate(() => __tp.state());
    ok(P('progress survives reload (stickers, missions, xp, mute, profiles)'), after.kid.stickers.A && after.kid.stickers.B && after.ninja.m.z1m1.stars >= 2 && after.ninja.xp === n1.xp + (after.ninja.xp - n1.xp) && after.ninja.xp >= n1.xp && after.muted === true && after.kid.nick === 'Turbo', { kid: after.kid, xp: after.ninja.xp, muted: after.muted });
    ok(P('home shows sticker count after reload'), /2 \/ 26/.test(await page.textContent('.pcard.kid')));
    await page.click('#muteBtn');

    /* ---------- offline ---------- */
    const sw = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return { supported: false };
      const reg = await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 15000))]);
      if (!reg) return { supported: true, ready: false };
      for (let i = 0; i < 50 && !navigator.serviceWorker.controller; i++) await new Promise(r => setTimeout(r, 200));
      const keys = await caches.keys(); const c = keys.length ? await caches.open(keys[0]) : null;
      return { supported: true, ready: true, scope: reg.scope, controlled: !!navigator.serviceWorker.controller, caches: keys, entries: c ? (await c.keys()).map(r => new URL(r.url).pathname) : [] };
    });
    ok(P('service worker registered + controlling'), sw.supported && sw.ready && sw.controlled, sw);
    ok(P('SW scope = repo folder (relative)'), /\/typing-pals\/$/.test(sw.scope || ''), sw.scope);
    ok(P('all 11 assets precached'), (sw.entries || []).length >= 11, sw.entries);
    if (name === 'chromium') {
      const cdp = await ctx.newCDPSession(page); const m = await cdp.send('Page.getAppManifest');
      ok(P('manifest parses with no errors'), m.url.endsWith('manifest.webmanifest') && m.errors.length === 0, m.errors);
    }
    await ctx.setOffline(true); offline = true;
    const r2 = await page.reload().catch(e => null); await sleep(900);
    ok(P('OFFLINE reload works'), r2 && r2.status() === 200 && (await page.title()) === 'Typing Pals', r2 && r2.status());
    ok(P('offline: progress still there'), await page.evaluate(() => __tp.state().kid.stickers.A === true));
    await page.click('.pcard.kid'); await sleep(3200);
    await page.keyboard.press(await page.evaluate(() => __tp.cur().state().target.toLowerCase())); await sleep(500);
    ok(P('offline: Letter Explorer playable'), await page.evaluate(() => __tp.cur().state().busy === true));
    const offClip = await page.evaluate(async () => { try { const b = await __tp.decodeClip('z-word'); return b.duration; } catch (e) { return 'ERR ' + e.message; } });
    ok(P('offline: voice clips decode from cache'), typeof offClip === 'number' && offClip > 0.5, offClip);
    const p2 = await ctx.newPage(); watch(p2, '[offline-tab]');
    const r3 = await p2.goto(BASE).catch(() => null); await sleep(800);
    ok(P('offline: cold start in new tab'), r3 && r3.status() === 200 && await p2.evaluate(() => !!window.__tp));
    await ctx.setOffline(false); offline = false;
    await ctx.close();

    /* ---------- iPad touch-only context ---------- */
    const tctx = await b.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: name === 'chromium', deviceScaleFactor: 2 });
    await tctx.addInitScript(spyInit);
    const tp = await tctx.newPage(); watch(tp, '[ipad]');
    await tp.goto(BASE); await sleep(800);
    await tp.tap('.pcard.kid'); await sleep(3200);
    let t = await tp.evaluate(() => __tp.cur().state());
    await tp.tap('.kbd.kid .key[data-k="M"]'); await sleep(300);
    const tw = await tp.evaluate(() => __tp.cur().state());
    await tp.tap(`.kbd.kid .key[data-k="${t.target}"]`, { force: true }); await sleep(500);
    ok(P('iPad touch: wrong tap = try again, right tap = sticker'), t.target === 'A' && tw.wrong === 1 && await tp.evaluate(() => __tp.state().kid.stickers.A === true), { t, tw });
    if (name === 'chromium') { await sleep(400); await tp.screenshot({ path: SHOTS + '11-letter-explorer-ipad-touch.png' }); }
    await tp.evaluate(() => __tp.go('ninja')); await sleep(300);
    ok(P('iPad touch-only: real-keyboard note shown on Ninja screen'), await tp.locator('.kbnote').count() === 1);
    await tp.evaluate(() => { __tp.state().ninja.introSeen = true; __tp.go('lesson', 0); }); await sleep(300);
    await tp.tap('.kbd.ninja .key[data-k="f"]'); await tp.tap('.kbd.ninja .key[data-k="f"]'); await sleep(150);
    ok(P('iPad touch: on-screen taps work in Ninja lesson'), await tp.evaluate(() => __tp.cur().state().ci === 2 && __tp.cur().state().correct === 2));
    await tctx.close();

    /* ---------- phone size sanity ---------- */
    const pctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: name === 'chromium' });
    const pp = await pctx.newPage(); watch(pp, '[phone]'); await pp.goto(BASE); await sleep(600);
    await pp.tap('.pcard.kid'); await sleep(800);
    const fits = await pp.evaluate(() => { const k = [...document.querySelectorAll('.kbd .key')].map(e => e.getBoundingClientRect()); return k.every(r => r.left >= -1 && r.right <= innerWidth + 1) && document.documentElement.scrollWidth <= innerWidth; });
    ok(P('phone: keyboard fits the screen'), fits);
    if (name === 'chromium') { await sleep(2600); await pp.screenshot({ path: SHOTS + '12-letter-explorer-phone.png' }); }
    await pctx.close();

    ok(P('no console/page errors (incl. CSP)'), errs.length === 0, errs);
    ok(P('no outside network requests'), ext.length === 0, ext);
    await b.close();
  }
  console.log(res.join('\n')); const nf = res.filter(r => r.startsWith('FAIL')).length; console.log(nf + ' failures of ' + res.length); process.exit(nf ? 1 : 0);
})().catch(e => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
