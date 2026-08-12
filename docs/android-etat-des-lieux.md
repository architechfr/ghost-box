# Android — état des lieux (v46, 12 août 2026)

Ce document remplace l'état des lieux du 3 août, qui décrivait la v14. Il dit
ce que l'empaquetage Android **est**, aujourd'hui, pièce par pièce ; le plan de
reprise et les décisions à prendre sont dans `dossier-reprise-android.md`.

## Le principe de l'empaquetage — inchangé, et il tient toujours

Le site du dépôt est la **seule source de vérité**. `android-app/` ne contient
aucune copie du site : `scripts/preparer.js` reconstruit `www/` à chaque
construction, en excluant ce qui ne sert pas sur le téléphone (`.git`, `docs/`,
`db/`, `android-app/` lui-même, `CLAUDE.md`, `README.md`, `LICENSE`,
`node_modules`, et les outils de fabrication du lexique — `data/` ne garde que
`lexique.json`).

Le site est posé sous `www/ghost-box/`, jamais à la racine de `www/` : **266
chemins absolus `/ghost-box/...` sont écrits en dur dans 26 fichiers** (164
dans 19 fichiers en v14 — le chiffre grandit avec le site), `RACINE` de `sw.js`
et le `scope` du `manifest.json` en font partie. En conservant le préfixe, tous
ces chemins résolvent sans qu'une seule ligne du site soit modifiée : la
version web et la version Android restent exactement le même code, et la
discipline `VERSION` + `?v=N` vaut pour les deux. `www/index.html` n'existe que
pour renvoyer vers `./ghost-box/` au démarrage, sans un pixel blanc.

Capacitor plutôt qu'une TWA, pour la même raison qu'en v14 : dans une TWA on
tourne dans Chrome et l'interface `Magnetometer` y reste derrière un drapeau —
le repli « perturbation du cap » de `lib/capteurs.js` serait définitif. Avec
Capacitor, un greffon natif lisant `SensorManager.TYPE_MAGNETIC_FIELD` peut
rendre au JavaScript un vrai champ magnétique trois axes en µT.

## Ce que le site est devenu entre la v14 et la v46

L'état des lieux du 3 août décrivait neuf pages et une rubrique Contact via IA.
Le site que `preparer.js` recopie aujourd'hui, c'est :

| Pièce | État v46 |
|---|---|
| `simple/` | **Séance simple** — un écran, un bouton, aucun réglage ; capture automatique ; détection silhouette + visage allumées par défaut ; héberge le **témoin croisé** (`lib/croise.js`, deux téléphones en WebRTC direct, trois QR) |
| `seance/` | Séance caméra — jusqu'à quatre vues composées, tampon, incrustation |
| `banc/` | Séance capteurs — trois modes, mode à l'aveugle, protocole questions |
| `mur/` | Le mur — tous les capteurs, instant simple / escalier |
| `planche/` | **La planche** — lettre désignée dans l'espace, épreuve de finesse des voies, garde d'entrée 180 s, ronde mécanique, loupe, lettres entendues (option) |
| `enregistreur/` | Écoute — spectrogramme, marqueurs, WAV, sauvegarde continue |
| `bibliotheque/` | Fichiers + fiches de séance, sélection multiple, relecture sur place |
| `reglages/` | QR de partage, vérification du hors-ligne, diagnostic, remise à neuf |
| `manuel/` + `manuel/viser/` + `manuel/naissance/` | 12 sections ; « viser un mot » se démontre ; le vrai moteur tourne sous les yeux |
| `contact-ia/` | **Redirection vers l'accueil** — rubrique retirée en v29 ; la page efface la clé Mistral au passage |
| `realisateur/`, `vision/` | Redirections vers `seance/` (raccourcis d'écran d'accueil) |

L'enveloppe hors-ligne de `sw.js` compte **33 modules versionnés** : 31 fichiers
`lib/*.js` — dont, absents du document du 3 août : `visage.js` (détection de
visage, distincte de la silhouette), `torche.js` (lampe honnête : les voies
caméra réapprennent), `lexique.js` (tri des mots porteurs : 519 mots offerts
sur 569), `croise.js`, `objectif.js`, `fixe.js`, `questions.js`, `planche.js`,
`lettres.js`, `version.js`, `encodage.js`, `recit.js`, `historique.js`,
`demarrage.js` — et 2 feuilles (`ambiance.css`, `fonts.css`), plus 16 polices
woff2 embarquées (dont Cinzel pour la planche), le lexique, la marque et les
neuf bandeaux du menu.

## Ce qui est réglé, vérifié dans les fichiers

- **Permissions** (`AndroidManifest.xml`, chacune justifiée en commentaire) :
  `INTERNET` (un seul usage restant : le modèle MediaPipe, une fois),
  `CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` (micro brut — sans elle
  Android impose sa réduction de bruit et efface le souffle du balayage),
  `VIBRATE`. **`ACCESS_FINE_LOCATION` est commentée** : la voie GPS du banc se
  dégrade proprement et `lib/capteurs.js` dit pourquoi elle manque.
- **Matériel** : tout en `required="false"` — un téléphone sans magnétomètre
  installe l'application et se sert des autres voies.
- **Version dérivée, jamais saisie** : `build.gradle` lit `VERSION` dans
  `sw.js` et s'arrête si elle est introuvable. `versionCode = version du site
  × 1000 + numéro de construction GitHub`, `versionName = 46.N`.
- **Icônes** découpées depuis `assets/marque.png` par `scripts/icones.py`,
  écran de lancement `#0A0F12` sans le moindre blanc.
- **Vérification avant livraison** : `npm run verifier` sert `www/` sur
  localhost et ouvre les **16 pages de l'enveloppe hors-ligne** — dont
  `simple/` et `planche/` depuis le 12 août : elles en ont été absentes
  plusieurs versions, une ressource cassée dans ces pages ne se serait vue
  qu'en cave. La liste `PAGES` suit `ENVELOPPE` de `sw.js` ; toute page ajoutée
  à l'une entre dans l'autre. `preparer.js` refuse de son côté de construire un
  `www/` où manquerait une pièce indispensable (dont `simple/index.html` et
  `planche/index.html`, ajoutés le même jour).
- **Construction sans PC** : `.github/workflows/android.yml` — APK de test à
  chaque poussée sur `main`, bundle signé sur demande explicite si les quatre
  secrets de signature sont là, keystore effacé du runner dans tous les cas.

## Confidentialité — ce que la fiche Play peut promettre

Depuis le retrait de Contact via IA (v29), **plus aucune donnée d'utilisateur
ne part vers un serveur** : pas de compte, pas de mesure d'audience, pas
d'envoi à Mistral — la clé d'API est même effacée des appareils au passage sur
l'ancienne page. Tout vit dans l'appareil (IndexedDB, `localStorage`). Les deux
seules choses qui touchent au réseau :

1. **Le modèle MediaPipe** (~5 Mo), téléchargé une fois depuis
   `cdn.jsdelivr.net` au premier usage de la détection de personne — un
   téléchargement entrant, aucune donnée n'en sort.
2. **« Lettres entendues »** (`lib/lettres.js`, option de la planche, coupée
   par défaut, jamais mémorisée allumée) : la reconnaissance vocale de Chrome
   envoie l'audio chez Google. C'est la seule sortie de données de tout le
   site — et la Web Speech API est **absente des WebView Android**, donc selon
   toute vraisemblance indisponible dans l'application. À confirmer sur le
   vrai téléphone : si c'est confirmé, la fiche Play peut écrire « rien ne
   quitte l'appareil » **sans exception**, et le module dira, comme prévu,
   pourquoi l'option manque.

Le formulaire Sécurité des données se remplit alors : aucune donnée collectée,
aucune donnée partagée, pas de localisation (permission commentée).

## Les chiffres qui se vérifient

`npm run preparer && npm run verifier` sur la v46 : 249 références de
ressources résolues sous `www/`, 16 pages ouvertes sans erreur JavaScript ni
ressource manquante, lexique présent (569 mots). Syntaxe de tous les JS :
`node --check`. Alignement `VERSION`/`?v=46` : 160 occurrences.

## Ce qui reste en suspens

Voir `dossier-reprise-android.md` — notamment : greffon magnétomètre natif,
modèle MediaPipe à embarquer ou non, voie GPS à retirer du code ou à assumer,
`webContentsDebuggingEnabled` à éteindre avant Play, service worker dans la
WebView (sans conséquence : les fichiers sont embarqués, le hors-ligne est
acquis par construction), et la liste des API à éprouver sur le vrai téléphone
(torche, `BarcodeDetector` du témoin croisé, Wake Lock, WebM du tampon).
