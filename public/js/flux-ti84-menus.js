/* ════════════════════════════════════════════════════════════════════════
   FLUX · Calculator menus — flux-ti84-menus.js
   ------------------------------------------------------------------------
   Every menu the keys open, as data, in the calculator's own order so the
   numbers match a student's muscle memory: MATH ▸ 1:▶Frac, 2nd TEST ▸
   LOGIC ▸ 1:and, STAT ▸ CALC ▸ 4:LinReg(ax+b)…

   An item is { l: label, … } plus one of:
     ins: code         paste these tokens (flux-ti84-engine.js codes)
     tpl: 'frac' …     a MathPrint template (with ins as the CLASSIC fallback)
     act: 'name:arg'   something the calculator does (open a screen, a form)
     sub: 'MENU'       another menu
   ════════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const I = (l, ins) => ({ l: l, ins: ins == null ? l : ins });
  const L = ['L₁', 'L₂', 'L₃', 'L₄', 'L₅', 'L₆'];
  const MATS = 'ABCDEFGHIJ'.split('');
  const Y = ['Y₁', 'Y₂', 'Y₃', 'Y₄', 'Y₅', 'Y₆', 'Y₇', 'Y₈', 'Y₉', 'Y₀'];
  const sys = (l, name) => ({ l: l, ins: '⟨' + (name || l) + '⟩' });

  const MENUS = {
    MATH: [
      { name: 'MATH', items: [
        I('▶Frac'), I('▶Dec'), I('³'), { l: '³√(', tpl: 'nroot', pre: '3', ins: '∛(' }, { l: 'ˣ√', tpl: 'nroot', ins: 'ˣ√' },
        I('fMin('), I('fMax('), { l: 'nDeriv(', tpl: 'deriv', ins: 'nDeriv(' }, { l: 'fnInt(', tpl: 'int', ins: 'fnInt(' },
        { l: 'summation Σ(', tpl: 'sum', ins: 'Σ(' }, { l: 'logBASE(', tpl: 'logb', ins: 'logBASE(' }, { l: 'Solver…', act: 'solver' },
      ] },
      { name: 'NUM', items: [
        { l: 'abs(', tpl: 'abs', ins: 'abs(' }, I('round('), I('iPart('), I('fPart('), I('int('), I('min('), I('max('),
        I('lcm('), I('gcd('), I('remainder('), I('▶n/d◀▶Un/d'), I('▶F◀▶D'), { l: 'Un/d', tpl: 'mixed', ins: '+' }, { l: 'n/d', tpl: 'frac', ins: '/' },
      ] },
      { name: 'CMPLX', items: [I('conj('), I('real('), I('imag('), I('angle('), { l: 'abs(', tpl: 'abs', ins: 'abs(' }, I('▶Rect'), I('▶Polar'), { l: 'e^(', tpl: 'exp', ins: 'e^(' }] },
      { name: 'PROB', items: [I('rand'), I('nPr', ' nPr '), I('nCr', ' nCr '), I('!'), I('randInt('), I('randNorm('), I('randBin('), I('randIntNoRep(')] },
      { name: 'FRAC', items: [{ l: 'n/d', tpl: 'frac', ins: '/' }, { l: 'Un/d', tpl: 'mixed', ins: '+' }, I('▶F◀▶D'), I('▶n/d◀▶Un/d')] },
    ],
    TEST: [
      { name: 'TEST', items: [I('='), I('≠'), I('>'), I('≥'), I('<'), I('≤')] },
      { name: 'LOGIC', items: [I('and', ' and '), I('or', ' or '), I('xor', ' xor '), I('not(')] },
    ],
    ANGLE: [
      { name: 'ANGLE', items: [I('°'), I('′'), I('ʳ'), I('▶DMS'), I('R▶Pr('), I('R▶Pθ('), I('P▶Rx('), I('P▶Ry(')] },
    ],
    LIST: [
      { name: 'NAMES', dyn: 'listNames' },
      { name: 'OPS', items: [I('SortA('), I('SortD('), I('dim('), I('Fill('), I('seq('), I('cumSum('), I('ΔList('),
        I('augment('), I('List▶matr('), I('Matr▶list('), { l: 'ʟ', ins: 'ʟ' }] },
      { name: 'MATH', items: [I('min('), I('max('), I('mean('), I('median('), I('sum('), I('prod('), I('stdDev('), I('variance(')] },
    ],
    MATRIX: [
      { name: 'NAMES', dyn: 'matNames' },
      { name: 'MATH', items: [I('det('), I('ᵀ'), I('dim('), I('Fill('), I('identity('), I('randM('), I('augment('),
        I('Matr▶list('), I('List▶matr('), I('cumSum('), I('ref('), I('rref('), I('rowSwap('), I('row+('), I('*row('), I('*row+(')] },
      { name: 'EDIT', dyn: 'matEdit' },
    ],
    DISTR: [
      { name: 'DISTR', items: ['normalpdf(', 'normalcdf(', 'invNorm(', 'invT(', 'tpdf(', 'tcdf(', 'χ²pdf(', 'χ²cdf(', 'Fpdf(',
        'Fcdf(', 'binompdf(', 'binomcdf(', 'invBinom(', 'poissonpdf(', 'poissoncdf(', 'geometpdf(', 'geometcdf(']
        .map((f) => ({ l: f, ins: f, wiz: f })) },
      { name: 'DRAW', items: [I('ShadeNorm('), I('Shade_t('), I('Shadeχ²('), I('ShadeF(')] },
    ],
    STAT: [
      { name: 'EDIT', items: [{ l: 'Edit…', act: 'listEditor' }, I('SortA('), I('SortD('), I('ClrList', 'ClrList '), I('SetUpEditor')] },
      { name: 'CALC', items: ['1-Var Stats', '2-Var Stats', 'Med-Med', 'LinReg(ax+b)', 'QuadReg', 'CubicReg', 'QuartReg',
        'LinReg(a+bx)', 'LnReg', 'ExpReg', 'PwrReg', 'Logistic', 'SinReg'].map((c) => ({ l: c, ins: c + ' ', wiz: c })) },
      { name: 'TESTS', items: [
        ['Z-Test…', 'ztest'], ['T-Test…', 'ttest'], ['2-SampZTest…', 'z2test'], ['2-SampTTest…', 't2test'],
        ['1-PropZTest…', 'p1test'], ['2-PropZTest…', 'p2test'], ['ZInterval…', 'zint'], ['TInterval…', 'tint'],
        ['2-SampZInt…', 'z2int'], ['2-SampTInt…', 't2int'], ['1-PropZInt…', 'p1int'], ['2-PropZInt…', 'p2int'],
        ['χ²-Test…', 'chi2'], ['χ²GOF-Test…', 'chi2gof'], ['2-SampFTest…', 'ftest'], ['LinRegTTest…', 'lrttest'],
        ['LinRegTInt…', 'lrtint'], ['ANOVA(', 'anova'],
      ].map((p) => ({ l: p[0], act: 'test:' + p[1] })) },
    ],
    VARS: [
      { name: 'VARS', items: [{ l: 'Window…', sub: 'VWIN' }, { l: 'Statistics…', sub: 'VSTAT' }, { l: 'Table…', sub: 'VTBL' }, { l: 'String…', sub: 'VSTR' }] },
      { name: 'Y-VARS', items: [{ l: 'Function…', sub: 'VFUNC' }, { l: 'Parametric…', sub: 'VPAR' }, { l: 'Polar…', sub: 'VPOL' }, { l: 'On/Off…', sub: 'VONOFF' }] },
    ],
    VWIN: [
      { name: 'X/Y', items: ['Xmin', 'Xmax', 'Xscl', 'Ymin', 'Ymax', 'Yscl', 'Xres', 'ΔX', 'ΔY', 'XFact', 'YFact'].map((n) => sys(n)) },
      { name: 'T/θ', items: ['Tmin', 'Tmax', 'Tstep', 'θmin', 'θmax', 'θstep'].map((n) => sys(n)) },
    ],
    VSTAT: [
      { name: 'XY', items: ['n', 'x̄', 'Sx', 'σx', 'ȳ', 'Sy', 'σy', 'minX', 'maxX', 'minY', 'maxY'].map((n) => sys(n)) },
      { name: 'Σ', items: ['Σx', 'Σx²', 'Σy', 'Σy²', 'Σxy'].map((n) => sys(n)) },
      { name: 'EQ', items: ['RegEQ', 'a', 'b', 'c', 'd', 'e', 'r', 'r²', 'R²'].map((n) => sys(n)) },
      { name: 'TEST', items: ['p', 'z', 't', 'χ²', 'F', 'df', 'p̂', 'p̂1', 'p̂2', 's', 'x̄1', 'x̄2', 'Sx1', 'Sx2', 'Sxp', 'n1', 'n2', 'lower', 'upper'].map((n) => sys(n)) },
      { name: 'PTS', items: ['Q1', 'Med', 'Q3'].map((n) => sys(n)) },
    ],
    VTBL: [{ name: 'TABLE', items: [sys('TblStart'), sys('ΔTbl')] }],
    VSTR: [{ name: 'STRING', items: ['Str1', 'Str2', 'Str3', 'Str4', 'Str5', 'Str6', 'Str7', 'Str8', 'Str9', 'Str0'].map((n) => sys(n)) }],
    VFUNC: [{ name: 'FUNCTION', items: Y.map((n) => I(n)) }],
    VPAR: [{ name: 'PARAMETRIC', items: ['X₁ᴛ', 'Y₁ᴛ', 'X₂ᴛ', 'Y₂ᴛ', 'X₃ᴛ', 'Y₃ᴛ', 'X₄ᴛ', 'Y₄ᴛ', 'X₅ᴛ', 'Y₅ᴛ', 'X₆ᴛ', 'Y₆ᴛ'].map((n) => I(n)) }],
    VPOL: [{ name: 'POLAR', items: ['r₁', 'r₂', 'r₃', 'r₄', 'r₅', 'r₆'].map((n) => I(n)) }],
    VONOFF: [{ name: 'ON/OFF', items: [I('FnOn', 'FnOn '), I('FnOff', 'FnOff ')] }],
    PRGM: [
      { name: 'EXEC', dyn: 'prgmExec' },
      { name: 'EDIT', dyn: 'prgmEdit' },
      { name: 'NEW', items: [{ l: 'Create New', act: 'prgmNew' }] },
    ],
    PRGMED: [
      { name: 'CTL', items: [I('If', 'If '), I('Then'), I('Else'), I('For('), I('While', 'While '), I('Repeat', 'Repeat '), I('End'),
        I('Pause', 'Pause '), I('Lbl', 'Lbl '), I('Goto', 'Goto '), I('IS>('), I('DS<('), I('Menu('), I('prgm'), I('Return'), I('Stop'), I('DelVar', 'DelVar ')] },
      { name: 'I/O', items: [I('Input', 'Input '), I('Prompt', 'Prompt '), I('Disp', 'Disp '), I('DispGraph'), I('DispTable'), I('Output('),
        I('getKey'), I('ClrHome'), I('ClrTable')] },
      { name: 'EXEC', dyn: 'prgmCall' },
    ],
    DRAW: [
      { name: 'DRAW', items: [I('ClrDraw'), I('Line('), I('Horizontal', 'Horizontal '), I('Vertical', 'Vertical '), I('Tangent('),
        I('DrawF', 'DrawF '), I('Shade('), I('DrawInv', 'DrawInv '), I('Circle('), I('Text(')] },
      { name: 'POINTS', items: [I('Pt-On('), I('Pt-Off('), I('Pt-Change(')] },
    ],
    ZOOM: [
      { name: 'ZOOM', items: [['ZBox', 'zbox'], ['Zoom In', 'zin'], ['Zoom Out', 'zout'], ['ZDecimal', 'ZDecimal'], ['ZSquare', 'ZSquare'],
        ['ZStandard', 'ZStandard'], ['ZTrig', 'ZTrig'], ['ZInteger', 'ZInteger'], ['ZoomStat', 'ZoomStat'], ['ZoomFit', 'ZoomFit'],
        ['ZQuadrant1', 'ZQuadrant1']].map((p) => ({ l: p[0], act: 'zoom:' + p[1], ins: /^Z|^Zoom/.test(p[1]) ? p[1] : null })) },
      { name: 'MEMORY', items: [{ l: 'ZPrevious', act: 'zoom:prev' }, { l: 'ZoomSto', act: 'zoom:ZoomSto', ins: 'ZoomSto' }, { l: 'ZoomRcl', act: 'zoom:ZoomRcl', ins: 'ZoomRcl' }] },
    ],
    CALC: [
      { name: 'CALCULATE', items: [['value', 'value'], ['zero', 'zero'], ['minimum', 'min'], ['maximum', 'max'], ['intersect', 'isect'],
        ['dy/dx', 'dydx'], ['∫f(x)dx', 'integral']].map((p) => ({ l: p[0], act: 'gcalc:' + p[1] })) },
    ],
    MEM: [
      { name: 'MEMORY', items: [{ l: 'About', act: 'about' }, { l: 'Mem Management/Delete…', act: 'memmgmt' }, { l: 'Clear Entries', act: 'clearEntries' },
        { l: 'ClrAllLists', ins: 'ClrAllLists' }, { l: 'Reset…', sub: 'RESET' }] },
    ],
    RESET: [
      { name: 'RAM', items: [{ l: 'All RAM…', act: 'resetAll' }, { l: 'Defaults…', act: 'resetDefaults' }] },
    ],
    APPS: [
      { name: 'APPLICATIONS', items: [{ l: 'Finance…', sub: 'FIN' }, { l: 'PlySmlt2', act: 'plysmlt' }] },
    ],
    FIN: [
      { name: 'CALC', items: [{ l: 'TVM Solver…', act: 'tvm' }, I('tvm_Pmt'), I('tvm_I%'), I('tvm_PV'), I('tvm_N'), I('tvm_FV'), I('npv('), I('irr('),
        I('bal('), I('ΣPrn('), I('ΣInt('), I('▶Nom('), I('▶Eff('), I('dbd('), I('Pmt_End'), I('Pmt_Bgn')] },
      { name: 'VARS', items: [{ l: 'N', ins: '⟨tvmN⟩' }, sys('I%'), sys('PV'), sys('PMT'), sys('FV'), sys('P/Y'), sys('C/Y')] },
    ],
    F1: [{ name: 'FRAC', items: [{ l: 'n/d', tpl: 'frac', ins: '/' }, { l: 'Un/d', tpl: 'mixed', ins: '+' }, I('▶F◀▶D'), I('▶n/d◀▶Un/d')] }],
    F2: [{ name: 'FUNC', items: [{ l: 'summation Σ(', tpl: 'sum', ins: 'Σ(' }, { l: 'logBASE(', tpl: 'logb', ins: 'logBASE(' },
      { l: 'nDeriv(', tpl: 'deriv', ins: 'nDeriv(' }, { l: 'fnInt(', tpl: 'int', ins: 'fnInt(' }] }],
    F4: [{ name: 'YVAR', items: Y.map((n) => I(n)) }],
  };

  /** Every token for CATALOG (2nd 0), alphabetical, the way the calculator lists them. */
  function catalog() {
    const FT = root.FluxTI;
    const seen = new Set();
    const out = [];
    const add = (l, ins) => { if (!l || seen.has(l)) return; seen.add(l); out.push({ l: l, ins: ins == null ? l : ins }); };
    Object.keys(FT.FN_ARITY).forEach((f) => add(f));
    FT.CMDS.forEach((c) => add(c, /[(]$/.test(c) || /^(ClrHome|ClrAllLists|ClrDraw|ClrTable|DispGraph|DispTable|Then|Else|End|Return|Stop|Degree|Radian|Normal|Sci|Eng|Float|Real|a\+bi|re\^θi|Func|Param|Polar|Seq|MATHPRINT|CLASSIC|SetUpEditor|GridOn|GridOff|AxesOn|AxesOff|LabelOn|LabelOff|CoordOn|CoordOff|ZStandard|ZTrig|ZDecimal|ZSquare|ZInteger|ZoomStat|ZoomFit|ZQuadrant1|ZoomRcl|ZoomSto)$/.test(c) ? c : c + ' '));
    FT.CONV.forEach((c) => add(c));
    ['rand', 'getKey', 'Pmt_End', 'Pmt_Bgn', 'Ans', 'and', 'or', 'xor', 'nPr', 'nCr'].forEach((w) => add(w, /^(and|or|xor|nPr|nCr)$/.test(w) ? ' ' + w + ' ' : w));
    ['tvm_Pmt', 'tvm_I%', 'tvm_PV', 'tvm_N', 'tvm_FV', 'i', 'e', 'π', 'ʟ', 'ᵀ', '!', '°', 'ʳ', '→'].forEach((w) => add(w));
    const key = (s) => s.replace(/^[^A-Za-z0-9]+/, '').toLowerCase();
    return out.sort((a, b) => (key(a.l) < key(b.l) ? -1 : key(a.l) > key(b.l) ? 1 : a.l < b.l ? -1 : 1));
  }

  /** The item numbers the calculator uses: 1–9, then 0, then A, B, C… */
  function itemKey(i) { return i < 9 ? String(i + 1) : i === 9 ? '0' : String.fromCharCode(65 + i - 10); }

  root.FluxTIMenus = { MENUS: MENUS, catalog: catalog, itemKey: itemKey, L: L, MATS: MATS, Y: Y };
})(typeof window !== 'undefined' ? window : globalThis);
