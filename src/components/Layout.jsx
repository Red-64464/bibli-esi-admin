import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  ArrowLeftRight,
  Library,
  LogOut,
  Shield,
} from "lucide-react";

const navItems = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/livres", label: "Livres", icon: BookOpen },
  { to: "/etudiants", label: "Étudiants", icon: Users },
  { to: "/prets", label: "Prêts", icon: ArrowLeftRight },
];

export default function Layout({ children }) {
  const { signOut, session } = useAuth();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-biblio-card border-r border-white/10 flex flex-col fixed h-full">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
          <Library className="w-8 h-8 text-biblio-accent" />
          <span className="text-xl font-bold text-biblio-text">BiblioGest</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-biblio-accent text-white"
                    : "text-biblio-muted hover:bg-white/5 hover:text-biblio-text"
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer sidebar */}
        <div className="px-3 py-4 border-t border-white/10 space-y-1">
          {/* Admin badge */}
          {session?.user && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 mb-2">
              <Shield className="w-4 h-4 text-biblio-accent shrink-0" />
              <span className="text-xs text-biblio-muted truncate">
                {session.username}
              </span>
            </div>
          )}
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-biblio-muted hover:bg-biblio-danger/10 hover:text-biblio-danger transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Contenu principal */}
      <main className="flex-1 ml-64 p-8 overflow-auto">{children}</main>
    </div>
  );
}
