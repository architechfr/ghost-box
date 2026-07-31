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
| `banc/` | Banc d'essai : 16 capteurs en direct, moteur capteur → mot, mode témoin, trace exportable |
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
| Magnétomètre, lumière ambiante, batterie, réseau, NFC | ❌ | ✅ |

Safari n'implémente pas la Generic Sensor API. Pour tout ce qui touche au champ magnétique, il faut un appareil Android. La page d'accueil affiche le diagnostic de l'appareil en cours.

Inventaire complet des 24 capteurs, avec pour chacun l'API, la disponibilité et les sources de bruit connues : [`docs/capteurs-et-lexique.md`](docs/capteurs-et-lexique.md).

---

## Méthode

Un dispositif capteur → mot fabrique les mots qu'il affiche. Le vocabulaire vient du lexique, la grammaire des gabarits, le sens de la personne qui lit ; le capteur ne fournit qu'un nombre. Trois choix de conception en découlent :

- **Chaque émission conserve sa valeur brute et son index calculé.** N'importe quelle sortie peut être refaite à la main plus tard. C'est ce qui rend une séance vérifiable au lieu d'être seulement mémorable.
- **Le mode témoin** produit des mots avec un générateur aléatoire, sans aucun capteur. En mode à l'aveugle, le banc tire au sort à chaque lancement sans le dire. Si les deux ne se distinguent pas, le capteur n'apporte rien à ce montage — c'est un résultat, pas un échec.
- **Le gabarit « mot seul » pèse 40 sur 100.** Les phrases complètes existent mais restent rares : l'enchaînement grammatical, qui donne l'impression d'un dialogue, vient entièrement du code.

Même logique côté audio : la détection automatique de pics est indépendante des marqueurs manuels, pour que tu puisses comparer après coup ce que tu as entendu et ce que le signal contenait.

---

## Licence

MIT.
