/**
 * Flux · Co-work — live study room for any task.
 *
 * Two students (or more) co-work on the same assignment:
 *   - Host opens any task → "Co-work" → spawns a 6-char room code
 *   - Joiners use ?cowork=ABC123 link OR paste the code into a modal
 *   - Shared checklist (task.subtasks) syncs in realtime via Supabase channel broadcast
 *   - Presence shows avatars of everyone in the room
 *   - Host's task auto-syncs back on every change (so progress survives the session)
 *
 * Flag: enable_cowork (defaults ON in the flag defaults map)
 * No schema changes — uses ephemeral channel broadcast + presence.
 *
 * Self-contained IIFE. Exposes window.FluxCowork.
 */
(function () {
  'use strict';

  /* ---------- helpers ---------- */

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_cowork', true);
    } catch (_) { return true; }
  }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg, 'info'); return; } catch (_) {}
    }
    var t = document.createElement('div');
    t.className = 'flux-cowork-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('is-show'); });
    setTimeout(function () {
      t.classList.remove('is-show');
      setTimeout(function () { t.remove(); }, 220);
    }, 2200);
  }

  function getSB() {
    try {
      if (typeof window.getSB === 'function') return window.getSB();
    } catch (_) {}
    return null;
  }

  function getCurrentUser() {
    return (typeof currentUser !== 'undefined' && currentUser) || window.currentUser || null;
  }

  function getDisplayName(u) {
    if (!u) return 'You';
    return u.user_metadata?.full_name
        || u.user_metadata?.name
        || u.email?.split('@')[0]
        || 'Student';
  }

  function initials(name) {
    var parts = String(name || '?').trim().split(/\s+/).slice(0, 2);
    return parts.map(function (p) { return p.charAt(0).toUpperCase(); }).join('') || '?';
  }

  function makeRoomCode() {
    var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
    var code = '';
    for (var i = 0; i < 6; i++) {
      code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return code;
  }

  function findTask(id) {
    var list = Array.isArray(window.tasks) ? window.tasks : [];
    return list.find(function (t) { return String(t.id) === String(id); }) || null;
  }

  function persistTasks() {
    try { if (typeof window.save === 'function') window.save('tasks', window.tasks); } catch (_) {}
    try { if (typeof window.syncKey === 'function') window.syncKey('tasks', window.tasks); } catch (_) {}
    try { if (typeof window.renderTasks === 'function') window.renderTasks(); } catch (_) {}
  }

  /* ---------- state ---------- */

  var state = {
    room: null,          // current room code
    isHost: false,
    taskId: null,        // host's source task id (null on joiner)
    taskTitle: '',
    subtasks: [],        // [{id, text, done, by}]
    members: {},         // memberId -> { name, joinedAt, isHost }
    channel: null,
    selfId: null,
    selfName: null,
    activeRooms: new Set(), // for "is-live" indicator on cards
  };

  /* ---------- DOM ---------- */

  function buildScrim() {
    var existing = document.getElementById('fluxCoworkScrim');
    if (existing) return existing;
    var scrim = document.createElement('div');
    scrim.id = 'fluxCoworkScrim';
    scrim.className = 'flux-cowork-scrim';
    scrim.addEventListener('click', function (e) {
      if (e.target === scrim) leaveRoom();
    });
    document.body.appendChild(scrim);
    return scrim;
  }

  function renderRoom() {
    var scrim = buildScrim();
    var pct = state.subtasks.length
      ? Math.round(state.subtasks.filter(function (s) { return s.done; }).length / state.subtasks.length * 100)
      : 0;
    var memberList = Object.keys(state.members).map(function (id) {
      return Object.assign({ id: id }, state.members[id]);
    });
    var liveCount = memberList.length;

    var avatarsHtml = memberList.slice(0, 6).map(function (m) {
      var cls = 'flux-cowork-avatar';
      if (m.id === state.selfId) cls += ' is-self';
      if (m.isHost) cls += ' is-host';
      return '<div class="' + cls + '" title="' + esc(m.name) + (m.isHost ? ' (host)' : '') + '">'
        + esc(initials(m.name)) + '</div>';
    }).join('');
    var moreCount = Math.max(0, memberList.length - 6);
    if (moreCount) {
      avatarsHtml += '<div class="flux-cowork-avatar" title="' + moreCount + ' more">+' + moreCount + '</div>';
    }

    var itemsHtml;
    if (!state.subtasks.length) {
      itemsHtml = '<div class="flux-cowork-empty">'
        + '<strong>No checklist yet</strong>'
        + 'Add the first step below — everyone in the room will see it instantly.'
        + '</div>';
    } else {
      itemsHtml = state.subtasks.map(function (s, i) {
        var cls = 'flux-cowork-item' + (s.done ? ' is-done' : '');
        var by = s.by ? '<span class="flux-cowork-item-by">— ' + esc(s.by) + '</span>' : '';
        return '<div class="' + cls + '" data-sid="' + esc(s.id) + '" data-idx="' + i + '">'
          + '<div class="flux-cowork-check">' + (s.done ? '✓' : '') + '</div>'
          + '<div class="flux-cowork-item-text">' + esc(s.text) + '</div>'
          + by
          + '</div>';
      }).join('');
    }

    scrim.innerHTML =
      '<div class="flux-cowork-panel" role="dialog" aria-modal="true" aria-label="Co-work room">'
      + '<div class="flux-cowork-head">'
      +   '<div class="flux-cowork-head-title">'
      +     '<div class="flux-cowork-eyebrow">Co-work · live</div>'
      +     '<div class="flux-cowork-title">' + esc(state.taskTitle || 'Shared checklist') + '</div>'
      +   '</div>'
      +   '<button type="button" class="flux-cowork-close" aria-label="Leave room" data-act="leave">✕</button>'
      + '</div>'
      + '<div class="flux-cowork-code">'
      +   '<span class="flux-cowork-code-label">Room</span>'
      +   '<span class="flux-cowork-code-value">' + esc(state.room) + '</span>'
      +   '<div class="flux-cowork-code-actions">'
      +     '<button type="button" class="flux-cowork-mini-btn" data-act="copy-code">Copy code</button>'
      +     '<button type="button" class="flux-cowork-mini-btn" data-act="copy-link">Copy link</button>'
      +   '</div>'
      + '</div>'
      + '<div class="flux-cowork-presence">'
      +   '<div class="flux-cowork-avatars">' + avatarsHtml + '</div>'
      +   '<div class="flux-cowork-presence-meta">'
      +     '<strong>' + liveCount + '</strong> ' + (liveCount === 1 ? 'student here' : 'students here')
      +   '</div>'
      + '</div>'
      + '<div class="flux-cowork-progress">'
      +   '<span>' + pct + '%</span>'
      +   '<div class="flux-cowork-progress-bar"><div class="flux-cowork-progress-fill" style="width:' + pct + '%"></div></div>'
      +   '<span>' + state.subtasks.filter(function (s) { return s.done; }).length + '/' + state.subtasks.length + '</span>'
      + '</div>'
      + '<div class="flux-cowork-checklist" id="fluxCoworkList">' + itemsHtml + '</div>'
      + '<div class="flux-cowork-add">'
      +   '<input type="text" id="fluxCoworkAddInput" placeholder="Add a step…" maxlength="180" autocomplete="off">'
      +   '<button type="button" data-act="add">Add</button>'
      + '</div>'
      + '</div>';

    requestAnimationFrame(function () { scrim.classList.add('is-open'); });

    // wire delegation
    scrim.querySelector('[data-act="leave"]').addEventListener('click', leaveRoom);
    scrim.querySelector('[data-act="copy-code"]').addEventListener('click', function () {
      copyText(state.room);
      flashBtn(this, 'Copied');
    });
    scrim.querySelector('[data-act="copy-link"]').addEventListener('click', function () {
      var url = shareUrl(state.room);
      copyText(url);
      flashBtn(this, 'Copied');
    });
    scrim.querySelector('[data-act="add"]').addEventListener('click', addSubtaskFromInput);
    var input = scrim.querySelector('#fluxCoworkAddInput');
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); addSubtaskFromInput(); }
    });

    // checklist clicks
    scrim.querySelectorAll('.flux-cowork-item').forEach(function (el) {
      el.addEventListener('click', function () {
        toggleSubtask(el.getAttribute('data-sid'));
      });
    });
  }

  function flashBtn(btn, label) {
    var orig = btn.textContent;
    btn.textContent = label;
    btn.classList.add('is-ok');
    setTimeout(function () {
      btn.textContent = orig;
      btn.classList.remove('is-ok');
    }, 1100);
  }

  function copyText(s) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(s);
        return;
      }
    } catch (_) {}
    try {
      var ta = document.createElement('textarea');
      ta.value = s; ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    } catch (_) {}
  }

  function shareUrl(code) {
    try {
      var u = new URL(window.location.href);
      u.searchParams.set('cowork', code);
      u.hash = '';
      return u.toString();
    } catch (_) {
      return window.location.origin + window.location.pathname + '?cowork=' + code;
    }
  }

  function closeScrim() {
    var scrim = document.getElementById('fluxCoworkScrim');
    if (!scrim) return;
    scrim.classList.remove('is-open');
    setTimeout(function () { try { scrim.remove(); } catch (_) {} }, 240);
  }

  /* ---------- room lifecycle ---------- */

  function hostRoom(taskId) {
    var task = findTask(taskId);
    if (!task) { toast('Task not found'); return; }
    var user = getCurrentUser();
    state.room = makeRoomCode();
    state.isHost = true;
    state.taskId = task.id;
    state.taskTitle = task.name || task.title || 'Untitled task';
    state.subtasks = (task.subtasks || []).map(function (s, i) {
      return {
        id: s.id || ('s' + Date.now() + '_' + i),
        text: s.text || '',
        done: !!s.done,
        by: s.by || null,
      };
    });
    state.selfId = (user && user.id) || ('guest_' + Math.random().toString(36).slice(2, 8));
    state.selfName = getDisplayName(user);
    state.members = {};
    state.members[state.selfId] = { name: state.selfName, isHost: true, joinedAt: Date.now() };
    state.activeRooms.add(task.id);

    openChannel();
    renderRoom();
    refreshCardIndicators();
    toast('Room ' + state.room + ' — share the code to invite');
  }

  function joinRoom(code) {
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z2-9]{6}$/.test(code)) { toast('Invalid room code'); return; }
    var user = getCurrentUser();
    state.room = code;
    state.isHost = false;
    state.taskId = null;
    state.taskTitle = 'Joining…';
    state.subtasks = [];
    state.selfId = (user && user.id) || ('guest_' + Math.random().toString(36).slice(2, 8));
    state.selfName = getDisplayName(user);
    state.members = {};
    state.members[state.selfId] = { name: state.selfName, isHost: false, joinedAt: Date.now() };

    openChannel();
    renderRoom();
    // ask host for current state
    setTimeout(function () { broadcast('hello', { name: state.selfName }); }, 250);
  }

  function leaveRoom() {
    if (!state.room) { closeScrim(); return; }
    broadcast('bye', { name: state.selfName });
    if (state.isHost && state.taskId != null) {
      // final writeback
      writebackToHostTask();
      state.activeRooms.delete(state.taskId);
    }
    if (state.channel) {
      try { getSB()?.removeChannel(state.channel); } catch (_) {}
    }
    state.channel = null;
    state.room = null;
    state.isHost = false;
    state.taskId = null;
    state.subtasks = [];
    state.members = {};
    closeScrim();
    refreshCardIndicators();
  }

  /* ---------- realtime channel ---------- */

  function openChannel() {
    var sb = getSB();
    if (!sb || !state.room) {
      // No Supabase — operate in local-only mode (host can still use checklist solo)
      console.warn('[Flux Co-work] Supabase unavailable — running local only');
      return;
    }
    var chName = 'cowork_' + state.room;
    try {
      var ch = sb.channel(chName, {
        config: { presence: { key: state.selfId } },
      });

      ch.on('broadcast', { event: 'hello' }, function (msg) {
        var p = msg.payload || {};
        if (p.from === state.selfId) return;
        // Host responds with current snapshot
        if (state.isHost) {
          broadcast('snapshot', {
            taskTitle: state.taskTitle,
            subtasks: state.subtasks,
          });
        }
      });

      ch.on('broadcast', { event: 'snapshot' }, function (msg) {
        if (state.isHost) return;
        var p = msg.payload || {};
        if (p.taskTitle) state.taskTitle = p.taskTitle;
        if (Array.isArray(p.subtasks)) state.subtasks = p.subtasks.slice();
        renderRoom();
      });

      ch.on('broadcast', { event: 'toggle' }, function (msg) {
        var p = msg.payload || {};
        if (p.from === state.selfId) return;
        var s = state.subtasks.find(function (x) { return x.id === p.id; });
        if (!s) return;
        s.done = !!p.done;
        s.by = p.by || s.by;
        renderRoom();
        flashItem(p.id);
        if (state.isHost) writebackToHostTask();
      });

      ch.on('broadcast', { event: 'add' }, function (msg) {
        var p = msg.payload || {};
        if (p.from === state.selfId) return;
        if (!p.item || state.subtasks.some(function (s) { return s.id === p.item.id; })) return;
        state.subtasks.push(p.item);
        renderRoom();
        if (state.isHost) writebackToHostTask();
      });

      ch.on('broadcast', { event: 'bye' }, function (msg) {
        var p = msg.payload || {};
        if (p.from && state.members[p.from]) {
          delete state.members[p.from];
          renderRoom();
        }
      });

      ch.on('presence', { event: 'sync' }, function () {
        var pres = ch.presenceState ? ch.presenceState() : {};
        var next = {};
        // keep self
        next[state.selfId] = state.members[state.selfId] || {
          name: state.selfName, isHost: state.isHost, joinedAt: Date.now(),
        };
        Object.keys(pres).forEach(function (key) {
          var entries = pres[key];
          var e = Array.isArray(entries) ? entries[0] : entries;
          if (!e) return;
          next[key] = {
            name: e.name || 'Student',
            isHost: !!e.isHost,
            joinedAt: e.joinedAt || Date.now(),
          };
        });
        state.members = next;
        renderRoom();
      });

      ch.subscribe(function (status) {
        if (status === 'SUBSCRIBED') {
          try {
            ch.track({
              name: state.selfName,
              isHost: state.isHost,
              joinedAt: Date.now(),
            });
          } catch (_) {}
        }
      });
      state.channel = ch;
    } catch (e) {
      console.warn('[Flux Co-work] channel failed', e);
    }
  }

  function broadcast(event, payload) {
    if (!state.channel) return;
    try {
      state.channel.send({
        type: 'broadcast',
        event: event,
        payload: Object.assign({ from: state.selfId, t: Date.now() }, payload || {}),
      });
    } catch (e) {
      console.warn('[Flux Co-work] broadcast failed', e);
    }
  }

  /* ---------- checklist ops ---------- */

  function toggleSubtask(sid) {
    var s = state.subtasks.find(function (x) { return x.id === sid; });
    if (!s) return;
    s.done = !s.done;
    s.by = state.selfName;
    flashItem(sid);
    renderRoom();
    broadcast('toggle', { id: sid, done: s.done, by: state.selfName });
    if (state.isHost) writebackToHostTask();
  }

  function addSubtaskFromInput() {
    var input = document.getElementById('fluxCoworkAddInput');
    if (!input) return;
    var text = (input.value || '').trim();
    if (!text) return;
    var item = {
      id: 'c' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      text: text,
      done: false,
      by: state.selfName,
    };
    state.subtasks.push(item);
    input.value = '';
    renderRoom();
    document.getElementById('fluxCoworkAddInput')?.focus();
    broadcast('add', { item: item });
    if (state.isHost) writebackToHostTask();
  }

  function flashItem(sid) {
    setTimeout(function () {
      var el = document.querySelector('.flux-cowork-item[data-sid="' + sid + '"]');
      if (!el) return;
      el.classList.add('just-checked');
      setTimeout(function () { el.classList.remove('just-checked'); }, 650);
    }, 0);
  }

  function writebackToHostTask() {
    if (!state.isHost || state.taskId == null) return;
    var t = findTask(state.taskId);
    if (!t) return;
    t.subtasks = state.subtasks.map(function (s) {
      return { id: s.id, text: s.text, done: !!s.done, by: s.by || undefined };
    });
    persistTasks();
  }

  /* ---------- join modal ---------- */

  function openJoinModal() {
    var existing = document.getElementById('fluxCoworkJoinScrim');
    if (existing) existing.remove();
    var scrim = document.createElement('div');
    scrim.id = 'fluxCoworkJoinScrim';
    scrim.className = 'flux-cowork-scrim';
    scrim.innerHTML =
      '<div class="flux-cowork-join">'
      + '<h3>Join a co-work room</h3>'
      + '<p>Paste the 6-letter code your friend shared.</p>'
      + '<input id="fluxCoworkJoinInput" type="text" maxlength="6" autocomplete="off" inputmode="latin" placeholder="ABC123">'
      + '<div class="flux-cowork-join-actions">'
      +   '<button type="button" data-act="cancel">Cancel</button>'
      +   '<button type="button" class="is-primary" data-act="join">Join</button>'
      + '</div>'
      + '</div>';
    document.body.appendChild(scrim);
    requestAnimationFrame(function () { scrim.classList.add('is-open'); });

    var input = scrim.querySelector('#fluxCoworkJoinInput');
    setTimeout(function () { input.focus(); }, 80);

    function close() {
      scrim.classList.remove('is-open');
      setTimeout(function () { try { scrim.remove(); } catch (_) {} }, 200);
    }
    function go() {
      var code = (input.value || '').trim().toUpperCase();
      if (!/^[A-Z2-9]{6}$/.test(code)) { input.style.borderColor = '#ef4444'; return; }
      close();
      joinRoom(code);
    }
    scrim.querySelector('[data-act="cancel"]').addEventListener('click', close);
    scrim.querySelector('[data-act="join"]').addEventListener('click', go);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') go();
      else if (e.key === 'Escape') close();
    });
    scrim.addEventListener('click', function (e) { if (e.target === scrim) close(); });
  }

  /* ---------- entry points called from task cards ---------- */

  function openForTask(taskId) {
    if (!enabled()) return;
    if (state.room) { renderRoom(); return; }
    hostRoom(taskId);
  }

  /* ---------- task-card "Co-work" button injection ---------- */

  function refreshCardIndicators() {
    document.querySelectorAll('.task-action-btn--cowork').forEach(function (btn) {
      var tid = btn.getAttribute('data-task-id');
      if (state.activeRooms.has(Number(tid)) || state.activeRooms.has(tid)) {
        btn.classList.add('is-live');
      } else {
        btn.classList.remove('is-live');
      }
    });
  }

  function injectButtons() {
    if (!enabled()) return;
    var cards = document.querySelectorAll('.task-item, .task-card');
    cards.forEach(function (card) {
      var actions = card.querySelector('.task-actions');
      if (!actions) return;
      if (actions.querySelector('.task-action-btn--cowork')) return;
      // find task id from any sibling onclick="...openEdit(123)" or data-attr
      var tid = card.getAttribute('data-task-id');
      if (!tid) {
        var ed = actions.querySelector('[onclick*="openEdit("]');
        if (ed) {
          var m = ed.getAttribute('onclick').match(/openEdit\((\d+)\)/);
          if (m) tid = m[1];
        }
      }
      if (!tid) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'task-action-btn task-action-btn--cowork';
      btn.title = 'Co-work on this assignment';
      btn.setAttribute('data-task-id', tid);
      btn.innerHTML = '👥';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        openForTask(Number(tid));
      });
      // insert before the edit button if present, else append
      var edBtn = actions.querySelector('[onclick*="openEdit("]');
      if (edBtn) actions.insertBefore(btn, edBtn);
      else actions.appendChild(btn);
    });
    refreshCardIndicators();
  }

  function watchTaskList() {
    // Wrap renderTasks to re-inject after each render
    if (window.__fluxCoworkWrapped) return;
    window.__fluxCoworkWrapped = true;
    var orig = window.renderTasks;
    if (typeof orig === 'function') {
      window.renderTasks = function () {
        var r = orig.apply(this, arguments);
        try { injectButtons(); } catch (_) {}
        return r;
      };
    }
    // Also observe the task list container for dynamic additions
    var list = document.getElementById('taskList');
    if (list && window.MutationObserver) {
      var mo = new MutationObserver(function () {
        // debounce
        clearTimeout(window.__fluxCoworkInjectT);
        window.__fluxCoworkInjectT = setTimeout(injectButtons, 50);
      });
      mo.observe(list, { childList: true, subtree: true });
    }
    injectButtons();
  }

  /* ---------- URL auto-join ---------- */

  function checkUrl() {
    try {
      var url = new URL(window.location.href);
      var code = url.searchParams.get('cowork');
      if (!code) return;
      // strip from URL so refresh doesn't re-trigger
      url.searchParams.delete('cowork');
      window.history.replaceState(null, '', url.toString());
      // small delay so the rest of the app boots first
      setTimeout(function () { joinRoom(code); }, 600);
    } catch (_) {}
  }

  /* ---------- public surface ---------- */

  window.FluxCowork = {
    enabled: enabled,
    openForTask: openForTask,
    openJoinModal: openJoinModal,
    joinRoom: joinRoom,
    leaveRoom: leaveRoom,
    state: function () { return state; },
  };

  // Expose a global helper for onclick attributes too
  window.fluxOpenCowork = openForTask;
  window.fluxJoinCowork = openJoinModal;

  /* ---------- boot ---------- */

  function boot() {
    if (!enabled()) return;
    watchTaskList();
    checkUrl();
    // Esc closes the room
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.room) {
        var scrim = document.getElementById('fluxCoworkScrim');
        if (scrim) leaveRoom();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
