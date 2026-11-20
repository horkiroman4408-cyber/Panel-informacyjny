'use strict';
/* Harmonogram pracy: staff-first roster tables with absence column, Excel import and TV pages. */
(()=>{
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='incydenty-schedule-v1';let plans={};try{const v=JSON.parse(localStorage.getItem(KEY));if(v&&typeof v==='object')plans=v}catch{}
const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const addDay=(d,n)=>{const v=new Date(d+'T12:00:00');v.setDate(v.getDate()+n);return iso(v)};
const today=()=>iso(new Date()),formatDate=d=>d?.split('-').reverse().join('.')||'—';
let currentDate=today(),shift='',tv=false,tvDay='today',tvPage=0;
const isLogin=x=>/^(?:PD\d{5,}|\d{6,})$/i.test(String(x??'').trim());
const normalizeShift=s=>{s=String(s||'').trim().replace(/\s+/g,' ');if(/^A\s*\/\s*B$/i.test(s))return 'Zmiana A/B';if(/^II$/i.test(s))return 'Zmiana II';if(/^I$/i.test(s))return 'Zmiana I';return s||'Nieokreślona'};
function details(rows,name){
 const texts=rows.slice(0,6).flat().map(x=>String(x??'')).concat(name);
 let date='';for(const t of texts){const m=t.match(/\b(\d{1,2})[.\/\-](\d{1,2})[.\/\-](20\d{2})\b/);if(m){const d=`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;if(!Number.isNaN(new Date(d+'T12:00:00').getTime())&&new Date(d+'T12:00:00').getDate()===Number(m[1])){date=d;break}}}
 let sh='';for(const t of texts){const m=t.match(/\bZMIANA\s*(A\s*\/\s*B|II|I)\b/i)||t.match(/\b(II|I)\s+ZMIANA\b/i);if(m){sh=normalizeShift(m[1]);break}}
 if(!date)throw Error('Nie znaleziono daty. Wpisz datę w nagłówku lub nazwie pliku.');
 return {date,shift:sh||'Nieokreślona'};
}
function parse(rows,name){
 const d=details(rows,name),tables=[],byColumn=new Map(),people=[],absence=[];
 const kindName=v=>String(v??'').trim().replace(/\s+/g,' ');
 function headerFor(col,firstRow){
  for(let k=firstRow-1;k>=Math.max(0,firstRow-7);k--){
   const text=kindName(rows[k]?.[col]);
   if(/^(AGENCJA|LPP|WOLNE I URLOPY|NIEOBECNI|PRACOWNICY)$/i.test(text))return text;
  }
  return 'Pracownicy';
 }
 for(let i=0;i<rows.length;i++){
  const row=rows[i].map(v=>String(v??'').trim());
  for(let j=0;j<row.length-1;j++){
   if(!isLogin(row[j])||!row[j+1])continue;
   let table=byColumn.get(j);
   if(!table){
    const title=headerFor(j,i),abs=/^(WOLNE I URLOPY|NIEOBECNI)$/i.test(title);
    table={name:title,kind:abs?'absence':'team',column:j,entries:[]};
    byColumn.set(j,table);tables.push(table);
   }
   const login=row[j].toUpperCase(),raw=row[j+1].replace(/\r/g,'').trim();
   const values=raw.split(/\n|\s*;\s*/).map(x=>x.trim()).filter(Boolean);
   const inferredAbs=/^(WOLNY|WOLNE|URLOP|URLOPY|W DOMU|NIEOBECNY|ZWOLNIENIE|L4)$/i.test(raw);
   if(inferredAbs&&table.entries.length===0&&table.kind==='team'){table.kind='absence';if(table.name==='Pracownicy')table.name='Nieobecni'}
   const existing=table.entries.find(x=>x.login===login);
   if(existing){for(const value of values)if(!existing.processes.includes(value))existing.processes.push(value)}
   else table.entries.push({login,processes:values});
  }
 }
 if(!tables.length)throw Error('Brak par Login TH / Proces. Sprawdź arkusz STAN lub Arkusz1.');
 for(const table of tables)for(const entry of table.entries){
  const str=entry.processes.join('\n');
  if(table.kind==='absence')absence.push({login:entry.login,status:str,team:table.name});
  else people.push({login:entry.login,process:str,team:table.name});
 }
 return {...d,tables,people,absence,source:name,importedAt:new Date().toISOString()};
}
const key=(d,s)=>d+'|'+s;
function dates(){return [...new Set(Object.values(plans).map(x=>x.date))].sort((a,b)=>b.localeCompare(a))}
function shifts(d){return Object.values(plans).filter(x=>x.date===d).map(x=>x.shift).sort((a,b)=>a.localeCompare(b,'pl'))}
function selectedPlan(){const items=shifts(currentDate);if(!items.includes(shift))shift=items[0]||'';return plans[key(currentDate,shift)]||null}
function groups(plan){const m=new Map();for(const p of plan?.people||[]){if(!m.has(p.process))m.set(p.process,[]);m.get(p.process).push(p.login)}return [...m].sort((a,b)=>a[0].localeCompare(b[0],'pl')).map(([name,people])=>({name,people:people.sort()}))}
function workerRows(plan){
 const byLogin=new Map();
 for(const p of plan?.people||[]){
  const login=String(p.login||'').trim().toUpperCase();
  if(!login)continue;
  if(!byLogin.has(login))byLogin.set(login,{login,processes:[]});
  const record=byLogin.get(login);
  for(const part of String(p.process||'').split(/\r?\n|\s*;\s*/).map(x=>x.trim()).filter(Boolean)){
   if(!record.processes.includes(part))record.processes.push(part);
  }
 }
 return [...byLogin.values()];
}
function absenceRows(plan){
 const byLogin=new Map();
 for(const p of plan?.absence||[]){
  const login=String(p.login||'').trim().toUpperCase();
  if(!login)continue;
  if(!byLogin.has(login))byLogin.set(login,{login,statuses:[]});
  const item=byLogin.get(login);
  for(const part of String(p.status||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean)){
   if(!item.statuses.includes(part))item.statuses.push(part);
  }
 }
 return [...byLogin.values()];
}
function rosterTable(title,meta,rows,absence=false,plan=null){
 const disabled=!!(plan&&!tv&&isHidden(plan,title));
 const teamEye=plan&&!tv?`<button type="button" class="schedule-eye schedule-team-eye" data-eye-team="${esc(title)}" aria-label="${disabled?'Pokaż':'Ukryj'} zespół ${esc(title)} w TV" title="${disabled?'Pokaż':'Ukryj'} zespół w TV">${disabled?'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3 21 21M10.5 5.7A10 10 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a16 16 0 0 1-3.3 4.1M6.2 6.5C3.6 8.2 2 12 2 12s3.6 6.5 10 6.5c1.3 0 2.5-.3 3.6-.8"/><path d="M10 10a3 3 0 0 0 4 4"/></svg>':'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>'}</button>`:'';
 const rendered=rows.length?rows.map(p=>{
   const hidden=!!(plan&&!tv&&isHidden(plan,title,p.login));
   const ownHidden=!!(plan&&!tv&&(visibility(plan).logins||[]).includes(p.login));
   const eye=plan&&!tv?`<button type="button" class="schedule-eye schedule-person-eye${hidden?' is-off':''}" data-eye-login="${esc(p.login)}" data-eye-team="${esc(title)}" aria-label="${ownHidden?'Pokaż':'Ukryj'} ${esc(p.login)} w TV" title="${ownHidden?'Pokaż':'Ukryj'} w TV">${ownHidden?'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3 21 21M10.5 5.7A10 10 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a16 16 0 0 1-3.3 4.1M6.2 6.5C3.6 8.2 2 12 2 12s3.6 6.5 10 6.5c1.3 0 2.5-.3 3.6-.8"/><path d="M10 10a3 3 0 0 0 4 4"/></svg>':'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>'}</button>`:'';
   return `<div class="schedule-person-row${hidden?' schedule-muted':''}"><div class="schedule-person-login">${esc(p.login)}</div><div class="schedule-person-assignment">${(absence?p.statuses:p.processes).map(x=>`<span>${esc(x)}</span>`).join('')}</div>${eye}</div>`
 }).join(''):`<div class="schedule-person-empty">Brak ${absence?'nieobecności':'przydziałów'}</div>`;
 return `<section class="schedule-roster-panel${absence?' schedule-roster-absence':''}${disabled?' schedule-team-muted':''}"><div class="schedule-roster-panel-head"><strong>${esc(title)}</strong><div class="schedule-head-actions">${meta?`<span>${esc(meta)}</span>`:''}${teamEye}</div></div><div class="schedule-person-list">${rendered}</div></section>`;
}
// New imports keep the Excel column groups. Older locally stored plans remain
// readable, but need reimporting to recover their original team boundaries.
function planTables(plan){
 if(Array.isArray(plan?.tables)&&plan.tables.length)return plan.tables;
 if(!plan)return [];
 const working=workerRows(plan),missing=absenceRows(plan);
 return [working.length?{name:plan.team||'Pracownicy',kind:'team',entries:working}:null,
         missing.length?{name:'Nieobecni',kind:'absence',entries:missing.map(x=>({login:x.login,processes:x.statuses}))}:null].filter(Boolean);
}
const EYE_KEY='incydenty-schedule-tv-visibility-v1';
let eyeFilters={};try{const saved=JSON.parse(localStorage.getItem(EYE_KEY));if(saved&&typeof saved==='object'&&!Array.isArray(saved))eyeFilters=saved}catch{}
function visibility(plan){return eyeFilters[key(plan.date,plan.shift)]||{teams:[],logins:[]}}
function isHidden(plan,team,login){const f=visibility(plan);return (f.teams||[]).includes(team)||(login&&(f.logins||[]).includes(login))}
function toggleVisibility(plan,team,login){
 const planKey=key(plan.date,plan.shift),f=visibility(plan),field=login?'logins':'teams',value=login||team,values=new Set(f[field]||[]);
 if(values.has(value))values.delete(value);else values.add(value);
 eyeFilters[planKey]={...f,[field]:[...values]};
 try{localStorage.setItem(EYE_KEY,JSON.stringify(eyeFilters))}catch{status('Nie udało się zapisać ustawień widoczności TV.')}
 render();
}
function tvTables(plan){
 const filter=visibility(plan);const excludedTeams=new Set(filter.teams||[]),excludedLogins=new Set(filter.logins||[]);
 return planTables(plan).filter(t=>!excludedTeams.has(t.name)).map(t=>({...t,entries:t.entries.filter(x=>!excludedLogins.has(x.login))})).filter(t=>t.entries.length);
}
function rosterView(plan,tables,dateText){
 const contents=tables.map(t=>rosterTable(t.name,t.hours||'',t.entries.map(p=>({login:p.login,processes:p.processes,statuses:p.processes})),t.kind==='absence',tv?null:plan)).join('');
 return `<div class="schedule-sheet"><div class="schedule-sheet-head"><strong>INCYDENTY</strong><h3>STAN · ${esc(dateText)}</h3><div class="schedule-sheet-line"></div></div><div class="schedule-roster-grid${tables.length===1?' schedule-roster-single':''}">${contents||'<div class="schedule-person-empty">Brak osób dla wybranego filtra TV.</div>'}</div></div>`;
}


// Workspace: the Excel files remain local and the two sources are independent.
const BOARD_KEY='incydenty-schedule-widgets-v2';
const BREAK_KEY='incydenty-breaks-v1';
const TOMORROW_KEY='incydenty-tomorrow-plan-v1';
let board={order:[],widths:{},removed:[],positions:{}};
try{const b=JSON.parse(localStorage.getItem(BOARD_KEY));if(b&&Array.isArray(b.order))board={order:b.order,widths:b.widths||{},removed:Array.isArray(b.removed)?b.removed:[],positions:b.positions&&typeof b.positions==='object'?b.positions:{}}}catch{}
let tomorrow=null;
try{const t=JSON.parse(localStorage.getItem(TOMORROW_KEY));if(t&&Array.isArray(t.tables))tomorrow=t}catch{}
let breaks=null;
try{const b=JSON.parse(localStorage.getItem(BREAK_KEY));if(b&&(Array.isArray(b.rows)||Array.isArray(b.shifts)))breaks=b}catch{}
// Historical local plans are preserved, but never silently treated as tomorrow's upload.
const section=$('assign');section.className='schedule-area schedule-workspace';
section.innerHTML=`
<div class="schedule-board-top"><div><div class="eyebrow">INCYDENTY · PLAN OBSADY</div><h2>Harmonogram pracy</h2><div id="scheduleTVPlanDate" class="schedule-tv-plan-date" hidden></div><p>Wczytaj dwa źródła i ułóż widżety tak, jak mają wyglądać na TV.</p></div><button id="scheduleResetLayout" type="button" title="Przywróć szerokości i kolejność">↺ Przywróć układ</button></div>
<div class="schedule-drop-grid">
 <div class="schedule-drop" id="schedulePlanDrop" role="button" tabindex="0" aria-label="Wczytaj grafik na jutro"><span class="schedule-drop-icon">📅</span><div><strong>Grafik na jutro</strong><small id="schedulePlanSource">Przeciągnij Excel lub kliknij, aby wybrać plik</small></div><span class="schedule-drop-action">Wczytaj</span></div>
 <div class="schedule-drop" id="scheduleBreakDrop" role="button" tabindex="0" aria-label="Wczytaj przerwy"><span class="schedule-drop-icon">☕</span><div><strong>Przerwy</strong><small id="scheduleBreakSource">Przeciągnij Excel lub kliknij, aby wybrać plik</small></div><span class="schedule-drop-action">Wczytaj</span></div>
</div>
<input id="schedulePlanFile" type="file" accept=".xlsx" hidden><input id="scheduleBreakFile" type="file" accept=".xlsx" hidden>
<div class="schedule-board-info"><span>Układ TV · przesuń widżet za <b>⠿</b> · zmień szerokość i wysokość, przeciągając prawy dolny róg</span><span id="scheduleBoardStatus" role="status"></span></div>
<div id="scheduleWidgetViewport" class="schedule-widget-viewport"><div id="scheduleWidgetCanvas" class="schedule-widget-canvas" aria-label="Układ widżetów TV"></div></div>`;
$('assignment').textContent='Harmonogram pracy';
const css=document.createElement('style');css.id='schedule-widget-styles';css.textContent=`
.schedule-workspace{min-width:0}.schedule-board-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:26px 0 18px}
.schedule-board-top h2{font-size:clamp(27px,2.5vw,36px);margin:0}.schedule-board-top p{font-size:13px;margin:7px 0 0;color:#738096}
.schedule-board-top>button{font-size:12px;padding:10px 16px;white-space:nowrap}
.schedule-drop-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.schedule-drop{display:flex;align-items:center;gap:15px;min-width:0;min-height:115px;padding:20px;border:1.5px dashed #b6c9d9;border-radius:22px;background:rgba(255,255,255,.68);cursor:pointer;transition:border-color .2s,background .2s,transform .2s}
.schedule-drop:hover,.schedule-drop.is-over{border-color:#2eacac;background:#effaf8;transform:translateY(-2px)}
.schedule-drop-icon{width:45px;height:45px;flex:0 0 auto;border-radius:15px;display:grid;place-items:center;background:#edf6f7;font-size:22px}
.schedule-drop>div{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}.schedule-drop strong{font-size:16px;color:#243b4a}.schedule-drop small{font-size:12px;color:#758597;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.schedule-drop-action{padding:8px 13px;border:1px solid #d1e2e6;border-radius:999px;background:#fff;color:#347e84;font-size:12px;font-weight:700}
.schedule-board-info{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:19px 0 13px;font-size:12px;color:#68798b}
.schedule-widget-viewport{position:relative;width:100%;min-height:160px;overflow:hidden;border-radius:18px}.schedule-widget-canvas{position:relative;width:1200px;min-height:160px;transform-origin:top left;background-image:linear-gradient(to right,#42637e0b 1px,transparent 1px),linear-gradient(to bottom,#42637e0b 1px,transparent 1px);background-size:20px 20px}
.schedule-widget{position:absolute;min-width:0;border:1px solid #d9e3ec;border-radius:17px;overflow:hidden;background:white;box-shadow:0 7px 24px #2b436012;display:flex;flex-direction:column;touch-action:auto}.schedule-widget-body{min-height:0;flex:1}

.schedule-widget-header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 13px;background:#e9eef4;border-bottom:1px solid #d9e3ec;color:#173956}
.schedule-widget-header strong{font-size:14px}.schedule-widget-actions{display:flex;align-items:center;gap:5px}
.schedule-widget-header button{display:grid;place-items:center;border:1px solid transparent;border-radius:9px;background:transparent;color:#64798d;width:29px;height:29px;padding:0;font-size:14px;flex:0 0 auto;box-shadow:none}
.schedule-widget-header button:hover{border-color:#c6d8e3;background:white}
.schedule-widget-handle{cursor:grab!important;font-weight:800;font-size:21px!important;touch-action:none}
.schedule-widget-handle:active{cursor:grabbing!important}.schedule-widget-resize{position:absolute;z-index:6;right:0;bottom:0;width:34px;height:34px;cursor:nwse-resize;touch-action:none;user-select:none;border-radius:0 0 14px 0;background:linear-gradient(135deg,transparent 55%,#90a4b7 55%,#90a4b7 60%,transparent 60%,transparent 69%,#90a4b7 69%,#90a4b7 74%,transparent 74%)}.schedule-widget-resize:hover{background-color:#dff4f3}.schedule-widget.is-interacting{z-index:10;box-shadow:0 14px 34px #173e5f2a;outline:2px solid #43adad}.schedule-widget-blocked{outline:2px solid #d96969!important}
.schedule-widget.dragging{opacity:.32}.schedule-widget.drop-target{outline:3px solid #39b2a5;outline-offset:3px}
.schedule-widget .schedule-person-row{display:grid;grid-template-columns:minmax(92px,33%) minmax(0,1fr) 34px;min-height:42px;border-bottom:1px solid #e2e9f0}
.schedule-widget .schedule-person-row:last-child{border-bottom:0}
.schedule-widget .schedule-person-row:nth-child(even){background:#f3f6fa}
.schedule-widget .schedule-person-login{display:flex;align-items:center;font-size:12px;font-weight:750;color:#213b59;padding:8px 10px;border-right:1px solid #e2e9f0;overflow-wrap:anywhere}
.schedule-widget .schedule-person-assignment{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;text-align:center;font-weight:700;color:#24415b;font-size:11px;line-height:1.35;padding:7px 8px;overflow-wrap:anywhere}
.schedule-widget .schedule-roster-absence .schedule-person-assignment{font-weight:500}
.schedule-widget .schedule-person-eye{align-self:center;justify-self:center;border:0;background:transparent;color:#608196;cursor:pointer;border-radius:8px;padding:4px}
.schedule-widget .schedule-person-eye:hover{background:#e1f2f1}
.schedule-widget .schedule-person-row.schedule-muted{opacity:.37}
.schedule-widget.is-muted{opacity:.52}
.schedule-widget .schedule-break-table{width:100%;border-collapse:collapse;font-size:12px;color:#274158}
.schedule-widget .schedule-break-table th,.schedule-widget .schedule-break-table td{padding:10px 9px;border:1px solid #e1e8ee;text-align:center;overflow-wrap:anywhere}
.schedule-widget .schedule-break-table th{background:#f0f4f7;font-weight:750}
.schedule-widget .schedule-break-table tr:nth-child(even){background:#f7f9fb}
.schedule-widget .schedule-empty{border:0;box-shadow:none;padding:35px 18px;font-size:12px;text-align:center;color:#8897a6;background:transparent}
.schedule-widget .schedule-person-empty{padding:25px;text-align:center;color:#8c9aad}
.schedule-widget-meta{font-size:10px;color:#73869c;font-weight:600;margin-right:4px}
body.unified-tv #assign .schedule-drop-grid,body.unified-tv #assign .schedule-board-info,body.unified-tv #assign .schedule-board-top>button{display:none!important}
body.unified-tv #assign .schedule-board-top{justify-content:center;text-align:center;margin:8px 0 18px}
body.unified-tv #assign .schedule-board-top h2{font-size:clamp(25px,2.4vw,42px)}
body.unified-tv #assign .schedule-tv-plan-date:not([hidden]){display:block;margin:7px 0 0;font-size:clamp(19px,1.65vw,30px);line-height:1.15;font-weight:750;letter-spacing:.015em;color:#294867;font-variant-numeric:tabular-nums}
body.unified-tv #assign .schedule-board-top p,body.unified-tv #assign .schedule-board-top .eyebrow{display:none!important}
body.unified-tv #assign .schedule-widget-header button,body.unified-tv #assign .schedule-person-eye{display:none!important}
body.unified-tv #assign .schedule-widget .schedule-person-row{grid-template-columns:minmax(80px,33%) minmax(0,1fr)}
body.unified-tv #assign .schedule-widget{animation:incCloudRise .68s cubic-bezier(.2,.75,.22,1) both}body.unified-tv #assign .schedule-widget-canvas{background-image:none}
body.unified-tv #assign .schedule-widget .schedule-person-login{font-size:clamp(12px,.8vw,19px)}
body.unified-tv #assign .schedule-widget .schedule-person-assignment{font-size:clamp(11px,.72vw,17px)}
body.unified-tv #assign .schedule-widget-header strong{font-size:clamp(14px,.95vw,22px)}

@media(max-width:700px){.schedule-drop-grid{grid-template-columns:1fr}.schedule-board-top{flex-wrap:wrap}.schedule-board-info{flex-wrap:wrap}}
.schedule-widget-remove{border:0!important;background:transparent!important;color:#8b98aa!important;width:27px;height:27px;padding:0!important;font-size:20px!important;line-height:1!important;border-radius:8px!important}
.schedule-widget-remove:hover{background:#fff0f0!important;color:#c43a40!important}
.schedule-break-shift{margin:0 0 16px;min-width:0}.schedule-break-shift:last-child{margin-bottom:0}
.schedule-break-shift h4{font-size:13px;color:#24425b;background:#edf5f4;border-radius:9px;padding:9px 11px;margin:0 0 8px}
.schedule-break-table{table-layout:fixed}.schedule-break-table th:first-child{width:25%}
.schedule-break-spm{font-size:12px;padding:8px 10px;border-bottom:1px solid #e1e8ee;overflow-wrap:anywhere}
@media(prefers-reduced-motion:reduce){body.unified-tv #assign .schedule-widget{animation:none!important}}
`;document.head.append(css);
const iconEye=(off)=>off?'◌':'◉';
function saveBoard(){try{localStorage.setItem(BOARD_KEY,JSON.stringify(board))}catch{status('Nie udało się zapisać układu.')}}
function status(msg){$('scheduleBoardStatus').textContent=msg}
function sourceLabels(){
 $('schedulePlanSource').textContent=tomorrow?`${tomorrow.source||'Excel'} · ${formatDate(tomorrow.date)} · ${tomorrow.shift}`:'Przeciągnij Excel lub kliknij, aby wybrać plik';
 $('scheduleBreakSource').textContent=breaks?`${breaks.source||'Excel'} · ${(breaks.rows?.length||breaks.shifts?.length||0)} sekcje`:'Przeciągnij Excel lub kliknij, aby wybrać plik';
}
function items(){
 const result=[];
 if(tomorrow)for(const t of planTables(tomorrow)){if(tv&&isHidden(tomorrow,t.name))continue;result.push({id:'team:'+t.name,title:t.name,kind:'team',table:t})}
 if(breaks)result.push({id:'breaks',title:'Przerwy',kind:'breaks'});
 return result;
}
function orderedItems(){const list=items().filter(x=>!board.removed.includes(x.id)),ids=new Set(list.map(x=>x.id));return [...board.order.filter(id=>ids.has(id)),...list.map(x=>x.id).filter(id=>!board.order.includes(id))].map(id=>list.find(x=>x.id===id));}
function teamMarkup(item){const t=item.table,off=isHidden(tomorrow,t.name);
 return (t.entries||[]).filter(entry=>!tv||!isHidden(tomorrow,t.name,entry.login)).map(entry=>{const hidden=isHidden(tomorrow,t.name,entry.login);
 return `<div class="schedule-person-row${hidden?' schedule-muted':''}"><div class="schedule-person-login">${esc(entry.login)}</div><div class="schedule-person-assignment">${entry.processes.map(x=>`<span>${esc(x)}</span>`).join('')}</div>${tv?'':`<button class="schedule-person-eye" data-person="${esc(entry.login)}" data-team="${esc(t.name)}" type="button" title="${hidden?'Pokaż':'Ukryj'} w TV" aria-label="Widoczność TV: ${esc(entry.login)}">${iconEye(!hidden)}</button>`}</div>`}).join('')||'<div class="schedule-person-empty">Brak pracowników</div>';
}
function breakMarkup(){if(!breaks)return '<div class="schedule-empty">Nie znaleziono danych w Excel.</div>';
 if(Array.isArray(breaks.shifts)){return breaks.shifts.map(shift=>`<div class="schedule-break-shift"><h4>${esc(shift.name)}</h4><table class="schedule-break-table"><thead><tr><th>Czas pracy</th><th>I</th><th>II</th><th>III</th></tr></thead><tbody>${shift.rows.map(r=>`<tr><th>${esc(r.hours||'')}</th>${r.times.map(t=>`<td>${esc(t)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`).join('')+(breaks.people?.length?`<div class="schedule-break-shift"><h4>Przydział do przerw</h4><table class="schedule-break-table"><thead><tr><th>Grupa</th><th>I</th><th>II</th><th>III</th></tr></thead><tbody>${breaks.people.map(r=>`<tr><th>${esc(r.label||'')}</th>${r.logins.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'')+(breaks.spm?.length?`<div class="schedule-break-shift"><h4>SPM</h4>${breaks.spm.map(r=>`<div class="schedule-break-spm">${esc(r)}</div>`).join('')}</div>`:'');}
 if(!breaks.rows?.length)return '<div class="schedule-empty">Nie znaleziono danych w Excel.</div>';
 const rows=breaks.rows,heads=rows[0]||[],n=Math.max(1,...rows.map(r=>r.length));
 const header=Array.from({length:n},(_,j)=>`<th>${esc(heads[j]??'')}</th>`).join('');
 return `<div style="overflow-x:auto"><table class="schedule-break-table"><thead><tr>${header}</tr></thead><tbody>${rows.slice(1).map(r=>`<tr>${Array.from({length:n},(_,j)=>`<td>${esc(r[j]??'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
// Free, snap-to-grid TV board. Coordinates are in a stable 1200px design space;
// the entire composed board scales together when the PWA/TV viewport changes.
const DESIGN_W=1200, SNAP=10, GAP=12;
let boardScale=1,dragSession=null,autoSaved=false;
const snap=n=>Math.round(n/SNAP)*SNAP;
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
function measuredMinimum(el){
 // Measure natural content height. A flex:1 body reports the *assigned* widget
 // height as scrollHeight, which previously made shrinking impossible.
 const body=el.querySelector('.schedule-widget-body');
 if(!body)return 90;
 const previousHeight=el.style.height,previousFlex=body.style.flex;
 el.style.height='auto';body.style.flex='0 0 auto';
 const natural=Math.ceil((el.querySelector('.schedule-widget-header')?.offsetHeight||42)+body.scrollHeight+4);
 body.style.flex=previousFlex;el.style.height=previousHeight;
 return Math.max(90,natural);
}
function defaultGeometry(item,sequence){
 const prev=board.positions||{};
 const stored=prev[item.id];
 if(stored&&['x','y','w','h'].every(k=>Number.isFinite(Number(stored[k]))))return {x:clamp(snap(Number(stored.x)),0,1080),y:Math.max(0,snap(Number(stored.y))),w:clamp(snap(Number(stored.w)),180,DESIGN_W),h:Math.max(90,snap(Number(stored.h)))};
 // Retain the old width preference when upgrading from the 3-width layout.
 const old=Number(board.widths[item.id]);
 const w=old===12?DESIGN_W:old===6?590:item.kind==='breaks'?390:390;
 let x=0,y=0;
 if(sequence.length){
  const last=sequence[sequence.length-1];x=last.x+last.w+GAP;y=last.y;
  if(x+w>DESIGN_W){x=0;y=Math.max(...sequence.map(p=>p.y+p.h))+GAP}
 }
 return {x,y,w,h:item.kind==='breaks'?690:Math.max(190,60+(item.table?.entries?.length||0)*51)};
}
function overlaps(a,b){return a.x<b.x+b.w+GAP&&a.x+a.w+GAP>b.x&&a.y<b.y+b.h+GAP&&a.y+a.h+GAP>b.y}
function placeNew(p,sequence){
 p.w=clamp(p.w,180,DESIGN_W);p.x=clamp(p.x,0,DESIGN_W-p.w);
 while(sequence.some(v=>overlaps(p,v))){p.x+=SNAP;if(p.x+p.w>DESIGN_W){p.x=0;p.y=Math.max(...sequence.map(v=>v.y+v.h))+GAP}if(p.y>20000)break}
 return p;
}
function geometryFor(items){
 const geom={};const placed=[];
 for(const item of items){const stored=board.positions?.[item.id];const p=defaultGeometry(item,placed);
  p.w=clamp(p.w,180,DESIGN_W);p.x=clamp(p.x,0,DESIGN_W-p.w);
  if(!stored)placeNew(p,placed);
  geom[item.id]=p;placed.push(p);
 }
 return geom;
}
function syncBoardHeight(){
 const canvas=$('scheduleWidgetCanvas'),viewport=$('scheduleWidgetViewport');
 const max=Math.max(160,...[...canvas.querySelectorAll('.schedule-widget')].map(el=>Number(el.style.top.replace('px',''))+Number(el.style.height.replace('px',''))+16));
 canvas.style.height=max+'px';
 const availableWidth=viewport.clientWidth||DESIGN_W;
 const tvHeight=window.innerHeight - Math.ceil(viewport.getBoundingClientRect().top)-25;
 const s=tv?Math.min(availableWidth/DESIGN_W,Math.max(.25,tvHeight/max)):availableWidth/DESIGN_W;
 boardScale=Math.max(.15,s);canvas.style.transform=`scale(${boardScale})`;
 canvas.style.marginLeft=tv?Math.max(0,Math.round((availableWidth-DESIGN_W*boardScale)/2))+'px':'0px';
 viewport.style.height=Math.ceil(max*boardScale)+'px';
}
function persistPositions(){if(tv)return;board.positions=board.positions||{};for(const el of $('scheduleWidgetCanvas').querySelectorAll('.schedule-widget')){const id=el.dataset.id;board.positions[id]={x:Math.round(parseFloat(el.style.left)),y:Math.round(parseFloat(el.style.top)),w:Math.round(parseFloat(el.style.width)),h:Math.round(parseFloat(el.style.height))}}saveBoard()}
function render(){
 sourceLabels();const el=$('scheduleWidgetCanvas'),list=orderedItems();
 const dateLabel=$('scheduleTVPlanDate');dateLabel.hidden=!(tv&&tomorrow&&list.some(item=>item.kind==='team'));dateLabel.textContent=dateLabel.hidden?'':`STAN · ${formatDate(tomorrow.date)}`;
 if(!list.length){el.innerHTML='<div class="schedule-empty" style="padding:30px;text-align:center">Wczytaj grafik na jutro lub przerwy, aby ułożyć widżety do TV.</div>';syncBoardHeight();return}
 const geom=geometryFor(list);
 el.innerHTML=list.map(item=>{
  const g=geom[item.id],isOff=item.kind==='team'&&isHidden(tomorrow,item.title);
  const controls=!tv?`${item.kind==='team'?`<button class="schedule-team-visibility" title="${isOff?'Pokaż':'Ukryj'} cały zespół w TV" aria-label="Widoczność TV: ${esc(item.title)}">${iconEye(isOff)}</button>`:''}<button class="schedule-widget-handle" type="button" title="Przesuń widżet. Strzałki klawiatury też działają." aria-label="Przesuń ${esc(item.title)}">⠿</button><button class="schedule-widget-remove" title="Usuń widżet z układu i TV" aria-label="Usuń widżet ${esc(item.title)}" type="button">×</button>`:'';
  return `<section class="schedule-widget${isOff?' is-muted':''}" data-id="${esc(item.id)}" style="left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.h}px"><div class="schedule-widget-header"><strong>${esc(item.title)}</strong><div class="schedule-widget-actions">${controls}</div></div><div class="schedule-widget-body">${item.kind==='team'?teamMarkup(item):breakMarkup()}</div>${tv?'':'<div class="schedule-widget-resize" role="button" tabindex="0" aria-label="Zmień rozmiar widżetu" title="Przeciągnij, aby zmienić szerokość i wysokość"></div>'}</section>`;
 }).join('');
 // Establish the minimum safe height after the table has actually been laid out.
 let changed=false;
 for(const w of el.querySelectorAll('.schedule-widget')){const g=geom[w.dataset.id],min=measuredMinimum(w);
  if(g.h<min){g.h=Math.ceil(min/SNAP)*SNAP;w.style.height=g.h+'px';changed=true;}
 }
 // Initial layout collision repair after minimum-height measurement.
 const placed=[];
 for(const w of el.querySelectorAll('.schedule-widget')){const g=geom[w.dataset.id],had=!!board.positions?.[w.dataset.id];
  if(!had&&placed.some(v=>overlaps(g,v))){placeNew(g,placed);w.style.left=g.x+'px';w.style.top=g.y+'px';changed=true}
  placed.push(g);
 }
 syncBoardHeight();
 if(!tv&&changed)persistPositions();
}
$('scheduleWidgetCanvas').addEventListener('click',e=>{if(tv)return;const b=e.target.closest('button'),widget=e.target.closest('.schedule-widget');if(!b||!widget)return;
 const id=widget.dataset.id,item=items().find(x=>x.id===id);
 if(b.classList.contains('schedule-widget-remove')){board.removed=[...new Set([...board.removed,id])];saveBoard();render();status(`Usunięto widżet ${item.title} z tablicy i TV.`)}
 else if(b.classList.contains('schedule-team-visibility')&&tomorrow)toggleVisibility(tomorrow,item.title,null);
 else if(b.classList.contains('schedule-person-eye')&&tomorrow)toggleVisibility(tomorrow,b.dataset.team,b.dataset.person);
});
const canvas=$('scheduleWidgetCanvas');
function geomEl(el){return {x:parseFloat(el.style.left),y:parseFloat(el.style.top),w:parseFloat(el.style.width),h:parseFloat(el.style.height)}}
function collides(el,p){return [...canvas.querySelectorAll('.schedule-widget')].some(other=>other!==el&&overlaps(p,geomEl(other)))}
function updateGeometry(el,p){el.style.left=p.x+'px';el.style.top=p.y+'px';el.style.width=p.w+'px';el.style.height=p.h+'px'}
// When the resized widget needs room, move neighbours out of its way instead
// of reverting the resize. Recalculate from pointer-down geometry each frame
// so neighbours never drift after multiple pointermove events.
function settleNeighbors(active,baseline){
 const others=[...canvas.querySelectorAll('.schedule-widget')].filter(el=>el!==active);
 for(const el of others)updateGeometry(el,baseline.get(el));
 const placed=[geomEl(active)];
 others.sort((a,b)=>{const A=baseline.get(a),B=baseline.get(b);return A.y-B.y||A.x-B.x});
 for(const el of others){
  const p={...baseline.get(el)};let attempts=0;
  while(placed.some(other=>overlaps(p,other))&&attempts++<200){
   const collisions=placed.filter(other=>overlaps(p,other));
   const right=Math.max(...collisions.map(v=>v.x+v.w+GAP));
   if(right+p.w<=DESIGN_W){p.x=Math.ceil(right/SNAP)*SNAP;}
   else{p.x=Math.min(p.x,DESIGN_W-p.w);p.y=Math.ceil(Math.max(...collisions.map(v=>v.y+v.h+GAP))/SNAP)*SNAP;}
  }
  updateGeometry(el,p);placed.push(p);
 }
}
canvas.addEventListener('pointerdown',e=>{
 if(tv||e.button!==0)return;
 const handle=e.target.closest('.schedule-widget-handle,.schedule-widget-resize');if(!handle)return;
 const el=handle.closest('.schedule-widget'),original=geomEl(el),mode=handle.classList.contains('schedule-widget-resize')?'resize':'move';
 const baseline=new Map([...canvas.querySelectorAll('.schedule-widget')].map(w=>[w,geomEl(w)]));
 dragSession={el,handle,mode,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,scale:boardScale,original,last:original,baseline};
 handle.setPointerCapture(e.pointerId);el.classList.add('is-interacting');e.preventDefault();
});
canvas.addEventListener('pointermove',e=>{
 if(!dragSession||e.pointerId!==dragSession.pointerId)return;
 const {el,mode,startX,startY,scale,original,baseline}=dragSession;
 const dx=snap((e.clientX-startX)/scale),dy=snap((e.clientY-startY)/scale);let p={...original};
 if(mode==='move'){p.x=clamp(snap(original.x+dx),0,DESIGN_W-p.w);p.y=Math.max(0,snap(original.y+dy));}
 else{
  p.w=clamp(snap(original.w+dx),180,DESIGN_W-p.x);
  // Width must be applied before reading the natural minimum height.
  el.style.width=p.w+'px';
  p.h=Math.ceil(Math.max(measuredMinimum(el),snap(original.h+dy))/SNAP)*SNAP;
 }
 updateGeometry(el,p);dragSession.last=p;
 if(mode==='resize'){settleNeighbors(el,baseline);el.classList.remove('schedule-widget-blocked')}
 else el.classList.toggle('schedule-widget-blocked',collides(el,p));
 syncBoardHeight();
});
function endPointer(e){if(!dragSession||e.pointerId!==dragSession.pointerId)return;
 const {el,mode,original,last,baseline}=dragSession;
 if(e.type==='pointercancel'){
  for(const [widget,geometry] of baseline)updateGeometry(widget,geometry);
 }else if(mode==='move'&&collides(el,last)){
  updateGeometry(el,original);status('Widżety nie mogą na siebie nachodzić. Wybierz wolne miejsce.');
 }else{
  persistPositions();status('Zapisano układ TV.');
 }
 el.classList.remove('is-interacting','schedule-widget-blocked');dragSession=null;syncBoardHeight();
}
canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);
canvas.addEventListener('keydown',e=>{
 const h=e.target.closest('.schedule-widget-handle,.schedule-widget-resize');if(!h||tv||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();
 const el=h.closest('.schedule-widget'),p=geomEl(el),old={...p},delta=e.shiftKey?40:10,sign=['ArrowLeft','ArrowUp'].includes(e.key)?-1:1;
 if(h.classList.contains('schedule-widget-resize')){if(['ArrowLeft','ArrowRight'].includes(e.key))p.w=clamp(p.w+sign*delta,180,DESIGN_W-p.x);else p.h=Math.max(measuredMinimum(el),p.h+sign*delta)}
 else{if(['ArrowLeft','ArrowRight'].includes(e.key))p.x=clamp(p.x+sign*delta,0,DESIGN_W-p.w);else p.y=Math.max(0,p.y+sign*delta)}
 if(h.classList.contains('schedule-widget-resize')){const baseline=new Map([...canvas.querySelectorAll('.schedule-widget')].filter(w=>w!==el).map(w=>[w,geomEl(w)]));updateGeometry(el,p);settleNeighbors(el,baseline);persistPositions();syncBoardHeight()}else if(!collides(el,p)){updateGeometry(el,p);persistPositions();syncBoardHeight()}else updateGeometry(el,old);
});
let boardResizeTimer;window.addEventListener('resize',()=>{clearTimeout(boardResizeTimer);boardResizeTimer=setTimeout(syncBoardHeight,80)});
$('scheduleResetLayout').onclick=()=>{board={order:[],widths:{},removed:[],positions:{}};saveBoard();render();status('Przywrócono wszystkie widżety i domyślny układ.')};
function attachDrop(kind){const zone=$(kind==='plan'?'schedulePlanDrop':'scheduleBreakDrop'),input=$(kind==='plan'?'schedulePlanFile':'scheduleBreakFile');
 zone.addEventListener('click',()=>input.click());zone.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click()}});
 for(const evt of ['dragenter','dragover'])zone.addEventListener(evt,e=>{e.preventDefault();zone.classList.add('is-over')});
 zone.addEventListener('dragleave',e=>{if(!zone.contains(e.relatedTarget))zone.classList.remove('is-over')});
 zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('is-over');const f=[...e.dataTransfer.files].find(x=>/\.xlsx$/i.test(x.name));if(f)load(kind,f);else status('Wybierz plik .xlsx')});
 input.onchange=e=>{const f=e.target.files[0];if(f)load(kind,f);e.target.value=''};
}
async function parseBreaks(file){
 const buffer=await file.arrayBuffer();let rows;
 // The supplied PRZERWY AGENCJE.xlsx uses the tab named Sheet2.
 for(const sheet of ['Sheet2','PRZERWY','Przerwy','przerwy','Arkusz1','Sheet1']){
  try{rows=await xlsxRows(buffer,sheet);break}catch(e){if(!/Brak arkusza/.test(e.message))throw e}
 }
 if(!rows)throw Error('Nie znaleziono arkusza z przerwami.');
 const value=(row,col)=>String(row?.[col]??'').trim();
 const shifts=[],people=[];let current=null,inPeople=false;
 for(const row of rows){
  const first=value(row,0).toUpperCase();
  if(/^(I|II)\s+ZMIANA$/.test(first)){current={name:first,rows:[]};shifts.push(current);inPeople=false;continue}
  if(first==='PD'){inPeople=true;continue}
  if(inPeople){const cells=[value(row,1),value(row,3),value(row,5)];if(cells.some(Boolean))people.push({label:'',logins:cells});continue}
  if(!current||!(/^(8|10|12)H$/i.test(first)||(!first&&[1,3,5].some(j=>value(row,j)))))continue;
  const times=[1,3,5].map(j=>value(row,j));if(times.some(Boolean))current.rows.push({hours:first,times});
 }
 if(!shifts.length||!shifts.some(x=>x.rows.length)){
  const cleaned=rows.map(r=>r.map(v=>v==null?'':String(v).trim())).filter(r=>r.some(Boolean));
  if(!cleaned.length)throw Error('Arkusz jest pusty.');
  return {source:file.name,rows:cleaned,importedAt:new Date().toISOString()};
 }
 let spm=[];try{const spmRows=await xlsxRows(buffer,'SPM');spm=spmRows.flat().map(x=>String(x??'').trim()).filter(x=>/PRZERWA/i.test(x))}catch(e){if(!/Brak arkusza/.test(e.message))throw e}
 return {source:file.name,shifts,people,spm,importedAt:new Date().toISOString()};
}

async function load(kind,file){if(file.size>10_000_000){status('Plik przekracza 10 MB.');return}status(`Odczyt: ${file.name}…`);
 try{if(kind==='plan'){
 const buffer=await file.arrayBuffer();let rows;try{rows=await xlsxRows(buffer,'STAN')}catch(err){if(!/Brak arkusza STAN/.test(err.message))throw err;rows=await xlsxRows(buffer,'Arkusz1')}
 const plan=parse(rows,file.name);tomorrow=plan;plans[key(plan.date,plan.shift)]=plan;board.removed=board.removed.filter(id=>!id.startsWith('team:'));saveBoard();
 localStorage.setItem(TOMORROW_KEY,JSON.stringify(tomorrow));localStorage.setItem(KEY,JSON.stringify(plans));status(`Wczytano grafik: ${formatDate(plan.date)} · ${planTables(plan).length} tabel.`)
 }else{breaks=await parseBreaks(file);board.removed=board.removed.filter(id=>id!=='breaks');saveBoard();localStorage.setItem(BREAK_KEY,JSON.stringify(breaks));status(`Wczytano przerwy: ${(breaks.rows?.length||breaks.shifts?.length||0)} sekcje. Sprawdź układ tabeli.`)}
 render();
 }catch(e){status('Błąd odczytu: '+e.message)}
}
attachDrop('plan');attachDrop('break');
function count(){return orderedItems().length?1:0}
function tvRender(){tv=true;section.hidden=false;render()}
window.incSchedule={has:()=>count()>0,count,show:tvRender,restore(){tv=false;render()},isSchedule:()=>!section.hidden};
$('assignment').addEventListener('click',()=>{tv=false;render();$('tv').disabled=false});
render();
})();
