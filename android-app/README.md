# Ghost Box — empaquetage Android

Ce dossier transforme le site du dépôt en application Android, avec
[Capacitor](https://capacitorjs.com). Il ne contient **aucune copie du site** :
le site du dépôt reste la seule source de vérité, et `scripts/preparer.js` le
recopie à chaque construction.

## Pourquoi Capacitor et pas une TWA

Une TWA (l'application Play ouvre le site réel dans Chrome) aurait demandé
moins de travail. Elle a été écartée pour une raison précise : l'interface
`Magnetometer` de la Generic Sensor API **n'est pas active par défaut dans
Chromium** — elle dépend du drapeau `enable-generic-sensor-extra-classes`.
C'est pourquoi `lib/capteurs.js` retombe aujourd'hui sur la perturbation du cap
boussole. En TWA, ce repli serait définitif : on tourne dans Chrome, on ne peut
rien y faire. Avec Capacitor, un greffon natif lisant
`SensorManager.TYPE_MAGNETIC_FIELD` peut rendre le champ magnétique réel — trois
axes en µT — au JavaScript de la page. Même chose pour `TYPE_LIGHT`.

Pour un poste de mesure d'anomalies, c'est la différence entre une voie de
capteur dégradée et une vraie voie de capteur.

Accessoirement : les fichiers sont embarqués dans l'application, donc aucune
dépendance au réseau ni à un nom de domaine, et pas de
`/.well-known/assetlinks.json` à héberger à la racine de `architechfr.github.io`.

## Pourquoi le site va dans `www/ghost-box/`

266 chemins absolus `/ghost-box/...` sont écrits en dur dans 26 fichiers (comptés en v46 — 164 dans 19 fichiers en v14, le chiffre grandit avec le site) ; la
constante `RACINE` de `sw.js` et le `scope` du `manifest.json` en font partie.
En gardant ce préfixe dans l'application, **tous ces chemins résolvent sans
qu'une seule ligne du site soit modifiée**. La version web et la version Android
restent exactement le même code — pas de fourche à maintenir, et la discipline
`VERSION` + `?v=N` continue de valoir pour les deux.

`www/index.html` n'existe que pour renvoyer vers `./ghost-box/` au démarrage.

## Ce qui est déjà réglé

- Permissions : caméra, micro, `MODIFY_AUDIO_SETTINGS` (sans elle Android impose
  sa réduction de bruit au micro, ce qui effacerait le souffle du balayage),
  vibration, réseau. **Le GPS est commenté** dans `AndroidManifest.xml` : à
  trancher, voir plus bas.
- Tout le matériel est déclaré `required="false"` : un téléphone sans
  magnétomètre peut installer l'application et se servir des autres voies.
- Icônes fabriquées depuis `assets/marque.png` et `assets/icone-512.png` par
  `scripts/icones.py`, jamais redessinées.
- Écran de lancement sombre (`#0A0F12`), sans le moindre blanc : un éclair blanc
  au lancement ruine l'adaptation de l'œil.
- Version tirée de `VERSION` dans `sw.js` — pas de numéro saisi à la main qui
  finirait par mentir.

## Commandes

```bash
npm install          # une fois
npm run preparer     # reconstruit www/ depuis le site du dépôt
npm run verifier     # ouvre les 16 pages sous localhost, exige zéro erreur
npm run sync         # preparer + recopie dans le projet Android
npm run ouvrir       # ouvre le projet dans Android Studio
npm run apk          # APK de test
npm run bundle       # bundle signé pour Play (nécessite le keystore)
npm run icones       # refait les icônes après une nouvelle planche de marque
```

`npm run verifier` est à lancer avant toute livraison : il sert `www/` sur
localhost, ouvre les seize pages de l'enveloppe hors-ligne avec Chromium
(la liste PAGES suit ENVELOPPE de sw.js — toute page ajoutée à l'une entre
dans l'autre), et échoue si une seule erreur
JavaScript ou une seule ressource manquante apparaît. Une ressource absente ne
se verrait sinon qu'en cave, hors réseau, au moment où on ne peut plus rien y
faire.

## Sans PC

Le workflow `.github/workflows/android.yml` construit l'APK sur GitHub :
onglet **Actions → Application Android → Run workflow**. L'APK se télécharge
depuis le téléphone, dans les artefacts de la construction.

## Keystore

**Ne jamais le mettre dans le dépôt.** Le perdre, lui ou son mot de passe,
interdit définitivement toute mise à jour de l'application sur Play : c'est la
seule panne de ce projet qui ne se répare pas.

Création :

```bash
keytool -genkey -v -keystore ghost-box.jks -keyalg RSA -keysize 4096 \
        -validity 10000 -alias ghostbox
```

Puis `android/keystore.properties` (ignoré par git) :

```properties
storeFile=/chemin/absolu/vers/ghost-box.jks
storePassword=...
keyAlias=ghostbox
keyPassword=...
```

Pour la construction sur GitHub, quatre secrets de dépôt : `KEYSTORE_BASE64`
(le `.jks` encodé en base64), `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`.

## Décisions restées ouvertes

1. **Le modèle MediaPipe** (~5 Mo) est chargé depuis `cdn.jsdelivr.net` à la
   première utilisation. Tant qu'il n'est pas embarqué, la détection de personne
   exige un premier lancement en ligne — c'est déjà le cas aujourd'hui sur le
   site, mais une application installée laisse attendre autre chose.
2. **La voie GPS.** `ACCESS_FINE_LOCATION` oblige à déclarer la localisation
   dans la fiche Play et le formulaire Sécurité des données, pour une voie de
   capteur dont l'apport est faible. La permission est commentée : la voie se
   dégrade proprement, `lib/capteurs.js` sait déjà dire pourquoi une voie
   manque. À retirer du code, ou à assumer.
3. **Le greffon magnétomètre natif** — à écrire une fois que l'essai sur le vrai
   téléphone aura confirmé que la WebView, comme Chrome, n'expose pas
   `Magnetometer`.
