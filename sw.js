const CACHE_NAME = "taskflow-cache-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./client.js",
  "./manifest.json",
  "./icons/favicon-32x32.png",
  "./icons/favicon-64x64.png",
  "./icons/favicon-128x128.png",
  "./icons/favicon-192x192.png",
  "./icons/favicon-256x256.png",
  "./icons/favicon-512x512.png",
];

function isAppAssetRequest(request) {
  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isDocument = request.mode === "navigate";
  const isStaticAsset = [".css", ".js", ".json", ".png", ".ico", ".html"].some((extension) =>
    url.pathname.endsWith(extension),
  );

  return isSameOrigin && (isDocument || isStaticAsset);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin === self.location.origin && requestUrl.pathname === "/__ping") {
    event.respondWith(fetch(event.request));
    return;
  }

  if (isAppAssetRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }

          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }

          return new Response("Ресурс недоступен офлайн.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
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
          if (event.request.url.startsWith(self.location.origin)) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
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
