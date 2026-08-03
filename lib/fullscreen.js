/* ═══════════════════════════════════════════════════════════════════════
   Vrai plein écran — bouton flottant injecté sur toutes les pages.
   Masque la barre de statut et les boutons de navigation du téléphone.
   Sur iPhone l'API n'existe pas : on le dit au lieu d'un bouton inerte.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  var root = document.documentElement;
  var can = !!(root.requestFullscreen || root.webkitRequestFullscreen);

  var css = document.createElement('style');
  css.textContent =
    '#fsFloat{position:fixed;z-index:9999;top:calc(env(safe-area-inset-top, 0px) + 6px);right:8px;' +
    'width:38px;height:38px;padding:0;line-height:1;font-size:17px;' +
    'font-family:ui-monospace,monospace;letter-spacing:0;' +
    'background:rgba(20,26,30,.72);color:#8FA3AD;border:1px solid #2C383F;' +
    'border-radius:19px;backdrop-filter:blur(6px);cursor:pointer;opacity:.75}' +
    '#fsFloat:active{transform:scale(.94)}' +
    '#fsFloat.on{color:#5FD3A6;border-color:#5FD3A6;opacity:1}' +
    ':fullscreen{background:#0A0F12}';
  document.head.appendChild(css);

  var btn = document.createElement('button');
  btn.id = 'fsFloat';
  btn.type = 'button';
  btn.textContent = '⛶';
  btn.setAttribute('aria-label', 'Plein écran');

  function sync(){
    var on = !!(document.fullscreenElement || document.webkitFullscreenElement);
    btn.classList.toggle('on', on);
    btn.textContent = on ? '⤢' : '⛶';
  }
  btn.addEventListener('click', function(){
    var on = document.fullscreenElement || document.webkitFullscreenElement;
    try{
      if(on){
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else if(can){
        (root.requestFullscreen || root.webkitRequestFullscreen)
          .call(root, { navigationUI: 'hide' });
        if(screen.orientation && screen.orientation.lock)
          screen.orientation.lock('any').catch(function(){});
      }
    }catch(e){}
  });
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);

  function place(){
    if(!document.body) return;
    if(!can){
      // iPhone : pas d'API plein écran. L'installation est la seule vraie voie.
      var standalone = window.matchMedia('(display-mode: fullscreen)').matches ||
                       window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone;
      if(standalone) return;          // déjà installée : rien à proposer
      btn.textContent = '⤓';
      btn.title = "Installer l'application pour le plein écran";
      btn.addEventListener('click', function(){
        alert("Pour le plein écran sur iPhone : bouton Partager, puis « Sur l'écran d'accueil ». "
            + "L'application s'ouvrira alors sans barre de navigateur.");
      });
    }
    document.body.appendChild(btn);
    sync();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', place);
  else place();
})();
