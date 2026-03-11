-- ============================================================
-- BiblioGest – Migration v2
-- À exécuter dans l'éditeur SQL de Supabase
-- ============================================================

-- ─── LIVRES ──────────────────────────────────────────────────
ALTER TABLE livres
  ADD COLUMN IF NOT EXISTS langue         TEXT,
  ADD COLUMN IF NOT EXISTS categorie      TEXT,
  ADD COLUMN IF NOT EXISTS tags           TEXT[],
  ADD COLUMN IF NOT EXISTS resume         TEXT,
  ADD COLUMN IF NOT EXISTS description    TEXT,
  ADD COLUMN IF NOT EXISTS emplacement    TEXT,
  ADD COLUMN IF NOT EXISTS nb_exemplaires INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS statut         TEXT DEFAULT 'disponible';

-- Synchroniser statut depuis l'ancien champ booléen
UPDATE livres
SET statut = CASE WHEN disponible THEN 'disponible' ELSE 'emprunté' END
WHERE statut IS NULL;

-- ─── ÉTUDIANTS ───────────────────────────────────────────────
ALTER TABLE etudiants
  ADD COLUMN IF NOT EXISTS telephone      TEXT,
  ADD COLUMN IF NOT EXISTS photo_url      TEXT,
  ADD COLUMN IF NOT EXISTS photo_carte_url TEXT,
  ADD COLUMN IF NOT EXISTS notes_admin    TEXT,
  ADD COLUMN IF NOT EXISTS champs_custom  JSONB DEFAULT '{}';

-- ─── PRÊTS ───────────────────────────────────────────────────
ALTER TABLE prets
  ADD COLUMN IF NOT EXISTS date_retour_prevue DATE,
  ADD COLUMN IF NOT EXISTS date_rappel        DATE,
  ADD COLUMN IF NOT EXISTS notes              TEXT,
  ADD COLUMN IF NOT EXISTS statut             TEXT DEFAULT 'en_cours';

-- Synchroniser statut depuis l'ancien champ booléen
UPDATE prets
SET statut = CASE WHEN rendu THEN 'retourné' ELSE 'en_cours' END
WHERE statut IS NULL;

-- ─── AUTHENTIFICATION PERSONNALISÉE ─────────────────────────
-- Activer l'extension pgcrypto (nécessaire pour crypt/gen_salt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Table des utilisateurs admin
CREATE TABLE IF NOT EXISTS users (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT DEFAULT 'admin',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security : autoriser uniquement la lecture (pour la vérification côté client)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_select_users" ON users;
CREATE POLICY "allow_select_users" ON users FOR SELECT USING (true);

-- Compte admin par défaut
-- username : adminCE  |  mot de passe : CE151029
INSERT INTO users (username, password_hash, role)
VALUES (
  'adminCE',
  crypt('CE151029', gen_salt('bf', 10)),
  'admin'
)
ON CONFLICT (username) DO NOTHING;
