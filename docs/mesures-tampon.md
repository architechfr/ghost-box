# Mesures — mémoire tampon et images-clés (v51, règle 000ap)

Harnais : Chromium (Playwright), scène canvas 1280×720 à 30 i/s — fond dont la
teinte change chaque seconde (`hsl((s×47) % 360)`, la « vérité terrain » du
décodage), bruit épars (matière peu compressible, le cas réel d'une cave au
gain maximum), carré mobile. Options réelles de l'application
(`vp8,opus`, débit imposé 5,53 Mbps, tranche MediaRecorder 1 000 ms).
Les analyses de flux sont faites au payload VP8 (bit 0 du premier octet,
0 = image-clé) et contre-vérifiées par ffprobe (résultats identiques).

## 1. Cadence des images-clés d'un MediaRecorder

| Réglage | Images-clés observées |
|---|---|
| par défaut | t = 0,0 · 3,5 · 6,9 · 10,2 · 13,6 · 17,0 · 20,3 · 23,7 · 27,0 · 30,4 · 33,8 s — **une toutes les ~3,4 s (101 images)** |
| `videoKeyFrameIntervalDuration: 2000` | t = 0,0 · 2,0 · 4,0 · 6,1 · 8,1 · 10,2 · 12,1 · 14,2 · 16,2 · 18,2 s — **respecté, 2,0 s pile** |

Un codeur matériel de téléphone n'offre aucune garantie par défaut : certains
n'écrivent une clé qu'à la demande ou au changement de scène — sur une scène
statique de nuit, cela peut être JAMAIS après la première.

## 2. Le conteneur ment sur ses images-clés

Chrome écrit des BlockGroups SANS ReferenceBlock pour toutes les images, clés
ou delta. Un détecteur au niveau Matroska (« BlockGroup sans ReferenceBlock =
clé ») rend **45 clés sur 45 clusters** ; le payload VP8 en compte **11**.
Seul le payload fait foi.

## 3. Reproduction du défaut de terrain (ancien recollage)

Enregistrement de 35 s, assemblage façon ancien tampon (« premier morceau +
morceaux ≥ 25 s »), décodage dans Chromium :

- toutes les images décodées (t = 0,05 / 1 / 3 / 6 s) rendent **rgb(221,42,22)**
  — la teinte de t=0, portée par l'en-tête — au lieu des teintes filmées à
  25–31 s ; durée annoncée : Infinity ;
- c'est l'« écran noir » du terrain (une séance de nuit a un en-tête noir) et,
  quand le décodeur tente quand même les images delta, la « pixellisation ».

Le fichier de référence (flux complet, non recollé) rend les bonnes teintes
aux mêmes instants — le défaut est bien dans le recollage, pas dans le flux.

## 4. Vérification du correctif (code livré tel quel)

`lib/tampon.js` v51 chargé dans la page, tampon 5 s, déclenchement à 28,1 s,
arrêt à 33,1 s :

- point sûr retenu : l'image-clé de 20,3 s → **préroll annoncé 8 s** (réel,
  pas les 5 demandées) ;
- clusters du fichier : horodatages réécrits **0,00 → 12,37 s**, sans trou ;
- première image décodée à t=0,05 : la teinte de la seconde 20 — la bonne ;
  lecture continue s20 → s24 pendant que le curseur avance de 0,7 à 4,2 s ;
- ffprobe : image-clé à pts 0.000, 373 images lues, zéro erreur ;
- fichier du filet de secours (octets bruts, onGarde + onMorceau) : se décode
  aussi, première image correcte (il démarre sur l'horodatage d'origine —
  voulu : le filet reçoit les mêmes octets que le flux).

Analyseur EBML éprouvé sur le fichier complet découpé en tranches de
190 000 / 1 / 7 / 250 000 / 64 000 / 3 / 120 000 octets : 11 points sûrs
sur 11, positions identiques au balayage de référence.

## Deux pièges payés

1. Un balayage de TrackEntry à fenêtre fixe (300 octets) lisait les champs de
   la piste audio par-dessus ceux de la vidéo — les deux entrées se suivent à
   quelques octets. Borner le balayage à la TAILLE déclarée de l'entrée.
2. Tester un décodage en cherchant « la bonne couleur » exige des teintes non
   ambiguës : sur le cercle chromatique, la seconde 1 (47°) et la seconde 24
   (48°) sont indiscernables.
