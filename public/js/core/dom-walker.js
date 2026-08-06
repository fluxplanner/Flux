/**
 * FluxDomWalker — ONE document-wide MutationObserver, many consumers (B5.2).
 *
 * Before: flux-i18n-dom and flux-iconify each ran their own
 * childList+subtree+characterData observer over <body>, and three motion
 * modules each ran a subtree-wide class-attribute observer on
 * documentElement just to notice #app becoming visible. Five full-document
 * observers on a school Chromebook is real jank.
 *
 * Now: one body observer batches records on a 32ms tick (setTimeout, not
 * rAF — rAF starves in hidden tabs and emoji/translations would lag until
 * the next paint) and fans them out to subscribers; app-visibility waiters
 * share one narrow #app attribute observer that disconnects after firing.
 *
 * API (window.FluxDomWalker):
 *   .subscribe(name, cb)   cb(records[]) — batched MutationRecords
 *   .unsubscribe(name)
 *   .onAppVisible(cb)      one-shot; fires immediately if #app is visible
 */
(function () {
  'use strict';
  if (window.FluxDomWalker) return;

  var subs = new Map();
  var observer = null;
  var pending = [];
  var scheduled = false;

  function flush() {
    scheduled = false;
    if (!pending.length) return;
    var batch = pending;
    pending = [];
    subs.forEach(function (cb) {
      try { cb(batch); } catch (e) { /* one consumer must not break the rest */ }
    });
  }

  function onMutations(records) {
    if (!subs.size) { pending = []; return; }
    for (var i = 0; i < records.length; i++) pending.push(records[i]);
    if (scheduled) return;
    scheduled = true;
    setTimeout(flush, 32);
  }

  function ensureObserver() {
    if (observer || !window.MutationObserver || !document.body) return;
    observer = new MutationObserver(onMutations);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function subscribe(name, cb) {
    if (!name || typeof cb !== 'function') return false;
    subs.set(name, cb);
    if (document.body) ensureObserver();
    else document.addEventListener('DOMContentLoaded', ensureObserver, { once: true });
    return true;
  }

  function unsubscribe(name) {
    subs.delete(name);
  }

  /* ── shared "app became visible" signal ── */
  var appCbs = [];
  var appObserver = null;

  function appVisible() {
    var app = document.getElementById('app');
    return !!(app && app.classList.contains('visible'));
  }

  function fireAppVisible() {
    if (appObserver) { try { appObserver.disconnect(); } catch (e) {} appObserver = null; }
    var cbs = appCbs;
    appCbs = [];
    cbs.forEach(function (cb) { try { cb(); } catch (e) {} });
  }

  function armAppObserver() {
    if (appObserver) return;
    var app = document.getElementById('app');
    if (!app) { setTimeout(armAppObserver, 250); return; }
    if (appVisible()) { fireAppVisible(); return; }
    appObserver = new MutationObserver(function () {
      if (appVisible()) fireAppVisible();
    });
    // Narrow: ONE element, class attribute only — not the whole tree.
    appObserver.observe(app, { attributes: true, attributeFilter: ['class'] });
  }

  function onAppVisible(cb) {
    if (typeof cb !== 'function') return;
    if (appVisible()) { try { cb(); } catch (e) {} return; }
    appCbs.push(cb);
    armAppObserver();
  }

  window.FluxDomWalker = { subscribe: subscribe, unsubscribe: unsubscribe, onAppVisible: onAppVisible };
})();
