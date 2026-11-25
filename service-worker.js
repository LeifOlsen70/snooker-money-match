const CACHE_NAME = 'v9-14-registration-name';
const APP_SHELL = [
  './',
  './knockout.js?v=9.14',
  './index.html',
  './spectator.html',
  './creator-return.js?v=9.14',
  './spectator-entry.js?v=9.14',
  './vendor/jsQR.js?v=9.14',
  './spectator.css?v=9.14',
  './spectator-view.js?v=9.14',
  './spectator-render.js?v=9.14',
  './spectator-model.js?v=9.14',
  './spectator-owner.js?v=9.14',
  './spectator-share.js?v=9.14',
  './firebase-config.js?v=9.14',
  './table-connection.js?v=9.14',
  './vendor/qrcode.js?v=9.14',
  './app.html',
  './app.html?sport=pool',
  './app.html?sport=snooker',
  './sports.js?v=9.14',
  './player-picker.js?v=9.14',
  './kai-audio.js?v=9.14',
  './audio/Kai_01-09.mp3',
  './audio/Kai_10-19.mp3',
  './audio/Kai_20-29.mp3',
  './audio/Kai_30-39.mp3',
  './player-picker.css?v=9.14',
  './partner-drag.js?v=9.14',
  './pool-planner.js?v=9.14',
  './pool-single.js?v=9.14',
  './pool.css?v=9.14',
  './pool-logo.png',
  './pool-infos.html',
  './infos.html',
  './app-navigation.js?v=9.14',
  './account-access.js?v=9.14',
  './access-ui.js?v=9.14',
  './table-access.js?v=9.14',
  './table-score.js?v=9.14',
  './table-sync.js?v=9.14',
  './table-monitor.js?v=9.14',
  './firebase-sync.js?v=9.14',
  './pdf-export.js?v=9.14',
  './tournament.js?v=9.14',
  './tournament.css?v=9.14',
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
    const navigationFile=path.endsWith('/spectator.html')?'./spectator.html':path.endsWith('/app.html')?'./app.html'+new URL(request.url).search:path.endsWith('/pool-infos.html')?'./pool-infos.html':path.endsWith('/infos.html')?'./infos.html':'./index.html';
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
                 (path.endsWith('/spectator.html')?await caches.match('./spectator.html'):path.endsWith('/app.html')?await caches.match('./app.html'):await caches.match('./index.html')) ||
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
