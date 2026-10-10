const CACHE_NAME = 'bible-study-cache-v1';
const urlsToCache = [
  '/au-zone/bbs/',
  '/au-zone/bbs/manifest.json',
  '/au-zone/bbs/icons/icon-32.png',
  '/au-zone/bbs/icons/icon-192.png',
  '/au-zone/bbs/icons/icon-512.png',
  '/au-zone/bbs/screens/short1.jpg',
  '/au-zone/bbs/screens/short2.jpg',
  '/au-zone/bbs/screens/short3.jpg',
  '/au-zone/bbs/screens/short4.jpg'
];

// Install service worker and cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate and clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Fetch from cache first, then network
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached response if found
        if (response) {
          return response;
        }
        
        // Otherwise fetch from network
        return fetch(event.request)
          .then(response => {
            // Check if valid response
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response for caching
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
              
            return response;
          })
          .catch(() => {
            // If both cache and network fail, show fallback
            return new Response('You are offline. Please connect to the internet to use this app.');
          });
      })
  );
});
