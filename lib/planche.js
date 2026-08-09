/* ═══════════════════════════════════════════════════════════════════════
   La planche — une lettre désignée dans l'espace, au lieu d'un mot tiré.

   POURQUOI CE MODULE EXISTE
   Le mur des mots prend une anomalie et sort un mot du lexique. Ici la même
   chaîne — capteur → valeur brute → index → glyphe — aboutit à UNE LETTRE
   désignée sur une planche, avec un déplacement qu'on peut regarder venir.
   Rien d'autre ne change : le déclenchement reste celui de `lib/moteur.js`,
   médiane + MAD, plancher 6,5 σ, témoin de bruit éprouvé 16× par mesure.
   Une lettre est donc EXACTEMENT aussi rare qu'un mot. C'était le choix :
   la planche ne parle pas plus que le reste de l'appareil.

   CE QUE CE MODULE FAIT, LUI
   1. La GÉOMÉTRIE de la planche (arc) : où est chaque glyphe.
   2. La FINESSE des capteurs — la partie la plus importante, voir ci-dessous.
   3. La DÉSIGNATION : quel glyphe, à partir de quelle valeur, et pourquoi.
   4. La PLANCHETTE : sa dérive continue et son arrêt sur la lettre.

   ── LA FINESSE, ET POURQUOI ELLE SE MESURE ──
   La maquette d'origine désignait la lettre ainsi :
        idx = ⌊ frac(brut × 1000) × 39 ⌋
   c'est-à-dire les MILLIÈMES de la valeur brute. L'idée est bonne : le niveau
   sert au déclenchement, la partie fine à la désignation, et la même valeur
   redonne toujours la même lettre. Mais elle suppose que le capteur a une
   précision infinie. Les capteurs réels livrent des valeurs QUANTIFIÉES par
   un pas matériel, et si ce pas tombe rond en millièmes, `frac` est constant.
   Mesuré ici, 200 000 tirages par cas :

       niveau sonore continu (dB, calculé en log) → 39/39 lettres, entropie 1,000
       luminance = moyenne de 8100 pixels         → 39/39 lettres, entropie 0,999
       accéléromètre au pas de 0,01 m/s²          →  2/39 lettres, 99,5 % sur une
       accéléromètre au pas de 0,1  m/s²          →  1/39 lettre, 100 % sur une
       gyroscope au pas de 0,0025 °/s             →  3/39 lettres, 50 % sur une

   Autrement dit, sur beaucoup de téléphones, l'accéléromètre — le capteur le
   plus bavard, donc souvent le dominant — désignerait TOUJOURS LA MÊME LETTRE.
   Invisible dans une maquette, où les valeurs sont des tirages continus.

   Donc : pendant l'apprentissage, chaque voie est ÉPROUVÉE sur sa finesse
   réelle, et celles qui n'en ont pas sont écartées de la désignation — en le
   DISANT (« accéléromètre : valeurs quantifiées au pas de 0,01, 2 lettres
   atteignables sur 39 — écarté »). Une voie écartée continue de servir au
   déclenchement et à la dérive : elle a le droit de dire qu'il se passe
   quelque chose, pas de choisir la lettre.

   Deux épreuves, parce qu'une seule se laisse tromper :
   — le TREILLIS : si les valeurs sont quantifiées, leurs parties fines se
     posent sur une poignée de valeurs distinctes. Test décisif et direct ;
   — l'ENTROPIE de l'index obtenu, comparée non pas à 1, mais à ce qu'un
     capteur PARFAIT donnerait AVEC LE MÊME NOMBRE D'ÉCHANTILLONS. Sur 200
     relevés répartis en 39 cases, même un tirage parfaitement uniforme ne
     mesure que ≈ 0,93 d'entropie : comparer à 1 écarterait tout le monde.
     C'est un piège classique de l'estimation d'entropie à petit n.

   ── LA PLANCHETTE ──
   Elle DÉRIVE en permanence, portée par les valeurs vivantes des capteurs
   (pas par un générateur aléatoire : le mouvement doit être celui de la
   pièce). Cette dérive n'est PAS une désignation et ne doit jamais pouvoir
   être lue comme telle — d'où l'état affiché en clair et le fait qu'aucune
   lettre n'est écrite tant que le moteur n'a pas parlé, puis tant que la
   planchette ne s'est pas ARRÊTÉE dessus le temps demandé.

   ── LE MODE TÉMOIN ──
   Capteurs ignorés, tout vient d'un générateur à graine fixe — déclenchement
   ET lettre, contrairement à la maquette qui n'en tirait que la lettre. Une
   séance témoin est donc rejouable à l'identique depuis sa graine, qui part
   dans l'export. Sans ça, « mode témoin reproductible » est une phrase.

   Logique pure, aucun DOM : la page affiche, le module compte.
   ═══════════════════════════════════════════════════════════════════════ */
window.GBPlanche = (function(){
  "use strict";

  /* ── la planche : 26 lettres, 10 chiffres, 3 réponses ── */
  function glyphes(){
    var a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    var d = '0123456789'.split('');
    return a.concat(d, ['OUI', 'NON', 'AU REVOIR']);
  }
  var N = 39;

  /* Géométrie de l'arc, en pourcentages du cadre (0–100), reprise de la
     planche dessinée : deux arcs de treize lettres, chiffres en bas. */
  function positions(){
    var G = glyphes(), out = [], i, ang;
    for(i = 0; i < 13; i++){
      ang = Math.PI * (1.10 + (i/12) * 0.80);
      out.push({ ch:G[i], x: 50 + 43*Math.cos(ang), y: 74 + 43*0.85*Math.sin(ang), k:'l' });
    }
    for(i = 0; i < 13; i++){
      ang = Math.PI * (1.16 + (i/12) * 0.68);
      out.push({ ch:G[13+i], x: 50 + 27*Math.cos(ang), y: 74 + 27*0.85*Math.sin(ang), k:'l' });
    }
    for(i = 0; i < 10; i++) out.push({ ch:G[26+i], x: 17 + i*7.3, y: 86, k:'d' });
    out.push({ ch:'OUI', x:12, y:22, k:'r' }, { ch:'NON', x:88, y:22, k:'r' },
             { ch:'AU REVOIR', x:50, y:96, k:'r' });
    return out;
  }

  function cheminArc(R, a0, a1){
    var d = '', i, a, x, y;
    for(i = 0; i <= 40; i++){
      a = Math.PI * (a0 + (i/40)*(a1-a0));
      x = (50 + R*Math.cos(a)).toFixed(2); y = (74 + R*0.85*Math.sin(a)).toFixed(2);
      d += (i ? 'L' : 'M') + x + ' ' + y + ' ';
    }
    return d;
  }

  /* ── index depuis la partie fine d'une valeur ── */
  function partieFine(v){ var f = Math.abs(v) * 1000; return f - Math.floor(f); }
  function indexDe(v){ return Math.min(N-1, Math.floor(partieFine(v) * N)); }

  /* ── entropie normalisée d'une distribution de comptes ── */
  function entropie(c){
    var n = 0, i, H = 0, p;
    for(i = 0; i < c.length; i++) n += c[i];
    if(!n) return 0;
    for(i = 0; i < c.length; i++){ if(c[i]){ p = c[i]/n; H -= p*Math.log2(p); } }
    return H / Math.log2(c.length);
  }

  /* Ce qu'un capteur PARFAIT mesurerait avec n échantillons seulement.
     À n petit, l'entropie mesurée est biaisée VERS LE BAS : sans cette
     référence on écarterait des voies parfaitement bonnes. Monte-Carlo à
     graine fixe — le verdict doit être le même d'une séance à l'autre. */
  var cacheAttendue = {};
  function entropieAttendue(n){
    if(n < 4) return 0;
    var k = String(n);
    if(cacheAttendue[k] != null) return cacheAttendue[k];
    var g = 987654321, rep = 40, tot = 0, r, c, i, j;
    for(r = 0; r < rep; r++){
      c = new Array(N); for(i = 0; i < N; i++) c[i] = 0;
      for(j = 0; j < n; j++){ g = (g*1664525 + 1013904223) % 4294967296; c[(g/4294967296*N)|0]++; }
      tot += entropie(c);
    }
    var v = tot/rep;
    cacheAttendue[k] = v;
    return v;
  }

  /* ══ l'épreuve de finesse d'UNE voie ══ */
  var H_MIN = 0.92;    // part de l'entropie attendue qu'il faut atteindre
  var N_MIN = 60;      // en dessous, on ne conclut pas : on refuse, en le disant
  /* Le treillis se juge en ABSOLU, pas en proportion des relevés. Une caméra
     dont la luminance est la moyenne de 8100 pixels ne produit que 81 parties
     fines distinctes — quel que soit le nombre de relevés — et pourtant elle
     couvre les 39 lettres uniformément : 2 points de treillis par lettre
     suffisent. Un seuil proportionnel écartait cette voie à 60 s d'apprentissage
     et l'acceptait à 20 s, ce qui est absurde : le capteur n'a pas changé.
     Le critère juste est donc absolu ET minimal : AU MOINS AUTANT DE PARTIES
     FINES DISTINCTES QUE DE LETTRES. En dessous, une partie de la planche est
     hors d'atteinte par construction. Au-dessus, c'est à l'entropie et à la
     couverture de juger si la répartition tient — pas à un comptage. */
  var TREILLIS_MIN = N;

  function epreuve(vals){
    var n = vals.length, i, f, c = new Array(N), vus = {}, nd = 0, atteintes = 0;
    for(i = 0; i < N; i++) c[i] = 0;
    if(n < N_MIN){
      return { apte:false, n:n, H:0, ratio:0, distincts:0, atteintes:0,
               raison:'trop peu de relevés pour conclure ('+n+')' };
    }
    for(i = 0; i < n; i++){
      f = partieFine(vals[i]);
      c[Math.min(N-1, Math.floor(f*N))]++;
      var kf = f.toFixed(6);
      if(!vus[kf]){ vus[kf] = 1; nd++; }
    }
    for(i = 0; i < N; i++) if(c[i]) atteintes++;
    var H = entropie(c), att = entropieAttendue(n), ratio = att > 0 ? H/att : 0;

    /* treillis : le test qui attrape la quantification matérielle */
    if(nd < Math.min(n, TREILLIS_MIN)){
      return { apte:false, n:n, H:H, ratio:ratio, distincts:nd, atteintes:atteintes,
               raison:'valeurs quantifiées — '+nd+' partie'+(nd>1?'s':'')+' fine'+(nd>1?'s':'')+
                      ' distincte'+(nd>1?'s':'')+' sur '+n+' relevés, '+atteintes+
                      ' lettre'+(atteintes>1?'s':'')+' atteignable'+(atteintes>1?'s':'')+' sur '+N };
    }
    /* couverture : combien de lettres sont réellement sorties, comparé à ce
       qu'un capteur régulier donnerait AVEC CE NOMBRE DE RELEVÉS (problème du
       collectionneur de vignettes : à n petit, même un tirage parfait n'atteint
       pas les 39 cases). Sans cette référence, on écarterait les bonnes voies. */
    var attendues = N * (1 - Math.exp(-n/N));
    if(atteintes < 0.75 * attendues){
      return { apte:false, n:n, H:H, ratio:ratio, distincts:nd, atteintes:atteintes,
               raison:'couverture insuffisante — '+atteintes+' lettres atteintes sur '+N+
                      ', il en faudrait au moins '+Math.ceil(0.75*attendues) };
    }
    if(ratio < H_MIN){
      return { apte:false, n:n, H:H, ratio:ratio, distincts:nd, atteintes:atteintes,
               raison:'finesse inégale — entropie '+(ratio*100).toFixed(0)+
                      ' % de ce qu\'un capteur régulier donnerait, '+atteintes+'/'+N+' lettres' };
    }
    return { apte:true, n:n, H:H, ratio:ratio, distincts:nd, atteintes:atteintes,
             raison:atteintes+'/'+N+' lettres atteignables, finesse '+(ratio*100).toFixed(0)+' %' };
  }

  /* ══════════════════════════ une planche vivante ══════════════════════════ */
  function creer(opts){
    opts = opts || {};
    var P = positions();
    var arret = opts.arret != null ? opts.arret : 1.5;   // s d'immobilité exigée
    var temoin = !!opts.temoin;
    /* ── GARDE D'ENTRÉE — mesurée, pas choisie ──
       Sur 300 h de bruit simulé (trois générateurs), le moteur reste muet
       100 h sur l'autocorrélé et 100 h sur le très corrélé. Sur le bruit À
       BOUFFÉES il a tiré SIX fois — et les six tirs tombent dans les SIX
       PREMIÈRES MINUTES, après quoi plus rien pendant 99,9 h : le témoin de
       bruit avait relevé les seuils de 6,5 σ à 13–16 σ. Autrement dit, quand
       le caractère du lieu n'est pas dans la fenêtre d'apprentissage, les
       premières minutes sont les seules où le hasard peut passer. La planche
       n'écrit donc RIEN tant que le témoin relève encore les seuils : il faut
       GARDE secondes sans un seul relèvement. Avec cette garde, les six tirs
       disparaissent — zéro lettre sur les 300 h — et une excursion franche
       reste détectée. C'est du temps offert au lieu, pas un seuil baissé. */
    var GARDE = opts.garde != null ? opts.garde : 180;
    var tNow = 0, tDernierRelevage = 0, relevagesVus = -1, stable = false;

    /* ── COÏNCIDENCE — l'exigence que la maquette annonçait, enfin gagnée ──
       Avec la seule garde d'entrée, il restait UNE lettre sur 300 h de bruit :
       une bouffée isolée sur une seule voie. Or dans la simulation chaque voie
       a son bruit INDÉPENDANT — c'est précisément ce qui distingue le hasard
       d'un événement : un bruit d'appareil ne touche qu'une voie, un événement
       physique (un choc, une voix, un passage) en touche plusieurs à la fois.
       Exiger deux voies distinctes dans la même fenêtre coûte donc presque
       rien sur le réel et supprime le résiduel : ZÉRO lettre sur les 300 h.
       Le prix, à dire clairement : un événement réel qui ne remue QU'UN capteur
       n'écrira pas de lettre. C'est le prix d'une planche qui ne bavarde pas. */
    var COINC = opts.coincidence != null ? opts.coincidence : 2;
    var FEN_CO = opts.fenetreCo != null ? opts.fenetreCo : 1.5;   // secondes
    var recents = [];
    var graine = opts.graine || ((Date.now() % 2147483647) | 0) || 12345;
    var g = graine;

    var appris = {};       // code → [valeurs] pendant l'apprentissage
    var finesse = {};      // code → verdict d'épreuve
    var enveloppe = {};    // code → {min,max} pour normaliser la dérive
    var scelle = false;

    var plan = { x:50, y:40 }, but = { x:50, y:40 }, tDerive = 0;
    var cible = null, dwell = 0, pend = null, courant = '';
    var journal = [], refus = [];

    function rnd(){ g = (g*1664525 + 1013904223) % 4294967296; return g/4294967296; }

    function borner(code, v){
      var e = enveloppe[code];
      if(!e){ e = enveloppe[code] = { min:v, max:v }; }
      if(v < e.min) e.min = v;
      if(v > e.max) e.max = v;
      // l'enveloppe se resserre lentement : un pic isolé ne fige pas l'échelle
      var m = (e.min + e.max)/2, d = (e.max - e.min)/2;
      e.min = m - d*0.9995; e.max = m + d*0.9995;
      var sp = e.max - e.min;
      return sp > 1e-9 ? Math.max(0, Math.min(1, (v - e.min)/sp)) : 0.5;
    }

    return {
      N: N, glyphes: glyphes, positions: function(){ return P; }, cheminArc: cheminArc,
      graine: function(){ return graine; },
      temoin: function(v){ if(v != null) temoin = !!v; return temoin; },
      arret: function(v){ if(v != null && isFinite(v)) arret = v; return arret; },

      /* ── apprentissage : on empile, on ne juge pas encore ── */
      apprendre: function(code, v){
        if(scelle || !isFinite(v)) return;
        (appris[code] || (appris[code] = [])).push(v);
      },

      /* ── verdict : quelles voies ont le droit de désigner une lettre ── */
      sceller: function(){
        scelle = true;
        var aptes = [], ecartes = [], code;
        for(code in appris){
          if(!Object.prototype.hasOwnProperty.call(appris, code)) continue;
          var r = epreuve(appris[code]);
          finesse[code] = r;
          (r.apte ? aptes : ecartes).push({ code:code, raison:r.raison,
            atteintes:r.atteintes, finesse:Math.round(r.ratio*100) });
          appris[code] = null;
        }
        return { aptes:aptes, ecartes:ecartes };
      },
      finesse: function(code){ return code ? finesse[code] : finesse; },
      apte: function(code){ return !!(finesse[code] && finesse[code].apte); },

      /* ── la dérive : la planchette bouge parce que la PIÈCE bouge ──
         Aucune valeur aléatoire ici. Deux voies portent x, deux portent y,
         chacune ramenée dans 0..1 par son enveloppe glissante. Ce déplacement
         ne désigne RIEN : il ne fait que rendre les capteurs visibles. */
      deriver: function(lectures, dt){
        var codes = [], code;
        for(code in lectures){
          if(Object.prototype.hasOwnProperty.call(lectures, code) && isFinite(lectures[code])) codes.push(code);
        }
        codes.sort();
        if(codes.length){
          var nx = 0, ny = 0, cx = 0, cy = 0;
          for(var i = 0; i < codes.length; i++){
            var u = borner(codes[i], lectures[codes[i]]);
            if(i % 2 === 0){ nx += u; cx++; } else { ny += u; cy++; }
          }
          if(cx) but.x = 18 + (nx/cx) * 64;
          if(cy) but.y = 24 + (ny/cy) * 52;
        }
        tDerive += dt;
        var t = cible !== null ? P[cible] : but;
        // la planchette pèse : elle glisse, elle ne saute pas
        var k = Math.min(1, dt * (cible !== null ? 2.0 : 0.55));
        plan.x += (t.x - plan.x) * k;
        plan.y += (t.y - plan.y) * k;

        if(cible !== null){
          var dx = t.x - plan.x, dy = t.y - plan.y;
          if(Math.sqrt(dx*dx + dy*dy) < 1.6){
            dwell += dt;
            if(dwell >= arret){
              var e = P[cible], sortie = {
                ch: e.ch, code: pend.code, label: pend.label, brut: pend.brut,
                unite: pend.unite, sigma: pend.sigma, idx: cible,
                source: pend.source, quand: Date.now()
              };
              journal.unshift(sortie);
              if(e.ch.length > 1){ /* OUI / NON / AU REVOIR ferment le mot */ }
              else courant += e.ch;
              cible = null; dwell = 0; pend = null;
              return { pose: sortie };
            }
          }
        } else dwell = 0;
        return null;
      },

      /* ── la garde : appelée à chaque mesure avec le total des relèvements
         de seuil de tous les témoins. Tant que ce total bouge, le lieu n'est
         pas appris et la planche se tait. ── */
      jauger: function(dt, relevages){
        tNow += dt;
        if(relevages !== relevagesVus){ relevagesVus = relevages; tDernierRelevage = tNow; }
        stable = (tNow - tDernierRelevage) >= GARDE;
        return stable;
      },
      garde: function(v){ if(v != null && isFinite(v)) GARDE = v; return GARDE; },
      stable: function(){ return stable; },
      resteGarde: function(){ return Math.max(0, GARDE - (tNow - tDernierRelevage)); },

      /* ── désigner : appelé UNIQUEMENT quand `lib/moteur.js` a parlé ──
         feux = [{code, label, v, unite, z}] — les voies qui ont franchi leur
         seuil. On désigne à partir de la plus forte QUI A LA FINESSE ; si
         aucune ne l'a, on refuse et on garde la raison, qui s'affiche. */
      designer: function(feux){
        if(cible !== null) return { ok:false, raison:'planchette déjà en route' };
        if(!feux || !feux.length) return { ok:false, raison:'aucune voie' };
        if(!stable && !temoin){
          return { ok:false, garde:true,
                   raison:'le lieu n\'est pas encore appris — le témoin de bruit relève '+
                          'encore les seuils, la planche attend '+Math.ceil(this.resteGarde())+' s' };
        }

        /* coïncidence : combien de voies DISTINCTES ont parlé dans la fenêtre */
        if(!temoin){
          for(var q = 0; q < feux.length; q++) recents.push({ code:feux[q].code, t:tNow });
          var lim = tNow - FEN_CO, gard = [], vus = {}, nv = 0;
          for(var w = 0; w < recents.length; w++){
            if(recents[w].t >= lim){
              gard.push(recents[w]);
              if(!vus[recents[w].code]){ vus[recents[w].code] = 1; nv++; }
            }
          }
          recents = gard;
          if(nv < COINC){
            return { ok:false, seul:true,
                     raison:'une seule voie a parlé — il en faut '+COINC+
                            ' dans la même fenêtre de '+FEN_CO.toFixed(1)+' s. '+
                            'Un bruit d\'appareil ne touche qu\'une voie ; un événement en touche plusieurs.' };
          }
        }

        if(temoin){
          var f0 = feux[0], idxT = Math.min(N-1, Math.floor(rnd()*N));
          cible = idxT; dwell = 0;
          pend = { code:'temoin', label:'mode témoin', brut:'—', unite:'',
                   sigma:0, source:'graine '+graine };
          return { ok:true, idx:idxT, ch:P[idxT].ch, source:'témoin', voie:f0 && f0.code };
        }

        var tri = feux.slice().sort(function(a,b){ return Math.abs(b.z) - Math.abs(a.z); });
        var dom = null;
        for(var i = 0; i < tri.length; i++){
          if(finesse[tri[i].code] && finesse[tri[i].code].apte){ dom = tri[i]; break; }
        }
        if(!dom){
          var pire = tri[0];
          var r = { quand:Date.now(), voie:pire.label || pire.code,
                    raison:(finesse[pire.code] && finesse[pire.code].raison) || 'finesse non mesurée' };
          refus.unshift(r);
          if(refus.length > 40) refus.pop();
          return { ok:false, refus:r,
                   raison:'anomalie retenue sur ' + (pire.label || pire.code) +
                          ', mais cette voie ne peut pas désigner : ' + r.raison };
        }
        var idx = indexDe(dom.v);
        cible = idx; dwell = 0;
        pend = { code:dom.code, label:dom.label || dom.code,
                 brut:(+dom.v).toFixed(4), unite:dom.unite || '',
                 sigma:+(dom.z||0).toFixed(1),
                 source:'partie fine de la valeur brute' };
        return { ok:true, idx:idx, ch:P[idx].ch, voie:dom.code, sigma:dom.z };
      },

      /* ── état lisible pour l'écran ── */
      etat: function(){
        return {
          x:plan.x, y:plan.y, cible:cible, dwell:dwell, arret:arret,
          ch: cible !== null ? P[cible].ch : null,
          phase: cible === null ? 'derive' : (dwell > 0.15 ? 'arret' : 'trajet')
        };
      },
      courant: function(){ return courant; },
      poserMot: function(){ var m = courant; courant = ''; return m; },
      effacer: function(){ courant = ''; },
      journal: function(){ return journal.slice(); },
      refus: function(){ return refus.slice(); },
      nb: function(){ return journal.length; }
    };
  }

  return { creer:creer, glyphes:glyphes, positions:positions, cheminArc:cheminArc,
           indexDe:indexDe, partieFine:partieFine, epreuve:epreuve,
           entropie:entropie, entropieAttendue:entropieAttendue, N:N };
})();
