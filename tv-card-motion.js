'use strict';
/* INCYDENTY: one TV card reveal, matching Wyniki i normy.
   Presentation only: no changes to data, schedules or playback timing. */
(()=>{
  if(document.getElementById('inc-tv-card-motion')) return;
  const style=document.createElement('style');
  style.id='inc-tv-card-motion';
  style.textContent=`
    @keyframes incTVCardRise {
      from {opacity:0;transform:translate3d(0,26px,0)}
      to {opacity:1;transform:translate3d(0,0,0)}
    }
    body.unified-tv .inc-tv-card-rise {
      animation:incTVCardRise .68s cubic-bezier(.20,.75,.22,1) both!important;
      animation-delay:var(--inc-tv-delay,0ms)!important;
    }
    /* A single entrance owns each tile. Existing independently triggered
       animations must not compete with the shared TV reveal. */
    body.unified-tv #cards>.card,
    body.unified-tv #workerCards>.employee-card,
    body.unified-tv .isa-tv-frame {
      animation:none;
    }
    @media(prefers-reduced-motion:reduce) {
      body.unified-tv .inc-tv-card-rise {animation:none!important}
    }`;
  document.head.append(style);

  const status=document.getElementById('unifiedTVstatus');
  if(!status) return;
  let lastKey='',generation=0;
  function activeTargets(){
    const body=document.body;
    if(!body.classList.contains('unified-tv')) return [];
    const pdf=document.getElementById('pdfSlidesTV');
    if(body.classList.contains('inc-pdf-tv-screen') && pdf && !pdf.hidden)
      return [pdf.querySelector('.pdfs-tv-stage')||pdf];
    const stock=document.getElementById('stockControl');
    if(stock && !stock.hidden && stock.classList.contains('stk-unified-screen')){
      return [...stock.querySelectorAll('.stk-kpi,.stk-layout>.stk-card')]
        .filter(node=>getComputedStyle(node).display!=='none');
    }
    const info=document.getElementById('infoSlidesArea');
    if(info && !info.hidden){
      const frame=info.querySelector('#isaTV .isa-tv-frame');
      return frame?[frame]:[];
    }
    const assign=document.getElementById('assign');
    if(assign && !assign.hidden){
      const widgets=[...assign.querySelectorAll('.schedule-widget,.schedule-roster-panel')]
        .filter(node=>getComputedStyle(node).display!=='none');
      return widgets.length?widgets:[assign];
    }
    const workers=document.getElementById('workerArea');
    if(workers && !workers.hidden){
      const cards=[...workers.querySelectorAll('#workerCards>.employee-card')];
      return cards.length?cards:[workers];
    }
    const norms=document.getElementById('norms');
    if(norms && !norms.hidden){
      const cards=[...norms.querySelectorAll('#cards>.card')];
      return cards.length?cards:[norms];
    }
    return [];
  }
  function keyOf(){
    if(!document.body.classList.contains('unified-tv')) return '';
    // Ignore pause and other control updates. The active name + playlist
    // position identify a screen transition, including repeated titles.
    return (status.textContent||'').replace(/\s*·\s*Pauza\b/g,'').replace(/\s*·\s*Nie mieści się.*$/,'').trim();
  }
  function clearOld(){
    for(const node of document.querySelectorAll('.inc-tv-card-rise')){
      node.classList.remove('inc-tv-card-rise');
      node.style.removeProperty('--inc-tv-delay');
    }
  }
  function reveal(){
    const key=keyOf();
    if(!key){lastKey='';clearOld();return;}
    if(key===lastKey)return;
    lastKey=key;
    const current=++generation;
    // Let each module finish its own synchronous DOM rendering first.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(current!==generation||!document.body.classList.contains('unified-tv'))return;
      clearOld();
      const targets=activeTargets();
      for(let i=0;i<targets.length;i++){
        const node=targets[i];
        node.style.setProperty('--inc-tv-delay',Math.min(i,8)*55+'ms');
        node.classList.add('inc-tv-card-rise');
      }
    }));
  }
  new MutationObserver(reveal).observe(status,{subtree:true,characterData:true,childList:true});
  new MutationObserver(()=>{
    if(!document.body.classList.contains('unified-tv')){lastKey='';generation++;clearOld();}
  }).observe(document.body,{attributes:true,attributeFilter:['class']});
})();
