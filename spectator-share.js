(()=>{
  'use strict';
  const model=()=>window.SnookerSpectator;
  let currentKey=null;
  function update(){
    const box=document.getElementById('spectatorSharing');if(!box)return;
    const backend=window.snookerSpectatorBackend,state=backend?.status()??{},active=state.enabled&&state.key===currentKey;
    box.querySelector('[data-share-create]').hidden=active;
    box.querySelector('[data-share-enabled]').hidden=!active;
    box.querySelector('[data-share-status]').textContent=state.error||(active?'Zuschauerzugang aktiv · ausschließlich Leserechte.':'Derzeit kein Zuschauerlink für dieses Turnier aktiv.');
    if(active){
      const url=model().url(state.token,window.ClubSport.pool?'pool':'snooker',location.href),input=box.querySelector('[data-share-link]');input.value=url;
      box.querySelector('[data-share-open]').href=url;
      const qr=box.querySelector('[data-share-qr]');
      if(qr.dataset.token!==state.token){const code=qrcode(0,'M');code.addData(url);code.make();qr.innerHTML=code.createSvgTag({cellSize:5,margin:20,scalable:true,alt:'QR-Code zum Zuschauen'});qr.dataset.token=state.token;}
    }
  }
  function render(panel,data){
    currentKey=model().key(data);
    panel.insertAdjacentHTML('beforeend','<section class="card" id="spectatorSharing"><h2>Turnier teilen</h2><p>Mit Link oder QR-Code können andere dieses Turnier live ansehen. Keine Anmeldung nötig. Eingaben sind ausschließlich mit einem zusätzlichen Tischcode möglich.</p><p role="status" data-share-status></p><button type="button" class="primary" data-share-create>Zuschauerlink erstellen</button><div data-share-enabled hidden><div class="spectatorQr" data-share-qr></div><label>Zuschauerlink<input readonly data-share-link autocomplete="off"></label><div class="tournamentActions"><button type="button" class="secondary" data-share-copy>Link kopieren</button><button type="button" class="secondary" data-share-send>Link teilen</button><a class="spectatorLinkButton" data-share-open target="_blank" rel="noopener noreferrer">Vorschau öffnen</a></div><p class="small">Wer den Link erhält, kann dieses Turnier ansehen. Tischcodes werden nicht mitgeteilt.</p><button type="button" class="danger" data-share-disable>Zuschauerzugang deaktivieren</button></div></section>');
    const box=document.getElementById('spectatorSharing'),status=box.querySelector('[data-share-status]');
    async function action(button,fn){button.disabled=true;status.textContent='Bitte warten …';try{if(!window.snookerSpectatorBackend)throw Error('Verbindung wird noch vorbereitet. Bitte kurz warten.');await fn();update();}catch(err){status.textContent=err.code==='permission-denied'?'Bitte zuerst die Firebase-Regeln aus Version 9.11 veröffentlichen.':err.message;}finally{button.disabled=false;}}
    box.querySelector('[data-share-create]').onclick=e=>action(e.currentTarget,()=>window.snookerSpectatorBackend.enable(currentKey));
    box.querySelector('[data-share-disable]').onclick=e=>{if(confirm('Zuschauerzugang deaktivieren? Der bisherige Link und QR-Code verlieren den Zugriff. Tischverbindungen bleiben bestehen.'))void action(e.currentTarget,()=>window.snookerSpectatorBackend.disable());};
    box.querySelector('[data-share-copy]').onclick=async()=>{const input=box.querySelector('[data-share-link]');try{await navigator.clipboard.writeText(input.value);status.textContent='Zuschauerlink kopiert.';}catch{input.select();status.textContent='Link markieren und kopieren.';}};
    box.querySelector('[data-share-send]').onclick=async()=>{const url=box.querySelector('[data-share-link]').value;try{if(navigator.share)await navigator.share({title:'Turnier live verfolgen',url});else box.querySelector('[data-share-copy]').click();}catch(err){if(err.name!=='AbortError')status.textContent='Bitte den Link über „Link kopieren“ weitergeben.';}};
    update();
  }
  window.snookerSpectatorUI=Object.freeze({render});
  window.addEventListener('snooker-spectator-status',update);
  // Return link is kept per sport in this tab; it grants no table rights.
  window.snookerViewerReturnUrl=()=>{
    const sport=window.ClubSport.pool?'pool':'snooker',token=window.sessionStorage.getItem('snooker-viewer-return:'+sport);
    return model().validToken(token)?model().url(token,sport,location.href):null;
  };
})();
