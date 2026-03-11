import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { ArrowLeftRight, Loader2, Plus, Download } from "lucide-react";
import PretRow from "../components/PretRow";
import Papa from "papaparse";

export default function Prets() {
  const [prets, setPrets] = useState([]);
  const [livres, setLivres] = useState([]);
  const [etudiants, setEtudiants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedLivre, setSelectedLivre] = useState("");
  const [selectedEtudiant, setSelectedEtudiant] = useState("");
  const [filtre, setFiltre] = useState("en_cours"); // 'en_cours' | 'historique' | 'tous'

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pretsRes, livresRes, etudiantsRes] = await Promise.all([
        supabase
          .from("prets")
          .select("*, livres(titre), etudiants(nom, prenom)")
          .order("date_pret", { ascending: false }),
        supabase
          .from("livres")
          .select("id, titre, isbn")
          .eq("disponible", true),
        supabase.from("etudiants").select("id, nom, prenom, numero_etudiant"),
      ]);

      if (pretsRes.error) throw pretsRes.error;
      if (livresRes.error) throw livresRes.error;
      if (etudiantsRes.error) throw etudiantsRes.error;

      setPrets(pretsRes.data || []);
      setLivres(livresRes.data || []);
      setEtudiants(etudiantsRes.data || []);
    } catch (err) {
      setError("Impossible de charger les données : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Créer un nouveau prêt
  const handleCreatePret = async (e) => {
    e.preventDefault();
    if (!selectedLivre || !selectedEtudiant) return;

    try {
      // Insérer le prêt
      const { error: err1 } = await supabase
        .from("prets")
        .insert([{ livre_id: selectedLivre, etudiant_id: selectedEtudiant }]);
      if (err1) throw err1;

      // Marquer le livre comme emprunté
      const { error: err2 } = await supabase
        .from("livres")
        .update({ disponible: false })
        .eq("id", selectedLivre);
      if (err2) throw err2;

      setShowForm(false);
      setSelectedLivre("");
      setSelectedEtudiant("");
      setError("");
      await fetchData();
    } catch (err) {
      setError("Erreur lors du prêt : " + err.message);
    }
  };

  // Retourner un livre
  const handleReturn = async (pretId, livreId) => {
    try {
      // Marquer le prêt comme rendu
      const { error: err1 } = await supabase
        .from("prets")
        .update({ rendu: true, date_retour: new Date().toISOString() })
        .eq("id", pretId);
      if (err1) throw err1;

      // Remettre le livre en disponible
      const { error: err2 } = await supabase
        .from("livres")
        .update({ disponible: true })
        .eq("id", livreId);
      if (err2) throw err2;

      await fetchData();
    } catch (err) {
      setError("Erreur lors du retour : " + err.message);
    }
  };

  // Export CSV des prêts en cours
  const handleExportCSV = () => {
    const pretsEnCours = prets.filter((p) => !p.rendu);
    const csvData = pretsEnCours.map((p) => ({
      Livre: p.livres?.titre || "",
      Étudiant: p.etudiants ? `${p.etudiants.prenom} ${p.etudiants.nom}` : "",
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
  };

  // Filtrer les prêts
  const pretsFiltres = prets.filter((p) => {
    if (filtre === "en_cours") return !p.rendu;
    if (filtre === "historique") return p.rendu;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ArrowLeftRight className="w-8 h-8 text-biblio-accent" />
            Gestion des prêts
          </h1>
          <p className="text-biblio-muted mt-1">
            {prets.filter((p) => !p.rendu).length} prêt
            {prets.filter((p) => !p.rendu).length !== 1 ? "s" : ""} en cours
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-5 py-2.5 bg-biblio-accent hover:bg-biblio-accent-hover text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nouveau prêt
          </button>
        </div>
      </div>

      {/* Formulaire nouveau prêt */}
      {showForm && (
        <form
          onSubmit={handleCreatePret}
          className="bg-biblio-card rounded-xl border border-white/10 p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold">Nouveau prêt</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select
              value={selectedLivre}
              onChange={(e) => setSelectedLivre(e.target.value)}
              required
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-biblio-text focus:outline-none focus:ring-2 focus:ring-biblio-accent"
            >
              <option value="">-- Choisir un livre disponible --</option>
              {livres.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.titre} (ISBN: {l.isbn})
                </option>
              ))}
            </select>
            <select
              value={selectedEtudiant}
              onChange={(e) => setSelectedEtudiant(e.target.value)}
              required
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-biblio-text focus:outline-none focus:ring-2 focus:ring-biblio-accent"
            >
              <option value="">-- Choisir un étudiant --</option>
              {etudiants.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.prenom} {e.nom} ({e.numero_etudiant || "sans numéro"})
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="px-5 py-2.5 bg-biblio-success hover:bg-biblio-success/80 text-white rounded-lg font-medium transition-colors"
            >
              Confirmer le prêt
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg font-medium transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Erreur */}
      {error && (
        <div className="bg-biblio-danger/10 text-biblio-danger p-4 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-2">
        {[
          { key: "en_cours", label: "En cours" },
          { key: "historique", label: "Historique" },
          { key: "tous", label: "Tous" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFiltre(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filtre === key
                ? "bg-biblio-accent text-white"
                : "bg-white/5 text-biblio-muted hover:bg-white/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tableau des prêts */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-biblio-accent" />
        </div>
      ) : pretsFiltres.length === 0 ? (
        <div className="text-center py-12 text-biblio-muted">
          Aucun prêt à afficher.
        </div>
      ) : (
        <div className="bg-biblio-card rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 text-xs font-semibold text-biblio-muted uppercase tracking-wider">
                    Livre
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-biblio-muted uppercase tracking-wider">
                    Étudiant
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-biblio-muted uppercase tracking-wider">
                    Date de prêt
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-biblio-muted uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-biblio-muted uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {pretsFiltres.map((pret) => (
                  <PretRow key={pret.id} pret={pret} onReturn={handleReturn} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
