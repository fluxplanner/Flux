/**
 * Flux Planner — Anime.js v4 animation system (ESM).
 * APIs per https://animejs.com/ — core bundle has text.split (not splitText),
 * no createLayout / scrambleText; we approximate where needed.
 */
import {
  animate,
  stagger,
  createTimeline,
  createAnimatable,
  createDraggable,
  createSpring,
  onScroll,
  svg,
  text,
  utils,
  waapi,
  eases,
} from 'animejs';

const prefersReducedMotion = () => {
  try {
    return (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.classList.contains('flux-reduce-motion')
    );
  } catch (_) {
    return false;
  }
};

const perfSnappy = () => {
  try {
    return document.documentElement.getAttribute('data-flux-perf') === 'on';
  } catch (_) {
    return false;
  }
};

/** Run animation callback only when motion is allowed */
function motion(fn) {
  if (!prefersReducedMotion() && !perfSnappy() && typeof fn === 'function') fn();
}

/** Expose namespace for legacy helpers */
window.__fluxAnime = {
  animate,
  stagger,
  createTimeline,
  createAnimatable,
  createDraggable,
  createSpring,
  onScroll,
  svg,
  text,
  utils,
  waapi,
  eases,
};

const easeSnap =
  typeof eases.cubicBezier === 'function'
    ? eases.cubicBezier(1, 0.038, 0, 1.01)
    : 'out(3)';

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function unwrapFluxText(loginRoot) {
  if (!loginRoot) return;
  loginRoot.querySelectorAll('[data-flux-text-plain]').forEach((el) => {
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
  el.innerHTML = raw
    .split(/\s+/)
    .map((w) => '<span class="flux-anim-word">' + escHtml(w) + '</span>')
    .join(' ');
  return Array.from(el.querySelectorAll('.flux-anim-word'));
}

function wrapCharsManual(el) {
  if (!el || el.getAttribute('data-flux-char-wrap') === '1') return [];
  const raw = el.textContent;
  if (!raw) return [];
  el.setAttribute('data-flux-text-plain', raw);
  el.setAttribute('data-flux-char-wrap', '1');
  el.innerHTML = Array.from(raw)
    .map((ch) =>
      ch === ' '
        ? '<span class="flux-anim-char">&nbsp;</span>'
        : '<span class="flux-anim-char">' + escHtml(ch) + '</span>'
    )
    .join('');
  return Array.from(el.querySelectorAll('.flux-anim-char'));
}

/** ── Login ambient (migrated from flux-anime-motion.js) ─────────────────── */
let loginRevertibles = [];
let appShellRevertibles = [];
let appPanelRevertibles = [];
let scrollArtRevertibles = [];
let appShellAnimated = false;

const scrollPathDrawEase =
  typeof eases.inOut === 'function' ? eases.inOut(3) : 'inOut(3)';

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
  ];
  strokes.forEach((s) => {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', s.d);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', s.c);
    p.setAttribute('stroke-width', '1.15');
    p.setAttribute('stroke-linecap', 'round');
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

function initFluxAnimeLogin() {
  const loginRoot = document.getElementById('loginScreen');
  if (prefersReducedMotion() || perfSnappy() || !loginRoot?.classList.contains('visible')) return;

  teardownFluxAnimeLogin();
  try {
    const tagEl = loginRoot.querySelector('.login-tagline');
    if (tagEl) {
      tagEl.style.removeProperty('letter-spacing');
      tagEl.style.removeProperty('opacity');
    }
  } catch (_) {}
  const words = wrapWords(loginRoot.querySelector('.login-left-sub'));
  const chars = wrapCharsManual(loginRoot.querySelector('.login-gradient-text'));

  try {
    if (words.length) {
      track(
        loginRevertibles,
        animate(words, {
          translateY: ['1.05rem', '0'],
          opacity: [0, 1],
          duration: 560,
          delay: stagger(38, { from: 'first' }),
          ease: easeSnap,
        })
      );
    }
  } catch (_) {}
  try {
    if (chars.length) {
      const outEase = typeof eases.out === 'function' ? eases.out(3) : 'out(3)';
      track(
        loginRevertibles,
        animate(chars, {
          translateY: ['100%', '0%'],
          opacity: [0, 1],
          duration: 620,
          delay: stagger(24, { from: 'first' }),
          ease: outEase,
        })
      );
    }
  } catch (_) {}
  try {
    const head = loginRoot.querySelector('.login-left-headline');
    if (head) {
      track(
        loginRevertibles,
        animate(head, { translateY: ['0.75rem', '0'], duration: 680, ease: easeSnap })
      );
    }
  } catch (_) {}

  try {
    ensureLoginSvgLayer(loginRoot);
    const drawables = svg.createDrawable('#loginAnimeSvg path');
    const canScroll = loginRoot.scrollHeight > loginRoot.clientHeight + 32;
    const scrollCtl = canScroll ? onScroll({ target: loginRoot, sync: true }) : null;
    track(
      loginRevertibles,
      animate(drawables, {
        draw: ['0 0', '0 1', '1 1'],
        duration: canScroll ? 4800 : 2800,
        ease: scrollPathDrawEase,
        delay: stagger(40, { from: 'first' }),
        loop: !canScroll,
        alternate: !canScroll,
        autoplay: scrollCtl === null ? true : scrollCtl,
      })
    );
    if (scrollCtl) track(loginRevertibles, scrollCtl);
  } catch (e) {
    console.warn('flux-animations: login lines', e);
  }

  try {
    const spots = loginRoot.querySelectorAll('.login-spotlight-item');
    if (spots.length) {
      const canScroll = loginRoot.scrollHeight > loginRoot.clientHeight + 32;
      const sc = canScroll ? onScroll({ target: loginRoot, sync: true }) : null;
      track(
        loginRevertibles,
        animate(spots, {
          translateY: [12, 0],
          opacity: [0.45, 1],
          duration: 680,
          ease: easeSnap,
          delay: stagger(40, { from: 'first' }),
          autoplay: sc === null ? true : sc,
        })
      );
      if (sc) track(loginRevertibles, sc);
    }
  } catch (_) {}

  try {
    const pills = loginRoot.querySelectorAll('#featPillsLoginCard .feat-pill');
    if (pills.length) {
      track(
        loginRevertibles,
        animate(pills, {
          scale: [0.9, 1],
          opacity: [0.55, 1],
          duration: 520,
          delay: stagger(26, { from: 'first' }),
          ease: easeSnap,
        })
      );
    }
  } catch (_) {}

  try {
    const card = loginRoot.querySelector('.login-card');
    if (card) {
      track(
        loginRevertibles,
        animate(card, {
          scale: [0.97, 1],
          duration: 900,
          ease: createSpring({ stiffness: 260, damping: 20 }),
        })
      );
    }
  } catch (_) {}

  try {
    const badge = loginRoot.querySelector('.login-badge.login-badge--after-hero');
    if (badge && waapi?.animate) {
      track(
        loginRevertibles,
        waapi.animate(badge, {
          opacity: [0.55, 1],
          translateY: ['10px', '0px'],
          scale: [0.94, 1],
          duration: 520,
          ease: eases.outQuad || 'outQuad',
        })
      );
    }
  } catch (_) {}

  try {
    const fc = loginRoot.querySelectorAll('.login-feature-card');
    if (fc.length) {
      track(
        loginRevertibles,
        animate(fc, {
          translateY: [14, 0],
          scale: [0.96, 1],
          opacity: [0.5, 1],
          duration: 520,
          delay: stagger(50, { from: 'first' }),
          ease: easeSnap,
        })
      );
    }
  } catch (_) {}
}

function teardownFluxAnimeLogin() {
  revertAll(loginRevertibles);
  const svgEl = document.getElementById('loginAnimeSvg');
  if (svgEl) svgEl.remove();
  const lr = document.getElementById('loginScreen');
  if (lr) unwrapFluxText(lr);
}

function animateActivePanelCards() {
  const app = document.getElementById('app');
  if (prefersReducedMotion() || perfSnappy() || !app?.classList.contains('visible')) return;
  revertAll(appPanelRevertibles);
  const main = document.getElementById('flux-main');
  const panel = main?.querySelector('.panel.active');
  const cards = panel?.querySelectorAll('.card');
  if (!cards?.length) return;
  try {
    track(
      appPanelRevertibles,
      animate(cards, {
        translateY: [12, 0],
        opacity: [0.92, 1],
        duration: 580,
        delay: stagger(32, { from: 'first' }),
        ease: easeSnap,
        autoplay: true,
      })
    );
  } catch (_) {}
}

/** Decorative SVG paths on the dashboard, drawn in sync with panel scroll (or loop when nothing scrolls). */
function initMainScrollPathDraw(mainEl) {
  if (!mainEl || prefersReducedMotion() || perfSnappy()) return;
  const dash = document.getElementById('dashboard');
  if (!dash || dash.dataset.fluxScrollPathInit === '1') return;
  dash.dataset.fluxScrollPathInit = '1';

  const wrap = document.createElement('div');
  wrap.className = 'flux-dash-scroll-paths';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 360" preserveAspectRatio="xMidMax meet" width="100%" height="100%">' +
    '<path d="M0 180 C200 60 400 300 600 160 S900 260 1200 100" fill="none" stroke="rgba(0,191,255,0.32)" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M0 240 C240 140 480 300 720 180 S1000 80 1200 200" fill="none" stroke="rgba(124,92,255,0.26)" stroke-width="2.5" stroke-linecap="round"/>' +
    '<path d="M0 300 C300 200 520 340 820 220 S1020 140 1200 260" fill="none" stroke="rgba(34,255,136,0.2)" stroke-width="2" stroke-linecap="round"/>' +
    '</svg>';
  dash.insertBefore(wrap, dash.firstChild);

  try {
    const drawables = svg.createDrawable('.flux-dash-scroll-paths path');
    let scrollCtl = null;
    if (dash.scrollHeight > dash.clientHeight + 48) {
      scrollCtl = onScroll({ target: dash, sync: true });
    } else if (mainEl.scrollHeight > mainEl.clientHeight + 48) {
      scrollCtl = onScroll({ target: mainEl, sync: true });
    }
    const useLoop = scrollCtl === null;
    track(
      scrollArtRevertibles,
      animate(drawables, {
        draw: ['0 0', '0 1', '1 1'],
        delay: stagger(40, { from: 'first' }),
        ease: scrollPathDrawEase,
        duration: useLoop ? 2800 : 4200,
        loop: useLoop,
        alternate: useLoop,
        autoplay: useLoop ? true : scrollCtl,
      })
    );
    if (scrollCtl) track(scrollArtRevertibles, scrollCtl);
  } catch (e) {
    console.warn('flux-animations: dashboard scroll paths', e);
  }
}

function teardownScrollPathArt() {
  revertAll(scrollArtRevertibles);
  document.querySelectorAll('.flux-dash-scroll-paths').forEach((n) => n.remove());
  const dash = document.getElementById('dashboard');
  if (dash) delete dash.dataset.fluxScrollPathInit;
}

function initFluxAnimeApp() {
  const app = document.getElementById('app');
  if (prefersReducedMotion() || perfSnappy() || !app?.classList.contains('visible')) return;
  if (!appShellAnimated) {
    try {
      const navItems = document.querySelectorAll('#sidebar .nav-item');
      if (navItems.length) {
        track(
          appShellRevertibles,
          animate(navItems, {
            translateX: [-12, 0],
            duration: 540,
            delay: stagger(26, { from: 'first' }),
            ease: easeSnap,
          })
        );
      }
    } catch (_) {}
    appShellAnimated = true;
  }
  animateActivePanelCards();
  try {
    const main = document.getElementById('flux-main');
    if (main) initMainScrollPathDraw(main);
  } catch (_) {}
}

function teardownFluxAnimeApp() {
  revertAll(appShellRevertibles);
  revertAll(appPanelRevertibles);
  teardownScrollPathArt();
  appShellAnimated = false;
}

function fluxAnimeNavAfter() {
  animateActivePanelCards();
}

/** Particle burst — uses utils.random from anime */
function particleBurst(sourceEl) {
  if (!sourceEl || prefersReducedMotion()) return;
  const rect = sourceEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const colors = [
    'rgba(0,194,255,0.95)',
    'rgba(34,255,136,0.9)',
    'rgba(255,255,255,0.85)',
    'rgba(245,166,35,0.9)',
  ];
  const count = 10;
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('div');
    dot.style.cssText = `position:fixed;width:5px;height:5px;border-radius:50%;background:${colors[i % colors.length]};left:${cx}px;top:${cy}px;pointer-events:none;z-index:10001;transform:translate(-50%,-50%)`;
    document.body.appendChild(dot);
    const angle = (i / count) * Math.PI * 2;
    const dist = utils.random(32, 72);
    animate(dot, {
      translateX: Math.cos(angle) * dist,
      translateY: Math.sin(angle) * dist - 18,
      opacity: [1, 0],
      scale: [1, 0],
      duration: utils.random(380, 640),
      ease: 'outExpo',
      onComplete: () => dot.remove(),
    });
  }
}

/**
 * Task completion: checkbox pop, optional text.split chars, card exit, particles.
 * @param {HTMLElement} taskEl
 * @param {HTMLElement} [checkboxEl]
 * @param {() => void} onDone — call save/render after animation
 */
function taskComplete(taskEl, checkboxEl, onDone) {
  if (!taskEl) {
    onDone?.();
    return;
  }
  if (prefersReducedMotion() || perfSnappy()) {
    onDone?.();
    return;
  }

  const chk = checkboxEl || taskEl.querySelector('.check');
  const nameEl =
    taskEl.querySelector('.task-text.task-primary-line') ||
    taskEl.querySelector('.task-text');

  const finish = () => {
    try {
      onDone?.();
    } catch (_) {}
  };

  particleBurst(chk || taskEl);

  try {
    const tl = createTimeline({ onComplete: finish });
    if (chk) {
      tl.add(
        chk,
        {
          scale: [1, 1.28, 0.94, 1.06, 1],
          duration: 420,
          ease: 'outElastic(1, .55)',
        },
        0
      );
    }
    if (nameEl) {
      tl.add(
        nameEl,
        {
          opacity: [1, 0.38],
          duration: 220,
          ease: 'outQuad',
        },
        chk ? '-=200' : 0
      );
    }
    tl.add(
      taskEl,
      {
        opacity: [1, 0],
        translateY: [0, -14],
        scale: [1, 0.96],
        duration: 280,
        ease: 'outQuad',
      },
      '+=40'
    );
  } catch (_) {
    finish();
  }
}

function tasksEnter(taskEls) {
  if (!taskEls?.length) return;
  motion(() => {
    animate(taskEls, {
      opacity: [0, 1],
      translateY: [16, 0],
      scale: [0.97, 1],
      delay: stagger(36, { from: 'first' }),
      duration: 300,
      ease: 'outExpo',
    });
  });
}

function taskEnterSingle(taskEl) {
  if (!taskEl) return;
  motion(() => {
    animate(taskEl, {
      opacity: [0, 1],
      translateY: [18, 0],
      scale: [0.96, 1],
      duration: 360,
      ease: createSpring({ stiffness: 200, damping: 18 }),
    });
  });
}

function panelFlash(inEl) {
  if (!inEl) return;
  motion(() => {
    animate(inEl, {
      opacity: [0.92, 1],
      translateY: [6, 0],
      duration: 220,
      ease: 'outExpo',
    });
  });
}

function modalOpen(overlayEl, cardEl) {
  if (!cardEl) return;
  motion(() => {
    if (overlayEl) {
      animate(overlayEl, { opacity: [0, 1], duration: 180, ease: 'outQuad' });
    }
    animate(cardEl, {
      opacity: [0, 1],
      translateY: [16, 0],
      scale: [0.96, 1],
      duration: 320,
      ease: createSpring({ stiffness: 220, damping: 20 }),
    });
  });
}

function modalClose(overlayEl, cardEl, onComplete) {
  if (!cardEl && !overlayEl) {
    onComplete?.();
    return;
  }
  if (prefersReducedMotion() || perfSnappy()) {
    onComplete?.();
    return;
  }
  try {
    const tl = createTimeline({ onComplete });
    if (cardEl) {
      tl.add(cardEl, {
        opacity: [1, 0],
        translateY: [0, 10],
        scale: [1, 0.97],
        duration: 160,
        ease: 'outQuad',
      });
    }
    if (overlayEl) {
      tl.add(
        overlayEl,
        { opacity: [1, 0], duration: 140, ease: 'outQuad' },
        '-=80'
      );
    }
  } catch (_) {
    onComplete?.();
  }
}

function sheetOpen(sheetEl, overlayEl) {
  if (!sheetEl) return;
  motion(() => {
    void overlayEl;
    const items = sheetEl.querySelectorAll('.more-sheet-item');
    if (items.length) {
      animate(items, {
        opacity: [0.55, 1],
        translateY: [10, 0],
        scale: [0.97, 1],
        delay: stagger(26, { start: 80 }),
        duration: 240,
        ease: 'outExpo',
      });
    }
  });
}

function sheetClose(sheetEl, overlayEl, onComplete) {
  void sheetEl;
  void overlayEl;
  onComplete?.();
}

function cardsEnter(cardEls, options = {}) {
  if (!cardEls?.length) return;
  motion(() => {
    animate(cardEls, {
      opacity: [0, 1],
      translateY: [22, 0],
      scale: [0.96, 1],
      delay: stagger(48, {
        from: options.from || 'first',
        grid: options.grid || undefined,
        axis: options.axis || undefined,
        start: options.startDelay || 0,
      }),
      duration: 340,
      ease: 'outExpo',
    });
  });
}

/** scrambleText not in core — opacity pulse placeholder */
function scrambleIn(el, finalText, options = {}) {
  if (!el) return;
  motion(() => {
    el.textContent = '';
    animate(el, {
      opacity: [0, 1],
      duration: options.duration || 400,
      ease: 'outExpo',
      onComplete: () => {
        el.textContent = finalText || '';
      },
    });
  });
}

function aiThinking(el) {
  if (!el || prefersReducedMotion()) {
    if (el) el.textContent = '…';
    return null;
  }
  el.textContent = '·';
  return animate(el, {
    opacity: [0.4, 1],
    duration: 900,
    loop: true,
    direction: 'alternate',
    ease: 'inOutSine',
  });
}

function headingReveal(el, options = {}) {
  if (!el || !text?.split) return;
  motion(() => {
    try {
      const splitter = text.split(el, { chars: true, accessible: true });
      const ch = splitter.chars;
      if (ch?.length) {
        animate(ch, {
          opacity: [0, 1],
          translateY: [options.fromBelow ? 10 : -8, 0],
          delay: stagger(18, { from: 'first' }),
          duration: 360,
          ease: 'outExpo',
          onComplete: () => splitter.revert(),
        });
      }
    } catch (_) {}
  });
}

function wordReveal(el) {
  if (!el || !text?.split) return;
  motion(() => {
    try {
      const splitter = text.split(el, { words: true, accessible: true });
      const w = splitter.words;
      if (w?.length) {
        animate(w, {
          opacity: [0, 1],
          translateY: [8, 0],
          delay: stagger(50, { from: 'first' }),
          duration: 320,
          ease: 'outExpo',
          onComplete: () => splitter.revert(),
        });
      }
    } catch (_) {}
  });
}

/** createLayout not in bundle — fade + stagger refresh */
function filterTransition(containerEl, renderFn) {
  if (!containerEl || prefersReducedMotion() || perfSnappy()) {
    renderFn?.();
    return;
  }
  animate(containerEl, {
    opacity: [1, 0.35],
    duration: 100,
    ease: 'outQuad',
    onComplete: () => {
      renderFn?.();
      requestAnimationFrame(() => {
        const items = containerEl.querySelectorAll(
          '.task-item, .ref-card, .st-tool-chip, .card'
        );
        animate(containerEl, { opacity: [0.35, 1], duration: 120, ease: 'outQuad' });
        if (items.length) {
          animate(items, {
            opacity: [0, 1],
            translateY: [8, 0],
            delay: stagger(22, { from: 'first' }),
            duration: 220,
            ease: 'outExpo',
          });
        }
      });
    },
  });
}

function logoDrawIn(svgRoot) {
  if (!svgRoot) return;
  motion(() => {
    const paths = svgRoot.querySelectorAll('path, line, polyline');
    paths.forEach((path) => {
      try {
        const drawables = svg.createDrawable(path);
        const target = Array.isArray(drawables) ? drawables[0] : drawables;
        if (!target) return;
        animate(target, {
          draw: ['0 0', '0 1'],
          duration: 800,
          ease: 'outExpo',
          delay: 120,
        });
      } catch (_) {}
    });
  });
}

function toastIn(toastEl) {
  if (!toastEl) return;
  motion(() => {
    animate(toastEl, {
      opacity: [0, 1],
      translateY: [18, 0],
      scale: [0.94, 1],
      duration: 320,
      ease: createSpring({ stiffness: 260, damping: 22 }),
    });
  });
}

function toastOut(toastEl, onComplete) {
  if (!toastEl) {
    onComplete?.();
    return;
  }
  if (prefersReducedMotion() || perfSnappy()) {
    onComplete?.();
    return;
  }
  animate(toastEl, {
    opacity: [1, 0],
    translateY: [0, 10],
    scale: [1, 0.96],
    duration: 220,
    ease: 'outQuad',
    onComplete: () => onComplete?.(),
  });
}

function emptyStateIn(emptyEl) {
  if (!emptyEl) return;
  motion(() => {
    const icon = emptyEl.querySelector('.empty-icon');
    const title = emptyEl.querySelector('.empty-title');
    const tl = createTimeline();
    if (icon) {
      tl.add(icon, {
        opacity: [0, 1],
        scale: [0.55, 1.12, 1],
        translateY: [12, 0],
        duration: 480,
        ease: 'outElastic(1, .55)',
      });
    }
    if (title) {
      tl.add(
        title,
        { opacity: [0, 1], translateY: [8, 0], duration: 260, ease: 'outExpo' },
        '-=200'
      );
    }
  });
}

function chainUnlock(unlockedEls) {
  if (!unlockedEls?.length) return;
  motion(() => {
    unlockedEls.forEach((el, i) => {
      createTimeline({ delay: i * 100 })
        .add(el, { opacity: [0.45, 1], duration: 280, ease: 'outQuad' })
        .add(
          el,
          {
            boxShadow: [
              '0 0 0 0 rgba(0,194,255,0)',
              '0 0 0 3px rgba(0,194,255,0.45)',
              '0 0 0 0 rgba(0,194,255,0)',
            ],
            duration: 520,
            ease: 'outQuad',
          },
          '-=120'
        )
        .add(
          el,
          { scale: [1, 1.02, 1], duration: 380, ease: 'outElastic(1, .5)' },
          '-=400'
        );
    });
  });
}

function momentumPop(pillEl) {
  if (!pillEl) return;
  motion(() => {
    animate(pillEl, {
      scale: [1, 1.18, 0.94, 1.06, 1],
      duration: 480,
      ease: 'outElastic(1, .5)',
    });
  });
}

function startStreakPulse(badgeEl) {
  if (!badgeEl) return null;
  if (prefersReducedMotion()) return null;
  return animate(badgeEl, {
    scale: [1, 1.06, 1],
    opacity: [0.85, 1, 0.85],
    duration: 1100,
    loop: true,
    ease: 'inOutSine',
  });
}

let _cogBarAnim = null;

function initCogLoadMeter() {
  const bar = document.getElementById('cogLoadBar');
  if (!bar || _cogBarAnim || prefersReducedMotion() || perfSnappy()) return;
  try {
    _cogBarAnim = createAnimatable(bar, {
      width: {
        unit: '%',
        duration: 680,
        ease: typeof eases.out === 'function' ? eases.out(3) : 'out(3)',
      },
    });
  } catch (_) {
    _cogBarAnim = null;
  }
}

function updateCogLoad(load) {
  const bar = document.getElementById('cogLoadBar');
  if (!bar) return;
  const n = Math.max(0, Math.min(100, +load || 0));
  const color = n >= 85 ? 'var(--red)' : n >= 60 ? 'var(--gold)' : 'var(--green)';
  if (prefersReducedMotion() || perfSnappy() || !_cogBarAnim) {
    bar.style.width = n + '%';
    bar.style.background = color;
    return;
  }
  try {
    _cogBarAnim.width(n);
    animate(bar, { background: color, duration: 360, ease: 'outQuad' });
  } catch (_) {
    bar.style.width = n + '%';
    bar.style.background = color;
  }
}

/** Scroll-driven one-shot reveal for dashboard-style cards (safe to call once per main shell). */
function initScrollReveal(containerEl) {
  if (!containerEl || prefersReducedMotion() || perfSnappy()) return;
  if (containerEl.dataset.fluxScrollRevealInit === '1') return;
  containerEl.dataset.fluxScrollRevealInit = '1';
  const revealEls = containerEl.querySelectorAll(
    '.dash-section .card, .dash-row .card, .canvas-card, .ref-card, .st-section'
  );
  revealEls.forEach((el) => {
    if (el.dataset.fluxRevealBound === '1') return;
    el.dataset.fluxRevealBound = '1';
    try {
      animate(el, {
        opacity: [0, 1],
        translateY: [16, 0],
        duration: 400,
        ease: 'outExpo',
        autoplay: onScroll({
          target: el,
          container: containerEl,
          enter: 'end start',
          leave: 'start end',
          repeat: false,
          sync: false,
        }),
      });
    } catch (_) {}
  });
}

function initWorkloadScrollSync(chartEl) {
  if (!chartEl || prefersReducedMotion() || perfSnappy()) return;
  const bars = chartEl.querySelectorAll('.workload-bar-fill');
  bars.forEach((bar) => {
    const outer = bar.parentElement;
    const targetPx = outer ? outer.offsetHeight : 0;
    if (!targetPx) return;
    bar.style.height = '0px';
    try {
      animate(bar, {
        height: [0, targetPx + 'px'],
        duration: 520,
        ease: 'outExpo',
        autoplay: onScroll({
          target: chartEl,
          container: document.getElementById('flux-main') || undefined,
          enter: 'end center',
          repeat: false,
          sync: false,
        }),
      });
    } catch (_) {
      bar.style.height = '';
    }
  });
}

function workloadBarsIn(barEls) {
  if (!barEls?.length || prefersReducedMotion() || perfSnappy()) return;
  barEls.forEach((bar, i) => {
    const outer = bar.parentElement;
    const targetPx = bar.dataset.targetHeight
      ? parseFloat(bar.dataset.targetHeight)
      : outer?.offsetHeight || 0;
    if (!targetPx) return;
    bar.style.height = '0px';
    motion(() => {
      animate(bar, {
        height: [0, targetPx + 'px'],
        delay: i * 48,
        duration: 520,
        ease: createSpring({ stiffness: 120, damping: 14 }),
      });
    });
  });
}

function initTimerRing(svgCircleEl, totalSeconds) {
  if (!svgCircleEl || !totalSeconds) return null;
  const r = parseFloat(svgCircleEl.getAttribute('r') || '90');
  const circumference = 2 * Math.PI * r;
  svgCircleEl.style.strokeDasharray = String(circumference);
  return {
    update: (remainingSeconds) => {
      const p = Math.max(0, Math.min(1, remainingSeconds / totalSeconds));
      svgCircleEl.style.strokeDashoffset = String(circumference * p);
    },
    complete: () => {
      motion(() => {
        const tl = createTimeline();
        tl.add(svgCircleEl, {
          opacity: [1, 0.35, 1],
          duration: 480,
          ease: 'inOutSine',
        });
      });
    },
  };
}

function updateMiniRing(miniSvgEl, progress) {
  if (!miniSvgEl) return;
  const r = parseFloat(miniSvgEl.getAttribute('r') || '8');
  const circ = 2 * Math.PI * r;
  miniSvgEl.style.strokeDasharray = String(circ);
  const p = Math.max(0, Math.min(1, progress));
  miniSvgEl.style.strokeDashoffset = String(circ * (1 - p));
}

function pillAppear(pillEl) {
  if (!pillEl) return;
  pillEl.style.display = 'flex';
  if (prefersReducedMotion() || perfSnappy()) {
    pillEl.style.opacity = '1';
    pillEl.style.transform = '';
    return;
  }
  motion(() => {
    animate(pillEl, {
      opacity: [0, 1],
      translateY: [18, 0],
      scale: [0.82, 1],
      ease: createSpring({ stiffness: 200, damping: 18 }),
    });
  });
}

function pillDisappear(pillEl, onComplete) {
  if (!pillEl) {
    onComplete?.();
    return;
  }
  if (prefersReducedMotion() || perfSnappy()) {
    pillEl.style.display = 'none';
    onComplete?.();
    return;
  }
  motion(() => {
    animate(pillEl, {
      opacity: [1, 0],
      translateY: [0, 14],
      scale: [1, 0.88],
      duration: 260,
      ease: 'outQuad',
      onComplete: () => {
        pillEl.style.display = 'none';
        onComplete?.();
      },
    });
  });
}

function runNavContentSwap(contentEl, dir, onMidpoint) {
  const mid = onMidpoint;
  if (!contentEl || prefersReducedMotion() || perfSnappy()) {
    return Promise.resolve(mid?.()).catch(() => {});
  }
  const dxOut = dir === 'back' ? 22 : -22;
  const dxIn = dir === 'back' ? -22 : 22;
  return new Promise((resolve) => {
    animate(contentEl, {
      opacity: [1, 0],
      translateX: [0, dxOut],
      duration: 170,
      ease: 'outQuad',
      onComplete: () => {
        Promise.resolve(mid?.())
          .catch(() => {})
          .then(() => {
            animate(contentEl, {
              opacity: [0, 1],
              translateX: [dxIn, 0],
              duration: 260,
              ease: 'outExpo',
              onComplete: () => resolve(),
            });
          });
      },
    });
  });
}

function canvasNavForward(contentEl, onMidpoint) {
  return runNavContentSwap(contentEl, 'forward', onMidpoint);
}

function canvasNavBack(contentEl, onMidpoint) {
  return runNavContentSwap(contentEl, 'back', onMidpoint);
}

function addToPlannerSuccess(btnEl) {
  if (!btnEl) return;
  const originalText = btnEl.textContent;
  const prevBg = btnEl.style.background;
  const prevBorder = btnEl.style.borderColor;
  const prevColor = btnEl.style.color;
  btnEl.textContent = '✓ Added';
  if (prefersReducedMotion() || perfSnappy()) {
    btnEl.style.background = 'var(--green)';
    btnEl.style.borderColor = 'var(--green)';
    btnEl.style.color = '#fff';
    setTimeout(() => {
      btnEl.textContent = originalText;
      btnEl.style.background = prevBg;
      btnEl.style.borderColor = prevBorder;
      btnEl.style.color = prevColor;
    }, 2000);
    return;
  }
  motion(() => {
    const tl = createTimeline();
    tl.add(btnEl, {
      scale: [1, 0.94, 1.04, 1],
      duration: 420,
      ease: 'outElastic(1, .55)',
    });
    tl.add(
      btnEl,
      {
        background: 'var(--green)',
        borderColor: 'var(--green)',
        color: '#fff',
        duration: 200,
        ease: 'outQuad',
      },
      0
    );
  });
  setTimeout(() => {
    btnEl.textContent = originalText;
    if (prefersReducedMotion() || perfSnappy()) {
      btnEl.style.background = prevBg;
      btnEl.style.borderColor = prevBorder;
      btnEl.style.color = prevColor;
      return;
    }
    motion(() => {
      animate(btnEl, {
        background: prevBg || 'transparent',
        borderColor: prevBorder || '',
        color: prevColor || '',
        duration: 280,
        ease: 'outQuad',
      });
    });
  }, 2000);
}

/**
 * @param {HTMLElement} sectionBodyEl
 * @param {HTMLElement | null} chevronEl
 * @param {boolean} isCollapsing
 * @param {() => void} [onComplete] — run after motion settles (sync class / persistence)
 */
function sectionToggle(sectionBodyEl, chevronEl, isCollapsing, onComplete) {
  const done = () => {
    try {
      onComplete?.();
    } catch (_) {}
  };
  if (!sectionBodyEl) {
    done();
    return;
  }
  if (prefersReducedMotion() || perfSnappy()) {
    sectionBodyEl.style.maxHeight = isCollapsing ? '0' : '2000px';
    sectionBodyEl.style.opacity = '';
    sectionBodyEl.style.overflow = isCollapsing ? 'hidden' : 'visible';
    if (chevronEl) chevronEl.classList.toggle('collapsed', !!isCollapsing);
    done();
    return;
  }
  if (isCollapsing) {
    const h = sectionBodyEl.scrollHeight || parseFloat(sectionBodyEl.style.maxHeight) || 0;
    sectionBodyEl.style.overflow = 'hidden';
    animate(sectionBodyEl, {
      maxHeight: [Math.max(h, 8) + 'px', '0px'],
      duration: 280,
      ease: 'outQuad',
      onComplete: () => {
        sectionBodyEl.style.opacity = '';
        done();
      },
    });
    if (chevronEl) {
      chevronEl.style.display = 'inline-block';
      animate(chevronEl, { rotate: [0, -90], duration: 200, ease: 'outQuad' });
    }
  } else {
    sectionBodyEl.style.overflow = 'hidden';
    const target = Math.min(sectionBodyEl.scrollHeight || 800, 2000);
    animate(sectionBodyEl, {
      maxHeight: [0, target + 'px'],
      duration: 320,
      ease: 'outExpo',
      onComplete: () => {
        sectionBodyEl.style.maxHeight = '2000px';
        sectionBodyEl.style.overflow = 'visible';
        sectionBodyEl.style.opacity = '';
        done();
      },
    });
    if (chevronEl) {
      chevronEl.style.display = 'inline-block';
      animate(chevronEl, { rotate: [-90, 0], duration: 220, ease: 'outExpo' });
    }
  }
}

function initTabIndicator(tabBarEl) {
  if (!tabBarEl || prefersReducedMotion() || perfSnappy()) return null;
  const indicator = tabBarEl.querySelector('.tab-indicator');
  if (!indicator) return null;
  try {
    const animatable = createAnimatable(indicator, {
      x: { unit: 'px', duration: 240, ease: createSpring({ stiffness: 220, damping: 20 }) },
      width: { unit: 'px', duration: 240, ease: createSpring({ stiffness: 220, damping: 20 }) },
    });
    return {
      moveTo: (activeTabEl) => {
        if (!activeTabEl) return;
        const barRect = tabBarEl.getBoundingClientRect();
        const tabRect = activeTabEl.getBoundingClientRect();
        animatable.x(tabRect.left - barRect.left);
        animatable.width(tabRect.width);
      },
    };
  } catch (_) {
    return null;
  }
}

/** Stubs / hooks — extend when replacing native behavior */
function initDraggableTasks() {
  /* Intentionally noop: list drag uses native HTML5 + app handlers */
}
function initKanbanDrag() {}
function initTaskLayout() {
  return null;
}

window.FluxAnim = {
  taskComplete,
  particleBurst,
  tasksEnter,
  taskEnterSingle,
  panelFlash,
  modalOpen,
  modalClose,
  sheetOpen,
  sheetClose,
  cardsEnter,
  scrambleIn,
  aiThinking,
  headingReveal,
  wordReveal,
  filterTransition,
  logoDrawIn,
  toastIn,
  toastOut,
  emptyStateIn,
  chainUnlock,
  momentumPop,
  startStreakPulse,
  initDraggableTasks,
  initKanbanDrag,
  initTaskLayout,
  initScrollReveal,
  initMainScrollPathDraw,
  initWorkloadScrollSync,
  initCogLoadMeter,
  updateCogLoad,
  initTimerRing,
  updateMiniRing,
  pillAppear,
  pillDisappear,
  canvasNavForward,
  canvasNavBack,
  addToPlannerSuccess,
  sectionToggle,
  initTabIndicator,
  workloadBarsIn,
};

window.initFluxAnimeLogin = initFluxAnimeLogin;
window.teardownFluxAnimeLogin = teardownFluxAnimeLogin;
window.initFluxAnimeApp = initFluxAnimeApp;
window.teardownFluxAnimeApp = teardownFluxAnimeApp;
window.fluxAnimeNavAfter = fluxAnimeNavAfter;

/** Back-compat: two-arg completion used previously */
window.fluxAnimeOnTaskComplete = function (el, done) {
  const chk = el?.querySelector?.('.check');
  taskComplete(el, chk, done);
};
