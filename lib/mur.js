/* ═══════════════════════════════════════════════════════════════════════
   Mur de mots — composant UNIQUE, affichable dans n'importe quel mode.

   Pourquoi il existe : un lexique rangé dans un fichier ne se propose à
   personne. Ici les mots sont MONTRÉS, tout le temps, rangés par famille,
   et une case de lecture les parcourt sans arrêt. Quand une mesure dépasse
   le seuil, le mur se fige à cet instant et le mot qui se trouvait dans la
   case est retenu — c'est l'instant qui désigne, rien d'autre.

   ── Le rendu est en CANVAS, et c'est voulu ──
   La première version dessinait des <div> : impossible d'avoir des traînées,
   un halo, une luminosité qui varie le long de la colonne, et surtout le CSS
   de la page d'accueil pouvait écraser celui du mur (c'est arrivé : une classe
   `.strip` de la page Écoute rendait toutes les cases invisibles). Un canvas
   ne dépend de rien : ce qui est dessiné est dessiné.

   ── Équité, et c'est un principe, pas un détail ──
   Si chaque colonne gardait sa vitesse, ce seraient toujours les mêmes mots
   qui passeraient vite. Les allures TOURNENT entre les colonnes à intervalle
   régulier : chaque famille passe le même temps à chaque vitesse. `equite()`
   compte combien de fois chaque colonne a été retenue.

   ── La phrase ──
   Les mots retenus s'accumulent dans l'ordre où ils sont sortis. L'appareil
   n'ajoute AUCUN mot, n'en réordonne aucun, ne conjugue rien, ne met ni
   article ni liaison : ce n'est pas une phrase fabriquée, c'est la suite
   exacte de ce qui a été retenu. Le sens, s'il y en a un, ne vient pas d'ici.

   Usage :
     const M = GBMur.creer({ hote: document.getElementById('mur'), mots });
     M.demarrer();
     const choix = M.figer('écart 9,2 σ');   // → {mot, colonne, index, ...}
     M.phrase();                              // → ['froid','couloir','enfant']
   ═══════════════════════════════════════════════════════════════════════ */
window.GBMur = (function(){
  "use strict";

  /* familles : ce qui est proposé doit être lisible d'un coup d'œil */
  var FAMILLES = [
    { t:'réponses',      pos:['REPONSE','NOMBRE'] },
    { t:'personnes',     pos:['PRENOM'], cat:['personne'] },
    { t:'lieux',         pos:['LIEU'] },
    { t:'actions',       pos:['VERBE','VERBE3','IMPER'] },
    { t:'états · temps', pos:['ADJ','TEMPS','ADV','NOM','PREP'] }
  ];
  var ROW = 30;             // hauteur d'une case, en pixels logiques
  var DWELL = 420;          // temps passé par la case de lecture sur une colonne
  var ROTATION = 20000;     // les vitesses tournent d'un cran toutes les 20 s
  var ALLURES = [0.70, 0.85, 1.00, 1.18, 1.35];
  var GEL_MS = 7000;

  function creer(opts){
    opts = opts || {};
    var hote = opts.hote;
    var mots = opts.mots || [];
    if(!hote || !mots.length) return null;

    /* graine de session : le défilement est reproductible, donc vérifiable */
    var graine = (opts.graine || ((Date.now() ^ ((Math.random()*4294967296)>>>0)) >>> 0)) >>> 0;
    var s = graine || 1;
    function rnd(){ s ^= s<<13; s >>>= 0; s ^= s>>17; s ^= s<<5; s >>>= 0; return s/4294967296; }
    function melange(a){ var b=a.slice(), i, j, t;
      for(i=b.length-1;i>0;i--){ j=(rnd()*(i+1))|0; t=b[i]; b[i]=b[j]; b[j]=t; } return b; }

    /* répartition en familles — aucun mot n'est écarté */
    var pris = {}, listes = [];
    FAMILLES.forEach(function(f){
      var l = [];
      mots.forEach(function(w,i){
        if(pris[i]) return;
        var ok = (f.pos && f.pos.indexOf(w.pos) >= 0) || (f.cat && w.cat && f.cat.indexOf(w.cat) >= 0);
        if(ok){ pris[i]=1; l.push(w.mot); }
      });
      listes.push(l);
    });
    mots.forEach(function(w,i){ if(!pris[i]) listes[listes.length-1].push(w.mot); });

    /* le canvas remplace tout le contenu de l'hôte : rien d'autre à styler */
    hote.innerHTML = '';
    // AUCUN style de position posé en ligne : le canvas n'a pas d'enfant
    // absolu, donc l'hôte n'a besoin de rien — et un style en ligne écraserait
    // la mise en page de la page (l'écran fixe ne pouvait plus poser le mur en
    // bas de l'écran, il remontait sous le bandeau).
    hote.style.background = '#03070A';
    hote.style.overflow = 'hidden';
    var cv = document.createElement('canvas');
    cv.style.cssText = 'display:block;width:100%;height:100%';
    hote.appendChild(cv);
    var g = cv.getContext('2d');

    var cols = listes.map(function(l){
      return { liste: melange(l), off: rnd()*l.length*ROW, allure: 1, retenus: 0 };
    });

    var vitesse = opts.vitesse || 330;
    var actif = false, fige = false, tFige = 0, lastT = 0, raf = 0;
    var t0 = performance.now(), crans = -1, dernier = null, retenus = [];
    var W = 0, H = 0, dpr = 1, colW = 0, infoGel = '', testGel = false;

    function taille(){
      var r = hote.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(120, Math.round(r.width));
      H = Math.max(120, Math.round(r.height));
      cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr);
      g.setTransform(dpr,0,0,dpr,0,0);
      colW = W / cols.length;
      g.fillStyle = '#03070A'; g.fillRect(0,0,W,H);
    }

    /* ── équité : les vitesses tournent d'une colonne à l'autre ── */
    function allures(now){
      var cran = Math.floor((now - t0) / ROTATION);
      if(cran !== crans){
        crans = cran;
        for(var i=0;i<cols.length;i++) cols[i].allure = ALLURES[(i + crans) % ALLURES.length];
      }
    }
    function colCourante(t){ return Math.floor(t/DWELL) % cols.length; }
    function motLu(ci){
      var c = cols[ci], n = c.liste.length, cycle = n*ROW;
      var idx = Math.floor(((((c.off % cycle) + cycle) % cycle) + H/2) / ROW) % n;
      return { idx: idx, mot: c.liste[idx] };
    }

    /* ═══════ dessin ═══════ */
    var POLICE = '"IBM Plex Mono",ui-monospace,monospace';
    function dessiner(now){
      // traînée : on n'efface jamais complètement, ce qui laisse une rémanence
      g.fillStyle = 'rgba(3,7,10,0.34)';
      g.fillRect(0,0,W,H);

      var mid = H/2, ciCur = colCourante(now);
      g.textAlign = 'center'; g.textBaseline = 'middle';

      for(var i=0;i<cols.length;i++){
        var c = cols[i], n = c.liste.length, cycle = n*ROW;
        var off = ((c.off % cycle) + cycle) % cycle;
        var x = i*colW + colW/2;
        var premier = Math.floor(off/ROW);
        var y0 = -(off % ROW);
        for(var k=0; y0 + k*ROW < H + ROW; k++){
          var y = y0 + k*ROW + ROW/2;
          if(y < -ROW || y > H+ROW) continue;
          var mot = c.liste[(premier + k) % n];
          // la lumière vient de la ligne de lecture : plus on s'en éloigne, plus on s'efface
          var d = Math.abs(y - mid) / (H*0.5);
          var a = Math.max(0.10, 1 - d*d*1.25);
          var pres = d < 0.06;
          var taillePolice = mot.length > 9 ? Math.max(9, Math.round(13*9/mot.length)) : 13;
          g.font = (pres? '600 ' : '') + taillePolice + 'px ' + POLICE;
          if(pres){
            g.shadowColor = 'rgba(120,255,205,.9)'; g.shadowBlur = 12;
            g.fillStyle = 'rgba(226,255,243,' + a.toFixed(3) + ')';
          } else {
            g.shadowBlur = 0;
            g.fillStyle = 'rgba(60,220,160,' + (a*0.85).toFixed(3) + ')';
          }
          g.fillText(mot, x, y);
        }
        g.shadowBlur = 0;
        // séparation discrète entre les familles
        if(i){ g.fillStyle='rgba(60,220,160,.10)'; g.fillRect(i*colW, 0, 1, H); }
      }

      // ── faisceau de lecture ──
      var grd = g.createLinearGradient(0, mid-ROW, 0, mid+ROW);
      grd.addColorStop(0,'rgba(95,211,166,0)');
      grd.addColorStop(.5,'rgba(95,211,166,.16)');
      grd.addColorStop(1,'rgba(95,211,166,0)');
      g.fillStyle = grd; g.fillRect(0, mid-ROW, W, ROW*2);
      g.fillStyle = 'rgba(150,255,215,.55)'; g.fillRect(0, mid-ROW/2, W, 1);
      g.fillRect(0, mid+ROW/2, W, 1);

      // ── case de lecture : elle parcourt les colonnes sans arrêt ──
      g.save();
      g.strokeStyle = 'rgba(160,255,220,.95)'; g.lineWidth = 1.5;
      g.shadowColor = 'rgba(95,211,166,.8)'; g.shadowBlur = 14;
      g.strokeRect(ciCur*colW + 3, mid - ROW/2, colW - 6, ROW);
      g.restore();

      // ── en-têtes de famille ──
      var grh = g.createLinearGradient(0,0,0,26);
      grh.addColorStop(0,'rgba(3,7,10,.96)'); grh.addColorStop(1,'rgba(3,7,10,0)');
      g.fillStyle = grh; g.fillRect(0,0,W,26);
      g.font = '600 9px ' + POLICE; g.fillStyle = 'rgba(95,211,166,.55)';
      for(var j=0;j<cols.length;j++) g.fillText(FAMILLES[j].t.toUpperCase(), j*colW + colW/2, 11);

      // ── vignettage : l'attention va au centre ──
      var vg = g.createRadialGradient(W/2, mid, Math.min(W,H)*0.25, W/2, mid, Math.max(W,H)*0.75);
      vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,.55)');
      g.fillStyle = vg; g.fillRect(0,0,W,H);

      if(fige) voile(now);
    }

    /* le mot retenu : il occupe tout, quelques secondes */
    function voile(now){
      var age = now - tFige, k = Math.min(1, age/220);
      g.fillStyle = 'rgba(3,7,10,' + (0.78*k).toFixed(3) + ')';
      g.fillRect(0,0,W,H);
      var mot = dernier ? dernier.mot : '';
      var taille = Math.min(W/Math.max(4,mot.length) * 1.5, H*0.30);
      g.textAlign='center'; g.textBaseline='middle';
      g.save();
      g.shadowColor = testGel ? 'rgba(226,87,76,.9)' : 'rgba(233,180,76,.85)';
      g.shadowBlur = 26 + 10*Math.sin(age/220);
      g.fillStyle = testGel ? '#E2574C' : '#F3D48A';
      g.font = '600 ' + Math.round(taille) + 'px "Barlow Condensed","Arial Narrow",sans-serif';
      g.fillText(mot.toUpperCase(), W/2, H*0.44);
      g.restore();
      g.font = '11px ' + POLICE;
      g.fillStyle = testGel ? 'rgba(226,87,76,.95)' : 'rgba(207,198,180,.9)';
      var lignes = (testGel
        ? ['ESSAI — figé à la main pour montrer le mécanisme','aucune mesure derrière ce mot']
        : String(infoGel||'').split(' · '));
      for(var i=0;i<lignes.length && i<3;i++) g.fillText(lignes[i], W/2, H*0.44 + taille*0.62 + i*15);
    }

    function boucle(){
      if(!actif) return;
      var t = performance.now(), dt = Math.min(60, t - (lastT || t)); lastT = t;
      if(!fige){
        allures(t);
        for(var i=0;i<cols.length;i++){
          var c = cols[i], cycle = c.liste.length*ROW;
          c.off = (c.off + vitesse*c.allure*dt/1000) % cycle;
        }
      } else if(t - tFige > GEL_MS){ degeler(); }
      dessiner(t);
      raf = requestAnimationFrame(boucle);
    }

    function demarrer(){ if(actif) return; actif = true; lastT = 0; taille(); boucle(); }
    function arreter(){ actif = false; if(raf) cancelAnimationFrame(raf); raf = 0; }
    function degeler(){ fige = false; if(opts.onDegel) opts.onDegel(); }

    /* c'est l'instant qui désigne le mot */
    function figer(info, test){
      if(fige || !cols.length) return null;
      var now = performance.now();
      var ci = colCourante(now), lu = motLu(ci), c = cols[ci];
      fige = true; tFige = now; infoGel = info || ''; testGel = !!test;
      if(!test) c.retenus++;
      dernier = { mot: lu.mot, index: lu.idx, colonne: FAMILLES[ci].t, ci: ci,
                  taille: c.liste.length, allure: +c.allure.toFixed(2), vitesse: vitesse,
                  decalage: Math.round(c.off), test: !!test, t: Date.now() };
      // ── la phrase : la suite EXACTE des mots retenus, rien d'ajouté ──
      if(!test) retenus.push({ mot: lu.mot, colonne: FAMILLES[ci].t, t: Date.now(), info: info||'' });
      if(navigator.vibrate && !test) navigator.vibrate(80);
      if(opts.onMot && !test) try{ opts.onMot(dernier, retenus.slice()); }catch(e){}
      return dernier;
    }

    function equite(){
      return cols.map(function(c,i){
        return { famille: FAMILLES[i].t, mots: c.liste.length,
                 allure_actuelle: +c.allure.toFixed(2), retenus: c.retenus };
      });
    }

    addEventListener('resize', function(){ if(actif) taille(); });
    taille();

    return { demarrer: demarrer, arreter: arreter, figer: figer, degeler: degeler,
             estFige: function(){ return fige; }, dernier: function(){ return dernier; },
             vitesse: function(v){ if(v) vitesse = v; return vitesse; },
             placer: taille, equite: equite, graine: graine,
             phrase: function(){ return retenus.map(function(r){ return r.mot; }); },
             retenus: function(){ return retenus.slice(); },
             effacerPhrase: function(){ retenus = []; },
             colonnes: function(){ return cols.map(function(c,i){
               return { famille: FAMILLES[i].t, mots: c.liste.length }; }); },
             rotation_ms: ROTATION };
  }

  /* charge le lexique une seule fois pour toute la page */
  var enCours = null, cache = null;
  function lexique(url){
    if(cache) return Promise.resolve(cache);
    if(enCours) return enCours;
    enCours = fetch(url || '/ghost-box/data/lexique.json').then(function(r){ return r.json(); })
      .then(function(j){
        var m = (j && j.mots) ? j.mots : (Array.isArray(j) ? j : []);
        cache = m.map(function(x){ return { mot:x.mot, pos:x.pos, cat:x.categorie||'', poids:x.poids||1 }; });
        return cache;
      });
    return enCours;
  }

  return { creer: creer, lexique: lexique, FAMILLES: FAMILLES, ROW: ROW, DWELL: DWELL };
})();
