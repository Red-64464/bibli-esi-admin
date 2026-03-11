import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { getPretStatut, formatDate } from "../lib/utils";
import {
  BarChart2,
  Loader2,
  AlertCircle,
  BookOpen,
  Users,
  ArrowLeftRight,
  AlertTriangle,
  TrendingUp,
  Tag,
  RefreshCw,
} from "lucide-react";
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
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import StatCard from "../components/StatCard";

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
  if (!active || !payload?.length) return null;
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
        <p style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "4px" }}>
          {label}
        </p>
      )}
      <p style={{ color: "#f1f5f9", fontWeight: 600, fontSize: "14px" }}>
        {payload[0].value}
      </p>
    </div>
  );
};

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
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
};

/** Retourne N mois : { label: "Jan 25", key: "2025-01" } */
function getLastNMonths(n) {
  const months = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    });
  }
  return months;
}

export default function Statistiques() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [periodFilter, setPeriodFilter] = useState("1an");

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError("");

      const [pretsRes, livresRes, etudiantsRes] = await Promise.all([
        supabase
          .from("prets")
          .select(
            "*, livres(id, titre, categorie), etudiants(id, nom, prenom)",
          ),
        supabase
          .from("livres")
          .select("id, titre, categorie, statut, created_at"),
        supabase.from("etudiants").select("id", { count: "exact" }),
      ]);

      if (pretsRes.error) throw pretsRes.error;
      if (livresRes.error) throw livresRes.error;

      const prets = pretsRes.data || [];
      const livres = livresRes.data || [];
      const totalEtudiants = etudiantsRes.count || 0;

      // ─── KPIs ───────────────────────────────────────────────────────────────
      const enCours = prets.filter(
        (p) => getPretStatut(p) === "en_cours",
      ).length;
      const enRetard = prets.filter(
        (p) => getPretStatut(p) === "en_retard",
      ).length;
      const thisMonth = new Date();
      const livresAjoutees = livres.filter((l) => {
        if (!l.created_at) return false;
        const d = new Date(l.created_at);
        return (
          d.getMonth() === thisMonth.getMonth() &&
          d.getFullYear() === thisMonth.getFullYear()
        );
      }).length;

      const tauxRotation =
        livres.length > 0
          ? Math.round((prets.length / livres.length) * 10) / 10
          : 0;

      const pretsRendus = prets.filter(
        (p) => p.rendu && p.date_retour && p.date_pret,
      );
      const dureeMoyenne =
        pretsRendus.length > 0
          ? Math.round(
              pretsRendus.reduce((sum, p) => {
                const diff =
                  new Date(p.date_retour) - new Date(p.date_pret);
                return sum + diff / (1000 * 60 * 60 * 24);
              }, 0) / pretsRendus.length,
            )
          : 0;

      // ─── Prêts par mois (12 derniers mois) ───────────────────────────────────
      const months = getLastNMonths(12);
      const pretsByMonth = months.map(({ label, key }) => ({
        name: label,
        prêts: prets.filter((p) => {
          const d = new Date(p.date_pret);
          return (
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` ===
            key
          );
        }).length,
        retours: prets.filter((p) => {
          if (!p.rendu || !p.date_retour) return false;
          const d = new Date(p.date_retour);
          return (
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` ===
            key
          );
        }).length,
      }));

      // ─── Top 10 livres empruntés ─────────────────────────────────────────────
      const pretsByBook = {};
      prets.forEach((p) => {
        const id = p.livres?.id;
        const titre = p.livres?.titre || "Inconnu";
        if (!id) return;
        if (!pretsByBook[id]) pretsByBook[id] = { name: titre, count: 0 };
        pretsByBook[id].count++;
      });
      const topLivres = Object.values(pretsByBook)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map((d) => ({ name: d.name.slice(0, 25), prêts: d.count }));

      // ─── Top 5 étudiants ─────────────────────────────────────────────────────
      const pretsByStudent = {};
      prets.forEach((p) => {
        const id = p.etudiants?.id;
        if (!id) return;
        const name = p.etudiants
          ? `${p.etudiants.prenom} ${p.etudiants.nom}`
          : "Inconnu";
        if (!pretsByStudent[id]) pretsByStudent[id] = { name, count: 0 };
        pretsByStudent[id].count++;
      });
      const topEtudiants = Object.values(pretsByStudent)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map((d) => ({ name: d.name, prêts: d.count }));

      // ─── Catégories ──────────────────────────────────────────────────────────
      const catCount = {};
      livres.forEach((l) => {
        const cat = l.categorie || "Sans catégorie";
        catCount[cat] = (catCount[cat] || 0) + 1;
      });
      const categories = Object.entries(catCount)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

      setData({
        kpis: {
          totalLivres: livres.length,
          totalEtudiants,
          enCours,
          enRetard,
          totalPrets: prets.length,
          livresAjoutees,
          tauxRotation,
          dureeMoyenne,
        },
        pretsByMonth,
        topLivres,
        topEtudiants,
        categories,
      });
    } catch (err) {
      setError("Impossible de charger les statistiques : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-biblio-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-biblio-danger/10 text-biblio-danger p-4 rounded-lg text-sm flex items-center gap-2 max-w-xl mx-auto mt-8">
        <AlertCircle className="w-4 h-4 shrink-0" />
        {error}
      </div>
    );
  }

  const { kpis, pretsByMonth, topLivres, topEtudiants, categories } = data;

  // ─── Filter pretsByMonth based on period ─────────────────────────────────────
  const filteredPretsByMonth = useMemo(() => {
    if (!pretsByMonth) return [];
    if (periodFilter === "tout") return pretsByMonth;
    const periodMap = { "7j": 1, "1m": 1, "3m": 3, "6m": 6, "1an": 12 };
    const n = periodMap[periodFilter] ?? 12;
    return pretsByMonth.slice(-n);
  }, [pretsByMonth, periodFilter]);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <BarChart2 className="w-7 h-7 text-biblio-accent" />
            Statistiques
          </h1>
          <p className="text-biblio-muted mt-1 text-sm">
            Aperçu global de l'activité de la bibliothèque.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-biblio-accent/20 hover:bg-biblio-accent/30 text-biblio-accent text-sm rounded-lg transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Exporter en PDF
          </button>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-sm text-biblio-text rounded-lg transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Filtre période */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-biblio-muted">Période :</span>
        {["7j", "1m", "3m", "6m", "1an", "tout"].map((p) => (
          <button
            key={p}
            onClick={() => setPeriodFilter(p)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              periodFilter === p
                ? "bg-biblio-accent text-white"
                : "bg-white/10 text-biblio-muted hover:bg-white/20"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Livres"
          value={kpis.totalLivres}
          icon={BookOpen}
          color="text-biblio-accent"
        />
        <StatCard
          title="Étudiants"
          value={kpis.totalEtudiants}
          icon={Users}
          color="text-biblio-accent"
        />
        <StatCard
          title="Total prêts"
          value={kpis.totalPrets}
          icon={ArrowLeftRight}
          color="text-biblio-accent"
        />
        <StatCard
          title="En cours"
          value={kpis.enCours}
          icon={TrendingUp}
          color="text-biblio-warning"
        />
        <StatCard
          title="En retard"
          value={kpis.enRetard}
          icon={AlertTriangle}
          color="text-biblio-danger"
        />
        <StatCard
          title="Ajoutés ce mois"
          value={kpis.livresAjoutees}
          icon={BookOpen}
          color="text-biblio-success"
        />
        <StatCard
          title="Taux de rotation"
          value={`${kpis.tauxRotation}x`}
          icon={TrendingUp}
          color="text-biblio-accent"
        />
        <StatCard
          title="Durée moy. prêt"
          value={`${kpis.dureeMoyenne}j`}
          icon={Tag}
          color="text-biblio-muted"
        />
      </div>

      {/* Prêts par mois */}
      <div className="bg-biblio-card rounded-xl border border-white/10 p-5">
        <h2 className="text-base font-semibold mb-4">
          Prêts par mois
        </h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={filteredPretsByMonth} barSize={22}>
            <XAxis
              dataKey="name"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              content={<DarkTooltip />}
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
            />
            <Bar dataKey="prêts" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Emprunts vs Retours */}
      <div className="bg-biblio-card rounded-xl border border-white/10 p-5">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-biblio-accent" />
          Emprunts vs Retours
        </h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={filteredPretsByMonth}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "#1e293b",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "#94a3b8", fontSize: "12px" }}
              itemStyle={{ color: "#f1f5f9" }}
            />
            <Legend
              formatter={(v) => (
                <span style={{ color: "#94a3b8", fontSize: "11px" }}>{v}</span>
              )}
            />
            <Line
              type="monotone"
              dataKey="prêts"
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="retours"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top livres */}
        <div className="bg-biblio-card rounded-xl border border-white/10 p-5">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-biblio-accent" />
            Top 10 livres empruntés
          </h2>
          {topLivres.length === 0 ? (
            <p className="text-biblio-muted text-sm text-center py-4">
              Pas encore de données.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={topLivres}
                layout="vertical"
                barSize={16}
                margin={{ left: 0, right: 10 }}
              >
                <XAxis
                  type="number"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={130}
                />
                <Tooltip
                  content={<DarkTooltip />}
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                />
                <Bar dataKey="prêts" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Catégories */}
        <div className="bg-biblio-card rounded-xl border border-white/10 p-5">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <Tag className="w-4 h-4 text-biblio-accent" />
            Livres par catégorie
          </h2>
          {categories.length === 0 ? (
            <p className="text-biblio-muted text-sm text-center py-4">
              Pas encore de données.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={categories}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={3}
                  label={false}
                >
                  {categories.map((_, i) => (
                    <Cell
                      key={i}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend
                  iconSize={8}
                  formatter={(v) => (
                    <span style={{ color: "#94a3b8", fontSize: "11px" }}>
                      {v}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top étudiants */}
      <div className="bg-biblio-card rounded-xl border border-white/10 p-5">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-biblio-accent" />
          Top 5 étudiants les plus actifs
        </h2>
        {topEtudiants.length === 0 ? (
          <p className="text-biblio-muted text-sm text-center py-4">
            Pas encore de données.
          </p>
        ) : (
          <div className="space-y-2">
            {topEtudiants.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-6 text-xs font-bold text-biblio-muted text-right shrink-0">
                  #{i + 1}
                </span>
                <span className="text-sm text-biblio-text flex-1 truncate">
                  {s.name}
                </span>
                <div className="flex-1 max-w-xs bg-white/5 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(s.prêts / (topEtudiants[0]?.prêts || 1)) * 100}%`,
                      background: CHART_COLORS[i],
                    }}
                  />
                </div>
                <span className="text-sm font-semibold text-biblio-text w-6 text-right shrink-0">
                  {s.prêts}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
