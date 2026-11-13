import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {getAuth,signInWithEmailAndPassword,createUserWithEmailAndPassword,sendPasswordResetEmail,setPersistence,browserLocalPersistence,signOut,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import {getFirestore,doc,getDoc,setDoc,onSnapshot,runTransaction} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
const config={apiKey:'AIzaSyBgmv1v5APpPReJ4olWCusUhhGGevcvRcE',authDomain:'snooker-money-match.firebaseapp.com',projectId:'snooker-money-match',storageBucket:'snooker-money-match.firebasestorage.app',messagingSenderId:'423302158497',appId:'1:423302158497:web:706c1fec068959b7bbb8e0'};
const localStorage = window.snookerStorage;
const app=initializeApp(config),auth=getAuth(app),db=getFirestore(app),e=id=>document.getElementById(id),msg=t=>e('fbStatus').textContent=t;
const permitted=()=>Boolean(auth.currentUser && localStorage.uid && auth.currentUser.uid===localStorage.uid);
await setPersistence(auth,browserLocalPersistence);
window.snookerAccount.bind({
  login:(email,password)=>signInWithEmailAndPassword(auth,email,password),
  register:(email,password)=>createUserWithEmailAndPassword(auth,email,password),
  reset:email=>sendPasswordResetEmail(auth,email),
  logout:()=>signOut(auth)
});
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
onAuthStateChanged(auth,u=>{
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
    if(firstSnapshot)window.snookerAccount.ready(u);
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
});
e('fbSave').onclick=async()=>{if(!permitted()){msg('Bitte zuerst anmelden.');return}const raw=localStorage.getItem('snookerMoneyMatchState');if(!raw){msg('Kein lokaler Spielstand vorhanden.');return}if(!confirm('Cloud-Sicherung überschreiben?'))return;try{await setDoc(cloudDoc(),{state:raw,updatedAt:new Date().toISOString()},{merge:true});lastCloudRaw=raw;msg('✅ In Cloud gesichert')}catch(err){msg('Fehler: '+err.code)}};
e('fbLoad').onclick=async()=>{if(!permitted()){msg('Bitte zuerst anmelden.');return}try{const snap=await getDoc(cloudDoc());if(!snap.exists()){msg('Noch keine Cloud-Sicherung vorhanden.');return}const raw=snap.data().state,obj=JSON.parse(raw);if(!Array.isArray(obj.players)||!Number.isFinite(Number(obj.target)))throw Error('Ungültige Daten');if(!confirm('Lokalen Spielstand durch Cloud-Sicherung ersetzen?'))return;window.dispatchEvent(new CustomEvent('snooker-single-received',{detail:raw}));msg('✅ Cloud-Spielstand geladen')}catch(err){msg('Laden fehlgeschlagen: '+(err.code||err.message))}};
