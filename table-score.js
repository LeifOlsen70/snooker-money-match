// Shared deterministic score model. All state is scoped to one assignment.
((root)=>{
  'use strict';
  const copy=value=>JSON.parse(JSON.stringify(value));
  function initial(revision=0){return {events:[],cursor:0,revision}}
  function complete(frames,rules){return rules.framesPerMatch!=null?frames[0]+frames[1]===rules.framesPerMatch:Math.max(...frames)===rules.target}
  function derive(state,rules){
    if(rules?.sport==='pool')return derivePool(state,rules);
    if(!state||!Array.isArray(state.events)||state.events.length>2000||!Number.isInteger(state.cursor)||state.cursor<0||state.cursor>state.events.length||!Number.isInteger(state.revision)||state.revision<0)throw Error('Ungültiger Tischspielstand.');
    if(rules.framesPerMatch!=null?(!Number.isInteger(rules.framesPerMatch)||rules.framesPerMatch<1):(!Number.isInteger(rules.target)||rules.target<1))throw Error('Ungültige Frameregel.');
    const value={scores:[0,0],frames:[0,0],breaks:[[],[]],complete:false,finishedAt:null};
    for(const event of state.events.slice(0,state.cursor)){
      if(!event||!Number.isFinite(event.at)||event.at<0)throw Error('Ungültige Zeitangabe.');
      if(event.type==='warningOff')continue;
      if(event.type==='manual'){
        const f=event.frames,b=event.breaks,max=rules.framesPerMatch??rules.target;
        if(!Array.isArray(f)||f.length!==2||!f.every(n=>Number.isInteger(n)&&n>=0&&n<=max)||!complete(f,rules)||(rules.framesPerMatch==null&&f[0]===f[1])||!Array.isArray(b)||b.length!==2||!b.every(list=>Array.isArray(list)&&list.every(n=>Number.isInteger(n)&&n>=20&&n<=155)))throw Error('Ungültiges manuelles Ergebnis.');
        value.frames=[...f];value.breaks=copy(b);value.scores=[0,0];value.complete=true;value.finishedAt=event.at;continue;
      }
      if(![0,1].includes(event.player)||value.complete)throw Error('Die Partie ist bereits beendet oder die Eingabe ist ungültig.');
      if(event.type==='points'){
        if(!Number.isInteger(event.value)||event.value<1||event.value>147)throw Error('Bitte 1 bis 147 Punkte eingeben.');
        value.scores[event.player]+=event.value;
        if(event.value>=20)value.breaks[event.player].push(event.value);
      }else if(event.type==='frame'){
        if(event.pendingPoints){
          const points=event.pendingPoints;
          if(![0,1].includes(points.player)||!Number.isInteger(points.value)||points.value<1||points.value>147)throw Error('Ungültige Punkte beim Frame-Abschluss.');
          value.scores[points.player]+=points.value;
          if(points.value>=20)value.breaks[points.player].push(points.value);
        }
        value.frames[event.player]++;
        value.complete=complete(value.frames,rules);
        if(value.complete)value.finishedAt=event.at;
        else value.scores=[0,0];
      }else throw Error('Unbekannte Punkteaktion.');
    }
    return value;
  }
  function validPoolRules(rules){
    const ids=['8','9','10','14'];
    if(rules?.sport!=='pool'||!Array.isArray(rules.disciplines)||!rules.disciplines.length||rules.disciplines.length>4)throw Error('Ungültige Pool-Disziplinen.');
    let previous=-1,total=0;
    for(const d of rules.disciplines){const index=ids.indexOf(d.id);if(index<=previous||!Number.isInteger(d.frames)||d.frames<1||d.frames>50||(d.id==='14'&&(!Number.isInteger(d.targetPoints)||d.targetPoints<1||d.targetPoints>9999)))throw Error('Ungültige Disziplin oder Zielpunktzahl.');previous=index;total+=d.frames;}
    if(rules.framesPerMatch!==total)throw Error('Ungültige Gesamtframezahl.');
    return true;
  }
  function derivePool(state,rules){
    validPoolRules(rules);
    if(!state||!Array.isArray(state.events)||state.events.length>2000||!Number.isInteger(state.cursor)||state.cursor<0||state.cursor>state.events.length||!Number.isInteger(state.revision)||state.revision<0)throw Error('Ungültiger Pool-Spielstand.');
    const value={scores:[0,0],frames:[0,0],breaks:[[],[]],complete:false,finishedAt:null,disciplineIndex:0,
      disciplines:rules.disciplines.map(d=>({...d,frames:[0,0],breaks:[[],[]],frameHistory:[]}))};
    let frameBreaks=[[],[]];
    for(const event of state.events.slice(0,state.cursor)){
      if(!event||!Number.isFinite(event.at)||event.at<0)throw Error('Ungültige Zeitangabe.');
      if(event.type==='warningOff')continue;
      if(value.complete||![0,1].includes(event.player))throw Error('Die Partie ist beendet oder der Spieler ungültig.');
      const configured=rules.disciplines[value.disciplineIndex],current=value.disciplines[value.disciplineIndex];
      function points(player,n){
        if(configured.id!=='14'||![0,1].includes(player)||!Number.isInteger(n)||n<1||n>9999)throw Error('Punkteeingabe nur bei 14/1 endlos (1 bis 9999).');
        value.scores[player]+=n;
        if(n>=20){value.breaks[player].push(n);current.breaks[player].push(n);frameBreaks[player].push(n)}
      }
      if(event.type==='points')points(event.player,event.value);
      else if(event.type==='foul'){
        if(configured.id!=='14'||![1,15].includes(event.value))throw Error('Ungültiger Punktabzug.');
        value.scores[event.player]-=event.value;
      }else if(event.type==='frame'){
        if(event.pendingPoints)points(event.pendingPoints.player,event.pendingPoints.value);
        current.frames[event.player]++;value.frames[event.player]++;
        current.frameHistory.push({winner:event.player,scores:[...value.scores],breaks:copy(frameBreaks),at:event.at});frameBreaks=[[],[]];
        if(current.frames[0]+current.frames[1]===configured.frames)value.disciplineIndex++;
        value.complete=value.disciplineIndex===rules.disciplines.length;
        if(value.complete)value.finishedAt=event.at;else value.scores=[0,0];
      }else throw Error('Ungültige Pool-Aktion. Ergebnisse über das Zählwerk korrigieren.');
    }
    value.currentDiscipline=rules.disciplines[Math.min(value.disciplineIndex,rules.disciplines.length-1)];
    value.disciplineFrames=value.disciplines[Math.min(value.disciplineIndex,value.disciplines.length-1)].frames;
    value.targetReached=!value.complete&&value.currentDiscipline.id==='14'&&Math.max(...value.scores)>=value.currentDiscipline.targetPoints;
    return value;
  }
  function command(state,rules,action){
    derive(state,rules);
    const next=copy(state);
    if(action.type==='undo'){if(next.cursor<1)throw Error('Keine Eingabe zum Zurücknehmen.');next.cursor--}
    else if(action.type==='redo'){if(next.cursor>=next.events.length)throw Error('Keine Eingabe zum Wiederholen.');next.cursor++}
    else{
      if(next.cursor>=2000)throw Error('Die maximale Anzahl Eingaben dieser Partie ist erreicht.');
      next.events=next.events.slice(0,next.cursor);next.events.push(copy(action));next.cursor++;
    }
    next.revision++;
    derive(next,rules);return next;
  }
  function frameWarning(state,rules,startedAt,minutes,now=Date.now(),ended=false){
    const limit=Number(minutes)||0;
    if(ended||!Number.isFinite(startedAt)||limit<=0)return {overdue:false,startedAt:null,limit};
    const current=state??initial();
    if(derive(current,rules).complete)return {overdue:false,startedAt:null,limit};
    let start=startedAt;
    let muted=false;
    for(const event of current.events.slice(0,current.cursor)){if(event.type==='frame'){start=event.at;muted=false}else if(event.type==='warningOff')muted=true;}
    if(muted)return {overdue:false,startedAt:null,limit};
    return {overdue:now-start>limit*60000,startedAt:start,limit};
  }
  root.SnookerTableScore=Object.freeze({initial,derive,command,complete,frameWarning,validPoolRules});
})(typeof window!=='undefined'?window:globalThis);
