// Цвима, Батуми. One script for ru, en and ka. Everything on the page reads without it:
// the window shows the rainy picture and the house rule, September is marked in the rain figure.
(() => {
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const wide = matchMedia('(min-width: 1000px)');

  // ---------- reveals: each part of a chapter arrives once, in reading order ----------
  // Checked on scroll rather than by an observer, so a part that is jumped over (an anchor link,
  // a fast flick) is shown too instead of staying hidden above the screen.
  let pending = [...document.querySelectorAll('[data-reveal], [data-reveal-list], .bars, .slip')];
  const reveal = () => {
    if (!pending.length) return;
    const line = innerHeight * 0.9;
    pending = pending.filter((el) => { if (el.getBoundingClientRect().top < line) { el.classList.add('is-in'); return false; } return true; });
    if (!pending.length) removeEventListener('scroll', onScroll);
  };
  let queued = false;
  const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; reveal(); }); } };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  addEventListener('load', reveal);
  reveal();

  // ---------- the window: its picture follows the chapter being read (desktop) ----------
  const layers = new Map([...document.querySelectorAll('.window .layer')].map((l) => [l.dataset.layer, l]));
  const clips = [...document.querySelectorAll('video[data-clip]')];
  let current = 'live';
  const show = (name) => {
    if (!layers.has(name) || name === current) return;
    const was = layers.get(current), now = layers.get(name);
    if (was) { was.classList.remove('is-on'); was.setAttribute('aria-hidden', 'true'); }
    now.classList.add('is-on'); now.removeAttribute('aria-hidden');
    current = name;
    syncClips();
  };
  // a clip plays only while it can be seen and the visitor has not paused it, never in a hidden tab.
  // One pause for both copies of the clip (the window on desktop, the column on phones). Under reduced
  // motion it starts paused, and plays only when the visitor asks for it with the button.
  const visible = new Set();
  const toggles = [...document.querySelectorAll('.clip-toggle')];
  let userPaused = calm.matches;
  function syncClips() {
    for (const v of clips) {
      const layer = v.closest('.layer');
      const on = !userPaused && !document.hidden && visible.has(v) && (!layer || layer.classList.contains('is-on'));
      if (on) { if (v.preload !== 'auto') v.preload = 'auto'; v.play().catch(() => {}); } else if (!v.paused) v.pause();
    }
    for (const b of toggles) {
      const label = userPaused ? b.dataset.play : b.dataset.pause;
      if (b.textContent !== label) b.textContent = label;
    }
  }
  for (const b of toggles) {
    b.hidden = false;
    b.addEventListener('click', () => { userPaused = !userPaused; syncClips(); });
  }
  syncClips();
  if ('IntersectionObserver' in window) {
    const watch = new IntersectionObserver((entries) => {
      for (const e of entries) { if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target); }
      syncClips();
    }, { threshold: 0.2 });
    clips.forEach((v) => watch.observe(v));

    // the chapter that crosses the middle of the screen owns the window
    const scenes = [...document.querySelectorAll('[data-scene]')];
    const card = document.querySelector('.card');
    const pick = () => {
      if (!wide.matches) { show('live'); return; }
      const mid = innerHeight * 0.5;
      let name = null;
      for (const s of scenes) { const r = s.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) name = s.dataset.scene; }
      if (card && card.getBoundingClientRect().bottom > mid) name = 'live';
      if (name) show(name); // past the last chapter the window keeps its last picture
    };
    let ticking = false;
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; pick(); }); } }, { passive: true });
    addEventListener('resize', pick);
    wide.addEventListener?.('change', pick);
    pick();
  }
  document.addEventListener('visibilitychange', syncClips);
  calm.addEventListener?.('change', () => { if (calm.matches) userPaused = true; syncClips(); });

  // ---------- the live window: is it raining in Batumi right now? (Open-Meteo, no key) ----------
  const live = layers.get('live');
  const caption = document.querySelector('.plate__text');
  if (live && caption && 'fetch' in window) {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=41.6417&longitude=41.6339&current=temperature_2m,precipitation,rain,showers,weather_code&timezone=Asia%2FTbilisi';
    const ctrl = 'AbortController' in window ? new AbortController() : null;
    const timer = setTimeout(() => ctrl && ctrl.abort(), 4000);
    const wet = (c) => (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || (c >= 95 && c <= 99);
    fetch(url, ctrl ? { signal: ctrl.signal } : {})
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then((d) => {
        clearTimeout(timer);
        const c = d && d.current;
        if (!c || typeof c.temperature_2m !== 'number') return;
        const raining = (c.precipitation || 0) > 0 || (c.rain || 0) > 0 || (c.showers || 0) > 0 || wet(c.weather_code);
        const t = Math.round(c.temperature_2m);
        const deg = (t > 0 ? '+' : t < 0 ? '−' : '') + Math.abs(t) + '°';
        const text = (raining ? caption.dataset.rain : caption.dataset.dry).replace('{t}', deg);
        live.dataset.weather = raining ? 'rain' : 'dry';
        // only the picture that can be seen is read out
        const on = live.querySelector(raining ? '.shot--rain' : '.shot--dry');
        const off = live.querySelector(raining ? '.shot--dry' : '.shot--rain');
        if (on) on.removeAttribute('aria-hidden');
        if (off) off.setAttribute('aria-hidden', 'true');
        if (calm.matches) { caption.textContent = text; return; }
        caption.classList.add('is-changing');
        setTimeout(() => { caption.textContent = text; caption.classList.remove('is-changing'); }, 500);
      })
      .catch(() => { clearTimeout(timer); /* the rainy window and the house rule stay */ });
  }

  // ---------- the rain figure: this month, from the visitor's own date ----------
  const fig = document.querySelector('.rainfall');
  if (fig) {
    const MM = [235, 183, 157, 90, 93, 141, 165, 221, 330, 322, 306, 278];
    const DAYS = [14, 13, 13, 10, 10, 10, 10, 12, 11, 12, 12, 13];
    const names = (fig.dataset.months || '').split(',');
    const m = new Date().getMonth();
    const bars = fig.querySelectorAll('.bar');
    if (names.length === 12 && bars.length === 12) {
      bars.forEach((b, i) => b.classList.toggle('is-now', i === m));
      fig.querySelector('.rainfall__now').textContent = fig.dataset.template.replace('{m}', names[m]).replace('{mm}', MM[m]).replace('{d}', DAYS[m]);
    }
  }

  // ---------- the address, fitted from margin to margin, never larger than the name ----------
  const fit = document.querySelector('[data-fit]');
  const name = document.querySelector('.wordmark');
  if (fit) {
    const line = fit.closest('.address');
    const size = () => {
      const parts = [...fit.querySelectorAll('.address__part')];
      const stacked = parts.length > 1 && getComputedStyle(parts[0]).display === 'block';
      line.style.fontSize = '100px';
      const avail = line.clientWidth;
      let w;
      line.style.whiteSpace = 'nowrap';
      if (stacked) { w = Math.max(...parts.map((p) => { p.style.display = 'inline-block'; const x = p.getBoundingClientRect().width; p.style.display = ''; return x; })); }
      else w = fit.getBoundingClientRect().width;
      line.style.whiteSpace = '';
      const cap = name ? parseFloat(getComputedStyle(name).fontSize) : Infinity;
      if (w > 0 && avail > 0) line.style.fontSize = Math.min(cap, Math.floor((avail / w) * 100 * 0.985 * 10) / 10) + 'px';
    };
    size();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(size);
    let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(size, 120); });
  }
})();
