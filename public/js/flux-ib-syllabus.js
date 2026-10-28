/* ============================================================================
   FLUX IB SYLLABUS  ·  flux-ib-syllabus.js
   Every IB Diploma Programme subject Flux students take, with every unit of
   its current guide, so a Flux Tutor study set can be filed under the unit
   it revises and a student can see which units they have not covered yet.

   Only names and codes: no syllabus text. Codes are the guide's own where it
   has them (Biology A1.1, Physics A.1, Economics 2.5); otherwise units are in
   the guide's order. `hl: true` marks additional higher level content.

   Guides: Biology, Chemistry, Physics (first assessment 2025); Mathematics
   AA and AI (2021); Economics (2022); Business Management (2024); ESS (2026);
   Global Politics (2026); Computer Science (2027); Psychology (2027);
   History, Geography, Language A and B as currently examined.
   ========================================================================== */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  if (root.FluxIbSyllabus) return;

  /** [code, title, hl?] rows under a section heading. */
  function sec(name, rows) {
    return rows.map(function (r) { return { section: name, code: r[0], title: r[1], hl: !!r[2] }; });
  }
  function units() { return [].concat.apply([], arguments); }

  var SUBJECTS = [
    { id: 'biology', name: 'Biology', group: 'Sciences', aliases: ['bio'], units: units(
      sec('A · Unity and diversity', [
        ['A1.1', 'Water'], ['A1.2', 'Nucleic acids'], ['A2.1', 'Origins of cells', 1], ['A2.2', 'Cell structure'],
        ['A2.3', 'Viruses', 1], ['A3.1', 'Diversity of organisms'], ['A3.2', 'Classification and cladistics', 1],
        ['A4.1', 'Evolution and speciation'], ['A4.2', 'Conservation of biodiversity']]),
      sec('B · Form and function', [
        ['B1.1', 'Carbohydrates and lipids'], ['B1.2', 'Proteins'], ['B2.1', 'Membranes and membrane transport'],
        ['B2.2', 'Organelles and compartmentalization'], ['B2.3', 'Cell specialization'], ['B3.1', 'Gas exchange'],
        ['B3.2', 'Transport'], ['B3.3', 'Muscle and motility', 1], ['B4.1', 'Adaptation to environment'], ['B4.2', 'Ecological niches']]),
      sec('C · Interaction and interdependence', [
        ['C1.1', 'Enzymes and metabolism'], ['C1.2', 'Cell respiration'], ['C1.3', 'Photosynthesis'],
        ['C2.1', 'Chemical signalling', 1], ['C2.2', 'Neural signalling'], ['C3.1', 'Integration of body systems'],
        ['C3.2', 'Defence against disease'], ['C4.1', 'Populations and communities'], ['C4.2', 'Transfers of energy and matter']]),
      sec('D · Continuity and change', [
        ['D1.1', 'DNA replication'], ['D1.2', 'Protein synthesis'], ['D1.3', 'Mutation and gene editing'],
        ['D2.1', 'Cell and nuclear division'], ['D2.2', 'Gene expression', 1], ['D2.3', 'Water potential'],
        ['D3.1', 'Reproduction'], ['D3.2', 'Inheritance'], ['D3.3', 'Homeostasis'], ['D4.1', 'Natural selection'],
        ['D4.2', 'Stability and change'], ['D4.3', 'Climate change']])) },

    { id: 'chemistry', name: 'Chemistry', group: 'Sciences', aliases: ['chem'], units: units(
      sec('Structure 1 · Models of the particulate nature of matter', [
        ['S1.1', 'Introduction to the particulate nature of matter'], ['S1.2', 'The nuclear atom'], ['S1.3', 'Electron configurations'],
        ['S1.4', 'Counting particles by mass: the mole'], ['S1.5', 'Ideal gases']]),
      sec('Structure 2 · Models of bonding and structure', [
        ['S2.1', 'The ionic model'], ['S2.2', 'The covalent model'], ['S2.3', 'The metallic model'], ['S2.4', 'From models to materials']]),
      sec('Structure 3 · Classification of matter', [
        ['S3.1', 'The periodic table: classification of elements'], ['S3.2', 'Functional groups: classification of organic compounds']]),
      sec('Reactivity 1 · What drives chemical reactions?', [
        ['R1.1', 'Measuring enthalpy changes'], ['R1.2', 'Energy cycles in reactions'], ['R1.3', 'Energy from fuels'], ['R1.4', 'Entropy and spontaneity', 1]]),
      sec('Reactivity 2 · How much, how fast and how far?', [
        ['R2.1', 'How much? The amount of chemical change'], ['R2.2', 'How fast? The rate of chemical change'], ['R2.3', 'How far? The extent of chemical change']]),
      sec('Reactivity 3 · What are the mechanisms of chemical change?', [
        ['R3.1', 'Proton transfer reactions'], ['R3.2', 'Electron transfer reactions'], ['R3.3', 'Electron sharing reactions'], ['R3.4', 'Electron-pair sharing reactions']])) },

    { id: 'physics', name: 'Physics', group: 'Sciences', aliases: ['phys'], units: units(
      sec('A · Space, time and motion', [
        ['A.1', 'Kinematics'], ['A.2', 'Forces and momentum'], ['A.3', 'Work, energy and power'], ['A.4', 'Rigid body mechanics', 1], ['A.5', 'Galilean and special relativity', 1]]),
      sec('B · The particulate nature of matter', [
        ['B.1', 'Thermal energy transfers'], ['B.2', 'Greenhouse effect'], ['B.3', 'Gas laws'], ['B.4', 'Thermodynamics', 1], ['B.5', 'Current and circuits']]),
      sec('C · Wave behaviour', [
        ['C.1', 'Simple harmonic motion'], ['C.2', 'Wave model'], ['C.3', 'Wave phenomena'], ['C.4', 'Standing waves and resonance'], ['C.5', 'Doppler effect']]),
      sec('D · Fields', [
        ['D.1', 'Gravitational fields'], ['D.2', 'Electric and magnetic fields'], ['D.3', 'Motion in electromagnetic fields'], ['D.4', 'Induction', 1]]),
      sec('E · Nuclear and quantum physics', [
        ['E.1', 'Structure of the atom'], ['E.2', 'Quantum physics', 1], ['E.3', 'Radioactive decay'], ['E.4', 'Fission'], ['E.5', 'Fusion and stars']])) },

    { id: 'ess', name: 'Environmental Systems and Societies', group: 'Sciences', aliases: ['ess', 'environmental systems'], units: units(
      sec('1 · Foundation', [['1.1', 'Perspectives'], ['1.2', 'Systems'], ['1.3', 'Sustainability']]),
      sec('2 · Ecology', [['2.1', 'Individuals, populations, communities and ecosystems'], ['2.2', 'Energy and biomass in ecosystems'], ['2.3', 'Biogeochemical cycles'], ['2.4', 'Climate and biomes'], ['2.5', 'Zonation, succession and change in ecosystems']]),
      sec('3 · Biodiversity and conservation', [['3.1', 'Biodiversity and evolution'], ['3.2', 'Human impact on biodiversity'], ['3.3', 'Conservation and regeneration']]),
      sec('4 · Water', [['4.1', 'Water systems'], ['4.2', 'Water access, use and security'], ['4.3', 'Aquatic food production systems'], ['4.4', 'Water pollution']]),
      sec('5 · Land', [['5.1', 'Soil'], ['5.2', 'Agriculture and food']]),
      sec('6 · Atmosphere and climate change', [['6.1', 'Introduction to the atmosphere'], ['6.2', 'Climate change: causes and impacts'], ['6.3', 'Climate change: mitigation and adaptation'], ['6.4', 'Stratospheric ozone']]),
      sec('7 · Natural resources', [['7.1', 'Natural resources: uses and management'], ['7.2', 'Energy sources: uses and management'], ['7.3', 'Solid waste']]),
      sec('8 · Human populations and urban systems', [['8.1', 'Human populations'], ['8.2', 'Urban systems and urban planning'], ['8.3', 'Urban air pollution']])) },

    { id: 'math-aa', name: 'Mathematics: Analysis and Approaches', group: 'Mathematics', aliases: ['analysis', 'math aa', 'maths aa', 'aa hl', 'aa sl', 'mathematics aa'], units: units(
      sec('1 · Number and algebra', [
        ['1', 'Scientific notation'], ['1', 'Arithmetic sequences and series'], ['1', 'Geometric sequences and series'], ['1', 'Financial applications'],
        ['1', 'Exponents and logarithms'], ['1', 'Simple deductive proof'], ['1', 'Infinite geometric series'], ['1', 'The binomial theorem'],
        ['1', 'Counting principles, permutations and combinations', 1], ['1', 'Partial fractions', 1], ['1', 'Complex numbers', 1],
        ['1', 'Polar and Euler form; De Moivre’s theorem', 1], ['1', 'Proof by induction, contradiction and counterexample', 1], ['1', 'Systems of linear equations', 1]]),
      sec('2 · Functions', [
        ['2', 'Equations of straight lines'], ['2', 'Functions: domain, range and inverse'], ['2', 'Graphing functions'], ['2', 'Composite functions'],
        ['2', 'Quadratic functions'], ['2', 'Rational functions'], ['2', 'Exponential and logarithmic functions'], ['2', 'Solving equations'],
        ['2', 'Transformations of graphs'], ['2', 'Polynomial functions and the factor and remainder theorems', 1], ['2', 'Odd and even functions', 1],
        ['2', 'Modulus functions and inequalities', 1]]),
      sec('3 · Geometry and trigonometry', [
        ['3', 'Distance, midpoint, volume and surface area'], ['3', 'Right-angled and non-right-angled trigonometry'], ['3', 'Bearings and angles of elevation'],
        ['3', 'Radians, arcs and sectors'], ['3', 'The unit circle and exact values'], ['3', 'Trigonometric identities and equations'], ['3', 'Trigonometric functions and their graphs'],
        ['3', 'Reciprocal and inverse trigonometric functions', 1], ['3', 'Compound angle identities', 1], ['3', 'Vectors', 1],
        ['3', 'Vector equations of lines and planes', 1], ['3', 'Scalar and vector products', 1]]),
      sec('4 · Statistics and probability', [
        ['4', 'Sampling and data'], ['4', 'Statistical diagrams'], ['4', 'Measures of central tendency and dispersion'], ['4', 'Correlation and regression'],
        ['4', 'Probability and Venn diagrams'], ['4', 'Conditional probability and independence'], ['4', 'Discrete random variables'], ['4', 'The binomial distribution'],
        ['4', 'The normal distribution'], ['4', 'Bayes’ theorem', 1], ['4', 'Continuous random variables', 1]]),
      sec('5 · Calculus', [
        ['5', 'Limits and the derivative'], ['5', 'Increasing and decreasing functions'], ['5', 'Differentiation rules'], ['5', 'Tangents and normals'],
        ['5', 'Stationary points and optimisation'], ['5', 'Integration and areas'], ['5', 'Kinematics'], ['5', 'Continuity and differentiability; first principles', 1],
        ['5', 'Implicit differentiation and related rates', 1], ['5', 'Integration by substitution and by parts', 1], ['5', 'Volumes of revolution', 1],
        ['5', 'Differential equations', 1], ['5', 'Maclaurin series', 1]])) },

    { id: 'math-ai', name: 'Mathematics: Applications and Interpretation', group: 'Mathematics', aliases: ['math ai', 'maths ai', 'ai hl', 'ai sl', 'applications'], units: units(
      sec('1 · Number and algebra', [
        ['1', 'Scientific notation and approximation'], ['1', 'Arithmetic and geometric sequences'], ['1', 'Financial mathematics: loans, interest, annuities'],
        ['1', 'Exponents and logarithms'], ['1', 'Laws of logarithms', 1], ['1', 'Complex numbers', 1], ['1', 'Matrices', 1], ['1', 'Eigenvalues and eigenvectors', 1]]),
      sec('2 · Functions', [
        ['2', 'Linear models'], ['2', 'Functions and their graphs'], ['2', 'Modelling: linear, quadratic, exponential, direct and inverse variation, cubic, sinusoidal'],
        ['2', 'Composite and inverse functions', 1], ['2', 'Transformations of graphs', 1], ['2', 'Logistic and piecewise models', 1], ['2', 'Linearizing data with logarithms', 1]]),
      sec('3 · Geometry and trigonometry', [
        ['3', 'Volume, surface area and 3D distances'], ['3', 'Trigonometry in right-angled and non-right-angled triangles'], ['3', 'Arcs and sectors'],
        ['3', 'Voronoi diagrams'], ['3', 'Vectors and their applications', 1], ['3', 'Matrix transformations', 1], ['3', 'Graph theory', 1]]),
      sec('4 · Statistics and probability', [
        ['4', 'Sampling and collecting data'], ['4', 'Statistical diagrams and summary statistics'], ['4', 'Correlation and regression'], ['4', 'Probability'],
        ['4', 'Discrete distributions and the binomial'], ['4', 'The normal distribution'], ['4', 'Chi-squared tests'], ['4', 'Spearman’s rank correlation'],
        ['4', 'Hypothesis testing and confidence intervals', 1], ['4', 'Poisson distribution', 1], ['4', 'Combining random variables', 1], ['4', 'Markov chains', 1]]),
      sec('5 · Calculus', [
        ['5', 'Introduction to differentiation'], ['5', 'Tangents, normals and optimisation'], ['5', 'Introduction to integration and the trapezoidal rule'],
        ['5', 'Further differentiation and integration', 1], ['5', 'Kinematics', 1], ['5', 'Differential equations and slope fields', 1], ['5', 'Euler’s method and coupled systems', 1]])) },

    { id: 'economics', name: 'Economics', group: 'Individuals and Societies', aliases: ['econ'], units: units(
      sec('1 · Introduction to economics', [['1.1', 'What is economics?'], ['1.2', 'How do economists approach the world?']]),
      sec('2 · Microeconomics', [
        ['2.1', 'Demand'], ['2.2', 'Supply'], ['2.3', 'Competitive market equilibrium'], ['2.4', 'Critique of the maximizing behaviour of consumers and producers'],
        ['2.5', 'Elasticity of demand'], ['2.6', 'Elasticity of supply'], ['2.7', 'Role of government in microeconomics'],
        ['2.8', 'Market failure: externalities and common pool or common access resources'], ['2.9', 'Market failure: public goods'],
        ['2.10', 'Market failure: asymmetric information', 1], ['2.11', 'Market failure: market power', 1], ['2.12', 'The market’s inability to achieve equity', 1]]),
      sec('3 · Macroeconomics', [
        ['3.1', 'Measuring economic activity and illustrating its variations'], ['3.2', 'Variations in economic activity: aggregate demand and aggregate supply'],
        ['3.3', 'Macroeconomic objectives'], ['3.4', 'Economics of inequality and poverty'], ['3.5', 'Demand management: monetary policy'],
        ['3.6', 'Demand management: fiscal policy'], ['3.7', 'Supply-side policies']]),
      sec('4 · The global economy', [
        ['4.1', 'Benefits of international trade'], ['4.2', 'Types of trade protection'], ['4.3', 'Arguments for and against trade control/protection'],
        ['4.4', 'Economic integration'], ['4.5', 'Exchange rates'], ['4.6', 'Balance of payments'], ['4.7', 'Sustainable development'],
        ['4.8', 'Measuring development'], ['4.9', 'Barriers to economic growth and/or economic development'], ['4.10', 'Economic growth and/or economic development strategies']])) },

    { id: 'global-politics', name: 'Global Politics', group: 'Individuals and Societies', aliases: ['glopo', 'glo po', 'gp'], units: units(
      sec('Core · Understanding power and global politics', [
        ['Core', 'Power'], ['Core', 'Sovereignty'], ['Core', 'Legitimacy'], ['Core', 'Interdependence'], ['Core', 'Global governance and international relations'],
        ['Core', 'Political theories: realism, liberalism, constructivism and others']]),
      sec('Thematic studies', [['TS1', 'Rights and justice'], ['TS2', 'Development and sustainability'], ['TS3', 'Peace and conflict']]),
      sec('HL extension · Global political challenges', [
        ['HL', 'Borders', 1], ['HL', 'Environment', 1], ['HL', 'Equality', 1], ['HL', 'Health', 1], ['HL', 'Identity', 1],
        ['HL', 'Poverty', 1], ['HL', 'Security', 1], ['HL', 'Technology', 1]]),
      sec('Assessment', [['P1', 'Paper 1: stimulus-based questions'], ['P2', 'Paper 2: extended response essays'], ['IA', 'Engagement activity'], ['P3', 'Paper 3: HL extension', 1]])) },

    { id: 'history', name: 'History', group: 'Individuals and Societies', aliases: ['hist'], units: units(
      sec('Prescribed subjects (Paper 1)', [
        ['PS1', 'Military leaders'], ['PS2', 'Conquest and its impact'], ['PS3', 'The move to global war'], ['PS4', 'Rights and protest'], ['PS5', 'Conflict and intervention']]),
      sec('World history topics (Paper 2)', [
        ['WH1', 'Society and economy (750–1400)'], ['WH2', 'Causes and effects of medieval wars (750–1500)'], ['WH3', 'Dynasties and rulers (750–1500)'],
        ['WH4', 'Societies in transition (1400–1700)'], ['WH5', 'Early modern states (1450–1789)'], ['WH6', 'Causes and effects of early modern wars (1500–1750)'],
        ['WH7', 'Origins, development and impact of industrialization (1750–2005)'], ['WH8', 'Independence movements (1800–2000)'],
        ['WH9', 'Evolution and development of democratic states (1848–2000)'], ['WH10', 'Authoritarian states (20th century)'],
        ['WH11', 'Causes and effects of 20th-century wars'], ['WH12', 'The Cold War: superpower tensions and rivalries (20th century)']]),
      sec('HL regional options (Paper 3)', [
        ['R1', 'History of Africa and the Middle East', 1], ['R2', 'History of the Americas', 1], ['R3', 'History of Asia and Oceania', 1], ['R4', 'History of Europe', 1]]),
      sec('Assessment', [['IA', 'Historical investigation']])) },

    { id: 'psychology', name: 'Psychology', group: 'Individuals and Societies', aliases: ['psych'], units: units(
      sec('Concepts', [['C', 'Bias'], ['C', 'Causality'], ['C', 'Change'], ['C', 'Measurement'], ['C', 'Perspective'], ['C', 'Responsibility']]),
      sec('Content', [['A', 'The biological approach'], ['A', 'The cognitive approach'], ['A', 'The sociocultural approach'], ['A', 'Research methods and data']]),
      sec('Contexts', [['X', 'Health and well-being'], ['X', 'Human development'], ['X', 'Human relationships'], ['X', 'Learning and cognition']]),
      sec('Assessment', [['P1', 'Paper 1'], ['P2', 'Paper 2'], ['P3', 'Paper 3: HL', 1], ['IA', 'Internal assessment: research proposal and report']])) },

    { id: 'business', name: 'Business Management', group: 'Individuals and Societies', aliases: ['bm', 'business'], units: units(
      sec('1 · Introduction to business management', [['1.1', 'Introduction to business management'], ['1.2', 'Types of business entities'], ['1.3', 'Business objectives'], ['1.4', 'Stakeholders'], ['1.5', 'Growth and evolution'], ['1.6', 'Multinational companies']]),
      sec('2 · Human resource management', [['2.1', 'Introduction to human resource management'], ['2.2', 'Organizational structure'], ['2.3', 'Leadership and management'], ['2.4', 'Motivation and demotivation'], ['2.5', 'Organizational culture', 1], ['2.6', 'Communication'], ['2.7', 'Industrial/employee relations', 1]]),
      sec('3 · Finance and accounts', [['3.1', 'Introduction to finance'], ['3.2', 'Sources of finance'], ['3.3', 'Costs and revenues'], ['3.4', 'Final accounts'], ['3.5', 'Profitability and liquidity ratio analysis'], ['3.6', 'Debt/equity ratio analysis', 1], ['3.7', 'Cash flow'], ['3.8', 'Investment appraisal'], ['3.9', 'Budgets', 1]]),
      sec('4 · Marketing', [['4.1', 'Introduction to marketing'], ['4.2', 'Marketing planning'], ['4.3', 'Sales forecasting', 1], ['4.4', 'Market research'], ['4.5', 'The seven Ps of the marketing mix'], ['4.6', 'International marketing', 1]]),
      sec('5 · Operations management', [['5.1', 'Introduction to operations management'], ['5.2', 'Operations methods'], ['5.3', 'Lean production and quality management', 1], ['5.4', 'Location'], ['5.5', 'Break-even analysis'], ['5.6', 'Production planning', 1], ['5.7', 'Crisis management and contingency planning', 1], ['5.8', 'Research and development', 1], ['5.9', 'Management information systems', 1]])) },

    { id: 'geography', name: 'Geography', group: 'Individuals and Societies', aliases: ['geo'], units: units(
      sec('Geographic themes (Paper 1 options)', [['A', 'Freshwater: drainage basins'], ['B', 'Oceans and coastal margins'], ['C', 'Extreme environments'], ['D', 'Geophysical hazards'], ['E', 'Leisure, tourism and sport'], ['F', 'Food and health'], ['G', 'Urban environments']]),
      sec('Core (Paper 2)', [['1', 'Changing population'], ['2', 'Global climate: vulnerability and resilience'], ['3', 'Global resource consumption and security']]),
      sec('HL core extension (Paper 3)', [['HL', 'Power, places and networks', 1], ['HL', 'Human development and diversity', 1], ['HL', 'Global risks and resilience', 1]]),
      sec('Assessment', [['IA', 'Fieldwork']])) },

    { id: 'cs', name: 'Computer Science', group: 'Sciences', aliases: ['computer science', 'comp sci'], units: units(
      sec('A · Concepts of computer science', [['A1', 'Computer fundamentals'], ['A2', 'Networks'], ['A3', 'Databases'], ['A4', 'Machine learning']]),
      sec('B · Computational thinking and problem-solving', [['B1', 'Computational thinking'], ['B2', 'Programming'], ['B3', 'Object-oriented programming'], ['B4', 'Abstract data types', 1]]),
      sec('Assessment', [['P1', 'Paper 1'], ['P2', 'Paper 2'], ['IA', 'Computational solution']])) },

    { id: 'english-lit', name: 'English A: Literature', group: 'Language and Literature', aliases: ['literature', 'english lit', 'lit'], units: units(
      sec('Areas of exploration', [['AE1', 'Readers, writers and texts'], ['AE2', 'Time and space'], ['AE3', 'Intertextuality: connecting texts']]),
      sec('Assessment', [['P1', 'Paper 1: guided literary analysis'], ['P2', 'Paper 2: comparative essay'], ['IO', 'Individual oral'], ['HLE', 'HL essay', 1]])) },
    { id: 'english-langlit', name: 'English A: Language and Literature', group: 'Language and Literature', aliases: ['lang and lit', 'language and literature', 'lang lit'], units: units(
      sec('Areas of exploration', [['AE1', 'Readers, writers and texts'], ['AE2', 'Time and space'], ['AE3', 'Intertextuality: connecting texts']]),
      sec('Assessment', [['P1', 'Paper 1: guided textual analysis (non-literary)'], ['P2', 'Paper 2: comparative essay'], ['IO', 'Individual oral'], ['HLE', 'HL essay', 1]])) },
    { id: 'french-b', name: 'French B', group: 'Language Acquisition', aliases: ['french', 'francais', 'français'], units: langB() },
    { id: 'spanish-b', name: 'Spanish B', group: 'Language Acquisition', aliases: ['spanish', 'espanol', 'español'], units: langB() },
    { id: 'german-b', name: 'German B', group: 'Language Acquisition', aliases: ['german', 'deutsch'], units: langB() },

    { id: 'visual-arts', name: 'Visual Arts', group: 'The Arts', aliases: ['art', 'visual art'], units: units(
      sec('Areas of inquiry', [['AI', 'Communicating visually'], ['AI', 'Lenses: identities and relationships'], ['AI', 'Lenses: environments'], ['AI', 'Lenses: past, present and future']]),
      sec('Assessment', [['A1', 'Art-making inquiries portfolio'], ['A2', 'Connections study'], ['A3', 'Resolved artworks'], ['A4', 'Selected resolved artworks and exhibition text', 1]])) },
    { id: 'music', name: 'Music', group: 'The Arts', aliases: [], units: units(
      sec('Areas of inquiry', [['AI1', 'Music for sociocultural and political expression'], ['AI2', 'Music for listening and performance'], ['AI3', 'Music for dramatic impact, movement and entertainment'], ['AI4', 'Music technology in the electronic and digital age']]),
      sec('Assessment', [['EM', 'Exploring music in context'], ['EX', 'Experimenting with music'], ['PR', 'Presenting music'], ['CP', 'The contemporary music-maker', 1]])) },

    { id: 'tok', name: 'Theory of Knowledge', group: 'Core', aliases: ['tok'], units: units(
      sec('Core theme', [['Core', 'Knowledge and the knower']]),
      sec('Optional themes', [['OT', 'Knowledge and technology'], ['OT', 'Knowledge and language'], ['OT', 'Knowledge and politics'], ['OT', 'Knowledge and religion'], ['OT', 'Knowledge and Indigenous societies']]),
      sec('Areas of knowledge', [['AOK', 'History'], ['AOK', 'The human sciences'], ['AOK', 'The natural sciences'], ['AOK', 'Mathematics'], ['AOK', 'The arts']]),
      sec('Assessment', [['EX', 'TOK exhibition'], ['ES', 'TOK essay on a prescribed title']])) },

    /* ── MYP ──────────────────────────────────────────────────────────────
       The MYP prescribes no content units: schools write their own. What it
       does prescribe is the same for every school — the four assessment
       criteria of each subject group, the key concepts named for it, and the
       six global contexts — so that is what is listed, with the usual content
       strands where a subject guide names them. */
    myp('myp-langlit', 'MYP Language and Literature', ['language and literature', 'myp english'], ['Analysing', 'Organizing', 'Producing text', 'Using language'], ['Communication', 'Connections', 'Creativity', 'Perspective'], [
      ['C', 'Reading and analysing fiction'], ['C', 'Poetry'], ['C', 'Drama'], ['C', 'Non-fiction and media texts'], ['C', 'Writing for purpose and audience']]),
    myp('myp-langacq', 'MYP Language Acquisition', ['language acquisition', 'myp french', 'myp spanish'], ['Listening', 'Reading', 'Speaking', 'Writing'], ['Communication', 'Connections', 'Creativity', 'Culture'], [
      ['C', 'Personal identity and daily routine'], ['C', 'School and education'], ['C', 'Family and relationships'], ['C', 'Food, health and well-being'], ['C', 'Travel and places'], ['C', 'Environment and global issues']]),
    myp('myp-ins', 'MYP Individuals and Societies', ['individuals and societies', 'myp humanities', 'i&s'], ['Knowing and understanding', 'Investigating', 'Communicating', 'Thinking critically'], ['Change', 'Global interactions', 'Systems', 'Time, place and space'], [
      ['C', 'Historical sources and evidence'], ['C', 'Maps, places and environments'], ['C', 'Economic systems and choices'], ['C', 'Government and citizenship'], ['C', 'Migration and population'], ['C', 'Conflict and cooperation']]),
    myp('myp-sciences', 'MYP Sciences', ['myp science', 'integrated sciences'], ['Knowing and understanding', 'Inquiring and designing', 'Processing and evaluating', 'Reflecting on the impacts of science'], ['Change', 'Relationships', 'Systems'], [
      ['C', 'Cells and living things'], ['C', 'Genetics and inheritance'], ['C', 'Ecosystems'], ['C', 'Particles and the periodic table'], ['C', 'Chemical reactions'], ['C', 'Acids and bases'], ['C', 'Forces and motion'], ['C', 'Energy'], ['C', 'Electricity'], ['C', 'Waves, light and sound']]),
    myp('myp-maths', 'MYP Mathematics', ['myp math', 'myp maths'], ['Knowing and understanding', 'Investigating patterns', 'Communicating', 'Applying mathematics in real-life contexts'], ['Form', 'Logic', 'Relationships'], [
      ['C', 'Number'], ['C', 'Algebra'], ['C', 'Geometry and trigonometry'], ['C', 'Statistics and probability']]),
    myp('myp-arts', 'MYP Arts', ['myp art', 'myp music', 'myp drama'], ['Investigating', 'Developing', 'Creating or performing', 'Evaluating'], ['Aesthetics', 'Change', 'Communication', 'Identity'], []),
    myp('myp-phe', 'MYP Physical and Health Education', ['phe', 'pe'], ['Knowing and understanding', 'Planning for performance', 'Applying and performing', 'Reflecting and improving performance'], ['Change', 'Communication', 'Relationships'], [
      ['C', 'Fitness and training principles'], ['C', 'Health and nutrition'], ['C', 'Skills and tactics']]),
    myp('myp-design', 'MYP Design', ['design', 'myp design'], ['Inquiring and analysing', 'Developing ideas', 'Creating the solution', 'Evaluating'], ['Communication', 'Communities', 'Development', 'Systems'], [
      ['C', 'The design cycle']]),
    { id: 'myp-pp', name: 'MYP Personal Project', group: 'MYP', programme: 'MYP', aliases: ['personal project', 'pp'], units: units(
      sec('Assessment criteria', [['A', 'Criterion A: Planning'], ['B', 'Criterion B: Applying skills'], ['C', 'Criterion C: Reflecting']]),
      sec('Process', [['P', 'Choosing a learning goal and product'], ['P', 'The process journal'], ['P', 'The final report']])) },
  ];

  function myp(id, name, aliases, criteria, concepts, content) {
    var gc = ['Identities and relationships', 'Orientation in space and time', 'Personal and cultural expression', 'Scientific and technical innovation', 'Globalization and sustainability', 'Fairness and development'];
    return { id: id, name: name, group: 'MYP', programme: 'MYP', aliases: aliases, units: units(
      sec('Assessment criteria', criteria.map(function (c, i) { return ['ABCD'[i], 'Criterion ' + 'ABCD'[i] + ': ' + c]; })),
      sec('Key concepts', concepts.map(function (c) { return ['KC', c]; })),
      sec('Global contexts', gc.map(function (c) { return ['GC', c]; })),
      content.length ? sec('Content', content) : []) };
  }

  function langB() {
    return units(
      sec('Themes', [['T1', 'Identities'], ['T2', 'Experiences'], ['T3', 'Human ingenuity'], ['T4', 'Social organization'], ['T5', 'Sharing the planet']]),
      sec('Assessment', [['P1', 'Paper 1: writing'], ['P2', 'Paper 2: listening and reading'], ['IA', 'Individual oral'], ['LIT', 'Literary works', 1]]));
  }

  // Stable ids: subject id + position, so renaming a unit keeps the sets filed under it.
  SUBJECTS.forEach(function (s) {
    s.units.forEach(function (u, i) { u.id = s.id + ':' + (/^[A-Z]?\d|^[A-Z]\.\d|^[A-Z]{1,3}\d/.test(u.code) && !/^\d+$/.test(u.code) ? u.code : String(i + 1)); });
  });

  function fold(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }

  /** The subject a free-typed name means ("Analysis", "Bio", "Glo Po"), or null. */
  function find(name) {
    var f = fold(name);
    if (!f) return null;
    for (var i = 0; i < SUBJECTS.length; i++) {
      var s = SUBJECTS[i];
      if (fold(s.name) === f || s.id === f || s.aliases.some(function (a) { return fold(a) === f; })) return s;
    }
    for (var j = 0; j < SUBJECTS.length; j++) {
      var t = SUBJECTS[j];
      if (fold(t.name).indexOf(f) === 0 || t.aliases.some(function (a) { return f.indexOf(fold(a)) === 0 || fold(a).indexOf(f) === 0; })) return t;
    }
    return null;
  }
  function unit(id) {
    var sid = String(id || '').split(':')[0];
    var s = SUBJECTS.filter(function (x) { return x.id === sid; })[0];
    return s ? s.units.filter(function (u) { return u.id === id; })[0] || null : null;
  }
  /** "A1.1 Water", "2.5 Elasticity of demand", "WH10 Authoritarian states…"; a bare topic number is left off. */
  function label(u) { return u ? (/\d/.test(u.code) && !/^\d+$/.test(u.code) ? u.code + ' ' : '') + u.title : ''; }

  root.FluxIbSyllabus = { subjects: function () { return SUBJECTS; }, find: find, unit: unit, label: label };
})();
