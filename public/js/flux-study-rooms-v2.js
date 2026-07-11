/**
 * C8 — Study Rooms v2 (flag enable_study_rooms_v2).
 *
 * Makes the existing ephemeral co-work rooms (flux-cowork.js, untouched)
 * classroom-grade:
 *   - per-class room TEMPLATES: one tap starts a co-work room on the
 *     student's next open task for that class
 *   - REGISTRY heartbeat: the host mirrors {label, class_code, count} into
 *     flux_study_rooms so teachers get study-hall mode — room list +
 *     participant counts for their own classes only (no codes, no content;
 *     content is channel-broadcast and never touches the server)
 *   - GROUP FOCUS streak: ≥2 people together for ≥25 min earns a cosmetic
 *     grant through FluxSeasons.earn('group_focus') when C9 is present
 *     (falls back to one calm toast) — never grades-based
 *   - NAME GUARD: profanity/unkindness check on room labels (this module
 *     is the canonical guard; no prior moderation util existed)
 *
 * Wraps FluxCowork's exported lifecycle (openForTask/joinRoom/leaveRoom);
 * guests and flag-off users get the untouched v1 behavior.
 */
(function () {
  'use strict';
  if (window.FluxStudyRoomsV2) return;

  const FLAG = 'enable_study_rooms_v2';
  const HEARTBEAT_MS = 60000;
  const FOCUS_MS = 25 * 60 * 1000;

  function enabled() {
    try { return !!window.FluxFeatureFlags?.isEnabled(FLAG, false); } catch (_) { return false; }
  }
  function client() { return typeof window.getSB === 'function' ? window.getSB() : null; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function myRole() {
    try { return typeof getMyRole === 'function' ? getMyRole() : (window.FluxRole?.current || ''); } catch (_) { return ''; }
  }

  /* ── name guard (canonical; kindness-first copy) ── */

  const BLOCKED = [
    'fuck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'slut', 'whore',
    'fag', 'nigg', 'retard', 'rape', 'nazi', 'kys', 'kill yourself',
    'hate you', 'stupid idiots', 'losers only',
  ];

  function guardRoomLabel(label) {
    const raw = String(label || '').trim();
    if (!raw) return { ok: false, reason: 'Give the room a name.' };
    if (raw.length > 60) return { ok: false, reason: 'Keep the name under 60 characters.' };
    // Fold common leet substitutions BEFORE stripping, or "sh!t" reads as "sht".
    const folded = raw.toLowerCase()
      .replace(/[@4]/g, 'a').replace(/[!1|]/g, 'i').replace(/3/g, 'e')
      .replace(/0/g, 'o').replace(/[$5]/g, 's').replace(/7/g, 't')
      .replace(/[^a-z ]/g, '');
    const squashed = folded.replace(/\s+/g, '');
    for (const w of BLOCKED) {
      const needle = w.replace(/\s+/g, '');
      if (squashed.includes(needle)) {
        return { ok: false, reason: 'Pick a kinder room name — classmates will see it.' };
      }
    }
    return { ok: true, label: raw };
  }

  /* ── registry heartbeat (host only) ── */

  let _hb = null;
  let _sessionStart = 0;
  let _peakMembers = 1;
  let _focusGranted = false;
  let _classCode = null;
  let _label = '';

  function coworkState() {
    try { return window.FluxCowork?.state?.() || {}; } catch (_) { return {}; }
  }

  async function upsertRoom(active) {
    const sb = client();
    const st = coworkState();
    if (!sb || !window.currentUser || !st.room) return;
    const members = Object.keys(st.members || {}).length || 1;
    _peakMembers = Math.max(_peakMembers, members);
    try {
      await sb.from('flux_study_rooms').upsert({
        code: st.room,
        class_code: _classCode,
        label: _label || st.taskTitle || 'Study room',
        host_id: window.currentUser.id,
        school: String(window.FluxRole?.profile?.school || '').trim() || null,
        participants: members,
        active: !!active,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'code' });
    } catch (_) {}
  }

  function maybeGrantGroupFocus() {
    if (_focusGranted || !_sessionStart) return;
    if (_peakMembers >= 2 && Date.now() - _sessionStart >= FOCUS_MS) {
      _focusGranted = true;
      try { window.FluxTelemetry?.track?.('study_room_group_focus', {}); } catch (_) {}
      if (window.FluxSeasons?.earn) {
        try { window.FluxSeasons.earn('group_focus'); return; } catch (_) {}
      }
      showToast?.('25 minutes of group focus — nice, steady work together. ✨', 'success');
    }
  }

  function startHeartbeat(classCode, label) {
    stopHeartbeat(false);
    _classCode = classCode || null;
    _label = label || '';
    _sessionStart = Date.now();
    _peakMembers = 1;
    _focusGranted = false;
    upsertRoom(true);
    _hb = setInterval(() => {
      const st = coworkState();
      if (!st.room) { stopHeartbeat(true); return; }
      upsertRoom(true);
      maybeGrantGroupFocus();
    }, HEARTBEAT_MS);
  }

  function stopHeartbeat(deactivate) {
    if (_hb) { clearInterval(_hb); _hb = null; }
    if (deactivate) {
      maybeGrantGroupFocus();
      upsertRoom(false);
    }
    _sessionStart = 0;
  }

  /* ── wrap the cowork lifecycle (v1 untouched when flag off) ── */

  function wireCowork() {
    const FC = window.FluxCowork;
    if (!FC || FC._v2Wired) return;
    FC._v2Wired = true;
    const origOpen = FC.openForTask;
    const origLeave = FC.leaveRoom;
    FC.openForTask = function (taskId, opts) {
      const r = origOpen.apply(this, arguments);
      if (enabled()) {
        setTimeout(() => {
          const st = coworkState();
          if (st.room && st.isHost) startHeartbeat(opts && opts.classCode, opts && opts.label);
        }, 1200);
      }
      return r;
    };
    FC.leaveRoom = function () {
      const wasHost = coworkState().isHost;
      const r = origLeave.apply(this, arguments);
      if (enabled() && wasHost) stopHeartbeat(true);
      return r;
    };
    window.fluxOpenCowork = FC.openForTask;
  }

  /* ── per-class templates (student School panel) ── */

  function startClassRoom(classId) {
    const c = (window.classes || []).find((x) => x.id === classId);
    if (!c) return false;
    const guard = guardRoomLabel(c.name + ' study room');
    if (!guard.ok) { showToast?.(guard.reason, 'warning'); return false; }
    const subjKey = 'CLS' + classId;
    const next = (window.tasks || [])
      .filter((t) => t && !t.done && t.subject === subjKey)
      .sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')))[0];
    if (!next) {
      showToast?.('Add a task for ' + c.name + ' first — rooms co-work on a real task.', 'info', 6000);
      return false;
    }
    if (typeof window.fluxOpenCowork !== 'function') return false;
    window.fluxOpenCowork(next.id, { classCode: c.teacherClassCode || null, label: guard.label });
    try { window.FluxTelemetry?.track?.('study_room_template_started', {}); } catch (_) {}
    return true;
  }

  function injectTemplates() {
    if (!enabled() || myRole() === 'teacher' || myRole() === 'counselor' || myRole() === 'admin') return;
    const panel = document.getElementById('school');
    if (!panel || document.getElementById('fluxStudyRoomTemplates')) return;
    const cls = (window.classes || []).filter((c) => c.name);
    if (!cls.length) return;
    const card = document.createElement('div');
    card.id = 'fluxStudyRoomTemplates';
    card.className = 'card';
    card.style.cssText = 'margin-top:14px;padding:16px';
    card.innerHTML = `<div style="font-weight:800;margin-bottom:2px">Study rooms</div>
      <div style="font-size:.74rem;color:var(--muted2);margin-bottom:10px">Start a co-work room on your next task for a class — share the code, work the checklist together.</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${cls.map((c) => `<button type="button" class="btn-sec" data-srv2-class="${c.id}" style="padding:5px 12px;font-size:.76rem">▶ ${esc(c.name)}</button>`).join('')}
      </div>`;
    panel.appendChild(card);
    card.querySelectorAll('[data-srv2-class]').forEach((b) =>
      b.addEventListener('click', () => startClassRoom(Number(b.dataset.srv2Class))));
  }

  /* ── teacher study-hall card (Lesson Hub) ── */

  function renderStudyHall(host, byClass) {
    const rows = byClass
      .filter((c) => c.rooms.length)
      .map((c) => `<div style="margin-top:8px"><div style="font-size:.78rem;font-weight:700">${esc(c.name)}</div>
        ${c.rooms.map((r) => `<div style="font-size:.76rem;color:var(--text2);padding:3px 0">🟢 ${esc(r.label)} — ${r.participants} studying</div>`).join('')}
      </div>`).join('');
    host.innerHTML = `<div style="font-weight:800;margin-bottom:2px">Study hall</div>
      <div style="font-size:.72rem;color:var(--muted2);margin-bottom:6px">Live rooms for your classes — counts only, never the room content.</div>
      ${rows || '<div style="font-size:.76rem;color:var(--muted)">No live rooms right now.</div>'}`;
  }

  async function injectStudyHall() {
    if (!enabled() || myRole() !== 'teacher') return;
    const panel = document.getElementById('lessonHub');
    if (!panel) return;
    document.getElementById('fluxStudyHall')?.remove();
    const sb = client();
    if (!sb || !window.currentUser) return;
    const { data: myClasses } = await sb.from('teacher_classes')
      .select('class_code,class_name').eq('teacher_id', window.currentUser.id).eq('active', true);
    if (!myClasses || !myClasses.length) return;
    const byClass = [];
    for (const c of myClasses) {
      try {
        const { data } = await sb.rpc('flux_teacher_study_hall', { p_class_code: c.class_code });
        byClass.push({ name: c.class_name, rooms: data?.ok ? (data.rooms || []) : [] });
      } catch (_) { byClass.push({ name: c.class_name, rooms: [] }); }
    }
    const host = document.createElement('div');
    host.id = 'fluxStudyHall';
    host.className = 'card';
    host.style.cssText = 'margin-top:14px;padding:14px';
    panel.appendChild(host);
    renderStudyHall(host, byClass);
  }

  function boot() {
    wireCowork();
    document.addEventListener('flux-nav', (e) => {
      const p = e?.detail?.panel;
      if (!enabled()) return;
      if (p === 'school') setTimeout(injectTemplates, 400);
      if (p === 'lessonHub') setTimeout(injectStudyHall, 500);
    });
    // Cowork loads in the same bundle; wire again after boot settles.
    setTimeout(wireCowork, 2000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.FluxStudyRoomsV2 = {
    FLAG, enabled, guardRoomLabel, startClassRoom,
    injectTemplates, injectStudyHall, renderStudyHall,
    _maybeGrantGroupFocus: maybeGrantGroupFocus,
  };
})();
