/* ═══════════════════════════════════════════════════════════════════════
   Banc de capteurs — ce que l'appareil sait réellement mesurer.

   Principe, et il ne souffre aucune exception : une voie n'existe ici que si
   elle correspond à une VRAIE mesure physique faite par un vrai composant.
   Il n'y a pas de « capteur d'énergie », pas de « détecteur de présence
   spirituelle », pas de générateur aléatoire déguisé en instrument. Quand un
   capteur manque, la voie dit qu'elle manque ET pourquoi. C'est un résultat,
   pas une panne à masquer.

   ── Dégradation, parce que l'application doit tourner partout ──
   Sur un téléphone Android récent : micro, caméra, accéléromètre, gyroscope,
   magnétomètre. Sur un ordinateur : micro et caméra, et c'est déjà assez pour
   travailler — le reste se déclare absent, en toutes lettres. Rien ne casse,
   rien n'est simulé.

   ── Détection honnête de la présence d'un capteur ──
   `'DeviceMotionEvent' in window` est vrai sur presque tous les navigateurs,
   y compris ceux qui n'ont aucun accéléromètre : la classe existe, l'événement
   n'arrive jamais. On ne se fie donc PAS à la présence de l'objet, on attend
   de vraies lectures : sans lecture au bout de 2,5 s, la voie est déclarée
   absente. C'est la seule vérification qui ne mente pas.

   ── Ce que le web n'expose pas, et que je n'inventerai pas ──
   Température, pression atmosphérique, champ électrique, infrarouge, ondes
   radio : aucun navigateur ne les donne. On pourrait les « estimer », ce
   serait de la décoration. Il n'y en aura pas.

   Usage :
     const B = GBCapteurs.creer();
     await B.activer('micro');          // 'micro' | 'mouvement' | 'magnetique' | 'camera'
     B.voies();                          // état de chaque voie
     B.lire('son_niveau');               // dernière valeur, ou null
   ═══════════════════════════════════════════════════════════════════════ */
window.GBCapteurs = (function(){
  "use strict";

  var ATTENTE = 2500;   // délai au bout duquel une voie muette est déclarée absente

  /* description des voies. `famille` = le bouton qui les allume ensemble. */
  var VOIES = [
    { code:'son_niveau', label:'Niveau sonore',        unite:'dBFS', famille:'micro',
      quoi:'L\'énergie totale que le micro reçoit. C\'est la voie de référence : elle entend la pièce, et la box radio posée à côté.' },
    { code:'son_grave',  label:'Grave 100–300 Hz',     unite:'dBFS', famille:'micro',
      quoi:'Les basses. Un pas dans un plancher, une porte, un souffle d\'air y laissent plus de trace que dans l\'aigu.' },
    { code:'son_medium', label:'Médium 300 Hz–3 kHz',  unite:'dBFS', famille:'micro',
      quoi:'La bande de la voix humaine. Un mot prononcé dans la pièce y passe forcément.' },
    { code:'son_aigu',   label:'Aigu 3–8 kHz',         unite:'dBFS', famille:'micro',
      quoi:'Les frottements, les craquements secs, les sifflements.' },
    { code:'son_ultra',  label:'Bande 15–20 kHz',      unite:'dBFS', famille:'micro',
      quoi:'Presque inaudible pour nous, et presque vide dans une maison : une bande où le bruit ordinaire est rare, donc où une excursion est plus parlante. Absente si le micro échantillonne trop bas.' },
    { code:'son_flux',   label:'Changement de timbre', unite:'—',    famille:'micro',
      quoi:'De combien le spectre a changé d\'un instant au suivant. Voit ce qui change de NATURE à volume constant — ce que le niveau seul ne peut pas voir.' },

    { code:'mvt_accel',  label:'Accéléromètre',        unite:'m/s²', famille:'mouvement',
      quoi:'Vibration du support. Téléphone posé sur une table ou un plancher : un choc dans la structure du bâtiment y arrive.' },
    { code:'mvt_gyro',   label:'Gyroscope',            unite:'rad/s',famille:'mouvement',
      quoi:'Rotation. Sensible à un meuble qui bouge, à un plancher qui travaille sous le poids de quelqu\'un.' },
    { code:'mvt_tilt',   label:'Inclinaison',          unite:'°',    famille:'mouvement',
      quoi:'L\'angle de l\'appareil. Doit être parfaitement stable quand le téléphone est posé — donc toute variation est un fait.' },

    { code:'mag_champ',  label:'Champ magnétique',     unite:'µT',   famille:'magnetique',
      quoi:'Le magnétomètre lui-même, quand le navigateur l\'expose. La mesure la plus directe.' },
    { code:'mag_cap',    label:'Perturbation du cap',  unite:'°',    famille:'magnetique',
      quoi:'Quand le magnétomètre n\'est pas exposé, la boussole l\'est presque toujours : c\'est le MÊME capteur, lu autrement. Un cap qui bouge alors que l\'appareil est posé, c\'est le champ qui a bougé.' },

    { code:'cam_lum',    label:'Luminance caméra',     unite:'0–255',famille:'camera',
      quoi:'La clarté moyenne de l\'image. Une variation nette, pièce fermée et éclairage stable, est un fait mesurable.' },
    { code:'cam_diff',   label:'Mouvement d\'image',   unite:'%',    famille:'camera',
      quoi:'La part de l\'image qui a changé depuis la vue précédente. Caméra fixe : c\'est ce qui bouge dans le champ.' }
  ];

  function creer(opts){
    opts = opts || {};
    var S = {};
    VOIES.forEach(function(v){
      S[v.code] = { code:v.code, label:v.label, unite:v.unite, famille:v.famille, quoi:v.quoi,
                    val:null, vu:0, dispo:false, raison:'pas encore activée' };
    });

    function poser(code, v){
      var s = S[code]; if(!s || !isFinite(v)) return;
      s.val = v; s.vu = performance.now(); s.dispo = true; s.raison = '';
    }
    function absente(code, raison){
      var s = S[code]; if(!s) return;
      s.dispo = false; s.raison = raison; s.val = null;
    }
    function famille(f, raison){ VOIES.forEach(function(v){ if(v.famille===f) absente(v.code, raison); }); }

    /* ═══════════ micro ═══════════ */
    var actx=null, ana=null, micStream=null, freqPrec=null, tMic=0;
    async function activerMicro(){
      if(micStream) return micStream;
      var st;
      try{
        // les traitements du téléphone (réduction de bruit, gain automatique) sont
        // des filtres : ils modifient ce qu'on prétend mesurer. On les refuse.
        st = await navigator.mediaDevices.getUserMedia({audio:{
          echoCancellation:false, noiseSuppression:false, autoGainControl:false}});
      }catch(e){
        try{ st = await navigator.mediaDevices.getUserMedia({audio:true}); }
        catch(e2){ famille('micro', raisonMedia(e2)); throw e2; }
      }
      micStream = st;
      actx = new (window.AudioContext||window.webkitAudioContext)();
      await actx.resume();
      ana = actx.createAnalyser();
      ana.fftSize = 2048; ana.smoothingTimeConstant = .5;
      ana.minDecibels = -95; ana.maxDecibels = -20;
      actx.createMediaStreamSource(st).connect(ana);
      tMic = performance.now();
      lireMicro();
      return st;
    }
    function lireMicro(){
      if(!ana) return;
      var n = ana.frequencyBinCount, sr = actx.sampleRate, nyq = sr/2;
      var d = new Float32Array(n); ana.getFloatFrequencyData(d);
      function bande(f1,f2){
        if(f1 >= nyq) return null;               // la bande n'existe pas sur ce micro
        var a = Math.round(f1/nyq*n), b = Math.min(n, Math.round(f2/nyq*n));
        var m = -200; for(var i=a;i<b;i++) if(d[i]>m) m=d[i];
        // le SILENCE est une mesure : une bande vide vaut -100 dBFS, elle ne
        // vaut pas « rien ». Refuser le silence laissait les bandes désarmées
        // dans une pièce calme — exactement là où l'on travaille.
        return Math.max(-100, m);
      }
      var g1=bande(100,300), g2=bande(300,3000), g3=bande(3000,8000), g4=bande(15000,20000);
      if(g1!=null) poser('son_grave',g1);
      if(g2!=null) poser('son_medium',g2);
      if(g3!=null) poser('son_aigu',g3);
      if(g4!=null) poser('son_ultra',g4);
      else absente('son_ultra','le micro échantillonne à '+Math.round(sr/1000)+' kHz — la bande 15–20 kHz n\'existe pas sur cet appareil');

      var t = new Float32Array(ana.fftSize); ana.getFloatTimeDomainData(t);
      var s=0; for(var i=0;i<t.length;i++) s += t[i]*t[i];
      poser('son_niveau', 20*Math.log10(Math.sqrt(s/t.length)+1e-9));

      // flux spectral : combien le spectre a changé depuis la lecture précédente
      var oct = new Uint8Array(n); ana.getByteFrequencyData(oct);
      if(freqPrec){
        var f=0; for(var k=0;k<n;k++){ var dd=oct[k]-freqPrec[k]; if(dd>0) f+=dd; }
        poser('son_flux', f/n);
      }
      freqPrec = oct;

      setTimeout(lireMicro, 100);
    }
    function couperMicro(){
      if(micStream){ micStream.getTracks().forEach(function(t){ t.stop(); }); micStream=null; }
      ana=null; try{ if(actx && actx.close) actx.close(); }catch(e){} actx=null; freqPrec=null;
      famille('micro','micro éteint');
    }

    /* ═══════════ mouvement ═══════════ */
    var hMotion=null, hOrient=null, tMvt=0, capPrec=null, capBase=null;
    async function activerMouvement(){
      if(hMotion) return true;
      // iOS demande une permission explicite, et seulement sur un geste utilisateur
      if(typeof DeviceMotionEvent!=='undefined' && DeviceMotionEvent.requestPermission){
        try{
          var r = await DeviceMotionEvent.requestPermission();
          if(r!=='granted'){ famille('mouvement','permission refusée par le système'); return false; }
        }catch(e){ famille('mouvement','permission impossible à demander'); return false; }
      }
      hMotion = function(e){
        var a = e.accelerationIncludingGravity || e.acceleration;
        if(a && a.x!=null) poser('mvt_accel', Math.hypot(a.x||0, a.y||0, a.z||0));
        var g = e.rotationRate;
        if(g && (g.alpha!=null||g.beta!=null||g.gamma!=null))
          poser('mvt_gyro', Math.hypot(g.alpha||0, g.beta||0, g.gamma||0)*Math.PI/180);
      };
      hOrient = function(e){
        if(e.beta!=null || e.gamma!=null) poser('mvt_tilt', Math.hypot(e.beta||0, e.gamma||0));
        var cap = (e.webkitCompassHeading!=null) ? e.webkitCompassHeading
                : (e.absolute && e.alpha!=null) ? e.alpha : null;
        if(cap==null) return;
        if(capPrec==null){ capPrec = cap; capBase = cap; return; }
        var d = Math.abs(cap-capPrec); if(d>180) d = 360-d;
        capPrec = cap;
        poser('mag_cap', d);
      };
      addEventListener('devicemotion', hMotion);
      addEventListener('deviceorientationabsolute', hOrient);
      addEventListener('deviceorientation', hOrient);
      tMvt = performance.now();
      // vérification honnête : si rien n'arrive, il n'y a pas de capteur
      setTimeout(function(){
        ['mvt_accel','mvt_gyro','mvt_tilt'].forEach(function(c){
          if(!S[c].vu) absente(c,'aucune lecture — cet appareil n\'a pas ce capteur (c\'est le cas des ordinateurs)');
        });
        if(!S.mag_cap.vu && !S.mag_champ.vu)
          absente('mag_cap','aucune lecture de cap — pas de boussole sur cet appareil');
      }, ATTENTE);
      return true;
    }
    function couperMouvement(){
      if(hMotion) removeEventListener('devicemotion', hMotion);
      if(hOrient){ removeEventListener('deviceorientationabsolute', hOrient);
                   removeEventListener('deviceorientation', hOrient); }
      hMotion=hOrient=null; capPrec=null;
      famille('mouvement','mouvement éteint');
    }

    /* ═══════════ champ magnétique ═══════════ */
    var mag=null;
    async function activerMagnetique(){
      if(mag) return true;
      if(!('Magnetometer' in window)){
        absente('mag_champ','ce navigateur n\'expose pas le magnétomètre — la perturbation du cap lit le même capteur autrement');
        return activerMouvement();       // le cap boussole prend le relais
      }
      try{
        if(navigator.permissions && navigator.permissions.query){
          try{ await navigator.permissions.query({name:'magnetometer'}); }catch(e){}
        }
        var m = new Magnetometer({frequency:10});
        m.addEventListener('reading', function(){ poser('mag_champ', Math.hypot(m.x,m.y,m.z)); });
        m.addEventListener('error', function(){ absente('mag_champ','le capteur a refusé de démarrer'); });
        m.start(); mag = m;
      }catch(e){
        absente('mag_champ','le capteur a refusé de démarrer ('+(e&&e.name||'erreur')+')');
      }
      // dans tous les cas on allume aussi la boussole : deux lectures valent mieux qu'une
      await activerMouvement();
      setTimeout(function(){
        if(!S.mag_champ.vu && S.mag_champ.raison==='')
          absente('mag_champ','aucune lecture au bout de '+(ATTENTE/1000)+' s');
      }, ATTENTE);
      return true;
    }
    function couperMagnetique(){
      try{ if(mag) mag.stop(); }catch(e){} mag=null;
      absente('mag_champ','champ magnétique éteint');
    }

    /* ═══════════ caméra ═══════════ */
    var vstream=null, vid=null, cvC=null, gC=null, prec=null, camRaf=0;
    var CW=64, CH=48;
    async function activerCamera(contraintes){
      if(vstream) return vstream;
      try{
        vstream = await navigator.mediaDevices.getUserMedia(
          contraintes || {video:{facingMode:'environment'}, audio:false});
      }catch(e){
        try{ vstream = await navigator.mediaDevices.getUserMedia({video:true, audio:false}); }
        catch(e2){ famille('camera', raisonMedia(e2)); throw e2; }
      }
      vid = document.createElement('video');
      vid.srcObject = vstream; vid.muted = true; vid.playsInline = true;
      vid.setAttribute('playsinline','');
      try{ await vid.play(); }catch(e){}
      cvC = document.createElement('canvas'); cvC.width=CW; cvC.height=CH;
      gC = cvC.getContext('2d', {willReadFrequently:true});
      lireCamera();
      setTimeout(function(){
        if(!S.cam_lum.vu) absente('cam_lum','la caméra ne rend aucune image');
      }, ATTENTE);
      return vstream;
    }
    function lireCamera(){
      if(!vstream){ return; }
      camRaf = requestAnimationFrame(lireCamera);
      if(!vid || vid.readyState < 2) return;
      try{ gC.drawImage(vid, 0,0, CW,CH); }catch(e){ return; }
      var im = gC.getImageData(0,0,CW,CH).data;
      var n = CW*CH, gris = new Uint8Array(n), somme = 0;
      for(var i=0,p=0;i<n;i++,p+=4){
        var v = (im[p]*0.299 + im[p+1]*0.587 + im[p+2]*0.114)|0;
        gris[i]=v; somme+=v;
      }
      poser('cam_lum', somme/n);
      if(prec){
        var chg=0;
        for(var k=0;k<n;k++) if(Math.abs(gris[k]-prec[k]) > 24) chg++;
        poser('cam_diff', chg/n*100);
      }
      prec = gris;
    }
    /* changer d'objectif SANS tout redémarrer : on remplace le flux, on garde
       les témoins déjà armés. Si le nouvel objectif refuse, on rétablit
       l'ancien plutôt que de laisser l'utilisateur sans image. */
    async function changerCamera(contraintes){
      const ancien = vstream;
      let neuf;
      try{ neuf = await navigator.mediaDevices.getUserMedia(contraintes); }
      catch(e){ return false; }
      try{ if(ancien) ancien.getTracks().forEach(function(t){ t.stop(); }); }catch(e){}
      vstream = neuf;
      if(vid){ vid.srcObject = neuf; try{ await vid.play(); }catch(e){} }
      prec = null;                      // l'image de référence n'a plus de sens
      return true;
    }

    /* la liste des objectifs réellement présents. Les libellés ne sont donnés
       par le navigateur QU'APRÈS une première autorisation — avant, ils sont
       vides, et il faut le dire plutôt qu'afficher des lignes anonymes. */
    async function objectifs(){
      try{
        const l = await navigator.mediaDevices.enumerateDevices();
        return l.filter(function(d){ return d.kind === 'videoinput'; })
                .map(function(d,i){ return { id:d.deviceId, nom: d.label || ('Objectif ' + (i+1)) }; });
      }catch(e){ return []; }
    }

    function couperCamera(){
      if(camRaf) cancelAnimationFrame(camRaf); camRaf=0;
      if(vstream){ vstream.getTracks().forEach(function(t){ t.stop(); }); vstream=null; }
      vid=null; prec=null;
      famille('camera','caméra éteinte');
    }

    function raisonMedia(e){
      if(window.GBMedia && GBMedia.explain) return GBMedia.explain(e);
      var n = e && e.name;
      if(n==='NotAllowedError') return 'autorisation refusée';
      if(n==='NotFoundError')   return 'aucun appareil de ce type sur cette machine';
      if(n==='NotReadableError')return 'appareil occupé par une autre application';
      return 'accès impossible ('+(n||'erreur')+')';
    }

    /* une voie est réellement vivante si elle a donné une valeur récemment :
       un capteur qui s'arrête en cours de route ne doit pas rester « armé » */
    function vivante(code, maxAge){
      var s = S[code];
      return !!(s && s.dispo && s.val!=null && (performance.now()-s.vu) < (maxAge||3000));
    }

    return {
      activer: function(f, arg){
        if(f==='micro')      return activerMicro();
        if(f==='mouvement')  return activerMouvement();
        if(f==='magnetique') return activerMagnetique();
        if(f==='camera')     return activerCamera(arg);
        return Promise.reject(new Error('famille inconnue : '+f));
      },
      couper: function(f){
        if(f==='micro') couperMicro();
        else if(f==='mouvement') couperMouvement();
        else if(f==='magnetique') couperMagnetique();
        else if(f==='camera') couperCamera();
      },
      couperTout: function(){ couperMicro(); couperMouvement(); couperMagnetique(); couperCamera(); },
      changerCamera: changerCamera,
      objectifs: objectifs,
      voies: function(){ return VOIES.map(function(v){
        var s=S[v.code];
        return { code:s.code, label:s.label, unite:s.unite, famille:s.famille, quoi:s.quoi,
                 dispo:s.dispo, raison:s.raison, val:s.val, vivante:vivante(s.code) }; }); },
      lire: function(code){ var s=S[code]; return s? s.val : null; },
      vivante: vivante,
      analyser: function(){ return ana; },
      contexte:  function(){ return actx; },
      fluxMicro: function(){ return micStream; },
      fluxCamera:function(){ return vstream; },
      videoEl:   function(){ return vid; },
      FAMILLES: ['micro','mouvement','magnetique','camera']
    };
  }

  return { creer: creer, VOIES: VOIES };
})();
