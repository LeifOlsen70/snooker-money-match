(() => {
 'use strict';
 const KIND='round-robin-disciplines-v1';
 const is=data=>data?.poolSchedule===KIND;
 function rules(data,match){
  if(!is(data)||!match)return data.poolRules;
  const d=data.poolRules.disciplines.find(d=>d.id===match.disciplineId);
  if(!d)throw Error('Ungültige Disziplinzuordnung.');
  return {sport:'pool',framesPerMatch:d.frames,disciplines:[{...d}],...(data.poolRules.bestOf===true&&d.id!=='14'?{bestOf:true}:{})};
 }
 function round(data){
  const count=data.players.length,n=count+count%2,ring=Array.from({length:n},(_,i)=>i<count?i:null),pairs=[];
  for(let step=0;step<n-1;step++){
   for(let i=0;i<n/2;i++){const a=ring[i],b=ring[n-1-i];if(a!==null&&b!==null)pairs.push([Math.min(a,b),Math.max(a,b)])}
   ring.splice(1,0,ring.pop());
  }
  return {bye:null,matches:data.poolRules.disciplines.flatMap(d=>pairs.map(players=>({players:[...players],disciplineId:d.id,table:null,result:null})))};
 }
 function position(data,match){for(let r=0;r<data.rounds.length;r++){const m=data.rounds[r].matches.indexOf(match);if(m>=0)return {r,m,d:data.poolRules.disciplines.findIndex(d=>d.id===match.disciplineId)}}return null}
 function blocked(data,match){
  const here=position(data,match);if(!here)return true;
  return data.rounds.some((r,ri)=>r.matches.some(other=>{
   if(other===match||!other.players.some(id=>match.players.includes(id)))return false;
   if(!other.result&&other.table)return true;
   const phase=data.poolRules.disciplines.findIndex(d=>d.id===other.disciplineId);
   return !other.result&&(ri<here.r||(ri===here.r&&phase<here.d));
  }));
 }
 function ready(data,match){return !data.ended&&!match.result&&!match.table&&!match.paused&&!blocked(data,match)}
 function locked(data,match){
  const here=position(data,match);if(!here)return false;
  return data.rounds.some((r,ri)=>r.matches.some(other=>{
   if(other===match||other.startedAt==null||!other.players.some(id=>match.players.includes(id)))return false;
   const phase=data.poolRules.disciplines.findIndex(d=>d.id===other.disciplineId);
   return ri>here.r||ri===here.r&&(phase>here.d||phase===here.d&&(!other.result||other.finishedAt>match.finishedAt));
  }));
 }
 function freeTables(data){const used=new Set(data.rounds.flatMap(r=>r.matches).filter(m=>m.table&&!m.result).map(m=>m.table));return Array.from({length:data.tables},(_,i)=>i+1).filter(t=>!used.has(t))}
 function next(data,now=Date.now()){
  if(!is(data)||data.ended||data.finishLastRound||data.limit!==null&&data.rounds.length>=data.limit||data.limit===null&&data.endAt!=null&&now>=data.endAt||!freeTables(data).length)return null;
  if(data.rounds.some(r=>r.matches.some(m=>ready(data,m))))return null;
  const last=data.rounds.at(-1),final=data.poolRules.disciplines.at(-1).id;
  if(!last.matches.every(m=>m.result)&&!last.matches.some(m=>m.disciplineId===final&&m.startedAt!=null))return null;
  const pending=new Set(data.rounds.flatMap(r=>r.matches).filter(m=>!m.result).flatMap(m=>m.players));
  const candidate=round(data);if(!candidate.matches.some(m=>m.players.every(id=>!pending.has(id))))return null;
  return candidate;
 }
 function scoringRounds(data,rounds=data.rounds){if(!is(data))return rounds;return rounds.map(round=>{
  const grouped=new Map();for(const match of round.matches){const key=match.players.join(':');if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(match)}
  const matches=[...grouped.values()].map(parts=>{
   const result=parts.length===data.poolRules.disciplines.length&&parts.every(m=>m.result)?{frames:[0,0],breaks:[[],[]]}:null;
   if(result)for(const m of parts)for(let p=0;p<2;p++){result.frames[p]+=m.result.frames[p];result.breaks[p].push(...m.result.breaks[p])}
   return {players:parts[0].players,result,eloAt:result?Math.max(...parts.map(m=>m.eloAt??m.finishedAt??0)):null};
  });return {bye:null,matches};
 })}
 function validate(data,model){
  if(!is(data))return true;
  const expected=round(data).matches,keys=new Set(expected.map(m=>m.disciplineId+':'+m.players.join(':'))),tables=new Set(),players=new Set();
  for(const r of data.rounds){
   if(!r||r.bye!==null||!Array.isArray(r.matches)||r.matches.length!==keys.size)return false;
   const seen=new Set();
   for(const m of r.matches){
    if(!m||!Array.isArray(m.players)||m.players.length!==2)return false;
    const key=m.disciplineId+':'+m.players.join(':');if(!keys.has(key)||seen.has(key))return false;seen.add(key);
    if(m.table!==null&&(!Number.isInteger(m.table)||m.table<1||m.table>data.tables))return false;
    if(m.paused!=null&&typeof m.paused!=='boolean'||m.paused&&(m.table!==null||m.result!==null))return false;
    for(const field of ['startedAt','finishedAt','eloAt'])if(m[field]!=null&&(!Number.isFinite(m[field])||m[field]<0))return false;
    if(m.table!==null&&m.startedAt==null)return false;
    if(m.startedAt!=null&&m.table===null)return false;
    if(!m.result&&m.table){if(tables.has(m.table)||m.players.some(p=>players.has(p)))return false;tables.add(m.table);m.players.forEach(p=>players.add(p))}
    try{
     let summary=null;if(m.scoreMonitor){if(typeof m.scoreMonitor.assignmentId!=='string')return false;summary=model.derive(m.scoreMonitor.state,rules(data,m));model.derive({...m.scoreMonitor.state,cursor:m.scoreMonitor.state.events.length},rules(data,m));}
     if(m.result){if(!summary?.complete||JSON.stringify(summary.frames)!==JSON.stringify(m.result.frames)||JSON.stringify(summary.breaks)!==JSON.stringify(m.result.breaks))return false;}
     else if(summary?.complete)return false;
    }catch{return false;}
   }
  }
  return true;
 }
 window.PoolPlanner=Object.freeze({KIND,is,rules,round,position,blocked,ready,locked,freeTables,next,scoringRounds,validate});
})();
