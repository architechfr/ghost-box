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

   ── LE DÉFAUT QUI A RENDU DES PRISES ILLISIBLES, ET SA MESURE (000ap) ──
   La première version recollait « premier morceau (l'en-tête) + morceaux
   depuis t−N » en croyant les morceaux suivants indépendants. C'est FAUX,
   et c'est mesuré : un codeur vidéo n'écrit une image COMPLÈTE (image-clé)
   que de loin en loin — toutes les ~3,4 s dans Chromium, parfois bien plus
   rarement sur un codeur matériel de téléphone — et toutes les autres images
   ne décrivent que la DIFFÉRENCE avec la précédente. Un fichier qui démarre
   entre deux images-clés est indécodable : le lecteur reste figé sur l'image
   de l'en-tête (écran noir sur une séance de nuit) ou étale des blocs de
   pixels jusqu'à la clé suivante. Reproduit dans Chromium : prise tampon
   assemblée à t=30 s → image figée de t=0, sur toute la durée.

   La réponse, en trois pièces, toutes ici :
   1. La cadence des images-clés est IMPOSÉE au codeur
      (videoKeyFrameIntervalDuration, posé par lib/encodage.js — mesuré :
      respecté par Chromium, une clé toutes les 2,0 s pile). Si un navigateur
      l'ignore, les pièces 2 et 3 suffisent à garder des fichiers lisibles.
   2. Le flux WebM est LU au fil de l'eau (analyseur EBML incrémental) pour
      savoir où commencent les clusters et lesquels s'ouvrent sur une
      image-clé. Le bit se lit dans le payload VP8/VP9 lui-même : le
      conteneur de Chrome ment (BlockGroups sans ReferenceBlock même pour
      des images delta — vérifié à l'octet).
   3. L'élagage et l'assemblage ne coupent JAMAIS ailleurs que sur un début
      de cluster à image-clé (« point sûr »). L'en-tête gardé est le VRAI
      en-tête (les octets d'avant le premier cluster), sans sa seconde de
      vieille image ; et les horodatages des clusters gardés sont réécrits
      pour que le fichier commence à zéro — sans ça le lecteur croit à un
      direct pris en cours de route et le curseur démarre à 25 s.

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

  /* ── L'analyseur EBML incrémental ─────────────────────────────────────
     Il reçoit les octets des morceaux dans l'ordre et n'en garde presque
     rien : il repère les débuts de cluster, lit leur horodatage, et regarde
     le PREMIER bloc vidéo de chacun pour dire s'il s'ouvre sur une image-clé
     (premier octet du payload VP8/VP9 : bit 0 à zéro = image-clé). Il rend :
       premierCluster — offset absolu du tout premier cluster (fin de
         l'en-tête pur) ;
       surs — [{abs, tc}] débuts de cluster à image-clé (« points sûrs ») ;
       clusters — [{abs, tcAbs, tcLong, tc}] tous les clusters, avec la
         position exacte des octets de leur horodatage (pour la réécriture).
     S'il rencontre un octet inattendu, il se resynchronise sur la prochaine
     signature de cluster : au pire un point sûr est perdu, jamais la prise. */
  function creerAnalyseur(pisteVideo){
    var reste = null, resteAbs = 0;   // petits octets d'en-tête d'élément en attente
    var abs = 0;                      // offset absolu du prochain octet à recevoir
    var saut = 0;                     // octets de payload à ignorer
    var pile = [];                    // contextes ouverts : {type, fin absolue ou null}
    var clusterCourant = null;
    var A = { premierCluster:null, surs:[], clusters:[], feed:feed };

    function vint(u, p, masquer){
      if(p >= u.length) return null;
      var pr = u[p];
      if(pr === 0) return { invalide:true };
      var long = 1;
      for(var m=0x80; !(pr & m); m >>= 1) long++;
      if(p + long > u.length) return null;               // il manque des octets
      var val = masquer ? (pr & (0xFF >> long)) : pr;
      var inconnu = masquer && (pr & (0xFF >> long)) === (0xFF >> long);
      for(var i=1;i<long;i++){
        val = val*256 + u[p+i];
        if(u[p+i] !== 0xFF) inconnu = false;
      }
      return { val:val, long:long, inconnu:inconnu };
    }
    function suspendre(u, p, base){ reste = u.slice(p); resteAbs = base + p; }

    function feed(u8){
      var u, base;
      if(reste && reste.length){
        u = new Uint8Array(reste.length + u8.length);
        u.set(reste, 0); u.set(u8, reste.length);
        base = resteAbs;
      } else { u = u8; base = abs; }
      abs += u8.length; reste = null;
      var p = 0;
      while(true){
        if(saut > 0){
          var prend = Math.min(saut, u.length - p);
          p += prend; saut -= prend;
          if(saut > 0) return;
        }
        while(pile.length && pile[pile.length-1].fin !== null && base + p >= pile[pile.length-1].fin) pile.pop();
        if(p >= u.length) return;
        if(u.length - p < 24){ suspendre(u, p, base); return; }

        /* signature de cluster — c'est aussi ce qui referme un cluster de
           taille inconnue */
        if(u[p]===0x1F && u[p+1]===0x43 && u[p+2]===0xB6 && u[p+3]===0x75){
          var tCl = vint(u, p+4, true);
          if(!tCl){ suspendre(u, p, base); return; }
          if(tCl.invalide){ p++; continue; }
          while(pile.length) pile.pop();
          clusterCourant = { abs: base + p, tc: null, decide: false };
          if(A.premierCluster === null) A.premierCluster = base + p;
          pile.push({ type:'cluster', fin: tCl.inconnu ? null : base + p + 4 + tCl.long + tCl.val });
          p += 4 + tCl.long;
          continue;
        }

        var ctx = pile.length ? pile[pile.length-1] : null;

        if(!ctx){
          /* hors cluster : début de fichier. On DESCEND dans le Segment,
             on saute tout le reste (en-tête EBML, Info, Tracks…). */
          var idH = vint(u, p, false);
          if(!idH){ suspendre(u, p, base); return; }
          if(idH.invalide){ p++; continue; }
          var tH = vint(u, p + idH.long, true);
          if(!tH){ suspendre(u, p, base); return; }
          if(tH.invalide){ p++; continue; }
          if(idH.val === 0x18538067 || tH.inconnu){ p += idH.long + tH.long; continue; }
          p += idH.long + tH.long; saut = tH.val;
          continue;
        }

        var id = u[p];
        if(id === 0xE7 && ctx.type === 'cluster'){          // horodatage du cluster
          var tT = vint(u, p+1, true);
          if(!tT){ suspendre(u, p, base); return; }
          if(tT.invalide || tT.val > 8){ p++; continue; }
          if(u.length - p < 1 + tT.long + tT.val){ suspendre(u, p, base); return; }
          var tc = 0;
          for(var k=0;k<tT.val;k++) tc = tc*256 + u[p+1+tT.long+k];
          if(clusterCourant && clusterCourant.tc === null){
            clusterCourant.tc = tc;
            A.clusters.push({ abs: clusterCourant.abs, tcAbs: base + p + 1 + tT.long,
                              tcLong: tT.val, tc: tc });
          }
          p += 1 + tT.long + tT.val;
          continue;
        }
        if(id === 0xA0){                                    // BlockGroup : entrer
          var tG = vint(u, p+1, true);
          if(!tG){ suspendre(u, p, base); return; }
          if(tG.invalide){ p++; continue; }
          pile.push({ type:'groupe', fin: tG.inconnu ? null : base + p + 1 + tG.long + tG.val });
          p += 1 + tG.long;
          continue;
        }
        if(id === 0xA3 || id === 0xA1){                     // SimpleBlock / Block
          var tB = vint(u, p+1, true);
          if(!tB){ suspendre(u, p, base); return; }
          if(tB.invalide){ p++; continue; }
          var d = p + 1 + tB.long;
          var piste = vint(u, d, true);
          if(!piste){ suspendre(u, p, base); return; }
          if(piste.invalide){ p++; continue; }
          if(u.length - d < piste.long + 4){ suspendre(u, p, base); return; }
          if(clusterCourant && !clusterCourant.decide && piste.val === pisteVideo){
            var octet1 = u[d + piste.long + 3];             // 1er octet du payload
            clusterCourant.decide = true;
            if((octet1 & 1) === 0 && clusterCourant.tc !== null)
              A.surs.push({ abs: clusterCourant.abs, tc: clusterCourant.tc });
          }
          p += 1 + tB.long; saut = tB.val;
          continue;
        }
        /* tout autre enfant : sauter */
        var idA = vint(u, p, false);
        if(!idA){ suspendre(u, p, base); return; }
        if(idA.invalide){ p++; continue; }
        var tA = vint(u, p + idA.long, true);
        if(!tA){ suspendre(u, p, base); return; }
        if(tA.invalide || tA.inconnu){ p += idA.long + (tA.long||1); continue; }
        p += idA.long + tA.long; saut = tA.val;
      }
    }
    return A;
  }

  /* Numéro de la piste vidéo, lu dans l'en-tête (TrackEntry 0xAE →
     TrackNumber 0xD7 + TrackType 0x83, type 1 = vidéo). Le balayage est
     borné à la TAILLE déclarée de l'entrée : les TrackEntry vidéo et audio
     se suivent à quelques octets, un balayage à fenêtre fixe lisait les
     champs de l'audio par-dessus ceux de la vidéo — payé au banc d'essai. */
  function pisteVideoDe(u){
    for(var i=0; i+8 < u.length; i++){
      if(u[i] !== 0xAE) continue;
      var pr = u[i+1];
      if(!pr) continue;
      var long = 1; for(var m=0x80; !(pr & m); m >>= 1) long++;
      if(long > 4) continue;
      var taille = pr & (0xFF >> long);
      for(var k=1;k<long;k++) taille = taille*256 + u[i+1+k];
      var fin = Math.min(u.length, i + 1 + long + taille);
      var num = null, type = null;
      for(var j=i+1+long; j<fin-2; j++){
        if(num  === null && u[j]===0xD7 && u[j+1]===0x81) num  = u[j+2];
        if(type === null && u[j]===0x83 && u[j+1]===0x81) type = u[j+2];
      }
      if(num !== null && type === 1) return num;
    }
    return null;
  }

  function creer(opts){
    opts = opts || {};
    var sec = opts.secondes || 10;
    var type = mime();
    var rec = null, entete = null, morceaux = [], octets = 0;
    var actif = false, garde = false, tGarde = 0, tDebut = 0, prerollReel = 0;
    var finPromesse = null, finResoudre = null;
    var seqSuivant = 0;           // numéro de morceau, ne recule jamais
    var absTotal = 0;             // octets reçus depuis le départ
    var analyse = null;           // l'analyseur EBML (ou {brut:true} sans vidéo)
    var fileParse = Promise.resolve();   // les morceaux s'analysent dans l'ordre
    var departGarde = null;       // le point sûr choisi au déclenchement

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

    /* offset absolu → morceau qui le contient (null s'il est déjà élagué) */
    function ouEst(a){
      for(var i=morceaux.length-1;i>=0;i--)
        if(a >= morceaux[i].abs) return (a < morceaux[i].abs + morceaux[i].b.size) ? morceaux[i] : null;
      return null;
    }

    /* le point sûr le plus récent dont le morceau porteur est plus vieux que
       `limite` (temps performance.now), encore présent en mémoire */
    function pointSurAvant(limite){
      if(!analyse || analyse.brut) return null;
      var choix = null;
      for(var i=0;i<analyse.surs.length;i++){
        var s = analyse.surs[i];
        var m = ouEst(s.abs);
        if(!m) continue;                       // déjà élagué
        if(m.t <= limite) choix = s; else break;
      }
      return choix;
    }

    /* L'élagage ne coupe QUE sur un point sûr : tout ce qui précède le
       dernier point sûr plus vieux que N secondes est jeté, et le morceau
       du point est taillé à l'octet près — la mémoire commence TOUJOURS sur
       une image-clé. Pas de point sûr assez vieux ? On garde tout : le
       garde-fou mémoire reste seul juge, et il préfère un fichier long à un
       appareil à genoux. */
    function elaguer(){
      if(garde) return;                        // en enregistrement : on ne jette plus rien
      var limite = performance.now() - (sec*1000 + MARGE);
      if(analyse && analyse.brut){             // audio pur : chaque cluster Opus se décode seul
        while(morceaux.length && morceaux[0].t < limite){ octets -= morceaux[0].b.size; morceaux.shift(); }
        return;
      }
      var s = pointSurAvant(limite);
      if(s){
        var m = ouEst(s.abs);
        while(morceaux.length && morceaux[0].seq < m.seq){ octets -= morceaux[0].b.size; morceaux.shift(); }
        var coupe = s.abs - m.abs;
        if(coupe > 0){
          octets -= coupe;
          m.b = m.b.slice(coupe);
          m.abs = s.abs;                       // le morceau commence désormais là
        }
      }
      if(analyse && morceaux.length){          // oublier ce qui est sorti de la mémoire
        var bas = morceaux[0].abs;
        while(analyse.surs.length && analyse.surs[0].abs < bas) analyse.surs.shift();
        while(analyse.clusters.length && analyse.clusters[0].abs < bas) analyse.clusters.shift();
      }
      if(octets > OCTETS_MAX){
        /* le codeur ne donne plus d'image-clé : élagage aveugle d'urgence —
           fichier au départ abîmé plutôt que mémoire dévorée, et le journal
           de la page le verra à la taille */
        while(morceaux.length > 1 && morceaux[0].t < limite && octets > OCTETS_MAX){
          octets -= morceaux[0].b.size; morceaux.shift();
        }
      }
    }

    /* Le départ d'une prise : le point sûr le plus proche de `depuis`
       (ou le début de la mémoire, qui est toujours un point sûr par
       construction de l'élagage). Rendu figé pour pouvoir être réutilisé
       tel quel à la fin de la prise. */
    function choisirDepart(depuis){
      if(!analyse || analyse.brut || analyse.premierCluster === null || !entete) return null;
      var s = pointSurAvant(depuis);
      if(!s){                                   // prise plus jeune que N s : premier point sûr connu
        for(var j=0;j<analyse.surs.length;j++){ if(ouEst(analyse.surs[j].abs)){ s = analyse.surs[j]; break; } }
      }
      return s ? { abs: s.abs, tc: s.tc } : null;
    }

    /* Assemble une prise : en-tête pur + morceaux depuis `depart`, et si
       `rebaser`, horodatages ramenés à zéro (tous les clusters de la prise,
       jamais une partie seulement — un saut d'horodatage au milieu gèlerait
       la lecture pendant toute la durée du trou). */
    function fabriquer(depuis, depart, rebaser){
      if(!morceaux.length) return entete ? [entete] : [];
      if(!analyse || analyse.brut || analyse.premierCluster === null || !entete){
        /* rien d'analysé (prise plus jeune qu'un morceau) ou audio pur :
           le recollage simple est encore le bon */
        var simples = entete ? [entete] : [];
        for(var i=0;i<morceaux.length;i++)
          if(analyse && analyse.brut ? morceaux[i].t >= depuis : true) simples.push(morceaux[i].b);
        return simples;
      }
      var s = depart || choisirDepart(depuis);
      var debutAbs = s ? s.abs : morceaux[0].abs;
      var base = s ? s.tc : 0;

      /* réécriture des horodatages des clusters gardés : tc − base, écrit
         sur le même nombre d'octets (la valeur ne peut que baisser) */
      var patchs = [];
      if(rebaser && base > 0){
        for(var c0=0;c0<analyse.clusters.length;c0++){
          var c = analyse.clusters[c0];
          if(c.abs < debutAbs) continue;
          var nv = Math.max(0, c.tc - base);
          var oct = new Uint8Array(c.tcLong);
          for(var k=c.tcLong-1;k>=0;k--){ oct[k] = nv & 0xFF; nv = Math.floor(nv/256); }
          patchs.push({ abs: c.tcAbs, oct: oct });
        }
      }

      var parts = [entete];
      var pi = 0;
      for(var mi=0; mi<morceaux.length; mi++){
        var m = morceaux[mi];
        var mFin = m.abs + m.b.size;
        if(mFin <= debutAbs) continue;
        var cur = Math.max(m.abs, debutAbs);
        while(cur < mFin){
          while(pi < patchs.length && patchs[pi].abs + patchs[pi].oct.length <= cur) pi++;
          var pch = (pi < patchs.length && patchs[pi].abs < mFin) ? patchs[pi] : null;
          if(!pch){
            parts.push(m.b.slice(cur - m.abs, mFin - m.abs));
            cur = mFin;
          } else {
            if(pch.abs > cur){ parts.push(m.b.slice(cur - m.abs, pch.abs - m.abs)); cur = pch.abs; }
            var pFin = Math.min(mFin, pch.abs + pch.oct.length);
            parts.push(pch.oct.subarray(cur - pch.abs, pFin - pch.abs));
            cur = pFin;
          }
        }
      }
      return parts;
    }

    function demarrer(flux){
      if(actif) return true;
      if(!type || !flux) return false;
      /* Même débit imposé que l'enregistrement direct : sans ça, la prise
         venue du tampon était encodée au débit par défaut du navigateur —
         mesuré à 3 Mbps sur du bruit en 720p — pendant que la prise normale,
         elle, aurait été correcte. La cadence d'images-clés est imposée dans
         le même geste (000ap) : chaque seconde sans image-clé est une seconde
         d'avant-geste que le fichier ne peut pas garantir. */
      var opt = { mimeType: type, videoKeyFrameIntervalDuration: 2000 };
      if(window.GBEncodage && opts.largeur && opts.hauteur){
        opt = GBEncodage.options(type, opts.largeur, opts.hauteur, opts.images || 30);
      }
      try{ rec = new MediaRecorder(flux, opt); }
      catch(e){ rec = null; return false; }
      entete = null; morceaux = []; octets = 0; garde = false; tGarde = 0;
      seqSuivant = 0; absTotal = 0; analyse = null; departGarde = null;
      fileParse = Promise.resolve();
      tDebut = performance.now();
      rec.ondataavailable = function(e){
        if(!e.data || !e.data.size) return;
        var m = { t: performance.now(), b: e.data, seq: seqSuivant++, abs: absTotal };
        absTotal += e.data.size;
        morceaux.push(m); octets += e.data.size;
        // en enregistrement, chaque morceau est aussitôt confié à la page :
        // c'est elle qui le met à l'abri, pour qu'une prise ne puisse plus se perdre
        if(garde && opts.onMorceau) try{ opts.onMorceau(e.data); }catch(err){}
        /* l'analyse est asynchrone (lecture du blob) mais strictement
           ordonnée ; elle ne retient que des positions, jamais les octets */
        fileParse = fileParse.then(function(){
          return m.b.arrayBuffer().then(function(ab){
            var u = new Uint8Array(ab);
            if(m.seq === 0){
              var pv = pisteVideoDe(u);
              analyse = (pv === null) ? { brut:true, surs:[], clusters:[], premierCluster:null }
                                      : creerAnalyseur(pv);
              if(pv === null) entete = m.b;    // audio pur : l'ancien recollage vaut
            }
            if(analyse.brut) return;
            analyse.feed(u);
            if(entete === null && analyse.premierCluster !== null){
              /* premier cluster au-delà du premier morceau (rarissime) :
                 l'en-tête est la concaténation des morceaux d'avant lui */
              var bouts = [];
              for(var i=0;i<morceaux.length;i++){
                var mm = morceaux[i];
                if(mm.abs >= analyse.premierCluster) break;
                bouts.push(mm.b.slice(0, Math.min(mm.b.size, analyse.premierCluster - mm.abs)));
              }
              entete = new Blob(bouts, {type:type});
            }
          });
        }).catch(function(){});
        elaguer();
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
      departGarde = choisirDepart(tGarde - sec*1000 - MARGE);
      /* le préroll annoncé est le préroll RÉEL : la prise remonte jusqu'à
         l'image-clé retenue, c'est-à-dire un peu PLUS loin que les N secondes
         demandées — l'horodatage du point sûr en fait foi */
      if(departGarde) prerollReel = Math.max(prerollReel, (tGarde - tDebut)/1000 - departGarde.tc/1000);
      /* ce qui est DÉJÀ en mémoire fait partie de la prise : on le confie
         tout de suite. Le filet de secours reçoit les octets BRUTS (mêmes
         octets que le flux — un fichier récupéré se décode, il démarre juste
         sur l'horodatage d'origine) ; la réécriture à zéro n'a lieu qu'à
         l'assemblage final, pour couvrir la prise ENTIÈRE d'un seul geste. */
      if(opts.onGarde){
        try{ opts.onGarde(fabriquer(tGarde - sec*1000 - MARGE, departGarde, false)); }catch(err){}
      }
      etat();
      return prerollReel;
    }
    function enGarde(){ return garde; }

    /* fin de prise : rend le fichier (départ sur image-clé + tout ce qui a
       suivi le déclenchement) */
    function terminer(){
      if(!actif) return Promise.resolve(null);
      finPromesse = new Promise(function(res){ finResoudre = res; });
      try{ rec.stop(); }catch(e){ if(finResoudre){ finResoudre(); finResoudre=null; } }
      var tFin = performance.now();
      return finPromesse.then(function(){ return fileParse; }).then(function(){
        actif = false;
        var depuis = (garde? tGarde : tFin) - sec*1000 - MARGE;
        /* le départ est CELUI choisi au déclenchement (le même que le filet
           de secours) ; l'analyse étant complète, la réécriture des
           horodatages couvre la prise entière */
        var parts = fabriquer(depuis, garde ? departGarde : null, true);
        var gardes = morceaux.filter(function(m){ return m.t >= depuis; });
        /* ── UN ASSEMBLAGE PEUT NE RETENIR AUCUN MORCEAU ──
           Le point de depart est choisi au declenchement, l'analyse EBML est
           asynchrone et l'elagage synchrone : selon le moment du geste, le
           depart retenu peut se trouver APRES tous les morceaux encore en
           memoire, et la boucle d'assemblage les saute tous. Il ne reste que
           l'en-tete : quelques centaines d'octets, aucun cluster. Ce fichier
           passe tous les controles de taille et s'ouvre sur un ecran noir
           muet, curseur bloque — le defaut observe le 29 aout.
           On le DIT desormais, au lieu de le sauver comme une prise reussie. */
        var utiles = 0;
        for(var u0=1; u0<parts.length; u0++)
          utiles += (parts[u0].size || parts[u0].byteLength || 0);
        var blob = new Blob(parts, {type:type});
        var duree = gardes.length ? (gardes[gardes.length-1].t - Math.max(depuis, tDebut))/1000 : 0;
        var r = { blob: blob, type: type, duree: Math.max(0, Math.round(duree)),
                  preroll: Math.round(prerollReel), morceaux: gardes.length,
                  octetsUtiles: utiles, vide: (utiles === 0) };
        entete = null; morceaux = []; octets = 0; garde = false; departGarde = null;
        etat();
        return r;
      });
    }

    /* on coupe sans rien garder : la mémoire est vidée, rien n'a jamais été écrit */
    function arreter(){
      if(!actif) return;
      actif = false; garde = false;
      try{ rec.stop(); }catch(e){}
      entete = null; morceaux = []; octets = 0; rec = null; departGarde = null;
      etat();
    }

    return { demarrer: demarrer, arreter: arreter, garder: garder, enGarde: enGarde,
             terminer: terminer, dispo: dispo, actif: function(){ return actif; },
             octets: function(){ return octets; }, secondes: function(){ return sec; },
             type: function(){ return type; } };
  }

  return { creer: creer, supporte: supporte, mime: mime };
})();
