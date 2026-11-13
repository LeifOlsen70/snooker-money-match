(() => {
  'use strict';
  const localStorage = window.snookerStorage;

  const key = 'snookerSwissTournamentV1';
  const panel = $('tournamentMode');
  let tournament = null;
  let openMatch = null;
  let drafting = false;
  let archiveSelection = null;
  let draftFreeTournament = null;
  let view = 'rounds';
  let fullscreen = false;
  let liveStatus = 'Für Live-Sync auf beiden Geräten mit demselben Konto anmelden.';
  let remoteTournament = null;
  let sharedView = null;
  let undoStates = [], redoStates = [];
  let committed = 'null';
  let deadlineDialog = false;
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function expired() {
    return tournament && tournament.limit === null && tournament.endAt != null && Date.now() >= tournament.endAt;
  }
  function localTime(time) {
    const d = new Date(time);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }
  // A clock time always means its next occurrence, including after midnight.
  function nextEndTime(value, now = Date.now()) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return NaN;
    const [hours, minutes] = value.split(':').map(Number);
    const d = new Date(now);
    d.setHours(hours, minutes, 0, 0);
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  function endLabel() { return localTime(tournament.endAt); }
  function availableTables() {
    const occupied = new Set(tournament.rounds.flatMap(round => round.matches)
      .filter(match => !match.result && match.table).map(match => match.table));
    return Array.from({length:tournament.tables}, (_, i) => i + 1).filter(table => !occupied.has(table));
  }
  const formatPoints = points => String(points).replace('.', ',');

  function validMatchFrames(frames, rules) {
    const max = rules.framesPerMatch ?? rules.target;
    if (frames.length !== 2 || !frames.every(value => Number.isInteger(value) && value >= 0 && value <= max)) return false;
    if (rules.framesPerMatch != null) return frames[0] + frames[1] === max;
    return Math.max(...frames) === max && frames[0] !== frames[1];
  }

  function hasStartableMatch() {
    if (!availableTables().length) return false;
    const earlierPlayers = new Set();
    for (const round of tournament.rounds) {
      if (round.matches.some(match => !match.result && !match.table && !match.paused &&
          match.players.every(id => !earlierPlayers.has(id)))) return true;
      for (const match of round.matches) {
        if (!match.result) match.players.forEach(id => earlierPlayers.add(id));
      }
    }
    return false;
  }
  const rosterKey = 'snookerSwissPlayerNamesV1';
  let playerNames = [];
  let refreshPlayerList = null;
  try {
    const stored = JSON.parse(localStorage.getItem(rosterKey));
    if (Array.isArray(stored)) playerNames = stored.filter(name => typeof name === 'string' && name.trim());
  } catch (error) { console.warn('Spielerliste konnte nicht geladen werden.', error); }
  function savePlayerNames(next, publish = true) {
    next.sort((a,b) => a.localeCompare(b,'de'));
    if (JSON.stringify(playerNames) === JSON.stringify(next)) return;
    const before = playerNames;
    localStorage.setItem(rosterKey, JSON.stringify(next));
    playerNames = next;
    if (publish) window.dispatchEvent(new CustomEvent('snooker-roster-change', {detail:{before, after:next}}));
    else refreshPlayerList?.();
  }
  window.addEventListener('snooker-roster-received', ({detail}) => savePlayerNames([...detail], false));

  function rememberPlayers(names) {
    const next = [...playerNames];
    const known = new Set(playerNames.map(name => name.toLocaleLowerCase('de')));
    for (const raw of names) {
      const name = raw.trim().slice(0,60);
      if (name && !known.has(name.toLocaleLowerCase('de'))) {
        next.push(name); known.add(name.toLocaleLowerCase('de'));
      }
    }
    savePlayerNames(next);
  }
  function choice(title, message, options) {
    return new Promise(resolve => {
      const dialog = document.createElement('dialog');
      dialog.className = 'tournamentDialog';
      dialog.innerHTML = `<h3>${esc(title)}</h3><p>${esc(message)}</p><div class="tournamentActions">${options.map(([id,label]) => `<button type="button" data-choice="${id}">${esc(label)}</button>`).join('')}</div>`;
      document.body.append(dialog);
      function done(value) { dialog.close(); dialog.remove(); resolve(value); }
      dialog.querySelectorAll('button').forEach(b => b.onclick = () => done(b.dataset.choice));
      dialog.oncancel = e => { e.preventDefault(); done('cancel'); };
      dialog.showModal();
    });
  }
  function editEndTime() {
    return new Promise(resolve => {
      const dialog = document.createElement('dialog');
      dialog.className = 'tournamentDialog';
      dialog.innerHTML = `<form><h3>Turnierende ändern</h3><label>Uhrzeit<input type="time" required value="${localTime(tournament.endAt || Date.now()+3600000)}"></label><p role="alert"></p><div class="tournamentActions"><button>Übernehmen</button><button type="button">Abbrechen</button></div></form>`;
      document.body.append(dialog);
      function done(value) { dialog.close(); dialog.remove(); resolve(value); }
      dialog.querySelector('[type=button]').onclick = () => done(false);
      dialog.oncancel = e => { e.preventDefault(); done(false); };
      dialog.querySelector('form').onsubmit = e => {
        e.preventDefault();
        const value = nextEndTime(dialog.querySelector('input').value);
        if (!Number.isFinite(value) || value <= Date.now()) {
          dialog.querySelector('[role=alert]').textContent = 'Bitte eine gültige Uhrzeit eingeben.'; return;
        }
        tournament.endAt = value;
        tournament.finishLastRound = false;
        saveTournament(); done(true);
      };
      dialog.showModal();
    });
  }
  async function exportTournament(data = tournament) {
    const suggested = data.filename || `${defaultFilename()}_Turnier.json`;
    let filename = prompt('Dateiname für die Turnier-Sicherung:', suggested);
    if (filename === null) return false;
    filename = filename.trim().replace(/[\\/:*?"<>|]/g, '-');
    if (!filename) return false;
    if (!filename.toLowerCase().endsWith('.json')) filename += '.json';
    data.filename = filename;
    return (await shareJsonFile({app:'Snooker Swiss Tournament', version:1, tournament:data}, filename, 'Snooker-Turnier speichern')) !== false;
  }
  async function finishTournament() {
    if (openMatch !== null && !confirm('Ergebniseingabe ohne Speichern verlassen?')) return;
    const result = await choice('Turnier beenden', 'Das Turnier mit den bisher eingetragenen Ergebnissen beenden? Offene Matches werden nicht gewertet.', [
      ['save','Speichern und beenden'], ['end','Ohne Datei beenden'], ['cancel','Abbrechen']
    ]);
    if (result === 'cancel') return;
    const finished = {...clone(tournament), ended:Date.now()};
    if (result === 'save') {
      try { if (!await exportTournament(finished)) return; }
      catch (error) { alert('Speichern fehlgeschlagen. Das Turnier bleibt geöffnet.'); return; }
    }
    tournament = finished; openMatch = null; saveTournament();
  }
  async function checkDeadline() {
    if (!tournament || tournament.ended || drafting || panel.classList.contains('hidden') || !expired() || deadlineDialog || document.querySelector('dialog[open]')) return;
    if (tournament.finishLastRound) {
      if (tournament.rounds.every(r => r.matches.every(m => m.result))) {
        tournament.ended = Date.now(); openMatch = null; saveTournament();
      }
      return;
    }
    deadlineDialog = true;
    // Render immediately to remove any previously available next-round button.
    renderTournament();
    const result = await choice('Turnierende erreicht', 'Es kann keine weitere Runde erstellt werden. Wie soll es weitergehen?', [
      ['finish','Letzte Runde zu Ende spielen'], ['change','Endzeit korrigieren']
    ]);
    if (result === 'change') await editEndTime();
    else if (result === 'finish') { tournament.finishLastRound = true; saveTournament(); }
    deadlineDialog = false;
  }
  function historyStep(direction) {
    if (openMatch !== null && !confirm('Ergebniseingabe ohne Speichern verlassen?')) return;
    const source = direction < 0 ? undoStates : redoStates;
    const destination = direction < 0 ? redoStates : undoStates;
    if (!source.length) return;
    destination.push(clone(tournament)); tournament = source.pop();
    const before = committed;
    openMatch = null; committed = JSON.stringify(tournament);
    localStorage.setItem(key, committed);
    publishTournament(before);
    renderTournament();
  }


  function setTournamentFullscreen(enabled) {
    fullscreen = enabled;
    document.body.classList.toggle('snookerFullscreenTournament', enabled);
    const button = $('tournamentFullscreenToggle');
    if (button) {
      button.textContent = enabled ? 'Vollbild aus' : 'Vollbild an';
      button.setAttribute('aria-pressed', String(enabled));
    }
  }

  function showTournamentView(nextView) {
    if (view === nextView || !tournament || drafting) return;
    if (openMatch !== null && !confirm('Ergebniseingabe ohne Speichern verlassen?')) return;
    openMatch = null;
    view = nextView;
    if (view === 'days') setTournamentFullscreen(false);
    if (view === 'standings' || view === 'overall') window.dispatchEvent(new CustomEvent('snooker-tournament-view', {detail:view}));
    renderTournament();
    if (fullscreen) panel.scrollTop = 0;
    else window.scrollTo(0, 0);
  }

  let touchStart = null;
  panel.addEventListener('touchstart', event => {
    touchStart = event.touches.length === 1 && !event.target.closest('input, select, textarea')
      ? event.touches[0] : null;
  }, {passive: true});
  panel.addEventListener('touchcancel', () => { touchStart = null; }, {passive: true});
  panel.addEventListener('touchend', event => {
    const start = touchStart;
    touchStart = null;
    if (!start || event.touches.length || !event.changedTouches.length) return;
    const end = event.changedTouches[0];
    const dx = end.clientX - start.clientX;
    const dy = end.clientY - start.clientY;
    if (Math.abs(dx) > 75 && Math.abs(dx) > Math.abs(dy) * 1.6) {
      if (fullscreen) {
        showTournamentView(view === 'overall' ? 'standings' : 'overall');
      } else {
        const views = ['rounds', 'standings', 'overall', 'days'];
        const next = views[views.indexOf(view) + (dx < 0 ? 1 : -1)];
        if (next) showTournamentView(next);
      }
    }
  }, {passive: true});

  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved?.players?.length && saved?.rounds?.length) tournament = saved;
  } catch (error) {
    console.warn('Turnierstand konnte nicht geladen werden.', error);
  }

  if (localStorage.getItem(rosterKey) === null && tournament) rememberPlayers(tournament.players);
  committed = JSON.stringify(tournament);

  function showMode(mode) {
    setTournamentFullscreen(false);
    document.body.classList.toggle('compactTournament', mode === 'tournament');
    $('modeStart').classList.toggle('hidden', mode !== 'home');
    document.body.classList.toggle('modeHome', mode === 'home');
    $('singleMode').classList.toggle('hidden', mode !== 'single');
    panel.classList.toggle('hidden', mode !== 'tournament');
    document.body.classList.toggle('snookerFullscreenScore',
      mode === 'single' && $('scorerPage').classList.contains('displayOnly'));
    window.scrollTo(0, 0);
    if (mode === 'tournament') renderTournament();
  }

  window.addEventListener('snooker-account-enter', ({detail}) => {
    if (detail === 'single') showMode('single');
    else if (detail === 'club') openTournamentType(false);
    else if (detail === 'free') openTournamentType(true);
  });
  $('openSingle').onclick = () => window.snookerAccount.request('single');
  $('singleHome').onclick = () => showMode('home');
  $('openFreeTournament').onclick = () => window.snookerAccount.request('free');
  $('openClubLeague').onclick = () => window.snookerAccount.request('club');

  // Only confirmed results and assigned byes count toward the standings.
  function standings(rounds = tournament.rounds, data = tournament) {
    const rows = data.players.map((name, id) => ({
      name, id, played: 0, wins: 0, draws: 0, byes: 0, diff: 0, breaks: []
    }));
    for (const round of rounds) {
      if (round.bye !== null) rows[round.bye].byes++;
      for (const match of round.matches) {
        if (!match.result) continue;
        const [a, b] = match.players.map(id => rows[id]);
        a.played++;
        b.played++;
        const [first, second] = match.result.frames;
        if (first === second) {
          a.draws++;
          b.draws++;
        } else {
          const winner = first > second ? a : b;
          winner.wins++;
        }
        a.diff += first - second;
        b.diff += second - first;
        match.result.breaks.forEach((breaks, i) => {
          const player = i === 0 ? a : b;
          player.breaks.push(...breaks);
        });
      }
    }
    for (const row of rows) {
      row.points = data.framesPerMatch == null
        ? row.wins + row.byes
        : 2 * row.wins + row.draws + data.byePoints * row.byes;
    }
    rows.sort((a, b) => b.points - a.points || b.diff - a.diff || a.id - b.id);
    const ranked = [];
    for (let start = 0; start < rows.length;) {
      let end = start + 1;
      while (end < rows.length && rows[end].points === rows[start].points && rows[end].diff === rows[start].diff) end++;
      const group = rows.slice(start, end);
      const ids = new Set(group.map(row => row.id));
      const scores = new Map(group.map(row => [row.id, new Map()]));
      for (const round of rounds) for (const match of round.matches) {
        const [a, b] = match.players;
        if (!match.result || !ids.has(a) || !ids.has(b)) continue;
        const [first, second] = match.result.frames;
        const win = data.framesPerMatch == null ? 1 : 2;
        for (const [id, opponent, points] of [
          [a, b, first === second ? win / 2 : first > second ? win : 0],
          [b, a, first === second ? win / 2 : second > first ? win : 0]
        ]) {
          const previous = scores.get(id).get(opponent) ?? {total:0, count:0};
          scores.get(id).set(opponent, {total:previous.total + points, count:previous.count + 1});
        }
      }
      const complete = group.every(row => scores.get(row.id).size === group.length - 1);
      for (const row of group) {
        row.direct = complete
          ? [...scores.get(row.id).values()].reduce((sum, score) => sum + score.total / score.count, 0) : 0;
      }
      group.sort((a, b) => (Math.abs(b.direct - a.direct) > 1e-9 ? b.direct - a.direct : 0) || a.id - b.id);
      ranked.push(...group);
      start = end;
    }
    let place = 1;
    ranked.forEach((row, index) => {
      const previous = ranked[index - 1];
      if (previous && (row.points !== previous.points || row.diff !== previous.diff ||
          Math.abs(row.direct - previous.direct) > 1e-9)) place = index + 1;
      row.place = place;
    });
    for (let start = 0; start < ranked.length;) {
      let end = start + 1;
      while (end < ranked.length && ranked[end].place === ranked[start].place) end++;
      const seasonPoints = ranked.length - (start + end - 1) / 2;
      for (let index = start; index < end; index++) ranked[index].seasonPoints = seasonPoints;
      start = end;
    }
    return ranked;
  }

  function seasonDayRows(data) {
    return standings(data.rounds, data).map(({name, place, seasonPoints}) => ({name, place, points:seasonPoints}));
  }

  function unpairedTournament(data) {
    const {parkedTournament, parkedAt, ...active} = data;
    return active;
  }

  function tournamentOfType(free) {
    if (!tournament) return null;
    return Boolean(tournament.freeTournament) === free ? tournament : tournament.parkedTournament ?? null;
  }

  function openTournamentType(free, resume = false) {
    applyRemoteTournament();
    const existing = tournamentOfType(free);
    drafting = !existing || (free && !resume);
    draftFreeTournament = drafting ? free : null;
    view = !drafting && sharedView ? sharedView : 'rounds';
    if (!drafting && existing !== tournament) resumeParkedTournament();
    showMode('tournament');
  }

  function resumeParkedTournament() {
    const now = Date.now();
    const elapsed = Math.max(0, now - (tournament.parkedAt ?? now));
    const next = clone(tournament.parkedTournament);
    if (!next.ended) {
      if (next.endAt != null) next.endAt += elapsed;
      for (const round of next.rounds) for (const match of round.matches) {
        if (match.table && !match.result && match.startedAt != null) match.startedAt += elapsed;
      }
    }
    tournament = {...next, parkedTournament:unpairedTournament(tournament), parkedAt:now};
    saveTournament(false);
  }

  function dayKey(data) {
    return JSON.stringify(data.started ?? data.players);
  }

  function hasMatchResult(data) {
    return data.rounds.some(round => round.matches.some(match => match.result));
  }

  function hasDayPoints(day) {
    // Every recorded result awards points to at least one player.
    return day.rows.some(row => row.points > 0);
  }

  function overallDays(previous, incoming) {
    const days = new Map((incoming?.overallDays ?? []).map(day => [day.id, day]));
    for (const day of previous?.overallDays ?? []) days.set(day.id, day);
    if (previous?.ended && hasMatchResult(previous) && (!previous.seasonStarted || previous.started >= previous.seasonStarted)) {
      const id = dayKey(previous);
      const rows = seasonDayRows(previous);
      days.set(id, {id, rows, playDate:previous.playDate ?? (Number.isFinite(previous.started) ? localDateValue(previous.started) : undefined), scoring:'placement'});
    }
    if (incoming) days.delete(dayKey(incoming));
    const deleted = new Set([...(previous?.deletedDays ?? []), ...(incoming?.deletedDays ?? [])]);
    return [...days.values()].filter(day => hasDayPoints(day) && !deleted.has(day.id));
  }

  function seasonDays(data) {
    const cutoff = data.seasonStarted ?? 0;
    const deleted = new Set(data.deletedDays ?? []);
    const rows = (data.overallDays ?? [])
      .filter(day => hasDayPoints(day) && !deleted.has(day.id) && day.id !== dayKey(data) && (!cutoff || Number(day.id) >= cutoff))
      .map(day => ({...day, completed:true}));
    if (!deleted.has(dayKey(data)) && (!cutoff || data.started >= cutoff) && hasMatchResult(data)) {
      rows.push({id:dayKey(data), rows:seasonDayRows(data), completed:Boolean(data.ended),
        playDate:data.playDate ?? (Number.isFinite(data.started) ? localDateValue(data.started) : undefined), scoring:'placement'});
    }
    return rows.sort((a,b) => Number(a.id) - Number(b.id))
      .map((day,index) => ({...day, number:day.number ?? index+1}));
  }

  function overallRows(data) {
    return sumDayRows(seasonDays(data));
  }

  function sumDayRows(rows) {
    const totals = new Map();
    for (const day of rows) {
      const present = new Set();
      for (const {name, points} of day.rows) {
        const id = name.trim().toLocaleLowerCase('de');
        const previous = totals.get(id);
        totals.set(id, {name, points: (previous?.points ?? 0) + points,
          appearances: (previous?.appearances ?? 0) + Number(day.completed && !present.has(id))});
        present.add(id);
      }
    }
    const ranked = [...totals.values()].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'de'));
    let place = 1;
    return ranked.map((row, index) => {
      if (index > 0 && ranked[index - 1].points !== row.points) place = index + 1;
      return {...row, place};
    });
  }

  function renderSeasonDays(data, days = seasonDays(data)) {
    if (!days.length) return '';
    return `<div class="tournamentDayTables"><h3>Einzelne Spieltage</h3>${days.map((day,index) => {
      const date = tournamentDateLabel({playDate:day.playDate, started:Number(day.id)});
      const title = `Club Liga Spieltag ${day.number ?? index+1}${date ? ' · ' + date : ''}${day.completed ? '' : ' · vorläufig'}`;
      const rows = [...day.rows].sort((a,b) => b.points - a.points || a.name.localeCompare(b.name,'de'));
      let place = 1;
      const body = rows.map((row,rowIndex) => {
        if (rowIndex && rows[rowIndex-1].points !== row.points) place = rowIndex+1;
        return `<tr><td>${esc(row.place ?? place)}</td><td>${esc(row.name)}</td><td>${formatPoints(row.points)}</td></tr>`;
      }).join('');
      return `<section class="tournamentDayTable" data-day-table data-export-title="${esc(title)}">
        <h4>${esc(title)}</h4>
        <table class="tournamentTable"><thead><tr><th>Pl.</th><th>Spieler</th><th>Saisonpkt.</th></tr></thead><tbody>${body}</tbody></table>
        ${tableExportButtons()}
        ${day.scoring === 'placement' ? '' : '<p class="small">Historisch gespeicherte Punkte. Für eine Neuberechnung die ursprüngliche Turnierdatei laden.</p>'}
      </section>`;
    }).reverse().join('')}</div>`;
  }

  function dayYear(day) {
    const date = day.playDate ?? (Number.isFinite(Number(day.id)) ? localDateValue(Number(day.id)) : '');
    return /^\d{4}-/.test(date) ? date.slice(0,4) : 'Ohne Datum';
  }

  function carryYearDays(...sources) {
    const deleted = new Set(sources.flatMap(data => data?.deletedDays ?? []));
    const days = new Map();
    for (const data of sources) {
      if (!data) continue;
      const archived = (data.seasonArchive ?? []).flatMap(season => season.days ?? []);
      for (const day of [...(data.yearDays ?? []), ...archived, ...seasonDays(data)]) {
        if (day.completed !== false && !deleted.has(day.id)) days.set(day.id, {...day, completed:true});
      }
    }
    return [...days.values()].sort((a,b) => Number(a.id) - Number(b.id));
  }

  function yearGroups(data) {
    const groups = new Map();
    function group(year) {
      if (!groups.has(year)) groups.set(year, {year, days:[], legacy:[]});
      return groups.get(year);
    }
    const days = new Map(carryYearDays(data).map(day => [day.id,day]));
    for (const day of seasonDays(data)) days.set(day.id,day);
    for (const day of days.values()) group(dayYear(day)).days.push(day);
    for (const season of data.seasonArchive ?? []) {
      if (!season.days) group(dayYear({id:String(season.ended)})).legacy.push(season);
    }
    if (!(data.deletedDays ?? []).includes(dayKey(data))) {
      group(dayYear({playDate:data.playDate,id:String(data.started)}));
    }
    return [...groups.values()].sort((a,b) => b.year.localeCompare(a.year,'de'));
  }

  function overallTable(rows) {
    if (!rows.length) return '<p class="small">Diese Saison hat noch keine Spieltage.</p>';
    const tableRows = rows.map(({place, name, points, appearances}) =>
      `<tr><td>${place}</td><td>${esc(name)}</td><td>${formatPoints(points)}</td><td>${appearances}</td></tr>`);
    return `<table class="tournamentTable"><thead><tr><th>Pl.</th><th>Spieler</th><th>Pkt.</th><th>Teilnahmen</th></tr></thead>
      <tbody>${tableRows.join('')}</tbody></table>`;
  }

  const eloStart = 1000;
  const eloFactor = 32;
  const eloName = name => name.trim().toLocaleLowerCase('de');

  function eloMatches(data) {
    if (!data || data.freeTournament) return [];
    return data.rounds.flatMap((round, r) => round.matches.flatMap((match, m) => {
      if (!match.result || !match.eloAt) return [];
      const [a, b] = match.result.frames;
      return [{id:JSON.stringify([dayKey(data), r, m]), at:match.eloAt,
        names:match.players.map(id => data.players[id]), score:a === b ? .5 : Number(a > b)}];
    }));
  }

  function carryElo(previous, incoming) {
    const resetAt = Math.max(previous?.elo?.resetAt ?? 0, incoming?.elo?.resetAt ?? 0);
    const games = new Map();
    for (const game of [...incoming?.elo?.games ?? [], ...previous?.elo?.games ?? [],
      ...eloMatches(previous)]) {
      if (game.at > resetAt) games.set(game.id, game);
    }
    const edits = new Map();
    for (const edit of [...incoming?.elo?.edits ?? [], ...previous?.elo?.edits ?? []]) {
      if (edit.at > resetAt) edits.set(JSON.stringify([edit.at, eloName(edit.name)]), edit);
    }
    return {resetAt, games:[...games.values()], edits:[...edits.values()]};
  }

  function eloEvents(data) {
    const games = new Map((data.elo?.games ?? []).map(game => [game.id, game]));
    for (const game of eloMatches(data)) games.set(game.id, game);
    return [...games.values(), ...data.elo?.edits ?? []]
      .filter(event => event.at > (data.elo?.resetAt ?? 0))
      .sort((a,b) => a.at - b.at || (a.id ?? eloName(a.name)).localeCompare(b.id ?? eloName(b.name), 'de'));
  }

  function nextEloTime(data) {
    return Math.max(Date.now(), (data.elo?.resetAt ?? 0) + 1,
      (eloEvents(data).at(-1)?.at ?? 0) + 1);
  }

  function eloRows(data) {
    const players = new Map();
    function player(name) {
      const id = eloName(name);
      if (!players.has(id)) players.set(id, {name, rating:eloStart});
      return players.get(id);
    }
    for (const {name} of overallRows(data)) player(name);
    for (const season of data.seasonArchive ?? []) for (const {name} of season.rows) player(name);
    for (const name of data.players) player(name);
    for (const event of eloEvents(data)) {
      if (event.names) {
        const [a,b] = event.names.map(player);
        const expected = 1 / (1 + 10 ** ((b.rating - a.rating) / 400));
        const change = eloFactor * (event.score - expected);
        a.rating += change;
        b.rating -= change;
      } else {
        player(event.name).rating = event.rating;
      }
    }
    return [...players.values()].sort((a,b) => b.rating - a.rating || a.name.localeCompare(b.name, 'de'));
  }

  function renderElo(data) {
    const rows = eloRows(data);
    return `<div class="tournamentSeasons" id="tournamentElo" aria-label="Elo-Wertung">
      <table class="tournamentTable"><thead><tr><th>Pl.</th><th>Spieler</th><th>Elo</th></tr></thead>
        <tbody>${rows.map((row, index) => `<tr><td>${index + 1}</td><td>${esc(row.name)}</td><td><span data-export-value>${Math.round(row.rating)}</span>
          <button type="button" class="secondary" data-edit-elo="${index}" aria-label="Elo von ${esc(row.name)} ändern">Ändern</button></td></tr>`).join('')}</tbody>
      </table>
      ${tableExportButtons()}
      <button type="button" class="secondary tournamentEnd" id="resetTournamentElo">Elo für alle auf 1000 setzen</button>
    </div>`;
  }

  function editElo(row) {
    const value = prompt(`Neue Elo-Zahl für ${row.name} (0–9999):`, String(Math.round(row.rating)));
    if (value === null) return;
    const rating = Number(value.trim());
    if (!/^\d{1,4}$/.test(value.trim())) {
      alert('Bitte eine ganze Elo-Zahl zwischen 0 und 9999 eingeben.');
      return;
    }
    const at = nextEloTime(tournament);
    tournament.elo ??= {resetAt:0,games:[],edits:[]};
    tournament.elo.edits.push({at,name:row.name,rating});
    saveTournament();
  }

  function resetElo() {
    if (!confirm('Die Elo-Wertung aller Spieler auf 1000 zurücksetzen und die bisherigen Elo-Änderungen verwerfen?')) return;
    tournament.elo = {resetAt:nextEloTime(tournament),games:[],edits:[]};
    saveTournament();
  }

  function renderOverall(data) {
    const rows = overallRows(data);
    const archive = data.seasonArchive ?? [];
    return `<div class="card tournamentStandings tournamentOverall" style="--table-rows:${rows.length + 1}">
      <div class="tournamentStandingsHeader">
        <h3>${data.freeTournament ? 'Gesamt' : 'Tabelle Saison'}</h3>
        <button type="button" class="secondary" id="tournamentFullscreenToggle" aria-pressed="false">Vollbild an</button>
      </div>
      ${overallTable(rows)}
      ${rows.length ? tableExportButtons() : ''}
      <div class="tournamentSeasons">
        ${archive.length ? `<details><summary>Saisonarchiv</summary>
          ${archive.map((season, index) => `<details>
            <summary>${esc(season.name)}</summary>
            ${overallTable(season.rows)}
            ${tableExportButtons()}
            <button type="button" class="secondary tournamentEnd" data-delete-season="${index}">Saison löschen</button>
          </details>`).join('')}
        </details>` : ''}
        ${!data.freeTournament && rows.length ? `<button type="button" class="tournamentSeasonWarning" id="newTournamentSeason" ${data.ended ? '' : 'disabled'}>⚠ Neue Saison starten</button>
          ${data.ended ? '' : '<p class="small">Für den Saisonwechsel zuerst das laufende Turnier beenden.</p>'}` : ''}
      </div>
    </div>`;
  }

  function renderDayElo(data) {
    const groups = yearGroups(data);
    const selected = groups.find(group => group.year === archiveSelection);
    const canDelete = selected && (data.ended || dayYear({playDate:data.playDate,id:String(data.started)}) !== selected.year);
    const legacy = selected?.legacy.map(season => `<details>
      <summary>${esc(season.name)}</summary>
      ${overallTable(season.rows)}
      ${tableExportButtons()}
      <p class="small">Für dieses ältere Archiv wurde nur die Gesamttabelle gespeichert. Einzelne Spieltage sind in der ursprünglichen Turniersicherung enthalten.</p>
    </details>`).join('') ?? '';
    return `<div class="card tournamentStandings tournamentDayElo">
      <h3>${data.freeTournament ? 'Spieltage' : 'Spieltage &amp; Elo'}</h3>
      <div class="tournamentActions tournamentArchiveChoices">
        ${data.freeTournament ? '' : `<button type="button" data-archive-select="elo" class="${archiveSelection === 'elo' ? 'primary' : 'secondary'}" aria-expanded="${archiveSelection === 'elo'}">Elo-Wertung</button>`}
        ${groups.map(group => `<button type="button" data-archive-select="${esc(group.year)}" class="${archiveSelection === group.year ? 'primary' : 'secondary'}" aria-expanded="${archiveSelection === group.year}">${group.year === 'Ohne Datum' ? 'Ohne Datum' : 'Saison ' + group.year}</button>`).join('')}
      </div>
      ${!data.freeTournament && archiveSelection === 'elo' ? renderElo(data) : ''}
      ${selected ? `<h3 class="tournamentArchiveHeading">${selected.year === 'Ohne Datum' ? 'Ohne Datum' : 'Saison ' + esc(selected.year)}</h3>
        ${renderSeasonDays(data, selected.days.sort((a,b) => Number(a.id)-Number(b.id))) || '<p class="small">Noch keine einzelnen Spieltage gespeichert.</p>'}
        ${legacy}
        ${selected.days.length || selected.legacy.length ? `<button type="button" class="tournamentSeasonWarning" id="deleteTournamentYear" ${canDelete ? '' : 'disabled'}>⚠ Gesamtes Jahr ${esc(selected.year)} löschen</button>
          ${canDelete ? '' : '<p class="small">Zum Löschen dieses Jahres zuerst den laufenden Spieltag beenden.</p>'}` : ''}` : ''}
    </div>`;
  }

  function deleteTournamentYear(year) {
    const group = yearGroups(tournament).find(entry => entry.year === year);
    if (!group || (!tournament.ended && dayYear({playDate:tournament.playDate,id:String(tournament.started)}) === year)) return;
    if (!confirm(`Das gesamte Jahr ${year} mit allen gespeicherten Spieltagstabellen und Saisonpunkten endgültig löschen?${tournament.freeTournament ? '' : ' Die Elo-Wertung wird separat fortgeführt.'}`)) return;
    tournament.elo = carryElo(tournament);
    const ids = new Set(group.days.map(day => day.id));
    if (dayYear({playDate:tournament.playDate,id:String(tournament.started)}) === year) ids.add(dayKey(tournament));
    tournament.deletedDays = [...new Set([...(tournament.deletedDays ?? []), ...ids])];
    tournament.yearDays = carryYearDays(tournament).filter(day => dayYear(day) !== year);
    tournament.overallDays = (tournament.overallDays ?? []).filter(day => !ids.has(day.id));
    tournament.seasonArchive = (tournament.seasonArchive ?? []).flatMap(season => {
      if (!season.days) return group.legacy.includes(season) ? [] : [season];
      const days = season.days.filter(day => !ids.has(day.id));
      return days.length ? [{...season,days,rows:sumDayRows(days)}] : [];
    });
    if (dayYear({playDate:tournament.playDate,id:String(tournament.started)}) === year) {
      for (const round of tournament.rounds) {
        round.bye = null;
        for (const match of round.matches) {
          match.result = null;
          match.table = null;
          delete match.startedAt;
          delete match.finishedAt;
          delete match.eloAt;
          delete match.paused;
        }
      }
    }
    archiveSelection = null;
    saveTournament(false);
  }

  function startTournamentSeason() {
    if (!tournament?.ended || tournament.freeTournament || document.querySelector('dialog[open]')) return;
    const rows = overallRows(tournament);
    if (!rows.length) return;
    const snapshot = committed;
    const dialog = document.createElement('dialog');
    dialog.className = 'tournamentDialog tournamentSeasonDialog';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-labelledby', 'seasonWarningTitle');
    dialog.setAttribute('aria-describedby', 'seasonWarningMessage');
    dialog.innerHTML = `<form>
      <h2 id="seasonWarningTitle">⚠ Achtung – neue Saison</h2>
      <p id="seasonWarningMessage"><strong>Jetzt speichern und neue Saison starten?</strong></p>
      <p>Die aktuelle Saisontabelle wird unter dem Archivnamen gespeichert. Die neue Saison beginnt bei null.</p>
      <p class="tournamentSeasonNotice"><strong>Dieser Saisonwechsel kann nicht rückgängig gemacht werden.</strong>
        Die bisherige Saison kann aus dem Archiv nicht als laufende Saison wiederhergestellt werden.
        Ihre archivierte Tabelle und die Spieltage in der Jahresansicht bleiben zum Ansehen und Exportieren erhalten.</p>
      <label for="seasonArchiveName">Archivname der bisherigen Saison</label>
      <input id="seasonArchiveName" name="archiveName" required maxlength="100" autocomplete="off">
      <p role="alert"></p>
      <div class="tournamentActions">
        <button type="button" data-cancel>Abbrechen</button>
        <button type="submit" class="tournamentSeasonWarning">Jetzt speichern und neue Saison starten</button>
      </div>
    </form>`;
    const input = dialog.querySelector('input');
    input.value = `Saison bis ${new Date().toLocaleDateString('de-DE')}`;
    function close() { dialog.close(); dialog.remove(); }
    dialog.querySelector('[data-cancel]').onclick = close;
    dialog.oncancel = event => { event.preventDefault(); close(); };
    dialog.querySelector('form').onsubmit = event => {
      event.preventDefault();
      const name = input.value.trim();
      const error = dialog.querySelector('[role=alert]');
      if (!name) { error.textContent = 'Bitte einen Archivnamen eingeben.'; input.focus(); return; }
      if (snapshot !== committed || (remoteTournament && remoteTournament.raw !== snapshot)) {
        error.textContent = 'Der Turnierstand wurde inzwischen geändert. Bitte abbrechen und den Saisonwechsel erneut öffnen.';
        return;
      }
      const now = Math.max(Date.now(), (tournament.started ?? 0) + 1, (tournament.seasonStarted ?? 0) + 1);
      const days = seasonDays(tournament).map(day => ({...day,completed:true}));
      tournament.yearDays = carryYearDays(tournament);
      tournament.seasonArchive = [{ended:now,name,rows,days}, ...(tournament.seasonArchive ?? [])];
      tournament.seasonStarted = now;
      tournament.overallDays = [];
      close();
      saveTournament(false);
    };
    document.body.append(dialog);
    dialog.showModal();
    input.focus();
  }

  function deleteArchivedSeason(season) {
    const archive = tournament?.seasonArchive;
    if (!season || !archive?.includes(season)) return;
    if (!confirm(`„${season.name}“ aus dem Saisonarchiv löschen?`)) return;
    const ids = (season.days ?? []).map(day => day.id);
    tournament.deletedDays = [...new Set([...(tournament.deletedDays ?? []), ...ids])];
    tournament.yearDays = (tournament.yearDays ?? []).filter(day => !ids.includes(day.id));
    tournament.seasonArchive = archive.filter(entry => entry !== season);
    saveTournament();
  }

  function tableExportButtons() {
    return `<div class="tournamentActions tournamentSeasons">
      <button type="button" class="secondary" data-export-table="csv">CSV speichern</button>
      <button type="button" class="secondary" data-export-table="pdf">PDF speichern</button>
    </div>`;
  }

  function tablePdf(title, [headers, ...rows]) {
    const width = 595, height = 842, margin = 36, perPage = 25;
    const total = Math.max(1, Math.ceil(rows.length / perPage));
    const weights = headers.map((_, index) => index === 0 ? .65 : index === 1 ? 3 : 1.25);
    const unit = (width - 2 * margin) / weights.reduce((sum, weight) => sum + weight, 0);
    return renderPdfPages(total, (ctx, page) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#21152e';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(title, margin, 53, width - 2 * margin);
      [headers, ...rows.slice(page * perPage, (page+1) * perPage)].forEach((row, index) => {
        const top = 72 + index * 27;
        ctx.fillStyle = index === 0 ? '#302040' : index % 2 ? '#f2eef6' : '#ffffff';
        ctx.fillRect(margin, top, width - 2 * margin, 27);
        ctx.fillStyle = index === 0 ? '#ffffff' : '#21152e';
        ctx.font = index === 0 ? 'bold 11px sans-serif' : '12px sans-serif';
        let x = margin;
        row.forEach((value, column) => {
          const cellWidth = weights[column] * unit;
          ctx.fillText(value, x + 7, top + 17, cellWidth - 14);
          x += cellWidth;
        });
      });
      ctx.fillStyle = '#51465b';
      ctx.font = '10px sans-serif';
      ctx.fillText(`Seite ${page+1} / ${total}`, margin, height - 28);
    });
  }

  async function exportTournamentTable(title, table, format) {
    const rows = Array.from(table.rows, row => Array.from(row.cells, cell =>
      (cell.querySelector('[data-export-value]') ?? cell).textContent.trim()));
    const filename = title.replace(/[\\/:*?"<>|]/g,'-') + '.' + format;
    if (format === 'pdf') {
      return shareDownloadFile(new File(tablePdf(title, rows), filename, {type:'application/pdf'}), title);
    }
    const csv = rows.map((row, index) => row.map((value, column) => {
      const safe = index && column === 1 && /^[\s]*[=+@-]|^[\t\r\n]/.test(value) ? "'" + value : value;
      return '"' + safe.replaceAll('"', '""') + '"';
    }).join(';')).join('\r\n');
    return shareDownloadFile(new File(['\uFEFF',csv], filename, {type:'text/csv;charset=utf-8'}), title);
  }

  function pairingHistory(rounds) {
    const count = tournament.players.length;
    const size = count + count % 2;
    const full = (1 << size) - 1;
    const fresh = () => Array.from({length: size}, (_, id) => full ^ (1 << id));
    let graph = fresh();
    let realLeft = count * (count - 1) / 2;
    for (const round of rounds) {
      if (realLeft === 0) {
        graph = fresh();
        realLeft = count * (count - 1) / 2;
      }
      for (const {players: [a, b]} of round.matches) {
        if (graph[a] & (1 << b)) realLeft--;
        graph[a] &= ~(1 << b);
        graph[b] &= ~(1 << a);
      }
      if (round.bye !== null) {
        graph[round.bye] &= ~(1 << count);
        graph[count] &= ~(1 << round.bye);
      }
    }
    return {graph, fresh, realLeft};
  }

  function pairRound(early = null, rounds = tournament.rounds) {
    const rows = standings(rounds);
    const byeId = rows.length;
    const {graph: remaining, fresh, realLeft} = pairingHistory(rounds);
    // A new cycle starts only after all matches in the previous one are finished.
    if (!realLeft && rounds.some(round => round.matches.some(match => !match.result))) return null;
    const graph = realLeft ? remaining : fresh();
    if (!rounds.length) {
      for (let i = rows.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rows[i], rows[j]] = [rows[j], rows[i]];
      }
    }
    const order = rows.map(row => row.id);
    if (graph.length > byeId) order.push(byeId);
    const full = (1 << graph.length) - 1;

    function visitPairings(edges, mask, pairs, visit, allowRest = false) {
      if (!mask) return visit(pairs);
      const a = order.find(id => mask & (1 << id));
      const rest = mask ^ (1 << a);
      for (const b of order) {
        if (!(edges[a] & rest & (1 << b))) continue;
        pairs.push([a, b]);
        const stop = visitPairings(edges, rest ^ (1 << b), pairs, visit, allowRest);
        pairs.pop();
        if (stop) return true;
      }
      return allowRest && visitPairings(edges, rest, pairs, visit, true);
    }

    function removePairs(edges, pairs) {
      const next = [...edges];
      for (const [a, b] of pairs) {
        next[a] &= ~(1 << b);
        next[b] &= ~(1 << a);
      }
      return next;
    }

    const impossible = new Set();
    function canFinish(edges) {
      if (!edges.some(Boolean)) return true;
      if (edges.some(mask => !mask)) return false;
      const key = edges.join(',');
      if (impossible.has(key)) return false;
      // Any full schedule must use this edge in one of its remaining rounds.
      const a = order[0];
      const edge = edges[a] & -edges[a];
      const b = Math.log2(edge);
      const mask = full ^ (1 << a) ^ edge;
      if (visitPairings(edges, mask, [[a, b]], pairs => canFinish(removePairs(edges, pairs)))) return true;
      impossible.add(key);
      return false;
    }

    const rank = [];
    rows.forEach((row, index) => { rank[row.id] = index; });
    const candidates = [];
    function addCandidate(pairs) {
      const byePair = pairs.find(([, b]) => b === byeId);
      const bye = byePair ? byePair[0] : null;
      const matches = pairs.filter(([, b]) => b !== byeId);
      if (!matches.length) return;
      const startable = early ? matches.filter(([a, b]) => early.readyPlayers.has(a) && early.readyPlayers.has(b)).length : 0;
      const tablesFilled = early ? Math.min(startable, early.freeTableCount) : 0;
      const rankGap = matches.reduce((sum, [a, b]) => sum + (rank[b] - rank[a]) ** 2, 0);
      candidates.push({pairs: [...pairs], matches, bye, tablesFilled, rankGap});
    }
    function compareCandidates(a, b) {
      return b.tablesFilled - a.tablesFilled || b.matches.length - a.matches.length
        || (a.bye !== null && b.bye !== null ? rows[rank[a.bye]].byes - rows[rank[b.bye]].byes || rank[b.bye] - rank[a.bye] : 0)
        || a.rankGap - b.rankGap;
    }

    visitPairings(graph, full, [], addCandidate);
    candidates.sort(compareCandidates);
    const degree = mask => mask.toString(2).replace(/0/g, '').length;
    const regular = graph.every(mask => degree(mask) === degree(graph[0]));
    let pairing = regular && candidates.find(candidate => canFinish(removePairs(graph, candidate.pairs)));
    if (!pairing && realLeft) {
      // Older schedules can leave a graph that cannot be split into full rounds.
      // Finish all unused pairings, without awarding points for extra rests.
      if (!candidates.length) {
        visitPairings(graph.slice(0, byeId), (1 << byeId) - 1, [], addCandidate, true);
        candidates.sort(compareCandidates);
      }
      pairing = candidates[0];
    }
    if (!pairing) return null;
    return {
      matches: pairing.matches.map(players => ({players, table: null, result: null})),
      bye: pairing.bye
    };
  }

  function replacementRound() {
    const rounds = tournament.rounds.slice(0, -1);
    const last = tournament.rounds.at(-1);
    if (!rounds.length || last.matches.some(match => match.result || match.table || match.startedAt != null)) return null;
    const {graph, realLeft} = pairingHistory(rounds);
    if (!realLeft || !last.matches.some(({players: [a, b]}) => !(graph[a] & (1 << b)))) return null;
    return pairRound(null, rounds);
  }

  function saveTournament(keepHistory = true, replace = false) {
    const before = committed;
    const next = JSON.stringify(tournament);
    if (next !== committed) {
      if (keepHistory) undoStates.push(JSON.parse(committed));
      else undoStates = [];
      if (undoStates.length > 100) undoStates.shift();
      redoStates = []; committed = next;
    }
    localStorage.setItem(key, next);
    publishTournament(before, replace);
    renderTournament();
  }

  function localDateValue(time) {
    const date = new Date(time);
    return [date.getFullYear(), date.getMonth()+1, date.getDate()]
      .map(value => String(value).padStart(2,'0')).join('-');
  }

  function tournamentDateLabel(data) {
    const date = data.playDate ?? (Number.isFinite(data.started) ? localDateValue(data.started) : '');
    return date ? date.split('-').reverse().join('.') : '';
  }

  function tournamentTitle(data, standingsView = false) {
    if (data.freeTournament) return standingsView ? (data.ended ? 'Abschlusstabelle' : 'Zwischenstand') : 'Freies Turnier';
    if (standingsView && !data.ended) return 'Tabelle Turniertag';
    const cutoff = data.seasonStarted ?? 0;
    const validDay = data.ended && hasMatchResult(data) && (!cutoff || data.started >= cutoff);
    const earlier = new Set((data.overallDays ?? [])
      .filter(day => hasDayPoints(day) && Number(day.id) >= cutoff && Number(day.id) < data.started)
      .map(day => day.id));
    const title = standingsView
      ? `Club Liga Spieltag${validDay ? ' ' + (earlier.size+1) : ''}`
      : 'Club Liga Turnier';
    const date = tournamentDateLabel(data);
    return date ? `${title} · ${date}` : title;
  }

  function renderSetup() {
    const options = (max, selected) => Array.from({length:max}, (_, i) => i+1)
      .map(value => `<option ${value === selected ? 'selected' : ''}>${value}</option>`).join('');
    panel.innerHTML = `
      <div class="card">
        <h2>${(draftFreeTournament ?? tournament?.freeTournament) ? 'Freies Turnier anlegen' : 'Club Liga Saison · Turnier anlegen'}</h2>
        <form id="tournamentSetup">
          <div class="tournamentFields tournamentSetupFields">
            <label>Datum<input name="playDate" type="date" required value="${localDateValue(Date.now())}"></label>
            <label>Spieleranzahl
              <select name="count">${Array.from({length:11}, (_, i) =>
                `<option ${i === 2 ? 'selected' : ''}>${i + 2}</option>`).join('')}</select>
            </label>
            <label>Turnierdauer
              <select name="duration"><option value="fixed">Feste Rundenzahl</option>
              <option value="endless">Nach Zeit · Endlos</option></select>
            </label>
            <label id="tournamentRoundCount">Anzahl Runden
              <select name="rounds">${options(999, 3)}</select>
            </label>
            <label id="tournamentEndTime" class="hidden">Endzeit
              <input name="endAt" type="time" value="${localTime(Date.now()+3*3600000)}">
            </label>
            <label>Frames pro Match
              <select name="framesPerMatch">${options(50, 2)}</select>
            </label>
            <label>Punkte pro Freilos
              <select name="byePoints">
                <option value="0">0</option>
                <option value="0.5" selected>0,5</option>
                <option value="1">1</option>
              </select>
            </label>
            <label>Tische
              <select name="tables">${options(6, 1)}</select>
            </label>
          </div>
          <section class="tournamentRoster" aria-label="Gespeicherte Spieler">
            <h3>Spieler auswählen</h3>
            <p class="small">Namen antippen, um sie für dieses Turnier auszuwählen oder abzuwählen. Zum Bearbeiten oder Löschen auf ⋯ tippen oder die Zeile nach links wischen.</p>
            <div id="savedTournamentPlayers" class="tournamentPlayerChoices"></div>
            <div class="tournamentRosterAdd"><label>Neuer Spieler<input id="newTournamentPlayerName" type="text" maxlength="60" placeholder="Name"></label><button type="button" class="secondary" id="addTournamentPlayer">Hinzufügen</button></div>
            <p id="tournamentPlayerMessage" class="small" role="status"></p>
          </section>
          <div id="tournamentNames" class="tournamentFields"></div>
          <p class="tournamentStatus" id="tournamentSetupError" role="alert"></p>
          <button class="primary">Turnier starten</button>
          ${draftFreeTournament === true && tournamentOfType(true) ? '<button type="button" class="secondary" id="resumeFreeTournament">Gespeichertes freies Turnier öffnen</button>' : ''}
          ${drafting ? '<button type="button" class="secondary" id="cancelTournamentSetup">Abbrechen</button>' : ''}
        </form>
      </div>`;

    const form = $('tournamentSetup');
    const names = $('tournamentNames');
    const drafts = [];
    let suppressPickUntil = 0;
    function editPlayer(name, inputs) {
      const dialog = document.createElement('dialog');
      dialog.className = 'tournamentDialog';
      dialog.setAttribute('aria-label', 'Spielername bearbeiten');
      dialog.innerHTML = `<form><h3>Spielername bearbeiten</h3><label>Spielername<input type="text" maxlength="60" required></label><p role="alert"></p><div class="tournamentActions"><button>Speichern</button><button type="button">Abbrechen</button></div></form>`;
      const input = dialog.querySelector('input');
      const message = dialog.querySelector('[role=alert]');
      input.value = name;
      function close() { dialog.close(); dialog.remove(); }
      dialog.querySelector('[type=button]').onclick = close;
      dialog.oncancel = event => { event.preventDefault(); close(); };
      dialog.querySelector('form').onsubmit = event => {
        event.preventDefault();
        const corrected = input.value.trim();
        if (!corrected) {
          message.textContent = 'Bitte einen Namen eingeben.';
          return;
        }
        if (corrected === name) { close(); return; }
        const oldKey = name.toLocaleLowerCase('de');
        const newKey = corrected.toLocaleLowerCase('de');
        const draftNames = [...inputs.map(field => field.value), ...drafts.slice(inputs.length)];
        if (newKey !== oldKey && [...playerNames, ...draftNames].some(value => value?.trim().toLocaleLowerCase('de') === newKey)) {
          message.textContent = 'Dieser Name wird bereits verwendet.';
          return;
        }
        const rename = value => value?.trim().toLocaleLowerCase('de') === oldKey ? corrected : value;
        try {
          savePlayerNames(playerNames.map(rename));
        } catch (error) {
          message.textContent = 'Der Name konnte auf diesem Gerät nicht gespeichert werden.';
          return;
        }
        inputs.forEach(field => { field.value = rename(field.value); });
        drafts.forEach((value, index) => { drafts[index] = rename(value); });
        close();
        $('tournamentPlayerMessage').textContent = 'Spielername gespeichert.';
        renderPlayerList();
        const index = playerNames.indexOf(corrected);
        panel.querySelector(`[data-pick-player="${index}"]`)?.focus();
      };
      document.body.append(dialog);
      dialog.showModal();
      input.select();
    }
    function renderPlayerList() {
      const inputs = Array.from(names.querySelectorAll('input'));
      const selected = new Set(inputs.map(input => input.value.trim().toLocaleLowerCase('de')));
      $('savedTournamentPlayers').innerHTML = playerNames.map((name,i) => {
        const active = selected.has(name.toLocaleLowerCase('de'));
        return `<div class="tournamentPlayerRow">
          <div class="tournamentPlayerFace">
            <button type="button" class="tournamentPlayerPick ${active ? 'selected' : ''}" data-pick-player="${i}" aria-pressed="${active}"><span class="tournamentPlayerCheck" aria-hidden="true">${active ? '✓' : '○'}</span><span>${esc(name)}</span></button>
            <button type="button" class="tournamentPlayerMore" aria-label="Aktionen für ${esc(name)}" aria-expanded="false">⋯</button>
          </div>
          <div class="tournamentPlayerActions" hidden>
            <button type="button" data-edit-player="${i}">Bearbeiten</button>
            <button type="button" class="tournamentPlayerDelete" data-delete-player="${i}">Löschen</button>
          </div>
        </div>`;
      }).join('') || '<p class="small">Noch keine Spieler gespeichert.</p>';
      function reveal(row, open) {
        if (open) $('savedTournamentPlayers').querySelectorAll('.tournamentPlayerRow').forEach(other => { if (other !== row) reveal(other,false); });
        row.querySelector('.tournamentPlayerActions').hidden = !open;
        row.querySelector('.tournamentPlayerMore').setAttribute('aria-expanded',String(open));
      }
      $('savedTournamentPlayers').querySelectorAll('.tournamentPlayerRow').forEach(row => {
        let start = null;
        row.querySelector('.tournamentPlayerMore').onclick = () => reveal(row,row.querySelector('.tournamentPlayerActions').hidden);
        row.addEventListener('touchstart', event => {
          start = event.touches.length === 1 ? {x:event.touches[0].clientX,y:event.touches[0].clientY} : null;
        }, {passive:true});
        row.addEventListener('touchcancel', () => { start = null; }, {passive:true});
        row.addEventListener('touchend', event => {
          const origin = start; start = null;
          if (!origin || event.touches.length || !event.changedTouches.length) return;
          const end = event.changedTouches[0], dx = end.clientX-origin.x, dy = end.clientY-origin.y;
          if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)*1.5) return;
          suppressPickUntil = Date.now()+450;
          reveal(row,dx < 0);
        }, {passive:true});
        row.addEventListener('keydown', event => {
          if (event.key === 'Escape') { reveal(row,false); row.querySelector('.tournamentPlayerMore').focus(); }
        });
      });
      $('savedTournamentPlayers').querySelectorAll('[data-pick-player]').forEach(button => button.onclick = () => {
        if (Date.now() < suppressPickUntil) return;
        const row = button.closest('.tournamentPlayerRow');
        if (!row.querySelector('.tournamentPlayerActions').hidden) { reveal(row,false); return; }
        const name = playerNames[Number(button.dataset.pickPlayer)];
        const existing = inputs.find(input => input.value.trim().toLocaleLowerCase('de') === name.toLocaleLowerCase('de'));
        if (existing) existing.value = '';
        else {
          const empty = inputs.find(input => !input.value.trim());
          if (!empty) { $('tournamentPlayerMessage').textContent = 'Alle Plätze belegt. Bitte die Spieleranzahl erhöhen oder einen Namen abwählen.'; return; }
          empty.value = name;
        }
        $('tournamentPlayerMessage').textContent = ''; renderPlayerList();
      });
      $('savedTournamentPlayers').querySelectorAll('[data-edit-player]').forEach(button => button.onclick = () => {
        editPlayer(playerNames[Number(button.dataset.editPlayer)], inputs);
      });
      $('savedTournamentPlayers').querySelectorAll('[data-delete-player]').forEach(button => button.onclick = () => {
        const index = Number(button.dataset.deletePlayer), name = playerNames[index];
        if (!confirm(`${name} aus der gespeicherten Spielerliste löschen? Bereits gespielte Turniere bleiben erhalten.`)) return;
        savePlayerNames(playerNames.filter((_, i) => i !== index));
        inputs.forEach(input => { if (input.value.trim().toLocaleLowerCase('de') === name.toLocaleLowerCase('de')) input.value = ''; });
        renderPlayerList();
      });
    }
    $('addTournamentPlayer').onclick = () => {
      const input = $('newTournamentPlayerName'), name = input.value.trim();
      if (!name) { $('tournamentPlayerMessage').textContent = 'Bitte einen Namen eingeben.'; return; }
      rememberPlayers([name]); input.value = ''; renderPlayerList();
      const slot = Array.from(names.querySelectorAll('input')).find(input => !input.value.trim());
      const alreadySelected = Array.from(names.querySelectorAll('input')).some(input => input.value.trim().toLocaleLowerCase('de') === name.toLocaleLowerCase('de'));
      if (slot && !alreadySelected) slot.value = playerNames.find(saved => saved.toLocaleLowerCase('de') === name.toLocaleLowerCase('de'));
      $('tournamentPlayerMessage').textContent = 'Spieler gespeichert.'; renderPlayerList();
    };
    $('newTournamentPlayerName').onkeydown = event => {
      if (event.key === 'Enter') { event.preventDefault(); $('addTournamentPlayer').click(); }
    };
    function renderNames() {
      names.querySelectorAll('input').forEach((input, i) => { drafts[i] = input.value; });
      names.innerHTML = Array.from({length:Number(form.elements.count.value)}, (_, i) =>
        `<label>Spieler ${i + 1}<input name="player" maxlength="60" required value="${esc(drafts[i] || '')}"></label>`
      ).join('');
      names.querySelectorAll('input').forEach(input => {
        input.onchange = () => { rememberPlayers([input.value]); renderPlayerList(); };
        input.oninput = renderPlayerList;
      });
      renderPlayerList();
    }
    refreshPlayerList = renderPlayerList;
    renderNames();
    form.elements.count.onchange = renderNames;
    form.elements.duration.onchange = () => {
      const endless = form.elements.duration.value === 'endless';
      $('tournamentRoundCount').classList.toggle('hidden', endless);
      form.elements.rounds.disabled = endless;
      $('tournamentEndTime').classList.toggle('hidden', !endless);
      form.elements.endAt.required = endless;
    };
    if ($('cancelTournamentSetup')) $('cancelTournamentSetup').onclick = () => {
      const fromHome = draftFreeTournament !== null;
      drafting = false;
      draftFreeTournament = null;
      if (fromHome) showMode('home');
      else renderTournament();
    };
    if ($('resumeFreeTournament')) $('resumeFreeTournament').onclick = () => {
      drafting = false;
      openTournamentType(true, true);
    };
    form.onsubmit = event => {
      event.preventDefault();
      const players = new FormData(form).getAll('player').map(name => name.trim());
      if (players.some(name => !name) || new Set(players.map(name => name.toLocaleLowerCase('de'))).size !== players.length) {
        $('tournamentSetupError').textContent = 'Bitte für jeden Spieler einen eindeutigen Namen eingeben.';
        return;
      }
      const playDate = form.elements.playDate.value;
      const timed = form.elements.duration.value === 'endless';
      const endAt = !timed ? null : playDate === localDateValue(Date.now())
        ? nextEndTime(form.elements.endAt.value)
        : new Date(playDate + 'T' + form.elements.endAt.value).getTime();
      if (timed && !(endAt > Date.now())) {
        $('tournamentSetupError').textContent = 'Bitte eine gültige Uhrzeit für das Turnierende eingeben.'; return;
      }
      const freeTournament = draftFreeTournament ?? Boolean(tournament?.freeTournament);
      const previous = tournamentOfType(freeTournament);
      if (previous && !confirm('Das bisherige Turnier dieser Turnierart wird ersetzt. Fortfahren?')) return;
      rememberPlayers(players);
      const changeType = Boolean(tournament) && Boolean(tournament.freeTournament) !== freeTournament;
      const parkedTournament = changeType ? unpairedTournament(tournament) : tournament?.parkedTournament;
      const parkedAt = changeType ? Date.now() : tournament?.parkedAt;
      tournament = {
        players,
        freeTournament,
        parkedTournament,
        parkedAt,
        overallDays: freeTournament ? [] : overallDays(previous),
        yearDays: freeTournament ? undefined : carryYearDays(previous),
        deletedDays: freeTournament ? undefined : previous?.deletedDays,
        elo: freeTournament ? undefined : carryElo(previous),
        seasonStarted: freeTournament ? undefined : previous?.seasonStarted,
        seasonArchive: freeTournament ? undefined : previous?.seasonArchive,
        limit: form.elements.duration.value === 'endless' ? null : Number(form.elements.rounds.value),
        framesPerMatch: Number(form.elements.framesPerMatch.value),
        byePoints: Number(form.elements.byePoints.value),
        tables: Number(form.elements.tables.value),
        playDate, started: Date.now(), ended: null, rounds: [],
        endAt,
        finishLastRound: false
      };
      drafting = false;
      draftFreeTournament = null;
      openMatch = null;
      view = 'rounds';
      tournament.rounds.push(pairRound());
      saveTournament(!changeType);
    };
  }

  function renderMatch(match, index, freeTables, blocked) {
    const names = match.players.map(id => esc(tournament.players[id]));
    let status = 'Match wartet';
    if (match.result) status = match.result.frames[0] === match.result.frames[1] ? 'Unentschieden' : 'Fertig';
    else if (tournament.ended) status = 'Offen bei Turnierende';
    else if (match.table) status = `Am Tisch ${match.table}`;
    else if (match.paused) status = 'Pausiert';
    else if (blocked) status = 'Wartet auf ein Ergebnis';
    const waiting = !match.result && !match.table && !tournament.ended;
    return `<article class="tournamentMatch">
      <h4>${names.join(' – ')}</h4>
      <p class="tournamentStatus">${status}${match.result ? ` · ${match.result.frames.join(':')}` : ''}</p>
      ${renderMatchTime(match, index)}
      ${match.result ? match.result.breaks.map((breaks, i) =>
        breaks.length ? `<p class="small"><strong>${names[i]}</strong> · Breaks: ${breaks.join(', ')}</p>` : ''
      ).join('') : ''}
      ${!tournament.ended && openMatch === null ? `<div class="tournamentActions">
        ${waiting && !match.paused && !blocked ? freeTables.map(table => `<button type="button" class="secondary tournamentStart tournamentPulse" data-start="${index}" data-table="${table}">An Tisch ${table} starten</button>`).join('') : ''}
        ${waiting ? `<button type="button" class="secondary tournamentStart${match.paused ? ' tournamentPulse' : ''}" data-pause="${index}">${match.paused ? 'Pause beenden' : 'Pausieren'}</button>` : ''}
        ${match.table || match.result ? `<button type="button" class="secondary ${match.result ? 'tournamentCorrect' : 'tournamentResult'}" data-edit="${index}">${match.result ? 'Ergebnis korrigieren' : 'Ergebnis eintragen'}</button>` : ''}
      </div>` : ''}
    </article>`;
  }

  function openResultDialog(match, index) {
    if (openMatch !== null || tournament.ended || (!match.table && !match.result)) return;
    openMatch = index;
    const names = match.players.map(id => esc(tournament.players[id]));
    const frames = [...(match.result?.frames ?? [0, 0])];
    const dialog = document.createElement('dialog');
    dialog.className = 'tournamentDialog tournamentResultDialog';
    dialog.setAttribute('aria-labelledby', 'tournamentResultTitle');
    dialog.innerHTML = `<form>
      <h3 id="tournamentResultTitle" tabindex="-1" autofocus>${match.result ? 'Ergebnis korrigieren' : 'Ergebnis eintragen'}</h3>
      <p class="small">${tournament.framesPerMatch == null
        ? `Bis ${tournament.target} Gewinnframes` : `${tournament.framesPerMatch} Frames insgesamt`} · Name antippen für +1</p>
      ${names.map((name, i) => `<div class="tournamentResultRow">
        <button type="button" data-frame-add="${i}">${name}<strong data-frame-score aria-live="polite"></strong></button>
        <button type="button" data-frame-minus="${i}" aria-label="Einen Frame bei ${name} abziehen">−</button>
        <button type="button" data-break-toggle="${i}" aria-label="Breaks von ${name}" aria-expanded="false" aria-controls="tournamentBreaks${i}">Breaks</button>
        <label id="tournamentBreaks${i}" hidden>Breaks · ${name} (ab 20)
          <input name="breaks" type="text" placeholder="z. B. 24, 38" value="${match.result?.breaks[i].join(', ') ?? ''}">
        </label>
      </div>`).join('')}
      <p class="small" role="alert"></p>
      <div class="tournamentResultActions">
        <button type="button" data-close>Abbrechen</button>
        <button type="submit">Speichern</button>
      </div>
    </form>`;

    const form = dialog.querySelector('form');
    const add = [...form.querySelectorAll('[data-frame-add]')];
    const minus = [...form.querySelectorAll('[data-frame-minus]')];
    const save = form.querySelector('[type="submit"]');
    function update() {
      const complete = validMatchFrames(frames, tournament);
      add.forEach((button, i) => {
        button.querySelector('[data-frame-score]').textContent = frames[i];
        button.disabled = complete;
        minus[i].disabled = frames[i] === 0;
      });
      save.disabled = !complete;
    }
    add.forEach((button, i) => { button.onclick = () => { frames[i]++; update(); }; });
    minus.forEach((button, i) => { button.onclick = () => { frames[i]--; update(); }; });
    form.querySelectorAll('[data-break-toggle]').forEach((button, i) => {
      const field = form.querySelector('#tournamentBreaks' + i);
      button.onclick = () => {
        field.hidden = !field.hidden;
        button.setAttribute('aria-expanded', String(!field.hidden));
        if (!field.hidden) field.querySelector('input').focus();
      };
    });
    function close() {
      openMatch = null;
      dialog.close();
      dialog.remove();
    }
    function cancel() {
      close();
      if (remoteTournament) renderTournament();
    }
    form.querySelector('[data-close]').onclick = cancel;
    dialog.oncancel = event => { event.preventDefault(); cancel(); };
    form.onsubmit = event => {
      event.preventDefault();
      if (!validMatchFrames(frames, tournament)) return;
      const breaks = new FormData(form).getAll('breaks')
        .map(value => value.trim().split(/[,\s]+/).filter(Boolean).map(Number));
      if (breaks.flat().some(points => !Number.isInteger(points) || points < 0 || points > 155)) {
        form.querySelector('[role="alert"]').textContent = 'Bitte Breaks als ganze Zahlen von 0 bis 155 eingeben.';
        return;
      }
      if (!match.result) {
        if (match.startedAt != null) match.finishedAt = Date.now();
        if (!tournament.freeTournament) match.eloAt = nextEloTime(tournament);
      }
      match.result = {frames, breaks:breaks.map(list => list.filter(points => points >= 20))};
      close();
      saveTournament();
    };
    update();
    document.body.append(dialog);
    dialog.showModal();
  }

  function renderStandings(data = tournament) {
    const rows = standings(data.rounds, data);
    const tableRows = rows.map(row => {
      return `<tr><td>${row.place}</td><td>${esc(row.name)}</td><td>${formatPoints(row.points)}</td>
        <td>${row.played + row.byes}</td><td>${row.wins}</td><td>${row.draws}</td><td>${row.diff > 0 ? '+' : ''}${row.diff}</td></tr>`;
    });
    const playedBreaks = rows.filter(row => row.breaks.length);
    return `<div class="card tournamentStandings" style="--table-rows:${rows.length + 1}">
      <div class="tournamentStandingsHeader">
        <h3>${esc(tournamentTitle(data, true))}</h3>
        <button type="button" class="secondary" id="tournamentFullscreenToggle" aria-pressed="false">Vollbild an</button>
      </div>
      <table class="tournamentTable"><thead><tr><th>Pl.</th><th>Spieler</th><th>Pkt.</th><th title="Matches mit Ergebnis plus Freilose">Spiele</th><th>Siege</th><th title="Unentschieden">Remis</th><th>Frame-Δ</th></tr></thead>
      <tbody>${tableRows.join('')}</tbody></table>
      ${tableExportButtons()}
      <details class="tournamentStandingsInfo" open><summary>Gespielte Breaks ab 20</summary>
        ${playedBreaks.map(row => `<p class="small tournamentStandingsInfo"><strong>${esc(row.name)}</strong> · ${row.breaks.join(', ')}</p>`).join('')
          || '<p class="small tournamentStandingsInfo">Bisher keine Breaks eingetragen.</p>'}
      </details></div>`;
  }

  function renderMatchTime(match, index) {
    if (match.startedAt == null) {
      return match.result || match.table ? '<p class="small">Spielzeit nicht erfasst</p>' : '';
    }
    return `<p class="small">Spielzeit <time data-match-time="${index}"></time></p>`;
  }

  function updateClocks() {
    const now = Date.now();
    for (const clock of panel.querySelectorAll('[data-match-time]')) {
      const [roundIndex, matchIndex] = clock.dataset.matchTime.split(':').map(Number);
      const match = tournament.rounds[roundIndex].matches[matchIndex];
      const seconds = Math.max(0, Math.floor(((match.finishedAt ?? tournament.ended ?? now) - match.startedAt) / 1000));
      clock.textContent = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
        .map(number => String(number).padStart(2, '0')).join(':');
    }
  }

  function validBackup(data, allowParked = true) {
    const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
    const timestamp = value => value == null || (Number.isFinite(value) && value >= 0);
    if (!data || !Array.isArray(data.players) || !integer(data.players.length, 2, 12)
      || !data.players.every(name => typeof name === 'string' && name.trim())
      || !integer(data.tables, 1, 6)
      || (data.framesPerMatch == null ? !integer(data.target, 1, 50)
        : !integer(data.framesPerMatch, 1, 50) || ![0, 0.5, 1].includes(data.byePoints))
      || !Array.isArray(data.rounds) || !data.rounds.length
      || !(data.limit === null || integer(data.limit, data.rounds.length, 999))
      || (data.playDate != null && (typeof data.playDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.playDate)))
      || !timestamp(data.ended) || !timestamp(data.endAt)
      || !(data.finishLastRound == null || typeof data.finishLastRound === 'boolean')
      || !(data.filename == null || typeof data.filename === 'string')) return false;
    const validDay = day => day && typeof day.id === 'string' && Array.isArray(day.rows) &&
      (day.playDate == null || (typeof day.playDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day.playDate))) &&
      (day.number == null || integer(day.number,1,999999)) &&
      (day.completed == null || typeof day.completed === 'boolean') &&
      day.rows.every(row => row && typeof row.name === 'string' && row.name.trim() &&
        Number.isFinite(row.points) && row.points >= 0 &&
        (row.place == null || integer(row.place,1,12)));
    if (data.overallDays != null && (!Array.isArray(data.overallDays) || !data.overallDays.every(validDay))) return false;
    if (data.yearDays != null && (!Array.isArray(data.yearDays) || !data.yearDays.every(validDay))) return false;
    if (data.deletedDays != null && (!Array.isArray(data.deletedDays) ||
      !data.deletedDays.every(id => typeof id === 'string'))) return false;
    if (!timestamp(data.seasonStarted) || (data.seasonArchive != null && (!Array.isArray(data.seasonArchive) ||
      !data.seasonArchive.every(season => season && Number.isFinite(season.ended) && typeof season.name === 'string' &&
        (season.days == null || (Array.isArray(season.days) && season.days.every(validDay))) &&
        Array.isArray(season.rows) && season.rows.every(row => row && typeof row.name === 'string' &&
          Number.isFinite(row.points) && Number.isInteger(row.place) && Number.isInteger(row.appearances)))))) return false;
    if ((data.freeTournament != null && typeof data.freeTournament !== 'boolean') ||
      !timestamp(data.parkedAt) || (data.parkedTournament != null &&
        (!allowParked || Boolean(data.freeTournament) === Boolean(data.parkedTournament.freeTournament) ||
          !validBackup(data.parkedTournament, false)))) return false;
    const name = value => typeof value === 'string' && value.trim();
    if (data.elo != null && (!timestamp(data.elo.resetAt) || !Array.isArray(data.elo.games) ||
      !data.elo.games.every(game => game && typeof game.id === 'string' && Number.isFinite(game.at) && game.at > 0 &&
        Array.isArray(game.names) && game.names.length === 2 && game.names.every(name) && [0,.5,1].includes(game.score)) ||
      !Array.isArray(data.elo.edits) || !data.elo.edits.every(edit => edit && Number.isFinite(edit.at) && edit.at > 0 &&
        name(edit.name) && integer(edit.rating, 0, 9999)))) return false;
    const validPlayer = id => integer(id, 0, data.players.length - 1);
    return data.rounds.every(round => {
      if (!round || !Array.isArray(round.matches) || !round.matches.length || round.matches.length > Math.floor(data.players.length / 2)
        || !(round.bye === null || (data.players.length % 2 && validPlayer(round.bye)))) return false;
      const players = round.bye === null ? [] : [round.bye];
      for (const match of round.matches) {
        if (!match || !Array.isArray(match.players) || match.players.length !== 2
          || !match.players.every(validPlayer) || !(match.table === null || integer(match.table, 1, data.tables))
          || !timestamp(match.startedAt) || !timestamp(match.finishedAt) || !timestamp(match.eloAt)
          || !(match.paused == null || typeof match.paused === 'boolean')
          || (match.paused && (match.table !== null || match.result !== null))) return false;
        players.push(...match.players);
        if (match.result === null) continue;
        const result = match.result;
        if (!result || !Array.isArray(result.frames) || !validMatchFrames(result.frames, data)
          || !Array.isArray(result.breaks) || result.breaks.length !== 2
          || !result.breaks.every(list => Array.isArray(list) && list.every(value => integer(value, 20, 155)))) return false;
      }
      return new Set(players).size === players.length;
    });
  }

  function renderBackupControls() {
    panel.insertAdjacentHTML('beforeend', `<details class="card tournamentBackup"><summary>Turnier sichern · Speichern / Laden</summary>
      <div class="tournamentActions">
        ${tournament ? '<button type="button" class="secondary" id="saveTournamentFile">Turnier speichern</button>' : ''}
        <button type="button" class="secondary" id="restoreTournamentFile">Turnier wiederherstellen</button>
      </div>
      <input id="tournamentFileInput" type="file" accept=".json,application/json" class="hidden">
      <p class="tournamentStatus" id="tournamentBackupStatus" role="status"></p>
    </details>`);
    if (tournament) $('saveTournamentFile').onclick = async () => {
      const status = $('tournamentBackupStatus');
      status.textContent = '';
      try {
        if (await exportTournament()) { saveTournament(); $('tournamentBackupStatus').textContent = 'Turnierdatei bereitgestellt.'; }
      } catch (error) {
        status.textContent = 'Turnierdatei konnte nicht gespeichert werden.';
      }
    };
    const input = $('tournamentFileInput');
    $('restoreTournamentFile').onclick = () => input.click();
    input.onchange = async () => {
      const file = input.files[0];
      input.value = '';
      if (!file) return;
      try {
        const backup = JSON.parse(await file.text());
        if (backup?.app !== 'Snooker Swiss Tournament' || backup.version !== 1 || !validBackup(backup.tournament)) {
          throw new Error('Ungültige Turnierdatei');
        }
        if (tournament && !confirm('Den gesamten gespeicherten Turnierstand auf diesem Gerät durch die Datei ersetzen? Ergebnisse, Saison- und Jahresarchive sowie Elo werden vollständig aus der Datei übernommen. Der bisherige Turnierverlauf kann danach nicht über Zurück wiederhergestellt werden.')) return;
        tournament = backup.tournament;
        remoteTournament = null;
        undoStates = [];
        redoStates = [];
        archiveSelection = null;
        draftFreeTournament = null;
        drafting = false;
        openMatch = null;
        view = 'rounds';
        saveTournament(false, true);
        $('tournamentBackupStatus').textContent = 'Turnierstand vollständig aus der Datei übernommen.';
      } catch (error) {
        $('tournamentBackupStatus').textContent = 'Turnier konnte nicht wiederhergestellt werden. Bitte eine gültige Turnier-Sicherung auswählen.';
      }
    };
  }

  function publishTournament(before, replace = false) {
    if (before === committed && !replace) return;
    remoteTournament = null;
    window.dispatchEvent(new CustomEvent('snooker-tournament-publish', {detail:{before, after:committed, replace}}));
  }

  window.addEventListener('snooker-tournament-connection', ({detail}) => {
    liveStatus = detail.message;
    if (!detail.available) sharedView = null;
    const status = $('tournamentLiveStatus');
    if (status) status.textContent = liveStatus;
  });

  window.addEventListener('snooker-tournament-received', ({detail}) => {
    try {
      const data = JSON.parse(detail);
      if (data !== null && !validBackup(data)) return;
      remoteTournament = {data, raw:detail};
      if (openMatch === null && !drafting) {
        if (panel.classList.contains('hidden')) applyRemoteTournament();
        else renderTournament();
      }
    } catch { /* Keep the last valid tournament. */ }
  });

  function applyRemoteTournament() {
    if (!remoteTournament || openMatch !== null || drafting) return;
    const {data, raw} = remoteTournament;
    remoteTournament = null;
    if (raw === committed) return;
    tournament = data;
    committed = raw;
    undoStates = [];
    redoStates = [];
    localStorage.setItem(key, raw);
    if (!data) {
      view = 'rounds';
      setTournamentFullscreen(false);
    }
  }

  window.addEventListener('snooker-tournament-view-received', ({detail}) => {
    if (detail !== 'standings' && detail !== 'overall') return;
    sharedView = detail;
    if (!tournament || drafting || openMatch !== null || panel.classList.contains('hidden') || view === detail) return;
    view = detail;
    renderTournament();
    if (fullscreen) panel.scrollTop = 0;
    else window.scrollTo(0, 0);
  });

  function renderTournamentTable(data) {
    panel.insertAdjacentHTML('beforeend', view === 'days' ? renderDayElo(data) : view === 'overall' ? renderOverall(data) : renderStandings(data));
    setTournamentFullscreen(fullscreen);
    if ($('tournamentFullscreenToggle')) $('tournamentFullscreenToggle').onclick = () => setTournamentFullscreen(!fullscreen);
    panel.querySelectorAll('[data-archive-select]').forEach(button => {
      button.onclick = () => {
        archiveSelection = archiveSelection === button.dataset.archiveSelect ? null : button.dataset.archiveSelect;
        renderTournament();
      };
    });
    if ($('deleteTournamentYear')) $('deleteTournamentYear').onclick = () => deleteTournamentYear(archiveSelection);
    const elo = $('tournamentElo');
    if (elo) {
      const rows = eloRows(data);
      $('resetTournamentElo').onclick = resetElo;
      elo.querySelectorAll('[data-edit-elo]').forEach(button => {
        button.onclick = () => editElo(rows[Number(button.dataset.editElo)]);
      });
    }
    if ($('newTournamentSeason')) $('newTournamentSeason').onclick = startTournamentSeason;
    panel.querySelectorAll('[data-delete-season]').forEach(button => {
      const season = data.seasonArchive[Number(button.dataset.deleteSeason)];
      button.onclick = () => deleteArchivedSeason(season);
    });
    panel.querySelectorAll('[data-export-table]').forEach(button => {
      const details = button.closest('details');
      const daySection = button.closest('[data-day-table]');
      const eloSection = button.closest('#tournamentElo');
      const section = daySection ?? eloSection ?? details ?? button.closest('.tournamentStandings');
      const table = section.querySelector(':scope > .tournamentTable');
      if (!table) { button.disabled = true; return; }
      const date = tournamentDateLabel(data);
      const title = daySection ? daySection.dataset.exportTitle : eloSection ? 'Elo-Wertung' : details ? details.querySelector('summary').textContent.trim()
        : view === 'overall' ? (data.freeTournament ? 'Gesamt' : 'Tabelle Saison')
        : data.freeTournament ? 'Freies Turnier · ' + tournamentTitle(data, true)
        : data.ended ? tournamentTitle(data, true) : 'Tabelle Turniertag';
      const datedTitle = date && !daySection && (!details || details.id === 'tournamentElo') && !title.includes(date)
        ? title + ' · ' + date : title;
      button.onclick = () => exportTournamentTable(datedTitle, table, button.dataset.exportTable)
        .catch(() => alert('Die Tabelle konnte nicht gespeichert werden.'));
    });
  }

  function renderLiveStatus() {
    panel.insertAdjacentHTML('beforeend', `<p class="small" id="tournamentLiveStatus" role="status">${esc(liveStatus)}</p>`);
  }

  function renderTournament() {
    refreshPlayerList = null;
    applyRemoteTournament();
    panel.innerHTML = '<button type="button" id="tournamentHome" class="secondary tournamentTop">← Startseite</button>';
    $('tournamentHome').onclick = () => {
      if (openMatch !== null && !confirm('Ergebniseingabe ohne Speichern verlassen?')) return;
      openMatch = null;
      drafting = false;
      draftFreeTournament = null;
      showMode('home');
    };
    panel.insertAdjacentHTML('beforeend', `<div class="tournamentActions tournamentHistory"><button type="button" class="secondary" id="tournamentUndo" ${!drafting && undoStates.length ? '' : 'disabled'}>↶ Zurück</button><button type="button" class="secondary" id="tournamentRedo" ${!drafting && redoStates.length ? '' : 'disabled'}>Vor ↷</button></div>${tournament && !tournament.ended && !drafting ? '<button type="button" class="secondary tournamentEnd" id="finishTournamentAnytime">Turnier beenden</button>' : ''}`);
    $('tournamentUndo').onclick = () => historyStep(-1);
    $('tournamentRedo').onclick = () => historyStep(1);
    if ($('finishTournamentAnytime')) $('finishTournamentAnytime').onclick = finishTournament;
    if (!tournament || drafting) {
      // Keep the home control outside the setup form.
      const home = $('tournamentHome');
      const history = panel.querySelector('.tournamentHistory');
      renderSetup();
      panel.prepend(home, history);
      renderBackupControls();
      renderLiveStatus();
      return;
    }

    panel.insertAdjacentHTML('beforeend', `<div class="card tournamentActions">
      <strong>${tournament.freeTournament ? 'Freies Turnier' : 'Club Liga Saison'}</strong>
    </div>`);

    panel.insertAdjacentHTML('beforeend', `
      <nav class="tournamentActions tournamentViews" aria-label="Turnieransicht">
        <button type="button" id="tournamentRoundsView" class="${view === 'rounds' ? 'primary' : 'secondary'}"
          aria-pressed="${view === 'rounds'}">Runden</button>
        <button type="button" id="tournamentStandingsView" class="${view === 'standings' ? 'primary' : 'secondary'}"
          aria-pressed="${view === 'standings'}">${tournament.freeTournament ? tournamentTitle(tournament, true) : 'Tabelle Turniertag'}</button>
        <button type="button" id="tournamentOverallView" class="${view === 'overall' ? 'primary' : 'secondary'}"
          aria-pressed="${view === 'overall'}">${tournament.freeTournament ? 'Gesamt' : 'Tabelle Saison'}</button>
        <button type="button" id="tournamentDaysView" class="${view === 'days' ? 'primary' : 'secondary'}"
          aria-pressed="${view === 'days'}">${tournament.freeTournament ? 'Spieltage' : 'Spieltage &amp; Elo'}</button>
      </nav>`);
    $('tournamentRoundsView').onclick = () => showTournamentView('rounds');
    $('tournamentStandingsView').onclick = () => showTournamentView('standings');
    $('tournamentOverallView').onclick = () => showTournamentView('overall');
    if ($('tournamentDaysView')) $('tournamentDaysView').onclick = () => showTournamentView('days');
    if (view === 'standings' || view === 'overall' || view === 'days') {
      renderLiveStatus();
      renderTournamentTable(tournament);
      return;
    }

    const number = tournament.rounds.length;
    const unfinished = tournament.rounds.flatMap(round => round.matches.filter(match => !match.result));
    const complete = unfinished.length === 0;
    const freeTables = availableTables();
    // Keep at most one round ahead of the latest round that has seen activity.
    const latestHasActivity = tournament.rounds.at(-1).matches.some(match => match.table || match.result || match.paused);
    const pendingPlayers = new Set(unfinished.flatMap(match => match.players));
    const readyPlayers = new Set(tournament.players.map((_, id) => id).filter(id => !pendingPlayers.has(id)));
    const nextRound = !tournament.ended && !hasStartableMatch() && !expired() && !tournament.finishLastRound && openMatch === null && (tournament.limit === null || number < tournament.limit)
      && (complete || (freeTables.length && latestHasActivity))
      ? pairRound(complete ? null : {readyPlayers, freeTableCount: freeTables.length}) : null;
    const replacement = !tournament.ended && openMatch === null ? replacementRound() : null;
    const mode = tournament.limit === null ? 'Endlos' : `${tournament.limit} Runden`;
    const openRounds = tournament.rounds.flatMap((round, i) => round.matches.some(match => !match.result) ? [i + 1] : []);
    const previousPlayers = new Set();
    const roundCards = tournament.rounds.map((round, roundIndex) => {
      const roundComplete = round.matches.every(match => match.result);
      const title = `Runde ${roundIndex + 1}${tournament.limit === null ? '' : ` / ${tournament.limit}`}`;
      const content = `${round.bye === null ? '' : `<p class="tournamentStatus">Freilos · ${esc(tournament.players[round.bye])}</p>`}
        ${round.matches.map((match, i) => renderMatch(match, `${roundIndex}:${i}`, freeTables,
          !match.table && match.players.some(id => previousPlayers.has(id)))).join('')}`;
      for (const match of round.matches) {
        if (!match.result) match.players.forEach(id => previousPlayers.add(id));
      }
      return roundComplete && roundIndex < number - 1
        ? `<details class="card tournamentRound" ${openMatch?.startsWith(`${roundIndex}:`) ? 'open' : ''}><summary>${title} · abgeschlossen</summary>${content}</details>`
        : `<div class="card tournamentRound"><h3>${title}${roundComplete ? ' · abgeschlossen' : tournament.ended ? '' : ' · läuft'}</h3>${roundIndex === number - 1 ? `${replacement ? '<button type="button" class="secondary" id="repairTournamentRound">Paarungen neu erstellen</button>' : ''}${nextRound ? `<button type="button" class="primary" id="nextTournamentRound">${complete ? 'Nächste Runde starten' : 'Neue Runde starten'}</button>` : ''}` : ''}${content}</div>`;
    });
    panel.insertAdjacentHTML('beforeend', `
      <div class="card tournamentOverview">
        <h2>${esc(tournamentTitle(tournament))}</h2>
        <p>${mode} · ${tournament.framesPerMatch == null ? `First to ${tournament.target}` : `${tournament.framesPerMatch} Frames pro Match · Freilos: ${formatPoints(tournament.byePoints)} Pkt.`} · ${tournament.tables} Tisch(e)</p>
        <p class="tournamentStatus">${tournament.ended ? 'Turnier beendet' : openRounds.length
          ? `${openRounds.length === 1 ? 'Laufende Runde' : 'Laufende Runden'} · ${openRounds.join(', ')}`
          : `Runde ${number} abgeschlossen`}</p>
        ${tournament.limit === null ? `<p class="tournamentStatus">Turnierende: ${tournament.endAt != null ? endLabel() : 'Noch nicht festgelegt'}${expired() ? ' · Endzeit erreicht' : ''}${tournament.finishLastRound ? ' · Letzte Runde wird zu Ende gespielt' : ''}</p>${!tournament.ended ? '<button type="button" class="secondary" id="changeEndTime">Endzeit ändern</button>' : ''}` : ''}
        <div class="tournamentActions">
          ${tournament.ended ? '<button type="button" class="primary" id="newTournament">Neues Turnier</button>' : ''}
        </div>
      </div>
    `);
    if ($('changeEndTime')) $('changeEndTime').onclick = editEndTime;
    renderBackupControls();
    renderLiveStatus();
    panel.insertAdjacentHTML('beforeend', roundCards.reverse().join(''));
    updateClocks();

    function matchAt(index) {
      const [roundIndex, matchIndex] = index.split(':').map(Number);
      return tournament.rounds[roundIndex].matches[matchIndex];
    }
    panel.querySelectorAll('[data-start]').forEach(button => {
      button.onclick = () => {
        const match = matchAt(button.dataset.start);
        const table = Number(button.dataset.table);
        if (tournament.ended || match.result || match.table || match.paused || !availableTables().includes(table)) {
          renderTournament(); return;
        }
        match.table = table;
        match.startedAt = Date.now();
        saveTournament();
      };
    });
    panel.querySelectorAll('[data-pause]').forEach(button => {
      button.onclick = () => {
        const match = matchAt(button.dataset.pause);
        if (tournament.ended || match.result || match.table) return;
        match.paused = !match.paused;
        saveTournament();
      };
    });
    panel.querySelectorAll('[data-edit]').forEach(button => {
      button.onclick = () => openResultDialog(matchAt(button.dataset.edit), button.dataset.edit);
    });
    if ($('repairTournamentRound')) $('repairTournamentRound').onclick = () => {
      if (!confirm('Die Paarungen der letzten, noch nicht gestarteten Runde neu erstellen?')) return;
      tournament.rounds[number - 1] = replacement;
      saveTournament();
    };
    if ($('nextTournamentRound')) $('nextTournamentRound').onclick = () => {
      if (expired() || tournament.finishLastRound || tournament.ended || hasStartableMatch()) { checkDeadline(); return; }
      openMatch = null;
      tournament.rounds.push(nextRound);
      saveTournament();
    };
    if ($('newTournament')) $('newTournament').onclick = () => {
      draftFreeTournament = null;
      drafting = true;
      renderTournament();
    };
  }

  showMode('home');
  setInterval(() => { updateClocks(); checkDeadline(); }, 1000);
})();
