(() => {
 'use strict';
 const is=d=>Boolean(d?.freeTournament&&['groups','double','placement'].includes(d.elimination?.mode));
 const winner=m=>m.players[m.result.frames[0]>m.result.frames[1]?0:1];
 const loser=m=>m.players.find(p=>p!==winner(m));
 const match=(a,b,extra={})=>({players:[a,b],table:null,result:null,...extra});
 function shuffled(n){const ids=Array.from({length:n},(_,i)=>i);for(let i=n-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]]}return ids}
 function rr(ids,extra){return ids.flatMap((a,i)=>ids.slice(i+1).map(b=>match(a,b,extra)))}
 function init(d,mode,bo){
  d.elimination={mode,bo,phase:mode==='groups'?'groups':'bracket'};d.limit=999;d.endAt=null;d.byePoints=0;
  const ids=shuffled(d.players.length);
  if(mode==='groups'){
   const count=Math.max(1,Math.round(ids.length/4)),groups=Array.from({length:count},()=>[]);
   ids.forEach((id,i)=>groups[i%count].push(id));d.elimination.groups=groups;
   d.rounds=[{bye:null,label:'Gruppenphase',matches:groups.flatMap((g,i)=>rr(g,{group:i}))}];
  }else d.rounds=[doubleRound(d,ids)];
 }
 function groupRows(d,group){
  const rows=d.elimination.groups[group].map(id=>({id,wins:0,diff:0,tieWins:0,tieDiff:0})),byId=new Map(rows.map(r=>[r.id,r]));
  for(const r of d.rounds)for(const m of r.matches){if(m.group!==group||!m.result)continue;const [a,b]=m.players.map(id=>byId.get(id)),[x,y]=m.result.frames;
   if(m.decider){a.tieWins+=x>y?1:0;b.tieWins+=y>x?1:0;a.tieDiff+=x-y;b.tieDiff+=y-x;}
   else{a.wins+=x>y?1:0;b.wins+=y>x?1:0;a.diff+=x-y;b.diff+=y-x;}
  }
  // Direct comparison is a mini-table of all players tied on wins/difference.
  for(const row of rows){row.direct=0;for(const r of d.rounds)for(const m of r.matches){if(m.group!==group||m.decider||!m.result||!m.players.includes(row.id))continue;const other=byId.get(m.players.find(id=>id!==row.id));if(other.wins===row.wins&&other.diff===row.diff)row.direct+=winner(m)===row.id?1:0;}}
  const compare=(a,b)=>b.wins-a.wins||b.diff-a.diff||b.direct-a.direct||b.tieWins-a.tieWins||b.tieDiff-a.tieDiff;
  rows.sort(compare);return {rows,compare};
 }
 function bracketRound(ids,label){
  const slots=[];let size=2;while(size<ids.length)size*=2;
  const byes=size-ids.length;let pos=0;
  for(let i=0;i<byes;i++)slots.push([ids[pos++],null]);
  while(pos<ids.length)slots.push([ids[pos++],ids[pos++]]);
  return {bye:null,label,slots,matches:slots.flatMap(([a,b],slot)=>b==null?[]:[match(a,b,{slot,bracket:'ko'})])};
 }
 function medalRound(ids,semis=false,cross=true){
  return {bye:null,label:semis?(cross?'Überkreuz-Halbfinale':'Halbfinale'):'Finale und kleines Finale',medal:semis?'semis':'finals',matches:semis?[match(ids[0],ids[cross?3:1],{bracket:'semi'}),match(ids[cross?1:2],ids[cross?2:3],{bracket:'semi'})]:[match(ids[0],ids[1],{bracket:'final'}),...(ids.length>=4?[match(ids[2],ids[3],{bracket:'bronze'})]:[])]};
 }
 function finishMedals(d){
  const e=d.elimination,last=d.rounds.at(-1),final=last.matches.find(m=>m.bracket==='final'),bronze=last.matches.find(m=>m.bracket==='bronze');
  e.placements=[winner(final),loser(final),...(bronze?[winner(bronze),loser(bronze)]:e.third!=null?[e.third]:[])];e.champion=e.placements[0];d.ended=Date.now();return true;
 }
 function doubleRound(d,ids=null){
  const losses=Array(d.players.length).fill(0);for(const r of d.rounds??[])for(const m of r.matches)if(m.result)losses[loser(m)]++;
  const active=ids??losses.map((n,i)=>n<2?i:null).filter(i=>i!==null),upper=active.filter(i=>losses[i]===0),lower=active.filter(i=>losses[i]===1);
  if(upper.length===2&&lower.length===2)return medalRound([...upper,...lower],true);
  // Reduce the lower bracket first. Never send either of the final two undefeated players back into the upper bracket.
  let bucket,bracket;
  if(d.players.length>=4){
   if(lower.length>2){bucket=lower;bracket='lower'}
   else if(upper.length>2){bucket=upper;bracket='upper'}
   else if(active.length<=3){if(active.length===2){const previous=d.rounds.at(-1)?.matches.at(-1);if(previous)d.elimination.third=loser(previous);return medalRound(active)}bucket=lower.length>=2?lower:upper;bracket=lower.length>=2?'lower':'upper'}
   else {bucket=lower;bracket='lower'}
  }else{
   if(active.length===2&&upper.length<=1)return {bye:null,label:upper.length?'Finale':'Entscheidungsfinale',matches:[match(...active,{bracket:'final'})],resting:[]};
   bucket=upper.length>=2?upper:lower;bracket=upper.length>=2?'upper':'lower';
  }
  const count=bracket==='lower'?Math.min(Math.floor(bucket.length/2),bucket.length-2):Math.min(Math.floor(bucket.length/2),bucket.length-2);
  const matches=Array.from({length:Math.max(1,count)},(_,i)=>match(bucket[i*2],bucket[i*2+1],{bracket}));
  return {bye:null,label:'Doppel-K.-o. · '+(bracket==='upper'?'Gewinnerrunde':'Verliererrunde'),matches,resting:active.filter(id=>!matches.some(m=>m.players.includes(id)))};
 }
 function startPlacement(d,rows){
  if(!d.freeTournament||is(d)||d.ended||d.rounds.some(r=>r.matches.some(m=>!m.result)))return false;
  let bo=d.sport==='pool'?Math.max(...d.poolRules.disciplines.map(x=>x.frames)):d.framesPerMatch??1;bo=Math.min(49,Math.max(1,bo));if(bo%2===0)bo++;
  const groups=[];for(const row of rows){const last=groups.at(-1);if(last&&last.place===row.place)last.ids.push(row.id);else groups.push({place:row.place,ids:[row.id]})}
  d.elimination={mode:'placement',phase:'bracket',bo,qualificationRounds:d.rounds.length,seeds:groups,qualificationLimit:d.limit,qualificationEndAt:d.endAt};d.limit=999;d.endAt=null;delete d.finishLastRound;
  return placementNext(d);
 }
 function placementNext(d){
  const e=d.elimination,ties=[];const ids=[];
  for(const seed of e.seeds){
   const scores=seed.ids.map(id=>({id,wins:0,diff:0}));
   for(const r of d.rounds.slice(e.qualificationRounds))for(const m of r.matches)if(m.decider&&m.result&&seed.ids.includes(m.players[0]))for(let i=0;i<2;i++){const row=scores.find(x=>x.id===m.players[i]);row.wins+=winner(m)===row.id?1:0;row.diff+=m.result.frames[i]-m.result.frames[1-i]}
   scores.sort((a,b)=>b.wins-a.wins||b.diff-a.diff);
   for(let i=0;i<scores.length;){let j=i+1;while(j<scores.length&&scores[j].wins===scores[i].wins&&scores[j].diff===scores[i].diff)j++;if(j-i>1&&ids.length+i<4)ties.push(scores.slice(i,j).map(x=>x.id));i=j}
   ids.push(...scores.map(x=>x.id));
  }
  if(ties.length)d.rounds.push({bye:null,label:'Platzierungs-Entscheidung · BO 1',matches:ties.flatMap(g=>rr(g,{decider:true}))});
  else {if(ids.length===3)e.third=ids[2];d.rounds.push(medalRound(ids.slice(0,4)))}return true;
 }
 function advance(d){
  if(!is(d)||d.ended||d.rounds.at(-1).matches.some(m=>!m.result))return false;
  const e=d.elimination;
  const last=d.rounds.at(-1);
  if(last.medal==='finals')return finishMedals(d);
  if(last.medal==='semis'){d.rounds.push(medalRound([...last.matches.map(winner),...last.matches.map(loser)]));return true;}
  if(e.mode==='placement')return placementNext(d);
  if(e.phase==='groups'){
   const ties=[],ranked=e.groups.map((_,g)=>{const {rows,compare}=groupRows(d,g);for(let i=0;i<Math.min(e.groups.length===1?4:2,rows.length);i++){
    const tied=rows.filter(x=>compare(x,rows[i])===0);if(tied.length>1&&!ties.some(t=>t.group===g&&t.ids.includes(rows[i].id)))ties.push({group:g,ids:tied.map(x=>x.id)});
   }return rows;});
   if(ties.length){d.rounds.push({bye:null,label:'Gruppen-Entscheidung · BO 1',matches:ties.flatMap(t=>rr(t.ids,{group:t.group,decider:true}))});return true;}
   e.phase='bracket';const first=ranked.map(r=>r[0].id),second=ranked.map(r=>r[1].id),seed=[];
   for(let i=0;i<first.length;i++)seed.push(first[i],second[(i+1)%second.length]);
   if(seed.length===2&&ranked.length===1){seed.push(...ranked[0].slice(2,4).map(r=>r.id));if(seed.length===3)e.third=seed.pop();d.rounds.push(medalRound(seed));return true;}
   d.rounds.push(seed.length===4?medalRound(seed,true,false):seed.length===2?medalRound(seed):bracketRound(seed,'K.-o.-Phase'));return true;
  }
  let ids;
  if(e.mode==='double'){
   const losses=Array(d.players.length).fill(0);for(const r of d.rounds)for(const m of r.matches)if(m.result)losses[loser(m)]++;
   ids=losses.map((v,i)=>v<2?i:null).filter(i=>i!==null);
   if(ids.length>1){d.rounds.push(doubleRound(d));return true;}
  }else{const last=d.rounds.at(-1);ids=last.slots.map(([a,b],slot)=>b==null?a:winner(last.matches.find(m=>m.slot===slot)));if(ids.length>1){d.rounds.push(ids.length===4?medalRound(ids,true,false):ids.length===2?medalRound(ids):bracketRound(ids,'K.-o.-Runde'));return true;}}
  e.champion=ids[0];const eliminated=d.rounds.flatMap(r=>r.matches).filter(m=>m.result).map(loser).reverse();e.placements=[...new Set([ids[0],...eliminated])].slice(0,4);d.ended=Date.now();return true;
 }
 function rules(d,m){if(d.elimination.mode==='placement'&&d.rounds.slice(0,d.elimination.qualificationRounds).some(r=>r.matches.includes(m)))return d.sport==='pool'?(window.PoolPlanner?.is(d)?window.PoolPlanner.rules(d,m):d.poolRules):(d.framesPerMatch!=null?{framesPerMatch:d.framesPerMatch,bestOf:d.bestOf===true}:{target:d.target});const bo=m?.decider?1:d.elimination.bo;return d.sport==='pool'?{...d.poolRules,rotateBestOf:bo}:{framesPerMatch:bo,bestOf:true,elimination:true};}
 function ready(d,m){return !d.ended&&!m.result&&!m.table&&!m.paused&&!d.rounds.some(r=>r.matches.some(other=>other!==m&&other.table&&!other.result&&other.players.some(id=>m.players.includes(id))))}
 function validate(d,model){
  try{
   if(!is(d)||!Number.isInteger(d.elimination.bo)||d.elimination.bo<1||d.elimination.bo>49||d.elimination.bo%2!==1||!['groups','bracket'].includes(d.elimination.phase))return false;
   if(d.elimination.mode==='groups'){const ids=d.elimination.groups.flat();if(ids.length!==d.players.length||new Set(ids).size!==ids.length||ids.some(i=>!Number.isInteger(i)||i<0||i>=d.players.length)||d.elimination.groups.some(g=>g.length<2))return false;}
   if(d.elimination.mode==='placement'){const e=d.elimination;if(!Number.isInteger(e.qualificationRounds)||e.qualificationRounds<1||e.qualificationRounds>=d.rounds.length||!Array.isArray(e.seeds)||e.seeds.flatMap(g=>g.ids??[]).length!==d.players.length||new Set(e.seeds.flatMap(g=>g.ids??[])).size!==d.players.length)return false;}
   if(d.elimination.placements&&(!Array.isArray(d.elimination.placements)||new Set(d.elimination.placements).size!==d.elimination.placements.length||d.elimination.placements.some(i=>!Number.isInteger(i)||i<0||i>=d.players.length)))return false;
   const busyPlayers=new Set(),busyTables=new Set();
   for(const r of d.rounds){if(!Array.isArray(r.matches)||!r.matches.length||r.matches.length>120)return false;
    if(r.slots&&(!Array.isArray(r.slots)||r.slots.some(s=>!Array.isArray(s)||s.length!==2||!Number.isInteger(s[0])||s[0]<0||s[0]>=d.players.length||!(s[1]===null||Number.isInteger(s[1])&&s[1]>=0&&s[1]<d.players.length))))return false;
    for(const m of r.matches){if(!Array.isArray(m.players)||m.players.length!==2||m.players[0]===m.players[1]||m.players.some(i=>!Number.isInteger(i)||i<0||i>=d.players.length)||!(m.table===null||Number.isInteger(m.table)&&m.table>=1&&m.table<=d.tables))return false;
    if(m.group!=null&&(!Number.isInteger(m.group)||!d.elimination.groups?.[m.group]||m.players.some(id=>!d.elimination.groups[m.group].includes(id))))return false;
    if(m.table&&!m.result){if(busyTables.has(m.table)||m.players.some(id=>busyPlayers.has(id)))return false;busyTables.add(m.table);m.players.forEach(id=>busyPlayers.add(id));}
    if(m.paused!=null&&typeof m.paused!=='boolean')return false;if(m.paused&&(m.table!==null||m.result!==null))return false;for(const k of ['startedAt','finishedAt'])if(m[k]!=null&&(!Number.isFinite(m[k])||m[k]<0))return false;
    if(m.result){if(d.elimination.mode==='placement'&&d.rounds.indexOf(r)<d.elimination.qualificationRounds&&!m.scoreMonitor){if(!Array.isArray(m.result.frames)||m.result.frames.length!==2||m.result.frames.some(x=>!Number.isInteger(x)||x<0))return false;continue;}if(!m.scoreMonitor)return false;const v=model.derive(m.scoreMonitor.state,rules(d,m));if(!v.complete||(d.elimination.mode!=='placement'||!d.rounds.slice(0,d.elimination.qualificationRounds).includes(r))&&v.frames[0]===v.frames[1]||JSON.stringify(v.frames)!==JSON.stringify(m.result.frames)||JSON.stringify(v.breaks)!==JSON.stringify(m.result.breaks))return false;}
   }}return true;
  }catch{return false;}
 }
 window.ClubElimination=Object.freeze({is,init,startPlacement,advance,groupRows,rules,ready,validate});
})();
