/**
 * flux-how-to-video.js — "Watch how" videos for connecting Schoology and Canvas.
 * The videos are made by scripts/how-to-videos and have no sound, so the same
 * steps are written out beneath them.
 */
(function () {
  'use strict';

  var ID = 'fluxHowToModal';
  var GUIDES = {
    schoology: {
      title: 'How to connect Schoology',
      src: 'public/videos/connect-schoology.mp4',
      steps: [
        'Sign in to Schoology on a computer and click the calendar icon at the top.',
        'Scroll to the bottom of the calendar and click Export.',
        'Choose Share Calendar, not Download Calendar.',
        'Copy the whole link. Keep it private: anyone who has it can read your calendar.',
        'In Flux, open Connect under Learn, pick Schoology, paste the link and click Connect Schoology.',
      ],
    },
    canvas: {
      title: 'How to connect Canvas',
      src: 'public/videos/connect-canvas.mp4',
      steps: [
        "In Flux, open Canvas under Learn, type your school's Canvas address and click Continue.",
        'Sign in to Canvas, then click Account and Settings.',
        'Scroll down to Approved Integrations and click New Access Token.',
        'Type Flux Planner as the purpose and click Generate Token.',
        'Copy the token now, because Canvas only shows it once. Treat it like a password.',
        'Paste it into Flux and click Connect to Canvas.',
      ],
    },
  };

  function close() {
    var m = document.getElementById(ID);
    if (!m) return;
    var back = m._returnFocus;
    m.remove();
    document.removeEventListener('keydown', onKey);
    if (back && back.focus) back.focus();
  }

  function onKey(e) { if (e.key === 'Escape') close(); }

  function open(name) {
    var g = GUIDES[name];
    if (!g) return;
    var returnFocus = document.activeElement;
    close();
    var ov = document.createElement('div');
    ov.id = ID;
    ov.className = 'modal-overlay';
    ov.style.display = 'flex';
    ov._returnFocus = returnFocus;
    ov.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="fluxHowToTitle" style="max-width:760px;width:min(760px,calc(100vw - 32px));max-height:90vh;overflow-y:auto">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px">' +
          '<h3 id="fluxHowToTitle" style="margin:0">' + g.title + '</h3>' +
          '<button type="button" class="btn-sec" id="fluxHowToClose">Close</button>' +
        '</div>' +
        '<video id="fluxHowToVideo" controls playsinline preload="metadata" src="' + g.src + '" aria-label="' + g.title + ', silent video" style="width:100%;border-radius:10px;background:#000;display:block"></video>' +
        '<ol style="margin:14px 0 0 20px;padding:0;line-height:1.6">' +
          g.steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') +
        '</ol>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.id === 'fluxHowToClose') close();
    });
    document.addEventListener('keydown', onKey);
    document.getElementById('fluxHowToClose').focus();
  }

  window.FluxHowTo = { open: open, close: close };
})();
