/* ═══════════════════════════════════════════════════════════════════════
   Spectre audio — implémentation UNIQUE, partagée par toutes les pages.

   Pourquoi ce fichier existe : il y avait DEUX spectres dans l'application.
   Celui d'Écoute, soigné (rampe à cinq arrêts, du noir au crème), et celui
   de la séance capteurs, bâclé (un simple dégradé de vert, sans repère de
   fréquence, sans niveau, sans mémoire des mots). Le second était moins bon
   que le premier — ce qui n'a aucune raison d'être, puisque c'est le même
   son, le même appareil, le même besoin. Il n'y a donc plus qu'un spectre.

   Ce qu'il montre, et c'est tout ce qu'il montre :
   — le temps défile vers la gauche, la dernière colonne est l'instant présent ;
   — la hauteur est la fréquence, de 0 à 8 kHz, avec des repères écrits ;
   — la couleur est l'énergie : noir = rien, crème = saturé ;
   — une barre de niveau en bas, avec le REPÈRE DU SEUIL du moteur : on voit
     donc, en direct, de combien on est loin de ce qu'il faudrait pour qu'un
     mot puisse sortir ;
   — des traits verticaux : or = repère posé à la main, vert = mot retenu,
     rouge = le témoin de bruit a relevé le seuil.

   Ce qu'il ne fait PAS : il n'émet rien. Le spectre est un témoin visuel, il
   ne participe à aucune décision. Aucun mot ne sort d'ici.

   Usage :
     const SP = GBSpectre.creer({ canvas, analyser, sampleRate: () => ctx.sampleRate });
     SP.demarrer();
     SP.niveau(dbfs, seuil_dbfs);   // facultatif : alimente la barre du bas
     SP.marquer('mot');             // 'mot' | 'main' | 'temoin'
     SP.arreter();
   ═══════════════════════════════════════════════════════════════════════ */
window.GBSpectre = (function(){
  "use strict";

  /* la rampe d'Écoute, celle qui lit bien dans le noir d'une cave :
     noir bleuté → bleu profond → turquoise → or → crème */
  var STOPS = [[0,8,12,14],[64,20,44,66],[126,28,116,104],[192,233,180,76],[255,255,246,222]];
  function ramp(v){
    for(var i=0;i<4;i++){
      var a=STOPS[i], b=STOPS[i+1];
      if(v<=b[0]){
        var f=(v-a[0])/((b[0]-a[0])||1);
        return 'rgb('+((a[1]+(b[1]-a[1])*f)|0)+','+((a[2]+(b[2]-a[2])*f)|0)+','+((a[3]+(b[3]-a[3])*f)|0)+')';
      }
    }
    return 'rgb(255,246,222)';
  }

  var FMAX = 8000;                       // au-delà, le micro d'un téléphone ne dit plus grand-chose
  var REPERES = [1000, 2000, 4000, 6000];
  var COUL = { mot:'#5FD3A6', main:'#E9B44C', temoin:'#E2574C' };

  function creer(opts){
    opts = opts || {};
    var cv = opts.canvas, ana = opts.analyser;
    if(!cv) return null;
    var g = cv.getContext('2d');
    var srFn = opts.sampleRate || function(){ return 44100; };
    var actif=false, raf=0, marques=[], dpr=1, W=0, H=0;
    var barreH = opts.barre === false ? 0 : 16;   // la barre de niveau, en bas
    var db=-100, seuilDb=null, lastPaint=0;

    function fit(){
      var r = cv.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(60, Math.round(r.width * dpr));
      var h = Math.max(40, Math.round(r.height * dpr));
      if(cv.width !== w || cv.height !== h){
        cv.width = w; cv.height = h;
        g.fillStyle = '#05090C'; g.fillRect(0,0,w,h);
      }
      W = cv.width; H = cv.height;
    }

    /* le spectrogramme n'occupe pas toute la hauteur : la barre de niveau
       vit en dessous, sur son propre bandeau, et n'est jamais effacée par
       le défilement (sinon elle laisserait une traînée) */
    function hSpec(){ return Math.max(20, H - barreH*dpr); }

    function colonne(){
      var hs = hSpec();
      var pas = Math.max(2, Math.round(2*dpr));
      // défilement : on recopie l'image sur elle-même, décalée
      g.drawImage(cv, 0,0, W,hs, -pas,0, W,hs);

      if(ana){
        var bins = ana.frequencyBinCount;
        var d = new Uint8Array(bins);
        ana.getByteFrequencyData(d);
        var nyq = srFn()/2;
        var mx = Math.max(8, Math.round(Math.min(FMAX,nyq)/nyq*bins));
        for(var y=0; y<hs; y++){
          var i = Math.floor((1 - y/hs)*(mx-1));
          g.fillStyle = ramp(d[i]);
          g.fillRect(W-pas, y, pas, 1);
        }
      } else {
        g.fillStyle = '#05090C'; g.fillRect(W-pas, 0, pas, hs);
      }

      // les marques : posées sur la colonne de l'instant présent
      while(marques.length){
        var m = marques.shift();
        g.fillStyle = COUL[m] || '#FFF';
        if(m === 'temoin') g.fillRect(W-pas, hs*0.88, pas, hs*0.12);
        else g.fillRect(W-pas, 0, pas, hs);
      }
    }

    /* les repères de fréquence sont REDESSINÉS à chaque image, à gauche :
       ils ne défilent pas, sinon ce seraient des traînées */
    function repères(){
      var hs = hSpec();
      g.save();
      g.font = Math.round(9*dpr)+'px "IBM Plex Mono",ui-monospace,monospace';
      g.textBaseline = 'middle';
      for(var i=0;i<REPERES.length;i++){
        var f = REPERES[i];
        if(f > FMAX) continue;
        var y = hs - (f/FMAX)*hs;
        g.fillStyle = 'rgba(120,134,142,.30)';
        g.fillRect(0, Math.round(y), W, 1);
        g.fillStyle = 'rgba(160,180,190,.72)';
        var t = (f>=1000? (f/1000)+'k' : String(f));
        g.fillText(t, 4*dpr, y - 6*dpr);
      }
      g.restore();
    }

    /* barre de niveau + repère du seuil : la seule façon de voir, sans lire
       un chiffre, à quelle distance on est de ce qu'il faudrait */
    function barre(){
      if(!barreH) return;
      var y0 = hSpec(), h = H - y0;
      g.fillStyle = '#0A0F12'; g.fillRect(0, y0, W, h);
      g.fillStyle = 'rgba(44,56,63,1)'; g.fillRect(0, y0, W, 1);
      var pc = Math.min(1, Math.max(0, (db + 80)/80));      // −80 dBFS → 0 dBFS
      g.fillStyle = '#5FD3A6';
      g.fillRect(0, y0+3*dpr, W*pc, h - 6*dpr);
      if(seuilDb != null && isFinite(seuilDb)){
        var ps = Math.min(1, Math.max(0, (seuilDb + 80)/80));
        g.fillStyle = '#E9B44C';
        g.fillRect(Math.round(W*ps), y0+1*dpr, Math.max(1,Math.round(2*dpr)), h - 2*dpr);
      }
    }

    function boucle(){
      if(!actif) return;
      raf = requestAnimationFrame(boucle);
      var t = performance.now();
      // 30 images/s suffisent largement et ménagent la batterie sur le terrain
      if(t - lastPaint < 32) return;
      lastPaint = t;
      fit(); colonne(); repères(); barre();
    }

    return {
      demarrer: function(){ if(actif) return; actif = true; fit(); boucle(); },
      arreter:  function(){ actif = false; if(raf) cancelAnimationFrame(raf); raf = 0; },
      actif:    function(){ return actif; },
      /* niveau courant et seuil, tous deux en dBFS — le seuil peut être null */
      niveau:   function(v, seuil){ if(isFinite(v)) db = v; seuilDb = (seuil==null? null : seuil); },
      marquer:  function(type){ marques.push(type || 'mot'); },
      analyser: function(a){ ana = a; },
      placer:   fit,
      /* une vignette, pour ranger l'aspect du son avec l'enregistrement */
      vignette: function(){ try{ return cv.toDataURL('image/jpeg', .55); }catch(e){ return null; } }
    };
  }

  return { creer: creer, ramp: ramp, FMAX: FMAX };
})();
