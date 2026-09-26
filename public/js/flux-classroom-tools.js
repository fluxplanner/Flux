/**
 * FluxClassroomTools — classroom productivity (work scope, school DB + local state).
 * Quick-Grade buckets (local), accommodation cheat-sheet, parent contact log.
 */
(function () {
  'use strict';

  const BUCKET_KEY = 'flux_quick_grade_buckets_v1';
  const PICKER_KEY = 'flux_student_picker_state_v1';
  const HALL_KEY = 'flux_hall_pass_registry_v1';
  const GROUP_KEY = 'flux_group_maker_v1';
  const DISMISS_ALERT_KEY = 'flux_class_alert_dismissed_v1';
  const BUCKETS = ['To grade', 'Graded', 'Need feedback', 'Sent back'];
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
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function fluxAsk(label, defaultVal, opts) {
    const fp = window.FluxMagic?.prompt;
    if (fp) return fp(label, defaultVal, opts);
    const v = prompt(label, defaultVal);
    return v == null ? null : v;
  }

  async function fluxAskForm(title, fields, opts) {
    const ff = window.FluxMagic?.form;
    if (ff) return ff(title, fields, opts);
    const out = {};
    for (const f of fields) {
      const v = prompt(f.label, f.value || '');
      if (v == null) return null;
      if (f.required && !v.trim()) return null;
      out[f.key || f.label] = v.trim();
    }
    return out;
  }

  function fmtT(input) {
    if (typeof window.fluxFmtStaffTime === 'function') return window.fluxFmtStaffTime(input);
    if (typeof window.fluxFormatTime === 'function') return window.fluxFormatTime(input);
    const d = input instanceof Date ? input : new Date(input);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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

  function moveBucketCard(data, fromCol, cardId, toCol) {
    const list = data.columns[fromCol];
    if (!list) return false;
    const idx = list.findIndex((c) => String(c.id) === String(cardId));
    if (idx < 0) return false;
    const [card] = list.splice(idx, 1);
    if (!data.columns[toCol]) data.columns[toCol] = [];
    data.columns[toCol].push(card);
    return true;
  }

  function wireQuickGradeDrop(drop, col, data, mount) {
    let dragDepth = 0;
    drop.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragDepth += 1;
      drop.classList.add('flux-qg-drop--over');
    });
    drop.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    drop.addEventListener('dragleave', () => {
      dragDepth -= 1;
      if (dragDepth <= 0) {
        dragDepth = 0;
        drop.classList.remove('flux-qg-drop--over');
      }
    });
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      dragDepth = 0;
      drop.classList.remove('flux-qg-drop--over');
      const from = e.dataTransfer.getData('text/plain');
      if (!from) return;
      const sep = from.indexOf('::');
      if (sep < 0) return;
      const fromCol = from.slice(0, sep);
      const cardId = from.slice(sep + 2);
      if (!moveBucketCard(data, fromCol, cardId, col)) return;
      saveBuckets(data);
      renderQuickGrade(mount);
    });
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
        <div class="flux-qg-col-title">${esc(col)}<span class="flux-qg-count">${(data.columns[col] || []).length}</span></div>
        <div class="flux-qg-drop" data-drop="${esc(col)}"></div>
      </div>`
    ).join('');

    BUCKETS.forEach((col) => {
      const drop = board.querySelector(`[data-drop="${col}"]`);
      (data.columns[col] || []).forEach((card) => {
        drop.appendChild(cardEl(card, col, data, mount));
      });
      wireQuickGradeDrop(drop, col, data, mount);
    });

    mount.querySelector('.flux-qg-add')?.addEventListener('click', async () => {
      const title = await fluxAsk('Assignment title', '', { placeholder: 'e.g. Chapter 4 quiz' });
      if (!title) return;
      data.columns['To grade'].push({ id: Date.now(), title: title.trim() });
      saveBuckets(data);
      renderQuickGrade(mount);
    });
  }

  /* Cards could only be dragged, and a phone or tablet has no drag and drop —
     so on the device a teacher actually carries round the room a card could
     never leave "To grade", and nothing could ever be removed. The arrow moves
     a card on to the next bucket (Sent back wraps round to To grade, since a
     resubmission needs grading again) and × takes it off the board. */
  function cardEl(card, col, data, mount) {
    const el = document.createElement('div');
    el.className = 'flux-qg-card';
    el.draggable = true;
    const next = BUCKETS[(BUCKETS.indexOf(col) + 1) % BUCKETS.length];
    el.innerHTML = `<span class="flux-qg-card-title">${esc(card.title)}</span>
      <button type="button" class="flux-qg-card-btn" data-qg-next title="Move to ${esc(next)}" aria-label="Move ${esc(card.title)} to ${esc(next)}">→</button>
      <button type="button" class="flux-qg-card-btn flux-qg-card-x" data-qg-del title="Remove" aria-label="Remove ${esc(card.title)}">×</button>`;
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', `${col}::${card.id}`);
      e.dataTransfer.effectAllowed = 'move';
    });
    el.querySelector('[data-qg-next]').addEventListener('click', () => {
      if (!moveBucketCard(data, col, card.id, next)) return;
      saveBuckets(data);
      renderQuickGrade(mount);
    });
    el.querySelector('[data-qg-del]').addEventListener('click', () => {
      const list = data.columns[col] || [];
      const i = list.findIndex((c) => String(c.id) === String(card.id));
      if (i < 0) return;
      list.splice(i, 1);
      saveBuckets(data);
      renderQuickGrade(mount);
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
      const manual = await fluxAsk(label + ' (student user ID)', '', { placeholder: 'Paste student user ID' });
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
      const vals = await fluxAskForm('Add need-to-know', [
        { key: 'need', label: 'Need-to-know (one line)', value: '', required: true, placeholder: 'e.g. Extended time on tests' },
        {
          key: 'category',
          label: 'Category',
          value: '504',
          type: 'select',
          options: [
            { value: 'iep', label: 'IEP' },
            { value: '504', label: '504' },
            { value: 'ell', label: 'ELL' },
            { value: 'health', label: 'Health' },
            { value: 'other', label: 'Other' },
          ],
        },
      ], { okLabel: 'Save' });
      if (!vals) return;
      const need = vals.need;
      const cat = (vals.category || 'other').toLowerCase();
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
      const vals = await fluxAskForm('Log parent contact', [
        {
          key: 'channel',
          label: 'Channel',
          value: 'email',
          type: 'select',
          options: [
            { value: 'call', label: 'Call' },
            { value: 'email', label: 'Email' },
            { value: 'text', label: 'Text' },
            { value: 'in_person', label: 'In person' },
          ],
        },
        { key: 'summary', label: 'Summary', value: '', required: true, placeholder: 'Brief conversation notes' },
      ], { okLabel: 'Log contact' });
      if (!vals) return;
      const channel = (vals.channel || 'email').toLowerCase();
      const summary = vals.summary;
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

  /**
   * Random student picker.
   *
   * Names come from the teacher's own timetable — typed or pasted, one per
   * line. This could previously only read the join-code roster table, so it
   * worked only for classes where the students had signed up for Flux
   * themselves. In a real room that is almost none of them, so the widget had
   * nothing to pick from and said "Load roster first" forever.
   *
   * "Fair" means a full rotation, not a short cooldown: everyone is called
   * once before anyone is called twice. Skipping only the last three still
   * lets the same student come up three times in a row in a class of thirty,
   * which is the exact unfairness the feature exists to remove.
   */
  function renderStudentPicker(mount) {
    const saved = ls(PICKER_KEY, {});
    const rounds = saved && typeof saved.rounds === 'object' && saved.rounds ? saved.rounds : {};

    const classesOf = () => {
      try { return window.FluxTeacherClasses?.mine?.() || []; } catch (e) { return []; }
    };
    const selectedId = () => mount.querySelector('#fluxPickerClass')?.value || '';
    const classOf = (id) => classesOf().find((c) => String(c.id) === String(id)) || null;

    function paint() {
      const list = classesOf();
      const cur = classOf(selectedId()) || list[0] || null;
      const names = cur ? (cur.students || []) : [];
      const called = ((cur && rounds[cur.id]) || []).filter((n) => names.includes(n));

      mount.innerHTML = `
        ${list.length
          ? `<select class="flux-picker-class" id="fluxPickerClass" aria-label="Class">
              ${list.map((c) => `<option value="${esc(String(c.id))}"${cur && String(c.id) === String(cur.id) ? ' selected' : ''}>${esc(c.periodLabel || 'P' + c.period)} · ${esc(c.name)}</option>`).join('')}
            </select>`
          : `<p class="flux-widget-hint">Add the classes you teach in <a href="javascript:nav('school')">School Info</a> first.</p>`}
        ${list.length && !names.length
          ? `<p class="flux-widget-hint">No names for this class yet. Paste your class list below — one name per line.</p>`
          : ''}
        ${names.length
          ? `<p class="flux-widget-hint">${names.length} name${names.length === 1 ? '' : 's'} · ${called.length} called this round</p>`
          : ''}
        <button type="button" class="btn" id="fluxPickerSpin" style="width:100%"${names.length ? '' : ' disabled'}>Pick student</button>
        <div id="fluxPickerResult" class="flux-picker-result"></div>
        <div style="display:flex;gap:6px;margin-top:6px">
          <button type="button" class="btn-sec" id="fluxPickerEdit" style="flex:1;font-size:.72rem"${list.length ? '' : ' disabled'}>${names.length ? 'Edit names' : 'Add names'}</button>
          <button type="button" class="btn-sec" id="fluxPickerReset" style="flex:1;font-size:.72rem"${called.length ? '' : ' disabled'}>New round</button>
        </div>
        <div id="fluxPickerEditor" hidden>
          <textarea id="fluxPickerNames" class="flux-picker-names" rows="6" placeholder="One name per line">${esc(names.join('\n'))}</textarea>
          <button type="button" class="btn-sec" id="fluxPickerSave" style="width:100%;font-size:.72rem">Save names</button>
        </div>`;

      mount.querySelector('#fluxPickerClass')?.addEventListener('change', paint);

      mount.querySelector('#fluxPickerEdit')?.addEventListener('click', () => {
        const ed = mount.querySelector('#fluxPickerEditor');
        if (ed) ed.hidden = !ed.hidden;
      });

      mount.querySelector('#fluxPickerSave')?.addEventListener('click', () => {
        const c = classOf(selectedId());
        if (!c) return;
        const raw = mount.querySelector('#fluxPickerNames')?.value || '';
        const list2 = window.FluxTeacherClasses?.setStudents?.(c.id, raw) || [];
        // A changed list invalidates the round: a name that is gone must not
        // keep counting as "already called".
        rounds[c.id] = (rounds[c.id] || []).filter((n) => list2.includes(n));
        lsSet(PICKER_KEY, { rounds });
        if (typeof showToast === 'function') showToast(`Saved ${list2.length} names`, 'success');
        paint();
      });

      mount.querySelector('#fluxPickerReset')?.addEventListener('click', () => {
        const c = classOf(selectedId());
        if (!c) return;
        rounds[c.id] = [];
        lsSet(PICKER_KEY, { rounds });
        paint();
      });

      mount.querySelector('#fluxPickerSpin')?.addEventListener('click', () => {
        const c = classOf(selectedId());
        if (!c) return;
        const pool = c.students || [];
        if (!pool.length) return;
        let done = (rounds[c.id] || []).filter((n) => pool.includes(n));
        let eligible = pool.filter((n) => !done.includes(n));
        let wrapped = false;
        if (!eligible.length) { done = []; eligible = pool.slice(); wrapped = true; }
        const pick = eligible[Math.floor(Math.random() * eligible.length)];
        rounds[c.id] = done.concat([pick]);
        lsSet(PICKER_KEY, { rounds });
        paint();
        const res = mount.querySelector('#fluxPickerResult');
        if (res) {
          res.innerHTML = `<div class="flux-picker-name">${esc(pick)}</div>
            <div class="flux-picker-meta">${wrapped
              ? 'Everyone has had a turn — new round'
              : (pool.length - rounds[c.id].length) + ' left this round'}</div>`;
        }
      });
    }

    paint();
  }

  /**
   * Split a list into groups whose sizes differ by at most one.
   *
   * mode 'size': groups of at most n (26 in groups of 4 is five 4s and two 3s,
   * never six 4s and a lonely 2). mode 'count': exactly n groups, or one per
   * name when there are fewer names than that. Pure, so the unit test can pin
   * the arithmetic without a DOM.
   */
  function makeGroups(names, mode, n, rand) {
    const list = (names || []).filter(Boolean).slice();
    const r = typeof rand === 'function' ? rand : Math.random;
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = list[i]; list[i] = list[j]; list[j] = t;
    }
    const k = Math.max(1, Math.floor(Number(n) || 0));
    if (!list.length) return [];
    const count = mode === 'count' ? Math.min(k, list.length) : Math.ceil(list.length / k);
    const groups = Array.from({ length: count }, () => []);
    list.forEach((name, i) => groups[i % count].push(name));
    return groups;
  }

  /**
   * Group maker. Reads the same class lists as the student picker, so there is
   * one list per class to keep up to date, and keeps the last split per class
   * so a reload mid-lesson does not reshuffle the room.
   */
  function renderGroupMaker(mount) {
    const state = ls(GROUP_KEY, {});
    if (!state.last || typeof state.last !== 'object') state.last = {};
    const mode = () => (state.mode === 'count' ? 'count' : 'size');
    const classesOf = () => {
      try { return window.FluxTeacherClasses?.mine?.() || []; } catch (e) { return []; }
    };
    let curId = state.classId || '';

    function groupsText(groups) {
      return groups.map((g, i) => `Group ${i + 1}: ${g.join(', ')}`).join('\n');
    }

    function paint() {
      const list = classesOf();
      const cur = list.find((c) => String(c.id) === String(curId)) || list[0] || null;
      curId = cur ? String(cur.id) : '';
      const names = cur ? (cur.students || []) : [];
      const n = Math.max(2, Math.min(12, Math.floor(Number(state.n) || (mode() === 'count' ? 4 : 3))));
      const last = cur && state.last[cur.id] && Array.isArray(state.last[cur.id].groups)
        // A name removed from the list since must not come back in a group.
        ? state.last[cur.id].groups.map((g) => g.filter((x) => names.includes(x))).filter((g) => g.length)
        : [];

      mount.innerHTML = `
        ${list.length
          ? `<select class="flux-picker-class" id="fluxGroupClass" aria-label="Class">
              ${list.map((c) => `<option value="${esc(String(c.id))}"${cur && String(c.id) === String(cur.id) ? ' selected' : ''}>${esc(c.periodLabel || 'P' + c.period)} · ${esc(c.name)}</option>`).join('')}
            </select>`
          : `<p class="flux-widget-hint">Add the classes you teach in <a href="javascript:nav('school')">School Info</a> first.</p>`}
        ${list.length && !names.length
          ? `<p class="flux-widget-hint">No names for this class yet. Paste your class list — one name per line.</p>`
          : ''}
        <div class="flux-gm-row">
          <div class="flux-gm-seg" role="radiogroup" aria-label="Split by">
            <button type="button" role="radio" data-gm-mode="size" aria-checked="${mode() === 'size'}" class="flux-gm-segbtn${mode() === 'size' ? ' on' : ''}">Groups of</button>
            <button type="button" role="radio" data-gm-mode="count" aria-checked="${mode() === 'count'}" class="flux-gm-segbtn${mode() === 'count' ? ' on' : ''}">Number of groups</button>
          </div>
          <div class="flux-gm-step" aria-label="${mode() === 'count' ? 'Number of groups' : 'People per group'}">
            <button type="button" class="flux-gm-stepbtn" data-gm-step="-1" aria-label="Fewer"${n <= 2 ? ' disabled' : ''}>−</button>
            <output id="fluxGroupN">${n}</output>
            <button type="button" class="flux-gm-stepbtn" data-gm-step="1" aria-label="More"${n >= 12 ? ' disabled' : ''}>+</button>
          </div>
        </div>
        <button type="button" class="btn" id="fluxGroupMake" style="width:100%"${names.length >= 2 ? '' : ' disabled'}>${last.length ? 'Shuffle again' : 'Make groups'}</button>
        <div class="flux-gm-out" id="fluxGroupOut">${last.map((g, i) => `
          <div class="flux-gm-group" style="--i:${i}">
            <div class="flux-gm-group-h">Group ${i + 1}<span>${g.length}</span></div>
            <div class="flux-gm-names">${g.map((x) => `<span>${esc(x)}</span>`).join('')}</div>
          </div>`).join('')}</div>
        <div style="display:flex;gap:6px;margin-top:6px">
          ${last.length ? `<button type="button" class="btn-sec" id="fluxGroupCopy" style="flex:1;font-size:.72rem">Copy groups</button>` : ''}
          ${list.length ? `<button type="button" class="btn-sec" id="fluxGroupEdit" style="flex:1;font-size:.72rem">${names.length ? 'Edit names' : 'Add names'}</button>` : ''}
        </div>
        <div id="fluxGroupEditor" hidden>
          <textarea id="fluxGroupNames" class="flux-picker-names" rows="6" placeholder="One name per line">${esc(names.join('\n'))}</textarea>
          <button type="button" class="btn-sec" id="fluxGroupSave" style="width:100%;font-size:.72rem">Save names</button>
        </div>`;

      mount.querySelector('#fluxGroupClass')?.addEventListener('change', (e) => {
        curId = e.target.value;
        state.classId = curId;
        lsSet(GROUP_KEY, state);
        paint();
      });
      mount.querySelectorAll('[data-gm-mode]').forEach((b) => b.addEventListener('click', () => {
        if (state.mode === b.dataset.gmMode) return;
        state.mode = b.dataset.gmMode;
        lsSet(GROUP_KEY, state);
        paint();
      }));
      mount.querySelectorAll('[data-gm-step]').forEach((b) => b.addEventListener('click', () => {
        state.n = Math.max(2, Math.min(12, n + Number(b.dataset.gmStep)));
        lsSet(GROUP_KEY, state);
        paint();
      }));
      mount.querySelector('#fluxGroupMake')?.addEventListener('click', () => {
        if (!cur || names.length < 2) return;
        state.last[cur.id] = { groups: makeGroups(names, mode(), n), at: Date.now() };
        state.classId = String(cur.id);
        lsSet(GROUP_KEY, state);
        paint();
      });
      // The same list the student picker reads, so editing it here updates both.
      mount.querySelector('#fluxGroupEdit')?.addEventListener('click', () => {
        const ed = mount.querySelector('#fluxGroupEditor');
        if (ed) ed.hidden = !ed.hidden;
      });
      mount.querySelector('#fluxGroupSave')?.addEventListener('click', () => {
        if (!cur) return;
        const raw = mount.querySelector('#fluxGroupNames')?.value || '';
        const saved = window.FluxTeacherClasses?.setStudents?.(cur.id, raw) || [];
        if (typeof showToast === 'function') showToast(`Saved ${saved.length} names`, 'success');
        paint();
      });
      mount.querySelector('#fluxGroupCopy')?.addEventListener('click', async () => {
        const text = groupsText(last);
        try {
          await navigator.clipboard.writeText(text);
          if (typeof showToast === 'function') showToast('Groups copied — paste them into your slides', 'success');
        } catch (e) {
          if (typeof showToast === 'function') showToast('Could not copy — select the groups and copy them instead', 'warning');
        }
      });
    }

    paint();
  }

  /* This was a second, worse countdown: a local `remaining` counter decremented
     by setInterval every 1000ms. Two faults, and the second is the one that
     matters in a classroom. It drifted, because setInterval is not a clock;
     and browsers throttle or stop background intervals, so projecting it and
     switching to your slides quietly froze it. A timer that stops without
     saying so is worse than no timer.
     The Timer tab's countdown works from an absolute deadline, survives a
     locked lid, chimes, and already has a full-screen view built to be read
     from across a room. So this card starts that one rather than copy it. */
  function renderClassroomTimer(mount) {
    const PRESETS = [
      [120, '2 min'],
      [300, '5 min'],
      [600, '10 min'],
      [900, '15 min'],
    ];
    mount.innerHTML = `
      <p class="flux-widget-hint">Pick a length — it opens full screen, big enough to read from the back of the room.</p>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${PRESETS.map(([secs, label]) =>
          `<button type="button" class="btn-sec flux-timer-preset" data-secs="${secs}">${label}</button>`,
        ).join('')}
      </div>
      <p class="flux-widget-hint" style="margin-top:10px">Escape closes it. It keeps counting while you're on your slides, and chimes when it's up.</p>`;

    mount.querySelectorAll('.flux-timer-preset').forEach((b) => {
      b.addEventListener('click', () => {
        const secs = parseInt(b.getAttribute('data-secs'), 10) || 300;
        const T = window.FluxTimeTools;
        if (!T || typeof T.startCountdown !== 'function') {
          if (typeof showToast === 'function') showToast('Timer unavailable — open the Timer tab', 'warning');
          return;
        }
        T.startCountdown(secs * 1000, 'Classroom timer');
        // Has to stay inside the click handler: requestFullscreen is only
        // granted during a user gesture.
        try { T.openFocusFullscreen('countdown'); } catch (_) {}
      });
    });
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
            <span class="flux-hall-time">${esc(fmtT(e.out_at))}</span>
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
        label = (await fluxAsk('Student name', '', { placeholder: 'Student name' })) || '';
        if (!label) return;
        studentId = 'local_' + Date.now();
      }
      const dest = (await fluxAsk('Destination', 'Bathroom', { placeholder: 'Bathroom, nurse, office…' })) || 'Hall';
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
      <button type="button" class="btn" id="fluxOopsSend" style="width:100%;margin-top:8px">Broadcast now</button>`;

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
      <span class="flux-class-alert-icon" aria-hidden="true"></span>
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
    renderGroupMaker,
    makeGroups,
    renderClassroomTimer,
    renderHallPass,
    renderExitTicket,
    renderOopsBroadcast,
    renderStudentClassAlerts,
    fetchRosterStudents,
    fetchTeacherClasses,
  };
})();
