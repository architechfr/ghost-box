#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════════════
# icones.py — fabrique les icones Android a partir de la marque du depot.
#
# POURQUOI un script plutot que des fichiers poses a la main :
# la marque sort d'une planche fournie par Florian, et la regle du projet est
# de la DECOUPER, jamais de la redessiner. Si une nouvelle planche arrive, on
# relance ce script au lieu de retoucher onze PNG un par un.
#
# POURQUOI l'icone adaptative separe fond et dessin :
# Android recadre l'icone en cercle, en carre arrondi ou en goutte selon le
# lanceur. Un PNG carre unique se fait rogner ses coins — le radar y perdrait
# ses arcs exterieurs. On donne donc le fond (#0A0F12, la couleur exacte de
# l'application) et le dessin (assets/marque.png, deja detoure) separement,
# le dessin tenant dans la zone sure de 72dp sur 108.
#
# Usage : python3 scripts/icones.py
# ═══════════════════════════════════════════════════════════════════════════

import os
import shutil
from PIL import Image, ImageDraw

ICI     = os.path.dirname(os.path.abspath(__file__))
DEPOT   = os.path.abspath(os.path.join(ICI, '..', '..'))
RES     = os.path.join(ICI, '..', 'android', 'app', 'src', 'main', 'res')
MARQUE  = os.path.join(DEPOT, 'assets', 'marque.png')
ICONE   = os.path.join(DEPOT, 'assets', 'icone-512.png')

FOND = (10, 15, 18, 255)          # #0A0F12 — fond des pages de l'application

# Densites Android : mdpi vaut 1x, tout le reste en decoule.
DENSITES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}

# Zone sure de l'icone adaptative : le dessin ne doit pas depasser 72dp sur
# une toile de 108dp, sinon un lanceur qui recadre serre lui coupe les bords.
TOILE_DP = 108
SUR_DP   = 72


def poser_au_centre(dessin, toile_px, part):
    """Dessin redimensionne a `part` de la toile, centre, fond transparent."""
    cible = int(toile_px * part)
    d = dessin.copy()
    d.thumbnail((cible, cible), Image.LANCZOS)
    out = Image.new('RGBA', (toile_px, toile_px), (0, 0, 0, 0))
    out.paste(d, ((toile_px - d.width) // 2, (toile_px - d.height) // 2), d)
    return out


def main():
    marque = Image.open(MARQUE).convert('RGBA').crop(
        Image.open(MARQUE).convert('RGBA').getbbox())
    icone = Image.open(ICONE).convert('RGBA')

    for nom, k in DENSITES.items():
        dossier = os.path.join(RES, 'mipmap-' + nom)
        os.makedirs(dossier, exist_ok=True)

        # Couche dessin de l'icone adaptative.
        toile = int(TOILE_DP * k)
        poser_au_centre(marque, toile, SUR_DP / TOILE_DP).save(
            os.path.join(dossier, 'ic_launcher_foreground.png'))

        # Icone heritee, pour les lanceurs anciens : l'icone deja composee du
        # depot convient telle quelle, elle a son carre arrondi.
        n = int(48 * k)
        icone.resize((n, n), Image.LANCZOS).save(
            os.path.join(dossier, 'ic_launcher.png'))

        # Variante ronde : meme dessin, fond plein, masque circulaire — sans
        # fond plein le cercle laisserait voir un damier aux bords.
        rond = Image.new('RGBA', (n, n), FOND)
        rond.paste(poser_au_centre(marque, n, 0.72), (0, 0),
                   poser_au_centre(marque, n, 0.72))
        masque = Image.new('L', (n * 4, n * 4), 0)
        ImageDraw.Draw(masque).ellipse((0, 0, n * 4 - 1, n * 4 - 1), fill=255)
        rond.putalpha(masque.resize((n, n), Image.LANCZOS))
        rond.save(os.path.join(dossier, 'ic_launcher_round.png'))

    # L'ecran de lancement devient un XML (couleur + dessin centre) : il n'a
    # plus besoin d'un PNG par densite ET par orientation, et surtout il ne
    # peut plus laisser passer un fond clair. Un eclair blanc au lancement
    # ruine l'adaptation de l'oeil, ce qui en seance de nuit compte.
    for d in os.listdir(RES):
        if d.startswith('drawable-port') or d.startswith('drawable-land'):
            shutil.rmtree(os.path.join(RES, d))
    splash_png = os.path.join(RES, 'drawable', 'splash.png')
    if os.path.exists(splash_png):
        os.remove(splash_png)

    with open(os.path.join(RES, 'drawable', 'splash.xml'), 'w') as f:
        f.write('''<?xml version="1.0" encoding="utf-8"?>
<!-- Ecran de lancement : fond de l'application, marque au centre.
     Aucun blanc, a aucun moment. -->
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/ic_launcher_background" />
    <item
        android:drawable="@mipmap/ic_launcher_foreground"
        android:gravity="center" />
</layer-list>
''')

    with open(os.path.join(RES, 'values', 'ic_launcher_background.xml'), 'w') as f:
        f.write('''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Couleur exacte du fond des pages de l'application. -->
    <color name="ic_launcher_background">#0A0F12</color>
</resources>
''')

    print('icones refaites depuis assets/marque.png et assets/icone-512.png')


if __name__ == '__main__':
    main()
