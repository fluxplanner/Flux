/* ============================================================================
   FLUX TEACH · SCIENCES  ·  flux-teach-sciences.js
   Step-by-step lessons for IB Physics, Chemistry, Biology and ESS (guides first
   assessed 2025/2026). Problems are generated and their answers computed, so
   they are right by construction (flux-teach-core.js).

   Constants are the IB data booklet's: g = 9.8 m s^−2, h = 6.63×10^−34 J s,
   c = 3.00×10^8 m s^−1, e = 1.60×10^−19 C, R = 8.31 J K^−1 mol^−1,
   N_A = 6.02×10^23 mol^−1, molar volume at STP 22.7 dm^3 mol^−1.
   ========================================================================== */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var T = root.FluxTeach, IB = root.FluxIbSyllabus;
  if (!T || !IB || root.__fluxTeachSci) return;
  root.__fluxTeachSci = true;

  var N = T.num, F = T.frac, S = T.show;
  function U(sid, code) {
    var s = IB.subjects().filter(function (x) { return x.id === sid; })[0];
    var u = s && s.units.filter(function (x) { return x.code === code || x.title.indexOf(code) === 0; })[0];
    if (!u) throw new Error('No unit "' + code + '" in ' + sid);
    return u.id;
  }
  var PH = function (c) { return U('physics', c); };
  var CH = function (c) { return U('chemistry', c); };
  var BI = function (c) { return U('biology', c); };
  var ES = function (c) { return U('ess', c); };
  function m(x) { return String(x).replace(/^-/, '−'); }
  function b(x) { return x < 0 ? '(' + m(x) + ')' : String(x); }
  var DEG = Math.PI / 180;
  var g = 9.8, h = 6.63e-34, c = 3.00e8, e = 1.60e-19, R = 8.31, NA = 6.02e23, kB = 1.38e-23, G = 6.67e-11, kC = 8.99e9, sigma = 5.67e-8, me = 9.11e-31;

  var skills = [];
  function add(s) { skills.push(s); }

  /* ════════════════════════ PHYSICS ════════════════════════ */

  add({ id: 'p-suvat', units: [PH('A.1')], title: 'Kinematics: the suvat equations',
    method: ['List what you know and what you want from s (displacement), u (initial velocity), v (final velocity), a (acceleration), t (time).', 'Pick the equation without the one quantity you neither know nor want: v = u + at; s = ut + ½at^{2}; v^{2} = u^{2} + 2as; s = ½(u + v)t.', 'Only for constant acceleration. Choose a positive direction and keep signs consistent (up positive → a = −9.8 m s^{−2} in free fall).'],
    variants: [
      { id: 'v', name: 'Final velocity (v = u + at)', gen: function (r) {
        var u = r.int(0, 20), a = r.nz(-4, 6), t = r.int(2, 12), v = u + a * t;
        return { q: 'A car moving at ' + u + ' m s^{−1} accelerates at ' + m(a) + ' m s^{−2} for ' + t + ' s. Find its final velocity.', answer: v, unit: 'm s^{−1}',
          steps: ['Know u, a, t; want v; s is not involved: v = u + at.', 'v = ' + u + ' + ' + b(a) + ' × ' + t + '.', 'v = ' + m(v) + ' m s^{−1}.'] };
      } },
      { id: 's', name: 'Displacement (s = ut + ½at²)', gen: function (r) {
        var u = r.int(0, 15), a = r.int(1, 6), t = r.int(2, 10), s = u * t + 0.5 * a * t * t;
        return { q: 'An object starts at ' + u + ' m s^{−1} and accelerates uniformly at ' + a + ' m s^{−2}. How far does it travel in ' + t + ' s?', answer: s, unit: 'm',
          steps: ['Know u, a, t; want s; v not given: s = ut + ½at^{2}.', 's = ' + u + ' × ' + t + ' + ½ × ' + a + ' × ' + t + '^{2}.', 's = ' + S(u * t) + ' + ' + S(0.5 * a * t * t) + ' = ' + S(s) + ' m.'] };
      } },
      { id: 'v2', name: 'Speed after a distance (v² = u² + 2as)', gen: function (r) {
        var u = r.int(0, 12), a = r.int(1, 5), s = r.int(5, 80), v = Math.sqrt(u * u + 2 * a * s);
        return { q: 'A cyclist at ' + u + ' m s^{−1} accelerates at ' + a + ' m s^{−2} over ' + s + ' m. Find the final speed.', answer: v, sf: 3, unit: 'm s^{−1}',
          steps: ['No time given or wanted: v^{2} = u^{2} + 2as.', 'v^{2} = ' + u + '^{2} + 2 × ' + a + ' × ' + s + ' = ' + (u * u + 2 * a * s) + '.', 'v = √' + (u * u + 2 * a * s) + ' = ' + N(v, 3) + ' m s^{−1}.'] };
      } },
      { id: 'brake', name: 'Braking distance', gen: function (r) {
        var u = r.int(8, 35), a = r.int(3, 8), s = u * u / (2 * a);
        return { q: 'A car at ' + u + ' m s^{−1} brakes with a deceleration of ' + a + ' m s^{−2}. Find its stopping distance.', answer: s, sf: 3, unit: 'm',
          steps: ['v = 0 (it stops) and a = −' + a + ' m s^{−2}. No time: v^{2} = u^{2} + 2as.', '0 = ' + u + '^{2} + 2 × (−' + a + ') × s, so s = ' + u * u + ' ÷ ' + 2 * a + '.', 's = ' + N(s, 3) + ' m.'] };
      } },
      { id: 'fall', name: 'Free fall: time to fall', gen: function (r) {
        var H = r.int(2, 80), t = Math.sqrt(2 * H / g);
        return { q: 'A stone is dropped from rest from a height of ' + H + ' m. How long does it take to reach the ground? (g = 9.8 m s^{−2}, no air resistance)', answer: t, sf: 3, unit: 's',
          steps: ['u = 0, a = 9.8 m s^{−2} (down positive), s = ' + H + ' m. Want t: s = ut + ½at^{2}.', H + ' = ½ × 9.8 × t^{2}, so t^{2} = ' + S(2 * H / g, 4) + '.', 't = ' + N(t, 3) + ' s.'] };
      } },
      { id: 'up', name: 'Thrown upwards: maximum height', gen: function (r) {
        var u = r.int(5, 30), H = u * u / (2 * g);
        return { q: 'A ball is thrown vertically upwards at ' + u + ' m s^{−1}. Find the maximum height it reaches.', answer: H, sf: 3, unit: 'm',
          steps: ['At the top v = 0. Up positive: a = −9.8 m s^{−2}.', 'v^{2} = u^{2} + 2as: 0 = ' + u * u + ' − 2 × 9.8 × s.', 's = ' + u * u + ' ÷ 19.6 = ' + N(H, 3) + ' m.'] };
      } },
    ] });

  add({ id: 'p-proj', units: [PH('A.1')], title: 'Projectile motion',
    method: ['Split the motion: horizontally the velocity is constant (no air resistance); vertically it is free fall at 9.8 m s^{−2}.', 'Resolve a launch at θ: u_{x} = u cos θ, u_{y} = u sin θ.', 'The time comes from the vertical motion; use it in the horizontal: range = u_{x} × t.'],
    variants: [
      { id: 'hTime', name: 'Horizontal launch: time of flight', gen: function (r) {
        var H = r.int(2, 60), u = r.int(3, 25), t = Math.sqrt(2 * H / g);
        return { q: 'A ball rolls off a ' + H + ' m high cliff at ' + u + ' m s^{−1} horizontally. How long is it in the air?', answer: t, sf: 3, unit: 's',
          steps: ['Vertically: u_{y} = 0, a = 9.8 m s^{−2}, s = ' + H + ' m. (The horizontal speed does not change the time.)', H + ' = ½ × 9.8 × t^{2}.', 't = √(' + 2 * H + ' ÷ 9.8) = ' + N(t, 3) + ' s.'] };
      } },
      { id: 'hRange', name: 'Horizontal launch: range', gen: function (r) {
        var H = r.int(2, 60), u = r.int(3, 25), t = Math.sqrt(2 * H / g);
        return { q: 'A ball is thrown horizontally at ' + u + ' m s^{−1} from a height of ' + H + ' m. How far from the base does it land?', answer: u * t, sf: 3, unit: 'm',
          steps: ['Time from the vertical motion: ' + H + ' = ½ × 9.8 × t^{2}, t = ' + S(t, 4) + ' s.', 'The horizontal speed stays ' + u + ' m s^{−1}.', 'Range = ' + u + ' × ' + S(t, 4) + ' = ' + N(u * t, 3) + ' m.'] };
      } },
      { id: 'aMax', name: 'Angled launch: maximum height', gen: function (r) {
        var u = r.int(10, 40), th = r.int(20, 70), uy = u * Math.sin(th * DEG), H = uy * uy / (2 * g);
        return { q: 'A projectile is launched at ' + u + ' m s^{−1} at ' + th + '° above the horizontal from level ground. Find its maximum height.', answer: H, sf: 3, unit: 'm',
          steps: ['u_{y} = ' + u + ' sin ' + th + '° = ' + S(uy, 4) + ' m s^{−1}.', 'At the top v_{y} = 0: 0 = u_{y}^{2} − 2 × 9.8 × H.', 'H = ' + S(uy, 4) + '^{2} ÷ 19.6 = ' + N(H, 3) + ' m.'] };
      } },
      { id: 'aRange', name: 'Angled launch: range on level ground', gen: function (r) {
        var u = r.int(10, 40), th = r.int(15, 75), ux = u * Math.cos(th * DEG), uy = u * Math.sin(th * DEG), t = 2 * uy / g;
        return { q: 'A ball is kicked at ' + u + ' m s^{−1} at ' + th + '° to the horizontal and lands at the same height. Find its range.', answer: ux * t, sf: 3, unit: 'm',
          steps: ['u_{x} = ' + u + ' cos ' + th + '° = ' + S(ux, 4) + '; u_{y} = ' + u + ' sin ' + th + '° = ' + S(uy, 4) + ' m s^{−1}.', 'It is back at ground level when t = 2u_{y}/g = ' + S(t, 4) + ' s.', 'Range = u_{x}t = ' + N(ux * t, 3) + ' m.'] };
      } },
    ] });

  add({ id: 'p-forces', units: [PH('A.2')], title: 'Forces, Newton’s laws and circular motion',
    method: ['Draw a free-body diagram: weight mg down, normal force, tension, friction, drag, applied forces.', 'Newton’s second law *F_{net} = ma*: add the forces along the motion, with signs.', 'Sliding friction F_{f} = μ_{d}F_{N}. On a slope of angle θ, the weight component down the slope is mg sin θ and into it mg cos θ.', 'Circular motion: a = v^{2}/r = ω^{2}r towards the centre, so F = mv^{2}/r; ω = 2π/T.'],
    variants: [
      { id: 'fma', name: 'Acceleration from forces', gen: function (r) {
        var mm = r.int(2, 50), F = r.int(20, 300), fr = r.int(0, Math.floor(F * 0.7)), a = (F - fr) / mm;
        return { q: 'A ' + mm + ' kg box is pushed with ' + F + ' N against a friction force of ' + fr + ' N. Find its acceleration.', answer: a, sf: 3, unit: 'm s^{−2}',
          steps: ['Net force = ' + F + ' − ' + fr + ' = ' + (F - fr) + ' N.', 'F_{net} = ma, so a = F_{net}/m.', 'a = ' + (F - fr) + ' ÷ ' + mm + ' = ' + N(a, 3) + ' m s^{−2}.'] };
      } },
      { id: 'mu', name: 'Sliding friction', gen: function (r) {
        var mm = r.int(2, 40), mu = r.int(10, 60) / 100, fr = mu * mm * g, F = Math.ceil(fr) + r.int(5, 150), a = (F - fr) / mm;
        return { q: 'A ' + mm + ' kg crate is pulled horizontally with ' + F + ' N. The coefficient of dynamic friction is ' + mu + '. Find its acceleration.', answer: a, sf: 3, unit: 'm s^{−2}',
          steps: ['Normal force F_{N} = mg = ' + mm + ' × 9.8 = ' + S(mm * g, 4) + ' N.', 'Friction = μF_{N} = ' + mu + ' × ' + S(mm * g, 4) + ' = ' + S(fr, 4) + ' N.', 'a = (' + F + ' − ' + S(fr, 4) + ') ÷ ' + mm + ' = ' + N(a, 3) + ' m s^{−2}.'] };
      } },
      { id: 'slope', name: 'Sliding down a slope', gen: function (r) {
        var th = r.int(15, 50), mu = r.int(0, 30) / 100, a = g * (Math.sin(th * DEG) - mu * Math.cos(th * DEG));
        if (a <= 0.1) return null;
        return { q: 'A block slides down a slope at ' + th + '° to the horizontal' + (mu ? ' with coefficient of friction ' + mu : ' with no friction') + '. Find its acceleration.', answer: a, sf: 3, unit: 'm s^{−2}',
          steps: ['Down the slope: mg sin ' + th + '°. ' + (mu ? 'Friction up the slope: μmg cos ' + th + '°.' : 'No friction.'), 'ma = mg sin θ' + (mu ? ' − μmg cos θ, so a = g(sin θ − μ cos θ).' : ', so a = g sin θ.'), 'a = 9.8 × (' + S(Math.sin(th * DEG), 4) + (mu ? ' − ' + mu + ' × ' + S(Math.cos(th * DEG), 4) : '') + ') = ' + N(a, 3) + ' m s^{−2}.'] };
      } },
      { id: 'lift', name: 'Lift (elevator) forces', gen: function (r) {
        var mm = r.int(40, 90), a = r.nz(-3, 3), Fn = mm * (g + a);
        return { q: 'A ' + mm + ' kg person stands in a lift accelerating ' + (a > 0 ? 'upwards' : 'downwards') + ' at ' + Math.abs(a) + ' m s^{−2}. Find the normal force from the floor.', answer: Fn, sf: 3, unit: 'N',
          steps: ['Up positive: F_{N} − mg = ma.', 'F_{N} = m(g + a) = ' + mm + ' × (9.8 + ' + b(a) + ').', 'F_{N} = ' + N(Fn, 3) + ' N' + (a > 0 ? ': they feel heavier.' : ': they feel lighter.')] };
      } },
      { id: 'circ', name: 'Centripetal force', gen: function (r) {
        var mm = r.int(1, 1500), v = r.int(2, 30), rad = r.int(2, 80), F = mm * v * v / rad;
        return { q: 'A ' + mm + ' kg object moves at ' + v + ' m s^{−1} in a circle of radius ' + rad + ' m. Find the centripetal force.', answer: F, sf: 3, unit: 'N',
          steps: ['a = v^{2}/r = ' + v * v + ' ÷ ' + rad + ' = ' + S(v * v / rad, 4) + ' m s^{−2}, towards the centre.', 'F = ma = mv^{2}/r.', 'F = ' + mm + ' × ' + S(v * v / rad, 4) + ' = ' + N(F, 3) + ' N.'] };
      } },
      { id: 'omega', name: 'Angular speed and period', gen: function (r) {
        var Tp = r.int(2, 60) / 2, rad = r.int(1, 20), w = 2 * Math.PI / Tp, v = w * rad;
        return { q: 'An object goes round a circle of radius ' + rad + ' m once every ' + Tp + ' s. Find its speed.', answer: v, sf: 3, unit: 'm s^{−1}',
          steps: ['ω = 2π/T = 2π ÷ ' + Tp + ' = ' + S(w, 4) + ' rad s^{−1}.', 'v = ωr.', 'v = ' + S(w, 4) + ' × ' + rad + ' = ' + N(v, 3) + ' m s^{−1}.'] };
      } },
    ] });

  add({ id: 'p-momentum', units: [PH('A.2')], title: 'Momentum and impulse',
    method: ['Momentum p = mv is a vector: direction matters.', 'With no external force, total momentum before = total momentum after (collisions and explosions).', 'Impulse = FΔt = Δp: the area under a force–time graph.', 'Elastic collisions keep kinetic energy; inelastic ones lose some.'],
    variants: [
      { id: 'stick', name: 'Collision: they stick together', gen: function (r) {
        var m1 = r.int(1, 20), m2 = r.int(1, 20), u1 = r.int(2, 15), u2 = r.int(-10, 5), v = (m1 * u1 + m2 * u2) / (m1 + m2);
        if (m1 * u1 + m2 * u2 === 0) return null;
        return { q: 'A ' + m1 + ' kg trolley at ' + u1 + ' m s^{−1} hits a ' + m2 + ' kg trolley moving at ' + m(u2) + ' m s^{−1} (same line, + to the right). They stick. Find their common velocity.', answer: v, sf: 3, unit: 'm s^{−1}',
          steps: ['Momentum before = ' + m1 + ' × ' + u1 + ' + ' + m2 + ' × ' + b(u2) + ' = ' + m(m1 * u1 + m2 * u2) + ' kg m s^{−1}.', 'After: (' + m1 + ' + ' + m2 + ')v = ' + (m1 + m2) + 'v.', 'v = ' + m(m1 * u1 + m2 * u2) + ' ÷ ' + (m1 + m2) + ' = ' + N(v, 3) + ' m s^{−1}.'] };
      } },
      { id: 'recoil', name: 'Explosion and recoil', gen: function (r) {
        var M = r.int(2, 8), mg2 = r.int(5, 50), v = r.int(200, 900), V = mg2 / 1000 * v / M;
        return { q: 'A ' + M + ' kg gun fires a ' + mg2 + ' g bullet at ' + v + ' m s^{−1}. Find the gun’s recoil speed.', answer: V, sf: 3, unit: 'm s^{−1}',
          steps: ['Before firing the total momentum is 0.', 'After: ' + mg2 / 1000 + ' × ' + v + ' + ' + M + ' × V = 0 (mass in kg!).', 'V = ' + S(mg2 / 1000 * v, 4) + ' ÷ ' + M + ' = ' + N(V, 3) + ' m s^{−1}, backwards.'] };
      } },
      { id: 'impulse', name: 'Impulse and force', gen: function (r) {
        var mm = r.int(1, 10) / 10, u = r.int(5, 30), v = -r.int(2, 20), tms = r.int(5, 50), F = mm * (v - u) / (tms / 1000);
        return { q: 'A ' + mm + ' kg ball hits a wall at ' + u + ' m s^{−1} and rebounds at ' + (-v) + ' m s^{−1}. Contact lasts ' + tms + ' ms. Find the size of the average force on the ball.', answer: Math.abs(F), sf: 3, unit: 'N',
          steps: ['Towards the wall +: Δp = m(v − u) = ' + mm + ' × (' + m(v) + ' − ' + u + ') = ' + m(S(mm * (v - u), 4)) + ' kg m s^{−1}.', 'F = Δp/Δt = ' + m(S(mm * (v - u), 4)) + ' ÷ ' + tms / 1000 + '.', '|F| = ' + N(Math.abs(F), 3) + ' N, away from the wall.'] };
      } },
      { id: 'elastic', name: 'Kinetic energy lost', gen: function (r) {
        var m1 = r.int(1, 10), m2 = r.int(1, 10), u1 = r.int(2, 12), v = m1 * u1 / (m1 + m2), lost = 0.5 * m1 * u1 * u1 - 0.5 * (m1 + m2) * v * v;
        return { q: 'A ' + m1 + ' kg ball at ' + u1 + ' m s^{−1} hits a stationary ' + m2 + ' kg ball and they stick together. How much kinetic energy is lost?', answer: lost, sf: 3, unit: 'J',
          steps: ['Common velocity: v = ' + m1 * u1 + ' ÷ ' + (m1 + m2) + ' = ' + S(v, 4) + ' m s^{−1}.', 'KE before ½ × ' + m1 + ' × ' + u1 + '^{2} = ' + S(0.5 * m1 * u1 * u1, 4) + ' J; after ½ × ' + (m1 + m2) + ' × ' + S(v, 4) + '^{2} = ' + S(0.5 * (m1 + m2) * v * v, 4) + ' J.', 'Lost: ' + N(lost, 3) + ' J (inelastic).'] };
      } },
    ] });

  add({ id: 'p-energy', units: [PH('A.3')], title: 'Work, energy and power',
    method: ['Work W = Fs cos θ (θ between the force and the displacement).', 'E_{k} = ½mv^{2}; ΔE_{p} = mgΔh; elastic E = ½kx^{2}.', 'Energy is conserved: E_{p} lost = E_{k} gained when nothing is wasted.', 'Power P = W/t = Fv. Efficiency = useful output ÷ total input.'],
    variants: [
      { id: 'drop', name: 'Speed after falling', gen: function (r) {
        var H = r.int(1, 50), v = Math.sqrt(2 * g * H);
        return { q: 'An object falls from rest through ' + H + ' m. Ignoring air resistance, find its speed.', answer: v, sf: 3, unit: 'm s^{−1}',
          steps: ['E_{p} lost = E_{k} gained: mgh = ½mv^{2}, and the mass cancels.', 'v = √(2gh) = √(2 × 9.8 × ' + H + ').', 'v = ' + N(v, 3) + ' m s^{−1}.'] };
      } },
      { id: 'work', name: 'Work at an angle', gen: function (r) {
        var F = r.int(10, 200), s = r.int(2, 50), th = r.int(0, 60), W = F * s * Math.cos(th * DEG);
        return { q: 'A sledge is pulled ' + s + ' m by a rope with tension ' + F + ' N at ' + th + '° to the horizontal. Find the work done.', answer: W, sf: 3, unit: 'J',
          steps: ['Only the component along the motion does work: W = Fs cos θ.', 'W = ' + F + ' × ' + s + ' × cos ' + th + '°.', 'W = ' + N(W, 3) + ' J.'] };
      } },
      { id: 'power', name: 'Power', gen: function (r) {
        var mm = r.int(40, 900), H = r.int(2, 30), t = r.int(2, 60), P = mm * g * H / t;
        return { q: 'A motor lifts ' + mm + ' kg through ' + H + ' m in ' + t + ' s at steady speed. Find the useful power.', answer: P, sf: 3, unit: 'W',
          steps: ['Work = mgh = ' + mm + ' × 9.8 × ' + H + ' = ' + S(mm * g * H, 5) + ' J.', 'P = W/t.', 'P = ' + S(mm * g * H, 5) + ' ÷ ' + t + ' = ' + N(P, 3) + ' W.'] };
      } },
      { id: 'eff', name: 'Efficiency', gen: function (r) {
        var inp = r.int(100, 5000), eff = r.int(15, 95), out = inp * eff / 100;
        if (r.next() < 0.5) return { q: 'A machine takes in ' + inp + ' J and does ' + S(out) + ' J of useful work. Find its efficiency as a percentage.', answer: eff, unit: '%',
          steps: ['Efficiency = useful output ÷ total input.', '= ' + S(out) + ' ÷ ' + inp + ' = ' + eff / 100 + '.', '= ' + eff + '%.'] };
        return { q: 'A motor is ' + eff + '% efficient. How much useful energy does it give from ' + inp + ' J?', answer: out, unit: 'J',
          steps: ['Useful output = efficiency × input.', '= ' + eff / 100 + ' × ' + inp + '.', '= ' + S(out) + ' J.'] };
      } },
      { id: 'spring', name: 'Elastic potential energy', gen: function (r) {
        var k = r.int(20, 800), xc = r.int(1, 30), E = 0.5 * k * (xc / 100) * (xc / 100);
        return { q: 'A spring of stiffness ' + k + ' N m^{−1} is stretched by ' + xc + ' cm. Find the elastic potential energy stored.', answer: E, sf: 3, unit: 'J',
          steps: ['E = ½kx^{2}, x in metres: ' + xc / 100 + ' m.', 'E = ½ × ' + k + ' × ' + xc / 100 + '^{2}.', 'E = ' + N(E, 3) + ' J.'] };
      } },
      { id: 'fv', name: 'Power at constant speed (P = Fv)', gen: function (r) {
        var F = r.int(200, 4000), v = r.int(5, 35);
        return { q: 'A car travels at a steady ' + v + ' m s^{−1} against total resistive forces of ' + F + ' N. Find the power output of the engine.', answer: F * v, unit: 'W',
          steps: ['Steady speed: driving force = resistive forces = ' + F + ' N.', 'P = Fv.', 'P = ' + F + ' × ' + v + ' = ' + F * v + ' W.'] };
      } },
    ] });

  add({ id: 'p-rigid', units: [PH('A.4')], title: 'Rigid bodies: torque and rotation',
    method: ['Torque τ = Fr sin θ (θ between the force and the line to the pivot).', 'In rotational equilibrium the clockwise and anticlockwise torques balance.', 'Rotational analogues: τ = Iα, L = Iω, E_{k} = ½Iω^{2}; angular momentum is conserved with no external torque.'],
    variants: [
      { id: 'torque', name: 'Torque', gen: function (r) {
        var F = r.int(5, 200), rr = r.int(10, 120) / 100, th = r.pick([90, 60, 45, 30]), tau = F * rr * Math.sin(th * DEG);
        return { q: 'A ' + F + ' N force acts ' + rr + ' m from a pivot at ' + th + '° to the lever. Find the torque.', answer: tau, sf: 3, unit: 'N m',
          steps: ['τ = Fr sin θ.', 'τ = ' + F + ' × ' + rr + ' × sin ' + th + '°.', 'τ = ' + N(tau, 3) + ' N m.'] };
      } },
      { id: 'balance', name: 'Balancing a seesaw', gen: function (r) {
        var m1 = r.int(20, 70), d1 = r.int(5, 20) / 10, m2 = r.int(20, 70), d2 = m1 * d1 / m2;
        if (d2 > 3) return null;
        return { q: 'A ' + m1 + ' kg child sits ' + d1 + ' m from the pivot of a seesaw. How far from the pivot must a ' + m2 + ' kg child sit to balance it?', answer: d2, sf: 3, unit: 'm',
          steps: ['Balanced: clockwise torque = anticlockwise torque.', m1 + 'g × ' + d1 + ' = ' + m2 + 'g × d (g cancels).', 'd = ' + S(m1 * d1, 4) + ' ÷ ' + m2 + ' = ' + N(d2, 3) + ' m.'] };
      } },
      { id: 'angmom', name: 'Conservation of angular momentum', gen: function (r) {
        var I1 = r.int(20, 80) / 10, w1 = r.int(2, 10), I2 = r.int(5, Math.floor(I1 * 10) - 1) / 10, w2 = I1 * w1 / I2;
        return { q: 'A skater with moment of inertia ' + I1 + ' kg m^{2} spins at ' + w1 + ' rad s^{−1}, then pulls in her arms to ' + I2 + ' kg m^{2}. Find her new angular speed.', answer: w2, sf: 3, unit: 'rad s^{−1}',
          steps: ['No external torque: L = Iω is conserved.', I1 + ' × ' + w1 + ' = ' + I2 + ' × ω.', 'ω = ' + N(w2, 3) + ' rad s^{−1}.'] };
      } },
      { id: 'rotke', name: 'Rotational kinetic energy', gen: function (r) {
        var M = r.int(1, 20), rr = r.int(10, 60) / 100, w = r.int(2, 40), I = 0.5 * M * rr * rr, E = 0.5 * I * w * w;
        return { q: 'A solid disc (I = ½MR^{2}) of mass ' + M + ' kg and radius ' + rr + ' m spins at ' + w + ' rad s^{−1}. Find its rotational kinetic energy.', answer: E, sf: 3, unit: 'J',
          steps: ['I = ½ × ' + M + ' × ' + rr + '^{2} = ' + S(I, 5) + ' kg m^{2}.', 'E_{k} = ½Iω^{2}.', 'E_{k} = ½ × ' + S(I, 5) + ' × ' + w + '^{2} = ' + N(E, 3) + ' J.'] };
      } },
    ] });

  add({ id: 'p-rel', units: [PH('A.5')], title: 'Special relativity',
    method: ['Lorentz factor γ = 1/√(1 − v^{2}/c^{2}).', 'Time dilation Δt = γΔt_{0}: Δt_{0} is the proper time, measured where the two events happen at the same place.', 'Length contraction L = L_{0}/γ: L_{0} is the proper length, measured at rest relative to the object.'],
    variants: [
      { id: 'gamma', name: 'Lorentz factor', gen: function (r) {
        var f = r.pick([0.5, 0.6, 0.8, 0.9, 0.95, 0.99, 0.3]), gm = 1 / Math.sqrt(1 - f * f);
        return { q: 'Find γ for a speed of ' + f + 'c.', answer: gm, sf: 3,
          steps: ['γ = 1/√(1 − v^{2}/c^{2}) with v/c = ' + f + '.', '= 1/√(1 − ' + S(f * f, 4) + ') = 1/√' + S(1 - f * f, 4) + '.', 'γ = ' + N(gm, 3) + '.'] };
      } },
      { id: 'time', name: 'Time dilation', gen: function (r) {
        var f = r.pick([0.6, 0.8, 0.9, 0.95]), t0 = r.int(2, 50), gm = 1 / Math.sqrt(1 - f * f);
        return { q: 'A particle lives ' + t0 + ' μs in its own frame. How long does it live according to an observer it passes at ' + f + 'c?', answer: gm * t0, sf: 3, unit: 'μs',
          steps: ['Its own time is the proper time Δt_{0} = ' + t0 + ' μs.', 'γ = ' + S(gm, 4) + '.', 'Δt = γΔt_{0} = ' + N(gm * t0, 3) + ' μs: longer.'] };
      } },
      { id: 'length', name: 'Length contraction', gen: function (r) {
        var f = r.pick([0.6, 0.8, 0.9, 0.95]), L0 = r.int(10, 500), gm = 1 / Math.sqrt(1 - f * f);
        return { q: 'A spaceship is ' + L0 + ' m long at rest. Find its length according to an observer it passes at ' + f + 'c.', answer: L0 / gm, sf: 3, unit: 'm',
          steps: ['Proper length L_{0} = ' + L0 + ' m.', 'γ = ' + S(gm, 4) + '.', 'L = L_{0}/γ = ' + N(L0 / gm, 3) + ' m: shorter.'] };
      } },
    ] });

  add({ id: 'p-thermal', units: [PH('B.1')], title: 'Thermal energy: heating, latent heat and conduction',
    method: ['Heating with no change of state: *Q = mcΔT*.', 'Changing state at constant temperature: *Q = mL* (L_{f} melting, L_{v} boiling).', 'Mixing: energy lost by the hot part = energy gained by the cold part.', 'Conduction: ΔQ/Δt = kAΔT/Δx.'],
    variants: [
      { id: 'q', name: 'Energy to heat (Q = mcΔT)', gen: function (r) {
        var mat = r.pick([['water', 4200], ['aluminium', 900], ['copper', 390], ['iron', 450], ['oil', 2000]]), mm = r.int(1, 50) / 10, dT = r.int(5, 80), Q = mm * mat[1] * dT;
        return { q: 'How much energy is needed to heat ' + mm + ' kg of ' + mat[0] + ' (c = ' + mat[1] + ' J kg^{−1} K^{−1}) by ' + dT + ' K?', answer: Q, sf: 3, unit: 'J',
          steps: ['Q = mcΔT.', 'Q = ' + mm + ' × ' + mat[1] + ' × ' + dT + '.', 'Q = ' + N(Q, 3) + ' J.'] };
      } },
      { id: 'dT', name: 'Temperature rise', gen: function (r) {
        var mm = r.int(1, 30) / 10, cc = r.pick([4200, 900, 390]), P = r.int(50, 2000), t = r.int(30, 600), dT = P * t / (mm * cc);
        if (dT > 300) return null;
        return { q: 'A ' + P + ' W heater warms ' + mm + ' kg of a substance (c = ' + cc + ' J kg^{−1} K^{−1}) for ' + t + ' s. With no losses, find the temperature rise.', answer: dT, sf: 3, unit: 'K',
          steps: ['Energy supplied Q = Pt = ' + P + ' × ' + t + ' = ' + P * t + ' J.', 'ΔT = Q/(mc).', 'ΔT = ' + P * t + ' ÷ (' + mm + ' × ' + cc + ') = ' + N(dT, 3) + ' K.'] };
      } },
      { id: 'latent', name: 'Latent heat', gen: function (r) {
        var w = r.pick([['melt', 3.34e5, 'ice at 0 °C'], ['boil away', 2.26e6, 'water at 100 °C']]), mm = r.int(1, 50) / 10, Q = mm * w[1];
        return { q: 'How much energy is needed to ' + w[0] + ' ' + mm + ' kg of ' + w[2] + '? (L = ' + N(w[1], 3) + ' J kg^{−1})', answer: Q, sf: 3, unit: 'J',
          steps: ['Change of state at constant temperature: Q = mL.', 'Q = ' + mm + ' × ' + N(w[1], 3) + '.', 'Q = ' + N(Q, 3) + ' J.'] };
      } },
      { id: 'mix', name: 'Mixing to a final temperature', gen: function (r) {
        var m1 = r.int(1, 10) / 10, T1 = r.int(60, 95), m2 = r.int(1, 10) / 10, T2 = r.int(5, 30), Tf = (m1 * T1 + m2 * T2) / (m1 + m2);
        return { q: m1 + ' kg of water at ' + T1 + ' °C is mixed with ' + m2 + ' kg of water at ' + T2 + ' °C. Find the final temperature (no losses).', answer: Tf, sf: 3, unit: '°C',
          steps: ['Energy lost by hot = energy gained by cold: ' + m1 + 'c(' + T1 + ' − T) = ' + m2 + 'c(T − ' + T2 + ').', 'c cancels: ' + S(m1 * T1, 4) + ' + ' + S(m2 * T2, 4) + ' = (' + m1 + ' + ' + m2 + ')T.', 'T = ' + N(Tf, 3) + ' °C.'] };
      } },
      { id: 'cond', name: 'Thermal conduction', gen: function (r) {
        var k = r.pick([0.8, 1.0, 50, 205, 385]), A = r.int(1, 20) / 10, dT = r.int(5, 40), dxc = r.int(2, 30), P = k * A * dT / (dxc / 100);
        return { q: 'A slab of area ' + A + ' m^{2} and thickness ' + dxc + ' cm has thermal conductivity ' + k + ' W m^{−1} K^{−1}. The temperature difference across it is ' + dT + ' K. Find the rate of heat transfer.', answer: P, sf: 3, unit: 'W',
          steps: ['ΔQ/Δt = kAΔT/Δx with Δx = ' + dxc / 100 + ' m.', '= ' + k + ' × ' + A + ' × ' + dT + ' ÷ ' + dxc / 100 + '.', '= ' + N(P, 3) + ' W.'] };
      } },
    ] });

  add({ id: 'p-radiation', units: [PH('B.1'), PH('B.2'), PH('E.5')], title: 'Black-body radiation and the greenhouse effect',
    method: ['Stefan–Boltzmann: L = σAT^{4} (σ = 5.67×10^{−8} W m^{−2} K^{−4}); a sphere has A = 4πR^{2}.', 'Wien: λ_{max}T = 2.9×10^{−3} m K: hotter means a shorter peak wavelength.', 'Intensity (apparent brightness) at distance d: I = L/(4πd^{2}).', 'Albedo = reflected power ÷ incident power.'],
    variants: [
      { id: 'wien', name: 'Wien’s law', gen: function (r) {
        var Tk = r.int(30, 300) * 100, lam = 2.9e-3 / Tk;
        return { q: 'A star has a surface temperature of ' + Tk + ' K. Find the wavelength at which it emits most strongly.', answer: lam, sf: 3, unit: 'm',
          steps: ['λ_{max} = 2.9×10^{−3}/T.', '= 2.9×10^{−3} ÷ ' + Tk + '.', '= ' + N(lam, 3) + ' m (' + N(lam * 1e9, 3) + ' nm).'] };
      } },
      { id: 'sb', name: 'Luminosity', gen: function (r) {
        var Rr = r.int(1, 30) / 10 * 7e8, Tk = r.int(30, 120) * 100, A = 4 * Math.PI * Rr * Rr, L = sigma * A * Math.pow(Tk, 4);
        return { q: 'A star has radius ' + N(Rr, 3) + ' m and surface temperature ' + Tk + ' K. Find its luminosity.', answer: L, sf: 3, unit: 'W',
          steps: ['A = 4πR^{2} = ' + N(A, 3) + ' m^{2}.', 'L = σAT^{4} = 5.67×10^{−8} × ' + N(A, 3) + ' × ' + Tk + '^{4}.', 'L = ' + N(L, 3) + ' W.'] };
      } },
      { id: 'intensity', name: 'Intensity at a distance', gen: function (r) {
        var L = r.int(1, 9) * Math.pow(10, r.int(24, 28)), d = r.int(1, 9) * Math.pow(10, r.int(11, 17)), I = L / (4 * Math.PI * d * d);
        return { q: 'A star of luminosity ' + N(L, 3) + ' W is ' + N(d, 3) + ' m away. Find the intensity received at Earth.', answer: I, sf: 3, unit: 'W m^{−2}',
          steps: ['The power spreads over a sphere: I = L/(4πd^{2}).', 'I = ' + N(L, 3) + ' ÷ (4π × (' + N(d, 3) + ')^{2}).', 'I = ' + N(I, 3) + ' W m^{−2}.'] };
      } },
      { id: 'albedo', name: 'Albedo', gen: function (r) {
        var inc = r.int(200, 1400), al = r.int(5, 90) / 100, refl = inc * al;
        if (r.next() < 0.5) return { q: 'A surface receives ' + inc + ' W m^{−2} and reflects ' + S(refl, 3) + ' W m^{−2}. Find its albedo.', answer: al,
          steps: ['Albedo = reflected ÷ incident.', '= ' + S(refl, 3) + ' ÷ ' + inc + '.', '= ' + al + '.'] };
        return { q: 'Sunlight of ' + inc + ' W m^{−2} falls on ice of albedo ' + al + '. How much power per square metre is absorbed?', answer: inc * (1 - al), unit: 'W m^{−2}',
          steps: ['Reflected = albedo × incident = ' + S(refl, 4) + ' W m^{−2}.', 'Absorbed = incident − reflected.', '= ' + S(inc * (1 - al), 4) + ' W m^{−2}.'] };
      } },
    ] });

  add({ id: 'p-gas', units: [PH('B.3')], title: 'Gas laws',
    method: ['Always use kelvin: T(K) = T(°C) + 273.', 'Ideal gas: *pV = nRT* (R = 8.31 J K^{−1} mol^{−1}) or pV = NkT.', 'Fixed amount of gas: p_{1}V_{1}/T_{1} = p_{2}V_{2}/T_{2}.', 'Mean kinetic energy of a molecule: Ē_{k} = (3/2)kT.'],
    variants: [
      { id: 'ideal', name: 'pV = nRT', gen: function (r) {
        var n = r.int(1, 30) / 10, Tc = r.int(-20, 200), Vd = r.int(1, 50), p = n * R * (Tc + 273) / (Vd / 1000);
        return { q: n + ' mol of gas at ' + Tc + ' °C is held in ' + Vd + ' dm^{3}. Find its pressure.', answer: p, sf: 3, unit: 'Pa',
          steps: ['T = ' + Tc + ' + 273 = ' + (Tc + 273) + ' K; V = ' + Vd / 1000 + ' m^{3}.', 'p = nRT/V = ' + n + ' × 8.31 × ' + (Tc + 273) + ' ÷ ' + Vd / 1000 + '.', 'p = ' + N(p, 3) + ' Pa.'] };
      } },
      { id: 'combined', name: 'Combined gas law', gen: function (r) {
        var p1 = r.int(80, 300), V1 = r.int(1, 20), T1 = r.int(250, 400), T2 = r.int(250, 500), V2 = r.int(1, 20), p2 = p1 * V1 * T2 / (T1 * V2);
        return { q: 'A gas at ' + p1 + ' kPa, ' + V1 + ' dm^{3} and ' + T1 + ' K is changed to ' + V2 + ' dm^{3} and ' + T2 + ' K. Find the new pressure.', answer: p2, sf: 3, unit: 'kPa',
          steps: ['p_{1}V_{1}/T_{1} = p_{2}V_{2}/T_{2}; any consistent units for p and V.', 'p_{2} = ' + p1 + ' × ' + V1 + ' × ' + T2 + ' ÷ (' + T1 + ' × ' + V2 + ').', 'p_{2} = ' + N(p2, 3) + ' kPa.'] };
      } },
      { id: 'boyle', name: 'Constant temperature', gen: function (r) {
        var p1 = r.int(100, 400), V1 = r.int(2, 30), V2 = r.int(1, 30), p2 = p1 * V1 / V2;
        return { q: 'At constant temperature a gas at ' + p1 + ' kPa occupies ' + V1 + ' cm^{3}. Find its pressure when compressed to ' + V2 + ' cm^{3}.', answer: p2, sf: 3, unit: 'kPa',
          steps: ['Constant T: p_{1}V_{1} = p_{2}V_{2}.', 'p_{2} = ' + p1 + ' × ' + V1 + ' ÷ ' + V2 + '.', 'p_{2} = ' + N(p2, 3) + ' kPa.'] };
      } },
      { id: 'ke', name: 'Mean kinetic energy', gen: function (r) {
        var Tc = r.int(-50, 500), E = 1.5 * kB * (Tc + 273);
        return { q: 'Find the mean kinetic energy of a molecule of an ideal gas at ' + Tc + ' °C.', answer: E, sf: 3, unit: 'J',
          steps: ['T = ' + (Tc + 273) + ' K.', 'Ē_{k} = (3/2)kT = 1.5 × 1.38×10^{−23} × ' + (Tc + 273) + '.', '= ' + N(E, 3) + ' J.'] };
      } },
      { id: 'kelvin', name: 'Kelvin and Celsius', gen: function (r) {
        var Tc = r.int(-200, 400);
        if (r.next() < 0.5) return { q: 'Convert ' + Tc + ' °C to kelvin.', answer: Tc + 273, steps: ['T(K) = T(°C) + 273.', '= ' + Tc + ' + 273.', '= ' + (Tc + 273) + ' K.'] };
        return { q: 'Convert ' + (Tc + 273) + ' K to °C.', answer: Tc, steps: ['T(°C) = T(K) − 273.', '= ' + (Tc + 273) + ' − 273.', '= ' + m(Tc) + ' °C.'] };
      } },
    ] });

  add({ id: 'p-thermo', units: [PH('B.4')], title: 'Thermodynamics',
    method: ['First law: *Q = ΔU + W* (Q into the gas; W done *by* the gas).', 'Work at constant pressure: W = pΔV.', 'Carnot efficiency (the maximum): η = 1 − T_{cold}/T_{hot}, in kelvin.', 'Entropy change: ΔS = ΔQ/T.'],
    variants: [
      { id: 'first', name: 'First law', gen: function (r) {
        var Q = r.int(-500, 1500), W = r.int(-500, 800);
        return { q: 'A gas absorbs ' + m(Q) + ' J of heat and does ' + m(W) + ' J of work on its surroundings. Find the change in its internal energy.', answer: Q - W, unit: 'J',
          steps: ['Q = ΔU + W, so ΔU = Q − W.', 'ΔU = ' + m(Q) + ' − ' + b(W) + '.', 'ΔU = ' + m(Q - W) + ' J.'] };
      } },
      { id: 'pdv', name: 'Work at constant pressure', gen: function (r) {
        var pk = r.int(50, 500), dVd = r.int(1, 50), W = pk * 1000 * dVd / 1000;
        return { q: 'A gas expands by ' + dVd + ' dm^{3} at a constant ' + pk + ' kPa. Find the work done by the gas.', answer: W, unit: 'J',
          steps: ['W = pΔV in SI: p = ' + pk * 1000 + ' Pa, ΔV = ' + dVd / 1000 + ' m^{3}.', 'W = ' + pk * 1000 + ' × ' + dVd / 1000 + '.', 'W = ' + S(W) + ' J.'] };
      } },
      { id: 'carnot', name: 'Carnot efficiency', gen: function (r) {
        var Th = r.int(400, 900), Tcold = r.int(250, Th - 50), eff = 1 - Tcold / Th;
        return { q: 'A heat engine works between ' + Th + ' K and ' + Tcold + ' K. Find its maximum possible efficiency as a decimal.', answer: eff, sf: 3,
          steps: ['η = 1 − T_{c}/T_{h}.', '= 1 − ' + Tcold + '/' + Th + '.', '= ' + N(eff, 3) + '.'] };
      } },
      { id: 'entropy', name: 'Entropy change', gen: function (r) {
        var Q = r.int(100, 50000), Tk = r.int(250, 600);
        return { q: Q + ' J of heat flows into a reservoir at ' + Tk + ' K. Find its entropy change.', answer: Q / Tk, sf: 3, unit: 'J K^{−1}',
          steps: ['ΔS = ΔQ/T.', '= ' + Q + ' ÷ ' + Tk + '.', '= ' + N(Q / Tk, 3) + ' J K^{−1}.'] };
      } },
    ] });

  add({ id: 'p-circuits', units: [PH('B.5')], title: 'Current and circuits',
    method: ['V = IR. Power P = IV = I^{2}R = V^{2}/R. Charge Q = It.', 'Series: R_{total} = R_{1} + R_{2} + …, same current everywhere.', 'Parallel: 1/R_{total} = 1/R_{1} + 1/R_{2} + …, same voltage across each branch.', 'EMF and internal resistance: ε = I(R + r). Resistivity: R = ρL/A.'],
    variants: [
      { id: 'series', name: 'Resistors in series', gen: function (r) {
        var rs = [r.int(2, 50), r.int(2, 50), r.int(2, 50)], V = r.int(3, 24), Rt = rs[0] + rs[1] + rs[2];
        return { q: 'Resistors of ' + rs.join(' Ω, ') + ' Ω are in series with a ' + V + ' V supply. Find the current.', answer: V / Rt, sf: 3, unit: 'A',
          steps: ['Series: R_{total} = ' + rs.join(' + ') + ' = ' + Rt + ' Ω.', 'I = V/R.', 'I = ' + V + ' ÷ ' + Rt + ' = ' + N(V / Rt, 3) + ' A.'] };
      } },
      { id: 'parallel', name: 'Resistors in parallel', gen: function (r) {
        var r1 = r.int(2, 60), r2 = r.int(2, 60), Rt = r1 * r2 / (r1 + r2);
        return { q: 'Find the total resistance of ' + r1 + ' Ω and ' + r2 + ' Ω in parallel.', answer: Rt, sf: 3, unit: 'Ω',
          steps: ['1/R = 1/' + r1 + ' + 1/' + r2 + '.', 'For two resistors: R = product ÷ sum = ' + r1 * r2 + ' ÷ ' + (r1 + r2) + '.', 'R = ' + N(Rt, 3) + ' Ω: less than either.'] };
      } },
      { id: 'power', name: 'Electrical power', gen: function (r) {
        var V = r.pick([6, 9, 12, 230, 120]), Rr = r.int(2, 500);
        return { q: 'A ' + Rr + ' Ω resistor is connected to ' + V + ' V. Find the power dissipated.', answer: V * V / Rr, sf: 3, unit: 'W',
          steps: ['Know V and R: P = V^{2}/R.', 'P = ' + V + '^{2} ÷ ' + Rr + '.', 'P = ' + N(V * V / Rr, 3) + ' W.'] };
      } },
      { id: 'emf', name: 'EMF and internal resistance', gen: function (r) {
        var eps = r.pick([1.5, 3, 4.5, 6, 9, 12]), rint = r.int(1, 20) / 10, Rr = r.int(1, 40), I = eps / (Rr + rint);
        return { q: 'A cell of EMF ' + eps + ' V and internal resistance ' + rint + ' Ω is connected to a ' + Rr + ' Ω resistor. Find the terminal voltage.', answer: I * Rr, sf: 3, unit: 'V',
          steps: ['ε = I(R + r): I = ' + eps + ' ÷ (' + Rr + ' + ' + rint + ') = ' + S(I, 4) + ' A.', 'Terminal voltage = IR (the “lost volts” Ir are inside the cell).', 'V = ' + S(I, 4) + ' × ' + Rr + ' = ' + N(I * Rr, 3) + ' V.'] };
      } },
      { id: 'rho', name: 'Resistivity', gen: function (r) {
        var rho = r.pick([1.7e-8, 2.8e-8, 1.1e-6, 4.9e-7]), L = r.int(1, 50), dmm = r.int(2, 10) / 10, A = Math.PI * Math.pow(dmm / 1000, 2) / 4, Rr = rho * L / A;
        return { q: 'A wire of resistivity ' + N(rho, 2) + ' Ω m is ' + L + ' m long with a diameter of ' + dmm + ' mm. Find its resistance.', answer: Rr, sf: 3, unit: 'Ω',
          steps: ['A = πd^{2}/4 = π × (' + N(dmm / 1000, 2) + ')^{2} ÷ 4 = ' + N(A, 3) + ' m^{2}.', 'R = ρL/A.', 'R = ' + N(rho, 2) + ' × ' + L + ' ÷ ' + N(A, 3) + ' = ' + N(Rr, 3) + ' Ω.'] };
      } },
      { id: 'divider', name: 'Potential divider', gen: function (r) {
        var V = r.pick([6, 9, 12, 5]), r1 = r.int(1, 20), r2 = r.int(1, 20);
        return { q: 'A ' + V + ' V supply is across ' + r1 + ' kΩ and ' + r2 + ' kΩ in series. Find the voltage across the ' + r2 + ' kΩ resistor.', answer: V * r2 / (r1 + r2), sf: 3, unit: 'V',
          steps: ['The voltage splits in the ratio of the resistances.', 'V_{out} = V × R_{2}/(R_{1} + R_{2}) = ' + V + ' × ' + r2 + '/' + (r1 + r2) + '.', '= ' + N(V * r2 / (r1 + r2), 3) + ' V.'] };
      } },
    ] });

  add({ id: 'p-shm', units: [PH('C.1')], title: 'Simple harmonic motion',
    method: ['SHM: a = −ω^{2}x, with ω = 2π/T = 2πf.', 'Mass on a spring: T = 2π√(m/k). Simple pendulum: T = 2π√(l/g).', 'Maximum speed v_{max} = ωx_{0}; maximum acceleration ω^{2}x_{0}.'],
    variants: [
      { id: 'spring', name: 'Period of a mass on a spring', gen: function (r) {
        var mm = r.int(1, 50) / 10, k = r.int(5, 400), Tp = 2 * Math.PI * Math.sqrt(mm / k);
        return { q: 'A ' + mm + ' kg mass oscillates on a spring of stiffness ' + k + ' N m^{−1}. Find the period.', answer: Tp, sf: 3, unit: 's',
          steps: ['T = 2π√(m/k).', 'T = 2π√(' + mm + ' ÷ ' + k + ').', 'T = ' + N(Tp, 3) + ' s.'] };
      } },
      { id: 'pend', name: 'Period of a pendulum', gen: function (r) {
        var l = r.int(10, 300) / 100, Tp = 2 * Math.PI * Math.sqrt(l / g);
        return { q: 'Find the period of a simple pendulum of length ' + l + ' m.', answer: Tp, sf: 3, unit: 's',
          steps: ['T = 2π√(l/g).', 'T = 2π√(' + l + ' ÷ 9.8).', 'T = ' + N(Tp, 3) + ' s (the mass does not matter).'] };
      } },
      { id: 'vmax', name: 'Maximum speed', gen: function (r) {
        var f = r.int(1, 40) / 10, xc = r.int(1, 30), w = 2 * Math.PI * f;
        return { q: 'An object oscillates in SHM at ' + f + ' Hz with amplitude ' + xc + ' cm. Find its maximum speed.', answer: w * xc / 100, sf: 3, unit: 'm s^{−1}',
          steps: ['ω = 2πf = ' + S(w, 4) + ' rad s^{−1}.', 'v_{max} = ωx_{0}, x_{0} = ' + xc / 100 + ' m.', 'v_{max} = ' + N(w * xc / 100, 3) + ' m s^{−1}.'] };
      } },
      { id: 'acc', name: 'Acceleration at a displacement', gen: function (r) {
        var Tp = r.int(2, 40) / 10, xc = r.int(1, 20), w = 2 * Math.PI / Tp, a = w * w * xc / 100;
        return { q: 'A body in SHM has period ' + Tp + ' s. Find the size of its acceleration when it is ' + xc + ' cm from equilibrium.', answer: a, sf: 3, unit: 'm s^{−2}',
          steps: ['ω = 2π/T = ' + S(w, 4) + ' rad s^{−1}.', '|a| = ω^{2}x = ' + S(w * w, 4) + ' × ' + xc / 100 + '.', '|a| = ' + N(a, 3) + ' m s^{−2}, towards equilibrium.'] };
      } },
    ] });

  add({ id: 'p-waves', units: [PH('C.2'), PH('C.3'), PH('C.4')], title: 'Waves: speed, refraction, interference and standing waves',
    method: ['Wave speed v = fλ; period T = 1/f.', 'Refraction (Snell): n_{1} sin θ_{1} = n_{2} sin θ_{2}; critical angle sin θ_{c} = n_{2}/n_{1}.', 'Double-slit fringe spacing s = λD/d; diffraction grating nλ = d sin θ.', 'String or open pipe: fundamental λ = 2L. Closed pipe: λ = 4L. f = v/λ.'],
    variants: [
      { id: 'vfl', name: 'Wave equation', gen: function (r) {
        var f = r.int(2, 2000), lam = r.int(1, 400) / 100;
        return { q: 'A wave has frequency ' + f + ' Hz and wavelength ' + lam + ' m. Find its speed.', answer: f * lam, unit: 'm s^{−1}',
          steps: ['v = fλ.', 'v = ' + f + ' × ' + lam + '.', 'v = ' + S(f * lam) + ' m s^{−1}.'] };
      } },
      { id: 'snell', name: 'Snell’s law', gen: function (r) {
        var n2 = r.pick([1.33, 1.5, 1.52, 2.42]), th1 = r.int(10, 80), th2 = Math.asin(Math.sin(th1 * DEG) / n2) / DEG;
        return { q: 'Light passes from air (n = 1.00) into a material of n = ' + n2 + ' at an angle of incidence of ' + th1 + '°. Find the angle of refraction.', answer: th2, sf: 3, unit: '°',
          steps: ['n_{1} sin θ_{1} = n_{2} sin θ_{2}.', 'sin θ_{2} = sin ' + th1 + '° ÷ ' + n2 + ' = ' + S(Math.sin(th1 * DEG) / n2, 4) + '.', 'θ_{2} = ' + N(th2, 3) + '°: bent towards the normal.'] };
      } },
      { id: 'crit', name: 'Critical angle', gen: function (r) {
        var n1 = r.pick([1.33, 1.45, 1.5, 1.6, 2.42]), th = Math.asin(1 / n1) / DEG;
        return { q: 'Find the critical angle for light going from a material of n = ' + n1 + ' into air.', answer: th, sf: 3, unit: '°',
          steps: ['At the critical angle the refracted ray runs along the surface (θ_{2} = 90°).', 'sin θ_{c} = 1/' + n1 + '.', 'θ_{c} = ' + N(th, 3) + '°.'] };
      } },
      { id: 'slit', name: 'Double-slit fringe spacing', gen: function (r) {
        var nm = r.int(400, 700), D = r.int(5, 30) / 10, dmm = r.int(1, 10) / 10, s = nm * 1e-9 * D / (dmm / 1000);
        return { q: 'Light of wavelength ' + nm + ' nm passes through slits ' + dmm + ' mm apart onto a screen ' + D + ' m away. Find the fringe spacing.', answer: s, sf: 3, unit: 'm',
          steps: ['s = λD/d in metres: λ = ' + N(nm * 1e-9, 3) + ', d = ' + N(dmm / 1000, 2) + '.', 's = ' + N(nm * 1e-9, 3) + ' × ' + D + ' ÷ ' + N(dmm / 1000, 2) + '.', 's = ' + N(s, 3) + ' m (' + N(s * 1000, 3) + ' mm).'] };
      } },
      { id: 'grating', name: 'Diffraction grating', gen: function (r) {
        var lines = r.pick([100, 300, 500, 600]), nm = r.int(400, 700), n = r.int(1, 2), d = 1e-3 / lines, s = n * nm * 1e-9 / d;
        if (s >= 1) return null;
        return { q: 'A grating has ' + lines + ' lines per mm. Light of ' + nm + ' nm falls on it. Find the angle of the order-' + n + ' maximum.', answer: Math.asin(s) / DEG, sf: 3, unit: '°',
          steps: ['d = 1 mm ÷ ' + lines + ' = ' + N(d, 3) + ' m.', 'nλ = d sin θ: sin θ = ' + n + ' × ' + N(nm * 1e-9, 3) + ' ÷ ' + N(d, 3) + ' = ' + S(s, 4) + '.', 'θ = ' + N(Math.asin(s) / DEG, 3) + '°.'] };
      } },
      { id: 'string', name: 'Standing waves on a string', gen: function (r) {
        var L = r.int(20, 150) / 100, v = r.int(100, 500), n = r.int(1, 4), f = n * v / (2 * L);
        return { q: 'A string ' + L + ' m long, fixed at both ends, carries waves at ' + v + ' m s^{−1}. Find the frequency of harmonic ' + n + '.', answer: f, sf: 3, unit: 'Hz',
          steps: ['Fixed at both ends: λ_{n} = 2L/n = ' + S(2 * L / n, 4) + ' m.', 'f = v/λ.', 'f = ' + v + ' ÷ ' + S(2 * L / n, 4) + ' = ' + N(f, 3) + ' Hz.'] };
      } },
      { id: 'pipe', name: 'Pipe closed at one end', gen: function (r) {
        var L = r.int(10, 120) / 100, f = 340 / (4 * L);
        return { q: 'A pipe closed at one end is ' + L + ' m long. With the speed of sound 340 m s^{−1}, find its fundamental frequency.', answer: f, sf: 3, unit: 'Hz',
          steps: ['A node at the closed end and an antinode at the open end: L = λ/4.', 'λ = 4L = ' + S(4 * L, 3) + ' m.', 'f = 340 ÷ ' + S(4 * L, 3) + ' = ' + N(f, 3) + ' Hz.'] };
      } },
    ] });

  add({ id: 'p-doppler', units: [PH('C.5')], title: 'The Doppler effect',
    method: ['Sound from a moving source: f′ = f v/(v ∓ u_{s}): minus when approaching (higher pitch), plus when receding.', 'Moving observer: f′ = f (v ± u_{o})/v.', 'Light, v ≪ c: Δλ/λ ≈ v/c.'],
    variants: [
      { id: 'src', name: 'Moving source of sound', gen: function (r) {
        var f = r.int(200, 1200), us = r.int(10, 60), app = r.next() < 0.5, fp = f * 340 / (340 + (app ? -us : us));
        return { q: 'A siren of ' + f + ' Hz moves at ' + us + ' m s^{−1} ' + (app ? 'towards' : 'away from') + ' you. Speed of sound 340 m s^{−1}. What frequency do you hear?', answer: fp, sf: 3, unit: 'Hz',
          steps: ['Moving source: f′ = f v/(v ' + (app ? '−' : '+') + ' u_{s}).', 'f′ = ' + f + ' × 340 ÷ (340 ' + (app ? '−' : '+') + ' ' + us + ').', 'f′ = ' + N(fp, 3) + ' Hz (' + (app ? 'higher' : 'lower') + ').'] };
      } },
      { id: 'light', name: 'Redshift of light', gen: function (r) {
        var lam = r.int(400, 700), v = r.int(1, 30) * 1e6, dl = lam * v / c;
        return { q: 'A spectral line of ' + lam + ' nm is seen from a galaxy receding at ' + N(v, 3) + ' m s^{−1}. Find the shift in wavelength.', answer: dl, sf: 3, unit: 'nm',
          steps: ['Δλ/λ ≈ v/c.', 'Δλ = ' + lam + ' × ' + N(v, 3) + ' ÷ 3.00×10^{8}.', 'Δλ = ' + N(dl, 3) + ' nm, towards red.'] };
      } },
      { id: 'speed', name: 'Speed from a redshift', gen: function (r) {
        var lam = r.int(400, 700), dl = r.int(1, 50) / 10, v = c * dl / lam;
        return { q: 'A line emitted at ' + lam + ' nm is observed at ' + T.round(lam + dl, 1) + ' nm. Find the speed of recession.', answer: v, sf: 3, unit: 'm s^{−1}',
          steps: ['Δλ = ' + dl + ' nm.', 'v = cΔλ/λ = 3.00×10^{8} × ' + dl + ' ÷ ' + lam + '.', 'v = ' + N(v, 3) + ' m s^{−1}.'] };
      } },
    ] });

  add({ id: 'p-gravity', units: [PH('D.1')], title: 'Gravitational fields and orbits',
    method: ['Newton’s law of gravitation: F = GMm/r^{2}, r between centres. Field strength g = GM/r^{2}.', 'Circular orbit: gravity is the centripetal force, so v = √(GM/r) and T = 2πr/v.', 'Escape speed v = √(2GM/R). Potential V = −GM/r.'],
    variants: [
      { id: 'force', name: 'Gravitational force', gen: function (r) {
        var M = r.int(1, 9) * 1e24, mm = r.int(100, 5000), rr = r.int(64, 400) * 1e5, F = G * M * mm / (rr * rr);
        return { q: 'Find the gravitational force between a planet of mass ' + N(M, 3) + ' kg and a ' + mm + ' kg satellite ' + N(rr, 3) + ' m from its centre.', answer: F, sf: 3, unit: 'N',
          steps: ['F = GMm/r^{2}.', 'F = 6.67×10^{−11} × ' + N(M, 3) + ' × ' + mm + ' ÷ (' + N(rr, 3) + ')^{2}.', 'F = ' + N(F, 3) + ' N.'] };
      } },
      { id: 'field', name: 'Field strength', gen: function (r) {
        var M = r.int(1, 9) * Math.pow(10, r.int(22, 26)), rr = r.int(1, 9) * Math.pow(10, r.int(6, 7)), gg = G * M / (rr * rr);
        return { q: 'Find the gravitational field strength ' + N(rr, 3) + ' m from the centre of a body of mass ' + N(M, 3) + ' kg.', answer: gg, sf: 3, unit: 'N kg^{−1}',
          steps: ['g = GM/r^{2}.', 'g = 6.67×10^{−11} × ' + N(M, 3) + ' ÷ (' + N(rr, 3) + ')^{2}.', 'g = ' + N(gg, 3) + ' N kg^{−1}.'] };
      } },
      { id: 'orbit', name: 'Orbital speed', gen: function (r) {
        var alt = r.int(200, 36000), rr = 6.37e6 + alt * 1000, v = Math.sqrt(G * 5.97e24 / rr);
        return { q: 'A satellite orbits ' + alt + ' km above Earth’s surface (M = 5.97×10^{24} kg, R = 6.37×10^{6} m). Find its orbital speed.', answer: v, sf: 3, unit: 'm s^{−1}',
          steps: ['r is from Earth’s centre: r = 6.37×10^{6} + ' + N(alt * 1000, 3) + ' = ' + N(rr, 4) + ' m.', 'GMm/r^{2} = mv^{2}/r gives v = √(GM/r).', 'v = ' + N(v, 3) + ' m s^{−1}.'] };
      } },
      { id: 'period', name: 'Orbital period', gen: function (r) {
        var alt = r.int(200, 36000), rr = 6.37e6 + alt * 1000, Tp = 2 * Math.PI * Math.sqrt(rr * rr * rr / (G * 5.97e24));
        return { q: 'Find the period, in hours, of a satellite orbiting ' + alt + ' km above Earth’s surface (M = 5.97×10^{24} kg, R = 6.37×10^{6} m).', answer: Tp / 3600, sf: 3, unit: 'h',
          steps: ['r = ' + N(rr, 4) + ' m.', 'T = 2π√(r^{3}/(GM)) = ' + N(Tp, 4) + ' s.', 'T = ' + N(Tp / 3600, 3) + ' h.'] };
      } },
      { id: 'escape', name: 'Escape speed', gen: function (r) {
        var bd = r.pick([['Earth', 5.97e24, 6.37e6], ['the Moon', 7.35e22, 1.74e6], ['Mars', 6.42e23, 3.39e6]]), v = Math.sqrt(2 * G * bd[1] / bd[2]);
        return { q: 'Find the escape speed from the surface of ' + bd[0] + ' (M = ' + N(bd[1], 3) + ' kg, R = ' + N(bd[2], 3) + ' m).', answer: v, sf: 3, unit: 'm s^{−1}',
          steps: ['Kinetic energy must match the energy to reach infinity: ½mv^{2} = GMm/R.', 'v = √(2GM/R).', 'v = ' + N(v, 3) + ' m s^{−1}.'] };
      } },
    ] });

  add({ id: 'p-electric', units: [PH('D.2')], title: 'Electric fields and forces',
    method: ['Coulomb: F = kq_{1}q_{2}/r^{2} (k = 8.99×10^{9} N m^{2} C^{−2}).', 'Field strength E = F/q; point charge E = kq/r^{2}; parallel plates E = V/d.', 'Work moving a charge through a p.d.: W = qV. 1 eV = 1.60×10^{−19} J.'],
    variants: [
      { id: 'coulomb', name: 'Coulomb’s law', gen: function (r) {
        var q1 = r.int(1, 9), q2 = r.int(1, 9), rc = r.int(1, 50), F = kC * q1 * 1e-6 * q2 * 1e-6 / Math.pow(rc / 100, 2);
        return { q: 'Two charges of ' + q1 + ' μC and ' + q2 + ' μC are ' + rc + ' cm apart. Find the force between them.', answer: F, sf: 3, unit: 'N',
          steps: ['F = kq_{1}q_{2}/r^{2} in C and m.', 'F = 8.99×10^{9} × ' + q1 + '×10^{−6} × ' + q2 + '×10^{−6} ÷ ' + rc / 100 + '^{2}.', 'F = ' + N(F, 3) + ' N.'] };
      } },
      { id: 'plates', name: 'Field between plates', gen: function (r) {
        var V = r.int(50, 5000), dmm = r.int(1, 50), E = V / (dmm / 1000);
        return { q: 'Parallel plates ' + dmm + ' mm apart have a potential difference of ' + V + ' V. Find the field strength.', answer: E, sf: 3, unit: 'V m^{−1}',
          steps: ['Uniform field: E = V/d, d = ' + dmm / 1000 + ' m.', 'E = ' + V + ' ÷ ' + dmm / 1000 + '.', 'E = ' + N(E, 3) + ' V m^{−1}.'] };
      } },
      { id: 'ev', name: 'Accelerating an electron', gen: function (r) {
        var V = r.int(10, 5000), v = Math.sqrt(2 * e * V / me);
        return { q: 'An electron is accelerated from rest through ' + V + ' V. Find its speed (ignore relativity).', answer: v, sf: 3, unit: 'm s^{−1}',
          steps: ['Energy gained eV = 1.60×10^{−19} × ' + V + ' = ' + N(e * V, 3) + ' J.', '½m_{e}v^{2} = eV, so v = √(2eV/m_{e}).', 'v = ' + N(v, 3) + ' m s^{−1}.'] };
      } },
      { id: 'efield', name: 'Field of a point charge', gen: function (r) {
        var q = r.int(1, 9), rc = r.int(1, 50), E = kC * q * 1e-9 / Math.pow(rc / 100, 2);
        return { q: 'Find the electric field strength ' + rc + ' cm from a ' + q + ' nC point charge.', answer: E, sf: 3, unit: 'N C^{−1}',
          steps: ['E = kq/r^{2}.', 'E = 8.99×10^{9} × ' + q + '×10^{−9} ÷ ' + rc / 100 + '^{2}.', 'E = ' + N(E, 3) + ' N C^{−1}.'] };
      } },
    ] });

  add({ id: 'p-magnetic', units: [PH('D.3'), PH('D.2')], title: 'Motion in magnetic fields',
    method: ['Force on a current F = BIL sin θ; on a moving charge F = qvB sin θ (direction by the left-hand rule; reverse for negative charges).', 'A charge moving across B moves in a circle: qvB = mv^{2}/r, so r = mv/(qB).', 'Velocity selector: undeflected when qE = qvB, so v = E/B.'],
    variants: [
      { id: 'bil', name: 'Force on a wire', gen: function (r) {
        var B = r.int(1, 50) / 100, I = r.int(1, 20), L = r.int(5, 100) / 100, th = r.pick([90, 60, 30]), F = B * I * L * Math.sin(th * DEG);
        return { q: 'A ' + L + ' m wire carries ' + I + ' A at ' + th + '° to a ' + B + ' T field. Find the force on it.', answer: F, sf: 3, unit: 'N',
          steps: ['F = BIL sin θ.', 'F = ' + B + ' × ' + I + ' × ' + L + ' × sin ' + th + '°.', 'F = ' + N(F, 3) + ' N.'] };
      } },
      { id: 'radius', name: 'Radius of a circular path', gen: function (r) {
        var v = r.int(1, 9) * 1e6, Bm = r.int(1, 50), rr = me * v / (e * Bm / 1000);
        return { q: 'An electron moves at ' + N(v, 3) + ' m s^{−1} at right angles to a ' + Bm + ' mT field. Find the radius of its path.', answer: rr, sf: 3, unit: 'm',
          steps: ['The magnetic force is centripetal: evB = m_{e}v^{2}/r.', 'r = m_{e}v/(eB) = 9.11×10^{−31} × ' + N(v, 3) + ' ÷ (1.60×10^{−19} × ' + Bm / 1000 + ').', 'r = ' + N(rr, 3) + ' m.'] };
      } },
      { id: 'select', name: 'Velocity selector', gen: function (r) {
        var E = r.int(1, 50) * 1000, B = r.int(1, 50) / 100;
        return { q: 'In crossed fields E = ' + N(E, 3) + ' V m^{−1} and B = ' + B + ' T, what speed do particles need to pass straight through?', answer: E / B, sf: 3, unit: 'm s^{−1}',
          steps: ['Undeflected: qE = qvB.', 'v = E/B, whatever the charge or mass.', 'v = ' + N(E, 3) + ' ÷ ' + B + ' = ' + N(E / B, 3) + ' m s^{−1}.'] };
      } },
    ] });

  add({ id: 'p-induction', units: [PH('D.4')], title: 'Electromagnetic induction',
    method: ['Flux Φ = BA cos θ (Wb); flux linkage NΦ.', 'Faraday: ε = −NΔΦ/Δt; the minus sign is Lenz’s law (the induced current opposes the change).', 'Rod moving through a field: ε = BvL.', 'Ideal transformer: V_{s}/V_{p} = N_{s}/N_{p} = I_{p}/I_{s}.'],
    variants: [
      { id: 'faraday', name: 'Faraday’s law', gen: function (r) {
        var Nn = r.int(10, 500), B1 = r.int(0, 50) / 100, B2 = r.int(0, 50) / 100, Acm = r.int(1, 100), t = r.int(1, 50) / 100;
        if (B1 === B2) return null;
        var dPhi = Math.abs(B2 - B1) * Acm / 10000, eps = Nn * dPhi / t;
        return { q: 'A coil of ' + Nn + ' turns and area ' + Acm + ' cm^{2} is in a field that changes from ' + B1 + ' T to ' + B2 + ' T in ' + t + ' s. Find the size of the induced EMF.', answer: eps, sf: 3, unit: 'V',
          steps: ['ΔΦ = ΔB × A = ' + T.round(Math.abs(B2 - B1), 2) + ' × ' + Acm / 10000 + ' = ' + N(dPhi, 3) + ' Wb.', '|ε| = NΔΦ/Δt.', '= ' + Nn + ' × ' + N(dPhi, 3) + ' ÷ ' + t + ' = ' + N(eps, 3) + ' V.'] };
      } },
      { id: 'rod', name: 'Moving conductor', gen: function (r) {
        var B = r.int(1, 100) / 100, v = r.int(1, 30), L = r.int(10, 200) / 100;
        return { q: 'A ' + L + ' m rod moves at ' + v + ' m s^{−1} at right angles to a ' + B + ' T field. Find the EMF across it.', answer: B * v * L, sf: 3, unit: 'V',
          steps: ['ε = BvL.', 'ε = ' + B + ' × ' + v + ' × ' + L + '.', 'ε = ' + N(B * v * L, 3) + ' V.'] };
      } },
      { id: 'trans', name: 'Transformer', gen: function (r) {
        var Np = r.int(100, 2000), Ns = r.int(10, 2000), Vp = r.pick([230, 120, 11000, 400]), Vs = Vp * Ns / Np;
        return { q: 'An ideal transformer has ' + Np + ' primary and ' + Ns + ' secondary turns. The primary voltage is ' + Vp + ' V. Find the secondary voltage.', answer: Vs, sf: 3, unit: 'V',
          steps: ['V_{s}/V_{p} = N_{s}/N_{p}.', 'V_{s} = ' + Vp + ' × ' + Ns + '/' + Np + '.', 'V_{s} = ' + N(Vs, 3) + ' V (' + (Ns > Np ? 'step-up' : 'step-down') + ').'] };
      } },
    ] });

  add({ id: 'p-atom', units: [PH('E.1'), PH('E.2')], title: 'Photons, energy levels and the photoelectric effect',
    method: ['Photon energy E = hf = hc/λ (h = 6.63×10^{−34} J s); 1 eV = 1.60×10^{−19} J.', 'An electron falling between levels emits one photon: ΔE = hf.', 'Photoelectric effect: hf = Φ + E_{k,max}; nothing is emitted below the threshold frequency f_{0} = Φ/h.', 'de Broglie: λ = h/p = h/(mv).'],
    variants: [
      { id: 'photon', name: 'Photon energy from wavelength', gen: function (r) {
        var nm = r.int(100, 900), E = h * c / (nm * 1e-9);
        return { q: 'Find the energy of a photon of wavelength ' + nm + ' nm, in joules.', answer: E, sf: 3, unit: 'J',
          steps: ['E = hc/λ.', 'E = 6.63×10^{−34} × 3.00×10^{8} ÷ ' + N(nm * 1e-9, 3) + '.', 'E = ' + N(E, 3) + ' J (' + N(E / e, 3) + ' eV).'] };
      } },
      { id: 'levels', name: 'Wavelength from an energy-level drop', gen: function (r) {
        var lv = r.pick([[-13.6, -3.4], [-3.4, -1.51], [-13.6, -1.51], [-3.4, -0.85], [-1.51, -0.85], [-3.4, -0.54]]), dE = (lv[1] - lv[0]) * e, lam = h * c / dE;
        return { q: 'An electron in hydrogen falls from ' + m(lv[1]) + ' eV to ' + m(lv[0]) + ' eV. Find the wavelength of the photon emitted.', answer: lam, sf: 3, unit: 'm',
          steps: ['ΔE = ' + m(lv[1]) + ' − ' + b(lv[0]) + ' = ' + T.round(lv[1] - lv[0], 2) + ' eV = ' + N(dE, 3) + ' J.', 'λ = hc/ΔE.', 'λ = ' + N(lam, 3) + ' m (' + N(lam * 1e9, 3) + ' nm).'] };
      } },
      { id: 'photo', name: 'Photoelectric effect', gen: function (r) {
        var phi = r.int(18, 50) / 10, nm = r.int(150, 600), Ef = h * c / (nm * 1e-9) / e, Ek = Ef - phi;
        if (Ek <= 0.05) return null;
        return { q: 'Light of wavelength ' + nm + ' nm falls on a metal of work function ' + phi + ' eV. Find the maximum kinetic energy of the photoelectrons, in eV.', answer: Ek, sf: 3, unit: 'eV',
          steps: ['Photon energy hc/λ = ' + N(Ef * e, 3) + ' J = ' + S(Ef, 4) + ' eV.', 'hf = Φ + E_{k,max}, so E_{k,max} = hf − Φ.', 'E_{k,max} = ' + S(Ef, 4) + ' − ' + phi + ' = ' + N(Ek, 3) + ' eV.'] };
      } },
      { id: 'threshold', name: 'Threshold frequency', gen: function (r) {
        var phi = r.int(18, 60) / 10, f0 = phi * e / h;
        return { q: 'A metal has a work function of ' + phi + ' eV. Find its threshold frequency.', answer: f0, sf: 3, unit: 'Hz',
          steps: ['At threshold hf_{0} = Φ.', 'Φ = ' + phi + ' × 1.60×10^{−19} = ' + N(phi * e, 3) + ' J.', 'f_{0} = Φ/h = ' + N(f0, 3) + ' Hz.'] };
      } },
      { id: 'debroglie', name: 'de Broglie wavelength', gen: function (r) {
        var v = r.int(1, 9) * Math.pow(10, r.int(5, 7)), lam = h / (me * v);
        return { q: 'Find the de Broglie wavelength of an electron moving at ' + N(v, 3) + ' m s^{−1}.', answer: lam, sf: 3, unit: 'm',
          steps: ['λ = h/(mv).', 'λ = 6.63×10^{−34} ÷ (9.11×10^{−31} × ' + N(v, 3) + ').', 'λ = ' + N(lam, 3) + ' m.'] };
      } },
      { id: 'nucleons', name: 'Protons and neutrons', gen: function (r) {
        var el = r.pick([['C', 6, 14], ['O', 8, 17], ['Na', 11, 23], ['Cl', 17, 37], ['Fe', 26, 56], ['U', 92, 238], ['Pb', 82, 208], ['Ca', 20, 40]]), neu = r.next() < 0.5;
        return { q: 'How many ' + (neu ? 'neutrons' : 'protons') + ' are in a nucleus of ^{' + el[2] + '}_{' + el[1] + '}' + el[0] + '?', answer: neu ? el[2] - el[1] : el[1],
          steps: ['Top number A = ' + el[2] + ' (nucleons); bottom Z = ' + el[1] + ' (protons).', neu ? 'Neutrons = A − Z.' : 'Protons = Z.', neu ? el[2] + ' − ' + el[1] + ' = ' + (el[2] - el[1]) + '.' : el[1] + '.'] };
      } },
    ] });

  add({ id: 'p-decay', units: [PH('E.3')], title: 'Radioactive decay and half-life',
    method: ['α decay: A − 4, Z − 2. β^{−}: A unchanged, Z + 1 (a neutron becomes a proton). β^{+}: Z − 1. γ: no change.', 'After n half-lives the amount left is N_{0}(½)^{n}.', 'Decay constant λ = ln 2/T_{½}; N = N_{0}e^{−λt}; activity A = λN.'],
    variants: [
      { id: 'halves', name: 'Whole half-lives', gen: function (r) {
        var N0 = r.pick([800, 1600, 640, 3200, 512]), half = r.int(2, 30), n = r.int(1, 5);
        return { q: 'A sample has an activity of ' + N0 + ' Bq and a half-life of ' + half + ' days. Find its activity after ' + half * n + ' days.', answer: N0 / Math.pow(2, n), unit: 'Bq',
          steps: [half * n + ' ÷ ' + half + ' = ' + n + ' half-lives.', 'Halve ' + n + ' time' + (n > 1 ? 's' : '') + ': ' + N0 + ' × (½)^{' + n + '}.', '= ' + S(N0 / Math.pow(2, n)) + ' Bq.'] };
      } },
      { id: 'exp', name: 'N = N₀e^{−λt}', gen: function (r) {
        var N0 = r.int(1, 9) * 1000, half = r.int(2, 50), t = r.int(1, 120), lam = Math.LN2 / half, Nt = N0 * Math.exp(-lam * t);
        return { q: 'A sample has ' + N0 + ' nuclei and a half-life of ' + half + ' s. How many remain after ' + t + ' s?', answer: Nt, sf: 3,
          steps: ['λ = ln 2/' + half + ' = ' + S(lam, 5) + ' s^{−1}.', 'N = N_{0}e^{−λt} = ' + N0 + ' × e^{−' + S(lam * t, 4) + '}.', 'N = ' + N(Nt, 3) + '.'] };
      } },
      { id: 'equation', name: 'Decay equations', gen: function (r) {
        var p = r.pick([['U', 92, 238, 'Th'], ['Ra', 88, 226, 'Rn'], ['Po', 84, 210, 'Pb'], ['C', 6, 14, 'N'], ['Sr', 38, 90, 'Y'], ['Co', 27, 60, 'Ni']]), alpha = p[1] > 50;
        var A2 = alpha ? p[2] - 4 : p[2], Z2 = alpha ? p[1] - 2 : p[1] + 1, askA = r.next() < 0.5;
        return { q: '^{' + p[2] + '}_{' + p[1] + '}' + p[0] + ' undergoes ' + (alpha ? 'α' : 'β^{−}') + ' decay to ' + p[3] + '. Find the ' + (askA ? 'nucleon' : 'proton') + ' number of the ' + p[3] + ' formed.', answer: askA ? A2 : Z2,
          steps: [alpha ? 'An α particle is ^{4}_{2}He: A falls by 4, Z by 2.' : 'A β^{−} particle is ^{0}_{−1}e: A stays, Z rises by 1.', 'Product: ^{' + A2 + '}_{' + Z2 + '}' + p[3] + '.', (askA ? 'Nucleon number ' + A2 : 'Proton number ' + Z2) + '.'] };
      } },
      { id: 'time', name: 'Time to fall to a fraction', gen: function (r) {
        var half = r.int(3, 40), fr = r.pick([0.3, 0.2, 0.1, 0.05, 0.6]), t = half * Math.log(1 / fr) / Math.LN2;
        return { q: 'A radioisotope has a half-life of ' + half + ' h. How long until only ' + fr * 100 + '% of it remains?', answer: t, sf: 3, unit: 'h',
          steps: ['N/N_{0} = e^{−λt} = ' + fr + ', with λ = ln 2/' + half + '.', 't = ln(1/' + fr + ') ÷ λ = ' + half + ' × ln(' + S(1 / fr, 3) + ') ÷ ln 2.', 't = ' + N(t, 3) + ' h.'] };
      } },
    ] });

  add({ id: 'p-nuclear', units: [PH('E.4'), PH('E.5')], title: 'Mass defect, binding energy, fission, fusion and stars',
    method: ['E = mc^{2}; in atomic mass units 1 u = 931.5 MeV c^{−2}.', 'Mass defect = mass of the separate nucleons − mass of the nucleus; binding energy = mass defect × c^{2}.', 'Energy released = (mass before − mass after) × c^{2}.', 'Parallax: d (parsec) = 1/p (arc-seconds).'],
    variants: [
      { id: 'emc2', name: 'E = mc²', gen: function (r) {
        var mm = r.int(1, 99) * Math.pow(10, -r.int(3, 30));
        return { q: 'How much energy is equivalent to ' + N(mm, 2) + ' kg of mass?', answer: mm * c * c, sf: 3, unit: 'J',
          steps: ['E = mc^{2}.', 'E = ' + N(mm, 2) + ' × (3.00×10^{8})^{2}.', 'E = ' + N(mm * c * c, 3) + ' J.'] };
      } },
      { id: 'be', name: 'Binding energy per nucleon', gen: function (r) {
        var dm = r.int(5, 250) / 100, A = r.int(4, 238), BE = dm * 931.5;
        return { q: 'A nucleus with ' + A + ' nucleons has a mass defect of ' + dm + ' u. Find its binding energy per nucleon in MeV.', answer: BE / A, sf: 3, unit: 'MeV',
          steps: ['Binding energy = ' + dm + ' × 931.5 = ' + S(BE, 5) + ' MeV.', 'Divide by the ' + A + ' nucleons.', '= ' + N(BE / A, 3) + ' MeV per nucleon.'] };
      } },
      { id: 'release', name: 'Energy released in a reaction', gen: function (r) {
        var before = r.int(23500, 23600) / 100, lost = r.int(10, 25) / 100, after = T.round(before - lost, 2);
        return { q: 'In a fission reaction the total mass before is ' + before.toFixed(2) + ' u and after is ' + after.toFixed(2) + ' u. Find the energy released in MeV.', answer: lost * 931.5, sf: 3, unit: 'MeV',
          steps: ['Mass lost Δm = ' + lost.toFixed(2) + ' u.', 'E = Δm × 931.5 MeV u^{−1}.', 'E = ' + N(lost * 931.5, 3) + ' MeV.'] };
      } },
      { id: 'parallax', name: 'Stellar parallax', gen: function (r) {
        var p = r.int(5, 900) / 1000;
        return { q: 'A star has a parallax angle of ' + p + ' arc-seconds. Find its distance in parsecs.', answer: 1 / p, sf: 3, unit: 'pc',
          steps: ['d (pc) = 1/p (arc-seconds).', 'd = 1 ÷ ' + p + '.', 'd = ' + N(1 / p, 3) + ' pc.'] };
      } },
    ] });

  /* ════════════════════════ CHEMISTRY ════════════════════════ */

  var AR = { H: 1.01, C: 12.01, N: 14.01, O: 16.00, F: 19.00, Na: 22.99, Mg: 24.31, Al: 26.98, Si: 28.09, P: 30.97, S: 32.07, Cl: 35.45, K: 39.10, Ca: 40.08, Mn: 54.94, Fe: 55.85, Cu: 63.55, Zn: 65.38, Br: 79.90, Ag: 107.87, I: 126.90 };
  /** "Ca(OH)2" → {Ca: 1, O: 2, H: 2}. */
  function parseFormula(f) {
    var stack = [{}], re = /([A-Z][a-z]?|\(|\))(\d*)/g, mt;
    while ((mt = re.exec(f))) {
      var tok = mt[1], n = mt[2] ? parseInt(mt[2], 10) : 1, cur = stack[stack.length - 1];
      if (tok === '(') stack.push({});
      else if (tok === ')') { var top = stack.pop(), under = stack[stack.length - 1]; Object.keys(top).forEach(function (k) { under[k] = (under[k] || 0) + top[k] * n; }); }
      else cur[tok] = (cur[tok] || 0) + n;
    }
    return stack[0];
  }
  function Mr(f) { var p = parseFormula(f); return Object.keys(p).reduce(function (s, k) { return s + AR[k] * p[k]; }, 0); }
  function sub(f) { return f.replace(/(\d+)/g, '_{$1}'); }
  function mrLine(f) {
    var p = parseFormula(f);
    return 'M(' + sub(f) + ') = ' + Object.keys(p).map(function (k) { return (p[k] > 1 ? p[k] + ' × ' : '') + AR[k].toFixed(2); }).join(' + ') + ' = ' + Mr(f).toFixed(2) + ' g mol^{−1}';
  }
  var COMPOUNDS = ['H2O', 'CO2', 'NaCl', 'CaCO3', 'H2SO4', 'NaOH', 'C6H12O6', 'NH3', 'CH4', 'C2H5OH', 'MgO', 'Ca(OH)2', 'KMnO4', 'Na2CO3', 'HCl', 'CuSO4', 'Al2O3', 'Fe2O3', 'C3H8', 'HNO3', 'AgNO3', 'KI'];

  add({ id: 'c-moles', units: [CH('S1.4')], title: 'The mole: mass, moles and particles',
    method: ['Molar mass M: add the relative atomic masses in the formula (g mol^{−1}).', '*n = m/M* (moles from mass); m = nM (mass from moles).', 'Particles N = n × N_{A}, N_{A} = 6.02×10^{23} mol^{−1}.'],
    variants: [
      { id: 'mr', name: 'Molar mass', gen: function (r) {
        var f = r.pick(COMPOUNDS);
        return { q: 'Find the molar mass of ' + sub(f) + '.', answer: T.round(Mr(f), 2), tol: 0.002, dp: 2, unit: 'g mol^{−1}',
          steps: ['Count the atoms of each element in ' + sub(f) + '.', 'Multiply each count by the relative atomic mass, then add.', mrLine(f) + '.'] };
      } },
      { id: 'n', name: 'Moles from mass', gen: function (r) {
        var f = r.pick(COMPOUNDS), mm = r.int(1, 500) / 10, n = mm / Mr(f);
        return { q: 'How many moles are in ' + mm + ' g of ' + sub(f) + '?', answer: n, sf: 3, unit: 'mol',
          steps: [mrLine(f) + '.', 'n = m/M.', 'n = ' + mm + ' ÷ ' + Mr(f).toFixed(2) + ' = ' + N(n, 3) + ' mol.'] };
      } },
      { id: 'm', name: 'Mass from moles', gen: function (r) {
        var f = r.pick(COMPOUNDS), n = r.int(1, 300) / 100, mm = n * Mr(f);
        return { q: 'Find the mass of ' + n + ' mol of ' + sub(f) + '.', answer: mm, sf: 3, unit: 'g',
          steps: [mrLine(f) + '.', 'm = nM.', 'm = ' + n + ' × ' + Mr(f).toFixed(2) + ' = ' + N(mm, 3) + ' g.'] };
      } },
      { id: 'particles', name: 'Number of particles', gen: function (r) {
        var f = r.pick(COMPOUNDS), mm = r.int(1, 100), n = mm / Mr(f);
        return { q: 'How many molecules (formula units) are in ' + mm + ' g of ' + sub(f) + '?', answer: n * NA, sf: 3,
          steps: ['n = m/M = ' + mm + ' ÷ ' + Mr(f).toFixed(2) + ' = ' + S(n, 4) + ' mol.', 'N = n × N_{A}.', 'N = ' + S(n, 4) + ' × 6.02×10^{23} = ' + N(n * NA, 3) + '.'] };
      } },
      { id: 'atoms', name: 'Atoms of one element', gen: function (r) {
        var f = r.pick(['H2O', 'CO2', 'CH4', 'NH3', 'C6H12O6', 'H2SO4']), p = parseFormula(f), el = r.pick(Object.keys(p)), n = r.int(1, 50) / 10;
        return { q: 'How many ' + el + ' atoms are in ' + n + ' mol of ' + sub(f) + '?', answer: n * p[el] * NA, sf: 3,
          steps: ['Each ' + sub(f) + ' has ' + p[el] + ' ' + el + ' atom' + (p[el] > 1 ? 's' : '') + '.', 'Moles of ' + el + ' = ' + n + ' × ' + p[el] + ' = ' + T.round(n * p[el], 3) + '.', 'Atoms = ' + T.round(n * p[el], 3) + ' × 6.02×10^{23} = ' + N(n * p[el] * NA, 3) + '.'] };
      } },
    ] });

  var EMP = ['CH2O', 'CH2', 'C2H5', 'CH4O', 'C3H6O', 'NO2', 'C2H4O', 'MgO', 'Fe2O3', 'Na2SO4', 'C3H8', 'CH'];
  add({ id: 'c-empirical', units: [CH('S1.4')], title: 'Empirical and molecular formulas',
    method: ['Write the mass (or %) of each element.', 'Divide each by its relative atomic mass to get moles.', 'Divide every result by the smallest; multiply up if needed to reach whole numbers (× 2 for .5, × 3 for .33).', 'Molecular formula = (empirical formula)_{n} with n = M ÷ M(empirical).'],
    variants: [
      { id: 'emp', name: 'Empirical formula from %', gen: function (r) {
        var f = r.pick(EMP), p = parseFormula(f), M = Mr(f), els = Object.keys(p);
        var pct = els.map(function (k) { return T.round(AR[k] * p[k] / M * 100, 1); });
        var mol = els.map(function (k, i) { return pct[i] / AR[k]; }), small = Math.min.apply(null, mol);
        var fmt2 = function (q) { return els.map(function (k) { return k + (q[k] > 1 ? q[k] : ''); }).join(''); };
        var dbl = {}, swp = {}, bump = {};
        els.forEach(function (k, i) { dbl[k] = p[k] * 2; swp[k] = p[els[(i + 1) % els.length]]; bump[k] = p[k] + (i === 0 ? 1 : 0); });
        return Object.assign(T.choice(sub(f), [fmt2(dbl), fmt2(swp), fmt2(bump)].filter(function (x) { return x !== f; }).map(sub), r), {
          q: 'A compound is ' + els.map(function (k, i) { return pct[i] + '% ' + k; }).join(', ') + ' by mass. What is its empirical formula?',
          steps: ['Moles in 100 g: ' + els.map(function (k, i) { return k + ' ' + pct[i] + ' ÷ ' + AR[k] + ' = ' + S(mol[i], 3); }).join('; ') + '.', 'Divide by the smallest (' + S(small, 3) + '): ' + els.map(function (k, i) { return k + ' ' + S(mol[i] / small, 2); }).join(', ') + '.', 'Round to whole numbers (multiplying up if any end in .5 or .33): ' + sub(f) + '.'] });
      } },
      { id: 'mol', name: 'Molecular formula', gen: function (r) {
        var pk = r.pick([['CH2O', 6, 'glucose'], ['CH2', 3, 'propene'], ['CH', 6, 'benzene'], ['C2H5', 2, 'butane'], ['CH2O', 2, 'ethanoic acid'], ['HO', 2, 'hydrogen peroxide']]), M = T.round(Mr(pk[0]) * pk[1], 1);
        return { q: 'A compound has empirical formula ' + sub(pk[0]) + ' and molar mass ' + M + ' g mol^{−1}. How many empirical units are in one molecule (n)?', answer: pk[1],
          steps: ['M(' + sub(pk[0]) + ') = ' + Mr(pk[0]).toFixed(2) + ' g mol^{−1}.', 'n = ' + M + ' ÷ ' + Mr(pk[0]).toFixed(2) + ' ≈ ' + pk[1] + '.', 'Molecular formula (' + sub(pk[0]) + ')_{' + pk[1] + '}: ' + pk[2] + '.'] };
      } },
      { id: 'pct', name: 'Percentage by mass', gen: function (r) {
        var f = r.pick(COMPOUNDS), p = parseFormula(f), el = r.pick(Object.keys(p)), pc = AR[el] * p[el] / Mr(f) * 100;
        return { q: 'Find the percentage by mass of ' + el + ' in ' + sub(f) + '.', answer: pc, sf: 3, unit: '%',
          steps: [mrLine(f) + '.', 'Mass of ' + el + ' per mole: ' + p[el] + ' × ' + AR[el] + ' = ' + S(AR[el] * p[el], 2) + ' g.', '% = ' + S(AR[el] * p[el], 2) + ' ÷ ' + Mr(f).toFixed(2) + ' × 100 = ' + N(pc, 3) + '%.'] };
      } },
    ] });

  add({ id: 'c-solutions', units: [CH('S1.4'), CH('R2.1')], title: 'Concentration, dilution and titration',
    method: ['Concentration c = n/V with V in dm^{3} (1 dm^{3} = 1000 cm^{3}).', 'Dilution keeps the moles: c_{1}V_{1} = c_{2}V_{2}.', 'Titration: moles of the known → mole ratio from the equation → moles of the unknown → concentration.'],
    variants: [
      { id: 'conc', name: 'Concentration', gen: function (r) {
        var f = r.pick(['NaOH', 'NaCl', 'CuSO4', 'KI', 'AgNO3']), mm = r.int(1, 200) / 10, V = r.int(50, 1000), cc = mm / Mr(f) / (V / 1000);
        return { q: mm + ' g of ' + sub(f) + ' is dissolved to make ' + V + ' cm^{3} of solution. Find its concentration.', answer: cc, sf: 3, unit: 'mol dm^{−3}',
          steps: ['n = ' + mm + ' ÷ ' + Mr(f).toFixed(2) + ' = ' + S(mm / Mr(f), 4) + ' mol.', 'V = ' + V + ' cm^{3} = ' + V / 1000 + ' dm^{3}.', 'c = n/V = ' + N(cc, 3) + ' mol dm^{−3}.'] };
      } },
      { id: 'dilute', name: 'Dilution', gen: function (r) {
        var c1 = r.int(5, 200) / 100, V1 = r.int(5, 100), V2 = r.int(V1 + 10, 1000), c2 = c1 * V1 / V2;
        return { q: V1 + ' cm^{3} of ' + c1 + ' mol dm^{−3} acid is diluted to ' + V2 + ' cm^{3}. Find the new concentration.', answer: c2, sf: 3, unit: 'mol dm^{−3}',
          steps: ['Moles do not change: c_{1}V_{1} = c_{2}V_{2}.', 'c_{2} = ' + c1 + ' × ' + V1 + ' ÷ ' + V2 + '.', 'c_{2} = ' + N(c2, 3) + ' mol dm^{−3}.'] };
      } },
      { id: 'titr', name: 'Titration', gen: function (r) {
        var rx = r.pick([['HCl', 1, 'HCl + NaOH → NaCl + H_{2}O'], ['H2SO4', 2, 'H_{2}SO_{4} + 2NaOH → Na_{2}SO_{4} + 2H_{2}O']]);
        var cb = r.int(5, 20) / 100, Vb = r.int(150, 300) / 10, nb = cb * Vb / 1000, na = nb / rx[1], ca = na / 0.025;
        return { q: '25.0 cm^{3} of ' + sub(rx[0]) + ' is neutralised by ' + Vb + ' cm^{3} of ' + cb + ' mol dm^{−3} NaOH. Find the concentration of the acid. (' + rx[2] + ')', answer: ca, sf: 3, unit: 'mol dm^{−3}',
          steps: ['n(NaOH) = ' + cb + ' × ' + Vb / 1000 + ' = ' + N(nb, 3) + ' mol.', 'Acid : NaOH = 1 : ' + rx[1] + ', so n(acid) = ' + N(na, 3) + ' mol.', 'c = ' + N(na, 3) + ' ÷ 0.0250 = ' + N(ca, 3) + ' mol dm^{−3}.'] };
      } },
    ] });

  add({ id: 'c-gases', units: [CH('S1.5')], title: 'Ideal gases',
    method: ['At STP (273 K, 100 kPa) one mole of gas occupies 22.7 dm^{3}.', 'pV = nRT in SI: p in Pa, V in m^{3} (1 dm^{3} = 10^{−3} m^{3}), T in K.', 'Fixed amount: p_{1}V_{1}/T_{1} = p_{2}V_{2}/T_{2}.'],
    variants: [
      { id: 'stp', name: 'Volume at STP', gen: function (r) {
        var f = r.pick(['CO2', 'CH4', 'NH3', 'O2', 'N2', 'H2']), mm = r.int(1, 100), V = mm / Mr(f) * 22.7;
        return { q: 'What volume does ' + mm + ' g of ' + sub(f) + ' occupy at STP?', answer: V, sf: 3, unit: 'dm^{3}',
          steps: ['n = ' + mm + ' ÷ ' + Mr(f).toFixed(2) + ' = ' + S(mm / Mr(f), 4) + ' mol.', 'V = n × 22.7 dm^{3} mol^{−1}.', 'V = ' + N(V, 3) + ' dm^{3}.'] };
      } },
      { id: 'pvnrt', name: 'pV = nRT', gen: function (r) {
        var pk = r.int(80, 300), Tk = r.int(250, 500), Vd = r.int(1, 50), n = pk * 1000 * Vd / 1000 / (R * Tk);
        return { q: 'How many moles of gas are in ' + Vd + ' dm^{3} at ' + pk + ' kPa and ' + Tk + ' K?', answer: n, sf: 3, unit: 'mol',
          steps: ['SI units: p = ' + pk * 1000 + ' Pa, V = ' + Vd / 1000 + ' m^{3}.', 'n = pV/(RT) = ' + pk * 1000 + ' × ' + Vd / 1000 + ' ÷ (8.31 × ' + Tk + ').', 'n = ' + N(n, 3) + ' mol.'] };
      } },
      { id: 'molarmass', name: 'Molar mass of a gas', gen: function (r) {
        var f = r.pick(['CO2', 'CH4', 'C3H8', 'N2', 'O2']), Tk = r.int(280, 400), Vd = r.int(5, 50) / 10, n = 100000 * Vd / 1000 / (R * Tk), mm = T.round(n * Mr(f), 3);
        return { q: 'A gas sample of mass ' + mm + ' g occupies ' + Vd + ' dm^{3} at 100 kPa and ' + Tk + ' K. Find its molar mass.', answer: mm / n, sf: 3, unit: 'g mol^{−1}',
          steps: ['n = pV/(RT) = 100000 × ' + Vd / 1000 + ' ÷ (8.31 × ' + Tk + ') = ' + S(n, 4) + ' mol.', 'M = m/n.', 'M = ' + mm + ' ÷ ' + S(n, 4) + ' = ' + N(mm / n, 3) + ' g mol^{−1}.'] };
      } },
    ] });

  var ZEL = ['', 'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr'];
  function aufbau(Z) {
    var subs = [['1s', 2], ['2s', 2], ['2p', 6], ['3s', 2], ['3p', 6], ['4s', 2], ['3d', 10], ['4p', 6]], left = Z, out = [];
    subs.forEach(function (s) { if (left <= 0) return; var n = Math.min(s[1], left); out.push([s[0], n]); left -= n; });
    return out;
  }
  /** Ground state for Z ≤ 36, with the Cr and Cu exceptions. */
  function config(Z) {
    var out = aufbau(Z);
    if (Z === 24 || Z === 29) out.forEach(function (o) { if (o[0] === '4s') o[1] = 1; if (o[0] === '3d') o[1] += 1; });
    return out;
  }
  function cfg(cf) { return cf.filter(function (o) { return o[1] > 0; }).map(function (o) { return o[0] + '^{' + o[1] + '}'; }).join(' '); }
  add({ id: 'c-atoms', units: [CH('S1.2'), CH('S1.3')], title: 'Atoms, isotopes and electron configurations',
    method: ['Protons = Z; neutrons = A − Z; electrons = Z − charge.', 'Relative atomic mass = Σ(isotope mass × abundance) ÷ 100.', 'Fill sub-levels in order 1s 2s 2p 3s 3p 4s 3d 4p; s holds 2, p 6, d 10.', 'Exceptions: Cr ends 4s^{1} 3d^{5}, Cu ends 4s^{1} 3d^{10}. d-block ions lose their 4s electrons first.'],
    variants: [
      { id: 'pne', name: 'Particles in an ion', gen: function (r) {
        var ion = r.pick([['Na', 11, 23, 1], ['Mg', 12, 24, 2], ['Al', 13, 27, 3], ['O', 8, 16, -2], ['Cl', 17, 35, -1], ['S', 16, 32, -2], ['Fe', 26, 56, 3], ['Ca', 20, 40, 2], ['N', 7, 14, -3]]), el = r.next() < 0.5;
        var ch = ion[3] > 0 ? (ion[3] > 1 ? ion[3] : '') + '+' : (ion[3] < -1 ? -ion[3] : '') + '−';
        return { q: 'How many ' + (el ? 'electrons' : 'neutrons') + ' are in ^{' + ion[2] + '}' + ion[0] + '^{' + ch + '}?', answer: el ? ion[1] - ion[3] : ion[2] - ion[1],
          steps: [ion[0] + ': Z = ' + ion[1] + ' protons, A = ' + ion[2] + '.', el ? 'Charge ' + ch + ': ' + (ion[3] > 0 ? 'lost ' : 'gained ') + Math.abs(ion[3]) + ' electron' + (Math.abs(ion[3]) > 1 ? 's' : '') + '.' : 'Neutrons = A − Z.', el ? 'Electrons = ' + ion[1] + ' − ' + b(ion[3]) + ' = ' + (ion[1] - ion[3]) + '.' : ion[2] + ' − ' + ion[1] + ' = ' + (ion[2] - ion[1]) + '.'] };
      } },
      { id: 'ar', name: 'Relative atomic mass', gen: function (r) {
        var iso = r.pick([['Cl', 35, 75.8, 37, 24.2], ['Cu', 63, 69.2, 65, 30.8], ['B', 10, 19.9, 11, 80.1], ['Br', 79, 50.7, 81, 49.3], ['Li', 6, 7.6, 7, 92.4], ['Ga', 69, 60.1, 71, 39.9]]), ar = (iso[1] * iso[2] + iso[3] * iso[4]) / 100;
        return { q: iso[0] + ' is ' + iso[2] + '% ^{' + iso[1] + '}' + iso[0] + ' and ' + iso[4] + '% ^{' + iso[3] + '}' + iso[0] + '. Find its relative atomic mass.', answer: T.round(ar, 2), tol: 0.001, dp: 2,
          steps: ['A weighted mean of the isotope masses.', 'A_{r} = (' + iso[1] + ' × ' + iso[2] + ' + ' + iso[3] + ' × ' + iso[4] + ') ÷ 100.', 'A_{r} = ' + ar.toFixed(2) + '.'] };
      } },
      { id: 'config', name: 'Electron configuration', gen: function (r) {
        var Z = r.pick([7, 8, 11, 13, 15, 16, 17, 19, 20, 22, 24, 25, 26, 29, 30, 33, 35]), right = cfg(config(Z));
        var wrong = [cfg(aufbau(Z)), cfg(config(Z + 1)), cfg(config(Z - 1))];
        return Object.assign(T.choice(right, wrong.filter(function (x) { return x !== right; }), r), {
          q: 'Which is the ground-state electron configuration of ' + ZEL[Z] + ' (Z = ' + Z + ')?',
          steps: ['Fill 1s, 2s, 2p, 3s, 3p, 4s, 3d, 4p in order until ' + Z + ' electrons are placed.', Z === 24 || Z === 29 ? ZEL[Z] + ' is an exception: one 4s electron moves into 3d to give a ' + (Z === 24 ? 'half-full' : 'full') + ' d sub-level.' : 'Check the superscripts add to ' + Z + '.', right + '.'] });
      } },
      { id: 'ion', name: 'Configuration of a d-block ion', gen: function (r) {
        var io = r.pick([[26, 2], [26, 3], [29, 2], [29, 1], [25, 2], [24, 3], [30, 2], [27, 2], [28, 2], [22, 2]]), Z = io[0], q = io[1];
        var cf = config(Z).map(function (o) { return [o[0], o[1]]; }), left = q;
        cf.forEach(function (o) { if (o[0] === '4s') { var t = Math.min(o[1], left); o[1] -= t; left -= t; } });
        cf.forEach(function (o) { if (o[0] === '3d' && left > 0) { o[1] -= left; left = 0; } });
        var right = cfg(cf), d = cf.filter(function (o) { return o[0] === '3d'; })[0][1];
        var wrongs = [cfg(aufbau(Z - q)), cfg(config(Z)), right.replace(/3d\^\{\d+\}/, '4s^{2} 3d^{' + Math.max(0, d - 2) + '}')];
        return Object.assign(T.choice(right, wrongs.filter(function (x) { return x !== right; }), r), {
          q: 'Which is the electron configuration of ' + ZEL[Z] + '^{' + q + '+}?',
          steps: [ZEL[Z] + ': ' + cfg(config(Z)) + '.', 'd-block ions lose their 4s electrons before 3d.', 'Take away ' + q + ': ' + right + '.'] });
      } },
    ] });

  add({ id: 'c-bonding', units: [CH('S2.1'), CH('S2.2')], title: 'Ionic formulas, shapes and polarity',
    method: ['Ionic formula: balance the charges to zero; brackets round a polyatomic ion used more than once.', 'VSEPR: count electron domains round the central atom (each bond, single or multiple, is one; each lone pair is one).', '2 domains linear 180°; 3 trigonal planar 120°; 4 tetrahedral 109.5°. Lone pairs repel more and squeeze the angle: NH_{3} 107°, H_{2}O 104.5°.', 'A molecule is polar if it has polar bonds that a symmetric shape does not cancel.'],
    variants: [
      { id: 'ionic', name: 'Formula of an ionic compound', gen: function (r) {
        var cat = r.pick([['Na', 1], ['K', 1], ['Mg', 2], ['Ca', 2], ['Al', 3], ['Fe', 3], ['Cu', 2], ['NH4', 1]]), an = r.pick([['Cl', 1], ['O', 2], ['S', 2], ['N', 3], ['OH', 1], ['NO3', 1], ['SO4', 2], ['CO3', 2], ['PO4', 3]]);
        var gg = T.gcd(cat[1], an[1]), nc = an[1] / gg, na = cat[1] / gg;
        var part = function (ion, n) { var poly = ion.length > 2 || /\d/.test(ion) || ion === 'OH'; return n === 1 ? ion : poly ? '(' + ion + ')' + n : ion + n; };
        var f = part(cat[0], nc) + part(an[0], na);
        var wrong = [part(cat[0], na) + part(an[0], nc), part(cat[0], 1) + part(an[0], 1), part(cat[0], cat[1]) + part(an[0], an[1]), part(cat[0], nc + 1) + part(an[0], na), part(cat[0], nc) + part(an[0], na + 1)];
        // "NaN" (Na + N) would read as a glitch, so it is never offered.
        return Object.assign(T.choice(sub(f), wrong.filter(function (x) { return x !== f && x !== 'NaN'; }).map(sub), r), {
          q: 'What is the formula of the compound of ' + cat[0] + '^{' + (cat[1] > 1 ? cat[1] : '') + '+} and ' + an[0] + '^{' + (an[1] > 1 ? an[1] : '') + '−} ions?',
          steps: ['Charges +' + cat[1] + ' and −' + an[1] + '.', 'Total zero: ' + nc + ' × (+' + cat[1] + ') + ' + na + ' × (−' + an[1] + ') = 0.', 'Formula: ' + sub(f) + '.'] });
      } },
      { id: 'vsepr', name: 'Shape and bond angle', gen: function (r) {
        var mol = r.pick([['CO2', 'Linear, 180°'], ['BF3', 'Trigonal planar, 120°'], ['CH4', 'Tetrahedral, 109.5°'], ['NH3', 'Trigonal pyramidal, 107°'], ['H2O', 'Bent, 104.5°'], ['HCN', 'Linear, 180°'], ['SF6', 'Octahedral, 90°'], ['PCl5', 'Trigonal bipyramidal, 90° and 120°'], ['CCl4', 'Tetrahedral, 109.5°']]);
        var all = ['Linear, 180°', 'Trigonal planar, 120°', 'Tetrahedral, 109.5°', 'Trigonal pyramidal, 107°', 'Bent, 104.5°', 'Octahedral, 90°'];
        return Object.assign(T.choice(mol[1], r.sample(all.filter(function (x) { return x !== mol[1]; }), 3), r), {
          q: 'What are the shape and bond angle of ' + sub(mol[0]) + '?',
          steps: ['Draw the Lewis structure; count the domains (bonds + lone pairs) round the central atom.', 'Domains set the arrangement; lone pairs are left out of the shape’s name but squeeze the angles.', sub(mol[0]) + ': ' + mol[1] + '.'] });
      } },
      { id: 'polar', name: 'Polar or non-polar?', gen: function (r) {
        var mol = r.pick([['CO2', 0], ['H2O', 1], ['CH4', 0], ['NH3', 1], ['CCl4', 0], ['CHCl3', 1], ['BF3', 0], ['HCl', 1], ['SO2', 1]]);
        var ans = mol[1] ? 'Polar' : 'Non-polar';
        return Object.assign(T.choice(ans, ['Polar', 'Non-polar']), { q: 'Is ' + sub(mol[0]) + ' a polar molecule?',
          steps: ['Are its bonds polar (different electronegativities)?', 'Does the shape cancel the dipoles? Symmetric shapes do.', sub(mol[0]) + ' is ' + ans.toLowerCase() + '.'] });
      } },
    ] });

  add({ id: 'c-periodic', units: [CH('S3.1')], title: 'Periodic trends',
    method: ['Across a period: more nuclear charge, similar shielding → smaller radius, higher ionisation energy and electronegativity.', 'Down a group: more shells and shielding → larger radius, lower ionisation energy and electronegativity.', 'First ionisation energy dips from group 2 to 13 and from 15 to 16.'],
    variants: [
      { id: 'radius', name: 'Larger atomic radius', gen: function (r) {
        var p = r.pick([['Na', 'Cl', 'Na'], ['Li', 'K', 'K'], ['Mg', 'S', 'Mg'], ['F', 'I', 'I'], ['C', 'O', 'C'], ['Al', 'Ga', 'Ga'], ['N', 'P', 'P']]);
        return Object.assign(T.choice(p[2], [p[0], p[1]]), { q: 'Which has the larger atomic radius: ' + p[0] + ' or ' + p[1] + '?',
          steps: ['Same period (across) or same group (down)?', 'Radius falls across a period and rises down a group.', p[2] + '.'] });
      } },
      { id: 'ie', name: 'Higher first ionisation energy', gen: function (r) {
        var p = r.pick([['Na', 'Mg', 'Mg'], ['Li', 'Na', 'Li'], ['C', 'N', 'N'], ['Cl', 'Br', 'Cl'], ['Ne', 'Na', 'Ne'], ['Mg', 'Al', 'Mg'], ['N', 'O', 'N']]);
        var note = p[0] === 'Mg' && p[1] === 'Al' ? ': Al’s outer electron is in a higher 3p sub-level' : p[0] === 'N' && p[1] === 'O' ? ': O has a paired 2p electron that is easier to remove' : '';
        return Object.assign(T.choice(p[2], [p[0], p[1]]), { q: 'Which has the higher first ionisation energy: ' + p[0] + ' or ' + p[1] + '?',
          steps: ['It rises across a period and falls down a group.', 'Watch the dips from group 2 to 13 and from 15 to 16.', p[2] + note + '.'] });
      } },
      { id: 'en', name: 'More electronegative', gen: function (r) {
        var p = r.pick([['F', 'Cl', 'F'], ['O', 'S', 'O'], ['C', 'N', 'N'], ['Na', 'Cl', 'Cl'], ['Br', 'I', 'Br'], ['P', 'S', 'S']]);
        return Object.assign(T.choice(p[2], [p[0], p[1]]), { q: 'Which is more electronegative: ' + p[0] + ' or ' + p[1] + '?',
          steps: ['Electronegativity rises across a period and falls down a group.', 'F is the most electronegative element.', p[2] + '.'] });
      } },
    ] });

  var ORG = [['CH4', 'methane'], ['C2H6', 'ethane'], ['C3H8', 'propane'], ['C4H10', 'butane'], ['C5H12', 'pentane'], ['C2H4', 'ethene'], ['C3H6', 'propene'], ['CH3OH', 'methanol'], ['C2H5OH', 'ethanol'], ['HCOOH', 'methanoic acid'], ['CH3COOH', 'ethanoic acid'], ['CH3CHO', 'ethanal'], ['CH3COCH3', 'propanone'], ['CH3Cl', 'chloromethane'], ['CH3NH2', 'methanamine'], ['CH3COOCH3', 'methyl ethanoate']];
  add({ id: 'c-organic', units: [CH('S3.2'), CH('R3.4')], title: 'Organic naming and functional groups',
    method: ['Longest carbon chain: meth- 1, eth- 2, prop- 3, but- 4, pent- 5, hex- 6.', 'Ending = functional group: -ane, -ene (C=C), -ol (−OH), -al (−CHO), -one (C=O in the chain), -oic acid (−COOH), -oate (ester), -amine (−NH_{2}).', 'Number the chain to give the functional group the lowest number.', 'A homologous series shares a general formula; each member adds CH_{2}.'],
    variants: [
      { id: 'name', name: 'Name the compound', gen: function (r) {
        var o = r.pick(ORG);
        return Object.assign(T.choice(o[1], r.sample(ORG.filter(function (x) { return x[1] !== o[1]; }), 3).map(function (x) { return x[1]; }), r), { q: 'Name ' + sub(o[0]) + '.',
          steps: ['Count the carbons.', 'Find the functional group in the formula.', o[1] + '.'] });
      } },
      { id: 'group', name: 'Identify the functional group', gen: function (r) {
        var gs = [['CH3COOH', 'Carboxyl (carboxylic acid)'], ['C2H5OH', 'Hydroxyl (alcohol)'], ['CH3CHO', 'Carbonyl (aldehyde)'], ['CH3COCH3', 'Carbonyl (ketone)'], ['C2H4', 'Alkenyl (C=C)'], ['CH3NH2', 'Amino (amine)'], ['CH3COOCH3', 'Ester'], ['CH3Br', 'Halogeno (halogenoalkane)']], gp = r.pick(gs);
        return Object.assign(T.choice(gp[1], r.sample(gs.filter(function (x) { return x[1] !== gp[1]; }), 3).map(function (x) { return x[1]; }), r), { q: 'Which functional group is in ' + sub(gp[0]) + '?',
          steps: ['Look past the C−H and C−C framework.', 'The remaining group of atoms is the functional group.', gp[1] + '.'] });
      } },
      { id: 'series', name: 'Formula from the series', gen: function (r) {
        var s = r.pick([['alkane', 2, 2, 'C_{n}H_{2n+2}'], ['alkene', 2, 0, 'C_{n}H_{2n}']]), n = r.int(2, 8);
        var f = function (k) { return 'C' + k + 'H' + (2 * k + s[2]); };
        return Object.assign(T.choice(sub(f(n)), [sub(f(n + 1)), sub(f(n - 1)), sub('C' + n + 'H' + (2 * n + 2 - s[2] + (s[2] ? -2 : 2)))].filter(function (x) { return x !== sub(f(n)); }), r), {
          q: 'What is the molecular formula of the ' + s[0] + ' with ' + n + ' carbon atoms?',
          steps: ['General formula: ' + s[3] + '.', 'n = ' + n + '.', sub(f(n)) + '.'] });
      } },
    ] });

  add({ id: 'c-enthalpy', units: [CH('R1.1'), CH('R1.2'), CH('R1.3'), CH('R1.4')], title: 'Energetics: calorimetry, Hess’s law, bond enthalpies and Gibbs energy',
    method: ['Calorimetry: q = mcΔT (m of the solution in g, c = 4.18 J g^{−1} K^{−1}); ΔH = −q/n. A temperature rise means exothermic (ΔH < 0).', 'Formation enthalpies: ΔH = ΣΔH_{f}(products) − ΣΔH_{f}(reactants).', 'Bond enthalpies: ΔH = Σ(bonds broken) − Σ(bonds formed).', 'Gibbs: ΔG = ΔH − TΔS (ΔS in kJ); negative ΔG is spontaneous.'],
    variants: [
      { id: 'calor', name: 'ΔH from calorimetry', gen: function (r) {
        var V = r.pick([25, 50, 100]), dT = r.int(20, 150) / 10, n = r.int(10, 100) / 1000, q = V * 4.18 * dT, dH = -q / n / 1000;
        return { q: 'A reaction of ' + n + ' mol (the limiting reactant) in ' + V + ' cm^{3} of solution raises the temperature by ' + dT + ' °C. Find ΔH in kJ mol^{−1} (c = 4.18 J g^{−1} K^{−1}, density 1.00 g cm^{−3}).', answer: dH, sf: 3, unit: 'kJ mol^{−1}',
          steps: ['q = mcΔT = ' + V + ' × 4.18 × ' + dT + ' = ' + S(q, 4) + ' J.', 'Per mole: ' + S(q, 4) + ' ÷ ' + n + ' = ' + N(q / n / 1000, 3) + ' kJ mol^{−1}.', 'Temperature rose → exothermic: ΔH = ' + N(dH, 3) + ' kJ mol^{−1}.'] };
      } },
      { id: 'hessf', name: 'Hess’s law with ΔH_f', gen: function (r) {
        var rx = r.pick([
          ['CH_{4} + 2O_{2} → CO_{2} + 2H_{2}O', -74.8, -393.5 - 2 * 285.8, 'CH_{4} −74.8, CO_{2} −393.5, H_{2}O(l) −285.8'],
          ['C_{2}H_{5}OH + 3O_{2} → 2CO_{2} + 3H_{2}O', -277.6, -2 * 393.5 - 3 * 285.8, 'C_{2}H_{5}OH −277.6, CO_{2} −393.5, H_{2}O(l) −285.8'],
          ['CaCO_{3} → CaO + CO_{2}', -1207.6, -634.9 - 393.5, 'CaCO_{3} −1207.6, CaO −634.9, CO_{2} −393.5'],
          ['2NO + O_{2} → 2NO_{2}', 2 * 91.3, 2 * 33.2, 'NO +91.3, NO_{2} +33.2']]);
        var dH = T.round(rx[2] - rx[1], 1);
        return { q: 'Find ΔH for ' + rx[0] + '. ΔH_{f} / kJ mol^{−1}: ' + rx[3] + '; elements 0.', answer: dH, tol: 0.002, dp: 1, unit: 'kJ mol^{−1}',
          steps: ['ΔH = ΣΔH_{f}(products) − ΣΔH_{f}(reactants), times the coefficients.', 'Products ' + S(rx[2], 1) + '; reactants ' + S(rx[1], 1) + '.', 'ΔH = ' + m(S(rx[2], 1)) + ' − ' + b(T.round(rx[1], 1)) + ' = ' + m(dH.toFixed(1)) + ' kJ mol^{−1}.'] };
      } },
      { id: 'bonds', name: 'Bond enthalpies', gen: function (r) {
        var rx = r.pick([
          ['H_{2} + Cl_{2} → 2HCl', 436 + 242, 2 * 431, 'H−H 436, Cl−Cl 242, H−Cl 431'],
          ['CH_{4} + 2O_{2} → CO_{2} + 2H_{2}O (all gases)', 4 * 414 + 2 * 498, 2 * 804 + 4 * 463, 'C−H 414, O=O 498, C=O 804, O−H 463'],
          ['N_{2} + 3H_{2} → 2NH_{3}', 945 + 3 * 436, 6 * 391, 'N≡N 945, H−H 436, N−H 391'],
          ['C_{2}H_{4} + H_{2} → C_{2}H_{6}', 614 + 436, 346 + 2 * 414, 'C=C 614, H−H 436, C−C 346, C−H 414 (only the bonds that change)']]);
        return { q: 'Use bond enthalpies (kJ mol^{−1}: ' + rx[3] + ') to estimate ΔH for ' + rx[0] + '.', answer: rx[1] - rx[2], unit: 'kJ mol^{−1}',
          steps: ['Bonds broken (energy in): ' + rx[1] + ' kJ.', 'Bonds formed (energy out): ' + rx[2] + ' kJ.', 'ΔH = ' + rx[1] + ' − ' + rx[2] + ' = ' + m(rx[1] - rx[2]) + ' kJ mol^{−1}.'] };
      } },
      { id: 'comb', name: 'Balance a combustion', gen: function (r) {
        var n = r.int(1, 8), Hn = 2 * n + 2, o2 = (3 * n + 1) / 2, mult = o2 === Math.round(o2) ? 1 : 2;
        return { q: 'Balance the complete combustion of C_{' + n + '}H_{' + Hn + '} with the smallest whole numbers. What is the coefficient of O_{2}?', answer: o2 * mult,
          steps: ['C: ' + n + ' CO_{2}. H: ' + Hn + ' H → ' + (n + 1) + ' H_{2}O.', 'O atoms needed: ' + 2 * n + ' + ' + (n + 1) + ' = ' + (3 * n + 1) + ', i.e. ' + S(o2) + ' O_{2}.', mult === 2 ? 'Double to clear the half: 2C_{' + n + '}H_{' + Hn + '} + ' + 2 * o2 + 'O_{2} → ' + 2 * n + 'CO_{2} + ' + 2 * (n + 1) + 'H_{2}O.' : 'C_{' + n + '}H_{' + Hn + '} + ' + o2 + 'O_{2} → ' + n + 'CO_{2} + ' + (n + 1) + 'H_{2}O.'] };
      } },
      { id: 'gibbs', name: 'Gibbs energy', gen: function (r) {
        var dH = r.int(-200, 200), dS = r.nz(-300, 300), Tk = r.int(250, 1200), dG = dH - Tk * dS / 1000;
        return { q: 'A reaction has ΔH = ' + m(dH) + ' kJ mol^{−1} and ΔS = ' + m(dS) + ' J K^{−1} mol^{−1}. Find ΔG at ' + Tk + ' K.', answer: dG, sf: 3, unit: 'kJ mol^{−1}',
          steps: ['ΔG = ΔH − TΔS with ΔS = ' + m(dS / 1000) + ' kJ K^{−1} mol^{−1}.', 'ΔG = ' + m(dH) + ' − ' + Tk + ' × ' + b(dS / 1000) + '.', 'ΔG = ' + N(dG, 3) + ' kJ mol^{−1}: ' + (dG < 0 ? 'spontaneous.' : 'not spontaneous.')] };
      } },
    ] });

  add({ id: 'c-stoich', units: [CH('R2.1')], title: 'Reacting masses, limiting reagent and yield',
    method: ['Moles of what you know (n = m/M) → mole ratio from the equation → moles of what you want → mass (m = nM).', 'Limiting reagent: divide each reactant’s moles by its coefficient; the smallest runs out first.', '% yield = actual ÷ theoretical × 100. Atom economy = M(wanted product) ÷ M(all reactants) × 100.'],
    variants: [
      { id: 'mass', name: 'Reacting masses', gen: function (r) {
        var rx = r.pick([['CaCO3', 1, 'CO2', 1, 'CaCO_{3} → CaO + CO_{2}'], ['Mg', 2, 'MgO', 2, '2Mg + O_{2} → 2MgO'], ['C3H8', 1, 'CO2', 3, 'C_{3}H_{8} + 5O_{2} → 3CO_{2} + 4H_{2}O'], ['Fe2O3', 1, 'Fe', 2, 'Fe_{2}O_{3} + 3CO → 2Fe + 3CO_{2}'], ['Al', 4, 'Al2O3', 2, '4Al + 3O_{2} → 2Al_{2}O_{3}']]);
        var mm = r.int(5, 200) / 10, n1 = mm / Mr(rx[0]), n2 = n1 * rx[3] / rx[1], m2 = n2 * Mr(rx[2]);
        return { q: rx[4] + '. What mass of ' + sub(rx[2]) + ' forms from ' + mm + ' g of ' + sub(rx[0]) + '?', answer: m2, sf: 3, unit: 'g',
          steps: ['n(' + sub(rx[0]) + ') = ' + mm + ' ÷ ' + Mr(rx[0]).toFixed(2) + ' = ' + S(n1, 4) + ' mol.', 'Ratio ' + rx[1] + ' : ' + rx[3] + ' → n(' + sub(rx[2]) + ') = ' + S(n2, 4) + ' mol.', 'm = ' + S(n2, 4) + ' × ' + Mr(rx[2]).toFixed(2) + ' = ' + N(m2, 3) + ' g.'] };
      } },
      { id: 'limit', name: 'Limiting reagent', gen: function (r) {
        var mMg = r.int(10, 100) / 10, mO = r.int(10, 100) / 10, nMg = mMg / 24.31, nO2 = mO / 32.00;
        if (Math.abs(nMg / 2 - nO2) < 0.005) return null;
        var lim = nMg / 2 < nO2 ? 'Mg' : 'O₂';
        return Object.assign(T.choice(lim, ['Mg', 'O₂']), { q: '2Mg + O_{2} → 2MgO. ' + mMg + ' g of Mg reacts with ' + mO + ' g of O_{2}. Which is the limiting reagent?',
          steps: ['n(Mg) = ' + mMg + ' ÷ 24.31 = ' + S(nMg, 4) + '; n(O_{2}) = ' + mO + ' ÷ 32.00 = ' + S(nO2, 4) + '.', 'Divide by the coefficients: Mg ' + S(nMg / 2, 4) + ', O_{2} ' + S(nO2, 4) + '.', 'The smaller runs out first: ' + lim + '.'] });
      } },
      { id: 'yield', name: 'Percentage yield', gen: function (r) {
        var theo = r.int(20, 200) / 10, act = T.round(theo * r.int(40, 98) / 100, 2);
        return { q: 'The theoretical yield is ' + theo + ' g and ' + act + ' g is obtained. Find the percentage yield.', answer: act / theo * 100, sf: 3, unit: '%',
          steps: ['% yield = actual ÷ theoretical × 100.', '= ' + act + ' ÷ ' + theo + ' × 100.', '= ' + N(act / theo * 100, 3) + '%.'] };
      } },
      { id: 'atomecon', name: 'Atom economy', gen: function (r) {
        var rx = r.pick([[['CaCO3'], 'CaO', 1], [['C2H4', 'H2O'], 'C2H5OH', 1], [['Fe2O3', 'CO', 'CO', 'CO'], 'Fe', 2], [['C6H12O6'], 'C2H5OH', 2]]);
        var react = rx[0].reduce(function (s, f) { return s + Mr(f); }, 0), prod = Mr(rx[1]) * rx[2], ae = prod / react * 100;
        return { q: 'Find the atom economy for making ' + (rx[2] > 1 ? rx[2] + ' ' : '') + sub(rx[1]) + ' from ' + rx[0].map(sub).join(' + ') + '.', answer: ae, sf: 3, unit: '%',
          steps: ['Total mass of reactants: ' + S(react, 2) + '.', 'Mass of wanted product: ' + (rx[2] > 1 ? rx[2] + ' × ' : '') + Mr(rx[1]).toFixed(2) + ' = ' + S(prod, 2) + '.', 'Atom economy = ' + S(prod, 2) + ' ÷ ' + S(react, 2) + ' × 100 = ' + N(ae, 3) + '%.'] };
      } },
    ] });

  add({ id: 'c-rates', units: [CH('R2.2')], title: 'Rates of reaction',
    method: ['Rate = change in amount ÷ time; from a graph, the gradient of the tangent.', 'Collision theory: concentration, pressure, surface area and temperature raise the frequency of successful collisions; a catalyst lowers E_{a}.', 'Rate law (HL): rate = k[A]^{m}[B]^{n}. Order 1: double [A] → double the rate; order 2 → four times; order 0 → no change.'],
    variants: [
      { id: 'mean', name: 'Mean rate', gen: function (r) {
        var V = r.int(10, 100), t = r.int(10, 120);
        return { q: V + ' cm^{3} of gas is made in ' + t + ' s. Find the mean rate.', answer: V / t, sf: 3, unit: 'cm^{3} s^{−1}',
          steps: ['Rate = amount ÷ time.', '= ' + V + ' ÷ ' + t + '.', '= ' + N(V / t, 3) + ' cm^{3} s^{−1}.'] };
      } },
      { id: 'order', name: 'Order from data', gen: function (r) {
        var ord = r.int(0, 2), f = r.pick([2, 3]), rate0 = r.int(1, 9) / 1000;
        return { q: 'Multiplying [A] by ' + f + ' (all else constant) changes the rate from ' + N(rate0, 2) + ' to ' + N(rate0 * Math.pow(f, ord), 3) + ' mol dm^{−3} s^{−1}. What is the order with respect to A?', answer: ord,
          steps: ['Rate ∝ [A]^{m}: the rate is multiplied by ' + f + '^{m}.', 'It was multiplied by ' + Math.pow(f, ord) + ' = ' + f + '^{' + ord + '}.', 'm = ' + ord + '.'] };
      } },
      { id: 'newrate', name: 'Predict a new rate', gen: function (r) {
        var m1 = r.int(0, 2), n1 = r.int(0, 2), fa = r.pick([2, 3]), fb = r.pick([1, 2, 3]), rate = r.int(1, 50) / 1000, nr = rate * Math.pow(fa, m1) * Math.pow(fb, n1);
        return { q: 'Rate = k[A]^{' + m1 + '}[B]^{' + n1 + '} and the rate is ' + N(rate, 2) + ' mol dm^{−3} s^{−1}. Find the rate when [A] is multiplied by ' + fa + ' and [B] by ' + fb + '.', answer: nr, sf: 3, unit: 'mol dm^{−3} s^{−1}',
          steps: ['From A: ' + fa + '^{' + m1 + '} = ' + Math.pow(fa, m1) + '. From B: ' + fb + '^{' + n1 + '} = ' + Math.pow(fb, n1) + '.', 'New rate = ' + N(rate, 2) + ' × ' + Math.pow(fa, m1) + ' × ' + Math.pow(fb, n1) + '.', '= ' + N(nr, 3) + ' mol dm^{−3} s^{−1}.'] };
      } },
      { id: 'why', name: 'Why does the rate change?', gen: function (r) {
        var opts = [['Raising the temperature', 'More particles have at least the activation energy, and they collide more often'], ['Adding a catalyst', 'It provides a pathway with a lower activation energy'], ['Crushing a solid into powder', 'A larger surface area gives more frequent collisions'], ['Increasing the concentration', 'More particles per unit volume give more frequent collisions']];
        var p = r.pick(opts);
        return Object.assign(T.choice(p[1], opts.filter(function (x) { return x !== p; }).map(function (x) { return x[1]; }).concat(['The activation energy increases']), r), {
          q: p[0] + ' increases the rate. Why?',
          steps: ['The rate depends on how often particles collide with at least the activation energy.', 'Ask which part of that this change affects.', p[1] + '.'] });
      } },
    ] });

  add({ id: 'c-equil', units: [CH('R2.3')], title: 'Equilibrium',
    method: ['For aA + bB ⇌ cC + dD: K_{c} = [C]^{c}[D]^{d} / ([A]^{a}[B]^{b}), with equilibrium concentrations.', 'The reaction quotient Q has the same form at any moment: Q < K goes forwards; Q > K goes backwards.', 'Le Chatelier: the position shifts to oppose a change. Only temperature changes K; a catalyst changes nothing but the speed.'],
    variants: [
      { id: 'kc', name: 'Calculate K_c', gen: function (r) {
        var A = r.int(1, 20) / 10, B = r.int(1, 20) / 10, C = r.int(1, 30) / 10, kc = C * C / (A * Math.pow(B, 3));
        return { q: 'For N_{2} + 3H_{2} ⇌ 2NH_{3} at equilibrium, [N_{2}] = ' + A + ', [H_{2}] = ' + B + ', [NH_{3}] = ' + C + ' mol dm^{−3}. Find K_{c}.', answer: kc, sf: 3,
          steps: ['K_{c} = [NH_{3}]^{2} / ([N_{2}][H_{2}]^{3}).', '= ' + C + '^{2} ÷ (' + A + ' × ' + B + '^{3}).', '= ' + N(kc, 3) + '.'] };
      } },
      { id: 'q', name: 'Which way will it go?', gen: function (r) {
        var K = r.int(1, 99) / 10, Q = r.int(1, 99) / 10;
        if (Q === K) return null;
        var ans = Q < K ? 'Forwards, making more products' : 'Backwards, making more reactants';
        return Object.assign(T.choice(ans, ['Forwards, making more products', 'Backwards, making more reactants', 'Nowhere: it is at equilibrium']), {
          q: 'K_{c} = ' + K + ' and the reaction quotient is Q = ' + Q + '. Which way does the reaction go?',
          steps: ['Compare Q with K.', 'Q ' + (Q < K ? '<' : '>') + ' K.', ans + '.'] });
      } },
      { id: 'lc', name: 'Le Chatelier', gen: function (r) {
        var cs = [['N_{2} + 3H_{2} ⇌ 2NH_{3} (ΔH < 0)', 'The pressure is increased', 'Right: fewer moles of gas'], ['N_{2} + 3H_{2} ⇌ 2NH_{3} (ΔH < 0)', 'The temperature is increased', 'Left: the endothermic direction'], ['2SO_{2} + O_{2} ⇌ 2SO_{3} (ΔH < 0)', 'More O_{2} is added', 'Right: to use up the added O_{2}'], ['H_{2} + I_{2} ⇌ 2HI', 'The pressure is increased', 'No shift: equal moles of gas each side'], ['N_{2}O_{4} ⇌ 2NO_{2} (ΔH > 0)', 'The temperature is increased', 'Right: the endothermic direction'], ['2SO_{2} + O_{2} ⇌ 2SO_{3} (ΔH < 0)', 'A catalyst is added', 'No shift: equilibrium is reached faster']];
        var p = r.pick(cs), all = cs.map(function (x) { return x[2]; }).concat(['Left: more moles of gas']).filter(function (x, i, a) { return a.indexOf(x) === i && x !== p[2]; });
        return Object.assign(T.choice(p[2], r.sample(all, 3), r), { q: p[0] + '. ' + p[1] + '. Which way does the position of equilibrium move?',
          steps: ['Le Chatelier: the system shifts to oppose the change.', 'Pressure → side with fewer gas moles; heat → endothermic direction; extra substance → used up; catalyst → no shift.', p[2] + '.'] });
      } },
    ] });

  add({ id: 'c-acids', units: [CH('R3.1')], title: 'Acids, bases and pH',
    method: ['pH = −log[H^{+}]; [H^{+}] = 10^{−pH}.', 'Strong acids and bases dissociate fully: 0.010 mol dm^{−3} HCl has [H^{+}] = 0.010.', 'At 25 °C, K_{w} = [H^{+}][OH^{−}] = 1.00×10^{−14}, so pH + pOH = 14.', 'Weak acid (HL): [H^{+}] ≈ √(K_{a}c).'],
    variants: [
      { id: 'strong', name: 'pH of a strong acid', gen: function (r) {
        var cc = r.int(1, 9) * Math.pow(10, -r.int(1, 4)), ph = -Math.log10(cc);
        return { q: 'Find the pH of ' + N(cc, 2) + ' mol dm^{−3} HCl.', answer: ph, abs: 0.006, dp: 2,
          steps: ['Strong acid: [H^{+}] = ' + N(cc, 2) + '.', 'pH = −log(' + N(cc, 2) + ').', 'pH = ' + ph.toFixed(2) + '.'] };
      } },
      { id: 'h', name: '[H⁺] from pH', gen: function (r) {
        var ph = r.int(10, 130) / 10, hh = Math.pow(10, -ph);
        return { q: 'A solution has pH ' + ph + '. Find [H^{+}].', answer: hh, sf: 3, unit: 'mol dm^{−3}',
          steps: ['[H^{+}] = 10^{−pH}.', '= 10^{−' + ph + '}.', '= ' + N(hh, 3) + ' mol dm^{−3}.'] };
      } },
      { id: 'base', name: 'pH of a strong base', gen: function (r) {
        var cc = r.int(1, 9) * Math.pow(10, -r.int(1, 4)), poh = -Math.log10(cc);
        return { q: 'Find the pH of ' + N(cc, 2) + ' mol dm^{−3} NaOH at 25 °C.', answer: 14 - poh, abs: 0.006, dp: 2,
          steps: ['Strong base: [OH^{−}] = ' + N(cc, 2) + '.', 'pOH = −log(' + N(cc, 2) + ') = ' + poh.toFixed(2) + '.', 'pH = 14 − ' + poh.toFixed(2) + ' = ' + (14 - poh).toFixed(2) + '.'] };
      } },
      { id: 'weak', name: 'pH of a weak acid', gen: function (r) {
        var Ka = r.int(1, 9) * Math.pow(10, -r.int(4, 6)), cc = r.int(1, 20) / 100, hh = Math.sqrt(Ka * cc), ph = -Math.log10(hh);
        return { q: 'A weak acid has K_{a} = ' + N(Ka, 2) + '. Find the pH of a ' + cc + ' mol dm^{−3} solution.', answer: ph, abs: 0.006, dp: 2,
          steps: ['Little dissociation: [H^{+}]^{2} ≈ K_{a} × c.', '[H^{+}] = √(' + N(Ka, 2) + ' × ' + cc + ') = ' + N(hh, 3) + '.', 'pH = ' + ph.toFixed(2) + '.'] };
      } },
      { id: 'dilute', name: 'Diluting a strong acid', gen: function (r) {
        var ph = r.int(1, 4), f = r.pick([10, 100, 1000]), add2 = Math.round(Math.log10(f));
        return { q: 'A strong acid of pH ' + ph + ' is diluted ' + f + ' times with water. Find the new pH.', answer: ph + add2,
          steps: ['Diluting ' + f + ' times divides [H^{+}] by ' + f + '.', 'Each factor of 10 raises pH by 1.', 'pH = ' + ph + ' + ' + add2 + ' = ' + (ph + add2) + '.'] };
      } },
    ] });

  add({ id: 'c-redox', units: [CH('R3.2')], title: 'Redox: oxidation states and electrochemical cells',
    method: ['Oxidation states: elements 0; O −2 (usually); H +1 (usually); group 1 +1, group 2 +2; they add up to the charge on the species.', 'OIL RIG: oxidation is loss of electrons (state rises); reduction is gain (state falls).', 'E°_{cell} = E°(cathode) − E°(anode): the half-cell with the more positive E° is reduced. Positive E°_{cell} → spontaneous.'],
    variants: [
      { id: 'ox', name: 'Oxidation state', gen: function (r) {
        var sp = r.pick([['S', 'H_{2}SO_{4}', 6], ['Mn', 'KMnO_{4}', 7], ['Cr', 'Cr_{2}O_{7}^{2−}', 6], ['N', 'NO_{3}^{−}', 5], ['N', 'NH_{3}', -3], ['C', 'CO_{2}', 4], ['Fe', 'Fe_{2}O_{3}', 3], ['S', 'SO_{3}^{2−}', 4], ['Cl', 'ClO^{−}', 1], ['P', 'PO_{4}^{3−}', 5], ['Cl', 'ClO_{3}^{−}', 5], ['N', 'NO_{2}', 4]]);
        return { q: 'What is the oxidation state of ' + sp[0] + ' in ' + sp[1] + '?', answer: sp[2],
          steps: ['Fixed values: O −2, H +1, K +1.', 'All the oxidation states add up to the overall charge of ' + sp[1] + '.', sp[0] + ' is ' + (sp[2] > 0 ? '+' : '') + m(sp[2]) + '.'] };
      } },
      { id: 'cell', name: 'Cell potential', gen: function (r) {
        var half = [['Zn^{2+}/Zn', -0.76], ['Fe^{2+}/Fe', -0.45], ['Ni^{2+}/Ni', -0.26], ['Pb^{2+}/Pb', -0.13], ['Cu^{2+}/Cu', 0.34], ['Ag^{+}/Ag', 0.80], ['Mg^{2+}/Mg', -2.37]];
        var two = r.sample(half, 2), hi = two[0][1] > two[1][1] ? two[0] : two[1], lo = hi === two[0] ? two[1] : two[0], E = T.round(hi[1] - lo[1], 2);
        return { q: 'A cell is made from ' + two[0][0] + ' (E° = ' + m(two[0][1]) + ' V) and ' + two[1][0] + ' (E° = ' + m(two[1][1]) + ' V). Find E°_{cell}.', answer: E, dp: 2, unit: 'V',
          steps: ['The more positive half-cell, ' + hi[0] + ', is reduced: the cathode.', 'E°_{cell} = E°_{cathode} − E°_{anode}.', '= ' + m(hi[1]) + ' − ' + b(lo[1]) + ' = ' + E.toFixed(2) + ' V.'] };
      } },
      { id: 'which', name: 'Oxidised or reduced?', gen: function (r) {
        var cs = [['Zn + Cu^{2+} → Zn^{2+} + Cu', 'Zn', 'Oxidised (0 → +2)'], ['Zn + Cu^{2+} → Zn^{2+} + Cu', 'Cu^{2+}', 'Reduced (+2 → 0)'], ['2Fe^{2+} + Cl_{2} → 2Fe^{3+} + 2Cl^{−}', 'Cl_{2}', 'Reduced (0 → −1)'], ['2Fe^{2+} + Cl_{2} → 2Fe^{3+} + 2Cl^{−}', 'Fe^{2+}', 'Oxidised (+2 → +3)'], ['2Mg + O_{2} → 2MgO', 'Mg', 'Oxidised (0 → +2)']];
        var p = r.pick(cs), all = cs.map(function (x) { return x[2]; }).filter(function (x, i, a) { return a.indexOf(x) === i && x !== p[2]; });
        return Object.assign(T.choice(p[2], all, r), { q: 'In ' + p[0] + ', what happens to ' + p[1] + '?',
          steps: ['Find the oxidation state of ' + p[1] + ' before and after.', 'Up = oxidised (lost electrons); down = reduced (gained).', p[2] + '.'] });
      } },
    ] });

  /* ════════════════════════ BIOLOGY ════════════════════════ */

  var CODE = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';
  var AA3 = { F: 'Phe', L: 'Leu', S: 'Ser', Y: 'Tyr', '*': 'Stop', C: 'Cys', W: 'Trp', P: 'Pro', H: 'His', Q: 'Gln', R: 'Arg', I: 'Ile', M: 'Met', T: 'Thr', N: 'Asn', K: 'Lys', V: 'Val', A: 'Ala', D: 'Asp', E: 'Glu', G: 'Gly' };
  function codon(c3) { return AA3[CODE['UCAG'.indexOf(c3[0]) * 16 + 'UCAG'.indexOf(c3[1]) * 4 + 'UCAG'.indexOf(c3[2])]]; }
  var COMP = { A: 'T', T: 'A', C: 'G', G: 'C' }, TRANS = { A: 'U', T: 'A', C: 'G', G: 'C' }, ANTI = { A: 'U', U: 'A', C: 'G', G: 'C' };
  function strand(r, n) { var s = ''; for (var i = 0; i < n; i++) s += r.pick(['A', 'T', 'C', 'G']); return s; }

  add({ id: 'b-dna', units: [BI('A1.2'), BI('D1.1'), BI('D1.2')], title: 'DNA, transcription and translation',
    method: ['Complementary base pairing: A with T (U in RNA), C with G.', 'Transcription: mRNA is complementary to the template strand (U in place of T).', 'Translation: read the mRNA in codons of three bases; the genetic code table gives each amino acid. tRNA anticodons are complementary to the codons.'],
    variants: [
      { id: 'comp', name: 'Complementary DNA strand', gen: function (r) {
        var s = strand(r, 9), ans = s.split('').map(function (x) { return COMP[x]; }).join('');
        return { q: 'Write the base sequence complementary to the DNA strand ' + s + '.', answer: ans, placeholder: 'e.g. TACG…',
          steps: ['A pairs with T, C with G.', 'Base by base: ' + s.split('').map(function (x) { return x + '→' + COMP[x]; }).join(' ') + '.', ans + '.'] };
      } },
      { id: 'mrna', name: 'Transcribe to mRNA', gen: function (r) {
        var s = strand(r, 9), ans = s.split('').map(function (x) { return TRANS[x]; }).join('');
        return { q: 'A DNA template strand reads ' + s + '. What is the mRNA transcribed from it?', answer: ans, placeholder: 'e.g. AUGC…',
          steps: ['mRNA is complementary to the template, with U for T: A→U, T→A, C→G, G→C.', s.split('').map(function (x) { return x + '→' + TRANS[x]; }).join(' ') + '.', 'mRNA: ' + ans + '.'] };
      } },
      { id: 'aa', name: 'Codon to amino acid', gen: function (r) {
        var c3 = r.pick(['U', 'C', 'A', 'G']) + r.pick(['U', 'C', 'A', 'G']) + r.pick(['U', 'C', 'A', 'G']), aa = codon(c3);
        var pool = ['Phe', 'Leu', 'Ser', 'Tyr', 'Cys', 'Trp', 'Pro', 'His', 'Gln', 'Arg', 'Ile', 'Met', 'Thr', 'Asn', 'Lys', 'Val', 'Ala', 'Asp', 'Glu', 'Gly', 'Stop'];
        return Object.assign(T.choice(aa, r.sample(pool.filter(function (x) { return x !== aa; }), 3), r), { q: 'Using the genetic code, what does the mRNA codon ' + c3 + ' code for?',
          steps: ['Find the first base (' + c3[0] + ') at the side, the second (' + c3[1] + ') along the top, the third (' + c3[2] + ') within the box.', 'Read the amino acid in that cell.', c3 + ' → ' + aa + '.'] });
      } },
      { id: 'anti', name: 'tRNA anticodon', gen: function (r) {
        var c3 = r.pick(['U', 'C', 'A', 'G']) + r.pick(['U', 'C', 'A', 'G']) + r.pick(['U', 'C', 'A', 'G']), ans = c3.split('').map(function (x) { return ANTI[x]; }).join('');
        return { q: 'What tRNA anticodon pairs with the mRNA codon ' + c3 + '?', answer: ans, placeholder: 'e.g. UAC',
          steps: ['Anticodons are complementary to codons: A–U, C–G.', c3.split('').map(function (x, i) { return x + '→' + ans[i]; }).join(' ') + '.', ans + '.'] };
      } },
      { id: 'count', name: 'Codons and amino acids', gen: function (r) {
        var bases = r.int(10, 200) * 3;
        return { q: 'An mRNA coding sequence, start codon to stop codon inclusive, is ' + bases + ' bases long. How many amino acids are in the polypeptide?', answer: bases / 3 - 1,
          steps: ['Three bases per codon: ' + bases + ' ÷ 3 = ' + bases / 3 + ' codons.', 'The stop codon codes for no amino acid.', bases / 3 + ' − 1 = ' + (bases / 3 - 1) + '.'] };
      } },
    ] });

  add({ id: 'b-genetics', units: [BI('D3.2')], title: 'Inheritance: monohybrid, codominant, sex-linked and dihybrid crosses',
    method: ['Write each parent’s genotype and the gametes it can make (one allele of each gene per gamete).', 'Punnett grid: each gamete of one parent with each of the other.', 'Count genotypes, then phenotypes: dominant shows with one copy, recessive needs two; codominant alleles both show.', 'Sex-linked genes are on the X chromosome: a male’s single X allele always shows. AaBb × AaBb (unlinked) gives 9 : 3 : 3 : 1.'],
    variants: [
      { id: 'mono', name: 'Monohybrid: chance of a phenotype', gen: function (r) {
        var cs = r.pick([['Aa', 'Aa', 'short', 0.25], ['Aa', 'Aa', 'tall', 0.75], ['Aa', 'aa', 'short', 0.5], ['AA', 'aa', 'tall', 1], ['Aa', 'AA', 'short', 0]]);
        return { q: 'In peas, tall (A) is dominant to short (a). What is the probability that an offspring of ' + cs[0] + ' × ' + cs[1] + ' is ' + cs[2] + '?', answer: cs[3],
          steps: ['Gametes: ' + cs[0].split('').join(' or ') + ' from one parent; ' + cs[1].split('').join(' or ') + ' from the other.', 'The grid has 4 equally likely boxes.', 'P(' + cs[2] + ') = ' + F(Math.round(cs[3] * 4), 4) + ' = ' + cs[3] + '.'] };
      } },
      { id: 'codom', name: 'Codominance', gen: function (r) {
        var a = r.pick([['roan', 0.5, 'C^{R}C^{W}'], ['red', 0.25, 'C^{R}C^{R}'], ['white', 0.25, 'C^{W}C^{W}']]);
        return { q: 'In cattle the red (C^{R}) and white (C^{W}) alleles are codominant; C^{R}C^{W} is roan. Two roan cattle breed. What proportion of calves are ' + a[0] + '?', answer: a[1],
          steps: ['C^{R}C^{W} × C^{R}C^{W}.', 'Grid: C^{R}C^{R} ¼, C^{R}C^{W} ½, C^{W}C^{W} ¼.', a[0] + ' (' + a[2] + '): ' + a[1] + '.'] };
      } },
      { id: 'sexlinked', name: 'Sex-linked inheritance', gen: function (r) {
        var a = r.pick([['a son', 'colour-blind', 0.5], ['a daughter', 'colour-blind', 0], ['a daughter', 'a carrier', 0.5], ['any child', 'colour-blind', 0.25]]);
        return { q: 'A carrier woman (X^{B}X^{b}) and a man with normal vision (X^{B}Y) have children. What is the probability that ' + a[0] + ' is ' + a[1] + '?', answer: a[2],
          steps: ['Gametes: X^{B} or X^{b} from the mother; X^{B} or Y from the father.', 'Children: daughters X^{B}X^{B} or X^{B}X^{b}; sons X^{B}Y or X^{b}Y, each ¼.', a[0] === 'a son' ? 'Half the sons are X^{b}Y: ½.' : a[1] === 'a carrier' ? 'Half the daughters are X^{B}X^{b}: ½.' : a[0] === 'a daughter' ? 'Every daughter gets X^{B} from her father: 0.' : 'Only X^{b}Y, one box in four: ¼.'] };
      } },
      { id: 'dihybrid', name: 'Dihybrid: expected numbers', gen: function (r) {
        var n = r.int(8, 40) * 16, w = r.pick([['both dominant traits', 9], ['the first dominant and the second recessive trait', 3], ['the first recessive and the second dominant trait', 3], ['both recessive traits', 1]]);
        return { q: 'AaBb × AaBb (unlinked genes) gives ' + n + ' offspring. How many are expected to show ' + w[0] + '?', answer: n * w[1] / 16,
          steps: ['Unlinked dihybrid cross: 9 : 3 : 3 : 1 out of 16.', w[0] + ': ' + w[1] + '/16.', w[1] + '/16 × ' + n + ' = ' + n * w[1] / 16 + '.'] };
      } },
      { id: 'chi', name: 'Chi-squared on a cross', gen: function (r) {
        var n = r.int(10, 40) * 4, o1 = Math.round(n * 0.75) + r.int(-12, 12), o2 = n - o1, e1 = n * 0.75, e2 = n * 0.25, chi = (o1 - e1) * (o1 - e1) / e1 + (o2 - e2) * (o2 - e2) / e2;
        return { q: 'A cross expected to give 3 : 1 produced ' + o1 + ' dominant and ' + o2 + ' recessive offspring. Calculate χ^{2}.', answer: chi, sf: 3,
          steps: ['Expected: ' + S(e1) + ' and ' + S(e2) + '.', 'χ^{2} = Σ(O − E)^{2}/E = (' + o1 + ' − ' + S(e1) + ')^{2}/' + S(e1) + ' + (' + o2 + ' − ' + S(e2) + ')^{2}/' + S(e2) + '.', 'χ^{2} = ' + N(chi, 3) + '. With 1 degree of freedom the 5% critical value is 3.84: ' + (chi > 3.84 ? 'a significant difference from 3 : 1.' : 'no significant difference from 3 : 1.')] };
      } },
    ] });

  add({ id: 'b-popgen', units: [BI('A4.1'), BI('D4.1')], title: 'Population genetics (Hardy–Weinberg)',
    method: ['p = frequency of the dominant allele, q = the recessive: p + q = 1.', 'Genotype frequencies: p^{2} + 2pq + q^{2} = 1 (homozygous dominant, heterozygous, homozygous recessive).', 'Start from the recessive phenotype: it is q^{2}, so q = √(that frequency).'],
    variants: [
      { id: 'q', name: 'Recessive allele frequency', gen: function (r) {
        var q = r.int(5, 70) / 100, q2 = T.round(q * q, 4);
        return { q: T.round(q2 * 100, 2) + '% of a population show a recessive trait. Find q, the frequency of the recessive allele.', answer: Math.sqrt(q2), sf: 3,
          steps: ['The recessive phenotype frequency is q^{2} = ' + q2 + '.', 'q = √' + q2 + '.', 'q = ' + N(Math.sqrt(q2), 3) + '.'] };
      } },
      { id: 'het', name: 'Carriers (2pq)', gen: function (r) {
        var q = r.int(5, 50) / 100, p = T.round(1 - q, 2);
        return { q: 'The recessive allele frequency is ' + q + '. What proportion of the population are heterozygous carriers?', answer: 2 * p * q, sf: 3,
          steps: ['p = 1 − ' + q + ' = ' + p + '.', 'Heterozygotes = 2pq.', '= 2 × ' + p + ' × ' + q + ' = ' + N(2 * p * q, 3) + '.'] };
      } },
    ] });

  add({ id: 'b-cells', units: [BI('A2.2'), BI('D2.1'), BI('B2.1'), BI('B2.3')], title: 'Cells: magnification, mitotic index, SA:V and osmosis',
    method: ['Magnification = image size ÷ actual size, in the same unit (1 mm = 1000 μm, 1 μm = 1000 nm).', 'Mitotic index = cells in mitosis ÷ total cells.', 'Surface area : volume falls as cells grow, which limits cell size.', 'Osmosis experiments: % change in mass = (final − initial) ÷ initial × 100.'],
    variants: [
      { id: 'mag', name: 'Magnification', gen: function (r) {
        var img = r.int(10, 120), act = r.int(2, 200), M = img * 1000 / act;
        return { q: 'A cell is ' + act + ' μm long. In a drawing it is ' + img + ' mm long. Find the magnification.', answer: M, sf: 3,
          steps: ['Same units: ' + img + ' mm = ' + img * 1000 + ' μm.', 'M = image ÷ actual = ' + img * 1000 + ' ÷ ' + act + '.', 'M = ×' + N(M, 3) + '.'] };
      } },
      { id: 'actual', name: 'Actual size', gen: function (r) {
        var img = r.int(5, 80), M = r.pick([40, 100, 400, 1000, 2500, 10000]), act = img * 1000 / M;
        return { q: 'A structure measures ' + img + ' mm in a ×' + M + ' image. Find its actual size in μm.', answer: act, sf: 3, unit: 'μm',
          steps: ['Actual = image ÷ magnification.', img + ' mm = ' + img * 1000 + ' μm.', img * 1000 + ' ÷ ' + M + ' = ' + N(act, 3) + ' μm.'] };
      } },
      { id: 'mitotic', name: 'Mitotic index', gen: function (r) {
        var tot = r.int(50, 400), mit = r.int(3, Math.floor(tot / 3));
        return { q: 'In a root tip, ' + mit + ' of ' + tot + ' cells are in mitosis. Find the mitotic index.', answer: mit / tot, sf: 3,
          steps: ['Mitotic index = cells in mitosis ÷ total.', '= ' + mit + ' ÷ ' + tot + '.', '= ' + N(mit / tot, 3) + '.'] };
      } },
      { id: 'savol', name: 'SA : V ratio', gen: function (r) {
        var s = r.int(1, 10);
        return { q: 'Find the surface area : volume ratio (SA ÷ V) of a cube-shaped cell of side ' + s + ' μm.', answer: 6 / s, sf: 3, unit: 'μm^{−1}',
          steps: ['SA = 6s^{2} = ' + 6 * s * s + ' μm^{2}; V = s^{3} = ' + s * s * s + ' μm^{3}.', 'Ratio = ' + 6 * s * s + ' ÷ ' + s * s * s + '.', '= ' + N(6 / s, 3) + ' (= 6/s: bigger cells have less surface per volume).'] };
      } },
      { id: 'osmosis', name: 'Osmosis: % change in mass', gen: function (r) {
        var m0 = r.int(150, 400) / 100, m1 = T.round(m0 * (1 + r.nz(-25, 25) / 100), 2), pc = (m1 - m0) / m0 * 100;
        if (m1 === m0) return null;
        return { q: 'A potato cylinder of ' + m0 + ' g has a mass of ' + m1 + ' g after an hour in sucrose solution. Find the percentage change in mass.', answer: pc, sf: 3, unit: '%',
          steps: ['% change = (final − initial) ÷ initial × 100.', '= (' + m1 + ' − ' + m0 + ') ÷ ' + m0 + ' × 100.', '= ' + N(pc, 3) + '%: water moved ' + (pc > 0 ? 'in (the solution was hypotonic).' : 'out (the solution was hypertonic).')] };
      } },
    ] });

  add({ id: 'b-water', units: [BI('D2.3')], title: 'Water potential',
    method: ['Water moves from higher (less negative) to lower (more negative) water potential.', 'Ψ_{w} = Ψ_{s} + Ψ_{p}: solute potential is negative; pressure potential is usually positive in turgid plant cells.', 'Pure water at atmospheric pressure: Ψ = 0 kPa.'],
    variants: [
      { id: 'psi', name: 'Water potential of a cell', gen: function (r) {
        var s = -r.int(200, 1500), p = r.int(0, 800);
        return { q: 'A plant cell has Ψ_{s} = ' + m(s) + ' kPa and Ψ_{p} = ' + p + ' kPa. Find its water potential.', answer: s + p, unit: 'kPa',
          steps: ['Ψ_{w} = Ψ_{s} + Ψ_{p}.', '= ' + m(s) + ' + ' + p + '.', '= ' + m(s + p) + ' kPa.'] };
      } },
      { id: 'dir', name: 'Which way does water move?', gen: function (r) {
        var a = -r.int(100, 1200), c2 = -r.int(100, 1200);
        if (a === c2) return null;
        var ans = a > c2 ? 'From cell A to cell B' : 'From cell B to cell A';
        return Object.assign(T.choice(ans, ['From cell A to cell B', 'From cell B to cell A', 'No net movement']), { q: 'Cell A has Ψ = ' + m(a) + ' kPa and cell B has Ψ = ' + m(c2) + ' kPa. Which way does water move?',
          steps: ['Water moves down the water potential gradient: higher to lower.', m(Math.max(a, c2)) + ' kPa is higher (less negative).', ans + '.'] });
      } },
    ] });

  add({ id: 'b-metab', units: [BI('C1.1'), BI('C1.2'), BI('C1.3')], title: 'Enzymes, respiration and photosynthesis data',
    method: ['Rate = change ÷ time; from a graph, the gradient.', 'Respiratory quotient RQ = CO_{2} produced ÷ O_{2} used: about 1.0 for carbohydrate, 0.7 for lipid.', 'Chromatography: R_{f} = distance moved by the pigment ÷ distance moved by the solvent front.', 'Q_{10} = rate at (T + 10 °C) ÷ rate at T.'],
    variants: [
      { id: 'rate', name: 'Rate of an enzyme reaction', gen: function (r) {
        var V = r.int(5, 60), t = r.int(1, 10);
        return { q: 'Catalase releases ' + V + ' cm^{3} of oxygen in ' + t + ' min. Find the mean rate.', answer: V / t, sf: 3, unit: 'cm^{3} min^{−1}',
          steps: ['Rate = amount ÷ time.', '= ' + V + ' ÷ ' + t + '.', '= ' + N(V / t, 3) + ' cm^{3} min^{−1}.'] };
      } },
      { id: 'rq', name: 'Respiratory quotient', gen: function (r) {
        var o2 = r.int(10, 60), rq = r.pick([0.7, 0.8, 0.9, 1.0]), co2 = T.round(o2 * rq, 1);
        return { q: 'An organism uses ' + o2 + ' cm^{3} of O_{2} and produces ' + co2 + ' cm^{3} of CO_{2}. Find its RQ.', answer: co2 / o2, sf: 2,
          steps: ['RQ = CO_{2} produced ÷ O_{2} used.', '= ' + co2 + ' ÷ ' + o2 + '.', '= ' + N(co2 / o2, 2) + (Math.abs(co2 / o2 - 1) < 0.05 ? ': carbohydrate.' : Math.abs(co2 / o2 - 0.7) < 0.05 ? ': lipid.' : '.')] };
      } },
      { id: 'rf', name: 'R_f value', gen: function (r) {
        var front = r.int(60, 120), d = r.int(5, front - 5);
        return { q: 'In a chromatogram the solvent front moved ' + front + ' mm and a pigment moved ' + d + ' mm. Find its R_{f}.', answer: d / front, sf: 2,
          steps: ['R_{f} = pigment distance ÷ solvent distance.', '= ' + d + ' ÷ ' + front + '.', '= ' + N(d / front, 2) + '.'] };
      } },
      { id: 'q10', name: 'Q₁₀', gen: function (r) {
        var r1 = r.int(5, 40), q = r.pick([1.5, 2, 2.5, 3]), r2 = T.round(r1 * q, 1);
        return { q: 'A reaction rate is ' + r1 + ' units at 20 °C and ' + r2 + ' units at 30 °C. Find Q_{10}.', answer: r2 / r1, sf: 3,
          steps: ['Q_{10} = rate at T + 10 ÷ rate at T.', '= ' + r2 + ' ÷ ' + r1 + '.', '= ' + N(r2 / r1, 3) + '.'] };
      } },
    ] });

  add({ id: 'b-physio', units: [BI('B3.2'), BI('C2.2'), BI('B3.1'), BI('D3.3')], title: 'Physiology calculations',
    method: ['Cardiac output = stroke volume × heart rate.', 'Heart rate (beats per minute) = 60 ÷ seconds per beat.', 'Impulse speed = distance ÷ time.', 'Minute volume = tidal volume × ventilation rate.'],
    variants: [
      { id: 'co', name: 'Cardiac output', gen: function (r) {
        var sv = r.int(50, 110), hr = r.int(50, 180);
        return { q: 'Stroke volume is ' + sv + ' cm^{3} and heart rate ' + hr + ' beats per minute. Find the cardiac output in dm^{3} min^{−1}.', answer: sv * hr / 1000, sf: 3, unit: 'dm^{3} min^{−1}',
          steps: ['Cardiac output = SV × HR = ' + sv * hr + ' cm^{3} min^{−1}.', '1 dm^{3} = 1000 cm^{3}.', '= ' + N(sv * hr / 1000, 3) + ' dm^{3} min^{−1}.'] };
      } },
      { id: 'hr', name: 'Heart rate from one beat', gen: function (r) {
        var t = r.int(40, 120) / 100;
        return { q: 'An ECG shows one cardiac cycle lasting ' + t + ' s. Find the heart rate.', answer: 60 / t, sf: 3, unit: 'bpm',
          steps: ['Beats per minute = 60 ÷ seconds per beat.', '= 60 ÷ ' + t + '.', '= ' + N(60 / t, 3) + ' bpm.'] };
      } },
      { id: 'nerve', name: 'Nerve impulse speed', gen: function (r) {
        var d = r.int(5, 120) / 100, tms = r.int(2, 60);
        return { q: 'An impulse travels ' + d + ' m along a neuron in ' + tms + ' ms. Find its speed.', answer: d / (tms / 1000), sf: 3, unit: 'm s^{−1}',
          steps: ['Speed = distance ÷ time, t = ' + tms / 1000 + ' s.', '= ' + d + ' ÷ ' + tms / 1000 + '.', '= ' + N(d / (tms / 1000), 3) + ' m s^{−1}.'] };
      } },
      { id: 'minute', name: 'Minute ventilation', gen: function (r) {
        var tv = r.int(300, 900), br = r.int(10, 30);
        return { q: 'Tidal volume is ' + tv + ' cm^{3} and ventilation rate ' + br + ' breaths per minute. Find the minute volume in dm^{3}.', answer: tv * br / 1000, sf: 3, unit: 'dm^{3} min^{−1}',
          steps: ['Minute volume = tidal volume × rate = ' + tv * br + ' cm^{3} min^{−1}.', 'Divide by 1000.', '= ' + N(tv * br / 1000, 3) + ' dm^{3} min^{−1}.'] };
      } },
    ] });

  add({ id: 'b-ecology', units: [BI('C4.1'), BI('C4.2'), BI('A4.2'), BI('A3.1')], title: 'Ecology: sampling, diversity and energy flow',
    method: ['Lincoln index (capture–mark–recapture): N = M × C ÷ R.', 'Simpson’s reciprocal diversity index: D = N(N − 1) ÷ Σn(n − 1); higher means more diverse.', 'Energy transfer efficiency = higher level ÷ lower level × 100 (often about 10%).', 'Quadrats: population ≈ mean per quadrat × total area ÷ quadrat area.'],
    variants: [
      { id: 'lincoln', name: 'Lincoln index', gen: function (r) {
        var M = r.int(20, 120), C = r.int(20, 120), Rr = r.int(3, Math.min(M, C) - 1);
        return { q: M + ' beetles are marked and released. Later ' + C + ' are caught, ' + Rr + ' of them marked. Estimate the population.', answer: M * C / Rr, sf: 3,
          steps: ['N = M × C ÷ R.', '= ' + M + ' × ' + C + ' ÷ ' + Rr + '.', '≈ ' + N(M * C / Rr, 3) + '.'] };
      } },
      { id: 'simpson', name: 'Simpson’s diversity index', gen: function (r) {
        var ns = []; for (var i = r.int(3, 5); i > 0; i--) ns.push(r.int(2, 30));
        var Nt = ns.reduce(function (s, x) { return s + x; }, 0), den = ns.reduce(function (s, x) { return s + x * (x - 1); }, 0);
        return { q: 'A sample contains species with ' + ns.join(', ') + ' individuals. Calculate Simpson’s reciprocal index D = N(N − 1)/Σn(n − 1).', answer: Nt * (Nt - 1) / den, sf: 3,
          steps: ['N = ' + Nt + '; N(N − 1) = ' + Nt * (Nt - 1) + '.', 'Σn(n − 1) = ' + ns.map(function (x) { return x + '×' + (x - 1); }).join(' + ') + ' = ' + den + '.', 'D = ' + Nt * (Nt - 1) + ' ÷ ' + den + ' = ' + N(Nt * (Nt - 1) / den, 3) + '.'] };
      } },
      { id: 'efficiency', name: 'Energy transfer efficiency', gen: function (r) {
        var lo = r.int(1000, 50000), hi = Math.round(lo * r.int(5, 20) / 100);
        return { q: 'Producers store ' + lo + ' kJ m^{−2} yr^{−1}; primary consumers ' + hi + ' kJ m^{−2} yr^{−1}. Find the transfer efficiency.', answer: hi / lo * 100, sf: 3, unit: '%',
          steps: ['Efficiency = higher ÷ lower × 100.', '= ' + hi + ' ÷ ' + lo + ' × 100.', '= ' + N(hi / lo * 100, 3) + '%. The rest is lost mainly as heat from respiration.'] };
      } },
      { id: 'quadrat', name: 'Quadrat estimate', gen: function (r) {
        var cs = [r.int(0, 15), r.int(0, 15), r.int(0, 15), r.int(0, 15), r.int(0, 15)], tot = cs.reduce(function (s, x) { return s + x; }, 0), area = r.int(50, 500), q = r.pick([0.25, 0.5, 1]);
        if (!tot) return null;
        return { q: 'Five ' + q + ' m^{2} quadrats contain ' + cs.join(', ') + ' daisies. Estimate the number in a ' + area + ' m^{2} field.', answer: tot / 5 / q * area, sf: 3,
          steps: ['Mean per quadrat = ' + tot + ' ÷ 5 = ' + S(tot / 5, 2) + '.', 'Density = ' + S(tot / 5, 2) + ' ÷ ' + q + ' = ' + S(tot / 5 / q, 3) + ' per m^{2}.', 'Estimate = ' + S(tot / 5 / q, 3) + ' × ' + area + ' ≈ ' + N(tot / 5 / q * area, 3) + '.'] };
      } },
    ] });

  add({ id: 'b-classify', units: [BI('A3.2'), BI('A3.1'), BI('A4.1'), BI('D4.1')], title: 'Classification and evolution',
    method: ['Ranks from broadest: domain, kingdom, phylum, class, order, family, genus, species.', 'Binomial name: Genus (capital) species (lower case), in italics or underlined.', 'Cladograms group organisms by shared derived characteristics; closest relatives share the most recent node.', 'Natural selection: variation → overproduction → competition → the best adapted survive and reproduce → their alleles are passed on → allele frequencies change.'],
    variants: [
      { id: 'rank', name: 'Order of the ranks', gen: function (r) {
        var ranks = ['domain', 'kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'], i = r.int(0, 6);
        return Object.assign(T.choice(ranks[i + 1], r.sample(ranks.filter(function (x, j) { return j !== i + 1 && j !== i; }), 3), r), { q: 'Which rank comes directly below ' + ranks[i] + '?',
          steps: ['Broadest to narrowest: domain, kingdom, phylum, class, order, family, genus, species.', 'Find ' + ranks[i] + '.', 'Next: ' + ranks[i + 1] + '.'] });
      } },
      { id: 'binomial', name: 'Writing binomial names', gen: function (r) {
        var sp = r.pick([['Homo', 'sapiens'], ['Panthera', 'leo'], ['Quercus', 'robur'], ['Escherichia', 'coli'], ['Canis', 'lupus']]), right = sp[0] + ' ' + sp[1];
        return Object.assign(T.choice(right, [sp[0] + ' ' + sp[1][0].toUpperCase() + sp[1].slice(1), sp[0].toLowerCase() + ' ' + sp[1], sp[1] + ' ' + sp[0]], r), {
          q: 'Which is the correctly written binomial name (italics not shown)?',
          steps: ['Genus first, with a capital letter.', 'Species second, all lower case.', right + '.'] });
      } },
      { id: 'selection', name: 'Steps of natural selection', gen: function (r) {
        var st = ['Variation exists in the population', 'More offspring are produced than can survive', 'Individuals compete for limited resources', 'The best-adapted survive and reproduce', 'They pass on the advantageous alleles', 'Allele frequencies change over generations'], i = r.int(0, 4);
        return Object.assign(T.choice(st[i + 1], r.sample(st.filter(function (x, j) { return j !== i + 1 && j !== i; }), 3), r), { q: 'In natural selection, what comes straight after “' + st[i] + '”?',
          steps: ['The chain: variation → overproduction → competition → survival of the best adapted → inheritance → change in allele frequency.', 'Find “' + st[i] + '”.', 'Next: ' + st[i + 1] + '.'] });
      } },
    ] });

  /* ════════════════════════ ESS ════════════════════════ */

  add({ id: 'e-energy', units: [ES('2.2'), ES('2.1')], title: 'Productivity and energy flow',
    method: ['NPP = GPP − R (respiratory losses).', 'Gross secondary productivity = food eaten − faecal loss; NSP = GSP − R.', 'Transfer between trophic levels is roughly 10%.', 'Productivity is a rate: per unit area per unit time (kJ m^{−2} yr^{−1}).'],
    variants: [
      { id: 'npp', name: 'NPP from GPP', gen: function (r) {
        var gpp = r.int(5000, 40000), R2 = r.int(1000, gpp - 1000);
        return { q: 'A forest has GPP = ' + gpp + ' kJ m^{−2} yr^{−1} and respires ' + R2 + ' kJ m^{−2} yr^{−1}. Find its NPP.', answer: gpp - R2, unit: 'kJ m^{−2} yr^{−1}',
          steps: ['NPP = GPP − R.', '= ' + gpp + ' − ' + R2 + '.', '= ' + (gpp - R2) + ' kJ m^{−2} yr^{−1}.'] };
      } },
      { id: 'nsp', name: 'Secondary productivity', gen: function (r) {
        var eat = r.int(500, 5000), fae = r.int(100, Math.floor(eat / 2)), R2 = r.int(50, eat - fae - 50);
        return { q: 'A herbivore eats ' + eat + ' kJ, loses ' + fae + ' kJ in faeces and ' + R2 + ' kJ in respiration. Find its net secondary productivity.', answer: eat - fae - R2, unit: 'kJ',
          steps: ['GSP = eaten − faeces = ' + (eat - fae) + ' kJ.', 'NSP = GSP − R.', '= ' + (eat - fae) + ' − ' + R2 + ' = ' + (eat - fae - R2) + ' kJ.'] };
      } },
      { id: 'level', name: 'Energy at a higher level', gen: function (r) {
        var p = r.int(10, 100) * 1000, steps2 = r.int(2, 3), eff = r.pick([0.1, 0.15, 0.2]), v = p * Math.pow(eff, steps2);
        return { q: 'Producers fix ' + p + ' kJ. With ' + eff * 100 + '% transfer per level, how much reaches trophic level ' + (steps2 + 1) + '?', answer: v,
          steps: ['Each step keeps ' + eff * 100 + '%.', steps2 + ' steps: ' + p + ' × ' + eff + '^{' + steps2 + '}.', '= ' + S(v, 3) + ' kJ.'] };
      } },
    ] });

  add({ id: 'e-pop', units: [ES('8.1')], title: 'Human population calculations',
    method: ['Crude birth (death) rate = births (deaths) per 1000 people per year.', 'Natural increase rate (%) = (CBR − CDR) ÷ 10.', 'Doubling time ≈ 70 ÷ growth rate (%).', 'Dependency ratio = (under 15 + over 64) ÷ (15 to 64) × 100.'],
    variants: [
      { id: 'nir', name: 'Natural increase rate', gen: function (r) {
        var cbr = r.int(8, 45), cdr = r.int(4, 20);
        return { q: 'A country has CBR ' + cbr + ' and CDR ' + cdr + ' per 1000. Find its natural increase rate as a percentage.', answer: (cbr - cdr) / 10, unit: '%',
          steps: ['NIR (%) = (CBR − CDR) ÷ 10.', '= (' + cbr + ' − ' + cdr + ') ÷ 10.', '= ' + S((cbr - cdr) / 10) + '%.'] };
      } },
      { id: 'double', name: 'Doubling time', gen: function (r) {
        var g2 = r.int(5, 40) / 10;
        return { q: 'A population grows at ' + g2 + '% a year. Estimate its doubling time.', answer: 70 / g2, sf: 3, unit: 'years',
          steps: ['Rule of 70: doubling time ≈ 70 ÷ growth rate.', '= 70 ÷ ' + g2 + '.', '≈ ' + N(70 / g2, 3) + ' years.'] };
      } },
      { id: 'cbr', name: 'Crude birth rate', gen: function (r) {
        var pop = r.int(2, 90) * 100000, births = Math.round(pop * r.int(8, 40) / 1000);
        return { q: 'A population of ' + pop + ' has ' + births + ' births in a year. Find the crude birth rate.', answer: births / pop * 1000, sf: 3, unit: 'per 1000',
          steps: ['CBR = births ÷ population × 1000.', '= ' + births + ' ÷ ' + pop + ' × 1000.', '= ' + N(births / pop * 1000, 3) + ' per 1000.'] };
      } },
      { id: 'dep', name: 'Dependency ratio', gen: function (r) {
        var y = r.int(10, 45), o = r.int(3, 25), w = 100 - y - o;
        return { q: 'A population is ' + y + '% under 15, ' + w + '% aged 15–64 and ' + o + '% over 64. Find the dependency ratio.', answer: (y + o) / w * 100, sf: 3,
          steps: ['Dependency ratio = dependants ÷ working age × 100.', '= (' + y + ' + ' + o + ') ÷ ' + w + ' × 100.', '= ' + N((y + o) / w * 100, 3) + '.'] };
      } },
    ] });

  add({ id: 'e-sampling', units: [ES('2.1'), ES('3.1')], title: 'Sampling and diversity',
    method: ['Lincoln index N = M × C ÷ R.', 'Simpson’s reciprocal index D = N(N − 1) ÷ Σn(n − 1).', 'Frequency = quadrats containing the species ÷ total quadrats × 100.'],
    variants: [
      { id: 'lincoln', name: 'Lincoln index', gen: function (r) {
        var M = r.int(10, 80), C = r.int(10, 80), Rr = r.int(2, Math.min(M, C) - 1);
        return { q: 'In a pond ' + M + ' newts are marked. A second sample of ' + C + ' contains ' + Rr + ' marked newts. Estimate the population.', answer: M * C / Rr, sf: 3,
          steps: ['N = M × C ÷ R.', '= ' + M + ' × ' + C + ' ÷ ' + Rr + '.', '≈ ' + N(M * C / Rr, 3) + '.'] };
      } },
      { id: 'freq', name: 'Species frequency', gen: function (r) {
        var tot = r.int(10, 40), found = r.int(1, tot);
        return { q: 'A species occurs in ' + found + ' of ' + tot + ' quadrats. Find its frequency.', answer: found / tot * 100, sf: 3, unit: '%',
          steps: ['Frequency = quadrats with it ÷ total × 100.', '= ' + found + ' ÷ ' + tot + ' × 100.', '= ' + N(found / tot * 100, 3) + '%.'] };
      } },
      { id: 'simpson', name: 'Simpson’s index', gen: function (r) {
        var ns = []; for (var i = r.int(3, 5); i > 0; i--) ns.push(r.int(2, 25));
        var Nt = ns.reduce(function (s, x) { return s + x; }, 0), den = ns.reduce(function (s, x) { return s + x * (x - 1); }, 0);
        return { q: 'Counts of each species: ' + ns.join(', ') + '. Calculate Simpson’s reciprocal index.', answer: Nt * (Nt - 1) / den, sf: 3,
          steps: ['N = ' + Nt + ', N(N − 1) = ' + Nt * (Nt - 1) + '.', 'Σn(n − 1) = ' + den + '.', 'D = ' + N(Nt * (Nt - 1) / den, 3) + '.'] };
      } },
    ] });

  add({ id: 'e-systems', units: [ES('1.2'), ES('4.1'), ES('7.2'), ES('6.2'), ES('1.3')], title: 'Systems, residence time and footprints',
    method: ['Residence time = size of the store ÷ rate of flow through it.', 'Efficiency = useful output ÷ input × 100.', 'Carbon footprint = activity × emission factor.', 'Ecological footprint ÷ biocapacity > 1 means a deficit: more land is needed than is available.'],
    variants: [
      { id: 'residence', name: 'Residence time', gen: function (r) {
        var store = r.int(10, 900) * 1000, flow = r.int(1, 90) * 100;
        return { q: 'A lake holds ' + store + ' m^{3}; water flows out at ' + flow + ' m^{3} per day. Find the residence time.', answer: store / flow, sf: 3, unit: 'days',
          steps: ['Residence time = store ÷ flow.', '= ' + store + ' ÷ ' + flow + '.', '= ' + N(store / flow, 3) + ' days.'] };
      } },
      { id: 'carbon', name: 'Carbon footprint', gen: function (r) {
        var km = r.int(1000, 20000), f = r.pick([0.12, 0.17, 0.21, 0.25]);
        return { q: 'A car emits ' + f + ' kg CO_{2} per km and is driven ' + km + ' km a year. Find its annual emissions in tonnes.', answer: km * f / 1000, sf: 3, unit: 't CO_{2}',
          steps: ['Emissions = ' + km + ' × ' + f + ' = ' + S(km * f, 2) + ' kg.', '1 t = 1000 kg.', '= ' + N(km * f / 1000, 3) + ' t CO_{2}.'] };
      } },
      { id: 'eff', name: 'Energy efficiency', gen: function (r) {
        var inp = r.int(100, 5000), eff = r.int(10, 60), out = inp * eff / 100;
        return { q: 'A power station uses ' + inp + ' MJ of fuel and supplies ' + S(out) + ' MJ of electricity. Find its efficiency.', answer: eff, unit: '%',
          steps: ['Efficiency = output ÷ input × 100.', '= ' + S(out) + ' ÷ ' + inp + ' × 100.', '= ' + eff + '%; the rest leaves as heat.'] };
      } },
      { id: 'footprint', name: 'Footprint and biocapacity', gen: function (r) {
        var fp = r.int(10, 90) / 10, bc = r.int(5, 60) / 10;
        return { q: 'A country’s ecological footprint is ' + fp + ' gha per person and its biocapacity ' + bc + ' gha per person. How many times its biocapacity is it using?', answer: fp / bc, sf: 3,
          steps: ['Ratio = footprint ÷ biocapacity.', '= ' + fp + ' ÷ ' + bc + '.', '= ' + N(fp / bc, 3) + (fp > bc ? ': an ecological deficit.' : ': within its biocapacity.')] };
      } },
    ] });

  T.register(skills);
})();
