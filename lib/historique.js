/* ═══════════════════════════════════════════════════════════════════════
   Historique des séances — chaque séance laisse sa fiche, même vide.

   Pourquoi : une veille de trois heures qui ne produit rien est un RÉSULTAT
   — c'est même le résultat normal — et elle ne laissait aucune trace nulle
   part. Impossible de dire « j'ai veillé ce lieu quatre soirs, rien n'est
   sorti », qui est pourtant la phrase la plus importante de ce loisir.

   Chaque séance ouvre une fiche dans la MÊME base que les enregistrements
   (ghostbox-vision / clips) : mode, lieu, début, événements au fil de l'eau,
   résumé à la fermeture. La fiche est écrite À CHAQUE événement, pas à la
   fin : une application tuée en pleine séance laisse quand même sa fiche,
   arrêtée au dernier événement — même principe que lib/secours.js, pour la
   même raison (ce qui a été vécu ne se refait pas).

   Usage :
     const H = GBHistorique.ouvrir({ mode:'le mur', lieu:'cave' });
     H.noter('mot', 'couloir · écart 9,1 σ');
     H.fermer({ mots:2, phrase:['froid','couloir'] });
   ═══════════════════════════════════════════════════════════════════════ */
window.GBHistorique = (function(){
  "use strict";

  function db(fn){
    try{
      var r = indexedDB.open('ghostbox-vision', 1);
      r.onupgradeneeded = function(){
        if(!r.result.objectStoreNames.contains('clips'))
          r.result.createObjectStore('clips', { keyPath:'id' });
      };
      r.onsuccess = function(){
        var d = r.result;
        // ── auto-réparation ── une base a pu naître SANS le magasin (une page
        // l'ouvrait autrefois sans le créer) : la version ne bougeant plus,
        // onupgradeneeded ne repassera jamais. Une base sans magasin est
        // forcément VIDE : on la supprime et on la recrée, toujours en v1 —
        // monter la version casserait toutes les autres pages, qui ouvrent en 1.
        if(!d.objectStoreNames.contains('clips')){
          d.close();
          var sup = indexedDB.deleteDatabase('ghostbox-vision');
          sup.onsuccess = sup.onerror = function(){
            var r2 = indexedDB.open('ghostbox-vision', 1);
            r2.onupgradeneeded = function(){ r2.result.createObjectStore('clips', { keyPath:'id' }); };
            r2.onsuccess = function(){ try{ fn(r2.result); }catch(e){} };
          };
          return;
        }
        try{ fn(d); }catch(e){}
      };
    }catch(e){}
  }

  function ouvrir(opts){
    opts = opts || {};
    var fiche = {
      id: Date.now(),
      type: 'seance',                        // ce que la bibliothèque filtre
      nom: 'seance-' + new Date().toISOString().slice(0,19).replace(/[:T]/g,'-'),
      mime: 'application/json', taille: 0, duree: 0, vignette: '',
      cam: opts.lieu || opts.mode || 'séance',
      mode: opts.mode || '?',
      debut: Date.now(), fin: null,
      evenements: [], resume: null, ouverte: true
    };
    var mort = false;
    var sillages = 0;
    var SILLAGES_MAX = 12;   // ~100 Ko de courbes au plus par fiche

    function ecrire(){
      if(mort) return;
      db(function(d){
        try{ d.transaction('clips','readwrite').objectStore('clips').put(fiche); }catch(e){}
      });
    }
    ecrire();

    return {
      /* un événement — écrit tout de suite : une fiche ne se perd pas.
         `extra` porte ce qui ne tient pas dans une phrase : le SILLAGE du mot
         (lib/sillage.js), c'est-à-dire les mesures d'avant et d'après. Une
         ligne de texte dit qu'un capteur a bougé ; seule la courbe montre la
         différence entre « le lieu respire » et « quelque chose est arrivé ». */
      noter: function(type, detail, extra){
        if(mort) return;
        var e = { t: Date.now(), type: String(type||''), detail: String(detail||'') };
        if(extra && extra.sillage){
          /* BORNE DE POIDS, et elle est dite : un sillage pèse ~8 Ko. Au-delà
             de SILLAGES_MAX, les mots suivants gardent toutes leurs mesures
             mais plus leur courbe — une fiche de séance ne doit pas grossir
             sans fin dans la base, et une troncature silencieuse serait pire
             que la troncature elle-même. */
          if(sillages < SILLAGES_MAX){ e.sillage = extra.sillage; sillages++; }
          else e.sillage_omis = true;
        }
        fiche.evenements.push(e);
        // borne large : une fiche n'est pas un journal système
        if(fiche.evenements.length > 400) fiche.evenements.splice(0, fiche.evenements.length - 400);
        ecrire();
      },
      /* la LIGNE DE VIE : un point par minute, du début à la fin. Elle existe
         surtout pour les séances SANS mot — trois heures de plat sont le
         résultat normal, et elles n'avaient aucune image pour se montrer. */
      vie: function(points){
        if(mort || !points) return;
        fiche.ligne_de_vie = points;
        ecrire();
      },
      fermer: function(resume){
        if(mort) return;
        fiche.fin = Date.now();
        fiche.duree = Math.round((fiche.fin - fiche.debut)/1000);
        fiche.resume = resume || null;
        fiche.ouverte = false;
        ecrire(); mort = true;
      },
      /* une séance sans AUCUN événement ni durée réelle (< 30 s) n'encombre
         pas la bibliothèque : on la retire au lieu de la fermer */
      jeter: function(){
        if(mort) return;
        mort = true;
        db(function(d){
          try{ d.transaction('clips','readwrite').objectStore('clips').delete(fiche.id); }catch(e){}
        });
      },
      id: fiche.id
    };
  }

  return { ouvrir: ouvrir };
})();
