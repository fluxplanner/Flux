/**
 * Flux Planner — smart time estimation learning (additive)
 * Adjusts rolling est/actual ratio per subject; consumed by avg hints + future UI.
 */
(function(){
  const KEY='flux_est_learn_v1';
  function read(){
    try{return JSON.parse(localStorage.getItem(KEY)||'{}');}catch(e){return{};}
  }
  function write(o){
    try{localStorage.setItem(KEY,JSON.stringify(o));}catch(e){}
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
