const CACHE_NAME = "gothic-lockpick-v" + Date.now();
const APP_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./styles.css?v=1.5.7",
  "./script.js",
  "./script.js?v=1.5.7",
  "./js/core.js",
  "./js/core.js?v=1.5.7",
  "./js/plate-ui.js",
  "./js/plate-ui.js?v=1.5.7",
  "./js/solution.js",
  "./js/solution.js?v=1.5.7",
  "./js/app-controller.js",
  "./js/app-controller.js?v=1.5.7",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/maskable.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return networkResponse;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
