/* INCYDENTY · Tablica informacyjna. Local image announcements and TV screens. */
(()=>{
'use strict';
const $=id=>document.getElementById(id), escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DB='incydenty-info-slides', STORE='slides';
let records=[], selectedId=null, draftImages=[], previewURLs=[], tvURLs=[], db=null, saving=false, selectedTemplate='1';
const openDB=()=>new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'id'})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
const tx=(mode,operation)=>new Promise((resolve,reject)=>{const tr=db.transaction(STORE,mode), req=operation(tr.objectStore(STORE));req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);tr.onerror=()=>reject(tr.error)});
const id=()=> 'a'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const nav=document.getElementById('assignment');const infoTab=document.createElement('button');infoTab.id='infoSlidesTab';infoTab.type='button';infoTab.textContent='Tablica informacyjna';nav.parentElement.append(infoTab);
const area=document.createElement('section');area.id='infoSlidesArea';area.hidden=true;area.className='info-slides-area';area.innerHTML=`
 <div class="isa-heading"><div><div class="eyebrow">INCYDENTY · KOMUNIKATY</div><h2>Tablica informacyjna</h2><p>Zdjęcia i komunikaty do wyświetlania na telewizorach.</p></div><button type="button" class="primary" id="isaNew">＋ Nowa podstrona</button></div>
 <div class="isa-shell"><aside class="isa-list-panel"><div class="isa-panel-title">Zapisane podstrony <span id="isaCount"></span></div><div id="isaList" class="isa-list"></div><p class="isa-helper">Każda podstrona pojawia się osobno w ustawieniach TV, gdzie wybierasz kolejność i czas pokazu.</p></aside>
 <div class="isa-editor"><div class="isa-label">Układ slajdu</div><div class="isa-template-picker" id="isaTemplates" role="group" aria-label="Wybierz układ slajdu"></div><label class="isa-label" for="isaTitle">Tytuł podstrony</label><input id="isaTitle" maxlength="100" placeholder="Np. Informacja dla pracowników" />
 <div class="isa-label isa-primary-preview-label">Wypełnij makietę · kliknij zdjęcie lub tekst, aby edytować</div><div id="isaLivePreview" class="isa-live-preview" aria-label="Edytowalny podgląd slajdu"></div>
 <div class="isa-images-heading"><span class="isa-label">Zdjęcia <span>(dodaj, zamień lub usuń)</span></span><button id="isaAddImage" class="isa-add-block" type="button">＋ Dodaj zdjęcie</button></div>
 <div id="isaImages" class="isa-images"></div>
 <input id="isaFiles" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden />
 <div class="isa-blocks-heading"><span class="isa-label">Bloki tekstowe <span>(opcjonalnie)</span></span><button id="isaAddBlock" type="button" class="isa-add-block">＋ Dodaj blok tekstu</button></div>
 <div id="isaBlocks" class="isa-blocks" aria-label="Bloki tekstowe"></div>
 
 <div class="isa-editor-actions"><span id="isaMsg" role="status"></span><button id="isaDelete" type="button">Usuń</button><button id="isaSave" class="primary" type="button">Zapisz podstronę</button></div></div></div>
 <div id="isaTV" class="isa-tv" hidden><div class="isa-tv-frame"></div></div>`;
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

/* Several independently editable caption cards per information slide. */
.isa-blocks-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:5px 0 12px;flex-wrap:wrap}
.isa-blocks-heading .isa-label{margin:0}.isa-add-block{border:1px solid #cce0e6;background:#f4fbfa;color:#187c7a;border-radius:12px;padding:9px 14px;font-size:12px;font-weight:750;cursor:pointer}
.isa-add-block:hover{background:#e5f6f3}.isa-blocks{display:grid;gap:12px;margin-bottom:18px}
.isa-block-editor{border:1px solid #e1e8f1;background:#f8fafc;border-radius:15px;padding:13px}
.isa-block-top{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:9px}
.isa-block-number{font-size:12px;font-weight:750;color:#37536c}.isa-block-remove{font-size:12px;font-weight:650;border:0;background:transparent;color:#a15359;cursor:pointer;padding:5px 8px;border-radius:8px}
.isa-block-remove:hover{background:#fff0f0}.isa-block-editor textarea{min-height:70px;margin-bottom:11px!important}
.isa-block-editor .isa-format-row{margin-bottom:0}
.isa-composition{width:100%;max-width:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:12px;min-width:0;min-height:0;align-content:center}
.isa-composition-main{display:grid;grid-template-columns:minmax(0,auto) minmax(0,1fr) minmax(0,auto);gap:12px;align-items:center;min-width:0;min-height:0}
.isa-compose-zone{display:flex;flex-direction:column;gap:9px;min-width:0;align-items:stretch}
.isa-compose-zone[data-zone="left"],.isa-compose-zone[data-zone="right"]{width:min(22vw,250px)}
.isa-compose-zone:empty{display:none}.isa-composition-main:not(:has([data-zone="left"]:not(:empty))) {grid-template-columns:minmax(0,1fr) minmax(0,auto)}
.isa-composition-main:has([data-zone="left"]:empty):has([data-zone="right"]:empty){display:flex;justify-content:center}
.isa-compose-image{position:relative;min-width:0;min-height:0;display:flex;justify-content:center;align-items:center;flex:1 1 auto}
.isa-compose-image img{display:block;max-width:100%;max-height:100%;object-fit:contain;min-width:0;min-height:0;border-radius:12px}
.isa-compose-overlay{position:absolute;z-index:2;left:10px;right:10px;display:flex;flex-direction:column;align-items:center;gap:7px;pointer-events:none}
.isa-compose-overlay[data-zone="overlay-top"]{top:10px}.isa-compose-overlay[data-zone="overlay-bottom"]{bottom:10px}
.isa-compose-overlay .isa-caption-card{max-width:100%;width:fit-content;padding:10px 15px;box-shadow:0 8px 24px #091d3340}
.isa-composition .isa-caption-card{max-width:100%;min-width:0;font-size:15px;padding:13px 17px;line-height:1.4;overflow-wrap:anywhere}
.isa-live-preview .isa-composition{min-height:200px}.isa-live-preview .isa-composition-main{min-height:110px}
.isa-live-preview .isa-compose-image img{max-height:300px}.isa-live-preview .isa-compose-zone[data-zone="left"],.isa-live-preview .isa-compose-zone[data-zone="right"]{width:min(22%,200px)}
.isa-live-preview .isa-composition .isa-caption-card{font-size:12px;padding:10px 12px}
body.unified-tv .isa-tv-frame{display:flex!important;width:min(98%,2400px)!important;height:100%!important;max-height:100%!important;min-height:0!important;align-items:stretch!important;justify-content:center!important}
body.unified-tv .isa-tv-frame .isa-composition{height:100%;max-height:100%;grid-template-rows:auto minmax(0,1fr) auto;gap:clamp(9px,1vh,22px)}
body.unified-tv .isa-composition-main{min-height:0;max-height:100%;grid-template-columns:minmax(0,auto) minmax(0,1fr) minmax(0,auto)}
body.unified-tv .isa-compose-image img{max-height:calc(100dvh - 240px);max-width:100%;margin:auto;object-fit:contain}
body.unified-tv .isa-composition .isa-caption-card{font-size:clamp(18px,1.65vw,38px);padding:clamp(12px,1.35vw,30px) clamp(16px,1.6vw,36px);max-height:100%;overflow:auto}
body.unified-tv .isa-compose-zone[data-zone="left"],body.unified-tv .isa-compose-zone[data-zone="right"]{width:clamp(150px,18vw,420px);max-height:100%;overflow:auto}
body.unified-tv .isa-compose-overlay .isa-caption-card{font-size:clamp(16px,1.4vw,33px);max-height:26dvh;overflow:auto}
/* Avoid percentage-based circular sizing of side cards in preview and TV. */
.isa-composition-main,body.unified-tv .isa-composition-main{display:flex!important;align-items:center;justify-content:center;gap:12px;min-width:0;min-height:0}
.isa-composition-main .isa-compose-image{flex:1 1 0;min-width:0;max-width:100%}
.isa-live-preview .isa-compose-zone[data-zone="left"],.isa-live-preview .isa-compose-zone[data-zone="right"]{flex:0 0 155px;width:155px!important}
body.unified-tv .isa-compose-zone[data-zone="left"],body.unified-tv .isa-compose-zone[data-zone="right"]{flex:0 0 clamp(180px,19vw,430px);width:clamp(180px,19vw,430px)!important}
.isa-composition .isa-compose-zone .isa-caption-card{width:100%;text-align:left}
@media(max-width:780px){.isa-composition-main{gap:6px}.isa-composition .isa-caption-card{font-size:11px}.isa-compose-zone[data-zone="left"],.isa-compose-zone[data-zone="right"]{width:90px!important}.isa-block-editor .isa-format-row{grid-template-columns:1fr}}

/* Shared, fixed 16:9 composition for editor preview and TV. Only the parent stage scales. */
.isa-stage-viewport{position:relative;flex:none;overflow:hidden;max-width:100%;margin:0 auto}
.isa-stage{position:absolute;left:0;top:0;width:1200px;height:675px;transform-origin:top left;box-sizing:border-box;background:transparent;overflow:hidden}
.isa-stage .isa-composition{height:100%!important;max-height:100%!important;width:100%!important;box-sizing:border-box;padding:32px!important;gap:18px!important;display:flex!important;flex-direction:column!important;justify-content:center!important}
.isa-stage .isa-composition-main{display:flex!important;flex:1 1 auto!important;max-height:none!important;min-height:0!important;align-items:stretch!important;gap:18px!important}
.isa-stage .isa-compose-image{display:flex!important;flex:1 1 0!important;min-height:0!important;min-width:0!important;align-items:center!important;justify-content:center!important}
.isa-stage .isa-compose-image img{display:block!important;max-width:100%!important;max-height:100%!important;width:auto!important;height:auto!important;object-fit:contain!important;margin:auto!important;flex:0 1 auto!important}
.isa-stage .isa-compose-zone{flex:0 0 auto!important;gap:12px!important;max-height:32%!important;overflow:auto!important;min-width:0!important}
.isa-stage .isa-compose-zone[data-zone="left"],.isa-stage .isa-compose-zone[data-zone="right"]{width:230px!important;flex:0 0 230px!important;max-height:100%!important}
.isa-stage .isa-compose-zone .isa-caption-card,.isa-stage .isa-composition .isa-caption-card{font-size:25px!important;line-height:1.4!important;padding:18px 24px!important;max-height:none!important;box-sizing:border-box!important;overflow-wrap:anywhere!important;overflow:visible!important}
.isa-stage .isa-compose-overlay{gap:10px!important;left:14px!important;right:14px!important}
.isa-stage .isa-compose-overlay .isa-caption-card{font-size:22px!important;padding:14px 20px!important;max-height:220px!important;overflow:auto!important;width:fit-content!important}
.isa-stage .isa-empty-image{height:100%!important}
.isa-live-preview{min-height:0!important}
body.unified-tv .isa-tv-frame{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;min-height:0!important}
body.unified-tv .isa-tv-frame .isa-stage-viewport{flex:none!important}
body.unified-tv .isa-tv-frame .isa-stage .isa-composition{height:100%!important}
body.unified-tv .isa-tv-frame .isa-stage .isa-compose-zone[data-zone="left"],body.unified-tv .isa-tv-frame .isa-stage .isa-compose-zone[data-zone="right"]{flex:0 0 230px!important;width:230px!important}
body.unified-tv .isa-tv-frame .isa-stage .isa-caption-card{font-size:25px!important;padding:18px 24px!important;max-height:none!important;overflow:visible!important}
body.unified-tv .isa-tv-frame .isa-stage .isa-compose-overlay .isa-caption-card{font-size:22px!important;padding:14px 20px!important;max-height:220px!important;overflow:auto!important}
body.unified-tv .isa-tv-frame .isa-stage .isa-compose-image img{max-height:100%!important;max-width:100%!important}

/* Clean, flat announcement blocks. No artificial drop-shadows in editor or TV. */
.isa-stage .isa-caption-card,.isa-stage .isa-caption-card[data-style="dark"],.isa-stage .isa-caption-card[data-style="glass"]{box-shadow:none!important;filter:none!important}
.isa-stage .isa-compose-image img,body.unified-tv .isa-tv-frame img{box-shadow:none!important;filter:none!important}
.isa-stage .isa-caption-card{font-weight:700!important;text-align:center!important}
.isa-stage .isa-caption-card[data-weight="normal"]{font-weight:400!important}
.isa-stage .isa-caption-card[data-weight="bold"]{font-weight:750!important}
.isa-stage .isa-caption-card[data-align="left"]{text-align:left!important}
.isa-stage .isa-caption-card[data-align="center"]{text-align:center!important}
.isa-stage .isa-caption-card[data-align="right"]{text-align:right!important}
.isa-stage .isa-caption-card[data-align="justify"]{text-align:justify!important;text-justify:inter-word}
.isa-stage .isa-caption-card[data-text-size="small"]{font-size:19px!important}
.isa-stage .isa-caption-card[data-text-size="medium"]{font-size:25px!important}
.isa-stage .isa-caption-card[data-text-size="large"]{font-size:32px!important}
.isa-stage .isa-compose-overlay .isa-caption-card[data-text-size="small"]{font-size:17px!important}
.isa-stage .isa-compose-overlay .isa-caption-card[data-text-size="medium"]{font-size:22px!important}
.isa-stage .isa-compose-overlay .isa-caption-card[data-text-size="large"]{font-size:28px!important}
.isa-typography-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:0 0 15px}
.isa-typography-row>div{min-width:0}
.isa-typography-row select{width:100%;min-width:0;border:1px solid #dbe5ef;background:#fff;color:#30465c;border-radius:12px;font:inherit;font-size:12px;padding:10px;outline-offset:3px}
@media(max-width:620px){.isa-typography-row{grid-template-columns:1fr 1fr}.isa-typography-row>div:last-child{grid-column:span 2}}

/* Template-first slide editor with independently managed image slots. */
.isa-template-picker{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:20px}
.isa-template-option{border:1px solid #dce6ef;border-radius:13px;background:#f8fafc;color:#3e5368;padding:10px 8px;text-align:left;cursor:pointer;min-width:0;box-shadow:none!important}
.isa-template-option[aria-pressed="true"]{background:#eaf8f6;border-color:#2dada4;box-shadow:inset 0 0 0 1px #2dada433!important}
.isa-template-option strong{display:block;margin:7px 0 2px;font-size:11px}.isa-template-option small{font-size:10px;line-height:1.25;display:block}
.isa-template-icon{height:46px;display:grid;gap:4px;border-radius:7px;padding:5px;background:#e8eef4;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(2,1fr)}
.isa-template-icon i{display:block;background:#b2cbd1;border-radius:3px}.isa-template-icon i.txt{background:#fff}
.isa-images-heading{display:flex;align-items:center;justify-content:space-between;margin:3px 0 10px;gap:10px}.isa-images-heading .isa-label{margin:0}
.isa-images{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:10px;margin-bottom:18px}
.isa-image-slot{position:relative;background:#f8fbfe;border:1px dashed #bbccdc;border-radius:14px;min-height:126px;padding:8px;display:flex;flex-direction:column;gap:6px}
.isa-image-slot img{height:100px;max-width:100%;object-fit:contain;align-self:center;border-radius:8px}.isa-image-slot strong{font-size:11px;color:#354a5d}
.isa-image-slot .isa-slot-actions{display:flex;flex-wrap:wrap;gap:5px}.isa-image-slot button{font-size:11px;padding:5px 7px;background:white;border:1px solid #d9e5ed;border-radius:8px;color:#39556a;cursor:pointer}
.isa-image-slot.is-empty{align-items:center;justify-content:center;cursor:pointer;color:#718397}.isa-image-slot.is-empty strong{font-size:13px}
.isa-template-empty{grid-column:1/-1;border:1px dashed #bfd0d9;background:#f8fbfe;padding:13px;border-radius:12px;color:#687e91;font-size:12px}
.isa-stage .isa-image-grid{display:grid!important;gap:14px!important;align-content:center;justify-items:stretch;max-width:100%;max-height:100%;min-width:0;min-height:0;width:100%;height:100%}
.isa-stage .isa-image-grid[data-count="1"]{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr)}
.isa-stage .isa-image-grid[data-count="2"]{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:minmax(0,1fr)}
.isa-stage .isa-image-grid[data-count="3"],.isa-stage .isa-image-grid[data-count="4"]{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr))}
.isa-stage .isa-image-grid img{width:100%!important;height:100%!important;max-height:100%!important;object-fit:contain!important;border-radius:10px}
.isa-stage[data-template="2"] .isa-composition-main{flex-direction:column!important;justify-content:stretch!important}
.isa-stage[data-template="2"] .isa-compose-image{width:100%;min-height:0}
.isa-stage[data-template="3"] .isa-composition-main{position:relative!important;flex:1 1 auto!important}
.isa-stage[data-template="3"] .isa-compose-image{flex:1 1 100%!important}
.isa-stage[data-template="3"] .isa-image-grid{height:100%}
.isa-stage[data-template="6"] .isa-composition{justify-content:flex-start!important}
.isa-stage[data-template="6"] .isa-composition-main{flex-wrap:wrap!important;align-content:center!important}
.isa-stage[data-template="6"] .isa-compose-image:has(.isa-image-grid[data-count="0"]){display:none!important}
.isa-stage[data-template="6"] .isa-compose-zone[data-zone="left"],.isa-stage[data-template="6"] .isa-compose-zone[data-zone="right"]{flex:1 1 230px!important;width:auto!important;max-width:44%!important}
@media(max-width:700px){.isa-template-picker{grid-template-columns:repeat(2,minmax(0,1fr))}}
/* Precisely filled template canvases: same DOM and geometry in preview and TV. */
.isa-live-preview{padding:14px;background:transparent;min-height:0}
.isa-stage .isa-template-board{box-sizing:border-box;position:absolute;inset:0;display:grid!important;gap:14px;padding:28px;width:1200px;height:675px;overflow:hidden;align-items:stretch}
.isa-stage .isa-layout-photo{position:relative;min-width:0;min-height:0;overflow:hidden;border-radius:15px;background:#dce9ec;display:flex;align-items:center;justify-content:center}
.isa-stage .isa-layout-photo img{width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:contain!important;border-radius:0!important;box-shadow:none!important}
.isa-stage .isa-layout-photo .isa-layout-placeholder{font-size:21px;font-weight:650;color:#607c87}
.isa-stage .isa-template-board .isa-layout-text{min-width:0;min-height:0;display:flex;flex-direction:column;gap:10px;align-items:stretch;justify-content:stretch}
.isa-stage .isa-template-board .isa-caption-card{flex:1 1 auto;min-width:0;min-height:0;max-width:100%!important;width:100%;max-height:100%!important;box-shadow:none!important;padding:22px 26px!important;overflow-wrap:anywhere!important;overflow:hidden!important;display:flex;flex-direction:column;justify-content:center;line-height:1.34!important;font-size:26px!important;border-radius:16px!important}
.isa-stage .isa-template-board .isa-caption-card[data-text-size="small"]{font-size:20px!important}
.isa-stage .isa-template-board .isa-caption-card[data-text-size="large"]{font-size:32px!important}
.isa-stage .isa-template-board .isa-caption-card[data-weight="normal"]{font-weight:400!important}
.isa-stage .isa-template-board .isa-caption-card[data-weight="bold"]{font-weight:750!important}
.isa-stage .isa-template-board .isa-caption-card[data-align="left"]{text-align:left!important}
.isa-stage .isa-template-board .isa-caption-card[data-align="center"]{text-align:center!important}
.isa-stage .isa-template-board .isa-caption-card[data-align="right"]{text-align:right!important}
.isa-stage .isa-template-board .isa-caption-card[data-align="justify"]{text-align:justify!important}
.isa-stage .isa-template-board .isa-layout-placeholder-text{opacity:.66;border:2px dashed #8da7b6!important}
.isa-stage .isa-template-board [data-edit-image],.isa-stage .isa-template-board [data-edit-block]{cursor:pointer}
.isa-live-preview .isa-stage [data-edit-image]:hover,.isa-live-preview .isa-stage [data-edit-block]:hover{outline:4px solid #33afa5;outline-offset:-4px}
.isa-stage .isa-layout-1{grid-template-columns:60fr 40fr;grid-template-rows:110px minmax(0,1fr)}
.isa-stage .isa-layout-1>.isa-layout-photo{grid-column:1;grid-row:1/span 2}
.isa-stage .isa-layout-1>.isa-layout-header{grid-column:2;grid-row:1}
.isa-stage .isa-layout-1>.isa-layout-body{grid-column:2;grid-row:2}
.isa-stage .isa-layout-1 .isa-layout-header .isa-caption-card{background:#30465c;color:white;font-size:30px!important}
.isa-stage .isa-layout-2{grid-template-columns:1fr 1fr;grid-template-rows:minmax(0,1fr) 135px}
.isa-stage .isa-layout-2>.isa-layout-photo:nth-child(1){grid-column:1;grid-row:1}
.isa-stage .isa-layout-2>.isa-layout-photo:nth-child(2){grid-column:2;grid-row:1}
.isa-stage .isa-layout-2>.isa-layout-footer{grid-column:1/span 2;grid-row:2}
.isa-stage .isa-layout-3{display:block!important;padding:28px}
.isa-stage .isa-layout-3>.isa-photo-hero{position:absolute;inset:28px}
.isa-stage .isa-layout-3>.isa-layout-badge{position:absolute;left:50px;top:50px;width:270px;height:90px;z-index:2}
.isa-stage .isa-layout-3>.isa-layout-overlay{position:absolute;left:50px;right:50px;bottom:50px;height:120px;z-index:2}
.isa-stage .isa-layout-3 .isa-layout-badge .isa-caption-card{background:#30465c;color:white;font-size:27px!important}
.isa-stage .isa-layout-3 .isa-layout-overlay .isa-caption-card{background:#fffffff0;color:#30465c;font-size:29px!important}
.isa-stage .isa-layout-6{grid-template-columns:37fr 63fr;grid-template-rows:100px minmax(0,1fr) minmax(0,1fr)}
.isa-stage .isa-layout-6>.isa-layout-header{grid-column:1/span 2;grid-row:1}
.isa-stage .isa-layout-6>.isa-layout-photo{grid-column:1;grid-row:2/span 2}
.isa-stage .isa-layout-6>.isa-layout-body{grid-column:2;grid-row:2}
.isa-stage .isa-layout-6>.isa-layout-details{grid-column:2;grid-row:3}
.isa-stage .isa-layout-6 .isa-layout-header .isa-caption-card{background:#30465c;color:white}
.isa-stage .isa-layout-6.isa-layout-no-photo{grid-template-columns:1fr}
.isa-stage .isa-layout-6.isa-layout-no-photo>.isa-layout-photo{display:none!important}
.isa-stage .isa-layout-6.isa-layout-no-photo>.isa-layout-body,.isa-stage .isa-layout-6.isa-layout-no-photo>.isa-layout-details{grid-column:1}
.isa-template-icon{position:relative;display:grid!important;gap:3px;background:#e9f0f3}
.isa-template-icon i{display:block;border-radius:4px;background:#b6d3d8}
.isa-mini-1{grid-template-columns:2fr 1fr!important;grid-template-rows:1fr 1fr!important}.isa-mini-1 .photo{grid-row:span 2}.isa-mini-1 .head{background:#30465c}.isa-mini-1 .body{background:#fff}
.isa-mini-2{grid-template-columns:1fr 1fr!important;grid-template-rows:2fr 1fr!important}.isa-mini-2 .footer{grid-column:span 2;background:#fff}
.isa-mini-3{display:block!important}.isa-mini-3 .hero{position:absolute;inset:5px}.isa-mini-3 .badge{position:absolute;top:9px;left:9px;width:26%;height:23%;background:#30465c}.isa-mini-3 .overlay{position:absolute;bottom:9px;left:9px;right:9px;height:25%;background:#fff}
.isa-mini-6{grid-template-columns:1fr 2fr!important;grid-template-rows:1fr 2fr!important}.isa-mini-6 .head{grid-column:span 2;background:#30465c}.isa-mini-6 .body{background:#fff}

/* v1.1.44: Compact inspector and independent, accessible caption palettes. */
.isa-editor{padding:14px!important}.isa-shell{gap:12px!important}.isa-template-picker{gap:7px!important}
.isa-blocks{gap:7px!important;margin-bottom:12px!important}
.isa-block-editor{padding:10px 12px!important;border-radius:12px!important}
.isa-block-top{margin-bottom:5px!important}
.isa-block-editor textarea{min-height:46px!important;max-height:105px!important;resize:vertical;margin-bottom:7px!important;padding:8px 10px!important;font-size:12px!important}
.isa-block-editor .isa-label{font-size:10px!important;margin-bottom:4px!important}
.isa-block-editor .isa-format-row{grid-template-columns:repeat(3,minmax(0,1fr));gap:7px!important;margin-bottom:7px!important}
.isa-block-editor .isa-format-row select,.isa-block-editor .isa-typography-row select{padding:7px 9px!important;font-size:11px!important;border-radius:9px!important;height:33px!important}
.isa-block-editor .isa-typography-row{gap:7px!important;margin-bottom:6px!important}
.isa-block-editor .isa-color-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.isa-block-editor .isa-color-row .isa-label{margin:0!important;white-space:nowrap}
.isa-color-options{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.isa-color-choice{height:27px;width:27px;padding:3px!important;display:grid;place-items:center;border:1px solid #d7e2ea;background:#fff;border-radius:9px;cursor:pointer}
.isa-color-choice span{display:block;width:100%;height:100%;border-radius:5px;background:var(--swatch);border:1px solid #00000012}
.isa-color-choice[aria-pressed="true"]{border:2px solid #138f9a;box-shadow:0 0 0 2px #138f9a22}
.isa-color-choice[data-color="default"]{--swatch:linear-gradient(135deg,#f7fafc 50%,#30465c 50%)}
.isa-color-choice[data-color="white"]{--swatch:#fff}.isa-color-choice[data-color="graphite"]{--swatch:#30465c}
.isa-color-choice[data-color="teal"]{--swatch:#ccefe8}.isa-color-choice[data-color="blue"]{--swatch:#dbeafe}
.isa-color-choice[data-color="amber"]{--swatch:#fff0c9}.isa-color-choice[data-color="rose"]{--swatch:#ffe0de}
.isa-stage .isa-template-board .isa-layout-photo.has-photo{border:0!important;background:transparent!important;outline:0!important}
.isa-stage .isa-template-board .isa-layout-photo.has-photo img{box-shadow:none!important;filter:none!important;object-fit:contain!important}
.isa-stage .isa-template-board .isa-caption-card[data-color="white"]{background:#fff!important;color:#223c54!important;border-color:#d6e0e9!important}
.isa-stage .isa-template-board .isa-caption-card[data-color="graphite"]{background:#30465c!important;color:#fff!important;border-color:#30465c!important}
.isa-stage .isa-template-board .isa-caption-card[data-color="teal"]{background:#d5f4ed!important;color:#15594f!important;border-color:#b3e4d9!important}
.isa-stage .isa-template-board .isa-caption-card[data-color="blue"]{background:#dceaff!important;color:#204e81!important;border-color:#c1d9f8!important}
.isa-stage .isa-template-board .isa-caption-card[data-color="amber"]{background:#fff0c9!important;color:#76500d!important;border-color:#f1db9c!important}
.isa-stage .isa-template-board .isa-caption-card[data-color="rose"]{background:#ffe1df!important;color:#8c3434!important;border-color:#f5c5c2!important}
.isa-stage .isa-template-board .isa-caption-card.isa-text-overflow{outline:3px solid #d77b37!important;outline-offset:-3px}
.isa-fit-notice{font-size:11px;color:#9d5b20;margin:5px 0 10px}
@media(max-width:760px){.isa-block-editor .isa-format-row{grid-template-columns:1fr 1fr}.isa-block-editor .isa-format-row>div:last-child{grid-column:span 2}}


/* v1.1.45: Text-only templates. Shared layout for preview and TV. */
.isa-stage .isa-layout-7{grid-template-columns:1fr;grid-template-rows:120px minmax(0,1fr)}
.isa-stage .isa-layout-7>.isa-layout-header{grid-column:1;grid-row:1}
.isa-stage .isa-layout-7>.isa-layout-body{grid-column:1;grid-row:2}
.isa-stage .isa-layout-8{grid-template-columns:1fr 1fr;grid-template-rows:105px minmax(0,1fr)}
.isa-stage .isa-layout-8>.isa-layout-header{grid-column:1/span 2;grid-row:1}
.isa-stage .isa-layout-8>.isa-layout-body{grid-column:1;grid-row:2}
.isa-stage .isa-layout-8>.isa-layout-details{grid-column:2;grid-row:2}
.isa-stage .isa-layout-9{grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:105px minmax(0,1fr)}
.isa-stage .isa-layout-9>.isa-layout-header{grid-column:1/span 3;grid-row:1}
.isa-stage .isa-layout-9>.isa-layout-body{grid-column:1;grid-row:2}
.isa-stage .isa-layout-9>.isa-layout-details{grid-column:2;grid-row:2}
.isa-stage .isa-layout-9>.isa-layout-extra{grid-column:3;grid-row:2}
.isa-stage .isa-layout-7 .isa-layout-header .isa-caption-card,.isa-stage .isa-layout-8 .isa-layout-header .isa-caption-card,.isa-stage .isa-layout-9 .isa-layout-header .isa-caption-card{background:#30465c;color:#fff;font-size:30px!important}
.isa-stage .isa-layout-7 .isa-layout-body .isa-caption-card{font-size:34px!important}
.isa-mini-7{grid-template-columns:1fr!important;grid-template-rows:1fr 2fr!important}
.isa-mini-7 .head,.isa-mini-8 .head,.isa-mini-9 .head{background:#30465c!important}
.isa-mini-8{grid-template-columns:1fr 1fr!important;grid-template-rows:1fr 2fr!important}
.isa-mini-8 .head{grid-column:span 2}
.isa-mini-9{grid-template-columns:repeat(3,minmax(0,1fr))!important;grid-template-rows:1fr 2fr!important}
.isa-mini-9 .head{grid-column:span 3}
.isa-mini-7 .body,.isa-mini-8 .body,.isa-mini-8 .details,.isa-mini-9 .body,.isa-mini-9 .details,.isa-mini-9 .extra{background:#e5edf1!important}
.isa-template-picker{grid-template-columns:repeat(auto-fit,minmax(160px,1fr))!important}
.isa-images-heading.isa-text-only{opacity:.55}
`;document.head.append(style);
function revokePreview(){for(const u of previewURLs)URL.revokeObjectURL(u);previewURLs=[]}
function revokeTV(){for(const u of tvURLs)URL.revokeObjectURL(u);tvURLs=[]}
const TEMPLATES=[['1','Foto + tekst','Foto obok informacji'],['2','Dwa zdjęcia','Zdjęcia obok siebie'],['3','Duże zdjęcie','Tekst na fotografii'],['6','Tablica','Komunikaty i zdjęcia'],['7','Ogłoszenie','Nagłówek i duży tekst'],['8','Dwie kolumny','Dwa bloki informacji'],['9','Trzy karty','Trzy komunikaty obok siebie']];
const validTemplate=t=>TEMPLATES.some(v=>v[0]===String(t))?String(t):'1';
const imagesFor=slide=>Array.isArray(slide?.images)?slide.images.slice(0,4):slide?.image?[slide.image]:[];
const imageURLS=(blobs,collection)=>blobs.map(b=>{if(!b)return null;const u=URL.createObjectURL(b);collection.push(u);return u});
function renderTemplates(){
 const mini={
 '1':'<i class="photo"></i><i class="head"></i><i class="body"></i>',
 '2':'<i class="photo"></i><i class="photo"></i><i class="footer"></i>',
 '3':'<i class="hero"></i><i class="badge"></i><i class="overlay"></i>',
 '6':'<i class="head"></i><i class="photo"></i><i class="body"></i>',
 '7':'<i class="head"></i><i class="body"></i>',
 '8':'<i class="head"></i><i class="body"></i><i class="details"></i>',
 '9':'<i class="head"></i><i class="body"></i><i class="details"></i><i class="extra"></i>'
 };
 $('isaTemplates').innerHTML=TEMPLATES.map(([v,label,detail])=>`<button type="button" class="isa-template-option" data-template="${v}" aria-pressed="${selectedTemplate===v}"><span class="isa-template-icon isa-mini-${v}">${mini[v]}</span><strong>${v} · ${label}</strong><small>${detail}</small></button>`).join('');
}
function renderImages(){
 const textOnly=['7','8','9'].includes(selectedTemplate);
 $('isaAddImage').hidden=textOnly;
 $('isaImages').closest('.isa-images-heading')?.classList.toggle('isa-text-only',textOnly);
 const host=$('isaImages'),slots=Math.max(draftImages.length,selectedTemplate==='2'?2:['6','7','8','9'].includes(selectedTemplate)?0:1);
 host.innerHTML=textOnly?'<div class="isa-template-empty">Ten szablon zawiera tylko tekst, bez zdjęć.</div>':Array.from({length:slots},(_,i)=>`<div class="isa-image-slot${draftImages[i]?'':' is-empty'}" data-image-index="${i}"><strong>Zdjęcie ${i+1}</strong>${draftImages[i]?'<img alt="Zdjęcie '+(i+1)+'" />':'<div>＋ Kliknij, aby dodać</div>'}<div class="isa-slot-actions"><button type="button" data-image-action="replace">${draftImages[i]?'Zamień':'Dodaj'}</button><button type="button" data-image-action="remove" ${draftImages[i]?'':'disabled'}>Usuń</button></div></div>`).join('')||'<div class="isa-template-empty">Slajd tekstowy, zdjęcie jest opcjonalne.</div>';
 const urls=imageURLS(draftImages,previewURLs);host.querySelectorAll('.isa-image-slot img').forEach(im=>im.src=urls[Number(im.closest('[data-image-index]').dataset.imageIndex)]||'');
}
const message=s=>{$('isaMsg').textContent=s};
function list(){return records.map(s=>({id:'info:'+s.id,name:'Informacje · '+s.title,description:'Zdjęcie i bloki tekstowe',available:true}))}
function drawList(){ $('isaCount').textContent=String(records.length);$('isaList').innerHTML=records.map(r=>`<button type="button" class="${r.id===selectedId?'selected':''}" data-id="${escape(r.id)}"><span>▧ ${escape(r.title)}</span></button>`).join('')||'<p class="isa-helper">Nie ma jeszcze zapisanych podstron.</p>';}
function preview(){revokePreview();renderImages();renderLivePreview()}
const POSITIONS=['bottom','top','left','right','overlay-bottom','overlay-top'];
const STYLES=['light','dark','glass'];
const validPosition=p=>POSITIONS.includes(p)?p:'bottom';
const validStyle=p=>STYLES.includes(p)?p:'light';
const WEIGHTS=['normal','bold'];
const ALIGNS=['left','center','right','justify'];
const TEXT_SIZES=['small','medium','large'];
const COLOR_SCHEMES=['default','white','graphite','teal','blue','amber','rose'];
const validColor=v=>COLOR_SCHEMES.includes(v)?v:'default';
const validWeight=v=>WEIGHTS.includes(v)?v:'bold';
const validAlign=v=>ALIGNS.includes(v)?v:'center';
const validTextSize=v=>TEXT_SIZES.includes(v)?v:'medium';
let draftBlocks=[];
const newBlock=(data={})=>({id:data.id||id(),text:String(data.text??''),position:validPosition(data.position),style:validStyle(data.style||data.cardStyle),weight:validWeight(data.weight),align:validAlign(data.align),textSize:validTextSize(data.textSize),color:validColor(data.color),slot:String(data.slot||'')});
const TEMPLATE_FIELDS={
 '1':[['header','UWAGA!'],['body','Ważna informacja dla pracowników']],
 '2':[['footer','Porównanie produktów']],
 '3':[['badge','WAŻNE!'],['overlay','Instrukcja prawidłowego pakowania']],
 '6':[['header','OGŁOSZENIE DLA PRACOWNIKÓW'],['body','Co się zmieniło?'],['details','Co należy zrobić?']],
 '7':[['header','OGŁOSZENIE'],['body','Treść ogłoszenia']],
 '8':[['header','INFORMACJE'],['body','Informacja 1'],['details','Informacja 2']],
 '9':[['header','KOMUNIKATY'],['body','Komunikat 1'],['details','Komunikat 2'],['extra','Komunikat 3']]
};
function prepareBlocks(template,blocks){
 const slots=TEMPLATE_FIELDS[template].map(x=>x[0]);
 const copied=blocks.filter(b=>String(b.text||'').trim()).map(b=>({...b}));
 const used=new Set();
 // Older records did not have slot identifiers. Assign them in visible order.
 copied.forEach((b,i)=>{if(!slots.includes(b.slot)||used.has(b.slot)){b.slot=slots.find(x=>!used.has(x))||slots[slots.length-1]}used.add(b.slot)});
 for(const [slot] of TEMPLATE_FIELDS[template])if(!used.has(slot))copied.push(newBlock({slot,style:slot==='header'||slot==='badge'?'dark':'light',align:slot==='header'||slot==='badge'?'center':'left'}));
 return copied;
}
function storedBlocks(slide){
 if(Array.isArray(slide?.textBlocks))return slide.textBlocks.map(newBlock);
 return slide?.caption?[newBlock({text:slide.caption,position:slide.position,style:slide.cardStyle})]:[];
}
const POS_LABELS=[['bottom','Pod zdjęciem'],['top','Nad zdjęciem'],['left','Po lewej'],['right','Po prawej'],['overlay-bottom','Na zdjęciu · na dole'],['overlay-top','Na zdjęciu · u góry']];
const STYLE_LABELS=[['light','Jasna karta'],['dark','Ciemna karta'],['glass','Szklana karta']];
const ALIGN_LABELS=[['left','Do lewej'],['center','Do środka'],['right','Do prawej'],['justify','Wyjustuj']];
const WEIGHT_LABELS=[['normal','Zwykły'],['bold','Pogrubiony']];
const TEXT_SIZE_LABELS=[['small','Mały'],['medium','Średni'],['large','Duży']];
const COLOR_LABELS=[['default','Domyślny'],['white','Biały'],['graphite','Grafit'],['teal','Turkus'],['blue','Błękit'],['amber','Bursztyn'],['rose','Koral']];
function renderEditors(){
 $('isaBlocks').innerHTML=draftBlocks.map((b,i)=>`<div class="isa-block-editor" data-block-id="${escape(b.id)}"><div class="isa-block-top"><span class="isa-block-number">Blok ${i+1}</span><button type="button" class="isa-block-remove" data-remove="${escape(b.id)}" aria-label="Usuń blok ${i+1}">Usuń blok</button></div><label class="isa-label" for="isaBlockText${i}">Treść bloku</label><textarea id="isaBlockText${i}" data-field="text" maxlength="1000" rows="3" placeholder="Wpisz tekst komunikatu">${escape(b.text)}</textarea><div class="isa-format-row"><div><label class="isa-label">Miejsce w szablonie</label><select data-field="slot">${TEMPLATE_FIELDS[selectedTemplate].map(([v,l])=>`<option value="${v}" ${v===b.slot?'selected':''}>${l}</option>`).join('')}</select></div><div><label class="isa-label">Położenie dodatkowe</label><select data-field="position">${POS_LABELS.map(([v,l])=>`<option value="${v}" ${v===b.position?'selected':''}>${l}</option>`).join('')}</select></div><div><label class="isa-label">Wygląd</label><select data-field="style">${STYLE_LABELS.map(([v,l])=>`<option value="${v}" ${v===b.style?'selected':''}>${l}</option>`).join('')}</select></div></div><div class="isa-typography-row"><div><label class="isa-label">Wyrównanie</label><select data-field="align">${ALIGN_LABELS.map(([v,l])=>`<option value="${v}" ${v===b.align?'selected':''}>${l}</option>`).join('')}</select></div><div><label class="isa-label">Tekst</label><select data-field="weight">${WEIGHT_LABELS.map(([v,l])=>`<option value="${v}" ${v===b.weight?'selected':''}>${l}</option>`).join('')}</select></div><div><label class="isa-label">Rozmiar</label><select data-field="textSize">${TEXT_SIZE_LABELS.map(([v,l])=>`<option value="${v}" ${v===b.textSize?'selected':''}>${l}</option>`).join('')}</select></div></div><div class="isa-color-row"><span class="isa-label">Kolor karty</span><div class="isa-color-options" role="group" aria-label="Kolor bloku">${COLOR_LABELS.map(([v,l])=>`<button type="button" class="isa-color-choice" data-color-choice="${v}" data-color="${v}" aria-label="${l}" aria-pressed="${v===b.color}" title="${l}"><span></span></button>`).join('')}</div></div></div>`).join('');
}
function compose(imageURLs,blocks,template='1',placeholder=false){
 const editor=placeholder===true;
 const board=document.createElement('div');board.className='isa-template-board isa-layout-'+validTemplate(template);
 const photoCount=template==='2'?2:1;
 const createPhoto=(i)=>{
  const slot=document.createElement('div');slot.className='isa-layout-photo';slot.dataset.editImage=String(i);
  if(imageURLs[i]){const im=document.createElement('img');im.src=imageURLs[i];im.alt='Zdjęcie '+(i+1);slot.append(im);slot.classList.add('has-photo')}
  else if(editor){const empty=document.createElement('span');empty.className='isa-layout-placeholder';empty.textContent='＋ Zdjęcie '+(i+1);slot.append(empty)}
  else{slot.classList.add('isa-layout-missing')}
  if(editor){slot.setAttribute('role','button');slot.setAttribute('tabindex','0');slot.setAttribute('title','Kliknij, aby wczytać zdjęcie')}
  return slot;
 };
 const createText=(slotName)=>{
  const container=document.createElement('div');container.className='isa-layout-text isa-layout-'+slotName;
  const matching=blocks.filter(b=>b.slot===slotName);
  if(!matching.length&&editor){const blank=newBlock({slot:slotName});matching.push(blank)}
  for(const b of matching){
   if(!b.text.trim()&&!editor)continue;
   const card=document.createElement('div');card.className='isa-caption-card isa-layout-card';card.dataset.style=validStyle(b.style);
   card.dataset.align=validAlign(b.align);card.dataset.weight=validWeight(b.weight);card.dataset.textSize=validTextSize(b.textSize);card.dataset.color=validColor(b.color);
   card.dataset.editBlock=b.id;card.textContent=b.text.trim()||(TEMPLATE_FIELDS[template].find(x=>x[0]===slotName)?.[1]||'Dodaj tekst');
   if(!b.text.trim())card.classList.add('isa-layout-placeholder-text');
   if(editor){card.setAttribute('role','button');card.setAttribute('tabindex','0');card.title='Kliknij, aby wpisać tekst'}
   container.append(card);
  }
  return container;
 };
 const el=(tag,cls)=>{const n=document.createElement(tag);n.className=cls;return n};
 if(template==='1'){
  board.append(createPhoto(0),createText('header'),createText('body'));
 }else if(template==='2'){
  board.append(createPhoto(0),createPhoto(1),createText('footer'));
 }else if(template==='3'){
  const photo=createPhoto(0);photo.classList.add('isa-photo-hero');board.append(photo,createText('badge'),createText('overlay'));
 }else if(template==='6'){
  board.append(createText('header'),createPhoto(0),createText('body'),createText('details'));
  if(!imageURLs[0]&&!editor)board.classList.add('isa-layout-no-photo');
 }else if(template==='7'){
  board.append(createText('header'),createText('body'));
 }else if(template==='8'){
  board.append(createText('header'),createText('body'),createText('details'));
 }else if(template==='9'){
  board.append(createText('header'),createText('body'),createText('details'),createText('extra'));
 }
 return board;
}
const STAGE_WIDTH=1200,STAGE_HEIGHT=675;
function stageFor(imageURLs,blocks,template,placeholder=false){
 const viewport=document.createElement('div');viewport.className='isa-stage-viewport';
 const stage=document.createElement('div');stage.className='isa-stage';
 stage.dataset.template=validTemplate(template);stage.append(compose(imageURLs,blocks,validTemplate(template),placeholder));viewport.append(stage);
 return viewport;
}
function fitCaptionCards(stage,editor){
 if(!stage?.isConnected)return;
 let over=0;
 for(const card of stage.querySelectorAll('.isa-template-board .isa-caption-card:not(.isa-layout-placeholder-text)')){
  card.classList.remove('isa-text-overflow');card.style.removeProperty('font-size');
  // Inline !important beats template-specific fixed font sizes, keeping preview and TV identical.
  const original=parseFloat(getComputedStyle(card).fontSize)||26;
  let size=original;
  while(size>15&&(card.scrollHeight>card.clientHeight+2||card.scrollWidth>card.clientWidth+2)){
   size-=1;card.style.setProperty('font-size',size+'px','important');
  }
  if(card.scrollHeight>card.clientHeight+3||card.scrollWidth>card.clientWidth+3){over++;if(editor)card.classList.add('isa-text-overflow')}
 }
 const note=$('isaFitNotice');if(editor&&note){note.hidden=!over;note.textContent=over?'Tekst nie mieści się w '+over+' blokach. Skróć treść lub wybierz inny szablon.':''}
}
function scheduleTextFit(viewport,editor){requestAnimationFrame(()=>{fitCaptionCards(viewport?.querySelector('.isa-stage'),editor)})}
function fitStage(viewport,isTV){
 if(!viewport?.isConnected)return;
 const host=isTV?$('isaTV'):$('isaLivePreview');
 const availableWidth=Math.max(1,host.clientWidth-(isTV?0:28));
 // Use the actual room below the INCYDENTY header, like Wyniki i normy.
 if(isTV&&document.body.classList.contains('unified-tv')&&!host.hidden){
  const top=host.getBoundingClientRect().top;
  host.style.height=Math.max(240,window.innerHeight-top-16)+'px';
 }
 const availableHeight=isTV?Math.max(1,host.clientHeight):Infinity;
 const scale=Math.min(availableWidth/STAGE_WIDTH,availableHeight/STAGE_HEIGHT);
 if(!(scale>0))return;
 viewport.style.width=(STAGE_WIDTH*scale)+'px';
 viewport.style.height=(STAGE_HEIGHT*scale)+'px';
 viewport.firstElementChild.style.transform='scale('+scale+')';
}
function refreshStageFits(){
 fitStage($('isaLivePreview').querySelector('.isa-stage-viewport'),false);
 fitStage($('isaTV').querySelector('.isa-stage-viewport'),true);
}
window.addEventListener('resize',refreshStageFits);
const fitObserver=new ResizeObserver(refreshStageFits);
fitObserver.observe($('isaLivePreview'));fitObserver.observe($('isaTV'));
function renderLivePreview(){
 const host=$('isaLivePreview');if(!host)return;
 // Do not revoke object URLs until both editor thumbnails and stage have been replaced.
 const urls=Array.from({length:Math.max(draftImages.length,selectedTemplate==='2'?2:1)},(_,i)=>$('isaImages').querySelector(`[data-image-index="${i}"] img`)?.src||null);
 const stage=stageFor(urls,draftBlocks,selectedTemplate,true);host.replaceChildren(stage);
 fitStage(stage,false);scheduleTextFit(stage,true);
}
$('isaLivePreview').addEventListener('click',e=>{
 const block=e.target.closest('[data-edit-block]');if(block){const editor=$('isaBlocks').querySelector(`[data-block-id="${block.dataset.editBlock}"] textarea`);if(editor){editor.scrollIntoView({behavior:'smooth',block:'center'});editor.focus()}return}
 const photo=e.target.closest('[data-edit-image]');if(photo){replaceImageIndex=Number(photo.dataset.editImage);$('isaFiles').click()}
});
$('isaLivePreview').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const target=e.target.closest('[data-edit-block],[data-edit-image]');if(target){e.preventDefault();target.click()}}});
$('isaTemplates').onclick=e=>{const b=e.target.closest('[data-template]');if(!b)return;selectedTemplate=validTemplate(b.dataset.template);draftBlocks=prepareBlocks(selectedTemplate,draftBlocks);renderTemplates();renderEditors();preview()};
let replaceImageIndex=-1;
$('isaAddImage').onclick=()=>{replaceImageIndex=-1;$('isaFiles').click()};
$('isaImages').onclick=e=>{const b=e.target.closest('[data-image-action]'),slot=e.target.closest('[data-image-index]');if(!b||!slot)return;const i=Number(slot.dataset.imageIndex),action=b.dataset.imageAction;
 if(action==='replace'){replaceImageIndex=i;$('isaFiles').click();return}
 if(action==='remove')draftImages[i]=null;
 if(action==='left'&&i>0)[draftImages[i-1],draftImages[i]]=[draftImages[i],draftImages[i-1]];
 if(action==='right'&&i<draftImages.length-1)[draftImages[i+1],draftImages[i]]=[draftImages[i],draftImages[i+1]];
 preview();
};
function acceptImages(files){const incoming=[...files].filter(f=>['image/png','image/jpeg','image/webp'].includes(f.type)&&f.size<=16*1024*1024);
 if(!incoming.length){message('Wybierz PNG, JPG lub WebP (maks. 16 MB na zdjęcie).');return}
 if(replaceImageIndex>=0){draftImages[replaceImageIndex]=incoming[0];replaceImageIndex=-1}else{for(const file of incoming){const empty=draftImages.findIndex(x=>!x);if(empty>=0)draftImages[empty]=file;else draftImages.push(file)}}
 if(draftImages.length>4){draftImages=draftImages.slice(0,4);message('Maksymalnie 4 zdjęcia na jednym slajdzie.')}else message('Zdjęcia dodane. Zapisz podstronę, aby zachować zmiany.');
 preview();
}
$('isaFiles').onchange=e=>{acceptImages(e.target.files);e.target.value=''};
// Image files can also be dropped directly onto the image collection.
for(const eventName of ['dragenter','dragover'])$('isaImages').addEventListener(eventName,e=>{e.preventDefault()});
$('isaImages').addEventListener('drop',e=>{e.preventDefault();acceptImages(e.dataTransfer.files)});
$('isaAddBlock').onclick=()=>{const slot=TEMPLATE_FIELDS[selectedTemplate].at(-1)[0];draftBlocks.push(newBlock({slot}));renderEditors();renderLivePreview();$('isaBlocks').querySelector('.isa-block-editor:last-child textarea')?.focus()};
$('isaBlocks').addEventListener('input',e=>{const editor=e.target.closest('[data-block-id]'),field=e.target.dataset.field;if(!editor||!field)return;const b=draftBlocks.find(x=>x.id===editor.dataset.blockId);if(!b)return;b[field]=e.target.value;renderLivePreview()});
$('isaBlocks').addEventListener('change',e=>{const editor=e.target.closest('[data-block-id]'),field=e.target.dataset.field;if(!editor||!field)return;const b=draftBlocks.find(x=>x.id===editor.dataset.blockId);if(!b)return;b[field]=e.target.value;renderLivePreview()});
$('isaBlocks').addEventListener('click',e=>{
 const color=e.target.closest('[data-color-choice]');
 if(color){const editor=color.closest('[data-block-id]'),b=draftBlocks.find(b=>b.id===editor?.dataset.blockId);if(!b)return;b.color=validColor(color.dataset.colorChoice);editor.querySelectorAll('[data-color-choice]').forEach(x=>x.setAttribute('aria-pressed',String(x===color)));renderLivePreview();return}
 const btn=e.target.closest('[data-remove]');if(!btn)return;draftBlocks=draftBlocks.filter(b=>b.id!==btn.dataset.remove);renderEditors();renderLivePreview();
});
function choose(r){selectedId=r?.id||null;draftImages=imagesFor(r);selectedTemplate=validTemplate(r?.template);$('isaTitle').value=r?.title||'';draftBlocks=prepareBlocks(selectedTemplate,storedBlocks(r));renderTemplates();renderEditors();preview();$('isaDelete').disabled=!r;message('');drawList()}
function open(){area.hidden=false;$('infoSlidesTab').classList.add('active');$('assignment').classList.remove('active');$('results').classList.remove('active');$('norms').hidden=true;$('workerArea').hidden=true;$('assign').hidden=true;$('resultViews').hidden=true;$('upload').hidden=true;$('tv').disabled=!records.length;area.classList.remove('tv-view');area.querySelector('.isa-shell').hidden=false;$('isaTV').hidden=true;}
function close(){area.hidden=true;$('isaTV').hidden=true;revokeTV();$('infoSlidesTab').classList.remove('active');}
function showTV(ref){const slide=records.find(r=>r.id===ref);if(!slide)return;area.hidden=false;$('isaTV').hidden=false;revokeTV();const urls=imageURLS(imagesFor(slide),tvURLs);const stage=stageFor(['7','8','9'].includes(validTemplate(slide.template))?[]:urls,storedBlocks(slide),validTemplate(slide.template));$('isaTV').querySelector('.isa-tv-frame').replaceChildren(stage);requestAnimationFrame(()=>{fitStage(stage,true);scheduleTextFit(stage,false)});}
function restore(){revokeTV();open();}
$('isaNew').onclick=()=>choose(null);
$('isaList').onclick=e=>{const b=e.target.closest('button[data-id]');if(b)choose(records.find(r=>r.id===b.dataset.id))};
$('isaSave').onclick=async()=>{if(saving)return;const title=$('isaTitle').value.trim(),textBlocks=draftBlocks.map(x=>({...x,text:x.text.trim()})).filter(x=>x.text);
 if(!title){message('Wpisz tytuł podstrony.');return}
 if(!draftImages.some(Boolean)&&!['6','7','8','9'].includes(selectedTemplate)){message('Dodaj zdjęcie lub wybierz szablon tekstowy.');return}
 if(!draftImages.some(Boolean)&&!textBlocks.length){message('Dodaj zdjęcie lub blok tekstu.');return}
 saving=true;$('isaSave').disabled=true;
 try{const old=records.find(r=>r.id===selectedId);const item={id:old?.id||id(),title,template:selectedTemplate,textBlocks,images:[...draftImages],image:draftImages.find(Boolean)||null,updatedAt:Date.now()};await tx('readwrite',s=>s.put(item));const i=records.findIndex(s=>s.id===item.id);if(i>=0)records[i]=item;else records.push(item);choose(item);message('Podstrona zapisana. Możesz wybrać ją w ustawieniach TV.');$('tv').disabled=false;}
 catch(err){message('Nie udało się zapisać podstrony: '+(err?.message||'brak miejsca'))}finally{saving=false;$('isaSave').disabled=false}
};
$('isaDelete').onclick=async()=>{const item=records.find(r=>r.id===selectedId);if(!item||!confirm('Usunąć podstronę '+item.title+'?'))return;try{await tx('readwrite',s=>s.delete(item.id));records=records.filter(r=>r.id!==item.id);choose(records[0]||null);$('tv').disabled=!records.length;message('Usunięto podstronę.')}catch{message('Nie udało się usunąć podstrony.')}};
infoTab.onclick=()=>{open()};
$('assignment').addEventListener('click',close);$('results').addEventListener('click',close);
window.incSlides={list,open,close,showTV,restore,isOpen:()=>!area.hidden};
(async()=>{try{db=await openDB();records=await tx('readonly',s=>s.getAll());records.sort((a,b)=>a.updatedAt-b.updatedAt);choose(records[0]||null)}catch(err){message('Przeglądarka nie pozwala zapisywać zdjęć: '+(err?.message||'IndexedDB'))}})();
})();
