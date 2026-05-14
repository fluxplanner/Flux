/**
 * Flux Canvas LMS panel — v3, clean tabbed UI.
 *
 * The previous version was a mini-browser with per-course drilldowns and a
 * dedicated CanvasAPI class that duplicated logic from app.js. This rewrite
 * removes that entire layer and replaces it with a flat tabbed hub:
 *
 *   [Announcements] [Assignments] [Modules] [Calendar] [Inbox] [Files]
 *
 * Every row in every tab has an "Add to Flux" button:
 *   - Assignment   -> task   (addCanvasAssignmentToPlanner)
 *   - Announcement -> note   (addCanvasAnnouncementAsNoteIfNew)
 *   - Module item  -> task or note depending on the item type
 *   - Calendar evt -> task with due_at
 *   - Inbox msg    -> note
 *   - File         -> note (with link to file)
 *
 * Data fetching reuses the existing canvasProxyGet / canvasProxyGetPaged
 * helpers from app.js so we don't ship a second copy of the API surface.
 *
 * Globals expected from app.js: load, save, esc, showToast, syncKey, tasks,
 * notes, classes, canvasToken, canvasUrl, canvasProxyGet, canvasProxyGetPaged,
 * canvasStripHtml, canvasAssignmentTaskExists, addCanvasAssignmentToPlanner,
 * addCanvasAnnouncementAsNoteIfNew, canvasFluxSubjectKeyFromCourseName,
 * fluxCanvasProxyHost, renderStats, renderTasks, renderCalendar,
 * renderCountdown, renderNotesList, calcUrgency.
 */
(function () {
  const CV = {
    connected: false,
    host: "",
    courses: [],
    activeTab: load("flux_canvas_v3_tab", "assignments"),
    selectedCourseId: load("flux_canvas_v3_course", "all"),
    loading: false,
    /** per-tab cache: { fetchedAt, data } */
    cache: {},
    CACHE_MS: 2 * 60 * 1000,
  };

  /** Tab definitions — id, label, icon, fetcher, renderer. */
  const TABS = [
    { id: "assignments",   label: "Assignments",   icon: "📝" },
    { id: "announcements", label: "Announcements", icon: "📢" },
    { id: "modules",       label: "Modules",       icon: "📚" },
    { id: "calendar",      label: "Calendar",      icon: "📅" },
    { id: "inbox",         label: "Inbox",         icon: "✉" },
    { id: "files",         label: "Files",         icon: "📎" },
  ];

  // ────────────────────────────────────────────────────────────────
  // Small utilities
  // ────────────────────────────────────────────────────────────────
  function hostFromUrl(url) {
    if (!url) return "";
    try {
      const u = String(url).trim().includes("://")
        ? new URL(url)
        : new URL("https://" + String(url).trim());
      return u.hostname || "";
    } catch {
      return "";
    }
  }

  function ymd(s) {
    if (!s) return "";
    try { return String(s).slice(0, 10); } catch { return ""; }
  }

  function due(d) {
    if (!d) return "muted";
    const x = new Date(d), n = new Date();
    if (isNaN(+x)) return "muted";
    if (x < n) return "red";
    if (x.toDateString() === n.toDateString()) return "gold";
    return "green";
  }

  function courseColor(c) {
    return (c && (c.course_color || c.color)) || "#3b82f6";
  }

  function isConnected() {
    try { return !!(canvasToken && canvasUrl); } catch { return false; }
  }

  function rememberTab(id) {
    CV.activeTab = id;
    save("flux_canvas_v3_tab", id);
  }
  function rememberCourse(id) {
    CV.selectedCourseId = id;
    save("flux_canvas_v3_course", id);
  }

  /** Returns cached data if fresh, else null. */
  function cacheGet(key) {
    const c = CV.cache[key];
    if (c && Date.now() - c.fetchedAt < CV.CACHE_MS) return c.data;
    return null;
  }
  function cachePut(key, data) {
    CV.cache[key] = { data, fetchedAt: Date.now() };
  }
  function cacheBust() { CV.cache = {}; }

  // ────────────────────────────────────────────────────────────────
  // Data loaders (thin wrappers around the existing canvasProxyGet helpers)
  // ────────────────────────────────────────────────────────────────
  async function loadCourses(force) {
    if (!force) {
      const c = cacheGet("courses");
      if (c) return c;
    }
    const data = await canvasProxyGetPaged(
      "/courses?enrollment_state=active&include[]=course_image&include[]=term&per_page=100",
      3,
    );
    const arr = Array.isArray(data) ? data : [];
    CV.courses = arr;
    cachePut("courses", arr);
    return arr;
  }

  async function loadAnnouncements(courseIds) {
    const ids = (courseIds || []).filter(Boolean).slice(0, 24);
    if (!ids.length) return [];
    const key = "ann:" + ids.join(",");
    const c = cacheGet(key);
    if (c) return c;
    const startDate = new Date(Date.now() - 60 * 86400000)
      .toISOString();
    const qs = ids.map((id) => "context_codes[]=course_" + id).join("&");
    const data = await canvasProxyGet(
      `/announcements?${qs}&per_page=40&start_date=${encodeURIComponent(startDate)}`,
    );
    const arr = Array.isArray(data) ? data : [];
    cachePut(key, arr);
    return arr;
  }

  async function loadAssignments(courseId) {
    const key = "asg:" + courseId;
    const c = cacheGet(key);
    if (c) return c;
    const data = await canvasProxyGetPaged(
      `/courses/${courseId}/assignments?order_by=due_at&include[]=submission&include[]=overrides`,
      4,
    );
    const arr = Array.isArray(data) ? data : [];
    cachePut(key, arr);
    return arr;
  }

  async function loadModules(courseId) {
    const key = "mod:" + courseId;
    const c = cacheGet(key);
    if (c) return c;
    const data = await canvasProxyGet(
      `/courses/${courseId}/modules?include[]=items&include[]=content_details&per_page=50`,
    );
    const arr = Array.isArray(data) ? data : [];
    cachePut(key, arr);
    return arr;
  }

  async function loadCalendarEvents() {
    const key = "cal";
    const c = cacheGet(key);
    if (c) return c;
    const start = new Date(), end = new Date();
    end.setDate(end.getDate() + 60);
    const sd = start.toISOString().slice(0, 10);
    const ed = end.toISOString().slice(0, 10);
    const ctxs = (CV.courses || []).slice(0, 20).map((c) => "context_codes[]=course_" + c.id).join("&");
    const data = await canvasProxyGet(
      `/calendar_events?type=assignment&start_date=${sd}&end_date=${ed}&per_page=100${ctxs ? "&" + ctxs : ""}`,
    );
    const arr = Array.isArray(data) ? data : [];
    cachePut(key, arr);
    return arr;
  }

  async function loadInbox() {
    const key = "inbox";
    const c = cacheGet(key);
    if (c) return c;
    const data = await canvasProxyGet(
      "/conversations?scope=inbox&per_page=30",
    );
    const arr = Array.isArray(data) ? data : [];
    cachePut(key, arr);
    return arr;
  }

  async function loadFiles(courseId) {
    const key = "files:" + courseId;
    const c = cacheGet(key);
    if (c) return c;
    const data = await canvasProxyGet(
      `/courses/${courseId}/files?per_page=50&sort=updated_at&order=desc`,
    );
    const arr = Array.isArray(data) ? data : [];
    cachePut(key, arr);
    return arr;
  }

  // ────────────────────────────────────────────────────────────────
  // "Add to Flux" — one consistent button across tabs
  // ────────────────────────────────────────────────────────────────
  /** Render the right Add-to-Flux button for the given content type. */
  function addBtn(kind, data) {
    const safe = encodeURIComponent(JSON.stringify(data || {}));
    return `<button type="button" class="cv-add-btn" data-cv-kind="${esc(kind)}" data-cv-data="${safe}" onclick="window.fluxCanvasAddToFlux(this)">＋ Add to Flux</button>`;
  }

  /** Build a generic note from any Canvas item; used by announcements, inbox, files, etc. */
  function pushNote(title, body, key, val) {
    if (key && val != null && notes.some((n) => n[key] === val)) {
      return { ok: false, reason: "exists" };
    }
    const note = {
      id: Date.now() + Math.random(),
      title: String(title || "Canvas item").slice(0, 200),
      body: String(body || "").slice(0, 12000),
      subject: "",
      starred: false,
      flashcards: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (key && val != null) note[key] = val;
    notes.unshift(note);
    save("flux_notes", notes);
    if (typeof syncKey === "function") syncKey("notes", notes);
    if (typeof renderNotesList === "function") renderNotesList();
    return { ok: true, note };
  }

  /** Build a task directly (used for module items / calendar events that aren't full assignments). */
  function pushTask(name, dateStr, opts) {
    opts = opts || {};
    const t = {
      id: Date.now() + Math.random(),
      name: String(name || "Canvas item").slice(0, 240),
      date: dateStr || "",
      subject: opts.subject || "",
      priority: opts.priority || "medium",
      type: opts.type || "task",
      notes: opts.notes || "",
      estTime: opts.estTime || 45,
      done: false, rescheduled: 0, createdAt: Date.now(),
    };
    if (opts.canvasCourseId) t.canvasCourseId = opts.canvasCourseId;
    if (opts.canvasModuleItemId) t.canvasModuleItemId = opts.canvasModuleItemId;
    if (opts.canvasCalendarEventId) t.canvasCalendarEventId = opts.canvasCalendarEventId;
    try { t.urgencyScore = calcUrgency(t); } catch (_) {}
    tasks.unshift(t);
    save("tasks", tasks);
    if (typeof syncKey === "function") syncKey("tasks", tasks);
    if (typeof renderStats === "function") renderStats();
    if (typeof renderTasks === "function") renderTasks();
    if (typeof renderCalendar === "function") renderCalendar();
    if (typeof renderCountdown === "function") renderCountdown();
    return { ok: true, task: t };
  }

  /** The single dispatcher. Called by every "+ Add to Flux" row button. */
  window.fluxCanvasAddToFlux = async function (btn) {
    if (!btn) return;
    const kind = btn.getAttribute("data-cv-kind") || "";
    let data = {};
    try { data = JSON.parse(decodeURIComponent(btn.getAttribute("data-cv-data") || "")) || {}; } catch (_) {}

    const courseName = data.course_name || "Course";

    if (kind === "assignment") {
      try {
        await addCanvasAssignmentToPlanner(Number(data.course_id), Number(data.id));
      } catch (e) {
        showToast(e.message || "Could not add assignment", "warning");
      }
      btn.disabled = true;
      btn.textContent = "✓ In planner";
      btn.classList.add("cv-add-btn--done");
      return;
    }

    if (kind === "announcement") {
      const ok = addCanvasAnnouncementAsNoteIfNew({
        id: data.id,
        title: data.title,
        message: data.message || data.body,
      });
      save("flux_notes", notes);
      if (typeof syncKey === "function") syncKey("notes", notes);
      if (typeof renderNotesList === "function") renderNotesList();
      showToast(ok ? "Announcement saved as note ✓" : "Already in notes", ok ? "success" : "info");
      btn.disabled = true;
      btn.textContent = ok ? "✓ Saved" : "Already saved";
      btn.classList.add("cv-add-btn--done");
      return;
    }

    if (kind === "module-item") {
      // Assignment module item: defer to the planner helper (which dedupes by canvasAssignmentId).
      if (data.assignmentId && data.course_id) {
        try {
          await addCanvasAssignmentToPlanner(Number(data.course_id), Number(data.assignmentId));
          btn.disabled = true; btn.textContent = "✓ In planner";
          btn.classList.add("cv-add-btn--done");
        } catch (e) { showToast(e.message || "Could not add", "warning"); }
        return;
      }
      // Page / file / external URL -> save as a Flux note with the link.
      const body = `${courseName}\n\nFrom Canvas module: ${data.module_name || ""}\n\nLink: ${data.html_url || ""}`;
      pushNote(`📚 ${data.title || "Module item"}`, body, "canvasModuleItemKey", data.itemKey || null);
      showToast("Module item saved as note ✓", "success");
      btn.disabled = true; btn.textContent = "✓ Saved";
      btn.classList.add("cv-add-btn--done");
      return;
    }

    if (kind === "calendar-event") {
      // If it points to a real Canvas assignment, route through the planner helper.
      if (data.assignment_id && data.course_id) {
        try {
          await addCanvasAssignmentToPlanner(Number(data.course_id), Number(data.assignment_id));
        } catch (e) { showToast(e.message || "Could not add", "warning"); }
      } else {
        pushTask(data.title || "Canvas event", ymd(data.start_at), {
          subject: canvasFluxSubjectKeyFromCourseName(courseName),
          priority: "medium",
          type: "event",
          notes: data.description ? canvasStripHtml(data.description).slice(0, 500) : "",
          canvasCalendarEventId: data.id,
        });
      }
      btn.disabled = true; btn.textContent = "✓ In planner";
      btn.classList.add("cv-add-btn--done");
      return;
    }

    if (kind === "inbox-message") {
      const body = (data.participants || []).map((p) => p.name).join(", ") +
        "\n\n" + canvasStripHtml(data.last_message || "");
      pushNote(`✉ ${data.subject || "(no subject)"}`, body, "canvasConversationId", data.id);
      btn.disabled = true; btn.textContent = "✓ Saved";
      btn.classList.add("cv-add-btn--done");
      return;
    }

    if (kind === "file") {
      const body = `${courseName}\n\n${data.display_name || data.filename || "File"}\n\n${data.url || ""}`;
      pushNote(`📎 ${data.display_name || data.filename || "File"}`, body, "canvasFileId", data.id);
      btn.disabled = true; btn.textContent = "✓ Saved";
      btn.classList.add("cv-add-btn--done");
      return;
    }
  };

  // ────────────────────────────────────────────────────────────────
  // UI shell
  // ────────────────────────────────────────────────────────────────
  function renderShell() {
    const stack = document.getElementById("canvasHubStack");
    if (!stack) return;

    if (!isConnected()) {
      stack.innerHTML = renderConnectScreen();
      requestAnimationFrame(() => {
        const h = document.getElementById("cvConnHost");
        if (h && !h.value) h.value = load("flux_canvas_host", "") || hostFromUrl(load("flux_canvas_url", ""));
        const t = document.getElementById("cvConnToken");
        if (t && !t.value) t.value = load("flux_canvas_token", "") || "";
      });
      return;
    }

    CV.host = hostFromUrl(canvasUrl);
    CV.connected = true;

    stack.innerHTML = `
      <div class="cv-wrap">
        <header class="cv-head">
          <div class="cv-head__left">
            <div class="cv-head__title flux-color-title">Canvas</div>
            <div class="cv-head__conn"><span class="cv-conn-dot"></span>Connected · ${esc(CV.host || "")}</div>
          </div>
          <div class="cv-head__actions">
            <select id="cvCourseSelect" class="cv-course-select" onchange="window.fluxCanvasOnCourseChange(this.value)">
              <option value="all">All courses</option>
              ${(CV.courses || []).map((c) =>
                `<option value="${c.id}" ${String(CV.selectedCourseId) === String(c.id) ? "selected" : ""}>${esc(c.name || c.course_code || "Course")}</option>`,
              ).join("")}
            </select>
            <button type="button" class="cv-btn cv-btn--ghost" onclick="window.fluxCanvasRefresh()" title="Refresh">↻ Refresh</button>
            <button type="button" class="cv-btn cv-btn--ghost" onclick="window.fluxCanvasDisconnect()" title="Disconnect">⏻</button>
          </div>
        </header>

        <nav class="cv-tabs" role="tablist" aria-label="Canvas sections">
          ${TABS.map((t) =>
            `<button type="button" role="tab" data-cv-tab="${t.id}" class="cv-tab ${CV.activeTab === t.id ? "active" : ""}" onclick="window.fluxCanvasSetTab('${t.id}')">
              <span class="cv-tab__ico" aria-hidden="true">${t.icon}</span>
              <span>${esc(t.label)}</span>
            </button>`,
          ).join("")}
        </nav>

        <section class="cv-body" id="cvBody">
          <div class="cv-loading">Loading…</div>
        </section>
      </div>
    `;
  }

  function renderConnectScreen() {
    return `
      <div class="cv-connect">
        <div class="cv-connect__logo">
          <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
            <rect width="40" height="40" rx="9" fill="#e72429"/>
            <text x="50%" y="55%" text-anchor="middle" fill="#fff" font-size="22" font-weight="800" font-family="system-ui">C</text>
          </svg>
        </div>
        <h2 class="cv-connect__title flux-color-title">Connect Canvas</h2>
        <p class="cv-connect__sub">See your assignments, announcements, modules, and more — and pull anything into Flux with one click.</p>

        <label class="cv-connect__label">Canvas host</label>
        <input type="text" id="cvConnHost" placeholder="yourschool.instructure.com" class="cv-connect__input">

        <label class="cv-connect__label">Access token</label>
        <div class="cv-connect__row">
          <input type="password" id="cvConnToken" placeholder="Paste your token" class="cv-connect__input">
          <button type="button" class="cv-btn cv-btn--ghost" onclick="(function(e){const i=document.getElementById('cvConnToken');if(i)i.type=i.type==='password'?'text':'password';})()">👁</button>
        </div>

        <details class="cv-connect__help">
          <summary>How do I get a Canvas access token?</summary>
          <ol>
            <li>Open Canvas → Account → Settings</li>
            <li>Scroll to "Approved Integrations" → New Access Token</li>
            <li>Name it "Flux Planner", set an expiry, click Generate</li>
            <li>Paste it here. Tokens stay on this device.</li>
          </ol>
        </details>

        <button type="button" class="cv-btn cv-btn--primary cv-connect__cta" onclick="window.fluxCanvasConnect()">Connect Canvas</button>
        <div id="cvConnErr" class="cv-connect__err"></div>
      </div>
    `;
  }

  // ────────────────────────────────────────────────────────────────
  // Tab renderers
  // ────────────────────────────────────────────────────────────────
  async function renderActiveTab() {
    const body = document.getElementById("cvBody");
    if (!body) return;
    body.innerHTML = renderSkeleton();
    CV.loading = true;
    try {
      switch (CV.activeTab) {
        case "assignments":   await renderAssignmentsTab(body); break;
        case "announcements": await renderAnnouncementsTab(body); break;
        case "modules":       await renderModulesTab(body); break;
        case "calendar":      await renderCalendarTab(body); break;
        case "inbox":         await renderInboxTab(body); break;
        case "files":         await renderFilesTab(body); break;
        default:
          rememberTab("assignments");
          return renderActiveTab();
      }
    } catch (e) {
      body.innerHTML = renderError(e);
    } finally {
      CV.loading = false;
    }
  }

  function renderSkeleton() {
    return `
      <div class="cv-skel cv-skel--row"></div>
      <div class="cv-skel cv-skel--row"></div>
      <div class="cv-skel cv-skel--row"></div>
      <div class="cv-skel cv-skel--row"></div>
    `;
  }

  function renderError(e) {
    const msg = (e && (e.message || String(e))) || "Something went wrong";
    return `
      <div class="cv-error">
        <div class="cv-error__icon">⚠</div>
        <div class="cv-error__title">Couldn't load this tab</div>
        <div class="cv-error__msg">${esc(msg)}</div>
        <button type="button" class="cv-btn cv-btn--ghost" onclick="window.fluxCanvasRefresh()">Try again</button>
      </div>
    `;
  }

  function emptyState(label) {
    return `<div class="cv-empty">${esc(label)}</div>`;
  }

  function filteredCourses() {
    if (CV.selectedCourseId === "all") return CV.courses || [];
    return (CV.courses || []).filter((c) => String(c.id) === String(CV.selectedCourseId));
  }

  // ── Assignments tab ────────────────────────────────────────────
  async function renderAssignmentsTab(body) {
    const courses = filteredCourses();
    const ids = courses.map((c) => c.id);
    const all = [];
    for (const c of courses.slice(0, 14)) {
      try {
        const list = await loadAssignments(c.id);
        list.forEach((a) =>
          all.push(Object.assign({}, a, {
            course_id: c.id, course_name: c.name || c.course_code,
            course_color: courseColor(c),
          })),
        );
      } catch (_) { /* skip course on error */ }
    }
    all.sort((a, b) => (a.due_at || "").localeCompare(b.due_at || ""));
    const upcoming = all.filter((a) => a.due_at && new Date(a.due_at) >= new Date(Date.now() - 86400000));
    const undated = all.filter((a) => !a.due_at);
    const counts = upcoming.length + " upcoming · " + undated.length + " undated";
    const pending = upcoming.filter((a) =>
      typeof canvasAssignmentTaskExists === "function" ? !canvasAssignmentTaskExists(a.course_id, a.id) : true,
    );

    body.innerHTML = `
      <div class="cv-toolbar">
        <div class="cv-toolbar__meta">${counts}</div>
        <button type="button" class="cv-btn cv-btn--primary" onclick="window.fluxCanvasBulkAddAssignments()">
          ⬇ Add ${pending.length} to Flux
        </button>
      </div>
      ${upcoming.length
        ? `<div class="cv-list">${upcoming.slice(0, 80).map(rowAssignment).join("")}</div>`
        : emptyState("No upcoming assignments.")}
      ${undated.length
        ? `<details class="cv-section"><summary>Undated (${undated.length})</summary>
            <div class="cv-list">${undated.slice(0, 40).map(rowAssignment).join("")}</div>
           </details>`
        : ""}
    `;
  }

  function rowAssignment(a) {
    const exists = typeof canvasAssignmentTaskExists === "function" && canvasAssignmentTaskExists(a.course_id, a.id);
    const dueCls = due(a.due_at);
    return `
      <article class="cv-row" style="--row-color:${esc(a.course_color || "#3b82f6")}">
        <div class="cv-row__line"></div>
        <div class="cv-row__main">
          <div class="cv-row__title">${esc(a.name || "Assignment")}</div>
          <div class="cv-row__meta">
            <span class="cv-meta__course">${esc(a.course_name || "Course")}</span>
            <span class="cv-meta__sep">·</span>
            <span class="cv-meta__due cv-meta__due--${dueCls}">${a.due_at ? esc(a.due_at.slice(0, 16).replace("T", " ")) : "No due date"}</span>
            ${a.points_possible != null ? `<span class="cv-meta__sep">·</span><span class="cv-meta__pts">${esc(String(a.points_possible))} pts</span>` : ""}
          </div>
        </div>
        ${exists
          ? `<button type="button" class="cv-add-btn cv-add-btn--done" disabled>✓ In planner</button>`
          : addBtn("assignment", { id: a.id, course_id: a.course_id, course_name: a.course_name })}
        ${a.html_url ? `<a href="${esc(a.html_url)}" target="_blank" rel="noopener noreferrer" class="cv-row__open" title="Open in Canvas">↗</a>` : ""}
      </article>
    `;
  }

  // ── Announcements tab ──────────────────────────────────────────
  async function renderAnnouncementsTab(body) {
    const courses = filteredCourses();
    const list = await loadAnnouncements(courses.map((c) => c.id));
    const byId = new Map(CV.courses.map((c) => [String(c.id), c]));
    list.sort((a, b) => (b.posted_at || "").localeCompare(a.posted_at || ""));
    body.innerHTML = list.length
      ? `<div class="cv-list cv-list--cards">${list.slice(0, 60).map((a) => {
          const cid = (a.context_code || "").replace("course_", "");
          const c = byId.get(cid) || {};
          const color = courseColor(c);
          const preview = canvasStripHtml(a.message || "").slice(0, 320);
          const saved = (notes || []).some((n) => n.canvasAnnouncementId === a.id);
          return `<article class="cv-card" style="--row-color:${esc(color)}">
            <div class="cv-card__line"></div>
            <div class="cv-card__head">
              <div class="cv-card__title">${esc(a.title || "Announcement")}</div>
              <div class="cv-card__meta">
                <span>${esc(c.name || a.context_name || "Course")}</span>
                <span class="cv-meta__sep">·</span>
                <span>${esc((a.posted_at || "").slice(0, 16).replace("T", " "))}</span>
              </div>
            </div>
            <div class="cv-card__body">${esc(preview)}${(a.message || "").length > 320 ? "…" : ""}</div>
            <div class="cv-card__actions">
              ${saved
                ? `<button type="button" class="cv-add-btn cv-add-btn--done" disabled>✓ In notes</button>`
                : addBtn("announcement", { id: a.id, title: a.title, message: a.message, course_name: c.name })}
              ${a.html_url ? `<a class="cv-row__open" href="${esc(a.html_url)}" target="_blank" rel="noopener noreferrer">↗ Open</a>` : ""}
            </div>
          </article>`;
        }).join("")}</div>`
      : emptyState("No recent announcements.");
  }

  // ── Modules tab ────────────────────────────────────────────────
  async function renderModulesTab(body) {
    const courses = filteredCourses();
    if (!courses.length) { body.innerHTML = emptyState("Pick a course to see modules."); return; }
    const groups = [];
    for (const c of courses.slice(0, 6)) {
      try {
        const mods = await loadModules(c.id);
        groups.push({ course: c, modules: mods });
      } catch (_) {}
    }
    body.innerHTML = groups.length
      ? groups.map((g) => {
          const color = courseColor(g.course);
          return `<section class="cv-mod-group" style="--row-color:${esc(color)}">
            <header class="cv-mod-group__head">
              <span class="cv-mod-group__dot" style="background:${esc(color)}"></span>
              <span>${esc(g.course.name || g.course.course_code || "Course")}</span>
              <span class="cv-mod-group__count">${g.modules.length} modules</span>
            </header>
            ${g.modules.length
              ? g.modules.map((m, i) => `
                <details class="cv-mod" ${i < 2 ? "open" : ""}>
                  <summary>${esc(m.name || "Module")} <span class="cv-mod__count">${(m.items || []).length}</span></summary>
                  <div class="cv-mod__items">
                    ${(m.items || []).map((it) => rowModuleItem(g.course, m, it)).join("")
                      || `<div class="cv-empty cv-empty--inline">No items.</div>`}
                  </div>
                </details>`).join("")
              : `<div class="cv-empty cv-empty--inline">No modules visible in this course.</div>`}
          </section>`;
        }).join("")
      : emptyState("No modules found.");
  }

  function rowModuleItem(course, mod, it) {
    const t = String(it.type || "");
    const icon =
      t === "Assignment" ? "📝" :
      t === "Quiz" ? "📊" :
      t === "Page" ? "📄" :
      t === "ExternalUrl" ? "🔗" :
      t === "File" ? "📎" :
      t === "Discussion" ? "💬" :
      t === "SubHeader" ? "·" : "📌";
    if (t === "SubHeader") {
      return `<div class="cv-mod-sub">${esc(it.title || "")}</div>`;
    }
    const data = {
      itemKey: course.id + ":" + mod.id + ":" + it.id,
      course_id: course.id,
      course_name: course.name,
      module_name: mod.name,
      title: it.title,
      html_url: it.html_url,
    };
    if (t === "Assignment" && it.content_id) data.assignmentId = it.content_id;
    const exists = data.assignmentId
      ? (typeof canvasAssignmentTaskExists === "function" && canvasAssignmentTaskExists(course.id, data.assignmentId))
      : false;
    return `
      <div class="cv-mod-item">
        <span class="cv-mod-item__ico">${icon}</span>
        <div class="cv-mod-item__title">${esc(it.title || "Item")}</div>
        <span class="cv-mod-item__type">${esc(t || "Item")}</span>
        ${exists
          ? `<button type="button" class="cv-add-btn cv-add-btn--done" disabled>✓ In planner</button>`
          : addBtn("module-item", data)}
        ${it.html_url ? `<a class="cv-row__open" href="${esc(it.html_url)}" target="_blank" rel="noopener noreferrer">↗</a>` : ""}
      </div>
    `;
  }

  // ── Calendar tab ───────────────────────────────────────────────
  async function renderCalendarTab(body) {
    const evs = await loadCalendarEvents();
    const byId = new Map(CV.courses.map((c) => [String(c.id), c]));
    evs.sort((a, b) => (a.start_at || "").localeCompare(b.start_at || ""));
    body.innerHTML = evs.length
      ? `<div class="cv-list">${evs.slice(0, 100).map((e) => {
          const cid = (e.context_code || "").replace("course_", "");
          const c = byId.get(cid) || {};
          const dueCls = due(e.start_at);
          return `<article class="cv-row" style="--row-color:${esc(courseColor(c))}">
            <div class="cv-row__line"></div>
            <div class="cv-row__main">
              <div class="cv-row__title">${esc(e.title || "Event")}</div>
              <div class="cv-row__meta">
                <span>${esc(c.name || "Course")}</span>
                <span class="cv-meta__sep">·</span>
                <span class="cv-meta__due cv-meta__due--${dueCls}">${esc((e.start_at || "").slice(0, 16).replace("T", " ") || "No date")}</span>
              </div>
            </div>
            ${addBtn("calendar-event", {
              id: e.id, title: e.title, start_at: e.start_at,
              description: e.description, course_id: cid, course_name: c.name,
              assignment_id: e.assignment ? e.assignment.id : null,
            })}
            ${e.html_url ? `<a class="cv-row__open" href="${esc(e.html_url)}" target="_blank" rel="noopener noreferrer">↗</a>` : ""}
          </article>`;
        }).join("")}</div>`
      : emptyState("No events in the next 60 days.");
  }

  // ── Inbox tab ──────────────────────────────────────────────────
  async function renderInboxTab(body) {
    const list = await loadInbox();
    body.innerHTML = list.length
      ? `<div class="cv-list cv-list--cards">${list.slice(0, 60).map((c) => {
          const unread = c.workflow_state === "unread";
          const who = (c.participants && c.participants[0] && c.participants[0].name) || "";
          const initials = (who.charAt(0) || "?").toUpperCase();
          const saved = (notes || []).some((n) => n.canvasConversationId === c.id);
          return `<article class="cv-card cv-card--inbox ${unread ? "unread" : ""}">
            <div class="cv-card__avatar">${esc(initials)}</div>
            <div class="cv-card__body cv-card__body--inbox">
              <div class="cv-card__head">
                <div class="cv-card__title">${esc(c.subject || "(no subject)")}</div>
                <div class="cv-card__meta">${esc((c.last_message_at || "").slice(0, 16).replace("T", " "))}</div>
              </div>
              <div class="cv-card__preview">${esc((c.last_message || "").slice(0, 220))}</div>
              <div class="cv-card__participants">${esc((c.participants || []).map((p) => p.name).slice(0, 3).join(", "))}</div>
            </div>
            ${saved
              ? `<button type="button" class="cv-add-btn cv-add-btn--done" disabled>✓ Saved</button>`
              : addBtn("inbox-message", { id: c.id, subject: c.subject, last_message: c.last_message, participants: c.participants })}
          </article>`;
        }).join("")}</div>`
      : emptyState("Inbox is empty.");
  }

  // ── Files tab ──────────────────────────────────────────────────
  async function renderFilesTab(body) {
    const courses = filteredCourses();
    if (!courses.length) { body.innerHTML = emptyState("Pick a course to see files."); return; }
    const groups = [];
    for (const c of courses.slice(0, 6)) {
      try { groups.push({ course: c, files: await loadFiles(c.id) }); } catch (_) {}
    }
    body.innerHTML = groups.length && groups.some((g) => g.files.length)
      ? groups.map((g) => {
          if (!g.files.length) return "";
          return `<section class="cv-mod-group" style="--row-color:${esc(courseColor(g.course))}">
            <header class="cv-mod-group__head">
              <span class="cv-mod-group__dot" style="background:${esc(courseColor(g.course))}"></span>
              <span>${esc(g.course.name || g.course.course_code || "Course")}</span>
              <span class="cv-mod-group__count">${g.files.length} files</span>
            </header>
            <div class="cv-list">${g.files.slice(0, 40).map((f) => {
              const saved = (notes || []).some((n) => n.canvasFileId === f.id);
              return `<article class="cv-row">
                <div class="cv-row__main">
                  <div class="cv-row__title">${esc(f.display_name || f.filename || "File")}</div>
                  <div class="cv-row__meta">
                    <span>${esc(f["content-type"] || f.content_type || "file")}</span>
                    <span class="cv-meta__sep">·</span>
                    <span>${esc((f.updated_at || "").slice(0, 10))}</span>
                  </div>
                </div>
                ${saved
                  ? `<button type="button" class="cv-add-btn cv-add-btn--done" disabled>✓ Saved</button>`
                  : addBtn("file", { id: f.id, display_name: f.display_name, filename: f.filename, url: f.url, course_name: g.course.name })}
                ${f.url ? `<a class="cv-row__open" href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">↗</a>` : ""}
              </article>`;
            }).join("")}</div>
          </section>`;
        }).join("")
      : emptyState("No files visible.");
  }

  // ────────────────────────────────────────────────────────────────
  // Public entry points used by the rest of the app
  // ────────────────────────────────────────────────────────────────
  window.fluxCanvasSetTab = function (id) {
    if (!TABS.some((t) => t.id === id)) return;
    rememberTab(id);
    document.querySelectorAll(".cv-tab").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-cv-tab") === id);
    });
    renderActiveTab();
  };

  window.fluxCanvasOnCourseChange = function (val) {
    rememberCourse(val);
    cacheBust();
    renderActiveTab();
  };

  window.fluxCanvasRefresh = function () {
    cacheBust();
    loadCourses(true).catch(() => {}).finally(renderActiveTab);
  };

  window.fluxCanvasBulkAddAssignments = function () {
    const buttons = document.querySelectorAll('#cvBody .cv-add-btn[data-cv-kind="assignment"]:not(.cv-add-btn--done)');
    if (!buttons.length) { showToast("Nothing left to add ✓", "info"); return; }
    if (!confirm("Add " + buttons.length + " upcoming assignments to Flux?")) return;
    let n = 0;
    buttons.forEach((b) => { b.click(); n++; });
    showToast("Adding " + n + " assignments…", "success");
  };

  window.fluxCanvasDisconnect = function () {
    if (!confirm("Disconnect Canvas from Flux? Your existing tasks and notes won't be touched.")) return;
    try {
      save("flux_canvas_token", null);
      save("flux_canvas_host", null);
      save("flux_canvas_url", null);
      try { canvasToken = ""; canvasUrl = ""; } catch (_) {}
    } catch (_) {}
    CV.connected = false;
    cacheBust();
    renderShell();
  };

  window.fluxCanvasConnect = async function () {
    const errEl = document.getElementById("cvConnErr");
    const host = (document.getElementById("cvConnHost")?.value || "").trim();
    const tok = (document.getElementById("cvConnToken")?.value || "").trim();
    if (errEl) errEl.textContent = "";
    if (!host || !tok) {
      if (errEl) errEl.textContent = "Host and token are both required.";
      return;
    }
    const hostnameOnly = hostFromUrl(host);
    if (!hostnameOnly) {
      if (errEl) errEl.textContent = "That host doesn't look right.";
      return;
    }
    try {
      // Verify token by hitting /users/self/profile through the existing proxy.
      try { canvasToken = tok; canvasUrl = "https://" + hostnameOnly; } catch (_) {}
      save("flux_canvas_token", tok);
      save("flux_canvas_host", hostnameOnly);
      save("flux_canvas_url", "https://" + hostnameOnly);
      await canvasProxyGet("/users/self/profile");
      cacheBust();
      await loadCourses(true);
      renderShell();
      renderActiveTab();
      showToast("Canvas connected ✓", "success");
    } catch (e) {
      try { canvasToken = ""; canvasUrl = ""; } catch (_) {}
      save("flux_canvas_token", null);
      if (errEl) errEl.textContent = e.message || "Connection failed.";
    }
  };

  /** Called by app.js whenever the user navigates to the Canvas tab. */
  window.__fluxRenderCanvasPanel = async function () {
    renderShell();
    if (!isConnected()) return;
    try {
      if (!CV.courses.length) await loadCourses();
      renderShell();
    } catch (_) {}
    renderActiveTab();
  };

  // Legacy aliases — some places in app.js still call these names.
  window.initCanvasPanel = window.__fluxRenderCanvasPanel;

  // Provide a no-op stub for any leftover references to the old API surface.
  // (Old code paths that called CanvasViews.navigate now just refresh the panel.)
  window.CanvasViews = {
    navigate: function () { window.__fluxRenderCanvasPanel(); },
    back: function () { window.__fluxRenderCanvasPanel(); },
    forward: function () { window.__fluxRenderCanvasPanel(); },
  };
  // Expose minimal state shape for legacy callers that read window.CanvasState
  // (e.g. AI prompt builder, school panel disconnect). Updated by renderShell().
  Object.defineProperty(CV, "token", { get(){ try{return canvasToken||"";}catch{return "";} } });
  Object.defineProperty(CV, "pageContext", { value: null, writable: true });
  window.CanvasState = CV;

  // Stubs for legacy mobile-sidebar / split-layout helpers that app.js calls.
  // The new hub is a single column, no split mode, no mobile drawer — these
  // exist purely to avoid "is not a function" warnings on nav transitions.
  if (typeof window.fluxCanvasCloseMobileSidebar !== "function") {
    window.fluxCanvasCloseMobileSidebar = function () {};
  }
  if (typeof window.fluxApplyCanvasSplitLayout !== "function") {
    window.fluxApplyCanvasSplitLayout = function () {};
  }
})();
