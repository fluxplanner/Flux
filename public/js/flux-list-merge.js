/* ── Merging a synced list item by item ──────────────────────────────────────
   The cloud pull used to replace the whole task list with whatever the row
   held. A pull that left before you ticked a task, and landed after, took the
   tick with it — and the next push wrote the old list back over the cloud too.
   Reported as "refreshes when first opened and undoes what you did".

   Now each item is compared with the copy both sides last agreed on (the
   base: what the cloud held after this tab's last pull or push). Only the
   side that changed an item since then gets to change it. When both did, the
   newer updatedAt wins. A deletion here travels as a tombstone, so an item
   missing from this side is never mistaken for one deleted here.

   No DOM. merge() is pure; createListSync() keeps one tab's bookkeeping in
   the storage app.js hands it. */
(function(){
  'use strict';

  /** JSON with sorted keys, so a jsonb round trip compares equal to what we sent. */
  function canon(v){
    if(v===null||typeof v!=='object')return JSON.stringify(v);
    if(Array.isArray(v))return '['+v.map(x=>{const s=canon(x);return s===undefined?'null':s;}).join(',')+']';
    const parts=[];
    for(const k of Object.keys(v).sort()){
      const s=canon(v[k]);
      if(s!==undefined)parts.push(JSON.stringify(k)+':'+s);
    }
    return '{'+parts.join(',')+'}';
  }

  /** FNV-1a, base 36. Short enough to keep a whole list's worth in storage. */
  function fnv(str){
    let h=0x811c9dc5;
    for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,0x01000193);}
    return (h>>>0).toString(36)+str.length.toString(36);
  }

  /** What an item says, ignoring when it was last stamped. */
  function itemHash(it){
    if(!it||typeof it!=='object')return fnv(canon(it));
    const copy={};
    for(const k in it)if(k!=='updatedAt')copy[k]=it[k];
    return fnv(canon(copy));
  }

  function keyOf(it){
    if(it&&typeof it==='object'&&it.id!=null&&it.id!=='')return String(it.id);
    return 'h:'+itemHash(it);
  }

  /** {key: hash} for a list. */
  function hashes(list){
    const out={};
    (Array.isArray(list)?list:[]).forEach(it=>{out[keyOf(it)]=itemHash(it);});
    return out;
  }

  /* Where an item came from, when it is a copy of something outside Flux (or
     the next step of a repeating task). Two devices that each import the same
     Canvas assignment before either has synced give it two ids; matched by
     this, the merge keeps one. */
  const SOURCE_FIELDS=[
    ['canvasAssignmentId','canvasCourseId'],['canvasQuizId','canvasCourseId'],['canvasCalendarEventId'],
    ['canvasModuleItemId'],['canvasAnnouncementId'],['canvasDiscussionId'],['classroomCourseWorkId'],
    ['googleTaskId'],['gmailMessageId'],['teacherAssignmentId'],
  ];
  function sourceKey(it){
    if(!it||typeof it!=='object')return '';
    for(const [f,g] of SOURCE_FIELDS){
      if(it[f]!=null&&it[f]!=='')return f+':'+(g?String(it[g])+':':'')+String(it[f]);
    }
    // A repeat spawns its next instance when it is ticked; ticked on two devices, it spawned twice.
    if(it.seriesId&&it.date&&!it.done)return 'series:'+it.seriesId+':'+it.date;
    return '';
  }

  const stamp=it=>(it&&+it.updatedAt)||0;
  const born=it=>(it&&(+it.updatedAt||+it.createdAt||(typeof it.id==='number'&&it.id>1e12?it.id:0)))||0;

  /**
   * local, cloud: arrays of items with ids.
   * opts.base: {key: hash} of what the cloud held when THIS TAB last agreed
   *            with it, or null when it has no record of that.
   * opts.localTomb / opts.cloudTomb: {key: deletedAtMs}.
   * opts.edited: {key: true} for items changed or deleted here since this
   *            account session began. Only read without a base.
   * Returns {list, differsFromCloud, differsFromLocal, kept:{local:[],cloud:[]}}.
   *
   * A local delete is never inferred. An item the cloud has and this side
   * lacks is kept unless a tombstone says it was deleted here: the local list
   * may be another tab's older copy, or may have failed to load at all, and
   * taking either for a delete emptied the cloud.
   */
  function merge(local,cloud,opts){
    opts=opts||{};
    local=Array.isArray(local)?local:[];
    cloud=Array.isArray(cloud)?cloud:[];
    const base=opts.base&&typeof opts.base==='object'?opts.base:null;
    const lt=opts.localTomb||{},ct=opts.cloudTomb||{};
    const edited=opts.edited&&typeof opts.edited==='object'?opts.edited:{};
    const L=new Map(),C=new Map();
    local.forEach(it=>L.set(keyOf(it),it));
    cloud.forEach(it=>C.set(keyOf(it),it));
    const pick=new Map();   // key -> item (or null for gone)
    const why={local:[],cloud:[]};

    /* No base: a new device, a guest signing in, an account switched to. There
       is nothing to tell a local edit from a stale copy by, so the cloud list
       is taken as it is — save for what was changed here since signing in. */
    function decideFresh(k,l,c,hl,hc){
      const mine=!!edited[k];
      if(l!==undefined&&c!==undefined){
        if(mine&&hl!==hc&&stamp(l)>stamp(c)){why.local.push(k);return l;}
        return c;
      }
      if(l!==undefined){
        const gone=+ct[k]||0;
        if(!mine||(gone&&stamp(l)<=gone))return null;
        why.local.push(k);
        return l;
      }
      if(c!==undefined){
        const gone=+lt[k]||0;
        if(mine&&gone&&stamp(c)<=gone){why.local.push(k);return null;}
        return c;
      }
      return null;
    }

    function decide(k){
      const l=L.get(k),c=C.get(k);
      const hl=l!==undefined?itemHash(l):undefined;
      const hc=c!==undefined?itemHash(c):undefined;
      if(!base)return decideFresh(k,l,c,hl,hc);
      const hb=base[k];
      if(l!==undefined&&c!==undefined){
        if(hl===hc)return stamp(c)>stamp(l)?c:l;
        const lc=hl!==hb,cc=hc!==hb;
        if(!cc){why.local.push(k);return l;}
        if(!lc){
          // The cloud copy is older than ours: another device pushed a list it
          // had not refreshed. Keep ours and send it back up.
          if(stamp(c)<stamp(l)){why.local.push(k);return l;}
          return c;
        }
        if(stamp(l)>stamp(c)){why.local.push(k);return l;}
        return c;
      }
      if(l!==undefined){
        const gone=+ct[k]||0;
        if(gone&&stamp(l)<=gone)return null;              // deleted on another device
        // The cloud had exactly this when this tab last agreed with it, and
        // the row no longer does: it was deleted elsewhere — the Claude
        // connector deletes without a tombstone. Edited here since, it stays.
        // (An item without an id is keyed by its content, so this also drops
        // the old version of one edited elsewhere.)
        if(hb!==undefined&&hl===hb)return null;
        why.local.push(k);
        return l;                                          // new here, or edited since
      }
      if(c!==undefined){
        const gone=+lt[k]||0;
        if(gone&&stamp(c)<=gone){why.local.push(k);return null;} // deleted here
        return c;                                          // never taken for a local delete
      }
      return null;
    }

    const keys=new Set([...L.keys(),...C.keys()]);
    keys.forEach(k=>pick.set(k,decide(k)));

    // The same thing made on both sides since they last agreed (see
    // sourceKey): one item, under the id the cloud already has, so no other
    // device gains a second copy — with this device's edits if they are newer.
    const isNew=k=>!base||base[k]===undefined;
    const twin=new Map();   // local key -> cloud key it was folded into
    const bySource=new Map();
    C.forEach((c,k)=>{
      if(L.has(k)||!pick.get(k)||!isNew(k))return;
      const s=sourceKey(c);
      if(s&&!bySource.has(s))bySource.set(s,k);
    });
    if(bySource.size)L.forEach((l,k)=>{
      if(C.has(k)||!pick.get(k)||!isNew(k))return;
      const s=sourceKey(l),kc=s&&bySource.get(s);
      if(!kc)return;
      bySource.delete(s);
      const c=pick.get(kc);
      if(stamp(l)>stamp(c))pick.set(kc,Object.assign({},l,{id:c.id}));
      pick.set(k,null);
      twin.set(k,kc);
    });

    // Local order first (it is what the student is looking at), then anything
    // new from the cloud, newest-first the way addTask() unshifts. Each item
    // once, even if a side held it twice. Without a base it is the cloud's
    // list, so the cloud's order, after anything made here since signing in.
    const out=[];
    const fresh=[];
    const placed=new Set(twin.values());
    const emitted=new Set();
    const emit=(arr,k)=>{const v=pick.get(k);if(v&&!emitted.has(k)){emitted.add(k);arr.push(v);}};
    if(base){
      cloud.forEach(it=>{const k=keyOf(it);if(!L.has(k)&&!placed.has(k))emit(fresh,k);});
      local.forEach(it=>{const k=keyOf(it);emit(out,twin.has(k)?twin.get(k):k);});
    }else{
      local.forEach(it=>{const k=keyOf(it);if(!C.has(k)&&!twin.has(k))emit(fresh,k);});
      cloud.forEach(it=>emit(out,keyOf(it)));
    }
    const list=fresh.concat(out);

    const sameAs=(arr)=>{
      if(arr.length!==list.length)return false;
      for(let i=0;i<arr.length;i++)if(arr[i]!==list[i]&&canon(arr[i])!==canon(list[i]))return false;
      return true;
    };
    const cloudSet=new Map(cloud.map(it=>[keyOf(it),itemHash(it)]));
    let differsFromCloud=list.length!==cloud.length;
    if(!differsFromCloud)for(const it of list){if(cloudSet.get(keyOf(it))!==itemHash(it)){differsFromCloud=true;break;}}
    return{list,differsFromCloud,differsFromLocal:!sameAs(local),kept:why};
  }

  /** Union two tombstone maps, keeping the later time, dropping old ones. */
  function mergeTombs(a,b,now,maxAgeMs){
    const out={};
    const lim=(+now||Date.now())-(+maxAgeMs||45*864e5);
    [a,b].forEach(m=>{
      if(!m||typeof m!=='object')return;
      Object.keys(m).forEach(k=>{const t=+m[k]||0;if(t>lim&&t>(out[k]||0))out[k]=t;});
    });
    return out;
  }

  /** The `max` newest items (by updatedAt / createdAt / a time id), in the order they were in. */
  function newest(list,max){
    if(!Array.isArray(list)||list.length<=max)return list;
    const keep=new Set(list.map((it,i)=>[born(it),i]).sort((a,b)=>(b[0]-a[0])||(a[1]-b[1])).slice(0,Math.max(0,max)).map(x=>x[1]));
    return list.filter((_,i)=>keep.has(i));
  }

  const BASE_KEY='flux_sync_base_v1';
  const TOMB_KEY='flux_list_tombstones_v1';
  const STORE_OF={tasks:'tasks',notes:'flux_notes'};
  const cloudKeyOf=sk=>sk==='flux_notes'?'notes':'tasks';

  /**
   * One tab's bookkeeping for the two merged lists.
   *
   * store.get(k) / store.set(k, v) read and write shared storage as it is
   * (localStorage in the app; nothing here goes through edit tracking).
   *
   * Every tab has its own list in memory, so it has its own base too: the
   * hashes of what the cloud held when THIS tab last agreed with it. It is
   * read from storage once, with the lists, and after that only this tab's
   * own pulls and pushes move it. Another tab's push used to move it for
   * everyone, and this tab then took its older copy of a task for a newer
   * local edit — and a task it had not seen yet for one it had deleted.
   *
   * The base is stored with the list it belongs to (`by` names the tab that
   * wrote both), so the next tab to open reads a list and the base it was
   * agreed against, not one tab's list with another tab's base.
   */
  function createListSync(store,clock){
    const now=typeof clock==='function'?clock:()=>Date.now();
    const tab='t'+Math.random().toString(36).slice(2,10)+now().toString(36);
    const read=(k,d)=>{try{const v=store.get(k);return v==null?d:v;}catch(_){return d;}};
    let base=null;                       // {tasks, notes}: this tab's, or null each
    let seen={};                         // storeKey -> {key: hash} as this tab last saved it
    let edited={tasks:{},notes:{}};      // cloudKey -> {key: true} changed here this session

    function persistBase(ck,onlyIfOurs){
      if(!base)api.loadBase();
      const all=read(BASE_KEY,{})||{};
      const by=(all.by&&typeof all.by==='object')?all.by:{};
      if(onlyIfOurs&&by[ck]!==tab)return;   // the list stored now is another tab's
      if(base&&base[ck])all[ck]=base[ck];else delete all[ck];
      by[ck]=tab;all.by=by;
      try{store.set(BASE_KEY,all);}catch(_){}
    }

    const api={
      tab,
      /** Read the stored base into this tab. Call when the lists are read from storage. */
      loadBase(){
        const all=read(BASE_KEY,null);
        base={tasks:(all&&all.tasks)||null,notes:(all&&all.notes)||null};
      },
      /** This tab's base for 'tasks' or 'notes' (null: none). */
      base(ck){if(!base)api.loadBase();return base[ck]||null;},
      /** The cloud now holds this list (after this tab's pull or push). */
      recordBase(ck,listOrHashes){
        if(!listOrHashes||typeof listOrHashes!=='object')return;
        if(!base)api.loadBase();
        base[ck]=Array.isArray(listOrHashes)?hashes(listOrHashes):listOrHashes;
        // A push does not write the list, so the base is stored only while the
        // stored list is still the one this tab wrote.
        persistBase(ck,true);
      },
      /** A new account session: nothing changed in it yet, and these lists are what this tab has. */
      startSession(lists){
        edited={tasks:{},notes:{}};
        seen={};
        Object.keys(lists||{}).forEach(sk=>api.prime(sk,lists[sk]));
      },
      /** The next save of this list is not an edit (it is what a merge produced, or what was loaded). */
      prime(sk,list){seen[sk]=hashes(list);},
      edited(ck){return edited[ck]||{};},
      /**
       * Called with each save of 'tasks' or 'flux_notes': stamps updatedAt on
       * what changed and leaves a tombstone for what went.
       */
      noteEdits(sk,list){
        if(!Array.isArray(list))return;
        const ck=cloudKeyOf(sk);
        const prev=seen[sk]||hashes(read(sk,[]));
        const next={};
        const t=now();
        const ed=edited[ck]||(edited[ck]={});
        list.forEach(it=>{
          if(!it||typeof it!=='object')return;
          const key=keyOf(it),h=itemHash(it);
          next[key]=h;
          if(prev[key]!==h){it.updatedAt=t;ed[key]=true;}
        });
        seen[sk]=next;
        const tombAll=read(TOMB_KEY,{})||{};
        const mine=tombAll[ck]||{};
        let changed=false;
        Object.keys(prev).forEach(key=>{if(!(key in next)){mine[key]=t;ed[key]=true;changed=true;}});
        // Back again here (an undo): no longer deleted. One this tab simply
        // still has is not a restore — another tab may have deleted it.
        Object.keys(next).forEach(key=>{if(mine[key]&&!(key in prev)){delete mine[key];changed=true;}});
        if(changed){tombAll[ck]=mergeTombs(mine,null,t);try{store.set(TOMB_KEY,tombAll);}catch(_){}}
        persistBase(ck,false);
      },
      /** Merge a pulled cloud list into this tab's; stores the result and returns the merge. */
      pull(ck,local,cloud,cloudTombAll){
        const sk=STORE_OF[ck]||ck;
        local=Array.isArray(local)?local:[];
        // An edit can be in memory and not saved yet (a tick mid-animation):
        // stamp it now, so the merge sees it as the newest thing it is.
        api.noteEdits(sk,local);
        const tombAll=read(TOMB_KEY,{})||{};
        const cloudTomb=(cloudTombAll&&typeof cloudTombAll==='object'&&cloudTombAll[ck])||{};
        const r=merge(local,cloud,{base:api.base(ck),localTomb:tombAll[ck]||{},cloudTomb,edited:edited[ck]});
        tombAll[ck]=mergeTombs(tombAll[ck],cloudTomb,now());
        try{store.set(TOMB_KEY,tombAll);}catch(_){}
        base[ck]=hashes(cloud);
        api.prime(sk,r.list);
        try{store.set(sk,r.list);}catch(_){}
        persistBase(ck,false);
        return r;
      },
      /**
       * Too much stored: keep the `max` newest. Written as it is — making room
       * on this device is not deleting anything, so it leaves no tombstones
       * (the cloud keeps the rest).
       */
      compact(sk,max){
        const list=read(sk,null);
        if(!Array.isArray(list)||list.length<=max)return list;
        const kept=newest(list,max);
        try{store.set(sk,kept);}catch(_){}
        if(seen[sk])api.prime(sk,kept);
        return kept;
      },
    };
    return api;
  }

  window.FluxListMerge={canon,itemHash,keyOf,hashes,merge,mergeTombs,sourceKey,newest,createListSync};
})();
