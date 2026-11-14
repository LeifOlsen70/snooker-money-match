(() => {
  'use strict';
  const e=id=>document.getElementById(id);
  window.snookerTableAccess=Object.freeze({resolveName(name){return name.trim()},labelFor(){return null}});
  const device=document.createElement('dialog');device.className='tournamentDialog tableAccessDialog';
  device.innerHTML='<form><h2>Tisch beitreten</h2><p>Verfügbare Tische des laufenden Turniers auswählen, wenn du als Spielleiter angemeldet bist. Auf anderen Geräten weiterhin den Tischcode eingeben.</p><div data-available-tables aria-live="polite"></div><label>Tischcode<textarea required rows="3" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea></label><p role="alert"></p><div class="tournamentActions"><button class="primary">Tisch verbinden</button><button type="button" data-close>Zurück</button></div></form>';
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
        button.onclick=()=>{device.querySelector('textarea').value=code;status.textContent='Tisch '+slot+' ausgewählt. Jetzt „Tisch verbinden“ wählen.'};
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
    event.preventDefault();const controls=device.querySelectorAll('button,textarea');controls.forEach(b=>b.disabled=true);
    const status=device.querySelector('[role=alert]');status.textContent='Tisch wird verbunden …';
    try{if(!window.snookerTableBackend)throw Error('Verbindung wird noch geladen. Bitte kurz warten.');await window.snookerTableBackend.join(device.querySelector('textarea').value)}
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
        const input=document.createElement('textarea');input.readOnly=true;input.rows=2;input.value=entry.code;label.append(input);box.append(label);
        const copy=document.createElement('button');copy.type='button';copy.textContent='Code Tisch '+entry.slot+' kopieren';
        copy.onclick=async()=>{try{await navigator.clipboard.writeText(entry.code);status.textContent='Code kopiert.'}catch{input.select();status.textContent='Code markieren und kopieren.'}};box.append(copy);
      }
      status.textContent='Gültig für das aktuell geöffnete Turnier.';
    }catch(err){status.textContent=err.message||'Codes konnten nicht geladen werden.'}
  };
})();
