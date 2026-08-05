/* ═══════════════════════════════════════════════════════════════════════
   Témoin croisé — deux téléphones dans la même pièce, chacun juge de l'autre.

   POURQUOI
   Le moteur possède déjà un témoin INTERNE : un générateur de bruit réglé sur
   la même statistique que le capteur, qui relève le seuil dès que le hasard
   seul saurait faire parler l'appareil. Ce module est le témoin EXTERNE, et
   c'est un changement de catégorie : un événement qui n'apparaît que sur UN
   appareil peut toujours être un artefact de cet appareil — son capteur, son
   électronique, sa poche. Un événement qui apparaît sur DEUX appareils
   indépendants, posés à des endroits différents, dans la même seconde, ne
   peut plus s'expliquer par l'appareil. Aucun outil du domaine ne fait ça.

   COMMENT — et pourquoi comme ça
   — Liaison DIRECTE entre les deux téléphones (WebRTC DataChannel), sans
     serveur : les lieux d'utilisation réels n'ont pas de réseau, et la
     promesse « rien ne quitte l'appareil » tient — les événements ne
     voyagent que d'un téléphone à l'autre, jamais ailleurs.
   — La présentation se fait par QR CODES : l'appareil A affiche son offre,
     B la lit avec sa caméra et affiche sa réponse, A la lit à son tour.
     Aucune saisie, aucun compte, aucun serveur d'annuaire — et l'application
     sait déjà faire des QR (lib/qr.js). Il faut que les deux téléphones
     soient sur le MÊME réseau local (le partage de connexion de l'un des
     deux suffit : pas besoin d'internet, juste du WiFi entre eux).
   — Les HORLOGES sont synchronisées à l'ouverture (aller-retours datés,
     médiane des décalages, méthode NTP simplifiée) : une coïncidence est
     une affaire de millisecondes, deux horloges de téléphone peuvent
     diverger de plusieurs secondes.
   — Chaque appareil envoie ses événements RETENUS (mot sorti, silhouette
     confirmée) avec leur instant d'ATTAQUE. Quand un événement local et un
     événement distant tombent dans la même fenêtre (±1,5 s par défaut),
     c'est une COÏNCIDENCE CROISÉE — datée, documentée des deux côtés.

   CE QUE CE MODULE NE FAIT PAS
   Il ne baisse aucun seuil et n'invente rien : il ne fait que comparer des
   événements que chaque moteur a retenus SEUL, selon ses propres règles.
   Une coïncidence n'est pas une preuve — c'est un événement qui a survécu
   à un juge de plus.

   PIÈGES CONNUS, assumés dans le code :
   — le SDP de WebRTC pèse 1 à 3 Ko : trop pour un QR lisible sans le
     compresser. `CompressionStream('deflate-raw')` + base64 le ramène sous
     ~1 Ko, ce qu'un QR niveau L porte sans peine ;
   — les candidats ICE arrivent APRÈS `createOffer` : afficher le QR trop
     tôt, c'est montrer une offre sans adresse. On attend la fin de la
     collecte (ou 2 s, les réseaux locaux répondent vite) ;
   — la lecture du QR passe par `BarcodeDetector`, natif sur Chrome Android.
     S'il manque, on le DIT — plutôt qu'un scanner qui ne trouve jamais rien.
   ═══════════════════════════════════════════════════════════════════════ */
window.GBCroise = (function(){
  "use strict";

  var FENETRE = 1500;          // ms : demi-fenêtre de coïncidence
  var GARDE_MS = 20000;        // on ne garde que les événements récents
  var VIE_MS = 2500, MORT_MS = 9000;

  var pc = null, dc = null, etat = 'seul', role = null;
  var offset = 0, rtts = [], offsets = [], vieTimer = 0, dernierVu = 0;
  var locaux = [], distants = [];       // événements en attente d'appariement
  var cfg = {};

  /* ── compression : un SDP ne tient pas dans un QR sans ça ── */
  async function compresser(str){
    var cs = new CompressionStream('deflate-raw');
    var ab = await new Response(new Blob([str]).stream().pipeThrough(cs)).arrayBuffer();
    var u = new Uint8Array(ab), s = '';
    for(var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_');
  }
  async function decompresser(b64){
    var s = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
    var u = new Uint8Array(s.length);
    for(var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    var ds = new DecompressionStream('deflate-raw');
    return await new Response(new Blob([u]).stream().pipeThrough(ds)).text();
  }

  function poser(e){
    etat = e;
    if(cfg.onEtat){ try{ cfg.onEtat(etat); }catch(x){} }
  }

  function nouveauPC(){
    // pas de serveur STUN obligatoire : sur un réseau local (ou un partage de
    // connexion), les candidats host/mDNS suffisent. On en met un quand même :
    // inoffensif hors ligne, utile si les deux téléphones ont du réseau.
    pc = new RTCPeerConnection({ iceServers:[{urls:'stun:stun.l.google.com:19302'}] });
    pc.onconnectionstatechange = function(){
      if(!pc) return;
      if(pc.connectionState === 'failed' || pc.connectionState === 'disconnected') perdu();
    };
    return pc;
  }

  /* les candidats ICE arrivent après l'offre : un QR affiché trop tôt serait
     une offre SANS ADRESSE. On attend la fin de la collecte, bornée à 2,5 s. */
  function attendreICE(p){
    if(p.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise(function(res){
      var t = setTimeout(res, 2500);
      p.onicegatheringstatechange = function(){
        if(p.iceGatheringState === 'complete'){ clearTimeout(t); res(); }
      };
    });
  }

  function brancher(canal){
    dc = canal;
    dc.onopen = function(){
      dernierVu = Date.now();
      poser('lie');
      syncHorloge();
      if(vieTimer) clearInterval(vieTimer);
      vieTimer = setInterval(function(){
        envoyer({ t:'vie' });
        if(Date.now() - dernierVu > MORT_MS) perdu();
      }, VIE_MS);
    };
    dc.onmessage = function(e){ dernierVu = Date.now(); recevoir(e.data); };
    dc.onclose = perdu;
  }

  function perdu(){
    if(etat === 'seul') return;
    poser('perdu');
    if(vieTimer){ clearInterval(vieTimer); vieTimer = 0; }
  }

  function envoyer(o){
    try{ if(dc && dc.readyState === 'open') dc.send(JSON.stringify(o)); }catch(e){}
  }

  /* ── horloge : dix aller-retours datés, médiane des décalages ──
     La coïncidence se joue à la seconde ; deux horloges de téléphone peuvent
     diverger de bien plus. Méthode NTP simplifiée : offset = b − (a+c)/2,
     où a = départ local, b = heure distante, c = retour local. La MÉDIANE
     écarte les aller-retours ralentis par le réseau. */
  function syncHorloge(){
    offsets = []; rtts = [];
    var n = 0;
    var tir = setInterval(function(){
      if(n++ >= 10){ clearInterval(tir); return; }
      envoyer({ t:'ping', a: Date.now() });
    }, 120);
  }
  function mediane(a){
    if(!a.length) return 0;
    var s = a.slice().sort(function(x,y){ return x-y; });
    return s[Math.floor(s.length/2)];
  }

  function recevoir(txt){
    var m; try{ m = JSON.parse(txt); }catch(e){ return; }
    if(m.t === 'ping'){ envoyer({ t:'pong', a:m.a, b:Date.now() }); return; }
    if(m.t === 'pong'){
      var c = Date.now();
      rtts.push(c - m.a);
      offsets.push(m.b - (m.a + c)/2);
      offset = mediane(offsets);
      if(cfg.onHorloge){ try{ cfg.onHorloge(offset, mediane(rtts)); }catch(x){} }
      return;
    }
    if(m.t === 'vie') return;
    if(m.t === 'evt'){
      // l'instant distant, ramené dans NOTRE horloge
      var quandLocal = m.quand - offset;
      var e = { quoi:m.quoi, detail:m.detail || '', voie:m.voie || '', sigma:m.sigma,
                quand:quandLocal, brut:m };
      apparier(e, true);
      return;
    }
  }

  function purger(){
    var lim = Date.now() - GARDE_MS;
    locaux   = locaux.filter(function(e){ return e.quand >= lim && !e.paire; });
    distants = distants.filter(function(e){ return e.quand >= lim && !e.paire; });
  }

  /* le cœur : un événement (local ou distant) cherche son jumeau de l'autre
     côté dans la fenêtre. Chaque événement ne peut être apparié qu'UNE fois —
     sans quoi une rafale d'un côté fabriquerait dix coïncidences du même
     événement de l'autre. */
  function apparier(e, estDistant){
    purger();
    var bassin = estDistant ? locaux : distants;
    var meilleur = null, dt = 1/0;
    for(var i = 0; i < bassin.length; i++){
      var d = Math.abs(bassin[i].quand - e.quand);
      if(d <= FENETRE && d < dt){ dt = d; meilleur = bassin[i]; }
    }
    if(meilleur){
      meilleur.paire = true; e.paire = true;
      var co = {
        ecart_ms: Math.round(dt),
        local:   estDistant ? meilleur : e,
        distant: estDistant ? e : meilleur,
        quand: Date.now()
      };
      if(cfg.onCoincidence){ try{ cfg.onCoincidence(co); }catch(x){} }
    } else {
      (estDistant ? distants : locaux).push(e);
      if(estDistant && cfg.onDistant){ try{ cfg.onDistant(e); }catch(x){} }
    }
  }

  /* ── ce que la page appelle quand SON moteur retient quelque chose ── */
  function signaler(evt){
    if(etat !== 'lie') return;
    var e = { quoi: evt.quoi || 'mot', detail: evt.detail || '', voie: evt.voie || '',
              sigma: evt.sigma, quand: evt.quand || Date.now() };
    apparier(e, false);
    envoyer({ t:'evt', quoi:e.quoi, detail:e.detail, voie:e.voie, sigma:e.sigma, quand:e.quand });
  }

  /* ══ la présentation, en trois QR ══
     A crée l'offre → QR ; B la lit, crée la réponse → QR ; A la lit. */
  async function creerOffre(){
    role = 'poste';
    nouveauPC();
    brancher(pc.createDataChannel('gb', { ordered:true }));
    await pc.setLocalDescription(await pc.createOffer());
    await attendreICE(pc);
    poser('attente');
    return compresser(JSON.stringify(pc.localDescription));
  }
  async function recevoirOffre(txt){
    role = 'renfort';
    nouveauPC();
    pc.ondatachannel = function(e){ brancher(e.channel); };
    await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(await decompresser(txt))));
    await pc.setLocalDescription(await pc.createAnswer());
    await attendreICE(pc);
    poser('attente');
    return compresser(JSON.stringify(pc.localDescription));
  }
  async function recevoirReponse(txt){
    await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(await decompresser(txt))));
  }

  function couper(){
    if(vieTimer){ clearInterval(vieTimer); vieTimer = 0; }
    try{ if(dc) dc.close(); }catch(e){}
    try{ if(pc) pc.close(); }catch(e){}
    dc = null; pc = null; locaux = []; distants = [];
    poser('seul');
  }

  function installer(c){ cfg = c || {}; return API; }

  var API = {
    installer: installer,
    creerOffre: creerOffre,
    recevoirOffre: recevoirOffre,
    recevoirReponse: recevoirReponse,
    signaler: signaler,
    couper: couper,
    etat: function(){ return etat; },
    role: function(){ return role; },
    horloge: function(){ return { offset: Math.round(offset), rtt: Math.round(mediane(rtts)) }; },
    fenetre: function(v){ if(v != null && isFinite(v)) FENETRE = v; return FENETRE; },
    dispo: function(){
      return !!(window.RTCPeerConnection && window.CompressionStream);
    },
    scanDispo: function(){ return typeof window.BarcodeDetector === 'function'; }
  };
  return API;
})();
