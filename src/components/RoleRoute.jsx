import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Protège une route en vérifiant le rôle de l'utilisateur connecté.
 * Si le rôle ne correspond pas, redirige vers le tableau de bord.
 */
export default function RoleRoute({ requiredRole, children }) {
  const { session } = useAuth();

  if (session?.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return children;
}
