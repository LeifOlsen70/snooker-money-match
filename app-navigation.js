(() => {
  'use strict';
  const body = document.body;
  const app = document.querySelector('.app');
  const panel = document.createElement('section');
  panel.id = 'appRulesPanel';
  panel.hidden = true;
  panel.innerHTML = '<iframe title="Allgemeine Infos & Regeln" data-src="infos.html?embedded=1"></iframe>';
  app.append(panel);
  const footer=document.createElement('footer');
  footer.className='pageFooter';
  const accountBar=document.getElementById('accountBar');
  footer.append(accountBar);
  const home=document.createElement('button');
  home.type='button';home.className='secondary';home.id='pageFooterHome';home.textContent='← Startseite';
  home.onclick=()=>{
    if(document.body.classList.contains('tableDeviceMode')){window.snookerMonitors.tableHome();return;}
    const source=document.getElementById(isVisible(document.getElementById('singleMode'))?'singleHome':'tournamentHome');
    source?.click();
  };
  footer.append(home);app.append(footer);
  let opened = false, owner = null, queued = false;
  const positions = new Map();
  let swipeStart=null;
  const isVisible = el => el && !el.classList.contains('hidden');
  function closeInfo() {
    opened = false; owner = null;
    body.classList.remove('appRulesOpen');
    panel.hidden = true;
    update();
  }
  function showInfo(nav) {
    if(body.classList.contains('snookerFullscreenScore'))document.getElementById('scoreDisplayToggle')?.click();
    owner = nav.closest('#singleMode') ? 'single' : 'tournament';
    opened = true;
    const frame = panel.querySelector('iframe');
    if (!frame.src) frame.src = frame.dataset.src;
    panel.hidden = false;
    body.classList.add('appRulesOpen');
    update();
    window.scrollTo(0,0);
  }
  function setupNav(container, label, before) {
    let nav = container.querySelector('.setupInfoTabs');
    if (!nav) {
      nav = document.createElement('nav');
      nav.className = 'setupInfoTabs';
      nav.setAttribute('aria-label','Ansicht wechseln');
      const button = document.createElement('button');
      button.type='button';button.className='primary';button.textContent=label;
      button.onclick=closeInfo;nav.append(button);
      container.insertBefore(nav,before);
    }
    return nav;
  }
  function update() {
    queued=false;
    const single = document.getElementById('singleMode');
    const tournament = document.getElementById('tournamentMode');
    home.hidden=!isVisible(single)&&!isVisible(tournament)&&!body.classList.contains('tableDeviceMode');
    if (opened && ((owner==='single' && !isVisible(single)) || (owner==='tournament' && !isVisible(tournament)))) {
      opened=false;owner=null;body.classList.remove('appRulesOpen');panel.hidden=true;
    }
    const tabs=document.getElementById('viewTabs');
    const setup=document.getElementById('setup');
    if (isVisible(single) && !isVisible(tabs)) setupNav(single,'Neues Match',setup);
    const singleSetup=single.querySelector('.setupInfoTabs');
    if(singleSetup) singleSetup.hidden=isVisible(tabs);
    if(isVisible(tournament) && !tournament.querySelector('.tournamentViews')) {
      const form=tournament.querySelector('form, .card');
      if(form)setupNav(tournament,'Turnier anlegen',form);
    }
    const tournamentNav=tournament.querySelector('.tournamentViews,.setupInfoTabs');
    const history=tournament.querySelector('.tournamentHistory');
    if(tournamentNav && history && history.nextElementSibling!==tournamentNav)history.after(tournamentNav);
    for(const nav of document.querySelectorAll('#viewTabs,.tournamentViews,.setupInfoTabs')) {
      nav.classList.add('appTabStrip');
      let info=nav.querySelector('[data-rules-tab]');
      if(!info) {
        info=document.createElement('button');info.type='button';info.dataset.rulesTab='1';
        info.textContent='Allgemeine Infos & Regeln';info.onclick=()=>showInfo(nav);
        nav.append(info);
      }
      // Keep this tab last when later versions insert additional tabs.
      if(nav.lastElementChild!==info)nav.append(info);
      const active=opened && ((owner==='single' && nav.closest('#singleMode')) || (owner==='tournament' && nav.closest('#tournamentMode')));
      info.className=active?'primary active':'secondary';
      info.setAttribute('aria-pressed',String(Boolean(active)));
      const buttons=[...nav.children].filter(el=>!el.hidden);
      const selected=active?info:buttons.find(el=>el!==info && (el.getAttribute('aria-pressed')==='true'||el.classList.contains('active')||el.classList.contains('primary')));
      nav.style.setProperty('--visible-tabs',Math.min(4,[...nav.children].filter(el=>!el.hidden).length));
      const navKey=nav.id || (nav.classList.contains('tournamentViews')?'tournament':'setup-'+(nav.closest('#singleMode')?'single':'tournament'));
      if(!nav.dataset.prepared) {
        nav.dataset.prepared='1';
        nav.scrollLeft=positions.get(navKey)||0;
        nav.addEventListener('scroll',()=>positions.set(navKey,nav.scrollLeft),{passive:true});
        nav.addEventListener('wheel',e=>{
          if(nav.scrollWidth>nav.clientWidth && Math.abs(e.deltaY)>Math.abs(e.deltaX)){
            e.preventDefault();movePage(e.deltaY>0?1:-1,nav);
          }
        },{passive:false});
      }
      if(selected){
        const index=buttons.indexOf(selected);
        const first=Math.min(Math.max(0,index-3),Math.max(0,buttons.length-4));
        nav.scrollLeft=first*((nav.clientWidth+6)/Math.min(4,buttons.length));
        positions.set(navKey,nav.scrollLeft);
      }
    }
  }
  function currentNav(){
    const container=isVisible(document.getElementById('singleMode'))?document.getElementById('singleMode'):isVisible(document.getElementById('tournamentMode'))?document.getElementById('tournamentMode'):null;
    return container&&[...container.querySelectorAll('.appTabStrip')].find(nav=>!nav.hidden&&!nav.classList.contains('hidden'));
  }
  function movePage(direction,nav=currentNav()){
    if(document.querySelector('dialog[open]')||!nav)return;
    if(body.classList.contains('snookerFullscreenTournament')){
      window.dispatchEvent(new Event('snooker-table-swipe'));return;
    }
    const buttons=[...nav.children].filter(el=>!el.hidden);
    const index=buttons.findIndex(el=>el.getAttribute('aria-pressed')==='true'||el.classList.contains('active')||el.classList.contains('primary'));
    const active=opened?buttons.length-1:index;
    if(buttons[active+direction] && body.classList.contains('snookerFullscreenScore'))document.getElementById('scoreDisplayToggle')?.click();
    buttons[active+direction]?.click();
    queueMicrotask(update);
  }
  document.addEventListener('touchstart',e=>{
    swipeStart=e.touches.length===1&&!e.target.closest('input,textarea,select,dialog')?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;
  },{passive:true});
  document.addEventListener('touchcancel',()=>swipeStart=null,{passive:true});
  document.addEventListener('touchend',e=>{
    const start=swipeStart;swipeStart=null;
    if(!start||!e.changedTouches.length)return;
    const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;
    if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.6)movePage(dx<0?1:-1);
  },{passive:true});
  document.addEventListener('click',e=>{
    const tab=e.target.closest('.appTabStrip > button');
    if(tab && !tab.hasAttribute('data-rules-tab'))closeInfo();
    if(e.target.closest('#singleHome,#tournamentHome'))closeInfo();
  },true);
  window.addEventListener('message',e=>{
    if(e.origin===location.origin && e.source===panel.querySelector('iframe').contentWindow && e.data==='snooker-rules-back')closeInfo();
    if(e.origin===location.origin && e.source===panel.querySelector('iframe').contentWindow && e.data==='snooker-rules-swipe-back')movePage(-1);
  });
  // Child-list observation handles dynamically rebuilt tournament bars without
  // creating a mutation loop from updating classes and ARIA attributes.
  new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(update)}}).observe(app,{childList:true,subtree:true});
  for(const event of ['snooker-account-enter','snooker-state-changed','snooker-single-received'])window.addEventListener(event,()=>queueMicrotask(update));
  update();
})();
