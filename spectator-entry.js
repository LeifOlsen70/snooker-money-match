(()=>{
 'use strict';
 const dialog=document.createElement('dialog');dialog.className='tournamentDialog spectatorEntry';
 dialog.innerHTML='<h2>Turnier verfolgen</h2><p>QR-Code scannen oder den Zuschauerlink der Turnierleitung einfügen. Keine Anmeldung nötig.</p><div class="tournamentActions"><button type="button" class="primary" data-scan>QR-Code scannen</button><button type="button" class="secondary" data-stop hidden>Kamera stoppen</button></div><video playsinline muted hidden aria-label="Kamerabild für QR-Code"></video><form><label>Zuschauerlink<input type="url" required autocomplete="off" placeholder="Zuschauerlink hier einfügen"></label><button type="submit" class="primary">Turnier öffnen</button></form><p role="status"></p><button type="button" data-close>Schließen</button>';
 document.body.append(dialog);
 const video=dialog.querySelector('video'),note=dialog.querySelector('[role=status]'),scan=dialog.querySelector('[data-scan]'),stopButton=dialog.querySelector('[data-stop]');
 let stream=null,frame=null,generation=0;
 function stop(){generation++;if(frame!==null)cancelAnimationFrame(frame);frame=null;stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;video.hidden=true;stopButton.hidden=true;scan.disabled=false;}
 function parse(value){
  let u;try{u=new URL(String(value).trim());}catch{throw Error('Bitte einen vollständigen Zuschauerlink einfügen.');}
  const expected=new URL('spectator.html',location.href);
  if(u.origin!==expected.origin||u.pathname!==expected.pathname||u.username||u.password||!['pool','snooker'].includes(u.searchParams.get('sport'))||!window.SnookerSpectator.validToken(u.hash.slice(1)))throw Error('Das ist kein gültiger Zuschauerlink dieser App.');
  return window.SnookerSpectator.url(u.hash.slice(1),u.searchParams.get('sport'),location.href);
 }
 let overlay=null,iframe=null;
 function closeViewer(){iframe?.remove();overlay?.remove();overlay=iframe=null;document.body.classList.remove('spectatorEmbeddedOpen');}
 function open(value){
  const url=new URL(parse(value));stop();dialog.close();closeViewer();
  url.searchParams.set('embedded','1');
  overlay=document.createElement('section');overlay.className='spectatorEmbedded';
  const back=document.createElement('button');back.type='button';back.className='secondary';back.textContent='← Zur App';back.onclick=closeViewer;
  iframe=document.createElement('iframe');iframe.title='Turnier verfolgen · nur ansehen';iframe.src=url.href;
  overlay.append(back,iframe);document.body.append(overlay);document.body.classList.add('spectatorEmbeddedOpen');back.focus();
 }
 window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===iframe?.contentWindow&&event.data==='snooker-viewer-close')closeViewer();});
 scan.onclick=async()=>{
  stop();const attempt=generation;scan.disabled=true;note.textContent='Kamera wird geöffnet …';
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Die Kamera ist hier nicht verfügbar. Bitte den Zuschauerlink einfügen.');
   const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
   if(attempt!==generation||!dialog.open){acquired.getTracks().forEach(t=>t.stop());return;}
   stream=acquired;video.srcObject=stream;video.hidden=false;stopButton.hidden=false;await video.play();
   if(attempt!==generation)return;
   const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
   if(!ctx)throw Error('Kamerabild kann nicht gelesen werden. Bitte den Link einfügen.');
   note.textContent='QR-Code im Kamerabild halten.';
   let last=0;
   function read(now){
    if(attempt!==generation||!dialog.open)return;
    try{
    if(video.readyState>=2&&video.videoWidth&&video.videoHeight&&now-last>180){
     last=now;const scale=Math.min(1,900/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);ctx.drawImage(video,0,0,canvas.width,canvas.height);
     const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),qr=jsQR(pixels.data,pixels.width,pixels.height,{inversionAttempts:'attemptBoth'});
     if(qr){try{open(qr.data);return;}catch(err){note.textContent=err.message;}}
    }
    frame=requestAnimationFrame(read);
    }catch(err){stop();note.textContent='Das Kamerabild konnte nicht gelesen werden. Bitte den Zuschauerlink einfügen.';}
   }
   frame=requestAnimationFrame(read);
  }catch(err){if(attempt!==generation)return;stop();note.textContent=err.name==='NotAllowedError'?'Kamerazugriff nicht erlaubt. Bitte die Kamera freigeben oder den Zuschauerlink einfügen.':err.name==='NotFoundError'?'Keine Kamera gefunden. Bitte den Zuschauerlink einfügen.':err.message||'Kamera nicht verfügbar. Bitte den Zuschauerlink einfügen.';}
 };
 stopButton.onclick=()=>{stop();note.textContent='Kamera gestoppt. Du kannst den Link auch einfügen.';};
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',stop);dialog.addEventListener('cancel',stop);
 dialog.querySelector('form').onsubmit=event=>{event.preventDefault();try{open(dialog.querySelector('input').value);}catch(err){note.textContent=err.message;}};
 document.getElementById('openSpectator').onclick=()=>{stop();note.textContent='';dialog.showModal();};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',stop);
 window.SnookerSpectatorEntry=Object.freeze({parse});
})();
