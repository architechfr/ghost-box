# Bandeaux du menu — prompts de génération

Neuf images, une par carte de l'accueil. L'accueil est déjà prêt à les recevoir :
il suffit de déposer les fichiers dans `assets/menu/` avec le nom exact indiqué.
Tant qu'une image manque, la carte affiche une matière dégradée et reste
parfaitement présentable — on peut donc les ajouter une par une.

---

## Le principe, avant les prompts

Cette application refuse d'inventer. Une image de spectre, de silhouette dans la
brume ou d'orbe lumineux sur une carte de menu contredirait tout ce que le
moteur défend à l'intérieur — et le premier à ne plus y croire serait
l'utilisateur. **Les neuf images montrent donc l'INSTRUMENT et le LIEU, jamais
le phénomène.** Un téléphone posé sur une dalle, une lentille dans le noir, des
rayonnages d'archives. Le mystère vient de l'obscurité et de l'attente, pas d'un
fantôme dessiné.

C'est aussi ce qui les rendra crédibles : une photo d'appareil dans une cave est
vraie, une photo de fantôme est un aveu.

---

## Format

| | |
|---|---|
| Dimensions | **1024 × 430 px** (rapport 2,38:1) |
| Format final | **WebP**, qualité 78–82 |
| Poids visé | **≤ 90 Ko** par image (elles partent dans le cache hors ligne) |
| Dossier | `assets/menu/` |
| Cadrage | Le bas de l'image est recouvert par un fondu vers le noir : **ne rien mettre d'important dans le tiers inférieur** |
| Zone de sécurité | Le sujet dans les deux tiers supérieurs, décalé à gauche ou au centre |

Les quatre cartes d'« après la séance » (bibliothèque, écoute, réglages, mode
d'emploi) sont affichées plus basses (3,9:1) : elles seront **recadrées par le
milieu**, donc leur sujet doit être centré verticalement.

Si ton générateur ne sort pas en WebP, produis en PNG ou JPEG et convertis :
`cwebp -q 80 image.png -o simple.webp`

---

## Bloc de style — à coller dans CHAQUE prompt

C'est lui qui fait que les neuf images forment une famille et pas une
collection. Ne pas le modifier d'une image à l'autre.

```
STYLE: cinematic documentary photograph, extremely dark low-key lighting,
single practical light source, deep shadows filling 70% of the frame,
desaturated palette of near-black #0A0F12, slate grey-blue, and warm brass;
one accent of pale mint-green #5FD3A6 OR amber #E9B44C, never both dominant;
fine sensor grain, slight lens vignetting, shallow depth of field,
shot as if on a full-frame camera at f/1.8, ISO 3200, handheld;
horizontal composition 1024x430, subject in the upper two thirds,
bottom third empty and dark for a text overlay; no text, no lettering,
no watermark, no logo, no people visible.
```

## Ce qu'il faut interdire — à coller aussi

```
NEGATIVE: ghost, spirit, apparition, phantom, silhouette in mist, floating orb,
skull, demon, blood, gore, halloween, jump scare, cartoon, illustration, 3D render,
CGI, video game art, oversaturated colours, teal-and-orange grading, HDR,
lens flare, bokeh balls, text, letters, numbers, watermark, signature, faces,
hands in frame, cluttered composition, bright daylight, white background.
```

---

## Les neuf prompts

### 1 — `simple.webp` · Séance simple
*Un téléphone posé, seul, qui écoute. C'est tout le mode : un geste, puis
l'attente.*

```
A single modern smartphone lying face-up flat on a rough cold stone slab in a
pitch-dark cellar. Its screen is the only light source in the frame, glowing a
faint mint-green, casting a soft pool of light across the wet stone and picking
out the mortar lines. Dust motes drift in the screen glow. The room beyond
dissolves into total blackness within half a metre. Nothing else in the frame.
```
+ bloc STYLE + NEGATIVE

---

### 2 — `seance.webp` · Séance caméra
*Quatre regards à la fois. L'optique, pas l'image qu'elle produit.*

```
Extreme close-up of the multi-lens camera array on the back of a black
smartphone, held in near-total darkness. Three lenses fill the frame, their
coated glass catching a thin cold reflection; the metal ring around each lens
glints. A faint amber light source far behind and to the right rims the edge of
the phone body. Everything else is black. Macro detail on the lens coatings,
tiny specks of dust on the glass.
```
+ bloc STYLE + NEGATIVE

---

### 3 — `banc.webp` · Séance capteurs
*Ce que le mode fait vraiment : mesurer un lieu vide, longtemps.*

```
A smartphone standing upright in a small folding stand on the flagstone floor of
an empty stone chamber, seen from low down at floor level. The screen shows only
abstract faint green waveform lines, unreadable, out of focus. A long shallow
depth of field runs away into darkness behind it, suggesting a corridor. The
only other light is a cold blue-grey glow from a distant unseen opening. Utterly
still, unoccupied, patient.
```
+ bloc STYLE + NEGATIVE

---

### 4 — `mur.webp` · Le mur
*Le vocabulaire montré. Des colonnes de lumière qui tombent — sans jamais
écrire un mot lisible.*

```
Abstract close-up of a phone screen turned to face a dark room, photographed
slightly off-axis so the display fills the left two thirds of the frame. On it,
five vertical columns of small blurred glowing amber marks scroll downward,
motion-blurred into soft streaks, completely illegible. The light from the
screen falls onto a rough plastered wall on the right. Long exposure feel, the
streaks trailing.
```
+ bloc STYLE + NEGATIVE
*(Important : les marques doivent rester **illisibles** — filées, floues. Un mot
déchiffrable sur le bandeau serait un mot inventé par l'image.)*

---

### 5 — `planche.webp` · La planche
*Le seul bandeau qui a le droit d'être un objet ancien. Laiton sur ardoise.*

```
A dark slate-grey wooden spirit board lying on an old oak table, photographed at
a low raking angle so the surface catches the light. Only the top edge and the
first curve of engraved brass capital letters are visible, sharply lit by a
single candle just out of frame to the left; the warm flame light falls off fast
across the board. A heavy teardrop-shaped brass planchette with a round glass
lens rests on the board, its lens catching a small bright highlight. Aged brass,
worn varnish, fine wood grain. No hands.
```
+ bloc STYLE + NEGATIVE
*(Sur celle-ci, l'accent doit être **ambre**, pas vert.)*

---

### 6 — `bibliotheque.webp` · Bibliothèque *(cadrage centré, 3,9:1)*
*Ce qui a été gardé. Un fonds, pas un souvenir.*

```
Rows of identical grey archival storage boxes on deep metal shelving in a dark
records room, seen straight on. A single overhead strip light far to the left
throws a hard raking light across the box faces, leaving the right half of the
frame in near-blackness. The boxes are plain and unlabelled. Dust on the top
edges. Cold, orderly, silent.
```
+ bloc STYLE + NEGATIVE

---

### 7 — `enregistreur.webp` · Écoute *(cadrage centré, 3,9:1)*
*Le geste d'écouter : un micro tendu dans le vide.*

```
A small black lavalier microphone clipped to a thin boom, photographed in
extreme close-up against total darkness. A single cold light grazes the mesh
grille of the capsule, revealing its fine perforations; the cable curves away
into black. One tiny mint-green indicator light glows on the body of the
recorder just visible at the edge of the frame, deeply out of focus.
```
+ bloc STYLE + NEGATIVE

---

### 8 — `reglages.webp` · Réglages *(cadrage centré, 3,9:1)*
*Des commandes qu'on règle à la main, dans le noir.*

```
Macro photograph of three worn metal rotary knobs on the brushed aluminium
faceplate of an old field measurement instrument, lit from the side by a single
low warm light. Fine machined knurling on the knobs, faint scratches on the
panel, engraved tick marks around each dial but no readable text. The rest of
the panel falls into darkness.
```
+ bloc STYLE + NEGATIVE
*(Si le générateur insiste pour écrire du texte sur le panneau, ajouter :
`the panel is completely blank, no engraved words, no numbers`.)*

---

### 9 — `manuel.webp` · Mode d'emploi *(cadrage centré, 3,9:1)*
*Apprendre l'appareil avant de s'en servir.*

```
An open technical manual with thick yellowed paper lying on a dark workbench,
photographed at a steep angle so only the gutter and the inner edge of two pages
are sharp. The visible page carries a faint engraved-style line diagram of a
measuring device, no legible words. A single warm desk lamp lights the page from
the upper left; the bench beyond is black. Paper fibre texture, soft page curl.
```
+ bloc STYLE + NEGATIVE

---

## Après génération

1. Convertir en WebP et vérifier le poids (≤ 90 Ko).
2. Déposer dans `assets/menu/` avec le nom exact : `simple.webp`, `seance.webp`,
   `banc.webp`, `mur.webp`, `planche.webp`, `bibliotheque.webp`,
   `enregistreur.webp`, `reglages.webp`, `manuel.webp`.
3. Monter le numéro de version (`sw.js` **et** les `?v=` des pages) — sinon les
   téléphones qui ont déjà l'ancien cache ne verront jamais les images.
4. Ouvrir l'accueil et vérifier que le titre de chaque carte reste lisible sur
   son bandeau. Si une image est trop claire en bas, la reprendre plutôt que
   d'assombrir le fondu : le fondu est commun aux neuf.

Aucune image n'est obligatoire : celles qui manquent gardent leur matière.
