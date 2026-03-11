import { useState, useEffect } from "react";

/**
 * Retourne le statut calculé d'un prêt.
 * Valeurs possibles : "en_cours" | "en_retard" | "retourné" | "perdu"
 */
export const getPretStatut = (p) => {
  if (p.statut && p.statut !== "en_cours") {
    // Normalise "retourne" sans accent → "retourné"
    if (p.statut === "retourne") return "retourné";
    return p.statut;
  }
  if (p.rendu) return "retourné";
  const ref = p.date_retour_prevue
    ? new Date(p.date_retour_prevue)
    : new Date(new Date(p.date_pret).getTime() + 30 * 24 * 60 * 60 * 1000);
  return new Date() > ref ? "en_retard" : "en_cours";
};

/**
 * Calcule le nombre de jours de retard pour un prêt.
 * Retourne 0 si le prêt n'est pas en retard.
 */
export const joursRetard = (p) => {
  const ref = p.date_retour_prevue
    ? new Date(p.date_retour_prevue)
    : new Date(new Date(p.date_pret).getTime() + 30 * 24 * 60 * 60 * 1000);
  const diff = Math.floor((new Date() - ref) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
};

/**
 * Formate une date en français (ex: "12/03/2025").
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("fr-FR");
};

/**
 * Hook debounce — retourne la valeur après le délai spécifié.
 * @param {*} value
 * @param {number} delay en ms (défaut 300)
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
