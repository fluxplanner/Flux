/**
 * Small motion helpers using Anime.js v4 (same stack as `flux-animations.js`).
 */
import { animate } from 'animejs';

const reduceMotion = () => {
  try {
    return (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.classList.contains('flux-reduce-motion')
    );
  } catch {
    return true;
  }
};

export function animateIn(el, opts = {}) {
  if (!el || reduceMotion()) return;
  animate(el, {
    opacity: [0, 1],
    translateY: ['1rem', '0'],
    duration: opts.duration ?? 400,
    ease: opts.ease ?? 'out(3)',
  });
}

export function magneticEffect(el, strength = 0.2) {
  if (!el || reduceMotion()) return;
  el.addEventListener('mousemove', (e) => {
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    animate(el, { translateX: x * strength, translateY: y * strength, duration: 120, ease: 'linear' });
  });
  el.addEventListener('mouseleave', () => {
    animate(el, { translateX: 0, translateY: 0, duration: 400, ease: 'out(3)' });
  });
}
