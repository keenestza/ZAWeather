const CACHE_NAME = "zaweather-v1";
const APP_SHELL = [
  "/ZAWeather/",
  "/ZAWeather/manifest.webmanifest",
  "/ZAWeather/icon.svg",
  "/ZAWeather/apple-touch-icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          const cloned = response.clone();

          if (event.request.url.startsWith("http")) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, cloned).catch(() => {});
            });
          }

          return response;
        })
        .catch(() => cached);
    })
  );
});