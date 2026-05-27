/**
 * Site Enhancements Pack — 50 small UX, a11y, and productivity improvements.
 * CORE (Phase 37.1 PR-B): always on; flag key retained for DB metadata. See docs/SITE_IMPROVEMENTS_50.md
 */
(function () {
  'use strict';

  const FLAG = 'enable_site_enhancements_pack';
  const PREFS_KEY = 'flux_site_enh_prefs_v1';
  const BUILD = '2026.05.27-enh-pack';
  const PANEL_TITLES = {
    dashboard: 'Dashboard',
    calendar: 'Calendar',
    school: 'School',
    notes: 'Notes',
    goals: 'Goals',
    mood: 'Mood',
    timer: 'Focus',
    profile: 'Profile',
    ai: 'AI',
    settings: 'Settings',
    canvas: 'Google',
    toolbox: 'Toolbox',
    teacherDashboard: 'Teacher',
    counselorDashboard: 'Counselor',
    adminDashboard: 'Admin',
    staffWorkboard: 'Workboard',
    counselorMeetings: 'Meetings',
    counselorWorkspace: 'Caseload tools',
    staffResources: 'Resources',
    staffPersonalHub: 'Personal hub',
  };

  let _installed = false;
  let _gSeq = null;
  let _gTimer = null;
  let _sessionStart = Date.now();
  let _lastPanel = 'dashboard';
  let _notesDirty = false;
  let _modalFocus = null;

  function packEnabled() {
    return true; // CORE: enable_site_enhancements_pack (Phase 37.1 PR-B)
  }

  function loadPrefs() {
    try {
      const raw =
        (window.FluxStorage && FluxStorage.load && FluxStorage.load(PREFS_KEY, null)) ||
        JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      return raw && typeof raw === 'object' ? raw : {};
    } catch (_) {
      return {};
    }
  }

  function savePrefs(p) {
    try {
      if (window.FluxStorage?.save) FluxStorage.save(PREFS_KEY, p);
      else localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    } catch (_) {}
  }

  function pref(id, def) {
    const p = loadPrefs();
    if (p[id] === undefined) return def !== false;
    return !!p[id];
  }

  function setPref(id, on) {
    const p = loadPrefs();
    p[id] = !!on;
    savePrefs(p);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toast(msg, type) {
    if (typeof window.showToast === 'function') showToast(msg, type || 'info', 2800);
  }

  function currentUserId() {
    const u = typeof currentUser !== 'undefined' ? currentUser : window.currentUser;
    return u && u.id ? String(u.id) : '';
  }

  function role() {
    try {
      return typeof getMyRole === 'function' ? getMyRole() : 'student';
    } catch (_) {
      return 'student';
    }
  }

  function isReduceMotion() {
    return document.documentElement.classList.contains('flux-reduce-motion');
  }

  /* ── 1 Panel breadcrumb + 6 copy deep link ── */
  function installBreadcrumb() {
    const title = document.getElementById('topbarTitle');
    if (!title || document.getElementById('fluxPanelBreadcrumb')) return;
    const bc = document.createElement('span');
    bc.id = 'fluxPanelBreadcrumb';
    bc.className = 'flux-panel-breadcrumb topbar-desktop-only';
    bc.setAttribute('aria-hidden', 'true');
    title.parentNode.insertBefore(bc, title.nextSibling);
    document.addEventListener('flux-nav', (ev) => {
      if (!pref('panel_breadcrumb', true)) return;
      const pid = ev.detail && ev.detail.panel ? ev.detail.panel : _lastPanel;
      _lastPanel = pid;
      const label = PANEL_TITLES[pid] || pid;
      bc.innerHTML = `<span>${esc(label)}</span><button type="button" title="Copy link to this panel">⧉</button>`;
      const btn = bc.querySelector('button');
      if (btn) {
        btn.onclick = (e) => {
          e.stopPropagation();
          const url = `${location.origin}${location.pathname}?panel=${encodeURIComponent(pid)}`;
          navigator.clipboard
            ?.writeText(url)
            .then(() => toast('Panel link copied', 'success'))
            .catch(() => toast(url, 'info'));
        };
      }
    });
  }

  /* ── 2 Keyboard shortcuts overlay ── */
  function installShortcutsHelp() {
    document.addEventListener('keydown', (e) => {
      if (!pref('shortcuts_help', true)) return;
      if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      openShortcutsModal();
    });
  }

  function openShortcutsModal() {
    if (document.getElementById('fluxEnhShortcutsModal')) {
      document.getElementById('fluxEnhShortcutsModal').style.display = 'flex';
      return;
    }
    const wrap = document.createElement('div');
    wrap.id = 'fluxEnhShortcutsModal';
    wrap.className = 'modal-overlay flux-enh-shortcuts-modal flux-enh-no-print';
    wrap.style.display = 'flex';
    wrap.innerHTML = `<div class="modal" role="dialog" aria-labelledby="fluxEnhShortcutsTitle">
      <h3 id="fluxEnhShortcutsTitle">Keyboard shortcuts</h3>
      <ul style="margin:12px 0;padding-left:0;list-style:none;line-height:1.9;font-size:.82rem">
        <li><kbd>?</kbd> — This help</li>
        <li><kbd>Esc</kbd> — Close top modal</li>
        <li><kbd>g</kbd> then <kbd>d</kbd> — Dashboard</li>
        <li><kbd>g</kbd> then <kbd>s</kbd> — Settings</li>
        <li><kbd>Ctrl/Cmd</kbd>+<kbd>K</kbd> — Work ↔ Personal (educators)</li>
        <li><kbd>Ctrl/Cmd</kbd>+<kbd>Shift</kbd>+<kbd>K</kbd> — Global search</li>
      </ul>
      <button type="button" class="btn" onclick="document.getElementById('fluxEnhShortcutsModal').remove()">Close</button>
    </div>`;
    wrap.addEventListener('click', (ev) => {
      if (ev.target === wrap) wrap.remove();
    });
    document.body.appendChild(wrap);
  }

  /* ── 3 Esc closes modals ── */
  function installEscClose() {
    document.addEventListener('keydown', (e) => {
      if (!pref('esc_close_modal', true) || e.key !== 'Escape') return;
      const overlays = [...document.querySelectorAll('.modal-overlay')].filter(
        (el) => el.style.display !== 'none' && el.offsetParent !== null
      );
      const top = overlays[overlays.length - 1];
      if (!top) return;
      const closeBtn = top.querySelector('[data-flux-close], .modal-close, button.btn-sec');
      if (closeBtn) closeBtn.click();
      else top.remove();
      if (_modalFocus && typeof _modalFocus.focus === 'function') {
        try {
          _modalFocus.focus();
        } catch (_) {}
      }
    });
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (t && t.closest && t.closest('.modal-overlay button, .modal-overlay [onclick]')) {
        _modalFocus = document.activeElement;
      }
    });
  }

  /* ── 4 Double-click task complete ── */
  function installDblClickTask() {
    document.addEventListener('dblclick', (e) => {
      if (!pref('dblclick_task_done', true)) return;
      const row = e.target.closest('.task-item, .task-row, [data-task-id]');
      if (!row) return;
      const cb = row.querySelector('input[type="checkbox"], .task-check');
      if (cb) cb.click();
    });
  }

  /* ── 5 Relative due labels ── */
  function relDueLabel(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(d);
    due.setHours(0, 0, 0, 0);
    const diff = Math.round((due - today) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff > 1 && diff < 8) return `In ${diff} days`;
    if (diff < -1 && diff > -8) return `${-diff} days ago`;
    return '';
  }

  function installRelativeDue() {
    const apply = () => {
      if (!pref('relative_due_dates', true)) return;
      document.querySelectorAll('[data-due]').forEach((el) => {
        const rel = relDueLabel(el.getAttribute('data-due'));
        if (!rel) return;
        let span = el.querySelector('.flux-rel-due');
        if (!span) {
          span = document.createElement('span');
          span.className = 'flux-rel-due';
          span.style.cssText = 'font-size:.68rem;color:var(--muted);margin-left:6px';
          el.appendChild(span);
        }
        span.textContent = rel;
      });
    };
    document.addEventListener('flux-nav', apply);
    const obs = new MutationObserver(() => apply());
    const host = document.getElementById('dashboard');
    if (host) obs.observe(host, { childList: true, subtree: true });
    apply();
  }

  /* ── 7 Session stamp ── 8 Build stamp */
  function installSettingsStamps() {
    const mount = () => {
      const pane = document.getElementById('spane-data');
      if (!pane || document.getElementById('fluxEnhSessionStamp')) return;
      const card = document.createElement('div');
      card.className = 'card';
      card.id = 'fluxEnhSessionStamp';
      card.innerHTML = `<h3>Session &amp; build</h3>
        <p style="font-size:.78rem;color:var(--muted2);margin:0 0 8px;line-height:1.5">
          <span id="fluxEnhSessionLine">Session: —</span><br>
          <span id="fluxEnhBuildLine" style="font-family:'JetBrains Mono',monospace">Build: ${esc(BUILD)}</span>
        </p>`;
      pane.insertBefore(card, pane.firstChild);
    };
    document.addEventListener('flux-nav', (ev) => {
      if (ev.detail && ev.detail.panel === 'settings') {
        mount();
        const mins = Math.floor((Date.now() - _sessionStart) / 60000);
        const el = document.getElementById('fluxEnhSessionLine');
        if (el) el.textContent = `Session: ${mins < 1 ? '<1 min' : mins + ' min'} active`;
      }
    });
    setInterval(() => {
      const el = document.getElementById('fluxEnhSessionLine');
      if (!el) return;
      const mins = Math.floor((Date.now() - _sessionStart) / 60000);
      el.textContent = `Session: ${mins < 1 ? '<1 min' : mins + ' min'} active`;
    }, 60000);
  }

  /* ── 9 Storage quota warning ── */
  function installStorageWarn() {
    const check = () => {
      if (!pref('storage_warn', true)) return;
      const el = document.getElementById('storageMeter');
      if (!el || typeof estimateStorageBytes !== 'function') return;
      const b = estimateStorageBytes();
      el.classList.remove('flux-enh-storage-warn', 'flux-enh-storage-critical');
      if (b > 8 * 1048576) {
        el.classList.add('flux-enh-storage-critical');
        el.innerHTML +=
          '<br><strong style="font-size:.72rem">Storage is very full — export or clear old cache in Data settings.</strong>';
      } else if (b > 4 * 1048576) {
        el.classList.add('flux-enh-storage-warn');
      }
    };
    document.addEventListener('flux-nav', (ev) => {
      if (ev.detail && ev.detail.panel === 'settings') setTimeout(check, 400);
    });
  }

  /* ── 10 Reconnect toast ── */
  function installReconnectToast() {
    const banner = document.getElementById('connectivityBanner');
    if (!banner) return;
    let wasOffline = false;
    const obs = new MutationObserver(() => {
      if (!pref('reconnect_toast', true)) return;
      const visible = banner.style.display !== 'none' && banner.offsetParent;
      if (visible) wasOffline = true;
      else if (wasOffline) {
        wasOffline = false;
        toast('Back online', 'success');
      }
    });
    obs.observe(banner, { attributes: true, attributeFilter: ['style', 'class'] });
  }

  /* ── 11 Print CSS (linked file + class hook) ── */
  function installPrint() {
    document.documentElement.classList.add('flux-enh-print-ready');
  }

  /* ── 12 24h time preference ── */
  function installTimeFormat() {
    const fmt = (d) => {
      const use24 = pref('time_24h', false);
      return use24
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
        : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    };
    window.fluxEnhFormatTime = fmt;
    const tick = () => {
      const pill = document.getElementById('datePill');
      if (pill && pref('time_24h', false)) {
        const now = new Date();
        const datePart =
          typeof window.fluxFormatDate === 'function'
            ? window.fluxFormatDate(now, 'short')
            : now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
        pill.textContent = datePart + ' · ' + fmt(now);
      }
    };
    setInterval(tick, 30000);
    document.addEventListener('flux-nav', tick);
  }

  /* ── 13 Week starts Monday ── */
  function installWeekStart() {
    window.fluxWeekStartsMonday = () => pref('week_monday', true);
  }

  /* ── 14 Notes word count ── */
  function installNotesWordCount() {
    document.addEventListener('flux-nav', (ev) => {
      if (!pref('notes_word_count', true) || !ev.detail || ev.detail.panel !== 'notes') return;
      const ed = document.querySelector('#notesEditor, #noteBody, .note-editor textarea');
      if (!ed) return;
      let bar = document.getElementById('fluxNotesWordCount');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'fluxNotesWordCount';
        bar.style.cssText = 'font-size:.7rem;color:var(--muted);padding:4px 0';
        ed.parentNode.appendChild(bar);
      }
      const words = (ed.value || '').trim().split(/\s+/).filter(Boolean).length;
      bar.textContent = words ? `${words} word${words === 1 ? '' : 's'}` : '';
      if (!ed.dataset.fluxEnhWords) {
        ed.dataset.fluxEnhWords = '1';
        ed.addEventListener('input', () => {
          const w = (ed.value || '').trim().split(/\s+/).filter(Boolean).length;
          bar.textContent = w ? `${w} word${w === 1 ? '' : 's'}` : '';
          _notesDirty = true;
        });
      }
    });
  }

  /* ── 15 Task priority legend ── */
  function installTaskLegend() {
    document.addEventListener('flux-nav', (ev) => {
      if (!pref('task_priority_legend', true) || !ev.detail || ev.detail.panel !== 'dashboard') return;
      const host = document.getElementById('dashTasks') || document.querySelector('#dashboard .tasks-header');
      if (!host || document.getElementById('fluxTaskLegend')) return;
      const el = document.createElement('button');
      el.type = 'button';
      el.id = 'fluxTaskLegend';
      el.className = 'btn-sec flux-enh-no-print';
      el.style.cssText = 'font-size:.68rem;margin-left:8px;padding:4px 8px';
      el.textContent = 'Priority colors';
      el.title = 'High = warm, Medium = default, Low = muted';
      el.onclick = () => toast('High · warm accent — Medium · default — Low · muted', 'info', 4500);
      const h2 = host.querySelector('h2, h3, .section-title');
      if (h2) h2.appendChild(el);
    });
  }

  /* ── 16 Counselor pending badge ── 40 Student appointment badge */
  async function refreshAppointmentBadges() {
    if (!pref('appointment_badges', true)) return;
    const client = typeof getSB === 'function' ? getSB() : null;
    const uid = currentUserId();
    if (!client || !uid) return;
    const r = role();
    document.querySelectorAll('.flux-enh-nav-badge').forEach((n) => n.remove());
    try {
      if (r === 'counselor') {
        let cid = uid;
        if (window.FluxCounselorAppointments && typeof FluxCounselorAppointments.counselorId === 'function') {
          cid = (await FluxCounselorAppointments.counselorId()) || cid;
        } else if (typeof ensureCounselorRecord === 'function') {
          const row = await ensureCounselorRecord(client, 'counselor');
          if (row && row.id) cid = row.id;
        }
        const { count } = await client
          .from('counselor_appointments')
          .select('id', { count: 'exact', head: true })
          .eq('counselor_id', cid)
          .eq('status', 'pending');
        if (count > 0) attachBadge('[data-tab="counselorDashboard"], [data-tab="counselorMeetings"]', count);
      }
      if (r === 'student') {
        const pend = await client
          .from('counselor_appointments')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', uid)
          .eq('status', 'pending');
        const c = (pend && pend.count) || 0;
        if (c > 0) attachBadge('[data-tab="profile"]', c);
      }
    } catch (_) {}
  }

  function attachBadge(sel, n) {
    document.querySelectorAll(sel).forEach((btn) => {
      if (btn.querySelector('.flux-enh-nav-badge')) return;
      const b = document.createElement('span');
      b.className = 'flux-enh-nav-badge';
      b.textContent = n > 9 ? '9+' : String(n);
      btn.appendChild(b);
    });
  }

  /* ── 17 Teacher dashboard refresh ── */
  function installTeacherRefresh() {
    document.addEventListener('flux-nav', (ev) => {
      if (!pref('teacher_refresh', true) || !ev.detail || ev.detail.panel !== 'teacherDashboard') return;
      const body = document.getElementById('teacherDashboardBody');
      if (!body || document.getElementById('fluxTeacherRefresh')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'fluxTeacherRefresh';
      btn.className = 'btn-sec';
      btn.style.cssText = 'float:right;font-size:.72rem;margin-bottom:8px';
      btn.textContent = '↻ Refresh';
      btn.onclick = () => {
        if (typeof renderTeacherDashboard === 'function') renderTeacherDashboard();
        toast('Teacher dashboard refreshed', 'success');
      };
      body.prepend(btn);
    });
  }

  /* ── 18 Staff CSV export ── */
  function installStaffCsv() {
    document.addEventListener('flux-nav', (ev) => {
      if (!pref('staff_csv_export', true) || !ev.detail || ev.detail.panel !== 'staffWorkboard') return;
      const body = document.getElementById('staffWorkboardBody');
      if (!body || document.getElementById('fluxStaffCsvBtn')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'fluxStaffCsvBtn';
      btn.className = 'btn-sec';
      btn.style.cssText = 'font-size:.72rem;margin-bottom:8px';
      btn.textContent = '⬇ Export tickets CSV';
      btn.onclick = async () => {
        const sb = typeof getSB === 'function' ? getSB() : null;
        if (!sb) return toast('Sign in required', 'error');
        const { data, error } = await sb.from('staff_tickets').select('*').order('created_at', { ascending: false }).limit(500);
        if (error) return toast(error.message, 'error');
        const rows = data || [];
        const cols = ['id', 'title', 'status', 'priority', 'department', 'created_at'];
        const csv = [cols.join(',')]
          .concat(
            rows.map((r) =>
              cols.map((c) => `"${String(r[c] == null ? '' : r[c]).replace(/"/g, '""')}"`).join(',')
            )
          )
          .join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `flux-staff-tickets-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast('CSV downloaded', 'success');
      };
      body.prepend(btn);
    });
  }

  /* ── 19 Google hub status dot ── */
  function installGoogleDot() {
    const tick = () => {
      if (!pref('google_status_dot', true)) return;
      document.querySelectorAll('.staff-google-hub-mount, #teacherDashboardBody').forEach((host) => {
        if (!host || host.querySelector('.flux-enh-google-dot')) return;
        const dot = document.createElement('span');
        dot.className = 'flux-enh-google-dot';
        const tok = sessionStorage.getItem('flux_gmail_token') || '';
        if (tok) dot.classList.add('flux-enh-google-dot--on');
        host.prepend(dot);
      });
    };
    document.addEventListener('flux-nav', tick);
    setInterval(tick, 15000);
  }

  /* ── 20 Canvas last sync label ── */
  function installCanvasSyncLabel() {
    document.addEventListener('flux-nav', (ev) => {
      if (!pref('canvas_sync_label', true) || !ev.detail || ev.detail.panel !== 'canvas') return;
      const host = document.getElementById('canvas') || document.getElementById('fluxCanvasHub');
      if (!host) return;
      let el = document.getElementById('fluxCanvasSyncLabel');
      if (!el) {
        el = document.createElement('div');
        el.id = 'fluxCanvasSyncLabel';
        el.style.cssText = 'font-size:.68rem;color:var(--muted);padding:6px 0';
        host.prepend(el);
      }
      const ts = localStorage.getItem('flux_canvas_last_sync') || localStorage.getItem('flux_canvas_sync_at');
      el.textContent = ts ? `Last Canvas sync: ${new Date(ts).toLocaleString()}` : 'Canvas sync: not recorded this device';
    });
  }

  /* ── 21 Impersonation watermark ── */
  function installImpersonateBar() {
    const tick = () => {
      if (!pref('impersonate_bar', true)) return;
      let imp = false;
      try {
        imp = !!(window.FluxImpersonate && FluxImpersonate.active && FluxImpersonate.active());
      } catch (_) {}
      let bar = document.getElementById('fluxEnhImpersonateBar');
      if (imp && !bar) {
        bar = document.createElement('div');
        bar.id = 'fluxEnhImpersonateBar';
        bar.className = 'flux-enh-impersonate-bar';
        bar.setAttribute('aria-hidden', 'true');
        document.body.appendChild(bar);
      } else if (!imp && bar) bar.remove();
    };
    setInterval(tick, 2000);
  }

  /* ── 22 Unsaved notes guard ── */
  function installNotesGuard() {
    window.addEventListener('beforeunload', (e) => {
      if (!pref('notes_unsaved_guard', true) || !_notesDirty) return;
      e.preventDefault();
      e.returnValue = '';
    });
    document.addEventListener('flux-nav', () => {
      if (_lastPanel === 'notes' && _notesDirty) {
        /* allow nav but keep dirty until save — user can disable in settings */
      }
    });
  }

  /* ── 23 Focus timer dim chrome ── */
  function installFocusDim() {
    const tick = () => {
      if (!pref('focus_dim_chrome', true)) return;
      const running = !!document.querySelector('#timer.running, #timerPanel .timer-active, .flux-timer-running');
      document.body.classList.toggle('flux-focus-chrome-dim', running);
    };
    setInterval(tick, 1500);
  }

  /* ── 24 Recovery banner dismiss ── */
  function installRecoveryDismiss() {
    const key = 'flux_recovery_banner_dismissed';
    const banner = document.getElementById('recoveryBanner');
    if (!banner || !pref('recovery_dismiss', true)) return;
    if (localStorage.getItem(key) === '1') banner.style.display = 'none';
    if (!banner.querySelector('.flux-recovery-dismiss')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'flux-recovery-dismiss btn-sec';
      btn.style.cssText = 'margin-left:8px;font-size:.7rem';
      btn.textContent = 'Dismiss';
      btn.onclick = () => {
        localStorage.setItem(key, '1');
        banner.style.display = 'none';
      };
      banner.appendChild(btn);
    }
  }

  /* ── 25 Feedback quick links ── */
  function installFeedbackLinks() {
    const pane = document.getElementById('spane-data');
    if (!pane || document.getElementById('fluxEnhFeedbackLinks')) return;
    const card = document.createElement('div');
    card.id = 'fluxEnhFeedbackLinks';
    card.className = 'card';
    card.innerHTML = `<h3>Quick report</h3>
      <p style="font-size:.72rem;color:var(--muted2);margin:0 0 8px">One-tap categories for feedback.</p>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        <button type="button" class="btn-sec" data-cat="bug">🐛 Bug</button>
        <button type="button" class="btn-sec" data-cat="idea">💡 Idea</button>
        <button type="button" class="btn-sec" data-cat="ux">✨ UX</button>
      </div>`;
    card.querySelectorAll('button').forEach((b) => {
      b.onclick = () => {
        window.__fluxFeedbackCategory = b.getAttribute('data-cat');
        if (typeof openFluxFeedbackModal === 'function') openFluxFeedbackModal();
        else toast('Open Settings → feedback', 'info');
      };
    });
    const fb = pane.querySelector('.card');
    if (fb) pane.insertBefore(card, fb.nextSibling);
  }

  /* ── 26–27 g-then-key navigation ── */
  function installGNav() {
    document.addEventListener('keydown', (e) => {
      if (!pref('g_nav', true)) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'g') {
        _gSeq = 'g';
        clearTimeout(_gTimer);
        _gTimer = setTimeout(() => {
          _gSeq = null;
        }, 1200);
        return;
      }
      if (_gSeq === 'g') {
        if (e.key === 'd' && typeof nav === 'function') {
          e.preventDefault();
          nav('dashboard');
          _gSeq = null;
        } else if (e.key === 's' && typeof nav === 'function') {
          e.preventDefault();
          nav('settings');
          _gSeq = null;
        } else _gSeq = null;
      }
    });
  }

  /* ── 28 Copy user ID ── 29 Copy school code */
  function installCopyIds() {
    document.addEventListener('flux-nav', (ev) => {
      if (!ev.detail || ev.detail.panel !== 'settings') return;
      const acc = document.getElementById('spane-account');
      if (!acc || document.getElementById('fluxEnhCopyIds')) return;
      const uid = currentUserId();
      if (!uid) return;
      const wrap = document.createElement('div');
      wrap.id = 'fluxEnhCopyIds';
      wrap.className = 'card';
      wrap.innerHTML = `<h3>Copy identifiers</h3>
        <button type="button" class="btn-sec" id="fluxCopyUid" style="width:100%;margin-bottom:6px;font-size:.78rem">Copy user ID</button>
        <button type="button" class="btn-sec" id="fluxCopySchool" style="width:100%;font-size:.78rem">Copy school ID</button>`;
      acc.prepend(wrap);
      document.getElementById('fluxCopyUid').onclick = () => {
        navigator.clipboard?.writeText(uid).then(() => toast('User ID copied', 'success'));
      };
      document.getElementById('fluxCopySchool').onclick = () => {
        const sid =
          (window.FluxSchool && FluxSchool.current && FluxSchool.current.school_id) ||
          localStorage.getItem('flux_school_id') ||
          '';
        if (!sid) return toast('No school on file', 'warning');
        navigator.clipboard?.writeText(String(sid)).then(() => toast('School ID copied', 'success'));
      };
    });
  }

  /* ── 30 Reduced motion hint (once) ── */
  function installMotionHint() {
    if (!pref('motion_hint', true)) return;
    const key = 'flux_enh_motion_hint_shown';
    if (localStorage.getItem(key)) return;
    const mq = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
    if (!mq || !mq.matches) return;
    localStorage.setItem(key, '1');
    setTimeout(() => toast('System prefers reduced motion — enable in Settings → Look', 'info', 5000), 3000);
  }

  /* ── 31 Toast aria (reinforce) ── */
  function installToastAria() {
    const stack = document.getElementById('fluxToastStack');
    if (stack) {
      stack.setAttribute('aria-live', 'polite');
      stack.setAttribute('role', 'status');
    }
  }

  /* ── 32 Modal focus return — handled in esc ── */

  /* ── 33 Task flash on dashboard nav ── */
  function installTaskFlash() {
    window.__fluxEnhFlashTask = (taskId) => {
      if (!pref('task_flash', true) || !taskId) return;
      const el = document.querySelector(`[data-task-id="${taskId}"]`);
      if (el) {
        el.classList.add('flux-enh-task-flash');
        setTimeout(() => el.classList.remove('flux-enh-task-flash'), 1400);
      }
    };
  }

  /* ── 34 Greeting time emoji ── */
  function installGreetingEmoji() {
    document.addEventListener('flux-nav', (ev) => {
      if (!pref('greeting_emoji', true) || !ev.detail || ev.detail.panel !== 'dashboard') return;
      const g = document.getElementById('dashGreeting');
      if (!g || g.dataset.fluxEnhEmoji) return;
      const h = new Date().getHours();
      const em = h < 12 ? '☀️' : h < 17 ? '🌤' : '🌙';
      if (g.textContent && !g.textContent.includes(em)) g.textContent = em + ' ' + g.textContent;
      g.dataset.fluxEnhEmoji = '1';
    });
  }

  /* ── 35 Empty tasks CTA ── */
  function installEmptyTasksCta() {
    const tryInject = () => {
      if (!pref('empty_tasks_cta', true)) return;
      const list = document.getElementById('taskList');
      if (!list || list.children.length > 0 || document.getElementById('fluxEmptyTasksCta')) return;
      const cta = document.createElement('div');
      cta.id = 'fluxEmptyTasksCta';
      cta.style.cssText = 'text-align:center;padding:20px;color:var(--muted)';
      cta.innerHTML = `<p style="margin:0 0 10px">No tasks yet — add one or let AI plan your week.</p>
        <button type="button" class="btn" onclick="openDashAddTaskModal()">+ Add task</button>`;
      list.appendChild(cta);
    };
    document.addEventListener('flux-nav', tryInject);
    const obs = new MutationObserver(tryInject);
    const list = document.getElementById('taskList');
    if (list) obs.observe(list, { childList: true });
  }

  /* ── 36 Habit streak celebration ── */
  function installHabitCelebrate() {
    document.addEventListener('flux-nav', (ev) => {
      if (!pref('habit_celebrate', true) || isReduceMotion()) return;
      if (!ev.detail || ev.detail.panel !== 'dashboard') return;
      const key = `flux_habit_celebrate_${todayKey()}`;
      if (localStorage.getItem(key)) return;
      try {
        const habits = typeof load === 'function' ? load('habits', []) : [];
        const max = (habits || []).reduce((m, h) => Math.max(m, h.streak || 0), 0);
        if (max >= 7) {
          localStorage.setItem(key, '1');
          toast(`🔥 ${max}-day habit streak!`, 'success', 4000);
        }
      } catch (_) {}
    });
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  /* ── 37 SRS due pill ── 38 Momentum pill */
  function installTopbarPills() {
    const tick = () => {
      if (!pref('topbar_pills', true)) return;
      const srsEl = document.getElementById('abPill') || document.getElementById('topbarTaskPill');
      try {
        const cards = typeof load === 'function' ? load('srs_cards', []) : [];
        const due = (cards || []).filter((c) => c && c.due && new Date(c.due) <= new Date()).length;
        if (srsEl && due > 0) {
          srsEl.style.display = 'inline-flex';
          srsEl.textContent = `📚 ${due} review`;
        }
      } catch (_) {}
      const mom = document.getElementById('momentumPill');
      if (mom && window.FluxMomentumV2 && typeof FluxMomentumV2.score === 'function') {
        try {
          const s = FluxMomentumV2.score();
          if (s != null) {
            mom.style.display = 'inline-flex';
            mom.textContent = `⚡ ${Math.round(s)}`;
          }
        } catch (_) {}
      }
    };
    setInterval(tick, 20000);
    document.addEventListener('flux-nav', tick);
  }

  /* ── 39 Work-mode reminder ── */
  function installWorkModeReminder() {
    document.addEventListener('flux-nav', (ev) => {
      if (!pref('work_mode_reminder', true) || !ev.detail) return;
      const studentPanels = ['canvas', 'dashboard', 'ai', 'toolbox'];
      if (!studentPanels.includes(ev.detail.panel)) return;
      try {
        if (!FluxRole.isEducator || !FluxRole.isEducator() || !FluxRole.isWorkMode || !FluxRole.isWorkMode()) return;
      } catch (_) {
        return;
      }
      const key = 'flux_work_mode_reminder_' + todayKey();
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
      toast('Work mode: student panels route to your educator home', 'info', 4500);
    });
  }

  /* ── 41 Directory debounce ── */
  function installDirectoryDebounce() {
    document.querySelectorAll('#staffHub input[type="search"], .staff-directory-search').forEach((inp) => {
      if (inp.dataset.fluxEnhDebounced) return;
      inp.dataset.fluxEnhDebounced = '1';
      let t;
      const orig = inp.oninput;
      inp.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => {
          if (typeof orig === 'function') orig.call(inp);
        }, 220);
      });
    });
  }

  /* ── 42 autocomplete off staff forms ── */
  function installStaffAutofillOff() {
    document.querySelectorAll('#staffWorkboardBody form, #staffWorkboardBody input').forEach((el) => {
      if (el.tagName === 'FORM') el.setAttribute('autocomplete', 'off');
      else if (el.type === 'text' || el.type === 'search') el.setAttribute('autocomplete', 'off');
    });
  }

  /* ── 43 noreferrer on _blank ── */
  function installNoreferrer() {
    document.addEventListener('click', (e) => {
      if (!pref('noreferrer_blank', true)) return;
      const a = e.target.closest && e.target.closest('a[target="_blank"]');
      if (a) a.rel = (a.rel || '') + ' noopener noreferrer';
    });
    document.querySelectorAll('a[target="_blank"]').forEach((a) => {
      a.rel = (a.rel || '') + ' noopener noreferrer';
    });
  }

  /* ── 44 Lazy images ── */
  function installLazyImages() {
    const apply = () => {
      if (!pref('lazy_images', true)) return;
      document.querySelectorAll('img:not([loading])').forEach((img) => {
        img.loading = 'lazy';
      });
    };
    apply();
    const obs = new MutationObserver(apply);
    obs.observe(document.body, { childList: true, subtree: true });
  }

  /* ── 45 Tab title sync ── */
  function installTabTitle() {
    document.addEventListener('flux-nav', (ev) => {
      if (!pref('tab_title_sync', true) || !ev.detail) return;
      const label = PANEL_TITLES[ev.detail.panel] || ev.detail.panel;
      document.title = `${label} · Flux Planner`;
    });
  }

  /* ── 46 Scroll restore per panel ── */
  function installScrollRestore() {
    const key = (id) => `flux_scroll_${id}`;
    document.addEventListener('flux-nav', (ev) => {
      if (!pref('scroll_restore', true) || !ev.detail) return;
      const main = document.querySelector('.main-content');
      if (!main) return;
      try {
        sessionStorage.setItem(key(_lastPanel), String(main.scrollTop));
        const saved = sessionStorage.getItem(key(ev.detail.panel));
        if (saved != null) requestAnimationFrame(() => { main.scrollTop = parseInt(saved, 10) || 0; });
      } catch (_) {}
      _lastPanel = ev.detail.panel;
    });
  }

  /* ── 47 Context menu copy task title ── */
  function installTaskContextCopy() {
    document.addEventListener('contextmenu', (e) => {
      if (!pref('task_context_copy', true)) return;
      const row = e.target.closest('.task-item, .task-row, [data-task-id]');
      if (!row) return;
      const title = row.querySelector('.task-title, .task-name, h4, h3');
      const text = title ? title.textContent.trim() : '';
      if (text && navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => toast('Task copied', 'success', 1500));
      }
    });
  }

  /* ── 48 Confetti respects motion — habit uses toast only */

  /* ── 49 Settings enhancements toggles ── */
  function installSettingsToggles() {
    const pane = document.getElementById('spane-data');
    if (!pane || document.getElementById('fluxEnhSettingsCard')) return;
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'fluxEnhSettingsCard';
    card.innerHTML = `<h3>Site enhancements (50)</h3>
      <p style="font-size:.72rem;color:var(--muted2);margin:0 0 10px">Toggle individual items from the enhancement pack. Master flag: <code>${FLAG}</code>.</p>
      <div class="flux-enh-settings-list" id="fluxEnhSettingsList"></div>
      <button type="button" class="btn-sec" style="width:100%;margin-top:10px;font-size:.72rem" id="fluxEnhResetPrefs">Reset enhancement prefs</button>`;
    pane.insertBefore(card, pane.firstChild);
    const list = card.querySelector('#fluxEnhSettingsList');
    CATALOG.forEach((item) => {
      const id = item.pref || item.id;
      const label = document.createElement('label');
      label.innerHTML = `<input type="checkbox" data-pref="${esc(id)}" ${pref(id, true) ? 'checked' : ''}/> <span>${esc(item.title)}</span>`;
      label.querySelector('input').onchange = (ev) => {
        setPref(id, ev.target.checked);
        toast(ev.target.checked ? 'Enabled' : 'Disabled', 'info', 1200);
      };
      list.appendChild(label);
    });
    card.querySelector('#fluxEnhResetPrefs').onclick = () => {
      savePrefs({});
      toast('Enhancement prefs reset — reload to re-apply', 'info');
    };
  }

  /* ── 43 Soft panel back ── */
  const _navHistory = [];
  function installPanelBack() {
    document.addEventListener('flux-nav', (ev) => {
      if (!pref('panel_back', true) || !ev.detail) return;
      const pid = ev.detail.panel;
      if (_navHistory[_navHistory.length - 1] !== pid) _navHistory.push(pid);
      if (_navHistory.length > 12) _navHistory.shift();
    });
    const titleWrap = document.querySelector('.topbar-title-wrap');
    if (!titleWrap || document.getElementById('fluxPanelBack')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'fluxPanelBack';
    btn.className = 'mob-menu-btn topbar-desktop-only';
    btn.setAttribute('aria-label', 'Back');
    btn.textContent = '←';
    btn.style.marginRight = '4px';
    btn.onclick = () => {
      if (_navHistory.length > 1) {
        _navHistory.pop();
        const prev = _navHistory[_navHistory.length - 1];
        if (prev && typeof nav === 'function') nav(prev);
      } else if (typeof nav === 'function') nav('dashboard');
    };
    titleWrap.insertBefore(btn, titleWrap.firstChild);
  }

  /* ── 44 AI rate-limit friendly copy ── */
  function installAiRateHint() {
    const orig = window.showToast;
    if (!orig || orig.__fluxEnhWrapped) return;
    function wrapped(msg, type, dur) {
      const m = String(msg || '');
      if (
        pref('ai_rate_hint', true) &&
        /rate|limit|429|too many/i.test(m) &&
        !/friendly/i.test(m)
      ) {
        return orig.call(
          window,
          'AI is busy — wait a moment and try again.',
          type || 'warning',
          dur
        );
      }
      return orig.apply(window, arguments);
    }
    wrapped.__fluxEnhWrapped = true;
    window.showToast = wrapped;
  }

  /* ── 45 Profile completeness ── */
  function installProfileCompleteness() {
    document.addEventListener('flux-nav', (ev) => {
      if (!pref('profile_completeness', true) || !ev.detail || ev.detail.panel !== 'profile') return;
      const host = document.getElementById('profile');
      if (!host || document.getElementById('fluxProfileComplete')) return;
      let score = 0;
      const checks = [
        () => currentUserId(),
        () => typeof load === 'function' && (load('schoolInfo', {}) || {}).name,
        () => Array.isArray(tasks) && tasks.length > 0,
        () => Array.isArray(classes) && classes.length > 0,
      ];
      checks.forEach((fn) => {
        try {
          if (fn()) score += 25;
        } catch (_) {}
      });
      const el = document.createElement('div');
      el.id = 'fluxProfileComplete';
      el.className = 'card';
      el.style.marginBottom = '12px';
      el.innerHTML = `<h3>Profile completeness</h3>
        <div style="height:8px;border-radius:4px;background:var(--card2);overflow:hidden">
          <div style="width:${score}%;height:100%;background:var(--accent);transition:width .3s"></div>
        </div>
        <p style="font-size:.72rem;color:var(--muted2);margin:8px 0 0">${score}% — add classes and tasks to fill your planner.</p>`;
      host.prepend(el);
    });
  }

  /* ── 46 School feed “new” marker ── */
  function installSchoolFeedNew() {
    document.addEventListener('flux-nav', (ev) => {
      if (!ev.detail) return;
      if (ev.detail.panel === 'schoolFeedPanel' && pref('school_feed_new', true)) {
        try {
          localStorage.setItem('flux_school_feed_last_visit', String(Date.now()));
        } catch (_) {}
      }
      if (pref('school_feed_new', true)) {
        const last = parseInt(localStorage.getItem('flux_school_feed_last_visit') || '0', 10);
        const feedTs = parseInt(localStorage.getItem('flux_school_feed_latest') || '0', 10);
        if (feedTs > last) attachBadge('[data-tab="schoolFeedPanel"]', '!');
      }
    });
  }

  /* ── 47 Offline queue pill ── */
  function installOfflineQueuePill() {
    const tick = () => {
      if (!pref('offline_queue_pill', true)) return;
      const pill = document.getElementById('syncIndicator');
      if (!pill) return;
      let n = 0;
      try {
        const q = JSON.parse(localStorage.getItem('flux_offline_queue') || '[]');
        n = Array.isArray(q) ? q.length : 0;
      } catch (_) {}
      if (n > 0) {
        pill.style.display = 'inline-flex';
        pill.textContent = `Queue ${n}`;
        pill.classList.add('offline');
      }
    };
    setInterval(tick, 8000);
  }

  /* ── 48 Staff resources pin count ── */
  function installResourcesPinCount() {
    document.addEventListener('flux-nav', (ev) => {
      if (!pref('resources_pin_count', true) || !ev.detail || ev.detail.panel !== 'staffResources') return;
      try {
        const raw = localStorage.getItem('flux_staff_resources_pins');
        const pins = raw ? JSON.parse(raw) : [];
        const n = Array.isArray(pins) ? pins.length : 0;
        const t = document.getElementById('topbarTitle');
        if (t && n) t.textContent = `Resources (${n})`;
      } catch (_) {}
    });
  }

  /* ── 49 High-contrast quick toggle ── */
  function installContrastQuick() {
    const pane = document.getElementById('spane-appearance');
    if (!pane || document.getElementById('fluxEnhContrastQuick')) return;
    const row = document.createElement('div');
    row.className = 'srow';
    row.id = 'fluxEnhContrastQuick';
    row.style.border = 'none';
    row.innerHTML = `<div><div class="slabel">Quick high contrast</div>
      <div class="ssub">Toggle stronger contrast without opening accessibility suite.</div></div>
      <button type="button" class="toggle" id="fluxEnhContrastToggle" aria-pressed="false"></button>`;
    const card = pane.querySelector('.card');
    if (card) card.appendChild(row);
    const btn = row.querySelector('#fluxEnhContrastToggle');
    const sync = () => {
      const on = document.body.classList.contains('high-contrast');
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    };
    btn.onclick = () => {
      if (typeof toggleHighContrast === 'function') toggleHighContrast();
      else document.body.classList.toggle('high-contrast');
      sync();
    };
    sync();
  }

  /* ── 50 Privacy & security links ── */
  function installPrivacyLinks() {
    const pane = document.getElementById('spane-data');
    if (!pane || document.getElementById('fluxEnhPrivacyLinks')) return;
    const card = document.createElement('div');
    card.id = 'fluxEnhPrivacyLinks';
    card.className = 'card';
    card.innerHTML = `<h3>Privacy &amp; security</h3>
      <p style="font-size:.72rem;color:var(--muted2);margin:0 0 8px;line-height:1.5">
        Flux stores planner data in your browser and Supabase account. You control export and delete in Data settings.
      </p>
      <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" style="font-size:.78rem">Supabase privacy</a>`;
    pane.appendChild(card);
  }

  /* ── Deep link ?panel= on load ── */
  function installDeepLinkNav() {
    if (!pref('deep_link_panel', true)) return;
    setTimeout(() => {
      try {
        const p = new URLSearchParams(location.search).get('panel');
        if (!p || typeof nav !== 'function') return;
        if (!document.getElementById('app')?.classList.contains('visible')) return;
        if (!document.getElementById(p)) return;
        nav(p);
      } catch (_) {}
    }, 1200);
  }

  const CATALOG = [
    { id: 'panel_breadcrumb', pref: 'panel_breadcrumb', title: 'Panel breadcrumb + copy link' },
    { id: 'shortcuts_help', pref: 'shortcuts_help', title: 'Keyboard shortcuts overlay (?)' },
    { id: 'esc_close_modal', pref: 'esc_close_modal', title: 'Esc closes top modal' },
    { id: 'dblclick_task_done', pref: 'dblclick_task_done', title: 'Double-click task to complete' },
    { id: 'relative_due_dates', pref: 'relative_due_dates', title: 'Relative due date labels' },
    { id: 'session_build_stamp', pref: 'session_build_stamp', title: 'Session & build stamp in settings' },
    { id: 'storage_warn', pref: 'storage_warn', title: 'Storage quota warning' },
    { id: 'reconnect_toast', pref: 'reconnect_toast', title: 'Back-online toast' },
    { id: 'print_styles', pref: 'print_styles', title: 'Print-friendly layout' },
    { id: 'time_24h', pref: 'time_24h', title: '24-hour time in date pill' },
    { id: 'week_monday', pref: 'week_monday', title: 'Week starts Monday (API)' },
    { id: 'notes_word_count', pref: 'notes_word_count', title: 'Notes word count' },
    { id: 'task_priority_legend', pref: 'task_priority_legend', title: 'Task priority legend' },
    { id: 'appointment_badges', pref: 'appointment_badges', title: 'Appointment nav badges' },
    { id: 'teacher_refresh', pref: 'teacher_refresh', title: 'Teacher dashboard refresh' },
    { id: 'staff_csv_export', pref: 'staff_csv_export', title: 'Staff tickets CSV export' },
    { id: 'google_status_dot', pref: 'google_status_dot', title: 'Google connection status dot' },
    { id: 'canvas_sync_label', pref: 'canvas_sync_label', title: 'Canvas last-sync label' },
    { id: 'impersonate_bar', pref: 'impersonate_bar', title: 'Impersonation top bar' },
    { id: 'notes_unsaved_guard', pref: 'notes_unsaved_guard', title: 'Unsaved notes browser guard' },
    { id: 'focus_dim_chrome', pref: 'focus_dim_chrome', title: 'Dim chrome during focus timer' },
    { id: 'recovery_dismiss', pref: 'recovery_dismiss', title: 'Recovery banner dismiss' },
    { id: 'feedback_quick', pref: 'feedback_quick', title: 'Quick feedback categories' },
    { id: 'g_nav', pref: 'g_nav', title: 'g→d / g→s navigation' },
    { id: 'copy_ids', pref: 'copy_ids', title: 'Copy user & school IDs' },
    { id: 'motion_hint', pref: 'motion_hint', title: 'Reduced-motion system hint' },
    { id: 'toast_aria', pref: 'toast_aria', title: 'Toast stack ARIA' },
    { id: 'task_flash', pref: 'task_flash', title: 'Task highlight flash API' },
    { id: 'greeting_emoji', pref: 'greeting_emoji', title: 'Time-of-day greeting emoji' },
    { id: 'empty_tasks_cta', pref: 'empty_tasks_cta', title: 'Empty tasks call-to-action' },
    { id: 'habit_celebrate', pref: 'habit_celebrate', title: 'Habit streak celebration toast' },
    { id: 'topbar_pills', pref: 'topbar_pills', title: 'SRS / momentum topbar pills' },
    { id: 'work_mode_reminder', pref: 'work_mode_reminder', title: 'Educator work-mode routing reminder' },
    { id: 'directory_debounce', pref: 'directory_debounce', title: 'Staff directory search debounce' },
    { id: 'staff_autocomplete_off', pref: 'staff_autocomplete_off', title: 'Staff forms autocomplete off' },
    { id: 'noreferrer_blank', pref: 'noreferrer_blank', title: 'noopener on external links' },
    { id: 'lazy_images', pref: 'lazy_images', title: 'Lazy-load images' },
    { id: 'tab_title_sync', pref: 'tab_title_sync', title: 'Browser tab title sync' },
    { id: 'scroll_restore', pref: 'scroll_restore', title: 'Per-panel scroll restore' },
    { id: 'task_context_copy', pref: 'task_context_copy', title: 'Right-click copy task title' },
    { id: 'enh_settings_ui', pref: 'enh_settings_ui', title: 'Enhancement toggles in settings' },
    { id: 'deep_link_panel', pref: 'deep_link_panel', title: '?panel= deep links' },
    { id: 'panel_back', pref: 'panel_back', title: 'Panel back button in topbar' },
    { id: 'ai_rate_hint', pref: 'ai_rate_hint', title: 'Friendly AI rate-limit toasts' },
    { id: 'profile_completeness', pref: 'profile_completeness', title: 'Profile completeness meter' },
    { id: 'school_feed_new', pref: 'school_feed_new', title: 'School feed new marker' },
    { id: 'offline_queue_pill', pref: 'offline_queue_pill', title: 'Offline sync queue pill' },
    { id: 'resources_pin_count', pref: 'resources_pin_count', title: 'Staff resources pin count' },
    { id: 'contrast_quick', pref: 'contrast_quick', title: 'Quick high-contrast toggle' },
    { id: 'privacy_links', pref: 'privacy_links', title: 'Privacy links in settings' },
  ];

  const INSTALLERS = [
    installBreadcrumb,
    installShortcutsHelp,
    installEscClose,
    installDblClickTask,
    installRelativeDue,
    installSettingsStamps,
    installStorageWarn,
    installReconnectToast,
    installPrint,
    installTimeFormat,
    installWeekStart,
    installNotesWordCount,
    installTaskLegend,
    () => refreshAppointmentBadges(),
    installTeacherRefresh,
    installStaffCsv,
    installGoogleDot,
    installCanvasSyncLabel,
    installImpersonateBar,
    installNotesGuard,
    installFocusDim,
    installRecoveryDismiss,
    installFeedbackLinks,
    installGNav,
    installCopyIds,
    installMotionHint,
    installToastAria,
    installTaskFlash,
    installGreetingEmoji,
    installEmptyTasksCta,
    installHabitCelebrate,
    installTopbarPills,
    installWorkModeReminder,
    installDirectoryDebounce,
    installStaffAutofillOff,
    installNoreferrer,
    installLazyImages,
    installTabTitle,
    installScrollRestore,
    installTaskContextCopy,
    installSettingsToggles,
    installDeepLinkNav,
    installPanelBack,
    installAiRateHint,
    installProfileCompleteness,
    installSchoolFeedNew,
    installOfflineQueuePill,
    installResourcesPinCount,
    installContrastQuick,
    installPrivacyLinks,
  ];

  function install() {
    if (_installed || !packEnabled()) return;
    if (!currentUserId()) return;
    _installed = true;
    _sessionStart = Date.now();
    INSTALLERS.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.warn('[FluxSiteEnhancements]', e);
      }
    });
    if (window.__fluxEnhApptBadgeInterval) clearInterval(window.__fluxEnhApptBadgeInterval);
    window.__fluxEnhApptBadgeInterval = setInterval(refreshAppointmentBadges, 120000);
    document.addEventListener('flux-nav', () => {
      try {
        installDirectoryDebounce();
        installStaffAutofillOff();
      } catch (_) {}
    });
  }

  window.FluxSiteEnhancements = {
    install,
    catalog: () => CATALOG.slice(),
    build: BUILD,
    isEnabled: (id) => pref(id, true),
    setEnabled: setPref,
  };
})();
