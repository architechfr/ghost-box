/* ═══════════════════════════════════════════════════════════════════════
   Le récit — chaque sortie de l'appareil sait raconter sa propre naissance.

   POURQUOI CE MODULE EXISTE
   L'utilisateur de cet appareil doit pouvoir répondre à la question « comment
   et pourquoi ce mot est-il sorti ? » — à un témoin, à un sceptique, à
   lui-même. Toutes les données existent : la voie, la valeur brute, l'écart
   en σ, le seuil du moment, le travail du témoin de bruit, le calcul de
   l'index. Mais des données ne sont pas une réponse. Ce module transforme
   l'enregistrement d'une émission en ACTE DE NAISSANCE : un texte en
   français, produit à partir des mesures et d'elles seules.

   CE QUE CE MODULE N'EST PAS
   Ce n'est pas une IA générative. Chaque phrase est un gabarit rempli par
   des nombres mesurés — hors ligne, déterministe, la même émission produit
   le même récit au mot près. Un appareil qui refuse d'inventer des mots ne
   va pas inventer leurs explications : le récit est une PREUVE mise en
   français, pas un commentaire.

   Logique pure, aucun DOM : la page affiche, le module raconte.
   ═══════════════════════════════════════════════════════════════════════ */
window.GBRecit = (function(){
  "use strict";

  function n1(x){ return (Math.round(x*10)/10).toString().replace('.', ','); }
  function n2(x){ return (Math.round(x*100)/100).toString().replace('.', ','); }

  /* ── l'acte de naissance d'un MOT (moteur → lexique) ──
     rec = { mot, voie, unite, brut, sigma, seuil, plancher, relevages,
             coincidence:[{voie,sigma}...], index, taille, mode, temoin } */
  function mot(rec){
    var p = [];
    if(rec.temoin){
      p.push("Ce mot vient du MODE TÉMOIN : aucun capteur n'a été lu. Il a été " +
        "tiré par un générateur de nombres, exprès, pour te donner un point de " +
        "comparaison. Si tes séances réelles ressemblent à tes séances témoin, " +
        "c'est une information — la plus importante de toutes.");
      return p;
    }
    p.push("Pendant l'apprentissage, l'appareil a écouté la voie « " + rec.voie +
      " » sans rien juger, et en a tiré sa normale : ce que ce lieu-là produit " +
      "tout seul, mesuré par la médiane et l'écart absolu médian — deux mesures " +
      "qu'un pic isolé ne peut pas fausser.");
    if(isFinite(rec.sigma) && isFinite(rec.seuil)){
      p.push("À l'instant de l'émission, cette voie a mesuré " +
        (rec.brut != null ? n2(rec.brut) + (rec.unite ? " " + rec.unite : "") + ", soit " : "") +
        "un écart de " + n1(rec.sigma) + " σ au-dessus de sa normale. Le seuil " +
        "exigé à ce moment-là était de " + n1(rec.seuil) + " σ" +
        (rec.plancher ? " — jamais moins de " + n1(rec.plancher) +
          " σ, un plancher qui n'a pas été choisi mais MESURÉ : c'est le premier " +
          "réglage qui rend l'appareil muet sur des centaines d'heures de bruit pur" : "") +
        ". Et il ne suffit pas de franchir le seuil une fois : il faut y rester " +
        "plusieurs relevés de suite — un claquement isolé ne compte pas.");
    }
    if(rec.relevages > 0){
      p.push("Pendant la séance, le témoin de bruit — le propre bruit du lieu, " +
        "rejoué en boucle et éprouvé seize fois par mesure — a réussi à " +
        (rec.relevages > 1 ? rec.relevages + " reprises" : "une reprise") +
        " à faire semblant de parler. Chaque fois, le seuil a été relevé de 15 %. " +
        "Ce mot a donc passé un seuil DURCI par les coups de chance mêmes du hasard.");
    } else if(rec.relevages === 0){
      p.push("Le témoin de bruit — le propre bruit du lieu, rejoué en boucle et " +
        "éprouvé seize fois par mesure — n'a jamais réussi à faire semblant de " +
        "parler pendant cette séance : le seuil n'a pas eu besoin d'être relevé.");
    }
    if(rec.coincidence && rec.coincidence.length > 1){
      p.push("Il ne s'agissait pas d'une voie isolée : " + rec.coincidence.length +
        " voies ont parlé dans la même fenêtre (" +
        rec.coincidence.map(function(c){ return c.voie + (isFinite(c.sigma) ? " à " + n1(c.sigma) + " σ" : ""); }).join(", ") +
        "). Un défaut d'électronique ne touche qu'une voie ; un événement " +
        "physique en touche plusieurs.");
    }
    if(rec.index != null && rec.taille){
      p.push("Le mot lui-même n'a pas été « entendu » : l'instant de l'anomalie a " +
        "désigné la position " + rec.index + " parmi les " + rec.taille +
        " mots visibles, et cette position portait « " + rec.mot + " ». " +
        "Le vocabulaire vient du lexique, l'instant vient de la mesure — le sens, " +
        "lui, n'appartient qu'à celui qui lit. Ces " + rec.taille + " mots-là ne " +
        "sont pas tout le lexique : les mots-outils (« parce », « te », « sur », " +
        "« il ») en ont été retirés, non parce qu'ils seraient faux, mais parce " +
        "qu'ils ne disent rien seuls — et qu'une anomalie est trop rare pour être " +
        "dépensée sur un mot incomplet. Ce tri ne fait pas sortir plus de mots : " +
        "il change ce qui est écrit, jamais quand.");
    }
    p.push("Ce que ce mot prouve : qu'il s'est passé, sur cette voie et à cet " +
      "instant, quelque chose que le bruit de ce lieu n'a jamais su produire " +
      "pendant tout le temps où on l'a écouté. Ce qu'il ne prouve pas : qui, ou " +
      "quoi. L'appareil mesure l'anomalie ; il ne nomme pas sa cause.");
    return p;
  }

  /* ── l'acte de naissance d'une LETTRE (planche) ──
     rec = { ch, voie, brut, unite, sigma, origine, idx, finesse, arret,
             coincidence, garde, temoin, graine, texte } */
  function lettre(rec){
    var p = [];
    if(rec.origine === 'entendue'){
      p.push("Cette lettre n'a PAS été désignée par les capteurs : quelqu'un l'a " +
        "PRONONCÉE. Le micro a entendu « " + (rec.texte || rec.ch) + " », et seul " +
        "un énoncé qui est lui-même une lettre est retenu — une lettre trouvée " +
        "dans une phrase ne compte jamais, sinon la moindre conversation " +
        "écrirait des mots. Elle est marquée en vert partout : la confondre avec " +
        "une lettre mesurée serait le pire service à rendre à la séance.");
      return p;
    }
    if(rec.temoin){
      p.push("Cette lettre vient du MODE TÉMOIN : aucun capteur n'a été lu, tout " +
        "est sorti d'un générateur à graine fixe" + (rec.graine ? " (graine " + rec.graine + ")" : "") +
        " — la séance entière est rejouable à l'identique. Si tu ne fais pas la " +
        "différence avec une séance réelle, tu viens d'apprendre quelque chose " +
        "de réel sur ton montage.");
      return p;
    }
    if(rec.garde != null){
      p.push("Avant toute chose, la planche a observé sans écrire pendant que le " +
        "témoin de bruit calait ses seuils — parce que les premières minutes " +
        "sont, mesuré, les seules où le hasard sait encore passer. Cette lettre " +
        "est sortie APRÈS cette garde : le lieu était appris.");
    }
    if(isFinite(rec.sigma)){
      p.push("La voie « " + (rec.voie || '?') + " » a dépassé son seuil appris de " +
        n1(rec.sigma) + " σ" +
        (rec.coincidence > 1 ? ", et elle n'était pas seule : " + rec.coincidence +
          " voies distinctes ont parlé dans la même fenêtre — l'exigence qui, " +
          "mesurée, ramène le bruit pur à zéro lettre sur des centaines d'heures" : "") + ".");
    }
    p.push("La lettre n'a pas été choisie par le niveau du signal — le niveau " +
      "sert au déclenchement, pas à la désignation. Ce sont les MILLIÈMES de la " +
      "valeur brute" + (rec.brut ? " (" + rec.brut + (rec.unite ? " " + rec.unite : "") + ")" : "") +
      " qui ont désigné la case " + (rec.idx != null ? rec.idx + " " : "") +
      "de la planche : la même valeur redonnerait la même lettre, et seules les " +
      "voies dont la finesse a été ÉPROUVÉE pendant le rituel ont ce droit — " +
      "un capteur qui retombe toujours sur la même case est écarté, et l'écran le dit.");
    if(rec.arret){
      p.push("Enfin, rien n'a été écrit tant que la planchette ne s'est pas " +
        "ARRÊTÉE sur la lettre pendant " + n1(rec.arret) + " s : le trajet se " +
        "regarde venir, et un passage n'est pas un choix.");
    }
    p.push("Ce que cette lettre prouve : une anomalie mesurée, sur une voie " +
      "éprouvée, après la garde. Ce qu'elle ne prouve pas : qui, ou quoi. " +
      "L'appareil désigne ; il ne nomme pas.");
    return p;
  }

  /* ── résumé d'une ligne, pour les journaux ── */
  function court(rec){
    if(rec.origine === 'entendue') return 'prononcée au micro : « ' + (rec.texte || rec.ch) + ' »';
    if(rec.temoin) return 'mode témoin — aucun capteur lu';
    var s = rec.voie || '?';
    if(isFinite(rec.sigma)) s += ' · ' + n1(rec.sigma) + ' σ';
    if(isFinite(rec.seuil)) s += ' (seuil ' + n1(rec.seuil) + ' σ)';
    if(rec.index != null) s += ' · case ' + rec.index;
    return s;
  }

  return { mot:mot, lettre:lettre, court:court };
})();
