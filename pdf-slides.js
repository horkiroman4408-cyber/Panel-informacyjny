'use strict';
/* INCYDENTY · PDF in Tablica informacyjna. Local, offline and isolated from existing slides. */
(()=>{
 const DB='incydenty-pdf-slides-v1', STORE='pdfs', MAX_SIZE=20*1024*1024;
 const $=id=>document.getElementById(id);
 const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const uuid=()=>('pdf'+Date.now().toString(36)+Math.random().toString(36).slice(2,9));
 let db=null,records=[],activeUrl=null,patched=false;
 function openDB(){return new Promise((resolve,reject)=>{
   const req=indexedDB.open(DB,1);
   req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'})};
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('Błąd bazy danych'));
 });}
 function transaction(mode,action){return new Promise((resolve,reject)=>{
   const tx=db.transaction(STORE,mode), req=action(tx.objectStore(STORE));
   tx.oncomplete=()=>resolve(req?.result);tx.onerror=()=>reject(tx.error||Error('Błąd zapisu'));
 });}
 function notify(msg,isError=false){const area=$('pdfSlidesMessage');if(!area)return;area.textContent=msg;area.dataset.error=isError?'true':'false';}
 function clearViewer(){
   const wrap=$('pdfSlidesTV');if(wrap){wrap.hidden=true;wrap.querySelector('iframe')?.removeAttribute('src');}
   $('infoSlidesArea')?.classList.remove('pdf-tv-mode');
   if(activeUrl){URL.revokeObjectURL(activeUrl);activeUrl=null;}
 }
 function list(){
   const box=$('pdfSlidesItems');if(!box)return;
   if(!records.length){box.innerHTML='<p class="pdfs-empty">Nie dodano jeszcze żadnego pliku PDF.</p>';return;}
   box.innerHTML=records.map(r=>`<div class="pdfs-item" data-id="${safe(r.id)}"><div class="pdfs-item-text"><strong title="${safe(r.title)}">${safe(r.title)}</strong><small>${safe(r.fileName)}</small></div><button type="button" data-pdf-open="${safe(r.id)}" title="Podgląd PDF">Podgląd</button><button type="button" data-pdf-delete="${safe(r.id)}" aria-label="Usuń ${safe(r.title)}" title="Usuń PDF">×</button></div>`).join('');
 }
 function hidePDF(){clearViewer();}
 function showPDF(id){
   const record=records.find(r=>r.id===id);if(!record)return;
   clearViewer();
   const area=$('infoSlidesArea'), wrap=$('pdfSlidesTV');
   if(!area||!wrap)return;
   // Keep the original PDF bytes; never rasterize, resize or alter emergency signage.
   activeUrl=URL.createObjectURL(record.blob);
   wrap.querySelector('.pdfs-tv-title').textContent=record.title;
   const frame=wrap.querySelector('iframe');
   frame.title='Plan ewakuacji · '+record.title;
   frame.src=activeUrl+'#toolbar=0&navpanes=0&view=Fit';
   wrap.querySelector('.pdfs-tv-open').href=activeUrl;
   wrap.querySelector('.pdfs-tv-open').download=record.fileName;
   area.hidden=false;area.classList.add('pdf-tv-mode');wrap.hidden=false;
   $('isaTV')?.setAttribute('hidden','');
 }
 async function add(file){
   if(!file)return;
   if(!/\.pdf$/i.test(file.name)||file.type&&!/pdf/i.test(file.type)){notify('Wybierz plik PDF.',true);return}
   if(file.size>MAX_SIZE){notify('Maksymalny rozmiar PDF to 20 MB.',true);return}
   const signature=new Uint8Array(await file.slice(0,5).arrayBuffer());
   if(String.fromCharCode(...signature)!=='%PDF-'){notify('Plik nie jest prawidłowym dokumentem PDF.',true);return}
   const suggested=file.name.replace(/\.pdf$/i,'').replace(/[_-]+/g,' ').trim();
   const title=prompt('Nazwa podstrony PDF widoczna w Tryb TV:',suggested||'Plan ewakuacji');
   if(title===null)return;
   const displayName=title.trim().slice(0,100);
   if(!displayName){notify('Podaj tytuł podstrony.',true);return}
   const record={id:uuid(),title:displayName,fileName:file.name.slice(0,180),blob:file,lastModified:Date.now()};
   try{
     await transaction('readwrite',s=>s.put(record));
     records.push(record);records.sort((a,b)=>b.lastModified-a.lastModified);list();
     if(window.incSlides?.isOpen())$('tv').disabled=false;
     notify('Zapisano PDF. W Tryb TV zaznacz „'+displayName+'”, aby wyświetlić plan.');
   }catch(e){notify('Nie udało się zapisać PDF w przeglądarce. Sprawdź dostępne miejsce.',true)}
 }
 async function remove(id){
   const r=records.find(x=>x.id===id);if(!r||!confirm('Usunąć podstronę PDF „'+r.title+'”?'))return;
   try{await transaction('readwrite',s=>s.delete(id));records=records.filter(x=>x.id!==id);list();notify('Usunięto podstronę PDF.');}
   catch{notify('Nie udało się usunąć PDF.',true)}
 }
 function attach(){
   if(patched||!window.incSlides||!$('infoSlidesArea')||!$('isaNew'))return false;
   patched=true;
   const api=window.incSlides, area=$('infoSlidesArea');
   const before={list:api.list,showTV:api.showTV,open:api.open,close:api.close,restore:api.restore};
   const button=document.createElement('button');button.id='pdfSlidesAdd';button.type='button';button.textContent='＋ Dodaj PDF';button.title='Dodaj plan ewakuacji PDF';
   const headerActions=document.createElement('div');headerActions.className='pdfs-header-actions';
   $('isaNew').parentElement.insertBefore(headerActions,$('isaNew'));
   headerActions.append(button,$('isaNew'));
   const input=document.createElement('input');input.id='pdfSlidesFile';input.type='file';input.accept='.pdf,application/pdf';input.hidden=true;area.append(input);
   button.onclick=()=>input.click();input.onchange=()=>{const file=input.files?.[0];input.value='';if(file)add(file)};
   const panel=document.createElement('section');panel.id='pdfSlidesPanel';panel.innerHTML=`<div class="pdfs-panel-header"><strong>Dokumenty PDF</strong><small>Plany ewakuacji i inne dokumenty do pokazu TV</small></div><div id="pdfSlidesItems"></div><p id="pdfSlidesMessage" role="status"></p><p class="pdfs-note">W trybie TV najlepiej sprawdza się jednostronicowy plan. Wiele stron można obejrzeć w pełnym podglądzie PDF.</p>`;
   const shell=area.querySelector('.isa-shell');if(shell)shell.insertAdjacentElement('beforebegin',panel);else area.append(panel);
   panel.onclick=e=>{const del=e.target.closest('[data-pdf-delete]'),open=e.target.closest('[data-pdf-open]');if(del){remove(del.dataset.pdfDelete);return}if(open){const rec=records.find(x=>x.id===open.dataset.pdfOpen);if(!rec)return;const url=URL.createObjectURL(rec.blob);const w=window.open(url,'_blank','noopener');if(!w){notify('Przeglądarka zablokowała podgląd. Zezwól na otwarcie nowej karty.',true);URL.revokeObjectURL(url)}else setTimeout(()=>URL.revokeObjectURL(url),120000)}};
   const tv=document.createElement('div');tv.id='pdfSlidesTV';tv.hidden=true;
   tv.innerHTML=`<div class="pdfs-tv-title"></div><div class="pdfs-tv-stage"><iframe title="Dokument PDF" loading="eager"></iframe></div><div class="pdfs-tv-fallback">Jeżeli podgląd PDF jest pusty, otwórz dokument bezpośrednio: <a class="pdfs-tv-open" target="_blank" rel="noopener">Otwórz PDF</a></div>`;
   area.append(tv);
   api.list=()=>[...before.list(),...records.map(r=>({id:'info:pdf:'+r.id,name:'PDF · '+r.title,description:'Dokument PDF · '+r.fileName,available:true}))];
   api.showTV=key=>{if(key.startsWith('pdf:'))showPDF(key.slice(4));else{hidePDF();before.showTV(key)}};
   api.close=()=>{hidePDF();before.close()};
   api.open=()=>{hidePDF();before.open();if(records.length)$('tv').disabled=false};
   api.restore=()=>{hidePDF();before.restore();if(records.length)$('tv').disabled=false};
   $('infoSlidesTab')?.addEventListener('click',()=>{if(records.length)$('tv').disabled=false});
   const style=document.createElement('style');style.textContent=`
 #infoSlidesArea #pdfSlidesAdd{border:1px solid #cfdde9;border-radius:12px;background:#f6fbff;color:#17618f;padding:11px 14px;font-size:12px;font-weight:800;cursor:pointer;justify-self:end;align-self:center;white-space:nowrap}
 #infoSlidesArea .isa-heading>.pdfs-header-actions{grid-column:3;justify-self:end;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
 #infoSlidesArea .pdfs-header-actions #isaNew{position:static}
 #pdfSlidesPanel{margin:0 0 15px;background:#fff;border:1px solid #dfe8f0;border-radius:17px;padding:14px 16px}
 .pdfs-panel-header{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;margin-bottom:10px}.pdfs-panel-header strong{font-size:13px;color:#24445a}.pdfs-panel-header small,.pdfs-note{font-size:11px;color:#74869b}
 #pdfSlidesItems{display:flex;gap:8px;flex-wrap:wrap}.pdfs-item{min-width:210px;max-width:330px;display:flex;align-items:center;gap:7px;border:1px solid #dce7ef;border-radius:11px;padding:8px;background:#f8fbfe}.pdfs-item-text{min-width:0;flex:1;display:grid;gap:3px}.pdfs-item-text strong{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pdfs-item-text small{font-size:10px;color:#7a90a2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pdfs-item button{font-size:11px;padding:6px 8px;border:1px solid #d8e4ef;background:#fff;border-radius:8px;cursor:pointer}.pdfs-empty{font-size:12px;color:#8798a9;margin:0}.pdfs-note{margin:10px 0 0}#pdfSlidesMessage{font-size:11px;color:#14836b;margin:7px 0 0}#pdfSlidesMessage:empty{display:none}#pdfSlidesMessage[data-error=true]{color:#b63e32}
 #pdfSlidesTV[hidden]{display:none!important}#infoSlidesArea.pdf-tv-mode .isa-heading,#infoSlidesArea.pdf-tv-mode .isa-shell,#infoSlidesArea.pdf-tv-mode #pdfSlidesPanel,#infoSlidesArea.pdf-tv-mode #isaTV{display:none!important}
 body.unified-tv #infoSlidesArea.pdf-tv-mode{display:block!important;width:100%;max-width:none;margin:0;padding:0!important}
 body.unified-tv #infoSlidesArea.pdf-tv-mode #pdfSlidesTV{display:flex!important;flex-direction:column;align-items:stretch;gap:4px;width:100%;height:calc(100dvh - 125px);min-height:320px}
 #pdfSlidesTV .pdfs-tv-title{font-size:clamp(16px,1.3vw,26px);font-weight:850;color:#243f57;text-align:center;padding:5px}
 #pdfSlidesTV .pdfs-tv-stage{flex:1;min-height:0;border:1px solid #d8e4ed;border-radius:10px;overflow:hidden;background:#fff}
 #pdfSlidesTV iframe{width:100%;height:100%;display:block;border:0;background:white}
 #pdfSlidesTV .pdfs-tv-fallback{text-align:center;font-size:11px;color:#667e90}
 #pdfSlidesTV .pdfs-tv-open{color:#176ca7}
 @media(max-width:780px){#infoSlidesArea .isa-heading>.pdfs-header-actions{grid-column:1;justify-self:center;justify-content:center}#pdfSlidesItems{display:grid;grid-template-columns:1fr}.pdfs-item{max-width:none}}
 `;document.head.append(style);
   list();return true;
 }
 // info-slides.js is loaded dynamically after workers.js. Stock integration may wrap it too.
 let attempt=0;const id=setInterval(()=>{if(attach()||++attempt>=200)clearInterval(id)},50);
 openDB().then(async conn=>{db=conn;records=await transaction('readonly',store=>store.getAll());records.sort((a,b)=>b.lastModified-a.lastModified);list()}).catch(()=>notify('Nie można zapisywać PDF na tym urządzeniu.',true));
})();
