/* ═══════════════════════════════════════════════════════════════════════
   Barre d'action — LE geste de la page, toujours sous le pouce.

   Sur un téléphone tenu d'une main, le bas de l'écran est la seule zone
   sûre. Or « Préparer le tournage », « Lancer la veille », « Démarrer »
   étaient à mi-page ou plus bas : le geste vital demandait de faire défiler.

   Cette barre ne CRÉE aucun bouton nouveau : elle reflète le bouton réel de
   la page (libellé, état actif/grisé) et le déclenche à sa place — une seule
   logique, deux endroits pour appuyer. La page déclare simplement, dans
   l'ordre de priorité, quels boutons peuvent être « le geste du moment » :

     GBAction.init(['#recBtn', '#prep'])
     → si recBtn est utilisable, c'est lui ; sinon prep.

   La barre s'efface en écran fixe (classe `gbx`, posée par lib/fixe.js) : ce mode a déjà
   leurs commandes, posées par leur propre mise en page.
   ═══════════════════════════════════════════════════════════════════════ */
window.GBAction = (function(){
  "use strict";
  var cibles = [], barre = null, btn = null, courant = null;

  function css(){
    var st = document.createElement('style');
    st.textContent =
      '#gbBarre{position:fixed;left:0;right:0;bottom:0;z-index:70;' +
      'padding:10px 12px calc(10px + env(safe-area-inset-bottom, 0px));' +
      'background:linear-gradient(0deg,rgba(4,8,11,.97) 60%,rgba(4,8,11,0));' +
      'pointer-events:none}' +
      '#gbBarre button{pointer-events:auto;width:calc(100% - 78px);display:block;' +
      'padding:16px 0;font-size:15px;letter-spacing:.18em;border-radius:4px;' +
      'font-family:"Barlow Condensed","Arial Narrow",sans-serif;text-transform:uppercase;' +
      'font-weight:600;border:1px solid #5FD3A6;background:rgba(95,211,166,.14);' +
      'color:#5FD3A6;box-shadow:0 6px 26px -10px rgba(95,211,166,.5);cursor:pointer}' +
      '#gbBarre button:active{transform:translateY(1px)}' +
      '#gbBarre button:disabled{opacity:.4}' +
      /* quand le bouton réel est un bouton d'enregistrement armé, la barre le dit en rouge */
      '#gbBarre button.rec{border-color:#E2574C;background:rgba(226,87,76,.16);color:#FF9C93;' +
      'box-shadow:0 6px 26px -10px rgba(226,87,76,.55)}' +
      /* la page respire au-dessus de la barre ET des boutons de capture flottants */
      'body.avecbarre{padding-bottom:calc(170px + env(safe-area-inset-bottom, 0px)) !important}' +
      'body.avecbarre #gbCap{bottom:calc(84px + env(safe-area-inset-bottom, 0px))}' +
      'body.filming #gbBarre,body.assis #gbBarre,body.gbx #gbBarre{display:none}' +
      'body.filming.avecbarre,body.assis.avecbarre,body.gbx.avecbarre{padding-bottom:0 !important}';
    document.head.appendChild(st);
  }

  /* le bouton réel dont c'est le tour : le premier utilisable de la liste */
  function elu(){
    var vu = null;
    for(var i=0;i<cibles.length;i++){
      var el = document.querySelector(cibles[i]);
      if(!el) continue;
      if(!vu) vu = el;                 // à défaut d'utilisable, le premier existant
      if(!el.disabled) return el;
    }
    return vu;
  }

  function refleter(){
    var el = elu();
    courant = el;
    if(!el){ btn.disabled = true; btn.textContent = '—'; return; }
    var txt = (el.textContent || '').trim();
    btn.textContent = txt || '—';
    btn.disabled = !!el.disabled;
    var rec = /enregistrer|arr[êe]ter|■|●/i.test(txt) && el.id !== 'prep';
    btn.classList.toggle('rec', rec);
  }

  function init(liste){
    cibles = liste || [];
    if(barre) return;
    css();
    barre = document.createElement('div'); barre.id = 'gbBarre';
    btn = document.createElement('button'); btn.type = 'button';
    btn.onclick = function(){ if(courant && !courant.disabled) courant.click(); setTimeout(refleter, 120); };
    barre.appendChild(btn);
    document.body.appendChild(barre);
    document.body.classList.add('avecbarre');
    refleter();
    setInterval(refleter, 400);
  }

  return { init: init };
})();
