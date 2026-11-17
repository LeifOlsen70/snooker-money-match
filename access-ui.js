(() => {
'use strict';
const owner='SRx2kZD2jzdM3Q6RVVOjioAuHuw1';
const el=(tag,txt,cls)=>{const x=document.createElement(tag);if(txt!==undefined)x.textContent=txt;if(cls)x.className=cls;return x};
const pending=el('dialog');pending.id='accessGateDialog';pending.setAttribute('aria-label','Zugangskontrolle');
const head=el('h2','Zugangsfreigabe erforderlich');
const body=el('p','Dein Benutzerkonto wurde registriert. Die Freigabe muss einmalig durch den Administrator erfolgen. Danach kannst du die App auf allen Geräten mit demselben Konto nutzen.');
const info=el('p','');info.id='accessGateStatus';
const logout=el('button','Abmelden / Konto wechseln');logout.type='button';
logout.onclick=()=>window.snookerAccessApi?.logout?.();
pending.append(head,body,info,logout);document.body.append(pending);
pending.addEventListener('cancel',e=>e.preventDefault());
const admin=el('dialog');admin.id='accessAdminDialog';admin.setAttribute('aria-label','Benutzerfreigaben');
const adminHead=el('h2','Benutzerverwaltung');const rows=el('div');
const note=el('p','Freigaben gelten dauerhaft für das Firebase-Benutzerkonto.');
const push=el('button','Push auf diesem Gerät aktivieren');push.type='button';
const pushStatus=el('p','');
const refresh=el('button','Aktualisieren'),close=el('button','Schließen');
refresh.type=close.type='button';
refresh.onclick=()=>window.snookerAccessApi?.list?.();close.onclick=()=>admin.close();
push.onclick=async()=>{push.disabled=true;try{pushStatus.textContent=await window.snookerAccessApi.enablePush()}catch(e){pushStatus.textContent='Push nicht aktiviert: '+e.message}finally{push.disabled=false}};
admin.append(adminHead,note,push,pushStatus,rows,refresh,close);document.body.append(admin);
const adminButton=el('button','Benutzerfreigaben');adminButton.className='secondary';adminButton.type='button';adminButton.hidden=true;
const adminCount=el('span','', 'accessPendingCount');adminCount.hidden=true;adminCount.setAttribute('aria-label','Offene Freigabeanfragen');adminButton.append(adminCount);
adminButton.onclick=()=>{admin.showModal();window.snookerAccessApi?.list?.()};
document.getElementById('accountBar')?.append(adminButton);
const updateButton=el('button','↻ Aktualisieren','secondary accessRefreshButton');updateButton.type='button';updateButton.hidden=true;
const refreshNote=el('span','');refreshNote.className='accessRefreshStatus';refreshNote.hidden=true;refreshNote.setAttribute('role','status');
document.getElementById('accountBar')?.append(updateButton,refreshNote);
updateButton.onclick=async()=>{
  updateButton.disabled=true;refreshNote.hidden=false;refreshNote.textContent='Aktualisierung läuft …';
  try{
    const result=await window.snookerTableBackend?.refresh?.();
    if(!result)throw Error('Die Verbindung ist noch nicht bereit.');
    await window.snookerAccessApi.list();
    refreshNote.textContent='Aktualisiert: Tischstände und Freigaben.';
  }catch(err){refreshNote.textContent='Aktualisierung nicht vollständig: '+(err.message||err)}
  finally{updateButton.disabled=false}
};
function showPending(status,email){
  head.textContent=status==='rejected'?'Zugangsanfrage abgelehnt':'Zugangsfreigabe erforderlich';
  info.textContent=(email||'')+' – '+(status==='rejected'?'Bitte den Administrator kontaktieren.':'Deine Anfrage wartet auf Freigabe.');
  if(!pending.open)pending.showModal();
}
function hidePending(){if(pending.open)pending.close()}
function showAdmin(){adminButton.hidden=false;updateButton.hidden=false}
function updateCount(count){adminCount.textContent=String(count);adminCount.hidden=count===0;adminButton.setAttribute('aria-label',`Benutzerfreigaben, ${count} offene Anfragen`)}
function requestDate(value){
  try{
    const date=typeof value?.toDate==='function'?value.toDate():value&&typeof value==='object'&&typeof (value.seconds??value._seconds)==='number'?new Date((value.seconds??value._seconds)*1000):typeof value==='number'?new Date(value):null;
    return date&&Number.isFinite(date.getTime())?new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date)+' Uhr':'Zeitpunkt nicht gespeichert';
  }catch{return 'Zeitpunkt nicht gespeichert';}
}
function render(list,change,remove){updateCount(list.filter(a=>a.status==='pending').length);rows.replaceChildren(); if(!list.length){rows.append(el('p','Noch keine Anfragen.'));return}
  for(const a of list){const row=el('div',undefined,'accessRow');const name=el('div');name.append(el('strong',a.email||a.uid),el('p',a.status==='approved'?'Freigegeben':a.status==='rejected'?'Abgelehnt':'Wartet auf Freigabe'));
    name.append(el('p','Anfrage: '+requestDate(a.createdAt),'accessRequestDate'));
    const actions=el('div',undefined,'accessActions');
    if(a.status!=='approved'){const ok=el('button','Freigeben');ok.onclick=()=>change(a.uid,'approved');actions.append(ok)}
    if(a.status!=='rejected'){const no=el('button','Sperren');no.onclick=()=>change(a.uid,'rejected');actions.append(no)}
    if(a.status==='rejected'&&remove){const del=el('button','Löschen','accessDeleteButton');del.type='button';del.onclick=async()=>{
      if(!confirm(`Gesperrten Eintrag ${a.email||a.uid} aus der Benutzerverwaltung löschen? Das Anmeldekonto bleibt bestehen. Bei einer späteren Anmeldung kann eine neue Freigabe angefragt werden.`))return;
      del.disabled=true;try{await remove(a.uid)}catch(err){alert('Eintrag nicht gelöscht: '+err.message)}finally{del.disabled=false}
    };actions.append(del)}
    row.append(name,actions);rows.append(row)}
}
window.snookerAccessUI={showPending,hidePending,showAdmin,render,updateCount};
})();
