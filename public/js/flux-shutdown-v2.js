/**
 * Daily shutdown v2 — reflection + tomorrow preview + optional AI coach line.
 * Flag: enable_shutdown_v2 (default off). Falls back to legacy dailyShutdown in app.js.
 */
(function () {
  'use strict';

  const STORE_KEY = 'flux_shutdown_v2_log_v1';
  const MAX_LOG = 60;

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_shutdown_v2', false);
    } catch (_) {
      return false;
    }
  }

  function todayStr() {
    if (typeof window.todayStr === 'function') return window.todayStr();
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function tomorrowStr() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function taskList() {
    return typeof tasks !== 'undefined' && Array.isArray(tasks) ? tasks : [];
  }

  function sessionLogList() {
    return typeof sessionLog !== 'undefined' && Array.isArray(sessionLog) ? sessionLog : [];
  }

  function gatherStats() {
    const ts = todayStr();
    const tm = tomorrowStr();
    const all = taskList();
    const completed = all.filter(
      (t) =>
        t &&
        t.done &&
        t.completedAt &&
        new Date(t.completedAt).toISOString().slice(0, 10) === ts,
    );
    const planned = all.filter((t) => t && t.date === ts);
    const eff = planned.length ? Math.round((completed.length / planned.length) * 100) : 100;
    const focusMins = sessionLogList()
      .filter((s) => s && s.date === ts)
      .reduce((sum, s) => sum + (Number(s.mins) || 0), 0);
    const tomorrow = all
      .filter((t) => t && !t.done && t.date === tm)
      .sort((a, b) => {
        const pw = { high: 3, med: 2, low: 1 };
        return (pw[b.priority] || 1) - (pw[a.priority] || 1);
      })
      .slice(0, 5);
    const carried = all.filter((t) => t && !t.done && t.date && t.date < ts).length;
    return { ts, tm, completed, planned, eff, focusMins, tomorrow, carried };
  }

  function appendLog(entry) {
    try {
      const fs = window.FluxStorage;
      let log = [];
      if (fs && typeof fs.load === 'function') log = fs.load(STORE_KEY, []) || [];
      else if (typeof load === 'function') log = load(STORE_KEY, []) || [];
      if (!Array.isArray(log)) log = [];
      log.push(entry);
      if (log.length > MAX_LOG) log = log.slice(-MAX_LOG);
      if (fs && typeof fs.save === 'function') fs.save(STORE_KEY, log);
      else if (typeof save === 'function') save(STORE_KEY, log);
    } catch (_) {}
  }

  async function fetchAiSummary(stats, reflection) {
    if (typeof API === 'undefined' || !API.ai || typeof fluxAuthHeaders !== 'function') return '';
    try {
      const names = stats.completed.map((t) => t.name).slice(0, 6).join(', ') || 'light day';
      const tmPrev =
        stats.tomorrow.map((t) => t.name).slice(0, 4).join(', ') || 'nothing scheduled yet';
      const res = await fetch(API.ai, {
        method: 'POST',
        headers: await fluxAuthHeaders(),
        body: JSON.stringify({
          system:
            'You are a supportive academic coach. Be warm and brief (2 sentences max). No markdown.',
          messages: [
            {
              role: 'user',
              content: `Shutdown reflection. Completed: ${names}. Efficiency ${stats.eff}%. Focus ${stats.focusMins}m. Win: ${reflection.win || '—'}. Blocker: ${reflection.blocker || '—'}. Energy/5: ${reflection.energy}. Tomorrow: ${tmPrev}. One encouraging closing line.`,
            },
          ],
        }),
      });
      const data = await res.json();
      return String(data.content?.[0]?.text || '')
        .replace(/```[\s\S]*?```/g, '')
        .trim();
    } catch (_) {
      return '';
    }
  }

  function closePanel() {
    document.getElementById('shutdownPanel')?.remove();
  }

  async function finishShutdown(panel, stats) {
    const win = panel.querySelector('#fluxShutdownWin')?.value?.trim() || '';
    const blocker = panel.querySelector('#fluxShutdownBlocker')?.value?.trim() || '';
    const energy = Number(panel.querySelector('#fluxShutdownEnergy')?.value) || 3;
    const summaryEl = panel.querySelector('#shutdownSummary');
    if (summaryEl) {
      summaryEl.innerHTML =
        '<span class="flux-shutdown-summary-loading">✦ Saving reflection…</span>';
    }
    const reflection = { win, blocker, energy };
    const aiLine = await fetchAiSummary(stats, reflection);
    appendLog({
      date: stats.ts,
      ...reflection,
      stats: {
        completed: stats.completed.length,
        eff: stats.eff,
        focusMins: stats.focusMins,
        tomorrowCount: stats.tomorrow.length,
      },
      aiLine,
      savedAt: new Date().toISOString(),
    });
    if (summaryEl) {
      summaryEl.textContent =
        aiLine ||
        (stats.completed.length
          ? `Logged. ${stats.completed.length} win(s) today — rest up.`
          : 'Logged. Tomorrow is a fresh start.');
    }
    const btn = panel.querySelector('#fluxShutdownDoneBtn');
    if (btn) {
      btn.textContent = 'Good night ✓';
      btn.onclick = closePanel;
    }
    try {
      if (typeof FluxBus !== 'undefined') {
        FluxBus.emit('shutdown_completed', { date: stats.ts, energy });
      }
    } catch (_) {}
  }

  function renderTomorrowList(items) {
    if (!items.length) {
      return '<p class="flux-shutdown-empty">Nothing on the calendar for tomorrow yet — add one anchor task.</p>';
    }
    return `<ul class="flux-shutdown-tomorrow-list">${items
      .map(
        (t) =>
          `<li><span class="flux-shutdown-pri flux-shutdown-pri-${esc(t.priority || 'med')}">${esc(t.priority || 'med')}</span> ${esc(t.name)}${t.estTime ? ` <span class="flux-shutdown-est">${t.estTime}m</span>` : ''}</li>`,
      )
      .join('')}</ul>`;
  }

  async function run() {
    const existing = document.getElementById('shutdownPanel');
    if (existing) {
      existing.remove();
      return;
    }

    const stats = gatherStats();
    const panel = document.createElement('div');
    panel.id = 'shutdownPanel';
    panel.className = 'flux-shutdown-v2-overlay';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Daily shutdown');

    const dateLabel = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    panel.innerHTML = `
      <div class="flux-shutdown-v2-card">
        <div class="flux-shutdown-v2-head">
          <span class="flux-shutdown-v2-icon" aria-hidden="true">🌙</span>
          <div>
            <h2 class="flux-shutdown-v2-title">Daily Shutdown</h2>
            <p class="flux-shutdown-v2-date">${esc(dateLabel)}</p>
          </div>
          <button type="button" class="flux-shutdown-close" aria-label="Close" data-flux-shutdown-close>✕</button>
        </div>
        <div class="flux-shutdown-stats">
          <div class="flux-shutdown-stat"><span class="flux-shutdown-stat-n">${stats.completed.length}</span><span class="flux-shutdown-stat-l">Done</span></div>
          <div class="flux-shutdown-stat"><span class="flux-shutdown-stat-n">${stats.eff}%</span><span class="flux-shutdown-stat-l">Efficiency</span></div>
          <div class="flux-shutdown-stat"><span class="flux-shutdown-stat-n">${stats.focusMins}m</span><span class="flux-shutdown-stat-l">Focus</span></div>
          <div class="flux-shutdown-stat"><span class="flux-shutdown-stat-n">${stats.carried}</span><span class="flux-shutdown-stat-l">Carried</span></div>
        </div>
        <section class="flux-shutdown-section">
          <h3 class="flux-shutdown-section-title">Reflect</h3>
          <label class="flux-shutdown-label" for="fluxShutdownWin">Today's win</label>
          <textarea id="fluxShutdownWin" class="flux-shutdown-input" rows="2" placeholder="One thing that went well…" maxlength="400"></textarea>
          <label class="flux-shutdown-label" for="fluxShutdownBlocker">What got in the way?</label>
          <textarea id="fluxShutdownBlocker" class="flux-shutdown-input" rows="2" placeholder="Optional — be kind to yourself" maxlength="400"></textarea>
          <label class="flux-shutdown-label" for="fluxShutdownEnergy">Energy now (1–5)</label>
          <input id="fluxShutdownEnergy" type="range" min="1" max="5" step="1" value="3" class="flux-shutdown-range" />
        </section>
        <section class="flux-shutdown-section">
          <h3 class="flux-shutdown-section-title">Tomorrow preview</h3>
          ${renderTomorrowList(stats.tomorrow)}
        </section>
        <div id="shutdownSummary" class="flux-shutdown-summary" aria-live="polite">
          <span class="flux-shutdown-summary-placeholder">Coach note appears when you finish.</span>
        </div>
        <button type="button" id="fluxShutdownDoneBtn" class="flux-shutdown-primary">Finish shutdown</button>
      </div>`;

    document.body.appendChild(panel);
    panel.querySelector('[data-flux-shutdown-close]')?.addEventListener('click', closePanel);
    panel.addEventListener('click', (e) => {
      if (e.target === panel) closePanel();
    });
    panel.querySelector('#fluxShutdownDoneBtn')?.addEventListener('click', () => {
      finishShutdown(panel, stats);
    });

    return stats;
  }

  function ensureEntryButton() {
    if (!enabled() || document.getElementById('fluxShutdownEntryBtn')) return;
    const host =
      document.querySelector('.dash-v2-work-head') || document.getElementById('dashHero');
    if (!host) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'fluxShutdownEntryBtn';
    btn.className = 'flux-shutdown-entry-btn';
    btn.textContent = '🌙 Shutdown';
    btn.title = 'Daily shutdown — reflect and preview tomorrow';
    btn.addEventListener('click', () => {
      run();
    });
    host.appendChild(btn);
  }

  function install() {
    if (!enabled()) return false;
    ensureEntryButton();
    return true;
  }

  window.FluxShutdownV2 = {
    enabled,
    run,
    install,
    gatherStats,
    STORE_KEY,
  };
})();
