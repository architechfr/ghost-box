/* ═══════════════════════════════════════════════════════════════════════
   verifier.js — vérifie www/ AVANT de le confier au téléphone.

   POURQUOI ce script existe : l'empaquetage déplace le site sous une autre
   origine (https://localhost au lieu de architechfr.github.io). Les 164
   chemins absolus /ghost-box/... sont censés continuer de résoudre grâce au
   dossier www/ghost-box/ et à la page de renvoi. « Censés » ne suffit pas :
   une seule ressource manquante ne se verrait qu'en cave, hors réseau, au
   moment où on ne peut plus rien y faire.

   Ce qui est vérifié, page par page : le renvoi de la racine, zéro erreur
   JavaScript, zéro requête en échec, et la présence effective du lexique —
   sans lui, aucun mot ne peut sortir.

   Usage : node scripts/verifier.js     (après npm run preparer)
   ═══════════════════════════════════════════════════════════════════════ */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const WWW = path.resolve(__dirname, '..', 'www');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.woff2': 'font/woff2',
  '.csv':  'text/csv'
};

/* Les pages à ouvrir. Ce sont celles que l'ENVELOPPE du service worker
   promet hors ligne : si l'une d'elles casse ici, elle cassera sur le
   terrain. */
const PAGES = [
  ['/', 'renvoi de la racine'],
  ['/ghost-box/', 'accueil'],
  ['/ghost-box/seance/', 'séance caméra'],
  ['/ghost-box/banc/', 'séance capteurs'],
  ['/ghost-box/mur/', 'le mur'],
  ['/ghost-box/enregistreur/', 'Écoute'],
  ['/ghost-box/bibliotheque/', 'Bibliothèque'],
  ['/ghost-box/reglages/', 'Réglages'],
  ['/ghost-box/manuel/', "Mode d'emploi"],
  ['/ghost-box/contact-ia/', 'Contact via IA'],
  ['/ghost-box/realisateur/', 'redirection réalisateur'],
  ['/ghost-box/vision/', 'redirection vision']
];

function servir() {
  return new Promise(resolve => {
    const serveur = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(WWW, p);
      /* Un chemin qui sort de www/ est refusé : ce serveur ne sert qu'à
         vérifier, il n'a aucune raison de lire ailleurs. */
      if (!f.startsWith(WWW) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        res.writeHead(404); res.end('404'); return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    serveur.listen(0, '127.0.0.1', () => resolve(serveur));
  });
}

(async () => {
  const { chromium } = require(
    require('child_process').execSync('npm root -g').toString().trim() + '/playwright');

  const serveur = await servir();
  const base = 'http://127.0.0.1:' + serveur.address().port;

  const nav = await chromium.launch({
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
  });

  let echecs = 0;
  for (const [chemin, nom] of PAGES) {
    const ctx = await nav.newContext({
      viewport: { width: 412, height: 915 },
      permissions: ['camera', 'microphone']
    });
    const page = await ctx.newPage();
    const erreurs = [];
    const manquants = [];

    page.on('pageerror', e => erreurs.push(String(e).split('\n')[0]));
    page.on('console', m => { if (m.type() === 'error') erreurs.push(m.text().slice(0, 160)); });
    page.on('response', r => {
      /* Le modèle MediaPipe et l'API Mistral sortent de l'appareil : leur
         absence ici est normale, ce n'est pas ce qu'on teste. */
      const u = r.url();
      if (r.status() >= 400 && u.startsWith(base)) manquants.push(r.status() + ' ' + u.replace(base, ''));
    });

    await page.goto(base + chemin, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => {
      erreurs.push('navigation : ' + e.message.split('\n')[0]);
    });
    await page.waitForTimeout(600);

    const url = page.url().replace(base, '');
    const bon = erreurs.length === 0 && manquants.length === 0;
    if (!bon) echecs++;
    console.log((bon ? 'OK  ' : 'KO  ') + nom.padEnd(22) + chemin.padEnd(26) + '→ ' + url);
    erreurs.slice(0, 4).forEach(e => console.log('       erreur   : ' + e));
    manquants.slice(0, 6).forEach(m => console.log('       manquant : ' + m));

    await ctx.close();
  }

  /* Le lexique à part : c'est la seule ressource dont l'absence ne produit
     aucune erreur visible mais rend l'application muette pour toujours. */
  const ctx = await nav.newContext();
  const page = await ctx.newPage();
  const n = await page.goto(base + '/ghost-box/data/lexique.json')
    .then(r => r.json()).then(j => (j.mots || []).length)
    .catch(() => 0);
  console.log((n > 0 ? 'OK  ' : 'KO  ') + 'lexique'.padEnd(22) + String(n) + ' mots');
  if (!n) echecs++;

  await nav.close();
  serveur.close();

  console.log(echecs ? '\n' + echecs + ' page(s) en échec.' : '\nToutes les pages passent.');
  process.exit(echecs ? 1 : 0);
})();
