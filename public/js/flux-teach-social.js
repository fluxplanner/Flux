/* ============================================================================
   FLUX TEACH · ECONOMICS, BUSINESS, COMPUTER SCIENCE, GEOGRAPHY, PSYCHOLOGY
   flux-teach-social.js — the quantitative skills of these subjects, generated
   with their answers computed (flux-teach-core.js). The written skills (how to
   structure an evaluation, a case-study answer) are in flux-teach-methods.js.
   ========================================================================== */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var T = root.FluxTeach, IB = root.FluxIbSyllabus;
  if (!T || !IB || root.__fluxTeachSocial) return;
  root.__fluxTeachSocial = true;

  var N = T.num, S = T.show;
  function U(sid, code) {
    var s = IB.subjects().filter(function (x) { return x.id === sid; })[0];
    var u = s && s.units.filter(function (x) { return x.code === code || x.title.indexOf(code) === 0; })[0];
    if (!u) throw new Error('No unit "' + code + '" in ' + sid);
    return u.id;
  }
  var EC = function (c) { return U('economics', c); };
  var BM = function (c) { return U('business', c); };
  var CS = function (c) { return U('cs', c); };
  var GE = function (c) { return U('geography', c); };
  var PS = function (c) { return U('psychology', c); };
  function m(x) { return String(x).replace(/^-/, '−'); }
  function b(x) { return x < 0 ? '(' + m(x) + ')' : String(x); }
  function money(x) { return (x < 0 ? '−$' : '$') + Math.abs(x).toLocaleString('en-US', { maximumFractionDigits: 2 }); }

  var skills = [];
  function add(s) { skills.push(s); }

  /* ════════════════════════ ECONOMICS ════════════════════════ */

  add({ id: 'ec-ppc', units: [EC('1.1'), EC('1.2')], title: 'Opportunity cost and the PPC',
    method: ['Opportunity cost = the next best alternative given up.', 'On a straight-line PPC, the opportunity cost of one more X = Y given up ÷ X gained.', 'Points inside the curve are inefficient; points outside are unattainable with current resources.'],
    variants: [
      { id: 'oc', name: 'Opportunity cost from a PPC', gen: function (r) {
        var maxX = r.int(10, 60), maxY = r.int(10, 120);
        return { q: 'An economy can make at most ' + maxX + ' units of wheat or ' + maxY + ' units of cloth (a straight-line PPC). What is the opportunity cost of one unit of wheat, in cloth?', answer: maxY / maxX, sf: 3,
          steps: ['Making all ' + maxX + ' wheat gives up all ' + maxY + ' cloth.', 'Opportunity cost of 1 wheat = ' + maxY + ' ÷ ' + maxX + '.', '= ' + N(maxY / maxX, 3) + ' units of cloth.'] };
      } },
      { id: 'point', name: 'Where is the point?', gen: function (r) {
        var maxX = r.int(20, 60), maxY = r.int(20, 120), x = r.int(1, maxX - 1), onY = maxY * (1 - x / maxX), kind = r.int(0, 2);
        var y = kind === 0 ? Math.round(onY * 0.6) : kind === 1 ? Math.round(onY * 1.4) + 1 : null;
        if (y === null) { if (onY !== Math.round(onY)) return null; y = onY; }
        var ans = kind === 2 ? 'On the curve: efficient' : kind === 0 ? 'Inside the curve: inefficient, resources unemployed' : 'Outside the curve: unattainable now';
        if (kind === 0 && y >= onY) return null;
        return Object.assign(T.choice(ans, ['On the curve: efficient', 'Inside the curve: inefficient, resources unemployed', 'Outside the curve: unattainable now']), {
          q: 'A straight-line PPC runs from ' + maxX + ' units of X to ' + maxY + ' units of Y. Where is the point (' + x + ' X, ' + y + ' Y)?',
          steps: ['With ' + x + ' X, the most Y possible on this line is ' + S(onY, 2) + '.', 'Compare ' + y + ' with ' + S(onY, 2) + '.', ans + '.'] });
      } },
    ] });

  add({ id: 'ec-market', units: [EC('2.1'), EC('2.2'), EC('2.3')], title: 'Demand, supply and equilibrium',
    method: ['Linear demand Q_{d} = a − bP; linear supply Q_{s} = c + dP.', 'Equilibrium: set Q_{d} = Q_{s}, solve for P, then substitute to find Q.', 'At a price above equilibrium there is excess supply (a surplus); below it, excess demand (a shortage).'],
    variants: [
      { id: 'eqP', name: 'Equilibrium price', gen: function (r) {
        var P = r.int(2, 30), Q = r.int(50, 500), bb = r.int(2, 12), d = r.int(2, 12), a = Q + bb * P, c = Q - d * P;
        return { q: 'Q_{d} = ' + a + ' − ' + bb + 'P and Q_{s} = ' + m(c) + ' + ' + d + 'P. Find the equilibrium price.', answer: P,
          steps: ['Set Q_{d} = Q_{s}: ' + a + ' − ' + bb + 'P = ' + m(c) + ' + ' + d + 'P.', a + ' − ' + b(c) + ' = (' + bb + ' + ' + d + ')P, so ' + (a - c) + ' = ' + (bb + d) + 'P.', 'P = $' + P + '.'] };
      } },
      { id: 'eqQ', name: 'Equilibrium quantity', gen: function (r) {
        var P = r.int(2, 30), Q = r.int(50, 500), bb = r.int(2, 12), d = r.int(2, 12), a = Q + bb * P, c = Q - d * P;
        return { q: 'Q_{d} = ' + a + ' − ' + bb + 'P and Q_{s} = ' + m(c) + ' + ' + d + 'P. Find the equilibrium quantity.', answer: Q,
          steps: ['Equilibrium price: ' + (a - c) + ' = ' + (bb + d) + 'P, so P = ' + P + '.', 'Substitute into demand: Q = ' + a + ' − ' + bb + ' × ' + P + '.', 'Q = ' + Q + ' units.'] };
      } },
      { id: 'shortage', name: 'Shortage or surplus at a price', gen: function (r) {
        var P = r.int(5, 30), Q = r.int(100, 500), bb = r.int(2, 10), d = r.int(2, 10), a = Q + bb * P, c = Q - d * P, p2 = P + r.nz(-4, 4);
        var qd = a - bb * p2, qs = c + d * p2;
        return { q: 'Q_{d} = ' + a + ' − ' + bb + 'P and Q_{s} = ' + m(c) + ' + ' + d + 'P. At P = $' + p2 + ', find the size of the ' + (p2 > P ? 'surplus' : 'shortage') + '.', answer: Math.abs(qs - qd),
          steps: ['At $' + p2 + ': Q_{d} = ' + qd + ', Q_{s} = ' + qs + '.', p2 > P ? 'Above equilibrium, supply exceeds demand.' : 'Below equilibrium, demand exceeds supply.', (p2 > P ? 'Surplus' : 'Shortage') + ' = ' + Math.abs(qs - qd) + ' units.'] };
      } },
    ] });

  add({ id: 'ec-elastic', units: [EC('2.5'), EC('2.6')], title: 'Elasticities: PED, PES, YED and XED',
    method: ['PED = %ΔQ_{d} ÷ %ΔP; ignoring the sign, > 1 is elastic, < 1 inelastic, = 1 unit elastic.', '% change = (new − old) ÷ old × 100.', 'Elastic demand: a price cut raises total revenue. Inelastic demand: a price rise raises it.', 'YED = %ΔQ_{d} ÷ %ΔY: positive normal (above 1 a luxury), negative inferior. XED = %ΔQ_{d} of A ÷ %ΔP of B: positive substitutes, negative complements. PES = %ΔQ_{s} ÷ %ΔP.'],
    variants: [
      { id: 'ped', name: 'Calculate PED', gen: function (r) {
        var p1 = r.int(4, 40), p2 = p1 + r.nz(-3, 3), q1 = r.int(20, 50) * 10, q2 = q1 + (p2 > p1 ? -1 : 1) * r.int(1, 15) * 10;
        if (q2 <= 0 || p2 <= 0) return null;
        var dq = (q2 - q1) / q1 * 100, dp = (p2 - p1) / p1 * 100, ped = dq / dp;
        return { q: 'When the price changes from $' + p1 + ' to $' + p2 + ', quantity demanded changes from ' + q1 + ' to ' + q2 + '. Calculate PED.', answer: ped, sf: 3,
          steps: ['%ΔQ = (' + q2 + ' − ' + q1 + ') ÷ ' + q1 + ' × 100 = ' + m(S(dq, 2)) + '%.', '%ΔP = (' + p2 + ' − ' + p1 + ') ÷ ' + p1 + ' × 100 = ' + m(S(dp, 2)) + '%.', 'PED = ' + m(S(dq, 2)) + ' ÷ ' + m(S(dp, 2)) + ' = ' + N(ped, 3) + ': ' + (Math.abs(ped) > 1 ? 'elastic.' : Math.abs(ped) < 1 ? 'inelastic.' : 'unit elastic.')] };
      } },
      { id: 'pedpct', name: 'PED from percentages', gen: function (r) {
        var dp = r.nz(-20, 20), ped = -r.int(2, 30) / 10, dq = T.round(ped * dp, 1);
        return { q: 'A ' + Math.abs(dp) + '% ' + (dp > 0 ? 'rise' : 'fall') + ' in price leads to a ' + Math.abs(dq) + '% ' + (dq > 0 ? 'rise' : 'fall') + ' in quantity demanded. Calculate PED.', answer: dq / dp, sf: 3,
          steps: ['PED = %ΔQ_{d} ÷ %ΔP.', '= ' + m(dq) + ' ÷ ' + m(dp) + '.', '= ' + N(dq / dp, 3) + ': ' + (Math.abs(dq / dp) > 1 ? 'elastic.' : Math.abs(dq / dp) < 1 ? 'inelastic.' : 'unit elastic.')] };
      } },
      { id: 'tr', name: 'Elasticity and total revenue', gen: function (r) {
        var ped = r.pick([0.3, 0.5, 0.8, 1.4, 2, 2.5]), up = r.next() < 0.5;
        var ans = (ped > 1) === up ? 'Total revenue falls' : 'Total revenue rises';
        return Object.assign(T.choice(ans, ['Total revenue rises', 'Total revenue falls', 'Total revenue stays the same']), {
          q: 'PED for a good is −' + ped + '. The firm ' + (up ? 'raises' : 'cuts') + ' its price. What happens to total revenue?',
          steps: ['|PED| = ' + ped + ': demand is ' + (ped > 1 ? 'elastic' : 'inelastic') + '.', ped > 1 ? 'Elastic: quantity changes proportionally more than price, so revenue moves the opposite way to price.' : 'Inelastic: quantity changes proportionally less, so revenue moves the same way as price.', ans + '.'] });
      } },
      { id: 'yed', name: 'YED and the type of good', gen: function (r) {
        var dy = r.int(2, 15), yed = r.pick([-1.5, -0.6, 0.4, 0.8, 1.6, 2.4]), dq = T.round(yed * dy, 1);
        var ans = yed < 0 ? 'Inferior good' : yed > 1 ? 'Normal good: a luxury (income elastic)' : 'Normal good: a necessity (income inelastic)';
        return Object.assign(T.choice(ans, ['Inferior good', 'Normal good: a luxury (income elastic)', 'Normal good: a necessity (income inelastic)']), {
          q: 'Incomes rise by ' + dy + '% and demand for a good changes by ' + m(dq) + '%. What kind of good is it?',
          steps: ['YED = %ΔQ_{d} ÷ %ΔY = ' + m(dq) + ' ÷ ' + dy + ' = ' + m(S(dq / dy, 2)) + '.', 'Negative → inferior; 0 to 1 → necessity; above 1 → luxury.', ans + '.'] });
      } },
      { id: 'xed', name: 'XED: substitutes or complements', gen: function (r) {
        var dp = r.int(5, 20), xed = r.pick([-1.2, -0.5, 0.6, 1.5]), dq = T.round(xed * dp, 1), ans = xed > 0 ? 'Substitutes' : 'Complements';
        return Object.assign(T.choice(ans, ['Substitutes', 'Complements', 'Unrelated goods']), {
          q: 'The price of good B rises by ' + dp + '% and demand for good A changes by ' + m(dq) + '%. How are A and B related?',
          steps: ['XED = ' + m(dq) + ' ÷ ' + dp + ' = ' + m(S(dq / dp, 2)) + '.', 'Positive → substitutes; negative → complements.', ans + '.'] });
      } },
      { id: 'pes', name: 'Calculate PES', gen: function (r) {
        var dp = r.int(5, 25), pes = r.int(2, 30) / 10, dq = T.round(pes * dp, 1);
        return { q: 'A ' + dp + '% rise in price leads to a ' + dq + '% rise in quantity supplied. Calculate PES.', answer: dq / dp, sf: 3,
          steps: ['PES = %ΔQ_{s} ÷ %ΔP.', '= ' + dq + ' ÷ ' + dp + '.', '= ' + N(dq / dp, 3) + ': ' + (dq / dp > 1 ? 'elastic supply.' : dq / dp < 1 ? 'inelastic supply.' : 'unit elastic.')] };
      } },
    ] });

  add({ id: 'ec-gov', units: [EC('2.7'), EC('2.8')], title: 'Taxes, subsidies, price controls and externalities',
    method: ['A specific tax t shifts supply up by t: Q_{s} = c + d(P − t).', 'Consumers bear the rise in price; producers bear the rest of the tax per unit.', 'Tax revenue = t × new quantity. Subsidy cost = subsidy × new quantity.', 'A maximum price below equilibrium causes a shortage; a minimum price above it, a surplus. Welfare loss = ½ × base × height of the triangle.'],
    variants: [
      { id: 'taxP', name: 'Price after a tax', gen: function (r) {
        var bb = r.int(2, 10), d = r.int(2, 10), P = r.int(5, 30), Q = r.int(100, 500), a = Q + bb * P, c = Q - d * P, t = r.int(1, 8), P2 = (a - c + d * t) / (bb + d);
        return { q: 'Q_{d} = ' + a + ' − ' + bb + 'P and Q_{s} = ' + m(c) + ' + ' + d + 'P. A specific tax of $' + t + ' per unit is imposed. Find the new price paid by consumers.', answer: P2, sf: 3,
          steps: ['New supply: Q_{s} = ' + m(c) + ' + ' + d + '(P − ' + t + ') = ' + m(c - d * t) + ' + ' + d + 'P.', 'Set equal to demand: ' + (a - c + d * t) + ' = ' + (bb + d) + 'P.', 'P = $' + N(P2, 3) + ' (up from $' + P + ').'] };
      } },
      { id: 'taxRev', name: 'Tax revenue', gen: function (r) {
        var bb = r.int(2, 10), d = r.int(2, 10), P = r.int(5, 30), Q = r.int(100, 500), a = Q + bb * P, c = Q - d * P, t = r.int(1, 8), P2 = (a - c + d * t) / (bb + d), Q2 = a - bb * P2;
        return { q: 'Q_{d} = ' + a + ' − ' + bb + 'P and Q_{s} = ' + m(c) + ' + ' + d + 'P. A $' + t + ' per unit tax is imposed. Find the government’s tax revenue.', answer: t * Q2, sf: 3,
          steps: ['New price: P = ' + (a - c + d * t) + ' ÷ ' + (bb + d) + ' = ' + S(P2, 3) + '.', 'New quantity: ' + a + ' − ' + bb + ' × ' + S(P2, 3) + ' = ' + S(Q2, 3) + '.', 'Revenue = ' + t + ' × ' + S(Q2, 3) + ' = $' + N(t * Q2, 3) + '.'] };
      } },
      { id: 'incidence', name: 'Who pays the tax?', gen: function (r) {
        var P = r.int(10, 40), t = r.int(2, 10), share = r.int(20, 80) / 100, rise = T.round(t * share, 2), askC = r.next() < 0.5;
        return { q: 'Before a $' + t + ' per unit tax the price was $' + P + '; afterwards consumers pay $' + (P + rise).toFixed(2) + '. How much of each unit’s tax do ' + (askC ? 'consumers' : 'producers') + ' pay?', answer: askC ? rise : T.round(t - rise, 2), dp: 2,
          steps: ['Consumer share = rise in price = $' + rise.toFixed(2) + '.', 'Producer share = tax − consumer share = $' + (t - rise).toFixed(2) + '.', (askC ? 'Consumers: $' + rise.toFixed(2) : 'Producers: $' + (t - rise).toFixed(2)) + ' per unit.'] };
      } },
      { id: 'subsidy', name: 'Cost of a subsidy', gen: function (r) {
        var s = r.int(1, 6), Q2 = r.int(100, 900);
        return { q: 'A subsidy of $' + s + ' per unit raises output to ' + Q2 + ' units. What does it cost the government?', answer: s * Q2,
          steps: ['Cost = subsidy per unit × new quantity.', '= ' + s + ' × ' + Q2 + '.', '= $' + s * Q2 + '.'] };
      } },
      { id: 'ceiling', name: 'Maximum and minimum prices', gen: function (r) {
        var bb = r.int(2, 10), d = r.int(2, 10), P = r.int(8, 30), Q = r.int(100, 500), a = Q + bb * P, c = Q - d * P, ceil = r.next() < 0.5, pc = P + (ceil ? -r.int(2, 6) : r.int(2, 6));
        var qd = a - bb * pc, qs = c + d * pc;
        return { q: 'Q_{d} = ' + a + ' − ' + bb + 'P and Q_{s} = ' + m(c) + ' + ' + d + 'P. A ' + (ceil ? 'maximum' : 'minimum') + ' price of $' + pc + ' is set. Find the ' + (ceil ? 'shortage.' : 'surplus.'), answer: Math.abs(qd - qs),
          steps: ['Equilibrium is $' + P + ', so this ' + (ceil ? 'maximum price below it' : 'minimum price above it') + ' binds.', 'At $' + pc + ': Q_{d} = ' + qd + ', Q_{s} = ' + qs + '.', (ceil ? 'Shortage' : 'Surplus') + ' = ' + Math.abs(qd - qs) + ' units.'] };
      } },
      { id: 'dwl', name: 'Welfare loss triangle', gen: function (r) {
        var base = r.int(10, 200), height = r.int(2, 30);
        return { q: 'A negative externality leads to overproduction of ' + base + ' units, and the external cost at the market output is $' + height + ' per unit. Find the welfare loss (the triangle between MSC and MSB).', answer: 0.5 * base * height,
          steps: ['The welfare loss is a triangle.', 'Area = ½ × base × height = ½ × ' + base + ' × ' + height + '.', '= $' + S(0.5 * base * height) + '.'] };
      } },
    ] });

  add({ id: 'ec-firm', units: [EC('2.11'), EC('2.4')], title: 'Costs, revenue and profit (HL)',
    method: ['TC = FC + VC; ATC = TC ÷ Q; MC = ΔTC ÷ ΔQ.', 'TR = P × Q; AR = TR ÷ Q; MR = ΔTR ÷ ΔQ.', 'Profit = TR − TC = (P − ATC) × Q. Profit is maximised where MC = MR.'],
    variants: [
      { id: 'atc', name: 'Average total cost', gen: function (r) {
        var FC = r.int(100, 2000), vc = r.int(2, 20), Q = r.int(20, 400), TC = FC + vc * Q;
        return { q: 'A firm has fixed costs of $' + FC + ' and variable costs of $' + vc + ' per unit. Find its ATC at ' + Q + ' units.', answer: TC / Q, sf: 3,
          steps: ['TC = ' + FC + ' + ' + vc + ' × ' + Q + ' = $' + TC + '.', 'ATC = TC ÷ Q.', '= ' + TC + ' ÷ ' + Q + ' = $' + N(TC / Q, 3) + '.'] };
      } },
      { id: 'profit', name: 'Profit or loss', gen: function (r) {
        var P = r.int(10, 60), atc = r.int(5, 70), Q = r.int(50, 500);
        return { q: 'A firm sells ' + Q + ' units at $' + P + ' with an ATC of $' + atc + '. Find its profit (a loss is negative).', answer: (P - atc) * Q,
          steps: ['Profit = (P − ATC) × Q.', '= (' + P + ' − ' + atc + ') × ' + Q + '.', '= ' + money((P - atc) * Q) + (P > atc ? ': abnormal profit.' : P < atc ? ': a loss.' : ': normal profit.')] };
      } },
      { id: 'mc', name: 'Marginal cost', gen: function (r) {
        var q1 = r.int(10, 50), tc1 = r.int(500, 3000), dq = r.int(1, 5), mc = r.int(4, 40);
        return { q: 'Total cost rises from $' + tc1 + ' at ' + q1 + ' units to $' + (tc1 + mc * dq) + ' at ' + (q1 + dq) + ' units. Find the marginal cost per unit.', answer: mc,
          steps: ['MC = ΔTC ÷ ΔQ.', '= ' + mc * dq + ' ÷ ' + dq + '.', '= $' + mc + '.'] };
      } },
    ] });

  add({ id: 'ec-macro', units: [EC('3.1'), EC('3.3')], title: 'Measuring the economy: GDP, inflation and unemployment',
    method: ['Real GDP = nominal GDP ÷ deflator × 100. Growth = (new − old) ÷ old × 100.', 'GNI = GDP + net income from abroad; per capita, divide by the population.', 'Weighted price index = Σ(weight × index) ÷ Σweights. Inflation = (new index − old) ÷ old × 100.', 'Unemployment rate = unemployed ÷ labour force × 100. Real interest rate ≈ nominal − inflation.'],
    variants: [
      { id: 'real', name: 'Real GDP', gen: function (r) {
        var nom = r.int(200, 3000), def = r.int(100, 160);
        return { q: 'Nominal GDP is $' + nom + ' bn and the GDP deflator is ' + def + ' (base year = 100). Find real GDP in $ bn.', answer: nom / def * 100, sf: 3,
          steps: ['Real GDP = nominal ÷ deflator × 100.', '= ' + nom + ' ÷ ' + def + ' × 100.', '= $' + N(nom / def * 100, 3) + ' bn at base-year prices.'] };
      } },
      { id: 'growth', name: 'Growth rate', gen: function (r) {
        var y1 = r.int(500, 2000), y2 = T.round(y1 * (1 + r.nz(-30, 80) / 1000), 1);
        return { q: 'Real GDP changes from $' + y1 + ' bn to $' + y2 + ' bn. Find the growth rate.', answer: (y2 - y1) / y1 * 100, sf: 3,
          steps: ['Growth = (new − old) ÷ old × 100.', '= (' + y2 + ' − ' + y1 + ') ÷ ' + y1 + ' × 100.', '= ' + N((y2 - y1) / y1 * 100, 3) + '%.'] };
      } },
      { id: 'gni', name: 'GNI per capita', gen: function (r) {
        var gdp = r.int(50, 3000), net = r.int(-40, 80), pop = r.int(2, 300);
        return { q: 'GDP is $' + gdp + ' bn, net income from abroad ' + m(net) + ' bn and the population ' + pop + ' million. Find GNI per capita in dollars.', answer: (gdp + net) * 1000 / pop, sf: 3,
          steps: ['GNI = GDP + net income from abroad = $' + (gdp + net) + ' bn.', 'Per capita = ' + (gdp + net) + '×10^{9} ÷ ' + pop + '×10^{6}.', '= $' + N((gdp + net) * 1000 / pop, 3) + '.'] };
      } },
      { id: 'cpi', name: 'Weighted price index', gen: function (r) {
        var w = [r.int(1, 6) * 10, r.int(1, 6) * 10, r.int(1, 6) * 10], idx = [r.int(95, 130), r.int(95, 130), r.int(95, 130)];
        var sw = w[0] + w[1] + w[2], tot = w[0] * idx[0] + w[1] * idx[1] + w[2] * idx[2];
        return { q: 'Three goods have weights ' + w.join(', ') + ' and price indices ' + idx.join(', ') + ' (base year = 100). Find the weighted price index.', answer: tot / sw, sf: 4,
          steps: ['Weight × index: ' + w.map(function (x, i) { return x + '×' + idx[i]; }).join(' + ') + ' = ' + tot + '.', 'Divide by the total weight, ' + sw + '.', '= ' + N(tot / sw, 4) + '.'] };
      } },
      { id: 'infl', name: 'Inflation rate', gen: function (r) {
        var i1 = r.int(100, 150), i2 = T.round(i1 * (1 + r.int(-10, 90) / 1000), 1);
        if (i2 === i1) return null;
        return { q: 'The CPI moves from ' + i1 + ' to ' + i2 + '. Find the inflation rate.', answer: (i2 - i1) / i1 * 100, sf: 3,
          steps: ['Inflation = (new − old) ÷ old × 100.', '= (' + i2 + ' − ' + i1 + ') ÷ ' + i1 + ' × 100.', '= ' + N((i2 - i1) / i1 * 100, 3) + '%' + (i2 < i1 ? ': deflation.' : '.')] };
      } },
      { id: 'unemp', name: 'Unemployment rate', gen: function (r) {
        var emp = r.int(5, 60), un = T.round(emp * r.int(2, 15) / 100, 2);
        return { q: emp + ' million people are employed and ' + un + ' million are unemployed. Find the unemployment rate.', answer: un / (emp + un) * 100, sf: 3,
          steps: ['Labour force = employed + unemployed = ' + T.round(emp + un, 2) + ' million.', 'Rate = unemployed ÷ labour force × 100.', '= ' + N(un / (emp + un) * 100, 3) + '%.'] };
      } },
      { id: 'realint', name: 'Real interest rate', gen: function (r) {
        var nom = r.int(1, 12), inf = r.int(0, 10);
        return { q: 'The nominal interest rate is ' + nom + '% and inflation is ' + inf + '%. Find the real interest rate.', answer: nom - inf,
          steps: ['Real rate ≈ nominal − inflation.', '= ' + nom + ' − ' + inf + '.', '= ' + m(nom - inf) + '%.'] };
      } },
    ] });

  add({ id: 'ec-multiplier', units: [EC('3.6'), EC('3.2')], title: 'The Keynesian multiplier (HL)',
    method: ['Multiplier k = 1 ÷ (1 − MPC) = 1 ÷ MPW, where MPW = MPS + MPT + MPM.', 'Change in real GDP = k × the initial change in spending.', 'MPC + MPS + MPT + MPM = 1.'],
    variants: [
      { id: 'mpc', name: 'From the MPC', gen: function (r) {
        var mpc = r.pick([0.5, 0.6, 0.75, 0.8, 0.9]);
        return { q: 'The marginal propensity to consume is ' + mpc + '. Find the multiplier.', answer: 1 / (1 - mpc), sf: 3,
          steps: ['k = 1 ÷ (1 − MPC).', '= 1 ÷ ' + T.round(1 - mpc, 2) + '.', 'k = ' + N(1 / (1 - mpc), 3) + '.'] };
      } },
      { id: 'leak', name: 'From the leakages', gen: function (r) {
        var s = r.int(5, 20) / 100, t = r.int(5, 25) / 100, mm = r.int(5, 25) / 100, w = T.round(s + t + mm, 2);
        return { q: 'MPS = ' + s + ', MPT = ' + t + ' and MPM = ' + mm + '. Find the multiplier.', answer: 1 / w, sf: 3,
          steps: ['MPW = MPS + MPT + MPM = ' + w + '.', 'k = 1 ÷ MPW.', 'k = ' + N(1 / w, 3) + '.'] };
      } },
      { id: 'dy', name: 'Change in GDP', gen: function (r) {
        var mpc = r.pick([0.5, 0.6, 0.75, 0.8]), inj = r.int(1, 50) * 10, k = 1 / (1 - mpc);
        return { q: 'Government spending rises by $' + inj + ' m and the MPC is ' + mpc + '. By how much does real GDP change (in $ m)?', answer: inj * k, sf: 3,
          steps: ['k = 1 ÷ (1 − ' + mpc + ') = ' + S(k, 3) + '.', 'ΔGDP = k × injection = ' + S(k, 3) + ' × ' + inj + '.', '= $' + N(inj * k, 3) + ' m.'] };
      } },
    ] });

  add({ id: 'ec-equity', units: [EC('3.4')], title: 'Taxes and inequality',
    method: ['Progressive tax: higher rates on higher slices of income (marginal rates).', 'Tax = Σ(income in each band × that band’s rate).', 'Average tax rate = total tax ÷ income × 100; marginal rate = the rate on the next dollar.'],
    variants: [
      { id: 'band', name: 'Tax with two bands', gen: function (r) {
        var t1 = r.int(10, 20) * 1000, r1 = r.pick([10, 15, 20]), r2 = r.pick([30, 35, 40]), inc = r.int(t1 / 1000 + 5, 120) * 1000, tax = t1 * r1 / 100 + (inc - t1) * r2 / 100;
        return { q: 'Income up to $' + t1 + ' is taxed at ' + r1 + '%, income above it at ' + r2 + '%. Find the tax on $' + inc + '.', answer: tax,
          steps: ['First band: ' + t1 + ' × ' + r1 + '% = $' + t1 * r1 / 100 + '.', 'Above it: (' + inc + ' − ' + t1 + ') × ' + r2 + '% = $' + (inc - t1) * r2 / 100 + '.', 'Total = $' + tax + '.'] };
      } },
      { id: 'avg', name: 'Average tax rate', gen: function (r) {
        var t1 = r.int(10, 20) * 1000, r1 = r.pick([10, 15, 20]), r2 = r.pick([30, 35, 40]), inc = r.int(t1 / 1000 + 5, 120) * 1000, tax = t1 * r1 / 100 + (inc - t1) * r2 / 100;
        return { q: 'Income up to $' + t1 + ' is taxed at ' + r1 + '%, above that at ' + r2 + '%. Find the average tax rate on $' + inc + '.', answer: tax / inc * 100, sf: 3,
          steps: ['Tax = ' + t1 * r1 / 100 + ' + ' + (inc - t1) * r2 / 100 + ' = $' + tax + '.', 'Average rate = tax ÷ income × 100.', '= ' + N(tax / inc * 100, 3) + '%, below the ' + r2 + '% marginal rate.'] };
      } },
    ] });

  add({ id: 'ec-trade', units: [EC('4.1'), EC('4.2'), EC('4.3')], title: 'International trade and protection',
    method: ['Comparative advantage: the country with the lower opportunity cost of a good should specialise in it.', 'Opportunity cost of 1 X = Y it could have made instead ÷ X.', 'Imports = domestic demand − domestic supply at the world (or world + tariff) price.', 'Tariff revenue = tariff per unit × imports after the tariff.'],
    variants: [
      { id: 'comp', name: 'Comparative advantage', gen: function (r) {
        var aX = r.int(2, 12), aY = r.int(2, 12), bX = r.int(2, 12), bY = r.int(2, 12), ocA = aY / aX, ocB = bY / bX;
        if (Math.abs(ocA - ocB) < 1e-9) return null;
        var ans = ocA < ocB ? 'Country A' : 'Country B';
        return Object.assign(T.choice(ans, ['Country A', 'Country B', 'Neither: they gain nothing from trade']), {
          q: 'With the same resources, country A can make ' + aX + ' X or ' + aY + ' Y, and country B ' + bX + ' X or ' + bY + ' Y. Which has the comparative advantage in X?',
          steps: ['Opportunity cost of 1 X: A gives up ' + aY + '/' + aX + ' = ' + S(ocA, 3) + ' Y; B gives up ' + bY + '/' + bX + ' = ' + S(ocB, 3) + ' Y.', 'The lower opportunity cost holds the comparative advantage.', ans + '.'] });
      } },
      { id: 'imports', name: 'Imports at the world price', gen: function (r) {
        var a = r.int(400, 1000), bb = r.int(5, 20), c = r.int(-200, 50), d = r.int(5, 20), pw = r.int(5, 15), imp = (a - bb * pw) - (c + d * pw);
        if (imp <= 0) return null;
        return { q: 'Q_{d} = ' + a + ' − ' + bb + 'P and Q_{s} = ' + m(c) + ' + ' + d + 'P. With free trade at a world price of $' + pw + ', how many units are imported?', answer: imp,
          steps: ['At $' + pw + ': Q_{d} = ' + (a - bb * pw) + ', domestic Q_{s} = ' + (c + d * pw) + '.', 'Imports fill the gap: Q_{d} − Q_{s}.', '= ' + imp + ' units.'] };
      } },
      { id: 'tariff', name: 'Tariff revenue', gen: function (r) {
        var a = r.int(400, 1000), bb = r.int(5, 20), c = r.int(-200, 50), d = r.int(5, 20), pw = r.int(5, 15), t = r.int(1, 5), p2 = pw + t, imp = (a - bb * p2) - (c + d * p2);
        if (imp <= 0) return null;
        return { q: 'Q_{d} = ' + a + ' − ' + bb + 'P and Q_{s} = ' + m(c) + ' + ' + d + 'P. The world price is $' + pw + ' and a $' + t + ' tariff is imposed. Find the tariff revenue.', answer: t * imp,
          steps: ['Domestic price = ' + pw + ' + ' + t + ' = $' + p2 + '.', 'Imports = ' + (a - bb * p2) + ' − ' + (c + d * p2) + ' = ' + imp + ' units.', 'Revenue = ' + t + ' × ' + imp + ' = $' + t * imp + '.'] };
      } },
    ] });

  add({ id: 'ec-forex', units: [EC('4.5'), EC('4.6')], title: 'Exchange rates and the balance of payments',
    method: ['If £1 = $x then $1 = £1/x: multiply or divide so the units cancel.', 'Appreciation % = (new rate − old rate) ÷ old rate × 100, with the rate as foreign currency per unit of the home currency.', 'Current account = trade in goods + trade in services + net income + net current transfers.'],
    variants: [
      { id: 'convert', name: 'Converting currency', gen: function (r) {
        var rate = r.int(110, 160) / 100, gbp = r.int(10, 900);
        return { q: '£1 = $' + rate + '. How many dollars is £' + gbp + '?', answer: T.round(gbp * rate, 2), dp: 2,
          steps: ['Each pound buys $' + rate + '.', gbp + ' × ' + rate + '.', '= $' + (gbp * rate).toFixed(2) + '.'] };
      } },
      { id: 'reverse', name: 'Converting back', gen: function (r) {
        var rate = r.int(110, 160) / 100, usd = r.int(10, 900);
        return { q: '£1 = $' + rate + '. How many pounds is $' + usd + '?', answer: T.round(usd / rate, 2), dp: 2,
          steps: ['$1 = £1/' + rate + '.', usd + ' ÷ ' + rate + '.', '= £' + (usd / rate).toFixed(2) + '.'] };
      } },
      { id: 'appr', name: 'Appreciation or depreciation', gen: function (r) {
        var r1 = r.int(100, 160) / 100, r2 = T.round(r1 * (1 + r.nz(-15, 15) / 100), 2), ch = (r2 - r1) / r1 * 100;
        if (r2 === r1) return null;
        return { q: 'The pound moves from $' + r1 + ' to $' + r2 + '. Find the percentage change in its value (negative for a depreciation).', answer: ch, sf: 3,
          steps: ['% change = (new − old) ÷ old × 100.', '= (' + r2 + ' − ' + r1 + ') ÷ ' + r1 + ' × 100.', '= ' + N(ch, 3) + '%: ' + (ch > 0 ? 'an appreciation.' : 'a depreciation.')] };
      } },
      { id: 'export', name: 'Export price abroad', gen: function (r) {
        var p = r.int(5, 200), r1 = r.int(110, 150) / 100, r2 = T.round(r1 * (1 + r.nz(-12, 12) / 100), 2);
        return { q: 'A British good costs £' + p + '. The pound moves from $' + r1 + ' to $' + r2 + '. What is its new dollar price?', answer: T.round(p * r2, 2), dp: 2,
          steps: ['Old price: ' + p + ' × ' + r1 + ' = $' + (p * r1).toFixed(2) + '.', 'New price: ' + p + ' × ' + r2 + '.', '= $' + (p * r2).toFixed(2) + (r2 > r1 ? ': dearer abroad, so exports may fall.' : ': cheaper abroad, so exports may rise.')] };
      } },
      { id: 'ca', name: 'Current account balance', gen: function (r) {
        var g2 = r.int(-80, 60), s = r.int(-30, 50), inc = r.int(-20, 20), tr = r.int(-15, 10), tot = g2 + s + inc + tr;
        return { q: 'Trade in goods ' + m(g2) + ' bn; trade in services ' + m(s) + ' bn; net income ' + m(inc) + ' bn; net current transfers ' + m(tr) + ' bn. Find the current account balance in bn.', answer: tot,
          steps: ['Current account = goods + services + income + transfers.', '= ' + m(g2) + ' + ' + b(s) + ' + ' + b(inc) + ' + ' + b(tr) + '.', '= ' + m(tot) + ' bn: a ' + (tot >= 0 ? 'surplus.' : 'deficit.')] };
      } },
    ] });

  add({ id: 'ec-dev', units: [EC('4.8'), EC('4.7')], title: 'Measuring development',
    method: ['GDP per capita = GDP ÷ population; compare countries in PPP dollars.', 'HDI is the geometric mean of the health, education and income indices: (H × E × I)^{1/3}.', 'Composite indicators capture more of development than income alone.'],
    variants: [
      { id: 'hdi', name: 'HDI from its indices', gen: function (r) {
        var hh = r.int(50, 99) / 100, e = r.int(40, 99) / 100, i = r.int(40, 99) / 100, v = Math.cbrt(hh * e * i);
        return { q: 'A country has health index ' + hh + ', education index ' + e + ' and income index ' + i + '. Calculate its HDI.', answer: v, sf: 3,
          steps: ['HDI = (H × E × I)^{1/3}.', '= (' + hh + ' × ' + e + ' × ' + i + ')^{1/3} = (' + S(hh * e * i, 5) + ')^{1/3}.', 'HDI = ' + N(v, 3) + '.'] };
      } },
      { id: 'pc', name: 'GDP per capita', gen: function (r) {
        var gdp = r.int(5, 3000), pop = r.int(1, 200);
        return { q: 'GDP is $' + gdp + ' bn and the population ' + pop + ' million. Find GDP per capita in dollars.', answer: gdp * 1000 / pop, sf: 3,
          steps: ['GDP per capita = GDP ÷ population.', '= ' + gdp + '×10^{9} ÷ ' + pop + '×10^{6}.', '= $' + N(gdp * 1000 / pop, 3) + '.'] };
      } },
    ] });

  /* ════════════════════════ BUSINESS MANAGEMENT ════════════════════════ */

  add({ id: 'bm-breakeven', units: [BM('5.5')], title: 'Break-even analysis',
    method: ['Contribution per unit = price − variable cost per unit.', 'Break-even quantity = fixed costs ÷ contribution per unit.', 'Margin of safety = actual output − break-even output.', 'Output for a target profit = (fixed costs + target profit) ÷ contribution per unit.'],
    variants: [
      { id: 'beq', name: 'Break-even quantity', gen: function (r) {
        var P = r.int(10, 80), vc = r.int(2, P - 2), cpu = P - vc, beq = r.int(50, 2000), FC = beq * cpu;
        return { q: 'A product sells for $' + P + ' with variable costs of $' + vc + ' per unit. Fixed costs are $' + FC + '. Find the break-even quantity.', answer: beq,
          steps: ['Contribution per unit = ' + P + ' − ' + vc + ' = $' + cpu + '.', 'Break-even = fixed costs ÷ contribution.', '= ' + FC + ' ÷ ' + cpu + ' = ' + beq + ' units.'] };
      } },
      { id: 'mos', name: 'Margin of safety', gen: function (r) {
        var P = r.int(10, 80), vc = r.int(2, P - 2), cpu = P - vc, beq = r.int(50, 1500), FC = beq * cpu, out = beq + r.int(-200, 800);
        if (out <= 0) return null;
        return { q: 'Price $' + P + ', variable cost $' + vc + ' per unit, fixed costs $' + FC + '. The firm sells ' + out + ' units. Find its margin of safety.', answer: out - beq,
          steps: ['Break-even = ' + FC + ' ÷ ' + cpu + ' = ' + beq + ' units.', 'Margin of safety = output − break-even.', '= ' + out + ' − ' + beq + ' = ' + m(out - beq) + ' units' + (out < beq ? ': below break-even, so a loss.' : '.')] };
      } },
      { id: 'target', name: 'Output for a target profit', gen: function (r) {
        var P = r.int(10, 80), vc = r.int(2, P - 2), cpu = P - vc, FC = r.int(10, 200) * 100, tp = r.int(5, 100) * 100, q = (FC + tp) / cpu;
        return { q: 'Price $' + P + ', variable cost $' + vc + ', fixed costs $' + FC + '. How many whole units must it sell to make a profit of at least $' + tp + '?', answer: Math.ceil(q - 1e-9),
          steps: ['Contribution per unit = $' + cpu + '.', 'Units = (fixed costs + target) ÷ contribution = ' + (FC + tp) + ' ÷ ' + cpu + ' = ' + S(q, 2) + '.', 'Round up: ' + Math.ceil(q - 1e-9) + ' units.'] };
      } },
      { id: 'profit', name: 'Profit at an output', gen: function (r) {
        var P = r.int(10, 80), vc = r.int(2, P - 2), FC = r.int(10, 200) * 100, q = r.int(50, 2000), pr = q * (P - vc) - FC;
        return { q: 'Price $' + P + ', variable cost $' + vc + ' per unit, fixed costs $' + FC + '. Find the profit at ' + q + ' units (negative for a loss).', answer: pr,
          steps: ['Total contribution = ' + q + ' × ' + (P - vc) + ' = $' + q * (P - vc) + '.', 'Profit = total contribution − fixed costs.', '= ' + money(pr) + '.'] };
      } },
    ] });

  add({ id: 'bm-ratios', units: [BM('3.5'), BM('3.6'), BM('3.4')], title: 'Ratio analysis',
    method: ['Gross profit margin = gross profit ÷ sales × 100; profit margin = profit before interest and tax ÷ sales × 100.', 'ROCE = PBIT ÷ capital employed × 100 (capital employed = non-current liabilities + equity).', 'Current ratio = current assets ÷ current liabilities (guide: 1.5–2). Acid test = (current assets − stock) ÷ current liabilities (guide: about 1).', 'Gearing (HL) = non-current liabilities ÷ capital employed × 100 (above 50% is highly geared).'],
    variants: [
      { id: 'gpm', name: 'Gross profit margin', gen: function (r) {
        var sales = r.int(100, 2000) * 1000, cos = Math.round(sales * r.int(30, 85) / 100);
        return { q: 'Sales revenue is $' + sales + ' and cost of sales $' + cos + '. Find the gross profit margin.', answer: (sales - cos) / sales * 100, sf: 3,
          steps: ['Gross profit = ' + sales + ' − ' + cos + ' = $' + (sales - cos) + '.', 'GPM = gross profit ÷ sales × 100.', '= ' + N((sales - cos) / sales * 100, 3) + '%.'] };
      } },
      { id: 'pm', name: 'Profit margin', gen: function (r) {
        var sales = r.int(100, 2000) * 1000, pbit = Math.round(sales * r.nz(-5, 30) / 100);
        return { q: 'Sales revenue is $' + sales + ' and profit before interest and tax ' + money(pbit) + '. Find the profit margin.', answer: pbit / sales * 100, sf: 3,
          steps: ['Profit margin = PBIT ÷ sales × 100.', '= ' + pbit + ' ÷ ' + sales + ' × 100.', '= ' + N(pbit / sales * 100, 3) + '%.'] };
      } },
      { id: 'roce', name: 'ROCE', gen: function (r) {
        var ncl = r.int(50, 800) * 1000, eq = r.int(100, 1500) * 1000, pbit = Math.round((ncl + eq) * r.int(2, 30) / 100);
        return { q: 'PBIT is $' + pbit + ', non-current liabilities $' + ncl + ' and equity $' + eq + '. Find ROCE.', answer: pbit / (ncl + eq) * 100, sf: 3,
          steps: ['Capital employed = ' + ncl + ' + ' + eq + ' = $' + (ncl + eq) + '.', 'ROCE = PBIT ÷ capital employed × 100.', '= ' + N(pbit / (ncl + eq) * 100, 3) + '%.'] };
      } },
      { id: 'current', name: 'Current ratio', gen: function (r) {
        var ca = r.int(20, 500) * 1000, cl = r.int(20, 400) * 1000, v = ca / cl;
        return { q: 'Current assets are $' + ca + ' and current liabilities $' + cl + '. Find the current ratio.', answer: v, sf: 3,
          steps: ['Current ratio = current assets ÷ current liabilities.', '= ' + ca + ' ÷ ' + cl + '.', '= ' + N(v, 3) + (v < 1.5 ? ': below the 1.5–2 guide, a liquidity risk.' : v > 2 ? ': above 2, perhaps too much cash tied up.' : ': within the 1.5–2 guide.')] };
      } },
      { id: 'acid', name: 'Acid test ratio', gen: function (r) {
        var ca = r.int(50, 500) * 1000, stock = Math.round(ca * r.int(10, 60) / 100), cl = r.int(30, 400) * 1000, v = (ca - stock) / cl;
        return { q: 'Current assets are $' + ca + ' (including stock of $' + stock + ') and current liabilities $' + cl + '. Find the acid test ratio.', answer: v, sf: 3,
          steps: ['Take stock out: ' + ca + ' − ' + stock + ' = $' + (ca - stock) + '.', 'Acid test = (current assets − stock) ÷ current liabilities.', '= ' + N(v, 3) + (v < 1 ? ': below 1, short-term debts may be hard to pay.' : '.')] };
      } },
      { id: 'gearing', name: 'Gearing (HL)', gen: function (r) {
        var ncl = r.int(50, 900) * 1000, eq = r.int(100, 1500) * 1000, v = ncl / (ncl + eq) * 100;
        return { q: 'Non-current liabilities are $' + ncl + ' and equity $' + eq + '. Find the gearing ratio.', answer: v, sf: 3,
          steps: ['Capital employed = $' + (ncl + eq) + '.', 'Gearing = non-current liabilities ÷ capital employed × 100.', '= ' + N(v, 3) + '%' + (v > 50 ? ': highly geared.' : '.')] };
      } },
    ] });

  add({ id: 'bm-invest', units: [BM('3.8')], title: 'Investment appraisal',
    method: ['Payback: add the yearly net cash flows until the cost is repaid; for the final part year, fraction = amount still needed ÷ that year’s cash flow.', 'Average rate of return = ((total returns − cost) ÷ years) ÷ cost × 100.', 'NPV = Σ(net cash flow × discount factor) − cost. A positive NPV means the investment is worthwhile at that interest rate.'],
    variants: [
      { id: 'payback', name: 'Payback period', gen: function (r) {
        var cost = r.int(20, 200) * 1000, flows = [r.int(5, 60), r.int(5, 60), r.int(5, 60), r.int(5, 60), r.int(5, 60)].map(function (x) { return x * 1000; });
        var cum = 0, yrs = 0, k = -1;
        for (var i = 0; i < flows.length; i++) { if (cum + flows[i] >= cost) { yrs = i + (cost - cum) / flows[i]; k = i; break; } cum += flows[i]; }
        if (k < 0) return null;
        return { q: 'An investment costs $' + cost + '. Net cash flows for years 1–5 are $' + flows.join(', $') + '. Find the payback period in years.', answer: yrs, sf: 3,
          steps: ['After ' + k + ' full year' + (k === 1 ? '' : 's') + ' the cumulative cash flow is $' + cum + '; $' + (cost - cum) + ' is still needed.', 'Year ' + (k + 1) + ' brings $' + flows[k] + ': ' + (cost - cum) + ' ÷ ' + flows[k] + ' = ' + S((cost - cum) / flows[k], 3) + ' of a year (' + S((cost - cum) / flows[k] * 12, 1) + ' months).', 'Payback = ' + N(yrs, 3) + ' years.'] };
      } },
      { id: 'arr', name: 'Average rate of return', gen: function (r) {
        var cost = r.int(20, 200) * 1000, n = r.int(3, 6), total = cost + r.int(1, 120) * 1000, v = (total - cost) / n / cost * 100;
        return { q: 'An investment costs $' + cost + ' and returns $' + total + ' in total over ' + n + ' years. Find the ARR.', answer: v, sf: 3,
          steps: ['Net return = ' + total + ' − ' + cost + ' = $' + (total - cost) + '.', 'Per year: ÷ ' + n + ' = $' + S((total - cost) / n, 2) + '.', 'ARR = ' + S((total - cost) / n, 2) + ' ÷ ' + cost + ' × 100 = ' + N(v, 3) + '%.'] };
      } },
      { id: 'npv', name: 'Net present value', gen: function (r) {
        var rate = r.pick([5, 8, 10, 12]), cost = r.int(20, 120) * 1000, flows = [r.int(10, 50), r.int(10, 50), r.int(10, 50)].map(function (x) { return x * 1000; });
        var dfs = flows.map(function (_, i) { return T.round(1 / Math.pow(1 + rate / 100, i + 1), 3); });
        var pv = flows.reduce(function (s, f, i) { return s + f * dfs[i]; }, 0), npv = pv - cost;
        return { q: 'Cost $' + cost + '; net cash flows $' + flows.join(', $') + ' in years 1–3. Discount factors at ' + rate + '%: ' + dfs.join(', ') + '. Find the NPV.', answer: npv, abs: 1,
          steps: ['Present values: ' + flows.map(function (f, i) { return f + ' × ' + dfs[i] + ' = ' + S(f * dfs[i], 0); }).join('; ') + '.', 'Total PV = $' + S(pv, 0) + '.', 'NPV = ' + S(pv, 0) + ' − ' + cost + ' = ' + money(Math.round(npv)) + (npv > 0 ? ': worthwhile at ' + rate + '%.' : ': not worthwhile at ' + rate + '%.')] };
      } },
    ] });

  add({ id: 'bm-finance', units: [BM('3.3'), BM('3.4'), BM('3.7'), BM('3.9')], title: 'Depreciation, cash flow and budgets',
    method: ['Straight-line depreciation per year = (cost − residual value) ÷ useful life.', 'Reducing balance: each year’s value = last year’s value × (1 − rate).', 'Closing cash = opening cash + inflows − outflows; it becomes the next opening balance.', 'Variance = actual − budget; favourable if it helps profit (more revenue or less cost).'],
    variants: [
      { id: 'sl', name: 'Straight-line depreciation', gen: function (r) {
        var cost = r.int(10, 200) * 1000, res = r.int(0, 20) * 1000, yrs = r.int(3, 10);
        if (res >= cost) return null;
        return { q: 'A machine costs $' + cost + ', lasts ' + yrs + ' years and has a residual value of $' + res + '. Find the annual straight-line depreciation.', answer: T.round((cost - res) / yrs, 2), dp: 2,
          steps: ['Depreciation = (cost − residual value) ÷ life.', '= (' + cost + ' − ' + res + ') ÷ ' + yrs + '.', '= $' + ((cost - res) / yrs).toFixed(2) + ' a year.'] };
      } },
      { id: 'rb', name: 'Reducing balance', gen: function (r) {
        var cost = r.int(10, 200) * 1000, rate = r.pick([10, 20, 25, 30, 40]), n = r.int(1, 4), v = cost * Math.pow(1 - rate / 100, n);
        return { q: 'A vehicle bought for $' + cost + ' depreciates by ' + rate + '% a year on the reducing balance. Find its value after ' + n + ' year' + (n > 1 ? 's' : '') + '.', answer: T.round(v, 2), dp: 2,
          steps: ['Each year multiply by ' + T.round(1 - rate / 100, 2) + '.', cost + ' × ' + T.round(1 - rate / 100, 2) + '^{' + n + '}.', '= $' + v.toFixed(2) + '.'] };
      } },
      { id: 'cash', name: 'Closing cash balance', gen: function (r) {
        var open = r.int(-20, 50) * 1000, ins = r.int(10, 120) * 1000, outs = r.int(10, 120) * 1000;
        return { q: 'Opening balance ' + money(open) + ', cash inflows $' + ins + ', cash outflows $' + outs + '. Find the closing balance.', answer: open + ins - outs,
          steps: ['Net cash flow = ' + ins + ' − ' + outs + ' = ' + money(ins - outs) + '.', 'Closing = opening + net cash flow.', '= ' + money(open + ins - outs) + '.'] };
      } },
      { id: 'variance', name: 'Budget variance', gen: function (r) {
        var cost = r.next() < 0.5, bud = r.int(10, 200) * 1000, act = bud + r.nz(-30, 30) * 1000, fav = cost ? act < bud : act > bud;
        var amt = money(Math.abs(act - bud));
        return Object.assign(T.choice((fav ? 'Favourable' : 'Adverse') + ', ' + amt, ['Favourable, ' + amt, 'Adverse, ' + amt]), {
          q: 'Budgeted ' + (cost ? 'costs' : 'sales revenue') + ' were $' + bud + '; the actual figure was $' + act + '. What is the variance?',
          steps: ['Variance = actual − budget = ' + money(act - bud) + '.', cost ? 'For costs, spending less than planned helps profit.' : 'For revenue, earning more than planned helps profit.', (fav ? 'Favourable' : 'Adverse') + ', ' + amt + '.'] });
      } },
    ] });

  add({ id: 'bm-ops', units: [BM('5.6'), BM('5.3'), BM('2.1'), BM('5.2')], title: 'Operations and HR measures',
    method: ['Capacity utilisation = actual output ÷ maximum possible output × 100.', 'Labour productivity = output ÷ number of workers (per period).', 'Labour turnover = staff leaving ÷ average number employed × 100.', 'Defect rate = defective units ÷ total units × 100.'],
    variants: [
      { id: 'capacity', name: 'Capacity utilisation', gen: function (r) {
        var max = r.int(10, 200) * 100, act = Math.round(max * r.int(30, 100) / 100);
        return { q: 'A factory can make ' + max + ' units a month and makes ' + act + '. Find its capacity utilisation.', answer: act / max * 100, sf: 3,
          steps: ['Capacity utilisation = actual ÷ maximum × 100.', '= ' + act + ' ÷ ' + max + ' × 100.', '= ' + N(act / max * 100, 3) + '%.'] };
      } },
      { id: 'turnover', name: 'Labour turnover', gen: function (r) {
        var avg = r.int(20, 900), left = r.int(1, Math.floor(avg / 3));
        return { q: left + ' staff left this year; the average workforce was ' + avg + '. Find the labour turnover.', answer: left / avg * 100, sf: 3,
          steps: ['Labour turnover = leavers ÷ average workforce × 100.', '= ' + left + ' ÷ ' + avg + ' × 100.', '= ' + N(left / avg * 100, 3) + '%.'] };
      } },
      { id: 'productivity', name: 'Labour productivity', gen: function (r) {
        var out = r.int(500, 20000), workers = r.int(5, 120);
        return { q: workers + ' workers produce ' + out + ' units a week. Find labour productivity (units per worker per week).', answer: out / workers, sf: 3,
          steps: ['Productivity = output ÷ workers.', '= ' + out + ' ÷ ' + workers + '.', '= ' + N(out / workers, 3) + ' units per worker per week.'] };
      } },
      { id: 'defect', name: 'Defect rate', gen: function (r) {
        var tot = r.int(500, 20000), bad = r.int(1, Math.floor(tot / 20));
        return { q: bad + ' of ' + tot + ' units fail quality control. Find the defect rate.', answer: bad / tot * 100, sf: 3,
          steps: ['Defect rate = defective ÷ total × 100.', '= ' + bad + ' ÷ ' + tot + ' × 100.', '= ' + N(bad / tot * 100, 3) + '%.'] };
      } },
    ] });

  add({ id: 'bm-marketing', units: [BM('4.1'), BM('4.3'), BM('4.4')], title: 'Market share, growth and sales forecasting',
    method: ['Market share = the firm’s sales ÷ total market sales × 100.', 'Market growth = (new market size − old) ÷ old × 100.', 'Sales forecasting (HL): a three-period moving average is the mean of three consecutive values, plotted at the middle one.'],
    variants: [
      { id: 'share', name: 'Market share', gen: function (r) {
        var mkt = r.int(100, 5000) * 1000, firm = Math.round(mkt * r.int(2, 45) / 100);
        return { q: 'A firm sells $' + firm + ' in a market worth $' + mkt + '. Find its market share.', answer: firm / mkt * 100, sf: 3,
          steps: ['Market share = firm sales ÷ market sales × 100.', '= ' + firm + ' ÷ ' + mkt + ' × 100.', '= ' + N(firm / mkt * 100, 3) + '%.'] };
      } },
      { id: 'growth', name: 'Market growth', gen: function (r) {
        var m1 = r.int(100, 5000), m2 = Math.round(m1 * (1 + r.nz(-20, 30) / 100));
        if (m2 === m1) return null;
        return { q: 'A market changes from $' + m1 + ' m to $' + m2 + ' m. Find the market growth rate.', answer: (m2 - m1) / m1 * 100, sf: 3,
          steps: ['Growth = (new − old) ÷ old × 100.', '= (' + m2 + ' − ' + m1 + ') ÷ ' + m1 + ' × 100.', '= ' + N((m2 - m1) / m1 * 100, 3) + '%.'] };
      } },
      { id: 'ma', name: 'Three-period moving average', gen: function (r) {
        var d = [r.int(20, 90), r.int(20, 90), r.int(20, 90), r.int(20, 90), r.int(20, 90)], k = r.int(1, 3), avg = (d[k - 1] + d[k] + d[k + 1]) / 3;
        return { q: 'Quarterly sales: ' + d.join(', ') + '. Find the three-period moving average centred on quarter ' + (k + 1) + '.', answer: avg, sf: 3,
          steps: ['Quarters ' + k + ' to ' + (k + 2) + ': ' + d[k - 1] + ', ' + d[k] + ', ' + d[k + 1] + '.', 'Total ' + (d[k - 1] + d[k] + d[k + 1]) + ', divided by 3.', '= ' + N(avg, 3) + '.'] };
      } },
    ] });

  /* ════════════════════════ COMPUTER SCIENCE ════════════════════════ */

  function bin(n, w) { var s = n.toString(2); while (s.length < (w || 8)) s = '0' + s; return s; }
  add({ id: 'cs-numbers', units: [CS('A1')], title: 'Binary, hexadecimal and two’s complement',
    method: ['Binary place values, right to left: 1, 2, 4, 8, 16, 32, 64, 128.', 'Denary → binary: take off the largest place value that fits, mark a 1 there, repeat; 0 elsewhere.', 'Hex digits are 0–9 then A–F (10–15); each hex digit is exactly 4 bits.', 'Two’s complement (8 bits): for −n, write n in binary, flip every bit, add 1. The left bit is worth −128.'],
    variants: [
      { id: 'd2b', name: 'Denary to binary', gen: function (r) {
        var n = r.int(1, 255), parts = [];
        [128, 64, 32, 16, 8, 4, 2, 1].forEach(function (pv) { if (n & pv) parts.push(pv); });
        return { q: 'Convert ' + n + ' to 8-bit binary.', answer: bin(n), placeholder: 'e.g. 01011010',
          steps: ['Place values: 128 64 32 16 8 4 2 1.', n + ' = ' + parts.join(' + ') + '.', 'A 1 under each of those, 0 elsewhere: ' + bin(n) + '.'] };
      } },
      { id: 'b2d', name: 'Binary to denary', gen: function (r) {
        var n = r.int(1, 255), s = bin(n), parts = [];
        s.split('').forEach(function (bit, i) { if (bit === '1') parts.push(128 >> i); });
        return { q: 'Convert the binary number ' + s + ' to denary.', answer: n,
          steps: ['Write 128 64 32 16 8 4 2 1 above the bits.', 'Add the place values with a 1: ' + parts.join(' + ') + '.', '= ' + n + '.'] };
      } },
      { id: 'hex', name: 'Hexadecimal to denary', gen: function (r) {
        var n = r.int(16, 255), h = n.toString(16).toUpperCase();
        return { q: 'Convert the hexadecimal number ' + h + ' to denary.', answer: n,
          steps: ['Place values 16 and 1: ' + h[0] + ' = ' + parseInt(h[0], 16) + ', ' + h[1] + ' = ' + parseInt(h[1], 16) + '.', parseInt(h[0], 16) + ' × 16 + ' + parseInt(h[1], 16) + '.', '= ' + n + '.'] };
      } },
      { id: 'b2h', name: 'Binary to hexadecimal', gen: function (r) {
        var n = r.int(16, 255), s = bin(n), h = n.toString(16).toUpperCase();
        return { q: 'Convert ' + s + ' to hexadecimal.', answer: h, placeholder: 'e.g. 3F',
          steps: ['Split into 4-bit nibbles: ' + s.slice(0, 4) + ' ' + s.slice(4) + '.', s.slice(0, 4) + ' = ' + parseInt(s.slice(0, 4), 2) + ' → ' + h[0] + '; ' + s.slice(4) + ' = ' + parseInt(s.slice(4), 2) + ' → ' + h[1] + '.', h + '.'] };
      } },
      { id: 'twos', name: 'Two’s complement', gen: function (r) {
        var n = r.int(1, 127), flip = bin(n).split('').map(function (x) { return x === '1' ? '0' : '1'; }).join('');
        return { q: 'Write −' + n + ' as an 8-bit two’s complement number.', answer: bin(256 - n), placeholder: 'e.g. 11010110',
          steps: ['+' + n + ' = ' + bin(n) + '.', 'Flip every bit: ' + flip + '.', 'Add 1: ' + bin(256 - n) + '.'] };
      } },
      { id: 'add', name: 'Binary addition and overflow', gen: function (r) {
        var a = r.int(1, 255), c = r.int(1, 255), sum = a + c, over = 'Overflow: the result needs 9 bits';
        var ans = sum > 255 ? over : bin(sum);
        return Object.assign(T.choice(ans, [bin(sum & 255), bin((sum + 1) & 255), over, bin(a ^ c)].filter(function (x) { return x !== ans; }), r), {
          q: 'Add the 8-bit numbers ' + bin(a) + ' and ' + bin(c) + '. What is the result?',
          steps: ['Add from the right, carrying 1 when a column totals 2 (10) or 3 (11).', 'Check in denary: ' + a + ' + ' + c + ' = ' + sum + '.', sum > 255 ? sum + ' > 255, the largest 8-bit value: overflow.' : 'Result: ' + bin(sum) + '.'] });
      } },
    ] });

  var GATES = { AND: function (a, c) { return a & c; }, OR: function (a, c) { return a | c; }, XOR: function (a, c) { return a ^ c; }, NAND: function (a, c) { return 1 - (a & c); }, NOR: function (a, c) { return 1 - (a | c); } };
  var GATE_RULE = { AND: 'both inputs must be 1', OR: 'at least one input must be 1', XOR: 'the inputs must differ', NAND: 'the opposite of AND', NOR: 'the opposite of OR' };
  add({ id: 'cs-logic', units: [CS('A1')], title: 'Logic gates and Boolean expressions',
    method: ['AND is 1 only if both inputs are 1; OR if either is; XOR if they differ; NOT flips.', 'NAND = NOT AND; NOR = NOT OR.', 'Work inside brackets first, then NOT, then AND, then OR — or go through the circuit gate by gate.'],
    variants: [
      { id: 'gate', name: 'One gate', gen: function (r) {
        var g2 = r.pick(Object.keys(GATES)), a = r.int(0, 1), c = r.int(0, 1), v = GATES[g2](a, c);
        return { q: 'A = ' + a + ', B = ' + c + '. What is A ' + g2 + ' B?', answer: String(v), placeholder: '0 or 1',
          steps: [g2 + ': ' + GATE_RULE[g2] + '.', 'A = ' + a + ', B = ' + c + '.', 'Output: ' + v + '.'] };
      } },
      { id: 'expr', name: 'An expression', gen: function (r) {
        var a = r.int(0, 1), c = r.int(0, 1), d = r.int(0, 1), g1 = r.pick(['AND', 'OR', 'XOR']), g2 = r.pick(['AND', 'OR']), neg = r.next() < 0.5;
        var inner = GATES[g1](a, c), left = neg ? 1 - inner : inner, v = GATES[g2](left, d);
        return { q: 'A = ' + a + ', B = ' + c + ', C = ' + d + '. Evaluate ' + (neg ? 'NOT (A ' + g1 + ' B)' : '(A ' + g1 + ' B)') + ' ' + g2 + ' C.', answer: String(v), placeholder: '0 or 1',
          steps: ['Brackets first: A ' + g1 + ' B = ' + inner + '.', neg ? 'NOT gives ' + left + '.' : 'No NOT: it stays ' + left + '.', left + ' ' + g2 + ' ' + d + ' = ' + v + '.'] };
      } },
      { id: 'rows', name: 'Rows of a truth table', gen: function (r) {
        var g1 = r.pick(Object.keys(GATES)), outs = [[0, 0], [0, 1], [1, 0], [1, 1]].map(function (p) { return GATES[g1](p[0], p[1]); }), count = outs.reduce(function (s, x) { return s + x; }, 0);
        return { q: 'In the truth table for A ' + g1 + ' B, how many of the four rows output 1?', answer: count,
          steps: ['Inputs: 00, 01, 10, 11.', 'Outputs: ' + outs.join(', ') + '.', count + ' row' + (count === 1 ? '' : 's') + ' output 1.'] };
      } },
    ] });

  add({ id: 'cs-data', units: [CS('A1'), CS('A2')], title: 'Data sizes, transmission and addressing',
    method: ['1 byte = 8 bits; 1 kB = 1000 bytes (1 KiB = 1024); 1 MB = 10^{6} bytes.', 'Image (bits) = width × height × colour depth.', 'Sound (bits) = sample rate × bit depth × seconds × channels.', 'Transmission time = size in bits ÷ bandwidth in bits per second. A subnet with h host bits has 2^{h} − 2 usable addresses.'],
    variants: [
      { id: 'image', name: 'Image file size', gen: function (r) {
        var w = r.int(4, 40) * 100, h = r.int(3, 30) * 100, depth = r.pick([1, 8, 16, 24, 32]), bytes = w * h * depth / 8;
        return { q: 'An uncompressed image is ' + w + ' × ' + h + ' pixels with a colour depth of ' + depth + ' bit' + (depth > 1 ? 's' : '') + '. Find its size in MB (1 MB = 10^{6} bytes).', answer: bytes / 1e6, sf: 3,
          steps: ['Bits = ' + w + ' × ' + h + ' × ' + depth + ' = ' + w * h * depth + '.', 'Bytes = ÷ 8 = ' + bytes + '.', 'MB = ÷ 10^{6} = ' + N(bytes / 1e6, 3) + ' MB.'] };
      } },
      { id: 'sound', name: 'Sound file size', gen: function (r) {
        var rate = r.pick([22050, 44100, 48000]), depth = r.pick([8, 16, 24]), secs = r.int(5, 240), ch = r.pick([1, 2]), bytes = rate * depth * secs * ch / 8;
        return { q: 'A ' + secs + ' s ' + (ch === 2 ? 'stereo' : 'mono') + ' recording uses ' + rate + ' Hz sampling and ' + depth + '-bit samples. Find its size in MB (10^{6} bytes).', answer: bytes / 1e6, sf: 3,
          steps: ['Bits = ' + rate + ' × ' + depth + ' × ' + secs + ' × ' + ch + ' = ' + rate * depth * secs * ch + '.', 'Bytes = ÷ 8 = ' + bytes + '.', '= ' + N(bytes / 1e6, 3) + ' MB.'] };
      } },
      { id: 'transfer', name: 'Transmission time', gen: function (r) {
        var mb = r.int(1, 2000), mbps = r.pick([2, 10, 50, 100, 300, 1000]);
        return { q: 'How long does a ' + mb + ' MB file take to send at ' + mbps + ' Mbit/s?', answer: mb * 8 / mbps, sf: 3,
          steps: ['Size in bits: ' + mb + ' × 8 = ' + mb * 8 + ' Mbit.', 'Time = size ÷ bandwidth = ' + mb * 8 + ' ÷ ' + mbps + '.', '= ' + N(mb * 8 / mbps, 3) + ' s.'] };
      } },
      { id: 'hosts', name: 'Usable hosts in a subnet', gen: function (r) {
        var bits = r.int(2, 12);
        return { q: 'A subnet leaves ' + bits + ' bits for host addresses. How many usable host addresses does it have?', answer: Math.pow(2, bits) - 2,
          steps: [bits + ' bits give 2^{' + bits + '} = ' + Math.pow(2, bits) + ' addresses.', 'Two are reserved: the network address and the broadcast address.', Math.pow(2, bits) + ' − 2 = ' + (Math.pow(2, bits) - 2) + '.'] };
      } },
      { id: 'colours', name: 'Colours from colour depth', gen: function (r) {
        var d = r.int(1, 24);
        return { q: 'How many different colours can a colour depth of ' + d + ' bit' + (d > 1 ? 's' : '') + ' represent?', answer: Math.pow(2, d),
          steps: ['Each extra bit doubles the number of patterns.', d + ' bits give 2^{' + d + '}.', '= ' + Math.pow(2, d) + ' colours.'] };
      } },
    ] });

  var NAMES = ['Ana', 'Ben', 'Chen', 'Dev', 'Ema', 'Finn', 'Gia', 'Hugo', 'Ines', 'Jay'];
  add({ id: 'cs-db', units: [CS('A3')], title: 'Databases and SQL queries',
    method: ['SELECT columns FROM table WHERE condition returns the rows that meet the condition.', 'AND needs both conditions true; OR needs at least one. Comparisons: =, <>, <, >, <=, >=.', 'A primary key uniquely identifies each row; a foreign key holds another table’s primary key to link the two.'],
    variants: [
      { id: 'count', name: 'How many rows does it return?', gen: function (r) {
        var rows = r.sample(NAMES, 7).map(function (n) { return { name: n, year: r.int(10, 13), score: r.int(40, 100) }; }), yr = r.int(10, 13), sc = r.int(50, 90), op = r.pick(['AND', 'OR']);
        var hits = rows.filter(function (x) { return op === 'AND' ? x.year === yr && x.score > sc : x.year === yr || x.score > sc; });
        return { q: 'Table Students:\n' + rows.map(function (x) { return x.name + ' | year ' + x.year + ' | score ' + x.score; }).join('\n') + '\nHow many rows does SELECT * FROM Students WHERE year = ' + yr + ' ' + op + ' score > ' + sc + ' return?', answer: hits.length,
          steps: ['Test each row against year = ' + yr + ' ' + op + ' score > ' + sc + '.', op === 'AND' ? 'AND: both must be true.' : 'OR: either may be true.', 'Matching: ' + (hits.map(function (x) { return x.name; }).join(', ') || 'none') + ' → ' + hits.length + ' row' + (hits.length === 1 ? '' : 's') + '.'] };
      } },
      { id: 'key', name: 'Keys', gen: function (r) {
        var p = r.pick([['Which field should be the primary key of a Students table?', 'StudentID', ['Surname', 'DateOfBirth', 'FormGroup']], ['In an Orders table, CustomerID links each order to the Customers table. What is CustomerID in Orders?', 'A foreign key', ['The primary key', 'A composite key', 'A calculated field']], ['Why is a surname a poor primary key?', 'It is not guaranteed to be unique', ['It is too long', 'It contains letters', 'It makes the table larger']]]);
        return Object.assign(T.choice(p[1], p[2], r), { q: p[0],
          steps: ['A primary key must be unique for every row and never empty.', 'A foreign key matches another table’s primary key.', p[1] + '.'] });
      } },
    ] });

  add({ id: 'cs-ml', units: [CS('A4')], title: 'Machine learning: evaluation and distance',
    method: ['Accuracy = (TP + TN) ÷ total; precision = TP ÷ (TP + FP); recall = TP ÷ (TP + FN).', 'k-nearest neighbours measures Euclidean distance √((x_{1} − x_{2})^{2} + (y_{1} − y_{2})^{2}) and takes the majority class of the k nearest points.', 'Overfitting: excellent on training data, poor on unseen test data.'],
    variants: [
      { id: 'acc', name: 'Accuracy', gen: function (r) {
        var tp = r.int(10, 90), tn = r.int(10, 90), fp = r.int(1, 30), fn = r.int(1, 30), tot = tp + tn + fp + fn;
        return { q: 'A classifier gives TP = ' + tp + ', TN = ' + tn + ', FP = ' + fp + ', FN = ' + fn + '. Find its accuracy as a percentage.', answer: (tp + tn) / tot * 100, sf: 3,
          steps: ['Accuracy = correct ÷ total.', '= (' + tp + ' + ' + tn + ') ÷ ' + tot + '.', '= ' + N((tp + tn) / tot * 100, 3) + '%.'] };
      } },
      { id: 'prec', name: 'Precision and recall', gen: function (r) {
        var tp = r.int(10, 90), fp = r.int(1, 30), fn = r.int(1, 30), askP = r.next() < 0.5, v = askP ? tp / (tp + fp) : tp / (tp + fn);
        return { q: 'TP = ' + tp + ', FP = ' + fp + ', FN = ' + fn + '. Find the ' + (askP ? 'precision' : 'recall') + ' as a decimal.', answer: v, sf: 3,
          steps: [askP ? 'Precision = TP ÷ (TP + FP): of the predicted positives, how many were right.' : 'Recall = TP ÷ (TP + FN): of the real positives, how many were found.', '= ' + tp + ' ÷ ' + (askP ? tp + fp : tp + fn) + '.', '= ' + N(v, 3) + '.'] };
      } },
      { id: 'dist', name: 'Euclidean distance', gen: function (r) {
        var a = [r.int(0, 10), r.int(0, 10)], c = [r.int(0, 10), r.int(0, 10)], s2 = Math.pow(a[0] - c[0], 2) + Math.pow(a[1] - c[1], 2);
        if (!s2) return null;
        return { q: 'Find the Euclidean distance between (' + a.join(', ') + ') and (' + c.join(', ') + ').', answer: Math.sqrt(s2), sf: 3,
          steps: ['Differences: ' + (a[0] - c[0]) + ' and ' + (a[1] - c[1]) + '.', 'Square and add: ' + s2 + '.', 'Square root: ' + N(Math.sqrt(s2), 3) + '.'] };
      } },
    ] });

  add({ id: 'cs-algo', units: [CS('B1'), CS('B2')], title: 'Tracing algorithms',
    method: ['Trace table: one column per variable, one row per step; change only what the line changes.', 'Linear search checks items in turn. Binary search halves a sorted list each step: at most ⌈log_{2}(n + 1)⌉ comparisons.', 'Bubble sort swaps out-of-order neighbours; after each pass the largest remaining item is in place.'],
    variants: [
      { id: 'loop', name: 'Trace a loop', gen: function (r) {
        var a = r.int(1, 5), b2 = r.int(6, 15), step = r.int(1, 3), total = 0, vals = [], runs = [];
        for (var i = a; i <= b2; i += step) { total += i; vals.push(i); runs.push(total); }
        return { q: 'total = 0\nloop I from ' + a + ' to ' + b2 + ' step ' + step + '\n    total = total + I\nend loop\noutput total\nWhat is output?', answer: total,
          steps: ['I takes the values ' + vals.join(', ') + '.', 'total after each: ' + runs.join(', ') + '.', 'Output: ' + total + '.'] };
      } },
      { id: 'binsearch', name: 'Binary search comparisons', gen: function (r) {
        var n = r.pick([7, 15, 31, 63, 100, 1000, 1024]), k = Math.ceil(Math.log2(n + 1));
        return { q: 'At most how many comparisons does a binary search need on a sorted list of ' + n + ' items?', answer: k,
          steps: ['Each comparison halves what is left.', 'Find the smallest k with 2^{k} ≥ ' + (n + 1) + '.', 'k = ' + k + '.'] };
      } },
      { id: 'bubble', name: 'Bubble sort: one pass', gen: function (r) {
        var arr = r.sample([3, 7, 1, 9, 4, 6, 2, 8, 5], 6), a2 = arr.slice();
        for (var i = 0; i < a2.length - 1; i++) if (a2[i] > a2[i + 1]) { var t = a2[i]; a2[i] = a2[i + 1]; a2[i + 1] = t; }
        return { q: 'Show [' + arr.join(', ') + '] after one pass of bubble sort (ascending), numbers separated by commas.', answer: a2.join(', '), accept: [a2.join(','), a2.join(' ')], placeholder: 'e.g. 1, 3, 4, …',
          steps: ['Compare each neighbouring pair from the left; swap if the left one is bigger.', 'The largest value moves to the end.', a2.join(', ') + '.'] };
      } },
      { id: 'linear', name: 'Linear search comparisons', gen: function (r) {
        var arr = r.sample([12, 5, 33, 8, 21, 47, 16, 3, 29, 40], 8), t = r.pick(arr), k = arr.indexOf(t) + 1;
        return { q: 'A linear search looks for ' + t + ' in [' + arr.join(', ') + ']. How many comparisons does it make?', answer: k,
          steps: ['It checks from the start, one item at a time.', t + ' is item ' + k + '.', k + ' comparison' + (k === 1 ? '' : 's') + '.'] };
      } },
      { id: 'bigo', name: 'Big O', gen: function (r) {
        var p = r.pick([['a linear search', 'O(n)'], ['a binary search', 'O(log n)'], ['bubble sort (worst case)', 'O(n²)'], ['reading an array element by its index', 'O(1)'], ['two nested loops over the same n items', 'O(n²)'], ['merge sort', 'O(n log n)']]);
        return Object.assign(T.choice(p[1], ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n²)'].filter(function (x) { return x !== p[1]; }), r), { q: 'What is the time complexity of ' + p[0] + '?',
          steps: ['How does the number of steps grow as n grows?', 'Halving each time → log n; one pass → n; a pass inside a pass → n².', p[1] + '.'] });
      } },
    ] });

  add({ id: 'cs-adt', units: [CS('B4'), CS('B3')], title: 'Stacks, queues and object-oriented programming',
    method: ['Stack: last in, first out (push on top, pop from the top).', 'Queue: first in, first out (enqueue at the back, dequeue from the front).', 'OOP: a class is a template, an object an instance of it. Inheritance reuses a parent class; encapsulation hides data behind methods; polymorphism lets one call behave differently per class.'],
    variants: [
      { id: 'stack', name: 'Stack operations', gen: function (r) {
        var st = [], ops = [];
        for (var i = 0; i < 6; i++) { if (st.length && r.next() < 0.35) { st.pop(); ops.push('pop'); } else { var v = r.int(1, 9); st.push(v); ops.push('push(' + v + ')'); } }
        if (!st.length) return null;
        return { q: 'Starting empty, a stack does: ' + ops.join(', ') + '. What is on top?', answer: st[st.length - 1],
          steps: ['Last in, first out: pop removes the most recent push.', 'Bottom → top: ' + st.join(', ') + '.', 'Top: ' + st[st.length - 1] + '.'] };
      } },
      { id: 'queue', name: 'Queue operations', gen: function (r) {
        var q = [], ops = [];
        for (var i = 0; i < 6; i++) { if (q.length && r.next() < 0.35) { q.shift(); ops.push('dequeue'); } else { var v = r.int(1, 9); q.push(v); ops.push('enqueue(' + v + ')'); } }
        if (!q.length) return null;
        return { q: 'Starting empty, a queue does: ' + ops.join(', ') + '. What is at the front?', answer: q[0],
          steps: ['First in, first out: dequeue removes the oldest.', 'Front → back: ' + q.join(', ') + '.', 'Front: ' + q[0] + '.'] };
      } },
      { id: 'oop', name: 'OOP principles', gen: function (r) {
        var p = r.pick([['Car is written once; myCar and yourCar are made from it. What are myCar and yourCar?', 'Objects (instances of the class)', ['Classes', 'Methods', 'Attributes']], ['ElectricCar reuses everything in Car and adds batteryLevel. Which principle is this?', 'Inheritance', ['Encapsulation', 'Polymorphism', 'Abstraction']], ['An Account class keeps balance private and offers deposit() and withdraw(). Which principle is this?', 'Encapsulation', ['Inheritance', 'Polymorphism', 'Overloading']], ['Shape has area(); Circle and Square each give their own version. Which principle is this?', 'Polymorphism', ['Encapsulation', 'Inheritance alone', 'Instantiation']]]);
        return Object.assign(T.choice(p[1], p[2], r), { q: p[0],
          steps: ['Class = blueprint; object = one thing made from it.', 'Inheritance reuses a parent; encapsulation hides data behind methods; polymorphism gives one call different behaviour per class.', p[1] + '.'] });
      } },
    ] });

  /* ════════════════════════ GEOGRAPHY ════════════════════════ */

  add({ id: 'ge-population', units: [GE('Changing population'), GE('Human development')], title: 'Population and migration calculations',
    method: ['Natural increase (%) = (CBR − CDR) ÷ 10.', 'Net migration rate per 1000 = (immigrants − emigrants) ÷ population × 1000.', 'Dependency ratio = (aged 0–14 + 65 and over) ÷ (aged 15–64) × 100.', 'Population density = population ÷ area.'],
    variants: [
      { id: 'nir', name: 'Natural increase', gen: function (r) {
        var cbr = r.int(8, 45), cdr = r.int(4, 20);
        return { q: 'CBR is ' + cbr + ' and CDR ' + cdr + ' per 1000. Find the rate of natural increase as a percentage.', answer: (cbr - cdr) / 10,
          steps: ['NIR = (CBR − CDR) ÷ 10.', '= (' + cbr + ' − ' + cdr + ') ÷ 10.', '= ' + m(S((cbr - cdr) / 10)) + '%.'] };
      } },
      { id: 'migration', name: 'Net migration rate', gen: function (r) {
        var pop = r.int(1, 90) * 100000, im = r.int(1000, 90000), em = r.int(1000, 90000);
        return { q: 'A region of ' + pop + ' people has ' + im + ' immigrants and ' + em + ' emigrants in a year. Find the net migration rate per 1000.', answer: (im - em) / pop * 1000, sf: 3,
          steps: ['Net migration = ' + im + ' − ' + em + ' = ' + m(im - em) + '.', 'Rate = net ÷ population × 1000.', '= ' + N((im - em) / pop * 1000, 3) + ' per 1000.'] };
      } },
      { id: 'dep', name: 'Dependency ratio', gen: function (r) {
        var y = r.int(10, 45), o = r.int(3, 25), w = 100 - y - o;
        return { q: y + '% of a population are aged 0–14 and ' + o + '% are 65 or over. Find the dependency ratio.', answer: (y + o) / w * 100, sf: 3,
          steps: ['Working age = 100 − ' + y + ' − ' + o + ' = ' + w + '%.', 'Dependency ratio = (' + y + ' + ' + o + ') ÷ ' + w + ' × 100.', '= ' + N((y + o) / w * 100, 3) + '.'] };
      } },
      { id: 'density', name: 'Population density', gen: function (r) {
        var pop = r.int(1, 900) * 10000, area = r.int(10, 9000);
        return { q: 'A district of ' + area + ' km^{2} has ' + pop + ' people. Find its population density (people per km^{2}).', answer: pop / area, sf: 3,
          steps: ['Density = population ÷ area.', '= ' + pop + ' ÷ ' + area + '.', '= ' + N(pop / area, 3) + ' people per km^{2}.'] };
      } },
    ] });

  add({ id: 'ge-physical', units: [GE('A'), GE('D'), GE('B'), GE('Global climate')], title: 'Rivers, hazards and climate data',
    method: ['River discharge = cross-sectional area × velocity (m^{3} s^{−1}); area ≈ width × mean depth.', 'Lag time = time of peak discharge − time of peak rainfall.', 'Earthquake magnitude: each whole step = 10 × the ground shaking and about 32 × the energy.', 'Percentage change = (new − old) ÷ old × 100.'],
    variants: [
      { id: 'discharge', name: 'River discharge', gen: function (r) {
        var w = r.int(2, 40), d = r.int(2, 30) / 10, v = r.int(1, 30) / 10;
        return { q: 'A river is ' + w + ' m wide with a mean depth of ' + d + ' m and a velocity of ' + v + ' m s^{−1}. Find its discharge.', answer: w * d * v, sf: 3,
          steps: ['Cross-sectional area = ' + w + ' × ' + d + ' = ' + S(w * d, 2) + ' m^{2}.', 'Discharge = area × velocity.', '= ' + S(w * d, 2) + ' × ' + v + ' = ' + N(w * d * v, 3) + ' m^{3} s^{−1}.'] };
      } },
      { id: 'lag', name: 'Lag time', gen: function (r) {
        var rain = r.int(0, 20), lag = r.int(2, 30);
        return { q: 'Peak rainfall is at ' + String(rain).padStart(2, '0') + ':00 and peak discharge at ' + String((rain + lag) % 24).padStart(2, '0') + ':00' + (rain + lag >= 24 ? ' the next day' : '') + '. Find the lag time in hours.', answer: lag,
          steps: ['Lag time = peak discharge − peak rainfall.', rain + lag >= 24 ? 'Count across midnight: ' + (rain + lag) + ' − ' + rain + '.' : (rain + lag) + ' − ' + rain + '.', '= ' + lag + ' hours.'] };
      } },
      { id: 'quake', name: 'Earthquake magnitude', gen: function (r) {
        var m1 = r.int(3, 7), dm = r.int(1, 3), askE = r.next() < 0.5;
        return { q: 'How many times ' + (askE ? 'more energy does a magnitude ' + (m1 + dm) + ' earthquake release than' : 'greater is the ground shaking of a magnitude ' + (m1 + dm) + ' earthquake than that of') + ' a magnitude ' + m1 + '?', answer: askE ? Math.pow(31.6, dm) : Math.pow(10, dm), sf: askE ? 2 : 3,
          steps: ['The difference is ' + dm + ' whole step' + (dm > 1 ? 's' : '') + '.', askE ? 'Each step is about 31.6 times the energy (10^{1.5}).' : 'Each step is 10 times the amplitude.', (askE ? '31.6' : '10') + '^{' + dm + '} ≈ ' + N(askE ? Math.pow(31.6, dm) : Math.pow(10, dm), askE ? 2 : 3) + ' times.'] };
      } },
      { id: 'pct', name: 'Percentage change in a record', gen: function (r) {
        var a = r.int(200, 2000), c = Math.round(a * (1 + r.nz(-40, 40) / 100));
        if (c === a) return null;
        return { q: 'Annual rainfall changes from ' + a + ' mm to ' + c + ' mm. Find the percentage change.', answer: (c - a) / a * 100, sf: 3,
          steps: ['% change = (new − old) ÷ old × 100.', '= (' + c + ' − ' + a + ') ÷ ' + a + ' × 100.', '= ' + N((c - a) / a * 100, 3) + '%.'] };
      } },
    ] });

  add({ id: 'ge-fieldwork', units: [GE('IA'), GE('Global resource')], title: 'Fieldwork statistics',
    method: ['Mean = total ÷ number of values; range = highest − lowest.', 'Spearman’s rank: rank both variables, find d for each pair, then r_{s} = 1 − 6Σd^{2}/(n(n^{2} − 1)).', 'r_{s} near +1: strong positive; near −1: strong negative; near 0: none. Check it against the critical value for n before claiming a relationship.'],
    variants: [
      { id: 'spearman', name: 'Spearman’s rank', gen: function (r) {
        var n = 7, xs = r.sample([110, 140, 180, 230, 260, 310, 350, 400, 450], n), ys = r.sample([12, 18, 22, 25, 31, 36, 40, 44, 50], n);
        var rank = function (a) { var so = a.slice().sort(function (p, q) { return q - p; }); return a.map(function (v) { return so.indexOf(v) + 1; }); };
        var rx = rank(xs), ry = rank(ys), d2 = rx.reduce(function (s, v, i) { return s + (v - ry[i]) * (v - ry[i]); }, 0), rs = 1 - 6 * d2 / (n * (n * n - 1));
        return { q: 'Distance downstream (m): ' + xs.join(', ') + '\nChannel width (cm): ' + ys.join(', ') + '\nCalculate Spearman’s rank correlation coefficient.', answer: rs, sf: 3,
          steps: ['Rank each (1 = highest): distance ' + rx.join(', ') + '; width ' + ry.join(', ') + '.', 'Σd^{2} = ' + d2 + '.', 'r_{s} = 1 − 6 × ' + d2 + ' ÷ (' + n + ' × ' + (n * n - 1) + ') = ' + N(rs, 3) + '.'] };
      } },
      { id: 'mean', name: 'Mean and range', gen: function (r) {
        var a = Array.from({ length: r.int(5, 9) }, function () { return r.int(5, 90); }), askR = r.next() < 0.5, s = a.reduce(function (p, x) { return p + x; }, 0), hi = Math.max.apply(null, a), lo = Math.min.apply(null, a);
        return { q: 'Pedestrian counts: ' + a.join(', ') + '. Find the ' + (askR ? 'range.' : 'mean.'), answer: askR ? hi - lo : s / a.length, sf: 3,
          steps: [askR ? 'Highest ' + hi + ', lowest ' + lo + '.' : 'Total = ' + s + '.', askR ? 'Range = highest − lowest.' : 'Divide by ' + a.length + '.', askR ? '= ' + (hi - lo) + '.' : '= ' + N(s / a.length, 3) + '.'] };
      } },
    ] });

  /* ════════════════════════ PSYCHOLOGY: research methods ════════════════════════ */

  var STUDIES = [
    ['Participants learn a word list either in silence or with music playing, then recall it.', 'Whether music is played', 'Number of words recalled'],
    ['Students sleep either 4 or 8 hours before a reaction-time test.', 'Hours of sleep', 'Reaction time'],
    ['Participants watch a car crash and are asked how fast the cars were going when they “smashed” or “hit” each other.', 'The verb used in the question', 'Estimated speed'],
    ['Participants are told a puzzle is either easy or hard, then the time they persist is recorded.', 'What they are told about the puzzle', 'Time spent persisting'],
    ['Rats live in enriched or plain cages, then their cortex thickness is measured.', 'Type of environment', 'Cortex thickness'],
    ['Faces are flashed for 50 ms or 500 ms and participants rate how trustworthy each looks.', 'Exposure time', 'Trustworthiness rating'],
  ];
  add({ id: 'ps-methods', units: [PS('Research methods')], title: 'Research methods: variables, samples and designs',
    method: ['IV: what the researcher changes. DV: what is measured. Controlled variables are kept the same.', 'Samples: random (equal chance for all), opportunity (whoever is available), self-selected (volunteers), snowball (participants recruit others), purposive (chosen for a trait).', 'Designs: independent samples (different people per condition), repeated measures (the same people in all), matched pairs (pairs matched on key traits).', 'Counterbalancing (half do A then B, half B then A) reduces order effects in repeated measures.'],
    variants: [
      { id: 'iv', name: 'Identify the IV', gen: function (r) {
        var s = r.pick(STUDIES);
        return Object.assign(T.choice(s[1], [s[2], 'The participants’ age', 'The researcher’s hypothesis'], r), { q: s[0] + ' What is the independent variable?',
          steps: ['The IV is what the researcher deliberately changes between conditions.', 'Ask: what is different between the groups?', 'IV: ' + s[1] + '.'] });
      } },
      { id: 'dv', name: 'Identify the DV', gen: function (r) {
        var s = r.pick(STUDIES);
        return Object.assign(T.choice(s[2], [s[1], 'The number of participants', 'The order of the conditions'], r), { q: s[0] + ' What is the dependent variable?',
          steps: ['The DV is what is measured to see the effect of the IV.', 'Ask: what is recorded at the end?', 'DV: ' + s[2] + '.'] });
      } },
      { id: 'sample', name: 'Sampling technique', gen: function (r) {
        var all = ['Random sampling', 'Opportunity sampling', 'Self-selected sampling', 'Snowball sampling', 'Purposive sampling'];
        var p = r.pick([['A computer picks 30 names from the full school list.', 'Random sampling'], ['The researcher asks whoever is in the library that afternoon.', 'Opportunity sampling'], ['An advert asks volunteers to reply by email.', 'Self-selected sampling'], ['Each participant recruits a friend who also has the condition.', 'Snowball sampling'], ['Only bilingual teachers with over 10 years’ experience are chosen.', 'Purposive sampling']]);
        return Object.assign(T.choice(p[1], all.filter(function (x) { return x !== p[1]; }), r), { q: p[0] + ' Which sampling technique is this?',
          steps: ['Ask who chose the participants, and how.', 'Equal chance → random; whoever is there → opportunity; volunteers → self-selected; through other participants → snowball; for a trait → purposive.', p[1] + '.'] });
      } },
      { id: 'design', name: 'Experimental design', gen: function (r) {
        var p = r.pick([['Every participant does the task with music and then without it.', 'Repeated measures'], ['Half the class does the task with music and the other half without.', 'Independent samples'], ['Participants are paired by IQ, and one of each pair goes into each condition.', 'Matched pairs']]);
        return Object.assign(T.choice(p[1], ['Repeated measures', 'Independent samples', 'Matched pairs', 'Correlational study'].filter(function (x) { return x !== p[1]; }), r), { q: p[0] + ' Which design is this?',
          steps: ['Same people in every condition → repeated measures.', 'Different people → independent samples; different but matched → matched pairs.', p[1] + '.'] });
      } },
      { id: 'median', name: 'Descriptive statistics', gen: function (r) {
        var a = Array.from({ length: r.int(6, 9) }, function () { return r.int(5, 30); }), so = a.slice().sort(function (p, q) { return p - q; }), n = a.length;
        var med = n % 2 ? so[(n - 1) / 2] : (so[n / 2 - 1] + so[n / 2]) / 2;
        return { q: 'Words recalled: ' + a.join(', ') + '. Find the median.', answer: med,
          steps: ['Order: ' + so.join(', ') + '.', n % 2 ? 'Odd count: the middle value.' : 'Even count: average the two middle values.', 'Median = ' + S(med) + '.'] };
      } },
    ] });

  T.register(skills);
})();
