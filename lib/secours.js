/* ═══════════════════════════════════════════════════════════════════════
   Secours — une prise en cours ne doit JAMAIS pouvoir disparaître.

   Le défaut qu'on répare ici : tant qu'un enregistrement n'était pas arrêté à
   la main, il n'existait que dans la mémoire vive de la page. Un téléphone qui
   met l'application en veille, un onglet fermé, un navigateur qui reprend de la
   mémoire — et une séance entière était perdue, sans rien à récupérer. Sur ce
   genre d'outil, c'est la pire panne possible : ce qui a été vécu ne se refait
   pas.

   Le principe : pendant l'enregistrement, chaque morceau est écrit AU FUR ET À
   MESURE dans la base de l'appareil, sous une session ouverte. Rien n'est
   réécrit (on ajoute, on ne remplace pas), donc ça reste léger même sur une
   longue prise. Trois issues possibles :

     — arrêt normal   → `finir()` assemble le fichier et efface les morceaux ;
     — page fermée    → les morceaux restent, et au retour l'application propose
                        de récupérer la prise interrompue ;
     — abandon voulu  → `jeter()` efface tout, explicitement.

   Au pire on perd la dernière seconde, jamais la séance.
   ═══════════════════════════════════════════════════════════════════════ */
window.GBSecours = (function(){
  "use strict";
  var DBN='ghostbox-vision', ST='clips';

  function db(){
    return new Promise(function(res,rej){
      var r=indexedDB.open(DBN,1);
      r.onupgradeneeded=function(){
        if(!r.result.objectStoreNames.contains(ST)) r.result.createObjectStore(ST,{keyPath:'id'});
      };
      r.onsuccess=function(){ res(r.result); }; r.onerror=function(){ rej(r.error); };
    });
  }
  function put(o){ return db().then(function(d){ return new Promise(function(res,rej){
    var t=d.transaction(ST,'readwrite'); t.objectStore(ST).put(o);
    t.oncomplete=function(){res();}; t.onerror=function(){rej(t.error);}; }); }); }
  function tous(){ return db().then(function(d){ return new Promise(function(res,rej){
    var t=d.transaction(ST,'readonly'), q=t.objectStore(ST).getAll();
    q.onsuccess=function(){ res(q.result||[]); }; q.onerror=function(){ rej(q.error); }; }); }); }
  function del(id){ return db().then(function(d){ return new Promise(function(res,rej){
    var t=d.transaction(ST,'readwrite'); t.objectStore(ST).delete(id);
    t.oncomplete=function(){res();}; t.onerror=function(){rej(t.error);}; }); }); }

  /* en-tête WAV 16 bits mono — le PCM seul n'est lisible par aucun lecteur */
  function entWav(sr, octets){
    var b=new ArrayBuffer(44), v=new DataView(b);
    function txt(o,t){ for(var i=0;i<t.length;i++) v.setUint8(o+i, t.charCodeAt(i)); }
    txt(0,'RIFF'); v.setUint32(4, 36+octets, true); txt(8,'WAVE');
    txt(12,'fmt '); v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
    v.setUint32(24,sr,true); v.setUint32(28,sr*2,true); v.setUint16(32,2,true); v.setUint16(34,16,true);
    txt(36,'data'); v.setUint32(40, octets, true);
    return b;
  }

  var seq=0;
  function cle(){ seq++; return Date.now()*1000 + (seq%1000); }

  /* ── une prise en cours ── */
  function ouvrir(meta){
    meta = meta || {};
    var session = 's'+Date.now()+'-'+((Math.random()*1e6)|0);
    var n = 0, octets = 0, file = Promise.resolve(), vivant = true;

    // marqueur de session : c'est lui qui rend la prise repérable au retour
    file = file.then(function(){ return put({
      id: cle(), secours:'entete', session: session, type:'encours',
      debut: new Date().toISOString(), meta: meta, nom: meta.nom || 'prise', taille: 0
    }); }).catch(function(){});

    return {
      session: session,
      /* un morceau de plus, écrit tout de suite */
      ajouter: function(blob, extra){
        if(!vivant || !blob || !blob.size) return file;
        n++; octets += blob.size;
        var o = { id: cle(), secours:'morceau', session: session, seq: n,
                  blob: blob, taille: blob.size };
        if(extra) o.extra = extra;
        file = file.then(function(){ return put(o); }).catch(function(){});
        return file;
      },
      morceaux: function(){ return n; },
      octets: function(){ return octets; },
      /* arrêt normal : la prise devient un fichier, les morceaux disparaissent */
      finir: function(){
        vivant = false;
        return file.then(function(){ return jeter(session); });
      },
      /* abandon explicite */
      jeter: function(){ vivant = false; return file.then(function(){ return jeter(session); }); }
    };
  }

  /* ── au retour : y a-t-il une prise interrompue ? ── */
  function enAttente(){
    return tous().then(function(all){
      var par = {};
      all.forEach(function(o){
        if(!o.secours) return;
        var s = par[o.session] || (par[o.session] = {session:o.session, morceaux:0, octets:0, meta:null, debut:null});
        if(o.secours==='entete'){ s.meta=o.meta||{}; s.debut=o.debut; }
        else { s.morceaux++; s.octets += o.taille||0; }
      });
      return Object.keys(par).map(function(k){ return par[k]; })
        .filter(function(s){ return s.morceaux>0; });
    }).catch(function(){ return []; });
  }

  /* assemble une prise interrompue en un vrai fichier, puis efface les morceaux */
  function recuperer(session){
    return tous().then(function(all){
      var mo = all.filter(function(o){ return o.secours==='morceau' && o.session===session; })
                  .sort(function(a,b){ return a.seq-b.seq; });
      var en = all.filter(function(o){ return o.secours==='entete' && o.session===session; })[0];
      if(!mo.length) return null;
      var meta = (en && en.meta) || {};
      var type = meta.mime || mo[0].blob.type || 'video/webm';
      var parts = mo.map(function(o){ return o.blob; });
      var blob;
      if(meta.wav && meta.wav.sr){
        // les morceaux sont du PCM brut : on lui remet un en-tête WAV pour qu'il soit lisible
        var oct = mo.reduce(function(p2,o){ return p2+(o.taille||0); },0);
        blob = new Blob([entWav(meta.wav.sr, oct)].concat(parts), {type:'audio/wav'});
        type = 'audio/wav';
      } else {
        blob = new Blob(parts, {type:type});
      }
      var ext = type.indexOf('mp4')>=0 ? 'mp4' : (type.indexOf('audio')>=0 ? 'wav' : 'webm');
      var clip = { id: Date.now(), nom: (meta.nom||'prise-recuperee')+'.'+ext, mime: type,
                   taille: blob.size, duree: meta.duree||0, vignette: meta.vignette||'',
                   cam: meta.cam||'prise interrompue', blob: blob, type: meta.type||undefined,
                   source: meta.source||'secours', recupere: true,
                   journal: meta.journal||null };
      return put(clip).then(function(){ return jeter(session); }).then(function(){ return clip; });
    }).catch(function(){ return null; });
  }

  function jeter(session){
    return tous().then(function(all){
      var ids = all.filter(function(o){ return o.secours && o.session===session; })
                   .map(function(o){ return o.id; });
      return ids.reduce(function(p,id){ return p.then(function(){ return del(id); }); }, Promise.resolve());
    }).catch(function(){});
  }

  return { ouvrir: ouvrir, enAttente: enAttente, recuperer: recuperer, jeter: jeter };
})();
