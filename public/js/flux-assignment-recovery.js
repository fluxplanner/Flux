/**
 * Assignment recovery plans — teacher propose/approve; students see approved steps.
 * Flag: enable_assignment_recovery (default off).
 */
(function () {
  'use strict';

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_assignment_recovery', false);
    } catch (_) {
      return false;
    }
  }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function buildSteps(assignment) {
    if (window.FluxTeacherAssignIntel?.buildScaffold) {
      return window.FluxTeacherAssignIntel.buildScaffold(assignment);
    }
    const est = Math.max(15, Number(assignment?.estimated_minutes) || 30);
    return [
      { order: 1, label: 'Review requirements & rubric', est_minutes: 10 },
      { order: 2, label: 'Complete core work in small chunks', est_minutes: Math.max(15, est - 20) },
      { order: 3, label: 'Check quality & submit', est_minutes: 10 },
    ];
  }

  function stepsHtml(steps) {
    if (!steps?.length) return '<em>No steps</em>';
    return `<ol class="flux-recovery-steps">${steps
      .map(
        (s) =>
          `<li>${esc(s.label)}${s.est_minutes ? ` <span style="color:var(--muted)">~${s.est_minutes}m</span>` : ''}</li>`,
      )
      .join('')}</ol>`;
  }

  async function loadPending(sb, teacherId) {
    if (!sb || !teacherId) return [];
    try {
      const { data } = await sb
        .from('assignment_recovery_plans')
        .select(
          'id,created_at,reason,plan_steps,student_id,assignment_id,teacher_assignments(title,class_id)',
        )
        .eq('teacher_id', teacherId)
        .eq('status', 'proposed')
        .order('created_at', { ascending: false });
      return data || [];
    } catch (_) {
      return [];
    }
  }

  async function proposePlan(sb, { assignment, studentId, teacherId, reason }) {
    if (!sb || !assignment?.id || !studentId || !teacherId) {
      return { ok: false, error: 'missing_fields' };
    }
    const steps = buildSteps(assignment);
    const { error } = await sb.from('assignment_recovery_plans').upsert(
      {
        assignment_id: assignment.id,
        student_id: studentId,
        teacher_id: teacherId,
        status: 'proposed',
        plan_steps: steps,
        reason: reason || 'Catch-up plan for overdue or missing work',
        resolved_at: null,
      },
      { onConflict: 'assignment_id,student_id' },
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true, steps };
  }

  async function resolvePlan(sb, teacherId, planId, newStatus) {
    if (!sb || !teacherId || !planId) return { ok: false };
    if (newStatus !== 'approved' && newStatus !== 'rejected') return { ok: false };
    const { data, error } = await sb
      .from('assignment_recovery_plans')
      .update({ status: newStatus, resolved_at: new Date().toISOString() })
      .eq('id', planId)
      .eq('teacher_id', teacherId)
      .eq('status', 'proposed')
      .select('student_id,assignment_id,teacher_assignments(title)')
      .maybeSingle();
    if (error || !data) return { ok: false, error: error?.message };
    const title = data.teacher_assignments?.title || 'the assignment';
    if (typeof window.fluxEnsureThreadAndSend === 'function') {
      if (newStatus === 'approved') {
        await window.fluxEnsureThreadAndSend(
          data.student_id,
          `Your teacher approved a recovery plan for "${title}". Open your planner to see the steps.`,
        );
      } else {
        await window.fluxEnsureThreadAndSend(
          data.student_id,
          `Your teacher updated the recovery plan request for "${title}". Please check in with them.`,
        );
      }
    }
    return { ok: true, data };
  }

  async function openPendingModal(sb, teacherId, nameMap) {
    if (document.getElementById('teacherRecoveryModal')) return;
    const rows = await loadPending(sb, teacherId);
    const modal = document.createElement('div');
    modal.id = 'teacherRecoveryModal';
    modal.className = 'flux-recovery-overlay';
    modal.innerHTML = `
      <div class="flux-recovery-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h2 class="flux-recovery-title">Recovery plans to approve</h2>
          <button type="button" id="trClose" style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:6px 12px;cursor:pointer;color:var(--muted2)">Close</button>
        </div>
        <p class="flux-recovery-sub">Students only see plans after you approve.</p>
        ${
          rows.length === 0
            ? '<p style="color:var(--muted2);font-size:.86rem;margin:0">No pending recovery plans.</p>'
            : rows
                .map((r) => {
                  const sn =
                    nameMap?.[r.student_id]?.display_name ||
                    `Student ${String(r.student_id).slice(0, 6)}`;
                  const title = r.teacher_assignments?.title || 'Assignment';
                  return `<div class="flux-recovery-row" data-rid="${esc(r.id)}">
              <div class="flux-recovery-row-name">${esc(sn)}</div>
              <div class="flux-recovery-row-meta">${esc(title)} · ${esc(r.reason || '')}</div>
              ${stepsHtml(r.plan_steps)}
              <div class="flux-recovery-actions">
                <button type="button" class="teacher-action-btn primary" data-act="approved" data-rid="${esc(r.id)}">Approve</button>
                <button type="button" class="teacher-action-btn" data-act="rejected" data-rid="${esc(r.id)}" style="border-color:rgba(255,77,109,.35);color:var(--red)">Reject</button>
              </div>
            </div>`;
                })
                .join('')
        }
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    modal.querySelector('#trClose')?.addEventListener('click', () => modal.remove());
    modal.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const res = await resolvePlan(sb, teacherId, btn.getAttribute('data-rid'), btn.dataset.act);
        if (!res.ok) {
          if (typeof window.showToast === 'function') {
            window.showToast('Could not update that plan.', 'error');
          }
          return;
        }
        if (typeof window.showToast === 'function') {
          window.showToast(
            btn.dataset.act === 'approved' ? 'Recovery plan approved' : 'Plan rejected',
            'success',
          );
        }
        modal.remove();
        try {
          if (typeof window.renderTeacherDashboard === 'function') window.renderTeacherDashboard();
        } catch (_) {}
      });
    });
  }

  async function openProposeForAssignment(sb, teacherId, assignment, students, nameMap) {
    if (document.getElementById('teacherRecoveryProposeModal')) return;
    const atRisk = (students || []).filter((s) => {
      const c = (assignment.student_completions || []).find((x) => x.student_id === s.student_id);
      return !c || c.status === 'missing' || c.status === 'late' || c.status === 'pending';
    });
    const modal = document.createElement('div');
    modal.id = 'teacherRecoveryProposeModal';
    modal.className = 'flux-recovery-overlay';
    modal.innerHTML = `
      <div class="flux-recovery-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h2 class="flux-recovery-title">Propose recovery · ${esc(assignment.title || '')}</h2>
          <button type="button" id="trpClose" style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:6px 12px;cursor:pointer;color:var(--muted2)">Close</button>
        </div>
        <p class="flux-recovery-sub">Creates a proposed plan for each student below. Approve from the Recovery queue on your dashboard.</p>
        ${
          atRisk.length === 0
            ? '<p style="color:var(--muted2);font-size:.86rem">No missing/late students for this assignment.</p>'
            : atRisk
                .map((s) => {
                  const dn =
                    nameMap?.[s.student_id]?.display_name ||
                    `Student ${String(s.student_id).slice(0, 6)}`;
                  return `<div class="flux-recovery-row">
              <div class="flux-recovery-row-name">${esc(dn)}</div>
              <button type="button" class="teacher-action-btn primary" data-propose-stu="${esc(s.student_id)}" style="margin-top:10px">Propose plan</button>
            </div>`;
                })
                .join('')
        }
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    modal.querySelector('#trpClose')?.addEventListener('click', () => modal.remove());
    modal.querySelectorAll('[data-propose-stu]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const res = await proposePlan(sb, {
          assignment,
          studentId: btn.getAttribute('data-propose-stu'),
          teacherId,
          reason: 'Catch-up plan for missing or late work',
        });
        if (res.ok) {
          if (typeof window.showToast === 'function') {
            window.showToast('Recovery plan proposed — approve from dashboard queue', 'success');
          }
          btn.textContent = 'Proposed ✓';
        } else if (typeof window.showToast === 'function') {
          window.showToast(res.error || 'Could not save plan', 'error');
        }
      });
    });
  }

  function recoveryButtonHtml(assignmentId) {
    if (!enabled()) return '';
    return `<button type="button" class="flux-recovery-link" data-recovery-asg="${esc(assignmentId)}" title="Propose recovery plans">Recovery</button>`;
  }

  function bannerHtml(count) {
    if (!enabled() || !count) return '';
    return `<div class="flux-recovery-banner">
      <span style="font-size:1.1rem">📋</span>
      <span style="flex:1;font-size:.84rem;font-weight:600">${count} recovery plan${count === 1 ? '' : 's'} awaiting approval</span>
      <button type="button" class="teacher-action-btn" data-action="review-recovery">Review</button>
    </div>`;
  }

  async function attachApprovedPlansToTasks(sb, studentId, taskList) {
    if (!enabled() || !sb || !studentId || !Array.isArray(taskList)) return;
    try {
      const { data } = await sb
        .from('assignment_recovery_plans')
        .select('assignment_id,plan_steps,status')
        .eq('student_id', studentId)
        .eq('status', 'approved');
      (data || []).forEach((p) => {
        const t = taskList.find((x) => x.teacherAssignmentId === p.assignment_id);
        if (!t || !Array.isArray(p.plan_steps)) return;
        const lines = p.plan_steps.map((s, i) => `${i + 1}. ${s.label}`).join('\n');
        t.recoveryPlanSteps = p.plan_steps;
        t.notes = `${t.notes || ''}\n\n📋 Approved recovery plan:\n${lines}`.trim();
      });
    } catch (_) {}
  }

  window.FluxAssignmentRecovery = {
    enabled,
    buildSteps,
    loadPending,
    proposePlan,
    resolvePlan,
    openPendingModal,
    openProposeForAssignment,
    recoveryButtonHtml,
    bannerHtml,
    attachApprovedPlansToTasks,
  };
})();
