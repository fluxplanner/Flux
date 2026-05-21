/**
 * P13.7 — Meeting mode: collapse distractions, banner + auto-reply copy.
 * Flag: enable_meeting_mode (default off).
 */
(function () {
  'use strict';

  const FLAG = 'enable_meeting_mode';
  const STORE_KEY = 'flux_meeting_mode_v1';
  let _timer = null;
  let _endsAt = 0;
  let _turnedOnFocus = false;
  let _toastWrapped = false;

  function enabled() {
    try {
      return !!window.FluxFeatureFlags?.isEnabled(FLAG, false);
    } catch (_) {
      return false;
    }
  }

  function load(k, def) {
    if (typeof window.load === 'function') return window.load(k, def);
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : def;
    } catch (_) {
      return def;
    }
  }

  function save(k, v) {
    if (typeof window.save === 'function') window.save(k, v);
    else {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (_) {}
    }
  }

  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function T(key, vars) {
    if (typeof window.fluxT === 'function') return window.fluxT(key, vars);
    return key;
  }

  function toast(msg, kind) {
    if (typeof window.showToast === 'function') window.showToast(msg, kind || 'info');
  }

  function isActive() {
    return document.body.dataset.fluxMeetingMode === 'on';
  }

  function getStore() {
    const s = load(STORE_KEY, {});
    return s && typeof s === 'object' ? s : {};
  }

  function persistStore(patch) {
    const next = { ...getStore(), ...patch, updatedAt: Date.now() };
    save(STORE_KEY, next);
    try {
      if (typeof window.syncKey === 'function') window.syncKey('meetingMode', next);
    } catch (_) {}
    return next;
  }

  function applyFromCloud(data) {
    if (!data || typeof data !== 'object') return;
    save(STORE_KEY, data);
    renderCard();
  }

  function getCloudSlice() {
    return getStore();
  }

  function formatRemaining(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function endTimeLabel(date) {
    try {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (_) {
      return '';
    }
  }

  function buildAutoReply(endDate, label) {
    const time = endTimeLabel(endDate);
    const subject = label || T('meeting.default_label');
    return T('meeting.auto_reply', { time, subject });
  }

  async function copyAutoReply() {
    const end = new Date(_endsAt);
    const label = getStore().lastLabel || T('meeting.default_label');
    const text = buildAutoReply(end, label);
    try {
      await navigator.clipboard.writeText(text);
      toast(T('meeting.copied'), 'success');
    } catch (_) {
      toast(text, 'info');
    }
  }

  function ensureBar() {
    let bar = document.getElementById('fluxMeetingBar');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'fluxMeetingBar';
    bar.className = 'flux-meeting-bar';
    bar.setAttribute('role', 'status');
    bar.innerHTML = `<span class="flux-meeting-dot" aria-hidden="true"></span>
      <span class="flux-meeting-label" id="fluxMeetingBarLabel"></span>
      <span class="flux-meeting-time" id="fluxMeetingBarTime"></span>
      <button type="button" class="flux-meeting-copy" id="fluxMeetingCopyBtn">${esc(T('meeting.copy_reply'))}</button>
      <button type="button" class="flux-meeting-exit" id="fluxMeetingExitBtn">${esc(T('meeting.exit'))}</button>`;
    document.body.appendChild(bar);
    bar.querySelector('#fluxMeetingCopyBtn')?.addEventListener('click', copyAutoReply);
    bar.querySelector('#fluxMeetingExitBtn')?.addEventListener('click', () => stopMeeting(false));
    return bar;
  }

  function updateBar() {
    const bar = ensureBar();
    const labelEl = document.getElementById('fluxMeetingBarLabel');
    const timeEl = document.getElementById('fluxMeetingBarTime');
    const store = getStore();
    if (labelEl) labelEl.textContent = store.lastLabel || T('meeting.default_label');
    if (timeEl) timeEl.textContent = formatRemaining(_endsAt - Date.now());
    bar.style.display = isActive() ? 'flex' : 'none';
  }

  function tick() {
    if (!isActive()) return;
    updateBar();
    if (Date.now() >= _endsAt) stopMeeting(true);
  }

  function wrapToastFilter() {
    if (_toastWrapped || typeof window.showToast !== 'function') return;
    const orig = window.showToast;
    window.showToast = function (msg, kind) {
      if (enabled() && isActive() && kind !== 'error' && kind !== 'warning') return;
      return orig.apply(this, arguments);
    };
    _toastWrapped = true;
  }

  function startMeeting(mins, label) {
    if (!enabled()) return false;
    const minutes = Math.min(180, Math.max(5, parseInt(mins, 10) || getStore().lastMinutes || 30));
    const name = String(label || getStore().lastLabel || T('meeting.default_label')).trim();
    persistStore({ lastMinutes: minutes, lastLabel: name });

    _turnedOnFocus = document.body.dataset.fluxFocusMode !== 'on';
    if (_turnedOnFocus && typeof window.fluxToggleFocusMode === 'function') {
      window.fluxToggleFocusMode();
    }

    document.body.dataset.fluxMeetingMode = 'on';
    document.body.classList.add('flux-meeting-active');
    _endsAt = Date.now() + minutes * 60 * 1000;

    ensureBar();
    updateBar();
    clearInterval(_timer);
    _timer = setInterval(tick, 1000);

    if (typeof window.nav === 'function') {
      try {
        window.nav('dashboard');
      } catch (_) {}
    }

    toast(T('meeting.started', { n: minutes }), 'success');
    return true;
  }

  function stopMeeting(completed) {
    if (!isActive()) return;
    clearInterval(_timer);
    _timer = null;
    document.body.dataset.fluxMeetingMode = 'off';
    document.body.classList.remove('flux-meeting-active');
    const bar = document.getElementById('fluxMeetingBar');
    if (bar) bar.style.display = 'none';

    if (_turnedOnFocus && typeof window.fluxToggleFocusMode === 'function') {
      try {
        window.fluxToggleFocusMode();
      } catch (_) {}
    }
    _turnedOnFocus = false;

    toast(completed ? T('meeting.done') : T('meeting.ended'), completed ? 'success' : 'info');
  }

  function renderCard() {
    const anchor = document.getElementById('fluxPomoPresetBar') || document.querySelector('#timer .card');
    if (!anchor || !enabled()) {
      document.getElementById('fluxMeetingModeCard')?.remove();
      return;
    }

    let card = document.getElementById('fluxMeetingModeCard');
    if (!card) {
      card = document.createElement('div');
      card.id = 'fluxMeetingModeCard';
      card.className = 'card flux-meeting-card';
      anchor.insertAdjacentElement('afterend', card);
    }

    const store = getStore();
    const mins = store.lastMinutes || 30;
    const label = store.lastLabel || '';

    card.innerHTML = `<h3>${esc(T('meeting.title'))}</h3>
      <p class="flux-meeting-lede">${esc(T('meeting.lede'))}</p>
      <label class="modal-micro-label" for="fluxMeetingLabelInput">${esc(T('meeting.label'))}</label>
      <input type="text" id="fluxMeetingLabelInput" maxlength="80" value="${esc(label)}" placeholder="${esc(T('meeting.label_ph'))}" />
      <label class="modal-micro-label" for="fluxMeetingMinsSelect">${esc(T('meeting.duration'))}</label>
      <select id="fluxMeetingMinsSelect" style="width:100%;margin:0 0 10px">
        <option value="25"${mins === 25 ? ' selected' : ''}>25 ${esc(T('meeting.min'))}</option>
        <option value="30"${mins === 30 ? ' selected' : ''}>30 ${esc(T('meeting.min'))}</option>
        <option value="45"${mins === 45 ? ' selected' : ''}>45 ${esc(T('meeting.min'))}</option>
        <option value="60"${mins === 60 ? ' selected' : ''}>60 ${esc(T('meeting.min'))}</option>
        <option value="90"${mins === 90 ? ' selected' : ''}>90 ${esc(T('meeting.min'))}</option>
      </select>
      <div class="flux-meeting-actions">
        <button type="button" id="fluxMeetingStartBtn">${esc(T('meeting.start'))}</button>
        <button type="button" class="btn-sec" id="fluxMeetingCopyOnlyBtn">${esc(T('meeting.copy_reply'))}</button>
      </div>`;

    card.querySelector('#fluxMeetingStartBtn')?.addEventListener('click', () => {
      const m = card.querySelector('#fluxMeetingMinsSelect')?.value;
      const l = card.querySelector('#fluxMeetingLabelInput')?.value;
      startMeeting(m, l);
    });
    card.querySelector('#fluxMeetingCopyOnlyBtn')?.addEventListener('click', () => {
      const m = parseInt(card.querySelector('#fluxMeetingMinsSelect')?.value, 10) || 30;
      const l = card.querySelector('#fluxMeetingLabelInput')?.value;
      _endsAt = Date.now() + m * 60 * 1000;
      persistStore({ lastMinutes: m, lastLabel: l });
      copyAutoReply();
    });
  }

  function getPaletteCommands(q) {
    if (!enabled()) return [];
    const label = T('meeting.palette');
    const needle = (q || '').toLowerCase().trim();
    if (
      needle &&
      !label.toLowerCase().includes(needle) &&
      !['meeting', 'class', 'focus', 'distraction'].some((k) => needle.includes(k)) &&
      !(window.FluxCmdPaletteV2?.matchesQuery?.(needle, label, '', ['meeting', 'class']))
    ) {
      return [];
    }
    return [
      {
        id: 'meeting:start',
        icon: '📵',
        label,
        cat: 'Focus',
        _keys: ['meeting', 'class', 'distraction', 'collapse'],
        action: () => {
          if (typeof window.closeCommandPalette === 'function') window.closeCommandPalette();
          startMeeting(getStore().lastMinutes || 30, getStore().lastLabel);
        },
      },
    ];
  }

  function install() {
    if (!enabled()) {
      document.getElementById('fluxMeetingModeCard')?.remove();
      document.getElementById('fluxMeetingBar')?.remove();
      if (isActive()) stopMeeting(false);
      return false;
    }
    wrapToastFilter();
    renderCard();
    const origNav = window.nav;
    if (typeof origNav === 'function' && !origNav._fluxMeetingWrapped) {
      window.nav = function (id) {
        const r = origNav.apply(this, arguments);
        if (id === 'timer') setTimeout(renderCard, 60);
        return r;
      };
      window.nav._fluxMeetingWrapped = true;
    }
    document.addEventListener('keydown', (e) => {
      if (!isActive()) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        stopMeeting(false);
      }
    });
    return true;
  }

  window.FluxMeetingMode = {
    FLAG,
    enabled,
    isActive,
    startMeeting,
    stopMeeting,
    copyAutoReply,
    renderCard,
    getPaletteCommands,
    getCloudSlice,
    applyFromCloud,
    install,
  };
})();
