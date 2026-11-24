'use strict';
/* INCYDENTY · PDF documents as saved subpages, not a separate top panel. */
(()=>{
  const DB='incydenty-pdf-slides-v1',STORE='pdfs',MAX_SIZE=20*1024*1024;
  const $=id=>document.getElementById(id);
  const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&amp;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=()=>`pdf${Date.now().toString(36)}${Math.random().toString(36).slice(2,9)}`;
  let db=null,records=[],selectedPdf=null,viewerUrl=null,tvUrl=null,installed=false,observer=null;
  // The TV uses an actual page canvas rather than Edge's built-in PDF viewer.
  // The viewer remains available as a fallback if the renderer cannot load.
  let tvRenderToken=0, tvPDFDocument=null, pdfLoaderPromise=null, tvRecord=null;
  const PDFJS_URL='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDFJS_WORKER='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  function pdfEngine(){
    if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);
    if(pdfLoaderPromise)return pdfLoaderPromise;
    pdfLoaderPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=PDFJS_URL;
      script.crossOrigin='anonymous';script.async=true;
      script.onload=()=>window.pdfjsLib?resolve(window.pdfjsLib):reject(Error('Brak renderer PDF'));
      script.onerror=()=>reject(Error('Nie można pobrać modułu podglądu PDF'));
      document.head.append(script);
    }).catch(err=>{pdfLoaderPromise=null;throw err});
    return pdfLoaderPromise;
  }
  async function drawTVPDF(record,token){
    const canvas=$('pdfTVCanvas'),frame=$('pdfTVFrame'),status=$('pdfTVStatus');
    if(!canvas||!record)return;
    status.hidden=true; canvas.hidden=true; frame.hidden=true;
    try{
      const lib=await pdfEngine();if(token!==tvRenderToken)return;
      lib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;
      const bytes=new Uint8Array(await record.blob.arrayBuffer());
      const task=lib.getDocument({data:bytes});
      const pdf=await task.promise;
      if(token!==tvRenderToken){pdf.destroy();return;}
      if(tvPDFDocument&&tvPDFDocument!==pdf)tvPDFDocument.destroy();
      tvPDFDocument=pdf;
      const page=await pdf.getPage(1);
      if(token!==tvRenderToken)return;
      const vp=page.getViewport({scale:1});
      const host=$('pdfSlidesTV').querySelector('.pdfs-tv-stage');
      const box=host.getBoundingClientRect();
      // Keep the entire PDF page inside the softly padded TV mat.
      const mat=getComputedStyle(host);
      const usableWidth=box.width-(parseFloat(mat.paddingLeft)||0)-(parseFloat(mat.paddingRight)||0)-4;
      const usableHeight=box.height-(parseFloat(mat.paddingTop)||0)-(parseFloat(mat.paddingBottom)||0)-4;
      const scale=Math.max(.1,Math.min(usableWidth/vp.width,usableHeight/vp.height));
      const dpr=Math.min(2,window.devicePixelRatio||1);
      const renderViewport=page.getViewport({scale:scale*dpr});
      canvas.width=Math.max(1,Math.ceil(renderViewport.width));
      canvas.height=Math.max(1,Math.ceil(renderViewport.height));
      canvas.style.width=(renderViewport.width/dpr)+'px';
      canvas.style.height=(renderViewport.height/dpr)+'px';
      const ctx=canvas.getContext('2d',{alpha:false});
      ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
      await page.render({canvasContext:ctx,viewport:renderViewport}).promise;
      if(token!==tvRenderToken)return;
      canvas.hidden=false;
    }catch(err){
      if(token!==tvRenderToken)return;
      console.warn('INCYDENTY: PDF canvas renderer unavailable:',err);
      // Fallback keeps the document accessible, although Edge can show margins.
      frame.hidden=false;
      status.hidden=false;
      status.textContent='Podgląd PDF: używany jest tryb awaryjny przeglądarki.';
    }
  }

  const openDB=()=>new Promise((res,rej)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'});};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
  const tx=(mode,fn)=>new Promise((res,rej)=>{const t=db.transaction(STORE,mode),r=fn(t.objectStore(STORE));t.oncomplete=()=>res(r?.result);t.onerror=()=>rej(t.error);});
  function message(text,error=false){const e=$('pdfInlineMessage');if(e){e.textContent=text;e.dataset.error=error?'true':'false';}}
  function revokeView(){if(viewerUrl){URL.revokeObjectURL(viewerUrl);viewerUrl=null;}}
  function revokeTV(){if(tvUrl){URL.revokeObjectURL(tvUrl);tvUrl=null;}}
  function fitPDFScreen(){
    const area=$('infoSlidesArea'),stage=$('pdfSlidesTV');
    if(!area||!stage||!document.body.classList.contains('inc-pdf-tv-screen'))return;
    // Fill the space underneath the INCYDENTY header without overflowing the TV.
    const top=Math.max(0,area.getBoundingClientRect().top);
    stage.style.height=Math.max(240,Math.floor(window.innerHeight-top-12))+'px';
  }
  function closeTV(){
    tvRenderToken++;tvRecord=null;
    if(tvPDFDocument){tvPDFDocument.destroy();tvPDFDocument=null;}
    if($('pdfTVCanvas'))$('pdfTVCanvas').hidden=true;
    if($('pdfTVStatus'))$('pdfTVStatus').hidden=true;
    const wrap=$('pdfSlidesTV'),area=$('infoSlidesArea');
    if(wrap){wrap.hidden=true;wrap.style.height='';wrap.querySelector('iframe')?.removeAttribute('src');}
    area?.classList.remove('pdf-tv-mode');
    document.body.classList.remove('inc-pdf-tv-screen');
    revokeTV();
  }
  function pdfList(){
    const list=$('isaList');if(!list)return;
    // Existing editor rebuilds #isaList after saving/deleting slides. Keep PDF
    // items in the same list without changing the original editor's data model.
    const existing=[...list.querySelectorAll('[data-pdf-page]')];
    if(existing.length===records.length&&existing.every((n,i)=>n.dataset.pdfPage===records[i].id)){
      for(const n of existing)n.classList.toggle('selected',n.dataset.pdfPage===selectedPdf);
      return;
    }
    existing.forEach(n=>n.remove());
    for(const r of records){
      const button=document.createElement('button');button.type='button';button.dataset.pdfPage=r.id;
      button.className=r.id===selectedPdf?'selected pdf-list-entry':'pdf-list-entry';
      button.textContent='▤ PDF · '+r.title;button.title=r.fileName;
      list.append(button);
    }
    const count=$('isaCount');if(count){const base=[...list.children].filter(n=>!n.hasAttribute('data-pdf-page')&&n.matches('button[data-id]')).length;count.textContent=String(base+records.length);}
  }
  function view(id){
    const r=records.find(v=>v.id===id);if(!r)return;
    selectedPdf=id;closeTV();revokeView();
    const area=$('infoSlidesArea');area.hidden=false;
    const editor=area.querySelector('.isa-editor');if(editor)editor.hidden=true;
    const box=$('pdfInlineViewer');box.hidden=false;
    $('pdfInlineTitle').textContent=r.title;
    $('pdfInlineFile').textContent=r.fileName;
    viewerUrl=URL.createObjectURL(r.blob);
    $('pdfInlineFrame').src=viewerUrl+'#toolbar=0&navpanes=0&scrollbar=0&view=Fit&zoom=page-fit';
    $('pdfInlineOpen').href=viewerUrl;$('pdfInlineOpen').download=r.fileName;
    pdfList();
  }
  function leaveView(){
    selectedPdf=null;
    revokeView();const box=$('pdfInlineViewer');if(box){box.hidden=true;$('pdfInlineFrame')?.removeAttribute('src');}
    const editor=$('infoSlidesArea')?.querySelector('.isa-editor');if(editor)editor.hidden=false;
    pdfList();
  }
  function showTV(id){
    const r=records.find(v=>v.id===id);if(!r)return;
    closeTV();revokeTV();
    const area=$('infoSlidesArea'),wrap=$('pdfSlidesTV');if(!area||!wrap)return;
    // An information slide must replace the previous TV screen completely.
    // STOCK CONTROL is another dynamically appended section; the old controller
    // doesn't automatically hide it when switching from stock to PDF.
    const stock=$('stockControl');
    if(stock){stock.hidden=true;stock.classList.remove('stk-unified-screen');}
    for(const id of ['norms','assign','workerArea']){const node=$(id);if(node)node.hidden=true;}
    const stockHeading=$('stkTVTitle');if(stockHeading)stockHeading.hidden=true;
    document.body.classList.add('inc-pdf-tv-screen');
    tvRecord=r;tvUrl=URL.createObjectURL(r.blob);
    $('pdfTVName').textContent=r.title;
    $('pdfTVFrame').src=tvUrl+'#toolbar=0&navpanes=0&scrollbar=0&view=Fit&zoom=page-fit';
    $('pdfTVOpen').href=tvUrl;$('pdfTVOpen').download=r.fileName;
    area.hidden=false;area.classList.add('pdf-tv-mode');wrap.hidden=false;
    $('isaTV')?.setAttribute('hidden','');
    const renderToken=++tvRenderToken;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{fitPDFScreen();drawTVPDF(r,renderToken)}));
  }
  async function add(file){
    if(!file)return;
    if(!/\.pdf$/i.test(file.name)){message('Wybierz plik PDF.',true);return;}
    if(file.size>MAX_SIZE){message('Maksymalny rozmiar PDF: 20 MB.',true);return;}
    const bytes=new Uint8Array(await file.slice(0,5).arrayBuffer());
    if(String.fromCharCode(...bytes)!=='%PDF-'){message('Nieprawidłowy plik PDF.',true);return;}
    const title=prompt('Nazwa podstrony:',file.name.replace(/\.pdf$/i,'').replace(/[_-]+/g,' ').trim()||'Plan ewakuacji');
    if(title===null)return;
    if(!title.trim()){message('Wpisz nazwę podstrony.',true);return;}
    const r={id:uid(),title:title.trim().slice(0,100),fileName:file.name.slice(0,180),blob:file,lastModified:Date.now()};
    try{if(!db)throw Error('Baza danych nie jest gotowa');await tx('readwrite',s=>s.put(r));records.unshift(r);view(r.id);message('Zapisano PDF jako podstronę. Możesz dodać go do Tryb TV.');$('tv').disabled=false;}
    catch(e){message('Nie udało się zapisać dokumentu PDF.',true);}
  }
  async function remove(){
    const r=records.find(v=>v.id===selectedPdf);if(!r||!confirm('Usunąć podstronę PDF „'+r.title+'”?'))return;
    try{await tx('readwrite',s=>s.delete(r.id));records=records.filter(v=>v.id!==r.id);leaveView();message('Usunięto PDF.');}
    catch{message('Nie udało się usunąć PDF.',true);}
  }
  function install(){
    if(installed||!window.incSlides||!$('isaList')||!$('isaNew'))return false;
    installed=true;
    const api=window.incSlides,area=$('infoSlidesArea');
    const old={list:api.list,showTV:api.showTV,open:api.open,close:api.close,restore:api.restore};
    const button=document.createElement('button');button.type='button';button.id='pdfSlidesAdd';button.textContent='＋ Dodaj PDF';button.title='Dodaj dokument PDF do zapisanych podstron';
    const header=document.createElement('div');header.className='pdfs-header-actions';
    $('isaNew').parentElement.insertBefore(header,$('isaNew'));header.append(button,$('isaNew'));
    const input=document.createElement('input');input.id='pdfSlidesFile';input.type='file';input.accept='.pdf,application/pdf';input.hidden=true;area.append(input);
    button.onclick=()=>input.click();input.onchange=()=>{const f=input.files?.[0];input.value='';if(f)add(f);};
    const editor=area.querySelector('.isa-editor');
    const box=document.createElement('section');box.id='pdfInlineViewer';box.hidden=true;
    box.innerHTML='<div class="pdf-inline-heading"><div><strong id="pdfInlineTitle"></strong><small id="pdfInlineFile"></small></div><div class="pdf-inline-actions"><a id="pdfInlineOpen" target="_blank" rel="noopener">Otwórz PDF</a><button type="button" id="pdfInlineDelete">Usuń PDF</button></div></div><div class="pdf-inline-stage"><iframe id="pdfInlineFrame" title="Podgląd PDF w aplikacji" loading="eager"></iframe></div><p id="pdfInlineMessage" role="status"></p>';
    if(editor)editor.insertAdjacentElement('afterend',box);else area.querySelector('.isa-shell')?.append(box);
    $('pdfInlineDelete').onclick=remove;
    const tv=document.createElement('div');tv.id='pdfSlidesTV';tv.hidden=true;
    tv.innerHTML='<div class="pdfs-tv-title" id="pdfTVName"></div><div class="pdfs-tv-stage"><canvas id="pdfTVCanvas" aria-label="Plan ewakuacji" hidden></canvas><iframe id="pdfTVFrame" title="Plan ewakuacji PDF" loading="eager" hidden></iframe></div><div id="pdfTVStatus" hidden></div><div class="pdfs-tv-fallback"><a id="pdfTVOpen" target="_blank" rel="noopener">Otwórz oryginalny PDF</a></div>';
    area.append(tv);
    // Select a PDF through the existing "Zapisane podstrony" list.
    $('isaList').addEventListener('click',e=>{
      const b=e.target.closest('[data-pdf-page]');if(b){e.preventDefault();e.stopImmediatePropagation();view(b.dataset.pdfPage);}
      else if(e.target.closest('button[data-id]'))leaveView();
    },true);
    observer=new MutationObserver(pdfList);observer.observe($('isaList'),{childList:true});
    api.list=()=>[...old.list(),...records.map(r=>({id:'info:pdf:'+r.id,name:'PDF · '+r.title,description:'Dokument PDF · '+r.fileName,available:true}))];
    api.showTV=id=>{if(id.startsWith('pdf:'))showTV(id.slice(4));else{closeTV();old.showTV(id);}};
    api.close=()=>{closeTV();old.close();};
    api.open=()=>{closeTV();old.open();if(records.length)$('tv').disabled=false;};
    api.restore=()=>{closeTV();old.restore();if(records.length)$('tv').disabled=false;};
    // The original tab button calls its private open(), not api.open().
    $('infoSlidesTab')?.addEventListener('click',()=>{if(records.length)$('tv').disabled=false;});
    const style=document.createElement('style');style.textContent=`
      #infoSlidesArea #pdfSlidesAdd{border:1px solid #cfdde9;border-radius:12px;background:#f6fbff;color:#17618f;padding:11px 14px;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap}
      #infoSlidesArea .isa-heading>.pdfs-header-actions{grid-column:3;justify-self:end;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
      #infoSlidesArea .pdfs-header-actions #isaNew{position:static}
      #infoSlidesArea .isa-list .pdf-list-entry{display:block;width:100%;text-align:left}
      #infoSlidesArea .isa-editor[hidden],#pdfInlineViewer[hidden],#pdfSlidesTV[hidden]{display:none!important}
      #pdfInlineViewer{grid-column:2;min-width:0;display:flex;flex-direction:column;gap:12px;min-height:530px;background:rgba(255,255,255,.83);border:1px solid #e2e9f1;border-radius:20px;padding:18px}
      #pdfInlineViewer .pdf-inline-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
      #pdfInlineViewer .pdf-inline-heading>div{display:grid;gap:4px;min-width:0}
      #pdfInlineViewer .pdf-inline-heading strong{font-size:17px;color:#233e58;overflow-wrap:anywhere}
      #pdfInlineViewer .pdf-inline-heading small{font-size:11px;color:#74879a;overflow-wrap:anywhere}
      #pdfInlineViewer .pdf-inline-actions{display:flex;gap:8px}
      #pdfInlineViewer .pdf-inline-actions a,#pdfInlineViewer .pdf-inline-actions button{padding:9px 12px;border:1px solid #d8e4ef;border-radius:10px;background:#fff;color:#206493;font-size:12px;font-weight:700;text-decoration:none;cursor:pointer}
      #pdfInlineViewer .pdf-inline-stage{flex:1;min-height:500px;overflow:hidden;border:1px solid #d8e4ed;border-radius:13px;background:#fff}
      #pdfInlineViewer iframe{width:100%;height:100%;min-height:500px;border:0;display:block}
      #pdfInlineMessage{font-size:11px;color:#16816b;margin:0}#pdfInlineMessage[data-error=true]{color:#b63e32}
      #infoSlidesArea.pdf-tv-mode .isa-heading,#infoSlidesArea.pdf-tv-mode .isa-shell,#infoSlidesArea.pdf-tv-mode #isaTV{display:none!important}
      body.unified-tv #infoSlidesArea.pdf-tv-mode{display:block!important;width:100%;max-width:none;margin:0;padding:0!important}
      body.unified-tv #infoSlidesArea.pdf-tv-mode #pdfSlidesTV{display:flex!important;flex-direction:column;gap:0;width:100%;height:calc(100dvh - 125px);min-height:240px}
      body.inc-pdf-tv-screen #stockControl,body.inc-pdf-tv-screen #norms,body.inc-pdf-tv-screen #assign,body.inc-pdf-tv-screen #workerArea{display:none!important}
      body.inc-pdf-tv-screen #infoSlidesArea.pdf-tv-mode{position:relative;z-index:2;overflow:hidden}
      body.inc-pdf-tv-screen #pdfSlidesTV .pdfs-tv-title,body.inc-pdf-tv-screen #pdfSlidesTV .pdfs-tv-fallback{display:none!important}
      body.inc-pdf-tv-screen #pdfSlidesTV .pdfs-tv-stage{border:0;border-radius:0;background:transparent;min-height:0;flex:1;width:100%;overflow:hidden}
      body.inc-pdf-tv-screen #pdfTVFrame{display:block;width:100%;height:100%;border:0;background:white}
      #pdfSlidesTV .pdfs-tv-title{font-size:clamp(16px,1.25vw,25px);font-weight:800;color:#25435d;text-align:center;padding:3px}
      #pdfSlidesTV .pdfs-tv-stage{flex:1;min-height:0;border:1px solid #d8e4ed;border-radius:10px;overflow:hidden;background:#fff}
      #pdfSlidesTV iframe{width:100%;height:100%;border:0;display:block;background:#fff}
      #pdfSlidesTV .pdfs-tv-fallback{text-align:center;font-size:11px;color:#667e90}
      #pdfSlidesTV .pdfs-tv-fallback a{color:#176ca7}
      body.inc-pdf-tv-screen #pdfSlidesTV .pdfs-tv-stage{display:flex;align-items:center;justify-content:center;background:#fff!important;overflow:hidden}
      body.inc-pdf-tv-screen #pdfTVCanvas{display:block;max-width:100%;max-height:100%;object-fit:contain;background:#fff}
      /* TV: a quiet exhibition mat around the original, unmodified PDF page.
         White regions drawn INSIDE the PDF remain untouched for safety. */
      body.inc-pdf-tv-screen #pdfSlidesTV .pdfs-tv-stage{
        padding:clamp(10px,1.2vw,22px)!important;
        background:linear-gradient(145deg,#edf2f7 0%,#e5edf5 100%)!important;
        border:1px solid rgba(123,146,166,.18)!important;
        border-radius:14px!important;
        box-shadow:inset 0 1px 2px rgba(34,62,82,.04)!important;
      }
      body.inc-pdf-tv-screen #pdfTVCanvas:not([hidden]){
        flex:none;
        border:1px solid rgba(99,124,145,.22);
        border-radius:3px;
        box-shadow:0 9px 28px rgba(26,49,68,.12),0 2px 6px rgba(26,49,68,.06);
      }
      body.inc-pdf-tv-screen #pdfTVCanvas[hidden],body.inc-pdf-tv-screen #pdfTVFrame[hidden]{display:none!important}
      body.inc-pdf-tv-screen #pdfTVStatus{position:absolute;bottom:12px;left:20px;font-size:11px;color:#718096}
      body.inc-pdf-tv-screen #pdfTVFrame:not([hidden]){clip-path:inset(0 11% 0 11%)}
      @media(max-width:780px){#infoSlidesArea .isa-heading>.pdfs-header-actions{grid-column:1;justify-self:center;justify-content:center}#pdfInlineViewer{grid-column:1;min-height:400px}}
    `;document.head.append(style);
    let tvResizeId;
    window.addEventListener('resize',()=>{fitPDFScreen();if(tvRecord){clearTimeout(tvResizeId);tvResizeId=setTimeout(()=>drawTVPDF(tvRecord,++tvRenderToken),140);}});
    document.addEventListener('fullscreenchange',()=>requestAnimationFrame(()=>{
      fitPDFScreen();if(tvRecord)drawTVPDF(tvRecord,++tvRenderToken);
    }));
    pdfList();return true;
  }
  let tries=0;const timer=setInterval(()=>{if(install()||++tries>=200)clearInterval(timer)},50);
  openDB().then(async connection=>{db=connection;records=await tx('readonly',s=>s.getAll());records.sort((a,b)=>b.lastModified-a.lastModified);pdfList();}).catch(e=>{console.warn('INCYDENTY PDF storage unavailable:',e);});
})();
