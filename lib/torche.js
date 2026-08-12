/* ═══════════════════════════════════════════════════════════════════════
   La torche — parce que les séances se font dans le noir.

   CE QUE C'EST, TECHNIQUEMENT
   Un téléphone n'a pas de « lampe » indépendante : la LED appartient à la
   CAMÉRA ARRIÈRE. On l'allume en posant une contrainte `torch:true` sur une
   piste vidéo VIVANTE. Conséquences directes, et il faut les dire :
   — le navigateur signalera que la caméra est utilisée, même si aucune image
     n'est affichée : c'est normal, la lampe EST une fonction de la caméra ;
   — si la piste s'arrête, la lampe s'éteint. Toujours. On garde donc la piste
     ouverte tant que la lampe brûle ;
   — deux `getUserMedia` sur la MÊME caméra physique échouent en
     `NotReadableError` sur Android. Ce module n'ouvre donc JAMAIS un flux si
     la page en a déjà un : elle le lui donne (`adopter`). C'est la règle la
     plus importante de ce fichier.

   CE QUE ÇA COÛTE À LA MESURE — et c'est le vrai sujet
   Allumer la torche change complètement ce que la caméra voit : luminance,
   exposition automatique, bruit du capteur, contraste des mouvements. La
   normale apprise dans le noir ne décrit plus rien. Si on la gardait, le
   premier relevé après allumage sortirait à des dizaines de σ — et un mot
   sortirait POUR UNE LAMPE. Ce serait la pire trahison possible du principe
   de l'appareil.

   La réponse honnête n'est pas de « filtrer », c'est de RÉAPPRENDRE : à chaque
   allumage et à chaque extinction, les voies caméra effacent leur normale et
   se taisent le temps de réapprendre le lieu éclairé. Les autres voies (son,
   magnétique, mouvement du téléphone) ne sont pas concernées et continuent.

   Ce module se contente donc de deux choses : allumer la lampe, et PRÉVENIR.
   Ce que les pages font de l'avertissement les regarde ; ce qu'elles ne
   peuvent pas faire, c'est ne pas être prévenues.
   ═══════════════════════════════════════════════════════════════════════ */
window.GBTorche = (function(){
  "use strict";

  var piste = null;        // la piste vidéo qui porte la lampe
  var propre = false;      // vrai si c'est NOUS qui avons ouvert le flux
  var flux = null;         // le flux que nous possédons, le cas échéant
  var etat = false;        // lampe allumée ?
  var depuisT = 0;         // performance.now() de l'allumage
  var pourquoi = '';       // raison d'indisponibilité, en français
  var ecoute = [];

  function prevenir(info){
    for(var i=0;i<ecoute.length;i++){
      try{ ecoute[i](etat, info || {}); }catch(e){}
    }
  }

  /* ── la piste sait-elle allumer ? ──
     `getCapabilities` est la voie normale (Chrome Android). Certains appareils
     n'annoncent rien mais acceptent la contrainte : on ne déclare donc pas
     « impossible » avant d'avoir essayé une fois. */
  function capacites(t){
    if(!t || t.readyState !== 'live') return null;
    try{ return (t.getCapabilities ? t.getCapabilities() : null) || null; }catch(e){ return null; }
  }
  function annonceTorche(t){
    var c = capacites(t);
    if(!c) return null;                       // rien annoncé : indécidable
    if(c.torch === true) return true;
    if(c.fillLightMode && c.fillLightMode.length &&
       (c.fillLightMode.indexOf('flash')>=0 || c.fillLightMode.indexOf('torch')>=0)) return true;
    if('torch' in c) return false;            // annoncé et faux : tranché
    return null;
  }

  /* ── la page nous confie SA piste : aucun second getUserMedia ── */
  function adopter(src){
    var t = null;
    if(!src) t = null;
    else if(src.getVideoTracks) t = src.getVideoTracks()[0] || null;
    else if(src.kind === 'video') t = src;
    if(t === piste) return capable();
    // si nous possédions un flux à nous et que la page nous en donne un vrai,
    // on rend la caméra : deux flux sur le même objectif ne cohabitent pas
    if(t && propre) fermerPropre();
    piste = t; if(t) propre = false;
    if(piste){
      piste.addEventListener('ended', function(){
        if(piste && piste.readyState !== 'live'){
          var etait = etat; etat = false; piste = null;
          if(etait) prevenir({ cause:'piste perdue' });
        }
      });
      // la lampe brûlait sur l'ancienne piste : on la rallume sur la nouvelle
      if(etat) poser(true).catch(function(){});
    }
    return capable();
  }
  function oublier(){
    if(propre){ fermerPropre(); }
    else { piste = null; }
    if(etat){ etat = false; prevenir({ cause:'piste rendue' }); }
  }

  function fermerPropre(){
    try{ if(flux) flux.getTracks().forEach(function(t){ t.stop(); }); }catch(e){}
    flux = null; piste = null; propre = false;
  }

  /* ── ouvrir un flux minuscule, uniquement si la page n'en a pas ──
     320×240 : on ne veut pas d'image, on veut la LED. Autant ne pas chauffer
     le téléphone pour un flux que personne ne regarde. */
  function ouvrir(){
    if(piste && piste.readyState === 'live') return Promise.resolve(piste);
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      pourquoi = 'ce navigateur ne donne pas accès à la caméra';
      return Promise.reject(new Error(pourquoi));
    }
    var essais = [
      { video:{ facingMode:{ exact:'environment' }, width:{ ideal:320 }, height:{ ideal:240 } }, audio:false },
      { video:{ facingMode:{ ideal:'environment' } }, audio:false },
      { video:true, audio:false }
    ];
    var i = 0;
    function suivant(){
      if(i >= essais.length){
        pourquoi = 'aucune caméra arrière accessible (occupée par une autre application ?)';
        return Promise.reject(new Error(pourquoi));
      }
      return navigator.mediaDevices.getUserMedia(essais[i++])
        .then(function(st){
          flux = st; propre = true;
          piste = st.getVideoTracks()[0] || null;
          return piste;
        })
        .catch(function(){ return suivant(); });
    }
    return suivant();
  }

  /* ── poser la contrainte ── */
  function poser(v){
    if(!piste || piste.readyState !== 'live') return Promise.reject(new Error('pas de piste vidéo'));
    return piste.applyConstraints({ advanced:[{ torch: !!v }] })
      .catch(function(){
        // certains appareils ne connaissent que l'ancien nom
        return piste.applyConstraints({ advanced:[{ fillLightMode: v ? 'flash' : 'off' }] });
      });
  }

  /* ── l'état de disponibilité, tel qu'on peut l'affirmer ──
     'oui' — la piste l'annonce ; 'non' — la piste dit explicitement non ;
     'peut-être' — rien à quoi se fier avant d'avoir une piste ou d'avoir essayé */
  function capable(){
    var a = annonceTorche(piste);
    if(a === true) return 'oui';
    if(a === false){ pourquoi = 'cet appareil (ou cet objectif) n\'a pas de lampe pilotable'; return 'non'; }
    return 'peut-être';
  }
  function raison(){ return pourquoi; }
  function allumee(){ return etat; }
  function depuis(){ return etat ? (performance.now() - depuisT) : 0; }
  function aNous(){ return propre; }

  function allumer(){
    if(etat) return Promise.resolve(true);
    return ouvrir()
      .then(function(){ return poser(true); })
      .then(function(){
        etat = true; depuisT = performance.now(); pourquoi = '';
        prevenir({ cause:'allumage' });
        return true;
      })
      .catch(function(e){
        if(!pourquoi) pourquoi = 'la lampe a refusé de s\'allumer (' + (e && e.name ? e.name : 'erreur') + ')';
        etat = false;
        // flux ouvert pour rien : on rend la caméra plutôt que de la garder occupée
        if(propre) fermerPropre();
        prevenir({ cause:'échec', erreur:pourquoi });
        throw e;
      });
  }

  function eteindre(){
    if(!etat){ if(propre) fermerPropre(); return Promise.resolve(false); }
    return poser(false)
      .catch(function(){})    // même si la contrainte échoue, couper le flux éteindra
      .then(function(){
        etat = false;
        if(propre) fermerPropre();   // notre flux n'avait qu'une raison d'être
        prevenir({ cause:'extinction' });
        return false;
      });
  }

  function basculer(){ return etat ? eteindre() : allumer(); }

  /* ── être prévenu ──
     cb(etat, info). C'est ICI que les pages doivent relancer l'apprentissage
     de leurs voies caméra : voir GBMoteur.relancer(). */
  function surChangement(cb){ if(typeof cb === 'function') ecoute.push(cb); }

  /* ── brancher un bouton ──
     Ce module ne s'occupe QUE du bouton : son libellé, sa classe, son aria.
     La ligne d'état, elle, appartient à `honnete()` — un seul écrivain pour un
     seul texte. Au premier essai les deux écrivaient au même endroit, et comme
     le bouton repeignait APRÈS la bascule, c'est toujours sa phrase générique
     qui gagnait : l'utilisateur ne voyait jamais que les voies caméra venaient
     de se taire. Un avertissement écrasé par une politesse.

     opts.libelle — préfixe du libellé ; `false` (ou un bouton qui contient déjà
     une icône) laisse le contenu du bouton intact. */
  function brancher(btn, opts){
    if(!btn) return;
    opts = opts || {};
    var nom = opts.libelle || 'Torche';
    var icone = btn.children.length > 0 || opts.libelle === false;
    function peindre(){
      if(!icone) btn.textContent = nom + (etat ? ' allumée' : '');
      btn.classList.toggle('on', etat);
      btn.setAttribute('aria-pressed', etat ? 'true' : 'false');
    }
    btn.addEventListener('click', function(){
      btn.disabled = true;
      basculer().catch(function(){}).then(function(){ btn.disabled = false; peindre(); });
    });
    surChangement(peindre);
    peindre();
  }

  /* le texte au repos : ce qu'il faut savoir AVANT d'appuyer */
  function auRepos(){
    if(capable() === 'non') return 'Pas de lampe pilotable sur cet appareil'
      + (pourquoi ? ' — ' + pourquoi : '') + '.';
    if(pourquoi) return pourquoi.charAt(0).toUpperCase() + pourquoi.slice(1) + '.';
    return 'Sur un téléphone la lampe appartient à la caméra arrière : l\'appareil signalera '
      + 'la caméra comme active, c\'est normal. Chaque allumage et chaque extinction fait '
      + 'réapprendre les voies caméra — elles se taisent le temps de reconnaître le lieu.';
  }

  /* ── le branchement HONNÊTE, en un appel ──
     C'est la partie qui compte. Elle est ici, en un seul exemplaire, pour que
     les cinq modes ne puissent pas diverger : le jour où un mode oublierait de
     réapprendre, il sortirait des mots pour une lampe et personne ne le verrait.

     opts.voies()   — l'objet { code: témoin } de la page
     opts.camera    — les codes concernés (défaut : cam_lum, cam_diff)
     opts.flux()    — le flux caméra déjà ouvert par la page, s'il existe
     opts.moteur    — GBMoteur (passé pour ne pas supposer l'ordre de chargement)
     opts.reapp     — nombre de mesures à réapprendre (défaut 300 ≈ 30 s à 10 Hz)
     opts.noter(t)  — journal
     opts.dit(t)    — ligne d'état visible */
  function honnete(opts){
    opts = opts || {};
    var M = opts.moteur || window.GBMoteur;
    var codes = opts.camera || ['cam_lum','cam_diff'];
    var n = opts.reapp || 300;
    if(opts.flux){ try{ adopter(opts.flux()); }catch(e){} }
    if(opts.dit) try{ opts.dit(auRepos()); }catch(e){}
    surChangement(function(e, info){
      if(opts.flux){ try{ adopter(opts.flux()); }catch(err){} }
      var W = opts.voies ? (opts.voies() || {}) : {}, touchees = 0;
      if(M && M.relancer) for(var i=0;i<codes.length;i++){
        if(W[codes[i]]){ M.relancer(W[codes[i]], n); touchees++; }
      }
      var pl = touchees > 1;
      var t = (e ? 'Torche allumée' : 'Torche éteinte')
        + (info && info.erreur ? ' — ' + info.erreur : '')
        + (touchees
            ? ' · ' + touchees + (pl ? ' voies caméra effacent leur normale et réapprennent'
                                     : ' voie caméra efface sa normale et réapprend')
              + ' le lieu ' + (e ? 'éclairé' : 'sombre') + ' : '
              + Math.round(n/10) + ' s de silence sur '
              + (pl ? 'ces voies-là' : 'cette voie-là') + ', le reste continue'
            : '')
        + '.';
      if(opts.noter) try{ opts.noter(t); }catch(err){}
      if(opts.dit) try{ opts.dit(t); }catch(err){}
    });
  }

  return { adopter:adopter, oublier:oublier, allumer:allumer, eteindre:eteindre,
           honnete:honnete,
           basculer:basculer, allumee:allumee, capable:capable, raison:raison,
           depuis:depuis, aNous:aNous, surChangement:surChangement, auRepos:auRepos,
           brancher:brancher, piste:function(){ return piste; } };
})();
