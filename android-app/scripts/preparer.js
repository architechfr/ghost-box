/* ═══════════════════════════════════════════════════════════════════════
   preparer.js — construit www/ a partir du site du depot.

   POURQUOI ce script existe, et pourquoi www/ n'est pas versionne :
   le site du depot est la SEULE source de verite. Toute copie figee de
   ghost-box dans android-app/ serait une deuxieme verite a maintenir, et
   la discipline VERSION + ?v=N de sw.js ne pardonne pas les copies qui
   derivent. On recopie donc a chaque construction, jamais a la main.

   POURQUOI le site va dans www/ghost-box/ et pas a la racine de www/ :
   164 chemins absolus /ghost-box/... sont ecrits en dur dans 19 fichiers,
   RACINE de sw.js et scope du manifest en font partie. En conservant le
   prefixe, TOUS ces chemins resolvent sans qu'une seule ligne du site soit
   modifiee : la version web et la version Android restent le meme code.
   www/index.html n'est la que pour renvoyer vers ce prefixe au demarrage.
   ═══════════════════════════════════════════════════════════════════════ */

const fs   = require('fs');
const path = require('path');

const RACINE_DEPOT = path.resolve(__dirname, '..', '..');
const WWW          = path.resolve(__dirname, '..', 'www');
const SITE         = path.join(WWW, 'ghost-box');

/* Ce qui ne sert pas a l'execution sur le telephone : outils de developpement,
   documentation, schemas de base de donnees, et le dossier d'empaquetage
   lui-meme. Les embarquer alourdirait l'application sans rien lui apporter. */
const EXCLUS = new Set([
  '.git', '.github', '.gitignore',
  'android-app',
  'docs', 'db',
  'CLAUDE.md', 'README.md', 'LICENSE',
  'node_modules'
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

/* Page de renvoi. Elle doit tenir hors ligne et sans reseau : pas de script
   externe, pas de police, rien a telecharger. Le fond reprend la couleur de
   l'application pour qu'aucun eclair blanc ne traverse l'ecran au lancement —
   en seance de nuit, un flash blanc ruine l'adaptation de l'oeil. */
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

if (fs.existsSync(WWW)) fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(SITE, { recursive: true });

let n = 0;
for (const entree of fs.readdirSync(RACINE_DEPOT)) {
  n += copier(path.join(RACINE_DEPOT, entree), path.join(SITE, entree));
}
fs.writeFileSync(path.join(WWW, 'index.html'), RENVOI);

/* Verification franche plutot qu'un « ca devrait marcher » : si une de ces
   pieces manque, l'application se lancera sur un ecran mort et il vaut mieux
   le savoir ici que sur le terrain. */
const INDISPENSABLES = [
  'index.html', 'manifest.json', 'sw.js',
  'data/lexique.json',
  'lib/moteur.js', 'lib/mur.js', 'lib/capteurs.js',
  'banc/index.html', 'seance/index.html', 'mur/index.html',
  'enregistreur/index.html', 'bibliotheque/index.html',
  'reglages/index.html', 'manuel/index.html', 'contact-ia/index.html'
];
const manquants = INDISPENSABLES.filter(f => !fs.existsSync(path.join(SITE, f)));
if (manquants.length) {
  console.error('MANQUANT dans www/ghost-box/ : ' + manquants.join(', '));
  process.exit(1);
}

const version = (fs.readFileSync(path.join(SITE, 'sw.js'), 'utf8')
  .match(/const VERSION\s*=\s*'([^']+)'/) || [, '?'])[1];

console.log('www/ construit : ' + n + ' fichiers, site en ' + version);
