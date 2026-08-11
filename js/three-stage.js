/* ============================================================
 * FCG home — Three.js WebGL stage
 * Procedural mask + procedural "video" with a real-MP4 swap-in.
 *
 * Public API:
 *   window.fcgSetVideo('/path/to/video.mp4')  → swap to VideoTexture
 *   window.fcgSetVideo(null)                  → revert to procedural
 * ============================================================ */
(function () {
  /* EDITMODE-BEGIN */
  const TWEAK_DEFAULTS = {
    mask: 'blob',     // blob / strip / lens / shard
    tex: 'noise',     // noise / bars / cells
    accent: 'none',   // none / cyan / amber / green   (PICS-leaning = mono)
    speed: 0.6,
    videoSrc: null    // when truthy, swap procedural for THREE.VideoTexture
  };
  /* EDITMODE-END */

  const state = { ...TWEAK_DEFAULTS };
  window.__fcgState = state;

  const container = document.getElementById('canvasContainer');
  if (!container || typeof THREE === 'undefined') return;

  const scene    = new THREE.Scene();
  const camera   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // 1x1 transparent fallback so the sampler is always valid
  const fallbackData = new Uint8Array([0, 0, 0, 255]);
  const fallbackTex  = new THREE.DataTexture(fallbackData, 1, 1, THREE.RGBAFormat);
  fallbackTex.needsUpdate = true;

  let videoEl  = null;
  let videoTex = null;

  const uniforms = {
    uTime:      { value: 0 },
    uShift:     { value: new THREE.Vector2(0, 0) },
    uRes:       { value: new THREE.Vector2(1, 1) },
    uMask:      { value: 0 },
    uTex:       { value: 0 },
    uAccent:    { value: new THREE.Vector3(1, 1, 1) },
    uAccentOn:  { value: 0.0 },
    uSpeed:     { value: 0.6 },
    uVideo:     { value: fallbackTex },
    uVideoMode: { value: 0.0 },
    uHoverPos:  { value: new THREE.Vector2(0, 0) }, // NDC-space center bias
    uHover:     { value: 0 },                       // 0..1 strength of follow
    uInvert:    { value: 0 },                       // 0 = dark theme, 1 = light theme
    uFillCircle:{ value: 0 },                       // 1 on homepage → fill the whole canvas
    uVideoAspect:{ value: 1.0 }                     // video w/h — for cover-fit UV
  };

  const vertSrc = `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
  `;

  const fragSrc = `
    precision highp float;
    varying vec2 vUv;
    uniform float uTime;
    uniform vec2  uShift;
    uniform vec2  uRes;
    uniform int   uMask;
    uniform int   uTex;
    uniform vec3  uAccent;
    uniform float uAccentOn;
    uniform float uSpeed;
    uniform sampler2D uVideo;
    uniform float uVideoMode;
    uniform vec2  uHoverPos;
    uniform float uHover;
    uniform float uInvert;
    uniform float uFillCircle;
    uniform float uVideoAspect;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float vnoise(vec2 p){
      vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                 mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
    }
    float fbm(vec2 p){ float v=0.0, a=0.55; for(int i=0;i<5;i++){ v+=a*vnoise(p); p*=2.07; a*=0.5; } return v; }
    float cells(vec2 p){
      vec2 i=floor(p), f=fract(p); float d=1.0;
      for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
        vec2 g=vec2(float(x),float(y));
        vec2 o=vec2(hash(i+g), hash(i+g+11.1));
        o = 0.5 + 0.5 * sin(uTime*0.4 + 6.2831*o);
        vec2 r=g+o-f;
        d=min(d, dot(r,r));
      } return sqrt(d);
    }
    vec2 ndc(vec2 uv){ vec2 p=uv-0.5; p.x*=uRes.x/uRes.y; return p; }

    /* ── Masks ── */
    float maskBlob(vec2 p){
      float n = fbm(p*2.4 + uTime*0.06*uSpeed);
      vec2  d = vec2(cos(n*6.2831), sin(n*6.2831)) * 0.08;
      vec2  q = p + d; q.x *= 0.72; q.y *= 1.18;
      float r = 0.32 + 0.03*sin(uTime*0.4*uSpeed) + 0.02*cos(uTime*0.27*uSpeed);
      return smoothstep(r, r-0.014, length(q));
    }
    float maskStrip(vec2 p){
      float wob = 0.012*sin(p.x*9.0 + uTime*0.5*uSpeed);
      float h   = 0.13 + wob;
      float a   = smoothstep(h, h-0.008, abs(p.y));
      float ends= smoothstep(0.78, 0.55, abs(p.x));
      return a*ends;
    }
    float maskLens(vec2 p){ return smoothstep(0.32, 0.308, length(p)); }
    float maskShard(vec2 p){
      vec2 q = abs(p);
      float d = q.x*0.85 + q.y*1.05;
      d += 0.008 * fbm(p*9.0 + uTime*0.3*uSpeed);
      return smoothstep(0.34, 0.328, d);
    }
    float getMask(vec2 p){
      if (uMask==0) return maskBlob(p);
      if (uMask==1) return maskStrip(p);
      if (uMask==2) return maskLens(p);
      return maskShard(p);
    }

    /* ── Procedural textures (used when no video is bound) ── */
    vec3 texNoise(vec2 uv){
      vec2 q = uv + vec2(uShift.x*0.45, uTime*0.018*uSpeed);
      float a = fbm(q*3.2);
      float b = fbm(q*8.0 + 13.0);
      float v = mix(a, b, 0.45);
      v = pow(v, 1.2);
      v = smoothstep(0.16, 0.92, v);
      return vec3(v);
    }
    vec3 texBars(vec2 uv){
      float band  = sin((uv.y*40.0) + uTime*0.8*uSpeed);
      band        = smoothstep(-0.2, 0.8, band);
      float drift = fbm(uv*1.5 + vec2(uShift.x*0.4, uTime*0.05*uSpeed));
      return vec3(clamp(band*0.65 + drift*0.55, 0.0, 1.0));
    }
    vec3 texCells(vec2 uv){
      vec2 q = uv*4.0 + vec2(uShift.x*1.6, uTime*0.04*uSpeed);
      float c = 1.0 - cells(q);
      c = pow(c, 1.6);
      return vec3(c);
    }
    vec3 procTex(vec2 uv){
      if (uTex==0) return texNoise(uv);
      if (uTex==1) return texBars(uv);
      return texCells(uv);
    }

    void main(){
      vec2 p  = ndc(vUv);
      vec2 pm = p + vec2(uShift.x*0.04, 0.0) - uHoverPos * (uHover * 0.85);
      float m = getMask(pm);
      // Homepage fill mode: ignore the irregular blob mask and fill the
      // whole (CSS-rounded) canvas as one clean circle.
      m = mix(m, 1.0, uFillCircle);

      // Procedural placeholder ── only this gets the light-mode pink wash
      vec3 proc = procTex(vUv);
      vec3 procInv  = 1.0 - proc;
      float procInk = (procInv.r + procInv.g + procInv.b) / 3.0;
      vec3 procWash = mix(vec3(0.97, 0.92, 0.95), vec3(0.42, 0.18, 0.48), procInk);
      proc = mix(proc, procWash, uInvert);

      // Real video texture ── shown as-is (no inversion, no wash).
      // Cover-fit: scale UV so the rectangular video fills the square
      // (=circular) canvas without letterbox bars. For a 16:9 source,
      // we crop the sides; for a portrait source, we crop top/bottom.
      vec2 vidUv = vUv + vec2(uShift.x*0.06, 0.0);
      float coverX = max(uVideoAspect, 1.0);   // > 1 when video is wider than canvas
      float coverY = min(uVideoAspect, 1.0);   // < 1 when video is taller than canvas
      vidUv.x = 0.5 + (vidUv.x - 0.5) / coverX;
      vidUv.y = 0.5 + (vidUv.y - 0.5) * coverY;
      vec3 vid   = texture2D(uVideo, vidUv).rgb;

      // Final color: procedural until video kicks in
      vec3 col = mix(proc, vid, uVideoMode);

      // Film grain only on the procedural placeholder
      col += (hash(vUv*1000.0 + uTime) - 0.5) * 0.04 * (1.0 - uVideoMode);

      // Accent tint (off by default)
      col = mix(col, col*uAccent, uAccentOn);

      // Very subtle vignette
      float r = length(p);
      col *= 0.94 + 0.06*(1.0 - smoothstep(0.0, 0.45, r));

      // Homepage flat-color placeholder (only when no video is playing)
      vec3 flatFill = mix(
        vec3(0.88, 0.88, 0.92),   // dark theme  → soft pearl
        vec3(0.48, 0.22, 0.52),   // light theme → muted purple
        uInvert
      );
      col = mix(col, flatFill, uFillCircle * (1.0 - uVideoMode));

      gl_FragColor = vec4(col, m);
    }
  `;

  const mat  = new THREE.ShaderMaterial({
    vertexShader: vertSrc,
    fragmentShader: fragSrc,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    uniforms.uRes.value.set(w, h);
  }
  window.addEventListener('resize', resize);
  resize();

  /* ── Horizontal scroll → shader uShift.x ── */
  const scroller = document.querySelector('.p-top');
  let maxX = 0;
  function measure() {
    if (!scroller) return;
    maxX = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  }
  window.addEventListener('resize', measure);
  setTimeout(measure, 80);
  setTimeout(measure, 600);

  let current = 0, target = 0;
  if (scroller) {
    scroller.addEventListener('scroll', () => {
      target = Math.min(scroller.scrollLeft, maxX);
    }, { passive: true });
  }

  let t0 = performance.now();
  function tick(now) {
    const dt = (now - t0) / 1000; t0 = now;
    current += (target - current) * Math.min(1, dt * 9);
    const sx = maxX > 0 ? current / maxX : 0;
    uniforms.uShift.value.x = sx;
    uniforms.uTime.value    = now / 1000;
    uniforms.uSpeed.value   = state.speed;

    // Ease hover position + strength toward target
    const k = Math.min(1, dt * 7);
    hoverCurrent.x  += (hoverTarget.x  - hoverCurrent.x)  * k;
    hoverCurrent.y  += (hoverTarget.y  - hoverCurrent.y)  * k;
    hoverCurrent.on += (hoverTarget.on - hoverCurrent.on) * Math.min(1, dt * 4);
    uniforms.uHoverPos.value.set(hoverCurrent.x, hoverCurrent.y);
    uniforms.uHover.value = hoverCurrent.on;

    if (videoTex) videoTex.needsUpdate = true;
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  /* ── Hover follow: water-droplet leans toward the hovered menu item ── */
  const hoverTarget = { x: 0, y: 0, on: 0 };
  const hoverCurrent = { x: 0, y: 0, on: 0 };

  function bindMenuHover() {
    document.querySelectorAll('.menu-item__link, .top_nav a').forEach((a) => {
      if (a.dataset.hoverBound) return;
      a.dataset.hoverBound = '1';
      a.addEventListener('mouseenter', () => {
        const r = a.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const w = window.innerWidth, h = window.innerHeight;
        const aspect = w / h;
        // viewport → NDC (y up positive). Match shader's ndc(uv) which scales x by aspect.
        hoverTarget.x = ((cx / w) - 0.5) * aspect;
        hoverTarget.y = -((cy / h) - 0.5);
        hoverTarget.on = 1;
        // tiny vertical nudge for life — same as before
        uniforms.uShift.value.y = 0.04;
        a.classList.add('is-hover');
      });
      a.addEventListener('mouseleave', () => {
        hoverTarget.on = 0;
        uniforms.uShift.value.y = 0.0;
        a.classList.remove('is-hover');
      });
    });
  }
  bindMenuHover();
  // Re-bind if menu DOM changes after this script (defensive)
  setTimeout(bindMenuHover, 600);
  // Expose so the menu builder can rebind after re-rendering (lang switch)
  window.fcgRebindMenuHover = bindMenuHover;

  /* ── Tweaks ── */
  function applyTweaks() {
    uniforms.uMask.value = ({ blob: 0, strip: 1, lens: 2, shard: 3 })[state.mask] ?? 0;
    uniforms.uTex.value  = ({ noise: 0, bars: 1, cells: 2 })[state.tex] ?? 0;
    const accents = {
      none:  [1, 1, 1],
      cyan:  [0.5, 0.95, 1.05],
      amber: [1.10, 0.85, 0.55],
      green: [0.5, 1.05, 0.7]
    };
    const a = accents[state.accent] || [1, 1, 1];
    uniforms.uAccent.value.set(a[0], a[1], a[2]);
    uniforms.uAccentOn.value = state.accent === 'none' ? 0.0 : 0.65;
  }
  window.__fcgApplyTweaks = applyTweaks;
  applyTweaks();

  /* ── Video swap API ──
     fcgSetVideo('/path/to/file.mp4')           → use VideoTexture (looping)
     fcgSetVideo('…', { loop: false, onEnded }) → play once, then callback
     fcgSetVideo(null)                          → revert to procedural shader
  */
  /* Smooth crossfade: dim the canvas to a trough, swap source AT the trough
     (so the new clip's first frame doesn't pop in), then restore. Synced
     with the .lens-stage__img::after image-fade (also 1.5s) so the user
     sees the lens face and video transition as one continuous beat. */
  const DIP_DOWN_MS = 750;
  const DIP_UP_MS   = 750;
  const DIP_LOW     = '0.16';

  function smoothSwap(swapFn, quick) {
    const cc = document.getElementById('canvasContainer');
    if (!cc) { swapFn(); return; }
    // quick = fast montage crossfade (playlist advance); slow = dramatic
    // 0.75s dip that syncs with the 1.5s lens-face cross-fade.
    const down = quick ? 200 : DIP_DOWN_MS;
    const up   = quick ? 200 : DIP_UP_MS;
    const low  = quick ? '0.34' : DIP_LOW;
    // Phase 1: dim down
    cc.style.transition = 'opacity ' + (down / 1000) + 's cubic-bezier(0.4, 0, 0.2, 1)';
    cc.style.opacity = low;
    clearTimeout(cc._fcgRestore);
    // Phase 2: swap texture at the trough, then restore
    cc._fcgRestore = setTimeout(() => {
      swapFn();
      cc.style.transition = 'opacity ' + (up / 1000) + 's cubic-bezier(0.4, 0, 0.2, 1)';
      cc.style.opacity = '1';
    }, down);
  }

  function performVideoSwap(src, opts) {
    if (videoEl) {
      videoEl.pause();
      videoEl.onended = null;
      videoEl.removeAttribute('src');
      videoEl.load();
      videoEl = null;
    }
    if (videoTex) {
      videoTex.dispose();
      videoTex = null;
    }
    if (!src) {
      uniforms.uVideo.value     = fallbackTex;
      uniforms.uVideoMode.value = 0.0;
      state.videoSrc = null;
      return;
    }
    videoEl = document.createElement('video');
    // iOS Safari is strict: `playsinline` MUST be an HTML attribute, not
    // just a JS property; same goes for muted/autoplay. Set both forms.
    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('webkit-playsinline', '');
    videoEl.setAttribute('muted', '');
    videoEl.setAttribute('autoplay', '');
    videoEl.setAttribute('preload', 'auto');
    videoEl.muted       = true;
    videoEl.defaultMuted = true;
    videoEl.playsInline = true;
    videoEl.loop        = opts.loop !== false;
    videoEl.autoplay    = true;
    videoEl.preload     = 'auto';
    videoEl.disableRemotePlayback = true;
    if (/^https?:\/\//i.test(src)) videoEl.crossOrigin = 'anonymous';
    videoEl.src = src;
    if (typeof opts.onEnded === 'function') {
      videoEl.addEventListener('ended', opts.onEnded);
    }
    videoEl.addEventListener('error', () => {
      console.warn('[fcg] video failed to load:', src, videoEl.error);
    });
    videoEl.addEventListener('loadeddata', () => {
      console.log('[fcg] video loaded:', src, videoEl.videoWidth + 'x' + videoEl.videoHeight);
      if (videoEl.videoWidth && videoEl.videoHeight) {
        uniforms.uVideoAspect.value = videoEl.videoWidth / videoEl.videoHeight;
      }
    });
    videoEl.addEventListener('loadedmetadata', () => {
      if (videoEl.videoWidth && videoEl.videoHeight) {
        uniforms.uVideoAspect.value = videoEl.videoWidth / videoEl.videoHeight;
      }
    });
    videoEl.play().catch((err) => {
      console.warn('[fcg] video autoplay blocked:', src, err);
    });
    videoTex = new THREE.VideoTexture(videoEl);
    videoTex.minFilter = THREE.LinearFilter;
    videoTex.magFilter = THREE.LinearFilter;
    uniforms.uVideo.value     = videoTex;
    uniforms.uVideoMode.value = 1.0;
    state.videoSrc = src;
  }

  window.fcgSetVideo = function (src, opts) {
    opts = opts || {};
    const isFirstLoad = !videoEl;
    if (isFirstLoad) {
      // No dim needed — the canvas is still in its intro fade-in window.
      performVideoSwap(src, opts);
    } else {
      smoothSwap(() => performVideoSwap(src, opts), opts.quick);
    }
  };

  // ── Timed playlist: advance to the next clip every `intervalMs` and
  //    loop. Used by the AI-Film (5s) and Cross-border (3s) montages.
  //    Quick crossfade between clips (no lens-face change). ──
  let _fcgPlTimer = null;
  window.fcgStopPlaylist = function () {
    if (_fcgPlTimer) { clearInterval(_fcgPlTimer); _fcgPlTimer = null; }
  };
  window.fcgPlaylistTimed = function (urls, intervalMs) {
    window.fcgStopPlaylist();
    if (!urls || urls.length === 0) return;
    let idx = 0;
    window.fcgSetVideo(urls[0], { loop: true, quick: true });
    if (urls.length === 1) return;
    _fcgPlTimer = setInterval(() => {
      idx = (idx + 1) % urls.length;
      window.fcgSetVideo(urls[idx], { loop: true, quick: true });
    }, intervalMs);
  };

  // ── Play a single looping clip (stops any running playlist first). ──
  window.fcgPlayOne = function (url, opts) {
    window.fcgStopPlaylist();
    window.fcgSetVideo(url, Object.assign({ loop: true }, opts || {}));
  };

  // Back-compat shim (older callers)
  window.fcgCycleVideos = function (urls) {
    if (urls && urls.length === 1) window.fcgPlayOne(urls[0]);
    else window.fcgPlaylistTimed(urls, 6000);
  };

  // Auto-load from default if specified
  if (state.videoSrc) window.fcgSetVideo(state.videoSrc);

  // ── Homepage: fill the circular viewport + start the demo playlist ──
  if (document.documentElement.classList.contains('is-home')) {
    uniforms.uFillCircle.value = 1.0;

    // Hero loop clips, hosted on Supabase Storage (bucket: fcg-videos).
    const CDN = 'https://main-api.the-moon.biz/storage/v1/object/public/fcg-videos';
    const DEFAULT_VIDEO = CDN + '/windswept.mp4';
    window.FCG_DEFAULT_VIDEO = DEFAULT_VIDEO;

    // AI Film montage (top zone) — 3 clips, 5s each.
    const AIFILM = [1, 2, 3].map((n) => CDN + '/aifilm-' + n + '.mp4');
    // Cross-border montage (bottom zone) — 20 clips, 3s each.
    const CROSSBORDER = [];
    for (let n = 1; n <= 20; n++) {
      CROSSBORDER.push(CDN + '/cb-' + String(n).padStart(2, '0') + '.mp4');
    }
    // Vertical Short Drama montage (rb zone) — 6 clips from 日本短剧, 5s each.
    const VERTICAL = [1, 2, 3, 4, 5, 6].map((n) => CDN + '/vsd-' + n + '.mp4');

    /* Hot-zone behaviour map, keyed by the data-svc attribute.
       lensC=true  → flip the engraved lens face to image C (lens-services)
       lensC=false → keep image A (the default face)                       */
    const ZONES = {
      film:        { kind: 'playlist', urls: AIFILM,      interval: 5000, lensC: false },
      consulting:  { kind: 'single',   url: CDN + '/svc-consulting2.mp4', lensC: false },
      crossborder: { kind: 'playlist', urls: CROSSBORDER, interval: 3000, lensC: false },
      commercial:  { kind: 'single',   url: CDN + '/svc-commercial2.mp4', lensC: true  },
      vertical:    { kind: 'playlist', urls: VERTICAL,    interval: 5000, lensC: true  }
    };
    window.FCG_ZONES = ZONES;

    // Start the default reel (single looping clip, image A face).
    window.fcgPlayOne(DEFAULT_VIDEO);

    // Bind lens hotzones (this script runs at end of <body>).
    const hotzones = document.querySelectorAll('.lens-hot');
    let restoreTimer = null;
    let hoverActive = false;
    hotzones.forEach((btn) => {
      const key = btn.getAttribute('data-svc');
      const cfg = ZONES[key];
      if (!cfg) return;
      btn.addEventListener('mouseenter', () => {
        hoverActive = true;
        if (restoreTimer) { clearTimeout(restoreTimer); restoreTimer = null; }
        // Lens face: only commercial / vertical flip to image C.
        document.body.classList.toggle('is-lens-services', !!cfg.lensC);
        if (cfg.kind === 'playlist') {
          window.fcgPlaylistTimed(cfg.urls, cfg.interval);
        } else {
          // quick crossfade when the face stays on A; slow dip (synced with
          // the 1.5s lens cross-fade) when flipping to C.
          window.fcgPlayOne(cfg.url, { quick: !cfg.lensC });
        }
      });
      btn.addEventListener('mouseleave', () => {
        hoverActive = false;
        // small delay so dragging across two adjacent zones doesn't reset
        restoreTimer = setTimeout(() => {
          if (!hoverActive) {
            document.body.classList.remove('is-lens-services');
            window.fcgPlayOne(DEFAULT_VIDEO, { quick: true });
          }
        }, 250);
      });
    });
  }

  // ── Theme sync: respond to light/dark toggle from main.js ──
  window.addEventListener('fcg:theme', (e) => {
    uniforms.uInvert.value = e.detail && e.detail.light ? 1.0 : 0.0;
  });
  // Pick up the initial state synchronously too (in case the event fired before
  // this script attached its listener).
  if (document.body.classList.contains('is-light')) uniforms.uInvert.value = 1.0;
})();
