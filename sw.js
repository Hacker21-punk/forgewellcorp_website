/*
  Forgewell Corporation — Service Worker
  - Cache-first for static assets (images, fonts, css, js, svg)
  - Stale-while-revalidate for HTML
  - Network-first for navigations when online
  Bump CACHE name to invalidate when assets change.
*/
"use strict";

const CACHE = "forgewell-v4";
const ASSET_CACHE = "forgewell-assets-v4";
const PRECACHE = [
  "./",
  "index.html",
  "styles.css",
  "script.js",
  "site.webmanifest",
  "robots.txt",
  "sitemap.xml",
  "assets/media/logo-2.svg",
  "assets/media/logo-full.svg",
  "404.html",
  "trueprogress/index.html",
  "trueprogress/survey.html",
  "trueprogress/video.html",
  "trueprogress/login.html",
  "trueprogress/reset-password.html",
  "trueprogress/assets/index.css",
  "trueprogress/assets/login.css",
  "trueprogress/assets/reset-password.css",
  "trueprogress/assets/trueprogress_logo.png",
  "trueprogress/backup%20details%20of%20trueprogress/users.json",
  "trueprogress/backup%20details%20of%20trueprogress/videos.json",
  "trueprogress/backup%20details%20of%20trueprogress/surveys.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => ![CACHE, ASSET_CACHE].includes(k)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

const isAsset = (url) =>
  /\.(?:css|js|json|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|webmanifest)$/i.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match("index.html").then((r) => r || caches.match("/")))
    );
    return;
  }

  if (isAsset(url)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) {
          fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); }).catch(() => {});
          return cached;
        }
        try {
          const res = await fetch(req);
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        } catch (_) {
          return cached || Response.error();
        }
      })
    );
  }
});
