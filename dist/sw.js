// ── Permic Wear PWA Service Worker v7 ────────────────────────────────────────
const CACHE_NAME = "permic-wear-v7";

const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/shoe.png",
  "/outfit.png",
];

self.addEventListener("install", (e) => {
  // Take over immediately — don't wait for old SW to finish
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_ASSETS).catch((err) =>
        console.warn("[SW] Pre-cache failed:", err.message)
      )
    )
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    // Delete ALL old caches, then claim all clients immediately
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  const url = new URL(e.request.url);

  // Never touch cross-origin requests (backend API)
  if (url.origin !== self.location.origin) return;

  // Never touch Vite internals
  if (url.pathname.startsWith("/@")) return;

  // Navigation: network-first, fall back to index.html
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            caches.open(CACHE_NAME).then((c) => c.put(e.request, res.clone()));
          }
          return res;
        })
        .catch(() =>
          caches.match("/index.html").then((c) => c || new Response("Offline", { status: 503 }))
        )
    );
    return;
  }

  // Static assets: cache-first, no clone-after-read bug
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|webp)$/) ||
      url.pathname === "/manifest.json") {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          if (res.ok) {
            // clone BEFORE doing anything else with res
            const toCache = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, toCache));
          }
          return res;
        });
      })
    );
    return;
  }

  // Everything else: network only — no caching, no clone errors
});
