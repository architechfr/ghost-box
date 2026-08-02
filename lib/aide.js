/* ═══════════════════════════════════════════════════════════════════════
   Aide repliable — l'application explique à la première visite, sert ensuite.

   Le constat (audit d'août 2026) : chaque page s'ouvrait sur ses explications,
   excellentes mais identiques à chaque séance. La séance capteurs pesait 965
   mots de texte permanent sur cinq écrans de téléphone, avec « Lancer la
   veille » au troisième. Sur le terrain, dans le noir, on refaisait défiler
   un cours connu par cœur pour atteindre trois boutons.

   Le principe : les paragraphes pédagogiques (.ex / .fine SANS id — ceux qui
   portent un id sont des zones d'état, jamais touchées) sont visibles à la
   première visite, repliés ensuite, et un bouton AIDE les rouvre à tout
   moment. Le choix explicite de l'utilisateur est retenu. RIEN n'est
   supprimé : la pédagogie est un des piliers du produit, elle change juste
   de place dans le temps.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  var CLE_VU = 'gb-aide-vu', CLE_PREF = 'gb-aide-pref';

  function lire(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function ecrire(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }

  function css(){
    var st = document.createElement('style');
    st.textContent =
      /* replié : les paragraphes pédagogiques disparaissent, les zones d'état restent */
      'body.sansaide p.ex:not([id]),body.sansaide p.fine:not([id]),' +
      'body.sansaide section .fine{display:none}' +
      'button.gb-aide{border-color:#2C383F;color:#7E8E96;font-size:11px;' +
      'padding:8px 11px;flex:none;min-width:0}' +
      'button.gb-aide.on{border-color:#5FD3A6;color:#5FD3A6}';
    document.head.appendChild(st);
  }

  function poser(){
    css();
    var pref = lire(CLE_PREF);
    var deja = lire(CLE_VU);
    // priorité au choix explicite ; sinon : visible à la première visite, replié ensuite
    var visible = pref !== null ? pref === 'on' : !deja;
    if(!deja) ecrire(CLE_VU, '1');
    if(!visible) document.body.classList.add('sansaide');

    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'gb-aide' + (visible ? ' on' : '');
    b.textContent = 'Aide';
    b.setAttribute('aria-label', "Afficher ou replier les explications");
    b.onclick = function(){
      var v = document.body.classList.toggle('sansaide');
      b.classList.toggle('on', !v);
      ecrire(CLE_PREF, v ? 'off' : 'on');
    };
    // à côté du bouton retour si présent, sinon en tête de page
    var retour = document.querySelector('a.gb-retour');
    if(retour && retour.parentNode) retour.parentNode.insertBefore(b, retour.nextSibling);
    else (document.querySelector('.wrap') || document.body).prepend(b);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(poser, 0); });
  else setTimeout(poser, 0);
})();
