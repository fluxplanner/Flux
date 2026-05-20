/**
 * FluxCaseloadEngine — counselor private meeting logs (RLS) + caseload widget.
 * Uses staff_counselor_private_notes. Never exposed to teachers.
 */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
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

  function renderCaseloadWidget(mount) {
    mount.innerHTML = `
      <p class="flux-widget-hint">At-risk signals use existing caseload when <code>enable_counselor_caseload</code> is on.</p>
      <button type="button" class="btn-sec" style="width:100%;font-size:.78rem" onclick="nav('counselorDashboard')">Open full caseload →</button>`;
  }

  async function renderMeetingLog(mount) {
    mount.innerHTML = '<p class="flux-widget-hint">Loading private notes…</p>';
    const notes = await fetchNotes(8);
    mount.innerHTML = `
      <p class="flux-widget-hint">Encrypted-ready field (v0 = RLS-only). Not visible to teachers or students.</p>
      <button type="button" class="btn" id="fluxMeetLogAdd" style="width:100%;font-size:.78rem;margin-bottom:10px">+ Meeting note</button>
      <div class="flux-meet-log-list"></div>`;

    const list = mount.querySelector('.flux-meet-log-list');
    list.innerHTML = notes.length
      ? notes
          .map(
            (n) => `
        <div class="flux-meet-log-card">
          <div class="flux-meet-log-meta">${esc(n.meeting_type)} · ${new Date(n.occurred_at).toLocaleString()}</div>
          <div class="flux-meet-log-student">Student ${esc(String(n.student_id).slice(0, 8))}</div>
          <div class="flux-meet-log-body">${esc((n.note_body || '').slice(0, 200))}${(n.note_body || '').length > 200 ? '…' : ''}</div>
        </div>`
          )
          .join('')
      : '<p class="flux-widget-planned">No meeting notes yet.</p>';

    mount.querySelector('#fluxMeetLogAdd')?.addEventListener('click', async () => {
      const studentId = prompt('Student user ID');
      if (!studentId) return;
      const body = prompt('Private narrative (not shared with student)');
      if (!body) return;
      const type = (prompt('Type: check_in / crisis / parent / referral', 'check_in') || 'check_in').toLowerCase();
      const client = sb();
      if (!client) return;
      const { error } = await client.from('staff_counselor_private_notes').insert({
        counselor_user_id: uid(),
        student_id: studentId.trim(),
        school: schoolName(),
        note_body: body.trim(),
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

  window.FluxCaseloadEngine = {
    renderCaseloadWidget,
    renderMeetingLog,
    fetchNotes,
  };
})();
