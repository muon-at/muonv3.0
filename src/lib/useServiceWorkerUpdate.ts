import { useEffect } from 'react';

export const useServiceWorkerUpdate = () => {
  useEffect(() => {
    // Register service worker if available
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker-update.js')
        .then((registration) => {
          console.log('✅ Service Worker registered:', registration);
          
          // AGGRESSIVE: Check for new SW on every app open
          if (registration.waiting) {
            console.log('⏳ Waiting SW detected - reloading...');
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
          }

          // Listen for new SW ready
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'waiting' && navigator.serviceWorker.controller) {
                  console.log('🔄 New SW ready - reloading...');
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  window.location.reload();
                }
              });
            }
          });

          // Listen for messages from service worker
          navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
              console.log('📲 Update available - reloading...');
              window.location.reload();
            }
          });

          // Check for updates frequently
          const checkInterval = setInterval(() => {
            if (registration.active) {
              registration.active.postMessage({ type: 'CHECK_FOR_UPDATES' });
            }
          }, 30000); // Check every 30 seconds (was 60)

          // Initial check immediately
          if (registration.active) {
            registration.active.postMessage({ type: 'CHECK_FOR_UPDATES' });
          }

          // Also check when app becomes visible
          document.addEventListener('visibilitychange', () => {
            if (!document.hidden && registration.active) {
              console.log('📱 App became visible - checking for updates...');
              registration.active.postMessage({ type: 'CHECK_FOR_UPDATES' });
            }
          });

          return () => clearInterval(checkInterval);
        })
        .catch((error) => {
          console.error('❌ Service Worker registration failed:', error);
        });
    }
  }, []);
};
