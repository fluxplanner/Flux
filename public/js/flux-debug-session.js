// #region agent log
(function () {
  var ep =
    "http://127.0.0.1:7650/ingest/92050576-10c4-4824-9c8e-cbeb99e15440";
  function send(payload) {
    payload.sessionId = "204e89";
    payload.timestamp = Date.now();
    fetch(ep, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "204e89",
      },
      body: JSON.stringify(payload),
    }).catch(function () {});
  }
  window.addEventListener(
    "error",
    function (e) {
      send({
        location: "flux-debug-session.js:window.error",
        message: "window error",
        hypothesisId: "H2",
        data: {
          msg: String(e.message || ""),
          file: String(e.filename || ""),
          line: e.lineno,
          col: e.colno,
        },
      });
    },
    true,
  );
  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    send({
      location: "flux-debug-session.js:unhandledrejection",
      message: "unhandled rejection",
      hypothesisId: "H4",
      data: {
        reason: r && r.message ? String(r.message) : String(r),
      },
    });
  });
  window.addEventListener("load", function () {
    var app = document.getElementById("app");
    var ls = document.getElementById("loginScreen");
    var sp = document.getElementById("splash");
    var ob = document.getElementById("onboarding");
    send({
      location: "flux-debug-session.js:load",
      message: "static shell visibility snapshot",
      hypothesisId: "H1",
      data: {
        appHasVisible: !!(app && app.classList.contains("visible")),
        loginDisplay: ls ? ls.style.display : null,
        loginHasVisible: !!(ls && ls.classList.contains("visible")),
        splashDisplay: sp ? sp.style.display : null,
        onboardingHasVisible: !!(ob && ob.classList.contains("visible")),
        href: String(location.href || "").slice(0, 200),
      },
    });
  });
})();
// #endregion
