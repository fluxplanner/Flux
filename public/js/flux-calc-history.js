/**
 * P36.1 — Calc history tape + saved graph plot library.
 * Flag: enable_calc_history (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_calc_history';
  const STORE_KEY = 'flux_calc_history_v1';
  const OVERLAY_ID = 'fluxCalcHistOverlay';
  const BAR_ID = 'fluxCalcHistoryBar';
  const MAX_TAPE = 150;
  const MAX_PLOTS = 30;

  let activeTab = 'tape';
  let tapeListener = null;
  let domObserver = null;

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled(FLAG, false);
    } catch (_) {
      return false;
    }
  }

  function load(k, def) {
    if (typeof window.load === 'function') return window.load(k, def);
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : def;
    } catch (_) {
      return def;
    }
  }

  function save(k, v) {
    if (typeof window.save === 'function') window.save(k, v);
    else {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (_) {}
    }
  }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function T(key, vars) {
    if (typeof window.fluxT === 'function') return window.fluxT(key, vars);
    return key;
  }

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') window.showToast(msg, kind || 'info');
  }

  function uid() {
    return 'ch_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function getStore() {
    const s = load(STORE_KEY, {});
    return {
      tape: Array.isArray(s.tape) ? s.tape : [],
      plots: Array.isArray(s.plots) ? s.plots : [],
      exports: s.exports || 0,
    };
  }

  function persistStore(data) {
    save(STORE_KEY, data);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('calcHistory', getCloudSlice());
    } catch (_) {}
  }

  function getCloudSlice() {
    const s = getStore();
    return { tape: s.tape, plots: s.plots, exports: s.exports };
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    const cur = getStore();
    persistStore({
      tape: Array.isArray(data.tape) ? data.tape : cur.tape,
      plots: Array.isArray(data.plots) ? data.plots : cur.plots,
      exports: data.exports != null ? data.exports : cur.exports,
    });
  }

  function evalExpr(expr) {
    const raw = String(expr || '').trim();
    if (!raw) return null;
    const gc = window.fluxGc;
    if (gc && typeof gc.compileExpr === 'function') {
      try {
        const fn = gc.compileExpr(raw);
        const v = fn(0);
        return isFinite(v) ? v : null;
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  function addTapeEntry(expr, result, source) {
    const e = String(expr || '').trim();
    const r = String(result ?? '').trim();
    if (!e && !r) return false;
    const s = getStore();
    s.tape.unshift({
      id: uid(),
      expr: e,
      result: r,
      source: source || 'manual',
      ts: Date.now(),
    });
    if (s.tape.length > MAX_TAPE) s.tape.length = MAX_TAPE;
    persistStore(s);
    return true;
  }

  function readToolboxPlot() {
    const canvas = document.getElementById('gcCanvas');
    if (!canvas) return null;
    const curves = [];
    document.querySelectorAll('.gc-expr').forEach((inp, i) => {
      const expr = String(inp.value || '').trim();
      const toggle = document.querySelector(`.gc-toggle[data-i="${i}"]`);
      const on = toggle ? toggle.getAttribute('aria-pressed') !== 'false' : true;
      const row = inp.closest('.ti84-eqn-row');
      const color =
        (row && getComputedStyle(row).getPropertyValue('--ti-trace').trim()) ||
        ['#7c9eff', '#5eead4', '#a78bfa', '#f472b6'][i % 4];
      if (expr) curves.push({ expr, color, on });
    });
    if (!curves.length) return null;
    const num = id => {
      const el = document.getElementById(id);
      const v = el ? parseFloat(el.value) : NaN;
      return isFinite(v) ? v : null;
    };
    const xMin = num('gcXmin');
    const xMax = num('gcXmax');
    const yMin = num('gcYmin');
    const yMax = num('gcYmax');
    if (xMin == null || xMax == null || yMin == null || yMax == null) return null;
    const radBtn = document.getElementById('gcModeRad');
    const angleMode =
      radBtn && radBtn.getAttribute('aria-pressed') === 'true' ? 'rad' : 'deg';
    let thumb = '';
    try {
      thumb = canvas.toDataURL('image/jpeg', 0.72);
    } catch (_) {}
    const title =
      curves.find(c => c.on)?.expr?.slice(0, 48) ||
      curves[0].expr.slice(0, 48) ||
      T('calch.plot_untitled');
    return {
      id: uid(),
      title,
      curves,
      view: { xMin, xMax, yMin, yMax },
      angleMode,
      thumb,
      savedAt: Date.now(),
    };
  }

  function savePlotFromToolbox() {
    const plot = readToolboxPlot();
    if (!plot) {
      toast(T('calch.no_plot'), 'warn');
      return false;
    }
    const s = getStore();
    s.plots.unshift(plot);
    if (s.plots.length > MAX_PLOTS) s.plots.length = MAX_PLOTS;
    persistStore(s);
    toast(T('calch.plot_saved'), 'success');
    return true;
  }

  function renderPlotToCanvas(canvas, plot) {
    const ctx = canvas.getContext('2d');
    if (!ctx || !plot?.view) return;
    const W = canvas.width;
    const H = canvas.height;
    const view = plot.view;
    const xr = view.xMax - view.xMin;
    const yr = view.yMax - view.yMin;
    const toSx = x => ((x - view.xMin) / xr) * W;
    const toSy = y => H - ((y - view.yMin) / yr) * H;
    const gc = window.fluxGc;
    const prevMode = gc?.getAngleMode?.();
    if (gc?.setAngleMode && plot.angleMode) gc.setAngleMode(plot.angleMode);
    ctx.fillStyle = '#121826';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    const stepX = Math.pow(10, Math.floor(Math.log10(Math.max(xr / 8, 1e-9))));
    for (let x = Math.ceil(view.xMin / stepX) * stepX; x <= view.xMax; x += stepX) {
      const sx = toSx(x);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, H);
      ctx.stroke();
    }
    const stepY = Math.pow(10, Math.floor(Math.log10(Math.max(yr / 6, 1e-9))));
    for (let y = Math.ceil(view.yMin / stepY) * stepY; y <= view.yMax; y += stepY) {
      const sy = toSy(y);
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(W, sy);
      ctx.stroke();
    }
    (plot.curves || []).forEach(c => {
      if (!c.on || !c.expr?.trim()) return;
      let fn;
      try {
        fn = gc?.compileExpr ? gc.compileExpr(c.expr) : null;
      } catch (_) {
        fn = null;
      }
      if (!fn) return;
      ctx.strokeStyle = c.color || '#7c9eff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;
      const n = Math.max(180, W);
      for (let i = 0; i <= n; i++) {
        const x = view.xMin + (i / n) * xr;
        let y;
        try {
          y = fn(x);
        } catch (_) {
          y = NaN;
        }
        if (!isFinite(y)) {
          started = false;
          continue;
        }
        const sx = toSx(x);
        const sy = toSy(y);
        if (!started) {
          ctx.moveTo(sx, sy);
          started = true;
        } else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    });
    if (gc?.setAngleMode && prevMode) gc.setAngleMode(prevMode);
  }

  function downloadBlob(filename, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  function exportPlotPng(plot) {
    const c = document.createElement('canvas');
    c.width = 900;
    c.height = 500;
    renderPlotToCanvas(c, plot);
    c.toBlob(blob => {
      if (!blob) return;
      downloadBlob('flux-plot-' + (plot.id || 'export') + '.png', blob);
      const s = getStore();
      s.exports = (s.exports || 0) + 1;
      persistStore(s);
      toast(T('calch.png_exported'), 'success');
    }, 'image/png');
  }

  function exportPlotSvg(plot) {
    const view = plot.view;
    const W = 900;
    const H = 500;
    const xr = view.xMax - view.xMin;
    const yr = view.yMax - view.yMin;
    const toSx = x => ((x - view.xMin) / xr) * W;
    const toSy = y => H - ((y - view.yMin) / yr) * H;
    const gc = window.fluxGc;
    const prevMode = gc?.getAngleMode?.();
    if (gc?.setAngleMode && plot.angleMode) gc.setAngleMode(plot.angleMode);
    let paths = '';
    (plot.curves || []).forEach(c => {
      if (!c.on || !c.expr?.trim()) return;
      let fn;
      try {
        fn = gc?.compileExpr ? gc.compileExpr(c.expr) : null;
      } catch (_) {
        fn = null;
      }
      if (!fn) return;
      const pts = [];
      const n = 400;
      for (let i = 0; i <= n; i++) {
        const x = view.xMin + (i / n) * xr;
        let y;
        try {
          y = fn(x);
        } catch (_) {
          y = NaN;
        }
        if (isFinite(y)) pts.push(`${toSx(x).toFixed(2)},${toSy(y).toFixed(2)}`);
      }
      if (pts.length > 1) {
        paths += `<polyline fill="none" stroke="${esc(c.color || '#7c9eff')}" stroke-width="2" points="${pts.join(' ')}"/>`;
      }
    });
    if (gc?.setAngleMode && prevMode) gc.setAngleMode(prevMode);
    const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#121826"/>${paths}</svg>`;
    downloadBlob('flux-plot-' + (plot.id || 'export') + '.svg', new Blob([svg], { type: 'image/svg+xml' }));
    const s = getStore();
    s.exports = (s.exports || 0) + 1;
    persistStore(s);
    toast(T('calch.svg_exported'), 'success');
  }

  function exportTapeTxt() {
    const s = getStore();
    if (!s.tape.length) {
      toast(T('calch.no_tape'), 'warn');
      return;
    }
    const lines = s.tape.map(
      row => `${row.expr} = ${row.result}${row.ts ? '  // ' + new Date(row.ts).toLocaleString() : ''}`
    );
    downloadBlob('flux-calc-tape.txt', new Blob([lines.join('\n')], { type: 'text/plain' }));
    s.exports = (s.exports || 0) + 1;
    persistStore(s);
    toast(T('calch.tape_exported'), 'success');
  }

  function exportTapeToNote() {
    const s = getStore();
    if (!s.tape.length) {
      toast(T('calch.no_tape'), 'warn');
      return;
    }
    const ed =
      document.querySelector('#noteEditor') ||
      document.querySelector('.note-editor textarea') ||
      document.querySelector('[contenteditable="true"].note-body');
    if (!ed) {
      toast(T('calch.open_note'), 'warn');
      return;
    }
    const block =
      '## Calculator tape\n\n' +
      s.tape
        .slice(0, 40)
        .map(r => `- \`${r.expr}\` → **${r.result}**`)
        .join('\n') +
      '\n';
    if (ed.tagName === 'TEXTAREA' || ed.tagName === 'INPUT') {
      ed.value = (ed.value || '') + (ed.value ? '\n\n' : '') + block;
      ed.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      ed.innerHTML = (ed.innerHTML || '') + '<p>' + esc(block).replace(/\n/g, '<br>') + '</p>';
    }
    toast(T('calch.tape_inserted'), 'success');
  }

  function closeOverlay() {
    document.getElementById(OVERLAY_ID)?.remove();
  }

  function renderOverlay() {
    closeOverlay();
    const s = getStore();
    const tapeHtml = s.tape.length
      ? s.tape
          .map(
            row => `<div class="flux-calc-hist-tape-row" data-id="${esc(row.id)}">
          <span class="flux-calc-hist-tape-expr">${esc(row.expr)}</span>
          <span class="flux-calc-hist-tape-res">= ${esc(row.result)}</span>
          <button type="button" class="btn btn--ghost btn--xs flux-calc-hist-del-tape" data-id="${esc(row.id)}">×</button>
        </div>`
          )
          .join('')
      : `<p class="flux-calc-hist-empty">${esc(T('calch.tape_empty'))}</p>`;

    const plotsHtml = s.plots.length
      ? `<div class="flux-calc-hist-plot-grid">${s.plots
          .map(p => {
            const eqns = (p.curves || [])
              .filter(c => c.expr)
              .map(c => esc(c.expr))
              .join(', ');
            const thumb = p.thumb
              ? `<img class="flux-calc-hist-plot-thumb" src="${esc(p.thumb)}" alt="">`
              : `<canvas class="flux-calc-hist-plot-thumb" data-plot-id="${esc(p.id)}" width="360" height="200"></canvas>`;
            return `<article class="flux-calc-hist-plot-card" data-id="${esc(p.id)}">
            ${thumb}
            <div class="flux-calc-hist-plot-meta">
              <div class="flux-calc-hist-plot-title">${esc(p.title)}</div>
              <div class="flux-calc-hist-plot-eqns">${eqns || '—'}</div>
              <div class="flux-calc-hist-plot-actions">
                <button type="button" class="btn btn--ghost btn--xs flux-calc-hist-png" data-id="${esc(p.id)}">PNG</button>
                <button type="button" class="btn btn--ghost btn--xs flux-calc-hist-svg" data-id="${esc(p.id)}">SVG</button>
                <button type="button" class="btn btn--ghost btn--xs flux-calc-hist-del-plot" data-id="${esc(p.id)}">×</button>
              </div>
            </div>
          </article>`;
          })
          .join('')}</div>`
      : `<p class="flux-calc-hist-empty">${esc(T('calch.plots_empty'))}</p>`;

    const el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.className = 'flux-calc-hist-overlay';
    el.innerHTML = `<div class="flux-calc-hist-panel" role="dialog" aria-labelledby="fluxCalcHistTitle">
      <div class="flux-calc-hist-head">
        <h2 id="fluxCalcHistTitle">${esc(T('calch.title'))}</h2>
        <button type="button" class="btn btn--ghost" id="fluxCalcHistClose">×</button>
      </div>
      <div class="flux-calc-hist-tabs" role="tablist">
        <button type="button" class="flux-calc-hist-tab" role="tab" data-tab="tape" aria-selected="${activeTab === 'tape'}">${esc(T('calch.tab_tape'))}</button>
        <button type="button" class="flux-calc-hist-tab" role="tab" data-tab="plots" aria-selected="${activeTab === 'plots'}">${esc(T('calch.tab_plots'))}</button>
      </div>
      <div class="flux-calc-hist-body">
        <div data-pane="tape" style="display:${activeTab === 'tape' ? 'block' : 'none'}">
          <div class="flux-calc-hist-add">
            <input type="text" id="fluxCalcHistExpr" placeholder="${esc(T('calch.expr_ph'))}" spellcheck="false">
            <button type="button" class="btn btn--primary btn--sm" id="fluxCalcHistEval">${esc(T('calch.eval'))}</button>
          </div>
          ${tapeHtml}
        </div>
        <div data-pane="plots" style="display:${activeTab === 'plots' ? 'block' : 'none'}">
          ${plotsHtml}
        </div>
      </div>
      <div class="flux-calc-hist-foot">
        <button type="button" class="btn btn--ghost btn--sm" id="fluxCalcHistExportTxt">${esc(T('calch.export_tape'))}</button>
        <button type="button" class="btn btn--ghost btn--sm" id="fluxCalcHistToNote">${esc(T('calch.to_note'))}</button>
        <button type="button" class="btn btn--ghost btn--sm" id="fluxCalcHistSavePlot">${esc(T('calch.save_plot'))}</button>
      </div>
    </div>`;
    document.body.appendChild(el);

    el.querySelector('#fluxCalcHistClose')?.addEventListener('click', closeOverlay);
    el.addEventListener('click', e => {
      if (e.target === el) closeOverlay();
    });

    el.querySelectorAll('.flux-calc-hist-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab') || 'tape';
        renderOverlay();
      });
    });

    el.querySelector('#fluxCalcHistEval')?.addEventListener('click', () => {
      const inp = el.querySelector('#fluxCalcHistExpr');
      const expr = inp?.value?.trim();
      if (!expr) return;
      const v = evalExpr(expr);
      if (v == null) {
        toast(T('calch.eval_fail'), 'warn');
        return;
      }
      const result = String(v);
      addTapeEntry(expr, result, 'manual');
      if (inp) inp.value = '';
      renderOverlay();
    });

    el.querySelector('#fluxCalcHistExportTxt')?.addEventListener('click', exportTapeTxt);
    el.querySelector('#fluxCalcHistToNote')?.addEventListener('click', exportTapeToNote);
    el.querySelector('#fluxCalcHistSavePlot')?.addEventListener('click', () => {
      if (savePlotFromToolbox()) {
        activeTab = 'plots';
        renderOverlay();
      }
    });

    el.querySelectorAll('.flux-calc-hist-del-tape').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const st = getStore();
        st.tape = st.tape.filter(x => x.id !== id);
        persistStore(st);
        renderOverlay();
      });
    });

    el.querySelectorAll('.flux-calc-hist-del-plot').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const st = getStore();
        st.plots = st.plots.filter(x => x.id !== id);
        persistStore(st);
        renderOverlay();
      });
    });

    el.querySelectorAll('.flux-calc-hist-png').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const plot = getStore().plots.find(x => x.id === id);
        if (plot) exportPlotPng(plot);
      });
    });

    el.querySelectorAll('.flux-calc-hist-svg').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const plot = getStore().plots.find(x => x.id === id);
        if (plot) exportPlotSvg(plot);
      });
    });

    el.querySelectorAll('canvas[data-plot-id]').forEach(cvs => {
      const id = cvs.getAttribute('data-plot-id');
      const plot = s.plots.find(x => x.id === id);
      if (plot) renderPlotToCanvas(cvs, plot);
    });
  }

  function openHistory(tab) {
    if (!enabled()) return;
    if (tab) activeTab = tab;
    renderOverlay();
  }

  function ensureToolboxBar() {
    if (!enabled()) return;
    if (document.getElementById(BAR_ID)) return;
    const calc = document.querySelector('.ti84-calc');
    if (!calc || !document.getElementById('gcCanvas')) return;
    const bar = document.createElement('div');
    bar.id = BAR_ID;
    bar.className = 'flux-calc-hist-bar';
    bar.innerHTML = `<span class="flux-calc-hist-bar__label">${esc(T('calch.bar_lead'))}</span>
      <button type="button" class="btn btn--ghost btn--sm" id="fluxCalcHistBarTape">${esc(T('calch.open_tape'))}</button>
      <button type="button" class="btn btn--primary btn--sm" id="fluxCalcHistBarSave">${esc(T('calch.save_plot'))}</button>`;
    const grid = calc.querySelector('.flux-calc-grid');
    if (grid) grid.before(bar);
    else calc.prepend(bar);
    bar.querySelector('#fluxCalcHistBarTape')?.addEventListener('click', () => openHistory('tape'));
    bar.querySelector('#fluxCalcHistBarSave')?.addEventListener('click', () => {
      if (savePlotFromToolbox()) openHistory('plots');
    });
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const qq = String(q || '').toLowerCase();
    const keys = ['calc history', 'calculator tape', 'save plot', 'graph library'];
    const label = T('calch.palette');
    if (!qq || keys.some(k => k.includes(qq) || qq.includes('calc') || qq.includes('plot'))) {
      return [
        { label: '📐 ' + label, sub: T('calch.palette_sub'), _keys: keys, action: () => openHistory('tape') },
        { label: '📈 ' + T('calch.save_plot'), sub: T('calch.palette_plot_sub'), _keys: ['save plot', 'graph'], action: () => savePlotFromToolbox() },
      ];
    }
    return [];
  }

  function install() {
    if (!enabled()) {
      document.getElementById(BAR_ID)?.remove();
      closeOverlay();
      if (tapeListener) {
        window.removeEventListener('flux-calc-tape', tapeListener);
        tapeListener = null;
      }
      if (domObserver) {
        domObserver.disconnect();
        domObserver = null;
      }
      return false;
    }

    if (!tapeListener) {
      tapeListener = e => {
        const d = e.detail || {};
        if (d.expr != null && d.result != null) addTapeEntry(d.expr, d.result, d.kind || 'basic');
      };
      window.addEventListener('flux-calc-tape', tapeListener);
    }

    ensureToolboxBar();
    if (!domObserver) {
      domObserver = new MutationObserver(() => ensureToolboxBar());
      domObserver.observe(document.body, { childList: true, subtree: true });
    }
    return true;
  }

  window.FluxCalcHistory = {
    FLAG,
    enabled,
    openHistory,
    savePlotFromToolbox,
    exportTapeToNote,
    exportPlotPng,
    getCloudSlice,
    applyFromCloud,
    getPaletteCommands,
    install,
  };
})();
