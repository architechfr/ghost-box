# Ghost Box — mémoire du projet

Ce fichier existe pour qu'une session Claude repartant de zéro comprenne le projet **et surtout ses principes** avant de toucher au code. À lire en premier.

## Ce que c'est

Application web (HTML/CSS/JS pur, sans dépendance ni build) pour séances de ghost box, publiée par GitHub Pages sur `architechfr.github.io/ghost-box`. Tout tourne dans le navigateur du téléphone.

Cinq outils, rangés par **moment de séance**, pas par technique :

| Dossier | Rôle |
|---|---|
| `seance/` | **Séance caméra** — une ou plusieurs caméras composées dans une seule image, détection de personne sur chaque vue, mouvement, son de la box, incrustation optionnelle des informations dans la vidéo, mémoire tampon, mur de mots, écran fixe |
| `banc/` | **Séance capteurs** — capteurs de l'appareil, seuil auto-calibré, coïncidence, mode à l'aveugle, trace, mur de mots |
| `mur/` | **Mur seul** — le mur sans caméra, micro comme capteur |
| `bibliotheque/` | Tout ce qui a été gardé, de n'importe quel mode : relecture avec journal, envoi vers le téléphone, suppression |
| `enregistreur/` | **Écoute** — micro brut, spectrogramme, marqueurs, export WAV, mur de mots sous le spectre, écran fixe « séance assise », sauvegarde continue |
| `contact-ia/` | Expérimental : transcription Voxtral (clé Mistral, sort de l'appareil) |
| `realisateur/`, `vision/` | **Redirections** vers `seance/` — ces deux modes ont fusionné. Ne pas y remettre de code : les raccourcis déjà posés sur l'écran d'accueil des téléphones pointent dessus |

Le code partagé, en un seul exemplaire :

| Fichier | Rôle |
|---|---|
| `lib/moteur.js` | Moteur de détection (statistique robuste, seuil auto, témoin de bruit) |
| `lib/mur.js` | Mur de mots (colonnes, case de lecture, gel, équité des vitesses) |
| `lib/secours.js` | **Filet de sécurité** : pendant une prise, chaque morceau est écrit tout de suite dans la base ; une prise interrompue se récupère au retour |
| `lib/tampon.js` | Mémoire tampon : encode en continu, ne garde que les N dernières secondes |
| `lib/pose.js` | Détection de personne (MediaPipe, plusieurs personnes) |
| `lib/capture.js` | Boutons flottants photo ○ / vidéo ● — capture à tout instant |
| `lib/wakelock.js` | Empêche la mise en veille tant qu'une caméra tourne |
| `lib/media.js` | Traduction en clair des erreurs caméra/micro |
| `lib/fullscreen.js` | Bouton plein écran présent sur toutes les pages |

## Les principes — ne pas les enfreindre

Ce projet a une exigence de sincérité qui prime sur toute fonctionnalité. Un dispositif capteur → mot fabrique les mots qu'il affiche ; le rôle de l'application est de **ne jamais faire croire plus que ce qu'elle mesure**.

1. **Zéro faux positif.** « Un mot ne doit jamais sortir pour rien. S'il n'y a rien, c'est ainsi. » La plupart des séances doivent produire **zéro mot**, et l'interface le présente comme le résultat normal.
2. **Jamais de quota de fréquence.** Un réglage « au plus N mots par heure » a été explicitement rejeté comme malhonnête : ce n'est pas un critère de détection, et ça garantit qu'un faux positif finit par passer sous couvert d'un plafond d'apparence sérieuse. **La fréquence est un résultat, pas un paramètre.** Seul subsiste un anti-rafale d'une minute, justifié physiquement (un même événement ne produit qu'un mot).
3. **Pas de seuil théorique.** « 3 σ » est un mensonge sur un capteur réel (bruit à queues lourdes, mesures corrélées). Le seuil est **auto-calibré** : ancré sur le pire pic observé pendant l'apprentissage (× 1,4), puis **relevé de 15 %** chaque fois qu'un témoin de bruit (bootstrap par blocs du bruit réel enregistré) aurait suffi à déclencher un mot. Deux chiffres sont **mesurés, pas choisis** : le plancher de **6,5 σ** et le témoin éprouvé **16× par mesure**. Sur 900 h de bruit simulé (trois générateurs : autocorrélé à queues lourdes, très corrélé, à bouffées), le réglage précédent (5 σ, témoin 4×) laissait encore sortir **74 mots** ; le réglage actuel en sort **zéro**, tout en détectant une excursion franche de 8 σ **100 fois sur 100**. Ne jamais baisser ces valeurs sans refaire cette simulation.
3bis. **Un capteur plat n'est jamais armé.** Micro coupé, capteur absent ou gelé : la valeur ne varie pas, le bruit est nul, et la moindre reprise vaudrait des milliers de σ — un mot sortirait instantanément pour rien. `seal()` refuse d'armer si la dispersion est nulle ou s'il y a moins de 4 valeurs différentes, et l'écran le dit. Le reste de l'outil continue de fonctionner : c'est l'émission qui se tait, pas l'appareil.
4. **Un témoin partout.** Mode à l'aveugle pour les capteurs, témoin visuel pour la caméra (même détecteur sur une image mélangée), témoin de bruit pour le seuil. Sans chiffre de comparaison, une détection ne prouve rien.
5. **Jamais de forme inventée.** La caméra encadre factuellement ce qui bouge (rectangle + pourcentage). Pas de silhouette dessinée à partir d'une boîte. Le squelette n'apparaît que si le modèle détecte réellement une personne (≥ 8 points fiables).
6bis. **La détection visuelle est réglée SÉVÈRE, volontairement.** Laissé à ses valeurs par défaut, MediaPipe plaque un squelette sur un fauteuil ou un rideau. Sont donc imposés : seuils du modèle à 0,80 / 0,80 / 0,70, 14 points fiables sur 33, confiance moyenne 0,62, plausibilité géométrique (plus haut que large, ≥ 14 % de la hauteur d'image) et surtout une **persistance de 5 images consécutives** — une détection d'un éclair est du bruit. Vérifié par simulation : fauteuil, forme écrasée, silhouette minuscule et détection fugace sont tous rejetés ; une vraie personne passe. Ne pas relâcher ces seuils sans refaire ces tests.
6. **La détection de personne est disponible dans TOUS les modes caméra, et suit PLUSIEURS personnes** — deux règles posées explicitement. Jusqu'à 4 personnes simultanées (`MAX_PEOPLE`), chacune avec sa couleur et son numéro, triées de gauche à droite. Implémentation unique dans `lib/pose.js`, importée dynamiquement par `seance/`, `banc/` et `contact-ia/`. Ne jamais la redupliquer dans une page ni revenir à une seule personne : étendre le module.
7. **Tout est vérifiable.** Chaque émission conserve valeur brute, normale, écart, seuil et index — le calcul doit pouvoir être refait à la main depuis la trace exportée.
7bis. **L'écran ne doit jamais s'éteindre pendant une séance** — le verrou est pris dès qu'une caméra tourne et repris automatiquement au retour d'arrière-plan. Une veille interrompt caméra, enregistrement et détection.
7ter. **Tout élément flottant doit être déplaçable** et ne jamais recouvrir un bouton : la vue caméra du banc se déplace au doigt, sa position est mémorisée.
8. **Une capture doit être possible à tout instant** — bouton flottant, jamais un bouton qu'il faut aller chercher en faisant défiler la page. Une observation ne prévient pas.
8bis. **Le mur de mots n'est pas un mode, c'est un affichage.** Seul, il ne sert à rien : il n'a de sens qu'à côté de ce qui mesure. Il est donc disponible **partout où quelque chose mesure — séance caméra, séance capteurs, Écoute**, comme composant partagé (`lib/mur.js`), et la page « Mur seul » n'est qu'un des trois endroits où on l'allume. Ne jamais en refaire une copie dans une page.
8bis-b. **Aucun mot n'est favorisé, et ça se mesure.** Si chaque colonne gardait sa vitesse, ce seraient toujours les mêmes mots qui passeraient en coup de vent. Les allures **tournent d'une colonne à l'autre toutes les 20 s** : chaque famille passe le même temps à chaque vitesse. Vérifié : sur 400 gels, les cinq colonnes sont retenues 76 à 84 fois chacune. Ne pas figer les vitesses.
8bis-c. **Montrer, plutôt que garder pour soi.** Le mur de mots existe parce qu'un lexique caché dans un fichier ne se propose à personne : les 567 mots défilent à l'écran, rangés par famille (réponses, personnes, lieux, actions, états), et une case de lecture les parcourt en continu. Quand une mesure dépasse le seuil, **le mur se fige à cet instant et le mot de la case est retenu — c'est l'instant qui désigne, rien d'autre**. Aucun tirage caché, et la trace conserve colonne, index, graine de session : le choix se refait à la main.
8ter. **Rien n'est écrit sans qu'on le demande — mais ce qui vient de se passer n'est pas perdu.** Un événement est déjà terminé quand on appuie sur le bouton. La mémoire tampon encode donc en permanence sans rien conserver : à chaque instant seules les N dernières secondes existent en mémoire vive, et tout ce qui est plus vieux est effacé au fur et à mesure — aucun fichier n'est créé tant que l'utilisateur n'a rien demandé. Au déclenchement, ces N secondes-là font partie du fichier. **Ne jamais transformer ça en enregistrement permanent qui remplit l'appareil** : c'est exactement ce que ce dispositif existe pour éviter.
8quater. **Un réglage ne doit pas se dérégler tout seul.** Un curseur (`input[type=range]`) posé au milieu d'une page se déplace quand le pouce fait défiler l'écran — l'utilisateur croit naviguer et modifie un paramètre. Pour un réglage à trois valeurs, des **boutons**. Partout où un curseur reste justifié, `touch-action:pan-y` pour que le défilement vertical lui passe au-dessus sans le toucher. Et tout réglage doit expliquer **ce qu'il change pour l'utilisateur**, pas ce qu'il fait techniquement.
8quinquies. **Ce qui a été enregistré ne se perd JAMAIS.** C'est arrivé en séance réelle : une prise en cours n'existait que dans la mémoire vive de la page, et une séance entière a disparu parce que l'application avait été fermée avant l'arrêt manuel. Sur cet outil, c'est la pire panne possible — ce qui a été vécu ne se refait pas. Désormais, **pendant toute prise, chaque morceau est écrit au fur et à mesure** dans la base de l'appareil (`lib/secours.js`) : arrêt normal → le fichier est assemblé et les morceaux effacés ; page fermée, mémoire reprise, écran mal éteint → au retour, la Bibliothèque propose de récupérer la prise, entière à la dernière seconde près. Vérifié en tuant la page en plein enregistrement, en son (WAV de 25,9 s récupéré et lisible) comme en vidéo (WebM 1280×720 récupéré et lisible, avec ses secondes d'avant le geste). **Ne jamais introduire un chemin d'enregistrement qui ne passe pas par ce filet**, et ne jamais faire d'un `pagehide` une raison de jeter des données.
8sexies. **Une veille silencieuse doit quand même parler d'elle.** Constaté sur le terrain : une séance capteurs a tourné **2 h 37** en affichant encore « 0 s » et « mesure du bruit normal, ne touche pas au téléphone » — l'écran était resté figé sur le message d'apprentissage, et rien ne disait depuis combien de temps ça tournait. Quand il ne se passe rien pendant des heures — le cas NORMAL — l'écran doit dire en permanence : **depuis quand** l'appareil veille (en clair : « 2 h 37 », pas « 157:11 »), combien de mots sont sortis, quel est le seuil courant, et que **zéro mot est le résultat attendu**. Un affichage figé fait croire à une panne, ou pire, fait rater une séance qui marchait.
9. **L'IA ne fabrique pas de sens.** Elle ne relie jamais les mots en phrases. La transcription est marquée « non vérifiée » car ces modèles inventent des mots sur du bruit.

## Architecture — pourquoi elle est ainsi

**Un `index.html` par dossier est voulu**, pas une duplication : c'est la convention des sites statiques, qui donne des URL propres (`/seance/` plutôt que `/seance.html`). GitHub Pages s'appuie dessus. Ne pas « fusionner les index ».

**Le menu est rangé par moment de séance, pas par technique.** Réalisateur et Vision étaient deux pages pour une même chose — filmer — et partageaient l'essentiel de leur code (objectifs, enregistrement, détection de personne, tampon, capture) ; elles obligeaient surtout à **choisir avant de savoir ce qu'on allait faire**. Elles ont fusionné en `seance/`, où la vraie différence est devenue un bouton : *incruster les informations dans la vidéo*, ou enregistrer l'image brute. La bibliothèque, qui reçoit les fichiers de tous les modes, est sortie en page à part — elle était cachée au fond de Vision alors qu'elle sert après la séance. Avant d'ajouter une page, se demander si ce n'est pas un **bouton** dans une page existante.

**Ce qui est commun vit dans `lib/`**, jamais recopié dans une page : **moteur de détection**, détection de personne, capture, plein écran, veille écran, messages d'erreur média. Toute logique utilisée par deux pages ou plus doit y être extraite. Le moteur a longtemps existé en deux exemplaires (banc + réalisateur) : ils avaient déjà divergé. Il vit maintenant dans `lib/moteur.js` et les pages n'en gardent que leur politique propre (quels capteurs, quelles fenêtres, quel affichage). **Ne jamais le recopier dans une page** — si le principe change, il doit changer partout à la fois.

**Un composant partagé ne doit rien devoir à la page qui l'accueille.** Le mur de mots a d'abord utilisé des noms de classes ordinaires (`.col`, `.strip`, `.cell`) : la page Écoute avait déjà une classe `.strip` en `display:flex`, qui a écrasé la sienne et réduit toutes les cases à une largeur nulle — un mur parfaitement vide à l'écran, sans la moindre erreur JavaScript. Depuis, **toutes les classes des modules visuels sont préfixées** (`gbm-col`, `gbm-strip`, `gbm-cell`…) et le module **impose lui-même** les propriétés dont il dépend (`display`, `padding`, `margin`, `flex`) au lieu de les hériter au hasard. Vérifier un module visuel en comptant les éléments réellement visibles à l'écran, pas seulement en comptant les nœuds du DOM : c'est ce qui avait manqué.

**Une donnée n'a qu'une source de vérité.** Le lexique vit dans `data/lexique.json` (régénéré par `data/gen_lexique.py`) et est chargé par `fetch` — il était auparavant recopié en dur dans `banc/index.html` (26 Ko dupliqués), ce qui garantissait une divergence dès la première régénération. Ne jamais réembarquer une donnée déjà fichée.

## Contraintes techniques connues (ne pas re-promettre)

- **Mode réalisateur = son de la box + deux caméras + écran fixe.** Le micro est ouvert brut (ni réduction de bruit, ni gain automatique, ni annulation d'écho, ni isolation de voix : ces traitements sont faits pour la voix et effaceraient le souffle du balayage) et ses pistes partent dans le même fichier que l'image composée. Avant chaque enregistrement, le micro est revérifié et rouvert s'il a été perdu ; le journal note « son de la box » ou « SANS SON ». En portrait, les deux vues sont **empilées** (chacune pleine largeur), en paysage côte à côte — deux vues côte à côte sur un téléphone debout donnaient deux images minuscules. Le bouton « Écran fixe » gèle la page : plus de défilement, plus de rebond, l'image occupe tout l'écran, seuls restent l'enregistrement et la capture.
- **Deux caméras simultanées : possible sur l'appareil de terrain**, contrairement à la règle générale souvent citée. Vérifié en usage réel (« 2 flux actifs » dans Vision, avant + arrière). Le mode réalisateur ouvre donc deux vrais flux composés côte à côte et enregistrés ensemble. Ne jamais revenir à une alternance de flux : essayée, elle figeait l'image et donnait un écran noir.
- **La mémoire tampon exige le WebM.** Recoller un en-tête et des morceaux ultérieurs ne marche qu'en WebM (`video/webm;codecs=vp8,opus`) : le premier morceau porte l'en-tête du fichier, les suivants sont des grappes indépendantes. En MP4 (iPhone) c'est impossible — `GBTampon.supporte()` renvoie false et l'écran l'explique au lieu de faire semblant. Vérifié : le fichier assemblé se relit, aux bonnes dimensions, image décodable. Corollaire : quand le tampon est en marche, **la taille du canvas ne doit pas changer** (rotation, passage à deux caméras) — le tampon est relancé et sa mémoire repart de zéro, ce qui est dit à l'écran.
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

**Et surtout : incrémenter aussi `?v=` sur les `lib/*.js`.** Les modules partagés sont chargés par une balise `<script src="/ghost-box/lib/xxx.js?v=N">`. Sans ce numéro, le navigateur garde l'ancien fichier en cache et **un correctif poussé sur le dépôt n'arrive jamais sur le terrain** — l'utilisateur voit toujours le bug, et on cherche la panne au mauvais endroit. Quand un fichier de `lib/` change, monter `?v=` **partout** (`sed -i 's/?v=4/?v=5/g' */index.html`). Le service worker, lui, est volontairement passif : il ne met rien en cache, c'est le cache HTTP ordinaire qui joue.

## Vérifier avant de livrer

Extraire le `<script>` et lancer `node --check`.

Pour toute modification du moteur de détection : **simuler**. Charger `lib/moteur.js` dans Node (`new Function('window', source)`), lui faire avaler des centaines d'heures de bruit autocorrélé à queues lourdes — plusieurs générateurs différents, pas un seul — et exiger **zéro mot**, puis vérifier qu'une excursion franche de 8 σ passe encore. Un moteur muet parce qu'il est sourd n'est pas un progrès.

Pour les pages caméra : Playwright + Chromium headless avec `--use-fake-device-for-media-stream` et `--use-fake-ui-for-media-stream` — on vérifie que la piste audio est bien dans le fichier enregistré (`clip.son`), que les deux caméras s'ouvrent, que l'écran fixe ne défile plus, et qu'aucune erreur de page ne remonte.
