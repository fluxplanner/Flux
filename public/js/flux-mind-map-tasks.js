/**
 * P33.1 — Mind map ↔ tasks (radial map, bidirectional task links).
 * Flag: enable_mind_map_tasks (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_mind_map_tasks';
  const STORE_KEY = 'flux_mind_map_v1';
  const OVERLAY_ID = 'fluxMindMapOverlay';
  const BANNER_ID = 'fluxMindMapBanner';

  let selectedNodeId = null;
  let activeMapId = null;

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

  function tasksList() {
    return Array.isArray(window.tasks) ? window.tasks : [];
  }

  function getStore() {
    const s = load(STORE_KEY, {});
    return {
      maps: Array.isArray(s.maps) ? s.maps : [],
      activeMapId: s.activeMapId || 'default',
      opens: s.opens || 0,
    };
  }

  function persistStore(data) {
    save(STORE_KEY, data);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('mindMapTasks', getCloudSlice());
    } catch (_) {}
  }

  function getCloudSlice() {
    const s = getStore();
    return { maps: s.maps, activeMapId: s.activeMapId, opens: s.opens };
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    persistStore({
      maps: Array.isArray(data.maps) ? data.maps : [],
      activeMapId: data.activeMapId || 'default',
      opens: data.opens || 0,
    });
  }

  function newId() {
    return 'n_' + Date.now() + '_' + Math.floor(Math.random() * 999);
  }

  function defaultMap() {
    const rootId = newId();
    return {
      id: 'default',
      title: T('mmap.default_title'),
      nodes: [{ id: rootId, label: T('mmap.root_label'), parentId: null, taskId: null }],
    };
  }

  function ensureMap() {
    const store = getStore();
    if (!store.maps.length) {
      store.maps = [defaultMap()];
      store.activeMapId = 'default';
      persistStore(store);
    }
    let map = store.maps.find((m) => m.id === store.activeMapId);
    if (!map) {
      map = store.maps[0];
      store.activeMapId = map.id;
      persistStore(store);
    }
    if (!map.nodes?.length) {
      map.nodes = defaultMap().nodes;
      persistStore(store);
    }
    return map;
  }

  function saveMap(map) {
    const store = getStore();
    const idx = store.maps.findIndex((m) => m.id === map.id);
    if (idx >= 0) store.maps[idx] = map;
    else store.maps.push(map);
    persistStore(store);
  }

  function getTask(taskId) {
    return tasksList().find((t) => String(t.id) === String(taskId));
  }

  function linkedCount(map) {
    return (map.nodes || []).filter((n) => n.taskId).length;
  }

  function layoutNodes(map) {
    const nodes = map.nodes || [];
    const root = nodes.find((n) => !n.parentId) || nodes[0];
    const positions = {};
    const W = 640;
    const H = 360;
    const cx = W / 2;
    const cy = H / 2;

    function place(nodeId, angleStart, angleEnd, depth) {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const angle = (angleStart + angleEnd) / 2;
      const r = depth === 0 ? 0 : 68 + (depth - 1) * 62;
      positions[nodeId] = {
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      };
      const children = nodes.filter((n) => n.parentId === nodeId);
      const span = angleEnd - angleStart;
      children.forEach((child, i) => {
        const a0 = angleStart + (span / Math.max(children.length, 1)) * i;
        const a1 = angleStart + (span / Math.max(children.length, 1)) * (i + 1);
        place(child.id, a0, a1, depth + 1);
      });
    }

    if (root) place(root.id, 0, Math.PI * 2, 0);
    return { positions, W, H };
  }

  function truncateLabel(label, max) {
    const s = String(label || '').trim();
    return s.length > (max || 16) ? s.slice(0, max - 1) + '…' : s;
  }

  function createTaskForNode(node) {
    if (!node || node.taskId) return false;
    const name = String(node.label || T('mmap.new_task')).trim();
    if (!name) {
      toast(T('mmap.label_required'), 'warning');
      return false;
    }
    const calcUrgency =
      typeof window.calcUrgency === 'function'
        ? window.calcUrgency
        : () => 0;
    const task = {
      id: Date.now(),
      name,
      date: '',
      subject: '',
      priority: 'med',
      type: 'homework',
      estTime: 30,
      difficulty: 3,
      notes: T('mmap.task_note'),
      subtasks: [],
      done: false,
      rescheduled: 0,
      createdAt: Date.now(),
      urgencyScore: 0,
    };
    task.urgencyScore = calcUrgency(task);
    window.tasks = tasksList();
    window.tasks.unshift(task);
    save('tasks', window.tasks);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('tasks', window.tasks);
    } catch (_) {}
    node.taskId = task.id;
    node.label = name;
    if (typeof window.renderTasks === 'function') window.renderTasks();
    if (typeof window.renderStats === 'function') window.renderStats();
    toast(T('mmap.task_created'), 'success');
    return true;
  }

  function linkNodeToTask(node, taskId) {
    if (!node || !taskId) return false;
    const task = getTask(taskId);
    if (!task) {
      toast(T('mmap.task_missing'), 'warning');
      return false;
    }
    node.taskId = task.id;
    if (!String(node.label || '').trim() || node.label === T('mmap.new_branch')) {
      node.label = task.name;
    }
    toast(T('mmap.linked_toast'), 'success');
    return true;
  }

  function unlinkNode(node) {
    if (!node) return;
    node.taskId = null;
    toast(T('mmap.unlinked'), 'info');
  }

  function deleteNode(map, nodeId) {
    const node = map.nodes.find((n) => n.id === nodeId);
    if (!node || !node.parentId) {
      toast(T('mmap.no_delete_root'), 'warning');
      return false;
    }
    const toRemove = new Set();
    function collect(id) {
      toRemove.add(id);
      map.nodes.filter((n) => n.parentId === id).forEach((c) => collect(c.id));
    }
    collect(nodeId);
    map.nodes = map.nodes.filter((n) => !toRemove.has(n.id));
    if (selectedNodeId && toRemove.has(selectedNodeId)) selectedNodeId = null;
    return true;
  }

  function addChildNode(map, parentId) {
    const parent = map.nodes.find((n) => n.id === parentId);
    if (!parent) return null;
    const child = {
      id: newId(),
      label: T('mmap.new_branch'),
      parentId: parent.id,
      taskId: null,
    };
    map.nodes.push(child);
    selectedNodeId = child.id;
    return child;
  }

  function jumpToTask(taskId) {
    closeMap();
    if (typeof window.nav === 'function') {
      const tab = document.querySelector('[data-tab="dashboard"]');
      window.nav('dashboard', tab);
    }
    setTimeout(() => {
      const el = document.querySelector(`[data-task-id="${taskId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('flux-mindmap-highlight');
        setTimeout(() => el.classList.remove('flux-mindmap-highlight'), 2400);
      } else {
        toast(T('mmap.task_not_visible'), 'warning');
      }
    }, 350);
  }

  function renderSidePanel(map, container) {
    const node = map.nodes.find((n) => n.id === selectedNodeId);
    if (!node) {
      container.innerHTML = `<div style="font-size:.75rem;color:var(--muted)">${esc(T('mmap.pick_node'))}</div>`;
      return;
    }
    const task = node.taskId ? getTask(node.taskId) : null;
    const openTasks = tasksList().filter((t) => !t.done);
    container.innerHTML = `<label>${esc(T('mmap.label'))}</label>
<input type="text" id="fluxMmapLabel" value="${esc(node.label || '')}" maxlength="80" />
<label>${esc(T('mmap.task_link'))}</label>
<div style="font-size:.72rem;color:var(--muted2);margin-bottom:6px">${task ? esc(task.name) + (task.done ? ' ✓' : '') : esc(T('mmap.no_task'))}</div>
<select id="fluxMmapTaskPick"><option value="">${esc(T('mmap.pick_task'))}</option>${openTasks
      .map(
        (t) =>
          `<option value="${t.id}"${String(t.id) === String(node.taskId) ? ' selected' : ''}>${esc(truncateLabel(t.name, 28))}</option>`,
      )
      .join('')}</select>
<div class="flux-mmap-side-actions">
  <button type="button" class="btn-sec" data-mmap-add-child>${esc(T('mmap.add_child'))}</button>
  ${!node.taskId ? `<button type="button" data-mmap-create-task>${esc(T('mmap.create_task'))}</button>` : ''}
  ${node.taskId ? `<button type="button" class="btn-sec" data-mmap-goto>${esc(T('mmap.goto_task'))}</button>` : ''}
  ${node.taskId ? `<button type="button" class="btn-sec" data-mmap-unlink>${esc(T('mmap.unlink'))}</button>` : ''}
  ${node.parentId ? `<button type="button" class="btn-sec" data-mmap-delete style="color:var(--red)">${esc(T('mmap.delete'))}</button>` : ''}
</div>`;

    container.querySelector('#fluxMmapLabel')?.addEventListener('change', (e) => {
      node.label = e.target.value.trim() || T('mmap.new_branch');
      saveMap(map);
      renderMapBody(map);
    });
    container.querySelector('#fluxMmapTaskPick')?.addEventListener('change', (e) => {
      const val = e.target.value;
      if (!val) return;
      if (linkNodeToTask(node, val)) {
        saveMap(map);
        renderMapBody(map);
      }
    });
    container.querySelector('[data-mmap-add-child]')?.addEventListener('click', () => {
      addChildNode(map, node.id);
      saveMap(map);
      renderMapBody(map);
    });
    container.querySelector('[data-mmap-create-task]')?.addEventListener('click', () => {
      if (createTaskForNode(node)) {
        saveMap(map);
        renderMapBody(map);
      }
    });
    container.querySelector('[data-mmap-goto]')?.addEventListener('click', () => jumpToTask(node.taskId));
    container.querySelector('[data-mmap-unlink]')?.addEventListener('click', () => {
      unlinkNode(node);
      saveMap(map);
      renderMapBody(map);
    });
    container.querySelector('[data-mmap-delete]')?.addEventListener('click', () => {
      if (deleteNode(map, node.id)) {
        saveMap(map);
        renderMapBody(map);
      }
    });
  }

  function renderMapBody(map) {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    const svgEl = overlay.querySelector('.flux-mmap-svg');
    const sideEl = overlay.querySelector('.flux-mmap-side');
    if (!svgEl || !sideEl) return;

    const { positions, W, H } = layoutNodes(map);
    const nodes = map.nodes || [];

    const edges = nodes
      .filter((n) => n.parentId && positions[n.id] && positions[n.parentId])
      .map((n) => {
        const a = positions[n.parentId];
        const b = positions[n.id];
        return `<line class="flux-mmap-edge" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />`;
      })
      .join('');

    const nodeSvg = nodes
      .map((n) => {
        const p = positions[n.id];
        if (!p) return '';
        const task = n.taskId ? getTask(n.taskId) : null;
        const cls = [
          'flux-mmap-node',
          selectedNodeId === n.id ? 'is-selected' : '',
          !n.parentId ? 'is-root' : '',
          task?.done ? 'is-done' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const label = truncateLabel(task?.name || n.label, 14);
        return `<g class="${cls}" data-mmap-node="${n.id}" transform="translate(${p.x},${p.y})">
  <circle r="20" />
  <text text-anchor="middle" dy="34">${esc(label)}</text>
  ${task ? `<text text-anchor="middle" dy="-26" fill="var(--muted)" font-size="8">${task.done ? '✓' : '◎'}</text>` : ''}
</g>`;
      })
      .join('');

    svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svgEl.innerHTML = edges + nodeSvg;

    svgEl.querySelectorAll('[data-mmap-node]').forEach((g) => {
      g.addEventListener('click', () => {
        selectedNodeId = g.getAttribute('data-mmap-node');
        renderMapBody(map);
      });
    });

    renderSidePanel(map, sideEl);
    refreshBanner();
  }

  function closeMap() {
    document.getElementById(OVERLAY_ID)?.remove();
  }

  function openMap() {
    if (!enabled()) return;
    const store = getStore();
    store.opens = (store.opens || 0) + 1;
    persistStore(store);

    const map = ensureMap();
    activeMapId = map.id;
    selectedNodeId = map.nodes.find((n) => !n.parentId)?.id || map.nodes[0]?.id || null;

    closeMap();
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'flux-mmap-overlay';
    overlay.innerHTML = `<div class="flux-mmap-panel" role="dialog">
  <div class="flux-mmap-head">
    <div style="font-weight:800;font-size:.85rem">${esc(map.title || T('mmap.title'))}</div>
    <button type="button" data-mmap-close style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:1rem">✕</button>
  </div>
  <div class="flux-mmap-body">
    <div class="flux-mmap-canvas-wrap"><svg class="flux-mmap-svg" xmlns="http://www.w3.org/2000/svg"></svg></div>
    <div class="flux-mmap-side"></div>
  </div>
  <div class="flux-mmap-foot">${esc(T('mmap.hint'))}</div>
</div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('[data-mmap-close]')?.addEventListener('click', closeMap);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeMap();
    });
    renderMapBody(map);
  }

  function refreshBanner() {
    const dash = document.getElementById('dashboard');
    if (!dash || !enabled()) return;

    let banner = document.getElementById(BANNER_ID);
    if (!banner) {
      banner = document.createElement('div');
      banner.id = BANNER_ID;
      banner.className = 'flux-mmap-banner';
      const hero = document.getElementById('dashHero');
      if (hero) hero.insertAdjacentElement('afterend', banner);
      else dash.prepend(banner);
    }

    const map = ensureMap();
    const linked = linkedCount(map);
    const branches = (map.nodes || []).length - 1;
    banner.innerHTML = `<div class="flux-mmap-banner-text">${esc(T('mmap.banner_lead'))} <strong>${branches}</strong> ${esc(T('mmap.branches'))} · <strong>${linked}</strong> ${esc(T('mmap.linked_label'))}</div>
<button type="button" class="btn-sec flux-mmap-open" style="font-size:.72rem;padding:6px 12px">${esc(T('mmap.open'))}</button>`;
    banner.querySelector('.flux-mmap-open')?.addEventListener('click', openMap);
  }

  function wrapRenderTasks() {
    const orig = window.renderTasks;
    if (typeof orig !== 'function' || orig._fluxMmapWrapped) return;
    window.renderTasks = function () {
      const r = orig.apply(this, arguments);
      try {
        if (enabled() && document.getElementById(OVERLAY_ID)) {
          renderMapBody(ensureMap());
        }
      } catch (_) {}
      return r;
    };
    window.renderTasks._fluxMmapWrapped = true;
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const needle = (q || '').toLowerCase();
    const label = T('mmap.palette');
    const keys = 'mind map brainstorm tasks radial plan';
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !keys.split(' ').some((k) => needle.includes(k))
    ) {
      return [];
    }
    return [
      {
        icon: '🧠',
        label,
        cat: 'Navigation',
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          if (typeof window.nav === 'function') {
            const tab = document.querySelector('[data-tab="dashboard"]');
            window.nav('dashboard', tab);
          }
          setTimeout(openMap, 300);
        },
      },
    ];
  }

  function install() {
    if (!enabled()) return false;
    wrapRenderTasks();
    refreshBanner();
    return true;
  }

  window.FluxMindMapTasks = {
    FLAG,
    enabled,
    openMap,
    ensureMap,
    createTaskForNode,
    jumpToTask,
    getCloudSlice,
    applyFromCloud,
    getPaletteCommands,
    install,
  };
  window.openFluxMindMap = openMap;
})();
