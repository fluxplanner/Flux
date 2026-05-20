/**
 * Predictive insights v2 — read-only dashboard layer (no auto-actions).
 * Flag: enable_predict_v2 (default off). Legacy gap-fill in app.js when off.
 */
(function () {
  'use strict';

  const HOST_ID = 'fluxPredictV2Host';
  const STORE_KEY = 'flux_predict_v2_last_v1';

  let _lastInsightKey = '';

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_predict_v2', false);
    } catch (_) {
      return false;
    }
  }

  function todayStr() {
    if (typeof window.todayStr === 'function') return window.todayStr();
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function taskList() {
    return typeof tasks !== 'undefined' && Array.isArray(tasks) ? tasks : [];
  }

  function classList() {
    return typeof classes !== 'undefined' && Array.isArray(classes) ? classes : [];
  }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeAttr(s) {
    return esc(s).replace(/"/g, '&quot;');
  }

  function computeSlots() {
    if (typeof window.fluxComputeFreeSlots === 'function') {
      return window.fluxComputeFreeSlots();
    }
    return [];
  }

  function fmtTime(min) {
    if (typeof window.fluxFmtTimeMin === 'function') return window.fluxFmtTimeMin(min);
    const h = Math.floor(min / 60);
    const m = min % 60;
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = ((h + 11) % 12) + 1;
    return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`;
  }

  function deadlineRisk(task) {
    if (typeof calcDeadlineRisk === 'function') return calcDeadlineRisk(task);
    return 0;
  }

  function riskLabel(r) {
    if (typeof getRiskLabel === 'function') return getRiskLabel(r);
    if (r >= 0.8) return { label: 'Critical', color: 'var(--red)' };
    if (r >= 0.5) return { label: 'At Risk', color: 'var(--gold)' };
    if (r >= 0.25) return { label: 'Watch', color: 'var(--accent)' };
    return null;
  }

  function atRiskTasks(limit) {
    const max = limit || 5;
    return taskList()
      .filter((t) => t && !t.done && t.date)
      .map((t) => ({ task: t, risk: deadlineRisk(t) }))
      .filter((x) => x.risk >= 0.25)
      .sort((a, b) => b.risk - a.risk)
      .slice(0, max);
  }

  function overloadWeek() {
    const ts = todayStr();
    const end = new Date(`${ts}T12:00:00`);
    end.setDate(end.getDate() + 7);
    const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    let dueMins = 0;
    let dueCount = 0;
    taskList().forEach((t) => {
      if (!t || t.done || !t.date || t.date < ts || t.date > endStr) return;
      dueMins += Number(t.estTime) > 0 ? Number(t.estTime) : 30;
      dueCount += 1;
    });
    const capacityMins = 7 * 180;
    const ratio = capacityMins > 0 ? dueMins / capacityMins : 0;
    let level = 'ok';
    if (ratio >= 1.2) level = 'high';
    else if (ratio >= 0.85) level = 'elevated';
    return { dueMins, dueCount, capacityMins, ratio, level, endStr };
  }

  function gapSuggestions() {
    const slots = computeSlots();
    if (!slots.length) return [];
    const beh = window.FluxBehavior;
    if (beh && typeof beh.suggestForGaps === 'function') {
      return beh.suggestForGaps(slots, taskList()).filter((s) => s && s.task);
    }
    return slots.map((slot) => ({ slot, task: null })).filter((s) => s.task);
  }

  function emitTelemetry(kind, meta) {
    try {
      if (typeof FluxBus !== 'undefined' && FluxBus.emit) {
        FluxBus.emit('predict_insight_shown', { kind, ...meta });
      }
    } catch (_) {}
  }

  function ensureHost() {
    let host = document.getElementById(HOST_ID);
    if (host) return host;
    const gap = document.getElementById('fluxGapFillCard');
    const wrap = document.getElementById('fluxDashSections');
    if (!wrap) return null;
    host = document.createElement('div');
    host.id = HOST_ID;
    host.dataset.fluxSection = 'predict';
    host.style.display = 'none';
    if (gap && gap.parentNode === wrap) {
      gap.insertAdjacentElement('afterend', host);
    } else {
      wrap.prepend(host);
    }
    return host;
  }

  function renderInsightsPanel() {
    const host = ensureHost();
    if (!host) return;

    const atRisk = atRiskTasks(5);
    const load = overloadWeek();
    const cog =
      window.FluxCognitiveV2?.enabled?.() && typeof FluxCognitiveV2.get === 'function'
        ? FluxCognitiveV2.get()
        : null;

    if (!atRisk.length && load.level === 'ok' && !cog) {
      host.style.display = 'none';
      host.innerHTML = '';
      return;
    }

    host.style.display = '';
    const loadLine =
      load.level !== 'ok'
        ? `<div class="flux-predict-row flux-predict-row--${load.level}">
            <span class="flux-predict-row-icon" aria-hidden="true">📊</span>
            <div>
              <div class="flux-predict-row-title">Next 7 days look ${load.level === 'high' ? 'heavy' : 'busy'}</div>
              <div class="flux-predict-row-meta">~${load.dueMins}m planned across ${load.dueCount} task${load.dueCount === 1 ? '' : 's'} (heuristic capacity ~${load.capacityMins}m)</div>
            </div>
          </div>`
        : '';

    const cogLine = cog
      ? `<div class="flux-predict-row flux-predict-row--cog">
          <span class="flux-predict-row-icon" aria-hidden="true">🧠</span>
          <div>
            <div class="flux-predict-row-title">Cognitive load: ${esc(cog.label || cog.level)} (${cog.score}%)</div>
            <div class="flux-predict-row-meta">Insight only — no tasks will be moved or created.</div>
          </div>
        </div>`
      : '';

    const riskRows = atRisk
      .map(({ task, risk }) => {
        const rl = riskLabel(risk);
        const pct = Math.round(risk * 100);
        return `<div class="flux-predict-risk-row">
          <span class="flux-predict-risk-pct" style="color:${rl ? rl.color : 'var(--muted)'}">${pct}%</span>
          <div class="flux-predict-risk-body">
            <div class="flux-predict-risk-name">${esc(task.name)}</div>
            <div class="flux-predict-risk-meta">${esc(task.date || '')} · ${esc(rl ? rl.label : 'Watch')}</div>
          </div>
          <button type="button" class="flux-predict-view-btn" onclick="openEdit(${task.id})" title="View task">View</button>
        </div>`;
      })
      .join('');

    host.innerHTML = `
      <div class="card flux-predict-card">
        <div class="flux-predict-head">
          <span class="flux-predict-icon" aria-hidden="true">🔮</span>
          <div>
            <div class="flux-predict-kicker">Predictive insights</div>
            <h3 class="flux-predict-title">Read-only — you stay in control</h3>
          </div>
        </div>
        ${loadLine}${cogLine}
        ${
          atRisk.length
            ? `<div class="flux-predict-section">
            <div class="flux-predict-section-label">Deadline risk</div>
            <div class="flux-predict-risk-list">${riskRows}</div>
          </div>`
            : ''
        }
      </div>`;

    const key = `${atRisk.length}:${load.level}:${cog ? cog.score : ''}`;
    if (key !== _lastInsightKey) {
      _lastInsightKey = key;
      emitTelemetry('panel', {
        at_risk_count: atRisk.length,
        overload_level: load.level,
        cognitive_score: cog ? cog.score : null,
      });
    }
  }

  function renderGapFill() {
    const el = document.getElementById('fluxGapFillCard');
    if (!el) return;

    const filled = gapSuggestions();
    if (!filled.length) {
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }

    el.style.display = '';
    el.innerHTML = `
      <div class="card flux-gap-card flux-predict-gap">
        <div class="flux-gap-head">
          <span class="flux-gap-icon" aria-hidden="true">🧩</span>
          <div>
            <div class="flux-gap-kicker">Predictive gap-fill</div>
            <h3 class="flux-gap-title">Free pockets between classes</h3>
            <p class="flux-predict-disclaimer">Suggestions only — nothing is scheduled automatically.</p>
          </div>
        </div>
        <div class="flux-gap-list">
          ${filled
            .slice(0, 3)
            .map(({ slot, task }) => {
              const mins = Math.max(0, slot.endMin - slot.startMin);
              return `
          <div class="flux-gap-row">
            <div class="flux-gap-row-time">
              <div class="flux-gap-row-window">${esc(fmtTime(slot.startMin))} – ${esc(fmtTime(slot.endMin))}</div>
              <div class="flux-gap-row-mins">${mins} min free</div>
            </div>
            <div class="flux-gap-row-task" title="${escapeAttr(task.name)}">
              <div class="flux-gap-row-name">${esc(task.name)}</div>
              <div class="flux-gap-row-meta">${esc(task.subject || 'no subject')} · est ${task.estTime || '?'}m</div>
            </div>
            <button type="button" class="flux-gap-row-cta flux-predict-view-btn" onclick="openEdit(${task.id})">View →</button>
          </div>`;
            })
            .join('')}
        </div>
      </div>`;

    emitTelemetry('gap_fill', { slot_count: filled.length });
  }

  function renderAll() {
    if (!enabled()) return;
    renderInsightsPanel();
    renderGapFill();
    try {
      const fs = window.FluxStorage;
      const snap = { at: Date.now(), overload: overloadWeek().level };
      if (fs && typeof fs.save === 'function') fs.save(STORE_KEY, snap);
      else if (typeof save === 'function') save(STORE_KEY, snap);
    } catch (_) {}
  }

  function install() {
    if (!enabled()) {
      const host = document.getElementById(HOST_ID);
      if (host) {
        host.style.display = 'none';
        host.innerHTML = '';
      }
      return false;
    }
    renderAll();
    return true;
  }

  window.FluxPredictV2 = {
    enabled,
    renderAll,
    renderGapFill,
    renderInsightsPanel,
    atRiskTasks,
    overloadWeek,
    gapSuggestions,
    install,
    STORE_KEY,
  };
})();
