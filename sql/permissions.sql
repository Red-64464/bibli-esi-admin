-- ============================================================
-- Permissions par compte admin
-- Applique cette migration sur votre projet Supabase
-- ============================================================

-- Ajouter la colonne permissions à la table users
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';

-- Commentaire sur la structure attendue :
-- {
--   "dashboard": true,
--   "livres_voir": true, "livres_ajouter": true, "livres_modifier": true, "livres_supprimer": true,
--   "etudiants_voir": true, "etudiants_ajouter": true, "etudiants_modifier": true, "etudiants_supprimer": true,
--   "prets_voir": true, "prets_creer": true, "prets_retourner": true,
--   "statistiques": true,
--   "notifications": true,
--   "historique": true,
--   "reservations": true,
--   "admins": false,
--   "parametres": false
-- }

-- Initialiser les permissions par défaut pour les librarians existants
UPDATE users
SET permissions = '{
  "dashboard": true,
  "livres_voir": true,
  "livres_ajouter": true,
  "livres_modifier": true,
  "livres_supprimer": true,
  "etudiants_voir": true,
  "etudiants_ajouter": true,
  "etudiants_modifier": true,
  "etudiants_supprimer": true,
  "prets_voir": true,
  "prets_creer": true,
  "prets_retourner": true,
  "statistiques": true,
  "notifications": true,
  "historique": true,
  "reservations": true,
  "admins": false,
  "parametres": false
}'::jsonb
WHERE role = 'librarian' AND (permissions IS NULL OR permissions = '{}');

-- Table reservations
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livre_id UUID NOT NULL REFERENCES livres(id) ON DELETE CASCADE,
  etudiant_id UUID NOT NULL REFERENCES etudiants(id) ON DELETE CASCADE,
  date_reservation DATE NOT NULL DEFAULT CURRENT_DATE,
  date_souhaitee DATE,
  statut TEXT NOT NULL DEFAULT 'en_attente',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_reservations_livre_id ON reservations(livre_id);
CREATE INDEX IF NOT EXISTS idx_reservations_etudiant_id ON reservations(etudiant_id);
CREATE INDEX IF NOT EXISTS idx_reservations_statut ON reservations(statut);

-- Profil étendu des administrateurs
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

-- Horaires d'ouverture et messages de fermeture
INSERT INTO settings (key, value) VALUES
  ('library_hours', '{
    "lundi":    {"ouvert":true,  "debut":"08:00","fin":"17:00"},
    "mardi":    {"ouvert":true,  "debut":"08:00","fin":"17:00"},
    "mercredi": {"ouvert":true,  "debut":"08:00","fin":"17:00"},
    "jeudi":    {"ouvert":true,  "debut":"08:00","fin":"17:00"},
    "vendredi": {"ouvert":true,  "debut":"08:00","fin":"14:00"},
    "samedi":   {"ouvert":false, "debut":"09:00","fin":"12:00"},
    "dimanche": {"ouvert":false, "debut":"",     "fin":""}
  }'),
  ('library_closed_message', ''),
  ('library_is_closed',      'false')
ON CONFLICT (key) DO NOTHING;
