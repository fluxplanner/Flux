/* ============================================================================
   FLUX PIXEL · LIVE  ·  flux-pixel-live.js
   Draw on the same page with other people, live, with no account.

   HOW IT WORKS
   ------------
     Share       makes a room: 24 random letters and digits. The link
                 pixel.html#/live/<room> is the only key, like a Google Docs
                 "anyone with the link can edit" link.
     Live edits  go over Supabase Realtime broadcast (topic pixel:<room>) as
                 small item-level changes: items added or changed, ids
                 removed, and the new order. Two people editing different
                 things never clash; on the same item the later change wins.
     Saved copy  public.flux_pixel_rooms, through pixel_room_get/put (the
                 table itself is closed to anon). Saved a moment after each
                 change, so a link opened when nobody else is online still
                 shows the drawing.
     Cursors     pointer moves (up to ~16 a second) as 'cur'; who is here
                 from 'here' heartbeats, forgotten after 40 seconds of quiet.

   The page stays free of the supabase library: the Realtime socket is the
   plain Phoenix protocol (join, heartbeat, broadcast) over a WebSocket, and
   saving is two fetches, the way flux-grapher-cloud.js talks to Supabase.
   ========================================================================== */
(function () {
  'use strict';

  // Read when used: flux-sb-config.js loads first on the page, not in the unit tests.
  function SB() { return window.FluxSB; }
  var ME_KEY = 'flux_pixel_me';
  var ROOM_RE = /^[A-Za-z0-9]{22,40}$/;
  // Realtime drops big messages; anything larger goes through the saved copy.
  var MAX_MSG = 180 * 1024;
  var PUT_DELAY = 900;
  var PEER_TTL = 40000;
  var COLORS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];
  var ADJ = ['Teal', 'Swift', 'Bright', 'Calm', 'Clever', 'Bold', 'Sunny', 'Quiet', 'Lucky', 'Brave'];
  var ANIMALS = ['Otter', 'Fox', 'Owl', 'Panda', 'Koala', 'Hawk', 'Lynx', 'Heron', 'Gecko', 'Badger'];

  // Ids arrive from other people's browsers: only plain short ids are
  // accepted, and every map keyed by them has no prototype, so a name like
  // __proto__ is just a key.
  var ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
  function okId(id) { return typeof id === 'string' && ID_RE.test(id); }
  function dict() { return Object.create(null); }

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function randId(n) {
    var abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var buf = new Uint32Array(n), out = '';
    window.crypto.getRandomValues(buf);
    for (var i = 0; i < n; i++) out += abc[buf[i] % abc.length];
    return out;
  }
  function newRoomId() { return randId(24); }
  function isRoom(s) { return ROOM_RE.test(String(s || '')); }
  function linkFor(room) { return location.origin + location.pathname + '#/live/' + room; }

  /** Who I am to the others: a stable id, a friendly name and a cursor colour. */
  function me() {
    var m = null;
    try { m = JSON.parse(localStorage.getItem(ME_KEY) || 'null'); } catch (e) {}
    if (!m || !m.id) {
      m = { id: randId(10), name: pick(ADJ) + ' ' + pick(ANIMALS), color: pick(COLORS) };
      try { localStorage.setItem(ME_KEY, JSON.stringify(m)); } catch (e) {}
    }
    return m;
  }
  function rename(name) {
    var m = me();
    m.name = String(name || '').trim().slice(0, 30) || m.name;
    try { localStorage.setItem(ME_KEY, JSON.stringify(m)); } catch (e) {}
    return m;
  }

  /* ── Item-level changes (pure, unit tested) ─────────────────────────── */

  function index(items) {
    var m = dict();
    items.forEach(function (it) { m[it.id] = JSON.stringify(it); });
    return m;
  }
  function sameOrder(a, b) { return a.length === b.length && a.every(function (x, i) { return x === b[i]; }); }

  /** What changed from base (id → JSON, plus its order) to items. */
  function diff(base, baseOrder, items) {
    var now = index(items), up = [], del = [];
    items.forEach(function (it) { if (base[it.id] !== now[it.id]) up.push(it); });
    Object.keys(base).forEach(function (id) { if (!(id in now)) del.push(id); });
    var order = items.map(function (it) { return it.id; });
    return { up: up, del: del, order: sameOrder(order, baseOrder) ? null : order };
  }
  function empty(ops) { return !ops.up.length && !ops.del.length && !ops.order && !ops.meta; }

  /** Apply changes to a list of items. Returns a new list. */
  function apply(items, ops) {
    var byId = dict(), gone = dict();
    (ops.del || []).forEach(function (id) { gone[id] = true; });
    var out = items.filter(function (it) { return !gone[it.id]; });
    out.forEach(function (it, i) { byId[it.id] = i; });
    (ops.up || []).forEach(function (it) {
      if (!it || !okId(it.id) || gone[it.id]) return;
      var copy = JSON.parse(JSON.stringify(it));
      if (it.id in byId) out[byId[it.id]] = copy;
      else { byId[it.id] = out.length; out.push(copy); }
    });
    if (ops.order) {
      var rank = dict();
      ops.order.forEach(function (id, i) { rank[id] = i; });
      // Items the sender had not seen yet keep their place, after the rest.
      out = out.map(function (it, i) { return [it, it.id in rank ? rank[it.id] : ops.order.length + i]; })
        .sort(function (a, b) { return a[1] - b[1]; }).map(function (p) { return p[0]; });
    }
    return out;
  }

  /**
   * Three-way merge after being apart (offline, or opening an old copy).
   * base: id → JSON as last agreed. A side that left an item as it was in
   * base gives way to the side that changed it; when both changed it, local
   * wins, since that is the person in front of this screen.
   */
  function merge3(base, local, server) {
    var L = index(local), S = index(server), seen = dict(), out = [];
    function decide(id) {
      var l = L[id], s = S[id], b = base[id];
      if (l === s) return l;
      if (l === undefined) return b !== undefined && b === s ? undefined : s;
      if (s === undefined) return b !== undefined && b === l ? undefined : l;
      return l === b ? s : l;
    }
    server.concat(local).forEach(function (it) {
      if (seen[it.id]) return;
      seen[it.id] = true;
      var v = decide(it.id);
      if (v !== undefined) out.push(JSON.parse(v));
    });
    return out;
  }

  /* ── Saved copy ─────────────────────────────────────────────────────── */

  function rpc(fn, body, keepalive) {
    return fetch(SB().url + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      keepalive: !!keepalive,
      headers: { apikey: SB().anon, Authorization: 'Bearer ' + SB().anon, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
  function fetchRoom(room) {
    if (!isRoom(room)) return Promise.resolve(null);
    return rpc('pixel_room_get', { p_id: room }).then(function (r) {
      if (!r.ok) throw new Error('Could not reach Flux. Check your connection.');
      return r.json();
    }).then(function (d) {
      if (!d || !Array.isArray(d.items)) return null;
      d.items = d.items.filter(function (it) { return it && typeof it === 'object' && okId(it.id); });
      return d;
    });
  }
  function shareable(doc) { return { title: doc.title, bg: doc.bg, items: doc.items, updated: Date.now() }; }
  function putRoom(room, doc, keepalive) {
    return rpc('pixel_room_put', { p_id: room, p_doc: shareable(doc) }, keepalive).then(function (r) {
      if (!r.ok) throw new Error(r.status === 413 || r.status === 400 ? 'This drawing is too big to share. Remove a picture and try again.' : 'Could not save the shared copy. It will try again with your next change.');
      return true;
    });
  }

  /* ── The Realtime socket ────────────────────────────────────────────── */

  function socket(room, onMsg, onStatus) {
    var topic = 'realtime:pixel:' + room;
    var ws = null, ref = 0, joinRef = null, beat = null, retry = 0, closed = false, joined = false;
    function send(obj) { if (ws && ws.readyState === 1) { ws.send(JSON.stringify(obj)); return true; } return false; }
    function open() {
      if (closed) return;
      try { ws = new WebSocket(SB().url.replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + SB().anon + '&vsn=1.0.0'); }
      catch (e) { return later(); }
      ws.onopen = function () {
        joinRef = String(++ref);
        send({ topic: topic, event: 'phx_join', ref: joinRef, join_ref: joinRef,
          payload: { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, private: false }, access_token: SB().anon } });
        clearInterval(beat);
        beat = setInterval(function () { send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) }); }, 25000);
      };
      ws.onmessage = function (e) {
        var m; try { m = JSON.parse(e.data); } catch (err) { return; }
        if (m.topic !== topic) return;
        if (m.event === 'phx_reply' && m.ref === joinRef) {
          if (m.payload && m.payload.status === 'ok') { joined = true; retry = 0; onStatus('live'); }
          else ws.close();
          return;
        }
        if (m.event === 'broadcast' && m.payload) onMsg(m.payload.event, m.payload.payload || {});
        if (m.event === 'phx_error' || m.event === 'phx_close') ws.close();
      };
      ws.onclose = function () { clearInterval(beat); joined = false; later(); };
      ws.onerror = function () { try { ws.close(); } catch (e) {} };
    }
    function later() {
      if (closed) return;
      onStatus('offline');
      setTimeout(open, Math.min(15000, 600 * Math.pow(2, retry++)));
    }
    open();
    return {
      broadcast: function (event, payload) {
        if (!joined) return false;
        return send({ topic: topic, event: 'broadcast', ref: String(++ref), join_ref: joinRef, payload: { type: 'broadcast', event: event, payload: payload } });
      },
      close: function () { closed = true; clearInterval(beat); joined = false; if (ws) try { ws.close(); } catch (e) {} },
    };
  }

  /* ── A live session for one open drawing ───────────────────────────── */

  /**
   * ctx: { room, doc() → the open doc, onRemote(ops) applies others' changes
   *        to the screen, onPeers(list, status), onError(text) }
   * The doc carries liveDirty: true while it holds changes the saved copy
   * has not had, so reopening it after a day offline merges instead of losing them.
   */
  function session(ctx) {
    var self = me();
    var base = dict(), baseOrder = [], baseMeta = {}, putTimer = null, peers = dict(), status = 'connecting';
    var curT = 0, curPending = null, curTimer = null, ready = false;

    function remember(items, meta) {
      base = index(items); baseOrder = items.map(function (it) { return it.id; });
      baseMeta = { title: meta.title, bg: meta.bg };
    }
    function peerList() { return Object.keys(peers).map(function (k) { return peers[k]; }); }
    function tell() { ctx.onPeers(peerList(), status); }
    function hello() { return { from: self.id, name: self.name, color: self.color }; }

    function save(then) {
      return putRoom(ctx.room, ctx.doc()).then(function () {
        ctx.doc().liveDirty = false;
        if (then) then();
      }, function (e) { ctx.onError(e.message); });
    }
    function schedulePut(then) {
      clearTimeout(putTimer);
      putTimer = setTimeout(function () { putTimer = null; save(then); }, PUT_DELAY);
    }

    /** Bring the saved copy in, merged with what is on this screen. */
    function sync(knownBase) {
      return fetchRoom(ctx.room).then(function (srv) {
        var d = ctx.doc();
        if (!srv) { remember(d.items, d); ready = true; return save(); }
        var items = merge3(knownBase, d.items, srv.items);
        var ops = diff(index(d.items), d.items.map(function (it) { return it.id; }), items);
        // A title or paper changed here while apart beats the saved one.
        if (!d.liveDirty) ops.meta = { title: srv.title, bg: srv.bg };
        ctx.onRemote(ops);
        remember(srv.items, srv);
        ready = true;
        // Anything still different from the saved copy was made here: send it.
        ctx.doc().liveDirty = false;
        changed();
      }).catch(function (e) {
        // No saved copy to start from: still draw together with whoever is here.
        if (!ready) { remember(ctx.doc().items, ctx.doc()); ready = true; }
        ctx.onError(e.message);
      });
    }

    var conn = socket(ctx.room, function (ev, p) {
      if (!p || !okId(p.from) || p.from === self.id) return;
      if (ev === 'ops') {
        if (!Array.isArray(p.up) || !Array.isArray(p.del)) return;
        var up = p.up.filter(function (it) { return it && typeof it === 'object' && okId(it.id); });
        var del = p.del.filter(okId);
        var order = Array.isArray(p.order) ? p.order.filter(okId) : null;
        ctx.onRemote({ up: up, del: del, order: order, meta: p.meta || null });
        // Only what they sent becomes agreed: a drag still under way here
        // must still count as a change of mine when it is let go.
        up.forEach(function (it) { base[it.id] = JSON.stringify(it); });
        del.forEach(function (id) { delete base[id]; });
        baseOrder = ctx.doc().items.map(function (it) { return it.id; });
        if (p.meta) baseMeta = { title: ctx.doc().title, bg: ctx.doc().bg };
      } else if (ev === 'refetch') {
        sync(base);
      } else if (ev === 'here' || ev === 'cur') {
        var known = peers[p.from];
        var peer = known || { id: p.from };
        if (p.name) peer.name = String(p.name).slice(0, 30);
        if (p.color && /^#[0-9a-f]{6}$/i.test(p.color)) peer.color = p.color;
        if (ev === 'cur' && isFinite(p.x) && isFinite(p.y)) { peer.x = +p.x; peer.y = +p.y; peer.moved = Date.now(); }
        peer.seen = Date.now();
        peers[p.from] = peer;
        // Someone new: say hello back, so they see me without waiting for my heartbeat.
        if (!known && ev === 'here') conn.broadcast('here', hello());
        tell();
      } else if (ev === 'bye') {
        delete peers[p.from]; tell();
      }
    }, function (s) {
      var was = status;
      status = s; tell();
      if (s === 'live') {
        conn.broadcast('here', hello());
        // Back after a gap: catch up on what was missed, and send what was made here.
        if (was === 'offline') sync(ready ? base : startBase);
      }
    });

    var hereT = setInterval(function () { conn.broadcast('here', hello()); }, 15000);
    var sweep = setInterval(function () {
      var now = Date.now(), gone = false;
      Object.keys(peers).forEach(function (k) { if (now - peers[k].seen > PEER_TTL) { delete peers[k]; gone = true; } });
      if (gone) tell();
    }, 5000);

    /** Call after every local change. Sends what changed now, saves a moment later. */
    function changed() {
      // Until the saved copy is in, sync() picks local changes up itself.
      if (!ready) return;
      var d = ctx.doc();
      var ops = diff(base, baseOrder, d.items);
      if (d.title !== baseMeta.title || d.bg !== baseMeta.bg) ops.meta = { title: d.title, bg: d.bg };
      if (empty(ops)) return;
      remember(d.items, d);
      d.liveDirty = true;
      ops.from = self.id;
      if (JSON.stringify(ops).length > MAX_MSG) {
        // A picture too big for one message: save it, then tell the others to fetch it.
        schedulePut(function () { conn.broadcast('refetch', { from: self.id }); });
      } else {
        conn.broadcast('ops', ops);
        schedulePut();
      }
    }

    function cursor(p) {
      curPending = p;
      if (curTimer) return;
      curTimer = setTimeout(function () {
        curTimer = null; curT = Date.now();
        conn.broadcast('cur', { from: self.id, name: self.name, color: self.color, x: Math.round(curPending[0]), y: Math.round(curPending[1]) });
      }, Math.max(0, 60 - (Date.now() - curT)));
    }

    // What the room holds decides, except for changes made here while apart.
    var d0 = ctx.doc();
    var startBase = d0.liveDirty ? dict() : index(d0.items);
    sync(startBase);

    return {
      changed: changed,
      cursor: cursor,
      peers: peerList,
      status: function () { return status; },
      me: function () { return self; },
      rename: function (name) { self = rename(name); conn.broadcast('here', hello()); return self; },
      close: function () {
        if (putTimer) { clearTimeout(putTimer); putRoom(ctx.room, ctx.doc(), true).catch(function () {}); }
        conn.broadcast('bye', { from: self.id });
        clearInterval(hereT); clearInterval(sweep); clearTimeout(curTimer);
        conn.close();
      },
    };
  }

  window.FluxPixelLive = {
    newRoomId: newRoomId, isRoom: isRoom, linkFor: linkFor, me: me,
    fetchRoom: fetchRoom, putRoom: putRoom, session: session,
    diff: diff, apply: apply, merge3: merge3, index: index,
  };
})();
