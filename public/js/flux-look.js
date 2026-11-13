/* Flux look switch — "flat" (default, 2026-11) or "classic" (the old
   gradient/glow look).

   Every Flux page loads this in <head>, before first paint, so the page never
   flashes the wrong look. public/css/flux-look-flat.css only applies while
   <html data-flux-look="flat">.

   To go back to the old look:
     • Settings → Appearance → "Classic look", or
     • open any page with ?look=classic (and ?look=flat to come back).
   The choice is remembered per device in localStorage "flux_look". */
(function () {
  var KEY = 'flux_look';
  var root = document.documentElement;

  function read() {
    try {
      var q = new URLSearchParams(location.search).get('look');
      if (q === 'classic' || q === 'flat') { localStorage.setItem(KEY, q); return q; }
      return localStorage.getItem(KEY) === 'classic' ? 'classic' : 'flat';
    } catch (_) { return 'flat'; }
  }

  function apply(look) { root.setAttribute('data-flux-look', look); }

  apply(read());

  window.FluxLook = {
    get: function () { return root.getAttribute('data-flux-look') || 'flat'; },
    set: function (look) {
      look = look === 'classic' ? 'classic' : 'flat';
      try { localStorage.setItem(KEY, look); } catch (_) {}
      apply(look);
      try { window.dispatchEvent(new CustomEvent('flux:look', { detail: look })); } catch (_) {}
    }
  };

  // Another tab changed it — follow along.
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) apply(e.newValue === 'classic' ? 'classic' : 'flat');
  });
})();
