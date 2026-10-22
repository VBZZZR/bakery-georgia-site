// Бетлеми: the monuments sized by measurement, the hero crossfade, section entrances, the phone menu,
// and the one live thing: "will you make it to a hot shoti?" on Tbilisi time.
(() => {
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = matchMedia('(max-width: 640px)');

  /* ---------- 1. monuments: each [data-fit] line is sized so its longest line spans its box ---------- */
  const vw = () => document.documentElement.clientWidth / 100;
  const fitOne = (el) => {
    const inner = el.querySelector('.fit');
    if (!inner) return null;
    el.style.setProperty('--fs', '100px');
    const natural = inner.getBoundingClientRect().width;
    const box = el.clientWidth - parseFloat(getComputedStyle(el).paddingLeft) - parseFloat(getComputedStyle(el).paddingRight);
    if (!natural || !box) return null;
    const share = parseFloat(el.dataset.fitShare || '1');
    const capVw = parseFloat((narrow.matches && el.dataset.fitMaxNarrow) || el.dataset.fitMax || '0');
    let px = (100 * box * share) / natural;
    if (capVw) px = Math.min(px, capVw * vw());
    return px;
  };
  const fit = () => {
    const groups = new Map();
    document.querySelectorAll('[data-fit]').forEach((el) => {
      const px = fitOne(el);
      if (px == null) return;
      const g = el.dataset.fitGroup;
      if (g) { const cur = groups.get(g); groups.set(g, { px: Math.min(px, cur ? cur.px : Infinity), els: [...(cur ? cur.els : []), el] }); }
      else el.style.setProperty('--fs', px.toFixed(2) + 'px');
    });
    for (const { px, els } of groups.values()) els.forEach((el) => el.style.setProperty('--fs', px.toFixed(2) + 'px'));
  };
  fit();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  let lastW = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== lastW) { lastW = innerWidth; requestAnimationFrame(fit); } });

  /* ---------- 2. the signature move: the rise, slowly changing light ---------- */
  const frames = [...document.querySelectorAll('.hero__media img')];
  if (frames.length > 1) {
    let i = 0, timer = null;
    frames[0].classList.add('is-on');
    const next = () => {
      const cur = frames[i];
      i = (i + 1) % frames.length;
      const nxt = frames[i];
      cur.classList.remove('is-on'); cur.classList.add('was-on');
      nxt.classList.remove('was-on'); nxt.classList.add('is-on');
      setTimeout(() => cur.classList.remove('was-on'), 1700);
    };
    // the frames change only while the hero is on screen and the tab is visible, and the visitor can
    // stop them with the pause button beside the lead (WCAG 2.2.2); the stop also holds the slow drift
    let seen = true, paused = false;
    const hero = document.querySelector('.hero');
    const pauseBtn = document.querySelector('.hero__pause');
    const start = () => { if (!timer && seen && !paused && !calm.matches && !document.hidden) timer = setInterval(next, 6200); };
    const stop = () => { clearInterval(timer); timer = null; };
    const label = (which) => {
      const [shown, hidden] = (pauseBtn.dataset[which] || '').split('|');
      pauseBtn.textContent = shown;
      if (hidden) { const s = document.createElement('span'); s.className = 'sr-only'; s.textContent = hidden; pauseBtn.append(s); }
    };
    const showPause = () => {
      if (!pauseBtn || !hero) return;
      pauseBtn.hidden = calm.matches;
      hero.classList.toggle('hero--rolls', !calm.matches);
    };
    if (pauseBtn && hero) {
      pauseBtn.addEventListener('click', () => {
        paused = !paused;
        hero.classList.toggle('is-paused', paused);
        label(paused ? 'play' : 'stop');
        if (paused) stop(); else { next(); start(); }
      });
      showPause();
    }
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    if (hero && 'IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { seen = e.isIntersecting; if (seen) start(); else stop(); }, { threshold: 0.15 }).observe(hero);
    }
    calm.addEventListener('change', () => { showPause(); if (calm.matches) stop(); else start(); });
    // load the other frames after the first paint, then start
    addEventListener('load', () => { frames.slice(1).forEach((f) => { f.loading = 'eager'; }); start(); });
  } else if (frames[0]) frames[0].classList.add('is-on');

  /* ---------- 3. entrances, once per element, in reading order ---------- */
  // A shutter is clipped to nothing until it opens, so the observer would see no area: watch its parent.
  const targets = [...document.querySelectorAll('[data-reveal]')];
  const byWatch = new Map();
  targets.forEach((el) => { const w = el.classList.contains('shutter') ? el.parentElement : el; byWatch.set(w, [...(byWatch.get(w) || []), el]); });
  const show = (w) => (byWatch.get(w) || []).forEach((el) => el.classList.add('is-in'));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { show(e.target); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.04 });
    byWatch.forEach((_, w) => io.observe(w));
    // safety net: anything on screen a few seconds after load that the observer missed is shown
    addEventListener('load', () => setTimeout(() => byWatch.forEach((_, w) => { const r = w.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) show(w); }), 2500));
  } else targets.forEach((el) => el.classList.add('is-in'));
  // pictures inside a closed shutter count as invisible to the browser's lazy loading, so once the first
  // screen is in, fetch the rest in page order; they are ready by the time their shutter opens
  addEventListener('load', () => setTimeout(() => document.querySelectorAll('img[loading="lazy"]').forEach((img) => { img.loading = 'eager'; }), 300));

  /* ---------- 4. phone: the sections sheet ---------- */
  // The sheet covers the whole screen, the header included, so it carries its own close button and the
  // languages. While it is open the rest of the page is inert: Tab stays in the sheet, and on closing
  // focus goes back to the button that opened it (not when a section link was taken: then the page
  // moves to that section).
  const menuBtn = document.querySelector('.top__menu');
  const sheet = document.getElementById('sheet');
  if (menuBtn && sheet) {
    const closeBtn = sheet.querySelector('.sheet__close');
    const rest = [...document.body.children].filter((el) => el !== sheet && el.tagName !== 'SCRIPT');
    const set = (open, { refocus = true } = {}) => {
      if (open === !sheet.hidden) return;
      sheet.hidden = !open;
      menuBtn.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
      rest.forEach((el) => { el.inert = open; });
      if (open) (closeBtn || sheet.querySelector('a')).focus();
      else if (refocus) menuBtn.focus({ preventScroll: true });
    };
    menuBtn.addEventListener('click', () => set(true));
    if (closeBtn) closeBtn.addEventListener('click', () => set(false));
    sheet.addEventListener('click', (e) => { if (e.target.closest('a')) set(false, { refocus: false }); });
    addEventListener('keydown', (e) => {
      if (sheet.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); set(false); return; }
      if (e.key !== 'Tab') return;
      // inert already keeps focus out of the page; this also stops it leaving for the browser chrome
      const items = [...sheet.querySelectorAll('a[href], button')];
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    // the sheet exists on phones only: widening the window closes it
    narrow.addEventListener('change', () => { if (!narrow.matches) set(false, { refocus: false }); });
  }

  /* ---------- 5. the live thing: will you make it to a hot shoti? ---------- */
  const live = document.querySelector('.live');
  const dataEl = document.getElementById('live-data');
  if (!live || !dataEl) return;
  const T = JSON.parse(dataEl.textContent);
  const out = live.querySelector('.live__out');
  // the clock line refreshes quietly; only the answer to a tap is read out by screen readers
  const say = document.getElementById('live-say');
  const buttons = [...live.querySelectorAll('.place-btn')];
  live.querySelector('.live__places').hidden = false;

  const FIRST = 8 * 60, LAST = 20 * 60, EVERY = 8, LIT = 6 * 60 + 30;
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tbilisi', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const nowTbilisi = () => { const [h, m] = clock.format(new Date()).split(':').map(Number); return h * 60 + m; };
  const hm = (t) => { t = ((t % 1440) + 1440) % 1440; return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }; // taste-skill-ignore: clock minutes, 8:05
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const minutesWord = (n) => {
    if (!T.minutes) return '';
    const [one, few, many] = T.minutes; // Russian: 1 минута, 3 минуты, 12 минут
    const a = n % 10, b = n % 100;
    if (a === 1 && b !== 11) return one;
    if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
    return many;
  };
  const fill = (tpl, v) => tpl.replace(/\{(\w+)\}/g, (_, k) => (k in v ? v[k] : ''));
  const time = (t, hot) => `<span class="nums${hot ? ' hot' : ''}">${hm(t)}</span>`;

  let chosen = null;
  const render = (fresh) => {
    const t = nowTbilisi();
    let html;
    if (!chosen) {
      html = fill(t >= LIT && t <= LAST ? T.idleLit : T.idleOff, { now: time(t) });
    } else {
      const p = T.places[chosen];
      const a = t + p.n;
      const v = {
        place: esc(p.name), n: `<span class="nums">${p.n}</span>`, word: minutesWord(p.n),
        stairs: p.stairs ? T.stairs : '', arrive: time(a), leave: time(FIRST - p.n),
      };
      if (a < FIRST) html = fill(T.early, v);
      else if (a > LAST) html = fill(T.late, v);
      else {
        const next = FIRST + Math.ceil((a - FIRST) / EVERY) * EVERY;
        v.next = time(next, true);
        html = fill(next === a ? T.exact : T.ok, next === a ? { ...v, arrive: time(a, true) } : v);
      }
    }
    // a Georgian ending after a time stays on the time's line (14:48-ზე)
    html = html.replace(/(<span class="nums[^"]*">[^<]*<\/span>|\d{1,2}:\d{2})(-[\u10D0-\u10FF]+)/g, '<span class="nw">$1$2</span>');
    if (out.innerHTML !== html) {
      out.innerHTML = html;
      if (fresh && !calm.matches) { out.classList.remove('is-new'); void out.offsetWidth; out.classList.add('is-new'); }
    }
    if (fresh && say) say.textContent = out.textContent;
  };
  buttons.forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.place;
    chosen = chosen === id ? null : id;
    buttons.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.place === chosen)));
    render(true);
  }));
  render(false);
  setInterval(() => render(false), 15000);
})();
