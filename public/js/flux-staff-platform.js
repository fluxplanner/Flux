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
      list.innerHTML =
        '<div style="text-align:center;padding:18px;font-size:.82rem;color:var(--muted2)">No directory rows yet — ask your admin to add staff in Supabase.</div>';
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
    if (!client || !StaffSignup.userId || !StaffSignup.selectedDirectoryEntry) return;
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
        student_note: note,
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
    document.getElementById('staffOnboarding')?.remove();
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
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', currentUser.id);
      if (typeof FluxRole?.load === 'function') await FluxRole.load();
      return true;
    } catch (_) {
      return false;
    }
  }

  function renderStaffPersonalDashboard() {
    const el = document.getElementById('dashboard');
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
    el.innerHTML = `
    <div class="staff-personal-dash">
      <div class="spd-greeting">
        <div class="spd-hello">${esc(typeof getTimeGreeting === 'function' ? getTimeGreeting() : 'Hello')}, ${esc(first)}</div>
        <div class="spd-sub">${esc(roleLabel)} · Personal mode · ${new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}</div>
      </div>
      <div class="spd-mode-hint"><span class="spd-mode-icon">🔄</span><span>Personal workspace — switch to <b>Work</b> for ${esc(
        roleLabel
      )} tools.</span></div>
      <div class="spd-grid">
        <div class="spd-card" data-spd-nav="staffTasks"><div class="spd-card-icon">✅</div><div class="spd-card-title">Tasks</div><div class="spd-card-sub">Personal to-dos (syncs to cloud)</div></div>
        <div class="spd-card" data-spd-nav="staffMeetingNotes"><div class="spd-card-icon">📋</div><div class="spd-card-title">Meeting notes</div><div class="spd-card-sub">Decisions &amp; actions</div></div>
        <div class="spd-card" data-spd-nav="staffPD"><div class="spd-card-icon">🎓</div><div class="spd-card-title">Development</div><div class="spd-card-sub">PD hours &amp; courses</div></div>
        <div class="spd-card" data-spd-nav="staffWellbeing"><div class="spd-card-icon">🌿</div><div class="spd-card-title">Wellbeing</div><div class="spd-card-sub">Energy &amp; stress</div></div>
        <div class="spd-card" data-spd-nav="staffResources"><div class="spd-card-icon">📁</div><div class="spd-card-title">Resources</div><div class="spd-card-sub">Links &amp; files</div></div>
        <div class="spd-card" data-spd-nav="staffCalendar"><div class="spd-card-icon">📅</div><div class="spd-card-title">Calendar</div><div class="spd-card-sub">School calendar tab</div></div>
        <div class="spd-card" data-spd-nav="schoolFeedPanel"><div class="spd-card-icon">📢</div><div class="spd-card-title">School feed</div><div class="spd-card-sub">Community posts</div></div>
      </div>
    </div>`;
    el.querySelectorAll('[data-spd-nav]').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-spd-nav');
        if (typeof nav === 'function') nav(id);
        if (id === 'staffTasks' && window.FluxStaffPlatform) FluxStaffPlatform.renderStaffTasksPanel();
        if (id === 'staffMeetingNotes') FluxStaffPlatform.renderMeetingNotesPanel();
        if (id === 'staffPD') FluxStaffPlatform.renderPDPanel();
        if (id === 'staffWellbeing') FluxStaffPlatform.renderWellbeingPanel();
        if (id === 'staffResources') FluxStaffPlatform.renderResourcesPanel();
        if (id === 'staffCalendar') {
          if (typeof nav === 'function') nav('calendar');
        }
        if (id === 'schoolFeedPanel') FluxStaffPlatform.renderSchoolFeed();
      });
    });
  }

  async function ensureStaffPersonalRow(client) {
    const { data } = await client.from('staff_personal_data').select('user_id').eq('user_id', currentUser.id).maybeSingle();
    if (!data) {
      await client.from('staff_personal_data').insert({ user_id: currentUser.id }).select().maybeSingle();
    }
  }

  async function renderStaffTasksPanel() {
    const el = document.getElementById('staffTasks');
    if (!el || !currentUser) return;
    const client = sb();
    if (!client) return;
    await ensureStaffPersonalRow(client);
    const { data } = await client.from('staff_personal_data').select('tasks').eq('user_id', currentUser.id).maybeSingle();
    const tasks = Array.isArray(data?.tasks) ? data.tasks : [];
    el.innerHTML = `
      <div class="flux-page-header flux-page-header--lead"><p class="flux-page-sub">Personal tasks (staff)</p></div>
      <div class="flux-stack" style="max-width:720px;margin:0 auto;padding:16px">
        <div class="card">
          <h3>Add task</h3>
          <input id="stNewTitle" placeholder="Title" style="margin-bottom:8px">
          <button type="button" id="stAddBtn" class="edu-action-btn primary" style="width:100%">Add</button>
        </div>
        <div class="card"><h3>Your list</h3>
          <div id="stList">${tasks.length ? tasks.map((t) => `<div style="padding:8px 0;border-bottom:1px solid var(--border)">${esc(t.title || t)}</div>`).join('') : '<div style="color:var(--muted2);font-size:.85rem">No tasks yet</div>'}</div>
        </div>
      </div>`;
    el.querySelector('#stAddBtn')?.addEventListener('click', async () => {
      const title = el.querySelector('#stNewTitle')?.value?.trim();
      if (!title) return;
      const next = tasks.concat({ title, id: String(Date.now()), done: false });
      await client.from('staff_personal_data').upsert({ user_id: currentUser.id, tasks: next, updated_at: new Date().toISOString() });
      renderStaffTasksPanel();
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
        <div style="font-size:.85rem;color:var(--muted2);margin-bottom:12px">Completed hours (approx): <b>${Math.round(hrs)}</b></div>
        ${(items || []).map((i) => `<div class="card" style="margin-bottom:8px"><b>${esc(i.title)}</b><div style="font-size:.75rem;color:var(--muted2)">${esc(i.status)} · ${esc(i.pd_type || '')}</div></div>`).join('') || '<div style="color:var(--muted2)">No PD rows yet</div>'}
      </div>`;
    el.querySelector('#pdAdd')?.addEventListener('click', openAddPDModal);
  }

  function openAddPDModal() {
    if (document.getElementById('pdModalRoot')) return;
    const r = document.createElement('div');
    r.id = 'pdModalRoot';
    r.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:6200;display:flex;align-items:center;justify-content:center;padding:16px';
    r.innerHTML = `
      <div style="background:var(--card);border:1px solid var(--border2);border-radius:16px;padding:20px;width:100%;max-width:420px">
        <div class="mrow"><label>Title *</label><input id="pd_title"></div>
        <div class="mrow"><label>Hours</label><input id="pd_hours" type="number" step="0.5" value="1"></div>
        <div class="mrow"><label>Status</label>
          <select id="pd_status"><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select>
        </div>
        <button type="button" id="pd_go" class="edu-action-btn primary" style="width:100%;margin-top:10px">Save</button>
        <button type="button" id="pd_x" class="onboard-skip-btn" style="width:100%;margin-top:6px">Cancel</button>
      </div>`;
    document.body.appendChild(r);
    r.addEventListener('click', (e) => {
      if (e.target === r) r.remove();
    });
    r.querySelector('#pd_x').addEventListener('click', () => r.remove());
    r.querySelector('#pd_go').addEventListener('click', async () => {
      const client = sb();
      const title = r.querySelector('#pd_title')?.value?.trim();
      if (!client || !title) return;
      await client.from('professional_development').insert({
        user_id: currentUser.id,
        title,
        hours: parseFloat(r.querySelector('#pd_hours')?.value) || 0,
        status: r.querySelector('#pd_status')?.value || 'planned',
        pd_type: 'course',
      });
      r.remove();
      renderPDPanel();
    });
  }

  const WellbeingState = { energy: 0, stress: 0, emotions: [] };

  async function renderWellbeingPanel() {
    const el = document.getElementById('staffWellbeing');
    if (!el || !currentUser) return;
    const client = sb();
    if (!client) return;
    await ensureStaffPersonalRow(client);
    const { data } = await client.from('staff_personal_data').select('wellbeing_log').eq('user_id', currentUser.id).maybeSingle();
    const logs = Array.isArray(data?.wellbeing_log) ? data.wellbeing_log : [];
    const today = new Date().toISOString().slice(0, 10);
    el.innerHTML = `
      <div class="flux-page-header flux-page-header--lead"><p class="flux-page-sub">Wellbeing check-in</p></div>
      <div style="max-width:560px;margin:0 auto;padding:16px">
        <div class="card">
          <div style="font-size:.8rem;font-weight:700;margin-bottom:8px">Energy (1–5)</div>
          <div style="display:flex;gap:6px;margin-bottom:12px" id="energyRating">${[1, 2, 3, 4, 5]
            .map(
              (n) =>
                `<button type="button" class="wellbeing-btn" data-energy="${n}" style="flex:1;padding:8px;border-radius:10px;border:1px solid var(--border2);background:var(--card2);cursor:pointer">${n}</button>`
            )
            .join('')}</div>
          <div style="font-size:.8rem;font-weight:700;margin-bottom:8px">Stress (1–5)</div>
          <div style="display:flex;gap:6px;margin-bottom:12px" id="stressRating">${[1, 2, 3, 4, 5]
            .map(
              (n) =>
                `<button type="button" class="wellbeing-btn" data-stress="${n}" style="flex:1;padding:8px;border-radius:10px;border:1px solid var(--border2);background:var(--card2);cursor:pointer">${n}</button>`
            )
            .join('')}</div>
          <div class="mrow"><label>Note</label><textarea id="wellbeingNote" style="min-height:56px;resize:none"></textarea></div>
          <button type="button" class="edu-action-btn primary" style="width:100%" id="wbSave">Save check-in</button>
        </div>
        <div style="margin-top:16px;font-size:.78rem;color:var(--muted2)">Recent: ${logs
          .slice(-5)
          .map((l) => `${esc(l.date)} ⚡${l.energy} 🔴${l.stress}`)
          .join(' · ') || '—'}
        </div>
      </div>`;
    el.querySelectorAll('[data-energy]').forEach((b) =>
      b.addEventListener('click', () => setWellbeingRating('energy', +b.getAttribute('data-energy')))
    );
    el.querySelectorAll('[data-stress]').forEach((b) =>
      b.addEventListener('click', () => setWellbeingRating('stress', +b.getAttribute('data-stress')))
    );
    el.querySelector('#wbSave')?.addEventListener('click', saveWellbeingCheckin);
  }

  function setWellbeingRating(type, v) {
    WellbeingState[type] = v;
    const sel = type === 'energy' ? '#energyRating .wellbeing-btn' : '#stressRating .wellbeing-btn';
    document.querySelectorAll(sel).forEach((btn) => {
      const n = +btn.getAttribute('data-' + type);
      btn.style.background = n === v ? 'rgba(var(--accent-rgb),.18)' : 'var(--card2)';
    });
  }

  async function saveWellbeingCheckin() {
    if (!WellbeingState.energy || !WellbeingState.stress) {
      if (typeof showToast === 'function') showToast('Pick energy and stress', 'warning');
      return;
    }
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
    if (typeof showToast === 'function') showToast('Saved', 'success');
    renderWellbeingPanel();
  }

  async function renderResourcesPanel() {
    const el = document.getElementById('staffResources');
    if (!el || !currentUser) return;
    const client = sb();
    if (!client) return;
    await ensureStaffPersonalRow(client);
    const { data } = await client.from('staff_personal_data').select('resources').eq('user_id', currentUser.id).maybeSingle();
    const res = Array.isArray(data?.resources) ? data.resources : [];
    el.innerHTML = `
      <div class="flux-page-header flux-page-header--lead"><p class="flux-page-sub">Resource library</p></div>
      <div style="max-width:720px;margin:0 auto;padding:16px">
        <div class="card">
          <label style="font-size:.72rem;color:var(--muted)">Add link</label>
          <input id="srUrl" placeholder="https://…" style="margin-bottom:8px">
          <button type="button" class="edu-action-btn primary" id="srAdd" style="width:100%">Save</button>
        </div>
        ${res.map((r) => `<div class="card"><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title || r.url)}</a></div>`).join('') || '<div style="color:var(--muted2)">No resources yet</div>'}
      </div>`;
    el.querySelector('#srAdd')?.addEventListener('click', async () => {
      const url = el.querySelector('#srUrl')?.value?.trim();
      if (!url) return;
      const next = res.concat({ url, title: url });
      await client.from('staff_personal_data').upsert({ user_id: currentUser.id, resources: next, updated_at: new Date().toISOString() });
      renderResourcesPanel();
    });
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
    el.innerHTML = `
      <div class="flux-page-header flux-page-header--lead"><p class="flux-page-sub">School feed</p></div>
      <div style="max-width:720px;margin:0 auto;padding:16px">
        ${
          canPost
            ? `<button type="button" class="edu-action-btn primary" id="sfNew" style="margin-bottom:12px">+ Post</button>`
            : ''
        }
        ${(posts || []).map((p) => `<div class="card" style="margin-bottom:10px"><div style="font-weight:800">${esc(p.title)}</div><div style="font-size:.82rem;color:var(--muted2);margin-top:6px">${esc(p.body || '')}</div><div style="font-size:.68rem;color:var(--muted);margin-top:6px">${typeof timeAgo === 'function' ? timeAgo(new Date(p.created_at)) : ''}</div></div>`).join('') || '<div style="color:var(--muted2)">No posts yet</div>'}
      </div>`;
    el.querySelector('#sfNew')?.addEventListener('click', openNewFeedPostModal);
  }

  function openNewFeedPostModal() {
    if (document.getElementById('sfModal')) return;
    const m = document.createElement('div');
    m.id = 'sfModal';
    m.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:6200;display:flex;align-items:center;justify-content:center;padding:16px';
    m.innerHTML = `
      <div style="background:var(--card);border:1px solid var(--border2);border-radius:16px;padding:20px;width:100%;max-width:440px">
        <div class="mrow"><label>Title *</label><input id="fp_title"></div>
        <div class="mrow"><label>Body</label><textarea id="fp_body" style="min-height:72px;resize:none"></textarea></div>
        <button type="button" class="edu-action-btn primary" style="width:100%" id="fp_go">Post</button>
        <button type="button" class="onboard-skip-btn" style="width:100%;margin-top:6px" id="fp_x">Cancel</button>
      </div>`;
    document.body.appendChild(m);
    m.querySelector('#fp_x').addEventListener('click', () => m.remove());
    m.querySelector('#fp_go').addEventListener('click', async () => {
      const client = sb();
      const title = m.querySelector('#fp_title')?.value?.trim();
      const body = m.querySelector('#fp_body')?.value?.trim();
      if (!client || !title) return;
      await client.from('school_feed').insert({
        posted_by: currentUser.id,
        post_type: 'announcement',
        title,
        body: body || null,
        target_roles: ['student'],
      });
      m.remove();
      renderSchoolFeed();
    });
  }

  async function hydrateOwnerStaffVerification(mount) {
    if (!mount || typeof isOwner !== 'function' || !isOwner()) return;
    const client = sb();
    if (!client) return;
    mount.innerHTML = '<div style="color:var(--muted2)">Loading requests…</div>';
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
        ${r.student_note ? `<div style="font-size:.78rem;margin-top:8px;font-style:italic;color:var(--muted2)">“${esc(r.student_note)}”</div>` : ''}
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
    renderStaffPersonalDashboard,
    renderStaffTasksPanel,
    renderMeetingNotesPanel,
    renderPDPanel,
    renderWellbeingPanel,
    renderResourcesPanel,
    renderSchoolFeed,
    hydrateOwnerStaffVerification,
    approveStaffRequest,
    rejectStaffRequest,
  };

  window.showStaffOnboarding = showStaffOnboarding;
})();
