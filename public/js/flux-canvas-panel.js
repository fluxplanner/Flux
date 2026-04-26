/**
 * Flux Canvas LMS panel — API-driven mini browser (loaded after app.js).
 * Expects globals: load, save, esc, showToast, getSB, SB_URL, SB_ANON, tasks, classes,
 * canvasToken, canvasUrl, nav, openFluxAgent, calcGPA, grades, calcUrgency, syncKey,
 * renderStats, renderTasks, renderCalendar, renderCountdown, cleanClassName,
 * FLUX_FLAGS, requiresPro, showUpgradePrompt, canvasProxyPostForm, refreshCanvasHubFullFetch
 */
(function () {
  const CanvasState = {
    token: null,
    host: null,
    connected: false,
    history: [],
    historyIndex: -1,
    currentView: null,
    currentParams: {},
    currentTitle: "",
    cache: new Map(),
    CACHE_TTL: 3 * 60 * 1000,
    pageContext: null,
    loading: false,
    error: null,
    courses: [],
    announcementCache: new Map(),
    _shellReady: false,
    _sidebarCollapsed: load("flux_canvas_sidebar_collapsed", false),
    _inboxThread: null,
  };

  function hostFromStoredUrl(url) {
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

  function syncLegacyCanvasGlobals() {
    try {
      canvasToken = CanvasState.token || "";
      canvasUrl = CanvasState.host ? "https://" + CanvasState.host : "";
    } catch (_) {}
  }

  function truncateJsonContext(obj, max) {
    const s = JSON.stringify(obj, null, 2);
    if (s.length <= max) return s;
    return s.slice(0, max - 20) + "\n…(truncated)";
  }

  function updateAICanvasContextBadge() {
    const el = document.getElementById("fluxAiCanvasContextBadge");
    if (!el) return;
    const on =
      CanvasState.pageContext &&
      CanvasState.connected &&
      typeof CanvasState.pageContext === "object";
    el.style.display = on ? "inline-flex" : "none";
    if (on) el.setAttribute("title", "Flux AI can see your Canvas page");
  }

  window.clearFluxCanvasPageContext = function () {
    CanvasState.pageContext = null;
    updateAICanvasContextBadge();
    showToast("Canvas context cleared from AI", "info");
  };

  const CanvasAPI = {
    async fetch(path, options) {
      options = options || {};
      if (!CanvasState.token || !CanvasState.host) {
        throw new Error("Canvas not connected. Add your Canvas token in School Info.");
      }
      if (FLUX_FLAGS.PAYMENTS_ENABLED &&
        FLUX_FLAGS.ENFORCE_CANVAS_GATE &&
        typeof requiresPro === "function" &&
        requiresPro("canvasSync")) {
        if (typeof showUpgradePrompt === "function") {
          showUpgradePrompt("canvasSync", "Pull assignments directly from Canvas into your planner");
        }
        throw new Error("Canvas sync requires Flux Pro");
      }
      const cacheKey = `${path}:${JSON.stringify(options.params || {})}`;
      const cached = CanvasState.cache.get(cacheKey);
      if (cached && Date.now() - cached.fetchedAt < CanvasState.CACHE_TTL) {
        return cached.data;
      }
      let fullPath = path;
      if (options.params) {
        const qs = new URLSearchParams(options.params).toString();
        fullPath = `${path}${path.includes("?") ? "&" : "?"}${qs}`;
      }
      const session = await getSB().auth.getSession();
      const token = session?.data?.session?.access_token || SB_ANON;
      const res = await fetch(`${SB_URL}/functions/v1/canvas-proxy`, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          apikey: SB_ANON,
        },
        body: JSON.stringify({
          host: CanvasState.host,
          path: fullPath,
          method: options.method || "GET",
          canvasToken: CanvasState.token,
        }),
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Canvas did not return JSON");
      }
      if (!res.ok) {
        const err = data && (data.error || data.message);
        const e = new Error(err || "Canvas API error: " + res.status);
        e.status = res.status;
        throw e;
      }
      CanvasState.cache.set(cacheKey, { data, fetchedAt: Date.now() });
      return data;
    },
    getCourses() {
      return this.fetch("/api/v1/courses", {
        params: {
          enrollment_state: "active",
          "include[]": ["course_image", "term", "favorites"],
          per_page: 50,
        },
      });
    },
    getAssignments(courseId, options) {
      options = options || {};
      return this.fetch(`/api/v1/courses/${courseId}/assignments`, {
        params: Object.assign(
          {
            per_page: 50,
            order_by: "due_at",
            "include[]": ["submission", "overrides"],
            bucket: options.bucket || "future",
          },
          options.params || {},
        ),
      });
    },
    getAssignment(courseId, assignmentId) {
      return this.fetch(`/api/v1/courses/${courseId}/assignments/${assignmentId}`, {
        params: { "include[]": ["submission", "rubric_assessment"] },
      });
    },
    getAnnouncements(courseIds) {
      const codes = (courseIds || []).map((id) => `course_${id}`);
      if (!codes.length) return Promise.resolve([]);
      return this.fetch("/api/v1/announcements", {
        params: {
          "context_codes[]": codes,
          per_page: 20,
          start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });
    },
    getModules(courseId) {
      return this.fetch(`/api/v1/courses/${courseId}/modules`, {
        params: { "include[]": ["items", "content_details"], per_page: 50 },
      });
    },
    getAllGrades() {
      return this.fetch("/api/v1/users/self/enrollments", {
        params: {
          "state[]": ["active"],
          "include[]": ["grades", "course"],
          per_page: 50,
        },
      });
    },
    getCalendarEvents(startDate, endDate) {
      return this.fetch("/api/v1/calendar_events", {
        params: {
          type: "assignment",
          start_date: startDate,
          end_date: endDate,
          per_page: 100,
        },
      });
    },
    getUserProfile() {
      return this.fetch("/api/v1/users/self/profile");
    },
    getInbox() {
      return this.fetch("/api/v1/conversations", {
        params: { scope: "inbox", per_page: 20 },
      });
    },
  };

  function courseColor(c) {
    return c.course_color || c.color || "#3b82f6";
  }

  function stripHtml(s) {
    return String(s || "")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function sanitizeCanvasHtml(html) {
    const tpl = document.createElement("template");
    tpl.innerHTML = String(html || "");
    const walk = (root) => {
      const all = root.querySelectorAll("*");
      all.forEach((el) => {
        const tag = el.tagName.toLowerCase();
        const allowed = new Set([
          "p", "br", "b", "i", "strong", "em", "u", "ul", "ol", "li",
          "a", "h1", "h2", "h3", "h4", "div", "span", "blockquote", "img",
        ]);
        if (!allowed.has(tag)) {
          const p = document.createElement("span");
          p.textContent = el.textContent || "";
          el.replaceWith(p);
          return;
        }
        [...el.attributes].forEach((at) => {
          const n = at.name.toLowerCase();
          if (tag === "a" && n === "href") {
            const v = at.value;
            if (!/^https?:\/\//i.test(v)) el.removeAttribute(at.name);
          } else if (tag === "img" && (n === "src" || n === "alt")) {
            if (n === "src" && !/^https?:\/\//i.test(at.value)) {
              el.removeAttribute("src");
            }
          } else if (!["class", "href", "src", "alt", "target", "rel"].includes(n)) {
            el.removeAttribute(at.name);
          }
        });
        if (tag === "a") {
          el.setAttribute("target", "_blank");
          el.setAttribute("rel", "noopener noreferrer");
        }
      });
    };
    walk(tpl);
    return tpl.innerHTML;
  }

  function renderCanvasSkeleton(kind) {
    const card = `<div class="canvas-card canvas-skeleton"><div class="skeleton" style="height:14px;width:60%;margin-bottom:10px"></div><div class="skeleton" style="height:40px"></div></div>`;
    const row = `<div class="canvas-assignment-row canvas-skeleton"><div class="skeleton" style="height:36px;width:100%"></div></div>`;
    if (kind === "course") {
      return `<div class="canvas-tab-bar">${[1, 2, 3, 4, 5].map(() => `<div class="skeleton" style="height:28px;width:72px;display:inline-block;margin-right:8px"></div>`).join("")}</div>${row}${row}${row}`;
    }
    return `${card}${card}${row}${row}${row}${row}${row}<div class="canvas-course-grid">${[1, 2, 3, 4].map(() => `<div class="canvas-card canvas-skeleton"><div class="skeleton" style="height:80px"></div></div>`).join("")}</div>`;
  }

  function renderCanvasError(msg, status) {
    const content = document.getElementById("canvasContent");
    if (!content) return;
    let hint = msg;
    let extra = "";
    if (status === 401 || /401|Unauthorized|invalid access token/i.test(msg)) {
      hint =
        "Your Canvas token has expired. Go to Canvas → Account → Settings to generate a new token.";
      extra = `<button type="button" class="btn-sec" onclick="fluxCanvasTokenUpdatePrompt()">Update token</button>`;
    } else if (status === 403 || /403|Forbidden/i.test(msg)) {
      hint =
        "You don't have permission to view this. It may have been removed by your teacher.";
    } else if (status === 404 || /404|not found/i.test(msg)) {
      hint = "This content no longer exists in Canvas.";
    } else if (/Host not allowed|host not allowed/i.test(msg)) {
      hint =
        "Your Canvas URL is not supported. Contact Flux support.";
    } else if (/network|fetch|timed out|timeout/i.test(msg)) {
      hint =
        "Couldn't reach Canvas. Check your internet connection.";
      extra = `<button type="button" class="btn-sec" onclick="CanvasViews.navigate(CanvasState.currentView, CanvasState.currentParams, {noHistory:true})">Try again</button>`;
    }
    content.innerHTML = `<div class="canvas-card" style="padding:20px">
      <div style="font-weight:700;margin-bottom:8px">Something went wrong</div>
      <div style="font-size:.85rem;color:var(--muted2);margin-bottom:14px">${esc(hint)}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button type="button" class="btn-sec" onclick="CanvasViews.back()">← Go back</button>
        ${extra}
        <button type="button" onclick="CanvasViews.navigate(CanvasState.currentView, CanvasState.currentParams, {noHistory:true})">Try again</button>
      </div></div>`;
  }

  window.fluxCanvasTokenUpdatePrompt = function () {
    const tok = prompt("Paste new Canvas access token:");
    if (!tok || !tok.trim()) return;
    CanvasState.token = tok.trim();
    save("flux_canvas_token", CanvasState.token);
    try {
      canvasToken = CanvasState.token;
    } catch (_) {}
    CanvasViews.navigate(CanvasState.currentView || "dashboard", CanvasState.currentParams || {}, {
      noHistory: true,
    });
  };

  function renderCanvasChrome() {
    const back = document.getElementById("canvasNavBack");
    const fwd = document.getElementById("canvasNavFwd");
    if (back) {
      back.disabled = CanvasState.historyIndex <= 0;
    }
    if (fwd) {
      fwd.disabled = CanvasState.historyIndex >= CanvasState.history.length - 1;
    }
    const bc = document.getElementById("canvasBreadcrumb");
    if (bc) {
      const parts = [];
      parts.push(
        `<button type="button" class="canvas-breadcrumb-seg" onclick="CanvasViews.navigate('dashboard',{})">Canvas</button>`,
      );
      const t = CanvasState.currentTitle || "";
      if (t) {
        parts.push(`<span class="canvas-breadcrumb-sep">→</span><span class="canvas-breadcrumb-current">${esc(t)}</span>`);
      }
      bc.innerHTML = parts.join("");
    }
    const splitBtn = document.getElementById("canvasSplitBtn");
    if (splitBtn) {
      splitBtn.style.display = window.innerWidth >= 1200 ? "" : "none";
    }
    updateAICanvasContextBadge();
  }

  function persistLastView() {
    if (CanvasState.currentView) {
      save("flux_canvas_last_view", CanvasState.currentView);
      save("flux_canvas_last_params", CanvasState.currentParams || {});
    }
  }

  const CanvasViews = {
    async navigate(view, params, options) {
      options = options || {};
      if (!options.noHistory) {
        CanvasState.history = CanvasState.history.slice(0, CanvasState.historyIndex + 1);
        CanvasState.history.push({ view, params, title: "" });
        CanvasState.historyIndex = CanvasState.history.length - 1;
      }
      CanvasState.currentView = view;
      CanvasState.currentParams = Object.assign({}, params || {});
      CanvasState.loading = true;
      CanvasState.error = null;
      renderCanvasChrome();
      const content = document.getElementById("canvasContent");
      if (content) {
        content.innerHTML = renderCanvasSkeleton(view === "course" ? "course" : "dash");
      }
      try {
        const renderer = this[view];
        if (!renderer) throw new Error("Unknown view: " + view);
        await renderer.call(this, CanvasState.currentParams);
        persistLastView();
      } catch (e) {
        CanvasState.error = e.message || String(e);
        renderCanvasError(CanvasState.error, e.status);
      } finally {
        CanvasState.loading = false;
      }
    },
    back() {
      if (CanvasState.historyIndex > 0) {
        CanvasState.historyIndex--;
        const h = CanvasState.history[CanvasState.historyIndex];
        this.navigate(h.view, h.params, { noHistory: true });
      }
    },
    forward() {
      if (CanvasState.historyIndex < CanvasState.history.length - 1) {
        CanvasState.historyIndex++;
        const h = CanvasState.history[CanvasState.historyIndex];
        this.navigate(h.view, h.params, { noHistory: true });
      }
    },
    async dashboard() {
      const courses = await CanvasAPI.getCourses();
      CanvasState.courses = Array.isArray(courses) ? courses : [];
      const courseIds = CanvasState.courses.slice(0, 8).map((c) => c.id);
      let announcements = [];
      if (courseIds.length) {
        try {
          announcements = await CanvasAPI.getAnnouncements(courseIds);
        } catch (_) {}
      }
      if (!Array.isArray(announcements)) announcements = [];
      announcements.forEach((a) => {
        if (a.id != null) CanvasState.announcementCache.set(Number(a.id), a);
      });
      const profileName = localStorage.getItem("flux_user_name") || "there";
      const in7 = new Date();
      in7.setDate(in7.getDate() + 7);
      const upcoming = [];
      for (const c of CanvasState.courses.slice(0, 12)) {
        try {
          const list = await CanvasAPI.getAssignments(c.id, { bucket: "future" });
          if (!Array.isArray(list)) continue;
          list.forEach((a) => {
            if (!a.due_at) return;
            const d = new Date(a.due_at);
            if (d <= in7) {
              upcoming.push(
                Object.assign({}, a, {
                  course_name: c.name || c.course_code,
                  course_color: courseColor(c),
                  course_id: c.id,
                }),
              );
            }
          });
        } catch (_) {}
      }
      upcoming.sort((a, b) => (a.due_at || "").localeCompare(b.due_at || ""));
      CanvasState.currentTitle = "Dashboard";
      if (CanvasState.history[CanvasState.historyIndex]) {
        CanvasState.history[CanvasState.historyIndex].title = "Dashboard";
      }
      const content = document.getElementById("canvasContent");
      const urgency = (due) => {
        if (!due) return "muted";
        const d = new Date(due);
        const now = new Date();
        if (d < now) return "red";
        if (d.toDateString() === now.toDateString()) return "gold";
        return "green";
      };
      const subChip = (a) => {
        const sub = a.submission;
        const done = !!(sub && sub.submitted_at) || !!a.has_submitted_attachments;
        if (done) return `<span class="canvas-status-chip submitted">Submitted ✓</span>`;
        if (sub && sub.workflow_state === "graded") {
          return `<span class="canvas-status-chip submitted">Graded</span>`;
        }
        if (a.late) return `<span class="canvas-status-chip late">Late</span>`;
        return `<span class="canvas-status-chip unsubmitted">Not submitted</span>`;
      };
      content.innerHTML = `
        <div class="canvas-card" style="margin-bottom:16px">
          <div style="font-size:1.1rem;font-weight:800">Welcome back, ${esc(profileName)}</div>
          <div style="font-size:.8rem;color:var(--muted2)">Here's what's happening in Canvas.</div>
        </div>
        <h3 class="canvas-section-title">Recent announcements</h3>
        ${announcements.slice(0, 6).length ? announcements.slice(0, 6).map((a) => {
          const prev = stripHtml(a.message || "").slice(0, 200);
          const cid = (a.context_code || "").replace("course_", "");
          return `<div class="canvas-card" style="border-left-color:${esc(courseColor(CanvasState.courses.find((x) => String(x.id) === String(cid)) || {}))}">
            <div style="font-weight:700">${esc(a.title || "Announcement")}</div>
            <div style="font-size:.72rem;color:var(--muted)">${esc(a.posted_at || "")} · ${esc(a.context_name || "")}</div>
            <div style="font-size:.82rem;color:var(--muted2);margin-top:8px">${esc(prev)}${(a.message || "").length > 200 ? "…" : ""}
              <button type="button" class="canvas-linkish" onclick="CanvasViews.navigate('announcement',{announcementId:${Number(a.id)}, courseId:${Number(cid)}})">Read more</button>
            </div></div>`;
        }).join("") : `<div class="canvas-card muted">No recent announcements.</div>`}
        <h3 class="canvas-section-title">Upcoming assignments (7 days)</h3>
        ${upcoming.length ? upcoming.slice(0, 12).map((a) => `
          <div class="canvas-assignment-row" style="border-left-color:${esc(a.course_color)}">
            <span class="canvas-dot" style="background:${esc(a.course_color)}"></span>
            <div style="flex:1;min-width:0">
              <button type="button" class="canvas-link-title" onclick="CanvasViews.navigate('assignment',{courseId:${a.course_id}, assignmentId:${a.id}})">${esc(a.name)}</button>
              <div style="font-size:.72rem;color:var(--muted)">${esc(a.course_name)}</div>
            </div>
            <span class="canvas-due-badge ${urgency(a.due_at)}">${esc((a.due_at || "").slice(0, 10))}</span>
            <span style="font-size:.72rem;font-family:JetBrains Mono,monospace;color:var(--muted)">${a.points_possible != null ? esc(String(a.points_possible)) + " pts" : ""}</span>
            ${subChip(a)}
          </div>`).join("") : `<div class="canvas-card muted">No assignments due in the next week.</div>`}
        <h3 class="canvas-section-title">My courses</h3>
        <div class="canvas-course-grid">
          ${CanvasState.courses.map((c) => `
            <button type="button" class="canvas-card canvas-course-tile" style="border-top:3px solid ${esc(courseColor(c))}" onclick="CanvasViews.navigate('course',{courseId:${c.id}, tab:'overview'})">
              <div style="font-weight:700;text-align:left">${esc(c.name || c.course_code)}</div>
              <div style="font-size:.72rem;color:var(--muted);text-align:left">${esc(c.course_code || "")}</div>
            </button>`).join("")}
        </div>`;
      renderCanvasSidebar();
      CanvasState.pageContext = {
        view: "dashboard",
        summary: "Canvas Dashboard — " + CanvasState.courses.length + " enrolled courses",
        upcomingAssignments: upcoming.slice(0, 10).map((a) => ({
          name: a.name,
          courseName: a.course_name,
          dueDate: a.due_at,
          pointsPossible: a.points_possible,
          submitted: !!(a.submission && a.submission.submitted_at) || !!a.has_submitted_attachments,
        })),
        recentAnnouncements: announcements.slice(0, 5).map((a) => ({
          title: a.title,
          courseName: a.context_name,
          postedAt: a.posted_at,
          preview: stripHtml(a.message || "").slice(0, 200),
        })),
      };
      updateAICanvasContextBadge();
    },
    async course(params) {
      const courseId = params.courseId;
      const tab = params.tab || "overview";
      const c = CanvasState.courses.find((x) => String(x.id) === String(courseId)) || {};
      const [future, overdue, modules, ann] = await Promise.all([
        CanvasAPI.getAssignments(courseId, { bucket: "future" }).catch(() => []),
        CanvasAPI.getAssignments(courseId, { bucket: "overdue" }).catch(() => []),
        CanvasAPI.getModules(courseId).catch(() => []),
        CanvasAPI.getAnnouncements([courseId]).catch(() => []),
      ]);
      const fu = Array.isArray(future) ? future : [];
      const ov = Array.isArray(overdue) ? overdue : [];
      const mo = Array.isArray(modules) ? modules : [];
      const an = Array.isArray(ann) ? ann : [];
      an.forEach((a) => {
        if (a.id != null) CanvasState.announcementCache.set(Number(a.id), a);
      });
      CanvasState.currentTitle = c.name || c.course_code || "Course";
      if (CanvasState.history[CanvasState.historyIndex]) {
        CanvasState.history[CanvasState.historyIndex].title = CanvasState.currentTitle;
      }
      const content = document.getElementById("canvasContent");
      const tabs = [
        ["overview", "Overview"],
        ["assignments", "Assignments"],
        ["modules", "Modules"],
        ["announcements", "Announcements"],
        ["grades", "Grades"],
      ];
      const tabBar = tabs.map(([id, lab]) => `
        <button type="button" class="canvas-tab ${tab === id ? "active" : ""}" onclick="CanvasViews.navigate('course',Object.assign({}, CanvasState.currentParams, {tab:'${id}'}))">${lab}</button>`).join("");
      let inner = "";
      if (tab === "overview") {
        const top = fu.filter((a) => a.due_at).sort((a, b) => (a.due_at || "").localeCompare(b.due_at || "")).slice(0, 5);
        inner = `<div class="canvas-card" style="border-left:4px solid ${esc(courseColor(c))}">
            <h2 style="margin:0 0 8px">${esc(c.name || "Course")}</h2>
            <div style="font-size:.82rem;color:var(--muted2)">${esc(c.course_code || "")}</div>
            ${c.teachers && c.teachers[0] ? `<div style="margin-top:8px;font-size:.85rem">Instructor: ${esc(c.teachers[0].display_name || "")}</div>` : ""}
            ${c.public_description ? `<div style="margin-top:12px;font-size:.85rem;color:var(--muted2)">${sanitizeCanvasHtml(c.public_description).slice(0, 4000)}</div>` : ""}
          </div>
          <h3 class="canvas-section-title">Next up</h3>
          ${top.map((a) => `<div class="canvas-assignment-row" style="border-left-color:${esc(courseColor(c))}">
            <button type="button" class="canvas-link-title" onclick="CanvasViews.navigate('assignment',{courseId:${courseId}, assignmentId:${a.id}})">${esc(a.name)}</button>
            <span class="canvas-due-badge gold">${esc((a.due_at || "").slice(0, 10))}</span>
          </div>`).join("") || `<div class="canvas-card muted">No upcoming due dates.</div>`}`;
      } else if (tab === "assignments") {
        const byWeek = {};
        fu.forEach((a) => {
          if (!a.due_at) return;
          const wk = new Date(a.due_at);
          wk.setDate(wk.getDate() - wk.getDay());
          const key = wk.toISOString().slice(0, 10);
          if (!byWeek[key]) byWeek[key] = [];
          byWeek[key].push(a);
        });
        inner = `<div style="display:flex;justify-content:flex-end;margin-bottom:10px">
            <button type="button" class="canvas-add-btn" onclick="fluxCanvasBulkAddConfirm()">Add all to Planner</button>
          </div>`;
        inner += Object.keys(byWeek).sort().map((wk) => {
          const rows = byWeek[wk].sort((a, b) => (a.due_at || "").localeCompare(b.due_at || ""));
          return `<div style="margin-bottom:18px"><div class="canvas-week-head">Week of ${esc(wk)}</div>
            ${rows.map((a) => fluxCanvasAssignmentRowHtml(courseId, a, c)).join("")}</div>`;
        }).join("");
        if (!inner.includes("canvas-assignment-row")) {
          inner += `<div class="canvas-card muted">No upcoming assignments in this bucket.</div>`;
        }
      } else if (tab === "modules") {
        inner = mo.length
          ? mo.map((m, idx) => `
            <details class="canvas-card" ${idx < 2 ? "open" : ""}>
              <summary style="font-weight:700;cursor:pointer">${esc(m.name || "Module")}</summary>
              <div style="margin-top:10px">
                ${(m.items || []).map((it) => {
                  const icon = it.type === "Assignment" ? "📝" : it.type === "Quiz" ? "📊" : it.type === "ExternalUrl" ? "🔗" : it.type === "Page" ? "📄" : "📌";
                  const u = encodeURIComponent(it.html_url || "");
                  return `<div class="canvas-mod-item">
                    <span>${icon}</span>
                    <button type="button" class="canvas-link-title" data-mod-type="${esc(String(it.type || ""))}" data-mod-cid="${it.content_id != null ? esc(String(it.content_id)) : ""}" data-mod-url="${u}" onclick="fluxOpenCanvasModuleItem(${courseId},this)">${esc(it.title || "Item")}</button>
                    ${it.completion_requirement && it.completion_requirement.completed ? "✓" : ""}
                  </div>`;
                }).join("") || "<div style='color:var(--muted)'>No items</div>"}
              </div>
            </details>`).join("")
          : `<div class="canvas-card muted">No modules visible.</div>`;
      } else if (tab === "announcements") {
        inner = an.length
          ? an.map((a) => {
            const body = stripHtml(a.message || "").slice(0, 400);
            return `<div class="canvas-card">
                <div style="font-weight:700">${esc(a.title || "")}</div>
                <div style="font-size:.72rem;color:var(--muted)">${esc(a.posted_at || "")}</div>
                <div style="margin-top:8px;font-size:.85rem;color:var(--muted2)">${esc(body)}…</div>
                <button type="button" class="canvas-linkish" onclick="CanvasViews.navigate('announcement',{announcementId:${Number(a.id)}, courseId:${courseId}})">Read full announcement</button>
              </div>`;
          }).join("")
          : `<div class="canvas-card muted">No announcements.</div>`;
      } else if (tab === "grades") {
        let rows = "";
        try {
          const ens = await CanvasAPI.fetch(`/api/v1/courses/${courseId}/enrollments`, {
            params: { user_id: "self", "include[]": ["grades"], per_page: 20 },
          });
          const en = Array.isArray(ens) ? ens.find((e) => String(e.type || "").includes("Student")) : null;
          const scores = (fu.concat(ov)).filter((x) => x.submission && (x.submission.entered_grade != null || x.submission.grade != null));
          rows = scores.map((a) => {
            const g = a.submission.entered_grade != null ? a.submission.entered_grade : a.submission.grade;
            return `<tr><td>${esc(a.name)}</td><td>${esc(String(g))}</td><td>${a.points_possible != null ? esc(String(a.points_possible)) : "—"}</td></tr>`;
          }).join("");
          const summary = en && en.grades
            ? `<div class="canvas-card" style="margin-bottom:12px">Course grade: <strong>${esc(String(en.grades.current_grade || en.grades.final_grade || "—"))}</strong></div>`
            : "";
          inner = summary + (rows
            ? `<table class="canvas-grade-table"><thead><tr><th>Assignment</th><th>Score</th><th>Out of</th></tr></thead><tbody>${rows}</tbody></table>`
            : `<div class="canvas-card muted">No graded assignments in this view.</div>`);
        } catch (_) {
          inner = `<div class="canvas-card muted">Grades could not be loaded.</div>`;
        }
      }
      content.innerHTML = `<div class="canvas-tab-bar">${tabBar}</div>${inner}`;
      CanvasState.pageContext = {
        view: "course",
        courseName: c.name,
        courseCode: c.course_code,
        currentTab: tab,
        overdueAssignments: ov.slice(0, 20).map((a) => ({
          name: a.name,
          dueDate: a.due_at,
          points: a.points_possible,
        })),
        upcomingAssignments: fu.slice(0, 10).map((a) => ({
          name: a.name,
          dueDate: a.due_at,
          points: a.points_possible,
          submitted: !!(a.submission && a.submission.submitted_at),
        })),
      };
      updateAICanvasContextBadge();
    },
    async assignment(params) {
      const { courseId, assignmentId } = params;
      const assignment = await CanvasAPI.getAssignment(courseId, assignmentId);
      const course = CanvasState.courses.find((x) => String(x.id) === String(courseId)) || {};
      CanvasState.currentTitle = assignment.name || "Assignment";
      if (CanvasState.history[CanvasState.historyIndex]) {
        CanvasState.history[CanvasState.historyIndex].title = CanvasState.currentTitle;
      }
      const due = assignment.due_at ? new Date(assignment.due_at) : null;
      const now = new Date();
      let dueClass = "green";
      if (due && due < now && !assignment.submission?.submitted_at) dueClass = "red";
      else if (due && due.toDateString() === now.toDateString()) dueClass = "gold";
      const descHtml = sanitizeCanvasHtml(assignment.description || "");
      let rubricHtml = "";
      const rub = assignment.rubric;
      if (rub && Array.isArray(rub.criteria)) {
        rubricHtml = `<h3 class="canvas-section-title">Rubric</h3><table class="canvas-grade-table"><tbody>${rub.criteria.map((c) => `<tr><td>${esc(c.description || "")}</td><td>${esc(String(c.points || ""))}</td></tr>`).join("")}</tbody></table>`;
      }
      const content = document.getElementById("canvasContent");
      content.innerHTML = `
        <div class="canvas-card">
          <h2 style="margin:0 0 10px">${esc(assignment.name || "")}</h2>
          <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
            <span class="canvas-due-badge ${dueClass}">Due: ${assignment.due_at ? esc(assignment.due_at.slice(0, 16).replace("T", " ")) : "—"}</span>
            <span style="font-size:.82rem;color:var(--muted2)">${assignment.points_possible != null ? esc(String(assignment.points_possible)) + " pts" : ""}</span>
            <span style="font-size:.82rem;color:var(--muted2)">${esc((assignment.submission_types || []).join(", ") || "")}</span>
          </div>
          ${assignment.submission && assignment.submission.submitted_at ? `<div class="canvas-banner ok">Submitted ✓ ${esc(assignment.submission.submitted_at || "")}${assignment.submission.grade ? " · Grade: " + esc(String(assignment.submission.grade)) : ""}</div>` : ""}
          ${assignment.submission && assignment.submission.late ? `<div class="canvas-banner bad">Late</div>` : ""}
          <div class="canvas-html-body" style="margin-top:14px">${descHtml || "<span style='color:var(--muted)'>No description.</span>"}</div>
          ${rubricHtml}
          <div style="display:flex;gap:12px;margin-top:20px;flex-wrap:wrap">
            <button type="button" style="padding:10px 18px;border-radius:12px;background:var(--accent);color:#000;font-weight:700;border:none;cursor:pointer" onclick="addCanvasAssignmentToPlanner(${Number(courseId)}, ${Number(assignmentId)})">Add to Planner</button>
            <button type="button" class="btn-sec" onclick="window.open(${JSON.stringify(assignment.html_url || "")},'_blank','noopener,noreferrer')">Open in Canvas</button>
          </div>
        </div>`;
      CanvasState.pageContext = {
        view: "assignment",
        assignmentName: assignment.name,
        courseName: course.name || course.course_code,
        dueDate: assignment.due_at,
        pointsPossible: assignment.points_possible,
        submissionType: assignment.submission_types,
        submitted: !!assignment.submission?.submitted_at,
        grade: assignment.submission?.grade,
        description: stripHtml(assignment.description || "").slice(0, 2000),
        rubric: Array.isArray(rub?.criteria)
          ? rub.criteria.map((c) => ({
            description: c.description,
            points: c.points,
            longDescription: c.long_description,
          }))
          : [],
        isOverdue: !!(due && due < now && !assignment.submission?.submitted_at),
      };
      updateAICanvasContextBadge();
    },
    async announcement(params) {
      const aid = Number(params.announcementId);
      const courseId = params.courseId;
      let an = CanvasState.announcementCache.get(aid);
      if (!an) {
        const list = await CanvasAPI.getAnnouncements([courseId]);
        an = (list || []).find((x) => Number(x.id) === aid);
      }
      if (!an) throw new Error("Announcement not found");
      const course = CanvasState.courses.find((x) => String(x.id) === String(courseId)) || {};
      CanvasState.currentTitle = an.title || "Announcement";
      if (CanvasState.history[CanvasState.historyIndex]) {
        CanvasState.history[CanvasState.historyIndex].title = CanvasState.currentTitle;
      }
      document.getElementById("canvasContent").innerHTML = `
        <div class="canvas-card">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span class="canvas-dot" style="background:${esc(courseColor(course))}"></span>
            <span style="font-weight:700">${esc(course.name || "")}</span>
          </div>
          <h2 style="margin:0 0 8px">${esc(an.title || "")}</h2>
          <div style="font-size:.78rem;color:var(--muted)">${esc(an.posted_at || "")}</div>
          <div class="canvas-html-body" style="margin-top:14px">${sanitizeCanvasHtml(an.message || "")}</div>
        </div>`;
      CanvasState.pageContext = {
        view: "announcement",
        title: an.title,
        courseName: course.name || course.course_code,
        postedAt: an.posted_at,
        fullText: stripHtml(an.message || "").slice(0, 3000),
      };
      updateAICanvasContextBadge();
    },
    async grades() {
      const enrollments = await CanvasAPI.getAllGrades();
      const list = Array.isArray(enrollments) ? enrollments : [];
      CanvasState.currentTitle = "All grades";
      if (CanvasState.history[CanvasState.historyIndex]) {
        CanvasState.history[CanvasState.historyIndex].title = "Grades";
      }
      const nums = list.map((e) => parseFloat(e.grades && e.grades.current_score)).filter((n) => !isNaN(n));
      const est = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length / 25).toFixed(2) : null;
      const cards = list.filter((e) => e.course_id).map((e) => {
        const cn = e.course && (e.course.name || e.course.course_code);
        const col = courseColor(e.course || {});
        return `<div class="canvas-card" style="border-left:3px solid ${esc(col)}">
          <div style="font-weight:700">${esc(cn || "Course")}</div>
          <div style="font-size:.85rem;margin-top:6px">Current: ${esc(String((e.grades && (e.grades.current_grade || e.grades.current_score)) || "—"))}</div>
          <button type="button" class="canvas-linkish" onclick="CanvasViews.navigate('course',{courseId:${e.course_id}, tab:'grades'})">View course grades</button>
        </div>`;
      });
      document.getElementById("canvasContent").innerHTML = `
        <div class="canvas-card" style="margin-bottom:12px">
          <strong>GPA estimate:</strong> ${est ? "~" + est + " (4.0 scale, unweighted average of Canvas scores — informational only)" : "Not enough numeric scores"}
        </div>
        ${cards.join("") || `<div class="canvas-card muted">No enrollments.</div>`}`;
      CanvasState.pageContext = {
        view: "grades",
        courses: list.map((e) => ({
          courseName: e.course && e.course.name,
          currentGrade: e.grades && e.grades.current_grade,
          currentScore: e.grades && e.grades.current_score,
          finalGrade: e.grades && e.grades.final_grade,
        })),
      };
      updateAICanvasContextBadge();
    },
    async inbox() {
      CanvasState._inboxThread = null;
      const conversations = await CanvasAPI.getInbox();
      const list = Array.isArray(conversations) ? conversations : [];
      CanvasState.currentTitle = "Inbox";
      if (CanvasState.history[CanvasState.historyIndex]) {
        CanvasState.history[CanvasState.historyIndex].title = "Inbox";
      }
      document.getElementById("canvasContent").innerHTML = `
        <div class="canvas-card muted" style="margin-bottom:10px">Tap a message to read. Replying works best in Canvas.</div>
        ${list.map((c) => {
          const unread = c.workflow_state === "unread";
          const initials = (c.participants && c.participants[0] && c.participants[0].name)
            ? c.participants[0].name.charAt(0).toUpperCase()
            : "?";
          return `<div class="canvas-inbox-row ${unread ? "unread" : ""}" onclick="fluxCanvasOpenInboxThread(${c.id})">
            <div class="canvas-inbox-av">${esc(initials)}</div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:${unread ? "800" : "600"}">${esc(c.subject || "(no subject)")}</div>
              <div style="font-size:.78rem;color:var(--muted2)">${esc((c.last_message || "").slice(0, 120))}</div>
            </div>
            <div style="font-size:.68rem;color:var(--muted)">${esc((c.last_message_at || "").slice(0, 10))}</div>
          </div>`;
        }).join("") || `<div class="canvas-card muted">No conversations.</div>`}
      `;
      CanvasState.pageContext = {
        view: "inbox",
        messageCount: list.length,
        unreadCount: list.filter((c) => c.workflow_state === "unread").length,
        recentMessages: list.slice(0, 5).map((c) => ({
          subject: c.subject,
          lastMessage: (c.last_message || "").slice(0, 200),
          participants: (c.participants || []).map((p) => p.name),
          date: c.last_message_at,
        })),
      };
      updateAICanvasContextBadge();
    },
    async calendar() {
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 21);
      const sd = start.toISOString().slice(0, 10);
      const ed = end.toISOString().slice(0, 10);
      const ev = await CanvasAPI.getCalendarEvents(sd, ed);
      const list = Array.isArray(ev) ? ev : [];
      CanvasState.currentTitle = "Calendar";
      if (CanvasState.history[CanvasState.historyIndex]) {
        CanvasState.history[CanvasState.historyIndex].title = "Calendar";
      }
      document.getElementById("canvasContent").innerHTML = `
        <div class="canvas-card muted" style="margin-bottom:10px">Assignments from Canvas calendar (${sd} → ${ed}).</div>
        ${list.map((e) => `<div class="canvas-assignment-row">
            <div><strong>${esc(e.title || "")}</strong><div style="font-size:.72rem;color:var(--muted)">${esc(e.start_at || "")}</div></div>
            ${e.html_url ? `<button type="button" class="btn-sec" onclick="window.open('${esc(e.html_url)}','_blank')">Open</button>` : ""}
          </div>`).join("") || `<div class="canvas-card muted">No events.</div>`}`;
      CanvasState.pageContext = { view: "calendar", eventCount: list.length };
      updateAICanvasContextBadge();
    },
  };

  window.fluxOpenCanvasModuleItem = function (courseId, el) {
    const type = el && el.getAttribute("data-mod-type");
    const contentId = parseInt((el && el.getAttribute("data-mod-cid")) || "", 10);
    const url = decodeURIComponent((el && el.getAttribute("data-mod-url")) || "");
    if (type === "Assignment" && contentId) {
      CanvasViews.navigate("assignment", { courseId, assignmentId: contentId });
      return;
    }
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      showToast("Opened in a new tab — quizzes and some pages only work in Canvas.", "info");
      return;
    }
    showToast("Open this item in Canvas.", "info");
  };

  window.fluxCanvasOpenExternal = function (url) {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  window.fluxCanvasOpenInboxThread = async function (id) {
    try {
      const session = await getSB().auth.getSession();
      const token = session?.data?.session?.access_token || SB_ANON;
      const res = await fetch(`${SB_URL}/functions/v1/canvas-proxy`, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          apikey: SB_ANON,
        },
        body: JSON.stringify({
          host: CanvasState.host,
          path: `/api/v1/conversations/${id}`,
          method: "GET",
          canvasToken: CanvasState.token,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const html = (data.messages || []).map((m) => `<div style="margin-bottom:10px;padding:8px;background:var(--card2);border-radius:8px"><div style="font-size:.72rem;color:var(--muted)">${esc(m.created_at || "")}</div><div>${sanitizeCanvasHtml(m.body || "")}</div></div>`).join("");
      document.getElementById("canvasContent").innerHTML = `<div class="canvas-card"><button type="button" class="btn-sec" onclick="CanvasViews.inbox({})">← Back</button>
        <h3 style="margin:12px 0">${esc(data.subject || "Thread")}</h3>${html}
        <button type="button" class="btn-sec" style="margin-top:12px" onclick="window.open('${esc(String(data.html_url || ""))}','_blank')">Reply in Canvas</button></div>`;
    } catch (e) {
      showToast(e.message || "Could not load thread", "error");
    }
  };

  function fluxCanvasAssignmentRowHtml(courseId, a, course) {
    const col = courseColor(course);
    const sub = a.submission;
    const done = !!(sub && sub.submitted_at);
    const chip = done
      ? `<span class="canvas-status-chip submitted">Submitted ✓</span>`
      : `<span class="canvas-status-chip unsubmitted">Not submitted</span>`;
    return `<div class="canvas-assignment-row" style="border-left-color:${esc(col)}">
      <button type="button" class="canvas-link-title" onclick="CanvasViews.navigate('assignment',{courseId:${courseId}, assignmentId:${a.id}})">${esc(a.name)}</button>
      <span class="canvas-due-badge gold">${esc((a.due_at || "").slice(0, 10))}</span>
      <span style="font-size:.72rem">${a.points_possible != null ? esc(String(a.points_possible)) + " pts" : ""}</span>
      ${chip}
      <button type="button" class="canvas-add-btn" data-canvas-cid="${courseId}" data-canvas-aid="${a.id}" onclick="addCanvasAssignmentToPlanner(${courseId}, ${a.id})">Add +</button>
    </div>`;
  }

  window.fluxCanvasBulkAddConfirm = function () {
    const rows = document.querySelectorAll("#canvasContent .canvas-add-btn[data-canvas-aid]");
    if (!rows.length) {
      showToast("No assignments to add", "info");
      return;
    }
    if (!confirm("Add " + rows.length + " upcoming assignments to your planner? Duplicates will be skipped.")) return;
    let added = 0;
    let skipped = 0;
    rows.forEach((btn) => {
      const cid = parseInt(btn.getAttribute("data-canvas-cid"), 10);
      const aid = parseInt(btn.getAttribute("data-canvas-aid"), 10);
      if (!cid || !aid) return;
      if (typeof canvasAssignmentTaskExists === "function" && canvasAssignmentTaskExists(cid, aid)) {
        skipped++;
        return;
      }
      added++;
      addCanvasAssignmentToPlanner(cid, aid, { silent: true, skipRender: true });
    });
    save("tasks", tasks);
    syncKey("tasks", tasks);
    renderStats();
    renderTasks();
    renderCalendar();
    renderCountdown();
    showToast("Added " + added + " assignments, skipped " + skipped + " duplicates", "success");
  };

  function ensureCanvasShell() {
    const stack = document.getElementById("canvasHubStack");
    if (!stack || CanvasState._shellReady) return;
    CanvasState._shellReady = true;
    stack.innerHTML = `
      <div class="canvas-panel-wrap" id="fluxCanvasPanelWrap">
        <div class="canvas-topbar" id="canvasTopbar">
          <div class="canvas-topbar-row canvas-topbar-nav">
            <button type="button" class="canvas-icon-btn" id="canvasNavBack" onclick="CanvasViews.back()" aria-label="Back">←</button>
            <button type="button" class="canvas-icon-btn" id="canvasNavFwd" onclick="CanvasViews.forward()" aria-label="Forward">→</button>
            <button type="button" class="canvas-icon-btn canvas-mob-sidebar-btn" onclick="fluxCanvasToggleMobileSidebar()" aria-label="Menu">☰</button>
            <div class="canvas-breadcrumb" id="canvasBreadcrumb"></div>
            <div class="canvas-topbar-actions">
              <button type="button" class="canvas-icon-btn" onclick="CanvasViews.navigate(CanvasState.currentView, CanvasState.currentParams, {noHistory:true})" title="Refresh">↻</button>
              <button type="button" class="canvas-icon-btn" onclick="fluxCanvasSyncModal()" title="Sync from Canvas">⟳</button>
              <button type="button" class="canvas-icon-btn" id="canvasSplitBtn" onclick="fluxCanvasToggleSplit()" title="Split with AI" style="display:none">⧉</button>
              <button type="button" class="canvas-icon-btn" onclick="fluxCanvasOpenInCanvas()" title="Open in Canvas">↗</button>
              <button type="button" class="canvas-ask-ai" onclick="fluxCanvasAskAI()" title="Ask Flux AI">✦ Ask AI</button>
            </div>
          </div>
        </div>
        <div class="canvas-panel-body">
          <aside class="canvas-sidebar ${CanvasState._sidebarCollapsed ? "collapsed" : ""}" id="canvasSidebar">
            <div class="canvas-sidebar-head">
              <span>Navigation</span>
              <button type="button" class="canvas-sidebar-collapse" onclick="fluxCanvasToggleSidebarCollapse()" title="Collapse">‹</button>
            </div>
            <div class="canvas-sidebar-section-title">My courses</div>
            <div id="canvasSidebarCourses"></div>
            <div class="canvas-sidebar-section-title">Quick links</div>
            <button type="button" class="canvas-course-chip" onclick="CanvasViews.navigate('dashboard',{})">Dashboard</button>
            <button type="button" class="canvas-course-chip" onclick="CanvasViews.calendar({})">Calendar</button>
            <button type="button" class="canvas-course-chip" onclick="CanvasViews.inbox({})">Inbox</button>
            <button type="button" class="canvas-course-chip" onclick="CanvasViews.grades({})">Grades</button>
          </aside>
          <div class="canvas-sidebar-backdrop" id="canvasSidebarBackdrop" onclick="fluxCanvasCloseMobileSidebar()"></div>
          <main class="canvas-content" id="canvasContent"></main>
        </div>
      </div>`;
  }

  window.fluxCanvasToggleMobileSidebar = function () {
    document.getElementById("canvasSidebar")?.classList.toggle("open");
    document.getElementById("canvasSidebarBackdrop")?.classList.toggle("open");
  };
  window.fluxCanvasCloseMobileSidebar = function () {
    document.getElementById("canvasSidebar")?.classList.remove("open");
    document.getElementById("canvasSidebarBackdrop")?.classList.remove("open");
  };

  window.fluxCanvasToggleSidebarCollapse = function () {
    CanvasState._sidebarCollapsed = !CanvasState._sidebarCollapsed;
    save("flux_canvas_sidebar_collapsed", CanvasState._sidebarCollapsed);
    document.getElementById("canvasSidebar")?.classList.toggle("collapsed", CanvasState._sidebarCollapsed);
  };

  window.fluxCanvasToggleSplit = function () {
    if (window.innerWidth < 1200) {
      showToast("Split view needs a wide screen (1200px+)", "info");
      return;
    }
    const on = !load("flux_canvas_split", false);
    save("flux_canvas_split", on);
    fluxApplyCanvasSplitLayout();
    showToast(on ? "Split view on" : "Split view off", "info");
  };

  window.fluxApplyCanvasSplitLayout = function () {
    const main = document.querySelector(".main-content");
    const on =
      load("flux_canvas_split", false) &&
      window.innerWidth >= 1200 &&
      document.getElementById("canvas")?.classList.contains("active");
    document.body.classList.toggle("flux-canvas-ai-split", !!on);
    const cv = document.getElementById("canvas");
    if (cv && !on) {
      cv.style.flex = "";
      cv.style.overflowY = "";
      cv.style.minWidth = "";
    }
    const ai = document.getElementById("ai");
    if (ai) {
      ai.classList.toggle("flux-ai-split-visible", !!on);
      if (on) {
        ai.classList.add("active");
        ai.style.display = "flex";
        if (typeof initAIChats === "function") initAIChats();
      } else {
        ai.classList.remove("flux-ai-split-visible");
        ai.style.flex = "";
        ai.style.minWidth = "";
        if (!document.querySelector('[data-tab="ai"]')?.classList.contains("active")) {
          ai.classList.remove("active");
          ai.style.display = "";
        }
      }
    }
    if (typeof syncPanelScrollLayout === "function") syncPanelScrollLayout();
  };

  window.addEventListener("resize", function () {
    fluxApplyCanvasSplitLayout();
    const splitBtn = document.getElementById("canvasSplitBtn");
    if (splitBtn) splitBtn.style.display = window.innerWidth >= 1200 ? "" : "none";
  });

  window.fluxCanvasOpenInCanvas = function () {
    const host = CanvasState.host;
    if (!host) return;
    let path = "/";
    const v = CanvasState.currentView;
    const p = CanvasState.currentParams || {};
    if (v === "assignment" && p.courseId && p.assignmentId) {
      path = `/courses/${p.courseId}/assignments/${p.assignmentId}`;
    } else if (v === "course" && p.courseId) {
      path = `/courses/${p.courseId}`;
    }
    window.open("https://" + host + path, "_blank", "noopener,noreferrer");
  };

  window.fluxCanvasAskAI = function () {
    const v = CanvasState.currentView;
    const p = CanvasState.currentParams || {};
    let pre = "";
    if (v === "assignment" && CanvasState.pageContext && CanvasState.pageContext.assignmentName) {
      const ctx = CanvasState.pageContext;
      const desc = (ctx.description || "").slice(0, 1000);
      pre = `I'm looking at the assignment '${ctx.assignmentName}' for ${ctx.courseName}, due ${ctx.dueDate || "TBD"}. Here are the instructions: ${desc}. Can you help me understand what's expected and create a study plan?`;
    } else if (CanvasState.pageContext) {
      pre = "Help me with what I'm viewing in Canvas: " + stripHtml(JSON.stringify(CanvasState.pageContext)).slice(0, 800);
    }
    if (typeof openFluxAgent === "function") {
      openFluxAgent({ prefill: pre, clearInput: false });
    } else {
      nav("ai");
    }
    fluxApplyCanvasSplitLayout();
  };

  window.fluxCanvasSyncModal = async function () {
    /* minimal: reuse hub fetch if available */
    try {
      if (typeof refreshCanvasHubFullFetch === "function") {
        await refreshCanvasHubFullFetch({ quietSuccessToast: true });
      }
    } catch (_) {}
    const missing = [];
    if (typeof fluxCanvasHubData !== "undefined" && fluxCanvasHubData && Array.isArray(fluxCanvasHubData.assignments)) {
      fluxCanvasHubData.assignments.forEach((a) => {
        if (!a.due_at) return;
        if (typeof canvasAssignmentTaskExists === "function" && !canvasAssignmentTaskExists(a.course_id, a.id)) {
          missing.push(a);
        }
      });
    }
    const ov = document.createElement("div");
    ov.id = "fluxCanvasSyncOverlay";
    ov.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:8000;display:flex;align-items:center;justify-content:center;padding:16px";
    ov.innerHTML = `<div class="canvas-card" style="max-width:420px;width:100%;max-height:80vh;overflow:auto;padding:18px">
        <div style="font-weight:800;margin-bottom:8px">Sync from Canvas</div>
        <div style="font-size:.78rem;color:var(--muted2);margin-bottom:12px">Last synced: ${esc(String(load("flux_canvas_last_sync", "—")))}</div>
        <label style="display:flex;align-items:center;gap:8px;font-size:.82rem;margin-bottom:12px">
          <input type="checkbox" id="fluxCanvasAutosyncToggle" ${load("flux_canvas_autosync", false) ? "checked" : ""}/> Auto-sync on open
        </label>
        <div id="fluxCanvasSyncList" style="margin-bottom:12px"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button type="button" class="btn-sec" onclick="this.closest('[style*=fixed]').remove()">Cancel</button>
          <button type="button" onclick="fluxCanvasSyncSelected(this)">Sync selected</button>
        </div></div>`;
    document.body.appendChild(ov);
    const list = ov.querySelector("#fluxCanvasSyncList");
    list.innerHTML = missing.slice(0, 40).map((a, i) => `<label style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
        <input type="checkbox" checked data-cid="${a.course_id}" data-aid="${a.id}"/>
        <span style="font-size:.82rem">${esc(a.name)} <span style="color:var(--muted)">· ${esc(a.due_at || "").slice(0, 10)}</span></span>
      </label>`).join("") || "<div style='color:var(--muted)'>Nothing new to sync.</div>";
    ov.querySelector("#fluxCanvasAutosyncToggle").onchange = function () {
      save("flux_canvas_autosync", !!this.checked);
    };
    ov.addEventListener("click", function (e) {
      if (e.target === ov) ov.remove();
    });
  };

  window.fluxCanvasSyncSelected = function (btn) {
    const ov = document.getElementById("fluxCanvasSyncOverlay");
    const boxes = ov.querySelectorAll("input[type=checkbox][data-aid]:checked");
    let n = 0;
    boxes.forEach((b) => {
      if (b.id === "fluxCanvasAutosyncToggle") return;
      const cid = parseInt(b.getAttribute("data-cid"), 10);
      const aid = parseInt(b.getAttribute("data-aid"), 10);
      addCanvasAssignmentToPlanner(cid, aid, { silent: true, skipRender: true });
      n++;
    });
    save("tasks", tasks);
    syncKey("tasks", tasks);
    renderStats();
    renderTasks();
    renderCalendar();
    renderCountdown();
    save("flux_canvas_last_sync", new Date().toISOString());
    showToast(n ? `Synced ${n} assignments` : "Nothing selected", "success");
    ov.remove();
  };

  async function silentCanvasSync() {
    if (!CanvasState.connected) return;
    try {
      if (typeof refreshCanvasHubFullFetch === "function") {
        await refreshCanvasHubFullFetch({ quietSuccessToast: true });
      }
      let n = 0;
      if (typeof fluxCanvasHubData !== "undefined" && fluxCanvasHubData && Array.isArray(fluxCanvasHubData.assignments)) {
        for (const a of fluxCanvasHubData.assignments) {
          if (!a.due_at) continue;
          if (typeof canvasAssignmentTaskExists === "function" && !canvasAssignmentTaskExists(a.course_id, a.id)) {
            addCanvasAssignmentToPlanner(a.course_id, a.id, { silent: true, skipRender: true });
            n++;
          }
        }
      }
      if (n) showToast(n + " new assignments added from Canvas", "success");
      save("flux_canvas_last_sync", new Date().toISOString());
      if (typeof renderStats === "function") {
        renderStats();
        renderTasks();
        renderCalendar();
        renderCountdown();
      }
    } catch (_) {}
  }

  function renderCanvasConnectScreen() {
    CanvasState._shellReady = false;
    const stack = document.getElementById("canvasHubStack");
    if (!stack) return;
    stack.innerHTML = `
      <div class="canvas-connect card" style="padding:28px;max-width:440px;margin:0 auto;text-align:center">
        <div style="width:72px;height:72px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;background:#e72429;border-radius:50%">
          <svg width="36" height="36" viewBox="0 0 40 40" aria-hidden="true"><text x="50%" y="54%" text-anchor="middle" fill="#fff" font-size="22" font-weight="800" font-family="system-ui">C</text></svg>
        </div>
        <h2 style="margin-bottom:8px">Connect Canvas LMS</h2>
        <p style="font-size:.85rem;color:var(--muted2);margin-bottom:20px;line-height:1.5">See assignments, announcements, and grades from Canvas inside Flux.</p>
        <label style="text-align:left;font-size:.72rem;color:var(--muted)">Canvas host</label>
        <input type="text" id="fluxCanvasConnectHost" placeholder="yourschool.instructure.com" style="width:100%;margin-bottom:12px">
        <label style="text-align:left;font-size:.72rem;color:var(--muted)">Access token</label>
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <input type="password" id="fluxCanvasConnectToken" placeholder="Paste token" style="flex:1;margin:0">
          <button type="button" class="btn-sec" onclick="fluxCanvasToggleConnectPw()">👁</button>
        </div>
        <details style="text-align:left;font-size:.75rem;color:var(--muted2);margin-bottom:14px">
          <summary style="cursor:pointer;color:var(--accent)">How to get a token</summary>
          <ol style="margin:8px 0 0 18px;line-height:1.55">
            <li>Log in to Canvas in a new tab</li>
            <li>Account → Settings → New Access Token</li>
            <li>Name it "Flux Planner", expiry 1 year</li>
            <li>Copy the token here</li>
          </ol>
          <p style="margin-top:8px">Tokens stay on this device only.</p>
        </details>
        <button type="button" style="width:100%;padding:12px" onclick="fluxCanvasConnectSubmit()">Connect Canvas</button>
        <div id="fluxCanvasConnectErr" style="color:var(--red);font-size:.8rem;margin-top:10px"></div>
      </div>`;
  }

  window.fluxCanvasToggleConnectPw = function () {
    const el = document.getElementById("fluxCanvasConnectToken");
    if (!el) return;
    el.type = el.type === "password" ? "text" : "password";
  };

  window.fluxCanvasConnectSubmit = async function () {
    const err = document.getElementById("fluxCanvasConnectErr");
    if (err) err.textContent = "";
    const hostRaw = document.getElementById("fluxCanvasConnectHost")?.value?.trim() || "";
    const tok = document.getElementById("fluxCanvasConnectToken")?.value?.trim() || "";
    const host = hostFromStoredUrl(hostRaw);
    if (!host || !tok) {
      if (err) err.textContent = "Host and token are required.";
      return;
    }
    CanvasState.token = tok;
    CanvasState.host = host;
    try {
      await CanvasAPI.getUserProfile();
    } catch (e) {
      CanvasState.token = null;
      CanvasState.host = null;
      if (err) err.textContent = e.message || "Connection failed";
      return;
    }
    save("flux_canvas_token", CanvasState.token);
    save("flux_canvas_host", CanvasState.host);
    save("flux_canvas_url", "https://" + CanvasState.host);
    try {
      canvasToken = CanvasState.token;
      canvasUrl = "https://" + CanvasState.host;
    } catch (_) {}
    schoolInfo = schoolInfo || {};
    schoolInfo.canvasLmsHost = CanvasState.host;
    save("flux_school", schoolInfo);
    if (typeof syncKey === "function") syncKey("school", schoolInfo);
    CanvasState.connected = true;
    CanvasState.cache.clear();
    CanvasState._shellReady = false;
    if (typeof renderSchool === "function") renderSchool();
    window.__fluxRenderCanvasPanel();
    CanvasViews.navigate("dashboard", {});
  };

  function renderCanvasSidebar() {
    const el = document.getElementById("canvasSidebarCourses");
    if (!el) return;
    el.innerHTML = (CanvasState.courses || [])
      .map(
        (c) =>
          `<button type="button" class="canvas-course-chip" onclick="CanvasViews.navigate('course',{courseId:${c.id}, tab:'overview'})">
          <span class="canvas-dot" style="background:${esc(courseColor(c))}"></span>
          <span style="flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name || c.course_code)}</span>
          <span style="font-size:.65rem;color:var(--muted);font-family:JetBrains Mono,monospace">${esc(c.course_code || "")}</span>
        </button>`,
      )
      .join("");
  }

  window.initCanvasPanel = function () {
    CanvasState.token = load("flux_canvas_token", null);
    if (typeof CanvasState.token === "string" && !CanvasState.token.trim()) {
      CanvasState.token = null;
    }
    CanvasState.host =
      load("flux_canvas_host", null) || hostFromStoredUrl(load("flux_canvas_url", ""));
    CanvasState.connected = !!(CanvasState.token && CanvasState.host);
    syncLegacyCanvasGlobals();
    if (!CanvasState.connected) {
      renderCanvasConnectScreen();
      return;
    }
    ensureCanvasShell();
    if (CanvasState.courses.length === 0) {
      CanvasAPI.getCourses()
        .then((courses) => {
          CanvasState.courses = Array.isArray(courses) ? courses : [];
          renderCanvasSidebar();
        })
        .catch((e) => console.warn("[Canvas] courses", e));
    } else {
      renderCanvasSidebar();
    }
    const lastView = load("flux_canvas_last_view", null);
    const lastParams = load("flux_canvas_last_params", {});
    if (lastView && CanvasState.history.length === 0) {
      CanvasViews.navigate(lastView, lastParams);
    } else if (CanvasState.history.length > 0) {
      CanvasViews.navigate(
        CanvasState.history[CanvasState.historyIndex].view,
        CanvasState.history[CanvasState.historyIndex].params,
        { noHistory: true },
      );
    } else {
      CanvasViews.navigate("dashboard", {});
    }
    if (load("flux_canvas_autosync", false)) {
      silentCanvasSync();
    }
    fluxApplyCanvasSplitLayout();
  };

  window.__fluxRenderCanvasPanel = function () {
    initCanvasPanel();
  };

  window.CanvasViews = CanvasViews;
  window.CanvasState = CanvasState;
  window.CanvasAPI = CanvasAPI;
  window.updateFluxCanvasAIBadge = updateAICanvasContextBadge;
})();
