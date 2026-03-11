-- =============================================
-- BiblioGest v2 — Migration SQL
-- À exécuter dans Supabase SQL Editor
-- =============================================

-- 1. TABLE activity_logs
-- Stocke toutes les actions importantes du système
CREATE TABLE IF NOT EXISTS activity_logs (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type TEXT        NOT NULL,  -- pret_cree, pret_retourne, livre_ajoute, etudiant_cree, ...
  description TEXT        NOT NULL,
  user_info   TEXT        DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS : admins ont accès total
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activity_logs_admin_all" ON activity_logs;
CREATE POLICY "activity_logs_admin_all" ON activity_logs FOR ALL USING (true);


-- 2. TABLE settings
-- Paramètres de configuration de la bibliothèque (clé/valeur)
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_admin_all" ON settings;
CREATE POLICY "settings_admin_all" ON settings FOR ALL USING (true);

-- Valeurs par défaut
INSERT INTO settings (key, value) VALUES
  ('library_name',          'BiblioGest'),
  ('library_email',         ''),
  ('library_logo_url',      ''),
  ('default_loan_days',     '14'),
  ('max_books_per_student', '3'),
  ('send_reminder_emails',  'false'),
  ('reminder_days_before',  '3'),
  ('remind_on_due_date',    'true'),
  ('notify_overdue',        'true')
ON CONFLICT (key) DO NOTHING;


-- 3. Extension colonne users (si non-existantes)
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login   TIMESTAMPTZ;


-- 4. Vues utiles (optionnel — aide pour les stats)

-- Vue : prêts enrichis
CREATE OR REPLACE VIEW prets_enrichis AS
SELECT
  p.*,
  l.titre      AS livre_titre,
  l.isbn       AS livre_isbn,
  l.categorie  AS livre_categorie,
  e.nom        AS etudiant_nom,
  e.prenom     AS etudiant_prenom,
  e.email      AS etudiant_email
FROM prets p
JOIN livres    l ON l.id = p.livre_id
JOIN etudiants e ON e.id = p.etudiant_id;
