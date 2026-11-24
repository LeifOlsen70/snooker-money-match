export function createSpectatorOwner({auth,db,doc,getDocFromServer,runTransaction,permitted,cloudDoc,tableSync}){
  const model=window.SnookerSpectator,sport=window.ClubSport.pool?'pool':'snooker',tables=window.ClubSport.tableCollection;
  let descriptor=null,error='',queue=Promise.resolve(),scheduled=false;
  const root=t=>doc(db,'snookerSpectatorLinks',t);
  function notify(){window.dispatchEvent(new CustomEvent('snooker-spectator-status',{detail:status()}));}
  function status(){return {...(descriptor??{}),error};}
  function current(){if(!permitted())throw Error('Bitte als freigegebener Spielleiter anmelden.');return auth.currentUser.uid;}
  function random(){const a=new Uint8Array(24);crypto.getRandomValues(a);return Array.from(a,n=>n.toString(16).padStart(2,'0')).join('');}
  async function publish(){
    const owner=current();
    await tableSync.idle();
    return runTransaction(db,async tx=>{
      const cloud=(await tx.get(cloudDoc())).data(),link=cloud?.spectatorLink;
      if(!link?.enabled||!model.validToken(link.token))return;
      const data=JSON.parse(cloud.tournamentSync??'null'),meta=(await tx.get(root(link.token))).data();
      if(!data||model.key(data)!==link.key||meta?.owner!==owner||!meta.enabled||meta.tournamentKey!==link.key)return;
      const target=doc(db,'snookerSpectatorLinks',link.token,'view','current'),previous=(await tx.get(target)).data();
      const boards=await Promise.all(Array.from({length:data.tables},async(_,i)=>{
        const ref=doc(db,'snookerTableBoards',owner,tables,String(i+1));return {ref,value:(await tx.get(ref)).data()};
      }));
      const payload=JSON.stringify(window.snookerTournamentBridge.spectatorSnapshot(data));
      if(!permitted()||auth.currentUser?.uid!==owner)throw Error('Anmeldung wurde gewechselt.');
      if(previous?.payload!==payload)tx.set(target,{payload,updatedAt:Date.now()});
      for(const {ref,value}of boards){
        if(!value||value.tournamentKey!==link.key)continue;
        if(value.viewerToken!==link.token)tx.update(ref,{viewerToken:link.token});
        tx.set(doc(db,'snookerSpectatorLinks',link.token,'tables',String(value.tableNumber)),model.board(value));
      }
    });
  }
  function schedule(){
    if(scheduled)return;scheduled=true;
    queue=queue.catch(()=>{}).then(async()=>{
      scheduled=false;
      try{await publish();error='';}catch(err){error=err.code==='permission-denied'?'Zuschauerzugang noch nicht freigeschaltet. Bitte die Firebase-Regeln aus Version 9.11 veröffentlichen.':err.message;}
      notify();
    });
    return queue;
  }
  function observe(cloud){
    descriptor=cloud?.spectatorLink??null;
    if(descriptor?.enabled){
      try{const data=JSON.parse(cloud.tournamentSync??'null');if(data&&model.key(data)===descriptor.key)schedule();else void disable(descriptor.token).catch(err=>{error=err.message;notify()});}
      catch(err){error=err.message;}
    }
    notify();
  }
  async function enable(expectedKey){
    const owner=current();await tableSync.idle();
    descriptor=await runTransaction(db,async tx=>{
      const ref=cloudDoc(),cloud=(await tx.get(ref)).data(),data=JSON.parse(cloud?.tournamentSync??'null');
      if(!data||model.key(data)!==expectedKey)throw Error('Bitte zuerst den aktuellen Turnierstand synchronisieren.');
      const old=cloud?.spectatorLink,oldMeta=old?.token?(await tx.get(root(old.token))).data():null;
      if(old?.enabled&&old.key===expectedKey&&oldMeta?.enabled)return old;
      const token=random(),newRef=root(token),collision=(await tx.get(newRef)).exists();
      if(collision)throw Error('Bitte Zuschauerlink erneut erstellen.');
      if(!permitted()||auth.currentUser?.uid!==owner)throw Error('Anmeldung wurde gewechselt.');
      if(oldMeta?.enabled)tx.update(root(old.token),{enabled:false,updatedAt:Date.now()});
      const next={token,key:expectedKey,enabled:true};
      tx.set(newRef,{owner,sport,tournamentKey:expectedKey,enabled:true,updatedAt:Date.now()});
      tx.set(ref,{spectatorLink:next},{merge:true});return next;
    });
    error='';await publish();notify();return status();
  }
  async function disable(expectedToken=descriptor?.token){
    const owner=current();
    await runTransaction(db,async tx=>{
      const ref=cloudDoc(),cloud=(await tx.get(ref)).data(),link=cloud?.spectatorLink;
      if(!link?.token||expectedToken&&link.token!==expectedToken)return;
      const meta=(await tx.get(root(link.token))).data();
      if(!permitted()||auth.currentUser?.uid!==owner)throw Error('Anmeldung wurde gewechselt.');
      if(meta?.owner===owner)tx.update(root(link.token),{enabled:false,updatedAt:Date.now()});
      tx.set(ref,{spectatorLink:{...link,enabled:false}},{merge:true});
    });
    if(descriptor)descriptor={...descriptor,enabled:false};error='';notify();return status();
  }
  return Object.freeze({observe,enable,disable,status,refresh:schedule});
}
