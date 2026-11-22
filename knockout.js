// Version 9.0: lives until the last four, then a shared medal stage.
// This model has no DOM or Firebase dependency. Draws are persisted, never redrawn on render.
((root) => {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const is = d => d?.knockout?.version === 1;
  const winner = m => m.players[m.result.frames[0] > m.result.frames[1] ? 0 : 1];
  const loser = m => m.players.find(id => id !== winner(m));
  const match = (a, b, bracket) => ({players:[a,b], table:null, result:null, bracket});
  function shuffle(ids) {
    const out = [...ids];
    for (let i=out.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [out[i],out[j]]=[out[j],out[i]]; }
    return out;
  }
  function validBo(n) { return Number.isInteger(n) && n>=1 && n<=49 && n%2===1; }
  function stats(d) {
    const rows=d.players.map((name,id)=>({id,name,losses:0,wins:0,played:0,diff:0,byes:0}));
    for (const r of d.rounds) {
      for (const id of r.byes??[]) rows[id].byes++;
      for (const m of r.matches) {
        if (!m.result || !['upper','lower','ko'].includes(m.bracket)) continue;
        const a=rows[m.players[0]],b=rows[m.players[1]],f=m.result.frames;
        a.played++;b.played++;a.diff+=f[0]-f[1];b.diff+=f[1]-f[0];
        rows[winner(m)].wins++;rows[loser(m)].losses++;
      }
    }
    return rows;
  }
  function comparePerformance(a,b) {
    return b.wins/Math.max(1,b.played)-a.wins/Math.max(1,a.played)
      || b.diff/Math.max(1,b.played)-a.diff/Math.max(1,a.played);
  }
  function ordered(d,ids) {
    const rows=stats(d),order=d.knockout.draw;
    return [...ids].sort((a,b)=>comparePerformance(rows[a],rows[b]) || rows[a].byes-rows[b].byes || order.indexOf(a)-order.indexOf(b));
  }
  function pair(d,ids,count,bracket) {
    // Select fair byes first, then minimize repeat opponents among those playing.
    const sorted=ordered(d,ids),byes=sorted.slice(0,ids.length-2*count),playing=sorted.slice(byes.length);
    const met=(a,b)=>d.rounds.flatMap(r=>r.matches).filter(m=>m.result&&m.players.includes(a)&&m.players.includes(b)).length;
    let best=null,bestCost=Infinity;
    function visit(left,pairs,cost) {
      if (cost>=bestCost) return;
      if (!left.length) { best=pairs;bestCost=cost;return; }
      const a=left[0];
      for (let i=1;i<left.length;i++) visit(left.slice(1,i).concat(left.slice(i+1)),pairs.concat([[a,left[i]]]),cost+met(a,left[i]));
    }
    visit(playing,[],0);
    return {matches:(best??[]).map(([a,b])=>match(a,b,bracket)),byes};
  }
  function semis(d,ids,cross=false) {
    d.knockout.phase='semis';
    return {bye:null,label:'Halbfinale',stage:'semis',byes:[],matches:cross
      ? [match(ids[0],ids[3],'semi'),match(ids[1],ids[2],'semi')]
      : [match(ids[0],ids[1],'semi'),match(ids[2],ids[3],'semi')]};
  }
  function nextLivesRound(d) {
    const e=d.knockout,rows=stats(d),active=rows.filter(r=>r.losses<e.lives).map(r=>r.id);
    if (active.length===4) {
      const upper=ordered(d,active.filter(id=>rows[id].losses===0)),lower=ordered(d,active.filter(id=>rows[id].losses===1));
      // With two in each bracket: winner 1 vs loser 2, winner 2 vs loser 1.
      return upper.length===2&&lower.length===2 ? semis(d,[...upper,...lower],true) : semis(d,ordered(d,active),true);
    }
    if (active.length<4) throw Error('Die Finalphase benötigt genau vier Spieler.');
    if (e.lives===1) {
      let size=4;while(size<active.length)size*=2;
      const p=pair(d,active,active.length-size/2,'ko');
      return {bye:null,label:'K.-o. · Runde '+(d.rounds.length+1),stage:'lives',...p};
    }
    const upper=active.filter(id=>rows[id].losses===0),lower=active.filter(id=>rows[id].losses===1);
    const upperCount=upper.length>2?Math.min(Math.floor(upper.length/2),upper.length-2):0;
    const upperAfter=upper.length-upperCount;
    // Never eliminate past four; preserve two unbeaten semifinalists when available.
    const lowerCount=Math.min(Math.floor(lower.length/2),Math.max(0,active.length-Math.max(4,upperAfter+2)));
    const u=pair(d,upper,upperCount,'upper'),l=pair(d,lower,lowerCount,'lower');
    if (!u.matches.length&&!l.matches.length) throw Error('Keine gültige nächste K.-o.-Runde.');
    // Upper finalists waiting for the lower bracket are resting, not receiving a fictitious win.
    return {bye:null,label:'Doppel-K.-o. · Runde '+(d.rounds.length+1),stage:'lives',
      matches:[...u.matches,...l.matches],byes:[...(upperCount?u.byes:[]),...(lowerCount?l.byes:[])],
      resting:[...(upperCount?[]:upper),...(lowerCount?[]:lower)]};
  }
  function init(d,lives,bo) {
    if (![1,2].includes(lives)||!validBo(bo)||d.players.length<4||d.players.length>16) throw Error('K.-o.: 4 bis 16 Spieler, 1 oder 2 Leben und ungerades Best of wählen.');
    delete d.poolSchedule;
    d.knockout={version:1,mode:'lives',lives,bo,phase:'lives',draw:shuffle(d.players.map((_,id)=>id))};
    d.limit=999;d.endAt=null;d.finishLastRound=false;d.byePoints=0;d.rounds=[];
    d.rounds.push(nextLivesRound(d));
  }
  function prepareFinals(d,rows,bo) {
    if (is(d)||d.ended||d.players.length<4||!validBo(bo)) throw Error('Finalrunde nicht möglich.');
    if(d.rounds.some(r=>r.matches.some(m=>m.table&&!m.result)))throw Error('Zuerst die laufenden Begegnungen abschließen.');
    const groups=[];
    for(const row of rows) {
      const last=groups.at(-1);if(last?.place===row.place)last.ids.push(row.id);else groups.push({place:row.place,ids:[row.id]});
    }
    d.knockout={version:1,mode:'finals',qualificationPolicy:'cutoff-only',bo,phase:'shootout',qualificationRounds:d.rounds.length,
      qualificationLimit:d.limit,qualificationEndAt:d.endAt,baseRows:copy(rows),seedGroups:groups,shootouts:[],draw:d.players.map((_,id)=>id)};
    d.endAt=null;d.limit=999;d.finishLastRound=false;delete d.finalRoundRequest;
    for(const r of d.rounds)for(const m of r.matches)if(!m.result)m.cancelled=true;
    resolveSeeds(d);
  }
  function seedState(d) {
    const e=d.knockout,order=[],blocks=[];let pending=null;
    for(const group of e.seedGroups) {
      let left=[...group.ids],chosen=[];
      for(const shot of e.shootouts)if(left.length>1&&JSON.stringify(shot.candidates)===JSON.stringify(left)) {
        chosen.push(shot.winner);left=left.filter(id=>id!==shot.winner);
      }
      const belowCutoff=order.length+chosen.length+left.length>4;
      const legacy=e.qualificationPolicy!=='cutoff-only';
      if(!pending&&left.length>1&&order.length+chosen.length<4&&(legacy||belowCutoff))pending=left;
      for(const id of chosen)blocks.push([id]);
      if(left.length)blocks.push(left);
      order.push(...chosen,...left);
    }
    return {order,blocks,pending};
  }
  function resolveSeeds(d) {
    const state=seedState(d);if(state.pending)return false;
    d.knockout.seeds=state.order.slice(0,4);
    const [a,b,c,f]=d.knockout.seeds;
    d.rounds.push(semis(d,[a,f,b,c]));return true;
  }
  function upgrade(d) {
    if(!is(d)||d.knockout.mode!=='finals'||d.knockout.qualificationPolicy)return false;
    const e=d.knockout;
    if(e.phase!=='shootout'||d.ended){e.qualificationPolicy='legacy-seeded';return true;}
    // Keep genuine qualification decisions; discard only old ranking-only shootouts.
    const previous=e.shootouts;e.qualificationPolicy='cutoff-only';e.shootouts=[];
    for(const shot of previous){const pending=seedState(d).pending;if(pending&&JSON.stringify(pending)===JSON.stringify(shot.candidates)&&pending.includes(shot.winner))e.shootouts.push(shot);}
    resolveSeeds(d);return true;
  }
  function shootoutWinner(d,id) {
    if(!is(d)||d.ended||d.knockout.phase!=='shootout')throw Error('Kein offenes Shoot-out.');
    const candidates=seedState(d).pending;if(!candidates?.includes(id))throw Error('Ungültiger Shoot-out-Sieger.');
    d.knockout.shootouts.push({candidates:[...candidates],winner:id,at:Date.now()});resolveSeeds(d);
  }
  function advance(d) {
    if(!is(d)||d.ended||d.knockout.phase==='shootout')return false;
    const last=d.rounds.at(-1);if(last.matches.some(m=>!m.result))return false;
    if(last.stage==='finals') {
      const final=last.matches.find(m=>m.bracket==='final'),bronze=last.matches.find(m=>m.bracket==='bronze');
      d.knockout.placements=[winner(final),loser(final),winner(bronze),loser(bronze)];
      d.knockout.phase='done';d.ended=Date.now();return true;
    }
    if(last.stage==='semis') {
      d.knockout.phase='finals';
      d.rounds.push({bye:null,label:'Finale und kleines Finale',stage:'finals',byes:[],matches:[match(winner(last.matches[0]),winner(last.matches[1]),'final'),match(loser(last.matches[0]),loser(last.matches[1]),'bronze')]});return true;
    }
    d.rounds.push(nextLivesRound(d));return true;
  }
  function rules(d,m) {
    const e=d.knockout;
    if(!is(d)||e.mode==='finals'&&d.rounds.slice(0,e.qualificationRounds).some(r=>r.matches.includes(m)))return null;
    if(d.sport!=='pool')return {framesPerMatch:e.bo,bestOf:true};
    return {sport:'pool',framesPerMatch:e.bo,bestOf:true,rotation:true,disciplines:copy(d.poolRules.disciplines).map(x=>({...x,frames:1}))};
  }
  function locked(d,m) {
    if(!is(d))return false;
    const r=d.rounds.findIndex(r=>r.matches.includes(m));
    return r>=0&&d.rounds.slice(r+1).some(round=>round.matches.some(next=>next.startedAt!=null||next.result)) || d.knockout.mode==='finals'&&r<d.knockout.qualificationRounds;
  }
  function rewind(d,m) {
    if(!is(d)||locked(d,m))return false;
    const r=d.rounds.findIndex(round=>round.matches.includes(m));
    if(r<0||r===d.rounds.length-1)return false;
    d.rounds=d.rounds.slice(0,r+1);d.knockout.phase=d.rounds[r].stage;
    delete d.knockout.placements;d.ended=null;return true;
  }
  function rankings(d,baseRows=[]) {
    if(!is(d))return baseRows;
    const e=d.knockout;
    // Keep qualification ranks and points intact while the medal places are still open.
    const qualification=baseRows.length?baseRows:e.baseRows;
    if(e.mode==='finals'&&e.phase!=='done')return copy(qualification);
    const rows=d.players.map((name,id)=>({id,name,played:0,wins:0,draws:0,byes:0,diff:0,breaks:[],points:0,direct:0,place:1}));
    const byId=new Map(rows.map(r=>[r.id,r]));
    for(const r of d.rounds)for(const m of r.matches)if(m.result) {
      for(let i=0;i<2;i++) {const row=byId.get(m.players[i]);row.played++;row.wins+=winner(m)===row.id?1:0;row.diff+=m.result.frames[i]-m.result.frames[1-i];row.breaks.push(...(m.result.breaks?.[i]??[]));}
    }
    if(e.mode==='finals') {
      for(const row of qualification)Object.assign(byId.get(row.id),copy(row));
      for(const r of d.rounds.slice(e.qualificationRounds))for(const m of r.matches)if(m.result)for(let i=0;i<2;i++){const row=byId.get(m.players[i]);row.played++;row.wins+=winner(m)===row.id?1:0;row.points+=winner(m)===row.id?(d.framesPerMatch==null?1:2):0;row.diff+=m.result.frames[i]-m.result.frames[1-i];row.breaks.push(...(m.result.breaks?.[i]??[]));}
      const s=seedState(d);let place=1;
      for(const block of s.blocks){for(const id of block)byId.get(id).place=place;place+=block.length;}
    }else {
      const losses=Array(d.players.length).fill(0);let remaining=d.players.length;
      for(const r of d.rounds) {
        const out=[];
        for(const m of r.matches)if(m.result&&['ko','upper','lower'].includes(m.bracket)) {const id=loser(m);if(++losses[id]===e.lives)out.push(id);}
        const place=remaining-out.length+1;
        for(const id of out)byId.get(id).place=place;
        remaining-=out.length;
      }
    }
    for(const [i,id]of(e.placements??[]).entries())byId.get(id).place=i+1;
    rows.sort((a,b)=>a.place-b.place||a.id-b.id);
    for(let start=0;start<rows.length;) {let end=start+1;while(end<rows.length&&rows[end].place===rows[start].place)end++;
      for(let i=start;i<end;i++) {rows[i].seasonPoints=d.players.length-(start+end-1)/2;if(e.mode!=='finals')rows[i].points=2*rows[i].wins+rows[i].draws;}
      start=end;
    }
    return rows;
  }
  function validate(d,model) {
    try {
      const e=d.knockout,n=d.players.length,ids=a=>Array.isArray(a)&&a.every(id=>Number.isInteger(id)&&id>=0&&id<n)&&new Set(a).size===a.length;
      if(!is(d)||!['lives','finals'].includes(e.mode)||!validBo(e.bo)||n<4||n>16||!ids(e.draw)||e.draw.length!==n)return false;
      if(e.mode==='lives'&&![1,2].includes(e.lives))return false;
      if(!['lives','shootout','semis','finals','done'].includes(e.phase))return false;
      if(e.mode==='finals') {
        if(e.qualificationPolicy!=null&&!['cutoff-only','legacy-seeded'].includes(e.qualificationPolicy))return false;
        if(!Number.isInteger(e.qualificationRounds)||e.qualificationRounds<1||e.qualificationRounds>d.rounds.length||!Array.isArray(e.baseRows)||e.baseRows.length!==n||!ids(e.baseRows.map(r=>r.id))||!Array.isArray(e.seedGroups)||!ids(e.seedGroups.flatMap(g=>g.ids))||e.seedGroups.flatMap(g=>g.ids).length!==n||!Array.isArray(e.shootouts))return false;
        for(const row of e.baseRows)if(!Number.isInteger(row.place)||row.place<1||row.place>n||!Number.isFinite(row.points)||!Number.isFinite(row.diff)||typeof row.name!=='string')return false;
        const checked=copy(d);checked.knockout.shootouts=[];
        for(const shot of e.shootouts){if(!Number.isFinite(shot.at)||JSON.stringify(seedState(checked).pending)!==JSON.stringify(shot.candidates)||!shot.candidates.includes(shot.winner))return false;checked.knockout.shootouts.push(shot);}
        if(e.phase==='shootout'&&!seedState(d).pending)return false;
      }
      const tables=new Set(),busy=new Set();
      for(const r of d.rounds) {
        if(!Array.isArray(r.matches)||!r.matches.length||!ids(r.byes??[])||!ids(r.resting??[]))return false;
        const thisRound=[];
        for(const m of r.matches) {
          if(!ids(m.players)||m.players.length!==2||m.table!==null&&(!Number.isInteger(m.table)||m.table<1||m.table>d.tables))return false;
          for(const k of ['startedAt','finishedAt','eloAt'])if(m[k]!=null&&(!Number.isFinite(m[k])||m[k]<0))return false;
          if(m.paused&&(m.table!==null||m.result))return false;
          if(m.cancelled&&(m.table!==null||m.result))return false;
          if(m.table&&!m.result){if(tables.has(m.table)||m.players.some(id=>busy.has(id)))return false;tables.add(m.table);m.players.forEach(id=>busy.add(id));}
          const configured=rules(d,m)??root.ClubSport?.rules(d,m)??d;
          let summary=null;
          if(m.scoreMonitor){if(typeof m.scoreMonitor.assignmentId!=='string')return false;const st=m.scoreMonitor.state;summary=model.derive(st,configured);model.derive({...st,cursor:st.events.length},configured);}
          if(m.result){if(!Array.isArray(m.result.frames)||!Array.isArray(m.result.breaks)||m.result.breaks.length!==2||!m.result.breaks.every(list=>Array.isArray(list)&&list.every(v=>Number.isInteger(v)&&v>=20&&v<=(d.sport==='pool'?9999:155))))return false;
            if(summary){if(!summary.complete||JSON.stringify(summary.frames)!==JSON.stringify(m.result.frames)||JSON.stringify(summary.breaks)!==JSON.stringify(m.result.breaks))return false;}
            else {if(d.sport==='pool')return false;model.command(model.initial(),configured,{type:'manual',frames:m.result.frames,breaks:m.result.breaks,at:m.finishedAt??0});}
            if(r.stage&&m.result.frames[0]===m.result.frames[1])return false;
          }else if(summary?.complete)return false;
          if(r.stage)thisRound.push(...m.players);
        }
        if(r.stage&&!ids([...thisRound,...(r.byes??[])]))return false;
      }
      const lastStage=d.rounds.at(-1)?.stage;
      if(e.phase!=='shootout'&&e.phase!=='done'&&e.phase!==lastStage)return false;
      if(e.placements&&(!ids(e.placements)||e.placements.length!==4))return false;
      // Verify progression by replaying only the persisted draw and confirmed results.
      if(e.mode==='lives') {
        const replay=copy(d);replay.rounds=[];replay.knockout.phase='lives';delete replay.knockout.placements;replay.ended=null;
        for(const actual of d.rounds) {
          if(replay.rounds.length&&replay.rounds.at(-1).matches.some(m=>!m.result))return false;
          const previous=replay.rounds.at(-1);
          if(previous?.stage==='finals')return false;
          const expected=previous?.stage==='semis'
            ? {stage:'finals',matches:[match(winner(previous.matches[0]),winner(previous.matches[1]),'final'),match(loser(previous.matches[0]),loser(previous.matches[1]),'bronze')],byes:[]}
            : nextLivesRound(replay);
          if(expected.stage!==actual.stage||JSON.stringify(expected.matches.map(m=>[m.players,m.bracket]))!==JSON.stringify(actual.matches.map(m=>[m.players,m.bracket]))||JSON.stringify(expected.byes)!==JSON.stringify(actual.byes))return false;
          replay.rounds.push(copy(actual));
        }
      }
      const q=e.mode==='finals'?e.qualificationRounds:0;
      const stages=d.rounds.slice(q);
      const semi=stages.find(r=>r.stage==='semis'),final=stages.find(r=>r.stage==='finals');
      if(semi&&e.mode==='finals'){const [a,b,c,f]=seedState(d).order.slice(0,4);if(JSON.stringify(semi.matches.map(m=>m.players))!==JSON.stringify([[a,f],[b,c]]))return false;}
      if(semi) {if(semi.matches.length!==2||!ids(semi.matches.flatMap(m=>m.players))||semi.matches.some(m=>m.bracket!=='semi'))return false;}
      if(final) {if(!semi?.matches.every(m=>m.result)||final.matches.length!==2)return false;
        if(JSON.stringify(final.matches.map(m=>m.players))!==JSON.stringify([semi.matches.map(winner),semi.matches.map(loser)]))return false;
      }
      if(e.phase==='done'&&(!d.ended||!final?.matches.every(m=>m.result)||JSON.stringify(e.placements)!==JSON.stringify([winner(final.matches[0]),loser(final.matches[0]),winner(final.matches[1]),loser(final.matches[1])])))return false;
      return true;
    }catch{return false;}
  }
  root.ClubKnockout=Object.freeze({is,init,advance,stats,rankings,rules,locked,rewind,prepareFinals,seedState,shootoutWinner,validBo,validate,upgrade});
})(typeof window!=='undefined'?window:globalThis);
