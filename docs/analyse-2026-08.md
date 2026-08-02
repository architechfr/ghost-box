# Ghost Box — analyse de l'application

*Audit réalisé le 2 août 2026, sur captures d'écran au format téléphone (390 × 844), page par page, avec mesures à l'appui. L'angle : tout s'utilise sur un téléphone, souvent dans le noir, souvent d'une seule main.*

## Où en est le produit

Le fond est solide, et il faut le dire d'abord parce que c'est lui qui donne sa valeur au reste : un moteur de détection unique, éprouvé par simulation, qui préfère se taire ; un mur de mots devenu le cœur visuel et rituel de l'application ; une bibliothèque unique où tout arrive ; un filet de sécurité qui rend la perte d'une prise impossible ; une marque désormais reconnaissable. L'application ne ment jamais à son utilisateur, et ça se sent dans chaque écran. Ce qui suit n'est donc pas une liste de défauts, c'est l'écart entre un bon outil et un bel instrument.

## Le constat central : l'application explique quand elle devrait servir

C'est le point qui domine tout le reste. Chaque page s'ouvre sur ses explications — excellentes, mais identiques à chaque visite. La séance capteurs pèse **965 mots** de texte permanent et s'étale sur **cinq écrans de téléphone** ; le bouton « Lancer la veille » est au troisième. Sur le terrain, dans le noir, on refait défiler à chaque fois un cours qu'on connaît par cœur pour atteindre trois boutons. La pédagogie honnête est une qualité du produit ; sa place n'est simplement pas *devant* les commandes à la centième utilisation.

La réponse n'est pas de supprimer ces textes mais de les replier : chaque bloc explicatif devient dépliable (un « ? » ou un titre qu'on touche), déplié à la première visite, replié ensuite — l'état mémorisé sur l'appareil. Chaque page tiendrait alors sur un écran ou deux, commandes en tête.

## Priorité 1 — ce qui compte sur le terrain

**Le hors-ligne, d'abord.** C'est le manque le plus sérieux, et personne ne le voit tant qu'on teste chez soi. Les lieux d'utilisation réels — caves, châteaux, campagne — sont précisément ceux où le réseau manque. Or le service worker est volontairement passif : il ne met rien en cache, donc **sans réseau, l'application ne s'ouvre pas du tout**. Les polices viennent de Google (7 références), le modèle de détection de personne de deux CDN. Il faut pré-mettre en cache l'enveloppe de l'application (pages, `lib/`, lexique, marque), rapatrier les polices dans le dépôt, et afficher clairement ce qui reste indisponible hors ligne (le modèle de pose ~5 Mo peut se mettre en cache après le premier chargement ; la transcription Mistral restera en ligne par nature). Un poste de terrain qui exige du réseau n'est pas un poste de terrain.

**Le geste principal sous le pouce.** « Préparer le tournage », « Lancer la veille », « Démarrer » sont à mi-page ou plus bas, dans la zone la plus difficile d'accès d'une main. Une barre d'action fixe en bas d'écran — un seul bouton, le bon selon l'état : préparer → enregistrer → arrêter — mettrait le geste vital au même endroit sur toutes les pages, là où le pouce tombe naturellement. Les boutons de capture flottants existent déjà à droite ; la barre les complèterait sans les gêner.

**Ce qui se règle ne doit pas s'oublier.** Le lieu saisi, la durée du tampon, la vitesse du mur, l'incrustation : tout est perdu à chaque fermeture (aucun `localStorage` dans la séance caméra, le mur ou l'écoute). Retaper « Château de X — salle des gardes » à chaque séance est une friction inutile ; mémoriser ces réglages est peu de code pour beaucoup de confort.

**Les boutons flottants recouvrent le bas des pages.** Sur les captures, ○ et ● passent par-dessus les boutons du tampon (séance) et le texte du bas (contact IA). Une marge basse d'environ 150 px sur le contenu des pages suffit à ce que rien ne soit jamais caché.

## Priorité 2 — la présentation

**Un parcours guidé au lancement.** Aujourd'hui il faut savoir quelle page ouvrir et quels boutons armer. Un « Démarrer une séance » sur l'accueil qui pose une seule question — *téléphone à la perche, posé face à la pièce, ou assis avec la box ?* — puis ouvre le bon mode déjà configuré (caméra + incrustation ; capteurs + caméra + mur + écran fixe ; écoute + mur + voix + séance assise) transformerait l'expérience du premier soir comme celle du centième.

**Petites incohérences visuelles relevées sur captures.** Le curseur de vitesse du mur est resté bleu système (l'`accent-color` or n'est pas posé sur cette page). Le badge « EN DÉVELOPPEMENT · V7 » de Contact IA casse le titre sur deux lignes. Le bandeau de l'écran fixe tronque les intitulés longs (« LUMINANCE CAMÉ ») — abréger proprement ou réduire la casse. Le bouton plein écran mord le coin du bandeau-titre de l'accueil. Les numéros de version (v19, v3…) sont utiles pour vérifier le cache mais parasitent les titres — les déplacer dans le tableau « cet appareil » de l'accueil, en petit.

**La bibliothèque vide met « Tout supprimer » en vedette.** Un bouton destructeur, rouge et luisant, comme seule action visible d'une page vide : il ne devrait apparaître que s'il y a quelque chose à supprimer, et « Tout envoyer vers le téléphone » de même. À terme, grouper les fichiers par séance (même soirée, mêmes lieux) plutôt qu'en liste plate.

**L'accueil peut respirer davantage.** Le bandeau-marque est réussi ; les cartes restent denses. Le résumé court en tête de carte et le détail sous filet vont dans le bon sens — on peut aller au bout : le détail repliable lui aussi, et pourquoi pas la pluie de mots du mur, très ralentie et presque éteinte, en fond du bandeau d'accueil : ce serait l'identité du produit dès la première seconde, à coût quasi nul puisque le composant existe.

## Priorité 3 — pour plus tard

L'**économie de batterie** mérite une passe : mur en canvas à 60 images/s + caméra + détection de personne, c'est le téléphone chaud en une heure de veille ; plafonner le mur à 30 i/s en veille (et ne le dessiner à pleine cadence que figé/proche du gel) prolongerait les longues séances. Un **historique des séances** dans la bibliothèque — chaque veille avec sa phrase, ses seuils, sa trace, ses fichiers — donnerait au produit sa mémoire longue. La **voix** mérite d'être partout où le mur est (elle manque en séance caméra et capteurs). Enfin l'idée déjà évoquée de la détection d'animaux (COCO-SSD) reste ouverte, et le relais Cloudflare pour Voxtral si le CORS bloque un jour.

## Ce que je ferais, dans l'ordre

| # | Chantier | Effet terrain |
|---|---|---|
| 1 | Hors-ligne : cache de l'enveloppe + polices locales | L'application s'ouvre partout, y compris là où on s'en sert vraiment |
| 2 | Textes repliables, mémorisés | Chaque page tient en 1-2 écrans, commandes en tête |
| 3 | Barre d'action fixe en bas | Le geste vital sous le pouce, identique partout |
| 4 | Réglages persistants (lieu, tampon, vitesse, incrustation) | Plus rien à retaper |
| 5 | Marge basse sous les boutons flottants + retouches visuelles | Plus aucun recouvrement, cohérence complète |
| 6 | « Démarrer une séance » guidé sur l'accueil | Un appui, le bon mode, bien configuré |

Les chantiers 2 à 5 sont petits et sans risque ; le 1 est le plus important et demande un vrai soin (un service worker de cache se teste sérieusement, un cache mal fait est pire que pas de cache) ; le 6 est le plus visible.
