import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePermissions } from "../contexts/PermissionsContext";
import { supabase } from "../lib/supabase";
import { getPretStatut } from "../lib/utils";
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
  Search,
  BookMarked,
  Calendar,
} from "lucide-react";

const BASE_NAV_GROUPS = [
  {
    items: [
      { to: "/", label: "Tableau de bord", icon: LayoutDashboard, perm: "dashboard" },
      { to: "/livres", label: "Livres", icon: BookOpen, perm: "livres_voir" },
      { to: "/etudiants", label: "Étudiants", icon: Users, perm: "etudiants_voir" },
      { to: "/prets", label: "Prêts", icon: ArrowLeftRight, perm: "prets_voir" },
      { to: "/reservations", label: "Réservations", icon: BookMarked, perm: "reservations" },
      { to: "/calendrier", label: "Calendrier", icon: Calendar, perm: "dashboard" },
    ],
  },
  {
    items: [
      { to: "/notifications", label: "Notifications", icon: Bell, perm: "notifications" },
      { to: "/historique", label: "Historique", icon: History, perm: "historique" },
      { to: "/statistiques", label: "Statistiques", icon: BarChart2, perm: "statistiques" },
    ],
  },
];

const SUPER_ADMIN_GROUP = {
  items: [
    { to: "/admins", label: "Admins", icon: UserCog, perm: "admins" },
    { to: "/parametres", label: "Paramètres", icon: Settings, perm: "parametres" },
  ],
};

const ROLE_LABELS = {
  super_admin: "Super Admin",
  librarian: "Bibliothécaire",
};

export default function Layout({ children }) {
  const { signOut, session } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [overdueCount, setOverdueCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const [overdueList, setOverdueList] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  const isSuperAdmin = session?.role === "super_admin";
  const navGroups = isSuperAdmin
    ? [...BASE_NAV_GROUPS, SUPER_ADMIN_GROUP]
    : BASE_NAV_GROUPS;
  const closeSidebar = () => setSidebarOpen(false);

  // Charger le nombre de prêts en retard pour la cloche
  useEffect(() => {
    const fetchOverdue = async () => {
      try {
        const { data } = await supabase
          .from("prets")
          .select("id, statut, rendu, date_pret, date_retour_prevue, livres(titre), etudiants(nom, prenom)")
          .eq("rendu", false);
        if (data) {
          const overdue = data.filter((p) => getPretStatut(p) === "en_retard");
          setOverdueCount(overdue.length);
          setOverdueList(overdue.slice(0, 5));
        }
      } catch {
        // silencieux
      }
    };
    fetchOverdue();
    const interval = setInterval(fetchOverdue, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/recherche?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    }
  };

  return (
    <div className="flex min-h-screen relative">
      {/* Backdrop mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Fermer dropdown cloche si clic ailleurs */}
      {bellOpen && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setBellOpen(false)}
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
          {navGroups.map((group, gi) => {
            const visibleItems = group.items.filter(({ perm }) =>
              perm ? can(perm) : true
            );
            if (visibleItems.length === 0) return null;
            return (
              <div key={gi}>
                {gi > 0 && <div className="border-t border-white/10 mb-3" />}
                <div className="space-y-1">
                  {visibleItems.map(({ to, label, icon: Icon }) => (
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
            );
          })}
        </nav>

        {/* Footer sidebar */}
        <div className="px-3 py-4 border-t border-white/10 space-y-1">
          {session && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 mb-2">
              <Shield className="w-4 h-4 text-biblio-accent shrink-0" />
              <div className="min-w-0">
                <span className="text-xs text-biblio-text truncate block">
                  {session.username}
                </span>
                <span className="text-xs text-biblio-muted">
                  {ROLE_LABELS[session.role] ?? session.role}
                </span>
              </div>
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
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-biblio-card border-b border-white/10 px-4 py-3 flex items-center gap-3">
          {/* Burger mobile */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-biblio-muted hover:text-biblio-text transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <img
            src="/logo.png"
            alt="Bibl'ESI"
            className="h-7 w-auto object-contain lg:hidden"
          />

          {/* Barre de recherche */}
          <form onSubmit={handleSearch} className="hidden sm:flex flex-1 max-w-xs ml-auto lg:ml-0">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-biblio-muted pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Recherche globale… (Ctrl+K)"
                className="w-full pl-9 pr-4 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent"
              />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-2">
            {/* Cloche notifications */}
            <div className="relative">
              <button
                onClick={() => setBellOpen((v) => !v)}
                className="relative p-2 rounded-lg text-biblio-muted hover:text-biblio-text hover:bg-white/10 transition-colors"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {overdueCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-biblio-danger text-white text-[10px] font-bold px-1">
                    {overdueCount > 9 ? "9+" : overdueCount}
                  </span>
                )}
              </button>

              {/* Dropdown */}
              {bellOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-biblio-card border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                    <span className="text-sm font-semibold text-biblio-text">
                      Alertes
                    </span>
                    {overdueCount > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-biblio-danger/20 text-biblio-danger font-medium">
                        {overdueCount} en retard
                      </span>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {overdueList.length === 0 ? (
                      <p className="text-xs text-biblio-muted text-center py-4">
                        Aucun retard en cours 🎉
                      </p>
                    ) : (
                      overdueList.map((p) => (
                        <div
                          key={p.id}
                          className="px-4 py-2.5 border-b border-white/5 last:border-0 hover:bg-white/5"
                        >
                          <p className="text-xs font-medium text-biblio-text line-clamp-1">
                            {p.livres?.titre || "—"}
                          </p>
                          <p className="text-xs text-biblio-muted">
                            {p.etudiants
                              ? `${p.etudiants.prenom} ${p.etudiants.nom}`
                              : "—"}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                  {overdueCount > 0 && (
                    <div className="px-4 py-2.5 border-t border-white/10">
                      <NavLink
                        to="/prets"
                        onClick={() => setBellOpen(false)}
                        className="text-xs text-biblio-accent hover:underline"
                      >
                        Voir tous les retards →
                      </NavLink>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
