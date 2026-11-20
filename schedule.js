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
function parse(rows,name){const d=details(rows,name),people=[],absence=[];const seen=new Set();
 for(let i=0;i<rows.length;i++){
  const row=rows[i].map(v=>String(v??'').trim());
  for(let j=0;j<row.length-1;j++){
   if(!isLogin(row[j])||!row[j+1])continue;
   const login=row[j].toUpperCase(),process=row[j+1].replace(/\r/g,'').trim(),key=login+'|'+process;
   if(seen.has(key))continue;seen.add(key);
   if(/^(WOLNY|WOLNE|URLOP|URLOPY|W DOMU|NIEOBECNY|ZWOLNIENIE|L4)$/i.test(process))absence.push({login,status:process});
   else people.push({login,process});
  }
 }
 if(!people.length&&!absence.length)throw Error('Brak par Login TH / Proces. Sprawdź arkusz STAN lub Arkusz1.');
 return {...d,people,absence,source:name,importedAt:new Date().toISOString()};
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
function rosterTable(title,meta,rows,absence=false){
 const rendered=rows.length?rows.map((p,i)=>`<div class="schedule-person-row"><div class="schedule-person-login">${esc(p.login)}</div><div class="schedule-person-assignment">${(absence?p.statuses:p.processes).map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>`).join(''):`<div class="schedule-person-empty">Brak ${absence?'nieobecności':'przydziałów'}</div>`;
 return `<section class="schedule-roster-panel${absence?' schedule-roster-absence':''}"><div class="schedule-roster-panel-head"><strong>${esc(title)}</strong>${meta?`<span>${esc(meta)}</span>`:''}</div><div class="schedule-person-list">${rendered}</div></section>`;
}
function rosterView(plan,people,absence,dateText){
 const team=plan.team||'Pracownicy';
 const shiftText=plan.hours||plan.shift||'';
 return `<div class="schedule-sheet"><div class="schedule-sheet-head"><strong>INCYDENTY</strong><h3>STAN · ${esc(dateText)}</h3><div class="schedule-sheet-line"></div></div><div class="schedule-roster-grid">${rosterTable(team,shiftText,people)}${rosterTable('Nieobecni','',absence,true)}</div></div>`;
}

const section=$('assign');section.className='schedule-area';section.innerHTML=`
<div class="schedule-title"><div><div class="eyebrow">INCYDENTY · PLAN OBSADY</div><h2>Harmonogram pracy</h2><p>Rozmieszczenie pracowników w procesach na dzisiaj i jutro.</p></div><button id="scheduleImport" class="primary">📥 Wczytaj harmonogram</button><input id="scheduleFiles" type="file" accept=".xlsx" multiple hidden></div>
<div class="schedule-tools glass"><div class="schedule-daytabs"><button data-offset="0">Dzisiaj</button><button data-offset="1">Jutro</button></div><label>Data <input id="scheduleDate" type="date"></label><label>Zmiana <select id="scheduleShift"></select></label><span id="scheduleSummary"></span></div>
<div id="scheduleStatus" class="schedule-status" role="status" hidden></div><div id="scheduleContent"></div><div class="schedule-bottom"><button id="scheduleDelete">Usuń wybrany harmonogram</button></div>`;
$('assignment').textContent='Harmonogram pracy';
const style=document.createElement('style');style.textContent=`
.schedule-area{display:block;min-width:0}.schedule-title{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:27px 0 20px}.schedule-title h2{font-size:clamp(27px,2.4vw,36px)}.schedule-title p{font-size:13px;margin:7px 0 0}.schedule-tools{display:flex;align-items:center;gap:17px;padding:12px 16px;flex-wrap:wrap;margin-bottom:20px}.schedule-tools label{font-size:12px;color:#53647c;font-weight:650}.schedule-tools input,.schedule-tools select{border:1px solid #dce4ef;background:#fff;border-radius:10px;padding:9px 11px;font-size:13px;color:#31445b;max-width:none}.schedule-daytabs{display:flex;background:#edf2fa;padding:4px;border-radius:14px;gap:3px}.schedule-daytabs button{border:0;background:transparent;padding:9px 17px;border-radius:11px;font-size:13px}.schedule-daytabs button.selected{background:white;color:#0876d9;box-shadow:0 2px 8px #0001}.schedule-tools #scheduleSummary{margin-left:auto;font-size:12px;color:#718096}.schedule-status{padding:12px 15px;margin-bottom:14px;border-radius:13px;background:#eff7ff;color:#344e70;font-size:13px}.schedule-meta{display:flex;justify-content:space-between;align-items:center;gap:14px;margin:16px 0}.schedule-meta strong{color:#304257;font-size:16px}.schedule-meta small{font-size:12px;color:#718096}.schedule-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;align-items:start}.schedule-process{background:rgba(255,255,255,.80);border:1px solid #e5eaf3;border-radius:20px;padding:17px 17px 15px;box-shadow:0 7px 25px #1f268509;min-width:0}.schedule-process h3{margin:0;font-size:14px;line-height:1.3;color:#2f4259;overflow-wrap:anywhere}.schedule-process header{min-height:0!important;display:flex!important;justify-content:space-between!important;gap:6px!important;align-items:center!important;margin-bottom:12px}.schedule-process header:before{display:none!important}.schedule-process header span{padding:3px 9px;background:#eaf4ff;color:#2771b5;border-radius:999px;font-size:11px;font-weight:800}.schedule-logins{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.schedule-login{display:block;text-align:center;padding:9px 3px;background:#f3f6fb;border:1px solid #ecf0f6;border-radius:10px;font-size:clamp(11px,.8vw,14px);font-weight:750;color:#344960;white-space:nowrap}.schedule-absences{margin-top:16px;background:#fff9f0;border:1px solid #f2e6d7;border-radius:17px;padding:15px}.schedule-absences h3{font-size:13px;margin:0 0 10px}.schedule-absences-list{display:flex;gap:7px;flex-wrap:wrap}.schedule-absences-list span{padding:7px 10px;background:#fff;border-radius:10px;font-size:12px;font-weight:650;color:#655742}.schedule-empty{text-align:center;background:rgba(255,255,255,.72);border:1px solid #e5eaf3;border-radius:23px;padding:55px 25px;color:#607086}.schedule-empty h3{color:#304257;font-size:21px}.schedule-bottom{text-align:right;padding:15px 0}.schedule-bottom button{font-size:12px;padding:9px 14px}body.unified-tv #assign .schedule-tools,body.unified-tv #assign .schedule-title>button,body.unified-tv #assign .schedule-bottom,body.unified-tv #assign .schedule-status{display:none!important}body.unified-tv #assign .schedule-title{justify-content:center;text-align:center;margin:12px 0 14px}body.unified-tv #assign .schedule-title h2{font-size:clamp(24px,2.1vw,38px)}body.unified-tv #assign .schedule-title p{display:none}body.unified-tv #assign .schedule-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(8px,.75vw,18px)}body.unified-tv #assign .schedule-process{padding:clamp(12px,.8vw,20px)}body.unified-tv #assign .schedule-login{font-size:clamp(12px,.8vw,17px)}body.unified-tv #assign .schedule-absences{margin-top:12px}body.unified-tv #assign .schedule-process{animation:incCloudRise .68s cubic-bezier(.2,.75,.22,1) both}body.unified-tv #assign .schedule-process:nth-child(2){animation-delay:55ms}body.unified-tv #assign .schedule-process:nth-child(3){animation-delay:110ms}@media(max-width:1260px){.schedule-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:880px){.schedule-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.schedule-grid{grid-template-columns:1fr}.schedule-title{flex-wrap:wrap}}
`;style.textContent+=`
/* STAN layout: employee rows with all assignments, just like the exported staff sheet. */
.schedule-sheet{width:100%;max-width:1160px;margin:0 auto 20px}
.schedule-sheet-head{text-align:center;margin:12px auto 28px;color:#112e50}
.schedule-sheet-head>strong{display:block;font-size:clamp(22px,2vw,30px);font-weight:800;letter-spacing:.015em;line-height:1.18}
.schedule-sheet-head h3{font-size:clamp(18px,1.6vw,25px);font-weight:780;margin:4px 0 10px;color:#173657}
.schedule-sheet-line{height:3px;width:44px;background:#9cacc0;border-radius:3px;margin:0 auto}
.schedule-roster-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;align-items:start}
.schedule-roster-panel{border:1px solid #d5e0eb;border-radius:15px;overflow:hidden;background:#fff;min-width:0}
.schedule-roster-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#e9eef4;padding:13px 15px;color:#102f4e;font-size:14px;min-height:48px}
.schedule-roster-panel-head strong{font-weight:800}
.schedule-roster-panel-head span{font-size:11px;color:#395677;font-weight:650}
.schedule-person-row{display:grid;grid-template-columns:minmax(105px,32%) minmax(0,1fr);border-top:1px solid #dbe3ed;min-height:44px}
.schedule-person-row:nth-child(even){background:#f2f5f9}
.schedule-person-login{display:flex;align-items:center;padding:10px 13px;font-weight:800;font-size:13px;color:#0c3057;border-right:1px solid #dbe3ed;overflow-wrap:anywhere}
.schedule-person-assignment{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:5px;padding:9px 10px;font-size:12px;line-height:1.35;font-weight:700;color:#153757;overflow-wrap:anywhere}
.schedule-roster-absence .schedule-person-assignment{font-weight:500;font-size:12px}
.schedule-person-empty{text-align:center;padding:25px 12px;color:#8694a7;font-size:13px}
.schedule-tv-page{text-align:right;max-width:1160px;margin:5px auto 0;font-size:12px;color:#718096}
body.unified-tv .schedule-sheet{max-width:min(1550px,96vw)}
body.unified-tv .schedule-sheet-head{margin:0 auto clamp(12px,1.5vh,24px)}
body.unified-tv .schedule-roster-grid{gap:clamp(10px,.8vw,22px)}
body.unified-tv .schedule-person-login{font-size:clamp(13px,1.05vw,21px)}
body.unified-tv .schedule-person-assignment{font-size:clamp(12px,.9vw,18px)}
body.unified-tv .schedule-person-row{min-height:clamp(38px,4.2vh,68px)}
body.unified-tv .schedule-roster-panel-head{font-size:clamp(14px,1vw,20px)}
body.unified-tv .schedule-sheet{animation:incCloudRise .68s cubic-bezier(.2,.75,.22,1) both}
@media(max-width:680px){.schedule-roster-grid{grid-template-columns:1fr}.schedule-roster-panel-head{min-height:42px}.schedule-sheet-head{margin-bottom:18px}}
@media(prefers-reduced-motion:reduce){body.unified-tv .schedule-sheet{animation:none!important}}
`;document.head.append(style);
function status(t){$('scheduleStatus').hidden=false;$('scheduleStatus').textContent=t}
function render(){const plan=selectedPlan();$('scheduleDate').value=currentDate;const s=shifts(currentDate);$('scheduleShift').replaceChildren(...s.map(x=>{const e=document.createElement('option');e.value=x;e.textContent=x;return e}));if(shift)$('scheduleShift').value=shift;$('scheduleShift').disabled=!s.length;for(const b of section.querySelectorAll('[data-offset]'))b.classList.toggle('selected',currentDate===addDay(today(),Number(b.dataset.offset)));$('scheduleDelete').disabled=!plan;
 $('scheduleSummary').textContent=plan?`${workerRows(plan).length} pracowników · ${groups(plan).length} procesów`:'Brak danych';
 if(!plan){$('scheduleContent').innerHTML=`<div class="schedule-empty"><div style="font-size:34px">📅</div><h3>Brak harmonogramu na ${esc(formatDate(currentDate))}</h3><p>Wczytaj plik Excel STAN lub Arkusz1 dla wybranej daty. Możesz wczytać kilka dni naraz.</p></div>`;return}
 $('scheduleContent').innerHTML=rosterView(plan,workerRows(plan),absenceRows(plan),formatDate(plan.date));
}
$('scheduleImport').onclick=()=>$('scheduleFiles').click();
$('scheduleFiles').onchange=async e=>{const files=[...e.target.files];if(!files.length)return;let ok=0;let last=null;const errors=[];for(const file of files){try{if(file.size>10_000_000)throw Error('Plik większy niż 10 MB');const buffer=await file.arrayBuffer();let rows;try{rows=await xlsxRows(buffer,'STAN')}catch(err){if(!/Brak arkusza STAN/.test(err.message))throw err;rows=await xlsxRows(buffer,'Arkusz1')}
 const plan=parse(rows,file.name);plans[key(plan.date,plan.shift)]=plan;ok++;last=plan;
 }catch(err){errors.push(`${file.name}: ${err.message}`)}}if(last){currentDate=last.date;shift=last.shift}try{localStorage.setItem(KEY,JSON.stringify(plans))}catch{errors.push('Nie udało się zapisać w pamięci przeglądarki')}render();status(`Wczytano ${ok} / ${files.length} plików.${errors.length?' Błędy: '+errors.join(' | '):' Harmonogram zapisano lokalnie.'}`);e.target.value='';};
section.querySelectorAll('[data-offset]').forEach(b=>b.onclick=()=>{currentDate=addDay(today(),Number(b.dataset.offset));shift='';render()});$('scheduleDate').onchange=e=>{currentDate=e.target.value||today();shift='';render()};$('scheduleShift').onchange=e=>{shift=e.target.value;render()};$('scheduleDelete').onclick=()=>{const p=selectedPlan();if(!p||!confirm('Usunąć harmonogram '+formatDate(p.date)+' · '+p.shift+'?'))return;delete plans[key(p.date,p.shift)];localStorage.setItem(KEY,JSON.stringify(plans));shift='';render();status('Usunięto wybrany harmonogram.')};
// Count rows rather than processes: one employee may have multiple assignments.
function pageSize(){
 const h=window.innerHeight;
 return h<750?6:h<1050?9:h<1500?12:18;
}
function pageSets(plan){
 const people=workerRows(plan),absence=absenceRows(plan),per=pageSize();
 // Keep all processes for each worker together; only paginate between workers.
 const count=Math.max(1,Math.ceil(people.length/per),Math.ceil(absence.length/per));
 return Array.from({length:count},(_,i)=>({people:people.slice(i*per,(i+1)*per),absence:absence.slice(i*per,(i+1)*per)}));
}
function plansFor(offset){const d=addDay(today(),offset);return Object.values(plans).filter(x=>x.date===d).sort((a,b)=>a.shift.localeCompare(b.shift,'pl'))}
function count(offset){return plansFor(offset).reduce((n,p)=>n+pageSets(p).length,0)}
function tvRender(offset,page=0){tv=true;tvDay=offset?'tomorrow':'today';tvPage=page;$('assign').hidden=false;
 const list=plansFor(offset);if(!list.length){$('scheduleContent').innerHTML='<div class="schedule-empty">Brak harmonogramu</div>';return}
 const total=count(offset),absolutePage=Math.min(Math.max(0,page),total-1);let local=absolutePage,p=list[0];
 for(const candidate of list){const pc=pageSets(candidate).length;p=candidate;if(local<pc)break;local-=pc}
 const selected=pageSets(p)[local];
 $('scheduleContent').innerHTML=rosterView(p,selected.people,selected.absence,formatDate(p.date))+`<div class="schedule-tv-page">${absolutePage+1} / ${total} · ${esc(p.shift)}</div>`;
}
window.incSchedule={has:offset=>plansFor(offset).length>0,count,show:tvRender,restore(){tv=false;render()},isSchedule:()=>!$('assign').hidden};
$('assignment').addEventListener('click',()=>{render();$('tv').disabled=false});$('back').addEventListener('click',()=>{tv=false});render();
})();
