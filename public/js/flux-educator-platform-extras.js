/**
 * Educator platform: admin school dashboard, announcements, calendar,
 * meeting slots/requests, counselor availability grid, and appointment
 * booking from counselor_availability_slots. Loaded after app.js.
 */
(function () {
  'use strict';

  let _apptDaySlots = {};
  let _apptCounselorId = null;
  let _adminMeetDate = null;
  let _adminMeetTime = null;
  let _adminMeetSlotsByDate = {};

  function sb() {
    return typeof getSB === 'function' ? getSB() : null;
  }

  function switchEduTab(btn, tabId) {
    const modal = btn.closest('.edu-fullscreen-modal');
    const scope = modal || document;
    scope.querySelectorAll('.efm-tab').forEach((t) => t.classList.remove('active'));
    scope.querySelectorAll('.efm-tab-content').forEach((t) => {
      t.style.display = 'none';
    });
    btn.classList.add('active');
    const pane = document.getElementById('eduTab-' + tabId);
    if (pane) pane.style.display = '';
  }
  window.switchEduTab = switchEduTab;

  function groupEventsByMonth(events) {
    const groups = new Map();
    (events || []).forEach((e) => {
      const month = new Date(e.event_date + 'T00:00').toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
      if (!groups.has(month)) groups.set(month, []);
      groups.get(month).push(e);
    });
    return [...groups.entries()];
  }
  window.groupEventsByMonth = groupEventsByMonth;

  function getEventColor(type) {
    const colors = {
      holiday: '#a78bfa',
      no_school: '#ff4d6d',
      exam: '#f5a623',
      early_release: '#00d9a3',
      activity: '#00bfff',
      sports: '#00bfff',
      general: 'rgba(255,255,255,.4)',
      deadline: '#f5a623',
    };
    return colors[type] || colors.general;
  }
  window.getEventColor = getEventColor;

  // ── Stubs / small entry points (sidebar + dashboard CTAs) ─────────
  function openTeacherClassesPanel() {
    try {
      if (typeof FluxRole !== 'undefined' && FluxRole.isWorkMode && FluxRole.isWorkMode()) {
        if (FluxRole.isTeacher()) {
          if (typeof nav === 'function') nav('teacherDashboard');
          if (typeof renderTeacherDashboard === 'function') renderTeacherDashboard();
          return;
        }
        if (FluxRole.isStaff && FluxRole.isStaff()) {
          if (typeof nav === 'function') nav('adminDashboard');
          if (typeof renderAdminDashboard === 'function') renderAdminDashboard();
          return;
        }
        if (FluxRole.isCounselor && FluxRole.isCounselor()) {
          if (typeof nav === 'function') nav('counselorDashboard');
          if (typeof renderCounselorDashboard === 'function') renderCounselorDashboard();
          return;
        }
      }
    } catch (_) {}
    if (typeof nav === 'function') nav('teacherDashboard');
    try {
      if (typeof renderTeacherDashboard === 'function') renderTeacherDashboard();
    } catch (_) {}
  }
  function openTeacherGradebook() {
    if (typeof showToast === 'function')
      showToast('Pick a class on the overview, then open the Grades tab.', 'info');
  }
  function openTeacherMessages() {
    if (typeof showToast === 'function') showToast('Use Messages on the teacher overview.', 'info');
  }
  function openJoinRequestsManager() {
    if (typeof openTeacherPendingJoinsModal === 'function') openTeacherPendingJoinsModal();
  }
  function openCounselorCalendar() {
    if (typeof nav === 'function') nav('counselorMeetings');
    try {
      renderCounselorMeetings();
    } catch (_) {}
  }
  function openCounselorStudentList() {
    if (typeof showToast === 'function') showToast('Student caseload list — use Messages and appointments for now.', 'info');
  }
  function openAnnouncementsManager() {
    openPostAnnouncementModal('admin');
  }
  function openAdminClassView(classId) {
    if (typeof showToast === 'function') showToast('Class ' + String(classId).slice(0, 8) + '…', 'info');
  }
  function openStudentAdminView() {
    if (typeof showToast === 'function') showToast('Full student profile view coming soon.', 'info');
  }
  function openAdminGradebookView() {
    if (typeof showToast === 'function') showToast('School-wide grade reports — export from each class for now.', 'info');
  }
  function openAdminMessenger() {
    if (typeof showToast === 'function') showToast('Message users from User Management.', 'info');
  }
  function openSchoolSettingsModal() {
    if (typeof showToast === 'function') showToast('School settings — use Profile and Operations.', 'info');
  }
  function exportUsersCSV() {
    if (typeof showToast === 'function') showToast('CSV export coming soon.', 'info');
  }
  function openAdminUserDetail() {
    if (typeof showToast === 'function') showToast('User detail — use Message from the list.', 'info');
  }
  function setAllAdminSlots() {
    if (typeof showToast === 'function') showToast('Use the grid controls in Meeting Availability.', 'info');
  }

  window.openTeacherClassesPanel = openTeacherClassesPanel;
  window.openTeacherGradebook = openTeacherGradebook;
  window.openTeacherMessages = openTeacherMessages;
  window.openJoinRequestsManager = openJoinRequestsManager;
  window.openCounselorCalendar = openCounselorCalendar;
  window.openCounselorStudentList = openCounselorStudentList;
  window.openAnnouncementsManager = openAnnouncementsManager;
  window.openAdminClassView = openAdminClassView;
  window.openStudentAdminView = openStudentAdminView;
  window.openAdminGradebookView = openAdminGradebookView;
  window.openAdminMessenger = openAdminMessenger;
  window.openSchoolSettingsModal = openSchoolSettingsModal;
  window.exportUsersCSV = exportUsersCSV;
  window.openAdminUserDetail = openAdminUserDetail;
  window.setAllAdminSlots = setAllAdminSlots;
  window.openTeacherClassDetail = function (id) {
    if (typeof openTeacherClassView === 'function') openTeacherClassView(id);
  };

  // ── Admin dashboard ───────────────────────────────────────────────
  async function renderAdminDashboard() {
    const el = document.getElementById('adminDashboardBody');
    if (!el || !window.currentUser) return;
    el.innerHTML =
      '<div class="edu-loading" style="padding:20px;color:var(--muted2)">Loading…</div>';
    const client = sb();
    const uid = currentUser.id;
    if (!client) {
      el.innerHTML =
      typeof renderEmptyState === 'function'
        ? renderEmptyState('⚠', 'Offline', 'Sign in to load the school dashboard.', '', '')
        : '<div class="edu-empty-sm">Sign in to load the school dashboard.</div>';
      return;
    }
    let users = [],
      classes = [],
      appointments = [],
      announcements = [],
      meetingRequests = [];
    try {
      const [usersRes, classesRes, apptRes, announceRes, meetRes] = await Promise.all([
        client.from('user_roles').select('role, user_id').neq('user_id', uid),
        client.from('teacher_classes').select('id,class_name,teacher_id').eq('active', true),
        client
          .from('counselor_appointments')
          .select('id,status,date')
          .gte('date', new Date().toISOString().slice(0, 10)),
        client
          .from('school_announcements')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5),
        client
          .from('admin_meeting_requests')
          .select('*,user_roles!student_id(display_name)')
          .eq('admin_id', uid)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
      ]);
      users = usersRes.data || [];
      classes = classesRes.data || [];
      appointments = apptRes.data || [];
      announcements = announceRes.data || [];
      meetingRequests = meetRes.data || [];
    } catch (e) {
      console.warn('[admin dash]', e);
    }
    const byRole = {
      student: users.filter((u) => u.role === 'student').length,
      teacher: users.filter((u) => u.role === 'teacher').length,
      counselor: users.filter((u) => u.role === 'counselor').length,
      staff: users.filter((u) => ['staff', 'admin'].includes(u.role)).length,
    };
    const profile = FluxRole.profile;
    const name =
      profile?.display_name ||
      currentUser?.user_metadata?.full_name ||
      'Administrator';
    const last = name.split(' ').slice(-1)[0];
    el.innerHTML = `
  <div class="edu-dash-root">
    <div class="edu-toprow">
      <div class="edu-greeting">
        <span class="edu-hello">${getTimeGreeting()}, ${esc(last)}</span>
        <span class="edu-sub">${esc(profile?.school || 'Your School')} · ${new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}</span>
      </div>
      <div class="edu-actions">
        <button type="button" class="edu-action-btn primary" onclick="openPostAnnouncementModal('admin')">📢 Announce</button>
        <button type="button" class="edu-action-btn" onclick="openSchoolCalendar()">📅 School Calendar</button>
        <button type="button" class="edu-action-btn" onclick="openAdminUserManager()">👥 Manage Users</button>
        <button type="button" class="edu-action-btn" onclick="openAdminAvailabilityEditor()">🕐 My Availability</button>
        <button type="button" class="edu-action-btn danger" onclick="openEmergencyAlertModal()">🚨 Emergency</button>
      </div>
    </div>
    <div class="admin-stats-band">
      <div class="asb-stat"><div class="asb-n">${byRole.student}</div><div class="asb-l">Students</div></div>
      <div class="asb-stat"><div class="asb-n">${byRole.teacher}</div><div class="asb-l">Teachers</div></div>
      <div class="asb-stat"><div class="asb-n">${byRole.counselor}</div><div class="asb-l">Counselors</div></div>
      <div class="asb-stat"><div class="asb-n">${classes.length}</div><div class="asb-l">Active Classes</div></div>
      <div class="asb-stat ${meetingRequests.length > 0 ? 'alert' : ''}"><div class="asb-n">${meetingRequests.length}</div><div class="asb-l">Meeting Requests</div></div>
      <div class="asb-stat"><div class="asb-n">${appointments.filter((a) => a.status === 'pending').length}</div><div class="asb-l">Pending Appts</div></div>
    </div>
    ${
      meetingRequests.length > 0
        ? `
    <div class="edu-request-banner urgent">
      <span class="erb-icon">🗓</span>
      <span class="erb-text">${meetingRequests.length} student meeting request(s)</span>
      <button type="button" onclick="openMeetingRequestsManager()" class="erb-btn">Review</button>
    </div>`
        : ''
    }
    <div class="admin-main-grid">
      <div class="edu-col">
        <div class="edu-col-head"><h3>📢 Announcements</h3><button type="button" onclick="openPostAnnouncementModal('admin')" class="edu-col-add">+ Post</button></div>
        ${
          announcements.length === 0
            ? '<div class="edu-empty-sm">No announcements yet</div>'
            : announcements
                .map(
                  (a) => `
          <div class="admin-announce-card priority-${esc(a.priority || 'normal')}">
            <div class="aac-header">
              <span class="aac-priority priority-label-${esc(a.priority || 'normal')}">${esc(
                    String(a.priority || 'normal').toUpperCase()
                  )}</span>
              <span class="aac-time">${timeAgo(new Date(a.created_at))}</span>
            </div>
            <div class="aac-title">${esc(a.title)}</div>
          </div>`
                )
                .join('')
        }
      </div>
      <div class="edu-col">
        <div class="edu-col-head"><h3>🗓 Meeting Requests</h3></div>
        ${
          meetingRequests.length === 0
            ? '<div class="edu-empty-sm">No pending requests</div>'
            : meetingRequests
                .slice(0, 5)
                .map(
                  (r) => `
          <div class="edu-request-card ${r.is_urgent ? 'urgent' : ''}">
            <div class="erc-header">
              <div class="erc-avatar">${esc((r.user_roles?.display_name || 'S')[0])}</div>
              <div class="erc-info">
                <div class="erc-name">${esc(r.user_roles?.display_name || 'Student')}</div>
                <div class="erc-meta">${new Date(r.date + 'T00:00').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })} at ${esc(r.time_slot)}</div>
              </div>
            </div>
            <div class="erc-reason">${esc(r.subject)}</div>
            <div class="erc-actions">
              <button type="button" onclick="respondToMeetingRequest('${r.id}','approved')" class="edu-action-btn primary">✓ Approve</button>
              <button type="button" onclick="respondToMeetingRequest('${r.id}','rejected')" class="edu-action-btn danger">✕ Decline</button>
              <button type="button" onclick="openMessageThread('${r.student_id}')" class="edu-action-btn secondary">Message</button>
            </div>
          </div>`
                )
                .join('')
        }
      </div>
      <div class="edu-col">
        <div class="edu-col-head"><h3>📚 All Classes</h3></div>
        <div style="max-height:400px;overflow-y:auto">
          ${classes
            .slice(0, 15)
            .map(
              (c) => `
          <div class="admin-class-row">
            <div class="acr-name">${esc(c.class_name)}</div>
            <button type="button" onclick="openAdminClassView('${c.id}')" class="edu-action-btn small secondary">View</button>
          </div>`
            )
            .join('')}
        </div>
        <button type="button" onclick="openAdminUserManager()" class="edu-action-btn" style="width:100%;margin-top:12px">View All Users</button>
      </div>
      <div class="edu-col">
        <div class="edu-col-head"><h3>⚡ Quick Tools</h3></div>
        <div class="admin-tools-grid">
          <button type="button" onclick="openSchoolCalendar()" class="admin-tool-btn"><span>📅</span><div>School Calendar</div></button>
          <button type="button" onclick="openAdminUserManager()" class="admin-tool-btn"><span>👥</span><div>All Users</div></button>
          <button type="button" onclick="openAdminGradebookView()" class="admin-tool-btn"><span>📊</span><div>Grade Reports</div></button>
          <button type="button" onclick="openAdminMessenger()" class="admin-tool-btn"><span>💬</span><div>Message All</div></button>
          <button type="button" onclick="openEmergencyAlertModal()" class="admin-tool-btn urgent"><span>🚨</span><div>Emergency Alert</div></button>
          <button type="button" onclick="openSchoolSettingsModal()" class="admin-tool-btn"><span>⚙</span><div>School Settings</div></button>
        </div>
      </div>
    </div>
  </div>`;
  }
  window.renderAdminDashboard = renderAdminDashboard;

  async function openAdminUserManager(defaultTab) {
    const client = sb();
    if (!client) return;
    let users = [];
    try {
      const { data } = await client
        .from('user_roles')
        .select('*, counselors(*)')
        .order('role')
        .order('display_name');
      users = data || [];
    } catch (_) {
      if (typeof showToast === 'function') showToast('Could not load users.', 'error');
      return;
    }
    const roles = ['student', 'teacher', 'counselor', 'staff', 'admin'];
    const byRole = {};
    roles.forEach((r) => {
      byRole[r] = users.filter((u) => u.role === r);
    });
    const modal = document.createElement('div');
    modal.className = 'edu-fullscreen-modal';
    modal.innerHTML = `
  <div class="efm-inner">
    <div class="efm-header">
      <button type="button" onclick="this.closest('.edu-fullscreen-modal').remove()" class="efm-back">← Back</button>
      <div class="efm-title-group">
        <h2>User Management</h2>
        <div class="efm-sub">${users.length} total accounts</div>
      </div>
      <div class="efm-actions">
        <input id="userSearchInput" placeholder="Search users…" style="padding:8px 14px;border-radius:10px;width:220px;font-size:.85rem" oninput="filterUserList(this.value)">
        <button type="button" onclick="exportUsersCSV()" class="edu-action-btn secondary">Export CSV</button>
      </div>
    </div>
    <div class="efm-tabs">
      ${roles
        .map(
          (r, i) => `
      <button type="button" class="efm-tab ${i === 0 ? 'active' : ''}" onclick="switchEduTab(this,'users-${r}')">
        ${r.charAt(0).toUpperCase() + r.slice(1)}s (${byRole[r].length})
      </button>`
        )
        .join('')}
    </div>
    ${roles
      .map((r, i) => {
        const list = byRole[r];
        const hidden = i > 0 ? ' style="display:none"' : '';
        if (!list.length)
          return `<div id="eduTab-users-${r}" class="efm-tab-content"${hidden}>${renderEmptyState(
            '👤',
            'No ' + r + 's yet',
            '',
            '',
            ''
          )}</div>`;
        return `
    <div id="eduTab-users-${r}" class="efm-tab-content"${hidden}>
      <div class="user-list" id="userList-${r}">
        ${list
          .map(
            (u) => `
        <div class="admin-user-row" data-search="${esc((u.display_name || '').toLowerCase())}">
          <div class="aur-avatar role-${esc(r)}">${esc((u.display_name || '?')[0])}</div>
          <div class="aur-info">
            <div class="aur-name">${esc(u.display_name || 'Unknown')}</div>
            <div class="aur-sub">${esc(u.subject || u.department || u.grade_level || '')} · ${esc(u.school || '')}</div>
          </div>
          <div class="aur-role-badge role-badge-${esc(r)}">${esc(r)}</div>
          <div class="aur-actions">
            <button type="button" onclick="openAdminUserDetail()" class="edu-action-btn small">View</button>
            <button type="button" onclick="openMessageThread('${u.user_id}')" class="edu-action-btn small secondary">Message</button>
          </div>
        </div>`
          )
          .join('')}
      </div>
    </div>`;
      })
      .join('')}
  </div>`;
    document.body.appendChild(modal);
    if (defaultTab && roles.includes(defaultTab)) {
      const tabBtn = modal.querySelectorAll('.efm-tab')[roles.indexOf(defaultTab)];
      if (tabBtn) switchEduTab(tabBtn, 'users-' + defaultTab);
    }
  }
  window.openAdminUserManager = openAdminUserManager;

  function filterUserList(query) {
    const q = (query || '').toLowerCase();
    document.querySelectorAll('.admin-user-row').forEach((row) => {
      row.style.display = row.dataset.search && row.dataset.search.includes(q) ? '' : 'none';
    });
  }
  window.filterUserList = filterUserList;

  function cycleAdminSlot(el) {
    const types = ['blocked', 'open', 'by_request'];
    const current = el.dataset.type || 'blocked';
    const next = types[(types.indexOf(current) + 1) % types.length];
    el.dataset.type = next;
    el.className =
      'avail-slot admin-slot ' +
      (next === 'open' ? 'available' : next === 'by_request' ? 'available-request' : '');
  }
  window.cycleAdminSlot = cycleAdminSlot;

  async function openAdminAvailabilityEditor() {
    const client = sb();
    if (!client || !currentUser) return;
    const uid = currentUser.id;
    let existingSlots = [];
    try {
      const { data } = await client.from('admin_meeting_slots').select('*').eq('admin_id', uid);
      existingSlots = data || [];
    } catch (_) {}
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const slotTimes = [
      '8:00 AM',
      '8:30 AM',
      '9:00 AM',
      '9:30 AM',
      '10:00 AM',
      '10:30 AM',
      '11:00 AM',
      '11:30 AM',
      '12:00 PM',
      '12:30 PM',
      '1:00 PM',
      '1:30 PM',
      '2:00 PM',
      '2:30 PM',
      '3:00 PM',
      '3:30 PM',
    ];
    const existingMap = {};
    existingSlots.forEach((s) => {
      existingMap[s.day_of_week + '|' + s.time_slot] = s.slot_type;
    });
    const modal = document.createElement('div');
    modal.className = 'edu-fullscreen-modal';
    modal.innerHTML = `
  <div class="efm-inner">
    <div class="efm-header">
      <button type="button" onclick="this.closest('.edu-fullscreen-modal').remove()" class="efm-back">← Back</button>
      <div class="efm-title-group">
        <h2>Meeting Availability</h2>
        <div class="efm-sub">Students can request meetings during your open slots</div>
      </div>
      <button type="button" onclick="saveAdminAvailability()" class="edu-action-btn primary">Save</button>
    </div>
    <div class="availability-editor">
      <div class="avail-legend">
        <div class="avail-legend-item"><div class="avail-slot available"></div> Open</div>
        <div class="avail-legend-item"><div class="avail-slot available-request"></div> By request</div>
        <div class="avail-legend-item"><div class="avail-slot"></div> Blocked</div>
      </div>
      <div class="avail-grid">
        <div class="avail-time-col">
          <div class="avail-day-header"></div>
          ${slotTimes.map((t) => `<div class="avail-time-label">${t}</div>`).join('')}
        </div>
        ${days
          .map(
            (day) => `
        <div class="avail-day-col">
          <div class="avail-day-header">${day.slice(0, 3).toUpperCase()}</div>
          ${slotTimes
            .map((slot) => {
              const key = day + '|' + slot;
              const type = existingMap[key] || 'blocked';
              return `<div class="avail-slot admin-slot ${
                type === 'open' ? 'available' : type === 'by_request' ? 'available-request' : ''
              }" data-day="${day}" data-slot="${slot}" data-type="${type}" onclick="cycleAdminSlot(this)"></div>`;
            })
            .join('')}
        </div>`
          )
          .join('')}
      </div>
    </div>
  </div>`;
    document.body.appendChild(modal);
  }
  window.openAdminAvailabilityEditor = openAdminAvailabilityEditor;

  async function saveAdminAvailability() {
    const client = sb();
    if (!client || !currentUser) return;
    const uid = currentUser.id;
    const rows = [];
    document.querySelectorAll('.avail-slot.admin-slot[data-day]').forEach((el) => {
      rows.push({
        admin_id: uid,
        day_of_week: el.dataset.day,
        time_slot: el.dataset.slot,
        slot_type: el.dataset.type || 'blocked',
      });
    });
    await client.from('admin_meeting_slots').delete().eq('admin_id', uid);
    const toInsert = rows.filter((s) => s.slot_type !== 'blocked');
    if (toInsert.length) await client.from('admin_meeting_slots').insert(toInsert);
    document.querySelector('.edu-fullscreen-modal')?.remove();
    if (typeof showToast === 'function') showToast('Availability saved.', 'success');
  }
  window.saveAdminAvailability = saveAdminAvailability;

  async function respondToMeetingRequest(requestId, status) {
    const client = sb();
    if (!client || !currentUser) return;
    const { data: req } = await client
      .from('admin_meeting_requests')
      .update({ status, resolved_at: new Date().toISOString() })
      .eq('id', requestId)
      .select('*, user_roles!student_id(display_name)')
      .maybeSingle();
    if (req && typeof fluxEnsureThreadAndSend === 'function') {
      const msg =
        status === 'approved'
          ? `Your meeting request for ${req.date} at ${req.time_slot} has been approved.`
          : `Your meeting request for ${req.date} could not be accommodated.`;
      await fluxEnsureThreadAndSend(req.student_id, msg);
    }
    if (typeof showToast === 'function')
      showToast(status === 'approved' ? 'Meeting approved' : 'Meeting declined', 'info');
    try {
      renderAdminDashboard();
    } catch (_) {}
  }
  window.respondToMeetingRequest = respondToMeetingRequest;

  function openPostAnnouncementModal(posterRole) {
    const isAdmin =
      posterRole === 'admin' ||
      (typeof FluxRole !== 'undefined' && FluxRole.current === 'admin');
    const modal = document.createElement('div');
    modal.id = 'fluxPostAnnounceRoot';
    modal.style.cssText =
    modal.innerHTML = `
    <div style="background:rgba(10,12,20,.92);border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:26px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto">
      <h3 style="font-size:1rem;font-weight:800;margin-bottom:16px">📢 Post ${isAdmin ? 'School-Wide ' : ''}Announcement</h3>
      <div class="mrow"><label>Title *</label><input id="annTitle" placeholder="Title"></div>
      <div class="mrow"><label>Message *</label><textarea id="annBody" placeholder="Message…" style="min-height:100px;resize:none"></textarea></div>
      <div class="mrow"><label>Priority</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${['normal', 'important', 'urgent', isAdmin ? 'emergency' : '']
            .filter(Boolean)
            .map(
              (p) => `
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:.82rem">
            <input type="radio" name="annPriority" value="${p}" ${p === 'normal' ? 'checked' : ''}>
            <span>${p}</span>
          </label>`
            )
            .join('')}
        </div>
      </div>
      ${
        isAdmin
          ? `
      <div class="mrow"><label>Audience</label>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${['student', 'teacher', 'counselor', 'staff']
            .map(
              (r) => `
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:.82rem">
            <input type="checkbox" name="annTarget" value="${r}" checked> ${r}s
          </label>`
            )
            .join('')}
        </div>
      </div>
      <div class="mrow"><label><input type="checkbox" id="annPinned"> Pin</label></div>
      <div class="mrow"><label>Expires</label><input type="date" id="annExpiry"></div>`
          : ''
      }
      <div id="annError" style="display:none;font-size:.78rem;color:var(--red);margin-top:10px"></div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button type="button" onclick="submitAnnouncement()" style="flex:1;padding:12px;background:var(--accent);border:none;border-radius:12px;color:#fff;font-weight:700;cursor:pointer">Post</button>
        <button type="button" id="annModalCancel" style="padding:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;cursor:pointer">Cancel</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    modal.querySelector('#annModalCancel')?.addEventListener('click', () => modal.remove());
  }
  window.openPostAnnouncementModal = openPostAnnouncementModal;

  async function submitAnnouncement() {
    const client = sb();
    if (!client || !currentUser) return;
    const title = document.getElementById('annTitle')?.value.trim();
    const body = document.getElementById('annBody')?.value.trim();
    const priority =
      document.querySelector('input[name="annPriority"]:checked')?.value || 'normal';
    const targets = [...document.querySelectorAll('input[name="annTarget"]:checked')].map(
      (i) => i.value
    );
    const pinned = document.getElementById('annPinned')?.checked || false;
    const expiry = document.getElementById('annExpiry')?.value;
    const errEl = document.getElementById('annError');
    if (!title || !body) {
      if (errEl) {
        errEl.textContent = 'Title and message required';
        errEl.style.display = 'block';
      }
      return;
    }
    const { error } = await client.from('school_announcements').insert({
      posted_by: currentUser.id,
      title,
      body,
      priority,
      target_roles: targets.length ? targets : ['student', 'teacher', 'counselor', 'staff'],
      pinned,
      expires_at: expiry ? new Date(expiry + 'T23:59:59').toISOString() : null,
    });
    if (error) {
      if (errEl) {
        errEl.textContent = error.message;
        errEl.style.display = 'block';
      }
      return;
    }
    document.getElementById('fluxPostAnnounceRoot')?.remove();
    if (typeof showToast === 'function') showToast('Announcement posted.', 'success');
    try {
      renderAdminDashboard();
    } catch (_) {}
    try {
      if (typeof checkForActiveAnnouncements === 'function') void checkForActiveAnnouncements();
    } catch (_) {}
  }
  window.submitAnnouncement = submitAnnouncement;

  function openEmergencyAlertModal() {
    const modal = document.createElement('div');
    modal.id = 'fluxEmergencyAlertRoot';
    modal.style.cssText =
      'position:fixed;inset:0;background:rgba(139,0,0,.4);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
    <div style="background:rgba(20,5,5,.95);border:2px solid rgba(255,77,109,.6);border-radius:20px;padding:28px;width:100%;max-width:460px">
      <h3 style="color:var(--red);font-weight:800">🚨 Emergency Alert</h3>
      <div class="mrow"><label>Message *</label><textarea id="emergencyMsg" style="min-height:100px"></textarea></div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button type="button" onclick="sendEmergencyAlert()" style="flex:1;padding:13px;background:var(--red);border:none;border-radius:12px;color:#fff;font-weight:800;cursor:pointer">SEND</button>
        <button type="button" id="emergencyModalCancel" style="padding:13px;border-radius:12px;cursor:pointer">Cancel</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#emergencyModalCancel')?.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }
  window.openEmergencyAlertModal = openEmergencyAlertModal;

  async function sendEmergencyAlert() {
    const msg = document.getElementById('emergencyMsg')?.value.trim();
    if (!msg) {
      if (typeof showToast === 'function') showToast('Enter a message', 'error');
      return;
    }
    const client = sb();
    if (!client || !currentUser) return;
    await client.from('school_announcements').insert({
      posted_by: currentUser.id,
      title: '🚨 EMERGENCY ALERT',
      body: msg,
      priority: 'emergency',
      target_roles: ['student', 'teacher', 'counselor', 'staff', 'admin'],
      pinned: true,
    });
    document.getElementById('fluxEmergencyAlertRoot')?.remove();
    if (typeof showToast === 'function') showToast('Emergency alert sent.', 'success');
    showEmergencyBanner(msg);
  }
  window.sendEmergencyAlert = sendEmergencyAlert;

  function showEmergencyBanner(msg) {
    document.getElementById('emergencyBanner')?.remove();
    const banner = document.createElement('div');
    banner.id = 'emergencyBanner';
    banner.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:9999;background:linear-gradient(135deg,#8b0000,#cc0000);color:#fff;padding:14px 20px;display:flex;align-items:center;gap:12px';
    banner.innerHTML = `<span style="font-size:1.4rem">🚨</span><div style="flex:1"><strong>EMERGENCY</strong><div style="font-size:.82rem">${esc(
      msg
    )}</div></div><button type="button" onclick="document.getElementById('emergencyBanner').remove()" style="cursor:pointer;padding:6px 12px;border-radius:8px">Dismiss</button>`;
    document.body.prepend(banner);
  }
  window.showEmergencyBanner = showEmergencyBanner;

  async function openSchoolCalendar() {
    const client = sb();
    if (!client) return;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().slice(0, 10);
    let events = [];
    try {
      const { data } = await client
        .from('school_calendar_events')
        .select('*')
        .gte('event_date', monthStart)
        .lte('event_date', monthEnd)
        .order('event_date', { ascending: true });
      events = data || [];
    } catch (_) {}
    const canEdit = ['admin', 'teacher', 'staff'].includes(FluxRole.current || '');
    const modal = document.createElement('div');
    modal.className = 'edu-fullscreen-modal';
    modal.innerHTML = `
  <div class="efm-inner">
    <div class="efm-header">
      <button type="button" onclick="this.closest('.edu-fullscreen-modal').remove()" class="efm-back">← Back</button>
      <div class="efm-title-group"><h2>📅 School Calendar</h2></div>
      ${canEdit ? `<button type="button" onclick="openAddSchoolEventModal()" class="edu-action-btn primary">+ Add Event</button>` : ''}
    </div>
    <div class="school-calendar-list">
      ${
        !events.length
          ? renderEmptyState('📅', 'No events', '', '', '')
          : groupEventsByMonth(events)
              .map(
                ([month, evs]) => `
        <div class="scl-month-group">
          <div class="scl-month-header">${esc(month)}</div>
          ${evs
            .map(
              (e) => `
          <div class="scl-event-row event-type-${esc(e.event_type)}">
            <div class="scl-event-date">${new Date(e.event_date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
            <div class="scl-event-dot" style="background:${getEventColor(e.event_type)}"></div>
            <div class="scl-event-info">
              <div class="scl-event-title">${esc(e.title)}</div>
            </div>
            ${
              canEdit
                ? `<button type="button" onclick="deleteSchoolEvent('${e.id}')" class="edu-action-btn small danger">Delete</button>`
                : ''
            }
          </div>`
            )
            .join('')}
        </div>`
              )
              .join('')
      }
    </div>
  </div>`;
    document.body.appendChild(modal);
  }
  window.openSchoolCalendar = openSchoolCalendar;

  function openAddSchoolEventModal() {
    const m2 = document.createElement('div');
    m2.id = 'fluxSchoolEvtFormRoot';
    m2.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:700;display:flex;align-items:center;justify-content:center;padding:20px';
    m2.innerHTML = `
    <div style="background:var(--card);border-radius:20px;padding:26px;width:100%;max-width:440px">
      <h3 style="font-weight:800;margin-bottom:12px">Add event</h3>
      <div class="mrow"><label>Title *</label><input id="evtTitle"></div>
      <div class="mrow"><label>Date *</label><input type="date" id="evtDate"></div>
      <div class="mrow"><label>Type</label>
        <select id="evtType">
          <option value="general">General</option>
          <option value="holiday">Holiday</option>
          <option value="no_school">No school</option>
          <option value="exam">Exam</option>
        </select>
      </div>
      <div class="mrow"><label>Description</label><textarea id="evtDesc" style="min-height:60px"></textarea></div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button type="button" onclick="submitSchoolEvent()" style="flex:1;padding:12px;background:var(--accent);border:none;border-radius:12px;font-weight:700;cursor:pointer">Add</button>
        <button type="button" id="fluxSchoolEvtCancel" style="padding:12px;border-radius:12px;cursor:pointer">Cancel</button>
      </div>
    </div>`;
    document.body.appendChild(m2);
    m2.querySelector('#fluxSchoolEvtCancel')?.addEventListener('click', () => m2.remove());
    m2.addEventListener('click', (e) => {
      if (e.target === m2) m2.remove();
    });
  }
  window.openAddSchoolEventModal = openAddSchoolEventModal;

  async function submitSchoolEvent() {
    const client = sb();
    if (!client || !currentUser) return;
    const title = document.getElementById('evtTitle')?.value.trim();
    const date = document.getElementById('evtDate')?.value;
    const type = document.getElementById('evtType')?.value;
    const desc = document.getElementById('evtDesc')?.value.trim();
    if (!title || !date) {
      if (typeof showToast === 'function') showToast('Title and date required', 'error');
      return;
    }
    await client.from('school_calendar_events').insert({
      created_by: currentUser.id,
      title,
      description: desc || null,
      event_date: date,
      event_type: type,
    });
    document.getElementById('fluxSchoolEvtFormRoot')?.remove();
    document.querySelectorAll('.edu-fullscreen-modal').forEach((el) => {
      if (el.innerHTML && el.innerHTML.includes('School Calendar')) el.remove();
    });
    if (typeof showToast === 'function') showToast('Event added.', 'success');
    openSchoolCalendar();
  }
  window.submitSchoolEvent = submitSchoolEvent;

  async function deleteSchoolEvent(id) {
    const client = sb();
    if (!client) return;
    await client.from('school_calendar_events').delete().eq('id', id);
    if (typeof showToast === 'function') showToast('Deleted.', 'info');
    document.querySelector('.edu-fullscreen-modal')?.remove();
    openSchoolCalendar();
  }
  window.deleteSchoolEvent = deleteSchoolEvent;

  async function openMeetingRequestsManager() {
    await openAdminUserManager();
  }
  window.openMeetingRequestsManager = openMeetingRequestsManager;

  // ── Counselor availability editor ─────────────────────────────────
  function toggleAvailSlot(el) {
    el.classList.toggle('available');
  }
  window.toggleAvailSlot = toggleAvailSlot;

  function selectDefaultSlots() {
    const set = new Set([
      '9:00 AM',
      '9:30 AM',
      '10:00 AM',
      '10:30 AM',
      '11:00 AM',
      '11:30 AM',
      '12:00 PM',
      '12:30 PM',
      '1:00 PM',
      '1:30 PM',
      '2:00 PM',
      '2:30 PM',
      '3:00 PM',
    ]);
    document.querySelectorAll('.avail-slot[data-slot]').forEach((el) => {
      el.classList.toggle('available', set.has(el.dataset.slot));
    });
  }
  window.selectDefaultSlots = selectDefaultSlots;

  function clearAllSlots() {
    document.querySelectorAll('.avail-slot[data-slot]').forEach((el) => el.classList.remove('available'));
  }
  window.clearAllSlots = clearAllSlots;

  function selectAllDaySlots() {
    document.querySelectorAll('.avail-slot[data-slot]').forEach((el) => el.classList.add('available'));
  }
  window.selectAllDaySlots = selectAllDaySlots;

  async function openCounselorAvailabilityEditor(counselorId) {
    const client = sb();
    if (!client) return;
    let existingSlots = [];
    try {
      const { data } = await client
        .from('counselor_availability_slots')
        .select('*')
        .eq('counselor_id', counselorId);
      existingSlots = data || [];
    } catch (_) {}
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const allTimeSlots = [
      '8:00 AM',
      '8:30 AM',
      '9:00 AM',
      '9:30 AM',
      '10:00 AM',
      '10:30 AM',
      '11:00 AM',
      '11:30 AM',
      '12:00 PM',
      '12:30 PM',
      '1:00 PM',
      '1:30 PM',
      '2:00 PM',
      '2:30 PM',
      '3:00 PM',
      '3:30 PM',
      '4:00 PM',
    ];
    const existingMap = {};
    existingSlots.forEach((s) => {
      if (!existingMap[s.day_of_week]) existingMap[s.day_of_week] = new Set();
      if (s.is_available) existingMap[s.day_of_week].add(s.time_slot);
    });
    const modal = document.createElement('div');
    modal.className = 'edu-fullscreen-modal';
    modal.innerHTML = `
  <div class="efm-inner">
    <div class="efm-header">
      <button type="button" onclick="this.closest('.edu-fullscreen-modal').remove()" class="efm-back">← Back</button>
      <div class="efm-title-group"><h2>Edit availability</h2></div>
      <button type="button" onclick="saveCounselorAvailability('${counselorId}')" class="edu-action-btn primary">Save</button>
    </div>
    <div class="availability-editor">
      <div class="avail-grid" id="availabilityGrid">
        <div class="avail-time-col">
          <div class="avail-day-header"></div>
          ${allTimeSlots.map((t) => `<div class="avail-time-label">${t}</div>`).join('')}
        </div>
        ${days
          .map(
            (day) => `
        <div class="avail-day-col" data-day="${day}">
          <div class="avail-day-header">${day.slice(0, 3).toUpperCase()}</div>
          ${allTimeSlots
            .map((slot) => {
              const isAvail = existingMap[day]?.has(slot);
              return `<div class="avail-slot ${isAvail ? 'available' : ''}" data-day="${day}" data-slot="${slot}" onclick="toggleAvailSlot(this)"></div>`;
            })
            .join('')}
        </div>`
          )
          .join('')}
      </div>
      <div class="avail-bulk-actions">
        <button type="button" onclick="selectAllDaySlots()" class="edu-action-btn small">Select all</button>
        <button type="button" onclick="clearAllSlots()" class="edu-action-btn small danger">Clear</button>
        <button type="button" onclick="selectDefaultSlots()" class="edu-action-btn small secondary">9–3</button>
      </div>
    </div>
  </div>`;
    document.body.appendChild(modal);
  }
  window.openCounselorAvailabilityEditor = openCounselorAvailabilityEditor;

  async function saveCounselorAvailability(counselorId) {
    const client = sb();
    if (!client) return;
    const slots = [];
    document.querySelectorAll('.avail-slot[data-slot]').forEach((el) => {
      slots.push({
        counselor_id: counselorId,
        day_of_week: el.dataset.day,
        time_slot: el.dataset.slot,
        is_available: el.classList.contains('available'),
        updated_at: new Date().toISOString(),
      });
    });
    const { error } = await client
      .from('counselor_availability_slots')
      .upsert(slots, { onConflict: 'counselor_id,day_of_week,time_slot' });
    if (error) {
      if (typeof showToast === 'function') showToast(error.message, 'error');
      return;
    }
    const availMap = {};
    slots
      .filter((s) => s.is_available)
      .forEach((s) => {
        if (!availMap[s.day_of_week]) availMap[s.day_of_week] = [];
        availMap[s.day_of_week].push(s.time_slot);
      });
    await client.from('counselors').update({ availability: availMap }).eq('id', counselorId);
    document.querySelector('.edu-fullscreen-modal')?.remove();
    if (typeof showToast === 'function') showToast('Availability saved.', 'success');
  }
  window.saveCounselorAvailability = saveCounselorAvailability;

  // ── Student book appointment (slots table + JSON fallback) ────────
  async function openBookAppointmentModal(counselorId) {
    if (document.getElementById('bookApptModal')) return;
    const client = sb();
    if (!client || !currentUser) return;
    _apptCounselorId = counselorId;
    _apptDaySlots = {};
    let counselor = null;
    let slotRows = [];
    try {
      const { data: c } = await client.from('counselors').select('*').eq('id', counselorId).maybeSingle();
      counselor = c;
      const { data: sl } = await client
        .from('counselor_availability_slots')
        .select('*')
        .eq('counselor_id', counselorId)
        .eq('is_available', true)
        .order('day_of_week')
        .order('time_slot');
      slotRows = sl || [];
    } catch (_) {}
    if (!counselor) return;
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = new Date().toISOString().slice(0, 10);
    const twoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    let booked = [];
    try {
      const { data: b } = await client
        .from('counselor_appointments')
        .select('date,time_slot')
        .eq('counselor_id', counselorId)
        .gte('date', today)
        .lte('date', twoWeeks)
        .neq('status', 'cancelled');
      booked = b || [];
    } catch (_) {}
    const bookedSet = new Set(booked.map((x) => x.date + '|' + x.time_slot));

    function slotsForCalendarDay(dateStr) {
      const d = new Date(dateStr + 'T12:00:00');
      const key = dayNames[d.getDay()];
      let list = slotRows.filter((s) => s.day_of_week === key);
      if (!list.length && counselor.availability && counselor.availability[key]) {
        const arr = counselor.availability[key];
        list = (Array.isArray(arr) ? arr : []).map((time_slot) => ({ time_slot, day_of_week: key }));
      }
      return list.filter((s) => !bookedSet.has(dateStr + '|' + s.time_slot));
    }

    const availableDays = [];
    for (let i = 1; i <= 21; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const dateStr = d.toISOString().slice(0, 10);
      const daySlots = slotsForCalendarDay(dateStr);
      if (daySlots.length) {
        availableDays.push({
          date: dateStr,
          label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          slots: daySlots,
        });
        _apptDaySlots[dateStr] = daySlots;
      }
      if (availableDays.length >= 10) break;
    }

    const modal = buildEduModal(
      'bookApptModal',
      `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
      <div style="width:40px;height:40px;border-radius:50%;background:${esc(
        counselor.avatar_color || '#7c5cff'
      )};display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff">${esc(
        counselor.avatar_initial || (counselor.name || '?')[0]
      )}</div>
      <div><div style="font-size:1rem;font-weight:800">Book with ${esc(counselor.name)}</div>
      <div style="font-size:.75rem;color:var(--muted2)">Request a time</div></div>
      <button type="button" class="edu-modal-close" style="margin-left:auto">✕</button>
    </div>
    <div class="mrow"><label>Reason</label>
      <select id="appt_reason">
        <option>Academic check-in</option><option>Course planning</option><option>College planning</option>
        <option>Personal concern</option><option>Schedule change</option><option>Other</option>
      </select>
    </div>
    <div class="mrow"><label>Message (optional)</label><textarea id="appt_notes" style="min-height:60px"></textarea></div>
    <div style="font-size:.75rem;font-weight:700;color:var(--muted2);margin-bottom:8px">Pick a date</div>
    <div id="dateChips" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
      ${
        availableDays.length
          ? availableDays
              .map(
                (d) =>
                  `<button type="button" class="date-chip" data-date="${esc(d.date)}">${esc(d.label)} (${d.slots.length})</button>`
              )
              .join('')
          : '<div style="color:var(--muted2);font-size:.82rem">No open slots in the next few weeks.</div>'
      }
    </div>
    <div id="timeSlotContainer" style="display:none">
      <div style="font-size:.75rem;font-weight:700;margin-bottom:8px">Time</div>
      <div id="timeSlots" style="display:flex;gap:6px;flex-wrap:wrap"></div>
    </div>
    <div id="apptError" class="edu-modal-error" style="display:none"></div>
    <button type="button" id="confirmApptBtn" style="display:none;width:100%;margin-top:14px;padding:13px;background:var(--accent);border:none;border-radius:12px;font-weight:700;cursor:pointer">Request appointment</button>
  `
    );
    let _pickedDate = null;
    let _pickedTime = null;
    modal.querySelectorAll('#dateChips .date-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        _pickedDate = btn.dataset.date;
        _pickedTime = null;
        modal.querySelectorAll('#dateChips .date-chip').forEach((b) => {
          b.style.background = '';
          b.style.borderColor = '';
        });
        btn.style.background = 'rgba(var(--accent-rgb),.15)';
        btn.style.borderColor = 'var(--accent)';
        const slots = _apptDaySlots[_pickedDate] || [];
        const wrap = modal.querySelector('#timeSlotContainer');
        const inner = modal.querySelector('#timeSlots');
        const cbtn = modal.querySelector('#confirmApptBtn');
        if (!wrap || !inner) return;
        inner.innerHTML = slots
          .map(
            (s) =>
              `<button type="button" class="time-chip" data-slot="${esc(s.time_slot)}">${esc(s.time_slot)}</button>`
          )
          .join('');
        inner.querySelectorAll('.time-chip').forEach((t) => {
          t.addEventListener('click', () => {
            _pickedTime = t.dataset.slot;
            inner.querySelectorAll('.time-chip').forEach((x) => {
              x.style.background = '';
              x.style.borderColor = '';
            });
            t.style.background = 'rgba(var(--accent-rgb),.15)';
            t.style.borderColor = 'var(--accent)';
            if (cbtn) cbtn.style.display = 'block';
          });
        });
        wrap.style.display = 'block';
        if (cbtn) cbtn.style.display = 'none';
      });
    });
    modal.querySelector('#confirmApptBtn')?.addEventListener('click', async () => {
      if (!_pickedDate || !_pickedTime) return;
      const reason = modal.querySelector('#appt_reason')?.value || 'Meeting';
      const notes = modal.querySelector('#appt_notes')?.value.trim();
      const errEl = modal.querySelector('#apptError');
      const { error } = await client.from('counselor_appointments').insert({
        counselor_id: counselorId,
        student_id: currentUser.id,
        date: _pickedDate,
        time_slot: _pickedTime,
        reason,
        student_requested_message: notes || null,
        status: 'pending',
        duration_minutes: 30,
      });
      if (error) {
        if (errEl) {
          errEl.textContent = error.message.includes('unique')
            ? 'That slot was just taken — pick another.'
            : error.message;
          errEl.style.display = 'block';
        }
        return;
      }
      document.getElementById('bookApptModal')?.remove();
      if (typeof showToast === 'function') showToast('Appointment request sent.', 'success');
      try {
        renderMyCounselorSection();
      } catch (_) {}
    });
  }
  window.openBookAppointmentModal = openBookAppointmentModal;

  async function respondToAppointmentRequest(appointmentId, status, counselorId) {
    const client = sb();
    if (!client || !currentUser) return;
    const { data: appt } = await client
      .from('counselor_appointments')
      .update({ status })
      .eq('id', appointmentId)
      .select('*, user_roles!student_id(display_name)')
      .maybeSingle();
    if (appt && typeof fluxEnsureThreadAndSend === 'function') {
      const msg =
        status === 'confirmed'
          ? `Your appointment for ${appt.date} at ${appt.time_slot} is confirmed.`
          : `Your appointment request for ${appt.date} at ${appt.time_slot} could not be accommodated.`;
      await fluxEnsureThreadAndSend(appt.student_id, msg);
    }
    if (typeof showToast === 'function') showToast('Updated.', 'success');
    try {
      renderCounselorDashboard();
    } catch (_) {}
  }
  window.respondToAppointmentRequest = respondToAppointmentRequest;

  async function updateAppointmentStatus(appointmentId, status) {
    const client = sb();
    if (!client) return;
    await client.from('counselor_appointments').update({ status }).eq('id', appointmentId);
    if (typeof showToast === 'function') showToast('Status updated.', 'info');
  }
  window.updateAppointmentStatus = updateAppointmentStatus;
})();
