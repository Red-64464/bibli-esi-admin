import { supabase } from "./supabase";

/**
 * Enregistre une action dans la table activity_logs.
 * Silencieusement ignoré si Supabase est indisponible.
 *
 * @param {Object} params
 * @param {string} params.action_type  - Identifiant court (ex: "pret_cree")
 * @param {string} params.description  - Message lisible (ex: "Ilias a emprunté Percy Jackson")
 * @param {string} [params.user_info]  - Infos user optionnelles (username)
 */
export async function logActivity({
  action_type,
  description,
  user_info = "",
}) {
  try {
    await supabase
      .from("activity_logs")
      .insert([{ action_type, description, user_info }]);
  } catch {
    /* log silently fails — ne bloque jamais l'UI */
  }
}
