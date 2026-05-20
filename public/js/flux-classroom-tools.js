/**
 * FluxClassroomTools — classroom productivity (work scope, school DB + local state).
 * Quick-Grade buckets (local), accommodation cheat-sheet, parent contact log.
 */
(function () {
  'use strict';

  const BUCKET_KEY = 'flux_quick_grade_buckets_v1';
  const PICKER_KEY = 'flux_student_picker_state_v1';
  const HALL_KEY = 'flux_hall_pass_registry_v1';
  const DISMISS_ALERT_KEY = 'flux_class_alert_dismissed_v1';
  const BUCKETS = ['To grade', 'Graded', 'Need feedback', 'Sent back'];
  const PICKER_COOLDOWN = 3;
  const EXIT_QUESTIONS = [
    'In one sentence, what was the main idea of today\'s lesson?',
    'What is one question you still have?',
    'How does today\'s topic connect to what we learned last week?',
    'Give an example of the concept we practiced today.',
    'What was the most challenging part of class today?',
  ];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function sb() {
    return typeof getSB === 'function' ? getSB() : null;
  }

  function ls(key, def) {
    if (typeof load === 'function') {
      try {
        return load(key, def);
      } catch (_) {}
    }
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : def;
    } catch (_) {
      return def;
    }
  }

  function lsSet(key, val) {
    if (typeof save === 'function') {
      try {
        save(key, val);
        return;
      } catch (_) {}
    }
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (_) {}
  }

  function schoolName() {
    try {
      return (
        window.FluxRole?.profile?.school ||
        window.FluxSchool?.current?.name ||
        'International Academy East'
      );
    } catch (_) {
      return 'International Academy East';
    }
  }

  function uid() {
    const u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;
    return u?.id || '';
  }

  function loadBuckets() {
    const data = ls(BUCKET_KEY, { columns: {} });
    BUCKETS.forEach((b) => {
      if (!data.columns[b]) data.columns[b] = [];
    });
    return data;
  }

  function saveBuckets(data) {
    lsSet(BUCKET_KEY, data);
  }

  function renderQuickGrade(mount) {
    const data = loadBuckets();
    mount.innerHTML = `
      <p class="flux-widget-hint">Drag assignments between buckets. Stored on this device only.</p>
      <div class="flux-qg-board" id="fluxQgBoard"></div>
      <button type="button" class="btn-sec flux-qg-add" style="margin-top:8px;font-size:.72rem">+ Add assignment card</button>`;

    const board = mount.querySelector('#fluxQgBoard');
    board.innerHTML = BUCKETS.map(
      (col) => `
      <div class="flux-qg-col" data-col="${esc(col)}">
        <div class="flux-qg-col-title">${esc(col)}</div>
        <div class="flux-qg-drop" data-drop="${esc(col)}"></div>
      </div>`
    ).join('');

    BUCKETS.forEach((col) => {
      const drop = board.querySelector(`[data-drop="${col}"]`);
      (data.columns[col] || []).forEach((card, idx) => {
        drop.appendChild(cardEl(card, col, idx));
      });
      drop.addEventListener('dragover', (e) => {
        e.preventDefault();
        drop.classList.add('flux-qg-drop--over');
      });
      drop.addEventListener('dragleave', () => drop.classList.remove('flux-qg-drop--over'));
      drop.addEventListener('drop', (e) => {
        e.preventDefault();
        drop.classList.remove('flux-qg-drop--over');
        const from = e.dataTransfer.getData('text/plain');
        if (!from) return;
        const [fc, fi] = from.split('::');
        const card = data.columns[fc]?.splice(parseInt(fi, 10), 1)[0];
        if (card) {
          data.columns[col].push(card);
          saveBuckets(data);
          renderQuickGrade(mount);
        }
      });
    });

    mount.querySelector('.flux-qg-add')?.addEventListener('click', () => {
      const title = prompt('Assignment title');
      if (!title) return;
      data.columns['To grade'].push({ id: Date.now(), title: title.trim() });
      saveBuckets(data);
      renderQuickGrade(mount);
    });
  }

  function cardEl(card, col, idx) {
    const el = document.createElement('div');
    el.className = 'flux-qg-card';
    el.draggable = true;
    el.textContent = card.title;
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', `${col}::${idx}`);
    });
    return el;
  }

  async function fetchRosterStudents() {
    const client = sb();
    const id = uid();
    if (!client || !id) return [];
    try {
      const { data, error } = await client
        .from('teacher_students')
        .select('student_id, class_name, class_code')
        .eq('teacher_id', id)
        .limit(120);
      if (error || !data?.length) return [];
      const ids = [...new Set(data.map((r) => r.student_id).filter(Boolean))];
      const { data: roles } = await client
        .from('user_roles')
        .select('user_id, display_name')
        .in('user_id', ids);
      const names = {};
      (roles || []).forEach((r) => {
        names[r.user_id] = r.display_name || 'Student';
      });
      return data.map((r) => ({
        id: r.student_id,
        label: names[r.student_id] || 'Student',
        className: r.class_name || r.class_code || '',
      }));
    } catch (e) {
      console.warn('[FluxClassroomTools] roster', e);
      return [];
    }
  }

  async function pickStudentId(mount, label) {
    const roster = await fetchRosterStudents();
    if (!roster.length) {
      const manual = prompt(label + ' (student user ID)');
      return manual ? manual.trim() : null;
    }
    const sel = document.createElement('select');
    sel.innerHTML =
      `<option value="">— Select student —</option>` +
      roster
        .map(
          (s) =>
            `<option value="${esc(s.id)}">${esc(s.label)}${s.className ? ' · ' + esc(s.className) : ''}</option>`
        )
        .join('');
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'flux-roster-pick';
      wrap.innerHTML = `<label style="font-size:.72rem;display:block;margin-bottom:4px">${esc(label)}</label>`;
      wrap.appendChild(sel);
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:6px;margin-top:6px';
      const ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'btn';
      ok.textContent = 'OK';
      ok.style.fontSize = '.72rem';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'btn-sec';
      cancel.textContent = 'Cancel';
      cancel.style.fontSize = '.72rem';
      row.append(ok, cancel);
      wrap.appendChild(row);
      const prior = mount.querySelector('.flux-roster-pick-overlay');
      if (prior) prior.remove();
      const ov = document.createElement('div');
      ov.className = 'flux-roster-pick-overlay';
      ov.appendChild(wrap);
      mount.appendChild(ov);
      ok.onclick = () => {
        ov.remove();
        resolve(sel.value || null);
      };
      cancel.onclick = () => {
        ov.remove();
        resolve(null);
      };
    });
  }

  async function fetchAccommodations() {
    const client = sb();
    if (!client || !uid()) return [];
    const { data, error } = await client
      .from('staff_student_accommodations')
      .select('*')
      .eq('school', schoolName())
      .eq('active', true)
      .order('updated_at', { ascending: false })
      .limit(80);
    if (error) {
      console.warn('[FluxClassroomTools] accommodations', error);
      return [];
    }
    return data || [];
  }

  async function renderAccommodations(mount) {
    mount.innerHTML = '<p class="flux-widget-hint">Loading need-to-know accommodations…</p>';
    const rows = await fetchAccommodations();
    const classes = (window.classes || []).slice();
    const period = classes.length ? `Period ${classes[0].period} — ${classes[0].name}` : '';

    mount.innerHTML = `
      <p class="flux-widget-hint">Private need-to-know summary — not full IEP documents. ${esc(period)}</p>
      <button type="button" class="btn-sec" style="font-size:.72rem;margin-bottom:8px" id="fluxAccomAdd">+ Add need-to-know</button>
      <div class="flux-accom-list" id="fluxAccomList"></div>`;

    const list = mount.querySelector('#fluxAccomList');
    if (!rows.length) {
      list.innerHTML = '<p class="flux-widget-planned">No accommodations on file yet.</p>';
    } else {
      list.innerHTML = rows
        .map(
          (r) => `
        <div class="flux-accom-card">
          <div class="flux-accom-cat">${esc(r.category)}</div>
          <div class="flux-accom-student">Student ${esc(String(r.student_id).slice(0, 8))}</div>
          <div class="flux-accom-body">${esc(r.need_to_know)}</div>
          ${r.period_context ? `<div class="flux-accom-meta">${esc(r.period_context)}</div>` : ''}
        </div>`
        )
        .join('');
    }

    mount.querySelector('#fluxAccomAdd')?.addEventListener('click', async () => {
      const studentId = await pickStudentId(mount, 'Student');
      if (!studentId) return;
      const need = prompt('Need-to-know (one line for cheat-sheet)');
      if (!need) return;
      const cat = (prompt('Category: iep / 504 / ell / health / other', '504') || 'other').toLowerCase();
      const client = sb();
      if (!client) return;
      const { error } = await client.from('staff_student_accommodations').insert({
        school: schoolName(),
        student_id: studentId.trim(),
        author_id: uid(),
        period_context: period,
        category: cat,
        need_to_know: need.trim(),
        details_json: [],
      });
      if (error) {
        if (typeof showToast === 'function') showToast(error.message, 'error');
        return;
      }
      if (typeof showToast === 'function') showToast('Accommodation saved', 'success');
      renderAccommodations(mount);
    });
  }

  async function renderParentLog(mount) {
    mount.innerHTML = `
      <p class="flux-widget-hint">One-click log — timestamped on the student record (school DB).</p>
      <button type="button" class="btn" id="fluxParentLogBtn" style="width:100%;font-size:.78rem">Log parent contact</button>
      <div id="fluxParentLogRecent" style="margin-top:10px;font-size:.72rem;color:var(--muted2)"></div>`;

    mount.querySelector('#fluxParentLogBtn')?.addEventListener('click', async () => {
      const studentId = await pickStudentId(mount, 'Student');
      if (!studentId) return;
      const channel = (prompt('Channel: call / email / text / in_person', 'email') || 'email').toLowerCase();
      const summary = prompt('Summary of conversation');
      if (!summary) return;
      const client = sb();
      if (!client) return;
      const { error } = await client.from('staff_parent_contact_logs').insert({
        educator_id: uid(),
        student_id: studentId.trim(),
        school: schoolName(),
        channel,
        summary: summary.trim(),
      });
      if (error) {
        if (typeof showToast === 'function') showToast(error.message, 'error');
        return;
      }
      if (typeof showToast === 'function') showToast('Parent contact logged', 'success');
      const recent = mount.querySelector('#fluxParentLogRecent');
      if (recent) recent.textContent = `Last: ${channel} — ${summary.slice(0, 60)}…`;
    });
  }

  function renderStudentPicker(mount) {
    const state = ls(PICKER_KEY, { history: [] });

    mount.innerHTML = `
      <p class="flux-widget-hint">Fair pick — skips students called in the last ${PICKER_COOLDOWN} rounds.</p>
      <button type="button" class="btn" id="fluxPickerSpin" style="width:100%">🎲 Pick student</button>
      <div id="fluxPickerResult" class="flux-picker-result"></div>
      <button type="button" class="btn-sec" id="fluxPickerLoadRoster" style="width:100%;margin-top:6px;font-size:.72rem">Load names from my classes</button>`;

    mount.querySelector('#fluxPickerLoadRoster')?.addEventListener('click', async () => {
      const roster = await fetchRosterStudents();
      if (!roster.length) {
        if (typeof showToast === 'function') showToast('No enrolled students found', 'warning');
        return;
      }
      lsSet(
        'flux_picker_class_roster_v1',
        roster.map((s) => s.id)
      );
      lsSet('flux_picker_labels_v1', roster.reduce((o, s) => ((o[s.id] = s.label), o), {}));
      if (typeof showToast === 'function') showToast(`Loaded ${roster.length} students`, 'success');
    });

    mount.querySelector('#fluxPickerSpin')?.addEventListener('click', async () => {
      let pool = await fetchRosterStudents();
      if (!pool.length) {
        const labels = ls('flux_picker_labels_v1', {});
        pool = (ls('flux_picker_class_roster_v1', []) || []).map((id) => ({
          id,
          label: labels[id] || id,
        }));
      }
      if (!pool.length) {
        if (typeof showToast === 'function') showToast('Load roster first', 'warning');
        return;
      }
      const recent = (state.history || []).slice(-PICKER_COOLDOWN).map((h) => h.id);
      const eligible = pool.filter((s) => !recent.includes(s.id));
      const pickFrom = eligible.length ? eligible : pool;
      const pick = pickFrom[Math.floor(Math.random() * pickFrom.length)];
      state.history = (state.history || []).concat([{ id: pick.id, at: Date.now() }]).slice(-24);
      lsSet(PICKER_KEY, state);
      const res = mount.querySelector('#fluxPickerResult');
      if (res) {
        res.innerHTML = `<div class="flux-picker-name">${esc(pick.label)}</div>
          <div class="flux-picker-meta">${eligible.length < pool.length ? 'Cooldown applied' : 'Full pool'}</div>`;
      }
    });
  }

  let _classTimerIv = null;
  function renderClassroomTimer(mount) {
    mount.innerHTML = `
      <p class="flux-widget-hint">Visual countdown for timed activities.</p>
      <div class="flux-class-timer-display" id="fluxClassTimerDisplay">5:00</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
        <button type="button" class="btn-sec flux-timer-preset" data-secs="300">5 min</button>
        <button type="button" class="btn-sec flux-timer-preset" data-secs="600">10 min</button>
        <button type="button" class="btn-sec flux-timer-preset" data-secs="120">2 min</button>
      </div>
      <div style="display:flex;gap:6px">
        <button type="button" class="btn" id="fluxClassTimerStart">Start</button>
        <button type="button" class="btn-sec" id="fluxClassTimerStop">Reset</button>
      </div>`;

    let remaining = 300;
    const display = mount.querySelector('#fluxClassTimerDisplay');

    function fmt(sec) {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return m + ':' + String(s).padStart(2, '0');
    }

    function tick() {
      if (!display) return;
      display.textContent = fmt(remaining);
      display.classList.toggle('flux-class-timer-done', remaining <= 0);
      if (remaining <= 0) {
        clearInterval(_classTimerIv);
        _classTimerIv = null;
        if (typeof showToast === 'function') showToast('Time is up', 'info');
        return;
      }
      remaining -= 1;
    }

    mount.querySelectorAll('.flux-timer-preset').forEach((b) => {
      b.addEventListener('click', () => {
        remaining = parseInt(b.getAttribute('data-secs'), 10) || 300;
        if (display) display.textContent = fmt(remaining);
      });
    });
    mount.querySelector('#fluxClassTimerStart')?.addEventListener('click', () => {
      if (_classTimerIv) clearInterval(_classTimerIv);
      _classTimerIv = setInterval(tick, 1000);
      tick();
    });
    mount.querySelector('#fluxClassTimerStop')?.addEventListener('click', () => {
      if (_classTimerIv) clearInterval(_classTimerIv);
      _classTimerIv = null;
      remaining = 300;
      if (display) {
        display.textContent = fmt(remaining);
        display.classList.remove('flux-class-timer-done');
      }
    });
    if (display) display.textContent = fmt(remaining);
  }

  async function fetchTeacherClasses() {
    const client = sb();
    const id = uid();
    if (!client || !id) return [];
    const { data, error } = await client
      .from('teacher_classes')
      .select('id, class_name, class_code')
      .eq('teacher_id', id)
      .eq('active', true)
      .order('class_name');
    if (error) return [];
    return data || [];
  }

  function renderHallPass(mount) {
    const log = ls(HALL_KEY, []);
    const out = log.filter((e) => !e.returned_at);

    function paint() {
      const list = mount.querySelector('#fluxHallPassList');
      if (!list) return;
      list.innerHTML = out.length
        ? out
            .map(
              (e, i) => `
          <div class="flux-hall-row">
            <span>${esc(e.student_label || e.student_id)} → ${esc(e.destination || 'Hall')}</span>
            <span class="flux-hall-time">${esc(new Date(e.out_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))}</span>
            <button type="button" class="btn-sec" data-return="${i}" style="font-size:.65rem">Returned</button>
          </div>`
            )
            .join('')
        : '<p class="flux-widget-planned">No students out right now.</p>';
      list.querySelectorAll('[data-return]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-return'), 10);
          const entry = out[idx];
          if (!entry) return;
          entry.returned_at = Date.now();
          const all = ls(HALL_KEY, []);
          const j = all.findIndex((x) => x.out_at === entry.out_at && x.student_id === entry.student_id);
          if (j >= 0) all[j] = entry;
          lsSet(HALL_KEY, all);
          renderHallPass(mount);
        });
      });
    }

    mount.innerHTML = `
      <p class="flux-widget-hint">Who is out of the room right now (this device only).</p>
      <button type="button" class="btn" id="fluxHallPassOut" style="width:100%;margin-bottom:8px;font-size:.78rem">Log student out</button>
      <div id="fluxHallPassList"></div>`;

    mount.querySelector('#fluxHallPassOut')?.addEventListener('click', async () => {
      const roster = await fetchRosterStudents();
      let studentId = null;
      let label = '';
      if (roster.length) {
        studentId = await pickStudentId(mount, 'Student leaving');
        if (!studentId) return;
        label = roster.find((s) => s.id === studentId)?.label || 'Student';
      } else {
        label = prompt('Student name') || '';
        if (!label) return;
        studentId = 'local_' + Date.now();
      }
      const dest = prompt('Destination (bathroom, nurse, office…)', 'Bathroom') || 'Hall';
      const all = ls(HALL_KEY, []);
      all.push({ student_id: studentId, student_label: label, destination: dest, out_at: Date.now() });
      lsSet(HALL_KEY, all);
      renderHallPass(mount);
    });
    paint();
  }

  function renderExitTicket(mount) {
    mount.innerHTML = `
      <p class="flux-widget-hint">Random check-for-understanding prompt.</p>
      <div class="flux-exit-ticket" id="fluxExitTicketText">Tap generate for a question.</div>
      <button type="button" class="btn" id="fluxExitGen" style="width:100%;margin-top:8px">Generate question</button>`;
    mount.querySelector('#fluxExitGen')?.addEventListener('click', () => {
      const q = EXIT_QUESTIONS[Math.floor(Math.random() * EXIT_QUESTIONS.length)];
      const el = mount.querySelector('#fluxExitTicketText');
      if (el) el.textContent = q;
    });
  }

  async function renderOopsBroadcast(mount) {
    const classes = await fetchTeacherClasses();
    mount.innerHTML = `
      <p class="flux-widget-hint">Sends an <strong>urgent</strong> alert to enrolled students' dashboards (via class announcements).</p>
      <select id="fluxOopsClass" style="width:100%;margin-bottom:8px;font-size:.78rem">
        <option value="">All active classes</option>
        ${classes.map((c) => `<option value="${esc(c.id)}">${esc(c.class_name || c.class_code)}</option>`).join('')}
      </select>
      <input id="fluxOopsTitle" placeholder="Title (e.g. Class moved)" style="width:100%;margin-bottom:6px;font-size:.78rem;padding:8px;border-radius:8px;border:1px solid var(--border2);background:var(--card2);color:var(--text)"/>
      <textarea id="fluxOopsBody" rows="3" placeholder="Message for students" style="width:100%;font-size:.78rem;padding:8px;border-radius:8px;border:1px solid var(--border2);background:var(--card2);color:var(--text)"></textarea>
      <button type="button" class="btn" id="fluxOopsSend" style="width:100%;margin-top:8px">📢 Broadcast now</button>`;

    mount.querySelector('#fluxOopsSend')?.addEventListener('click', async () => {
      const title = (mount.querySelector('#fluxOopsTitle')?.value || 'Class update').trim();
      const body = (mount.querySelector('#fluxOopsBody')?.value || '').trim();
      if (!body) {
        if (typeof showToast === 'function') showToast('Enter a message', 'warning');
        return;
      }
      const classId = mount.querySelector('#fluxOopsClass')?.value || '';
      const targets = classId ? classes.filter((c) => c.id === classId) : classes;
      if (!targets.length) {
        if (typeof showToast === 'function') showToast('No classes to broadcast to', 'warning');
        return;
      }
      const client = sb();
      if (!client) return;
      let ok = 0;
      for (const cls of targets) {
        const { error } = await client.from('teacher_announcements').insert({
          teacher_id: uid(),
          class_id: cls.id,
          title: title.startsWith('📢') ? title : '📢 ' + title,
          content: body,
          priority: 'urgent',
          visible: true,
        });
        if (!error) ok += 1;
      }
      if (typeof showToast === 'function') {
        showToast(
          ok ? `Broadcast sent to ${ok} class${ok === 1 ? '' : 'es'}` : 'Broadcast failed',
          ok ? 'success' : 'error'
        );
      }
    });
  }

  async function renderStudentClassAlerts() {
    try {
      if (typeof FluxRole === 'undefined' || !FluxRole.isStudent?.()) return;
    } catch (_) {
      return;
    }
    const banner = document.getElementById('fluxClassAlertBanner');
    if (!banner || !currentUser) return;
    const client = sb();
    if (!client) return;

    const dismissed = ls(DISMISS_ALERT_KEY, []);
    const { data: codes } = await client
      .from('student_class_codes')
      .select('class_code')
      .eq('student_id', currentUser.id);
    const classCodes = [...new Set((codes || []).map((c) => c.class_code).filter(Boolean))];
    if (!classCodes.length) {
      banner.style.display = 'none';
      return;
    }

    const { data: classes } = await client
      .from('teacher_classes')
      .select('id')
      .in('class_code', classCodes);
    const classIds = (classes || []).map((c) => c.id).filter(Boolean);
    if (!classIds.length) {
      banner.style.display = 'none';
      return;
    }

    const since = new Date(Date.now() - 72 * 3600000).toISOString();
    const { data: alerts } = await client
      .from('teacher_announcements')
      .select('id, title, content, created_at')
      .in('class_id', classIds)
      .eq('priority', 'urgent')
      .eq('visible', true)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5);

    const visible = (alerts || []).filter((a) => !dismissed.includes(a.id));
    if (!visible.length) {
      banner.style.display = 'none';
      return;
    }

    const top = visible[0];
    banner.style.display = 'flex';
    banner.innerHTML = `
      <span class="flux-class-alert-icon" aria-hidden="true">📢</span>
      <div class="flux-class-alert-body">
        <strong>${esc(top.title)}</strong>
        <p>${esc(top.content)}</p>
      </div>
      <button type="button" class="flux-class-alert-dismiss" data-id="${esc(top.id)}" aria-label="Dismiss">✕</button>`;
    banner.querySelector('.flux-class-alert-dismiss')?.addEventListener('click', () => {
      const id = top.id;
      const d = ls(DISMISS_ALERT_KEY, []);
      if (!d.includes(id)) d.push(id);
      lsSet(DISMISS_ALERT_KEY, d);
      banner.style.display = 'none';
    });
  }

  window.FluxClassroomTools = {
    renderQuickGrade,
    renderAccommodations,
    renderParentLog,
    renderStudentPicker,
    renderClassroomTimer,
    renderHallPass,
    renderExitTicket,
    renderOopsBroadcast,
    renderStudentClassAlerts,
    fetchRosterStudents,
    fetchTeacherClasses,
  };
})();
