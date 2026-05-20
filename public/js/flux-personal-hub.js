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

  window.FluxPersonalHub = {
    renderBrainDump,
    renderGrocery,
    renderMoodEnergy,
    loadK,
    saveK,
    isLocalOnly: true,
  };
})();
