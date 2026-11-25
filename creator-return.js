// Navigation hints never grant permissions. Wait for the normal approved account login.
(()=>{
 'use strict';
 const params=new URLSearchParams(location.search),owner=params.get('resumeOwner'),key=params.get('resumeTournament');
 if(!owner||!key||owner.length>128||!/^(free|club):\d+$/.test(key))return;
 let handled=false;
 window.addEventListener('snooker-account-ready',({detail})=>{
  if(handled)return;handled=true;
  const url=new URL(location.href);url.searchParams.delete('resumeOwner');url.searchParams.delete('resumeTournament');history.replaceState(null,'',url.href);
  const bridge=window.snookerTournamentBridge,data=bridge&&('tournamentCurrent' in bridge?bridge.tournamentCurrent:bridge.current);
  if(detail.uid===owner&&data&&window.SnookerSpectator.key(data)===key)window.snookerAccount.request('resumeTournament');
 });
})();
