const CACHE_NAME = "mydoctor-v2";
const OFFLINE_URL = "/offline.html";

// App shell files to cache on install
const APP_SHELL = [
  OFFLINE_URL,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") return;

  // Skip non-http(s) requests and API/Supabase calls
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) return;
  if (url.hostname.includes("supabase")) return;

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then(
        (cached) => cached || caches.match(OFFLINE_URL)
      )
    )
  );
});
