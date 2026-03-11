import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
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
} from "lucide-react";
import StatCard from "../components/StatCard";
import Papa from "papaparse";

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalLivres: 0,
    livresDisponibles: 0,
    livresEmpruntes: 0,
    totalEtudiants: 0,
    pretsEnCours: 0,
  });
  const [retards, setRetards] = useState([]);
  const [pretsMensuels, setPretsMensuels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);

      // Charger toutes les données en parallèle
      const [livresRes, etudRes, pretsRes] = await Promise.all([
        supabase.from("livres").select("id, titre, isbn, auteur, disponible"),
        supabase.from("etudiants").select("id"),
        supabase
          .from("prets")
          .select("*, livres(titre), etudiants(nom, prenom)"),
      ]);

      if (livresRes.error) throw livresRes.error;
      if (etudRes.error) throw etudRes.error;
      if (pretsRes.error) throw pretsRes.error;

      const livres = livresRes.data || [];
      const etudiants = etudRes.data || [];
      const prets = pretsRes.data || [];

      const disponibles = livres.filter((l) => l.disponible).length;
      const pretsEnCours = prets.filter((p) => !p.rendu);

      setStats({
        totalLivres: livres.length,
        livresDisponibles: disponibles,
        livresEmpruntes: livres.length - disponibles,
        totalEtudiants: etudiants.length,
        pretsEnCours: pretsEnCours.length,
      });

      // Prêts en retard (> 30 jours, non rendus)
      const maintenant = new Date();
      const retardsData = pretsEnCours.filter((p) => {
        const jours = Math.floor(
          (maintenant - new Date(p.date_pret)) / (1000 * 60 * 60 * 24),
        );
        return jours > 30;
      });
      setRetards(retardsData);

      // Statistiques mensuelles (6 derniers mois)
      const moisLabels = [];
      const moisCounts = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const mois = d.toLocaleDateString("fr-FR", {
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
        moisLabels.push(mois);
        moisCounts.push(count);
      }
      setPretsMensuels(
        moisLabels.map((label, i) => ({ label, count: moisCounts[i] })),
      );
    } catch (err) {
      setError("Impossible de charger le tableau de bord : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Export CSV du catalogue
  const handleExportLivres = async () => {
    try {
      const { data, error: err } = await supabase.from("livres").select("*");
      if (err) throw err;

      const csvData = (data || []).map((l) => ({
        ISBN: l.isbn,
        Titre: l.titre,
        Auteur: l.auteur || "",
        Éditeur: l.editeur || "",
        Année: l.annee || "",
        Disponible: l.disponible ? "Oui" : "Non",
        "Date d'ajout": new Date(l.date_ajout).toLocaleDateString("fr-FR"),
      }));

      const csv = Papa.unparse(csvData);
      const blob = new Blob(["\ufeff" + csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `catalogue_livres_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Erreur export : " + err.message);
    }
  };

  // Export CSV des prêts en cours
  const handleExportPrets = async () => {
    try {
      const { data, error: err } = await supabase
        .from("prets")
        .select("*, livres(titre, isbn), etudiants(nom, prenom, email)")
        .eq("rendu", false);
      if (err) throw err;

      const csvData = (data || []).map((p) => ({
        Livre: p.livres?.titre || "",
        ISBN: p.livres?.isbn || "",
        Étudiant: p.etudiants ? `${p.etudiants.prenom} ${p.etudiants.nom}` : "",
        Email: p.etudiants?.email || "",
        "Date de prêt": new Date(p.date_pret).toLocaleDateString("fr-FR"),
        Jours: Math.floor(
          (new Date() - new Date(p.date_pret)) / (1000 * 60 * 60 * 24),
        ),
      }));

      const csv = Papa.unparse(csvData);
      const blob = new Blob(["\ufeff" + csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `prets_en_cours_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Erreur export : " + err.message);
    }
  };

  // Hauteur maximum pour le graphique
  const maxCount = Math.max(...pretsMensuels.map((m) => m.count), 1);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-10 h-10 animate-spin text-biblio-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8 text-biblio-accent" />
            Tableau de bord
          </h1>
          <p className="text-biblio-muted mt-1">
            Vue d'ensemble de la bibliothèque
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportLivres}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export livres
          </button>
          <button
            onClick={handleExportPrets}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export prêts
          </button>
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div className="bg-biblio-danger/10 text-biblio-danger p-4 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Cartes de statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          icon={BookOpen}
          label="Total livres"
          value={stats.totalLivres}
        />
        <StatCard
          icon={BookCheck}
          label="Disponibles"
          value={stats.livresDisponibles}
          color="text-biblio-success"
        />
        <StatCard
          icon={BookX}
          label="Empruntés"
          value={stats.livresEmpruntes}
          color="text-biblio-warning"
        />
        <StatCard
          icon={Users}
          label="Étudiants inscrits"
          value={stats.totalEtudiants}
        />
      </div>

      {/* Graphique des prêts par mois */}
      <div className="bg-biblio-card rounded-xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-biblio-accent" />
          Prêts par mois (6 derniers mois)
        </h2>
        <div className="flex items-end gap-3 h-48">
          {pretsMensuels.map((m, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <span className="text-sm font-medium text-biblio-text">
                {m.count}
              </span>
              <div
                className="w-full bg-biblio-accent/80 rounded-t-lg transition-all"
                style={{
                  height: `${(m.count / maxCount) * 100}%`,
                  minHeight: m.count > 0 ? "8px" : "2px",
                }}
              />
              <span className="text-xs text-biblio-muted">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Prêts en retard */}
      <div className="bg-biblio-card rounded-xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-biblio-danger" />
          Prêts en retard ({retards.length})
        </h2>
        {retards.length === 0 ? (
          <p className="text-biblio-muted text-sm">
            Aucun prêt en retard. Tout est en ordre !
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-2 text-xs font-semibold text-biblio-muted uppercase">
                    Livre
                  </th>
                  <th className="px-4 py-2 text-xs font-semibold text-biblio-muted uppercase">
                    Étudiant
                  </th>
                  <th className="px-4 py-2 text-xs font-semibold text-biblio-muted uppercase">
                    Date de prêt
                  </th>
                  <th className="px-4 py-2 text-xs font-semibold text-biblio-muted uppercase">
                    Retard
                  </th>
                </tr>
              </thead>
              <tbody>
                {retards.map((p) => {
                  const jours = Math.floor(
                    (new Date() - new Date(p.date_pret)) /
                      (1000 * 60 * 60 * 24),
                  );
                  return (
                    <tr key={p.id} className="border-b border-white/5">
                      <td className="px-4 py-3 text-sm">
                        {p.livres?.titre || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-biblio-muted">
                        {p.etudiants
                          ? `${p.etudiants.prenom} ${p.etudiants.nom}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-biblio-muted">
                        {new Date(p.date_pret).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded-full bg-biblio-danger/20 text-biblio-danger">
                          {jours} jours
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
    </div>
  );
}
