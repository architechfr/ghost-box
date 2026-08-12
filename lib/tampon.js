/* ═══════════════════════════════════════════════════════════════════════
   Mémoire tampon — « revenir en arrière »

   Le problème : la plupart du temps il ne se passe rien, et enregistrer des
   heures pour rien remplit l'appareil. Mais quand quelque chose arrive, il est
   DÉJÀ passé au moment où on appuie.

   Le principe : l'appareil encode en permanence, mais ne garde rien. À chaque
   instant, seules les N dernières secondes existent — en mémoire vive, jamais
   sur le disque — et tout ce qui est plus vieux est effacé au fur et à mesure.
   Si on appuie sur « enregistrer », ces N secondes-là sont sauvées AVEC la
   suite. Si on n'appuie pas, elles disparaissent et rien n'est écrit nulle part.

   Comment c'est fait, sans magie : un MediaRecorder tourne en continu et rend
   un morceau par seconde. Le tout PREMIER morceau contient l'en-tête du fichier
   et est gardé pour toujours (quelques dizaines de Ko) ; les suivants sont
   jetés dès qu'ils ont plus de N secondes. Au déclenchement, le fichier livré
   est : en-tête + morceaux depuis (déclenchement − N).

   Limite honnête : ça n'est possible qu'en WebM. Un appareil qui n'enregistre
   qu'en MP4 (iPhone) ne peut pas faire ça — `supporte()` renvoie false et il
   faut le dire, pas le cacher.
   ═══════════════════════════════════════════════════════════════════════ */
window.GBTampon = (function(){
  "use strict";

  var CANDIDATS = ['video/webm;codecs=vp8,opus','video/webm;codecs=vp9,opus','video/webm'];
  var TRANCHE = 1000;          // un morceau par seconde
  var MARGE   = 1500;          // un morceau couvre l'intervalle qui le précède
  var OCTETS_MAX = 400*1024*1024;   // garde-fou mémoire d'une longue prise

  function mime(){
    if(!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
    for(var i=0;i<CANDIDATS.length;i++) if(MediaRecorder.isTypeSupported(CANDIDATS[i])) return CANDIDATS[i];
    return '';
  }
  function supporte(){ return !!mime(); }

  function creer(opts){
    opts = opts || {};
    var sec = opts.secondes || 10;
    var type = mime();
    var rec = null, entete = null, morceaux = [], octets = 0;
    var actif = false, garde = false, tGarde = 0, tDebut = 0, prerollReel = 0;
    var finPromesse = null, finResoudre = null;

    function etat(){
      if(opts.onEtat) opts.onEtat({
        actif: actif, garde: garde,
        dispo: dispo(), octets: octets, secondes: sec
      });
    }
    /* secondes réellement disponibles en mémoire, à cet instant */
    function dispo(){
      if(!actif || !morceaux.length) return 0;
      var now = performance.now();
      return Math.min(sec, (now - Math.min(tDebut, morceaux[0].t)) / 1000);
    }
    function elaguer(){
      if(garde) return;                       // en enregistrement : on ne jette plus rien
      var limite = performance.now() - (sec*1000 + MARGE);
      while(morceaux.length && morceaux[0].t < limite){ octets -= morceaux[0].b.size; morceaux.shift(); }
    }

    function demarrer(flux){
      if(actif) return true;
      if(!type || !flux) return false;
      /* Même débit imposé que l'enregistrement direct : sans ça, la prise
         venue du tampon était encodée au débit par défaut du navigateur —
         mesuré à 3 Mbps sur du bruit en 720p — pendant que la prise normale,
         elle, aurait été correcte. Deux qualités différentes selon le bouton
         utilisé, c'est le genre d'écart qu'on ne découvre qu'au montage. */
      var opt = { mimeType: type };
      if(window.GBEncodage && opts.largeur && opts.hauteur){
        opt = GBEncodage.options(type, opts.largeur, opts.hauteur, opts.images || 30);
      }
      try{ rec = new MediaRecorder(flux, opt); }
      catch(e){ rec = null; return false; }
      entete = null; morceaux = []; octets = 0; garde = false; tGarde = 0;
      tDebut = performance.now();
      rec.ondataavailable = function(e){
        if(!e.data || !e.data.size) return;
        if(!entete){ entete = e.data; octets += e.data.size; etat(); return; }
        morceaux.push({ t: performance.now(), b: e.data });
        octets += e.data.size;
        // en enregistrement, chaque morceau est aussitôt confié à la page :
        // c'est elle qui le met à l'abri, pour qu'une prise ne puisse plus se perdre
        if(garde && opts.onMorceau) try{ opts.onMorceau(e.data); }catch(err){}
        elaguer();
        if(octets > OCTETS_MAX && !garde) elaguer();
        etat();
      };
      rec.onstop = function(){ if(finResoudre){ var f = finResoudre; finResoudre = null; f(); } };
      try{ rec.start(TRANCHE); }catch(e){ rec = null; return false; }
      actif = true; etat();
      return true;
    }

    /* on appuie sur enregistrer : à partir d'ici on ne jette plus, et les N
       secondes déjà en mémoire font partie de la prise. */
    function garder(){
      if(!actif || garde) return 0;
      garde = true; tGarde = performance.now();
      prerollReel = Math.min(sec, (tGarde - tDebut)/1000);
      // ce qui est DÉJÀ en mémoire fait partie de la prise : on le confie tout de suite
      if(opts.onGarde){
        var depuis0 = tGarde - sec*1000 - MARGE;
        var deja = [];
        if(entete) deja.push(entete);
        for(var i=0;i<morceaux.length;i++) if(morceaux[i].t >= depuis0) deja.push(morceaux[i].b);
        try{ opts.onGarde(deja); }catch(err){}
      }
      etat();
      return prerollReel;
    }
    function enGarde(){ return garde; }

    /* fin de prise : rend le fichier (en-tête + tout depuis déclenchement − N) */
    function terminer(){
      if(!actif) return Promise.resolve(null);
      finPromesse = new Promise(function(res){ finResoudre = res; });
      try{ rec.stop(); }catch(e){ if(finResoudre){ finResoudre(); finResoudre=null; } }
      var tFin = performance.now();
      return finPromesse.then(function(){
        actif = false;
        var depuis = (garde? tGarde : tFin) - sec*1000 - MARGE;
        var gardes = morceaux.filter(function(m){ return m.t >= depuis; });
        var parts = entete ? [entete] : [];
        for(var i=0;i<gardes.length;i++) parts.push(gardes[i].b);
        var blob = new Blob(parts, {type:type});
        var duree = gardes.length ? (gardes[gardes.length-1].t - Math.max(depuis, tDebut))/1000 : 0;
        var r = { blob: blob, type: type, duree: Math.max(0, Math.round(duree)),
                  preroll: Math.round(prerollReel), morceaux: gardes.length };
        entete = null; morceaux = []; octets = 0; garde = false;
        etat();
        return r;
      });
    }

    /* on coupe sans rien garder : la mémoire est vidée, rien n'a jamais été écrit */
    function arreter(){
      if(!actif) return;
      actif = false; garde = false;
      try{ rec.stop(); }catch(e){}
      entete = null; morceaux = []; octets = 0; rec = null;
      etat();
    }

    return { demarrer: demarrer, arreter: arreter, garder: garder, enGarde: enGarde,
             terminer: terminer, dispo: dispo, actif: function(){ return actif; },
             octets: function(){ return octets; }, secondes: function(){ return sec; },
             type: function(){ return type; } };
  }

  return { creer: creer, supporte: supporte, mime: mime };
})();
