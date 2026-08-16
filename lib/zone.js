/* ═══════════════════════════════════════════════════════════════════════
   Changement localisé — la voie caméra qui voit ce que la moyenne noie.

   Retour de terrain (simulation avec un tiers, août 2026) : une petite tache
   lumineuse passe devant la caméra posée, une brume légère traverse le champ —
   et RIEN n'est repéré. Vérifié dans le code, et c'était mécanique :

   — « Mouvement d'image » moyenne le changement sur TOUTE l'image : une tache
     de quelques pixels, c'est ~0,1 % de l'image, noyé dans le bruit du capteur.
   — « Forme caméra » ne compte un pixel que s'il change de plus de 24 niveaux
     de gris : un voile léger en change ~10, il est invisible PAR CONSTRUCTION.
   — Et caméra posée sur une scène immobile, ces voies restent plates pendant
     l'apprentissage : la règle du capteur plat refuse de les armer.

   La réponse : découper l'image en BLOCS (8×6 sur la vue 64×48) et mesurer le
   bloc qui s'écarte le plus de son fond appris. Le moyennage par bloc écrase
   le bruit du capteur (÷8 pour un bloc de 8×8) : une lueur de quelques pixels
   ou un voile de 10 niveaux ressortent à des dizaines de fois le bruit, là où
   les voies globales ne voyaient rien.

   Deux règles de fond, mesurées avant livraison (voir docs/mesures-zone.md) :

   1. CE QUI TOUCHE TOUTE L'IMAGE N'EST PAS LOCALISÉ. L'exposition automatique
      du téléphone, une lampe qui s'allume, un nuage : tous les blocs bougent
      ensemble. On soustrait donc la MÉDIANE des écarts de blocs — un
      changement global se retranche lui-même, un changement local reste
      entier. Sans cela, l'exposition automatique ferait parler la voie en
      continu. Limite assumée et dite : un voile qui couvre PLUS de la moitié
      de l'image devient « global » et s'efface — c'est la voie Luminance qui
      le porte alors.

   2. LE FOND S'APPREND EN TEMPS, PAS EN IMAGES. Les pages lisent la caméra à
      des cadences différentes (11 im/s au banc, jusqu'à 60 via
      requestAnimationFrame) : une adaptation « par image » donnerait un fond
      six fois plus oublieux sur une page que sur l'autre. La constante de
      temps est donc en secondes (TAU), identique partout.

   La voie ne décide rien : elle mesure des niveaux de gris (0–255) et les
   donne au moteur (lib/moteur.js), qui garde son seuil auto-calibré, son
   témoin de bruit et sa persistance. Aucun seuil n'est posé ici.

   Usage :
     const Z = GBZone.creer();            // {largeur, hauteur, blocsX, blocsY, tau}
     const r = Z.mesurer(gris);           // gris : niveaux 0-255, ligne par ligne
     r.val   → l'écart localisé max, en niveaux de gris (0 tant que le fond s'installe)
     r.bloc  → {x,y,w,h} du bloc en cause, en pixels de la vue analysée (ou null)
     Z.raz();                             // torche, changement d'objectif : le fond ne décrit plus rien
   ═══════════════════════════════════════════════════════════════════════ */
window.GBZone = (function(){
  "use strict";

  function creer(opts){
    opts = opts || {};
    var W  = opts.largeur || 64, H = opts.hauteur || 48;
    var BX = opts.blocsX  || 8,  BY = opts.blocsY  || 6;
    var bw = (W/BX)|0, bh = (H/BY)|0, NB = BX*BY;
    var TAU = opts.tau || 8;              // constante de temps du fond, en secondes
    var TAU_B = opts.tauBouge || 0.5;     // fenêtre du témoin de déplacement, en secondes
    var bg = null, ema = null, tPrec = 0;
    var moy = new Float32Array(NB), dev = new Float32Array(NB), devB = new Float32Array(NB);

    function mesurer(gris){
      if(!gris || gris.length < W*H) return { val:0, bloc:null };
      // moyenne de chaque bloc — c'est elle qui écrase le bruit du capteur
      for(var by=0; by<BY; by++) for(var bx=0; bx<BX; bx++){
        var s=0, x0=bx*bw, y0=by*bh;
        for(var y=y0; y<y0+bh; y++){
          var row=y*W;
          for(var x=x0; x<x0+bw; x++) s += gris[row+x];
        }
        moy[by*BX+bx] = s/(bw*bh);
      }
      var now = (typeof performance!=='undefined' && performance.now) ? performance.now()/1000 : Date.now()/1000;
      if(!bg){ bg = moy.slice(); ema = moy.slice(); tPrec = now; return { val:0, bloc:null, bouge:0 }; }
      // écart au fond, PUIS adaptation — dans cet ordre, sinon on compare au présent
      var i;
      for(i=0;i<NB;i++) dev[i] = moy[i]-bg[i];
      var dt = Math.min(1, Math.max(0.001, now-tPrec)); tPrec = now;
      var a = 1 - Math.exp(-dt/TAU);
      for(i=0;i<NB;i++) bg[i] += a*dev[i];
      /* ── témoin de déplacement : la caméra bouge-t-elle ? ──
         Médiane des écarts de blocs à une moyenne courte (~0,5 s). Une caméra
         posée : quelques dixièmes de niveau (le bruit du capteur, écrasé par
         le bloc). Une caméra qui panote ou marche : toute la scène glisse dans
         la fenêtre → plusieurs niveaux, sur la MOITIÉ des blocs au moins —
         d'où la médiane, insensible à un événement local (une lueur qui passe
         ne doit pas se faire passer pour un déplacement de caméra). Fenêtre
         en SECONDES, pas en images : la mesure est la même à 11 ou 60 im/s.
         Un saut d'éclairage global y entre ~0,5 s puis s'efface — c'est au
         veilleur (durées de maintien) de ne pas le prendre pour une marche. */
      var ab = 1 - Math.exp(-dt/TAU_B);
      for(i=0;i<NB;i++){ devB[i] = Math.abs(moy[i]-ema[i]); ema[i] += ab*(moy[i]-ema[i]); }
      var triB = Array.prototype.slice.call(devB).sort(function(x,y){return x-y;});
      var bouge = (NB%2) ? triB[(NB-1)>>1] : (triB[NB/2-1]+triB[NB/2])/2;
      // la médiane des écarts = la part GLOBALE du changement (exposition,
      // lampe, nuage). On la soustrait : seul le local reste.
      var tri = Array.prototype.slice.call(dev).sort(function(x,y){return x-y;});
      var med = (NB%2) ? tri[(NB-1)>>1] : (tri[NB/2-1]+tri[NB/2])/2;
      var best=0, bi=-1;
      for(i=0;i<NB;i++){
        var d = Math.abs(dev[i]-med);
        if(d>best){ best=d; bi=i; }
      }
      return { val:best, bouge:bouge,
        bloc: bi<0 ? null : { x:(bi%BX)*bw, y:((bi/BX)|0)*bh, w:bw, h:bh } };
    }

    /* torche allumée, objectif changé, caméra rouverte : le fond appris ne
       décrit plus rien — on repart de la prochaine image. La voie moteur qui
       nous lit doit être relancée en même temps (GBMoteur.relancer). */
    function raz(){ bg = null; ema = null; }

    return { mesurer:mesurer, raz:raz, W:W, H:H, BX:BX, BY:BY };
  }

  /* ── le veilleur de pose : « posée » ou « en déplacement », avec mémoire ──
     Décide l'ÉTAT de la caméra à partir du témoin `bouge`, avec hystérésis et
     durées de maintien : un état ne bascule que s'il est TENU, jamais sur une
     image isolée. Les quatre chiffres par défaut sont MESURÉS (voir
     docs/mesures-zone.md) : caméra posée, bruit capteur seul → bouge reste
     sous 0,5 niveau ; marche ou panoramique, même lent → au-dessus de 1,2
     niveau sur toute la durée du geste ; un saut d'éclairage global ne tient
     pas les 700 ms. Ce n'est PAS un seuil d'émission : aucun mot n'en dépend —
     il ne fait que dire aux voies image si leur fond a encore un sens. */
  function veilleur(opts){
    opts = opts || {};
    var HAUT   = opts.haut   != null ? opts.haut   : 1.2;   // niveaux : au-dessus, ça bouge
    var BAS    = opts.bas    != null ? opts.bas    : 0.5;   // niveaux : en dessous, c'est posé
    var TENIR  = opts.tenir  != null ? opts.tenir  : 700;   // ms au-dessus avant de déclarer « bouge »
    var CALME  = opts.calme  != null ? opts.calme  : 2000;  // ms en dessous avant de déclarer « posée »
    var etat = 'fixe', tHaut = 0, tBas = 0;
    function pousser(bouge, now){
      if(etat === 'fixe'){
        if(bouge >= HAUT){ if(!tHaut) tHaut = now; if(now - tHaut >= TENIR){ etat = 'bouge'; tBas = 0; } }
        else tHaut = 0;
      } else {
        if(bouge <= BAS){ if(!tBas) tBas = now; if(now - tBas >= CALME){ etat = 'fixe'; tHaut = 0; } }
        else tBas = 0;
      }
      return etat;
    }
    return { pousser:pousser, etat:function(){ return etat; },
             raz:function(){ etat='fixe'; tHaut=0; tBas=0; } };
  }

  return { creer:creer, veilleur:veilleur };
})();
