const CACHE_NAME = 'v8-23-tournament-tree';
const APP_SHELL = [
  './elimination.js?v=8.23',
  './',
  './index.html',
  './app.html',
  './app.html?sport=pool',
  './app.html?sport=snooker',
  './sports.js?v=8.23',
  './player-picker.js?v=8.23',
  './kai-audio.js?v=8.23',
  './audio/Kai_01-09.mp3',
  './audio/Kai_10-19.mp3',
  './audio/Kai_20-29.mp3',
  './audio/Kai_30-39.mp3',
  './player-picker.css?v=8.23',
  './partner-drag.js?v=8.23',
  './pool-planner.js?v=8.23',
  './pool-single.js?v=8.23',
  './pool.css?v=8.23',
  './pool-logo.png',
  './pool-infos.html',
  './infos.html',
  './app-navigation.js?v=8.23',
  './account-access.js?v=8.23',
  './access-ui.js?v=8.23',
  './table-access.js?v=8.23',
  './table-score.js?v=8.23',
  './table-sync.js?v=8.23',
  './table-monitor.js?v=8.23',
  './firebase-sync.js?v=8.23',
  './pdf-export.js?v=8.23',
  './tournament.js?v=8.23',
  './tournament.css?v=8.23',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './flensburger-snooker-club.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(
      APP_SHELL.map(url => new Request(url, {cache: 'reload'}))
    ))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  // For app navigation: use the newest online copy when possible,
  // otherwise fall back to the locally cached app.
  if (request.mode === 'navigate') {
    const path=new URL(request.url).pathname;
    const navigationFile=path.endsWith('/app.html')?'./app.html'+new URL(request.url).search:path.endsWith('/pool-infos.html')?'./pool-infos.html':path.endsWith('/infos.html')?'./infos.html':'./index.html';
    event.respondWith(
      fetch(request, {cache: 'no-cache'})
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(navigationFile, copy));
          }
          return response;
        })
        .catch(async () => {
          return (await caches.match(navigationFile)) ||
                 (path.endsWith('/app.html')?await caches.match('./app.html'):await caches.match('./index.html')) ||
                 Response.error();
        })
    );
    return;
  }

  // Static app files: cache first, network as fallback.
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});


self.addEventListener('push', event => {
  let payload={};try{payload=event.data?.json()||{}}catch{}
  event.waitUntil(self.registration.showNotification(payload.title||'Snooker Money Match',{
    body:payload.body||'Neue Freigabeanfrage',icon:'./icon-192.png',badge:'./icon-192.png',tag:'snooker-access-request',data:{url:'./index.html'}
  }));
});
self.addEventListener('notificationclick', event=>{
  event.notification.close();
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(async wins=>{
    for(const win of wins){if(win.url.startsWith(self.registration.scope)){await win.focus();return}}
    await clients.openWindow('./index.html');
  }));
});
