/* ═══════════════════════════════════════════════════════════════════════
   Questions / réponses — le dialogue se mesure, il ne se décrète pas.

   Le geste du loisir : poser une question à voix haute et guetter ce qui
   sort. Sans protocole, N'IMPORTE QUEL mot sorti dans les minutes qui
   suivent semble répondre — le biais le plus banal du domaine. Ce module
   prolonge le témoin de bruit : au moment de la question, une FENÊTRE DE
   RÉPONSE de durée fixe s'ouvre ; pour chaque question, une FENÊTRE TÉMOIN
   de la même durée est placée plus tard, au hasard, sans le dire. À la fin,
   deux chiffres comparables : les mots sortis pendant les questions, les
   mots sortis pendant les fenêtres témoin. À nombre égal, rien au-dessus
   du hasard — et l'écran le dit.

   Trois règles de fond :
   — le module ne baisse AUCUN seuil et ne déclenche RIEN : il ne fait que
     CLASSER des mots que le moteur a retenus tout seul ;
   — la durée de fenêtre est FIXE et déclarée d'avance (20 s) : choisir sa
     fenêtre après coup, c'est choisir son résultat ;
   — une fenêtre témoin en cours ou à venir n'est JAMAIS montrée en direct
     (l'utilisateur se tairait pendant, et le témoin ne témoignerait plus
     de rien) : elle n'apparaît qu'une fois écoulée.

   Logique pure, aucun DOM : la page affiche, le module compte.

   Usage :
     const QR = GBQuestions.creer();
     QR.poser(performance.now())        → {ok:true, n:1} | {ok:false, motif}
     QR.evenement(now, 'couloir')       → {type:'reponse'|'temoin'|'hors', question}
     QR.stats(now)                      → compteurs affichables (témoins écoulés seulement)
     QR.journal(now)                    → tout, pour l'export et les conditions
   ═══════════════════════════════════════════════════════════════════════ */
window.GBQuestions = (function(){
  "use strict";

  var DUREE      = 20000;   // fenêtre de réponse : fixe, déclarée d'avance
  var TEMOIN_MIN = 15000;   // le témoin se place entre 15 s et 90 s
  var TEMOIN_MAX = 90000;   //   après la fin de la fenêtre de réponse

  function creer(opts){
    opts = opts || {};
    var duree = opts.duree || DUREE;
    var qs = [];            // une entrée par question
    var hors = 0;           // mots retenus hors de toute fenêtre

    function chevauche(a0, a1, b0, b1){ return a0 < b1 && b0 < a1; }

    /* place la fenêtre témoin d'une question : après sa fenêtre de réponse,
       à un délai aléatoire, sans chevaucher aucune fenêtre déjà posée */
    function placerTemoin(q){
      var t0 = q.finR + TEMOIN_MIN + Math.random() * (TEMOIN_MAX - TEMOIN_MIN);
      for(var garde = 0; garde < 20; garde++){
        var conflit = false;
        for(var i = 0; i < qs.length; i++){
          var o = qs[i];
          if(chevauche(t0, t0 + duree, o.t, o.finR)) { conflit = true; t0 = o.finR + 1000 + Math.random() * TEMOIN_MIN; }
          if(o !== q && o.temoin0 != null &&
             chevauche(t0, t0 + duree, o.temoin0, o.temoin0 + duree)) { conflit = true; t0 = o.temoin0 + duree + 1000; }
        }
        if(!conflit) break;
      }
      q.temoin0 = t0;
    }

    function poser(now){
      for(var i = 0; i < qs.length; i++){
        if(now >= qs[i].t && now < qs[i].finR)
          return { ok:false, motif:'une fenêtre de réponse est déjà ouverte' };
      }
      var q = { n: qs.length + 1, t: now, finR: now + duree,
                temoin0: null, reportes: 0, reponses: [], temoins: [] };
      // une fenêtre témoin pas encore écoulée que la nouvelle question
      // recouvrirait est REPORTÉE : la réponse prime, et c'est journalisé
      for(var j = 0; j < qs.length; j++){
        var o = qs[j];
        if(o.temoin0 != null && o.temoin0 + duree > now &&
           chevauche(o.temoin0, o.temoin0 + duree, q.t, q.finR)){
          o.reportes++; o.temoins = []; placerTemoin(o);
        }
      }
      placerTemoin(q);
      qs.push(q);
      return { ok:true, n:q.n };
    }

    /* classe un mot que le MOTEUR a retenu — le module ne déclenche rien */
    function evenement(now, mot){
      for(var i = qs.length - 1; i >= 0; i--){
        var q = qs[i];
        if(now >= q.t && now < q.finR){ q.reponses.push(String(mot||'')); return { type:'reponse', question:q.n }; }
      }
      for(var j = qs.length - 1; j >= 0; j--){
        var o = qs[j];
        if(o.temoin0 != null && now >= o.temoin0 && now < o.temoin0 + duree){
          o.temoins.push(String(mot||'')); return { type:'temoin', question:o.n };
        }
      }
      hors++;
      return { type:'hors', question:null };
    }

    /* les compteurs affichables EN DIRECT : les fenêtres témoin en cours ou
       à venir n'y figurent pas — elles n'existent qu'une fois écoulées */
    function stats(now){
      var rep = 0, tem = 0, temEcoules = 0, ouverte = null;
      for(var i = 0; i < qs.length; i++){
        var q = qs[i];
        rep += q.reponses.length;
        if(now >= q.t && now < q.finR) ouverte = { question:q.n, reste_ms: Math.max(0, q.finR - now) };
        if(q.temoin0 != null && now >= q.temoin0 + duree){ temEcoules++; tem += q.temoins.length; }
      }
      return { questions: qs.length, reponses: rep,
               temoins: tem, temoins_ecoules: temEcoules,
               hors: hors, fenetre_ms: duree, ouverte: ouverte };
    }

    /* tout, pour l'export et les conditions embarquées — appelé à la fin,
       quand montrer l'emplacement des témoins ne fausse plus rien */
    function journal(now){
      return qs.map(function(q){
        var ecoule = q.temoin0 != null && now >= q.temoin0 + duree;
        return { n: q.n, t_ms: Math.round(q.t),
                 reponses: q.reponses.slice(),
                 temoin: ecoule ? q.temoins.slice() : null,
                 temoin_decalage_ms: ecoule ? Math.round(q.temoin0 - q.finR) : null,
                 temoin_ecoule: ecoule, temoin_reporte: q.reportes };
      });
    }

    return { poser: poser, evenement: evenement, stats: stats,
             journal: journal, fenetre_ms: duree };
  }

  return { creer: creer, DUREE: DUREE };
})();
