# -*- coding: utf-8 -*-
"""Génère le lexique (CSV + SQL + JSON) à partir de blocs catégorisés."""
import csv, json, os

# categorie -> (pos, mots)
BLOCS = {
 "personne": ("NOM", """homme femme enfant fille garçon bébé vieillard dame monsieur madame
  mère père frère sœur fils grand-mère grand-père famille ami amie ennemi voisin étranger
  soldat prêtre curé docteur infirmière maître maîtresse patron ouvrier fermier marin
  gardien servante nourrice veuve orphelin invité inconnu témoin"""),

 "prenom": ("PRENOM", """Marie Jean Pierre Louis Anne Jeanne Henri Paul Claude Marguerite
  Antoine Thérèse Émile Suzanne Georges Madeleine Joseph Lucie François Camille Robert
  Yvonne Albert Germaine Maurice Simone André Berthe Charles Hélène Michel Denise
  Raymond Odette Roger Renée Gustave Adèle Léon Victorine"""),

 "pronom": ("PRON", "je tu il elle nous vous ils elles on moi toi lui eux quelqu'un personne"),

 "verbe": ("VERBE", """être avoir aller venir partir rester attendre chercher trouver perdre
  voir regarder entendre écouter parler dire appeler crier chuchoter pleurer rire chanter
  dormir rêver réveiller mourir vivre naître tuer blesser aider sauver protéger cacher
  ouvrir fermer entrer sortir monter descendre passer traverser toucher prendre tenir
  laisser donner rendre oublier rappeler savoir connaître comprendre croire penser
  vouloir pouvoir devoir falloir aimer détester craindre brûler geler tomber courir
  marcher fuir arrêter continuer revenir prier mentir promettre jurer pardonner
  frapper casser creuser enterrer noyer étouffer suivre attraper"""),

 "verbe_conj": ("VERBE3", """est était sera a avait sera vient venait part reste attend
  cherche voit entend parle dit appelle crie pleure dort meurt vit aide cache ouvre
  ferme entre sort monte descend touche tient laisse oublie sait comprend veut peut
  doit aime brûle tombe court marche fuit arrête revient prie ment suit"""),

 "lieu": ("LIEU", """maison chambre cuisine salon cave grenier couloir escalier palier
  porte fenêtre mur sol plafond toit cheminée jardin cour bois forêt champ route chemin
  pont église chapelle cimetière tombe caveau hôpital asile école usine ferme grange
  puits fontaine rivière étang mer plage montagne ville village rue place gare tunnel
  mine prison caserne théâtre hôtel auberge boutique"""),

 "objet": ("NOM", """lumière lampe bougie ombre miroir horloge pendule clé serrure boîte
  coffre lettre papier photo livre cahier lit chaise table armoire tiroir couteau ciseaux
  corde chaîne clou marteau feu cendre eau sang terre pierre croix anneau bague collier
  robe manteau chapeau chaussure jouet poupée cheval chien chat oiseau cloche tableau
  fusil pistolet valise poupon berceau voile drap"""),

 "temps": ("TEMPS", """maintenant hier demain aujourd'hui toujours jamais encore bientôt
  tard tôt avant après pendant nuit jour matin midi soir minuit aube crépuscule hiver
  été printemps automne année mois semaine heure minute seconde longtemps autrefois
  souvent parfois enfin déjà"""),

 "etat": ("ADJ", """froid chaud noir blanc rouge bleu vert jaune gris seul triste heureux
  fâché fou calme perdu fatigué malade mort vivant vide plein cassé vieux jeune petit
  grand lourd léger sombre clair humide sec profond haut bas ouvert fermé caché
  dangereux gentil méchant beau laid pauvre riche"""),

 "abstrait": ("NOM", """peur douleur mal secret mensonge vérité silence bruit voix cri
  souffle âme esprit fantôme mémoire souvenir oubli rêve cauchemar espoir colère haine
  amour pitié pardon faute crime accident guerre paix fin début danger piège message
  nom âge nombre chiffre signe"""),

 "position": ("ADV", """ici là dedans dehors derrière devant dessous dessus près loin
  autour partout ailleurs gauche droite haut bas entre contre vers"""),

 "reponse": ("REPONSE", """oui non peut-être bien sûr jamais rien tout quelque chose
  personne quelqu'un beaucoup assez trop plus moins très aussi"""),

 "question": ("INTER", "qui quoi où quand pourquoi comment combien quel lequel"),

 "imperatif": ("IMPER", """écoute regarde viens reste pars va-t'en arrête attends aide-moi
  parle dis-moi montre ouvre ferme cours cache-toi réveille-toi souviens-toi laisse-moi
  suis-moi ne pars pas s'il te plaît pardon merci attention danger"""),

 "nombre": ("NOMBRE", """un deux trois quatre cinq six sept huit neuf dix onze douze
  treize quatorze quinze vingt trente quarante cinquante cent mille"""),

 "liaison": ("PREP", """et ou mais donc car si quand parce que avec sans pour contre dans
  sur sous par de à chez vers depuis jusqu'à"""),
}

rows, idx = [], 0
seen = set()
for cat, (pos, blob) in BLOCS.items():
    for mot in blob.split():
        mot = mot.strip()
        if not mot or mot in seen:
            continue
        seen.add(mot)
        # poids : les mots courts et fonctionnels sortent plus souvent
        poids = 3 if pos in ("REPONSE", "PRON", "IMPER", "ADV") else 2 if len(mot) <= 5 else 1
        rows.append({"idx": idx, "mot": mot, "pos": pos, "categorie": cat, "poids": poids})
        idx += 1

GABARITS = [
    ("{MOT}", 40, "mot seul — le mode par défaut, le moins fabriqué"),
    ("{PRON} {VERBE3}", 12, "sujet + verbe"),
    ("{PRON} {VERBE3} {LIEU}", 6, "sujet + verbe + lieu"),
    ("{IMPER}", 10, "ordre"),
    ("{NOM} {ADJ}", 8, "nom qualifié"),
    ("{INTER}", 6, "question"),
    ("{ADV}", 6, "indication de place"),
    ("{PRENOM}", 6, "nom propre"),
    ("{NOMBRE}", 4, "nombre seul"),
    ("{PRON} {VERBE3} {NOM}", 2, "phrase complète — à n'activer qu'en connaissance de cause"),
]

os.makedirs("/mnt/user-data/outputs", exist_ok=True)
O = "/mnt/user-data/outputs/"

# ---- CSV ----
with open(O + "lexique.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=["idx", "mot", "pos", "categorie", "poids"])
    w.writeheader(); w.writerows(rows)

# ---- JSON (pour l'app front) ----
with open(O + "lexique.json", "w", encoding="utf-8") as f:
    json.dump({"mots": rows, "gabarits": [
        {"gabarit": g, "poids": p, "note": n} for g, p, n in GABARITS]},
        f, ensure_ascii=False, indent=1)

# ---- SQL seed (compatible Postgres/Supabase et MySQL) ----
def esc(s): return s.replace("'", "''")
with open(O + "seed-lexique.sql", "w", encoding="utf-8") as f:
    f.write("-- Lexique français — %d mots\n" % len(rows))
    f.write("-- Compatible PostgreSQL/Supabase et MySQL 8\n\n")
    f.write("INSERT INTO lexique (idx, mot, pos, categorie, poids) VALUES\n")
    f.write(",\n".join("(%d,'%s','%s','%s',%d)" % (r["idx"], esc(r["mot"]), r["pos"],
            r["categorie"], r["poids"]) for r in rows) + ";\n\n")
    f.write("INSERT INTO gabarit (gabarit, poids, note) VALUES\n")
    f.write(",\n".join("('%s',%d,'%s')" % (esc(g), p, esc(n)) for g, p, n in GABARITS) + ";\n")

from collections import Counter
print("mots :", len(rows))
print(Counter(r["pos"] for r in rows))
print("index max :", idx - 1)
