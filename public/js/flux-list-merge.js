/* ── Merging a synced list item by item ──────────────────────────────────────
   The cloud pull used to replace the whole task list with whatever the row
   held. A pull that left before you ticked a task, and landed after, took the
   tick with it — and the next push wrote the old list back over the cloud too.
   Reported as "refreshes when first opened and undoes what you did".

   Now each item is compared with the copy both sides last agreed on (the
   base: what the cloud held after our last pull or push). Only the side that
   changed an item since then gets to change it. When both did, the newer
   updatedAt wins. A deletion travels as a tombstone, so an item missing from
   a row is not mistaken for one that was deleted.

   Pure functions only: no storage, no DOM. app.js owns where things live. */
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
   * opts.base: {key: hash} of what the cloud held when we last agreed, or null
   *            when this device has never recorded one.
   * opts.localTomb / opts.cloudTomb: {key: deletedAtMs}.
   * opts.lastSyncAt: ms of this device's last successful sync (only used
   *            without a base, to tell a new local item from a stale one).
   * Returns {list, differsFromCloud, differsFromLocal, kept:{local:[],cloud:[]}}.
   */
  function merge(local,cloud,opts){
    opts=opts||{};
    local=Array.isArray(local)?local:[];
    cloud=Array.isArray(cloud)?cloud:[];
    const base=opts.base&&typeof opts.base==='object'?opts.base:null;
    const lt=opts.localTomb||{},ct=opts.cloudTomb||{};
    const lastSyncAt=+opts.lastSyncAt||0;
    const L=new Map(),C=new Map();
    local.forEach(it=>L.set(keyOf(it),it));
    cloud.forEach(it=>C.set(keyOf(it),it));
    const pick=new Map();   // key -> item (or null for gone)
    const why={local:[],cloud:[]};

    function decide(k){
      const l=L.get(k),c=C.get(k);
      const hl=l!==undefined?itemHash(l):undefined;
      const hc=c!==undefined?itemHash(c):undefined;
      const hb=base?base[k]:undefined;
      if(l!==undefined&&c!==undefined){
        if(hl===hc)return stamp(c)>stamp(l)?c:l;
        const lc=!base||hl!==hb,cc=!base||hc!==hb;
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
        if(!base&&!gone&&born(l)<=lastSyncAt&&lastSyncAt)return null; // old copy, never told
        // No id to follow it by: the cloud had exactly this and now does not,
        // so it was edited or deleted elsewhere. Keeping it would leave the
        // old version beside the edited one.
        if(k.indexOf('h:')===0&&base&&hb!==undefined)return null;
        why.local.push(k);
        return l;                                          // new here, or edited since
      }
      if(c!==undefined){
        const gone=+lt[k]||0;
        if(gone&&stamp(c)<=gone){why.local.push(k);return null;} // deleted here
        if(base&&hb!==undefined&&hc===hb&&!gone){why.local.push(k);return null;}
        return c;                                          // new from another device
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
    // once, even if a side held it twice.
    const out=[];
    const fresh=[];
    const placed=new Set(twin.values());
    const emitted=new Set();
    const emit=(arr,k)=>{const v=pick.get(k);if(v&&!emitted.has(k)){emitted.add(k);arr.push(v);}};
    cloud.forEach(it=>{const k=keyOf(it);if(!L.has(k)&&!placed.has(k))emit(fresh,k);});
    local.forEach(it=>{const k=keyOf(it);emit(out,twin.has(k)?twin.get(k):k);});
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

  window.FluxListMerge={canon,itemHash,keyOf,hashes,merge,mergeTombs,sourceKey};
})();
