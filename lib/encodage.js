/* ═══════════════════════════════════════════════════════════════════════
   Encodage vidéo — trois défauts de terrain, et ce qu'on leur oppose.

   Retour de terrain : « la vidéo rencontre parfois des défauts d'affichage,
   pixel, et autres défauts d'encodage ». Sur une visite de château qui ne se
   rejoue pas, c'est le pire défaut possible. Trois causes trouvées, dont deux
   mesurées.

   ── 1. LE DÉBIT N'ÉTAIT JAMAIS IMPOSÉ (mesuré) ──
   `new MediaRecorder(flux, {mimeType})` sans `videoBitsPerSecond` laisse le
   navigateur choisir. Mesuré dans Chromium, canvas 1280×720 à 30 i/s rempli
   de BRUIT — c'est-à-dire le cas réel d'une cave filmée au ISO maximum :

       sans débit imposé ....... 3,04 Mbps
       videoBitsPerSecond 8 Mbps  10,16 Mbps
       videoBitsPerSecond 12 Mbps 11,14 Mbps

   Trois mégabits pour du bruit en 720p, c'est un tiers de ce qu'il faut : le
   codeur jette de l'information par blocs de 16 pixels, et ces blocs SONT les
   « pixels » constatés. Le bruit est le pire ennemi d'un codeur — il n'est pas
   compressible — et une séance de fantômes se filme justement dans le noir, au
   gain maximum. L'application demandait donc au codeur exactement ce qu'il
   sait le moins bien faire, avec le moins de moyens possible.

   ── 2. DES DIMENSIONS QUE LE MATÉRIEL N'AIME PAS ──
   Les codeurs matériels Android travaillent par macroblocs de 16 pixels. Une
   image dont la hauteur n'est pas un multiple de 16 est complétée ou rognée
   par le codeur, ce qui produit des bandes parasites en bas — et une image de
   dimension IMPAIRE est hors norme en 4:2:0. La composition produisait par
   exemple 1440×810 à quatre caméras : pair, mais 810 = 16 × 50,6.

   ── 3. UNE IMAGE COMPOSÉE QUI DÉPASSE LE CODEUR ──
   Trois caméras empilées en portrait donnaient un canvas de 1280×2160, soit
   10 800 macroblocs — au-delà des 8 192 du niveau 4.1 que beaucoup de codeurs
   matériels ne dépassent pas. Selon l'appareil : refus, ou image corrompue.
   On borne donc la surface totale à celle d'un 1920×1088.

   Ce module ne fait que ces trois calculs. Il ne touche à rien d'autre.
   ═══════════════════════════════════════════════════════════════════════ */
window.GBEncodage = (function(){
  "use strict";

  var CLE = 'gb-qualite';

  /* bits par pixel et par image. Le chiffre du milieu vient de la mesure
     ci-dessus : à 0,20 bpp un 720p à 30 i/s demande ~5,5 Mbps, ce qui tient
     le bruit sans faire des fichiers ingérables. */
  var NIVEAUX = {
    econome: { bpp:0.09, nom:'Économe',  plancher:2000000, plafond: 6000000 },
    terrain: { bpp:0.20, nom:'Terrain',  plancher:4000000, plafond:14000000 },
    maximum: { bpp:0.34, nom:'Maximum',  plancher:6000000, plafond:24000000 }
  };

  function niveau(v){
    if(v && NIVEAUX[v]){ try{ localStorage.setItem(CLE, v); }catch(e){} }
    var n; try{ n = localStorage.getItem(CLE); }catch(e){}
    return NIVEAUX[n] ? n : 'terrain';
  }
  function niveaux(){ return NIVEAUX; }

  /* Débit vidéo pour une image de w×h à fps images/s. */
  function debit(w, h, fps, quel){
    var N = NIVEAUX[quel || niveau()] || NIVEAUX.terrain;
    var b = Math.round(w * h * (fps || 30) * N.bpp);
    return Math.max(N.plancher, Math.min(N.plafond, b));
  }

  /* Mégaoctets par minute, pour que le choix soit fait en connaissance de
     cause : un débit ne veut rien dire, une carte pleine si. */
  function moParMinute(w, h, fps, quel){
    return Math.round((debit(w, h, fps, quel) + 128000) / 8 * 60 / 1048576);
  }

  /* Dimensions que le matériel accepte : multiples de 16, et surface bornée
     à celle d'un 1920×1088. On réduit en gardant le rapport, jamais en
     déformant — une image étirée serait un mensonge de plus. */
  var SURFACE_MAX = 1920 * 1088;
  function seize(x){ return Math.max(16, Math.round(x/16)*16); }
  function dimensionsSures(w, h){
    if(!(w > 0 && h > 0)) return { w:1280, h:720, reduit:false };
    var k = 1, s = w*h;
    if(s > SURFACE_MAX) k = Math.sqrt(SURFACE_MAX / s);
    var W = seize(w*k), H = seize(h*k);
    // le double arrondi peut repasser au-dessus : on redescend d'un cran
    while(W*H > SURFACE_MAX && W > 16 && H > 16){ W -= 16; H = seize(H * (W/(w*k))); }
    return { w:W, h:H, reduit: (W !== Math.round(w) || H !== Math.round(h)) };
  }

  /* Les options complètes à passer à MediaRecorder.

     La cadence des images-clés est imposée en même temps que le débit
     (000ap) : livré à lui-même, Chromium n'écrit une image complète que
     toutes les ~3,4 s (mesuré — 101 images), et un codeur matériel de
     téléphone peut faire bien pire. Or la mémoire tampon ne peut découper
     le flux QUE sur une image-clé : chaque seconde sans clé est une seconde
     d'avant-geste qu'on ne peut pas garantir au fichier, et de la mémoire
     qu'on ne peut pas rendre. Mesuré : avec 2000 ms demandées, Chromium
     livre une clé toutes les 2,0 s pile. Un navigateur qui ignore l'option
     l'ignore en silence et sans casse — le tampon sait s'en accommoder. */
  var CLE_MS = 2000;
  function options(mime, w, h, fps, quel){
    var o = {};
    if(mime) o.mimeType = mime;
    o.videoBitsPerSecond = debit(w, h, fps, quel);
    o.audioBitsPerSecond = 128000;
    o.videoKeyFrameIntervalDuration = CLE_MS;
    return o;
  }

  return { niveau:niveau, niveaux:niveaux, debit:debit, moParMinute:moParMinute,
           dimensionsSures:dimensionsSures, options:options, SURFACE_MAX:SURFACE_MAX };
})();
