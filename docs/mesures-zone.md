# Mesures — voie « Changement localisé » (lib/zone.js), v49

Harnais Node : `lib/zone.js` + `lib/moteur.js` chargés **tels quels** (les
fichiers livrés, pas une réécriture), images synthétiques 64×48 — scène en
dégradé + bruit capteur gaussien σ = 2,5 niveaux, 10 relevés/s. Chaque séance :
60 s d'apprentissage, 60 s de stabilisation, puis veille. Émission = seuil auto
du moteur tenu 4 relevés ; « photo » = seuil tenu 2 relevés, anti-rafale 12 s.

## Pourquoi cette voie existe

Constat de terrain (simulation avec un tiers, août 2026) : une petite tache
lumineuse passée devant la caméra posée, puis une brume légère — **rien
détecté**. Mécanique, pas accidentel :

- « Mouvement d'image » : moyenne sur toute l'image → une tache de quelques
  pixels pèse ~0,1 %, sous le bruit du capteur.
- « Forme caméra » : seuil pixel de 24 niveaux → un voile de 10 niveaux est
  invisible par construction.
- Caméra posée, scène immobile : ces voies sont plates à l'apprentissage → la
  règle du capteur plat (3bis) refuse de les armer. Le mode où l'on pose le
  téléphone était celui où la caméra ne pouvait rien dire.

La voie zone moyenne par blocs de 8×8 (le bruit tombe à σ/8 ≈ 0,3 niveau) et
soustrait la médiane des écarts de blocs (l'exposition automatique et la lampe
touchent tous les blocs ensemble : le global se retranche lui-même). Le bruit
résiduel n'est jamais nul → la voie **s'arme toujours**, y compris sur une
scène immobile.

## Résultats

| Épreuve | Résultat |
|---|---|
| A. Bruit pur, 12 × 30 min = 6 h (12 graines) | armée 12/12 · **0 mot** · **0 photo** |
| B. Orbe +60 niveaux, rayon 2 px, traversée 0,8 s | photo **50/50** · mot **50/50** |
| B. — traversée 0,3 s | photo **50/50** · mot 49/50 |
| B. — traversée 2,0 s | photo **50/50** · mot **50/50** |
| C. Brume 12 niv sur 35 % de l'image, 10 s | photo **50/50** · mot **50/50** |
| C. — 8 niv sur 30 % | photo **50/50** · mot **50/50** |
| C. — 20 niv sur 45 % | photo **50/50** · mot **50/50** |
| D. Saut global ±25 niveaux (lampe, exposition) | déclenché **0/50** |
| D2. Exposition qui « chasse » ±8 niv à 0,5 Hz, 15 min | déclenché **0/20** |

Aucun seuil du moteur n'a été touché : plancher 6,5 σ, témoin 16×, persistance
4 relevés pour un mot. La seule différence de régime : une **photo** part dès
2 relevés au-dessus du seuil (~200 ms) — une tache furtive ne dure pas les
400 ms qu'exige un mot, mais elle laisse sa preuve. Vérifié ci-dessus que ce
régime ne produit **aucune** photo sur 6 h de bruit.

## Limites, dites en clair

- Un voile qui couvre **plus de la moitié** de l'image devient « global » et
  s'efface dans la médiane — c'est alors la voie Luminance qui le porte.
- Le fond de blocs s'apprend avec une constante de temps de 8 s (en SECONDES,
  pas en images : les pages lisent la caméra de 11 à 60 im/s). Un changement
  plus lent que ~30 s est absorbé sans bruit — c'est un éclairage qui évolue,
  pas un passage.
- Torche, changement d'objectif, caméra rouverte : `raz()` + relance de la
  voie moteur, sinon on comparerait le présent à un lieu qui n'existe plus.

Ne pas modifier lib/zone.js sans refaire ces mesures (harnais : simulation
hors dépôt, voir la fiche de livraison v49).

## Témoin de pose (`bouge`), veilleur et veto — mesures v50

Même harnais, scène STRUCTURÉE (rectangles ±35 niveaux plus larges que les
blocs + texture fine ±10 + bruit capteur σ=2,5) — une texture fine seule est
un cas pathologique qui efface le déplacement dans les moyennes de blocs.

| Épreuve | Résultat |
|---|---|
| `bouge` caméra posée, 60 s (10 et 30 im/s) | max **0,33–0,34** |
| `bouge` panoramique 2 px/s | max 2,1 |
| `bouge` marche 12 px/s | min **2,4** – max 8,1 |
| Veilleur : marche 60→150 s | bascule à 60,8 s, retour à 153,2 s |
| Veilleur : saut d'éclairage ±25 niveaux | bascule ~2,5 s puis retour (→ réapprentissage, voulu) |
| Trépied déplacé 6 s en pleine veille, SANS garde | mot sorti **20/20** (la course : mot 400 ms < témoin 700 ms) |
| — avec garde état + VETO à l'émission (image seule) | **0/20** |
| — avec accéléromètre simulé | **0/20** |
| Caméraman 10 min (2 marches, 2 pauses), sans anomalie | **0/20** faux mot |
| — brume 12 niveaux pendant une pause | détectée **20/20** |

Seuils d'ÉTAT (pas d'émission) : haut 1,2 / bas 0,5 niveau, tenir 700 ms,
calme 2 s ; accéléromètre 0,7 m/s² (enveloppe). Le veto ne peut pas coûter
une vraie détection : la médiane des blocs est insensible à une anomalie
locale — seule l'image qui bouge EN BLOC (caméra, éclairage) le déclenche.
