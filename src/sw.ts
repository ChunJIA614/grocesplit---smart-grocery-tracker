/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute } from 'workbox-precaching';
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || '',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.FIREBASE_APP_ID || '',
};

let messagingInitialized = false;

if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId) {
  const app = initializeApp(firebaseConfig);
  const messaging = getMessaging(app);
  messagingInitialized = true;

  onBackgroundMessage(messaging, (payload) => {
    const title = payload.notification?.title || payload.data?.title || 'New split payment';
    const body = payload.notification?.body || payload.data?.body || 'A new bill was added.';
    const url = payload.data?.url || '/';

    self.registration.showNotification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: { url },
    });
  });
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data as { url?: string } | undefined)?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          return;
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

if (!messagingInitialized) {
  console.warn('Firebase messaging is not initialized in the service worker.');
}