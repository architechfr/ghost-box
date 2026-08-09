/* ═══════════════════════════════════════════════════════════════════════
   Lettres entendues — la reconnaissance de parole, et ses deux dettes.

   CE QUE C'EST
   Quand quelqu'un prononce nettement « B », la planche va sur le B. La
   lettre est alors marquée ENTENDUE, jamais désignée : c'est une source
   différente de celle des capteurs, elle porte une autre couleur à l'écran,
   une autre ligne au journal, une autre colonne à l'export. Confondre les
   deux serait le pire service à rendre à une séance.

   LES DEUX DETTES, ET POURQUOI ELLES SONT AFFICHÉES
   1. `SpeechRecognition` de Chrome N'EST PAS locale : l'audio part sur les
      serveurs de Google pour y être transcrit. C'est la SEULE chose de toute
      l'application qui quitte l'appareil. L'option est donc coupée par
      défaut, et la page le dit en toutes lettres avant qu'on l'active.
   2. Elle exige du réseau. Dans une cave, elle ne marchera pas — et le
      module le DIT plutôt que de rester muet en laissant croire que
      personne n'a parlé.

   LE PIÈGE DE FOND, ET LA RÈGLE QUI L'ÉVITE
   Une transcription contient des lettres partout : « il a dit bonjour »
   contient un « a ». Accepter une lettre trouvée DANS une phrase, c'est
   fabriquer des lettres à chaque conversation — exactement la machine à
   pareidolie que cet appareil refuse d'être. On n'accepte donc QUE des
   énoncés qui sont EUX-MÊMES une lettre : un seul mot, appartenant à la
   table des noms de lettres. « Bé » compte. « Bonjour » ne compte pas, et
   n'a aucune raison de compter.

   Le français complique : Chrome transcrit une lettre prononcée tantôt par
   le caractère (« B »), tantôt par son nom (« bé »), tantôt par un mot qui
   sonne pareil (« et » pour E, « ache » pour H, « ail » pour L…). La table
   ci-dessous couvre ces trois formes, et rien d'autre.
   ═══════════════════════════════════════════════════════════════════════ */
window.GBLettres = (function(){
  "use strict";

  var CTOR = window.SpeechRecognition || window.webkitSpeechRecognition;

  /* nom prononcé → glyphe. Uniquement des énoncés qui SONT une lettre. */
  var TABLE = {
    'a':'A','à':'A',
    'b':'B','bé':'B','be':'B','bee':'B',
    'c':'C','cé':'C','ce':'C','ces':'C','ses':'C',
    'd':'D','dé':'D','de':'D','des':'D',
    'e':'E','eux':'E','euh':'E',
    'f':'F','effe':'F','ef':'F','fe':'F',
    'g':'G','gé':'G','ge':'G','j\'ai':'G',
    'h':'H','ache':'H','hache':'H','hach':'H',
    'i':'I','y':'I','hi':'I',
    'j':'J','ji':'J','gi':'J',
    'k':'K','ka':'K','cas':'K','qua':'K',
    'l':'L','elle':'L','el':'L','aile':'L','ail':'L',
    'm':'M','emme':'M','aime':'M','em':'M',
    'n':'N','enne':'N','haine':'N','en':'N',
    'o':'O','au':'O','eau':'O','oh':'O',
    'p':'P','pé':'P','pe':'P','pet':'P',
    'q':'Q','qu':'Q','cul':'Q','queue':'Q','ku':'Q',
    'r':'R','erre':'R','air':'R','ère':'R','aire':'R',
    's':'S','esse':'S','ès':'S','est-ce':'S',
    't':'T','té':'T','te':'T','thé':'T','tes':'T',
    'u':'U','eu':'U','hue':'U',
    'v':'V','vé':'V','ve':'V','vais':'V',
    'w':'W','double v':'W','double vé':'W','doublevé':'W','double-vé':'W',
    'x':'X','iks':'X','ixe':'X','ix':'X',
    'y':'Y','i grec':'Y','igrec':'Y','y grec':'Y',
    'z':'Z','zède':'Z','zed':'Z','zeta':'Z',
    'zéro':'0','zero':'0','0':'0',
    'un':'1','1':'1','une':'1',
    'deux':'2','2':'2',
    'trois':'3','3':'3',
    'quatre':'4','4':'4',
    'cinq':'5','5':'5',
    'six':'6','6':'6',
    'sept':'7','7':'7',
    'huit':'8','8':'8',
    'neuf':'9','9':'9',
    'oui':'OUI','non':'NON',
    'au revoir':'AU REVOIR','aurevoir':'AU REVOIR','adieu':'AU REVOIR'
  };

  function nettoyer(s){
    return String(s || '').toLowerCase().trim()
      .replace(/[.,;!?…"«»]/g, '')
      .replace(/\s+/g, ' ');
  }

  /* Rend le glyphe si — et seulement si — l'énoncé ENTIER est une lettre.
     Deux mots au plus, pour « double vé », « i grec » et « au revoir ». */
  function lire(txt){
    var t = nettoyer(txt);
    if(!t) return null;
    if(TABLE[t]) return TABLE[t];
    var mots = t.split(' ');
    if(mots.length === 1) return null;      // un mot inconnu reste inconnu
    if(mots.length === 2 && TABLE[mots[0] + ' ' + mots[1]]) return TABLE[mots[0] + ' ' + mots[1]];
    return null;                            // une PHRASE ne donne jamais de lettre
  }

  function creer(cfg){
    cfg = cfg || {};
    if(!CTOR) return null;
    var rec = new CTOR(), vivant = false, veutVivre = false, dernier = 0;
    rec.lang = cfg.langue || 'fr-FR';
    rec.continuous = true;
    rec.interimResults = false;
    rec.maxAlternatives = 3;

    rec.onresult = function(ev){
      for(var i = ev.resultIndex; i < ev.results.length; i++){
        var r = ev.results[i];
        if(!r.isFinal) continue;
        /* on essaie les alternatives : Chrome place souvent « bé » en second
           choix derrière un mot courant qui sonne pareil */
        for(var k = 0; k < r.length; k++){
          var ch = lire(r[k].transcript);
          if(ch){
            var now = Date.now();
            if(now - dernier < 700) return;           // une même parole, un seul glyphe
            dernier = now;
            if(cfg.onLettre) try{ cfg.onLettre(ch, {
              texte: String(r[k].transcript).trim(),
              confiance: r[k].confidence,
              rang: k
            }); }catch(e){}
            return;
          }
        }
      }
    };
    rec.onerror = function(e){
      /* « no-speech » est normal dans une pièce silencieuse : ce n'est pas une
         panne et on ne va pas l'annoncer toutes les cinq secondes. */
      if(e.error === 'no-speech' || e.error === 'aborted') return;
      if(cfg.onEtat) try{ cfg.onEtat('erreur', e.error); }catch(x){}
    };
    rec.onend = function(){
      vivant = false;
      if(veutVivre){ try{ rec.start(); vivant = true; }catch(e){} }
      else if(cfg.onEtat) try{ cfg.onEtat('arret', ''); }catch(x){}
    };

    return {
      demarrer: function(){
        veutVivre = true;
        try{ rec.start(); vivant = true;
             if(cfg.onEtat) cfg.onEtat('marche', ''); }
        catch(e){ if(cfg.onEtat) cfg.onEtat('erreur', e.name || 'refus'); }
      },
      arreter: function(){ veutVivre = false; try{ rec.stop(); }catch(e){} },
      actif: function(){ return veutVivre; },
      vivant: function(){ return vivant; }
    };
  }

  return { creer:creer, lire:lire, table:TABLE,
           dispo: function(){ return !!CTOR; } };
})();
