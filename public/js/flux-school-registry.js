/**
 * Flux school registry — join codes and IAE defaults.
 * Requires Supabase migration 20260520120000_flux_schools_iae.sql.
 */
(function () {
  'use strict';

  const IAE = {
    slug: 'iae',
    name: 'International Academy East',
    shortName: 'IAE',
    joinCode: 'IAE-EAST',
    district: 'Bloomfield Hills Schools',
  };

  function normalizeCode(raw) {
    return String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '-');
  }

  function isBloomfieldEmail(email) {
    return String(email || '')
      .toLowerCase()
      .trim()
      .endsWith('@bloomfield.org');
  }

  function isStaffDirectoryEmail(email) {
    try {
      return !!window.FluxStaffDirectory?.findByEmail?.(String(email || '').toLowerCase());
    } catch (_) {
      return false;
    }
  }

  function hasSchoolOnProfile() {
    try {
      const s = FluxRole?.profile?.school;
      return !!(s && String(s).trim());
    } catch (_) {
      return false;
    }
  }

  async function joinByCode(code) {
    const sb = typeof window.getSB === 'function' ? window.getSB() : null;
    const u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;
    if (!sb || !u?.id) {
      if (typeof showToast === 'function') showToast('Sign in to join a school.', 'info');
      return { ok: false };
    }

    const normalized = normalizeCode(code);
    if (!normalized) {
      if (typeof showToast === 'function') showToast('Enter your school code.', 'warning');
      return { ok: false };
    }

    try {
      const { data, error } = await sb.rpc('join_flux_school', { p_join_code: normalized });
      if (error) throw error;
      if (!data?.ok) {
        if (typeof showToast === 'function') {
          showToast(
            data?.error === 'invalid_code'
              ? 'That school code is not recognized. Try IAE-EAST for International Academy East.'
              : 'Could not join school.',
            'warning'
          );
        }
        return { ok: false };
      }

      try {
        if (window.FluxRole?.load) await FluxRole.load();
      } catch (_) {}

      const p = typeof load === 'function' ? load('profile', {}) : {};
      p.school = data.school || IAE.name;
      if (typeof save === 'function') save('profile', p);
      if (typeof syncKey === 'function') syncKey('profile', p);

      if (typeof showToast === 'function') {
        showToast(`Joined ${data.short_name || data.school}`, 'success');
      }
      if (typeof renderSchool === 'function') renderSchool();
      if (typeof renderProfile === 'function') renderProfile();
      return { ok: true, school: data.school };
    } catch (e) {
      console.warn('[FluxSchool] join', e);
      if (typeof showToast === 'function') showToast('Could not join school. Try again.', 'error');
      return { ok: false };
    }
  }

  async function assignSchoolName(schoolName, opts) {
    const sb = typeof window.getSB === 'function' ? window.getSB() : null;
    const u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;
    const name = String(schoolName || IAE.name).trim();
    if (!sb || !u?.id || !name) return { ok: false };

    const silent = !!(opts && opts.silent);
    try {
      const patch = { user_id: u.id, school: name, updated_at: new Date().toISOString() };
      if (FluxRole?.current) patch.role = FluxRole.current;
      const { error } = await sb.from('user_roles').upsert(patch);
      if (error) throw error;

      try {
        if (window.FluxRole?.load) await FluxRole.load();
      } catch (_) {}

      const p = typeof load === 'function' ? load('profile', {}) : {};
      if (!p.school || opts?.overwriteProfile) {
        p.school = name;
        if (typeof save === 'function') save('profile', p);
        if (typeof syncKey === 'function') syncKey('profile', p);
      }

      if (!silent && typeof showToast === 'function') {
        showToast(`School set to ${IAE.shortName}`, 'success');
      }
      return { ok: true };
    } catch (e) {
      console.warn('[FluxSchool] assign', e);
      return { ok: false };
    }
  }

  /** Staff / bloomfield.org accounts default to IAE when no school is set. */
  async function ensureDefaultSchoolForAccount() {
    if (hasSchoolOnProfile()) return { ok: true, skipped: true };
    const u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;
    if (!u?.id) return { ok: false };

    const email = String(u.email || '').toLowerCase();
    const isEducator =
      typeof FluxRole !== 'undefined' && FluxRole.isEducator && FluxRole.isEducator();
    const shouldDefault = isEducator || isBloomfieldEmail(email) || isStaffDirectoryEmail(email);
    if (!shouldDefault) return { ok: true, skipped: true };

    return assignSchoolName(IAE.name, { silent: true, overwriteProfile: true });
  }

  function renderJoinCard() {
    const card = document.getElementById('schoolJoinCard');
    if (!card) return;

    const joined = hasSchoolOnProfile();
    const schoolName = FluxRole?.profile?.school || '';
    const currentEl = document.getElementById('schoolJoinCurrent');
    const formEl = document.getElementById('schoolJoinForm');

    if (joined) {
      card.style.display = 'block';
      if (currentEl) {
        currentEl.style.display = 'block';
        currentEl.innerHTML = `<div style="font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;font-family:'JetBrains Mono',monospace;margin-bottom:4px">Your school</div><div style="font-size:1rem;font-weight:800">${typeof esc === 'function' ? esc(schoolName) : schoolName}</div>`;
      }
      if (formEl) formEl.style.display = 'none';
      return;
    }

    try {
      if (typeof FluxRole !== 'undefined' && FluxRole.isEducator && FluxRole.isEducator()) {
        card.style.display = 'none';
        return;
      }
    } catch (_) {}

    card.style.display = 'block';
    if (currentEl) currentEl.style.display = 'none';
    if (formEl) formEl.style.display = 'block';

    const input = document.getElementById('schoolJoinCodeInput');
    if (input && !input.dataset.touched) input.placeholder = IAE.joinCode;
  }

  async function joinFromUI() {
    const input = document.getElementById('schoolJoinCodeInput');
    if (input) input.dataset.touched = '1';
    return joinByCode(input?.value || IAE.joinCode);
  }

  window.FluxSchool = {
    IAE,
    normalizeCode,
    joinByCode,
    joinFromUI,
    assignSchoolName,
    ensureDefaultSchoolForAccount,
    renderJoinCard,
  };

  window.joinFluxSchoolFromUI = joinFromUI;
})();
