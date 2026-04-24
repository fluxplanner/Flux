/* CS Reference — Number converter, ASCII, Big-O, logic gates */
(function(){
  'use strict';
  const esc = window.fluxEsc || ((s)=>String(s==null?'':s).replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])));

  // ─────────────────────────────────────────────────────────────────
  // Number converter
  // ─────────────────────────────────────────────────────────────────
  function formatBinary(bin){
    const padded = bin.padStart(Math.ceil(bin.length/4)*4, '0');
    return padded.match(/.{1,4}/g).join(' ');
  }
  function renderNumberConv(body){
    // Default to 42
    const initial = 42;
    body.innerHTML = `
      <div class="ref-formula-card" style="margin-bottom:14px">
        <div style="display:grid;grid-template-columns:1fr;gap:10px">
          <label style="display:grid;grid-template-columns:110px 1fr;gap:10px;align-items:center">
            <span style="font-weight:800">Decimal</span>
            <input type="text" id="refNumDec" class="ref-search-input" value="${initial}" inputmode="numeric" />
          </label>
          <label style="display:grid;grid-template-columns:110px 1fr;gap:10px;align-items:center">
            <span style="font-weight:800">Binary</span>
            <input type="text" id="refNumBin" class="ref-search-input" value="${formatBinary(initial.toString(2))}" />
          </label>
          <label style="display:grid;grid-template-columns:110px 1fr;gap:10px;align-items:center">
            <span style="font-weight:800">Hex</span>
            <input type="text" id="refNumHex" class="ref-search-input" value="0x${initial.toString(16).toUpperCase()}" />
          </label>
          <label style="display:grid;grid-template-columns:110px 1fr;gap:10px;align-items:center">
            <span style="font-weight:800">Octal</span>
            <input type="text" id="refNumOct" class="ref-search-input" value="${initial.toString(8)}" />
          </label>
        </div>
      </div>
      <div class="ref-formula-card">
        <div class="ref-formula-name">Step-by-step</div>
        <pre class="ref-formula-eq" id="refNumSteps"></pre>
      </div>
    `;

    const dec = body.querySelector('#refNumDec');
    const bin = body.querySelector('#refNumBin');
    const hex = body.querySelector('#refNumHex');
    const oct = body.querySelector('#refNumOct');
    const steps = body.querySelector('#refNumSteps');

    function updateSteps(n){
      if(!isFinite(n)) { steps.textContent = ''; return; }
      const bs = n.toString(2);
      const lines = [];
      let cur = n, divisionSteps = [];
      while(cur > 0){
        divisionSteps.push(`${cur} ÷ 2 = ${Math.floor(cur/2)} r ${cur%2}`);
        cur = Math.floor(cur/2);
      }
      lines.push(`Decimal → Binary (repeated divide by 2, read remainders bottom-up):`);
      divisionSteps.forEach(s => lines.push('  ' + s));
      lines.push(`  → ${bs}`);
      lines.push('');
      lines.push(`Decimal → Hex (group binary by 4):`);
      lines.push(`  ${formatBinary(bs)} → 0x${n.toString(16).toUpperCase()}`);
      lines.push('');
      lines.push(`Powers of 2 sum:`);
      const bits = bs.split('').reverse();
      const pieces = bits.map((b, i) => b === '1' ? `2^${i}=${Math.pow(2,i)}` : null).filter(Boolean);
      if(pieces.length) lines.push('  ' + pieces.reverse().join(' + ') + ` = ${n}`);
      steps.textContent = lines.join('\n');
    }

    function update(from){
      let n = NaN;
      try{
        if(from === 'dec') n = parseInt(dec.value.replace(/,/g,''), 10);
        else if(from === 'bin') n = parseInt((bin.value || '').replace(/\s/g,''), 2);
        else if(from === 'hex') n = parseInt((hex.value || '').replace(/^0x/i,''), 16);
        else if(from === 'oct') n = parseInt(oct.value, 8);
      }catch(e){}
      if(isNaN(n) || n < 0){
        updateSteps(NaN);
        return;
      }
      if(from !== 'dec') dec.value = String(n);
      if(from !== 'bin') bin.value = formatBinary(n.toString(2));
      if(from !== 'hex') hex.value = '0x' + n.toString(16).toUpperCase();
      if(from !== 'oct') oct.value = n.toString(8);
      updateSteps(n);
    }

    dec.addEventListener('input', () => update('dec'));
    bin.addEventListener('input', () => update('bin'));
    hex.addEventListener('input', () => update('hex'));
    oct.addEventListener('input', () => update('oct'));
    updateSteps(initial);
  }

  // ─────────────────────────────────────────────────────────────────
  // ASCII
  // ─────────────────────────────────────────────────────────────────
  function charClass(code){
    if(code < 32) return 'ctrl';
    if(code === 32) return 'space';
    if(code >= 48 && code <= 57) return 'digit';
    if((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) return 'letter';
    if(code >= 33 && code <= 126) return 'punct';
    return 'ext';
  }
  function charDesc(code){
    const ctrls = {0:'NUL',1:'SOH',2:'STX',3:'ETX',4:'EOT',5:'ENQ',6:'ACK',7:'BEL',8:'BS',9:'TAB',10:'LF',11:'VT',12:'FF',13:'CR',14:'SO',15:'SI',16:'DLE',17:'DC1',18:'DC2',19:'DC3',20:'DC4',21:'NAK',22:'SYN',23:'ETB',24:'CAN',25:'EM',26:'SUB',27:'ESC',28:'FS',29:'GS',30:'RS',31:'US',127:'DEL'};
    if(ctrls[code]) return ctrls[code];
    if(code === 32) return 'space';
    if(code >= 48 && code <= 57) return 'digit';
    if((code >= 65 && code <= 90)) return 'uppercase';
    if((code >= 97 && code <= 122)) return 'lowercase';
    return 'punctuation';
  }
  function renderAscii(body){
    const q = (document.getElementById('refAsciiSearch')?.value || '').trim();
    let rows = [];
    for(let i = 0; i < 128; i++){
      const chClass = charClass(i);
      if(q){
        const ch = (i >= 32 && i !== 127) ? String.fromCharCode(i) : '';
        const desc = charDesc(i);
        if(!(String(i).includes(q) || ch === q || desc.toLowerCase().includes(q.toLowerCase()) || ('0x'+i.toString(16)).includes(q.toLowerCase()))) continue;
      }
      rows.push(`<tr data-ascii="${i}" data-char="${(i >= 32 && i !== 127) ? esc(String.fromCharCode(i)) : ''}">
        <td style="font-family:'JetBrains Mono',monospace;font-weight:800">${i}</td>
        <td style="font-family:'JetBrains Mono',monospace;color:var(--accent)">0x${i.toString(16).toUpperCase().padStart(2,'0')}</td>
        <td style="font-family:'JetBrains Mono',monospace;color:var(--muted2);font-size:.78rem">${i.toString(2).padStart(7,'0')}</td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:1.05rem">${(i >= 32 && i !== 127) ? esc(String.fromCharCode(i)) : '—'}</td>
        <td style="color:var(--muted2);font-size:.78rem">${esc(charDesc(i))}</td>
      </tr>`);
    }
    body.innerHTML = `
      <div class="ref-inner-search"><input type="search" id="refAsciiSearch" class="ref-search-input" placeholder="Search character, code, or description…" value="${esc(q)}"></div>
      <div style="overflow-x:auto"><table class="ref-table">
        <thead><tr><th>Dec</th><th>Hex</th><th>Binary</th><th>Char</th><th>Description</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table></div>
    `;
    const input = body.querySelector('#refAsciiSearch');
    if(input){
      input.addEventListener('input', () => renderAscii(body));
      setTimeout(() => { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }, 0);
    }
    body.querySelectorAll('tr[data-ascii]').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', async () => {
        try{
          await navigator.clipboard.writeText(row.dataset.char || row.dataset.ascii);
          row.style.background = 'rgba(108,231,138,.15)';
          setTimeout(() => row.style.background = '', 400);
        }catch(e){}
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Big-O
  // ─────────────────────────────────────────────────────────────────
  const BIG_O = [
    { algo:'Array access / hash lookup', comp:'O(1)',      color:'g' },
    { algo:'Binary search',              comp:'O(log n)',  color:'g' },
    { algo:'Linked list / array traversal', comp:'O(n)',   color:'g' },
    { algo:'Merge sort, Heap sort, Quick sort (avg)', comp:'O(n log n)', color:'y' },
    { algo:'Bubble / Insertion sort',    comp:'O(n²)',     color:'o' },
    { algo:'Quick sort (worst)',         comp:'O(n²)',     color:'o' },
    { algo:'Matrix multiplication (naive)', comp:'O(n³)',  color:'o' },
    { algo:'Subset sum / partition',     comp:'O(2ⁿ)',     color:'r' },
    { algo:'Traveling salesman (brute)', comp:'O(n!)',     color:'r' },
  ];

  function renderBigO(body){
    // SVG curve chart (log scale x, comparison of O(1), O(log n), O(n), O(n log n), O(n²), O(2^n))
    const w = 520, h = 200, pad = 30;
    const maxX = 10;
    const fns = [
      { name:'O(1)',       color:'#6ce78a', fn:() => 1 },
      { name:'O(log n)',   color:'#79c1ff', fn:(x) => Math.log2(x+1) },
      { name:'O(n)',       color:'#ffc107', fn:(x) => x },
      { name:'O(n log n)', color:'#ff8c3c', fn:(x) => x * Math.log2(x+1) },
      { name:'O(n²)',      color:'#ff6b6b', fn:(x) => x*x },
      { name:'O(2ⁿ)',      color:'#c770ff', fn:(x) => Math.pow(2, x) },
    ];
    // Normalize max
    let maxY = 0;
    fns.forEach(f => { for(let x = 1; x <= maxX; x++) { const y = f.fn(x); if(y > maxY) maxY = y; } });
    const pathFor = (fn) => {
      const pts = [];
      for(let x = 1; x <= maxX; x += 0.25){
        const y = Math.min(fn(x), maxY);
        const px = pad + ((x-1)/(maxX-1))*(w - pad*2);
        const py = h - pad - (y/maxY)*(h - pad*2);
        pts.push(`${pts.length===0?'M':'L'} ${px.toFixed(1)} ${py.toFixed(1)}`);
      }
      return pts.join(' ');
    };
    const paths = fns.map(f => `<path d="${pathFor(f.fn)}" stroke="${f.color}" stroke-width="2.5" fill="none" />`).join('');
    const legend = fns.map(f => `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:14px;font-size:.76rem"><i style="display:inline-block;width:14px;height:3px;background:${f.color};border-radius:2px"></i>${esc(f.name)}</span>`).join('');

    body.innerHTML = `
      <h3 style="margin:0 0 10px;font-size:1rem">Complexity table</h3>
      ${BIG_O.map(b => `<div class="ref-bigo-row ref-bigo-row--${b.color}">
        <div>${esc(b.algo)}</div>
        <div></div>
        <div class="ref-bigo-complexity">${esc(b.comp)}</div>
      </div>`).join('')}

      <h3 style="margin:22px 0 10px;font-size:1rem">Growth curves</h3>
      <div class="ref-formula-card">
        <div style="margin-bottom:8px">${legend}</div>
        <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;background:rgba(0,0,0,.2);border-radius:8px" preserveAspectRatio="xMidYMid meet">
          <line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" stroke="rgba(255,255,255,.2)" />
          <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h-pad}" stroke="rgba(255,255,255,.2)" />
          <text x="${w/2}" y="${h-6}" text-anchor="middle" fill="rgba(255,255,255,.5)" font-size="11">Input size →</text>
          <text x="10" y="${h/2}" fill="rgba(255,255,255,.5)" font-size="11" transform="rotate(-90, 10, ${h/2})">Operations →</text>
          ${paths}
        </svg>
      </div>
    `;
  }

  // ─────────────────────────────────────────────────────────────────
  // Logic gates
  // ─────────────────────────────────────────────────────────────────
  const GATES = {
    AND: { tt:[[0,0,0],[0,1,0],[1,0,0],[1,1,1]], desc:'Output is 1 only when ALL inputs are 1' },
    OR:  { tt:[[0,0,0],[0,1,1],[1,0,1],[1,1,1]], desc:'Output is 1 when ANY input is 1' },
    NOT: { tt:[[0,1],[1,0]], desc:'Inverts the input', single:true },
    NAND:{ tt:[[0,0,1],[0,1,1],[1,0,1],[1,1,0]], desc:'NOT AND — output is 0 only when all inputs are 1' },
    NOR: { tt:[[0,0,1],[0,1,0],[1,0,0],[1,1,0]], desc:'NOT OR — output is 1 only when all inputs are 0' },
    XOR: { tt:[[0,0,0],[0,1,1],[1,0,1],[1,1,0]], desc:'Output is 1 when inputs differ' },
    XNOR:{ tt:[[0,0,1],[0,1,0],[1,0,0],[1,1,1]], desc:'Output is 1 when inputs match' },
  };

  function gateSVG(name){
    // Stylized gate shapes
    const shapes = {
      AND: `<path d="M30,15 L30,75 L70,75 Q110,75 110,45 Q110,15 70,15 Z" fill="rgba(var(--accent-rgb,0,191,255),.1)" stroke="currentColor" stroke-width="1.8"/>`,
      OR: `<path d="M20,15 Q40,45 20,75 Q60,75 115,45 Q60,15 20,15 Z" fill="rgba(var(--accent-rgb,0,191,255),.1)" stroke="currentColor" stroke-width="1.8"/>`,
      NOT:`<path d="M30,15 L30,75 L110,45 Z" fill="rgba(var(--accent-rgb,0,191,255),.1)" stroke="currentColor" stroke-width="1.8"/>
           <circle cx="118" cy="45" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/>`,
      NAND:`<path d="M30,15 L30,75 L70,75 Q105,75 105,45 Q105,15 70,15 Z" fill="rgba(var(--accent-rgb,0,191,255),.1)" stroke="currentColor" stroke-width="1.8"/>
            <circle cx="113" cy="45" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/>`,
      NOR: `<path d="M20,15 Q40,45 20,75 Q60,75 110,45 Q60,15 20,15 Z" fill="rgba(var(--accent-rgb,0,191,255),.1)" stroke="currentColor" stroke-width="1.8"/>
            <circle cx="118" cy="45" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/>`,
      XOR: `<path d="M10,15 Q30,45 10,75" fill="none" stroke="currentColor" stroke-width="1.8"/>
            <path d="M20,15 Q40,45 20,75 Q60,75 115,45 Q60,15 20,15 Z" fill="rgba(var(--accent-rgb,0,191,255),.1)" stroke="currentColor" stroke-width="1.8"/>`,
      XNOR:`<path d="M10,15 Q30,45 10,75" fill="none" stroke="currentColor" stroke-width="1.8"/>
            <path d="M20,15 Q40,45 20,75 Q60,75 110,45 Q60,15 20,15 Z" fill="rgba(var(--accent-rgb,0,191,255),.1)" stroke="currentColor" stroke-width="1.8"/>
            <circle cx="118" cy="45" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/>`,
    };
    return `<svg viewBox="0 0 140 90" xmlns="http://www.w3.org/2000/svg" style="color:var(--accent)">
      <line x1="0" y1="28" x2="30" y2="28" stroke="currentColor" stroke-width="1.5" opacity=".6"/>
      ${name !== 'NOT' ? '<line x1="0" y1="62" x2="30" y2="62" stroke="currentColor" stroke-width="1.5" opacity=".6"/>' : ''}
      ${shapes[name] || shapes.AND}
      <line x1="${name==='NOT'||name==='NAND'||name==='NOR'||name==='XNOR'?124:115}" y1="45" x2="140" y2="45" stroke="currentColor" stroke-width="1.5" opacity=".6"/>
      <text x="70" y="92" text-anchor="middle" font-size="11" fill="currentColor" font-weight="700">${name}</text>
    </svg>`;
  }

  function renderLogic(body){
    body.innerHTML = `<div class="ref-gate-wrap">${Object.entries(GATES).map(([name, g]) => {
      const rows = g.tt.map(r => `<tr>${r.map((c, i) => `<td style="color:${c===1?'var(--accent)':'var(--muted2)'};font-weight:${c===1?'800':'600'}">${c}</td>`).join('')}</tr>`).join('');
      const headers = g.single ? '<th>A</th><th>Out</th>' : '<th>A</th><th>B</th><th>Out</th>';
      return `<div class="ref-gate-card">
        ${gateSVG(name)}
        <div style="font-size:.82rem;color:var(--muted2);margin:6px 0 10px">${esc(g.desc)}</div>
        <table class="ref-gate-tt"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>
      </div>`;
    }).join('')}</div>`;
  }

  function openCSReference(){
    if(typeof window.fluxOpenToolModal !== 'function') return;
    window.fluxOpenToolModal({
      id: 'cs-ref',
      emoji: '💻',
      title: 'CS Reference',
      tabs: [
        { id:'num',   label:'Number Converter' },
        { id:'ascii', label:'ASCII Table' },
        { id:'bigo',  label:'Big-O' },
        { id:'logic', label:'Logic Gates' },
      ],
      renderBody: (body, tabId) => {
        if(tabId === 'num') renderNumberConv(body);
        else if(tabId === 'ascii') renderAscii(body);
        else if(tabId === 'bigo') renderBigO(body);
        else if(tabId === 'logic') renderLogic(body);
      },
    });
  }

  try{ window.openCSReference = openCSReference; }catch(e){}
})();
