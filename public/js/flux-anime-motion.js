/**
 * Flux + anime.js v4 — SVG draw, scroll sync, cubicBezier / spring / waapi,
 * timelines, and task-complete exit (createLayout is not in the UMD build).
 * @see https://animejs.com/
 */
(function () {
  'use strict';

  /** @type {Array<{revert:()=>unknown}>} */
  let loginRevertibles = [];
  /** @type {Array<{revert:()=>unknown}>} */
  let appShellRevertibles = [];
  /** @type {Array<{revert:()=>unknown}>} */
  let appPanelRevertibles = [];
  let appShellAnimated = false;

  /** Custom “snap” curve (matches user-requested cubic-bezier) */
  let easeCelebrate = null;

  function lib() {
    return typeof anime !== 'undefined' ? anime : null;
  }

  function reducedMotion() {
    try {
      return matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_) {
      return false;
    }
  }

  function perfSnappy() {
    try {
      return document.documentElement.getAttribute('data-flux-perf') === 'on';
    } catch (_) {
      return false;
    }
  }

  function skipMotion() {
    return reducedMotion() || perfSnappy() || !lib();
  }

  function track(arr, obj) {
    if (obj && typeof obj.revert === 'function') arr.push(obj);
  }

  function revertAll(arr) {
    for (let i = arr.length - 1; i >= 0; i--) {
      try {
        arr[i].revert();
      } catch (_) {}
    }
    arr.length = 0;
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function unwrapFluxText(loginRoot) {
    if (!loginRoot) return;
    loginRoot.querySelectorAll('[data-flux-text-plain]').forEach(function (el) {
      const plain = el.getAttribute('data-flux-text-plain');
      if (plain !== null) el.textContent = plain;
      el.removeAttribute('data-flux-text-plain');
      el.removeAttribute('data-flux-word-wrap');
      el.removeAttribute('data-flux-char-wrap');
    });
  }

  function wrapWords(el) {
    if (!el || el.getAttribute('data-flux-word-wrap') === '1') return [];
    const raw = el.textContent.trim();
    if (!raw) return [];
    el.setAttribute('data-flux-text-plain', el.textContent);
    el.setAttribute('data-flux-word-wrap', '1');
    const parts = raw.split(/\s+/);
    el.innerHTML = parts
      .map(function (w) {
        return '<span class="flux-anim-word">' + escHtml(w) + '</span>';
      })
      .join(' ');
    return Array.prototype.slice.call(el.querySelectorAll('.flux-anim-word'));
  }

  function wrapChars(el) {
    if (!el || el.getAttribute('data-flux-char-wrap') === '1') return [];
    const raw = el.textContent;
    if (!raw) return [];
    el.setAttribute('data-flux-text-plain', raw);
    el.setAttribute('data-flux-char-wrap', '1');
    el.innerHTML = Array.from(raw)
      .map(function (ch) {
        if (ch === ' ') return '<span class="flux-anim-char">&nbsp;</span>';
        return '<span class="flux-anim-char">' + escHtml(ch) + '</span>';
      })
      .join('');
    return Array.prototype.slice.call(el.querySelectorAll('.flux-anim-char'));
  }

  function ensureEaseCelebrate(L) {
    if (easeCelebrate) return easeCelebrate;
    if (L.eases && typeof L.eases.cubicBezier === 'function') {
      easeCelebrate = L.eases.cubicBezier(1, 0.038, 0, 1.01);
    } else {
      easeCelebrate = 'out(3)';
    }
    return easeCelebrate;
  }

  function ensureLoginSvgLayer(loginRoot) {
    let el = document.getElementById('loginAnimeSvg');
    if (el) return el;
    const ns = 'http://www.w3.org/2000/svg';
    el = document.createElementNS(ns, 'svg');
    el.id = 'loginAnimeSvg';
    el.setAttribute('class', 'login-anime-layer');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('viewBox', '0 0 1200 800');
    el.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    const strokes = [
      { d: 'M-40,420 C180,280 320,520 520,380 S920,200 1240,340', c: 'rgba(0,194,255,0.38)' },
      { d: 'M60,720 C260,600 400,760 620,620 S980,480 1280,560', c: 'rgba(124,92,255,0.3)' },
      { d: 'M-20,180 C200,80 380,240 560,120 S880,-40 1180,100', c: 'rgba(34,255,136,0.22)' },
      { d: 'M200,800 C400,640 540,880 760,700 S1000,620 1220,780', c: 'rgba(0,194,255,0.26)' },
      { d: 'M-60,560 C140,440 300,600 480,500 S840,360 1160,480', c: 'rgba(192,132,252,0.28)' },
      { d: 'M400,-20 C520,120 680,80 820,200 S1080,320 1220,140', c: 'rgba(99,102,241,0.32)' },
      { d: 'M100,520 Q400,380 700,480 T1100,400', c: 'rgba(77,219,255,0.2)' },
      { d: 'M900,640 Q600,720 300,660', c: 'rgba(167,139,250,0.22)' }
    ];
    strokes.forEach(function (s) {
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', s.d);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', s.c);
      p.setAttribute('stroke-width', '1.15');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      el.appendChild(p);
    });
    const particles = document.getElementById('loginParticles');
    if (particles && particles.parentNode === loginRoot) {
      loginRoot.insertBefore(el, particles.nextSibling);
    } else {
      loginRoot.insertBefore(el, loginRoot.firstChild);
    }
    return el;
  }

  /**
   * Exit motion when a task is marked done (replaces createLayout leaveTo, which
   * is only in the ESM toolkit, not the CDN UMD bundle).
   */
  window.fluxAnimeOnTaskComplete = function (el, doneCb) {
    const L = lib();
    const finish = function () {
      try {
        doneCb();
      } catch (_) {}
    };
    if (!L || !el || typeof doneCb !== 'function') {
      finish();
      return;
    }
    let ended = false;
    function end() {
      if (ended) return;
      ended = true;
      finish();
    }
    const tmo = setTimeout(end, 720);
    try {
      const ease = ensureEaseCelebrate(L);
      const anim = L.animate(el, {
        translateY: [0, 22],
        scale: [1, 0.94],
        opacity: [1, 0.2],
        rotate: [0, -0.6],
        duration: 440,
        ease: ease,
        onComplete: function () {
          clearTimeout(tmo);
          end();
        }
      });
      if (anim && typeof anim.then === 'function') {
        anim.then(function () {
          clearTimeout(tmo);
          end();
        });
      }
    } catch (_) {
      clearTimeout(tmo);
      end();
    }
  };

  window.teardownFluxAnimeLogin = function () {
    revertAll(loginRevertibles);
    const svg = document.getElementById('loginAnimeSvg');
    if (svg) svg.remove();
    const lr = document.getElementById('loginScreen');
    if (lr) unwrapFluxText(lr);
  };

  window.initFluxAnimeLogin = function () {
    const L = lib();
    const loginRoot = document.getElementById('loginScreen');
    if (skipMotion() || !L || !loginRoot || !loginRoot.classList.contains('visible')) return;

    window.teardownFluxAnimeLogin();

    const easeSnap = ensureEaseCelebrate(L);

    const words = wrapWords(loginRoot.querySelector('.login-left-sub'));
    const chars = wrapChars(loginRoot.querySelector('.login-gradient-text'));

    try {
      if (words.length) {
        const wAnim = L.animate(words, {
          translateY: ['1.05rem', '0'],
          opacity: [0, 1],
          duration: 560,
          delay: L.stagger(38, { from: 'first' }),
          ease: easeSnap
        });
        track(loginRevertibles, wAnim);
      }
    } catch (_) {}

    try {
      if (chars.length) {
        const outEase =
          L.eases && typeof L.eases.out === 'function' ? L.eases.out(3) : 'out(3)';
        const cAnim = L.animate(chars, {
          translateY: ['100%', '0%'],
          opacity: [0, 1],
          duration: 620,
          delay: L.stagger(24, { from: 'first' }),
          ease: outEase
        });
        track(loginRevertibles, cAnim);
      }
    } catch (_) {}

    try {
      const head = loginRoot.querySelector('.login-left-headline');
      if (head) {
        const hAnim = L.animate(head, {
          translateY: ['0.75rem', '0'],
          duration: 680,
          ease: easeSnap
        });
        track(loginRevertibles, hAnim);
      }
    } catch (_) {}

    try {
      ensureLoginSvgLayer(loginRoot);
      const drawables = L.svg.createDrawable('#loginAnimeSvg path');
      const canScroll = loginRoot.scrollHeight > loginRoot.clientHeight + 32;
      const scrollCtl = canScroll ? L.onScroll({ target: loginRoot, sync: true }) : null;

      const lineAnim = L.animate(drawables, {
        draw: ['0 0', '0 1', '1 1'],
        duration: canScroll ? 5400 : 2800,
        ease: 'inOutQuad',
        delay: L.stagger(55, { from: 'first' }),
        loop: !canScroll,
        alternate: !canScroll,
        autoplay: scrollCtl === null ? true : scrollCtl
      });
      track(loginRevertibles, lineAnim);
      if (scrollCtl) track(loginRevertibles, scrollCtl);
    } catch (e) {
      console.warn('flux-anime: login lines', e);
    }

    try {
      const tag = loginRoot.querySelector('.login-tagline');
      if (tag) {
        const pulse = L.animate(tag, {
          letterSpacing: ['0.2em', '0.34em'],
          opacity: [0.78, 1],
          duration: 2200,
          direction: 'alternate',
          loop: true,
          ease: easeSnap
        });
        track(loginRevertibles, pulse);
      }
    } catch (_) {}

    try {
      const spots = loginRoot.querySelectorAll('.login-spotlight-item');
      if (spots.length) {
        const canScroll = loginRoot.scrollHeight > loginRoot.clientHeight + 32;
        const sc = canScroll ? L.onScroll({ target: loginRoot, sync: true }) : null;
        const sp = L.animate(spots, {
          translateY: [12, 0],
          opacity: [0.45, 1],
          duration: 680,
          ease: easeSnap,
          delay: L.stagger(40, { from: 'first' }),
          autoplay: sc === null ? true : sc
        });
        track(loginRevertibles, sp);
        if (sc) track(loginRevertibles, sc);
      }
    } catch (_) {}

    try {
      const pills = loginRoot.querySelectorAll('#featPillsLoginCard .feat-pill');
      if (pills.length) {
        const pillAnim = L.animate(pills, {
          scale: [0.9, 1],
          opacity: [0.55, 1],
          duration: 520,
          delay: L.stagger(26, { from: 'first' }),
          ease: easeSnap
        });
        track(loginRevertibles, pillAnim);
      }
    } catch (_) {}

    try {
      const card = loginRoot.querySelector('.login-card');
      if (card && typeof L.createSpring === 'function') {
        const springEase = L.createSpring({ stiffness: 260, damping: 20 });
        const pop = L.animate(card, {
          scale: [0.97, 1],
          duration: 900,
          ease: springEase
        });
        track(loginRevertibles, pop);
      }
    } catch (_) {}

    try {
      const badge = loginRoot.querySelector('.login-badge.login-badge--after-hero');
      if (badge && L.waapi && typeof L.waapi.animate === 'function') {
        const w = L.waapi.animate(badge, {
          opacity: [0.55, 1],
          translateY: ['10px', '0px'],
          scale: [0.94, 1],
          duration: 520,
          ease: L.eases && L.eases.outQuad ? L.eases.outQuad : 'outQuad'
        });
        track(loginRevertibles, w);
      }
    } catch (_) {}

    try {
      const cards = loginRoot.querySelectorAll('.login-feature-card');
      if (cards.length) {
        const fc = L.animate(cards, {
          translateY: [14, 0],
          scale: [0.96, 1],
          opacity: [0.5, 1],
          duration: 520,
          delay: L.stagger(50, { from: 'first' }),
          ease: easeSnap
        });
        track(loginRevertibles, fc);
      }
    } catch (_) {}
  };

  function animateActivePanelCards() {
    const L = lib();
    const app = document.getElementById('app');
    if (skipMotion() || !L || !app || !app.classList.contains('visible')) return;

    revertAll(appPanelRevertibles);

    const main = document.getElementById('flux-main');
    const panel = main && main.querySelector('.panel.active');
    const cards = panel ? panel.querySelectorAll('.card') : [];
    if (!cards.length) return;

    const easeSnap = ensureEaseCelebrate(L);

    try {
      const cardA = L.animate(cards, {
        translateY: [12, 0],
        opacity: [0.92, 1],
        duration: 580,
        delay: L.stagger(32, { from: 'first' }),
        ease: easeSnap,
        autoplay: true
      });
      track(appPanelRevertibles, cardA);
    } catch (_) {}
  }

  window.teardownFluxAnimeApp = function () {
    revertAll(appShellRevertibles);
    revertAll(appPanelRevertibles);
    appShellAnimated = false;
  };

  window.initFluxAnimeApp = function () {
    const L = lib();
    const app = document.getElementById('app');
    if (skipMotion() || !L || !app || !app.classList.contains('visible')) return;

    const easeSnap = ensureEaseCelebrate(L);

    if (!appShellAnimated) {
      try {
        const navItems = document.querySelectorAll('#sidebar .nav-item');
        if (navItems.length) {
          const navA = L.animate(navItems, {
            translateX: [-12, 0],
            duration: 540,
            delay: L.stagger(26, { from: 'first' }),
            ease: easeSnap
          });
          track(appShellRevertibles, navA);
        }
      } catch (_) {}
      appShellAnimated = true;
    }

    animateActivePanelCards();
  };

  window.fluxAnimeNavAfter = function () {
    animateActivePanelCards();
  };
})();
