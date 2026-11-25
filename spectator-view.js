import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {getAuth,setPersistence,browserLocalPersistence,signInAnonymously,signOut} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import {getFirestore,doc,getDoc,onSnapshot,runTransaction} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js?v=9.13';
import {createTableConnection} from './table-connection.js?v=9.13';
const model=window.SnookerSpectator,pool=new URLSearchParams(location.search).get('sport')==='pool',sport=pool?'pool':'snooker',token=location.hash.slice(1),e=id=>document.getElementById(id);
const app=initializeApp(firebaseConfig,pool?'pool-code-device-v1':'table-code-device-v2'),auth=getAuth(app),db=getFirestore(app);
let data=null,meta=null,view='matches',boards=new Map(),stops=[],rootStop=null,connected=false;
const returnKey='snooker-viewer-return:'+sport;
const appUrl=(creator=false)=>{const u=new URL('app.html?sport='+sport,location.href);if(creator&&meta?.owner&&meta?.tournamentKey){u.searchParams.set('resumeOwner',meta.owner);u.searchParams.set('resumeTournament',meta.tournamentKey);}return u.href;};
e('viewerLogo').src=pool?'pool-logo.png':'flensburger-snooker-club.png';e('viewerLogo').alt=pool?'Poolbillard':'Snooker';
e('viewerApp').href=appUrl();e('viewerBack').href=appUrl();
function status(text){e('viewerStatus').textContent=text;}
function render(){e('viewerContent').innerHTML=window.SnookerSpectatorRender.render(data,[...boards.values()],view);}
function clear(text){for(const stop of stops)stop();stops=[];boards.clear();data=null;render();status(text);e('viewerTitle').textContent='Turnieransicht nicht verfügbar';}
function tableNavigation(){sessionStorage.setItem(returnKey,token);if(window.parent!==window)window.parent.location.href=appUrl();else location.href=appUrl();}
if(window.parent!==window){e('viewerBack').style.display='none';for(const id of ['viewerApp','viewerBack'])e(id).onclick=event=>{event.preventDefault();window.parent.postMessage('snooker-viewer-close',location.origin);};}
const connection=createTableConnection({auth,db,doc,getDoc,runTransaction,signInAnonymously,signOut,pool,storage:localStorage,onJoined:tableNavigation});
function tableButton(){const setup=connection.setup();e('viewerTable').hidden=!setup;e('viewerJoin').hidden=Boolean(setup);}
e('viewerTable').onclick=tableNavigation;
for(const button of document.querySelectorAll('[data-view]'))button.onclick=()=>{view=button.dataset.view;for(const tab of document.querySelectorAll('[data-view]')){const selected=tab===button;tab.classList.toggle('primary',selected);tab.setAttribute('aria-pressed',String(selected));}render();};
const dialog=e('viewerJoinDialog'),form=dialog.querySelector('form'),input=dialog.querySelector('input'),note=dialog.querySelector('[role=alert]');
e('viewerJoin').onclick=()=>{note.textContent='';dialog.showModal();};dialog.querySelector('[data-close]').onclick=()=>dialog.close();
form.onsubmit=async event=>{
  event.preventDefault();const controls=dialog.querySelectorAll('button,input');controls.forEach(b=>b.disabled=true);note.textContent='Tisch wird verbunden …';
  try{
    if(!connected)throw Error('Bitte die Verbindung abwarten.');
    const invite=(await getDoc(doc(db,'snookerTableInvites',input.value.trim()))).data();
    if(meta?.enabled&&(!invite||invite.owner!==meta.owner||invite.tournamentKey!==meta.tournamentKey||(invite.sport==='pool')!==pool))throw Error('Dieser Tischcode gehört nicht zu diesem Turnier.');
    await connection.join(input.value);
  }catch(err){note.textContent=err.message||'Verbindung fehlgeschlagen.';}finally{controls.forEach(b=>b.disabled=false);}
};
function subscribe(){
  rootStop=onSnapshot(doc(db,'snookerSpectatorLinks',token),{includeMetadataChanges:true},snap=>{
    if(snap.metadata.fromCache){if(!navigator.onLine)clear('Offline – aktuelle Leseberechtigung kann nicht geprüft werden.');return;}
    meta=snap.data();
    for(const id of ['viewerApp','viewerBack'])e(id).href=appUrl(true);
    if(!meta?.enabled||meta.sport!==sport){clear('Dieser Zuschauerlink ist deaktiviert oder nicht mehr gültig.');return;}
    if(stops.length)return;
    stops.push(onSnapshot(doc(db,'snookerSpectatorLinks',token,'view','current'),{includeMetadataChanges:true},s=>{
      if(s.metadata.fromCache||s.metadata.hasPendingWrites)return;
      const raw=s.data();if(!raw){status('Die Turnierleitung bereitet die Ansicht vor …');return;}
      try{
        const next=JSON.parse(raw.payload);if(next.schema!==1||next.key!==meta.tournamentKey||next.sport!==sport)throw Error();
        data=next;e('viewerTitle').textContent=data.title+' · '+(pool?'Poolbillard':'Snooker');
        status(data.ended?'Turnier beendet · nur ansehen':'Live verbunden · nur ansehen');render();
      }catch{clear('Turnierdaten konnten nicht gelesen werden.');}
    },()=>clear('Zuschauerzugang nicht verfügbar. Bitte die Turnierleitung kontaktieren.')));
    for(let slot=1;slot<=6;slot++)stops.push(onSnapshot(doc(db,'snookerSpectatorLinks',token,'tables',String(slot)),{includeMetadataChanges:true},s=>{
      if(s.metadata.fromCache||s.metadata.hasPendingWrites)return;
      const board=s.data();if(board)boards.set(slot,board);else boards.delete(slot);render();
    },()=>{boards.delete(slot);render();}));
  },()=>clear('Zuschauerlink nicht verfügbar. Bitte Verbindung oder Freigabe prüfen.'));
}
function refreshViewer(){
  if(!connected){status('Verbindung wird neu aufgebaut …');location.reload();return;}
  for(const stop of stops)stop();stops=[];rootStop?.();rootStop=null;
  boards.clear();data=null;render();status('Turnier wird aktualisiert …');subscribe();tableButton();
}
e('viewerRefresh').onclick=refreshViewer;
window.addEventListener('offline',()=>clear('Offline – bitte erneut verbinden, um das Turnier live zu verfolgen.'));
window.addEventListener('online',refreshViewer);
window.addEventListener('pageshow',event=>{if(event.persisted&&connected){for(const stop of stops)stop();stops=[];rootStop?.();subscribe();tableButton();}});
window.addEventListener('pagehide',()=>{for(const stop of stops)stop();rootStop?.();});
tableButton();
try{
  if(!model.validToken(token))throw Error('Der Zuschauerlink ist unvollständig oder ungültig.');
  await setPersistence(auth,browserLocalPersistence);await auth.authStateReady();
  if(!auth.currentUser)await signInAnonymously(auth);
  connected=true;subscribe();
}catch(err){clear(err.code==='auth/operation-not-allowed'?'Bitte die anonyme Anmeldung in Firebase aktivieren lassen.':err.message||'Verbindung fehlgeschlagen.');}
