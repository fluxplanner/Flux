/**
 * C4 — Grade GPS (flag enable_grade_gps).
 *
 * Elevates the what-if math into a per-class "grade GPS" card in the School
 * panel: a trajectory sparkline (daily snapshots of Canvas current_score +
 * manual entries), user-editable category weights (typed in, or extracted
 * from a syllabus photo through the existing vision pipeline with a
 * review/confirm screen), and a "Protect my A" plan that proposes study
 * blocks through A4's proposal card (FluxAgentLoop.proposeChanges).
 *
 * Weighted GPA correctness rides A1: fluxClassLevel(c) +
 * fluxCourseWeightBoost(level) (+1.0 AP/IB, +0.5 Honors).
 *
 * Store: flux_grade_gps_v1 (registered in FluxStorageKeys)
 *   { byClass: { [classId]: { history:[{date,score}], weights:[{name,weight}], target } } }
 */
(function () {
  'use strict';
  if (window.FluxGradeGPS) return;

  const FLAG = 'enable_grade_gps';
  const KEY = 'flux_grade_gps_v1';

  function enabled() {
    try { return !!window.FluxFeatureFlags?.isEnabled(FLAG, false); } catch (_) { return false; }
  }
  function ls(k, d) { return typeof window.load === 'function' ? window.load(k, d) : d; }
  function lsSave(k, v) { if (typeof window.save === 'function') window.save(k, v); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function todayISO() { return typeof todayStr === 'function' ? todayStr() : new Date().toISOString().slice(0, 10); }

  function store() {
    const s = ls(KEY, null);
    return s && typeof s === 'object' && s.byClass ? s : { byClass: {} };
  }
  function classEntry(id) {
    const s = store();
    return s.byClass[id] || { history: [], weights: [], target: null };
  }
  function saveEntry(id, entry) {
    const s = store();
    s.byClass[id] = entry;
    lsSave(KEY, s);
  }

  /* ── pure math (unit-tested via extraction) ── */

  /** Unweighted 4.0-scale points for a 0-100 score. */
  function gradeToGpa(score) {
    // Missing ≠ zero: null/''/undefined mean "no grade yet", not an F.
    if (score == null || score === '') return null;
    const s = Number(score);
    if (!Number.isFinite(s)) return null;
    if (s >= 93) return 4.0;
    if (s >= 90) return 3.7;
    if (s >= 87) return 3.3;
    if (s >= 83) return 3.0;
    if (s >= 80) return 2.7;
    if (s >= 77) return 2.3;
    if (s >= 73) return 2.0;
    if (s >= 70) return 1.7;
    if (s >= 67) return 1.3;
    if (s >= 65) return 1.0;
    return 0.0;
  }

  /** Inline sparkline SVG for [{date,score}] history (last 20 points). */
  function sparklineSvg(history, w, h) {
    const pts = (history || []).slice(-20).map((p) => Number(p.score)).filter(Number.isFinite);
    if (pts.length < 2) return '';
    const W = w || 120, H = h || 28;
    const min = Math.min(...pts), max = Math.max(...pts);
    const span = Math.max(max - min, 1);
    const step = W / (pts.length - 1);
    const path = pts.map((v, i) =>
      `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${(H - 3 - ((v - min) / span) * (H - 6)).toFixed(1)}`).join(' ');
    const up = pts[pts.length - 1] >= pts[0];
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><path d="${path}" fill="none" stroke="${up ? 'var(--green)' : 'var(--gold)'}" stroke-width="2" stroke-linecap="round"/></svg>`;
  }

  /**
   * Study-block plan for "Protect my A": given the next graded task for the
   * class and the category weight it carries, spread blocks across open
   * days before it. Pure: caller supplies openDays (already rest-day aware).
   */
  function planBlocks(taskName, dueDate, weightPct, openDays) {
    const n = weightPct >= 20 ? 3 : weightPct >= 10 ? 2 : 1;
    const days = (openDays || []).slice(-n);
    return days.map((d, i) => ({
      name: `Study block ${i + 1}/${days.length}: ${taskName}`,
      date: d,
      priority: 'med',
      type: 'hw',
      estTime: 45,
      notes: `Grade GPS: ${taskName} carries ~${weightPct}% of this class.`,
    }));
  }

  /* ── history recorder (one point per day per class) ── */

  function recordSnapshots() {
    if (!enabled()) return 0;
    const scores = (window.fluxCanvasHubData && window.fluxCanvasHubData.courseScores) || {};
    const cls = window.classes || [];
    const today = todayISO();
    let n = 0;
    cls.forEach((c) => {
      if (!c.canvasCourseId) return;
      const sc = scores[c.canvasCourseId];
      const val = sc && (sc.current_score ?? sc.final_score);
      if (val == null || !Number.isFinite(Number(val))) return;
      const e = classEntry(c.id);
      if (e.history.some((p) => p.date === today)) return;
      e.history.push({ date: today, score: Number(val) });
      if (e.history.length > 120) e.history = e.history.slice(-120);
      saveEntry(c.id, e);
      n++;
    });
    return n;
  }

  function addManualGrade(classId, score) {
    const s = Number(score);
    if (!Number.isFinite(s) || s < 0 || s > 120) return false;
    const e = classEntry(classId);
    e.history = e.history.filter((p) => p.date !== todayISO());
    e.history.push({ date: todayISO(), score: s });
    saveEntry(classId, e);
    return true;
  }

  /* ── syllabus photo → weights (existing vision pipeline) ── */

  async function scanSyllabus(classId, file) {
    if (typeof callGemini !== 'function' || typeof fileToBase64 !== 'function') {
      return { ok: false, error: 'vision pipeline unavailable' };
    }
    try {
      const b64 = await fileToBase64(file);
      const txt = await callGemini(b64, file.type || 'image/jpeg',
        'This is a class syllabus. Extract the grading category weights. Return ONLY a JSON array, no markdown: [{"name":"Tests","weight":40},{"name":"Quizzes","weight":20}]. Weights are percentages summing to about 100.');
      const start = txt.indexOf('['); const end = txt.lastIndexOf(']');
      if (start === -1 || end === -1) return { ok: false, error: 'no weights found — try a clearer photo' };
      const parsed = JSON.parse(txt.slice(start, end + 1));
      const weights = (Array.isArray(parsed) ? parsed : [])
        .map((w) => ({ name: String(w.name || '').slice(0, 60), weight: Number(w.weight) || 0 }))
        .filter((w) => w.name && w.weight > 0);
      if (!weights.length) return { ok: false, error: 'no weights found' };
      return { ok: true, weights };
    } catch (e) {
      return { ok: false, error: String(e && e.message || e) };
    }
  }

  /* ── "Protect my A" via A4's proposal card ── */

  function protectTarget(classId) {
    const c = (window.classes || []).find((x) => x.id === classId);
    if (!c) return false;
    const e = classEntry(classId);
    const subjKey = 'CLS' + classId;
    const graded = (window.tasks || [])
      .filter((t) => !t.done && t.date && (t.subject === subjKey) && ['test', 'quiz', 'project', 'essay'].includes(t.type))
      .sort((a, b) => a.date.localeCompare(b.date));
    const nextGraded = graded[0];
    if (!nextGraded) {
      showToast?.('No upcoming graded work found for ' + c.name + ' — add the test/quiz first.', 'info', 6000);
      return false;
    }
    const w = (e.weights.find((x) => new RegExp(nextGraded.type, 'i').test(x.name)) || e.weights[0]);
    const weightPct = w ? w.weight : 15;
    // Open (non-rest) days strictly before the due date.
    const open = [];
    const d = new Date();
    for (let i = 0; i < 28 && open.length < 6; i++) {
      const s = (typeof fluxLocalYMD === 'function') ? fluxLocalYMD(d) : d.toISOString().slice(0, 10);
      if (s >= nextGraded.date) break;
      const dow = d.getDay();
      let rest = false;
      try { rest = typeof isBreak === 'function' && isBreak(s); } catch (_) {}
      if (dow !== 0 && dow !== 6 && !rest) open.push(s);
      d.setDate(d.getDate() + 1);
    }
    const blocks = planBlocks(nextGraded.name, nextGraded.date, weightPct, open);
    if (!blocks.length) {
      showToast?.('No open days left before ' + nextGraded.name + '.', 'info');
      return false;
    }
    const calls = blocks.map((b) => ({ name: 'addTask', args: { ...b, subject: subjKey } }));
    // Open the AI panel FIRST so its chat surface initializes — the proposal
    // card renders into #aiMsgs and must be visible when it lands.
    try { nav('ai'); } catch (_) {}
    setTimeout(() => {
      const proposed = window.FluxAgentLoop?.proposeChanges?.(calls);
      if (proposed) {
        try { window.FluxTelemetry?.track?.('grade_gps_plan_proposed', {}); } catch (_) {}
        showToast?.(`${nextGraded.name} is ~${weightPct}% of ${c.name}: ${blocks.length} study block${blocks.length === 1 ? '' : 's'} proposed — review before applying.`, 'info', 7000);
      }
    }, 350);
    return true;
  }

  /* ── School-panel card ── */

  function gradeLabel(score) {
    if (score == null) return '—';
    return (Math.round(score * 10) / 10) + '%';
  }

  function renderCards() {
    if (!enabled()) { document.getElementById('fluxGradeGps')?.remove(); return; }
    const panel = document.getElementById('school');
    if (!panel) return;
    let host = document.getElementById('fluxGradeGps');
    if (!host) {
      host = document.createElement('div');
      host.id = 'fluxGradeGps';
      host.className = 'card';
      host.style.cssText = 'margin-top:14px;padding:16px';
      panel.appendChild(host);
    }
    const cls = (window.classes || []).filter((c) => c.name);
    if (!cls.length) { host.innerHTML = ''; return; }
    host.innerHTML = `<div style="font-weight:800;margin-bottom:2px">Grade GPS</div>
      <div style="font-size:.74rem;color:var(--muted2);margin-bottom:12px">Trajectory, category weights, and a plan to protect your target.</div>
      ${cls.map((c) => {
        const e = classEntry(c.id);
        const latest = e.history.length ? e.history[e.history.length - 1].score : null;
        const level = (typeof fluxClassLevel === 'function') ? fluxClassLevel(c) : (c.level || '');
        const boost = (typeof fluxCourseWeightBoost === 'function') ? fluxCourseWeightBoost(level) : 0;
        const gpa = gradeToGpa(latest);
        const wgpa = gpa == null ? null : Math.min(5, gpa + boost);
        return `<div class="fgg-row" data-class-id="${c.id}" style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--border)">
          <div style="flex:1;min-width:150px">
            <div style="font-weight:700;font-size:.86rem">${esc(c.name)}${level ? ` <span style="font-size:.6rem;padding:1px 6px;border-radius:6px;background:rgba(var(--accent-rgb),.12);color:var(--accent);font-weight:800">${esc(level)}</span>` : ''}</div>
            <div style="font-size:.7rem;color:var(--muted2)">${gradeLabel(latest)}${wgpa != null ? ` · weighted GPA ${wgpa.toFixed(1)}` : ''}${e.weights.length ? ` · ${e.weights.length} categories` : ''}</div>
          </div>
          <div>${sparklineSvg(e.history) || '<span style="font-size:.68rem;color:var(--muted)">no history yet</span>'}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <input type="number" min="0" max="120" step="0.1" placeholder="grade %" data-fgg-grade style="width:74px;padding:4px 6px;font-size:.74rem">
            <button type="button" class="btn-sec" data-fgg-act="record" style="padding:4px 10px;font-size:.72rem">Record</button>
            <button type="button" class="btn-sec" data-fgg-act="weights" style="padding:4px 10px;font-size:.72rem">Weights</button>
            <button type="button" data-fgg-act="protect" style="padding:4px 10px;font-size:.72rem">Protect my ${latest != null && latest >= 90 ? 'A' : 'grade'}</button>
          </div>
          <div data-fgg-weights hidden style="width:100%"></div>
        </div>`;
      }).join('')}`;
    host.querySelectorAll('[data-fgg-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.fgg-row');
        const id = Number(row.dataset.classId);
        const act = btn.dataset.fggAct;
        if (act === 'record') {
          const v = row.querySelector('[data-fgg-grade]').value;
          if (addManualGrade(id, v)) { showToast?.('Grade recorded', 'success'); renderCards(); }
          else showToast?.('Enter a grade between 0 and 120', 'warning');
        } else if (act === 'protect') {
          protectTarget(id);
        } else if (act === 'weights') {
          toggleWeightsEditor(row, id);
        }
      });
    });
  }

  function toggleWeightsEditor(row, classId) {
    const box = row.querySelector('[data-fgg-weights]');
    if (!box.hidden) { box.hidden = true; return; }
    const e = classEntry(classId);
    const rows = (e.weights.length ? e.weights : [{ name: '', weight: '' }])
      .map((w) => `<div style="display:flex;gap:6px;margin-top:6px"><input data-w-name value="${esc(w.name)}" placeholder="Category" style="flex:2;padding:4px 6px;font-size:.74rem"><input data-w-pct type="number" value="${esc(w.weight)}" placeholder="%" style="width:64px;padding:4px 6px;font-size:.74rem"></div>`)
      .join('');
    box.innerHTML = `${rows}
      <div style="display:flex;gap:6px;margin-top:8px;align-items:center">
        <button type="button" class="btn-sec" data-w-add style="padding:3px 9px;font-size:.7rem">+ Row</button>
        <label class="btn-sec" style="padding:3px 9px;font-size:.7rem;cursor:pointer">Scan syllabus photo<input type="file" accept="image/*" data-w-scan hidden></label>
        <button type="button" data-w-save style="padding:3px 12px;font-size:.7rem">Save weights</button>
        <span data-w-status style="font-size:.68rem;color:var(--muted)"></span>
      </div>`;
    box.hidden = false;
    box.querySelector('[data-w-add]').addEventListener('click', () => {
      box.firstElementChild.insertAdjacentHTML('beforebegin', `<div style="display:flex;gap:6px;margin-top:6px"><input data-w-name placeholder="Category" style="flex:2;padding:4px 6px;font-size:.74rem"><input data-w-pct type="number" placeholder="%" style="width:64px;padding:4px 6px;font-size:.74rem"></div>`);
    });
    box.querySelector('[data-w-save]').addEventListener('click', () => {
      const weights = [...box.querySelectorAll('[data-w-name]')].map((inp, i) => ({
        name: inp.value.trim(),
        weight: Number(box.querySelectorAll('[data-w-pct]')[i]?.value) || 0,
      })).filter((w) => w.name && w.weight > 0);
      const e2 = classEntry(classId);
      e2.weights = weights;
      saveEntry(classId, e2);
      showToast?.('Weights saved', 'success');
      renderCards();
    });
    box.querySelector('[data-w-scan]').addEventListener('change', async (ev) => {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      const st = box.querySelector('[data-w-status]');
      st.textContent = 'Reading syllabus…';
      const r = await scanSyllabus(classId, file);
      if (!r.ok) { st.textContent = r.error; return; }
      // Review/confirm: extracted weights land in the editable rows — the
      // user inspects, edits freely, and Save confirms.
      const e2 = classEntry(classId);
      e2.weights = r.weights;
      saveEntry(classId, e2);
      renderCards();
      const again = document.querySelector(`.fgg-row[data-class-id="${classId}"]`);
      if (again) toggleWeightsEditor(again, classId);
    });
  }

  function boot() {
    document.addEventListener('flux-nav', (e) => {
      if (e?.detail?.panel === 'school' && enabled()) {
        setTimeout(() => { recordSnapshots(); renderCards(); }, 300);
      }
    });
    setTimeout(() => { if (enabled()) recordSnapshots(); }, 3000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.FluxGradeGPS = {
    FLAG, enabled, gradeToGpa, sparklineSvg, planBlocks,
    recordSnapshots, addManualGrade, scanSyllabus, protectTarget, renderCards,
    _key: KEY,
  };
})();
