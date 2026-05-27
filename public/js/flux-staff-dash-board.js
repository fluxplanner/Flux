/**
 * FluxStaffDashBoard — draggable widget board for educator personal dashboard.
 * Flag: enable_staff_dash_board
 */
(function () {
  'use strict';

  const FLAG = 'enable_staff_dash_board';
  const LAYOUT_KEY = 'flux_staff_dash_board_v1';
  const PHOTO_KEY = 'flux_staff_photo_board_v1';

  const WIDTHS = [4, 6, 8, 12];

  const BUILTINS = [
    { id: 'welcome', title: 'Welcome', defaultW: 8, locked: true },
    { id: 'cal_mini', title: 'Mini calendar', defaultW: 4 },
    { id: 'cal_week', title: 'Week at a glance', defaultW: 12 },
    { id: 'tasks_today', title: "Today's planner tasks", defaultW: 6 },
    { id: 'quick_links', title: 'Quick links', defaultW: 6 },
    { id: 'photo_board', title: 'Photo board', defaultW: 6 },
  ];

  let _mcYear;
  let _mcMonth;
  let _dragId = null;

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled(FLAG, false);
    } catch (_) {
      return false;
    }
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function uid() {
    return (
      (typeof currentUser !== 'undefined' && currentUser?.id) ||
      (window.currentUser && window.currentUser.id) ||
      'anon'
    );
  }

  function catalog() {
    const items = BUILTINS.map((b) => ({ ...b, kind: 'builtin' }));
    try {
      const mods = window.FluxModuleLoader?.visibleModules?.('staffPersonalHub') || [];
      mods.forEach((m) => {
        if (m.kind === 'command') return;
        if (items.some((x) => x.id === m.id)) return;
        items.push({
          id: m.id,
          title: m.title,
          defaultW: 6,
          kind: 'module',
          module: m.module,
          method: m.method,
          status: m.status,
        });
      });
    } catch (_) {}
    return items;
  }

  function meta(id) {
    return catalog().find((c) => c.id === id) || { id, title: id, defaultW: 6 };
  }

  function loadLayout() {
    try {
      const raw = localStorage.getItem(`${LAYOUT_KEY}_${uid()}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function saveLayout(layout) {
    try {
      localStorage.setItem(`${LAYOUT_KEY}_${uid()}`, JSON.stringify(layout));
    } catch (_) {}
  }

  function defaultLayout() {
    const ids = ['welcome', 'cal_mini', 'cal_week', 'quick_links', 'tasks_today'];
    return {
      widgets: ids.map((id, i) => ({
        id,
        w: meta(id).defaultW || 6,
        visible: true,
        order: i,
      })),
    };
  }

  function getLayout() {
    let layout = loadLayout();
    const cat = catalog();
    if (!layout || !Array.isArray(layout.widgets)) layout = defaultLayout();
    const known = new Set(cat.map((c) => c.id));
    layout.widgets = layout.widgets.filter((w) => known.has(w.id));
    cat.forEach((c) => {
      if (c.locked && !layout.widgets.some((w) => w.id === c.id)) {
        layout.widgets.unshift({ id: c.id, w: c.defaultW || 6, visible: true, order: 0 });
      }
    });
    layout.widgets.forEach((w, i) => {
      if (w.order == null) w.order = i;
      if (!w.w || !WIDTHS.includes(w.w)) w.w = meta(w.id).defaultW || 6;
    });
    return layout;
  }

  function visibleWidgets(layout) {
    return layout.widgets
      .filter((w) => w.visible !== false)
      .sort((a, b) => a.order - b.order);
  }

  function firstName() {
    const name =
      (typeof FluxRole !== 'undefined' && FluxRole.profile?.display_name) ||
      currentUser?.user_metadata?.full_name ||
      currentUser?.email?.split('@')[0] ||
      'there';
    return (
      String(name)
        .split(/\s+/)
        .filter((w) => !['Mr.', 'Mrs.', 'Ms.', 'Dr.'].includes(w))[0] || name
    );
  }

  function fmtLongDay(d) {
    if (typeof window.fluxFmtStaffDate === 'function') return window.fluxFmtStaffDate(d, 'weekday');
    if (typeof window.fmtFluxDate === 'function') return window.fmtFluxDate(d, 'weekday');
    return new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function plannerTasks() {
    try {
      if (typeof tasks !== 'undefined' && Array.isArray(tasks)) return tasks;
      if (typeof load === 'function') return load('tasks', []) || [];
    } catch (_) {}
    return [];
  }

  function initMcState() {
    const t = new Date();
    _mcYear = t.getFullYear();
    _mcMonth = t.getMonth();
  }

  function renderMiniCal(mount) {
    initMcState();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const taskList = plannerTasks();

    function paint() {
      const first = new Date(_mcYear, _mcMonth, 1).getDay();
      const days = new Date(_mcYear, _mcMonth + 1, 0).getDate();
      const prevDays = new Date(_mcYear, _mcMonth, 0).getDate();
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const tMap = {};
      taskList
        .filter((t) => t.date)
        .forEach((t) => {
          const d = new Date(t.date + 'T00:00:00');
          if (d.getFullYear() === _mcYear && d.getMonth() === _mcMonth) {
            const k = d.getDate();
            tMap[k] = (tMap[k] || 0) + 1;
          }
        });
      let html = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => `<div class="fsdb-mini-dow">${d}</div>`).join('');
      for (let i = first - 1; i >= 0; i--) {
        html += `<div class="fsdb-mini-day fsdb-mini-day--other">${prevDays - i}</div>`;
      }
      for (let d = 1; d <= days; d++) {
        const dt = new Date(_mcYear, _mcMonth, d);
        const isToday = dt.getTime() === now.getTime();
        const has = !!tMap[d];
        html += `<div class="fsdb-mini-day ${isToday ? 'fsdb-mini-day--today' : ''} ${has ? 'fsdb-mini-day--has' : ''}" data-mc-day="${d}">${d}</div>`;
      }
      mount.querySelector('.fsdb-mini-cal-grid').innerHTML = html;
      mount.querySelector('.fsdb-mini-cal-label').textContent = `${months[_mcMonth]} ${_mcYear}`;
      mount.querySelectorAll('[data-mc-day]').forEach((cell) => {
        cell.addEventListener('click', () => {
          if (typeof nav === 'function') nav('calendar');
        });
      });
    }

    mount.innerHTML = `
      <div class="fsdb-mini-cal-nav">
        <button type="button" class="fsdb-widget-btn" data-mc-prev aria-label="Previous month">‹</button>
        <span class="fsdb-mini-cal-label"></span>
        <button type="button" class="fsdb-widget-btn" data-mc-next aria-label="Next month">›</button>
      </div>
      <div class="fsdb-mini-cal-grid"></div>
      <p style="font-size:.62rem;color:var(--muted2);margin:8px 0 0">Tap a day to open full calendar</p>`;
    mount.querySelector('[data-mc-prev]')?.addEventListener('click', () => {
      _mcMonth--;
      if (_mcMonth < 0) {
        _mcMonth = 11;
        _mcYear--;
      }
      paint();
    });
    mount.querySelector('[data-mc-next]')?.addEventListener('click', () => {
      _mcMonth++;
      if (_mcMonth > 11) {
        _mcMonth = 0;
        _mcYear++;
      }
      paint();
    });
    paint();
  }

  function renderWeekView(mount) {
    const taskList = plannerTasks();
    const goalMin = Math.max(30, ((typeof settings !== 'undefined' && settings?.dailyGoalHrs) || 2) * 60);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    const weekStart = days[0].toISOString().slice(0, 10);
    const estMins = (t) => {
      const m = parseInt(t.estTime, 10);
      return Number.isFinite(m) && m > 0 ? m : 30;
    };
    const effectiveDue = (t) => {
      if (t.done || !t.date) return null;
      return t.date < weekStart ? weekStart : t.date;
    };
    const byDay = days.map((day) => {
      const ds = day.toISOString().slice(0, 10);
      let mins = 0;
      let n = 0;
      taskList.forEach((t) => {
        if (effectiveDue(t) !== ds) return;
        mins += estMins(t);
        n++;
      });
      return { mins, n, label: day.toLocaleDateString('en-US', { weekday: 'short' }) };
    });
    const maxM = Math.max(1, ...byDay.map((x) => x.mins));
    mount.innerHTML = `<div class="fsdb-week-bars">${byDay
      .map((row) => {
        const h = Math.round(Math.max(8, (row.mins / maxM) * 48));
        const heavy = row.mins > goalMin;
        const num = row.mins >= 60 ? `${(row.mins / 60).toFixed(1)}h` : `${row.mins}m`;
        return `<div class="fsdb-week-col" title="${esc(row.label)}: ${row.n} tasks">
          <div class="fsdb-week-bar ${heavy ? 'fsdb-week-bar--heavy' : ''}" style="height:${h}px"></div>
          <div class="fsdb-week-lbl">${esc(row.label.slice(0, 2))}</div>
          <div class="fsdb-week-lbl">${row.mins > 0 ? num : '—'}</div>
        </div>`;
      })
      .join('')}</div>
      <p style="font-size:.62rem;color:var(--muted2);margin:8px 0 0">Estimated load from planner tasks · next 7 days</p>`;
  }

  function renderTasksToday(mount) {
    const today = new Date().toISOString().slice(0, 10);
    const list = plannerTasks()
      .filter((t) => !t.done && t.date && String(t.date).slice(0, 10) <= today)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 8);
    if (!list.length) {
      mount.innerHTML = '<p class="fsdb-empty">No open tasks due today or earlier.</p>';
      return;
    }
    mount.innerHTML =
      list
        .map(
          (t) => `<div class="fsdb-task-row">
        <span style="color:var(--accent)">○</span>
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.name || 'Task')}</span>
        <span style="font-size:.62rem;color:var(--muted2)">${esc(String(t.date || '').slice(5))}</span>
      </div>`,
        )
        .join('') +
      `<button type="button" class="btn-sec" style="width:100%;margin-top:8px;font-size:.72rem" data-open-planner>All tasks</button>`;
    mount.querySelector('[data-open-planner]')?.addEventListener('click', () => {
      if (typeof nav === 'function') nav('staffTasks');
      if (window.FluxStaffPlatform?.renderStaffTasksPanel) FluxStaffPlatform.renderStaffTasksPanel();
    });
  }

  function renderWelcome(mount) {
    const role = (typeof FluxRole !== 'undefined' && FluxRole.current) || 'staff';
    const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
    const greet = typeof getTimeGreeting === 'function' ? getTimeGreeting() : 'Hello';
    mount.innerHTML = `
      <div class="fsdb-welcome-hello">${esc(greet)}, ${esc(firstName())}</div>
      <div class="fsdb-welcome-sub">${esc(roleLabel)} · Personal mode · ${esc(fmtLongDay(new Date()))}</div>
      <div class="fsdb-welcome-hint">Drag widgets by the <strong>⠿</strong> handle, resize with ↔, add modules with <strong>+ Widget</strong>. Switch to <b>Work</b> for school tools.</div>`;
  }

  function renderQuickLinks(mount) {
    mount.innerHTML = `
      <div class="fsdb-quick-grid">
        <button type="button" class="fsdb-quick-card" data-nav="staffTasks"><div class="fsdb-quick-icon">✅</div><div class="fsdb-quick-label">Tasks</div></button>
        <button type="button" class="fsdb-quick-card" data-nav="staffResources"><div class="fsdb-quick-icon">📁</div><div class="fsdb-quick-label">Resources</div></button>
        <button type="button" class="fsdb-quick-card" data-nav="staffPersonalHub"><div class="fsdb-quick-icon">🧩</div><div class="fsdb-quick-label">Personal hub</div></button>
      </div>`;
    mount.querySelectorAll('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.nav;
        if (typeof nav === 'function') nav(id);
        if (id === 'staffTasks' && window.FluxStaffPlatform?.renderStaffTasksPanel) {
          FluxStaffPlatform.renderStaffTasksPanel();
        } else if (id === 'staffResources' && window.FluxStaffPlatform?.renderResourcesPanel) {
          FluxStaffPlatform.renderResourcesPanel();
        } else if (id === 'staffPersonalHub' && typeof window.renderStaffPersonalHub === 'function') {
          renderStaffPersonalHub();
        }
      });
    });
  }

  function loadPhotos() {
    try {
      return load(`${PHOTO_KEY}_${uid()}`, []) || [];
    } catch (_) {
      return [];
    }
  }

  function savePhotos(arr) {
    try {
      if (typeof save === 'function') save(`${PHOTO_KEY}_${uid()}`, arr);
      else localStorage.setItem(`${PHOTO_KEY}_${uid()}`, JSON.stringify(arr));
    } catch (_) {}
  }

  function renderPhotoBoard(mount) {
    const photos = loadPhotos();
    mount.innerHTML = `
      <div class="fsdb-photo-grid">${photos
        .map((p, i) => {
          const src = String(p).replace(/"/g, '&quot;');
          return `<div class="fsdb-photo-thumb">
          <img src="${src}" alt="" loading="lazy"/>
          <button type="button" class="fsdb-photo-del" data-ph-del="${i}">×</button>
        </div>`;
        })
        .join('')}</div>
      <label class="btn-sec" style="display:block;text-align:center;margin-top:8px;font-size:.72rem;cursor:pointer">
        + Add photo
        <input type="file" accept="image/*" multiple hidden data-ph-input/>
      </label>`;
    mount.querySelectorAll('[data-ph-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const arr = loadPhotos();
        arr.splice(parseInt(btn.dataset.phDel, 10), 1);
        savePhotos(arr);
        renderPhotoBoard(mount);
      });
    });
    mount.querySelector('[data-ph-input]')?.addEventListener('change', (e) => {
      const files = [...(e.target.files || [])];
      if (!files.length) return;
      const arr = loadPhotos();
      let pending = files.length;
      files.forEach((file) => {
        const r = new FileReader();
        r.onload = (ev) => {
          arr.push(ev.target.result);
          pending--;
          if (pending <= 0) {
            savePhotos(arr.slice(-24));
            renderPhotoBoard(mount);
          }
        };
        r.readAsDataURL(file);
      });
      e.target.value = '';
    });
  }

  function renderModuleWidget(item, mount) {
    const mod = window[item.module];
    const fn = mod && item.method && typeof mod[item.method] === 'function' ? mod[item.method].bind(mod) : null;
    if (fn) {
      try {
        fn(mount, { panelId: 'staffPersonalHub', item });
        return;
      } catch (e) {
        mount.innerHTML = '<p class="fsdb-empty">Module failed to load.</p>';
        console.warn('[FluxStaffDashBoard]', item.id, e);
        return;
      }
    }
    mount.innerHTML = '<p class="fsdb-empty">Module unavailable.</p>';
  }

  function renderWidgetBody(id, mount) {
    const m = meta(id);
    if (m.kind === 'module') return renderModuleWidget(m, mount);
    switch (id) {
      case 'welcome':
        return renderWelcome(mount);
      case 'cal_mini':
        return renderMiniCal(mount);
      case 'cal_week':
        return renderWeekView(mount);
      case 'tasks_today':
        return renderTasksToday(mount);
      case 'quick_links':
        return renderQuickLinks(mount);
      case 'photo_board':
        return renderPhotoBoard(mount);
      default:
        mount.innerHTML = '<p class="fsdb-empty">Unknown widget.</p>';
    }
  }

  function swapOrder(layout, fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    const ws = layout.widgets;
    const a = ws.find((w) => w.id === fromId);
    const b = ws.find((w) => w.id === toId);
    if (!a || !b) return;
    const tmp = a.order;
    a.order = b.order;
    b.order = tmp;
    saveLayout(layout);
  }

  function cycleWidth(layout, id) {
    const w = layout.widgets.find((x) => x.id === id);
    if (!w || meta(id).locked) return;
    const i = WIDTHS.indexOf(w.w);
    w.w = WIDTHS[(i + 1) % WIDTHS.length];
    saveLayout(layout);
  }

  function removeWidget(layout, id) {
    if (meta(id).locked) return;
    const w = layout.widgets.find((x) => x.id === id);
    if (w) w.visible = false;
    saveLayout(layout);
  }

  function wireWidget(layout, el, w) {
    const id = w.id;
    const handle = el.querySelector('[data-fsdb-drag]');
    handle?.addEventListener('dragstart', (e) => {
      _dragId = id;
      el.classList.add('fsdb-widget--dragging');
      e.dataTransfer?.setData('text/plain', id);
      e.dataTransfer.effectAllowed = 'move';
    });
    handle?.addEventListener('dragend', () => {
      _dragId = null;
      el.classList.remove('fsdb-widget--dragging');
      document.querySelectorAll('.fsdb-widget--drag-over').forEach((n) => n.classList.remove('fsdb-widget--drag-over'));
    });
    el.addEventListener('dragover', (e) => {
      if (!_dragId || _dragId === id) return;
      e.preventDefault();
      el.classList.add('fsdb-widget--drag-over');
    });
    el.addEventListener('dragleave', () => el.classList.remove('fsdb-widget--drag-over'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('fsdb-widget--drag-over');
      const from = e.dataTransfer?.getData('text/plain') || _dragId;
      swapOrder(layout, from, id);
      render('dashboard');
    });
    el.querySelector('[data-fsdb-resize]')?.addEventListener('click', () => {
      cycleWidth(layout, id);
      render('dashboard');
    });
    el.querySelector('[data-fsdb-remove]')?.addEventListener('click', () => {
      removeWidget(layout, id);
      render('dashboard');
      if (typeof showToast === 'function') showToast('Widget removed — add again via + Widget', 'info');
    });
  }

  function openAddModal(layout) {
    const existing = document.getElementById('fsdbAddModal');
    if (existing) existing.remove();
    const active = new Set(visibleWidgets(layout).map((w) => w.id));
    const available = catalog().filter((c) => !active.has(c.id));
    const ov = document.createElement('div');
    ov.id = 'fsdbAddModal';
    ov.className = 'modal-overlay';
    ov.style.display = 'flex';
    const rows = available.length
      ? available
          .map(
            (c) => `<button type="button" class="btn-sec fsdb-add-row" data-add-id="${esc(c.id)}" style="width:100%;text-align:left;margin-bottom:6px">
          <strong>${esc(c.title)}</strong>
          <span style="font-size:.68rem;color:var(--muted2);display:block">${c.kind === 'module' ? 'Planner module' : 'Dashboard widget'}</span>
        </button>`,
          )
          .join('')
      : '<p style="font-size:.82rem;color:var(--muted2)">All widgets are already on your board.</p>';
    ov.innerHTML = `<div class="modal" style="max-width:400px">
      <h3>Add widget</h3>
      <p style="font-size:.78rem;color:var(--muted2)">Pick something to add to your personal dashboard.</p>
      <div style="max-height:320px;overflow-y:auto;margin:12px 0">${rows}</div>
      <button type="button" class="btn-sec" onclick="document.getElementById('fsdbAddModal').remove()">Close</button>
    </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', (e) => {
      if (e.target === ov) ov.remove();
    });
    ov.querySelectorAll('[data-add-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.addId;
        let w = layout.widgets.find((x) => x.id === id);
        if (!w) {
          w = { id, w: meta(id).defaultW || 6, visible: true, order: layout.widgets.length };
          layout.widgets.push(w);
        } else {
          w.visible = true;
          w.order = layout.widgets.length;
        }
        saveLayout(layout);
        ov.remove();
        render('dashboard');
        if (typeof showToast === 'function') showToast('Widget added', 'success');
      });
    });
  }

  function render(hostId) {
    if (!enabled()) return false;
    const host = document.getElementById(hostId || 'dashboard');
    if (!host) return false;

    host.querySelector('#fluxWidgetGrid_dashboard')?.remove();
    host.querySelector('.staff-personal-dash')?.remove();
    host.querySelector('.fsdb-root')?.remove();

    const layout = getLayout();
    const widgets = visibleWidgets(layout);

    const root = document.createElement('div');
    root.className = 'fsdb-root';
    root.innerHTML = `
      <div class="fsdb-toolbar">
        <span class="fsdb-toolbar-title">Personal dashboard</span>
        <div class="fsdb-toolbar-actions">
          <button type="button" class="btn-sec" id="fsdbAddWidget" style="font-size:.72rem">+ Widget</button>
          <button type="button" class="btn-sec" id="fsdbResetLayout" style="font-size:.72rem">Reset layout</button>
        </div>
      </div>
      <div class="fsdb-grid" id="fsdbGrid"></div>`;
    host.prepend(root);

    const grid = root.querySelector('#fsdbGrid');
    widgets.forEach((w) => {
      const m = meta(w.id);
      const cell = document.createElement('div');
      cell.className = 'fsdb-widget';
      cell.dataset.widgetId = w.id;
      cell.dataset.w = String(w.w || 6);
      const canRemove = !m.locked;
      cell.innerHTML = `
        <div class="fsdb-widget-head">
          <span class="fsdb-widget-drag" draggable="true" data-fsdb-drag title="Drag to reorder">⠿</span>
          <span class="fsdb-widget-title">${esc(m.title)}</span>
          <div class="fsdb-widget-actions">
            <button type="button" class="fsdb-widget-btn" data-fsdb-resize title="Change width">↔</button>
            ${canRemove ? '<button type="button" class="fsdb-widget-btn" data-fsdb-remove title="Remove">×</button>' : ''}
          </div>
        </div>
        <div class="fsdb-widget-body" id="fsdbBody_${esc(w.id)}"></div>`;
      grid.appendChild(cell);
      wireWidget(layout, cell, w);
      const body = cell.querySelector('.fsdb-widget-body');
      if (body) renderWidgetBody(w.id, body);
    });

    root.querySelector('#fsdbAddWidget')?.addEventListener('click', () => openAddModal(layout));
    root.querySelector('#fsdbResetLayout')?.addEventListener('click', () => {
      if (!confirm('Reset your personal dashboard to the default layout?')) return;
      localStorage.removeItem(`${LAYOUT_KEY}_${uid()}`);
      render(hostId);
      if (typeof showToast === 'function') showToast('Layout reset', 'success');
    });

    return true;
  }

  window.FluxStaffDashBoard = {
    enabled,
    render,
    catalog,
    FLAG,
  };
})();
