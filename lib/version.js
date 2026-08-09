/* ═══════════════════════════════════════════════════════════════════════
   Version affichée, et mise à jour visible.

   POURQUOI CE FICHIER EXISTE
   Deux fois de suite, la question a été : « est-ce bien en ligne et
   fonctionnel ? » — et les deux fois la réponse était oui, mais le téléphone
   servait une copie en cache de la version d'avant. Personne ne peut
   travailler comme ça : on croit tester un correctif, on teste l'ancien
   fichier, et on conclut que le correctif ne marche pas.

   Le service worker fait pourtant ce qu'il faut (`skipWaiting`,
   `clients.claim`, pages en réseau-d'abord). Le trou n'est pas technique, il
   est HUMAIN : rien à l'écran ne dit quelle version tourne. Alors :

   1. Le NUMÉRO est lu sur la page elle-même — le `?v=NN` que portent ses
      propres balises `<script>`. Ce n'est pas une constante recopiée à la
      main quelque part, qui mentirait le jour où on oublie de la monter :
      c'est ce que le navigateur a RÉELLEMENT chargé.
   2. À l'ouverture, on demande au service worker de vérifier s'il existe
      mieux. S'il prend la main pendant qu'on est là, un bandeau le dit et
      propose de recharger — au lieu de laisser l'utilisateur avec une page
      d'hier et un moteur d'aujourd'hui.

   Aucune dépendance, rien à câbler : la balise `<script>` suffit.
   ═══════════════════════════════════════════════════════════════════════ */
window.GBVersion = (function(){
  "use strict";

  /* Le numéro réellement chargé, pris sur nos propres balises. */
  function numero(){
    var sc = document.querySelectorAll('script[src*="/lib/"], link[href*="/lib/"]');
    for(var i = 0; i < sc.length; i++){
      var u = sc[i].src || sc[i].href || '';
      var m = /[?&]v=(\d+)/.exec(u);
      if(m) return 'v' + m[1];
    }
    return '';
  }

  function bandeau(txt, action, libelle){
    var d = document.getElementById('gbMaj');
    if(!d){
      d = document.createElement('div');
      d.id = 'gbMaj';
      d.style.cssText = 'position:fixed;left:10px;right:10px;z-index:9000;' +
        'bottom:calc(10px + env(safe-area-inset-bottom, 0px));' +
        'display:flex;align-items:center;gap:10px;flex-wrap:wrap;' +
        'padding:11px 13px;border-radius:4px;border:1px solid #5FD3A6;' +
        'background:#0B1714;color:#A8D9C6;' +
        'font:400 13px/1.5 "IBM Plex Sans",system-ui,sans-serif;' +
        'box-shadow:0 10px 30px -12px #000';
      document.body.appendChild(d);
    }
    d.innerHTML = '<span style="flex:1;min-width:150px">' + txt + '</span>';
    if(action){
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = libelle || 'Recharger';
      b.style.cssText = 'font-family:"Barlow Condensed","Arial Narrow",sans-serif;' +
        'font-weight:600;text-transform:uppercase;letter-spacing:.14em;font-size:12px;' +
        'border:1px solid #5FD3A6;background:#0E1A17;color:#5FD3A6;border-radius:3px;' +
        'padding:9px 14px;cursor:pointer';
      b.addEventListener('click', action);
      d.appendChild(b);
    }
    var x = document.createElement('button');
    x.type = 'button'; x.textContent = '✕';
    x.setAttribute('aria-label', 'Fermer');
    x.style.cssText = 'border:0;background:transparent;color:#5FD3A6;font-size:15px;' +
      'cursor:pointer;padding:4px 6px;font-family:ui-monospace,monospace';
    x.addEventListener('click', function(){ d.remove(); });
    d.appendChild(x);
    return d;
  }

  /* Pose le numéro dans tout élément marqué `data-gb-version`. */
  function afficher(){
    var n = numero();
    var els = document.querySelectorAll('[data-gb-version]');
    for(var i = 0; i < els.length; i++) els[i].textContent = n;
    return n;
  }

  function surveiller(){
    if(!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistration().then(function(reg){
      if(!reg) return;
      try{ reg.update(); }catch(e){}
      /* Le service worker de cette application prend la main dès qu'il est
         installé (skipWaiting + clients.claim). Quand ça arrive alors que la
         page est ouverte, la page affichée reste l'ANCIENNE : c'est exactement
         le moment où il faut le dire. */
      navigator.serviceWorker.addEventListener('controllerchange', function(){
        bandeau('Une nouvelle version de Ghost Box vient d\'être installée. ' +
                'Cette page affiche encore l\'ancienne.',
                function(){ location.reload(); }, 'Recharger');
      });
    }).catch(function(){});
  }

  function demarrer(){
    afficher();
    surveiller();
  }
  if(document.readyState === 'loading') addEventListener('DOMContentLoaded', demarrer);
  else demarrer();

  return { numero:numero, afficher:afficher, bandeau:bandeau };
})();
