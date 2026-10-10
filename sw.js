/* Service worker Study Hub: cache cangkang aplikasi + notifikasi push */
const CACHE = "s5-shell-v1";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Jaringan dulu supaya update langsung terlihat; cache hanya cadangan saat offline.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return; // API dan font langsung ke jaringan
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("./")))
  );
});

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : "" }; }
  const show = () => self.registration.showNotification(d.title || "Study Hub", {
    body: d.body || "",
    icon: "icon-192.png",
    badge: "icon-192.png",
    tag: d.tag || undefined,
    data: { url: d.url || "./" }
  });
  // Pesan forum dan chat admin: kalau aplikasi sedang terlihat, cukup tampil di dalam aplikasi (hindari dobel).
  const inApp = d.tag === "forum" || String(d.tag || "").startsWith("inbox");
  e.waitUntil(inApp
    ? self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => (list.some((c) => c.visibilityState === "visible") ? null : show()))
    : show());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const tag = e.notification.tag || "";
      for (const c of list) {
        if ("focus" in c) {
          if (tag.startsWith("inbox")) c.postMessage({ type: "open-inbox" });   // buka chat admin di aplikasi
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
