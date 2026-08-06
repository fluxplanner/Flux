/**
 * Flux · Staff Messages — DMs and group chats between teachers / counselors /
 * admins / staff.
 *
 * Storage: public.staff_conversations / staff_conversation_members /
 * staff_messages (see staff_messaging migration). RLS keeps every query
 * scoped to conversations the signed-in user is a member of; recipients are
 * offered from user_roles rows with a staff role.
 *
 * UI: #staffMessages panel — conversation list on the left, active thread on
 * the right (stacked on mobile). Polls the open thread every 8s; everything
 * else refreshes on demand.
 *
 * Self-contained IIFE. Exposes window.FluxStaffMessages + renderStaffMessages.
 */
(function () {
  'use strict';

  var STAFF_ROLES = ['teacher', 'counselor', 'admin', 'staff'];
  var POLL_MS = 8000;

  var state = {
    convos: [],            // staff_conversations rows (mine)
    membersByConvo: {},    // conversation_id -> member rows
    activeId: null,
    messages: [],
    people: null,          // cached staff people for the picker
    pollTimer: null,
    sending: false,
  };

  /* ---------- shared helpers ---------- */

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') {
      try { window.showToast(msg, kind || 'info'); } catch (_) {}
    }
  }

  function getSB() {
    try { if (typeof window.getSB === 'function') return window.getSB(); } catch (_) {}
    return null;
  }

  function me() {
    return (typeof window.currentUser !== 'undefined' && window.currentUser) || null;
  }

  function myName() {
    var u = me();
    var prof = (window.FluxRole && window.FluxRole.profile) || {};
    return prof.display_name
      || (u && u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name))
      || (u && u.email && u.email.split('@')[0])
      || 'Me';
  }

  function initials(name) {
    var parts = String(name || '?').trim().split(/\s+/).slice(0, 2);
    return parts.map(function (p) { return p.charAt(0).toUpperCase(); }).join('') || '?';
  }

  function fmtWhen(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var now = new Date();
    var sameDay = d.toDateString() === now.toDateString();
    try {
      if (sameDay) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (_) { return ''; }
  }

  function tableMissing(err) {
    if (!err) return false;
    var code = err.code || '';
    var msg = String(err.message || '');
    return code === '42P01' || /relation .* does not exist|could not find the table/i.test(msg);
  }

  /* ---------- data ---------- */

  function fetchConversations() {
    var sb = getSB(); var u = me();
    if (!sb || !u) return Promise.resolve({ rows: [], reason: 'offline' });
    return sb.from('staff_conversations').select('*')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(100)
      .then(function (res) {
        if (res.error) return { rows: [], reason: tableMissing(res.error) ? 'no_table' : 'error', error: res.error };
        return { rows: res.data || [], reason: null };
      })
      .catch(function (e) { return { rows: [], reason: 'error', error: e }; });
  }

  function fetchMembers(convoIds) {
    var sb = getSB();
    if (!sb || !convoIds.length) return Promise.resolve({});
    return sb.from('staff_conversation_members').select('*').in('conversation_id', convoIds)
      .then(function (res) {
        var map = {};
        (res.data || []).forEach(function (m) {
          (map[m.conversation_id] = map[m.conversation_id] || []).push(m);
        });
        return map;
      })
      .catch(function () { return {}; });
  }

  function fetchMessages(convoId) {
    var sb = getSB();
    if (!sb || !convoId) return Promise.resolve([]);
    return sb.from('staff_messages').select('*')
      .eq('conversation_id', convoId)
      .order('created_at', { ascending: true })
      .limit(300)
      .then(function (res) { return res.error ? [] : (res.data || []); })
      .catch(function () { return []; });
  }

  function fetchPeople() {
    if (state.people) return Promise.resolve(state.people);
    var sb = getSB(); var u = me();
    if (!sb || !u) return Promise.resolve([]);
    return sb.from('user_roles').select('user_id,display_name,role').in('role', STAFF_ROLES).limit(400)
      .then(function (res) {
        var rows = (res.data || []).filter(function (r) { return r.user_id && r.user_id !== u.id; });
        rows.sort(function (a, b) {
          return String(a.display_name || '').toLowerCase().localeCompare(String(b.display_name || '').toLowerCase());
        });
        state.people = rows;
        return rows;
      })
      .catch(function () { return []; });
  }

  function markRead(convoId) {
    var sb = getSB(); var u = me();
    if (!sb || !u || !convoId) return;
    sb.from('staff_conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', convoId).eq('user_id', u.id)
      .then(function () {}).catch(function () {});
  }

  // Reuse an existing DM with the same person instead of piling up threads.
  function findExistingDM(otherId) {
    var u = me();
    for (var i = 0; i < state.convos.length; i++) {
      var c = state.convos[i];
      if (c.is_group) continue;
      var mem = state.membersByConvo[c.id] || [];
      if (mem.length === 2
        && mem.some(function (m) { return m.user_id === otherId; })
        && mem.some(function (m) { return m.user_id === u.id; })) return c;
    }
    return null;
  }

  function createConversation(people, title) {
    var sb = getSB(); var u = me();
    if (!sb || !u || !people.length) return Promise.resolve(null);
    var isGroup = people.length > 1;
    if (!isGroup) {
      var existing = findExistingDM(people[0].user_id);
      if (existing) return Promise.resolve(existing);
    }
    var convo = {
      title: isGroup ? (title || people.map(function (p) { return (p.display_name || 'Staff').split(' ')[0]; }).slice(0, 4).join(', ')) : null,
      is_group: isGroup,
      created_by: u.id,
      last_message_at: new Date().toISOString(),
    };
    return sb.from('staff_conversations').insert(convo).select().single()
      .then(function (res) {
        if (res.error) {
          toast(tableMissing(res.error) ? 'Messaging isn’t set up yet — run the latest migration.' : (res.error.message || 'Could not start chat'), 'error');
          return null;
        }
        var row = res.data;
        var members = [{ conversation_id: row.id, user_id: u.id, display_name: myName() }]
          .concat(people.map(function (p) {
            return { conversation_id: row.id, user_id: p.user_id, display_name: p.display_name || 'Staff' };
          }));
        return sb.from('staff_conversation_members').insert(members).then(function (r2) {
          if (r2.error) { toast(r2.error.message || 'Could not add members', 'error'); return null; }
          return row;
        });
      })
      .catch(function (e) { toast(e.message || 'Could not start chat', 'error'); return null; });
  }

  function sendMessage(convoId, body) {
    var sb = getSB(); var u = me();
    if (!sb || !u || !convoId || !body.trim()) return Promise.resolve(false);
    var text = body.trim().slice(0, 4000);
    return sb.from('staff_messages').insert({
      conversation_id: convoId, sender_id: u.id, sender_name: myName(), body: text,
    }).then(function (res) {
      if (res.error) { toast(res.error.message || 'Could not send', 'error'); return false; }
      sb.from('staff_conversations').update({
        last_message_at: new Date().toISOString(),
        last_message_preview: text.slice(0, 80),
      }).eq('id', convoId).then(function () {}).catch(function () {});
      return true;
    }).catch(function (e) { toast(e.message || 'Could not send', 'error'); return false; });
  }

  /* ---------- rendering ---------- */

  function convoTitle(c) {
    var u = me();
    if (c.is_group) return c.title || 'Group chat';
    var mem = state.membersByConvo[c.id] || [];
    var other = mem.find(function (m) { return u && m.user_id !== u.id; });
    return (other && other.display_name) || c.title || 'Direct message';
  }

  function convoUnread(c) {
    var u = me();
    var mem = (state.membersByConvo[c.id] || []).find(function (m) { return u && m.user_id === u.id; });
    if (!mem || !c.last_message_at) return false;
    return !mem.last_read_at || mem.last_read_at < c.last_message_at;
  }

  function host() { return document.getElementById('staffMessagesBody'); }

  function render() {
    var el = host();
    if (!el) return;
    var listHtml = state.convos.map(function (c) {
      var t = convoTitle(c);
      var unread = convoUnread(c) && c.id !== state.activeId;
      return '<button type="button" class="fsm-convo' + (c.id === state.activeId ? ' active' : '') + (unread ? ' unread' : '') + '" data-fsm-open="' + esc(c.id) + '">'
        + '<span class="fsm-avatar' + (c.is_group ? ' fsm-avatar--group' : '') + '">' + (c.is_group ? '👥' : esc(initials(t))) + '</span>'
        + '<span class="fsm-convo-main"><span class="fsm-convo-title">' + esc(t) + '</span>'
        + '<span class="fsm-convo-preview">' + esc(c.last_message_preview || 'No messages yet') + '</span></span>'
        + '<span class="fsm-convo-side"><span class="fsm-convo-when">' + esc(fmtWhen(c.last_message_at)) + '</span>'
        + (unread ? '<span class="fsm-unread-dot" aria-label="Unread"></span>' : '')
        + '</span></button>';
    }).join('');

    var u = me();
    var active = state.convos.find(function (c) { return c.id === state.activeId; });
    var threadHtml;
    if (!active) {
      threadHtml = '<div class="fsm-thread-empty">'
        + '<div class="fsm-thread-empty-icon"></div>'
        + '<p>Pick a conversation, or start a new one.</p>'
        + '<button type="button" class="fsm-new-btn" data-fsm-new>+ New message</button>'
        + '</div>';
    } else {
      var mem = state.membersByConvo[active.id] || [];
      var sub = active.is_group
        ? mem.map(function (m) { return esc(m.display_name || 'Staff'); }).join(', ')
        : 'Direct message';
      var msgs = state.messages.map(function (m) {
        var mine = u && m.sender_id === u.id;
        return '<div class="fsm-msg' + (mine ? ' mine' : '') + '">'
          + (!mine && active.is_group ? '<div class="fsm-msg-sender">' + esc(m.sender_name || 'Staff') + '</div>' : '')
          + '<div class="fsm-msg-bubble">' + esc(m.body) + '</div>'
          + '<div class="fsm-msg-when">' + esc(fmtWhen(m.created_at)) + '</div>'
          + '</div>';
      }).join('') || '<div class="fsm-thread-hint">Say hi — messages stay between the people in this chat.</div>';
      threadHtml = ''
        + '<div class="fsm-thread-head">'
        +   '<button type="button" class="fsm-back" data-fsm-back aria-label="Back to conversations">←</button>'
        +   '<span class="fsm-avatar' + (active.is_group ? ' fsm-avatar--group' : '') + '">' + (active.is_group ? '👥' : esc(initials(convoTitle(active)))) + '</span>'
        +   '<div class="fsm-thread-title-wrap"><div class="fsm-thread-title">' + esc(convoTitle(active)) + '</div>'
        +   '<div class="fsm-thread-sub">' + sub + '</div></div>'
        +   (active.is_group ? '<button type="button" class="fsm-addppl" data-fsm-addppl title="Add people">+</button>' : '')
        + '</div>'
        + '<div class="fsm-msgs" id="fsmMsgs">' + msgs + '</div>'
        + '<div class="fsm-composer">'
        +   '<textarea id="fsmInput" rows="1" maxlength="4000" placeholder="Message…"></textarea>'
        +   '<button type="button" class="fsm-send" data-fsm-send aria-label="Send">➤</button>'
        + '</div>';
    }

    el.innerHTML = ''
      + '<div class="fsm-wrap' + (active ? ' has-active' : '') + '">'
      + '<div class="fsm-list-col">'
      +   '<div class="fsm-list-head"><h3>Messages</h3>'
      +   '<button type="button" class="fsm-new-btn" data-fsm-new>+ New</button></div>'
      +   '<div class="fsm-list">' + (listHtml || '<div class="fsm-list-empty">No conversations yet. Start one with <strong>+ New</strong>.</div>') + '</div>'
      + '</div>'
      + '<div class="fsm-thread-col">' + threadHtml + '</div>'
      + '</div>';

    wire(el);
    var box = document.getElementById('fsmMsgs');
    if (box) box.scrollTop = box.scrollHeight;
  }

  function wire(el) {
    el.querySelectorAll('[data-fsm-open]').forEach(function (btn) {
      btn.addEventListener('click', function () { openConvo(btn.getAttribute('data-fsm-open')); });
    });
    el.querySelectorAll('[data-fsm-new]').forEach(function (btn) {
      btn.addEventListener('click', function () { openPicker(null); });
    });
    var back = el.querySelector('[data-fsm-back]');
    if (back) back.addEventListener('click', function () { state.activeId = null; stopPoll(); render(); });
    var addppl = el.querySelector('[data-fsm-addppl]');
    if (addppl) addppl.addEventListener('click', function () { openPicker(state.activeId); });
    var send = el.querySelector('[data-fsm-send]');
    var input = el.querySelector('#fsmInput');
    function doSend() {
      if (state.sending || !input || !input.value.trim()) return;
      state.sending = true;
      var val = input.value;
      input.value = '';
      sendMessage(state.activeId, val).then(function (ok) {
        state.sending = false;
        if (!ok) { input.value = val; return; }
        refreshThread(true);
      });
    }
    if (send) send.addEventListener('click', doSend);
    if (input) {
      input.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); doSend(); }
      });
      input.focus();
    }
  }

  /* ---------- people picker modal ---------- */

  function openPicker(addToConvoId) {
    if (document.getElementById('fsmPickerModal')) return;
    var modal = document.createElement('div');
    modal.id = 'fsmPickerModal';
    modal.className = 'fsm-modal';
    modal.innerHTML = ''
      + '<div class="fsm-modal-card" role="dialog" aria-modal="true" aria-label="New message">'
      + '<div class="fsm-modal-head"><h3>' + (addToConvoId ? 'Add people' : 'New message') + '</h3>'
      + '<button type="button" class="fsm-modal-close" data-fsm-close aria-label="Close">✕</button></div>'
      + '<input type="search" id="fsmPickerSearch" placeholder="Search staff…" autocomplete="off">'
      + '<div class="fsm-people" id="fsmPeople"><div class="fsm-list-empty">Loading staff…</div></div>'
      + (addToConvoId ? '' : '<input type="text" id="fsmGroupName" placeholder="Group name (optional, for 2+ people)" maxlength="60" style="display:none">')
      + '<button type="button" class="fsm-start-btn" data-fsm-start disabled>' + (addToConvoId ? 'Add' : 'Start chat') + '</button>'
      + '</div>';
    document.body.appendChild(modal);

    var picked = {};
    var startBtn = modal.querySelector('[data-fsm-start]');
    var groupName = modal.querySelector('#fsmGroupName');

    function close() { modal.remove(); }
    modal.addEventListener('click', function (ev) { if (ev.target === modal) close(); });
    modal.querySelector('[data-fsm-close]').addEventListener('click', close);

    function syncStart() {
      var n = Object.keys(picked).length;
      startBtn.disabled = !n;
      startBtn.textContent = addToConvoId
        ? ('Add' + (n ? ' (' + n + ')' : ''))
        : (n > 1 ? 'Start group chat (' + n + ')' : 'Start chat');
      if (groupName) groupName.style.display = n > 1 ? '' : 'none';
    }

    fetchPeople().then(function (people) {
      var box = modal.querySelector('#fsmPeople');
      if (!box) return;
      if (!people.length) {
        box.innerHTML = '<div class="fsm-list-empty">No other staff accounts found yet.</div>';
        return;
      }
      // Hide people already in the conversation when adding.
      var already = {};
      if (addToConvoId) {
        (state.membersByConvo[addToConvoId] || []).forEach(function (m) { already[m.user_id] = 1; });
      }
      box.innerHTML = people.filter(function (p) { return !already[p.user_id]; }).map(function (p) {
        var label = p.display_name || 'Staff';
        return '<button type="button" class="fsm-person" data-fsm-pick="' + esc(p.user_id) + '" data-fsm-name="' + esc(label) + '" data-fsm-search="' + esc(String(label).toLowerCase()) + '">'
          + '<span class="fsm-avatar">' + esc(initials(label)) + '</span>'
          + '<span class="fsm-person-name">' + esc(label) + '</span>'
          + '<span class="fsm-person-role">' + esc(p.role || 'staff') + '</span>'
          + '<span class="fsm-person-check">✓</span>'
          + '</button>';
      }).join('') || '<div class="fsm-list-empty">Everyone is already in this chat.</div>';
      box.querySelectorAll('[data-fsm-pick]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-fsm-pick');
          if (picked[id]) { delete picked[id]; btn.classList.remove('picked'); }
          else { picked[id] = { user_id: id, display_name: btn.getAttribute('data-fsm-name') }; btn.classList.add('picked'); }
          syncStart();
        });
      });
    });

    var search = modal.querySelector('#fsmPickerSearch');
    search.addEventListener('input', function () {
      var q = this.value.trim().toLowerCase();
      modal.querySelectorAll('[data-fsm-search]').forEach(function (p) {
        p.style.display = (!q || (p.getAttribute('data-fsm-search') || '').indexOf(q) !== -1) ? '' : 'none';
      });
    });
    search.focus();

    startBtn.addEventListener('click', function () {
      var people = Object.keys(picked).map(function (k) { return picked[k]; });
      if (!people.length) return;
      startBtn.disabled = true;
      if (addToConvoId) {
        var sb = getSB();
        var rows = people.map(function (p) {
          return { conversation_id: addToConvoId, user_id: p.user_id, display_name: p.display_name };
        });
        sb.from('staff_conversation_members').insert(rows).then(function (res) {
          if (res.error) { toast(res.error.message || 'Could not add', 'error'); startBtn.disabled = false; return; }
          close();
          toast('Added to the chat', 'success');
          refreshAll();
        });
        return;
      }
      createConversation(people, groupName ? groupName.value.trim() : '').then(function (convo) {
        if (!convo) { startBtn.disabled = false; return; }
        close();
        refreshAll().then(function () { openConvo(convo.id); });
      });
    });
  }

  /* ---------- refresh loops ---------- */

  function openConvo(id) {
    state.activeId = id;
    state.messages = [];
    render();
    refreshThread(true);
    markRead(id);
    startPoll();
  }

  function refreshThread(force) {
    if (!state.activeId) return Promise.resolve();
    var id = state.activeId;
    return fetchMessages(id).then(function (msgs) {
      if (state.activeId !== id) return;
      var grew = force || msgs.length !== state.messages.length;
      state.messages = msgs;
      if (grew) { render(); markRead(id); }
    });
  }

  function refreshAll() {
    return fetchConversations().then(function (res) {
      state.convos = res.rows;
      if (res.reason === 'no_table') {
        var el = host();
        if (el) el.innerHTML = '<div class="fsm-list-empty" style="padding:32px">Messaging isn’t set up yet — ask the owner to run the <code>staff_messaging</code> migration.</div>';
        return;
      }
      return fetchMembers(res.rows.map(function (c) { return c.id; })).then(function (map) {
        state.membersByConvo = map;
        render();
      });
    });
  }

  function panelVisible() {
    var p = document.getElementById('staffMessages');
    return !!(p && p.classList.contains('active'));
  }

  function startPoll() {
    stopPoll();
    state.pollTimer = setInterval(function () {
      if (!panelVisible()) { stopPoll(); return; }
      refreshThread(false);
    }, POLL_MS);
  }

  function stopPoll() {
    if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
  }

  /* ---------- boot / public ---------- */

  function renderStaffMessages() {
    var panel = document.getElementById('staffMessages');
    if (!panel) return;
    if (!document.getElementById('staffMessagesBody')) {
      var body = document.createElement('div');
      body.id = 'staffMessagesBody';
      panel.appendChild(body);
    }
    var el = host();
    if (el && !el.innerHTML.trim()) {
      el.innerHTML = '<div class="fsm-list-empty" style="padding:32px">Loading messages…</div>';
    }
    refreshAll();
  }

  window.renderStaffMessages = renderStaffMessages;
  window.FluxStaffMessages = {
    render: renderStaffMessages,
    refresh: refreshAll,
    _state: state,
  };
})();
