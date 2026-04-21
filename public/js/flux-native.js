/* ════════════════════════════════════════════════════════════════
   FLUX NATIVE — Capacitor bridge
   Glues the web app to native iOS/Android features when running
   inside Capacitor. No-ops on the web. Loaded everywhere.
   ════════════════════════════════════════════════════════════════ */

(function(){
'use strict';

const Cap = window.Capacitor;
const isNative = !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());
const platform = isNative ? Cap.getPlatform() : 'web';

const Native = {
  isNative,
  isIOS: platform === 'ios',
  isAndroid: platform === 'android',
  platform,
  _haptics: null,
  _impactStyle: null,
  _localNotifications: null,
  _ready: false,

  async init() {
    if (!isNative) {
      document.documentElement.dataset.fluxPlatform = 'web';
      return;
    }
    document.documentElement.dataset.fluxPlatform = platform;
    document.body.classList.add('flux-native', 'flux-native-' + platform);

    try {
      const { StatusBar, Style } = await import('@capacitor/status-bar').catch(()=>({}));
      if (StatusBar) {
        try { await StatusBar.setOverlaysWebView({ overlay: true }); } catch (e) {}
        try { await StatusBar.setStyle({ style: Style?.Dark || 'DARK' }); } catch (e) {}
        try { if (this.isAndroid) await StatusBar.setBackgroundColor({ color: '#0a0b10' }); } catch (e) {}
      }
    } catch (e) { /* plugin not installed yet */ }

    try {
      const { Keyboard } = await import('@capacitor/keyboard').catch(()=>({}));
      if (Keyboard) {
        Keyboard.addListener('keyboardWillShow', info => {
          document.body.style.setProperty('--keyboard-height', info.keyboardHeight + 'px');
          document.body.classList.add('keyboard-open');
        });
        Keyboard.addListener('keyboardWillHide', () => {
          document.body.style.setProperty('--keyboard-height', '0px');
          document.body.classList.remove('keyboard-open');
        });
      }
    } catch (e) {}

    try {
      const { App } = await import('@capacitor/app').catch(()=>({}));
      if (App) {
        App.addListener('backButton', ({ canGoBack }) => {
          // Close any open overlay before exiting
          const sheet = document.getElementById('moreSheet');
          if (sheet && sheet.classList.contains('open')) { window.closeMobileSheet?.(); return; }
          if (document.body.dataset.fluxFocusMode === 'on') { window.fluxToggleFocusMode?.(); return; }
          const openModal = document.querySelector('.modal.show, .modal[style*="display: flex"], .modal[style*="display:flex"]');
          if (openModal) { openModal.style.display = 'none'; openModal.classList.remove('show'); return; }
          const ach = document.getElementById('fluxAchievementsModal');
          if (ach) { ach.remove(); return; }
          const qa = document.getElementById('fluxQuickAdd');
          if (qa) { qa.remove(); return; }
          const drawer = document.getElementById('mobDrawer');
          if (drawer && drawer.classList.contains('open')) { window.closeDrawer?.(); return; }
          const cmd = document.getElementById('commandPalette');
          if (cmd && cmd.style.display === 'flex') { window.closeCommandPalette?.(); return; }
          // Last resort: nav back to dashboard or exit
          const activeId = document.querySelector('.panel.active')?.id;
          if (activeId && activeId !== 'dashboard') { window.nav?.('dashboard'); return; }
          App.exitApp();
        });

        App.addListener('appStateChange', ({ isActive }) => {
          if (isActive && typeof window.refreshAIContext === 'function') {
            try { window.refreshAIContext(); } catch (e) {}
          }
        });
      }
    } catch (e) {}

    try {
      const haptics = await import('@capacitor/haptics').catch(()=>({}));
      if (haptics?.Haptics) {
        this._haptics = haptics.Haptics;
        this._impactStyle = haptics.ImpactStyle;
        this._notificationType = haptics.NotificationType;
      }
    } catch (e) {}

    try {
      const ln = await import('@capacitor/local-notifications').catch(()=>({}));
      if (ln?.LocalNotifications) {
        this._localNotifications = ln.LocalNotifications;
        try {
          const perm = await ln.LocalNotifications.checkPermissions();
          if (perm.display !== 'granted') {
            await ln.LocalNotifications.requestPermissions();
          }
        } catch (e) {}
      }
    } catch (e) {}

    this._ready = true;
  },

  async haptic(style = 'light') {
    if (!this._haptics) return;
    const map = { light: 'Light', medium: 'Medium', heavy: 'Heavy' };
    const key = map[style] || 'Light';
    try {
      await this._haptics.impact({ style: this._impactStyle?.[key] || key });
    } catch (e) {}
  },

  async hapticSuccess() {
    if (!this._haptics) return;
    try {
      await this._haptics.notification({ type: this._notificationType?.Success || 'SUCCESS' });
    } catch (e) {}
  },

  async hapticWarning() {
    if (!this._haptics) return;
    try {
      await this._haptics.notification({ type: this._notificationType?.Warning || 'WARNING' });
    } catch (e) {}
  },

  async selectionChanged() {
    if (!this._haptics) return;
    try { await this._haptics.selectionChanged(); } catch (e) {}
  },

  async scheduleNotification({ title, body, atDate, id }) {
    if (!this._localNotifications) return;
    try {
      await this._localNotifications.schedule({
        notifications: [{
          id: id || Math.floor(Math.random() * 2_000_000_000),
          title,
          body,
          schedule: atDate ? { at: atDate instanceof Date ? atDate : new Date(atDate) } : undefined,
          sound: 'default',
        }]
      });
    } catch (e) {}
  },

  async cancelNotification(id) {
    if (!this._localNotifications || id == null) return;
    try {
      await this._localNotifications.cancel({ notifications: [{ id }] });
    } catch (e) {}
  },
};

window.Native = Native;
window.fluxHaptic = (style)=>Native.haptic(style);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Native.init());
} else {
  Native.init();
}

// ────────────────────────────────────────────────────────────────
// Auto-haptics — wraps existing global functions once they're defined.
// Re-checks for a few seconds since app.js loads after this module.
// ────────────────────────────────────────────────────────────────
function wrapForHaptics(){
  if (!isNative) return;
  // toggleTask → medium haptic on completion (only when going undone → done)
  if (typeof window.toggleTask === 'function' && !window.toggleTask.__fluxHaptics){
    const orig = window.toggleTask;
    window.toggleTask = function(id){
      const t = (window.tasks || []).find(x => x.id === id || String(x.id) === String(id));
      const wasUndone = t && !t.done;
      const r = orig.apply(this, arguments);
      if (wasUndone) Native.hapticSuccess();
      return r;
    };
    window.toggleTask.__fluxHaptics = true;
  }
  // addTask → light haptic
  if (typeof window.addTask === 'function' && !window.addTask.__fluxHaptics){
    const orig = window.addTask;
    window.addTask = function(){ const r = orig.apply(this, arguments); Native.haptic('light'); return r; };
    window.addTask.__fluxHaptics = true;
  }
  // spawnConfetti → heavy haptic
  if (typeof window.spawnConfetti === 'function' && !window.spawnConfetti.__fluxHaptics){
    const orig = window.spawnConfetti;
    window.spawnConfetti = function(){ Native.haptic('heavy'); return orig.apply(this, arguments); };
    window.spawnConfetti.__fluxHaptics = true;
  }
  // showToast → light haptic for warnings/errors
  if (typeof window.showToast === 'function' && !window.showToast.__fluxHaptics){
    const orig = window.showToast;
    window.showToast = function(msg, type){
      if (type === 'error' || type === 'warn' || type === 'warning') Native.hapticWarning();
      else Native.haptic('light');
      return orig.apply(this, arguments);
    };
    window.showToast.__fluxHaptics = true;
  }
  // deleteTask → medium haptic
  if (typeof window.deleteTask === 'function' && !window.deleteTask.__fluxHaptics){
    const orig = window.deleteTask;
    window.deleteTask = function(){ Native.haptic('medium'); return orig.apply(this, arguments); };
    window.deleteTask.__fluxHaptics = true;
  }
}

let _hapticTries = 0;
const _hapticInterval = setInterval(() => {
  wrapForHaptics();
  _hapticTries++;
  if (_hapticTries > 40) clearInterval(_hapticInterval); // ~10s of trying
}, 250);

})();
