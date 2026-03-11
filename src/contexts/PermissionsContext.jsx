import { createContext, useContext } from "react";
import { useAuth } from "./AuthContext";

const PermissionsContext = createContext(null);

/**
 * Liste de toutes les permissions disponibles avec leurs valeurs par défaut.
 * Super admin : toutes à true. Librarian : selon colonne permissions JSONB.
 */
export const ALL_PERMISSIONS = {
  dashboard: true,
  livres_voir: true,
  livres_ajouter: true,
  livres_modifier: true,
  livres_supprimer: true,
  etudiants_voir: true,
  etudiants_ajouter: true,
  etudiants_modifier: true,
  etudiants_supprimer: true,
  prets_voir: true,
  prets_creer: true,
  prets_retourner: true,
  statistiques: true,
  notifications: true,
  historique: true,
  reservations: true,
  admins: false,
  parametres: false,
};

export function PermissionsProvider({ children }) {
  const { session } = useAuth();

  /**
   * Vérifie si l'utilisateur courant possède la permission donnée.
   * Super admin → toujours true.
   * Librarian → lit session.permissions (JSONB).
   */
  const can = (permission) => {
    if (!session) return false;
    if (session.role === "super_admin") return true;
    // Librarian : vérifier les permissions stockées
    const perms = session.permissions || {};
    if (permission in perms) return Boolean(perms[permission]);
    // Fallback : valeur par défaut du schéma
    return ALL_PERMISSIONS[permission] ?? false;
  };

  return (
    <PermissionsContext.Provider value={{ can }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export const usePermissions = () => {
  const ctx = useContext(PermissionsContext);
  if (!ctx)
    throw new Error("usePermissions must be used inside <PermissionsProvider>");
  return ctx;
};
