(() => {
  'use strict';
  const e=id=>document.getElementById(id);
  window.snookerTableAccess=Object.freeze({resolveName(name){return name.trim()},labelFor(){return null}});
  const device=document.createElement('dialog');device.className='tournamentDialog tableAccessDialog';
  device.innerHTML='<form><h2>Tisch beitreten</h2><p>Verfügbare Tische des laufenden Turniers auswählen, wenn du als Spielleiter angemeldet bist. Auf anderen Geräten weiterhin den Tischcode eingeben.</p><div data-available-tables aria-live="polite"></div><label>Tischcode<input required inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" autocomplete="off" placeholder="0427"></label><p role="alert"></p><div class="tournamentActions"><button class="primary">Tisch verbinden</button><button type="button" data-close>Zurück</button></div></form>';
  document.body.append(device);
  e('tableDeviceSetup').textContent='Mit Tischcode beitreten';
  const joinButton=document.createElement('button');joinButton.type='button';joinButton.textContent='Mit Tischcode beitreten';joinButton.className='secondary';document.getElementById('accountBar').append(joinButton);
  joinButton.onclick=()=>e('tableDeviceSetup').click();
  e('tableDeviceSetup').onclick=async()=>{
    const status=device.querySelector('[role=alert]'), list=device.querySelector('[data-available-tables]');
    status.textContent='';list.replaceChildren();device.showModal();
    if(!window.snookerTableBackend){status.textContent='Verbindung wird geladen. Code kann bereits manuell eingegeben werden.';return;}
    // Invitation tokens are secret credentials: Firestore rules intentionally allow
    // the owner to list them, not anonymous devices or other participants.
    const hint=document.createElement('p');hint.textContent='Verfügbare Tischcodes werden geprüft …';list.append(hint);
    try{
      const codes=await window.snookerTableBackend.availableCodes();
      if(!device.open)return;
      list.replaceChildren();
      if(!codes.length){hint.textContent='Derzeit keine aktiven Tische vorhanden.';list.append(hint);return;}
      const heading=document.createElement('p');heading.textContent='Verfügbare Tische – zum Auswählen antippen:';list.append(heading);
      for(const {slot,code} of codes){
        const button=document.createElement('button');button.type='button';button.className='secondary';
        button.textContent='Tisch '+slot+' auswählen';button.style.margin='4px';
        button.onclick=()=>{device.querySelector('input').value=code;status.textContent='Tisch '+slot+' ausgewählt. Jetzt „Tisch verbinden“ wählen.'};
        list.append(button);
      }
    }catch(err){
      if(!device.open)return;
      list.replaceChildren();
      const info=document.createElement('p');info.textContent=err.message||'Keine Tischliste verfügbar. Bitte Tischcode manuell eingeben.';list.append(info);
    }
  };
  device.querySelector('[data-close]').onclick=()=>device.close();
  device.querySelector('form').onsubmit=async event=>{
    event.preventDefault();const controls=device.querySelectorAll('button,input');controls.forEach(b=>b.disabled=true);
    const status=device.querySelector('[role=alert]');status.textContent='Tisch wird verbunden …';
    try{if(!window.snookerTableBackend)throw Error('Verbindung wird noch geladen. Bitte kurz warten.');await window.snookerTableBackend.join(device.querySelector('input').value)}
    catch(err){status.textContent=err.message||'Verbindung fehlgeschlagen.'}
    finally{controls.forEach(b=>b.disabled=false)}
  };
  const manage=document.createElement('dialog');manage.className='tournamentDialog tableAccessDialog';
  manage.innerHTML='<h2>Tischcodes dieses Turniers</h2><p>Pro Tisch den Code am entsprechenden Gerät unter „Mit Tischcode beitreten“ eingeben. Neue Turniere erzeugen neue Codes. Neuladen behält die Verbindung. Codes vertraulich weitergeben.</p><div data-codes></div><p role="status"></p><button type="button" data-close>Schließen</button>';
  document.body.append(manage);manage.querySelector('[data-close]').onclick=()=>manage.close();
  window.snookerTableCodes=async()=>{
    manage.showModal();const box=manage.querySelector('[data-codes]'),status=manage.querySelector('[role=status]');box.replaceChildren();status.textContent='Codes werden geladen …';
    try{
      const codes=await window.snookerTableBackend.codes();
      if(!codes.length)throw Error('Noch keine Codes verfügbar. Bitte Verbindung prüfen und erneut öffnen.');
      for(const entry of codes){
        const label=document.createElement('label');label.textContent='Tisch '+entry.slot;
        const input=document.createElement('input');input.readOnly=true;input.className='shortNumericCode';input.value=entry.code;label.append(input);box.append(label);
        const copy=document.createElement('button');copy.type='button';copy.textContent='Code Tisch '+entry.slot+' kopieren';
        copy.onclick=async()=>{try{await navigator.clipboard.writeText(entry.code);status.textContent='Code kopiert.'}catch{input.select();status.textContent='Code markieren und kopieren.'}};box.append(copy);
        const reset=document.createElement('button');reset.type='button';reset.textContent='Verbindung Tisch '+entry.slot+' zurücksetzen';
        reset.onclick=async()=>{if(!confirm('Verbindung von Tisch '+entry.slot+' zurücksetzen? Das bisherige Gerät verliert den Zugriff. Spielstand bleibt erhalten.'))return;reset.disabled=true;try{const result=await window.snookerTableBackend.reset(entry.slot);entry.code=result.code;input.value=result.code;status.textContent='Tisch '+entry.slot+' freigegeben. Jetzt mit Code '+result.code+' neu verbinden.'}catch(err){status.textContent=err.message}finally{reset.disabled=false}};box.append(reset);
      }
      status.textContent='Gültig für das aktuell geöffnete Turnier.';
    }catch(err){status.textContent=err.message||'Codes konnten nicht geladen werden.'}
  };
  const dismiss=document.createElement('dialog');dismiss.className='tournamentDialog tableAccessDialog';
  dismiss.innerHTML='<h2>Tischgerät abmelden</h2><p>Tisch auswählen. Das verbundene Gerät verliert seinen Zugriff. Der Spielstand und der Tischcode bleiben erhalten.</p><div data-tables></div><p role="status"></p><button type="button" data-close>Schließen</button>';
  document.body.append(dismiss);dismiss.querySelector('[data-close]').onclick=()=>dismiss.close();
  window.snookerDismissTable=async()=>{
    const box=dismiss.querySelector('[data-tables]'),status=dismiss.querySelector('[role=status]');box.replaceChildren();status.textContent='Tische werden geladen …';dismiss.showModal();
    try{
      const codes=await window.snookerTableBackend.connections();
      if(!dismiss.open)return;
      if(!codes.length){status.textContent='Keine Tischgeräte angemeldet.';return;}
      for(const {slot} of codes){
        const button=document.createElement('button');button.type='button';button.textContent='Tisch '+slot+' – Gerät abmelden';
        button.onclick=async()=>{
          if(!confirm('Tischgerät an Tisch '+slot+' abmelden? Der Spielstand bleibt erhalten.'))return;
          const buttons=box.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);
          try{await window.snookerTableBackend.reset(slot);button.remove();status.textContent='Tischgerät an Tisch '+slot+' abgemeldet. Ein Gerät kann jetzt mit dem bisherigen Tischcode beitreten.'+(box.querySelectorAll('button').length?'':' Keine weiteren Tischgeräte angemeldet.');}
          catch(err){status.textContent=err.message||'Abmelden fehlgeschlagen.'}
          finally{buttons.forEach(b=>b.disabled=false)}
        };box.append(button);
      }
      status.textContent='Welches Tischgerät möchtest du abmelden?';
    }catch(err){status.textContent=err.message||'Tische konnten nicht geladen werden.'}
  };
})();
