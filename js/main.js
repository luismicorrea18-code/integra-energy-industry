(function () {
  'use strict';

  // ===== Year in footer =====
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ===== Hero Scroll Sequence — video-to-canvas Apple scrub =====
  (function initHeroSequence() {
    var section = document.getElementById('hero');
    var canvas  = document.getElementById('hero-canvas');
    var video   = document.getElementById('hero-video-src');
    if (!section || !canvas || !video) return;

    var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // prefers-reduced-motion: reposition video as classic autoplay background
    if (prefersReduced) {
      canvas.style.display = 'none';
      video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';
      video.setAttribute('autoplay', '');
      video.setAttribute('loop', '');
      video.play().catch(function () {});
      return;
    }

    var ctx = canvas.getContext('2d');
    var W = 0, H = 0;

    function resizeCanvas() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }

    // Cover-fill paint — same as object-fit: cover
    function paint() {
      if (video.readyState < 2) return;
      var vw = video.videoWidth, vh = video.videoHeight;
      if (!vw || !vh) return;
      var scale = Math.max(W / vw, H / vh);
      var w = vw * scale, h = vh * scale;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(video, (W - w) * 0.5, (H - h) * 0.5, w, h);
    }

    resizeCanvas();
    window.addEventListener('resize', function () { resizeCanvas(); paint(); }, { passive: true });

    // Reveal canvas once the first frame is decoded
    video.addEventListener('loadeddata', function () {
      paint();
      canvas.style.opacity = '1';
    });

    // Repaint whenever the video has finished seeking to a new position
    video.addEventListener('seeked', paint);

    // GSAP not available → fall back to classic autoplay
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
      video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';
      video.setAttribute('autoplay', '');
      video.setAttribute('loop', '');
      video.play().catch(function () {});
      canvas.style.display = 'none';
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    function setupScrub() {
      var dur = video.duration;
      if (!dur || isNaN(dur)) return;

      // proxy.t is scrubbed smoothly by GSAP (0.6 s lag = cinematic feel)
      var proxy = { t: 0 };
      gsap.to(proxy, {
        t: dur,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.6,
        },
        onUpdate: function () {
          // Clamp slightly before end to avoid blank last frame on some browsers
          video.currentTime = Math.min(proxy.t, dur - 0.05);
        },
      });
    }

    if (video.readyState >= 1) {
      setupScrub();
    } else {
      video.addEventListener('loadedmetadata', setupScrub);
    }
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
      offset: 100,
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
      'const vec4 lineColor = vec4(0.949, 0.655, 0.098, 1.0);', /* brand amber #F2A719 */
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
