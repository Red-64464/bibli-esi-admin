import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { supabase } from "../lib/supabase";
import { logActivity } from "../lib/activityLog";
import { useAuth } from "../contexts/AuthContext";
import { useDebounce } from "../lib/utils";
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
  LayoutGrid,
  List,
  Upload,
  FileText,
  CheckCircle2,
} from "lucide-react";
import SearchISBN from "../components/SearchISBN";
import ISBNScanner from "../components/ISBNScanner";
import QRCodeModal from "../components/QRCodeModal";
import LivreCard from "../components/LivreCard";
import ExportModal from "../components/ExportModal";
import ConfirmModal from "../components/ConfirmModal";
import Pagination from "../components/Pagination";
import { exportCSV, exportJSON, exportExcel } from "../lib/exports";

const STATUTS_LIVRE = [
  { value: "disponible", label: "Disponible" },
  { value: "emprunte", label: "Emprunté" },
  { value: "reserve", label: "Réservé" },
  { value: "perdu", label: "Perdu" },
  { value: "en_reparation", label: "En réparation" },
];

const STATUT_LABEL = Object.fromEntries(
  STATUTS_LIVRE.map((s) => [s.value, s.label]),
);

const STATUT_STYLE = {
  disponible: "bg-biblio-success/20 text-biblio-success",
  emprunte: "bg-biblio-warning/20 text-biblio-warning",
  reserve: "bg-biblio-accent/20 text-biblio-accent",
  perdu: "bg-biblio-danger/20 text-biblio-danger",
  en_reparation: "bg-white/10 text-biblio-muted",
};

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

const PAGE_SIZE_GRID = 24;
const PAGE_SIZE_LIST = 50;

const TRI_OPTIONS = [
  { value: "date_ajout", label: "Date ajout" },
  { value: "titre_az", label: "Titre A→Z" },
  { value: "titre_za", label: "Titre Z→A" },
  { value: "auteur", label: "Auteur" },
  { value: "statut", label: "Statut" },
];

// CSV columns expected (case-insensitive headers)
const CSV_COLUMNS = [
  "titre",
  "auteur",
  "isbn",
  "editeur",
  "annee",
  "langue",
  "categorie",
  "emplacement",
];

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
  const navigate = useNavigate();

  const [livres, setLivres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("tous");
  const [filtreCategorie, setFiltreCategorie] = useState("");

  // Search with debounce
  const [searchInput, setSearchInput] = useState("");
  const recherche = useDebounce(searchInput, 300);

  // View + sort + pagination
  const [vue, setVue] = useState("grille"); // 'grille' | 'liste'
  const [tri, setTri] = useState("date_ajout");
  const [page, setPage] = useState(1);

  // Borrow counts
  const [borrowCounts, setBorrowCounts] = useState({});

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

  // Export modal
  const [showExportModal, setShowExportModal] = useState(false);

  // Confirm delete modal
  const [confirmDelete, setConfirmDelete] = useState(null); // livre id

  // CSV Import modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvRows, setCsvRows] = useState([]); // all parsed rows
  const [importLoading, setImportLoading] = useState(false);
  const [importSuccess, setImportSuccess] = useState(null); // number inserted

  useEffect(() => {
    fetchLivres();
    fetchBorrowCounts();
  }, []);

  // Reset page when filters/search/view change
  useEffect(() => {
    setPage(1);
  }, [recherche, filtreStatut, filtreCategorie, vue, tri]);

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

  const fetchBorrowCounts = async () => {
    try {
      const { data } = await supabase.from("prets").select("livre_id");
      const counts = {};
      (data || []).forEach((p) => {
        counts[p.livre_id] = (counts[p.livre_id] || 0) + 1;
      });
      setBorrowCounts(counts);
    } catch {
      // non-critical, ignore
    }
  };

  const uploadCover = async (file) => {
    const ext = file.name.split(".").pop().toLowerCase();
    const filename = `cover_${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("covers")
      .upload(filename, file);
    if (error)
      throw new Error(
        "Upload image échoué : " +
          error.message +
          " (créez un bucket public nommé 'covers' dans Supabase Storage)",
      );
    const { data } = supabase.storage.from("covers").getPublicUrl(filename);
    return data.publicUrl;
  };

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

  const handleCameraScan = async (raw) => {
    setShowCameraScanner(false);
    if (raw.startsWith("biblesi://livre/")) {
      const id = raw.replace("biblesi://livre/", "");
      const found = livres.find((l) => l.id === id);
      if (found) {
        openEdit(found);
        return;
      }
    }
    const cleanIsbn = raw.replace(/[-\s]/g, "").trim();
    setScannedIsbn(cleanIsbn);
  };

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

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete;
    setConfirmDelete(null);
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

  const handleDuplicate = async (livre) => {
    try {
      const { id, date_ajout, ...rest } = livre;
      const { error: err } = await supabase.from("livres").insert([
        {
          ...rest,
          titre: `${livre.titre} (Copie)`,
          disponible: true,
          statut: "disponible",
          isbn: null, // avoid unique constraint collision
        },
      ]);
      if (err) throw err;
      await logActivity({
        action_type: "livre_ajoute",
        description: `Livre « ${livre.titre} » dupliqué`,
        user_info: session?.username || "",
      });
      await fetchLivres();
    } catch (err) {
      setError("Erreur lors de la duplication : " + err.message);
    }
  };

  const handleCreatePretFromLivre = (livre) => {
    navigate("/prets", { state: { livreId: livre.id } });
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

  // ── CSV Import handlers ──
  const handleCsvFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportSuccess(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (results) => {
        setCsvRows(results.data || []);
      },
    });
  };

  const handleCsvImport = async () => {
    if (!csvRows.length) return;
    setImportLoading(true);
    setError("");
    try {
      const toInsert = csvRows.map((row) => ({
        titre: (row.titre || "").trim() || "Sans titre",
        auteur: row.auteur?.trim() || null,
        isbn: row.isbn?.trim() || null,
        editeur: row.editeur?.trim() || null,
        annee: row.annee?.trim() || null,
        langue: row.langue?.trim() || null,
        categorie: row.categorie?.trim() || null,
        emplacement: row.emplacement?.trim() || null,
        disponible: true,
        statut: "disponible",
        nb_exemplaires: 1,
      }));

      // Batch insert in chunks of 100
      const CHUNK = 100;
      let inserted = 0;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const chunk = toInsert.slice(i, i + CHUNK);
        const { error: err } = await supabase.from("livres").insert(chunk);
        if (err) throw err;
        inserted += chunk.length;
      }

      await logActivity({
        action_type: "livre_ajoute",
        description: `Import CSV : ${inserted} livre(s) importé(s)`,
        user_info: session?.username || "",
      });
      setImportSuccess(inserted);
      setCsvRows([]);
      await fetchLivres();
    } catch (err) {
      setError("Erreur lors de l'import CSV : " + err.message);
    } finally {
      setImportLoading(false);
    }
  };

  // ── Filtering + sorting + pagination ──
  const categories = [
    ...new Set(livres.map((l) => l.categorie).filter(Boolean)),
  ].sort();

  const livresFiltres = livres
    .filter((l) => {
      const q = recherche.toLowerCase();
      const matchSearch =
        !q ||
        l.titre?.toLowerCase().includes(q) ||
        l.auteur?.toLowerCase().includes(q) ||
        l.isbn?.includes(q) ||
        l.categorie?.toLowerCase().includes(q);
      const s = normaliseStatut(
        l.statut || (l.disponible ? "disponible" : "emprunte"),
      );
      const matchStatut = filtreStatut === "tous" || s === filtreStatut;
      const matchCategorie =
        !filtreCategorie || l.categorie === filtreCategorie;
      return matchSearch && matchStatut && matchCategorie;
    })
    .sort((a, b) => {
      switch (tri) {
        case "titre_az":
          return (a.titre || "").localeCompare(b.titre || "", "fr");
        case "titre_za":
          return (b.titre || "").localeCompare(a.titre || "", "fr");
        case "auteur":
          return (a.auteur || "").localeCompare(b.auteur || "", "fr");
        case "statut":
          return (a.statut || "").localeCompare(b.statut || "");
        default: // date_ajout — keep original (already sorted by DB)
          return 0;
      }
    });

  const pageSize = vue === "grille" ? PAGE_SIZE_GRID : PAGE_SIZE_LIST;
  const totalPages = Math.ceil(livresFiltres.length / pageSize);
  const livresPage = livresFiltres.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
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
            onClick={() => {
              setCsvRows([]);
              setImportSuccess(null);
              setShowImportModal(true);
            }}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
          >
            <Upload className="w-4 h-4" /> Import CSV
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

      {/* ── Search + status filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-biblio-muted" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Rechercher (titre, auteur, ISBN, catégorie)..."
            className="w-full bg-biblio-card border border-white/10 rounded-lg pl-10 pr-4 py-3 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent"
          />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
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

      {/* ── Category pill filters ── */}
      {categories.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFiltreCategorie("")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              filtreCategorie === ""
                ? "bg-biblio-accent/20 text-biblio-accent border-biblio-accent/30"
                : "bg-white/5 text-biblio-muted border-white/10 hover:bg-white/10"
            }`}
          >
            Toutes catégories
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() =>
                setFiltreCategorie(filtreCategorie === cat ? "" : cat)
              }
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                filtreCategorie === cat
                  ? "bg-biblio-accent/20 text-biblio-accent border-biblio-accent/30"
                  : "bg-white/5 text-biblio-muted border-white/10 hover:bg-white/10"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* ── Tri + Vue toggle ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-biblio-muted">
          {livresFiltres.length} résultat{livresFiltres.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-3">
          {/* Sort select */}
          <div className="relative">
            <select
              value={tri}
              onChange={(e) => setTri(e.target.value)}
              className="appearance-none bg-white/5 border border-white/10 rounded-lg pl-3 pr-8 py-2 text-sm text-biblio-text focus:outline-none focus:ring-2 focus:ring-biblio-accent cursor-pointer"
              style={{ colorScheme: "dark" }}
            >
              {TRI_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  Trier par : {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-1 gap-1">
            <button
              onClick={() => setVue("grille")}
              className={`p-1.5 rounded-md transition-colors ${
                vue === "grille"
                  ? "bg-biblio-accent text-white"
                  : "text-biblio-muted hover:text-biblio-text"
              }`}
              title="Vue grille"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setVue("liste")}
              className={`p-1.5 rounded-md transition-colors ${
                vue === "liste"
                  ? "bg-biblio-accent text-white"
                  : "text-biblio-muted hover:text-biblio-text"
              }`}
              title="Vue liste"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Book display ── */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-biblio-accent" />
        </div>
      ) : livresFiltres.length === 0 ? (
        <div className="text-center py-12 text-biblio-muted">
          {searchInput || filtreStatut !== "tous" || filtreCategorie
            ? "Aucun livre ne correspond à votre recherche."
            : "Aucun livre dans le catalogue. Ajoutez-en un par ISBN ou manuellement !"}
        </div>
      ) : vue === "grille" ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {livresPage.map((livre) => (
              <LivreCard
                key={livre.id}
                livre={livre}
                onDelete={(id) => setConfirmDelete(id)}
                onEdit={openEdit}
                onHistorique={openHistorique}
                onQrCode={(l) => setQrLivre(l)}
                onDuplicate={handleDuplicate}
                onCreatePret={handleCreatePretFromLivre}
                borrowCount={borrowCounts[livre.id]}
              />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      ) : (
        <>
          <div className="bg-biblio-card border border-white/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="px-4 py-3 text-xs font-medium text-biblio-muted w-12">
                      Cover
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-biblio-muted">
                      Titre
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-biblio-muted hidden md:table-cell">
                      Auteur
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-biblio-muted hidden lg:table-cell">
                      Catégorie
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-biblio-muted">
                      Statut
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-biblio-muted hidden xl:table-cell">
                      Emprunts
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-biblio-muted text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {livresPage.map((livre) => {
                    const statut = normaliseStatut(
                      livre.statut ||
                        (livre.disponible ? "disponible" : "emprunte"),
                    );
                    const badgeClass =
                      STATUT_STYLE[statut] || "bg-white/10 text-biblio-muted";
                    return (
                      <tr
                        key={livre.id}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        {/* Mini cover */}
                        <td className="px-4 py-2">
                          {livre.couverture_url ? (
                            <img
                              src={livre.couverture_url}
                              alt=""
                              className="w-8 h-10 object-contain rounded"
                            />
                          ) : (
                            <div className="w-8 h-10 bg-white/5 rounded flex items-center justify-center">
                              <BookOpen className="w-3.5 h-3.5 text-biblio-muted" />
                            </div>
                          )}
                        </td>
                        {/* Titre */}
                        <td className="px-4 py-2">
                          <p className="font-medium text-biblio-text line-clamp-1">
                            {livre.titre}
                          </p>
                          {livre.isbn && (
                            <p className="text-xs text-biblio-muted font-mono">
                              {livre.isbn}
                            </p>
                          )}
                        </td>
                        {/* Auteur */}
                        <td className="px-4 py-2 text-biblio-muted hidden md:table-cell">
                          {livre.auteur || "—"}
                        </td>
                        {/* Catégorie */}
                        <td className="px-4 py-2 hidden lg:table-cell">
                          {livre.categorie ? (
                            <span className="text-xs text-biblio-accent">
                              {livre.categorie}
                            </span>
                          ) : (
                            <span className="text-biblio-muted">—</span>
                          )}
                        </td>
                        {/* Statut */}
                        <td className="px-4 py-2">
                          <span
                            className={`text-xs font-medium px-2.5 py-1 rounded-full ${badgeClass}`}
                          >
                            {STATUT_LABEL[statut] ||
                              statut.charAt(0).toUpperCase() + statut.slice(1)}
                          </span>
                        </td>
                        {/* Emprunts */}
                        <td className="px-4 py-2 text-biblio-muted hidden xl:table-cell text-center">
                          {borrowCounts[livre.id] ?? 0}×
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => setQrLivre(livre)}
                              className="p-1.5 rounded-lg text-biblio-muted hover:text-biblio-accent hover:bg-biblio-accent/10 transition-colors"
                              title="QR Code"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDuplicate(livre)}
                              className="p-1.5 rounded-lg text-biblio-muted hover:text-biblio-text hover:bg-white/10 transition-colors"
                              title="Dupliquer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openEdit(livre)}
                              className="p-1.5 rounded-lg text-biblio-muted hover:text-biblio-text hover:bg-white/10 transition-colors"
                              title="Modifier"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmDelete(livre.id)}
                              className="p-1.5 rounded-lg text-biblio-muted hover:text-biblio-danger hover:bg-biblio-danger/10 transition-colors"
                              title="Supprimer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
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

      {/* ── MODAL : Import CSV ── */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4">
          <div className="bg-biblio-card rounded-2xl border border-white/10 w-full max-w-3xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Upload className="w-5 h-5 text-biblio-accent" /> Import CSV
              </h2>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setCsvRows([]);
                  setImportSuccess(null);
                }}
                className="text-biblio-muted hover:text-biblio-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {importSuccess !== null ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <CheckCircle2 className="w-12 h-12 text-biblio-success" />
                  <p className="text-lg font-semibold text-biblio-text">
                    {importSuccess} livre{importSuccess !== 1 ? "s" : ""}{" "}
                    importé
                    {importSuccess !== 1 ? "s" : ""} avec succès !
                  </p>
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setCsvRows([]);
                      setImportSuccess(null);
                    }}
                    className="mt-2 px-6 py-2.5 bg-biblio-accent hover:bg-biblio-accent-hover text-white rounded-lg font-medium transition-colors"
                  >
                    Fermer
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="text-sm text-biblio-muted">
                      Le fichier CSV doit avoir les colonnes (insensible à la
                      casse) :{" "}
                      <span className="font-mono text-biblio-accent">
                        {CSV_COLUMNS.join(", ")}
                      </span>
                    </p>
                    <label className="flex items-center gap-3 px-4 py-3 bg-white/5 border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:border-biblio-accent/50 hover:bg-biblio-accent/5 transition-colors w-full">
                      <Upload className="w-5 h-5 text-biblio-muted shrink-0" />
                      <span className="text-sm text-biblio-muted">
                        {csvRows.length > 0
                          ? `${csvRows.length} ligne(s) chargée(s) — cliquer pour changer`
                          : "Cliquer pour sélectionner un fichier CSV"}
                      </span>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={handleCsvFileChange}
                      />
                    </label>
                  </div>

                  {/* Preview */}
                  {csvRows.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-biblio-muted mb-2">
                        Aperçu (5 premières lignes sur {csvRows.length}) :
                      </p>
                      <div className="overflow-x-auto rounded-lg border border-white/10">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-white/5 border-b border-white/10">
                              {CSV_COLUMNS.map((col) => (
                                <th
                                  key={col}
                                  className="px-3 py-2 text-left text-biblio-muted font-medium capitalize"
                                >
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {csvRows.slice(0, 5).map((row, i) => (
                              <tr
                                key={i}
                                className="border-b border-white/5 hover:bg-white/5"
                              >
                                {CSV_COLUMNS.map((col) => (
                                  <td
                                    key={col}
                                    className="px-3 py-2 text-biblio-text max-w-[140px] truncate"
                                  >
                                    {row[col] || "—"}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleCsvImport}
                      disabled={csvRows.length === 0 || importLoading}
                      className="flex-1 py-2.5 bg-biblio-accent hover:bg-biblio-accent-hover disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      {importLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {importLoading
                        ? "Import en cours…"
                        : `Importer ${csvRows.length} livre${csvRows.length !== 1 ? "s" : ""}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowImportModal(false);
                        setCsvRows([]);
                        setImportSuccess(null);
                      }}
                      className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg font-medium transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm delete ── */}
      {confirmDelete && (
        <ConfirmModal
          title="Supprimer le livre"
          message="Êtes-vous sûr de vouloir supprimer ce livre ? Cette action est irréversible."
          danger
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {showExportModal && (
        <ExportModal
          title="Exporter le catalogue"
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
        />
      )}

      {showCameraScanner && (
        <ISBNScanner
          mode="isbn"
          onScan={handleCameraScan}
          onClose={() => setShowCameraScanner(false)}
        />
      )}

      {qrLivre && (
        <QRCodeModal livre={qrLivre} onClose={() => setQrLivre(null)} />
      )}
    </div>
  );
}
