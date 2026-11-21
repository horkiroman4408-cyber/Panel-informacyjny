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
const BREAK_SHIFT_KEY='incydenty-breaks-selected-shift-v1';
const BREAK_HOURS_KEY='incydenty-breaks-selected-hours-v1';
let breakHours='8H';
try{const saved=localStorage.getItem(BREAK_HOURS_KEY);if(['8H','10H','12H'].includes(saved))breakHours=saved}catch{}
let breakShift='I ZMIANA';
try{const saved=localStorage.getItem(BREAK_SHIFT_KEY);if(saved==='I ZMIANA'||saved==='II ZMIANA')breakShift=saved}catch{}
const TOMORROW_KEY='incydenty-tomorrow-plan-v1';
let board={order:[],widths:{},removed:[],positions:{},sizes:{}};
try{const b=JSON.parse(localStorage.getItem(BOARD_KEY));if(b&&Array.isArray(b.order))board={order:b.order,widths:b.widths||{},removed:Array.isArray(b.removed)?b.removed:[],positions:b.positions&&typeof b.positions==='object'?b.positions:{},sizes:b.sizes&&typeof b.sizes==='object'?b.sizes:{}}}catch{}
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
<div class="schedule-board-info"><span>Układ TV · przeciągnij za <b>⠿</b>, aby zamienić widżety miejscami · rozmiar <b>S / M / L</b></span><span id="scheduleBoardStatus" role="status"></span></div>
<div id="scheduleWidgetViewport" class="schedule-widget-viewport"><div id="scheduleWidgetCanvas" class="schedule-widget-canvas" aria-label="Układ widżetów TV"></div></div>`;
$('assignment').textContent='Harmonogram pracy';
const css=document.createElement('style');css.id='schedule-widget-styles';css.textContent=`
.schedule-workspace{min-width:0}.schedule-board-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:26px 0 18px}
.schedule-board-top h2{font-size:clamp(27px,2.5vw,36px);margin:0}.schedule-board-top p{font-size:13px;margin:7px 0 0;color:#738096}
.schedule-board-top>button{font-size:12px;padding:10px 16px;white-space:nowrap}
.schedule-drop-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.schedule-drop{display:flex;align-items:center;gap:10px;min-width:0;min-height:62px;padding:9px 13px;border:1.5px dashed #b6c9d9;border-radius:15px;background:rgba(255,255,255,.68);cursor:pointer;transition:border-color .2s,background .2s,transform .2s}
.schedule-drop:hover,.schedule-drop.is-over{border-color:#2eacac;background:#effaf8;transform:translateY(-2px)}
.schedule-drop-icon{width:32px;height:32px;flex:0 0 auto;border-radius:10px;display:grid;place-items:center;background:#edf6f7;font-size:17px}
.schedule-drop>div{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}.schedule-drop strong{font-size:13px;color:#243b4a}.schedule-drop small{font-size:10px;color:#758597;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.schedule-drop-action{padding:6px 11px;border:1px solid #d1e2e6;border-radius:999px;background:#fff;color:#347e84;font-size:11px;font-weight:700}
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
/* Time awareness highlights only the relevant break cell. No repeated DOM recreation. */
.schedule-break-table td.break-current{background:#d5f2e9!important;color:#096451;font-weight:800;box-shadow:inset 0 0 0 1px #62c4a5;position:relative}
.schedule-break-table td.break-next{background:#fff5df!important;color:#8b611b;font-weight:700;box-shadow:inset 0 0 0 1px #eccf89}
/* Keep the duration column neutral: highlight only the time interval cell. */


/* Duration selection is separate from team selection. It never hides source rows. */
.schedule-break-hours{display:flex;align-items:center;justify-content:center;gap:8px;padding:8px 10px;background:#f7fafc;border-bottom:1px solid #e1e8ee}
.schedule-break-hours-label{font-size:10px;font-weight:700;color:#64788c;white-space:nowrap}
.schedule-break-hours-options{display:flex;align-items:center;gap:3px;padding:3px;border-radius:10px;background:#e6edf2}
.schedule-break-hours-options button{border:0!important;background:transparent!important;box-shadow:none!important;min-width:41px!important;width:auto!important;height:28px!important;padding:4px 8px!important;border-radius:8px!important;color:#66788a!important;font-size:11px!important;font-weight:750!important;cursor:pointer}
.schedule-break-hours-options button[aria-pressed="true"]{background:white!important;color:#157d76!important;box-shadow:0 1px 5px #173e5f18!important}
.schedule-break-hours-options button:focus-visible{outline:2px solid #159c94;outline-offset:1px}
body.unified-tv #assign .schedule-break-hours{padding:6px 8px}
body.unified-tv #assign .schedule-break-hours-options button{display:none!important}
body.unified-tv #assign .schedule-break-hours-options button[aria-pressed="true"]{display:block!important;background:#dff3ef!important;color:#176d64!important;cursor:default}
/* iPhone-style widgets: a predictable 6-column auto-flowing grid. */
.schedule-widget-viewport{overflow:visible;min-height:140px}
.schedule-widget-canvas{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));grid-auto-flow:row;gap:12px;align-content:start;align-items:start;min-height:140px;height:auto!important;background-size:20px 20px}
.schedule-widget{position:relative!important;left:auto!important;top:auto!important;width:auto!important;height:auto!important;grid-column:span 2;align-self:start;min-height:0!important;overflow:hidden;transition:box-shadow .2s ease,opacity .15s ease}
.schedule-widget[data-size="M"]{grid-column:span 3}
.schedule-widget[data-size="L"]{grid-column:span 6}
.schedule-widget-body{flex:0 0 auto;min-height:0}
.schedule-break-select{display:flex;gap:3px;align-items:center;border-radius:10px;background:#dfe8ed;padding:3px;margin-right:5px}
.schedule-break-select button{width:auto!important;height:26px!important;min-width:62px!important;padding:3px 7px!important;font-size:10px!important;font-weight:750!important;white-space:nowrap;border-radius:7px!important;color:#596d7e!important}
.schedule-break-select button[aria-pressed="true"]{background:#fff!important;color:#116d73!important;box-shadow:0 1px 5px #203e4c19!important}
body.unified-tv #assign .schedule-break-select{background:transparent;padding:0;margin-right:0}
body.unified-tv #assign .schedule-break-select button{display:none!important}
body.unified-tv #assign .schedule-break-select button[aria-pressed="true"]{display:block!important;background:#e4f3f2!important;color:#20595d!important;box-shadow:none!important;cursor:default}
.schedule-widget-size-group{display:flex;gap:2px;padding:2px;background:#e2e9f0;border-radius:9px}
.schedule-widget-size-group button{width:23px!important;height:24px!important;border-radius:7px!important;font-size:10px!important;font-weight:750!important;padding:0!important;color:#62768a!important}
.schedule-widget-size-group button[aria-pressed="true"]{background:white!important;color:#0876d9!important;box-shadow:0 1px 5px #18395a18!important}
.schedule-widget.is-dragging{opacity:.45;box-shadow:0 5px 12px #173e5f1a!important}
.schedule-widget.drop-target{outline:2px solid #2aaca9!important;outline-offset:3px;background:#f4fffe}
.schedule-widget-handle{cursor:grab!important}
body.unified-tv #assign .schedule-widget{transition:none}
body.unified-tv #assign .schedule-widget-size-group{display:none!important}
@media(prefers-reduced-motion:reduce){.schedule-widget{transition:none!important}}

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
function breakMarkup(){
 if(!breaks)return '<div class="schedule-empty">Nie znaleziono danych w Excel.</div>';
 if(Array.isArray(breaks.shifts)){
  const selected=breaks.shifts.find(s=>s.name===breakShift);
  if(!selected)return '<div class="schedule-empty">Brak tabeli '+esc(breakShift)+' w pliku Excel.</div>';
   // Ignore duplicated Roman numeral headers in the source sheet and retain only time rows.
   const rows=selected.rows.filter(r=>(r.times||[]).some(t=>/\d{1,2}:\d{2}\s*[-–—]\s*\d{1,2}:\d{2}/.test(String(t))));
   // Blank hours in the source are continuation rows (especially 12H).
   let inheritedHours='';
   const rowHtml=rows.map(r=>{const raw=String(r.hours||'').trim();if(/^(8|10|12)\s*H$/i.test(raw))inheritedHours=raw.replace(/\s/g,'').toUpperCase();const hours=inheritedHours;
     return `<tr data-break-hours="${esc(hours)}"><th>${esc(raw)}</th>${r.times.map(t=>`<td data-break-time="${esc(t)}">${esc(t)}</td>`).join('')}</tr>`;
   }).join('');
   const hoursPicker=`<div class="schedule-break-hours" aria-label="Czas pracy dla podświetlenia"><span class="schedule-break-hours-label">Czas pracy</span><div class="schedule-break-hours-options" role="group" aria-label="Wybierz długość zmiany">${['8H','10H','12H'].map(h=>`<button type="button" class="schedule-break-hours-choice" data-break-hours-choice="${h}" aria-pressed="${h===breakHours}" title="Podświetl przerwy dla ${h}">${h}</button>`).join('')}</div></div>`;
   return `${hoursPicker}<table class="schedule-break-table" data-break-shift="${esc(selected.name)}" data-selected-hours="${breakHours}"><thead><tr><th>Czas pracy</th><th>I</th><th>II</th><th>III</th></tr></thead><tbody>${rowHtml}</tbody></table>`;
 }
 return '<div class="schedule-empty">Nie znaleziono harmonogramu zmian w pliku Excel.</div>';
}
// Widget grid constants and drag state, required before first render.
const DESIGN_W=1200;
const SIZES=['S','M','L'];
let boardScale=1,draggingId=null,targetId=null;
function widgetSize(item){
 const stored=board.sizes?.[item.id];if(SIZES.includes(stored))return stored;
 // One-time migration of the old freely resized positions and widths.
 const width=Number(board.positions?.[item.id]?.w)||Number(board.widths?.[item.id])*(DESIGN_W/12);
 if(Number.isFinite(width)&&width>0)return width>=850?'L':width>=490?'M':'S';
 return item.kind==='breaks'?'M':'S';
}
function saveSize(item,size){
 board.sizes=board.sizes||{};board.sizes[item.id]=size;
 saveBoard();render();status(`Rozmiar widżetu ${item.title}: ${size}.`);
}
function syncBoardHeight(){
 const canvas=$('scheduleWidgetCanvas'),viewport=$('scheduleWidgetViewport');
 const availableWidth=viewport.clientWidth||DESIGN_W;
 // Always measure natural grid height without previously applied transform.
 canvas.style.transform='none';canvas.style.marginLeft='0px';
 const naturalHeight=Math.max(140,canvas.scrollHeight);
 const top=viewport.getBoundingClientRect().top;
 const availableHeight=Math.max(140,window.innerHeight-top-24);
 const widthScale=availableWidth/DESIGN_W;
 boardScale=tv?Math.min(widthScale,availableHeight/naturalHeight):widthScale;
 // Never force a minimum scale which would crop bottom rows in TV.
 boardScale=Math.max(.05,boardScale);
 canvas.style.transform=`scale(${boardScale})`;
 canvas.style.marginLeft=tv?Math.max(0,(availableWidth-DESIGN_W*boardScale)/2)+'px':'0px';
 viewport.style.height=Math.ceil(naturalHeight*boardScale)+'px';
}
// Refresh at most the colored time cells, not the widget markup (no TV animation reset).
function updateBreakHighlights(){
 const table=$('scheduleWidgetCanvas').querySelector('.schedule-break-table[data-break-shift]');if(!table)return;
 const now=new Date(),mins=now.getHours()*60+now.getMinutes();
 const shiftName=table.dataset.breakShift;
 const selectedHours=table.dataset.selectedHours;
 // II ZMIANA continues past midnight: times before noon belong to the following day.
 const anchor=shiftName==='II ZMIANA'?(mins<12*60?-1:0):0;
 const dayStart=anchor*1440;
 const spans=[];
 for(const cell of table.querySelectorAll('td[data-break-time]')){
  const match=cell.dataset.breakTime.match(/(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/);
  cell.classList.remove('break-current','break-next');cell.removeAttribute('title');
  if(!match||cell.closest('tr')?.dataset.breakHours!==selectedHours)continue;
  let start=Number(match[1])*60+Number(match[2]),end=Number(match[3])*60+Number(match[4]);
  if(shiftName==='II ZMIANA'){
    if(start<12*60)start+=1440;
    if(end<12*60)end+=1440;
  }
  if(end<=start)end+=1440;
  const absoluteNow=mins-dayStart;
  spans.push({cell,start,end,now:absoluteNow});
 }
 const active=spans.filter(x=>x.start<=x.now&&x.now<x.end);
 const next=spans.filter(x=>x.start>x.now).sort((a,b)=>a.start-b.start);
 // Highlight upcoming breaks only during the 30 minutes before they start.
 // Outside that window, the timetable must remain neutral, including overnight.
 const upcoming=next.filter(x=>x.start-x.now<=30);
 const selected=active.length?active:(upcoming.length?upcoming.filter(x=>x.start===upcoming[0].start):[]);
 for(const x of selected){x.cell.classList.add(active.length?'break-current':'break-next');x.cell.title=active.length?'Przerwa trwa':'Przerwa za mniej niż 30 minut'}
}
setInterval(updateBreakHighlights,30000);
function render(){
 sourceLabels();const el=$('scheduleWidgetCanvas'),list=orderedItems();
 const dateLabel=$('scheduleTVPlanDate');dateLabel.hidden=!(tv&&tomorrow&&list.some(item=>item.kind==='team'));dateLabel.textContent=dateLabel.hidden?'':`STAN · ${formatDate(tomorrow.date)}`;
 if(!list.length){el.innerHTML='<div class="schedule-empty" style="grid-column:span 6;padding:30px;text-align:center">Wczytaj grafik na jutro lub przerwy, aby ułożyć widżety do TV.</div>';syncBoardHeight();return}
 el.innerHTML=list.map(item=>{
  const size=widgetSize(item),isOff=item.kind==='team'&&isHidden(tomorrow,item.title);
  const shiftButtons=item.kind==='breaks'?`<div class="schedule-break-select" role="group" aria-label="Zmiana przerw">${['I ZMIANA','II ZMIANA'].map(name=>`<button type="button" class="schedule-break-choice" data-break-shift="${name}" aria-pressed="${breakShift===name}" title="Pokaż ${name}">${name}</button>`).join('')}</div>`:'';
   const sizeBtns=!tv?`<div class="schedule-widget-size-group" role="group" aria-label="Rozmiar ${esc(item.title)}">${SIZES.map(v=>`<button type="button" class="schedule-size" data-size-choice="${v}" aria-pressed="${v===size}" title="Rozmiar ${v}">${v}</button>`).join('')}</div>`:'';
  const controls=!tv?`${item.kind==='team'?`<button class="schedule-team-visibility" title="${isOff?'Pokaż':'Ukryj'} cały zespół w TV" aria-label="Widoczność TV: ${esc(item.title)}">${iconEye(isOff)}</button>`:''}${shiftButtons}${sizeBtns}<button class="schedule-widget-handle" draggable="true" type="button" title="Przeciągnij, aby zmienić kolejność" aria-label="Przesuń ${esc(item.title)}">⠿</button><button class="schedule-widget-remove" title="Usuń widżet z układu i TV" aria-label="Usuń widżet ${esc(item.title)}" type="button">×</button>`:'';
  return `<section class="schedule-widget${isOff?' is-muted':''}" data-id="${esc(item.id)}" data-size="${size}"><div class="schedule-widget-header"><strong>${esc(item.title)}${tv&&item.kind==='breaks'?` · ${esc(breakShift)}`:''}</strong><div class="schedule-widget-actions">${controls}</div></div><div class="schedule-widget-body">${item.kind==='team'?teamMarkup(item):breakMarkup()}</div></section>`;
 }).join('');
 requestAnimationFrame(()=>{syncBoardHeight();updateBreakHighlights()});
}
$('scheduleWidgetCanvas').addEventListener('click',e=>{
 if(tv)return;const b=e.target.closest('button'),widget=e.target.closest('.schedule-widget');if(!b||!widget)return;
 const id=widget.dataset.id,item=items().find(x=>x.id===id);if(!item)return;
 if(b.classList.contains('schedule-widget-remove')){board.removed=[...new Set([...board.removed,id])];saveBoard();render();status(`Usunięto widżet ${item.title} z tablicy i TV.`)}
 else if(b.classList.contains('schedule-break-choice')&&item.kind==='breaks'){
   breakShift=b.dataset.breakShift==='II ZMIANA'?'II ZMIANA':'I ZMIANA';
   try{localStorage.setItem(BREAK_SHIFT_KEY,breakShift)}catch{}
   render();status(`Przerwy: ${breakShift}. Wybór zapisano także dla TV.`);
  }
  else if(b.classList.contains('schedule-break-hours-choice')&&item.kind==='breaks'){
   const choice=b.dataset.breakHoursChoice;
   if(!['8H','10H','12H'].includes(choice))return;
   breakHours=choice;try{localStorage.setItem(BREAK_HOURS_KEY,breakHours)}catch{}
   render();status(`Przerwy: ${breakShift}, ${breakHours}. Wybór zapisano także dla TV.`);
  }
  else if(b.classList.contains('schedule-size'))saveSize(item,b.dataset.sizeChoice);
 else if(b.classList.contains('schedule-team-visibility')&&tomorrow)toggleVisibility(tomorrow,item.title,null);
 else if(b.classList.contains('schedule-person-eye')&&tomorrow)toggleVisibility(tomorrow,b.dataset.team,b.dataset.person);
});
const canvas=$('scheduleWidgetCanvas');
// Native HTML drag initiates only on the handle. Widgets swap positions like
// iPhone home-screen tiles; no overlap and no arbitrary pixel coordinates.
canvas.addEventListener('dragstart',e=>{
 if(tv)return;const handle=e.target.closest('.schedule-widget-handle');
 const widget=handle?.closest('.schedule-widget');if(!widget){e.preventDefault();return}
 draggingId=widget.dataset.id;targetId=null;
 e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',draggingId);
 widget.classList.add('is-dragging');
});
canvas.addEventListener('dragover',e=>{
 if(!draggingId)return;
 e.preventDefault();e.dataTransfer.dropEffect='move';
 const w=e.target.closest('.schedule-widget');
 canvas.querySelectorAll('.drop-target').forEach(x=>x.classList.remove('drop-target'));
 targetId=w&&w.dataset.id!==draggingId?w.dataset.id:null;
 if(targetId)w.classList.add('drop-target');
});
canvas.addEventListener('drop',e=>{
 if(!draggingId)return;e.preventDefault();
 const target=e.target.closest('.schedule-widget');const to=target?.dataset.id;
 if(to&&to!==draggingId){
  const order=orderedItems().map(x=>x.id),a=order.indexOf(draggingId),b=order.indexOf(to);
  if(a>=0&&b>=0){[order[a],order[b]]=[order[b],order[a]];board.order=order;saveBoard();status('Zamieniono widżety miejscami.');}
 }
 draggingId=null;targetId=null;render();
});
canvas.addEventListener('dragend',()=>{draggingId=null;targetId=null;canvas.querySelectorAll('.schedule-widget').forEach(w=>w.classList.remove('is-dragging','drop-target'))});
// Keyboard support: arrows on grip swap with adjacent widget.
canvas.addEventListener('keydown',e=>{
 const handle=e.target.closest('.schedule-widget-handle');if(!handle||tv||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
 e.preventDefault();const w=handle.closest('.schedule-widget'),order=orderedItems().map(x=>x.id),idx=order.indexOf(w.dataset.id),sign=['ArrowLeft','ArrowUp'].includes(e.key)?-1:1,next=idx+sign;
 if(next<0||next>=order.length)return;[order[idx],order[next]]=[order[next],order[idx]];board.order=order;saveBoard();render();
 const nextHandle=[...canvas.querySelectorAll('.schedule-widget')].find(x=>x.dataset.id===w.dataset.id)?.querySelector('.schedule-widget-handle');nextHandle?.focus();
});
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(syncBoardHeight,90)});
$('scheduleResetLayout').onclick=()=>{board={order:[],widths:{},removed:[],positions:{},sizes:{}};saveBoard();render();status('Przywrócono widżety i domyślny układ S / M / L.')};
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
   const times=[1,3,5].map(j=>value(row,j));if(times.some(t=>/\d{1,2}:\d{2}\s*[-–—]\s*\d{1,2}:\d{2}/.test(t)))current.rows.push({hours:first,times});
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
