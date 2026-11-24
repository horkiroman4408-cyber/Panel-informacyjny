'use strict';
/* INCYDENTY · STOCK CONTROL. 3 native Power BI Excel exports; isolated module. */
(()=>{
 const el=id=>document.getElementById(id);
 const html=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const name=x=>String(x??'').trim().toUpperCase().replace(/\s+/g,' ');
 const number=x=>{if(x==null||x==='')return 0;if(typeof x==='number')return x;const v=Number(String(x).trim().replace(/\s/g,'').replace(',','.'));return Number.isFinite(v)?v:NaN};
 const fmt=(x,d=0)=>Number(x||0).toLocaleString('pl-PL',{minimumFractionDigits:d,maximumFractionDigits:d});
 const valid=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
 // Exports Power BI can include a descriptive filter row, not an RS1 system.
 const isRS1Metadata=value=>/^(?:ZASTOSOWANE\s+FILTRY|APPLIED\s+FILTERS|ПРИМЕНЕННЫЕ\s+ФИЛЬТРЫ)\b/i.test(String(value??'').trim());
 const STORE='incydenty-stock-powerbi-v2';
 let datasets={shelves:null,units:null,rs1:null},selected=new Set(),originStockTV=false,tvBrandScope=null;
 try{const obj=JSON.parse(localStorage.getItem(STORE));if(obj&&typeof obj==='object'){for(const k of Object.keys(datasets)){if(obj.datasets?.[k]&&Array.isArray(obj.datasets[k].rows))datasets[k]=obj.datasets[k];}if(Array.isArray(obj.selected))selected=new Set(obj.selected)}}catch{}
 if(!document.querySelector('.tabs')||el('stockTab'))return;
 const nav=document.querySelector('.tabs'),tab=document.createElement('button');tab.id='stockTab';tab.type='button';tab.textContent='STOCK CONTROL';nav.append(tab);
 const section=document.createElement('section');section.id='stockControl';section.hidden=true;section.innerHTML=`
 <div class="stk-heading"><div class="stk-heading-title"><span class="stk-eyebrow">INCYDENTY · WIDOK MAGAZYNOWY</span><h2>STOCK CONTROL</h2><p>Stan półek, jednostki i RS1 na podstawie eksportów Power BI</p></div><div class="stk-actions"><div class="stk-actionbuttons"><button type="button" id="stkChoose">↥ Wczytaj 3 pliki Excel</button><input id="stkFiles" type="file" accept=".xlsx" multiple hidden><button id="stkDelete" type="button" title="Usuń tylko dane STOCK CONTROL">Wyczyść</button></div><div class="stk-sources" id="stkSources"></div></div></div>
 <div class="stk-alert" id="stkAlert" role="status" aria-live="polite"></div>
 <div class="stk-brandnav" id="stkBrands"></div>
 <div class="stk-kpis" id="stkKpis"></div>
 <div class="stk-layout"><article class="stk-card stk-wide"><div class="stk-cardtop"><h3>ALL SHELVES</h3><span>Liczba półek według typu lokalizacji</span></div><div class="stk-scroller" id="stkShelves"></div></article>
 <article class="stk-card stk-wide"><div class="stk-cardtop"><h3>NO OF UNITS · STOCKING / TO BE STOCKED</h3><span>Jednostki w lokalizacjach</span></div><div class="stk-scroller" id="stkUnits"></div></article>
 <article class="stk-card"><div class="stk-cardtop"><h3>MP STOCK BY BRAND</h3></div><div class="stk-scroller" id="stkByBrand"></div></article>
 <article class="stk-card"><div class="stk-cardtop"><h3>RS1 STOCK</h3></div><div class="stk-scroller" id="stkRS1"></div></article>
 <article class="stk-card"><div class="stk-cardtop"><h3>AVG UNITS IN SHELVES GLOBALLY</h3></div><div class="stk-bigmetric" id="stkAvg">—</div><div class="stk-note">Średnia ważona liczbą półek z eksportu</div></article></div><div class="stk-footer">Dane są lokalne w tej przeglądarce. Import nie aktualizuje danych w Power BI. Procenty przedstawiają wartości z eksportu (0–100).</div>`;
 document.querySelector('.shell').append(section);
 const css=document.createElement('link');css.rel='stylesheet';css.href='stock-control.css';document.head.append(css);
 const key=(b,l)=>name(b)+'\u0000'+name(l);
 const groups=()=>{const names=new Set();for(const t of ['shelves','units'])for(const r of datasets[t]?.rows||[])names.add(r.brand);return [...names].sort((a,b)=>['SINSAY','RESERVED','MOHITO','CROPP','HOUSE','RTS'].indexOf(a)-['SINSAY','RESERVED','MOHITO','CROPP','HOUSE','RTS'].indexOf(b)||a.localeCompare(b))};
 const filtered=rows=>(rows||[]).filter(x=>tvBrandScope!==null?(tvBrandScope==='*'||x.brand===tvBrandScope):(!selected.size||selected.has(x.brand)));
 function fail(s){el('stkAlert').textContent=s;el('stkAlert').hidden=!s}
 // Colour scale matches Power BI example. Lower FULL is greener,
 // while EMPTY uses the same colour determined from its complementary FULL value.
 function tint(pct,kind){
  const fullness=kind==='empty'?100-pct:pct;
  if(fullness>=90)return 'stk-red';
  if(fullness>=75)return 'stk-orange';
  if(fullness>=68)return 'stk-yellow';
  if(fullness>=50)return 'stk-olive';
  return 'stk-green';
 }
 function table(heads,rows,footer){
  if(!rows.length)return '<div class="stk-empty">Brak danych dla wybranych marek. Wczytaj odpowiedni plik Export lub zmień filtr.</div>';
  const th=heads.map(h=>`<th>${html(h)}</th>`).join('');
  const tr=rows.map(row=>'<tr>'+row.map(cell=>{
   const obj=typeof cell==='object'&&cell!==null?cell:{value:cell};
   const cl=obj.pct?' class="stk-percent '+tint(obj.value,obj.kind)+'"':obj.text?' class="stk-text"':'';
   return `<td${cl}>${html(typeof obj.value==='number'?fmt(obj.value,obj.dec??0):obj.value??'—')}</td>`;
  }).join('')+'</tr>').join('');
  const foot=footer?'<tfoot><tr>'+footer.map(x=>`<td>${html(typeof x==='number'?fmt(x):x)}</td>`).join('')+'</tr></tfoot>':'';
  return `<table class="stk-table"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody>${foot}</table>`;
 }
 const P=(x,kind='full')=>({value:x,pct:true,kind,dec:2});
 function sum(rows,k){return rows.reduce((s,r)=>s+(r[k]||0),0)}
 function render(){const br=groups();for(const b of [...selected])if(!br.includes(b))selected.delete(b);
 el('stkBrands').innerHTML=`<button type="button" data-brand="*" class="${selected.size?'':'active'}">Wszystkie marki</button>`+br.map(b=>`<button type="button" data-brand="${html(b)}" class="${selected.has(b)?'active':''}">${html(b)}</button>`).join('');
 const labels={shelves:'ALL SHELVES',units:'NO OF UNITS',rs1:'RS1 STOCK'};el('stkSources').innerHTML=Object.entries(labels).map(([k,label])=>`<div class="stk-source ${datasets[k]?'loaded':''}"><span>${datasets[k]?'✓':'○'} ${label}</span><strong>${html(datasets[k]?.file||'Nie wczytano')}</strong></div>`).join('');
 const s=filtered(datasets.shelves?.rows),u=filtered(datasets.units?.rows);
 const all=sum(s,'all'),full=sum(s,'full'),empty=sum(s,'empty'),stock=sum(u,'stock'),todo=sum(u,'todo');
 const kpis=[['Wszystkie półki',all,!!datasets.shelves],['Z towarem',full,!!datasets.shelves],['Puste półki',empty,!!datasets.shelves],['% zapełnienia',all?full/all*100:0,!!datasets.shelves,true],['MP STOCKING',stock,!!datasets.units],['DO ROZŁOŻENIA',todo,!!datasets.units]];
 el('stkKpis').innerHTML=kpis.map(([label,v,has,percent])=>`<div class="stk-kpi"><span>${label}</span><strong>${has?(fmt(v,percent?2:0)+(percent?'%':'')):'—'}</strong></div>`).join('');
 el('stkShelves').innerHTML=table(['BRAND','LOCATION TYPE','MP1','MP2','MP3','ALL SHELVES','AVG UNITS','TOTAL UNITS','MP1','MP2','MP3','WITH STOCK','% FULL','MP1','MP2','MP3','EMPTY','% EMPTY'],s.map(r=>[r.brand,r.loc,...r.a,r.all,{value:r.avg,dec:2},{value:r.totalUnits,dec:2},...r.f,r.full,P(r.fullPct),...r.e,r.empty,P(r.emptyPct,'empty')]),['Suma','',...['','',''],all,'','',...['','',''],full,all?fmt(full/all*100,2)+'%':'—',...['','',''],empty,all?fmt(empty/all*100,2)+'%':'—']);
 el('stkUnits').innerHTML=table(['BRAND','LOCATION TYPE','MP1','MP2','MP3','MP STOCKING','% FULL','MP1','MP2','MP3','TO BE STOCKED','% EMPTY'],u.map(r=>[r.brand,r.loc,...r.a,r.stock,P(r.fullPct),...r.b,r.todo,P(r.emptyPct,'empty')]),['Suma','',...['','',''],stock,'',...['','',''],todo,'']);
 const per=new Map();for(const r of u){const item=per.get(r.brand)||{brand:r.brand,stock:0,todo:0};item.stock+=r.stock;item.todo+=r.todo;per.set(r.brand,item)}el('stkByBrand').innerHTML=table(['BRAND','MP STOCKING','TO BE STOCKED'],[...per.values()].map(r=>[r.brand,r.stock,r.todo]),['Suma',stock,todo]);
 const rs=(datasets.rs1?.rows||[]).filter(r=>!isRS1Metadata(r.system));el('stkRS1').innerHTML=table(['SYSTEM','NO OF ITEMS','NO OF TSUS','AVG NO OF ITEMS'],rs.map(r=>[r.system,r.items,r.tsus,{value:r.avg,dec:2}]),['Suma',sum(rs,'items'),sum(rs,'tsus'),'']);
 const weighted=s.reduce((acc,r)=>acc+r.avg*r.all,0);el('stkAvg').textContent=s.length&&all>0?fmt(weighted/all,2):'—';
 }
 function readRows(rows,kind,file){if(!Array.isArray(rows)||!rows.length)throw Error('Pusty arkusz Export');const h=(rows[0]||[]).map(name);const at=(x,start=0)=>h.findIndex((v,i)=>i>=start&&v===x);let parsed=[];
 if(kind==='shelves'){
  if(h[0]!=='BRAND (LOC SUBAREA)'||h[1]!=='LOCATION TYPE'||h[5]!=='MP1+MP2+MP3'||h[12]!=='% OF FULNESS'||h[17]!=='% OF EMPTY')throw Error('Niewłaściwa struktura data (1): wymagane kolumny ALL SHELVES');
  parsed=rows.slice(1).filter(r=>r[0]&&r[1]&&!['TOTAL','SUMA'].includes(name(r[0]))).map(r=>({brand:name(r[0]),loc:String(r[1]).trim(),a:[2,3,4].map(i=>number(r[i])),all:number(r[5]),avg:number(r[6]),totalUnits:number(r[7]),f:[8,9,10].map(i=>number(r[i])),full:number(r[11]),fullPct:number(r[12]),e:[13,14,15].map(i=>number(r[i])),empty:number(r[16]),emptyPct:number(r[17])}));
 }else if(kind==='units'){
  if(h[0]!=='BRAND (LOC SUBAREA)'||h[1]!=='LOCATION TYPE'||h[5]!=='MP STOCKING'||h[10]!=='MP TO BE STOCKED')throw Error('Niewłaściwa struktura data (2): wymagane MP STOCKING / MP TO BE STOCKED');
  parsed=rows.slice(1).filter(r=>r[0]&&r[1]&&!['TOTAL','SUMA'].includes(name(r[0]))).map(r=>({brand:name(r[0]),loc:String(r[1]).trim(),a:[2,3,4].map(i=>number(r[i])),stock:number(r[5]),fullPct:number(r[6]),b:[7,8,9].map(i=>number(r[i])),todo:number(r[10]),emptyPct:number(r[11])}));
 }else{
  if(h[0]!=='SYSTEM'||h[1]!=='NO OF ITEMS'||h[2]!=='NO OF TSUS'||h[3]!=='AVG NO OF ITEMS')throw Error('Niewłaściwa struktura RS1 STOCK');
  parsed=rows.slice(1).filter(r=>r[0]&&!['TOTAL','SUMA'].includes(name(r[0]))&&!isRS1Metadata(r[0])).map(r=>({system:name(r[0]),items:number(r[1]),tsus:number(r[2]),avg:number(r[3])}));
 }
 if(!parsed.length)throw Error('Nie znaleziono wierszy danych');if(parsed.length>5000)throw Error('Za dużo wierszy: limit 5000');
 for(const r of parsed)for(const value of Object.values(r))if(typeof value==='number'&&!valid(value)||Array.isArray(value)&&!value.every(valid))throw Error('Nieprawidłowa liczba w '+file);
 return {file,rows:parsed};
 }
 function identify(rows){const h=(rows[0]||[]).map(name);if(h[0]==='SYSTEM'&&h.includes('NO OF ITEMS'))return'rs1';if(h[0]==='BRAND (LOC SUBAREA)'&&h.includes('MP STOCKING'))return'units';if(h[0]==='BRAND (LOC SUBAREA)'&&h.includes('AVG UNITS'))return'shelves';return null}
 function persist(){try{localStorage.setItem(STORE,JSON.stringify({datasets,selected:[...selected]}));return true}catch{return false}}
 async function ingest(files){if(!files.length)return;let successful=[],failed=[];let pending={...datasets};for(const file of files){try{if(!/\.xlsx$/i.test(file.name))throw Error('Tylko .xlsx');if(file.size>10_000_000)throw Error('Plik powyżej 10 MB');const rows=await xlsxRows(await file.arrayBuffer(),'Export');const kind=identify(rows);if(!kind)throw Error('Nieznany format Export');pending[kind]=readRows(rows,kind,file.name);successful.push(file.name+' → '+kind)}catch(e){failed.push(file.name+': '+e.message)}}
 datasets=pending;selected.clear();const saved=persist();render();fail(`${successful.length?'Wczytano: '+successful.join(' · ')+'. ':''}${failed.length?'Błędy: '+failed.join(' · ')+'. ':''}${saved?'':'Dane wyświetlono, ale nie udało się ich zapisać w przeglądarce.'}`)}
 // Tab switching is exclusive. infoSlidesTab is created asynchronously.
 function open(){
  if(window.incSlides?.isOpen())window.incSlides.close();
  section.hidden=false;
  section.classList.remove('stk-unified-screen');
  tab.classList.add('active');
  for(const id of ['norms','assign','workerArea','resultViews','infoSlidesArea'])if(el(id))el(id).hidden=true;
  for(const id of ['results','assignment','infoSlidesTab'])el(id)?.classList.remove('active');
  el('upload').hidden=true;el('settings').hidden=false;el('tv').hidden=false;el('tv').disabled=false;
  render();
 }
 function close(){
  tvBrandScope=null;
  section.hidden=true;
  section.classList.remove('stk-unified-screen');
  tab.classList.remove('active');
  el('upload').hidden=false;el('settings').hidden=false;el('tv').hidden=false;
 }
 tab.addEventListener('click',open);
 // Capture before dynamically registered click handlers on all main navigation buttons.
 document.addEventListener('click',event=>{
  const target=event.target.closest?.('#assignment,#results,#infoSlidesTab');
  if(target)close();
 },true);
 // Extend the existing unified TV list only after the information module is ready.
 // That module is inserted via an asynchronous script in workers.js.
 function registerTVBridge(){
  const slides=window.incSlides;
  if(!slides)return false;
  if(slides.__stockControlBridge)return true;
  const original={list:slides.list,close:slides.close,showTV:slides.showTV,restore:slides.restore,isOpen:slides.isOpen};
  slides.__stockControlBridge=true;
  slides.list=()=>[
   ...original.list(),
   {id:'info:stock-control:all',name:'STOCK CONTROL · Wszystkie marki',description:'Wszystkie marki · półki, jednostki i RS1',available:!!(datasets.shelves||datasets.units||datasets.rs1)},
   ...groups().map(brand=>({id:'info:stock-control:brand:'+brand,name:'STOCK CONTROL · '+brand,description:'Dane tylko dla marki '+brand,available:true}))
  ];
  slides.isOpen=()=>!section.hidden||original.isOpen();
  slides.close=()=>{close();original.close();};
  slides.showTV=id=>{
   if(id!=='stock-control'&&id!=='stock-control:all'&&!id.startsWith('stock-control:brand:')){close();return original.showTV(id);}
   // Select brand for this TV screen only, without changing saved edit filters.
   tvBrandScope=id.startsWith('stock-control:brand:')?id.slice('stock-control:brand:'.length):'*';
   original.close();
   section.hidden=false;section.classList.add('stk-unified-screen');
   for(const k of ['norms','assign','workerArea','resultViews','infoSlidesArea'])if(el(k))el(k).hidden=true;
   el('infoSlidesTab')?.classList.remove('active');
   el('upload').hidden=true;el('settings').hidden=true;
   render();
  };
  slides.restore=()=>{
   if(originStockTV){originStockTV=false;open();}
   else{close();original.restore();}
  };
  return true;
 }
 // Existing TV controller reads slide list when the settings dialog is opened.
 // One ready event plus a bounded retry covers both cached and fresh script loads.
 if(!registerTVBridge()){
  let attempts=0;
  const check=setInterval(()=>{if(registerTVBridge()||++attempts>200)clearInterval(check)},50);
 }
 el('stkChoose').onclick=()=>el('stkFiles').click();el('stkFiles').onchange=e=>{ingest([...e.target.files]);e.target.value=''};
 el('stkBrands').onclick=e=>{const b=e.target.closest('button[data-brand]')?.dataset.brand;if(!b)return;if(b==='*')selected.clear();else if(selected.has(b))selected.delete(b);else selected.add(b);persist();render()};
 el('tv').addEventListener('click',()=>{originStockTV=!section.hidden},true);
 // Unified controller owns fullscreen, slide timing, and exit behaviour.

 el('stkDelete').onclick=()=>{if(!confirm('Usunąć wyłącznie lokalne dane STOCK CONTROL?'))return;datasets={shelves:null,units:null,rs1:null};selected.clear();localStorage.removeItem(STORE);render();fail('Usunięto dane STOCK CONTROL.');};
 render();
})();
