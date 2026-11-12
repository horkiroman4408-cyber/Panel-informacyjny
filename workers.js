'use strict';
/* Monthly employee cards. Dataset stays separate from process reports. tv-five-v1 */
(()=>{
const q=id=>document.getElementById(id),safe=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),num=(v,d=1)=>Number(v).toLocaleString('pl-PL',{maximumFractionDigits:d});
const KEY='incydenty-worker-reports-v1';let reports=[],active=false,expanded=new Set(),busy=false,monthlyTV=false,paused=false,index=0,step=0,timer,hideTimer,raf,settings={interval:20,cards:10,layout:'auto',autohide:true},capacity=8,maxRow=0,effectiveCards=5;
try{const saved=JSON.parse(localStorage.getItem(KEY));if(Array.isArray(saved))reports=saved.filter(validWorker);}catch{}
try{const saved=JSON.parse(localStorage.getItem('incydenty-worker-tv'));if(saved&&[10,20,30,60].includes(saved.interval)&&[1,2,4,5,10,15,20].includes(saved.cards))settings={...settings,...saved,layout:saved.layout==='manual'?'manual':'auto'};}catch{}
// Legacy app.js still references this input; keep it hidden and disabled, not displayed.
const onlyNormsInput=q('onlynorms');
if(onlyNormsInput){onlyNormsInput.checked=false;onlyNormsInput.hidden=true;const oldLabel=onlyNormsInput.closest('label');if(oldLabel)oldLabel.replaceWith(onlyNormsInput);}
const dailyTV=q('tv').onclick;
q('workerArea').innerHTML=`<div class="workerheading"><div><div class="eyebrow">WYNIKI ZA WYBRANY OKRES</div><h2>Karty pracowników</h2><p>Realizacja norm i czas pracy w procesach.</p></div><button id="workerImport" class="primary" hidden aria-hidden="true" tabindex="-1">📥 Wczytaj pliki Excel</button><input id="workerFiles" type="file" accept=".xlsx" multiple hidden></div><div class="workerfilters glass"><label>Okres<select id="workerPeriod"></select></label><label>Pracownik<input id="workerSearch" placeholder="Szukaj Login TH" autocomplete="off"></label><span id="workerCount"></span><button id="workerClear">Wyczyść karty</button></div><div id="workerMessage" role="status" hidden></div><div id="workerCards" class="workercards"></div><div id="workerTVbar" class="monthly-tvbar" hidden><span id="workerTVstatus"></span><button id="workerTVsettings">⚙ Ustawienia</button><button id="workerPause">Ⅱ Wstrzymaj</button><button id="workerExit">Zakończ pokaz ✕</button></div><dialog id="workerTVdialog" aria-labelledby="workerTVtitle"><div class="confighead"><div><div class="eyebrow">KARTY PRACOWNIKÓW</div><h2 id="workerTVtitle">Ustawienia TV</h2></div><button id="workerTVclose" aria-label="Zamknij ustawienia kart TV">✕</button></div><div class="configgrid"><label>Zmiana co<select id="workerInterval"><option value="10">10 sekund</option><option value="20">20 sekund</option><option value="30">30 sekund</option><option value="60">60 sekund</option></select></label><div class="worker-mode-label">Rozmieszczenie kart</div></div><div class="worker-mode-choices" role="radiogroup" aria-label="Rozmieszczenie kart"><label class="worker-mode-option"><input type="radio" name="workerTVMode" value="auto" id="workerModeAuto"><span><b>Automatycznie</b><small>Dopasuj liczbę kart do ekranu i liczby procesów</small></span></label><label class="worker-mode-option"><input type="radio" name="workerTVMode" value="manual" id="workerModeManual"><span><b>Ręcznie</b><small>Wybierz liczbę pracowników na ekranie</small></span></label></div><div id="workerManualBox" class="worker-manual-box" hidden><div class="worker-manual-label">Kart jednocześnie</div><div class="worker-card-choices" role="radiogroup" aria-label="Kart jednocześnie"><label><input type="radio" name="workerTVCount" value="5"><span>5</span></label><label><input type="radio" name="workerTVCount" value="10"><span>10</span></label><label><input type="radio" name="workerTVCount" value="15"><span>15</span></label><label><input type="radio" name="workerTVCount" value="20"><span>20</span></label></div></div><div class="worker-tv-note" id="workerTVnote">Wszystkie procesy są widoczne na każdej karcie. Jeśli wybrany układ nie mieści się na ekranie, karta nie zostanie ucięta.</div><label class="hideoption"><input id="workerAutoHide" type="checkbox"> Ukrywaj sterowanie po 3 sekundach</label><p class="confighelp">Pokaz obejmuje pracowników z wybranego okresu i filtra. Karty są uporządkowane po Login TH. Wszystkie procesy pracownika są widoczne razem, bez zmiany stron wewnątrz kart.</p><button id="workerTVstart" class="primary">Uruchom pokaz</button></dialog>`;
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
function cardMarkup(r,limit){const summary=summarize(r),key=reportKey(r),isExpanded=expanded.has(key),totalPages=1,localPage=0,shown=monthlyTV?r.rows:isExpanded?r.rows:r.rows.slice(0,5);return `<article class="employee-card glass" data-key="${safe(key)}"><div class="employee-head"><div><div class="eyebrow">LOGIN TH</div><h3>${safe(r.login)}</h3><p>${safe(periodLabel(r))}</p></div><span class="employee-badge">${r.rows.length} ${plural(r.rows.length,'proces','procesy','procesów')}</span></div><div class="employee-summary"><div><span>KPI za okres</span><strong class="${summary.kpi!==null&&summary.kpi>=100?'goodtext':'neutral-kpi'}">${summary.kpi===null?'—':num(summary.kpi)+'%'}</strong></div><div><span>Czas w procesach</span><strong>${num(summary.hours)} <small>h</small></strong></div><div title="Liczba procesów z KPI co najmniej 100% względem wszystkich procesów pracownika."><span>Procesy w normie</span><strong>${summary.inNorm}/${r.rows.length}</strong></div></div><div class="employee-table"><div class="employee-table-head"><span>Proces</span><span>Szt. przel.</span><span>Czas</span><span>KPI</span></div><div class="employee-processes">${shown.map(x=>`<div class="employee-process"><div class="employee-process-line"><strong>${safe(x.process)}</strong><span>${num(x.pieces,0)}</span><span>${num(x.hours,1)} h</span><b class="${x.kpi>=100?'good':'below'}">${num(x.kpi)}%</b></div><div class="employee-track"><div style="width:${Math.min(100,x.kpi/1.5)}%" class="${x.kpi>=100?'':'below-fill'}"></div><i></i></div></div>`).join('')}</div></div>${monthlyTV?'':`<div class="employee-foot"><button class="employee-expand" data-key="${safe(key)}">${isExpanded?'Zwiń':'Pełna karta'}</button></div>`}</article>`;}
function render(){const list=filtered();q('workerCount').textContent=list.length+' '+plural(list.length,'karta','karty','kart')+' · '+reports.length+' zapisanych';if(active){q('tv').disabled=!list.length;q('upload').disabled=busy;}q('workerClear').disabled=!reports.length;q('workerPeriod').disabled=!reports.length;const visible=monthlyTV?list.slice(index,index+effectiveCards):list;q('workerCards').className='workercards'+(monthlyTV?' cards-tv-grid':'');if(monthlyTV){q('workerCards').style.setProperty('--tv-worker-cols',String(Math.min(5,Math.max(1,visible.length))));}q('workerCards').innerHTML=visible.length?visible.map(r=>cardMarkup(r,monthlyTV?capacity:5)).join(''):`<div class="glass reportempty"><div class="emptyico">↥</div><h3>${reports.length?'Brak kart dla tego filtra':'Wczytaj raporty pracowników'}</h3><p>Dodaj do 25 plików Excel jednocześnie.<br>Login TH i okres zostaną odczytane z filtrów w plikach.</p><button id="workerEmptyImport" class="primary">📥 Wczytaj pliki Excel</button></div>`;q('workerEmptyImport')?.addEventListener('click',()=>q('workerFiles').click());if(monthlyTV){q('workerTVstatus').textContent=(list.length?(index+1)+'–'+Math.min(index+effectiveCards,list.length):'0')+' / '+list.length+(paused?' · Pauza':' · co '+settings.interval+' s');cancelAnimationFrame(raf);raf=requestAnimationFrame(measure);}}
function switchView(worker){if(monthlyTV)stop();active=worker;q('workerArea').hidden=!worker;q('norms').hidden=worker;q('processView').classList.toggle('active',!worker);q('workerView').classList.toggle('active',worker);q('upload').textContent=worker?'📥 Pliki pracowników':'📥 Wczytaj Excel';q('upload').hidden=false;q('notice').hidden=true;if(worker)render();else{q('tv').disabled=!data.sections.length;q('upload').disabled=false;}}
q('processView').onclick=()=>switchView(false);q('workerView').onclick=()=>switchView(true);const dailyTab=q('results').onclick;q('results').onclick=()=>{dailyTab();q('resultViews').hidden=false;switchView(active)};const assignmentTab=q('assignment').onclick;q('assignment').onclick=()=>{assignmentTab();q('resultViews').hidden=true;q('workerArea').hidden=true;q('upload').hidden=true};const back=q('back').onclick;q('back').onclick=()=>{back();q('resultViews').hidden=false;switchView(active)};
const dailyUpload=q('upload').onclick;q('upload').onclick=()=>active?q('workerFiles').click():dailyUpload();q('workerImport').onclick=()=>q('workerFiles').click();q('workerSearch').oninput=q('workerPeriod').onchange=()=>{index=0;step=0;render()};q('workerCards').onclick=e=>{const b=e.target.closest('.employee-expand');if(!b)return;const key=b.dataset.key;if(expanded.has(key))expanded.delete(key);else expanded.add(key);render()};q('workerClear').onclick=()=>{reports=[];expanded.clear();save();updatePeriods();render();message('Usunięto zapisane karty pracowników. Wyniki procesów pozostają osobno.');};
q('workerFiles').onchange=async event=>{const files=[...event.target.files];if(!files.length)return;if(files.length>25){message('Wybierz maksymalnie 25 plików w jednej partii.');event.target.value='';return}busy=true;q('workerImport').disabled=true;q('upload').disabled=true;let imported=0,replaced=0,preferred;const errors=[];for(let i=0;i<files.length;i++){const file=files[i];message('Wczytywanie '+(i+1)+' / '+files.length+'…');try{if(file.size>10000000)throw Error('Maksymalny rozmiar pliku to 10 MB.');const r=parseWorkerRows(await xlsxRows(await file.arrayBuffer(),'Export'),file.name);const existing=reports.findIndex(x=>reportKey(x)===reportKey(r));if(existing>=0){reports[existing]=r;replaced++}else reports.push(r);preferred=periodKey(r);imported++;}catch(error){errors.push(file.name+': '+error.message)}}const stored=save();busy=false;q('workerImport').disabled=false;q('upload').disabled=false;updatePeriods(preferred);expanded.clear();index=0;step=0;render();message('Wczytano '+imported+' / '+files.length+' plików'+(replaced?' · zaktualizowano '+replaced+' kart':'')+'.'+(!stored?' Nie udało się zapisać kart w przeglądarce.':' Karty zapisano w tej przeglądarce.')+(errors.length?' Pominięto: '+errors.join(' | '):''));event.target.value='';};
function toggleTVMode(){const manual=q('workerModeManual').checked;q('workerManualBox').hidden=!manual;}
function openTV(){if(!filtered().length)return;clearTimeout(hideTimer);q('workerInterval').value=String(settings.interval);q(settings.layout==='manual'?'workerModeManual':'workerModeAuto').checked=true;const selected=document.querySelector('input[name="workerTVCount"][value="'+(settings.cards||10)+'"]')||document.querySelector('input[name="workerTVCount"][value="10"]');selected.checked=true;toggleTVMode();q('workerAutoHide').checked=settings.autohide;q('workerTVstart').textContent=monthlyTV?'Zastosuj i kontynuuj':'Uruchom pokaz';q('workerTVdialog').showModal();}
q('workerModeAuto').addEventListener('change',toggleTVMode);
q('workerModeManual').addEventListener('change',toggleTVMode);

function controls(){if(!monthlyTV)return;const bar=q('workerTVbar');bar.classList.remove('controls-hidden');bar.inert=false;bar.removeAttribute('aria-hidden');clearTimeout(hideTimer);if(settings.autohide&&!q('workerTVdialog').open)hideTimer=setTimeout(()=>{if(bar.contains(document.activeElement))document.activeElement.blur();bar.classList.add('controls-hidden');bar.inert=true;bar.setAttribute('aria-hidden','true')},3000);}
function chooseCount(){
  // Initial estimate only. Exact measurement is performed after the browser lays out each page.
  const list=filtered(),left=list.length-index;
  if(left<=0)return 1;
  const top=q('workerCards').getBoundingClientRect().top;
  const room=Math.max(100,window.innerHeight-top-25);
  const availableW=q('workerCards').clientWidth||innerWidth;
  const columns=availableW>=1100?5:availableW>=660?3:availableW>=400?2:1;
  for(const count of [20,15,10,5]){
    const actual=Math.min(count,left),groups=Math.ceil(actual/columns);
    let height=0;
    for(let row=0;row<groups;row++){
      const group=list.slice(index+row*columns,index+(row+1)*columns);
      const processes=Math.max(0,...group.map(r=>r.rows.length));
      height+=155+processes*37+(row?10:0);
    }
    if(height<=room)return actual;
  }
  return Math.min(5,left);
}
function renderTV(){if(!monthlyTV)return;q('workerCards').style.removeProperty('zoom');q('workerCards').style.removeProperty('width');effectiveCards=settings.layout==='auto'?chooseCount():settings.cards;render();}
function start(){settings={interval:Number(q('workerInterval').value),cards:Number(document.querySelector('input[name="workerTVCount"]:checked')?.value||10),layout:q('workerModeManual').checked?'manual':'auto',autohide:q('workerAutoHide').checked};try{localStorage.setItem('incydenty-worker-tv',JSON.stringify(settings))}catch{}q('workerTVdialog').close();monthlyTV=true;paused=false;index=0;step=0;capacity=6;maxRow=0;document.body.classList.add('tv','monthly-tv');q('workerTVbar').hidden=false;q('workerPause').textContent='Ⅱ Wstrzymaj';clearInterval(timer);timer=setInterval(tick,settings.interval*1000);renderTV();controls();if(!document.fullscreenElement)document.documentElement.requestFullscreen?.().catch(()=>{});}
function tick(){if(!monthlyTV||paused||q('workerTVdialog').open)return;const length=filtered().length;index+=effectiveCards;if(index>=length)index=0;renderTV();}
let workerFitQueued=false;
function measure(){
  if(!monthlyTV)return;
  // Grid layout height is independent of transform/opacity entrance animations.
  // Avoid measuring animated child rects, which previously caused spurious re-renders.
  const wrap=q('workerCards'),cards=wrap.querySelectorAll('.employee-card');
  if(!cards.length)return;
  const bottom=wrap.getBoundingClientRect().top+wrap.offsetHeight;
  const tooTall=bottom>window.innerHeight-16;
  if(tooTall && effectiveCards>1){
    // Prefer fewer full-size cards rather than hiding any process or cropping the header.
    effectiveCards=effectiveCards>5?effectiveCards-5:effectiveCards-1;
    render();return;
  }
  if(tooTall && !workerFitQueued){
    // Last resort for a single unusually long card: shrink just the card region,
    // never the title, brand header, clocks or TV controls.
    workerFitQueued=true;
    const region=wrap.getBoundingClientRect();
    const room=Math.max(100,window.innerHeight-region.top-20);
    const natural=Math.max(1,bottom-region.top);
    const ratio=Math.max(.45,Math.min(1,room/natural));
    wrap.style.zoom=String(ratio);
    wrap.style.width=(100/ratio)+'%';
    requestAnimationFrame(()=>{workerFitQueued=false;});
  }
}
function resetWorkerFit(){
  const wrap=q('workerCards');wrap.style.removeProperty('zoom');wrap.style.removeProperty('width');
  wrap.style.setProperty('--tv-worker-cols',String(Math.min(5,Math.max(1,effectiveCards,0))));
}

function stop(){monthlyTV=false;clearInterval(timer);clearTimeout(hideTimer);cancelAnimationFrame(raf);document.body.classList.remove('tv','monthly-tv');q('workerTVbar').hidden=true;q('workerTVbar').classList.remove('controls-hidden');q('workerTVbar').inert=false;if(q('workerTVdialog').open)q('workerTVdialog').close();if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});render();}
q('tv').onclick=()=>active?openTV():dailyTV();q('workerTVsettings').onclick=openTV;q('workerTVstart').onclick=start;q('workerTVclose').onclick=()=>q('workerTVdialog').close();q('workerTVdialog').addEventListener('close',controls);q('workerPause').onclick=()=>{paused=!paused;q('workerPause').textContent=paused?'▶ Wznów':'Ⅱ Wstrzymaj';render();controls()};q('workerExit').onclick=stop;for(const e of ['pointermove','pointerdown','touchstart'])document.addEventListener(e,controls,{passive:true});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&monthlyTV&&!q('workerTVdialog').open)stop();else controls()});document.addEventListener('fullscreenchange',()=>{if(monthlyTV&&!document.fullscreenElement)stop()});let resizeTimer;window.addEventListener('resize',()=>{if(monthlyTV){clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{maxRow=0;renderTV()},100)}});
// One information center for both data views, replacing the old two dialogs.
const legacyInfo=q('info');legacyInfo.hidden=true;
const infoPanel=document.createElement('dialog');infoPanel.id='incInfo';infoPanel.setAttribute('aria-labelledby','incInfoTitle');
infoPanel.innerHTML=`
 <div class="inc-info-top"><div><span class="inc-kicker">INCYDENTY · INFORMACJE</span><h2 id="incInfoTitle">O aplikacji</h2><p>Panel informacyjny działu</p></div><div class="inc-info-topright"><span class="inc-version" id="incVersion">v1.1.14</span><button type="button" id="incInfoClose" aria-label="Zamknij">✕</button></div></div>
 <div class="inc-info-tabs" role="tablist" aria-label="Informacje"><button role="tab" type="button" aria-selected="true" data-info-tab="data">Dane</button><button role="tab" type="button" aria-selected="false" data-info-tab="app">Aplikacja</button><button role="tab" type="button" aria-selected="false" data-info-tab="history">Historia</button></div>
 <section class="inc-info-section" id="incTabData" role="tabpanel">
  <h3>Dane raportów</h3>
  <div class="inc-info-item"><div><strong>Wyniki procesów</strong><small>Źródło: Excel · arkusz RAPORT</small><small id="incProcessSource"></small></div></div>
  <div class="inc-info-item"><div><strong>Karty pracowników</strong><small>Źródło: raporty Login TH · arkusz Export</small><small id="incWorkerSource"></small></div></div>
  <h3>Jak obliczane są wyniki?</h3>
  <p><b>Realizacja normy</b> = wynik szt./h ÷ norma × 100%.</p>
  <p><b>KPI za okres</b> = średnia KPI procesów ważona czasem pracy.</p>
  <p><b>Procesy w normie</b> = liczba procesów z KPI ≥ 100% / wszystkie procesy pracownika.</p>
  <p class="inc-muted">Wynik szt./h i KPI procesu pochodzą z raportów. Zaokrąglenie dotyczy jedynie wyświetlania.</p>
  <div class="inc-info-safe"><b>Ochrona danych</b><p>Import odbywa się lokalnie. Dane zapisują się w tej przeglądarce i nie są wysyłane na serwer. Nie synchronizują się między komputerami.</p></div>
  <details class="inc-danger-area"><summary>Zarządzanie danymi</summary><div><button type="button" id="incClearProcess">Wyczyść wyniki procesów</button><button type="button" id="incClearWorkers">Wyczyść karty pracowników</button></div></details>
 </section>
 <section class="inc-info-section" id="incTabApp" role="tabpanel" hidden>
  <div class="inc-info-item"><strong>Wersja aplikacji</strong><b id="incAppVersion">1.1.8</b></div>
  <div class="inc-info-item"><strong>Status PWA</strong><span id="incPwaStatus">Sprawdzanie…</span></div>
  <h3>Funkcje</h3><p>Wyniki procesów, karty pracowników, import Excel i niezależne pokazy TV w osobnych oknach aplikacji.</p>
  <h3>Tryb TV</h3><p>Wybór ekranów, kolejności, czasu wyświetlania i automatycznego lub ręcznego dopasowania kart do ekranu.</p>
  <p class="inc-muted">Przydział do procesów jest przygotowany do rozbudowy. Import przydziałów nie jest jeszcze dostępny.</p>
 </section>
 <section class="inc-info-section" id="incTabHistory" role="tabpanel" hidden>
  <p class="inc-muted">Najważniejsze zmiany w kolejnych wydaniach.</p>
  <details open><summary><strong>v1.1.14</strong> · Wyraźniejsze, płynne pojawianie się kart</summary><p>Przywrócono spokojny efekt unoszenia i delikatny kaskadowy start kart bez kosztownego rozmycia.</p></details>
  <details><summary><strong>v1.1.13</strong> · Płynniejsza animacja kart</summary><p>Uproszczono efekt pojawiania się kart TV: bez kosztownego rozmycia i bez pomiarów podczas ruchu, z krótszymi opóźnieniami.</p></details>
  <details><summary><strong>v1.1.12</strong> · Dopasowanie do ekranu TV</summary><p>Poprawiono wykorzystanie pełnej szerokości, pozycję nagłówka i dobór liczby kart do wysokości ekranu przy 100% powiększenia.</p></details>
  <details><summary><strong>v1.1.11</strong> · Animacje kart</summary><p>Delikatne pojawianie się kart i bloków od dołu podczas zmiany ekranów. Ustawienia ograniczenia ruchu są respektowane.</p></details>
   <details><summary><strong>v1.1.10</strong> · Ikony i ustawienia TV</summary><p>Nowe ikony przycisków oraz czytelniejsze ustawienia liczby kart na ekranie.</p></details>   <details><summary><strong>v1.1.9</strong> · Nagłówek kart pracowników</summary><p>Wyśrodkowano nagłówek widoku kart pracowników w zwykłym trybie, bez zmian w TV.</p></details>
  <details><summary><strong>v1.1.8</strong> · Informacje i układ aplikacji</summary><p>Jedno centrum informacji, historia zmian oraz jeden przycisk importu na aktywny widok. Uporządkowana nawigacja.</p></details>
  <details><summary><strong>v1.1.7</strong> · Karty pracowników</summary><p>Procesy w normie zamiast łącznego wolumenu; usunięto powtarzający się opis u dołu kart.</p></details>
  <details><summary><strong>v1.1.6</strong> · Uproszczenie widoków</summary><p>Usunięto tryb Tylko normy.</p></details>
  <details><summary><strong>v1.1.5</strong> · Wspólny pokaz TV</summary><p>Ekrany wyników i kart pracowników w jednym pokazie, z wyborem kolejności i czasu.</p></details>
  <details><summary><strong>v1.1.4</strong> · Kompaktowy interfejs</summary><p>Zmniejszono odstępy oraz wysokość elementów zwykłego widoku.</p></details>
  <details><summary><strong>v1.1.3</strong> · Karty na ekranie TV</summary><p>Wprowadzono dostosowanie liczby kart pracowników do ekranu.</p></details>
  <details><summary><strong>v1.1.2</strong> · Aktualizacje PWA</summary><p>Poprawiono listę zasobów offline i odświeżanie aktualizacji.</p></details>
  <details><summary><strong>v1.1.1</strong> · Pięć kart</summary><p>Dodano widok pięciu kart pracowników z pełną listą procesów.</p></details>
  <details><summary><strong>v1.1.0</strong> · Karty pracowników</summary><p>Dodano wieloplikowy import raportów pracowników i ich karty.</p></details>
 </section>`;
document.body.append(infoPanel);
const infoTabs=[...infoPanel.querySelectorAll('[data-info-tab]')];
function showInfoTab(tab){for(const b of infoTabs){const on=b.dataset.infoTab===tab;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;}for(const [id,key] of [['incTabData','data'],['incTabApp','app'],['incTabHistory','history']])q(id).hidden=tab!==key;}
function openInformation(){
 q('incProcessSource').textContent=data.sections.length?(data.source||'Raport wczytany')+' · '+(validPeriod(data.period)?displayPeriodDate(data.period.from,data.period.fromTime)+' — '+displayPeriodDate(data.period.to,data.period.toTime):'Okres nieustawiony'):'Nie wczytano raportu';
 q('incWorkerSource').textContent=reports.length?reports.length+' zapisanych kart · ostatni import: '+new Date(Math.max(...reports.map(r=>Date.parse(r.importedAt)||0))).toLocaleString('pl-PL'):'Nie wczytano kart';
 const pwaText=q('pwaState')?.textContent||'';q('incPwaStatus').textContent=navigator.serviceWorker?.controller?'Offline dostępny po zapisaniu zasobów':'PWA · '+(pwaText||'Sprawdzanie statusu');
 fetch('./version.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(v=>{if(v&&/^\d+\.\d+\.\d+$/.test(v.version)){q('incVersion').textContent='v'+v.version;q('incAppVersion').textContent=v.version;}}).catch(()=>{});
 showInfoTab('data');infoPanel.showModal();
}
q('settings').textContent='📘 Informacje';q('tv').textContent='📺 Tryb TV';q('upload').textContent=active?'📥 Pliki pracowników':'📥 Wczytaj Excel';q('settings').onclick=openInformation;
infoTabs.forEach(b=>b.onclick=()=>showInfoTab(b.dataset.infoTab));q('incInfoClose').onclick=()=>infoPanel.close();
q('incClearProcess').onclick=()=>{if(!confirm('Usunąć zapisany raport wyników procesów?'))return;q('reset').click();infoPanel.close();};
q('incClearWorkers').onclick=()=>{if(!confirm('Usunąć wszystkie zapisane karty pracowników?'))return;q('workerClear').click();openInformationRefresh();};
function openInformationRefresh(){q('incWorkerSource').textContent='Nie wczytano kart';}
// TV layout belongs to this module: no separate tv5.css is required.
const workerLayoutStyles=document.createElement('style');
workerLayoutStyles.id='employee-layout-styles';
workerLayoutStyles.textContent=`
/* employee-layout-v2: denser desktop grid + integrated 5-card TV mode */
/* Center the worker-view heading just like Wyniki i normy, without affecting TV. */
body:not(.tv) #workerArea .workerheading{display:flex;justify-content:center;align-items:center;text-align:center;margin:16px 0 18px;gap:0}
body:not(.tv) #workerArea .workerheading>div:first-child{display:flex;flex-direction:column;align-items:center;max-width:100%}
body:not(.tv) #workerArea .workerheading .eyebrow{margin:0 0 7px}
body:not(.tv) #workerArea .workerheading h2{margin:0}
body:not(.tv) #workerArea .workerheading p{margin:6px 0 0}

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

/* Normal desktop layout: one import, compact consistent navigation and cards */
body:not(.tv) #workerImport{display:none!important}
body:not(.tv) .shell{max-width:1920px;padding-top:clamp(12px,1.3vw,24px)}
body:not(.tv) header{min-height:74px!important;align-items:center}
body:not(.tv) .brand h1{font-size:clamp(25px,2vw,35px);letter-spacing:.10em}
body:not(.tv) .brand p{font-size:12px}
body:not(.tv) nav.glass{margin-top:14px;padding:7px 10px;border-radius:20px}
body:not(.tv) nav .tabs button{padding:10px 16px;font-size:13px}
body:not(.tv) nav .actions button{font-size:12px;padding:9px 14px}
body:not(.tv) #resultViews{margin:12px auto 12px}
body:not(.tv) .titlebar{margin:13px 0 16px}
body:not(.tv) .titlebar h2{font-size:25px}
body:not(.tv) .toolbar{margin-bottom:11px}
body:not(.tv) .reportperiod{margin:4px 0 17px}
body:not(.tv) .workerheading{margin:12px 0 13px}
body:not(.tv) .workerheading h2{font-size:25px}
body:not(.tv) .workerfilters{margin-bottom:14px}
@media(max-width:760px){body:not(.tv) header{min-height:80px!important}body:not(.tv) .shell{padding:14px}body:not(.tv) nav.glass{flex-wrap:wrap}body:not(.tv) nav .tabs{width:100%}body:not(.tv) nav .actions{width:100%;justify-content:flex-end}}
#incInfo{width:min(620px,calc(100vw - 28px));max-width:620px;max-height:min(84vh,850px);overflow:auto;padding:24px;border-radius:24px;color:#263348}
#incInfo .inc-info-top{display:flex;justify-content:space-between;gap:15px;align-items:start}
#incInfo .inc-kicker{font-size:10px;color:#74839a;letter-spacing:.13em;font-weight:800}
#incInfo h2{font-size:27px;margin:6px 0 3px}
#incInfo .inc-info-top p{font-size:12px;margin:0}
#incInfo .inc-info-topright{display:flex;align-items:center;gap:12px}
#incInfo .inc-version{background:#eaf4ff;color:#0876d9;padding:7px 9px;border-radius:10px;font-weight:700;font-size:12px}
#incInfoClose{padding:8px 12px}
#incInfo .inc-info-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;background:#f0f3f8;padding:4px;border-radius:13px;margin:22px 0 18px}
#incInfo .inc-info-tabs button{border:0;background:transparent;border-radius:10px;padding:10px 6px;font-size:13px}
#incInfo .inc-info-tabs button[aria-selected=true]{background:white;box-shadow:0 2px 8px #1f29370d;color:#0876d9}
#incInfo .inc-info-section{font-size:13px}
#incInfo .inc-info-section h3{font-size:14px;margin:20px 0 10px}
#incInfo .inc-info-section h3:first-child{margin-top:0}
#incInfo .inc-info-section p{font-size:12px;color:#506178;line-height:1.6;margin:9px 0}
#incInfo .inc-info-item{padding:12px 0;border-bottom:1px solid #e6ebf2;display:flex;justify-content:space-between;gap:15px}
#incInfo .inc-info-item div{display:grid;gap:4px}
#incInfo .inc-info-item small{display:block;font-size:11px;color:#64748b;line-height:1.5}
#incInfo .inc-info-item strong{font-size:13px}
#incInfo .inc-muted{color:#75849a!important}
#incInfo .inc-info-safe{padding:12px 14px;background:#f6f9fc;border-radius:13px;margin:16px 0}
#incInfo .inc-info-safe p{margin:5px 0 0}
#incInfo details{border:1px solid #e6eaf0;border-radius:12px;margin:8px 0;padding:11px 13px}
#incInfo details summary{cursor:pointer;line-height:1.5;font-size:12px}
#incInfo details[open] summary{margin-bottom:9px}
#incInfo .inc-danger-area{margin-top:16px}
#incInfo .inc-danger-area>div{display:flex;gap:8px;flex-wrap:wrap}
#incInfo .inc-danger-area button{padding:8px 11px;font-size:11px;color:#a33535}
`;
document.head.appendChild(workerLayoutStyles);

// A single controller owns TV slideshow across both datasets. Existing import and KPI calculations stay unchanged.
const unifiedTV=(()=>{
 const KEY='incydenty-unified-tv-v1';
 const defaultScreens=[{id:'process:all',enabled:true,seconds:20},{id:'workers',enabled:true,seconds:30}];
 let config={screens:defaultScreens,layout:'auto',cards:10,mode:'slideshow',fixed:'process:all',autohide:true};
 try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved&&Array.isArray(saved.screens))config={...config,...saved};}catch{}
 // Remove obsolete norms-only screen from previously saved playlists.
 config.screens=(Array.isArray(config.screens)?config.screens:defaultScreens).filter(x=>x&&x.id!=='process:norms');
 if(config.fixed==='process:norms')config.fixed='process:all';
 let draft=[],running=false,pausedUnified=false,activeId='',screenCursor=0,cycleTimer=null,pageTimer=null,controlsTimer=null,savedProcess=null,currentSec=20,fitWarning='';
 const isProcess=id=>id.startsWith('process:');
 const availableScreens=()=>[
   {id:'process:all',name:'Wyniki procesów',description:'Wszystkie procesy razem',available:!!data.sections.length},
   ...data.sections.map(s=>({id:'process:'+s.name,name:processLabel(s.name),description:'Wyniki jednego procesu',available:true})),
   {id:'workers',name:'Karty pracowników',description:'Wszystkie procesy każdego pracownika',available:!!filtered().length}
 ];
 const screenName=id=>availableScreens().find(x=>x.id===id)?.name||id;
 function normalizeScreens(){
   const valid=availableScreens();const entries=Array.isArray(config.screens)?config.screens:[];
   const map=new Map(entries.filter(x=>x&&typeof x.id==='string').map(x=>[x.id,x]));
   const ordered=[...entries.map(x=>valid.find(v=>v.id===x?.id)).filter(Boolean),...valid.filter(x=>!map.has(x.id))];
   return ordered.map(x=>({id:x.id,enabled:x.available&&!!(map.get(x.id)?.enabled??(x.id==='workers'||x.id==='process:all')),seconds:[10,15,20,30,60].includes(Number(map.get(x.id)?.seconds))?Number(map.get(x.id).seconds):20,available:x.available,name:x.name,description:x.description}));
 }
 const dialog=document.createElement('dialog');dialog.id='unifiedTVdialog';dialog.setAttribute('aria-labelledby','unifiedTVtitle');
 dialog.innerHTML=`<div class="confighead"><div><div class="eyebrow">INCYDENTY · WYŚWIETLANIE</div><h2 id="unifiedTVtitle">Ustawienia TV</h2></div><button type="button" id="unifiedTVclose" aria-label="Zamknij">✕</button></div>
 <h3>Ekrany pokazu <small id="unifiedTVcount"></small></h3><p class="confighelp">Wybierz ekrany, ich kolejność i czas wyświetlania. Każda zakładka korzysta ze swoich danych.</p><div id="unifiedTVscreens" class="unified-screens"></div>
 <div class="unified-controls"><div class="unified-group"><h3>Rozmieszczenie kart pracowników</h3><label class="unified-layout-option"><input type="radio" name="utLayout" value="auto"><span><b>Automatycznie</b><small>Dopasuj do rozmiaru ekranu</small></span></label><label class="unified-layout-option"><input type="radio" name="utLayout" value="manual"><span><b>Ręcznie</b><small>Wybierz liczbę kart</small></span></label><div id="unifiedTVmanual" class="unified-counts" role="radiogroup" aria-label="Liczba kart na ekranie" hidden>${[5,10,15,20].map(n=>`<label><input type="radio" name="utCount" value="${n}"><span>${n}</span></label>`).join('')}</div><p class="confighelp">Zawsze pokazujemy wszystkie procesy pracownika. Przy małej wysokości więcej kart może wymagać mniejszej czcionki lub nie zmieścić się w całości.</p></div>
 <div class="unified-group"><h3>Zmiana ekranów</h3><label><input type="radio" name="utMode" value="slideshow"> Automatyczny pokaz</label><label><input type="radio" name="utMode" value="fixed"> Jeden stały ekran</label><label id="unifiedFixedLabel" hidden>Stały ekran <select id="unifiedFixed"></select></label><label><input type="checkbox" id="unifiedHide"> Ukrywaj sterowanie po 3 sekundach</label></div></div>
 <p id="unifiedTVerror" role="alert" hidden></p><div class="configfoot"><span>Ustawienia zostaną zapisane w tej przeglądarce.</span><button type="button" class="primary" id="unifiedTVstart">Uruchom pokaz</button></div>`;
 document.body.append(dialog);
 const bar=document.createElement('div');bar.id='unifiedTVbar';bar.hidden=true;bar.innerHTML='<span id="unifiedTVstatus"></span><button type="button" id="unifiedTVsettings">⚙ Ustawienia</button><button type="button" id="unifiedTVpause">Ⅱ Wstrzymaj</button><button type="button" id="unifiedTVnext">Następny →</button><button type="button" id="unifiedTVexit">Zakończ ✕</button>';document.body.append(bar);
 const u=id=>document.getElementById(id);
 const selectedScreens=()=>config.screens.filter(x=>x.enabled&&availableScreens().find(z=>z.id===x.id&&z.available));
 function drawScreens(){const wrap=u('unifiedTVscreens');wrap.replaceChildren();draft.forEach((screen,i)=>{
   const row=document.createElement('div');row.className='unified-screen';row.innerHTML=`<label class="unified-screen-main"><input type="checkbox" ${screen.enabled?'checked':''} ${screen.available?'':'disabled'}><span><b>${safe(screen.name)}</b><small>${safe(screen.available?screen.description:'Brak danych do wyświetlenia')}</small></span></label><div class="unified-screen-actions"><select aria-label="Czas wyświetlania ${safe(screen.name)}" ${screen.enabled?'':'disabled'}>${[10,15,20,30,60].map(n=>`<option value="${n}" ${screen.seconds===n?'selected':''}>${n} s</option>`).join('')}</select><button type="button" aria-label="Przesuń w górę" ${i===0?'disabled':''}>↑</button><button type="button" aria-label="Przesuń w dół" ${i===draft.length-1?'disabled':''}>↓</button></div>`;
   row.querySelector('input').onchange=e=>{screen.enabled=e.target.checked;drawScreens()};
   row.querySelector('select').onchange=e=>{screen.seconds=Number(e.target.value)};
   const buttons=row.querySelectorAll('button');buttons[0].onclick=()=>move(i,-1);buttons[1].onclick=()=>move(i,1);wrap.append(row);
 });u('unifiedTVcount').textContent=draft.filter(x=>x.enabled&&x.available).length+' aktywne';}
 function move(i,dir){const j=i+dir;if(j<0||j>=draft.length)return;[draft[i],draft[j]]=[draft[j],draft[i]];drawScreens()}
 function modeUpdate(){u('unifiedTVmanual').hidden=dialog.querySelector('input[name="utLayout"]:checked')?.value!=='manual';u('unifiedFixedLabel').hidden=dialog.querySelector('input[name="utMode"]:checked')?.value!=='fixed'}
 function open(){
   if(running)clearTimeout(cycleTimer);
   draft=normalizeScreens();drawScreens();
   dialog.querySelector(`input[name="utLayout"][value="${config.layout==='manual'?'manual':'auto'}"]`).checked=true;
   dialog.querySelector(`input[name="utCount"][value="${[5,10,15,20].includes(config.cards)?config.cards:10}"]`).checked=true;
   dialog.querySelector(`input[name="utMode"][value="${config.mode==='fixed'?'fixed':'slideshow'}"]`).checked=true;
   u('unifiedFixed').replaceChildren(...draft.filter(x=>x.available).map(x=>{const o=document.createElement('option');o.value=x.id;o.textContent=x.name;return o}));
   u('unifiedFixed').value=draft.some(x=>x.id===config.fixed&&x.available)?config.fixed:draft.find(x=>x.available)?.id;
   u('unifiedHide').checked=config.autohide!==false;u('unifiedTVerror').hidden=true;u('unifiedTVstart').textContent=running?'Zastosuj i kontynuuj':'Uruchom pokaz';modeUpdate();clearTimeout(controlsTimer);dialog.showModal();
 }
 const processRender=()=>window.render();
 function show(id,reset=true){
   activeId=id;fitWarning='';clearInterval(pageTimer);
   // Reserve the TV geometry BEFORE measuring cards, not after rendering them.
   document.body.classList.add('tv','unified-tv');
   document.documentElement.scrollTop=0;document.body.scrollTop=0;
   window.scrollTo(0,0);
   if(isProcess(id)){
     monthlyTV=false;cancelAnimationFrame(raf);clearInterval(timer);q('workerArea').hidden=true;q('norms').hidden=false;q('workerTVbar').hidden=true;
     q('processView').classList.add('active');q('workerView').classList.remove('active');
     document.body.classList.remove('monthly-tv');tv=true;
     if(!savedProcess)savedProcess={onlynorms:q('onlynorms').checked,density:tvConfig.density,mode:tvConfig.mode};
     q('onlynorms').checked=false;tvConfig.mode='fixed';tvConfig.density='auto';
     window.selectScreen(id==='process:all'?'all':id.slice(8));
     pageTimer=setInterval(()=>{if(!pausedUnified&&running&&!dialog.open&&isProcess(activeId))window.tick()},Math.max(4000,Math.min(10000,currentSec*500)));
   }else{
     tv=false;document.body.removeAttribute('data-tv-density');cancelAnimationFrame(layoutFrame);
     q('norms').hidden=true;q('workerArea').hidden=false;q('processView').classList.remove('active');q('workerView').classList.add('active');
     active=true;monthlyTV=true;clearInterval(timer);q('workerTVbar').hidden=true;index=reset?0:index;
     settings.layout=config.layout;settings.cards=config.cards;
     document.body.classList.add('monthly-tv');renderTV();
     requestAnimationFrame(checkManualFit);
   }
   u('unifiedTVbar').hidden=false;updateStatus();
 }
 function checkManualFit(){if(!running||activeId!=='workers')return;measure();}

 function updateStatus(){const screens=selectedScreens(),screenNo=Math.max(0,screens.findIndex(x=>x.id===activeId))+1;
   u('unifiedTVstatus').textContent=`${screenName(activeId)} · ${screenNo} / ${screens.length}${pausedUnified?' · Pauza':''}${fitWarning?' · '+fitWarning:''}`;
   u('unifiedTVpause').textContent=pausedUnified?'▶ Wznów':'Ⅱ Wstrzymaj';}
 function schedule(){clearTimeout(cycleTimer);if(!running||pausedUnified||config.mode==='fixed'||dialog.open)return;
   const sec=Math.max(10,currentSec);cycleTimer=setTimeout(()=>advance(),sec*1000);
 }
 function advance(){if(!running)return;const screens=selectedScreens();if(!screens.length){stop();return}
   if(activeId==='workers'&&index+effectiveCards<filtered().length){index+=effectiveCards;show('workers',false);schedule();return}
   screenCursor=(screenCursor+1)%screens.length;const screen=screens[screenCursor];currentSec=screen.seconds;show(screen.id);schedule();}
 function start(){const enabled=draft.filter(x=>x.enabled&&x.available);
   if(!enabled.length){u('unifiedTVerror').textContent='Wybierz co najmniej jeden ekran z wczytanymi danymi.';u('unifiedTVerror').hidden=false;return}
   config={screens:draft.map(x=>({id:x.id,enabled:x.enabled,seconds:x.seconds})),layout:dialog.querySelector('input[name="utLayout"]:checked').value,cards:Number(dialog.querySelector('input[name="utCount"]:checked').value),mode:dialog.querySelector('input[name="utMode"]:checked').value,fixed:u('unifiedFixed').value,autohide:u('unifiedHide').checked};
   try{localStorage.setItem(KEY,JSON.stringify(config))}catch{}
   dialog.close();running=true;pausedUnified=false;screenCursor=0;
   const screens=selectedScreens();const fixedScreen=screens.find(x=>x.id===config.fixed)||screens[0];const selected=config.mode==='fixed'?fixedScreen:screens[0];screenCursor=screens.findIndex(x=>x.id===selected.id);currentSec=selected.seconds;
   q('workerTVbar').hidden=true;document.querySelector('.tvbar').hidden=true;
   window.scrollTo(0,0);show(selected.id);u('unifiedTVnext').disabled=config.mode==='fixed';schedule();revealControls();
   if(!document.fullscreenElement)document.documentElement.requestFullscreen?.().catch(()=>{});
 }
 function revealControls(){if(!running)return;const el=u('unifiedTVbar');el.classList.remove('controls-hidden');clearTimeout(controlsTimer);if(config.autohide&&!dialog.open)controlsTimer=setTimeout(()=>{if(!el.contains(document.activeElement))el.classList.add('controls-hidden')},3000)}
 function stop(skipFullscreen=false){if(!running)return;
   running=false;pausedUnified=false;clearTimeout(cycleTimer);clearInterval(pageTimer);clearTimeout(controlsTimer);clearInterval(timer);cancelAnimationFrame(raf);cancelAnimationFrame(layoutFrame);
   monthlyTV=false;tv=false;document.body.classList.remove('tv','monthly-tv','unified-tv','cursor-hidden');document.body.removeAttribute('data-tv-density');
   u('unifiedTVbar').hidden=true;document.querySelector('.tvbar').hidden=true;q('workerTVbar').hidden=true;
   if(savedProcess){q('onlynorms').checked=false;tvConfig.density=savedProcess.density;tvConfig.mode=savedProcess.mode;savedProcess=null}
   if(activeId==='workers'){q('norms').hidden=true;q('workerArea').hidden=false;active=true;q('upload').textContent='📥 Pliki pracowników';render()}
   else{q('norms').hidden=false;q('workerArea').hidden=true;active=false;q('upload').textContent='📥 Wczytaj Excel';processRender()}
   if(!skipFullscreen&&document.fullscreenElement)document.exitFullscreen().catch(()=>{});
 }
 q('tv').onclick=open;q('tvsettings').onclick=open;q('workerTVsettings').onclick=open;
 u('unifiedTVclose').onclick=()=>dialog.close();u('unifiedTVstart').onclick=start;u('unifiedTVsettings').onclick=open;
 u('unifiedTVexit').onclick=()=>stop();u('unifiedTVnext').onclick=()=>{if(config.mode==='fixed')return;advance();};
 u('unifiedTVpause').onclick=()=>{pausedUnified=!pausedUnified;if(pausedUnified)clearTimeout(cycleTimer);else schedule();updateStatus();revealControls()};
 dialog.querySelectorAll('input[name="utLayout"],input[name="utMode"]').forEach(el=>el.addEventListener('change',modeUpdate));
 dialog.addEventListener('close',()=>{if(running){schedule();revealControls()}});
 ['pointermove','pointerdown','touchstart'].forEach(event=>document.addEventListener(event,revealControls,{passive:true}));
 document.addEventListener('keydown',event=>{if(!running)return;if(event.key==='Escape'&&!dialog.open){event.stopImmediatePropagation();event.preventDefault();stop()}},true);
 document.addEventListener('fullscreenchange',()=>{if(running&&!document.fullscreenElement)stop(true)},true);
 // Preserve the single controller even when the user changes tabs during fullscreen.
 q('processView').addEventListener('click',event=>{if(running){event.stopImmediatePropagation();event.preventDefault();show('process:all')}},true);
 q('workerView').addEventListener('click',event=>{if(running){event.stopImmediatePropagation();event.preventDefault();show('workers')}},true);
 const css=document.createElement('style');css.textContent=`
 #unifiedTVdialog{width:min(760px,calc(100vw - 28px));max-width:760px;max-height:min(90vh,920px);overflow:auto;padding:25px}
 #unifiedTVdialog h3{font-size:15px;margin:15px 0 8px;color:#293a51}
 #unifiedTVdialog h3 small{font-weight:500;font-size:11px;color:#7d8aa0;margin-left:8px}
 #unifiedTVdialog .unified-screens{display:grid;gap:8px;max-height:260px;overflow:auto}
 #unifiedTVdialog .unified-screen{display:flex;justify-content:space-between;align-items:center;gap:12px;border:1px solid #dfe7f0;border-radius:15px;padding:10px 12px;background:#fafcff}
 #unifiedTVdialog .unified-screen-main{display:flex;gap:10px;min-width:0;flex:1}
 #unifiedTVdialog .unified-screen-main>span{display:grid;gap:4px;min-width:0}
 #unifiedTVdialog .unified-screen-main b{font-size:13px;color:#26374b}
 #unifiedTVdialog .unified-screen-main small{font-size:11px;color:#728197}
 #unifiedTVdialog .unified-screen-actions{display:flex;align-items:center;gap:4px}
 #unifiedTVdialog .unified-screen-actions select{border:1px solid #dbe3ef;background:#fff;padding:6px 8px;border-radius:9px;max-width:none;font-size:12px}
 #unifiedTVdialog .unified-screen-actions button{padding:6px 10px;border-radius:9px}
 #unifiedTVdialog .unified-controls{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px}
 #unifiedTVdialog .unified-group{background:#f7f9fd;border:1px solid #e6ebf3;border-radius:16px;padding:14px}
 #unifiedTVdialog .unified-group h3{margin:0 0 12px}
 #unifiedTVdialog .unified-group>label{display:flex;gap:8px;font-size:12px;color:#435268;margin:10px 0}
 #unifiedTVdialog .unified-group>label select{border:1px solid #dbe3ef;padding:6px;border-radius:8px;max-width:175px}
 #unifiedTVdialog .unified-layout-option{display:flex;align-items:center;gap:10px;width:100%;min-width:0;padding:10px 11px;margin:5px 0;border:1px solid #dfe6f1;border-radius:13px;background:#fff;cursor:pointer}
 #unifiedTVdialog .unified-layout-option:has(input:checked){background:#eff6ff;border-color:#8bbfff}
 #unifiedTVdialog .unified-layout-option>span{display:flex;flex-direction:column;gap:3px;min-width:0}
 #unifiedTVdialog .unified-layout-option b{font-size:12px;color:#304257}
 #unifiedTVdialog .unified-layout-option small{font-size:11px;color:#718096;line-height:1.3}
 #unifiedTVdialog .unified-counts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;width:100%;margin:10px 0 4px}
 #unifiedTVdialog .unified-counts label{display:block!important;position:relative;width:100%;min-width:0;margin:0;cursor:pointer}
 #unifiedTVdialog .unified-counts input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
 #unifiedTVdialog .unified-counts span{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;min-height:42px;text-align:center;padding:10px 5px;background:white;border:1px solid #dce4ed;border-radius:12px;font-size:14px;color:#3c4c62;font-weight:650;transition:background .15s,border-color .15s}
 #unifiedTVdialog .unified-counts label:hover span{border-color:#9ac7fa;background:#f5f9ff}
 #unifiedTVdialog .unified-counts input:checked+span{border-color:#66aaff;background:#e8f3ff;color:#0876d9;font-weight:750;box-shadow:0 0 0 1px #66aaff30}
 #unifiedTVdialog .unified-counts input:focus-visible+span{outline:3px solid #0a84ff;outline-offset:2px}
 #unifiedTVdialog #unifiedTVerror{color:#b94136;font-size:12px}
 #unifiedTVbar{position:fixed;z-index:200;bottom:12px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;background:#fffffff0;border:1px solid #e0e6f0;border-radius:999px;padding:8px 12px;box-shadow:0 7px 26px #0002;transition:opacity .2s;white-space:nowrap}
 #unifiedTVbar button{padding:7px 12px;font-size:12px}
 #unifiedTVbar span{font-size:12px;color:#53647c}
 #unifiedTVbar.controls-hidden{opacity:0;pointer-events:none}
 body.unified-tv #resultViews,body.unified-tv .workerfilters,body.unified-tv .workerheading>button{display:none!important}
 body.unified-tv #norms #cards .card{min-height:0}
 body.unified-tv #norms:not(.focused) #cards .norm{margin:8px 0 10px!important;padding-bottom:10px!important}
 body.unified-tv #norms:not(.focused) #cards .card{padding:clamp(12px,1.0vw,22px)}
 body.unified-tv #norms:not(.focused) #cards .processname{font-size:clamp(15px,1.1vw,23px)}
 body.unified-tv #norms:not(.focused) #cards .worker{padding:4px 0!important}
 @media(max-width:700px){#unifiedTVdialog .unified-controls{grid-template-columns:1fr}#unifiedTVbar span{display:none}#unifiedTVbar{gap:3px}#unifiedTVbar button{padding:7px 9px;font-size:11px}}
 `;document.head.append(css);
 return {open,stop,get running(){return running}};
})();


// Gentle entrance on card replacement, without changing measurements, data or TV timers.
const cardMotionStyle=document.createElement('style');
cardMotionStyle.id='incydenty-card-motion';
cardMotionStyle.textContent=`
@keyframes incCloudRise{
  from{opacity:0;transform:translate3d(0,26px,0)}
  to{opacity:1;transform:translate3d(0,0,0)}
}
/* Only opacity and transform animate: no expensive full-card blur repaint on TV. */
#cards > .card,
#workerCards > .employee-card{
  animation:incCloudRise .68s cubic-bezier(.20,.75,.22,1) both;
}
#cards > .card:nth-child(2),#workerCards > .employee-card:nth-child(2){animation-delay:55ms}
#cards > .card:nth-child(3),#workerCards > .employee-card:nth-child(3){animation-delay:110ms}
#cards > .card:nth-child(4),#workerCards > .employee-card:nth-child(4){animation-delay:165ms}
#cards > .card:nth-child(5),#workerCards > .employee-card:nth-child(5){animation-delay:220ms}
#workerCards > .employee-card:nth-child(6){animation-delay:220ms}
#workerCards > .employee-card:nth-child(7){animation-delay:220ms}
#workerCards > .employee-card:nth-child(8){animation-delay:220ms}
#workerCards > .employee-card:nth-child(9){animation-delay:220ms}
#workerCards > .employee-card:nth-child(n+10){animation-delay:220ms}
/* Dialogs appear gently but never move under a pointer or during editing. */
#incInfo[open],#unifiedTVdialog[open]{animation:incDialogReveal .28s ease-out both}
@keyframes incDialogReveal{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@media(prefers-reduced-motion:reduce){
  #cards > .card,#workerCards > .employee-card,#incInfo[open],#unifiedTVdialog[open]{animation:none!important}
}
`;
document.head.appendChild(cardMotionStyle);
// TV viewport repair: never preserve an ordinary-page scroll offset in fullscreen.
const tvViewportRepair=document.createElement('style');
tvViewportRepair.id='incydenty-tv-viewport-repair';
tvViewportRepair.textContent=`
body.tv .shell{max-width:none!important;width:100%!important;min-height:100vh;min-height:100dvh;padding-top:clamp(12px,1.3vh,28px)!important;padding-left:clamp(16px,2vw,52px)!important;padding-right:clamp(16px,2vw,52px)!important}
body.tv header{min-height:clamp(72px,10vh,124px)!important}
body.tv #workerArea,body.tv #norms{min-width:0}
body.tv .workercards.cards-tv-grid{grid-template-columns:repeat(var(--tv-worker-cols,5),minmax(0,1fr))!important;width:100%;align-items:start}
body.tv #cards{width:100%;min-width:0}
body.tv #cards .card{min-width:0}
body.tv .workerheading{margin-top:6px!important;margin-bottom:clamp(8px,1.2vh,22px)!important}
body.tv .titlebar{margin-top:clamp(4px,.9vh,16px)!important;margin-bottom:clamp(8px,1.2vh,24px)!important}
body.tv .reportperiod{margin-bottom:clamp(8px,1.2vh,20px)!important}
`;
document.head.appendChild(tvViewportRepair);


updatePeriods();render();
})();
