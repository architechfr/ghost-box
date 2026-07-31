# ghost-box

Outils de séance pour ghost box : enregistreur audio avec analyse, et banc d'essai capteurs → mots.

Tout fonctionne côté navigateur. Aucune donnée ne quitte l'appareil, aucune dépendance à installer.

**En ligne :** https://architechfr.github.io/ghost-box/

---

## Contenu

| Chemin | Rôle |
|---|---|
| `index.html` | Accueil + diagnostic des capteurs de l'appareil |
| `enregistreur/` | Enregistreur : micro sans traitement, spectrogramme, marqueurs, détection de pics, relecture (boucle, rognage, filtres), export WAV |
| `banc/` | Banc d'essai : capteurs en direct, moteur capteur → mot (détection robuste), coïncidence multi-capteurs, forme + silhouette caméra avec témoin visuel, enregistrement audio de la box radio, transcription optionnelle, mode témoin, trace exportable avec preuve |
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

## Détection : limiter les faux positifs

Le moteur du banc ne se contente plus d'une moyenne et d'un écart-type calculés une fois. Quatre garde-fous réduisent les faux positifs :

- **Normale robuste** — la référence est apprise par **médiane + MAD**, insensible à un pic parasite survenu pendant l'apprentissage (là où une moyenne/écart-type se laisse tromper).
- **Persistance** — un écart doit **tenir plusieurs relevés d'affilée** (~400 ms) avant de produire un mot. Un pic isolé, la principale source de fausses alertes, est ignoré. C'est aussi ce qui distingue un vrai signal — corrélé dans le temps — d'un bruit sans structure.
- **Hystérésis** — après un mot, le moteur ne se ré-arme qu'une fois le signal **retombé** sous un seuil bas, pour éviter les rafales sur une même perturbation.
- **Dérive** — quand tout est calme, la normale **suit lentement le fond** ; un changement durable devient la nouvelle référence, tandis qu'une vraie excursion, rapide, déclenche encore.

Le mode témoin et le mode à l'aveugle passent par exactement les mêmes garde-fous : la comparaison reste honnête.

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
