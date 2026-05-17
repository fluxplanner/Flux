/* Unit Converter — 11 categories, live convert, swap, quick-tap chips */
(function(){
  'use strict';
  const esc = window.fluxEsc || ((s)=>String(s==null?'':s).replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])));

  const LS_UNIT_CAT = 'flux_tool_tab_unit-converter';
  function readUnitCat(){
    try{
      if(typeof fluxLoadStoredString==='function'){
        const s=String(fluxLoadStoredString(LS_UNIT_CAT,'')).trim();
        return s||'length';
      }
      if(typeof load==='function'){
        const v=load(LS_UNIT_CAT,null);
        if(v!=null&&String(v).length)return String(v);
      }
      const nkk=typeof fluxNamespacedKey==='function'?fluxNamespacedKey(LS_UNIT_CAT):LS_UNIT_CAT;
      const raw=localStorage.getItem(nkk);
      if(raw==null||raw==='')return'length';
      try{return String(JSON.parse(raw));}catch(_){return String(raw).trim()||'length';}
    }catch(_){return'length';}
  }
  function writeUnitCat(cat){
    try{
      if(typeof save==='function'){save(LS_UNIT_CAT,String(cat));return;}
      const nkk=typeof fluxNamespacedKey==='function'?fluxNamespacedKey(LS_UNIT_CAT):LS_UNIT_CAT;
      localStorage.setItem(nkk,JSON.stringify(String(cat)));
    }catch(_){}
  }

  // Each category: units with factor to base, plus label
  const CATEGORIES = {
    length: {
      label:'Length', base:'m',
      units: {
        mm:{label:'Millimeters (mm)', f:0.001}, cm:{label:'Centimeters (cm)', f:0.01},
        m:{label:'Meters (m)', f:1}, km:{label:'Kilometers (km)', f:1000},
        in:{label:'Inches (in)', f:0.0254}, ft:{label:'Feet (ft)', f:0.3048},
        yd:{label:'Yards (yd)', f:0.9144}, mi:{label:'Miles (mi)', f:1609.344},
        nm:{label:'Nanometers (nm)', f:1e-9}, μm:{label:'Micrometers (μm)', f:1e-6},
      },
      formula: (f, t) => `1 ${f} = ${(CATEGORIES.length.units[f].f / CATEGORIES.length.units[t].f).toPrecision(6)} ${t}`,
    },
    mass: {
      label:'Mass', base:'kg',
      units: {
        mg:{label:'Milligrams (mg)', f:1e-6}, g:{label:'Grams (g)', f:0.001},
        kg:{label:'Kilograms (kg)', f:1}, t:{label:'Metric tons (t)', f:1000},
        oz:{label:'Ounces (oz)', f:0.0283495}, lb:{label:'Pounds (lb)', f:0.453592},
        ton:{label:'US tons', f:907.185},
      },
      formula: (f, t) => `1 ${f} = ${(CATEGORIES.mass.units[f].f / CATEGORIES.mass.units[t].f).toPrecision(6)} ${t}`,
    },
    temperature: {
      label:'Temperature', base:'C',
      units: {
        C:{label:'Celsius (°C)'}, F:{label:'Fahrenheit (°F)'}, K:{label:'Kelvin (K)'}, R:{label:'Rankine (°R)'},
      },
      convert: (v, f, t) => {
        let c;
        if(f==='C') c=v; else if(f==='F') c=(v-32)*5/9; else if(f==='K') c=v-273.15; else if(f==='R') c=(v-491.67)*5/9;
        if(t==='C') return c;
        if(t==='F') return c*9/5 + 32;
        if(t==='K') return c + 273.15;
        if(t==='R') return c*9/5 + 491.67;
        return c;
      },
      formula: (f, t) => {
        const m = { CF:'°F = °C × 9/5 + 32', FC:'°C = (°F − 32) × 5/9', CK:'K = °C + 273.15', KC:'°C = K − 273.15', FK:'K = (°F − 32) × 5/9 + 273.15' };
        return m[f+t] || 'Direct conversion';
      },
    },
    volume: {
      label:'Volume', base:'L',
      units: {
        mL:{label:'Milliliters (mL)', f:0.001}, L:{label:'Liters (L)', f:1},
        cm3:{label:'Cubic cm (cm³)', f:0.001}, m3:{label:'Cubic meters (m³)', f:1000},
        tsp:{label:'Teaspoons (US)', f:0.00492892}, tbsp:{label:'Tablespoons (US)', f:0.0147868},
        floz:{label:'Fluid oz (US)', f:0.0295735}, cup:{label:'Cups (US)', f:0.236588},
        pt:{label:'Pints (US)', f:0.473176}, qt:{label:'Quarts (US)', f:0.946353},
        gal:{label:'Gallons (US)', f:3.78541},
      },
      formula: (f, t) => `1 ${f} = ${(CATEGORIES.volume.units[f].f / CATEGORIES.volume.units[t].f).toPrecision(6)} ${t}`,
    },
    area: {
      label:'Area', base:'m²',
      units: {
        'mm²':{label:'mm²', f:1e-6}, 'cm²':{label:'cm²', f:1e-4},
        'm²':{label:'m²', f:1}, 'km²':{label:'km²', f:1e6},
        'in²':{label:'in²', f:0.00064516}, 'ft²':{label:'ft²', f:0.092903},
        'yd²':{label:'yd²', f:0.836127}, acre:{label:'Acres', f:4046.86},
        hectare:{label:'Hectares', f:10000}, 'mi²':{label:'mi²', f:2.59e6},
      },
      formula: (f, t) => `1 ${f} = ${(CATEGORIES.area.units[f].f / CATEGORIES.area.units[t].f).toPrecision(6)} ${t}`,
    },
    speed: {
      label:'Speed', base:'m/s',
      units: {
        'm/s':{label:'Meters/second', f:1}, 'km/h':{label:'Kilometers/hour', f:0.277778},
        mph:{label:'Miles/hour', f:0.44704}, 'ft/s':{label:'Feet/second', f:0.3048},
        knot:{label:'Knots', f:0.514444}, mach:{label:'Mach (sea level)', f:340.29},
      },
      formula: (f, t) => `1 ${f} = ${(CATEGORIES.speed.units[f].f / CATEGORIES.speed.units[t].f).toPrecision(6)} ${t}`,
    },
    pressure: {
      label:'Pressure', base:'Pa',
      units: {
        Pa:{label:'Pascals (Pa)', f:1}, kPa:{label:'Kilopascals (kPa)', f:1000},
        atm:{label:'Atmospheres (atm)', f:101325}, bar:{label:'Bar', f:100000},
        psi:{label:'Pounds/in² (psi)', f:6894.76}, mmHg:{label:'mmHg (Torr)', f:133.322},
        inHg:{label:'inHg', f:3386.39},
      },
      formula: (f, t) => `1 ${f} = ${(CATEGORIES.pressure.units[f].f / CATEGORIES.pressure.units[t].f).toPrecision(6)} ${t}`,
    },
    energy: {
      label:'Energy', base:'J',
      units: {
        J:{label:'Joules (J)', f:1}, kJ:{label:'Kilojoules (kJ)', f:1000},
        cal:{label:'Calories (cal)', f:4.184}, kcal:{label:'Kilocalories (kcal)', f:4184},
        Wh:{label:'Watt-hours (Wh)', f:3600}, kWh:{label:'Kilowatt-hours', f:3.6e6},
        eV:{label:'Electron-volts (eV)', f:1.602e-19}, BTU:{label:'BTU', f:1055.06},
      },
      formula: (f, t) => `1 ${f} = ${(CATEGORIES.energy.units[f].f / CATEGORIES.energy.units[t].f).toPrecision(6)} ${t}`,
    },
    time: {
      label:'Time', base:'s',
      units: {
        ms:{label:'Milliseconds (ms)', f:0.001}, s:{label:'Seconds (s)', f:1},
        min:{label:'Minutes', f:60}, h:{label:'Hours', f:3600},
        day:{label:'Days', f:86400}, week:{label:'Weeks', f:604800},
        month:{label:'Months (30d)', f:2592000}, year:{label:'Years (365d)', f:3.1536e7},
      },
      formula: (f, t) => `1 ${f} = ${(CATEGORIES.time.units[f].f / CATEGORIES.time.units[t].f).toPrecision(6)} ${t}`,
    },
    data: {
      label:'Data', base:'B',
      units: {
        bit:{label:'Bits', f:0.125}, B:{label:'Bytes (B)', f:1},
        KB:{label:'Kilobytes (KB)', f:1024}, MB:{label:'Megabytes (MB)', f:1048576},
        GB:{label:'Gigabytes (GB)', f:1073741824}, TB:{label:'Terabytes (TB)', f:1.099511627776e12},
        PB:{label:'Petabytes (PB)', f:1.125899906842624e15},
      },
      formula: (f, t) => `1 ${f} = ${(CATEGORIES.data.units[f].f / CATEGORIES.data.units[t].f).toPrecision(6)} ${t}`,
    },
    angle: {
      label:'Angle', base:'rad',
      units: {
        rad:{label:'Radians', f:1}, deg:{label:'Degrees (°)', f:Math.PI/180},
        grad:{label:'Gradians', f:Math.PI/200}, turn:{label:'Turns', f:2*Math.PI},
        arcmin:{label:"Arcminutes (')", f:Math.PI/10800}, arcsec:{label:'Arcseconds (")', f:Math.PI/648000},
      },
      formula: (f, t) => `1 ${f} = ${(CATEGORIES.angle.units[f].f / CATEGORIES.angle.units[t].f).toPrecision(6)} ${t}`,
    },
  };

  function convert(cat, v, from, to){
    const c = CATEGORIES[cat];
    if(!c) return NaN;
    if(c.convert) return c.convert(Number(v), from, to);
    const fv = Number(v);
    if(isNaN(fv)) return NaN;
    const inBase = fv * c.units[from].f;
    return inBase / c.units[to].f;
  }

  function fmt(n){
    if(!isFinite(n)) return '—';
    if(Math.abs(n) < 1e-4 || Math.abs(n) >= 1e9){
      return Number(n).toExponential(6);
    }
    const s = n.toPrecision(10);
    return parseFloat(s).toString();
  }

  // State keyed per modal instance
  let state = {
    cat: readUnitCat(),
    from: null,
    to: null,
    value: 1,
  };

  function initDefaults(){
    const cat = CATEGORIES[state.cat];
    const units = Object.keys(cat.units);
    if(!state.from || !units.includes(state.from)) state.from = units[0];
    if(!state.to || !units.includes(state.to) || state.to === state.from) state.to = units[1] || units[0];
  }

  function render(body){
    initDefaults();
    const cat = CATEGORIES[state.cat];
    const units = Object.keys(cat.units);
    const out = convert(state.cat, state.value, state.from, state.to);

    const QUICK = {
      length: [{from:'in',to:'cm'},{from:'ft',to:'m'},{from:'mi',to:'km'},{from:'m',to:'ft'}],
      mass:   [{from:'lb',to:'kg'},{from:'g',to:'oz'},{from:'kg',to:'lb'}],
      temperature:[{from:'C',to:'F'},{from:'F',to:'C'},{from:'C',to:'K'}],
      volume: [{from:'cup',to:'mL'},{from:'gal',to:'L'},{from:'floz',to:'mL'}],
      speed:  [{from:'km/h',to:'mph'},{from:'mph',to:'km/h'},{from:'m/s',to:'km/h'}],
      pressure:[{from:'atm',to:'kPa'},{from:'psi',to:'kPa'},{from:'bar',to:'atm'}],
      energy: [{from:'kcal',to:'kJ'},{from:'J',to:'cal'},{from:'kWh',to:'kJ'}],
      time:   [{from:'min',to:'s'},{from:'h',to:'min'},{from:'day',to:'h'}],
      data:   [{from:'MB',to:'KB'},{from:'GB',to:'MB'},{from:'TB',to:'GB'}],
      angle:  [{from:'deg',to:'rad'},{from:'rad',to:'deg'},{from:'turn',to:'deg'}],
      area:   [{from:'m²',to:'ft²'},{from:'acre',to:'m²'},{from:'ft²',to:'m²'}],
    };

    body.innerHTML = `
      <div class="ref-tool-tabs" style="border:0;padding:0;margin-bottom:14px">
        ${Object.entries(CATEGORIES).map(([k,c]) => `<button type="button" class="ref-tool-tab ${k===state.cat?'active':''}" data-cat="${k}">${esc(c.label)}</button>`).join('')}
      </div>

      <div class="ref-unit-row">
        <div class="ref-unit-col">
          <select id="refUnitFrom">${units.map(u => `<option value="${esc(u)}" ${u===state.from?'selected':''}>${esc(cat.units[u].label)}</option>`).join('')}</select>
          <input type="number" id="refUnitFromVal" value="${esc(state.value)}" step="any" inputmode="decimal">
        </div>
        <button type="button" class="ref-unit-swap" id="refUnitSwap" title="Swap">⇄</button>
        <div class="ref-unit-col">
          <select id="refUnitTo">${units.map(u => `<option value="${esc(u)}" ${u===state.to?'selected':''}>${esc(cat.units[u].label)}</option>`).join('')}</select>
          <input type="text" id="refUnitToVal" value="${esc(fmt(out))}" readonly>
        </div>
      </div>

      <div class="ref-unit-formula">${esc(cat.formula(state.from, state.to))}</div>

      <div style="font-size:.78rem;color:var(--muted2);margin-bottom:6px">Quick conversions:</div>
      <div class="ref-unit-quick">
        ${(QUICK[state.cat] || []).map(q => `<button type="button" data-quick="${esc(q.from)}|${esc(q.to)}">${esc(q.from)} → ${esc(q.to)}</button>`).join('')}
      </div>
    `;

    const bindInput = () => {
      const fv = body.querySelector('#refUnitFromVal');
      const tv = body.querySelector('#refUnitToVal');
      fv.addEventListener('input', () => {
        state.value = fv.value;
        const r = convert(state.cat, fv.value, state.from, state.to);
        tv.value = fmt(r);
      });
    };

    body.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => {
      state.cat = b.dataset.cat;
      state.from = null; state.to = null;
      writeUnitCat(state.cat);
      render(body);
    }));
    body.querySelector('#refUnitFrom').addEventListener('change', (e) => { state.from = e.target.value; render(body); });
    body.querySelector('#refUnitTo').addEventListener('change', (e) => { state.to = e.target.value; render(body); });
    body.querySelector('#refUnitSwap').addEventListener('click', () => {
      const tmp = state.from; state.from = state.to; state.to = tmp;
      render(body);
    });
    body.querySelectorAll('[data-quick]').forEach(b => b.addEventListener('click', () => {
      const [f, t] = b.dataset.quick.split('|');
      state.from = f; state.to = t;
      render(body);
    }));
    bindInput();
  }

  function openUnitConverter(){
    if(typeof window.fluxOpenToolModal !== 'function') return;
    window.fluxOpenToolModal({
      id: 'unit-converter',
      emoji: '🔁',
      title: 'Unit Converter',
      renderBody: render,
    });
  }

  try{ window.openUnitConverter = openUnitConverter; }catch(e){}
})();
