-- ══════════════════════════════════════════════════════════════
--  Poste de terrain — schéma PostgreSQL / Supabase
--  Ordre d'exécution : ce fichier, puis seed-capteurs.sql, puis seed-lexique.sql
-- ══════════════════════════════════════════════════════════════

-- ─── 1. LEXIQUE ───────────────────────────────────────────────
create table if not exists lexique (
  id         bigserial primary key,
  idx        integer not null unique,          -- index visé par les capteurs (0..N-1)
  mot        text    not null,
  pos        text    not null,                 -- NOM VERBE VERBE3 ADJ ADV LIEU TEMPS
                                               -- PRON PRENOM NOMBRE REPONSE IMPER INTER PREP
  categorie  text    not null,
  poids      smallint not null default 1,      -- 1..3, fréquence de tirage
  actif      boolean not null default true,
  langue     text    not null default 'fr',
  cree_le    timestamptz not null default now()
);
create index if not exists lexique_pos_idx  on lexique (pos) where actif;
create index if not exists lexique_cat_idx  on lexique (categorie);

-- ─── 2. GABARITS DE PHRASE ────────────────────────────────────
create table if not exists gabarit (
  id       bigserial primary key,
  gabarit  text     not null,   -- ex. '{PRON} {VERBE3} {LIEU}'  ·  {MOT} = n'importe lequel
  poids    smallint not null default 1,
  note     text,
  actif    boolean  not null default true
);

-- ─── 3. CAPTEURS ──────────────────────────────────────────────
create table if not exists capteur (
  id          bigserial primary key,
  code        text not null unique,   -- 'magnetometre', 'accel', 'lumiere', 'audio_rms'…
  libelle     text not null,
  unite       text,
  plateforme  text not null,          -- 'web' | 'android' | 'ios' | 'natif'
  api         text,                   -- nom de l'API utilisée
  dispo_ios   boolean not null default false,
  dispo_android boolean not null default false,
  bruit_typique text,                 -- ce qui le fait bouger sans rien de mystérieux
  notes       text
);

-- ─── 4. MAPPINGS capteur → index du lexique ───────────────────
-- Un mapping décrit COMMENT une valeur devient un mot. Tout est explicite
-- et versionné : c'est ce qui rend une session vérifiable après coup.
create table if not exists mapping (
  id          bigserial primary key,
  nom         text not null,
  capteur_id  bigint not null references capteur(id) on delete cascade,
  mode        text not null default 'delta',
     -- 'direct' : index = plancher(norm * N)
     -- 'delta'  : n'émet que si |Δ| dépasse seuil ; index = f(Δ)
     -- 'hash'   : combine plusieurs capteurs (voir mapping_source)
     -- 'temoin' : ignore le capteur, tire au sort avec graine fixe — mode de contrôle
  plage_min   double precision not null default 0,
  plage_max   double precision not null default 100,
  seuil_delta double precision default 1.5,
  pos_filtre  text,                    -- limiter à une classe de mots (ou null)
  cadence_ms  integer not null default 1200,   -- intervalle minimum entre deux mots
  actif       boolean not null default true
);
create table if not exists mapping_source (   -- pour le mode 'hash'
  mapping_id bigint not null references mapping(id) on delete cascade,
  capteur_id bigint not null references capteur(id) on delete cascade,
  coefficient double precision not null default 1,
  primary key (mapping_id, capteur_id)
);

-- ─── 5. SESSIONS ──────────────────────────────────────────────
create table if not exists session (
  id          bigserial primary key,
  uid         uuid default gen_random_uuid(),
  debut       timestamptz not null default now(),
  fin         timestamptz,
  lieu        text,
  materiel    text,                    -- modèle de ghost box, vitesse de balayage
  meteo       text,
  temoins     text,
  mode_aveugle boolean not null default false,  -- l'écran cache le mot jusqu'à la relecture
  mapping_id  bigint references mapping(id),
  notes       text
);

-- ─── 6. RELEVÉS BRUTS ─────────────────────────────────────────
-- Une ligne par lecture de capteur. Volumineux : penser au partitionnement
-- par session si tu dépasses quelques millions de lignes.
create table if not exists releve (
  id          bigserial primary key,
  session_id  bigint not null references session(id) on delete cascade,
  capteur_id  bigint not null references capteur(id),
  t_ms        integer not null,        -- ms depuis le début de la session
  valeur      double precision not null,
  valeur_norm double precision         -- 0..1 après normalisation
);
create index if not exists releve_session_idx on releve (session_id, t_ms);

-- ─── 7. MOTS ÉMIS — la table qui rend tout auditable ──────────
create table if not exists emission (
  id           bigserial primary key,
  session_id   bigint not null references session(id) on delete cascade,
  t_ms         integer not null,
  lexique_id   bigint references lexique(id),
  gabarit_id   bigint references gabarit(id),
  texte        text not null,           -- ce qui a été affiché/prononcé
  mapping_id   bigint references mapping(id),
  capteur_id   bigint references capteur(id),
  valeur_brute double precision,        -- la valeur exacte qui a produit ce mot
  index_calcule integer,                -- l'index obtenu avant lecture du lexique
  est_temoin   boolean not null default false,  -- issu du mode contrôle
  retenu       boolean,                 -- verdict de l'enquêteur en relecture
  commentaire  text
);
create index if not exists emission_session_idx on emission (session_id, t_ms);

-- ─── 8. REPÈRES AUDIO (relie l'app d'enregistrement à la base) ─
create table if not exists repere (
  id          bigserial primary key,
  session_id  bigint not null references session(id) on delete cascade,
  t_ms        integer not null,
  origine     text not null,            -- 'manuel' | 'pic_auto'
  db_pic      real,
  debut_ms    integer, fin_ms integer,  -- bornes après rognage
  transcription text,                   -- ce que l'enquêteur dit entendre
  verdict     text,                     -- 'garde' | 'ecarte' | null
  fichier_url text
);

-- ─── 9. VUE DE CONTRÔLE ───────────────────────────────────────
-- Compare la répartition des mots en mode réel et en mode témoin.
-- Si les deux se ressemblent, le capteur n'apporte rien : c'est le test
-- le plus utile que tu puisses faire sur ton propre montage.
create or replace view v_controle as
select s.id as session_id, e.est_temoin, l.pos,
       count(*) as n,
       round(100.0 * count(*) / sum(count(*)) over (partition by s.id, e.est_temoin), 1) as pct
from emission e
join session s on s.id = e.session_id
left join lexique l on l.id = e.lexique_id
group by s.id, e.est_temoin, l.pos;

-- ─── 10. Supabase : sécurité par utilisateur (optionnel) ──────
-- alter table session enable row level security;
-- alter table session add column proprietaire uuid default auth.uid();
-- create policy "session perso" on session for all using (proprietaire = auth.uid());
