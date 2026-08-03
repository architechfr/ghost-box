/* ═══════════════════════════════════════════════════════════════════════
   Capture instantanée — boutons flottants, disponibles À TOUT INSTANT.
   Une observation ne prévient pas : il ne doit jamais falloir chercher
   un bouton ni faire défiler la page pour saisir ce qu'on voit.

   ○  photo immédiate de l'image telle qu'elle est affichée
      (incrustations et squelettes compris), rangée dans la bibliothèque
   ●  démarre / arrête l'enregistrement vidéo du mode courant

   Les boutons suivent le plein écran : ils se replacent DANS l'élément
   passé en plein écran, sinon ils seraient invisibles.

   Branchement par la page :
     GBCapture.init({ frame: fn, rec: '#recBtn', label: 'vision' })
       frame() → un <canvas> déjà composé, ou {video, overlay}
   ═══════════════════════════════════════════════════════════════════════ */
window.GBCapture = (function(){
  var cfg = null, wrap = null, shot = null, recBtn = null, flash = null;

  function css(){
    var st = document.createElement('style');
    st.textContent =
      '#gbCap{position:fixed;z-index:9998;right:10px;' +
      'bottom:calc(14px + env(safe-area-inset-bottom));' +
      'display:flex;flex-direction:column;gap:10px;align-items:center}' +
      '#gbCap button{width:56px;height:56px;padding:0;border-radius:50%;' +
      'font-size:20px;line-height:1;font-family:ui-monospace,monospace;letter-spacing:0;' +
      'background:rgba(20,26,30,.82);color:#DDE6EA;border:2px solid #5FD3A6;' +
      'backdrop-filter:blur(6px);cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.5)}' +
      '#gbCap button:active{transform:scale(.92)}' +
      '#gbCap button.rec{border-color:#E2574C;color:#E2574C}' +
      '#gbCap button.rec.on{background:#E2574C;color:#180605}' +
      '#gbCap .cnt{font-family:ui-monospace,monospace;font-size:11px;color:#5FD3A6;' +
      'background:rgba(10,15,18,.85);padding:3px 8px;border-radius:9px;border:1px solid #5FD3A6}' +
      '#gbFlash{position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;' +
      'z-index:10000;transition:opacity .18s ease-out}' +
      '#gbFlash.on{opacity:.75;transition:none}';
    document.head.appendChild(st);
  }

  /* compose l'image affichée dans un canvas hors écran */
  function compose(){
    var src = cfg.frame && cfg.frame();
    if(!src) return null;
    var c = document.createElement('canvas'), g;
    if(src.tagName === 'CANVAS'){
      if(!src.width) return null;
      c.width = src.width; c.height = src.height;
      c.getContext('2d').drawImage(src, 0, 0);
      return c;
    }
    var v = src.video, ov = src.overlay;
    if(!v || !v.videoWidth) return null;
    c.width = v.videoWidth; c.height = v.videoHeight;
    g = c.getContext('2d');
    g.drawImage(v, 0, 0, c.width, c.height);
    if(ov && ov.width) g.drawImage(ov, 0, 0, c.width, c.height);
    return c;
  }

  function stamp(){
    return new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
  }

  function blink(){
    if(!flash) return;
    flash.classList.add('on');
    setTimeout(function(){ flash.classList.remove('on'); }, 60);
  }

  var count = 0, counter = null;

  /* range un canvas déjà composé dans la bibliothèque. `extra` est fusionné
     dans la fiche du clip : c'est là que la page met CE QUI A MOTIVÉ la photo
     (détection, mesures) — une image de capture automatique sans sa raison
     d'être ne prouve rien. */
  function photoCanvas(c, extra){
    if(!c || !c.width) return;
    blink();
    // horodatage discret gravé dans la photo
    var g = c.getContext('2d'), s = c.width / 960;
    g.fillStyle = 'rgba(10,15,18,.6)';
    g.fillRect(0, c.height - 22 * s, c.width, 22 * s);
    g.fillStyle = '#CFC6B4';
    g.font = (13 * s | 0) + 'px monospace';
    g.fillText(new Date().toLocaleString('fr-FR'), 8 * s, c.height - 6 * s);

    c.toBlob(function(blob){
      if(!blob) return;
      var nom = 'photo-' + stamp() + '.jpg';
      var vignette = '';
      try{
        var t = document.createElement('canvas');
        t.width = 156; t.height = Math.round(156 * c.height / c.width);
        t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
        vignette = t.toDataURL('image/jpeg', .5);
      }catch(e){}
      var fiche = { id: Date.now(), nom: nom, mime: 'image/jpeg', taille: blob.size,
             duree: 0, vignette: vignette, cam: cfg.label || 'capture',
             blob: blob, type: 'photo' };
      if(extra) for(var k in extra) if(Object.prototype.hasOwnProperty.call(extra,k)) fiche[k]=extra[k];
      save(fiche);
      count++;
      if(counter){ counter.textContent = count + ' ✓ voir'; counter.style.display = 'block'; }
      if(cfg.onSaved) cfg.onSaved(count);
    }, 'image/jpeg', 0.92);
  }

  function takePhoto(){
    var c = compose();
    if(!c){ return; }
    photoCanvas(c);
  }

  /* même bibliothèque que Vision */
  function save(o){
    try{
      var r = indexedDB.open('ghostbox-vision', 1);
      r.onupgradeneeded = function(){
        if(!r.result.objectStoreNames.contains('clips'))
          r.result.createObjectStore('clips', { keyPath: 'id' });
      };
      r.onsuccess = function(){
        try{
          var t = r.result.transaction('clips', 'readwrite');
          t.objectStore('clips').put(o);
        }catch(e){ download(o); }
      };
      r.onerror = function(){ download(o); };
    }catch(e){ download(o); }
  }
  function download(o){
    var u = URL.createObjectURL(o.blob), a = document.createElement('a');
    a.href = u; a.download = o.nom; a.click();
    setTimeout(function(){ URL.revokeObjectURL(u); }, 5000);
  }

  /* les boutons doivent vivre DANS l'élément plein écran, sinon ils disparaissent */
  function reattach(){
    var host = document.fullscreenElement || document.webkitFullscreenElement || document.body;
    if(wrap && wrap.parentNode !== host) host.appendChild(wrap);
    if(flash && flash.parentNode !== host) host.appendChild(flash);
  }

  function init(options){
    cfg = options || {};
    css();

    flash = document.createElement('div'); flash.id = 'gbFlash';

    wrap = document.createElement('div'); wrap.id = 'gbCap';

    counter = document.createElement('a');
    counter.className = 'cnt'; counter.style.display = 'none';
    counter.href = '/ghost-box/bibliotheque/';
    counter.style.textDecoration = 'none';
    counter.title = 'Voir les captures';

    shot = document.createElement('button');
    shot.type = 'button'; shot.textContent = '○';
    shot.title = 'Photo immédiate';
    shot.setAttribute('aria-label', 'Photo immédiate');
    shot.addEventListener('click', function(e){ e.preventDefault(); takePhoto(); });

    wrap.appendChild(counter);
    wrap.appendChild(shot);

    if(cfg.rec){
      recBtn = document.createElement('button');
      recBtn.type = 'button'; recBtn.className = 'rec'; recBtn.textContent = '●';
      recBtn.title = 'Enregistrer la vidéo';
      recBtn.setAttribute('aria-label', 'Enregistrer la vidéo');
      recBtn.addEventListener('click', function(e){
        e.preventDefault();
        var target = document.querySelector(cfg.rec);
        if(target && !target.disabled) target.click();
        setTimeout(syncRec, 300);
      });
      wrap.appendChild(recBtn);
      setInterval(syncRec, 800);
    }

    document.body.appendChild(flash);
    document.body.appendChild(wrap);
    document.addEventListener('fullscreenchange', reattach);
    document.addEventListener('webkitfullscreenchange', reattach);
  }

  function syncRec(){
    if(!recBtn || !cfg.rec) return;
    var t = document.querySelector(cfg.rec);
    if(!t) return;
    var on = /arr[êe]ter/i.test(t.textContent) || t.classList.contains('on');
    recBtn.classList.toggle('on', on);
    recBtn.textContent = on ? '■' : '●';
  }

  return { init: init, photo: takePhoto, photoCanvas: photoCanvas };
})();
