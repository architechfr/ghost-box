/* ═══════════════════════════════════════════════════════════════════════
   Retour au menu — le même bouton, visible, sur toutes les pages.

   Il était écrit « ← » en gris foncé, taille 16, sans cadre : sur un téléphone
   tenu à bout de bras dans le noir, ça ne se voit pas et ça ne se vise pas.
   Dans la page Écoute, il n'existait carrément pas — on ne pouvait revenir au
   menu qu'avec le bouton du navigateur, qui n'existe plus une fois
   l'application installée en plein écran.

   Ce module pose donc un bouton franc — cadre, couleur du signal, cible large
   au doigt — sur chaque page : soit en habillant le lien déjà présent, soit en
   l'ajoutant s'il manque. Une seule implémentation : si l'aspect change, il
   change partout.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";

  function css(){
    if(document.getElementById('gb-retour-css')) return;
    var st = document.createElement('style');
    st.id = 'gb-retour-css';
    st.textContent =
      'a.gb-retour{display:inline-flex;align-items:center;gap:7px;' +
      'border:1px solid #5FD3A6;border-radius:3px;color:#5FD3A6;text-decoration:none;' +
      'font-family:"Barlow Condensed","Arial Narrow",sans-serif;text-transform:uppercase;' +
      'letter-spacing:.14em;font-weight:600;font-size:12.5px;line-height:1;' +
      'padding:10px 13px;background:rgba(95,211,166,.08);white-space:nowrap;flex:none}' +
      'a.gb-retour:active{transform:translateY(1px);background:rgba(95,211,166,.18)}' +
      'a.gb-retour .fl{font-family:ui-monospace,monospace;font-size:15px;line-height:1}' +
      /* posé en haut d'une page qui n'a pas d'en-tête : il ne doit rien recouvrir */
      'a.gb-retour.gb-seul{margin:calc(10px + env(safe-area-inset-top)) 0 4px}' +
      /* pendant un tournage ou une séance assise, l'écran est figé et un bouton
         « Quitter » existe déjà : celui-ci se retire pour ne pas encombrer */
      'body.filming a.gb-retour,body.assis a.gb-retour{display:none}';
    document.head.appendChild(st);
  }

  function habiller(a){
    a.className = (a.className ? a.className + ' ' : '') + 'gb-retour';
    a.innerHTML = '<span class="fl">←</span><span>Menu</span>';
    a.setAttribute('aria-label', 'Retour au menu');
    a.removeAttribute('style');
  }

  function poser(){
    css();
    // 1. un lien de retour existe déjà quelque part : on l'habille
    var liens = document.querySelectorAll('a[href="../"],a[href="/ghost-box/"],a.back');
    if(liens.length){
      for(var i=0;i<liens.length;i++) habiller(liens[i]);
      // un retour relégué en bas de page ne se trouve pas : il remonte en tête
      var a0 = liens[0];
      if(a0.getBoundingClientRect().top > 220){
        a0.classList.add('gb-seul');
        var h0 = document.querySelector('.wrap') || document.body;
        h0.insertBefore(a0, h0.firstChild);
      }
      return;
    }
    // 2. il n'y en a pas : on en pose un, en tête de page
    var a = document.createElement('a');
    a.href = '/ghost-box/';
    habiller(a);
    a.classList.add('gb-seul');
    var hote = document.querySelector('.wrap') || document.body;
    hote.insertBefore(a, hote.firstChild);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poser);
  else poser();
})();
