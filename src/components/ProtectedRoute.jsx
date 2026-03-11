import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Loader2 } from "lucide-react";

export default function ProtectedRoute({ children }) {
  const { session } = useAuth();

  // Still loading session from Supabase
  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-biblio-accent" />
      </div>
    );
  }

  // Not authenticated → redirect to login
  if (!session) return <Navigate to="/login" replace />;

  return children;
}
