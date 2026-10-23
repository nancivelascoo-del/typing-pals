// usage: node audio-progress-test.js <baseURL> chromium,webkit [--e2e]
const pw = require('./lib').pw; const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = process.argv[2] || require('./lib').BASE; const E2E = process.argv.includes('--e2e');
const res = []; const ok = (n, c, i) => res.push((c ? 'PASS ' : 'FAIL ') + n + (i !== undefined && !c ? '  ' + JSON.stringify(i).slice(0, 500) : ''));
(async () => {
  for (const name of (process.argv[3] || 'chromium').split(',')) {
    const P = n => `[${name}] ${n}`;
    const b = await pw[name].launch(name === 'chromium' ? { ...require('./lib').exe() } : {});
    const errs = []; const ext = [];
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('request', r => { if (!r.url().startsWith(new URL(BASE).origin) && !/^(data|blob):/.test(r.url())) ext.push(r.url()); });
    await page.goto(BASE); await sleep(800);

    /* 1. every clip loads with an audio content type and decodes */
    const audio = await page.evaluate(async () => {
      const ids = Object.keys(__tp.clips), bad = [], types = {}; let bytes = 0, minD = 99, maxD = 0;
      for (const id of ids) {
        try {
          const r = await fetch('audio/' + id + '.mp3', { cache: 'no-store' }); const t = r.headers.get('content-type'); types[t] = (types[t] || 0) + 1;
          bytes += (await r.clone().arrayBuffer()).byteLength;
          if (!r.ok || !/^audio\//.test(t || '')) { bad.push(id + ' ' + r.status + ' ' + t); continue; }
          const buf = await __tp.decodeClip(id); minD = Math.min(minD, buf.duration); maxD = Math.max(maxD, buf.duration);
          if (!(buf.duration > (/^ph-/.test(id) ? 0.15 : 0.25) && buf.duration < 6)) bad.push(id + ' duration ' + buf.duration);
        } catch (e) { bad.push(id + ' ' + e.message); }
      }
      return { n: ids.length, bad, types, kb: Math.round(bytes / 1024), minD, maxD };
    });
    ok(P(`all ${audio.n} voice clips served as audio and decode (total ${audio.kb} KB, ${audio.minD.toFixed(2)}-${audio.maxD.toFixed(2)} s)`), audio.n >= 200 && audio.bad.length === 0, audio);
    ok(P('every letter has name/word/find/that/glow/findit clips'), await page.evaluate(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').every(L => ['name', 'word', 'find', 'that', 'glow', 'findit'].every(k => __tp.clips[L.toLowerCase() + '-' + k]))));

    /* 2. progression model */
    const sim = await page.evaluate(() => {
      const out = {};
      function run(wrongEvery, resumeEvery) {
        const K = __tp.migrateKid({ stickers: {} }); const seq = []; let rounds = 0, reviews = 0, presses = 0, cur = null, maxGap = 0;
        while (Object.keys(K.stickers).length < 26 && rounds < 200) {
          cur = (K.cur && (K.cur.kind !== 'new' || !K.stickers[K.cur.L])) ? K.cur : __tp.kidProgress.next(K); K.cur = cur; rounds++;
          if (resumeEvery && rounds % resumeEvery === 0) { const again = (K.cur && (K.cur.kind !== 'new' || !K.stickers[K.cur.L])) ? K.cur : __tp.kidProgress.next(K); if (again.L !== cur.L) return { error: 'resume rerolled' }; }
          if (wrongEvery && rounds % wrongEvery === 0) presses++; // a wrong press: target stays, nothing changes
          seq.push(cur.L + (cur.kind === 'review' ? '*' : '')); if (cur.kind === 'review') reviews++;
          presses++; __tp.kidProgress.found(K, cur);
        }
        const plain = seq.map(x => x[0]); const dup = plain.some((x, i) => i && x === plain[i - 1]);
        // reviews never closer than every 4 new letters
        let newSince = 0, tooSoon = false; seq.forEach(x => { if (x.endsWith('*')) { if (newSince < 4) tooSoon = true; newSince = 0; } else newSince++; });
        const mix = []; for (let i = 0; i < 60; i++) { const t = __tp.kidProgress.next(K); mix.push(t.L + t.kind[0]); __tp.kidProgress.found(K, t); }
        const mixDup = mix.some((x, i) => i && x[0] === mix[i - 1][0]);
        return { rounds, reviews, presses, dup, tooSoon, done: Object.keys(K.stickers).length, seq: seq.join(' '), mixDup, mixKinds: [...new Set(mix.map(x => x[1]))].join('') };
      }
      out.perfect = run(0, 0); out.wrongs = run(3, 0); out.resumes = run(0, 2);
      return out;
    });
    for (const k of ['perfect', 'wrongs', 'resumes']) {
      const r = sim[k];
      ok(P(`progression (${k}): all 26 reached in ${r.rounds} rounds (<= 32), ${r.reviews} reviews, no immediate repeats`), !r.error && r.done === 26 && r.rounds <= 32 && !r.dup && !r.tooSoon, r);
      ok(P(`after 26: mix-it-up mode, no immediate repeats (${k})`), r.mixKinds === 'm' && !r.mixDup, r);
    }
    console.log('    path:', sim.perfect.seq);

    /* 3. migration of an old (v1) save */
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('typingPals.v1') || '{}'); s.kid = { avatar: 'dino', color: '#51cf66', nick: '', stickers: { S: true, A: true, T: true, '?': true }, finds: 9, rounds: 7 }; localStorage.setItem('typingPals.v1', JSON.stringify(s)); });
    await page.reload(); await sleep(700);
    await page.click('.pcard.kid'); await sleep(3700);
    const mig = await page.evaluate(() => ({ st: __tp.cur().state(), v: __tp.state().kid.v, got: document.querySelectorAll('.trail .td.got').length, keys: Object.keys(__tp.state().kid.stickers).sort().join('') }));
    ok(P('old save migrated: keeps S/A/T stickers, drops junk, continues at B'), mig.v === 2 && mig.st.target === 'B' && mig.got === 3 && mig.keys === 'AST', mig);

    /* 4. end-to-end: a kid plays the whole alphabet (muted to run fast), with some wrong presses */
    if (E2E) {
      await page.evaluate(() => { localStorage.removeItem('typingPals.v1'); }); await page.reload(); await sleep(600);
      await page.click('#muteBtn'); await page.click('.pcard.kid'); await sleep(3600);
      const seen = []; let rounds = 0, wrongs = 0; const t0 = Date.now();
      while (rounds < 45) {
        await page.waitForFunction(() => { const s = __tp.cur().state(); return s.target && !s.busy; }, null, { timeout: 20000 });
        const s = await page.evaluate(() => __tp.cur().state());
        if (s.kind === 'mix') { seen.push(s.target + '~'); break; }
        seen.push(s.target + (s.kind === 'review' ? '*' : '')); rounds++;
        if (rounds % 5 === 0) { const w = s.target === 'Q' ? 'p' : 'q'; await page.keyboard.press(w); wrongs++; await sleep(150); }
        await page.keyboard.press(s.target.toLowerCase());
        await page.waitForFunction(() => __tp.cur().state().busy, null, { timeout: 5000 });
      }
      const K = await page.evaluate(() => __tp.state().kid);
      const plain = seen.map(x => x[0]);
      ok(P(`UI: whole alphabet completed in ${rounds} rounds with ${wrongs} wrong presses (${Math.round((Date.now() - t0) / 1000)}s)`), Object.keys(K.stickers).length === 26 && K.champ === true && rounds <= 32, { rounds, seen: seen.join(' ') });
      ok(P('UI: no letter twice in a row; then mix-it-up mode'), !plain.some((x, i) => i && x === plain[i - 1]) && seen[seen.length - 1].endsWith('~'), seen.join(' '));
      ok(P('UI: finale celebration played ("all" + "mix" clips)'), await page.evaluate(() => __tp.voiceLog.includes('all') && __tp.voiceLog.includes('mix')));
      ok(P('UI: trail shows all 26 gold'), await page.locator('.trail.champ .td.got').count() === 26);
      if (name === 'chromium') await page.screenshot({ path: require('./lib').shots('main') + '13-letter-explorer-all-26.png' });
      console.log('    UI path:', seen.join(' '));
    }
    ok(P('no console/page errors'), errs.length === 0, errs);
    ok(P('no outside requests'), ext.length === 0, ext);
    await b.close();
  }
  console.log(res.join('\n')); const nf = res.filter(r => r.startsWith('FAIL')).length; console.log(nf + ' failures of ' + res.length); process.exit(nf ? 1 : 0);
})().catch(e => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
