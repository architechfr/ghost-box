/* ═══════════════════════════════════════════════════════════════════════
   Objectif — LE bouton de changement de caméra, partout le même.

   POURQUOI CE MODULE EXISTE
   Quatre modes ouvrent une caméra, et chacun avait sa propre façon de lister
   les objectifs et d'en changer : trois fonctions `lensName()` recopiées avec
   des règles différentes, deux listes de boutons, et une seule page — la
   séance simple — où le geste était réellement au point. Demande directe :
   « il me faut dans tous les modes le moyen de changer de caméra avec le même
   bouton que dans séance simple, c'est pratique et fonctionnel. »

   CE QUE CE MODULE TIENT
   — le NOM des objectifs : « Arrière 1 / 2 / 3 » et « Avant » plutôt que les
     libellés bruts d'Android (« camera2 2, facing back »), qui ne veulent rien
     dire pour personne. Sans nom, on ne peut pas redemander celui qu'on veut ;
   — le bouton lui-même : il porte le nom de l'objectif EN COURS. « Arrière 1 »
     est à la fois l'état et la commande ;
   — la mémoire, en DEUX exemplaires : l'identifiant exact (`gb-objectif`) et
     le rang parmi les arrières (`gb-objectif-rang`) — parce que l'identifiant
     d'un objectif peut changer d'une session à l'autre, et qu'un choix
     mémorisé par identifiant seul finit par se perdre ;
   — le passage au suivant, y compris quand un objectif REFUSE de s'ouvrir
     (doublons, capteurs de profondeur) : on essaie le suivant, puis le
     suivant, et on ne dit « aucun autre objectif » qu'après les avoir tous
     tentés.

   CE QUE LA PAGE FOURNIT
   Une seule chose qu'elle est seule à savoir faire : remplacer son flux vidéo.
     GBObjectif.installer({
       hote: '#top',                     // où poser le bouton
       flux: () => vstream,              // le flux en cours (pour lire le vrai objectif)
       changer: async id => useLens(id)  // rendre true si l'objectif s'est ouvert
     });

   PIÈGE PAYÉ SUR LE TÉLÉPHONE : sur Android, les objectifs arrière partagent
   le même capteur physique. Il faut LIBÉRER le flux avant d'en demander un
   autre, sinon le second `getUserMedia` échoue en `NotReadableError` et le
   bouton paraît mort. C'est à la page de le faire dans `changer`.
   ═══════════════════════════════════════════════════════════════════════ */
window.GBObjectif = (function(){
  "use strict";

  var CLE = 'gb-objectif', CLE_RANG = 'gb-objectif-rang';
  var cfg = null, bouton = null, nomEl = null, liste = [], iCourant = 0, occupe = false, batt = 0;

  var css = document.createElement('style');
  css.textContent = [
    '#gbObj{display:none;flex:0 1 auto;min-width:0;align-items:center;gap:6px;',
      'font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11.5px;',
      'color:#DDE6EA;background:#1D262B;border:1px solid #2C383F;border-radius:11px;',
      'padding:0 11px;height:42px;cursor:pointer;letter-spacing:.03em;',
      'text-transform:none;font-weight:400;white-space:nowrap;overflow:hidden}',
    '#gbObj.on{display:inline-flex}',
    '#gbObj:active{transform:scale(.96)}',
    '#gbObj .fl{color:#5FD3A6;font-size:15px;line-height:1;flex:none}',
    '#gbObjNom{overflow:hidden;text-overflow:ellipsis}'
  ].join('');
  document.head.appendChild(css);

  /* ── nommer les objectifs, une bonne fois ──
     Les libellés ne sont donnés par le navigateur QU'APRÈS une première
     autorisation caméra : avant, ils sont vides et on ne peut rien deviner. */
  async function lister(){
    try{
      var l = await navigator.mediaDevices.enumerateDevices();
      var nAr = 0, nAv = 0;
      return l.filter(function(d){ return d.kind === 'videoinput'; })
              .map(function(d, i){
        var lab = d.label || '';
        var b = lab.toLowerCase();
        var face = /front|user|avant|selfie/.test(b) ? 'avant'
                 : /back|rear|environment|arri/.test(b) ? 'arriere' : '';
        var rang = null, nom;
        if(face === 'arriere'){ rang = ++nAr; nom = 'Arrière ' + rang; }
        else if(face === 'avant'){ nAv++; nom = 'Avant' + (nAv > 1 ? ' ' + nAv : ''); }
        else { nom = lab || ('Objectif ' + (i + 1)); }
        return { id:d.deviceId, nom:nom, brut:lab, face:face, rang:rang };
      });
    }catch(e){ return []; }
  }

  function memoire(){
    var id = null, rang = null;
    try{ id = localStorage.getItem(CLE); }catch(e){}
    try{ rang = parseInt(localStorage.getItem(CLE_RANG), 10) || null; }catch(e){}
    return { id:id, rang:rang };
  }
  function memoriser(o){
    if(!o) return;
    try{ localStorage.setItem(CLE, o.id); }catch(e){}
    try{
      if(o.rang) localStorage.setItem(CLE_RANG, String(o.rang));
      else localStorage.removeItem(CLE_RANG);
    }catch(e){}
  }
  /* l'objectif voulu, cherché d'abord par identifiant puis par RANG */
  function preferee(L){
    var m = memoire();
    if(!L || !L.length) return null;
    var t = null;
    if(m.id)   t = L.filter(function(o){ return o.id === m.id; })[0] || null;
    if(!t && m.rang) t = L.filter(function(o){ return o.rang === m.rang; })[0] || null;
    return t;
  }

  function fluxActuel(){
    try{ return cfg && cfg.flux ? cfg.flux() : null; }catch(e){ return null; }
  }
  function idActuel(){
    try{ return fluxActuel().getVideoTracks()[0].getSettings().deviceId || null; }catch(e){ return null; }
  }

  function dire(txt, ms){
    if(!nomEl) return;
    nomEl.textContent = txt;
    if(ms) setTimeout(maj, ms);
  }

  /* le bouton n'existe que si une caméra tourne : proposer de changer
     d'objectif quand il n'y en a aucun d'ouvert ne veut rien dire */
  function maj(){
    if(!bouton) return;
    var on = !!fluxActuel();
    bouton.classList.toggle('on', on);
    if(!on || occupe) return;
    var id = idActuel();
    if(id){
      for(var i=0;i<liste.length;i++) if(liste[i].id === id){ iCourant = i; break; }
    }
    var nom = liste[iCourant] ? liste[iCourant].nom : 'objectif';
    if(nomEl.textContent !== nom) nomEl.textContent = nom;
  }

  async function rafraichirListe(){
    liste = await lister();
    maj();
    return liste;
  }

  async function choisir(i, muet){
    if(!liste[i] || !cfg || !cfg.changer) return false;
    var ok = false;
    try{ ok = await cfg.changer(liste[i].id); }catch(e){ ok = false; }
    if(ok){
      iCourant = i;
      memoriser(liste[i]);
      if(!muet) maj();
      if(cfg.apres){ try{ cfg.apres(liste[i]); }catch(e){} }
    }
    return ok;
  }

  async function suivant(){
    if(occupe) return;
    if(!fluxActuel()){ dire('caméra fermée', 1600); return; }
    if(!liste.length) await rafraichirListe();
    if(liste.length < 2){ dire('un seul objectif', 1800); return; }
    occupe = true;
    dire('changement…');
    var ok = false;
    // certains objectifs listés par le téléphone refusent toujours de s'ouvrir
    // (doublons, capteurs de profondeur) : on passe au suivant plutôt que de
    // rester bloqué sur un bouton qui « ne fait rien »
    for(var n = 1; n < liste.length && !ok; n++){
      ok = await choisir((iCourant + n) % liste.length, true);
    }
    occupe = false;
    if(ok){ await rafraichirListe(); }
    else dire('aucun autre objectif', 2200);
  }

  function installer(c){
    cfg = c || {};
    bouton = document.getElementById('gbObj');
    if(!bouton){
      bouton = document.createElement('button');
      bouton.id = 'gbObj'; bouton.type = 'button';
      bouton.setAttribute('aria-label', "Changer d'objectif");
      bouton.innerHTML = '<span class="fl">⟳</span><span id="gbObjNom">objectif</span>';
      var h = cfg.hote ? document.querySelector(cfg.hote) : null;
      var av = cfg.avant ? document.querySelector(cfg.avant) : null;
      // la place du bouton dans la barre compte : il se lit avec les autres
      // commandes, pas après elles
      if(av && av.parentNode) av.parentNode.insertBefore(bouton, av);
      else (h || document.body).appendChild(bouton);
    }
    nomEl = document.getElementById('gbObjNom');
    bouton.addEventListener('click', suivant);
    rafraichirListe();
    /* ── le bouton se tient à jour TOUT SEUL ──
       Une page peut ouvrir ou fermer sa caméra à n'importe quel moment, et
       exiger qu'elle pense à prévenir, c'est se préparer à l'oublier — c'est
       exactement ce qui est arrivé dans deux modes sur quatre au premier
       essai. Un battement discret suffit : le bouton apparaît dès qu'un flux
       existe, disparaît dès qu'il n'y en a plus. */
    if(!batt) batt = setInterval(function(){
      maj();
      /* Les libellés n'existent qu'APRÈS la première autorisation caméra :
         avant, `enumerateDevices` rend bien des entrées, mais SANS NOM — la
         liste n'est donc pas vide, elle est anonyme, et attendre qu'elle soit
         vide pour la relire revient à garder « Objectif 1, 2, 3 » toute la
         séance. On relit dès qu'une caméra tourne et qu'aucun nom n'est
         encore connu. */
      if(!fluxActuel() || occupe) return;
      var nomme = liste.some(function(o){ return !!o.brut; });
      // et si l'objectif RÉELLEMENT ouvert n'est pas dans notre liste, c'est
      // que la liste date d'avant l'autorisation : on la relit
      var id = idActuel();
      var connu = !id || liste.some(function(o){ return o.id === id; });
      if(!liste.length || !nomme || !connu) rafraichirListe();
    }, 700);
    return API;
  }

  var API = {
    installer: installer,
    lister: lister,
    liste: function(){ return liste.slice(); },
    rafraichir: rafraichirListe,
    maj: maj,
    suivant: suivant,
    choisir: choisir,
    courant: function(){ return liste[iCourant] || null; },
    nom: function(){ return liste[iCourant] ? liste[iCourant].nom : 'Objectif'; },
    preferee: preferee,
    memoriser: memoriser,
    memoire: memoire,
    element: function(){ return bouton; }
  };
  return API;
})();
