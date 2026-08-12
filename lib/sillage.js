/* ═══════════════════════════════════════════════════════════════════════
   Le sillage — ce qu'une mesure faisait AVANT et APRÈS le mot.

   POURQUOI CE MODULE EXISTE
   Retour de l'utilisateur, et il est juste : « j'ai le mot cuisine, j'ai des
   infos disant qu'un capteur a détecté quelque chose, mais ce n'est pas
   parlant. J'ai l'heure, je n'ai pas l'équivalent d'un graphe de variation
   qui aiderait à saisir la différence entre le normal — il ne se passe rien —
   et hop, un pic. » L'appareil ne conservait qu'UN point par mot : la valeur
   de l'instant du tir. Un point ne raconte rien ; c'est la ligne plate qui
   le précède qui donne son sens au pic.

   CE QU'IL FAIT, ET CE QU'IL S'INTERDIT
   Même principe que la mémoire tampon vidéo (règle 8ter) : chaque voie garde
   en mémoire vive ses N dernières secondes, RIEN n'est écrit tant que rien
   ne sort, et au moment du tir cette fenêtre-là est figée et voyage avec le
   mot. Le tracé ne montre que des points RÉELLEMENT mesurés, reliés par des
   segments droits : aucun lissage, aucune interpolation, aucune courbe
   « jolie » — sur cet appareil, embellir une mesure serait l'inventer.

   DEUX VUES, ET ELLES NE DISENT PAS LA MÊME CHOSE
   — le GROS PLAN (dessiner) : la fenêtre autour d'un mot, à la mesure près.
     Le repère est l'instant d'ATTAQUE, pas celui de la confirmation, qui
     arrive quatre relevés plus tard (règle 8bis-d).
   — la LIGNE DE VIE (vie) : toute la séance, un point par minute. C'est un
     AGRÉGAT, et l'écran doit le dire. Elle existe surtout pour les séances
     SANS mot : trois heures de plat sont le résultat normal (règle 8sexies),
     et elles n'avaient aucune image pour se montrer.

   Aucun style de position posé, classes préfixées, le module impose ce dont
   il dépend (règle du composant partagé).
   ═══════════════════════════════════════════════════════════════════════ */
window.GBSillage = (function(){
  "use strict";

  var HZ = 10;          // le pas des pages : setTimeout(mesure, 100)
  var AVANT = 40;       // secondes gardées avant l'attaque
  /* 15 s après, et non 8 : mesuré au rendu, une fenêtre 45/8 colle le pic
     contre le bord droit et écrase la retombée — or la retombée fait partie
     de la preuve (un événement qui monte et redescend n'est pas une dérive). */
  var APRES = 15;
  var DECIM = 5;        // voies muettes : un point sur cinq (elles servent à montrer un plat)

  var C = { fond:'#0A0F12', grille:'#1B2429', dim:'#78868E', creme:'#D8CBAA',
            or:'#E9B44C', signal:'#5FD3A6', alerte:'#E2685F' };

  /* ── COLLECTE ─────────────────────────────────────────────────────────
     Un tampon circulaire par voie. Coût : (40+15) × 10 = 550 relevés de trois
     nombres — quelques dizaines de kilo-octets en mémoire vive pour toute la
     séance, et rien sur le disque tant qu'aucun mot ne sort. */
  function banc(opts){
    opts = opts || {};
    var n = Math.round(((opts.avant || AVANT) + (opts.apres || APRES)) * (opts.hz || HZ));
    var B = {}, ordre = [];

    return {
      /* une mesure, à chaque tour de boucle de la page */
      pousser: function(code, label, brut, sigma, seuil, unite){
        var b = B[code];
        if(!b){ b = B[code] = { label:label||code, unite:unite||'', pts:[] }; ordre.push(code); }
        b.label = label || b.label; if(unite) b.unite = unite;
        b.pts.push([+(+brut).toFixed(3), +(+sigma).toFixed(2), +(+seuil).toFixed(2)]);
        if(b.pts.length > n) b.pts.shift();
      },
      /* le tir : la fenêtre est figée telle qu'elle est, pour TOUTES les voies.
         Les voies muettes comptent autant que la tireuse — c'est en les voyant
         plates qu'on distingue un événement d'un défaut d'électronique. */
      figer: function(code){
        return { hz:opts.hz || HZ, avant_s:opts.avant || AVANT, apres_s:opts.apres || APRES,
          tireuse:code,
          voies: ordre.map(function(c){
            var b = B[c], t = (c === code), pas = t ? 1 : DECIM;
            var brut = [], sigma = [], seuil = [];
            for(var i=0; i<b.pts.length; i+=pas){
              var p = b.pts[i];
              if(t) brut.push(p[0]);            // la brute n'est gardée que pour la tireuse :
              sigma.push(p[1]);                 // c'est elle qu'on doit pouvoir refaire à la main
              if(!seuil.length || seuil[seuil.length-1][1] !== p[2]) seuil.push([sigma.length-1, p[2]]);
            }
            return { code:c, label:b.label, unite:b.unite, tireuse:t,
                     hz:(opts.hz || HZ)/pas, brut:t?brut:null, sigma:sigma, seuil:seuil };
          }) };
      },
      /* combien de secondes de sillage sont déjà en mémoire (pour l'écran) */
      pret: function(code){ var b = B[code]; return b ? b.pts.length / (opts.hz || HZ) : 0; }
    };
  }

  /* ── LIGNE DE VIE ─────────────────────────────────────────────────────
     Un point par minute : le σ le plus fort atteint, toutes voies confondues,
     et le seuil moyen exigé pendant cette minute-là. Deux nombres la minute,
     soit 2 Ko pour une veille de trois heures. */
  function vieCollecteur(){
    var pts = [], smax = 0, sSeuil = 0, n = 0, t0 = 0;
    return {
      pousser: function(sigma, seuil){
        if(sigma > smax) smax = sigma;
        sSeuil += seuil; n++;
      },
      /* à appeler une fois par minute — la page a déjà une horloge, on ne
         lui en impose pas une seconde */
      minute: function(){
        pts.push([+smax.toFixed(2), +(sSeuil/Math.max(1,n)).toFixed(2)]);
        smax = 0; sSeuil = 0; n = 0;
        return pts.length;
      },
      points: function(){ return pts.slice(); }
    };
  }

  /* ── DESSIN ───────────────────────────────────────────────────────────── */
  function prep(cv, h){
    var d = window.devicePixelRatio || 1;
    /* PIÈGE PAYÉ : lire clientWidth AVANT d'imposer width:100% mesure la
       largeur par défaut d'un canvas (300 px), pas celle du conteneur — le
       tracé sortait à 300 px de large sur tous les écrans. On pose le style
       d'abord, on mesure ensuite, et on retombe sur le parent si la page
       n'a pas encore fait sa mise en page. */
    cv.style.width = '100%'; cv.style.display = 'block';
    var w = cv.clientWidth || (cv.parentNode && cv.parentNode.clientWidth) || 320;
    cv.width = Math.round(w*d); cv.height = Math.round(h*d);
    cv.style.height = h + 'px';
    var x = cv.getContext('2d'); x.setTransform(d,0,0,d,0,0);
    x.fillStyle = C.fond; x.fillRect(0,0,w,h);
    return { x:x, w:w, h:h };
  }
  function txt(x, s, px, py, col, taille, align){
    x.fillStyle = col; x.font = (taille||10)+'px ui-monospace, "IBM Plex Mono", monospace';
    x.textAlign = align || 'left'; x.fillText(s, px, py); x.textAlign = 'left';
  }

  /* GROS PLAN — la fenêtre autour d'un mot.
     sil : l'objet rendu par figer(). opts : { attaque_i, confirme_i, need, mot, voile } */
  function dessiner(cv, sil, opts){
    opts = opts || {};
    var G = prep(cv, opts.hauteur || 148), x = G.x, w = G.w, h = G.h;
    var ML = 30, MR = 8, MT = 10, MB = 18;          // marges : place pour les deux axes
    var pw = w-ML-MR, ph = h-MT-MB;

    if(opts.voile){
      txt(x, 'sillage masqué — séance à l\'aveugle', w/2, h/2, C.dim, 11, 'center');
      txt(x, 'il s\'ouvrira à la révélation', w/2, h/2+14, C.dim, 9, 'center');
      return;
    }
    var tir = null, autres = [];
    (sil && sil.voies || []).forEach(function(v){ if(v.tireuse) tir = v; else autres.push(v); });
    if(!tir || !tir.sigma || tir.sigma.length < 2){
      txt(x, 'pas de sillage pour ce mot', w/2, h/2-4, C.dim, 11, 'center');
      txt(x, 'les mesures d\'avant n\'étaient pas encore gardées', w/2, h/2+11, C.dim, 9, 'center');
      return;
    }

    var n = tir.sigma.length, hz = tir.hz || HZ;
    /* l'échelle verticale se cale sur le pic ET sur le seuil : un graphe qui
       coupe son propre seuil ne prouve rien */
    var seuilMax = 0; tir.seuil.forEach(function(s){ if(s[1] > seuilMax) seuilMax = s[1]; });
    var pic = 0; tir.sigma.forEach(function(s){ if(s > pic) pic = s; });
    var haut = Math.max(pic*1.12, seuilMax*1.25, 8);
    var X = function(i){ return ML + pw*i/(n-1); };
    var Y = function(s){ return MT + ph - ph*Math.min(s,haut)/haut; };

    /* grille et graduations σ */
    var pas = haut > 24 ? 10 : (haut > 12 ? 5 : 2);
    for(var g=0; g<=haut; g+=pas){
      var yy = Y(g);
      x.strokeStyle = C.grille; x.lineWidth = 1;
      x.beginPath(); x.moveTo(ML, yy+0.5); x.lineTo(w-MR, yy+0.5); x.stroke();
      txt(x, g+'σ', ML-4, yy+3, C.dim, 9, 'right');
    }

    /* la bande de la normale : sous 1 σ, c'est le lieu qui respire */
    x.fillStyle = 'rgba(120,134,142,.13)';
    x.fillRect(ML, Y(1), pw, MT+ph-Y(1));

    /* les voies MUETTES d'abord, pâles : elles sont la preuve du contraste */
    autres.forEach(function(v){
      if(!v.sigma || v.sigma.length < 2) return;
      x.strokeStyle = 'rgba(120,134,142,.42)'; x.lineWidth = 1;
      x.beginPath();
      for(var i=0; i<v.sigma.length; i++){
        var px = ML + pw*i/(v.sigma.length-1), py = Y(v.sigma[i]);
        i ? x.lineTo(px,py) : x.moveTo(px,py);
      }
      x.stroke();
    });

    /* le seuil, en MARCHES : il ne change qu'aux relevages du témoin, et
       une interpolation en pente laisserait croire qu'il glisse tout seul */
    x.strokeStyle = C.or; x.lineWidth = 1.4; x.setLineDash([5,4]);
    x.beginPath();
    for(var k=0; k<tir.seuil.length; k++){
      var i0 = tir.seuil[k][0], v0 = tir.seuil[k][1];
      var i1 = (k+1 < tir.seuil.length) ? tir.seuil[k+1][0] : n-1;
      x.moveTo(X(i0), Y(v0)); x.lineTo(X(i1), Y(v0));
      if(k+1 < tir.seuil.length) x.lineTo(X(i1), Y(tir.seuil[k+1][1]));
    }
    x.stroke(); x.setLineDash([]);

    /* les relevés qui ont CONFIRMÉ : le seuil franchi ne suffit pas, il faut
       y rester — on montre exactement les relevés qui ont compté */
    var need = opts.need || 4, ci = (opts.confirme_i != null ? opts.confirme_i : n-1-APRES*hz);
    /* largeur minimale : quatre relevés sur cinq cents font cinq pixels —
       mesuré, la bande était invisible, donc la règle qu'elle montre l'était aussi */
    var c0 = X(Math.max(0,ci-need+1)), c1 = X(ci);
    if(c1-c0 < 6) c1 = c0+6;
    x.fillStyle = 'rgba(226,104,95,.22)';
    x.fillRect(c0, MT, c1-c0, ph);

    /* la voie TIREUSE, par-dessus tout : points réels, segments droits */
    x.strokeStyle = C.signal; x.lineWidth = 1.7; x.lineJoin = 'round';
    x.beginPath();
    for(var i2=0; i2<n; i2++){ var qx = X(i2), qy = Y(tir.sigma[i2]); i2 ? x.lineTo(qx,qy) : x.moveTo(qx,qy); }
    x.stroke();

    /* l'attaque — l'instant vrai, celui qui a désigné le mot */
    var ai = (opts.attaque_i != null ? opts.attaque_i : Math.max(0, ci-need+1));
    x.strokeStyle = C.creme; x.lineWidth = 1;
    x.beginPath(); x.moveTo(X(ai)+0.5, MT); x.lineTo(X(ai)+0.5, MT+ph); x.stroke();
    /* l'étiquette vit EN BAS du trait, jamais en haut : mesuré au rendu, en
       haut elle chevauchait le nom de la voie dès que l'attaque tombait à
       droite — deux textes superposés valent moins que pas de texte. Et elle
       passe à gauche du trait près du bord, pour ne pas être coupée. */
    var droite = (X(ai) > w-MR-54);
    txt(x, droite ? 'attaque ↑' : '↑ attaque', X(ai) + (droite ? -3 : 3), MT+ph-4,
        C.creme, 9, droite ? 'right' : 'left');

    /* axe du temps, en secondes RELATIVES à l'attaque */
    for(var s2=-40; s2<=APRES; s2+=10){
      var idx = ai + s2*hz; if(idx < 0 || idx > n-1) continue;
      txt(x, (s2>0?'+':'')+s2+'s', X(idx), h-5, C.dim, 9, 'center');
    }
    /* « pic de la fenêtre » et non « pic » : l'écart annoncé avec le mot est
       celui du relevé qui a CONFIRMÉ, presque jamais le maximum de la fenêtre.
       Deux nombres différents sans étiquette distincte, c'est un écran qui ment.
       Et le titre est TRONQUÉ s'il ne tient pas : mesuré sur 412 px, il sortait
       du cadre — un texte coupé par le bord se lit comme un bogue. */
    var titre = tir.label + (pic ? ' · pic de la fenêtre ' + pic.toFixed(1).replace('.',',') + ' σ' : '');
    x.font = '10px ui-monospace, "IBM Plex Mono", monospace';
    var dispo = w - ML - MR - 4;
    while(titre.length > 6 && x.measureText(titre).width > dispo) titre = titre.slice(0, -4) + '…';
    txt(x, titre, ML+2, MT+9, C.signal, 10);
    return { pic:pic, n:n, hz:hz };
  }

  /* LIGNE DE VIE — toute la séance, un point par minute.
     pts : [[σmax, seuilMoyen], ...]. opts : { mots:[{min, mot}], duree_s } */
  function vie(cv, pts, opts){
    opts = opts || {};
    var G = prep(cv, opts.hauteur || 74), x = G.x, w = G.w, h = G.h;
    var ML = 30, MR = 8, MT = 8, MB = 15;
    var pw = w-ML-MR, ph = h-MT-MB;
    if(!pts || pts.length < 2){
      txt(x, 'séance trop courte pour une ligne de vie', w/2, h/2, C.dim, 10, 'center'); return;
    }
    var n = pts.length, pic = 0, seuilMax = 0;
    pts.forEach(function(p){ if(p[0] > pic) pic = p[0]; if(p[1] > seuilMax) seuilMax = p[1]; });
    var haut = Math.max(pic*1.12, seuilMax*1.2, 8);
    var X = function(i){ return ML + pw*i/(n-1); };
    var Y = function(s){ return MT + ph - ph*Math.min(s,haut)/haut; };

    x.strokeStyle = C.grille; x.lineWidth = 1;
    [0, haut/2, haut].forEach(function(g){
      x.beginPath(); x.moveTo(ML, Y(g)+0.5); x.lineTo(w-MR, Y(g)+0.5); x.stroke();
      txt(x, Math.round(g)+'σ', ML-4, Y(g)+3, C.dim, 9, 'right');
    });

    /* l'aire sous la courbe : ce que le lieu a produit de plus fort, minute
       par minute. Le remplissage rend le PLAT lisible d'un coup d'œil —
       c'est lui qu'on vient chercher quand rien n'est sorti. */
    x.beginPath(); x.moveTo(X(0), MT+ph);
    for(var i=0; i<n; i++) x.lineTo(X(i), Y(pts[i][0]));
    x.lineTo(X(n-1), MT+ph); x.closePath();
    x.fillStyle = 'rgba(95,211,166,.17)'; x.fill();
    x.strokeStyle = C.signal; x.lineWidth = 1.3;
    x.beginPath();
    for(var j=0; j<n; j++){ var px = X(j), py = Y(pts[j][0]); j ? x.lineTo(px,py) : x.moveTo(px,py); }
    x.stroke();

    /* le seuil moyen exigé — sans lui, la hauteur de la courbe ne veut rien dire */
    x.strokeStyle = C.or; x.lineWidth = 1.2; x.setLineDash([5,4]);
    x.beginPath();
    for(var k=0; k<n; k++){ var sx = X(k), sy = Y(pts[k][1]); k ? x.lineTo(sx,sy) : x.moveTo(sx,sy); }
    x.stroke(); x.setLineDash([]);

    /* les mots, s'il y en a */
    (opts.mots||[]).forEach(function(m){
      var i2 = Math.max(0, Math.min(n-1, m.min));
      x.strokeStyle = C.or; x.lineWidth = 1;
      x.beginPath(); x.moveTo(X(i2)+0.5, MT); x.lineTo(X(i2)+0.5, MT+ph); x.stroke();
      x.fillStyle = C.or; x.beginPath(); x.arc(X(i2), MT+3, 2.5, 0, 6.284); x.fill();
    });

    /* axe du temps en heures : une veille se lit en heures, pas en minutes */
    var heures = Math.floor(n/60);
    for(var hh=0; hh<=heures; hh++)
      txt(x, hh+' h', X(hh*60), h-4, C.dim, 9, hh===0?'left':'center');
    return { pic:pic, minutes:n };
  }

  /* une phrase factuelle à écrire sous un tracé — la page ne doit pas
     l'inventer, et deux pages ne doivent pas l'écrire différemment */
  function legende(sil, o){
    o = o || {};
    var tir = null; (sil && sil.voies || []).forEach(function(v){ if(v.tireuse) tir = v; });
    if(!tir) return '';
    var muettes = (sil.voies||[]).length - 1;
    return tir.label + ' · ' + (tir.hz||HZ) + ' relevés par seconde'
      + (muettes ? ' · ' + muettes + ' autre' + (muettes>1?'s':'') + ' voie'
          + (muettes>1?'s':'') + ' en gris, à ' + Math.round((sil.hz||HZ)/DECIM) + '/s' : '')
      + ' · ' + (sil.avant_s||AVANT) + ' s avant l\'attaque, ' + (sil.apres_s||APRES) + ' s après'
      + ' · points mesurés, aucun lissage';
  }

  return { banc:banc, vieCollecteur:vieCollecteur, dessiner:dessiner, vie:vie,
           legende:legende, HZ:HZ, AVANT:AVANT, APRES:APRES, DECIM:DECIM };
})();
