/* ═══════════════════════════════════════════════════════════════════════
   Service worker — le poste de terrain fonctionne SANS réseau.

   Les lieux d'utilisation réels (caves, châteaux, campagne) sont ceux où le
   réseau manque. Une version antérieure de ce fichier était volontairement
   passive : l'application ne s'ouvrait pas du tout hors ligne.

   Stratégie, volontairement simple :
   — l'enveloppe (pages, lib, lexique, polices, marque) est PRÉ-mise en cache
     à l'installation : l'application s'ouvre toujours, même sans réseau ;
   — les pages HTML passent réseau d'abord, cache en secours : en ligne on a
     toujours la dernière version, hors ligne on a la dernière connue ;
   — les fichiers versionnés (?v=N) passent cache d'abord : leur nom change
     quand leur contenu change, le cache ne peut pas mentir ;
   — le modèle de détection de personne (CDN externe, ~5 Mo) est mis en cache
     à sa première utilisation : la détection marche hors ligne dès qu'elle a
     marché une fois en ligne ;
   — l'API Mistral n'est JAMAIS mise en cache : c'est un envoi, pas un fichier.

   À CHAQUE LIVRAISON : incrémenter VERSION ci-dessous en même temps que les
   ?v= des pages — c'est elle qui jette l'ancien cache.
   ═══════════════════════════════════════════════════════════════════════ */
const VERSION = 'v9';
const CACHE   = 'ghostbox-' + VERSION;
const RACINE  = '/ghost-box/';

const ENVELOPPE = [
  RACINE,
  RACINE + 'index.html',
  RACINE + 'seance/', RACINE + 'banc/', RACINE + 'mur/',
  RACINE + 'enregistreur/', RACINE + 'bibliotheque/', RACINE + 'contact-ia/',
  RACINE + 'manifest.json',
  RACINE + 'data/lexique.json',
  RACINE + 'favicon.png',
  RACINE + 'assets/marque.png',
  RACINE + 'assets/wordmark.png',
  RACINE + 'assets/icone-192.png',
  // modules et feuilles, avec leur numéro : ce sont ces URL-là que les pages demandent
  ...['moteur','mur','tampon','secours','pose','capture','wakelock','media','fullscreen','retour','aide','action']
    .map(m => RACINE + 'lib/' + m + '.js?v=' + VERSION.slice(1)),
  ...['ambiance','fonts'].map(m => RACINE + 'lib/' + m + '.css?v=' + VERSION.slice(1)),
  // polices : sans elles, l'application change de visage hors ligne
  ...['barlow-condensed-latin-500','barlow-condensed-latin-600',
      'barlow-condensed-latin-ext-500','barlow-condensed-latin-ext-600',
      'ibm-plex-mono-latin-400','ibm-plex-mono-latin-500',
      'ibm-plex-mono-latin-ext-400','ibm-plex-mono-latin-ext-500',
      'ibm-plex-sans-latin-400','ibm-plex-sans-latin-500',
      'ibm-plex-sans-latin-ext-400','ibm-plex-sans-latin-ext-500']
    .map(f => RACINE + 'assets/fonts/' + f + '-normal.woff2')
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // addAll échoue en bloc si UNE ressource manque : on ajoute une par une,
      // une icône absente ne doit pas priver l'application de tout son cache
      .then(c => Promise.allSettled(ENVELOPPE.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith('ghostbox-') && k !== CACHE)
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // jamais de cache sur l'API : une transcription est un envoi, pas un fichier
  if (url.hostname === 'api.mistral.ai') return;

  // pages : réseau d'abord (fraîcheur), cache en secours (terrain sans réseau)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => {
        const copie = r.clone();
        caches.open(CACHE).then(c => c.put(req, copie)).catch(() => {});
        return r;
      }).catch(() =>
        caches.match(req).then(r => r || caches.match(RACINE))
      )
    );
    return;
  }

  // même origine : cache d'abord — les fichiers sont versionnés, le cache ne ment pas
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(r => r || fetch(req).then(rep => {
        if (rep && rep.ok) {
          const copie = rep.clone();
          caches.open(CACHE).then(c => c.put(req, copie)).catch(() => {});
        }
        return rep;
      }))
    );
    return;
  }

  // CDN (modèle de pose, wasm MediaPipe) : cache d'abord, rempli à la première
  // utilisation — la détection de personne marche hors ligne dès qu'elle a
  // marché une fois en ligne
  if (url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'storage.googleapis.com') {
    e.respondWith(
      caches.match(req).then(r => r || fetch(req).then(rep => {
        if (rep && (rep.ok || rep.type === 'opaque')) {
          const copie = rep.clone();
          caches.open(CACHE).then(c => c.put(req, copie)).catch(() => {});
        }
        return rep;
      }))
    );
  }
});
