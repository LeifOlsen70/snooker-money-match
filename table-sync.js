export function createTableSync({auth,db,doc,getDoc,getDocFromServer,onSnapshot,runTransaction}){
  const model=window.SnookerTableScore;
  const tableCollection=window.ClubSport?.tableCollection??'tables';
  const pool=window.ClubSport?.pool===true;
  let role=null,user=null,stops=[],cache=new Map(),organizer=null,queue=Promise.resolve(),syncCount=0,session=0;
  const failures=new Map();
  const ref=slot=>doc(db,'snookerTableBoards',organizer,tableCollection,String(slot));
  // Firestore forbids arrays directly inside arrays. Keep the model/JSON format
  // unchanged; only manual-result break lists use a map on the wire.
  function encodeState(state){return {...state,events:state.events.map(event=>event.type==='manual'?{...event,breaks:{player0:event.breaks[0],player1:event.breaks[1]}}:event)}}
  function decodeBoard(board){
    if(!board?.state)return board;
    return {...board,state:{...board.state,events:board.state.events.map(event=>event.type==='manual'&&!Array.isArray(event.breaks)?{...event,breaks:[event.breaks.player0,event.breaks.player1]}:event)}};
  }
  function encodeBoard(board){return {...board,state:encodeState(board.state)}}
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const active=()=>user&&auth.currentUser?.uid===user.uid;
  const notify=()=>{if(active())window.dispatchEvent(new CustomEvent('snooker-table-boards',{detail:{role,boards:[...cache.values()]}}))};
  const error=err=>{if(err.code==='permission-denied'&&role==='table'){cache.clear();notify();window.dispatchEvent(new Event('snooker-table-revoked'))}window.dispatchEvent(new CustomEvent('snooker-table-error',{detail:err.code==='permission-denied'?'Tischzugriff gesperrt. Bitte den aktuellen Tischcode verwenden und die Firebase-Regeln aus Version 7.63 prüfen.':err.message||String(err)}));};
  function stop(){session++;for(const fn of stops)fn();stops=[];cache.clear();failures.clear();role=null;user=null;syncCount=0;queue=Promise.resolve()}
  async function start(account,table,tableOwner){
    stop();user=account;organizer=tableOwner??account.uid;role=table?'table':'owner';const token=session;
    if(token!==session||!active())return;
    for(const slot of table?[table]:[1,2,3,4,5,6]){
      stops.push(onSnapshot(ref(slot),{includeMetadataChanges:true},snap=>{
        if(token!==session||!active())return;
        if(snap.metadata.fromCache||snap.metadata.hasPendingWrites)return;
        const board=decodeBoard(snap.data());
        if(board?.state?.revision<(cache.get(slot)?.state?.revision??-1))return;
        if(board?.assignment){try{model.derive(board.state,board.assignment.rules)}catch(err){error(err);return;}}
        if(board){cache.set(slot,{...board,slot});if(!syncCount)notify()}
        else {cache.delete(slot);if(!syncCount)notify()}
      },error));
    }
    if(!table)window.dispatchEvent(new Event('snooker-table-owner-ready'));
  }
  function randomToken(){const values=new Uint8Array(16);let code='';while(code.length<4){crypto.getRandomValues(values);for(const value of values){if(value<250)code+=String(value%10);if(code.length===4)break}}return code}
  function randomGeneration(){const values=new Uint8Array(16);crypto.getRandomValues(values);return Array.from(values,n=>n.toString(16).padStart(2,'0')).join('')}
  async function reserveTransaction(work){for(let attempt=0;attempt<40;attempt++){try{return await runTransaction(db,work)}catch(err){if(err.code!=='table-code-collision')throw err}}throw Error('Kein freier Tischcode gefunden. Bitte erneut versuchen.')}
  function tournamentKey(data){return (data.freeTournament?'free:':'club:')+String(data.started)}
  function assignment(data,round,index,match){
    return window.ClubSport?.assignment?window.ClubSport.assignment(data,round,index,match):{id:[data.freeTournament?'free':'club',data.started,round,index,match.startedAt].join(':'),tournament:String(data.started),frameTimeLimitMinutes:data.frameTimeLimitMinutes??0,round,index,names:match.players.map(id=>data.players[id]),players:[...match.players],rules:data.framesPerMatch!=null?{framesPerMatch:data.framesPerMatch}:{target:data.target}};
  }
  function sync(data,{before=null,replace=false,monitorSource=false,slots=[1,2,3,4,5,6]}={}){
    if(role!=='owner'||!active()||!data)return Promise.resolve();
    const token=session;
    // Build a snapshot so queued writes never observe later local mutations.
    const snapshot=JSON.parse(JSON.stringify(data));
    const previous=before?JSON.parse(JSON.stringify(before)):null;
    syncCount++;
    const job=async()=>{
      if(token!==session||!active())return;
      const errors=[];
      for(const slot of [...new Set(slots)].filter(n=>Number.isInteger(n)&&n>=1&&n<=6)){
        try{
        const matches=snapshot.rounds.flatMap((round,r)=>round.matches.map((match,m)=>({match,r,m}))).filter(({match})=>match.table===slot&&match.startedAt);
        const live=matches.find(({match})=>!match.result);
        const cached=cache.get(slot);
        const old=matches.find(({match,r,m})=>assignment(snapshot,r,m,match).id===cached?.assignment?.id);
        const selected=live??old??matches.at(-1);
        const saved=await reserveTransaction(async tx=>{
          if(token!==session||!active())throw Error('Anmeldung wurde gewechselt.');
          const existing=decodeBoard((await tx.get(ref(slot))).data());
          const key=tournamentKey(snapshot),activeSlot=slot<=snapshot.tables;
          const newTournament=existing?.tournamentKey!==key||(activeSlot&&(!/^\d{4}$/.test(existing?.joinToken??'')||!existing?.joinGeneration));
          const joinToken=activeSlot?(newTournament?randomToken():existing.joinToken):null;
          const joinGeneration=activeSlot?(newTournament?randomGeneration():existing.joinGeneration):null;
          const inviteRef=joinToken?doc(db,'snookerTableInvites',joinToken):null;
          if(activeSlot&&newTournament&&(await tx.get(inviteRef)).data())throw Object.assign(Error('Code bereits vergeben.'),{code:'table-code-collision'});
          const oldRef=existing?.joinToken&&existing.joinToken!==joinToken?doc(db,'snookerTableInvites',existing.joinToken):null;
          const oldInvite=oldRef?(await tx.get(oldRef)).data():null;
          const shared={schema:4,tableNumber:slot,tournamentKey:key,joinToken,joinGeneration,joinOpen:activeSlot&&!snapshot.ended};
          if(token!==session||!active())throw Error('Anmeldung wurde gewechselt.');
          if(oldInvite?.owner===organizer&&oldInvite.slot===slot)tx.delete(oldRef);
          if(activeSlot&&newTournament)tx.set(inviteRef,{owner:organizer,slot,tournamentKey:key,generation:joinGeneration,...(pool?{sport:'pool'}:{})});
          if(!selected){
            const next={...shared,assignment:null,enabled:false,state:model.initial((existing?.state?.revision??0)+1)};
            if(newTournament||existing?.joinToken!==joinToken||existing?.assignment||existing?.enabled||existing?.joinOpen!==shared.joinOpen)tx.set(ref(slot),encodeBoard(next));
            return (newTournament||existing?.joinToken!==joinToken||existing?.assignment||existing?.enabled||existing?.joinOpen!==shared.joinOpen)?next:existing;
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
          const next={...shared,assignment:a,enabled,state,...(window.PoolPlanner?.is(snapshot)?{progressionLocked:window.PoolPlanner.locked(snapshot,match)}:{})};
          if(!same(existing,next))tx.set(ref(slot),encodeBoard(next));
          return next;
        });
        if(token===session&&active()&&saved){cache.set(slot,{...saved,slot});failures.delete(slot);notify()}
        }catch(err){
          if(token!==session||!active())return {errors};
          const reason='Tisch '+slot+': '+(err.code?err.code+' – ':'')+(err.message||String(err));
          failures.set(slot,reason);errors.push({slot,message:reason});
          error(Error(reason));
        }
      }
      return {errors};
    };
    const result=queue.then(job).then(result=>{if(!result?.errors.length&&token===session&&active())window.dispatchEvent(new Event('snooker-table-synced'));return result}).catch(err=>{error(err);return {errors:[{message:err.message}]}}).finally(()=>{if(token===session){syncCount--;if(!syncCount)notify()}});
    queue=result;return result;
  }
  async function refresh(slot=null){
    if(!active()||!organizer||!role)throw Error('Tischverbindung ist noch nicht bereit.');
    const token=session;
    const slots=slot==null?(role==='table'?[]:[1,2,3,4,5,6]):[slot];
    if(!slots.length)throw Error('Tisch noch nicht verbunden.');
    const latest=await Promise.all(slots.map(async n=>({slot:n,snap:await getDocFromServer(ref(n))})));
    if(token!==session||!active())throw Error('Tischverbindung hat sich geändert.');
    for(const {slot:n,snap} of latest){
      const board=decodeBoard(snap.data());
      if(board?.assignment)model.derive(board.state,board.assignment.rules);
      if(board)cache.set(n,{...board,slot:n});else cache.delete(n);
    }
    notify();
  }
  // Director score entry must not depend on creating/releasing pairing codes.
  // The same board transaction and revision check still protect concurrent input.
  async function prepareScore(data,round,index){
    if(role!=='owner'||!active())throw Error('Bitte als Spielleiter anmelden.');
    const token=session;
    await queue;
    if(token!==session||!active()||role!=='owner')throw Error('Anmeldung wurde gewechselt.');
    const match=data?.rounds?.[round]?.matches?.[index];
    if(!match?.table||!match.startedAt||match.result||data.ended)throw Error('Diese Partie ist nicht aktiv.');
    const slot=match.table,a=assignment(data,round,index,match),key=tournamentKey(data);
    const saved=await runTransaction(db,async tx=>{
      const existing=decodeBoard((await tx.get(ref(slot))).data());
      if(token!==session||!active()||role!=='owner')throw Error('Anmeldung wurde gewechselt.');
      let state=existing?.assignment?.id===a.id?existing.state:match.scoreMonitor?.state??model.initial();
      model.derive(state,a.rules);
      if(existing?.assignment?.id!==a.id)state={...state,revision:(existing?.state?.revision??0)+1};
      const sameTournament=existing?.tournamentKey===key;
      const next={...(existing??{}),schema:4,tableNumber:slot,tournamentKey:key,
        joinToken:sameTournament?existing.joinToken??null:null,
        joinGeneration:sameTournament?existing.joinGeneration??null:null,
        joinOpen:sameTournament&&existing.joinOpen===true,
        assignment:a,enabled:true,state,
        ...(window.PoolPlanner?.is(data)?{progressionLocked:window.PoolPlanner.locked(data,match)}:{})};
      if(!same(existing,next))tx.set(ref(slot),encodeBoard(next));
      return next;
    });
    if(token!==session||!active())throw Error('Anmeldung wurde gewechselt.');
    cache.set(slot,{...saved,slot});notify();return {...saved,slot};
  }
  async function command(slot,id,revision,action){
    if(!active())throw Error('Bitte erneut anmelden.');
    const token=session;
    const saved=await runTransaction(db,async tx=>{
      const board=decodeBoard((await tx.get(ref(slot))).data());
      if(token!==session||!active())throw Error('Anmeldung wurde gewechselt.');
      if(!board?.enabled||board.assignment?.id!==id)throw Error('Die Tischzuordnung wurde geändert oder das Turnier beendet.');
      if(board.state.revision!==revision)throw Error('Der Spielstand wurde inzwischen geändert. Bitte prüfen und erneut eingeben.');
      if(action.type==='manual'&&role!=='owner')throw Error('Nur die Turnierleitung darf Ergebnisse direkt korrigieren.');
      if(action.type==='undo'&&board.progressionLocked&&model.derive(board.state,board.assignment.rules).complete)throw Error('Eine Folgebegegnung wurde bereits gestartet. Dieses abgeschlossene Ergebnis kann nicht mehr zurückgenommen werden.');
      const state=model.command(board.state,board.assignment.rules,{...action,at:Date.now()});
      tx.update(ref(slot),{state:encodeState(state)});
      return {...board,state,slot};
    });
    if(token===session&&active()){cache.set(slot,saved);if(!syncCount)notify()}
    return saved;
  }
  async function reset(slot){
    if(role!=='owner'||!active())throw Error('Nur die Turnierleitung darf Tischverbindungen zurücksetzen.');
    await queue;const token=session;
    const saved=await runTransaction(db,async tx=>{
      const board=decodeBoard((await tx.get(ref(slot))).data());
      if(token!==session||!active())throw Error('Anmeldung wurde gewechselt.');
      if(!board?.joinOpen||!/^\d{4}$/.test(board.joinToken??''))throw Error('Tischcodes zuerst aktualisieren.');
      const generation=randomGeneration(),next={...board,joinGeneration:generation};
      tx.set(ref(slot),encodeBoard(next));
      tx.set(doc(db,'snookerTableInvites',board.joinToken),{owner:organizer,slot,tournamentKey:board.tournamentKey,generation,...(pool?{sport:'pool'}:{})});
      return {...next,slot};
    });
    if(token===session&&active()){cache.set(slot,saved);notify()}
    return {slot,code:saved.joinToken};
  }
  async function codes(data){await sync(data);if(role!=='owner'||!active())throw Error('Bitte als Spielleiter anmelden.');const key=tournamentKey(data);const values=await Promise.all(Array.from({length:data.tables},(_,i)=>getDoc(ref(i+1))));return values.map(s=>s.data()).filter(b=>b?.joinOpen&&b.tournamentKey===key).map(b=>({slot:b.tableNumber,code:b.joinToken}));}
  return Object.freeze({start,stop,sync,refresh,prepareScore,command,assignment,codes,reset,syncError:slot=>failures.get(slot)??'',async idle(){await queue},get syncing(){return syncCount>0},get owner(){return organizer},get role(){return role},get boards(){return [...cache.values()]}});
}
