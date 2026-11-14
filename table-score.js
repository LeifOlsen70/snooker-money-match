// Shared deterministic score model. All state is scoped to one assignment.
((root)=>{
  'use strict';
  const copy=value=>JSON.parse(JSON.stringify(value));
  function initial(revision=0){return {events:[],cursor:0,revision}}
  function complete(frames,rules){return rules.framesPerMatch!=null?frames[0]+frames[1]===rules.framesPerMatch:Math.max(...frames)===rules.target}
  function derive(state,rules){
    if(!state||!Array.isArray(state.events)||state.events.length>2000||!Number.isInteger(state.cursor)||state.cursor<0||state.cursor>state.events.length||!Number.isInteger(state.revision)||state.revision<0)throw Error('Ungültiger Tischspielstand.');
    if(rules.framesPerMatch!=null?(!Number.isInteger(rules.framesPerMatch)||rules.framesPerMatch<1):(!Number.isInteger(rules.target)||rules.target<1))throw Error('Ungültige Frameregel.');
    const value={scores:[0,0],frames:[0,0],breaks:[[],[]],complete:false,finishedAt:null};
    for(const event of state.events.slice(0,state.cursor)){
      if(!event||!Number.isFinite(event.at)||event.at<0)throw Error('Ungültige Zeitangabe.');
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
  root.SnookerTableScore=Object.freeze({initial,derive,command,complete});
})(typeof window!=='undefined'?window:globalThis);
