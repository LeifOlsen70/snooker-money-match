(() => {
  'use strict';

  const key = 'snookerSwissTournamentV1';
  const panel = $('tournamentMode');
  let tournament = null;
  let openMatch = null;
  let drafting = false;

  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved?.players?.length && saved?.rounds?.length) tournament = saved;
  } catch (error) {
    console.warn('Turnierstand konnte nicht geladen werden.', error);
  }

  function showMode(mode) {
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
  $('openTournament').onclick = () => showMode('tournament');

  // Only confirmed results and assigned byes count toward the standings.
  function standings() {
    const rows = tournament.players.map((name, id) => ({
      name, id, wins: 0, byes: 0, diff: 0, money: 0, breaks: []
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
          for (const points of breaks) {
            player.breaks.push(points);
            player.money += breakValue(points);
          }
        });
      }
    }
    for (const row of rows) row.points = row.wins + row.byes;
    return rows.sort((a, b) => b.points - a.points || b.diff - a.diff || a.id - b.id);
  }

  function createRound() {
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
      const index = rows.findLastIndex(row => row.byes === fewestByes);
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
    const memo = new Map([[0, {cost: [0, 0, 0], pairs: []}]]);
    function bestPairing(mask) {
      if (memo.has(mask)) return memo.get(mask);
      const first = rows.findIndex((_, index) => mask & (1 << index));
      const remaining = mask ^ (1 << first);
      const a = rows[first];
      let best;
      for (let second = first + 1; second < rows.length; second++) {
        if (!(remaining & (1 << second))) continue;
        const b = rows[second];
        const previous = meetings[a.id][b.id];
        const rest = bestPairing(remaining ^ (1 << second));
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
      memo.set(mask, best);
      return best;
    }

    const matches = bestPairing((1 << rows.length) - 1).pairs.map(players => ({
      players, table: null, result: null
    }));
    tournament.rounds.push({matches, bye});
  }

  function saveTournament() {
    localStorage.setItem(key, JSON.stringify(tournament));
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
              <option value="endless">Endlos · manuell beenden</option></select>
            </label>
            <label id="tournamentRoundCount">Anzahl Runden
              <input name="rounds" type="number" min="1" max="999" value="3" required>
            </label>
            <label>Frames zum Matchsieg
              <input name="target" type="number" min="1" max="50" value="2" required>
            </label>
            <label>Verfügbare Tische
              <input name="tables" type="number" min="1" max="6" value="1" required>
            </label>
          </div>
          <div id="tournamentNames" class="tournamentFields"></div>
          <p class="tournamentStatus" id="tournamentSetupError" role="alert"></p>
          <button class="primary">Turnier starten</button>
          ${tournament ? '<button type="button" class="secondary" id="cancelTournamentSetup">Abbrechen</button>' : ''}
        </form>
      </div>`;

    const form = $('tournamentSetup');
    const names = $('tournamentNames');
    const drafts = [];
    function renderNames() {
      names.querySelectorAll('input').forEach((input, i) => { drafts[i] = input.value; });
      names.innerHTML = Array.from({length:Number(form.elements.count.value)}, (_, i) =>
        `<label>Spieler ${i + 1}<input name="player" maxlength="60" required value="${esc(drafts[i] || '')}"></label>`
      ).join('');
    }
    renderNames();
    form.elements.count.onchange = renderNames;
    form.elements.duration.onchange = () => {
      const endless = form.elements.duration.value === 'endless';
      $('tournamentRoundCount').classList.toggle('hidden', endless);
      form.elements.rounds.disabled = endless;
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
      if (tournament && !confirm('Das bisherige Turnier wird durch das neue ersetzt. Fortfahren?')) return;
      tournament = {
        players,
        limit: form.elements.duration.value === 'endless' ? null : Number(form.elements.rounds.value),
        target: Number(form.elements.target.value),
        tables: Number(form.elements.tables.value),
        started: Date.now(), ended: null, rounds: []
      };
      drafting = false;
      openMatch = null;
      createRound();
      saveTournament();
    };
  }

  function renderMatch(match, index, freeTable) {
    const names = match.players.map(id => esc(tournament.players[id]));
    let status = 'Wartet';
    if (match.result) status = 'Fertig';
    else if (tournament.ended) status = 'Offen bei Turnierende';
    else if (match.table) status = `Am Tisch ${match.table}`;
    const editing = !tournament.ended && openMatch === index;
    return `<article class="tournamentMatch">
      <h4>${names.join(' – ')}</h4>
      <p class="tournamentStatus">${status}${match.result ? ` · ${match.result.frames.join(':')}` : ''}</p>
      ${!tournament.ended && openMatch === null ? `<div class="tournamentActions">
        ${!match.result && !match.table && freeTable ? `<button type="button" class="secondary" data-start="${index}">An Tisch ${freeTable} starten</button>` : ''}
        <button type="button" class="secondary" data-edit="${index}">${match.result ? 'Ergebnis korrigieren' : 'Ergebnis eintragen'}</button>
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
    return `<div class="card"><h3>${tournament.ended ? 'Abschlusstabelle' : 'Zwischenstand'}</h3>
      <table class="tournamentTable"><thead><tr><th>Pl.</th><th>Spieler</th><th>Pkt.</th><th>Siege</th><th>Frame-Δ</th></tr></thead>
      <tbody>${tableRows.join('')}</tbody></table>
      <p class="small">1 Punkt je Matchsieg oder Freilos. Bei Punktgleichheit zählt die Frame-Differenz.</p>
      <details><summary>Break-Abrechnung</summary>
        ${rows.map(row => `<p class="small"><strong>${esc(row.name)}</strong> · ${euro(row.money)} · ${row.breaks.join(', ') || 'keine Breaks ab 20'}</p>`).join('')}
      </details></div>`;
  }

  function updateClock() {
    const clock = $('tournamentClock');
    if (!clock || !tournament) return;
    const seconds = Math.max(0, Math.floor(((tournament.ended || Date.now()) - tournament.started) / 1000));
    clock.textContent = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
      .map(number => String(number).padStart(2, '0')).join(':');
  }

  function renderTournament() {
    panel.innerHTML = '<button type="button" id="tournamentHome" class="secondary tournamentTop">← Startseite</button>';
    $('tournamentHome').onclick = () => {
      if (openMatch !== null && !confirm('Ergebniseingabe ohne Speichern verlassen?')) return;
      openMatch = null;
      showMode('home');
    };
    if (!tournament || drafting) {
      // Keep the home control outside the setup form.
      const home = $('tournamentHome');
      renderSetup();
      panel.prepend(home);
      return;
    }

    const round = tournament.rounds.at(-1);
    const number = tournament.rounds.length;
    const complete = round.matches.every(match => match.result);
    const freeTable = Array.from({length:tournament.tables}, (_, i) => i + 1)
      .find(table => !round.matches.some(match => !match.result && match.table === table));
    const mode = tournament.limit === null ? 'Endlos' : `${tournament.limit} Runden`;
    panel.insertAdjacentHTML('beforeend', `
      <div class="card">
        <h2>Schweizer Turnier</h2>
        <p>${mode} · First to ${tournament.target} · ${tournament.tables} Tisch(e)</p>
        <p>${tournament.ended ? 'Beendet nach' : 'Spielzeit'} <time id="tournamentClock"></time></p>
        <h3>Runde ${number}${tournament.limit === null ? '' : ` / ${tournament.limit}`}</h3>
        ${round.bye === null ? '' : `<p class="tournamentStatus">Freilos · ${esc(tournament.players[round.bye])}</p>`}
        ${round.matches.map((match, index) => renderMatch(match, index, freeTable)).join('')}
        <div class="tournamentActions">
          ${!tournament.ended && openMatch === null && complete && (tournament.limit === null || number < tournament.limit)
            ? '<button type="button" class="primary" id="nextTournamentRound">Nächste Runde auslosen</button>' : ''}
          ${!tournament.ended && openMatch === null && tournament.limit === null
            ? '<button type="button" class="secondary" id="endTournament">Turnier beenden</button>' : ''}
          ${!tournament.ended && openMatch === null && complete && number === tournament.limit
            ? '<button type="button" class="primary" id="endTournament">Turnier abschließen</button>' : ''}
          ${tournament.ended ? '<button type="button" class="primary" id="newTournament">Neues Turnier</button>' : ''}
        </div>
      </div>
      ${renderStandings()}
      ${number > 1 ? `<div class="card"><h3>Frühere Runden</h3>
        ${tournament.rounds.slice(0, -1).map((past, i) => `<details><summary>Runde ${i + 1}</summary>
          ${past.bye === null ? '' : `<p>Freilos · ${esc(tournament.players[past.bye])}</p>`}
          ${past.matches.map(match => `<p>${match.players.map(id => esc(tournament.players[id])).join(' – ')} · ${match.result.frames.join(':')}</p>`).join('')}
        </details>`).join('')}</div>` : ''}
    `);

    updateClock();
    panel.querySelectorAll('[data-start]').forEach(button => {
      button.onclick = () => {
        round.matches[Number(button.dataset.start)].table = freeTable;
        saveTournament();
      };
    });
    panel.querySelectorAll('[data-edit]').forEach(button => {
      button.onclick = () => {
        openMatch = Number(button.dataset.edit);
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
        round.matches[openMatch].result = {frames, breaks};
        openMatch = null;
        saveTournament();
      };
    }
    if ($('nextTournamentRound')) $('nextTournamentRound').onclick = () => {
      openMatch = null;
      createRound();
      saveTournament();
    };
    if ($('endTournament')) $('endTournament').onclick = () => {
      if (!complete && !confirm('Diese Runde hat offene Matches. Turnier mit den bisher eingetragenen Ergebnissen beenden?')) return;
      tournament.ended = Date.now();
      openMatch = null;
      saveTournament();
    };
    if ($('newTournament')) $('newTournament').onclick = () => {
      drafting = true;
      renderTournament();
    };
  }

  showMode('home');
  setInterval(updateClock, 1000);
})();
