import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Library, Loader2, LogIn, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const { session, signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (session) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signIn(username.trim(), password);
    } catch (err) {
      setError(err.message || "Identifiants incorrects. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-biblio-card rounded-2xl border border-white/10 p-8 space-y-7 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 rounded-2xl bg-biblio-accent/10 border border-biblio-accent/20">
              <Library className="w-10 h-10 text-biblio-accent" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold">BiblioGest</h1>
              <p className="text-sm text-biblio-muted mt-1">
                Panneau d'administration
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-white/10" />

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-biblio-muted uppercase tracking-wider">
                Nom d'utilisateur
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="user"
                required
                autoComplete="username"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-biblio-muted uppercase tracking-wider">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 pr-12 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-biblio-muted hover:text-biblio-text transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-biblio-danger text-sm bg-biblio-danger/10 border border-biblio-danger/20 p-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="w-full py-3 bg-biblio-accent hover:bg-biblio-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <LogIn className="w-5 h-5" />
              )}
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>

          <p className="text-center text-xs text-biblio-muted">
            Accès réservé aux administrateurs
          </p>
        </div>
      </div>
    </div>
  );
}
