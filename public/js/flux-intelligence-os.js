/**
 * flux-intelligence-os.js — Flux Intelligence: the proactive "second brain" layer.
 *
 * Not a chatbot. A set of reasoning ENGINES that read the planner's live data
 * (tasks, focus sessions, mood, calendar, subjects) and produce INSIGHTS — each
 * with a severity, plain-English evidence, a confidence score, and an optional
 * one-click action. A daily Executive Briefing composes the top signals.
 *
 * Design principles (mirrors the multi-agent spec, scaled to a client app):
 *   • Engines never silently mutate user data. Actions are user-approved clicks.
 *   • Every insight carries evidence + confidence so it's trustworthy, not magic.
 *   • Forecasts are transparent heuristics labelled "projection", not fake ML.
 *
 * Distinct from the older window.FluxIntel (dashboard next-best-task helper) —
 * this is the higher-level engine layer and reuses FluxIntel where it exists.
 *
 * Public surface (window.FluxIntelligence):
 *   analyze()             → { insights:[...], briefing:{...}, generatedAt }
 *   briefingHtml()        → HTML string for the daily briefing card
 *   openCenter()          → full Intelligence Center modal (all engines)
 *   renderDashboardCard() → injects/refreshes the briefing card on #dashboard
 */
(function () {
  'use strict';

  /* ───────── data access (defensive — globals may not be ready) ───────── */

  function G(name, fallback) {
    try { var v = window[name]; return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function tasks() { return (Array.isArray(G('tasks')) ? G('tasks') : []) || []; }
  function sessions() { return (Array.isArray(G('sessionLog')) ? G('sessionLog') : []) || []; }
  function moods() { return (Array.isArray(G('moodHistory')) ? G('moodHistory') : []) || []; }
  function events() { try { return (typeof load === 'function' ? load('flux_events', []) : []) || []; } catch (e) { return []; } }
  function subjects() { try { return (typeof getSubjects === 'function' ? getSubjects() : {}) || {}; } catch (e) { return {}; } }

  function todayISO() {
    try { if (typeof todayStr === 'function') return todayStr(); } catch (e) {}
    return new Date().toISOString().slice(0, 10);
  }
  function daysBetween(aISO, bISO) {
    var a = new Date(aISO + 'T00:00:00'), b = new Date(bISO + 'T00:00:00');
    return Math.round((b - a) / 86400000);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function subjName(t) {
    var subj = subjects()[t.subject];
    return (subj && (subj.short || subj.name)) || t.subject || 'General';
  }

  /* ───────── ENGINE 1 · Academic Command Center ───────── */

  function academicEngine() {
    var out = [];
    var today = todayISO();
    var open = tasks().filter(function (t) { return t && !t.done; });
    var overdue = open.filter(function (t) { return t.date && t.date < today; });
    var dueToday = open.filter(function (t) { return t.date === today; });

    if (overdue.length) {
      out.push({
        engine: 'Academic', severity: 'risk',
        title: overdue.length + ' overdue ' + (overdue.length === 1 ? 'task' : 'tasks'),
        detail: 'Clearing overdue work first stops the snowball.',
        evidence: overdue.slice(0, 4).map(function (t) { return esc(t.name) + ' · ' + subjName(t) + ' (due ' + t.date + ')'; }),
        confidence: 0.95,
        action: { label: 'Open oldest', fn: function () { focusTask(overdue.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0]); } },
      });
    }
    if (dueToday.length) {
      out.push({
        engine: 'Academic', severity: dueToday.length >= 4 ? 'warn' : 'info',
        title: dueToday.length + ' due today',
        detail: 'Hit the heaviest items first while energy is high.',
        evidence: dueToday.slice(0, 5).map(function (t) { return esc(t.name) + ' · ' + subjName(t); }),
        confidence: 0.9,
      });
    }

    var bySubj = {};
    open.forEach(function (t) {
      var k = subjName(t);
      bySubj[k] = bySubj[k] || { open: 0, overdue: 0, name: k };
      bySubj[k].open++;
      if (t.date && t.date < today) bySubj[k].overdue++;
    });
    var risk = Object.keys(bySubj).map(function (k) { return bySubj[k]; })
      .filter(function (s) { return s.overdue >= 2 || s.open >= 5; })
      .sort(function (a, b) { return (b.overdue * 3 + b.open) - (a.overdue * 3 + a.open); })[0];
    if (risk) {
      out.push({
        engine: 'Academic', severity: risk.overdue >= 2 ? 'risk' : 'warn',
        title: risk.name + ' needs attention',
        detail: risk.name + ' has the heaviest backlog right now.',
        evidence: [risk.open + ' open task' + (risk.open === 1 ? '' : 's'), risk.overdue + ' overdue'],
        confidence: 0.78,
      });
    }
    return out;
  }

  /* ───────── ENGINE 2 · Scheduling ───────── */

  function schedulingEngine() {
    var out = [];
    var today = todayISO();
    var open = tasks().filter(function (t) { return t && !t.done; });
    var loadToday = open.filter(function (t) { return t.date && t.date <= today; });
    var minutes = loadToday.reduce(function (s, t) { return s + (+t.estTime || 30); }, 0);
    // Capacity is calibrated per-student from their real on-time completion
    // history (flux-eval); falls back to 180 min before there's any history.
    var CAPACITY = 180;
    try { if (window.FluxEval && FluxEval.capacityMin) CAPACITY = FluxEval.capacityMin(); } catch (e) {}
    if (minutes > CAPACITY) {
      out.push({
        engine: 'Scheduling', severity: minutes > CAPACITY * 1.6 ? 'risk' : 'warn',
        title: 'Today is overbooked (~' + Math.round(minutes / 60 * 10) / 10 + 'h of work)',
        detail: 'More is due than fits in a healthy focus day — move the lowest-priority items.',
        evidence: [loadToday.length + ' tasks due/overdue', '~' + minutes + ' min estimated', 'sustainable ≈ ' + CAPACITY + ' min'],
        confidence: 0.7,
        action: { label: 'Rebalance week', fn: function () { runCommand('/optimize'); } },
      });
    }
    var todays = events().filter(function (e) { return e.date === today && e.time; })
      .sort(function (a, b) { return a.time < b.time ? -1 : 1; });
    for (var i = 1; i < todays.length; i++) {
      if (todays[i].time === todays[i - 1].time) {
        out.push({
          engine: 'Scheduling', severity: 'warn', title: 'Calendar conflict today',
          detail: 'Two events are scheduled at the same time.',
          evidence: [esc(todays[i - 1].title) + ' @ ' + todays[i - 1].time, esc(todays[i].title) + ' @ ' + todays[i].time],
          confidence: 0.85,
        });
        break;
      }
    }
    return out;
  }

  /* ───────── ENGINE 3 · Behavior ───────── */

  function behaviorEngine() {
    var out = [];
    var today = todayISO();
    var recent = moods().slice(-3);
    var lowSleep = recent.filter(function (m) { return +m.sleep && +m.sleep < 6.5; }).length;
    var highStress = recent.filter(function (m) { return +m.stress && +m.stress >= 7; }).length;
    var byDay = {};
    sessions().forEach(function (s) { if (s.date) byDay[s.date] = (byDay[s.date] || 0) + (+s.mins || 0); });
    var heavyStreak = 0;
    for (var d = 0; d < 5; d++) {
      var day = new Date(); day.setDate(day.getDate() - d);
      var iso = day.toISOString().slice(0, 10);
      if ((byDay[iso] || 0) >= 150) heavyStreak++; else break;
    }
    if (heavyStreak >= 3 || lowSleep >= 2 || highStress >= 2) {
      var ev = [];
      if (heavyStreak >= 3) ev.push(heavyStreak + ' straight heavy study days');
      if (lowSleep >= 2) ev.push('sleep under 6.5h on ' + lowSleep + ' recent check-ins');
      if (highStress >= 2) ev.push('stress 7+/10 on ' + highStress + ' recent check-ins');
      out.push({
        engine: 'Behavior', severity: 'risk', title: 'Burnout risk is elevated',
        detail: 'Protect one lighter block today — recovery now prevents a crash later.',
        evidence: ev, confidence: 0.72,
      });
    }
    var open = tasks().filter(function (t) { return t && !t.done; }).length;
    var doneToday = tasks().filter(function (t) {
      try { return t.done && t.completedAt && new Date(t.completedAt).toISOString().slice(0, 10) === today; }
      catch (e) { return false; }
    }).length;
    if (open >= 8 && doneToday === 0) {
      out.push({
        engine: 'Behavior', severity: 'warn', title: 'Lots planned, nothing finished yet today',
        detail: 'Pick one small task and start a 25-minute focus block to break the stall.',
        evidence: [open + ' open tasks', '0 completed today'],
        confidence: 0.6,
        action: { label: 'Start focus timer', fn: function () { try { if (typeof nav === 'function') nav('timer'); } catch (e) {} } },
      });
    }
    return out;
  }

  /* ───────── ENGINE 4 · Prediction (transparent projections) ───────── */

  function predictionEngine() {
    var out = [];
    var today = todayISO();
    var estBySubj = {}, actBySubj = {};
    tasks().forEach(function (t) { if (t.subject) estBySubj[t.subject] = (estBySubj[t.subject] || 0) + (+t.estTime || 0); });
    sessions().forEach(function (s) { if (s.subject) actBySubj[s.subject] = (actBySubj[s.subject] || 0) + (+s.mins || 0); });
    Object.keys(actBySubj).forEach(function (k) {
      var est = estBySubj[k], act = actBySubj[k];
      if (est && act && est > 60 && act > 60) {
        var ratio = act / est;
        if (ratio >= 1.3) {
          var pct = Math.round((ratio - 1) * 100);
          var label = (subjects()[k] && (subjects()[k].short || subjects()[k].name)) || k;
          out.push({
            engine: 'Prediction', severity: 'info',
            title: label + ': you underestimate by ~' + pct + '%',
            detail: 'Pad future ' + label + ' estimates so plans stay realistic.',
            evidence: ['estimated ' + est + ' min', 'actually spent ' + act + ' min'],
            confidence: Math.min(0.8, 0.4 + act / 1200),
          });
        }
      }
    });
    var open = tasks().filter(function (t) { return t && !t.done && t.date; });
    var next7 = open.filter(function (t) { return t.date >= today && daysBetween(today, t.date) <= 7; });
    var mins = next7.reduce(function (s, t) { return s + (+t.estTime || 30); }, 0);
    if (next7.length) {
      var heavy = mins > 900;
      out.push({
        engine: 'Prediction', severity: heavy ? 'warn' : 'info',
        title: 'Next 7 days: ~' + Math.round(mins / 60) + 'h of work projected',
        detail: heavy ? 'Front-load the early days so the back half stays open.' : 'Workload looks manageable if you pace it.',
        evidence: [next7.length + ' tasks scheduled', 'busiest: ' + busiestDay(next7)],
        confidence: 0.65,
      });
    }
    return out;
  }

  function busiestDay(list) {
    var by = {};
    list.forEach(function (t) { by[t.date] = (by[t.date] || 0) + (+t.estTime || 30); });
    var best = null;
    Object.keys(by).forEach(function (d) { if (!best || by[d] > by[best]) best = d; });
    return best ? best + ' (~' + Math.round(by[best] / 60 * 10) / 10 + 'h)' : '—';
  }

  /* ───────── actions ───────── */

  function focusTask(t) {
    if (!t) return;
    try {
      if (typeof nav === 'function') nav('dashboard');
      if (typeof showToast === 'function') showToast('Next up: ' + (t.name || 'task'), 'info');
    } catch (e) {}
  }
  function runCommand(cmd) {
    try {
      if (typeof nav === 'function') nav('ai');
      setTimeout(function () {
        var inp = document.getElementById('aiInput');
        if (inp) { inp.value = cmd; inp.focus(); }
        if (typeof sendAI === 'function') sendAI();
      }, 350);
    } catch (e) {}
  }

  /* ───────── orchestration ───────── */

  var SEV_RANK = { risk: 3, warn: 2, info: 1 };

  function analyze() {
    var insights = [];
    [academicEngine, schedulingEngine, behaviorEngine, predictionEngine].forEach(function (fn) {
      try { insights = insights.concat(fn() || []); } catch (e) {}
    });
    insights.sort(function (a, b) {
      return (SEV_RANK[b.severity] - SEV_RANK[a.severity]) || (b.confidence - a.confidence);
    });

    var today = todayISO();
    var open = tasks().filter(function (t) { return t && !t.done; });
    var topTask = null;
    try { if (window.FluxIntel && typeof FluxIntel.pickNextBestTask === 'function') topTask = FluxIntel.pickNextBestTask(); } catch (e) {}
    if (!topTask) {
      topTask = open.filter(function (t) { return t.date && t.date <= today; })
        .sort(function (a, b) { return prioRank(b) - prioRank(a) || ((a.date || '9') < (b.date || '9') ? -1 : 1); })[0]
        || open.slice().sort(function (a, b) { return (a.date || '9') < (b.date || '9') ? -1 : 1; })[0] || null;
    }
    var deadlines = open.filter(function (t) { return t.date && t.date >= today; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; }).slice(0, 5);
    var burnout = insights.filter(function (i) { return /burnout/i.test(i.title); })[0];
    var topRisk = insights.filter(function (i) { return i.severity === 'risk'; })[0] || insights[0] || null;

    return {
      generatedAt: new Date().toISOString(),
      insights: insights,
      briefing: { topTask: topTask, topRisk: topRisk, deadlines: deadlines, burnout: burnout ? 'Elevated' : 'Healthy', engineCount: 4 },
    };
  }
  function prioRank(t) { return { high: 3, med: 2, low: 1 }[(t.priority || 'med').toLowerCase()] || 2; }

  /* ───────── UI ───────── */

  var SEV_ICON = {
    risk: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
    warn: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
  };

  function fmtDate(iso) {
    try { return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
    catch (e) { return iso; }
  }

  // Flux's own track record, once there's enough resolved history to be honest.
  function accuracyFoot() {
    try {
      var a = window.FluxEval && FluxEval.accuracy && FluxEval.accuracy();
      if (a && a.n >= 5) return ' · planning accuracy ' + a.pct + '% (n=' + a.n + ')';
    } catch (e) {}
    return '';
  }

  function briefingHtml() {
    var a = analyze();
    var b = a.briefing;
    var top = b.topTask
      ? '<div class="fi-brief-task"><span class="fi-brief-label">Start with</span><span class="fi-brief-task-name">' + esc(b.topTask.name) + '</span><span class="fi-brief-task-meta">' + esc(subjName(b.topTask)) + (b.topTask.date ? ' · ' + fmtDate(b.topTask.date) : '') + '</span></div>'
      : '<div class="fi-brief-task"><span class="fi-brief-task-name">You\'re all caught up ✓</span></div>';
    var riskLine = b.topRisk
      ? '<div class="fi-brief-risk fi-sev-' + b.topRisk.severity + '">' + (SEV_ICON[b.topRisk.severity] || '') + '<span>' + esc(b.topRisk.title) + '</span></div>'
      : '';
    var dl = b.deadlines.length
      ? '<div class="fi-brief-dl">' + b.deadlines.map(function (t) {
          return '<div class="fi-dl-row"><span class="fi-dl-name">' + esc(t.name) + '</span><span class="fi-dl-date">' + fmtDate(t.date) + '</span></div>';
        }).join('') + '</div>'
      : '';
    return '<div class="fi-brief">' +
      '<div class="fi-brief-head">' +
        '<div class="fi-brief-title"><span class="fi-spark">✦</span> Flux Intelligence</div>' +
        '<button type="button" class="fi-brief-more" data-fi-open>Full briefing →</button>' +
      '</div>' +
      top + riskLine + dl +
      '<div class="fi-brief-foot">Burnout: <b class="fi-' + (b.burnout === 'Healthy' ? 'ok' : 'bad') + '">' + b.burnout + '</b> · ' + a.insights.length + ' signals from ' + b.engineCount + ' engines' + accuracyFoot() + '</div>' +
      '</div>';
  }

  function openCenter() {
    var a = analyze();
    closeCenter();
    var ov = document.createElement('div');
    ov.id = 'fiOverlay';
    ov.innerHTML = '<div class="fi-center" role="dialog" aria-label="Flux Intelligence Center">' +
      '<div class="fi-center-head"><div class="fi-brief-title"><span class="fi-spark">✦</span> Flux Intelligence</div>' +
      '<button class="fi-x" id="fiClose" aria-label="Close">✕</button></div>' +
      '<div class="fi-center-sub">Your engines reviewed tasks, focus sessions, mood, and calendar. Every signal shows its evidence and confidence.</div>' +
      '<div class="fi-insights">' + (a.insights.length ? a.insights.map(insightCard).join('') :
        '<div class="fi-empty">No signals right now — add some tasks and focus sessions and Flux will start spotting patterns.</div>') + '</div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.id === 'fiClose') return closeCenter();
      var act = e.target.closest('[data-fi-act]');
      if (act) {
        var idx = +act.getAttribute('data-fi-act');
        var ins = a.insights[idx];
        if (ins && ins.action && typeof ins.action.fn === 'function') { closeCenter(); ins.action.fn(); }
      }
    });
    document.addEventListener('keydown', escClose);
  }
  function insightCard(ins, idx) {
    var conf = Math.round((ins.confidence || 0) * 100);
    return '<div class="fi-card fi-sev-' + ins.severity + '">' +
      '<div class="fi-card-top">' + (SEV_ICON[ins.severity] || '') +
        '<span class="fi-card-title">' + esc(ins.title) + '</span>' +
        '<span class="fi-card-engine">' + esc(ins.engine) + '</span></div>' +
      '<div class="fi-card-detail">' + esc(ins.detail) + '</div>' +
      (ins.evidence && ins.evidence.length ? '<ul class="fi-card-ev">' + ins.evidence.map(function (e) { return '<li>' + e + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="fi-card-foot"><span class="fi-conf">Confidence ' + conf + '%</span>' +
      (ins.action ? '<button type="button" class="fi-card-act" data-fi-act="' + idx + '">' + esc(ins.action.label) + '</button>' : '') +
      '</div></div>';
  }
  function escClose(e) { if (e.key === 'Escape') closeCenter(); }
  function closeCenter() { var o = document.getElementById('fiOverlay'); if (o) o.remove(); document.removeEventListener('keydown', escClose); }

  /* ───────── dashboard injection ───────── */

  function dashCard() {
    var dash = document.getElementById('dashboard');
    if (!dash || dash.classList.contains('flux-edu-panel')) return; // students only
    if (getComputedStyle(dash).display === 'none') return;
    var host = dash.querySelector('.flux-stack') || dash;
    var existing = document.getElementById('fiDashCard');
    var html = '<div class="card" id="fiDashCard">' + briefingHtml() + '</div>';
    if (existing) { existing.outerHTML = html; }
    else {
      var tmp = document.createElement('div'); tmp.innerHTML = html;
      host.insertBefore(tmp.firstChild, host.firstChild);
    }
    var card = document.getElementById('fiDashCard');
    var moreBtn = card && card.querySelector('[data-fi-open]');
    if (moreBtn) moreBtn.addEventListener('click', openCenter);
    // Eval loop: record today's expected-to-finish tasks so accuracy can be
    // measured (and capacity recalibrated) once the day is past.
    try { if (window.FluxEval && FluxEval.recordDaily) FluxEval.recordDaily(); } catch (e) {}
    // Data is loaded by the time the card renders — safe to consider the
    // once-a-day proactive notification here.
    maybeNotifyDaily();
  }

  var _t = null;
  function scheduleCard() { clearTimeout(_t); _t = setTimeout(dashCard, 120); }

  /* ───────── once-a-day proactive briefing notification ─────────
   * Makes Flux reach OUT instead of waiting to be opened. Shows one banner
   * per calendar day with the headline signal + a button into the Center.
   * (A deployed daily-briefing Edge Function can pre-compute server-side and
   * drop a row the client reads; this client path is the always-on fallback.) */
  function lastBriefDate() { try { return typeof load === 'function' ? load('flux_last_briefing_date', '') : ''; } catch (e) { return ''; } }
  function markBriefed(d) { try { if (typeof save === 'function') save('flux_last_briefing_date', d); } catch (e) {} }

  function maybeNotifyDaily() {
    var today = todayISO();
    if (lastBriefDate() === today) return;
    var dash = document.getElementById('dashboard');
    if (!dash || dash.classList.contains('flux-edu-panel')) return; // students only
    var a;
    try { a = analyze(); } catch (e) { return; }
    if (!a.insights.length && !a.briefing.topTask) return; // nothing worth surfacing yet
    markBriefed(today);
    var head = a.briefing.topRisk ? a.briefing.topRisk.title
      : (a.briefing.topTask ? 'Start with ' + a.briefing.topTask.name : 'You\'re on track');
    var ban = document.createElement('div');
    ban.className = 'fi-daily-banner';
    ban.innerHTML =
      '<span class="fi-daily-spark">✦</span>' +
      '<div class="fi-daily-text"><b>Your daily briefing is ready</b><span>' + esc(head) +
        ' · ' + a.insights.length + ' signal' + (a.insights.length === 1 ? '' : 's') + '</span></div>' +
      '<button type="button" class="fi-daily-open">Open</button>' +
      '<button type="button" class="fi-daily-x" aria-label="Dismiss">✕</button>';
    document.body.appendChild(ban);
    requestAnimationFrame(function () { ban.classList.add('show'); });
    var close = function () { ban.classList.remove('show'); setTimeout(function () { ban.remove(); }, 280); };
    ban.querySelector('.fi-daily-open').addEventListener('click', function () { close(); openCenter(); });
    ban.querySelector('.fi-daily-x').addEventListener('click', close);
    setTimeout(function () { if (document.body.contains(ban)) close(); }, 12000);
    // If the overnight server briefing has been computed, prefer its headline.
    fetchServerBriefing().then(function (sb) {
      if (sb && sb.headline && document.body.contains(ban)) {
        var t = ban.querySelector('.fi-daily-text span');
        if (t) t.textContent = sb.headline + (sb.signals && sb.signals.length ? ' · ' + sb.signals.length + ' signal' + (sb.signals.length === 1 ? '' : 's') : '');
      }
    });
  }

  /** Best-effort read of today's server-computed briefing row (optional). */
  function fetchServerBriefing() {
    try {
      var client = typeof getSB === 'function' ? getSB() : null;
      var uid = (window.currentUser && window.currentUser.id) || null;
      if (!client || !uid) return Promise.resolve(null);
      return client.from('flux_daily_briefings').select('payload').eq('user_id', uid).eq('brief_date', todayISO()).maybeSingle()
        .then(function (r) { return r && r.data ? r.data.payload : null; })
        .catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }

  function boot() {
    // Dashboard Flux Intelligence surface removed per product decision — no
    // briefing card injection and no daily banner. The window.FluxIntelligence
    // API below stays exported so anything that calls it directly still works,
    // but nothing auto-renders onto the dashboard anymore.
    try {
      var existing = document.getElementById('fiDashCard');
      if (existing) existing.remove();
    } catch (e) {}
  }

  window.FluxIntelligence = {
    analyze: analyze, briefingHtml: briefingHtml, openCenter: openCenter, renderDashboardCard: dashCard,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
