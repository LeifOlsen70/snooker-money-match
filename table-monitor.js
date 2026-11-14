(() => {
  'use strict';
  const model=window.SnookerTableScore,bridge=window.snookerTournamentBridge;
  const app=document.querySelector('.app');
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let tableSlot=null,boards=[],message='',popupBoard=null,popupPlayer=0,busy=false,landing=false;
  const tablePage=document.createElement('section');tablePage.id='tableMode';tablePage.hidden=true;app.append(tablePage);
  const popup=document.createElement('dialog');popup.id='tableScoreDialog';popup.className='tournamentDialog monitorInputDialog';
  popup.innerHTML=`<button type="button" data-close class="secondary">← Zurück zur Punkteanzeige</button><h2 id="tableInputName"></h2><p>Break-Punkte hinzufügen</p><input id="tableInputValue" readonly placeholder="0" aria-label="Punkte"><div class="monitorKeypad">${[1,2,3,4,5,6,7,8,9,'clear',0,'delete'].map(value=>`<button type="button" data-key="${value}">${value==='clear'?'Löschen':value==='delete'?'⌫':value}</button>`).join('')}</div><button type="button" id="tableInputSubmit" class="primary">Punkte übernehmen</button><div class="monitorWinners"></div><p role="alert" id="tableInputStatus"></p>`;
  document.body.append(popup);
  const input=()=>document.getElementById('tableInputValue');
  function closePopup(){popup.close();input().value='';popupBoard=null}
  popup.querySelector('[data-close]').onclick=closePopup;
  popup.oncancel=e=>{e.preventDefault();closePopup()};
  popup.addEventListener('click',e=>{if(e.target===popup)closePopup()});
  popup.querySelectorAll('[data-key]').forEach(button=>button.onclick=()=>{
    if(busy)return;const key=button.dataset.key;
    if(key==='clear')input().value='';else if(key==='delete')input().value=input().value.slice(0,-1);
    else if(input().value.length<3)input().value=(input().value+key).replace(/^0+(?=\d)/,'');
  });
  popup.addEventListener('keydown',e=>{
    if(/^\d$/.test(e.key)){e.preventDefault();popup.querySelector(`[data-key="${e.key}"]`).click()}
    else if(e.key==='Backspace'){e.preventDefault();popup.querySelector('[data-key=delete]').click()}
    else if(e.key==='Enter'&&e.target!==popup.querySelector('[data-close]')){e.preventDefault();document.getElementById('tableInputSubmit').click()}
  });
  function status(text){message=text;document.querySelectorAll('[data-monitor-message]').forEach(el=>el.textContent=text)}
  function assignment(data,r,m,match){return {id:[data.freeTournament?'free':'club',data.started,r,m,match.startedAt].join(':'),tournament:String(data.started),round:r,index:m,names:match.players.map(id=>data.players[id]),players:[...match.players],rules:data.framesPerMatch!=null?{framesPerMatch:data.framesPerMatch}:{target:data.target}}}
  function forMatch(data,r,m,match){
    const a=assignment(data,r,m,match),remote=boards.find(board=>board.assignment?.id===a.id);
    if(remote)return remote;
    let state=match.scoreMonitor?.state??model.initial();
    try{model.derive(state,a.rules)}catch{state=model.initial()}
    if(match.result&&!model.derive(state,a.rules).complete)state=model.command(state,a.rules,{type:'manual',frames:match.result.frames,breaks:match.result.breaks,at:match.finishedAt??Date.now()});
    return {slot:match.table,tableNumber:match.table,assignment:a,state,enabled:!data.ended,_local:window.snookerTableSync?.role!=='owner'};
  }
  async function send(board,action){
    if(busy)return;busy=true;
    popup.querySelectorAll('button').forEach(el=>el.disabled=true);
    try{
      if(board._local){
        const latest=bridge.current?.rounds[board.assignment.round]?.matches[board.assignment.index];
        if(!latest||latest.startedAt==null||assignment(bridge.current,board.assignment.round,board.assignment.index,latest).id!==board.assignment.id||(latest.scoreMonitor?.state?.revision??board.state.revision)!==board.state.revision)throw Error('Spielstand wurde geändert. Bitte erneut öffnen.');
        bridge.applyBoard({...board,forceResult:action.type==='undo'||action.type==='redo',state:model.command(board.state,board.assignment.rules,{...action,at:Date.now()})});
      }else{
        const service=window.snookerTableSync;
        if(!service?.role)throw Error('Tischverbindung wird noch vorbereitet.');
        await service.command(board.slot,board.assignment.id,board.state.revision,action);
      }
      status('Eingabe gespeichert.');
      closePopup();
    }catch(err){status(err.message);document.getElementById('tableInputStatus').textContent=err.message}
    finally{busy=false;popup.querySelectorAll('button').forEach(el=>el.disabled=false)}
  }
  function winner(board,player){
    let pendingPoints;
    if(input().value){const value=Number(input().value);if(!Number.isInteger(value)||value<1||value>147){document.getElementById('tableInputStatus').textContent='Bitte 1 bis 147 Punkte eingeben oder das Feld löschen.';return;}pendingPoints={player:popupPlayer,value};}
    const note=pendingPoints?` Dabei ${pendingPoints.value} Punkte für ${board.assignment.names[pendingPoints.player]} übernehmen.`:'';
    if(!confirm(`Frame-Sieg für ${board.assignment.names[player]} bestätigen?${note}`))return;
    send(board,{type:'frame',player,...(pendingPoints?{pendingPoints}:{})});
  }
  function openPopup(board,player){
    if(!board.enabled)return;
    if(!board._local&&!boards.some(b=>b.assignment?.id===board.assignment.id)) {status('Der Tisch wird noch verbunden. Bitte kurz warten.');return}
    popupBoard=board;popupPlayer=player;input().value='';
    document.getElementById('tableInputName').textContent=board.assignment.names[player];
    document.getElementById('tableInputStatus').textContent='';
    const summary=model.derive(board.state,board.assignment.rules);
    const disabled=summary.complete;
    document.getElementById('tableInputSubmit').disabled=disabled;
    popup.querySelector('.monitorWinners').innerHTML=board.assignment.names.map((name,i)=>`<button type="button" data-winner="${i}" ${disabled?'disabled':''}>Frame-Sieger: ${escape(name)}</button>`).join('');
    popup.querySelectorAll('[data-winner]').forEach(b=>b.onclick=()=>winner(board,Number(b.dataset.winner)));
    popup.showModal();popup.querySelector('[data-close]').focus({preventScroll:true});
  }
  document.getElementById('tableInputSubmit').onclick=()=>{
    if(!popupBoard||busy)return;
    const value=Number(input().value);
    if(!input().value||!Number.isInteger(value)||value<1||value>147){document.getElementById('tableInputStatus').textContent='Bitte 1 bis 147 Punkte eingeben.';return}
    send(popupBoard,{type:'points',player:popupPlayer,value});
  };
  function card(board,compact=false){
    if(!board?.assignment)return `<article class="monitorCard"><h3>Tisch ${board?.slot??''}</h3><p>Warten auf eine gestartete Partie.</p></article>`;
    const value=model.derive(board.state,board.assignment.rules);
    return `<article class="monitorCard ${compact?'monitorCompact':''}"><h3>Tisch ${board.tableNumber} · ${value.complete?'Partie beendet':'Frame '+(value.frames[0]+value.frames[1]+1)}</h3>
    <div class="monitorPlayers">${board.assignment.names.map((name,i)=>`<button type="button" data-monitor-player="${i}" data-monitor-slot="${board.slot}" ${board.enabled?'':'disabled'}><span class="monitorName">${escape(name)}</span><strong class="monitorPoints">${value.scores[i]}</strong><span>Frames <b>${value.frames[i]}</b></span><span>HB: ${Math.max(0,...value.breaks[i])}</span></button>`).join('')}</div>
    <p class="small">${board.assignment.rules.framesPerMatch!=null?board.assignment.rules.framesPerMatch+' Frames insgesamt':'Bis '+board.assignment.rules.target+' Gewinnframes'}${value.complete?' · Ergebnis '+value.frames.join(':'):''}</p>
    <div class="monitorActions"><button type="button" data-monitor-undo="${board.slot}" ${board.state.cursor&&board.enabled?'':'disabled'}>↶ Zurück</button><button type="button" data-monitor-redo="${board.slot}" ${board.state.cursor<board.state.events.length&&board.enabled?'':'disabled'}>Vor ↷</button></div>
    <details><summary>Breaks ab 20</summary>${value.breaks.map((list,i)=>`<p>${escape(board.assignment.names[i])}: ${list.join(', ')||'–'}</p>`).join('')}</details></article>`;
  }
  function bind(container,list){
    container.querySelectorAll('[data-monitor-player]').forEach(b=>b.onclick=()=>{const board=list.find(x=>x.slot===Number(b.dataset.monitorSlot));if(board)openPopup(board,Number(b.dataset.monitorPlayer))});
    for(const action of ['undo','redo'])container.querySelectorAll(`[data-monitor-${action}]`).forEach(b=>b.onclick=()=>{const board=list.find(x=>x.slot===Number(b.dataset[action==='undo'?'monitorUndo':'monitorRedo']));if(board)send(board,{type:action})});
  }
  function renderOverview(container,data){
    const all=data.rounds.flatMap((round,r)=>round.matches.map((match,m)=>({match,r,m}))).filter(({match})=>match.table&&match.startedAt);
    const list=[];
    for(let slot=1;slot<=data.tables;slot++){
      const items=all.filter(x=>x.match.table===slot),current=items.find(x=>!x.match.result)??items.at(-1);
      if(current)list.push(forMatch(data,current.r,current.m,current.match));else list.push({slot});
    }
    container.innerHTML=`<div class="card monitorOverview"><div class="tournamentStandingsHeader"><h3>Score Monitor</h3><button type="button" data-monitor-full>Vollbild ${document.body.classList.contains('monitorOverviewFullscreen')?'aus':'an'}</button></div><button type="button" data-table-codes>Tischcodes anzeigen</button><p data-monitor-message role="status">${escape(message)}</p><p class="small">${window.snookerTableSync?.role==='owner'?'Live-Verbindung zu den Tischen dieses Turniers.':'Lokales Zählwerk. Für die Verbindung zu Tischgeräten mit deinem Spielleiterkonto anmelden.'}</p><div class="monitorOverviewGrid">${list.map(board=>card(board,true)).join('')}</div></div>`;
    bind(container,list);
    container.querySelector('[data-table-codes]').onclick=()=>window.snookerTableCodes();
    container.querySelector('[data-monitor-full]').onclick=()=>{const on=document.body.classList.toggle('monitorOverviewFullscreen');container.querySelector('[data-monitor-full]').textContent=on?'Vollbild aus':'Vollbild an'};
  }
  function renderTable(){
    if(!tableSlot)return;
    const board=boards.find(b=>b.slot===tableSlot);
    tablePage.innerHTML=`<div class="monitorTableHeader"><h2>Tisch ${tableSlot}</h2><button type="button" data-table-leave>Tisch verlassen</button><button type="button" data-table-full>Vollbild ${document.body.classList.contains('tableMonitorFullscreen')?'aus':'an'}</button></div><p data-monitor-message role="status">${escape(message||(navigator.onLine?'Tischverbindung wird hergestellt …':'Offline – für den Tischbetrieb bitte Internet verbinden.'))}</p>${landing?'<button type="button" class="primary" data-table-return>Zur Partie</button>':card(board??{slot:tableSlot})}`;
    if(board?.assignment)bind(tablePage,[board]);
    tablePage.querySelector('[data-table-leave]').onclick=()=>{if(confirm('Tischverbindung auf diesem Gerät beenden?'))window.snookerTableBackend.leave()};
    tablePage.querySelector('[data-table-full]').onclick=()=>{document.body.classList.toggle('tableMonitorFullscreen');renderTable()};
    tablePage.querySelector('[data-table-return]')?.addEventListener('click',()=>{landing=false;renderTable()});
  }
  function activateTable(slot){
    tableSlot=slot;tablePage.hidden=false;
    document.body.classList.add('tableDeviceMode');document.body.classList.remove('modeHome','snookerFullscreenScore','snookerFullscreenTournament');
    for(const id of ['modeStart','singleMode','tournamentMode'])document.getElementById(id).classList.add('hidden');
    renderTable();
  }
  function reconcile(){
    if(tableSlot){renderTable();return}
    if(bridge.canApply)for(const board of boards){try{bridge.applyBoard(board)}catch(err){status(err.message)}}
    const overview=document.getElementById('tournamentMonitors');if(overview&&bridge.current)renderOverview(overview,bridge.current);
  }
  window.snookerMonitors=Object.freeze({activateTable,renderOverview,reconcile,
    deactivate(){tableSlot=null;boards=[];tablePage.hidden=true;closePopup();document.body.classList.remove('tableDeviceMode','tableMonitorFullscreen','monitorOverviewFullscreen')},
    tableHome(){landing=true;document.body.classList.remove('tableMonitorFullscreen');closePopup();renderTable()},
    async commitManual(index,result){
      const data=bridge.current;if(!data)return;
      const [r,m]=index.split(':').map(Number),match=data.rounds[r]?.matches[m];if(!match?.table)return;
      const board=forMatch(data,r,m,match);
      if(!board._local&&!boards.some(b=>b.assignment?.id===board.assignment.id))throw Error('Tischverbindung wird vorbereitet. Bitte kurz warten.');
      if(board._local)return;
      return await window.snookerTableSync.command(board.slot,board.assignment.id,board.state.revision,{type:'manual',...result});
    }
  });
  window.addEventListener('snooker-account-enter',e=>{if(tableSlot){e.stopImmediatePropagation();activateTable(tableSlot)}},true);
  window.addEventListener('snooker-tournament-publish',({detail})=>{
    if(tableSlot)return;
    let after,before;try{after=JSON.parse(detail.after);before=JSON.parse(detail.before)}catch{return}
    window.snookerTableSync?.sync(after,{before,replace:detail.replace,monitorSource:detail.monitorSource});
  });
  window.addEventListener('snooker-tournament-received',()=>queueMicrotask(()=>window.snookerTableSync?.sync(bridge.current)));
  window.addEventListener('snooker-table-owner-ready',()=>window.snookerTableSync?.sync(bridge.current));
  window.addEventListener('snooker-table-boards',({detail})=>{
    const previousAssignment=boards.find(b=>b.slot===tableSlot)?.assignment?.id;
    boards=detail.boards;
    if(popup.open&&popupBoard&&!popupBoard._local){const next=boards.find(b=>b.slot===popupBoard.slot);if(next?.assignment?.id!==popupBoard.assignment.id||next?.state.revision!==popupBoard.state.revision){closePopup();status('Spielstand aktualisiert.')}}
    if(tableSlot){const board=boards.find(b=>b.slot===tableSlot);if(board?.assignment?.id&&board.assignment.id!==previousAssignment)landing=false;status(board?.assignment?'Live verbunden.':'Verbunden · Warten auf die Turnierleitung.');}
    reconcile();
  });
  window.addEventListener('snooker-table-error',({detail})=>{status(detail);renderTable()});
  document.addEventListener('click',e=>{if(e.target.closest('.appTabStrip > button'))document.body.classList.remove('monitorOverviewFullscreen')},true);
  window.addEventListener('offline',()=>status('Offline – Eingaben benötigen eine Verbindung. Der angezeigte Stand kann veraltet sein.'));
})();
