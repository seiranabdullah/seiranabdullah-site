(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  /* analytics helper: sends custom events to Google Analytics 4 when it is set up */
  const track = (name, params = {}) => { try { if (window.gtag) window.gtag('event', name, params); } catch (e) {} };
  document.addEventListener('click', e => {
    const a = e.target.closest('a'); if (!a) return;
    const h = a.getAttribute('href') || '';
    if (h.includes('wa.me')) track('whatsapp_click', { place: a.closest('.minute') ? 'one_minute_popup' : (a.closest('#contact') ? 'contact' : 'other') });
    else if (h.includes('t.me')) track('telegram_click');
    else if (h.endsWith('.pdf')) track('cv_download');
    else if (a.id === 'quote') track('pricing_teaser_click');
    else if (/behance|youtube|linkedin|instagram|facebook/.test(h)) track('social_click', { network: (h.match(/behance|youtube|linkedin|instagram|facebook/) || [''])[0] });
  });

  /* ---------- cursor ---------- */
  const cur = $('#cursor');
  if (cur && matchMedia('(pointer:fine)').matches) {
    let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
    cur.style.opacity = 0;
    addEventListener('mousemove', e => { x = e.clientX; y = e.clientY; if (cur.style.opacity !== '1') { cx = x; cy = y; cur.style.opacity = 1; } });
    document.documentElement.addEventListener('mouseleave', () => { cur.style.opacity = 0; });
    (function loop() { cx += (x - cx) * .2; cy += (y - cy) * .2; cur.style.left = cx + 'px'; cur.style.top = cy + 'px'; requestAnimationFrame(loop); })();
    document.addEventListener('mouseover', e => {
      const t = e.target.closest('[data-cursor], a, button');
      cur.classList.remove('big', 'play'); cur.textContent = '';
      if (!t) return;
      if (t.dataset.cursor === 'play') { cur.classList.add('play'); cur.textContent = 'PLAY'; }
      else cur.classList.add('big');
    });
  }

  /* ---------- mobile menu ---------- */
  const bar = $('#bar'), nav = $('#nav'), burger = $('#burger');
  function setMenu(open) {
    if (!nav) return;
    nav.classList.toggle('open', open);
    document.body.classList.toggle('menu-open', open);
    if (burger) { burger.textContent = open ? 'CLOSE' : 'MENU'; burger.setAttribute('aria-expanded', open); }
  }
  burger && burger.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  $$('#nav a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
  addEventListener('resize', () => { if (innerWidth > 980) setMenu(false); });

  /* ---------- logo: S stays, A draws, dot blinks; reverses when scrolled away ---------- */
  const logo = $('#logo');
  let logoState = '';
  function setLogo(state) {
    if (!logo || state === logoState) return;
    logoState = state;
    logo.classList.toggle('on', state === 'on');
    logo.classList.toggle('off', state === 'off');
  }
  setTimeout(() => setLogo(scrollY < 120 ? 'on' : 'off'), 250);

  /* ---------- timecode helpers ---------- */
  const tc = $('#tc');
  function tcode(p, secs) { const f = Math.round(p * secs * 25); return tcf(f); }
  function tcf(f) { return `${pad(Math.floor(f / 90000))}:${pad(Math.floor(f / 1500) % 60)}:${pad(Math.floor(f / 25) % 60)}:${pad(f % 25)}`; }

  /* ---------- AUDIO (Web Audio, no files) ---------- */
  const AU = { ctx: null, on: false };
  function actx() {
    if (!AU.ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; AU.ctx = new C(); }
    if (AU.ctx.state === 'suspended' && !AU.muted) AU.ctx.resume().catch(() => {});
    return AU.ctx;
  }
  AU.muted = (() => { try { return sessionStorage.getItem('sa_mute') === '1'; } catch (e) { return false; } })();
  const sndAll = document.getElementById('sndAll');
  function paintAll() {
    const on = !AU.muted; // shown as ON from the start; audio itself starts with the first interaction
    if (sndAll) { sndAll.setAttribute('aria-pressed', on); sndAll.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on'); }
    document.dispatchEvent(new Event('sa-sound'));
  }
  function unlock() {
    if (AU.muted) return;
    const c = actx(); if (!c) return;
    if (!c._painted) { c._painted = 1; c.addEventListener('statechange', paintAll); }
    if (c.state !== 'running') c.resume().then(paintAll, () => {});
    paintAll();
  }
  ['pointerdown', 'keydown', 'touchstart', 'touchend', 'wheel', 'scroll'].forEach(ev => addEventListener(ev, unlock, { passive: true }));
  sndAll && sndAll.addEventListener('click', e => {
    e.stopPropagation();
    const c = actx();
    AU.muted = !AU.muted;
    try { sessionStorage.setItem('sa_mute', AU.muted ? '1' : '0'); } catch (e) {}
    if (c) (AU.muted ? c.suspend() : c.resume()).then(paintAll, paintAll);
    paintAll();
  });
  paintAll();
  function noise(c, dur) { const b = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = b; return s; }
  function env(c, g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function live() { const c = AU.ctx; return c && c.state === 'running' && !AU.muted ? c : null; }
  function tone(type, f0, f1, at, a, d, vol = .18) {
    const c = live(); if (!c) return; const t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + a + d);
    env(c, g, t, a, vol, d); o.connect(g).connect(c.destination); o.start(t); o.stop(t + a + d + .05);
  }
  function hiss(at, dur, ftype, f0, f1, vol = .2, q = 1) {
    const c = live(); if (!c) return; const t = c.currentTime + at;
    const n = noise(c, dur + .05), f = c.createBiquadFilter(), g = c.createGain(); f.type = ftype; f.Q.value = q; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(c, g, t, dur * .35, vol, dur * .65); n.connect(f).connect(g).connect(c.destination); n.start(t); n.stop(t + dur + .05);
  }
  const SFX = {
    ae: () => { hiss(0, .55, 'bandpass', 300, 3200, .28, 2); tone('sine', 220, 660, .05, .05, .4, .06); },
    pr: () => { hiss(0, .04, 'highpass', 4000, 0, .35); hiss(.09, .04, 'highpass', 3000, 0, .3); tone('square', 180, 90, .1, .005, .12, .04); },
    dv: () => { [261.6, 329.6, 392, 523.3].forEach((f, i) => tone('sine', f, 0, i * .02, .25, 1.1, .05)); },
    ps: () => { hiss(0, .45, 'bandpass', 1800, 900, .22, 4); },
    ai: () => { tone('sine', 1100, 380, 0, .005, .12, .14); tone('sine', 1400, 500, .14, .005, .1, .1); },
    gen: () => { [1760, 2349, 2794].forEach((f, i) => tone('sine', f, 0, i * .05, .002, .06, .05)); },
    lr: () => { hiss(0, .03, 'highpass', 2500, 0, .4); hiss(.07, .05, 'bandpass', 1200, 0, .35, 1.5); },
    au: () => { [440, 554, 659, 880].forEach((f, i) => tone('triangle', f, 0, i * .09, .01, .22, .1)); },
    tick: () => tone('square', 1000, 0, 0, .002, .07, .06),
    ding: () => { tone('sine', 880, 0, 0, .01, 1.2, .14); tone('sine', 1320, 0, .02, .01, 1, .07); }
  };
  function sfx(k) { if (live()) try { SFX[k](); } catch (e) {} }

  /* ---------- APPROVED SOUND SET (sound board: story 01-03, hover 04A, counter 05A, studio 06-12) ---------- */
  let sbBus = null;
  function sb(name) {
    const c = live(); if (!c) return;
    if (!sbBus) { const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; sbBus = c.createGain(); sbBus.gain.value = .8; sbBus.connect(comp).connect(c.destination); }
    const out = sbBus, T = () => c.currentTime + .02;
    const noiseBuf = d => { const b = c.createBuffer(1, Math.ceil(c.sampleRate * d), c.sampleRate), x = b.getChannelData(0); for (let i = 0; i < x.length; i++) x[i] = Math.random() * 2 - 1; return b; };
    const env2 = (g, t, a, peak, d, hold = 0) => { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); if (hold) g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(.0001, t + a + hold + d); };
    const osc = (type, f, t, a, peak, d, o2 = {}) => {
      const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
      if (o2.to) o.frequency.exponentialRampToValueAtTime(o2.to, t + (o2.glide || a + d));
      env2(g, t, a, peak, d); let node = g;
      if (o2.lp) { const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = o2.lp; g.connect(f2); node = f2; }
      o.connect(g); node.connect(o2.dest || out); o.start(t); o.stop(t + a + d + .1);
    };
    const nz = (t, dur, type, f0, f1, peak, a, q = 1, dest) => {
      const n = c.createBufferSource(); n.buffer = noiseBuf(dur + .1);
      const f = c.createBiquadFilter(), g = c.createGain(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      env2(g, t, a, peak, Math.max(.01, dur - a)); n.connect(f).connect(g).connect(dest || out); n.start(t); n.stop(t + dur + .1);
    };
    const verb = (time = 1.6, wet = .3) => {
      const cv = c.createConvolver(), len = Math.ceil(c.sampleRate * time), b = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      cv.buffer = b; const w = c.createGain(); w.gain.value = wet; cv.connect(w).connect(out); return cv;
    };
    const bell = (f, t, peak, d, dest) => { osc('sine', f, t, .008, peak, d, { dest }); osc('sine', f * 2.76, t, .004, peak * .12, d * .35, { dest }); osc('sine', f * 5.4, t, .002, peak * .04, d * .15, { dest }); };
    const wood = (f, t, peak) => { osc('sine', f, t, .002, peak, .09, { to: f * .82, glide: .08 }); osc('triangle', f * 2.4, t, .001, peak * .25, .03); nz(t, .02, 'bandpass', 2500, 0, peak * .3, .001, 2); };
    const S = {
      storyEdit() { const t = T(), r = verb(1.2, .25);
        wood(520, t, .22); wood(390, t + .14, .14);
        const n = c.createBufferSource(); n.buffer = noiseBuf(1.2); const f = c.createBiquadFilter(), g = c.createGain(), l = c.createOscillator(), lg = c.createGain();
        f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = .9; l.frequency.value = 22; lg.gain.value = .012;
        g.gain.setValueAtTime(.0001, t + .2); g.gain.linearRampToValueAtTime(.022, t + .45); g.gain.linearRampToValueAtTime(.0001, t + 1.25);
        l.connect(lg).connect(g.gain); n.connect(f).connect(g).connect(out); g.connect(r); n.start(t + .2); n.stop(t + 1.3); l.start(t); l.stop(t + 1.3); },
      storyMotion() { const t = T(), r = verb(1.8, .35);
        nz(t, 1.0, 'bandpass', 300, 2600, .09, .45, 2.2, r); nz(t, 1.0, 'bandpass', 300, 2600, .06, .45, 2.2);
        osc('sine', 330, t, .45, .035, .55, { to: 660, glide: .9, lp: 2000 });
        bell(1318.5, t + .95, .05, 1.2, r); bell(1318.5, t + .95, .03, .8); },
      storyDesign() { const t = T(), r = verb(1.6, .3);
        for (let i = 0; i < 5; i++) nz(t + i * .11, .12, 'bandpass', 3200 + i * 180, 2400, .035, .03, 3);
        bell(1568, t + .66, .06, 1.4, r); bell(1568, t + .66, .04, .9); osc('sine', 784, t + .66, .01, .02, 1.1, { dest: r }); },
      hover() { const t = T(); osc('sine', 2400, t, .002, .035, .035); osc('sine', 4800, t, .001, .006, .02); },
      hoverSoft() { const t = T(); osc('sine', 2100, t, .003, .014, .03); },
      gen() { const t = T(), r = verb(1.8, .35);
        for (let i = 0; i < 12; i++) osc('sine', 1400 + i * 90 + Math.random() * 300, t + i * .045, .001, .012, .03);
        [523.3, 659.3, 784, 1046.5].forEach((f, i) => osc('sine', f, t + .55 + i * .03, .35, .018, 1.1, { lp: 2400, dest: r }));
        bell(2093, t + .9, .025, 1.2, r); },
      wow() { const t = T(), r = verb(2, .4);
        for (let v = 0; v < 7; v++) {
          const st = t + Math.random() * .22, f = 150 + Math.random() * 170, o = c.createOscillator(), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter(), g = c.createGain();
          o.type = 'sawtooth'; o.frequency.setValueAtTime(f * .9, st); o.frequency.linearRampToValueAtTime(f * 1.28, st + .4); o.frequency.linearRampToValueAtTime(f * .86, st + 1.4);
          f1.type = 'bandpass'; f1.Q.value = 5; f1.frequency.setValueAtTime(320, st); f1.frequency.linearRampToValueAtTime(620, st + .5);
          f2.type = 'bandpass'; f2.Q.value = 7; f2.frequency.setValueAtTime(760, st); f2.frequency.linearRampToValueAtTime(1050, st + .5);
          g.gain.setValueAtTime(.0001, st); g.gain.linearRampToValueAtTime(.012, st + .25); g.gain.setValueAtTime(.012, st + .9); g.gain.linearRampToValueAtTime(.0001, st + 1.6);
          o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(out); g.connect(r); o.start(st); o.stop(st + 1.7);
        }
        nz(t, 1.4, 'bandpass', 900, 1400, .02, .3, .8, r); },
      reel() { const t = T(); osc('sine', 1900 + Math.floor(Math.random() * 3) * 140, t, .001, .016, .025); nz(t, .012, 'highpass', 4500, 0, .01, .001); },
      ready() { const t = T(), r = verb(1, .2); bell(1046.5, t, .05, 1, r); bell(1568, t + .07, .035, 1, r); },
      ae() { const t = T(), r = verb(2.2, .4); nz(t, 1.4, 'bandpass', 900, 5200, .03, .9, 3, r); [1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(f, t + .25 + i * .16, .028, 1.6, r)); },
      pr() { const t = T(), r = verb(1, .2);
        const n = c.createBufferSource(); n.buffer = noiseBuf(.8); const f = c.createBiquadFilter(), g = c.createGain(); f.type = 'lowpass'; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(1800, t + .6);
        g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.03, t + .3); g.gain.linearRampToValueAtTime(.0001, t + .75); n.connect(f).connect(g).connect(out); n.start(t); n.stop(t + .8);
        wood(660, t + .75, .16); wood(495, t + 1.05, .12); osc('sine', 990, t + 1.05, .01, .02, .8, { dest: r }); },
      dv() { const t = T(), r = verb(2.4, .45);
        [261.6, 329.6, 392, 493.9].forEach((f, i) => { osc('sine', f, t + i * .06, .5, .03, 1.4, { lp: 1600, dest: r }); osc('triangle', f, t + i * .06, .5, .012, 1.2, { lp: 1200 }); });
        bell(987.8, t + .5, .025, 1.6, r); },
      ps() { const t = T(), r = verb(1.6, .3); nz(t, .55, 'bandpass', 1500, 3600, .05, .2, 2.5); bell(2093, t + .5, .03, 1.2, r); bell(2637, t + .62, .02, 1, r); },
      ai() { const t = T(), r = verb(1.4, .3);
        [0, .32, .64].forEach((d, i) => { osc('sine', 1500 - i * 120, t + d, .002, .045, .06); nz(t + d, .015, 'highpass', 5000, 0, .015, .001); });
        osc('sine', 660, t + .05, .3, .018, .5, { to: 990, glide: .65, dest: r }); bell(1320, t + .95, .035, 1.1, r); },
      lr() { const t = T(), r = verb(1.8, .35);
        nz(t, .03, 'highpass', 2500, 0, .09, .001); nz(t + .07, .05, 'bandpass', 1200, 0, .07, .002, 1.5);
        [392, 493.9, 587.3].forEach(f => osc('sine', f, t + .2, .55, .02, 1.1, { lp: 1800, dest: r })); },
      au() { const t = T(), r = verb(1.8, .35);
        const o = c.createOscillator(), n = c.createBufferSource(), mix = c.createGain(), f1 = c.createBiquadFilter(), f2 = c.createBiquadFilter(), g = c.createGain(), trem = c.createOscillator(), tg = c.createGain(), ng = c.createGain();
        o.type = 'sawtooth'; o.frequency.value = 220; n.buffer = noiseBuf(1.8); ng.gain.value = .25;
        f1.type = 'bandpass'; f1.frequency.value = 800; f1.Q.value = 6; f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 8;
        o.connect(mix); n.connect(ng).connect(mix); mix.connect(f1); mix.connect(f2); f1.connect(g); f2.connect(g);
        g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.05, t + .5); g.gain.linearRampToValueAtTime(.0001, t + 1.7);
        trem.frequency.value = 6; tg.gain.value = .012; trem.connect(tg).connect(g.gain);
        g.connect(out); g.connect(r); o.start(t); n.start(t); trem.start(t); o.stop(t + 1.8); n.stop(t + 1.8); trem.stop(t + 1.8); }
    };
    try { S[name] && S[name](); } catch (e) {}
  }

  /* ---------- TIME ON THIS PAGE (restarts on every page load) ---------- */
  const store = { get(k) { try { return sessionStorage.getItem(k); } catch { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch {} } };
  const t0 = Date.now();
  let minuteShown = store.get('sa_min') === '1';
  function tickTimer() {
    const ms = Date.now() - t0;
    if (tc) tc.textContent = tcf(Math.floor(ms / 40));
    if (!minuteShown && ms >= 60000) { minuteShown = true; store.set('sa_min', '1'); track('one_minute_popup', { page: location.pathname }); oneMinute(); }
  }
  setInterval(tickTimer, 40); tickTimer();

  /* ---------- confetti in brand colours ---------- */
  function confetti() {
    if (reduce) return;
    const cv = document.createElement('canvas'), x = cv.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1);
    cv.className = 'confetti'; document.body.appendChild(cv);
    const W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
    const cols = ['#e04a22', '#111111', '#f1ede6', '#ffb38a', '#c43e1a', '#ffffff'];
    const P = Array.from({ length: 170 }, () => ({ x: W * (.15 + Math.random() * .7), y: -20 * dpr - Math.random() * H * .5, w: (6 + Math.random() * 8) * dpr, h: (8 + Math.random() * 12) * dpr,
      vx: (Math.random() - .5) * 4 * dpr, vy: (2 + Math.random() * 4) * dpr, r: Math.random() * 6.3, vr: (Math.random() - .5) * .3, c: cols[Math.floor(Math.random() * cols.length)], s: Math.random() < .25 }));
    const t0 = performance.now();
    (function draw(t) {
      const k = (t - t0) / 1000; x.clearRect(0, 0, W, H);
      P.forEach(p => { p.vy += .06 * dpr; p.vx *= .995; p.x += p.vx + Math.sin(k * 3 + p.r) * .6 * dpr; p.y += p.vy; p.r += p.vr;
        x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.globalAlpha = Math.max(0, Math.min(1, 4.2 - k)); x.fillStyle = p.c;
        if (p.s) { x.beginPath(); x.arc(0, 0, p.w * .45, 0, 6.3); x.fill(); } else x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r)));
        x.restore(); });
      if (k < 4.3) requestAnimationFrame(draw); else cv.remove();
    })(t0);
  }

  /* ---------- THE ONE-MINUTE MOMENT ---------- */
  function projector(dur) { // soft film-projector flutter under the countdown
    const c = live(); if (!c) return;
    const t = c.currentTime, n = noise(c, dur), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = .8;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.05, t + .3); g.gain.setValueAtTime(.05, t + dur - .3); g.gain.linearRampToValueAtTime(0, t + dur);
    lfo.frequency.value = 18; lg.gain.value = .025; lfo.connect(lg).connect(g.gain);
    n.connect(f).connect(g).connect(c.destination); n.start(t); n.stop(t + dur); lfo.start(t); lfo.stop(t + dur);
  }
  function countBeep(last) { tone('sine', last ? 1046.5 : 659.3, 0, 0, .01, .35, .09); tone('sine', last ? 523.3 : 329.6, 0, 0, .01, .4, .05); }
  function happyChime() { [523.3, 659.3, 784, 1046.5, 1318.5].forEach((f, i) => { tone('sine', f, 0, i * .09, .01, 1.1 - i * .1, .07); tone('triangle', f * 2, 0, i * .09, .005, .3, .015); }); }
  function oneMinute() {
    actx();
    const pill = $('#tcPill'); pill && pill.classList.add('hit');
    const ov = document.createElement('div');
    ov.className = 'minute'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'One minute on the site');
    ov.innerHTML = `<div class="leader"><div class="sweep" id="sweep"></div><div class="ring"></div><div class="ring r2"></div><i class="ch h"></i><i class="ch v"></i><span class="n" id="ldn">3</span><span class="lb">00:00:59 · ONE MINUTE ON THIS PAGE</span></div>`;
    const flash = document.createElement('div'); flash.className = 'flash';
    document.body.append(ov, flash); document.body.classList.add('menu-open');
    requestAnimationFrame(() => ov.classList.add('show'));
    const sweep = $('#sweep', ov), ldn = $('#ldn', ov);
    let n = 3, start = performance.now();
    projector(2.6); countBeep(false);
    function frame(t) {
      const k = (t - start) / 850;
      if (k >= 1) { n--; start = t; if (n > 0) { ldn.textContent = n; countBeep(n === 1); } }
      if (n <= 0) return reveal();
      sweep.style.background = `conic-gradient(rgba(224,74,34,.6) ${Math.min(1, k) * 360}deg, transparent 0)`;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    function reveal() {
      flash.classList.add('go'); happyChime(); sb('wow'); confetti();
      const msg = encodeURIComponent("Hi Seiran! I stayed a whole minute on your website. Let's talk about a project.");
      ov.innerHTML = `<div class="mcard crop" id="mcard"><span class="cm"></span>
        <button class="x" aria-label="Close">×</button>
        <div class="tcx mono">00:01:00 · YOU'RE STILL HERE</div>
        <div class="congrats">Congratulations!</div>
        <h2>Most people leave<br>in <em>15 sec.</em><br><span class="nw">You stayed <span class="o">60.</span></span></h2>
        <p>Studies show more than half of visitors leave a web page in under 15 seconds. You stayed a full minute. That's the power of good design, and I can do the same for your brand.</p>
        <div class="acts">
          <a class="btn hot" href="https://wa.me/37126350603?text=${msg}" target="_blank" rel="noopener">Write me on WhatsApp →</a>
          <button class="btn" type="button" data-open-form>Email me</button>
          <button class="later-btn">Keep exploring</button>
        </div>
        <span class="src mono">Source: Chartbeat, 2 billion page visits</span></div>`;
      requestAnimationFrame(() => $('#mcard', ov).classList.add('show'));
      const close = () => { ov.classList.remove('show'); document.body.classList.remove('menu-open'); setTimeout(() => { ov.remove(); flash.remove(); }, 450); pill && pill.classList.remove('hit'); removeEventListener('keydown', esc); };
      const esc = e => { if (e.key === 'Escape' && !document.querySelector('.cform.show')) close(); };
      addEventListener('keydown', esc);
      $('.x', ov).addEventListener('click', close); $('.later-btn', ov).addEventListener('click', close);
      $('[data-open-form]', ov).addEventListener('click', () => { close(); setTimeout(openForm, 300); });
      ov.addEventListener('click', e => { if (e.target === ov) close(); });
      $('.btn.hot', ov).focus();
    }
  }

  /* ---------- CONTACT FORM (modal) ---------- */
  const SAMPLE = "Hi Seiran,\n\nI'm reaching out from [company]. We're looking for help with [video editing / motion design / graphic design] for [project].\n\nOur timeline is [date] and the budget is around [€].\nCould we have a short call this week?\n\nBest regards,";
  function openForm() {
    actx();
    const wrap = document.createElement('div');
    wrap.className = 'cform'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-labelledby', 'cfT');
    wrap.innerHTML = `<form class="cf-card crop" novalidate><span class="cm"></span>
      <button class="x" type="button" aria-label="Close">×</button>
      <div class="tcx mono">NEW MESSAGE · seiranabdullah@gmail.com</div>
      <h2 id="cfT">Let's make<br><span class="o">something</span> <em>move.</em></h2>
      <div class="cf-row">
        <label><span class="mono">Your name</span><input name="name" type="text" autocomplete="name" required placeholder="Jane Doe"></label>
        <label><span class="mono">Your email</span><input name="email" type="email" autocomplete="email" required placeholder="jane@company.com"></label>
      </div>
      <label><span class="mono">Message</span><textarea name="message" rows="7" required></textarea></label>
      <input type="text" name="_honey" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">
      <p class="cf-legal">By sending, you agree that I use your name and email only to reply to you. See the <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.</p>
      <div class="cf-foot"><span class="cf-st mono" role="status"></span><button class="btn hot" type="submit">Send message →</button></div>
    </form>`;
    document.body.append(wrap); document.body.classList.add('menu-open');
    const form = $('form', wrap), st = $('.cf-st', wrap);
    form.message.value = SAMPLE;
    requestAnimationFrame(() => wrap.classList.add('show'));
    setTimeout(() => form.name.focus(), 350);
    const close = () => { wrap.classList.remove('show'); document.body.classList.remove('menu-open'); setTimeout(() => wrap.remove(), 400); removeEventListener('keydown', esc); };
    const esc = e => { if (e.key === 'Escape') close(); };
    addEventListener('keydown', esc);
    $('.x', wrap).addEventListener('click', close);
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const name = form.name.value.trim(), email = form.email.value.trim(), message = form.message.value.trim();
      if (!name) { st.textContent = 'Please write your name.'; form.name.focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { st.textContent = 'Please check your email address.'; form.email.focus(); return; }
      if (!message) { st.textContent = 'Please write a message.'; form.message.focus(); return; }
      if (form._honey.value) return;
      const btn = $('button[type=submit]', form); btn.disabled = true; st.textContent = 'Sending…';
      try {
        const r = await fetch('https://formsubmit.co/ajax/seiranabdullah@gmail.com', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ name, email, message, _replyto: email, _subject: `New project enquiry from ${name} (seiranabdullah.me)`, _template: 'table' })
        });
        if (!r.ok) throw new Error('send failed');
        form.innerHTML = `<span class="cm"></span><div class="cf-done"><div class="tcx mono">00:00:00:00 · DELIVERED</div><h2>Thank you, <em>${name.replace(/[<>&"]/g, '')}.</em></h2><p>Your message is on its way. I usually reply within 24 hours.</p><button class="btn ink" type="button">Close</button></div>`;
        $('.btn', form).addEventListener('click', close); happyChime(); track('form_submit');
      } catch {
        st.innerHTML = 'Could not send from here. <a href="mailto:seiranabdullah@gmail.com?subject=' + encodeURIComponent('Project enquiry from ' + name) + '&body=' + encodeURIComponent(message + '\n\n' + name + ' · ' + email) + '">Open it in your email app →</a>';
        btn.disabled = false;
      }
    });
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-open-form]');
    if (t) track('form_open', { from: t.closest('.minute') ? 'one_minute_popup' : 'contact' });
    if (t && !t.closest('.minute')) { e.preventDefault(); openForm(); }
  });

  /* ---------- rotating word ---------- */
  const swap = $('#swap');
  if (swap && !reduce) {
    const words = ['motion', 'stories', 'campaigns', 'brands', 'color'];
    let i = 0;
    setInterval(() => { i = (i + 1) % words.length; swap.innerHTML = `<span>${words[i]}</span>`; }, 2200);
  }

  /* ---------- statement words ---------- */
  const st = $('#statement');
  let words = [];
  if (st) {
    st.innerHTML = st.textContent.split(/\s+/).map(w => {
      const hl = /^\[.*\]$/.test(w);
      return `<span class="w${hl ? ' hl' : ''}">${w.replace(/[\[\]]/g, '')}</span>`;
    }).join(' ');
    words = $$('.w', st);
  }
  function lightStatement() {
    if (!st) return;
    const r = st.getBoundingClientRect();
    const p = clamp((innerHeight * .85 - r.top) / (r.height + innerHeight * .35));
    const n = Math.round(p * words.length);
    words.forEach((w, i) => w.classList.toggle('lit', i < n || reduce));
  }

  /* ---------- reveal + counters ---------- */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in'); io.unobserve(e.target);
  }), { threshold: .12 });
  $$('.reveal').forEach(el => io.observe(el));
  const cio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target, to = +el.dataset.count, sup = el.querySelector('sup'), t0 = performance.now();
    (function tick(t) {
      const k = Math.min(1, (t - t0) / 1400);
      el.firstChild.nodeValue = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
    if (sup) el.appendChild(sup);
    cio.unobserve(el);
  }), { threshold: .6 });
  $$('[data-count]').forEach(el => cio.observe(el));

  /* ---------- SCROLL STORY ---------- */
  const story = $('#story');
  let updateStory = () => {};
  if (story) {
    const cts = $$('.ct', story), scenes = $$('.scene', story), rails = $$('.rail i', story);
    const titles = ['EDIT · Promo_Final_v3', 'MOTION · Graph Editor', 'DESIGN · SA_Logo.ai'];
    const monTitle = $('#monTitle'), monTc = $('#monTc');
    // edit
    const clips = $$('#tracks .clip2'), ph2 = $('#ph2'), graded = $('#graded'), wipe = $('#wipe'), gradeLab = $('#gradeLab');
    // motion
    const mCurve = $('#mCurve'), mLen = mCurve.getTotalLength();
    mCurve.style.strokeDasharray = mLen;
    const mObj = $('#mObj'), mDot = $('#mDot'), mHandles = $('#mHandles'), kf1 = $('#kf1'), kf2 = $('#kf2'), mFrame = $('#mFrame'), gWrap = $('#ghosts');
    const ghosts = [1, 2, 3, 4, 5].map(k => {
      const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.setAttribute('y', 30); r.setAttribute('width', 28); r.setAttribute('height', 28); r.setAttribute('rx', 6);
      r.setAttribute('fill', 'none'); r.setAttribute('stroke', '#e04a22'); r.setAttribute('stroke-width', 1.5);
      gWrap.appendChild(r); return { r, k };
    });
    const bez = (t, a, b, c, d) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; };
    // design
    const dS = $('#dS'), dA = $('#dA'), sLen = dS.getTotalLength(), aLen = dA.getTotalLength();
    dS.style.strokeDasharray = sLen; dA.style.strokeDasharray = aLen;
    const pen = $('#pen'), dAnc = $('#dAnc'), dHand = $('#dHand'), dDot = $('#dDot'), chips = $$('.s-design .chip'), spec = $('#spec');
    let lastIdx = -1, soundIdx = -1;

    const stText = $('.story-stage > div', story), stMon = $('.monitor', story);
    updateStory = () => {
      const r = story.getBoundingClientRect();
      const total = r.height - innerHeight;
      if (r.bottom < -200 || r.top > innerHeight + 200) return;
      // entrance: text from the left, monitor from the right, before the scroll animation starts
      const en = reduce ? 1 : ease(clamp(1 - r.top / (innerHeight * .9)));
      stText.style.transform = `translateX(${(1 - en) * -160}px)`; stText.style.opacity = .15 + .85 * en;
      stMon.style.transform = `translateX(${(1 - en) * 200}px) scale(${.92 + .08 * en})`; stMon.style.opacity = .15 + .85 * en;
      const P = clamp(-r.top / total);
      const seg = P * 3;
      const idx = Math.min(2, Math.floor(seg));
      const p0 = clamp(seg), p1 = clamp(seg - 1), p2 = clamp(seg - 2);
      const pinned = r.top <= 2 && r.bottom >= innerHeight - 2;
      if (!pinned) soundIdx = -1;
      else if (idx !== soundIdx) { soundIdx = idx; sb(['storyEdit', 'storyMotion', 'storyDesign'][idx]); }
      if (idx !== lastIdx) {
        cts.forEach((c, i) => c.classList.toggle('on', i === idx));
        scenes.forEach((s, i) => s.classList.toggle('on', i === idx));
        monTitle.textContent = titles[idx];
        lastIdx = idx;
      }
      [p0, p1, p2].forEach((p, i) => rails[i].style.transform = `scaleX(${p})`);
      if (P > .97 && !story.dataset.done) { story.dataset.done = 1; track('story_complete'); }
      monTc.textContent = tcode(P, 45);

      // --- edit ---
      clips.forEach(c => {
        const k = ease(clamp((p0 - +c.dataset.at) / .12));
        c.style.opacity = k; c.style.transform = `translateX(${(1 - k) * 60}px)`;
      });
      const pos = clamp((p0 - .3) / .6);
      ph2.style.left = `calc(44px + (100% - 44px) * ${pos})`;
      graded.style.clipPath = `inset(0 ${(1 - pos) * 100}% 0 0)`;
      wipe.style.left = (pos * 100) + '%';
      wipe.style.opacity = pos > 0 && pos < 1 ? 1 : 0;
      gradeLab.style.opacity = pos > .04 ? 1 : 0;

      // --- motion ---
      const d = clamp(p1 / .42);
      mCurve.style.strokeDashoffset = mLen * (1 - ease(d));
      kf1.setAttribute('opacity', p1 > .02 ? 1 : 0);
      kf2.setAttribute('opacity', d >= 1 ? 1 : 0);
      mHandles.setAttribute('opacity', clamp((p1 - .4) / .1));
      const t = clamp((p1 - .38) / .55), e = ease(t);
      mObj.setAttribute('x', 46 + 520 * e);
      ghosts.forEach(({ r: g, k }) => {
        const tk = t - k * .07;
        g.setAttribute('x', 46 + 520 * ease(clamp(tk)));
        g.setAttribute('opacity', tk > 0 ? (.55 - k * .09) : 0);
      });
      mDot.setAttribute('cx', bez(t, 60, 260, 380, 580));
      mDot.setAttribute('cy', bez(t, 390, 390, 110, 110));
      mDot.setAttribute('opacity', t > 0 ? 1 : 0);
      mFrame.textContent = 'FRAME ' + pad(Math.round(t * 48), 3);

      // --- design ---
      const s = clamp(p2 / .28);
      dS.style.strokeDashoffset = sLen * (1 - ease(s));
      const a = clamp((p2 - .24) / .36);
      dA.style.strokeDashoffset = aLen * (1 - a);
      if (a > 0 && a < 1) {
        const pt = dA.getPointAtLength(aLen * a);
        pen.setAttribute('transform', `translate(${pt.x} ${pt.y})`); pen.setAttribute('opacity', 1);
      } else pen.setAttribute('opacity', 0);
      dAnc.setAttribute('opacity', clamp((p2 - .55) / .08));
      dHand.setAttribute('opacity', clamp((p2 - .62) / .08));
      const dk = clamp((p2 - .7) / .08);
      dDot.setAttribute('transform', `scale(${dk < 1 ? dk * 1.15 : 1})`);
      chips.forEach((c, i) => c.classList.toggle('in', p2 > .76 + i * .05));
      spec.classList.toggle('in', p2 > .9);
    };
  }

  /* ---------- footer logo: plays when visible ---------- */
  const flogo = $('#flogo');
  if (flogo) new IntersectionObserver(es => es.forEach(e => { flogo.classList.toggle('on', e.isIntersecting); flogo.classList.toggle('off', !e.isIntersecting); }), { threshold: .6 }).observe(flogo);

  /* ---------- work cards: soft hover tick ---------- */
  if (matchMedia('(hover:hover) and (pointer:fine)').matches) {
    $$('.works .card, .svc2 .srv').forEach(cd => cd.addEventListener('mouseenter', () => sb('hover')));
    $$('.plist .prow').forEach(r => r.addEventListener('mouseenter', () => sb('hoverSoft')));
  }

  /* ---------- pricing teaser: render your quote ---------- */
  const quote = $('#quote');
  let updateQuote = () => {};
  if (quote) {
    const qPct = $('#qPct'), qBar = $('#qBar'), qPh = $('#qPh'), qDig = $('#qDigits'), qSt = $('#qStatus');
    let last = 0, lastPct = -1, lastTick = 0, wasReady = false;
    updateQuote = () => {
      const r = quote.getBoundingClientRect();
      if (r.top > innerHeight || r.bottom < 0) return;
      const p = clamp((innerHeight - r.top) / (innerHeight * .45)); // 100% when the card is a little above mid-screen
      const pct = Math.round(p * 100);
      const now = performance.now();
      if (pct !== lastPct && pct < 100 && lastPct >= 0 && now - lastTick > 85) { lastTick = now; sb('reel'); }
      lastPct = pct;
      if (p >= 1 && !wasReady) sb('ready');
      wasReady = p >= 1;
      qPct.textContent = pct + '%'; qBar.style.width = pct + '%'; qPh.style.left = `calc(${pct}% - 1px)`;
      quote.style.setProperty('--glow', p);
      const ready = p >= 1;
      quote.classList.toggle('ready', ready);
      qSt.textContent = ready ? 'READY · CLICK TO REVEAL' : 'RENDERING YOUR QUOTE…';
      if (ready) qDig.textContent = '???';
    };
    (function scramble(t) {
      if (!quote.classList.contains('ready') && t - last > 70) { last = t; qDig.textContent = String(Math.floor(Math.random() * 900) + 100); }
      requestAnimationFrame(scramble);
    })(0);
  }

  /* ---------- career timeline ---------- */
  const jobs = [
    { y: '2016–17', t: 'Graphic & Web Designer', c: 'INNOA Design · Baku', d: 'Brand assets, web layouts and print design for studio clients. Where it all started.' },
    { y: '2017–21', t: 'Graphic & Motion Designer, Video Editor', c: 'Globus Travel Agency · Baku', d: 'Four years turning tours into videos, campaigns and posts that made people press "Book now". Destination promos, reels, social motion and seasonal campaigns.' },
    { y: '2021–26', t: 'Graphic & Motion Designer, Video Editor', c: 'MTK International School · Baku', d: 'In-house creative for an international school: event films, promo videos, animated social content, print and the visual identity across every channel.' },
    { y: '10 yrs', t: 'The toolkit', c: 'Adobe CC · DaVinci Resolve', d: 'Photoshop, Illustrator, After Effects, Premiere Pro, Lightroom, Audition and DaVinci Resolve, from first sketch to final grade.' },
    { y: '2010–14', t: 'BSc, Computer Engineering', c: 'Azerbaijan Technical University', d: 'The technical foundation behind my workflow.' },
    { y: '2026–28', t: 'MSc, Computer Systems', c: 'RNU · Riga (in progress)', d: 'Studying in Riga while working. Open to full-time, part-time, hybrid and freelance roles.' }
  ];
  const det = $('#tlDetail');
  function show(k) {
    if (!det) return;
    const j = jobs[k];
    det.innerHTML = `<div class="yrs">${j.y}</div><div><div class="mono" style="color:#8a847a;margin-bottom:6px">${j.c}</div><h4>${j.t}</h4><p>${j.d}</p></div>`;
    $$('.clip').forEach(c => c.classList.toggle('sel', +c.dataset.k === k));
  }
  $$('.clip').forEach(c => c.addEventListener('click', () => show(+c.dataset.k)));
  show(2);
  const tl = $('#tl');
  if (tl) new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { tl.classList.add('in'); o.disconnect(); } }), { threshold: .3 }).observe(tl);
  const ph = $('#playhead'), inner = $('#tlInner');
  let lastYear = null, autoSeg = null;
  function scrubTick(forward) { // tiny, delicate 'film sprocket' tick: a soft high sine, no noise
    const c = AU.ctx; if (!c || c.state !== 'running') return;
    const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(forward ? 3400 : 2700, t); o.frequency.exponentialRampToValueAtTime(forward ? 3000 : 2300, t + .03);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.022, t + .003); g.gain.exponentialRampToValueAtTime(.0001, t + .045);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + .06);
  }
  function movePlayhead() {
    if (!ph || !tl) return;
    const r = tl.getBoundingClientRect();
    // starts when the timeline enters, reaches 2028 while the whole timeline is still on screen
    const p = clamp((innerHeight * .92 - r.top) / (innerHeight * .72));
    const phx = Math.min(inner.offsetWidth - 3, 70 + p * (inner.offsetWidth - 70));
    ph.style.left = phx + 'px';
    const body = inner.parentElement; // on narrow screens the timeline scrolls sideways: keep the playhead in view
    if (body.scrollWidth > body.clientWidth + 4) body.scrollLeft = phx - body.clientWidth * .55;
    const yr = 2010 + p * 18;
    const t = $('#tlTc'); if (t) t.textContent = 'PLAYHEAD · ' + yr.toFixed(1);
    const seg = yr < 2016 ? 4 : yr < 2017 ? 0 : yr < 2021 ? 1 : yr < 2026 ? 2 : 5;
    if (seg !== autoSeg) { autoSeg = seg; show(seg); }
    const y = Math.floor(yr * 2) / 2; // tick every half year
    if (lastYear !== null && y !== lastYear && r.top < innerHeight && r.bottom > 0) scrubTick(y > lastYear);
    lastYear = y;
  }

  /* ---------- studio (skills) + ambient soundtrack per tool ---------- */
  const studio = $('#studio');
  if (studio) {
    const info = {
      ae: ['After Effects', 'Motion graphics, kinetic type, 2D & 3D animation and logo reveals.'],
      pr: ['Premiere Pro', 'Edits that tell a story: promos, event films, reels and YouTube.'],
      dv: ['DaVinci Resolve', 'Color grading and finishing. The look that makes a frame feel premium.'],
      ps: ['Photoshop', 'Retouching, compositing, social and campaign visuals.'],
      ai: ['Illustrator', 'Logos, identities, icons and print-ready vector art.'],
      lr: ['Lightroom', 'Photo grading and consistent presets for whole campaigns.'],
      au: ['Audition', 'Clean dialogue, music edits and sound polish.'],
      gen: ['AI Tools', 'Generative images and video, AI-assisted editing and code-driven animation.']
    };
    const layers = $$('.layer', studio), demos = $$('.demo', studio);
    const wave = $('#wave');
    if (wave) for (let i = 0; i < 48; i++) { const b = document.createElement('i'); b.style.animationDuration = (.45 + Math.random() * .7) + 's'; b.style.animationDelay = (-Math.random()) + 's'; wave.appendChild(b); }

    /* ambient engine: every tool has its own soft 4-second soundscape, crossfaded */
    let bus = null, curVoice = null, wantSound = true;
    function getBus() {
      const c = actx(); if (!c) return null;
      if (!bus) {
        const comp = c.createDynamicsCompressor(), lp = c.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 5200;
        bus = c.createGain(); bus.gain.value = .5;
        bus.connect(lp).connect(comp).connect(c.destination);
      }
      return bus;
    }
    function canPlay() { return wantSound && visible && !!live(); }
    let sigTimer = null;
    function playAmbient(key, delay = 0) { // one short signature per tool, plays once
      clearTimeout(sigTimer);
      sigTimer = setTimeout(() => { if (canPlay()) sb(key); }, delay);
    }
    function stopAmbient() { clearTimeout(sigTimer); }

    let cur = 0, timer = null, visible = false;
    function select(i, delay = 0) {
      cur = i;
      const t = layers[i].dataset.t;
      layers.forEach((l, k) => { l.classList.remove('on'); l.setAttribute('aria-selected', k === i); });
      void layers[i].offsetWidth;
      layers[i].classList.add('on');
      demos.forEach(d => d.classList.toggle('on', d.dataset.d === t));
      $('#vName').textContent = info[t][0].toUpperCase() + ' · LIVE PREVIEW';
      $('#vTitle').textContent = info[t][0];
      $('#vText').textContent = info[t][1];
      playAmbient(t, delay);
    }
    function auto() { clearInterval(timer); if (!studio.classList.contains('paused') && visible) timer = setInterval(() => select((cur + 1) % layers.length), 4000); }
    const snd = $('#snd');
    function paintSnd() { const on = wantSound && AU.ctx && AU.ctx.state === 'running' && !AU.muted; if (snd) { snd.setAttribute('aria-pressed', !!on); snd.textContent = on ? 'SOUND · ON' : (wantSound ? 'TAP FOR SOUND' : 'SOUND · OFF'); } }
    snd && snd.addEventListener('click', () => {
      const c = actx();
      if (wantSound && c && c.state === 'running') { wantSound = false; stopAmbient(.6); }
      else { wantSound = true; Promise.resolve(c && !AU.muted && c.resume()).then(() => { paintSnd(); playAmbient(layers[cur].dataset.t); }); }
      paintSnd();
    });
    layers.forEach((l, i) => l.addEventListener('click', () => {
      const c = actx(); wantSound = true;
      Promise.resolve(c && !AU.muted && c.resume()).then(() => { paintSnd(); sfx(l.dataset.t); });
      studio.classList.add('paused'); clearInterval(timer); select(i, 180); track('studio_tool', { tool: info[l.dataset.t][0] });
    }));
    // first interaction anywhere unlocks audio; start the soundtrack if the studio is on screen
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, () => {
      const c = actx(); Promise.resolve(c && !AU.muted && c.resume()).then(() => { paintSnd(); });
    }, { passive: true }));
    new IntersectionObserver(es => es.forEach(e => {
      visible = e.isIntersecting;
      if (visible) { select(cur); auto(); } else { clearInterval(timer); stopAmbient(.8); }
    }), { threshold: .3 }).observe(studio);
    paintSnd();
    document.addEventListener('sa-sound', () => {
      paintSnd();
      const live = AU.ctx && AU.ctx.state === 'running' && !AU.muted;
      if (!live) stopAmbient();
    });
  }

  /* ---------- copy email ---------- */
  const cp = $('#copy');
  cp && cp.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(cp.dataset.v); cp.textContent = 'COPIED ✓'; track('email_copy'); }
    catch { cp.textContent = cp.dataset.v; }
    setTimeout(() => cp.textContent = 'COPY EMAIL', 2200);
  });

  /* ---------- pricing filter ---------- */
  const cats = $$('.cats button');
  function filter(c) {
    cats.forEach(b => b.classList.toggle('on', b.dataset.c === c));
    $$('.prow').forEach(r => r.classList.toggle('hide', c !== 'all' && r.dataset.c !== c && r.dataset.c !== 'all-rates'));
  }
  cats.forEach(b => b.addEventListener('click', () => filter(b.dataset.c)));
  if (cats.length) { const h = location.hash.slice(1); filter(cats.some(b => b.dataset.c === h) ? h : 'all'); }

  /* ---------- back to top ---------- */
  const totop = $('#totop'), ttp = totop && $('.tt-p', totop);
  totop && totop.addEventListener('click', () => scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));
  function updateTop() {
    if (!totop) return;
    const max = document.documentElement.scrollHeight - innerHeight || 1;
    totop.classList.toggle('show', scrollY > innerHeight * .8);
    ttp.style.strokeDashoffset = 132 * (1 - clamp(scrollY / max));
  }

  /* ---------- GOOGLE ANALYTICS 4 (loads only after the visitor accepts) ---------- */
  const GA_ID = 'G-XXXXXXXXXX'; // <-- your Measurement ID
  function loadGA() {
    if (window.gtag) return;
    const sc = document.createElement('script'); sc.async = true; sc.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID; document.head.appendChild(sc);
    window.dataLayer = window.dataLayer || []; window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date()); gtag('config', GA_ID);
  }
  if (/^G-[A-Z0-9]{6,}$/.test(GA_ID) && GA_ID !== 'G-XXXXXXXXXX') {
    let choice = null; try { choice = localStorage.getItem('sa_consent'); } catch (e) {}
    if (choice === 'yes') loadGA();
    else if (choice !== 'no') setTimeout(() => {
      const box = document.createElement('div'); box.className = 'consent'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Cookie consent');
      box.innerHTML = '<span class="mono">COOKIES · ANONYMOUS STATS</span><p>I use cookies to count visits anonymously, so I can see what people like on this site. <a href="privacy.html">Privacy Policy</a></p><div class="row"><button class="ok">ACCEPT</button><button class="no">NO, THANKS</button></div>';
      document.body.appendChild(box); requestAnimationFrame(() => box.classList.add('show'));
      const done = v => { try { localStorage.setItem('sa_consent', v); } catch (e) {} box.classList.remove('show'); setTimeout(() => box.remove(), 500); if (v === 'yes') loadGA(); };
      $('.ok', box).addEventListener('click', () => done('yes')); $('.no', box).addEventListener('click', () => done('no'));
    }, 2500);
  }

  /* privacy page: let the visitor change the cookie choice */
  const rc = $('#resetConsent');
  rc && rc.addEventListener('click', () => { try { localStorage.removeItem('sa_consent'); } catch (e) {} location.reload(); });

  /* ---------- scroll loop ---------- */
  let ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const max = document.documentElement.scrollHeight - innerHeight || 1;
      bar && bar.classList.toggle('solid', scrollY > 40);
      if (logoState) setLogo(scrollY < 120 ? 'on' : 'off');
      lightStatement(); movePlayhead(); updateStory(); updateQuote(); updateTop();
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();
})();
