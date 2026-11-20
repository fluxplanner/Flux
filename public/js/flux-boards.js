/*
 * Boards — a chosen surface behind the planner (styles: flux-boards.css).
 *
 * State is one synced key, flux_board = { id, strength, blur, dim }:
 *   id        'plain' or one of BOARDS. 'plain' removes data-flux-bg entirely,
 *             so the default app is untouched rather than "board: none".
 *   strength  0.2–1, the board's opacity (how loud the pattern is).
 *   blur      0–12 px, softens busy boards behind text. Ignored on low-end.
 *   dim       1–2, multiplies the scrim. 1 is the contrast floor, never less.
 *
 * A board and a texture (flux_texture, app.js) both paint behind the planner,
 * so picking one clears the other: here via window.fluxSetTexture(''), and
 * fluxSetTexture() calls FluxBoards.clear().
 *
 * The settings card injects itself into Settings → Layout (#spane-appearance),
 * like the other self-installing cards. app.js calls FluxBoards.apply() after
 * a cloud pull so another device's choice shows without a reload.
 */
(function () {
  'use strict';
  var KEY = 'flux_board';
  var BOARDS = [
    ['plain', 'Plain'], ['grid', 'Grid'], ['dots', 'Dots'], ['lined', 'Lined paper'],
    ['graph', 'Graph paper'], ['blueprint', 'Blueprint'], ['chalk', 'Chalkboard'],
    ['cork', 'Corkboard'], ['linen', 'Linen'], ['aurora', 'Aurora'], ['topo', 'Contours'],
    ['waves', 'Waves'], ['stars', 'Night sky'],
  ];
  var IDS = BOARDS.map(function (b) { return b[0]; });
  var DEF = { id: 'plain', strength: 1, blur: 0, dim: 1 };

  function clamp(v, lo, hi, d) { v = Number(v); return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; }
  /* Synced data is untrusted shape-wise: an old or hand-edited value must not
     put an arbitrary string into an attribute selector or a calc(). */
  function read() {
    var raw = (typeof window.load === 'function' ? window.load(KEY, DEF) : DEF) || DEF;
    return {
      id: IDS.indexOf(raw.id) >= 0 ? raw.id : 'plain',
      strength: clamp(raw.strength, 0.2, 1, 1),
      blur: clamp(raw.blur, 0, 12, 0),
      dim: clamp(raw.dim, 1, 2, 1),
    };
  }
  function write(s) {
    if (typeof window.save === 'function') window.save(KEY, { id: s.id, strength: s.strength, blur: s.blur, dim: s.dim });
    try { if (typeof window.syncToCloud === 'function') window.syncToCloud(); } catch (e) {}
  }

  function apply(s) {
    s = s || read();
    var html = document.documentElement;
    var app = document.getElementById('app');
    if (s.id === 'plain') {
      html.removeAttribute('data-flux-bg');
      if (app) ['--fx-board-opacity', '--fx-board-blur', '--bg-scrim-strength'].forEach(function (p) { app.style.removeProperty(p); });
      if (app && !app.getAttribute('style')) app.removeAttribute('style');
      return;
    }
    html.setAttribute('data-flux-bg', s.id);
    if (app) {
      app.style.setProperty('--fx-board-opacity', String(s.strength));
      app.style.setProperty('--fx-board-blur', s.blur + 'px');
      app.style.setProperty('--bg-scrim-strength', String(s.dim));
    }
  }

  var FMT = {
    strength: function (v) { return Math.round(v * 100) + '%'; },
    blur: function (v) { return v + 'px'; },
    dim: function (v) { return '+' + Math.round((v - 1) * 100) + '%'; },
  };
  function slider(name, label, min, max, step, val) {
    return '<label>' + label
      + '<input type="range" data-bg="' + name + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '" aria-label="Board ' + label.toLowerCase() + '">'
      + '<output>' + FMT[name](val) + '</output></label>';
  }

  function render() {
    var pane = document.getElementById('spane-appearance');
    if (!pane) return;
    var card = document.getElementById('fxBoardsCard');
    if (!card) {
      card = document.createElement('div');
      card.className = 'card';
      card.id = 'fxBoardsCard';
      pane.insertBefore(card, pane.children[1] || null);
      card.addEventListener('click', onClick);
      card.addEventListener('keydown', onKey);
      card.addEventListener('input', onInput);
    }
    var s = read();
    card.innerHTML = '<h3>Boards</h3>'
      + '<p class="fx-hint">A surface behind your planner. Cards stay readable on every board.</p>'
      + '<div class="fx-bg-grid" role="group" aria-label="Board">'
      + BOARDS.map(function (b) {
        var on = b[0] === s.id;
        return '<button type="button" class="fx-bg-tile" data-board-id="' + b[0] + '" aria-pressed="' + on + '" tabindex="' + (on ? 0 : -1) + '">'
          + '<span class="fx-bg-swatch" data-board="' + b[0] + '" aria-hidden="true"></span>' + b[1] + '</button>';
      }).join('')
      + '</div>'
      + '<div class="fx-bg-sliders"' + (s.id === 'plain' ? ' hidden' : '') + '>'
      + slider('strength', 'Strength', 0.2, 1, 0.05, s.strength)
      + slider('blur', 'Blur', 0, 12, 1, s.blur)
      + slider('dim', 'Dim', 1, 2, 0.05, s.dim)
      + '<button type="button" class="fx-bg-reset" data-bg-reset>Reset board</button>'
      + '</div>';
  }

  function focusTile(id) {
    var t = document.querySelector('#fxBoardsCard .fx-bg-tile[data-board-id="' + id + '"]');
    if (t) t.focus();
  }
  function onClick(e) {
    var tile = e.target.closest('.fx-bg-tile');
    if (tile) {
      var s = read(); s.id = tile.getAttribute('data-board-id');
      if (s.id !== 'plain' && typeof window.fluxSetTexture === 'function') { try { window.fluxSetTexture(''); } catch (e2) {} }
      write(s); apply(s); render(); focusTile(s.id);
      return;
    }
    if (e.target.closest('[data-bg-reset]')) { write(DEF); apply(DEF); render(); focusTile('plain'); }
  }

  /* Roving tabindex: one Tab stop for the grid, arrows move between tiles. */
  function onKey(e) {
    var tile = e.target.closest && e.target.closest('.fx-bg-tile');
    if (!tile) return;
    var tiles = [].slice.call(document.querySelectorAll('#fxBoardsCard .fx-bg-tile'));
    var i = tiles.indexOf(tile);
    var cols = Math.max(1, Math.round(tile.parentElement.clientWidth / (tile.offsetWidth + 10)));
    var n = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols, Home: -i, End: tiles.length - 1 - i }[e.key];
    if (n == null) return;
    e.preventDefault();
    var next = tiles[Math.min(tiles.length - 1, Math.max(0, i + n))];
    tiles.forEach(function (t) { t.tabIndex = t === next ? 0 : -1; });
    next.focus();
  }

  var saveTimer = 0;
  function onInput(e) {
    var name = e.target.getAttribute && e.target.getAttribute('data-bg');
    if (!name) return;
    var s = read();
    s[name] = Number(e.target.value);
    apply(s);
    e.target.nextElementSibling.textContent = FMT[name](s[name]);
    // A drag fires dozens of inputs; save and sync once it settles.
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { write(s); }, 300);
  }

  window.FluxBoards = Object.freeze({
    apply: function () { apply(); render(); },
    clear: function () { if (read().id === 'plain') return; write(DEF); apply(DEF); render(); },
    ids: IDS.slice() });

  apply();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { apply(); render(); });
  else render();
})();
