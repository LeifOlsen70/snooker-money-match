import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {getAuth,signInAnonymously,signInWithEmailAndPassword,createUserWithEmailAndPassword,sendPasswordResetEmail,setPersistence,browserLocalPersistence,inMemoryPersistence,signOut,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import {getFirestore,doc,getDoc,setDoc,onSnapshot,runTransaction,collection,getDocs,getDocsFromServer,getDocFromServer,updateDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import {createTableSync} from './table-sync.js?v=7.78';
const config={apiKey:'AIzaSyBgmv1v5APpPReJ4olWCusUhhGGevcvRcE',authDomain:'snooker-money-match.firebaseapp.com',projectId:'snooker-money-match',storageBucket:'snooker-money-match.firebasestorage.app',messagingSenderId:'423302158497',appId:'1:423302158497:web:706c1fec068959b7bbb8e0'};
const localStorage = window.snookerStorage;
const app=initializeApp(config),auth=getAuth(app),db=getFirestore(app),e=id=>document.getElementById(id),msg=t=>e('fbStatus').textContent=t;
let accessGranted=false;
const ADMIN_UID='SRx2kZD2jzdM3Q6RVVOjioAuHuw1';
const permitted=()=>Boolean(accessGranted && !window.localStorage.getItem('snooker-table-code-device-v2') && auth.currentUser && !auth.currentUser.isAnonymous && localStorage.uid && auth.currentUser.uid===localStorage.uid);
// v7.66: The login handlers must be ready even if browser persistence stalls
// (for example in older Safari/WebView contexts). Previously an unresolved
// setPersistence() left the login dialog permanently at "Anmeldung wird geladen".
window.snookerAccount.bind({
  login:(name,password)=>signInWithEmailAndPassword(auth,window.snookerTableAccess.resolveName(name),password),
  register:(email,password)=>createUserWithEmailAndPassword(auth,email,password),
  reset:email=>sendPasswordResetEmail(auth,email),
  logout:()=>signOut(auth)
});
window.dispatchEvent(new Event('snooker-auth-handlers-ready'));
async function initializePersistence(instance,label){
  // Never block startup indefinitely while persistence storage initializes.
  let timer;
  try{
    await Promise.race([
      setPersistence(instance,browserLocalPersistence),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Zeitüberschreitung beim lokalen Auth-Speicher')),6000)})
    ]);
  }catch(err){
    console.warn('Snooker '+label+': persistente Anmeldung nicht verfügbar',err);
    // Firebase Auth defaults to its supported persistence fallback. Do not
    // clear or overwrite any existing tournament or authentication data.
    msg('⚠️ Lokale Anmeldespeicherung eingeschränkt. Anmeldung kann erneut erforderlich sein.');
  }finally{clearTimeout(timer)}
}
await initializePersistence(auth,'Spielleiter');
const tableSync=createTableSync({auth,db,doc,getDoc,getDocFromServer,onSnapshot,runTransaction});
const deviceKey='snooker-table-code-device-v2';
function deviceSetup(){try{return JSON.parse(window.localStorage.getItem(deviceKey))}catch{return null}}
const deviceApp=initializeApp(config,'table-code-device-v2'),deviceAuth=getAuth(deviceApp),deviceDb=getFirestore(deviceApp);
await initializePersistence(deviceAuth,'Tischgerät');
const deviceSync=createTableSync({auth:deviceAuth,db:deviceDb,doc,getDoc,getDocFromServer,onSnapshot,runTransaction});
window.snookerTableSync=tableSync;
window.snookerTableBackend={
  async join(code){
    const token=code.trim().replace(/\s/g,'');
    if(!/^\d{4}$/.test(token))throw Error('Bitte genau vier Ziffern eingeben, zum Beispiel 0427.');
    if(!deviceAuth.currentUser)await signInAnonymously(deviceAuth);
    const inviteRef=doc(deviceDb,'snookerTableInvites',token);
    const invite=(await getDoc(inviteRef)).data();
    if(!invite)throw Error('Tischcode nicht gefunden.');
    const uid=deviceAuth.currentUser.uid;
    const memberRef=doc(deviceDb,'snookerTableBoards',invite.owner,'tables',String(invite.slot),'members',uid);
    try{
      // A single Firestore transaction atomically reserves the invitation for
      // this anonymous device identity. Concurrent attempts cannot both win.
      await runTransaction(deviceDb,async tx=>{
        const invitation=await tx.get(inviteRef);
        const current=invitation.data();
        if(!current||current.owner!==invite.owner||current.slot!==invite.slot||current.generation!==invite.generation)
          throw Error('Dieser Tischcode ist abgelaufen oder das Turnier beendet.');
        if(current.claimedBy&&current.claimedBy!==uid)
          throw Error('Dieser Tischcode ist bereits mit einem anderen Gerät verbunden. Bitte die Turnierleitung kontaktieren.');
        if(!current.claimedBy)tx.update(inviteRef,{claimedBy:uid});
        tx.set(memberRef,{token,generation:current.generation});
      });
    }catch(err){
      if(err.code==='permission-denied')throw Error('Tischzugriff abgelehnt. Bitte die neuen Firebase-Regeln für Version 7.78 veröffentlichen.');
      throw err;
    }
    window.localStorage.setItem(deviceKey,JSON.stringify({owner:invite.owner,slot:invite.slot,token,generation:invite.generation}));
    window.location.reload();
  },
  async leave(){
    const setup=deviceSetup(),uid=deviceAuth.currentUser?.uid;
    if(setup&&uid){
      await runTransaction(deviceDb,async tx=>{
        const inviteRef=doc(deviceDb,'snookerTableInvites',setup.token),memberRef=doc(deviceDb,'snookerTableBoards',setup.owner,'tables',String(setup.slot),'members',uid);
        const invite=(await tx.get(inviteRef)).data();
        if(invite?.owner===setup.owner&&invite.slot===setup.slot&&invite.claimedBy===uid&&(!setup.generation||invite.generation===setup.generation)){const {claimedBy,...released}=invite;tx.set(inviteRef,released)}
        tx.delete(memberRef);
      });
    }
    window.localStorage.removeItem(deviceKey);await signOut(deviceAuth);window.location.reload();
  },
  async reset(slot){if(!permitted())throw Error('Als Spielleiter anmelden.');return await tableSync.reset(slot)},
  async availableCodes(){
    if(!permitted()||window.snookerAccount.guest)throw Error('Zur sicheren Anzeige der Tischcodes als Spielleiter anmelden. Sonst den erhaltenen Code eingeben.');
    // Load the organizer's active tournament from the cloud even when the user
    // has not opened the Club Liga panel on this device.
    const snap=await getDoc(doc(db,'privateSnooker',auth.currentUser.uid));
    const raw=snap.data()?.tournamentSync??snap.data()?.tournamentState;
    let data;
    try{data=raw?JSON.parse(raw):null}catch{data=null}
    if(!data||data.ended||!data.started||!Number.isInteger(data.tables)||data.tables<1)
      return [];
    const key=(data.freeTournament?'free:':'club:')+String(data.started);
    const docs=await Promise.all(Array.from({length:Math.min(data.tables,6)},(_,i)=>getDoc(doc(db,'snookerTableBoards',auth.currentUser.uid,'tables',String(i+1)))));
    return docs.map(s=>s.data()).filter(b=>b?.joinOpen&&b.tournamentKey===key&&/^\d{4}$/.test(b.joinToken??'')).map(b=>({slot:b.tableNumber,code:b.joinToken}));
  },
  async codes(){
    if(!permitted()||auth.currentUser.isAnonymous||window.snookerAccount.guest)throw Error('Bitte als Spielleiter mit E-Mail und Passwort anmelden.');
    const data=window.snookerTournamentBridge.current;if(!data)throw Error('Zuerst ein Turnier erstellen oder laden.');
    return await tableSync.codes(data);
  }
};
let tableRevoking=false;
window.addEventListener('snooker-table-revoked',async()=>{
  if(tableRevoking||!deviceSetup())return;
  tableRevoking=true;window.localStorage.removeItem(deviceKey);deviceSync.stop();
  window.snookerMonitors.deactivate();
  try{await signOut(deviceAuth)}finally{window.location.reload()}
});
onAuthStateChanged(deviceAuth,async account=>{
  const setup=deviceSetup();if(!setup)return;
  window.snookerTableSync=deviceSync;
  window.snookerMonitors.activateTable(setup.slot);
  if(!account){window.dispatchEvent(new CustomEvent('snooker-table-error',{detail:'Tischanmeldung fehlt. Bitte mit dem aktuellen Tischcode erneut beitreten.'}));return}
  await deviceSync.start(account,setup.slot,setup.owner);
});
window.snookerTableBackend.refresh=async()=>{
  const setup=deviceSetup();
  if(setup){await deviceSync.refresh(setup.slot);return 'Tischstand frisch abgerufen.';}
  if(!permitted())throw Error('Bitte anmelden und die Freigabe abwarten.');
  await tableSync.refresh();
  return 'Tischstände frisch abgerufen.';
};
window.snookerRefresh=async()=>{
  if(deviceSetup())return await window.snookerTableBackend.refresh();
  if(window.snookerAccount.guest)return 'Lokaler Stand aktuell – ohne Cloud-Anmeldung.';
  if(!permitted())throw Error('Bitte anmelden und die Freigabe abwarten.');
  const snap=await getDocFromServer(cloudDoc()),data=snap.data();
  if(!pendingTournament&&!tournamentWriting)applyTournamentSnapshot(data?.tournamentSync??data?.tournamentState??null,data?.tournamentRevision??0);
  receiveTable(data?.tournamentTable);receiveRoster(data?.tournamentRoster);
  const raw=data?.state??null;
  if(!pending&&!writing&&(raw===''||valid(raw))){lastCloudRaw=raw;if(localRaw()!==raw)window.dispatchEvent(new CustomEvent('snooker-single-received',{detail:raw}))}
  if(tableSync.role==='owner')await tableSync.refresh();
  if(auth.currentUser?.uid===ADMIN_UID)await window.snookerAccessApi.list();
  return 'Spielstände aktualisiert.';
};
window.dispatchEvent(new Event('snooker-table-backend-ready'));
let unsubscribe=null, initialized=false, writeTimer=null, writing=false, pending=false;
let lastCloudRaw=null;
const cloudDoc=()=>doc(db,'privateSnooker',localStorage.uid);
const singlePendingKey='snookerSinglePendingSyncV1';
const localRaw=()=>localStorage.getItem('snookerMoneyMatchState');
function valid(raw){try{const x=JSON.parse(raw);return Array.isArray(x.players)&&Number.isFinite(Number(x.target))}catch{return false}}
function syncNow(){
  if(!permitted())return;
  pending=true;
  localStorage.setItem(singlePendingKey,'1');
  clearTimeout(writeTimer);
  writeTimer=setTimeout(flush,450);
}
async function flush(){
  if(writing||!pending||!permitted()||!initialized)return;
  pending=false;writing=true;
  const raw=localRaw();
  try{
    await setDoc(cloudDoc(),{state:raw||'',updatedAt:new Date().toISOString()},{merge:true});
    lastCloudRaw=raw||'';
    if(localRaw()===raw)localStorage.removeItem(singlePendingKey);
    msg('✅ Live synchronisiert');
  }catch(err){pending=true;msg('⚠️ Synchronisierung ausstehend: '+(err.code||err.message));}
  finally{writing=false;if(pending&&navigator.onLine){clearTimeout(writeTimer);writeTimer=setTimeout(flush,1500)}}
}
let tournamentWriting=false, tournamentReady=false, tournamentRevision=-1, latestTournament=null;
let pendingTournament=null, pendingTable=null, writingTable=false, lastTable=null;
const tournamentKey='snookerSwissTournamentV1';
const tournamentPendingKey='snookerSwissPendingSyncV1';
let sendingTournament=null;
function persistTournamentQueue(){
  const queued=pendingTournament?.replace ? pendingTournament
    : sendingTournament ? {...sendingTournament,after:pendingTournament?.after??sendingTournament.after} : pendingTournament;
  if(queued)localStorage.setItem(tournamentPendingKey,JSON.stringify(queued));
  else localStorage.removeItem(tournamentPendingKey);
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function tournamentConnection(message){
  window.dispatchEvent(new CustomEvent('snooker-tournament-connection',{detail:{available:permitted(),message}}));
}
function applyTournamentSnapshot(raw, revision){
  if(revision<tournamentRevision)return;
  tournamentRevision=revision;
  latestTournament=raw;
  if(!tournamentWriting&&!pendingTournament&&raw!==null){
    window.dispatchEvent(new CustomEvent('snooker-tournament-received',{detail:raw}));
  }
}
function mergeTournament(before, after, remote){
  if(same(before,remote)||same(after,remote))return after;
  if(same(before,after))return remote;
  if(!before||!after||!remote)throw Error('tournament-conflict');
  // Merge only match edits on the same schedule. A concurrent round or
  // tournament replacement requires a fresh attempt against the new state.
  const schedule=({rounds,filename,...settings})=>[settings,rounds.map(round=>[round.bye,round.matches.map(match=>match.players)])];
  if(!same(schedule(before),schedule(after))||!same(schedule(before),schedule(remote)))throw Error('tournament-conflict');
  const merged={...remote,rounds:remote.rounds.map((round,r)=>({...round,matches:round.matches.map((match,m)=>{
    const previous=before.rounds[r].matches[m], next=after.rounds[r].matches[m];
    if(same(previous,next))return match;
    if(!same(previous,match)&&!same(next,match))throw Error('tournament-conflict');
    return next;
  })}))};
  const tables=new Set(), players=new Set();
  for(const round of merged.rounds)for(const match of round.matches){
    if(!match.table||match.result)continue;
    if(tables.has(match.table)||match.players.some(id=>players.has(id)))throw Error('tournament-conflict');
    tables.add(match.table);
    match.players.forEach(id=>players.add(id));
  }
  return merged;
}
async function flushTournament(){
  if(tournamentWriting||!pendingTournament||!permitted()||!tournamentReady)return;
  const batch=pendingTournament;
  pendingTournament=null;
  tournamentWriting=true;
  sendingTournament=batch;
  persistTournamentQueue();
  let rejected=false;
  try{
    const {raw,revision}=await runTransaction(db,async transaction=>{
      const snap=await transaction.get(cloudDoc());
      const state=snap.data();
      const previousRevision=state?.tournamentRevision??0;
      const remote=state?.tournamentSync??null;
      const raw=batch.replace ? batch.after : batch.seed
        ? remote??batch.after
        : JSON.stringify(mergeTournament(JSON.parse(batch.before),JSON.parse(batch.after),JSON.parse(remote??'null')));
      if(raw===remote)return {raw,revision:previousRevision};
      transaction.set(cloudDoc(),{tournamentSync:raw,tournamentRevision:previousRevision+1},{merge:true});
      return {raw,revision:previousRevision+1};
    });
    applyTournamentSnapshot(raw,revision);
    tournamentConnection('Turnier live synchronisiert.');
  }catch(err){
    if(err.message==='tournament-conflict'){
      if(!pendingTournament?.replace){
        pendingTournament=null;
        rejected=true;
        tournamentConnection('Gleichzeitige Änderung. Bitte letzten Stand prüfen und die Eingabe bei Bedarf wiederholen.');
      }
    }else{
      pendingTournament=pendingTournament?.replace ? pendingTournament
        : {...batch,after:pendingTournament?.after??batch.after};
      tournamentConnection('Turnier lokal gespeichert. Live-Sync ausstehend: '+(err.code||err.message));
      return;
    }
  }finally{tournamentWriting=false;sendingTournament=null;persistTournamentQueue();}
  if(pendingTournament)flushTournament();
  else{
    if(rejected){
      try{
        const snap=await getDoc(cloudDoc());
        if(!pendingTournament&&!tournamentWriting)applyTournamentSnapshot(snap.data()?.tournamentSync??latestTournament,snap.data()?.tournamentRevision??tournamentRevision);
      }catch{applyTournamentSnapshot(latestTournament,tournamentRevision);}
    }else applyTournamentSnapshot(latestTournament,tournamentRevision);
  }
}
window.addEventListener('snooker-tournament-publish',({detail})=>{
  if(!permitted())return;
  pendingTournament=detail.replace ? detail : pendingTournament ? {...pendingTournament,after:detail.after} : detail;
  persistTournamentQueue();
  flushTournament();
});
function receiveTable(table){
  if((table==='standings'||table==='overall')&&table!==lastTable&&!pendingTable&&!writingTable){
    lastTable=table;
    window.dispatchEvent(new CustomEvent('snooker-tournament-view-received',{detail:table}));
  }
}
async function flushTable(){
  if(!pendingTable||writingTable||!permitted()||!tournamentReady)return;
  const table=pendingTable;
  pendingTable=null;
  writingTable=true;
  let sent=false;
  try{
    await setDoc(cloudDoc(),{tournamentTable:table},{merge:true});
    lastTable=table;
    sent=true;
  }catch(err){
    pendingTable??=table;
    tournamentConnection('Tabellenwechsel konnte nicht synchronisiert werden: '+(err.code||err.message));
  }finally{writingTable=false;}
  if(sent&&pendingTable)flushTable();
}
window.addEventListener('snooker-tournament-view',({detail})=>{
  if(!permitted())return;
  pendingTable=detail;
  flushTable();
});
const rosterStorage='snookerSwissPlayerNamesV1';
const rosterQueueKey='snookerSwissRosterPendingV1';
let rosterQueue=[], rosterCloud=null, rosterWriting=false;
function localRoster(){
  try{return JSON.parse(localStorage.getItem(rosterStorage))??[];}catch{return [];}
}
function saveRosterQueue(){
  localStorage.setItem(rosterQueueKey,JSON.stringify(rosterQueue));
}
function receiveRoster(entry){
  if(entry && Array.isArray(entry.names) && entry.names.every(name=>typeof name==='string') &&
      (!rosterCloud || entry.revision>=rosterCloud.revision))rosterCloud=entry;
  if(rosterCloud&&!rosterWriting&&!rosterQueue.length){
    window.dispatchEvent(new CustomEvent('snooker-roster-received',{detail:rosterCloud.names}));
  }
}
async function flushRoster(){
  if(!permitted()||!tournamentReady||rosterWriting||(rosterCloud&&!rosterQueue.length))return;
  const count=rosterQueue.length, changes=rosterQueue.slice(0,count), local=localRoster();
  if(!count&&!local.length)return;
  rosterWriting=true;
  try{
    const entry=await runTransaction(db,async transaction=>{
      const existing=(await transaction.get(cloudDoc())).data()?.tournamentRoster;
      if(existing&&!count)return existing;
      const key=name=>name.toLocaleLowerCase('de');
      const names=new Map((existing?.names??local).map(name=>[key(name),name]));
      for(const {before,after} of changes){
        const next=new Map(after.map(name=>[key(name),name]));
        for(const name of before)if(!next.has(key(name)))names.delete(key(name));
        const previous=new Set(before);
        for(const name of after)if(!previous.has(name))names.set(key(name),name);
      }
      const entry={names:[...names.values()],revision:(existing?.revision??0)+1};
      transaction.set(cloudDoc(),{tournamentRoster:entry},{merge:true});
      return entry;
    });
    rosterQueue.splice(0,count);
    saveRosterQueue();
    rosterWriting=false;
    receiveRoster(entry);
    if(rosterQueue.length)flushRoster();
  }catch(err){
    rosterWriting=false;
    tournamentConnection('Spielerliste lokal gespeichert. Synchronisierung ausstehend: '+(err.code||err.message));
  }
}
window.addEventListener('snooker-roster-change',({detail})=>{
  if(!permitted())return;
  rosterQueue.push(detail);
  saveRosterQueue();
  flushRoster();
});
window.addEventListener('snooker-state-changed',syncNow);
window.addEventListener('online',()=>{if(pending)flush();flushTournament();flushTable();flushRoster()});
function connectApproved(u){
  tableSync.stop();
  if(deviceSetup())return;
  window.snookerMonitors.deactivate();
  if(window.snookerAccount.guest){
    msg('Ohne Anmeldung – nur lokal auf diesem Gerät gespeichert.');
    tournamentConnection('Ohne Anmeldung – Turnier nur auf diesem Gerät gespeichert.');
    return;
  }
  window.snookerAccount.block();
  if(window.snookerAccount.switchUser(u))return;
  if(unsubscribe){unsubscribe();unsubscribe=null}
  initialized=false;pending=localStorage.getItem(singlePendingKey)==='1';clearTimeout(writeTimer);
  tournamentReady=false;pendingTournament=null;tournamentRevision=-1;latestTournament=null;
  pendingTable=null;lastTable=null;rosterCloud=null;rosterQueue=[];
  tournamentConnection(permitted()?'Turnier-Synchronisierung wird verbunden …':'Bitte mit deinem Konto anmelden.');
  if(!u){msg('Nicht angemeldet');return}
  if(!permitted())return;
  try{pendingTournament=JSON.parse(localStorage.getItem(tournamentPendingKey));}catch{pendingTournament=null;}
  try{rosterQueue=JSON.parse(localStorage.getItem(rosterQueueKey))??[];}catch{rosterQueue=[];}
  msg('⏳ Verbinde Live-Synchronisierung …');
  let first=true;
  unsubscribe=onSnapshot(cloudDoc(),{includeMetadataChanges:true},snap=>{
    if(!permitted())return;
    const data=snap.data();
    if(!snap.metadata.fromCache&&!snap.metadata.hasPendingWrites){
      if(!tournamentReady){
        tournamentReady=true;
        if(!data?.tournamentSync){
          const local=localStorage.getItem(tournamentKey);
          const initial=local&&local!=='null'?local:data?.tournamentState;
          if(pendingTournament||initial){
            pendingTournament={seed:true,after:pendingTournament?.after??initial};
          }
        }
        tournamentConnection('Turnier-Synchronisierung aktiv.');
        flushTournament();
        flushTable();
      }
      applyTournamentSnapshot(data?.tournamentSync??data?.tournamentState??null,data?.tournamentRevision??0);
      receiveTable(data?.tournamentTable);
      receiveRoster(data?.tournamentRoster);
      flushRoster();
    }
    if(snap.metadata.hasPendingWrites || snap.metadata.fromCache)return;
    const raw=data?.state??null;
    const firstSnapshot=first;
    if(first){
      first=false;initialized=true;
      if(raw==null && localRaw())syncNow();
      if(pending)flush();
      msg('✅ Live-Synchronisierung aktiv');
    }
    if(raw!==lastCloudRaw&&!writing&&!pending){
      lastCloudRaw=raw;
      if((raw===''||valid(raw)) && localRaw()!==raw){
        window.dispatchEvent(new CustomEvent('snooker-single-received',{detail:raw}));
      }
    }
    if(firstSnapshot){window.snookerAccount.ready(u);tableSync.start(u);}
  },err=>{
    if(!permitted())return;
    const reason=err.code||err.message;
    const text=err.code==='permission-denied'
      ? 'Live-Sync gesperrt. Die Firebase-Zugriffsregeln müssen für Benutzerkonten eingerichtet werden.'
      : 'Live-Verbindung fehlgeschlagen: '+reason;
    msg(text);
    tournamentConnection(text);
    window.snookerAccount.ready(u);
    window.snookerAccount.connectionError(text);
  });
  if(!navigator.onLine)window.snookerAccount.ready(u);
}

let accessUnsubscribe=null, accessSession=0, approvedConnection=null;
const accessDoc=uid=>doc(db,'snookerAccess',uid);
const publicPushKey='BLv00R-ryVyvAkX-GYNF-Ar4Z-D0kAnIMw9W568EoNkIxGfvapGfbzOZZsCIJ1OBtc4jjNc1-HzQQh8S_Y4ozr4';
window.snookerAccessApi={
  logout:()=>signOut(auth),
  async list(){
    if(auth.currentUser?.uid!==ADMIN_UID)throw Error('Nur für Administrator.');
    const snap=await getDocsFromServer(collection(db,'snookerAccess'));
    const users = snap.docs.map(x=>({uid:x.id,...x.data()})).filter(x=>x.uid!==ADMIN_UID).sort((a,b)=>Number(b.status==='pending')-Number(a.status==='pending'));
    window.snookerAccessUI.render(users, async(uid,status)=>{
      try{await updateDoc(accessDoc(uid),{status,reviewedAt:serverTimestamp()});await window.snookerAccessApi.list()}catch(e){alert('Änderung nicht gespeichert: '+e.message)}
    },uid=>window.snookerAccessApi.remove(uid));
  },
  async remove(uid){
    if(auth.currentUser?.uid!==ADMIN_UID||uid===ADMIN_UID)throw Error('Nur für Administrator.');
    await runTransaction(db,async tx=>{const ref=accessDoc(uid),snap=await tx.get(ref);if(!snap.exists())return;if(snap.data().status!=='rejected')throw Error('Nur gesperrte Einträge können gelöscht werden. Bitte aktualisieren.');tx.delete(ref)});
    await window.snookerAccessApi.list();
  },
  async enablePush(){
    if(auth.currentUser?.uid!==ADMIN_UID)throw Error('Nur für Administrator.');
    if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))
      throw Error('Dieses Gerät unterstützt Web-Push nicht. Auf dem iPhone die App über das Home-Bildschirm-Symbol öffnen.');
    if(Notification.permission==='denied')throw Error('Mitteilungen sind in den Geräteeinstellungen blockiert.');
    const permission=await Notification.requestPermission();
    if(permission!=='granted')throw Error('Mitteilungen wurden nicht erlaubt.');
    const reg=await navigator.serviceWorker.ready;
    const encoded=publicPushKey.replace(/-/g,'+').replace(/_/g,'/');
    const padded=encoded.padEnd(Math.ceil(encoded.length/4)*4,'=');
    const key=Uint8Array.from(atob(padded),c=>c.charCodeAt(0));
    const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(sub.endpoint));
    const id=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
    // No secrets stored in the client. Firestore rules restrict these records to ADMIN_UID.
    const record={subscription:sub.toJSON(),updatedAt:serverTimestamp(),kind:'webpush'};
    // Prefer a Firebase Cloud Messaging target when its Web SDK supports this browser.
    // iOS Home Screen PWAs may support native Web Push even if Firebase Messaging's
    // feature-detection declines this browser; preserve the native subscription then.
    let fcmNote='';
    try{
      const messagingSDK=await import('https://www.gstatic.com/firebasejs/13.1.0/firebase-messaging.js');
      if(await messagingSDK.isSupported()){
        const token=await messagingSDK.getToken(messagingSDK.getMessaging(app),{
          vapidKey:publicPushKey,serviceWorkerRegistration:reg
        });
        if(token){record.fcmToken=token;record.kind='fcm';fcmNote=' Firebase-Gerätekennung vorhanden.';}
      }
    }catch(err){console.warn('FCM registration is not available in this browser; using Web Push subscription.',err)}
    await setDoc(doc(db,'snookerAdminPush',ADMIN_UID,'subscriptions',id),record);
    return 'Push-Abonnement gespeichert.'+fcmNote+' Automatischer Versand ist noch nicht eingerichtet.';
  }
};
let lastAccessRefresh=0;
window.addEventListener('focus',()=>{
  if(auth.currentUser?.uid===ADMIN_UID && !deviceSetup() && Date.now()-lastAccessRefresh>10000){
    lastAccessRefresh=Date.now();
    window.snookerAccessApi.list().catch(e=>console.warn('Freigaben aktualisieren:',e));
  }
});
onAuthStateChanged(auth,async u=>{
  const session=++accessSession;
  if(accessUnsubscribe){accessUnsubscribe();accessUnsubscribe=null}
  accessGranted=false;approvedConnection=null;
  if(deviceSetup()) { // Tischgeräte werden ausschließlich über ihre einmaligen Codes autorisiert.
    return;
  }
  window.snookerAccount.block();
  if(window.snookerAccount.switchUser(u))return;
  if(!u){window.snookerAccessUI.hidePending();msg('Nicht angemeldet');return}
  if(u.isAnonymous)return;
  if(u.uid===ADMIN_UID){accessGranted=true;window.snookerAccessUI.showAdmin();connectApproved(u);window.snookerAccessApi.list().catch(e=>console.warn('Benutzerfreigaben nicht geladen:',e));return}
  msg('Prüfe Zugangsfreigabe …');
  let accessRecordSeen=false;
  accessUnsubscribe=onSnapshot(accessDoc(u.uid),async snap=>{
    if(session!==accessSession)return;
    if(!snap.exists()){
      if(accessRecordSeen){accessGranted=false;window.snookerAccessUI.hidePending();await signOut(auth);return;}
      try {await setDoc(accessDoc(u.uid),{email:u.email||'',status:'pending',createdAt:serverTimestamp()});}
      catch(e){msg('Freigabeanfrage fehlgeschlagen: '+(e.code||e.message));window.snookerAccessUI.showPending('pending',u.email)}
      return;
    }
    accessRecordSeen=true;
    const status=snap.data()?.status;
    if(status==='approved'){
      if(!accessGranted){accessGranted=true;window.snookerAccessUI.hidePending();approvedConnection=u.uid;connectApproved(u)}
    }else{
      accessGranted=false;
      if(approvedConnection){window.location.reload();return}
      window.snookerAccessUI.showPending(status,u.email);
      msg(status==='rejected'?'Zugang gesperrt':'Freigabe durch Administrator ausstehend');
    }
  },err=>{
    if(session!==accessSession)return;
    accessGranted=false;
    msg('Zugangsprüfung nicht möglich: '+(err.code||err.message));
    window.snookerAccessUI.showPending('pending',u.email);
  });
});
e('fbSave').onclick=async()=>{if(!permitted()){msg('Bitte zuerst anmelden.');return}const raw=localStorage.getItem('snookerMoneyMatchState');if(!raw){msg('Kein lokaler Spielstand vorhanden.');return}if(!confirm('Cloud-Sicherung überschreiben?'))return;try{await setDoc(cloudDoc(),{state:raw,updatedAt:new Date().toISOString()},{merge:true});lastCloudRaw=raw;msg('✅ In Cloud gesichert')}catch(err){msg('Fehler: '+err.code)}};
e('fbLoad').onclick=async()=>{if(!permitted()){msg('Bitte zuerst anmelden.');return}try{const snap=await getDoc(cloudDoc());if(!snap.exists()){msg('Noch keine Cloud-Sicherung vorhanden.');return}const raw=snap.data().state,obj=JSON.parse(raw);if(!Array.isArray(obj.players)||!Number.isFinite(Number(obj.target)))throw Error('Ungültige Daten');if(!confirm('Lokalen Spielstand durch Cloud-Sicherung ersetzen?'))return;window.dispatchEvent(new CustomEvent('snooker-single-received',{detail:raw}));msg('✅ Cloud-Spielstand geladen')}catch(err){msg('Laden fehlgeschlagen: '+(err.code||err.message))}};
