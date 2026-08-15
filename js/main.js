(function () {
  'use strict';

  // ===== Year in footer =====
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ===== Hero Scroll Sequence — Apple-style scrub (video desktop / image frames mobile) =====
  (function initHeroSequence() {
    var section = document.getElementById('hero');
    var canvas  = document.getElementById('hero-canvas');
    var video   = document.getElementById('hero-video-src');
    if (!section || !canvas) return;

    var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var isTouchDevice  = window.matchMedia('(hover: none), (pointer: coarse)').matches;

    var ctx = canvas.getContext('2d');
    var W = 0, H = 0;

    function resizeCanvas() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }
    resizeCanvas();

    function activateFallback() {
      if (!video) return;
      canvas.style.display = 'none';
      video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:1;';
      video.removeAttribute('tabindex');
      video.setAttribute('autoplay', '');
      video.setAttribute('loop', '');
      video.play().catch(function () {});
    }

    if (prefersReduced) { activateFallback(); return; }

    // ===== MOBILE: local frame sequence (scroll-driven, identical effect to desktop) =====
    if (isTouchDevice) {
      if (video) { video.preload = 'none'; }

      var FRAMES = 24;
      var urls = [];
      for (var fi = 0; fi < FRAMES; fi++) {
        urls.push('/img/hero-frames/frame-' + (fi < 10 ? '0' + fi : '' + fi) + '.jpg');
      }

      var imgs   = new Array(FRAMES);
      var ready  = new Array(FRAMES);
      var shown  = false;
      var curIdx = 0;

      function drawImg(img) {
        if (!img || !img.naturalWidth) return;
        var iw = img.naturalWidth, ih = img.naturalHeight;
        var scale = Math.max(W / iw, H / ih);
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(img, (W - iw * scale) * 0.5, (H - ih * scale) * 0.5, iw * scale, ih * scale);
      }

      function revealCanvas() {
        if (!shown) { shown = true; canvas.style.opacity = '1'; }
      }

      function showFrame(idx) {
        curIdx = idx;
        if (ready[idx] && imgs[idx]) { revealCanvas(); drawImg(imgs[idx]); return; }
        for (var d = 1; d < FRAMES; d++) {
          var lo = idx - d, hi = idx + d;
          if (lo >= 0 && ready[lo] && imgs[lo]) { revealCanvas(); drawImg(imgs[lo]); return; }
          if (hi < FRAMES && ready[hi] && imgs[hi]) { revealCanvas(); drawImg(imgs[hi]); return; }
        }
      }

      function loadAt(i) {
        var img = new Image();
        img.onload = function () {
          imgs[i] = img; ready[i] = true;
          if (!shown) { revealCanvas(); drawImg(img); }
          if (i === curIdx) { revealCanvas(); drawImg(img); }
        };
        img.onerror = function () { ready[i] = true; };
        img.src = urls[i];
      }

      for (var li = 0; li < FRAMES; li++) { loadAt(li); }

      var mRaf = false;
      function onMobileScroll() {
        var scrolled = Math.max(0, window.scrollY - section.offsetTop);
        var total    = section.offsetHeight - window.innerHeight;
        var p        = total > 0 ? Math.min(1, scrolled / total) : 0;
        showFrame(Math.min(FRAMES - 1, Math.round(p * (FRAMES - 1))));
      }

      window.addEventListener('scroll', function () {
        if (!mRaf) { mRaf = true; requestAnimationFrame(function () { onMobileScroll(); mRaf = false; }); }
      }, { passive: true });
      window.addEventListener('resize', function () { resizeCanvas(); onMobileScroll(); }, { passive: true });
      window.addEventListener('orientationchange', function () {
        setTimeout(function () { resizeCanvas(); onMobileScroll(); }, 300);
      });
      onMobileScroll();

      setTimeout(function () { if (!shown) activateFallback(); }, 8000);
      return;
    }

    // ===== DESKTOP: GSAP ScrollTrigger video canvas scrub =====
    if (!video) return;
    var canvasRevealed = false;
    video.crossOrigin = 'anonymous';

    function paint() {
      if (video.readyState < 2) return;
      var vw = video.videoWidth, vh = video.videoHeight;
      if (!vw || !vh) return;
      try {
        var scale = Math.max(W / vw, H / vh);
        var w = vw * scale, h = vh * scale;
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(video, (W - w) * 0.5, (H - h) * 0.5, w, h);
        if (!canvasRevealed) { canvasRevealed = true; canvas.style.opacity = '1'; }
      } catch (e) { activateFallback(); }
    }

    window.addEventListener('resize', function () { resizeCanvas(); paint(); }, { passive: true });
    video.addEventListener('loadeddata', function () { paint(); });
    video.addEventListener('seeked', paint);

    var fallbackTimer = setTimeout(function () {
      if (!canvasRevealed) activateFallback();
    }, 5000);
    video.addEventListener('loadeddata', function () { clearTimeout(fallbackTimer); });
    video.addEventListener('error', function () { clearTimeout(fallbackTimer); activateFallback(); });

    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
      clearTimeout(fallbackTimer); activateFallback(); return;
    }
    gsap.registerPlugin(ScrollTrigger);

    // Refresh after all assets load so pin calculations use final layout
    window.addEventListener('load', function () { ScrollTrigger.refresh(); }, { once: true });

    // Debounced refresh on resize (address-bar hide/show changes innerHeight on mobile)
    var _stTimer;
    window.addEventListener('resize', function () {
      clearTimeout(_stTimer);
      _stTimer = setTimeout(function () { ScrollTrigger.refresh(); }, 200);
    }, { passive: true });
    window.addEventListener('orientationchange', function () {
      setTimeout(function () { ScrollTrigger.refresh(); }, 400);
    });

    function setupScrub() {
      var dur = video.duration;
      if (!dur || isNaN(dur)) return;
      var proxy = { t: 0 };
      gsap.to(proxy, {
        t: dur, ease: 'none',
        scrollTrigger: {
          trigger: section, start: 'top top', end: 'bottom bottom', scrub: 0.6,
        },
        onUpdate: function () { video.currentTime = Math.min(proxy.t, dur - 0.05); },
      });
    }

    if (video.readyState >= 1) { setupScrub(); }
    else { video.addEventListener('loadedmetadata', setupScrub); }
  })();

  // ===== Hero Cinematic — FULLY scroll-driven, reversible =====
  (function initHeroCinematic() {
    var heroSection  = document.getElementById('hero');
    var heroH1       = document.getElementById('hero-h1');
    var subWrap      = document.getElementById('hero-sub-wrap');
    var ctaPrimary   = document.getElementById('hero-cta-primary');
    var ctaGhost     = document.getElementById('hero-cta-ghost');
    var scrollHint   = document.querySelector('.hero-scroll-hint');
    var navItems     = document.querySelectorAll('.nav-anim');
    if (!heroSection) return;

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var isMobile = window.matchMedia('(max-width: 1023px)').matches;
    var words = heroH1 ? heroH1.querySelectorAll('.hero-word') : [];

    // Reduced-motion: show everything immediately, no scroll binding
    if (reduced) {
      navItems.forEach(function(el) { el.style.cssText='opacity:1;transform:none;filter:none'; });
      words.forEach(function(w) { w.style.opacity='1'; w.style.transform='none'; w.style.filter='none'; });
      if (subWrap)    { subWrap.style.cssText='opacity:1;transform:none;filter:none'; }
      if (ctaPrimary) { ctaPrimary.style.cssText='opacity:1;transform:none'; }
      if (ctaGhost)   { ctaGhost.style.cssText='opacity:1;transform:none'; }
      return;
    }

    // --- Helpers ---
    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function phase(p, s, e) { return clamp01((p - s) / (e - s)); }
    function easeOut3(t) { return 1 - Math.pow(1 - t, 3); }
    function easeOut4(t) { return 1 - Math.pow(1 - t, 4); }
    function easeBack(t) {
      var c1 = 1.55, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }

    var totalScroll    = heroSection.offsetHeight - window.innerHeight;
    var accentRevealed = false;

    // --- Scroll Handler ---
    function onScroll() {
      var scrolled = Math.max(0, window.scrollY - heroSection.offsetTop);
      var p = totalScroll > 0 ? clamp01(scrolled / totalScroll) : 0;

      // === SCROLL HINT: fades out as user starts scrolling ===
      if (scrollHint) scrollHint.style.opacity = (1 - clamp01(p / 0.04)).toFixed(3);

      // === NAV ITEMS — staggered from top (scroll 0% → 14%, per item offset 1.2%) ===
      navItems.forEach(function(el, i) {
        // Logo always visible on mobile — skip animation
        if (isMobile && el.getAttribute('href') === '#hero') {
          el.style.opacity = '1'; el.style.transform = 'none'; el.style.filter = 'none';
          return;
        }
        var pStart = i * 0.012;
        var pEnd   = pStart + 0.10;
        var pn = easeOut3(phase(p, pStart, pEnd));
        el.style.opacity   = pn.toFixed(3);
        el.style.transform = 'translateY(' + Math.round((1-pn)*-14) + 'px)';
        el.style.filter    = isMobile ? 'none' : 'blur(' + Math.round((1-pn)*6) + 'px)';
      });

      // === PHASE 1 — Title words (scroll 0% → 22%) staggered ===
      // Each word occupies an overlapping 14% window, offset by 5% per word
      words.forEach(function(word, i) {
        var pStart = i * 0.055;          // 0 / 0.055 / 0.11
        var pEnd   = pStart + 0.16;      // 0.16 / 0.215 / 0.27
        var pw = easeOut4(phase(p, pStart, pEnd));
        word.style.opacity   = pw.toFixed(3);
        word.style.transform = isMobile
          ? 'translateY(' + Math.round((1-pw)*78) + 'px)'
          : 'translateY(' + Math.round((1-pw)*78) + 'px) rotateX(' + Math.round((1-pw)*22) + 'deg)';
        word.style.filter    = isMobile ? 'none' : 'blur(' + Math.round((1-pw)*14) + 'px)';
        // Add shimmer class to accent word once revealed
        if (i === 2 && pw > 0.9 && !accentRevealed) {
          accentRevealed = true;
          word.classList.add('is-revealed');
        }
        if (i === 2 && pw < 0.5) {
          accentRevealed = false;
          word.classList.remove('is-revealed');
        }
      });

      // === PHASE 2 — Subtitle (scroll 24% → 56%) — same feel as title words ===
      var p2 = easeOut3(phase(p, 0.24, 0.56));
      if (subWrap) {
        subWrap.style.opacity   = p2.toFixed(3);
        subWrap.style.transform = 'translateY(' + Math.round((1-p2)*72) + 'px)';
        subWrap.style.filter    = isMobile ? 'none' : 'blur(' + Math.round((1-p2)*10) + 'px)';
        subWrap.style.clipPath  = 'none';
      }

      // === PHASE 3 — CTA primary slides in from left (scroll 54% → 70%) ===
      var p3 = easeBack(phase(p, 0.54, 0.70));
      if (ctaPrimary) {
        ctaPrimary.style.opacity   = clamp01(p3 * 1.3).toFixed(3);
        ctaPrimary.style.transform = 'translateX('+Math.round((1-p3)*-44)+'px) scale('+(0.88+p3*0.12).toFixed(3)+')';
      }

      // === PHASE 4 — CTA ghost slides in from right (scroll 60% → 76%) ===
      var p4 = easeBack(phase(p, 0.60, 0.76));
      if (ctaGhost) {
        ctaGhost.style.opacity   = clamp01(p4 * 1.3).toFixed(3);
        ctaGhost.style.transform = 'translateX('+Math.round((1-p4)*44)+'px) scale('+(0.88+p4*0.12).toFixed(3)+')';
      }
    }

    // rAF throttle — syncs updates to display refresh (critical for mobile smoothness)
    var rafPending = false;
    function scheduleScroll() {
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(function() { onScroll(); rafPending = false; });
      }
    }
    window.addEventListener('scroll', scheduleScroll, { passive: true });

    function recalcTotalScroll() {
      isMobile = window.matchMedia('(max-width: 1023px)').matches;
      totalScroll = heroSection.offsetHeight - window.innerHeight;
    }
    window.addEventListener('resize', recalcTotalScroll, { passive: true });
    window.addEventListener('orientationchange', function() {
      setTimeout(recalcTotalScroll, 300);
    });
    // Re-measure after fonts and images settle — ensures totalScroll is accurate
    window.addEventListener('load', function () { recalcTotalScroll(); onScroll(); }, { once: true });
    onScroll(); // run once immediately for correct initial state
  })();

  // ===== Header state on scroll =====
  var header = document.getElementById('header');
  function updateHeaderState() {
    if (!header) return;
    header.dataset.state = window.scrollY > 40 ? 'scrolled' : 'top';
  }
  updateHeaderState();
  window.addEventListener('scroll', updateHeaderState, { passive: true });

  // ===== Mobile menu toggle =====
  var menuToggle = document.getElementById('menu-toggle');
  var mobileMenu = document.getElementById('mobile-menu');
  var iconMenu = document.getElementById('icon-menu');
  var iconClose = document.getElementById('icon-close');

  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', function () {
      var isOpen = !mobileMenu.classList.contains('hidden');
      mobileMenu.classList.toggle('hidden');
      iconMenu.classList.toggle('hidden');
      iconClose.classList.toggle('hidden');
      menuToggle.setAttribute('aria-expanded', String(!isOpen));
      menuToggle.setAttribute('aria-label', isOpen ? 'Abrir menú de navegación' : 'Cerrar menú de navegación');
    });

    mobileMenu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mobileMenu.classList.add('hidden');
        iconMenu.classList.remove('hidden');
        iconClose.classList.add('hidden');
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ===== Initialize AOS Animation Library =====
  if (typeof AOS !== 'undefined') {
    AOS.init({
      once: true,
      duration: 800,
      offset: window.innerWidth < 640 ? 40 : 100,
      easing: 'ease-out-cubic',
    });
  }

  // ===== Premium Glow Effect for Bento Cards =====
  var bentoCards = document.querySelectorAll('.bento-card');
  bentoCards.forEach(function(card) {
    card.addEventListener('mousemove', function(e) {
      var rect = card.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', x + 'px');
      card.style.setProperty('--mouse-y', y + 'px');
    });
  });

  // ===== Shader grid background (Sectores) =====
  (function initSectoresShader() {
    var canvas = document.getElementById('sectores-shader');
    if (!canvas) return;

    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return; // leave the section's dark background, no canvas draw needed

    var gl = canvas.getContext('webgl');
    if (!gl) return;

    var vsSource = [
      'attribute vec4 aVertexPosition;',
      'void main() {',
      '  gl_Position = aVertexPosition;',
      '}'
    ].join('\n');

    var fsSource = [
      'precision highp float;',
      'uniform vec2 iResolution;',
      'uniform float iTime;',
      '',
      'const float overallSpeed = 0.2;',
      'const float gridSmoothWidth = 0.015;',
      'const float axisWidth = 0.05;',
      'const float majorLineWidth = 0.025;',
      'const float minorLineWidth = 0.0125;',
      'const float majorLineFrequency = 5.0;',
      'const float minorLineFrequency = 1.0;',
      'const float scale = 5.0;',
      'const vec4 lineColor = vec4(0.961, 0.573, 0.118, 1.0);', /* brand orange #F5921E */
      'const float minLineWidth = 0.01;',
      'const float maxLineWidth = 0.2;',
      'const float lineSpeed = 1.0 * overallSpeed;',
      'const float lineAmplitude = 1.0;',
      'const float lineFrequency = 0.2;',
      'const float warpSpeed = 0.2 * overallSpeed;',
      'const float warpFrequency = 0.5;',
      'const float warpAmplitude = 1.0;',
      'const float offsetFrequency = 0.5;',
      'const float offsetSpeed = 1.33 * overallSpeed;',
      'const float minOffsetSpread = 0.6;',
      'const float maxOffsetSpread = 2.0;',
      'const int linesPerGroup = 16;',
      '',
      'float drawSmoothLine(float pos, float halfWidth, float t) {',
      '  return smoothstep(halfWidth, 0.0, abs(pos - t));',
      '}',
      'float drawCrispLine(float pos, float halfWidth, float t) {',
      '  return smoothstep(halfWidth + gridSmoothWidth, halfWidth, abs(pos - t));',
      '}',
      'float drawCircle(vec2 pos, float radius, vec2 coord) {',
      '  return smoothstep(radius + gridSmoothWidth, radius, length(coord - pos));',
      '}',
      '',
      'float random(float t) {',
      '  return (cos(t) + cos(t * 1.3 + 1.3) + cos(t * 1.4 + 1.4)) / 3.0;',
      '}',
      '',
      'float getPlasmaY(float x, float horizontalFade, float offset) {',
      '  return random(x * lineFrequency + iTime * lineSpeed) * horizontalFade * lineAmplitude + offset;',
      '}',
      '',
      'void main() {',
      '  vec2 fragCoord = gl_FragCoord.xy;',
      '  vec2 uv = fragCoord.xy / iResolution.xy;',
      '  vec2 space = (fragCoord - iResolution.xy / 2.0) / iResolution.x * 2.0 * scale;',
      '',
      '  float horizontalFade = 1.0 - (cos(uv.x * 6.28) * 0.5 + 0.5);',
      '  float verticalFade = 1.0 - (cos(uv.y * 6.28) * 0.5 + 0.5);',
      '',
      '  space.y += random(space.x * warpFrequency + iTime * warpSpeed) * warpAmplitude * (0.5 + horizontalFade);',
      '  space.x += random(space.y * warpFrequency + iTime * warpSpeed + 2.0) * warpAmplitude * horizontalFade;',
      '',
      '  vec4 lines = vec4(0.0);',
      '  vec4 bgColor1 = vec4(0.012, 0.043, 0.027, 1.0);', /* near brand ink #06120E */
      '  vec4 bgColor2 = vec4(0.027, 0.07, 0.05, 1.0);',
      '',
      '  for (int l = 0; l < linesPerGroup; l++) {',
      '    float normalizedLineIndex = float(l) / float(linesPerGroup);',
      '    float offsetTime = iTime * offsetSpeed;',
      '    float offsetPosition = float(l) + space.x * offsetFrequency;',
      '    float rand = random(offsetPosition + offsetTime) * 0.5 + 0.5;',
      '    float halfWidth = mix(minLineWidth, maxLineWidth, rand * horizontalFade) / 2.0;',
      '    float offset = random(offsetPosition + offsetTime * (1.0 + normalizedLineIndex)) * mix(minOffsetSpread, maxOffsetSpread, horizontalFade);',
      '    float linePosition = getPlasmaY(space.x, horizontalFade, offset);',
      '    float line = drawSmoothLine(linePosition, halfWidth, space.y) / 2.0 + drawCrispLine(linePosition, halfWidth * 0.15, space.y);',
      '',
      '    float circleX = mod(float(l) + iTime * lineSpeed, 25.0) - 12.0;',
      '    vec2 circlePosition = vec2(circleX, getPlasmaY(circleX, horizontalFade, offset));',
      '    float circle = drawCircle(circlePosition, 0.01, space) * 4.0;',
      '',
      '    line = line + circle;',
      '    lines += line * lineColor * rand;',
      '  }',
      '',
      '  vec4 fragColor = mix(bgColor1, bgColor2, uv.x);',
      '  fragColor *= verticalFade;',
      '  fragColor.a = 1.0;',
      '  fragColor += lines * 0.85;',
      '',
      '  gl_FragColor = fragColor;',
      '}'
    ].join('\n');

    function loadShader(type, source) {
      var shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    var vertexShader = loadShader(gl.VERTEX_SHADER, vsSource);
    var fragmentShader = loadShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vertexShader || !fragmentShader) return;

    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    var positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    var aVertexPosition = gl.getAttribLocation(program, 'aVertexPosition');
    var uResolution = gl.getUniformLocation(program, 'iResolution');
    var uTime = gl.getUniformLocation(program, 'iTime');

    function resizeCanvas() {
      var rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener('resize', resizeCanvas, { passive: true });
    resizeCanvas();

    var startTime = Date.now();
    var rafId = null;
    var isVisible = false;

    function render() {
      var currentTime = (Date.now() - startTime) / 1000;
      gl.useProgram(program);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, currentTime);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(aVertexPosition, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(aVertexPosition);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      rafId = requestAnimationFrame(render);
    }

    // Only animate while the section is actually on screen (saves GPU/battery)
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !isVisible) {
            isVisible = true;
            render();
          } else if (!entry.isIntersecting && isVisible) {
            isVisible = false;
            if (rafId) cancelAnimationFrame(rafId);
          }
        });
      }, { threshold: 0.05 });
      observer.observe(canvas);
    } else {
      render();
    }
  })();

  // ===== Proof Metrics: circuit activation + counter animation =====
  (function initProofSection() {
    var section = document.querySelector('.proof-metrics');
    if (!section) return;

    var statEls = section.querySelectorAll('.stat-value[data-target]');

    var observer = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      observer.disconnect();

      // Trigger the SVG circuit draw animation
      section.classList.add('circuit-active');

      // Animated counters with ease-out cubic
      function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

      statEls.forEach(function (el, i) {
        var target = parseInt(el.dataset.target, 10);
        var duration = 1800;
        var delay = i * 140;

        setTimeout(function () {
          var startTime = null;
          function step(ts) {
            if (!startTime) startTime = ts;
            var p = Math.min((ts - startTime) / duration, 1);
            el.textContent = Math.round(easeOut(p) * target);
            if (p < 1) requestAnimationFrame(step);
          }
          requestAnimationFrame(step);
        }, delay);
      });
    }, { threshold: 0.25 });

    observer.observe(section);
  })();

  // ===== Scrollapp Service Cards =====
  (function initScrollCards() {
    var track = document.getElementById('services-track');
    if (!track) return;

    var progressBar = document.getElementById('scroll-progress-bar');
    var prevBtn = document.getElementById('scroll-prev');
    var nextBtn = document.getElementById('scroll-next');

    function updateProgress() {
      if (!progressBar) return;
      var maxScroll = track.scrollWidth - track.clientWidth;
      if (maxScroll <= 0) return;
      var pct = (track.scrollLeft / maxScroll) * 100;
      progressBar.style.width = Math.max(15, Math.min(100, pct)) + '%';
    }
    track.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();

    function scrollCards(dir) {
      var card = track.querySelector('.scroll-card');
      if (!card) return;
      var step = (card.offsetWidth + 18) * 2;
      track.scrollBy({ left: dir * step, behavior: 'smooth' });
    }
    if (prevBtn) prevBtn.addEventListener('click', function () { scrollCards(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { scrollCards(1); });

    // 3D tilt on hover
    track.querySelectorAll('.scroll-card').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transition = 'transform 0.08s ease, box-shadow 0.3s ease';
        card.style.transform = 'perspective(900px) rotateY(' + (x * 14) + 'deg) rotateX(' + (-y * 8) + 'deg) scale3d(1.03,1.03,1.03)';
        card.style.boxShadow = '0 20px 48px rgba(6,18,14,0.26)';
      });
      card.addEventListener('mouseleave', function () {
        card.style.transition = 'transform 0.5s ease, box-shadow 0.45s ease';
        card.style.transform = 'perspective(900px) rotateY(0deg) rotateX(0deg) scale3d(1,1,1)';
        card.style.boxShadow = '';
      });
    });

    // Drag-to-scroll for mouse users
    var isDragging = false;
    var startX = 0;
    var scrollStart = 0;
    track.addEventListener('mousedown', function (e) {
      isDragging = true;
      startX = e.pageX;
      scrollStart = track.scrollLeft;
    });
    window.addEventListener('mouseup', function () { isDragging = false; });
    window.addEventListener('mousemove', function (e) {
      if (!isDragging) return;
      track.scrollLeft = scrollStart - (e.pageX - startX);
    });
  })();

  // ===== Contact form (front-end only demo) =====
  var form = document.getElementById('contact-form');
  if (form) {
    var submitBtn = document.getElementById('submit-btn');
    var submitText = document.getElementById('submit-text');
    var submitSpinner = document.getElementById('submit-spinner');
    var successMsg = document.getElementById('form-success');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      submitBtn.disabled = true;
      submitText.textContent = 'Enviando...';
      submitSpinner.classList.remove('hidden');

      // NOTE: no backend wired yet — replace with a real submission endpoint.
      setTimeout(function () {
        submitBtn.disabled = false;
        submitText.textContent = 'Enviar solicitud';
        submitSpinner.classList.add('hidden');
        successMsg.classList.remove('hidden');
        form.reset();
      }, 900);
    });
  }

  // ===== Service cards — dark bento: grid + scan + tilt + spotlight =====
  (function initServiceCards() {
    var cards = document.querySelectorAll('#services-track .scroll-card');
    if (!cards.length) return;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    cards.forEach(function(card, i) {
      var numEl = card.querySelector('.scroll-card-num');
      var numTxt = numEl ? numEl.textContent.trim() : ('0' + (i+1));

      // 1. Fine grid texture
      var grid = document.createElement('div');
      grid.className = 'sc-grid';
      grid.setAttribute('aria-hidden','true');
      card.appendChild(grid);

      // 2. Ghost number watermark
      var ghost = document.createElement('div');
      ghost.className = 'sc-ghost-num';
      ghost.setAttribute('aria-hidden','true');
      ghost.textContent = numTxt;
      card.appendChild(ghost);

      // 3. Corner brackets
      ['tl','tr','bl','br'].forEach(function(pos) {
        var c = document.createElement('span');
        c.className = 'sc-corner sc-corner--' + pos;
        c.setAttribute('aria-hidden','true');
        card.appendChild(c);
      });

      // 4. Animated scan line (staggered)
      if (!reduced) {
        var scan = document.createElement('div');
        scan.className = 'sc-scan-line';
        scan.setAttribute('aria-hidden','true');
        card.appendChild(scan);
        var delay = i * 0.9;
        scan.style.animationName = 'sc-scan';
        scan.style.animationDuration = '5s';
        scan.style.animationDelay = delay + 's';
        scan.style.animationTimingFunction = 'ease-in-out';
        scan.style.animationIterationCount = 'infinite';
      }
    });

    // Add sc-scan keyframes once to stylesheet
    if (!reduced) {
      var style = document.createElement('style');
      style.textContent =
        '@keyframes sc-scan{' +
        '0%{top:0%;opacity:0}' +
        '4%{opacity:0.85}' +
        '88%{opacity:0.4}' +
        '100%{top:100%;opacity:0}}';
      document.head.appendChild(style);
    }

    if (reduced) return;

    // 5. 3D tilt + spotlight + image parallax on mouse
    cards.forEach(function(card) {
      var img = card.querySelector('.scroll-card-img');

      card.addEventListener('mouseenter', function() {
        card.style.transition = 'box-shadow 0.4s ease, border-color 0.4s ease';
      });

      card.addEventListener('mousemove', function(e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width;
        var y = (e.clientY - r.top)  / r.height;

        card.style.setProperty('--cx', (x * 100) + '%');
        card.style.setProperty('--cy', (y * 100) + '%');

        var rx = (y - 0.5) * -10;
        var ry = (x - 0.5) *  10;
        card.style.transform =
          'perspective(900px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) scale3d(1.02,1.02,1.02)';

        if (img) {
          img.style.transform =
            'translate(' + ((x - 0.5) * -10) + 'px,' + ((y - 0.5) * -10) + 'px)';
        }
      });

      card.addEventListener('mouseleave', function() {
        card.style.transition =
          'transform 0.7s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.4s ease, border-color 0.4s ease';
        card.style.transform = '';
        card.style.setProperty('--cx', '50%');
        card.style.setProperty('--cy', '50%');
        if (img) {
          img.style.transition = 'transform 0.7s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease, filter 0.4s ease';
          img.style.transform = '';
          setTimeout(function() { img.style.transition = 'transform 0.08s linear, opacity 0.4s ease, filter 0.4s ease'; }, 700);
        }
        setTimeout(function() {
          card.style.transition = 'box-shadow 0.4s ease, border-color 0.4s ease';
        }, 700);
      });
    });
  })();

  // ===== Custom cursor — Antigravity style =====
  (function initCustomCursor() {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    var dot  = document.createElement('div'); dot.className  = 'cursor-dot';
    var ring = document.createElement('div'); ring.className = 'cursor-ring';
    document.body.appendChild(dot);
    document.body.appendChild(ring);

    var mx = -100, my = -100, rx = -100, ry = -100;

    document.addEventListener('mousemove', function(e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = 'translate(' + mx + 'px,' + my + 'px)';
    });

    (function lerp() {
      rx += (mx - rx) * 0.09;
      ry += (my - ry) * 0.09;
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px)';
      requestAnimationFrame(lerp);
    })();

    // Interactive hover states
    function bindHover(sel, cls) {
      document.querySelectorAll(sel).forEach(function(el) {
        el.addEventListener('mouseenter', function() { dot.classList.add(cls); ring.classList.add(cls); });
        el.addEventListener('mouseleave', function() { dot.classList.remove(cls); ring.classList.remove(cls); });
      });
    }
    bindHover('a, button, [role="button"], label, select', 'is-hover');
    bindHover('.sector-chip-dark', 'is-chip');
  })();

  // ===== Sector chips — magnetic + text scramble + auto-cycle =====
  (function initSectorChips() {
    var wrap = document.getElementById('sector-chips-wrap');
    if (!wrap) return;
    var chips = wrap.querySelectorAll('.sector-chip-dark');
    if (!chips.length) return;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---- Text scramble ----
    var CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@!';
    function scramble(el) {
      var orig = el.dataset.orig || el.textContent.trim();
      el.dataset.orig = orig;
      var frame = 0, total = orig.length * 2;
      clearInterval(el._iv);
      el._iv = setInterval(function() {
        el.textContent = orig.split('').map(function(c, i) {
          if (c === ' ') return ' ';
          if (i < Math.floor(frame / 2)) return orig[i];
          return CHARS[Math.floor(Math.random() * CHARS.length)];
        }).join('');
        frame++;
        if (frame > total) { el.textContent = orig; clearInterval(el._iv); }
      }, 30);
    }

    // ---- Magnetic effect ----
    chips.forEach(function(chip) {
      chip.addEventListener('mouseenter', function() {
        if (!reduced) scramble(chip);
      });
      chip.addEventListener('mousemove', function(e) {
        if (reduced) return;
        var r = chip.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width  / 2)) * 0.32;
        var dy = (e.clientY - (r.top  + r.height / 2)) * 0.32;
        chip.style.transition = 'transform 0.1s ease, box-shadow 0.35s ease, border-color 0.35s ease, background-color 0.35s ease, color 0.35s ease';
        chip.style.transform  = 'translate(' + dx + 'px,' + dy + 'px) scale(1.07)';
      });
      chip.addEventListener('mouseleave', function() {
        chip.style.transition = 'transform 0.55s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.35s ease, border-color 0.35s ease, background-color 0.35s ease, color 0.35s ease';
        chip.style.transform  = '';
        if (!reduced) scramble(chip);
      });
    });

    // ---- Auto-cycling glow ----
    if (reduced) return;
    var idx = 0;
    function startCycle() {
      chips[idx].classList.add('chip-active');
      setInterval(function() {
        chips[idx].classList.remove('chip-active');
        idx = (idx + 1) % chips.length;
        chips[idx].classList.add('chip-active');
      }, 2200);
    }
    var io = new IntersectionObserver(function(entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      setTimeout(startCycle, 500);
    }, { threshold: 0 });
    io.observe(wrap);
  })();

})();
