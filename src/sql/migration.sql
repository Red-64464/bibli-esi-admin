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

-- ─── AUTHENTIFICATION ────────────────────────────────────────
-- Les comptes admin sont créés depuis :
--   Supabase Dashboard → Authentication → Users → Invite user
-- Aucune table supplémentaire requise.
