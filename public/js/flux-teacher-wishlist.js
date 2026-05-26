/* ════════════════════════════════════════════════════════════════════════════
 * FLUX WISHLIST — teacher-requested features (May 2026)
 *
 * Bundles four small additive features that mount themselves onto the
 * existing dashboard / calendar / task list without touching core app.js.
 *
 *   1. Gratitude journal       — 3 small wins per day, dashboard card
 *   2. Class-section planner   — 4 or 6 period slots with name + notes
 *   3. Priority sort toggle    — re-orders #taskList by priority high→low
 *   4. Important-date pinning  — pin any calendar day; gets a star + glow
 *
 * All state persists to localStorage via fluxNamespacedKey when available
 * so it's per-user. Each sub-feature can be disabled individually via the
 * FluxWishlist.disable(name) API. Safe to delete this file to revert.
 * ──────────────────────────────────────────────────────────────────────────── */
(function(){
  'use strict';

  /* ── Storage helpers ── */
  function NS(k){
    try{
      return (typeof window.fluxNamespacedKey==='function')?fluxNamespacedKey(k):k;
    }catch(_){return k;}
  }
  function read(k,def){
    try{
      var v=localStorage.getItem(NS(k));
      if(v==null)return def;
      var p=JSON.parse(v);
      return (p==null)?def:p;
    }catch(_){return def;}
  }
  function write(k,v){
    try{localStorage.setItem(NS(k),JSON.stringify(v));}catch(_){}
  }
  function todayIso(){return new Date().toISOString().slice(0,10);}
  function esc(s){
    return String(s==null?'':s).replace(/[<>&"']/g,function(c){
      return ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'})[c];
    });
  }

  /* ── Disabled-flag check ── */
  function isDisabled(name){
    var d=read('flux_wishlist_disabled',{});
    return !!d[name];
  }
  function setDisabled(name,off){
    var d=read('flux_wishlist_disabled',{});
    if(off)d[name]=true; else delete d[name];
    write('flux_wishlist_disabled',d);
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * 1) GRATITUDE JOURNAL
   * Three lines per day. Cap at 5. Calm, dashboard-front widget.
   * ══════════════════════════════════════════════════════════════════════════ */
  function readGrats(){return read('flux_gratitude_v1',{});}
  function writeGrats(e){write('flux_gratitude_v1',e);}

  function mountGratitudeCard(){
    if(isDisabled('gratitude'))return;
    var host=document.querySelector('#dashboard')||document.querySelector('.dashboard');
    if(!host)return;
    if(document.getElementById('fluxGratitudeCard'))return;
    var card=document.createElement('div');
    card.className='card fluxw-card fluxw-gratitude';
    card.id='fluxGratitudeCard';
    card.innerHTML=
      '<div class="fluxw-hd">'+
        '<span class="fluxw-emoji" aria-hidden="true">🌿</span>'+
        '<h3>Gratitude</h3>'+
        '<span class="fluxw-sub">Three small wins today</span>'+
      '</div>'+
      '<div class="fluxw-grats" id="fluxGratList"></div>'+
      '<div class="fluxw-grat-input-row">'+
        '<input type="text" id="fluxGratInput" placeholder="I am grateful for…" maxlength="180" aria-label="New gratitude entry">'+
        '<button type="button" class="fluxw-btn" onclick="FluxWishlist.addGratitude()">Add</button>'+
      '</div>'+
      '<details class="fluxw-grat-history">'+
        '<summary>Past entries</summary>'+
        '<div class="fluxw-grat-past" id="fluxGratPast"></div>'+
      '</details>';
    host.appendChild(card);
    var inp=card.querySelector('#fluxGratInput');
    if(inp){
      inp.addEventListener('keydown',function(e){
        if(e.key==='Enter'){e.preventDefault();addGratitude();}
      });
    }
    renderGratitudeList();
  }

  function renderGratitudeList(){
    var list=document.getElementById('fluxGratList');
    if(list){
      var all=readGrats();
      var today=all[todayIso()]||[];
      if(today.length){
        list.innerHTML=today.map(function(t,i){
          return '<div class="fluxw-grat-row"><span>'+esc(t)+'</span>'+
            '<button type="button" class="fluxw-grat-del" aria-label="Remove" onclick="FluxWishlist.removeGratitude('+i+')">×</button>'+
          '</div>';
        }).join('');
      }else{
        list.innerHTML='<div class="fluxw-empty">No entries yet today. Add something small you appreciated.</div>';
      }
    }
    renderGratitudePast();
  }

  function renderGratitudePast(){
    var past=document.getElementById('fluxGratPast');
    if(!past)return;
    var all=readGrats();
    var keys=Object.keys(all).filter(function(k){return k!==todayIso();}).sort().reverse().slice(0,7);
    if(!keys.length){past.innerHTML='<div class="fluxw-empty">Past entries will show here once you have any.</div>';return;}
    past.innerHTML=keys.map(function(k){
      var d=new Date(k+'T00:00:00');
      var label=d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
      return '<div class="fluxw-grat-day"><div class="fluxw-grat-day-h">'+label+'</div>'+
        (all[k]||[]).map(function(t){return '<div class="fluxw-grat-past-row">• '+esc(t)+'</div>';}).join('')+
      '</div>';
    }).join('');
  }

  function addGratitude(){
    var inp=document.getElementById('fluxGratInput');
    if(!inp)return;
    var v=(inp.value||'').trim();
    if(!v)return;
    var all=readGrats();
    var k=todayIso();
    all[k]=all[k]||[];
    if(all[k].length>=5){
      try{if(typeof showToast==='function')showToast('Five is plenty for one day 🌿','info');}catch(_){}
      return;
    }
    all[k].push(v);
    writeGrats(all);
    inp.value='';
    renderGratitudeList();
  }

  function removeGratitude(idx){
    var all=readGrats();
    var k=todayIso();
    if(!all[k])return;
    all[k].splice(idx,1);
    if(!all[k].length)delete all[k];
    writeGrats(all);
    renderGratitudeList();
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * 2) CLASS-SECTION PLANNER (4 or 6 periods)
   * For educators. A grid of class periods with name + notes; persists.
   * ══════════════════════════════════════════════════════════════════════════ */
  function isEducator(){
    try{
      return !!(window.FluxRole&&FluxRole.isEducator&&FluxRole.isEducator());
    }catch(_){return false;}
  }
  function readSections(){return read('flux_class_sections_v1',{});}
  function writeSections(s){write('flux_class_sections_v1',s);}
  function periodCount(){return Number(read('flux_class_period_count',6))||6;}

  function mountClassSections(){
    if(isDisabled('sections'))return;
    if(!isEducator())return;
    // Per teacher feedback: don't crowd the main dashboard with sections.
    // Mount inside the educator Work hub / their role dashboard instead.
    // Falls through to a few likely hosts. If none are present, we just
    // wait — the boot poller will retry as panels mount.
    var host=
      document.querySelector('#staffHub')||
      document.querySelector('#teacherDashboardBody')||
      document.querySelector('#counselorDashboardBody')||
      document.querySelector('#staffWorkboard')||
      null;
    if(!host)return;
    if(document.getElementById('fluxClassSectionsCard'))return;
    var pc=periodCount();
    var card=document.createElement('div');
    card.className='card fluxw-card fluxw-classes';
    card.id='fluxClassSectionsCard';
    card.innerHTML=
      '<div class="fluxw-hd">'+
        '<span class="fluxw-emoji" aria-hidden="true">🏫</span>'+
        '<h3>Today\'s sections</h3>'+
        '<span class="fluxw-sub" id="fluxSectionSub">'+pc+' periods</span>'+
        '<select class="fluxw-period-count" id="fluxPeriodCount" aria-label="Number of class periods" onchange="FluxWishlist.setPeriodCount(this.value)">'+
          '<option value="4"'+(pc===4?' selected':'')+'>4 periods</option>'+
          '<option value="6"'+(pc===6?' selected':'')+'>6 periods</option>'+
          '<option value="8"'+(pc===8?' selected':'')+'>8 periods</option>'+
        '</select>'+
      '</div>'+
      '<div class="fluxw-sections" id="fluxSectionGrid"></div>';
    host.appendChild(card);
    renderSections();
  }

  function renderSections(){
    var grid=document.getElementById('fluxSectionGrid');
    if(!grid)return;
    var pc=periodCount();
    var all=readSections();
    var parts=[];
    for(var i=1;i<=pc;i++){
      var d=all[i]||{name:'',notes:''};
      parts.push(
        '<div class="fluxw-section" data-period="'+i+'">'+
          '<div class="fluxw-section-num">P'+i+'</div>'+
          '<input class="fluxw-section-name" type="text" placeholder="Class name" value="'+esc(d.name)+'" maxlength="60" '+
            'oninput="FluxWishlist.updateSection('+i+',\'name\',this.value)">'+
          '<textarea class="fluxw-section-notes" placeholder="Agenda · materials · reminders…" rows="3" maxlength="600" '+
            'oninput="FluxWishlist.updateSection('+i+',\'notes\',this.value)">'+esc(d.notes)+'</textarea>'+
        '</div>'
      );
    }
    grid.innerHTML=parts.join('');
  }

  function setPeriodCount(v){
    var n=Number(v)||6;
    write('flux_class_period_count',n);
    var sub=document.getElementById('fluxSectionSub');
    if(sub)sub.textContent=n+' periods';
    renderSections();
  }

  function updateSection(i,field,value){
    var all=readSections();
    all[i]=all[i]||{name:'',notes:''};
    all[i][field]=value;
    writeSections(all);
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * 3) PRIORITY SORT TOGGLE
   * Adds a chip near filterChips; when active, re-sorts #taskList by
   * priority high→med→low after each renderTasks call.
   * ══════════════════════════════════════════════════════════════════════════ */
  function prioritySortOn(){return !!read('flux_priority_sort',false);}

  function mountPrioritySort(){
    if(isDisabled('prioritySort'))return;
    var anchor=document.getElementById('filterChips');
    if(!anchor)return;
    if(document.getElementById('fluxPrioritySortToggle'))return;
    var btn=document.createElement('button');
    btn.type='button';
    btn.id='fluxPrioritySortToggle';
    btn.className='fluxw-pri-toggle';
    btn.title='Sort by importance (high → low)';
    btn.setAttribute('aria-pressed',prioritySortOn()?'true':'false');
    btn.innerHTML='<span aria-hidden="true">⚡</span><span>By importance</span>';
    btn.addEventListener('click',function(){
      write('flux_priority_sort',!prioritySortOn());
      btn.setAttribute('aria-pressed',prioritySortOn()?'true':'false');
      btn.classList.toggle('fluxw-active',prioritySortOn());
      try{if(typeof window.renderTasks==='function')window.renderTasks();}catch(_){}
      applyPrioritySortToDom();
    });
    btn.classList.toggle('fluxw-active',prioritySortOn());
    // Insert after the chip row
    if(anchor.parentNode)anchor.parentNode.insertBefore(btn,anchor.nextSibling);
  }

  function applyPrioritySortToDom(){
    if(!prioritySortOn())return;
    var list=document.getElementById('taskList');
    if(!list)return;
    var items=Array.from(list.querySelectorAll('.task-item'));
    if(items.length<2)return;
    function rank(el){
      if(el.classList.contains('priority-high'))return 0;
      if(el.classList.contains('priority-med'))return 1;
      return 2;
    }
    items.sort(function(a,b){return rank(a)-rank(b);});
    items.forEach(function(it){list.appendChild(it);});
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * 4) IMPORTANT-DATE PINNING
   * Toggle "important" on a date; calendar cells with that ISO date get a
   * star + glow. Mounts a "Pin today" button on the dashboard.
   * ══════════════════════════════════════════════════════════════════════════ */
  function readPinned(){return read('flux_important_dates_v1',[]);}
  function writePinned(arr){write('flux_important_dates_v1',arr);}
  function isPinned(iso){return readPinned().indexOf(iso)>=0;}

  function toggleImportantDate(iso){
    if(!iso)return false;
    var cur=readPinned();
    var i=cur.indexOf(iso);
    if(i>=0)cur.splice(i,1); else cur.push(iso);
    writePinned(cur);
    paintImportantBadges();
    return i<0;
  }

  function paintImportantBadges(){
    var pinned=readPinned();
    var set={};
    pinned.forEach(function(d){set[d]=true;});
    document.querySelectorAll('.cal-day[data-cal-date]').forEach(function(el){
      var iso=el.getAttribute('data-cal-date');
      var on=!!set[iso];
      el.classList.toggle('fluxw-cal-important',on);
      // Add star marker once
      var existing=el.querySelector('.fluxw-cal-star');
      if(on&&!existing){
        var star=document.createElement('span');
        star.className='fluxw-cal-star';
        star.setAttribute('aria-hidden','true');
        star.textContent='★';
        el.appendChild(star);
      }else if(!on&&existing){
        existing.remove();
      }
    });
  }

  function mountImportantDateButton(){
    if(isDisabled('importantDates'))return;
    var host=document.querySelector('#dashboard');
    if(!host)return;
    if(document.getElementById('fluxImportantTodayCard'))return;
    // Compact bar — slim, doesn't clutter
    var bar=document.createElement('div');
    bar.className='card fluxw-card fluxw-important-bar';
    bar.id='fluxImportantTodayCard';
    bar.innerHTML=
      '<div class="fluxw-hd">'+
        '<span class="fluxw-emoji" aria-hidden="true">★</span>'+
        '<h3>Important dates</h3>'+
        '<span class="fluxw-sub" id="fluxImportantCount"></span>'+
      '</div>'+
      '<div class="fluxw-imp-row">'+
        '<input type="date" id="fluxImpDateInp" aria-label="Pick a date to pin" value="'+esc(todayIso())+'">'+
        '<button type="button" class="fluxw-btn" id="fluxImpPinBtn" onclick="FluxWishlist.pinDateFromInput()">Pin</button>'+
        '<button type="button" class="fluxw-btn-sec" onclick="FluxWishlist.pinDateFromInput(true)">Unpin</button>'+
      '</div>'+
      '<div class="fluxw-imp-list" id="fluxImpList"></div>';
    host.appendChild(bar);
    renderImportantList();
  }

  function pinDateFromInput(unpin){
    var inp=document.getElementById('fluxImpDateInp');
    if(!inp||!inp.value)return;
    var iso=inp.value;
    var cur=readPinned();
    var i=cur.indexOf(iso);
    if(unpin){
      if(i>=0)cur.splice(i,1);
    }else{
      if(i<0)cur.push(iso);
    }
    writePinned(cur);
    paintImportantBadges();
    renderImportantList();
  }

  function renderImportantList(){
    var list=document.getElementById('fluxImpList');
    var count=document.getElementById('fluxImportantCount');
    if(!list)return;
    var pinned=readPinned().slice().sort();
    var future=pinned.filter(function(d){return d>=todayIso();}).slice(0,8);
    if(count)count.textContent=pinned.length?pinned.length+' pinned':'none yet';
    if(!future.length){
      list.innerHTML='<div class="fluxw-empty">Pin a date to mark it as important — it will glow on the calendar.</div>';
      return;
    }
    list.innerHTML=future.map(function(d){
      var label=new Date(d+'T00:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
      return '<div class="fluxw-imp-row-item">'+
        '<span class="fluxw-imp-star" aria-hidden="true">★</span>'+
        '<span>'+esc(label)+'</span>'+
        '<button type="button" class="fluxw-grat-del" aria-label="Unpin" onclick="FluxWishlist.unpinDate(\''+esc(d)+'\')">×</button>'+
      '</div>';
    }).join('');
  }

  function unpinDate(iso){
    var cur=readPinned();
    var i=cur.indexOf(iso);
    if(i>=0)cur.splice(i,1);
    writePinned(cur);
    paintImportantBadges();
    renderImportantList();
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * BOOT
   * Mount on dashboard render. Hooks: wrap renderTasks / renderCalendar /
   * nav() so widgets re-appear after re-renders. Bounded polling for the
   * very first mount to handle async dashboard hydration.
   * ══════════════════════════════════════════════════════════════════════════ */
  function mountAll(){
    try{mountGratitudeCard();}catch(_){}
    try{mountClassSections();}catch(_){}
    try{mountPrioritySort();}catch(_){}
    try{mountImportantDateButton();}catch(_){}
    try{paintImportantBadges();}catch(_){}
    try{applyPrioritySortToDom();}catch(_){}
  }

  function wrapFn(name,after){
    var orig=window[name];
    if(typeof orig!=='function')return false;
    if(orig._fluxWishlistWrapped)return true;
    function wrapped(){
      var r=orig.apply(this,arguments);
      try{setTimeout(after,0);}catch(_){}
      return r;
    }
    wrapped._fluxWishlistWrapped=true;
    try{window[name]=wrapped;return true;}catch(_){return false;}
  }

  function startBoot(){
    // Bounded polling for first mount, up to ~12s.
    var tries=0;
    function tick(){
      tries++;
      var visible=document.getElementById('app')?.classList.contains('visible');
      if(visible)mountAll();
      // Try to wrap helpers each tick until they exist & get wrapped
      wrapFn('renderTasks',applyPrioritySortToDom);
      wrapFn('renderCalendar',paintImportantBadges);
      wrapFn('nav',function(){setTimeout(mountAll,80);});
      if(tries<30)setTimeout(tick,400);
    }
    setTimeout(tick,250);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',startBoot,{once:true});
  }else{
    startBoot();
  }

  /* ══ Public API ══ */
  window.FluxWishlist={
    addGratitude:addGratitude,
    removeGratitude:removeGratitude,
    setPeriodCount:setPeriodCount,
    updateSection:updateSection,
    toggleImportantDate:toggleImportantDate,
    isImportantDate:isPinned,
    pinDateFromInput:pinDateFromInput,
    unpinDate:unpinDate,
    paintImportantBadges:paintImportantBadges,
    applyPrioritySortToDom:applyPrioritySortToDom,
    refresh:mountAll,
    disable:function(name){setDisabled(name,true);},
    enable:function(name){setDisabled(name,false);mountAll();}
  };
})();
