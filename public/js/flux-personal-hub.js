/**
 * FluxPersonalHub — personal-life tools. LOCAL ONLY (never Supabase school tables).
 * Grocery, brain dump, mood/energy — isolated from admin visibility.
 */
(function () {
  'use strict';

  const PREFIX = 'flux_personal_hub_v1_';

  function key(suffix) {
    const u =
      (typeof currentUser !== 'undefined' && currentUser?.id) ||
      (window.currentUser && window.currentUser.id) ||
      'guest';
    try {
      if (typeof fluxNamespacedKey === 'function') return fluxNamespacedKey(PREFIX + suffix + '_' + u);
    } catch (_) {}
    return PREFIX + suffix + '_' + u;
  }

  function loadK(suffix, def) {
    try {
      const raw = localStorage.getItem(key(suffix));
      return raw != null ? JSON.parse(raw) : def;
    } catch (_) {
      return def;
    }
  }

  function saveK(suffix, val) {
    try {
      localStorage.setItem(key(suffix), JSON.stringify(val));
    } catch (_) {}
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderBrainDump(mount) {
    const today = new Date().toISOString().slice(0, 10);
    const data = loadK('brain_dump', { text: '', date: today });
    mount.innerHTML = `
      <p class="flux-widget-hint">Clears nightly — stored only in your browser.</p>
      <textarea class="flux-ph-textarea" id="fluxBrainDump" rows="4" placeholder="Dump thoughts here…">${esc(data.text)}</textarea>
      <button type="button" class="btn-sec" style="font-size:.72rem;margin-top:6px" id="fluxBrainClear">Clear now</button>`;
    const ta = mount.querySelector('#fluxBrainDump');
    ta?.addEventListener('input', () => saveK('brain_dump', { text: ta.value, date: today }));
    mount.querySelector('#fluxBrainClear')?.addEventListener('click', () => {
      saveK('brain_dump', { text: '', date: today });
      ta.value = '';
      if (typeof showToast === 'function') showToast('Brain dump cleared', 'success');
    });
    if (data.date !== today) {
      saveK('brain_dump', { text: '', date: today });
      ta.value = '';
    }
  }

  function renderGrocery(mount) {
    const items = loadK('grocery', []);
    mount.innerHTML = `
      <p class="flux-widget-hint">Personal list — not synced to school.</p>
      <ul class="flux-ph-list" id="fluxGroceryList"></ul>
      <div style="display:flex;gap:6px;margin-top:8px">
        <input type="text" id="fluxGroceryIn" placeholder="Add item…" style="flex:1;font-size:.78rem"/>
        <button type="button" class="btn-sec" id="fluxGroceryAdd">Add</button>
      </div>`;
    const list = mount.querySelector('#fluxGroceryList');
    const paint = () => {
      list.innerHTML = items.length
        ? items
            .map(
              (it, i) => `
          <li><label><input type="checkbox" data-i="${i}" ${it.done ? 'checked' : ''}/> ${esc(it.label)}</label></li>`
            )
            .join('')
        : '<li class="flux-widget-planned">Empty list</li>';
      list.querySelectorAll('input[type=checkbox]').forEach((cb) => {
        cb.addEventListener('change', () => {
          const i = parseInt(cb.getAttribute('data-i'), 10);
          items[i].done = cb.checked;
          saveK('grocery', items);
        });
      });
    };
    paint();
    mount.querySelector('#fluxGroceryAdd')?.addEventListener('click', () => {
      const inp = mount.querySelector('#fluxGroceryIn');
      const v = (inp?.value || '').trim();
      if (!v) return;
      items.push({ label: v, done: false });
      saveK('grocery', items);
      inp.value = '';
      paint();
    });
  }

  function renderMoodEnergy(mount) {
    const log = loadK('mood_energy', []);
    mount.innerHTML = `
      <p class="flux-widget-hint">Track burnout signals privately (1–10).</p>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="range" min="1" max="10" value="5" id="fluxEnergyRange"/>
        <button type="button" class="btn-sec" id="fluxEnergyLog">Log</button>
      </div>
      <div id="fluxEnergyRecent" style="font-size:.7rem;color:var(--muted2);margin-top:8px"></div>`;
    const recent = mount.querySelector('#fluxEnergyRecent');
    recent.textContent = log.length
      ? `Last: ${log[log.length - 1].score}/10 — ${new Date(log[log.length - 1].at).toLocaleDateString()}`
      : 'No entries yet';
    mount.querySelector('#fluxEnergyLog')?.addEventListener('click', () => {
      const score = parseInt(mount.querySelector('#fluxEnergyRange')?.value || '5', 10);
      log.push({ score, at: Date.now() });
      if (log.length > 60) log.shift();
      saveK('mood_energy', log);
      renderMoodEnergy(mount);
    });
  }

  function renderCommute(mount) {
    const log = loadK('commute', []);
    const avg = log.length ? Math.round(log.reduce((s, e) => s + e.mins, 0) / log.length) : null;
    const last = log.length ? log[log.length - 1] : null;
    mount.innerHTML = `
      <p class="flux-widget-hint">Log this morning's door-to-desk time — Flux learns your average.</p>
      <div style="display:flex;gap:6px;align-items:center">
        <input type="number" id="fluxCommuteMins" min="1" max="240" placeholder="min" style="width:70px;font-size:.78rem"/>
        <button type="button" class="btn-sec" id="fluxCommuteLog">Log commute</button>
      </div>
      <div style="font-size:.7rem;color:var(--muted2);margin-top:8px" id="fluxCommuteStats">
        ${avg != null ? `Average: <b>${avg} min</b> over ${log.length} trip${log.length === 1 ? '' : 's'}` : 'No trips logged yet'}
        ${last ? ` · last: ${last.mins} min (${new Date(last.at).toLocaleDateString()})` : ''}
      </div>`;
    mount.querySelector('#fluxCommuteLog')?.addEventListener('click', () => {
      const mins = parseInt(mount.querySelector('#fluxCommuteMins')?.value || '', 10);
      if (!mins || mins < 1) {
        if (typeof showToast === 'function') showToast('Enter commute minutes first', 'info');
        return;
      }
      log.push({ mins, at: Date.now() });
      if (log.length > 90) log.shift();
      saveK('commute', log);
      renderCommute(mount);
      if (typeof showToast === 'function') showToast('Commute logged', 'success');
    });
  }

  let _dwTimer = null;
  function renderDeepWork(mount) {
    const state = loadK('deep_work', { sessions: [], until: null });
    const now = Date.now();
    if (state.until && state.until <= now) state.until = null; // expired session
    const weekAgo = now - 7 * 864e5;
    const weekMins = state.sessions.filter((s) => s.at > weekAgo).reduce((s, e) => s + e.mins, 0);
    const active = state.until && state.until > now;

    const paint = () => {
      const remaining = active ? Math.max(0, state.until - Date.now()) : 0;
      const mm = Math.floor(remaining / 60000);
      const ss = Math.floor((remaining % 60000) / 1000);
      mount.innerHTML = active
        ? `
        <p class="flux-widget-hint">Deep work running — hold the line.</p>
        <div style="font-size:1.6rem;font-weight:800;letter-spacing:-.02em">${mm}:${String(ss).padStart(2, '0')}</div>
        <button type="button" class="btn-sec" style="margin-top:6px" id="fluxDwStop">End early</button>`
        : `
        <p class="flux-widget-hint">Block out a stretch for planning or grading. Local only.</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" class="btn-sec" data-dw="25">25 min</button>
          <button type="button" class="btn-sec" data-dw="50">50 min</button>
          <button type="button" class="btn-sec" data-dw="90">90 min</button>
        </div>
        <div style="font-size:.7rem;color:var(--muted2);margin-top:8px">This week: <b>${weekMins} min</b> of deep work</div>`;
      if (active) {
        mount.querySelector('#fluxDwStop')?.addEventListener('click', () => {
          state.until = null;
          saveK('deep_work', state);
          if (_dwTimer) { clearInterval(_dwTimer); _dwTimer = null; }
          renderDeepWork(mount);
        });
      } else {
        mount.querySelectorAll('[data-dw]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const mins = parseInt(btn.getAttribute('data-dw'), 10);
            state.until = Date.now() + mins * 60000;
            state.sessions.push({ mins, at: Date.now() });
            if (state.sessions.length > 200) state.sessions.shift();
            saveK('deep_work', state);
            renderDeepWork(mount);
            if (typeof showToast === 'function') showToast(`Deep work: ${mins} minutes — go.`, 'success');
          });
        });
      }
    };
    paint();
    if (_dwTimer) { clearInterval(_dwTimer); _dwTimer = null; }
    if (active) {
      _dwTimer = setInterval(() => {
        if (!document.body.contains(mount)) { clearInterval(_dwTimer); _dwTimer = null; return; }
        if (state.until && state.until <= Date.now()) {
          state.until = null;
          saveK('deep_work', state);
          clearInterval(_dwTimer); _dwTimer = null;
          if (typeof showToast === 'function') showToast('Deep work session complete 🎉', 'success');
          renderDeepWork(mount);
          return;
        }
        paint();
      }, 1000);
    }
  }

  window.FluxPersonalHub = {
    renderBrainDump,
    renderGrocery,
    renderMoodEnergy,
    renderCommute,
    renderDeepWork,
    loadK,
    saveK,
    isLocalOnly: true,
  };
})();
