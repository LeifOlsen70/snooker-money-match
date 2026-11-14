export function createTableSync({auth,db,doc,getDoc,onSnapshot,runTransaction,owner}){
  const model=window.SnookerTableScore;
  let role=null,user=null,stops=[],cache=new Map(),accounts={},queue=Promise.resolve(),syncCount=0,session=0;
  const ref=slot=>doc(db,'snookerTableBoards',owner,'tables',String(slot));
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const active=()=>user&&auth.currentUser?.uid===user.uid;
  const notify=()=>{if(active())window.dispatchEvent(new CustomEvent('snooker-table-boards',{detail:{role,boards:[...cache.values()]}}))};
  const error=err=>window.dispatchEvent(new CustomEvent('snooker-table-error',{detail:err.code==='permission-denied'?'Tischzugriff gesperrt. Bitte die Firebase-Regeln aus Version 7.57 veröffentlichen und die Tischzuordnung prüfen.':err.message||String(err)}));
  function stop(){session++;for(const fn of stops)fn();stops=[];cache.clear();role=null;user=null;accounts={};syncCount=0;queue=Promise.resolve()}
  async function start(account,table){
    stop();user=account;role=table?'table':'owner';const token=session;
    if(!table){
      try{accounts=(await getDoc(doc(db,'privateSnooker',owner))).data()?.tableAccessAccounts??{}}catch(err){error(err)}
    }
    if(token!==session||!active())return;
    if(!table){
      try{for(const slot of [1,2,3])await runTransaction(db,async tx=>{
        const existing=(await tx.get(ref(slot))).data();
        if(token!==session||!active())throw Error('Anmeldung wurde gewechselt.');
        const tableUid=accounts[slot]?.uid??null;
        if(!existing)tx.set(ref(slot),{schema:1,tableUid,tableNumber:slot,assignment:null,enabled:false,state:model.initial()});
        else if(existing.tableUid!==tableUid)tx.set(ref(slot),{...existing,tableUid});
      })}catch(err){error(err)}
    }
    if(token!==session||!active())return;
    for(const slot of table?[table]:[1,2,3]){
      stops.push(onSnapshot(ref(slot),{includeMetadataChanges:true},snap=>{
        if(token!==session||!active())return;
        if(snap.metadata.fromCache||snap.metadata.hasPendingWrites)return;
        const board=snap.data();
        if(board?.assignment){try{model.derive(board.state,board.assignment.rules)}catch(err){error(err);return;}}
        if(board){cache.set(slot,{...board,slot});if(!syncCount)notify()}
        else {cache.delete(slot);if(!syncCount)notify()}
      },error));
    }
    if(!table)window.dispatchEvent(new Event('snooker-table-owner-ready'));
  }
  function assignment(data,round,index,match){
    return {id:[data.freeTournament?'free':'club',data.started,round,index,match.startedAt].join(':'),tournament:String(data.started),round,index,names:match.players.map(id=>data.players[id]),players:[...match.players],rules:data.framesPerMatch!=null?{framesPerMatch:data.framesPerMatch}:{target:data.target}};
  }
  function sync(data,{before=null,replace=false,monitorSource=false}={}){
    if(role!=='owner'||!active()||!data)return Promise.resolve();
    const token=session;
    // Build a snapshot so queued writes never observe later local mutations.
    const snapshot=JSON.parse(JSON.stringify(data));
    const previous=before?JSON.parse(JSON.stringify(before)):null;
    syncCount++;
    const job=async()=>{
      if(token!==session||!active())return;
      for(const slot of [1,2,3]){
        const matches=snapshot.rounds.flatMap((round,r)=>round.matches.map((match,m)=>({match,r,m}))).filter(({match})=>match.table===slot&&match.startedAt);
        const live=matches.find(({match})=>!match.result);
        const cached=cache.get(slot);
        const old=matches.find(({match,r,m})=>assignment(snapshot,r,m,match).id===cached?.assignment?.id);
        const selected=live??old??matches.at(-1);
        await runTransaction(db,async tx=>{
          if(token!==session||!active())throw Error('Anmeldung wurde gewechselt.');
          const existing=(await tx.get(ref(slot))).data();
          if(token!==session||!active())throw Error('Anmeldung wurde gewechselt.');
          if(!selected){
            if(existing?.assignment&&existing.assignment.tournament!==String(snapshot.started)||existing?.enabled){
              tx.set(ref(slot),{schema:1,tableUid:accounts[slot]?.uid??null,tableNumber:slot,assignment:null,enabled:false,state:model.initial((existing?.state?.revision??0)+1)});
            }else if(!existing)tx.set(ref(slot),{schema:1,tableUid:accounts[slot]?.uid??null,tableNumber:slot,assignment:null,enabled:false,state:model.initial()});
            return;
          }
          const {match,r,m}=selected,a=assignment(snapshot,r,m,match),enabled=!snapshot.ended;
          let state=existing?.state;
          if(!existing||existing.assignment?.id!==a.id||replace){
            state=match.scoreMonitor?.state??model.initial();
            try{model.derive(state,a.rules)}catch{state=model.initial()}
            state={...state,revision:(existing?.state?.revision??0)+1};
            if(match.result&&!model.derive(state,a.rules).complete)state=model.command(state,a.rules,{type:'manual',frames:match.result.frames,breaks:match.result.breaks,at:match.finishedAt??Date.now()});
          }else if(!monitorSource&&previous){
            const oldMatch=previous.rounds?.[r]?.matches?.[m];
            if(oldMatch&&oldMatch.startedAt===match.startedAt&&!same(oldMatch.scoreMonitor?.state,match.scoreMonitor?.state)){
              if(oldMatch.scoreMonitor?.state?.revision!==state.revision)throw Error('Der Tisch wurde inzwischen geändert. Den aktuellen Stand prüfen, bevor die Turnieränderung wiederholt wird.');
              state={...(match.scoreMonitor?.state??model.initial()),revision:state.revision+1};model.derive(state,a.rules);
            }
          }
          const next={schema:1,tableUid:accounts[slot]?.uid??null,tableNumber:slot,assignment:a,enabled,state};
          if(!same(existing,next))tx.set(ref(slot),next);
        });
      }
    };
    const result=queue.then(job).catch(error).finally(()=>{if(token===session){syncCount--;if(!syncCount)notify()}});
    queue=result;return result;
  }
  async function command(slot,id,revision,action){
    if(!active())throw Error('Bitte erneut anmelden.');
    const token=session;
    return await runTransaction(db,async tx=>{
      const board=(await tx.get(ref(slot))).data();
      if(token!==session||!active())throw Error('Anmeldung wurde gewechselt.');
      if(!board?.enabled||board.assignment?.id!==id)throw Error('Die Tischzuordnung wurde geändert oder das Turnier beendet.');
      if(board.state.revision!==revision)throw Error('Der Spielstand wurde inzwischen geändert. Bitte prüfen und erneut eingeben.');
      if(action.type==='manual'&&role!=='owner')throw Error('Nur die Turnierleitung darf Ergebnisse direkt korrigieren.');
      const state=model.command(board.state,board.assignment.rules,{...action,at:Date.now()});
      tx.update(ref(slot),{state});
      return {...board,state,slot};
    });
  }
  return Object.freeze({start,stop,sync,command,assignment,get role(){return role},get boards(){return [...cache.values()]}});
}
