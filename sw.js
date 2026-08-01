/* Service worker volontairement PASSIF.
   Il existe uniquement pour rendre l'application installable. Il n'intercepte
   ni ne met en cache aucune requête : le navigateur travaille normalement.
   (Une version antérieure faisait respondWith(fetch(...)) — retiré, un service
   worker qui s'interpose peut perturber le chargement selon les navigateurs.) */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* rien : requête laissée au navigateur */ });
