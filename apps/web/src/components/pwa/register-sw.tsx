'use client';

import { useEffect } from 'react';

const IS_DEV = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export function RegisterSW() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // Development mode: unregister SW and clear caches to prevent stale bundles
    if (IS_DEV) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => caches.delete(key));
        });
      }
      return;
    }

    // Production: register SW normally
    async function register() {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        // Check for updates periodically (every 30 min)
        setInterval(() => {
          registration.update();
        }, 30 * 60 * 1000);

        // Listen for new SW waiting to activate
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent('sw-update-available'));
            }
          });
        });

        // Listen for SW controlling the page for the first time
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      } catch (error) {
        console.warn('[PWA] Service Worker registration failed:', error);
      }
    }

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register);
    }
  }, []);

  return null;
}
