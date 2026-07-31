# Capteurs du téléphone et base de mots

Base de travail pour un dispositif de type « Ovilus » : des capteurs pilotent le tirage d'un mot dans un dictionnaire, en parallèle de la ghost box et de l'enregistreur.

---

## 1. À lire avant de coder

Un dispositif capteur → mot **fabrique** les mots. Le magnétomètre produit un nombre, ce nombre devient un index, l'index désigne une ligne du dictionnaire. Le vocabulaire vient de la table que nous écrivons aujourd'hui, la grammaire vient des gabarits, et le sens vient de la personne qui lit. Aucune de ces trois choses ne vient de l'environnement.

Ce n'est pas une raison de ne pas le construire — c'est une raison de le construire correctement. Trois décisions de conception changent tout :

1. **La table `emission` conserve la valeur brute et l'index calculé** de chaque mot. N'importe quelle sortie peut être reconstituée à la main plus tard. Sans ça, tu ne peux rien vérifier, pas même six mois après.
2. **Le mode `temoin`** produit des mots avec un générateur aléatoire à graine fixe, sans aucun capteur. En session à l'aveugle, tu ne sais pas lequel des deux tourne. Si tu ne fais pas la différence, tu viens d'apprendre quelque chose de réel sur ton montage.
3. **Le gabarit « mot seul » pèse 40 sur 100.** Les phrases complètes sont là mais volontairement rares : c'est l'enchaînement grammatical qui crée l'impression de dialogue, et il vient à 100 % de notre code.

---

## 2. Inventaire des capteurs

### Accessibles depuis une application web

| Capteur | API | iOS | Android | Ce qui le fait bouger sans mystère |
|---|---|---|---|---|
| Niveau sonore | `getUserMedia` + `AnalyserNode` | ✅ | ✅ | Respiration, vêtements, ventilation, circulation |
| Bandes de fréquence | FFT 2048 | ✅ | ✅ | Ronflement 50 Hz du secteur, alimentations |
| Ultrasons 15–20 kHz | bins hauts de la FFT | ✅ | ✅ | Détecteurs de mouvement, écrans |
| Accéléromètre | `DeviceMotionEvent` · `Accelerometer` | ✅¹ | ✅ | Ta main, tes pas, un camion dehors |
| Gyroscope | `rotationRate` · `Gyroscope` | ✅¹ | ✅ | Micro-tremblements, dérive thermique |
| Orientation | `DeviceOrientationEvent` | ✅¹ | ✅ | Rotation du poignet |
| Cap magnétique | `webkitCompassHeading` | ✅ | ✅ | Aimants de housse, ferraille, enceintes |
| **Magnétomètre 3 axes** | `Magnetometer` | ❌ | ✅² | Câble secteur, béton armé, ascenseur |
| Luminosité ambiante | `AmbientLightSensor` | ❌ | ⚠️³ | Ta main au-dessus du téléphone |
| Luminance caméra | `getUserMedia` + canvas | ✅ | ✅ | L'auto-exposition qui compense en boucle |
| Mouvement image | comparaison de trames | ✅ | ✅ | Bruit du capteur en basse lumière, poussière |
| Batterie | `Battery Status API` | ❌ | ✅ | Le froid, le GPS, l'écran allumé |
| Réseau | `Network Information API` | ❌ | ✅ | Encombrement de la cellule, murs |
| Position / précision | `Geolocation` | ✅ | ✅ | Multi-trajet en intérieur |
| NFC | `Web NFC` | ❌ | ✅ | Rien sans contact physique |
| Pression tactile | `PointerEvent.pressure` | ✅ | ✅ | Ton doigt — **à ne jamais brancher sur un mapping** |

¹ iOS exige `DeviceMotionEvent.requestPermission()` déclenché par un geste de l'utilisateur.
² Chrome Android uniquement, HTTPS + permission `magnetometer`. Safari n'expose pas la Generic Sensor API.
³ Derrière un flag Chrome. Utiliser la luminance caméra à la place.

### Applications natives uniquement

| Capteur | Plateforme | Remarque |
|---|---|---|
| Pression atmosphérique | `TYPE_PRESSURE` · `CMAltimeter` | Très sensible — détecte une porte qui claque ailleurs dans le bâtiment |
| Température ambiante | Android | Rare sur le matériel récent |
| Température batterie | Android | Mesure ton téléphone, pas la pièce |
| Humidité relative | Android | Quasi disparue |
| Puissance Wi-Fi / Bluetooth | Android | Bloquée au web pour raisons de vie privée |
| Carte de profondeur | LiDAR iPhone Pro · ARCore | Base des caméras « SLS » |
| Podomètre, détection de mouvement | les deux | À exclure des mappings : tu contrôlerais la sortie |

### Trois pièges connus

- **Le magnétomètre n'est pas un détecteur EMF.** Il lit le champ magnétique statique en microteslas. Un vrai détecteur mesure les champs alternatifs d'un réseau électrique. Ce sont deux grandeurs différentes.
- **Le micro coupe sous ~50 Hz.** Les infrasons, souvent invoqués, ne sont pas captables par un téléphone.
- **Les caméras SLS utilisent un modèle de détection de posture humaine.** Il est entraîné à trouver des corps, donc il en trouve — sur un portemanteau, un rideau, un radiateur.

### Les cinq qui valent le coup pour ton montage

Niveau sonore et bandes audio (tu les as déjà), magnétomètre si tu es sur Android, mouvement image caméra, et pression atmosphérique si tu passes en natif. Le reste est soit indisponible, soit trop bruité pour signifier quoi que ce soit.

---

## 3. La base de mots

**567 mots français**, index 0 à 566, dans `lexique.csv` / `lexique.json` / `seed-lexique.sql`.

| Classe (`pos`) | Nombre | Exemples |
|---|---|---|
| `NOM` | 138 | maison, lumière, peur, souffle |
| `VERBE` | 84 | attendre, cacher, brûler, prier |
| `LIEU` | 53 | cave, grenier, cimetière, puits |
| `VERBE3` | 49 | est, vient, entend, meurt |
| `ADJ` | 46 | froid, seul, cassé, profond |
| `PRENOM` | 40 | Marguerite, Émile, Suzanne, Gustave |
| `TEMPS` | 37 | minuit, hier, toujours, autrefois |
| `IMPER` | 22 | écoute, va-t'en, aide-moi, arrête |
| `NOMBRE` | 21 | un à vingt, cent, mille |
| `PREP` | 20 | avec, sans, contre, sous |
| `ADV` | 17 | ici, derrière, dessous, partout |
| `REPONSE` | 16 | oui, non, peut-être, rien |
| `PRON` | 15 | je, tu, elle, quelqu'un |
| `INTER` | 9 | qui, quand, pourquoi, combien |

Les prénoms sont ceux de l'état civil français d'avant 1950 : ce sont eux qui « fonctionnent » dans ce genre de dispositif, pour une raison qui n'a rien de mystérieux.

Le champ `poids` (1 à 3) fait sortir plus souvent les mots courts et fonctionnels — sinon la sortie est saturée de noms rares et sonne artificielle.

### Gabarits

| Gabarit | Poids |
|---|---|
| `{MOT}` | 40 |
| `{PRON} {VERBE3}` | 12 |
| `{IMPER}` | 10 |
| `{NOM} {ADJ}` | 8 |
| `{PRON} {VERBE3} {LIEU}` | 6 |
| `{INTER}` · `{ADV}` · `{PRENOM}` | 6 chacun |
| `{NOMBRE}` | 4 |
| `{PRON} {VERBE3} {NOM}` | 2 |

---

## 4. Chaîne capteur → mot

```js
// 1. lecture           valeur brute du capteur
// 2. normalisation     norm = (val - plage_min) / (plage_max - plage_min), borné 0..1
// 3. déclenchement     mode 'delta' : n'émettre que si |val - précédente| > seuil_delta
//                      mode 'direct': émettre à chaque cadence_ms
//                      mode 'temoin': ignorer le capteur, PRNG à graine fixe
// 4. index             idx = Math.floor(norm * N_lexique)   // N = 567
// 5. filtre            si pos_filtre : chercher le mot le plus proche de cette classe
// 6. gabarit           tirage pondéré, chaque balise puise dans sa classe
// 7. journal           INSERT emission (valeur_brute, index_calcule, mapping_id, …)
```

Trois règles à ne pas contourner :

- **`cadence_ms` est un plancher.** En dessous de ~1,2 s le dispositif bavarde et devient inexploitable.
- **Ne jamais rejeter un mot parce qu'il « ne colle pas ».** Ce filtre-là, c'est toi, et il fabrique la conversation à lui seul.
- **`valeur_brute` et `index_calcule` sont obligatoires** à l'insertion. Une émission sans trace ne vaut rien.

---

## 5. Protocole de contrôle

Fais tourner une séance sur deux en mode témoin, sans savoir laquelle. À la relecture, la vue `v_controle` compare les deux répartitions. Note tes impressions avant d'ouvrir la table.

Si les sorties « réelles » ne se distinguent pas des sorties témoin, ton mapping ne transmet rien du lieu — et il vaut mieux le savoir avant d'avoir bâti des conclusions dessus. Si elles s'en distinguent nettement, tu as un résultat concret à examiner : il faudra d'abord chercher quel objet du lieu fait bouger le capteur.

---

## 6. Ordre de chargement

```bash
psql $DATABASE_URL -f schema-postgres.sql   # ou schema-mysql.sql
psql $DATABASE_URL -f seed-capteurs.sql
psql $DATABASE_URL -f seed-lexique.sql
```

Sur Supabase, coller les trois fichiers dans le SQL Editor dans cet ordre. `lexique.json` sert à embarquer le dictionnaire côté front pour un fonctionnement hors ligne : la base garde les sessions, le téléphone garde les mots.
