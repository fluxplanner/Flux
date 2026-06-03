/**
 * Flux role routing — panel access matrix + educator nav remap helpers.
 * UX-only; Supabase RLS remains authoritative.
 */
(function () {
  'use strict';

  const EDUCATOR_WORK_PANELS = new Set([
    'teacherDashboard',
    'counselorDashboard',
    'adminDashboard',
    'staffWorkboard',
    'lessonHub',
    'counselorMeetings',
    'counselorWorkspace',
    'adminOps',
    'staffHub',
  ]);

  const STAFF_PERSONAL_PANELS = new Set([
    'staffTasks',
    'staffMeetingNotes',
    'staffPD',
    'staffWellbeing',
    'staffResources',
    'staffPersonalHub',
  ]);

  function role() {
    return typeof window.FluxRole !== 'undefined' ? window.FluxRole : null;
  }

  function staffGoogleEnabled() {
    return true; // CORE: enable_staff_google_hub (Phase 37.1 PR-B)
  }

  function isPendingStaffPersonal() {
    const fr = role();
    const u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;
    if (!fr || !u) return false;
    return (
      String(u.user_metadata?.role_pending || '').toLowerCase() === 'staff' &&
      fr.current === 'student' &&
      fr.isPersonalMode &&
      fr.isPersonalMode()
    );
  }

  /** Role home panel when in work mode (or dashboard in personal). */
  function workHomePanel(fr) {
    if (!fr) return 'dashboard';
    if (fr.isTeacher && fr.isTeacher()) return 'teacherDashboard';
    if (fr.isCounselor && fr.isCounselor()) return 'counselorDashboard';
    if (fr.current === 'staff') return 'staffWorkboard';
    if (fr.current === 'admin') return 'adminDashboard';
    return 'dashboard';
  }

  /**
   * Work-mode educators: Canvas LMS panel → role work home (Google hub uses canvas id for staff/admin only).
   */
  function interceptNavigation(targetPanel) {
    const pid = String(targetPanel || '');
    if (pid !== 'canvas') return pid;
    try {
      const fr = role();
      if (!fr || !fr.isEducator || !fr.isEducator()) return pid;
      const work = fr.isWorkMode && fr.isWorkMode();
      if (!work) return pid;
      if (
        staffGoogleEnabled() &&
        ((fr.isStaff && fr.isStaff()) || (fr.isPlatformAdmin && fr.isPlatformAdmin()))
      ) {
        return pid;
      }
      if (fr.isTeacher && fr.isTeacher()) return 'teacherDashboard';
      if (fr.isCounselor && fr.isCounselor()) return 'counselorDashboard';
      if (fr.current === 'admin') return 'adminDashboard';
      if (fr.isStaff && fr.isStaff()) return 'staffWorkboard';
    } catch (_) {}
    return pid;
  }

  /**
   * Remap mis-matched educator panel ids before assertRoleAccess (nav prefetch).
   */
  function remapNavTarget(id) {
    let pid = interceptNavigation(id);
    pid = String(pid || '');
    if (!pid) return pid;
    const fr = role();
    if (!fr) return pid;

    try {
      if (fr.isEducator && fr.isEducator()) {
        const work = fr.isWorkMode && fr.isWorkMode();
        if (work) {
          if (pid === 'teacherDashboard' && !fr.isTeacher()) {
            return workHomePanel(fr);
          }
          if (pid === 'counselorDashboard' && !fr.isCounselor()) {
            return workHomePanel(fr);
          }
          if (pid === 'adminDashboard' && fr.current !== 'admin') {
            return workHomePanel(fr);
          }
          if (pid === 'staffWorkboard' && fr.current !== 'staff') {
            return workHomePanel(fr);
          }
          if (pid === 'adminOps' && fr.current !== 'admin') {
            return fr.current === 'staff' ? 'staffWorkboard' : workHomePanel(fr);
          }
          if (pid === 'lessonHub' && !fr.isTeacher()) {
            return workHomePanel(fr);
          }
          if (pid === 'counselorMeetings' && !fr.isCounselor()) {
            return workHomePanel(fr);
          }
          if (pid === 'counselorWorkspace' && !fr.isCounselor()) {
            return workHomePanel(fr);
          }
        } else if (pid === 'school' || EDUCATOR_WORK_PANELS.has(pid)) {
          return 'dashboard';
        }
      } else if (EDUCATOR_WORK_PANELS.has(pid) || STAFF_PERSONAL_PANELS.has(pid)) {
        return 'dashboard';
      }
    } catch (_) {}

    return pid;
  }

  /**
   * @param {string} panelId
   * @returns {{ ok: boolean, reason?: string, fallbackId?: string }}
   */
  function check(panelId) {
    const pid = String(panelId || '');
    if (!pid) return { ok: true };

    try {
      if (pid === 'flux_control') {
        const r = typeof getMyRole === 'function' ? getMyRole() : '';
        if (r === 'owner' || r === 'dev') return { ok: true };
        return { ok: false, reason: 'flux_control_owner_only', fallbackId: 'dashboard' };
      }

      if (pid === 'parentPortal') {
        try {
          if (
            window.FluxFeatureFlags &&
            FluxFeatureFlags.isEnabled('enable_parent_portal', false)
          ) {
            return { ok: true };
          }
        } catch (_) {}
        return { ok: false, reason: 'parent_portal_flag', fallbackId: 'dashboard' };
      }

      const fr = role();
      if (!fr) return { ok: true };

      const work = fr.isWorkMode && fr.isWorkMode();
      const personal = fr.isPersonalMode && fr.isPersonalMode();
      const edu = fr.isEducator && fr.isEducator();
      const home = work ? workHomePanel(fr) : 'dashboard';

      // The student dashboard (#dashboard) must never render for an educator in
      // Work mode — that's the "student UI under the work dashboard" leak. The
      // nav() remap normally redirects dashboard→role-home, but any path that
      // activates #dashboard without that remap (role-hydration race, deep link,
      // stale nav) would otherwise fall through to the default ok:true below.
      // Gate it here so every entry point routes work-mode educators to their
      // role home instead. (Personal mode keeps #dashboard — that's their own
      // staff personal dashboard, rendered by renderStaffPersonalDashboard.)
      if (pid === 'dashboard') {
        const eduHome = workHomePanel(fr);
        // Guard against a redirect loop: only bounce if home is a real role panel.
        if (edu && work && eduHome && eduHome !== 'dashboard') {
          return { ok: false, reason: 'student_dashboard_in_work', fallbackId: eduHome };
        }
        return { ok: true };
      }

      if (pid === 'teacherDashboard') {
        if (fr.isTeacher() && work) return { ok: true };
        return { ok: false, reason: 'teacher_dashboard', fallbackId: home };
      }
      if (pid === 'counselorDashboard') {
        if (fr.isCounselor() && work) return { ok: true };
        return { ok: false, reason: 'counselor_dashboard', fallbackId: home };
      }
      if (pid === 'adminDashboard') {
        if (fr.current === 'admin' && work) return { ok: true };
        return { ok: false, reason: 'admin_dashboard', fallbackId: home };
      }
      if (pid === 'staffWorkboard') {
        if (fr.current === 'staff' && work) return { ok: true };
        return { ok: false, reason: 'staff_workboard', fallbackId: home };
      }
      if (pid === 'lessonHub') {
        if (fr.isTeacher() && work) return { ok: true };
        return { ok: false, reason: 'lesson_hub', fallbackId: home };
      }
      if (pid === 'counselorMeetings') {
        if (fr.isCounselor() && work) return { ok: true };
        return { ok: false, reason: 'counselor_meetings', fallbackId: home };
      }
      if (pid === 'counselorWorkspace') {
        if (fr.isCounselor() && work) return { ok: true };
        return { ok: false, reason: 'counselor_workspace', fallbackId: home };
      }
      if (pid === 'adminOps') {
        if (fr.current === 'admin' && work) return { ok: true };
        return {
          ok: false,
          reason: 'admin_ops',
          fallbackId: fr.current === 'staff' ? 'staffWorkboard' : home,
        };
      }
      if (pid === 'staffHub') {
        if (edu && work && (fr.isStaff() || fr.isCounselor())) return { ok: true };
        if (edu && work && fr.isPlatformAdmin && fr.isPlatformAdmin()) {
          return { ok: false, reason: 'staff_hub_admin_use_ops', fallbackId: 'adminOps' };
        }
        return { ok: false, reason: 'staff_hub', fallbackId: home };
      }
      if (STAFF_PERSONAL_PANELS.has(pid)) {
        if ((edu && personal) || isPendingStaffPersonal()) return { ok: true };
        return {
          ok: false,
          reason: 'staff_personal_panel',
          fallbackId: work ? home : 'dashboard',
        };
      }
      if (pid === 'school') {
        if (fr.isStudent && fr.isStudent()) return { ok: true };
        if (isPendingStaffPersonal()) return { ok: true };
        if (edu && work) return { ok: true };
        return { ok: false, reason: 'school_educator_personal', fallbackId: 'dashboard' };
      }
      if (pid === 'schoolFeedPanel') {
        if (fr.isStudent && fr.isStudent()) return { ok: true };
        if (isPendingStaffPersonal()) return { ok: true };
        if (edu && work) return { ok: true };
        return { ok: false, reason: 'school_feed_denied', fallbackId: home };
      }
      if (pid === 'canvas') {
        if (!edu || personal || fr.isStudent()) return { ok: true };
        if (
          staffGoogleEnabled() &&
          ((fr.isStaff && fr.isStaff()) || (fr.isPlatformAdmin && fr.isPlatformAdmin()))
        ) {
          return { ok: true };
        }
        if (fr.isTeacher() || fr.isCounselor()) {
          return { ok: false, reason: 'canvas_work_educator', fallbackId: home };
        }
        return { ok: true };
      }
    } catch (_) {
      return { ok: true };
    }

    return { ok: true };
  }

  /** Dev-only: log access outcome for every known gated panel. */
  function auditMatrix() {
    const fr = role();
    const panels = [
      'dashboard',
      'teacherDashboard',
      'counselorDashboard',
      'adminDashboard',
      'staffWorkboard',
      'lessonHub',
      'counselorMeetings',
      'counselorWorkspace',
      'adminOps',
      'staffHub',
      'staffTasks',
      'schoolFeedPanel',
      'canvas',
      'flux_control',
    ];
    const rows = panels.map((p) => {
      const r = check(p);
      return { panel: p, ok: r.ok, reason: r.reason, fallback: r.fallbackId };
    });
    console.table(rows);
    console.log('[FluxRoleRouting] context', {
      role: fr?.current,
      mode: fr?.mode,
      work: fr?.isWorkMode?.(),
      personal: fr?.isPersonalMode?.(),
    });
    return rows;
  }

  window.FluxRoleRouting = {
    check,
    interceptNavigation,
    remapNavTarget,
    workHomePanel,
    auditMatrix,
    EDUCATOR_WORK_PANELS,
    STAFF_PERSONAL_PANELS,
  };
})();
