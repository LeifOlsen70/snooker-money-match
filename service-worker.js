const CACHE_NAME = 'v7-53-swiss-tournament';
const APP_SHELL = [
  './',
  './index.html',
  './infos.html',
  './account-access.js?v=7.53',
  './firebase-sync.js?v=7.53',
  './pdf-export.js?v=7.53',
  './tournament.js?v=7.53',
  './tournament.css?v=7.53',
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
    const navigationFile = new URL(request.url).pathname === new URL('./infos.html', self.registration.scope).pathname
      ? './infos.html' : './index.html';
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
                 (await caches.match('./')) ||
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
