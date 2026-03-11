-- =============================================
-- Bibl'ESI v3 — Migration SQL
-- À exécuter dans Supabase SQL Editor
-- =============================================

-- Nouveaux paramètres : coordonnées, horaires, pénalités, renouvellements
INSERT INTO settings (key, value) VALUES
  ('library_phone',     ''),
  ('library_address',   ''),
  ('library_hours',     ''),
  ('academic_year',     ''),
  ('fine_per_day',      '0'),
  ('fine_currency',     'DA'),
  ('allow_renewals',    'false'),
  ('renewal_days',      '7')
ON CONFLICT (key) DO NOTHING;

-- Colonne notes sur prets (sécurise la compatibilité si la colonne est absente sur certaines instances)
ALTER TABLE prets ADD COLUMN IF NOT EXISTS notes TEXT;
