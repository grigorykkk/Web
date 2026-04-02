const APP_SHELL_CACHE = "taskflow-app-shell-v4";
const DYNAMIC_CACHE = "taskflow-dynamic-v2";
const APP_SHELL_ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./style.css",
  "./manifest.json",
  "./content/home.html",
  "./icons/favicon-32x32.png",
  "./icons/favicon-64x64.png",
  "./icons/favicon-128x128.png",
  "./icons/favicon-192x192.png",
  "./icons/favicon-256x256.png",
  "./icons/favicon-512x512.png",
];

function isDynamicContentRequest(requestUrl) {
  return requestUrl.pathname.startsWith("/content/");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== APP_SHELL_CACHE && key !== DYNAMIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (isDynamicContentRequest(url)) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => cache.put(event.request, responseClone));
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(event.request);
          return cachedResponse || caches.match("./content/home.html");
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (url.origin === self.location.origin && networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(async () => {
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }

          return new Response("Ресурс недоступен офлайн.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        });
    }),
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "Новое уведомление", body: "Появилась новая задача." };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (error) {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "./icons/favicon-192x192.png",
      badge: "./icons/favicon-64x64.png",
      data: { url: "./" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const existingClient = clientList.find((client) => "focus" in client);
      if (existingClient) {
        return existingClient.focus();
      }
      return clients.openWindow("./");
    }),
  );
});
