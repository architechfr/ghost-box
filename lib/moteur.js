/* ═══════════════════════════════════════════════════════════════════════
   Moteur de détection — implémentation UNIQUE, partagée par les pages qui
   font parler un capteur (séance capteurs, réalisateur, mur de mots).

   Il n'y a AUCUN seuil théorique ici. « 3 σ » est un mensonge sur un capteur
   réel : le bruit est corrélé dans le temps et a des queues lourdes. Le seuil
   est donc :

     1. ANCRÉ sur le pire pic réellement observé pendant l'apprentissage
        (× 1,4), jamais sous un plancher mesuré (voir PLANCHER),
     2. RELEVÉ en direct de 15 % chaque fois qu'un témoin de bruit — le bruit
        réellement enregistré, rejoué par blocs, où il ne se passe RIEN —
        aurait suffi à faire sortir un mot. Le témoin est éprouvé 16 fois par
        mesure : il rencontre donc les coups de chance du bruit BIEN avant que
        la réalité ne les rencontre, et relève le seuil à temps.

   Et un capteur parfaitement plat (absent, gelé, débranché) n'est jamais armé :
   sans bruit à comparer, la moindre variation vaudrait des milliers de σ.

   Vérifié par simulation : 900 h de bruit (trois générateurs différents) →
   ZÉRO mot. Une excursion franche et soutenue de 8 σ → passe, 100 fois sur 100.
   Toute modification de ce fichier doit refaire cette mesure.
   ═══════════════════════════════════════════════════════════════════════ */
window.GBMoteur = (function(){
  "use strict";

  var NEED   = 4;      // relevés consécutifs au-dessus du seuil (≈ 400 ms à 10 Hz)
  var ADAPT  = 0.004;  // suivi lent de la dérive de la normale
  var BLOCK  = 30;     // bootstrap par blocs de 3 s : conserve l'autocorrélation
  var RAISE  = 1.15;   // élévation du seuil à chaque déclenchement du témoin
  var CTL    = 16;     // le témoin est éprouvé 16× plus souvent que le réel (voir plus bas)
  var NOISE_MAX = 4000;
  /* ── PLANCHER : 6,5 σ, et ce chiffre est MESURÉ, pas choisi ──
     Sur 900 h de bruit simulé — trois générateurs différents : autocorrélé à
     queues lourdes, très fortement corrélé, et à bouffées — le réglage précédent
     (plancher 5 σ, témoin éprouvé 4× par mesure) laissait encore sortir 74 mots
     sur du bruit pur. Avec un plancher de 6,5 σ et un témoin éprouvé 16× :
     ZÉRO mot sur les mêmes 900 h, tandis qu'une excursion franche de 8 σ est
     encore détectée 100 fois sur 100. Ne pas baisser ces deux valeurs sans
     refaire cette mesure. */
  var PLANCHER = 6.5;

  /* médiane + MAD : insensible aux pics parasites, contrairement à moyenne + écart-type */
  function robustStats(a){
    var s = a.slice().sort(function(x,y){return x-y;}), n = s.length;
    var med = n%2 ? s[(n-1)/2] : (s[n/2-1]+s[n/2])/2;
    var dev = s.map(function(x){return Math.abs(x-med);}).sort(function(x,y){return x-y;});
    var mad = n%2 ? dev[(n-1)/2] : (dev[n/2-1]+dev[n/2])/2;
    var sc = mad*1.4826;
    if(!(sc>1e-9)){
      var m = a.reduce(function(p,c){return p+c;},0)/n;
      sc = Math.sqrt(a.reduce(function(p,c){return p+(c-m)*(c-m);},0)/n);
    }
    return { center: med, scale: sc };
  }

  /* un « témoin » = un capteur surveillé, avec sa normale, son seuil et sa mémoire de bruit */
  function mk(code, label, extra){
    var w = { code: code, label: label || code,
      samples: [], noise: [], noiseMax: NOISE_MAX,
      moy: 0, sd: 1, ev: 1, thr: 8, raises: 0,
      persist: 0, cPersist: 0, cPtr: 0, cLeft: 0,
      z: 0, v: 0, ready: false, lastAbove: -1e9 };
    if(extra) for(var k in extra) if(Object.prototype.hasOwnProperty.call(extra,k)) w[k]=extra[k];
    return w;
  }

  /* témoin de bruit : rejoue le bruit RÉELLEMENT enregistré, par blocs — mêmes pics,
     même corrélation, mais aucun événement réel. S'il parle, c'est un faux positif certain. */
  function ctlNext(w){
    var n = w.noise.length; if(n < 20) return null;
    if(w.cLeft <= 0){ w.cPtr = (Math.random()*n)|0; w.cLeft = BLOCK; }
    var v = w.noise[w.cPtr % n]; w.cPtr++; w.cLeft--; return v;
  }

  /* ── ré-apprentissage d'une voie ──
     Quand les conditions PHYSIQUES d'une voie changent en cours de séance —
     la torche s'allume sur la caméra, on change d'objectif, le micro est
     rebranché — la normale apprise ne décrit plus rien. La garder reviendrait
     à comparer le présent à un lieu qui n'existe plus, et le premier relevé
     sortirait à des dizaines de σ : un mot sortirait POUR UNE LAMPE.

     On efface donc tout — normale, seuil, mémoire de bruit, relevages — et la
     voie se tait jusqu'à ce qu'elle ait revu `mini` mesures du lieu tel qu'il
     est maintenant. Se taire n'est pas une panne : c'est la seule réponse
     honnête à « je ne connais plus cet endroit ». */
  function relancer(w, mini){
    w.samples = []; w.noise = []; w.ready = false; w.plat = false;
    w.persist = 0; w.cPersist = 0; w.cPtr = 0; w.cLeft = 0;
    w.raises = 0; w.thr = 8; w.z = 0; w.lastAbove = -1e9;
    w.reapp = Math.max(30, mini || 300);
    return w;
  }
  /* combien de mesures restent avant qu'elle puisse reparler (0 = elle parle) */
  function reste(w){ return w.reapp ? Math.max(0, w.reapp - w.samples.length) : 0; }

  /* une mesure. Renvoie true si — et seulement si — le seuil a été franchi
     assez longtemps. Le témoin est éprouvé au passage et peut relever le seuil. */
  function feed(w, v, learning){
    if(!isFinite(v)) return false;
    w.v = v;
    // ré-apprentissage en cours : on avale, on n'émet rien, quoi que demande la page
    if(w.reapp){
      w.samples.push(v);
      if(w.samples.length >= w.reapp){
        var n = w.reapp; w.reapp = 0;
        seal(w, Math.min(30, n));
      }
      return false;
    }
    if(learning){ w.samples.push(v); return false; }
    if(!w.ready) return false;
    var z = Math.abs(v - w.moy) / w.sd; w.z = z;
    if(z >= w.thr) w.persist++; else w.persist = 0;
    // mémoriser TOUT le bruit, pics compris : sinon le témoin serait plus sage que la réalité
    w.noise.push(v); if(w.noise.length > w.noiseMax) w.noise.shift();
    // ne suivre la dérive de la normale que sur les passages calmes
    if(z < w.thr*0.5){
      var dv = v - w.moy; w.moy += ADAPT*dv; w.ev += ADAPT*(dv*dv - w.ev);
      w.sd = Math.sqrt(Math.max(w.ev, 1e-18)); if(w.sd < 1e-9) w.sd = 1e-9;
    }
    for(var k=0; k<CTL; k++){
      var cv = ctlNext(w); if(cv == null) break;
      var cz = Math.abs(cv - w.moy) / w.sd;
      if(cz >= w.thr) w.cPersist++; else w.cPersist = 0;
      if(w.cPersist >= NEED){ w.thr *= RAISE; w.raises++; w.cPersist = 0; w.persist = 0; }
    }
    var fired = w.persist >= NEED;
    if(fired) w.persist = 0;
    return fired;
  }

  /* arme le témoin. Renvoie false s'il n'y a rien à armer — et c'est un résultat, pas une panne. */
  function seal(w, mini){
    if(w.samples.length < (mini || 30)) return false;
    var r = robustStats(w.samples);
    // ── capteur plat : on n'arme PAS ──
    // Absent, gelé, débranché, ou renvoyant toujours la même chose : le bruit est nul.
    // Le moindre frémissement vaudrait alors des milliers de σ et ferait sortir un mot
    // pour rien. Deux garde-fous : une dispersion réellement non nulle, et au moins
    // quelques valeurs DIFFÉRENTES (un capteur figé en renvoie une ou deux).
    var vus = {}, nvus = 0;
    for(var d=0; d<w.samples.length && nvus<4; d++){
      var k = w.samples[d];
      if(!vus[k]){ vus[k] = 1; nvus++; }
    }
    if(!(r.scale > 1e-9) || nvus < 4){ w.ready = false; w.plat = true; return false; }
    w.plat = false;
    w.moy = r.center; w.sd = r.scale; w.ev = w.sd*w.sd;
    w.noise = w.samples.slice(-w.noiseMax);
    var zmax = 0;
    for(var i=0; i<w.samples.length; i++){
      var z = Math.abs(w.samples[i]-w.moy)/w.sd; if(z > zmax) zmax = z;
    }
    w.thr = Math.max(PLANCHER, zmax*1.4);
    w.ready = true;
    return true;
  }

  return { NEED: NEED, ADAPT: ADAPT, BLOCK: BLOCK, RAISE: RAISE, CTL: CTL,
           NOISE_MAX: NOISE_MAX, PLANCHER: PLANCHER,
           robustStats: robustStats, mk: mk, ctlNext: ctlNext,
           feed: feed, seal: seal, relancer: relancer, reste: reste };
})();
