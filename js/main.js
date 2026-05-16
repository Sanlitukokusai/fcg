/* ============================================================
 * Main interactions — pics-leaning replica + FCG technical layer
 *
 *   1. wheel → horizontal scroll (PC)
 *   2. scroll_ui bar follows scrollLeft + visible-segment number
 *   3. loading screen hide on DOMContentLoaded + min duration
 *   4. burger ↔ c-gnav overlay (clip-path)
 *   5. internal links → c-cover slide-in transition
 *   6. Tweaks panel (press T to toggle)
 * ============================================================ */
(() => {
  const isMobile = () => window.matchMedia('(max-width: 900px)').matches;
  const $ = (sel) => document.querySelector(sel);

  // ===== 1. Wheel → horizontal scroll (home page only) =====
  const scroller = $('.p-top');
  if (scroller) {
    scroller.addEventListener('wheel', (e) => {
      if (isMobile()) return;
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (delta !== 0) {
        e.preventDefault();
        scroller.scrollLeft += delta;
      }
    }, { passive: false });

    // Drag-to-scroll
    let dragStart = null;
    scroller.addEventListener('pointerdown', (e) => {
      if (isMobile() || e.target.closest('a, button')) return;
      dragStart = { x: e.clientX, scrollLeft: scroller.scrollLeft };
      scroller.setPointerCapture(e.pointerId);
    });
    scroller.addEventListener('pointermove', (e) => {
      if (!dragStart) return;
      scroller.scrollLeft = dragStart.scrollLeft - (e.clientX - dragStart.x);
    });
    ['pointerup', 'pointercancel'].forEach(ev =>
      scroller.addEventListener(ev, () => { dragStart = null; })
    );

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') scroller.scrollBy({ left:  window.innerWidth * 0.55, behavior: 'smooth' });
      if (e.key === 'ArrowLeft')  scroller.scrollBy({ left: -window.innerWidth * 0.55, behavior: 'smooth' });
    });
  }

  // ===== 2. scroll_ui bar + segment number =====
  const bar       = $('.scroll_ui .bar');
  const baseBar   = $('.scroll_ui .base_bar');
  const scrollUi  = $('.scroll_ui');
  const segLabel  = $('#scrollSeg');

  const updateBar = () => {
    if (!scroller) return;
    const max   = scroller.scrollWidth - scroller.clientWidth;
    const ratio = max > 0 ? scroller.scrollLeft / max : 0;
    if (bar && baseBar) bar.style.width = (ratio * baseBar.offsetWidth) + 'px';
    if (segLabel) {
      const total = 6;
      const seg = Math.min(total, Math.max(1, Math.round(ratio * (total - 1)) + 1));
      segLabel.textContent = String(seg).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
    }
  };
  if (scroller) {
    scroller.addEventListener('scroll', updateBar, { passive: true });
    window.addEventListener('resize', updateBar);
    updateBar();
  }

  // scroll_ui hover state (def ↔ hover)
  if (scrollUi) {
    scrollUi.addEventListener('mouseenter', () => scrollUi.classList.add('is-hover'));
    scrollUi.addEventListener('mouseleave', () => scrollUi.classList.remove('is-hover'));
  }

  // ===== 3. Loading screen =====
  const loading      = $('.c-loading');
  const MIN_LOADING_MS = 1200;
  const t0 = performance.now();
  window.addEventListener('load', () => {
    const wait = Math.max(0, MIN_LOADING_MS - (performance.now() - t0));
    setTimeout(() => {
      loading && loading.classList.add('is-hidden');
      // Trigger the lens intro animation only after the loading curtain lifts
      document.body.classList.add('is-loaded');
    }, wait);
  });

  // ===== 4. Burger ↔ c-gnav overlay =====
  const burger = $('.c-gnav__trigger') || $('#burger');
  if (burger) {
    burger.addEventListener('click', () => {
      document.body.classList.toggle('is-gnav');
    });
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.body.classList.remove('is-gnav');
  });

  // Back button inside c-gnav (top-left), closes the overlay
  const gnav = $('#gnav') || $('.c-gnav');
  if (gnav && !gnav.querySelector('.c-gnav__back')) {
    const back = document.createElement('button');
    back.className = 'c-gnav__back';
    back.setAttribute('aria-label', '閉じる / Close menu');
    back.innerHTML = '<span class="arrow">←</span><span class="lbl">BACK</span>';
    back.addEventListener('click', () => document.body.classList.remove('is-gnav'));
    gnav.appendChild(back);
  }

  // ===== 5. Page-cover transitions for internal links =====
  const cover = $('.c-cover');
  function pageCover(href) {
    if (!cover) { location.href = href; return; }
    cover.classList.remove('is-out');
    cover.classList.add('is-in');
    setTimeout(() => { location.href = href; }, 520);
  }
  // Slide cover out on entry (subpages have c-cover.is-in baked in)
  window.addEventListener('load', () => {
    if (cover && cover.classList.contains('is-in')) {
      requestAnimationFrame(() => {
        cover.classList.remove('is-in');
        cover.classList.add('is-out');
        setTimeout(() => cover.classList.remove('is-out'), 620);
      });
    }
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-page]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:')) return;
    e.preventDefault();
    document.body.classList.remove('is-gnav');
    pageCover(href);
  });

  // ===== 6. Tweaks panel =====
  const tweaks = $('#tweaks');
  if (tweaks && window.__fcgState && window.__fcgApplyTweaks) {
    const state = window.__fcgState;
    const refresh = () => {
      tweaks.querySelectorAll('[data-tweak]').forEach((group) => {
        const key = group.dataset.tweak;
        group.querySelectorAll('.chip').forEach((c) => {
          c.classList.toggle('is-on', c.dataset.v === state[key]);
        });
      });
      const slider = $('#speedSlider');
      if (slider) slider.value = Math.round((state.speed ?? 1) * 100);
    };
    tweaks.querySelectorAll('.chip').forEach((c) => {
      c.addEventListener('click', () => {
        const group = c.closest('[data-tweak]');
        state[group.dataset.tweak] = c.dataset.v;
        window.__fcgApplyTweaks();
        refresh();
      });
    });
    const slider = $('#speedSlider');
    if (slider) slider.addEventListener('input', (e) => {
      state.speed = e.target.value / 100;
    });
    $('#tweakClose')?.addEventListener('click', () => tweaks.classList.remove('is-open'));
    window.addEventListener('keydown', (e) => {
      if (e.key === 't' || e.key === 'T') {
        if (e.target.matches('input, textarea')) return;
        tweaks.classList.toggle('is-open');
      }
    });
    refresh();
  }

  // ===== 6.4 Menu description panel — content syncs with horizontal scroll =====
  (function bindMenuDescPanel() {
    const panel = document.querySelector('.menu-desc-panel');
    if (!panel) return;
    const scroller = document.querySelector('.p-top');
    if (!scroller) return;
    const fields = {
      num:   panel.querySelector('[data-field="num"]'),
      jp:    panel.querySelector('[data-field="jp"]'),
      label: panel.querySelector('[data-field="label"]'),
      desc:  panel.querySelector('[data-field="desc"]'),
    };
    const hero  = document.querySelector('.top_hero');
    const items = () => document.querySelectorAll('.menu-item');
    const pad2  = (n) => String(n).padStart(2, '0');
    let lastIdx = -2;
    // The WebGL canvas sits exactly at the lens center (same transform), so
    // we can use its rect as the "lens center" reference point.
    const canvasEl = document.getElementById('canvasContainer');
    function lensCenterX() {
      if (canvasEl) {
        const r = canvasEl.getBoundingClientRect();
        if (r.width > 0) return r.left + r.width / 2;
      }
      return window.innerWidth / 2;
    }
    // Visibility window for menu items: based on the visible lens diameter
    // (#canvasContainer is 72vmin). Items whose center falls inside this
    // radius around the lens center are shown; others fade out.
    function lensVisibleRadius() {
      if (canvasEl) {
        const r = canvasEl.getBoundingClientRect();
        if (r.width > 0) return r.width * 0.6; // a touch wider than the disc
      }
      return Math.min(window.innerWidth, window.innerHeight) * 0.4;
    }
    function update() {
      const cx = lensCenterX();
      const lensR = lensVisibleRadius();
      const list = items();
      // Toggle per-item visibility — only items near the lens center stay lit
      list.forEach((el) => {
        const r = el.getBoundingClientRect();
        const c = r.left + r.width / 2;
        const dist = Math.abs(c - cx);
        el.classList.toggle('is-in-lens', dist < lensR);
      });
      // Still on the hero (its right edge hasn't crossed the lens center)
      if (hero) {
        const hr = hero.getBoundingClientRect();
        if (hr.right > cx) {
          if (lastIdx !== -1) {
            panel.classList.remove('is-visible');
            panel.setAttribute('aria-hidden', 'true');
            lastIdx = -1;
          }
          return;
        }
      }
      // Pick the menu item whose center is closest to the lens center
      let bestIdx = -1, bestDist = Infinity;
      list.forEach((el) => {
        const r = el.getBoundingClientRect();
        const c = r.left + r.width / 2;
        const d = Math.abs(c - cx);
        if (d < bestDist) { bestDist = d; bestIdx = parseInt(el.dataset.idx, 10); }
      });
      if (bestIdx === -1 || !window.MENU_ITEMS) return;
      const data = window.MENU_ITEMS[bestIdx];
      if (!data) return;
      if (bestIdx !== lastIdx) {
        if (fields.num)   fields.num.textContent   = pad2(data.i);
        if (fields.jp)    fields.jp.textContent    = data.jp;
        if (fields.label) fields.label.textContent = data.label;
        if (fields.desc)  fields.desc.textContent  = data.desc;
        lastIdx = bestIdx;
      }
      panel.classList.add('is-visible');
      panel.setAttribute('aria-hidden', 'false');
    }
    scroller.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    // Initial pass after layout settles
    setTimeout(update, 200);
    setTimeout(update, 800);
  })();

  // ===== 6.5 Lens intro: flag body when the opening animation finishes =====
  const lensImg = document.querySelector('.lens-stage__img');
  if (lensImg) {
    const onDone = () => document.body.classList.add('lens-ready');
    lensImg.addEventListener('animationend', onDone, { once: true });
    // Safety net in case animationend doesn't fire (tab not focused, etc.)
    setTimeout(onDone, 3500);
  }

  // ===== 7. Theme toggle (light / dark) =====
  (function initThemeToggle() {
    const KEY = 'fcg-theme';
    const saved = localStorage.getItem(KEY);
    if (saved === 'light') document.body.classList.add('is-light');

    const btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.setAttribute('aria-label', 'Toggle light / dark theme');
    const setLabel = () => {
      btn.textContent = document.body.classList.contains('is-light') ? 'DARK' : 'LIGHT';
    };
    setLabel();
    btn.addEventListener('click', () => {
      const nowLight = !document.body.classList.contains('is-light');
      document.body.classList.toggle('is-light', nowLight);
      localStorage.setItem(KEY, nowLight ? 'light' : 'dark');
      setLabel();
      // Notify WebGL stage so the shader can invert its output
      window.dispatchEvent(new CustomEvent('fcg:theme', { detail: { light: nowLight } }));
    });
    document.body.appendChild(btn);
    // Fire once on load so WebGL picks up persisted state
    window.dispatchEvent(new CustomEvent('fcg:theme', {
      detail: { light: document.body.classList.contains('is-light') }
    }));
  })();
})();
