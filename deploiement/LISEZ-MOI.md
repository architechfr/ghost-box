# Deploiement du site

Le depot est **prive**. GitHub Pages n'existe pas pour un depot prive sur
l'offre gratuite : au passage en prive, le site a ete **depublie** et
`https://architechfr.github.io/ghost-box/` a repondu 404 sur toutes les pages.

## Cloudflare Pages

Le site est servi par Cloudflare Pages, qui construit depuis un depot prive et
sert un site public.

| Reglage | Valeur |
|---|---|
| Nom du projet | `ghost-box` |
| Branche de production | `main` |
| Prereglage de framework | aucun |
| Commande de construction | `node deploiement/preparer-cf.js` |
| Repertoire de sortie | `dist` (lu depuis `wrangler.toml`) |
| Repertoire racine | racine du depot |

Adresse : `https://ghost-box.pages.dev/ghost-box/`

## Le prefixe /ghost-box/, et pourquoi il reste

Les chemins absolus `/ghost-box/...` sont ecrits en dur dans le site, `RACINE`
de `sw.js` et le `scope` du manifest en font partie. `preparer-cf.js` recopie
donc le site dans `dist/ghost-box/` et pose une page de renvoi a la racine :
**aucune ligne du site n'est modifiee**, et la version Android
(`android-app/scripts/preparer.js`) applique exactement le meme principe.

`dist/` n'est pas versionne. Le depot reste la seule source de verite, et la
discipline `VERSION` + `?v=N` de `sw.js` continue de valoir.

## Ce qui ne suit pas le demenagement

`indexedDB` est attachee a l'origine. La bibliotheque enregistree sur
`architechfr.github.io` (seances, videos, photos, fiches) **n'est pas visible**
depuis `ghost-box.pages.dev`. Rien n'est detruit : les donnees restent sur
l'ancienne origine tant qu'elles ne sont pas effacees. Exporter avant de
basculer, et ne pas effacer les donnees du site github.io tant que l'export
n'est pas verifie.

Un nom de domaine propre branche sur le projet Cloudflare eviterait un second
changement d'origine.
