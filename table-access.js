(() => {
  'use strict';
  const owner='SRx2kZD2jzdM3Q6RVVOjioAuHuw1';
  const storageKey='snooker-table-device-v1';
  const raw=window.localStorage;
  const emailPattern=/^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const e=id=>document.getElementById(id);
  let setup=null;
  try{const value=JSON.parse(raw.getItem(storageKey));if(valid(value))setup=value}catch{}
  function valid(value){return value?.app==='SnookerTableAccess'&&value.version===1&&[1,2,3].includes(value.table)&&typeof value.email==='string'&&emailPattern.test(value.email)}
  function encode(entry){return 'SNT1.'+btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify({app:'SnookerTableAccess',version:1,table:entry.table,email:entry.email}))));}
  function decode(code){
    if(!code.startsWith('SNT1.')||code.length>2000)throw Error('Ungültiger Einrichtungscode.');
    let value;try{value=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(code.slice(5)),c=>c.charCodeAt(0))))}catch{throw Error('Ungültiger Einrichtungscode.')}
    if(!valid(value))throw Error('Ungültiger Einrichtungscode.');return value;
  }
  function errorText(err){
    const errors={
      'auth/email-already-in-use':'Diese E-Mail-Adresse ist bereits registriert. Wähle „Vorhandenes Konto verbinden“ und gib dessen Passwort ein.',
      'auth/invalid-credential':'E-Mail-Adresse oder Passwort stimmen nicht.',
      'auth/invalid-email':'Bitte eine gültige E-Mail-Adresse eingeben.',
      'auth/weak-password':'Das Passwort muss mindestens sechs Zeichen haben.',
      'auth/network-request-failed':'Keine Verbindung. Bitte Internetzugang prüfen.',
      'auth/too-many-requests':'Zu viele Versuche. Bitte später erneut versuchen.',
      'permission-denied':'Zugriff verweigert. Bitte mit deinem bisherigen Administratorkonto anmelden.'
    };
    return errors[err.code]||err.message||'Aktion fehlgeschlagen.';
  }
  window.snookerTableAccess=Object.freeze({
    resolveName(name){
      name=name.trim();if(name.includes('@'))return name;
      const match=/^tisch\s*([123])$/i.exec(name);
      if(!match)throw {userMessage:'Bitte eine E-Mail-Adresse oder Tisch 1, Tisch 2 bzw. Tisch 3 eingeben.'};
      if(!setup||setup.table!==Number(match[1]))throw {userMessage:'Diesen Tisch bitte zuerst über „Tischgerät einmalig einrichten“ mit dem Code der Turnierleitung vorbereiten.'};
      return setup.email;
    },
    identityFor(email){return setup&&typeof email==='string'&&setup.email.toLowerCase()===email.toLowerCase()?{table:setup.table}:null},
    labelFor(email){return setup&&setup.email.toLowerCase()===email.toLowerCase()?'Tisch '+setup.table:null},
    encode,decode
  });
  const device=document.createElement('dialog');
  device.className='tournamentDialog tableAccessDialog';device.id='tableDeviceDialog';
  device.innerHTML='<form><h2>Tischgerät einrichten</h2><p>Einmalig den Einrichtungscode von der Turnierleitung einfügen. Danach genügt auf diesem Gerät Tischname und Passwort.</p><label>Einrichtungscode<textarea id="tableDeviceCode" required rows="4" autocomplete="off" spellcheck="false"></textarea></label><p role="alert"></p><div class="tournamentActions"><button class="primary">Einrichtung speichern</button><button type="button" data-close>Zurück</button></div></form>';
  document.body.append(device);
  e('tableDeviceSetup').onclick=()=>{device.querySelector('[role=alert]').textContent='';device.showModal()};
  device.querySelector('[data-close]').onclick=()=>device.close();
  device.querySelector('form').onsubmit=event=>{
    event.preventDefault();
    try{
      const value=decode(e('tableDeviceCode').value.trim());
      raw.setItem(storageKey,JSON.stringify(value));setup=value;e('tableDeviceCode').value='';
      e('accountEmail').value='Tisch '+value.table;
      e('accountPassword').value='';device.close();
      e('accountMessage').textContent='Tisch '+value.table+' eingerichtet. Jetzt das zugehörige Passwort eingeben.';
    }catch(err){device.querySelector('[role=alert]').textContent=errorText(err)}
  };
  const manage=document.createElement('dialog');
  manage.id='tableAccountsDialog';manage.className='tournamentDialog tableAccessDialog';
  manage.innerHTML=`<form><h2>Tischzugänge verwalten</h2><p>Nur für deine Tischgeräte. Pro Tisch eine eigene, von dir erreichbare E-Mail-Adresse oder Weiterleitung verwenden. Spieler registrieren sich unverändert selbst.</p>
  <label>Tisch<select id="tableAccountSlot"><option value="1">Tisch 1</option><option value="2">Tisch 2</option><option value="3">Tisch 3</option></select></label>
  <p id="tableAccountExisting"></p>
  <label>E-Mail zur Kontowiederherstellung<input id="tableAccountEmail" type="email" autocomplete="off" required></label>
  <label>Passwort<input id="tableAccountPassword" type="password" autocomplete="new-password" minlength="6" required></label>
  <label>Aktion<select id="tableAccountAction"><option value="new">Neues Konto anlegen</option><option value="existing">Vorhandenes Konto verbinden</option></select></label>
  <p role="status" id="tableAccountStatus"></p>
  <div class="tournamentActions"><button class="primary" id="tableAccountSave">Tischkonto einrichten</button><button type="button" id="tableAccountReset">Passwort-Wiederherstellung senden</button></div>
  <section id="tableAccountCodeSection" hidden><h3>Einrichtungscode</h3><p>Diesen Code einmalig am Tischgerät eingeben. Das Passwort separat mitteilen. Der Code enthält die Kontozuordnung, aber kein Passwort und gewährt allein keinen Zugang.</p><textarea id="tableAccountCode" readonly rows="4"></textarea><button type="button" id="tableAccountCopy">Code kopieren</button></section>
  <p class="small">Diese Version bereitet die Anmeldung vor. Tisch-Zählwerk und Ergebnisübertragung folgen im nächsten Schritt. Ein vergessenes Passwort wird über die hinterlegte E-Mail neu gesetzt.</p>
  <button type="button" data-close>Schließen</button></form>`;
  document.body.append(manage);
  const adminButton=document.createElement('button');adminButton.type='button';adminButton.id='tableAccountsAdmin';adminButton.className='secondary';adminButton.textContent='Tischzugänge verwalten';adminButton.hidden=true;
  let entries={},busy=false;
  function updateAdmin(){
    const footer=document.querySelector('.pageFooter');
    if(footer&&adminButton.parentElement!==footer)footer.append(adminButton);
    adminButton.hidden=raw.getItem('snooker-active-account-v1')!==owner||raw.getItem('snooker-local-mode-v1')==='1';
  }
  function fill(){
    const slot=Number(e('tableAccountSlot').value),entry=entries[slot];
    e('tableAccountExisting').textContent=entry?'Eingerichtet: Tisch '+slot+' · '+entry.email:'Noch kein Konto für diesen Tisch hinterlegt.';
    e('tableAccountEmail').value=entry?.email||'';e('tableAccountPassword').value='';
    e('tableAccountAction').value=entry?'existing':'new';
    e('tableAccountStatus').textContent='';
    e('tableAccountReset').disabled=!entry;
    e('tableAccountCodeSection').hidden=!entry;
    e('tableAccountCode').value=entry?encode(entry):'';
  }
  function setBusy(value){busy=value;manage.querySelectorAll('input,select,button').forEach(control=>control.disabled=value);if(!value)e('tableAccountReset').disabled=!entries[Number(e('tableAccountSlot').value)];}
  function backend(){if(!window.snookerTableBackend)throw Error('Kontoverbindung wird noch geladen. Bitte mit Internet erneut versuchen.');return window.snookerTableBackend;}
  adminButton.onclick=async()=>{
    manage.showModal();setBusy(true);e('tableAccountStatus').textContent='Tischzugänge werden geladen …';
    try{entries=await backend().list();fill()}catch(err){e('tableAccountStatus').textContent=errorText(err)}finally{setBusy(false)}
  };
  e('tableAccountSlot').onchange=fill;
  manage.querySelector('[data-close]').onclick=()=>{e('tableAccountPassword').value='';manage.close()};
  manage.addEventListener('close',()=>e('tableAccountPassword').value='');
  manage.querySelector('form').onsubmit=async event=>{
    event.preventDefault();if(busy)return;
    const slot=Number(e('tableAccountSlot').value),email=e('tableAccountEmail').value.trim(),password=e('tableAccountPassword').value,existing=e('tableAccountAction').value==='existing';
    setBusy(true);e('tableAccountStatus').textContent='Konto wird eingerichtet …';
    try{
      const entry=await backend().provision(slot,email,password,existing);entries[slot]=entry;fill();
      e('tableAccountStatus').textContent='Tisch '+slot+' ist vorbereitet. Den Code am Tischgerät eingeben.';
    }catch(err){e('tableAccountStatus').textContent=errorText(err)+' Falls das Konto bereits angelegt wurde, beim nächsten Versuch „Vorhandenes Konto verbinden“ wählen.'}
    finally{e('tableAccountPassword').value='';setBusy(false)}
  };
  e('tableAccountReset').onclick=async()=>{
    if(busy)return;setBusy(true);
    try{await backend().reset(Number(e('tableAccountSlot').value));e('tableAccountStatus').textContent='Wiederherstellungs-E-Mail angefordert. Bitte im hinterlegten Postfach prüfen.'}catch(err){e('tableAccountStatus').textContent=errorText(err)}finally{setBusy(false)}
  };
  e('tableAccountCopy').onclick=async()=>{
    try{await navigator.clipboard.writeText(e('tableAccountCode').value);e('tableAccountStatus').textContent='Code kopiert.'}catch{e('tableAccountCode').select();e('tableAccountStatus').textContent='Code markieren und kopieren.'}
  };
  new MutationObserver(updateAdmin).observe(document.querySelector('.app'),{childList:true,subtree:true});
  window.addEventListener('snooker-account-enter',updateAdmin);
  updateAdmin();
})();
