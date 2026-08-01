/* Service worker minimal : rend l'application installable, SANS mettre les pages en cache.
   Volontaire — un cache agressif ferait tester d'anciennes versions après chaque mise à jour. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  // toujours le réseau ; repli sur le cache navigateur seulement si hors ligne
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
