import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { logActivity } from "../lib/activityLog";
import { useAuth } from "../contexts/AuthContext";
import {
  BookOpen,
  Loader2,
  Search,
  Download,
  X,
  Save,
  Pencil,
  AlertCircle,
  ImagePlus,
  PlusCircle,
  Camera,
  QrCode,
} from "lucide-react";
import SearchISBN from "../components/SearchISBN";
import ISBNScanner from "../components/ISBNScanner";
import QRCodeModal from "../components/QRCodeModal";
import LivreCard from "../components/LivreCard";
import ExportModal from "../components/ExportModal";
import { exportCSV, exportJSON, exportExcel } from "../lib/exports";

const STATUTS_LIVRE = [
  { value: "disponible", label: "Disponible" },
  { value: "emprunte", label: "Emprunté" },
  { value: "reserve", label: "Réservé" },
  { value: "perdu", label: "Perdu" },
  { value: "en_reparation", label: "En réparation" },
];

// Maps internal DB value → display label
const STATUT_LABEL = Object.fromEntries(
  STATUTS_LIVRE.map((s) => [s.value, s.label]),
);

// Normalise any legacy value to the internal key
const normaliseStatut = (raw) => {
  if (!raw) return "disponible";
  const map = {
    disponible: "disponible",
    emprunté: "emprunte",
    emprunte: "emprunte",
    réservé: "reserve",
    reserve: "reserve",
    perdu: "perdu",
    "en réparation": "en_reparation",
    en_reparation: "en_reparation",
  };
  return map[raw.toLowerCase()] ?? raw;
};

const INPUT_CLASS =
  "bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent w-full text-sm";

const emptyManualForm = {
  titre: "",
  auteur: "",
  isbn: "",
  editeur: "",
  annee: "",
  langue: "",
  categorie: "",
  tags: "",
  emplacement: "",
  nb_exemplaires: 1,
  statut: "disponible",
  couverture_url: "",
  resume: "",
  description: "",
};

// Small reusable image drop-zone
function ImageUploadZone({
  preview,
  onFileChange,
  label = "Cliquer pour ajouter (PNG, JPG…)",
}) {
  return (
    <div>
      {preview ? (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Aperçu"
            className="h-32 object-contain rounded-lg border border-white/10"
          />
          <button
            type="button"
            onClick={() => onFileChange(null)}
            className="absolute -top-2 -right-2 bg-biblio-danger rounded-full p-0.5"
          >
            <X className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-2 h-24 w-48 border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:border-biblio-accent/50 hover:bg-biblio-accent/5 transition-colors">
          <ImagePlus className="w-6 h-6 text-biblio-muted" />
          <span className="text-xs text-biblio-muted text-center px-2">
            {label}
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files[0];
              if (file) onFileChange(file);
            }}
          />
        </label>
      )}
    </div>
  );
}

// Defined OUTSIDE the component so React doesn't remount inputs on every keystroke
function Field({ label, children, col2 = false }) {
  return (
    <div className={col2 ? "sm:col-span-2" : ""}>
      <label className="text-xs font-medium text-biblio-muted block mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function Livres() {
  const { session } = useAuth();
  const [livres, setLivres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("tous");

  // Edit modal
  const [editLivre, setEditLivre] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState(null);

  // Manual add modal
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState(emptyManualForm);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualImageFile, setManualImageFile] = useState(null);
  const [manualImagePreview, setManualImagePreview] = useState(null);

  // History modal
  const [historique, setHistorique] = useState(null);

  // Camera scanner
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [scannedIsbn, setScannedIsbn] = useState(null);

  // QR code modal
  const [qrLivre, setQrLivre] = useState(null);

  const [showExportModal, setShowExportModal] = useState(false);

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

  // Upload to Supabase Storage bucket "covers" (must be public)
  const uploadCover = async (file) => {
    const ext = file.name.split(".").pop().toLowerCase();
    const filename = `cover_${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("covers")
      .upload(filename, file, { upsert: true });
    if (error)
      throw new Error(
        "Upload image échoué : " +
          error.message +
          " (créez un bucket public nommé 'covers' dans Supabase Storage)",
      );
    const { data } = supabase.storage.from("covers").getPublicUrl(filename);
    return data.publicUrl;
  };

  // Add book via ISBN (called by SearchISBN or camera scanner)
  const handleAddBook = async (bookData) => {
    try {
      const { error: err } = await supabase.from("livres").insert([
        {
          ...bookData,
          statut: "disponible",
          disponible: true,
          nb_exemplaires: 1,
        },
      ]);
      if (err) {
        if (err.code === "23505")
          setError("Ce livre (ISBN) existe déjà dans la base.");
        else throw err;
        return;
      }
      await logActivity({
        action_type: "livre_ajoute",
        description: `Livre « ${bookData.titre} » ajouté (ISBN: ${bookData.isbn || "—"})`,
        user_info: session?.username || "",
      });
      setError("");
      await fetchLivres();
    } catch (err) {
      setError("Erreur lors de l'ajout : " + err.message);
    }
  };

  // Camera scan handler: receives raw decoded text (ISBN or QR value)
  const handleCameraScan = async (raw) => {
    setShowCameraScanner(false);
    // If it's a BiblioGest QR code (bibliogest://livre/UUID), open the book
    if (raw.startsWith("bibliogest://livre/")) {
      const id = raw.replace("bibliogest://livre/", "");
      const found = livres.find((l) => l.id === id);
      if (found) {
        openEdit(found);
        return;
      }
    }
    // Otherwise treat as ISBN
    const cleanIsbn = raw.replace(/[-\s]/g, "").trim();
    setScannedIsbn(cleanIsbn);
  };

  // Add book manually
  const handleManualAdd = async (e) => {
    e.preventDefault();
    if (!manualForm.titre.trim()) return;
    setManualLoading(true);
    setError("");
    try {
      let couverture_url = manualForm.couverture_url;
      if (manualImageFile) couverture_url = await uploadCover(manualImageFile);

      const tagsArray = manualForm.tags
        ? manualForm.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

      const { error: err } = await supabase.from("livres").insert([
        {
          titre: manualForm.titre.trim(),
          auteur: manualForm.auteur || null,
          isbn: manualForm.isbn || null,
          editeur: manualForm.editeur || null,
          annee: manualForm.annee || null,
          langue: manualForm.langue || null,
          categorie: manualForm.categorie || null,
          tags: tagsArray,
          emplacement: manualForm.emplacement || null,
          nb_exemplaires: Number(manualForm.nb_exemplaires) || 1,
          statut: manualForm.statut,
          disponible: manualForm.statut === "disponible",
          couverture_url: couverture_url || null,
          resume: manualForm.resume || null,
          description: manualForm.description || null,
        },
      ]);
      if (err) throw err;
      setShowManualForm(false);
      setManualForm(emptyManualForm);
      setManualImageFile(null);
      setManualImagePreview(null);
      await logActivity({
        action_type: "livre_ajoute",
        description: `Livre « ${manualForm.titre.trim()} » ajouté manuellement`,
        user_info: session?.username || "",
      });
      await fetchLivres();
    } catch (err) {
      setError("Erreur lors de l'ajout manuel : " + err.message);
    } finally {
      setManualLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce livre ?"))
      return;
    try {
      const livre = livres.find((l) => l.id === id);
      const { error: err } = await supabase
        .from("livres")
        .delete()
        .eq("id", id);
      if (err) throw err;
      await logActivity({
        action_type: "livre_supprime",
        description: `Livre « ${livre?.titre || id} » supprimé`,
        user_info: session?.username || "",
      });
      setLivres((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      setError("Erreur lors de la suppression : " + err.message);
    }
  };

  const openEdit = (livre) => {
    setEditLivre(livre);
    setEditImageFile(null);
    setEditImagePreview(null);
    setEditForm({
      titre: livre.titre || "",
      auteur: livre.auteur || "",
      isbn: livre.isbn || "",
      editeur: livre.editeur || "",
      annee: livre.annee || "",
      langue: livre.langue || "",
      categorie: livre.categorie || "",
      tags: Array.isArray(livre.tags)
        ? livre.tags.join(", ")
        : livre.tags || "",
      resume: livre.resume || "",
      description: livre.description || "",
      emplacement: livre.emplacement || "",
      nb_exemplaires: livre.nb_exemplaires ?? 1,
      statut: normaliseStatut(
        livre.statut || (livre.disponible ? "disponible" : "emprunte"),
      ),
      couverture_url: livre.couverture_url || "",
    });
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editLivre) return;
    setEditLoading(true);
    setError("");
    try {
      let couverture_url = editForm.couverture_url;
      if (editImageFile) couverture_url = await uploadCover(editImageFile);

      const statut = editForm.statut;
      const disponible = statut === "disponible";
      const tagsArray = editForm.tags
        ? editForm.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

      const updateData = {
        titre: editForm.titre,
        auteur: editForm.auteur || null,
        isbn: editForm.isbn || null,
        editeur: editForm.editeur || null,
        annee: editForm.annee || null,
        couverture_url: couverture_url || null,
        disponible,
        langue: editForm.langue || null,
        categorie: editForm.categorie || null,
        tags: tagsArray,
        emplacement: editForm.emplacement || null,
        nb_exemplaires: Number(editForm.nb_exemplaires) || 1,
        statut,
        resume: editForm.resume || null,
        description: editForm.description || null,
      };

      const { error: err } = await supabase
        .from("livres")
        .update(updateData)
        .eq("id", editLivre.id);
      if (err) throw err;

      await logActivity({
        action_type: "livre_modifie",
        description: `Livre « ${editForm.titre} » modifié`,
        user_info: session?.username || "",
      });

      setEditLivre(null);
      setEditImageFile(null);
      setEditImagePreview(null);
      await fetchLivres();
    } catch (err) {
      const msg = err?.message || String(err);
      if (
        msg.includes("NetworkError") ||
        msg.includes("Failed to fetch") ||
        msg.includes("column")
      ) {
        setError(
          "Erreur de mise à jour — Assurez-vous d'avoir exécuté le script src/sql/migration.sql dans Supabase.",
        );
      } else {
        setError("Erreur lors de la modification : " + msg);
      }
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
      ISBN: l.isbn,
      Titre: l.titre,
      Auteur: l.auteur || "",
      Editeur: l.editeur || "",
      Annee: l.annee || "",
      Langue: l.langue || "",
      Categorie: l.categorie || "",
      Tags: Array.isArray(l.tags) ? l.tags.join(", ") : "",
      Statut:
        STATUT_LABEL[l.statut] ||
        l.statut ||
        (l.disponible ? "Disponible" : "Emprunté"),
      Emplacement: l.emplacement || "",
      Exemplaires: l.nb_exemplaires || 1,
      "Date ajout": l.date_ajout
        ? new Date(l.date_ajout).toLocaleDateString("fr-FR")
        : "",
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
    const s = normaliseStatut(
      l.statut || (l.disponible ? "disponible" : "emprunte"),
    );
    return matchSearch && s === filtreStatut;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-biblio-accent" />
            Gestion des livres
          </h1>
          <p className="text-biblio-muted mt-1">
            {livres.length} livre{livres.length !== 1 ? "s" : ""} dans le
            catalogue
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowExportModal(true)}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          <button
            onClick={() => setShowCameraScanner(true)}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
          >
            <Camera className="w-4 h-4" /> Scanner ISBN
          </button>
          <button
            onClick={() => setShowManualForm(true)}
            className="px-4 py-2.5 bg-biblio-accent hover:bg-biblio-accent-hover text-white rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
          >
            <PlusCircle className="w-4 h-4" /> Ajouter manuellement
          </button>
        </div>
      </div>

      <SearchISBN
        onBookFound={handleAddBook}
        defaultIsbn={scannedIsbn}
        onDefaultIsbnUsed={() => setScannedIsbn(null)}
      />

      {error && (
        <div className="bg-biblio-danger/10 text-biblio-danger p-4 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Search + status filters */}
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
          {[{ value: "tous", label: "Tous" }, ...STATUTS_LIVRE].map(
            ({ value, label }) => (
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
            ),
          )}
        </div>
      </div>

      {/* Book grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-biblio-accent" />
        </div>
      ) : livresFiltres.length === 0 ? (
        <div className="text-center py-12 text-biblio-muted">
          {recherche || filtreStatut !== "tous"
            ? "Aucun livre ne correspond à votre recherche."
            : "Aucun livre dans le catalogue. Ajoutez-en un par ISBN ou manuellement !"}
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
              onQrCode={(l) => setQrLivre(l)}
            />
          ))}
        </div>
      )}

      {/* ── MODAL : Ajout manuel ── */}
      {showManualForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4">
          <div className="bg-biblio-card rounded-2xl border border-white/10 w-full max-w-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-biblio-accent" /> Ajouter un
                livre manuellement
              </h2>
              <button
                onClick={() => {
                  setShowManualForm(false);
                  setManualImagePreview(null);
                  setManualImageFile(null);
                }}
                className="text-biblio-muted hover:text-biblio-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleManualAdd} className="p-6 space-y-5">
              {/* Cover upload */}
              <div>
                <label className="text-xs font-medium text-biblio-muted block mb-2">
                  Image de couverture
                </label>
                <div className="flex gap-4 items-start flex-wrap">
                  <ImageUploadZone
                    preview={manualImagePreview}
                    onFileChange={(file) => {
                      if (!file) {
                        setManualImageFile(null);
                        setManualImagePreview(null);
                        return;
                      }
                      setManualImageFile(file);
                      setManualImagePreview(URL.createObjectURL(file));
                    }}
                  />
                  {!manualImagePreview && (
                    <div className="flex-1 min-w-[180px]">
                      <p className="text-xs text-biblio-muted mb-1">
                        Ou entrer une URL
                      </p>
                      <input
                        value={manualForm.couverture_url}
                        onChange={(e) =>
                          setManualForm({
                            ...manualForm,
                            couverture_url: e.target.value,
                          })
                        }
                        placeholder="https://…"
                        className={INPUT_CLASS}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Titre *" col2>
                  <input
                    required
                    value={manualForm.titre}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, titre: e.target.value })
                    }
                    placeholder="Titre du livre"
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Auteur">
                  <input
                    value={manualForm.auteur}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, auteur: e.target.value })
                    }
                    placeholder="Auteur"
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="ISBN (optionnel)">
                  <input
                    value={manualForm.isbn}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, isbn: e.target.value })
                    }
                    placeholder="978…"
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Éditeur">
                  <input
                    value={manualForm.editeur}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, editeur: e.target.value })
                    }
                    placeholder="Éditeur"
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Année">
                  <input
                    value={manualForm.annee}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, annee: e.target.value })
                    }
                    placeholder="2024"
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Langue">
                  <input
                    value={manualForm.langue}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, langue: e.target.value })
                    }
                    placeholder="ex: Français"
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Catégorie">
                  <input
                    value={manualForm.categorie}
                    onChange={(e) =>
                      setManualForm({
                        ...manualForm,
                        categorie: e.target.value,
                      })
                    }
                    placeholder="ex: Roman, Informatique…"
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Tags (séparés par virgules)">
                  <input
                    value={manualForm.tags}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, tags: e.target.value })
                    }
                    placeholder="ex: science, jeunesse"
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Emplacement">
                  <input
                    value={manualForm.emplacement}
                    onChange={(e) =>
                      setManualForm({
                        ...manualForm,
                        emplacement: e.target.value,
                      })
                    }
                    placeholder="ex: Étagère A3"
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Nb. exemplaires">
                  <input
                    type="number"
                    min="1"
                    value={manualForm.nb_exemplaires}
                    onChange={(e) =>
                      setManualForm({
                        ...manualForm,
                        nb_exemplaires: e.target.value,
                      })
                    }
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Statut initial" col2>
                  <select
                    value={manualForm.statut}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, statut: e.target.value })
                    }
                    className={INPUT_CLASS}
                    style={{ colorScheme: "dark" }}
                  >
                    {STATUTS_LIVRE.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Résumé" col2>
                  <textarea
                    rows={3}
                    value={manualForm.resume}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, resume: e.target.value })
                    }
                    placeholder="Résumé du livre…"
                    className={INPUT_CLASS + " resize-none"}
                  />
                </Field>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={manualLoading}
                  className="flex-1 py-2.5 bg-biblio-accent hover:bg-biblio-accent-hover disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {manualLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {manualLoading ? "Enregistrement…" : "Ajouter le livre"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowManualForm(false);
                    setManualImagePreview(null);
                    setManualImageFile(null);
                  }}
                  className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg font-medium transition-colors"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL : Édition livre ── */}
      {editLivre && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4">
          <div className="bg-biblio-card rounded-2xl border border-white/10 w-full max-w-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Pencil className="w-5 h-5 text-biblio-accent" /> Modifier le
                livre
              </h2>
              <button
                onClick={() => setEditLivre(null)}
                className="text-biblio-muted hover:text-biblio-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSave} className="p-6 space-y-5">
              {/* Cover */}
              <div>
                <label className="text-xs font-medium text-biblio-muted block mb-2">
                  Image de couverture
                </label>
                <div className="flex gap-4 items-start flex-wrap">
                  {(editImagePreview || editForm.couverture_url) && (
                    <div className="relative inline-block">
                      <img
                        src={editImagePreview || editForm.couverture_url}
                        alt=""
                        className="h-32 object-contain rounded-lg border border-white/10"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                      {editImagePreview && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditImageFile(null);
                            setEditImagePreview(null);
                          }}
                          className="absolute -top-2 -right-2 bg-biblio-danger rounded-full p-0.5"
                        >
                          <X className="w-3.5 h-3.5 text-white" />
                        </button>
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-[180px] space-y-2">
                    <label className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10 text-sm text-biblio-muted transition-colors">
                      <ImagePlus className="w-4 h-4" />
                      {editImageFile ? editImageFile.name : "Changer l'image…"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          setEditImageFile(file);
                          setEditImagePreview(URL.createObjectURL(file));
                          setEditForm({ ...editForm, couverture_url: "" });
                        }}
                      />
                    </label>
                    {!editImageFile && (
                      <input
                        value={editForm.couverture_url}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            couverture_url: e.target.value,
                          })
                        }
                        placeholder="ou coller une URL…"
                        className={INPUT_CLASS + " text-xs"}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Titre *" col2>
                  <input
                    required
                    value={editForm.titre}
                    onChange={(e) =>
                      setEditForm({ ...editForm, titre: e.target.value })
                    }
                    placeholder="Titre"
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Auteur">
                  <input
                    value={editForm.auteur}
                    onChange={(e) =>
                      setEditForm({ ...editForm, auteur: e.target.value })
                    }
                    placeholder="Auteur"
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="ISBN">
                  <input
                    value={editForm.isbn}
                    onChange={(e) =>
                      setEditForm({ ...editForm, isbn: e.target.value })
                    }
                    placeholder="ISBN"
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Éditeur">
                  <input
                    value={editForm.editeur}
                    onChange={(e) =>
                      setEditForm({ ...editForm, editeur: e.target.value })
                    }
                    placeholder="Éditeur"
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Année">
                  <input
                    value={editForm.annee}
                    onChange={(e) =>
                      setEditForm({ ...editForm, annee: e.target.value })
                    }
                    placeholder="Année"
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Langue">
                  <input
                    value={editForm.langue}
                    onChange={(e) =>
                      setEditForm({ ...editForm, langue: e.target.value })
                    }
                    placeholder="ex: Français, Anglais…"
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Catégorie">
                  <input
                    value={editForm.categorie}
                    onChange={(e) =>
                      setEditForm({ ...editForm, categorie: e.target.value })
                    }
                    placeholder="ex: Informatique, Roman…"
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Tags (séparés par virgules)">
                  <input
                    value={editForm.tags}
                    onChange={(e) =>
                      setEditForm({ ...editForm, tags: e.target.value })
                    }
                    placeholder="ex: algorithme, python, débutant"
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Emplacement">
                  <input
                    value={editForm.emplacement}
                    onChange={(e) =>
                      setEditForm({ ...editForm, emplacement: e.target.value })
                    }
                    placeholder="ex: Étagère A3, Rayon 2…"
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Nb. exemplaires">
                  <input
                    type="number"
                    min="1"
                    value={editForm.nb_exemplaires}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        nb_exemplaires: e.target.value,
                      })
                    }
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Statut" col2>
                  <select
                    value={editForm.statut}
                    onChange={(e) =>
                      setEditForm({ ...editForm, statut: e.target.value })
                    }
                    className={INPUT_CLASS}
                    style={{ colorScheme: "dark" }}
                  >
                    {STATUTS_LIVRE.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Résumé" col2>
                  <textarea
                    rows={3}
                    value={editForm.resume}
                    onChange={(e) =>
                      setEditForm({ ...editForm, resume: e.target.value })
                    }
                    placeholder="Résumé du livre…"
                    className={INPUT_CLASS + " resize-none"}
                  />
                </Field>
                <Field label="Description" col2>
                  <textarea
                    rows={3}
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm({ ...editForm, description: e.target.value })
                    }
                    placeholder="Description détaillée…"
                    className={INPUT_CLASS + " resize-none"}
                  />
                </Field>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 py-2.5 bg-biblio-accent hover:bg-biblio-accent-hover disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {editLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
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

      {/* ── MODAL : Historique ── */}
      {historique && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-biblio-card rounded-2xl border border-white/10 w-full max-w-xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
              <h2 className="text-base font-semibold">
                Historique — {historique.livre.titre}
              </h2>
              <button
                onClick={() => setHistorique(null)}
                className="text-biblio-muted hover:text-biblio-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-96 overflow-y-auto">
              {historique.data.length === 0 ? (
                <p className="text-sm text-biblio-muted text-center py-4">
                  Aucun prêt enregistré pour ce livre.
                </p>
              ) : (
                <div className="space-y-3">
                  {historique.data.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between text-sm border-b border-white/5 pb-3"
                    >
                      <div>
                        <p>
                          {p.etudiants
                            ? `${p.etudiants.prenom} ${p.etudiants.nom}`
                            : "—"}
                        </p>
                        <p className="text-xs text-biblio-muted">
                          {new Date(p.date_pret).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${p.rendu ? "bg-biblio-success/20 text-biblio-success" : "bg-biblio-warning/20 text-biblio-warning"}`}
                      >
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

      {/* Scanner caméra ISBN */}
      {showCameraScanner && (
        <ISBNScanner
          mode="isbn"
          onScan={handleCameraScan}
          onClose={() => setShowCameraScanner(false)}
        />
      )}

      {/* QR code du livre */}
      {qrLivre && (
        <QRCodeModal livre={qrLivre} onClose={() => setQrLivre(null)} />
      )}
    </div>
  );
}
