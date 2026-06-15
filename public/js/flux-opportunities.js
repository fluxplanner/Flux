/**
 * flux-opportunities.js — Opportunity Agent: scholarships, programs, competitions
 * matched to the student's profile.
 *
 * Honest design note: the hard part of opportunity matching is a *maintained*
 * data source. This ships a curated seed list of well-known, broadly-eligible
 * opportunities and a transparent matcher (grade + interests/subjects + GPA),
 * each result showing WHY it matched. The seed can be overridden at runtime by
 * a remote JSON (FLUX_CONFIG.opportunities_url) so the catalog can grow without
 * an app release.
 *
 * Surfaces as an "Opportunities" card on the Extracurriculars (#goals) panel.
 * window.FluxOpportunities = { open, match, _seed }
 */
(function () {
  'use strict';

  /* ── curated seed (real, broadly-eligible; tags drive matching) ── */
  var SEED = [
    { title: 'Coca-Cola Scholars Program', org: 'Coca-Cola Foundation', type: 'Scholarship', grades: [12], gpaMin: 3.0, deadline: 'Oct', tags: ['leadership', 'service', 'all'], url: 'https://www.coca-colascholarsfoundation.org/apply/', blurb: '$20k achievement scholarship for graduating seniors.' },
    { title: 'QuestBridge National College Match', org: 'QuestBridge', type: 'Scholarship', grades: [12], gpaMin: 3.5, need: true, deadline: 'Sep', tags: ['need-based', 'all', 'leadership'], url: 'https://www.questbridge.org/', blurb: 'Full scholarships to top colleges for high-achieving, low-income students.' },
    { title: 'Regeneron Science Talent Search', org: 'Society for Science', type: 'Competition', grades: [12], deadline: 'Nov', tags: ['science', 'research', 'chemistry', 'physics', 'biology', 'math'], url: 'https://www.societyforscience.org/regeneron-sts/', blurb: 'Premier US science research competition; $250k top award.' },
    { title: 'MIT THINK Scholars', org: 'MIT', type: 'Research', grades: [9, 10, 11, 12], deadline: 'Jan', tags: ['science', 'engineering', 'research', 'cs', 'physics'], url: 'https://think.mit.edu/', blurb: 'Funding + mentorship to build your STEM research project.' },
    { title: 'MITES (MIT) Summer', org: 'MIT', type: 'Summer program', grades: [11], gpaMin: 3.5, tags: ['science', 'engineering', 'math', 'cs'], deadline: 'Feb', url: 'https://mites.mit.edu/', blurb: 'Free rigorous STEM summer program for rising seniors.' },
    { title: 'RISE — Rise for the world', org: 'Schmidt Futures', type: 'Fellowship', grades: [10, 11], deadline: 'Jan', tags: ['service', 'leadership', 'all', 'research'], url: 'https://www.risefortheworld.org/', blurb: 'Global fellowship for 15–17 year olds who help others; lifetime support.' },
    { title: 'Congressional App Challenge', org: 'US Congress', type: 'Competition', grades: [9, 10, 11, 12], deadline: 'Nov', tags: ['cs', 'coding', 'engineering'], url: 'https://www.congressionalappchallenge.us/', blurb: 'Build an app, win recognition from your representative.' },
    { title: 'Conrad Challenge', org: 'Conrad Foundation', type: 'Competition', grades: [9, 10, 11, 12], deadline: 'Nov', tags: ['engineering', 'science', 'entrepreneurship', 'cs'], url: 'https://www.conradchallenge.org/', blurb: 'Team innovation + entrepreneurship competition.' },
    { title: 'Scholastic Art & Writing Awards', org: 'Scholastic', type: 'Competition', grades: [7, 8, 9, 10, 11, 12], deadline: 'Dec', tags: ['english', 'writing', 'art', 'language-lit'], url: 'https://www.artandwriting.org/', blurb: 'The most prestigious US awards for creative teens.' },
    { title: 'John Locke Institute Essay Competition', org: 'John Locke Institute', type: 'Competition', grades: [9, 10, 11, 12], deadline: 'Jun', tags: ['english', 'history', 'economics', 'writing', 'individuals-societies'], url: 'https://www.johnlockeinstitute.com/essay-competition', blurb: 'Global essay prize across philosophy, economics, history, and more.' },
    { title: 'Breakthrough Junior Challenge', org: 'Breakthrough Prize', type: 'Competition', grades: [9, 10, 11, 12], deadline: 'Jun', tags: ['science', 'math', 'physics', 'biology', 'chemistry'], url: 'https://breakthroughjuniorchallenge.org/', blurb: 'Explain a big science/math idea in a short video; $250k prize.' },
    { title: 'Bank of America Student Leaders', org: 'Bank of America', type: 'Internship', grades: [11, 12], deadline: 'Jan', tags: ['leadership', 'service', 'economics', 'all'], url: 'https://about.bankofamerica.com/en/making-an-impact/student-leaders', blurb: 'Paid summer internship at a local nonprofit + leadership summit.' },
    { title: 'NASA High School Internships (OSTEM)', org: 'NASA', type: 'Internship', grades: [11, 12], gpaMin: 3.0, deadline: 'Feb', tags: ['science', 'engineering', 'physics', 'astronomy', 'cs'], url: 'https://intern.nasa.gov/', blurb: 'Work alongside NASA scientists and engineers.' },
    { title: 'Girls Who Code Summer Programs', org: 'Girls Who Code', type: 'Summer program', grades: [9, 10, 11, 12], deadline: 'Mar', tags: ['cs', 'coding'], url: 'https://girlswhocode.com/programs/summer-immersion-program', blurb: 'Free intro to coding + tech careers.' },
    { title: 'Pioneer Research Program', org: 'Pioneer Academics', type: 'Research', grades: [10, 11], gpaMin: 3.3, deadline: 'rolling', tags: ['research', 'all', 'science', 'humanities'], url: 'https://pioneeracademics.com/', blurb: 'Accredited online research with a college professor.' },
    { title: 'DECA Competitive Events', org: 'DECA', type: 'Competition', grades: [9, 10, 11, 12], deadline: 'varies', tags: ['economics', 'business', 'entrepreneurship', 'leadership'], url: 'https://www.deca.org/', blurb: 'Business, marketing, and finance competitions.' },
    { title: 'YoungArts', org: 'National YoungArts Foundation', type: 'Competition', grades: [10, 11, 12], deadline: 'Oct', tags: ['art', 'music', 'writing', 'arts', 'english'], url: 'https://youngarts.org/', blurb: 'National recognition + cash for artists across disciplines.' },
    { title: 'Local hospital / library volunteering', org: 'Community', type: 'Volunteer', grades: [9, 10, 11, 12], deadline: 'rolling', tags: ['service', 'biology', 'all'], url: 'https://www.volunteermatch.org/', blurb: 'Consistent service hours that strengthen any application.' },
    { title: 'USACO (USA Computing Olympiad)', org: 'USACO', type: 'Competition', grades: [9, 10, 11, 12], deadline: 'Dec–Feb', tags: ['cs', 'coding', 'math'], url: 'https://usaco.org/', blurb: 'Competitive programming ladder from Bronze to Platinum.' },
    { title: 'AMC → AIME Math Competitions', org: 'MAA', type: 'Competition', grades: [9, 10, 11, 12], deadline: 'Nov', tags: ['math'], url: 'https://maa.org/student-programs/amc/', blurb: 'The on-ramp to elite US math olympiad selection.' },
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var _catalog = SEED.slice();
  (function loadRemote() {
    try {
      var url = (window.FLUX_CONFIG && window.FLUX_CONFIG.opportunities_url) || null;
      if (!url) return;
      fetch(url, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (Array.isArray(j) && j.length) _catalog = j;
      }).catch(function () {});
    } catch (e) {}
  })();

  /* ── profile + matching ── */
  function profile() {
    var p = {};
    try { p = (typeof load === 'function' ? load('profile', {}) : {}) || {}; } catch (e) {}
    var grade = parseInt(p.grade, 10) || null;
    var tags = {};
    try {
      var subs = (typeof getSubjects === 'function' ? getSubjects() : {}) || {};
      Object.keys(subs).forEach(function (k) {
        var name = ((subs[k] && (subs[k].name || subs[k].short)) || k).toLowerCase();
        ['math', 'physics', 'chemistry', 'biology', 'cs', 'computer', 'english', 'history', 'economics', 'music', 'art', 'science'].forEach(function (t) {
          if (name.indexOf(t) >= 0) tags[t === 'computer' ? 'cs' : t] = 1;
        });
      });
    } catch (e) {}
    (p.interests || []).forEach(function (i) { tags[String(i).toLowerCase()] = 1; });
    var gpa = parseFloat(p.gpa) || null;
    return { grade: grade, tags: Object.keys(tags), gpa: gpa, need: !!p.financialNeed };
  }

  function match() {
    var pr = profile();
    return _catalog.map(function (o) {
      var reasons = [], score = 0;
      if (pr.grade && Array.isArray(o.grades)) {
        if (o.grades.indexOf(pr.grade) >= 0) { score += 3; reasons.push('open to grade ' + pr.grade); }
        else { score -= 4; }
      } else { score += 1; }
      var overlap = (o.tags || []).filter(function (t) { return pr.tags.indexOf(t) >= 0; });
      if (overlap.length) { score += overlap.length * 2; reasons.push('matches your ' + overlap.slice(0, 3).join(', ')); }
      if ((o.tags || []).indexOf('all') >= 0) { score += 1; if (!overlap.length) reasons.push('open to all interests'); }
      if (o.gpaMin && pr.gpa) {
        if (pr.gpa >= o.gpaMin) { score += 1; reasons.push('your GPA qualifies'); }
        else { score -= 3; reasons.push('needs GPA ' + o.gpaMin + '+'); }
      }
      if (o.need && pr.need) { score += 2; reasons.push('need-based support'); }
      return { o: o, score: score, reasons: reasons };
    }).filter(function (r) { return r.score > 0; })
      .sort(function (a, b) { return b.score - a.score; });
  }

  /* ── UI ── */
  var TYPE_COLOR = { Scholarship: '#34d399', Competition: '#5f8eff', 'Summer program': '#a874ff', Research: '#fbbf24', Internship: '#22d3ee', Fellowship: '#f472b6', Volunteer: '#94a3b8' };

  function open() {
    close();
    var results = match();
    var hasProfile = (profile().grade || profile().tags.length);
    var ov = document.createElement('div');
    ov.id = 'foppOverlay';
    ov.innerHTML = '<div class="fopp" role="dialog" aria-label="Opportunity matches">' +
      '<div class="fopp-head"><div class="fopp-title"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M8.5 14 7 22l5-3 5 3-1.5-8"/></svg> Opportunities for you</div>' +
        '<button class="fopp-x" id="foppClose" aria-label="Close">✕</button></div>' +
      (hasProfile ? '' : '<div class="fopp-tip">Add your grade and subjects in Profile to sharpen these matches.</div>') +
      '<div class="fopp-list">' + (results.length ? results.map(card).join('') :
        '<div class="fopp-empty">No matches yet — add your grade and subjects in Profile and check back.</div>') + '</div>' +
      '<div class="fopp-foot">Curated starter list · matches use your grade, subjects, and GPA</div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.id === 'foppClose') close(); });
    document.addEventListener('keydown', escClose);
  }
  function card(r) {
    var o = r.o, col = TYPE_COLOR[o.type] || '#5f8eff';
    return '<a class="fopp-card" href="' + esc(o.url) + '" target="_blank" rel="noopener">' +
      '<div class="fopp-card-top"><span class="fopp-type" style="color:' + col + ';background:' + col + '22">' + esc(o.type) + '</span>' +
        (o.deadline ? '<span class="fopp-dl">due ' + esc(o.deadline) + '</span>' : '') + '</div>' +
      '<div class="fopp-name">' + esc(o.title) + '</div>' +
      '<div class="fopp-org">' + esc(o.org) + '</div>' +
      '<div class="fopp-blurb">' + esc(o.blurb) + '</div>' +
      (r.reasons.length ? '<div class="fopp-why">✓ ' + r.reasons.slice(0, 3).map(esc).join(' · ') + '</div>' : '') +
      '<span class="fopp-open">Apply / learn more →</span></a>';
  }
  function escClose(e) { if (e.key === 'Escape') close(); }
  function close() { var o = document.getElementById('foppOverlay'); if (o) o.remove(); document.removeEventListener('keydown', escClose); }

  /* ── inject an Opportunities card into the Extracurriculars panel ── */
  function injectGoalsCard() {
    var panel = document.getElementById('goals');
    if (!panel || getComputedStyle(panel).display === 'none') return;
    if (document.getElementById('foppGoalsCard')) return;
    var host = panel.querySelector('.flux-stack') || panel;
    var all = match();
    var top = all.slice(0, 3);
    var card = document.createElement('div');
    card.className = 'card';
    card.id = 'foppGoalsCard';
    card.innerHTML = '<h3 style="display:flex;align-items:center;justify-content:space-between;gap:8px">Opportunities for you' +
      '<button type="button" class="btn-sec" style="padding:5px 12px;font-size:.74rem" id="foppOpenBtn">See all ' + all.length + '</button></h3>' +
      '<p class="ssub" style="margin:0 0 10px">Scholarships, programs, and competitions matched to your grade and subjects.</p>' +
      (top.length ? '<div class="fopp-mini">' + top.map(function (r) {
        return '<div class="fopp-mini-row"><span class="fopp-mini-name">' + esc(r.o.title) + '</span><span class="fopp-mini-type">' + esc(r.o.type) + '</span></div>';
      }).join('') + '</div>' : '<p class="ssub">Add your grade & subjects in Profile to see matches.</p>');
    host.appendChild(card);
    var btn = card.querySelector('#foppOpenBtn');
    if (btn) btn.addEventListener('click', open);
  }
  var _t = null;
  function schedule() { clearTimeout(_t); _t = setTimeout(injectGoalsCard, 150); }
  function boot() {
    var panel = document.getElementById('goals');
    if (panel && window.MutationObserver) {
      new MutationObserver(function () { if (panel.classList.contains('active') && !document.getElementById('foppGoalsCard')) schedule(); }).observe(panel, { childList: true, subtree: true });
    }
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.FluxOpportunities = { open: open, match: match, _seed: SEED };
})();
