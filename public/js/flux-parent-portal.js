/**
 * P7-PARENT — parent visibility portal (invite codes, consent tiers, aggregates only).
 * Flag: enable_parent_portal (default off).
 */
(function () {
  'use strict';

  const TIERS = [
    {
      id: 'basic',
      title: 'Engagement',
      desc: 'Workload and momentum summaries (no task titles or grades).',
    },
    {
      id: 'wellness',
      title: 'Wellness',
      desc: 'Includes mood, stress, and load trends from wellness check-ins.',
    },
  ];

  let _children = [];

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_parent_portal', false);
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

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') window.showToast(msg, kind || 'info');
    else console.log('[parent]', msg);
  }

  function sb() {
    return typeof window.getSB === 'function' ? window.getSB() : null;
  }

  function isParentRole() {
    try {
      return window.FluxRole?.current === 'parent';
    } catch (_) {
      return false;
    }
  }

  async function hasParentAccess() {
    if (!enabled()) return false;
    const list = await loadChildren();
    return list.length > 0;
  }

  async function loadChildren() {
    const client = sb();
    const u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;
    if (!client || !u?.id) return [];
    try {
      const { data, error } = await client.rpc('flux_parent_list_children');
      if (error) throw error;
      if (!data?.ok) return [];
      _children = data.children || [];
      return _children;
    } catch (e) {
      console.warn('[FluxParentPortal] children', e);
      return [];
    }
  }

  async function loadStudentInvites() {
    const client = sb();
    if (!client) return [];
    try {
      const { data, error } = await client.rpc('flux_parent_student_list_invites');
      if (error) throw error;
      return data?.ok ? data.invites || [] : [];
    } catch (e) {
      console.warn('[FluxParentPortal] invites', e);
      return [];
    }
  }

  async function createInvite(tier, label) {
    const client = sb();
    if (!client) return { ok: false, error: 'offline' };
    const { data, error } = await client.rpc('flux_parent_create_invite', {
      p_tier: tier || 'basic',
      p_label: label || null,
    });
    if (error) return { ok: false, error: error.message };
    return data || { ok: false };
  }

  async function claimInvite(code) {
    const client = sb();
    if (!client) return { ok: false, error: 'offline' };
    const { data, error } = await client.rpc('flux_parent_claim_invite', {
      p_code: String(code || '').trim(),
    });
    if (error) return { ok: false, error: error.message };
    return data || { ok: false };
  }

  async function loadSnapshot(studentId) {
    const client = sb();
    if (!client) return { ok: false };
    const { data, error } = await client.rpc('flux_parent_child_snapshot', {
      p_student_id: studentId,
    });
    if (error) return { ok: false, error: error.message };
    return data || { ok: false };
  }

  async function setTier(linkId, tier) {
    const client = sb();
    if (!client) return { ok: false };
    const { data, error } = await client.rpc('flux_parent_student_set_tier', {
      p_link_id: linkId,
      p_tier: tier,
    });
    if (error) return { ok: false, error: error.message };
    return data || { ok: false };
  }

  async function revokeLink(linkId) {
    const client = sb();
    if (!client) return { ok: false };
    const { data, error } = await client.rpc('flux_parent_revoke_link', { p_link_id: linkId });
    if (error) return { ok: false, error: error.message };
    return data || { ok: false };
  }

  function snapshotHtml(snap) {
    if (!snap?.ok) {
      return `<p class="flux-parent-muted">Could not load snapshot${snap?.error ? `: ${esc(snap.error)}` : ''}.</p>`;
    }
    if (!snap.has_data) {
      return `<p class="flux-parent-muted">No wellness summaries yet. Your student can log mood in Flux when wellness snapshots are enabled.</p>`;
    }
    const rows = (snap.snapshots || [])
      .map(
        (r) => `<tr>
        <td>${esc(r.date)}</td>
        <td>${r.mood != null ? esc(r.mood) : '—'}</td>
        <td>${r.stress != null ? esc(r.stress) : '—'}</td>
        <td>${r.load_score != null ? esc(r.load_score) : '—'}</td>
        <td>${r.momentum_score != null ? esc(r.momentum_score) : '—'}</td>
      </tr>`,
      )
      .join('');
    return `<p class="flux-parent-tier">Sharing: <strong>${esc(snap.tier)}</strong> · ${esc(snap.note || '')}</p>
      <div class="flux-parent-table-wrap"><table class="flux-parent-table">
        <thead><tr><th>Date</th><th>Mood</th><th>Stress</th><th>Load</th><th>Momentum</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
  }

  async function renderPortal() {
    const host = document.getElementById('parentPortalBody');
    if (!host || !enabled()) return;
    host.innerHTML = '<p class="flux-parent-muted">Loading…</p>';
    const children = await loadChildren();
    const claimBlock = `
      <div class="flux-parent-card">
        <h3>Link a student</h3>
        <p class="flux-parent-muted">Enter the invite code your student shared from Settings.</p>
        <div class="flux-parent-claim-row">
          <input type="text" id="fluxParentClaimCode" placeholder="8-character code" maxlength="16" autocomplete="off" style="text-transform:uppercase">
          <button type="button" class="btn-shimmer" id="fluxParentClaimBtn">Link</button>
        </div>
      </div>`;

    if (!children.length) {
      host.innerHTML = claimBlock + '<p class="flux-parent-muted">No linked students yet.</p>';
    } else {
      const cards = await Promise.all(
        children.map(async (c) => {
          const snap = await loadSnapshot(c.student_id);
          const label = c.student_label || 'Student';
          return `<div class="flux-parent-card" data-student="${esc(c.student_id)}">
            <div class="flux-parent-card-head">
              <h3>${esc(label)}</h3>
              <button type="button" class="btn sm ghost" data-revoke="${esc(c.link_id)}">Revoke access</button>
            </div>
            ${snapshotHtml(snap)}
          </div>`;
        }),
      );
      host.innerHTML = claimBlock + cards.join('');
    }

    document.getElementById('fluxParentClaimBtn')?.addEventListener('click', async () => {
      const code = document.getElementById('fluxParentClaimCode')?.value;
      const res = await claimInvite(code);
      if (!res.ok) {
        toast(res.error || 'Invalid code', 'error');
        return;
      }
      toast('Student linked', 'success');
      updateNavVisibility();
      renderPortal();
    });

    host.querySelectorAll('[data-revoke]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Revoke your access to this student?')) return;
        await revokeLink(btn.getAttribute('data-revoke'));
        toast('Access revoked', 'info');
        updateNavVisibility();
        renderPortal();
      });
    });
  }

  async function renderStudentSettings() {
    const host = document.getElementById('fluxParentStudentMount');
    const card = document.getElementById('fluxParentStudentCard');
    if (!host || !enabled()) {
      if (card) card.style.display = 'none';
      return;
    }
    if (card) card.style.display = '';
    const invites = await loadStudentInvites();
    const tierOpts = TIERS.map(
      (t) => `<option value="${t.id}">${esc(t.title)}</option>`,
    ).join('');

    const list =
      invites.length === 0
        ? '<p class="flux-parent-muted">No active parent links.</p>'
        : invites
            .map((inv) => {
              const status = inv.status === 'active' ? 'Linked' : 'Waiting for parent';
              return `<div class="flux-parent-invite-row">
              <div><strong>${esc(inv.invite_code)}</strong> · ${esc(status)} · ${esc(inv.visibility_tier)}</div>
              ${
                inv.status === 'pending'
                  ? `<select data-tier-link="${esc(inv.link_id)}" class="flux-parent-tier-select">${tierOpts}</select>`
                  : ''
              }
              <button type="button" class="btn sm ghost" data-revoke-student="${esc(inv.link_id)}">Revoke</button>
            </div>`;
            })
            .join('');

    host.innerHTML = `
      <div class="flux-parent-student-actions">
        <select id="fluxParentNewTier" class="flux-parent-tier-select">${tierOpts}</select>
        <input type="text" id="fluxParentNewLabel" placeholder="Label (e.g. Alex)" maxlength="32">
        <button type="button" class="btn-shimmer" id="fluxParentCreateInvite">Create invite code</button>
      </div>
      <div id="fluxParentInviteList" class="flux-parent-invite-list">${list}</div>`;

    document.getElementById('fluxParentCreateInvite')?.addEventListener('click', async () => {
      const tier = document.getElementById('fluxParentNewTier')?.value || 'basic';
      const label = document.getElementById('fluxParentNewLabel')?.value || '';
      const res = await createInvite(tier, label);
      if (!res.ok) {
        toast(res.error || 'Could not create invite', 'error');
        return;
      }
      toast(`Invite code: ${res.invite_code}`, 'success');
      renderStudentSettings();
    });

    host.querySelectorAll('[data-tier-link]').forEach((sel) => {
      sel.addEventListener('change', async () => {
        await setTier(sel.getAttribute('data-tier-link'), sel.value);
        toast('Sharing tier updated', 'success');
      });
    });

    host.querySelectorAll('[data-revoke-student]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await revokeLink(btn.getAttribute('data-revoke-student'));
        toast('Link revoked', 'info');
        renderStudentSettings();
      });
    });
  }

  async function updateNavVisibility() {
    const show = enabled();
    document.querySelectorAll('[data-parent-nav]').forEach((el) => {
      el.style.display = show ? '' : 'none';
    });
    const studentCard = document.getElementById('fluxParentStudentCard');
    if (studentCard) {
      const isStudent =
        window.FluxRole?.isStudent?.() ||
        (!window.FluxRole?.isEducator?.() && window.FluxRole?.current === 'student');
      studentCard.style.display = enabled() && isStudent ? '' : 'none';
    }
  }

  function install() {
    if (!enabled()) return false;
    updateNavVisibility();
    renderStudentSettings();
    return true;
  }

  window.FluxParentPortal = {
    enabled,
    install,
    hasParentAccess,
    renderPortal,
    renderStudentSettings,
    updateNavVisibility,
    loadChildren,
    createInvite,
    claimInvite,
    isParentRole,
  };

  window.renderParentPortal = renderPortal;
})();
