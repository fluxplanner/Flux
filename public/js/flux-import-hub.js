/**
 * flux-import-hub.js — one place to import everything.
 *
 * Importing was scattered across School Info (schedule photo, .ics timetable),
 * the Google hub (Calendar / Classroom / Drive), Canvas, and Settings (backup).
 * This gathers the role-appropriate import methods into a single modal so users
 * don't have to hunt — and reassures them imports persist (they sync to the
 * account, so it's a one-time action). Each card routes to the EXISTING, proven
 * flow (no reimplementation). Exposed as window.openImportHub(). Self-contained.
 */
(function () {
  'use strict';

  var MODAL_ID = 'fluxImportHubModal';

  function isEducator() {
    try { return !!(window.FluxRole && window.FluxRole.isEducator && window.FluxRole.isEducator()); } catch (e) { return false; }
  }
  function toast(msg, kind) { try { if (typeof window.showToast === 'function') window.showToast(msg, kind || 'info'); } catch (e) {} }
  function close() { var m = document.getElementById(MODAL_ID); if (m) m.remove(); }

  /** Click an existing (possibly hidden) file input by id; the app's onchange
   *  handler does the parsing + persistence. Returns false if not present. */
  function clickInput(id) {
    var el = document.getElementById(id);
    if (!el) return false;
    el.click();
    return true;
  }
  function go(panel) { try { if (typeof window.nav === 'function') window.nav(panel); } catch (e) {} }

  /** Build the list of import cards available to the current user. */
  function cards() {
    var list = [];
    // Universal
    list.push({
      icon: '📅', title: 'Google Calendar',
      desc: 'Pull your Google Calendar events into Flux.',
      run: function () {
        close();
        if (typeof window.syncGoogleCalendar === 'function') { window.syncGoogleCalendar(); toast('Syncing Google Calendar…', 'info'); }
        else { go('calendar'); toast('Open Calendar to connect Google.', 'info'); }
      },
    });

    if (!isEducator()) {
      list.push({
        icon: '📷', title: 'Class schedule (photo or PDF)',
        desc: 'Upload a picture or PDF of your timetable — Flux reads it into classes.',
        run: function () { close(); if (!clickInput('schoolScheduleFile')) { go('school'); toast('Open School Info to import your schedule.', 'info'); } },
      });
      list.push({
        icon: '🗓️', title: 'Timetable file (.ics)',
        desc: 'Import a school .ics timetable into your weekly schedule.',
        run: function () {
          close();
          if (clickInput('fluxIcsFile')) return;
          go('school');
          setTimeout(function () { if (!clickInput('fluxIcsFile')) toast('Open School Info → Timetable to import your .ics file.', 'info'); }, 400);
        },
      });
      list.push({
        icon: '🎓', title: 'Canvas',
        desc: 'Pull assignments and classes from Canvas in one go.',
        run: function () {
          close();
          if (typeof window.importEverythingFromCanvas === 'function') { window.importEverythingFromCanvas(); }
          else { go('canvas'); toast('Open the Canvas panel to import.', 'info'); }
        },
      });
    } else {
      list.push({
        icon: '🏫', title: 'Google Classroom',
        desc: 'Sync your Classroom courses and rosters.',
        run: function () { close(); go('canvas'); toast('Connect Google Classroom in the Google hub.', 'info'); },
      });
      list.push({
        icon: '📂', title: 'Google Drive',
        desc: 'Import documents and materials from Drive.',
        run: function () { close(); go('canvas'); toast('Import from Drive in the Google hub.', 'info'); },
      });
    }

    // Universal — restore
    list.push({
      icon: '♻️', title: 'Restore from backup',
      desc: 'Bring everything back from a Flux backup file.',
      run: function () { close(); if (!clickInput('importEncryptedFile')) { go('settings'); toast('Open Settings → Data to restore a backup.', 'info'); } },
    });

    return list;
  }

  function open() {
    close();
    var defs = cards();
    var ov = document.createElement('div');
    ov.id = MODAL_ID;
    ov.className = 'modal-overlay';
    ov.style.display = 'flex';
    var items = defs.map(function (c, i) {
      return '<button type="button" class="fih-card" data-i="' + i + '">' +
        '<span class="fih-card-ico">' + c.icon + '</span>' +
        '<span class="fih-card-text"><span class="fih-card-title">' + c.title + '</span>' +
        '<span class="fih-card-desc">' + c.desc + '</span></span>' +
        '<span class="fih-card-arrow">→</span></button>';
    }).join('');
    ov.innerHTML =
      '<div class="modal fih-modal">' +
        '<div class="fih-head"><h3 class="fih-title">Import into Flux</h3>' +
        '<button type="button" class="fih-x" id="fihClose" aria-label="Close">✕</button></div>' +
        '<p class="fih-note">Everything in one place. Imports save to your account and sync across devices — you only need to do this once.</p>' +
        '<div class="fih-list">' + items + '</div>' +
      '</div>';
    document.body.appendChild(ov);

    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.closest('#fihClose')) { close(); return; }
      var card = e.target.closest('.fih-card');
      if (!card) return;
      var def = defs[+card.getAttribute('data-i')];
      if (def && typeof def.run === 'function') def.run();
    });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
  }

  window.openImportHub = open;
})();
