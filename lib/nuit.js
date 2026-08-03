/* ═══════════════════════════════════════════════════════════════════════
   Mode nuit — l'écran devient rouge sombre, la vision nocturne survit.

   Pourquoi : sur le terrain, l'œil met vingt à trente minutes à s'habituer
   au noir, et un seul coup d'œil à un écran vert-turquoise ruine cette
   adaptation. La lumière rouge sombre, elle, la préserve — c'est le choix
   des astronomes et des équipages de nuit depuis toujours.

   Comment : un FILTRE posé sur la racine du document. Pas une deuxième
   palette à maintenir : le filtre s'applique à tout ce qui s'affiche —
   pages, canvas du mur, spectre, et même l'image des caméras. Une palette
   parallèle aurait laissé les canvas et la vidéo en pleine couleur, c'est-
   à-dire exactement la lumière qu'on voulait éteindre.

   Le réglage est mémorisé (gb-nuit) et appliqué dès le chargement de chaque
   page : on ne se prend jamais un écran vert dans les yeux au changement de
   page. La bascule vit dans Réglages et dans les écrans fixes.
   ═══════════════════════════════════════════════════════════════════════ */
window.GBNuit = (function(){
  var KEY = 'gb-nuit';

  var css = document.createElement('style');
  css.textContent =
    // sépia d'abord (tout devient monochrome ambré), puis rotation vers le
    // rouge, saturation pour un rouge franc, et baisse de luminosité :
    // l'ordre des fonctions n'est pas décoratif, un autre ordre rend rose
    'html.gb-nuit{filter:sepia(1) saturate(3) hue-rotate(-38deg) brightness(.62) contrast(1.06)}' +
    // le flash blanc de la capture photo serait un coup de phare : éteint la nuit
    'html.gb-nuit #gbFlash{display:none}';
  document.head.appendChild(css);

  function actif(){
    try{ return localStorage.getItem(KEY) === '1'; }catch(e){ return false; }
  }
  function appliquer(){
    document.documentElement.classList.toggle('gb-nuit', actif());
  }
  function basculer(v){
    var cible = (v == null) ? !actif() : !!v;
    try{ localStorage.setItem(KEY, cible ? '1' : '0'); }catch(e){}
    appliquer();
    return cible;
  }

  appliquer();   // dès le chargement : jamais d'écran vert surprise la nuit

  return { actif: actif, basculer: basculer, appliquer: appliquer };
})();
