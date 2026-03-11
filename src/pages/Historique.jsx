import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
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
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const fetchLogs = useCallback(
    async (reset = false) => {
      try {
        if (reset) setLoading(true);
        const currentPage = reset ? 0 : page;
        const from = currentPage * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let query = supabase
          .from("activity_logs")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(from, to);

        if (filter !== ALL_FILTER) {
          query = query.eq("action_type", filter);
        }
        if (search.trim()) {
          query = query.ilike("description", `%${search.trim()}%`);
        }

        const { data, error: err, count } = await query;
        if (err) throw err;

        if (reset) {
          setLogs(data || []);
          setPage(0);
        } else {
          setLogs((prev) => [...prev, ...(data || [])]);
        }
        setHasMore(from + PAGE_SIZE < (count || 0));
      } catch (err) {
        setError("Impossible de charger l'historique : " + err.message);
      } finally {
        setLoading(false);
      }
    },
    [filter, search, page],
  );

  useEffect(() => {
    fetchLogs(true);
  }, [filter, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = () => {
    setPage((p) => p + 1);
    fetchLogs(false);
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
        <button
          onClick={() => fetchLogs(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-sm text-biblio-text rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </button>
      </div>

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
          {filter !== ALL_FILTER && (
            <button
              onClick={() => setFilter(ALL_FILTER)}
              className="mt-2 text-sm text-biblio-accent hover:underline"
            >
              Afficher toutes les entrées
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
                      {log.description}
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
                  <span className="text-xs text-biblio-muted shrink-0 hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity">
                    {new Date(log.created_at).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
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
    </div>
  );
}
