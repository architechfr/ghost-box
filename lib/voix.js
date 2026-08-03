/* ═══════════════════════════════════════════════════════════════════════
   Voix — le mot retenu est prononcé à voix haute au moment où il sort.

   Pourquoi : en séance, on ne regarde pas l'écran — le téléphone est posé,
   tourné vers la pièce, et soi-même on écoute. Un mot qui sort en silence
   peut n'être découvert que des minutes plus tard. Prononcé, il est su à
   l'instant, par tout le monde dans la pièce, et il est SUR l'enregistrement
   audio de la séance — la bande porte sa propre annotation.

   Ce que ce module ne fait pas : il ne prononce que ce que le moteur a
   retenu, jamais autre chose. Pas de commentaire, pas d'ambiance. L'option
   est mémorisée (gb-voix), coupée par défaut.
   ═══════════════════════════════════════════════════════════════════════ */
window.GBVoix = (function(){
  var KEY = 'gb-voix';

  function actif(){
    try{ return localStorage.getItem(KEY) === '1'; }catch(e){ return false; }
  }
  function basculer(v){
    var cible = (v == null) ? !actif() : !!v;
    try{ localStorage.setItem(KEY, cible ? '1' : '0'); }catch(e){}
    return cible;
  }
  /* prononce, si l'option est allumée. Lent et grave : audible sans agresser. */
  function dire(texte){
    if(!actif() || !texte || !window.speechSynthesis) return;
    try{
      var u = new SpeechSynthesisUtterance(String(texte));
      u.lang = 'fr-FR'; u.rate = .8; u.pitch = .85; u.volume = 1;
      speechSynthesis.speak(u);
    }catch(e){}
  }
  function dispo(){ return !!window.speechSynthesis; }

  return { actif: actif, basculer: basculer, dire: dire, dispo: dispo };
})();
