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
adminButton.onclick=()=>{admin.showModal();window.snookerAccessApi?.list?.()};
document.getElementById('accountBar')?.append(adminButton);
function showPending(status,email){
  head.textContent=status==='rejected'?'Zugangsanfrage abgelehnt':'Zugangsfreigabe erforderlich';
  info.textContent=(email||'')+' – '+(status==='rejected'?'Bitte den Administrator kontaktieren.':'Deine Anfrage wartet auf Freigabe.');
  if(!pending.open)pending.showModal();
}
function hidePending(){if(pending.open)pending.close()}
function showAdmin(){adminButton.hidden=false}
function render(list,change){rows.replaceChildren(); if(!list.length){rows.append(el('p','Noch keine Anfragen.'));return}
  for(const a of list){const row=el('div',undefined,'accessRow');const name=el('div');name.append(el('strong',a.email||a.uid),el('p',a.status==='approved'?'Freigegeben':a.status==='rejected'?'Abgelehnt':'Wartet auf Freigabe'));
    const actions=el('div',undefined,'accessActions');
    if(a.status!=='approved'){const ok=el('button','Freigeben');ok.onclick=()=>change(a.uid,'approved');actions.append(ok)}
    if(a.status!=='rejected'){const no=el('button','Sperren');no.onclick=()=>change(a.uid,'rejected');actions.append(no)}
    row.append(name,actions);rows.append(row)}
}
window.snookerAccessUI={showPending,hidePending,showAdmin,render};
})();
