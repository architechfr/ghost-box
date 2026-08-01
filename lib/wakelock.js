/* ═══════════════════════════════════════════════════════════════════════
   Empêche le téléphone de s'endormir pendant une séance.
   Un écran qui s'éteint interrompt la caméra, l'enregistrement et la veille
   des capteurs — inacceptable en plein tournage.

   Le verrou est relâché par le système dès que la page passe en arrière-plan ;
   on le reprend automatiquement au retour.

   Usage :  GBWake.on()   /   GBWake.off()   /   GBWake.active()
   ═══════════════════════════════════════════════════════════════════════ */
window.GBWake = (function(){
  var lock = null, wanted = false, video = null;

  function supported(){ return 'wakeLock' in navigator; }

  async function acquire(){
    if(!wanted) return;
    if(supported()){
      try{
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', function(){ lock = null; });
        return true;
      }catch(e){ /* refusé : on tente le repli */ }
    }
    fallback();
    return false;
  }

  /* Repli pour les navigateurs sans Wake Lock : une vidéo muette en boucle,
     invisible, suffit à tenir l'écran allumé sur la plupart des téléphones. */
  function fallback(){
    if(video) return;
    try{
      video = document.createElement('video');
      video.setAttribute('playsinline','');
      video.muted = true; video.loop = true;
      video.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-10px';
      // minuscule vidéo noire encodée en base64 (aucun fichier à charger)
      video.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAr1tZGF0AAACrgYF//+q3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE1NSAtIEguMjY0L01QRUctNCBBVkMgY29kZWMgLSBDb3B5bGVmdCAyMDAzLTIwMTggLSBodHRwOi8vd3d3LnZpZGVvbGFuLm9yZy94MjY0Lmh0bWwAAAAA';
      document.body.appendChild(video);
      video.play().catch(function(){});
    }catch(e){}
  }

  function on(){
    if(wanted) return;
    wanted = true;
    acquire();
    document.addEventListener('visibilitychange', onVisible);
  }

  function off(){
    wanted = false;
    document.removeEventListener('visibilitychange', onVisible);
    if(lock){ try{ lock.release(); }catch(e){} lock = null; }
    if(video){ try{ video.pause(); video.remove(); }catch(e){} video = null; }
  }

  function onVisible(){
    // le système relâche le verrou en arrière-plan : on le reprend au retour
    if(wanted && document.visibilityState === 'visible' && !lock) acquire();
  }

  function active(){ return wanted; }

  return { on: on, off: off, active: active, supported: supported };
})();
