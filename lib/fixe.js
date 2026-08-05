/* ═══════════════════════════════════════════════════════════════════════
   Écran fixe — la position de travail, la même partout.

   POURQUOI CE MODULE EXISTE
   L'écran fixe est né dans la séance capteurs, puis a été recopié à la main
   dans la séance caméra et dans Écoute. Trois copies : trois vocabulaires
   (`filming`, `assis`), trois bandeaux, trois sorties, et des différences de
   comportement qui n'avaient aucune raison d'être. Or c'est l'écran que
   l'utilisateur passe sa soirée à regarder : téléphone posé, tourné vers la
   pièce, plus rien à toucher. Il doit être IDENTIQUE d'un mode à l'autre —
   même bandeau, même façon de composer son poste, même sortie au même
   endroit. Un repère qui change de place n'est plus un repère.

   CE QUE FAIT CE MODULE
   — il pose les classes `gbx` sur <html> et <body> : la page décide ensuite,
     dans SON css à elle, où vont ses bandes ;
   — il dessine le bandeau du haut : les informations de la page à gauche
     (fournies par `infos()`), les boutons de composition à droite ;
   — il mémorise chaque module coché sous `gb-fixe-<page>-<clé>` : on retrouve
     son poste tel qu'on l'avait laissé, sans le remonter chaque soir ;
   — il pose une classe `avec<clé>` sur <body> pour chaque module allumé :
     c'est le seul contrat avec le css de la page ;
   — il garantit UNE SORTIE : bouton ✕ toujours visible, touche Échap, et
     sortie automatique si le plein écran est quitté par le geste système
     (règle 8nonies-000b : un écran doit TOUJOURS avoir une sortie) ;
   — il tient l'écran allumé (GBWake) et empêche le défilement au doigt.

   CE QU'IL NE FAIT PAS — ET N'A PAS LE DROIT DE FAIRE
   Il ne pose JAMAIS de style de position en ligne sur un élément de la page.
   Une position écrite en ligne gagne contre toute feuille de style, y compris
   celle de la page : c'est ainsi qu'une caméra flottante déplaçable au doigt
   se retrouvait à écraser la mise en page de l'écran fixe. La seule chose
   qu'il écrit est la VARIABLE `--gbx-bar`, la hauteur mesurée de son propre
   bandeau, dont la page a besoin pour poser sa première bande dessous.
   ═══════════════════════════════════════════════════════════════════════ */
window.GBFixe = (function(){

  var cfg = null;          // configuration de la page
  var on = false;          // écran fixe allumé ?
  var prop = {};           // état des modules que ce module gère lui-même
  var barre = null, quit = null, tick = 0, hBar = 0;

  /* ── l'habillage : bandeau, boutons, sortie ──
     Volontairement le seul css de ce module. Tout ce qui concerne la mise en
     bandes appartient à la page : elle seule sait ce qu'elle empile. */
  var css = document.createElement('style');
  css.textContent = [
    'html.gbx{height:100%;overflow:hidden}',
    'body.gbx{position:fixed;inset:0;width:100%;height:100%;margin:0;padding:0;',
      'overflow:hidden;overscroll-behavior:none;touch-action:none}',
    /* le bouton plein écran flottant recouvrait la sortie et interceptait les
       appuis : en écran fixe il s'efface, ✕ fait le même travail */
    'body.gbx #fsFloat{display:none !important}',
    '#gbxBar{display:none}',
    'body.gbx #gbxBar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;',
      'position:fixed;left:0;right:0;top:0;z-index:60;',
      'padding:calc(6px + env(safe-area-inset-top, 0px)) 92px 7px 10px;',
      'background:linear-gradient(180deg,rgba(4,8,11,.96),rgba(4,8,11,.82));',
      'border-bottom:1px solid rgba(95,211,166,.20);',
      'font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11px;color:#DDE6EA}',
    '.gbx-chip{display:inline-flex;align-items:baseline;gap:5px;padding:3px 7px;border-radius:2px;',
      'background:rgba(95,211,166,.07);border:1px solid rgba(95,211,166,.16);white-space:nowrap}',
    '.gbx-chip .k{font-family:"Barlow Condensed","Arial Narrow",sans-serif;text-transform:uppercase;',
      'letter-spacing:.12em;font-size:8.5px;color:#6E8089}',
    '.gbx-chip .v{font-size:11.5px;color:#DDE6EA}',
    '.gbx-chip.on{background:rgba(95,211,166,.16);border-color:rgba(95,211,166,.5)}',
    '.gbx-chip.alerte{background:rgba(233,180,76,.16);border-color:rgba(233,180,76,.55)}',
    '.gbx-chip.alerte .v{color:#F3D48A}',
    '.gbx-mods{display:inline-flex;flex-wrap:wrap;gap:5px;margin-left:auto}',
    '.gbx-mods button{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:9px;',
      'letter-spacing:.08em;text-transform:uppercase;padding:4px 7px;border-radius:3px;',
      'border:1px solid #2C383F;background:rgba(10,15,18,.7);color:#78868E;cursor:pointer}',
    '.gbx-mods button.on{border-color:#5FD3A6;color:#5FD3A6}',
    /* un bouton d'ACTION doit se reconnaître comme tel : même langage visuel
       que le bouton d'objectif de la barre (⟳ vert + nom), pas une étiquette
       grise — habillé en pastille d'état, il était invisible comme commande */
    '.gbx-mods button.acte{border-color:#3E6B5A;color:#DDE6EA;text-transform:none;',
      'letter-spacing:.02em;font-size:10.5px;padding:5px 9px;border-radius:9px;',
      'background:rgba(20,30,27,.85)}',
    '.gbx-mods button.acte::before{content:"⟳ ";color:#5FD3A6;font-size:12px}',
    '.gbx-mods button:active{transform:translateY(1px)}',
    /* la sortie : toujours au même endroit, au-dessus de tout, jamais recouverte.
       Le bandeau se réserve 92 px de marge à droite pour ne pas passer dessous. */
    '#gbxQuit{display:none}',
    'body.gbx #gbxQuit{display:inline-flex;align-items:center;gap:5px;position:fixed;z-index:62;',
      'right:10px;top:calc(env(safe-area-inset-top, 0px) + 6px);',
      'padding:7px 10px;border-radius:3px;cursor:pointer;',
      'font-family:"Barlow Condensed","Arial Narrow",sans-serif;text-transform:uppercase;',
      'letter-spacing:.14em;font-weight:600;font-size:12px;',
      'background:rgba(4,8,11,.92);border:1px solid rgba(95,211,166,.45);color:#5FD3A6}',
    'body.gbx #gbxQuit:active{transform:translateY(1px)}'
  ].join('');
  document.head.appendChild(css);

  function esc(s){ return String(s).replace(/[&<>]/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; }); }

  function cle(m){ return 'gb-fixe-' + (cfg && cfg.page ? cfg.page : 'x') + '-' + m.cle; }

  /* un module « délégué » a son propre interrupteur dans la page (actif/basculer) ;
     un module « propre » est tenu ici, et mémorisé */
  function estActif(m){
    if(typeof m.actif === 'function'){ try{ return !!m.actif(); }catch(e){ return false; } }
    return !!prop[m.cle];
  }
  function poserModule(m, v){
    if(typeof m.basculer === 'function'){ try{ m.basculer(v); }catch(e){} return; }
    prop[m.cle] = (v == null) ? !prop[m.cle] : !!v;
    try{ localStorage.setItem(cle(m), prop[m.cle] ? '1' : '0'); }catch(e){}
  }

  var mods = function(){ return (cfg && cfg.modules) || []; };

  /* les classes `avec<clé>` : le seul contrat entre ce module et le css de la
     page. Par défaut elles n'existent QUE dans l'écran fixe — le mode normal
     de la page garde sa mise en page à lui. Un module marqué `toujours`
     (le mur, par exemple, qui s'affiche aussi dans la page normale) garde sa
     classe en dehors. */
  function appliquer(){
    var b = document.body; if(!b) return;
    mods().forEach(function(m){
      if(m.action) return;          // un bouton d'action ne commande aucune bande
      var a = estActif(m);
      b.classList.toggle('avec' + m.cle, m.toujours ? a : (on && a));
    });
  }

  function chip(k, v, ton){
    return '<span class="gbx-chip' + (ton ? ' ' + ton : '') + '"><span class="k">' + esc(k) +
           '</span><span class="v">' + esc(v) + '</span></span>';
  }

  function rafraichir(){
    if(!on || !barre) return;
    var h = '';
    /* deux façons de remplir le bandeau, au choix de la page :
       — `infos()` rend une liste de {k,v} : la page dit CE QU'ELLE SAIT, la
         mise en forme est commune — c'est la voie normale ;
       — `bandeau()` rend du html : réservé aux pages dont le bandeau porte
         plus qu'un alignement de pastilles (le vu-mètre de la séance caméra,
         par exemple). Les boutons de composition sont ajoutés à la suite dans
         les deux cas : l'utilisateur les retrouve toujours au même endroit. */
    if(cfg && typeof cfg.bandeau === 'function'){
      try{ h += cfg.bandeau() || ''; }catch(e){}
    } else if(cfg && typeof cfg.infos === 'function'){
      var L = [];
      try{ L = cfg.infos() || []; }catch(e){ L = []; }
      L.forEach(function(i){ if(i) h += chip(i.k, i.v, i.ton || ''); });
    }
    h += '<span class="gbx-mods">';
    mods().forEach(function(m){
      if(m.visible && !m.visible()) return;
      var lab = (typeof m.label === 'function') ? m.label() : m.label;
      /* un module `action` n'a pas d'état allumé/éteint : c'est un bouton qui
         FAIT quelque chose (passer à l'objectif suivant, par exemple) et dont
         le libellé dit où l'on en est. Il se distingue à l'œil des bascules,
         sinon on croit avoir éteint ce qu'on vient d'actionner. */
      if(m.action){
        h += '<button type="button" data-gbx="' + esc(m.cle) + '" class="acte">' + esc(lab) + '</button>';
        return;
      }
      h += '<button type="button" data-gbx="' + esc(m.cle) + '" class="' + (estActif(m) ? 'on' : '') +
           '">' + esc(lab) + '</button>';
    });
    h += '</span>';
    barre.innerHTML = h;
    mesurer();
  }

  /* la hauteur du bandeau varie avec le nombre de pastilles : la page en a
     besoin pour poser sa première bande juste dessous. C'est une VARIABLE,
     pas une position — la nuance est tout l'objet de la règle. */
  function mesurer(){
    if(!barre) return;
    var h = barre.offsetHeight;
    if(h && Math.abs(h - hBar) > 2){
      hBar = h;
      document.documentElement.style.setProperty('--gbx-bar', h + 'px');
      if(cfg && typeof cfg.replacer === 'function') setTimeout(function(){ try{ cfg.replacer(); }catch(e){} }, 60);
    }
  }

  function entrer(v){
    var cible = (v == null) ? !on : !!v;
    if(cible === on){ appliquer(); return on; }
    on = cible;
    document.documentElement.classList.toggle('gbx', on);
    document.body.classList.toggle('gbx', on);
    /* les pages écrites avant ce module gardent leur nom de classe à elles :
       tout leur css continue de s'appliquer tel quel, et l'habillage commun
       (bandeau, boutons, sortie ✕) s'ajoute par-dessus sans rien réécrire */
    if(cfg && cfg.classe){
      document.documentElement.classList.toggle(cfg.classe, on);
      document.body.classList.toggle(cfg.classe, on);
    }
    appliquer();
    if(cfg && cfg.bouton){
      var b = document.querySelector(cfg.bouton);
      if(b){ b.classList.toggle('on', on); if(cfg.texteBouton !== false) b.textContent = on ? 'Quitter' : 'Écran fixe'; }
    }
    if(on){
      try{ if(window.GBWake) GBWake.on(); }catch(e){}
      var el = document.documentElement, rq = el.requestFullscreen || el.webkitRequestFullscreen;
      if(rq){ try{ var r = rq.call(el, {navigationUI:'hide'}); if(r && r.catch) r.catch(function(){}); }catch(e){} }
      try{ window.scrollTo(0,0); }catch(e){}
      if(cfg && typeof cfg.entrer === 'function'){ try{ cfg.entrer(); }catch(e){} }
      rafraichir();
      /* l'écran fixe vit TOUT SEUL : c'est la position de travail, y compris
         avant d'avoir lancé quoi que ce soit. Sans ce battement, le bandeau
         n'existerait que pendant une séance en cours — écran mort sinon. */
      if(!tick) tick = setInterval(rafraichir, (cfg && cfg.rythme) || 500);
    } else {
      if(tick){ clearInterval(tick); tick = 0; }
      hBar = 0;
      document.documentElement.style.removeProperty('--gbx-bar');
      if(cfg && typeof cfg.sortir === 'function'){ try{ cfg.sortir(); }catch(e){} }
      if(document.fullscreenElement || document.webkitFullscreenElement){
        try{ (document.exitFullscreen || document.webkitExitFullscreen).call(document); }catch(e){}
      }
    }
    if(cfg && typeof cfg.replacer === 'function') setTimeout(function(){ try{ cfg.replacer(); }catch(e){} }, 90);
    return on;
  }

  function installer(c){
    cfg = c || {};
    /* état mémorisé des modules tenus ici */
    mods().forEach(function(m){
      if(typeof m.actif === 'function') return;      // la page le tient elle-même
      var v = null;
      try{ v = localStorage.getItem(cle(m)); }catch(e){}
      prop[m.cle] = (v == null) ? (m.defaut !== false) : (v === '1');
    });

    /* une page peut fournir SON bandeau (celles qui en avaient déjà un, avec
       leur propre mise en page) : on le remplit au lieu d'en poser un second.
       Sinon on en crée un, habillé par le css de ce module. */
    barre = cfg.barre ? document.querySelector(cfg.barre) : null;
    if(!barre){
      barre = document.getElementById('gbxBar');
      if(!barre){ barre = document.createElement('div'); barre.id = 'gbxBar'; document.body.appendChild(barre); }
    }
    quit = document.getElementById('gbxQuit');
    if(!quit){
      quit = document.createElement('button'); quit.id = 'gbxQuit'; quit.type = 'button';
      quit.textContent = '✕ Quitter'; quit.setAttribute('aria-label', "Quitter l'écran fixe");
      document.body.appendChild(quit);
    }
    quit.addEventListener('click', function(){ entrer(false); });

    /* les boutons sont refaits à chaque rafraîchissement : un seul écouteur
       délégué survit à tous les innerHTML */
    barre.addEventListener('click', function(e){
      var b = e.target.closest('[data-gbx]'); if(!b) return;
      var m = null;
      mods().forEach(function(x){ if(x.cle === b.dataset.gbx) m = x; });
      if(!m) return;
      if(m.action){
        try{ m.action(); }catch(e2){}
        setTimeout(rafraichir, m.delai || 400);
        return;
      }
      poserModule(m, null);
      appliquer();
      rafraichir();
      /* certains modules mettent du temps à répondre (ouverture de caméra) :
         on repasse un peu plus tard pour montrer l'état RÉEL, pas l'intention */
      setTimeout(function(){ appliquer(); rafraichir();
        if(cfg && typeof cfg.replacer === 'function'){ try{ cfg.replacer(); }catch(e2){} } }, m.delai || 400);
    });

    if(cfg.bouton){
      var bt = document.querySelector(cfg.bouton);
      if(bt) bt.addEventListener('click', function(){ entrer(null); });
    }

    /* la sortie, par tous les chemins possibles */
    addEventListener('fullscreenchange', function(){
      if(!document.fullscreenElement && on) entrer(false);
    });
    addEventListener('keydown', function(e){ if(e.key === 'Escape' && on) entrer(false); });
    addEventListener('touchmove', function(e){ if(on) e.preventDefault(); }, {passive:false});
    addEventListener('resize', function(){ if(on) setTimeout(mesurer, 80); });

    appliquer();
    return API;
  }

  var API = {
    installer: installer,
    entrer: function(){ return entrer(true); },
    sortir: function(){ return entrer(false); },
    basculer: function(v){ return entrer(v == null ? null : v); },
    actif: function(){ return on; },
    module: function(k){ var r = false; mods().forEach(function(m){ if(m.cle === k) r = estActif(m); }); return r; },
    poser: function(k, v){ mods().forEach(function(m){ if(m.cle === k) poserModule(m, v); }); appliquer(); rafraichir(); },
    rafraichir: rafraichir,
    mesurer: mesurer,
    appliquer: appliquer
  };
  return API;
})();
