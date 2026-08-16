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
