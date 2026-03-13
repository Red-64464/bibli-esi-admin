import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { exportCSV as exportToCSV } from "../lib/exports";
import {
  History,
  Search,
  Filter,
  Loader2,
  AlertCircle,
  RefreshCw,
  BookOpen,
  BookCheck,
  BookX,
  UserPlus,
  UserMinus,
  Settings,
  ArrowLeftRight,
  Shield,
  Pencil,
  Download,
  CalendarDays,
  User,
  TrendingUp,
  MoreHorizontal,
  X,
} from "lucide-react";

const ACTION_CONFIG = {
  pret_cree: {
    label: "Prêt créé",
    icon: ArrowLeftRight,
    color: "text-biblio-accent bg-biblio-accent/10",
  },
  pret_retourne: {
    label: "Livre retourné",
    icon: BookCheck,
    color: "text-biblio-success bg-biblio-success/10",
  },
  livre_ajoute: {
    label: "Livre ajouté",
    icon: BookOpen,
    color: "text-biblio-accent bg-biblio-accent/10",
  },
  livre_modifie: {
    label: "Livre modifié",
    icon: Pencil,
    color: "text-biblio-warning bg-biblio-warning/10",
  },
  livre_supprime: {
    label: "Livre supprimé",
    icon: BookX,
    color: "text-biblio-danger bg-biblio-danger/10",
  },
  etudiant_cree: {
    label: "Étudiant créé",
    icon: UserPlus,
    color: "text-biblio-accent bg-biblio-accent/10",
  },
  etudiant_modifie: {
    label: "Étudiant modifié",
    icon: Pencil,
    color: "text-biblio-warning bg-biblio-warning/10",
  },
  etudiant_supprime: {
    label: "Étudiant supprimé",
    icon: UserMinus,
    color: "text-biblio-danger bg-biblio-danger/10",
  },
  admin_cree: {
    label: "Admin créé",
    icon: Shield,
    color: "text-biblio-accent bg-biblio-accent/10",
  },
  admin_supprime: {
    label: "Admin supprimé",
    icon: Shield,
    color: "text-biblio-danger bg-biblio-danger/10",
  },
  settings_modifie: {
    label: "Paramètres modifiés",
    icon: Settings,
    color: "text-biblio-muted bg-white/5",
  },
};

const ALL_FILTER = "tous";
const PAGE_SIZE = 30;

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  if (hrs < 24) return `il y a ${hrs}h`;
  if (days === 1) return "hier";
  if (days < 30) return `il y a ${days} j`;
  return new Date(dateStr).toLocaleDateString("fr-FR");
}

export default function Historique() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(ALL_FILTER);
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [statsToday, setStatsToday] = useState(null);
  const [statsWeek, setStatsWeek] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  const buildQuery = useCallback(
    (base) => {
      let q = base;
      if (filter !== ALL_FILTER) q = q.eq("action_type", filter);
      if (search.trim()) q = q.ilike("description", `%${search.trim()}%`);
      if (dateDebut) q = q.gte("created_at", dateDebut);
      if (dateFin) {
        // Use start of next day (exclusive) to include all records on dateFin regardless of time
        const nextDay = new Date(dateFin);
        nextDay.setDate(nextDay.getDate() + 1);
        q = q.lt("created_at", nextDay.toISOString().slice(0, 10));
      }
      if (userFilter) q = q.eq("user_info", userFilter);
      return q;
    },
    [filter, search, dateDebut, dateFin, userFilter],
  );

  const fetchLogs = useCallback(
    async (pageNum, append = false) => {
      try {
        if (!append) setLoading(true);
        const from = pageNum * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const base = supabase
          .from("activity_logs")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(from, to);

        const { data, error: err, count } = await buildQuery(base);
        if (err) throw err;

        if (append) {
          setLogs((prev) => [...prev, ...(data || [])]);
        } else {
          setLogs(data || []);
        }
        setHasMore(from + PAGE_SIZE < (count || 0));
      } catch (err) {
        setError("Impossible de charger l'historique : " + err.message);
      } finally {
        setLoading(false);
      }
    },
    [buildQuery],
  );

  const loadStats = useCallback(async () => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 6);
      const weekStartStr = weekStart.toISOString().slice(0, 10);

      const [{ count: todayCount }, { count: weekCount }] = await Promise.all([
        supabase
          .from("activity_logs")
          .select("id", { count: "exact", head: true })
          .gte("created_at", todayStr),
        supabase
          .from("activity_logs")
          .select("id", { count: "exact", head: true })
          .gte("created_at", weekStartStr),
      ]);

      setStatsToday(todayCount ?? 0);
      setStatsWeek(weekCount ?? 0);
    } catch {
      /* stats are non-critical */
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("users")
        .select("username")
        .order("username", { ascending: true });
      setUsers((data || []).map((u) => u.username));
    } catch {
      /* non-critical */
    }
  }, []);

  const exportCSV = async () => {
    try {
      setExporting(true);
      const base = supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false });

      const { data, error: err } = await buildQuery(base);
      if (err) throw err;

      const rows = (data || []).map((r) => ({
        Date: new Date(r.created_at).toLocaleString("fr-FR"),
        Action: r.action_type,
        Description: r.description || "",
        Utilisateur: r.user_info || "",
      }));

      exportToCSV(rows, `historique-${new Date().toISOString().slice(0, 10)}`);
    } catch (err) {
      setError("Erreur lors de l'export : " + err.message);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadStats();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPage(0);
    fetchLogs(0);
  }, [filter, search, dateDebut, dateFin, userFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchLogs(next, true);
  };

  const filterOptions = [
    { key: ALL_FILTER, label: "Toutes" },
    { key: "pret_cree", label: "Prêts" },
    { key: "pret_retourne", label: "Retours" },
    { key: "livre_ajoute", label: "Livres" },
    { key: "etudiant_cree", label: "Étudiants" },
    { key: "settings_modifie", label: "Paramètres" },
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <History className="w-7 h-7 text-biblio-accent" />
            Historique
          </h1>
          <p className="text-biblio-muted mt-1 text-sm">
            Journal de toutes les actions du système.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-sm text-biblio-text rounded-lg transition-colors disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Exporter CSV
          </button>
          <button
            onClick={() => {
              loadStats();
              fetchLogs(0);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-sm text-biblio-text rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
        </div>
      </div>

      {/* Statistiques rapides */}
      {(statsToday !== null || statsWeek !== null) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-biblio-card border border-white/10 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2 bg-biblio-accent/10 rounded-lg">
              <TrendingUp className="w-4 h-4 text-biblio-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold text-biblio-text">
                {statsToday ?? "—"}
              </p>
              <p className="text-xs text-biblio-muted">actions aujourd'hui</p>
            </div>
          </div>
          <div className="bg-biblio-card border border-white/10 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2 bg-biblio-accent/10 rounded-lg">
              <CalendarDays className="w-4 h-4 text-biblio-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold text-biblio-text">
                {statsWeek ?? "—"}
              </p>
              <p className="text-xs text-biblio-muted">cette semaine</p>
            </div>
          </div>
        </div>
      )}

      {/* Barre de recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-biblio-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher dans l'historique…"
          className="w-full bg-biblio-card border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent"
        />
      </div>

      {/* Filtres dates + utilisateur */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-biblio-muted shrink-0" />
          <input
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            title="Date de début"
            className="bg-biblio-card border border-white/10 rounded-lg px-3 py-2 text-sm text-biblio-text focus:outline-none focus:ring-2 focus:ring-biblio-accent"
          />
          <span className="text-biblio-muted text-xs">→</span>
          <input
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            title="Date de fin"
            className="bg-biblio-card border border-white/10 rounded-lg px-3 py-2 text-sm text-biblio-text focus:outline-none focus:ring-2 focus:ring-biblio-accent"
          />
          {(dateDebut || dateFin) && (
            <button
              onClick={() => {
                setDateDebut("");
                setDateFin("");
              }}
              className="text-xs text-biblio-muted hover:text-biblio-danger transition-colors"
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-biblio-muted shrink-0" />
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="bg-biblio-card border border-white/10 rounded-lg px-3 py-2 text-sm text-biblio-text focus:outline-none focus:ring-2 focus:ring-biblio-accent"
          >
            <option value="">Tous les utilisateurs</option>
            {users.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-biblio-muted self-center shrink-0" />
        {filterOptions.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === key
                ? "bg-biblio-accent text-white"
                : "bg-white/5 text-biblio-muted hover:bg-white/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-biblio-danger/10 text-biblio-danger p-4 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-biblio-accent" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-biblio-muted">
          <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Aucune entrée dans l'historique.</p>
          {(filter !== ALL_FILTER || dateDebut || dateFin || userFilter) && (
            <button
              onClick={() => {
                setFilter(ALL_FILTER);
                setDateDebut("");
                setDateFin("");
                setUserFilter("");
              }}
              className="mt-2 text-sm text-biblio-accent hover:underline"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          {logs.map((log, idx) => {
            const conf =
              ACTION_CONFIG[log.action_type] ||
              ACTION_CONFIG["settings_modifie"];
            const Icon = conf.icon;
            const showDate =
              idx === 0 ||
              new Date(log.created_at).toLocaleDateString("fr-FR") !==
                new Date(logs[idx - 1].created_at).toLocaleDateString("fr-FR");

            return (
              <div key={log.id}>
                {showDate && (
                  <div className="text-xs font-semibold text-biblio-muted uppercase tracking-wider py-3 first:pt-0">
                    {new Date(log.created_at).toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </div>
                )}
                <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors group">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${conf.color}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-biblio-text leading-snug">
                      {/* Affiche uniquement la partie avant la première parenthèse pour garder la ligne courte */}
                      {log.description?.split(" (")[0] || log.description}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {log.user_info && (
                        <span className="text-xs text-biblio-muted">
                          {log.user_info}
                        </span>
                      )}
                      {log.user_info && (
                        <span className="text-xs text-white/20">·</span>
                      )}
                      <span className="text-xs text-biblio-muted">
                        {timeAgo(log.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-biblio-muted hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity">
                      {new Date(log.created_at).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-white/10 text-biblio-muted hover:text-biblio-text"
                      title="Voir les détails"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {hasMore && (
            <div className="pt-4 text-center">
              <button
                onClick={loadMore}
                className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg text-sm font-medium transition-colors"
              >
                Charger plus
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL : Détails d'un log ── */}
      {selectedLog &&
        (() => {
          const conf =
            ACTION_CONFIG[selectedLog.action_type] ||
            ACTION_CONFIG["settings_modifie"];
          const Icon = conf.icon;
          // Décompose la description : titre avant la parenthèse, détails dedans
          const parenIdx = selectedLog.description?.indexOf(" (");
          const mainDesc =
            parenIdx > -1
              ? selectedLog.description.slice(0, parenIdx)
              : selectedLog.description;
          const detailsRaw =
            parenIdx > -1
              ? selectedLog.description.slice(parenIdx + 2).replace(/\)$/, "")
              : "";
          // Convertit "Clé: val | Clé: val" en tableau [{key, val}]
          const details = detailsRaw
            ? detailsRaw.split(" | ").map((part) => {
                const sep = part.indexOf(": ");
                return sep > -1
                  ? { key: part.slice(0, sep), val: part.slice(sep + 2) }
                  : { key: part, val: "" };
              })
            : [];

          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
              onClick={() => setSelectedLog(null)}
            >
              <div
                className="bg-biblio-card rounded-2xl border border-white/10 w-full max-w-md shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${conf.color}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-biblio-text">
                      {conf.label}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="text-biblio-muted hover:text-biblio-text"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                  <p className="text-sm text-biblio-text font-medium">
                    {mainDesc}
                  </p>

                  {details.length > 0 && (
                    <div className="bg-white/5 rounded-xl divide-y divide-white/5">
                      {details.map(({ key, val }) => (
                        <div
                          key={key}
                          className="flex items-center justify-between px-4 py-2.5 gap-3"
                        >
                          <span className="text-xs text-biblio-muted shrink-0">
                            {key}
                          </span>
                          <span className="text-xs text-biblio-text text-right font-mono break-all">
                            {val || "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="bg-white/5 rounded-xl divide-y divide-white/5">
                    <div className="flex items-center justify-between px-4 py-2.5 gap-3">
                      <span className="text-xs text-biblio-muted">
                        Utilisateur
                      </span>
                      <span className="text-xs text-biblio-text">
                        {selectedLog.user_info || "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5 gap-3">
                      <span className="text-xs text-biblio-muted">
                        Date exacte
                      </span>
                      <span className="text-xs text-biblio-text">
                        {new Date(selectedLog.created_at).toLocaleString(
                          "fr-FR",
                          {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          },
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5 gap-3">
                      <span className="text-xs text-biblio-muted">Type</span>
                      <span className="text-xs font-mono text-biblio-muted">
                        {selectedLog.action_type}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
