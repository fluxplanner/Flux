/* ════════════════════════════════════════════════════════════════════════
   FLUX · Periodic Table — flux-ptable-atom3d.js
   ------------------------------------------------------------------------
   An atom you can turn round. Two models:

     Bohr       the shell diagram from the element panel, in three
                dimensions: a nucleus of Z protons and N neutrons, and each
                shell a ring of electrons in its own plane. "Flatten" lays
                every ring back into the textbook drawing.
     Orbitals   the shapes of one subshell's orbitals — the s sphere, the
                three p dumbbells, the five d shapes — as clouds of points
                where the electron is likely to be, each as bright as it is
                full.

   Drag to turn, scroll or pinch to zoom, double-click to reset. Plain canvas
   with its own perspective projection: no WebGL and no library, so it runs
   on any school computer. The geometry is pure and unit-tested.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.FluxAtom3D) return;

  const TAU = Math.PI * 2;
  const GOLD = Math.PI * (3 - Math.sqrt(5));

  /* ── Geometry (pure) ────────────────────────────────────────────────── */

  /**
   * A nucleus of A nucleons, Z of them protons: points filling a ball, with
   * the protons spread evenly through it. Positions are in nucleon radii
   * from the centre, so the ball's radius grows as ∛A — as real nuclei do.
   */
  function nucleus(Z, A) {
    const out = [];
    A = Math.max(1, Math.round(A));
    Z = Math.max(0, Math.min(A, Math.round(Z)));
    const R = A === 1 ? 0 : 1.05 * Math.cbrt(A);
    for (let k = 0; k < A; k++) {
      // Direction on a golden spiral; depth from a second, unrelated sequence.
      const y = A === 1 ? 0 : 1 - 2 * (k + 0.5) / A;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const th = k * GOLD;
      const f = ((k * 0.7548776662 + 0.35) % 1);
      const r = A === 1 ? 0 : R * Math.cbrt(0.12 + 0.88 * f);
      const proton = Math.floor((k + 1) * Z / A) > Math.floor(k * Z / A);
      out.push({ x: Math.cos(th) * ring * r, y: y * r, z: Math.sin(th) * ring * r, p: proton });
    }
    return out;
  }

  /** Electrons in each shell (n = 1, 2, …) from an occupancy map like { '1s': 2, '2s': 2, '2p': 2 }. */
  function shellCounts(occ) {
    const shells = [];
    Object.keys(occ || {}).forEach((k) => {
      const n = +k[0];
      if (!(n >= 1)) return;
      shells[n - 1] = (shells[n - 1] || 0) + occ[k];
    });
    for (let i = 0; i < shells.length; i++) if (!shells[i]) shells[i] = 0;
    return shells;
  }

  function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  /** Each shell's ring gets its own tilt, so the rings read as 3D and never lie on one another. */
  function ringNormal(i) {
    const a = 0.42 + 0.62 * ((i * 0.618034 + 0.2) % 1);
    const b = i * 2.39996 + 0.6;
    return norm([Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)]);
  }
  function basis(n) {
    const h = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = norm(cross(n, h));
    return [u, cross(n, u)];
  }

  /* Orbital shapes: the angular part of each hydrogen-like orbital, as a
     function of direction. [label, subscript, f(x, y, z) on the unit sphere]. */
  const ORBS = {
    s: [['s', '', () => 1]],
    p: [['p', 'x', (x) => x], ['p', 'y', (x, y) => y], ['p', 'z', (x, y, z) => z]],
    d: [['d', 'xy', (x, y) => x * y], ['d', 'xz', (x, y, z) => x * z], ['d', 'yz', (x, y, z) => y * z],
      ['d', 'x²−y²', (x, y) => (x * x - y * y) / 2], ['d', 'z²', (x, y, z) => (3 * z * z - 1) / 2]],
    f: [['f', 'z³', (x, y, z) => z * (5 * z * z - 3)], ['f', 'xz²', (x, y, z) => x * (5 * z * z - 1)], ['f', 'yz²', (x, y, z) => y * (5 * z * z - 1)],
      ['f', 'xyz', (x, y, z) => x * y * z], ['f', 'z(x²−y²)', (x, y, z) => z * (x * x - y * y)], ['f', 'x(x²−3y²)', (x, y) => x * (x * x - 3 * y * y)], ['f', 'y(3x²−y²)', (x, y) => y * (3 * x * x - y * y)]],
  };
  // Seeded, so the same orbital always draws the same cloud.
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  }
  /**
   * Points filling the orbital's familiar shape: the polar surface r = |f(direction)|,
   * the s sphere, the p dumbbell, the d clover. Filled evenly (a direction is
   * kept in proportion to the volume behind it), so every lobe reads as solid.
   * Returns [{ x, y, z, s }] with s the sign of the wave there (its phase),
   * inside a radius of 1.
   */
  function orbitalCloud(l, m, count, seed) {
    const f = ORBS['spdf'[l]][m][2];
    const rand = rng(seed || (l * 31 + m * 7 + 3));
    let fmax = 0;
    for (let i = 0; i < 3000; i++) {
      const u = dir(rand);
      fmax = Math.max(fmax, Math.abs(f(u[0], u[1], u[2])));
    }
    const out = [];
    let tries = 0;
    while (out.length < count && tries < count * 200) {
      tries++;
      const u = dir(rand);
      const v = f(u[0], u[1], u[2]);
      const a = Math.abs(v) / fmax;
      if (rand() > a * a * a) continue;
      const r = a * Math.cbrt(rand());
      out.push({ x: u[0] * r, y: u[1] * r, z: u[2] * r, s: v < 0 ? -1 : 1 });
    }
    return out;
  }
  function dir(rand) {
    const z = rand() * 2 - 1, t = rand() * TAU, q = Math.sqrt(1 - z * z);
    return [q * Math.cos(t), q * Math.sin(t), z];
  }
  /** Each orbital's name, as [letter, subscript]: ['p', 'x'], ['d', 'z²']. */
  function orbitalNames(l) { return ORBS['spdf'[l]].map((o) => [o[0], o[1]]); }

  /* ── Drawing ────────────────────────────────────────────────────────── */

  function shade(hex, k) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    const v = parseInt(m[1], 16);
    const ch = (s) => Math.max(0, Math.min(255, Math.round(((v >> s) & 255) * (1 + k))));
    return 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')';
  }
  /** A lit sphere, drawn once and scaled: far cheaper than a gradient per sphere per frame. */
  function sprite(colour, glow) {
    const S = 96, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const r = glow ? S * 0.22 : S * 0.48, cx = S / 2, cy = S / 2;
    if (glow) {
      const h = g.createRadialGradient(cx, cy, r * 0.8, cx, cy, S / 2);
      h.addColorStop(0, colour);
      h.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.45;
      g.fillStyle = h;
      g.fillRect(0, 0, S, S);
      g.globalAlpha = 1;
    }
    const grad = g.createRadialGradient(cx - r * 0.38, cy - r * 0.42, r * 0.08, cx, cy, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.28, colour);
    grad.addColorStop(1, shade(colour, -0.55));
    g.fillStyle = grad;
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.fill();
    return { img: c, frac: r / S };
  }

  const COL = { p: '#ff5d73', n: '#a9b6cc', e: '#38d4ff' };
  const ORB_COL = ['#38d4ff', '#ff8a4c', '#8b6cff', '#3ddc97', '#ffcf3d', '#ff5da8', '#5da0ff'];
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function reduced() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  function Viewer(canvas) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.yaw = -0.5;
    this.pitch = 0.32;
    this.zoom = 1;
    this.flat = 0;           // 0 = tilted rings, 1 = the flat textbook diagram (animated between)
    this.flatTarget = 0;
    this.spin = !reduced();
    this.play = !reduced();
    this.t = 0;
    this.mode = 'bohr';
    this.hl = -1;
    this.sprites = { p: sprite(COL.p), n: sprite(COL.n), e: sprite(COL.e, true) };
    this.data = null;
    this.running = false;
    this.pointers = new Map();
    this.wire();
    this.resize();
    if (window.ResizeObserver) {
      this.ro = new ResizeObserver(() => { this.resize(); this.draw(); });
      this.ro.observe(canvas);
    }
  }

  Viewer.prototype.resize = function () {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, this.cv.clientWidth), h = Math.max(1, this.cv.clientHeight);
    this.w = w;
    this.h = h;
    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(h * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  /** What to show: { Z, A, shells: [2, 8, …], ink }. */
  Viewer.prototype.set = function (d) {
    this.data = d;
    this.nuc = nucleus(d.Z, d.A);
    this.normals = d.shells.map((_, i) => ringNormal(i));
    this.draw();
    this.kick();
  };
  Viewer.prototype.setMode = function (m) { this.mode = m; this.draw(); this.kick(); };
  /** The subshell for the orbital model: { n, l, filled: electrons in each orbital }. */
  Viewer.prototype.setOrbital = function (o) { this.orbital = o; this.clouds = null; this.draw(); this.kick(); };
  Viewer.prototype.setFlat = function (on) {
    this.flatTarget = on ? 1 : 0;
    if (on) { this.yawGoal = 0; this.pitchGoal = 0; }
    this.kick();
  };
  Viewer.prototype.setSpin = function (on) { this.spin = !!on; this.kick(); };
  Viewer.prototype.setPlay = function (on) { this.play = !!on; this.kick(); };
  Viewer.prototype.reset = function () {
    this.yaw = -0.5; this.pitch = 0.32; this.zoom = 1; this.flatTarget = 0; this.yawGoal = null;
    this.draw();
    this.kick();
  };
  Viewer.prototype.highlight = function (i) { this.hl = i; this.draw(); };
  /** Draw only this orbital of the subshell (-1: all of them). */
  Viewer.prototype.setOnly = function (m) { this.only = m; this.draw(); };

  Viewer.prototype.animating = function () {
    return (this.spin && !this.dragging) || (this.play && this.mode === 'bohr') || Math.abs(this.flat - this.flatTarget) > 0.001 || this.yawGoal != null;
  };
  Viewer.prototype.kick = function () {
    if (this.running || this.stopped || !this.cv.isConnected) return;
    this.running = true;
    let last = performance.now();
    const step = (now) => {
      if (!this.cv.isConnected || this.stopped) { this.running = false; return; }
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (this.spin && !this.dragging && this.yawGoal == null) this.yaw += dt * 0.35;
      if (this.play && this.mode === 'bohr') this.t += dt;
      if (Math.abs(this.flat - this.flatTarget) > 0.001) this.flat += (this.flatTarget - this.flat) * Math.min(1, dt * 5);
      else this.flat = this.flatTarget;
      if (this.yawGoal != null) {
        // Turn to face the diagram square-on as it flattens.
        const wrap = Math.atan2(Math.sin(this.yawGoal - this.yaw), Math.cos(this.yawGoal - this.yaw));
        this.yaw += wrap * Math.min(1, dt * 5);
        this.pitch += (this.pitchGoal - this.pitch) * Math.min(1, dt * 5);
        if (Math.abs(wrap) < 0.002 && Math.abs(this.pitchGoal - this.pitch) < 0.002) { this.yawGoal = null; this.pitchGoal = null; }
      }
      this.draw();
      if (this.animating()) requestAnimationFrame(step);
      else this.running = false;
    };
    requestAnimationFrame(step);
  };
  Viewer.prototype.stop = function () { this.stopped = true; };
  Viewer.prototype.resume = function () { this.stopped = false; this.kick(); };
  Viewer.prototype.destroy = function () { this.stopped = true; if (this.ro) this.ro.disconnect(); };

  Viewer.prototype.wire = function () {
    const cv = this.cv;
    cv.addEventListener('pointerdown', (e) => {
      if (cv.setPointerCapture) { try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic event */ } }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.dragging = true;
      this.yawGoal = null;
    });
    cv.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      if (this.pointers.size === 2) {
        const a = [...this.pointers.values()];
        const before = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        p.x = e.clientX; p.y = e.clientY;
        const b = [...this.pointers.values()];
        const after = Math.hypot(b[0].x - b[1].x, b[0].y - b[1].y);
        if (before > 0) this.zoom = clamp(this.zoom * after / before, 0.55, 4.5);
      } else {
        this.yaw += (e.clientX - p.x) * 0.009;
        this.pitch = clamp(this.pitch + (e.clientY - p.y) * 0.009, -1.45, 1.45);
        p.x = e.clientX; p.y = e.clientY;
      }
      this.draw();
    });
    const up = (e) => {
      this.pointers.delete(e.pointerId);
      if (!this.pointers.size) { this.dragging = false; this.kick(); }
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom = clamp(this.zoom * Math.exp(-e.deltaY * 0.0015), 0.55, 4.5);
      this.draw();
    }, { passive: false });
    cv.addEventListener('dblclick', () => this.reset());
    cv.addEventListener('keydown', (e) => {
      const k = e.key;
      if (k === 'ArrowLeft') this.yaw -= 0.15;
      else if (k === 'ArrowRight') this.yaw += 0.15;
      else if (k === 'ArrowUp') this.pitch = clamp(this.pitch - 0.15, -1.45, 1.45);
      else if (k === 'ArrowDown') this.pitch = clamp(this.pitch + 0.15, -1.45, 1.45);
      else if (k === '+' || k === '=') this.zoom = clamp(this.zoom * 1.15, 0.55, 4.5);
      else if (k === '-') this.zoom = clamp(this.zoom / 1.15, 0.55, 4.5);
      else return;
      e.preventDefault();
      this.draw();
    });
  };

  /** Rotate a point by the view: yaw about y, then pitch about x. */
  Viewer.prototype.rot = function (x, y, z) {
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
    return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
  };

  Viewer.prototype.draw = function () {
    const g = this.g, d = this.data, W = this.w, H = this.h;
    g.clearRect(0, 0, W, H);
    if (!d) return;
    if (this.mode === 'orbitals') { this.drawOrbitals(); return; }
    const shells = d.shells;
    // Units of one nucleon radius. The nucleus is far too big to be true — the caption says so.
    const nr = 1.05 * Math.cbrt(Math.max(1, d.A));
    const gap = Math.max(2.2, 2.4 + nr * 0.14);
    const radii = shells.map((_, i) => nr + 2.4 + i * gap);
    const outer = radii.length ? radii[radii.length - 1] : nr + 2;
    const scale = Math.min(W, H) / 2 / (outer * 1.12) * this.zoom;
    const D = outer * 3.4, cx = W / 2, cy = H / 2;
    const proj = (p) => { const f = D / (D - p[2]); return [cx + p[0] * scale * f, cy - p[1] * scale * f, f, p[2]]; };
    const items = [];
    const ink = d.ink || '#eaf1ff';
    const flat = this.flat;
    shells.forEach((count, i) => {
      const nT = this.normals[i];
      const nV = norm([nT[0] * (1 - flat), nT[1] * (1 - flat), nT[2] * (1 - flat) + flat]);
      const B = basis(nV);
      // Flattened, every ring shares one frame, so it is the textbook drawing exactly.
      const U = flat > 0.5 ? [1, 0, 0] : B[0], V = flat > 0.5 ? [0, 1, 0] : B[1];
      const r = radii[i];
      const at = (a) => [r * (U[0] * Math.cos(a) + V[0] * Math.sin(a)), r * (U[1] * Math.cos(a) + V[1] * Math.sin(a)), r * (U[2] * Math.cos(a) + V[2] * Math.sin(a))];
      const hi = this.hl === i, dim = this.hl !== -1 && !hi;
      const SEG = 90;
      let prev = proj(this.rot.apply(this, at(0)));
      for (let s = 1; s <= SEG; s++) {
        const cur = proj(this.rot.apply(this, at(s / SEG * TAU)));
        items.push({ z: (prev[3] + cur[3]) / 2, k: 'seg', a: prev, b: cur, hi: hi, dim: dim });
        prev = cur;
      }
      const speed = 1.2 / Math.pow(i + 1, 1.35);
      for (let j = 0; j < count; j++) {
        const a = j / count * TAU + Math.PI / 2 - i * 0.35 - this.t * speed;
        const q = proj(this.rot.apply(this, at(a)));
        items.push({ z: q[3], k: 'e', p: q, dim: dim, small: count > 18 });
      }
    });
    const nucDim = this.hl !== -1 && this.hl !== 'nuc';
    this.nuc.forEach((n) => {
      const q = proj(this.rot(n.x, n.y, n.z));
      items.push({ z: q[3], k: n.p ? 'p' : 'n', p: q, dim: nucDim });
    });
    items.sort((a, b) => a.z - b.z);
    g.lineCap = 'round';
    items.forEach((it) => {
      if (it.k === 'seg') {
        g.strokeStyle = it.hi ? COL.e : ink;
        g.globalAlpha = (it.hi ? 0.95 : it.z > 0 ? 0.42 : 0.16) * (it.dim ? 0.35 : 1);
        g.lineWidth = it.hi ? 2.2 : 1.2;
        g.beginPath();
        g.moveTo(it.a[0], it.a[1]);
        g.lineTo(it.b[0], it.b[1]);
        g.stroke();
        return;
      }
      const sp = this.sprites[it.k];
      const rad = (it.k === 'e' ? (it.small ? 0.5 : 0.62) : 1) * scale * it.p[2];
      const size = rad / sp.frac;
      g.globalAlpha = it.dim ? 0.28 : 1;
      g.drawImage(sp.img, it.p[0] - size / 2, it.p[1] - size / 2, size, size);
    });
    g.globalAlpha = 1;
  };

  Viewer.prototype.drawOrbitals = function () {
    const g = this.g, W = this.w, H = this.h, o = this.orbital;
    if (!o) return;
    if (!this.clouds) {
      this.clouds = orbitalNames(o.l).map((nm, m) => ({
        name: nm, filled: (o.filled || [])[m] || 0,
        pts: orbitalCloud(o.l, m, o.l === 0 ? 1400 : o.l === 1 ? 1000 : 800, o.n * 101 + o.l * 17 + m + 1),
      }));
    }
    const scale = Math.min(W, H) / 2 / 1.25 * this.zoom;
    const D = 4.2, cx = W / 2, cy = H / 2;
    const ink = (this.data && this.data.ink) || '#eaf1ff';
    /* Chemists draw z up, y across and x coming out of the page, so the
       orbital's (x, y, z) goes to the screen's (y, z, x): d_z² stands upright. */
    const proj = (p) => { const r = this.rot(p[1], p[2], p[0]); const f = D / (D - r[2]); return [cx + r[0] * scale * f, cy - r[1] * scale * f, f, r[2]]; };
    // Faint axes, so each shape has something to point along.
    [[[-1.25, 0, 0], [1.25, 0, 0], 'x'], [[0, -1.25, 0], [0, 1.25, 0], 'y'], [[0, 0, -1.25], [0, 0, 1.25], 'z']].forEach((a) => {
      const p = proj(a[0]), q = proj(a[1]);
      g.strokeStyle = ink;
      g.globalAlpha = 0.25;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
      g.globalAlpha = 0.65;
      g.fillStyle = ink;
      g.font = '600 12px system-ui, sans-serif';
      g.fillText(a[2], q[0] + 4, q[1] - 4);
    });
    const pts = [];
    const pick = this.hl !== -1 ? this.hl : this.only != null ? this.only : -1;
    this.clouds.forEach((c, m) => {
      if (pick !== -1 && pick !== m) return;
      const col = ORB_COL[m % ORB_COL.length];
      // As bright as it is full: a pair, one electron, or empty.
      const alpha = c.filled === 2 ? 0.9 : c.filled === 1 ? 0.6 : 0.14;
      c.pts.forEach((p) => {
        const q = proj([p.x, p.y, p.z]);
        pts.push({ z: q[3], x: q[0], y: q[1], f: q[2], col: p.s < 0 ? shade(col, -0.4) : col, a: alpha });
      });
    });
    pts.sort((a, b) => a.z - b.z);
    pts.forEach((p) => {
      g.globalAlpha = p.a * (0.55 + 0.45 * clamp((p.z + 1.3) / 2.6, 0, 1));
      g.fillStyle = p.col;
      const s = 2.8 * p.f;
      g.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    });
    const c0 = proj([0, 0, 0]);
    g.globalAlpha = 1;
    g.fillStyle = COL.p;
    g.beginPath(); g.arc(c0[0], c0[1], 3, 0, TAU); g.fill();
  };

  window.FluxAtom3D = {
    create: (canvas) => new Viewer(canvas),
    nucleus: nucleus,
    shellCounts: shellCounts,
    orbitalCloud: orbitalCloud,
    orbitalNames: orbitalNames,
    COL: COL,
    ORB_COL: ORB_COL,
  };
})();
