/**
 * Flux · More motion — small Anime.js v4 touches across the planner and the
 * staff views. Classic scripts call window.FluxMotionMore.<name>(…); every
 * helper is optional decoration: it returns quietly (or returns null so the
 * caller falls back) when motion is off.
 *
 * Off when: prefers-reduced-motion, the in-app Reduce motion class, the
 * "snappy" performance mode (data-flux-perf="on") or the low-end mode
 * (data-flux-lowend). Nothing here flashes: no opacity or colour loops, every
 * change is a single ease — Flux works with an epilepsy charity, and WCAG 2.3.1
 * applies to all of it.
 */
import { animate, stagger, spring, createDrawable } from 'animejs';

function ok() {
  try {
    const h = document.documentElement;
    return !(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      h.classList.contains('flux-reduce-motion') ||
      h.getAttribute('data-flux-perf') === 'on' ||
      h.hasAttribute('data-flux-lowend')
    );
  } catch (_) {
    return false;
  }
}
const safe = (fn) => { try { return fn(); } catch (_) { return null; } };

/* ── Tasks ─────────────────────────────────────────────────────────────── */

/** A tick that draws itself inside the task's check circle, and a line struck through the title. */
function tickAndStrike(chk, nameEl) {
  if (!ok()) return;
  safe(() => {
    if (chk && !chk.querySelector('.fmm-tick')) {
      chk.textContent = '';
      chk.insertAdjacentHTML('beforeend',
        '<svg class="fmm-tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5l4.2 4.2L18.5 8"/></svg>');
      animate(createDrawable(chk.querySelector('.fmm-tick path')), { draw: ['0 0', '0 1'], duration: 260, ease: 'out(3)' });
    }
    if (nameEl && !nameEl.querySelector('.fmm-strike')) {
      nameEl.classList.add('fmm-strike-host');
      const line = document.createElement('span');
      line.className = 'fmm-strike';
      line.setAttribute('aria-hidden', 'true');
      nameEl.appendChild(line);
      animate(line, { scaleX: [0, 1], duration: 280, delay: 120, ease: 'inOut(2)' });
    }
  });
}

/** The completed list opening: its rows settle in one after another. */
function revealChildren(wrap) {
  if (!ok() || !wrap) return;
  safe(() => {
    const rows = [...wrap.children].slice(0, 12);
    if (!rows.length) return;
    animate(rows, { opacity: [0, 1], y: [-6, 0], duration: 260, delay: stagger(28), ease: 'out(3)' });
  });
}

/** A count that changed (the top bar's "3 due today") nudges once so the eye catches it. */
function bump(el) {
  if (!ok() || !el) return;
  safe(() => animate(el, { y: [-4, 0], scale: [1.06, 1], duration: 420, ease: spring({ stiffness: 260, damping: 18 }) }));
}

/** Something new arrived (a mood check-in, a focus dot): it grows in once. */
function pop(el) {
  if (!ok() || !el) return;
  safe(() => animate(el, { scale: [0.4, 1], opacity: [0, 1], duration: 480, ease: spring({ stiffness: 280, damping: 16 }) }));
}

/* ── Calendar ──────────────────────────────────────────────────────────── */

/** Changing month on a wide screen: the days ripple in from the side you moved toward. */
function calRipple(grid, dir) {
  if (!ok() || !grid) return;
  safe(() => {
    const days = grid.querySelectorAll('.cal-day');
    if (!days.length) return;
    animate(days, {
      opacity: [0, 1],
      x: [dir > 0 ? 10 : -10, 0],
      duration: 320,
      ease: 'out(3)',
      delay: stagger(10, { grid: [7, Math.ceil(days.length / 7)], from: dir > 0 ? 'first' : 'last' }),
    });
  });
}

/* ── Undo snackbar ─────────────────────────────────────────────────────── */

/**
 * The 5 seconds you have to undo, shown as a bar that runs down; hovering
 * (or focusing) the snackbar pauses it. Returns null when motion is off so the
 * caller keeps its plain timer.
 */
function undoTimer(bar, ms, done) {
  if (!ok() || !bar) return null;
  return safe(() => {
    const line = document.createElement('i');
    line.className = 'fmm-undo-timer';
    line.setAttribute('aria-hidden', 'true');
    bar.appendChild(line);
    const a = animate(line, { scaleX: [1, 0], duration: ms, ease: 'linear', onComplete: done });
    const pause = () => a.pause();
    const play = () => { if (bar.isConnected) a.play(); };
    bar.addEventListener('pointerenter', pause);
    bar.addEventListener('pointerleave', play);
    bar.addEventListener('focusin', pause);
    bar.addEventListener('focusout', play);
    return a;
  });
}

/* ── Mood: 4-7-8 breathing ─────────────────────────────────────────────── */

/** Grow or shrink the breathing circle over the whole phase (4 s in, 8 s out), not a fixed 4 s. */
let breathAnim = null;
function breath(circle, scale, ms) {
  if (!circle) return false;
  if (!ok()) return false;
  return !!safe(() => {
    if (breathAnim) breathAnim.pause();
    circle.style.transition = 'none';
    breathAnim = animate(circle, { scale, duration: ms, ease: 'inOut(2)' });
    return true;
  });
}
function breathStop() {
  if (breathAnim) { safe(() => breathAnim.pause()); breathAnim = null; }
}

/* ── Staff ─────────────────────────────────────────────────────────────── */

/**
 * Random student picker: the names roll past and slow to a stop on the pick,
 * like a reel — a smooth slide, never a flicker of swapping text.
 */
function pickerReel(nameEl, names, pick) {
  if (!ok() || !nameEl || !names || names.length < 2) return;
  safe(() => {
    const others = names.filter((n) => n !== pick);
    const rows = [];
    for (let i = 0; i < 7; i++) rows.push(others[(Math.random() * others.length) | 0]);
    rows.push(pick);
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    // The real name stays in the element (screen readers and copy get the pick);
    // the reel rolls over it and is removed when it lands.
    const win = document.createElement('span');
    win.className = 'fmm-reel-win';
    win.setAttribute('aria-hidden', 'true');
    win.innerHTML = '<span class="fmm-reel">' + rows.map((n) => '<span>' + esc(n) + '</span>').join('') + '</span>';
    // Beside the name, not inside it, so the name element's text is always just the pick.
    const host = nameEl.parentElement;
    if (!host) return;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    win.style.top = nameEl.offsetTop + 'px';
    win.style.left = nameEl.offsetLeft + 'px';
    win.style.width = nameEl.offsetWidth + 'px';
    win.style.font = getComputedStyle(nameEl).font;
    nameEl.classList.add('fmm-reeling');
    host.appendChild(win);
    const land = () => { win.remove(); nameEl.classList.remove('fmm-reeling'); pop(nameEl); };
    animate(win.firstChild, {
      y: ['0em', -(rows.length - 1) * 1.35 + 'em'],
      duration: 1100,
      ease: 'out(4)',
      onComplete: land,
    });
  });
}

/** Staff Now: how far through the current period you are, as a line that eases to the new spot. */
const periodFrac = { v: null };
function periodProgress(line, frac) {
  if (!line) return;
  const to = Math.max(0, Math.min(1, frac));
  const from = periodFrac.v == null ? to : periodFrac.v;
  periodFrac.v = to;
  line.style.transform = 'scaleX(' + from + ')';
  if (!ok() || from === to) { line.style.transform = 'scaleX(' + to + ')'; return; }
  safe(() => animate(line, { scaleX: [from, to], duration: 900, ease: 'out(2)' }));
}

/** A staff pop-up (meeting note, PD log, …) fades and lifts in instead of appearing in one frame. */
function enterOverlay(root) {
  if (!ok() || !root) return;
  safe(() => {
    const card = root.firstElementChild;
    animate(root, { opacity: [0, 1], duration: 180, ease: 'out(2)' });
    if (card) animate(card, { opacity: [0, 1], y: [14, 0], scale: [0.98, 1], duration: 280, ease: 'out(3)' });
  });
}
const STAFF_OVERLAYS = ['mnModalRoot', 'pdModalRoot', 'sfModal', 'fluxWidgetConfigureModal', 'fluxSchoolEvtFormRoot'];
function watchStaffOverlays() {
  if (typeof MutationObserver !== 'function') return;
  new MutationObserver((list) => {
    list.forEach((m) => m.addedNodes.forEach((n) => {
      if (n.nodeType === 1 && (STAFF_OVERLAYS.includes(n.id) || n.classList.contains('edu-fullscreen-modal'))) enterOverlay(n);
    }));
  }).observe(document.body, { childList: true });
}

window.FluxMotionMore = {
  ok, tickAndStrike, revealChildren, bump, pop, calRipple, undoTimer, breath, breathStop,
  pickerReel, periodProgress, enterOverlay,
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchStaffOverlays, { once: true });
else watchStaffOverlays();
