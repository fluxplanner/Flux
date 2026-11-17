/* The formula sheets, by subject (Physics, Chemistry, Maths …): one copy for
   the planner's Study tools (flux-toolbox.js reads window.FLUX_FORMULA_DATA)
   and the standalone Flux Formulae page. Moved out of flux-toolbox.js so a
   page without the planner can load the data alone. */
window.FLUX_FORMULA_DATA = {
  Physics: [
    { title:'Kinematics', items:[
      { f:'v = u + at',                 vars:['v = final velocity','u = initial velocity','a = acceleration','t = time'] },
      { f:'s = ut + ½at²',               vars:['s = displacement'] },
      { f:'v² = u² + 2as',               vars:['uniformly accelerated motion'] },
      { f:'s = ½(u + v)t',               vars:['average velocity form'] },
    ]},
    { title:'Dynamics', items:[
      { f:'F = ma',                      vars:['F = net force','m = mass','a = acceleration'] },
      { f:'p = mv',                      vars:['p = momentum'] },
      { f:'F = Δp / Δt',                  vars:['impulse form of N2L'] },
      { f:'Fᶠ ≤ μ·N',                    vars:['friction force · μ: coeff of friction · N: normal force'] },
    ]},
    { title:'Energy & Work', items:[
      { f:'W = F·d·cos θ',               vars:['W = work done'] },
      { f:'KE = ½mv²',                   vars:['kinetic energy'] },
      { f:'PE = mgh',                    vars:['gravitational PE'] },
      { f:'P = W/t = F·v',               vars:['power'] },
      { f:'E = mc²',                     vars:['mass–energy equivalence (c ≈ 3 × 10⁸ m/s)'] },
    ]},
    { title:'Circular & Gravitation', items:[
      { f:'a_c = v²/r',                  vars:['centripetal acceleration'] },
      { f:'F_c = mv²/r',                 vars:['centripetal force'] },
      { f:'F = G·m₁m₂/r²',               vars:['Newton\'s law of gravitation (G = 6.674 × 10⁻¹¹)'] },
      { f:'T² = (4π²/GM) · r³',          vars:['Kepler\'s 3rd law'] },
    ]},
    { title:'Waves & Sound', items:[
      { f:'v = fλ',                      vars:['wave speed = frequency × wavelength'] },
      { f:'f\' = f · (v ± v_o)/(v ∓ v_s)', vars:['Doppler effect'] },
      { f:'β = 10·log₁₀(I/I₀)',          vars:['sound intensity level (dB), I₀ = 10⁻¹² W/m²'] },
    ]},
    { title:'Electricity & Magnetism', items:[
      { f:'V = IR',                      vars:['Ohm\'s law'] },
      { f:'P = IV = I²R = V²/R',         vars:['electrical power'] },
      { f:'F = qE',                      vars:['electric force on a charge'] },
      { f:'F = qv × B',                  vars:['magnetic force on a moving charge'] },
      { f:'E = kq/r²',                   vars:['field of a point charge (k ≈ 8.99 × 10⁹)'] },
      { f:'C = Q/V',                     vars:['capacitance'] },
    ]},
    { title:'Thermodynamics', items:[
      { f:'Q = mcΔT',                    vars:['heat required to change temperature'] },
      { f:'Q = mL',                      vars:['heat for phase change; L = latent heat'] },
      { f:'ΔU = Q − W',                  vars:['1st law of thermodynamics'] },
      { f:'PV = nRT',                    vars:['ideal gas law (R = 8.314 J/mol·K)'] },
    ]},
    { title:'Constants', items:[
      { f:'c = 2.998 × 10⁸ m/s',        vars:['speed of light in vacuum'] },
      /* Resolved at render time from the student's programme — DP is marked
         against 9.8 and MYP against 10, so a sheet that states one number is
         wrong for half its readers. See fluxGravityRow().
         The previous entry read "g = 10.0000 m/s²": not only the MYP value
         shown to everyone, but carrying four decimals of precision that no
         syllabus claims. */
      { gravity:true, f:'', vars:[] },
      { f:'N_A = 6.022 × 10²³ /mol',     vars:['Avogadro\'s number'] },
      { f:'h = 6.626 × 10⁻³⁴ J·s',       vars:['Planck constant'] },
      { f:'e = 1.602 × 10⁻¹⁹ C',         vars:['elementary charge'] },
      { f:'k_B = 1.381 × 10⁻²³ J/K',     vars:['Boltzmann constant'] },
    ]},
  ],
  Chemistry: [
    { title:'Stoichiometry', items:[
      { f:'n = m / M',                   vars:['n = moles, m = mass, M = molar mass'] },
      { f:'n = V / 22.4 L',              vars:['moles of gas at STP'] },
      { f:'c = n / V',                   vars:['molarity (mol/L)'] },
      { f:'% yield = actual/theoretical × 100', vars:[] },
    ]},
    { title:'Gas Laws', items:[
      { f:'PV = nRT',                    vars:['ideal gas law (R = 0.0821 L·atm/mol·K)'] },
      { f:'P₁V₁/T₁ = P₂V₂/T₂',           vars:['combined gas law'] },
      { f:'P_total = Σ P_i',             vars:['Dalton\'s law of partial pressures'] },
    ]},
    { title:'Acids & Bases', items:[
      { f:'pH = −log[H⁺]',               vars:['pH definition'] },
      { f:'pOH = −log[OH⁻]',             vars:[] },
      { f:'pH + pOH = 14',               vars:['at 25 °C'] },
      { f:'K_w = [H⁺][OH⁻] = 10⁻¹⁴',     vars:[] },
      { f:'pH = pKa + log([A⁻]/[HA])',   vars:['Henderson–Hasselbalch'] },
    ]},
    { title:'Thermochemistry', items:[
      { f:'q = mcΔT',                    vars:['heat capacity calculation'] },
      { f:'ΔH = Σ ΔH_f(products) − Σ ΔH_f(reactants)', vars:['Hess\'s law shortcut'] },
      { f:'ΔG = ΔH − TΔS',                vars:['Gibbs free energy'] },
    ]},
    { title:'Kinetics & Equilibrium', items:[
      { f:'rate = k[A]ᵐ[B]ⁿ',             vars:['generic rate law'] },
      { f:'k = A·e^(−Eₐ/RT)',             vars:['Arrhenius equation'] },
      { f:'K = [products]/[reactants]',  vars:['equilibrium constant (powered by stoichiometry)'] },
      { f:'Q vs. K determines shift',     vars:['Q < K → forward; Q > K → reverse'] },
    ]},
    { title:'Electrochemistry', items:[
      { f:'E° = E°(cathode) − E°(anode)', vars:['cell potential'] },
      { f:'ΔG° = −nFE°',                 vars:['Gibbs from cell potential (F = 96485)'] },
      { f:'E = E° − (RT/nF) ln Q',       vars:['Nernst equation'] },
    ]},
  ],
  Biology: [
    { title:'Cell & Molecular', items:[
      { f:'S/V ratio = surface/volume',   vars:['why cells divide when too big'] },
      { f:'Water potential Ψ = Ψ_s + Ψ_p', vars:['Ψ_s: solute; Ψ_p: pressure'] },
      { f:'Q₁₀ = rate(T+10)/rate(T)',    vars:['temperature coefficient of rates'] },
    ]},
    { title:'Genetics', items:[
      { f:'p² + 2pq + q² = 1',            vars:['Hardy–Weinberg genotype freq.'] },
      { f:'p + q = 1',                    vars:['Hardy–Weinberg allele freq.'] },
      { f:'χ² = Σ (O − E)² / E',          vars:['chi-square test statistic'] },
    ]},
    { title:'Ecology', items:[
      { f:'dN/dt = rN',                  vars:['exponential growth'] },
      { f:'dN/dt = rN · (K−N)/K',        vars:['logistic growth; K = carrying capacity'] },
      { f:'λ = N_{t+1} / N_t',           vars:['finite rate of increase'] },
      { f:'Productivity transfer ≈ 10%',  vars:['energy flow between trophic levels'] },
    ]},
    { title:'Body & Homeostasis', items:[
      { f:'BMI = mass(kg) / height(m)²', vars:['Body Mass Index'] },
      { f:'MAP ≈ DP + ⅓(SP − DP)',       vars:['mean arterial pressure'] },
      { f:'Ficks: VO₂ = Q × (CaO₂ − CvO₂)', vars:['oxygen uptake (Q = cardiac output)'] },
    ]},
  ],
};
