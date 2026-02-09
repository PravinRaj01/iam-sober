// Service Worker Push Notification Handler
// This file handles incoming push notifications

// Ensure this service worker activates immediately and takes control
self.skipWaiting();

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function(event) {
  console.log('[SW] Push received:', event);
  
  let data = {
    title: 'I Am Sober',
    body: 'You have a new notification',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    url: '/',
    data: {}
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      console.error('[SW] Error parsing push data:', e);
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      ...data.data
    },
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    tag: data.data?.type || 'general',
    renotify: true,
    requireInteraction: data.data?.type === 'proactive_intervention'
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Build full URL from notification data
  const urlPath = event.notification.data?.url || '/';
  const fullUrl = new URL(urlPath, self.registration.scope).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // First try to focus an existing window
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ('focus' in client) {
          return client.focus().then(function(focusedClient) {
            // Post message to navigate instead of using navigate()
            if (focusedClient && 'postMessage' in focusedClient) {
              focusedClient.postMessage({
                type: 'NOTIFICATION_CLICK',
                url: urlPath
              });
            }
            return focusedClient;
          }).catch(function() {
            // Focus failed, fall through to openWindow
            return clients.openWindow(fullUrl);
          });
        }
      }
      // No existing window, open new one
      return clients.openWindow(fullUrl);
    })
  );
});

self.addEventListener('notificationclose', function(event) {
  console.log('[SW] Notification closed:', event);
});
