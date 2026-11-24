// Explicit public projection: no account data, table codes, season archives or saved rosters.
((root)=>{
  'use strict';
  const copy=x=>JSON.parse(JSON.stringify(x));
  const key=d=>(d.freeTournament?'free:':'club:')+String(d.started);
  function snapshot(data,rows){
    const lifeStats=data.knockout?.mode==='lives'&&data.knockout.phase!=='done'?root.ClubKnockout.stats(data):null;
    return {schema:1,key:key(data),sport:data.sport==='pool'?'pool':'snooker',title:data.freeTournament?(data.tournamentName||'Freies Turnier'):'Club Liga',date:String(data.date??''),
      started:data.started,ended:data.ended??null,tables:data.tables,players:[...data.players],
      mode:data.knockout?(data.knockout.mode==='finals'?'Finalrunde':data.knockout.lives===2?'Doppel-K.-o.':'K.-o.'):(data.limit===null?'Nach Zeit':String(data.limit)+' Runden'),
      standingsTitle:data.knockout?.mode==='finals'&&data.knockout.phase!=='done'?'Vorrundentabelle':data.ended?'Abschlusstabelle':'Tabelle',
      standings:rows.map(r=>({id:r.id,name:r.name,place:lifeStats&&lifeStats[r.id].losses<data.knockout.lives?null:r.place??null,points:r.points??null,played:r.played??0,wins:r.wins??0,draws:r.draws??0,diff:r.diff??0})),
      remaining:data.knockout?.lives===2?root.ClubKnockout.stats(data).map(r=>({id:r.id,losses:r.losses})):null,
      rounds:data.rounds.map((r,i)=>({label:r.label??'Runde '+(i+1),byes:r.byes??(r.bye==null?[]:[r.bye]),matches:r.matches.map((m,j)=>({
        id:[data.freeTournament?'free':'club',data.started,i,j,m.startedAt].join(':'),round:i,index:j,players:[...m.players],
        table:m.table??null,startedAt:m.startedAt??null,finishedAt:m.finishedAt??null,paused:Boolean(m.paused),cancelled:Boolean(m.cancelled),
        bracket:m.bracket??null,disciplineId:m.disciplineId??null,result:m.result?copy(m.result):null,
        score:m.scoreMonitor?.state?copy(m.scoreMonitor.state):null,rules:copy(root.ClubSport.rules(data,m))
      }))}))};
  }
  function board(board){return {slot:board.tableNumber,tournamentKey:board.tournamentKey,assignment:board.assignment??null,state:copy(board.state),enabled:board.enabled===true};}
  const validToken=t=>typeof t==='string'&&/^[a-f0-9]{48}$/.test(t);
  function url(token,sport,base){if(!validToken(token))throw Error('Ungültiger Zuschauerlink.');const u=new URL('spectator.html',base);u.searchParams.set('sport',sport);u.hash=token;return u.href;}
  root.SnookerSpectator=Object.freeze({snapshot,board,key,validToken,url});
})(typeof window==='undefined'?globalThis:window);
