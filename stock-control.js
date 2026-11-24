'use strict';
/* INCYDENTY · STOCK CONTROL. Independent module, no changes to KPI calculations. */
(()=>{
 const $=id=>document.getElementById(id), E=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const key='incydenty-stock-control-v1';
 const brands=['SINSAY','RESERVED','MOHITO','CROPP','HOUSE','RTS'];
 let records=[],source='',chosen=new Set(),isTV=false;
 try {const value=JSON.parse(localStorage.getItem(key));if(Array.isArray(value?.rows)&&value.rows.length<=10000){records=value.rows;source=String(value.source||'')}}catch{}
 const nav=document.querySelector('.tabs');if(!nav)return;
 const tab=document.createElement('button');tab.id='stockTab';tab.textContent='STOCK CONTROL';tab.type='button';nav.append(tab);
 const area=document.createElement('section');area.id='stockControl';area.hidden=true;
 area.innerHTML=`<div class="stk-top"><div><span class="stk-kicker">INCYDENTY · POWER BI EXPORT</span><h2>STOCK CONTROL</h2><p>Stan regałów i jednostek · dane z pliku Excel</p></div><div class="stk-actions"><button type="button" id="stkImport">↥ Wczytaj Excel</button><input id="stkFile" type="file" accept=".xlsx" hidden><button type="button" id="stkReset">Wyczyść dane</button><button type="button" id="stkTv">▣ Tryb TV</button></div></div><div id="stkMessage" role="status" class="stk-message"></div><div class="stk-brands" id="stkBrands"></div><div class="stk-stats" id="stkStats"></div><div class="stk-grid"><article class="stk-panel"><h3>ALL SHELVES</h3><div id="stkAll" class="stk-table-wrap"></div></article><article class="stk-panel"><h3>NO OF SHELVES WITH STOCK</h3><div id="stkFull" class="stk-table-wrap"></div></article><article class="stk-panel"><h3>NO OF EMPTY SHELVES</h3><div id="stkEmpty" class="stk-table-wrap"></div></article><article class="stk-panel"><h3>MP STOCK BY BRAND</h3><div id="stkBrand" class="stk-table-wrap"></div></article><article class="stk-panel"><h3>NO OF UNITS · STOCKING</h3><div id="stkStocking" class="stk-table-wrap"></div></article><article class="stk-panel"><h3>NO OF UNITS TO BE STOCKED</h3><div id="stkToStock" class="stk-table-wrap"></div></article></div><div class="stk-foot"><span id="stkSource"></span><span>Źródło: ręczny import Excel · aktualizacja danych Power BI nie jest automatyczna</span></div>`;
 document.querySelector('.shell').append(area);
 const style=document.createElement('link');style.rel='stylesheet';style.href='stock-control.css';document.head.append(style);
 const n=v=>Number.isFinite(Number(v))?Number(v):0;
 const fmt=(x,d=0)=>Number(x||0).toLocaleString('pl-PL',{maximumFractionDigits:d});
 const norm=x=>String(x??'').trim().toUpperCase().replace(/\s+/g,' ');
 const num=x=>typeof x==='number'?x:Number(String(x??'').trim().replace(/\s/g,'').replace(',','.'));
 const alias={brand:['BRAND','BRAND (LOC SUBAREA)','MARKA'],loc:['LOCATION TYPE','LOCATION TYPE ','TYP LOKALIZACJI'],shelves:['ALL SHELVES','SHELVES','MP1+MP2+MP3','TOTAL SHELVES','MP'],full:['SHELVES WITH STOCK','NO OF SHELVES WITH STOCK','FULL SHELVES','ZAPEŁNIONE'],empty:['EMPTY SHELVES','NO OF EMPTY SHELVES','PUSTE'],stocking:['NO OF UNITS - STOCKING','UNITS STOCKING','MP STOCKING','STOCKING UNITS','TOTAL UNITS'],toStock:['NO OF UNITS TO BE STOCKED','UNITS TO BE STOCKED','MP TO BE STOCKED'],rsItems:['RS1 ITEMS','NO OF ITEMS'],rsTsus:['RS1 TSUS','NO OF TSUS']};
 const sum=(rs,col)=>rs.reduce((a,r)=>a+n(r[col]),0);
 function buildTable(items,cols){if(!items.length)return '<div class="stk-none">Brak danych dla wybranych filtrów.</div>';
 const head=cols.map(([k,label])=>`<th>${E(label)}</th>`).join(''); const body=items.map(r=>`<tr>${cols.map(([k])=>`<td>${k==='brand'||k==='loc'?E(r[k]):fmt(r[k])}</td>`).join('')}</tr>`).join('');return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;}
 function aggregated(){const groups=new Map();for(const r of records){if(chosen.size&&!chosen.has(r.brand))continue;const id=r.brand+'|'+r.loc;let g=groups.get(id);if(!g){g={brand:r.brand,loc:r.loc,shelves:0,full:0,empty:0,stocking:0,toStock:0,rsItems:0,rsTsus:0};groups.set(id,g)}for(const k of ['shelves','full','empty','stocking','toStock','rsItems','rsTsus'])g[k]+=n(r[k]);}return [...groups.values()].sort((a,b)=>a.brand.localeCompare(b.brand)||a.loc.localeCompare(b.loc));}
 function render(){const rs=aggregated(),shelves=sum(rs,'shelves'),full=sum(rs,'full'),empty=sum(rs,'empty'),stocking=sum(rs,'stocking'),toStock=sum(rs,'toStock');
 const exists=[...new Set(records.map(r=>r.brand))].sort();$('stkBrands').innerHTML=`<button class="${chosen.size?'':'on'}" data-brand="*">Wszystkie marki</button>`+exists.map(x=>`<button class="${chosen.has(x)?'on':''}" data-brand="${E(x)}">${E(x)}</button>`).join('');
 const cards=[['Wszystkie półki',shelves],['Z towarem',full],['Puste półki',empty],['Zapełnienie',shelves?fmt(full/shelves*100,1)+'%':'—'],['Jednostki · stocking',stocking],['Do rozłożenia',toStock]];
 $('stkStats').innerHTML=cards.map(([k,v])=>`<div class="stk-stat"><span>${E(k)}</span><strong>${typeof v==='number'?fmt(v):E(v)}</strong></div>`).join('');
 const base=[['brand','BRAND'],['loc','LOCATION TYPE']];
 $('stkAll').innerHTML=buildTable(rs,[...base,['shelves','SHELVES']]);$('stkFull').innerHTML=buildTable(rs,[...base,['full','WITH STOCK']]);$('stkEmpty').innerHTML=buildTable(rs,[...base,['empty','EMPTY']]);$('stkStocking').innerHTML=buildTable(rs,[...base,['stocking','UNITS STOCKING']]);$('stkToStock').innerHTML=buildTable(rs,[...base,['toStock','UNITS TO BE STOCKED']]);
 const byBrand=new Map();for(const r of rs){let x=byBrand.get(r.brand)||{brand:r.brand,loc:'',stocking:0,shelves:0};x.stocking+=r.stocking;x.shelves+=r.shelves;byBrand.set(r.brand,x)}$('stkBrand').innerHTML=buildTable([...byBrand.values()],[['brand','BRAND'],['stocking','NO OF ITEMS']]);
 $('stkSource').textContent=source?`Plik: ${source} · ${fmt(records.length)} wierszy`:'Nie wczytano danych';
 $('stkMessage').textContent=records.length?'':'Wczytaj testowy wzór STOCK_CONTROL.xlsx, aby rozpocząć.';
 }
 function parseRows(rows){let start=-1,mapping={};for(let i=0;i<Math.min(rows.length,35);i++){const cells=rows[i].map(norm);let map={};for(const [name,possible] of Object.entries(alias)){const idx=cells.findIndex(v=>possible.includes(v));if(idx>=0)map[name]=idx;}if(map.brand!==undefined&&map.loc!==undefined&&map.shelves!==undefined&&Object.keys(map).length>=4){start=i;mapping=map;break;}}
 if(start<0)throw Error('Nie rozpoznano kolumn. Wymagane: BRAND, LOCATION TYPE, SHELVES oraz co najmniej jedna kolumna liczbowa. Użyj załączonego wzoru.');
 const data=[];for(let i=start+1;i<rows.length;i++){let row=rows[i],brand=norm(row[mapping.brand]),loc=String(row[mapping.loc]??'').trim();if(!brand||!loc||/^(SUMA|TOTAL|RAZEM)$/i.test(brand))continue;
 const r={brand,loc};for(const k of ['shelves','full','empty','stocking','toStock','rsItems','rsTsus']){const value=mapping[k]===undefined?0:num(row[mapping[k]]);if(!Number.isFinite(value)||value<0)throw Error('Nieprawidłowa liczba w wierszu '+(i+1)+': '+k);r[k]=value;}
 if(mapping.full===undefined&&mapping.empty!==undefined)r.full=Math.max(0,r.shelves-r.empty);if(mapping.empty===undefined&&mapping.full!==undefined)r.empty=Math.max(0,r.shelves-r.full);
 data.push(r);if(data.length>10000)throw Error('Limit: 10 000 wierszy');}
 if(!data.length)throw Error('Plik nie zawiera danych.');return data;}
 async function importFile(file){if(!file)return;if(file.size>10_000_000){$('stkMessage').textContent='Plik przekracza 10 MB.';return;}try{const buf=await file.arrayBuffer();let rows,errors=[];for(const sheet of ['STOCK','STOCK CONTROL','Sheet1','Arkusz1','Dane','Data','RAPORT']){try{rows=await xlsxRows(buf,sheet);break}catch(e){errors.push(e.message);if(!/Brak arkusza/.test(e.message))throw e}}
 if(!rows)throw Error('Brak obsługiwanego arkusza STOCK / Sheet1 / Arkusz1 / Dane / Data / RAPORT.');const parsed=parseRows(rows);records=parsed;source=file.name;chosen.clear();try{localStorage.setItem(key,JSON.stringify({rows:records,source}))}catch(e){$('stkMessage').textContent='Zaimportowano, ale brak miejsca na zapis lokalny.'}render();$('stkMessage').textContent=`Wczytano ${parsed.length} wierszy z ${file.name}.`;}
 catch(e){$('stkMessage').textContent='Nie wczytano pliku: '+e.message}}
 function show(){area.hidden=false;tab.classList.add('active');for(const el of ['norms','assign','workerArea','resultViews','infoSlidesArea']){const node=$(el);if(node)node.hidden=true}for(const id of ['results','assignment','infoSlidesTab'])$(id)?.classList.remove('active');$('upload').hidden=true;$('settings').hidden=true;$('tv').hidden=true;render()}
 function hide(){if(area.hidden)return;area.hidden=true;tab.classList.remove('active');if(document.activeElement?.id==='results')$('resultViews').hidden=false;$('upload').hidden=false;$('settings').hidden=false;$('tv').hidden=false;if(isTV)stopTV()}
 function startTV(){isTV=true;area.classList.add('stock-tv');document.body.classList.add('stock-tv-active');$('stkTv').textContent='✕ Wyjdź z TV';area.requestFullscreen?.().catch(()=>{});}
 function stopTV(){isTV=false;area.classList.remove('stock-tv');document.body.classList.remove('stock-tv-active');$('stkTv').textContent='▣ Tryb TV';if(document.fullscreenElement===area)document.exitFullscreen?.().catch(()=>{})}
 tab.addEventListener('click',show);
 for(const id of ['results','assignment','infoSlidesTab'])$(id)?.addEventListener('click',()=>{hide();if(id==='results')$('resultViews').hidden=false},true);
 document.addEventListener('click',e=>{if(!area.hidden&&e.target.closest?.('#back'))hide()});
 $('stkImport').onclick=()=>$('stkFile').click();$('stkFile').onchange=e=>{importFile(e.target.files[0]);e.target.value=''};
 $('stkReset').onclick=()=>{if(!confirm('Usunąć zaimportowane dane STOCK CONTROL z tej przeglądarki?'))return;records=[];source='';chosen.clear();localStorage.removeItem(key);render()};
 $('stkTv').onclick=()=>isTV?stopTV():startTV();
 $('stkBrands').onclick=e=>{const target=e.target.closest('button[data-brand]');if(!target)return;const b=target.dataset.brand;if(b==='*')chosen.clear();else if(chosen.has(b))chosen.delete(b);else chosen.add(b);render()};
 document.addEventListener('fullscreenchange',()=>{if(isTV&&document.fullscreenElement!==area)stopTV()});
 render();
})();
