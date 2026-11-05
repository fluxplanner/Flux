/* ============================================================================
   FLUX  ·  flux-app-visibility.js
   Hides the apps the owner has hidden (table flux_hidden_apps, changed from
   Owner Command Center → Hide apps) from everyone but the owner.

   Loaded as a plain blocking script at the top of <head> on every page that
   can link to an app, before anything can paint. It depends on nothing,
   because most Flux apps run signed out with no Supabase library.

   THREE JOBS
   - Links and copy: one <style> hides every link to a hidden app and anything
     tagged data-flux-app="<id>". CSS also covers whatever the planner draws
     later, with nothing to re-run.
   - Direct URLs: a page that declares data-app="<id>" on this script tag goes
     to Flux Suite instead of opening while that app is hidden.
   - The directory: flux-hub.js and suite.html ask isHidden().

   WHAT THIS CANNOT DO
   GitHub Pages serves every file to anyone, so this hides an app from people
   using the site. It does not conceal the files, and someone determined can
   switch this script off in their own browser. The database enforces who may
   CHANGE the list, not who can fetch a page.

   IT FAILS OPEN
   If the list cannot be fetched and this device has never seen it, the page
   opens. A school network blocking Supabase must not take every Flux app down.

   ONE DELIBERATE EXCEPTION
   A device with Synara medicines or seizures saved on it keeps Synara. That
   person already uses it, so there is no secret to keep from them, and locking
   them out of their emergency card could hurt someone.
   ========================================================================== */
(function () {
  'use strict';

  var SB_URL = 'https://lfigdijuqmbensebnevo.supabase.co';
  var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaWdkaWp1cW1iZW5zZWJuZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjEzMDgsImV4cCI6MjA4ODkzNzMwOH0.qG1d9DLKrs0qqLgAp-6UGdaU7xWvlg2sWq-oD-y2kVo';
  var SESSION_KEY = 'sb-lfigdijuqmbensebnevo-auth-token';
  var OWNER_UID = 'eabe2b1f-e428-4181-8530-8e5366eb3975';
  var CACHE_KEY = 'flux_hidden_apps_v1';
  var HOLD_MS = 1500;

  /* Other ways of linking to an app, beyond <id>.html. Synara's welcome page
     and the partner program are all about it, so they go with it. */
  var ALSO = {
    grapher: { pages: ['graph/'], hashes: ['#grapher'] },
    synara: { pages: ['synara-welcome.html', 'partners.html'], hashes: [] },
  };

  var root = document.documentElement;
  var script = document.currentScript;
  var declaresPage = !!(script && script.hasAttribute('data-app'));
  var pageApp = declaresPage ? script.getAttribute('data-app') : '';
  var ids = [];

  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }

  function isOwner() {
    var s = readJSON(SESSION_KEY);
    return !!(s && s.user && s.user.id === OWNER_UID);
  }

  function hasOwnRecords(id) {
    if (id !== 'synara') return false;
    var d = readJSON('synara.v2');
    return !!(d && ((d.meds && d.meds.length) || (d.seizures && d.seizures.length)));
  }

  /** Hidden from the person looking at this page? */
  function isHidden(id) {
    return ids.indexOf(id) >= 0 && !isOwner() && !hasOwnRecords(id);
  }

  function selectorsFor(id) {
    var also = ALSO[id] || { pages: [], hashes: [] };
    var out = ['[data-flux-app~="' + id + '"]'];
    [id + '.html'].concat(also.pages).forEach(function (page) {
      out.push(
        'a[href="' + page + '"]',
        'a[href^="' + page + '?"]',
        'a[href^="' + page + '#"]',
        'a[href$="/' + page + '"]'
      );
    });
    also.hashes.forEach(function (hash) { out.push('a[href="' + hash + '"]'); });
    return out;
  }

  function applyStyle() {
    var el = document.getElementById('fluxHiddenApps');
    if (!el) {
      el = document.createElement('style');
      el.id = 'fluxHiddenApps';
      (document.head || root).appendChild(el);
    }
    var sel = ids.filter(isHidden).map(selectorsFor).reduce(function (a, b) { return a.concat(b); }, []);
    el.textContent = sel.length ? sel.join(',') + '{display:none!important}' : '';
  }

  function hold() { root.style.visibility = 'hidden'; }
  function release() { root.style.removeProperty('visibility'); }
  function settlePage() {
    if (pageApp && isHidden(pageApp)) location.replace('suite.html');
    else release();
  }

  function setIds(next, announce) {
    var changed = next.slice().sort().join() !== ids.slice().sort().join();
    ids = next;
    applyStyle();
    if (announce && changed) {
      try { window.dispatchEvent(new CustomEvent('flux-app-visibility')); } catch (e) { /* very old browser */ }
    }
  }

  function refresh() {
    return fetch(SB_URL + '/rest/v1/flux_hidden_apps?select=app_id', {
      headers: { apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON },
      cache: 'no-store',
    }).then(function (res) {
      if (!res.ok) throw new Error('flux_hidden_apps ' + res.status);
      return res.json();
    }).then(function (rows) {
      var next = rows.map(function (r) { return r.app_id; });
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch (e) { /* storage blocked */ }
      setIds(next, true);
      return next;
    });
  }

  window.FluxAppVisibility = {
    isHidden: isHidden,
    isOwner: isOwner,
    /** Everything on the list, whoever is looking: for the owner's own view. */
    hiddenIds: function () { return ids.slice(); },
    refresh: refresh,
  };

  /* Local development and the tests stay off the production list, or hiding an
     app for real would fail every test of it. The visibility tests opt in. */
  var host = location.hostname;
  var local = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  if (local && !window.__FLUX_APP_VIS_TEST) return;

  var cached = readJSON(CACHE_KEY);
  var known = Array.isArray(cached);
  setIds(known ? cached : [], false);

  /* Wait for the real answer, briefly, only when this page might have to leave:
     the first visit on this device, or the last answer said hidden. Asking
     rather than trusting that answer means nobody is bounced once it is shown again.
     Everyone else opens at once and is re-checked behind the scenes. */
  var mustAsk = declaresPage && !isOwner() && (!known || (pageApp && isHidden(pageApp)));
  var timer = 0;
  if (mustAsk) {
    hold();
    timer = setTimeout(settlePage, HOLD_MS);
  }
  refresh().then(function () {
    clearTimeout(timer);
    settlePage();
  }, function () {
    clearTimeout(timer);
    settlePage();
  });
})();
