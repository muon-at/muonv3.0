// PWA Auto-Update Service Worker
const CACHE_NAME = 'muonv2-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cache opened');
        return cache.addAll(urlsToCache).catch(err => {
          console.log('[SW] Cache addAll error (expected for dynamic URLs):', err);
        });
      })
  );
  self.skipWaiting(); // Activate immediately
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // Take control immediately
});

// Fetch event - Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests and non-GET
  if (!event.request.url.startsWith(self.location.origin) || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache on network error
        return caches.match(event.request)
          .then((response) => {
            if (response) {
              return response;
            }
            // Return offline page if available
            return caches.match('/index.html');
          });
      })
  );
});

// Store version hash
let versionHash = null;

// Listen for messages from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] SKIP_WAITING received - activating...');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CHECK_FOR_UPDATES') {
    console.log('[SW] Checking for updates...');
    
    // Fetch index.html with timestamp to bypass cache
    const timestamp = new Date().getTime();
    fetch(`/index.html?t=${timestamp}`, { 
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
      .then((response) => {
        if (response.status === 200) {
          return response.text();
        }
        throw new Error('Failed to fetch index.html');
      })
      .then((html) => {
        // Simple hash of HTML to detect changes
        const hash = simpleHash(html);
        console.log('[SW] Current hash:', hash, 'Stored hash:', versionHash);
        
        if (versionHash && versionHash !== hash) {
          console.log('[SW] UPDATE DETECTED - notifying clients');
          // Notify all clients to reload
          self.clients.matchAll().then((clients) => {
            clients.forEach((client) => {
              client.postMessage({
                type: 'UPDATE_AVAILABLE'
              });
            });
          });
        } else {
          versionHash = hash;
          console.log('[SW] No update detected, version unchanged');
        }
      })
      .catch((error) => {
        console.error('[SW] Update check failed:', error);
      });
  }
});

// Simple hash function
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}
