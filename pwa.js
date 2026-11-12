'use strict';
(()=>{
  const install=document.getElementById('installApp'),toast=document.getElementById('pwaUpdate');
  let prompt,registration,reloading=false;
  let hadController=!!navigator.serviceWorker?.controller;
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event;install.hidden=false;});
  install.addEventListener('click',async()=>{if(!prompt)return;await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')install.hidden=true;prompt=null;});
  window.addEventListener('appinstalled',()=>{install.hidden=true;prompt=null;});
  if(!('serviceWorker' in navigator)||!['https:','http:'].includes(location.protocol))return;
  function offerUpdate(){if(registration.waiting)toast.hidden=false;}
  document.getElementById('pwaLater').onclick=()=>{toast.hidden=true;};
  document.getElementById('pwaApply').onclick=()=>{if(registration?.waiting){toast.hidden=true;registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});}};
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!hadController){hadController=true;return;}if(reloading||!navigator.serviceWorker.controller)return;reloading=true;location.reload();});
  navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(reg=>{
    registration=reg;offerUpdate();
    reg.update().catch(()=>{});
    navigator.serviceWorker.ready.then(()=>{document.getElementById('pwaState').textContent='PWA 1.1.2 · Gotowa do pracy offline';});
    reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)offerUpdate();});});
    window.addEventListener('online',()=>reg.update().catch(()=>{}));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){offerUpdate();reg.update().catch(()=>{});}});
    setInterval(()=>reg.update().catch(()=>{}),60*60*1000);
  }).catch(()=>{console.warn('PWA: nie udało się przygotować trybu offline.');});
})();
