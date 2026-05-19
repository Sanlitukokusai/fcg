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

    // Mobile-only: once the user has scrolled past the hero (top 50vh),
    // flag the body so the fixed lens fades out and stops overlapping
    // the menu list below.
    const updatePastHero = () => {
      if (!isMobile()) {
        document.body.classList.remove('is-past-hero');
        return;
      }
      const past = scroller.scrollTop > window.innerHeight * 0.5;
      document.body.classList.toggle('is-past-hero', past);
    };
    scroller.addEventListener('scroll', updatePastHero, { passive: true });
    window.addEventListener('resize', updatePastHero);
    updatePastHero();
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
    // Compute the actual horizontal spacing between two menu items.
    // We use this so the "in-lens window" can be set strictly narrower
    // than the gap between items — guaranteeing only one item is visible
    // (or zero, during the hand-off) at any time.
    function itemSpacing(list) {
      if (!list || list.length < 2) return 320;
      const r0 = list[0].getBoundingClientRect();
      const r1 = list[1].getBoundingClientRect();
      const c0 = r0.left + r0.width / 2;
      const c1 = r1.left + r1.width / 2;
      const s = Math.abs(c1 - c0);
      return s > 40 ? s : 320;
    }

    function hidePanel() {
      panel.classList.remove('is-visible');
      panel.setAttribute('aria-hidden', 'true');
      lastIdx = -1;
    }

    function update() {
      const cx = lensCenterX();
      const list = items();
      // Strict gating: an item is "in the lens" only while its centre is
      // within ~40 % of the inter-item gap from the lens centre.
      // That leaves a ~20 % no-man's-land between consecutive items where
      // *nothing* is shown — so the previous one exits before the next
      // one enters.
      const gap     = itemSpacing(list);
      const tightR  = gap * 0.40;

      // Still on the hero (its right edge hasn't crossed the lens center)
      const onHero = hero && hero.getBoundingClientRect().right > cx;

      // Find the single closest menu item
      let bestIdx = -1, bestDist = Infinity;
      list.forEach((el) => {
        const r = el.getBoundingClientRect();
        const c = r.left + r.width / 2;
        const d = Math.abs(c - cx);
        if (d < bestDist) { bestDist = d; bestIdx = parseInt(el.dataset.idx, 10); }
      });

      const inFocus = !onHero && bestIdx !== -1 && bestDist < tightR;

      // Apply is-in-lens to ONLY that single item (and only when in focus)
      list.forEach((el) => {
        const isThisOne = inFocus && parseInt(el.dataset.idx, 10) === bestIdx;
        el.classList.toggle('is-in-lens', isThisOne);
      });

      if (!inFocus || !window.MENU_ITEMS) {
        if (lastIdx !== -1) hidePanel();
        return;
      }

      const data = window.MENU_ITEMS[bestIdx];
      if (!data) { hidePanel(); return; }

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
    // Expose so the i18n layer can force a refresh after language switch
    window.fcgRefreshDescPanel = () => { lastIdx = -1; update(); };
  })();

  // ===== 6.4 Lens click → fullscreen player =====
  (function initLensPlayer() {
    const trigger  = document.querySelector('.lens-clickarea');
    const overlay  = document.getElementById('lensPlayer');
    const video    = document.getElementById('lensPlayerVideo');
    const closeBtn = document.getElementById('lensPlayerClose');
    if (!trigger || !overlay || !video || !closeBtn) return;

    function open() {
      const src = window.FCG_DEFAULT_VIDEO ||
        'https://wfstwbeehomzdudvikbt.supabase.co/storage/v1/object/public/fcg-videos/junkbranding.mp4';
      if (video.src !== src) video.src = src;
      video.muted = true;             // start muted per spec
      video.currentTime = 0;
      overlay.hidden = false;
      // Attempt to use the browser's native fullscreen
      const rf = overlay.requestFullscreen
              || overlay.webkitRequestFullscreen
              || overlay.msRequestFullscreen;
      if (rf) rf.call(overlay).catch(() => {});
      video.play().catch(() => {});
    }
    function close() {
      video.pause();
      overlay.hidden = true;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
    trigger.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (!overlay.hidden && e.key === 'Escape') close();
    });
    // Auto-sync the close state when user exits browser fullscreen via Esc
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && !overlay.hidden) close();
    });
  })();

  // ===== 6.55 Internationalization (JP / EN / CN) =====
  (function initI18n() {
    const T = {
      jp: {
        'header.contact':   'CONTACT',
        'hero.crumb':       '<span>FCG</span><i>·</i><span>2026 SHOWREEL</span><i>·</i><span>東京 · 千代田</span>',
        'hero.title':       'AI Film &amp; Creative Studio based in Tokyo',
        'hero.lead':        '<span class="nb">FCGは、映画・AI・クロスカルチャー表現を通じて、</span><br><span class="nb">新しい映像言語を探求するクリエイティブスタジオです。</span>',
        'hero.est':         'EST.',
        'hero.focus':       'FOCUS',
        'hero.tools':       'TOOLS',
        'hero.scroll':      'SCROLL →',
        'hero.scrollSub':   '右にスクロールしてメニューへ',
        'sound.title':      'この体験はサウンドと共にお楽しみいただけます。<br><span>音楽を再生しますか？</span>',
        'sound.yes':        'YES, PLAY MUSIC',
        'sound.no':         'NO THANKS',
        'nav.contents':     'Contents · 01',
        'nav.about':        'About · 02',
        'nav.inquiry':      'Inquiry · 03',
        'nav.home.lbl':     'Home<span class="jp">ホーム</span>',
        'nav.news.lbl':     'News<span class="jp">ニュース</span>',
        'nav.member.lbl':   'Member<span class="jp">メンバー</span>',
        'nav.company.lbl':  'Company<span class="jp">会社情報</span>',
        'nav.recruit.lbl':  'Recruit<span class="jp">採用情報</span>',
        'nav.contact.lbl':  'Contact<span class="jp">お問い合わせ</span>',
        'addr.office':      'Tokyo · Head Office',
        'addr.rep':         'Representative Director',
        // Menu items (homepage horizontal nav)
        'menu.news.jp':     'ニュース',
        'menu.works.jp':    'ワークス',
        'menu.member.jp':   'メンバー',
        'menu.creator.jp':  'クリエイター',
        'menu.company.jp':  '会社情報',
        'menu.tech.jp':     'テック',
        'menu.news.desc':     '最新のお知らせ・受賞・公開のニュース。プレスリリースとインタビュー記事を掲載。',
        'menu.works.desc':    '短編映画・ミュージックビデオ・ブランドフィルム — FCGが手がけた近年の主要プロジェクトを年代順に閲覧できます。',
        'menu.member.desc':   'スタジオを構成するメンバー一覧 — ディレクター、エンジニア、プロデューサーの紹介と役割。',
        'menu.creator.desc':  'コラボレーター紹介 — 案件ごとに招集する監督・撮影・音楽・グラフィックチーム。',
        'menu.company.desc':  'FCGという会社について。理念、所在地、代表ディレクター、事業内容を掲載しています。',
        'menu.tech.desc':     'カスタム拡散モデル、Houdini、コンポジット — FCGが開発・運用する生成AI映像のためのテクノロジースタック。',
        // Lens services
        'svc.film':         'AI Film Production',
        'svc.commercial':   'Commercial & Brand Films',
        'svc.vertical':     'Vertical Short Drama',
        'svc.crossborder':  'Cross-border Production (JP/CN)',
        'svc.consulting':   'AI Workflow Consulting',
        // ── company.html ──
        'company.crumb':        'FCG / Company · 会社情報',
        'company.h1':           'Company<span class="jp">FCGという会社について</span>',
        'company.count':        'EST. <b>2017</b>Tokyo · Japan',
        'company.philosophy.head':  '01 / Philosophy',
        'company.philosophy.lead':  'FCGは、映画・AI・クロスカルチャー表現を通じて、<em>新しい映像言語</em>を探求するクリエイティブスタジオです。ニューラルな道具と古典的な映画文法を縫いあわせ、東京を拠点に、日中をまたぐプロジェクトをかたちにしています。',
        'company.philosophy.p1': '<strong>つくるもの。</strong>AIフィルム、コマーシャル／ブランドフィルム、ヴァーティカル・ショートドラマを軸に、日中越境のプロダクションと、企業向けのAIワークフロー導入支援も行います。',
        'company.philosophy.p2': '<strong>つくりかた。</strong>カスタム拡散モデルとHoudini／コンポジット工程を組み合わせ、フレーム単位で制御可能な映像をつくります。コンテと演出はディレクターが責任を持ちます。',
        'company.philosophy.p3': '<strong>規模感。</strong>少人数の固定チーム＋プロジェクトごとのコラボレーター。深く関与し、最後まで仕上げきれる仕事を選びます。',
        'company.philosophy.p4': '<strong>姿勢。</strong>素材の出どころと権利の所在を明確にし、出演者・作家へ正当に還元します。学習データとモデル選定は案件ごとに合意書を交わします。',
        'company.info.head':     '02 / Information',
        'company.services.head': '03 / Services',
        'company.svc.film':       '<strong>AI Film Production.</strong>短編・長編・実験作品まで、生成AIを核に据えた映像制作。コンセプト開発からポストまで一貫対応。',
        'company.svc.commercial': '<strong>Commercial &amp; Brand Films.</strong>ブランドの世界観をAI／実写／3DCGの最適な組み合わせで具体化する、コマーシャル領域のディレクション。',
        'company.svc.vertical':   '<strong>Vertical Short Drama.</strong>縦型短編ドラマの企画・制作・配信運用。プラットフォーム特性に最適化したシリーズ設計。',
        'company.svc.cross':      '<strong>Cross-border Production (JP / CN).</strong>東京と中国主要都市を結ぶ越境プロダクション。キャスティング・ロケ・許認可・字幕／吹替まで対応。',
        'company.svc.consulting': '<strong>AI Workflow Consulting.</strong>制作会社・ブランド向けにAIパイプラインの内製化を支援。ツール選定、運用ガバナンス、社内研修まで。',
        // ── member.html ──
        'member.crumb':         'FCG / Member · メンバー',
        'member.h1':            'Member<span class="jp">スタジオを構成する人たち</span>',
        'member.count':         '<b>05</b>members · 2026',
        'member.director.head': '01 / Director',
        'member.director.name': '吳楽<small>Wu Le</small>',
        'member.director.role': '監督・プロデューサー・FCG Founder',
        'member.director.body': '<p class="is-jp">中国出身、東京在住。<br>東京藝術大学大学院 映像研究科 映画専攻 修了。</p><p class="is-jp">映画、広告、縦型ドラマなど幅広い映像制作に携わりながら、AI時代における映像表現と新しい制作ワークフローを探求している。</p><p class="is-jp">2025年、中日合作長編映画『風の吹くまま』を監督。現在はFCGを拠点に、映画・AI・クロスカルチャー表現を融合した次世代の映像制作に取り組んでいる。</p>',
        'member.roster.head':   '02 / Roster',
        // ── news.html ──
        'news.crumb':           'FCG / News · ニュース',
        'news.h1':              'News<span class="jp">最新のお知らせと発表</span>',
        'news.count':           '<b>06</b>posts · 2026',
        'news.latest.head':     '01 / Latest',
        'news.filter.all':      'All',
        'news.filter.info':     'Info',
        'news.filter.award':    'Award',
        'news.filter.release':  'Release',
        'news.filter.press':    'Press',
        'news.item.1':          '短編映画『黒曜のプロトコル』、撮影開始のお知らせ',
        'news.item.2':          '『私的な天気』が短編映画祭・新人部門にノミネートされました',
        'news.item.3':          'ブランドフィルム『Null Horizon』を公開しました',
        'news.item.4':          '本店を千代田区神田須田町へ移転いたしました',
        'news.item.5':          'CINEMA今月号 — 監督インタビュー掲載',
        'news.item.6':          '2025年度の作品まとめページを公開しました',
        // ── recruit.html ──
        'recruit.crumb':        'FCG / Recruit · 採用情報',
        'recruit.h1':           'Recruit<span class="jp">FCGで働くということ</span>',
        'recruit.count':        '<b>03</b>open roles · 2026',
        'recruit.about.head':   '01 / About working at FCG',
        'recruit.roles.head':   '02 / Open roles',
        'recruit.cond.head':    '03 / Conditions',
        // ── contact.html ──
        'contact.crumb':        'FCG / Contact · お問い合わせ',
        'contact.h1':           'Contact<span class="jp">ご相談・お問い合わせ</span>',
        'contact.count':        'REPLY <b>~3 days</b>平日対応',
        'contact.form.head':    '01 / Inquiry form'
      },
      en: {
        'header.contact':   'CONTACT',
        'hero.crumb':       '<span>FCG</span><i>·</i><span>2026 SHOWREEL</span><i>·</i><span>Tokyo · Chiyoda</span>',
        'hero.title':       'AI Film &amp; Creative Studio based in Tokyo',
        'hero.lead':        '<span class="nb">FCG is an AI-driven film and creative studio based in Tokyo.</span><br><span class="nb">We explore the future of storytelling through cinema, AI, and cross-cultural production.</span>',
        'hero.est':         'EST.',
        'hero.focus':       'FOCUS',
        'hero.tools':       'TOOLS',
        'hero.scroll':      'SCROLL →',
        'hero.scrollSub':   'Scroll right to view the menu',
        'sound.title':      'This experience is best enjoyed with sound.<br><span>Play the soundtrack?</span>',
        'sound.yes':        'YES, PLAY MUSIC',
        'sound.no':         'NO THANKS',
        'nav.contents':     'Contents · 01',
        'nav.about':        'About · 02',
        'nav.inquiry':      'Inquiry · 03',
        'nav.home.lbl':     'Home',
        'nav.news.lbl':     'News',
        'nav.member.lbl':   'Members',
        'nav.company.lbl':  'Company',
        'nav.recruit.lbl':  'Careers',
        'nav.contact.lbl':  'Contact',
        'addr.office':      'Tokyo · Head Office',
        'addr.rep':         'Representative Director',
        'menu.news.jp':     'NEWS & UPDATES',
        'menu.works.jp':    'SELECTED WORKS',
        'menu.member.jp':   'TEAM',
        'menu.creator.jp':  'CREATORS',
        'menu.company.jp':  'COMPANY',
        'menu.tech.jp':     'TECHNOLOGY',
        'menu.news.desc':     'Recent announcements, awards, and releases — press kit and interviews.',
        'menu.works.desc':    'Short films, music videos, and brand films — FCG\'s recent projects by year.',
        'menu.member.desc':   'The studio team — directors, engineers, producers and their roles.',
        'menu.creator.desc':  'Project-based collaborators — directors of photography, music, and graphics.',
        'menu.company.desc':  'About FCG — philosophy, head office, founder, and lines of business.',
        'menu.tech.desc':     'Custom diffusion models, Houdini, compositing — the generative-AI film stack we build and run.',
        'svc.film':         'AI Film Production',
        'svc.commercial':   'Commercial & Brand Films',
        'svc.vertical':     'Vertical Short Drama',
        'svc.crossborder':  'Cross-border Production (JP/CN)',
        'svc.consulting':   'AI Workflow Consulting',
        // ── company.html ──
        'company.crumb':        'FCG / Company · About',
        'company.h1':           'Company<span class="jp">About FCG</span>',
        'company.count':        'EST. <b>2017</b>Tokyo · Japan',
        'company.philosophy.head':  '01 / Philosophy',
        'company.philosophy.lead':  'FCG is a creative studio exploring a <em>new cinematic language</em> through film, AI, and cross-cultural expression. From our Tokyo base we weave neural tools with classical film grammar, shaping projects that move between Japan and China.',
        'company.philosophy.p1': '<strong>What we make.</strong> AI films, commercials &amp; brand films, vertical short dramas — with cross-border (JP/CN) production and enterprise AI-workflow consulting.',
        'company.philosophy.p2': '<strong>How we make it.</strong> Custom diffusion models combined with Houdini and compositing for frame-level control. Storyboards and direction stay in the director\'s hands.',
        'company.philosophy.p3': '<strong>Scale.</strong> A small core team plus project-based collaborators. We pick work we can stay deeply involved in, end to end.',
        'company.philosophy.p4': '<strong>Stance.</strong> Sources and rights are documented; performers and writers are fairly compensated. Training data and model choices are agreed in writing per project.',
        'company.info.head':     '02 / Information',
        'company.services.head': '03 / Services',
        'company.svc.film':       '<strong>AI Film Production.</strong> Generative-AI at the core, from concept through post — for short, feature, and experimental works.',
        'company.svc.commercial': '<strong>Commercial &amp; Brand Films.</strong> Direction across AI, live-action and 3DCG, bringing a brand\'s worldview into a specific cinematic language.',
        'company.svc.vertical':   '<strong>Vertical Short Drama.</strong> Concept, production, and platform-tuned series design for vertical short-form drama.',
        'company.svc.cross':      '<strong>Cross-border Production (JP / CN).</strong> Production linking Tokyo and key Chinese cities — casting, locations, permits, subtitling and dubbing.',
        'company.svc.consulting': '<strong>AI Workflow Consulting.</strong> Helping production companies and brands internalize AI pipelines — tooling, governance, in-house training.',
        // ── member.html ──
        'member.crumb':         'FCG / Members',
        'member.h1':            'Members<span class="jp">The studio team</span>',
        'member.count':         '<b>05</b>members · 2026',
        'member.director.head': '01 / Director',
        'member.director.name': 'Wu Le<small>Filmmaker · FCG Founder</small>',
        'member.director.role': 'Filmmaker / Visual Storyteller',
        'member.director.body': '<p>Wu Le is a filmmaker based in Tokyo whose work explores identity, emotion, and cross-cultural relationships through cinema and emerging technologies.</p><p>A graduate of Tokyo University of the Arts, he works across film, AI-generated visuals, and experimental storytelling formats.</p><p>His recent work focuses on the intersection between cinematic language and artificial intelligence, seeking new possibilities for visual expression in the post-AI era.</p>',
        'member.roster.head':   '02 / Roster',
        // ── news.html ──
        'news.crumb':           'FCG / News',
        'news.h1':              'News<span class="jp">Announcements &amp; releases</span>',
        'news.count':           '<b>06</b>posts · 2026',
        'news.latest.head':     '01 / Latest',
        'news.filter.all':      'All',
        'news.filter.info':     'Info',
        'news.filter.award':    'Award',
        'news.filter.release':  'Release',
        'news.filter.press':    'Press',
        'news.item.1':          'Short film "Obsidian Protocol" — production begins',
        'news.item.2':          '"Personal Weather" nominated in the new directors\' section at a short-film festival',
        'news.item.3':          'Brand film "Null Horizon" released',
        'news.item.4':          'Head office relocated to Kanda-Sudacho, Chiyoda',
        'news.item.5':          'CINEMA — this month\'s issue carries a director interview',
        'news.item.6':          '2025 selected-works recap page is now live',
        // ── recruit.html ──
        'recruit.crumb':        'FCG / Careers',
        'recruit.h1':           'Careers<span class="jp">Working at FCG</span>',
        'recruit.count':        '<b>03</b>open roles · 2026',
        'recruit.about.head':   '01 / About working at FCG',
        'recruit.roles.head':   '02 / Open roles',
        'recruit.cond.head':    '03 / Conditions',
        // ── contact.html ──
        'contact.crumb':        'FCG / Contact',
        'contact.h1':           'Contact<span class="jp">Inquiries &amp; requests</span>',
        'contact.count':        'REPLY <b>~3 days</b>weekdays',
        'contact.form.head':    '01 / Inquiry form'
      },
      cn: {
        'header.contact':   '联系我们',
        'hero.crumb':       '<span>FCG</span><i>·</i><span>2026 SHOWREEL</span><i>·</i><span>东京 · 千代田</span>',
        'hero.title':       '位于东京的 AI 影像 &amp; 创意工作室',
        'hero.lead':        '<span class="nb">FCG 是一家位于东京的 AI 影像工作室。</span><br><span class="nb">我们通过电影、人工智能与跨文化创作，探索下一代叙事。</span>',
        'hero.est':         '成立',
        'hero.focus':       '业务',
        'hero.tools':       '工具',
        'hero.scroll':      '滚动 →',
        'hero.scrollSub':   '向右滚动查看菜单',
        'sound.title':      '本网站建议在有声环境下体验。<br><span>是否播放背景音乐？</span>',
        'sound.yes':        '好的，播放',
        'sound.no':         '不用了',
        'nav.contents':     '目录 · 01',
        'nav.about':        '关于 · 02',
        'nav.inquiry':      '咨询 · 03',
        'nav.home.lbl':     '首页',
        'nav.news.lbl':     '新闻',
        'nav.member.lbl':   '团队',
        'nav.company.lbl':  '公司',
        'nav.recruit.lbl':  '招聘',
        'nav.contact.lbl':  '联系',
        'addr.office':      '东京 · 总部',
        'addr.rep':         '代表董事',
        'menu.news.jp':     '新闻动态',
        'menu.works.jp':    '精选作品',
        'menu.member.jp':   '团队成员',
        'menu.creator.jp':  '合作创作者',
        'menu.company.jp':  '关于公司',
        'menu.tech.jp':     '技术栈',
        'menu.news.desc':     '最新动态、奖项与发布 — 包含媒体资料与采访稿。',
        'menu.works.desc':    '短片、音乐影像、品牌广告片 — 按年份呈现 FCG 近期代表项目。',
        'menu.member.desc':   '工作室固定成员 — 导演、工程师、制片人各司其职。',
        'menu.creator.desc':  '项目协作者 — 摄影、音乐、平面等专业合作伙伴。',
        'menu.company.desc':  '关于 FCG — 理念、总部、代表董事与业务范围。',
        'menu.tech.desc':     '自研扩散模型 / Houdini / 合成流程 — 我们为生成式 AI 影像所搭建的整套技术栈。',
        'svc.film':         'AI 影像制作',
        'svc.commercial':   '商业 & 品牌片',
        'svc.vertical':     '竖屏短剧',
        'svc.crossborder':  '中日跨境制作',
        'svc.consulting':   'AI 工作流咨询',
        // ── company.html ──
        'company.crumb':        'FCG / 公司 · 关于我们',
        'company.h1':           'Company<span class="jp">关于 FCG</span>',
        'company.count':        'EST. <b>2017</b>东京 · 日本',
        'company.philosophy.head':  '01 / 理念',
        'company.philosophy.lead':  'FCG 是一家通过电影、AI 与跨文化表达，探索<em>全新影像语言</em>的创意工作室。我们以东京为据点，将神经网络工具与经典电影语法缝合，承接日中两地的项目。',
        'company.philosophy.p1': '<strong>我们做什么。</strong>以 AI 影像、商业 / 品牌片、竖屏短剧为核心，并提供日中跨境制作与企业级 AI 工作流咨询。',
        'company.philosophy.p2': '<strong>怎么做。</strong>自研扩散模型与 Houdini / 合成流程组合，做到帧级可控；分镜与导演把控由总导演负责。',
        'company.philosophy.p3': '<strong>规模感。</strong>小核心团队 + 项目制协作者。我们只接深度参与、能亲自把控完成的项目。',
        'company.philosophy.p4': '<strong>立场。</strong>素材来源与权利归属可追溯，演员与作家获得公平报酬。训练数据与模型选择按项目签署书面协议。',
        'company.info.head':     '02 / 公司信息',
        'company.services.head': '03 / 服务',
        'company.svc.film':       '<strong>AI 影像制作。</strong>以生成式 AI 为核心 — 覆盖短片、长片与实验作品，从概念到后期一体化承接。',
        'company.svc.commercial': '<strong>商业 &amp; 品牌片。</strong>结合 AI / 实拍 / 3DCG，把品牌世界观具象为商业领域的影像语言。',
        'company.svc.vertical':   '<strong>竖屏短剧。</strong>从企划、制作到平台运营 — 针对竖屏短剧的系列化设计。',
        'company.svc.cross':      '<strong>中日跨境制作（JP / CN）。</strong>连接东京与中国主要城市的越境制作 — 选角、拍摄、许可、字幕与配音。',
        'company.svc.consulting': '<strong>AI 工作流咨询。</strong>协助制作公司与品牌内建 AI 流水线 — 工具选型、运营治理、团队培训。',
        // ── member.html ──
        'member.crumb':         'FCG / 成员',
        'member.h1':            '团队<span class="jp">构成工作室的人</span>',
        'member.count':         '<b>05</b> 名成员 · 2026',
        'member.director.head': '01 / 导演',
        'member.director.name': '吴乐<small>Wu Le · Director / AI 影像创作者</small>',
        'member.director.role': '导演 / AI 影像创作者',
        'member.director.body': '<p>吴乐，导演、制片人，FCG 创始人。毕业于东京艺术大学大学院映像研究科电影专攻，现居东京。</p><p>长期从事电影、广告、短剧等影像制作，并持续关注 AI 技术对未来电影工业与视觉叙事的改变。</p><p>其创作横跨电影、商业影像与 AI 实验视觉，致力于探索"电影语言"与"人工智能"之间新的融合方式。</p>',
        'member.roster.head':   '02 / 团队',
        // ── news.html ──
        'news.crumb':           'FCG / 新闻',
        'news.h1':              '新闻<span class="jp">最新动态与发布</span>',
        'news.count':           '<b>06</b> 条 · 2026',
        'news.latest.head':     '01 / 最新',
        'news.filter.all':      '全部',
        'news.filter.info':     '资讯',
        'news.filter.award':    '获奖',
        'news.filter.release':  '发布',
        'news.filter.press':    '媒体',
        'news.item.1':          '短片《黑曜协议》— 正式开机',
        'news.item.2':          '《私人天气》入围短片电影节新人单元',
        'news.item.3':          '品牌片《Null Horizon》正式发布',
        'news.item.4':          '公司本部已迁至千代田区神田须田町',
        'news.item.5':          '《CINEMA》本月刊 — 导演专访收录',
        'news.item.6':          '2025 年度作品汇总页面已上线',
        // ── recruit.html ──
        'recruit.crumb':        'FCG / 招聘',
        'recruit.h1':           '招聘<span class="jp">在 FCG 工作</span>',
        'recruit.count':        '<b>03</b> 个职位 · 2026',
        'recruit.about.head':   '01 / 关于在 FCG 工作',
        'recruit.roles.head':   '02 / 在招岗位',
        'recruit.cond.head':    '03 / 工作条件',
        // ── contact.html ──
        'contact.crumb':        'FCG / 联系',
        'contact.h1':           '联系<span class="jp">咨询与合作</span>',
        'contact.count':        'REPLY <b>~3 天</b>工作日',
        'contact.form.head':    '01 / 咨询表单'
      }
    };
    window.FCG_I18N = T;

    const HTML_KEYS = { jp: 'ja', en: 'en', cn: 'zh-Hans' };
    const STORAGE_KEY = 'fcg-lang';

    function apply(lang) {
      const dict = T[lang] || T.jp;
      document.querySelectorAll('[data-i18n]').forEach((el) => {
        const k = el.getAttribute('data-i18n');
        if (dict[k] != null) el.innerHTML = dict[k];
      });
      // Update language picker active state
      document.querySelectorAll('.lang-pick').forEach((b) => {
        b.classList.toggle('is-active', b.getAttribute('data-lang') === lang);
      });
      document.documentElement.setAttribute('lang', HTML_KEYS[lang] || lang);
      document.body.setAttribute('data-lang', lang);
      // Notify listeners (e.g. menu builder needs to redraw labels)
      window.dispatchEvent(new CustomEvent('fcg:lang', { detail: { lang } }));
    }

    // Initial language: localStorage > <html lang=…> > 'jp'
    let initial = localStorage.getItem(STORAGE_KEY);
    if (!initial) {
      const htmlLang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
      initial = htmlLang.startsWith('zh') ? 'cn'
              : htmlLang.startsWith('en') ? 'en'
              : 'jp';
    }
    apply(initial);

    // Bind language picker buttons
    document.querySelectorAll('.lang-pick').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const lang = btn.getAttribute('data-lang');
        localStorage.setItem(STORAGE_KEY, lang);
        apply(lang);
      });
    });

    // Expose for other modules
    window.fcgGetLang = () => localStorage.getItem(STORAGE_KEY) || 'jp';
    window.fcgT = (key) => (T[window.fcgGetLang()] || T.jp)[key];
  })();

  // ===== 6.55 Mobile autoplay unblocker =====
  // iOS Safari (and some Android browsers) refuse to start <video> playback
  // — even when muted — until *some* user gesture has happened on the page.
  // We listen for the very first tap/click anywhere and nudge every paused
  // video to play. Same call also runs when the sound-prompt buttons fire.
  (function initMobileAutoplay() {
    function kickAllVideos() {
      document.querySelectorAll('video').forEach((v) => {
        if (v.paused) {
          // Belt-and-braces: re-apply attributes some browsers need
          if (!v.hasAttribute('playsinline')) v.setAttribute('playsinline', '');
          if (!v.hasAttribute('muted'))       v.setAttribute('muted', '');
          v.muted = true;
          v.play().catch(() => { /* still blocked, no-op */ });
        }
      });
    }
    window.fcgKickVideos = kickAllVideos;
    ['touchend', 'click'].forEach((evt) => {
      document.addEventListener(evt, function once() {
        kickAllVideos();
        document.removeEventListener(evt, once);
      }, { once: true, passive: true });
    });
  })();

  // ===== 6.6 Background sound: toggle + first-visit prompt =====
  (function initSound() {
    const audio  = document.getElementById('fcgBgm');
    const toggle = document.getElementById('soundToggle');
    const prompt = document.getElementById('soundPrompt');
    if (!audio || !toggle) return;

    const KEY = 'fcg-sound';      // 'on' | 'off' | null (= ask)
    audio.volume = 0.55;

    function reflect(on) {
      toggle.classList.toggle('is-on', on);
      toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
      const lbl = toggle.querySelector('.sound-toggle__label');
      if (lbl) lbl.textContent = on ? 'SOUND ON' : 'SOUND OFF';
    }
    function setOn() {
      audio.play().then(() => {
        localStorage.setItem(KEY, 'on');
        reflect(true);
      }).catch(() => {
        // Autoplay blocked — keep state off, user must click toggle
        reflect(false);
      });
    }
    function setOff() {
      audio.pause();
      localStorage.setItem(KEY, 'off');
      reflect(false);
    }

    toggle.addEventListener('click', () => {
      if (toggle.classList.contains('is-on')) setOff();
      else setOn();
    });

    // First-visit prompt (only shows when no preference is saved yet)
    const saved = localStorage.getItem(KEY);
    if (saved === 'on') {
      // Saved preference: try to autoplay (often blocked until next gesture)
      audio.play().then(() => reflect(true)).catch(() => reflect(false));
    } else if (saved === 'off') {
      reflect(false);
    } else if (prompt) {
      // Show the prompt once the loading screen has lifted
      const showPrompt = () => { prompt.hidden = false; };
      if (document.body.classList.contains('is-loaded')) showPrompt();
      else setTimeout(showPrompt, 1300);

      prompt.querySelectorAll('[data-choice]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const choice = btn.getAttribute('data-choice');
          prompt.hidden = true;
          if (choice === 'on') setOn();
          else setOff();
          // The button click is a user gesture — kick any paused <video>
          // to start playing now (mobile autoplay unblock).
          if (typeof window.fcgKickVideos === 'function') window.fcgKickVideos();
        });
      });
    }
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

    // Tab/switch markup: track + sliding knob + two labels (DARK / LIGHT)
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'theme-toggle';
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-label', 'Toggle light / dark theme');
    sw.innerHTML = `
      <span class="theme-toggle__knob" aria-hidden="true"></span>
      <span class="theme-toggle__opt" data-mode="dark">DARK</span>
      <span class="theme-toggle__opt" data-mode="light">LIGHT</span>
    `;
    const setState = () => {
      sw.setAttribute('aria-checked', document.body.classList.contains('is-light') ? 'true' : 'false');
    };
    setState();
    sw.addEventListener('click', () => {
      const nowLight = !document.body.classList.contains('is-light');
      document.body.classList.toggle('is-light', nowLight);
      localStorage.setItem(KEY, nowLight ? 'light' : 'dark');
      setState();
      window.dispatchEvent(new CustomEvent('fcg:theme', { detail: { light: nowLight } }));
    });
    document.body.appendChild(sw);
    // Fire once on load so WebGL picks up persisted state
    window.dispatchEvent(new CustomEvent('fcg:theme', {
      detail: { light: document.body.classList.contains('is-light') }
    }));
  })();
})();
