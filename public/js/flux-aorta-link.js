/* ============================================================================
   FLUX × AORTA  ·  flux-aorta-link.js
   The Aorta Project's blood pressure tracker (aorta-tracker.html) lets a
   family give each medicine a reminder time. The planner puts those times on
   its calendar and shows a reminder when one is due, the same way it does
   for Synara doses (flux-synara-link.js), using the same `_synara` medicine
   styling with `_src: 'aorta'` for the label and link.

   WHERE IT READS FROM
   - The signed-in student's own row in aorta_bp_records (their Flux account,
     written by aorta-tracker.html through flux-aorta-vault.mjs), so it works
     on any device signed in to that account.
   - Otherwise this device's tracker copy (localStorage aorta_bp_v1), but
     only when it was never saved to a different account (aorta_bp_sync).
   It never saves or sends any of it: the items are drawn at render time and
   are not in flux_events, so neither cloud sync nor the AI context sees them.

   REMINDERS. At a reminder time the planner shows a toast (and a system
   notification when browser notifications are on), once per dose, and not
   at all if the tracker already marked that medicine taken today. Only
   "<day>|<id>" is remembered (aorta.reminded) so a reload doesn't repeat.
   ========================================================================== */
(function () {
  'use strict';

  var LOCAL = 'aorta_bp_v1';
  var LOCAL_SYNC = 'aorta_bp_sync';
  var SEEN = 'aorta.reminded';
  var DAY = /^\d{4}-\d{2}-\d{2}$/;
  var TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
  var GRACE = 15 * 60000;

  var cloud = null;        // { people } from the account, or null
  var cloudFor = null;     // the account id `cloud` belongs to

  function str(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }
  function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function uid() { return window.currentUser && window.currentUser.id || null; }

  /** Only what the calendar needs: who, which medicine, when, taken today. */
  function parse(d) {
    if (!d || !Array.isArray(d.people)) return null;
    return {
      people: d.people.slice(0, 30).map(function (p) {
        if (!p || !Array.isArray(p.meds)) return null;
        return {
          name: str(p.name, 40) || 'Someone',
          meds: p.meds.slice(0, 50).filter(function (m) { return m && typeof m.id === 'string' && TIME.test(m.time); }).map(function (m) {
            return { id: m.id, name: str(m.name, 60) || 'Medicine', dose: str(m.dose, 30), time: m.time, added: DAY.test(m.added) ? m.added : '' };
          }),
          doses: (Array.isArray(p.doses) ? p.doses : []).filter(function (x) { return x && typeof x.at === 'string'; })
            .map(function (x) { return { medId: String(x.medId), day: ymd(new Date(x.at)) }; }),
        };
      }).filter(Boolean),
    };
  }

  function local() {
    try {
      var owner = (JSON.parse(localStorage.getItem(LOCAL_SYNC) || '{}') || {}).owner;
      if (owner && owner !== uid()) return null;
      return parse(JSON.parse(localStorage.getItem(LOCAL) || 'null'));
    } catch (e) { return null; }
  }

  function feed() {
    if (cloud && cloudFor && cloudFor === uid()) return cloud;
    return local();
  }

  /** Calendar items for one day, shaped like the planner's virtual events. */
  function dosesForDate(day) {
    if (!DAY.test(day)) return [];
    var f = feed();
    if (!f) return [];
    var out = [];
    f.people.forEach(function (p) {
      p.meds.forEach(function (m) {
        if (m.added && day < m.added) return;
        var med = m.dose ? m.name + ' ' + m.dose : m.name;
        out.push({
          id: 'ao_' + m.id,
          medId: m.id,
          title: p.name + ': ' + med,
          time: m.time,
          date: day,
          scope: 'outside',
          _synara: true,
          _src: 'aorta',
          _taken: p.doses.some(function (x) { return x.medId === m.id && x.day === day; }),
        });
      });
    });
    return out;
  }

  var loading = false;
  async function loadCloud() {
    if (loading) return;
    var sb = typeof getSB === 'function' ? getSB() : null;
    var who = uid();
    if (!sb || !who) { if (cloud) { cloud = null; cloudFor = null; refresh(); } return; }
    loading = true;
    try {
      var r = await sb.from('aorta_bp_records').select('data').maybeSingle();
      if (r && r.error) return;   // offline or no table: keep what we had
      var next = r && r.data ? parse(r.data.data) : null;
      var changed = cloudFor !== who || JSON.stringify(next) !== JSON.stringify(cloud);
      cloud = next; cloudFor = who;
      if (changed) refresh();
    } catch (e) {
      /* keep what we had */
    } finally { loading = false; }
  }

  function seen() { try { return JSON.parse(localStorage.getItem(SEEN) || '[]'); } catch (e) { return []; } }
  function remind() {
    var now = new Date(), day = ymd(now), done = seen(), fresh = [];
    dosesForDate(day).forEach(function (d) {
      var at = new Date(day + 'T' + d.time + ':00').getTime(), tag = day + '|' + d.id;
      if (d._taken || now.getTime() < at || now.getTime() - at > GRACE || done.indexOf(tag) >= 0) return;
      fresh.push(tag);
      var msg = 'Time for ' + d.title + ' (' + d.time + ')';
      if (typeof showToast === 'function') showToast(msg, 'info', 12000);
      try {
        var on = typeof settings !== 'undefined' && settings && settings.notifyBrowser;
        if (on && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Medicine reminder', { body: msg, tag: 'aorta-' + tag, icon: 'public/partners/aorta/logo.png' });
        }
      } catch (e) { /* no notifications here */ }
    });
    if (!fresh.length) return;
    var keep = done.filter(function (t) { return t.indexOf(day + '|') === 0; }).concat(fresh);
    try { localStorage.setItem(SEEN, JSON.stringify(keep)); } catch (e) { /* full */ }
  }

  var last;
  function refresh() {
    var next = JSON.stringify(feed());
    if (next === last) return;
    last = next;
    if (typeof window.renderCalendar === 'function') window.renderCalendar();
  }
  window.addEventListener('storage', function (e) { if (e.key === LOCAL || e.key === LOCAL_SYNC || e.key === null) refresh(); });
  window.addEventListener('focus', function () { refresh(); loadCloud(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { refresh(); loadCloud(); } });
  setTimeout(loadCloud, 4000);
  setInterval(function () { if (document.visibilityState === 'visible') loadCloud(); }, 5 * 60000);
  setTimeout(remind, 5000);
  setInterval(remind, 30000);

  window.FluxAorta = { feed: feed, dosesForDate: dosesForDate, loadCloud: loadCloud, remind: remind, parse: parse };
})();
