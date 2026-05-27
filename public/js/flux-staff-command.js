/**
 * FluxStaffCommand — staff productivity commands for ⌘K palette + global search.
 * Flags: enable_staff_command_v2 + enable_staff_productivity_suite
 * Gmail actions also need enable_gmail_educator_import.
 */
(function () {
  'use strict';

  let _searchWrapped = false;
  const _registeredModuleIds = new Set();

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function suiteEnabled() {
    try {
      return !!window.FluxModuleLoader?.suiteEnabled?.();
    } catch (_) {
      return false;
    }
  }

  function commandV2Enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_staff_command_v2', false);
    } catch (_) {
      return false;
    }
  }

  function enabled() {
    return suiteEnabled() && commandV2Enabled();
  }

  function isEducator() {
    try {
      return window.FluxRole?.isEducator?.() === true;
    } catch (_) {
      return false;
    }
  }

  function role() {
    try {
      return window.FluxRole?.current || (typeof getMyRole === 'function' ? getMyRole() : '');
    } catch (_) {
      return '';
    }
  }

  function matchQuery(needle, label, keys) {
    if (!needle) return true;
    const n = needle.toLowerCase();
    if (label.toLowerCase().includes(n)) return true;
    return (keys || []).some((k) => String(k).toLowerCase().includes(n));
  }

  function goWork(panelId) {
    try {
      if (window.FluxRole?.setMode) FluxRole.setMode('work');
      if (typeof applyRoleUI === 'function') applyRoleUI();
      if (typeof updateModeSwitchUI === 'function') updateModeSwitchUI();
    } catch (_) {}
    if (typeof nav === 'function') nav(panelId);
    if (typeof closeCommandPalette === 'function') closeCommandPalette();
  }

  function push(cmds, icon, label, cat, sub, keys, action) {
    cmds.push({ icon, label, cat, sub: sub || '', action, _keys: keys });
  }

  function filterByQuery(cmds, q) {
    const needle = (q || '').toLowerCase().trim();
    if (!needle) return cmds;
    return cmds.filter((c) => matchQuery(needle, c.label, c._keys));
  }

  function getPaletteCommands(q) {
    if (!enabled() || !isEducator()) return [];

    const cmds = [];
    const r = role();

    if (r === 'admin' || r === 'staff') {
      push(cmds, '🏫', 'Open admin operations', 'Staff', 'Duty roster, subs, directory', ['admin', 'ops', 'operations'], () =>
        goWork('adminOps'),
      );
      if (window.FluxAdminWidgets?.publishDutyLogs) {
        push(cmds, '📋', 'Publish duty roster to school log', 'Staff', 'admin_duty_logs', ['duty', 'publish', 'roster'], async () => {
          if (typeof closeCommandPalette === 'function') closeCommandPalette();
          const duties = { ...(typeof load === 'function' ? load('flux_admin_duties_v1', {}) : {}) };
          const defaults = {
            'Lunch duty': '(unassigned)',
            'Hall duty (AM)': '(unassigned)',
            'Hall duty (PM)': '(unassigned)',
            'Bus duty': '(unassigned)',
            Detention: '(unassigned)',
          };
          const merged = { ...defaults, ...duties };
          const res = await FluxAdminWidgets.publishDutyLogs(merged);
          if (typeof showToast === 'function') {
            showToast(res.ok ? `Published ${res.count} duties` : res.error || 'Failed', res.ok ? 'success' : 'error');
          }
          goWork('adminOps');
        });
      }
      push(cmds, '🔁', 'Add sub coverage (today)', 'Staff', 'Operations tab', ['sub', 'substitute', 'coverage'], () => {
        goWork('adminOps');
        if (typeof showToast === 'function') showToast('Use + Sub coverage on Operations or the Sub swap widget', 'info');
      });
      if (window.FluxOpsHealth?.enabled?.()) {
        push(cmds, '🩺', 'Run system health checks', 'Staff', 'Ops readiness', ['health', 'rls', 'readiness'], () => {
          goWork('adminOps');
          if (typeof showToast === 'function') showToast('Open System health widget → Run checks', 'info');
        });
      }
      push(cmds, '📢', 'Faculty announcement', 'Staff', 'All classes', ['announce', 'broadcast', 'faculty'], () => {
        if (typeof closeCommandPalette === 'function') closeCommandPalette();
        if (typeof openTeacherAnnouncementModal === 'function') openTeacherAnnouncementModal();
        else if (typeof showToast === 'function') showToast('Announcement composer not available', 'warn');
      });
    }

    if (r === 'counselor') {
      push(cmds, '💬', 'Open counselor dashboard', 'Staff', 'Caseload & meetings', ['counselor', 'caseload'], () =>
        goWork('counselorDashboard'),
      );
      push(cmds, '🩺', 'Wellness check-in queue', 'Staff', 'Caseload tools tab', ['wellness', 'check-in', 'queue'], () => {
        goWork('counselorWorkspace');
        if (typeof showToast === 'function') showToast('Open Caseload tools → Caseload tab', 'info');
      });
      push(cmds, '📅', 'Counselor appointments', 'Staff', 'Booking panel', ['appointment', 'schedule'], () => {
        goWork('counselorMeetings');
      });
    }

    if (r === 'teacher') {
      push(cmds, '📚', 'Open teacher dashboard', 'Staff', 'Classes & assignments', ['teacher', 'classes'], () =>
        goWork('teacherDashboard'),
      );
      push(cmds, '📖', 'Open lesson hub', 'Staff', "Today's schedule", ['lesson', 'hub', 'bell'], () => goWork('lessonHub'));
      if (window.FluxTeacherLiveClass?.enabled?.() && window.FluxTeacherLiveClass?.open) {
        push(cmds, '▶', 'Start class mode', 'Staff', 'Immersive live class', ['live', 'class', 'start'], () => {
          goWork('teacherDashboard');
          try {
            const ctx = FluxTeacherLiveClass.buildContextFromView?.();
            if (ctx) FluxTeacherLiveClass.open(ctx);
            else if (typeof showToast === 'function') showToast('Open a class first, then start class mode', 'info');
          } catch (e) {
            if (typeof showToast === 'function') showToast('Could not start class mode', 'warn');
          }
        });
      }
      push(cmds, '📢', 'Class announcement (Oops broadcast)', 'Staff', 'Urgent student banner', ['oops', 'broadcast', 'announce'], () => {
        goWork('teacherDashboard');
        if (typeof showToast === 'function') showToast('Enable Oops broadcast widget in workspace modules', 'info');
      });
    }

    if (r === 'staff') {
      push(cmds, '🛠', 'Open staff workboard', 'Staff', 'Tickets & checklist', ['workboard', 'staff', 'tickets'], () =>
        goWork('staffWorkboard'),
      );
    }

    const mods = (window.FluxModuleLoader?.catalog?.() || []).filter(
      (m) => m.status !== 'planned' && window.FluxModuleLoader?.moduleEnabled?.(m),
    );
    mods.forEach((m) => {
      push(
        cmds,
        '◆',
        `Module: ${m.title}`,
        'Staff modules',
        `${m.scope} · ${m.status}`,
        [m.id, m.title, 'widget', 'module'],
        () => {
          if (m.scope === 'personal' && window.FluxRole?.setMode) {
            FluxRole.setMode('personal');
            if (typeof nav === 'function') nav('staffPersonalHub');
            if (typeof window.renderStaffPersonalHub === 'function') window.renderStaffPersonalHub();
          } else if (m.roles.includes('counselor')) goWork('counselorWorkspace');
          else if (m.roles.includes('teacher')) goWork('teacherDashboard');
          else if (m.roles.includes('admin')) goWork('adminOps');
          else goWork('staffWorkboard');
          if (typeof showToast === 'function') showToast(`Customize workspace → ${m.title}`, 'info');
        },
      );
    });

    push(cmds, '📊', 'Export staff module catalog (CSV)', 'Staff', 'FluxModuleLoader', ['export', 'csv', 'catalog'], () => {
      if (typeof closeCommandPalette === 'function') closeCommandPalette();
      window.FluxModuleLoader?.exportEnabledData?.();
    });

    if (window.FluxGmailEducator?.enabled?.()) {
      push(cmds, '📧', 'Open Gmail hub', 'Gmail', 'Canvas & Gmail tab', ['gmail', 'google', 'email'], () => {
        if (typeof closeCommandPalette === 'function') closeCommandPalette();
        nav('canvas');
        if (typeof loadGmail === 'function') setTimeout(() => loadGmail(), 400);
      });
      push(cmds, '⬇', 'Gmail: import top action email', 'Gmail', 'Highest action score', ['gmail', 'import', 'email', 'task'], async () => {
        if (typeof closeCommandPalette === 'function') closeCommandPalette();
        const ok = await window.FluxGmailEducator?.importTopActionEmail?.();
        if (ok && typeof nav === 'function') nav('dashboard');
      });
      push(cmds, '⬇', 'Gmail: import action emails (bulk)', 'Gmail', 'Up to 8 messages', ['gmail', 'bulk', 'import'], async () => {
        if (typeof closeCommandPalette === 'function') closeCommandPalette();
        const n = await window.FluxGmailEducator?.importActionEmailsBulk?.();
        if (n > 0 && typeof nav === 'function') nav('dashboard');
      });
    }

    return filterByQuery(cmds, q).map(({ icon, label, cat, sub, action }) => ({ icon, label, cat, sub, action }));
  }

  function registerCommands() {
    if (!enabled()) return;

    const mods = window.FluxModuleLoader.catalog().filter((m) => m.status !== 'planned');
    window.FLUX_STAFF_COMMANDS = window.FLUX_STAFF_COMMANDS || [];

    mods.forEach((m) => {
      if (_registeredModuleIds.has(m.id)) return;
      _registeredModuleIds.add(m.id);
      window.FLUX_STAFF_COMMANDS.push({
        label: m.title,
        hint: `${m.scope} · ${m.status}`,
        action: () => {
          if (m.scope === 'personal' && window.FluxRole?.setMode) {
            FluxRole.setMode('personal');
            if (typeof nav === 'function') nav('staffPersonalHub');
            if (typeof window.renderStaffPersonalHub === 'function') window.renderStaffPersonalHub();
          } else if (m.roles.includes('counselor')) goWork('counselorWorkspace');
          else if (m.roles.includes('teacher')) goWork('teacherDashboard');
          else if (m.roles.includes('admin')) goWork('adminOps');
          else goWork('staffWorkboard');
        },
      });
    });

    if (!_searchWrapped) {
      const orig = window.runGlobalSearch;
      if (orig && !orig.__fluxStaffWrapped) {
        window.runGlobalSearch = function (q) {
          const palette = getPaletteCommands(q);
          if (palette.length && typeof window.appendStaffSearchResults === 'function') {
            palette.slice(0, 8).forEach((c) => {
              window.appendStaffSearchResults(
                { label: c.label, hint: c.sub || c.cat, action: c.action },
                q,
              );
            });
          }
          return orig.apply(this, arguments);
        };
        window.runGlobalSearch.__fluxStaffWrapped = true;
        _searchWrapped = true;
      }
    }
  }

  async function renderGmailQuickWidget(mount) {
    if (!window.FluxGmailEducator?.enabled?.()) {
      mount.innerHTML =
        '<p class="flux-widget-planned">Enable <code>enable_gmail_educator_import</code> for Gmail → task.</p>';
      return;
    }
    if (!isEducator()) {
      mount.innerHTML = '<p class="flux-widget-planned">Educator accounts only.</p>';
      return;
    }

    mount.innerHTML = `
      <p class="flux-widget-hint">Import actionable school email as a planner task (deduped by message id).</p>
      <button type="button" class="btn" id="fluxGmailCmdTop" style="width:100%;font-size:.78rem;margin-bottom:6px">Import top action email</button>
      <button type="button" class="btn-sec" id="fluxGmailCmdBulk" style="width:100%;font-size:.72rem;margin-bottom:6px">Bulk import (≤8)</button>
      <button type="button" class="btn-sec" id="fluxGmailCmdHub" style="width:100%;font-size:.68rem">Open Gmail hub</button>`;

    mount.querySelector('#fluxGmailCmdTop')?.addEventListener('click', async () => {
      await window.FluxGmailEducator?.importTopActionEmail?.();
    });
    mount.querySelector('#fluxGmailCmdBulk')?.addEventListener('click', async () => {
      await window.FluxGmailEducator?.importActionEmailsBulk?.();
    });
    mount.querySelector('#fluxGmailCmdHub')?.addEventListener('click', () => {
      nav('canvas');
      if (typeof loadGmail === 'function') setTimeout(() => loadGmail(), 400);
    });
  }

  window.FluxStaffCommand = {
    enabled,
    registerCommands,
    getPaletteCommands,
    renderGmailQuickWidget,
  };
})();
