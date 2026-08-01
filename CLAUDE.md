# Ghost Box — mémoire du projet

Ce fichier existe pour qu'une session Claude repartant de zéro comprenne le projet **et surtout ses principes** avant de toucher au code. À lire en premier.

## Ce que c'est

Application web (HTML/CSS/JS pur, sans dépendance ni build) pour séances de ghost box, publiée par GitHub Pages sur `architechfr.github.io/ghost-box`. Tout tourne dans le navigateur du téléphone.

Cinq outils, un par moment de séance :

| Dossier | Rôle |
|---|---|
| `realisateur/` | Mode tournage en déplacement : image composée (vidéo + incrustations + squelette) enregistrée avec le micro, choix de l'objectif, journal |
| `vision/` | Caméras : objectifs, bascule, enregistrement vidéo, bibliothèque IndexedDB, détection de mouvement + témoin |
| `banc/` | Séance capteurs : veille silencieuse, moteur capteur → mot, coïncidence, mode à l'aveugle, trace |
| `enregistreur/` | Écoute : micro brut, spectrogramme, marqueurs, export WAV |
| `lib/pose.js` | Détection de personne partagée (MediaPipe, plusieurs personnes), utilisée par les quatre modes caméra |
| `lib/capture.js` | Boutons flottants photo ○ / vidéo ● — capture à tout instant, suivent le plein écran |
| `lib/wakelock.js` | Empêche la mise en veille tant qu'une caméra tourne (repli vidéo si l'API manque) |
| `lib/media.js` | Traduction en clair des erreurs caméra/micro |
| `lib/fullscreen.js` | Bouton plein écran présent sur toutes les pages |
| `contact-ia/` | Expérimental : transcription Voxtral (clé Mistral, sort de l'appareil) + silhouette IA MediaPipe |

## Les principes — ne pas les enfreindre

Ce projet a une exigence de sincérité qui prime sur toute fonctionnalité. Un dispositif capteur → mot fabrique les mots qu'il affiche ; le rôle de l'application est de **ne jamais faire croire plus que ce qu'elle mesure**.

1. **Zéro faux positif.** « Un mot ne doit jamais sortir pour rien. S'il n'y a rien, c'est ainsi. » La plupart des séances doivent produire **zéro mot**, et l'interface le présente comme le résultat normal.
2. **Jamais de quota de fréquence.** Un réglage « au plus N mots par heure » a été explicitement rejeté comme malhonnête : ce n'est pas un critère de détection, et ça garantit qu'un faux positif finit par passer sous couvert d'un plafond d'apparence sérieuse. **La fréquence est un résultat, pas un paramètre.** Seul subsiste un anti-rafale d'une minute, justifié physiquement (un même événement ne produit qu'un mot).
3. **Pas de seuil théorique.** « 3 σ » est un mensonge sur un capteur réel (bruit à queues lourdes, mesures corrélées). Le seuil est **auto-calibré** : ancré sur le pire pic observé pendant l'apprentissage, puis **relevé de 15 %** chaque fois qu'un témoin de bruit (bootstrap par blocs du bruit réel enregistré) aurait suffi à déclencher un mot.
4. **Un témoin partout.** Mode à l'aveugle pour les capteurs, témoin visuel pour la caméra (même détecteur sur une image mélangée), témoin de bruit pour le seuil. Sans chiffre de comparaison, une détection ne prouve rien.
5. **Jamais de forme inventée.** La caméra encadre factuellement ce qui bouge (rectangle + pourcentage). Pas de silhouette dessinée à partir d'une boîte. Le squelette n'apparaît que si le modèle détecte réellement une personne (≥ 8 points fiables).
6bis. **La détection visuelle est réglée SÉVÈRE, volontairement.** Laissé à ses valeurs par défaut, MediaPipe plaque un squelette sur un fauteuil ou un rideau. Sont donc imposés : seuils du modèle à 0,80 / 0,80 / 0,70, 14 points fiables sur 33, confiance moyenne 0,62, plausibilité géométrique (plus haut que large, ≥ 14 % de la hauteur d'image) et surtout une **persistance de 5 images consécutives** — une détection d'un éclair est du bruit. Vérifié par simulation : fauteuil, forme écrasée, silhouette minuscule et détection fugace sont tous rejetés ; une vraie personne passe. Ne pas relâcher ces seuils sans refaire ces tests.
6. **La détection de personne est disponible dans TOUS les modes caméra, et suit PLUSIEURS personnes** — deux règles posées explicitement. Jusqu'à 4 personnes simultanées (`MAX_PEOPLE`), chacune avec sa couleur et son numéro, triées de gauche à droite. Implémentation unique dans `lib/pose.js`, importée dynamiquement par `banc/`, `vision/`, `realisateur/` et `contact-ia/`. Ne jamais la redupliquer dans une page ni revenir à une seule personne : étendre le module.
7. **Tout est vérifiable.** Chaque émission conserve valeur brute, normale, écart, seuil et index — le calcul doit pouvoir être refait à la main depuis la trace exportée.
7bis. **L'écran ne doit jamais s'éteindre pendant une séance** — le verrou est pris dès qu'une caméra tourne et repris automatiquement au retour d'arrière-plan. Une veille interrompt caméra, enregistrement et détection.
7ter. **Tout élément flottant doit être déplaçable** et ne jamais recouvrir un bouton : la vue caméra du banc se déplace au doigt, sa position est mémorisée.
8. **Une capture doit être possible à tout instant** — bouton flottant, jamais un bouton qu'il faut aller chercher en faisant défiler la page. Une observation ne prévient pas.
9. **L'IA ne fabrique pas de sens.** Elle ne relie jamais les mots en phrases. La transcription est marquée « non vérifiée » car ces modèles inventent des mots sur du bruit.

## Architecture — pourquoi elle est ainsi

**Un `index.html` par dossier est voulu**, pas une duplication : c'est la convention des sites statiques, qui donne des URL propres (`/vision/` plutôt que `/vision.html`). GitHub Pages s'appuie dessus. Ne pas « fusionner les index ».

**Ce qui est commun vit dans `lib/`**, jamais recopié dans une page : détection de personne, capture, plein écran, veille écran, messages d'erreur média. Toute logique utilisée par deux pages ou plus doit y être extraite.

**Une donnée n'a qu'une source de vérité.** Le lexique vit dans `data/lexique.json` (régénéré par `data/gen_lexique.py`) et est chargé par `fetch` — il était auparavant recopié en dur dans `banc/index.html` (26 Ko dupliqués), ce qui garantissait une divergence dès la première régénération. Ne jamais réembarquer une donnée déjà fichée.

## Contraintes techniques connues (ne pas re-promettre)

- **Deux caméras simultanées : possible sur l'appareil de terrain**, contrairement à la règle générale souvent citée. Vérifié en usage réel (« 2 flux actifs » dans Vision, avant + arrière). Le mode réalisateur ouvre donc deux vrais flux composés côte à côte et enregistrés ensemble. Ne jamais revenir à une alternance de flux : essayée, elle figeait l'image et donnait un écran noir.
- **`lib/pose.js` ne détecte QUE des humains.** MediaPipe PoseLandmarker est un modèle de pose humaine : un chien, un chat, un objet ne seront jamais détectés, quel que soit le réglage. Pour une « présence » au sens large (animal compris), il faudrait un modèle de détection d'objets (COCO-SSD). Ne jamais laisser croire que l'absence de squelette signifie « rien de vivant ».
- **Ne pas juger une personne sur la moyenne des 33 points** : assise ou partiellement cachée, la moitié de son corps est invisible et la moyenne s'effondre. Juger sur les points RÉELLEMENT vus + une structure de torse (au moins une épaule).
- **Toujours libérer caméra et micro sur `pagehide` ET sur `visibilitychange`** (page cachée, hors enregistrement). Sans ça, la caméra reste prise en changeant de mode et tous les autres modes affichent « déjà utilisée » — cause racine d'une panne constatée.
- Certains objectifs listés (macro, profondeur) ne s'ouvrent pas : c'est normal, l'erreur doit être expliquée à l'utilisateur, jamais silencieuse.
- Un téléphone **n'a pas de récepteur radio** : le micro enregistre le *son* de la box, pas les ondes.
- Pas de capteur de profondeur : la détection de personne est fragile dans le noir.
- La clé Mistral est stockée en `localStorage` de l'appareil, jamais dans le dépôt.

## Déploiement

Aucun build. Modifier les fichiers, commit, push sur `main` → GitHub Pages publie en 1-2 min.
Penser à **incrémenter le numéro de version** affiché en haut des pages modifiées (`v9`, etc.) : le cache mobile est agressif et c'est le seul moyen de vérifier qu'on teste bien la nouvelle version. Tester en navigation privée.

## Vérifier avant de livrer

Extraire le `<script>` et lancer `node --check`. Pour toute modification du moteur de détection, **simuler** sur du bruit autocorrélé à queues lourdes et vérifier qu'il reste silencieux.
