/* ═══════════════════════════════════════════════════════════════════════
   preparer-cf.js — construit dist/ pour Cloudflare Pages.

   POURQUOI ce script existe : le depot est passe en prive, et GitHub Pages
   n'existe pas pour un depot prive sur l'offre gratuite — le site a ete
   depublie. Cloudflare Pages, lui, construit depuis un depot prive et sert
   un site public. Il faut donc lui fabriquer un dossier a servir.

   POURQUOI le site va dans dist/ghost-box/ et pas a la racine de dist/ :
   les chemins absolus /ghost-box/... sont ecrits en dur dans le site, RACINE
   de sw.js et scope du manifest en font partie. En conservant le prefixe,
   TOUS ces chemins resolvent sans qu'une seule ligne du site soit modifiee :
   version web, version Cloudflare et version Android restent le meme code.
   dist/index.html n'est la que pour renvoyer vers ce prefixe.

   Meme principe et memes exclusions que android-app/scripts/preparer.js.
   dist/ n'est pas versionne : le depot reste la seule source de verite.
   ═══════════════════════════════════════════════════════════════════════ */

const fs   = require('fs');
const path = require('path');

const RACINE_DEPOT = path.resolve(__dirname, '..');
const DIST         = path.join(RACINE_DEPOT, 'dist');
const SITE         = path.join(DIST, 'ghost-box');

/* Ce qui ne sert pas a servir le site : outils de developpement, empaquetage
   Android, documentation, schemas de base de donnees. */
const EXCLUS = new Set([
  '.git', '.github', '.gitignore', '.claude',
  'android-app', 'deploiement', 'dist', '_to_delete',
  'docs', 'db',
  'CLAUDE.md', 'README.md', 'LICENSE',
  'node_modules',
  /* Outils d'hebergement : ils n'ont rien a faire sur le site public.
     .wrangler contient le cache de connexion (identifiant de compte
     Cloudflare) — il etait servi en clair avant qu'on le remarque. */
  '.wrangler', 'wrangler.toml', '.nojekyll'
]);

/* data/ ne garde que le lexique : gen_lexique.py et lexique.csv sont les
   outils qui le fabriquent, pas ce que l'application lit. */
const EXCLUS_DATA = new Set(['gen_lexique.py', 'lexique.csv']);

function copier(src, dest) {
  const nom = path.basename(src);
  if (EXCLUS.has(nom)) return 0;
  if (path.basename(path.dirname(src)) === 'data' && EXCLUS_DATA.has(nom)) return 0;

  const etat = fs.statSync(src);
  if (etat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    return fs.readdirSync(src)
      .reduce((n, e) => n + copier(path.join(src, e), path.join(dest, e)), 0);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return 1;
}

/* Page de renvoi. Rien a telecharger, pas de script externe : le fond reprend
   la couleur de l'application pour qu'aucun eclair blanc ne traverse l'ecran
   au lancement — en seance de nuit, un flash blanc ruine l'oeil. */
const RENVOI = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Ghost Box</title>
<meta http-equiv="refresh" content="0;url=./ghost-box/">
<style>html,body{margin:0;height:100%;background:#0A0F12}</style>
</head>
<body>
<script>location.replace('./ghost-box/');</script>
</body>
</html>
`;

if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(SITE, { recursive: true });

let n = 0;
for (const entree of fs.readdirSync(RACINE_DEPOT)) {
  n += copier(path.join(RACINE_DEPOT, entree), path.join(SITE, entree));
}
fs.writeFileSync(path.join(DIST, 'index.html'), RENVOI);

/* Verification franche plutot qu'un « ca devrait marcher » : si une de ces
   pieces manque, le site se lancera sur un ecran mort et il vaut mieux le
   savoir ici que sur le terrain. */
const INDISPENSABLES = [
  'index.html', 'manifest.json', 'sw.js',
  'data/lexique.json',
  'lib/moteur.js', 'lib/mur.js', 'lib/capteurs.js',
  'simple/index.html', 'banc/index.html', 'seance/index.html',
  'mur/index.html', 'planche/index.html',
  'enregistreur/index.html', 'bibliotheque/index.html',
  'reglages/index.html', 'manuel/index.html', 'contact-ia/index.html'
];
const manquants = INDISPENSABLES.filter(f => !fs.existsSync(path.join(SITE, f)));
if (manquants.length) {
  console.error('MANQUANT dans dist/ghost-box/ : ' + manquants.join(', '));
  process.exit(1);
}

const version = (fs.readFileSync(path.join(SITE, 'sw.js'), 'utf8')
  .match(/const VERSION\s*=\s*'([^']+)'/) || [, '?'])[1];

console.log('dist/ construit : ' + n + ' fichiers, site en ' + version);
