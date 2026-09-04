/* ============================================================================
   FLUX · Owner → one person pop-up messages

   The owner could already broadcast a sign-in pop-up to everybody. This is the
   same pop-up addressed to a single account, backed by
   public.owner_direct_messages (see the migration of the same name).

   Two halves:

     · Recipient — on sign-in, ask for my unread messages, show them one at a
       time, and stamp read_at on each.
     · Owner — FluxOwnerMessages.send(), called by the card in Owner Controls.

   Not built on flux_threads/flux_messages, which already exist. That is a
   threaded chat rendered into a message list: it needs a thread to hang from,
   it puts the note in a conversation the recipient has to go and open, and it
   would mix owner announcements into student–counselor threads. This is a
   pop-up, which is what was asked for, so it gets a table shaped like one —
   title, body, read, no thread.

   read_at lives in the database rather than in localStorage like the
   broadcast's "seen signature". A per-device flag means the same message
   reappears on your phone after you read it on a laptop, and disappears
   forever if you clear your browser. A per-row timestamp is correct on both
   counts, and it also lets the owner see whether a message actually landed.

   Privacy is enforced by RLS, not here. This file could not read someone
   else's message even if it asked — which is the reason for a separate table
   rather than the world-readable platform_settings.

   Degrades quietly: with the migration unapplied the table is absent, the
   query errors, and everything below no-ops. It never blocks sign-in.
   ========================================================================== */
(function () {
  'use strict';
  if (window.FluxOwnerMessages) return;

  var TABLE = 'owner_direct_messages';
  var _checked = false;
  var _warned = false;

  function sb() {
    try { return typeof window.getSB === 'function' ? window.getSB() : null; }
    catch (e) { return null; }
  }
  function me() {
    try { return window.currentUser || null; } catch (e) { return null; }
  }

  /* The table may not exist yet, or may be unreachable. Neither deserves a
     console error on every sign-in — but swallowing it entirely is how the old
     broadcast refresh stayed broken without anyone noticing, so: once, quietly,
     and naming the likely cause. */
  function warnOnce(e) {
    if (_warned) return;
    _warned = true;
    console.warn('[Flux] direct messages unavailable — has the owner_direct_messages migration been applied?', e);
  }

  function markRead(id) {
    var c = sb();
    if (!c || !id) return;
    try {
      c.from(TABLE).update({ read_at: new Date().toISOString() }).eq('id', id)
        .then(function () {}, function () {});
    } catch (e) { /* a bookkeeping write must never break the pop-up */ }
  }

  /** Show one message, then the next once it is dismissed. */
  function showChain(rows, i) {
    if (i >= rows.length) return;
    if (typeof window.fluxShowSignInPopup !== 'function') return;
    var row = rows[i];

    /* Stamped as it is shown, not on dismiss: if the tab closes mid-read the
       message has still been delivered, and showing it again on the next
       device would be worse than losing the acknowledgement. */
    markRead(row.id);
    window.fluxShowSignInPopup({
      kind: 'MESSAGE FOR YOU',
      title: row.title || 'A message from Flux',
      body: row.body || '',
      onClose: function () { setTimeout(function () { showChain(rows, i + 1); }, 400); },
    });
  }

  /** Recipient side. Safe to call repeatedly; only the first call does work. */
  function checkInbox(force) {
    if (_checked && !force) return Promise.resolve(0);
    var c = sb(), u = me();
    /* Latch only once there is genuinely something to ask. Setting it before
       this check meant a call made before sign-in — which is most of them,
       since the client and the user arrive at different times — marked the
       inbox as checked and no later call ever ran. */
    if (!c || !u || !u.id) return Promise.resolve(0);
    _checked = true;

    return c.from(TABLE)
      .select('id,title,body,created_at')
      .eq('recipient_id', u.id)
      .is('read_at', null)
      .order('created_at', { ascending: true })
      .limit(5)
      .then(function (res) {
        if (res && res.error) { warnOnce(res.error); return 0; }
        var rows = (res && res.data) || [];
        if (!rows.length) return 0;
        // Let the sign-in render settle first — the same 900ms the broadcast uses.
        setTimeout(function () { showChain(rows, 0); }, 900);
        return rows.length;
      }, function (e) { warnOnce(e); return 0; });
  }

  /** Owner side. Resolves true only when the row actually landed. */
  function send(recipientId, title, body) {
    var c = sb(), u = me();
    if (!c) return Promise.resolve(false);
    var text = String(body || '').trim();
    if (!recipientId || !text) return Promise.resolve(false);
    return c.from(TABLE).insert({
      recipient_id: recipientId,
      title: String(title || '').trim() || 'A message from Flux',
      body: text,
      created_by: (u && u.email) || null,
    }).then(function (res) {
      if (res && res.error) { warnOnce(res.error); return false; }
      return true;
    }, function (e) { warnOnce(e); return false; });
  }

  /** Owner side: what has been sent, and whether it has been read yet. */
  function recent(limit) {
    var c = sb();
    if (!c) return Promise.resolve([]);
    return c.from(TABLE)
      .select('id,recipient_id,title,body,created_at,read_at')
      .order('created_at', { ascending: false })
      .limit(limit || 20)
      .then(function (res) {
        if (res && res.error) { warnOnce(res.error); return []; }
        return (res && res.data) || [];
      }, function () { return []; });
  }

  window.FluxOwnerMessages = {
    checkInbox: checkInbox,
    send: send,
    recent: recent,
    _table: TABLE,
  };

  /* Self-starting rather than relying on the call in app.js alone. That one
     sits in the cloud-sync success path, which does not run on every route in
     — offline, a failed sync, or the e2e harness — and a message that arrives
     only when sync happens to succeed is not a delivered message.
     checkInbox latches internally, so whichever fires first wins and the other
     is free. Polling stops as soon as it runs, or after ~20s if nobody ever
     signs in. */
  (function autostart() {
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      if (_checked || tries > 50) { clearInterval(t); return; }
      var u = me();
      if (!u || !u.id || !sb()) return;
      clearInterval(t);
      checkInbox();
    }, 400);
  })();
})();
