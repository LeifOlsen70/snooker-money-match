(() => {
  'use strict';
  const body = document.body;
  const app = document.querySelector('.app');
  const panel = document.createElement('section');
  panel.id = 'appRulesPanel';
  panel.hidden = true;
  panel.innerHTML = '<iframe title="Allgemeine Infos & Regeln" data-src="infos.html?embedded=1"></iframe>';
  app.append(panel);
  let opened = false, owner = null, queued = false;
  const positions = new Map();
  const isVisible = el => el && !el.classList.contains('hidden');
  function closeInfo() {
    opened = false; owner = null;
    body.classList.remove('appRulesOpen');
    panel.hidden = true;
    update();
  }
  function showInfo(nav) {
    owner = nav.closest('#singleMode') ? 'single' : 'tournament';
    opened = true;
    const frame = panel.querySelector('iframe');
    if (!frame.src) frame.src = frame.dataset.src;
    panel.hidden = false;
    body.classList.add('appRulesOpen');
    update();
    panel.scrollIntoView({block:'nearest',behavior:'smooth'});
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
      nav.style.setProperty('--visible-tabs',Math.min(4,[...nav.children].filter(el=>!el.hidden).length));
      const navKey=nav.id || (nav.classList.contains('tournamentViews')?'tournament':'setup-'+(nav.closest('#singleMode')?'single':'tournament'));
      if(!nav.dataset.prepared) {
        nav.dataset.prepared='1';
        nav.scrollLeft=positions.get(navKey)||0;
        nav.addEventListener('scroll',()=>positions.set(navKey,nav.scrollLeft),{passive:true});
        nav.addEventListener('wheel',e=>{
          if(nav.scrollWidth>nav.clientWidth && Math.abs(e.deltaY)>Math.abs(e.deltaX)){
            e.preventDefault();nav.scrollLeft+=e.deltaY;
          }
        },{passive:false});
      }
    }
  }
  document.addEventListener('click',e=>{
    const tab=e.target.closest('.appTabStrip > button');
    if(tab && !tab.hasAttribute('data-rules-tab'))closeInfo();
    if(e.target.closest('#singleHome,#tournamentHome'))closeInfo();
  },true);
  window.addEventListener('message',e=>{
    if(e.origin===location.origin && e.source===panel.querySelector('iframe').contentWindow && e.data==='snooker-rules-back')closeInfo();
  });
  // Child-list observation handles dynamically rebuilt tournament bars without
  // creating a mutation loop from updating classes and ARIA attributes.
  new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(update)}}).observe(app,{childList:true,subtree:true});
  for(const event of ['snooker-account-enter','snooker-state-changed','snooker-single-received'])window.addEventListener(event,()=>queueMicrotask(update));
  update();
})();
