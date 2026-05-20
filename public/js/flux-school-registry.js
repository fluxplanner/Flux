/**
 * Flux school registry — join codes and IAE defaults.
 * Requires Supabase migration 20260520120000_flux_schools_iae.sql (+ fix_join_flux_school).
 */
(function () {
  'use strict';

  const IAE = {
    slug: 'iae',
    name: 'International Academy East',
    shortName: 'IAE',
    joinCode: 'IA-EAST',
    district: 'Bloomfield Hills Schools',
  };

  /** Codes that map to IAE (normalized uppercase, hyphenated). */
  const IAE_CODE_ALIASES = new Set(['IA-EAST', 'IAE-EAST', 'IAEAST', 'IAE']);

  function normalizeCode(raw) {
    return String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/[\s_]+/g, '-');
  }

  function isIAECode(normalized) {
    return IAE_CODE_ALIASES.has(normalized);
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

  function rpcUnavailable(error) {
    const msg = String(error?.message || error?.details || error?.hint || '');
    const code = String(error?.code || '');
    return (
      code === 'PGRST202' ||
      /join_flux_school/i.test(msg) ||
      /could not find the function/i.test(msg) ||
      /schema cache/i.test(msg)
    );
  }

  async function finishJoinSuccess(schoolName, shortName) {
    try {
      if (window.FluxRole?.load) await FluxRole.load();
    } catch (_) {}

    const p = typeof load === 'function' ? load('profile', {}) : {};
    p.school = schoolName || IAE.name;
    if (typeof save === 'function') save('profile', p);
    if (typeof syncKey === 'function') syncKey('profile', p);

    try {
      if (typeof FluxBus !== 'undefined') {
        FluxBus.emit('school_joined', { school: schoolName, short_name: shortName });
      }
    } catch (_) {}
    if (typeof showToast === 'function') {
      showToast(`Joined ${shortName || schoolName || IAE.shortName}`, 'success');
    }
    if (typeof renderSchool === 'function') renderSchool();
    if (typeof renderProfile === 'function') renderProfile();
    return { ok: true, school: schoolName || IAE.name };
  }

  async function resolveAuthUser() {
    let u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;
    if (u?.id) return u;
    try {
      const sb = typeof window.getSB === 'function' ? window.getSB() : null;
      const { data } = await sb?.auth?.getUser?.();
      if (data?.user?.id) return data.user;
    } catch (_) {}
    return u || null;
  }

  async function joinByProfileUpdate(schoolName) {
    const sb = typeof window.getSB === 'function' ? window.getSB() : null;
    const u = await resolveAuthUser();
    const name = String(schoolName || IAE.name).trim();
    if (!sb || !u?.id || !name) return { ok: false };

    try {
      const { data: row, error: selErr } = await sb
        .from('user_roles')
        .select('role')
        .eq('user_id', u.id)
        .maybeSingle();
      if (selErr) throw selErr;

      const now = new Date().toISOString();
      if (row) {
        const { error } = await sb.from('user_roles').update({ school: name, updated_at: now }).eq('user_id', u.id);
        if (error) throw error;
      } else {
        const role =
          typeof FluxRole !== 'undefined' &&
          FluxRole.current &&
          ['student', 'teacher', 'counselor', 'staff', 'admin'].includes(FluxRole.current)
            ? FluxRole.current
            : 'student';
        const { error } = await sb.from('user_roles').insert({
          user_id: u.id,
          role,
          school: name,
          updated_at: now,
        });
        if (error) throw error;
      }

      return finishJoinSuccess(name, IAE.shortName);
    } catch (e) {
      console.warn('[FluxSchool] profile join', e);
      return { ok: false, error: e };
    }
  }

  async function joinByCode(code) {
    const sb = typeof window.getSB === 'function' ? window.getSB() : null;
    const u = await resolveAuthUser();
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

      if (error) {
        if (isIAECode(normalized)) {
          const fallback = await joinByProfileUpdate(IAE.name);
          if (fallback.ok) return fallback;
        }
        if (!isIAECode(normalized) || !rpcUnavailable(error)) throw error;
        return { ok: false };
      }

      if (data?.ok) {
        return finishJoinSuccess(data.school, data.short_name);
      }

      if (
        isIAECode(normalized) &&
        (data?.error === 'invalid_code' || data?.error === 'server_error')
      ) {
        const fallback = await joinByProfileUpdate(IAE.name);
        if (fallback.ok) return fallback;
      }

      if (typeof showToast === 'function') {
        const msg =
          data?.error === 'invalid_code'
            ? 'That school code is not recognized. Try IA-East for International Academy East.'
            : data?.error === 'not_authenticated'
              ? 'Sign in to join a school.'
              : 'Could not join school.';
        showToast(msg, 'warning');
      }
      if (data?.detail) console.warn('[FluxSchool] join_flux_school:', data.detail);
      return { ok: false };
    } catch (e) {
      console.warn('[FluxSchool] join', e);
      let profileErr = null;
      if (isIAECode(normalized)) {
        const fallback = await joinByProfileUpdate(IAE.name);
        if (fallback.ok) return fallback;
        profileErr = fallback?.error;
      }
      if (typeof showToast === 'function') {
        const detail = String(profileErr?.message || e?.message || e?.details || '').trim();
        const hint = rpcUnavailable(e)
          ? 'School join is not set up on the server yet — ask your admin to run the latest Supabase migrations.'
          : detail
            ? `Could not join school: ${detail}`
            : 'Could not join school. Try again.';
        showToast(hint, 'error');
      }
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
      const { data: row } = await sb.from('user_roles').select('role').eq('user_id', u.id).maybeSingle();
      const now = new Date().toISOString();
      if (row) {
        const { error } = await sb.from('user_roles').update({ school: name, updated_at: now }).eq('user_id', u.id);
        if (error) throw error;
      } else {
        const role =
          typeof FluxRole !== 'undefined' &&
          FluxRole.current &&
          ['student', 'teacher', 'counselor', 'staff', 'admin'].includes(FluxRole.current)
            ? FluxRole.current
            : 'student';
        const { error } = await sb.from('user_roles').insert({
          user_id: u.id,
          role,
          school: name,
          updated_at: now,
        });
        if (error) throw error;
      }

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
    isIAECode,
    joinByCode,
    joinFromUI,
    assignSchoolName,
    ensureDefaultSchoolForAccount,
    renderJoinCard,
  };

  window.joinFluxSchoolFromUI = joinFromUI;
})();
