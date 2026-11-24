((root)=>{
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const point=x=>x==null?'–':String(x).replace('.',',');
  function decode(state){return {...state,events:state.events.map(e=>e.type==='manual'&&!Array.isArray(e.breaks)?{...e,breaks:[e.breaks.player0,e.breaks.player1]}:e)};}
  function derived(match,boards,data){
    const b=boards.find(b=>b?.assignment?.id===match.id&&b.tournamentKey===data.key);
    try{
      const state=b?.state??match.score;
      return state?root.SnookerTableScore.derive(decode(state),b?.assignment?.rules??match.rules):null;
    }catch{return null;}
  }
  function cards(data,boards){return data.rounds.flatMap(r=>r.matches.filter(m=>!m.cancelled).map(m=>({...m,label:r.label,summary:derived(m,boards,data)})));}
  function score(m){const f=m.summary?.frames??m.result?.frames;return f?f.join(' : '):'– : –';}
  function history(m,names){
    const summary=m.summary,disciplines=summary?.disciplines??m.result?.disciplines;
    const breaks=summary?.breaks??m.result?.breaks;
    const frames=summary?.frameHistory??[];
    if(!disciplines?.length&&!breaks?.some(b=>b.length)&&!frames.length)return '';
    return '<details class="spectatorHistory"><summary>Spielverlauf</summary>'+(disciplines??[]).map(d=>'<p>'+esc(d.label)+' · '+esc(d.frames?.join(' : ')??'')+'</p>').join('')+
      (breaks??[]).map((b,i)=>b.length?'<p>Breaks '+esc(names[i])+': '+b.map(esc).join(', ')+'</p>':'').join('')+
      (frames.length?'<p>'+frames.map((f,i)=>'Frame '+(i+1)+': '+esc(f.scores?.join(' : ')??names[f.winner]??'')).join(' · ')+'</p>':'')+'</details>';
  }
  function matchCard(m,data,large=false){
    const names=m.players.map(id=>data.players[id]),complete=m.result||m.summary?.complete;
    const label=m.bracket==='final'?'Finale · Platz 1 / 2':m.bracket==='bronze'?'Kleines Finale · Platz 3 / 4':m.label;
    const current=m.summary?.currentDiscipline;
    const discipline=typeof current==='object'?current?.label:null;
    const scores=m.summary?.scores;
    return '<article class="spectatorMatch'+(large?' spectatorLive':'')+'"><p class="small">'+esc(label)+(m.disciplineId?' · '+esc({'8':'8-Ball','9':'9-Ball','10':'10-Ball','14':'14/1'}[m.disciplineId]??m.disciplineId):'')+'</p><div class="spectatorNames"><strong>'+esc(names[0])+'</strong><span class="spectatorScore">'+esc(score(m))+'</span><strong>'+esc(names[1])+'</strong></div><p>'+esc(complete?'Beendet':m.table?'Tisch '+m.table:m.paused?'Pausiert':'Wartet')+(discipline?' · '+esc(discipline):'')+'</p>'+
      (scores?.length?'<p class="spectatorPoints">Punkte: '+scores.map(esc).join(' : ')+'</p>':'')+history(m,names)+'</article>';
  }
  function render(data,boards,view){
    if(!data)return '';
    if(view==='standings')return '<section class="card"><h2>'+esc(data.standingsTitle??(data.ended?'Abschlusstabelle':'Tabelle'))+'</h2><p class="small">Bestätigte Ergebnisse · Punkte → Frame-Differenz → direkter Vergleich</p><div class="spectatorTableScroll"><table><thead><tr><th>Pl.</th><th>Spieler / Team</th><th>Pkt.</th><th>Sp.</th><th>Siege</th><th>Frame-Δ</th></tr></thead><tbody>'+data.standings.map(r=>'<tr><td>'+point(r.place)+'</td><td>'+esc(r.name)+'</td><td>'+point(r.points)+'</td><td>'+point(r.played)+'</td><td>'+point(r.wins)+'</td><td>'+point(r.diff)+'</td></tr>').join('')+'</tbody></table></div></section>';
    const all=cards(data,boards);
    if(view==='scores'){
      const live=all.filter(m=>m.table&&!m.result&&!m.summary?.complete);
      return '<section><h2>Live-Spielstände</h2>'+(live.length?live.map(m=>matchCard(m,data,true)).join(''):'<p class="card">Derzeit läuft keine Partie.</p>')+'</section>';
    }
    const running=all.filter(m=>m.table&&!m.result&&!m.summary?.complete),busy=new Set(running.flatMap(m=>m.players)),done=m=>m.result||m.summary?.complete;
    const waiting=all.filter(m=>!done(m)&&!m.table),ready=waiting.filter(m=>!m.paused&&!m.players.some(id=>busy.has(id))),blocked=waiting.filter(m=>!ready.includes(m));
    const groups=[['Am Tisch',running],['Nächste Begegnungen',ready],['Wartend / pausiert',blocked],['Abgeschlossen',all.filter(done)]];
    return groups.filter(([,ms])=>ms.length).map(([label,ms])=>label==='Abgeschlossen'?'<details class="card"><summary>Abgeschlossen · '+ms.length+'</summary>'+ms.map(m=>matchCard(m,data)).join('')+'</details>':'<section><h2>'+label+'</h2>'+ms.map(m=>matchCard(m,data)).join('')+'</section>').join('')+
      data.rounds.map(r=>r.byes?.length?'<p class="card small">'+esc(r.label)+' · Freilos: '+r.byes.map(id=>esc(data.players[id])).join(', ')+'</p>':'').join('');
  }
  root.SnookerSpectatorRender=Object.freeze({render,cards});
})(typeof window==='undefined'?globalThis:window);
