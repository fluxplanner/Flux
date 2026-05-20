/* Flux staff directory — hydrated from Supabase `staff_directory`.
 *
 * Source of truth: public.staff_directory (active rows).
 * Used by staff onboarding, identity verification, and admin/workboard UIs.
 */
(function () {
  'use strict';

  const ROLE_LABELS = { teacher: 'Teacher', counselor: 'Counselor', staff: 'Staff', admin: 'Admin' };
  let state = [];
  let hydratePromise = null;

  function enrichRow(row) {
    const email = String(row.school_email || row.email || '')
      .toLowerCase()
      .trim();
    const role = String(row.role || 'staff')
      .toLowerCase()
      .trim();
    const name = String(row.full_name || row.name || '').trim();
    const subject = String(row.subject || row.department || '').trim();
    return {
      id: row.id || null,
      email,
      role,
      name,
      subject,
      department: String(row.department || '').trim(),
      room_number: row.room_number || null,
      is_claimed: !!row.is_claimed,
      claimed_by: row.claimed_by || null,
      displayRole: ROLE_LABELS[role] || 'Staff',
      searchText: (name + ' ' + email + ' ' + subject + ' ' + (row.department || '')).toLowerCase(),
    };
  }

  function setState(rows) {
    state = (rows || []).map(enrichRow).filter((d) => d.email || d.name);
    return state;
  }

  async function hydrateStaffDirectory() {
    if (hydratePromise) return hydratePromise;
    hydratePromise = (async () => {
      const client = typeof getSB === 'function' ? getSB() : null;
      if (!client) return state;
      try {
        const { data, error } = await client
          .from('staff_directory')
          .select(
            'id,full_name,role,department,subject,school_email,room_number,is_claimed,claimed_by,active'
          )
          .eq('active', true)
          .order('full_name');
        if (error) {
          console.warn('[FluxStaffDirectory] hydrate failed', error);
          return state;
        }
        return setState(data || []);
      } catch (e) {
        console.warn('[FluxStaffDirectory] hydrate error', e);
        return state;
      } finally {
        hydratePromise = null;
      }
    })();
    return hydratePromise;
  }

  function findByEmail(email) {
    if (!email) return null;
    const e = String(email).toLowerCase().trim();
    return state.find((d) => d.email === e) || null;
  }

  function listByRole(role) {
    if (!role) return state.slice().sort((a, b) => a.name.localeCompare(b.name));
    const r = String(role).toLowerCase();
    const want = r === 'staff' ? ['staff', 'admin'] : [r];
    return state.filter((d) => want.includes(d.role)).sort((a, b) => a.name.localeCompare(b.name));
  }

  function isAuthorized(email, role) {
    const hit = findByEmail(email);
    if (!hit) return false;
    if (!role) return true;
    if (role === 'staff') return hit.role === 'staff' || hit.role === 'admin';
    return hit.role === role;
  }

  window.FluxStaffDirectory = {
    get state() {
      return state;
    },
    get all() {
      return state;
    },
    hydrate: hydrateStaffDirectory,
    findByEmail,
    listByRole,
    isAuthorized,
    roleLabels: ROLE_LABELS,
  };
})();
