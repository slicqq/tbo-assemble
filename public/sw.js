const CACHE_VERSION = "v5";
const CACHE_NAME = `tbo-assemble-${CACHE_VERSION}`;
// Only public, non-personal static assets may be cached. Never cache pages,
// server-component responses, authentication, APIs or event data.
const STATIC_ASSETS = ["/logo.svg", "/manifest.json", "/favicon.ico"];

// Install — cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clear old caches (version-based invalidation)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("tbo-assemble-") && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Navigations are network-only so one user's account data cannot be replayed
// from a shared browser cache after logout or to another user.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => new Response(
      '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline — TBO Assemble</title></head><body><main><h1>You are offline</h1><p>Connect to the internet and reload to access this page.</p></main></body></html>',
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
    )));
    return;
  }
  if (!url.search && STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(fetch(request).then(async (response) => {
      if (response.ok) {
        try { const cache = await caches.open(CACHE_NAME); await cache.put(request, response.clone()); }
        catch { /* Cache failures must not break the network response. */ }
      }
      return response;
    }).catch(() => caches.match(request).then((cached) => cached || new Response("Offline", {status: 503}))));
  }
});

// Push notifications (demo)
self.addEventListener("push", (event) => {
  const defaultData = {
    title: "TBO Assemble",
    body: "You have a new notification",
    icon: "/logo.svg",
    badge: "/logo.svg",
    tag: "tbo-notification",
  };

  let data = defaultData;
  try {
    data = event.data ? { ...defaultData, ...event.data.json() } : defaultData;
  } catch {
    // Use default data if parsing fails
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      renotify: true,
      vibrate: [100, 50, 100],
      data: data.data || {},
      actions: data.actions || [
        { action: "view", title: "View" },
        { action: "dismiss", title: "Dismiss" },
      ],
    })
  );
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Open new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Background sync for offline form submissions (demo)
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-bookings") {
    event.waitUntil(syncPendingBookings());
  }
});

async function syncPendingBookings() {
  // This would sync any pending offline bookings when connection is restored
  console.log("[SW] Syncing pending bookings...");
  // In production, this would read from IndexedDB and POST to server
}
