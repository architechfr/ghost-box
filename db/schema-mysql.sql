-- ══════════════════════════════════════════════════════════════
--  Poste de terrain — variante MySQL 8
--  Mêmes tables que schema-postgres.sql. Les fichiers seed-*.sql
--  fonctionnent tels quels sur les deux moteurs.
-- ══════════════════════════════════════════════════════════════
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS lexique (
  id        BIGINT AUTO_INCREMENT PRIMARY KEY,
  idx       INT NOT NULL UNIQUE,
  mot       VARCHAR(64) NOT NULL,
  pos       VARCHAR(12) NOT NULL,
  categorie VARCHAR(32) NOT NULL,
  poids     TINYINT NOT NULL DEFAULT 1,
  actif     BOOLEAN NOT NULL DEFAULT TRUE,
  langue    VARCHAR(8) NOT NULL DEFAULT 'fr',
  cree_le   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (pos), INDEX (categorie)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gabarit (
  id      BIGINT AUTO_INCREMENT PRIMARY KEY,
  gabarit VARCHAR(128) NOT NULL,
  poids   TINYINT NOT NULL DEFAULT 1,
  note    VARCHAR(255),
  actif   BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS capteur (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(32) NOT NULL UNIQUE,
  libelle       VARCHAR(64) NOT NULL,
  unite         VARCHAR(16),
  plateforme    VARCHAR(16) NOT NULL,
  api           VARCHAR(96),
  dispo_ios     BOOLEAN NOT NULL DEFAULT FALSE,
  dispo_android BOOLEAN NOT NULL DEFAULT FALSE,
  bruit_typique TEXT,
  notes         TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mapping (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  nom         VARCHAR(96) NOT NULL,
  capteur_id  BIGINT NOT NULL,
  mode        VARCHAR(12) NOT NULL DEFAULT 'delta',
  plage_min   DOUBLE NOT NULL DEFAULT 0,
  plage_max   DOUBLE NOT NULL DEFAULT 100,
  seuil_delta DOUBLE DEFAULT 1.5,
  pos_filtre  VARCHAR(12),
  cadence_ms  INT NOT NULL DEFAULT 1200,
  actif       BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (capteur_id) REFERENCES capteur(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mapping_source (
  mapping_id  BIGINT NOT NULL,
  capteur_id  BIGINT NOT NULL,
  coefficient DOUBLE NOT NULL DEFAULT 1,
  PRIMARY KEY (mapping_id, capteur_id),
  FOREIGN KEY (mapping_id) REFERENCES mapping(id) ON DELETE CASCADE,
  FOREIGN KEY (capteur_id) REFERENCES capteur(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS session (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  debut        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fin          TIMESTAMP NULL,
  lieu         VARCHAR(160),
  materiel     VARCHAR(160),
  meteo        VARCHAR(96),
  temoins      VARCHAR(255),
  mode_aveugle BOOLEAN NOT NULL DEFAULT FALSE,
  mapping_id   BIGINT,
  notes        TEXT,
  FOREIGN KEY (mapping_id) REFERENCES mapping(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS releve (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id  BIGINT NOT NULL,
  capteur_id  BIGINT NOT NULL,
  t_ms        INT NOT NULL,
  valeur      DOUBLE NOT NULL,
  valeur_norm DOUBLE,
  INDEX (session_id, t_ms),
  FOREIGN KEY (session_id) REFERENCES session(id) ON DELETE CASCADE,
  FOREIGN KEY (capteur_id) REFERENCES capteur(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS emission (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id    BIGINT NOT NULL,
  t_ms          INT NOT NULL,
  lexique_id    BIGINT, gabarit_id BIGINT,
  texte         VARCHAR(255) NOT NULL,
  mapping_id    BIGINT, capteur_id BIGINT,
  valeur_brute  DOUBLE,
  index_calcule INT,
  est_temoin    BOOLEAN NOT NULL DEFAULT FALSE,
  retenu        BOOLEAN NULL,
  commentaire   TEXT,
  INDEX (session_id, t_ms),
  FOREIGN KEY (session_id) REFERENCES session(id) ON DELETE CASCADE,
  FOREIGN KEY (lexique_id) REFERENCES lexique(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS repere (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id    BIGINT NOT NULL,
  t_ms          INT NOT NULL,
  origine       VARCHAR(16) NOT NULL,
  db_pic        FLOAT,
  debut_ms      INT, fin_ms INT,
  transcription TEXT,
  verdict       VARCHAR(12),
  fichier_url   VARCHAR(512),
  INDEX (session_id, t_ms),
  FOREIGN KEY (session_id) REFERENCES session(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE OR REPLACE VIEW v_controle AS
SELECT e.session_id, e.est_temoin, l.pos, COUNT(*) AS n
FROM emission e LEFT JOIN lexique l ON l.id = e.lexique_id
GROUP BY e.session_id, e.est_temoin, l.pos;
