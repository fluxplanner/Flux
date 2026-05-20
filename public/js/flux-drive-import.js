/**
 * Google Drive import → lesson / assignment generation.
 * Flag: enable_drive_import (default off).
 */
(function () {
  'use strict';

  const LS_CACHE = 'flux_drive_import_cache_v1';
  const LS_LAST_FILE = 'flux_drive_import_last_file';

  const SCOPES = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/documents.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
  ];

  const MIME_DOC = 'application/vnd.google-apps.document';
  const MIME_SLIDES = 'application/vnd.google-apps.presentation';
  const MIME_SHEET = 'application/vnd.google-apps.spreadsheet';

  let _files = [];
  let _selectedId = null;
  let _previewText = '';

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled('enable_drive_import', false);
    } catch (_) {
      return false;
    }
  }

  function load(k, def) {
    if (typeof window.load === 'function') return window.load(k, def);
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : def;
    } catch (_) {
      return def;
    }
  }

  function save(k, v) {
    if (typeof window.save === 'function') window.save(k, v);
    else {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (_) {}
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
    else console.log('[drive-import]', msg);
  }

  async function ensureToken() {
    if (window.FluxGoogle?.ensureToken) return window.FluxGoogle.ensureToken();
    return window.gmailToken || sessionStorage.getItem('flux_gmail_token') || null;
  }

  function isTeacher() {
    try {
      return typeof FluxRole !== 'undefined' && FluxRole.isTeacher && FluxRole.isTeacher();
    } catch (_) {
      return false;
    }
  }

  function titleFromName(name) {
    return String(name || 'Untitled')
      .replace(/\.(docx?|pdf|gdoc|gslides|gsheet)$/i, '')
      .replace(/[_-]+/g, ' ')
      .trim()
      .slice(0, 200);
  }

  function inferAssignmentType(title, body) {
    const t = `${title} ${body}`.toLowerCase();
    if (/\b(exam|midterm|final|unit test)\b/.test(t)) return 'test';
    if (/\b(quiz|checkpoint)\b/.test(t)) return 'quiz';
    if (/\b(essay|paper|thesis)\b/.test(t)) return 'essay';
    if (/\b(project|presentation|slide)\b/.test(t)) return 'project';
    if (/\b(lab|experiment)\b/.test(t)) return 'lab';
    if (/\b(read|chapter|pages?\s+\d)\b/.test(t)) return 'reading';
    return 'homework';
  }

  function dueInDays(n) {
    const d = new Date();
    d.setDate(d.getDate() + (n || 7));
    return d.toISOString().slice(0, 10);
  }

  function excerpt(text, max) {
    const s = String(text || '')
      .replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return s.length > (max || 2000) ? `${s.slice(0, max)}…` : s;
  }

  function generateLessonMarkdown(file, text) {
    const topic = titleFromName(file?.name);
    const body = excerpt(text, 2400);
    const sections = body.split(/\n(?=#{1,3}\s|\d+\.\s)/).filter(Boolean);
    const bullets = sections.slice(0, 6).map((s) => `- ${s.split('\n')[0].slice(0, 120)}`);

    return [
      `# Lesson draft: ${topic}`,
      '',
      `_Generated from Google Drive: ${file?.webViewLink || file?.name || 'file'}_`,
      '',
      '## Learning objectives',
      bullets.length ? bullets.join('\n') : '- Students will explain key ideas from the source material.',
      '',
      '## Hook (5 min)',
      `- Quick prompt connecting "${topic}" to prior knowledge.`,
      '',
      '## Instruction',
      body ? body.slice(0, 900) : '_Add your instruction notes from the Drive file._',
      '',
      '## Guided practice',
      '- Work through one representative problem or passage together.',
      '',
      '## Independent practice',
      '- Students apply the concept using the attached Drive resource.',
      '',
      '## Exit ticket',
      '- One sentence: what is the main takeaway from today?',
      '',
      '## Materials & differentiation',
      `- Source: ${file?.webViewLink || 'Drive file'}`,
      '- Scaffold: vocabulary list + sentence frames for ELL.',
    ].join('\n');
  }

  function generateAssignmentDraft(file, text) {
    const title = titleFromName(file?.name);
    const body = excerpt(text, 1500);
    const link = file?.webViewLink ? `\n\nSource: ${file.webViewLink}` : '';
    return {
      title,
      description: (body ? `${body}${link}` : `Complete work based on: ${title}${link}`).trim(),
      type: inferAssignmentType(title, body),
      due_date: dueInDays(7),
      estimated_minutes: body.length > 800 ? 60 : 30,
    };
  }

  function generateStudentTask(file, text) {
    const title = titleFromName(file?.name);
    const notes = excerpt(text, 500);
    const link = file?.webViewLink || '';
    return {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: title,
      date: dueInDays(5),
      subject: '',
      priority: 'med',
      type: inferAssignmentType(title, notes),
      notes: [notes, link].filter(Boolean).join('\n\n'),
      estTime: 45,
      done: false,
      rescheduled: 0,
      createdAt: Date.now(),
      driveFileId: file?.id,
    };
  }

  async function apiGet(url) {
    const token = await ensureToken();
    if (!token) return { ok: false, needsSignIn: true };
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) return { ok: false, expired: true };
      if (res.status === 403) return { ok: false, needsScope: true };
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        return { ok: false, error: `Drive API ${res.status} — ${t.slice(0, 100)}` };
      }
      const data = await res.json().catch(() => ({}));
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  }

  async function listRecentFiles() {
    const q = encodeURIComponent(
      "trashed=false and (mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.presentation' or mimeType='application/pdf')",
    );
    const fields = encodeURIComponent('files(id,name,mimeType,modifiedTime,webViewLink),nextPageToken');
    const res = await apiGet(
      `https://www.googleapis.com/drive/v3/files?pageSize=24&orderBy=modifiedTime desc&q=${q}&fields=${fields}`,
    );
    if (!res.ok) return res;
    _files = res.data?.files || [];
    save(LS_CACHE, { fetchedAt: Date.now(), files: _files });
    return { ok: true, files: _files };
  }

  async function exportFileText(file) {
    if (!file?.id) return '';
    const mime = file.mimeType || '';
    if (mime === MIME_DOC || mime === MIME_SLIDES || mime === MIME_SHEET) {
      const exportMime =
        mime === MIME_SHEET
          ? 'text/csv'
          : mime === MIME_SLIDES
            ? 'text/plain'
            : 'text/plain';
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent(exportMime)}`,
        { headers: { Authorization: `Bearer ${await ensureToken()}` } },
      );
      if (!res.ok) return '';
      return await res.text();
    }
    if (mime === 'application/pdf') {
      return `(PDF — open in Drive to view)\n${file.webViewLink || ''}`;
    }
    return '';
  }

  function selectedFile() {
    return _files.find((f) => f.id === _selectedId) || null;
  }

  async function loadPreview(file) {
    if (!file) {
      _previewText = '';
      return;
    }
    _previewText = 'Loading preview…';
    const text = await exportFileText(file);
    _previewText = text || '(No text extracted — use Drive link in generated draft.)';
    save(LS_LAST_FILE, { id: file.id, name: file.name });
  }

  function openAssignmentModal(draft) {
    if (typeof window.openCreateAssignmentModal !== 'function') {
      toast('Assignment composer not available', 'warning');
      return;
    }
    window.openCreateAssignmentModal();
    setTimeout(() => {
      const t = document.getElementById('asgn_title');
      const d = document.getElementById('asgn_desc');
      const ty = document.getElementById('asgn_type');
      const due = document.getElementById('asgn_due_date');
      const est = document.getElementById('asgn_time');
      if (t && draft.title) t.value = draft.title;
      if (d && draft.description) d.value = draft.description;
      if (ty && draft.type) ty.value = draft.type;
      if (due && draft.due_date) due.value = draft.due_date;
      if (est && draft.estimated_minutes) est.value = String(draft.estimated_minutes);
    }, 400);
  }

  function addStudentTask(file, text) {
    const t = generateStudentTask(file, text);
    if (typeof window.calcUrgency === 'function') t.urgencyScore = window.calcUrgency(t);
    const list = Array.isArray(window.tasks) ? window.tasks : [];
    list.unshift(t);
    save('tasks', list);
    if (typeof window.syncKey === 'function') window.syncKey('tasks', list);
    if (typeof window.renderTasks === 'function') window.renderTasks();
    if (typeof window.renderStats === 'function') window.renderStats();
    toast(`Added "${t.name.slice(0, 40)}" to planner`, 'success');
  }

  async function reconnect() {
    const sb = typeof window.getSB === 'function' ? window.getSB() : null;
    if (!sb) {
      toast('Auth not available', 'error');
      return;
    }
    try {
      if (typeof window.initOAuthPostMessageListener === 'function') window.initOAuthPostMessageListener();
      const redirectTo =
        typeof window.getRedirectURL === 'function'
          ? window.getRedirectURL()
          : window.location.origin + window.location.pathname;
      const { data, error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          scopes: SCOPES.join(' '),
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (error) throw error;
      if (!data?.url) {
        toast('Could not start Google sign-in', 'error');
        return;
      }
      const w = window.open(data.url, 'fluxGoogleOAuth', 'width=520,height=720,left=80,top=60');
      if (!w) window.location.href = data.url;
      toast('Approve Drive read access in the pop-up', 'info');
    } catch (e) {
      toast('Sign-in failed: ' + (e.message || e), 'error');
    }
  }

  function mimeLabel(mime) {
    if (mime === MIME_DOC) return 'Doc';
    if (mime === MIME_SLIDES) return 'Slides';
    if (mime === MIME_SHEET) return 'Sheet';
    if (mime === 'application/pdf') return 'PDF';
    return 'File';
  }

  function renderFileList() {
    if (!_files.length) {
      return '<div class="flux-drive-empty">No Docs, Slides, or PDFs found. Try Sync Drive.</div>';
    }
    return `<div class="flux-drive-list">${_files
      .map((f) => {
        const mod = f.modifiedTime
          ? new Date(f.modifiedTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '';
        const sel = f.id === _selectedId;
        return `<label class="flux-drive-row${sel ? ' flux-drive-row--sel' : ''}">
          <input type="radio" name="fluxDriveFile" value="${esc(f.id)}"${sel ? ' checked' : ''}>
          <div class="flux-drive-row-body">
            <div class="flux-drive-name">${esc(f.name)}</div>
            <div class="flux-drive-meta">${esc(mimeLabel(f.mimeType))}${mod ? ` · ${esc(mod)}` : ''}</div>
          </div>
        </label>`;
      })
      .join('')}</div>`;
  }

  function renderGenButtons() {
    const teacher = isTeacher();
    const studentBtns = `<button type="button" id="fluxDriveTaskBtn">+ Add as Flux task</button>`;
    const teacherBtns = `
      <button type="button" id="fluxDriveLessonBtn">Generate lesson draft</button>
      <button type="button" id="fluxDriveAssignBtn">Generate assignment</button>
      <button type="button" id="fluxDriveLessonAiBtn">Open in Lesson AI</button>`;
    return `<div class="flux-drive-gen">${teacher ? teacherBtns + studentBtns : studentBtns}</div>`;
  }

  function render(slot) {
    const host = slot || document.getElementById('gHubDriveSlot');
    if (!host || !enabled()) {
      if (host) host.innerHTML = '';
      return;
    }

    const linked = window.FluxGoogle?.isGoogleLinked?.() ?? !!window.gmailToken;
    if (!linked) {
      host.innerHTML = '<div class="flux-drive-empty">Sign in with Google to import from Drive.</div>';
      return;
    }

    const cached = load(LS_CACHE, {});
    if (!_files.length && cached.files) _files = cached.files;
    if (!_selectedId && _files[0]) _selectedId = _files[0].id;

    const status = cached.fetchedAt
      ? `Last listed: ${new Date(cached.fetchedAt).toLocaleString()} · ${_files.length} files`
      : 'List recent Docs, Slides, and PDFs from your Drive.';

    host.innerHTML = `
      <div class="flux-drive-import g-hub-import-card">
        <div class="flux-drive-head">
          <h3>Drive import</h3>
          <span class="flux-drive-status">${esc(status)}</span>
        </div>
        <p class="g-hub-muted">Pick a file, preview text, then generate a lesson plan, assignment draft, or student task.</p>
        <div class="flux-drive-actions">
          <button type="button" class="flux-drive-btn-primary" id="fluxDriveSyncBtn">↻ List Drive files</button>
          <button type="button" id="fluxDriveScopeBtn">Reconnect scopes</button>
        </div>
        ${renderFileList()}
        <div id="fluxDrivePreview" class="flux-drive-preview">${esc(_previewText || 'Select a file to preview.')}</div>
        ${renderGenButtons()}
        <p class="flux-drive-foot">Read-only Drive access. Generated drafts are starting points — review before posting or teaching.</p>
      </div>`;

    host.querySelectorAll('input[name="fluxDriveFile"]').forEach((inp) => {
      inp.addEventListener('change', async () => {
        _selectedId = inp.value;
        const file = selectedFile();
        await loadPreview(file);
        render(host);
      });
    });

    host.querySelector('#fluxDriveSyncBtn')?.addEventListener('click', async () => {
      const st = host.querySelector('.flux-drive-status');
      if (st) st.textContent = 'Listing…';
      const res = await listRecentFiles();
      if (!res.ok) {
        if (res.needsScope || res.expired) {
          if (confirm('Drive permission needed. Reconnect Google?')) reconnect();
        } else toast(res.error || 'List failed', 'error');
      } else if (_files[0]) {
        _selectedId = _files[0].id;
        await loadPreview(_files[0]);
      }
      render(host);
    });

    host.querySelector('#fluxDriveScopeBtn')?.addEventListener('click', () => reconnect());

    const file = selectedFile();
    if (file && (!_previewText || _previewText === 'Select a file to preview.')) {
      void loadPreview(file).then(() => {
        const prev = host.querySelector('#fluxDrivePreview');
        if (prev) prev.textContent = _previewText.slice(0, 2000);
      });
    }

    host.querySelector('#fluxDriveLessonBtn')?.addEventListener('click', async () => {
      const f = selectedFile();
      if (!f) return;
      if (!_previewText || _previewText.startsWith('Loading')) await loadPreview(f);
      const md = generateLessonMarkdown(f, _previewText);
      try {
        await navigator.clipboard.writeText(md);
        toast('Lesson draft copied to clipboard', 'success');
      } catch (_) {
        console.log(md);
        toast('Copy failed — see console', 'warn');
      }
    });

    host.querySelector('#fluxDriveAssignBtn')?.addEventListener('click', async () => {
      const f = selectedFile();
      if (!f) return;
      if (!_previewText || _previewText.startsWith('Loading')) await loadPreview(f);
      openAssignmentModal(generateAssignmentDraft(f, _previewText));
      toast('Assignment form prefilled — review and post', 'info');
    });

    host.querySelector('#fluxDriveLessonAiBtn')?.addEventListener('click', async () => {
      const f = selectedFile();
      if (!f) return;
      if (!_previewText || _previewText.startsWith('Loading')) await loadPreview(f);
      if (window.FluxTeacherLessonAI?.open) {
        FluxTeacherLessonAI.open({
          topic: titleFromName(f.name),
          notes: excerpt(_previewText, 600),
        });
      } else {
        toast('Enable teacher AI for Lesson AI', 'info');
      }
    });

    host.querySelector('#fluxDriveTaskBtn')?.addEventListener('click', async () => {
      const f = selectedFile();
      if (!f) return;
      if (!_previewText || _previewText.startsWith('Loading')) await loadPreview(f);
      addStudentTask(f, _previewText);
    });
  }

  function install() {
    return enabled();
  }

  window.FluxDriveImport = {
    enabled,
    install,
    render,
    listRecentFiles,
    exportFileText,
    generateLessonMarkdown,
    generateAssignmentDraft,
    reconnect,
  };
  window.fluxReconnectGoogleDrive = reconnect;
})();
