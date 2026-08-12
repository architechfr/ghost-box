# Android — dossier de reprise (v46, 12 août 2026)

Ce document remplace le dossier du 3 août, écrit pour la v14. Il dit **par où
reprendre** le chantier Android, dans quel ordre, et quelles décisions restent
à prendre. L'inventaire détaillé de ce qui existe est dans
`android-etat-des-lieux.md`.

## Ce qui a changé depuis le dossier du 3 août — et ce que ça simplifie

1. **Contact via IA a été retiré (v29).** Plus aucun envoi à Mistral, clé
   effacée des appareils par la page de redirection. Conséquence directe pour
   Play : la politique de confidentialité devient « rien ne quitte
   l'appareil » — avec une seule vérification restante, l'option « lettres
   entendues » de la planche (voir l'essai n° 1 ci-dessous). Le dossier v14
   prévoyait de justifier la transcription Voxtral dans le formulaire Sécurité
   des données : **ce travail a disparu.**
2. **`ACCESS_FINE_LOCATION` est déjà commentée** dans le manifeste. La
   décision « déclarer la localisation à Play » a disparu aussi ; reste la
   décision plus petite : retirer la voie GPS du code du banc, ou la laisser
   se dégrader proprement (elle sait dire pourquoi elle manque).
3. **Le site a grandi de la v14 à la v46** : deux modes entiers (`simple/`
   avec le témoin croisé, `planche/`), la détection de visage
   (`lib/visage.js`), la torche honnête (`lib/torche.js`), le tri du lexique
   (`lib/lexique.js`), l'acte de naissance, l'encodage vidéo maîtrisé.
   L'empaquetage n'a **rien à faire** pour les recevoir — `preparer.js`
   recopie le site tel qu'il est — mais le vérificateur devait les ouvrir :
   c'est fait depuis le 12 août (16 pages, alignées sur l'ENVELOPPE de
   `sw.js`).

## Reprendre, dans l'ordre

```bash
cd android-app
npm install          # une fois
npm run preparer     # reconstruit www/ depuis le site (v46)
npm run verifier     # 16 pages sous localhost, zéro erreur exigé
npm run sync         # recopie dans le projet Android
npm run ouvrir       # Android Studio
npm run apk          # APK de test
```

Sans PC : onglet **Actions → Application Android → Run workflow** sur GitHub —
APK téléchargeable depuis le téléphone. Le bit exécutable de `gradlew` est
remis par le workflow (il se perd en transitant par OneDrive).

## L'essai sur le vrai téléphone — la prochaine vraie étape

Tout le reste attend ses résultats. Installer l'APK de test et éprouver, dans
cet ordre :

1. **« Lettres entendues » (planche)** — la Web Speech API est absente des
   WebView Android : vérifier que l'option se déclare indisponible (le module
   sait le dire) et qu'aucun audio ne part. Si confirmé : la fiche Play écrit
   « rien ne quitte l'appareil » sans exception.
2. **`Magnetometer`** — la WebView, comme Chrome, ne l'expose sans doute pas :
   confirmer que la voie retombe sur la perturbation du cap, et décider alors
   d'écrire le greffon natif (`TYPE_MAGNETIC_FIELD`, trois axes en µT — la
   raison d'être du choix Capacitor).
3. **La torche** (`applyConstraints({advanced:[{torch:true}]})`) — et le
   réapprentissage des voies caméra qui va avec (`lib/torche.js`).
4. **Le témoin croisé** — `BarcodeDetector` (lecture des trois QR) existe dans
   Chrome Android, pas forcément dans la WebView ; le module le dit quand il
   manque. Vérifier aussi le WebRTC direct entre l'application et un téléphone
   resté sur le site web.
5. **La mémoire tampon** (WebM par morceaux) et **l'encodage imposé**
   (`videoBitsPerSecond`, dimensions sûres) — même moteur Chromium, mais les
   codeurs matériels du téléphone ont le dernier mot.
6. **Wake Lock, plein écran, caméras multiples** — les acquis de terrain du
   site doivent survivre à la WebView.

Consigner chaque résultat ici même : ce dossier est la mémoire du chantier.

## Décisions restées ouvertes

1. **Le modèle MediaPipe (~5 Mo)** vient du CDN à la première utilisation. Une
   application installée laisse attendre qu'elle marche sans réseau dès le
   premier lancement : l'embarquer dans `www/` (poids assumé) ou documenter le
   premier lancement en ligne. Le dossier v14 posait déjà la question ; elle
   n'est toujours pas tranchée.
2. **La voie GPS du banc** : retirer du code, ou laisser en dégradation propre
   avec la permission commentée. (La déclaration Play, elle, n'est plus un
   sujet.)
3. **Le greffon magnétomètre natif** — après l'essai n° 2.
4. **`webContentsDebuggingEnabled` est à `true`** dans `capacitor.config.json`
   — précieux pour les essais, à éteindre avant tout dépôt sur Play.
5. **`package.json` porte `"version": "14.0.0"`** — un numéro mort (la vraie
   version vient de `sw.js` via `build.gradle`), mais un numéro qui ment.
   À mettre à jour ou à figer en `0.0.0` avec un commentaire.

## Les invariants à ne pas perdre en route

- **Keystore** : jamais dans le dépôt ; le perdre interdit toute mise à jour
  Play pour toujours. Secrets GitHub : `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`,
  `KEY_ALIAS`, `KEY_PASSWORD`.
- **Une seule discipline de version** : `VERSION` dans `sw.js` — le gradle la
  lit, l'application l'affiche depuis ses propres balises. Ne jamais
  réintroduire un numéro saisi à la main.
- **Le vérificateur suit l'enveloppe** : toute page ajoutée à `ENVELOPPE` de
  `sw.js` entre dans `PAGES` de `verifier.js` et dans `INDISPENSABLES` de
  `preparer.js` dans le même geste — `simple/` et `planche/` ont manqué à
  l'appel plusieurs versions ; l'erreur ne se serait vue qu'en cave.
- **Rien ne se recopie à la main** dans `android-app/` : si un fichier du site
  doit changer pour Android, c'est que le principe « même code pour les deux »
  est en train de casser — s'arrêter et comprendre d'abord.
