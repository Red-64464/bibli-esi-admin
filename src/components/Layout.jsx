import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  ArrowLeftRight,
  LogOut,
  Shield,
  Bell,
  History,
  BarChart2,
  UserCog,
  Settings,
  Menu,
  X,
} from "lucide-react";

const navGroups = [
  {
    items: [
      { to: "/", label: "Tableau de bord", icon: LayoutDashboard },
      { to: "/livres", label: "Livres", icon: BookOpen },
      { to: "/etudiants", label: "Étudiants", icon: Users },
      { to: "/prets", label: "Prêts", icon: ArrowLeftRight },
    ],
  },
  {
    items: [
      { to: "/notifications", label: "Notifications", icon: Bell },
      { to: "/historique", label: "Historique", icon: History },
      { to: "/statistiques", label: "Statistiques", icon: BarChart2 },
    ],
  },
  {
    items: [
      { to: "/admins", label: "Admins", icon: UserCog },
      { to: "/parametres", label: "Paramètres", icon: Settings },
    ],
  },
];

export default function Layout({ children }) {
  const { signOut, session } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex min-h-screen relative">
      {/* Backdrop mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed h-full z-40 w-64 bg-biblio-card border-r border-white/10 flex flex-col
          transition-transform duration-300
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="Bibl'ESI"
              className="h-9 w-auto object-contain"
            />
          </div>
          <button
            onClick={closeSidebar}
            className="lg:hidden text-biblio-muted hover:text-biblio-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && <div className="border-t border-white/10 mb-3" />}
              <div className="space-y-1">
                {group.items.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === "/"}
                    onClick={closeSidebar}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-biblio-accent text-white"
                          : "text-biblio-muted hover:bg-white/5 hover:text-biblio-text"
                      }`
                    }
                  >
                    <Icon
                      className="w-4.5 h-4.5 shrink-0"
                      style={{ width: "1.125rem", height: "1.125rem" }}
                    />
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer sidebar */}
        <div className="px-3 py-4 border-t border-white/10 space-y-1">
          {session && (
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

      {/* Zone principale */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-64">
        {/* Top bar mobile */}
        <header className="lg:hidden sticky top-0 z-20 bg-biblio-card border-b border-white/10 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-biblio-muted hover:text-biblio-text transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <img
            src="/logo.png"
            alt="Bibl'ESI"
            className="h-7 w-auto object-contain"
          />
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
