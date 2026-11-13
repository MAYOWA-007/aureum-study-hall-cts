const CACHE_NAME = "aureum-study-hall-cts-v4";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./favicon-192.png",
  "./favicon-512.png",
  "./audio/narration/manifest.json",
  "./audio/narration/pack.json",
  "./audio/narration/pack-cts-i.json",
  "./audio/narration/pack-cts-d.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok && response.status === 200) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy)).catch(() => {});
        }
        return response;
      }).catch(() => caches.match("./index.html")),
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (!response.ok) return response;
      if (response.status !== 200) return response;
      const copy = response.clone();
      void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
      return response;
    })),
  );
});
