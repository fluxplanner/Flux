/* Frame guard — stops another website showing this page inside an invisible
   frame and tricking a signed-in person into clicking its buttons.

   GitHub Pages cannot send the header that normally does this job
   (frame-ancestors / X-Frame-Options), and a <meta> CSP is not allowed to carry
   it, so the page has to defend itself.

   Two steps, because the second can be blocked: a hostile page can frame us
   with sandbox="allow-scripts" and no "allow-top-navigation", and then the
   break-out below silently does nothing. Hiding the page first means that even
   then there is nothing on screen to click.

   Our own pages may frame each other (same origin), so that case is let through.

   Loaded first in <head>, as a plain blocking script, by every page that acts
   on a signed-in account. The free tools (grapher, calculator, periodic table…)
   deliberately do not load it: teachers embed those in their own course pages. */
(function () {
  if (window.top === window.self) return;
  try {
    if (window.top.location.origin === window.location.origin) return;
  } catch (_) { /* cross-origin parent: reading its location throws */ }
  document.documentElement.style.setProperty('display', 'none', 'important');
  try { window.top.location = window.self.location.href; } catch (_) { /* sandboxed */ }
})();
