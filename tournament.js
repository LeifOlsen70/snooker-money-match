(() => {
  'use strict';

  const key = 'snookerSwissTournamentV1';
  const panel = $('tournamentMode');
  let tournament = null;
  let openMatch = null;
  let drafting = false;
  let view = 'rounds';
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
  function hasStartableMatch() {
    if (!availableTables().length) return false;
    const earlierPlayers = new Set();
    for (const round of tournament.rounds) {
      if (round.matches.some(match => !match.result && !match.table &&
          match.players.every(id => !earlierPlayers.has(id)))) return true;
      for (const match of round.matches) {
        if (!match.result) match.players.forEach(id => earlierPlayers.add(id));
      }
    }
    return false;
  }
  const rosterKey = 'snookerSwissPlayerNamesV1';
  let playerNames = [];
  try {
    const stored = JSON.parse(localStorage.getItem(rosterKey));
    if (Array.isArray(stored)) playerNames = stored.filter(name => typeof name === 'string' && name.trim());
  } catch (error) { console.warn('Spielerliste konnte nicht geladen werden.', error); }
  function rememberPlayers(names) {
    const known = new Set(playerNames.map(name => name.toLocaleLowerCase('de')));
    for (const raw of names) {
      const name = raw.trim().slice(0,60);
      if (name && !known.has(name.toLocaleLowerCase('de'))) {
        playerNames.push(name); known.add(name.toLocaleLowerCase('de'));
      }
    }
    playerNames.sort((a,b) => a.localeCompare(b,'de'));
    localStorage.setItem(rosterKey, JSON.stringify(playerNames));
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
    openMatch = null; committed = JSON.stringify(tournament);
    localStorage.setItem(key, committed); renderTournament();
  }


  function setTournamentFullscreen(enabled) {
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
    renderTournament();
    window.scrollTo(0, 0);
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
      showTournamentView(dx < 0 ? 'standings' : 'rounds');
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
    $('modeStart').classList.toggle('hidden', mode !== 'home');
    $('singleMode').classList.toggle('hidden', mode !== 'single');
    panel.classList.toggle('hidden', mode !== 'tournament');
    document.body.classList.toggle('snookerFullscreenScore',
      mode === 'single' && $('scorerPage').classList.contains('displayOnly'));
    window.scrollTo(0, 0);
    if (mode === 'tournament') renderTournament();
  }

  $('openSingle').onclick = () => showMode('single');
  $('singleHome').onclick = () => showMode('home');
  $('openTournament').onclick = () => {
    view = 'rounds';
    showMode('tournament');
  };

  // Only confirmed results and assigned byes count toward the standings.
  function standings() {
    const rows = tournament.players.map((name, id) => ({
      name, id, wins: 0, byes: 0, diff: 0, breaks: []
    }));
    for (const round of tournament.rounds) {
      if (round.bye !== null) rows[round.bye].byes++;
      for (const match of round.matches) {
        if (!match.result) continue;
        const [a, b] = match.players.map(id => rows[id]);
        const [first, second] = match.result.frames;
        const winner = first > second ? a : b;
        winner.wins++;
        a.diff += first - second;
        b.diff += second - first;
        match.result.breaks.forEach((breaks, i) => {
          const player = i === 0 ? a : b;
          player.breaks.push(...breaks);
        });
      }
    }
    for (const row of rows) row.points = row.wins + row.byes;
    return rows.sort((a, b) => b.points - a.points || b.diff - a.diff || a.id - b.id);
  }

  function pairRound(readyPlayers = null) {
    const rows = standings();
    if (tournament.rounds.length === 0) {
      for (let i = rows.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rows[i], rows[j]] = [rows[j], rows[i]];
      }
    }
    let bye = null;
    if (rows.length % 2) {
      const fewestByes = Math.min(...rows.map(row => row.byes));
      const index = rows.findLastIndex(row => row.byes === fewestByes
        && (readyPlayers?.size !== 2 || !readyPlayers.has(row.id)));
      if (index === -1) return null;
      bye = rows.splice(index, 1)[0].id;
    }

    const meetings = tournament.players.map(() => tournament.players.map(() => 0));
    for (const round of tournament.rounds) {
      for (const {players: [a, b]} of round.matches) {
        meetings[a][b]++;
        meetings[b][a]++;
      }
    }
    // Find the best complete pairing, comparing repeat count, point gaps,
    // and the frequency of any unavoidable rematches in that order.
    const memo = new Map();
    function bestPairing(mask, needsReadyMatch) {
      if (!mask) return needsReadyMatch ? null : {cost: [0, 0, 0], pairs: []};
      const memoKey = mask * 2 + Number(needsReadyMatch);
      if (memo.has(memoKey)) return memo.get(memoKey);
      const first = rows.findIndex((_, index) => mask & (1 << index));
      const remaining = mask ^ (1 << first);
      const a = rows[first];
      let best;
      for (let second = first + 1; second < rows.length; second++) {
        if (!(remaining & (1 << second))) continue;
        const b = rows[second];
        const previous = meetings[a.id][b.id];
        const ready = readyPlayers?.has(a.id) && readyPlayers.has(b.id);
        const rest = bestPairing(remaining ^ (1 << second), needsReadyMatch && !ready);
        if (!rest) continue;
        const cost = [
          rest.cost[0] + Number(previous > 0),
          rest.cost[1] + Math.abs(a.points - b.points),
          rest.cost[2] + previous
        ];
        const difference = best && cost.findIndex((value, index) => value !== best.cost[index]);
        if (!best || (difference >= 0 && cost[difference] < best.cost[difference])) {
          best = {cost, pairs: [[a.id, b.id], ...rest.pairs]};
        }
      }
      memo.set(memoKey, best);
      return best;
    }

    const pairing = bestPairing((1 << rows.length) - 1, readyPlayers !== null);
    if (!pairing) return null;
    const matches = pairing.pairs.map(players => ({
      players, table: null, result: null
    }));
    return {matches, bye};
  }

  function saveTournament() {
    const next = JSON.stringify(tournament);
    if (next !== committed) {
      undoStates.push(JSON.parse(committed));
      if (undoStates.length > 100) undoStates.shift();
      redoStates = []; committed = next;
    }
    localStorage.setItem(key, next);
    renderTournament();
  }

  function renderSetup() {
    panel.innerHTML = `
      <div class="card">
        <h2>Schweizer Turnier anlegen</h2>
        <form id="tournamentSetup">
          <div class="tournamentFields">
            <label>Spieleranzahl
              <select name="count">${Array.from({length:11}, (_, i) =>
                `<option ${i === 2 ? 'selected' : ''}>${i + 2}</option>`).join('')}</select>
            </label>
            <label>Turnierdauer
              <select name="duration"><option value="fixed">Feste Rundenzahl</option>
              <option value="endless">Nach Zeit · Endlos</option></select>
            </label>
            <label id="tournamentRoundCount">Anzahl Runden
              <input name="rounds" type="number" min="1" max="999" value="3" required>
            </label>
            <label id="tournamentEndTime" class="hidden">Turnierende · Uhrzeit
              <input name="endAt" type="time" value="${localTime(Date.now()+3*3600000)}">
            </label>
            <label>Frames zum Matchsieg
              <input name="target" type="number" min="1" max="50" value="2" required>
            </label>
            <label>Verfügbare Tische
              <input name="tables" type="number" min="1" max="6" value="1" required>
            </label>
          </div>
          <section class="tournamentRoster" aria-label="Gespeicherte Spieler">
            <h3>Spieler auswählen</h3>
            <p class="small">Namen antippen, um sie für dieses Turnier auszuwählen. Erneutes Tippen entfernt die Auswahl. Zum Löschen eine Zeile nach links wischen oder auf ⋯ tippen.</p>
            <div id="savedTournamentPlayers" class="tournamentPlayerChoices"></div>
            <div class="tournamentRosterAdd"><label>Neuer Spieler<input id="newTournamentPlayerName" type="text" maxlength="60" placeholder="Name"></label><button type="button" class="secondary" id="addTournamentPlayer">Hinzufügen</button></div>
            <p id="tournamentPlayerMessage" class="small" role="status"></p>
          </section>
          <div id="tournamentNames" class="tournamentFields"></div>
          <p class="tournamentStatus" id="tournamentSetupError" role="alert"></p>
          <button class="primary">Turnier starten</button>
          ${tournament ? '<button type="button" class="secondary" id="cancelTournamentSetup">Abbrechen</button>' : ''}
        </form>
      </div>`;

    const form = $('tournamentSetup');
    const names = $('tournamentNames');
    const drafts = [];
    let suppressPickUntil = 0;
    function renderPlayerList() {
      const inputs = Array.from(names.querySelectorAll('input'));
      const selected = new Set(inputs.map(input => input.value.trim().toLocaleLowerCase('de')));
      $('savedTournamentPlayers').innerHTML = playerNames.map((name,i) => {
        const active = selected.has(name.toLocaleLowerCase('de'));
        return `<div class="tournamentPlayerRow">
          <button type="button" class="tournamentPlayerDelete" data-delete-player="${i}" hidden>Löschen</button>
          <div class="tournamentPlayerFace">
            <button type="button" class="tournamentPlayerPick ${active ? 'selected' : ''}" data-pick-player="${i}" aria-pressed="${active}"><span class="tournamentPlayerCheck" aria-hidden="true">${active ? '✓' : '○'}</span><span>${esc(name)}</span></button>
            <button type="button" class="tournamentPlayerMore" aria-label="Aktionen für ${esc(name)}" aria-expanded="false">⋯</button>
          </div>
        </div>`;
      }).join('') || '<p class="small">Noch keine Spieler gespeichert.</p>';
      function reveal(row, open) {
        if (open) $('savedTournamentPlayers').querySelectorAll('.tournamentPlayerRow').forEach(other => { if (other !== row) reveal(other,false); });
        row.classList.toggle('deleteOpen',open);
        row.querySelector('[data-delete-player]').hidden = !open;
        row.querySelector('.tournamentPlayerMore').setAttribute('aria-expanded',String(open));
      }
      $('savedTournamentPlayers').querySelectorAll('.tournamentPlayerRow').forEach(row => {
        let start = null;
        row.querySelector('.tournamentPlayerMore').onclick = () => reveal(row,!row.classList.contains('deleteOpen'));
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
        if (row.classList.contains('deleteOpen')) { reveal(row,false); return; }
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
      $('savedTournamentPlayers').querySelectorAll('[data-delete-player]').forEach(button => button.onclick = () => {
        const index = Number(button.dataset.deletePlayer), name = playerNames[index];
        if (!confirm(`${name} aus der gespeicherten Spielerliste löschen? Bereits gespielte Turniere bleiben erhalten.`)) return;
        playerNames.splice(index,1); localStorage.setItem(rosterKey,JSON.stringify(playerNames));
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
    renderNames();
    form.elements.count.onchange = renderNames;
    form.elements.duration.onchange = () => {
      const endless = form.elements.duration.value === 'endless';
      $('tournamentRoundCount').classList.toggle('hidden', endless);
      form.elements.rounds.disabled = endless;
      $('tournamentEndTime').classList.toggle('hidden', !endless);
      form.elements.endAt.required = endless;
    };
    if (tournament) $('cancelTournamentSetup').onclick = () => {
      drafting = false;
      renderTournament();
    };
    form.onsubmit = event => {
      event.preventDefault();
      const players = new FormData(form).getAll('player').map(name => name.trim());
      if (players.some(name => !name) || new Set(players.map(name => name.toLocaleLowerCase('de'))).size !== players.length) {
        $('tournamentSetupError').textContent = 'Bitte für jeden Spieler einen eindeutigen Namen eingeben.';
        return;
      }
      if (form.elements.duration.value === 'endless' && !(nextEndTime(form.elements.endAt.value) > Date.now())) {
        $('tournamentSetupError').textContent = 'Bitte eine gültige Uhrzeit für das Turnierende eingeben.'; return;
      }
      if (tournament && !confirm('Das bisherige Turnier wird durch das neue ersetzt. Fortfahren?')) return;
      rememberPlayers(players);
      tournament = {
        players,
        limit: form.elements.duration.value === 'endless' ? null : Number(form.elements.rounds.value),
        target: Number(form.elements.target.value),
        tables: Number(form.elements.tables.value),
        started: Date.now(), ended: null, rounds: [],
        endAt: form.elements.duration.value === 'endless' ? nextEndTime(form.elements.endAt.value) : null,
        finishLastRound: false
      };
      drafting = false;
      openMatch = null;
      tournament.rounds.push(pairRound());
      saveTournament();
    };
  }

  function renderMatch(match, index, freeTables, blocked) {
    const names = match.players.map(id => esc(tournament.players[id]));
    let status = 'Match wartet';
    if (match.result) status = 'Fertig';
    else if (tournament.ended) status = 'Offen bei Turnierende';
    else if (match.table) status = `Am Tisch ${match.table}`;
    else if (blocked) status = 'Wartet auf ein früheres Match';
    const editing = !tournament.ended && openMatch === index;
    return `<article class="tournamentMatch ${!match.result && !match.table && !tournament.ended ? 'tournamentWaiting' : ''}">
      <h4>${names.join(' – ')}</h4>
      <p class="tournamentStatus">${status}${match.result ? ` · ${match.result.frames.join(':')}` : ''}</p>
      ${renderMatchTime(match, index)}
      ${match.result && !editing ? match.result.breaks.map((breaks, i) =>
        breaks.length ? `<p class="small"><strong>${names[i]}</strong> · Breaks: ${breaks.join(', ')}</p>` : ''
      ).join('') : ''}
      ${!tournament.ended && openMatch === null ? `<div class="tournamentActions">
        ${!match.result && !match.table && !blocked ? freeTables.map(table => `<button type="button" class="secondary tournamentStart tournamentPulse" data-start="${index}" data-table="${table}">An Tisch ${table} starten</button>`).join('') : ''}
        ${!match.result && !match.table && (blocked || !freeTables.length) ? `<div class="tournamentWait tournamentPulse" role="status">Match wartet</div>` : ''}
        ${match.table || match.result ? `<button type="button" class="secondary ${match.result ? 'tournamentCorrect' : 'tournamentResult'}" data-edit="${index}">${match.result ? 'Ergebnis korrigieren' : 'Ergebnis eintragen'}</button>` : ''}
      </div>` : ''}
      ${editing ? `<form data-result="${index}">
        <div class="tournamentFields">${names.map((name, i) => `<div>
          <label>Frames · ${name}<input name="frames" type="number" min="0" max="${tournament.target}" required value="${match.result?.frames[i] ?? ''}"></label>
          <label>Breaks ab 20 · ${name}<input name="breaks" type="text" placeholder="z. B. 24, 38" value="${match.result?.breaks[i].join(', ') ?? ''}"></label>
        </div>`).join('')}</div>
        <p class="tournamentStatus" role="alert"></p>
        <div class="tournamentActions">
          <button class="primary">Ergebnis speichern</button>
          <button type="button" class="secondary" data-close>Abbrechen</button>
        </div>
      </form>` : ''}
    </article>`;
  }

  function renderStandings() {
    const rows = standings();
    let place = 1;
    const tableRows = rows.map((row, index) => {
      const previous = rows[index - 1];
      if (previous && (previous.points !== row.points || previous.diff !== row.diff)) place = index + 1;
      return `<tr><td>${place}</td><td>${esc(row.name)}</td><td>${row.points}</td>
        <td>${row.wins}</td><td>${row.diff > 0 ? '+' : ''}${row.diff}</td></tr>`;
    });
    const playedBreaks = rows.filter(row => row.breaks.length);
    return `<div class="card tournamentStandings">
      <div class="tournamentStandingsHeader">
        <h3>${tournament.ended ? 'Abschlusstabelle' : 'Zwischenstand'}</h3>
        <button type="button" class="secondary" id="tournamentFullscreenToggle" aria-pressed="false">Vollbild an</button>
      </div>
      ${tournament.limit === null && tournament.endAt != null ? `<p class="small">Turnierende: ${endLabel()}</p>` : ''}
      <table class="tournamentTable"><thead><tr><th>Pl.</th><th>Spieler</th><th>Pkt.</th><th>Siege</th><th>Frame-Δ</th></tr></thead>
      <tbody>${tableRows.join('')}</tbody></table>
      <p class="small">1 Punkt je Matchsieg oder Freilos. Bei Punktgleichheit zählt die Frame-Differenz.</p>
      <details open><summary>Gespielte Breaks ab 20</summary>
        ${playedBreaks.map(row => `<p class="small"><strong>${esc(row.name)}</strong> · ${row.breaks.join(', ')}</p>`).join('')
          || '<p class="small">Bisher keine Breaks eingetragen.</p>'}
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

  function validBackup(data) {
    const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
    const timestamp = value => value == null || (Number.isFinite(value) && value >= 0);
    if (!data || !Array.isArray(data.players) || !integer(data.players.length, 2, 12)
      || !data.players.every(name => typeof name === 'string' && name.trim())
      || !integer(data.tables, 1, 6) || !integer(data.target, 1, 50)
      || !Array.isArray(data.rounds) || !data.rounds.length
      || !(data.limit === null || integer(data.limit, data.rounds.length, 999))
      || !timestamp(data.ended) || !timestamp(data.endAt)
      || !(data.finishLastRound == null || typeof data.finishLastRound === 'boolean')
      || !(data.filename == null || typeof data.filename === 'string')) return false;
    const validPlayer = id => integer(id, 0, data.players.length - 1);
    return data.rounds.every(round => {
      if (!round || !Array.isArray(round.matches) || round.matches.length !== Math.floor(data.players.length / 2)
        || !(data.players.length % 2 ? validPlayer(round.bye) : round.bye === null)) return false;
      const players = round.bye === null ? [] : [round.bye];
      for (const match of round.matches) {
        if (!match || !Array.isArray(match.players) || match.players.length !== 2
          || !match.players.every(validPlayer) || !(match.table === null || integer(match.table, 1, data.tables))
          || !timestamp(match.startedAt) || !timestamp(match.finishedAt)) return false;
        players.push(...match.players);
        if (match.result === null) continue;
        const result = match.result;
        if (!result || !Array.isArray(result.frames) || result.frames.length !== 2
          || !result.frames.every(value => integer(value, 0, data.target))
          || Math.max(...result.frames) !== data.target || result.frames[0] === result.frames[1]
          || !Array.isArray(result.breaks) || result.breaks.length !== 2
          || !result.breaks.every(list => Array.isArray(list) && list.every(value => integer(value, 20, 155)))) return false;
      }
      return new Set(players).size === data.players.length;
    });
  }

  function renderBackupControls() {
    panel.insertAdjacentHTML('beforeend', `<div class="card">
      <h3>Turnier sichern</h3>
      <div class="tournamentActions">
        ${tournament ? '<button type="button" class="secondary" id="saveTournamentFile">Turnier speichern</button>' : ''}
        <button type="button" class="secondary" id="restoreTournamentFile">Turnier wiederherstellen</button>
      </div>
      <input id="tournamentFileInput" type="file" accept=".json,application/json" class="hidden">
      <p class="tournamentStatus" id="tournamentBackupStatus" role="status"></p>
    </div>`);
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
        if (tournament && !confirm('Den aktuellen Turnierstand durch die Sicherung ersetzen?')) return;
        tournament = backup.tournament;
        drafting = false;
        openMatch = null;
        view = 'rounds';
        saveTournament();
        $('tournamentBackupStatus').textContent = 'Turnier wiederhergestellt.';
      } catch (error) {
        $('tournamentBackupStatus').textContent = 'Turnier konnte nicht wiederhergestellt werden. Bitte eine gültige Turnier-Sicherung auswählen.';
      }
    };
  }

  function renderTournament() {
    const previousForm = panel.querySelector('[data-result]');
    const draftIndex = previousForm?.dataset.result;
    const draftValues = previousForm ? Array.from(previousForm.querySelectorAll('input'), input => input.value) : [];
    if (draftIndex === openMatch) queueMicrotask(() => {
      const form = panel.querySelector('[data-result]');
      if (form?.dataset.result === draftIndex) form.querySelectorAll('input').forEach((input, i) => { input.value = draftValues[i]; });
    });
    setTournamentFullscreen(false);
    panel.innerHTML = '<button type="button" id="tournamentHome" class="secondary tournamentTop">← Startseite</button>';
    $('tournamentHome').onclick = () => {
      if (openMatch !== null && !confirm('Ergebniseingabe ohne Speichern verlassen?')) return;
      openMatch = null;
      showMode('home');
    };
    panel.insertAdjacentHTML('beforeend', `<div class="tournamentActions tournamentHistory"><button type="button" class="secondary" id="tournamentUndo" ${undoStates.length ? '' : 'disabled'}>↶ Zurück</button><button type="button" class="secondary" id="tournamentRedo" ${redoStates.length ? '' : 'disabled'}>Vor ↷</button></div>${tournament && !tournament.ended && !drafting ? '<button type="button" class="secondary tournamentEnd" id="finishTournamentAnytime">Turnier beenden</button>' : ''}`);
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
      return;
    }

    panel.insertAdjacentHTML('beforeend', `
      <nav class="tournamentActions tournamentViews" aria-label="Turnieransicht">
        <button type="button" id="tournamentRoundsView" class="${view === 'rounds' ? 'primary' : 'secondary'}"
          aria-pressed="${view === 'rounds'}">Runden</button>
        <button type="button" id="tournamentStandingsView" class="${view === 'standings' ? 'primary' : 'secondary'}"
          aria-pressed="${view === 'standings'}">${tournament.ended ? 'Abschlusstabelle' : 'Zwischenstand'}</button>
      </nav>`);
    $('tournamentRoundsView').onclick = () => showTournamentView('rounds');
    $('tournamentStandingsView').onclick = () => showTournamentView('standings');
    if (view === 'standings') {
      panel.insertAdjacentHTML('beforeend', renderStandings());
      $('tournamentFullscreenToggle').onclick = () => {
        setTournamentFullscreen(!document.body.classList.contains('snookerFullscreenTournament'));
      };
      return;
    }

    const number = tournament.rounds.length;
    const unfinished = tournament.rounds.flatMap(round => round.matches.filter(match => !match.result));
    const complete = unfinished.length === 0;
    const freeTables = availableTables();
    const freeTable = freeTables[0];
    const pendingPlayers = new Set(unfinished.flatMap(match => match.players));
    const readyPlayers = new Set(tournament.players.map((_, id) => id).filter(id => !pendingPlayers.has(id)));
    const nextRound = !tournament.ended && !hasStartableMatch() && !expired() && !tournament.finishLastRound && openMatch === null && (tournament.limit === null || number < tournament.limit)
      && (complete || (freeTable && readyPlayers.size >= 2))
      ? pairRound(complete ? null : readyPlayers) : null;
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
        ? `<details class="card" ${openMatch?.startsWith(`${roundIndex}:`) ? 'open' : ''}><summary>${title} · abgeschlossen</summary>${content}</details>`
        : `<div class="card"><h3>${title}${roundComplete ? ' · abgeschlossen' : tournament.ended ? '' : ' · läuft'}</h3>${roundIndex === number - 1 ? `${nextRound ? `<button type="button" class="primary" id="nextTournamentRound">${complete ? 'Nächste Runde starten' : 'Neue Runde starten'}</button>` : ''}` : ''}${content}</div>`;
    });
    panel.insertAdjacentHTML('beforeend', `
      <div class="card">
        <h2>Schweizer Turnier</h2>
        <p>${mode} · First to ${tournament.target} · ${tournament.tables} Tisch(e)</p>
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
        if (tournament.ended || match.result || match.table || !availableTables().includes(table)) {
          renderTournament(); return;
        }
        match.table = table;
        match.startedAt = Date.now();
        saveTournament();
      };
    });
    panel.querySelectorAll('[data-edit]').forEach(button => {
      button.onclick = () => {
        const match = matchAt(button.dataset.edit);
        if (!match.table && !match.result) return;
        openMatch = button.dataset.edit;
        renderTournament();
        panel.querySelector('[data-result] input').focus();
      };
    });
    const form = panel.querySelector('[data-result]');
    if (form) {
      form.querySelector('[data-close]').onclick = () => {
        openMatch = null;
        renderTournament();
      };
      form.onsubmit = event => {
        event.preventDefault();
        const data = new FormData(form);
        const frames = data.getAll('frames').map(Number);
        const breaks = data.getAll('breaks').map(value => value.trim().split(/[,\s]+/).filter(Boolean).map(Number));
        const error = form.querySelector('[role="alert"]');
        if (Math.max(...frames) !== tournament.target || frames[0] === frames[1]) {
          error.textContent = `Genau ein Spieler muss ${tournament.target} Frames gewonnen haben.`;
          return;
        }
        if (breaks.flat().some(points => !Number.isInteger(points) || points < 20 || points > 155)) {
          error.textContent = 'Bitte Breaks als ganze Zahlen von 20 bis 155 eingeben.';
          return;
        }
        const match = matchAt(openMatch);
        if (!match.result && match.startedAt != null) match.finishedAt = Date.now();
        match.result = {frames, breaks};
        openMatch = null;
        saveTournament();
      };
    }
    if ($('nextTournamentRound')) $('nextTournamentRound').onclick = () => {
      if (expired() || tournament.finishLastRound || tournament.ended || hasStartableMatch()) { checkDeadline(); return; }
      openMatch = null;
      tournament.rounds.push(nextRound);
      saveTournament();
    };
    if ($('newTournament')) $('newTournament').onclick = () => {
      drafting = true;
      renderTournament();
    };
  }

  showMode('home');
  setInterval(() => { updateClocks(); checkDeadline(); }, 1000);
})();
