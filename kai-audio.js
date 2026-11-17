(() => {
  'use strict';
  const storage=window.snookerStorage,key='kai-audio-enabled-v1';
  const files=['Kai_01-09.mp3','Kai_10-19.mp3','Kai_20-29.mp3','Kai_30-39.mp3'];
  let button=null,current=null,lastBand=null;
  function allowed(){
    const single=document.getElementById('singleMode');
    return storage.uid==='SRx2kZD2jzdM3Q6RVVOjioAuHuw1'&&!window.ClubSport?.pool
      &&single&&!single.classList.contains('hidden')&&!document.body.classList.contains('tableDeviceMode');
  }
  function enabled(){try{return storage.getItem(key)==='1';}catch{return false;}}
  function stop(){if(current){current.pause();current.currentTime=0;current=null;}}
  function update(){
    if(!allowed())stop();
    if(!button)return;
    const text='Kai-Sprüche: Ton '+(enabled()?'an':'aus');
    if(button.textContent!==text)button.textContent=text;
    button.hidden=!allowed();button.setAttribute('aria-pressed',String(enabled()));
  }
  function mount(menu){
    if(button)return;
    button=document.createElement('button');button.type='button';button.id='kaiAudioToggle';
    button.onclick=()=>{if(!allowed())return;const on=!enabled();storage.setItem(key,on?'1':'0');if(!on)stop();update();};
    menu.append(button);update();
  }
  function entry(name,points){
    if(!allowed()||!enabled()||String(name).trim().toLocaleLowerCase('de')!=='kai'||!Number.isInteger(points)||points<1||points>39)return;
    const index=points<10?0:Math.floor(points/10);
    if(index===lastBand)return;
    const previousBand=lastBand;lastBand=index;
    stop();
    try{
      const clip=new Audio('audio/'+files[index]);current=clip;
      const playing=clip.play();
      playing?.catch(()=>{if(current===clip){current=null;lastBand=previousBand;}});
    }catch{current=null;lastBand=previousBand;}
  }
  window.addEventListener('snooker-account-enter',update);
  window.addEventListener('pagehide',stop);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  window.KaiAudio=Object.freeze({mount,update,entry,reset(){stop();lastBand=null;}});
})();
