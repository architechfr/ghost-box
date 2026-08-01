/* ═══════════════════════════════════════════════════════════════════════
   Mur de mots — composant UNIQUE, affichable dans n'importe quel mode.

   Pourquoi il existe : un lexique rangé dans un fichier ne se propose à
   personne. Ici les mots sont MONTRÉS, tout le temps, rangés par famille,
   et une case de lecture les parcourt sans arrêt. Quand une mesure dépasse
   le seuil, le mur se fige à cet instant et le mot qui se trouvait dans la
   case est retenu — c'est l'instant qui désigne, rien d'autre.

   ── Équité, et c'est un principe, pas un détail ──
   Si chaque colonne gardait sa vitesse, ce seraient toujours les mêmes mots
   qui passeraient vite, et toujours les mêmes qui traîneraient sous la case
   de lecture. Alors les vitesses TOURNENT entre les colonnes à intervalle
   régulier : chaque famille passe le même temps à chaque vitesse. Et le
   décalage de départ de chaque colonne n'a aucun rapport avec le contenu.
   Aucun mot n'est favorisé, et ça se vérifie : `equite()` compte combien de
   fois chaque colonne a été retenue et à quelle vitesse elle tournait.

   Usage :
     const M = GBMur.creer({ hote: document.getElementById('mur'), mots });
     M.demarrer();
     const choix = M.figer('écart 9,2 σ');   // → {mot, colonne, index, ...}
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
  var ROW = 30;             // hauteur d'une case, en pixels
  var DWELL = 420;          // temps passé par la case de lecture sur une colonne
  var ROTATION = 20000;     // les vitesses tournent d'un cran toutes les 20 s
  var ALLURES = [0.70, 0.85, 1.00, 1.18, 1.35];
  var GEL_MS = 6000;

  var cssPose = false;
  function css(){
    if(cssPose) return; cssPose = true;
    var st = document.createElement('style');
    st.textContent =
      '.gbmur{position:relative;overflow:hidden;background:#05090B;display:flex}' +
      '.gbmur .col{flex:1;position:relative;overflow:hidden;border-right:1px solid #212B31}' +
      '.gbmur .col:last-child{border-right:0}' +
      '.gbmur .colhd{position:absolute;top:0;left:0;right:0;z-index:3;text-align:center;' +
      'font-family:"Barlow Condensed","Arial Narrow",sans-serif;text-transform:uppercase;' +
      'letter-spacing:.12em;font-size:9.5px;color:#78868E;padding:4px 0 10px;' +
      'background:linear-gradient(180deg,rgba(5,9,11,.97),rgba(5,9,11,0))}' +
      '.gbmur .strip{position:absolute;left:0;right:0;top:0;will-change:transform}' +
      '.gbmur .cell{height:' + ROW + 'px;line-height:' + ROW + 'px;text-align:center;' +
      'font-family:"IBM Plex Sans",system-ui,sans-serif;font-size:14px;color:#8FA0A9;' +
      'white-space:nowrap;overflow:hidden}' +
      '.gbmur .cell.hit{color:#0A0F12;background:#E9B44C;font-weight:600}' +
      '.gbmur .ligne{position:absolute;left:0;right:0;top:50%;height:' + ROW + 'px;' +
      'transform:translateY(-' + (ROW/2) + 'px);z-index:2;pointer-events:none;' +
      'border-top:1px solid rgba(95,211,166,.55);border-bottom:1px solid rgba(95,211,166,.55);' +
      'background:rgba(95,211,166,.07)}' +
      '.gbmur .curseur{position:absolute;top:50%;height:' + ROW + 'px;' +
      'transform:translateY(-' + (ROW/2) + 'px);z-index:2;pointer-events:none;' +
      'border:2px solid #5FD3A6;border-radius:2px;box-shadow:0 0 12px rgba(95,211,166,.35);' +
      'transition:left .06s linear}' +
      '.gbmur .gel{position:absolute;inset:0;z-index:4;display:none;align-items:center;' +
      'justify-content:center;background:rgba(5,9,11,.72);text-align:center;padding:16px}' +
      '.gbmur .gel.on{display:flex}' +
      '.gbmur .gelmot{font-family:"Barlow Condensed","Arial Narrow",sans-serif;' +
      'text-transform:uppercase;letter-spacing:.06em;font-size:clamp(30px,11vw,80px);' +
      'line-height:1;color:#E9B44C;font-weight:600}' +
      '.gbmur .gelsub{font-family:ui-monospace,monospace;font-size:11.5px;color:#CFC6B4;' +
      'margin-top:10px;line-height:1.5}' +
      '.gbmur .gel.test .gelmot,.gbmur .gel.test .gelsub{color:#E2574C}';
    document.head.appendChild(st);
  }

  function creer(opts){
    opts = opts || {};
    var hote = opts.hote;
    var mots = opts.mots || [];
    if(!hote || !mots.length) return null;
    css();

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
        if(ok){ pris[i]=1; l.push(w); }
      });
      listes.push(l);
    });
    mots.forEach(function(w,i){ if(!pris[i]) listes[listes.length-1].push(w); });

    hote.classList.add('gbmur');
    hote.innerHTML = '';
    var cols = [];
    listes.forEach(function(l, ci){
      var liste = melange(l);
      var d = document.createElement('div'); d.className='col';
      var h = document.createElement('div'); h.className='colhd'; h.textContent = FAMILLES[ci].t+' · '+liste.length;
      var st = document.createElement('div'); st.className='strip';
      // la liste est écrite deux fois : le défilement boucle sans coupure visible
      for(var k=0;k<2;k++) liste.forEach(function(w){
        var c=document.createElement('div'); c.className='cell'; c.textContent=w.mot; st.appendChild(c);
      });
      d.appendChild(h); d.appendChild(st); hote.appendChild(d);
      cols.push({ liste: liste, strip: st, off: rnd()*liste.length*ROW, allure: 1, retenus: 0 });
    });
    var ligne = document.createElement('div'); ligne.className='ligne';
    var curseur = document.createElement('div'); curseur.className='curseur';
    var gel = document.createElement('div'); gel.className='gel';
    var gelMot = document.createElement('div'); gelMot.className='gelmot'; gelMot.textContent='—';
    var gelSub = document.createElement('div'); gelSub.className='gelsub';
    var boite = document.createElement('div'); boite.appendChild(gelMot); boite.appendChild(gelSub);
    gel.appendChild(boite);
    hote.appendChild(ligne); hote.appendChild(curseur); hote.appendChild(gel);

    var vitesse = opts.vitesse || 330;
    var actif = false, fige = false, tFige = 0, lastT = 0, raf = 0;
    var t0 = performance.now(), crans = 0, dernier = null;

    /* ── équité : les vitesses tournent d'une colonne à l'autre ──
       Sans ça, la même famille serait toujours la plus rapide et les mêmes
       mots passeraient toujours en coup de vent. */
    function allures(now){
      var cran = Math.floor((now - t0) / ROTATION);
      if(cran !== crans){ crans = cran; }
      for(var i=0;i<cols.length;i++) cols[i].allure = ALLURES[(i + crans) % ALLURES.length];
    }
    function colCourante(t){ return cols.length ? (Math.floor(t/DWELL) % cols.length) : 0; }
    function placer(){
      if(!cols.length) return;
      curseur.style.width = (hote.clientWidth/cols.length - 4) + 'px';
    }
    function motLu(ci){
      var c = cols[ci], n = c.liste.length, cycle = n*ROW;
      var idx = Math.floor(((((c.off % cycle) + cycle) % cycle) + hote.clientHeight/2) / ROW) % n;
      return { idx: idx, mot: c.liste[idx].mot };
    }

    function boucle(){
      if(!actif) return;
      var t = performance.now(), dt = Math.min(60, t - (lastT || t)); lastT = t;
      if(!fige){
        allures(t);
        for(var i=0;i<cols.length;i++){
          var c = cols[i], cycle = c.liste.length*ROW;
          c.off = (c.off + vitesse*c.allure*dt/1000) % cycle;
          c.strip.style.transform = 'translateY(' + (-c.off) + 'px)';
        }
        var ci = colCourante(t), w = hote.clientWidth/cols.length;
        curseur.style.left = (ci*w + 2) + 'px';
      } else if(t - tFige > GEL_MS){ degeler(); }
      raf = requestAnimationFrame(boucle);
    }

    function demarrer(){ if(actif) return; actif = true; lastT = 0; placer(); boucle(); }
    function arreter(){ actif = false; if(raf) cancelAnimationFrame(raf); raf = 0; }

    function degeler(){
      fige = false; gel.className = 'gel';
      var h = hote.querySelectorAll('.cell.hit');
      for(var i=0;i<h.length;i++) h[i].classList.remove('hit');
      if(opts.onDegel) opts.onDegel();
    }

    /* c'est l'instant qui désigne le mot */
    function figer(info, test){
      if(fige || !cols.length) return null;
      var now = performance.now();
      var ci = colCourante(now), lu = motLu(ci), c = cols[ci], n = c.liste.length;
      fige = true; tFige = now;
      if(c.strip.children[lu.idx]) c.strip.children[lu.idx].classList.add('hit');
      if(c.strip.children[lu.idx+n]) c.strip.children[lu.idx+n].classList.add('hit');
      gelMot.textContent = lu.mot;
      gelSub.innerHTML = test
        ? 'ESSAI — figé à la main pour montrer le mécanisme.<br>Aucune mesure derrière ce mot.'
        : String(info || '');
      gel.className = 'gel on' + (test ? ' test' : '');
      if(!test) c.retenus++;
      dernier = { mot: lu.mot, index: lu.idx, colonne: FAMILLES[ci].t, ci: ci,
                  taille: n, allure: +c.allure.toFixed(2), vitesse: vitesse,
                  decalage: Math.round(c.off), test: !!test };
      if(navigator.vibrate && !test) navigator.vibrate(80);
      return dernier;
    }

    /* de quoi vérifier qu'aucune famille n'est favorisée */
    function equite(){
      return cols.map(function(c,i){
        return { famille: FAMILLES[i].t, mots: c.liste.length,
                 allure_actuelle: +c.allure.toFixed(2), retenus: c.retenus };
      });
    }

    addEventListener('resize', placer);
    placer();

    return { demarrer: demarrer, arreter: arreter, figer: figer, degeler: degeler,
             estFige: function(){ return fige; }, dernier: function(){ return dernier; },
             vitesse: function(v){ if(v) vitesse = v; return vitesse; },
             placer: placer, equite: equite, graine: graine,
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
