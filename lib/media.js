/* ═══════════════════════════════════════════════════════════════════════
   Diagnostic caméra / micro — partagé par tous les modes.
   Quand un accès échoue, l'utilisateur doit savoir POURQUOI, en clair.
   Le refus le plus fréquent sur téléphone : la caméra est déjà prise par
   un autre onglet de l'application.
   ═══════════════════════════════════════════════════════════════════════ */
window.GBMedia = {
  /** Traduit une erreur getUserMedia en phrase utile. */
  explain: function(e){
    var n = (e && (e.name || e.constructor && e.constructor.name)) || '';
    var m = (e && e.message) || '';
    switch(n){
      case 'NotReadableError':
      case 'TrackStartError':
        return "La caméra est déjà utilisée par autre chose — le plus souvent "
             + "<b>un autre onglet de cette application</b> resté ouvert, ou une autre appli "
             + "(appareil photo, visio). Ferme les autres onglets Ghost Box, puis réessaie.";
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return "Accès refusé. Ouvre le cadenas à gauche de l'adresse du site "
             + "→ Autorisations → autorise la <b>caméra</b> et le <b>micro</b>, puis recharge la page.";
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return "Aucune caméra détectée sur cet appareil.";
      case 'OverconstrainedError':
        return "Cet objectif n'accepte pas le format demandé. Choisis un autre objectif.";
      case 'SecurityError':
        return "Le navigateur bloque l'accès. Vérifie que l'adresse commence bien par <b>https://</b>.";
      case 'AbortError':
        return "L'accès a été interrompu par le système. Réessaie.";
      default:
        return "Accès impossible" + (n ? " (" + n + ")" : "") + (m ? " : " + m : "") + ".";
    }
  },

  /** Combien d'onglets/pages de l'application sont ouverts (indice utile). */
  warnIfShared: function(){
    try{
      if(navigator.serviceWorker && navigator.serviceWorker.controller){
        return "Si le problème persiste, ferme complètement le navigateur et rouvre l'application.";
      }
    }catch(e){}
    return "";
  }
};
