-- =============================================
-- Migration: Système d'amendes (fines system)
-- =============================================

-- Table des amendes
CREATE TABLE IF NOT EXISTS amendes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pret_id UUID REFERENCES prets(id) ON DELETE CASCADE,
  etudiant_id UUID REFERENCES etudiants(id) ON DELETE CASCADE,
  montant NUMERIC(10, 2) NOT NULL DEFAULT 0,
  jours_retard INTEGER NOT NULL DEFAULT 0,
  taux_journalier NUMERIC(10, 2) NOT NULL DEFAULT 50,
  statut TEXT NOT NULL DEFAULT 'impayee' CHECK (statut IN ('impayee', 'payee', 'annulee')),
  date_creation TIMESTAMPTZ DEFAULT now(),
  date_paiement TIMESTAMPTZ,
  note TEXT,
  created_by TEXT
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_amendes_etudiant ON amendes(etudiant_id);
CREATE INDEX IF NOT EXISTS idx_amendes_pret ON amendes(pret_id);
CREATE INDEX IF NOT EXISTS idx_amendes_statut ON amendes(statut);

-- Paramètre du taux d'amende journalier (DA/jour)
INSERT INTO settings (key, value)
VALUES ('fine_rate_per_day', '50')
ON CONFLICT (key) DO NOTHING;

-- Paramètre: activer/désactiver le blocage des emprunteurs en retard
INSERT INTO settings (key, value)
VALUES ('block_overdue_borrowers', 'true')
ON CONFLICT (key) DO NOTHING;

-- Vue pour les amendes impayées par étudiant
CREATE OR REPLACE VIEW v_amendes_etudiant AS
SELECT
  e.id AS etudiant_id,
  e.nom,
  e.prenom,
  e.email,
  COUNT(a.id) FILTER (WHERE a.statut = 'impayee') AS nb_amendes_impayees,
  COALESCE(SUM(a.montant) FILTER (WHERE a.statut = 'impayee'), 0) AS total_impaye,
  COALESCE(SUM(a.montant) FILTER (WHERE a.statut = 'payee'), 0) AS total_paye
FROM etudiants e
LEFT JOIN amendes a ON a.etudiant_id = e.id
GROUP BY e.id, e.nom, e.prenom, e.email;
