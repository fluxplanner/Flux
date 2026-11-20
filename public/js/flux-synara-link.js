/* ============================================================================
   FLUX × SYNARA  ·  flux-synara-link.js
   Synara (synara.html) runs on the same site as the planner. When a student
   turns on "Show in my Flux Planner" in Synara (You → Flux Planner), Synara
   writes a small summary to localStorage["synara.flux"]:

     { v: 1, meds: [{ name, dose, color, added, ended,
                      schedule: [{ from: "YYYY-MM-DD", times: ["HH:MM"] }] }] }

   Only medication names, doses and times. The planner reads it to put dose
   times on the calendar and a safety-card shortcut on School info. It never
   saves, syncs or sends it anywhere: these items are drawn at render time and
   are not in flux_events, so neither cloud sync nor the AI context sees them.
   Turning the setting off in Synara removes the key, and they disappear.

   ON ANOTHER DEVICE (2026-10-26). The same switch now syncs with the rest of
   the student's Synara record, and the key to that record is kept in their
   Flux account (synara_vaults.sync_key). So when this device has no summary
   of its own, the planner reads the synced copy for the signed-in student,
   opens it in memory, and uses the same medication summary when the switch
   is on. Nothing from it is saved here or sent anywhere.

   REMINDERS. At each dose time the planner shows a reminder (and a system
   notification when browser notifications are on in Settings), once per dose.
   Only "<day>|<dose id>" is remembered, so a reload doesn't repeat one.
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'synara.flux';
  var DAY = /^\d{4}-\d{2}-\d{2}$/;
  var TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

  function str(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }

  /** The summary, validated; null when Synara has not shared anything. */
  function feed() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { return cloud; }
    if (!raw) return cloud;
    var d;
    try { d = JSON.parse(raw); } catch (e) { return cloud; }
    return parse(d) || cloud;
  }
  function parse(d) {
    if (!d || d.v !== 1 || !Array.isArray(d.meds)) return null;
    var meds = d.meds.slice(0, 50).map(function (m) {
      if (!m || !DAY.test(m.added)) return null;
      var schedule = (Array.isArray(m.schedule) ? m.schedule : [])
        .filter(function (e) { return e && DAY.test(e.from) && Array.isArray(e.times); })
        .map(function (e) { return { from: e.from, times: e.times.filter(function (t) { return TIME.test(t); }).slice(0, 24) }; })
        .sort(function (a, b) { return a.from < b.from ? -1 : a.from > b.from ? 1 : 0; });
      return {
        name: str(m.name, 80) || 'Medication',
        dose: str(m.dose, 40),
        added: m.added,
        ended: DAY.test(m.ended) ? m.ended : null,
        schedule: schedule,
      };
    }).filter(Boolean);
    return { meds: meds };
  }

  /* Same rule as Synara's store.timesOn: nothing before it was added or from
     the day it was stopped; otherwise the latest schedule entry that applies. */
  function timesOn(med, day) {
    if (day < med.added || (med.ended && day >= med.ended)) return [];
    var times = [];
    for (var i = 0; i < med.schedule.length; i++) {
      if (med.schedule[i].from <= day) times = med.schedule[i].times;
    }
    return times;
  }

  /** Calendar items for one day, shaped like the planner's virtual events. */
  function dosesForDate(day) {
    if (!DAY.test(day)) return [];
    var f = feed();
    if (!f) return [];
    var out = [];
    f.meds.forEach(function (med, i) {
      timesOn(med, day).forEach(function (t) {
        out.push({
          id: 'sy_' + i + '_' + t,
          title: med.dose ? med.name + ' ' + med.dose : med.name,
          time: t,
          date: day,
          scope: 'outside',
          _synara: true,
        });
      });
    });
    return out;
  }

  var PULSE = '<svg viewBox="0 0 32 32" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 19h4l2.5-6.5L16.5 23l2.8-7H26"/></svg>';

  /** School info: a shortcut to the safety card, while Synara is linked. */
  function decorateSchool() {
    var stack = document.querySelector('#school .flux-stack');
    if (!stack) return;
    var card = document.getElementById('fxSynaraSchool');
    if (!feed()) { if (card) card.remove(); return; }
    if (card) return;
    card = document.createElement('div');
    card.className = 'card';
    card.id = 'fxSynaraSchool';
    card.style.cssText = 'border-color:rgba(156,122,255,.4);background:linear-gradient(155deg,rgba(156,122,255,.12),transparent 60%),var(--card)';
    card.innerHTML = ''
      + '<div style="display:flex;gap:12px;align-items:center">'
      + '<span style="flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:12px;color:#fff;background:linear-gradient(135deg,#9c7aff,#5926d4)">' + PULSE + '</span>'
      + '<div style="flex:1;min-width:0"><h3 style="margin:0">Seizure safety card</h3>'
      + '<div style="font-size:.8rem;color:var(--muted2)">From Synara: what to do if you have a seizure at school, ready for a teacher, the nurse or a coach.</div></div>'
      + '</div>'
      + '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">'
      + '<a class="btn-sec" href="synara.html#/safety" style="text-decoration:none">Open my safety card</a>'
      + '<a class="btn-sec" href="synara.html#/sos" style="text-decoration:none">Emergency card</a>'
      + '</div>';
    stack.insertBefore(card, stack.firstChild);
  }

  /* ── The synced copy, for a device with no summary of its own ────────── */
  var cloud = null;
  var ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  function keyBytes(text) {
    var clean = String(text || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (clean.length !== 26) return null;
    var bits = 0, value = 0, out = [];
    for (var i = 0; i < clean.length; i++) {
      var v = ALPHA.indexOf(clean[i]);
      if (v < 0) return null;
      value = ((value << 5) | v) & 0xffff; bits += 5;
      if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
    }
    return out.length === 16 ? new Uint8Array(out) : null;
  }
  function unb64(t) { return Uint8Array.from(atob(t), function (c) { return c.charCodeAt(0); }); }
  /** The summary Synara would publish, from its whole (decrypted) record. */
  function summaryOf(rec) {
    if (!rec || !rec.settings || rec.settings.fluxLink !== true || !Array.isArray(rec.meds)) return null;
    return parse({ v: 1, meds: rec.meds.map(function (m) {
      return { name: m.name, dose: m.dose, color: m.color, added: m.added, ended: m.ended, schedule: m.schedule };
    }) });
  }
  var loading = false;
  async function loadCloud() {
    if (loading) return;
    var sb = typeof getSB === 'function' ? getSB() : null;
    var who = window.currentUser;
    if (!sb || !who || !window.crypto || !crypto.subtle) return;
    loading = true;
    try {
      var r = await sb.from('synara_vaults').select('ciphertext, iv, sync_key').maybeSingle();
      var row = r && r.data, raw = row && keyBytes(row.sync_key);
      var next = null;
      if (raw) {
        var k = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
        var plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(row.iv) }, k, unb64(row.ciphertext));
        next = summaryOf(JSON.parse(new TextDecoder().decode(plain)));
      }
      var changed = JSON.stringify(next) !== JSON.stringify(cloud);
      cloud = next;
      if (changed) { lastFeed = undefined; refreshLink(); }
    } catch (e) {
      /* Offline, signed out or no table: keep what we had. */
    } finally { loading = false; }
  }

  /* ── Dose reminders ────────────────────────────────────────────────── */
  var SEEN = 'synara.flux.reminded';
  var GRACE = 15 * 60000;   // a dose up to 15 minutes ago still gets its reminder
  function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function seen() { try { return JSON.parse(localStorage.getItem(SEEN) || '[]'); } catch (e) { return []; } }
  function remind() {
    var now = new Date(), day = ymd(now), done = seen(), fresh = [];
    dosesForDate(day).forEach(function (d) {
      var at = new Date(day + 'T' + d.time + ':00').getTime(), tag = day + '|' + d.id;
      if (now.getTime() < at || now.getTime() - at > GRACE || done.indexOf(tag) >= 0) return;
      fresh.push(tag);
      var msg = 'Time for ' + d.title + ' (' + d.time + ')';
      if (typeof showToast === 'function') showToast(msg, 'info', 12000);
      try {
        var on = typeof settings !== 'undefined' && settings && settings.notifyBrowser;
        if (on && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Medication reminder', { body: msg, tag: 'synara-' + tag, icon: 'public/flux-planner-logo.png' });
        }
      } catch (e) { /* no notifications here */ }
    });
    if (!fresh.length) return;
    // Today's only: older entries can't match again.
    var keep = done.filter(function (t) { return t.indexOf(day + '|') === 0; }).concat(fresh);
    try { localStorage.setItem(SEEN, JSON.stringify(keep)); } catch (e) { /* full */ }
  }

  var lastFeed;
  function refreshLink() {
    var next; try { next=localStorage.getItem(KEY)||(cloud?JSON.stringify(cloud):null); } catch (_) { return; }
    if(next===lastFeed)return;
    lastFeed=next;
    if(typeof window.renderCalendar==='function')window.renderCalendar();
    decorateSchool();
  }
  window.addEventListener('storage',function(e){if(e.key===KEY||e.key===null)refreshLink();});
  window.addEventListener('focus',function(){refreshLink();loadCloud();});
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'){refreshLink();loadCloud();}});
  // Signed in a moment after load; the synced copy can change on another device.
  setTimeout(loadCloud, 4000);
  setInterval(function(){ if(document.visibilityState==='visible')loadCloud(); }, 5 * 60000);
  setTimeout(remind, 5000);
  setInterval(remind, 30000);

  window.FluxSynara = { feed: feed, dosesForDate: dosesForDate, decorateSchool: decorateSchool, loadCloud: loadCloud, remind: remind, summaryOf: summaryOf };
})();
