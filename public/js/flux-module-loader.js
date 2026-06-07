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
    { id: 'sys_command_v2', flag: 'enable_staff_command_v2', roles: ['teacher', 'counselor', 'staff', 'admin'], scope: 'any', title: 'Staff command palette', status: 'beta', module: 'FluxStaffCommand', method: 'registerCommands', kind: 'command' },
    { id: 'sys_gmail_quick', flag: 'enable_gmail_educator_import', roles: ['teacher', 'counselor', 'staff', 'admin'], scope: 'any', title: 'Gmail → task quick import', status: 'beta', module: 'FluxStaffCommand', method: 'renderGmailQuickWidget' },
    { id: 'sys_export_csv', flag: 'enable_staff_productivity_suite', roles: ['teacher', 'counselor', 'staff', 'admin'], scope: 'any', title: 'Export to CSV', status: 'beta', module: 'FluxModuleLoader', method: 'exportEnabledData', kind: 'command' },
  ];

  const PANEL_HOSTS = {
    staffWorkboard: 'staffWorkboardBody',
    teacherDashboard: 'teacherDashboardBody',
    counselorDashboard: 'counselorDashboardBody',
    counselorWorkspace: 'counselorWorkspaceBody',
    adminOps: 'adminOpsBody',
    dashboard: 'dashboard',
    staffPersonalHub: 'staffPersonalHubBody',
  };

  /** Educator personal-mode widgets (not on main Dashboard). */
  const STAFF_PERSONAL_HUB_TABS = [
    {
      id: 'life',
      label: 'Life',
      widgetIds: ['personal_brain_dump', 'personal_grocery'],
    },
    {
      id: 'wellness',
      label: 'Wellness',
      widgetIds: ['personal_mood_energy'],
    },
    {
      id: 'tools',
      label: 'Tools',
      widgetIds: ['sys_gmail_quick'],
    },
  ];

  /** Counselor workspace sub-tabs (widgets live here, not on Overview). */
  const COUNSELOR_WORKSPACE_TABS = [
    {
      id: 'caseload',
      label: 'Caseload',
      widgetIds: ['counselor_caseload', 'counselor_wellness_queue', 'counselor_referrals'],
    },
    {
      id: 'records',
      label: 'Student records',
      widgetIds: ['classroom_accommodations', 'classroom_parent_log', 'counselor_meeting_log'],
    },
    {
      id: 'crisis',
      label: 'Crisis',
      widgetIds: ['counselor_crisis_sheet'],
    },
  ];

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

  function isEducatorPersonalMode() {
    try {
      return window.FluxRole?.isEducator?.() === true && window.FluxRole?.isPersonalMode?.() === true;
    } catch (_) {
      return false;
    }
  }

  function visibleModules(panelId) {
    if (panelId === 'counselorDashboard') return [];
    if (panelId === 'dashboard' && isEducatorPersonalMode()) return [];
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
      if (m.scope === 'personal' && panelId !== 'staffPersonalHub') return false;
      if (panelId === 'staffPersonalHub' && m.scope !== 'personal' && m.scope !== 'any') return false;
      if (panelId === 'counselorWorkspace' && !m.roles.includes('counselor')) return false;
      if (panelId === 'dashboard' && (m.scope === 'personal' || (m.scope === 'any' && isEducatorPersonalMode())))
        return false;
      return true;
    });
  }

  function loadLayout(panelId) {
    try {
      const uid =
        (typeof currentUser !== 'undefined' && currentUser?.id) ||
        (window.currentUser && window.currentUser.id) ||
        'anon';
      const raw = localStorage.getItem(`${LAYOUT_KEY}_${uid}`);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed) return null;
      if (parsed.panelId === panelId) return parsed;
      if (panelId === 'counselorWorkspace' && parsed.panelId === 'counselorDashboard') {
        return { ...parsed, panelId: 'counselorWorkspace' };
      }
      if (panelId === 'staffPersonalHub' && parsed.panelId === 'dashboard') {
        return { ...parsed, panelId: 'staffPersonalHub' };
      }
      return null;
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

  function renderWidgetGrid(panelId, opts) {
    if (!suiteEnabled()) return;
    const options = opts || {};
    const widgetIdFilter = options.widgetIds || null;
    const showToolbar = options.showToolbar !== false;
    const layoutPanelId = options.layoutPanelId || panelId;

    let host = options.container || null;
    if (!host) {
      const hostId = PANEL_HOSTS[panelId];
      if (!hostId) return;
      host = document.getElementById(hostId);
    }
    if (!host) return;

    if (panelId === 'teacherDashboard' && !options.container) {
      const dashMount = document.getElementById('teacherDashboardBody')?.querySelector('#teacherDashModulesMount');
      if (dashMount) {
        return renderWidgetGrid(panelId, { ...options, container: dashMount });
      }
    }

    const mods = visibleModules(panelId);
    if (!mods.length && !widgetIdFilter) return;

    let layout = loadLayout(layoutPanelId);
    if (!layout || layout.panelId !== layoutPanelId) layout = defaultLayout(layoutPanelId, mods);

    let grid = options.container ? host : host.querySelector('.flux-widget-grid');
    const gridId = widgetIdFilter
      ? `fluxWidgetGrid_${panelId}_${widgetIdFilter.join('_')}`
      : `fluxWidgetGrid_${panelId}`;
    if (!grid || (options.container && grid.className !== 'flux-widget-grid')) {
      grid = document.createElement('div');
      grid.className = 'flux-widget-grid' + (options.container?.classList?.contains('teacher-modules-mount') ? ' flux-widget-grid--in-dash' : '');
      grid.id = gridId;
      if (options.container) {
        host.appendChild(grid);
      } else {
        host.prepend(grid);
      }
    }

    let widgets = layout.widgets
      .filter((w) => w.visible)
      .sort((a, b) => a.order - b.order)
      .map((w) => mods.find((m) => m.id === w.id))
      .filter(Boolean)
      .filter((m) => m.kind !== 'command');

    if (widgetIdFilter) {
      widgets = widgetIdFilter.map((id) => mods.find((m) => m.id === id)).filter(Boolean);
    }

    if (!widgets.length) {
      grid.innerHTML = `<p class="flux-widget-planned">No modules enabled for this section. Turn on flags in Owner Suite or use Customize.</p>`;
      return;
    }

    grid.innerHTML = showToolbar
      ? `<div class="flux-widget-grid__toolbar">
        <span class="flux-widget-grid__title">Workspace modules</span>
        <button type="button" class="btn-sec flux-widget-grid__configure" data-panel="${esc(layoutPanelId)}">Customize</button>
      </div>
      <div class="flux-widget-grid__cells" data-panel="${esc(layoutPanelId)}"></div>`
      : `<div class="flux-widget-grid__cells flux-widget-grid__cells--embedded" data-panel="${esc(layoutPanelId)}"></div>`;

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

    grid.querySelector('.flux-widget-grid__configure')?.addEventListener('click', () =>
      openConfigureModal(layoutPanelId, mods, layout),
    );
  }

  function renderCounselorWorkspaceGrids(activeTabId) {
    if (!suiteEnabled()) return false;
    const tabs = COUNSELOR_WORKSPACE_TABS;
    const tabId = activeTabId || tabs[0]?.id;
    tabs.forEach((tab) => {
      const mount = document.getElementById(`counselorWsTab_${tab.id}`);
      if (!mount) return;
      mount.innerHTML = '';
      if (tab.id !== tabId) return;
      renderWidgetGrid('counselorWorkspace', {
        container: mount,
        widgetIds: tab.widgetIds,
        showToolbar: false,
        layoutPanelId: 'counselorWorkspace',
      });
    });
    const toolbarHost = document.getElementById('counselorWsToolbar');
    if (toolbarHost && !toolbarHost.dataset.wired) {
      toolbarHost.dataset.wired = '1';
      const mods = visibleModules('counselorWorkspace');
      let layout = loadLayout('counselorWorkspace');
      if (!layout || layout.panelId !== 'counselorWorkspace') layout = defaultLayout('counselorWorkspace', mods);
      toolbarHost.innerHTML = `<button type="button" class="btn-sec flux-widget-grid__configure" data-panel="counselorWorkspace">Customize modules</button>`;
      toolbarHost.querySelector('.flux-widget-grid__configure')?.addEventListener('click', () =>
        openConfigureModal('counselorWorkspace', mods, layout),
      );
    }
    return true;
  }

  function renderStaffPersonalHubGrids(activeTabId) {
    if (!suiteEnabled()) return false;
    const tabs = STAFF_PERSONAL_HUB_TABS;
    const tabId = activeTabId || tabs[0]?.id;
    tabs.forEach((tab) => {
      const mount = document.getElementById(`staffPhGrid_${tab.id}`) || document.getElementById(`staffPhTab_${tab.id}`);
      if (!mount) return;
      mount.innerHTML = '';
      if (tab.id !== tabId) return;
      renderWidgetGrid('staffPersonalHub', {
        container: mount,
        widgetIds: tab.widgetIds,
        showToolbar: false,
        layoutPanelId: 'staffPersonalHub',
      });
    });
    const toolbarHost = document.getElementById('staffPhToolbar');
    if (toolbarHost && !toolbarHost.dataset.wired) {
      toolbarHost.dataset.wired = '1';
      const mods = visibleModules('staffPersonalHub');
      let layout = loadLayout('staffPersonalHub');
      if (!layout || layout.panelId !== 'staffPersonalHub') layout = defaultLayout('staffPersonalHub', mods);
      toolbarHost.innerHTML = `<button type="button" class="btn-sec flux-widget-grid__configure" data-panel="staffPersonalHub">Customize modules</button>`;
      toolbarHost.querySelector('.flux-widget-grid__configure')?.addEventListener('click', () =>
        openConfigureModal('staffPersonalHub', mods, layout),
      );
    }
    return true;
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
      if (panelId === 'counselorWorkspace' && typeof window.renderCounselorWorkspace === 'function') {
        window.renderCounselorWorkspace();
      } else if (panelId === 'staffPersonalHub' && typeof window.renderStaffPersonalHub === 'function') {
        window.renderStaffPersonalHub();
      } else {
        renderWidgetGrid(panelId);
      }
      if (typeof showToast === 'function') showToast('Workspace layout saved', 'success');
    });
  }

  function onNav(ev) {
    const panel = ev.detail?.panel;
    if (!panel || !PANEL_HOSTS[panel]) return;
    if (panel === 'counselorWorkspace' || panel === 'staffPersonalHub') return;
    if (panel === 'dashboard' && isEducatorPersonalMode()) return;
    if (panel === 'teacherDashboard') {
      if (typeof window.renderTeacherDashboard === 'function') {
        requestAnimationFrame(() => void window.renderTeacherDashboard());
      }
      return;
    }
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
    renderCounselorWorkspaceGrids,
    renderStaffPersonalHubGrids,
    counselorWorkspaceTabs: () => COUNSELOR_WORKSPACE_TABS.slice(),
    staffPersonalHubTabs: () => STAFF_PERSONAL_HUB_TABS.slice(),
    exportEnabledData,
    SUITE_FLAG,
  };
})();
