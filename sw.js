/* Panduan Umrah service worker: app shell works offline; fonts are cached the first time they load. */
const VERSION = "umrah-v3";
const SHELL = ["./", "index.html", "manifest.json", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";

  if (isFont) {
    // stale-while-revalidate
    e.respondWith(
      caches.open(VERSION).then((cache) =>
        cache.match(req).then((hit) => {
          const net = fetch(req).then((res) => { cache.put(req, res.clone()); return res; }).catch(() => hit);
          return hit || net;
        })
      )
    );
    return;
  }

  if (url.origin === self.location.origin) {
    // network first (so updates show up straight away), cache fallback (so it still works offline)
    e.respondWith(
      new Promise((resolve) => {
        let settled = false;
        const fromCache = () => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === "navigate" ? caches.match("index.html") : undefined));
        const timer = setTimeout(() => { if (!settled) fromCache().then((r) => { if (r && !settled) { settled = true; resolve(r); } }); }, 3000);
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          if (!settled) { settled = true; clearTimeout(timer); resolve(res); }
        }).catch(() => fromCache().then((r) => { if (!settled) { settled = true; clearTimeout(timer); resolve(r || Response.error()); } }));
      })
    );
  }
});
