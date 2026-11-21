/* INCYDENTY TV viewport adaptation. Complements the existing TV controllers;
   never changes a report, a timer, widget order or saved positions. */
(()=>{
 'use strict';
 const css=document.createElement('style');
 css.id='incydenty-tv-fit-v140';
 css.textContent=`
 /* Like Wyniki i normy, the roster uses the actual available screen width.
    A uniform reduction is reserved for exceptionally tall boards. */
 body.unified-tv #assign .schedule-widget-canvas{
   width:100%!important;
   max-width:100%!important;
   margin-left:0!important;
   transform-origin:top left!important;
   transform:scale(var(--inc-schedule-tv-fit,1))!important;
 }
 body.unified-tv #assign .schedule-widget-viewport{
   height:var(--inc-schedule-tv-height,auto)!important;
   min-height:0!important;
   overflow:visible!important;
 }
 body.unified-tv #assign .schedule-widget .schedule-person-login{font-size:clamp(13px,.83vw,21px)}
 body.unified-tv #assign .schedule-widget .schedule-person-assignment{font-size:clamp(12px,.73vw,19px)}
 body.unified-tv #assign .schedule-widget .schedule-break-table{font-size:clamp(12px,.72vw,19px)}
 body.unified-tv #assign .schedule-widget .schedule-break-table th,
 body.unified-tv #assign .schedule-widget .schedule-break-table td{padding:clamp(7px,.55vw,15px)}
 body.unified-tv #assign .schedule-widget-canvas{background-image:none!important}
 /* Info slides keep the very same 16:9 arrangement as the editor. */
 body.unified-tv #isaTV{min-height:0!important}
 `;
 document.head.append(css);
 const canvas=()=>document.getElementById('scheduleWidgetCanvas');
 const viewport=()=>document.getElementById('scheduleWidgetViewport');
 let scheduled=false;
 function fit(){
  scheduled=false;
  if(!document.body.classList.contains('unified-tv'))return;
  const area=document.getElementById('assign'),c=canvas(),v=viewport();
  if(!area||area.hidden||!c||!v)return;
  // scrollHeight is a layout dimension; it does not include CSS transforms.
  // The original renderer may set inline width/transform; the TV-only rules
  // override them without changing the editable grid.
  const natural=Math.max(1,c.scrollHeight);
  const available=Math.max(90,window.innerHeight-v.getBoundingClientRect().top-18);
  const fit=Math.min(1,available/natural);
  c.style.setProperty('--inc-schedule-tv-fit',String(fit));
  v.style.setProperty('--inc-schedule-tv-height',Math.ceil(natural*fit)+'px');
 }
 function requestFit(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>requestAnimationFrame(fit))}
 const bodyObserver=new MutationObserver(requestFit);
 bodyObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
 const attach=()=>{
  const c=canvas();if(!c||c===attach.last)return;
  attach.last=c;
  new MutationObserver(requestFit).observe(c,{childList:true});
  requestFit();
 };
 attach();
 // schedule.js and info-slides.js load as separate scripts.
 const readyObserver=new MutationObserver(attach);
 readyObserver.observe(document.body,{childList:true,subtree:true});
 window.addEventListener('resize',requestFit);
 document.addEventListener('fullscreenchange',requestFit);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestFit()});
 requestFit();
})();
