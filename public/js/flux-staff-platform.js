/**
 * Flux staff platform — verification signup, educator personal mode UI,
 * meeting notes / PD / wellbeing / feed. Loaded after app.js.
 * Relies on: getSB, currentUser, showToast, esc, getTimeGreeting, renderEmptyState,
 * timeAgo, FluxRole, nav, buildEduModal (optional), fluxEnsureThreadAndSend, isOwner.
 */
(function () {
  const StaffSignup = { userId: null, email: null, selectedDirectoryEntry: null, step: 1 };
  let allDirectoryEntries = [];

  function sb() {
    return typeof getSB === 'function' ? getSB() : null;
  }

  function fmtLongDay(d) {
    if (typeof window.fluxFmtStaffDate === 'function') return window.fluxFmtStaffDate(d, 'weekday');
    if (typeof window.fmtFluxDate === 'function') return window.fmtFluxDate(d, 'weekday');
    return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function showStaffOnboarding() {
    if (document.getElementById('staffOnboarding')) return;
    const overlay = document.createElement('div');
    overlay.id = 'staffOnboarding';
    overlay.style.cssText =
      'position:fixed;inset:0;background:var(--bg);z-index:1002;overflow-y:auto;display:flex;align-items:flex-start;justify-content:center;padding:40px 20px';
    overlay.innerHTML = `
      <div style="max-width:520px;width:100%;margin:32px auto 48px">
        <div style="text-align:center;margin-bottom:28px">
          <div style="font-size:1.55rem;font-weight:800;letter-spacing:-.5px;margin-bottom:6px">Staff account setup</div>
          <div style="font-size:.85rem;color:var(--muted2);line-height:1.55">Teachers, counselors, and school staff. Your school admin verifies you before work tools activate.</div>
        </div>
        <div class="staff-steps" id="staffSteps" style="display:flex;gap:0;margin-bottom:24px">
          <div class="sstep active" data-step="1"><span>1</span>Create</div>
          <div class="sstep" data-step="2"><span>2</span>Directory</div>
          <div class="sstep" data-step="3"><span>3</span>Submit</div>
        </div>
        <div id="staffStep1">
          <div class="mrow"><label>Email *</label><input id="sEmail" type="email" autocomplete="email" placeholder="you@email.com"></div>
          <div class="mrow"><label>Password *</label><input id="sPassword" type="password" autocomplete="new-password" placeholder="At least 8 characters"></div>
          <div style="background:rgba(var(--accent-rgb),.06);border:1px solid rgba(var(--accent-rgb),.15);border-radius:12px;padding:12px 16px;margin-bottom:14px;font-size:.78rem;color:var(--muted2);line-height:1.55">
            Use any email to register. You will match your school directory next; your school email can be confirmed there.
          </div>
          <div id="s1Error" class="form-error" style="display:none"></div>
          <button type="button" class="onboard-next-btn" style="width:100%;margin-bottom:8px">Continue →</button>
          <button type="button" class="onboard-skip-btn" style="width:100%">Already have an account? Sign in</button>
        </div>
        <div id="staffStep2" style="display:none">
          <p style="font-size:.85rem;color:var(--muted2);margin-bottom:12px">Find your name in the directory.</p>
          <input id="staffSearch" placeholder="Search…" style="width:100%;padding:11px 14px;border-radius:12px;margin-bottom:10px">
          <div id="staffDirectoryList" style="max-height:280px;overflow-y:auto;margin-bottom:12px"><div class="dir-loading">Loading…</div></div>
          <div id="selectedStaffCard" style="display:none;padding:12px;border-radius:14px;background:rgba(var(--accent-rgb),.08);border:1px solid rgba(var(--accent-rgb),.22);margin-bottom:12px"></div>
          <div class="mrow" id="schoolEmailRow" style="display:none"><label>School email</label><input id="sSchoolEmail" type="email" placeholder="you@school.edu"></div>
          <div id="s2Error" class="form-error" style="display:none"></div>
          <button type="button" id="step2NextBtn" class="onboard-next-btn" style="width:100%;margin-bottom:8px;opacity:.5" disabled>Continue →</button>
          <button type="button" class="onboard-skip-btn" style="width:100%">← Back</button>
        </div>
        <div id="staffStep3" style="display:none">
          <div id="step3Summary" style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:14px;margin-bottom:14px;font-size:.82rem"></div>
          <div class="mrow"><label>Why do you need Flux staff access?</label>
            <textarea id="sRequestNote" placeholder="Short note for your administrator…" style="min-height:72px;resize:none"></textarea></div>
          <div id="s3Error" class="form-error" style="display:none"></div>
          <button type="button" class="onboard-next-btn" style="width:100%;margin-bottom:8px">Submit for verification</button>
          <button type="button" class="onboard-skip-btn" style="width:100%">← Back</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#staffStep1 .onboard-next-btn').addEventListener('click', staffStep1Next);
    overlay.querySelector('#staffStep1 .onboard-skip-btn').addEventListener('click', () => {
      overlay.remove();
      if (typeof showLoginScreen === 'function') showLoginScreen();
    });
    overlay.querySelector('#staffSearch').addEventListener('input', (e) => searchStaffDirectory(e.target.value));
    overlay.querySelector('#staffStep2 .onboard-next-btn').addEventListener('click', staffStep2Next);
    overlay.querySelector('#staffStep2 .onboard-skip-btn').addEventListener('click', () => goToStaffStep(1));
    overlay.querySelector('#staffStep3 .onboard-next-btn').addEventListener('click', submitStaffVerificationRequest);
    overlay.querySelector('#staffStep3 .onboard-skip-btn').addEventListener('click', () => goToStaffStep(2));
    void loadStaffDirectory();
  }

  async function staffStep1Next() {
    const email = document.getElementById('sEmail')?.value.trim();
    const password = document.getElementById('sPassword')?.value;
    const errEl = document.getElementById('s1Error');
    const setErr = (t) => {
      if (errEl) {
        errEl.textContent = t;
        errEl.style.display = 'block';
      }
    };
    if (!email || !password) {
      setErr('Email and password are required');
      return;
    }
    if (password.length < 8) {
      setErr('Password must be at least 8 characters');
      return;
    }
    const client = sb();
    if (!client) {
      setErr('Auth not ready');
      return;
    }
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { role_pending: 'staff' } },
    });
    if (error) {
      setErr(error.message);
      return;
    }
    StaffSignup.userId = data.user?.id;
    StaffSignup.email = email;
    if (data.user) {
      await client.from('user_roles').upsert({
        user_id: data.user.id,
        role: 'student',
        display_name: email.split('@')[0],
        updated_at: new Date().toISOString(),
      });
    }
    goToStaffStep(2);
  }

  async function loadStaffDirectory() {
    const client = sb();
    if (!client) return;
    const { data } = await client
      .from('staff_directory')
      .select('*')
      .eq('active', true)
      .eq('is_claimed', false)
      .order('full_name');
    allDirectoryEntries = data || [];
    renderDirectoryList(allDirectoryEntries);
  }

  function renderDirectoryList(entries) {
    const list = document.getElementById('staffDirectoryList');
    if (!list) return;
    if (!entries.length) {
      const isFiltered = (document.getElementById('staffSearch')?.value || '').trim().length > 0;
      list.innerHTML = isFiltered
        ? `<div style="text-align:center;padding:20px;font-size:.82rem;color:var(--muted2);line-height:1.6">
            <div style="font-size:1.5rem;margin-bottom:8px" class="flux-empty-icon">🔍</div>
            <div style="font-weight:700;color:var(--text);margin-bottom:4px">No matches</div>
            Try a different name or department.
          </div>`
        : `<div style="text-align:center;padding:22px 16px;font-size:.82rem;color:var(--muted2);line-height:1.6">
            <div style="font-size:1.8rem;margin-bottom:10px" class="flux-empty-icon">🏫</div>
            <div style="font-weight:700;color:var(--text);margin-bottom:5px">Directory not set up yet</div>
            Your admin hasn't added staff to the directory, or your school isn't on Flux yet.<br><br>
            <button type="button" style="padding:8px 18px;border-radius:12px;background:rgba(var(--accent-rgb),.1);border:1px solid rgba(var(--accent-rgb),.25);color:var(--accent);font-size:.8rem;font-weight:700;cursor:pointer" onclick="(function(){const e=window.FluxStaffPlatform&&FluxStaffPlatform.StaffSignup;if(e){e.selectedDirectoryEntry={id:'manual',full_name:e.email?e.email.split('@')[0]:'Educator',role:'staff',school_email:'',department:''}}const b=document.getElementById('step2NextBtn');if(b){b.disabled=false;b.style.opacity='1'}})()">Continue without matching →</button>
          </div>`;
      return;
    }
    const icons = { teacher: '👩‍🏫', counselor: '💬', staff: '🏫', admin: '🎓' };
    list.innerHTML = entries
      .map(
        (e) => `
      <button type="button" class="dir-entry" data-dir-id="${esc(e.id)}"
        style="display:flex;width:100%;align-items:center;gap:10px;padding:11px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);margin-bottom:6px;cursor:pointer;text-align:left;font:inherit;color:inherit">
        <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--accent),#7c5cff);display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:800;color:#fff;flex-shrink:0">${esc(
          String(e.full_name || '?')[0]
        )}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.86rem;font-weight:700">${esc(e.full_name)}</div>
          <div style="font-size:.72rem;color:var(--muted2)">${icons[e.role] || '👤'} ${esc(e.role)}${
          e.department ? ' · ' + esc(e.department) : ''
        }</div>
        </div>
      </button>`
      )
      .join('');
    list.querySelectorAll('.dir-entry').forEach((btn) => {
      btn.addEventListener('click', () => selectDirectoryEntry(btn.getAttribute('data-dir-id')));
    });
  }

  function searchStaffDirectory(q) {
    const qq = (q || '').toLowerCase();
    const filtered = !qq
      ? allDirectoryEntries
      : allDirectoryEntries.filter(
          (e) =>
            (e.full_name || '').toLowerCase().includes(qq) ||
            (e.department || '').toLowerCase().includes(qq) ||
            (e.subject || '').toLowerCase().includes(qq)
        );
    renderDirectoryList(filtered);
  }

  function selectDirectoryEntry(id) {
    const entry = allDirectoryEntries.find((e) => e.id === id);
    if (!entry) return;
    StaffSignup.selectedDirectoryEntry = entry;
    document.querySelectorAll('.dir-entry').forEach((el) => {
      el.style.borderColor = 'rgba(255,255,255,.08)';
      el.style.background = 'rgba(255,255,255,.03)';
    });
    const clicked = document.querySelector('.dir-entry[data-dir-id="' + id + '"]');
    if (clicked) {
      clicked.style.borderColor = 'var(--accent)';
      clicked.style.background = 'rgba(var(--accent-rgb),.08)';
    }
    const card = document.getElementById('selectedStaffCard');
    if (card) {
      card.style.display = 'block';
      card.innerHTML = `<div style="font-weight:700">${esc(entry.full_name)}</div><div style="font-size:.75rem;color:var(--muted2)">${esc(
        entry.role
      )}${entry.school_email ? ' · ' + esc(entry.school_email) : ''}</div>`;
    }
    const row = document.getElementById('schoolEmailRow');
    if (row && entry.school_email) {
      row.style.display = 'block';
      const inp = document.getElementById('sSchoolEmail');
      if (inp) inp.placeholder = entry.school_email;
    }
    const btn = document.getElementById('step2NextBtn');
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  }

  function staffStep2Next() {
    if (!StaffSignup.selectedDirectoryEntry) {
      const e = document.getElementById('s2Error');
      if (e) {
        e.textContent = 'Pick your directory row';
        e.style.display = 'block';
      }
      return;
    }
    const entry = StaffSignup.selectedDirectoryEntry;
    const sum = document.getElementById('step3Summary');
    const sch = document.getElementById('sSchoolEmail')?.value?.trim() || '';
    if (sum) {
      sum.innerHTML = `<div style="font-weight:800;margin-bottom:8px">Summary</div>
        <div><b>Name:</b> ${esc(entry.full_name)}</div>
        <div><b>Role:</b> ${esc(entry.role)}</div>
        <div><b>Account email:</b> ${esc(StaffSignup.email || '')}</div>
        ${sch ? `<div><b>School email:</b> ${esc(sch)}</div>` : ''}`;
    }
    goToStaffStep(3);
  }

  function goToStaffStep(step) {
    StaffSignup.step = step;
    [1, 2, 3].forEach((n) => {
      const pane = document.getElementById('staffStep' + n);
      if (pane) pane.style.display = n === step ? 'block' : 'none';
      const dot = document.querySelector('#staffSteps .sstep[data-step="' + n + '"]');
      if (dot) dot.classList.toggle('active', n <= step);
    });
  }

  async function submitStaffVerificationRequest() {
    const client = sb();
    if (!client || !StaffSignup.userId || !StaffSignup.selectedDirectoryEntry) {
      if (!StaffSignup.selectedDirectoryEntry) {
        if (typeof showToast === 'function') showToast('Select your directory entry first', 'warning');
      }
      return;
    }
    // Show loading state on button
    const submitBtn = document.querySelector('#staffStep3 .onboard-next-btn');
    if (submitBtn) {
      submitBtn.classList.add('flux-btn-loading');
      submitBtn.textContent = 'Submitting…';
      submitBtn.disabled = true;
    }
    // Progress shimmer
    const shimmer = document.createElement('div');
    shimmer.className = 'flux-submit-progress';
    submitBtn?.parentNode?.insertBefore(shimmer, submitBtn?.nextSibling);
    const entry = StaffSignup.selectedDirectoryEntry;
    const note = document.getElementById('sRequestNote')?.value.trim() || '';
    const schoolEmail = document.getElementById('sSchoolEmail')?.value.trim() || entry.school_email || '';
    const err = document.getElementById('s3Error');
    const { error } = await client.from('staff_verification_requests').upsert(
      {
        user_id: StaffSignup.userId,
        requested_role: entry.role,
        requested_name: entry.full_name,
        school: entry.school || '',
        department: entry.department || '',
        subject: entry.subject || '',
        school_email: schoolEmail,
        personal_gmail: StaffSignup.email || '',
        applicant_note: note,
        verification_status: 'pending',
      },
      { onConflict: 'user_id' }
    );
    if (error) {
      if (err) {
        err.textContent = error.message;
        err.style.display = 'block';
      }
      return;
    }
    await client
      .from('staff_directory')
      .update({ is_claimed: true, claimed_by: StaffSignup.userId, claimed_at: new Date().toISOString() })
      .eq('id', entry.id)
      .eq('is_claimed', false);
    // Replace onboarding with polished pending state
    const overlay = document.getElementById('staffOnboarding');
    if (overlay) {
      const wrap = overlay.querySelector('[style*="max-width"]');
      if (wrap) {
        wrap.innerHTML = `
          <div class="flux-pending-card" style="margin-top:20px">
            <span class="flux-pending-icon">⏳</span>
            <div style="font-size:1.4rem;font-weight:800;margin-bottom:8px">Request submitted!</div>
            <div style="font-size:.88rem;color:var(--muted2);line-height:1.6;margin-bottom:18px">
              Your admin will review and approve your staff access.<br>
              You'll be notified here and via messaging when it's approved.
            </div>
            <div class="flux-pending-badge" style="margin:0 auto 18px;width:fit-content">
              <span class="flux-pending-dot"></span> Verification pending
            </div>
            <div style="font-size:.78rem;color:var(--muted2);margin-bottom:16px">
              <b>In the meantime</b> — you can use Flux as a personal planner.<br>
              Your work dashboard activates automatically once approved.
            </div>
            <button type="button" class="onboard-next-btn" style="width:100%;margin-top:4px" id="pendingEnterBtn">Open personal planner →</button>
          </div>`;
        overlay.querySelector('#pendingEnterBtn')?.addEventListener('click', async () => {
          overlay.remove();
          const sess = await client.auth.getSession();
          if (sess?.data?.session && typeof handleSignedIn === 'function') {
            await handleSignedIn(sess.data.session.user, sess.data.session);
          }
        });
        // Auto-dismiss after 8s
        setTimeout(() => {
          overlay.querySelector('#pendingEnterBtn')?.click();
        }, 8000);
        return;
      }
    }
    if (typeof showToast === 'function') showToast('Request submitted. You can use personal planner until approved.', 'success', 5000);
    const sess = await client.auth.getSession();
    if (sess?.data?.session && typeof handleSignedIn === 'function') await handleSignedIn(sess.data.session.user, sess.data.session);
  }

  async function maybeApplyApprovedStaffVerification() {
    const client = sb();
    if (!client || !currentUser) return false;
    try {
      const { data: v } = await client
        .from('staff_verification_requests')
        .select('verification_status,requested_role,requested_name')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      if (!v || v.verification_status !== 'approved') return false;
      const { data: ur } = await client.from('user_roles').select('role').eq('user_id', currentUser.id).maybeSingle();
      if (!ur || ur.role !== 'student') return false;
      await client
        .from('user_roles')
        .update({
          role: v.requested_role,
          display_name: v.requested_name || null,
          school: (window.FluxSchool?.IAE?.name || 'International Academy East'),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', currentUser.id);
      if (typeof FluxRole?.load === 'function') await FluxRole.load();
      return true;
    } catch (_) {
      return false;
    }
  }

  function renderStaffWorkHub() {
    const el = document.getElementById('staffHub');
    if (!el) return;
    const name =
      (typeof FluxRole !== 'undefined' && FluxRole.profile && FluxRole.profile.display_name) ||
      currentUser?.user_metadata?.full_name ||
      currentUser?.email?.split('@')[0] ||
      'there';
    const first =
      String(name)
        .split(/\s+/)
        .filter((w) => !['Mr.', 'Mrs.', 'Ms.', 'Dr.'].includes(w))[0] || name;
    const role = (typeof FluxRole !== 'undefined' && FluxRole.current) || 'staff';
    const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
    const go = (id, renderFn) => {
      if (typeof nav === 'function') nav(id);
      if (renderFn) renderFn();
    };
    el.innerHTML = `
    <div class="staff-personal-dash">
      <div class="spd-greeting">
        <div class="spd-hello">${esc(typeof getTimeGreeting === 'function' ? getTimeGreeting() : 'Hello')}, ${esc(first)}</div>
        <div class="spd-sub">${esc(roleLabel)} · Work mode · ${esc(fmtLongDay(new Date()))}</div>
      </div>
      <div class="spd-mode-hint"><span class="spd-mode-icon">🏫</span><span>Meetings, PD, and wellbeing live here. Use <b>Calendar</b> in Main for your planner schedule.</span></div>
      <div class="spd-grid">
        <div class="spd-card" data-spd-nav="staffMeetingNotes" data-spd-render="meetingNotes"><div class="spd-card-icon">📋</div><div class="spd-card-title">Meetings</div><div class="spd-card-sub">Notes, decisions, action items</div></div>
        <div class="spd-card" data-spd-nav="staffPD" data-spd-render="pd"><div class="spd-card-icon">🎓</div><div class="spd-card-title">PD</div><div class="spd-card-sub">Professional development log</div></div>
        <div class="spd-card" data-spd-nav="staffWellbeing" data-spd-render="wellbeing"><div class="spd-card-icon">🌿</div><div class="spd-card-title">Wellbeing</div><div class="spd-card-sub">Energy &amp; check-ins</div></div>
      </div>
    </div>`;
    el.innerHTML = el.innerHTML.replace(/<motion[^>]*><\/motion>\s*/g, '').replace(/<\/motion>/g, '');
    el.querySelectorAll('[data-spd-nav]').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-spd-nav');
        const kind = card.getAttribute('data-spd-render');
        if (kind === 'meetingNotes') go(id, () => renderMeetingNotesPanel());
        else if (kind === 'pd') go(id, () => renderPDPanel());
        else if (kind === 'wellbeing') go(id, () => renderWellbeingPanel());
      });
    });
  }

  const STAFF_PH_TAB_KEY = 'flux_staff_ph_tab_v1';

  function readStaffPhTab() {
    try {
      const uid = currentUser?.id || 'anon';
      const raw = localStorage.getItem(`${STAFF_PH_TAB_KEY}_${uid}`);
      const tabs = window.FluxModuleLoader?.staffPersonalHubTabs?.() || [];
      if (raw && tabs.some((t) => t.id === raw)) return raw;
    } catch (_) {}
    return 'life';
  }

  function saveStaffPhTab(tabId) {
    try {
      const uid = currentUser?.id || 'anon';
      localStorage.setItem(`${STAFF_PH_TAB_KEY}_${uid}`, tabId);
    } catch (_) {}
  }

  function renderStaffPersonalHub() {
    const host = document.getElementById('staffPersonalHubBody');
    if (!host) return;
    const tabs = window.FluxModuleLoader?.staffPersonalHubTabs?.() || [];
    const activeTab = readStaffPhTab();
    const suiteOn = window.FluxModuleLoader?.suiteEnabled?.();

    if (!suiteOn || !tabs.length) {
      host.innerHTML = `
        <div class="sph-root">
          <div class="sph-empty">
            <div class="sph-empty-icon">🧩</div>
            <div class="sph-empty-title">Personal hub</div>
            <p class="sph-empty-sub">Enable <code>enable_staff_productivity_suite</code> and <code>enable_personal_hub</code> in Owner Suite for brain dump, grocery list, and mood tracking.</p>
          </div>
        </div>`;
      return;
    }

    const tabButtons = tabs
      .map(
        (t) =>
          `<button type="button" class="stab sph-tab ${t.id === activeTab ? 'active' : ''}" data-sph-tab="${esc(t.id)}" role="tab" aria-selected="${t.id === activeTab}">${esc(t.label)}</button>`,
      )
      .join('');
    const tabPanels = tabs
      .map(
        (t) =>
          `<div class="sph-tab-panel" id="staffPhTab_${esc(t.id)}" data-sph-panel="${esc(t.id)}" role="tabpanel" ${t.id === activeTab ? '' : 'hidden'}></div>`,
      )
      .join('');

    host.innerHTML = `
      <div class="sph-root">
        <div class="sph-topbar">
          <div>
            <div class="sph-greet">Personal hub</div>
            <div class="sph-greet-sub">Brain dump, errands, mood log, and quick imports — kept off your main dashboard.</div>
          </div>
          <div class="sph-topbar-actions" id="staffPhToolbar"></div>
        </div>
        <div class="stabs sph-tabs" role="tablist" aria-label="Personal hub sections">${tabButtons}</div>
        <div class="sph-panels">${tabPanels}</div>
        <p class="sph-hint">Tip: press <kbd>⌘</kbd><kbd>K</kbd> (or <kbd>Ctrl</kbd><kbd>K</kbd>) for the staff command palette.</p>
      </div>`;

    host.querySelectorAll('[data-sph-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.sphTab;
        saveStaffPhTab(id);
        host.querySelectorAll('[data-sph-tab]').forEach((b) => {
          const on = b.dataset.sphTab === id;
          b.classList.toggle('active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        host.querySelectorAll('[data-sph-panel]').forEach((p) => {
          p.hidden = p.dataset.sphPanel !== id;
        });
        if (window.FluxModuleLoader?.renderStaffPersonalHubGrids) {
          FluxModuleLoader.renderStaffPersonalHubGrids(id);
        }
      });
    });

    try {
      if (window.FluxModuleLoader?.renderStaffPersonalHubGrids) {
        FluxModuleLoader.renderStaffPersonalHubGrids(activeTab);
      }
    } catch (_) {}
  }
  window.renderStaffPersonalHub = renderStaffPersonalHub;

  function renderStaffPersonalDashboard() {
    const el = document.getElementById('dashboard');
    if (!el) return;
    try {
      if (window.FluxStaffDashBoard?.enabled?.() && window.FluxStaffDashBoard.render('dashboard')) {
        return;
      }
    } catch (e) {
      console.warn('[Flux] Staff dash board render failed', e);
    }
    el.querySelector('#fluxWidgetGrid_dashboard')?.remove();
    el.querySelector('.fsdb-root')?.remove();
    const name =
      (typeof FluxRole !== 'undefined' && FluxRole.profile && FluxRole.profile.display_name) ||
      currentUser?.user_metadata?.full_name ||
      currentUser?.email?.split('@')[0] ||
      'there';
    const first =
      String(name)
        .split(/\s+/)
        .filter((w) => !['Mr.', 'Mrs.', 'Ms.', 'Dr.'].includes(w))[0] || name;
    const role = (typeof FluxRole !== 'undefined' && FluxRole.current) || 'staff';
    const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
    el.innerHTML = `
    <div class="staff-personal-dash">
      <div class="spd-greeting">
        <div class="spd-hello">${esc(typeof getTimeGreeting === 'function' ? getTimeGreeting() : 'Hello')}, ${esc(first)}</div>
        <div class="spd-sub">${esc(roleLabel)} · Personal mode · ${esc(fmtLongDay(new Date()))}</div>
      </div>
      <div class="spd-mode-hint"><span class="spd-mode-icon">🔄</span><span>Personal workspace — switch to <b>Work</b> and open <b>Work hub</b> under Main (Meetings, PD, Wellbeing).</span></div>
      <div class="spd-grid">
        <div class="spd-card" data-spd-nav="staffTasks"><div class="spd-card-icon">✅</div><div class="spd-card-title">Tasks</div><div class="spd-card-sub">Personal to-dos (syncs to cloud)</div></div>
        <div class="spd-card" data-spd-nav="staffResources"><div class="spd-card-icon">📁</div><div class="spd-card-title">Resources</div><div class="spd-card-sub">Workspace links &amp; bookmarks</div></div>
        <div class="spd-card" data-spd-nav="staffPersonalHub"><div class="spd-card-icon">🧩</div><div class="spd-card-title">Personal hub</div><div class="spd-card-sub">Brain dump, grocery, mood log</div></div>
      </div>
    </div>`;
    el.querySelectorAll('[data-spd-nav]').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-spd-nav');
        if (typeof nav === 'function') nav(id);
        if (id === 'staffTasks' && window.FluxStaffPlatform) FluxStaffPlatform.renderStaffTasksPanel();
        if (id === 'staffResources') FluxStaffPlatform.renderResourcesPanel();
        if (id === 'staffPersonalHub' && typeof window.renderStaffPersonalHub === 'function') renderStaffPersonalHub();
      });
    });
  }

  async function ensureStaffPersonalRow(client) {
    const { data } = await client.from('staff_personal_data').select('user_id').eq('user_id', currentUser.id).maybeSingle();
    if (!data) {
      await client.from('staff_personal_data').insert({ user_id: currentUser.id }).select().maybeSingle();
    }
  }

  async function saveStaffPersonalTasks(client, tasks) {
    await client.from('staff_personal_data').upsert({
      user_id: currentUser.id,
      tasks,
      updated_at: new Date().toISOString(),
    });
  }

  function staffTaskRowHtml(t) {
    const id = esc(String(t.id || ''));
    const title = esc(t.title || t);
    const done = !!t.done;
    return `<label class="sw-check-row st-task-row">
      <input type="checkbox" class="sw-check-cb st-task-cb" data-id="${id}" ${done ? 'checked' : ''} aria-label="Mark complete">
      <span class="${done ? 'sw-done' : ''}">${title}</span>
      <button type="button" class="sw-check-del st-task-del" data-id="${id}" aria-label="Remove task">×</button>
    </label>`;
  }

  async function renderStaffTasksPanel() {
    const el = document.getElementById('staffTasks');
    if (!el || !currentUser) return;
    const client = sb();
    if (!client) return;
    await ensureStaffPersonalRow(client);
    const { data } = await client.from('staff_personal_data').select('tasks').eq('user_id', currentUser.id).maybeSingle();
    const tasks = Array.isArray(data?.tasks) ? data.tasks : [];
    const open = tasks.filter((t) => !t.done);
    const done = tasks.filter((t) => t.done);
    const listHtml = tasks.length
      ? `${open.length ? `<div class="st-task-group"><div class="st-task-group-lbl">Active</div>${open.map(staffTaskRowHtml).join('')}</div>` : ''}${
          done.length
            ? `<div class="st-task-group"><div class="st-task-group-lbl">Completed</div>${done.map(staffTaskRowHtml).join('')}</div>`
            : ''
        }`
      : '<div style="color:var(--muted2);font-size:.85rem;padding:8px 0">No tasks yet — add one above.</div>';
    el.innerHTML = `
      <div class="flux-page-header flux-page-header--lead"><p class="flux-page-sub">Personal tasks — check off to complete (syncs to cloud)</p></div>
      <div class="flux-stack" style="max-width:720px;margin:0 auto;padding:16px">
        <div class="card">
          <h3>Add task</h3>
          <input id="stNewTitle" placeholder="What needs doing? (Enter to add)" style="margin-bottom:8px" class="flux-quick-add">
          <button type="button" id="stAddBtn" class="edu-action-btn primary" style="width:100%">Add task</button>
        </div>
        <div class="card"><h3>Your list</h3>
          <div id="stList" class="st-task-list">${listHtml}</div>
        </div>
      </div>`;
    // Enter key to add task
    el.querySelector('#stNewTitle')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); el.querySelector('#stAddBtn')?.click(); }
    });
    el.querySelector('#stAddBtn')?.addEventListener('click', async () => {
      const title = el.querySelector('#stNewTitle')?.value?.trim();
      if (!title) return;
      const next = tasks.concat({ title, id: String(Date.now()), done: false });
      await saveStaffPersonalTasks(client, next);
      renderStaffTasksPanel();
    });
    const list = el.querySelector('#stList');
    list?.querySelectorAll('.st-task-cb').forEach((cb) => {
      cb.addEventListener('change', async () => {
        const id = cb.dataset.id;
        const next = tasks.map((t) =>
          String(t.id) === String(id) ? { ...t, done: cb.checked } : t,
        );
        await saveStaffPersonalTasks(client, next);
        renderStaffTasksPanel();
      });
    });
    list?.querySelectorAll('.st-task-del').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.dataset.id;
        const next = tasks.filter((t) => String(t.id) !== String(id));
        await saveStaffPersonalTasks(client, next);
        renderStaffTasksPanel();
      });
    });
  }

  async function renderMeetingNotesPanel() {
    const el = document.getElementById('staffMeetingNotes');
    if (!el || !currentUser) return;
    const client = sb();
    if (!client) return;
    const { data: notes } = await client
      .from('meeting_notes')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('meeting_date', { ascending: false })
      .limit(40);
    el.innerHTML = `
      <div class="flux-page-header flux-page-header--lead"><p class="flux-page-sub">Meeting notes</p></div>
      <div style="max-width:760px;margin:0 auto;padding:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <h2 style="font-size:1.1rem;font-weight:800">📋 Notes</h2>
          <button type="button" class="edu-action-btn primary" id="mnNew">+ New</button>
        </div>
        ${
          !notes?.length
            ? typeof renderEmptyState === 'function'
              ? renderEmptyState('📋', 'No notes yet', 'Capture your first meeting')
              : '<div style="color:var(--muted2)">No notes yet</div>'
            : notes
                .map(
                  (n) => `
          <div class="card" style="margin-bottom:10px;cursor:pointer" data-mn-id="${esc(n.id)}">
            <div style="font-weight:800">${esc(n.title)}</div>
            <div style="font-size:.75rem;color:var(--muted2)">${esc(String(n.meeting_date))}</div>
          </div>`
                )
                .join('')
        }
      </div>`;
    el.querySelector('#mnNew')?.addEventListener('click', openNewMeetingNoteModal);
  }

  function openNewMeetingNoteModal() {
    if (document.getElementById('mnModalRoot')) return;
    const root = document.createElement('div');
    root.id = 'mnModalRoot';
    root.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:6200;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;backdrop-filter:blur(8px)';
    root.innerHTML = `
      <div style="background:var(--card);border:1px solid var(--border2);border-radius:18px;padding:22px;width:100%;max-width:520px;margin-top:24px">
        <h3 style="font-size:1rem;font-weight:800;margin-bottom:14px">New meeting note</h3>
        <div class="mrow"><label>Title *</label><input id="mn_title" placeholder="PLC, IEP, …"></div>
        <div class="mrow"><label>Date</label><input id="mn_date" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
        <div class="mrow"><label>Notes</label><textarea id="mn_body" style="min-height:100px;resize:none"></textarea></div>
        <button type="button" id="mn_save" class="edu-action-btn primary" style="width:100%;margin-top:10px">Save</button>
        <button type="button" id="mn_cancel" class="onboard-skip-btn" style="width:100%;margin-top:8px">Cancel</button>
      </div>`;
    document.body.appendChild(root);
    root.addEventListener('click', (e) => {
      if (e.target === root) root.remove();
    });
    root.querySelector('#mn_cancel').addEventListener('click', () => root.remove());
    root.querySelector('#mn_save').addEventListener('click', async () => {
      const client = sb();
      const title = root.querySelector('#mn_title')?.value?.trim();
      if (!client || !title) return;
      await client.from('meeting_notes').insert({
        user_id: currentUser.id,
        title,
        meeting_date: root.querySelector('#mn_date')?.value || new Date().toISOString().slice(0, 10),
        body: root.querySelector('#mn_body')?.value?.trim() || null,
      });
      root.remove();
      if (typeof showToast === 'function') showToast('Saved', 'success');
      renderMeetingNotesPanel();
    });
  }

  async function renderPDPanel() {
    const el = document.getElementById('staffPD');
    if (!el || !currentUser) return;
    const client = sb();
    if (!client) return;
    const { data: items } = await client
      .from('professional_development')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });
    const hrs = (items || []).filter((i) => i.status === 'completed').reduce((s, i) => s + Number(i.hours || 0), 0);
    el.innerHTML = `
      <div class="flux-page-header flux-page-header--lead"><p class="flux-page-sub">Professional development</p></div>
      <div style="max-width:760px;margin:0 auto;padding:16px">
        <div style="display:flex;justify-content:space-between;margin-bottom:12px">
          <div style="font-size:1.1rem;font-weight:800">🎓 PD</div>
          <button type="button" class="edu-action-btn primary" id="pdAdd">+ Add</button>
        </div>
        <div style="display:flex;gap:14px;margin-bottom:14px;flex-wrap:wrap">
          <div style="padding:10px 16px;border-radius:12px;background:rgba(var(--green-rgb),.07);border:1px solid rgba(var(--green-rgb),.18)">
            <div style="font-size:1.4rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--green)">${Math.round(hrs)}h</div>
            <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-top:2px">Completed</div>
          </div>
          <div style="padding:10px 16px;border-radius:12px;background:rgba(var(--accent-rgb),.07);border:1px solid rgba(var(--accent-rgb),.18)">
            <div style="font-size:1.4rem;font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--accent)">${(items || []).length}</div>
            <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-top:2px">Activities</div>
          </div>
        </div>
        ${(items || []).map((i) => {
          const typeLabel = { course:'Course', workshop:'Workshop', conference:'Conference', observation:'Observation', book:'Book', other:'Other' }[i.pd_type] || (i.pd_type || 'Other');
          const statusColor = i.status === 'completed' ? 'var(--green)' : i.status === 'in_progress' ? 'var(--accent)' : 'var(--muted2)';
          return `<div class="card flux-wb-card" style="margin-bottom:8px;display:flex;align-items:flex-start;gap:12px">
            <div style="flex:1;min-width:0">
              <div style="font-weight:800;margin-bottom:4px">${esc(i.title)}</div>
              <div style="font-size:.73rem;color:var(--muted2);display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                <span style="color:${statusColor}">${esc(i.status.replace('_',' '))}</span>
                <span>·</span>
                <span class="pd-type-badge ${esc(i.pd_type || 'other')}">${esc(typeLabel)}</span>
                ${i.hours ? `<span>· ${i.hours}h</span>` : ''}
                ${i.completed_date ? `<span>· ${esc(i.completed_date)}</span>` : ''}
              </div>
            </div>
          </div>`;
        }).join('') || `<div style="text-align:center;padding:24px;color:var(--muted2)"><div class="flux-empty-icon" style="font-size:1.8rem;margin-bottom:8px">🎓</div><div style="font-size:.85rem">No PD activities yet — add your first one above.</div></div>`}
      </div>`;
    el.querySelector('#pdAdd')?.addEventListener('click', openAddPDModal);
  }

  function openAddPDModal() {
    if (document.getElementById('pdModalRoot')) return;
    const r = document.createElement('div');
    r.id = 'pdModalRoot';
    r.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:6200;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(8px)';
    r.innerHTML = `
      <div style="background:var(--card);border:1px solid var(--border2);border-radius:18px;padding:22px;width:100%;max-width:440px;box-shadow:0 24px 64px rgba(0,0,0,.5)">
        <h3 style="font-size:1rem;font-weight:800;margin-bottom:16px">Add PD activity</h3>
        <div class="mrow"><label>Title *</label><input id="pd_title" placeholder="e.g. First Aid Re-certification"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="mrow"><label>Hours</label><input id="pd_hours" type="number" step="0.5" min="0" value="1"></div>
          <div class="mrow"><label>Status</label>
            <select id="pd_status">
              <option value="planned">Planned</option>
              <option value="in_progress">In progress</option>
              <option value="completed" selected>Completed</option>
            </select>
          </div>
        </div>
        <div class="mrow"><label>Type</label>
          <select id="pd_type">
            <option value="course">Course / Online</option>
            <option value="workshop">Workshop</option>
            <option value="conference">Conference</option>
            <option value="observation">Peer observation</option>
            <option value="book">Book / reading</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="mrow"><label>Date <span style="font-weight:400;color:var(--muted2)">(optional)</span></label>
          <input id="pd_date" type="date" value="${new Date().toISOString().slice(0, 10)}">
        </div>
        <button type="button" id="pd_go" class="edu-action-btn primary" style="width:100%;margin-top:14px">Save activity</button>
        <button type="button" id="pd_x" class="onboard-skip-btn" style="width:100%;margin-top:8px">Cancel</button>
      </div>`;
    document.body.appendChild(r);
    // Enter on title submits
    r.querySelector('#pd_title')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); r.querySelector('#pd_go')?.click(); }
    });
    r.addEventListener('click', (e) => {
      if (e.target === r) r.remove();
    });
    r.querySelector('#pd_x').addEventListener('click', () => r.remove());
    r.querySelector('#pd_go').addEventListener('click', async () => {
      const client = sb();
      const title = r.querySelector('#pd_title')?.value?.trim();
      if (!client || !title) {
        r.querySelector('#pd_title')?.focus();
        return;
      }
      const goBtn = r.querySelector('#pd_go');
      if (goBtn) { goBtn.classList.add('flux-btn-loading'); goBtn.textContent = 'Saving…'; }
      await client.from('professional_development').insert({
        user_id: currentUser.id,
        title,
        hours: parseFloat(r.querySelector('#pd_hours')?.value) || 0,
        status: r.querySelector('#pd_status')?.value || 'completed',
        pd_type: r.querySelector('#pd_type')?.value || 'course',
        completed_date: r.querySelector('#pd_date')?.value || null,
      });
      r.remove();
      if (typeof showToast === 'function') showToast('PD activity added', 'success');
      renderPDPanel();
    });
  }

  const WellbeingState = { energy: 0, stress: 0, emotions: [] };

  const EMOTION_LIST = [
    { key: 'energized',  label: 'Energized',  emoji: '⚡' },
    { key: 'calm',       label: 'Calm',        emoji: '😌' },
    { key: 'happy',      label: 'Happy',       emoji: '😊' },
    { key: 'motivated',  label: 'Motivated',   emoji: '🚀' },
    { key: 'tired',      label: 'Tired',       emoji: '😴' },
    { key: 'stressed',   label: 'Stressed',    emoji: '😰' },
    { key: 'anxious',    label: 'Anxious',     emoji: '😬' },
    { key: 'frustrated', label: 'Frustrated',  emoji: '😤' },
    { key: 'overwhelmed',label: 'Overwhelmed', emoji: '🤯' },
    { key: 'grateful',   label: 'Grateful',    emoji: '🙏' },
    { key: 'proud',      label: 'Proud',       emoji: '💪' },
    { key: 'uncertain',  label: 'Uncertain',   emoji: '🤔' },
  ];

  function wbDotColor(energy, stress) {
    if (energy >= 4 && stress <= 2) return 'var(--green)';
    if (energy >= 3 && stress <= 3) return 'var(--accent)';
    if (stress >= 4) return 'var(--red)';
    return 'var(--gold)';
  }

  async function renderWellbeingPanel() {
    const el = document.getElementById('staffWellbeing');
    if (!el || !currentUser) return;
    const client = sb();
    if (!client) return;
    await ensureStaffPersonalRow(client);
    const { data } = await client.from('staff_personal_data').select('wellbeing_log').eq('user_id', currentUser.id).maybeSingle();
    const logs = Array.isArray(data?.wellbeing_log) ? data.wellbeing_log : [];
    const today = new Date().toISOString().slice(0, 10);
    const todayLog = logs.find((l) => l.date === today);

    // Build history sparkline dots
    const recentLogs = logs.slice(-14);
    const historyDots = recentLogs.length
      ? `<div class="flux-wb-history">${recentLogs.map((l) =>
          `<div class="flux-wb-dot" style="background:${wbDotColor(l.energy, l.stress)}"
            title="${esc(l.date)} · ⚡${l.energy} 😰${l.stress}${l.note ? ' · ' + esc(l.note.slice(0,40)) : ''}"></div>`
        ).join('')}</div>`
      : '';

    el.innerHTML = `
      <div class="flux-page-header flux-page-header--lead"><p class="flux-page-sub">Wellbeing check-in</p></div>
      <div style="max-width:580px;margin:0 auto;padding:16px">
        ${todayLog ? `<div style="padding:10px 14px;border-radius:12px;background:rgba(var(--green-rgb),.07);border:1px solid rgba(var(--green-rgb),.2);font-size:.8rem;color:var(--green);margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <span>✓</span><span>Checked in today — ⚡${todayLog.energy} · 😰${todayLog.stress}${todayLog.emotions?.length ? ' · ' + todayLog.emotions.slice(0,3).join(', ') : ''}</span>
        </div>` : ''}
        <div class="card">
          <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:8px;font-family:'JetBrains Mono',monospace">Energy level (1–5)</div>
          <div style="display:flex;gap:6px;margin-bottom:16px" id="energyRating">${[1, 2, 3, 4, 5]
            .map((n) => {
              const emojis = ['','😴','😐','🙂','😊','⚡'];
              return `<button type="button" class="wellbeing-btn" data-energy="${n}"
                style="flex:1;padding:10px 6px;border-radius:12px;border:1px solid var(--border2);background:var(--card2);cursor:pointer;font-size:.9rem;display:flex;flex-direction:column;align-items:center;gap:3px">
                <span>${emojis[n]}</span><span style="font-size:.7rem;font-weight:700">${n}</span>
              </button>`;
            }).join('')}</div>

          <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:8px;font-family:'JetBrains Mono',monospace">Stress level (1–5)</div>
          <div style="display:flex;gap:6px;margin-bottom:16px" id="stressRating">${[1, 2, 3, 4, 5]
            .map((n) => {
              const emojis = ['','😌','😐','😟','😰','🤯'];
              return `<button type="button" class="wellbeing-btn" data-stress="${n}"
                style="flex:1;padding:10px 6px;border-radius:12px;border:1px solid var(--border2);background:var(--card2);cursor:pointer;font-size:.9rem;display:flex;flex-direction:column;align-items:center;gap:3px">
                <span>${emojis[n]}</span><span style="font-size:.7rem;font-weight:700">${n}</span>
              </button>`;
            }).join('')}</div>

          <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:8px;font-family:'JetBrains Mono',monospace">How are you feeling?</div>
          <div class="flux-emotion-wrap" id="emotionPicker">
            ${EMOTION_LIST.map((em) =>
              `<button type="button" class="flux-emotion-chip" data-emotion="${esc(em.key)}">${em.emoji} ${esc(em.label)}</button>`
            ).join('')}
          </div>

          <div class="mrow"><label>Note <span style="font-weight:400;color:var(--muted2)">(optional)</span></label>
            <textarea id="wellbeingNote" placeholder="Anything on your mind today?" style="min-height:60px;resize:none"></textarea></div>
          <button type="button" class="edu-action-btn primary" style="width:100%" id="wbSave">Save check-in</button>
        </div>

        ${recentLogs.length ? `<div class="card" style="margin-top:12px">
          <div style="font-size:.78rem;font-weight:700;margin-bottom:6px">Last ${recentLogs.length} days</div>
          ${historyDots}
          <div style="font-size:.68rem;color:var(--muted2);margin-top:6px;display:flex;gap:12px">
            <span style="color:var(--green)">● High energy / low stress</span>
            <span style="color:var(--accent)">● Moderate</span>
            <span style="color:var(--red)">● High stress</span>
          </div>
        </div>` : ''}
      </div>`;

    el.querySelectorAll('[data-energy]').forEach((b) =>
      b.addEventListener('click', () => {
        setWellbeingRating('energy', +b.getAttribute('data-energy'));
        b.classList.add('selected');
        b.closest('#energyRating')?.querySelectorAll('.wellbeing-btn').forEach((btn) => {
          if (btn !== b) btn.classList.remove('selected');
        });
      })
    );
    el.querySelectorAll('[data-stress]').forEach((b) =>
      b.addEventListener('click', () => {
        setWellbeingRating('stress', +b.getAttribute('data-stress'));
        b.classList.add('selected');
        b.closest('#stressRating')?.querySelectorAll('.wellbeing-btn').forEach((btn) => {
          if (btn !== b) btn.classList.remove('selected');
        });
      })
    );
    el.querySelectorAll('.flux-emotion-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const key = chip.getAttribute('data-emotion');
        chip.classList.toggle('active');
        const idx = WellbeingState.emotions.indexOf(key);
        if (idx === -1) { WellbeingState.emotions.push(key); }
        else { WellbeingState.emotions.splice(idx, 1); }
      });
    });
    el.querySelector('#wbSave')?.addEventListener('click', saveWellbeingCheckin);
  }

  function setWellbeingRating(type, v) {
    WellbeingState[type] = v;
    const sel = type === 'energy' ? '#energyRating .wellbeing-btn' : '#stressRating .wellbeing-btn';
    document.querySelectorAll(sel).forEach((btn) => {
      const n = +btn.getAttribute('data-' + type);
      btn.style.background = n === v ? 'rgba(var(--accent-rgb),.18)' : 'var(--card2)';
      btn.classList.toggle('selected', n === v);
    });
  }

  async function saveWellbeingCheckin() {
    if (!WellbeingState.energy || !WellbeingState.stress) {
      if (typeof showToast === 'function') showToast('Pick your energy and stress levels first', 'warning');
      const saveBtn = document.getElementById('wbSave');
      if (saveBtn) {
        saveBtn.style.animation = 'none';
        saveBtn.style.outline = '2px solid var(--gold)';
        setTimeout(() => { if (saveBtn) saveBtn.style.outline = ''; }, 1200);
      }
      return;
    }
    const saveBtn = document.getElementById('wbSave');
    if (saveBtn) { saveBtn.classList.add('flux-btn-loading'); saveBtn.textContent = 'Saving…'; }
    const client = sb();
    if (!client) return;
    const today = new Date().toISOString().slice(0, 10);
    const note = document.getElementById('wellbeingNote')?.value?.trim() || '';
    const { data: ex } = await client.from('staff_personal_data').select('wellbeing_log').eq('user_id', currentUser.id).maybeSingle();
    const logs = (Array.isArray(ex?.wellbeing_log) ? ex.wellbeing_log : []).filter((l) => l.date !== today);
    logs.push({
      date: today,
      energy: WellbeingState.energy,
      stress: WellbeingState.stress,
      emotions: WellbeingState.emotions.slice(),
      note: note || null,
    });
    await client.from('staff_personal_data').upsert({ user_id: currentUser.id, wellbeing_log: logs, updated_at: new Date().toISOString() });
    WellbeingState.energy = 0;
    WellbeingState.stress = 0;
    WellbeingState.emotions = [];
    if (typeof showToast === 'function') showToast('Check-in saved ✓', 'success');
    // Particle burst on the button if available
    if (saveBtn && typeof window.FluxMagic?.particles === 'function') {
      const r = saveBtn.getBoundingClientRect();
      FluxMagic.particles(r.left + r.width / 2, r.top + r.height / 2, { count: 8, colors: ['var(--green)','var(--accent)'] });
    }
    renderWellbeingPanel();
  }

  function staffResourcePins() {
    const role = (typeof FluxRole !== 'undefined' && FluxRole.current) || 'staff';
    const school =
      (typeof FluxRole !== 'undefined' && FluxRole.profile && FluxRole.profile.school) ||
      (window.FluxSchool && FluxSchool.IAE && FluxSchool.IAE.name) ||
      'International Academy East';
    const pins = [
      {
        id: 'pin-gmail',
        title: 'Gmail',
        url: 'https://mail.google.com/mail/u/0/#inbox',
        icon: '✉',
        blurb: 'Inbox',
      },
      {
        id: 'pin-drive',
        title: 'Google Drive',
        url: 'https://drive.google.com/drive/my-drive',
        icon: '📂',
        blurb: 'Files',
      },
      {
        id: 'pin-cal',
        title: 'Google Calendar',
        url: 'https://calendar.google.com/calendar/u/0/r',
        icon: '📅',
        blurb: 'Schedule',
      },
      {
        id: 'pin-docs',
        title: 'Google Docs',
        url: 'https://docs.google.com/document/u/0/',
        icon: '📝',
        blurb: 'New doc',
      },
      {
        id: 'pin-bhs',
        title: 'Bloomfield Hills Schools',
        url: 'https://www.bloomfield.org/',
        icon: '🏫',
        blurb: 'District',
      },
    ];
    if (['teacher', 'counselor', 'staff', 'admin'].includes(role)) {
      pins.push({
        id: 'pin-classroom',
        title: 'Google Classroom',
        url: 'https://classroom.google.com/',
        icon: '🎓',
        blurb: 'Classes',
      });
    }
    try {
      const canvasUrl =
        (typeof load === 'function' && load('flux_canvas_url', '')) ||
        (typeof window.canvasUrl === 'string' && window.canvasUrl) ||
        '';
      const canvasTok =
        (typeof load === 'function' && load('flux_canvas_token', '')) ||
        (typeof window.canvasToken === 'string' && window.canvasToken) ||
        '';
      if (canvasUrl && canvasTok) {
        pins.push({
          id: 'pin-canvas',
          title: 'Canvas LMS',
          url: canvasUrl,
          icon: '📊',
          blurb: 'Linked in Flux',
        });
      }
    } catch (_) {}
    pins.push({
      id: 'pin-school',
      title: school,
      url: 'https://www.bloomfield.org/schools/international-academy',
      icon: '🌐',
      blurb: 'IA East',
    });
    return pins;
  }

  function normalizeStaffBookmarks(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((r, i) => ({
        id: String(r.id || `bm_${i}`),
        title: String(r.title || r.url || 'Link').trim(),
        url: String(r.url || '').trim(),
        note: String(r.note || '').trim(),
      }))
      .filter((r) => r.url);
  }

  async function saveStaffResources(client, resources) {
    await client.from('staff_personal_data').upsert({
      user_id: currentUser.id,
      resources,
      updated_at: new Date().toISOString(),
    });
  }

  async function renderResourcesPanel() {
    const el = document.getElementById('staffResources');
    if (!el || !currentUser) return;
    const client = sb();
    if (!client) return;
    await ensureStaffPersonalRow(client);
    const { data } = await client.from('staff_personal_data').select('resources').eq('user_id', currentUser.id).maybeSingle();
    const bookmarks = normalizeStaffBookmarks(data?.resources);
    const pins = staffResourcePins();
    const fluxShortcuts = [
      { id: 'fx-tasks', label: 'Personal tasks', icon: '✅', action: () => nav && nav('staffTasks') },
      {
        id: 'fx-google',
        label: 'Google hub',
        icon: '🔗',
        action: () => {
          if (typeof nav === 'function') nav('canvas');
          try {
            if (window.FluxGoogle && typeof FluxGoogle.renderHub === 'function') FluxGoogle.renderHub();
          } catch (_) {}
        },
        hide: !(
          typeof FluxRole !== 'undefined' &&
          FluxRole.isStaffGoogleHubRole &&
          FluxRole.isStaffGoogleHubRole()
        ),
      },
      { id: 'fx-settings', label: 'Settings', icon: '⚙', action: () => nav && nav('settings') },
      { id: 'fx-profile', label: 'Profile', icon: '👤', action: () => nav && nav('profile') },
    ].filter((s) => !s.hide);

    el.innerHTML = `
      <div class="flux-page-header flux-page-header--lead"><p class="flux-page-sub">Workspace shortcuts, school links, and your saved bookmarks (synced to cloud).</p></div>
      <div class="sr-root">
        <section class="sr-section">
          <h3 class="sr-section-title">In Flux</h3>
          <div class="sr-shortcut-grid">
            ${fluxShortcuts
              .map(
                (s) =>
                  `<button type="button" class="sr-shortcut-btn" data-sr-flux="${esc(s.id)}"><span class="sr-pin-icon" aria-hidden="true">${s.icon}</span><span>${esc(s.label)}</span></button>`,
              )
              .join('')}
          </div>
          <p class="sr-hint">Press <strong>Ctrl+K</strong> (Mac: <strong>Cmd+K</strong>) to toggle Work ↔ Personal mode.</p>
        </section>

        <section class="sr-section">
          <h3 class="sr-section-title">Workspace &amp; school</h3>
          <div class="sr-pin-grid">
            ${pins
              .map(
                (p) =>
                  `<a class="sr-pin" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">
                    <span class="sr-pin-icon" aria-hidden="true">${p.icon}</span>
                    <span class="sr-pin-text">
                      <span class="sr-pin-title">${esc(p.title)}</span>
                      <span class="sr-pin-blurb">${esc(p.blurb)}</span>
                    </span>
                  </a>`,
              )
              .join('')}
          </div>
        </section>

        <section class="sr-section">
          <h3 class="sr-section-title">My bookmarks</h3>
          <div class="card sr-add-card">
            <div class="mrow">
              <label for="srTitle">Title</label>
              <input type="text" id="srTitle" placeholder="e.g. Sub coverage form" maxlength="120">
            </div>
            <div class="mrow">
              <label for="srUrl">Link</label>
              <input type="url" id="srUrl" placeholder="https://…" maxlength="2048">
            </div>
            <div class="mrow">
              <label for="srNote">Note <span style="font-weight:400;color:var(--muted2)">(optional)</span></label>
              <input type="text" id="srNote" placeholder="Room, contact, or reminder" maxlength="200">
            </div>
            <button type="button" class="edu-action-btn primary" id="srAdd" style="width:100%">Save bookmark</button>
          </div>
          <div class="sr-bookmark-list" id="srBookmarkList">
            ${
              bookmarks.length
                ? bookmarks
                    .map(
                      (r) =>
                        `<div class="sr-bookmark" data-id="${esc(r.id)}">
                          <a class="sr-bookmark-main" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">
                            <span class="sr-bookmark-title">${esc(r.title)}</span>
                            ${r.note ? `<span class="sr-bookmark-note">${esc(r.note)}</span>` : ''}
                            <span class="sr-bookmark-url">${esc(r.url)}</span>
                          </a>
                          <button type="button" class="sr-bookmark-del" data-id="${esc(r.id)}" aria-label="Remove bookmark">×</button>
                        </div>`,
                    )
                    .join('')
                : '<div class="sr-empty">No bookmarks yet — save forms, docs, or dashboards you use every week.</div>'
            }
          </div>
        </section>
      </div>`;

    fluxShortcuts.forEach((s) => {
      el.querySelector(`[data-sr-flux="${s.id}"]`)?.addEventListener('click', () => {
        try {
          s.action();
          if (s.id === 'fx-tasks' && typeof renderStaffTasksPanel === 'function') renderStaffTasksPanel();
        } catch (_) {}
      });
    });

    el.querySelector('#srAdd')?.addEventListener('click', async () => {
      const title = el.querySelector('#srTitle')?.value?.trim();
      const url = el.querySelector('#srUrl')?.value?.trim();
      const note = el.querySelector('#srNote')?.value?.trim();
      if (!url) {
        if (typeof showToast === 'function') showToast('Paste a link first', 'warning');
        return;
      }
      let href = url;
      if (!/^https?:\/\//i.test(href)) href = 'https://' + href;
      const next = bookmarks.concat({
        id: String(Date.now()),
        title: title || href.replace(/^https?:\/\//i, '').slice(0, 80),
        url: href,
        note: note || '',
      });
      await saveStaffResources(client, next);
      if (typeof showToast === 'function') showToast('Bookmark saved', 'success');
      renderResourcesPanel();
    });

    el.querySelectorAll('.sr-bookmark-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const next = bookmarks.filter((b) => String(b.id) !== String(id));
        await saveStaffResources(client, next);
        renderResourcesPanel();
      });
    });
  }

  function staffProfileIdentity() {
    const imp = window.FluxImpersonate?.active?.() || null;
    const prof = (typeof FluxRole !== 'undefined' && FluxRole.profile) || {};
    const useRoleRow = !(!imp && prof._impersonated);
    const profile = useRoleRow ? prof : {};
    const lookupEmail = imp?.email || currentUser?.email || '';
    const dirRec =
      (window.FluxStaffDirectory && FluxStaffDirectory.findByEmail(String(lookupEmail).toLowerCase())) || null;
    const name =
      profile.display_name || dirRec?.name || currentUser?.user_metadata?.full_name || 'Educator';
    const role = profile.role || dirRec?.role || 'staff';
    const roleLabel = ({ teacher: 'Teacher', counselor: 'Counselor', staff: 'Staff', admin: 'Admin' })[role] || 'Staff';
    const subject = profile.subject || dirRec?.subject || '';
    const email = lookupEmail || dirRec?.email || '';
    const verified = !!(dirRec && dirRec.email === String(email).toLowerCase());
    return { name, role, roleLabel, subject, email, verified, profile };
  }

  function updateStaffProfileHero(identity) {
    const name = identity?.name || 'Educator';
    const subline = [identity?.roleLabel, identity?.subject, identity?.email]
      .filter(Boolean)
      .join(' · ');
    const profileNameEl = document.getElementById('profileName');
    if (profileNameEl) profileNameEl.textContent = name;
    const profileSubEl = document.getElementById('profileSubline');
    if (profileSubEl) profileSubEl.textContent = subline || 'Staff profile';
    const pic =
      (typeof fluxLoadStoredString === 'function' && fluxLoadStoredString('flux_profile_pic', '')) || '';
    const av = document.getElementById('pAvatar');
    if (av) {
      av.innerHTML =
        (pic
          ? `<img src="${pic}" loading="lazy" decoding="async" alt="">`
          : name.charAt(0).toUpperCase()) +
        `<input type="file" id="picUpload" accept="image/*" style="display:none" onchange="handlePicUpload(event)">`;
    }
    if (window.FluxPersonal && FluxPersonal.styleProfileAvatar) FluxPersonal.styleProfileAvatar();
    const badgeEl = document.getElementById('profileBadges');
    if (badgeEl) {
      const badges = [];
      if (identity?.verified) badges.push({ t: '✓ Directory', c: 'badge-green' });
      badges.push({ t: identity?.roleLabel || 'Staff', c: 'badge-blue' });
      if (typeof FluxRole !== 'undefined' && FluxRole.isWorkMode && FluxRole.isWorkMode()) {
        badges.push({ t: 'Work mode', c: 'badge-purple' });
      } else if (typeof FluxRole !== 'undefined' && FluxRole.isPersonalMode && FluxRole.isPersonalMode()) {
        badges.push({ t: 'Personal mode', c: 'badge-purple' });
      }
      badgeEl.innerHTML = badges.map((b) => `<span class="badge ${b.c}">${b.t}</span>`).join('');
    }
  }

  async function fetchStaffProfileStats() {
    const stats = {
      meetings: 0,
      pdHours: 0,
      tasksOpen: 0,
      wellbeing: 0,
      focusHrs: 0,
    };
    try {
      if (typeof load === 'function') stats.focusHrs = Math.round((load('t_minutes', 0) || 0) / 60);
    } catch (_) {}
    const client = sb();
    if (!client || !currentUser?.id) return stats;
    try {
      const { count: mn } = await client
        .from('meeting_notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id);
      stats.meetings = mn || 0;
    } catch (_) {}
    try {
      const { data: pd } = await client
        .from('professional_development')
        .select('hours,status')
        .eq('user_id', currentUser.id);
      stats.pdHours = Math.round(
        (pd || []).filter((i) => i.status === 'completed').reduce((s, i) => s + Number(i.hours || 0), 0),
      );
    } catch (_) {}
    try {
      const { data: row } = await client
        .from('staff_personal_data')
        .select('tasks,wellbeing_log')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      const tasks = Array.isArray(row?.tasks) ? row.tasks : [];
      stats.tasksOpen = tasks.filter((t) => !t.done).length;
      stats.wellbeing = Array.isArray(row?.wellbeing_log) ? row.wellbeing_log.length : 0;
    } catch (_) {}
    return stats;
  }

  function renderStaffProfileStatsGrid(stats) {
    const el = document.getElementById('staffProfileStats');
    if (!el) return;
    const items = [
      [stats.meetings,  '',  'Meetings',   'var(--accent)'],
      [stats.pdHours,   'h', 'PD hours',   'var(--green)'],
      [stats.tasksOpen, '',  'Open tasks', 'var(--gold)'],
      [stats.wellbeing, '',  'Check-ins',  'var(--purple)'],
      [stats.focusHrs,  'h', 'Focus time', 'var(--accent2)'],
    ];
    el.innerHTML = items
      .map(
        ([n, suf, l, c]) =>
          `<div class="staff-profile-stat">
            <div class="staff-profile-stat__n flux-counter" style="color:${c}" data-flux-count="${n}" data-flux-count-suffix="${suf}">0${suf}</div>
            <div class="staff-profile-stat__l">${l}</div>
          </div>`,
      )
      .join('');
    // Trigger counter animations after a short delay
    setTimeout(() => {
      if (typeof window.FluxMagic?.animateStaffStats === 'function') {
        FluxMagic.animateStaffStats();
      }
    }, 120);
  }

  async function renderStaffProfile() {
    const mount = document.getElementById('staffProfileMount');
    if (!mount) return;
    const identity = staffProfileIdentity();
    updateStaffProfileHero(identity);
    const info =
      typeof window.loadTeacherSchoolInfo === 'function'
        ? window.loadTeacherSchoolInfo()
        : { department: '', room: '', officeHours: '', extension: '', pronouns: '', website: '' };
    const verifiedBadge = identity.verified
      ? '<span class="staff-profile-pill staff-profile-pill--ok">Directory verified</span>'
      : '<span class="staff-profile-pill">Directory pending</span>';
    const dash = '\u2014';
    const schoolName =
      (window.FluxSchool && window.FluxSchool.IAE && window.FluxSchool.IAE.name) ||
      'International Academy East';

    mount.innerHTML = `
      <div class="card">
        <div class="staff-profile-card-head">
          <div>
            <div class="staff-profile-kicker">Identity</div>
            <h3 style="margin:4px 0 0;font-size:1.15rem;font-weight:800">${esc(identity.name)}</h3>
            <p style="margin:6px 0 0;font-size:.82rem;color:var(--muted2)">${esc(identity.roleLabel)}${identity.subject ? ' \u00b7 ' + esc(identity.subject) : ''}</p>
          </div>
          ${verifiedBadge}
        </div>
        <div class="school-info-grid" style="margin-top:14px">
          <div class="info-tile"><div class="info-tile-label">School email</div><div class="info-tile-val" style="font-size:.8rem;font-family:'JetBrains Mono',monospace">${esc(identity.email || dash)}</div></div>
          <div class="info-tile"><div class="info-tile-label">Role</div><div class="info-tile-val">${esc(identity.roleLabel)}</div></div>
          <div class="info-tile"><div class="info-tile-label">Subject / focus</div><div class="info-tile-val">${esc(identity.subject || dash)}</div></div>
          <div class="info-tile"><div class="info-tile-label">Campus</div><div class="info-tile-val">${esc(schoolName)}</div></div>
        </div>
      </div>
      <div class="card">
        <h3>Professional details</h3>
        <p style="font-size:.78rem;color:var(--muted2);margin:-8px 0 12px">Room, department, and contact info. Also editable under <strong>School Info</strong> in Work mode.</p>
        <div class="mrow"><label for="tsiDepartment">Department</label>
          <input id="tsiDepartment" type="text" placeholder="e.g. Math, Counseling" value="${esc(info.department || '')}">
        </div>
        <div class="mrow"><label for="tsiRoom">Room</label>
          <input id="tsiRoom" type="text" placeholder="e.g. 204" value="${esc(info.room || '')}">
        </div>
        <div class="mrow"><label for="tsiOfficeHours">Office / prep hours</label>
          <input id="tsiOfficeHours" type="text" placeholder="Mon-Wed 3:00-4:00pm" value="${esc(info.officeHours || '')}">
        </div>
        <div class="mrow"><label for="tsiExtension">Phone extension</label>
          <input id="tsiExtension" type="text" value="${esc(info.extension || '')}">
        </div>
        <div class="mrow"><label for="tsiPronouns">Pronouns (optional)</label>
          <input id="tsiPronouns" type="text" value="${esc(info.pronouns || '')}">
        </div>
        <div class="mrow"><label for="tsiWebsite">Class website</label>
          <input id="tsiWebsite" type="url" placeholder="https://example.com" value="${esc(info.website || '')}">
        </div>
        <button id="tsiSaveBtn" type="button" style="width:100%;margin-top:10px" onclick="typeof saveTeacherSchoolInfo==='function'&&saveTeacherSchoolInfo()">Save details</button>
      </div>
      <div class="card">
        <h3>Workspace activity</h3>
        <div id="staffProfileStats" class="staff-profile-stats"><div style="color:var(--muted2);font-size:.82rem">Loading\u2026</div></div>
      </div>
      <div class="card">
        <h3>Quick links</h3>
        <div class="staff-profile-links">
          <button type="button" class="btn-sec" onclick="if(typeof FluxRole!=='undefined'&&FluxRole.isWorkMode&&FluxRole.isWorkMode()){nav('school')}else if(typeof showToast==='function'){showToast('Switch to Work mode for School Info','info')}">School info (Work)</button>
          <button type="button" class="btn-sec" onclick="nav('staffHub');try{FluxStaffPlatform.renderStaffWorkHub()}catch(e){}">Work hub</button>
          <button type="button" class="btn-sec" onclick="nav('staffMeetingNotes');try{FluxStaffPlatform.renderMeetingNotesPanel()}catch(e){}">Meetings</button>
          <button type="button" class="btn-sec" onclick="nav('staffPD');try{FluxStaffPlatform.renderPDPanel()}catch(e){}">PD</button>
        </div>
      </div>`;


    const stats = await fetchStaffProfileStats();
    renderStaffProfileStatsGrid(stats);
  }

  async function renderSchoolFeed() {
    const el = document.getElementById('schoolFeedPanel');
    if (!el || !currentUser) return;
    const client = sb();
    if (!client) return;
    const { data: posts } = await client
      .from('school_feed')
      .select('*')
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(25);
    const canPost = typeof FluxRole !== 'undefined' && FluxRole.isEducator && FluxRole.isEducator();
    const postTypeIcon = { announcement: '📢', resource: '📁', event: '📅', alert: '🚨' };
    el.innerHTML = `
      <div class="flux-page-header flux-page-header--lead"><p class="flux-page-sub">School feed — announcements, resources, and events</p></div>
      <div style="max-width:720px;margin:0 auto;padding:16px">
        ${canPost ? `<button type="button" class="edu-action-btn primary" id="sfNew" style="margin-bottom:14px">+ New post</button>` : ''}
        <div class="flux-feed-list">
        ${(posts || []).map((p) => {
          const icon = postTypeIcon[p.post_type] || '📌';
          const pinned = p.is_pinned ? '<span style="font-size:.65rem;padding:2px 7px;border-radius:6px;background:rgba(var(--gold-rgb),.12);color:var(--gold);font-weight:700;margin-left:6px">📌 Pinned</span>' : '';
          return `<div class="card" style="margin-bottom:10px">
            <div style="display:flex;align-items:flex-start;gap:10px">
              <span style="font-size:1.2rem;flex-shrink:0;margin-top:2px">${icon}</span>
              <div style="flex:1;min-width:0">
                <div style="font-weight:800;display:flex;align-items:center;flex-wrap:wrap;gap:4px">${esc(p.title)}${pinned}</div>
                ${p.body ? `<div style="font-size:.82rem;color:var(--muted2);margin-top:5px;line-height:1.5">${esc(p.body)}</div>` : ''}
                <div style="font-size:.68rem;color:var(--muted);margin-top:6px">${typeof timeAgo === 'function' ? timeAgo(new Date(p.created_at)) : ''}</div>
              </div>
            </div>
          </div>`;
        }).join('') || `<div style="text-align:center;padding:28px;color:var(--muted2)"><div class="flux-empty-icon" style="font-size:1.8rem;margin-bottom:8px">📢</div><div style="font-size:.85rem">No posts yet${canPost ? ' — be the first to post' : ''}.</div></div>`}
        </div>
      </div>`;
    el.querySelector('#sfNew')?.addEventListener('click', openNewFeedPostModal);
  }

  function openNewFeedPostModal() {
    if (document.getElementById('sfModal')) return;
    const m = document.createElement('div');
    m.id = 'sfModal';
    m.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:6200;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(8px)';
    m.innerHTML = `
      <div style="background:var(--card);border:1px solid var(--border2);border-radius:18px;padding:22px;width:100%;max-width:480px;box-shadow:0 24px 64px rgba(0,0,0,.5)">
        <h3 style="font-size:1rem;font-weight:800;margin-bottom:16px">New school post</h3>
        <div class="mrow"><label>Title *</label><input id="fp_title" placeholder="Brief title…"></div>
        <div class="mrow"><label>Body</label><textarea id="fp_body" style="min-height:80px;resize:none" placeholder="Details, links, or context…"></textarea></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="mrow"><label>Type</label>
            <select id="fp_type">
              <option value="announcement">📢 Announcement</option>
              <option value="resource">📁 Resource</option>
              <option value="event">📅 Event</option>
            </select>
          </div>
          <div class="mrow"><label>Audience</label>
            <select id="fp_audience">
              <option value="all">Everyone</option>
              <option value="educators">Educators only</option>
              <option value="students">Students only</option>
            </select>
          </div>
        </div>
        <button type="button" class="edu-action-btn primary" style="width:100%;margin-top:14px" id="fp_go">Post to school feed</button>
        <button type="button" class="onboard-skip-btn" style="width:100%;margin-top:8px" id="fp_x">Cancel</button>
      </div>`;
    document.body.appendChild(m);
    m.querySelector('#fp_title')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) m.querySelector('#fp_go')?.click();
    });
    m.querySelector('#fp_x').addEventListener('click', () => m.remove());
    m.addEventListener('click', (e) => { if (e.target === m) m.remove(); });
    m.querySelector('#fp_go').addEventListener('click', async () => {
      const client = sb();
      const title = m.querySelector('#fp_title')?.value?.trim();
      const body = m.querySelector('#fp_body')?.value?.trim();
      if (!client || !title) {
        m.querySelector('#fp_title')?.focus();
        return;
      }
      const audience = m.querySelector('#fp_audience')?.value || 'all';
      const targetRoles = audience === 'educators'
        ? ['teacher', 'counselor', 'staff', 'admin']
        : audience === 'students'
        ? ['student']
        : ['student', 'teacher', 'counselor', 'staff', 'admin'];
      const goBtn = m.querySelector('#fp_go');
      if (goBtn) { goBtn.classList.add('flux-btn-loading'); goBtn.textContent = 'Posting…'; }
      await client.from('school_feed').insert({
        posted_by: currentUser.id,
        post_type: m.querySelector('#fp_type')?.value || 'announcement',
        title,
        body: body || null,
        target_roles: targetRoles,
      });
      m.remove();
      if (typeof showToast === 'function') showToast('Posted to school feed', 'success');
      renderSchoolFeed();
    });
  }

  let verifyChannel = null;

  function teardownVerificationRealtime() {
    const client = sb();
    if (client && verifyChannel) {
      try {
        client.removeChannel(verifyChannel);
      } catch (_) {}
    }
    verifyChannel = null;
  }

  function listenForApproval(userId) {
    const client = sb();
    const uid = String(userId || currentUser?.id || '').trim();
    if (!client || !uid) return;
    teardownVerificationRealtime();
    verifyChannel = client
      .channel(`applicant_verification_watch:${uid}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'staff_verification_requests',
          filter: `user_id=eq.${uid}`,
        },
        async (payload) => {
          const next = payload?.new;
          if (!next || next.verification_status !== 'approved') return;
          const upgraded = await maybeApplyApprovedStaffVerification();
          if (upgraded) {
            try {
              if (typeof fluxRouteAfterAuth === 'function') await fluxRouteAfterAuth('verification');
              else if (typeof fluxRouteEducatorHome === 'function') fluxRouteEducatorHome();
            } catch (_) {}
          }
        },
      )
      .subscribe();
  }

  async function hydrateOwnerStaffVerification(mount, opts) {
    if (!mount || typeof isOwner !== 'function' || !isOwner()) return;
    const client = sb();
    if (!client) return;
    const silent = opts === true || (opts && opts.silent);
    if (!silent) {
      mount.innerHTML = '<div style="color:var(--muted2)">Loading requests…</div>';
    }
    const { data: requests, error } = await client
      .from('staff_verification_requests')
      .select('*')
      .eq('verification_status', 'pending')
      .order('created_at', { ascending: true });
    if (error) {
      mount.innerHTML = '<div style="color:var(--red)">' + esc(error.message) + '</div>';
      return;
    }
    if (!requests?.length) {
      mount.innerHTML = '<div style="color:var(--muted2);font-size:.85rem">No pending staff verification requests.</div>';
      return;
    }
    mount.innerHTML = requests
      .map(
        (r) => `
      <div class="card" style="margin-bottom:10px">
        <div style="font-weight:800">${esc(r.requested_name)}</div>
        <div style="font-size:.78rem;color:var(--muted2)">${esc(r.requested_role)} · ${esc(r.personal_gmail || '')}</div>
        ${r.applicant_note ? `<div style="font-size:.78rem;margin-top:8px;font-style:italic;color:var(--muted2)">“${esc(r.applicant_note)}”</div>` : ''}
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <button type="button" class="edu-action-btn primary" data-sv-approve="${esc(r.user_id)}" data-role="${esc(r.requested_role)}" data-name="${esc(r.requested_name)}">Approve</button>
          <button type="button" class="btn-sec" data-sv-reject="${esc(r.user_id)}">Reject</button>
        </div>
      </div>`
      )
      .join('');
    mount.querySelectorAll('[data-sv-approve]').forEach((btn) => {
      btn.addEventListener('click', () =>
        approveStaffRequest(btn.getAttribute('data-sv-approve'), btn.getAttribute('data-role'), btn.getAttribute('data-name'))
      );
    });
    mount.querySelectorAll('[data-sv-reject]').forEach((btn) => {
      btn.addEventListener('click', () => rejectStaffRequest(btn.getAttribute('data-sv-reject')));
    });
  }

  async function approveStaffRequest(userId, role, name) {
    const client = sb();
    if (!client || !currentUser) return;
    await client
      .from('user_roles')
      .update({
        role,
        display_name: name,
        school: (window.FluxSchool?.IAE?.name || 'International Academy East'),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    await client
      .from('staff_verification_requests')
      .update({ verification_status: 'approved', resolved_at: new Date().toISOString(), identity_confirmed: true })
      .eq('user_id', userId);
    if (typeof fluxEnsureThreadAndSend === 'function') {
      await fluxEnsureThreadAndSend(
        userId,
        'Your staff access was approved. Sign out and back in if your dashboard does not update immediately.'
      );
    }
    if (typeof showToast === 'function') showToast('Approved', 'success');
    const m = document.getElementById('osStaffVerifyMount');
    if (m) hydrateOwnerStaffVerification(m);
  }

  async function rejectStaffRequest(userId) {
    const client = sb();
    if (!client) return;
    await client
      .from('staff_verification_requests')
      .update({ verification_status: 'rejected', resolved_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (typeof fluxEnsureThreadAndSend === 'function') {
      await fluxEnsureThreadAndSend(userId, 'Your staff verification request was not approved. Contact your administrator if this is a mistake.');
    }
    if (typeof showToast === 'function') showToast('Rejected', 'info');
    const m = document.getElementById('osStaffVerifyMount');
    if (m) hydrateOwnerStaffVerification(m);
  }

  window.FluxStaffPlatform = {
    StaffSignup,
    showStaffOnboarding,
    maybeApplyApprovedStaffVerification,
    renderStaffWorkHub,
    renderStaffPersonalDashboard,
    renderStaffPersonalHub,
    renderStaffTasksPanel,
    renderMeetingNotesPanel,
    renderPDPanel,
    renderWellbeingPanel,
    renderResourcesPanel,
    renderSchoolFeed,
    renderStaffProfile,
    hydrateOwnerStaffVerification,
    approveStaffRequest,
    rejectStaffRequest,
    listenForApproval,
    teardownVerificationRealtime,
  };

  window.showStaffOnboarding = showStaffOnboarding;
})();
