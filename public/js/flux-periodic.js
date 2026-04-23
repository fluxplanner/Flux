/* ════════════════════════════════════════════════════════════════
   FLUX PERIODIC TABLE
   Fully interactive periodic table — all 118 elements, category
   filters, search, temperature slider for state-of-matter shading,
   detail side panel with extensive element data, keyboard nav.
   Inspired by zperiod.app, tuned to the Flux aesthetic.
   ════════════════════════════════════════════════════════════════ */

(function(){
'use strict';

// ────────────────────────────────────────────────────────────────
// DATA — all 118 elements.
// Keys: n(number), s(symbol), name, mass, cat(category), row, col
// (grid position), p(actual period), g(actual group or null),
// ec (electron configuration), mp/bp (°C; null = unknown),
// d (density g/cm³; for gases, density at 0°C/1atm), phase at STP,
// en (Pauling electronegativity; null = unknown/not measured),
// year (discovery), by (discoverer short), fact (one-line blurb).
// ────────────────────────────────────────────────────────────────
const ELEMENTS = [
  {n:1, s:'H', name:'Hydrogen', mass:1.008, cat:'nonmetal', row:1, col:1, p:1, g:1, ec:'1s¹', mp:-259.16, bp:-252.87, d:0.00008988, phase:'g', en:2.20, year:1766, by:'H. Cavendish', fact:'Most abundant element in the universe; fuel of stars.'},
  {n:2, s:'He', name:'Helium', mass:4.0026, cat:'noble', row:1, col:18, p:1, g:18, ec:'1s²', mp:-272.20, bp:-268.93, d:0.0001785, phase:'g', en:null, year:1868, by:'Janssen & Lockyer', fact:'Only element that won’t solidify under normal pressure.'},
  {n:3, s:'Li', name:'Lithium', mass:6.94, cat:'alkali', row:2, col:1, p:2, g:1, ec:'[He] 2s¹', mp:180.50, bp:1342, d:0.534, phase:'s', en:0.98, year:1817, by:'J. A. Arfwedson', fact:'Lightest metal; powers your phone and laptop.'},
  {n:4, s:'Be', name:'Beryllium', mass:9.0122, cat:'alkaline', row:2, col:2, p:2, g:2, ec:'[He] 2s²', mp:1287, bp:2469, d:1.85, phase:'s', en:1.57, year:1798, by:'L. Vauquelin', fact:'Used in X-ray windows — transparent to high-energy photons.'},
  {n:5, s:'B', name:'Boron', mass:10.81, cat:'metalloid', row:2, col:13, p:2, g:13, ec:'[He] 2s² 2p¹', mp:2076, bp:3927, d:2.34, phase:'s', en:2.04, year:1808, by:'Davy, Gay-Lussac, Thénard', fact:'Borax from dry lake beds was known to alchemists.'},
  {n:6, s:'C', name:'Carbon', mass:12.011, cat:'nonmetal', row:2, col:14, p:2, g:14, ec:'[He] 2s² 2p²', mp:3550, bp:4027, d:2.267, phase:'s', en:2.55, year:-3750, by:'Prehistoric', fact:'Backbone of all known life; forms diamond and graphite.'},
  {n:7, s:'N', name:'Nitrogen', mass:14.007, cat:'nonmetal', row:2, col:15, p:2, g:15, ec:'[He] 2s² 2p³', mp:-210.00, bp:-195.79, d:0.0012506, phase:'g', en:3.04, year:1772, by:'D. Rutherford', fact:'Makes up 78% of Earth’s atmosphere.'},
  {n:8, s:'O', name:'Oxygen', mass:15.999, cat:'nonmetal', row:2, col:16, p:2, g:16, ec:'[He] 2s² 2p⁴', mp:-218.79, bp:-182.95, d:0.001429, phase:'g', en:3.44, year:1774, by:'Priestley & Scheele', fact:'Keeps you alive; also responsible for combustion and rust.'},
  {n:9, s:'F', name:'Fluorine', mass:18.998, cat:'halogen', row:2, col:17, p:2, g:17, ec:'[He] 2s² 2p⁵', mp:-219.67, bp:-188.11, d:0.001696, phase:'g', en:3.98, year:1886, by:'H. Moissan', fact:'Most electronegative element — it reacts with almost everything.'},
  {n:10, s:'Ne', name:'Neon', mass:20.180, cat:'noble', row:2, col:18, p:2, g:18, ec:'[He] 2s² 2p⁶', mp:-248.59, bp:-246.08, d:0.0008999, phase:'g', en:null, year:1898, by:'Ramsay & Travers', fact:'Glows reddish-orange in classic "neon" signs.'},
  {n:11, s:'Na', name:'Sodium', mass:22.990, cat:'alkali', row:3, col:1, p:3, g:1, ec:'[Ne] 3s¹', mp:97.80, bp:883, d:0.971, phase:'s', en:0.93, year:1807, by:'H. Davy', fact:'Pairs with chlorine to make table salt; soft enough to cut.'},
  {n:12, s:'Mg', name:'Magnesium', mass:24.305, cat:'alkaline', row:3, col:2, p:3, g:2, ec:'[Ne] 3s²', mp:650, bp:1090, d:1.738, phase:'s', en:1.31, year:1808, by:'H. Davy', fact:'Burns with a blinding white flame — used in flares and fireworks.'},
  {n:13, s:'Al', name:'Aluminum', mass:26.982, cat:'post-transition', row:3, col:13, p:3, g:13, ec:'[Ne] 3s² 3p¹', mp:660.32, bp:2519, d:2.70, phase:'s', en:1.61, year:1825, by:'H. C. Ørsted', fact:'Most abundant metal in Earth’s crust; once more precious than gold.'},
  {n:14, s:'Si', name:'Silicon', mass:28.085, cat:'metalloid', row:3, col:14, p:3, g:14, ec:'[Ne] 3s² 3p²', mp:1414, bp:3265, d:2.3296, phase:'s', en:1.90, year:1824, by:'J. J. Berzelius', fact:'Base of every microchip; makes up glass and sand.'},
  {n:15, s:'P', name:'Phosphorus', mass:30.974, cat:'nonmetal', row:3, col:15, p:3, g:15, ec:'[Ne] 3s² 3p³', mp:44.15, bp:280.5, d:1.82, phase:'s', en:2.19, year:1669, by:'H. Brand', fact:'First element to be discovered by an individual; glows in the dark.'},
  {n:16, s:'S', name:'Sulfur', mass:32.06, cat:'nonmetal', row:3, col:16, p:3, g:16, ec:'[Ne] 3s² 3p⁴', mp:115.21, bp:444.61, d:2.067, phase:'s', en:2.58, year:-2000, by:'Prehistoric', fact:'"Brimstone" of biblical texts; used in gunpowder and vulcanized rubber.'},
  {n:17, s:'Cl', name:'Chlorine', mass:35.45, cat:'halogen', row:3, col:17, p:3, g:17, ec:'[Ne] 3s² 3p⁵', mp:-101.50, bp:-34.04, d:0.003214, phase:'g', en:3.16, year:1774, by:'C. W. Scheele', fact:'Yellow-green gas used to disinfect pool water; toxic in quantity.'},
  {n:18, s:'Ar', name:'Argon', mass:39.948, cat:'noble', row:3, col:18, p:3, g:18, ec:'[Ne] 3s² 3p⁶', mp:-189.35, bp:-185.85, d:0.0017837, phase:'g', en:null, year:1894, by:'Ramsay & Rayleigh', fact:'Fills incandescent bulbs to stop the filament from oxidizing.'},
  {n:19, s:'K', name:'Potassium', mass:39.098, cat:'alkali', row:4, col:1, p:4, g:1, ec:'[Ar] 4s¹', mp:63.38, bp:759, d:0.862, phase:'s', en:0.82, year:1807, by:'H. Davy', fact:'Reacts with water violently — dancing purple flame across the surface.'},
  {n:20, s:'Ca', name:'Calcium', mass:40.078, cat:'alkaline', row:4, col:2, p:4, g:2, ec:'[Ar] 4s²', mp:842, bp:1484, d:1.54, phase:'s', en:1.00, year:1808, by:'H. Davy', fact:'Builds bones and teeth; 5th most abundant element on Earth.'},
  {n:21, s:'Sc', name:'Scandium', mass:44.956, cat:'transition', row:4, col:3, p:4, g:3, ec:'[Ar] 3d¹ 4s²', mp:1541, bp:2836, d:2.989, phase:'s', en:1.36, year:1879, by:'L. F. Nilson', fact:'Mendeleev predicted it 10 years before its discovery.'},
  {n:22, s:'Ti', name:'Titanium', mass:47.867, cat:'transition', row:4, col:4, p:4, g:4, ec:'[Ar] 3d² 4s²', mp:1668, bp:3287, d:4.506, phase:'s', en:1.54, year:1791, by:'W. Gregor', fact:'Strong as steel, half the weight — used in aircraft and implants.'},
  {n:23, s:'V', name:'Vanadium', mass:50.942, cat:'transition', row:4, col:5, p:4, g:5, ec:'[Ar] 3d³ 4s²', mp:1910, bp:3407, d:6.11, phase:'s', en:1.63, year:1801, by:'A. M. del Río', fact:'Named after Vanadis, the Norse goddess of beauty — for its colorful compounds.'},
  {n:24, s:'Cr', name:'Chromium', mass:51.996, cat:'transition', row:4, col:6, p:4, g:6, ec:'[Ar] 3d⁵ 4s¹', mp:1907, bp:2671, d:7.15, phase:'s', en:1.66, year:1797, by:'L. N. Vauquelin', fact:'Gives emeralds their green and rubies their red.'},
  {n:25, s:'Mn', name:'Manganese', mass:54.938, cat:'transition', row:4, col:7, p:4, g:7, ec:'[Ar] 3d⁵ 4s²', mp:1246, bp:2061, d:7.21, phase:'s', en:1.55, year:1774, by:'J. G. Gahn', fact:'Essential for steel production; also a required nutrient for humans.'},
  {n:26, s:'Fe', name:'Iron', mass:55.845, cat:'transition', row:4, col:8, p:4, g:8, ec:'[Ar] 3d⁶ 4s²', mp:1538, bp:2861, d:7.874, phase:'s', en:1.83, year:-5000, by:'Prehistoric', fact:'Most common element on Earth by mass; core of our planet.'},
  {n:27, s:'Co', name:'Cobalt', mass:58.933, cat:'transition', row:4, col:9, p:4, g:9, ec:'[Ar] 3d⁷ 4s²', mp:1495, bp:2927, d:8.90, phase:'s', en:1.88, year:1735, by:'G. Brandt', fact:'Gives cobalt glass its deep blue; used in lithium-ion batteries.'},
  {n:28, s:'Ni', name:'Nickel', mass:58.693, cat:'transition', row:4, col:10, p:4, g:10, ec:'[Ar] 3d⁸ 4s²', mp:1455, bp:2913, d:8.908, phase:'s', en:1.91, year:1751, by:'A. F. Cronstedt', fact:'Most U.S. nickels are 75% copper and only 25% nickel.'},
  {n:29, s:'Cu', name:'Copper', mass:63.546, cat:'transition', row:4, col:11, p:4, g:11, ec:'[Ar] 3d¹⁰ 4s¹', mp:1084.62, bp:2562, d:8.96, phase:'s', en:1.90, year:-9000, by:'Prehistoric', fact:'First metal worked by humans; excellent conductor of electricity.'},
  {n:30, s:'Zn', name:'Zinc', mass:65.38, cat:'transition', row:4, col:12, p:4, g:12, ec:'[Ar] 3d¹⁰ 4s²', mp:419.53, bp:907, d:7.14, phase:'s', en:1.65, year:1746, by:'A. S. Marggraf', fact:'Galvanized steel = steel coated in zinc to prevent rust.'},
  {n:31, s:'Ga', name:'Gallium', mass:69.723, cat:'post-transition', row:4, col:13, p:4, g:13, ec:'[Ar] 3d¹⁰ 4s² 4p¹', mp:29.76, bp:2204, d:5.91, phase:'s', en:1.81, year:1875, by:'L. de Boisbaudran', fact:'Melts in your hand (29.76°C) — Mendeleev predicted it precisely.'},
  {n:32, s:'Ge', name:'Germanium', mass:72.630, cat:'metalloid', row:4, col:14, p:4, g:14, ec:'[Ar] 3d¹⁰ 4s² 4p²', mp:938.25, bp:2833, d:5.323, phase:'s', en:2.01, year:1886, by:'C. A. Winkler', fact:'Used in the first transistor; Mendeleev named it "eka-silicon".'},
  {n:33, s:'As', name:'Arsenic', mass:74.922, cat:'metalloid', row:4, col:15, p:4, g:15, ec:'[Ar] 3d¹⁰ 4s² 4p³', mp:817, bp:614, d:5.727, phase:'s', en:2.18, year:1250, by:'Albertus Magnus', fact:'Infamous poison of the Middle Ages; also found in pesticides.'},
  {n:34, s:'Se', name:'Selenium', mass:78.971, cat:'nonmetal', row:4, col:16, p:4, g:16, ec:'[Ar] 3d¹⁰ 4s² 4p⁴', mp:221, bp:685, d:4.81, phase:'s', en:2.55, year:1817, by:'J. J. Berzelius', fact:'Named after Selene (moon); early photocopiers used it for photoconduction.'},
  {n:35, s:'Br', name:'Bromine', mass:79.904, cat:'halogen', row:4, col:17, p:4, g:17, ec:'[Ar] 3d¹⁰ 4s² 4p⁵', mp:-7.20, bp:58.8, d:3.1028, phase:'l', en:2.96, year:1826, by:'A.-J. Balard', fact:'Only non-metallic element that is liquid at room temperature.'},
  {n:36, s:'Kr', name:'Krypton', mass:83.798, cat:'noble', row:4, col:18, p:4, g:18, ec:'[Ar] 3d¹⁰ 4s² 4p⁶', mp:-157.37, bp:-153.42, d:0.003749, phase:'g', en:3.00, year:1898, by:'Ramsay & Travers', fact:'Yes, Superman’s weakness exists — but it’s just a noble gas.'},
  {n:37, s:'Rb', name:'Rubidium', mass:85.468, cat:'alkali', row:5, col:1, p:5, g:1, ec:'[Kr] 5s¹', mp:39.31, bp:688, d:1.532, phase:'s', en:0.82, year:1861, by:'Bunsen & Kirchhoff', fact:'Melts in warm pockets; ignites spontaneously in air.'},
  {n:38, s:'Sr', name:'Strontium', mass:87.62, cat:'alkaline', row:5, col:2, p:5, g:2, ec:'[Kr] 5s²', mp:777, bp:1382, d:2.64, phase:'s', en:0.95, year:1790, by:'A. Crawford', fact:'Makes the bright red color in fireworks.'},
  {n:39, s:'Y', name:'Yttrium', mass:88.906, cat:'transition', row:5, col:3, p:5, g:3, ec:'[Kr] 4d¹ 5s²', mp:1526, bp:3345, d:4.472, phase:'s', en:1.22, year:1794, by:'J. Gadolin', fact:'Key to old CRT TVs (red phosphor) and YBCO superconductors.'},
  {n:40, s:'Zr', name:'Zirconium', mass:91.224, cat:'transition', row:5, col:4, p:5, g:4, ec:'[Kr] 4d² 5s²', mp:1855, bp:4409, d:6.52, phase:'s', en:1.33, year:1789, by:'M. H. Klaproth', fact:'Cubic zirconia = cheap diamond substitute made from this.'},
  {n:41, s:'Nb', name:'Niobium', mass:92.906, cat:'transition', row:5, col:5, p:5, g:5, ec:'[Kr] 4d⁴ 5s¹', mp:2477, bp:4744, d:8.57, phase:'s', en:1.60, year:1801, by:'C. Hatchett', fact:'Superconducts at low temps — used in MRI machines and the LHC.'},
  {n:42, s:'Mo', name:'Molybdenum', mass:95.95, cat:'transition', row:5, col:6, p:5, g:6, ec:'[Kr] 4d⁵ 5s¹', mp:2623, bp:4639, d:10.28, phase:'s', en:2.16, year:1778, by:'C. W. Scheele', fact:'Strengthens steel alloys; essential to many enzymes.'},
  {n:43, s:'Tc', name:'Technetium', mass:98, cat:'transition', row:5, col:7, p:5, g:7, ec:'[Kr] 4d⁵ 5s²', mp:2157, bp:4265, d:11, phase:'s', en:1.90, year:1937, by:'Perrier & Segrè', fact:'First artificially produced element; all isotopes are radioactive.'},
  {n:44, s:'Ru', name:'Ruthenium', mass:101.07, cat:'transition', row:5, col:8, p:5, g:8, ec:'[Kr] 4d⁷ 5s¹', mp:2334, bp:4150, d:12.45, phase:'s', en:2.20, year:1844, by:'K. Claus', fact:'Named after Ruthenia (Russia); hardens platinum alloys.'},
  {n:45, s:'Rh', name:'Rhodium', mass:102.906, cat:'transition', row:5, col:9, p:5, g:9, ec:'[Kr] 4d⁸ 5s¹', mp:1964, bp:3695, d:12.41, phase:'s', en:2.28, year:1803, by:'W. H. Wollaston', fact:'Most expensive precious metal — used in catalytic converters.'},
  {n:46, s:'Pd', name:'Palladium', mass:106.42, cat:'transition', row:5, col:10, p:5, g:10, ec:'[Kr] 4d¹⁰', mp:1554.9, bp:2963, d:12.023, phase:'s', en:2.20, year:1803, by:'W. H. Wollaston', fact:'Can absorb 900× its own volume in hydrogen.'},
  {n:47, s:'Ag', name:'Silver', mass:107.868, cat:'transition', row:5, col:11, p:5, g:11, ec:'[Kr] 4d¹⁰ 5s¹', mp:961.78, bp:2162, d:10.49, phase:'s', en:1.93, year:-3000, by:'Prehistoric', fact:'Best electrical and thermal conductor of any metal.'},
  {n:48, s:'Cd', name:'Cadmium', mass:112.414, cat:'transition', row:5, col:12, p:5, g:12, ec:'[Kr] 4d¹⁰ 5s²', mp:321.07, bp:767, d:8.65, phase:'s', en:1.69, year:1817, by:'Stromeyer & Hermann', fact:'Toxic heavy metal; used in older rechargeable NiCd batteries.'},
  {n:49, s:'In', name:'Indium', mass:114.818, cat:'post-transition', row:5, col:13, p:5, g:13, ec:'[Kr] 4d¹⁰ 5s² 5p¹', mp:156.60, bp:2072, d:7.31, phase:'s', en:1.78, year:1863, by:'Reich & Richter', fact:'Produces a distinctive "cry" (crackling) when bent.'},
  {n:50, s:'Sn', name:'Tin', mass:118.710, cat:'post-transition', row:5, col:14, p:5, g:14, ec:'[Kr] 4d¹⁰ 5s² 5p²', mp:231.93, bp:2602, d:7.265, phase:'s', en:1.96, year:-3000, by:'Prehistoric', fact:'Bronze = copper + tin; "tin cans" are actually steel.'},
  {n:51, s:'Sb', name:'Antimony', mass:121.760, cat:'metalloid', row:5, col:15, p:5, g:15, ec:'[Kr] 4d¹⁰ 5s² 5p³', mp:630.63, bp:1587, d:6.697, phase:'s', en:2.05, year:-3000, by:'Prehistoric', fact:'Used as black eye makeup (kohl) in ancient Egypt.'},
  {n:52, s:'Te', name:'Tellurium', mass:127.60, cat:'metalloid', row:5, col:16, p:5, g:16, ec:'[Kr] 4d¹⁰ 5s² 5p⁴', mp:449.51, bp:988, d:6.24, phase:'s', en:2.10, year:1782, by:'F.-J. Müller von Reichenstein', fact:'Makes your breath smell like garlic even after tiny exposure.'},
  {n:53, s:'I', name:'Iodine', mass:126.904, cat:'halogen', row:5, col:17, p:5, g:17, ec:'[Kr] 4d¹⁰ 5s² 5p⁵', mp:113.7, bp:184.3, d:4.933, phase:'s', en:2.66, year:1811, by:'B. Courtois', fact:'Sublimes into purple vapor; essential for thyroid hormones.'},
  {n:54, s:'Xe', name:'Xenon', mass:131.293, cat:'noble', row:5, col:18, p:5, g:18, ec:'[Kr] 4d¹⁰ 5s² 5p⁶', mp:-111.75, bp:-108.10, d:0.005894, phase:'g', en:2.60, year:1898, by:'Ramsay & Travers', fact:'Anesthetic in high concentrations; powers ion thrusters on spacecraft.'},
  {n:55, s:'Cs', name:'Cesium', mass:132.905, cat:'alkali', row:6, col:1, p:6, g:1, ec:'[Xe] 6s¹', mp:28.44, bp:671, d:1.873, phase:'s', en:0.79, year:1860, by:'Bunsen & Kirchhoff', fact:'Melts just above body temperature; defines the SI second.'},
  {n:56, s:'Ba', name:'Barium', mass:137.327, cat:'alkaline', row:6, col:2, p:6, g:2, ec:'[Xe] 6s²', mp:727, bp:1845, d:3.594, phase:'s', en:0.89, year:1808, by:'H. Davy', fact:'Barium sulfate is swallowed for GI X-ray contrast (it blocks X-rays).'},
  {n:57, s:'La', name:'Lanthanum', mass:138.905, cat:'lanthanide', row:6, col:3, p:6, g:3, ec:'[Xe] 5d¹ 6s²', mp:920, bp:3464, d:6.145, phase:'s', en:1.10, year:1839, by:'C. G. Mosander', fact:'Starts the lanthanide series; used in camera lenses and NiMH batteries.'},
  {n:58, s:'Ce', name:'Cerium', mass:140.116, cat:'lanthanide', row:9, col:4, p:6, g:null, ec:'[Xe] 4f¹ 5d¹ 6s²', mp:795, bp:3443, d:6.770, phase:'s', en:1.12, year:1803, by:'Berzelius, Hisinger, Klaproth', fact:'Most abundant rare-earth; sparks when scratched (lighter flints).'},
  {n:59, s:'Pr', name:'Praseodymium', mass:140.908, cat:'lanthanide', row:9, col:5, p:6, g:null, ec:'[Xe] 4f³ 6s²', mp:935, bp:3520, d:6.77, phase:'s', en:1.13, year:1885, by:'C. A. von Welsbach', fact:'Gives glass a yellow-green color; "green twin" in Greek.'},
  {n:60, s:'Nd', name:'Neodymium', mass:144.242, cat:'lanthanide', row:9, col:6, p:6, g:null, ec:'[Xe] 4f⁴ 6s²', mp:1024, bp:3074, d:7.01, phase:'s', en:1.14, year:1885, by:'C. A. von Welsbach', fact:'Makes the world’s strongest permanent magnets.'},
  {n:61, s:'Pm', name:'Promethium', mass:145, cat:'lanthanide', row:9, col:7, p:6, g:null, ec:'[Xe] 4f⁵ 6s²', mp:1042, bp:3000, d:7.26, phase:'s', en:1.13, year:1945, by:'Marinsky, Glendenin, Coryell', fact:'Named after Prometheus; all isotopes are radioactive.'},
  {n:62, s:'Sm', name:'Samarium', mass:150.36, cat:'lanthanide', row:9, col:8, p:6, g:null, ec:'[Xe] 4f⁶ 6s²', mp:1072, bp:1794, d:7.52, phase:'s', en:1.17, year:1879, by:'L. de Boisbaudran', fact:'SmCo magnets work at higher temps than NdFeB.'},
  {n:63, s:'Eu', name:'Europium', mass:151.964, cat:'lanthanide', row:9, col:9, p:6, g:null, ec:'[Xe] 4f⁷ 6s²', mp:822, bp:1529, d:5.243, phase:'s', en:1.20, year:1901, by:'E.-A. Demarçay', fact:'Glows red in euro banknotes under UV light (anti-counterfeit).'},
  {n:64, s:'Gd', name:'Gadolinium', mass:157.25, cat:'lanthanide', row:9, col:10, p:6, g:null, ec:'[Xe] 4f⁷ 5d¹ 6s²', mp:1313, bp:3273, d:7.90, phase:'s', en:1.20, year:1880, by:'J. C. G. de Marignac', fact:'Used as MRI contrast agent; strongly paramagnetic.'},
  {n:65, s:'Tb', name:'Terbium', mass:158.925, cat:'lanthanide', row:9, col:11, p:6, g:null, ec:'[Xe] 4f⁹ 6s²', mp:1356, bp:3230, d:8.229, phase:'s', en:1.20, year:1843, by:'C. G. Mosander', fact:'Gives fluorescent lamps and CRTs their green glow.'},
  {n:66, s:'Dy', name:'Dysprosium', mass:162.500, cat:'lanthanide', row:9, col:12, p:6, g:null, ec:'[Xe] 4f¹⁰ 6s²', mp:1412, bp:2567, d:8.55, phase:'s', en:1.22, year:1886, by:'L. de Boisbaudran', fact:'Added to NdFeB magnets so they keep working in hot motors (EVs).'},
  {n:67, s:'Ho', name:'Holmium', mass:164.930, cat:'lanthanide', row:9, col:13, p:6, g:null, ec:'[Xe] 4f¹¹ 6s²', mp:1474, bp:2700, d:8.795, phase:'s', en:1.23, year:1878, by:'Delafontaine, Soret, Cleve', fact:'Highest magnetic strength of any element.'},
  {n:68, s:'Er', name:'Erbium', mass:167.259, cat:'lanthanide', row:9, col:14, p:6, g:null, ec:'[Xe] 4f¹² 6s²', mp:1529, bp:2868, d:9.066, phase:'s', en:1.24, year:1843, by:'C. G. Mosander', fact:'Erbium-doped fiber amplifiers power the internet backbone.'},
  {n:69, s:'Tm', name:'Thulium', mass:168.934, cat:'lanthanide', row:9, col:15, p:6, g:null, ec:'[Xe] 4f¹³ 6s²', mp:1545, bp:1950, d:9.32, phase:'s', en:1.25, year:1879, by:'P. T. Cleve', fact:'Rarest stable rare-earth element.'},
  {n:70, s:'Yb', name:'Ytterbium', mass:173.045, cat:'lanthanide', row:9, col:16, p:6, g:null, ec:'[Xe] 4f¹⁴ 6s²', mp:819, bp:1196, d:6.90, phase:'s', en:1.10, year:1878, by:'J. C. G. de Marignac', fact:'Ytterbium atomic clocks are accurate to 1 second in 30 billion years.'},
  {n:71, s:'Lu', name:'Lutetium', mass:174.967, cat:'lanthanide', row:9, col:17, p:6, g:null, ec:'[Xe] 4f¹⁴ 5d¹ 6s²', mp:1663, bp:3402, d:9.841, phase:'s', en:1.27, year:1907, by:'Urbain, von Welsbach, James', fact:'One of the densest rare-earths; used in PET scan detectors.'},
  {n:72, s:'Hf', name:'Hafnium', mass:178.49, cat:'transition', row:6, col:4, p:6, g:4, ec:'[Xe] 4f¹⁴ 5d² 6s²', mp:2233, bp:4603, d:13.31, phase:'s', en:1.30, year:1923, by:'Coster & von Hevesy', fact:'Control rods in nuclear reactors; absorbs neutrons hungrily.'},
  {n:73, s:'Ta', name:'Tantalum', mass:180.948, cat:'transition', row:6, col:5, p:6, g:5, ec:'[Xe] 4f¹⁴ 5d³ 6s²', mp:3017, bp:5458, d:16.69, phase:'s', en:1.50, year:1802, by:'A. G. Ekeberg', fact:'Nearly every smartphone has tantalum capacitors.'},
  {n:74, s:'W', name:'Tungsten', mass:183.84, cat:'transition', row:6, col:6, p:6, g:6, ec:'[Xe] 4f¹⁴ 5d⁴ 6s²', mp:3422, bp:5555, d:19.25, phase:'s', en:2.36, year:1783, by:'Elhuyar brothers', fact:'Highest melting point of any metal; old light-bulb filaments.'},
  {n:75, s:'Re', name:'Rhenium', mass:186.207, cat:'transition', row:6, col:7, p:6, g:7, ec:'[Xe] 4f¹⁴ 5d⁵ 6s²', mp:3186, bp:5596, d:21.02, phase:'s', en:1.90, year:1925, by:'Noddack, Tacke, Berg', fact:'Last stable element discovered; in jet engine superalloys.'},
  {n:76, s:'Os', name:'Osmium', mass:190.23, cat:'transition', row:6, col:8, p:6, g:8, ec:'[Xe] 4f¹⁴ 5d⁶ 6s²', mp:3033, bp:5012, d:22.59, phase:'s', en:2.20, year:1803, by:'S. Tennant', fact:'Densest naturally occurring element on Earth.'},
  {n:77, s:'Ir', name:'Iridium', mass:192.217, cat:'transition', row:6, col:9, p:6, g:9, ec:'[Xe] 4f¹⁴ 5d⁷ 6s²', mp:2466, bp:4428, d:22.56, phase:'s', en:2.20, year:1803, by:'S. Tennant', fact:'Meteoric iridium layer marks the extinction of dinosaurs.'},
  {n:78, s:'Pt', name:'Platinum', mass:195.084, cat:'transition', row:6, col:10, p:6, g:10, ec:'[Xe] 4f¹⁴ 5d⁹ 6s¹', mp:1768.3, bp:3825, d:21.45, phase:'s', en:2.28, year:1735, by:'A. de Ulloa', fact:'Catalytic converters convert pollutants using a thin platinum coating.'},
  {n:79, s:'Au', name:'Gold', mass:196.967, cat:'transition', row:6, col:11, p:6, g:11, ec:'[Xe] 4f¹⁴ 5d¹⁰ 6s¹', mp:1064.18, bp:2856, d:19.30, phase:'s', en:2.54, year:-6000, by:'Prehistoric', fact:'Never tarnishes; 1 gram can stretch into a wire 2 km long.'},
  {n:80, s:'Hg', name:'Mercury', mass:200.592, cat:'transition', row:6, col:12, p:6, g:12, ec:'[Xe] 4f¹⁴ 5d¹⁰ 6s²', mp:-38.83, bp:356.73, d:13.5336, phase:'l', en:2.00, year:-2000, by:'Ancient civilizations', fact:'Only metal that is liquid at room temperature.'},
  {n:81, s:'Tl', name:'Thallium', mass:204.38, cat:'post-transition', row:6, col:13, p:6, g:13, ec:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p¹', mp:304, bp:1473, d:11.85, phase:'s', en:1.62, year:1861, by:'W. Crookes', fact:'"Poisoner’s poison" — tasteless, odorless, lethal.'},
  {n:82, s:'Pb', name:'Lead', mass:207.2, cat:'post-transition', row:6, col:14, p:6, g:14, ec:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p²', mp:327.46, bp:1749, d:11.34, phase:'s', en:2.33, year:-6500, by:'Prehistoric', fact:'Romans piped water through it; suspected cause of their decline.'},
  {n:83, s:'Bi', name:'Bismuth', mass:208.980, cat:'post-transition', row:6, col:15, p:6, g:15, ec:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p³', mp:271.5, bp:1564, d:9.78, phase:'s', en:2.02, year:1753, by:'C. Geoffroy', fact:'Forms rainbow iridescent crystals; mildly radioactive but effectively stable.'},
  {n:84, s:'Po', name:'Polonium', mass:209, cat:'post-transition', row:6, col:16, p:6, g:16, ec:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁴', mp:254, bp:962, d:9.196, phase:'s', en:2.00, year:1898, by:'Curie & Curie', fact:'Marie Curie named it after her homeland, Poland.'},
  {n:85, s:'At', name:'Astatine', mass:210, cat:'halogen', row:6, col:17, p:6, g:17, ec:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁵', mp:302, bp:337, d:6.35, phase:'s', en:2.20, year:1940, by:'Corson, MacKenzie, Segrè', fact:'Rarest naturally occurring element — less than 1 oz in Earth’s crust at any time.'},
  {n:86, s:'Rn', name:'Radon', mass:222, cat:'noble', row:6, col:18, p:6, g:18, ec:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁶', mp:-71, bp:-61.7, d:0.00973, phase:'g', en:2.20, year:1900, by:'F. Dorn', fact:'Radioactive gas that seeps from soil — top cause of lung cancer in non-smokers.'},
  {n:87, s:'Fr', name:'Francium', mass:223, cat:'alkali', row:7, col:1, p:7, g:1, ec:'[Rn] 7s¹', mp:21, bp:650, d:1.87, phase:'s', en:0.70, year:1939, by:'M. Perey', fact:'Most unstable naturally occurring element; longest half-life is 22 minutes.'},
  {n:88, s:'Ra', name:'Radium', mass:226, cat:'alkaline', row:7, col:2, p:7, g:2, ec:'[Rn] 7s²', mp:700, bp:1737, d:5.5, phase:'s', en:0.90, year:1898, by:'Curie & Curie', fact:'Glows blue in the dark; once painted on watch dials (before we knew better).'},
  {n:89, s:'Ac', name:'Actinium', mass:227, cat:'actinide', row:7, col:3, p:7, g:3, ec:'[Rn] 6d¹ 7s²', mp:1050, bp:3200, d:10.07, phase:'s', en:1.10, year:1899, by:'A.-L. Debierne', fact:'Starts the actinide series; 150× more radioactive than radium.'},
  {n:90, s:'Th', name:'Thorium', mass:232.038, cat:'actinide', row:10, col:4, p:7, g:null, ec:'[Rn] 6d² 7s²', mp:1750, bp:4785, d:11.72, phase:'s', en:1.30, year:1829, by:'J. J. Berzelius', fact:'Potential next-gen nuclear fuel — more abundant than uranium.'},
  {n:91, s:'Pa', name:'Protactinium', mass:231.036, cat:'actinide', row:10, col:5, p:7, g:null, ec:'[Rn] 5f² 6d¹ 7s²', mp:1572, bp:4027, d:15.37, phase:'s', en:1.50, year:1913, by:'Fajans & Göhring', fact:'One of the rarest and most expensive naturally occurring elements.'},
  {n:92, s:'U', name:'Uranium', mass:238.029, cat:'actinide', row:10, col:6, p:7, g:null, ec:'[Rn] 5f³ 6d¹ 7s²', mp:1132.2, bp:4131, d:18.95, phase:'s', en:1.38, year:1789, by:'M. H. Klaproth', fact:'Fuels nuclear reactors; its fission releases the Sun’s-worth of energy per gram.'},
  {n:93, s:'Np', name:'Neptunium', mass:237, cat:'actinide', row:10, col:7, p:7, g:null, ec:'[Rn] 5f⁴ 6d¹ 7s²', mp:644, bp:3902, d:20.45, phase:'s', en:1.36, year:1940, by:'McMillan & Abelson', fact:'First transuranium element ever synthesized.'},
  {n:94, s:'Pu', name:'Plutonium', mass:244, cat:'actinide', row:10, col:8, p:7, g:null, ec:'[Rn] 5f⁶ 7s²', mp:640, bp:3228, d:19.84, phase:'s', en:1.28, year:1940, by:'Seaborg et al.', fact:'Core of nuclear weapons; also powers deep-space probes (Voyager, Curiosity).'},
  {n:95, s:'Am', name:'Americium', mass:243, cat:'actinide', row:10, col:9, p:7, g:null, ec:'[Rn] 5f⁷ 7s²', mp:1176, bp:2607, d:13.69, phase:'s', en:1.30, year:1944, by:'Seaborg et al.', fact:'Found in household smoke detectors.'},
  {n:96, s:'Cm', name:'Curium', mass:247, cat:'actinide', row:10, col:10, p:7, g:null, ec:'[Rn] 5f⁷ 6d¹ 7s²', mp:1345, bp:3100, d:13.51, phase:'s', en:1.30, year:1944, by:'Seaborg et al.', fact:'Named after Marie and Pierre Curie.'},
  {n:97, s:'Bk', name:'Berkelium', mass:247, cat:'actinide', row:10, col:11, p:7, g:null, ec:'[Rn] 5f⁹ 7s²', mp:986, bp:2627, d:14.79, phase:'s', en:1.30, year:1949, by:'Seaborg et al.', fact:'Named after UC Berkeley, where it was synthesized.'},
  {n:98, s:'Cf', name:'Californium', mass:251, cat:'actinide', row:10, col:12, p:7, g:null, ec:'[Rn] 5f¹⁰ 7s²', mp:900, bp:1470, d:15.1, phase:'s', en:1.30, year:1950, by:'Seaborg et al.', fact:'One gram costs ~$27 million; strong neutron emitter.'},
  {n:99, s:'Es', name:'Einsteinium', mass:252, cat:'actinide', row:10, col:13, p:7, g:null, ec:'[Rn] 5f¹¹ 7s²', mp:860, bp:996, d:8.84, phase:'s', en:1.30, year:1952, by:'Ghiorso et al.', fact:'First found in fallout from the first H-bomb test.'},
  {n:100, s:'Fm', name:'Fermium', mass:257, cat:'actinide', row:10, col:14, p:7, g:null, ec:'[Rn] 5f¹² 7s²', mp:1527, bp:null, d:null, phase:'s', en:1.30, year:1952, by:'Ghiorso et al.', fact:'Last element that can be formed by neutron capture.'},
  {n:101, s:'Md', name:'Mendelevium', mass:258, cat:'actinide', row:10, col:15, p:7, g:null, ec:'[Rn] 5f¹³ 7s²', mp:827, bp:null, d:null, phase:'s', en:1.30, year:1955, by:'Ghiorso et al.', fact:'Named after Dmitri Mendeleev, father of the periodic table.'},
  {n:102, s:'No', name:'Nobelium', mass:259, cat:'actinide', row:10, col:16, p:7, g:null, ec:'[Rn] 5f¹⁴ 7s²', mp:827, bp:null, d:null, phase:'s', en:1.30, year:1966, by:'Flerov Lab / JINR', fact:'Named after Alfred Nobel of Nobel Prize fame.'},
  {n:103, s:'Lr', name:'Lawrencium', mass:266, cat:'actinide', row:10, col:17, p:7, g:null, ec:'[Rn] 5f¹⁴ 7s² 7p¹', mp:1627, bp:null, d:null, phase:'s', en:1.30, year:1961, by:'Ghiorso et al.', fact:'Named after Ernest Lawrence, inventor of the cyclotron.'},
  {n:104, s:'Rf', name:'Rutherfordium', mass:267, cat:'transition', row:7, col:4, p:7, g:4, ec:'[Rn] 5f¹⁴ 6d² 7s²', mp:2100, bp:5500, d:23.2, phase:'s', en:null, year:1969, by:'Ghiorso et al.', fact:'Named after Ernest Rutherford; all isotopes highly radioactive.'},
  {n:105, s:'Db', name:'Dubnium', mass:268, cat:'transition', row:7, col:5, p:7, g:5, ec:'[Rn] 5f¹⁴ 6d³ 7s²', mp:null, bp:null, d:29.3, phase:'s', en:null, year:1968, by:'JINR / Ghiorso', fact:'Named after Dubna, Russia, site of its discovery.'},
  {n:106, s:'Sg', name:'Seaborgium', mass:269, cat:'transition', row:7, col:6, p:7, g:6, ec:'[Rn] 5f¹⁴ 6d⁴ 7s²', mp:null, bp:null, d:35.0, phase:'s', en:null, year:1974, by:'Ghiorso et al.', fact:'First element named after a living person (Glenn Seaborg).'},
  {n:107, s:'Bh', name:'Bohrium', mass:270, cat:'transition', row:7, col:7, p:7, g:7, ec:'[Rn] 5f¹⁴ 6d⁵ 7s²', mp:null, bp:null, d:37.1, phase:'s', en:null, year:1981, by:'GSI Darmstadt', fact:'Named after Niels Bohr; only ~20 atoms ever produced.'},
  {n:108, s:'Hs', name:'Hassium', mass:269, cat:'transition', row:7, col:8, p:7, g:8, ec:'[Rn] 5f¹⁴ 6d⁶ 7s²', mp:null, bp:null, d:40.7, phase:'s', en:null, year:1984, by:'GSI Darmstadt', fact:'Named after the German state of Hesse.'},
  {n:109, s:'Mt', name:'Meitnerium', mass:278, cat:'unknown', row:7, col:9, p:7, g:9, ec:'[Rn] 5f¹⁴ 6d⁷ 7s²', mp:null, bp:null, d:37.4, phase:'s', en:null, year:1982, by:'GSI Darmstadt', fact:'Named after Lise Meitner, co-discoverer of nuclear fission.'},
  {n:110, s:'Ds', name:'Darmstadtium', mass:281, cat:'unknown', row:7, col:10, p:7, g:10, ec:'[Rn] 5f¹⁴ 6d⁸ 7s²', mp:null, bp:null, d:34.8, phase:'s', en:null, year:1994, by:'GSI Darmstadt', fact:'Named after Darmstadt, Germany, its discovery site.'},
  {n:111, s:'Rg', name:'Roentgenium', mass:282, cat:'unknown', row:7, col:11, p:7, g:11, ec:'[Rn] 5f¹⁴ 6d⁹ 7s²', mp:null, bp:null, d:28.7, phase:'s', en:null, year:1994, by:'GSI Darmstadt', fact:'Named after Wilhelm Röntgen, discoverer of X-rays.'},
  {n:112, s:'Cn', name:'Copernicium', mass:285, cat:'unknown', row:7, col:12, p:7, g:12, ec:'[Rn] 5f¹⁴ 6d¹⁰ 7s²', mp:null, bp:67, d:23.7, phase:'g', en:null, year:1996, by:'GSI Darmstadt', fact:'Predicted to be a liquid or gas at room temperature.'},
  {n:113, s:'Nh', name:'Nihonium', mass:286, cat:'unknown', row:7, col:13, p:7, g:13, ec:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p¹', mp:700, bp:1400, d:16, phase:'s', en:null, year:2004, by:'RIKEN (Japan)', fact:'First element discovered and named by Asian scientists.'},
  {n:114, s:'Fl', name:'Flerovium', mass:289, cat:'unknown', row:7, col:14, p:7, g:14, ec:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p²', mp:200, bp:380, d:14, phase:'s', en:null, year:1999, by:'JINR (Dubna)', fact:'Once thought to be a noble gas; may sit on the "island of stability".'},
  {n:115, s:'Mc', name:'Moscovium', mass:290, cat:'unknown', row:7, col:15, p:7, g:15, ec:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p³', mp:400, bp:1100, d:13.5, phase:'s', en:null, year:2003, by:'JINR & LLNL', fact:'Named after the Moscow region; only a handful of atoms ever made.'},
  {n:116, s:'Lv', name:'Livermorium', mass:293, cat:'unknown', row:7, col:16, p:7, g:16, ec:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁴', mp:500, bp:1100, d:12.9, phase:'s', en:null, year:2000, by:'JINR & LLNL', fact:'Named after Lawrence Livermore National Laboratory.'},
  {n:117, s:'Ts', name:'Tennessine', mass:294, cat:'halogen', row:7, col:17, p:7, g:17, ec:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁵', mp:700, bp:883, d:7.2, phase:'s', en:null, year:2010, by:'JINR, ORNL, Vanderbilt', fact:'Named after Tennessee, home of Oak Ridge National Laboratory.'},
  {n:118, s:'Og', name:'Oganesson', mass:294, cat:'noble', row:7, col:18, p:7, g:18, ec:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁶', mp:null, bp:80, d:4.95, phase:'g', en:null, year:2006, by:'JINR & LLNL', fact:'Heaviest confirmed element; named after Yuri Oganessian (still living).'},
];

// Friendly category labels + ordering for the filter chips
const CATEGORIES = [
  {id:'alkali',          label:'Alkali metals'},
  {id:'alkaline',        label:'Alkaline earth'},
  {id:'transition',      label:'Transition'},
  {id:'post-transition', label:'Post-transition'},
  {id:'metalloid',       label:'Metalloids'},
  {id:'nonmetal',        label:'Nonmetals'},
  {id:'halogen',         label:'Halogens'},
  {id:'noble',           label:'Noble gases'},
  {id:'lanthanide',      label:'Lanthanides'},
  {id:'actinide',        label:'Actinides'},
  {id:'unknown',         label:'Unknown'},
];

// ────────────────────────────────────────────────────────────────
// STATE
// ────────────────────────────────────────────────────────────────
const state = {
  activeCat: 'all',
  query: '',
  temp: 25,           // °C; used for phase-shading
  phaseMode: false,   // when true, element colors reflect state at temp
  selectedId: null,
  built: false,
};

// ────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────
function fmtNum(v, unit){
  if (v === null || v === undefined) return '—';
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (isNaN(n)) return String(v);
  const disp = Math.abs(n) >= 100 ? n.toFixed(0)
             : Math.abs(n) >= 10  ? n.toFixed(2)
             : Math.abs(n) >= 0.01 ? n.toFixed(3)
             : n.toPrecision(3);
  return unit ? `${disp} ${unit}` : disp;
}

function phaseAt(el, tempC){
  // Return 's' | 'l' | 'g' using melting / boiling points (best-effort)
  if (el.mp == null && el.bp == null) return el.phase || 's';
  if (el.mp != null && tempC < el.mp) return 's';
  if (el.bp != null && tempC >= el.bp) return 'g';
  if (el.mp != null && el.bp != null && tempC >= el.mp && tempC < el.bp) return 'l';
  return el.phase || 's';
}

function phaseLabel(p){
  return p === 's' ? 'Solid' : p === 'l' ? 'Liquid' : p === 'g' ? 'Gas' : '—';
}

function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function matchesQuery(el, q){
  if (!q) return true;
  const s = q.toLowerCase().trim();
  if (!s) return true;
  return String(el.n) === s
      || el.s.toLowerCase().startsWith(s)
      || el.name.toLowerCase().includes(s);
}

function isHighlighted(el){
  const catOk = state.activeCat === 'all' || el.cat === state.activeCat;
  const qOk   = matchesQuery(el, state.query);
  return catOk && qOk;
}

// ────────────────────────────────────────────────────────────────
// RENDERING
// ────────────────────────────────────────────────────────────────
function buildTable(){
  const host = document.getElementById('ptGrid');
  if (!host) return;
  host.innerHTML = ELEMENTS.map(el => `
    <button type="button"
            class="pt-el"
            data-n="${el.n}"
            data-cat="${el.cat}"
            style="grid-row:${el.row};grid-column:${el.col}"
            aria-label="${esc(el.name)}, atomic number ${el.n}">
      <span class="pt-el-n">${el.n}</span>
      <span class="pt-el-s">${el.s}</span>
      <span class="pt-el-name">${esc(el.name)}</span>
      <span class="pt-el-m">${el.mass === Math.round(el.mass) ? el.mass : el.mass.toFixed(2)}</span>
    </button>
  `).join('') + `
    <!-- Row-8 gap markers that label the two blocks below -->
    <div class="pt-block-label pt-block-lanth" style="grid-row:9;grid-column:2">57–71 →</div>
    <div class="pt-block-label pt-block-actin" style="grid-row:10;grid-column:2">89–103 →</div>
  `;

  // Click binding
  host.addEventListener('click', e => {
    const btn = e.target.closest('.pt-el');
    if (!btn) return;
    const n = parseInt(btn.dataset.n, 10);
    openDetail(n);
  });

  // Keyboard navigation between focused elements
  host.addEventListener('keydown', e => {
    const btn = document.activeElement;
    if (!btn || !btn.classList?.contains('pt-el')) return;
    const n = parseInt(btn.dataset.n, 10);
    let dn = 0;
    if (e.key === 'ArrowRight') dn = 1;
    else if (e.key === 'ArrowLeft') dn = -1;
    else if (e.key === 'ArrowDown') dn = 18;
    else if (e.key === 'ArrowUp') dn = -18;
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(n); return; }
    if (!dn) return;
    e.preventDefault();
    const target = document.querySelector(`.pt-el[data-n="${n + dn}"]`);
    if (target) target.focus();
  });

  state.built = true;
}

function buildFilterChips(){
  const host = document.getElementById('ptCats');
  if (!host) return;
  host.innerHTML = `
    <button type="button" class="pt-chip active" data-cat="all">All</button>
    ${CATEGORIES.map(c => `
      <button type="button" class="pt-chip" data-cat="${c.id}">
        <span class="pt-chip-dot" data-cat="${c.id}"></span>${c.label}
      </button>
    `).join('')}
  `;
  host.addEventListener('click', e => {
    const chip = e.target.closest('.pt-chip');
    if (!chip) return;
    host.querySelectorAll('.pt-chip').forEach(b => b.classList.remove('active'));
    chip.classList.add('active');
    state.activeCat = chip.dataset.cat;
    applyFiltersAndPhase();
  });
}

function applyFiltersAndPhase(){
  const cards = document.querySelectorAll('.pt-el');
  cards.forEach(card => {
    const n = parseInt(card.dataset.n, 10);
    const el = ELEMENTS[n - 1];
    const on = isHighlighted(el);
    card.classList.toggle('pt-dim', !on);

    if (state.phaseMode) {
      const ph = phaseAt(el, state.temp);
      card.dataset.phase = ph;
    } else {
      delete card.dataset.phase;
    }
  });

  const tmpLbl = document.getElementById('ptTempVal');
  if (tmpLbl) tmpLbl.textContent = state.phaseMode
    ? `${state.temp}°C  ·  phase mode`
    : `${state.temp}°C`;
}

// ────────────────────────────────────────────────────────────────
// DETAIL PANEL
// ────────────────────────────────────────────────────────────────
function openDetail(n){
  const el = ELEMENTS[n - 1];
  if (!el) return;
  state.selectedId = n;

  const host = document.getElementById('ptDetail');
  if (!host) return;

  const ph = phaseAt(el, state.temp);
  const catLabel = (CATEGORIES.find(c => c.id === el.cat) || {}).label || el.cat;

  host.innerHTML = `
    <div class="pt-detail-inner" data-cat="${el.cat}">
      <button type="button" class="pt-detail-close" onclick="window.fluxPeriodic.closeDetail()" aria-label="Close">✕</button>

      <div class="pt-detail-head">
        <div class="pt-detail-n">${el.n}</div>
        <div class="pt-detail-symbol">${el.s}</div>
        <div class="pt-detail-name">${esc(el.name)}</div>
        <div class="pt-detail-mass">${el.mass} u</div>
        <div class="pt-detail-cat">${esc(catLabel)}</div>
      </div>

      <div class="pt-detail-shells" aria-hidden="true">
        ${renderShellDiagram(el)}
      </div>

      <div class="pt-detail-grid">
        ${statRow('Atomic number', el.n)}
        ${statRow('Atomic mass',   `${el.mass} u`)}
        ${statRow('Category',       catLabel)}
        ${statRow('Period · Group', `${el.p}${el.g ? ' · ' + el.g : ''}`)}
        ${statRow('Electron config', el.ec)}
        ${statRow('Phase (STP)',    phaseLabel(el.phase))}
        ${statRow('Phase now',      `${phaseLabel(ph)}  ·  at ${state.temp}°C`)}
        ${statRow('Melting point',  fmtNum(el.mp, '°C'))}
        ${statRow('Boiling point',  fmtNum(el.bp, '°C'))}
        ${statRow('Density',        fmtNum(el.d, 'g/cm³'))}
        ${statRow('Electronegativity', el.en == null ? '—' : el.en)}
        ${statRow('Discovered',     `${el.year > 0 ? el.year : Math.abs(el.year) + ' BCE'}  ·  ${esc(el.by || '—')}`)}
      </div>

      <div class="pt-detail-fact">
        <div class="pt-detail-fact-label">Did you know?</div>
        <div class="pt-detail-fact-text">${esc(el.fact)}</div>
      </div>

      <div class="pt-detail-actions">
        <button type="button" class="pt-detail-btn" onclick="window.fluxPeriodic.prev()">← Previous</button>
        <button type="button" class="pt-detail-btn" onclick="window.fluxPeriodic.next()">Next →</button>
      </div>
    </div>
  `;
  host.classList.add('open');
  host.setAttribute('aria-hidden', 'false');
}

function statRow(label, value){
  return `
    <div class="pt-stat">
      <div class="pt-stat-lbl">${esc(label)}</div>
      <div class="pt-stat-val">${typeof value === 'string' ? esc(value) : value}</div>
    </div>
  `;
}

function closeDetail(){
  const host = document.getElementById('ptDetail');
  if (!host) return;
  host.classList.remove('open');
  host.setAttribute('aria-hidden', 'true');
  state.selectedId = null;
}

function step(delta){
  if (state.selectedId == null) return;
  const next = state.selectedId + delta;
  if (next < 1 || next > 118) return;
  openDetail(next);
}

// Best-effort Bohr shell diagram (2, 8, 18, 32, 32, 18, 8 max per shell, filled greedy)
function renderShellDiagram(el){
  const max = [2, 8, 18, 32, 32, 18, 8];
  let remaining = el.n;
  const shells = [];
  for (const cap of max){
    if (remaining <= 0) break;
    const put = Math.min(cap, remaining);
    shells.push(put);
    remaining -= put;
  }
  const size = 170;
  const cx = size / 2, cy = size / 2;
  let svg = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">`;
  svg += `<circle cx="${cx}" cy="${cy}" r="10" fill="currentColor" opacity=".9"/>`;
  const maxR = (size / 2) - 6;
  shells.forEach((count, i) => {
    const r = ((i + 1) / shells.length) * maxR;
    svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="currentColor" stroke-opacity=".22" stroke-width="1"/>`;
    for (let k = 0; k < count; k++){
      const angle = (k / count) * 2 * Math.PI;
      const ex = cx + r * Math.cos(angle);
      const ey = cy + r * Math.sin(angle);
      svg += `<circle cx="${ex}" cy="${ey}" r="2.3" fill="currentColor"/>`;
    }
  });
  svg += `</svg>`;
  return svg;
}

// ────────────────────────────────────────────────────────────────
// CONTROLS WIRING
// ────────────────────────────────────────────────────────────────
function wireSearchAndSlider(){
  const search = document.getElementById('ptSearch');
  if (search){
    search.addEventListener('input', e => {
      state.query = e.target.value || '';
      applyFiltersAndPhase();
    });
  }

  const slider = document.getElementById('ptTempSlider');
  const tVal   = document.getElementById('ptTempVal');
  const phaseT = document.getElementById('ptPhaseToggle');
  if (slider){
    slider.addEventListener('input', e => {
      state.temp = parseInt(e.target.value, 10) || 25;
      if (tVal) tVal.textContent = state.phaseMode
        ? `${state.temp}°C  ·  phase mode`
        : `${state.temp}°C`;
      if (state.phaseMode) applyFiltersAndPhase();
    });
  }
  if (phaseT){
    phaseT.addEventListener('click', () => {
      state.phaseMode = !state.phaseMode;
      phaseT.classList.toggle('active', state.phaseMode);
      applyFiltersAndPhase();
    });
  }

  // Close detail on Escape / outside click
  document.addEventListener('keydown', e => {
    const host = document.getElementById('ptDetail');
    if (!host || !host.classList.contains('open')) return;
    if (e.key === 'Escape') closeDetail();
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft')  step(-1);
  });
}

// Public entry — called from nav('periodic')
function renderPeriodic(){
  if (!state.built){
    buildTable();
    buildFilterChips();
    wireSearchAndSlider();
  }
  applyFiltersAndPhase();
}

// Expose
window.renderPeriodic = renderPeriodic;
window.fluxPeriodic = {
  open: openDetail,
  close: closeDetail,
  closeDetail,
  next: () => step(1),
  prev: () => step(-1),
  setTemp: t => { state.temp = t; applyFiltersAndPhase(); },
  setPhaseMode: on => { state.phaseMode = !!on; applyFiltersAndPhase(); },
  setCategory: c => { state.activeCat = c || 'all'; applyFiltersAndPhase(); },
  search: q => { state.query = q || ''; applyFiltersAndPhase(); },
  ELEMENTS,
};

})();
