/* ═══════════════════════════════════════════════════════════════════════
   Mur de mots — composant UNIQUE, affichable dans n'importe quel mode.

   Pourquoi il existe : un lexique rangé dans un fichier ne se propose à
   personne. Ici les mots sont MONTRÉS, tout le temps, rangés par famille.
   Quand une mesure dépasse le seuil, c'est l'instant qui désigne — rien
   d'autre, ni moi, ni un tirage caché.

   ══ DEUX MANIÈRES DE DÉSIGNER, ET IL FAUT SAVOIR POURQUOI ══

   1) INSTANT SIMPLE — un événement, un mot.
      Le mur défile, une case de lecture parcourt les colonnes, l'événement
      fige et le mot dans la case est retenu.
      Honnête, mais il faut le dire franchement : le mot n'est PAS visable.
      À 330 px/s pour une case de 30 px, un mot passe toutes les 68 à 130 ms,
      et la case change de colonne toutes les 420 ms. Viser un mot précis
      demanderait une justesse au dixième de seconde ET la connaissance de
      l'état d'un défilement qu'on ne contrôle pas. En pratique, l'instant
      est vrai et le mot est un tirage. C'est une mesure, pas un dialogue.

   2) ESCALIER — trois événements, un mot, et cette fois il est visable.
      On ne baisse aucun seuil : on AGRANDIT la cible.
        · étape 1 — la famille : 5 colonnes éclairées 2,5 s chacune ;
        · étape 2 — la page    : les mots de la famille par pages de 24,
                                 2,5 s par page ;
        · étape 3 — le mot     : les 24 mots de la page, 800 ms chacun.
      Trois franchissements de seuil réels valent BIEN PLUS qu'un seul :
      la probabilité qu'un hasard en produise trois dans les fenêtres utiles
      est le produit de trois probabilités déjà minuscules. L'escalier est
      donc plus sévère que l'instant simple, pas moins.
      Si une étape reste sans événement pendant la fenêtre, la séquence est
      abandonnée et RIEN n'est écrit. Pas de demi-mot.

   ══ L'HORODATAGE EST PRIS À L'ATTAQUE ══
   Le moteur ne confirme un franchissement qu'après 4 relevés, soit ~400 ms
   après le début réel de l'excursion — 3 à 6 mots de défilement plus loin.
   Le mur accepte donc un instant d'attaque et remonte le défilement jusque-là.
   Sans cela, même une intention parfaitement synchronisée manquerait sa cible.

   ══ LA PHRASE ══
   Les mots retenus s'accumulent dans l'ordre où ils sont sortis. L'appareil
   n'ajoute AUCUN mot, n'en réordonne aucun, ne conjugue rien, ne met ni
   article ni liaison. Le sens, s'il y en a un, ne vient pas d'ici.

   Usage :
     const M = GBMur.creer({ hote, mots, mode:'escalier', onMot, onEtape });
     M.demarrer();
     M.figer('écart 9,2 σ', false, tAttaque);   // un événement réel
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

  /* ── escalier ── */
  var PAS_FAMILLE = 2500;   // durée d'éclairage d'une famille
  var PAS_PAGE    = 2500;   // durée d'affichage d'une page de mots
  var PAS_MOT     = 800;    // durée d'éclairage d'un mot
  var PAGE        = 24;     // mots par page — une grille 4 × 6 lisible à 2 m
  var FENETRE     = 120000; // sans événement pendant ce temps, la séquence est abandonnée
  var FLASH       = 900;    // confirmation visuelle d'une étape franchie

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

    /* le canvas remplace tout le contenu de l'hôte : rien d'autre à styler.
       AUCUN style de position posé en ligne — un style en ligne écraserait la
       mise en page de la page hôte (l'écran fixe ne pouvait plus poser le mur
       en bas de l'écran, il remontait sous le bandeau). */
    hote.innerHTML = '';
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
    var mode = (opts.mode === 'escalier') ? 'escalier' : 'instant';
    var actif = false, fige = false, tFige = 0, lastT = 0, raf = 0;
    var t0 = performance.now(), crans = -1, dernier = null, retenus = [];
    var W = 0, H = 0, dpr = 1, colW = 0, infoGel = '', testGel = false;

    /* état de l'escalier */
    var esc = { etape:0, famille:-1, page:-1, tEtape:0, tFlash:0, txtFlash:'', pas:[] };

    var POLICE = '"IBM Plex Mono",ui-monospace,monospace';
    var TITRE  = '"Barlow Condensed","Arial Narrow",sans-serif';

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

    /* le mot lu à l'instant t (t peut être ANTÉRIEUR à maintenant : on remonte
       le défilement, puisqu'il est parfaitement linéaire entre deux images) */
    function motLu(ci, t, now){
      var c = cols[ci], n = c.liste.length, cycle = n*ROW;
      var off = c.off;
      if(t != null && now != null && t < now) off -= vitesse*c.allure*(now-t)/1000;
      var idx = Math.floor((((off % cycle) + cycle) % cycle + H/2) / ROW) % n;
      if(idx < 0) idx += n;
      return { idx: idx, mot: c.liste[idx] };
    }

    /* pages d'une famille : découpage fixe, donc reproductible et vérifiable */
    function pages(ci){
      var n = cols[ci].liste.length;
      return Math.max(1, Math.ceil(n/PAGE));
    }
    function motsPage(ci, p){
      return cols[ci].liste.slice(p*PAGE, p*PAGE + PAGE);
    }

    /* ═══════════════════ dessin — défilement ═══════════════════ */
    function dessinerColonnes(now, cibleFamille){
      // traînée : on n'efface jamais complètement, ce qui laisse une rémanence
      g.fillStyle = 'rgba(3,7,10,0.34)';
      g.fillRect(0,0,W,H);

      var mid = H/2, ciCur = (cibleFamille==null) ? colCourante(now) : cibleFamille;
      g.textAlign = 'center'; g.textBaseline = 'middle';

      for(var i=0;i<cols.length;i++){
        var c = cols[i], n = c.liste.length, cycle = n*ROW;
        var off = ((c.off % cycle) + cycle) % cycle;
        var x = i*colW + colW/2;
        var premier = Math.floor(off/ROW);
        var y0 = -(off % ROW);
        var eteinte = (cibleFamille!=null && i!==cibleFamille);
        for(var k=0; y0 + k*ROW < H + ROW; k++){
          var y = y0 + k*ROW + ROW/2;
          if(y < -ROW || y > H+ROW) continue;
          var mot = c.liste[(premier + k) % n];
          // la lumière vient de la ligne de lecture : plus on s'en éloigne, plus on s'efface
          var d = Math.abs(y - mid) / (H*0.5);
          var a = Math.max(0.10, 1 - d*d*1.25);
          if(eteinte) a *= 0.28;
          var pres = d < 0.06 && !eteinte;
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
        if(i){ g.fillStyle='rgba(60,220,160,.10)'; g.fillRect(i*colW, 0, 1, H); }
      }

      if(cibleFamille == null){
        // ── faisceau de lecture ──
        var grd = g.createLinearGradient(0, mid-ROW, 0, mid+ROW);
        grd.addColorStop(0,'rgba(95,211,166,0)');
        grd.addColorStop(.5,'rgba(95,211,166,.16)');
        grd.addColorStop(1,'rgba(95,211,166,0)');
        g.fillStyle = grd; g.fillRect(0, mid-ROW, W, ROW*2);
        g.fillStyle = 'rgba(150,255,215,.55)'; g.fillRect(0, mid-ROW/2, W, 1);
        g.fillRect(0, mid+ROW/2, W, 1);
        // ── case de lecture ──
        g.save();
        g.strokeStyle = 'rgba(160,255,220,.95)'; g.lineWidth = 1.5;
        g.shadowColor = 'rgba(95,211,166,.8)'; g.shadowBlur = 14;
        g.strokeRect(ciCur*colW + 3, mid - ROW/2, colW - 6, ROW);
        g.restore();
      } else {
        // ── cible d'étape : toute la colonne, impossible à manquer ──
        g.save();
        g.strokeStyle = 'rgba(233,180,76,.95)'; g.lineWidth = 3;
        g.shadowColor = 'rgba(233,180,76,.85)'; g.shadowBlur = 20;
        g.strokeRect(ciCur*colW + 2, 30, colW - 4, H - 34);
        g.restore();
      }

      // ── en-têtes de famille ──
      var grh = g.createLinearGradient(0,0,0,26);
      grh.addColorStop(0,'rgba(3,7,10,.96)'); grh.addColorStop(1,'rgba(3,7,10,0)');
      g.fillStyle = grh; g.fillRect(0,0,W,26);
      g.font = '600 9px ' + POLICE;
      for(var j=0;j<cols.length;j++){
        g.fillStyle = (cibleFamille===j) ? 'rgba(243,212,138,.95)' : 'rgba(95,211,166,.55)';
        g.fillText(FAMILLES[j].t.toUpperCase(), j*colW + colW/2, 11);
      }

      vignettage(mid);
    }

    function vignettage(mid){
      var vg = g.createRadialGradient(W/2, mid, Math.min(W,H)*0.25, W/2, mid, Math.max(W,H)*0.75);
      vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,.55)');
      g.fillStyle = vg; g.fillRect(0,0,W,H);
    }

    /* ═══════════════════ dessin — grille de mots ═══════════════════ */
    function grille(liste, actifIdx, surbrillanceBloc){
      var COLG = 4, LIG = Math.ceil(PAGE/COLG);
      var top = 62, bas = 26;
      var cw = W/COLG, ch = (H - top - bas)/LIG;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for(var i=0;i<liste.length;i++){
        var cx = (i%COLG)*cw + cw/2;
        var cy = top + Math.floor(i/COLG)*ch + ch/2;
        var vise = (actifIdx===i) || surbrillanceBloc;
        var m = liste[i];
        var t = Math.min(ch*0.52, cw*1.55/Math.max(4,m.length));
        g.font = (vise? '600 ':'') + Math.max(10, Math.round(t)) + 'px ' + TITRE;
        if(actifIdx===i){
          g.save();
          g.fillStyle = 'rgba(233,180,76,.14)';
          g.fillRect((i%COLG)*cw+3, top+Math.floor(i/COLG)*ch+2, cw-6, ch-4);
          g.strokeStyle='rgba(243,212,138,.95)'; g.lineWidth=2;
          g.shadowColor='rgba(233,180,76,.8)'; g.shadowBlur=16;
          g.strokeRect((i%COLG)*cw+3, top+Math.floor(i/COLG)*ch+2, cw-6, ch-4);
          g.restore();
          g.fillStyle = '#FFF0C4';
        } else {
          g.fillStyle = surbrillanceBloc ? 'rgba(226,255,243,.92)' : 'rgba(120,220,180,.75)';
        }
        g.fillText(m.toUpperCase(), cx, cy);
      }
    }

    function bandeauEscalier(titre, sousTitre, avance, reste){
      g.fillStyle = 'rgba(3,7,10,.92)'; g.fillRect(0,0,W,58);
      g.fillStyle = 'rgba(95,211,166,.22)'; g.fillRect(0,57,W,1);
      g.textAlign='left'; g.textBaseline='alphabetic';
      g.font = '600 15px ' + TITRE;
      g.fillStyle = '#E9B44C';
      g.fillText(titre.toUpperCase(), 12, 24);
      g.font = '11px ' + POLICE;
      g.fillStyle = 'rgba(207,198,180,.85)';
      // le sous-titre ne déborde jamais sur le compteur de droite
      var maxL = W - 70;
      var st = sousTitre;
      while(st.length > 4 && g.measureText(st).width > maxL) st = st.slice(0, -4) + '…';
      g.fillText(st, 12, 42);
      if(reste!=null){
        g.textAlign='right';
        g.fillStyle = 'rgba(120,134,142,.9)';
        g.fillText(Math.ceil(reste/1000)+' s', W-12, 42);
      }
      // avancement de la cible courante
      g.fillStyle='rgba(233,180,76,.75)';
      g.fillRect(0, 55, W*Math.min(1,Math.max(0,avance)), 2);
      g.textAlign='center'; g.textBaseline='middle';
    }

    function flash(now){
      var k = 1 - (now - esc.tFlash)/FLASH;
      if(k <= 0) return;
      g.save();
      g.fillStyle = 'rgba(3,7,10,' + (0.72*k).toFixed(3) + ')';
      g.fillRect(0,0,W,H);
      g.textAlign='center'; g.textBaseline='middle';
      g.font = '600 ' + Math.round(Math.min(W/8, 40)) + 'px ' + TITRE;
      g.fillStyle = 'rgba(243,212,138,' + k.toFixed(3) + ')';
      g.shadowColor='rgba(233,180,76,.9)'; g.shadowBlur=24;
      g.fillText(esc.txtFlash.toUpperCase(), W/2, H/2);
      g.restore();
    }

    /* ═══════════════════ le mot retenu ═══════════════════ */
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
      g.font = '600 ' + Math.round(taille) + 'px ' + TITRE;
      g.fillText(mot.toUpperCase(), W/2, H*0.44);
      g.restore();
      g.font = '11px ' + POLICE;
      g.fillStyle = testGel ? 'rgba(226,87,76,.95)' : 'rgba(207,198,180,.9)';
      var lignes = (testGel
        ? ['ESSAI — figé à la main pour montrer le mécanisme','aucune mesure derrière ce mot']
        : String(infoGel||'').split(' · '));
      for(var i=0;i<lignes.length && i<3;i++) g.fillText(lignes[i], W/2, H*0.44 + taille*0.62 + i*15);
    }

    /* ═══════════════════ boucle ═══════════════════ */
    function cibleFamilleAt(now){ return Math.floor((now - esc.tEtape)/PAS_FAMILLE) % cols.length; }
    function ciblePageAt(now){ return Math.floor((now - esc.tEtape)/PAS_PAGE) % pages(esc.famille); }
    function cibleMotAt(now, n){ return Math.floor((now - esc.tEtape)/PAS_MOT) % Math.max(1,n); }

    function dessiner(now){
      if(mode === 'instant'){
        dessinerColonnes(now, null);
        if(fige) voile(now);
        return;
      }
      // ── escalier ──
      var reste = FENETRE - (now - esc.tEtape);
      if(esc.etape === 0){
        var ci = cibleFamilleAt(now);
        dessinerColonnes(now, ci);
        var av = ((now - esc.tEtape) % PAS_FAMILLE)/PAS_FAMILLE;
        bandeauEscalier('Étape 1 sur 3 — la famille',
          'La colonne encadrée change toutes les ' + (PAS_FAMILLE/1000).toFixed(1).replace('.',',') + ' s. Un événement pendant qu\'elle est encadrée la choisit.',
          av, reste);
      } else if(esc.etape === 1){
        g.fillStyle = '#03070A'; g.fillRect(0,0,W,H);
        var p = ciblePageAt(now);
        grille(motsPage(esc.famille, p), -1, true);
        var av2 = ((now - esc.tEtape) % PAS_PAGE)/PAS_PAGE;
        bandeauEscalier('Étape 2 sur 3 — la page',
          FAMILLES[esc.famille].t + ' · page ' + (p+1) + ' sur ' + pages(esc.famille)
            + ' · ' + (PAS_PAGE/1000).toFixed(1).replace('.',',') + ' s par page',
          av2, reste);
        vignettage(H/2);
      } else if(esc.etape === 2){
        g.fillStyle = '#03070A'; g.fillRect(0,0,W,H);
        var liste = motsPage(esc.famille, esc.page);
        var mi = cibleMotAt(now, liste.length);
        grille(liste, mi, false);
        var av3 = ((now - esc.tEtape) % PAS_MOT)/PAS_MOT;
        bandeauEscalier('Étape 3 sur 3 — le mot',
          FAMILLES[esc.famille].t + ' · page ' + (esc.page+1) + ' · mot ' + (mi+1) + ' sur ' + liste.length
            + ' · ' + PAS_MOT + ' ms par mot',
          av3, reste);
        vignettage(H/2);
      }
      flash(now);
      if(fige) voile(now);
    }

    function boucle(){
      if(!actif) return;
      var t = performance.now(), dt = Math.min(60, t - (lastT || t)); lastT = t;
      if(!fige){
        allures(t);
        // en escalier, le défilement ne tourne que pendant l'étape 1
        if(mode === 'instant' || esc.etape === 0){
          for(var i=0;i<cols.length;i++){
            var c = cols[i], cycle = c.liste.length*ROW;
            c.off = (c.off + vitesse*c.allure*dt/1000) % cycle;
          }
        }
        // fenêtre d'étape échue : la séquence est abandonnée, rien n'est écrit
        if(mode === 'escalier' && esc.etape > 0 && (t - esc.tEtape) > FENETRE) abandonner('fenêtre échue');
      } else if(t - tFige > GEL_MS){ degeler(); }
      dessiner(t);
      raf = requestAnimationFrame(boucle);
    }

    function demarrer(){ if(actif) return; actif = true; lastT = 0; taille(); if(!esc.tEtape) esc.tEtape = performance.now(); boucle(); }
    function arreter(){ actif = false; if(raf) cancelAnimationFrame(raf); raf = 0; }
    function degeler(){ fige = false; if(opts.onDegel) opts.onDegel(); }

    function reinitEscalier(now){
      esc.etape = 0; esc.famille = -1; esc.page = -1;
      esc.tEtape = now || performance.now(); esc.pas = [];
    }
    function abandonner(pourquoi){
      var avait = esc.pas.slice();
      reinitEscalier(performance.now());
      esc.tFlash = performance.now(); esc.txtFlash = 'séquence abandonnée';
      if(opts.onEtape) try{ opts.onEtape({type:'abandon', pourquoi:pourquoi, pas:avait}); }catch(e){}
    }

    /* ═══════════════════ un événement réel arrive ═══════════════════
       tAttaque : instant (performance.now) du DÉBUT de l'excursion, avant les
       relevés de confirmation. S'il est fourni, c'est lui qui désigne. */
    function figer(info, test, tAttaque){
      if(!cols.length) return null;
      var now = performance.now();
      var t = (tAttaque!=null && isFinite(tAttaque) && tAttaque<=now && now-tAttaque<2000) ? tAttaque : now;

      if(mode === 'escalier' && !test){
        return escalierPas(t, now, info);
      }
      if(fige) return null;

      var ci = (mode==='escalier') ? cibleFamilleAt(t) : colCourante(t);
      var lu = motLu(ci, t, now), c = cols[ci];
      fige = true; tFige = now; infoGel = info || ''; testGel = !!test;
      if(!test) c.retenus++;
      dernier = { mot: lu.mot, index: lu.idx, colonne: FAMILLES[ci].t, ci: ci,
                  taille: c.liste.length, allure: +c.allure.toFixed(2), vitesse: vitesse,
                  decalage: Math.round(c.off), test: !!test, mode:'instant',
                  // la CAUSE voyage avec le mot : sans elle, la page qui reçoit
                  // le mot ne peut pas dire quelle voie l'a fait sortir
                  info: info || '',
                  retard_ms: Math.round(now - t), t: Date.now() };
      if(!test) retenus.push({ mot: lu.mot, colonne: FAMILLES[ci].t, t: Date.now(), info: info||'', mode:'instant' });
      if(navigator.vibrate && !test) navigator.vibrate(80);
      if(opts.onMot && !test) try{ opts.onMot(dernier, retenus.slice()); }catch(e){}
      return dernier;
    }

    /* une marche de l'escalier */
    function escalierPas(t, now, info){
      if(fige) return null;
      if(esc.etape === 0){
        esc.famille = cibleFamilleAt(t);
        esc.pas.push({ etape:'famille', valeur:FAMILLES[esc.famille].t, info:info||'', retard_ms:Math.round(now-t), t:Date.now() });
        esc.etape = 1; esc.tEtape = now;
        esc.tFlash = now; esc.txtFlash = FAMILLES[esc.famille].t;
        if(navigator.vibrate) navigator.vibrate(40);
        if(opts.onEtape) try{ opts.onEtape({type:'famille', valeur:FAMILLES[esc.famille].t, pas:esc.pas.slice()}); }catch(e){}
        return { etape:'famille', valeur:FAMILLES[esc.famille].t, final:false };
      }
      if(esc.etape === 1){
        esc.page = ciblePageAt(t);
        esc.pas.push({ etape:'page', valeur:(esc.page+1)+'/'+pages(esc.famille), info:info||'', retard_ms:Math.round(now-t), t:Date.now() });
        esc.etape = 2; esc.tEtape = now;
        esc.tFlash = now; esc.txtFlash = 'page ' + (esc.page+1);
        if(navigator.vibrate) navigator.vibrate(40);
        if(opts.onEtape) try{ opts.onEtape({type:'page', valeur:esc.page+1, pas:esc.pas.slice()}); }catch(e){}
        return { etape:'page', valeur:esc.page+1, final:false };
      }
      // étape 3 : le mot
      var liste = motsPage(esc.famille, esc.page);
      var mi = cibleMotAt(t, liste.length);
      var mot = liste[mi];
      esc.pas.push({ etape:'mot', valeur:mot, info:info||'', retard_ms:Math.round(now-t), t:Date.now() });
      var parcours = esc.pas.slice();
      cols[esc.famille].retenus++;
      fige = true; tFige = now; testGel = false;
      infoGel = (info||'') + ' · escalier : ' + parcours.map(function(p){ return p.valeur; }).join(' → ');
      dernier = { mot: mot, index: esc.page*PAGE + mi, colonne: FAMILLES[esc.famille].t, ci: esc.famille,
                  taille: cols[esc.famille].liste.length, page: esc.page+1, pages: pages(esc.famille),
                  case_ms: PAS_MOT, mode:'escalier', parcours: parcours,
                  retard_ms: Math.round(now - t), test:false, t: Date.now() };
      retenus.push({ mot: mot, colonne: FAMILLES[esc.famille].t, t: Date.now(), info: info||'', mode:'escalier', parcours: parcours });
      if(navigator.vibrate) navigator.vibrate([60,50,120]);
      reinitEscalier(now);
      if(opts.onEtape) try{ opts.onEtape({type:'mot', valeur:mot, pas:parcours}); }catch(e){}
      if(opts.onMot) try{ opts.onMot(dernier, retenus.slice()); }catch(e){}
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

    return {
      demarrer: demarrer, arreter: arreter, figer: figer, degeler: degeler,
      estFige: function(){ return fige; }, dernier: function(){ return dernier; },
      vitesse: function(v){ if(v) vitesse = v; return vitesse; },
      placer: taille, equite: equite, graine: graine,
      mode: function(m){
        if(m && (m==='instant'||m==='escalier') && m!==mode){
          mode = m; reinitEscalier(performance.now()); fige = false;
        }
        return mode;
      },
      etatEscalier: function(){
        var now = performance.now();
        if(mode!=='escalier') return null;
        var cible = esc.etape===0 ? FAMILLES[cibleFamilleAt(now)].t
                  : esc.etape===1 ? ('page '+(ciblePageAt(now)+1)+'/'+pages(esc.famille))
                  : motsPage(esc.famille, esc.page)[cibleMotAt(now, motsPage(esc.famille,esc.page).length)];
        return { etape: esc.etape+1, sur: 3, cible: cible, pas: esc.pas.slice(),
                 reste_ms: esc.etape>0 ? Math.max(0, FENETRE-(now-esc.tEtape)) : null };
      },
      abandonner: abandonner,
      phrase: function(){ return retenus.map(function(r){ return r.mot; }); },
      retenus: function(){ return retenus.slice(); },
      effacerPhrase: function(){ retenus = []; },
      colonnes: function(){ return cols.map(function(c,i){
        return { famille: FAMILLES[i].t, mots: c.liste.length, pages: pages(i) }; }); },
      rotation_ms: ROTATION,
      reglages: { pas_famille_ms:PAS_FAMILLE, pas_page_ms:PAS_PAGE, pas_mot_ms:PAS_MOT,
                  mots_par_page:PAGE, fenetre_ms:FENETRE, hauteur_case_px:ROW, sejour_case_ms:DWELL }
    };
  }

  /* charge le lexique une seule fois pour toute la page.
     Le tri des mots-outils appartient à lib/lexique.js : le mur affiche ce que
     ce module offre, il ne juge pas le vocabulaire. Si le module manque (page
     ancienne, fichier absent du cache), on retombe sur le fichier brut plutôt
     que de laisser le mur vide — mieux vaut tous les mots que pas de mur. */
  var enCours = null, cache = null;
  function lexique(url){
    if(cache) return Promise.resolve(cache);
    if(enCours) return enCours;
    if(window.GBLexique){
      enCours = GBLexique.charger(url).then(function(){ cache = GBLexique.mots(); return cache; });
      return enCours;
    }
    enCours = fetch(url || '/ghost-box/data/lexique.json').then(function(r){ return r.json(); })
      .then(function(j){
        var m = (j && j.mots) ? j.mots : (Array.isArray(j) ? j : []);
        cache = m.map(function(x){ return { mot:x.mot, pos:x.pos, cat:x.categorie||'', poids:x.poids||1 }; });
        return cache;
      });
    return enCours;
  }

  return { creer: creer, lexique: lexique, FAMILLES: FAMILLES, ROW: ROW, DWELL: DWELL,
           PAGE: PAGE, PAS_FAMILLE: PAS_FAMILLE, PAS_PAGE: PAS_PAGE, PAS_MOT: PAS_MOT,
           FENETRE: FENETRE };
})();
