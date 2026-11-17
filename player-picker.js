(() => {
  'use strict';
  const storage=window.snookerStorage,key='snookerSwissPlayerNamesV1';
  const admin=()=>storage.uid==='SRx2kZD2jzdM3Q6RVVOjioAuHuw1';
  const clean=name=>String(name??'').trim().slice(0,60);
  const same=(a,b)=>a.toLocaleLowerCase('de')===b.toLocaleLowerCase('de');
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function rawList(){try{return JSON.parse(storage.getItem(key))??[];}catch{return [];}}
  function list(){return rawList().filter(n=>typeof n==='string'&&!n.includes('&'));}
  function save(next){
    const before=rawList();const unique=new Map();for(const name of before)if(typeof name==='string'&&name.includes('&'))unique.set(name.toLocaleLowerCase('de'),name);for(const raw of next){const name=clean(raw);if(name&&!name.includes('&')&&!unique.has(name.toLocaleLowerCase('de')))unique.set(name.toLocaleLowerCase('de'),name);}
    const after=[...unique.values()].sort((a,b)=>a.localeCompare(b,'de'));
    storage.setItem(key,JSON.stringify(after));
    window.dispatchEvent(new CustomEvent('snooker-roster-received',{detail:after}));
    window.dispatchEvent(new CustomEvent('snooker-roster-change',{detail:{before,after}}));
  }
  function remember(names){save([...list(),...names]);}
  function fields(){return Array.from(document.querySelectorAll('#tournamentNames input, #poolSinglePartners input, #names .name'));}
  function changed(input){input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
  function rename(name,value){
    if(!admin())throw Error('Nur der Administrator darf gespeicherte Namen ändern.');
    const corrected=clean(value);if(!corrected||corrected.includes('&'))throw Error('Bitte einen einzelnen Spielernamen eingeben.');
    if(list().some(n=>!same(n,name)&&same(n,corrected)))throw Error('Dieser Name ist bereits vorhanden.');
    save(list().map(n=>same(n,name)?corrected:n));
    for(const input of fields())if(same(input.value.trim(),name)){input.value=corrected;changed(input);}
  }
  function remove(name){
    if(!admin())throw Error('Nur der Administrator darf gespeicherte Namen löschen.');
    save(list().filter(n=>!same(n,name)));
    for(const input of fields())if(same(input.value.trim(),name)){input.value='';changed(input);}
  }
  const dialog=document.createElement('dialog');dialog.id='playerPickerDialog';dialog.className='tournamentDialog playerPicker';document.body.append(dialog);
  let target=null;
  function close(){dialog.close();target=null;}
  function choose(name){if(!target)return;name=clean(name);if(!name||name.includes('&')){dialog.querySelector('[role=alert]').textContent='Bitte einen einzelnen Spielernamen eingeben.';return;}remember([name]);target.value=name;changed(target);close();}
  function render(){
    dialog.innerHTML=`<h2>Spieler auswählen</h2><p>Gespeicherten Namen auswählen oder einen neuen Spieler hinzufügen.</p><div class="playerPickerList">${list().map((name,i)=>`<div class="playerPickerRow"><button type="button" data-choose-player="${i}">${esc(name)}</button>${admin()?`<button type="button" data-rename-player="${i}" aria-label="${esc(name)} bearbeiten">Ändern</button><button type="button" data-remove-player="${i}" aria-label="${esc(name)} löschen">Löschen</button>`:''}</div>`).join('')||'<p>Noch keine Spieler gespeichert.</p>'}</div><form><label>Neuer Spieler<input name="newName" maxlength="60" placeholder="Einzelname" required></label><p role="alert"></p><div class="tournamentActions"><button class="primary">Hinzufügen &amp; auswählen</button><button type="button" data-clear-player>Platz leeren</button><button type="button" data-close-picker>Schließen</button></div></form>`;
    const names=list();
    dialog.querySelectorAll('[data-choose-player]').forEach(b=>b.onclick=()=>choose(names[Number(b.dataset.choosePlayer)]));
    dialog.querySelectorAll('[data-remove-player]').forEach(b=>b.onclick=()=>{if(!admin())return;const name=names[Number(b.dataset.removePlayer)];if(confirm(name+' aus der Namensliste löschen? Bereits gespielte Partien bleiben erhalten.')){remove(name);render();}});
    dialog.querySelectorAll('[data-rename-player]').forEach(b=>b.onclick=()=>edit(names[Number(b.dataset.renamePlayer)]));
    dialog.querySelector('form').onsubmit=e=>{e.preventDefault();choose(dialog.querySelector('[name="newName"]').value);};
    dialog.querySelector('[data-close-picker]').onclick=close;
    dialog.querySelector('[data-clear-player]').onclick=()=>{if(target){target.value='';changed(target);}close();};
  }
  function edit(name){
    if(!admin())return;
    const editor=document.createElement('dialog');editor.className='tournamentDialog playerPicker';editor.innerHTML=`<form><h2>Spielernamen ändern</h2><label>Name<input maxlength="60" required value="${esc(name)}"></label><p role="alert"></p><button>Speichern</button><button type="button">Abbrechen</button></form>`;document.body.append(editor);
    const done=()=>{editor.close();editor.remove();};editor.querySelector('[type=button]').onclick=done;editor.oncancel=e=>{e.preventDefault();done();};
    editor.querySelector('form').onsubmit=e=>{e.preventDefault();try{rename(name,editor.querySelector('input').value);done();render();}catch(err){editor.querySelector('[role=alert]').textContent=err.message;}};editor.showModal();
  }
  function open(input){if(dialog.open&&target===input)return;target=input;input.blur();render();if(!dialog.open)dialog.showModal();}
  function bind(input){input.readOnly=true;input.setAttribute('aria-haspopup','dialog');input.onclick=e=>{if(e.defaultPrevented)return;open(input);};input.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(input);}};}
  dialog.oncancel=e=>{e.preventDefault();close();};
  window.addEventListener('snooker-roster-received',({detail})=>{storage.setItem(key,JSON.stringify(detail));if(dialog.open)render();});
  window.addEventListener('storage',()=>{if(dialog.open)render();});
  window.ClubPlayerPicker=Object.freeze({bind,open,remember,list,rename,remove,get isAdmin(){return admin();}});
})();
