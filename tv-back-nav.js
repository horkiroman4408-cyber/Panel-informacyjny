'use strict';
/* INCYDENTY · Previous screen button for the existing unified TV controller.
   Uses the controller's own Next action; does not alter the data or playlist. */
(()=>{
  const toolbar=document.getElementById('unifiedTVbar');
  const next=document.getElementById('unifiedTVnext');
  const status=document.getElementById('unifiedTVstatus');
  if(!toolbar||!next||!status||document.getElementById('unifiedTVprevious'))return;

  const previous=document.createElement('button');
  previous.type='button';
  previous.id='unifiedTVprevious';
  previous.textContent='← Poprzedni';
  previous.title='Przejdź do poprzedniego ekranu TV';
  next.before(previous);

  const position=()=>{
    const m=(status.textContent||'').match(/(?:^|·)\s*(\d+)\s*\/\s*(\d+)(?=\s|$|·)/);
    return m?{index:Number(m[1]),total:Number(m[2])}:null;
  };
  const enabled=()=>document.body.classList.contains('unified-tv')&&!next.disabled;
  const refresh=()=>{const p=position();previous.disabled=!enabled()||!p||p.total<2;};
  const observer=new MutationObserver(refresh);
  observer.observe(status,{subtree:true,characterData:true,childList:true});
  new MutationObserver(refresh).observe(next,{attributes:true,attributeFilter:['disabled']});
  new MutationObserver(refresh).observe(document.body,{attributes:true,attributeFilter:['class']});

  let changing=false;
  previous.addEventListener('click',()=>{
    if(changing||!enabled())return;
    const p=position();if(!p||p.total<2)return;
    const target=(p.index+p.total-2)%p.total+1;
    changing=true;
    // Controller v1.1.63 offers forward navigation only. Jump around the
    // circular playlist synchronously so intermediate screens aren't painted.
    // Bound the work to the actual screen count and stop on any stalled state.
    try{
      for(let count=0;count<p.total-1;count++){
        const before=position();
        if(before?.index===target)break;
        next.click();
        const after=position();
        if(!after||after.index===before?.index)break;
      }
    }finally{changing=false;refresh();}
  });
  document.addEventListener('keydown',e=>{
    if(e.key!=='ArrowLeft'||e.altKey||e.ctrlKey||e.metaKey||!enabled())return;
    if(e.target.closest?.('input,textarea,select,[contenteditable]'))return;
    e.preventDefault();previous.click();
  });
  refresh();
})();
