/**
 * FluxAdminWidgets — duty roster alerts + sub-coverage swap (P8.6).
 * Uses same localStorage keys as renderAdminOps in flux-staff-tabs.js.
 * Optional cloud publish → admin_duty_logs. Flag: enable_school_ops (+ suite).
 */
(function () {
  'use strict';

  const SUB_KEY = 'flux_admin_sub_coverage_v1';
  const DUTY_KEY = 'flux_admin_duties_v1';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _key(k) {
    try {
      if (typeof window.fluxNamespacedKey === 'function') return window.fluxNamespacedKey(k);
    } catch (_) {}
    return k;
  }

  function ls(key, fallback) {
    if (typeof load === 'function') {
      try {
        return load(key, fallback);
      } catch (_) {
        return fallback;
      }
    }
    try {
      const raw = localStorage.getItem(_key(key));
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
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
      localStorage.setItem(_key(key), JSON.stringify(val));
    } catch (_) {}
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function defaultDuties() {
    return {
      'Lunch duty': '(unassigned)',
      'Hall duty (AM)': '(unassigned)',
      'Hall duty (PM)': '(unassigned)',
      'Bus duty': '(unassigned)',
      'Detention': '(unassigned)',
    };
  }

  function enabled() {
    try {
      return (
        window.FluxFeatureFlags?.isEnabled('enable_staff_productivity_suite', false) &&
        window.FluxFeatureFlags?.isEnabled('enable_school_ops', false)
      );
    } catch (_) {
      return false;
    }
  }

  function schoolName() {
    try {
      return window.FluxRole?.profile?.school || 'International Academy East';
    } catch (_) {
      return 'International Academy East';
    }
  }

  function staffNames() {
    const dir = (window.FluxStaffDirectory && window.FluxStaffDirectory.all) || [];
    return dir.map((d) => d.name).filter(Boolean);
  }

  function isUnassigned(v) {
    const s = String(v || '').trim().toLowerCase();
    return !s || s === '(unassigned)' || s === 'unassigned' || s === 'tbd';
  }

  async function publishDutyLogs(duties) {
    const client = typeof getSB === 'function' ? getSB() : null;
    const uid = window.currentUser?.id;
    if (!client || !uid) return { ok: false, error: 'Not signed in' };
    const today = todayISO();
    const rows = Object.keys(duties).map((label) => ({
      admin_id: uid,
      school: schoolName(),
      duty_label: label,
      assignee_name: duties[label],
      duty_date: today,
      notes: null,
    }));
    const { error } = await client.from('admin_duty_logs').insert(rows);
    if (error) return { ok: false, error: error.message };
    return { ok: true, count: rows.length };
  }

  async function renderDutyAlerts(mount) {
    if (!enabled()) {
      mount.innerHTML = '<p class="flux-widget-planned">Enable school ops + staff productivity suite.</p>';
      return;
    }

    const duties = { ...defaultDuties(), ...ls(DUTY_KEY, {}) };
    const keys = Object.keys(duties);
    const unassigned = keys.filter((k) => isUnassigned(duties[k]));
    const names = staffNames();

    mount.innerHTML = `
      <p class="flux-widget-hint">${unassigned.length ? `<strong class="flux-admin-warn">${unassigned.length} duty slot${unassigned.length === 1 ? '' : 's'} unassigned</strong>` : 'All duty slots assigned for today.'}</p>
      <div class="flux-duty-list"></div>
      <button type="button" class="btn" id="fluxDutyPublish" style="width:100%;margin-top:8px;font-size:.72rem">Publish roster to school log</button>`;

    const list = mount.querySelector('.flux-duty-list');
    list.innerHTML = keys
      .map(
        (k) => `
      <div class="flux-duty-edit-row${isUnassigned(duties[k]) ? ' flux-duty-edit-row--warn' : ''}">
        <label class="flux-duty-edit-label">${esc(k)}</label>
        <input class="flux-duty-edit-input" data-duty-key="${esc(k)}" list="fluxDutyStaffList" value="${esc(duties[k])}" placeholder="Assign staff">
      </div>`,
      )
      .join('');

    if (!mount.querySelector('#fluxDutyStaffList')) {
      const dl = document.createElement('datalist');
      dl.id = 'fluxDutyStaffList';
      dl.innerHTML = names.map((n) => `<option value="${esc(n)}">`).join('');
      mount.appendChild(dl);
    }

    list.querySelectorAll('.flux-duty-edit-input').forEach((inp) => {
      inp.addEventListener('change', () => {
        duties[inp.dataset.dutyKey] = inp.value.trim() || '(unassigned)';
        lsSet(DUTY_KEY, duties);
        renderDutyAlerts(mount);
      });
    });

    mount.querySelector('#fluxDutyPublish')?.addEventListener('click', async () => {
      const btn = mount.querySelector('#fluxDutyPublish');
      if (btn) btn.disabled = true;
      const res = await publishDutyLogs(duties);
      if (btn) btn.disabled = false;
      if (typeof showToast === 'function') {
        showToast(
          res.ok ? `Published ${res.count} duty rows to school log` : res.error || 'Publish failed',
          res.ok ? 'success' : 'error',
        );
      }
    });
  }

  async function renderSubSwap(mount) {
    if (!enabled()) {
      mount.innerHTML = '<p class="flux-widget-planned">Enable school ops + staff productivity suite.</p>';
      return;
    }

    const today = todayISO();
    const subs = ls(SUB_KEY, []);
    const todaySubs = subs.filter((s) => s.date === today);
    const names = staffNames();

    mount.innerHTML = `
      <p class="flux-widget-hint">${todaySubs.length ? `${todaySubs.length} sub${todaySubs.length === 1 ? '' : 's'} today` : 'No sub coverage logged for today.'}</p>
      <div class="flux-sub-add" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px">
        <input id="fluxSubPeriod" placeholder="Period" style="font-size:.72rem;padding:6px;border-radius:8px">
        <input id="fluxSubAbsent" placeholder="Absent" list="fluxSubStaffList" style="font-size:.72rem;padding:6px;border-radius:8px">
        <input id="fluxSubCover" placeholder="Cover" list="fluxSubStaffList" style="font-size:.72rem;padding:6px;border-radius:8px">
      </div>
      <button type="button" class="btn" id="fluxSubAddBtn" style="width:100%;font-size:.72rem;margin-bottom:8px">+ Add coverage</button>
      <button type="button" class="btn-sec" id="fluxSubSwapBtn" style="width:100%;font-size:.68rem;margin-bottom:8px" ${todaySubs.length < 2 ? 'disabled' : ''}>Swap selected covers</button>
      <div class="flux-sub-swap-list"></div>`;

    if (!mount.querySelector('#fluxSubStaffList')) {
      const dl = document.createElement('datalist');
      dl.id = 'fluxSubStaffList';
      dl.innerHTML = names.map((n) => `<option value="${esc(n)}">`).join('');
      mount.appendChild(dl);
    }

    const list = mount.querySelector('.flux-sub-swap-list');
    list.innerHTML = todaySubs.length
      ? todaySubs
          .map(
            (s, i) => `
        <label class="flux-sub-swap-row">
          <input type="checkbox" class="flux-sub-pick" data-idx="${i}">
          <span class="flux-sub-period">P${esc(s.period || '?')}</span>
          <span>${esc(s.absent || '?')} → <strong>${esc(s.cover || 'TBD')}</strong></span>
          <button type="button" class="flux-sub-del-btn" data-del="${i}" aria-label="Remove">×</button>
        </label>`,
          )
          .join('')
      : '<p class="flux-widget-planned">Add rows above or use Operations tab.</p>';

    mount.querySelector('#fluxSubAddBtn')?.addEventListener('click', () => {
      const period = mount.querySelector('#fluxSubPeriod')?.value?.trim();
      const absent = mount.querySelector('#fluxSubAbsent')?.value?.trim();
      const cover = mount.querySelector('#fluxSubCover')?.value?.trim() || 'TBD';
      if (!period || !absent) {
        if (typeof showToast === 'function') showToast('Period and absent teacher required', 'warn');
        return;
      }
      const next = subs.concat([{ date: today, period, absent, cover, note: '' }]);
      lsSet(SUB_KEY, next);
      renderSubSwap(mount);
      try {
        if (typeof renderAdminOps === 'function') renderAdminOps();
      } catch (_) {}
    });

    list.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-del'), 10);
        const target = todaySubs[idx];
        if (!target) return;
        const next = subs.filter(
          (s) => !(s.date === target.date && s.period === target.period && s.absent === target.absent),
        );
        lsSet(SUB_KEY, next);
        renderSubSwap(mount);
        try {
          if (typeof renderAdminOps === 'function') renderAdminOps();
        } catch (_) {}
      });
    });

    mount.querySelector('#fluxSubSwapBtn')?.addEventListener('click', () => {
      const picked = [...list.querySelectorAll('.flux-sub-pick:checked')].map((c) =>
        parseInt(c.getAttribute('data-idx'), 10),
      );
      if (picked.length !== 2) {
        if (typeof showToast === 'function') showToast('Select exactly two rows to swap covers', 'warn');
        return;
      }
      const a = todaySubs[picked[0]];
      const b = todaySubs[picked[1]];
      if (!a || !b) return;
      const coverA = a.cover;
      a.cover = b.cover;
      b.cover = coverA;
      const next = subs.map((s) => {
        if (s.date === a.date && s.period === a.period && s.absent === a.absent) return { ...a };
        if (s.date === b.date && s.period === b.period && s.absent === b.absent) return { ...b };
        return s;
      });
      lsSet(SUB_KEY, next);
      if (typeof showToast === 'function') showToast('Covers swapped', 'success');
      renderSubSwap(mount);
      try {
        if (typeof renderAdminOps === 'function') renderAdminOps();
      } catch (_) {}
    });
  }

  window.FluxAdminWidgets = {
    enabled,
    renderDutyAlerts,
    renderSubSwap,
    publishDutyLogs,
  };
})();
