/**
 * Counselor appointment requests — pending queue, confirm/decline, student names.
 */
(function () {
  'use strict';

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function sb() {
    return typeof getSB === 'function' ? getSB() : null;
  }

  async function counselorRow() {
    if (typeof ensureCounselorRecord === 'function') {
      const client = sb();
      if (client) return ensureCounselorRecord(client, 'counselor');
    }
    return window._counselorRecord || null;
  }

  async function loadStudentNames(client, studentIds) {
    const map = {};
    const ids = [...new Set((studentIds || []).filter(Boolean))];
    if (!ids.length || !client) return map;
    try {
      const { data } = await client.from('user_roles').select('user_id,display_name').in('user_id', ids);
      (data || []).forEach((r) => {
        map[r.user_id] = r.display_name || 'Student';
      });
    } catch (e) {
      console.warn('[FluxCounselorAppointments] names', e);
    }
    ids.forEach((id) => {
      if (!map[id]) map[id] = 'Student ' + String(id).slice(0, 6);
    });
    return map;
  }

  async function fetchAppointments(counselorId) {
    const client = sb();
    if (!client || !counselorId) return { pending: [], upcoming: [], error: null };
    const today = new Date().toISOString().slice(0, 10);
    try {
      const [pendingRes, upcomingRes] = await Promise.all([
        client
          .from('counselor_appointments')
          .select('*')
          .eq('counselor_id', counselorId)
          .eq('status', 'pending')
          .order('date', { ascending: true })
          .order('time_slot', { ascending: true })
          .limit(40),
        client
          .from('counselor_appointments')
          .select('*')
          .eq('counselor_id', counselorId)
          .gte('date', today)
          .neq('status', 'cancelled')
          .order('date', { ascending: true })
          .order('time_slot', { ascending: true })
          .limit(50),
      ]);
      if (pendingRes.error) return { pending: [], upcoming: [], error: pendingRes.error };
      if (upcomingRes.error) return { pending: pendingRes.data || [], upcoming: [], error: upcomingRes.error };
      return { pending: pendingRes.data || [], upcoming: upcomingRes.data || [], error: null };
    } catch (e) {
      return { pending: [], upcoming: [], error: e };
    }
  }

  function appointmentRowHtml(a, names, opts) {
    const showActions = opts && opts.showActions;
    const studentLabel = esc(names[a.student_id] || 'Student');
    const msg = a.student_requested_message || a.notes || '';
    const dateLabel = new Date(a.date + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return `
      <div class="appointment-row ${a.status === 'pending' ? 'appointment-row--pending' : ''}" data-appt-id="${esc(a.id)}">
        <div class="appt-time">${esc(dateLabel)} · ${esc(a.time_slot)}</div>
        <div class="appt-student">${studentLabel}</div>
        <div class="appt-reason">${esc((a.reason || '').slice(0, 80) || 'No reason given')}</div>
        ${msg ? `<div class="appt-notes">${esc(msg.slice(0, 120))}</div>` : ''}
        <div class="appt-status-badge status-${esc(a.status)}">${esc(a.status)}</div>
        ${
          showActions && a.status === 'pending'
            ? `<div class="appt-actions">
            <button type="button" class="appt-btn appt-btn-confirm" data-appt-confirm="${esc(a.id)}">Confirm</button>
            <button type="button" class="appt-btn appt-btn-decline" data-appt-decline="${esc(a.id)}">Decline</button>
          </div>`
            : ''
        }
      </div>`;
  }

  function wireAppointmentActions(root, counselorId) {
    if (!root) return;
    root.querySelectorAll('[data-appt-confirm]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.apptConfirm;
        if (typeof respondToAppointmentRequest === 'function') {
          await respondToAppointmentRequest(id, 'confirmed', counselorId);
        } else if (typeof updateAppointmentStatus === 'function') {
          await updateAppointmentStatus(id, 'confirmed');
        }
        if (typeof renderCounselorDashboard === 'function') renderCounselorDashboard();
        if (typeof renderCounselorMeetings === 'function') renderCounselorMeetings();
      });
    });
    root.querySelectorAll('[data-appt-decline]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.apptDecline;
        if (!confirm('Decline this appointment request?')) return;
        if (typeof respondToAppointmentRequest === 'function') {
          await respondToAppointmentRequest(id, 'cancelled', counselorId);
        } else if (typeof updateAppointmentStatus === 'function') {
          await updateAppointmentStatus(id, 'cancelled');
        }
        if (typeof renderCounselorDashboard === 'function') renderCounselorDashboard();
        if (typeof renderCounselorMeetings === 'function') renderCounselorMeetings();
      });
    });
  }

  async function renderPendingSection(host, counselorId) {
    if (!host) return;
    const { pending, error } = await fetchAppointments(counselorId);
    if (error) {
      host.innerHTML = `<div class="ca-error">Could not load requests: ${esc(error.message || error)}</div>`;
      return;
    }
    const names = await loadStudentNames(sb(), pending.map((a) => a.student_id));
    if (!pending.length) {
      host.innerHTML =
        '<div class="ca-empty">No pending requests — students book from Profile → My counselor.</div>';
      return;
    }
    host.innerHTML = `
      <div class="ca-pending-block">
        <div class="section-header"><h3>Pending requests (${pending.length})</h3></div>
        ${pending.map((a) => appointmentRowHtml(a, names, { showActions: true })).join('')}
      </div>`;
    wireAppointmentActions(host, counselorId);
  }

  /** Mount at top of counselor Meetings panel (before Google Calendar). */
  async function renderMeetingsBookingPanel() {
    const host = document.getElementById('counselorMeetingsBody');
    if (!host) return;
    const row = await counselorRow();
    if (!row) return;
    document.getElementById('counselorApptRequestsMount')?.remove();
    const wrap = document.createElement('div');
    wrap.id = 'counselorApptRequestsMount';
    wrap.className = 'ca-meetings-mount';
    host.prepend(wrap);
    await renderPendingSection(wrap, row.id);
  }

  window.FluxCounselorAppointments = {
    fetchAppointments,
    loadStudentNames,
    renderPendingSection,
    renderMeetingsBookingPanel,
    appointmentRowHtml,
    wireAppointmentActions,
  };
})();
