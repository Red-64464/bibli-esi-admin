import { supabase } from "./supabase";

/**
 * Calcule et crée une amende pour un prêt en retard.
 * @param {object} pret - Le prêt (doit avoir date_retour_prevue, date_pret, id, etudiant_id)
 * @param {number} tauxJournalier - Taux en DA/jour (défaut: 50)
 * @param {string} createdBy - Identité de l'admin
 * @returns {object|null} L'amende créée ou null
 */
export async function createAmende(pret, tauxJournalier = 50, createdBy = "") {
  const ref = pret.date_retour_prevue
    ? new Date(pret.date_retour_prevue)
    : new Date(new Date(pret.date_pret).getTime() + 30 * 86400000);
  const jours = Math.max(0, Math.floor((new Date() - ref) / 86400000));
  if (jours <= 0) return null;

  const montant = jours * tauxJournalier;

  const { data, error } = await supabase
    .from("amendes")
    .insert([
      {
        pret_id: pret.id,
        etudiant_id: pret.etudiant_id,
        montant,
        jours_retard: jours,
        taux_journalier: tauxJournalier,
        statut: "impayee",
        created_by: createdBy,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Marque une amende comme payée.
 */
export async function payerAmende(amendeId) {
  const { error } = await supabase
    .from("amendes")
    .update({ statut: "payee", date_paiement: new Date().toISOString() })
    .eq("id", amendeId);
  if (error) throw error;
}

/**
 * Annule une amende.
 */
export async function annulerAmende(amendeId) {
  const { error } = await supabase
    .from("amendes")
    .update({ statut: "annulee" })
    .eq("id", amendeId);
  if (error) throw error;
}

/**
 * Récupère toutes les amendes d'un étudiant.
 */
export async function getAmendesEtudiant(etudiantId) {
  const { data, error } = await supabase
    .from("amendes")
    .select("*, prets(livres(titre))")
    .eq("etudiant_id", etudiantId)
    .order("date_creation", { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Récupère le total impayé d'un étudiant.
 */
export async function getTotalImpaye(etudiantId) {
  const { data, error } = await supabase
    .from("amendes")
    .select("montant")
    .eq("etudiant_id", etudiantId)
    .eq("statut", "impayee");
  if (error) throw error;
  return (data || []).reduce((sum, a) => sum + Number(a.montant), 0);
}

/**
 * Vérifie si un étudiant est bloqué (a des amendes impayées).
 */
export async function isEtudiantBloque(etudiantId) {
  const total = await getTotalImpaye(etudiantId);
  return total > 0;
}

/**
 * Récupère toutes les amendes impayées (pour Dashboard / page globale).
 */
export async function getAllAmendesImpayees() {
  const { data, error } = await supabase
    .from("amendes")
    .select("*, etudiants(nom, prenom, email), prets(livres(titre))")
    .eq("statut", "impayee")
    .order("date_creation", { ascending: false });
  if (error) throw error;
  return data || [];
}
