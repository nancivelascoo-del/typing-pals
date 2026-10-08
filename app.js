/* Typing Pals: app logic. No network requests; everything stays on this device. */
(function () {
  'use strict';
  var D = window.TP_DATA;
  var app = document.getElementById('app'), fx = document.getElementById('fx');

  /* ================= storage ================= */
  var KEY = 'typingPals.v1';
  function defaults() {
    return { v: 1, muted: false,
      kid: { avatar: 'dino', color: '#51cf66', nick: '', stickers: {}, finds: 0, rounds: 0 },
      ninja: { avatar: D.NINJA_AVATARS[0], color: '#339af0', nick: '', xp: 0, m: {}, pb: 0, badges: {}, arcadeHi: 0,
        bestCombo: 0, days: { last: '', count: 0 }, kbSeen: false, introSeen: false } };
  }
  function merge(base, extra) {
    if (!extra || typeof extra !== 'object') return base;
    Object.keys(base).forEach(function (k) {
      if (!(k in extra)) return;
      if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && Object.keys(base[k]).length) base[k] = merge(base[k], extra[k]);
      else base[k] = extra[k];
    });
    return base;
  }
  function load() { try { return merge(defaults(), JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { return defaults(); } }
  var S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode: play still works */ } }

  /* ================= helpers ================= */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16), r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  function todayStr(d) { d = d || new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  var toastT;
  function toast(msg, ms) { var t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, ms || 2200); }
  function center(el) { if (!el) return { x: innerWidth / 2, y: innerHeight / 2 }; var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

  /* ================= sound (Web Audio, synthesized, no files) ================= */
  var AC = null, noiseBuf = null;
  function ac() {
    if (S.muted) return null;
    if (!AC) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { AC = new C(); } catch (e) { return null; } }
    if (AC.state === 'suspended') { try { AC.resume(); } catch (e) {} }
    return AC;
  }
  function tone(f, d, o) {
    o = o || {}; var a = ac(); if (!a) return;
    var t = a.currentTime + (o.at || 0), osc = a.createOscillator(), g = a.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + d);
    var v = o.vol || 0.16; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(g); g.connect(a.destination); osc.start(t); osc.stop(t + d + 0.05);
  }
  function noise(d, o) {
    o = o || {}; var a = ac(); if (!a) return;
    if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate); var ch = noiseBuf.getChannelData(0); for (var i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
    var t = a.currentTime + (o.at || 0), src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = noiseBuf; src.loop = true; f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + d);
    var v = o.vol || 0.2; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.02)); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f); f.connect(g); g.connect(a.destination); src.start(t); src.stop(t + d + 0.05);
  }
  var SFX = {
    tap: function () { tone(660, 0.07, { type: 'triangle', vol: 0.06 }); },
    good: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.2, { type: 'triangle', at: i * 0.07, vol: 0.14 }); }); },
    oops: function () { tone(392, 0.16, { to: 330, vol: 0.1 }); tone(330, 0.22, { at: 0.14, to: 294, vol: 0.09 }); },
    pop: function () { noise(0.12, { f: 1800, vol: 0.5, type: 'highpass' }); tone(800, 0.08, { to: 200, type: 'square', vol: 0.04 }); },
    star: function () { [1319, 1568, 2093].forEach(function (f, i) { tone(f, 0.18, { type: 'sine', at: i * 0.06, vol: 0.08 }); }); },
    sticker: function () { [523, 659, 784, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.16, { type: 'square', at: i * 0.09, vol: 0.05 }); }); },
    giggle: function () { [700, 820, 700, 900].forEach(function (f, i) { tone(f, 0.08, { type: 'triangle', at: i * 0.09, to: f * 1.2, vol: 0.08 }); }); },
    boing: function () { tone(160, 0.35, { to: 520, vol: 0.18 }); tone(260, 0.3, { at: 0.35, to: 600, vol: 0.12 }); },
    meow: function () { tone(600, 0.45, { to: 820, type: 'sawtooth', vol: 0.04 }); tone(820, 0.3, { at: 0.4, to: 500, type: 'sawtooth', vol: 0.04 }); },
    stomp: function () { [0, 0.45, 0.9, 1.35, 1.8].forEach(function (at) { tone(80, 0.3, { to: 38, vol: 0.5, at: at }); noise(0.15, { f: 200, type: 'lowpass', vol: 0.4, at: at }); }); },
    trumpet: function () { tone(440, 0.5, { to: 560, type: 'sawtooth', vol: 0.07 }); tone(560, 0.6, { at: 0.45, to: 470, type: 'sawtooth', vol: 0.07 }); },
    bubble: function () { for (var i = 0; i < 6; i++) tone(300 + Math.random() * 300, 0.12, { to: 1200, at: i * 0.12, vol: 0.08 }); },
    whoosh: function () { noise(0.9, { f: 300, to: 2500, vol: 0.3, attack: 0.3 }); },
    sparkle: function () { for (var i = 0; i < 7; i++) tone(1200 + Math.random() * 1400, 0.15, { at: i * 0.07, vol: 0.06 }); },
    roar: function () { noise(0.9, { f: 400, to: 150, type: 'lowpass', vol: 0.5 }); tone(130, 0.8, { to: 70, type: 'sawtooth', vol: 0.08 }); },
    blast: function () { noise(1.6, { f: 200, to: 3000, vol: 0.4, attack: 0.4 }); tone(60, 1.2, { vol: 0.3 }); },
    hiss: function () { noise(1.0, { f: 5000, type: 'highpass', vol: 0.18, attack: 0.2 }); },
    choo: function () { tone(880, 0.5, { type: 'triangle', vol: 0.08 }); tone(1100, 0.5, { type: 'triangle', vol: 0.06 }); [0.6, 0.9, 1.2, 1.5].forEach(function (at) { noise(0.14, { f: 900, vol: 0.25, at: at }); }); },
    rumble: function () { noise(1.4, { f: 120, type: 'lowpass', vol: 0.6, attack: 0.3 }); noise(0.6, { f: 800, vol: 0.2, at: 0.8 }); },
    xylo: function () { [523, 587, 659, 698, 784, 880, 988, 1047].forEach(function (f, i) { tone(f, 0.3, { type: 'triangle', at: i * 0.12, vol: 0.14 }); }); },
    gallop: function () { for (var i = 0; i < 8; i++) tone(i % 2 ? 900 : 700, 0.05, { type: 'square', at: i * 0.18 + (i % 2) * 0.06, vol: 0.05 }); },
    key: function (c) { tone(900 + Math.min(c || 0, 40) * 12, 0.04, { type: 'triangle', vol: 0.05 }); },
    err: function () { tone(150, 0.13, { type: 'square', vol: 0.05 }); },
    line: function () { tone(784, 0.1, { type: 'triangle', vol: 0.08 }); tone(1175, 0.15, { type: 'triangle', at: 0.08, vol: 0.08 }); },
    win: function () { [523, 659, 784, 1047, 784, 1047, 1319].forEach(function (f, i) { tone(f, 0.22, { type: 'square', at: i * 0.11, vol: 0.05 }); }); },
    lose: function () { [392, 349, 311, 262].forEach(function (f, i) { tone(f, 0.25, { type: 'triangle', at: i * 0.16, vol: 0.1 }); }); },
    levelup: function () { [392, 523, 659, 784, 1047, 1319, 1568].forEach(function (f, i) { tone(f, 0.25, { type: 'sawtooth', at: i * 0.08, vol: 0.05 }); }); },
    laser: function () { tone(1400, 0.15, { to: 200, type: 'square', vol: 0.05 }); },
    boom: function () { noise(0.5, { f: 600, to: 80, type: 'lowpass', vol: 0.6 }); },
    hit: function () { noise(0.1, { f: 900, vol: 0.3 }); tone(220, 0.08, { type: 'square', vol: 0.05 }); }
  };

  /* ================= speech ================= */
  var synth = ('speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function') ? window.speechSynthesis : null;
  var voice = null, sayId = 0;
  function pickVoice() {
    if (!synth) return;
    var vs = []; try { vs = synth.getVoices() || []; } catch (e) {}
    var en = vs.filter(function (v) { return /^en/i.test(v.lang); });
    var prefs = ['Samantha', 'Karen', 'Moira', 'Tessa', 'Google US English', 'Aria', 'Jenny', 'Zira', 'Daniel'];
    voice = null;
    for (var i = 0; i < prefs.length && !voice; i++) voice = en.filter(function (v) { return v.name.indexOf(prefs[i]) >= 0; })[0] || null;
    voice = voice || en.filter(function (v) { return v.localService; })[0] || en[0] || null;
  }
  if (synth) { pickVoice(); if (synth.addEventListener) synth.addEventListener('voiceschanged', pickVoice); }
  function setTalk(on) { var b = $('#app .buddy'); if (b) b.classList.toggle('talk', !!on); }
  // Resolves when speech ends (or after a short pause when muted / unsupported).
  function say(text, opt) {
    opt = opt || {}; var id = ++sayId; var est = 600 + text.length * 65;
    return new Promise(function (resolve) {
      var finished = false;
      function end() { if (finished) return; finished = true; if (id === sayId) setTalk(false); resolve(); }
      if (S.muted || !synth) { setTalk(!S.muted); setTimeout(end, S.muted ? 300 : Math.min(est, 2500)); return; }
      try {
        synth.cancel();
        var u = new window.SpeechSynthesisUtterance(text);
        if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-US';
        u.rate = opt.rate || 0.95; u.pitch = opt.pitch || 1.25; u.volume = 1;
        u.onend = end; u.onerror = end;
        setTimeout(end, est + 3500);
        setTalk(true); synth.speak(u);
      } catch (e) { setTimeout(end, 400); }
    });
  }
  function hush() { sayId++; setTalk(false); if (synth) { try { synth.cancel(); } catch (e) {} } }

  /* ================= buddy characters (inline SVG) ================= */
  function buddySVG(kind, color) {
    var c = color || '#51cf66', d = shade(c, -45), l = shade(c, 60);
    var face =
      '<ellipse cx="78" cy="72" rx="16" ry="18" fill="#fff"/><ellipse cx="122" cy="72" rx="16" ry="18" fill="#fff"/>' +
      '<circle class="pupil" cx="80" cy="75" r="8" fill="#212529"/><circle class="pupil r" cx="120" cy="75" r="8" fill="#212529"/>' +
      '<circle cx="83" cy="71" r="3" fill="#fff"/><circle cx="123" cy="71" r="3" fill="#fff"/>' +
      '<ellipse class="eye-lid" cx="78" cy="72" rx="17" ry="19" fill="' + c + '"/><ellipse class="eye-lid" cx="122" cy="72" rx="17" ry="19" fill="' + c + '"/>' +
      '<circle cx="62" cy="98" r="8" fill="#ff8fab" opacity=".6"/><circle cx="138" cy="98" r="8" fill="#ff8fab" opacity=".6"/>' +
      '<path class="m-smile" d="M80 100 Q100 122 120 100" stroke="#212529" stroke-width="6" fill="none" stroke-linecap="round"/>' +
      '<ellipse class="m-open" cx="100" cy="106" rx="15" ry="13" fill="#862e3c"/>' +
      '<path class="m-silly" d="M74 98 Q100 130 126 98 Z" fill="#862e3c"/><ellipse class="tongue" cx="106" cy="118" rx="10" ry="12" fill="#ff8fab"/>' +
      '<circle class="m-o" cx="100" cy="108" r="7" fill="#862e3c"/>';
    if (kind === 'robot') {
      return '<svg class="buddy robot" viewBox="0 0 200 230" aria-hidden="true"><g class="body-all">' +
        '<g class="tail"><line x1="100" y1="22" x2="100" y2="2" stroke="' + d + '" stroke-width="6"/><circle cx="100" cy="4" r="9" fill="#ff6b6b"/></g>' +
        '<rect x="66" y="196" width="26" height="30" rx="8" fill="' + d + '"/><rect x="108" y="196" width="26" height="30" rx="8" fill="' + d + '"/>' +
        '<g class="arm-l"><rect x="22" y="134" width="22" height="56" rx="11" fill="' + d + '"/><circle cx="33" cy="192" r="12" fill="' + l + '"/></g>' +
        '<g class="arm-r"><rect x="156" y="134" width="22" height="56" rx="11" fill="' + d + '"/><circle cx="167" cy="192" r="12" fill="' + l + '"/></g>' +
        '<rect x="44" y="126" width="112" height="80" rx="22" fill="' + c + '"/><rect x="70" y="144" width="60" height="40" rx="10" fill="' + l + '"/>' +
        '<circle cx="86" cy="164" r="7" fill="#ffd43b"/><circle cx="114" cy="164" r="7" fill="#ff6b6b"/>' +
        '<g class="head"><rect x="40" y="22" width="120" height="110" rx="34" fill="' + c + '"/><rect x="28" y="62" width="14" height="34" rx="6" fill="' + d + '"/><rect x="158" y="62" width="14" height="34" rx="6" fill="' + d + '"/>' + face + '</g>' +
        '</g></svg>';
    }
    var spikes = ''; [[64, 34], [88, 20], [114, 20], [138, 34]].forEach(function (p) { spikes += '<path d="M' + (p[0] - 12) + ' ' + (p[1] + 14) + ' L' + p[0] + ' ' + (p[1] - 10) + ' L' + (p[0] + 12) + ' ' + (p[1] + 14) + ' Z" fill="' + d + '"/>'; });
    return '<svg class="buddy dino" viewBox="0 0 200 230" aria-hidden="true"><g class="body-all">' +
      '<path class="tail" d="M58 170 Q18 182 4 146 Q30 160 64 150 Z" fill="' + c + '"/>' +
      '<rect x="66" y="196" width="26" height="30" rx="12" fill="' + d + '"/><rect x="108" y="196" width="26" height="30" rx="12" fill="' + d + '"/>' +
      '<ellipse cx="100" cy="166" rx="58" ry="46" fill="' + c + '"/><ellipse cx="100" cy="174" rx="36" ry="30" fill="' + l + '"/>' +
      '<g class="arm-l"><ellipse cx="46" cy="156" rx="11" ry="24" fill="' + d + '" transform="rotate(35 46 156)"/></g>' +
      '<g class="arm-r"><ellipse cx="154" cy="156" rx="11" ry="24" fill="' + d + '" transform="rotate(-35 154 156)"/></g>' +
      '<g class="head">' + spikes + '<ellipse cx="100" cy="82" rx="62" ry="54" fill="' + c + '"/>' + face + '</g>' +
      '</g></svg>';
  }
  var XYLO_SVG = '<svg viewBox="0 0 120 80" aria-hidden="true"><rect x="4" y="64" width="112" height="8" rx="4" fill="#8d5524"/>' +
    ['#ff6b6b', '#ff922b', '#fcc419', '#51cf66', '#339af0', '#9775fa'].map(function (c, i) { return '<rect x="' + (8 + i * 18) + '" y="' + (8 + i * 5) + '" width="14" height="' + (60 - i * 8) + '" rx="4" fill="' + c + '"/>'; }).join('') +
    '<line x1="70" y1="4" x2="108" y2="30" stroke="#495057" stroke-width="4" stroke-linecap="round"/><circle cx="70" cy="4" r="6" fill="#e64980"/></svg>';
  function pic(L) { var e = D.LETTERS[L].e; return e === 'XYLO' ? XYLO_SVG : e; }

  var buddyMoodT;
  function buddyDo(mood, ms) {
    var b = $('#app .buddy'); if (!b) return;
    ['dance', 'cheer', 'highfive', 'silly', 'think', 'spin'].forEach(function (m) { b.classList.remove(m); });
    void b.getBoundingClientRect();
    b.classList.add(mood); clearTimeout(buddyMoodT);
    buddyMoodT = setTimeout(function () { b.classList.remove(mood); }, ms || 2000);
    if (mood === 'highfive') { var w = $('#buddyWrap'); if (w) { var hnd = h('div', 'hf-hand', '\u{1F590}\uFE0F'); w.appendChild(hnd); setTimeout(function () { hnd.remove(); }, 1300); } }
  }
  function bubble(emoji) { var b = $('#bubble'); if (!b) return; b.textContent = emoji; b.classList.add('show'); clearTimeout(b._t); b._t = setTimeout(function () { b.classList.remove('show'); }, 1600); }

  /* ================= effects ================= */
  function burst(x, y, emojis, n, spread) {
    n = n || 10; spread = spread || 160;
    for (var i = 0; i < n; i++) {
      var p = h('span', 'pt', pick(emojis)); var a = Math.random() * Math.PI * 2, r = spread * (0.5 + Math.random() * 0.7);
      p.style.setProperty('--x0', (x - 17) + 'px'); p.style.setProperty('--y0', (y - 17) + 'px');
      p.style.setProperty('--x1', (x - 17 + Math.cos(a) * r) + 'px'); p.style.setProperty('--y1', (y - 17 + Math.sin(a) * r) + 'px');
      p.style.setProperty('--r', (Math.random() * 360 - 180) + 'deg'); p.style.animationDelay = (Math.random() * 0.1) + 's';
      fx.appendChild(p); (function (pp) { setTimeout(function () { pp.remove(); }, 1300); })(p);
    }
  }
  function confetti() { for (var i = 0; i < 4; i++) (function (i) { setTimeout(function () { burst(innerWidth * (0.15 + Math.random() * 0.7), innerHeight * (0.2 + Math.random() * 0.4), ['\u{1F389}', '\u2B50', '\u2728', '\u{1F38A}', '\u{1F31F}'], 14, 240); }, i * 220); })(i); }
  function quake() { var s = $('#app .screen'); if (!s) return; s.classList.remove('quake'); void s.offsetWidth; s.classList.add('quake'); setTimeout(function () { s.classList.remove('quake'); }, 1600); }
  function moment(L) {
    var info = D.LETTERS[L]; var olds = $$('.mo', fx); if (olds.length > 2) olds[0].remove();
    var m = h('div', 'mo ' + info.m, '<span>' + pic(L) + '</span>'); fx.appendChild(m);
    if (SFX[info.s]) SFX[info.s]();
    if (info.m === 'stomp') quake();
    if (info.m === 'erupt') { quake(); setTimeout(function () { burst(innerWidth / 2, innerHeight / 2 - 60, ['\u{1F525}', '\u2728', '\u{1F4A5}'], 16, 260); }, 500); }
    setTimeout(function () { m.remove(); }, 4300);
  }
  function balloon() {
    var b = h('div', 'balloon', '<span>\u{1F388}</span>'); b.style.left = (10 + Math.random() * 75) + '%';
    b.style.filter = 'hue-rotate(' + Math.floor(Math.random() * 360) + 'deg)';
    b.addEventListener('pointerdown', function (e) {
      e.preventDefault(); e.stopPropagation(); var r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 3;
      b.remove(); SFX.pop(); var bm = h('div', 'boom', '\u{1F4A5}'); bm.style.left = x + 'px'; bm.style.top = y + 'px'; fx.appendChild(bm);
      setTimeout(function () { bm.remove(); }, 600); burst(x, y, ['\u2B50', '\u2728', '\u{1F31F}'], 10); buddyDo('cheer', 1400); say(pick(['Pop!', 'Ka-pow!', 'Boom! Pop!']));
    });
    fx.appendChild(b); setTimeout(function () { b.remove(); }, 6200);
  }
  function clearFx() { fx.innerHTML = ''; }

  /* ================= modal ================= */
  var modalEl = null, modalEnter = null, modalEsc = null;
  function openModal(html, opts) {
    closeModal(); opts = opts || {};
    var back = h('div', 'modal-back'); var m = h('div', 'modal' + (opts.dark ? ' dark' : ''), html);
    if (opts.close !== false) { var x = h('button', 'close-x', '\u2715'); x.setAttribute('aria-label', 'Close'); x.addEventListener('click', function () { SFX.tap(); closeModal(); if (opts.onClose) opts.onClose(); }); m.appendChild(x); }
    back.appendChild(m); document.body.appendChild(back); modalEl = back; modalEnter = opts.onEnter || null;
    modalEsc = opts.onEsc || (opts.close !== false ? function () { closeModal(); if (opts.onClose) opts.onClose(); } : null);
    return m;
  }
  function closeModal() { if (modalEl) modalEl.remove(); modalEl = null; modalEnter = null; modalEsc = null; }

  /* ================= router ================= */
  var cur = null, SCREENS = {};
  function go(name, arg) {
    if (cur && cur.cleanup) cur.cleanup();
    closeModal(); clearFx(); hush(); app.innerHTML = '';
    cur = SCREENS[name](arg) || {}; cur.name = name; window.scrollTo(0, 0);
  }

  /* ================= keyboards ================= */
  function kidKeyboard() {
    var k = h('div', 'kbd kid'); k.id = 'kbd';
    D.KID_ROWS.forEach(function (row) { var r = h('div', 'krow'); row.split('').forEach(function (L) { var b = h('button', 'key', L); b.dataset.k = L; b.setAttribute('aria-label', L); r.appendChild(b); }); k.appendChild(r); });
    return k;
  }
  function ninjaKeyboard(allowed) {
    var k = h('div', 'kbd ninja'); k.id = 'kbd';
    D.NINJA_ROWS.forEach(function (row) {
      var r = h('div', 'krow');
      row.split('').forEach(function (ch) {
        var b = h('button', 'key f-' + D.FINGER[ch] + (ch === 'f' || ch === 'j' ? ' bump' : '') + (allowed && allowed.indexOf(ch) < 0 ? ' off' : ''), ch.toUpperCase());
        b.dataset.k = ch; b.setAttribute('aria-label', ch === ';' ? 'semicolon' : ch); r.appendChild(b);
      });
      k.appendChild(r);
    });
    var sr = h('div', 'krow'); var sp = h('button', 'key space f-th', 'space'); sp.dataset.k = ' '; sr.appendChild(sp); k.appendChild(sr);
    return k;
  }
  function bindTaps(kbd, fn) {
    kbd.addEventListener('pointerdown', function (e) {
      var b = e.target.closest ? e.target.closest('.key') : null; if (!b || !b.dataset.k) return;
      e.preventDefault(); fn(b.dataset.k, 'tap');
    });
  }
  function keyEl(k) { var kb = $('#kbd'); if (!kb) return null; return $$('.key', kb).filter(function (b) { return b.dataset.k === k; })[0] || null; }
  function pressAnim(k) { var b = keyEl(k); if (!b) return; b.classList.add('down'); setTimeout(function () { b.classList.remove('down'); }, 120); }
  function flashKey(k, cls, ms) { var b = keyEl(k); if (!b) return; b.classList.remove(cls); void b.offsetWidth; b.classList.add(cls); setTimeout(function () { b.classList.remove(cls); }, ms || 500); }

  /* ================= HOME ================= */
  function beltIndex(xp) { var i = 0; D.BELTS.forEach(function (b, j) { if (xp >= b.xp) i = j; }); return i; }
  function stickerCount() { return Object.keys(S.kid.stickers).filter(function (k) { return S.kid.stickers[k]; }).length; }
  SCREENS.home = function () {
    var s = h('div', 'screen'); s.id = 'home';
    var title = 'Typing Pals'.split('').map(function (c) { return c === ' ' ? '&nbsp;' : '<span>' + c + '</span>'; }).join('');
    var belt = D.BELTS[beltIndex(S.ninja.xp)];
    s.innerHTML = '<div class="home-title">' + title + '</div>' +
      '<div class="cards">' +
      '<div class="pcard kid" role="button" tabindex="0" data-go="ex" aria-label="Letter Explorer" style="--pc:' + S.kid.color + '">' +
        '<button class="edit" data-edit="kid" aria-label="Change buddy">\u{1F3A8}</button>' +
        '<div class="av">' + buddySVG(S.kid.avatar, S.kid.color) + '</div>' +
        '<div class="info" style="display:flex;flex-direction:column;align-items:center;gap:6px"><div class="nm">' + esc(S.kid.nick || 'Letter Explorer') + '</div>' +
        '<div class="abc">A B C</div><div class="sub">\u2B50 ' + stickerCount() + ' / 26</div></div></div>' +
      '<div class="pcard ninja" role="button" tabindex="0" data-go="ninja" aria-label="Ninja Keys Academy" style="--pc:' + S.ninja.color + '">' +
        '<button class="edit" data-edit="ninja" aria-label="Change avatar">\u{1F3A8}</button>' +
        '<div class="av">' + S.ninja.avatar + '</div>' +
        '<div class="info" style="display:flex;flex-direction:column;align-items:center;gap:6px"><div class="nm">' + esc(S.ninja.nick || 'Ninja Keys Academy') + '</div>' +
        '<div class="sub"><span class="belt" style="--bc:' + belt.c + '"><i></i>' + belt.n + '</span></div><div class="sub">\u2328\uFE0F Ten-finger typing</div></div></div>' +
      '</div><button class="grown" data-grown>Grown-ups</button>';
    app.appendChild(s);
    $$('.pcard', s).forEach(function (c) {
      c.addEventListener('click', function (e) {
        if (e.target.closest('.edit')) return;
        SFX.good(); go(c.dataset.go);
      });
    });
    $$('.edit', s).forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); SFX.tap(); customize(b.dataset.edit); }); });
    $('[data-grown]', s).addEventListener('click', function () { SFX.tap(); grownUps(); });
    return { onKey: function () {} };
  };

  function customize(who) {
    var P = S[who], isKid = who === 'kid';
    function done() { save(); closeModal(); SFX.good(); go('home'); }
    var m = openModal('<div class="cz"></div>', { onClose: function () { save(); go('home'); }, onEnter: done, dark: !isKid });
    var box = $('.cz', m);
    function render() {
      var avs = isKid ? D.KID_AVATARS.map(function (a) { return '<button class="chip' + (P.avatar === a ? ' sel' : '') + '" data-av="' + a + '" aria-label="' + a + '">' + buddySVG(a, P.color) + '</button>'; }).join('')
        : D.NINJA_AVATARS.map(function (a) { return '<button class="chip' + (P.avatar === a ? ' sel' : '') + '" data-av="' + a + '">' + a + '</button>'; }).join('');
      var cols = D.COLORS.map(function (c) { return '<button class="chip color' + (P.color === c ? ' sel' : '') + '" data-col="' + c + '" style="background:' + c + '" aria-label="color ' + c + '"></button>'; }).join('');
      var nicks = (isKid ? D.KID_NICKS : D.NINJA_NICKS).map(function (n) { return '<button class="chip txt' + (P.nick === n ? ' sel' : '') + '" data-nick="' + esc(n) + '">' + esc(n) + '</button>'; }).join('') +
        '<button class="chip txt' + (!P.nick ? ' sel' : '') + '" data-nick="">\u{1F6AB} No nickname</button>';
      box.innerHTML = '<h2>' + (isKid ? '\u{1F43E} Pick your buddy' : '\u{1F977} Pick your avatar') + '</h2><div class="chips">' + avs + '</div>' +
        '<h3>\u{1F3A8} Color</h3><div class="chips">' + cols + '</div><h3>\u{1F3F7}\uFE0F Nickname (optional)</h3><div class="chips">' + nicks + '</div>' +
        '<div><button class="big-btn" data-done>\u2714\uFE0F Done</button></div>';
      $$('[data-av]', box).forEach(function (b) { b.addEventListener('click', function () { P.avatar = b.dataset.av; SFX.tap(); if (isKid) say(b.dataset.av === 'robot' ? 'Beep boop! I am Robo!' : 'Roar! I am Dino!'); render(); }); });
      $$('[data-col]', box).forEach(function (b) { b.addEventListener('click', function () { P.color = b.dataset.col; SFX.star(); render(); }); });
      $$('[data-nick]', box).forEach(function (b) { b.addEventListener('click', function () { P.nick = b.dataset.nick; SFX.tap(); if (P.nick) say(P.nick + '!'); render(); }); });
      $('[data-done]', box).addEventListener('click', done);
    }
    render();
  }

  function holdButton(btn, ms, fn) {
    var t = null;
    function start(e) { e.preventDefault(); btn.classList.add('holding'); t = setTimeout(function () { btn.classList.remove('holding'); fn(); }, ms); }
    function stop() { btn.classList.remove('holding'); clearTimeout(t); }
    btn.addEventListener('pointerdown', start); ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { btn.addEventListener(ev, stop); });
  }
  function grownUps() {
    var m = openModal('<h2>For grown-ups</h2>' +
      '<p class="note"><b>Letter Explorer</b> (ages 4\u20136): a talking buddy says each letter and a word, and the matching key glows. Tap the key or press it on a keyboard. No reading needed. Each letter found earns a sticker, and \u{1F3B9} is free play.</p>' +
      '<p class="note"><b>Ninja Keys Academy</b> (ages 8+): real ten-finger touch typing, starting from the home row. Missions earn stars, XP and belts, with a boss battle at the end of each zone and a Meteor Strike arcade game. A real keyboard works best (an iPad with a Bluetooth or Smart Keyboard works too).</p>' +
      '<p class="note">\u{1F512} No accounts, ads, links or tracking. Nothing is sent anywhere. Progress is saved only on this device and browser. After the first visit it works offline from the Home Screen icon.</p>' +
      '<h3>Reset progress (press and hold)</h3>' +
      '<button class="big-btn red hold" data-r="kid">Reset Letter Explorer</button><button class="big-btn red hold" data-r="ninja">Reset Ninja Academy</button>');
    $$('[data-r]', m).forEach(function (b) {
      holdButton(b, 2500, function () {
        var who = b.dataset.r, d = defaults(), keep = { avatar: S[who].avatar, color: S[who].color, nick: S[who].nick };
        if (who === 'ninja') keep.kbSeen = S.ninja.kbSeen;
        S[who] = merge(d[who], keep); save(); SFX.pop(); toast('Progress reset'); closeModal(); go('home');
      });
    });
  }

  /* ================= LETTER EXPLORER ================= */
  SCREENS.ex = function () {
    var K = S.kid, mode = 'learn', target = null, round = 0, busy = false, wrong = 0, hintT = null, lastReview = null, lastFree = 0, alive = true;
    var s = h('div', 'screen'); s.id = 'ex';
    s.innerHTML = '<div class="ex-top"><button class="round-btn" data-home aria-label="Home">\u{1F3E0}</button>' +
      '<button class="tab on" data-tab="learn" aria-label="Find the letter">\u{1F3AF}</button><button class="tab" data-tab="free" aria-label="Free play">\u{1F3B9}</button>' +
      '<button class="tab" data-tab="book" aria-label="Sticker book">\u{1F4D2}</button><div class="count">\u2B50 <span id="stkCount">' + stickerCount() + '</span>/26</div></div>' +
      '<div class="ex-stage"><div class="buddy-wrap" id="buddyWrap">' + buddySVG(K.avatar, K.color) + '<div class="bubble" id="bubble"></div></div>' +
      '<div class="lcard" id="lcard"></div></div>';
    var kbd = kidKeyboard(); s.appendChild(kbd); app.appendChild(s);
    var card = $('#lcard', s);
    function sayL(L) { return D.LETTERS[L].say; }
    function nick(p) { return K.nick && Math.random() < (p || 0.35) ? ', ' + K.nick : ''; }
    function showCard(L, showSpeak) {
      var col = ['#ff6b6b', '#339af0', '#f76707', '#7048e8', '#2f9e44', '#e64980'][L.charCodeAt(0) % 6];
      card.style.setProperty('--lc', col);
      card.innerHTML = '<div class="ltr">' + L + '<small>' + L.toLowerCase() + '</small></div><div class="pic">' + pic(L) + '</div>' + (showSpeak ? '<button class="speak" aria-label="Say it again">\u{1F50A}</button>' : '');
      var sp = $('.speak', card); if (sp) sp.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); prompt(true); });
      card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
    }
    function clearGlow() { $$('.key.glow', kbd).forEach(function (k) { k.classList.remove('glow', 'hint'); }); }
    function setTab(t) { $$('.tab', s).forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); }); }
    function nextTarget() {
      var earned = D.ORDER.filter(function (L) { return K.stickers[L]; });
      var fresh = D.ORDER.filter(function (L) { return !K.stickers[L]; })[0];
      K.rounds = (K.rounds || 0) + 1;
      if (!fresh || (earned.length >= 2 && K.rounds % 3 === 0)) {
        var pool = earned.filter(function (L) { return L !== lastReview; }); var r = pick(pool.length ? pool : earned); lastReview = r; return r;
      }
      return fresh;
    }
    function prompt(again) {
      var L = target; if (!L) return;
      var w = D.LETTERS[L].w;
      if (again) say('Find ' + sayL(L) + '! ' + sayL(L) + ' is for ' + w + '!');
      else say(sayL(L) + '! ' + sayL(L) + ' is for ' + w + '! Can you find ' + sayL(L) + nick(0.25) + '?');
    }
    function armHints(r) {
      clearTimeout(hintT); var n = 0;
      (function loop() {
        hintT = setTimeout(function () {
          if (!alive || r !== round || busy || mode !== 'learn') return;
          n++; var k = keyEl(target); if (k) k.classList.add('hint');
          buddyDo('think', 1500); bubble('\u{1F447}'); say('Find ' + sayL(target) + '! Look for the glowing key!');
          if (n < 3) loop();
        }, n === 0 ? 9000 : 12000);
      })();
    }
    function newRound() {
      if (!alive || mode !== 'learn') return;
      round++; busy = false; wrong = 0; target = nextTarget(); save();
      clearGlow(); showCard(target, true); var k = keyEl(target); if (k) k.classList.add('glow');
      prompt(false); armHints(round);
    }
    function startLearn() { mode = 'learn'; setTab('learn'); newRound(); }
    function startFree() {
      mode = 'free'; round++; setTab('free'); busy = false; clearTimeout(hintT); clearGlow(); target = null;
      card.innerHTML = '<div class="ex-play-hint">\u{1F3B9}</div>'; say('Free play! Press any letter' + nick(0.5) + '!'); buddyDo('dance', 1800);
    }
    function reaction() {
      var r = pick(['dance', 'cheer', 'highfive', 'silly', 'spin']); buddyDo(r, 2000);
      bubble(pick(['\u{1F60D}', '\u{1F929}', '\u{1F389}', '\u{1F44F}', '\u{1F61C}', '\u{1F496}']));
      return r;
    }
    function correct() {
      busy = true; clearTimeout(hintT); var r = round, L = target, isNew = !K.stickers[L];
      SFX.good(); flashKey(L, 'good', 700); clearGlow();
      var kc = center(keyEl(L)); burst(kc.x, kc.y, ['\u2B50', '\u{1F31F}', '\u2728'], 12);
      var react = reaction(); K.finds = (K.finds || 0) + 1;
      setTimeout(function () { if (alive) moment(L); }, 250);
      var line = (react === 'highfive' ? 'High five!' : pick(D.KID_CHEERS)) + nick() + ' ' + sayL(L) + ' is for ' + D.LETTERS[L].w + '!';
      var talk = say(line);
      if (isNew) {
        K.stickers[L] = true; save();
        setTimeout(function () {
          if (!alive) return;
          var tab = $('[data-tab="book"]', s), tc = center(tab), st = h('div', 'flysticker', pic(L));
          st.style.setProperty('--tx', (tc.x - innerWidth / 2) + 'px'); st.style.setProperty('--ty', (tc.y - innerHeight / 2) + 'px');
          fx.appendChild(st); SFX.sticker();
          setTimeout(function () { st.remove(); if (!alive) return; $('#stkCount', s).textContent = stickerCount(); burst(tc.x, tc.y, ['\u2728', '\u2B50'], 8, 80); }, 1200);
        }, 1300);
      }
      if (Math.random() < 0.45) setTimeout(function () { if (alive) balloon(); }, 900);
      var n = stickerCount(), milestone = isNew && (n % 5 === 0 || n === 26);
      Promise.all([talk, wait(isNew ? 2900 : 2300)]).then(function () {
        if (!alive || r !== round || mode !== 'learn') return;
        if (milestone) {
          confetti(); buddyDo('dance', 2600); SFX.win();
          return say(n === 26 ? 'You found every letter! You are a letter champion!' : 'Wow! ' + n + ' stickers! You are amazing!').then(function () { return wait(600); });
        }
      }).then(function () { if (alive && r === round && mode === 'learn' && !modalEl) newRound(); });
    }
    function oops(k) {
      wrong++; SFX.oops(); flashKey(k, 'bad', 450); card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
      buddyDo(pick(['silly', 'think']), 1400); bubble(pick(['\u{1F914}', '\u{1F61C}', '\u{1F643}']));
      say(pick(D.KID_OOPS).replace(/\{X\}/g, sayL(k)).replace(/\{T\}/g, sayL(target)));
      if (wrong >= 2) { var t = keyEl(target); if (t) t.classList.add('hint'); }
      armHints(round);
    }
    function free(L) {
      var now = Date.now(); if (now - lastFree < 220) return; lastFree = now;
      showCard(L, false); moment(L); reaction(); SFX.star();
      var kc = center(keyEl(L)); burst(kc.x, kc.y, ['\u2B50', '\u2728', '\u{1F308}'], 8);
      say(sayL(L) + '! ' + sayL(L) + ' is for ' + D.LETTERS[L].w + '!');
      if (Math.random() < 0.15) balloon();
    }
    function onKey(k) {
      if (modalEl) return; var L = String(k).toUpperCase(); if (!/^[A-Z]$/.test(L)) return;
      pressAnim(L);
      if (mode === 'free') return free(L);
      if (busy || !target) return;
      if (L === target) correct(); else oops(L);
    }
    function book() {
      var cells = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(function (L) {
        var got = K.stickers[L];
        return '<button class="stk' + (got ? ' got' : '') + '" data-l="' + L + '" aria-label="' + L + '">' + (got ? pic(L) : '\u2753') + '<b>' + L + L.toLowerCase() + '</b></button>';
      }).join('');
      clearTimeout(hintT); round++; busy = true;
      var m = openModal('<h2>\u{1F4D2} \u2B50 ' + stickerCount() + ' / 26</h2><div class="book">' + cells + '</div>', { onClose: function () { if (mode === 'learn') newRound(); else busy = false; } });
      say(stickerCount() ? 'Your sticker book! Tap a sticker!' : 'Your sticker book! Find letters to get stickers!');
      $$('.stk', m).forEach(function (b) {
        b.addEventListener('click', function () {
          var L = b.dataset.l;
          if (K.stickers[L]) { SFX.star(); moment(L); say(sayL(L) + '! ' + sayL(L) + ' is for ' + D.LETTERS[L].w + '!'); b.style.transform = 'scale(1.15) rotate(-6deg)'; setTimeout(function () { b.style.transform = ''; }, 300); }
          else { SFX.oops(); say('Keep exploring to find this sticker!'); }
        });
      });
    }
    $('[data-home]', s).addEventListener('click', function () { SFX.tap(); go('home'); });
    $$('.tab', s).forEach(function (b) {
      b.addEventListener('click', function () {
        SFX.tap(); var t = b.dataset.tab;
        if (t === 'book') { book(); return; }
        if (t === 'free') startFree(); else startLearn();
      });
    });
    $('#buddyWrap', s).addEventListener('pointerdown', function (e) {
      e.preventDefault(); SFX.giggle(); buddyDo(pick(['silly', 'dance', 'highfive', 'spin']), 1500); bubble('\u{1F602}');
      var r = round; say(pick(D.KID_TICKLE)).then(function () { if (alive && r === round && mode === 'learn' && !busy && target) prompt(true); });
    });
    bindTaps(kbd, onKey);
    Promise.race([say('Hi' + (K.nick ? ' ' + K.nick : '') + '! Let\u2019s find letters!'), wait(2600)]).then(function () { if (alive && mode === 'learn' && !target && !modalEl) startLearn(); });
    buddyDo('highfive', 1400);
    return { onKey: onKey, cleanup: function () { alive = false; clearTimeout(hintT); }, state: function () { return { mode: mode, target: target, busy: busy, wrong: wrong }; }, startLearn: startLearn };
  };

  /* ================= NINJA ACADEMY ================= */
  function allMissions() { var a = []; D.ZONES.forEach(function (z, zi) { z.missions.forEach(function (m) { a.push({ m: m, z: z, zi: zi, boss: false }); }); a.push({ m: z.boss, z: z, zi: zi, boss: true }); }); return a; }
  var MISSIONS = allMissions();
  function mStars(id) { var r = S.ninja.m[id]; return r ? r.stars || 0 : 0; }
  function mIndex(id) { for (var i = 0; i < MISSIONS.length; i++) if (MISSIONS[i].m.id === id) return i; return -1; }
  function unlocked(i) { return i === 0 || mStars(MISSIONS[i - 1].m.id) >= 1; }
  function nextMissionIdx() { for (var i = 0; i < MISSIONS.length; i++) if (!mStars(MISSIONS[i].m.id)) return unlocked(i) ? i : -1; return MISSIONS.length - 1; }
  // keys taught up to and including mission i
  function keysFor(i) {
    var have = ' ';
    for (var j = 0; j <= i; j++) { var it = MISSIONS[j]; have += it.boss ? it.z.newKeys : it.m.keys; }
    for (var z = 0; z < MISSIONS[i].zi; z++) have += D.ZONES[z].newKeys;
    MISSIONS[i].m.lines.forEach(function (l) { have += l; });
    return Array.from(new Set(have.split(''))).join('');
  }
  function unlockedKeys() {
    var have = 'asdfjkl;';
    MISSIONS.forEach(function (it, i) { if (mStars(it.m.id) >= 1) have += keysFor(i); });
    return Array.from(new Set(have.replace(/ /g, '').split(''))).join('');
  }
  function award(id) {
    if (S.ninja.badges[id]) return false;
    S.ninja.badges[id] = Date.now(); var b = D.BADGES.filter(function (x) { return x.id === id; })[0];
    setTimeout(function () { toast(b.icon + ' Badge unlocked: ' + b.name + '!', 2600); SFX.star(); }, 400);
    return true;
  }
  function addXP(n) {
    var before = beltIndex(S.ninja.xp); S.ninja.xp += Math.max(0, Math.round(n)); var after = beltIndex(S.ninja.xp);
    if (after > before) setTimeout(function () { SFX.levelup(); confetti(); toast('\u{1F94B} Rank up! You earned your ' + D.BELTS[after].n + '!', 3500); }, 1200);
  }
  function touchDay() {
    var d = S.ninja.days, t = todayStr(), y = new Date(); y.setDate(y.getDate() - 1);
    if (d.last === t) return; d.count = d.last === todayStr(y) ? d.count + 1 : 1; d.last = t;
    if (d.count >= 3) award('streak3');
  }
  function touchOnly() { return !!(window.matchMedia && matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches); }

  SCREENS.ninja = function () {
    var N = S.ninja, bi = beltIndex(N.xp), belt = D.BELTS[bi], nxt = D.BELTS[bi + 1];
    var pct = nxt ? Math.round((N.xp - belt.xp) / (nxt.xp - belt.xp) * 100) : 100;
    var s = h('div', 'screen nj-bg'); s.id = 'ninja';
    var badgeN = Object.keys(N.badges).length, ni = nextMissionIdx();
    var html = '<div class="nj-head"><button class="round-btn" data-home aria-label="Home">\u{1F3E0}</button>' +
      '<div class="nj-av" style="--pc:' + N.color + '">' + N.avatar + '</div>' +
      '<div class="nj-id"><div class="who">' + esc(N.nick || 'Ninja') + ' <span class="belt" style="--bc:' + belt.c + '"><i></i>' + belt.n + '</span></div>' +
      '<div class="xpbar"><b style="width:' + pct + '%"></b><span>' + N.xp + ' XP' + (nxt ? ' \u00B7 ' + (nxt.xp - N.xp) + ' to ' + nxt.n : ' \u00B7 MAX RANK') + '</span></div></div>' +
      '<div class="nj-stats"><div class="stat"><b>' + Math.round(N.pb) + '</b>Best WPM</div><div class="stat"><b>' + N.bestCombo + '</b>Best combo</div>' +
      '<div class="stat"><b>\u{1F525}' + (N.days.count || 0) + '</b>Day streak</div><div class="stat"><b>' + badgeN + '</b>Badges</div></div></div>';
    if (touchOnly() && !N.kbSeen) html += '<div class="kbnote">\u2328\uFE0F A real keyboard is best for finger training. An iPad with a Bluetooth or Smart Keyboard works great. (Tapping the keys works too.)</div>';
    html += '<div class="nj-body"><div class="nj-actions">' +
      (ni >= 0 ? '<button class="nj-btn hot" data-play="' + ni + '">\u25B6 ' + (mStars(MISSIONS[ni].m.id) ? 'Replay' : (MISSIONS[ni].boss ? 'Boss battle' : 'Next mission')) + ': ' + esc(MISSIONS[ni].m.name) + '</button>' : '') +
      '<button class="nj-btn" data-arcade>\u2604\uFE0F Meteor Strike <small>(best ' + N.arcadeHi + ')</small></button>' +
      '<button class="nj-btn" data-badges>\u{1F3C5} Badges ' + badgeN + '/' + D.BADGES.length + '</button>' +
      '<button class="nj-btn" data-howto>\u{1F446} Home row &amp; bumps</button></div>';
    D.ZONES.forEach(function (z, zi) {
      var first = mIndex(z.missions[0].id), zl = !unlocked(first);
      html += '<div class="zone' + (zl ? ' locked' : '') + '" style="--zc:' + z.color + '"><h3>' + z.icon + ' Zone ' + (zi + 1) + ': ' + z.name +
        (z.newKeys.trim() ? ' <span class="zk">+ ' + esc(z.newKeys.trim().toUpperCase().split('').join(' ')) + '</span>' : '') + (zl ? ' \u{1F512}' : '') + '</h3><div class="mrow">';
      z.missions.concat([z.boss]).forEach(function (m) {
        var i = mIndex(m.id), st = mStars(m.id), ul = unlocked(i), isB = m === z.boss;
        var stars = [1, 2, 3].map(function (n) { return '<span class="' + (st >= n ? '' : 'dimst') + '">\u2B50</span>'; }).join('');
        html += '<button class="mbtn' + (isB ? ' boss' : '') + (ul ? '' : ' locked') + (i === ni ? ' next' : '') + '" data-m="' + i + '"' + (ul ? '' : ' aria-disabled="true"') + '>' +
          (isB ? '<span class="bi">' + m.icon + '</span>' : '<span class="n">Mission ' + (z.missions.indexOf(m) + 1) + '</span>') +
          '<span>' + (ul ? '' : '\u{1F512} ') + esc(isB ? 'BOSS: ' + m.name : m.name) + '</span><span class="st">' + stars + '</span></button>';
      });
      html += '</div></div>';
    });
    html += '</div>';
    s.innerHTML = html; app.appendChild(s);
    $('[data-home]', s).addEventListener('click', function () { SFX.tap(); go('home'); });
    $$('[data-m]', s).forEach(function (b) { b.addEventListener('click', function () { var i = +b.dataset.m; if (!unlocked(i)) { SFX.err(); toast('\u{1F512} Earn a star on the mission before this to unlock it'); return; } SFX.tap(); startMission(i); }); });
    var pb = $('[data-play]', s); if (pb) pb.addEventListener('click', function () { SFX.tap(); startMission(+pb.dataset.play); });
    $('[data-arcade]', s).addEventListener('click', function () { SFX.tap(); go('arcade'); });
    $('[data-badges]', s).addEventListener('click', function () { SFX.tap(); badges(); });
    $('[data-howto]', s).addEventListener('click', function () { SFX.tap(); bumpIntro(null); });
    return { onKey: function (k) { if (k === ' ' && !modalEl && ni >= 0) startMission(ni); }, onEsc: function () { go('home'); } };
  };
  function startMission(i) {
    if (i === 0 && !S.ninja.introSeen) { bumpIntro(function () { go('lesson', i); }); return; }
    go('lesson', i);
  }
  function bumpIntro(then) {
    openModal('<h2>\u{1F446} Find the bumps</h2>' +
      '<div class="bumpdemo"><div class="key">F</div><div class="key">J</div></div>' +
      '<p class="note" style="font-size:18px;color:#dde">Feel the little bumps on <b>F</b> and <b>J</b>? Your <b>pointer fingers</b> live there, so you can find home without looking.</p>' +
      '<p class="note" style="font-size:18px;color:#dde">Left hand: <b>A S D F</b>. Right hand: <b>J K L ;</b>. Thumbs rest on <b>space</b>.<br>Every key has its own finger. Reach, tap, then come back home.</p>' +
      '<p class="note" style="font-size:18px;color:#ffd43b">\u{1F440} Ninja rule: eyes on the screen, not your hands.</p>' +
      '<button class="big-btn gold" data-ok>' + (then ? 'I\u2019m ready \u25B6' : 'Got it') + '</button>', { dark: true, onEnter: ok });
    function ok() { S.ninja.introSeen = true; save(); closeModal(); if (then) then(); }
    $('[data-ok]', modalEl).addEventListener('click', ok);
  }
  function badges() {
    var g = D.BADGES.map(function (b) { var got = S.ninja.badges[b.id]; return '<div class="badge' + (got ? '' : ' no') + '"><span class="bi">' + b.icon + '</span>' + b.name + '<small>' + b.desc + '</small></div>'; }).join('');
    openModal('<h2>\u{1F3C5} Badges</h2><div class="badge-grid">' + g + '</div>', { dark: true });
  }
  function handsSVG() {
    var f = { lp: [40, 46, 34, 70], lr: [80, 24, 36, 92], lm: [122, 12, 36, 104], li: [164, 26, 36, 90] };
    var col = { p: 'var(--fp)', r: 'var(--fr)', m: 'var(--fm)', i: 'var(--fi)' };
    var out = '<svg class="hands" viewBox="0 0 560 140" aria-hidden="true">';
    Object.keys(f).forEach(function (k) {
      var a = f[k], t = k[1];
      out += '<rect class="fg" data-f="' + k + '" x="' + a[0] + '" y="' + a[1] + '" width="' + a[2] + '" height="' + a[3] + '" rx="17" fill="' + col[t] + '"/>';
      out += '<rect class="fg" data-f="r' + t + '" x="' + (560 - a[0] - a[2]) + '" y="' + a[1] + '" width="' + a[2] + '" height="' + a[3] + '" rx="17" fill="' + col[t] + '"/>';
    });
    out += '<g class="fg" data-f="th"><rect x="206" y="78" width="34" height="62" rx="17" fill="var(--ft)" transform="rotate(-38 223 109)"/><rect x="320" y="78" width="34" height="62" rx="17" fill="var(--ft)" transform="rotate(38 337 109)"/></g>';
    out += '<rect class="palm" x="38" y="84" width="166" height="56" rx="26"/><rect class="palm" x="356" y="84" width="166" height="56" rx="26"/>';
    out += '<text x="121" y="128" text-anchor="middle" font-size="16" font-weight="800" fill="#1b1e3c">LEFT</text><text x="439" y="128" text-anchor="middle" font-size="16" font-weight="800" fill="#1b1e3c">RIGHT</text>';
    return out + '</svg>';
  }

  /* ----- lesson / boss battle ----- */
  SCREENS.lesson = function (i) {
    var it = MISSIONS[i], M = it.m, Z = it.z, boss = it.boss, allowed = keysFor(i);
    var total = M.lines.join('').length;
    var L = { li: 0, ci: 0, correct: 0, errors: 0, start: 0, combo: 0, maxCombo: 0, xp: 0, errHere: false, shields: boss ? M.shields : 0,
      hpMax: total, hp: total, errRun: 0, done: false, misses: {} };
    var s = h('div', 'screen nj-bg'); s.id = 'lesson';
    s.innerHTML = '<div class="ls-top"><button class="round-btn" data-back aria-label="Back">\u2B05\uFE0F</button>' +
      '<div class="ls-title">' + (boss ? M.icon + ' BOSS: ' : '') + esc(M.name) + '<small>' + Z.icon + ' ' + esc(Z.name) + (M.keys ? ' \u00B7 New keys: ' + esc(M.keys.toUpperCase().split('').join(' ')) : '') + '</small></div>' +
      '<div class="combo"><div class="cx" id="cx">x1</div><div class="cb"><b id="cb" style="width:0"></b></div><small id="streak">streak 0</small></div>' +
      '<div class="live"><div class="stat"><b id="acc">100%</b>Accuracy</div><div class="stat"><b id="wpm">--</b>WPM</div></div></div>' +
      '<div class="ls-main">' + (boss ? '<div class="boss-bar"><div class="boss-ic" id="bossIc">' + M.icon + '</div><div class="hp"><b id="hp" style="width:100%"></b><span>' + esc(M.name) + '</span></div><div class="shields" id="shields"></div></div>' : '') +
      '<div class="coach" id="coach"></div><div class="textbox" id="tb"></div><div class="nextline" id="nl"></div></div>' +
      '<div class="tipbar" id="tip"></div>';
    var kbd = ninjaKeyboard(allowed); s.appendChild(kbd);
    s.insertAdjacentHTML('beforeend', handsSVG());
    app.appendChild(s);
    var tb = $('#tb', s), tipEl = $('#tip', s), coach = $('#coach', s), tipI = Math.floor(Math.random() * D.TIPS.length), tipT, idleT;
    function line() { return M.lines[L.li]; }
    function mult() { return L.combo >= 50 ? 4 : L.combo >= 25 ? 3 : L.combo >= 10 ? 2 : 1; }
    function renderLine() {
      var ln = line(), out = '', word = '';
      for (var c = 0; c < ln.length; c++) {
        var ch = ln[c], cls = 'c' + (c < L.ci ? ' done' : c === L.ci ? ' cur' : ' todo') + (ch === ' ' ? ' sp' : '') + (L.misses[L.li + ':' + c] && c < L.ci ? ' miss' : '');
        var span = '<span class="' + cls + '" data-i="' + c + '">' + (ch === ' ' ? ' ' : esc(ch)) + '</span>';
        if (ch === ' ') { out += (word ? '<span style="white-space:nowrap">' + word + '</span>' : '') + span; word = ''; } else word += span;
      }
      if (word) out += '<span style="white-space:nowrap">' + word + '</span>';
      tb.innerHTML = out;
      $('#nl', s).textContent = M.lines[L.li + 1] ? 'next: ' + M.lines[L.li + 1] : (boss ? 'final strike!' : 'last line!');
      highlight();
    }
    function highlight() {
      $$('.key.glow', kbd).forEach(function (k) { k.classList.remove('glow'); });
      $$('.hands .fg', s).forEach(function (f) { f.classList.remove('on'); });
      if (L.done) return;
      var ch = line()[L.ci], fing = D.FINGER[ch], k = keyEl(ch); if (k) k.classList.add('glow');
      $$('.hands .fg', s).forEach(function (f) { if (f.getAttribute('data-f') === fing) f.classList.add('on'); });
      var colVar = { p: '--fp', r: '--fr', m: '--fm', i: '--fi', h: '--ft' }[fing[1]];
      if (!L.errHere) coach.innerHTML = '<span class="fdot" style="--fc:var(' + colVar + ')"></span>' + D.FINGER_NAME[fing] + ' \u2192 ' + (ch === ' ' ? 'SPACE' : esc(ch.toUpperCase()));
    }
    function stats() {
      var tot = L.correct + L.errors, acc = tot ? L.correct / tot * 100 : 100;
      var mins = L.start ? (Date.now() - L.start) / 60000 : 0, wpm = mins > 0.02 ? (L.correct / 5) / mins : 0;
      return { acc: acc, wpm: wpm };
    }
    function hud() {
      var st = stats(); $('#acc', s).textContent = Math.floor(st.acc) + '%'; $('#wpm', s).textContent = L.start && Date.now() - L.start > 3000 ? Math.round(st.wpm) : '--';
      var m = mult(), cx = $('#cx', s); if (cx.textContent !== 'x' + m) { cx.textContent = 'x' + m; cx.classList.add('bump'); setTimeout(function () { cx.classList.remove('bump'); }, 160); }
      var lo = [0, 10, 25, 50][m - 1], hi = [10, 25, 50, 100][m - 1];
      $('#cb', s).style.width = Math.min(100, (L.combo - lo) / (hi - lo) * 100) + '%';
      $('#streak', s).textContent = 'streak ' + L.combo;
      if (boss) { $('#hp', s).style.width = (L.hp / L.hpMax * 100) + '%'; var sh = ''; for (var q = 0; q < M.shields; q++) sh += q < L.shields ? '\u{1F6E1}\uFE0F' : '\u{1F494}'; $('#shields', s).textContent = sh; }
    }
    function nextTip() { tipEl.style.opacity = 0; setTimeout(function () { tipEl.textContent = D.TIPS[tipI++ % D.TIPS.length]; tipEl.style.opacity = 1; }, 350); }
    function armIdle() { clearTimeout(idleT); idleT = setTimeout(function () { if (!L.done && L.start) tipEl.textContent = '\u{1F440} Eyes up! Find it by feel. The glowing finger knows the way.'; }, 6000); }
    function floatTxt(t) { var c = center($('.c.cur', tb) || tb); var f = h('div', 'floatxp', t); f.style.left = c.x + 'px'; f.style.top = (c.y - 30) + 'px'; fx.appendChild(f); setTimeout(function () { f.remove(); }, 800); }
    function onKey(k) {
      if (modalEl || L.done || !k || k.length !== 1) return;
      k = k.toLowerCase(); if (D.FINGER[k] === undefined) return;
      pressAnim(k);
      if (!L.start) L.start = Date.now();
      armIdle();
      var exp = line()[L.ci];
      if (k === exp) {
        L.correct++; L.combo++; L.maxCombo = Math.max(L.maxCombo, L.combo); L.errHere = false; L.errRun = 0;
        L.xp += mult(); SFX.key(L.combo);
        if (L.combo % 10 === 0) { floatTxt('combo ' + L.combo + '!'); SFX.star(); }
        if (boss) { L.hp--; var bi = $('#bossIc', s); bi.classList.remove('hit', 'laugh'); void bi.offsetWidth; bi.classList.add('hit'); SFX.hit(); }
        L.ci++;
        if (L.ci >= line().length) {
          L.li++; L.ci = 0; SFX.line();
          if (L.li >= M.lines.length) { hud(); return finish(true); }
        }
        renderLine(); hud();
      } else {
        L.errors++; L.combo = 0; L.errRun++; L.errHere = true; L.misses[L.li + ':' + L.ci] = 1; SFX.err();
        var cs = $('.c.cur', tb); if (cs) { cs.classList.add('err'); setTimeout(function () { cs.classList.remove('err'); }, 300); }
        flashKey(k, 'bad', 350);
        coach.innerHTML = '\u270B Use your <b style="color:#ffd43b">&nbsp;' + D.FINGER_NAME[D.FINGER[exp]].toLowerCase() + '&nbsp;</b> for ' + (exp === ' ' ? 'SPACE' : esc(exp.toUpperCase()));
        if (L.errRun >= 3) tipEl.textContent = '\u{1F422} Slow down, ninja. Accuracy first, speed later.';
        if (boss) {
          L.shields--; var b2 = $('#bossIc', s); b2.classList.remove('hit', 'laugh'); void b2.offsetWidth; b2.classList.add('laugh');
          if (L.shields <= 0) { hud(); return finish(false); }
        }
        hud();
      }
    }
    function finish(won) {
      L.done = true; clearTimeout(idleT); clearInterval(tipT); highlight();
      var st = stats(), acc = Math.round(st.acc * 10) / 10, wpm = Math.round(st.wpm);
      var stars = !won ? 0 : acc >= 98 ? 3 : acc >= 93 ? 2 : acc >= 85 ? 1 : 0;
      if (boss && won && acc < 90) stars = 0;
      var N = S.ninja, rec = N.m[M.id] || { stars: 0, acc: 0, wpm: 0, plays: 0 }, old = rec.stars;
      rec.plays++; rec.stars = Math.max(rec.stars, stars); rec.acc = Math.max(rec.acc, acc); if (stars) rec.wpm = Math.max(rec.wpm, wpm); N.m[M.id] = rec;
      var gain = L.xp + stars * 15 + Math.max(0, stars - old) * 25 + (boss && stars && !old ? 100 : 0);
      var newPB = stars >= 1 && wpm > N.pb && L.correct >= 20; if (newPB) N.pb = wpm;
      N.bestCombo = Math.max(N.bestCombo, L.maxCombo);
      if (stars) { award('first'); if (M.id === 'z1m1') award('bumps'); }
      if (stars && L.errors === 0) award('perfect');
      if (L.maxCombo >= 25) award('combo25'); if (L.maxCombo >= 50) award('combo50'); if (L.maxCombo >= 100) award('combo100');
      if (stars) { if (wpm >= 15) award('wpm15'); if (wpm >= 25) award('wpm25'); if (wpm >= 35) award('wpm35'); }
      if (boss && stars) { award('boss1'); if (D.ZONES.every(function (z) { return mStars(z.boss.id) >= 1; })) award('bossall'); }
      if (D.ZONES.some(function (z) { return z.missions.every(function (m) { return mStars(m.id) === 3; }); })) award('zone3star');
      touchDay(); addXP(gain); save();
      var title, msg;
      if (boss && !won) { title = M.icon + ' The ' + esc(M.name) + ' escaped!'; msg = 'Your shields ran out. Bosses punish rushing, so go slow and steady. You\u2019ll get it next time!'; SFX.lose(); }
      else if (!stars) { title = 'So close!'; msg = (boss ? 'Beat the boss with 90% accuracy or better.' : 'You need 85% accuracy to unlock the next mission.') + ' Slow down and use the glowing finger. Accuracy first, speed later.'; SFX.lose(); }
      else { title = boss ? M.icon + ' BOSS DEFEATED!' : 'Mission complete!'; msg = stars === 3 ? 'Flawless technique! A true ninja.' : stars === 2 ? 'Sharp work! Hit 98% accuracy for 3 stars.' : 'Passed! Hit 93% accuracy for 2 stars.'; SFX.win(); if (boss || stars === 3) confetti(); }
      var wpmMsg = wpm ? (newPB ? '\u{1F3C6} New personal best: ' + wpm + ' WPM!' : 'Speed grows by itself as your fingers learn their spots.') : '';
      var nextOK = i + 1 < MISSIONS.length && unlocked(i + 1);
      setTimeout(function () {
        if (cur !== self) return;
        var m = openModal('<h2>' + title + '</h2><div class="res-stars">' + [1, 2, 3].map(function (n) { return '<span class="' + (stars >= n ? '' : 'dimst') + '">\u2B50</span>'; }).join('') + '</div>' +
          '<div class="res-grid"><div class="stat"><b>' + Math.floor(acc) + '%</b>Accuracy</div><div class="stat"><b>' + wpm + '</b>WPM</div><div class="stat"><b>' + L.maxCombo + '</b>Best combo</div><div class="stat"><b>+' + gain + '</b>XP</div></div>' +
          '<p class="note" style="font-size:17px">' + msg + '</p>' + (wpmMsg ? '<p class="note" style="color:#ffd43b;font-size:16px">' + wpmMsg + '</p>' : '') +
          '<div><button class="big-btn gray" data-r>\u21BB Retry</button>' + (nextOK ? '<button class="big-btn gold" data-n>Next \u25B6</button>' : '') + '<button class="big-btn blue" data-h>Academy</button></div>' +
          '<p class="note">Enter = ' + (nextOK && stars ? 'next' : 'retry') + ' \u00B7 Esc = academy</p>',
          { dark: true, close: false, onEnter: function () { if (nextOK && stars) startMission(i + 1); else go('lesson', i); }, onEsc: function () { go('ninja'); } });
        m.classList.add('results');
        $('[data-r]', m).addEventListener('click', function () { go('lesson', i); });
        if (nextOK) $('[data-n]', m).addEventListener('click', function () { startMission(i + 1); });
        $('[data-h]', m).addEventListener('click', function () { go('ninja'); });
      }, 500);
    }
    $('[data-back]', s).addEventListener('click', function () { SFX.tap(); go('ninja'); });
    bindTaps(kbd, onKey);
    renderLine(); hud(); nextTip(); tipT = setInterval(nextTip, 12000);
    if (boss) { SFX.levelup(); toast(M.icon + ' Boss battle! Every mistake costs a shield.', 2600); }
    else if (M.keys) toast('New keys: ' + M.keys.toUpperCase().split('').join(' ') + '. Watch the glowing finger!', 2400);
    var self = { onKey: onKey, onEsc: function () { go('ninja'); }, cleanup: function () { clearInterval(tipT); clearTimeout(idleT); }, state: function () { return L; }, mission: M };
    return self;
  };

  /* ----- arcade: Meteor Strike ----- */
  SCREENS.arcade = function () {
    var keys = unlockedKeys().replace(/[\/]/g, '').split('');
    var s = h('div', 'screen nj-bg'); s.id = 'arcade';
    s.innerHTML = '<div class="ls-top"><button class="round-btn" data-back aria-label="Back">\u2B05\uFE0F</button><div class="ls-title">\u2604\uFE0F Meteor Strike<small>Type the letter on a meteor to blast it!</small></div></div>' +
      '<div class="ar-wrap"><canvas id="arc"></canvas><div class="ar-hud"><div class="stat"><b id="asc">0</b>Score</div><div class="stat"><b id="alv">\u2764\uFE0F\u2764\uFE0F\u2764\uFE0F</b>Shields</div><div class="stat"><b id="acb">x1</b>Combo</div><div class="stat"><b>' + S.ninja.arcadeHi + '</b>Best</div></div>' +
      '<div class="ar-over" id="aov"></div></div>';
    var kbd = ninjaKeyboard(keys.join('')); s.appendChild(kbd); app.appendChild(s);
    var cv = $('#arc', s), g = cv.getContext('2d'), W = 0, H = 0, dpr = 1, raf = 0, last = 0, font = getComputedStyle(document.body).fontFamily;
    var A = { on: false, over: false, score: 0, lives: 3, combo: 0, t: 0, spawn: 0, met: [], parts: [], beams: [], stars: [], shake: 0, blasted: 0 };
    function size() { var r = cv.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1); W = r.width; H = r.height; cv.width = Math.max(1, Math.round(W * dpr)); cv.height = Math.max(1, Math.round(H * dpr)); if (!A.on) draw(); }
    for (var i = 0; i < 70; i++) A.stars.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + 0.3 });
    window.addEventListener('resize', size);
    var ov = $('#aov', s);
    function overlay(html) {
      ov.innerHTML = html; ov.classList.remove('hidden');
      var b = $('[data-go]', ov); if (b) b.addEventListener('click', start);
      var bb = $('[data-bk]', ov); if (bb) bb.addEventListener('click', function () { go('ninja'); });
    }
    overlay('<h2>\u2604\uFE0F Meteor Strike</h2><p class="note" style="color:#dde;font-size:18px">Meteors are falling! Type each meteor\u2019s letter to blast it before it lands.<br>Keys in play: <b style="font-family:var(--mono);color:#ffd43b">' + esc(keys.join(' ').toUpperCase()) + '</b></p><p class="note">Fingers on home row. Unlock more keys in missions to add them here.</p><button class="big-btn gold" data-go>\u25B6 Launch (Space)</button>');
    function start() {
      A.on = true; A.over = false; A.score = 0; A.lives = 3; A.combo = 0; A.t = 0; A.spawn = 0.3; A.met = []; A.parts = []; A.beams = []; A.blasted = 0;
      ov.classList.add('hidden'); hud(); last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    }
    function hud() { $('#asc', s).textContent = A.score; var l = ''; for (var i = 0; i < 3; i++) l += i < A.lives ? '\u2764\uFE0F' : '\u{1F5A4}'; $('#alv', s).textContent = l; $('#acb', s).textContent = 'x' + (1 + Math.floor(A.combo / 5)); }
    function level() { return Math.min(10, A.t / 18); }
    function explode(x, y, col, n) { for (var i = 0; i < (n || 18); i++) { var a = Math.random() * 6.28, v = 60 + Math.random() * 220; A.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.7, col: col }); } }
    function loop(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (A.on) step(dt); else stepParts(dt);
      draw(); if (A.on || A.parts.length) raf = requestAnimationFrame(loop);
    }
    function stepParts(dt) {
      A.parts.forEach(function (p) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt; });
      A.parts = A.parts.filter(function (p) { return p.life > 0; });
      A.beams.forEach(function (b) { b.life -= dt; }); A.beams = A.beams.filter(function (b) { return b.life > 0; });
      A.shake = Math.max(0, A.shake - dt);
    }
    function step(dt) {
      A.t += dt; A.spawn -= dt; var lv = level();
      if (A.spawn <= 0) {
        var free = keys.filter(function (k) { return !A.met.some(function (m) { return m.ch === k; }); });
        var ch = pick(free.length ? free : keys), r = Math.max(24, Math.min(40, W / 22));
        A.met.push({ ch: ch, x: r + Math.random() * Math.max(1, W - 2 * r), y: -r, r: r, vy: H / (9 - lv * 0.5), rot: Math.random() * 6 });
        A.spawn = Math.max(0.6, 1.8 - lv * 0.13);
      }
      var ground = H - 30;
      A.met.forEach(function (m) { m.y += m.vy * dt; m.rot += dt; });
      var hit = A.met.filter(function (m) { return m.y + m.r * 0.6 >= ground; });
      if (hit.length) {
        A.met = A.met.filter(function (m) { return hit.indexOf(m) < 0; });
        hit.forEach(function (m) { explode(m.x, ground, '#ff6b6b', 26); }); A.lives -= hit.length; A.combo = 0; A.shake = 0.4; SFX.boom(); hud();
        if (A.lives <= 0) { A.lives = 0; hud(); return gameOver(); }
      }
      stepParts(dt);
    }
    function draw() {
      if (!W || !H) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      if (A.shake > 0) g.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
      g.fillStyle = '#fff'; A.stars.forEach(function (st) { g.globalAlpha = 0.4 + st.r / 3; g.beginPath(); g.arc(st.x * W, st.y * H, st.r, 0, 6.28); g.fill(); }); g.globalAlpha = 1;
      var ground = H - 30; g.fillStyle = '#2b8a3e'; g.fillRect(0, ground, W, 30); g.fillStyle = '#40c057'; g.fillRect(0, ground, W, 5);
      var sx = W / 2; g.fillStyle = '#dee2e6'; g.beginPath(); g.moveTo(sx, ground - 46); g.lineTo(sx - 22, ground - 6); g.lineTo(sx + 22, ground - 6); g.closePath(); g.fill();
      g.fillStyle = '#4dabf7'; g.beginPath(); g.arc(sx, ground - 24, 7, 0, 6.28); g.fill();
      A.beams.forEach(function (b) { g.strokeStyle = 'rgba(255,212,59,' + Math.max(0, b.life / 0.15) + ')'; g.lineWidth = 6; g.beginPath(); g.moveTo(sx, ground - 46); g.lineTo(b.x, b.y); g.stroke(); });
      A.met.forEach(function (m) {
        var gr = g.createLinearGradient(m.x, m.y - m.r * 3, m.x, m.y); gr.addColorStop(0, 'rgba(255,146,43,0)'); gr.addColorStop(1, 'rgba(255,146,43,.8)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(m.x - m.r * 0.8, m.y); g.lineTo(m.x, m.y - m.r * 3.2); g.lineTo(m.x + m.r * 0.8, m.y); g.fill();
        g.fillStyle = '#8d5524'; g.beginPath(); g.arc(m.x, m.y, m.r, 0, 6.28); g.fill();
        g.fillStyle = '#6b3e1f'; g.beginPath(); g.arc(m.x + Math.cos(m.rot) * m.r * 0.45, m.y + Math.sin(m.rot) * m.r * 0.45, m.r * 0.2, 0, 6.28); g.fill();
        g.fillStyle = '#fff'; g.font = '900 ' + Math.round(m.r * 1.15) + 'px ' + font; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(m.ch.toUpperCase(), m.x, m.y + 2);
      });
      A.parts.forEach(function (p) { g.globalAlpha = Math.max(0, p.life / 0.7); g.fillStyle = p.col; g.fillRect(p.x - 3, p.y - 3, 6, 6); }); g.globalAlpha = 1;
    }
    function gameOver() {
      A.on = false; A.over = true; SFX.lose();
      var gain = Math.floor(A.score / 10), best = A.score > S.ninja.arcadeHi; if (best) S.ninja.arcadeHi = A.score;
      if (A.score >= 500) award('arcade'); touchDay(); addXP(gain); save();
      overlay('<h2>' + (best ? '\u{1F3C6} New high score!' : 'Game over') + '</h2><div class="res-grid"><div class="stat"><b>' + A.score + '</b>Score</div><div class="stat"><b>' + S.ninja.arcadeHi + '</b>Best</div><div class="stat"><b>+' + gain + '</b>XP</div></div>' +
        '<div><button class="big-btn gold" data-go>\u21BB Play again (Space)</button><button class="big-btn blue" data-bk>Academy</button></div>');
    }
    function onKey(k) {
      if (modalEl) return; k = k.toLowerCase();
      if (!A.on) { if (k === ' ') start(); return; }
      if (k === ' ') return; pressAnim(k);
      var c = A.met.filter(function (m) { return m.ch === k; }).sort(function (a, b) { return b.y - a.y; })[0];
      if (c) {
        A.met.splice(A.met.indexOf(c), 1); A.beams.push({ x: c.x, y: c.y, life: 0.15 }); explode(c.x, c.y, '#ffd43b', 20);
        A.combo++; A.blasted++; A.score += 10 * (1 + Math.floor(A.combo / 5)); SFX.laser(); setTimeout(SFX.boom, 60); hud();
      } else { A.combo = 0; SFX.err(); flashKey(k, 'bad', 300); hud(); }
    }
    function vis() { if (document.hidden && A.on) { A.on = false; overlay('<h2>Paused</h2><div><button class="big-btn gold" data-go>\u25B6 Restart (Space)</button><button class="big-btn blue" data-bk>Academy</button></div>'); } }
    document.addEventListener('visibilitychange', vis);
    $('[data-back]', s).addEventListener('click', function () { SFX.tap(); go('ninja'); });
    bindTaps(kbd, onKey);
    requestAnimationFrame(size);
    return { onKey: onKey, onEsc: function () { go('ninja'); }, cleanup: function () { A.on = false; cancelAnimationFrame(raf); window.removeEventListener('resize', size); document.removeEventListener('visibilitychange', vis); }, state: function () { return A; }, keys: keys };
  };

  /* ================= global input ================= */
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (k === 'Escape') { if (modalEsc) modalEsc(); else if (cur && cur.onEsc) cur.onEsc(); return; }
    if (k === 'Enter') { if (modalEnter) { e.preventDefault(); modalEnter(); } return; }
    if (!k || k.length !== 1) return;
    e.preventDefault();
    if (!S.ninja.kbSeen) { S.ninja.kbSeen = true; save(); var n = $('.kbnote'); if (n) n.remove(); }
    if (e.repeat) return;
    if (cur && cur.onKey) cur.onKey(k, 'kbd');
  });
  // first touch unlocks audio on iOS
  document.addEventListener('pointerdown', function () { ac(); }, { once: true });

  var mb = document.getElementById('muteBtn');
  function muteIcon() { mb.textContent = S.muted ? '\u{1F507}' : '\u{1F50A}'; mb.setAttribute('aria-pressed', S.muted ? 'true' : 'false'); }
  mb.addEventListener('click', function () { S.muted = !S.muted; save(); muteIcon(); if (S.muted) hush(); else SFX.tap(); });
  muteIcon();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }

  // test/debug hook (local only)
  window.__tp = { state: function () { return S; }, screen: function () { return cur && cur.name; }, cur: function () { return cur; }, go: go, missions: MISSIONS, unlockedKeys: unlockedKeys, keysFor: keysFor };
  go('home');
})();
