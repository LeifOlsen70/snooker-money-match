(() => {
  'use strict';
  const model=window.SnookerTableScore,bridge=window.snookerTournamentBridge;
  const app=document.querySelector('.app');
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let tableSlot=null,boards=[],message='',popupBoard=null,popupPlayer=0,busy=false,landing=false,detailSlot=null;
  const tablePage=document.createElement('section');tablePage.id='tableMode';tablePage.hidden=true;app.append(tablePage);
  const popup=document.createElement('dialog');popup.id='tableScoreDialog';popup.className='tournamentDialog monitorInputDialog';
  popup.innerHTML=`<button type="button" data-close class="secondary">← Zurück zur Punkteanzeige</button><h2 id="tableInputName"></h2><p>Break-Punkte hinzufügen</p><input id="tableInputValue" readonly placeholder="0" aria-label="Punkte"><div class="monitorKeypad">${[1,2,3,4,5,6,7,8,9,'clear',0,'delete'].map(value=>`<button type="button" data-key="${value}">${value==='clear'?'Löschen':value==='delete'?'⌫':value}</button>`).join('')}</div><button type="button" id="tableInputSubmit" class="primary">Punkte übernehmen</button><p role="alert" id="tableInputStatus"></p>`;
  const popupFrame=document.createElement('button');popupFrame.type='button';popupFrame.setAttribute('data-popup-frame','1');popupFrame.hidden=true;popupFrame.textContent='Frame-Sieger';popupFrame.onclick=()=>{if(!popupBoard)return;const value=Number(input().value);if(input().value&&(!Number.isInteger(value)||value<1||value>9999)){document.getElementById('tableInputStatus').textContent='Bitte 1 bis 9999 Punkte eingeben.';return;}winner(popupBoard,popupPlayer,input().value?{player:popupPlayer,value}:null)};popup.append(popupFrame);
  document.body.append(popup);
  const input=()=>document.getElementById('tableInputValue');
  function closePopup(){if(popup.open)popup.close();input().value='';popupBoard=null}
  popup.querySelector('[data-close]').onclick=closePopup;
  popup.oncancel=e=>{e.preventDefault();closePopup()};
  popup.addEventListener('click',e=>{if(e.target===popup)closePopup()});
  popup.querySelectorAll('[data-key]').forEach(button=>button.onclick=()=>{
    if(busy)return;const key=button.dataset.key;
    if(key==='clear')input().value='';else if(key==='delete')input().value=input().value.slice(0,-1);
    else if(input().value.length<(popupBoard?.assignment.rules.sport==='pool'?4:3))input().value=(input().value+key).replace(/^0+(?=\d)/,'');
  });
  popup.addEventListener('keydown',e=>{
    if(/^\d$/.test(e.key)){e.preventDefault();popup.querySelector(`[data-key="${e.key}"]`).click()}
    else if(e.key==='Backspace'){e.preventDefault();popup.querySelector('[data-key=delete]').click()}
    else if(e.key==='Enter'&&e.target!==popup.querySelector('[data-close]')){e.preventDefault();document.getElementById('tableInputSubmit').click()}
  });
  function status(text){message=text;document.querySelectorAll('[data-monitor-message]').forEach(el=>el.textContent=text)}
  function assignment(data,r,m,match){return window.ClubSport?.assignment?window.ClubSport.assignment(data,r,m,match):{id:[data.freeTournament?'free':'club',data.started,r,m,match.startedAt].join(':'),tournament:String(data.started),frameTimeLimitMinutes:data.frameTimeLimitMinutes??0,round:r,index:m,names:match.players.map(id=>data.players[id]),players:[...match.players],rules:data.framesPerMatch!=null?{framesPerMatch:data.framesPerMatch}:{target:data.target}}}
  function forMatch(data,r,m,match){
    const a=assignment(data,r,m,match),remote=boards.find(board=>board.assignment?.id===a.id);
    if(remote)return {...remote,assignment:{...remote.assignment,frameTimeLimitMinutes:data.frameTimeLimitMinutes??0},startedAt:match.startedAt,stoppedAt:match.finishedAt??data.ended??null};
    let state=match.scoreMonitor?.state??model.initial();
    try{model.derive(state,a.rules)}catch{state=model.initial()}
    if(match.result&&!model.derive(state,a.rules).complete)state=model.command(state,a.rules,{type:'manual',frames:match.result.frames,breaks:match.result.breaks,at:match.finishedAt??Date.now()});
    return {startedAt:match.startedAt,stoppedAt:match.finishedAt??data.ended??null,slot:match.table,tableNumber:match.table,assignment:a,state,enabled:!data.ended,_local:window.snookerTableSync?.role!=='owner'};
  }
  async function send(board,action){
    if(busy)return;busy=true;
    popup.querySelectorAll('button').forEach(el=>el.disabled=true);
    try{
      if(board._local){
        const latest=bridge.current?.rounds[board.assignment.round]?.matches[board.assignment.index];
        if(!latest||latest.startedAt==null||assignment(bridge.current,board.assignment.round,board.assignment.index,latest).id!==board.assignment.id||(latest.scoreMonitor?.state?.revision??board.state.revision)!==board.state.revision)throw Error('Spielstand wurde geändert. Bitte erneut öffnen.');
        if(action.type==='undo'&&window.PoolPlanner?.is(bridge.current)&&window.PoolPlanner.locked(bridge.current,latest)&&model.derive(board.state,board.assignment.rules).complete)throw Error('Eine Folgebegegnung wurde bereits gestartet. Ergebnis kann nicht mehr zurückgenommen werden.');
        bridge.applyBoard({...board,forceResult:action.type==='undo'||action.type==='redo',state:model.command(board.state,board.assignment.rules,{...action,at:Date.now()})});
      }else{
        const service=window.snookerTableSync;
        if(!service?.role)throw Error('Tischverbindung wird noch vorbereitet.');
        await service.command(board.slot,board.assignment.id,board.state.revision,action);
      }
      status('Eingabe gespeichert.');
      reconcile();closePopup();
    }catch(err){status(err.message);document.getElementById('tableInputStatus').textContent=err.message}
    finally{busy=false;popup.querySelectorAll('button').forEach(el=>el.disabled=false)}
  }
  function winner(board,player,pendingPoints=null){
    if(busy||!board.enabled)return;
    const value=model.derive(board.state,board.assignment.rules);
    if(value.complete)return;
    if(!board._local&&!boards.some(b=>b.assignment?.id===board.assignment.id&&b.enabled)){
      status('Der Tisch wird noch verbunden. Bitte kurz warten.');return;
    }
    if(board.assignment.id.startsWith('single:')&&!confirm(`Frame-Sieg für ${board.assignment.names[player]} bestätigen?`))return;
    send(board,{type:'frame',player,...(pendingPoints?{pendingPoints}:{})});
  }
  function finishButtons(board,value){
    if(board.assignment.id.startsWith('single:')||value.complete)return '';
    const frames=value.disciplineFrames??value.frames;
    return '<div class="monitorActions monitorFinishActions">'+board.assignment.names.map((name,i)=>`<button type="button" class="monitorMatchWinner" data-monitor-finish="${i}" data-monitor-slot="${board.slot}" ${board.enabled&&frames[i]>frames[1-i]?'':'disabled'}>Match-Sieger: ${escape(name)}</button>`).join('')+'</div><p class="small">Vorzeitig beenden: Match-Sieger übernimmt den erreichten Frame-Stand.'+(value.currentDiscipline&&!board.assignment.disciplineId?' Danach folgt die nächste gewählte Disziplin.':'')+'</p>';
  }
  function openPopup(board,player){
    if(!board.enabled)return;
    if(!board._local&&!boards.some(b=>b.assignment?.id===board.assignment.id&&b.enabled)) {status('Der Tisch wird noch verbunden. Bitte kurz warten.');return}
    const current=model.derive(board.state,board.assignment.rules);
    if(current.currentDiscipline&&current.currentDiscipline.id!=='14'){winner(board,player);return;}
    popupBoard=board;popupPlayer=player;input().value='';
    document.getElementById('tableInputName').textContent=board.assignment.names[player];
    document.getElementById('tableInputStatus').textContent='';
    const summary=model.derive(board.state,board.assignment.rules);
    popup.querySelector('[data-popup-frame]').hidden=!summary.currentDiscipline;
    const disabled=summary.complete;
    document.getElementById('tableInputSubmit').disabled=disabled;
    popup.showModal();popup.querySelector('[data-close]').focus({preventScroll:true});
  }
  document.getElementById('tableInputSubmit').onclick=()=>{
    if(!popupBoard||busy)return;
    const value=Number(input().value);
    if(!input().value||!Number.isInteger(value)||value<1||value>(popupBoard.assignment.rules.sport==='pool'?9999:147)){document.getElementById('tableInputStatus').textContent=popupBoard.assignment.rules.sport==='pool'?'Bitte 1 bis 9999 Punkte eingeben.':'Bitte 1 bis 147 Punkte eingeben.';return}
    send(popupBoard,{type:'points',player:popupPlayer,value});
  };
  function card(board,compact=false){
    if(!board?.assignment)return `<article class="monitorCard"><h3>Tisch ${board?.slot??''}</h3><p>Warten auf eine gestartete Partie.</p></article>`;
    const value=model.derive(board.state,board.assignment.rules);
    if(board.assignment.rules.sport==='pool')return poolCard(board,value);
    return `<article class="monitorCard frameLimitTarget ${compact?'monitorCompact':''}"><h3>Tisch ${board.tableNumber} · ${value.complete?'Partie beendet':'Frame '+(value.frames[0]+value.frames[1]+1)}</h3>
    <div class="monitorPlayers">${board.assignment.names.map((name,i)=>`<div class="monitorPlayerColumn"><button type="button" class="monitorScoreButton" data-monitor-player="${i}" data-monitor-slot="${board.slot}" ${board.enabled&&!value.complete?'':'disabled'}><span class="monitorName">${escape(name)}</span><strong class="monitorPoints">${value.scores[i]}</strong><span>Frames <b>${value.frames[i]}</b></span><span>HB: ${highestBreak(value.breaks[i])}</span></button><button type="button" class="monitorFrameWinner" data-monitor-winner="${i}" data-monitor-slot="${board.slot}" ${board.enabled&&!value.complete?'':'disabled'}>Frame-Sieger: ${escape(name)}</button></div>`).join('')}</div>
    ${finishButtons(board,value)}<div>${frameWarningMarkup(board)}<button type="button" data-monitor-warning-off="${board.slot}" hidden>Warnung aus</button></div><p class="small">${board.assignment.rules.framesPerMatch!=null?(board.assignment.rules.bestOf?'BO '+board.assignment.rules.framesPerMatch:board.assignment.rules.framesPerMatch+' Frames insgesamt'):'Bis '+board.assignment.rules.target+' Gewinnframes'}${value.complete?' · Ergebnis '+value.frames.join(':'):''}</p>
    <div class="monitorActions"><button type="button" data-monitor-undo="${board.slot}" ${board.state.cursor&&board.enabled?'':'disabled'}>↶ Zurück</button><button type="button" data-monitor-redo="${board.slot}" ${board.state.cursor<board.state.events.length&&board.enabled?'':'disabled'}>Vor ↷</button></div>
</article>`;
  }
  function poolCard(board,value){
    const d=value.currentDiscipline,points=d.id==='14',current=value.disciplineFrames;
    return `<article class="monitorCard frameLimitTarget"><h3>Tisch ${board.tableNumber}${board.assignment.poolRound?' · Runde '+board.assignment.poolRound:''} · ${escape(d.label)} · ${value.complete?(board.assignment.disciplineId?'Disziplin beendet':'Partie beendet'):'Frame '+(current[0]+current[1]+1)}</h3><p>${board.assignment.disciplineId?'Disziplinergebnis':'Gesamtergebnis'} <strong>${value.frames.join(' : ')}</strong> · ${points?'Ziel '+d.targetPoints+' Punkte':(board.assignment.rules.bestOf?'BO '+d.frames:d.frames+' Frames insgesamt')}</p>${value.targetReached?'<p role="status" class="poolTargetReached">Punkte erreicht – Sieger bestätigen</p>':''}<div class="monitorPlayers">${board.assignment.names.map((name,i)=>`<div class="monitorPlayerColumn"><button type="button" class="monitorScoreButton" data-monitor-player="${i}" data-monitor-slot="${board.slot}" ${board.enabled&&!value.complete?'':'disabled'}><span class="monitorName">${escape(name)}</span><strong class="monitorPoints">${points?value.scores[i]:current[i]}</strong><span>${points?'Punkte':'Frames · '+escape(d.label)}</span>${points?`<span>HB ${highestBreak(value.breaks[i])}</span>`:''}</button>${points||board.assignment.id.startsWith('single:')?`<button type="button" class="monitorFrameWinner" data-monitor-winner="${i}" data-monitor-slot="${board.slot}" ${board.enabled&&!value.complete?'':'disabled'}>Frame-Sieger: ${escape(name)}</button>`:''}${points&&!value.complete?`<button type="button" data-pool-foul="${i}" data-monitor-slot="${board.slot}" ${board.enabled?'':'disabled'}>Foul −1 Punkt</button><button type="button" data-pool-penalty="${i}" data-monitor-slot="${board.slot}" ${board.enabled?'':'disabled'}>Zusatzstrafe −15</button>`:''}</div>`).join('')}</div>${finishButtons(board,value)}<p class="small">${points?'Namen antippen für Punkte / Break.':'Namen antippen, um einen Frame zu vergeben.'}</p><div>${frameWarningMarkup(board)}<button type="button" data-monitor-warning-off="${board.slot}" hidden>Warnung aus</button></div><div class="monitorActions"><button type="button" data-monitor-undo="${board.slot}" ${board.state.cursor&&board.enabled?'':'disabled'}>↶ Zurück</button><button type="button" data-monitor-redo="${board.slot}" ${board.state.cursor<board.state.events.length&&board.enabled?'':'disabled'}>Vor ↷</button></div>${window.ClubSport.history(value,board.assignment.names)}</article>`;
  }
  const localWarningStorageKey='snooker-table-local-warning-v1';
  let localWarningMute='';
  try{localWarningMute=window.localStorage.getItem(localWarningStorageKey)||''}catch{}
  function warningFrameKey(board){
    let frame='first';
    board.state.events.slice(0,board.state.cursor).forEach((event,index)=>{if(event.type==='frame'||event.type==='finish')frame=index+':'+event.at});
    return (window.snookerTableSync?.owner??'')+'|'+board.assignment.id+'|'+frame;
  }
  function locallyMuted(board){return tableSlot!==null&&localWarningMute===warningFrameKey(board)}
  function muteWarning(board){
    if(tableSlot!==null){
      localWarningMute=warningFrameKey(board);
      try{window.localStorage.setItem(localWarningStorageKey,localWarningMute)}catch{}
      status('Warnung nur auf diesem Tischgerät ausgeschaltet.');renderTable();return;
    }
    return send(board,{type:'warningOff'});
  }
  function bind(container,list){
    for(const [attribute,amount] of [['foul',1],['penalty',15]])container.querySelectorAll('[data-pool-'+attribute+']').forEach(b=>b.onclick=()=>{const board=list.find(x=>x.slot===Number(b.dataset.monitorSlot));if(board&&(!board.assignment.id.startsWith('single:')||confirm(amount+' Strafpunkt(e) abziehen?')))send(board,{type:'foul',player:Number(b.dataset[attribute==='foul'?'poolFoul':'poolPenalty']),value:amount})});
    container.querySelectorAll('[data-monitor-warning-off]').forEach(b=>b.onclick=()=>{const board=list.find(x=>x.slot===Number(b.dataset.monitorWarningOff));if(board)muteWarning(board)});
    container.querySelectorAll('[data-monitor-player]').forEach(b=>b.onclick=()=>{const board=list.find(x=>x.slot===Number(b.dataset.monitorSlot));if(board)openPopup(board,Number(b.dataset.monitorPlayer))});
    container.querySelectorAll('[data-monitor-winner]').forEach(b=>b.onclick=()=>{const board=list.find(x=>x.slot===Number(b.dataset.monitorSlot));if(board)winner(board,Number(b.dataset.monitorWinner))});
    container.querySelectorAll('[data-monitor-finish]').forEach(b=>b.onclick=()=>{const board=list.find(x=>x.slot===Number(b.dataset.monitorSlot));if(board&&board.enabled&&!busy)send(board,{type:'finish',player:Number(b.dataset.monitorFinish)});});
    for(const action of ['undo','redo'])container.querySelectorAll(`[data-monitor-${action}]`).forEach(b=>b.onclick=()=>{const board=list.find(x=>x.slot===Number(b.dataset[action==='undo'?'monitorUndo':'monitorRedo']));if(board)send(board,{type:action})});
  }
  function frameWarningMarkup(board){
    const a=board.assignment,start=board.startedAt??Number(a.id?.split(':').at(-1));
    const w=model.frameWarning(board.state,a.rules,start,a.frameTimeLimitMinutes,Date.now(),Boolean(board.stoppedAt));
    if(locallyMuted(board)){w.overdue=false;w.startedAt=null;}
    return `<span class="frameLimitWarning" data-frame-warning data-frame-start="${w.startedAt??''}" data-frame-limit="${w.limit}" ${w.overdue?'':'hidden'}>⚠ Spielzeit überschritten</span>`;
  }
  function updateFrameWarnings(){
    for(const warning of document.querySelectorAll('[data-frame-warning]')){
      const start=warning.dataset.frameStart,limit=Number(warning.dataset.frameLimit);
      const overdue=start!==''&&limit>0&&Date.now()-Number(start)>limit*60000;
      warning.hidden=!overdue;const target=warning.closest('.monitorRow')??warning;target.classList.toggle('frameLimitExceeded',overdue);
      const off=(warning.closest('.monitorRowGroup')??warning.parentElement).querySelector('[data-monitor-warning-off]');if(off)off.hidden=!overdue;
    }
  }
  function elapsedTime(start,stop,now=Date.now()){
    if(!Number.isFinite(start))return '–';
    const seconds=Math.max(0,Math.floor(((Number.isFinite(stop)?stop:now)-start)/1000));
    return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
  }
  function clockMarkup(board,value){const start=board.startedAt??Number(board.assignment.id?.split(':').at(-1)),stop=value.finishedAt??board.stoppedAt;return `<span class="monitorRowTime">Spielzeit <time data-monitor-start="${start}" ${Number.isFinite(stop)?`data-monitor-stop="${stop}"`:''}>${elapsedTime(start,stop)}</time></span>`}
  function updateMonitorClocks(){for(const clock of document.querySelectorAll('[data-monitor-start]'))clock.textContent=elapsedTime(Number(clock.dataset.monitorStart),clock.dataset.monitorStop===undefined?null:Number(clock.dataset.monitorStop));}
  setInterval(()=>{updateMonitorClocks();updateFrameWarnings()},1000);
  function highestBreak(list){const valid=list.filter(n=>Number.isFinite(n)&&n>=20);return valid.length?Math.max(...valid):'–'}
  function overviewRow(board){
    if(!board?.assignment)return `<article class="monitorRow monitorRowWaiting"><span class="monitorRowInfo"><span class="monitorRowTable">Tisch ${board.slot}</span><span class="monitorRowNames">Warten auf eine Partie</span></span><strong class="monitorRowScore">– : –</strong></article>`;
    const value=model.derive(board.state,board.assignment.rules);
    const names=board.assignment.names.map(escape);
    if(value.currentDiscipline)return poolOverviewRow(board,value,names);
    return `<button type="button" class="monitorRow frameLimitTarget" data-monitor-detail="${board.slot}" aria-label="Tisch ${board.slot}: ${names.join(' gegen ')}, Punkte ${value.scores.join(' zu ')}, Details öffnen"><span class="monitorRowInfo"><span class="monitorRowTable">Tisch ${board.tableNumber}<span class="monitorRowPhase">${value.complete?'Beendet':'Frame '+(value.frames[0]+value.frames[1]+1)}</span></span><span class="monitorRowNames">${names.join(' – ')}</span><span class="monitorRowMeta">Frames <b>${value.frames.join(' : ')}</b><span>HB <b>${value.breaks.map(highestBreak).join(' : ')}</b></span></span>${clockMarkup(board,value)}${frameWarningMarkup(board)}</span><strong class="monitorRowScore">${value.scores[0]}<span>:</span>${value.scores[1]}</strong></button>`;
  }
  function poolOverviewRow(board,value,names){const d=value.currentDiscipline,points=d.id==='14',score=points?value.scores:value.disciplineFrames;return `<button type="button" class="monitorRow frameLimitTarget" data-monitor-detail="${board.slot}"><span class="monitorRowInfo"><span class="monitorRowTable">Tisch ${board.tableNumber}<span class="monitorRowPhase">${(board.assignment.poolRound?'R'+board.assignment.poolRound+' · ':'')+(value.complete?(board.assignment.disciplineId?escape(d.label)+' · beendet':'Beendet'):escape(d.label))}</span></span><span class="monitorRowNames">${names.join(' – ')}</span><span class="monitorRowMeta">${board.assignment.disciplineId?'Frames':'Gesamt'} <b>${value.frames.join(' : ')}</b>${points?'<span>HB '+value.breaks.map(highestBreak).join(' : ')+'</span>':''}</span>${clockMarkup(board,value)}${frameWarningMarkup(board)}</span><strong class="monitorRowScore">${score[0]}<span>:</span>${score[1]}</strong></button>`}
  const detail=document.createElement('dialog');detail.id='monitorDetailDialog';detail.className='tournamentDialog monitorDetailDialog';document.body.append(detail);
  function closeDetail(){detailSlot=null;if(detail.open)detail.close()}
  async function prepareMatch(data,r,m){
    const service=window.snookerTableSync,match=data.rounds[r].matches[m];
    if(service?.role!=='owner'||!service.sync)return;
    const expected=assignment(data,r,m,match).id;
    try{
      await service.sync(data);
      await service.refresh?.(match.table);
      if(service.role!=='owner')return;
      if(Array.isArray(service.boards))boards=service.boards;
      const latest=bridge.current,live=latest?.rounds?.[r]?.matches?.[m];
      if(live&&detailSlot===match.table&&assignment(latest,r,m,live).id===expected)renderDetail([forMatch(latest,r,m,live)]);
    }catch(err){status('Tischverbindung: '+err.message);}
  }
  function renderDetail(list){
    if(detailSlot===null)return;
    const board=list.find(b=>b.slot===detailSlot);if(!board?.assignment){closeDetail();return}
    detail.innerHTML='<button type="button" data-detail-close>← Zur Übersicht</button>'+card(board);
    detail.querySelector('[data-detail-close]').onclick=closeDetail;bind(detail,[board]);
    if(window.snookerTableSync?.role==='owner'&&!boards.some(b=>b.assignment?.id===board.assignment.id&&b.enabled)){
      for(const button of detail.querySelectorAll('button'))if(!button.hasAttribute('data-detail-close'))button.disabled=true;
      const notice=document.createElement('p');notice.setAttribute('role','status');notice.textContent='Tischverbindung wird vorbereitet. Die Eingabe wird nach der Synchronisierung freigegeben.';detail.prepend(notice);
      const retry=document.createElement('button');retry.type='button';retry.textContent='Tischverbindung erneut laden';retry.onclick=()=>{const data=bridge.current;if(data)prepareMatch(data,board.assignment.round,board.assignment.index);};detail.prepend(retry);
    }
  }
  detail.oncancel=e=>{e.preventDefault();closeDetail()};detail.addEventListener('click',e=>{if(e.target===detail)closeDetail()});
  function renderOverview(container,data){
    const all=data.rounds.flatMap((round,r)=>round.matches.map((match,m)=>({match,r,m}))).filter(({match})=>match.table&&match.startedAt);
    const list=[];
    for(let slot=1;slot<=data.tables;slot++){
      const items=all.filter(x=>x.match.table===slot),current=items.find(x=>!x.match.result)??items.at(-1);
      if(current)list.push(forMatch(data,current.r,current.m,current.match));else list.push({slot});
    }
    const live=window.snookerTableSync?.role==='owner';
    container.innerHTML=`<div class="card monitorOverview"><div class="monitorOverviewHeader"><h3>Score Monitor</h3><span class="monitorLive ${live?'isLive':''}">${live?'● Live':'Lokal'}</span><button type="button" data-monitor-full>Vollbild ${document.body.classList.contains('monitorOverviewFullscreen')?'aus':'an'}</button><button type="button" data-table-codes>Tischcodes</button></div><p data-monitor-message role="status" class="monitorOverviewStatus">${escape(message)}</p><div class="monitorOverviewGrid">${list.map(board=>`<div class="monitorRowGroup">${overviewRow(board)}${board.assignment?`<button type="button" class="monitorMuteButton" data-monitor-warning-off="${board.slot}" hidden>Warnung aus</button>`:''}</div>`).join('')}</div><p class="monitorOverviewHint">Tisch antippen für Eingabe &amp; Details</p></div>`;
    container.querySelectorAll('[data-monitor-detail]').forEach(button=>button.onclick=()=>{detailSlot=Number(button.dataset.monitorDetail);renderDetail(list);if(!detail.open)detail.showModal()});
    bind(container,list);renderDetail(list);updateFrameWarnings();
    container.querySelector('[data-table-codes]').onclick=()=>window.snookerTableCodes();
    container.querySelector('[data-monitor-full]').onclick=()=>{const on=document.body.classList.toggle('monitorOverviewFullscreen');container.querySelector('[data-monitor-full]').textContent=on?'Vollbild aus':'Vollbild an'};
  }

  function renderTable(){
    if(!tableSlot)return;
    const board=boards.find(b=>b.slot===tableSlot);
    tablePage.innerHTML=`<div class="monitorTableHeader"><h2>Tisch ${tableSlot}</h2><button type="button" data-table-leave>Tisch verlassen</button><button type="button" data-table-refresh>↻ Aktualisieren</button><button type="button" data-table-full>Vollbild ${document.body.classList.contains('tableMonitorFullscreen')?'aus':'an'}</button></div><p data-monitor-message role="status">${escape(message||(navigator.onLine?'Tischverbindung wird hergestellt …':'Offline – für den Tischbetrieb bitte Internet verbinden.'))}</p>${landing?'<button type="button" class="primary" data-table-return>Zur Partie</button>':card(board??{slot:tableSlot})}`;
    if(board?.assignment)bind(tablePage,[board]);updateFrameWarnings();
    tablePage.querySelector('[data-table-leave]').onclick=async()=>{if(!confirm('Tischverbindung auf diesem Gerät beenden und Tisch freigeben?'))return;try{await window.snookerTableBackend.leave()}catch(err){status('Trennen fehlgeschlagen. Bitte Internetverbindung prüfen oder die Verbindung beim Spielleiter zurücksetzen lassen. '+err.message)}};
    tablePage.querySelector('[data-table-refresh]').onclick=async e=>{
      const button=e.currentTarget;button.disabled=true;
      status('Tischstand wird aktualisiert …');
      try{status(await window.snookerTableBackend.refresh())}catch(err){status('Aktualisieren fehlgeschlagen: '+(err.message||err))}
      finally{button.disabled=false}
    };
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
    if(window.PoolSingle?.active)window.PoolSingle.renderBoard();
    if(detailSlot!==null){const data=bridge.current;const all=(data?.rounds??[]).flatMap((round,r)=>round.matches.map((match,m)=>({match,r,m}))).filter(x=>x.match.table===detailSlot&&x.match.startedAt);const current=all.find(x=>!x.match.result)??all.at(-1);if(current)renderDetail([forMatch(data,current.r,current.m,current.match)]);else closeDetail();}
    bridge.refreshHistory?.();
    const overview=document.getElementById('tournamentMonitors');if(overview&&bridge.current&&!window.PoolSingle?.active)renderOverview(overview,bridge.current);
  }
  function historyBoards(direction){
    const data=bridge.current;if(!data||data.ended)return [];
    const list=[];
    for(let slot=1;slot<=data.tables;slot++){
      const all=data.rounds.flatMap((round,r)=>round.matches.map((match,m)=>({r,m,match}))).filter(x=>x.match.table===slot&&x.match.startedAt!=null);
      const current=all.find(x=>!x.match.result)??all.at(-1);if(!current)continue;
      const board=forMatch(data,current.r,current.m,current.match);if(!board.enabled)continue;
      if(direction<0&&window.PoolPlanner?.is(data)&&window.PoolPlanner.locked(data,current.match)&&model.derive(board.state,board.assignment.rules).complete)continue;
      const state=board.state,index=direction<0?state.cursor-1:state.cursor;
      if(index>=0&&index<state.events.length)list.push({board,at:state.events[index].at});
    }
    return list.sort((a,b)=>b.at-a.at);
  }
  window.snookerMonitors=Object.freeze({activateTable,renderOverview,reconcile,
    renderSingle(container,board){container.innerHTML=card(board);bind(container,[board]);updateFrameWarnings()},
    openMatch(data,r,m,match){const board=forMatch(data,r,m,match);const current=boards.find(b=>b.slot===board.slot);if(match.result&&current&&current.assignment?.id!==board.assignment.id){status('Dieser Tisch zeigt bereits eine andere Partie. Die alte Spielhistorie bleibt einsehbar.');alert('Diese Partie ist archiviert. Korrekturen nur vor dem nächsten Tischmatch durchführen.');return;}detailSlot=board.slot;renderDetail([board]);if(!detail.open)detail.showModal();if(!match.result&&!data.ended&&!boards.some(b=>b.assignment?.id===board.assignment.id&&b.enabled))void prepareMatch(data,r,m);},
    canStep(direction){return historyBoards(direction).length>0},
    async step(direction){
      if(window.snookerTableSync?.role==='owner')await window.snookerTableSync.idle();
      const entry=historyBoards(direction)[0];if(!entry)throw Error('Keine Eingabe zum Zurücknehmen oder Wiederholen.');
      const board=entry.board,action={type:direction<0?'undo':'redo'};
      if(board._local){bridge.applyBoard({...board,forceResult:true,state:model.command(board.state,board.assignment.rules,{...action,at:Date.now()})})}
      else {const result=await window.snookerTableSync.command(board.slot,board.assignment.id,board.state.revision,action);bridge.applyBoard(result)}
      status(direction<0?'Eingabe synchron zurückgenommen.':'Eingabe synchron wiederholt.');
    },
    silence(index){const data=bridge.current;if(!data)return;const [r,m]=index.split(':').map(Number),match=data.rounds[r]?.matches[m];if(match?.table)return send(forMatch(data,r,m,match),{type:'warningOff'})},
    deactivate(){closeDetail();tableSlot=null;boards=[];tablePage.hidden=true;closePopup();document.body.classList.remove('tableDeviceMode','tableMonitorFullscreen','monitorOverviewFullscreen')},
    tableHome(){landing=true;document.body.classList.remove('tableMonitorFullscreen');closePopup();renderTable()},
    async commitManual(index,result){
      const data=bridge.current;if(!data)return;
      const [r,m]=index.split(':').map(Number),match=data.rounds[r]?.matches[m];if(!match?.table)return;
      const board=forMatch(data,r,m,match);
      if(!board._local&&!boards.some(b=>b.assignment?.id===board.assignment.id&&b.enabled))throw Error('Tischverbindung wird vorbereitet. Bitte kurz warten.');
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
  window.addEventListener('snooker-tournament-received',()=>queueMicrotask(()=>window.snookerTableSync?.sync(('tournamentCurrent' in bridge?bridge.tournamentCurrent:bridge.current))));
  window.addEventListener('snooker-table-owner-ready',()=>window.snookerTableSync?.sync(('tournamentCurrent' in bridge?bridge.tournamentCurrent:bridge.current)));
  window.addEventListener('snooker-table-boards',({detail})=>{
    const previousAssignment=boards.find(b=>b.slot===tableSlot)?.assignment?.id;
    boards=detail.boards;
    if(popup.open&&popupBoard&&!popupBoard._local){const next=boards.find(b=>b.slot===popupBoard.slot);if(next?.assignment?.id!==popupBoard.assignment.id||next?.state.revision!==popupBoard.state.revision){closePopup();status('Spielstand aktualisiert.')}}
    if(tableSlot){const board=boards.find(b=>b.slot===tableSlot);if(board?.assignment?.id&&board.assignment.id!==previousAssignment)landing=false;status(board?.assignment?'Live verbunden.':'Verbunden · Warten auf die Turnierleitung.');}
    reconcile();
  });
  window.addEventListener('snooker-table-synced',()=>status('Tischstände synchronisiert.'));
  window.addEventListener('snooker-table-error',({detail})=>{status(detail);renderTable()});
  document.addEventListener('click',e=>{if(e.target.closest('.appTabStrip > button'))document.body.classList.remove('monitorOverviewFullscreen')},true);
  window.addEventListener('offline',()=>status('Offline – Eingaben benötigen eine Verbindung. Der angezeigte Stand kann veraltet sein.'));
})();
