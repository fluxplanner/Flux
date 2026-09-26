/* ============================================================================
   FLUX GRAPHER · TOUR  ·  flux-grapher-tour.js
   The optional first-visit walkthrough.

   The grapher carries almost no words — the plot gets the screen — so the
   explaining happens here, once, and only if asked for. First visit: a small
   card offers the tour and gets out of the way on "No thanks". The ? in the
   header replays it any time.

   Steps point at real elements and skip any that are not on screen (the
   Measurements steps do not show in Functions, and vice versa), so the tour
   cannot describe a button that is not there.
   ========================================================================== */
(function () {
  'use strict';

  const SEEN_KEY = 'flux_grapher_tour';

  function seen() { try { return !!localStorage.getItem(SEEN_KEY); } catch (e) { return true; } }
  function markSeen(v) { try { localStorage.setItem(SEEN_KEY, v || 'done'); } catch (e) {} }

  const STEPS = [
    { sel: '#ghModes', title: 'Two graphers',
      body: 'Functions is for maths — type an equation and explore it, like Desmos. Measurements is for lab data: tables, uncertainties, error bars and a best-fit line.' },
    { sel: '.flg--functions .flg-items', title: 'Type an equation',
      body: 'Try y = x², sin(x), x = 3 or a point like (2, 5). Letters such as a or k become sliders you can drag — or press ▶ to animate. Add a table and its + regression button writes y1 ~ m x1 + b for you, with R² and residuals.' },
    { sel: '.flg--data .flg-table', title: 'Your data table',
      body: 'Type or paste readings. Enter moves down a row. Paste straight from a spreadsheet and the columns fill themselves.' },
    { sel: '.flg--data .flg-addcol button', title: 'Add columns',
      body: 'Add more value columns, or an uncertainty (±) column. Each ± column belongs to one value column — pick which in its header. Type a number, or a percentage like 2%.' },
    { sel: '.flg--data .flg-tfoot', title: 'What gets plotted',
      body: 'Choose which column goes on x and which on y, pick a line of best fit, add as many manual lines as you like, and switch on max/min for the steepest and shallowest lines through the error bars. Click any line’s colour dot to recolour it.' },
    { sel: '.flg-addbar', title: 'Add more',
      body: 'Add another equation — or, in Measurements, another table to compare runs. Click a colour dot to change its colour or hide it.' },
    { sel: '.flg-stage', title: 'Explore the graph',
      body: 'Drag to move, scroll or pinch to zoom. Click a curve to see its zeros, maximums, minimums and intersections, then click a grey dot to pin its coordinates.' },
    { sel: '.flg-results:not([hidden])', title: 'Results and key',
      body: 'Every fitted equation, gradient ± uncertainty and line colour. The − button folds it away, and a saved image then leaves it out too.' },
    { sel: '.flg-clear', title: 'Start again',
      body: 'Clear everything empties the tables and lines in one go. Undo brings it all back if you change your mind.' },
    { sel: '.flg-tool-window', title: 'Window, title and axes',
      body: 'Type exact axis ranges, name the axes, give the graph a title, and switch the grid on or off.' },
    { sel: '#ghSave', title: 'Saving is optional',
      body: 'Nothing is kept unless you save. Signing in keeps graphs in your Flux account, where Flux Planner can open them too.' },
    { sel: '#ghPng', title: 'For your report',
      body: 'Download a clean image on a white background, with the results card as its key — fold the card away first to leave it out. Before it saves, you name the graph and both axes and check a preview, so it is right first time.' },
    { sel: '#ghHelp', title: 'That is it',
      body: 'Press ? any time to see this again.' },
  ];

  function visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4 && r.bottom > 0 && r.right > 0
      && r.top < window.innerHeight && r.left < window.innerWidth;
  }

  let active = null;

  function end(mark) {
    if (!active) return;
    const a = active;
    active = null;
    document.removeEventListener('keydown', a.onKey, true);
    window.removeEventListener('resize', a.onResize);
    a.layer.classList.add('is-out');
    setTimeout(() => { if (a.layer.parentNode) a.layer.parentNode.removeChild(a.layer); }, 180);
    markSeen(mark || 'done');
  }

  function start() {
    end('done');
    const steps = STEPS.filter((s) => visible(document.querySelector(s.sel)));
    if (!steps.length) return;
    const layer = document.createElement('div');
    layer.className = 'fgt-layer';
    layer.innerHTML = '<div class="fgt-spot"></div><div class="fgt-card" role="dialog" aria-live="polite" aria-label="Grapher tour">'
      + '<div class="fgt-count"></div><h3 class="fgt-title"></h3><p class="fgt-body"></p>'
      + '<div class="fgt-btns"><button type="button" class="fgt-skip">Skip</button><span class="fgt-grow"></span>'
      + '<button type="button" class="fgt-back">Back</button><button type="button" class="fgt-next">Next</button></div></div>';
    document.body.appendChild(layer);
    const spot = layer.querySelector('.fgt-spot'), card = layer.querySelector('.fgt-card');
    let i = 0;

    function place() {
      const s = steps[i];
      const el = document.querySelector(s.sel);
      if (!el) { go(i + 1); return; }
      const r = el.getBoundingClientRect();
      const pad = 6;
      const vw = document.documentElement.clientWidth, vh = window.innerHeight;
      const top = Math.max(4, r.top - pad), left = Math.max(4, r.left - pad);
      const w = Math.min(vw - left - 4, r.width + pad * 2), h = Math.min(vh - top - 4, r.height + pad * 2);
      spot.style.cssText = 'top:' + top + 'px;left:' + left + 'px;width:' + w + 'px;height:' + h + 'px';
      layer.querySelector('.fgt-count').textContent = (i + 1) + ' of ' + steps.length;
      layer.querySelector('.fgt-title').textContent = s.title;
      layer.querySelector('.fgt-body').textContent = s.body;
      layer.querySelector('.fgt-back').hidden = i === 0;
      layer.querySelector('.fgt-next').textContent = i === steps.length - 1 ? 'Done' : 'Next';
      // The card sits beside the target: below if there is room, then above, then over it.
      const cw = Math.min(340, vw - 24);
      card.style.width = cw + 'px';
      const ch = card.offsetHeight;
      let cy = top + h + 12;
      if (cy + ch > vh - 12) cy = top - ch - 12;
      if (cy < 12) cy = Math.max(12, Math.min(vh - ch - 12, top + 16));
      const cx = Math.max(12, Math.min(vw - cw - 12, left + w / 2 - cw / 2));
      card.style.top = cy + 'px';
      card.style.left = cx + 'px';
      layer.querySelector('.fgt-next').focus();
    }
    function go(n) {
      if (n >= steps.length) { end('done'); return; }
      i = Math.max(0, n);
      place();
    }
    layer.querySelector('.fgt-next').addEventListener('click', () => go(i + 1));
    layer.querySelector('.fgt-back').addEventListener('click', () => go(i - 1));
    layer.querySelector('.fgt-skip').addEventListener('click', () => end('skipped'));
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); end('skipped'); }
      else if (e.key === 'ArrowRight') go(i + 1);
      else if (e.key === 'ArrowLeft') go(i - 1);
    };
    const onResize = () => place();
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
    active = { layer: layer, onKey: onKey, onResize: onResize };
    place();
  }

  /** First visit only: a small card offering the tour. */
  function offer() {
    if (seen() || document.querySelector('.fgt-offer')) return;
    const card = document.createElement('div');
    card.className = 'fgt-offer';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Take the tour?');
    card.innerHTML = '<div class="fgt-offer-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-6"/></svg></div>'
      + '<div class="fgt-offer-text"><b>New to the Flux Grapher?</b><span>A one-minute tour of what it can do.</span></div>'
      + '<button type="button" class="fgt-offer-no">No thanks</button>'
      + '<button type="button" class="fgt-offer-yes">Show me</button>';
    document.body.appendChild(card);
    const close = (mark) => {
      card.classList.add('is-out');
      setTimeout(() => { if (card.parentNode) card.parentNode.removeChild(card); }, 200);
      if (mark) markSeen(mark);
    };
    card.querySelector('.fgt-offer-no').addEventListener('click', () => close('declined'));
    card.querySelector('.fgt-offer-yes').addEventListener('click', () => { close(null); start(); });
  }

  window.FluxGrapherTour = { start: start, offer: offer, end: end, SEEN_KEY: SEEN_KEY };
})();
