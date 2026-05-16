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
    uInvert:    { value: 0 }                        // 0 = dark theme, 1 = light theme
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
      // Shift the mask origin toward the hovered menu item (uHoverPos in NDC).
      // 0.85 = under-pull so it leans toward but doesn't fully sit on the item.
      vec2 pm = p + vec2(uShift.x*0.04, 0.0) - uHoverPos * (uHover * 0.85);
      float m = getMask(pm);

      vec3 proc = procTex(vUv);
      vec2 vidUv = vUv + vec2(uShift.x*0.06, 0.0);
      vec3 vid  = texture2D(uVideo, vidUv).rgb;
      vec3 col  = mix(proc, vid, uVideoMode);

      // film grain
      col += (hash(vUv*1000.0 + uTime) - 0.5) * 0.05;

      // accent tint (off by default → strictly monochrome)
      col = mix(col, col*uAccent, uAccentOn);

      // gentle edge falloff
      float r = length(p);
      col *= 0.85 + 0.18*(1.0 - smoothstep(0.0, 0.45, r));

      // Light-theme invert: paint the blob as a pink/purple watercolor wash
      // instead of plain inverted grayscale (matches the OBSIDIAN reference).
      vec3 invCol  = 1.0 - col;
      float ink    = (invCol.r + invCol.g + invCol.b) / 3.0;
      vec3 paleHi  = vec3(0.97, 0.92, 0.95);  // near-white pink at low ink
      vec3 deepLo  = vec3(0.42, 0.18, 0.48);  // deep magenta-purple at high ink
      vec3 lightTinted = mix(paleHi, deepLo, ink);
      col = mix(col, lightTinted, uInvert);
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
     fcgSetVideo('/path/to/file.mp4')  → use VideoTexture
     fcgSetVideo(null)                 → revert to procedural shader
  */
  window.fcgSetVideo = function (src) {
    if (videoEl) {
      videoEl.pause();
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
    videoEl.src         = src;
    videoEl.crossOrigin = 'anonymous';
    videoEl.loop        = true;
    videoEl.muted       = true;
    videoEl.playsInline = true;
    videoEl.autoplay    = true;
    videoEl.play().catch(() => { /* iOS may need a user gesture */ });
    videoTex = new THREE.VideoTexture(videoEl);
    videoTex.minFilter = THREE.LinearFilter;
    videoTex.magFilter = THREE.LinearFilter;
    videoTex.format    = THREE.RGBFormat;
    uniforms.uVideo.value     = videoTex;
    uniforms.uVideoMode.value = 1.0;
    state.videoSrc = src;
  };

  // Auto-load from default if specified
  if (state.videoSrc) window.fcgSetVideo(state.videoSrc);

  // ── Theme sync: respond to light/dark toggle from main.js ──
  window.addEventListener('fcg:theme', (e) => {
    uniforms.uInvert.value = e.detail && e.detail.light ? 1.0 : 0.0;
  });
  // Pick up the initial state synchronously too (in case the event fired before
  // this script attached its listener).
  if (document.body.classList.contains('is-light')) uniforms.uInvert.value = 1.0;
})();
