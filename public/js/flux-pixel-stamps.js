/* Flux Pixel · stamps: lab glassware, circuit symbols and shapes students draw
   again and again. Each is SVG drawn in a 100×100 box, stroked in the current
   colour, so it scales and recolours like anything else on the page. */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  root.FluxPixelStamps = [
    { group: 'Lab', items: [
      { id: 'beaker', name: 'Beaker', svg: '<path d="M22 12h56M27 12v72a6 6 0 0 0 6 6h34a6 6 0 0 0 6-6V12"/><path d="M27 52h46" stroke-dasharray="4 4"/><path d="M73 28h-8M73 40h-8M73 64h-8"/>' },
      { id: 'flask', name: 'Conical flask', svg: '<path d="M40 8h20M42 8v28L16 86a4 4 0 0 0 4 6h60a4 4 0 0 0 4-6L58 36V8"/><path d="M28 66h44" stroke-dasharray="4 4"/>' },
      { id: 'tube', name: 'Test tube', svg: '<path d="M38 6h24M42 6v74a8 8 0 0 0 16 0V6"/><path d="M42 58h16" stroke-dasharray="3 3"/>' },
      { id: 'cylinder', name: 'Measuring cylinder', svg: '<path d="M34 8h32M38 8v80h24V8M30 88h40"/><path d="M62 24h-8M62 36h-8M62 48h-8M62 60h-8M62 72h-8"/>' },
      { id: 'burner', name: 'Bunsen burner', svg: '<path d="M44 40h12v44H44z"/><path d="M28 84h44v8H28z"/><path d="M50 36c-8-8-6-18 0-28 6 10 8 20 0 28z"/>' },
      { id: 'funnel', name: 'Funnel', svg: '<path d="M14 14h72L56 50v40H44V50z"/>' },
    ] },
    { group: 'Circuits', items: [
      { id: 'cell', name: 'Cell', svg: '<path d="M8 50h36M56 50h36M44 30v40M56 40v20"/>' },
      { id: 'battery', name: 'Battery', svg: '<path d="M4 50h22M74 50h22M26 30v40M36 40v20M64 30v40M74 40v20"/><path d="M42 50h16" stroke-dasharray="3 4"/>' },
      { id: 'resistor', name: 'Resistor', svg: '<path d="M4 50h22M74 50h22M26 38h48v24H26z"/>' },
      { id: 'bulb', name: 'Lamp', svg: '<circle cx="50" cy="50" r="20"/><path d="M4 50h26M70 50h26M36 36l28 28M64 36L36 64"/>' },
      { id: 'switch', name: 'Switch', svg: '<path d="M4 54h28M68 54h28"/><circle cx="32" cy="54" r="3"/><circle cx="68" cy="54" r="3"/><path d="M34 52l30-20"/>' },
      { id: 'ammeter', name: 'Ammeter', svg: '<circle cx="50" cy="50" r="20"/><path d="M4 50h26M70 50h26"/><path d="M42 60l8-20 8 20M45 53h10"/>' },
      { id: 'voltmeter', name: 'Voltmeter', svg: '<circle cx="50" cy="50" r="20"/><path d="M4 50h26M70 50h26"/><path d="M42 40l8 20 8-20"/>' },
      { id: 'diode', name: 'Diode', svg: '<path d="M4 50h30M66 50h30M34 32v36l32-18zM66 32v36"/>' },
    ] },
    { group: 'Science', items: [
      { id: 'animal-cell', name: 'Animal cell', svg: '<ellipse cx="50" cy="50" rx="44" ry="36"/><circle cx="46" cy="48" r="13"/><circle cx="46" cy="48" r="4"/><ellipse cx="74" cy="34" rx="7" ry="4"/><ellipse cx="26" cy="68" rx="7" ry="4"/>' },
      { id: 'plant-cell', name: 'Plant cell', svg: '<rect x="8" y="14" width="84" height="72" rx="4"/><rect x="14" y="20" width="72" height="60" rx="3"/><rect x="34" y="34" width="34" height="34" rx="6"/><circle cx="24" cy="30" r="5"/><ellipse cx="22" cy="68" rx="6" ry="3.5"/><ellipse cx="78" cy="30" rx="6" ry="3.5"/>' },
      { id: 'atom', name: 'Atom', svg: '<circle cx="50" cy="50" r="7"/><circle cx="50" cy="50" r="26"/><circle cx="50" cy="50" r="42"/><circle cx="76" cy="50" r="3.5"/><circle cx="20" cy="40" r="3.5"/><circle cx="62" cy="88" r="3.5"/>' },
      { id: 'magnet', name: 'Bar magnet', svg: '<rect x="6" y="36" width="88" height="28"/><path d="M50 36v28"/><path d="M22 44v12M22 44l8 0M22 50h6M68 46c0-4 10-4 10 0 0 4-10 3-10 8 0 4 10 4 10 0"/>' },
      { id: 'lens', name: 'Convex lens', svg: '<path d="M50 6c18 14 18 74 0 88-18-14-18-74 0-88z"/><path d="M2 50h96" stroke-dasharray="4 4"/>' },
      { id: 'eye', name: 'Eye', svg: '<circle cx="50" cy="50" r="40"/><path d="M80 34c8 10 8 22 0 32"/><ellipse cx="82" cy="50" rx="5" ry="12"/><path d="M10 50h20"/>' },
    ] },
    { group: 'Maths', items: [
      { id: 'axes', name: 'Axes', svg: '<path d="M14 92V8M8 86h86M14 8l-5 8M14 8l5 8M94 86l-8-5M94 86l-8 5"/>' },
      { id: 'triangle', name: 'Right triangle', svg: '<path d="M12 88h76L12 16z"/><path d="M12 76h12v12"/>' },
      { id: 'circle-r', name: 'Circle and radius', svg: '<circle cx="50" cy="50" r="40"/><circle cx="50" cy="50" r="2"/><path d="M50 50h40"/>' },
      { id: 'cube', name: 'Cube', svg: '<path d="M14 30h52v56H14zM14 30l20-18h52L66 30M86 12v56L66 86"/><path d="M34 12v56h52M34 68L14 86" stroke-dasharray="4 4"/>' },
      { id: 'cylinder3d', name: 'Cylinder', svg: '<ellipse cx="50" cy="18" rx="32" ry="10"/><path d="M18 18v64M82 18v64"/><path d="M18 82c0 13 64 13 64 0"/><path d="M18 82c0-13 64-13 64 0" stroke-dasharray="4 4"/>' },
      { id: 'protractor', name: 'Angle', svg: '<path d="M10 86h82M10 86l70-56"/><path d="M40 86a30 30 0 0 0-7-19"/>' },
    ] },
    { group: 'Geography', items: [
      { id: 'compass', name: 'North arrow', svg: '<path d="M50 22l14 46-14-10-14 10z"/><path d="M44 16V2l12 14V2"/>' },
      { id: 'mountain', name: 'Mountain', svg: '<path d="M4 88l30-50 14 20 14-30 34 60z"/><path d="M48 58l6-8 6 8"/>' },
      { id: 'tree', name: 'Tree', svg: '<path d="M50 90V60"/><circle cx="50" cy="40" r="26"/>' },
      { id: 'house', name: 'Building', svg: '<path d="M14 90V44l36-30 36 30v46z"/><path d="M42 90V66h16v24"/>' },
      { id: 'sun', name: 'Sun', svg: '<circle cx="50" cy="50" r="18"/><path d="M50 8v14M50 78v14M8 50h14M78 50h14M20 20l10 10M70 70l10 10M80 20L70 30M30 70L20 80"/>' },
      { id: 'cloud', name: 'Cloud', svg: '<path d="M26 74a16 16 0 0 1 0-32 22 22 0 0 1 42-6 18 18 0 0 1 6 38z"/>' },
    ] },
  ];
})();
