/**
 * FluxStaffCommand — extends staff search / command palette with module actions.
 */
(function () {
  'use strict';

  let _registered = false;

  function registerCommands() {
    if (_registered) return;
    if (!window.FluxModuleLoader?.suiteEnabled?.()) return;
    try {
      if (!window.FluxFeatureFlags?.isEnabled('enable_staff_command_v2', false)) return;
    } catch (_) {
      return;
    }
    _registered = true;

    window.FLUX_STAFF_COMMANDS = window.FLUX_STAFF_COMMANDS || [];

    const mods = window.FluxModuleLoader.catalog().filter((m) => m.status !== 'planned');
    mods.forEach((m) => {
      window.FLUX_STAFF_COMMANDS.push({
        label: m.title,
        hint: `${m.scope} · ${m.status}`,
        action: () => {
          if (m.scope === 'personal' && window.FluxRole?.setMode) {
            FluxRole.setMode('personal');
            nav('dashboard');
          } else if (m.roles.includes('counselor')) nav('counselorDashboard');
          else if (m.roles.includes('teacher')) nav('teacherDashboard');
          else if (m.roles.includes('admin')) nav('adminOps');
          else nav('staffWorkboard');
          if (typeof showToast === 'function') showToast(`Open ${m.title} from workspace widgets`, 'info');
        },
      });
    });

    window.FLUX_STAFF_COMMANDS.push({
      label: 'Export staff module catalog (CSV)',
      hint: 'FluxModuleLoader',
      action: () => window.FluxModuleLoader?.exportEnabledData?.(),
    });

    const orig = window.runGlobalSearch;
    if (orig && !orig.__fluxStaffWrapped) {
      window.runGlobalSearch = function (q) {
        const extra = (window.FLUX_STAFF_COMMANDS || []).filter((c) =>
          c.label.toLowerCase().includes(q)
        );
        if (extra.length && typeof window.globalSearchResults !== 'undefined') {
          extra.forEach((c) => {
            if (typeof window.appendStaffSearchResults === 'function') {
              window.appendStaffSearchResults(c, q);
            }
          });
        }
        return orig.apply(this, arguments);
      };
      window.runGlobalSearch.__fluxStaffWrapped = true;
    }
  }

  window.FluxStaffCommand = { registerCommands };
})();
