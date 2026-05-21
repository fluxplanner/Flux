/**
 * P17.1 — Curated task template marketplace (AP, SAT, college apps).
 * Flag: enable_task_template_marketplace (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_task_template_marketplace';
  const STORE_KEY = 'flux_task_template_marketplace_v1';
  const MODAL_ID = 'fluxTaskTemplateMarketplace';
  const PACK_VERSION = 1;

  const CURATED = [
    {
      id: 'ap_exam',
      name: 'AP exam crunch',
      icon: '🎓',
      category: 'exams',
      descKey: 'ttm.ap_desc',
      tasks: [
        { name: 'AP: Register / confirm exam date', type: 'hw', estTime: 20, difficulty: 2, priority: 'high', dayOffset: 0 },
        { name: 'AP: Unit review checklist', type: 'study', estTime: 90, difficulty: 4, priority: 'high', dayOffset: 1 },
        { name: 'AP: Practice FRQ block', type: 'study', estTime: 60, difficulty: 4, priority: 'high', dayOffset: 3 },
        { name: 'AP: Sleep & light review', type: 'reading', estTime: 25, difficulty: 2, priority: 'med', dayOffset: 6 },
      ],
    },
    {
      id: 'sat_prep',
      name: 'SAT weekend prep',
      icon: '📊',
      category: 'exams',
      descKey: 'ttm.sat_desc',
      tasks: [
        { name: 'SAT: Full practice test', type: 'test', estTime: 180, difficulty: 4, priority: 'high', dayOffset: 0 },
        { name: 'SAT: Review missed questions', type: 'study', estTime: 75, difficulty: 3, priority: 'high', dayOffset: 1 },
        { name: 'SAT: Vocab / grammar drill', type: 'reading', estTime: 30, difficulty: 2, priority: 'med', dayOffset: 2 },
      ],
    },
    {
      id: 'college_apps',
      name: 'College application season',
      icon: '🏫',
      category: 'college',
      descKey: 'ttm.college_desc',
      tasks: [
        { name: 'College: Brainstorm personal statement', type: 'essay', estTime: 60, difficulty: 3, priority: 'high', dayOffset: 0 },
        { name: 'College: Request recommendation letter', type: 'hw', estTime: 20, difficulty: 2, priority: 'high', dayOffset: 1 },
        { name: 'College: Portal deadlines scan', type: 'project', estTime: 45, difficulty: 3, priority: 'high', dayOffset: 2 },
        { name: 'College: Scholarship search block', type: 'study', estTime: 40, difficulty: 2, priority: 'med', dayOffset: 4 },
      ],
    },
    {
      id: 'exam_week',
      name: 'Exam week (3 tasks)',
      icon: '📚',
      category: 'exams',
      descKey: 'ttm.exam_week_desc',
      tasks: [
        { name: 'Exam week: Review all key units', type: 'study', estTime: 90, difficulty: 4, priority: 'high', dayOffset: 0 },
        { name: 'Practice test / past paper', type: 'test', estTime: 60, difficulty: 4, priority: 'high' },
        { name: 'Exam week: Sleep & light review', type: 'hw', estTime: 25, difficulty: 2, priority: 'med', dayOffset: 0 },
      ],
    },
    {
      id: 'project_milestones',
      name: 'Project milestones (3 tasks)',
      icon: '🧩',
      category: 'projects',
      descKey: 'ttm.project_desc',
      tasks: [
        { name: 'Project: Research & outline', type: 'hw', estTime: 60, difficulty: 3, priority: 'med' },
        { name: 'Project: First draft', type: 'essay', estTime: 90, difficulty: 3, priority: 'high' },
        { name: 'Project: Revise & final', type: 'project', estTime: 75, difficulty: 3, priority: 'high' },
      ],
    },
  ];

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

  function todayStr() {
    return typeof window.todayStr === 'function' ? window.todayStr() : new Date().toISOString().slice(0, 10);
  }

  function addDays(iso, n) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function getStore() {
    const s = load(STORE_KEY, {});
    const importedPacks = Array.isArray(s.importedPacks)
      ? s.importedPacks.filter((p) => p && p.id && Array.isArray(p.tasks) && p.tasks.length)
      : [];
    const recentPackIds = Array.isArray(s.recentPackIds)
      ? s.recentPackIds.filter((id) => typeof id === 'string').slice(0, 8)
      : [];
    return { importedPacks, recentPackIds };
  }

  function persistStore(data) {
    save(STORE_KEY, data);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('taskTemplateMarketplace', getCloudSlice());
    } catch (_) {}
  }

  function getCloudSlice() {
    const s = getStore();
    return {
      importedPacks: s.importedPacks.map((p) => ({
        id: p.id,
        name: p.name,
        icon: p.icon || '📦',
        category: p.category || 'custom',
        tasks: p.tasks,
        importedAt: p.importedAt,
      })),
      recentPackIds: s.recentPackIds,
    };
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    persistStore({
      importedPacks: Array.isArray(data.importedPacks) ? data.importedPacks : [],
      recentPackIds: Array.isArray(data.recentPackIds) ? data.recentPackIds : [],
    });
  }

  function taskList() {
    return typeof window.tasks !== 'undefined' && Array.isArray(window.tasks) ? window.tasks : [];
  }

  function allPacks() {
    const store = getStore();
    const sportPacks =
      typeof window.FluxSportPracticePack?.getMarketplacePacks === 'function' &&
      window.FluxSportPracticePack?.enabled?.()
        ? FluxSportPracticePack.getMarketplacePacks()
        : [];
    return [...CURATED, ...sportPacks, ...store.importedPacks];
  }

  function findPack(id) {
    return allPacks().find((p) => p.id === id) || null;
  }

  function normalizeTaskSpec(spec, baseId, i, t0) {
    const dayOffset = Number.isFinite(parseInt(spec.dayOffset, 10)) ? parseInt(spec.dayOffset, 10) : null;
    return {
      id: baseId + i + 1,
      name: String(spec.name || 'Untitled task').trim(),
      date: dayOffset === null ? '' : addDays(t0, dayOffset),
      subject: spec.subject || '',
      priority: spec.priority || 'med',
      type: spec.type || 'hw',
      estTime: parseInt(spec.estTime, 10) || 30,
      difficulty: parseInt(spec.difficulty, 10) || 3,
      notes: spec.notes || '',
      subtasks: [],
      done: false,
      rescheduled: 0,
      createdAt: Date.now(),
      templatePackId: spec.templatePackId,
    };
  }

  function refreshPlanner() {
    save('tasks', taskList());
    try {
      if (typeof window.syncKey === 'function') window.syncKey('tasks', taskList());
    } catch (_) {}
    try {
      if (typeof window.renderStats === 'function') window.renderStats();
    } catch (_) {}
    try {
      if (typeof window.renderTasks === 'function') window.renderTasks();
    } catch (_) {}
    try {
      if (typeof window.renderCalendar === 'function') window.renderCalendar();
    } catch (_) {}
    try {
      if (typeof window.renderCountdown === 'function') window.renderCountdown();
    } catch (_) {}
    try {
      if (typeof window.checkAllPanic === 'function') window.checkAllPanic();
    } catch (_) {}
  }

  function applyPack(packId) {
    const pack = findPack(packId);
    if (!pack || !Array.isArray(pack.tasks) || !pack.tasks.length) {
      toast(T('ttm.pack_missing'), 'warning');
      return 0;
    }

    close();
    const t0 = todayStr();
    const baseId = Date.now();
    pack.tasks.forEach((spec, i) => {
      const task = normalizeTaskSpec({ ...spec, templatePackId: pack.id }, baseId, i, t0);
      if (typeof window.calcUrgency === 'function') task.urgencyScore = window.calcUrgency(task);
      taskList().unshift(task);
    });

    const store = getStore();
    const recent = [pack.id, ...store.recentPackIds.filter((id) => id !== pack.id)].slice(0, 8);
    persistStore({ ...store, recentPackIds: recent });
    refreshPlanner();
    toast(T('ttm.applied', { name: pack.name, n: pack.tasks.length }), 'success');
    return pack.tasks.length;
  }

  function applyQuickTemplate(tpl) {
    close();
    if (typeof window.applyTemplate === 'function') {
      window.applyTemplate(tpl);
      return;
    }
    if (typeof window.openDashAddTaskModal === 'function') window.openDashAddTaskModal();
    const ni = document.getElementById('taskName');
    const ti = document.getElementById('taskType');
    const ei = document.getElementById('taskEstTime');
    const di = document.getElementById('taskDifficulty');
    const pi = document.getElementById('taskPriority');
    if (ni) ni.value = tpl.name || '';
    if (ti) ti.value = tpl.type || 'hw';
    if (ei) ei.value = tpl.estTime || 30;
    if (di) di.value = tpl.difficulty || 3;
    if (pi) pi.value = tpl.priority || 'med';
    if (ni) ni.focus();
    toast(T('ttm.quick_applied', { name: tpl.name }), 'info');
  }

  function validateImportPack(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const tasks = Array.isArray(raw.tasks) ? raw.tasks : [];
    if (!tasks.length) return null;
    const cleaned = tasks
      .map((t) => ({
        name: String(t?.name || '').trim(),
        type: t?.type || 'hw',
        estTime: parseInt(t?.estTime, 10) || 30,
        difficulty: parseInt(t?.difficulty, 10) || 3,
        priority: t?.priority || 'med',
        dayOffset: Number.isFinite(parseInt(t?.dayOffset, 10)) ? parseInt(t.dayOffset, 10) : undefined,
        subject: t?.subject || '',
        notes: t?.notes || '',
      }))
      .filter((t) => t.name);
    if (!cleaned.length) return null;
    const name = String(raw.name || 'Imported pack').trim();
    return {
      v: PACK_VERSION,
      id: 'import_' + Date.now(),
      name,
      icon: raw.icon || '📦',
      category: raw.category || 'custom',
      descKey: null,
      desc: raw.description || '',
      tasks: cleaned,
      importedAt: Date.now(),
    };
  }

  function importPackJson(text) {
    let raw;
    try {
      raw = JSON.parse(text);
    } catch (_) {
      toast(T('ttm.import_invalid'), 'error');
      return false;
    }
    const pack = validateImportPack(raw);
    if (!pack) {
      toast(T('ttm.import_invalid'), 'error');
      return false;
    }
    const store = getStore();
    store.importedPacks.unshift(pack);
    persistStore(store);
    toast(T('ttm.import_ok', { name: pack.name }), 'success');
    open();
    return true;
  }

  function exportPack(packId) {
    const pack = findPack(packId);
    if (!pack) return;
    const payload = {
      v: PACK_VERSION,
      name: pack.name,
      icon: pack.icon,
      category: pack.category,
      description: pack.desc || (pack.descKey ? T(pack.descKey) : ''),
      tasks: pack.tasks,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flux-task-pack-' + (pack.id || 'export') + '.json';
    a.click();
    URL.revokeObjectURL(url);
    toast(T('ttm.export_ok'), 'info');
  }

  function removeImported(packId) {
    const store = getStore();
    store.importedPacks = store.importedPacks.filter((p) => p.id !== packId);
    store.recentPackIds = store.recentPackIds.filter((id) => id !== packId);
    persistStore(store);
    open();
  }

  function quickTemplates() {
    if (Array.isArray(window.TASK_TEMPLATES) && window.TASK_TEMPLATES.length) {
      return window.TASK_TEMPLATES;
    }
    return [
      { name: 'Homework', type: 'hw', estTime: 30, difficulty: 2, priority: 'med', icon: '📝' },
      { name: 'Study Session', type: 'study', estTime: 60, difficulty: 3, priority: 'med', icon: '📖' },
      { name: 'Test Prep', type: 'test', estTime: 45, difficulty: 4, priority: 'high', icon: '📋' },
    ];
  }

  function packCardHtml(pack) {
    const desc = pack.descKey ? T(pack.descKey) : pack.desc || '';
    return `<button type="button" class="flux-ttm-pack" data-ttm-apply="${esc(pack.id)}">
  <div class="flux-ttm-pack-icon">${esc(pack.icon || '📦')}</div>
  <div class="flux-ttm-pack-name">${esc(pack.name)}</div>
  <div class="flux-ttm-pack-meta">${esc(T('ttm.task_count', { n: pack.tasks.length }))}</div>
  ${desc ? `<div class="flux-ttm-pack-desc">${esc(desc)}</div>` : ''}
</button>`;
  }

  function close() {
    document.getElementById(MODAL_ID)?.remove();
    document.getElementById('templateMenu')?.remove();
  }

  function bindModal(root) {
    root.querySelector('[data-ttm-close]')?.addEventListener('click', close);
    root.addEventListener('click', (e) => {
      if (e.target === root) close();
    });
    root.querySelectorAll('[data-ttm-apply]').forEach((btn) => {
      btn.addEventListener('click', () => applyPack(btn.getAttribute('data-ttm-apply')));
    });
    root.querySelectorAll('[data-ttm-quick-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-ttm-quick-idx'), 10);
        const tpl = quickTemplates()[idx];
        if (tpl) applyQuickTemplate(tpl);
      });
    });
    root.querySelector('#fluxTtmImportBtn')?.addEventListener('click', () => {
      document.getElementById('fluxTtmFileInput')?.click();
    });
    root.querySelector('#fluxTtmFileInput')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => importPackJson(String(reader.result || ''));
      reader.readAsText(file);
      e.target.value = '';
    });
    root.querySelectorAll('[data-ttm-export]').forEach((btn) => {
      btn.addEventListener('click', () => exportPack(btn.getAttribute('data-ttm-export')));
    });
    root.querySelectorAll('[data-ttm-remove]').forEach((btn) => {
      btn.addEventListener('click', () => removeImported(btn.getAttribute('data-ttm-remove')));
    });
  }

  function open() {
    if (!enabled()) {
      if (typeof window.showTemplateMenu === 'function' && window.showTemplateMenu._fluxTtmOrig) {
        window.showTemplateMenu._fluxTtmOrig();
      }
      return;
    }

    close();
    const store = getStore();
    const curatedPacks = [...CURATED];
    if (
      window.FluxSportPracticePack?.enabled?.() &&
      typeof FluxSportPracticePack.getMarketplacePacks === 'function'
    ) {
      curatedPacks.push(...FluxSportPracticePack.getMarketplacePacks());
    }
    const curatedHtml = curatedPacks.map(packCardHtml).join('');
    const importedHtml = store.importedPacks.length
      ? store.importedPacks
          .map(
            (p) => `<div class="flux-ttm-imported-row">
  <div>
    <div class="flux-ttm-pack-name">${esc(p.icon || '📦')} ${esc(p.name)}</div>
    <div class="flux-ttm-pack-meta">${esc(T('ttm.task_count', { n: p.tasks.length }))}</div>
  </div>
  <div style="display:flex;gap:6px">
    <button type="button" class="btn-sec" data-ttm-apply="${esc(p.id)}">${esc(T('ttm.apply'))}</button>
    <button type="button" class="btn-sec" data-ttm-export="${esc(p.id)}">${esc(T('ttm.export'))}</button>
    <button type="button" class="btn-sec" data-ttm-remove="${esc(p.id)}">${esc(T('ttm.remove'))}</button>
  </div>
</div>`,
          )
          .join('')
      : `<p style="font-size:.72rem;color:var(--muted);margin:0">${esc(T('ttm.no_imported'))}</p>`;

    const quickList = quickTemplates();
    const quickHtml = quickList
      .map(
        (t, idx) => `<button type="button" class="flux-ttm-pack" data-ttm-quick-idx="${idx}">
  <div class="flux-ttm-pack-icon">${esc(t.icon || '📝')}</div>
  <div class="flux-ttm-pack-name">${esc(t.name)}</div>
  <div class="flux-ttm-pack-meta">${esc(t.estTime)}min · ${esc(T('ttm.diff', { n: t.difficulty }))}</div>
</button>`,
      )
      .join('');

    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.className = 'flux-ttm-overlay';
    overlay.innerHTML = `<div class="flux-ttm-panel" role="dialog" aria-label="${esc(T('ttm.title'))}">
  <div class="flux-ttm-head">
    <div class="flux-ttm-title">${esc(T('ttm.title'))}</div>
    <button type="button" data-ttm-close style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:1.2rem">✕</button>
  </div>
  <p style="font-size:.72rem;color:var(--muted2);margin:0 0 4px;line-height:1.45">${esc(T('ttm.lede'))}</p>
  <div class="flux-ttm-kicker">${esc(T('ttm.curated'))}</div>
  <div class="flux-ttm-grid">${curatedHtml}</div>
  <div class="flux-ttm-kicker">${esc(T('ttm.quick'))}</div>
  <div class="flux-ttm-grid">${quickHtml}</div>
  <div class="flux-ttm-kicker">${esc(T('ttm.imported'))}</div>
  <div class="flux-ttm-imported">${importedHtml}</div>
  <div class="flux-ttm-import-row">
    <button type="button" class="btn-sec" id="fluxTtmImportBtn">${esc(T('ttm.import_btn'))}</button>
    <input type="file" id="fluxTtmFileInput" accept="application/json,.json" hidden />
  </div>
</div>`;
    document.body.appendChild(overlay);
    bindModal(overlay);
  }

  function wrapTemplateMenu() {
    const orig = window.showTemplateMenu;
    if (typeof orig !== 'function' || orig._fluxTtmWrapped) return;
    const wrapped = function () {
      if (enabled()) {
        open();
        return;
      }
      return orig.apply(this, arguments);
    };
    wrapped._fluxTtmWrapped = true;
    wrapped._fluxTtmOrig = orig;
    window.showTemplateMenu = wrapped;
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('ttm.palette');
    const keys = 'template marketplace pack ap sat college';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '📦',
        label,
        cat: 'Actions',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          open();
        },
      },
    ];
  }

  function install() {
    if (!enabled()) return false;
    wrapTemplateMenu();
    return true;
  }

  window.FluxTaskTemplateMarketplace = {
    FLAG,
    enabled,
    CURATED,
    allPacks,
    applyPack,
    importPackJson,
    exportPack,
    open,
    close,
    getCloudSlice,
    applyFromCloud,
    getPaletteCommands,
    install,
  };
})();
