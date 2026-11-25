(() => {
 'use strict';
 const LEGACY='round-robin-disciplines-v1',KIND='round-robin-waves-v2';
 const is=data=>[LEGACY,KIND].includes(data?.poolSchedule);
 const waves=data=>data?.poolSchedule===KIND;
 function rules(data,match){
  if(!is(data)||!match)return data.poolRules;
  const d=data.poolRules.disciplines.find(d=>d.id===match.disciplineId);
  if(!d)throw Error('Ungültige Disziplinzuordnung.');
  return {sport:'pool',framesPerMatch:d.frames,disciplines:[{...d}],...(data.poolRules.bestOf===true&&d.id!=='14'?{bestOf:true}:{})};
 }
 function legacyRound(data){
  const count=data.players.length,n=count+count%2,ring=Array.from({length:n},(_,i)=>i<count?i:null),pairs=[];
  for(let step=0;step<n-1;step++){
   for(let i=0;i<n/2;i++){const a=ring[i],b=ring[n-1-i];if(a!==null&&b!==null)pairs.push([Math.min(a,b),Math.max(a,b)])}
   ring.splice(1,0,ring.pop());
  }
  return {bye:null,matches:data.poolRules.disciplines.flatMap(d=>pairs.map(players=>({players:[...players],disciplineId:d.id,table:null,result:null})))};
 }
 function wavePlans(data){
  const count=data.players.length,n=count+count%2,ring=[...(data.poolDraw??Array.from({length:count},(_,i)=>i))];if(n>count)ring.push(null);
  const plans=[];
  for(let index=0;index<n-1;index++){
   const pairs=[];let bye=null;
   for(let i=0;i<n/2;i++){const a=ring[i],b=ring[n-1-i];if(a==null||b==null)bye=a??b;else pairs.push([Math.min(a,b),Math.max(a,b)])}
   plans.push({bye,pairs,index});ring.splice(1,0,ring.pop());
  }return plans;
 }
 function makeWave(data,plan,cycle){return {bye:plan.bye,poolWave:{cycle,index:plan.index},matches:data.poolRules.disciplines.flatMap(d=>plan.pairs.map(players=>({players:[...players],disciplineId:d.id,table:null,result:null})))}}
 function round(data){
  if(!waves(data))return legacyRound(data);
  if(!data.poolDraw){data.poolDraw=data.players.map((_,i)=>i);for(let i=data.poolDraw.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[data.poolDraw[i],data.poolDraw[j]]=[data.poolDraw[j],data.poolDraw[i]];}}
  const plans=wavePlans(data),last=data.rounds.at(-1),cycle=last?.poolWave?.cycle??0;
  const used=new Set(data.rounds.filter(r=>r.poolWave?.cycle===cycle).map(r=>r.poolWave.index));
  let candidates=plans.filter(p=>!used.has(p.index)),nextCycle=cycle;
  if(!candidates.length){if(data.rounds.some(r=>r.matches.some(m=>!m.result)))return null;candidates=plans;nextCycle++;}
  const busy=new Set(data.rounds.flatMap(r=>r.matches).filter(m=>!m.result&&m.table).flatMap(m=>m.players));
  const freePairs=p=>p.pairs.filter(ids=>ids.every(id=>!busy.has(id))).length;
  candidates.sort((a,b)=>freePairs(b)-freePairs(a)||a.index-b.index);
  return makeWave(data,candidates[0],nextCycle);
 }
 // Split legacy all-against-all batches without losing scores or active assignment identities.
 function upgrade(data){
  if(data?.poolSchedule!==LEGACY||data.limit!==null||data.knockout)return false;
  const before=data.rounds;data.poolDraw=data.players.map((_,i)=>i);const plans=wavePlans(data),out=[];
  before.forEach((batch,cycle)=>{
   for(const plan of plans){
    const pairs=new Set(plan.pairs.map(p=>p.join(':'))),matches=[];
    batch.matches.forEach((m,index)=>{if(pairs.has(m.players.join(':'))){if(m.startedAt!=null)m.assignmentKey=m.scoreMonitor?.assignmentId??[data.freeTournament?'free':'club',data.started,cycle,index,m.startedAt].join(':');matches.push(m);}});
    out.push({bye:plan.bye,poolWave:{cycle,index:plan.index},matches});
   }
  });data.rounds=out;data.poolSchedule=KIND;return true;
 }
 function position(data,match){for(let r=0;r<data.rounds.length;r++){const m=data.rounds[r].matches.indexOf(match);if(m>=0)return {r,m,d:data.poolRules.disciplines.findIndex(d=>d.id===match.disciplineId)}}return null}
 function blocked(data,match){
  const here=position(data,match);if(!here)return true;
  return data.rounds.some((r,ri)=>r.matches.some(other=>{
   if(other===match||!other.players.some(id=>match.players.includes(id)))return false;
   if(!other.result&&other.table)return true;
   const phase=data.poolRules.disciplines.findIndex(d=>d.id===other.disciplineId);
   const samePair=other.players.length===match.players.length&&other.players.every(id=>match.players.includes(id));
   // Earlier waiting opponents do not reserve an idle player. Preserve discipline order
   // inside a cycle and never overlap a pending repeat of the same encounter.
   return !other.result&&(waves(data)?(ri<here.r||(ri===here.r&&phase<here.d)):((ri===here.r&&phase<here.d)||(ri<here.r&&samePair)));
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
  if(window.ClubKnockout?.is(data)||data.finalRoundRequest||!is(data)||data.ended||data.finishLastRound||data.limit!==null&&data.rounds.length>=data.limit||data.limit===null&&data.endAt!=null&&now>=data.endAt||!freeTables(data).length)return null;
  if(data.rounds.some(r=>r.matches.some(m=>ready(data,m))))return null;
  const last=data.rounds.at(-1);if(last&&!last.matches.some(m=>m.startedAt!=null||m.result))return null;
  const candidate=round(data);if(!candidate)return null;const preview={...data,rounds:[...data.rounds,candidate]};
  if(!candidate.matches.some(m=>ready(preview,m)))return null;
  return candidate;
 }
 function scoringRounds(data,rounds=data.rounds){if(!is(data))return rounds;return rounds.map(round=>{
  if(round.stage)return round;
  const grouped=new Map();for(const match of round.matches){const key=match.players.join(':');if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(match)}
  const matches=[...grouped.values()].map(parts=>{
   const result=parts.length===data.poolRules.disciplines.length&&parts.every(m=>m.result)?{frames:[0,0],breaks:[[],[]]}:null;
   if(result)for(const m of parts)for(let p=0;p<2;p++){result.frames[p]+=m.result.frames[p];result.breaks[p].push(...m.result.breaks[p])}
   return {players:parts[0].players,result,eloAt:result?Math.max(...parts.map(m=>m.eloAt??m.finishedAt??0)):null};
  });return {bye:round.bye??null,matches};
 })}
 function validate(data,model){
  if(!is(data))return true;
  if(waves(data)&&(!Array.isArray(data.poolDraw)||data.poolDraw.length!==data.players.length||new Set(data.poolDraw).size!==data.players.length||data.poolDraw.some(id=>!Number.isInteger(id)||id<0||id>=data.players.length)))return false;
  const expected=legacyRound(data).matches,keys=new Set(expected.map(m=>m.disciplineId+':'+m.players.join(':'))),tables=new Set(),players=new Set();
  for(const r of data.rounds){
   if(!r||!Array.isArray(r.matches))return false;
   if(waves(data)){
    if(!r.poolWave||!Number.isInteger(r.poolWave.cycle)||r.poolWave.cycle<0)return false;
    const plan=wavePlans(data)[r.poolWave.index];if(!plan||r.bye!==plan.bye||r.matches.length!==plan.pairs.length*data.poolRules.disciplines.length)return false;
    const expectedKeys=new Set(data.poolRules.disciplines.flatMap(d=>plan.pairs.map(p=>d.id+':'+p.join(':'))));if(r.matches.some(m=>!expectedKeys.has(m.disciplineId+':'+m.players.join(':'))))return false;
   }else if(r.bye!==null||r.matches.length!==keys.size)return false;
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
  if(waves(data)){
   if(!Array.isArray(data.poolDraw)||data.poolDraw.length!==data.players.length||new Set(data.poolDraw).size!==data.players.length||data.poolDraw.some(id=>!Number.isInteger(id)||id<0||id>=data.players.length))return false;
   const seen=new Set();for(const r of data.rounds){const k=r.poolWave.cycle+':'+r.poolWave.index;if(seen.has(k))return false;seen.add(k);}
  }
  return true;
 }
 window.PoolPlanner=Object.freeze({KIND,LEGACY,is,waves,upgrade,rules,round,position,blocked,ready,locked,freeTables,next,scoringRounds,validate});
})();
