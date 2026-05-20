/**
 * FluxModuleLoader — registry, feature flags, and widget grid for Staff Productivity Suite.
 * Master flag: enable_staff_productivity_suite
 * See docs/P8-STAFF-PRODUCTIVITY.md
 */
(function () {
  'use strict';

  const SUITE_FLAG = 'enable_staff_productivity_suite';
  const LAYOUT_KEY = 'flux_staff_widget_layout_v1';

  const CATALOG = [
    { id: 'classroom_quick_grade', flag: 'enable_classroom_tools', roles: ['teacher'], scope: 'work', title: 'Quick-Grade buckets', status: 'beta', module: 'FluxClassroomTools', method: 'renderQuickGrade' },
    { id: 'classroom_accommodations', flag: 'enable_classroom_tools', roles: ['teacher', 'counselor'], scope: 'work', title: 'Accommodation cheat-sheet', status: 'beta', module: 'FluxClassroomTools', method: 'renderAccommodations' },
    { id: 'classroom_student_picker', flag: 'enable_classroom_tools', roles: ['teacher'], scope: 'work', title: 'Random student picker', status: 'beta', module: 'FluxClassroomTools', method: 'renderStudentPicker' },
    { id: 'classroom_parent_log', flag: 'enable_classroom_tools', roles: ['teacher', 'counselor'], scope: 'work', title: 'Parent contact log', status: 'beta', module: 'FluxClassroomTools', method: 'renderParentLog' },
    { id: 'classroom_hall_pass', flag: 'enable_classroom_tools', roles: ['teacher'], scope: 'work', title: 'Hall pass registry', status: 'beta', module: 'FluxClassroomTools', method: 'renderHallPass' },
    { id: 'classroom_exit_ticket', flag: 'enable_classroom_tools', roles: ['teacher'], scope: 'work', title: 'Exit ticket generator', status: 'beta', module: 'FluxClassroomTools', method: 'renderExitTicket' },
    { id: 'classroom_timer', flag: 'enable_classroom_tools', roles: ['teacher'], scope: 'work', title: 'Classroom timer', status: 'beta', module: 'FluxClassroomTools', method: 'renderClassroomTimer' },
    { id: 'classroom_oops_broadcast', flag: 'enable_classroom_tools', roles: ['teacher'], scope: 'work', title: 'Oops broadcast', status: 'beta', module: 'FluxClassroomTools', method: 'renderOopsBroadcast' },
    { id: 'admin_duty_alerts', flag: 'enable_school_ops', roles: ['admin', 'staff'], scope: 'work', title: 'Duty roster alerts', status: 'beta', module: 'FluxAdminWidgets', method: 'renderDutyAlerts' },
    { id: 'admin_sub_swap', flag: 'enable_school_ops', roles: ['admin', 'staff'], scope: 'work', title: 'Sub-coverage swap', status: 'beta', module: 'FluxAdminWidgets', method: 'renderSubSwap' },
    { id: 'admin_ops_health', flag: 'enable_ops_health_panel', roles: ['admin', 'owner'], scope: 'work', title: 'System health', status: 'beta', module: 'FluxOpsHealth', method: 'renderHealthPanel' },
    { id: 'counselor_caseload', flag: 'enable_caseload_engine', roles: ['counselor'], scope: 'work', title: 'Caseload dashboard', status: 'beta', module: 'FluxCaseloadEngine', method: 'renderCaseloadWidget' },
    { id: 'counselor_meeting_log', flag: 'enable_caseload_engine', roles: ['counselor'], scope: 'work', title: 'Private meeting log', status: 'beta', module: 'FluxCaseloadEngine', method: 'renderMeetingLog' },
    { id: 'counselor_wellness_queue', flag: 'enable_caseload_engine', roles: ['counselor'], scope: 'work', title: 'Wellness check-in queue', status: 'beta', module: 'FluxCaseloadEngine', method: 'renderWellnessQueue' },
    { id: 'counselor_crisis_sheet', flag: 'enable_caseload_engine', roles: ['counselor'], scope: 'work', title: 'Crisis protocol cheat-sheet', status: 'beta', module: 'FluxCaseloadEngine', method: 'renderCrisisCheatSheet' },
    { id: 'counselor_referrals', flag: 'enable_caseload_engine', roles: ['counselor'], scope: 'work', title: 'Referral tracker', status: 'beta', module: 'FluxCaseloadEngine', method: 'renderReferralTracker' },
    { id: 'counselor_appointments', flag: 'enable_counselor_caseload', roles: ['counselor'], scope: 'work', title: 'Appointment scheduler', status: 'live', module: 'FluxCounselorAppointments' },
    { id: 'personal_brain_dump', flag: 'enable_personal_hub', roles: ['teacher', 'counselor', 'staff', 'admin'], scope: 'personal', title: 'Brain dump', status: 'beta', module: 'FluxPersonalHub', method: 'renderBrainDump' },
    { id: 'personal_commute', flag: 'enable_personal_hub', roles: ['teacher', 'counselor', 'staff', 'admin'], scope: 'personal', title: 'Commute tracker', status: 'planned', module: 'FluxPersonalHub' },
    { id: 'personal_grocery', flag: 'enable_personal_hub', roles: ['teacher', 'counselor', 'staff', 'admin'], scope: 'personal', title: 'Grocery list', status: 'beta', module: 'FluxPersonalHub', method: 'renderGrocery' },
    { id: 'personal_mood_energy', flag: 'enable_personal_hub', roles: ['teacher', 'counselor', 'staff', 'admin'], scope: 'personal', title: 'Mood / energy log', status: 'beta', module: 'FluxPersonalHub', method: 'renderMoodEnergy' },
    { id: 'personal_deep_work', flag: 'enable_personal_hub', roles: ['teacher', 'counselor', 'staff', 'admin'], scope: 'personal', title: 'Deep work blocker', status: 'planned', module: 'FluxPersonalHub' },
    { id: 'sys_command_v2', flag: 'enable_staff_command_v2', roles: ['teacher', 'counselor', 'staff', 'admin'], scope: 'any', title: 'Staff command palette', status: 'beta', module: 'FluxStaffCommand', method: 'registerCommands' },
    { id: 'sys_gmail_quick', flag: 'enable_gmail_educator_import', roles: ['teacher', 'counselor', 'staff', 'admin'], scope: 'any', title: 'Gmail → task quick import', status: 'beta', module: 'FluxStaffCommand', method: 'renderGmailQuickWidget' },
    { id: 'sys_export_csv', flag: 'enable_staff_productivity_suite', roles: ['teacher', 'counselor', 'staff', 'admin'], scope: 'any', title: 'Export to CSV', status: 'beta', module: 'FluxModuleLoader', method: 'exportEnabledData' },
  ];

  const PANEL_HOSTS = {
    staffWorkboard: 'staffWorkboardBody',
    teacherDashboard: 'teacherDashboardBody',
    counselorDashboard: 'counselorDashboardBody',
    adminOps: 'adminOpsBody',
    dashboard: 'dashboard',
  };

  let _installed = false;

  function suiteEnabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled(SUITE_FLAG, false);
    } catch (_) {
      return false;
    }
  }

  function moduleEnabled(item) {
    if (!suiteEnabled()) return false;
    try {
      return !!window.FluxFeatureFlags?.isEnabled(item.flag, false);
    } catch (_) {
      return false;
    }
  }

  function currentRole() {
    try {
      return window.FluxRole?.current || (typeof getMyRole === 'function' ? getMyRole() : 'student');
    } catch (_) {
      return 'student';
    }
  }

  function isWorkContext() {
    try {
      return window.FluxRole?.isWorkMode?.() !== false && window.FluxRole?.isEducator?.();
    } catch (_) {
      return false;
    }
  }

  function isPersonalContext() {
    try {
      return window.FluxRole?.isPersonalMode?.() || !window.FluxRole?.isEducator?.();
    } catch (_) {
      return true;
    }
  }

  function visibleModules(panelId) {
    const role = currentRole();
    const work = isWorkContext();
    const personal = isPersonalContext();
    return CATALOG.filter((m) => {
      if (!moduleEnabled(m)) return false;
      if (
        !m.roles.includes(role) &&
        !(role === 'admin' && m.roles.includes('staff')) &&
        !(role === 'owner' && m.roles.includes('owner'))
      )
        return false;
      if (m.scope === 'work' && !work) return false;
      if (m.scope === 'personal' && !personal) return false;
      if (m.scope === 'work' && panelId === 'dashboard') return false;
      if (m.scope === 'personal' && panelId !== 'dashboard') return false;
      return true;
    });
  }

  function loadLayout() {
    try {
      const uid =
        (typeof currentUser !== 'undefined' && currentUser?.id) ||
        (window.currentUser && window.currentUser.id) ||
        'anon';
      const raw = localStorage.getItem(`${LAYOUT_KEY}_${uid}`);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function saveLayout(layout) {
    try {
      const uid =
        (typeof currentUser !== 'undefined' && currentUser?.id) ||
        (window.currentUser && window.currentUser.id) ||
        'anon';
      localStorage.setItem(`${LAYOUT_KEY}_${uid}`, JSON.stringify(layout));
    } catch (_) {}
  }

  function defaultLayout(panelId, mods) {
    return {
      panelId,
      widgets: mods.map((m, i) => ({ id: m.id, visible: m.status !== 'planned', order: i, size: 'md' })),
    };
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function resolveMod(item) {
    const mod = window[item.module];
    if (!mod) return null;
    if (item.method && typeof mod[item.method] === 'function') return mod[item.method].bind(mod);
    return null;
  }

  function renderWidgetGrid(panelId) {
    if (!suiteEnabled()) return;
    const hostId = PANEL_HOSTS[panelId];
    if (!hostId) return;
    const host = document.getElementById(hostId);
    if (!host) return;

    const mods = visibleModules(panelId);
    if (!mods.length) return;

    let layout = loadLayout();
    if (!layout || layout.panelId !== panelId) layout = defaultLayout(panelId, mods);

    let grid = host.querySelector('.flux-widget-grid');
    if (!grid) {
      grid = document.createElement('div');
      grid.className = 'flux-widget-grid';
      grid.id = `fluxWidgetGrid_${panelId}`;
      host.prepend(grid);
    }

    const widgets = layout.widgets
      .filter((w) => w.visible)
      .sort((a, b) => a.order - b.order)
      .map((w) => mods.find((m) => m.id === w.id))
      .filter(Boolean);

    grid.innerHTML = `
      <div class="flux-widget-grid__toolbar">
        <span class="flux-widget-grid__title">Workspace modules</span>
        <button type="button" class="btn-sec flux-widget-grid__configure" data-panel="${esc(panelId)}">Customize</button>
      </div>
      <div class="flux-widget-grid__cells" data-panel="${esc(panelId)}"></div>`;

    const cells = grid.querySelector('.flux-widget-grid__cells');
    widgets.forEach((item) => {
      const cell = document.createElement('div');
      cell.className = 'flux-widget-cell';
      cell.dataset.widgetId = item.id;
      cell.innerHTML = `<div class="flux-widget-cell__head">
        <span class="flux-widget-cell__title">${esc(item.title)}</span>
        <span class="flux-widget-cell__badge flux-widget-cell__badge--${esc(item.status)}">${esc(item.status)}</span>
      </div>
      <div class="flux-widget-cell__body" id="fluxWidget_${esc(item.id)}"></div>`;
      cells.appendChild(cell);
      const fn = resolveMod(item);
      const mount = cell.querySelector('.flux-widget-cell__body');
      if (fn && mount) {
        try {
          fn(mount, { panelId, item });
        } catch (e) {
          mount.innerHTML = `<p class="flux-widget-error">Module failed to load.</p>`;
          console.warn('[FluxModuleLoader]', item.id, e);
        }
      } else if (item.status === 'planned') {
        mount.innerHTML = `<p class="flux-widget-planned">Coming soon — enable flags in Owner Suite when ready.</p>`;
      }
    });

    grid.querySelector('.flux-widget-grid__configure')?.addEventListener('click', () => openConfigureModal(panelId, mods, layout));
  }

  function openConfigureModal(panelId, mods, layout) {
    const existing = document.getElementById('fluxWidgetConfigureModal');
    if (existing) existing.remove();
    const ov = document.createElement('div');
    ov.id = 'fluxWidgetConfigureModal';
    ov.className = 'modal-overlay';
    ov.style.display = 'flex';
    const rows = layout.widgets
      .map((w) => {
        const m = mods.find((x) => x.id === w.id);
        if (!m) return '';
        return `<label class="flux-widget-config-row">
          <input type="checkbox" data-wid="${esc(w.id)}" ${w.visible ? 'checked' : ''}/>
          <span>${esc(m.title)} <em>(${esc(m.status)})</em></span>
        </label>`;
      })
      .join('');
    ov.innerHTML = `<div class="modal flux-widget-config-modal">
      <h3>Customize workspace</h3>
      <p style="font-size:.78rem;color:var(--muted2)">Toggle modules for <strong>${esc(panelId)}</strong>. Layout is stored on this device only.</p>
      <div class="flux-widget-config-list">${rows}</div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button type="button" class="btn" id="fluxWidgetConfigSave">Save</button>
        <button type="button" class="btn-sec" onclick="document.getElementById('fluxWidgetConfigureModal').remove()">Cancel</button>
      </div>
    </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', (e) => {
      if (e.target === ov) ov.remove();
    });
    document.getElementById('fluxWidgetConfigSave')?.addEventListener('click', () => {
      layout.widgets.forEach((w) => {
        const cb = ov.querySelector(`input[data-wid="${w.id}"]`);
        if (cb) w.visible = cb.checked;
      });
      saveLayout(layout);
      ov.remove();
      renderWidgetGrid(panelId);
      if (typeof showToast === 'function') showToast('Workspace layout saved', 'success');
    });
  }

  function onNav(ev) {
    const panel = ev.detail?.panel;
    if (!panel || !PANEL_HOSTS[panel]) return;
    requestAnimationFrame(() => renderWidgetGrid(panel));
  }

  function exportEnabledData() {
    const rows = [['module', 'status', 'flag', 'scope']];
    CATALOG.forEach((m) => rows.push([m.id, m.status, m.flag, m.scope]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `flux-staff-modules-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function install() {
    if (_installed) return;
    _installed = true;
    document.addEventListener('flux-nav', onNav);
    try {
      if (window.FluxStaffCommand?.registerCommands) FluxStaffCommand.registerCommands();
    } catch (_) {}
  }

  window.FluxModuleLoader = {
    install,
    catalog: () => CATALOG.slice(),
    suiteEnabled,
    moduleEnabled,
    visibleModules,
    renderWidgetGrid,
    exportEnabledData,
    SUITE_FLAG,
  };
})();
