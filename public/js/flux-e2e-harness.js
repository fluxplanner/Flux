/**
 * P7-TESTS — E2E harness (guest + role scenarios without real Supabase auth).
 * Active when URL has ?e2e=1 or localStorage flux_e2e=1.
 */
(function () {
  'use strict';

  const E2E_USER_ID = '00000000-0000-4000-8000-0000000000e2';
  const IAE_SCHOOL = 'International Academy East';

  const IAE_PILOT_FLAGS = {
    enable_staff_productivity_suite: true,
    enable_classroom_tools: true,
    enable_caseload_engine: true,
    enable_personal_hub: true,
    enable_staff_command_v2: true,
    enable_school_ops: true,
    enable_locale_foundation: true,
    enable_ops_health_panel: true,
    enable_syllabus_conflict_check: true,
    enable_counselor_caseload: true,
    enable_dashboard_widget_picker: true,
  };

  const SCENARIOS = {
    'student-semester': {
      role: 'student',
      mode: 'personal',
      needsUser: false,
    },
    'student-dashboard-widgets': {
      role: 'student',
      mode: 'personal',
      needsUser: false,
      flags: { enable_dashboard_widget_picker: true },
    },
    'teacher-workflow': {
      role: 'teacher',
      mode: 'work',
      needsUser: true,
      profile: { role: 'teacher', display_name: 'E2E Teacher', subject: 'Biology' },
    },
    'ia-east-teacher': {
      role: 'teacher',
      mode: 'work',
      needsUser: true,
      profile: {
        role: 'teacher',
        display_name: 'IAE E2E Teacher',
        subject: 'Biology',
        school: IAE_SCHOOL,
      },
      flags: IAE_PILOT_FLAGS,
    },
    'counselor-path': {
      role: 'counselor',
      mode: 'work',
      needsUser: true,
      profile: { role: 'counselor', display_name: 'E2E Counselor' },
    },
    'ia-east-counselor': {
      role: 'counselor',
      mode: 'work',
      needsUser: true,
      profile: { role: 'counselor', display_name: 'IAE E2E Counselor', school: IAE_SCHOOL },
      flags: IAE_PILOT_FLAGS,
    },
  };

  let _api = null;
  let _mockClient = null;

  function qsFlag() {
    try {
      return new URLSearchParams(window.location.search).get('e2e') === '1';
    } catch (_) {
      return false;
    }
  }

  function scenarioFromUrl() {
    try {
      return new URLSearchParams(window.location.search).get('scenario') || '';
    } catch (_) {
      return '';
    }
  }

  function active() {
    if (qsFlag()) return true;
    try {
      return localStorage.getItem('flux_e2e') === '1';
    } catch (_) {
      return false;
    }
  }

  function pendingScenario() {
    const fromUrl = scenarioFromUrl();
    if (fromUrl && SCENARIOS[fromUrl]) return fromUrl;
    try {
      const stored = localStorage.getItem('flux_e2e_scenario');
      if (stored && SCENARIOS[stored]) return stored;
    } catch (_) {}
    return 'student-semester';
  }

  function isoDate(offsetDays) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }

  /**
   * The classes a teacher TEACHES.
   *
   * Every teacher scenario previously had only seedStudentSemester, so a
   * "teacher" arrived holding a student's timetable and nothing else. That was
   * invisible while the staff surfaces read window.classes — the Lesson Hub
   * rendered the student's Algebra II as though the teacher taught it. Now
   * those surfaces read the teaching list, an unseeded teacher correctly gets
   * an empty state, and any spec about a teacher's day needs real rows.
   *
   * Two periods with wall-clock times, deliberately unpinned to A or B so they
   * meet on whichever day the suite happens to run.
   */
  function seedTeacherTimetable() {
    const save = _api?.save || window.FluxStorage?.save;
    if (!save) return;
    /* Seed only when nothing has been decided yet. runBootstrap runs again on
       page.reload(), and localStorage survives that, so an unconditional seed
       would overwrite whatever the spec had just created — which is precisely
       what a "survives a reload" test is there to catch. An explicit empty
       array counts as decided: a spec clearing the timetable means it. */
    try {
      const key = typeof fluxNamespacedKey === 'function'
        ? fluxNamespacedKey('flux_teacher_classes') : 'flux_teacher_classes';
      if (localStorage.getItem(key) !== null) return;
    } catch (_) {}
    save('flux_teacher_classes', [
      {
        id: 92001, period: 2, periodLabel: 'A2', days: '',
        name: 'E2E World History', room: '118',
        timeStart: '09:15', timeEnd: '10:05', color: '#f43f5e', work: [],
      },
      {
        id: 92002, period: 3, periodLabel: 'A3', days: '',
        name: 'E2E American Lit', room: '204',
        timeStart: '10:15', timeEnd: '11:05', color: '#3b82f6', work: [],
      },
    ]);
  }

  function seedStudentSemester() {
    const save = _api?.save || window.FluxStorage?.save;
    if (!save) return;
    const tasks = [
      {
        id: 91001,
        name: 'E2E Algebra homework',
        date: isoDate(2),
        subject: 'Math',
        priority: 'high',
        type: 'hw',
        estTime: 45,
        difficulty: 3,
        done: false,
        subtasks: [],
        rescheduled: 0,
        createdAt: Date.now(),
        urgencyScore: 4,
      },
      {
        id: 91002,
        name: 'E2E History essay draft',
        date: isoDate(14),
        subject: 'History',
        priority: 'med',
        type: 'essay',
        estTime: 90,
        difficulty: 4,
        done: false,
        subtasks: [],
        rescheduled: 0,
        createdAt: Date.now(),
        urgencyScore: 2,
      },
      {
        id: 91003,
        name: 'E2E Semester review',
        date: isoDate(45),
        subject: 'Science',
        priority: 'med',
        type: 'test',
        estTime: 120,
        difficulty: 3,
        done: false,
        subtasks: [],
        rescheduled: 0,
        createdAt: Date.now(),
        urgencyScore: 1,
      },
    ];
    save('flux_onboarded', true);
    save('flux_splash_shown', '1');
    save('tasks', tasks);
    save('flux_classes', [
      { id: 'e2e-math', name: 'Algebra II', color: '#00bfff', period: '1' },
      { id: 'e2e-hist', name: 'AP History', color: '#f59e0b', period: '3' },
    ]);
    save('flux_settings', { dailyGoalHrs: 2, panic: true, quiet: false });
  }

  function createMockSupabase(scenario) {
    const counselorRow = {
      id: 'e2e-counselor-001',
      user_id: E2E_USER_ID,
      name: 'E2E Counselor',
      email: 'e2e-counselor@flux.test',
      avatar_initial: 'E',
      availability: {},
      booking_enabled: true,
      active: true,
    };
    const e2eUser = {
      id: E2E_USER_ID,
      email: 'e2e@flux.test',
      user_metadata: { full_name: 'E2E User' },
    };

    /* C11 help tickets need a mock with an actual memory: the feature reads
     * back what it wrote (student sees status; counselor moves it through
     * open → in_progress → resolved). Seed via window.__fluxE2EHelpTickets.
     * Scoped to this one table so every other table's result is unchanged. */
    function helpTicketStore() {
      if (!Array.isArray(window.__fluxE2EHelpTickets)) window.__fluxE2EHelpTickets = [];
      return window.__fluxE2EHelpTickets;
    }

    function matchesFilters(row, filters) {
      return (filters || []).every((f) => {
        if (f.op === 'eq') return String(row[f.col]) === String(f.val);
        if (f.op === 'neq') return String(row[f.col]) !== String(f.val);
        return true;
      });
    }

    function helpTicketResult(state) {
      const store = helpTicketStore();
      // Every path returns COPIES. A real PostgREST client deserializes fresh
      // JSON per request, so handing out live references would let a caller's
      // earlier read mutate under it — a lie about the transport that hides
      // exactly the status-transition bugs these tests exist to catch.
      const copy = (r) => ({ ...r });
      if (state.op === 'insert' || state.op === 'upsert') {
        const row = {
          id: `e2e-ticket-${store.length + 1}`,
          status: 'open',
          urgency: 'normal',
          assigned_to: null,
          created_at: new Date().toISOString(),
          ...(state.payload || {}),
        };
        store.push(row);
        return { data: [copy(row)], error: null };
      }
      if (state.op === 'update') {
        const hits = store.filter((r) => matchesFilters(r, state.filters));
        hits.forEach((r) => Object.assign(r, state.payload || {}));
        return { data: hits.map(copy), error: null };
      }
      if (state.op === 'delete') {
        window.__fluxE2EHelpTickets = store.filter((r) => !matchesFilters(r, state.filters));
        return { data: [], error: null };
      }
      const rows = store.filter((r) => matchesFilters(r, state.filters)).map(copy);
      if (state.single) return { data: rows[0] || null, error: null };
      return { data: rows, error: null };
    }

    function buildResult(table, state) {
      const empty = { data: [], error: null };
      const single = (row) => ({ data: row, error: null });
      if (table === 'flux_help_tickets') return helpTicketResult(state);
      if (table === 'counselors' && scenario === 'counselor-path') {
        if (state.op === 'insert' || state.op === 'update') return single(counselorRow);
        if (state.single) return single(counselorRow);
        return { data: [counselorRow], error: null };
      }
      if (table === 'user_roles') {
        if (state.single) {
          return single({
            role: scenario === 'teacher-workflow' ? 'teacher' : 'counselor',
            display_name: scenario === 'teacher-workflow' ? 'E2E Teacher' : 'E2E Counselor',
          });
        }
      }
      if (state.single) return single(null);
      return empty;
    }

    function chain(table) {
      const state = { table, op: 'select', filters: [], single: false };
      const api = {
        select() {
          return api;
        },
        // eq/neq record into state.filters (declared since the first version of
        // this mock but never populated) so tables with a real backing store can
        // filter. Tables without one ignore state.filters exactly as before.
        eq(col, val) {
          state.filters.push({ op: 'eq', col, val });
          return api;
        },
        neq(col, val) {
          state.filters.push({ op: 'neq', col, val });
          return api;
        },
        is() {
          return api;
        },
        ilike() {
          return api;
        },
        like() {
          return api;
        },
        gte() {
          return api;
        },
        lte() {
          return api;
        },
        order() {
          return api;
        },
        limit() {
          return api;
        },
        in() {
          return api;
        },
        insert(payload) {
          state.op = 'insert';
          state.payload = payload;
          return api;
        },
        // Present so cloud-sync paths don't throw in e2e (they call .upsert()).
        upsert(payload) {
          state.op = 'upsert';
          state.payload = payload;
          return api;
        },
        update(payload) {
          state.op = 'update';
          state.payload = payload;
          return api;
        },
        delete() {
          state.op = 'delete';
          return api;
        },
        maybeSingle() {
          state.single = true;
          return api;
        },
        single() {
          state.single = true;
          return api;
        },
        then(onFulfilled, onRejected) {
          try {
            return Promise.resolve(buildResult(table, state)).then(onFulfilled, onRejected);
          } catch (e) {
            return Promise.reject(e).then(onFulfilled, onRejected);
          }
        },
      };
      return api;
    }

    return {
      from(table) {
        return chain(table);
      },
      auth: {
        getSession: () =>
          Promise.resolve({
            data: { session: { user: e2eUser, access_token: 'e2e-token' } },
            error: null,
          }),
        signOut: () => Promise.resolve({ error: null }),
      },
    };
  }

  function getMockClient() {
    if (!active()) return null;
    const scenario = pendingScenario();
    const cfg = SCENARIOS[scenario];
    if (!cfg?.needsUser) return null;
    if (!_mockClient) _mockClient = createMockSupabase(scenario);
    return _mockClient;
  }

  function hidePreAppChrome() {
    const splash = document.getElementById('splash');
    const login = document.getElementById('loginScreen');
    if (splash) splash.style.display = 'none';
    if (login) {
      login.style.display = 'none';
      login.classList.remove('visible');
    }
    document.documentElement.setAttribute('data-e2e', '1');
  }

  function reloadAppState() {
    if (!_api?.reloadState) return;
    _api.reloadState();
  }

  async function runBootstrap() {
    if (!active() || !_api) return false;
    const scenario = pendingScenario();
    const cfg = SCENARIOS[scenario];
    if (!cfg) return false;

    try {
      localStorage.setItem('flux_e2e', '1');
      localStorage.setItem('flux_e2e_scenario', scenario);
    } catch (_) {}

    hidePreAppChrome();
    seedStudentSemester();
    if (cfg.role === 'teacher') seedTeacherTimetable();

    if (cfg.needsUser && _api.setCurrentUser) {
      _api.setCurrentUser({
        id: E2E_USER_ID,
        email: 'e2e@flux.test',
        user_metadata: { full_name: cfg.profile?.display_name || 'E2E User' },
      });
      _mockClient = createMockSupabase(scenario);
    } else if (_api.setCurrentUser) {
      _api.setCurrentUser(null);
    }

    reloadAppState();

    if (cfg.flags && typeof cfg.flags === 'object') {
      window.FLUX_EXPERIMENTS = { ...(window.FLUX_EXPERIMENTS || {}), ...cfg.flags };
      try {
        if (window.FluxFeatureFlags?.load) await window.FluxFeatureFlags.load({ force: true });
      } catch (_) {}
    }

    if (typeof FluxRole !== 'undefined') {
      FluxRole.current = cfg.role;
      FluxRole.mode = cfg.mode || 'work';
      FluxRole.profile = cfg.profile ? { ...cfg.profile } : null;
      window._userRole = cfg.role;
    }

    if (typeof _api.showApp === 'function') _api.showApp();
    if (typeof _api.applyRoleUI === 'function') _api.applyRoleUI();

    if (scenario === 'teacher-workflow' || scenario === 'ia-east-teacher') {
      try {
        if (window.FluxModuleLoader?.install) window.FluxModuleLoader.install();
      } catch (_) {}
      if (typeof _api.nav === 'function') _api.nav('teacherDashboard', null);
      if (typeof _api.renderTeacherDashboard === 'function') await _api.renderTeacherDashboard();
      try {
        if (window.FluxModuleLoader?.renderWidgetGrid) window.FluxModuleLoader.renderWidgetGrid('teacherDashboard');
      } catch (_) {}
    } else if (scenario === 'counselor-path' || scenario === 'ia-east-counselor') {
      try {
        window._counselorRecord = {
          id: 'e2e-counselor-001',
          user_id: E2E_USER_ID,
          name: 'E2E Counselor',
          email: 'e2e-counselor@flux.test',
          active: true,
        };
      } catch (_) {}
      try {
        if (window.FluxModuleLoader?.install) window.FluxModuleLoader.install();
      } catch (_) {}
      if (typeof _api.nav === 'function') _api.nav('counselorDashboard', null);
      if (typeof _api.renderCounselorDashboard === 'function') await _api.renderCounselorDashboard();
      try {
        if (typeof window.renderCounselorWorkspace === 'function') await window.renderCounselorWorkspace();
        else if (window.FluxModuleLoader?.renderCounselorWorkspaceGrids) {
          window.FluxModuleLoader.renderCounselorWorkspaceGrids('caseload');
        }
      } catch (_) {}
    } else {
      if (typeof _api.nav === 'function') _api.nav('dashboard', null);
      try {
        if (window.FluxPersonal?.applyDashboardVisibility) window.FluxPersonal.applyDashboardVisibility();
        if (window.FluxPersonal?.applyDashboardOrder) window.FluxPersonal.applyDashboardOrder();
      } catch (_) {}
    }

    return true;
  }

  function _register(api) {
    _api = api;
    if (active()) {
      try {
        localStorage.setItem('flux_splash_shown', '1');
      } catch (_) {}
      const sc = scenarioFromUrl();
      if (sc) {
        try {
          localStorage.setItem('flux_e2e_scenario', sc);
        } catch (_) {}
      }
    }
  }

  if (active()) {
    try {
      localStorage.setItem('flux_splash_shown', '1');
    } catch (_) {}
  }

  window.FluxE2e = {
    active,
    pendingScenario,
    getMockClient,
    runBootstrap,
    _register,
    SCENARIOS,
  };
})();
