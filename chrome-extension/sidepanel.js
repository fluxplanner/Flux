/* global chrome */
(function () {
  'use strict';

  /** Default GitHub Pages URL for the public Flux repo (override in the header field). */
  var DEFAULT_FLUX_URL = 'https://fluxplanner.github.io/Flux/';

  var fluxFrame = document.getElementById('fluxFrame');
  var chatLog = document.getElementById('chatLog');
  var contextHint = document.getElementById('contextHint');
  var questionEl = document.getElementById('question');
  var msgId = 0;
  var pending = new Map();

  var lastSnapshotText = '';
  var lastImageDataUrl = '';

  function fluxTargetOrigin() {
    try {
      return new URL(fluxFrame.src).origin;
    } catch (_) {
      return '*';
    }
  }

  function appendBubble(kind, text) {
    var d = document.createElement('div');
    d.className = 'bubble ' + (kind === 'user' ? 'user' : kind === 'err' ? 'err' : 'ai');
    var lab = document.createElement('div');
    lab.className = 'label';
    lab.textContent = kind === 'user' ? 'You' : kind === 'err' ? 'Error' : 'Flux AI';
    d.appendChild(lab);
    var body = document.createElement('div');
    body.textContent = text;
    d.appendChild(body);
    chatLog.appendChild(d);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function postToFlux(payload, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var id = ++msgId;
      var origin = fluxTargetOrigin();
      var ms = typeof timeoutMs === 'number' ? timeoutMs : 90000;
      if (
        !fluxFrame.contentWindow ||
        fluxFrame.src === 'about:blank' ||
        origin === 'null' ||
        origin === '*'
      ) {
        reject(new Error('Flux frame not loaded — check URL and press Save.'));
        return;
      }
      var t = setTimeout(function () {
        pending.delete(id);
        reject(
          new Error(
            ms <= 10000
              ? 'Flux bridge not ready yet.'
              : 'Flux bridge timeout — deploy this repo so flux-extension-bridge.js loads, then reload the frame.',
          ),
        );
      }, ms);
      pending.set(id, { resolve: resolve, reject: reject, t: t });
      fluxFrame.contentWindow.postMessage(
        Object.assign({ source: 'flux-chrome-ext', id: id }, payload),
        origin,
      );
    });
  }

  window.addEventListener('message', function (ev) {
    if (!ev.data || ev.data.source !== 'flux-app-bridge') return;
    var id = ev.data.id;
    var p = pending.get(id);
    if (!p) return;
    clearTimeout(p.t);
    pending.delete(id);
    if (ev.data.ok) p.resolve(ev.data);
    else p.reject(new Error(ev.data.error || 'Bridge error'));
  });

  var bridgeTries = 0;
  function tryBridgeConnect() {
    postToFlux({ type: 'PING' }, 7000)
      .then(function () {
        contextHint.textContent =
          'Bridge ready. Sign in inside Flux if needed, then use Flux UI snapshot, Capture tab, or Share screen before you ask.';
      })
      .catch(function () {
        bridgeTries++;
        if (bridgeTries < 25) {
          setTimeout(tryBridgeConnect, 500);
        } else {
          contextHint.textContent =
            'No bridge — use a deploy built from this repo (includes flux-extension-bridge.js) or update the Flux URL.';
        }
      });
  }

  fluxFrame.addEventListener('load', function () {
    if (fluxFrame.src === 'about:blank') return;
    contextHint.textContent = 'Frame loaded. Connecting to Flux bridge…';
    bridgeTries = 0;
    tryBridgeConnect();
  });

  document.getElementById('btnSnapshot').addEventListener('click', function () {
    postToFlux({ type: 'SNAPSHOT' })
      .then(function (r) {
        lastSnapshotText = (r.snapshot && r.snapshot.text) || '';
        lastImageDataUrl = '';
        contextHint.textContent =
          'Snapshot OK (' + lastSnapshotText.length + ' chars). Asking will use this until you capture an image.';
      })
      .catch(function (e) {
        contextHint.textContent = String((e && e.message) || e);
        appendBubble('err', String((e && e.message) || e));
      });
  });

  document.getElementById('btnTab').addEventListener('click', function () {
    chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' }, function (bg) {
      if (chrome.runtime.lastError) {
        appendBubble('err', chrome.runtime.lastError.message);
        return;
      }
      if (!bg || !bg.ok) {
        appendBubble('err', (bg && bg.error) || 'Capture failed');
        return;
      }
      lastImageDataUrl = bg.dataUrl;
      lastSnapshotText = '';
      contextHint.textContent =
        'Captured the focused tab. The next question uses this image (vision).';
    });
  });

  document.getElementById('btnScreen').addEventListener('click', function () {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      appendBubble('err', 'Screen share is not available in this context.');
      return;
    }
    navigator.mediaDevices
      .getDisplayMedia({ video: true, audio: false })
      .then(function (stream) {
        var video = document.createElement('video');
        video.playsInline = true;
        video.srcObject = stream;
        return video.play().then(function () {
          return new Promise(function (r) {
            requestAnimationFrame(r);
          }).then(function () {
            var canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
            stream.getTracks().forEach(function (t) {
              t.stop();
            });
            lastImageDataUrl = canvas.toDataURL('image/png');
            lastSnapshotText = '';
            contextHint.textContent =
              'Screen/window capture ready. The next question uses this image (vision).';
          });
        });
      })
      .catch(function (e) {
        appendBubble('err', String((e && e.message) || e));
      });
  });

  document.getElementById('chatForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = questionEl.value.trim();
    if (!q) return;
    appendBubble('user', q);
    questionEl.value = '';
    var useVision = !!lastImageDataUrl;
    var promise;
    if (useVision) {
      var comma = lastImageDataUrl.indexOf(',');
      var raw = comma >= 0 ? lastImageDataUrl.slice(comma + 1) : lastImageDataUrl;
      promise = postToFlux({
        type: 'AI_VISION',
        question: q,
        imageBase64: raw,
        mimeType: 'image/png',
      });
    } else {
      promise = postToFlux({
        type: 'AI_TEXT',
        question: q,
        snapshotText: lastSnapshotText,
      });
    }
    promise
      .then(function (r) {
        appendBubble('ai', r.text || '(empty response)');
      })
      .catch(function (err) {
        appendBubble('err', String((err && err.message) || err));
      });
  });

  var urlInput = document.getElementById('fluxUrl');
  chrome.storage.local.get(['fluxAppUrl'], function (r) {
    urlInput.value = r.fluxAppUrl || DEFAULT_FLUX_URL;
    fluxFrame.src = urlInput.value;
  });

  document.getElementById('saveUrl').addEventListener('click', function () {
    var u = urlInput.value.trim();
    if (!u) return;
    if (!/^https:\/\//i.test(u)) {
      appendBubble('err', 'URL must start with https://');
      return;
    }
    if (!u.endsWith('/')) u += '/';
    chrome.storage.local.set({ fluxAppUrl: u }, function () {
      fluxFrame.src = u;
      contextHint.textContent = 'Saved. Reloading frame…';
    });
  });

  document.getElementById('reloadFrame').addEventListener('click', function () {
    fluxFrame.src = fluxFrame.src;
  });
})();
