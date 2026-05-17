/**
 * Flux Planner — smart time estimation learning (additive)
 * Adjusts rolling est/actual ratio per subject; consumed by avg hints + future UI.
 */
(function(){
  const KEY='flux_est_learn_v1';
  function nk(k){
    try{return typeof fluxNamespacedKey==='function'?fluxNamespacedKey(k):k;}catch(_){return k;}
  }
  function read(){
    if(typeof load==='function'){
      try{
        const o=load(KEY,{});
        return o&&typeof o==='object'&&!Array.isArray(o)?o:{};
      }catch(_){}
    }
    try{
      const raw=localStorage.getItem(nk(KEY));
      if(raw==null||raw==='')return{};
      const o=JSON.parse(raw);
      return o&&typeof o==='object'&&!Array.isArray(o)?o:{};
    }catch(_){return{};}
  }
  function write(o){
    if(typeof save==='function'){
      try{save(KEY,o||{});return;}catch(_){}
    }
    try{localStorage.setItem(nk(KEY),JSON.stringify(o||{}));}catch(_){}
  }
  window.FluxEstimateLearn={
    record(subjectKey,estimatedMin,actualMin){
      if(!subjectKey||!estimatedMin||!actualMin)return;
      const data=read();
      const cur=data[subjectKey]||{n:0,ratio:1};
      const sample=actualMin/Math.max(1,estimatedMin);
      const n=Math.min(40,cur.n+1);
      const ratio=(cur.ratio*cur.n+sample)/n;
      data[subjectKey]={n,ratio:Math.max(0.4,Math.min(2.2,ratio))};
      write(data);
    },
    suggestedEstForSubject(subjectKey,fallback){
      const data=read()[subjectKey];
      if(!data||data.n<2)return fallback;
      const base=fallback||30;
      return Math.max(5,Math.round(base*data.ratio));
    }
  };
})();
