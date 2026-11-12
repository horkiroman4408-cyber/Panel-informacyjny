'use strict';
/* Monthly employee cards. Dataset stays separate from process reports. tv-five-v1 */
(()=>{
const q=id=>document.getElementById(id),safe=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),num=(v,d=1)=>Number(v).toLocaleString('pl-PL',{maximumFractionDigits:d});
const KEY='incydenty-worker-reports-v1';let reports=[],active=false,expanded=new Set(),busy=false,monthlyTV=false,paused=false,index=0,step=0,timer,hideTimer,raf,settings={interval:20,cards:10,layout:'auto',autohide:true},capacity=8,maxRow=0,effectiveCards=5;
try{const saved=JSON.parse(localStorage.getItem(KEY));if(Array.isArray(saved))reports=saved.filter(validWorker);}catch{}
try{const saved=JSON.parse(localStorage.getItem('incydenty-worker-tv'));if(saved&&[10,20,30,60].includes(saved.interval)&&[1,2,4,5,10,15,20].includes(saved.cards))settings={...settings,...saved,layout:saved.layout==='manual'?'manual':'auto'};}catch{}
const dailyTV=q('tv').onclick;
q('workerArea').innerHTML=`<div class="workerheading"><div><div class="eyebrow">WYNIKI ZA WYBRANY OKRES</div><h2>Karty pracowników</h2><p>Realizacja norm i czas pracy w procesach.</p></div><button id="workerImport" class="primary">Wczytaj pliki Excel</button><input id="workerFiles" type="file" accept=".xlsx" multiple hidden></div><div class="workerfilters glass"><label>Okres<select id="workerPeriod"></select></label><label>Pracownik<input id="workerSearch" placeholder="Szukaj Login TH" autocomplete="off"></label><span id="workerCount"></span><button id="workerClear">Wyczyść karty</button></div><div id="workerMessage" role="status" hidden></div><div id="workerCards" class="workercards"></div><div id="workerTVbar" class="monthly-tvbar" hidden><span id="workerTVstatus"></span><button id="workerTVsettings">⚙ Ustawienia</button><button id="workerPause">Ⅱ Wstrzymaj</button><button id="workerExit">Zakończ pokaz ✕</button></div><dialog id="workerTVdialog" aria-labelledby="workerTVtitle"><div class="confighead"><div><div class="eyebrow">KARTY PRACOWNIKÓW</div><h2 id="workerTVtitle">Ustawienia TV</h2></div><button id="workerTVclose" aria-label="Zamknij ustawienia kart TV">✕</button></div><div class="configgrid"><label>Zmiana co<select id="workerInterval"><option value="10">10 sekund</option><option value="20">20 sekund</option><option value="30">30 sekund</option><option value="60">60 sekund</option></select></label><div class="worker-mode-label">Rozmieszczenie kart</div></div><div class="worker-mode-choices" role="radiogroup" aria-label="Rozmieszczenie kart"><label class="worker-mode-option"><input type="radio" name="workerTVMode" value="auto" id="workerModeAuto"><span><b>Automatycznie</b><small>Dopasuj liczbę kart do ekranu i liczby procesów</small></span></label><label class="worker-mode-option"><input type="radio" name="workerTVMode" value="manual" id="workerModeManual"><span><b>Ręcznie</b><small>Wybierz liczbę pracowników na ekranie</small></span></label></div><div id="workerManualBox" class="worker-manual-box" hidden><div class="worker-manual-label">Kart jednocześnie</div><div class="worker-card-choices" role="radiogroup" aria-label="Kart jednocześnie"><label><input type="radio" name="workerTVCount" value="5"><span>5</span></label><label><input type="radio" name="workerTVCount" value="10"><span>10</span></label><label><input type="radio" name="workerTVCount" value="15"><span>15</span></label><label><input type="radio" name="workerTVCount" value="20"><span>20</span></label></div></div><div class="worker-tv-note" id="workerTVnote">Wszystkie procesy są widoczne na każdej karcie. Jeśli wybrany układ nie mieści się na ekranie, karta nie zostanie ucięta.</div><label class="hideoption"><input id="workerAutoHide" type="checkbox"> Ukrywaj sterowanie po 3 sekundach</label><p class="confighelp">Pokaz obejmuje pracowników z wybranego okresu i filtra. Karty są uporządkowane po Login TH. Wszystkie procesy pracownika są widoczne razem, bez zmiany stron wewnątrz kart.</p><button id="workerTVstart" class="primary">Uruchom pokaz</button></dialog>`;
function validWorker(r){return r&&typeof r.login==='string'&&validDate(r.from)&&validDate(r.to)&&r.from<=r.to&&Array.isArray(r.rows)&&r.rows.length>0&&r.rows.every(x=>typeof x.process==='string'&&[x.pieces,x.hours,x.kpi].every(v=>Number.isFinite(v)&&v>=0));}
function plural(n,one,few,many){return n===1?one:n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?few:many;}
function periodKey(r){return r.from+'|'+r.to}function reportKey(r){return r.login+'|'+periodKey(r)}
function normalizedDate(s){if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const [d,m,y]=s.split('.');return y+'-'+m+'-'+d;}
function parseWorkerRows(rows,source){const header=rows.findIndex(r=>String(r[0]||'').trim().toUpperCase()==='PROCESS'&&r.some(v=>String(v).trim()==='KPI %'));if(header<0)throw Error('Oczekiwano kolumn PROCESS, Pieces, Time, KPI %.');const labels=rows[header].map(v=>String(v).trim()),pc=labels.indexOf('Pieces'),tc=labels.indexOf('Time'),kc=labels.indexOf('KPI %');if([pc,tc,kc].some(i=>i<0))throw Error('Brak wymaganych kolumn.');const metadata=rows.flat().filter(v=>typeof v==='string').join('\n');const loginLines=metadata.split(/\r?\n/).filter(l=>/^\s*Login TH\b/i.test(l));if(loginLines.length!==1||/\b(nie|not)\b|не\s+является/i.test(loginLines[0]))throw Error('Plik musi wskazywać jednego pracownika w filtrze Login TH.');const logins=loginLines[0].match(/\b(?:[A-Z]{1,5}\d{4,}|\d{5,})\b/g);if(!logins||logins.length!==1)throw Error('Nie można odczytać Login TH.');const dates=metadata.match(/\bDate\s+(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4})\s+-\s+(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4})/i);if(!dates)throw Error('Nie znaleziono zakresu dat w filtrach pliku.');const from=normalizedDate(dates[1]),to=normalizedDate(dates[2]);if(!validDate(from)||!validDate(to)||from>to)throw Error('Nieprawidłowy okres w pliku.');const processes=[];for(let i=header+1;i<rows.length;i++){const row=rows[i];if(!row[0])continue;if(/zastosowane filtry|примененные фильтры|applied filters/i.test(String(row[0])))break;if(![row[pc],row[tc],row[kc]].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0))throw Error('Niepoprawne dane procesu '+row[0]);if(row[tc]===0&&row[pc]>0)throw Error('Proces z wolumenem i zerowym czasem: '+row[0]);const name=String(row[0]).trim();if(processes.some(p=>p.process===name))throw Error('Powtórzony proces: '+name);processes.push({process:name,pieces:row[pc],hours:row[tc],kpi:row[kc]*100});}const report={login:logins[0],from,to,rows:processes,source,importedAt:new Date().toISOString()};if(!validWorker(report))throw Error('Brak pełnych danych pracownika.');return report;}
function summarize(r){const hours=r.rows.reduce((a,x)=>a+x.hours,0),pieces=r.rows.reduce((a,x)=>a+x.pieces,0),kpi=hours>0?r.rows.reduce((a,x)=>a+x.kpi*x.hours,0)/hours:null;return {hours,pieces,kpi,inNorm:r.rows.filter(x=>x.kpi>=100).length};}
function periodLabel(r){const start=new Date(r.from+'T12:00:00Z'),end=new Date(r.to+'T12:00:00Z');const monthEnd=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0));if(start.getUTCDate()===1&&end.getTime()===monthEnd.getTime()+12*3600000)return start.toLocaleDateString('pl-PL',{month:'long',year:'numeric',timeZone:'UTC'});return r.from.split('-').reverse().join('.')+' — '+r.to.split('-').reverse().join('.');}
function filtered(){const period=q('workerPeriod').value,search=q('workerSearch').value.trim().toUpperCase();return reports.filter(r=>(!period||periodKey(r)===period)&&r.login.toUpperCase().includes(search)).sort((a,b)=>a.login.localeCompare(b.login)||a.from.localeCompare(b.from));}
function save(){try{localStorage.setItem(KEY,JSON.stringify(reports));return true}catch{return false}}
function message(text){q('workerMessage').textContent=text;q('workerMessage').hidden=false;}
function updatePeriods(preferred){const selected=preferred||q('workerPeriod').value,periods=[...new Map(reports.map(r=>[periodKey(r),r])).entries()].sort(([a],[b])=>b.localeCompare(a));q('workerPeriod').replaceChildren(...periods.map(([key,r])=>{const o=document.createElement('option');o.value=key;o.textContent=periodLabel(r);return o}));if(periods.some(([k])=>k===selected))q('workerPeriod').value=selected;}
function cardMarkup(r,limit){const summary=summarize(r),key=reportKey(r),isExpanded=expanded.has(key),totalPages=1,localPage=0,shown=monthlyTV?r.rows:isExpanded?r.rows:r.rows.slice(0,5);return `<article class="employee-card glass" data-key="${safe(key)}"><div class="employee-head"><div><div class="eyebrow">LOGIN TH</div><h3>${safe(r.login)}</h3><p>${safe(periodLabel(r))}</p></div><span class="employee-badge">${r.rows.length} ${plural(r.rows.length,'proces','procesy','procesów')}</span></div><div class="employee-summary"><div><span>KPI za okres</span><strong class="${summary.kpi!==null&&summary.kpi>=100?'goodtext':'neutral-kpi'}">${summary.kpi===null?'—':num(summary.kpi)+'%'}</strong></div><div><span>Czas w procesach</span><strong>${num(summary.hours)} <small>h</small></strong></div><div title="Wartość Pieces z eksportu, przeliczona według norm procesów. To nie jest liczba fizycznych sztuk."><span>Wolumen przeliczony</span><strong>${num(summary.pieces,0)}</strong></div></div><div class="employee-table"><div class="employee-table-head"><span>Proces</span><span>Szt. przel.</span><span>Czas</span><span>KPI</span></div><div class="employee-processes">${shown.map(x=>`<div class="employee-process"><div class="employee-process-line"><strong>${safe(x.process)}</strong><span>${num(x.pieces,0)}</span><span>${num(x.hours,1)} h</span><b class="${x.kpi>=100?'good':'below'}">${num(x.kpi)}%</b></div><div class="employee-track"><div style="width:${Math.min(100,x.kpi/1.5)}%" class="${x.kpi>=100?'':'below-fill'}"></div><i></i></div></div>`).join('')}</div></div><div class="employee-foot"><span>${summary.inNorm} z ${r.rows.length} ${plural(r.rows.length,'proces','procesy','procesów')} z KPI ≥ 100%</span>${monthlyTV?(totalPages>1?`<span>${localPage+1} / ${totalPages}</span>`:''):`<button class="employee-expand" data-key="${safe(key)}">${isExpanded?'Zwiń':'Pełna karta'}</button>`}</div></article>`;}
function render(){const list=filtered();q('workerCount').textContent=list.length+' '+plural(list.length,'karta','karty','kart')+' · '+reports.length+' zapisanych';if(active){q('tv').disabled=!list.length;q('upload').disabled=busy;}q('workerClear').disabled=!reports.length;q('workerPeriod').disabled=!reports.length;const visible=monthlyTV?list.slice(index,index+effectiveCards):list;q('workerCards').className='workercards'+(monthlyTV?' cards-tv-grid':'');q('workerCards').innerHTML=visible.length?visible.map(r=>cardMarkup(r,monthlyTV?capacity:5)).join(''):`<div class="glass reportempty"><div class="emptyico">↥</div><h3>${reports.length?'Brak kart dla tego filtra':'Wczytaj raporty pracowników'}</h3><p>Dodaj do 25 plików Excel jednocześnie.<br>Login TH i okres zostaną odczytane z filtrów w plikach.</p><button id="workerEmptyImport" class="primary">Wczytaj pliki Excel</button></div>`;q('workerEmptyImport')?.addEventListener('click',()=>q('workerFiles').click());if(monthlyTV){q('workerTVstatus').textContent=(list.length?(index+1)+'–'+Math.min(index+effectiveCards,list.length):'0')+' / '+list.length+(paused?' · Pauza':' · co '+settings.interval+' s');cancelAnimationFrame(raf);raf=requestAnimationFrame(measure);}}
function switchView(worker){if(monthlyTV)stop();active=worker;q('workerArea').hidden=!worker;q('norms').hidden=worker;q('processView').classList.toggle('active',!worker);q('workerView').classList.toggle('active',worker);q('upload').textContent=worker?'↥ Pliki pracowników':'↥ Wczytaj Excel';q('notice').hidden=true;if(worker)render();else{q('tv').disabled=!data.sections.length;q('upload').disabled=false;}}
q('processView').onclick=()=>switchView(false);q('workerView').onclick=()=>switchView(true);const dailyTab=q('results').onclick;q('results').onclick=()=>{dailyTab();q('resultViews').hidden=false;switchView(active)};const assignmentTab=q('assignment').onclick;q('assignment').onclick=()=>{assignmentTab();q('resultViews').hidden=true;q('workerArea').hidden=true};const back=q('back').onclick;q('back').onclick=()=>{back();q('resultViews').hidden=false;switchView(active)};
const dailyUpload=q('upload').onclick;q('upload').onclick=()=>active?q('workerFiles').click():dailyUpload();q('workerImport').onclick=()=>q('workerFiles').click();q('workerSearch').oninput=q('workerPeriod').onchange=()=>{index=0;step=0;render()};q('workerCards').onclick=e=>{const b=e.target.closest('.employee-expand');if(!b)return;const key=b.dataset.key;if(expanded.has(key))expanded.delete(key);else expanded.add(key);render()};q('workerClear').onclick=()=>{reports=[];expanded.clear();save();updatePeriods();render();message('Usunięto zapisane karty pracowników. Wyniki procesów pozostają osobno.');};
q('workerFiles').onchange=async event=>{const files=[...event.target.files];if(!files.length)return;if(files.length>25){message('Wybierz maksymalnie 25 plików w jednej partii.');event.target.value='';return}busy=true;q('workerImport').disabled=true;q('upload').disabled=true;let imported=0,replaced=0,preferred;const errors=[];for(let i=0;i<files.length;i++){const file=files[i];message('Wczytywanie '+(i+1)+' / '+files.length+'…');try{if(file.size>10000000)throw Error('Maksymalny rozmiar pliku to 10 MB.');const r=parseWorkerRows(await xlsxRows(await file.arrayBuffer(),'Export'),file.name);const existing=reports.findIndex(x=>reportKey(x)===reportKey(r));if(existing>=0){reports[existing]=r;replaced++}else reports.push(r);preferred=periodKey(r);imported++;}catch(error){errors.push(file.name+': '+error.message)}}const stored=save();busy=false;q('workerImport').disabled=false;q('upload').disabled=false;updatePeriods(preferred);expanded.clear();index=0;step=0;render();message('Wczytano '+imported+' / '+files.length+' plików'+(replaced?' · zaktualizowano '+replaced+' kart':'')+'.'+(!stored?' Nie udało się zapisać kart w przeglądarce.':' Karty zapisano w tej przeglądarce.')+(errors.length?' Pominięto: '+errors.join(' | '):''));event.target.value='';};
function toggleTVMode(){const manual=q('workerModeManual').checked;q('workerManualBox').hidden=!manual;}
function openTV(){if(!filtered().length)return;clearTimeout(hideTimer);q('workerInterval').value=String(settings.interval);q(settings.layout==='manual'?'workerModeManual':'workerModeAuto').checked=true;const selected=document.querySelector('input[name="workerTVCount"][value="'+(settings.cards||10)+'"]')||document.querySelector('input[name="workerTVCount"][value="10"]');selected.checked=true;toggleTVMode();q('workerAutoHide').checked=settings.autohide;q('workerTVstart').textContent=monthlyTV?'Zastosuj i kontynuuj':'Uruchom pokaz';q('workerTVdialog').showModal();}
q('workerModeAuto').addEventListener('change',toggleTVMode);
q('workerModeManual').addEventListener('change',toggleTVMode);

function controls(){if(!monthlyTV)return;const bar=q('workerTVbar');bar.classList.remove('controls-hidden');bar.inert=false;bar.removeAttribute('aria-hidden');clearTimeout(hideTimer);if(settings.autohide&&!q('workerTVdialog').open)hideTimer=setTimeout(()=>{if(bar.contains(document.activeElement))document.activeElement.blur();bar.classList.add('controls-hidden');bar.inert=true;bar.setAttribute('aria-hidden','true')},3000);}
function chooseCount(){
  const list=filtered(),availableW=q('workerCards').clientWidth||innerWidth;
  // The layout uses five columns. At small CSS viewport widths fewer columns are usable.
  if(availableW<900)return 5;
  const top=q('workerCards').getBoundingClientRect().top;
  const availableHeight=Math.max(200,innerHeight-top-50);
  const gap=10;
  for(const count of [20,15,10,5]){
    const groups=Math.ceil(count/5);
    let sum=0;
    for(let row=0;row<groups;row++){
      const block=list.slice(index+row*5,index+(row+1)*5);
      if(!block.length)break;
      const maxProcesses=Math.max(...block.map(r=>r.rows.length));
      // Conservative line-height estimate. The final DOM check below validates fit.
      sum+=195+maxProcesses*39+(row>0?gap:0);
    }
    if(sum<=availableHeight)return Math.min(count,Math.max(5,Math.ceil((list.length-index)/5)*5));
  }
  return 5;
}
function renderTV(){if(!monthlyTV)return;effectiveCards=settings.layout==='auto'?chooseCount():settings.cards;render();}
function start(){settings={interval:Number(q('workerInterval').value),cards:Number(document.querySelector('input[name="workerTVCount"]:checked')?.value||10),layout:q('workerModeManual').checked?'manual':'auto',autohide:q('workerAutoHide').checked};try{localStorage.setItem('incydenty-worker-tv',JSON.stringify(settings))}catch{}q('workerTVdialog').close();monthlyTV=true;paused=false;index=0;step=0;capacity=6;maxRow=0;document.body.classList.add('tv','monthly-tv');q('workerTVbar').hidden=false;q('workerPause').textContent='Ⅱ Wstrzymaj';clearInterval(timer);timer=setInterval(tick,settings.interval*1000);renderTV();controls();if(!document.fullscreenElement)document.documentElement.requestFullscreen?.().catch(()=>{});}
function tick(){if(!monthlyTV||paused||q('workerTVdialog').open)return;const length=filtered().length;index+=effectiveCards;if(index>=length)index=0;renderTV();}
function measure(){if(!monthlyTV||settings.layout!=='auto')return;
  const cards=[...q('workerCards').querySelectorAll('.employee-card')];if(!cards.length)return;
  const bottom=Math.max(...cards.map(el=>el.getBoundingClientRect().bottom));
  if(bottom>innerHeight-16&&effectiveCards>5){effectiveCards-=5;render();}
}

function stop(){monthlyTV=false;clearInterval(timer);clearTimeout(hideTimer);cancelAnimationFrame(raf);document.body.classList.remove('tv','monthly-tv');q('workerTVbar').hidden=true;q('workerTVbar').classList.remove('controls-hidden');q('workerTVbar').inert=false;if(q('workerTVdialog').open)q('workerTVdialog').close();if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});render();}
q('tv').onclick=()=>active?openTV():dailyTV();q('workerTVsettings').onclick=openTV;q('workerTVstart').onclick=start;q('workerTVclose').onclick=()=>q('workerTVdialog').close();q('workerTVdialog').addEventListener('close',controls);q('workerPause').onclick=()=>{paused=!paused;q('workerPause').textContent=paused?'▶ Wznów':'Ⅱ Wstrzymaj';render();controls()};q('workerExit').onclick=stop;for(const e of ['pointermove','pointerdown','touchstart'])document.addEventListener(e,controls,{passive:true});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&monthlyTV&&!q('workerTVdialog').open)stop();else controls()});document.addEventListener('fullscreenchange',()=>{if(monthlyTV&&!document.fullscreenElement)stop()});let resizeTimer;window.addEventListener('resize',()=>{if(monthlyTV){clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{maxRow=0;renderTV()},100)}});
const help=document.createElement('dialog');help.id='workerInfo';help.innerHTML='<h2>Karty pracowników — dane</h2><p>Login TH i zakres dat pochodzą z filtrów w każdym pliku Excel.</p><p>KPI za okres to średnia KPI procesów ważona czasem. Każdy KPI procesu pochodzi z kolumny KPI %.</p><p>Wolumen przeliczony to suma kolumny Pieces (jak Pieces calc. w raporcie). Nie jest to liczba fizycznych sztuk.</p><p>Zaokrąglenia dotyczą tylko widoku. Obliczenia wykorzystują pełną precyzję danych.</p><p>Pliki są przetwarzane lokalnie. Karty są zapisane osobno od wyników procesów, w tej przeglądarce. Ten sam Login TH i ten sam zakres dat aktualizują istniejącą kartę.</p><button id="workerInfoClose" class="primary">Zamknij</button>';document.body.append(help);const dailyInfo=q('settings').onclick;q('settings').onclick=()=>active?help.showModal():dailyInfo();q('workerInfoClose').onclick=()=>help.close();

// TV layout belongs to this module: no separate tv5.css is required.
const workerLayoutStyles=document.createElement('style');
workerLayoutStyles.id='employee-layout-styles';
workerLayoutStyles.textContent=`
/* employee-layout-v2: denser desktop grid + integrated 5-card TV mode */
@media(min-width:1200px){
  .workercards{grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
  .employee-card{padding:22px;border-radius:24px}
  .employee-head h3{font-size:24px}
  .employee-head p{font-size:12px}
  .employee-badge{font-size:10px;padding:6px 10px}
  .employee-summary{margin:16px 0 18px;padding:12px 0;gap:4px}
  .employee-summary>div{padding:0 10px}
  .employee-summary span{font-size:9px;margin-bottom:5px}
  .employee-summary strong{font-size:24px}
  .employee-table-head,.employee-process-line{grid-template-columns:minmax(100px,1.8fr) minmax(54px,.8fr) minmax(54px,.8fr) minmax(58px,.78fr);gap:8px}
  .employee-table-head{font-size:9px;padding-bottom:7px}
  .employee-process{padding:9px 0}
  .employee-process-line{font-size:12px}
  .employee-process-line strong{font-size:11px}
  .employee-process-line>b{font-size:11px;padding:4px 6px}
  .employee-foot{font-size:10px;margin-top:11px}
}
@media(min-width:1650px){
  .workercards{grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
  .employee-card{padding:20px}
  .employee-head h3{font-size:22px}
  .employee-summary strong{font-size:22px}
  .employee-process-line strong{font-size:10px}
}
body.monthly-tv .workercards.cards-tv-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:clamp(6px,.65vw,14px);align-items:stretch;width:100%}
body.monthly-tv .cards-tv-grid .employee-card{padding:clamp(9px,.85vw,17px);min-width:0;min-height:0;display:flex;flex-direction:column;border-radius:clamp(13px,1.2vw,23px)}
body.monthly-tv .cards-tv-grid .employee-head{gap:4px;flex-wrap:wrap;align-items:flex-start}
body.monthly-tv .cards-tv-grid .employee-head h3{font-size:clamp(16px,1.4vw,26px)}
body.monthly-tv .cards-tv-grid .employee-head p{font-size:clamp(9px,.66vw,12px)}
body.monthly-tv .cards-tv-grid .employee-badge{font-size:clamp(9px,.6vw,11px);padding:4px 7px}
body.monthly-tv .cards-tv-grid .employee-summary{padding:clamp(7px,.65vw,12px) 0;margin:clamp(8px,.8vw,16px) 0;gap:2px;grid-template-columns:repeat(3,minmax(0,1fr))}
body.monthly-tv .cards-tv-grid .employee-summary>div{padding:0 clamp(2px,.35vw,7px);min-width:0}
body.monthly-tv .cards-tv-grid .employee-summary span{font-size:clamp(8px,.57vw,11px);line-height:1.25;min-height:2.5em;overflow-wrap:anywhere}
body.monthly-tv .cards-tv-grid .employee-summary strong{font-size:clamp(14px,1.2vw,22px)}
body.monthly-tv .cards-tv-grid .employee-summary small{font-size:10px}
body.monthly-tv .cards-tv-grid .employee-table-head,body.monthly-tv .cards-tv-grid .employee-process-line{grid-template-columns:minmax(0,1.55fr) minmax(44px,.78fr) minmax(42px,.78fr) minmax(50px,.78fr);gap:clamp(3px,.35vw,8px)}
body.monthly-tv .cards-tv-grid .employee-table-head{font-size:clamp(7px,.48vw,10px);margin:0 0 4px;padding:0 0 6px}
body.monthly-tv .cards-tv-grid .employee-process{padding:clamp(4px,.42vw,8px) 0}
body.monthly-tv .cards-tv-grid .employee-process-line{font-size:clamp(9px,.72vw,13px)}
body.monthly-tv .cards-tv-grid .employee-process-line strong{font-size:clamp(9px,.65vw,12px);line-height:1.15;overflow-wrap:anywhere}
body.monthly-tv .cards-tv-grid .employee-process-line>b{font-size:clamp(9px,.66vw,12px);padding:clamp(2px,.24vw,4px) clamp(4px,.36vw,7px)}
body.monthly-tv .cards-tv-grid .employee-track{height:3px;margin-top:4px}
body.monthly-tv .cards-tv-grid .employee-track>div,body.monthly-tv .cards-tv-grid .employee-track i{height:3px}
body.monthly-tv .cards-tv-grid .employee-foot{margin-top:auto;padding-top:8px;gap:6px;font-size:clamp(8px,.55vw,11px)}
body.monthly-tv .cards-tv-grid .employee-foot span:last-child:not(:first-child){display:none}
body.monthly-tv .cards-tv-grid .employee-expand{display:none}

@media(max-width:1000px){body.monthly-tv .workercards.cards-tv-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:760px){body.monthly-tv .workercards.cards-tv-grid{grid-template-columns:1fr}}

/* New TV settings, matching the app's existing soft-blue cards */
body.monthly-tv .shell{max-width:none}
#workerTVdialog .configgrid{margin-bottom:12px;align-items:center}
#workerTVdialog .worker-mode-label{font-size:13px;color:#667085}
#workerTVdialog .worker-mode-choices{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:8px 0 14px}
#workerTVdialog .worker-mode-option{display:flex;gap:10px;align-items:flex-start;padding:14px 12px;border:1px solid #dde5ef;background:#fafcff;border-radius:15px;cursor:pointer}
#workerTVdialog .worker-mode-option:has(input:checked){border-color:#85bdff;background:#eef6ff}
#workerTVdialog .worker-mode-option input{margin-top:3px}
#workerTVdialog .worker-mode-option span{display:flex;flex-direction:column;gap:5px}
#workerTVdialog .worker-mode-option b{color:#27374d;font-size:13px}
#workerTVdialog .worker-mode-option small{color:#687790;font-size:11px;line-height:1.4}
#workerTVdialog .worker-manual-box{margin:12px 0}
#workerTVdialog .worker-manual-label{font-size:12px;color:#667085;margin:0 0 9px}
#workerTVdialog .worker-card-choices{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
#workerTVdialog .worker-card-choices label{display:block;position:relative;cursor:pointer}
#workerTVdialog .worker-card-choices input{position:absolute;opacity:0;pointer-events:none}
#workerTVdialog .worker-card-choices span{display:block;padding:11px;border-radius:12px;text-align:center;border:1px solid #dde5ef;background:#fff;font-weight:700;color:#485b74}
#workerTVdialog .worker-card-choices input:checked+span{background:#eaf4ff;border-color:#80b9ff;color:#0876d9}
#workerTVdialog .worker-card-choices input:focus-visible+span{outline:3px solid #0a84ff;outline-offset:2px}
#workerTVdialog .worker-tv-note{font-size:12px;color:#64748b;line-height:1.55;margin:12px 0 16px}
#workerTVdialog .hideoption{margin:12px 0}
body.monthly-tv .workercards.cards-tv-grid{grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
body.monthly-tv .cards-tv-grid .employee-card{height:max-content;align-self:stretch}
body.monthly-tv .cards-tv-grid .employee-summary{margin:8px 0;padding:8px 0}
body.monthly-tv .cards-tv-grid .employee-process{padding:5px 0}
body.monthly-tv .cards-tv-grid .employee-foot{margin-top:6px;padding-top:5px}
body.monthly-tv .cards-tv-grid .employee-head h3{font-size:clamp(14px,1.08vw,23px)}
body.monthly-tv .cards-tv-grid .employee-head .eyebrow{font-size:8px}
body.monthly-tv .cards-tv-grid .employee-summary strong{font-size:clamp(13px,1.08vw,23px)}
body.monthly-tv .cards-tv-grid .employee-summary span{font-size:clamp(8px,.48vw,10px)}
body.monthly-tv .cards-tv-grid .employee-process-line strong{font-size:clamp(9px,.60vw,12px)}
@media(min-width:2500px) and (min-height:1400px){
 body.monthly-tv .cards-tv-grid .employee-head h3{font-size:26px}
 body.monthly-tv .cards-tv-grid .employee-process-line,body.monthly-tv .cards-tv-grid .employee-process-line strong{font-size:15px}
 body.monthly-tv .cards-tv-grid .employee-process-line>b{font-size:15px}
 body.monthly-tv .cards-tv-grid .employee-summary strong{font-size:26px}
 body.monthly-tv .cards-tv-grid .employee-summary span{font-size:12px}
 body.monthly-tv .cards-tv-grid .employee-process{padding:7px 0}
}
@media(max-width:760px){#workerTVdialog .worker-mode-choices{grid-template-columns:1fr}}

/* v1.1.4: subtle compact treatment for the regular app only. TV remains unchanged. */
@media(min-width:761px){
 body:not(.tv) .shell{padding-top:22px;padding-bottom:12px}
 body:not(.tv) header{min-height:92px}
 body:not(.tv) .brand h1{font-size:clamp(25px,2vw,32px)}
 body:not(.tv) .brand p{font-size:12px}
 body:not(.tv) #clock{font-size:20px}
 body:not(.tv) nav{margin-top:14px;padding:7px;border-radius:19px}
 body:not(.tv) nav button{padding:9px 15px;font-size:13px}
 body:not(.tv) nav .tabs button{padding:9px 16px}
 body:not(.tv) .titlebar{margin:19px 0 17px}
 body:not(.tv) .titlebar h2{font-size:clamp(25px,2vw,29px)}
 body:not(.tv) .resultviews{margin-top:15px;margin-bottom:15px}
 body:not(.tv) .resultviews button{padding:9px 15px;font-size:13px}
 body:not(.tv) .workerheading{margin-top:16px;margin-bottom:16px}
 body:not(.tv) .workerheading h2{font-size:28px}
 body:not(.tv) .workerheading p{font-size:12px;margin-top:5px}
 body:not(.tv) .workerfilters{padding:12px 16px;margin-bottom:16px}
 body:not(.tv) .workerfilters button{padding:9px 14px;font-size:12px}
 body:not(.tv) .workerfilters input,body:not(.tv) .workerfilters select{font-size:12px}
 body:not(.tv) .employee-card{border-radius:22px}
 body:not(.tv) .employee-head h3{font-size:23px}
 body:not(.tv) .employee-summary{margin:14px 0 16px;padding:11px 0}
 body:not(.tv) .employee-process{padding:8px 0}
 body:not(.tv) .employee-track{margin-top:5px}
 body:not(.tv) .employee-foot{margin-top:10px}
 body:not(.tv) .toolbar{margin-bottom:14px}
 body:not(.tv) .card{padding:20px;min-height:0}
 body:not(.tv) .card .norm{margin:16px 0 13px;padding-bottom:13px}
 body:not(.tv) .card .norm strong{font-size:clamp(35px,2.6vw,48px)}
 body:not(.tv) .card .processname{font-size:19px}
 body:not(.tv) .card .worker{padding:10px 0}
}
@media(min-width:761px) and (max-width:1199px){
 body:not(.tv) .employee-card{padding:19px}
}
@media(min-width:1200px){
 body:not(.tv) .employee-card{padding:18px}
 body:not(.tv) .workercards{gap:14px}
}
`;
document.head.appendChild(workerLayoutStyles);

updatePeriods();render();
})();
