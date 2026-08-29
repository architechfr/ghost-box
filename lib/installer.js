/* ═══════════════════════════════════════════════════════════════════════
   installer.js — l'installation ne se cherche pas dans un menu.

   POURQUOI ce fichier existe : sur Android, une vraie installation fabrique
   un WebAPK — c'est lui qui range l'application dans le tiroir, à côté des
   autres. Quand le navigateur n'y arrive pas, il retombe SANS RIEN DIRE sur
   un simple raccourci : une icône sur le bureau, rien dans le menu des
   applications. Vu du dehors, les deux se ressemblent ; et l'entrée du menu
   du navigateur change de nom d'une version à l'autre, si bien qu'on ne sait
   jamais lequel des deux on est en train de créer.

   On capte donc l'événement que le navigateur émet quand il juge le site
   installable, et on le rend à l'application sous forme d'un bouton. Si le
   bouton apparaît, l'installation sera une vraie. S'il n'apparaît pas, ce
   n'est pas un mystère : etat() dit laquelle des conditions manque.
   ═══════════════════════════════════════════════════════════════════════ */

(function(){
  "use strict";

  const G = window.GBInstall = { promesse:null, temoins:[] };

  /* Le navigateur propose l'installation une seule fois et attend une
     réponse immédiate. On l'intercepte pour la garder sous la main : sans
     ça, la proposition passe et ne revient pas. */
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    G.promesse = e;
    prevenir();
  });
  window.addEventListener('appinstalled', () => { G.promesse = null; prevenir(); });

  function prevenir(){ G.temoins.forEach(f => { try{ f(); }catch(e){} }); }
  G.surChangement = function(f){ G.temoins.push(f); f(); };

  /* Lancée depuis l'écran d'accueil, la page n'a plus de barre d'adresse :
     c'est la seule marque fiable qu'une installation a eu lieu. */
  G.installee = () =>
    matchMedia('(display-mode: fullscreen)').matches ||
    matchMedia('(display-mode: standalone)').matches ||
    matchMedia('(display-mode: minimal-ui)').matches ||
    navigator.standalone === true;

  G.disponible = () => !!G.promesse;

  /* Retourne 'acceptee', 'refusee' ou 'indisponible'. La proposition est
     consommée par l'appel : on la jette ensuite, elle ne vaut plus rien. */
  G.installer = async function(){
    if(!G.promesse) return 'indisponible';
    const p = G.promesse;
    G.promesse = null;
    try{
      p.prompt();
      const r = await p.userChoice;
      prevenir();
      return r && r.outcome === 'accepted' ? 'acceptee' : 'refusee';
    }catch(e){ prevenir(); return 'indisponible'; }
  };

  /* Les conditions que le navigateur exige, vérifiées une par une. Aucune
     n'est devinée : chacune se lit sur la page elle-même. */
  G.etat = async function(){
    const l = [];
    l.push(['Connexion sécurisée', location.protocol === 'https:' ||
            location.hostname === 'localhost']);

    let reg = null;
    try{ reg = await navigator.serviceWorker.getRegistration(); }catch(e){}
    l.push(['Service de cache actif', !!(reg && reg.active)]);
    l.push(['Service de cache aux commandes',
            !!(navigator.serviceWorker && navigator.serviceWorker.controller)]);

    const lien = document.querySelector('link[rel="manifest"]');
    let manifeste = false, icones = false;
    if(lien){
      try{
        const r = await fetch(lien.href, {cache:'no-store'});
        if(r.ok){
          const m = await r.json();
          manifeste = !!(m.name || m.short_name) && !!m.start_url;
          icones = Array.isArray(m.icons) && m.icons.some(i => /192|512/.test(i.sizes||''));
        }
      }catch(e){}
    }
    l.push(['Fiche d\'application lisible', manifeste]);
    l.push(['Icônes déclarées', icones]);

    return l;
  };
})();
