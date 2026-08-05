# ghost-box

Outils de séance pour ghost box : caméras et enregistrement vidéo, veille capteurs → mots, enregistreur audio avec analyse.

Tout fonctionne côté navigateur. Aucune donnée ne quitte l'appareil, aucune dépendance à installer.

**En ligne :** https://architechfr.github.io/ghost-box/

---

## Contenu

| Chemin | Rôle |
|---|---|
| `index.html` | Accueil + diagnostic des capteurs de l'appareil |
| `seance/` | Séance caméra : une ou plusieurs caméras composées dans une seule image, tous les objectifs, détection de personne sur chaque vue, mouvement encadré avec témoin, son de la box, incrustation optionnelle des informations dans la vidéo, mémoire tampon (récupère les secondes d'avant le geste), mur de mots, écran fixe. `realisateur/` et `vision/` redirigent ici : ils ont fusionné |
| `mur/` | Mur seul : tout le vocabulaire montré en colonnes défilantes, case de lecture, gel à l'instant d'une mesure. Le même mur est disponible dans `seance/` et `banc/` |
| `bibliotheque/` | Tout ce qui a été gardé, de n'importe quel mode : relecture avec le journal de séance, envoi vers les téléchargements du téléphone, suppression |
| `enregistreur/` | Écoute : micro sans traitement, spectrogramme, marqueurs, détection de pics, relecture (boucle, rognage, filtres), export WAV |
| `banc/` | Banc d'essai : capteurs en direct, moteur capteur → mot à seuil auto-calibré, coïncidence multi-capteurs, forme caméra avec témoin visuel, enregistrement audio de la box radio, mode témoin à l'aveugle, trace exportable |
| `contact-ia/` | **Redirection** vers l'accueil — rubrique retirée (voir CLAUDE.md 8nonies-000t) |
| `db/` | Schémas PostgreSQL/Supabase et MySQL, jeux de données de départ |
| `data/` | Lexique 567 mots (CSV, JSON) et le script qui le régénère |
| `docs/` | Inventaire détaillé des capteurs et de la chaîne capteur → mot |

---

## Mise en ligne (GitHub Pages)

Le micro et les capteurs exigent `https://`. Un fichier ouvert en local (`file://`) ne suffit pas sur téléphone.

1. Dépôt → **Settings** → **Pages**
2. Source : **Deploy from a branch**
3. Branche : `main`, dossier : `/ (root)` → **Save**

Sous une à deux minutes, les outils sont accessibles depuis iPhone et Android :

```
https://architechfr.github.io/ghost-box/
https://architechfr.github.io/ghost-box/enregistreur/
https://architechfr.github.io/ghost-box/banc/
```

Le dépôt étant public, ces pages le sont aussi. Elles ne contiennent aucune donnée de séance — les enregistrements et les traces restent sur le téléphone tant que tu ne les exportes pas toi-même.

---

## Base de données

À exécuter dans cet ordre, dans le SQL Editor Supabase ou via `psql` / `mysql` :

```
db/schema-postgres.sql     (ou db/schema-mysql.sql)
db/seed-capteurs.sql       24 capteurs documentés
db/seed-lexique.sql        567 mots + 10 gabarits
```

Tables principales : `lexique`, `gabarit`, `capteur`, `mapping`, `session`, `releve`, `emission`, `repere`.
La vue `v_controle` compare les émissions réelles et les émissions témoin d'une même séance.

Le CSV exporté par le banc d'essai a des colonnes alignées sur la table `emission`.

### Régénérer le lexique

```bash
python3 data/gen_lexique.py
```

Le script écrit le CSV, le JSON et les `INSERT`. Pour ajouter du vocabulaire, éditer le dictionnaire `BLOCS` en haut du fichier — les index se recalculent seuls.

---

## Capteurs disponibles

| | iOS / Safari | Android / Chrome |
|---|---|---|
| Micro, caméra, mouvement, orientation, cap boussole, position | ✅ | ✅ |
| Perturbation magnétique (cap boussole), batterie, réseau, NFC | ✅ / partiel | ✅ |
| Magnétomètre, lumière ambiante | ❌ | ⚠️ drapeau requis |

Safari n'implémente pas la Generic Sensor API. Sur Chrome Android, le magnétomètre et la lumière ambiante existent mais ne sont **pas activés par défaut** — il faut ouvrir `chrome://flags/#enable-generic-sensor-extra-classes`, passer sur *Enabled* et relancer Chrome.

Sans ce drapeau, le banc propose **Perturbation magnétique** : le cap boussole est calculé à partir du magnétomètre, et son instabilité mesurée téléphone immobile réagit aux mêmes causes. Ce n'est pas une valeur en microteslas, c'est un indicateur de variation — et il fonctionne partout sans réglage. La page d'accueil affiche le diagnostic de l'appareil en cours.

Inventaire complet des 24 capteurs, avec pour chacun l'API, la disponibilité et les sources de bruit connues : [`docs/capteurs-et-lexique.md`](docs/capteurs-et-lexique.md).

---

## Méthode

Un dispositif capteur → mot fabrique les mots qu'il affiche. Le vocabulaire vient du lexique, la grammaire des gabarits, le sens de la personne qui lit ; le capteur ne fournit qu'un nombre. Trois choix de conception en découlent :

- **Chaque émission conserve sa valeur brute et son index calculé.** N'importe quelle sortie peut être refaite à la main plus tard. C'est ce qui rend une séance vérifiable au lieu d'être seulement mémorable.
- **Le mode témoin** produit des mots avec un générateur aléatoire, sans aucun capteur. En mode à l'aveugle, le banc tire au sort à chaque lancement sans le dire. Si les deux ne se distinguent pas, le capteur n'apporte rien à ce montage — c'est un résultat, pas un échec.
- **Le gabarit « mot seul » pèse 40 sur 100.** Les phrases complètes existent mais restent rares : l'enchaînement grammatical, qui donne l'impression d'un dialogue, vient entièrement du code.

Même logique côté audio : la détection automatique de pics est indépendante des marqueurs manuels, pour que tu puisses comparer après coup ce que tu as entendu et ce que le signal contenait.

---

## Détection : le seuil se calibre contre le bruit réel

Le réglage de sensibilité en écarts-types a été **supprimé**, parce qu'il reposait sur un mensonge statistique. « 3 σ arrive une fois sur mille » suppose un bruit gaussien et des mesures indépendantes ; un capteur de téléphone n'a ni l'un ni l'autre. Le bruit audio a des **queues lourdes** (des pics gros et fréquents) et deux mesures consécutives sont **fortement corrélées** — d'où des écarts mesurés à 7 σ ou plus sur un simple fond sonore, et une exigence de « persistance » qui ne filtrait rien puisque les mesures se ressemblent d'un instant à l'autre.

À la place, l'appareil **mesure son propre bruit et se juge dessus** :

- **Seuil de départ ancré sur le pire pic observé.** À la fin de l'apprentissage, le seuil n'est pas choisi mais calculé : le plus grand écart réellement atteint pendant que rien ne se passait, majoré de 40 %.
- **Un témoin de bruit tourne en permanence.** Il rejoue, par blocs de trois secondes, le bruit réellement enregistré par l'appareil — mêmes pics, même corrélation, mais aucun événement, par construction. Il est testé quatre fois plus souvent que le signal réel.
- **Chaque fois que le témoin aurait fait sortir un mot, le seuil monte de 15 %.** C'est un faux positif certain, puisqu'il n'y avait rien à voir. Le seuil s'élève donc jusqu'à ce que le bruit de l'appareil ne puisse plus jamais le faire parler, et l'interface affiche ce seuil et le nombre de relevages.
- **Aucun quota, aucune sensibilité réglable.** Il n'existe pas de réglage « au plus N mots par heure » : un plafond de fréquence n'est pas un critère de détection, il garantit seulement qu'un faux positif finira par passer sous couvert d'un quota d'apparence sérieuse. La fréquence est un **résultat**, jamais un paramètre. Le seul délai conservé empêche qu'un **même événement physique** produise une rafale (une minute) — rien ne garantit qu'un mot sortira un jour. Rien ne peut sortir non plus pendant la première minute de veille.

Mesuré en simulation sur trois heures de bruit synthétique autocorrélé à queues lourdes, avec les protections complètes : **zéro mot** sur du bruit réaliste ou calme, **un seul** dans un cas volontairement extrême — là où le réglage précédent à 3 σ produisait plus de vingt mille déclenchements. Un écart franc et soutenu reste détecté et produit bien un mot.

Conséquence assumée : **la plupart des séances ne produiront aucun mot**. C'est le fonctionnement correct. Un appareil de ce type qui parle souvent est un appareil qui invente.

---

## Garde-fous complémentaires

Sous le seuil auto-calibré, trois mécanismes restent actifs :

- **Normale robuste** — la référence est apprise par **médiane + MAD**, insensible à un pic parasite survenu pendant l'apprentissage (là où une moyenne/écart-type se laisse tromper).
- **Persistance** — un écart doit **tenir plusieurs relevés d'affilée** (~400 ms) avant de produire un mot. Un pic isolé, la principale source de fausses alertes, est ignoré. C'est aussi ce qui distingue un vrai signal — corrélé dans le temps — d'un bruit sans structure.
- **Dérive** — quand tout est calme, la normale **suit lentement le fond** ; un changement durable devient la nouvelle référence, tandis qu'une vraie excursion, rapide, déclenche encore.

Le mode témoin et le mode à l'aveugle passent par exactement les mêmes garde-fous, seuil auto-calibré compris : la comparaison reste honnête. En mode à l'aveugle, le générateur ne produira quasiment jamais de mot — c'est justement ce qui rend le test tranchant.

**Tirage du mot.** Le mot n'est pas tiré à partir de *l'amplitude* de l'écart — cette méthode retombait toujours sur les mots du bout de la liste, puisqu'au moment du déclenchement l'écart est par construction grand. Il est désormais tiré par un **hachage** de la valeur brute (FNV-1a → position dans le lexique) : réparti sur les 567 mots, entièrement déterminé par la valeur enregistrée donc reproductible depuis la trace, avec une **anti-répétition** qui interdit les derniers mots sortis. Le champ `rehash` de la trace note le décalage éventuel appliqué par l'anti-répétition.

---

## Enregistrement et transcription (banc)

Le banc peut enregistrer le **son** de ta box radio via le micro, **indépendamment** de la veille capteurs. Trois usages : enregistrer seul, écouter les capteurs seuls, ou les deux en même temps — les deux partagent l'horloge de la séance, et l'export JSON note le décalage (`audio_offset_ms`) pour aligner les mots sur l'audio. L'enregistrement est converti en WAV 16 kHz mono, téléchargeable. Rappel important : le téléphone **ne reçoit pas les ondes radio** — il n'a pas de récepteur RF ; il enregistre l'onde *acoustique* qui sort du haut-parleur de la box.

La **transcription automatique** (Voxtral, modèle `voxtral-mini-latest` de Mistral) est optionnelle et repliée par défaut. Deux limites à connaître :

- Une transcription automatique **invente des mots** sur du bruit — c'est un défaut connu de ces modèles. Elle est affichée « non vérifiée » et doit être confirmée à l'oreille sur l'audio brut, jamais prise pour une parole avérée.
- Pour cette étape seulement, **l'audio est envoyé au serveur Mistral** : la promesse « rien ne quitte l'appareil » ne s'applique pas à la transcription. La clé API est saisie dans la page, gardée en mémoire, jamais enregistrée. Le site étant servi en statique (GitHub Pages), l'appel part directement du navigateur ; si l'API refuse l'appel navigateur (CORS), il faut un petit relais côté serveur (Cloudflare Worker, fonction Vercel) qui garde la clé.

---

## Caméra : forme, silhouette et témoin visuel

La caméra ne se limite plus à une luminance moyenne. Elle apprend l'image de fond de la pièce, la soustrait à chaque image, et cherche le **plus grand groupe de pixels connexes** qui a bougé — parce qu'une silhouette est *connexe*, là où le bruit d'un capteur dans le noir est *épars*. Cette « forme caméra » devient une source à part entière du moteur (taille, en % de l'image), soumise aux mêmes garde-fous que les autres capteurs. À chaque émission, l'**image du moment est capturée** et jointe à la trace : une preuve visuelle rejouable, pas une impression.

Le **témoin visuel** est l'équivalent du mode à l'aveugle pour la caméra. Le même détecteur tourne en parallèle sur une version **mélangée** de l'image (la structure spatiale est détruite, le bruit est conservé). Il compte combien de fois le détecteur « voit une forme » sur du pur bruit. Affiché en direct à côté du taux réel : si les deux se ressemblent, la caméra ne voit rien de plus que du hasard. Sans ce chiffre, une forme détectée dans une pièce sombre ne prouve rien.

En option, une **silhouette IA** (MediaPipe PoseLandmarker de Google) détecte un squelette humain. Le modèle tourne **sur le téléphone**, hors-ligne après un premier chargement (~5 Mo depuis un CDN). C'est **expérimental** et à traiter avec la même prudence que la transcription : un téléphone n'a pas de capteur de profondeur infrarouge comme un Kinect, donc dans le noir le modèle soit ne voit rien, soit accroche un reflet, un portrait ou l'opérateur. Ce n'est pas un détecteur de fantôme — c'est un capteur de plus, soumis au témoin et à la coïncidence.

---

## Coïncidence multi-capteurs

Au lieu d'un seul capteur par séance, le banc peut en surveiller **deux ou trois en même temps** et n'émettre un mot **que s'ils s'écartent tous ensemble** dans une fenêtre courte (~0,7 s). Chaque capteur garde sa propre normale robuste et sa propre persistance ; le mot final est dérivé de la **combinaison** de leurs positions, et la trace enregistre chaque contributeur. L'intérêt est statistique : le bruit n'est pas corrélé entre des capteurs physiquement distincts (magnétomètre, micro, caméra), alors qu'un vrai événement dans la pièce peut toucher plusieurs canaux à la fois. C'est le garde-fou le plus puissant contre les faux positifs — et en mode à l'aveugle, la coïncidence fortuite du générateur est quasi impossible, ce qui rend le test encore plus tranchant.

---

## Licence

MIT.


---

## Plusieurs caméras à la fois : ce qui est possible

Un téléphone expose souvent plusieurs objectifs (arrière, ultra grand-angle, avant), et le module Vision les détecte tous. En revanche, **Android et iOS n'autorisent pas deux flux caméra simultanés** : ouvrir le second coupe le premier. C'est une limite des plateformes, pas de l'application — la même page affiche bien plusieurs flux sur un ordinateur.

Vision en tient compte honnêtement : le bouton « Tenter tous les objectifs à la fois » ouvre réellement chaque objectif, puis **vérifie lequel est encore vivant** (un flux figé n'avance plus dans le temps), marque les flux coupés et affiche le verdict. Sur téléphone, la voie utile reste la **bascule instantanée** d'un objectif à l'autre.
