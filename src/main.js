import './styles.css';
import '@fontsource/bricolage-grotesque/latin-600.css';
import '@fontsource/bricolage-grotesque/latin-700.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import { today, parse, addDays, addMonths, diff, fmtDate, money, plural, fmtSize } from './lib/dates.js';
import { planReminders, DEFAULTS } from './lib/reminders.js';
import { isNative, loadState, saveState, putFile as blobPut, getFile, delFile as blobDel, openFile, saveText, takePhoto, notifStatus, requestNotif, applyPlan, testNotification, onNotificationTap, onResume } from './native.js';

/* ---------- helpers ---------- */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-3);
const ICONS={
  home:'M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6',
  appliance:'M5 3h14v18H5zM5 9h14M8.5 6h.01M12 6h.01M9 13h6v5H9z',
  calendar:'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4',
  doc:'M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h7',
  plus:'M12 5v14M5 12h14',
  check:'M5 12l5 5 9-10',
  grid:'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  camera:'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  bell:'M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4'
};
const ic=n=>`<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[n]}"/></svg>`;

const CATS=['HVAC','Plumbing','Kitchen','Laundry','Electrical','Exterior','Safety','Other'];
const REC_TYPES=['Maintenance','Repair','Inspection','Upgrade'];
const DOC_KINDS=['Receipt','Invoice','Warranty','Manual','Other'];
const HOME_TYPES=['Single-family','Townhouse','Condo','Apartment','Multi-family','Other'];

/* ---------- storage ---------- */
/* ---------- storage ---------- */
let S;
let syncTimer=null;
function save(){saveState(S);clearTimeout(syncTimer);syncTimer=setTimeout(syncReminders,400)}
function syncReminders(){return applyPlan(planReminders(S,S.settings))}

function sample(){
  const t=today();const id=()=>uid();
  const furnace=id(),heater=id(),fridge=id(),dish=id(),ac=id(),washer=id();
  return {sample:true,settings:{...DEFAULTS},
    home:{name:'Maple Street House',address:'412 Maple Street, Springfield',type:'Single-family',yearBuilt:1994,sqft:2150,purchaseDate:addMonths(t,-66),notes:'Main shutoff valve is in the basement, north wall.'},
    items:[
      {id:furnace,name:'Gas furnace',category:'HVAC',room:'Basement',brand:'Carrier',model:'59TN6',serial:'4817E21093',installDate:addMonths(t,-117),purchasePrice:4850,warrantyProvider:'Carrier (parts)',warrantyEnd:addDays(t,38),warrantyNotes:'10-year parts warranty, register within 60 days of install.',notes:'Filter size 16x25x1.'},
      {id:ac,name:'Central air conditioner',category:'HVAC',room:'Exterior',brand:'Trane',model:'XR14',serial:'T21A88810',installDate:addMonths(t,-61),purchasePrice:5200,warrantyProvider:'Trane',warrantyEnd:addMonths(t,60),warrantyNotes:'',notes:''},
      {id:heater,name:'Water heater',category:'Plumbing',room:'Basement',brand:'Rheem',model:'XG50T06',serial:'RH0922334',installDate:addMonths(t,-50),purchasePrice:1180,warrantyProvider:'Rheem',warrantyEnd:addMonths(t,94),warrantyNotes:'12-year tank warranty.',notes:'50 gallon, gas.'},
      {id:fridge,name:'Refrigerator',category:'Kitchen',room:'Kitchen',brand:'Samsung',model:'RF28T5001SR',serial:'0A4P5NAT100',installDate:addMonths(t,-26),purchasePrice:1799,warrantyProvider:'Samsung',warrantyEnd:addDays(t,-62),warrantyNotes:'1-year limited.',notes:''},
      {id:dish,name:'Dishwasher',category:'Kitchen',room:'Kitchen',brand:'Bosch',model:'SHE53C85N',serial:'FD9301-4471',installDate:addMonths(t,-11),purchasePrice:899,warrantyProvider:'Bosch',warrantyEnd:addMonths(t,13),warrantyNotes:'',notes:''},
      {id:washer,name:'Washing machine',category:'Laundry',room:'Laundry room',brand:'LG',model:'WM3600HWA',serial:'',installDate:addMonths(t,-38),purchasePrice:949,warrantyProvider:'',warrantyEnd:'',warrantyNotes:'',notes:''}
    ],
    tasks:[
      {id:id(),itemId:furnace,title:'Replace furnace filter',intervalMonths:3,nextDue:addDays(t,-5),lastDone:addMonths(addDays(t,-5),-3),notes:'16x25x1 MERV 11'},
      {id:id(),itemId:'',title:'Test smoke and CO detectors',intervalMonths:6,nextDue:addDays(t,9),lastDone:'',notes:''},
      {id:id(),itemId:heater,title:'Flush tank and check anode rod',intervalMonths:12,nextDue:addDays(t,26),lastDone:addMonths(addDays(t,26),-12),notes:''},
      {id:id(),itemId:dish,title:'Clean filter and run cleaner cycle',intervalMonths:3,nextDue:addDays(t,34),lastDone:'',notes:''},
      {id:id(),itemId:ac,title:'Professional tune-up',intervalMonths:12,nextDue:addDays(t,142),lastDone:addMonths(addDays(t,142),-12),notes:''},
      {id:id(),itemId:'',title:'Clean gutters',intervalMonths:6,nextDue:addDays(t,58),lastDone:'',notes:''}
    ],
    records:[
      {id:id(),itemId:ac,type:'Repair',title:'Replaced capacitor and contactor',date:addMonths(t,-5),cost:385,contractor:'Cool Breeze HVAC',notes:'Unit was not starting. 90-day labor warranty.'},
      {id:id(),itemId:furnace,type:'Maintenance',title:'Replace furnace filter',date:addMonths(t,-3)>addDays(t,-5)?addDays(t,-95):addDays(t,-95),cost:14,contractor:'',notes:''},
      {id:id(),itemId:fridge,type:'Repair',title:'Ice maker replaced',date:addMonths(t,-8),cost:210,contractor:'Appliance Doctor',notes:'Part covered under warranty, labor billed.'},
      {id:id(),itemId:heater,type:'Maintenance',title:'Annual flush and inspection',date:addMonths(t,-12),cost:129,contractor:'Reliable Plumbing',notes:''},
      {id:id(),itemId:'',type:'Inspection',title:'Roof inspection after storm',date:addMonths(t,-16),cost:150,contractor:'Summit Roofing',notes:'No damage. Two lifted shingles resealed.'},
      {id:id(),itemId:furnace,type:'Repair',title:'Replaced igniter',date:addMonths(t,-29),cost:265,contractor:'Cool Breeze HVAC',notes:''}
    ],
    docs:[]};
}
function blank(){return {sample:false,settings:{...DEFAULTS},home:null,items:[],tasks:[],records:[],docs:[]}}

/* ---------- derived ---------- */
const item=id=>S.items.find(i=>i.id===id);
const itemName=id=>id?(item(id)?item(id).name:'Removed item'):'Whole home';
function warranty(i){
  if(!i.warrantyEnd)return {k:'none',label:'No warranty on file',days:null};
  const d=diff(i.warrantyEnd,today());
  if(d<0)return {k:'bad',label:'Expired '+fmtDate(i.warrantyEnd),short:'Expired',days:d};
  if(d<=90)return {k:'warn',label:'Ends in '+plural(d,'day'),short:'Ends in '+plural(d,'day'),days:d};
  return {k:'ok',label:'Active until '+fmtDate(i.warrantyEnd),short:'Active',days:d};
}
function due(t){
  const d=diff(t.nextDue,today());
  if(d<0)return {k:'bad',label:plural(-d,'day')+' overdue',d};
  if(d===0)return {k:'warn',label:'Due today',d};
  if(d<=30)return {k:d<=14?'warn':'accent',label:'Due in '+plural(d,'day'),d};
  return {k:'',label:'Due '+fmtDate(t.nextDue),d};
}
function age(i){
  if(!i.installDate)return '';
  const m=Math.max(0,Math.round(diff(today(),i.installDate)/30.44));
  return m<12?plural(m,'month'):(m/12).toFixed(m%12?1:0)+' yrs';
}
const sortedTasks=()=>[...S.tasks].sort((a,b)=>a.nextDue.localeCompare(b.nextDue));
const sortedRecords=()=>[...S.records].sort((a,b)=>b.date.localeCompare(a.date));
const docsFor=(f)=>S.docs.filter(f);

/* ---------- UI state ---------- */
const ui={q:'',cat:'All',recType:'All',docKind:'All',mtab:'upcoming'};
function route(){
  const h=location.hash.replace('#','');
  if(h.startsWith('appliance-'))return {name:'item',id:h.slice(10)};
  if(['overview','appliances','maintenance','history','documents','reminders','home'].includes(h))return {name:h==='history'?'maintenance':h,tab:h==='history'?'history':null};
  return {name:'overview'};
}
const NAV=[['overview','Overview','grid'],['appliances','Appliances','appliance'],['maintenance','Maintenance','calendar'],['documents','Documents','doc'],['reminders','Reminders','bell'],['home','My home','home']];
function renderNav(r){
  const cur=r.name==='item'?'appliances':r.name;
  $('#nav-d').innerHTML=NAV.map(([k,l,i])=>`<a href="#${k}" ${cur===k?'aria-current="page"':''}>${ic(i)}${l}</a>`).join('');
  $('#nav-m').innerHTML=NAV.map(([k,l,i])=>`<a href="#${k}" ${cur===k?'aria-current="page"':''}>${ic(i)}${k==='home'?'Home':l}</a>`).join('');
}

/* ---------- views ---------- */
function chip(k,t){return `<span class="chip ${k||''}">${esc(t)}</span>`}
function taskRow(t,opts={}){
  const d=due(t);const it=t.itemId?item(t.itemId):null;
  return `<div class="row"><div><div class="t">${esc(t.title)}</div><div class="meta"><span>${it?`<a href="#appliance-${it.id}">${esc(it.name)}</a>`:'Whole home'}</span>${t.intervalMonths?`<span>Every ${t.intervalMonths===12?'year':t.intervalMonths===1?'month':t.intervalMonths+' months'}</span>`:'<span>One time</span>'}${t.lastDone?`<span>Last done ${fmtDate(t.lastDone)}</span>`:''}</div></div>
  <div class="side-r">${chip(d.k,d.label)}<button class="btn sm primary" data-act="done-task" data-id="${t.id}">${ic('check')}Done</button>${opts.edit?`<button class="btn sm" data-act="edit-task" data-id="${t.id}">Edit</button>`:''}</div></div>`;
}
function recordRow(r){
  const n=S.docs.filter(d=>d.recordId===r.id).length;
  return `<div class="row"><div><div class="t">${esc(r.title)}</div><div class="meta"><span class="mono">${fmtDate(r.date)}</span><span>${r.itemId&&item(r.itemId)?`<a href="#appliance-${r.itemId}">${esc(item(r.itemId).name)}</a>`:'Whole home'}</span>${r.contractor?`<span>${esc(r.contractor)}</span>`:''}${n?`<span>${plural(n,'file')}</span>`:''}</div>${r.notes?`<div class="small muted" style="margin-top:3px">${esc(r.notes)}</div>`:''}</div>
  <div class="side-r">${chip(r.type==='Repair'?'warn':'',r.type)}<span class="mono" style="min-width:60px;text-align:right">${money(r.cost)}</span><button class="btn sm" data-act="edit-record" data-id="${r.id}">Edit</button></div></div>`;
}
function docRow(d){
  return `<div class="row"><div><div class="t">${esc(d.name)}</div><div class="meta"><span>${esc(d.kind)}</span><span>${d.itemId&&item(d.itemId)?`<a href="#appliance-${d.itemId}">${esc(item(d.itemId).name)}</a>`:'Whole home'}</span><span class="mono">${fmtDate(d.date)}</span><span>${fmtSize(d.size)}</span></div></div>
  <div class="side-r"><button class="btn sm" data-act="view-doc" data-id="${d.id}">View</button><button class="btn sm danger" data-act="del-doc" data-id="${d.id}">Delete</button></div></div>`;
}
const emptyBox=(msg,btn)=>`<div class="empty"><span>${msg}</span>${btn||''}</div>`;

function viewOverview(){
  const t=today();const h=S.home;
  const active=S.items.filter(i=>{const w=warranty(i);return w.k==='ok'||w.k==='warn'}).length;
  const expiring=S.items.filter(i=>warranty(i).k==='warn').length;
  const tasks=sortedTasks();
  const dueSoon=tasks.filter(x=>diff(x.nextDue,t)<=30).length;
  const overdue=tasks.filter(x=>diff(x.nextDue,t)<0).length;
  const yearAgo=addMonths(t,-12);
  const spend12=S.records.filter(r=>r.date>=yearAgo).reduce((a,r)=>a+(+r.cost||0),0);
  const byYear={};S.records.forEach(r=>{const y=r.date.slice(0,4);byYear[y]=(byYear[y]||0)+(+r.cost||0)});
  const years=Object.keys(byYear).sort().reverse().slice(0,5);const max=Math.max(1,...years.map(y=>byYear[y]));
  const wl=S.items.filter(i=>i.warrantyEnd&&diff(i.warrantyEnd,t)>=-90&&diff(i.warrantyEnd,t)<=365).sort((a,b)=>a.warrantyEnd.localeCompare(b.warrantyEnd));
  const remind=(isNative&&!S.sample&&permState==='prompt')?`<div class="banner"><span>Turn on reminders for maintenance tasks and warranty expirations.</span><a class="btn sm primary" href="#reminders">Set up reminders</a></div>`:'';
  const banner=remind+(S.sample?`<div class="banner"><span>You are looking at sample data for a made-up house. Clear it to start your own ledger.</span><button class="btn sm primary" data-act="start-fresh">Start my own ledger</button></div>`:'');
  const hero=h?`<div class="hero"><div class="label">Your home</div><h1>${esc(h.name)}</h1><div class="facts">${h.address?`<span>${esc(h.address)}</span>`:''}${h.type?`<span><b>${esc(h.type)}</b></span>`:''}${h.yearBuilt?`<span>Built <b>${h.yearBuilt}</b></span>`:''}${h.sqft?`<span><b class="num">${Number(h.sqft).toLocaleString()}</b> sq ft</span>`:''}${h.purchaseDate?`<span>Owned since <b>${fmtDate(h.purchaseDate)}</b></span>`:''}</div></div>`
   :`<div class="hero"><div class="label">Welcome</div><h1>Register your home</h1><p class="muted">Add the basics once. Then record each appliance, its warranty, receipts and every repair, so it is all in one place when something breaks.</p><div><button class="btn primary" data-act="edit-home">${ic('home')}Register home</button></div></div>`;
  return `${banner}${hero}
  <div class="stats">
    <div class="stat"><span class="label">Appliances</span><span class="v">${S.items.length}</span><span class="s">${plural(S.docs.length,'document')} on file</span></div>
    <div class="stat"><span class="label">Under warranty</span><span class="v">${active}</span><span class="s">${expiring?expiring+' ending within 90 days':'none ending soon'}</span></div>
    <div class="stat"><span class="label">Tasks due</span><span class="v">${dueSoon}</span><span class="s">${overdue?`<span style="color:var(--bad)">${overdue} overdue</span>`:'next 30 days'}</span></div>
    <div class="stat"><span class="label">Spent, 12 months</span><span class="v">${money(spend12)}</span><span class="s">repairs and upkeep</span></div>
  </div>
  <div class="grid2">
    <section class="card"><div class="card-head"><h2>Coming up</h2><a href="#maintenance">All tasks</a></div>
      ${tasks.length?`<div class="rows">${tasks.slice(0,5).map(x=>taskRow(x)).join('')}</div>`:emptyBox('No maintenance tasks yet.',`<button class="btn sm" data-act="add-task">${ic('plus')}Add a task</button>`)}</section>
    <section class="card"><div class="card-head"><h2>Warranty watch</h2><a href="#appliances">Appliances</a></div>
      ${wl.length?`<div class="rows">${wl.slice(0,5).map(i=>{const w=warranty(i);return `<div class="row click" data-act="open-item" data-id="${i.id}"><div><div class="t">${esc(i.name)}</div><div class="meta"><span>${esc(i.warrantyProvider||i.brand||'')}</span><span class="mono">${fmtDate(i.warrantyEnd)}</span></div></div><div class="side-r">${chip(w.k,w.short)}</div></div>`}).join('')}</div>`:emptyBox('No warranties ending in the next year.')}</section>
  </div>
  <div class="grid2">
    <section class="card"><div class="card-head"><h2>Recent history</h2><a href="#history">Full history</a></div>
      ${S.records.length?`<div class="rows">${sortedRecords().slice(0,4).map(recordRow).join('')}</div>`:emptyBox('No repairs or service logged yet.',`<button class="btn sm" data-act="add-record">${ic('plus')}Log service</button>`)}</section>
    <section class="card"><div class="card-head"><h2>Spending by year</h2></div>
      ${years.length?`<div class="bars">${years.map(y=>`<div class="bar"><span class="mono muted">${y}</span><div class="track"><div class="fill" style="width:${Math.max(2,byYear[y]/max*100)}%"></div></div><span class="mono" style="text-align:right">${money(byYear[y])}</span></div>`).join('')}</div>`:emptyBox('Costs you log will add up here.')}</section>
  </div>`;
}

function viewAppliances(){
  const q=ui.q.toLowerCase();
  const list=S.items.filter(i=>(ui.cat==='All'||i.category===ui.cat)&&(!q||[i.name,i.brand,i.model,i.room,i.serial].join(' ').toLowerCase().includes(q)))
    .sort((a,b)=>a.name.localeCompare(b.name));
  return `<div class="page-head"><div><div class="label">Appliances and equipment</div><h1>${plural(S.items.length,'item')}</h1></div>
    <div class="actions"><button class="btn primary" data-act="add-item">${ic('plus')}Add appliance</button></div></div>
  <div class="toolbar"><input id="q" type="search" placeholder="Search name, brand, model, room" value="${esc(ui.q)}" aria-label="Search appliances">
    <select id="cat" aria-label="Category"><option>All</option>${CATS.map(c=>`<option ${ui.cat===c?'selected':''}>${c}</option>`).join('')}</select></div>
  <div id="applist">${appList(list)}</div>`;
}
function appList(list){
  if(!list.length)return S.items.length?emptyBox('Nothing matches that search.'):emptyBox('Add your first appliance to start tracking warranties and service.',`<button class="btn primary" data-act="add-item">${ic('plus')}Add appliance</button>`);
  return `<div class="cards">${list.map(i=>{
    const w=warranty(i);const nt=sortedTasks().find(t=>t.itemId===i.id);
    return `<div class="item-card" role="button" tabindex="0" data-act="open-item" data-id="${i.id}">
      <div class="top"><div><div class="nm">${esc(i.name)}</div><div class="small muted">${esc([i.brand,i.model].filter(Boolean).join(' '))||'No model recorded'}</div></div>${chip('accent',i.category)}</div>
      <div class="small muted">${esc(i.room||'No room set')}${i.installDate?` · installed ${fmtDate(i.installDate)} (${age(i)})`:''}</div>
      <div class="ft">${chip(w.k==='none'?'':w.k,w.label)}${nt?`<span class="small">${esc(nt.title)} · <span class="mono">${esc(due(nt).label)}</span></span>`:'<span class="small muted">No upcoming tasks</span>'}</div></div>`}).join('')}</div>`;
}

function viewItem(id){
  const i=item(id);
  if(!i)return `<div class="page-head"><h1>Not found</h1></div>${emptyBox('That appliance no longer exists.',`<a class="btn" href="#appliances">Back to appliances</a>`)}`;
  const w=warranty(i);
  const tasks=sortedTasks().filter(t=>t.itemId===id);
  const recs=sortedRecords().filter(r=>r.itemId===id);
  const docs=S.docs.filter(d=>d.itemId===id);
  const spent=recs.reduce((a,r)=>a+(+r.cost||0),0);
  const dd=(k,v)=>`<div><dt>${k}</dt><dd>${v||'—'}</dd></div>`;
  return `<div class="page-head"><div><a href="#appliances" class="small">← All appliances</a><h1 style="margin-top:4px">${esc(i.name)}</h1><div class="muted">${esc([i.brand,i.model].filter(Boolean).join(' '))}</div></div>
    <div class="actions"><button class="btn" data-act="edit-item" data-id="${id}">Edit details</button></div></div>
  <section class="card"><div class="card-head"><h2>Details</h2>${chip(w.k==='none'?'':w.k,w.label)}</div>
    <dl class="dl">${dd('Category',esc(i.category))}${dd('Location',esc(i.room))}${dd('Installed',i.installDate?fmtDate(i.installDate)+' · '+age(i):'')}${dd('Purchase price',i.purchasePrice!=null&&i.purchasePrice!==''?`<span class="mono">${money(i.purchasePrice)}</span>`:'')}${dd('Serial number',i.serial?`<span class="mono">${esc(i.serial)}</span>`:'')}${dd('Warranty provider',esc(i.warrantyProvider))}${dd('Warranty ends',i.warrantyEnd?fmtDate(i.warrantyEnd):'')}${dd('Spent on upkeep',`<span class="mono">${money(spent)}</span>`)}</dl>
    ${i.warrantyNotes?`<p class="small muted" style="margin-top:14px"><b>Warranty terms:</b> ${esc(i.warrantyNotes)}</p>`:''}
    ${i.notes?`<p class="small muted" style="margin-top:8px"><b>Notes:</b> ${esc(i.notes)}</p>`:''}</section>
  <div class="grid2">
   <section class="card"><div class="card-head"><h2>Upcoming maintenance</h2><button class="btn sm" data-act="add-task" data-item="${id}">${ic('plus')}Task</button></div>
     ${tasks.length?`<div class="rows">${tasks.map(t=>taskRow(t,{edit:1})).join('')}</div>`:emptyBox('No tasks scheduled for this item.')}</section>
   <section class="card"><div class="card-head"><h2>Documents</h2><button class="btn sm" data-act="add-doc" data-item="${id}">${ic('plus')}Upload</button></div>
     ${docs.length?`<div class="rows">${docs.map(docRow).join('')}</div>`:emptyBox('Upload the receipt, manual or warranty card.')}</section>
  </div>
  <section class="card"><div class="card-head"><h2>Service and repair history</h2><button class="btn sm" data-act="add-record" data-item="${id}">${ic('plus')}Log service</button></div>
     ${recs.length?`<div class="rows">${recs.map(recordRow).join('')}</div>`:emptyBox('Nothing logged yet.')}</section>`;
}

function viewMaintenance(tab){
  if(tab)ui.mtab=tab;
  const up=ui.mtab==='upcoming';
  let body;
  if(up){
    const ts=sortedTasks();
    body=ts.length?`<div class="card"><div class="rows">${ts.map(t=>taskRow(t,{edit:1})).join('')}</div></div>`:emptyBox('No upcoming tasks. Add filter changes, inspections and seasonal chores.',`<button class="btn primary" data-act="add-task">${ic('plus')}Add task</button>`);
  }else{
    const rs=sortedRecords().filter(r=>ui.recType==='All'||r.type===ui.recType);
    const total=rs.reduce((a,r)=>a+(+r.cost||0),0);
    body=`<div class="toolbar"><select id="rtype" aria-label="Filter by type"><option>All</option>${REC_TYPES.map(c=>`<option ${ui.recType===c?'selected':''}>${c}</option>`).join('')}</select><span class="muted" style="flex:2 1 160px">${plural(rs.length,'entry')} · <span class="mono">${money(total)}</span> total</span></div>
    ${rs.length?`<div class="card"><div class="rows">${rs.map(recordRow).join('')}</div></div>`:emptyBox('No history yet.',`<button class="btn primary" data-act="add-record">${ic('plus')}Log service</button>`)}`;
  }
  return `<div class="page-head"><div><div class="label">Maintenance</div><h1>${up?'Upcoming tasks':'Repair and service history'}</h1></div>
   <div class="actions"><button class="btn" data-act="add-task">${ic('plus')}Add task</button><button class="btn primary" data-act="add-record">${ic('plus')}Log service</button></div></div>
   <div><div class="seg"><a href="#maintenance" ${up?'aria-current="true"':''}>Upcoming</a><a href="#history" ${!up?'aria-current="true"':''}>History</a></div></div>${body}`;
}

function viewDocuments(){
  const ds=[...S.docs].filter(d=>ui.docKind==='All'||d.kind===ui.docKind).sort((a,b)=>b.date.localeCompare(a.date));
  return `<div class="page-head"><div><div class="label">Documents</div><h1>Receipts and invoices</h1></div><div class="actions"><button class="btn primary" data-act="add-doc">${ic('plus')}Upload document</button></div></div>
  <div class="toolbar"><select id="dkind" aria-label="Filter by type"><option>All</option>${DOC_KINDS.map(c=>`<option ${ui.docKind===c?'selected':''}>${c}</option>`).join('')}</select><span class="muted" style="flex:2 1 160px">${plural(ds.length,'file')}. Images and PDFs up to 10 MB.</span></div>
  ${ds.length?`<div class="card"><div class="rows">${ds.map(docRow).join('')}</div></div>`:emptyBox('No documents yet. Upload a receipt, contractor invoice, manual or warranty card.',`<button class="btn primary" data-act="add-doc">${ic('plus')}Upload document</button>`)}`;
}

function viewHome(){
  const h=S.home;const dd=(k,v)=>`<div><dt>${k}</dt><dd>${v||'—'}</dd></div>`;
  return `<div class="page-head"><div><div class="label">My home</div><h1>${h?esc(h.name):'Register your home'}</h1></div><div class="actions"><button class="btn primary" data-act="edit-home">${h?'Edit home':'Register home'}</button></div></div>
  ${h?`<section class="card"><dl class="dl">${dd('Address',esc(h.address))}${dd('Home type',esc(h.type))}${dd('Year built',h.yearBuilt)}${dd('Size',h.sqft?Number(h.sqft).toLocaleString()+' sq ft':'')}${dd('Purchased',h.purchaseDate?fmtDate(h.purchaseDate):'')}</dl>${h.notes?`<p class="small muted" style="margin-top:14px"><b>Notes:</b> ${esc(h.notes)}</p>`:''}</section>`:emptyBox('No home registered yet.')}
  <section class="card"><div class="card-head"><h2>Your data</h2></div>
    <p class="muted">Everything is saved on this device. Export a backup file of your records to keep a copy or move to another device. Uploaded receipts and photos are not included in the backup.</p>
    <div class="toolbar" style="margin-top:12px"><button class="btn" data-act="export">Export backup (JSON)</button><button class="btn" data-act="import">Import backup</button>${S.sample?`<button class="btn danger" data-act="start-fresh">Clear sample data</button>`:''}<input type="file" id="importfile" accept="application/json,.json" hidden></div></section>`;
}

const HOURS=[6,7,8,9,10,12,17,18,20];
const hourLabel=h=>(h%12||12)+':00 '+(h<12?'AM':'PM');
function viewReminders(){
  const s=S.settings;
  const plan=planReminders(S,s);
  const sel=(id,label,opts,val,hint)=>`<div class="field"><label for="${id}">${label}</label><select id="${id}">${opts.map(([v,l])=>`<option value="${v}" ${String(val)===String(v)?'selected':''}>${l}</option>`).join('')}</select>${hint?`<span class="hint">${hint}</span>`:''}</div>`;
  const perm=!isNative?`<div class="banner"><span>Reminders are delivered by the HomeLedger apps for iPhone and Android. You can set your preferences here, but this browser will not send anything.</span></div>`
    :permState==='denied'?`<div class="banner"><span>Notifications are turned off for HomeLedger. Turn them on in your phone's Settings, under HomeLedger, Notifications.</span></div>`
    :permState!=='granted'?`<div class="banner"><span>Allow notifications so HomeLedger can remind you.</span><button class="btn sm primary" data-act="allow-notif">Allow notifications</button></div>`:'';
  return `<div class="page-head"><div><div class="label">Reminders</div><h1>Never miss a service date</h1></div>${isNative&&permState==='granted'?`<div class="actions"><button class="btn" data-act="test-notif">Send a test in 5 seconds</button></div>`:''}</div>
  ${perm}
  ${S.sample?`<div class="banner"><span>Reminders are paused while sample data is shown. They start once you add your own appliances and tasks.</span><button class="btn sm primary" data-act="start-fresh">Start my own ledger</button></div>`:''}
  <section class="card"><div class="card-head"><h2>When to remind me</h2></div>
    <div class="fields" style="padding:0">
      ${sel('s-notify','Reminders',[['true','On'],['false','Off']],s.notify)}
      ${sel('s-hour','Time of day',HOURS.map(h=>[h,hourLabel(h)]),s.hour)}
      ${sel('s-taskLead','Maintenance tasks',[[0,'On the due date only'],[1,'1 day before and on the date'],[2,'2 days before and on the date'],[3,'3 days before and on the date'],[7,'1 week before and on the date']],s.taskLead)}
      ${sel('s-warrantyLead','Warranty expirations',[[7,'1 week before'],[14,'2 weeks before'],[30,'30 days and 1 week before'],[60,'60 days and 1 week before'],[90,'90 days and 1 week before']],s.warrantyLead,'You also get a reminder on the last day.')}
      ${sel('s-overdue','Overdue tasks',[['true','Remind me again 3 days after'],['false','Do not remind me again']],s.overdue)}
    </div></section>
  <section class="card"><div class="card-head"><h2>Scheduled next</h2></div>
    ${plan.length?`<div class="rows">${plan.slice(0,8).map(p=>`<div class="row"><div><div class="t">${esc(p.title)}</div><div class="meta"><span>${esc(p.body)}</span></div></div><div class="side-r"><span class="mono small">${p.at.toLocaleDateString(undefined,{month:'short',day:'numeric'})}, ${p.at.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</span></div></div>`).join('')}</div>`:emptyBox(!s.notify?'Reminders are off.':S.sample?'Nothing is scheduled while sample data is shown.':'Nothing to schedule yet. Add maintenance tasks or warranty dates.')}
  </section>`;
}
let permState='unsupported';

/* ---------- render ---------- */
function render(){
  const r=route();renderNav(r);
  const v=$('#view');
  v.innerHTML=r.name==='overview'?viewOverview():r.name==='appliances'?viewAppliances():r.name==='item'?viewItem(r.id):r.name==='maintenance'?viewMaintenance(r.tab||'upcoming'):r.name==='documents'?viewDocuments():r.name==='reminders'?viewReminders():viewHome();
  document.title='HomeLedger';
}
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0)});

/* ---------- modal + forms ---------- */
let objUrl=null;
let formPhotos=[];
function closeModal(){const m=$('#modal');m.classList.remove('open');m.innerHTML='';formPhotos=[];if(objUrl){URL.revokeObjectURL(objUrl);objUrl=null}}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2600)}
function fieldHtml(f,v){
  const val=v[f.name]==null?'':v[f.name];const id='f-'+f.name;
  let c;
  if(f.type==='select')c=`<select id="${id}" name="${f.name}">${f.options.map(o=>{const [ov,ol]=Array.isArray(o)?o:[o,o];return `<option value="${esc(ov)}" ${String(val)===String(ov)?'selected':''}>${esc(ol)}</option>`}).join('')}</select>`;
  else if(f.type==='textarea')c=`<textarea id="${id}" name="${f.name}" placeholder="${esc(f.ph||'')}">${esc(val)}</textarea>`;
  else if(f.type==='file')c=`<input id="${id}" name="${f.name}" type="file" accept="image/*,application/pdf" multiple>${isNative?`<div class="photo-row"><button type="button" class="btn sm" data-act="snap">${ic('camera')}Take photo</button><span class="small muted" id="snapnote"></span></div>`:''}`;
  else c=`<input id="${id}" name="${f.name}" type="${f.type||'text'}" ${f.type==='number'?'step="any" min="0" inputmode="decimal"':''} value="${esc(val)}" placeholder="${esc(f.ph||'')}" ${f.req?'required':''}>`;
  return `<div class="field ${f.full?'full':''}"><label for="${id}">${esc(f.label)}${f.req?' *':''}</label>${c}${f.hint?`<span class="hint">${esc(f.hint)}</span>`:''}</div>`;
}
function openForm({title,fields,values={},submit='Save',onSubmit,onDelete,delLabel='Delete'}){
  const m=$('#modal');
  m.innerHTML=`<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><form id="mform" novalidate>
    <header><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-act="close" aria-label="Close">×</button></header>
    <div class="fields">${fields.map(f=>fieldHtml(f,values)).join('')}</div><div class="err" id="ferr" hidden></div>
    <footer>${onDelete?`<button type="button" class="btn danger" id="fdel">${delLabel}</button>`:'<span></span>'}<div class="r"><button type="button" class="btn" data-act="close">Cancel</button><button type="submit" class="btn primary">${esc(submit)}</button></div></footer></form></div>`;
  m.classList.add('open');
  const form=$('#mform');const err=$('#ferr');
  const first=form.querySelector('input,select,textarea');if(first&&matchMedia('(pointer:fine)').matches)first.focus();
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const data={};
    for(const f of fields){
      const el=form.elements[f.name];
      if(f.type==='file')data[f.name]=[...el.files,...formPhotos];
      else if(f.type==='number')data[f.name]=el.value===''?null:Number(el.value);
      else data[f.name]=el.value.trim();
      if(f.req&&(data[f.name]===''||data[f.name]==null)){err.hidden=false;err.textContent=f.label+' is required.';el.focus();return}
    }
    const res=await onSubmit(data);
    if(typeof res==='string'){err.hidden=false;err.textContent=res;return}
    closeModal();render();
  });
  if(onDelete){const b=$('#fdel');b.addEventListener('click',async()=>{
    if(!b.dataset.sure){b.dataset.sure=1;b.textContent='Click again to confirm';return}
    await onDelete();closeModal();toast('Deleted');
    if(route().name==='item'&&!item(route().id))location.hash='#appliances';else render();
  })}
}
const itemOpts=()=>[['','Whole home / general'],...S.items.map(i=>[i.id,i.name])];

async function addFiles(files,meta){
  let n=0;
  for(const f of files){
    if(f.size>10*1048576){toast(f.name+' is over 10 MB and was skipped.');continue}
    if(!/^image\//.test(f.type)&&f.type!=='application/pdf'){toast(f.name+' is not an image or PDF.');continue}
    const id=uid();await blobPut(id,f);
    S.docs.push({id,name:f.name,kind:meta.kind,mime:f.type,size:f.size,itemId:meta.itemId||'',recordId:meta.recordId||'',date:meta.date||today()});n++;
  }
  return n;
}

function formHome(){
  const h=S.home||{};
  openForm({title:S.home?'Edit home':'Register your home',values:h,submit:S.home?'Save':'Register',fields:[
    {name:'name',label:'Home nickname',req:1,ph:'e.g. Maple Street House',full:1},
    {name:'address',label:'Address',full:1},
    {name:'type',label:'Home type',type:'select',options:HOME_TYPES},
    {name:'yearBuilt',label:'Year built',type:'number',ph:'1994'},
    {name:'sqft',label:'Square feet',type:'number'},
    {name:'purchaseDate',label:'Purchase date',type:'date'},
    {name:'notes',label:'Notes',type:'textarea',full:1,ph:'Shutoff valve locations, paint colors, anything you want to remember'}],
    onSubmit:d=>{S.home={...d};save();toast('Home saved')}});
}
function formItem(id){
  const i=id?item(id):null;
  openForm({title:i?'Edit appliance':'Add appliance',values:i||{category:'Kitchen'},submit:i?'Save':'Add appliance',
    fields:[
      {name:'name',label:'Name',req:1,ph:'e.g. Water heater',full:1},
      {name:'category',label:'Category',type:'select',options:CATS},
      {name:'room',label:'Location',ph:'Basement, kitchen, garage'},
      {name:'brand',label:'Brand'},{name:'model',label:'Model number'},
      {name:'serial',label:'Serial number'},{name:'purchasePrice',label:'Purchase price ($)',type:'number'},
      {name:'installDate',label:'Installation date',type:'date'},
      {name:'warrantyEnd',label:'Warranty expires',type:'date',hint:'Leave empty and fill the length below to calculate it.'},
      {name:'warrantyYears',label:'Warranty length (years)',type:'number',hint:'Counted from the installation date.'},
      {name:'warrantyProvider',label:'Warranty provider'},
      {name:'warrantyNotes',label:'Warranty terms',type:'textarea',full:1,ph:'What is covered, how to claim, registration number'},
      {name:'notes',label:'Notes',type:'textarea',full:1}],
    onSubmit:d=>{
      if(!d.warrantyEnd&&d.warrantyYears&&d.installDate)d.warrantyEnd=addMonths(d.installDate,Math.round(d.warrantyYears*12));
      delete d.warrantyYears;
      if(i)Object.assign(i,d);else S.items.push({id:uid(),...d});
      save();toast(i?'Appliance updated':'Appliance added');
    },
    onDelete:i?()=>{S.items=S.items.filter(x=>x.id!==id);S.tasks.forEach(t=>{if(t.itemId===id)t.itemId=''});S.records.forEach(r=>{if(r.itemId===id)r.itemId=''});S.docs.forEach(d=>{if(d.itemId===id)d.itemId=''});save()}:null,
    delLabel:'Delete appliance'});
}
function formRecord(id,itemId){
  const r=id?S.records.find(x=>x.id===id):null;
  openForm({title:r?'Edit service entry':'Log service or repair',values:r||{type:'Maintenance',itemId:itemId||'',date:today(),docKind:'Invoice'},submit:r?'Save':'Log it',
    fields:[
      {name:'title',label:'What was done',req:1,full:1,ph:'e.g. Replaced capacitor'},
      {name:'type',label:'Type',type:'select',options:REC_TYPES},
      {name:'date',label:'Date',type:'date',req:1},
      {name:'itemId',label:'Applies to',type:'select',options:itemOpts()},
      {name:'cost',label:'Total cost ($)',type:'number'},
      {name:'contractor',label:'Contractor or company',full:1},
      {name:'notes',label:'Notes',type:'textarea',full:1},
      {name:'files',label:r?'Attach more files':'Attach receipt or invoice',type:'file',full:1,hint:'Images or PDFs up to 10 MB each.'},
      {name:'docKind',label:'Attachment type',type:'select',options:['Invoice','Receipt','Other']}],
    onSubmit:async d=>{
      const {files,docKind,...rest}=d;let rec=r;
      if(r)Object.assign(r,rest);else{rec={id:uid(),...rest};S.records.push(rec)}
      const n=await addFiles(files,{kind:docKind,itemId:rec.itemId,recordId:rec.id,date:rec.date});
      save();toast(n?'Saved with '+plural(n,'file'):'Service entry saved');
    },
    onDelete:r?()=>{S.records=S.records.filter(x=>x.id!==id);S.docs.forEach(d=>{if(d.recordId===id)d.recordId=''});save()}:null});
}
const INTERVALS=[[0,'One time only'],[1,'Every month'],[3,'Every 3 months'],[6,'Every 6 months'],[12,'Every year'],[24,'Every 2 years'],[60,'Every 5 years']];
function formTask(id,itemId){
  const t=id?S.tasks.find(x=>x.id===id):null;
  openForm({title:t?'Edit task':'Add maintenance task',values:t||{itemId:itemId||'',intervalMonths:3,nextDue:addDays(today(),30)},submit:t?'Save':'Add task',
    fields:[
      {name:'title',label:'Task',req:1,full:1,ph:'e.g. Replace furnace filter'},
      {name:'itemId',label:'Applies to',type:'select',options:itemOpts()},
      {name:'nextDue',label:'Next due',type:'date',req:1},
      {name:'intervalMonths',label:'Repeats',type:'select',options:INTERVALS},
      {name:'notes',label:'Notes',type:'textarea',full:1}],
    onSubmit:d=>{d.intervalMonths=Number(d.intervalMonths);if(t)Object.assign(t,d);else S.tasks.push({id:uid(),lastDone:'',...d});save();toast('Task saved')},
    onDelete:t?()=>{S.tasks=S.tasks.filter(x=>x.id!==id);save()}:null,delLabel:'Delete task'});
}
function formDone(id){
  const t=S.tasks.find(x=>x.id===id);if(!t)return;
  openForm({title:'Mark done: '+t.title,values:{date:today(),docKind:'Receipt'},submit:'Mark done',fields:[
      {name:'date',label:'Date completed',type:'date',req:1},
      {name:'cost',label:'Cost ($)',type:'number'},
      {name:'contractor',label:'Contractor or company',full:1},
      {name:'notes',label:'Notes',type:'textarea',full:1},
      {name:'files',label:'Attach receipt',type:'file',full:1}],
    onSubmit:async d=>{
      const rec={id:uid(),itemId:t.itemId,type:'Maintenance',title:t.title,date:d.date,cost:d.cost,contractor:d.contractor,notes:d.notes};
      S.records.push(rec);
      await addFiles(d.files,{kind:d.docKind,itemId:t.itemId,recordId:rec.id,date:d.date});
      t.lastDone=d.date;
      if(t.intervalMonths){t.nextDue=addMonths(d.date,t.intervalMonths);if(t.nextDue<=today())t.nextDue=addMonths(today(),t.intervalMonths);toast('Logged. Next due '+fmtDate(t.nextDue))}
      else{S.tasks=S.tasks.filter(x=>x.id!==id);toast('Logged and removed from upcoming')}
      save();
    }});
}
function formDoc(itemId){
  openForm({title:'Upload document',values:{kind:'Receipt',itemId:itemId||'',date:today()},submit:'Upload',fields:[
    {name:'files',label:'File',type:'file',full:1,hint:'Images or PDFs up to 10 MB each.'},
    {name:'kind',label:'Type',type:'select',options:DOC_KINDS},
    {name:'itemId',label:'Applies to',type:'select',options:itemOpts()},
    {name:'date',label:'Document date',type:'date'}],
    onSubmit:async d=>{
      if(!d.files.length)return 'Choose at least one file.';
      const n=await addFiles(d.files,d);
      if(!n)return 'No files were added. Use images or PDFs under 10 MB.';
      save();toast(plural(n,'file')+' uploaded');
    }});
}
async function viewDoc(id){
  const d=S.docs.find(x=>x.id===id);if(!d)return;
  const b=await getFile(id,d.mime);
  const m=$('#modal');
  let inner;
  const pdf=d.mime==='application/pdf';
  if(!b)inner=`<p class="muted">This file is no longer stored on this device.</p>`;
  else if(pdf&&isNative)inner=`<p class="muted">PDFs open in another app on your phone.</p><p style="margin-top:12px"><button class="btn primary" data-act="open-doc" data-id="${id}">Open PDF</button></p>`;
  else{objUrl=URL.createObjectURL(b);inner=pdf?`<div class="preview"><iframe src="${objUrl}" title="${esc(d.name)}"></iframe></div>`:`<div class="preview"><img src="${objUrl}" alt="${esc(d.name)}"></div><p style="margin-top:12px"><button class="btn" data-act="open-doc" data-id="${id}">${isNative?'Share or save':'Open in new tab'}</button></p>`}
  m.innerHTML=`<div class="sheet wide" role="dialog" aria-modal="true" aria-label="${esc(d.name)}"><header><div><h2>${esc(d.name)}</h2><div class="small muted">${esc(d.kind)} · ${fmtDate(d.date)} · ${fmtSize(d.size)}</div></div><button class="icon-btn" data-act="close" aria-label="Close">×</button></header><div class="body">${inner}</div></div>`;
  m.classList.add('open');
}

/* ---------- events ---------- */
document.addEventListener('click',async e=>{
  if(e.target.id==='modal'){closeModal();return}
  const el=e.target.closest('[data-act]');if(!el)return;
  const a=el.dataset.act,id=el.dataset.id,it=el.dataset.item;
  switch(a){
    case 'close':closeModal();break;
    case 'open-item':location.hash='#appliance-'+id;break;
    case 'add-item':formItem();break;
    case 'edit-item':formItem(id);break;
    case 'add-record':formRecord(null,it);break;
    case 'edit-record':formRecord(id);break;
    case 'add-task':formTask(null,it);break;
    case 'edit-task':formTask(id);break;
    case 'done-task':formDone(id);break;
    case 'add-doc':formDoc(it);break;
    case 'view-doc':viewDoc(id);break;
    case 'del-doc':
      if(!el.dataset.sure){el.dataset.sure=1;el.textContent='Confirm';setTimeout(()=>{if(el.isConnected){delete el.dataset.sure;el.textContent='Delete'}},3000);break}
      await blobDel(id);S.docs=S.docs.filter(d=>d.id!==id);save();toast('Document deleted');render();break;
    case 'edit-home':formHome();break;
    case 'start-fresh':
      if(!el.dataset.sure){el.dataset.sure=1;el.textContent='Click again to clear sample data';break}
      S=blank();save();toast('Sample data cleared');location.hash='#overview';render();break;
    case 'export':{
      const out=JSON.stringify({...S,sample:false,exported:today()},null,2);
      try{await saveText('homeledger-backup-'+today()+'.json',out);toast(isNative?'Choose where to save the backup':'Backup downloaded')}
      catch(err){if(!/cancel/i.test(String(err&&err.message)))toast('Could not save the backup.')}
      break}
    case 'open-doc':{
      const d=S.docs.find(x=>x.id===id);const b=d&&await getFile(id,d.mime);
      if(b)try{await openFile(b,d.name)}catch(err){if(!/cancel/i.test(String(err&&err.message)))toast('Could not open the file.')}
      break}
    case 'snap':
      try{const f=await takePhoto();formPhotos.push(f);const n=$('#snapnote');if(n)n.textContent=plural(formPhotos.length,'photo')+' added'}
      catch(err){if(!/cancel|dismiss/i.test(String(err&&err.message)))toast('Could not use the camera. Check camera access in Settings.')}
      break;
    case 'allow-notif':
      permState=await requestNotif();await syncReminders();render();break;
    case 'test-notif':
      try{await testNotification();toast('Test reminder arrives in 5 seconds')}catch(err){toast('Could not schedule the test.')}
      break;
    case 'import':$('#importfile').click();break;
  }
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape')closeModal();
  if((e.key==='Enter'||e.key===' ')&&e.target.matches('.item-card')){e.preventDefault();location.hash='#appliance-'+e.target.dataset.id}
});
document.addEventListener('input',e=>{
  if(e.target.id==='q'){ui.q=e.target.value;const q=ui.q.toLowerCase();
    const list=S.items.filter(i=>(ui.cat==='All'||i.category===ui.cat)&&(!q||[i.name,i.brand,i.model,i.room,i.serial].join(' ').toLowerCase().includes(q))).sort((a,b)=>a.name.localeCompare(b.name));
    $('#applist').innerHTML=appList(list)}
});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='cat'){ui.cat=t.value;render();const q=$('#q');if(q)q.value=ui.q}
  else if(t.id==='rtype'){ui.recType=t.value;render()}
  else if(t.id==='dkind'){ui.docKind=t.value;render()}
  else if(t.id&&t.id.startsWith('s-')){
    const k=t.id.slice(2);const v=t.value;
    S.settings[k]=(v==='true'||v==='false')?v==='true':Number(v);
    if(k==='notify'&&S.settings.notify&&isNative&&permState==='prompt'){requestNotif().then(async p=>{permState=p;await syncReminders();render()})}
    save();render();
  }
  else if(t.id==='importfile'&&t.files[0]){
    const rd=new FileReader();
    rd.onload=async()=>{try{const j=JSON.parse(rd.result);
      if(!j||!Array.isArray(j.items)||!Array.isArray(j.records))throw 0;
      const keep=[];for(const d of (j.docs||[])){if(await getFile(d.id,d.mime))keep.push(d)}
      S={sample:false,home:j.home||null,items:j.items,tasks:j.tasks||[],records:j.records,docs:keep,settings:{...DEFAULTS,...(j.settings||{})}};save();toast('Backup imported');render()}
      catch(x){toast('That file is not a HomeLedger backup.')}};
    rd.readAsText(t.files[0]);t.value='';
  }
});

/* ---------- boot ---------- */
async function boot(){
  $('#mark-d').innerHTML=$('#mark-m').innerHTML=ic('home');
  S=await loadState();
  if(!S||!S.items){S=sample();saveState(S)}
  S.docs=S.docs||[];S.tasks=S.tasks||[];S.records=S.records||[];
  S.settings={...DEFAULTS,...S.settings};
  render();
  onNotificationTap(r=>{if(r)location.hash=r});
  onResume(async()=>{permState=await notifStatus();syncReminders();render()});
  permState=await notifStatus();
  await syncReminders();
  if(isNative)render();
}
boot();
