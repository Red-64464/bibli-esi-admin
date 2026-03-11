import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { logActivity } from "../lib/activityLog";
import { useAuth } from "../contexts/AuthContext";
import {
  ArrowLeftRight,
  Loader2,
  Plus,
  Download,
  AlertCircle,
} from "lucide-react";
import PretRow, { PretCard } from "../components/PretRow";
import ExportModal from "../components/ExportModal";
import { exportCSV, exportJSON, exportExcel } from "../lib/exports";

const INPUT_CLASS =
  "bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent";

const getPretStatut = (p) => {
  if (p.statut && p.statut !== "en_cours") return p.statut;
  if (p.rendu) return "retourné";
  const ref = p.date_retour_prevue
    ? new Date(p.date_retour_prevue)
    : new Date(new Date(p.date_pret).getTime() + 30 * 24 * 60 * 60 * 1000);
  return new Date() > ref ? "en_retard" : "en_cours";
};

export default function Prets() {
  const { session } = useAuth();
  const [prets, setPrets] = useState([]);
  const [livres, setLivres] = useState([]);
  const [etudiants, setEtudiants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [filtre, setFiltre] = useState("en_cours");
  const [showExportModal, setShowExportModal] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const defaultRetour = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const defaultRappel = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [form, setForm] = useState({
    livre_id: "",
    etudiant_id: "",
    date_pret: today,
    date_retour_prevue: defaultRetour,
    date_rappel: defaultRappel,
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pretsRes, livresRes, etudiantsRes] = await Promise.all([
        supabase
          .from("prets")
          .select("*, livres(titre, isbn), etudiants(nom, prenom)")
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

  const handleCreatePret = async (e) => {
    e.preventDefault();
    if (!form.livre_id || !form.etudiant_id) return;
    try {
      const { error: err1 } = await supabase.from("prets").insert([
        {
          livre_id: form.livre_id,
          etudiant_id: form.etudiant_id,
          date_pret: form.date_pret,
          date_retour_prevue: form.date_retour_prevue || null,
          date_rappel: form.date_rappel || null,
          notes: form.notes,
          statut: "en_cours",
          rendu: false,
        },
      ]);
      if (err1) throw err1;

      const { error: err2 } = await supabase
        .from("livres")
        .update({ disponible: false, statut: "emprunté" })
        .eq("id", form.livre_id);
      if (err2) throw err2;

      // Journaliser l'activité
      const livreNom =
        livres.find((l) => l.id === form.livre_id)?.titre || form.livre_id;
      const etudNom = etudiants.find((e) => e.id === form.etudiant_id);
      await logActivity({
        action_type: "pret_cree",
        description: `${etudNom ? `${etudNom.prenom} ${etudNom.nom}` : "Étudiant"} a emprunté « ${livreNom} »`,
        user_info: session?.username || "",
      });

      setShowForm(false);
      setForm({
        livre_id: "",
        etudiant_id: "",
        date_pret: today,
        date_retour_prevue: defaultRetour,
        date_rappel: defaultRappel,
        notes: "",
      });
      setError("");
      await fetchData();
    } catch (err) {
      setError("Erreur lors du prêt : " + err.message);
    }
  };

  const handleReturn = async (pretId, livreId) => {
    try {
      const { error: err1 } = await supabase
        .from("prets")
        .update({
          rendu: true,
          date_retour: new Date().toISOString(),
          statut: "retourné",
        })
        .eq("id", pretId);
      if (err1) throw err1;
      const { error: err2 } = await supabase
        .from("livres")
        .update({ disponible: true, statut: "disponible" })
        .eq("id", livreId);
      if (err2) throw err2;

      // Journaliser le retour
      const pret = prets.find((p) => p.id === pretId);
      await logActivity({
        action_type: "pret_retourne",
        description: `Livre « ${pret?.livres?.titre || "—"} » retourné${pret?.etudiants ? ` par ${pret.etudiants.prenom} ${pret.etudiants.nom}` : ""}`,
        user_info: session?.username || "",
      });

      await fetchData();
    } catch (err) {
      setError("Erreur lors du retour : " + err.message);
    }
  };

  const handleExport = async (format) => {
    const { data } = await supabase
      .from("prets")
      .select("*, livres(titre, isbn), etudiants(nom, prenom, email)");
    const rows = (data || []).map((p) => ({
      Livre: p.livres?.titre || "",
      ISBN: p.livres?.isbn || "",
      Étudiant: p.etudiants ? `${p.etudiants.prenom} ${p.etudiants.nom}` : "",
      Email: p.etudiants?.email || "",
      "Date de prêt": new Date(p.date_pret).toLocaleDateString("fr-FR"),
      "Retour prévu": p.date_retour_prevue
        ? new Date(p.date_retour_prevue).toLocaleDateString("fr-FR")
        : "—",
      Rappel: p.date_rappel
        ? new Date(p.date_rappel).toLocaleDateString("fr-FR")
        : "—",
      Statut: getPretStatut(p),
      Notes: p.notes || "",
    }));
    const filename = `prets_${new Date().toISOString().slice(0, 10)}`;
    if (format === "csv") exportCSV(rows, filename);
    else if (format === "excel") exportExcel(rows, filename, "Prêts");
    else exportJSON(rows, filename);
  };

  const pretsFiltres = prets.filter((p) => {
    const s = getPretStatut(p);
    if (filtre === "en_cours") return s === "en_cours";
    if (filtre === "en_retard") return s === "en_retard";
    if (filtre === "historique") return s === "retourné";
    return true;
  });

  const pretsEnRetardCount = prets.filter(
    (p) => getPretStatut(p) === "en_retard",
  ).length;

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
            {pretsEnRetardCount > 0 && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-biblio-danger/20 text-biblio-danger font-medium">
                {pretsEnRetardCount} en retard
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowExportModal(true)}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-5 py-2.5 bg-biblio-accent hover:bg-biblio-accent-hover text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> Nouveau prêt
          </button>
        </div>
      </div>

      {/* Formulaire nouveau prêt */}
      {showForm && (
        <form
          onSubmit={handleCreatePret}
          className="bg-biblio-card rounded-xl border border-white/10 p-6 space-y-5"
        >
          <h2 className="text-lg font-semibold">Nouveau prêt</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-biblio-muted block mb-1">
                Livre disponible *
              </label>
              <select
                value={form.livre_id}
                onChange={(e) => setForm({ ...form, livre_id: e.target.value })}
                required
                className={INPUT_CLASS + " w-full"}
                style={{ colorScheme: "dark" }}
              >
                <option value="">-- Choisir un livre --</option>
                {livres.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.titre} (ISBN: {l.isbn})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-biblio-muted block mb-1">
                Étudiant *
              </label>
              <select
                value={form.etudiant_id}
                onChange={(e) =>
                  setForm({ ...form, etudiant_id: e.target.value })
                }
                required
                className={INPUT_CLASS + " w-full"}
                style={{ colorScheme: "dark" }}
              >
                <option value="">-- Choisir un étudiant --</option>
                {etudiants.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.prenom} {e.nom} ({e.numero_etudiant || "sans numéro"})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-biblio-muted block mb-1">
                Date du prêt
              </label>
              <input
                type="date"
                value={form.date_pret}
                onChange={(e) =>
                  setForm({ ...form, date_pret: e.target.value })
                }
                className={INPUT_CLASS + " w-full"}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-biblio-muted block mb-1">
                Date de retour prévue
              </label>
              <input
                type="date"
                value={form.date_retour_prevue}
                onChange={(e) =>
                  setForm({ ...form, date_retour_prevue: e.target.value })
                }
                className={INPUT_CLASS + " w-full"}
                min={form.date_pret}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-biblio-muted block mb-1">
                Date de rappel
              </label>
              <input
                type="date"
                value={form.date_rappel}
                onChange={(e) =>
                  setForm({ ...form, date_rappel: e.target.value })
                }
                className={INPUT_CLASS + " w-full"}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-biblio-muted block mb-1">
                Notes
              </label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notes sur le prêt…"
                className={INPUT_CLASS + " w-full resize-none"}
              />
            </div>
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

      {error && (
        <div className="bg-biblio-danger/10 text-biblio-danger p-4 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "en_cours", label: "En cours" },
          {
            key: "en_retard",
            label: `En retard${pretsEnRetardCount > 0 ? ` (${pretsEnRetardCount})` : ""}`,
          },
          { key: "historique", label: "Retournés" },
          { key: "tous", label: "Tous" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFiltre(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filtre === key
                ? key === "en_retard"
                  ? "bg-biblio-danger text-white"
                  : "bg-biblio-accent text-white"
                : "bg-white/5 text-biblio-muted hover:bg-white/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tableau */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-biblio-accent" />
        </div>
      ) : pretsFiltres.length === 0 ? (
        <div className="text-center py-12 text-biblio-muted">
          Aucun prêt à afficher.
        </div>
      ) : (
        <>
          {/* Desktop : tableau */}
          <div className="hidden md:block bg-biblio-card rounded-xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    {[
                      "Livre",
                      "Étudiant",
                      "Date prêt",
                      "Retour prévu",
                      "Statut",
                      "Action",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-xs font-semibold text-biblio-muted uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pretsFiltres.map((pret) => (
                    <PretRow
                      key={pret.id}
                      pret={pret}
                      onReturn={handleReturn}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile : cartes */}
          <div className="md:hidden space-y-3">
            {pretsFiltres.map((pret) => (
              <PretCard key={pret.id} pret={pret} onReturn={handleReturn} />
            ))}
          </div>
        </>
      )}

      {showExportModal && (
        <ExportModal
          title="Exporter les prêts"
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
        />
      )}
    </div>
  );
}
