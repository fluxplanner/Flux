/**
 * Flux visual premium — cursor-linked ambient (additive, no layout changes).
 * Sets --flux-cursor-x / --flux-cursor-y on <html> for #fluxCursorAmbient in flux-visual-premium.css
 */
(function(){
  if(!window.matchMedia||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  function ensureLayer(){
    if(document.getElementById('fluxCursorAmbient'))return;
    var el=document.createElement('div');
    el.id='fluxCursorAmbient';
    el.setAttribute('aria-hidden','true');
    var app=document.getElementById('app');
    if(app&&app.parentNode===document.body)document.body.insertBefore(el,app);
    else document.body.appendChild(el);
  }
  var raf=null;
  function tick(e){
    if(raf)return;
    raf=requestAnimationFrame(function(){
      raf=null;
      var w=Math.max(1,window.innerWidth),h=Math.max(1,window.innerHeight);
      document.documentElement.style.setProperty('--flux-cursor-x',(e.clientX/w*100)+'%');
      document.documentElement.style.setProperty('--flux-cursor-y',(e.clientY/h*100)+'%');
    });
  }
  function boot(){
    ensureLayer();
    document.addEventListener('mousemove',tick,{passive:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();
