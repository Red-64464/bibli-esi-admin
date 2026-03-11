import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { BookOpen, Loader2, Search, Download, X, Save, Pencil, AlertCircle } from "lucide-react";
import SearchISBN from "../components/SearchISBN";
import LivreCard from "../components/LivreCard";
import ExportModal from "../components/ExportModal";
import { exportCSV, exportJSON, exportExcel } from "../lib/exports";

const STATUTS_LIVRE = [
  { value: "disponible", label: "Disponible", color: "text-biblio-success" },
  { value: "emprunté", label: "Emprunté", color: "text-biblio-warning" },
  { value: "réservé", label: "Réservé", color: "text-biblio-accent" },
  { value: "perdu", label: "Perdu", color: "text-biblio-danger" },
  { value: "en réparation", label: "En réparation", color: "text-biblio-muted" },
];

const INPUT_CLASS =
  "bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent w-full text-sm";

export default function Livres() {
  const [livres, setLivres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("tous");
  const [editLivre, setEditLivre] = useState(null); // livre en cours d'édition
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [historique, setHistorique] = useState(null); // { livreId, data }

  useEffect(() => {
    fetchLivres();
  }, []);

  const fetchLivres = async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("livres")
        .select("*")
        .order("date_ajout", { ascending: false });
      if (err) throw err;
      setLivres(data || []);
    } catch (err) {
      setError("Impossible de charger les livres : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBook = async (bookData) => {
    try {
      const { error: err } = await supabase.from("livres").insert([{
        ...bookData,
        statut: "disponible",
        disponible: true,
        nb_exemplaires: 1,
      }]);
      if (err) {
        if (err.code === "23505") setError("Ce livre (ISBN) existe déjà dans la base.");
        else throw err;
        return;
      }
      setError("");
      await fetchLivres();
    } catch (err) {
      setError("Erreur lors de l'ajout : " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce livre ?")) return;
    try {
      const { error: err } = await supabase.from("livres").delete().eq("id", id);
      if (err) throw err;
      setLivres((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      setError("Erreur lors de la suppression : " + err.message);
    }
  };

  const openEdit = (livre) => {
    setEditLivre(livre);
    setEditForm({
      titre: livre.titre || "",
      auteur: livre.auteur || "",
      isbn: livre.isbn || "",
      editeur: livre.editeur || "",
      annee: livre.annee || "",
      langue: livre.langue || "",
      categorie: livre.categorie || "",
      tags: Array.isArray(livre.tags) ? livre.tags.join(", ") : (livre.tags || ""),
      resume: livre.resume || "",
      description: livre.description || "",
      emplacement: livre.emplacement || "",
      nb_exemplaires: livre.nb_exemplaires ?? 1,
      statut: livre.statut || (livre.disponible ? "disponible" : "emprunté"),
      couverture_url: livre.couverture_url || "",
    });
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editLivre) return;
    setEditLoading(true);
    try {
      const statut = editForm.statut;
      const disponible = statut === "disponible";
      const tagsArray = editForm.tags
        ? editForm.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [];
      const updateData = {
        ...editForm,
        tags: tagsArray,
        disponible,
        nb_exemplaires: Number(editForm.nb_exemplaires) || 1,
      };
      const { error: err } = await supabase
        .from("livres")
        .update(updateData)
        .eq("id", editLivre.id);
      if (err) throw err;
      setEditLivre(null);
      await fetchLivres();
    } catch (err) {
      setError("Erreur lors de la modification : " + err.message);
    } finally {
      setEditLoading(false);
    }
  };

  const openHistorique = async (livre) => {
    try {
      const { data, error: err } = await supabase
        .from("prets")
        .select("*, etudiants(nom, prenom)")
        .eq("livre_id", livre.id)
        .order("date_pret", { ascending: false });
      if (err) throw err;
      setHistorique({ livre, data: data || [] });
    } catch (err) {
      setError("Impossible de charger l'historique : " + err.message);
    }
  };

  const handleExport = async (format) => {
    const { data } = await supabase.from("livres").select("*");
    const rows = (data || []).map((l) => ({
      ISBN: l.isbn, Titre: l.titre, Auteur: l.auteur || "",
      Éditeur: l.editeur || "", Année: l.annee || "", Langue: l.langue || "",
      Catégorie: l.categorie || "", Tags: Array.isArray(l.tags) ? l.tags.join(", ") : "",
      Statut: l.statut || (l.disponible ? "disponible" : "emprunté"),
      Emplacement: l.emplacement || "", Exemplaires: l.nb_exemplaires || 1,
      "Date d'ajout": new Date(l.date_ajout).toLocaleDateString("fr-FR"),
    }));
    const filename = `catalogue_livres_${new Date().toISOString().slice(0, 10)}`;
    if (format === "csv") exportCSV(rows, filename);
    else if (format === "excel") exportExcel(rows, filename, "Livres");
    else exportJSON(rows, filename);
  };

  const livresFiltres = livres.filter((l) => {
    const q = recherche.toLowerCase();
    const matchSearch =
      l.titre?.toLowerCase().includes(q) ||
      l.auteur?.toLowerCase().includes(q) ||
      l.isbn?.includes(q) ||
      l.categorie?.toLowerCase().includes(q);
    if (filtreStatut === "tous") return matchSearch;
    const s = l.statut || (l.disponible ? "disponible" : "emprunté");
    return matchSearch && s === filtreStatut;
  });

  const getStatutBadge = (statut) => {
    const s = STATUTS_LIVRE.find((x) => x.value === statut) || STATUTS_LIVRE[0];
    return s.label;
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-biblio-accent" />
            Gestion des livres
          </h1>
          <p className="text-biblio-muted mt-1">
            {livres.length} livre{livres.length !== 1 ? "s" : ""} dans le catalogue
          </p>
        </div>
        <button
          onClick={() => setShowExportModal(true)}
          className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
        >
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      <SearchISBN onBookFound={handleAddBook} />

      {error && (
        <div className="bg-biblio-danger/10 text-biblio-danger p-4 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {/* Recherche + filtres statut */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-biblio-muted" />
          <input
            type="text"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher (titre, auteur, ISBN, catégorie)..."
            className="w-full bg-biblio-card border border-white/10 rounded-lg pl-10 pr-4 py-3 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[{ value: "tous", label: "Tous" }, ...STATUTS_LIVRE].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFiltreStatut(value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                filtreStatut === value
                  ? "bg-biblio-accent text-white"
                  : "bg-white/5 text-biblio-muted hover:bg-white/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grille de livres */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-biblio-accent" />
        </div>
      ) : livresFiltres.length === 0 ? (
        <div className="text-center py-12 text-biblio-muted">
          {recherche || filtreStatut !== "tous"
            ? "Aucun livre ne correspond à votre recherche."
            : "Aucun livre dans le catalogue. Ajoutez-en un par ISBN !"}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {livresFiltres.map((livre) => (
            <LivreCard
              key={livre.id}
              livre={livre}
              onDelete={handleDelete}
              onEdit={openEdit}
              onHistorique={openHistorique}
            />
          ))}
        </div>
      )}

      {/* Modal édition livre */}
      {editLivre && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4">
          <div className="bg-biblio-card rounded-2xl border border-white/10 w-full max-w-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Pencil className="w-5 h-5 text-biblio-accent" /> Modifier le livre
              </h2>
              <button onClick={() => setEditLivre(null)} className="text-biblio-muted hover:text-biblio-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSave} className="p-6 space-y-5">
              {/* Couverture preview */}
              {editForm.couverture_url && (
                <div className="flex justify-center">
                  <img src={editForm.couverture_url} alt="" className="h-36 object-contain rounded" />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-biblio-muted block mb-1">Titre *</label>
                  <input required value={editForm.titre} onChange={(e) => setEditForm({ ...editForm, titre: e.target.value })} placeholder="Titre" className={INPUT_CLASS} />
                </div>
                <div>
                  <label className="text-xs font-medium text-biblio-muted block mb-1">Auteur</label>
                  <input value={editForm.auteur} onChange={(e) => setEditForm({ ...editForm, auteur: e.target.value })} placeholder="Auteur" className={INPUT_CLASS} />
                </div>
                <div>
                  <label className="text-xs font-medium text-biblio-muted block mb-1">ISBN</label>
                  <input value={editForm.isbn} onChange={(e) => setEditForm({ ...editForm, isbn: e.target.value })} placeholder="ISBN" className={INPUT_CLASS} />
                </div>
                <div>
                  <label className="text-xs font-medium text-biblio-muted block mb-1">Éditeur</label>
                  <input value={editForm.editeur} onChange={(e) => setEditForm({ ...editForm, editeur: e.target.value })} placeholder="Éditeur" className={INPUT_CLASS} />
                </div>
                <div>
                  <label className="text-xs font-medium text-biblio-muted block mb-1">Année</label>
                  <input value={editForm.annee} onChange={(e) => setEditForm({ ...editForm, annee: e.target.value })} placeholder="Année" className={INPUT_CLASS} />
                </div>
                <div>
                  <label className="text-xs font-medium text-biblio-muted block mb-1">Langue</label>
                  <input value={editForm.langue} onChange={(e) => setEditForm({ ...editForm, langue: e.target.value })} placeholder="ex: Français, Anglais…" className={INPUT_CLASS} />
                </div>
                <div>
                  <label className="text-xs font-medium text-biblio-muted block mb-1">Catégorie</label>
                  <input value={editForm.categorie} onChange={(e) => setEditForm({ ...editForm, categorie: e.target.value })} placeholder="ex: Informatique, Roman…" className={INPUT_CLASS} />
                </div>
                <div>
                  <label className="text-xs font-medium text-biblio-muted block mb-1">Tags (séparés par des virgules)</label>
                  <input value={editForm.tags} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })} placeholder="ex: algorithme, python, débutant" className={INPUT_CLASS} />
                </div>
                <div>
                  <label className="text-xs font-medium text-biblio-muted block mb-1">Emplacement</label>
                  <input value={editForm.emplacement} onChange={(e) => setEditForm({ ...editForm, emplacement: e.target.value })} placeholder="ex: Étagère A3, Rayon 2…" className={INPUT_CLASS} />
                </div>
                <div>
                  <label className="text-xs font-medium text-biblio-muted block mb-1">Nb. exemplaires</label>
                  <input type="number" min="1" value={editForm.nb_exemplaires} onChange={(e) => setEditForm({ ...editForm, nb_exemplaires: e.target.value })} className={INPUT_CLASS} />
                </div>
                <div>
                  <label className="text-xs font-medium text-biblio-muted block mb-1">Statut</label>
                  <select value={editForm.statut} onChange={(e) => setEditForm({ ...editForm, statut: e.target.value })} className={INPUT_CLASS}>
                    {STATUTS_LIVRE.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-biblio-muted block mb-1">URL couverture</label>
                  <input value={editForm.couverture_url} onChange={(e) => setEditForm({ ...editForm, couverture_url: e.target.value })} placeholder="https://…" className={INPUT_CLASS} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-biblio-muted block mb-1">Résumé</label>
                  <textarea rows={3} value={editForm.resume} onChange={(e) => setEditForm({ ...editForm, resume: e.target.value })} placeholder="Résumé du livre…" className={INPUT_CLASS + " resize-none"} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-biblio-muted block mb-1">Description</label>
                  <textarea rows={3} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Description détaillée…" className={INPUT_CLASS + " resize-none"} />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 py-2.5 bg-biblio-accent hover:bg-biblio-accent-hover disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {editLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={() => setEditLivre(null)}
                  className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg font-medium transition-colors"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal historique */}
      {historique && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-biblio-card rounded-2xl border border-white/10 w-full max-w-xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
              <h2 className="text-base font-semibold">Historique — {historique.livre.titre}</h2>
              <button onClick={() => setHistorique(null)} className="text-biblio-muted hover:text-biblio-text">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-96 overflow-y-auto">
              {historique.data.length === 0 ? (
                <p className="text-sm text-biblio-muted text-center py-4">Aucun prêt enregistré pour ce livre.</p>
              ) : (
                <div className="space-y-3">
                  {historique.data.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-sm border-b border-white/5 pb-3">
                      <div>
                        <p>{p.etudiants ? `${p.etudiants.prenom} ${p.etudiants.nom}` : "—"}</p>
                        <p className="text-xs text-biblio-muted">{new Date(p.date_pret).toLocaleDateString("fr-FR")}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${p.rendu ? "bg-biblio-success/20 text-biblio-success" : "bg-biblio-warning/20 text-biblio-warning"}`}>
                        {p.rendu ? "Rendu" : "En cours"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showExportModal && (
        <ExportModal
          title="Exporter le catalogue"
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
        />
      )}
    </div>
  );
}
