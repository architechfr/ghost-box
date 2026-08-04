/* ═══════════════════════════════════════════════════════════════════════
   Démarrage direct — on arrive, on appuie une fois, ça marche.

   Le constat de terrain qui a produit ce fichier : « l'interface utile, c'est
   le plein écran / écran fixe. On a plusieurs modes par le menu principal,
   mais quand on arrive, ça doit déjà être paramétré par défaut pour chaque
   mode. » Avant, ouvrir la séance capteurs demandait sept ou huit appuis
   dispersés dans une longue page de réglages avant de pouvoir travailler —
   dans le noir, à bout de bras, c'est intenable.

   ── Pourquoi UN bouton, et pas zéro ──
   Le navigateur l'exige, et ce n'est pas contournable : `getUserMedia` (micro,
   caméra) et `requestFullscreen` ne s'obtiennent QUE depuis un vrai geste de
   l'utilisateur. Une page ne peut pas ouvrir la caméra toute seule au
   chargement — et c'est heureux. Le clic sur la carte du menu appartient à la
   page précédente, il ne compte pas ici. Donc : un seul grand bouton, qui
   remplit l'écran, et derrière lui TOUT s'enchaîne.

   ── L'ordre des opérations n'est pas négociable ──
   Le plein écran est demandé EN PREMIER, de façon synchrone, dans le
   gestionnaire du clic. Après le premier `await`, le geste est consommé et le
   navigateur refuse. Les permissions viennent ensuite.

   ── Ce que ça ne fait pas ──
   Ça ne baisse aucun seuil, ça ne saute aucun apprentissage, ça ne présume
   d'aucune mesure. Ça ne fait qu'appuyer, dans le bon ordre, sur les boutons
   que l'utilisateur aurait appuyés lui-même.

   Usage :
     GBDemarrage.installer({
       mode: 'banc',
       titre: 'Séance capteurs',
       resume: 'Micro, caméra, mouvement et champ magnétique…',
       etapes: [
         { texte:'Micro',       faire: () => clic('#pMic') },
         { texte:'Apprentissage', faire: () => clic('#run'), attendre: 1000 },
       ],
       fixe: () => setFilming(true)
     });
   ═══════════════════════════════════════════════════════════════════════ */
window.GBDemarrage = (function(){
  "use strict";

  var KEY = 'gb-direct-';      // + mode  → '1' (direct) | '0' (réglages d'abord)

  function pref(mode){
    try{ return localStorage.getItem(KEY+mode) !== '0'; }catch(e){ return true; }
  }
  function poser(mode, v){
    try{ localStorage.setItem(KEY+mode, v ? '1' : '0'); }catch(e){}
  }

  function style(){
    if(document.getElementById('gbdem-css')) return;
    var s = document.createElement('style');
    s.id = 'gbdem-css';
    s.textContent =
      '#gbdem{position:fixed;inset:0;z-index:9998;background:#080D10;display:flex;' +
        'flex-direction:column;align-items:center;justify-content:center;gap:0;' +
        'padding:calc(env(safe-area-inset-top, 0px) + 20px) 22px calc(env(safe-area-inset-bottom, 0px) + 20px);' +
        'text-align:center;overflow:hidden}' +
      '#gbdem .mq{width:min(78vw,320px);opacity:.95;margin-bottom:26px}' +
      '#gbdem h2{font-family:"Barlow Condensed","Arial Narrow",sans-serif;text-transform:uppercase;' +
        'letter-spacing:.2em;font-size:clamp(19px,6vw,26px);font-weight:600;color:#DDE6EA;margin:0 0 10px}' +
      '#gbdem .rz{font-family:"IBM Plex Sans",system-ui,sans-serif;font-size:13.5px;line-height:1.65;' +
        'color:#78868E;max-width:420px;margin:0 0 30px}' +
      '#gbdem .rz b{color:#CFC6B4;font-weight:500}' +
      // le bouton est grand parce qu'on le cherche dans le noir, au pouce
      '#gbdem .go{font-family:"Barlow Condensed","Arial Narrow",sans-serif;text-transform:uppercase;' +
        'letter-spacing:.22em;font-weight:600;font-size:clamp(17px,5vw,21px);' +
        'width:min(88vw,420px);min-height:76px;border-radius:4px;cursor:pointer;' +
        'background:#5FD3A6;color:#06110C;border:1px solid #5FD3A6;' +
        'box-shadow:0 0 44px -8px rgba(95,211,166,.55)}' +
      '#gbdem .go:active{transform:translateY(1px)}' +
      '#gbdem .go[disabled]{opacity:.6;cursor:default;background:#1D262B;color:#5FD3A6;box-shadow:none}' +
      '#gbdem .etat{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;color:#5FD3A6;' +
        'margin-top:18px;min-height:34px;line-height:1.55;max-width:420px}' +
      '#gbdem .etat .ko{color:#E2574C}' +
      '#gbdem .reg{margin-top:26px;background:none;border:0;cursor:pointer;' +
        'font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;color:#78868E;' +
        'text-decoration:underline;text-underline-offset:4px;padding:12px 16px;min-height:44px}' +
      '#gbdem .toujours{margin-top:14px;font-family:"IBM Plex Mono",ui-monospace,monospace;' +
        'font-size:11px;color:#5A686F;display:flex;align-items:center;gap:8px;justify-content:center}' +
      '#gbdem .toujours input{width:17px;height:17px;accent-color:#5FD3A6}';
    document.head.appendChild(s);
  }

  /* appuie sur un VRAI bouton de la page : le démarrage n'a aucune logique à
     lui, il ne fait que ce que l'utilisateur aurait fait à la main */
  function clic(sel){
    var el = document.querySelector(sel);
    if(!el || el.disabled) return false;
    el.click();
    return true;
  }
  function pause(ms){ return new Promise(function(r){ setTimeout(r, ms||0); }); }

  /* attend qu'un bouton devienne réellement cliquable, PUIS clique.
     Sans cela, une étape qui dépend de la précédente échoue en silence :
     « Lancer la veille » ne s'active que lorsqu'un capteur donne des mesures,
     ce qui arrive quelques centaines de millisecondes après l'autorisation. */
  async function clicQuandPret(sel, maxMs){
    var t0 = Date.now(), max = maxMs || 6000;
    while(Date.now() - t0 < max){
      var el = document.querySelector(sel);
      if(el && !el.disabled){ el.click(); return true; }
      await pause(150);
    }
    return false;
  }

  function installer(cfg){
    cfg = cfg || {};
    if(!pref(cfg.mode)) return null;         // l'utilisateur veut régler d'abord
    style();

    var v = document.createElement('div');
    v.id = 'gbdem';
    v.innerHTML =
      '<img class="mq" src="/ghost-box/assets/wordmark.png" alt="Ghost Box">' +
      '<h2>' + (cfg.titre || 'Séance') + '</h2>' +
      '<p class="rz">' + (cfg.resume || '') + '</p>' +
      '<button class="go" type="button">Démarrer la séance</button>' +
      '<p class="etat"></p>' +
      '<label class="toujours"><input type="checkbox" checked> démarrer ainsi la prochaine fois</label>' +
      '<button class="reg" type="button">Régler moi-même d\'abord</button>';
    document.body.appendChild(v);

    var bt  = v.querySelector('.go');
    var et  = v.querySelector('.etat');
    var chk = v.querySelector('.toujours input');

    function fermer(){ if(v && v.parentNode) v.parentNode.removeChild(v); }

    v.querySelector('.reg').onclick = function(){
      poser(cfg.mode, chk.checked);   // le choix de la case reste respecté
      fermer();
    };

    bt.onclick = async function(){
      bt.disabled = true;
      poser(cfg.mode, chk.checked);

      // ── PLEIN ÉCRAN D'ABORD, de façon synchrone ──
      // après le premier `await`, le geste est consommé et le navigateur refuse
      try{
        var el = document.documentElement;
        var rq = el.requestFullscreen || el.webkitRequestFullscreen;
        if(rq){ var r = rq.call(el, {navigationUI:'hide'}); if(r && r.catch) r.catch(function(){}); }
      }catch(e){}
      try{ if(window.GBWake) GBWake.on(); }catch(e){}

      var ratés = [];
      for(var i=0; i<(cfg.etapes||[]).length; i++){
        var e = cfg.etapes[i];
        et.textContent = e.texte + '…';
        try{
          var ok = await e.faire();
          if(ok === false) ratés.push(e.texte);
        }catch(err){ ratés.push(e.texte); }
        await pause(e.attendre != null ? e.attendre : 320);
      }

      // ── l'écran fixe : la position de travail ──
      try{ if(cfg.fixe) cfg.fixe(); }catch(e){}

      if(ratés.length){
        // on ne masque JAMAIS ce qui n'a pas pu s'allumer : c'est un résultat
        et.innerHTML = '<span class="ko">Non disponible : ' + ratés.join(', ') +
          '</span><br>Le reste fonctionne — les réglages restent accessibles en quittant l\'écran fixe.';
        await pause(2600);
      }
      fermer();
    };

    return { fermer: fermer };
  }

  return { installer: installer, clic: clic, pause: pause, clicQuandPret: clicQuandPret,
           actif: pref, preferer: poser };
})();
