/**
 * Google Classroom sync — courses, coursework, grades → Flux tasks.
 * Flag: enable_classroom_sync (default off).
 */
(function () {
  'use strict';

  const LS_CACHE = 'flux_classroom_hub_cache';
  const LS_COURSE_FILTER = 'flux_classroom_course_filter';

  const SCOPES = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
    'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
  ];

  let _hubData = null;

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_classroom_sync', false);
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

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') window.showToast(msg, kind || 'info');
    else console.log('[classroom]', msg);
  }

  async function ensureToken() {
    if (window.FluxGoogle?.ensureToken) return window.FluxGoogle.ensureToken();
    if (window.gmailToken) return window.gmailToken;
    try {
      return sessionStorage.getItem('flux_gmail_token');
    } catch (_) {
      return null;
    }
  }

  function taskList() {
    return Array.isArray(window.tasks) ? window.tasks : [];
  }

  function workTaskExists(courseId, workId) {
    return taskList().some(
      (t) =>
        t &&
        String(t.classroomCourseId) === String(courseId) &&
        String(t.classroomCourseWorkId) === String(workId),
    );
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function dueFromWork(w) {
    const d = w && w.dueDate;
    if (!d || d.year == null) return '';
    return `${d.year}-${pad2(d.month)}-${pad2(d.day)}`;
  }

  function subjectKey(courseName) {
    if (typeof window.canvasFluxSubjectKeyFromCourseName === 'function') {
      return window.canvasFluxSubjectKeyFromCourseName(courseName || '');
    }
    return String(courseName || '').slice(0, 80);
  }

  function inferType(w) {
    const wt = String(w.workType || '').toUpperCase();
    if (wt.includes('QUIZ') || wt.includes('SHORT_ANSWER')) return 'quiz';
    if (wt.includes('MULTIPLE_CHOICE')) return 'quiz';
    const t = String(w.title || '').toLowerCase();
    if (/\b(test|exam|midterm|final)\b/.test(t)) return 'test';
    if (/\b(project|presentation)\b/.test(t)) return 'project';
    if (/\b(essay|paper)\b/.test(t)) return 'essay';
    if (/\b(lab)\b/.test(t)) return 'lab';
    if (/\b(reading|read)\b/.test(t)) return 'reading';
    return 'hw';
  }

  function priorityForWork(w, sub) {
    if (sub && (sub.state === 'TURNED_IN' || sub.state === 'RETURNED')) return 'low';
    const due = dueFromWork(w);
    if (!due) return 'med';
    const end = new Date(`${due}T23:59:00`);
    const h = (end - Date.now()) / 3600000;
    if (h > 0 && h <= 48) return 'high';
    return 'med';
  }

  function gradeLabel(sub) {
    if (!sub) return '—';
    if (sub.assignedGrade != null && sub.assignedGrade !== '') return String(sub.assignedGrade);
    if (sub.draftGrade != null && sub.draftGrade !== '') return `${sub.draftGrade} (draft)`;
    if (sub.state === 'TURNED_IN') return 'Turned in';
    if (sub.state === 'RETURNED') return 'Returned';
    if (sub.state === 'NEW') return 'Not started';
    return sub.state || '—';
  }

  function gradeClass(sub) {
    if (sub && sub.assignedGrade != null && sub.assignedGrade !== '') return 'flux-classroom-grade--done';
    if (sub && (sub.state === 'TURNED_IN' || sub.state === 'RETURNED')) return 'flux-classroom-grade--done';
    return '';
  }

  async function apiGet(path) {
    const token = await ensureToken();
    if (!token) return { ok: false, needsSignIn: true };
    try {
      const res = await fetch(`https://classroom.googleapis.com/v1${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) return { ok: false, expired: true };
      if (res.status === 403) return { ok: false, needsScope: true };
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, error: `Classroom API ${res.status} — ${text.slice(0, 120)}` };
      }
      const data = await res.json();
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  }

  async function listPaged(buildPath) {
    const out = [];
    let pageToken = '';
    let pages = 0;
    do {
      const path = buildPath(pageToken);
      const res = await apiGet(path);
      if (!res.ok) return res;
      const data = res.data || {};
      const items = data.courses || data.courseWork || data.studentSubmissions || [];
      if (Array.isArray(items)) out.push(...items);
      pageToken = data.nextPageToken || '';
      pages += 1;
    } while (pageToken && pages < 8);
    return { ok: true, items: out };
  }

  async function fetchSubmission(courseId, workId) {
    const res = await apiGet(
      `/courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(workId)}/studentSubmissions?userId=me`,
    );
    if (!res.ok) return null;
    const subs = res.data?.studentSubmissions || [];
    return subs[0] || null;
  }

  async function refreshHub(opts) {
    const quiet = !!(opts && opts.quiet);
    const coursesRes = await listPaged((token) => {
      const q = 'courseStates=ACTIVE&pageSize=30';
      return `/courses?${q}${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`;
    });
    if (!coursesRes.ok) return coursesRes;

    const courses = coursesRes.items || [];
    const courseWork = [];
    const submissions = {};

    for (const c of courses) {
      await new Promise((r) => setTimeout(r, 35));
      const cwRes = await listPaged((token) => {
        const base = `/courses/${encodeURIComponent(c.id)}/courseWork?pageSize=40&orderBy=dueDate desc`;
        return token ? `${base}&pageToken=${encodeURIComponent(token)}` : base;
      });
      if (!cwRes.ok) continue;
      (cwRes.items || []).forEach((w) => {
        if (w.state === 'DRAFT' || w.state === 'DELETED') return;
        courseWork.push({
          ...w,
          courseId: c.id,
          courseName: c.name || c.section || 'Class',
        });
      });
    }

    const toGrade = courseWork.slice(0, 60);
    for (let i = 0; i < toGrade.length; i += 1) {
      const w = toGrade[i];
      if (i % 5 === 0) await new Promise((r) => setTimeout(r, 30));
      const sub = await fetchSubmission(w.courseId, w.id);
      if (sub) submissions[`${w.courseId}_${w.id}`] = sub;
    }

    _hubData = {
      fetchedAt: Date.now(),
      courses,
      courseWork,
      submissions,
    };
    save(LS_CACHE, _hubData);
    if (!quiet) toast(`Synced ${courses.length} classes · ${courseWork.length} assignments`, 'success');
    return { ok: true };
  }

  function hubData() {
    if (_hubData) return _hubData;
    const cached = load(LS_CACHE, null);
    if (cached && cached.courseWork) {
      _hubData = cached;
      return _hubData;
    }
    return null;
  }

  function addWorkToPlanner(courseId, workId, opts) {
    const silent = !!(opts && opts.silent);
    const skipRender = !!(opts && opts.skipRender);
    if (workTaskExists(courseId, workId)) {
      if (!silent) toast('Already in your planner ✓', 'info');
      return false;
    }
    const data = hubData();
    const w = data?.courseWork?.find(
      (x) => String(x.courseId) === String(courseId) && String(x.id) === String(workId),
    );
    if (!w) {
      if (!silent) toast('Reload Classroom sync first', 'warning');
      return false;
    }
    const sub = data.submissions?.[`${courseId}_${workId}`] || null;
    const done = sub && (sub.state === 'TURNED_IN' || sub.state === 'RETURNED');
    const gradeNote = gradeLabel(sub);
    const t = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: (w.title || 'Assignment').slice(0, 240),
      date: dueFromWork(w),
      subject: subjectKey(w.courseName),
      priority: priorityForWork(w, sub),
      type: inferType(w),
      notes: [
        w.description ? String(w.description).replace(/<[^>]+>/g, ' ').slice(0, 400) : '',
        w.alternateLink ? w.alternateLink : '',
        gradeNote !== '—' ? `Classroom grade: ${gradeNote}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      estTime: 45,
      done: !!done,
      rescheduled: 0,
      createdAt: Date.now(),
      classroomCourseId: courseId,
      classroomCourseWorkId: workId,
      classroomGrade: gradeNote,
    };
    if (typeof window.calcUrgency === 'function') t.urgencyScore = window.calcUrgency(t);
    const list = taskList();
    list.unshift(t);
    save('tasks', list);
    if (!skipRender) {
      if (typeof window.syncKey === 'function') window.syncKey('tasks', list);
      if (typeof window.renderStats === 'function') window.renderStats();
      if (typeof window.renderTasks === 'function') window.renderTasks();
      if (typeof window.renderCalendar === 'function') window.renderCalendar();
    }
    if (!silent) toast(`Added "${t.name.slice(0, 40)}" to planner ✓`, 'success');
    return true;
  }

  function filteredWork() {
    const data = hubData();
    if (!data) return [];
    const filter = load(LS_COURSE_FILTER, 'all');
    let list = data.courseWork || [];
    if (filter && filter !== 'all') {
      list = list.filter((w) => String(w.courseId) === String(filter));
    }
    return list.sort((a, b) => {
      const da = dueFromWork(a) || '9999';
      const db = dueFromWork(b) || '9999';
      return da.localeCompare(db);
    });
  }

  function importAllNew() {
    let n = 0;
    filteredWork().forEach((w) => {
      if (!dueFromWork(w)) return;
      if (workTaskExists(w.courseId, w.id)) return;
      if (addWorkToPlanner(w.courseId, w.id, { silent: true, skipRender: true })) n += 1;
    });
    if (n) {
      if (typeof window.syncKey === 'function') window.syncKey('tasks', taskList());
      if (typeof window.renderStats === 'function') window.renderStats();
      if (typeof window.renderTasks === 'function') window.renderTasks();
      if (typeof window.renderCalendar === 'function') window.renderCalendar();
    }
    toast(n ? `Imported ${n} dated assignments` : 'Nothing new to import', n ? 'success' : 'info');
    render(document.getElementById('gHubClassroomSlot'));
  }

  async function reconnect() {
    const sb = typeof window.getSB === 'function' ? window.getSB() : null;
    if (!sb) {
      toast('Auth not available — refresh the page', 'error');
      return;
    }
    try {
      if (typeof window.initOAuthPostMessageListener === 'function') window.initOAuthPostMessageListener();
      const redirectTo =
        typeof window.getRedirectURL === 'function'
          ? window.getRedirectURL()
          : window.location.origin + window.location.pathname;
      const { data, error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          scopes: SCOPES.join(' '),
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (error) throw error;
      if (!data?.url) {
        toast('Could not start Google sign-in', 'error');
        return;
      }
      const feat = 'width=520,height=720,left=80,top=60,scrollbars=yes,resizable=yes';
      const w = window.open(data.url, 'fluxGoogleOAuth', feat);
      if (!w) window.location.href = data.url;
      else {
        try {
          w.focus();
        } catch (_) {}
      }
      toast('Approve Classroom access in the pop-up', 'info');
    } catch (e) {
      toast('Sign-in failed: ' + (e.message || e), 'error');
    }
  }

  function render(slot) {
    const host = slot || document.getElementById('gHubClassroomSlot');
    if (!host) return;
    if (!enabled()) {
      host.innerHTML = '';
      return;
    }

    const linked = window.FluxGoogle?.isGoogleLinked?.() ?? !!window.gmailToken;
    if (!linked) {
      host.innerHTML = `<div class="flux-classroom-empty">Sign in with Google to sync Classroom.</div>`;
      return;
    }

    const data = hubData();
    const status = data?.fetchedAt
      ? `Last sync: ${
          typeof window.fluxFmtStaffDateTime === 'function'
            ? window.fluxFmtStaffDateTime(data.fetchedAt)
            : typeof window.fmtFluxDate === 'function'
              ? window.fmtFluxDate(data.fetchedAt, 'short')
              : new Date(data.fetchedAt).toLocaleString()
        } · ${(data.courses || []).length} classes`
      : 'Not synced yet — pull courses and assignments from Google Classroom.';

    const courses = data?.courses || [];
    const filter = load(LS_COURSE_FILTER, 'all');
    const rows = filteredWork();

    const courseOpts =
      `<option value="all"${filter === 'all' ? ' selected' : ''}>All classes</option>` +
      courses.map((c) => `<option value="${esc(c.id)}"${String(filter) === String(c.id) ? ' selected' : ''}>${esc(c.name || c.section || 'Class')}</option>`).join('');

    const table =
      rows.length === 0
        ? `<div class="flux-classroom-empty">${data ? 'No coursework in this filter.' : 'Tap Sync Classroom to load assignments.'}</div>`
        : `<div class="flux-classroom-table-wrap"><table class="flux-classroom-table"><thead><tr>
        <th>Assignment</th><th>Class</th><th>Due</th><th>Grade</th><th></th>
      </tr></thead><tbody>${rows
          .map((w) => {
            const sub = data.submissions?.[`${w.courseId}_${w.id}`];
            const exists = workTaskExists(w.courseId, w.id);
            const due = dueFromWork(w) || '—';
            return `<tr>
            <td class="flux-classroom-title" title="${esc(w.title || '')}">${esc(w.title || 'Untitled')}</td>
            <td>${esc(w.courseName || '')}</td>
            <td>${esc(due)}</td>
            <td class="flux-classroom-grade ${gradeClass(sub)}">${esc(gradeLabel(sub))}</td>
            <td><button type="button" class="flux-classroom-add${exists ? ' flux-classroom-add--done' : ''}" data-cr-course="${esc(w.courseId)}" data-cr-work="${esc(w.id)}" ${exists ? 'disabled' : ''}>${exists ? '✓ In Flux' : '+ Flux'}</button></td>
          </tr>`;
          })
          .join('')}</tbody></table></div>`;

    host.innerHTML = `
      <div class="flux-classroom-sync g-hub-import-card">
        <div class="flux-classroom-head">
          <h3>Google Classroom</h3>
          <span class="flux-classroom-status">${esc(status)}</span>
        </div>
        <p class="g-hub-muted">Import classes, assignments, and your grades into Flux tasks — read-only sync.</p>
        <div class="flux-classroom-actions">
          <button type="button" class="flux-classroom-btn-primary" id="fluxCrSyncBtn">↻ Sync Classroom</button>
          <button type="button" id="fluxCrImportBtn">Import dated (new)</button>
          <button type="button" id="fluxCrScopeBtn">Reconnect scopes</button>
        </div>
        <div class="flux-classroom-filter">
          <label for="fluxCrCourseFilter" style="font-size:.7rem;color:var(--muted)">Filter by class</label>
          <select id="fluxCrCourseFilter" style="margin-top:4px">${courseOpts}</select>
        </div>
        ${table}
        <p class="flux-classroom-foot">Grades reflect your student submission when available. Classroom API requires Google sign-in with Classroom scopes.</p>
      </div>`;

    host.querySelector('#fluxCrSyncBtn')?.addEventListener('click', async () => {
      const btn = host.querySelector('#fluxCrSyncBtn');
      if (btn) btn.disabled = true;
      const st = host.querySelector('.flux-classroom-status');
      if (st) st.textContent = 'Syncing…';
      const res = await refreshHub({ quiet: true });
      if (btn) btn.disabled = false;
      if (!res.ok) {
        if (res.needsScope || res.expired) {
          if (confirm('Classroom permission needed. Reconnect Google now?')) reconnect();
        } else if (res.needsSignIn) toast('Sign in with Google first', 'warning');
        else toast(res.error || 'Sync failed', 'error');
      }
      render(host);
    });

    host.querySelector('#fluxCrImportBtn')?.addEventListener('click', () => importAllNew());
    host.querySelector('#fluxCrScopeBtn')?.addEventListener('click', () => reconnect());
    host.querySelector('#fluxCrCourseFilter')?.addEventListener('change', (e) => {
      save(LS_COURSE_FILTER, e.target.value);
      render(host);
    });

    host.querySelectorAll('[data-cr-course]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const courseId = btn.getAttribute('data-cr-course');
        const workId = btn.getAttribute('data-cr-work');
        if (addWorkToPlanner(courseId, workId)) render(host);
      });
    });
  }

  function install() {
    return enabled();
  }

  window.FluxClassroomSync = {
    enabled,
    install,
    render,
    refreshHub,
    addWorkToPlanner,
    workTaskExists,
    reconnect,
    hubData,
  };
  window.fluxReconnectGoogleClassroom = reconnect;
  window.addClassroomWorkToPlanner = addWorkToPlanner;
})();
