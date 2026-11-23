/* Mr. Robot · Obsada local planning, isolated from source STAN and WMS reports. */
(function(root){
'use strict';
const STORAGE='mrrobot-obsada-plan-v1', FILE='MrRobot_Obsada_Baza.xlsx';
const HIST_HEADERS=['DATA','LOGIN_TH','PROCES','GODZINY','ARKUSZ','TYP','SUROWE'];
const STATUS_HEADERS=['DATA','LOGIN_TH','STATUS','ARKUSZ'];
const TEAM_HEADERS=['DATA_ZMIANY','GRAFIK','LOGIN_TH'];
const TEMPLATE_HEADERS=['NAZWA_ZESPOLU','LOGIN_TH'];
const CONFIRM_HEADERS=['DATA_ZMIANY','GRAFIK','POTWIERDZONO'];
const HIDDEN_PROCESS_HEADERS=['PROCES'];
const EXCLUDED_HEADERS=['KLUCZ'];
const TOMBSTONE_HEADERS=['KLUCZ','USUNIETO'];
function historyExclusionKey(r){return JSON.stringify([r.kind==='status'?'status':'work',norm(r.source),norm(r.date),norm(r.login),norm(r.kind==='status'?r.status:r.process),r.kind==='status'?'':Number(r.hours),norm(r.raw)]);}
const STAN_HEADERS=['PRZEDZIAL','LOGIN_TH','PROCES','DATA_POBRANIA'];
const STAN_DATE_COLUMNS=['DATA_ZMIANY','GRAFIK'];
const SHIFT_OPTIONS=[['06-18','06:00','18:00'],['18-06','18:00','06:00'],['06-16','06:00','16:00'],['16-02','16:00','02:00'],['06-14','06:00','14:00'],['14-22','14:00','22:00']];
const norm=x=>String(x||'').trim();
// Reuse process names consistently across STAN, historical records and local plans.
const processKey=x=>norm(x).normalize('NFKC').replace(/\s+/g,' ').toLocaleUpperCase('pl-PL');
const findProcessMatch=(names,query)=>names.find(name=>processKey(name)===processKey(query))||'';

// Display-only categorization for the read-only roster. This never edits
// PRZYDZIALY, exported hours, reconciled history, or any source data.
const OTHER_DEPARTMENT_DEFAULT=['PACK','PICK','ZWROTY','WYSYŁKA'];
const OTHER_DEPARTMENT_STORAGE='mrrobot-obsada-other-department-v1';
const FUNCTIONAL_PROCESS_STORAGE='mrrobot-obsada-functional-processes-v1';
function readFunctionalProcessSelection(){
 try{
  const parsed=JSON.parse(localStorage.getItem(FUNCTIONAL_PROCESS_STORAGE)||'[]');
  return Array.isArray(parsed)?[...new Set(parsed.map(processKey).filter(Boolean))]:[];
 }catch(_){return [];}
}
function readOtherDepartmentSelection(){
 try{
  const raw=typeof localStorage!=='undefined'?localStorage.getItem(OTHER_DEPARTMENT_STORAGE):null;
  const parsed=raw===null?null:JSON.parse(raw);
  return Array.isArray(parsed)?[...new Set(parsed.map(processKey).filter(Boolean))]:OTHER_DEPARTMENT_DEFAULT.map(processKey);
 }catch(_){return OTHER_DEPARTMENT_DEFAULT.map(processKey);}
}
function splitRosterDepartments(roster,otherSelected,functionalSelected=[]){
 const functional=new Set((functionalSelected||[]).map(processKey));
 const outside=new Set((otherSelected||[]).map(processKey).filter(key=>!functional.has(key)));
 const groups=roster?.groups||[];
 const result={local:[],functional:[],other:[]};
 for(const group of groups){
  const key=processKey(group.name);
  result[functional.has(key)?'functional':outside.has(key)?'other':'local'].push(group);
 }
 const count=arr=>new Set(arr.flatMap(g=>g.people||[]).map(p=>p.login).filter(Boolean)).size;
 return Object.fromEntries(Object.entries(result).map(([kind,items])=>[kind,{groups:items,count:count(items),processCount:items.length}]));
}

function pad(x){return String(x).padStart(2,'0');}
function localDate(date=new Date()){return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;}
function nextDate(){const d=new Date();d.setDate(d.getDate()+1);return localDate(d);}
function minutes(hhmm){const a=/^(\d{2}):(\d{2})$/.exec(hhmm||'');return a?Number(a[1])*60+Number(a[2]):NaN;}
function shiftKey(day,code){return `${day}|${code}`;}
function dropAssignments(records,{day,shift,login,from,to}){return records.filter(r=>!(r.day===day&&r.shift===shift&&r.login===login&&r.slot>=from&&r.slot<to));}
function makeSlots(day,code){
 const shift=SHIFT_OPTIONS.find(x=>x[0]===code);if(!shift||!/^\d{4}-\d{2}-\d{2}$/.test(day))return [];
 const start=minutes(shift[1]),end=minutes(shift[2]);const duration=(end-start+1440)%1440;
 const startDate=new Date(day+'T00:00:00');if(!Number.isFinite(startDate.getTime())||!duration)return [];
 const base=startDate.getTime()+start*60000;return Array.from({length:duration/60},(_,i)=>{
  const from=new Date(base+i*3600000),to=new Date(base+(i+1)*3600000);
  const fmt=d=>`${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return {index:i,start:from.getTime(),end:to.getTime(),from:fmt(from),to:fmt(to),label:fmt(from)+'–'+fmt(to)};
 });
}
function db(){return new Promise((res,rej)=>{const r=indexedDB.open(STORAGE,1);r.onupgradeneeded=()=>r.result.createObjectStore('data');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function get(key){const d=await db();try{return await new Promise((res,rej)=>{const t=d.transaction('data','readonly');const r=t.objectStore('data').get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}finally{d.close();}}
async function put(key,value){const d=await db();try{await new Promise((res,rej)=>{const t=d.transaction('data','readwrite');t.objectStore('data').put(value,key);t.oncomplete=()=>res();t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error);});}finally{d.close();}}
function validRecord(r){return r&&/^\d{4}-\d{2}-\d{2}$/.test(r.day)&&SHIFT_OPTIONS.some(s=>s[0]===r.shift)&&/^\d+$/.test(String(r.slot))&&Number(r.slot)<makeSlots(r.day,r.shift).length&&!!norm(r.login)&&!!norm(r.process);}
function applyAssignment(records,{day,shift,from,to,login,process}){
 const length=makeSlots(day,shift).length;
 if(!norm(login)||!norm(process)||!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<=from||to>length)throw Error('INVALID_ASSIGNMENT');
 const keep=records.filter(r=>!(r.day===day&&r.shift===shift&&r.login===login&&r.slot>=from&&r.slot<to));
 const updated=new Date().toISOString();for(let slot=from;slot<to;slot++)keep.push({day,shift,slot,login,process,updated});
 return keep;
}
function assignFromHour(records,{day,shift,from,login,process}){return applyAssignment(records,{day,shift,from,to:makeSlots(day,shift).length,login,process});}
// Local absence events are kept in the existing STATUSY workbook sheet.
const ABSENCE_SOURCE='Planowanie';
const ABSENCE_TYPES=new Set(['WOLNY','URLOP']);
const EARLY_EXIT_PREFIX='WCZESNIEJSZE_WYJSCIE@';
const LATE_ARRIVAL_PREFIX='SPOZNIENIE@';
// Historical records use @HH:mm; resumed departures use @HH:mm~HH:mm.
// Both stay in the existing STATUSY sheet and preserve the elapsed absence.
function departureBounds(status,day,shift){
 if(!String(status||'').startsWith(EARLY_EXIT_PREFIX))return null;
 const [start,end]=String(status).slice(EARLY_EXIT_PREFIX.length).split('~');
 const slots=makeSlots(day,shift);
 const first=slots.find(x=>x.from===start);
 const last=end?slots.find(x=>x.from===end):null;
 return first?{from:first.start,to:last?last.start:Infinity,label:start}:null;
}
function statusAtHour(status,day,shift,timestamp){
 // Accept separate same-day events so late arrival and early departure coexist.
 const events=Array.isArray(status)?status:[status];
 if(events.some(value=>ABSENCE_TYPES.has(value)))return events.find(value=>ABSENCE_TYPES.has(value));
 const slots=makeSlots(day,shift);
 for(const value of events){
  if(String(value||'').startsWith(LATE_ARRIVAL_PREFIX)){
   const detail=String(value).slice(LATE_ARRIVAL_PREFIX.length);
   const sep=detail.indexOf('|');
   if(sep>=0&&detail.slice(0,sep)!==shift)continue;
   const arrival=slots.find(x=>x.from===(sep>=0?detail.slice(sep+1):detail));
   if(arrival&&timestamp>=slots[0].start&&timestamp<arrival.start)return 'late';
  }
  const bounds=departureBounds(value,day,shift);
  if(bounds&&timestamp>=bounds.from&&timestamp<bounds.to)return 'early';
 }
 return '';
}
// Unlike a whole-day status, interval events never replace one another.
function updateIntervalStatus(statuses,login,date,prefix,value){
 return [...statuses.filter(r=>!(r.source===ABSENCE_SOURCE&&r.login===login&&r.date===date&&String(r.status||'').startsWith(prefix))),...(value?[{date,login,status:value,source:ABSENCE_SOURCE}]:[])];
}
function updateShiftLateStatus(statuses,login,date,shift,hour){
 const keep=statuses.filter(r=>{
  if(r.source!==ABSENCE_SOURCE||r.login!==login||r.date!==date||!String(r.status||'').startsWith(LATE_ARRIVAL_PREFIX))return true;
  const detail=String(r.status).slice(LATE_ARRIVAL_PREFIX.length);
  return detail.includes('|')&&detail.split('|')[0]!==shift;
 });
 return hour?[...keep,{date,login,source:ABSENCE_SOURCE,status:LATE_ARRIVAL_PREFIX+shift+'|'+hour}]:keep;
}

function absenceDates(start,end){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||start>end)throw Error('INVALID_ABSENCE_RANGE');
 const a=new Date(start+'T12:00:00'),b=new Date(end+'T12:00:00');
 if(!Number.isFinite(a.getTime())||!Number.isFinite(b.getTime())||localDate(a)!==start||localDate(b)!==end)throw Error('INVALID_ABSENCE_RANGE');
 const out=[];
 while(a<=b){if(out.length>=366)throw Error('ABSENCE_RANGE_TOO_LONG');out.push(localDate(a));a.setDate(a.getDate()+1);}
 return out;
}
function updateLocalAbsences(statuses,logins,dates,status){
 const keys=new Set(logins.flatMap(login=>dates.map(date=>date+'|'+login)));
 const existing=statuses.filter(r=>!(r.source===ABSENCE_SOURCE&&keys.has(r.date+'|'+r.login)));
 return status?[...existing,...logins.flatMap(login=>dates.map(date=>({date,login,status,source:ABSENCE_SOURCE})))]:existing;
}
function cutAfterHour(records,{day,shift,login,from}){
 const len=makeSlots(day,shift).length;
 if(!Number.isInteger(from)||from<0||from>=len)throw Error('INVALID_DEPARTURE_HOUR');
 return records.filter(r=>!(r.day===day&&r.shift===shift&&r.login===login&&r.slot>=from));
}
// Resolve different shift codes to the same real clock hour. Midnight rollover
// is handled by makeSlots; a login is counted once even across two rosters.
function simultaneousAssignments(records,day,shift,slotIndex){
 const selected=makeSlots(day,shift)[slotIndex];if(!selected)return {people:[],conflicts:[]};
 const byLogin=new Map(),conflicts=[];
 for(const r of records){
  const hour=makeSlots(r.day,r.shift)[r.slot];
  if(!hour||hour.start!==selected.start)continue;
  const prev=byLogin.get(r.login);
  if(!prev){byLogin.set(r.login,r);continue;}
  if(prev.day!==r.day||prev.shift!==r.shift||processKey(prev.process)!==processKey(r.process))conflicts.push({login:r.login,first:prev,second:r});
  // Prefer the currently edited schedule in ambiguous imported local data.
  if(r.day===day&&r.shift===shift)byLogin.set(r.login,r);
 }
 return {people:[...byLogin.values()],conflicts};
}
// One display-only timeline for all rosters on the selected planning date.
// Assignment records keep their original day/shift/slot keys unchanged.
function combinedTimeline(day,shift,teams={},records=[]){
 const candidates=new Set([shift]);
 for(const key of Object.keys(teams||{})){
  const [d,code]=key.split('|');if(d===day&&SHIFT_OPTIONS.some(s=>s[0]===code))candidates.add(code);
 }
 for(const r of records||[])if(r.day===day&&SHIFT_OPTIONS.some(s=>s[0]===r.shift))candidates.add(r.shift);
 const byTime=new Map();
 for(const code of candidates)for(const slot of makeSlots(day,code)){
  if(!byTime.has(slot.start))byTime.set(slot.start,{start:slot.start,end:slot.end,from:slot.from,to:slot.to,shifts:[]});
  byTime.get(slot.start).shifts.push(code);
 }
 return [...byTime.values()].sort((a,b)=>a.start-b.start);
}
// A read-only view across simultaneous rosters. Do not add, remove, or
// aggregate assignment hours here: each login appears once at this instant.
function rosterAtTimestamp(records,timestamp,preferredDay='',preferredShift=''){
 const byLogin=new Map(),conflicts=[];
 for(const r of records||[]){
  const slot=makeSlots(r.day,r.shift)[r.slot];
  if(!slot||slot.start!==timestamp||!norm(r.login)||!norm(r.process))continue;
  const old=byLogin.get(r.login);
  if(old){
   if(old.day!==r.day||old.shift!==r.shift||processKey(old.process)!==processKey(r.process))conflicts.push({login:r.login,first:old,second:r});
   if(r.day===preferredDay&&r.shift===preferredShift)byLogin.set(r.login,r);
  }else byLogin.set(r.login,r);
 }
 const groups=new Map();
 for(const r of byLogin.values()){
  const process=norm(r.process),key=processKey(process);
  if(!groups.has(key))groups.set(key,{name:process,people:[]});
  groups.get(key).people.push({login:r.login,shift:r.shift,day:r.day});
 }
 return {origin:byLogin.size?'plan':'empty',groups:[...groups.values()].map(g=>({...g,count:g.people.length})),count:byLogin.size,conflicts};
}
function shiftHourForTimestamp(day,shift,timestamp){return makeSlots(day,shift).findIndex(slot=>slot.start===timestamp);}
function autoHourConfirmed(r,now=Date.now()){const slot=makeSlots(r.day,r.shift)[Number(r.slot)];return Boolean(slot&&slot.end<=now);}
function finishedHourCount(records,now=Date.now()){return records.reduce((n,r)=>n+(autoHourConfirmed(r,now)?1:0),0);}
function sheetRows(records,confirmations={}){const shifts=new Map();for(const r of records){const key=shiftKey(r.day,r.shift);if(!shifts.has(key))shifts.set(key,{day:r.day,shift:r.shift});}return {shifts:[['DATA_ZMIANY','GRAFIK'],...[...shifts.values()].sort((a,b)=>a.day.localeCompare(b.day)).map(x=>[x.day,x.shift])],assignments:[['DATA_ZMIANY','GRAFIK','GODZINA_OD','GODZINA_DO','LOGIN_TH','PROCES','STATUS','ZMIENIONO'],...records.slice().sort((a,b)=>a.day.localeCompare(b.day)||a.shift.localeCompare(b.shift)||a.slot-b.slot||a.login.localeCompare(b.login)).map(r=>{const slot=makeSlots(r.day,r.shift)[r.slot];const format=stamp=>{const d=new Date(stamp);return localDate(d)+' '+pad(d.getHours())+':'+pad(d.getMinutes());};return [r.day,r.shift,format(slot.start),format(slot.end),r.login,r.process,autoHourConfirmed(r)?'POTWIERDZONE_AUTO':'PLAN',r.updated||''];})]};}
function buildWorkbook(XLSX,records,history=[],statuses=[],teams={},stan=null,hiddenProcesses=[],confirmations={},excludedHistory=[],teamTemplates={},tombstones=[]){const wb=XLSX.utils.book_new();const rows=sheetRows(records,confirmations);const hist=[HIST_HEADERS,...history.map(r=>[r.date,r.login,r.process,r.hours,r.source,r.sourceType,r.raw||''])];const days=[STATUS_HEADERS,...statuses.map(r=>[r.date,r.login,r.status,r.source])];const teamRows=[TEAM_HEADERS,...Object.entries(teams).flatMap(([key,people])=>{const [day,shift]=key.split('|');return (Array.isArray(people)?people:[]).map(login=>[day,shift,login]);})];const stanRows=[[...STAN_HEADERS,...STAN_DATE_COLUMNS],...(stan?.intervals||[]).flatMap(iv=>(iv.people||[]).map(p=>[iv.label,p.login,p.process,stan.updatedAt||'',stan.day||'',stan.shift||'']))];for(const [sheet,data] of [['PRZYDZIALY',rows.assignments],['ZMIANY',rows.shifts],['HISTORIA_IMPORTOWANA',hist],['STATUSY',days],['ZESPOLY',teamRows],['STAN_SNAPSHOT',stanRows],['PROCESY_UKRYTE',[HIDDEN_PROCESS_HEADERS,...hiddenProcesses.map(name=>[name])]],['POTWIERDZENIA',[CONFIRM_HEADERS,...Object.entries(confirmations).sort().map(([key,at])=>[...key.split('|'),at])]],['WYKLUCZENIA',[EXCLUDED_HEADERS,...excludedHistory.map(key=>[key])]],['SZABLONY_ZESPOLOW',[TEMPLATE_HEADERS,...Object.entries(teamTemplates).flatMap(([name,people])=>(Array.isArray(people)?people:[]).map(login=>[name,login]))]],['SYNC_USUNIECIA',[TOMBSTONE_HEADERS,...tombstones.map(t=>[t.key,t.at])]],['INFO',[['MR_ROBOT_OBSADA_BAZA','2'],['FORMAT','Imported history and planned hours are distinct. Do not sum as verified work.'],['GENERATED',new Date().toISOString()]]]]){const ws=XLSX.utils.aoa_to_sheet(data);ws['!cols']=data[0].map((_,i)=>({wch:i===5?28:20}));XLSX.utils.book_append_sheet(wb,ws,sheet);}return wb;}
function readWorkbook(XLSX,wb){if(!wb.Sheets.PRZYDZIALY)throw Error('NO_LOCAL_ASSIGNMENTS_SHEET');const rows=XLSX.utils.sheet_to_json(wb.Sheets.PRZYDZIALY,{header:1,raw:false,defval:''});if(rows[0]?.slice(0,6).join('|')!==['DATA_ZMIANY','GRAFIK','GODZINA_OD','GODZINA_DO','LOGIN_TH','PROCES'].join('|'))throw Error('INVALID_LOCAL_DATABASE');const records=[];for(const row of rows.slice(1)){if(!norm(row[0]))continue;const day=norm(row[0]),shift=norm(row[1]),from=norm(row[2]),login=norm(row[4]),process=norm(row[5]);const slots=makeSlots(day,shift),slot=slots.find(s=>`${localDate(new Date(s.start))} ${s.from}`===from);const record={day,shift,slot:slot?.index,login,process,updated:norm(row[7])};if(!validRecord(record))throw Error('INVALID_LOCAL_RECORD');records.push(record);}const keys=new Set();for(const r of records){const key=[r.day,r.shift,r.slot,r.login].join('|');if(keys.has(key))throw Error('DUPLICATE_LOCAL_RECORD');keys.add(key);}return records;}
function readDatabase(XLSX,wb){
 const records=readWorkbook(XLSX,wb);
 function lines(sheet,expected){if(!wb.Sheets[sheet])return [];const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{header:1,raw:false,defval:''});if(rows[0]?.slice(0,expected.length).join('|')!==expected.join('|'))throw Error('INVALID_'+sheet+'_HEADERS');return rows.slice(1).filter(r=>norm(r[0]));}
 const history=lines('HISTORIA_IMPORTOWANA',HIST_HEADERS).map(r=>({date:norm(r[0]),login:norm(r[1]),process:norm(r[2]),hours:Number(String(r[3]).replace(',','.')),source:norm(r[4]),sourceType:norm(r[5])||'main',raw:norm(r[6])}));
 const statuses=lines('STATUSY',STATUS_HEADERS).map(r=>({date:norm(r[0]),login:norm(r[1]),status:norm(r[2]),source:norm(r[3])}));
 const shiftTeams={};for(const r of lines('ZESPOLY',TEAM_HEADERS)){const day=norm(r[0]),shift=norm(r[1]),login=norm(r[2]);if(!/^\d{4}-\d\d-\d\d$/.test(day)||!SHIFT_OPTIONS.some(x=>x[0]===shift)||!login)throw Error('INVALID_SHIFT_TEAM');const k=shiftKey(day,shift);if(!shiftTeams[k])shiftTeams[k]=[];if(!shiftTeams[k].includes(login))shiftTeams[k].push(login);}
 const stanRows=lines('STAN_SNAPSHOT',STAN_HEADERS);const stanIntervals=new Map();for(const r of stanRows){const label=norm(r[0]),login=norm(r[1]),process=norm(r[2]);if(!label||!login||!process)throw Error('INVALID_STAN_SNAPSHOT');if(!stanIntervals.has(label))stanIntervals.set(label,{label,people:[]});stanIntervals.get(label).people.push({login,process});}
 const hiddenProcesses=[...new Set(lines('PROCESY_UKRYTE',HIDDEN_PROCESS_HEADERS).map(r=>processKey(r[0])).filter(Boolean))];
 const confirmations={};for(const r of lines('POTWIERDZENIA',CONFIRM_HEADERS)){const [day,shift,at]=r.map(norm);if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!SHIFT_OPTIONS.some(x=>x[0]===shift)||!at||Number.isNaN(Date.parse(at)))throw Error('INVALID_SHIFT_CONFIRMATION');confirmations[shiftKey(day,shift)]=at;}
 const excludedHistory=[...new Set(lines('WYKLUCZENIA',EXCLUDED_HEADERS).map(r=>norm(r[0])).filter(Boolean))];
 const teamTemplates={};for(const row of lines('SZABLONY_ZESPOLOW',TEMPLATE_HEADERS)){const name=norm(row[0]),login=norm(row[1]);if(!name||!login||name.length>80)throw Error('INVALID_TEAM_TEMPLATE');if(!teamTemplates[name])teamTemplates[name]=[];if(!teamTemplates[name].includes(login))teamTemplates[name].push(login);}
 const tombstones=lines('SYNC_USUNIECIA',TOMBSTONE_HEADERS).map(r=>({key:norm(r[0]),at:norm(r[1])}));
 if(tombstones.some(t=>!t.key||!Number.isFinite(Date.parse(t.at))))throw Error('INVALID_SYNC_TOMBSTONE');
 const stan=stanRows.length?{updatedAt:norm(stanRows[0][3]),day:norm(stanRows[0][4]),shift:norm(stanRows[0][5]),intervals:[...stanIntervals.values()]}:null;
 if(history.some(r=>!/^\d{4}-\d\d-\d\d$/.test(r.date)||!r.login||!r.process||!(r.hours>0&&r.hours<=24)))throw Error('INVALID_HISTORICAL_RECORD');
 if(statuses.some(r=>!/^\d{4}-\d\d-\d\d$/.test(r.date)||!r.login||!r.status))throw Error('INVALID_STATUS_RECORD');
 return {records,history,statuses,shiftTeams,stan,hiddenProcesses,confirmations,excludedHistory,teamTemplates,tombstones};
}
function replaceImported(existing, incoming, sourceNames, keyFn){
 // Only replace employee/day cells actually present in the new workbook.
 // This preserves previous years when a monthly worksheet is reused for a new year,
 // and preserves duplicate processes in one source cell.
 const affected=new Set(incoming.map(r=>[r.source,r.date,r.login].join('|')));
 return [...existing.filter(r=>!affected.has([r.source,r.date,r.login].join('|'))),...incoming];
}
function create({reactive,computed,roster,source,sourceName,language}){
 const state=reactive({day:localDate(),printDay:nextDate(),printShift:'all',printShowAbsent:false,shift:'06-18',mode:false,records:[],selectedLogin:'',search:'',newProcess:'',from:0,to:1,folderName:'',busy:false,dirty:false,status:'',error:'',active:false,additionalProcesses:[],hiddenProcesses:[],historyWindow:'week',importedHistory:[],importedStatuses:[],importedSource:'',importedAt:'',unrecognized:0,stanSnapshot:null,stanDate:'',stanShift:'',showDatabase:false,staffFilter:'all',processFilter:'',processDropdownOpen:false,showAllProcesses:false,visibleWorkers:45,removingLogin:'',shiftTeams:{},teamTemplates:{},templateName:'',selectedTemplate:'',confirmations:{},excludedHistory:[],teamSearch:'',teamPicker:false,undoAvailable:false,undoLabel:'',lastExcelSync:'',lastBrowserSave:'',syncError:'',pendingChanges:0,tombstones:[],mergePreview:null,mergeChoices:{},mergeFileName:'',mergeBusy:false,mergeMessage:'',mergeFolderAccess:'unknown',stanChanges:[],stanReviewDay:'',stanReviewShift:'',stanNotice:'',actionLogin:'',actionPanel:'menu',processHighlight:'',actionSelected:[],actionType:'WOLNY',actionFrom:localDate(),actionTo:localDate(),actionHour:0,readonlyHourStamp:null,combinedView:true,extraTemplate:'',extraShift:'14-22',teamSetupOpen:false,teamSetupMode:'saved',teamSetupTemplate:'',teamSetupShift:'14-22',teamSetupName:'',teamRosterOpen:false,dayTeamMenu:'',processMenuLogin:'',dayTeamScheduleOpen:false,dayTeamTargetShift:'',dayTeamNewShift:'',templateManagerOpen:false,templateDraftName:'',templateDraftMembers:[],templateDraftSearch:'',templateDraftError:'',otherDepartmentProcesses:readOtherDepartmentSelection(),functionalProcesses:readFunctionalProcessSelection(),otherDepartmentSettingsOpen:false,departmentDragProcess:"",departmentDragOver:""});
 let folderHandle=null,writing=false,queued=false,lastExportHash=null,undoSnapshot=null,revision=0,exportRevision=0,lastSavedRecords=[];
 const fingerprint=(records,history=[],statuses=[],teams={},stan=null,hiddenProcesses=[],confirmations={},excludedHistory=[],teamTemplates={},tombstones=[])=>JSON.stringify({tombstones:tombstones.map(t=>[t.key,t.at]).sort((a,b)=>a[0].localeCompare(b[0])),excludedHistory:[...excludedHistory].sort(),...(Object.keys(confirmations).length?{confirmations:Object.entries(confirmations).sort((a,b)=>a[0].localeCompare(b[0]))}:{}),stan:stan?{updatedAt:stan.updatedAt,...(stan.day?{day:stan.day,shift:stan.shift}:{}),intervals:stan.intervals.map(iv=>[iv.label,(iv.people||[]).map(p=>[p.login,p.process])])}:null,teams:Object.entries(teams).map(([k,v])=>[k,[...v].sort()]).sort((a,b)=>a[0].localeCompare(b[0])),records:records.map(r=>[r.day,r.shift,r.slot,r.login,r.process]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),history:history.map(r=>[r.date,r.login,r.process,r.hours,r.source,r.sourceType]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),statuses:statuses.map(r=>[r.date,r.login,r.status,r.source]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),...(hiddenProcesses.length?{hiddenProcesses:[...hiddenProcesses].sort()}: {}),...(Object.keys(teamTemplates).length?{teamTemplates:Object.entries(teamTemplates).map(([k,v])=>[k,[...v].sort()]).sort((a,b)=>a[0].localeCompare(b[0]))}: {})});
 // Compare what actually survives XLSX serialization, not the live STAN model.
 // STAN_SNAPSHOT stores rows only for intervals with people, so empty hourly
 // intervals cannot be expected to reappear after reading the workbook.
 const persistedFingerprint=(XLSX,records,history=[],statuses=[],teams={},stan=null,hiddenProcesses=[],confirmations={},excludedHistory=[],teamTemplates={},tombstones=[])=>{
  const model=readDatabase(XLSX,buildWorkbook(XLSX,records,history,statuses,teams,stan,hiddenProcesses,confirmations,excludedHistory,teamTemplates,tombstones));
  return fingerprint(model.records,model.history,model.statuses,model.shiftTeams,model.stan,model.hiddenProcesses,model.confirmations,model.excludedHistory,model.teamTemplates,model.tombstones);
 };
 const legacyFingerprint=records=>JSON.stringify(records.map(r=>[r.day,r.shift,r.slot,r.login,r.process]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
 const shifts=SHIFT_OPTIONS.map(([value,start,end])=>({value,label:start+'–'+end}));
 const slots=computed(()=>makeSlots(state.day,state.shift));
 const sharedTimeline=computed(()=>combinedTimeline(state.day,state.shift,state.shiftTeams,state.records));
 const activeTeamShifts=computed(()=>{
  const codes=new Set([state.shift]);
  for(const key of Object.keys(state.shiftTeams)){
   const sep=key.lastIndexOf('|');if(sep>=0&&key.slice(0,sep)===state.day)codes.add(key.slice(sep+1));
  }
  for(const r of state.records)if(r.day===state.day)codes.add(r.shift);
  return shifts.filter(s=>codes.has(s.value)).map(s=>({...s,count:new Set([...(state.shiftTeams[shiftKey(state.day,s.value)]||[]),...state.records.filter(r=>r.day===state.day&&r.shift===s.value).map(r=>r.login)]).size}));
 });
 // A read-only, on-demand printable plan. It never changes local records or imported history.
 const tomorrowPlan=computed(()=>{
  const day=state.printDay;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return {day,teams:[],absentPeople:[],total:0,assigned:0,missing:0};
  const candidates=new Set();
  for(const key of Object.keys(state.shiftTeams)){
   const separator=key.lastIndexOf('|');
   if(separator>0&&key.slice(0,separator)===day)candidates.add(key.slice(separator+1));
  }
  for(const r of state.records)if(r.day===day)candidates.add(r.shift);
  const selected=state.printShift;
  const teams=[];
  for(const sh of shifts){
   if(!candidates.has(sh.value)||(selected!=='all'&&selected!==sh.value))continue;
   const shift=sh.value, slots=makeSlots(day,shift);
   const members=[...new Set([...(state.shiftTeams[shiftKey(day,shift)]||[]),...state.records.filter(r=>r.day===day&&r.shift===shift).map(r=>r.login)])].sort((a,b)=>a.localeCompare(b));
   if(!members.length)continue;
   const template=Object.entries(state.teamTemplates).find(([name,users])=>Array.isArray(users)&&users.length===members.length&&users.every(login=>members.includes(login)));
   const people=[];
   for(const login of members){
    const statuses=state.importedStatuses.filter(r=>r.source===ABSENCE_SOURCE&&r.date===day&&r.login===login).map(r=>r.status);
    const status=statuses.find(v=>ABSENCE_TYPES.has(v))||'';
    const bySlot=new Map(state.records.filter(r=>r.day===day&&r.shift===shift&&r.login===login).map(r=>[Number(r.slot),norm(r.process)]));
    const segments=[];
    for(const slot of slots){
     const absent=statusAtHour(statuses,day,shift,slot.start);
     const process=absent?'':(bySlot.get(slot.index)||'');
     const label=absent?(absent==='early'?'EARLY_EXIT':absent==='late'?'LATE_ARRIVAL':absent):process;
     if(!label)continue;
     const last=segments[segments.length-1];
     if(last&&last.key===label&&last.end===slot.start){last.end=slot.end;last.to=slot.to;}
     else segments.push({key:label,process:!absent,label,from:slot.from,to:slot.to,start:slot.start,end:slot.end,absent:!!absent});
    }
    const work=segments.filter(x=>x.process);
    const absent=segments.filter(x=>x.absent);
    const row={login,parts:work,absences:absent,unassigned:work.length===0&&absent.length===0};
    // Full-day leave is displayed in a separate block, never as a working shift.
    if(!ABSENCE_TYPES.has(status))people.push(row);
   }
   teams.push({shift,label:sh.label,name:template?.[0]||sh.label,people,total:members.length,assigned:people.filter(p=>p.parts.length).length});
  }
  const known=new Set(teams.flatMap(t=>t.people.map(p=>p.login)));
  const absentMap=new Map();
  if(state.printShowAbsent){
   for(const row of state.importedStatuses){
    if(row.date!==day||!ABSENCE_TYPES.has(row.status)||!row.login)continue;
    if(row.source!==ABSENCE_SOURCE)continue;
    // A saved day-off or leave remains visible even when no shift assignment exists.
    if(!known.has(row.login))absentMap.set(row.login,{login:row.login,status:row.status});
   }
  }
  const absentPeople=[...absentMap.values()].sort((a,b)=>a.status.localeCompare(b.status)||a.login.localeCompare(b.login));
  return {day,teams,absentPeople,total:teams.reduce((n,t)=>n+t.people.length,0),assigned:teams.reduce((n,t)=>n+t.assigned,0),missing:teams.reduce((n,t)=>n+t.people.filter(p=>p.unassigned).length,0)};
 });
 // Export-only selection. Does not modify planned hours, database records or PDF.
 const EXPORT_PREF_KEY='mr_obsada_excel_selection_v1';
 const PRINT_PREF_KEY='mr_obsada_print_selection_v1';
 function readExportPrefs(){
  try{const raw=JSON.parse(root.localStorage?.getItem(EXPORT_PREF_KEY)||'{}');return {excludedWorkers:raw.excludedWorkers&&typeof raw.excludedWorkers==='object'?raw.excludedWorkers:{},excludedProcesses:raw.excludedProcesses&&typeof raw.excludedProcesses==='object'?raw.excludedProcesses:{}};}
  catch(_){return {excludedWorkers:{},excludedProcesses:{}};}
 }
 const exportPrefs=readExportPrefs();
 function readPrintPrefs(){
  try{const raw=JSON.parse(root.localStorage?.getItem(PRINT_PREF_KEY)||'{}');return {excludedWorkers:raw.excludedWorkers&&typeof raw.excludedWorkers==='object'?raw.excludedWorkers:{},excludedProcesses:raw.excludedProcesses&&typeof raw.excludedProcesses==='object'?raw.excludedProcesses:{}};}
  catch(_){return {excludedWorkers:{},excludedProcesses:{}};}
 }
 const printPrefs=readPrintPrefs();
 state.exportMode='excel';
 state.printExcludedWorkers=printPrefs.excludedWorkers;
 state.printExcludedProcesses=printPrefs.excludedProcesses;
 state.exportOpen=false;
 state.exportSearch='';
 state.exportTeam='all';
 state.exportExcludedWorkers=exportPrefs.excludedWorkers;
 state.exportExcludedProcesses=exportPrefs.excludedProcesses;
 function rememberExportPrefs(){
  try{root.localStorage?.setItem(EXPORT_PREF_KEY,JSON.stringify({excludedWorkers:state.exportExcludedWorkers,excludedProcesses:state.exportExcludedProcesses}));}catch(_){/* private browsing or storage disabled */}
 }
 function rememberPrintPrefs(){
  try{root.localStorage?.setItem(PRINT_PREF_KEY,JSON.stringify({excludedWorkers:state.printExcludedWorkers,excludedProcesses:state.printExcludedProcesses}));}catch(_){/* private browsing or storage disabled */}
 }
 const selectionWorkers=()=>state.exportMode==='print'?state.printExcludedWorkers:state.exportExcludedWorkers;
 const selectionProcesses=()=>state.exportMode==='print'?state.printExcludedProcesses:state.exportExcludedProcesses;
 const rememberSelection=()=>state.exportMode==='print'?rememberPrintPrefs():rememberExportPrefs();
 const exportCandidates=computed(()=>{
  const report=tomorrowPlan.value, people=new Map();
  for(const team of report.teams)for(const person of team.people){
   let worker=people.get(person.login);
   if(!worker){worker={login:person.login,teams:[],processes:[],absent:false,status:''};people.set(person.login,worker);}
   if(!worker.teams.some(x=>x.shift===team.shift))worker.teams.push({shift:team.shift,label:team.name});
   for(const p of person.parts){const name=p.key==='EARLY_EXIT'?'Wcześniejsze wyjście':p.key;if(name&&!worker.processes.includes(name))worker.processes.push(name);}
   if(state.printShowAbsent)for(const a of person.absences){const name=a.key==='EARLY_EXIT'?'Wcześniejsze wyjście':a.key;if(name&&!worker.processes.includes(name))worker.processes.push(name);}
  }
  const workers=[...people.values()].sort((a,b)=>a.login.localeCompare(b.login,undefined,{numeric:true}));
  const absent=state.printShowAbsent?report.absentPeople.map(p=>({login:p.login,teams:[],processes:[],absent:true,status:p.status})):[];
  return {workers,absent,total:workers.length+absent.length};
 });
 const exportVisiblePeople=computed(()=>{
  const q=state.exportSearch.trim().toLocaleLowerCase(),team=state.exportTeam;
  return exportCandidates.value.workers.filter(p=>(team==='all'||p.teams.some(t=>t.shift===team))&&(!q||p.login.toLocaleLowerCase().includes(q)||p.processes.some(x=>x.toLocaleLowerCase().includes(q))||p.teams.some(t=>t.label.toLocaleLowerCase().includes(q))));
 });
 const exportVisibleAbsent=computed(()=>{
  const q=state.exportSearch.trim().toLocaleLowerCase();
  return state.exportTeam==='all'?exportCandidates.value.absent.filter(p=>!q||p.login.toLocaleLowerCase().includes(q)||p.status.toLocaleLowerCase().includes(q)):[];
 });
 function exportWorkerKey(p){return (p.absent?'absent:':'worker:')+p.login;}
 function exportPartKey(login,process){return JSON.stringify([login,process]);}
 function exportWorkerChecked(p){return selectionWorkers()[exportWorkerKey(p)]!==true;}
 function exportPartChecked(p,process){return selectionProcesses()[exportPartKey(p.login,process)]!==true;}
 function setExportWorker(p,checked){const map=selectionWorkers(),key=exportWorkerKey(p);if(checked)delete map[key];else map[key]=true;rememberSelection();}
 function setExportPart(p,process,checked){const map=selectionProcesses(),key=exportPartKey(p.login,process);if(checked)delete map[key];else map[key]=true;rememberSelection();}
 function toggleVisibleExport(checked){for(const p of [...exportVisiblePeople.value,...exportVisibleAbsent.value])setExportWorker(p,checked);}
 function openTomorrowExport(){
  if(!tomorrowPlan.value.teams.length)return false;
  state.exportMode='excel';state.exportSearch='';state.exportTeam='all';state.exportOpen=true;return true;
 }
 function openTomorrowPrint(){
  if(!tomorrowPlan.value.teams.length)return false;
  state.exportMode='print';state.exportSearch='';state.exportTeam='all';state.exportOpen=true;return true;
 }
 function closeTomorrowExport(){state.exportOpen=false;}
 const exportSelectedCount=computed(()=>[...exportCandidates.value.workers,...exportCandidates.value.absent].filter(p=>exportWorkerChecked(p)&&(p.absent||!p.processes.length||p.processes.some(name=>exportPartChecked(p,name)))).length);
 function confirmTomorrowExport(){
  const ok=state.exportMode==='print'?printTomorrowPlan(true):exportTomorrowExcel();
  if(ok)state.exportOpen=false;return ok;
 }
 const tomorrowPlanAvailableShifts=computed(()=>{
  const codes=new Set();
  for(const key of Object.keys(state.shiftTeams)){const sep=key.lastIndexOf('|');if(sep>0&&key.slice(0,sep)===state.printDay)codes.add(key.slice(sep+1));}
  for(const r of state.records)if(r.day===state.printDay)codes.add(r.shift);
  return [...codes];
 });
 function printTomorrowPlan(selectedOnly=false){
  const original=tomorrowPlan.value;
  const keep=(p)=>state.printExcludedWorkers[exportWorkerKey(p)]!==true;
  const keepProcess=(login,key)=>state.printExcludedProcesses[exportPartKey(login,key)]!==true;
  const report=selectedOnly?{
   ...original,
   teams:original.teams.map(team=>({...team,people:team.people.filter(person=>keep({login:person.login,absent:false})).map(person=>({
    ...person,
    parts:person.parts.filter(part=>keepProcess(person.login,part.key)),
    absences:person.absences.filter(part=>keepProcess(person.login,part.key))
   })).filter(person=>person.parts.length||person.absences.length||(!original.teams.some(t=>t.people.some(p=>p.login===person.login&&(p.parts.length||p.absences.length)))))})).filter(team=>team.people.length),
   absentPeople:original.absentPeople.filter(person=>keep({login:person.login,absent:true}))
  }:original;
  if(!report.teams.length&&!report.absentPeople.length)return false;
  const lang=language?.()||'pl';
  const translate=(pl,ru,en,uk)=>({pl,ru,en,uk}[lang]||pl);
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const label=segment=>segment.key==='EARLY_EXIT'?translate('Wcześniejsze wyjście','Ранний уход','Early departure','Ранній вихід'):segment.key;
  const fmt=segment=>esc(label(segment));
  const noProcess=translate('Bez przydziału','Без назначения','Unassigned','Без призначення');
  const displayDay=report.day.split('-').reverse().join('.');
  const html=`<!doctype html><html lang="${esc(lang)}"><head><meta charset="utf-8"><title>INCYDENTY · STAN · ${esc(displayDay)}</title><style>
  @page{size:A4 portrait;margin:8mm}
  *{box-sizing:border-box}
  html,body{width:100%;margin:0;padding:0}
  body{font-family:Inter,"Segoe UI",Arial,sans-serif;color:#19283c;font-size:11px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .document-header{text-align:center;padding:7px 0 15px;margin-bottom:13px}
  .document-header h1{font-size:27px;line-height:1.06;letter-spacing:.025em;font-weight:800;margin:0;color:#17283f}
  .document-header .subhead{font-size:21px;line-height:1.2;letter-spacing:.015em;font-weight:750;margin-top:5px;color:#233a56}
  .document-header:after{content:"";display:block;width:46px;height:3px;border-radius:5px;background:#9cacbe;margin:13px auto 0}
  .grid{display:grid;grid-template-columns:${report.absentPeople.length&&report.teams.length?'minmax(0,1fr) minmax(0,1fr) minmax(0,.74fr)' : report.absentPeople.length?'minmax(0,1fr)':`repeat(${Math.max(1,Math.min(report.teams.length,2))},minmax(0,1fr))`};gap:8px;align-items:start}
  .team{min-width:0;border:1px solid #d9e1ea;border-radius:12px;overflow:hidden;break-inside:auto;background:#fff}
  .team h2{display:flex;align-items:center;justify-content:space-between;gap:4px;font-size:14px;line-height:1.2;font-weight:750;background:#eaf0f6;padding:11px 10px;margin:0;color:#1c3049;break-after:avoid}
  .team h2 span{min-width:0;overflow-wrap:anywhere}
  .team.absent h2{background:#eef0f3}
  .team.absent td:first-child{width:70px}
  .team h2 small{font-size:10px;color:#53677e;font-weight:600;white-space:nowrap}
  table{width:100%;border-collapse:collapse;table-layout:fixed}
  tr{break-inside:avoid;page-break-inside:avoid}
  td{padding:9px 7px;border-bottom:1px solid #e0e6ef;vertical-align:top;line-height:1.36}
  tr:last-child td{border-bottom:0}
  td:first-child{width:83px;font-weight:800;font-size:11.5px;white-space:nowrap;color:#1e324c;letter-spacing:-.015em;border-right:1px solid #e0e6ef}
  td:nth-child(2){padding:9px 7px;text-align:center;vertical-align:middle}
  tr:nth-child(even){background:#f5f7fa}
  .entry{display:block;line-height:1.42;margin:0 0 4px;overflow-wrap:anywhere;font-weight:650;font-size:11px}
  .entry:last-child{margin-bottom:0}
  .entry small{display:inline;font-size:9.6px;font-weight:500;color:#62758a;white-space:normal;margin-left:2px}
  .muted{color:#7e8da0;font-weight:450}
  button{font:inherit;padding:8px 14px;border:1px solid #8897aa;border-radius:6px;background:white;cursor:pointer}
  @media print{.actions{display:none!important}html,body{width:auto}.grid{gap:8px}.team{box-shadow:none}}
  @media screen{body{max-width:810px;margin:20px auto;padding:0 12px}.actions{position:sticky;top:0;background:white;padding:8px 0 12px;z-index:5}}
  @media screen and (max-width:550px){.grid{grid-template-columns:1fr}}
  </style></head><body><div class="actions"><button onclick="window.print()">${esc(translate('Drukuj','Печать','Print','Друк'))}</button></div><header class="document-header"><h1>INCYDENTY</h1><div class="subhead">STAN - ${esc(displayDay)}</div></header><main class="grid">${report.teams.map(team=>`<section class="team"><h2><span>${esc(team.name)}</span><small>${esc(team.label)}</small></h2><table><tbody>${team.people.map(person=>`<tr><td>${esc(person.login)}</td><td>${person.parts.length?person.parts.map(part=>`<span class="entry">${fmt(part)}</span>`).join(''):'<span class="muted">'+esc(noProcess)+'</span>'}${state.printShowAbsent&&person.absences.length?person.absences.map(part=>`<span class="entry muted">${fmt(part)}</span>`).join(''):''}</td></tr>`).join('')}</tbody></table></section>`).join('')}${report.absentPeople.length?`<section class="team absent"><h2><span>${esc(translate('Nieobecni','Отсутствуют','Absent','Відсутні'))}</span></h2><table><tbody>${report.absentPeople.map(p=>`<tr><td>${esc(p.login)}</td><td>${esc(p.status)}</td></tr>`).join('')}</tbody></table></section>`:''}</main></body></html>`;
  const win=root.open('','_blank');if(!win){state.error='PRINT_POPUP_BLOCKED';return false;}
  win.document.open();win.document.write(html);win.document.close();win.focus();return true;
 }
 // Separate human-readable export, never the local Obsada database workbook.
 // Preserve every distinct planned process when time ranges are hidden.
 function exportTomorrowExcel(){
  const report=tomorrowPlan.value;
  if(!report.teams.length||!root.XLSX?.utils)return false;
  const xlsx=root.XLSX;
  const date=report.day.split('-').reverse().join('.');
  const noProcess=({pl:'Bez przydziału',ru:'Без назначения',en:'Unassigned',uk:'Без призначення'})[language?.()||'pl']||'Bez przydziału';
  const workerByLogin=new Map(exportCandidates.value.workers.map(p=>[p.login,p]));
  const sortLogin=(a,b)=>a[0].localeCompare(b[0],undefined,{numeric:true});
  // Keep each selected shift/team as its own block, exactly as in Plan na jutro.
  // Only the Excel layout changes; the selection flags, database and roster do not.
  const blocks=[];
  for(const team of report.teams){
   const people=[];
   for(const person of team.people){
    const worker=workerByLogin.get(person.login);
    if(!worker||!exportWorkerChecked(worker))continue;
    const teamProcesses=new Set([
     ...person.parts.map(p=>p.key==='EARLY_EXIT'?'Wcześniejsze wyjście':p.key),
     ...(state.printShowAbsent?person.absences.map(p=>p.key==='EARLY_EXIT'?'Wcześniejsze wyjście':p.key):[])
    ]);
    const parts=worker.processes.filter(name=>teamProcesses.has(name)&&exportPartChecked(worker,name));
    if(worker.processes.length&&!parts.length)continue;
    people.push([person.login,parts.join('\n')||noProcess]);
   }
   people.sort(sortLogin);
   if(people.length)blocks.push({label:team.name||team.label||team.shift||'PRACOWNICY',people});
  }
  const absent=exportCandidates.value.absent.filter(exportWorkerChecked).map(p=>[p.login,p.status]);
  if(absent.length)blocks.push({label:'WOLNE I URLOPY',people:absent,absent:true});
  if(!blocks.length)return false;
  // Two data columns per block, separated by one narrow gutter: A:B / D:E / G:H.
  const ncols=blocks.length*3-1;
  const maxRows=Math.max(...blocks.map(b=>b.people.length));
  const rows=Array.from({length:maxRows+4},()=>Array(ncols).fill(''));
  rows[0][0]='INCYDENTY · STAN OSOBOWY';
  rows[1][0]=`DATA ${date}   ·   ZMIANA A/B`;
  for(let i=0;i<blocks.length;i++){
   const c=i*3,block=blocks[i];
   rows[3][c]=block.label;
   for(let r=0;r<block.people.length;r++){
    rows[r+4][c]=block.people[r][0];
    rows[r+4][c+1]=block.people[r][1];
   }
  }
  const ws=xlsx.utils.aoa_to_sheet(rows);
  ws['!merges']=[
   {s:{r:0,c:0},e:{r:0,c:ncols-1}},
   {s:{r:1,c:0},e:{r:1,c:ncols-1}},
   ...blocks.map((block,i)=>({s:{r:3,c:i*3},e:{r:3,c:i*3+1}}))
  ];
  ws['!cols']=blocks.flatMap((block,i)=>[
   {wch:16}, {wch:block.absent?17:30}, ...(i===blocks.length-1?[]:[{wch:3}])
  ]);
  ws['!rows']=rows.map((row,i)=>({hpt:i===0?37:i===1?28:i===2?13:i===3?28:
   Math.max(23,14*Math.max(1,...blocks.map((block,j)=>String(row[j*3+1]||'').split('\n').length)))}));
  const style=(fill,fontColor,bold,size,align)=>({
   font:{name:'Aptos',sz:size,bold,color:{rgb:fontColor}},
   fill:{patternType:'solid',fgColor:{rgb:fill}},
   alignment:{vertical:'center',horizontal:align,wrapText:true}
  });
  const apply=(r,c,s)=>{
   const address=xlsx.utils.encode_cell({r,c});
   if(!ws[address])ws[address]={t:'s',v:''};
   ws[address].s=s;
  };
  for(let c=0;c<ncols;c++){
   apply(0,c,style('DCEAF5','253C52',true,15,'center'));
   apply(1,c,style('EFF5FA','526B82',true,10,'center'));
  }
  for(let i=0;i<blocks.length;i++){
   const c=i*3,block=blocks[i];
   for(const col of [c,c+1])apply(3,col,style(block.absent?'E8EDF3':'D8E5F0',block.absent?'52677C':'304E67',true,10,'center'));
   for(let r=0;r<block.people.length;r++){
    const fill=r%2===0?'FFFFFF':'F4F8FC';
    apply(r+4,c,style(fill,'28618F',true,10,'left'));
    apply(r+4,c+1,style(fill,'263345',false,10,'center'));
   }
  }
  const lastColumn=xlsx.utils.encode_col(ncols-1);
  ws['!printArea']=`A1:${lastColumn}${rows.length}`;
  ws['!pageSetup']={orientation:'portrait',paperSize:9,fitToWidth:1,fitToHeight:1,
   margins:{left:0.25,right:0.25,top:0.35,bottom:0.35,header:0.1,footer:0.1}};
  ws['!margins']={left:0.25,right:0.25,top:0.35,bottom:0.35,header:0.1,footer:0.1};
  const book=xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(book,ws,'STAN');
  book.Workbook=book.Workbook||{};
  book.Workbook.Names=[...(book.Workbook.Names||[]),{Name:'_xlnm.Print_Area',Sheet:0,Ref:`STAN!$A$1:$${lastColumn}$${rows.length}`}];
  xlsx.writeFile(book,`Stan Osobowy Incydenty ${date}.xlsx`,{bookType:'xlsx',cellStyles:true});
  return true;
 }

 const dayTeams=computed(()=>shifts.filter(s=>{
  const key=shiftKey(state.day,s.value);
  return (state.shiftTeams[key]||[]).length>0||state.records.some(r=>r.day===state.day&&r.shift===s.value);
 }).map(s=>{const members=[...new Set([...(state.shiftTeams[shiftKey(state.day,s.value)]||[]),...state.records.filter(r=>r.day===state.day&&r.shift===s.value).map(r=>r.login)])];
  const template=Object.entries(state.teamTemplates).find(([name,users])=>Array.isArray(users)&&users.length===members.length&&users.every(login=>members.includes(login)));
  return {...s,count:members.length,name:template?.[0]||''};
 }));
 function chooseTemplateForManagement(){
  const name=state.selectedTemplate;
  state.templateDraftName=name||'';
  state.templateDraftMembers=name&&Array.isArray(state.teamTemplates[name])?[...state.teamTemplates[name]]:[];
  state.templateDraftSearch='';state.templateDraftError='';
 }
 function newTeamTemplate(){state.selectedTemplate='';chooseTemplateForManagement();}
 const templateDraftCandidates=computed(()=>{
  const q=norm(state.templateDraftSearch).toLocaleLowerCase();
  if(!q)return [];
  const members=new Set(state.templateDraftMembers);
  return initialWorkers.value.filter(login=>!members.has(login)&&(login.toLocaleLowerCase().includes(q)||(workerNames.value.get(login)||'').includes(q))).slice(0,20);
 });
 function addTemplateDraftMember(login){login=norm(login);if(!initialWorkers.value.includes(login)||state.templateDraftMembers.includes(login))return false;
  state.templateDraftMembers=[...state.templateDraftMembers,login];state.templateDraftSearch='';state.templateDraftError='';return true;
 }
 function removeTemplateDraftMember(login){state.templateDraftMembers=state.templateDraftMembers.filter(x=>x!==login);state.templateDraftError='';}
 async function saveTemplateDraft(){
  const old=state.selectedTemplate;
  const name=norm(state.templateDraftName).replace(/\s+/g,' ');
  const members=[...new Set(state.templateDraftMembers.map(norm).filter(Boolean))];
  state.templateDraftError='';
  if(!name||name.length>80){state.templateDraftError='NAME_REQUIRED';return false;}
  if(!members.length){state.templateDraftError='MEMBERS_REQUIRED';return false;}
  if(old&&!Object.prototype.hasOwnProperty.call(state.teamTemplates,old)){state.templateDraftError='TEMPLATE_MISSING';return false;}
  if(Object.keys(state.teamTemplates).some(key=>key!==old&&key.toLocaleLowerCase('pl-PL')===name.toLocaleLowerCase('pl-PL'))){state.templateDraftError='DUPLICATE_NAME';return false;}
  snapshot('save-template-draft');
  const next={...state.teamTemplates};
  if(old&&old!==name)delete next[old];
  next[name]=members;
  state.teamTemplates=next;
  state.selectedTemplate=name;
  await save();return state.status!=='BROWSER_SAVE_FAILED';
 }

 function selectDayShift(code){
  if(!SHIFT_OPTIONS.some(s=>s[0]===code))return false;
  state.shift=code;state.from=0;state.to=1;state.selectedLogin='';state.staffFilter='all';state.visibleWorkers=45;
  return true;
 }
 function openDayTeamRoster(code){
  if(!dayTeams.value.some(item=>item.value===code))return false;
  selectDayShift(code);state.dayTeamMenu='';state.dayTeamScheduleOpen=false;state.teamRosterOpen=true;state.teamPicker=false;state.teamSearch='';state.error='';return true;
 }
 function openDayTeamSchedule(code){
  if(!dayTeams.value.some(item=>item.value===code))return false;
  state.dayTeamTargetShift=code;state.dayTeamNewShift=code;state.dayTeamMenu='';state.teamRosterOpen=false;state.dayTeamScheduleOpen=true;state.error='';return true;
 }
 function closeDayTeamEditor(){state.teamRosterOpen=false;state.dayTeamScheduleOpen=false;state.teamPicker=false;state.teamSearch='';state.error='';}
 async function changeDayTeamSchedule(){
  const old=state.dayTeamTargetShift,next=state.dayTeamNewShift;
  if(!SHIFT_OPTIONS.some(s=>s[0]===old)||!SHIFT_OPTIONS.some(s=>s[0]===next))return false;
  if(old===next){closeDayTeamEditor();return true;}
  const source=shiftKey(state.day,old),destination=shiftKey(state.day,next);
  const members=state.shiftTeams[source]||[];
  if(!members.length)return false;
  // Never move assignments between clocks: their slot indices have different meanings.
  if(state.records.some(r=>r.day===state.day&&r.shift===old)){state.error='TEAM_SCHEDULE_HAS_ASSIGNMENTS';return false;}
  if((state.shiftTeams[destination]||[]).length||state.records.some(r=>r.day===state.day&&r.shift===next)){state.error='TEAM_SHIFT_EXISTS';return false;}
  const newTimes=new Set(makeSlots(state.day,next).map(s=>s.start));
  for(const [key,people] of Object.entries(state.shiftTeams)){
   if(key===source||!Array.isArray(people)||!people.some(login=>members.includes(login)))continue;
   const sep=key.lastIndexOf('|');if(sep<0)continue;
   if(makeSlots(key.slice(0,sep),key.slice(sep+1)).some(s=>newTimes.has(s.start))){state.error='TEAM_ROSTER_CONFLICT';return false;}
  }
  // Include existing records even where an imported team roster is absent.
  if(state.records.some(r=>r.day!==state.day||r.shift!==old ? members.includes(r.login)&&makeSlots(r.day,r.shift)[r.slot]&&newTimes.has(makeSlots(r.day,r.shift)[r.slot].start):false)){
   state.error='TEAM_ROSTER_CONFLICT';return false;
  }
  snapshot('change-day-team-schedule');
  const updated={...state.shiftTeams};delete updated[source];updated[destination]=[...members];state.shiftTeams=updated;
  if(state.shift===old)selectDayShift(next);
  closeDayTeamEditor();await save();return state.status!=='BROWSER_SAVE_FAILED';
 }
 function chooseSharedHour(timestamp){
  if(!Number.isFinite(Number(timestamp)))return false;
  const stamp=Number(timestamp);
  const hour=sharedTimeline.value.find(h=>h.start===stamp);if(!hour)return false;
  // Follow the most recently started active shift when moving along the shared
  // timeline. Keeping the old shift throughout overlaps made the UI appear
  // stuck on the previous team when the next shift began.
  const active=hour.shifts.map(code=>({code,index:shiftHourForTimestamp(state.day,code,stamp),start:makeSlots(state.day,code)[0]?.start})).filter(x=>x.index>=0);
  if(!active.length)return false;
  active.sort((a,b)=>b.start-a.start || (a.code===state.shift?-1:b.code===state.shift?1:0));
  const {code,index}=active[0];
  if(code!==state.shift){state.shift=code;state.selectedLogin='';state.staffFilter='all';state.visibleWorkers=45;}
  state.from=index;state.to=index+1;return true;
 }
 const selectedSlot=computed(()=>slots.value[state.from]||slots.value[0]||null);
 const current=computed(()=>state.records.filter(r=>r.day===state.day&&r.shift===state.shift&&r.slot===state.from));
 const teamKey=computed(()=>shiftKey(state.day,state.shift));
 const combinedAtHour=computed(()=>{
  const raw=simultaneousAssignments(state.records,state.day,state.shift,state.from);
  const stamp=selectedSlot.value?.start;
  return {...raw,people:raw.people.filter(r=>!isWorkerAbsentAt(r.login,r.day,r.shift,stamp))};
 });
 const displayedAssignments=computed(()=>state.combinedView?combinedAtHour.value.people:current.value);
 const combinedConflicts=computed(()=>state.combinedView?combinedAtHour.value.conflicts:[]);
 const foreignCount=computed(()=>displayedAssignments.value.filter(r=>r.day!==state.day||r.shift!==state.shift).length);
 const combinedScheduled=computed(()=>{
  const time=selectedSlot.value?.start;if(time===undefined)return [];
  const members=new Map();
  for(const [key,logins] of Object.entries(state.shiftTeams)){
   const separator=key.lastIndexOf('|');if(separator<0)continue;
   const day=key.slice(0,separator),shift=key.slice(separator+1);
   if(shiftHourForTimestamp(day,shift,time)<0)continue;
   for(const login of logins){
    const status=state.importedStatuses.find(r=>r.source===ABSENCE_SOURCE&&r.date===day&&r.login===login);
    // Keep absent workers in the team for return-to-work actions. They are
    // displayed but never included in process assignments or working counts.
    if(!members.has(login))members.set(login,{login,day,shift});
   }
  }
  for(const r of displayedAssignments.value)if(!members.has(r.login))members.set(r.login,{login:r.login,day:r.day,shift:r.shift});
  // On overlaps, prefer the edited shift for a person present in two rosters.
  for(const login of state.shiftTeams[teamKey.value]||[]){
   if(members.has(login)&&shiftHourForTimestamp(state.day,state.shift,time)>=0)
    members.set(login,{login,day:state.day,shift:state.shift});
  }
  return [...members.values()].sort((a,b)=>a.login.localeCompare(b.login));
 });

 function openProcessMenu(person){if(!focusAssignment(person))return false;state.processMenuLogin=state.processMenuLogin===person.login?'':person.login;return true;}
 function openProcessActions(person,type){if(!focusAssignment(person))return false;state.processMenuLogin='';openWorkerActions(person.login);state.actionType=type||'early';if(type==='late'){const saved=lateArrival(person.login,person.day,person.shift);const idx=slots.value.findIndex(slot=>slot.from===saved);state.actionHour=idx>0?idx:Math.min(Math.max(1,state.from+1),slots.value.length-1);}state.actionPanel='form';return true;}
 function removeProcessPerson(person){if(!focusAssignment(person))return false;state.processMenuLogin='';return chooseRemoval(person.login);}
 function focusAssignment(person){
  if(person.day!==state.day||person.shift!==state.shift){
   const timestamp=selectedSlot.value?.start;
   const index=shiftHourForTimestamp(person.day,person.shift,timestamp);
   if(index<0)return false;
   state.day=person.day;state.shift=person.shift;state.from=index;state.to=index+1;
  }
  state.selectedLogin=person.login;return true;
 }

 const clock=reactive({now:Date.now()});
 let lastFinishedTick=finishedHourCount(state.records,clock.now);
 if(typeof root.setInterval==='function')root.setInterval(()=>{clock.now=Date.now();const count=finishedHourCount(state.records,clock.now);if(count!==lastFinishedTick){lastFinishedTick=count;if(state.active&&folderHandle)syncIfAllowed(true);}},60000);
 const isConfirmed=computed(()=>state.records.some(r=>r.day===state.day&&r.shift===state.shift&&autoHourConfirmed(r,clock.now)));
 const finishedHours=computed(()=>state.records.filter(r=>r.day===state.day&&r.shift===state.shift&&autoHourConfirmed(r,clock.now)).length);
 const futureHours=computed(()=>state.records.filter(r=>r.day===state.day&&r.shift===state.shift&&!autoHourConfirmed(r,clock.now)).length);
 const shiftHasEnded=computed(()=>{const items=slots.value;return items.length>0&&clock.now>=items[items.length-1].end;});
 const shiftStatus=computed(()=>futureHours.value===0&&finishedHours.value>0?'confirmed':finishedHours.value>0?'partial':'planned');
 // Automatic time-based classification is descriptive, not evidence of actual work.
 // A past assignment stays editable; changes are immediately reflected in the totals.
 function canEditShift(){return true;}
 const team=computed(()=>[...new Set([...(state.shiftTeams[teamKey.value]||[]),...state.records.filter(r=>r.day===state.day&&r.shift===state.shift).map(r=>r.login)])].sort((a,b)=>a.localeCompare(b)));
 const localAbsence=(login,day=state.day)=>state.importedStatuses.find(r=>r.source===ABSENCE_SOURCE&&r.date===day&&r.login===login&&ABSENCE_TYPES.has(r.status))?.status||'';
 const earlyExit=(login,day=state.day)=>state.importedStatuses.find(r=>r.source===ABSENCE_SOURCE&&r.date===day&&r.login===login&&r.status.startsWith(EARLY_EXIT_PREFIX))?.status.slice(EARLY_EXIT_PREFIX.length).split('~')[0]||'';
 const lateArrival=(login,day=state.day,shift=state.shift)=>{
  const row=state.importedStatuses.find(r=>r.source===ABSENCE_SOURCE&&r.date===day&&r.login===login&&String(r.status||'').startsWith(LATE_ARRIVAL_PREFIX)&&(!String(r.status).slice(LATE_ARRIVAL_PREFIX.length).includes('|')||String(r.status).slice(LATE_ARRIVAL_PREFIX.length).split('|')[0]===shift));
  return row?String(row.status).slice(LATE_ARRIVAL_PREFIX.length).split('|').pop():'';
 };
 function isWorkerAbsentAt(login,day,shift,timestamp){
  const statuses=state.importedStatuses.filter(r=>r.source===ABSENCE_SOURCE&&r.date===day&&r.login===login).map(r=>r.status);
  return statusAtHour(statuses,day,shift,timestamp);
 }
 function staffStatus(person){return isWorkerAbsentAt(person.login,person.day,person.shift,selectedSlot.value?.start);}
 function canAssignPerson(person){return !staffStatus(person);}
 function staffWorkingCount(){return staffEntries.value.filter(p=>!staffStatus(p)).length;}
 const teamAssigned=computed(()=>new Set(current.value.map(r=>r.login)));
 const teamFree=computed(()=>team.value.filter(login=>!teamAssigned.value.has(login)&&!localAbsence(login)));
 const teamCandidates=computed(()=>{const q=state.teamSearch.toLowerCase().trim();const names=workerNames.value;return !q?[]:initialWorkers.value.filter(login=>!team.value.includes(login)&&(login.toLowerCase().includes(q)||(names.get(login)||'').includes(q))).slice(0,30);});
 const initialWorkers=computed(()=>{
  const people=new Set([...(source()?.employees||[]),...(source()?.intervals||[]).flatMap(s=>s.people.map(p=>p.login)),...state.records.map(r=>r.login),...state.importedHistory.map(r=>r.login),...state.importedStatuses.map(r=>r.login)]);
  for(const r of roster()||[])if(r.source!=='rezygnacje')people.add(r.id);
  return [...people].filter(Boolean).sort();
 });
 const workerNames=computed(()=>new Map((roster()||[]).map(p=>[p.id,String(p.name||'').toLowerCase()])));
 // The sidebar follows the real shared hour, not only the selected schedule.
 // Each person retains their own day/shift so edits never land on another team's hours.
 const staffEntries=computed(()=>state.combinedView?combinedScheduled.value:team.value.map(login=>({login,day:state.day,shift:state.shift})));
 const staffAssigned=computed(()=>new Set(displayedAssignments.value.map(r=>r.login)));
 const listedStaffEntries=computed(()=>{
  const query=state.search.toLowerCase().trim(),assigned=state.combinedView?staffAssigned.value:teamAssigned.value;
  return staffEntries.value.filter(person=>(!query||person.login.toLowerCase().includes(query)||(workerNames.value.get(person.login)||'').includes(query))&&
   (state.staffFilter==='all'||(state.staffFilter==='absent'?!!staffStatus(person):state.staffFilter==='assigned'?assigned.has(person.login)&&!staffStatus(person):!assigned.has(person.login)&&!staffStatus(person))));
 });
 const listedWorkers=computed(()=>listedStaffEntries.value.map(person=>person.login));
 const visibleStaffEntries=computed(()=>listedStaffEntries.value.slice(0,state.visibleWorkers));
 const visibleWorkerList=computed(()=>visibleStaffEntries.value.map(person=>person.login));
 const staffTotal=computed(()=>staffEntries.value.length);
 const staffAssignedCount=computed(()=>state.combinedView?staffAssigned.value.size:teamAssigned.value.size);
 const staffFreeCount=computed(()=>staffEntries.value.filter(p=>!(state.combinedView?staffAssigned.value:teamAssigned.value).has(p.login)&&!staffStatus(p)).length);
 function focusStaffEntry(person){
  if(!person||!person.login)return false;
  const time=selectedSlot.value?.start;
  const index=shiftHourForTimestamp(person.day,person.shift,time);
  if(index<0)return false;
  if(person.day!==state.day||person.shift!==state.shift){
   state.day=person.day;state.shift=person.shift;state.from=index;state.to=index+1;
  }
  state.selectedLogin=person.login;return true;
 }
 function dragStaffEntry(event,person){if(!canAssignPerson(person)||!focusStaffEntry(person)){event?.preventDefault?.();return false;}startDrag(event,person.login);return true;}
 function staffProcess(person){return displayedAssignments.value.find(r=>r.login===person.login)?.process||'';}
 function openStaffActions(person){if(!focusStaffEntry(person))return false;return openWorkerActions(person.login);}
 function removeStaffMember(person){if(!focusStaffEntry(person))return false;return removeTeamMember(person.login);}
 // Existing sources are suggestions; historic-only processes do not flood the visible cards.
 const processCatalog=computed(()=>{
  const names=[...(source()?.intervals||[]).flatMap(s=>(s.people||[]).map(p=>p.process)),
   ...(source()?.intervals||[]).flatMap(s=>Object.keys(s.officialSummary||{})),
   ...(state.stanSnapshot?.intervals||[]).flatMap(s=>(s.people||[]).map(p=>p.process)),
   ...state.records.map(r=>r.process),...state.importedHistory.map(r=>r.process),...state.additionalProcesses];
  const distinct=new Map();for(const name of names){const label=norm(name).replace(/\s+/g,' '),key=processKey(label);if(key&&!distinct.has(key))distinct.set(key,label);}
  return [...distinct.values()].sort((a,b)=>a.localeCompare(b,'pl'));
 });
 const processes=computed(()=>{
  const names=[...(source()?.intervals||[]).flatMap(s=>(s.people||[]).map(p=>p.process)),
   ...(source()?.intervals||[]).flatMap(s=>Object.keys(s.officialSummary||{})),
   ...(state.stanSnapshot?.intervals||[]).flatMap(s=>(s.people||[]).map(p=>p.process)),
   ...state.records.map(r=>r.process),...state.additionalProcesses];
  const distinct=new Map();for(const name of names){const key=processKey(name);if(key&&!distinct.has(key))distinct.set(key,findProcessMatch(processCatalog.value,name)||norm(name));}
  return [...distinct.values()].sort((a,b)=>a.localeCompare(b,'pl'));
 });
 const existingProcess=computed(()=>findProcessMatch(processCatalog.value,state.newProcess));
 const processFilterExisting=computed(()=>findProcessMatch(processCatalog.value,state.processFilter));
 const processSuggestions=computed(()=>processCatalog.value.filter(name=>!state.processFilter.trim()||name.toLocaleLowerCase('pl-PL').includes(state.processFilter.trim().toLocaleLowerCase('pl-PL'))).slice(0,9));
 function selectProcessSuggestion(name){state.processDropdownOpen=false;return addProcess(name);}
 const allProcessCards=computed(()=>processes.value.map(name=>({name,people:displayedAssignments.value.filter(r=>processKey(r.process)===processKey(name))})));
 const processCards=computed(()=>allProcessCards.value.filter(p=>!state.hiddenProcesses.includes(processKey(p.name))).filter(p=>!state.processFilter||p.name.toLowerCase().includes(state.processFilter.toLowerCase())).filter(p=>state.showAllProcesses||p.people.length>0||state.additionalProcesses.includes(p.name)||state.processFilter.trim()||!displayedAssignments.value.length).slice(0,state.showAllProcesses?999:(!displayedAssignments.value.length?12:999)));
 const currentPeopleCount=computed(()=>teamAssigned.value.size);
 const readonlyTimeline=computed(()=>{
  const codes=new Set();
  for(const key of Object.keys(state.shiftTeams)){
   const separator=key.lastIndexOf('|');
   if(separator>=0&&key.slice(0,separator)===state.day)codes.add(key.slice(separator+1));
  }
  for(const r of state.records)if(r.day===state.day)codes.add(r.shift);
  if(state.stanSnapshot?.day===state.day&&state.stanSnapshot.shift)codes.add(state.stanSnapshot.shift);
  // Empty local days still have the current reference shift as a fallback.
  const first=[...codes].find(code=>SHIFT_OPTIONS.some(s=>s[0]===code))||state.shift;
  return combinedTimeline(state.day,first,state.shiftTeams,state.records);
 });
 const readonlyDisplayShifts=computed(()=>{
  const codes=new Set(readonlyTimeline.value.flatMap(h=>h.shifts));
  return shifts.filter(s=>codes.has(s.value)).map(s=>({
   ...s,count:new Set([...(state.shiftTeams[shiftKey(state.day,s.value)]||[]),
    ...state.records.filter(r=>r.day===state.day&&r.shift===s.value).map(r=>r.login)]).size
  }));
 });
 const readonlySelectedHour=computed(()=>{
  const wanted=Number(state.readonlyHourStamp);
  // Keep the read-only hour independent of the planning editor. A new date
  // invalidates its old timestamp and falls back to the active shift hour.
  return readonlyTimeline.value.find(h=>h.start===wanted)||
   readonlyTimeline.value.find(h=>h.start===selectedSlot.value?.start)||readonlyTimeline.value[0]||null;
 });
 function chooseReadonlyHour(timestamp){
  const hour=readonlyTimeline.value.find(h=>h.start===Number(timestamp));
  if(!hour)return false;
  state.readonlyHourStamp=hour.start;return true;
 }
 const readonlyActiveShifts=computed(()=>{
  const selected=readonlySelectedHour.value;
  if(!selected)return [];
  return activeTeamShifts.value.filter(s=>selected.shifts.includes(s.value));
 });
 const readonlyRoster=computed(()=>{
  const hour=readonlySelectedHour.value;
  if(!hour)return {origin:'empty',groups:[],count:0,conflicts:[]};
  const planned=rosterAtTimestamp(state.records.filter(r=>!isWorkerAbsentAt(r.login,r.day,r.shift,hour.start)),hour.start,state.day,state.shift);
  if(planned.count)return planned;
  // A local roster may deliberately be empty this hour; never back-fill its
  // absence with an older SharePoint STAN snapshot.
  if(state.records.some(r=>r.day===state.day&&hour.shifts.includes(r.shift)))return planned;
  const stan=state.stanSnapshot;
  // STAN is only a current-day snapshot of its own schedule, not an archive.
  if(!stan?.day||stan.day!==state.day||!hour.shifts.includes(stan.shift))return planned;
  const stanHour=makeSlots(stan.day,stan.shift).find(slot=>slot.start===hour.start);
  if(!stanHour)return planned;
  const iv=(stan.intervals||[]).find(v=>v.label?.startsWith(stanHour.from+'-')||v.label?.startsWith(stanHour.from+'–')||v.label?.startsWith(stanHour.from+' —')||v.label?.startsWith(stanHour.from+' '));
  if(!iv)return planned;
  const byLogin=new Map();for(const p of iv.people||[])if(p.login&&p.process&&!byLogin.has(p.login)&&!isWorkerAbsentAt(p.login,stan.day,stan.shift,hour.start))byLogin.set(p.login,p);
  const map=new Map();for(const p of byLogin.values()){
   const key=processKey(p.process);
   if(!map.has(key))map.set(key,{name:p.process,people:[]});
   map.get(key).people.push({login:p.login,shift:stan.shift,day:stan.day});
  }
  return {origin:'stan',groups:[...map.values()].map(g=>({...g,count:g.people.length})),count:byLogin.size,conflicts:[]};
 });
 const readonlyDepartments=computed(()=>splitRosterDepartments(readonlyRoster.value,state.otherDepartmentProcesses,state.functionalProcesses));
 const readonlyProcessChoices=computed(()=>{
  const names=[...processCatalog.value,...readonlyRoster.value.groups.map(g=>g.name),...OTHER_DEPARTMENT_DEFAULT];
  const distinct=new Map();
  for(const name of names){const key=processKey(name);if(key&&!distinct.has(key))distinct.set(key,norm(name));}
  return [...distinct.values()].sort((a,b)=>a.localeCompare(b,'pl'));
 });
 function isOtherDepartmentProcess(name){return state.otherDepartmentProcesses.includes(processKey(name));}
 function isFunctionalProcess(name){return state.functionalProcesses.includes(processKey(name));}
 function setProcessDisplayGroup(name,group){
  const key=processKey(name);
  if(!key||!['local','functional','other'].includes(group))return false;
  const other=new Set(state.otherDepartmentProcesses);
  const functional=new Set(state.functionalProcesses);
  other.delete(key);functional.delete(key);
  if(group==='other')other.add(key);
  if(group==='functional')functional.add(key);
  state.otherDepartmentProcesses=[...other];
  state.functionalProcesses=[...functional];
  try{
   localStorage.setItem(OTHER_DEPARTMENT_STORAGE,JSON.stringify(state.otherDepartmentProcesses));
   localStorage.setItem(FUNCTIONAL_PROCESS_STORAGE,JSON.stringify(state.functionalProcesses));
  }catch(_){}
  return true;
 }
 // Keep legacy API available for existing controls.
 function setOtherDepartmentProcess(name,checked){return setProcessDisplayGroup(name,checked?'other':'local');}
 function startDepartmentDrag(event,name){
  const key=processKey(name);if(!key)return;
  state.departmentDragProcess=key;state.departmentDragOver='';
  if(event?.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',key);}
 }
 function endDepartmentDrag(){state.departmentDragProcess='';state.departmentDragOver='';}
 function leaveDepartmentDrop(event,section){
  const next=event?.relatedTarget;
  if(next&&event?.currentTarget?.contains(next))return;
  if(state.departmentDragOver===section)state.departmentDragOver='';
 }
 function dropDepartmentCard(event,section){
  const key=state.departmentDragProcess||event?.dataTransfer?.getData('text/plain');
  // Only accept a drag initiated by one of our own process cards.
  if(key&&state.departmentDragProcess===key)setProcessDisplayGroup(key,section);
  endDepartmentDrag();
 }
 function restoreOtherDepartmentDefaults(){
  state.otherDepartmentProcesses=OTHER_DEPARTMENT_DEFAULT.map(processKey);
  state.functionalProcesses=[];
  try{
   localStorage.setItem(OTHER_DEPARTMENT_STORAGE,JSON.stringify(state.otherDepartmentProcesses));
   localStorage.setItem(FUNCTIONAL_PROCESS_STORAGE,JSON.stringify(state.functionalProcesses));
  }catch(_){}
 }
 const syncKind=computed(()=>{if(!state.active)return 'loading';if(state.busy)return 'saving';if(state.status==='EXTERNAL_CHANGES_DETECTED'||state.status==='XLSX_FAILED'||state.status==='FOLDER_PERMISSION_REQUIRED'||state.status==='BROWSER_SAVE_FAILED')return 'error';if(!state.folderName)return 'no-folder';return state.dirty?'pending':'synced';});
 const canClose=computed(()=>!state.busy&&!state.dirty);
 const syncTimeText=computed(()=>state.lastExcelSync?new Date(state.lastExcelSync).toLocaleString(({pl:'pl-PL',ru:'ru-RU',en:'en-GB',uk:'uk-UA'}[language?.()]||'pl-PL'),{dateStyle:'short',timeStyle:'short'}):'');
 const unassigned=computed(()=>listedWorkers.value.filter(login=>!current.value.some(r=>r.login===login)));
 const days=computed(()=>[...new Set(state.records.map(r=>r.day))].sort().reverse());
 const historyRows=computed(()=>{const days=state.historyWindow==='week'?7:state.historyWindow==='month'?31:366;const limit=Date.parse(state.day+'T00:00:00')-(days-1)*86400000;const rows=state.records.filter(r=>new Date(r.day+'T00:00:00').getTime()>=limit);const groups=new Map();for(const r of rows){const key=[r.day,r.login,r.process].join('|');if(!groups.has(key))groups.set(key,{day:r.day,login:r.login,process:r.process,hours:0});groups.get(key).hours++;}return [...groups.values()].sort((a,b)=>b.day.localeCompare(a.day)||a.login.localeCompare(b.login));});
 function selectLogin(login){state.selectedLogin=norm(login);}
 function snapshot(label){undoSnapshot={selectedTemplate:state.selectedTemplate,templateName:state.templateName,teamTemplates:JSON.parse(JSON.stringify(state.teamTemplates)),records:JSON.parse(JSON.stringify(state.records)),shiftTeams:JSON.parse(JSON.stringify(state.shiftTeams)),additionalProcesses:[...state.additionalProcesses],hiddenProcesses:[...state.hiddenProcesses],importedStatuses:JSON.parse(JSON.stringify(state.importedStatuses))};state.undoAvailable=true;state.undoLabel=label;}
 function restoreUndo(){if(!canEditShift()||!undoSnapshot)return false;const prior=undoSnapshot;undoSnapshot=null;state.undoAvailable=false;state.records=prior.records;state.teamTemplates=prior.teamTemplates;state.selectedTemplate=prior.selectedTemplate;state.templateName=prior.templateName;state.shiftTeams=prior.shiftTeams;state.additionalProcesses=prior.additionalProcesses;state.hiddenProcesses=prior.hiddenProcesses;state.importedStatuses=prior.importedStatuses;save();return true;}
 async function save(){
  const before=new Map(lastSavedRecords.map(r=>[[r.day,r.shift,r.slot,r.login].join('|'),r]));
  const after=new Map(state.records.map(r=>[[r.day,r.shift,r.slot,r.login].join('|'),r]));
  const removed=new Map(state.tombstones.map(t=>[t.key,t]));
  const now=new Date().toISOString();
  for(const k of before.keys())if(!after.has(k))removed.set(k,{key:k,at:now});
  for(const [k,r] of after)if(removed.has(k)&&Date.parse(r.updated||0)>=Date.parse(removed.get(k).at))removed.delete(k);
  state.tombstones=[...removed.values()];
  revision++;state.dirty=true;state.pendingChanges++;state.status='LOCAL_SAVING';try{await put('records',JSON.parse(JSON.stringify({records:state.records,additionalProcesses:state.additionalProcesses,hiddenProcesses:state.hiddenProcesses,confirmations:state.confirmations,excludedHistory:state.excludedHistory,importedHistory:state.importedHistory,importedStatuses:state.importedStatuses,importedSource:state.importedSource,importedAt:state.importedAt,unrecognized:state.unrecognized,shiftTeams:state.shiftTeams,teamTemplates:state.teamTemplates,tombstones:state.tombstones,stanSnapshot:state.stanSnapshot})));state.lastBrowserSave=new Date().toISOString();await put('lastBrowserSave',state.lastBrowserSave);lastSavedRecords=JSON.parse(JSON.stringify(state.records));state.status='LOCAL_SAVED_NOT_EXPORTED';await syncIfAllowed();}catch(err){state.error=err.message||String(err);state.status='BROWSER_SAVE_FAILED';}}
 const templateNames=computed(()=>Object.keys(state.teamTemplates).sort((a,b)=>a.localeCompare(b,'pl')));
 function selectedWorkerProcess(login){return current.value.find(r=>r.login===login)?.process||'';}
 async function saveTeamTemplate(){const name=norm(state.templateName).replace(/\s+/g,' ');if(!name||name.length>80||!team.value.length)return false;
  const existing=Object.keys(state.teamTemplates).find(k=>k.toLocaleLowerCase('pl-PL')===name.toLocaleLowerCase('pl-PL'));
  if(existing&&typeof root.confirm==='function'&&!root.confirm(({pl:'Zastąpić zapisany zespół?',ru:'Заменить сохранённую команду?',en:'Replace the saved team?',uk:'Замінити збережену команду?'}[language?.()]||'Zastąpić zapisany zespół?')))return false;
  snapshot('save-template');const key=existing||name;state.teamTemplates={...state.teamTemplates,[key]:[...team.value]};state.selectedTemplate=key;state.templateName=key;await save();return true;
 }
 async function loadTeamTemplate(){
  // Selecting a different template replaces the shift roster, it does not append.
  // Assignments for workers outside that roster are never silently discarded.
  const members=state.teamTemplates[state.selectedTemplate];
  if(!Array.isArray(members)||!members.length)return false;
  const next=[...new Set(members.map(norm).filter(Boolean))];
  const keep=new Set(next);
  const removed=state.records.filter(r=>r.day===state.day&&r.shift===state.shift&&!keep.has(r.login));
  if(removed.length&&typeof root.confirm==='function'&&!root.confirm({pl:'Zmiana zespołu usunie przydziały pracowników, których nie ma w nowym szablonie, tylko dla tej zmiany. Kontynuować?',ru:'Смена команды удалит назначения сотрудников, которых нет в новом шаблоне, только для этой смены. Продолжить?',en:'Switching teams will remove this shift’s assignments for workers missing from the new template. Continue?',uk:'Зміна команди видалить призначення працівників поза новим шаблоном лише для цієї зміни. Продовжити?'}[language?.()]||'Replace shift team?')){
   state.selectedTemplate='';state.templateName='';return false;
  }
  snapshot('switch-template');
  state.shiftTeams={...state.shiftTeams,[teamKey.value]:next};
  if(removed.length)state.records=state.records.filter(r=>r.day!==state.day||r.shift!==state.shift||keep.has(r.login));
  if(state.selectedLogin&&!keep.has(state.selectedLogin))state.selectedLogin='';
  state.templateName=state.selectedTemplate;state.staffFilter='all';state.visibleWorkers=45;
  await save();return state.status!=='BROWSER_SAVE_FAILED';
 }
 // Non-destructive addition of a saved roster to a separate shift on this date.
 // XLSX ZESPOLY already stores memberships keyed by date + shift.
 async function addParallelTeam(){
  const members=state.teamTemplates[state.extraTemplate];
  const shift=state.extraShift;
  if(!Array.isArray(members)||!members.length||!SHIFT_OPTIONS.some(x=>x[0]===shift))return false;
  const key=shiftKey(state.day,shift);
  // Do not silently put one worker into overlapping rosters.
  const shiftSlots=makeSlots(state.day,shift),times=new Set(shiftSlots.map(x=>x.start));
  const overlaps=new Set();
  for(const [otherKey,people] of Object.entries(state.shiftTeams)){
   if(otherKey===key)continue;
   const sep=otherKey.lastIndexOf('|'),otherDay=otherKey.slice(0,sep),otherShift=otherKey.slice(sep+1);
   if(!makeSlots(otherDay,otherShift).some(x=>times.has(x.start)))continue;
   for(const login of people)overlaps.add(login);
  }
  const duplicates=members.map(norm).filter(login=>overlaps.has(login));
  if(duplicates.length){state.error='TEAM_ROSTER_CONFLICT: '+[...new Set(duplicates)].join(', ');return false;}
  state.error='';
  const next=[...new Set([...(state.shiftTeams[key]||[]),...members.map(norm).filter(Boolean)])];
  if(next.length===(state.shiftTeams[key]||[]).length)return true;
  snapshot('parallel-team');state.shiftTeams={...state.shiftTeams,[key]:next};
  state.combinedView=true;await save();return state.status!=='BROWSER_SAVE_FAILED';
 }
 async function removeDayTeam(code){
  if(!SHIFT_OPTIONS.some(s=>s[0]===code))return false;
  const key=shiftKey(state.day,code);
  const records=state.records.filter(r=>r.day===state.day&&r.shift===code);
  const members=state.shiftTeams[key]||[];
  if(!members.length&&!records.length)return false;
  const finished=records.filter(r=>{const slot=makeSlots(r.day,r.shift)[r.slot];return slot&&slot.end<=Date.now();});
  if(finished.length){state.error='TEAM_HAS_COMPLETED_HOURS';return false;}
  const message=({pl:`Usunąć zespół z tego dnia? ${members.length} osób i ${records.length} przyszłych godzin przydziałów zostanie usuniętych. Zapisany szablon pozostanie.`,ru:`Убрать команду с этого дня? ${members.length} сотрудников и ${records.length} будущих часовых назначений будут удалены. Сохранённый шаблон останется.`,en:`Remove this team from this day? ${members.length} people and ${records.length} upcoming hourly assignments will be removed. The saved template stays.`,uk:`Прибрати команду з цього дня? ${members.length} працівників і ${records.length} майбутніх годин призначень буде видалено. Збережений шаблон залишиться.`}[language?.()]||'Remove this shift team?');
  if(typeof root.confirm==='function'&&!root.confirm(message))return false;
  snapshot('remove-day-team');
  const next={...state.shiftTeams};delete next[key];state.shiftTeams=next;
  state.records=state.records.filter(r=>r.day!==state.day||r.shift!==code);
  state.error='';
  const other=dayTeams.value.find(s=>s.value!==code);
  if(state.shift===code)selectDayShift(other?.value||'06-18');
  await save();return state.status!=='BROWSER_SAVE_FAILED';
 }
 async function setupDayTeam(){
  const code=state.teamSetupShift;
  if(!SHIFT_OPTIONS.some(s=>s[0]===code))return false;
  if(state.teamSetupMode==='saved'){
   if(!state.teamTemplates[state.teamSetupTemplate]?.length)return false;
   const key=shiftKey(state.day,code);
   if((state.shiftTeams[key]||[]).length||state.records.some(r=>r.day===state.day&&r.shift===code)){state.error='TEAM_SHIFT_EXISTS';return false;}
   state.extraTemplate=state.teamSetupTemplate;state.extraShift=code;
   const ok=await addParallelTeam();if(ok){selectDayShift(code);state.teamSetupOpen=false;}return ok;
  }
  // A new roster is assembled through the existing employee picker and saved
  // as a reusable template once it has at least one member.
  const key=shiftKey(state.day,code);
  if((state.shiftTeams[key]||[]).length || state.records.some(r=>r.day===state.day&&r.shift===code)){
   state.error='TEAM_SHIFT_EXISTS';return false;
  }
  selectDayShift(code);state.templateName=norm(state.teamSetupName).slice(0,80);
  state.selectedTemplate='';state.teamPicker=true;state.teamRosterOpen=true;state.teamSetupOpen=false;state.error='';return true;
 }
 async function deleteTeamTemplate(){const name=state.selectedTemplate;if(!state.teamTemplates[name])return false;
  if(typeof root.confirm==='function'&&!root.confirm(({pl:'Usunąć zapisany zespół? Przydziały zmian pozostaną.',ru:'Удалить сохранённую команду? Назначения смен останутся.',en:'Delete this saved team? Shift assignments will remain.',uk:'Видалити збережену команду? Призначення змін залишаться.'}[language?.()]||'Usunąć zapisany zespół?')))return false;
  snapshot('delete-template');const next={...state.teamTemplates};delete next[name];state.teamTemplates=next;state.selectedTemplate='';state.templateName='';chooseTemplateForManagement();await save();return true;
 }
 async function renameTeamTemplate(){const old=state.selectedTemplate,name=norm(state.templateName).replace(/\s+/g,' ');if(!old||!state.teamTemplates[old]||!name||name.length>80)return false;if(old===name)return true;
  if(Object.keys(state.teamTemplates).some(k=>k!==old&&k.toLocaleLowerCase('pl-PL')===name.toLocaleLowerCase('pl-PL')))return false;
  snapshot('rename-template');const updated={...state.teamTemplates,[name]:state.teamTemplates[old]};delete updated[old];state.teamTemplates=updated;state.selectedTemplate=name;await save();return true;
 }
 async function addTeamMember(login){if(!canEditShift())return false;login=norm(login);if(!login||!initialWorkers.value.includes(login))return false;if(team.value.includes(login))return true;snapshot('add');state.shiftTeams={...state.shiftTeams,[teamKey.value]:[...(state.shiftTeams[teamKey.value]||[]),login]};state.teamSearch='';state.teamPicker=false;await save();return true;}
 async function removeTeamMember(login){if(!canEditShift())return false;login=norm(login);if(!team.value.includes(login))return false;const existing=state.records.filter(r=>r.day===state.day&&r.shift===state.shift&&r.login===login);state.error='';if(existing.length&&typeof root.confirm==='function'&&!root.confirm(({ru:'Удалить сотрудника из смены и все его назначения на эту смену?',en:'Remove the worker from this shift and all assignments on this shift?',uk:'Прибрати працівника зі зміни та всі його призначення?',pl:'Usunąć pracownika ze zmiany i wszystkie jego przydziały?'}[language?.()]||'Usunąć pracownika ze zmiany i wszystkie jego przydziały?')))return false;snapshot('remove-team');state.shiftTeams={...state.shiftTeams,[teamKey.value]:(state.shiftTeams[teamKey.value]||[]).filter(x=>x!==login)};state.records=state.records.filter(r=>!(r.day===state.day&&r.shift===state.shift&&r.login===login));state.selectedLogin=state.selectedLogin===login?'':state.selectedLogin;await save();return true;}
 async function assign(login,process){if(!canEditShift())return false;login=norm(login);process=norm(process);if(!login||!process||state.from<0||state.from>=slots.value.length)return false;
  const allSlots=makeSlots(state.day,state.shift);
  if(isWorkerAbsentAt(login,state.day,state.shift,allSlots[state.from].start)){state.error='ABSENCE_CLEAR_FIRST';return false;}
  // An assignment must stop before an upcoming departure (or other absence).
  const stop=allSlots.findIndex((slot,i)=>i>=state.from&&isWorkerAbsentAt(login,state.day,state.shift,slot.start));
  const end=stop<0?allSlots.length:stop;
  const proposed=allSlots.slice(state.from,end);
  const occupied=new Set(proposed.map(x=>x.start));
  const collision=state.records.find(r=>r.login===login&&(r.day!==state.day||r.shift!==state.shift)&&occupied.has(makeSlots(r.day,r.shift)[r.slot]?.start));
  if(collision){state.error='TEAM_HOUR_CONFLICT';return false;}
  state.error='';snapshot('assign');state.records=applyAssignment(state.records,{day:state.day,shift:state.shift,from:state.from,to:end,login,process});if(!state.shiftTeams[teamKey.value]?.includes(login))state.shiftTeams={...state.shiftTeams,[teamKey.value]:[...(state.shiftTeams[teamKey.value]||[]),login]};state.selectedLogin='';await save();return true;}
 async function removeRange(login,scope='hour'){if(!canEditShift())return false;login=norm(login);const from=scope==='shift'?0:state.from,to=scope==='shift'||scope==='remaining'?slots.value.length:scope==='range'?state.to:state.from+1;const next=dropAssignments(state.records,{day:state.day,shift:state.shift,login,from,to});if(next.length===state.records.length)return false;snapshot('remove');state.records=next;await save();return true;}
 async function remove(login){return removeRange(login,'hour');}
 function chooseRemoval(login){state.removingLogin=norm(login);return !!state.removingLogin;}
 async function confirmRemoval(scope){if(!state.removingLogin)return false;const login=state.removingLogin;state.removingLogin='';return removeRange(login,scope);}
 function openWorkerActions(login){
  const member=norm(login);if(!member)return false;
  state.actionLogin=member;state.actionPanel='menu';state.actionSelected=[member];state.actionType='WOLNY';
  state.actionFrom=state.day;state.actionTo=state.day;state.actionHour=state.from;
  state.error='';return true;
 }
 function toggleActionWorker(login){
  const set=new Set(state.actionSelected);
  if(set.has(login))set.delete(login);else set.add(login);
  state.actionSelected=[...set];
 }
 function closeWorkerActions(){state.actionLogin='';state.actionPanel='menu';state.actionSelected=[];}
 async function applyDayStatus(){
  if(!canEditShift())return false;
  const logins=[...new Set(state.actionSelected.map(norm).filter(Boolean))],type=state.actionType;
  if(!logins.length||!ABSENCE_TYPES.has(type))return false;
  try{
   const dates=absenceDates(state.actionFrom,state.actionTo);
   // Elapsed local assignments can be corrected. Imported SharePoint history stays
   // untouched; the existing conflict confirmation asks before local hours are removed.
   const localConflicts=state.records.filter(r=>logins.includes(r.login)&&dates.includes(r.day));
   const importedConflicts=state.importedHistory.filter(r=>logins.includes(r.login)&&dates.includes(r.date)&&Number(r.hours)>0);
   if((localConflicts.length||importedConflicts.length)&&typeof root.confirm==='function'){
    const msg={ru:'За выбранные даты есть рабочие записи. Локальные назначения, включая прошедшие часы, будут сняты. Импортированную историю нужно сверить отдельно. Продолжить?',pl:'W wybranych dniach istnieją wpisy pracy. Lokalne przydziały (także zakończone) zostaną usunięte, historia importowana pozostanie do weryfikacji. Kontynuować?',en:'These dates contain work records. Local assignments, including elapsed hours, will be removed; imported history remains for separate review. Continue?',uk:'За вибрані дати є записи роботи. Локальні призначення, включно із завершеними годинами, буде знято, імпортовану історію потрібно перевірити окремо. Продовжити?'}[language?.()]||'Confirm absence?';
    if(!root.confirm(msg))return false;
   }
   snapshot('absence');
   state.records=state.records.filter(r=>!(logins.includes(r.login)&&dates.includes(r.day)));
   state.importedStatuses=updateLocalAbsences(state.importedStatuses,logins,dates,type);
   closeWorkerActions();await save();return state.status!=='BROWSER_SAVE_FAILED';
  }catch(err){state.error=err.message||String(err);return false;}
 }
 async function markEarlyExit(){
  const login=norm(state.actionLogin),current=Number(state.actionHour);
  const allSlots=slots.value,from=current+1,slot=allSlots[from];
  // The selected hour is worked. Absence begins at the next interval.
  if(!login||!Number.isInteger(current)||!slot){state.error='EARLY_EXIT_LAST_HOUR';return false;}
  const previous=earlyExit(login);
  if(previous===slot.from){state.error='';closeWorkerActions();return true;}
  const retrospective=slot.start<clock.now;
  const importedConflict=state.importedHistory.some(r=>r.date===state.day&&r.login===login&&Number(r.hours)>0);
  if(typeof root.confirm==='function'&&!root.confirm(({
   ru:(retrospective?'Корректировка прошедших часов. ':'')+'С '+slot.from+' оформить ранний уход? Назначения после этого времени будут сняты. Ранее удалённые назначения автоматически не восстанавливаются.',
   pl:(retrospective?'Korekta zakończonych godzin. ':'')+'Oznaczyć wcześniejsze wyjście od '+slot.from+'? Późniejsze przydziały zostaną usunięte; wcześniej usunięte nie wrócą automatycznie.',
   en:(retrospective?'Correcting elapsed hours. ':'')+'Mark departure from '+slot.from+'? Later assignments are removed; previously removed entries will not be restored automatically.',
   uk:(retrospective?'Виправлення минулих годин. ':'')+'Позначити ранній вихід від '+slot.from+'? Пізніші призначення буде знято; попередньо видалені не відновляться автоматично.'
  }[language?.()]||'Confirm early departure?')+(importedConflict?({pl:' Historia SharePoint nie zostanie zmieniona: sprawdź różnice w Historii.',ru:' История SharePoint не изменится: проверь расхождения в Истории.',en:' SharePoint history stays unchanged: review differences in History.',uk:' Історія SharePoint не зміниться: перевірте розбіжності в Історії.'}[language?.()]||''):'')))return false;
  snapshot('early-exit');
  state.records=cutAfterHour(state.records,{day:state.day,shift:state.shift,login,from});
  state.importedStatuses=updateIntervalStatus(state.importedStatuses,login,state.day,EARLY_EXIT_PREFIX,EARLY_EXIT_PREFIX+slot.from);
  state.error='';closeWorkerActions();await save();return state.status!=='BROWSER_SAVE_FAILED';
 }
 async function markLateArrival(){
  const login=norm(state.actionLogin),index=Number(state.actionHour),allSlots=slots.value;
  const slot=allSlots[index];
  if(!login||!Number.isInteger(index)||index<=0||!slot){state.error='LATE_ARRIVAL_INVALID_HOUR';return false;}
  if(localAbsence(login)){state.error='LATE_ARRIVAL_DAY_OFF';return false;}
  const old=lateArrival(login);
  if(old===slot.from){state.error='';closeWorkerActions();return true;}
  const removed=state.records.filter(r=>r.day===state.day&&r.shift===state.shift&&r.login===login&&r.slot<index);
  if(typeof root.confirm==='function'){
   const msg={pl:`Zapisac spóźnienie od ${slot.from}? ${removed.length} wcześniejszych przydziałów zostanie usuniętych. Późniejsze zostaną zachowane.`,ru:`Установить опоздание до ${slot.from}? Предыдущие назначения (${removed.length}) будут сняты, более поздние сохранятся.`,en:`Mark late arrival at ${slot.from}? ${removed.length} earlier assignments will be removed. Later ones stay.`,uk:`Позначити запізнення до ${slot.from}? Попередні призначення (${removed.length}) буде знято, пізніші збережено.`}[language?.()]||'Confirm late arrival?';
   if(!root.confirm(msg))return false;
  }
  snapshot('late-arrival');
  state.records=state.records.filter(r=>!(r.day===state.day&&r.shift===state.shift&&r.login===login&&r.slot<index));
  state.importedStatuses=updateShiftLateStatus(state.importedStatuses,login,state.day,state.shift,slot.from);
  state.error='';closeWorkerActions();await save();return state.status!=='BROWSER_SAVE_FAILED';
 }
 async function clearLateArrival(){
  const login=norm(state.actionLogin);if(!login||!lateArrival(login))return false;
  snapshot('clear-late-arrival');
  state.importedStatuses=updateShiftLateStatus(state.importedStatuses,login,state.day,state.shift,'');
  state.error='';closeWorkerActions();await save();return state.status!=='BROWSER_SAVE_FAILED';
 }
 async function clearWorkerStatus(){
  const login=norm(state.actionLogin);if(!login)return false;
  const before=state.importedStatuses.length;
  const filtered=state.importedStatuses.filter(r=>!(r.source===ABSENCE_SOURCE&&r.login===login&&r.date===state.day));
  if(before===filtered.length){closeWorkerActions();return false;}
  snapshot('clear-status');state.importedStatuses=filtered;state.selectedLogin=login;closeWorkerActions();await save();return true;
 }
 async function resumeWorker(){
  const login=norm(state.actionLogin);if(!login)return false;
  const selected=slots.value[state.actionHour];if(!selected)return false;
  const date=state.day;
  const status=state.importedStatuses.find(r=>r.source===ABSENCE_SOURCE&&r.login===login&&r.date===date&&(ABSENCE_TYPES.has(r.status)||String(r.status||'').startsWith(EARLY_EXIT_PREFIX)));
  if(!status)return false;
  if(status.status.startsWith(EARLY_EXIT_PREFIX)){
   const bounds=departureBounds(status.status,date,state.shift);
   if(!bounds||selected.start<bounds.from){state.error='RESUME_BEFORE_DEPARTURE';return false;}
   if(selected.start<clock.now&&typeof root.confirm==='function'){
    const msg={pl:'Korekta historii: wznowić pracę od '+selected.from+'? Wcześniej usuniętych przydziałów nie przywrócimy automatycznie.',ru:'Коррекция истории: вернуть к работе с '+selected.from+'? Ранее удалённые назначения автоматически не восстановятся.',en:'History correction: resume from '+selected.from+'? Previously deleted assignments are not restored automatically.',uk:'Виправлення історії: повернути до роботи з '+selected.from+'? Раніше видалені призначення не відновляться автоматично.'};
    if(!root.confirm(msg[language?.()]||msg.pl))return false;
   }
   if(selected.start>=bounds.to){state.error='ALREADY_WORKING';return false;}
   snapshot('resume-worker');
   // Keep the elapsed absence interval for History / Intelligence.
   const updated=selected.start===bounds.from?'':EARLY_EXIT_PREFIX+earlyExit(login,date)+'~'+selected.from;
   state.importedStatuses=updateIntervalStatus(state.importedStatuses,login,date,EARLY_EXIT_PREFIX,updated);
  }else{
   snapshot('resume-worker');
   state.importedStatuses=state.importedStatuses.filter(r=>!(r.source===ABSENCE_SOURCE&&r.login===login&&r.date===date));
  }
  state.error='';state.selectedLogin=login;closeWorkerActions();await save();return true;
 }
 async function removeFromSelectedHour(){
  const login=norm(state.actionLogin),slot=slots.value[state.actionHour];if(!login||!slot)return false;
  const next=cutAfterHour(state.records,{day:state.day,shift:state.shift,login,from:Number(state.actionHour)});
  if(next.length===state.records.length)return false;
  snapshot('remove-from-hour');state.records=next;closeWorkerActions();await save();return true;
 }
 function startDrag(event,login){event.dataTransfer.setData('text/plain',login);event.dataTransfer.effectAllowed='move';state.selectedLogin=login;}
 async function drop(event,process){event.preventDefault();const login=event.dataTransfer.getData('text/plain')||state.selectedLogin;await assign(login,process);}
 async function addProcess(name){
  const typed=norm(name).replace(/\s+/g,' ');if(!typed||typed.length>90)return false;
  const match=findProcessMatch(processCatalog.value,typed);
  if(!match&&!canEditShift())return false;
  const label=match||processKey(typed);
  if(!findProcessMatch(processes.value,label)){
   snapshot('process');state.additionalProcesses.push(label);await save();
  }
  if(state.hiddenProcesses.includes(processKey(label))){snapshot('show-process');state.hiddenProcesses=state.hiddenProcesses.filter(x=>x!==processKey(label));await save();}
  state.newProcess='';state.processFilter='';state.processDropdownOpen=false;state.showAllProcesses=true;
  state.processHighlight=processKey(label);
  if(typeof window!=='undefined'&&typeof document!=='undefined'){
   window.requestAnimationFrame(()=>{
    const grid=document.querySelector('.obs-plan-processgrid');
    const card=grid&&[...grid.querySelectorAll('[data-obs-process]')].find(el=>el.getAttribute('data-obs-process')===processKey(label));
    card?.scrollIntoView({behavior:'smooth',block:'nearest'});
   });
   window.setTimeout(()=>{if(state.processHighlight===processKey(label))state.processHighlight='';},1800);
  }
  return true;
 }
 async function hideProcess(name){if(!canEditShift())return false;
  const key=processKey(name);
  if(!key||state.hiddenProcesses.includes(key))return false;
  // Never hide an occupied card, even if the assignments are for another hour of this shift.
  if(state.records.some(r=>r.day===state.day&&r.shift===state.shift&&processKey(r.process)===key)){
   state.error=({ru:'Сначала убери назначения сотрудников с этого процесса на выбранной смене.',pl:'Najpierw usuń przydziały z tego procesu w bieżącej zmianie.',en:'Remove assignments for this process from the shift first.',uk:'Спершу приберіть призначення з цього процесу на зміні.'}[language?.()]||'Najpierw usuń przydziały z tego procesu w bieżącej zmianie.');
   return false;
  }
  snapshot('hide-process');
  state.additionalProcesses=state.additionalProcesses.filter(p=>processKey(p)!==key);
  state.hiddenProcesses=[...state.hiddenProcesses,key];
  state.error='';state.processFilter='';
  await save();return true;
 }
 async function seedFromSource(){if(!canEditShift())return false;const slot=slots.value[state.from];const matched=(source()?.intervals||[]).find(s=>s.start===minutes(slot?.from));if(!matched)return false;const people=matched.people||[];if(!people.length)return false;let overwrite=state.records.some(r=>r.day===state.day&&r.shift===state.shift&&r.slot===state.from);if(overwrite&&!root.confirm('Existing local assignments for this hour will be replaced. Continue?'))return false;snapshot('seed');state.records=state.records.filter(r=>!(r.day===state.day&&r.shift===state.shift&&r.slot===state.from));for(const p of people)state.records.push({day:state.day,shift:state.shift,slot:state.from,login:p.login,process:p.process,updated:new Date().toISOString()});await save();return true;}
 const importPreview=computed(()=>({entries:source()?.history?.length||0,statuses:source()?.statuses?.length||0,unexpected:source()?.unexpected?.length||0,sheets:(source()?.sheetNames||[]).filter(n=>/^(Styczeń|Luty|Marzec|Kwiecień|Maj|Czerwiec|Lipiec|Sierpień|Wrzesień|Październik|Listopad|Grudzień|Inne\s+\d{2})$/i.test(n))}));
 async function importFromModel(model,fileName,{silent=false}={}){
  const sheets=(model?.sheetNames||[]).filter(n=>/^(Styczeń|Luty|Marzec|Kwiecień|Maj|Czerwiec|Lipiec|Sierpień|Wrzesień|Październik|Listopad|Grudzień|Inne\s+\d{2})$/i.test(n));
  if(!sheets.length){state.error='BRAK_ARKUSZY_HISTORII';return false;}
  const history=(model.history||[]).map(r=>({date:r.date,login:String(r.login),process:r.process,hours:Number(r.hours),source:r.source,sourceType:r.sourceType||'main',raw:r.raw||''}));
  const statuses=(model.statuses||[]).map(r=>({date:r.date,login:String(r.login),status:r.status,source:r.source}));
  const count=history.length+statuses.length;const unknown=(model.unexpected||[]).length;
  if(!count){state.error='BRAK_DANYCH_HISTORYCZNYCH';return false;}
  const loc=language?.()||'pl';const summary={
   pl:`Importować historię z ${fileName||'XLSX'}?\n${history.length} wpisów pracy, ${statuses.length} statusów, ${unknown} nierozpoznanych.\nIstniejące wpisy z tych samych dni będą zaktualizowane. Puste komórki nie usuwają wcześniejszej historii. Lokalne plany pozostaną bez zmian.`,
   ru:`Импортировать историю из ${fileName||'XLSX'}?\n${history.length} записей работы, ${statuses.length} статусов, ${unknown} нераспознанных.\nЗаписи тех же сотрудников за те же даты будут обновлены. Пустые ячейки не удаляют старую историю. Локальные планы останутся без изменений.`,
   en:`Import history from ${fileName||'XLSX'}?\n${history.length} work entries, ${statuses.length} day statuses, ${unknown} unrecognized.\nEntries for the same employee/date will be updated. Blank cells do not delete old history. Local plans stay intact.`,
   uk:`Імпортувати історію з ${fileName||'XLSX'}?\n${history.length} записів роботи, ${statuses.length} статусів, ${unknown} нерозпізнаних.\nЗаписи за ті самі дні буде оновлено. Порожні клітинки не видаляють стару історію. Локальні плани не зміняться.`};
  const message=summary[loc]||summary.pl;
  if(!silent&&typeof root.confirm==='function'&&!root.confirm(message))return false;
  state.importedHistory=replaceImported(state.importedHistory,history,sheets,r=>[r.source,r.date,r.login,r.process,r.hours,r.raw].join('|'));
  state.importedStatuses=replaceImported(state.importedStatuses,statuses,sheets,r=>[r.source,r.date,r.login,r.status].join('|'));
  state.importedSource=fileName||'';state.importedAt=new Date().toISOString();state.unrecognized=unknown;
  state.error=unknown?`${unknown} wpisów nierozpoznanych w źródle; nie przeniesiono ich automatycznie.`:'';
  await save();return state.status!=='BROWSER_SAVE_FAILED';
 }
 // STAN contains hourly snapshots, not a historical clock-in record.
 // On an untouched shift, make the latest populated STAN interval continue until
 // the next populated interval or shift end. Re-sync must not overwrite manual plans.
 function planFromStanIntervals(model,day,shift){
  const slots=makeSlots(day,shift),bySlot=new Map();
  const timeRx=/^(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})$/;
  for(const iv of model?.intervals||[]){
   const m=timeRx.exec(norm(iv.label));if(!m||Number(m[1])>23||Number(m[2])>59)continue;
   const at=`${pad(m[1])}:${pad(m[2])}`;
   const index=slots.findIndex(slot=>slot.from===at);
   if(index<0)continue;
   const people=(iv.people||[]).filter(p=>norm(p.login)&&norm(p.process));
   if(!people.length)continue; // Blank future columns mean unknown, not an empty shift.
   bySlot.set(index,people);
  }
  if(!bySlot.size)return {records:[],team:[]};
  const first=Math.min(...bySlot.keys());
  const team=new Set(),records=[];let current=[];
  const updated=new Date().toISOString();
  for(let slot=first;slot<slots.length;slot++){
   if(bySlot.has(slot))current=bySlot.get(slot);
   const seen=new Set();
   for(const person of current){const login=norm(person.login),process=norm(person.process);
    if(seen.has(login))continue;seen.add(login);team.add(login);
    records.push({day,shift,slot,login,process,updated});
   }
  }
  return {records,team:[...team]};
 }

 // Compare each hour covered by a populated STAN snapshot, including workers
 // absent from the refreshed snapshot. A blank STAN interval is unknown: it
 // must not be interpreted as an empty workforce or delete assignments.
 function compareStanPlan(model,day,shift,records,now=Date.now()){
  const incoming=planFromStanIntervals(model,day,shift).records;
  const hours=makeSlots(day,shift);
  if(!incoming.length)return [];
  const incomingMap=new Map(incoming.map(r=>[[r.slot,r.login].join('|'),r]));
  const local=new Map(records.filter(r=>r.day===day&&r.shift===shift).map(r=>[[r.slot,r.login].join('|'),r]));
  // planFromStanIntervals starts at the earliest populated snapshot and
  // carries the last known distribution through later blank intervals.
  const first=Math.min(...incoming.map(r=>r.slot));
  const keys=new Set([...incomingMap.keys(),...local.keys()].filter(key=>Number(key.split('|')[0])>=first));
  const differences=[];
  for(const key of keys){
   const fresh=incomingMap.get(key),old=local.get(key);
   if(!old&&!fresh)continue;
   if(old&&fresh&&processKey(old.process)===processKey(fresh.process))continue;
   const slot=(fresh||old).slot,login=(fresh||old).login;
   differences.push({day,shift,slot,login,local:old?.process||'',incoming:fresh?.process||'',
    past:hours[slot]?.end<=now,removal:!!old&&!fresh});
  }
  differences.sort((a,b)=>a.login.localeCompare(b.login)||a.slot-b.slot);
  const grouped=[];
  for(const r of differences){
   const prev=grouped[grouped.length-1];
   if(prev&&prev.login===r.login&&prev.endSlot===r.slot&&prev.local===r.local&&prev.incoming===r.incoming&&prev.past===r.past){
    prev.endSlot++;prev.label=(hours[prev.slot]?.from||'')+'–'+(hours[prev.endSlot-1]?.to||'');
   }else grouped.push({...r,id:[day,shift,r.slot,r.login].join('|'),endSlot:r.slot+1,
    label:hours[r.slot]?.label||'',choice:r.past?'mine':'stan'});
  }
  return grouped;
 }
 const stanSelectedCount=computed(()=>state.stanChanges.filter(c=>c.choice==='stan').length);
 function selectStanReview(which){if(which!=='future'&&which!=='none')return;for(const c of state.stanChanges)c.choice=which==='future'&&!c.past?'stan':'mine';}
 async function applyStanReview(){
  try{
  const changes=state.stanChanges;
  if(!changes.length)return false;
  if(changes.some(c=>c.day!==state.stanReviewDay||c.shift!==state.stanReviewShift))return false;
  const selected=changes.filter(c=>c.choice==='stan');
  if(!selected.length){state.stanChanges=[];state.stanNotice='STAN_NO_CHANGES_SELECTED';return false;}
  // The plan may have been edited after the preview. Do not overwrite such edits.
  for(const c of selected)for(let slot=c.slot;slot<c.endSlot;slot++){
   const current=state.records.find(r=>r.day===c.day&&r.shift===c.shift&&r.slot===slot&&r.login===c.login);
   if((current?.process||'')!==c.local){state.error='STAN_PREVIEW_OUTDATED';return false;}
  }
  // If an XLSX folder is connected, retain the complete pre-change workbook.
  if(folderHandle){
   const storage=await get('storageRoot')||folderHandle;
   if(await storage.queryPermission({mode:'readwrite'})==='granted'){
    const backupDir=await storage.getDirectoryHandle('Backup',{create:true});
    const name='Obsada_before_STAN_'+new Date().toISOString().replace(/[-:.]/g,'')+'_'+Math.random().toString(36).slice(2,7)+'.xlsx';
    const workbook=buildWorkbook(root.XLSX,state.records,state.importedHistory,state.importedStatuses,state.shiftTeams,state.stanSnapshot,state.hiddenProcesses,state.confirmations,state.excludedHistory,state.teamTemplates,state.tombstones);
    const content=root.XLSX.write(workbook,{type:'array',bookType:'xlsx'});
    const file=await backupDir.getFileHandle(name,{create:true});
    const writer=await file.createWritable();try{await writer.write(content);await writer.close();}catch(err){await writer.abort().catch(()=>{});throw err;}
   }else {state.error='FOLDER_PERMISSION_REQUIRED';return false;}
  }
  snapshot('stan-review');
  const keys=new Set(selected.flatMap(c=>Array.from({length:c.endSlot-c.slot},(_,n)=>[c.day,c.shift,c.slot+n,c.login].join('|'))));
  state.records=state.records.filter(r=>!keys.has([r.day,r.shift,r.slot,r.login].join('|')));
  const updated=new Date().toISOString();
  state.records.push(...selected.filter(c=>c.incoming).flatMap(c=>Array.from({length:c.endSlot-c.slot},(_,n)=>({day:c.day,shift:c.shift,slot:c.slot+n,login:c.login,process:c.incoming,updated}))));
  const key=shiftKey(state.stanReviewDay,state.stanReviewShift);
  state.shiftTeams={...state.shiftTeams,[key]:[...new Set([...(state.shiftTeams[key]||[]),...selected.map(c=>c.login)])]};
  await save();
  if(state.status==='BROWSER_SAVE_FAILED')return false;
  state.stanNotice='STAN_APPLIED_'+selected.length;
  state.stanChanges=[];
  return true;
  }catch(err){state.error=err.message||String(err);return false;}
 }
 function dismissStanReview(){state.stanChanges=[];state.stanNotice='STAN_REVIEW_DISMISSED';}
 async function syncFromSharePoint(model,fileName,day,shift){
  if(!model?.intervals||!Array.isArray(model.intervals))throw Error('INVALID_STAN');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!SHIFT_OPTIONS.some(s=>s[0]===shift))throw Error('STAN_DATE_SHIFT_REQUIRED');
  const stanData={updatedAt:new Date().toISOString(),day,shift,intervals:model.intervals.map(iv=>({label:norm(iv.label),people:(iv.people||[]).map(p=>({login:norm(p.login),process:norm(p.process)})).filter(p=>p.login&&p.process)}))};
  const previous={stan:state.stanSnapshot,records:state.records,teams:state.shiftTeams};
  // An untouched shift is seeded. Otherwise prepare an explicit, hourly
  // review instead of ignoring the refreshed STAN or overwriting local edits.
  const populated=state.records.some(r=>r.day===day&&r.shift===shift);
  const seed=populated?{records:[],team:[]}:planFromStanIntervals(model,day,shift);
  const changes=populated?compareStanPlan(model,day,shift,state.records):[];
  state.stanChanges=changes;
  state.stanReviewDay=day;state.stanReviewShift=shift;
  state.stanNotice=changes.length?'STAN_REVIEW_REQUIRED':seed.records.length?'STAN_INITIAL_PLAN':'STAN_NO_DIFFERENCES';
  state.stanSnapshot=stanData;
  if(seed.records.length){
   snapshot('stan-initial-plan');
   state.records=[...state.records,...seed.records];
   state.shiftTeams={...state.shiftTeams,[shiftKey(day,shift)]:seed.team};
  }
  try{
   const imported=await importFromModel(model,fileName,{silent:true});
   if(!imported){state.error='';await save();}
   if(state.status==='BROWSER_SAVE_FAILED')throw Error('BROWSER_SAVE_FAILED');
   // Show the shift that was actually imported, not a previously selected shift.
   if(seed.records.length){state.day=day;state.shift=shift;state.from=0;state.staffFilter='all';}
   return true;
  }catch(err){state.stanSnapshot=previous.stan;state.records=previous.records;state.shiftTeams=previous.teams;throw err;}
 }
 async function importFromCurrent(){try{return await importFromModel(source(),sourceName?.()||'SharePoint / STAN');}catch(err){state.error=err.message||String(err);return false;}}
 async function importHistoryFile(event){const file=event.target?.files?.[0];if(event.target)event.target.value='';if(!file)return false;try{if(!/\.xlsx?$/i.test(file.name))throw Error('EXPECTED_XLSX');const wb=root.XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});const model=root.ObsadaParser.extract(wb,root.XLSX);return await importFromModel(model,file.name);}catch(err){state.error=err.message||String(err);return false;}}
 // Historia editor: imported rows stay in the source workbook and are excluded locally.
 // Plans are removed from the corresponding shift and immediately cease counting.
 function isExcluded(row){return state.excludedHistory.includes(historyExclusionKey(row));}
 async function toggleHistoryExclusion(row,exclude=true){
  if(!row||row.origin!=='import')return false;
  const key=historyExclusionKey(row);
  const keys=new Set(state.excludedHistory);
  if(exclude)keys.add(key);else keys.delete(key);
  const before=state.excludedHistory;
  state.excludedHistory=[...keys];await save();
  if(state.status==='BROWSER_SAVE_FAILED'){state.excludedHistory=before;return false;}
  return true;
 }
 async function removeHistoryPlan(row){
  if(!row||row.origin!=='plan'||!row.shift)return false;
  const shift=shiftKey(row.date,row.shift);
  const before=state.records;
  const next=before.filter(r=>!(r.day===row.date&&r.shift===row.shift&&r.login===row.login&&processKey(r.process)===processKey(row.process)));
  if(next.length===before.length)return false;
  const warning={pl:'Usunąć przypisania tego pracownika na tym procesie w wybranej zmianie?',ru:'Удалить все часы этого сотрудника на этом процессе за выбранную смену?',en:'Delete this employee’s hours on this process for this shift?',uk:'Видалити всі години цього працівника на процесі за вибрану зміну?'};
  if(root.confirm&&!root.confirm(warning[language?.()]||warning.pl))return false;
  state.records=next;await save();
  if(state.status==='BROWSER_SAVE_FAILED'){state.records=before;return false;}
  return true;
 }
 async function manageHistoryRows(rows){
  const entries=Array.isArray(rows)?rows.filter(Boolean):[];
  if(!entries.length)return false;
  const plan=entries.filter(r=>r.origin==='plan'&&r.shift);
  const imported=entries.filter(r=>r.origin==='import');
  const localStatus=entries.filter(r=>r.kind==='status'&&r.source===ABSENCE_SOURCE);
  if(!plan.length&&!imported.length&&!localStatus.length)return false;
  const message={pl:'Zastosować zmiany do wybranych wpisów historii? Przydziały zostaną usunięte z planu, a dane SharePoint tylko wykluczone lokalnie.',ru:'Применить изменения к выбранным записям? Назначения будут удалены из плана, а записи SharePoint только исключены локально.',en:'Apply changes? Planned assignments will be deleted, SharePoint history only excluded locally.',uk:'Застосувати зміни? Призначення буде видалено, історію SharePoint лише виключено локально.'};
  if(typeof root.confirm==='function'&&!root.confirm(message[language?.()]||message.pl))return false;
  const remove=new Set(plan.map(r=>[r.date,r.shift,r.login,processKey(r.process)].join('|')));
  const records=state.records.filter(r=>!remove.has([r.day,r.shift,r.login,processKey(r.process)].join('|')));
  const excluded=new Set(state.excludedHistory);
  for(const r of imported){const key=historyExclusionKey(r);if(r.excluded)excluded.delete(key);else excluded.add(key);}
  const statusKeys=new Set(localStatus.map(r=>[r.date,r.login,r.status].join('|')));
  const newStatuses=state.importedStatuses.filter(r=>r.source!==ABSENCE_SOURCE||!statusKeys.has([r.date,r.login,r.status].join('|')));
  if(records.length===state.records.length&&[...excluded].sort().join('|')===[...state.excludedHistory].sort().join('|')&&newStatuses.length===state.importedStatuses.length)return false;
  const beforeRecords=state.records,beforeExcluded=state.excludedHistory,beforeStatuses=state.importedStatuses;
  snapshot('history-edit');state.records=records;state.excludedHistory=[...excluded];state.importedStatuses=newStatuses;await save();
  if(state.status==='BROWSER_SAVE_FAILED'){state.records=beforeRecords;state.excludedHistory=beforeExcluded;state.importedStatuses=beforeStatuses;return false;}
  return true;
 }
 async function ensureFolders(rootHandle){for(const name of ['OpenReports','SharePoint','Obsada','Import','Backup'])await rootHandle.getDirectoryHandle(name,{create:true});}
 async function getSharePointFolder(){const saved=await get('storageRoot');if(!saved)return null;if(await saved.queryPermission({mode:'read'})!=='granted')return null;return saved.getDirectoryHandle('SharePoint');}
 async function chooseFolder(){
  if(typeof root.showDirectoryPicker!=='function'){state.error='FOLDER_ACCESS_UNSUPPORTED';return false;}
  try{
   const selected=await root.showDirectoryPicker({id:'mrrobot-storage-root',mode:'readwrite'});
   if(await selected.requestPermission({mode:'readwrite'})!=='granted')throw Error('FOLDER_PERMISSION_REQUIRED');
   // Edge does not grant website access to the system Downloads folder.
   // The user creates Downloads/MrRobot once, then selects that subfolder.
   // Never require, or create directories under, the protected Downloads root.
   const name=selected.name.trim().toLocaleLowerCase();
   if(name!=='mrrobot')throw Error('MRROBOT_FOLDER_REQUIRED');
   const storageRoot=selected;
   await ensureFolders(storageRoot);
   // An existing base in the chosen folder is never silently moved.
   let active=storageRoot;
   try{await storageRoot.getFileHandle(FILE);}catch(e){if(e.name!=='NotFoundError')throw e;active=await storageRoot.getDirectoryHandle('Obsada',{create:true});}
   folderHandle=active;state.folderName=storageRoot.name+(active===storageRoot?'':'/Obsada');
   await put('folder',active);await put('storageRoot',storageRoot);
   await syncIfAllowed(true);
   if(state.status==='FOLDER_PERMISSION_REQUIRED'||state.status==='XLSX_FAILED')throw Error(state.status);
   state.error='';
   return true;
  }catch(err){if(err?.name!=='AbortError')state.error=err.message||String(err);return false;}
 }
 async function syncIfAllowed(force=false){if(writing){queued=true;return;}if(!folderHandle){state.status='LOCAL_SAVED_NOT_EXPORTED';return;}let permission;try{permission=await folderHandle.queryPermission({mode:'readwrite'});}catch(err){state.error=String(err);state.status='FOLDER_PERMISSION_REQUIRED';return;}if(permission!=='granted'){state.status='FOLDER_PERMISSION_REQUIRED';return;}writing=true;state.busy=true;const startedRevision=revision;try{const workbook=buildWorkbook(root.XLSX,state.records,state.importedHistory,state.importedStatuses,state.shiftTeams,state.stanSnapshot,state.hiddenProcesses,state.confirmations,state.excludedHistory,state.teamTemplates,state.tombstones);const buffer=root.XLSX.write(workbook,{type:'array',bookType:'xlsx'});let existing=null;
 try{existing=await folderHandle.getFileHandle(FILE);}catch(e){if(e.name!=='NotFoundError')throw e;}
 if(existing){
  const file=await existing.getFile();const workbook=root.XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});const disk=readDatabase(root.XLSX,workbook);const currentRecords=disk.records;
  const diskHash=fingerprint(disk.records,disk.history,disk.statuses,disk.shiftTeams,disk.stan,disk.hiddenProcesses,disk.confirmations,disk.excludedHistory,disk.teamTemplates,disk.tombstones);
  const localHash=persistedFingerprint(root.XLSX,state.records,state.importedHistory,state.importedStatuses,state.shiftTeams,state.stanSnapshot,state.hiddenProcesses,state.confirmations,state.excludedHistory,state.teamTemplates,state.tombstones);
  const diskLegacyHash=legacyFingerprint(disk.records);
  // Previous versions stored a fingerprint of the in-memory STAN, including
  // intervals with no workers. They are not present in the saved XLSX.
  // If the on-disk file already contains the same effective data, accept it
  // and upgrade the stored fingerprint without overwriting or making a backup.
  if(diskHash===localHash){
   lastExportHash=diskHash;await put('lastExportHash',diskHash);
   state.dirty=revision!==startedRevision;
   state.pendingChanges=state.dirty?Math.max(1,revision-startedRevision):0;
   state.lastExcelSync=new Date().toISOString();await put('lastExcelSync',state.lastExcelSync);
   state.status=state.dirty?'LOCAL_SAVED_NOT_EXPORTED':'XLSX_SYNCED';state.error='';
   return;
  }
  if(lastExportHash===null && (currentRecords.length||disk.history.length||disk.statuses.length) && !state.records.length && !state.importedHistory.length && !state.importedStatuses.length && !Object.keys(state.shiftTeams).length){state.records=currentRecords;state.importedHistory=disk.history;state.importedStatuses=disk.statuses;state.shiftTeams=disk.shiftTeams;state.stanSnapshot=disk.stan;state.hiddenProcesses=disk.hiddenProcesses;state.confirmations=disk.confirmations;state.excludedHistory=disk.excludedHistory;state.teamTemplates=disk.teamTemplates;state.tombstones=disk.tombstones;await put('records',{records:JSON.parse(JSON.stringify(state.records)),additionalProcesses:[...state.additionalProcesses],importedHistory:disk.history,importedStatuses:disk.statuses,shiftTeams:disk.shiftTeams,stanSnapshot:disk.stan,hiddenProcesses:disk.hiddenProcesses,confirmations:disk.confirmations,excludedHistory:disk.excludedHistory,teamTemplates:disk.teamTemplates,tombstones:disk.tombstones});lastExportHash=diskHash;await put('lastExportHash',diskHash);state.dirty=false;state.status='XLSX_IMPORTED_FROM_FOLDER';return;}
  if(diskHash!==localHash && diskHash!==lastExportHash && diskLegacyHash!==lastExportHash){state.status='EXTERNAL_CHANGES_DETECTED';return;}
 }
 const fileHandle=existing||await folderHandle.getFileHandle(FILE,{create:true});const writable=await fileHandle.createWritable();try{await writable.write(buffer);await writable.close();}catch(e){await writable.abort().catch(()=>{});throw e;}lastExportHash=persistedFingerprint(root.XLSX,state.records,state.importedHistory,state.importedStatuses,state.shiftTeams,state.stanSnapshot,state.hiddenProcesses,state.confirmations,state.excludedHistory,state.teamTemplates,state.tombstones);await put('lastExportHash',lastExportHash);state.dirty=revision!==startedRevision;state.pendingChanges=state.dirty?Math.max(1,revision-startedRevision):0;state.lastExcelSync=new Date().toISOString();await put('lastExcelSync',state.lastExcelSync);state.status=state.dirty?'LOCAL_SAVED_NOT_EXPORTED':'XLSX_SYNCED';state.error='';}catch(err){state.status='XLSX_FAILED';state.error=err.message||String(err);}finally{writing=false;state.busy=false;if(queued){queued=false;syncIfAllowed();}}}
 async function resolveConflictWithBackup(){
  if(state.status!=='EXTERNAL_CHANGES_DETECTED'||!folderHandle||state.busy)return false;
  const locale=language?.()||'pl';
  const warning={
   pl:'Plik Excel na dysku jest inny niż dane w Robocie. Przed zastąpieniem Robot utworzy kopię starego pliku w tym samym folderze. Zachowasz obie wersje. Kontynuować?',
   ru:'Excel на диске отличается от данных в Роботе. Перед заменой Робот сохранит резервную копию старого файла в той же папке. Обе версии останутся доступны. Продолжить?',
   en:'The disk Excel differs from the Robot data. Before replacing it, Robot will back up the previous Excel in the same folder. Both versions will remain available. Continue?',
   uk:'Excel на диску відрізняється від даних Робота. Перед заміною Робот збереже резервну копію старого файлу в тій самій папці. Обидві версії залишаться. Продовжити?'
  };
  if(!root.confirm?.(warning[locale]||warning.pl))return false;
  state.busy=true;
  try{
   if(await folderHandle.queryPermission({mode:'readwrite'})!=='granted')throw Error('FOLDER_PERMISSION_REQUIRED');
   const original=await folderHandle.getFileHandle(FILE);
   const file=await original.getFile();
   const raw=await file.arrayBuffer();
   const parsed=readDatabase(root.XLSX,root.XLSX.read(raw,{type:'array',cellDates:false}));
   const timestamp=new Date().toISOString().replace(/[-:]/g,'').replace('T','_').slice(0,15);
   const backupRoot=await get('storageRoot')||folderHandle;
   const backupDirectory=await backupRoot.getDirectoryHandle('Backup',{create:true});
   let backup;
   for(let i=0;i<20;i++){
    const name='MrRobot_Obsada_Baza_backup_'+timestamp+(i?'_'+i:'')+'.xlsx';
    try{await backupDirectory.getFileHandle(name);continue;}catch(err){if(err.name!=='NotFoundError')throw err;}
    backup=await backupDirectory.getFileHandle(name,{create:true});break;
   }
   if(!backup)throw Error('BACKUP_FILENAME_UNAVAILABLE');
   const writable=await backup.createWritable();
   try{await writable.write(raw);await writable.close();}catch(err){await writable.abort().catch(()=>{});throw err;}
   // Accept exactly the backed-up disk version as the last known version.
   // The normal save path still re-reads the original and refuses unexpected changes.
   lastExportHash=fingerprint(parsed.records,parsed.history,parsed.statuses,parsed.shiftTeams,parsed.stan,parsed.hiddenProcesses,parsed.confirmations,parsed.excludedHistory,parsed.teamTemplates,parsed.tombstones);
   state.status='LOCAL_SAVED_NOT_EXPORTED';
   state.error='';
  }catch(err){state.status='XLSX_FAILED';state.error=err.message||String(err);return false;}
  finally{state.busy=false;}
  await syncIfAllowed(true);
  return state.status==='XLSX_SYNCED';
 }
 function download(){const workbook=buildWorkbook(root.XLSX,state.records,state.importedHistory,state.importedStatuses,state.shiftTeams,state.stanSnapshot,state.hiddenProcesses,state.confirmations,state.excludedHistory,state.teamTemplates,state.tombstones);root.XLSX.writeFile(workbook,FILE);state.status='XLSX_DOWNLOADED';}
 function mergeKindLabel(kind){
  const labels={assignment:['Przydział','Назначение','Assignment','Призначення'],history:['Historia','История','History','Історія'],statuses:['Status','Статус','Status','Статус'],shiftTeams:['Zmiana','Смена','Shift','Зміна'],teamTemplates:['Zespół','Команда','Team','Команда'],stan:['STAN','STAN','STAN','STAN']};
  const index=({pl:0,ru:1,en:2,uk:3})[language?.()]??0;
  return (labels[kind]||[kind])[index]||kind;
 }
 function currentDatabase(){return {records:state.records,history:state.importedHistory,statuses:state.importedStatuses,shiftTeams:state.shiftTeams,teamTemplates:state.teamTemplates,stan:state.stanSnapshot,hiddenProcesses:state.hiddenProcesses,confirmations:state.confirmations,excludedHistory:state.excludedHistory,tombstones:state.tombstones};}
 let receivedFile=null;
 async function checkMergeFolderAccess(){
  if(!folderHandle){state.mergeFolderAccess='missing';return false;}
  try{
   const access=await folderHandle.queryPermission({mode:'readwrite'});
   state.mergeFolderAccess=access==='granted'?'granted':'permission';
   return access==='granted';
  }catch(err){state.mergeFolderAccess='permission';return false;}
 }
 async function reconnectMergeFolder(){
  state.error='';
  try{
   if(!folderHandle){
    const ok=await chooseFolder();
    if(!ok){await checkMergeFolderAccess();return false;}
   }else if(await folderHandle.requestPermission({mode:'readwrite'})!=='granted'){
    state.mergeFolderAccess='permission';state.error='FOLDER_PERMISSION_REQUIRED';return false;
   }
   await checkMergeFolderAccess();
   // A reconnect may load a newer base; never silently apply a stale preview.
   if(receivedFile&&receivedFile.baseline!==JSON.stringify(currentDatabase())){
    state.error='LOCAL_CHANGED_REPREVIEW_FILE';return false;
   }
   return state.mergeFolderAccess==='granted';
  }catch(err){state.error=err.message||String(err);await checkMergeFolderAccess();return false;}
 }
 async function previewColleagueFile(event){
  const file=event?.target?.files?.[0];if(event?.target)event.target.value='';if(!file)return;
  state.mergeMessage='';state.error='';state.mergePreview=null;receivedFile=null;state.mergeFolderAccess='unknown';
  try{
   if(!/\.xlsx$/i.test(file.name)||file.size>30*1024*1024)throw Error('EXPECTED_OBSADA_XLSX_UNDER_30MB');
   const bytes=await file.arrayBuffer();const workbook=root.XLSX.read(bytes,{type:'array',cellDates:false});
   const remote=readDatabase(root.XLSX,workbook);
   const preview=root.MRObsadaMerge.plan(currentDatabase(),remote);
   state.mergePreview={conflicts:preview.conflicts,counts:preview.counts};
   state.mergeChoices=Object.fromEntries(preview.conflicts.map(c=>[c.id,'mine']));
   state.mergeFileName=file.name;receivedFile={file,bytes,preview,baseline:JSON.stringify(currentDatabase())};
   await checkMergeFolderAccess();
  }catch(err){state.error=err.message||String(err);}
 }
 function cancelColleagueMerge(){receivedFile=null;state.mergePreview=null;state.mergeChoices={};state.mergeFileName='';}
 async function writeSafely(handle,bytes){const w=await handle.createWritable();try{await w.write(bytes);await w.close();}catch(e){await w.abort().catch(()=>{});throw e;}}
 async function applyColleagueMerge(){
  if(!receivedFile||state.mergeBusy)return false;
  if(!await checkMergeFolderAccess()){state.error=folderHandle?'FOLDER_PERMISSION_REQUIRED':'FOLDER_NOT_CONNECTED';return false;}
  state.mergeBusy=true;state.error='';
  try{
   if(receivedFile.baseline!==JSON.stringify(currentDatabase()))throw Error('LOCAL_CHANGED_REPREVIEW_FILE');
   if(await folderHandle.requestPermission({mode:'readwrite'})!=='granted')throw Error('FOLDER_PERMISSION_REQUIRED');
   // Backup contains the complete current browser state, including pending unsynced edits.
   const local=currentDatabase();
   const backup=root.XLSX.write(buildWorkbook(root.XLSX,local.records,local.history,local.statuses,local.shiftTeams,local.stan,local.hiddenProcesses,local.confirmations,local.excludedHistory,local.teamTemplates,local.tombstones),{type:'array',bookType:'xlsx'});
   const baseRoot=await get('storageRoot')||folderHandle;
   if(await baseRoot.queryPermission({mode:'readwrite'})!=='granted')throw Error('STORAGE_PERMISSION_REQUIRED');
   const backupDir=await baseRoot.getDirectoryHandle('Backup',{create:true});
   const importDir=await baseRoot.getDirectoryHandle('Import',{create:true});
   const stamp=new Date().toISOString().replace(/[-:.]/g,'').slice(0,15);
   const safeName=state.mergeFileName.replace(/[^a-z0-9_.-]/gi,'_').slice(0,70);
   const id=stamp+'_'+Math.random().toString(36).slice(2,7);
   await writeSafely(await backupDir.getFileHandle('Obsada_before_merge_'+id+'.xlsx',{create:true}),backup);
   await writeSafely(await importDir.getFileHandle('received_'+id+'_'+safeName,{create:true}),receivedFile.bytes);
   const result=receivedFile.preview.apply({...state.mergeChoices});
   state.records=result.records;state.importedHistory=result.history;state.importedStatuses=result.statuses;
   state.shiftTeams=result.shiftTeams;state.teamTemplates=result.teamTemplates;state.stanSnapshot=result.stan;
   state.hiddenProcesses=result.hiddenProcesses;state.confirmations=result.confirmations;state.excludedHistory=result.excludedHistory;state.tombstones=result.tombstones;
   await save();
   if(state.status==='BROWSER_SAVE_FAILED'||state.status==='XLSX_FAILED'||state.status==='EXTERNAL_CHANGES_DETECTED')throw Error(state.status);
   state.mergeMessage=({pl:'Bazy połączone. Kopia w Backup, plik kolegi w Import.',ru:'Базы объединены. Копия в Backup, файл коллеги в Import.',en:'Databases merged. Backup and received file preserved.',uk:'Бази об’єднано. Резервну копію та файл колеги збережено.'}[language?.()]||'Databases merged.');
   cancelColleagueMerge();return true;
  }catch(err){state.error=err.message||String(err);await checkMergeFolderAccess();return false;}
  finally{state.mergeBusy=false;}
 }
 async function importFile(event){const file=event.target.files?.[0];if(event.target)event.target.value='';if(!file)return;try{const wb=root.XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});const imported=readDatabase(root.XLSX,wb);const next=imported.records;if((state.records.length||state.importedHistory.length||state.importedStatuses.length||Object.keys(state.teamTemplates).length)&&!root.confirm(({pl:'Zastąpić bieżącą bazę plikiem Excel? Lokalne plany, historia i zapisane zespoły zostaną zastąpione.',ru:'Заменить текущую базу этим Excel? Локальные назначения, история и сохранённые команды будут заменены.',en:'Replace the current database with this Excel? Local plans, history and saved teams will be replaced.',uk:'Замінити поточну базу цим Excel? Локальні призначення, історію та збережені команди буде замінено.'}[language?.()]||'Replace the current database?')))return;state.records=next;state.importedHistory=imported.history;state.importedStatuses=imported.statuses;state.shiftTeams=imported.shiftTeams;state.stanSnapshot=imported.stan;state.hiddenProcesses=imported.hiddenProcesses;state.confirmations=imported.confirmations;state.excludedHistory=imported.excludedHistory;state.teamTemplates=imported.teamTemplates;state.tombstones=imported.tombstones;lastExportHash=fingerprint(next,imported.history,imported.statuses,imported.shiftTeams,imported.stan,imported.hiddenProcesses,imported.confirmations,imported.excludedHistory,imported.teamTemplates,imported.tombstones);await put('lastExportHash',lastExportHash);await save();state.status='LOCAL_IMPORTED';state.error='';}catch(err){state.error=err.message||String(err);}}
 async function init(){try{const saved=await get('records');if(saved){state.records=Array.isArray(saved.records)?saved.records.filter(validRecord):[];state.additionalProcesses=Array.isArray(saved.additionalProcesses)?saved.additionalProcesses:[];state.hiddenProcesses=Array.isArray(saved.hiddenProcesses)?saved.hiddenProcesses.map(processKey):[];state.confirmations=(saved.confirmations&&typeof saved.confirmations==='object')?saved.confirmations:{};state.excludedHistory=Array.isArray(saved.excludedHistory)?saved.excludedHistory.filter(x=>typeof x==='string'):[];state.teamTemplates=(saved.teamTemplates&&typeof saved.teamTemplates==='object'&&!Array.isArray(saved.teamTemplates))?saved.teamTemplates:{};state.tombstones=Array.isArray(saved.tombstones)?saved.tombstones:[];state.importedHistory=Array.isArray(saved.importedHistory)?saved.importedHistory:[];state.importedStatuses=Array.isArray(saved.importedStatuses)?saved.importedStatuses:[];state.shiftTeams=(saved.shiftTeams&&typeof saved.shiftTeams==='object')?saved.shiftTeams:{};state.stanSnapshot=saved.stanSnapshot||null;state.importedSource=saved.importedSource||'';state.importedAt=saved.importedAt||'';state.unrecognized=Number(saved.unrecognized)||0;}lastExportHash=await get('lastExportHash')||null;state.lastExcelSync=await get('lastExcelSync')||'';state.lastBrowserSave=await get('lastBrowserSave')||'';folderHandle=await get('folder')||null;state.folderName=folderHandle?.name||'';state.dirty=state.lastBrowserSave&&(!state.lastExcelSync||state.lastBrowserSave>state.lastExcelSync);state.status='LOCAL_SAVED_NOT_EXPORTED';state.active=true;lastSavedRecords=JSON.parse(JSON.stringify(state.records));lastFinishedTick=finishedHourCount(state.records,Date.now());
   // Recheck the actual file before claiming a synchronized Excel after startup.
   if(folderHandle && typeof folderHandle.queryPermission==='function'){try{if(await folderHandle.queryPermission({mode:'readwrite'})==='granted')await syncIfAllowed(true);}catch(err){state.status='FOLDER_PERMISSION_REQUIRED';}}}catch(err){state.error=err.message||String(err);state.active=true;}}
 init();
 return {tomorrowPlan,tomorrowPlanAvailableShifts,printTomorrowPlan,openTomorrowPrint,exportTomorrowExcel,exportCandidates,exportVisiblePeople,exportVisibleAbsent,exportSelectedCount,exportWorkerChecked,exportPartChecked,setExportWorker,setExportPart,toggleVisibleExport,openTomorrowExport,closeTomorrowExport,confirmTomorrowExport,openProcessMenu,openProcessActions,removeProcessPerson,staffStatus,staffWorkingCount,isWorkerAbsentAt,canAssignPerson,state,templateNames,templateDraftCandidates,newTeamTemplate,addTemplateDraftMember,removeTemplateDraftMember,saveTemplateDraft,sharedTimeline,activeTeamShifts,dayTeams,chooseTemplateForManagement,selectDayShift,openDayTeamRoster,openDayTeamSchedule,closeDayTeamEditor,changeDayTeamSchedule,setupDayTeam,removeDayTeam,chooseSharedHour,combinedAtHour,displayedAssignments,combinedScheduled,staffEntries,listedStaffEntries,visibleStaffEntries,staffTotal,staffAssignedCount,staffFreeCount,focusStaffEntry,dragStaffEntry,staffProcess,openStaffActions,removeStaffMember,combinedConflicts,foreignCount,focusAssignment,addParallelTeam,selectedWorkerProcess,saveTeamTemplate,loadTeamTemplate,deleteTeamTemplate,renameTeamTemplate,historyExclusionKey,isExcluded,toggleHistoryExclusion,removeHistoryPlan,manageHistoryRows,shifts,slots,teamKey,isConfirmed,finishedHours,futureHours,clockNow:computed(()=>clock.now),shiftHasEnded,shiftStatus,selectedSlot,current,readonlyRoster,readonlyDepartments,readonlyProcessChoices,isOtherDepartmentProcess,isFunctionalProcess,setOtherDepartmentProcess,setProcessDisplayGroup,restoreOtherDepartmentDefaults,startDepartmentDrag,endDepartmentDrag,leaveDepartmentDrop,dropDepartmentCard,readonlyTimeline,readonlyDisplayShifts,readonlySelectedHour,readonlyActiveShifts,chooseReadonlyHour,syncFromSharePoint,team,teamFree,teamCandidates,initialWorkers,listedWorkers,visibleWorkerList,unassigned,processes,processCatalog,existingProcess,processFilterExisting,processSuggestions,selectProcessSuggestion,processCards,currentPeopleCount,days,historyRows,importPreview,importFromCurrent,importHistoryFile,selectLogin,assign,remove,removeRange,chooseRemoval,confirmRemoval,openWorkerActions,toggleActionWorker,closeWorkerActions,applyDayStatus,markEarlyExit,markLateArrival,clearLateArrival,lateArrival,clearWorkerStatus,resumeWorker,removeFromSelectedHour,localAbsence,earlyExit,addTeamMember,removeTeamMember,restoreUndo,syncKind,canClose,syncTimeText,startDrag,drop,addProcess,hideProcess,seedFromSource,compareStanPlan,stanSelectedCount,selectStanReview,applyStanReview,dismissStanReview,chooseFolder,syncIfAllowed,resolveConflictWithBackup,download,importFile,getSharePointFolder,mergeKindLabel,previewColleagueFile,checkMergeFolderAccess,reconnectMergeFolder,applyColleagueMerge,cancelColleagueMerge};
}
root.MRObsadaPlanner={create,assignFromHour,autoHourConfirmed,finishedHourCount,historyExclusionKey,processKey,findProcessMatch,makeSlots,sheetRows,readWorkbook,readDatabase,buildWorkbook,validRecord,applyAssignment,dropAssignments,localDate,replaceImported,absenceDates,updateLocalAbsences,cutAfterHour,simultaneousAssignments,shiftHourForTimestamp,combinedTimeline,rosterAtTimestamp,splitRosterDepartments};
if(typeof module==='object'&&module.exports)module.exports=root.MRObsadaPlanner;
})(typeof window!=='undefined'?window:globalThis);
