/* History Map — SVG world regions, clickable, era filter, side panel */
(function(){
  'use strict';
  const esc = window.fluxEsc || ((s)=>String(s==null?'':s).replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])));

  // Simplified region data (not a full geographic map, but educational schematic)
  const REGIONS = {
    europe:     { name:'Europe',                eras:['ancient','medieval','earlyModern','modern'] },
    mediterranean: { name:'Mediterranean / Near East', eras:['ancient','medieval'] },
    africa:     { name:'Africa',                eras:['ancient','medieval','earlyModern','modern'] },
    mideast:    { name:'Middle East',           eras:['ancient','medieval','earlyModern','modern'] },
    india:      { name:'South Asia (India)',    eras:['ancient','medieval','earlyModern','modern'] },
    china:      { name:'East Asia (China)',     eras:['ancient','medieval','earlyModern','modern'] },
    japan:      { name:'Japan',                 eras:['medieval','earlyModern','modern'] },
    seasia:     { name:'Southeast Asia',        eras:['medieval','earlyModern','modern'] },
    oceania:    { name:'Oceania',               eras:['earlyModern','modern'] },
    namerica:   { name:'North America',         eras:['ancient','earlyModern','modern'] },
    samerica:   { name:'South America',         eras:['ancient','earlyModern','modern'] },
  };

  const ERAS = [
    { id:'ancient',     label:'Ancient', range:'c. 3000 BCE – 500 CE' },
    { id:'medieval',    label:'Medieval', range:'500 – 1500 CE' },
    { id:'earlyModern', label:'Early Modern', range:'1500 – 1800' },
    { id:'modern',      label:'Modern', range:'1800 – present' },
  ];

  const DATA = {
    europe: [
      { era:'ancient', period:'Greek city-states (Archaic & Classical Greece)', empires:['Athens','Sparta','Macedonia','Alexander\'s empire'], dates:[{y:'776 BCE',e:'First Olympic Games'},{y:'508 BCE',e:'Athenian democracy'},{y:'490 BCE',e:'Battle of Marathon'},{y:'336 BCE',e:'Alexander the Great'},{y:'146 BCE',e:'Rome conquers Greece'}], figures:['Pericles','Socrates','Plato','Aristotle','Alexander the Great'] },
      { era:'ancient', period:'Roman Republic & Empire', empires:['Roman Republic','Roman Empire'], dates:[{y:'509 BCE',e:'Roman Republic founded'},{y:'27 BCE',e:'Augustus — first emperor'},{y:'117 CE',e:'Empire reaches peak'},{y:'313 CE',e:'Edict of Milan'},{y:'476 CE',e:'Fall of Western Empire'}], figures:['Julius Caesar','Augustus','Cicero','Constantine'] },
      { era:'medieval', period:'Byzantine, Carolingian, Feudal Europe', empires:['Byzantine Empire','Holy Roman Empire','Kingdoms of England & France'], dates:[{y:'800',e:'Charlemagne crowned'},{y:'1066',e:'Norman Conquest of England'},{y:'1096',e:'First Crusade'},{y:'1215',e:'Magna Carta'},{y:'1347',e:'Black Death'},{y:'1453',e:'Fall of Constantinople'}], figures:['Charlemagne','William the Conqueror','Joan of Arc','Justinian I'] },
      { era:'earlyModern', period:'Renaissance · Reformation · Enlightenment', empires:['Spain','Portugal','France','Habsburgs','British Empire'], dates:[{y:'1492',e:'Columbus reaches Americas'},{y:'1517',e:'95 Theses (Reformation)'},{y:'1588',e:'Spanish Armada defeated'},{y:'1648',e:'Peace of Westphalia'},{y:'1776',e:'American Revolution begins'},{y:'1789',e:'French Revolution'}], figures:['Leonardo da Vinci','Martin Luther','Elizabeth I','Napoleon','Louis XIV'] },
      { era:'modern', period:'Industrial & World Wars', empires:['British Empire','German Empire','Soviet Union','EU'], dates:[{y:'1815',e:'Battle of Waterloo'},{y:'1914',e:'WWI begins'},{y:'1917',e:'Russian Revolution'},{y:'1939',e:'WWII begins'},{y:'1989',e:'Fall of Berlin Wall'},{y:'1993',e:'EU Maastricht Treaty'}], figures:['Queen Victoria','Churchill','Stalin','Hitler','de Gaulle'] },
    ],
    mediterranean: [
      { era:'ancient', period:'Bronze Age Mediterranean', empires:['Minoans','Mycenaeans','Phoenicians','Carthage'], dates:[{y:'3000 BCE',e:'Minoan civilization'},{y:'814 BCE',e:'Carthage founded'},{y:'146 BCE',e:'Carthage destroyed'}], figures:['Hannibal','Dido'] },
    ],
    africa: [
      { era:'ancient', period:'Ancient Egypt · Kush · Nok', empires:['Old/Middle/New Kingdom Egypt','Kush','Carthage'], dates:[{y:'3100 BCE',e:'Unification of Egypt'},{y:'2560 BCE',e:'Great Pyramid of Giza'},{y:'1332 BCE',e:'Tutankhamun'},{y:'51 BCE',e:'Cleopatra VII'},{y:'30 BCE',e:'Rome annexes Egypt'}], figures:['Khufu','Hatshepsut','Ramses II','Cleopatra'] },
      { era:'medieval', period:'Mali, Ghana, Songhai, Swahili', empires:['Ghana Empire','Mali Empire','Songhai','Great Zimbabwe'], dates:[{y:'750',e:'Ghana Empire rises'},{y:'1235',e:'Mali Empire founded'},{y:'1324',e:'Mansa Musa\'s pilgrimage'},{y:'1464',e:'Songhai ascendancy'}], figures:['Mansa Musa','Sundiata Keita','Askia the Great'] },
      { era:'earlyModern', period:'Atlantic slave trade, Ottoman North Africa', empires:['Ottoman North Africa','Ethiopian Empire'], dates:[{y:'1518',e:'Transatlantic slave trade begins'},{y:'1652',e:'Dutch Cape Colony'},{y:'1804',e:'Haitian independence (diaspora)'}], figures:['Menelik II (later)'] },
      { era:'modern', period:'Colonization · Decolonization', empires:['British/French/Belgian/German colonies'], dates:[{y:'1884',e:'Berlin Conference'},{y:'1957',e:'Ghana independence'},{y:'1960',e:'"Year of Africa"'},{y:'1994',e:'End of Apartheid'}], figures:['Nelson Mandela','Kwame Nkrumah','Haile Selassie'] },
    ],
    mideast: [
      { era:'ancient', period:'Mesopotamia · Persia', empires:['Sumer','Akkadian','Babylonian','Assyrian','Persian (Achaemenid)'], dates:[{y:'3500 BCE',e:'Writing invented (cuneiform)'},{y:'1754 BCE',e:'Code of Hammurabi'},{y:'550 BCE',e:'Cyrus the Great'},{y:'330 BCE',e:'Alexander conquers Persia'}], figures:['Hammurabi','Cyrus the Great','Darius I'] },
      { era:'medieval', period:'Rise of Islam · Caliphates', empires:['Rashidun','Umayyad','Abbasid','Seljuk','Ottoman'], dates:[{y:'610',e:'Muhammad\'s revelation'},{y:'632',e:'Death of Muhammad'},{y:'750',e:'Abbasid Caliphate'},{y:'1258',e:'Mongols sack Baghdad'},{y:'1453',e:'Ottomans take Constantinople'}], figures:['Muhammad','Saladin','Harun al-Rashid','Suleiman the Magnificent'] },
      { era:'earlyModern', period:'Ottoman Empire', empires:['Ottoman Empire','Safavid Persia'], dates:[{y:'1517',e:'Ottoman conquest of Egypt'},{y:'1683',e:'Siege of Vienna'}], figures:['Suleiman I'] },
      { era:'modern', period:'Post-Ottoman · Oil · Modern Middle East', empires:['British/French Mandates','Kingdoms & Republics'], dates:[{y:'1916',e:'Sykes–Picot Agreement'},{y:'1948',e:'State of Israel'},{y:'1979',e:'Iranian Revolution'},{y:'2011',e:'Arab Spring'}], figures:['Kemal Atatürk','Nasser','Khomeini'] },
    ],
    india: [
      { era:'ancient', period:'Indus · Maurya · Gupta', empires:['Indus Valley','Maurya','Gupta'], dates:[{y:'2600 BCE',e:'Indus Valley civilization'},{y:'322 BCE',e:'Mauryan Empire'},{y:'269 BCE',e:'Ashoka the Great'},{y:'320 CE',e:'Gupta Empire'}], figures:['Chandragupta Maurya','Ashoka','Chandragupta II'] },
      { era:'medieval', period:'Delhi Sultanate · Vijayanagara', empires:['Delhi Sultanate','Vijayanagara','Bahmani'], dates:[{y:'1206',e:'Delhi Sultanate founded'},{y:'1336',e:'Vijayanagara founded'}], figures:['Razia Sultan'] },
      { era:'earlyModern', period:'Mughal Empire', empires:['Mughal Empire'], dates:[{y:'1526',e:'Babur founds Mughal dynasty'},{y:'1556',e:'Akbar the Great'},{y:'1632',e:'Taj Mahal construction'},{y:'1707',e:'Aurangzeb dies, decline begins'}], figures:['Babur','Akbar','Shah Jahan','Aurangzeb'] },
      { era:'modern', period:'British Raj · Independence', empires:['British Raj','India & Pakistan'], dates:[{y:'1858',e:'British Raj begins'},{y:'1919',e:'Amritsar massacre'},{y:'1947',e:'Independence & Partition'}], figures:['Gandhi','Nehru','Jinnah'] },
    ],
    china: [
      { era:'ancient', period:'Xia · Shang · Zhou · Qin · Han', empires:['Shang','Zhou','Qin','Han'], dates:[{y:'1600 BCE',e:'Shang dynasty'},{y:'221 BCE',e:'Qin unification'},{y:'206 BCE',e:'Han dynasty founded'},{y:'100 BCE',e:'Silk Road opens'}], figures:['Qin Shi Huang','Confucius','Han Wudi'] },
      { era:'medieval', period:'Tang · Song · Yuan · Ming', empires:['Tang','Song','Yuan (Mongol)','Ming'], dates:[{y:'618',e:'Tang dynasty'},{y:'960',e:'Song dynasty'},{y:'1279',e:'Yuan (Mongol) rule'},{y:'1368',e:'Ming dynasty'},{y:'1405',e:'Zheng He\'s voyages'}], figures:['Kublai Khan','Zheng He','Tang Taizong'] },
      { era:'earlyModern', period:'Qing dynasty', empires:['Qing'], dates:[{y:'1644',e:'Qing dynasty'},{y:'1839',e:'Opium Wars begin'}], figures:['Kangxi','Qianlong'] },
      { era:'modern', period:'Republic · PRC', empires:['Republic of China','People\'s Republic'], dates:[{y:'1912',e:'Qing falls'},{y:'1949',e:'PRC founded'},{y:'1978',e:'Reform & Opening'}], figures:['Sun Yat-sen','Mao Zedong','Deng Xiaoping'] },
    ],
    japan: [
      { era:'medieval', period:'Heian · Kamakura · Muromachi', empires:['Heian','Kamakura shogunate','Ashikaga'], dates:[{y:'794',e:'Heian period begins'},{y:'1192',e:'Kamakura shogunate'},{y:'1333',e:'Muromachi period'}], figures:['Minamoto no Yoritomo','Prince Shōtoku'] },
      { era:'earlyModern', period:'Sengoku · Edo', empires:['Oda / Toyotomi / Tokugawa'], dates:[{y:'1603',e:'Tokugawa shogunate'},{y:'1853',e:'Perry arrives'}], figures:['Oda Nobunaga','Tokugawa Ieyasu'] },
      { era:'modern', period:'Meiji to modern Japan', empires:['Empire of Japan'], dates:[{y:'1868',e:'Meiji Restoration'},{y:'1905',e:'Russo-Japanese War'},{y:'1945',e:'WWII ends, Hiroshima & Nagasaki'}], figures:['Emperor Meiji','Hirohito'] },
    ],
    seasia: [
      { era:'medieval', period:'Khmer · Srivijaya · Majapahit', empires:['Khmer Empire','Srivijaya','Majapahit'], dates:[{y:'802',e:'Khmer Empire'},{y:'1113',e:'Angkor Wat built'},{y:'1293',e:'Majapahit founded'}], figures:['Jayavarman VII','Gajah Mada'] },
      { era:'earlyModern', period:'European colonization', empires:['Dutch East Indies','Spanish Philippines','French Indochina'], dates:[{y:'1521',e:'Magellan in Philippines'},{y:'1602',e:'Dutch East India Company'}], figures:[] },
      { era:'modern', period:'Decolonization · Vietnam · ASEAN', empires:['Independent nations'], dates:[{y:'1945',e:'Vietnam declares independence'},{y:'1975',e:'Vietnam War ends'},{y:'1967',e:'ASEAN formed'}], figures:['Ho Chi Minh','Sukarno','Lee Kuan Yew'] },
    ],
    oceania: [
      { era:'earlyModern', period:'Polynesian voyaging & contact', empires:['Maori','Aboriginal nations'], dates:[{y:'1000',e:'Polynesian expansion peaks'},{y:'1770',e:'Cook arrives in Australia'}], figures:['Captain Cook'] },
      { era:'modern', period:'Australia · NZ · Pacific', empires:['British dominions','Independent Pacific nations'], dates:[{y:'1901',e:'Australian federation'},{y:'1840',e:'Treaty of Waitangi'}], figures:[] },
    ],
    namerica: [
      { era:'ancient', period:'Mound-builders · Pueblo · Mesoamerica', empires:['Olmec','Teotihuacan','Maya','Mississippian'], dates:[{y:'1200 BCE',e:'Olmec civilization'},{y:'250 CE',e:'Classical Maya'},{y:'900',e:'Maya collapse begins'}], figures:[] },
      { era:'earlyModern', period:'Colonization · Aztec · Colonial America', empires:['Aztec','Spanish New Spain','British Thirteen Colonies'], dates:[{y:'1492',e:'Columbus'},{y:'1521',e:'Cortés conquers Aztec'},{y:'1607',e:'Jamestown'},{y:'1776',e:'American Revolution'}], figures:['Moctezuma II','George Washington','Cortés'] },
      { era:'modern', period:'USA · Canada · Mexico', empires:['USA','Mexico','Canada'], dates:[{y:'1861',e:'US Civil War'},{y:'1910',e:'Mexican Revolution'},{y:'1945',e:'Post-WWII superpower'}], figures:['Lincoln','MLK','Zapata'] },
    ],
    samerica: [
      { era:'ancient', period:'Chavín · Moche', empires:['Chavín','Moche'], dates:[{y:'900 BCE',e:'Chavín culture'},{y:'100 CE',e:'Moche civilization'}], figures:[] },
      { era:'earlyModern', period:'Inca · Spanish & Portuguese colonies', empires:['Inca Empire','Spanish Viceroyalty','Portuguese Brazil'], dates:[{y:'1438',e:'Inca Empire expansion'},{y:'1532',e:'Pizarro conquers Inca'},{y:'1500',e:'Portugal claims Brazil'}], figures:['Atahualpa','Pizarro'] },
      { era:'modern', period:'Independence · Modern states', empires:['Bolivarian Republics','Brazil'], dates:[{y:'1810',e:'Wars of Independence begin'},{y:'1822',e:'Brazilian independence'}], figures:['Simón Bolívar','San Martín'] },
    ],
  };

  // Schematic region boxes (viewBox 0 0 800 400). Not geographically accurate—
  // intended as a clickable educational layout.
  const REGION_PATHS = {
    namerica:      { d:'M 40,80 L 230,80 L 250,200 L 180,250 L 60,240 L 30,150 Z', label:{x:130,y:160} },
    samerica:      { d:'M 170,260 L 260,250 L 270,370 L 210,390 L 180,370 L 160,300 Z', label:{x:215,y:320} },
    europe:        { d:'M 340,60 L 440,60 L 450,140 L 380,155 L 340,130 Z', label:{x:395,y:105} },
    mediterranean: { d:'M 360,160 L 470,150 L 470,200 L 370,205 Z', label:{x:420,y:180} },
    africa:        { d:'M 370,215 L 490,215 L 510,340 L 440,375 L 390,350 L 360,270 Z', label:{x:430,y:290} },
    mideast:       { d:'M 485,160 L 555,150 L 570,220 L 500,225 Z', label:{x:525,y:190} },
    india:         { d:'M 565,170 L 620,170 L 640,250 L 595,275 L 565,230 Z', label:{x:600,y:220} },
    china:         { d:'M 645,110 L 735,110 L 740,200 L 655,205 Z', label:{x:690,y:160} },
    japan:         { d:'M 748,125 L 775,120 L 780,170 L 755,175 Z', label:{x:765,y:150} },
    seasia:        { d:'M 655,215 L 740,215 L 750,275 L 660,280 Z', label:{x:700,y:250} },
    oceania:       { d:'M 670,295 L 775,295 L 775,365 L 680,370 Z', label:{x:720,y:335} },
  };

  let state = { region:'europe', era:null };

  function renderPanel(body){
    const key = state.region;
    const data = DATA[key] || [];
    const filtered = state.era ? data.filter(d => d.era === state.era) : data;
    const reg = REGIONS[key];

    const erasHTML = ERAS.map(e => `<button type="button" class="ref-map-era ${state.era===e.id?'active':''}" data-era="${e.id}">${esc(e.label)}</button>`).join('') +
      `<button type="button" class="ref-map-era ${!state.era?'active':''}" data-era="">All eras</button>`;

    const svgPaths = Object.entries(REGION_PATHS).map(([k, info]) => {
      const classes = [];
      if(k === state.region) classes.push('active');
      if(state.era){
        const matches = (DATA[k] || []).some(d => d.era === state.era);
        if(matches && k !== state.region) classes.push('era-match');
      }
      return `<path data-region="${k}" class="${classes.join(' ')}" d="${info.d}"></path>
              <text x="${info.label.x}" y="${info.label.y}" text-anchor="middle" fill="currentColor" font-size="11" font-weight="700" pointer-events="none" style="opacity:.8">${esc(REGIONS[k].name)}</text>`;
    }).join('');

    body.innerHTML = `
      <div class="ref-map-eras">${erasHTML}</div>
      <div class="ref-map-wrap">
        <svg viewBox="0 0 800 400" class="ref-map-svg" role="img" aria-label="World regions map">
          ${svgPaths}
        </svg>
      </div>
      <div class="ref-map-panel">
        <h3>${esc(reg.name)}</h3>
        ${filtered.length ? filtered.map(d => `
          <div style="margin-bottom:16px">
            <h4>${esc(ERAS.find(e=>e.id===d.era)?.label || d.era)} — ${esc(d.period)}</h4>
            ${d.empires.length ? `<div style="font-size:.84rem;color:var(--muted2);margin-bottom:6px"><strong style="color:var(--text)">Major states/empires:</strong> ${d.empires.map(esc).join(' · ')}</div>` : ''}
            ${d.dates.length ? `<ul>${d.dates.map(dt => `<li><strong style="color:var(--accent);font-family:'JetBrains Mono',monospace">${esc(dt.y)}</strong> — ${esc(dt.e)}</li>`).join('')}</ul>` : ''}
            ${d.figures.length ? `<div style="font-size:.84rem;color:var(--muted2);margin-top:6px"><strong style="color:var(--text)">Key figures:</strong> ${d.figures.map(esc).join(' · ')}</div>` : ''}
          </div>
        `).join('') : `<div style="color:var(--muted);padding:12px 0">No records for this era in ${esc(reg.name)}.</div>`}
      </div>
    `;

    body.querySelectorAll('path[data-region]').forEach(p => {
      p.addEventListener('click', () => {
        state.region = p.dataset.region;
        renderPanel(body);
      });
    });
    body.querySelectorAll('[data-era]').forEach(b => {
      b.addEventListener('click', () => {
        const v = b.dataset.era;
        state.era = v || null;
        renderPanel(body);
      });
    });
  }

  function openHistoryMap(){
    if(typeof window.fluxOpenToolModal !== 'function') return;
    window.fluxOpenToolModal({
      id: 'history-map',
      emoji: '🗺️',
      title: 'History Map',
      renderBody: renderPanel,
    });
  }

  try{ window.openHistoryMap = openHistoryMap; }catch(e){}
})();
