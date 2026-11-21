/* INCYDENTY · Tablica informacyjna. Local image announcements and TV screens. */
(()=>{
'use strict';
const $=id=>document.getElementById(id), escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DB='incydenty-info-slides', STORE='slides';
let records=[], selectedId=null, pendingImage=null, previewURL=null, tvURL=null, db=null, saving=false;
const openDB=()=>new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'id'})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
const tx=(mode,operation)=>new Promise((resolve,reject)=>{const tr=db.transaction(STORE,mode), req=operation(tr.objectStore(STORE));req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);tr.onerror=()=>reject(tr.error)});
const id=()=> 'a'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const nav=document.getElementById('assignment');const infoTab=document.createElement('button');infoTab.id='infoSlidesTab';infoTab.type='button';infoTab.textContent='Tablica informacyjna';nav.parentElement.append(infoTab);
const area=document.createElement('section');area.id='infoSlidesArea';area.hidden=true;area.className='info-slides-area';area.innerHTML=`
 <div class="isa-heading"><div><div class="eyebrow">INCYDENTY · KOMUNIKATY</div><h2>Tablica informacyjna</h2><p>Zdjęcia i komunikaty do wyświetlania na telewizorach.</p></div><button type="button" class="primary" id="isaNew">＋ Nowa podstrona</button></div>
 <div class="isa-shell"><aside class="isa-list-panel"><div class="isa-panel-title">Zapisane podstrony <span id="isaCount"></span></div><div id="isaList" class="isa-list"></div><p class="isa-helper">Każda podstrona pojawia się osobno w ustawieniach TV, gdzie wybierasz kolejność i czas pokazu.</p></aside>
 <div class="isa-editor"><label class="isa-label" for="isaTitle">Tytuł podstrony</label><input id="isaTitle" maxlength="100" placeholder="Np. Informacja dla pracowników" />
 <div class="isa-label">Zdjęcie / grafika</div><div id="isaDrop" class="isa-drop" role="button" tabindex="0" aria-label="Wczytaj zdjęcie"><input id="isaFile" type="file" accept="image/png,image/jpeg,image/webp" hidden/><div id="isaPreview" class="isa-preview"><span class="isa-drop-ico">▧</span><strong>Przeciągnij zdjęcie tutaj</strong><small>lub kliknij, aby wybrać PNG / JPG / WebP</small></div></div>
 <label class="isa-label" for="isaCaption">Tekst komunikatu <span>(opcjonalnie)</span></label><textarea id="isaCaption" rows="3" maxlength="650" placeholder="Wpisz komunikat, który ma pojawić się przy zdjęciu"></textarea>
 <div class="isa-format-row"><div><label class="isa-label" for="isaPosition">Położenie tekstu</label><select id="isaPosition"><option value="bottom">Pod zdjęciem</option><option value="top">Nad zdjęciem</option><option value="left">Po lewej</option><option value="right">Po prawej</option><option value="overlay-bottom">Na zdjęciu · na dole</option><option value="overlay-top">Na zdjęciu · u góry</option></select></div><div><label class="isa-label" for="isaCardStyle">Wygląd tekstu</label><select id="isaCardStyle"><option value="light">Jasna karta</option><option value="dark">Ciemna karta</option><option value="glass">Szklana karta</option></select></div></div>
 <div class="isa-label">Podgląd slajdu</div><div id="isaLivePreview" class="isa-live-preview" aria-label="Podgląd slajdu"></div>
 <div class="isa-editor-actions"><span id="isaMsg" role="status"></span><button id="isaDelete" type="button">Usuń</button><button id="isaSave" class="primary" type="button">Zapisz podstronę</button></div></div></div>
 <div id="isaTV" class="isa-tv" hidden><div class="isa-tv-frame"><img id="isaTVImage" alt=""/><div id="isaTVCaption" class="isa-tv-caption isa-caption-card"></div></div></div>`;
const shell=document.querySelector('.shell');shell.append(area);
const style=document.createElement('style');style.textContent=`
#isaTV[hidden],#infoSlidesArea[hidden]{display:none!important}.info-slides-area{max-width:1400px;margin:22px auto 70px}.isa-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:22px 0}.isa-heading h2{font-size:clamp(24px,2.3vw,36px);margin:5px 0}.isa-heading p{font-size:13px;color:#7d8ba0}.isa-shell{display:grid;grid-template-columns:minmax(235px,310px) minmax(0,1fr);gap:16px}.isa-list-panel,.isa-editor{background:rgba(255,255,255,.83);border:1px solid #e2e9f1;box-shadow:0 9px 28px #21374a0b;border-radius:20px;padding:18px;min-width:0}.isa-panel-title{font-weight:750;color:#30455d;font-size:14px;display:flex;justify-content:space-between}.isa-panel-title span{color:#78889b}.isa-list{display:grid;gap:8px;margin:16px 0}.isa-list button{border:1px solid #e1e8f1;border-radius:12px;background:#f8fafd;padding:12px;text-align:left;display:flex;align-items:center;gap:10px;color:#304459;font-weight:700;cursor:pointer}.isa-list button.selected{border-color:#89c6c5;background:#edfaf8}.isa-list button span{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.isa-helper{font-size:11px;color:#8392a4;line-height:1.55}.isa-label{display:block;font-size:12px;color:#53677d;font-weight:700;margin:0 0 8px}.isa-label span{font-weight:400;color:#8997a9}.isa-editor input:not([type=file]),.isa-editor textarea{width:100%;min-width:0;max-width:none;box-sizing:border-box;padding:12px 14px;border:1px solid #dbe5ef;border-radius:12px;background:#fff;color:#233b54;font:inherit;font-size:13px;margin:0 0 17px}.isa-drop{border:1.5px dashed #b4c7d9;background:#f8fbfe;border-radius:16px;min-height:230px;display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;margin-bottom:17px}.isa-drop:hover,.isa-drop.is-over{border-color:#39a99f;background:#f2fbf9}.isa-preview{width:100%;min-height:230px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;color:#61778e}.isa-preview img{display:block;max-width:100%;max-height:420px;width:auto;height:auto;object-fit:contain}.isa-drop-ico{font-size:38px;color:#5da69f}.isa-preview small{font-size:11px}.isa-editor-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap}.isa-editor-actions #isaMsg{flex:1;color:#5a7787;font-size:12px}.isa-tv{display:none}.isa-tv img{display:block;max-width:100%;max-height:100%;object-fit:contain;margin:auto}.isa-tv-caption{max-width:1100px;margin:0 auto;font-size:clamp(20px,1.85vw,42px);font-weight:650;line-height:1.35;text-align:center;white-space:pre-wrap;overflow-wrap:anywhere;color:#233f5b}.isa-tv-caption:empty{display:none}
body.unified-tv #isaTV[hidden],#infoSlidesArea[hidden]{display:none!important}.info-slides-area{max-width:none;width:100%;margin:0 auto}body.unified-tv .info-slides-area .isa-heading,body.unified-tv .isa-shell{display:none!important}body.unified-tv .info-slides-area .isa-tv{display:flex;align-items:center;justify-content:center;height:calc(100dvh - 180px);min-height:300px}body.unified-tv .isa-tv-frame{max-height:100%;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(15px,2vh,32px)}body.unified-tv .isa-tv-frame img{max-height:min(70dvh,1400px);max-width:94%;border-radius:10px;box-shadow:0 10px 32px #243d5712}body.unified-tv .isa-tv-frame img:only-child{max-height:76dvh}body.unified-tv .isa-tv-frame{animation:isaFloatIn .6s cubic-bezier(.2,.72,.2,1) both}@keyframes isaFloatIn{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){body.unified-tv .isa-tv-frame{animation:none}}@media(max-width:750px){.isa-shell{grid-template-columns:1fr}.isa-heading{flex-wrap:wrap}.isa-list{grid-template-columns:repeat(2,minmax(0,1fr))}}

/* Compose a slide with its own rounded caption card and predictable TV layout. */
.isa-format-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:17px}
.isa-format-row select{width:100%;border:1px solid #dbe5ef;background:#fff;color:#30465c;border-radius:12px;font:inherit;font-size:13px;padding:11px 12px;outline-offset:3px}
.isa-live-preview{min-height:210px;border:1px solid #dde6f0;background:linear-gradient(135deg,#f0f3f8,#e7edf6);border-radius:16px;padding:14px;overflow:hidden;margin-bottom:18px}
.isa-preview-frame{height:100%;min-height:182px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:12px;position:relative;min-width:0;width:100%}
.isa-preview-frame img{display:block;object-fit:contain;max-width:100%;max-height:290px;border-radius:11px;min-width:0;min-height:0}
.isa-preview-frame .isa-caption-card{font-size:15px;max-width:100%;}
.isa-caption-card{box-sizing:border-box;position:relative;flex:0 1 auto;max-width:min(100%,980px);padding:clamp(14px,1.55vw,30px) clamp(17px,2vw,40px);border:1px solid #e0e7ef;border-radius:clamp(15px,1.3vw,24px);box-shadow:0 12px 36px #18345114;background:#fffffff0;color:#223c54;font-weight:650;line-height:1.42;text-align:center;white-space:pre-wrap;overflow-wrap:anywhere;min-width:0}
.isa-caption-card:empty{display:none!important}
.isa-caption-card[data-style="dark"]{background:#203043f0;border-color:#50607399;color:#fff;box-shadow:0 14px 35px #0d233b2b}
.isa-caption-card[data-style="glass"]{background:#f8fbfccc;border-color:#ffffffa6;box-shadow:0 12px 34px #20374c20;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
.isa-preview-frame.pos-left,.isa-preview-frame.pos-right{flex-direction:row;align-items:center;gap:clamp(12px,2vw,40px)}
.isa-preview-frame.pos-left{flex-direction:row-reverse}
.isa-preview-frame.pos-left img,.isa-preview-frame.pos-right img{max-width:64%;max-height:100%;flex:1 1 60%}
.isa-preview-frame.pos-left .isa-caption-card,.isa-preview-frame.pos-right .isa-caption-card{flex:0 1 36%;min-width:0;max-width:40%;text-align:left}
.isa-preview-frame.pos-top{flex-direction:column-reverse}
.isa-preview-frame.pos-overlay-top,.isa-preview-frame.pos-overlay-bottom{justify-content:center;align-items:center;isolation:isolate}
.isa-preview-frame.pos-overlay-top img,.isa-preview-frame.pos-overlay-bottom img{max-height:100%;max-width:100%;}
.isa-preview-frame.pos-overlay-top .isa-caption-card,.isa-preview-frame.pos-overlay-bottom .isa-caption-card{position:absolute;z-index:1;left:50%;transform:translateX(-50%);width:max-content;max-width:calc(100% - 28px);background:#17273ad9;color:#fff;border-color:#ffffff38;box-shadow:0 12px 34px #0005;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
.isa-preview-frame.pos-overlay-top .isa-caption-card{top:12px}
.isa-preview-frame.pos-overlay-bottom .isa-caption-card{bottom:12px}
.isa-preview-frame.pos-overlay-top .isa-caption-card[data-style="light"],.isa-preview-frame.pos-overlay-bottom .isa-caption-card[data-style="light"]{background:#fffc;color:#223c54;border-color:#fff}
.isa-preview-frame.pos-overlay-top .isa-caption-card[data-style="glass"],.isa-preview-frame.pos-overlay-bottom .isa-caption-card[data-style="glass"]{background:#15273aa8;color:#fff;border-color:#ffffff66}
.isa-empty-image{height:170px;width:100%;border:1px dashed #c1cddb;border-radius:12px;display:grid;place-items:center;font-size:12px;color:#7c90a4;background:#ffffffa6}
body.unified-tv .isa-tv-frame{width:min(96%,1800px);height:100%;max-height:100%;min-height:0;gap:clamp(12px,2vh,28px)}
body.unified-tv .isa-tv-frame img{margin:0;max-width:100%;max-height:calc(100% - 20px);object-fit:contain;flex:1 1 auto;min-height:0;min-width:0}
body.unified-tv .isa-tv-frame .isa-caption-card{font-size:clamp(22px,2.05vw,46px);flex:0 1 auto;max-height:48%;overflow:auto}
body.unified-tv .isa-tv-frame.pos-left img,body.unified-tv .isa-tv-frame.pos-right img{max-width:67%;max-height:100%}
body.unified-tv .isa-tv-frame.pos-left .isa-caption-card,body.unified-tv .isa-tv-frame.pos-right .isa-caption-card{max-width:36%;max-height:90%;font-size:clamp(21px,1.85vw,44px)}
body.unified-tv .isa-tv-frame.pos-overlay-bottom img,body.unified-tv .isa-tv-frame.pos-overlay-top img{max-height:100%}
body.unified-tv .isa-tv-frame.pos-overlay-bottom .isa-caption-card,body.unified-tv .isa-tv-frame.pos-overlay-top .isa-caption-card{max-height:45%;overflow:auto}
@media(max-width:620px){.isa-format-row{grid-template-columns:1fr}.isa-live-preview{padding:10px}.isa-preview-frame.pos-left,.isa-preview-frame.pos-right{flex-direction:column}.isa-preview-frame.pos-left img,.isa-preview-frame.pos-right img{max-width:100%;max-height:230px}.isa-preview-frame.pos-left .isa-caption-card,.isa-preview-frame.pos-right .isa-caption-card{max-width:100%;width:100%}}
`;document.head.append(style);
const revokePreview=()=>{if(previewURL){URL.revokeObjectURL(previewURL);previewURL=null}};
const message=s=>{$('isaMsg').textContent=s};
function list(){return records.map(s=>({id:'info:'+s.id,name:'Informacje · '+s.title,description:'Zdjęcie i podpis',available:true}))}
function drawList(){ $('isaCount').textContent=String(records.length);$('isaList').innerHTML=records.map(r=>`<button type="button" class="${r.id===selectedId?'selected':''}" data-id="${escape(r.id)}"><span>▧ ${escape(r.title)}</span></button>`).join('')||'<p class="isa-helper">Nie ma jeszcze zapisanych podstron.</p>';}
function preview(file){revokePreview();$('isaPreview').replaceChildren();if(file){previewURL=URL.createObjectURL(file);const im=document.createElement('img');im.src=previewURL;im.alt='Podgląd zdjęcia';$('isaPreview').append(im)}else{$('isaPreview').innerHTML='<span class="isa-drop-ico">▧</span><strong>Przeciągnij zdjęcie tutaj</strong><small>lub kliknij, aby wybrać PNG / JPG / WebP</small>'}renderLivePreview()}
const POSITIONS=['bottom','top','left','right','overlay-bottom','overlay-top'];
const STYLES=['light','dark','glass'];
const validPosition=p=>POSITIONS.includes(p)?p:'bottom';
const validStyle=p=>STYLES.includes(p)?p:'light';
function setLayout(frame,position,styleName){
 frame.className=frame.className.replace(/\bpos-(bottom|top|left|right|overlay-bottom|overlay-top)\b/g,'').trim();
 frame.classList.add('pos-'+validPosition(position));
 const caption=frame.querySelector('.isa-caption-card');
 if(caption)caption.dataset.style=validStyle(styleName);
}
function renderLivePreview(){
 const host=$('isaLivePreview');if(!host)return;
 const frame=document.createElement('div');frame.className='isa-preview-frame';
 const imgURL=previewURL;
 if(imgURL){const im=document.createElement('img');im.src=imgURL;im.alt='Podgląd grafiki';frame.append(im)}
 else{const empty=document.createElement('div');empty.className='isa-empty-image';empty.textContent='Podgląd zdjęcia';frame.append(empty)}
 const caption=document.createElement('div');caption.className='isa-caption-card';caption.textContent=$('isaCaption').value;frame.append(caption);
 setLayout(frame,$('isaPosition').value,$('isaCardStyle').value);host.replaceChildren(frame);
}
$('isaCaption').addEventListener('input',renderLivePreview);
$('isaPosition').addEventListener('change',renderLivePreview);
$('isaCardStyle').addEventListener('change',renderLivePreview);
function choose(r){selectedId=r?.id||null;pendingImage=null;$('isaTitle').value=r?.title||'';$('isaCaption').value=r?.caption||'';$('isaPosition').value=validPosition(r?.position);$('isaCardStyle').value=validStyle(r?.cardStyle);preview(r?.image||null);$('isaDelete').disabled=!r;message('');drawList()}
function open(){area.hidden=false;$('infoSlidesTab').classList.add('active');$('assignment').classList.remove('active');$('results').classList.remove('active');$('norms').hidden=true;$('workerArea').hidden=true;$('assign').hidden=true;$('resultViews').hidden=true;$('upload').hidden=true;$('tv').disabled=!records.length;area.classList.remove('tv-view');area.querySelector('.isa-shell').hidden=false;$('isaTV').hidden=true;}
function close(){area.hidden=true;$('isaTV').hidden=true;revokeTV();$('infoSlidesTab').classList.remove('active');}
function showTV(ref){const slide=records.find(r=>r.id===ref);if(!slide)return;area.hidden=false;$('isaTV').hidden=false;revokeTV();tvURL=URL.createObjectURL(slide.image);$('isaTVImage').src=tvURL;$('isaTVImage').alt=slide.title;$('isaTVCaption').textContent=slide.caption||'';setLayout($('isaTV').querySelector('.isa-tv-frame'),slide.position,slide.cardStyle);}
function revokeTV(){if(tvURL){URL.revokeObjectURL(tvURL);tvURL=null}}
function restore(){revokeTV();open();}
function acceptFile(file){if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)){message('Wybierz PNG, JPG lub WebP.');return}if(file.size>16*1024*1024){message('Zdjęcie przekracza 16 MB.');return}pendingImage=file;preview(file);message(file.name)}
$('isaDrop').onclick=()=> $('isaFile').click();$('isaDrop').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('isaFile').click()}};
$('isaFile').onchange=e=>{acceptFile(e.target.files[0]);e.target.value=''};
for(const name of ['dragenter','dragover'])$('isaDrop').addEventListener(name,e=>{e.preventDefault();$('isaDrop').classList.add('is-over')});
$('isaDrop').addEventListener('dragleave',()=> $('isaDrop').classList.remove('is-over'));
$('isaDrop').addEventListener('drop',e=>{e.preventDefault();$('isaDrop').classList.remove('is-over');acceptFile([...e.dataTransfer.files][0])});
$('isaNew').onclick=()=>choose(null);
$('isaList').onclick=e=>{const b=e.target.closest('button[data-id]');if(b)choose(records.find(r=>r.id===b.dataset.id))};
$('isaSave').onclick=async()=>{if(saving)return;const title=$('isaTitle').value.trim(),caption=$('isaCaption').value.trim();if(!title){message('Wpisz tytuł podstrony.');return}const old=records.find(r=>r.id===selectedId),image=pendingImage||old?.image;if(!image){message('Dodaj zdjęcie.');return}saving=true;$('isaSave').disabled=true;try{const item={id:old?.id||id(),title,caption,image,position:validPosition($('isaPosition').value),cardStyle:validStyle($('isaCardStyle').value),updatedAt:Date.now()};await tx('readwrite',s=>s.put(item));const i=records.findIndex(s=>s.id===item.id);if(i>=0)records[i]=item;else records.push(item);choose(item);message('Podstrona zapisana. Możesz wybrać ją w ustawieniach TV.');$('tv').disabled=false;}catch(err){message('Nie udało się zapisać zdjęcia: '+(err?.message||'brak miejsca'))}finally{saving=false;$('isaSave').disabled=false}};
$('isaDelete').onclick=async()=>{const item=records.find(r=>r.id===selectedId);if(!item||!confirm('Usunąć podstronę '+item.title+'?'))return;try{await tx('readwrite',s=>s.delete(item.id));records=records.filter(r=>r.id!==item.id);choose(records[0]||null);$('tv').disabled=!records.length;message('Usunięto podstronę.')}catch{message('Nie udało się usunąć podstrony.')}};
infoTab.onclick=()=>{open()};
$('assignment').addEventListener('click',close);$('results').addEventListener('click',close);
window.incSlides={list,open,close,showTV,restore,isOpen:()=>!area.hidden};
(async()=>{try{db=await openDB();records=await tx('readonly',s=>s.getAll());records.sort((a,b)=>a.updatedAt-b.updatedAt);choose(records[0]||null)}catch(err){message('Przeglądarka nie pozwala zapisywać zdjęć: '+(err?.message||'IndexedDB'))}})();
})();
