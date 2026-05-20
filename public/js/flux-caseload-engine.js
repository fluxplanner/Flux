/**
 * FluxCaseloadEngine — counselor caseload widgets: meeting logs, wellness queue,
 * crisis cheat-sheet, referrals. Flag: enable_caseload_engine
 */
(function () {
  'use strict';

  const CRISIS_STEPS = [
    { t: 'Stay with the student', d: 'Do not leave them alone if there is immediate risk. Call for another adult if needed.' },
    { t: 'Assess immediate safety', d: 'Ask directly: “Are you thinking about hurting yourself?” Document their words.' },
    { t: 'Notify crisis lead', d: 'Contact your school crisis team / admin on-call per district protocol.' },
    { t: 'Parent/guardian', d: 'Inform guardian when policy requires — use approved scripts.' },
    { t: 'Document privately', d: 'Log in Meeting notes (type: crisis). Do not put clinical details in email.' },
    { t: 'Follow-up within 24h', d: 'Schedule check-in; hand off to school psych if referred.' },
  ];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function fmtD(input, style) {
    if (typeof window.fluxFmtStaffDate === 'function') return window.fluxFmtStaffDate(input, style);
    if (typeof window.fmtFluxDate === 'function') return window.fmtFluxDate(input, style);
    const d = input instanceof Date ? input : new Date(String(input));
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
  }

  function fmtDT(input) {
    if (typeof window.fluxFmtStaffDateTime === 'function') return window.fluxFmtStaffDateTime(input);
    return fmtD(input, 'short');
  }

  function sb() {
    return typeof getSB === 'function' ? getSB() : null;
  }

  function uid() {
    const u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;
    return u?.id || '';
  }

  function schoolName() {
    try {
      return window.FluxRole?.profile?.school || 'International Academy East';
    } catch (_) {
      return 'International Academy East';
    }
  }

  function enabled() {
    try {
      return (
        window.FluxFeatureFlags?.isEnabled('enable_staff_productivity_suite', false) &&
        window.FluxFeatureFlags?.isEnabled('enable_caseload_engine', false)
      );
    } catch (_) {
      return false;
    }
  }

  async function counselorRecord() {
    if (typeof ensureCounselorRecord === 'function') {
      const client = sb();
      if (client) return ensureCounselorRecord(client, 'counselor');
    }
    return window._counselorRecord || null;
  }

  async function fetchNotes(limit) {
    const client = sb();
    if (!client || !uid()) return [];
    const { data, error } = await client
      .from('staff_counselor_private_notes')
      .select('id,student_id,occurred_at,meeting_type,note_body,follow_up_on')
      .eq('counselor_user_id', uid())
      .order('occurred_at', { ascending: false })
      .limit(limit || 12);
    if (error) {
      console.warn('[FluxCaseloadEngine]', error);
      return [];
    }
    return data || [];
  }

  async function fetchCheckins(status) {
    const row = await counselorRecord();
    const client = sb();
    if (!row?.id || !client) return [];
    let q = client
      .from('student_counselor_checkins')
      .select('id,student_id,message,severity,status,created_at')
      .eq('counselor_id', row.id)
      .order('created_at', { ascending: false })
      .limit(30);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) {
      console.warn('[FluxCaseloadEngine] checkins', error);
      return [];
    }
    return data || [];
  }

  async function loadStudentNames(ids) {
    const map = {};
    const client = sb();
    if (!client || !ids.length) return map;
    const { data } = await client.from('user_roles').select('user_id,display_name').in('user_id', ids);
    (data || []).forEach((r) => {
      map[r.user_id] = r.display_name || 'Student';
    });
    return map;
  }

  async function fetchCounselorStudents() {
    const row = await counselorRecord();
    const client = sb();
    if (!row?.id || !client) return [];
    const { data: links, error } = await client
      .from('student_counselors')
      .select('student_id')
      .eq('counselor_id', row.id);
    if (error || !links?.length) return [];
    const ids = [...new Set(links.map((l) => l.student_id).filter(Boolean))];
    const names = await loadStudentNames(ids);
    return ids.map((id) => ({ id, label: names[id] || 'Student' }));
  }

  function pickCounselorStudentId(mount, label, students) {
    if (!students.length) {
      const manual = prompt(label + ' (student user ID)');
      return Promise.resolve(manual ? manual.trim() : null);
    }
    return new Promise((resolve) => {
      const prior = mount.querySelector('.flux-roster-pick-overlay');
      if (prior) prior.remove();
      const sel = document.createElement('select');
      sel.style.cssText = 'width:100%;font-size:.75rem;padding:6px;border-radius:8px';
      sel.innerHTML =
        `<option value="">— Select student —</option>` +
        students.map((s) => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('');
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

  function studentSelectHtml(students, id) {
    const opts = students.length
      ? students.map((s) => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('')
      : '<option value="">No assigned students</option>';
    return `<select id="${id}" style="width:100%;font-size:.75rem;padding:6px;border-radius:8px;margin-bottom:6px">${opts}</select>`;
  }

  async function fetchReferrals() {
    const client = sb();
    if (!client || !uid()) return [];
    const { data, error } = await client
      .from('counselor_referrals')
      .select('*')
      .eq('counselor_user_id', uid())
      .order('updated_at', { ascending: false })
      .limit(40);
    if (error) return [];
    return data || [];
  }

  async function renderCaseloadWidget(mount) {
    const newCount = enabled() ? (await fetchCheckins('new')).length : 0;
    mount.innerHTML = `
      <p class="flux-widget-hint">Caseload summary ${newCount ? `<strong class="flux-caseload-warn">${newCount} new check-in${newCount === 1 ? '' : 's'}</strong>` : ''}</p>
      <button type="button" class="btn-sec" style="width:100%;font-size:.78rem" onclick="nav('counselorDashboard')">Open full caseload →</button>`;
    if (window.FluxCounselorCaseload?.enabled?.() && window.FluxCounselorCaseload?.renderCaseloadDashboard) {
      mount.innerHTML += `<button type="button" class="btn" style="width:100%;margin-top:6px;font-size:.72rem" onclick="FluxCounselorCaseload.renderCaseloadDashboard()">Load caseload cards</button>`;
    }
  }

  async function renderMeetingLog(mount) {
    mount.innerHTML = '<p class="flux-widget-hint">Loading private notes…</p>';
    const [notes, students] = await Promise.all([fetchNotes(8), fetchCounselorStudents()]);
    const names = await loadStudentNames(notes.map((n) => n.student_id));

    mount.innerHTML = `
      <p class="flux-widget-hint">RLS-locked private notes — not visible to teachers or students.</p>
      <button type="button" class="btn" id="fluxMeetLogAdd" style="width:100%;font-size:.78rem;margin-bottom:8px">+ Meeting note</button>
      <div id="fluxMeetLogForm" class="flux-caseload-form" hidden>
        ${studentSelectHtml(students, 'fluxMeetStu')}
        <select id="fluxMeetType" style="width:100%;font-size:.75rem;padding:6px;border-radius:8px;margin-bottom:6px">
          <option value="check_in">Check-in</option>
          <option value="crisis">Crisis</option>
          <option value="parent">Parent</option>
          <option value="referral">Referral</option>
        </select>
        <textarea id="fluxMeetBody" rows="3" placeholder="Private narrative…" style="width:100%;font-size:.75rem;padding:6px;border-radius:8px;margin-bottom:6px;border:1px solid var(--border2);background:var(--card2);color:var(--text)"></textarea>
        <div style="display:flex;gap:6px">
          <button type="button" class="btn" id="fluxMeetSave" style="flex:1;font-size:.72rem">Save</button>
          <button type="button" class="btn-sec" id="fluxMeetCancel" style="flex:1;font-size:.72rem">Cancel</button>
        </div>
      </div>
      <div class="flux-meet-log-list"></div>`;

    const list = mount.querySelector('.flux-meet-log-list');
    list.innerHTML = notes.length
      ? notes
          .map(
            (n) => `
        <div class="flux-meet-log-card">
          <div class="flux-meet-log-meta">${esc(n.meeting_type)} · ${esc(fmtDT(n.occurred_at))}</div>
          <div class="flux-meet-log-student">${esc(names[n.student_id] || 'Student')}</div>
          <div class="flux-meet-log-body">${esc((n.note_body || '').slice(0, 200))}${(n.note_body || '').length > 200 ? '…' : ''}</div>
        </div>`
          )
          .join('')
      : '<p class="flux-widget-planned">No meeting notes yet.</p>';

    const form = mount.querySelector('#fluxMeetLogForm');
    mount.querySelector('#fluxMeetLogAdd')?.addEventListener('click', () => {
      if (form) form.hidden = false;
    });
    mount.querySelector('#fluxMeetCancel')?.addEventListener('click', () => {
      if (form) {
        form.hidden = true;
        mount.querySelector('#fluxMeetBody').value = '';
      }
    });
    mount.querySelector('#fluxMeetSave')?.addEventListener('click', async () => {
      let studentId = mount.querySelector('#fluxMeetStu')?.value;
      if (!studentId && students.length) {
        studentId = await pickCounselorStudentId(mount, 'Student', students);
      }
      if (!studentId) {
        if (typeof showToast === 'function') showToast('Select a student', 'warn');
        return;
      }
      const body = (mount.querySelector('#fluxMeetBody')?.value || '').trim();
      if (!body) {
        if (typeof showToast === 'function') showToast('Note body required', 'warn');
        return;
      }
      const type = mount.querySelector('#fluxMeetType')?.value || 'check_in';
      const client = sb();
      if (!client) return;
      const { error } = await client.from('staff_counselor_private_notes').insert({
        counselor_user_id: uid(),
        student_id: studentId,
        school: schoolName(),
        note_body: body,
        meeting_type: type,
        encryption_version: 0,
      });
      if (error) {
        if (typeof showToast === 'function') showToast(error.message, 'error');
        return;
      }
      if (typeof showToast === 'function') showToast('Meeting note saved (private)', 'success');
      renderMeetingLog(mount);
    });
  }

  async function renderWellnessQueue(mount) {
    mount.innerHTML = '<p class="flux-widget-hint">Loading check-ins…</p>';
    const rows = await fetchCheckins(null);
    const names = await loadStudentNames(rows.map((r) => r.student_id));
    const newRows = rows.filter((r) => r.status === 'new');

    mount.innerHTML = `
      <p class="flux-widget-hint">Students flagged they need support (${newRows.length} new).</p>
      <div class="flux-wellness-queue"></div>`;
    const list = mount.querySelector('.flux-wellness-queue');
    const show = newRows.length ? newRows : rows.slice(0, 6);
    list.innerHTML = show.length
      ? show
          .map(
            (r) => `
        <div class="flux-wellness-row flux-wellness-row--${esc(r.severity)}" data-id="${esc(r.id)}">
          <div class="flux-wellness-row-head">
            <strong>${esc(names[r.student_id] || 'Student')}</strong>
            <span class="flux-wellness-sev">${esc(r.severity)}</span>
          </div>
          <p>${esc((r.message || 'No message').slice(0, 120))}</p>
          <div class="flux-wellness-actions">
            ${r.status === 'new' ? `<button type="button" class="btn-sec" data-ack="${esc(r.id)}" style="font-size:.65rem">Acknowledge</button>` : ''}
            <button type="button" class="btn-sec" data-done="${esc(r.id)}" style="font-size:.65rem">Resolve</button>
          </div>
        </div>`
          )
          .join('')
      : '<p class="flux-widget-planned">No check-ins yet.</p>';

    list.querySelectorAll('[data-ack]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const client = sb();
        await client
          ?.from('student_counselor_checkins')
          .update({ status: 'acknowledged', updated_at: new Date().toISOString() })
          .eq('id', btn.getAttribute('data-ack'));
        renderWellnessQueue(mount);
      });
    });
    list.querySelectorAll('[data-done]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const client = sb();
        await client
          ?.from('student_counselor_checkins')
          .update({ status: 'resolved', updated_at: new Date().toISOString() })
          .eq('id', btn.getAttribute('data-done'));
        renderWellnessQueue(mount);
      });
    });
  }

  function renderCrisisCheatSheet(mount) {
    mount.innerHTML = `
      <p class="flux-widget-hint">Need-to-know steps — follow your district policy first.</p>
      <ol class="flux-crisis-steps">
        ${CRISIS_STEPS.map((s) => `<li><strong>${esc(s.t)}</strong><br><span>${esc(s.d)}</span></li>`).join('')}
      </ol>
      <button type="button" class="btn-sec" id="fluxCrisis911" style="width:100%;font-size:.72rem;margin-top:8px">Emergency: call 988 (US)</button>`;
    mount.querySelector('#fluxCrisis911')?.addEventListener('click', () => {
      if (typeof showToast === 'function') showToast('988 Suicide & Crisis Lifeline (US)', 'info', 5000);
    });
  }

  async function renderReferralTracker(mount) {
    const [refs, students] = await Promise.all([fetchReferrals(), fetchCounselorStudents()]);
    const names = await loadStudentNames(refs.map((r) => r.student_id));

    mount.innerHTML = `
      <p class="flux-widget-hint">Internal referral status (school psych, admin, crisis team).</p>
      <button type="button" class="btn" id="fluxRefAdd" style="width:100%;margin-bottom:8px;font-size:.78rem">+ New referral</button>
      <div id="fluxRefForm" class="flux-caseload-form" hidden>
        ${studentSelectHtml(students, 'fluxRefStu')}
        <select id="fluxRefTo" style="width:100%;font-size:.75rem;padding:6px;border-radius:8px;margin-bottom:6px">
          <option value="school_psych">School psychologist</option>
          <option value="admin">Administration</option>
          <option value="crisis_team">Crisis team</option>
          <option value="external">External provider</option>
          <option value="other">Other</option>
        </select>
        <input id="fluxRefNotes" placeholder="Notes (optional)" style="width:100%;font-size:.75rem;padding:6px;border-radius:8px;margin-bottom:6px;border:1px solid var(--border2);background:var(--card2);color:var(--text)">
        <div style="display:flex;gap:6px">
          <button type="button" class="btn" id="fluxRefSave" style="flex:1;font-size:.72rem">Save</button>
          <button type="button" class="btn-sec" id="fluxRefCancel" style="flex:1;font-size:.72rem">Cancel</button>
        </div>
      </div>
      <div class="flux-referral-list"></div>`;

    const list = mount.querySelector('.flux-referral-list');
    list.innerHTML = refs.length
      ? refs
          .map(
            (r) => `
        <div class="flux-referral-row">
          <div class="flux-referral-head">
            <span>${esc(names[r.student_id] || 'Student')}</span>
            <span class="flux-referral-status flux-referral-status--${esc(r.status)}">${esc(r.status)}</span>
          </div>
          <div class="flux-referral-meta">${esc(r.referred_to.replace(/_/g, ' '))}</div>
          ${r.notes ? `<p>${esc(r.notes.slice(0, 80))}</p>` : ''}
        </div>`
          )
          .join('')
      : '<p class="flux-widget-planned">No referrals logged.</p>';

    const form = mount.querySelector('#fluxRefForm');
    mount.querySelector('#fluxRefAdd')?.addEventListener('click', () => {
      if (form) form.hidden = false;
    });
    mount.querySelector('#fluxRefCancel')?.addEventListener('click', () => {
      if (form) {
        form.hidden = true;
        mount.querySelector('#fluxRefNotes').value = '';
      }
    });
    mount.querySelector('#fluxRefSave')?.addEventListener('click', async () => {
      let studentId = mount.querySelector('#fluxRefStu')?.value;
      if (!studentId) {
        studentId = await pickCounselorStudentId(mount, 'Student', students);
      }
      if (!studentId) {
        if (typeof showToast === 'function') showToast('Select a student', 'warn');
        return;
      }
      const to = mount.querySelector('#fluxRefTo')?.value || 'school_psych';
      const notes = (mount.querySelector('#fluxRefNotes')?.value || '').trim();
      const client = sb();
      if (!client) return;
      const { error } = await client.from('counselor_referrals').insert({
        counselor_user_id: uid(),
        student_id: studentId,
        school: schoolName(),
        referred_to: to,
        notes,
        status: 'submitted',
      });
      if (error) {
        if (typeof showToast === 'function') showToast(error.message, 'error');
        return;
      }
      if (typeof showToast === 'function') showToast('Referral logged', 'success');
      renderReferralTracker(mount);
    });
  }

  /** Student profile — "I need support" check-in */
  async function renderStudentWellnessCheckin(host, counselor) {
    if (!enabled() || !host || !counselor?.id || !currentUser) return;
    if (host.querySelector('.flux-student-checkin')) return;

    const block = document.createElement('div');
    block.className = 'flux-student-checkin';
    block.style.cssText =
      'margin-top:14px;padding:12px;border-radius:12px;background:rgba(var(--purple-rgb,124,92,255),.08);border:1px solid rgba(var(--purple-rgb),.25)';
    block.innerHTML = `
      <div style="font-size:.78rem;font-weight:700;margin-bottom:6px">Need support?</div>
      <p style="font-size:.72rem;color:var(--muted2);margin:0 0 8px;line-height:1.45">Send a private flag to ${esc(counselor.name)}. Only your counselor sees this.</p>
      <select id="fluxCheckinSev" style="width:100%;margin-bottom:6px;font-size:.75rem;padding:6px;border-radius:8px">
        <option value="low">I'm struggling a bit</option>
        <option value="medium" selected>I need to talk soon</option>
        <option value="high">Urgent — please reach out</option>
      </select>
      <textarea id="fluxCheckinMsg" rows="2" placeholder="Optional message (optional)" style="width:100%;font-size:.75rem;margin-bottom:6px;padding:6px;border-radius:8px;border:1px solid var(--border2);background:var(--card2);color:var(--text)"></textarea>
      <button type="button" class="btn" id="fluxCheckinSend" style="width:100%;font-size:.78rem">Send check-in</button>`;
    host.appendChild(block);

    block.querySelector('#fluxCheckinSend')?.addEventListener('click', async () => {
      const client = sb();
      if (!client) return;
      const severity = block.querySelector('#fluxCheckinSev')?.value || 'medium';
      const message = (block.querySelector('#fluxCheckinMsg')?.value || '').trim();
      const { error } = await client.from('student_counselor_checkins').insert({
        student_id: currentUser.id,
        counselor_id: counselor.id,
        school: (window.FluxSchool?.IAE?.name) || 'International Academy East',
        message,
        severity,
        status: 'new',
      });
      if (error) {
        if (typeof showToast === 'function') showToast(error.message, 'error');
        return;
      }
      if (typeof showToast === 'function') showToast('Your counselor was notified', 'success');
      block.querySelector('#fluxCheckinSend').disabled = true;
      block.querySelector('#fluxCheckinSend').textContent = 'Sent ✓';
    });
  }

  window.FluxCaseloadEngine = {
    renderCaseloadWidget,
    renderMeetingLog,
    renderWellnessQueue,
    renderCrisisCheatSheet,
    renderReferralTracker,
    renderStudentWellnessCheckin,
    fetchNotes,
    fetchCheckins,
    fetchCounselorStudents,
    pickCounselorStudentId,
    enabled,
  };
})();
