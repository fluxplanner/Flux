/**
 * FluxAnimeCatalog — 50+ reusable motion primitives mapped to Anime.js v4 docs
 * (https://animejs.com/documentation) plus hooks for Flux UI. Patterns are
 * original implementations inspired by public API examples, not bundled assets.
 *
 * 21st.dev (https://21st.dev) categories — companion CSS in flux-anime-catalog.css
 * mirrors their component *types* (AI chat chrome, heroes, shaders-as-gradient, CTAs).
 */
import {
  animate,
  stagger,
  createTimeline,
  createSpring,
  createAnimatable,
  createDraggable,
  onScroll,
  svg,
  text,
  waapi,
  utils,
} from 'animejs';

function prefersReducedMotion() {
  try {
    return (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.classList.contains('flux-reduce-motion')
    );
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
function motion(ok, fn) {
  if (!(ok !== false && !prefersReducedMotion() && !perfSnappy())) return null;
  try {
    return typeof fn === 'function' ? fn() : null;
  } catch (_) {
    return null;
  }
}

/** Dev reference: animejs.com doc anchors + 21st-inspired UI pairing */
export const SOURCE_INDEX = [
  { id: 'staggerFadeUp', anime: '/documentation/utilities/stagger/time-staggering', vibe: '21st:features' },
  { id: 'staggerFadeDown', anime: '/documentation/utilities/stagger/time-staggering', vibe: '21st:text' },
  { id: 'staggerScalePop', anime: '/documentation/utilities/stagger/values-staggering', vibe: '21st:buttons' },
  { id: 'staggerSlideX', anime: '/documentation/utilities/stagger/stagger-parameters', vibe: '21st:cta' },
  { id: 'gridBurstFromCenter', anime: '/documentation/utilities/stagger/time-staggering', vibe: '21st:heros' },
  { id: 'gridBurstFromCorner', anime: '/documentation/utilities/stagger/time-staggering', vibe: '21st:testimonials' },
  { id: 'springTap', anime: '/documentation/timeline/advanced-timing', vibe: '21st:buttons' },
  { id: 'springModal', anime: '/documentation/spring/spring-parameters', vibe: '21st: dialogs' },
  { id: 'springRow', anime: '/documentation/spring/spring-parameters', vibe: '21st:message-dock' },
  { id: 'timelineSoftEnter', anime: '/documentation/timeline/', vibe: '21st:hero-1' },
  { id: 'parallelOverlayCard', anime: '/documentation/timeline/advanced-timing', vibe: '21st:v0-ai-chat' },
  { id: 'svgPathDrawOne', anime: '/documentation/svg/draw', vibe: '21st:text' },
  { id: 'svgDrawableStagger', anime: '/documentation/svg/draw', vibe: '21st:text' },
  { id: 'scrollSyncFade', anime: '/documentation/events/onscroll', vibe: '21st:features' },
  { id: 'scrollSyncSlideUp', anime: '/documentation/events/onscroll', vibe: '21st:features' },
  { id: 'loopFloatY', anime: '/documentation/animation/', vibe: '21st:banners' },
  { id: 'loopPulseScale', anime: '/documentation/animation/', vibe: '21st:pricing' },
  { id: 'loopRotateSlow', anime: '/documentation/animation/css-transforms', vibe: '21st:heroes' },
  { id: 'shakeAttentionX', anime: '/documentation/animation/', vibe: '21st:badge-attention' },
  { id: 'flashRgbBorder', anime: '/documentation/animation/', vibe: '21st:testimonials' },
  { id: 'blurReveal', anime: '/documentation/animation/', vibe: '21st:v0-ai-chat' },
  { id: 'clipRevealX', anime: '/documentation/animation/', vibe: '21st:text' },
  { id: 'skewPopIn', anime: '/documentation/animation/css-transforms', vibe: '21st:pricing' },
  { id: 'accordionHeight', anime: '/documentation/animation/', vibe: '21st:flutter-surface' },
  { id: 'rippleExpand', anime: '/documentation/animation/', vibe: '21st:buttons' },
  { id: 'accentSweepBg', anime: '/documentation/timeline/advanced-timing', vibe: '21st:pricing' },
  { id: 'fabSpinOnce', anime: '/documentation/animation/css-transforms', vibe: '21st:FAB' },
  { id: 'badgePingAnime', anime: '/documentation/animation/', vibe: '21st:notifications' },
  { id: 'dotTypingBar', anime: '/documentation/timeline/', vibe: '21st:animated-ai-input' },
  { id: 'lineGrow', anime: '/documentation/animation/', vibe: '21st:text' },
  { id: 'circleDashReveal', anime: '/documentation/svg/draw', vibe: '21st:testimonials' },
  { id: 'navUnderlineMorph', anime: '/documentation/animatable', vibe: '21st:tabs' },
  { id: 'toastSpringEnhanced', anime: '/documentation/spring/spring-parameters', vibe: '21st:toasts' },
  { id: 'sheetItemsEaseStagger', anime: '/documentation/utilities/stagger/stagger-parameters/stagger-ease', vibe: '21st:AI-chat-components' },
  { id: 'taskRowSpringIn', anime: '/documentation/spring/spring-parameters', vibe: '21st:lists' },
  { id: 'cardLiftMouse', anime: '/documentation/animation/function-based-values', vibe: '21st:floating-cards' },
  { id: 'particleSparkBurst', anime: '/documentation/timeline/advanced-timing', vibe: '21st:effects' },
  { id: 'scrambleStyleFadeText', anime: '/documentation/text/', vibe: '21st:v0-ai-chat' },
  { id: 'splitCharsRise', anime: '/documentation/text/', vibe: '21st:text' },
  { id: 'splitWordsSlide', anime: '/documentation/text/', vibe: '21st:text-components' },
  { id: 'waapiGlowPulseOnce', anime: '/documentation/', vibe: '21st:input-glow' },
  { id: 'waapiHueShiftBg', anime: '/documentation/', vibe: '21st:shaders' },
  { id: 'timelineTickStack', anime: '/documentation/timeline/advanced-timing', vibe: '21st:message-dock' },
  { id: 'staggerElasticOut', anime: '/documentation/easings', vibe: '21st:pricing' },
  { id: 'scaleWithBlur', anime: '/documentation/animation/', vibe: '21st:dialogs' },
  { id: 'slideFromRightDrawer', anime: '/documentation/animation/', vibe: '21st:message-dock' },
  { id: 'easeStaggerOpacity', anime: '/documentation/utilities/stagger/stagger-parameters/stagger-ease', vibe: '21st:testimonials-grid' },
  { id: 'randomJitterPositions', anime: '/documentation/utilities/random', vibe: '21st:panic-mode' },
  { id: 'syncScrollProgressRotate', anime: '/documentation/events/onscroll', vibe: '21st:marketing' },
  { id: 'draggableElasticReturn', anime: '/documentation/draggable', vibe: '21st:gadgets' },
  { id: 'installCatalogAttributes', anime: '/', vibe: '21st:any' },
];

function q(sel, root) {
  try {
    return Array.from((root || document).querySelectorAll(sel));
  } catch (_) {
    return [];
  }
}

export function staggerFadeUp(nodes, o = {}) {
  const els = typeof nodes === 'string' ? q(nodes) : Array.from(nodes || []);
  if (!els.length) return null;
  return motion(true, () =>
    animate(els, {
      opacity: [0, 1],
      translateY: [14, 0],
      duration: o.duration ?? 320,
      delay: stagger(o.gap ?? 40, {
        ease: o.stEase ?? 'linear',
        from: o.from ?? 'first',
        start: o.start ?? 0,
      }),
      ease: o.ease ?? 'outExpo',
    })
  );
}

export function staggerFadeDown(nodes, o = {}) {
  const els = typeof nodes === 'string' ? q(nodes) : Array.from(nodes || []);
  if (!els.length) return null;
  return motion(true, () =>
    animate(els, {
      opacity: [0, 1],
      translateY: [-12, 0],
      duration: o.duration ?? 300,
      delay: stagger(o.gap ?? 36, { from: 'last' }),
      ease: 'outExpo',
    })
  );
}

export function staggerScalePop(nodes, o = {}) {
  const els = typeof nodes === 'string' ? q(nodes) : Array.from(nodes || []);
  if (!els.length) return null;
  return motion(true, () =>
    animate(els, {
      opacity: [0, 1],
      scale: [0.92, 1],
      duration: o.duration ?? 280,
      delay: stagger(o.gap ?? 50, {
        ease: 'inOut(3)',
        from: o.from ?? 'center',
        grid: o.grid,
      }),
      ease: 'outElastic(1, .6)',
    })
  );
}

export function staggerSlideX(nodes, o = {}) {
  const els = typeof nodes === 'string' ? q(nodes) : Array.from(nodes || []);
  if (!els.length) return null;
  return motion(true, () =>
    animate(els, {
      opacity: [0, 1],
      translateX: [o.dx ?? 24, 0],
      duration: o.duration ?? 340,
      delay: stagger(o.gap ?? 45, { from: 'first' }),
      ease: 'outExpo',
    })
  );
}

export function gridBurstFromCenter(selector, cols, rows, o = {}) {
  const els = q(selector);
  if (!els.length) return null;
  return motion(true, () =>
    animate(els, {
      opacity: [0, 1],
      scale: [0.82, 1],
      translateY: [10, 0],
      duration: o.duration ?? 420,
      delay: stagger(o.step ?? 60, {
        grid: [cols || 3, rows || 3],
        from: 'center',
        ease: 'inOut(3)',
      }),
      ease: 'outExpo',
    })
  );
}

export function gridBurstFromCorner(selector, cols, rows, o = {}) {
  const els = q(selector);
  if (!els.length) return null;
  return motion(true, () =>
    animate(els, {
      opacity: [0, 1],
      scale: [0.85, 1],
      delay: stagger(o.step ?? 55, {
        grid: [cols || 4, rows || 4],
        from: [0, 0],
      }),
      duration: o.duration ?? 380,
      ease: 'outExpo',
    })
  );
}

export function springTap(el, o = {}) {
  if (!el) return null;
  return motion(true, () =>
    animate(el, {
      scale: [1, o.to ?? 0.94, 1],
      duration: o.duration ?? 380,
      ease: createSpring({
        stiffness: o.stiffness ?? 380,
        damping: o.damping ?? 22,
      }),
    })
  );
}

export function springModal(el, o = {}) {
  if (!el) return null;
  return motion(true, () =>
    animate(el, {
      opacity: [0, 1],
      translateY: [16, 0],
      scale: [o.fromScale ?? 0.96, 1],
      duration: o.duration ?? 360,
      ease: createSpring({ stiffness: 240, damping: o.damping ?? 20 }),
    })
  );
}

export function springRow(rows, o = {}) {
  const els = typeof rows === 'string' ? q(rows) : Array.from(rows || []);
  if (!els.length) return null;
  return motion(true, () =>
    animate(els, {
      opacity: [0, 1],
      translateX: [-16, 0],
      duration: o.duration ?? 300,
      delay: stagger(o.gap ?? 80, { start: o.start ?? 40 }),
      ease: createSpring({ stiffness: 200, damping: 18 }),
    })
  );
}

export function timelineSoftEnter(entries, o = {}) {
  const els = typeof entries === 'string' ? q(entries) : Array.from(entries || []);
  if (!els.length) return null;
  return motion(true, () => {
    const tl = createTimeline({ defaults: { ease: 'outExpo' } });
    els.forEach((el, i) => {
      tl.add(
        el,
        {
          opacity: [0, 1],
          translateY: [20, 0],
          duration: o.dur ?? 320,
        },
        i === 0 ? 0 : o.offset ?? `-=${o.overlap ?? 220}`
      );
    });
    return tl;
  });
}

export function parallelOverlayCard(overlayEl, cardEl, o = {}) {
  motion(true, () => {
    if (overlayEl) {
      animate(overlayEl, {
        opacity: [0, 1],
        duration: o.overlayMs ?? 200,
        ease: 'outQuad',
      });
    }
    springModal(cardEl, o);
  });
}

export function svgPathDrawOne(pathEl, o = {}) {
  if (!pathEl) return null;
  return motion(true, () => {
    try {
      const dbl = svg.createDrawable(pathEl);
      return animate(dbl, {
        draw: ['0 0', '0 1', '1 1'],
        duration: o.duration ?? 1200,
        ease: 'inOutExpo',
        delay: o.delay ?? 0,
      });
    } catch (_) {
      return null;
    }
  });
}

export function svgDrawableStagger(selector, o = {}) {
  const paths = q(selector).filter(Boolean);
  if (!paths.length) return null;
  return motion(true, () => {
    try {
      const drawables = paths.map((p) => svg.createDrawable(p));
      return animate(drawables, {
        draw: ['0 0', '0 1', '1 1'],
        duration: o.duration ?? 900,
        delay: stagger(o.stagger ?? 45, { ease: 'inOut(3)' }),
        ease: 'outExpo',
      });
    } catch (_) {
      return null;
    }
  });
}

export function scrollSyncFade(target, opts = {}) {
  if (!target) return null;
  return motion(true, () => {
    try {
      return animate(target, {
        opacity: [0.25, 1],
        translateY: [opts.ty ?? 20, 0],
        duration: opts.duration ?? 1400,
        ease: opts.ease ?? 'out(3)',
        autoplay: onScroll({
          target,
          sync: opts.sync !== false,
          repeat: false,
        }),
      });
    } catch (_) {
      return null;
    }
  });
}

export function scrollSyncSlideUp(target, opts = {}) {
  if (!target) return null;
  return motion(true, () =>
    animate(target, {
      opacity: [0.4, 1],
      translateY: [opts.ty ?? 32, 0],
      duration: opts.duration ?? 1600,
      ease: 'inOutQuad',
      autoplay: onScroll({
        target,
        sync: opts.sync !== false,
        repeat: false,
      }),
    })
  );
}

export function loopFloatY(el, o = {}) {
  if (!el) return null;
  return motion(true, () =>
    animate(el, {
      translateY: [0, o.amp ?? -6, 0],
      duration: o.duration ?? 2400,
      loop: true,
      ease: 'inOutSine',
    })
  );
}

export function loopPulseScale(el, o = {}) {
  if (!el) return null;
  return motion(true, () =>
    animate(el, {
      scale: [1, o.to ?? 1.04, 1],
      duration: o.duration ?? 2400,
      loop: true,
      ease: 'inOutQuad',
    })
  );
}

export function loopRotateSlow(el, o = {}) {
  if (!el) return null;
  return motion(true, () =>
    animate(el, {
      rotate: o.deg ?? 360,
      duration: o.duration ?? 12000,
      loop: true,
      ease: 'linear',
    })
  );
}

export function shakeAttentionX(el, o = {}) {
  if (!el) return null;
  return motion(true, () =>
    animate(el, {
      translateX: [0, -6, 6, -4, 4, 0],
      duration: o.duration ?? 420,
      ease: 'outQuad',
    })
  );
}

export function flashRgbBorder(el, o = {}) {
  if (!el) return null;
  return motion(true, () =>
    animate(el, {
      boxShadow: [
        '0 0 0 0 rgba(var(--accent-rgb),0)',
        `0 0 0 ${o.spread ?? 3}px rgba(var(--accent-rgb),0.55)`,
        '0 0 0 0 rgba(var(--accent-rgb),0)',
      ],
      duration: o.duration ?? 480,
      ease: 'outExpo',
    })
  );
}

export function blurReveal(el, o = {}) {
  if (!el) return null;
  return motion(true, () =>
    animate(el, {
      opacity: [0, 1],
      filter: ['blur(8px)', 'blur(0px)'],
      duration: o.duration ?? 460,
      ease: 'outExpo',
    })
  );
}

export function clipRevealX(el, o = {}) {
  if (!el) return null;
  el.style.overflow = 'hidden';
  return motion(true, () =>
    animate(el, {
      clipPath: ['inset(0 100% 0 0)', 'inset(0 0 0 0)'],
      duration: o.duration ?? 520,
      ease: 'inOutQuad',
    })
  );
}

export function skewPopIn(el, o = {}) {
  if (!el) return null;
  return motion(true, () =>
    animate(el, {
      opacity: [0, 1],
      skewY: [`${o.deg ?? -4}deg`, '0deg'],
      translateY: [14, 0],
      duration: o.duration ?? 360,
      ease: 'outExpo',
    })
  );
}

export function accordionHeight(el, collapsed, o = {}) {
  if (!el) return null;
  if (prefersReducedMotion() || perfSnappy()) {
    el.style.maxHeight = collapsed ? '0px' : o.openMax ?? '2400px';
    return null;
  }
  const cur = collapsed ? el.scrollHeight : 0;
  const tgt = collapsed ? 0 : el.scrollHeight || 400;
  return animate(el, {
    maxHeight: [cur + 'px', tgt + 'px'],
    duration: o.duration ?? 260,
    ease: 'outExpo',
  });
}

export function rippleExpand(originEl, x, y, o = {}) {
  if (!originEl) return null;
  const r = document.createElement('span');
  r.className = 'flux-ac-ripple';
  Object.assign(r.style, {
    position: 'fixed',
    left: `${x}px`,
    top: `${y}px`,
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: `rgba(var(--accent-rgb),${o.alpha ?? 0.35})`,
    pointerEvents: 'none',
    transform: 'translate(-50%,-50%) scale(1)',
    zIndex: 99997,
    mixBlendMode: 'screen',
  });
  document.body.appendChild(r);
  return motion(true, () =>
    animate(r, {
      scale: [1, o.spread ?? 48],
      opacity: [0.9, 0],
      duration: o.duration ?? 520,
      ease: 'outExpo',
      onComplete: () => r.remove(),
    })
  );
}

export function accentSweepBg(el, o = {}) {
  if (!el) return null;
  return motion(true, () =>
    animate(el, {
      backgroundPosition: ['0% 50%', '100% 50%'],
      duration: o.duration ?? 1800,
      ease: 'inOutQuad',
    })
  );
}

export function fabSpinOnce(btn, o = {}) {
  if (!btn) return null;
  return motion(true, () =>
    animate(btn, {
      rotate: [`${o.from ?? 0}deg`, `${o.from ?? 0 + 180}deg`],
      duration: o.duration ?? 340,
      ease: 'outExpo',
    })
  );
}

export function badgePingAnime(el, o = {}) {
  if (!el) return null;
  const ring = el.querySelector(':scope > .flux-ac-ping-ring') || document.createElement('span');
  if (!ring.classList.contains('flux-ac-ping-ring')) {
    ring.className = 'flux-ac-ping-ring';
    el.style.position ||= 'relative';
    el.appendChild(ring);
  }
  return motion(true, () =>
    animate(ring, {
      scale: [0.85, o.to ?? 1.85],
      opacity: [0.55, 0],
      duration: o.duration ?? 900,
      loop: !!o.loop,
      ease: 'outQuad',
    })
  );
}

export function dotTypingBar(container, o = {}) {
  if (!container) return null;
  const n = Math.min(12, Math.max(2, o.dots ?? 3));
  container.innerHTML = '';
  container.classList.add('flux-ac-dot-parent');
  for (let i = 0; i < n; i++) {
    const d = document.createElement('span');
    d.className = 'flux-ac-dot';
    container.appendChild(d);
  }
  const dots = Array.from(container.querySelectorAll('.flux-ac-dot'));
  return motion(true, () =>
    animate(dots, {
      opacity: [0.25, 1],
      translateY: [4, -2, 4],
      duration: 480,
      loop: true,
      delay: stagger(120),
      ease: 'inOutSine',
    })
  );
}

export function lineGrow(el, o = {}) {
  if (!el) return null;
  return motion(true, () =>
    animate(el, {
      scaleX: [0, 1],
      opacity: [0.5, 1],
      duration: o.duration ?? 420,
      transformOrigin: o.origin ?? 'left center',
      ease: 'outExpo',
    })
  );
}

export function circleDashReveal(el, o = {}) {
  if (!el || el.tagName !== 'circle') return null;
  return motion(true, () => {
    const len = typeof el.getTotalLength === 'function' ? el.getTotalLength() : 210;
    el.style.strokeDasharray = String(len);
    el.style.strokeDashoffset = String(len);
    return animate(el, {
      strokeDashoffset: [len, o.offset ?? 0],
      duration: o.duration ?? 1400,
      ease: 'inOutQuad',
    });
  });
}

export function navUnderlineMorph(barEl, hostEl, tabEl, o = {}) {
  if (!barEl || !tabEl || !hostEl || typeof createAnimatable !== 'function') return null;
  motion(true, () => {
    try {
      const a = createAnimatable(barEl, {
        x: { unit: 'px', duration: 240, ease: createSpring(o.spring || { stiffness: 220, damping: 20 }) },
        width: { unit: 'px', duration: 240, ease: createSpring(o.spring || { stiffness: 220, damping: 20 }) },
      });
      const r = hostEl.getBoundingClientRect();
      const t = tabEl.getBoundingClientRect();
      a.x(t.left - r.left);
      a.width(t.width);
      return a;
    } catch (_) {
      return null;
    }
  });
  return null;
}

export function toastSpringEnhanced(el) {
  if (!el) return null;
  return motion(true, () =>
    animate(el, {
      opacity: [0, 1],
      translateY: [22, 0],
      scale: [0.93, 1],
      filter: ['blur(4px)', 'blur(0px)'],
      duration: 360,
      ease: createSpring({ stiffness: 280, damping: 24 }),
    })
  );
}

export function sheetItemsEaseStagger(items, o = {}) {
  const els = typeof items === 'string' ? q(items) : Array.from(items || []);
  if (!els.length) return null;
  return motion(true, () =>
    animate(els, {
      opacity: [0.52, 1],
      translateY: [14, 0],
      scale: [0.97, 1],
      delay: stagger(o.gap ?? 28, { start: o.start ?? 80, ease: 'inOut(3)' }),
      duration: o.duration ?? 260,
      ease: 'outExpo',
    })
  );
}

export function taskRowSpringIn(el) {
  return taskSpringHelper(el || null);
}

function taskSpringHelper(el) {
  if (!el) return null;
  return motion(true, () =>
    animate(el, {
      opacity: [0, 1],
      translateY: [18, 0],
      skewX: ['-4deg', '0deg'],
      duration: 380,
      ease: createSpring({ stiffness: 180, damping: 20 }),
    })
  );
}

export function cardLiftMouse(card, o = {}) {
  if (!card) return null;
  const max = o.max ?? 5;
  const onMove = (e) => {
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `perspective(${o.perspective ?? 900}px) rotateX(${-py * max}deg) rotateY(${px * max}deg)`;
  };
  const off = () => {
    animate(card, {
      rotateX: 0,
      rotateY: 0,
      duration: o.dur ?? 340,
      ease: createSpring({ stiffness: 220, damping: 24 }),
    });
    queueMicrotask(() => {
      card.style.transform = '';
    });
  };
  card.addEventListener('mousemove', onMove);
  card.addEventListener('mouseleave', off);
  return () => {
    card.removeEventListener('mousemove', onMove);
    card.removeEventListener('mouseleave', off);
  };
}

export function particleSparkBurst(x, y, o = {}) {
  const frag = [];
  motion(true, () => {
    for (let i = 0; i < (o.count ?? 14); i++) {
      const s = document.createElement('span');
      s.style.cssText =
        `position:fixed;width:4px;height:4px;border-radius:999px;background:var(--accent);left:${x}px;top:${y}px;z-index:99999;pointer-events:none;`;
      document.body.appendChild(s);
      frag.push(s);
    }
    animate(frag, {
      translateX: () => utils.random(-50, 50),
      translateY: () => utils.random(-60, -8),
      opacity: [1, 0],
      duration: utils.random(o.minMs ?? 400, o.maxMs ?? 800),
      delay: stagger(15),
      ease: 'outExpo',
      onComplete: () => frag.forEach((n) => n.remove()),
    });
  });
}

export function scrambleStyleFadeText(el, nextText, o = {}) {
  if (!el) return null;
  return motion(true, () =>
    animate(el, {
      opacity: [1, 0.2, 1],
      translateY: [0, -3, 0],
      duration: o.duration ?? 280,
      ease: 'inOutQuad',
      onComplete: () => {
        el.textContent = nextText ?? '';
      },
    })
  );
}

export function splitCharsRise(el) {
  if (!el || !text?.split) return null;
  return motion(true, () => {
    try {
      const sp = text.split(el, { chars: true, accessible: true });
      const ch = sp.chars;
      if (!ch?.length) return null;
      return animate(ch, {
        opacity: [0, 1],
        translateY: [8, 0],
        delay: stagger(16, { ease: 'inOut(3)' }),
        duration: 420,
        ease: 'outExpo',
        onComplete: () => sp.revert(),
      });
    } catch (_) {
      return null;
    }
  });
}

export function splitWordsSlide(el) {
  if (!el || !text?.split) return null;
  return motion(true, () => {
    try {
      const sp = text.split(el, { words: true, accessible: true });
      const w = sp.words;
      if (!w?.length) return null;
      return animate(w, {
        opacity: [0, 1],
        translateX: [-14, 0],
        delay: stagger(72, { from: 'first' }),
        duration: 360,
        ease: 'outQuad',
        onComplete: () => sp.revert(),
      });
    } catch (_) {
      return null;
    }
  });
}

export function waapiGlowPulseOnce(el) {
  if (!el || !waapi?.animate || prefersReducedMotion() || perfSnappy()) return null;
  try {
    return waapi.animate(
      el,
      {
        boxShadow: [
          '0 0 0 0 rgba(var(--accent-rgb),0)',
          '0 0 24px 3px rgba(var(--accent-rgb),0.25)',
          '0 0 0 0 rgba(var(--accent-rgb),0)',
        ],
      },
      {
        duration: 720,
      }
    );
  } catch (_) {
    return null;
  }
}

export function waapiHueShiftBg(el) {
  void el;
  /* Filter backdrop via WAAPI is patchy cross-browser — no-op fallback */
  return null;
}

export function timelineTickStack(dotsSel, barSel, o = {}) {
  const dots = q(dotsSel);
  const bar = barSel ? document.querySelector(barSel) : null;
  if (!dots.length) return null;
  return motion(true, () => {
    const tl = createTimeline();
    tl.add(dots, {
      opacity: [0.35, 1],
      translateY: [8, -2],
      duration: o.dotMs ?? 90,
      delay: stagger(o.staggerDot ?? 14),
      ease: 'outExpo',
    });
    if (bar) {
      tl.add(
        bar,
        {
          rotate: 360,
          duration: o.spin ?? 960,
          ease: 'linear',
          loop: !!o.loopSpin,
        },
        o.barJoin ?? `-=${o.overlap ?? 720}`
      );
    }
    return tl;
  });
}

export function staggerElasticOut(nodes) {
  const els = typeof nodes === 'string' ? q(nodes) : Array.from(nodes || []);
  if (!els.length) return null;
  return motion(true, () =>
    animate(els, {
      translateY: [24, 0],
      opacity: [0, 1],
      delay: stagger(90, { ease: 'linear' }),
      duration: 500,
      ease: 'outElastic(1, .55)',
    })
  );
}

export function scaleWithBlur(el, o = {}) {
  if (!el) return null;
  return motion(true, () =>
    animate(el, {
      opacity: [0, 1],
      scale: [o.from ?? 0.92, 1],
      filter: ['blur(6px)', 'blur(0)'],
      duration: o.duration ?? 380,
      ease: 'out(3)',
    })
  );
}

export function slideFromRightDrawer(panel, o = {}) {
  if (!panel) return null;
  return motion(true, () =>
    animate(panel, {
      translateX: [o.from ?? '100%', 0],
      duration: o.duration ?? 320,
      ease: createSpring({ stiffness: 260, damping: 24 }),
    })
  );
}

export function easeStaggerOpacity(items) {
  const els = typeof items === 'string' ? q(items) : Array.from(items || []);
  if (!els.length) return null;
  return motion(true, () =>
    animate(els, {
      opacity: [0.25, 1],
      translateY: [10, 0],
      duration: 320,
      delay: stagger(70, { ease: 'out(4)' }),
      ease: 'outQuad',
    })
  );
}

export function randomJitterPositions(sel, dur = 540) {
  const els = q(sel);
  if (!els.length) return null;
  return motion(true, () =>
    animate(els, {
      translateX: () => utils.random(-8, 8),
      translateY: () => utils.random(-4, 4),
      duration: () => utils.random(dur * 0.6, dur),
      ease: 'inOutSine',
    })
  );
}

export function syncScrollProgressRotate(scrollTargetEl, axleEl, opts = {}) {
  const el = axleEl || scrollTargetEl;
  if (!el || !scrollTargetEl) return null;
  return motion(true, () =>
    animate(el, {
      rotate: [0, opts.deg ?? 360],
      ease: 'linear',
      duration: opts.duration ?? 8000,
      autoplay: onScroll({
        target: scrollTargetEl,
        container: opts.container,
        sync: true,
        repeat: false,
      }),
    })
  );
}

export function draggableElasticReturn(handle, bounds, o = {}) {
  if (!handle) return null;
  return motion(true, () => {
    try {
      return createDraggable(handle, {
        container: bounds,
        releaseEase: createSpring(o.spring || { stiffness: 140, damping: 12 }),
      });
    } catch (_) {
      return null;
    }
  });
}

export function installCatalogAttributes(root = document.body) {
  if (!root) return;
  const C = window.FluxAnimeCatalog;
  if (!C) return;
  q('[data-flux-catalog-run]', root).forEach((host) => {
    const keys = (host.getAttribute('data-flux-catalog-run') || '')
      .split(/\s+/g)
      .filter(Boolean);
    keys.forEach((k) => {
      const fn = C[k];
      if (typeof fn === 'function') queueMicrotask(() => fn(host));
    });
  });
}

const FluxAnimeCatalog = {
  SOURCE_INDEX,
  staggerFadeUp,
  staggerFadeDown,
  staggerScalePop,
  staggerSlideX,
  gridBurstFromCenter,
  gridBurstFromCorner,
  springTap,
  springModal,
  springRow,
  timelineSoftEnter,
  parallelOverlayCard,
  svgPathDrawOne,
  svgDrawableStagger,
  scrollSyncFade,
  scrollSyncSlideUp,
  loopFloatY,
  loopPulseScale,
  loopRotateSlow,
  shakeAttentionX,
  flashRgbBorder,
  blurReveal,
  clipRevealX,
  skewPopIn,
  accordionHeight,
  rippleExpand,
  accentSweepBg,
  fabSpinOnce,
  badgePingAnime,
  dotTypingBar,
  lineGrow,
  circleDashReveal,
  navUnderlineMorph,
  toastSpringEnhanced,
  sheetItemsEaseStagger,
  taskRowSpringIn,
  cardLiftMouse,
  particleSparkBurst,
  scrambleStyleFadeText,
  splitCharsRise,
  splitWordsSlide,
  waapiGlowPulseOnce,
  waapiHueShiftBg,
  timelineTickStack,
  staggerElasticOut,
  scaleWithBlur,
  slideFromRightDrawer,
  easeStaggerOpacity,
  randomJitterPositions,
  syncScrollProgressRotate,
  draggableElasticReturn,
  installCatalogAttributes,

  mergeIntoFluxAnim(fluxAnimApi) {
    if (!fluxAnimApi) return;
    fluxAnimApi.toastInEnhanced = toastSpringEnhanced;
    fluxAnimApi.modalOpenEnhanced = parallelOverlayCard;
    fluxAnimApi.catalog = FluxAnimeCatalog;
    fluxAnimApi.sheetItemsEaseStagger = sheetItemsEaseStagger;
  },

  bootstrap() {
    installCatalogAttributes();
    if (window.FluxAnim) FluxAnimeCatalog.mergeIntoFluxAnim(window.FluxAnim);
  },
};

window.FluxAnimeCatalog = FluxAnimeCatalog;

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => FluxAnimeCatalog.bootstrap(), { once: true });
  } else {
    queueMicrotask(() => FluxAnimeCatalog.bootstrap());
  }
}
