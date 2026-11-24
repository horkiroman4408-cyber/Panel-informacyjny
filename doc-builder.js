'use strict';
/* INCYDENTY · Konstruktor dokumentów · v1.1.64 compatible.
   Isolated editor, saved subpages, and unified TV. No changes to KPI or existing slides. */
(()=>{
const DB='incydenty-document-builder-v1',STORE='documents',MAX_IMG=6*1024*1024;
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&quot;'}[c]));
const uid=()=>('dc'+Date.now().toString(36)+Math.random().toString(36).slice(2,8));
const pages={'a4-portrait':{w:1000,h:1414,label:'A4 · pion'},'a4-landscape':{w:1000,h:707,label:'A4 · poziom'},'tv':{w:1000,h:563,label:'TV · 16:9'}};
const types={heading:'Nagłówek',text:'Tekst',step:'Krok numerowany',yesno:'TAK / NIE',table:'Tabela',image:'Zdjęcie',alert:'Ważne / alert',panel:'Ramka',arrow:'Strzałka'};
let db=null,items=[],active=null,chosen=null,modified=false,installed=false,scale=1,zoom='auto',tvActive=false,drawPending=false,tvResize=null;
let undoStack=[];
const baseSize={heading:[760,95],text:[660,150],step:[780,124],yesno:[840,208],table:[830,280],image:[500,310],alert:[790,136],panel:[480,185],arrow:[270,55]};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const snap=v=>Math.round(v/10)*10;
const page=()=>pages[active?.size]||pages['a4-portrait'];
const editor=()=>$('docBuilder');
const root=()=>$('docCanvas');
const viewport=()=>$('docCanvasSize');
const make=(type)=>{
 const [w,h]=baseSize[type];
 return {id:uid(),type,x:70,y:80,w,h,z:1,text:({heading:'TYTUŁ DOKUMENTU',text:'Kliknij i wpisz treść…',step:'Opisz kolejny krok procedury.',alert:'WAŻNE: wpisz komunikat.',panel:'Wpisz treść.',arrow:''})[type]||'',fontSize:type==='heading'?33:type==='text'?24:type==='step'?24:22,color:'#263d52',bg:type==='alert'?'#f9e6e2':type==='panel'?'#eef4f9':'#ffffff',border:type==='panel'||type==='alert',align:'left',bold:type==='heading',tak:'Działanie po potwierdzeniu.',nie:'Działanie w przypadku odmowy.',rows:[['OBSZAR','ODPOWIEDZIALNY','MIEJSCE'],['Zespół 1','Osoba funkcyjna','Brama T4'],['Zespół 2','Koordynator','Sala konferencyjna']],src:null};
};
function defaults(){const heading=make('heading');heading.x=65;heading.y=55;heading.w=870;heading.h=100;heading.text='NOWY DOKUMENT';heading.align='center';
 const subtitle=make('text');subtitle.x=80;subtitle.y=175;subtitle.w=840;subtitle.h=66;subtitle.text='Dodaj bloki z paska po lewej i zaprojektuj własną instrukcję.';subtitle.fontSize=19;subtitle.align='center';
 return [heading,subtitle];}
const fresh=()=>({id:uid(),title:'Nowy dokument',size:'a4-portrait',blocks:defaults(),updatedAt:Date.now()});
function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
function transact(mode,work){return new Promise((resolve,reject)=>{const tr=db.transaction(STORE,mode),req=work(tr.objectStore(STORE));tr.oncomplete=()=>resolve(req?.result);tr.onerror=()=>reject(tr.error);});}
function say(msg,error=false){const n=$('docMessage');if(n){n.textContent=msg;n.dataset.error=error?'true':'false';}}
function dirty(){modified=true;const b=$('docSave');if(b)b.textContent='● Zapisz';}
function history(){if(!active)return;undoStack.push(JSON.stringify(active.blocks));if(undoStack.length>30)undoStack.shift();}
function docList(){const target=$('isaList');if(!target||!db)return;
 const old=[...target.querySelectorAll('[data-doc-page]')];
 if(old.length===items.length && old.every((n,i)=>n.dataset.docPage===items[i].id)){
  for(const n of old)n.classList.toggle('selected',!!active&&n.dataset.docPage===active.id&&!editor().hidden);
 }else{
  old.forEach(n=>n.remove());
  for(const item of items){const b=document.createElement('button');b.type='button';b.dataset.docPage=item.id;b.className='doc-list-entry';b.textContent='▦ '+item.title;b.title='Konstruktor · '+(pages[item.size]?.label||'A4');target.append(b);}
  for(const n of target.querySelectorAll('[data-doc-page]'))n.classList.toggle('selected',!!active&&n.dataset.docPage===active.id&&!editor().hidden);
 }
 const count=$('isaCount');if(count){count.textContent=String(target.querySelectorAll('button[data-id],button[data-pdf-page],button[data-doc-page]').length);}
}
function blank(){if(modified&&!confirm('Masz niezapisane zmiany. Utworzyć nowy dokument?'))return;active=fresh();chosen=null;modified=true;undoStack=[];openEditor();say('Nowa strona jest gotowa. Dodaj elementy i zapisz dokument.');}
function openStored(id){if(active?.id===id){openEditor();return;}if(modified&&!confirm('Masz niezapisane zmiany. Otworzyć inny dokument?'))return;
 const found=items.find(x=>x.id===id);if(!found)return;active=JSON.parse(JSON.stringify(found));chosen=null;modified=false;undoStack=[];openEditor();say('Dokument otwarty.');}
function openEditor(){if(!active)return;const info=$('infoSlidesArea');if(!info)return;
 info.hidden=false;$('isaTV').hidden=true;for(const node of info.querySelectorAll('#isaList button.selected:not([data-doc-page])'))node.classList.remove('selected');const pdf=$('pdfInlineViewer');if(pdf)pdf.hidden=true;
 const slideEditor=info.querySelector('.isa-editor');if(slideEditor)slideEditor.hidden=true;
 editor().hidden=false;editor().classList.remove('doc-TV');
 $('docTitle').value=active.title;$('docSize').value=active.size;$('docZoom').value=zoom;
 $('docSave').textContent=modified?'● Zapisz':'Zapisz';
 render();docList();
 // Call base tab's open handler only when switching from an unrelated tab.
 for(const id of ['norms','assign','workerArea','resultViews','upload']){const node=$(id);if(node)node.hidden=true;}
 $('assignment')?.classList.remove('active');$('results')?.classList.remove('active');$('stockTab')?.classList.remove('active');
 $('infoSlidesTab')?.classList.add('active');
 const stock=$('stockControl');if(stock)stock.hidden=true;
}
function closeEditor(){if(editor()){editor().hidden=true;editor().classList.remove('doc-TV');}const normal=$('infoSlidesArea')?.querySelector('.isa-editor');if(normal)normal.hidden=false;docList();}
function fieldMarkup(b,editable){const cls='doc-field '+(b.type==='heading'?'doc-heading':'');const txt=esc(b.text).replace(/\n/g,'<br>');
 if(b.type==='table')return `<table class="doc-table"><tbody>${(b.rows||[]).map((row,ri)=>`<tr>${row.map((v,ci)=>`<${ri?'td':'th'} data-row="${ri}" data-col="${ci}" ${editable?'contenteditable="true"':''}>${esc(v)}</${ri?'td':'th'}>`).join('')}</tr>`).join('')}</tbody></table>`;
 if(b.type==='yesno')return `<div class="doc-question">${esc(b.text||'PYTANIE / DECYZJA')}</div><div class="doc-yesno"><div><strong>TAK</strong><span>${esc(b.tak||'')}</span></div><div><strong>NIE</strong><span>${esc(b.nie||'')}</span></div></div>`;
 if(b.type==='image')return b.src?`<img src="${b.src}" alt="Zdjęcie dokumentu" draggable="false">`:'<div class="doc-image-empty">▧ Dodaj zdjęcie w panelu właściwości</div>';
 if(b.type==='arrow')return `<div class="doc-arrowline"></div>`;
 return `<div class="${cls}" ${editable?'contenteditable="true" spellcheck="true"':''}>${txt||'&nbsp;'}</div>`;
}
function buildBlock(b,editable=false){const n=document.createElement('div');n.className='doc-element doc-type-'+b.type+(editable&&b.id===chosen?' selected':'');n.dataset.blockId=b.id;
 // Native properties can be assigned normally, but CSS custom properties MUST
 // use setProperty(). Direct Object.assign(style, {'--doc-font': ...}) creates
 // an inert JS property in Chromium, so inspector changes were invisible.
 Object.assign(n.style,{left:b.x+'px',top:b.y+'px',width:b.w+'px',height:b.h+'px',zIndex:String(b.z||1)});
 n.style.setProperty('--doc-bg',b.bg||'#ffffff');
 n.style.setProperty('--doc-color',b.color||'#233b54');
 n.style.setProperty('--doc-font',(Number(b.fontSize)||22)+'px');
 n.style.setProperty('--doc-align',b.align||'left');
 n.style.setProperty('--doc-weight',b.bold?'750':'450');
 n.innerHTML=editable?`<button class="doc-move" type="button" aria-label="Przesuń element" title="Przeciągnij, aby przenieść">⠿</button><button class="doc-resize" type="button" aria-label="Zmień rozmiar" title="Przeciągnij, aby zmienić rozmiar">↘</button><div class="doc-element-content">${fieldMarkup(b,editable)}</div>`:`<div class="doc-element-content">${fieldMarkup(b,editable)}</div>`;
 n.classList.toggle('doc-framed',!!b.border);return n;}
function fit(){if(!active||editor().hidden)return;const width=page().w,height=page().h;
 const box=$('docCanvasViewport');if(!box)return;
 const auto=clamp((box.clientWidth-30)/width,.2,1.1);
 scale=zoom==='auto'?auto:Number(zoom)||auto;
 Object.assign(viewport().style,{width:(width*scale)+'px',height:(height*scale)+'px'});
 Object.assign(root().style,{width:width+'px',height:height+'px',transform:'scale('+scale+')'});
}
function render(){if(!active)return;const canvas=root();canvas.replaceChildren(...active.blocks.slice().sort((a,b)=>(a.z||0)-(b.z||0)).map(b=>buildBlock(b,true)));
 $('docSize').value=active.size;editInspector();requestAnimationFrame(fit);}
function editInspector(){const b=active?.blocks.find(x=>x.id===chosen);$('docNoSelection').hidden=!!b;$('docProperties').hidden=!b;
 if(!b)return;
 $('docBlockType').textContent=types[b.type]||b.type;
 for(const [id,val] of [['docColor',b.color],['docBackground',b.bg],['docFontSize',b.fontSize],['docAlign',b.align],['docBorder',b.border]]){$(id).value=val??'';if(id==='docBorder')$(id).checked=!!val;}
 $('docImageRow').hidden=b.type!=='image';$('docTextOptions').hidden=['table','image','arrow'].includes(b.type);
 $('docYesNoOptions').hidden=b.type!=='yesno';$('docTableOptions').hidden=b.type!=='table';
 $('docTak').value=b.tak||'';$('docNie').value=b.nie||'';
}
function activate(id){if(chosen===id)return;chosen=id;for(const n of root().querySelectorAll('.doc-element'))n.classList.toggle('selected',n.dataset.blockId===id);editInspector();}
function addType(type){if(!active)return;if(!types[type])return;
 const b=make(type);b.w=Math.min(b.w,page().w-80);b.h=Math.min(b.h,page().h-80);
 // Find unused space so adding a new block never silently covers an old one.
 let place=null;
 for(let y=50;y<=page().h-b.h-20&&!place;y+=20){
  for(let x=50;x<=page().w-b.w-20;x+=20){
   const overlap=active.blocks.some(v=>x<v.x+v.w+12&&x+b.w+12>v.x&&y<v.y+v.h+12&&y+b.h+12>v.y);
   if(!overlap){place={x,y};break;}
  }
 }
 if(!place){say('Brak miejsca na kolejny element. Zmniejsz bloki lub wybierz większy format strony.',true);return;}
 history();b.x=place.x;b.y=place.y;b.z=1+Math.max(0,...active.blocks.map(v=>v.z||1));active.blocks.push(b);chosen=b.id;dirty();render();say('Element dodany. Przeciągnij za uchwyt i dopasuj jego rozmiar.');}
function saveInput(){if(!active)return;const text=$('docTitle').value.trim().slice(0,110);if(!text){say('Podaj tytuł dokumentu.',true);$('docTitle').focus();return;}active.title=text;dirty();}
async function save(){if(!active||!db)return;saveInput();if(!active.title)return;
 active.updatedAt=Date.now();const object=JSON.parse(JSON.stringify(active));
 try{await transact('readwrite',store=>store.put(object));const i=items.findIndex(x=>x.id===object.id);if(i<0)items.push(object);else items[i]=object;
 items.sort((a,b)=>b.updatedAt-a.updatedAt);modified=false;$('docSave').textContent='Zapisz';$('tv').disabled=false;docList();say('Zapisano „'+active.title+'”. Dokument jest dostępny w Zapisane podstrony i Tryb TV.');
 }catch(e){say('Nie udało się zapisać dokumentu. Sprawdź miejsce w przeglądarce.',true);}
}
async function remove(){if(!active||!db)return;if(!confirm('Usunąć dokument „'+active.title+'”?'))return;
 try{await transact('readwrite',store=>store.delete(active.id));items=items.filter(x=>x.id!==active.id);active=null;modified=false;chosen=null;closeEditor();document.querySelector('#infoSlidesArea .isa-editor')?.removeAttribute('hidden');docList();say('Dokument usunięty.');}
 catch{say('Nie udało się usunąć dokumentu.',true);}
}
function duplicate(){if(!active)return;const a=JSON.parse(JSON.stringify(active));a.id=uid();a.title+=' (kopia)';a.updatedAt=Date.now();active=a;chosen=null;modified=true;undoStack=[];openEditor();say('Utworzono kopię. Kliknij Zapisz, aby ją zachować.');}
function uploadPhoto(file){if(!file)return;const b=active?.blocks.find(x=>x.id===chosen);if(!b||b.type!=='image')return;
 if(!file.type.startsWith('image/')||file.size>MAX_IMG){say('Wybierz obraz JPG, PNG lub WebP do 6 MB.',true);return;}
 const reader=new FileReader();reader.onload=()=>{history();b.src=reader.result;dirty();render();say('Zdjęcie dodane.');};reader.onerror=()=>say('Nie udało się wczytać zdjęcia.',true);reader.readAsDataURL(file);}
function onInspector(e){const b=active?.blocks.find(x=>x.id===chosen);if(!b)return;const id=e.target.id;
 const map={docColor:'color',docBackground:'bg',docFontSize:'fontSize',docAlign:'align',docBorder:'border',docTak:'tak',docNie:'nie'};
 if(!map[id])return;history();b[map[id]]=id==='docFontSize'?clamp(Number(e.target.value)||22,10,90):id==='docBorder'?e.target.checked:e.target.value;
 if(id==='docTak'||id==='docNie')b.text=b.text||'PYTANIE / DECYZJA';dirty();render();}
function fromContent(e){const block=e.target.closest('[data-block-id]');if(!block||!active)return;
 const b=active.blocks.find(x=>x.id===block.dataset.blockId);if(!b)return;
 if(e.target.matches('td[data-row],th[data-row]')){const r=+e.target.dataset.row,c=+e.target.dataset.col;if(b.rows[r])b.rows[r][c]=(e.target.innerText||'').slice(0,400);}
 else if(e.target.closest('.doc-field')){b.text=(e.target.closest('.doc-field').innerText||'').slice(0,3500);}
 else return;dirty();}
function dragPointer(e,mode){const block=e.target.closest('[data-block-id]'),b=active?.blocks.find(x=>x.id===block?.dataset.blockId);if(!b||e.button!==0)return;
 e.preventDefault();activate(b.id);
 history();const from={x:e.clientX,y:e.clientY,left:b.x,top:b.y,w:b.w,h:b.h};const pointer=e.pointerId;
 e.target.setPointerCapture(pointer);
 const move=ev=>{if(ev.pointerId!==pointer)return;const dx=(ev.clientX-from.x)/scale,dy=(ev.clientY-from.y)/scale;
 if(mode==='move'){b.x=clamp(snap(from.left+dx),0,page().w-b.w);b.y=clamp(snap(from.top+dy),0,page().h-b.h);}
 else{b.w=clamp(snap(from.w+dx),80,page().w-b.x);b.h=clamp(snap(from.h+dy),45,page().h-b.y);}
 block.style.left=b.x+'px';block.style.top=b.y+'px';block.style.width=b.w+'px';block.style.height=b.h+'px';dirty();};
 const end=ev=>{if(ev.pointerId!==pointer)return;e.target.removeEventListener('pointermove',move);e.target.removeEventListener('pointerup',end);e.target.removeEventListener('pointercancel',end);};
 e.target.addEventListener('pointermove',move);e.target.addEventListener('pointerup',end);e.target.addEventListener('pointercancel',end);
}
function duplicateBlock(){const b=active?.blocks.find(x=>x.id===chosen);if(!b)return;history();const c=JSON.parse(JSON.stringify(b));c.id=uid();c.x=clamp(b.x+30,0,page().w-b.w);c.y=clamp(b.y+30,0,page().h-b.h);c.z=Math.max(...active.blocks.map(x=>x.z||1))+1;active.blocks.push(c);chosen=c.id;dirty();render();}
function deleteBlock(){if(!active||!chosen)return;history();active.blocks=active.blocks.filter(x=>x.id!==chosen);chosen=null;dirty();render();}
function changeOrder(dir){const b=active?.blocks.find(x=>x.id===chosen);if(!b)return;history();b.z=dir==='front'?1+Math.max(...active.blocks.map(v=>v.z||1)):Math.min(...active.blocks.map(v=>v.z||1))-1;dirty();render();}
function addRow(){const b=active?.blocks.find(x=>x.id===chosen);if(!b||b.type!=='table'||b.rows.length>=15)return;history();b.rows.push(Array(b.rows[0].length).fill(''));dirty();render();}
function addCol(){const b=active?.blocks.find(x=>x.id===chosen);if(!b||b.type!=='table'||b.rows[0].length>=6)return;history();b.rows.forEach(row=>row.push(''));dirty();render();}
function undo(){if(!active||!undoStack.length)return;active.blocks=JSON.parse(undoStack.pop());chosen=null;dirty();render();}
// TV is a slide, not a zoomed-out sheet of A4 paper. Reflow the *view only*.
// The editor remains freeform and saved block geometry remains unmodified.
function buildResponsiveTV(sheet,saved){
 const blocks=saved.blocks.slice().sort((a,b)=>a.y-b.y||a.x-b.x||a.z-b.z);
 const titleIndex=blocks.findIndex(b=>b.type==='heading'&&b.y<260);
 const title=titleIndex<0?null:blocks.splice(titleIndex,1)[0];
 const primaryImage=blocks.findIndex(b=>b.type==='image');
 const main=document.createElement('div');main.className='doc-tv-main';
 const content=document.createElement('div');content.className='doc-tv-content';
 const count=blocks.length;
 const imageLayout=primaryImage>=0 && count<=6;
 const cols=count<=1?1:imageLayout?2:count<=2?1:count<=6?2:3;
 content.style.setProperty('--doc-tv-cols',String(cols));
 content.classList.toggle('doc-tv-with-image',imageLayout);
 if(title){
   const header=document.createElement('div');header.className='doc-tv-document-heading';
   const node=buildBlock(title,false);
   node.style.setProperty('--doc-font',Math.max(46,Math.min(68,(title.fontSize||32)*1.7))+'px');
   if((title.bg||'#ffffff').toLowerCase()==='#ffffff'&&!title.border)node.style.setProperty('--doc-bg','transparent');
   header.append(node);main.append(header);
 }
 // A photo with an announcement next to it is the most common two-column TV
 // composition. The same applies to a single text card without an image.
 if(imageLayout){
   content.style.gridTemplateColumns='minmax(0, 0.95fr) minmax(0, 1.05fr)';
   const image=blocks.splice(primaryImage,1)[0];
   const media=document.createElement('div');media.className='doc-tv-media-col';
   media.append(buildBlock(image,false));
   content.append(media);
   const side=document.createElement('div');side.className='doc-tv-text-col';
   for(const b of blocks){
     const node=buildBlock(b,false);
     configureTVBlock(node,b,count);
     side.append(node);
   }
   content.append(side);
 }else{
   for(const b of blocks){
     const node=buildBlock(b,false);
     configureTVBlock(node,b,count);
     if(cols>1&&['table','yesno'].includes(b.type))node.style.gridColumn='1 / -1';
     content.append(node);
   }
 }
 main.append(content);
 sheet.replaceChildren(main);
}
function configureTVBlock(node,b,total){
  const fontsize=b.type==='heading'?46:total<=2?38:total<=5?30:24;
  if(!['table','image','arrow'].includes(b.type)){
    node.style.setProperty('--doc-font',Math.max(fontsize,Math.min(58,Number(b.fontSize)||24))+'px');
  }
  if(['text','heading'].includes(b.type)&&!b.border&&(b.bg||'#ffffff').toLowerCase()==='#ffffff'){
    node.style.setProperty('--doc-bg','transparent');
  }
}
function tvBuild(id){const saved=items.find(x=>x.id===id);if(!saved)return;
 closeTV();const area=$('infoSlidesArea');if(!area)return;
 // Close prior Stock / PDF / KPI views, but don't call our wrapped close recursively.
 const stock=$('stockControl');if(stock){stock.hidden=true;stock.classList.remove('stk-unified-screen');}
 for(const n of ['norms','assign','workerArea','resultViews']){const el=$(n);if(el)el.hidden=true;}
 const pdf=$('pdfSlidesTV');if(pdf)pdf.hidden=true;
 document.body.classList.remove('inc-pdf-tv-screen');
 document.body.classList.add('inc-doc-tv-screen');
 area.hidden=false;$('isaTV').hidden=true;editor().hidden=true;
 area.classList.add('doc-tv-open');const stage=$('docTVScreen');stage.hidden=false;
 const p=pages[saved.size]||pages['a4-portrait'];const sheet=$('docTVPage');
 // Keep the exact authored layout only for pages explicitly designed for TV.
 // A4 has its own printable proportions, but a TV slide should use the entire
 // 16:9 screen. This is a VIEW transformation: IndexedDB data is untouched.
 sheet.classList.toggle('doc-tv-adapted', saved.size!=='tv');
 sheet.style.width=p.w+'px';sheet.style.height=p.h+'px';
 if(saved.size==='tv'){
   sheet.replaceChildren(...saved.blocks.slice().sort((a,b)=>(a.z||0)-(b.z||0)).map(b=>buildBlock(b,false)));
 }else{
   buildResponsiveTV(sheet,saved);
 }
 tvActive=true;requestAnimationFrame(()=>requestAnimationFrame(fitTV));
}
function fitTV(){if(!tvActive)return;const stage=$('docTVScreen'),paper=$('docTVPage');if(!stage||!paper)return;
 const top=stage.getBoundingClientRect().top;
 const h=clamp(Math.floor(innerHeight-top-20),250,innerHeight);stage.style.height=h+'px';
 if(paper.classList.contains('doc-tv-adapted')){
   // Real responsive canvas: no A4 letterbox, no CSS stretch and no clipping.
   paper.style.width='100%';paper.style.height='100%';paper.style.transform='none';
   return;
 }
 const box=stage.getBoundingClientRect(),s=Math.min((box.width-22)/parseFloat(paper.style.width),(h-22)/parseFloat(paper.style.height));
 paper.style.transform='translate(-50%,-50%) scale('+Math.max(.1,s)+')';
}
function closeTV(){tvActive=false;const stage=$('docTVScreen');if(stage)stage.hidden=true;$('docTVPage')?.classList.remove('doc-tv-adapted');$('infoSlidesArea')?.classList.remove('doc-tv-open');document.body.classList.remove('inc-doc-tv-screen');}
function install(){if(installed||!window.incSlides||!$('isaList')||!$('isaNew')||!$('infoSlidesArea'))return false;
 installed=true;const info=$('infoSlidesArea'),api=window.incSlides;
 const prev={list:api.list,showTV:api.showTV,close:api.close,open:api.open,restore:api.restore};
 const btn=document.createElement('button');btn.id='docAdd';btn.type='button';btn.textContent='＋ Konstruktor';btn.title='Utwórz edytowalną podstronę z bloków';
 const actions=$('isaNew').parentElement;actions.insertBefore(btn,$('isaNew'));
 btn.onclick=blank;
 const shell=info.querySelector('.isa-shell');if(!shell)return false;
 const pane=document.createElement('section');pane.id='docBuilder';pane.hidden=true;
 pane.innerHTML=`
 <div class="doc-topbar"><div class="doc-title-row"><label>Nazwa dokumentu<input id="docTitle" maxlength="110" placeholder="Nazwa podstrony"></label><label>Format<select id="docSize"><option value="a4-portrait">A4 · pion</option><option value="a4-landscape">A4 · poziom</option><option value="tv">TV · 16:9</option></select></label><label>Widok<select id="docZoom"><option value="auto">Dopasuj</option><option value="0.5">50%</option><option value="0.75">75%</option><option value="1">100%</option></select></label></div>
 <div class="doc-main-actions"><button type="button" id="docDuplicate">Kopiuj</button><button type="button" id="docRemove">Usuń</button><button class="doc-primary" type="button" id="docSave">Zapisz</button></div></div>
 <div class="doc-editor-layout"><aside class="doc-palette"><strong>Dodaj element</strong><div class="doc-palette-grid">
 ${Object.entries(types).map(([type,label])=>`<button type="button" data-doc-type="${type}"><span>${({heading:'H',text:'T',step:'①',yesno:'✓',table:'▦',image:'▧',alert:'!',panel:'▢',arrow:'➜'})[type]}</span>${label}</button>`).join('')}</div>
 <p>Przeciągaj za uchwyt ⠿. Zmieniaj rozmiar za róg ↘. Kliknij tekst, aby go edytować.</p>
 <button id="docUndo" type="button">↶ Cofnij zmianę</button></aside>
 <div class="doc-workspace" id="docCanvasViewport"><div id="docCanvasSize"><div id="docCanvas"></div></div></div>
 <aside class="doc-inspector"><strong>Właściwości bloku</strong><div id="docNoSelection" class="doc-help">Zaznacz element na stronie, aby zmienić jego wygląd.</div>
 <div id="docProperties" hidden><h3 id="docBlockType"></h3><label>Rozmiar tekstu<input id="docFontSize" type="number" min="10" max="90" step="1"></label><label>Kolor tekstu<input id="docColor" type="color"></label><label>Kolor tła<input id="docBackground" type="color"></label><label>Wyrównanie<select id="docAlign"><option value="left">Do lewej</option><option value="center">Wyśrodkuj</option><option value="right">Do prawej</option></select></label><label class="doc-inline">Ramka <input id="docBorder" type="checkbox"></label>
 <div id="docTextOptions"><small>Tekst zmieniasz bezpośrednio w bloku.</small></div><div id="docYesNoOptions" hidden><label>TAK<textarea id="docTak" rows="3"></textarea></label><label>NIE<textarea id="docNie" rows="3"></textarea></label></div>
 <div id="docTableOptions" hidden><button id="docAddRow" type="button">＋ Wiersz</button><button id="docAddCol" type="button">＋ Kolumna</button></div>
 <div id="docImageRow" hidden><label class="doc-file-label">Wybierz zdjęcie<input id="docImageFile" type="file" accept="image/jpeg,image/png,image/webp" hidden></label></div>
 <div class="doc-element-actions"><button type="button" id="docFront">Na wierzch</button><button type="button" id="docBack">Pod spód</button><button type="button" id="docCloneBlock">Kopiuj blok</button><button type="button" id="docDeleteBlock">Usuń blok</button></div></div></aside></div>
 <p id="docMessage" class="doc-message" role="status" aria-live="polite"></p>`;
 shell.append(pane);
 const tv=document.createElement('div');tv.id='docTVScreen';tv.hidden=true;tv.innerHTML='<div id="docTVPage"></div>';info.append(tv);
 const link=document.createElement('link');link.rel='stylesheet';link.href='doc-builder.css';document.head.append(link);
 info.querySelector('#isaList').addEventListener('click',e=>{
 const b=e.target.closest('button[data-doc-page]');
 if(b){e.preventDefault();e.stopImmediatePropagation();openStored(b.dataset.docPage);}
 else if(e.target.closest('button[data-id],button[data-pdf-page]'))closeEditor();
 },true);
 $('isaNew').addEventListener('click',closeEditor,true);
 $('pdfSlidesAdd')?.addEventListener('click',closeEditor,true);
 $('docBuilder').addEventListener('click',e=>{
 const type=e.target.closest('[data-doc-type]')?.dataset.docType;if(type){addType(type);return;}
 const block=e.target.closest('[data-block-id]');if(block)activate(block.dataset.blockId);
 });
 $('docCanvas').addEventListener('input',fromContent);
 $('docCanvas').addEventListener('pointerdown',e=>{if(e.target.closest('.doc-move'))dragPointer(e,'move');else if(e.target.closest('.doc-resize'))dragPointer(e,'resize');});
 for(const id of ['docColor','docBackground','docFontSize','docAlign','docBorder','docTak','docNie'])$(id).addEventListener('change',onInspector);
 $('docTitle').addEventListener('change',saveInput);
 $('docSize').addEventListener('change',e=>{if(!active)return;
 const next=pages[e.target.value];if(!next){e.target.value=active.size;return;}
 // Never silently overlap or crop safety instructions during page-format conversion.
 if(active.blocks.some(b=>b.x+b.w>next.w||b.y+b.h>next.h)){
   e.target.value=active.size;
   say('Nie można zmniejszyć strony: część bloków nie zmieści się. Przesuń lub zmniejsz je przed zmianą formatu.',true);
   return;
 }
 active.size=e.target.value;dirty();render();});
 $('docZoom').addEventListener('change',e=>{zoom=e.target.value;fit();});
 $('docSave').onclick=save;$('docRemove').onclick=remove;$('docDuplicate').onclick=duplicate;
 $('docCloneBlock').onclick=duplicateBlock;$('docDeleteBlock').onclick=deleteBlock;$('docFront').onclick=()=>changeOrder('front');$('docBack').onclick=()=>changeOrder('back');
 $('docAddRow').onclick=addRow;$('docAddCol').onclick=addCol;$('docUndo').onclick=undo;
 $('docImageFile').addEventListener('change',e=>{uploadPhoto(e.target.files?.[0]);e.target.value='';});
 window.addEventListener('resize',()=>{fit();if(tvActive)fitTV();});
 const list=$('isaList');const observer=new MutationObserver(()=>docList());observer.observe(list,{childList:true});
 // Integrate with the existing unified TV provider, preserving previous wrappers.
 api.list=()=>[...prev.list(),...items.map(x=>({id:'info:doc:'+x.id,name:'Dokument · '+x.title,description:'Konstruktor · '+pages[x.size]?.label,available:true}))];
 api.showTV=(id)=>{if(id.startsWith('doc:')){prev.close();tvBuild(id.slice(4));}else{closeTV();prev.showTV(id);}};
 api.close=()=>{closeTV();prev.close();};
 api.open=()=>{closeTV();prev.open();if(items.length)$('tv').disabled=false;};
 api.restore=()=>{closeTV();prev.restore();if(active){openEditor();}if(items.length)$('tv').disabled=false;};
 $('infoSlidesTab')?.addEventListener('click',()=>{closeEditor();if(items.length)$('tv').disabled=false;});
 // TV page may be resized after fullscreen activates.
 document.addEventListener('fullscreenchange',()=>requestAnimationFrame(fitTV));
 docList();return true;
}
let retry=0;const timer=setInterval(()=>{if(install()||++retry>200)clearInterval(timer);},50);
database().then(async conn=>{db=conn;items=await transact('readonly',s=>s.getAll());items.sort((a,b)=>b.updatedAt-a.updatedAt);docList();}).catch(err=>console.warn('INCYDENTY: Konstruktor storage unavailable',err));
})();
