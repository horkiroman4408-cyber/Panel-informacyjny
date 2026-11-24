'use strict';
/* INCYDENTY · PDF documents as saved subpages, not a separate top panel. */
(()=>{
  const DB='incydenty-pdf-slides-v1',STORE='pdfs',MAX_SIZE=20*1024*1024;
  const $=id=>document.getElementById(id);
  const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&amp;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=()=>`pdf${Date.now().toString(36)}${Math.random().toString(36).slice(2,9)}`;
  let db=null,records=[],selectedPdf=null,viewerUrl=null,tvUrl=null,installed=false,observer=null;
  const openDB=()=>new Promise((res,rej)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'});};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
  const tx=(mode,fn)=>new Promise((res,rej)=>{const t=db.transaction(STORE,mode),r=fn(t.objectStore(STORE));t.oncomplete=()=>res(r?.result);t.onerror=()=>rej(t.error);});
  function message(text,error=false){const e=$('pdfInlineMessage');if(e){e.textContent=text;e.dataset.error=error?'true':'false';}}
  function revokeView(){if(viewerUrl){URL.revokeObjectURL(viewerUrl);viewerUrl=null;}}
  function revokeTV(){if(tvUrl){URL.revokeObjectURL(tvUrl);tvUrl=null;}}
  function closeTV(){const wrap=$('pdfSlidesTV'),area=$('infoSlidesArea');if(wrap){wrap.hidden=true;wrap.querySelector('iframe')?.removeAttribute('src');}area?.classList.remove('pdf-tv-mode');revokeTV();}
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
    $('pdfInlineFrame').src=viewerUrl+'#toolbar=0&navpanes=0&view=Fit';
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
    tvUrl=URL.createObjectURL(r.blob);
    $('pdfTVName').textContent=r.title;
    $('pdfTVFrame').src=tvUrl+'#toolbar=0&navpanes=0&view=Fit';
    $('pdfTVOpen').href=tvUrl;$('pdfTVOpen').download=r.fileName;
    area.hidden=false;area.classList.add('pdf-tv-mode');wrap.hidden=false;
    $('isaTV')?.setAttribute('hidden','');
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
    tv.innerHTML='<div class="pdfs-tv-title" id="pdfTVName"></div><div class="pdfs-tv-stage"><iframe id="pdfTVFrame" title="Plan ewakuacji PDF" loading="eager"></iframe></div><div class="pdfs-tv-fallback"><a id="pdfTVOpen" target="_blank" rel="noopener">Otwórz oryginalny PDF</a></div>';
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
      body.unified-tv #infoSlidesArea.pdf-tv-mode #pdfSlidesTV{display:flex!important;flex-direction:column;gap:5px;width:100%;height:calc(100dvh - 125px);min-height:320px}
      #pdfSlidesTV .pdfs-tv-title{font-size:clamp(16px,1.25vw,25px);font-weight:800;color:#25435d;text-align:center;padding:3px}
      #pdfSlidesTV .pdfs-tv-stage{flex:1;min-height:0;border:1px solid #d8e4ed;border-radius:10px;overflow:hidden;background:#fff}
      #pdfSlidesTV iframe{width:100%;height:100%;border:0;display:block;background:#fff}
      #pdfSlidesTV .pdfs-tv-fallback{text-align:center;font-size:11px;color:#667e90}
      #pdfSlidesTV .pdfs-tv-fallback a{color:#176ca7}
      @media(max-width:780px){#infoSlidesArea .isa-heading>.pdfs-header-actions{grid-column:1;justify-self:center;justify-content:center}#pdfInlineViewer{grid-column:1;min-height:400px}}
    `;document.head.append(style);
    pdfList();return true;
  }
  let tries=0;const timer=setInterval(()=>{if(install()||++tries>=200)clearInterval(timer)},50);
  openDB().then(async connection=>{db=connection;records=await tx('readonly',s=>s.getAll());records.sort((a,b)=>b.lastModified-a.lastModified);pdfList();}).catch(e=>{console.warn('INCYDENTY PDF storage unavailable:',e);});
})();
