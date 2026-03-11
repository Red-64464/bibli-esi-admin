import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { getPretStatut, joursRetard, formatDate } from "../lib/utils";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  ArrowLeftRight,
  AlertTriangle,
  Loader2,
  Download,
  BookCheck,
  BookX,
  Calendar,
  X,
  TrendingUp,
  Tag,
  RefreshCw,
  Clock,
  Bell,
  Percent,
} from "lucide-react";
import StatCard from "../components/StatCard";
import ExportModal from "../components/ExportModal";
import { exportCSV, exportJSON, exportExcel } from "../lib/exports";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const CHART_COLORS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#0ea5e9",
  "#a855f7",
  "#f97316",
  "#14b8a6",
];

const DarkTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: "#1e293b",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "8px",
          padding: "8px 12px",
        }}
      >
        {label && (
          <p
            style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "4px" }}
          >
            {label}
          </p>
        )}
        <p style={{ color: "#f1f5f9", fontWeight: 600, fontSize: "14px" }}>
          {payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

const PieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: "#1e293b",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "8px",
          padding: "8px 12px",
        }}
      >
        <p style={{ color: "#94a3b8", fontSize: "12px" }}>{payload[0].name}</p>
        <p style={{ color: "#f1f5f9", fontWeight: 600 }}>
          {payload[0].value} livre{payload[0].value !== 1 ? "s" : ""}
        </p>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [livres, setLivres] = useState([]);
  const [etudiants, setEtudiants] = useState([]);
  const [prets, setPrets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCard, setActiveCard] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState(null);
  const [periodFilter, setPeriodFilter] = useState("6m");

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const [livresRes, etudRes, pretsRes] = await Promise.all([
        supabase
          .from("livres")
          .select("*")
          .order("date_ajout", { ascending: false }),
        supabase
          .from("etudiants")
          .select("*")
          .order("date_inscription", { ascending: false }),
        supabase
          .from("prets")
          .select(
            "*, livres(id, titre, isbn, categorie), etudiants(id, nom, prenom, email)",
          )
          .order("date_pret", { ascending: false }),
      ]);
      if (livresRes.error) throw livresRes.error;
      if (etudRes.error) throw etudRes.error;
      if (pretsRes.error) throw pretsRes.error;
      setLivres(livresRes.data || []);
      setEtudiants(etudRes.data || []);
      setPrets(pretsRes.data || []);
    } catch (err) {
      setError("Impossible de charger le tableau de bord : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Computed Stats ----------
  const pretsEnCours = prets.filter((p) => !p.rendu);
  const retards = pretsEnCours.filter((p) => getPretStatut(p) === "en_retard");
  const now = new Date();
  const pretsCeMois = prets.filter((p) => {
    const d = new Date(p.date_pret);
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );
  });
  const livresDisponibles = livres.filter(
    (l) =>
      (l.statut || (l.disponible ? "disponible" : "emprunte")) === "disponible",
  );
  const tauxOccupation =
    livres.length > 0
      ? Math.round((pretsEnCours.length / livres.length) * 100)
      : 0;
  const stats = {
    totalLivres: livres.length,
    livresDisponibles: livresDisponibles.length,
    livresEmpruntes: pretsEnCours.length,
    totalEtudiants: etudiants.length,
    pretsEnRetard: retards.length,
    pretsCeMois: pretsCeMois.length,
    tauxOccupation,
  };

  // ---------- Prochains retours & rappels ----------
  const prochainsRetours = useMemo(() => {
    const in3Days = new Date(now.getTime() + 3 * 86400000);
    return prets
      .filter((p) => {
        if (p.rendu) return false;
        const retourDate = p.date_retour_prevue
          ? new Date(p.date_retour_prevue)
          : new Date(new Date(p.date_pret).getTime() + 30 * 86400000);
        return retourDate >= now && retourDate <= in3Days;
      })
      .sort((a, b) => {
        const ra = a.date_retour_prevue
          ? new Date(a.date_retour_prevue)
          : new Date(new Date(a.date_pret).getTime() + 30 * 86400000);
        const rb = b.date_retour_prevue
          ? new Date(b.date_retour_prevue)
          : new Date(new Date(b.date_pret).getTime() + 30 * 86400000);
        return ra - rb;
      })
      .slice(0, 5);
  }, [prets]);

  const rappelsDuJour = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return prets.filter(
      (p) => !p.rendu && p.date_rappel && p.date_rappel.slice(0, 10) === today,
    );
  }, [prets]);

  // ---------- Chart Data (period-filtered) ----------
  const chartData = useMemo(() => {
    if (periodFilter === "7j") {
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now);
        d.setDate(d.getDate() - (6 - i));
        const label = d.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
        });
        const count = prets.filter((p) => {
          const dp = new Date(p.date_pret);
          return dp.toDateString() === d.toDateString();
        }).length;
        return { label, count };
      });
    }
    const monthsCount =
      periodFilter === "1m"
        ? 1
        : periodFilter === "3m"
          ? 3
          : periodFilter === "6m"
            ? 6
            : periodFilter === "1an"
              ? 12
              : null;
    if (monthsCount !== null) {
      return Array.from({ length: monthsCount }, (_, i) => {
        const d = new Date(
          now.getFullYear(),
          now.getMonth() - (monthsCount - 1 - i),
          1,
        );
        const label = d.toLocaleDateString("fr-FR", {
          month: "short",
          year: "2-digit",
        });
        const count = prets.filter((p) => {
          const dp = new Date(p.date_pret);
          return (
            dp.getMonth() === d.getMonth() &&
            dp.getFullYear() === d.getFullYear()
          );
        }).length;
        return { label, count };
      });
    }
    // "tout" — group by month from earliest pret
    if (!prets.length) return [];
    const minDate = prets.reduce((min, p) => {
      const d = new Date(p.date_pret);
      return d < min ? d : min;
    }, now);
    const result = [];
    let d = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (d <= now) {
      const label = d.toLocaleDateString("fr-FR", {
        month: "short",
        year: "2-digit",
      });
      const year = d.getFullYear();
      const month = d.getMonth();
      const count = prets.filter((p) => {
        const dp = new Date(p.date_pret);
        return dp.getFullYear() === year && dp.getMonth() === month;
      }).length;
      result.push({ label, count });
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
    return result;
  }, [prets, periodFilter]);

  const topLivresMap = {};
  prets.forEach((p) => {
    if (p.livres?.titre) {
      const k = p.livres.titre;
      topLivresMap[k] = (topLivresMap[k] || 0) + 1;
    }
  });
  const topLivres = Object.entries(topLivresMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([titre, count]) => ({
      titre: titre.length > 25 ? titre.slice(0, 22) + "..." : titre,
      count,
    }));

  const categoriesMap = {};
  livres.forEach((l) => {
    const cat = l.categorie || "Non classe";
    categoriesMap[cat] = (categoriesMap[cat] || 0) + 1;
  });
  const categoriesData = Object.entries(categoriesMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  const lecteurMap = {};
  prets.forEach((p) => {
    if (p.etudiants) {
      const k = p.etudiant_id;
      if (!lecteurMap[k])
        lecteurMap[k] = {
          nom: `${p.etudiants.prenom} ${p.etudiants.nom}`,
          count: 0,
        };
      lecteurMap[k].count++;
    }
  });
  const topLecteurs = Object.values(lecteurMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ---------- Export ----------
  const handleExport = async (format) => {
    try {
      const filename = `${exportType}_${new Date().toISOString().slice(0, 10)}`;
      if (exportType === "livres") {
        const { data } = await supabase.from("livres").select("*");
        const rows = (data || []).map((l) => ({
          ISBN: l.isbn,
          Titre: l.titre,
          Auteur: l.auteur || "",
          Editeur: l.editeur || "",
          Annee: l.annee || "",
          Langue: l.langue || "",
          Categorie: l.categorie || "",
          Statut: l.statut || (l.disponible ? "disponible" : "emprunte"),
          Emplacement: l.emplacement || "",
          Exemplaires: l.nb_exemplaires || 1,
          "Date ajout": new Date(l.date_ajout).toLocaleDateString("fr-FR"),
        }));
        if (format === "csv") exportCSV(rows, filename);
        else if (format === "excel") exportExcel(rows, filename, "Livres");
        else exportJSON(rows, filename);
      } else {
        const { data } = await supabase
          .from("prets")
          .select("*, livres(titre, isbn), etudiants(nom, prenom, email)")
          .eq("rendu", false);
        const rows = (data || []).map((p) => ({
          Livre: p.livres?.titre || "",
          ISBN: p.livres?.isbn || "",
          Etudiant: p.etudiants
            ? `${p.etudiants.prenom} ${p.etudiants.nom}`
            : "",
          Email: p.etudiants?.email || "",
          "Date de pret": new Date(p.date_pret).toLocaleDateString("fr-FR"),
          "Retour prevu": p.date_retour_prevue
            ? new Date(p.date_retour_prevue).toLocaleDateString("fr-FR")
            : "-",
          Statut: getPretStatut(p),
          Notes: p.notes || "",
        }));
        if (format === "csv") exportCSV(rows, filename);
        else if (format === "excel") exportExcel(rows, filename, "Prets");
        else exportJSON(rows, filename);
      }
    } catch (err) {
      setError("Erreur export : " + err.message);
    }
  };

  // ---------- Detail Panels ----------
  const renderDetailPanel = () => {
    if (!activeCard) return null;
    const statusColors = {
      en_cours: "bg-yellow-500/20 text-yellow-400",
      retourne: "bg-green-500/20 text-green-400",
      en_retard: "bg-red-500/20 text-red-400",
      perdu: "bg-red-500/20 text-red-400",
    };
    const panels = {
      livres: (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-biblio-accent" /> Detail -
              Catalogue
            </h3>
            <button
              onClick={() => setActiveCard(null)}
              className="text-biblio-muted hover:text-biblio-text"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-biblio-muted mb-3 flex items-center gap-1">
                <Tag className="w-4 h-4" /> Par categorie
              </p>
              <div className="space-y-2">
                {categoriesData.slice(0, 8).map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-sm truncate">{c.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <div
                        className="h-1.5 bg-biblio-accent/60 rounded-full"
                        style={{
                          width: `${(c.value / (categoriesData[0]?.value || 1)) * 80}px`,
                        }}
                      />
                      <span className="text-sm text-biblio-muted w-6 text-right">
                        {c.value}
                      </span>
                    </div>
                  </div>
                ))}
                {categoriesData.length === 0 && (
                  <p className="text-sm text-biblio-muted">
                    Aucune categorie definie
                  </p>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-biblio-muted mb-3">
                Derniers ajouts
              </p>
              <div className="space-y-3">
                {livres.slice(0, 6).map((l) => (
                  <div key={l.id} className="flex items-start gap-3">
                    {l.couverture_url ? (
                      <img
                        src={l.couverture_url}
                        alt=""
                        className="w-8 h-10 object-contain rounded shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-10 bg-white/5 rounded shrink-0 flex items-center justify-center">
                        <BookOpen className="w-3 h-3 text-biblio-muted" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{l.titre}</p>
                      <p className="text-xs text-biblio-muted">
                        {l.auteur || "-"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ),
      disponibles: (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <BookCheck className="w-5 h-5 text-biblio-success" /> Livres
              disponibles ({livresDisponibles.length})
            </h3>
            <button
              onClick={() => setActiveCard(null)}
              className="text-biblio-muted hover:text-biblio-text"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10">
                  {["Titre", "Auteur", "Categorie", "Emplacement"].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-xs font-semibold text-biblio-muted uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {livresDisponibles.slice(0, 20).map((l) => (
                  <tr key={l.id} className="border-b border-white/5">
                    <td className="px-3 py-2 text-sm font-medium">{l.titre}</td>
                    <td className="px-3 py-2 text-sm text-biblio-muted">
                      {l.auteur || "-"}
                    </td>
                    <td className="px-3 py-2 text-sm text-biblio-muted">
                      {l.categorie || "-"}
                    </td>
                    <td className="px-3 py-2 text-sm text-biblio-muted">
                      {l.emplacement || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {livresDisponibles.length > 20 && (
              <p className="text-xs text-biblio-muted mt-2 px-3">
                + {livresDisponibles.length - 20} autres
              </p>
            )}
          </div>
        </div>
      ),
      empruntes: (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <BookX className="w-5 h-5 text-biblio-warning" /> Livres empruntes
              ({pretsEnCours.length})
            </h3>
            <button
              onClick={() => setActiveCard(null)}
              className="text-biblio-muted hover:text-biblio-text"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-biblio-muted mb-3">
                Top livres empruntes
              </p>
              <div className="space-y-2">
                {topLivres.map((l, i) => (
                  <div key={l.titre} className="flex items-center gap-2">
                    <span className="text-xs text-biblio-muted w-4">
                      {i + 1}
                    </span>
                    <span className="text-sm flex-1 truncate">{l.titre}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-biblio-accent/20 text-biblio-accent">
                      {l.count}x
                    </span>
                  </div>
                ))}
                {topLivres.length === 0 && (
                  <p className="text-sm text-biblio-muted">
                    Pas encore de donnees
                  </p>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-biblio-muted mb-3">
                Prets en cours
              </p>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {pretsEnCours.slice(0, 15).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate">{p.livres?.titre || "-"}</p>
                      <p className="text-xs text-biblio-muted">
                        {p.etudiants
                          ? `${p.etudiants.prenom} ${p.etudiants.nom}`
                          : "-"}
                      </p>
                    </div>
                    <span className="text-xs text-biblio-muted shrink-0 ml-2">
                      {new Date(p.date_pret).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ),
      etudiants: (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-5 h-5 text-biblio-accent" /> Etudiants (
              {etudiants.length})
            </h3>
            <button
              onClick={() => setActiveCard(null)}
              className="text-biblio-muted hover:text-biblio-text"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-biblio-muted mb-3">
                Nouveaux inscrits
              </p>
              <div className="space-y-2">
                {etudiants.slice(0, 6).map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div>
                      <p>
                        {e.prenom} {e.nom}
                      </p>
                      <p className="text-xs text-biblio-muted">
                        {e.email || "-"}
                      </p>
                    </div>
                    {e.date_inscription && (
                      <span className="text-xs text-biblio-muted">
                        {new Date(e.date_inscription).toLocaleDateString(
                          "fr-FR",
                        )}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-biblio-muted mb-3">
                Top lecteurs
              </p>
              <div className="space-y-2">
                {topLecteurs.map((l, i) => (
                  <div key={l.nom} className="flex items-center gap-2">
                    <span className="text-xs text-biblio-muted w-4">
                      {i + 1}
                    </span>
                    <span className="text-sm flex-1">{l.nom}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-biblio-success/20 text-biblio-success">
                      {l.count} pret{l.count !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
                {topLecteurs.length === 0 && (
                  <p className="text-sm text-biblio-muted">
                    Pas encore de donnees
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ),
      retards: (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-biblio-danger" /> Prets en
              retard ({retards.length})
            </h3>
            <button
              onClick={() => setActiveCard(null)}
              className="text-biblio-muted hover:text-biblio-text"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {retards.length === 0 ? (
            <p className="text-sm text-biblio-muted py-4">
              Aucun pret en retard. Tout est en ordre !
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10">
                    {["Livre", "Etudiant", "Date pret", "Retour prevu", "Retard"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-xs font-semibold text-biblio-muted uppercase"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {retards.map((p) => (
                    <tr key={p.id} className="border-b border-white/5">
                      <td className="px-3 py-2 text-sm font-medium">
                        {p.livres?.titre || "-"}
                      </td>
                      <td className="px-3 py-2 text-sm text-biblio-muted">
                        {p.etudiants
                          ? `${p.etudiants.prenom} ${p.etudiants.nom}`
                          : "-"}
                      </td>
                      <td className="px-3 py-2 text-sm text-biblio-muted">
                        {formatDate(p.date_pret)}
                      </td>
                      <td className="px-3 py-2 text-sm text-biblio-muted">
                        {p.date_retour_prevue
                          ? formatDate(p.date_retour_prevue)
                          : formatDate(
                              new Date(
                                new Date(p.date_pret).getTime() +
                                  30 * 86400000,
                              ).toISOString(),
                            )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs px-2 py-1 rounded-full bg-biblio-danger/20 text-biblio-danger font-medium">
                          +{joursRetard(p)} j
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ),
      mois: (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-biblio-accent" /> Prets ce mois
              ({pretsCeMois.length})
            </h3>
            <button
              onClick={() => setActiveCard(null)}
              className="text-biblio-muted hover:text-biblio-text"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {pretsCeMois.length === 0 ? (
            <p className="text-sm text-biblio-muted py-4">
              Aucun pret ce mois.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10">
                    {[
                      "Livre",
                      "Etudiant",
                      "Date pret",
                      "Retour prevu",
                      "Statut",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-xs font-semibold text-biblio-muted uppercase"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pretsCeMois.map((p) => {
                    const s = getPretStatut(p);
                    return (
                      <tr key={p.id} className="border-b border-white/5">
                        <td className="px-3 py-2 text-sm">
                          {p.livres?.titre || "-"}
                        </td>
                        <td className="px-3 py-2 text-sm text-biblio-muted">
                          {p.etudiants
                            ? `${p.etudiants.prenom} ${p.etudiants.nom}`
                            : "-"}
                        </td>
                        <td className="px-3 py-2 text-sm text-biblio-muted">
                          {new Date(p.date_pret).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="px-3 py-2 text-sm text-biblio-muted">
                          {p.date_retour_prevue
                            ? new Date(p.date_retour_prevue).toLocaleDateString(
                                "fr-FR",
                              )
                            : "-"}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${statusColors[s] || "bg-white/10 text-biblio-muted"}`}
                          >
                            {s.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ),
    };

    return (
      <div className="bg-biblio-card rounded-xl border border-biblio-accent/40 p-6">
        {panels[activeCard]}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-10 h-10 animate-spin text-biblio-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8 text-biblio-accent" />
            Tableau de bord
          </h1>
          <p className="text-biblio-muted mt-1">
            Vue d'ensemble de la bibliotheque
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchDashboard}
            disabled={loading}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </button>
          <button
            onClick={() => {
              setExportType("livres");
              setShowExportModal(true);
            }}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Export livres
          </button>
          <button
            onClick={() => {
              setExportType("prets");
              setShowExportModal(true);
            }}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Export prets
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-biblio-danger/10 text-biblio-danger p-4 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* 7 stat cards - all clickable */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard
          icon={BookOpen}
          label="Total livres"
          value={stats.totalLivres}
          active={activeCard === "livres"}
          onClick={() =>
            setActiveCard(activeCard === "livres" ? null : "livres")
          }
        />
        <StatCard
          icon={BookCheck}
          label="Disponibles"
          value={stats.livresDisponibles}
          color="text-biblio-success"
          active={activeCard === "disponibles"}
          onClick={() =>
            setActiveCard(activeCard === "disponibles" ? null : "disponibles")
          }
        />
        <StatCard
          icon={BookX}
          label="Empruntes"
          value={stats.livresEmpruntes}
          color="text-biblio-warning"
          active={activeCard === "empruntes"}
          onClick={() =>
            setActiveCard(activeCard === "empruntes" ? null : "empruntes")
          }
        />
        <StatCard
          icon={Percent}
          label="Taux d'occupation"
          value={`${stats.tauxOccupation}%`}
          color="text-biblio-accent"
        />
        <StatCard
          icon={Users}
          label="Etudiants inscrits"
          value={stats.totalEtudiants}
          active={activeCard === "etudiants"}
          onClick={() =>
            setActiveCard(activeCard === "etudiants" ? null : "etudiants")
          }
        />
        <StatCard
          icon={AlertTriangle}
          label="Prets en retard"
          value={stats.pretsEnRetard}
          color="text-biblio-danger"
          active={activeCard === "retards"}
          onClick={() =>
            setActiveCard(activeCard === "retards" ? null : "retards")
          }
        />
        <StatCard
          icon={Calendar}
          label="Prets ce mois"
          value={stats.pretsCeMois}
          color="text-biblio-accent"
          active={activeCard === "mois"}
          onClick={() => setActiveCard(activeCard === "mois" ? null : "mois")}
        />
      </div>

      {/* Detail Panel */}
      {renderDetailPanel()}

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-biblio-card rounded-xl border border-white/10 p-6">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-biblio-accent" /> Prets par
              periode
            </h2>
            <div className="flex gap-1 flex-wrap">
              {["7j", "1m", "3m", "6m", "1an", "tout"].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriodFilter(p)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    periodFilter === p
                      ? "bg-biblio-accent text-white"
                      : "bg-white/10 text-biblio-muted hover:bg-white/20"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barCategoryGap="30%">
              <XAxis
                dataKey="label"
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                content={<DarkTooltip />}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-biblio-card rounded-xl border border-white/10 p-6">
          <h2 className="text-base font-semibold mb-5 flex items-center gap-2">
            <Tag className="w-4 h-4 text-biblio-accent" /> Categories
          </h2>
          {categoriesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={categoriesData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  dataKey="value"
                  paddingAngle={3}
                >
                  {categoriesData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend
                  formatter={(v) => (
                    <span style={{ color: "#94a3b8", fontSize: "11px" }}>
                      {v}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-biblio-muted">
              Aucune categorie definie
            </div>
          )}
        </div>
      </div>

      {/* Top livres horizontal bar */}
      {topLivres.length > 0 && (
        <div className="bg-biblio-card rounded-xl border border-white/10 p-6">
          <h2 className="text-base font-semibold mb-5 flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-biblio-accent" /> Top livres
            les plus empruntes
          </h2>
          <ResponsiveContainer
            width="100%"
            height={Math.max(160, topLivres.length * 38)}
          >
            <BarChart
              layout="vertical"
              data={topLivres}
              margin={{ left: 12 }}
              barCategoryGap="30%"
            >
              <XAxis
                type="number"
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                dataKey="titre"
                type="category"
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={160}
              />
              <Tooltip
                content={<DarkTooltip />}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar dataKey="count" fill="#22c55e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Overdue alert table (only when no panel is open) */}
      {retards.length > 0 && !activeCard && (
        <div className="bg-biblio-card rounded-xl border border-white/10 p-6">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-biblio-danger" /> Prets en
            retard - Action requise ({retards.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10">
                  {["Livre", "Etudiant", "Date pret", "Retour prevu", "Retard"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2 text-xs font-semibold text-biblio-muted uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {retards.map((p) => (
                  <tr key={p.id} className="border-b border-white/5">
                    <td className="px-4 py-3 text-sm">
                      {p.livres?.titre || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-biblio-muted">
                      {p.etudiants
                        ? `${p.etudiants.prenom} ${p.etudiants.nom}`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-biblio-muted">
                      {formatDate(p.date_pret)}
                    </td>
                    <td className="px-4 py-3 text-sm text-biblio-muted">
                      {p.date_retour_prevue
                        ? formatDate(p.date_retour_prevue)
                        : formatDate(
                            new Date(
                              new Date(p.date_pret).getTime() + 30 * 86400000,
                            ).toISOString(),
                          )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-biblio-danger/20 text-biblio-danger font-medium">
                        +{joursRetard(p)} jours
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Prochains retours attendus & Rappels du jour */}
      {(prochainsRetours.length > 0 || rappelsDuJour.length > 0) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {prochainsRetours.length > 0 && (
            <div className="bg-biblio-card rounded-xl border border-white/10 p-6">
              <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-biblio-warning" /> Prochains
                retours attendus{" "}
                <span className="text-biblio-muted text-xs font-normal">
                  (dans les 3 prochains jours)
                </span>
              </h2>
              <div className="space-y-3">
                {prochainsRetours.map((p) => {
                  const retourDate = p.date_retour_prevue
                    ? new Date(p.date_retour_prevue)
                    : new Date(
                        new Date(p.date_pret).getTime() + 30 * 86400000,
                      );
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {p.livres?.titre || "-"}
                        </p>
                        <p className="text-xs text-biblio-muted">
                          {p.etudiants
                            ? `${p.etudiants.prenom} ${p.etudiants.nom}`
                            : "-"}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full bg-biblio-warning/20 text-biblio-warning shrink-0">
                        {formatDate(retourDate.toISOString())}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {rappelsDuJour.length > 0 && (
            <div className="bg-biblio-card rounded-xl border border-white/10 p-6">
              <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                <Bell className="w-4 h-4 text-biblio-accent" /> Rappels du jour
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-biblio-accent/20 text-biblio-accent text-xs font-bold">
                  {rappelsDuJour.length}
                </span>
              </h2>
              <div className="space-y-3">
                {rappelsDuJour.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {p.livres?.titre || "-"}
                      </p>
                      <p className="text-xs text-biblio-muted">
                        {p.etudiants
                          ? `${p.etudiants.prenom} ${p.etudiants.nom}`
                          : "-"}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-biblio-accent/20 text-biblio-accent shrink-0">
                      {p.etudiants?.email || "rappel"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showExportModal && (
        <ExportModal
          title={`Exporter - ${exportType === "livres" ? "Catalogue" : "Prets en cours"}`}
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
        />
      )}
    </div>
  );
}
