import { useEffect } from 'react';

export const useServiceWorkerUpdate = () => {
  useEffect(() => {
    // Register service worker if available
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker-update.js')
        .then((registration) => {
          console.log('✅ Service Worker registered');
          
          // CONSERVATIVE: Only check periodically, don't auto-reload
          const checkInterval = setInterval(() => {
            if (registration.active) {
              registration.active.postMessage({ type: 'CHECK_FOR_UPDATES' });
            }
          }, 120000); // Check every 2 minutes (conservative)

          // Listen for update notification (user-triggered only)
          navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
              console.log('📲 Update available - user can refresh');
              // Don't auto-reload - let user decide
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
