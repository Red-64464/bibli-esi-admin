import { useState, useEffect, useRef } from "react";
import Papa from "papaparse";
import { supabase } from "../lib/supabase";
import { logActivity } from "../lib/activityLog";
import { useAuth } from "../contexts/AuthContext";
import {
  Users,
  Loader2,
  UserPlus,
  Search,
  Download,
  X,
  Save,
  Pencil,
  Plus,
  Trash2,
  Phone,
  StickyNote,
  AlertCircle,
  Upload,
  ArrowUpDown,
} from "lucide-react";
import EtudiantCard from "../components/EtudiantCard";
import ExportModal from "../components/ExportModal";
import ConfirmModal from "../components/ConfirmModal";
import Pagination from "../components/Pagination";
import { exportCSV, exportJSON, exportExcel } from "../lib/exports";
import { useDebounce, getPretStatut } from "../lib/utils";

const INPUT_CLASS =
  "bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent w-full text-sm";

const PAGE_SIZE = 20;

// Defined OUTSIDE the component so React doesn't remount it on every keystroke
function CustomFieldsEditor({ fields, onChange }) {
  const addField = () => onChange([...fields, { key: "", value: "" }]);
  const removeField = (i) => onChange(fields.filter((_, idx) => idx !== i));
  const updateField = (i, k, v) => {
    const updated = [...fields];
    updated[i] = { ...updated[i], [k]: v };
    onChange(updated);
  };
  return (
    <div className="space-y-2">
      {fields.map((f, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            value={f.key}
            onChange={(e) => updateField(i, "key", e.target.value)}
            placeholder="Clé (ex: promotion)"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent flex-1"
          />
          <input
            value={f.value}
            onChange={(e) => updateField(i, "value", e.target.value)}
            placeholder="Valeur (ex: BAC2)"
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent flex-1"
          />
          <button
            type="button"
            onClick={() => removeField(i)}
            className="text-biblio-muted hover:text-biblio-danger transition-colors shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addField}
        className="flex items-center gap-1.5 text-xs text-biblio-accent hover:text-biblio-accent-hover transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Ajouter un champ
      </button>
    </div>
  );
}

// CSV import modal
function ImportCSVModal({ onClose, onImported }) {
  const fileRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setSuccess("");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data.map((r) => ({
          nom: r.nom?.trim() || "",
          prenom: r.prenom?.trim() || "",
          email: r.email?.trim() || "",
          numero_etudiant: r.numero_etudiant?.trim() || "",
          telephone: r.telephone?.trim() || "",
        }));
        setPreview(rows);
      },
      error: (err) => setError("Erreur de parsing : " + err.message),
    });
  };

  const handleImport = async () => {
    if (!preview.length) return;
    setLoading(true);
    setError("");
    try {
      const valid = preview.filter((r) => r.nom && r.prenom);
      if (!valid.length) {
        setError("Aucune ligne valide (nom et prénom requis).");
        setLoading(false);
        return;
      }
      const { error: err } = await supabase
        .from("etudiants")
        .upsert(valid, { ignoreDuplicates: true });
      if (err) throw err;
      setSuccess(`${valid.length} étudiant(s) importé(s) avec succès.`);
      setPreview([]);
      onImported();
    } catch (err) {
      setError("Erreur lors de l'import : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-biblio-card border border-white/10 rounded-2xl shadow-xl p-6 w-full max-w-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-biblio-muted hover:text-biblio-text transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <Upload className="w-6 h-6 text-biblio-accent" />
          <h2 className="text-lg font-semibold text-biblio-text">
            Import CSV — Étudiants
          </h2>
        </div>

        <p className="text-sm text-biblio-muted">
          Le fichier CSV doit contenir les colonnes :{" "}
          <code className="text-biblio-accent">
            nom, prenom, email, numero_etudiant, telephone
          </code>
          . Les doublons (même email/numéro) seront ignorés.
        </p>

        {/* File input */}
        <div>
          <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-white/20 rounded-xl p-8 cursor-pointer hover:border-biblio-accent/50 transition-colors group">
            <Upload className="w-8 h-8 text-biblio-muted group-hover:text-biblio-accent transition-colors" />
            <span className="text-sm text-biblio-muted group-hover:text-biblio-text transition-colors">
              Cliquer pour sélectionner un fichier CSV
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFile}
            />
          </label>
        </div>

        {error && (
          <p className="text-sm text-biblio-danger flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-biblio-success font-medium">{success}</p>
        )}

        {/* Preview */}
        {preview.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-biblio-muted font-medium">
              Aperçu — {preview.length} ligne(s) détectée(s)
            </p>
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/5 text-biblio-muted">
                    {["Prénom", "Nom", "Email", "N° étudiant", "Téléphone"].map(
                      (h) => (
                        <th key={h} className="px-3 py-2 text-left font-medium">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 10).map((r, i) => (
                    <tr
                      key={i}
                      className="border-t border-white/5 hover:bg-white/5"
                    >
                      <td className="px-3 py-2 text-biblio-text">
                        {r.prenom || "—"}
                      </td>
                      <td className="px-3 py-2 text-biblio-text">
                        {r.nom || "—"}
                      </td>
                      <td className="px-3 py-2 text-biblio-muted">
                        {r.email || "—"}
                      </td>
                      <td className="px-3 py-2 text-biblio-muted">
                        {r.numero_etudiant || "—"}
                      </td>
                      <td className="px-3 py-2 text-biblio-muted">
                        {r.telephone || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 10 && (
                <p className="text-xs text-biblio-muted px-3 py-2">
                  … et {preview.length - 10} autre(s) ligne(s)
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-biblio-text text-sm font-medium transition-colors"
          >
            Fermer
          </button>
          {preview.length > 0 && (
            <button
              onClick={handleImport}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-biblio-accent hover:bg-biblio-accent-hover disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Importer {preview.length} étudiant(s)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const emptyForm = {
  nom: "",
  prenom: "",
  email: "",
  numero_etudiant: "",
  telephone: "",
  notes_admin: "",
  champs_custom: [],
};

const SORT_OPTIONS = [
  { value: "nom_az", label: "Nom A–Z" },
  { value: "nom_za", label: "Nom Z–A" },
  { value: "date_inscription", label: "Date inscription" },
  { value: "nb_prets", label: "Nb prêts en cours" },
];

const FILTER_OPTIONS = [
  { value: "tous", label: "Tous" },
  { value: "en_retard", label: "En retard" },
  { value: "avec_prets", label: "Avec prêts en cours" },
  { value: "sans_prets", label: "Sans prêts" },
];

export default function Etudiants() {
  const { session } = useAuth();
  const [etudiants, setEtudiants] = useState([]);
  const [prets, setPrets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recherche, setRecherche] = useState("");
  const debouncedRecherche = useDebounce(recherche, 300);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editEtudiant, setEditEtudiant] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editLoading, setEditLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Confirm delete
  const [confirmDelete, setConfirmDelete] = useState(null); // etudiant id

  // Filter / Sort / Pagination
  const [filterMode, setFilterMode] = useState("tous");
  const [sortMode, setSortMode] = useState("nom_az");
  const [page, setPage] = useState(1);

  // Nouveau prêt pre-filled
  const [pretEtudiant, setPretEtudiant] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [etudRes, pretsRes] = await Promise.all([
        supabase
          .from("etudiants")
          .select("*")
          .order("date_inscription", { ascending: false }),
        supabase
          .from("prets")
          .select("*, livres(titre)")
          .eq("rendu", false),
      ]);
      if (etudRes.error) throw etudRes.error;
      if (pretsRes.error) throw pretsRes.error;
      setEtudiants(etudRes.data || []);
      setPrets(pretsRes.data || []);
    } catch (err) {
      setError("Impossible de charger les données : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Normalise champs_custom depuis la DB (JSON object → array of {key, value})
  const parseCustomFields = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    return Object.entries(raw).map(([key, value]) => ({
      key,
      value: String(value),
    }));
  };

  // Transforme [{ key, value }] → { key: value } pour stockage
  const serializeCustomFields = (arr) => {
    const obj = {};
    arr.forEach(({ key, value }) => {
      if (key.trim()) obj[key.trim()] = value;
    });
    return obj;
  };

  // Helpers: prets per student
  const getPretsEtudiant = (etudiantId) =>
    prets.filter((p) => p.etudiant_id === etudiantId);

  const getLivresEmpruntes = (etudiantId) =>
    getPretsEtudiant(etudiantId)
      .filter((p) => {
        const s = getPretStatut(p);
        return s === "en_cours" || s === "en_retard";
      })
      .map((p) => p.livres?.titre || "Titre inconnu");

  const hasRetard = (etudiantId) =>
    getPretsEtudiant(etudiantId).some(
      (p) => getPretStatut(p) === "en_retard",
    );

  const nbPretsEnCours = (etudiantId) =>
    getPretsEtudiant(etudiantId).filter((p) => {
      const s = getPretStatut(p);
      return s === "en_cours" || s === "en_retard";
    }).length;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.nom.trim() || !form.prenom.trim()) return;
    try {
      const payload = {
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        email: form.email,
        numero_etudiant: form.numero_etudiant,
        telephone: form.telephone,
        notes_admin: form.notes_admin,
        champs_custom: serializeCustomFields(form.champs_custom),
      };
      const { error: err } = await supabase.from("etudiants").insert([payload]);
      if (err) {
        if (err.code === "23505")
          setError("Cet email ou numéro étudiant existe déjà.");
        else throw err;
        return;
      }
      await logActivity({
        action_type: "etudiant_cree",
        description: `Étudiant « ${payload.prenom} ${payload.nom} » créé`,
        user_info: session?.username || "",
      });
      setForm(emptyForm);
      setShowForm(false);
      setError("");
      await fetchData();
    } catch (err) {
      setError("Erreur lors de l'ajout : " + err.message);
    }
  };

  const handleDeleteConfirmed = async (id) => {
    try {
      const etudiant = etudiants.find((e) => e.id === id);
      const { error: pretsErr } = await supabase
        .from("prets")
        .delete()
        .eq("etudiant_id", id);
      if (pretsErr) throw pretsErr;
      const { error: err } = await supabase
        .from("etudiants")
        .delete()
        .eq("id", id);
      if (err) throw err;
      await logActivity({
        action_type: "etudiant_supprime",
        description: `Étudiant « ${etudiant ? `${etudiant.prenom} ${etudiant.nom}` : id} » supprimé`,
        user_info: session?.username || "",
      });
      setEtudiants((prev) => prev.filter((e) => e.id !== id));
      setPrets((prev) => prev.filter((p) => p.etudiant_id !== id));
    } catch (err) {
      setError("Erreur lors de la suppression : " + err.message);
    } finally {
      setConfirmDelete(null);
    }
  };

  const openEdit = (etudiant) => {
    setEditEtudiant(etudiant);
    setEditForm({
      nom: etudiant.nom || "",
      prenom: etudiant.prenom || "",
      email: etudiant.email || "",
      numero_etudiant: etudiant.numero_etudiant || "",
      telephone: etudiant.telephone || "",
      notes_admin: etudiant.notes_admin || "",
      champs_custom: parseCustomFields(etudiant.champs_custom),
    });
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editEtudiant) return;
    setEditLoading(true);
    try {
      const payload = {
        nom: editForm.nom.trim(),
        prenom: editForm.prenom.trim(),
        email: editForm.email,
        numero_etudiant: editForm.numero_etudiant,
        telephone: editForm.telephone,
        notes_admin: editForm.notes_admin,
        champs_custom: serializeCustomFields(editForm.champs_custom),
      };
      const { error: err } = await supabase
        .from("etudiants")
        .update(payload)
        .eq("id", editEtudiant.id);
      if (err) throw err;
      await logActivity({
        action_type: "etudiant_modifie",
        description: `Étudiant « ${payload.prenom} ${payload.nom} » modifié`,
        user_info: session?.username || "",
      });
      setEditEtudiant(null);
      await fetchData();
    } catch (err) {
      setError("Erreur lors de la modification : " + err.message);
    } finally {
      setEditLoading(false);
    }
  };

  const handleExport = async (format) => {
    const { data } = await supabase.from("etudiants").select("*");
    const rows = (data || []).map((e) => ({
      Prénom: e.prenom,
      Nom: e.nom,
      Email: e.email || "",
      "Numéro étudiant": e.numero_etudiant || "",
      Téléphone: e.telephone || "",
      "Date inscription": e.date_inscription
        ? new Date(e.date_inscription).toLocaleDateString("fr-FR")
        : "",
      Notes: e.notes_admin || "",
    }));
    const filename = `etudiants_${new Date().toISOString().slice(0, 10)}`;
    if (format === "csv") exportCSV(rows, filename);
    else if (format === "excel") exportExcel(rows, filename, "Étudiants");
    else exportJSON(rows, filename);
  };

  // Filter → Sort → Paginate pipeline
  const etudiantsApresFiltre = etudiants
    .filter((e) => {
      const q = debouncedRecherche.toLowerCase();
      const matchSearch =
        !q ||
        e.nom?.toLowerCase().includes(q) ||
        e.prenom?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.numero_etudiant?.toLowerCase().includes(q) ||
        e.telephone?.toLowerCase().includes(q);
      if (!matchSearch) return false;

      if (filterMode === "en_retard") return hasRetard(e.id);
      if (filterMode === "avec_prets") return nbPretsEnCours(e.id) > 0;
      if (filterMode === "sans_prets") return nbPretsEnCours(e.id) === 0;
      return true;
    })
    .sort((a, b) => {
      if (sortMode === "nom_az")
        return (a.nom || "").localeCompare(b.nom || "");
      if (sortMode === "nom_za")
        return (b.nom || "").localeCompare(a.nom || "");
      if (sortMode === "date_inscription")
        return (
          new Date(b.date_inscription || 0) -
          new Date(a.date_inscription || 0)
        );
      if (sortMode === "nb_prets")
        return nbPretsEnCours(b.id) - nbPretsEnCours(a.id);
      return 0;
    });

  const totalPages = Math.max(1, Math.ceil(etudiantsApresFiltre.length / PAGE_SIZE));
  const etudiantsFiltres = etudiantsApresFiltre.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  // Reset page when filter/search changes
  const handleFilterChange = (v) => {
    setFilterMode(v);
    setPage(1);
  };
  const handleSortChange = (v) => {
    setSortMode(v);
    setPage(1);
  };
  const handleSearchChange = (v) => {
    setRecherche(v);
    setPage(1);
  };

  // Dynamic filter badge counts
  const filterCounts = {
    tous: etudiants.length,
    en_retard: etudiants.filter((e) => hasRetard(e.id)).length,
    avec_prets: etudiants.filter((e) => nbPretsEnCours(e.id) > 0).length,
    sans_prets: etudiants.filter((e) => nbPretsEnCours(e.id) === 0).length,
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Users className="w-8 h-8 text-biblio-accent" />
            Gestion des étudiants
          </h1>
          <p className="text-biblio-muted mt-1">
            {etudiants.length} étudiant{etudiants.length !== 1 ? "s" : ""}{" "}
            inscrit{etudiants.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
          >
            <Upload className="w-4 h-4" /> Import CSV
          </button>
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
            <UserPlus className="w-5 h-5" />
            Ajouter un étudiant
          </button>
        </div>
      </div>

      {/* Formulaire d'ajout */}
      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-biblio-card rounded-xl border border-white/10 p-6 space-y-5"
        >
          <h2 className="text-lg font-semibold">Nouvel étudiant</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-biblio-muted block mb-1">
                Prénom *
              </label>
              <input
                required
                value={form.prenom}
                onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                placeholder="Prénom"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-biblio-muted block mb-1">
                Nom *
              </label>
              <input
                required
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                placeholder="Nom"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-biblio-muted block mb-1">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Email"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-biblio-muted block mb-1">
                Numéro étudiant
              </label>
              <input
                value={form.numero_etudiant}
                onChange={(e) =>
                  setForm({ ...form, numero_etudiant: e.target.value })
                }
                placeholder="Numéro étudiant"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-biblio-muted block mb-1 flex items-center gap-1">
                <Phone className="w-3 h-3" /> Téléphone
              </label>
              <input
                value={form.telephone}
                onChange={(e) =>
                  setForm({ ...form, telephone: e.target.value })
                }
                placeholder="+213…"
                className={INPUT_CLASS}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-biblio-muted block mb-1 flex items-center gap-1">
                <StickyNote className="w-3 h-3" /> Notes administrateur
              </label>
              <textarea
                rows={2}
                value={form.notes_admin}
                onChange={(e) =>
                  setForm({ ...form, notes_admin: e.target.value })
                }
                placeholder="Notes internes…"
                className={INPUT_CLASS + " resize-none"}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-biblio-muted block mb-2">
                Champs personnalisés
              </label>
              <CustomFieldsEditor
                fields={form.champs_custom}
                onChange={(v) => setForm({ ...form, champs_custom: v })}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="px-5 py-2.5 bg-biblio-success hover:bg-biblio-success/80 text-white rounded-lg font-medium transition-colors"
            >
              Enregistrer
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

      {/* Nouveau prêt pré-rempli */}
      {pretEtudiant && (
        <div className="bg-biblio-card rounded-xl border border-biblio-accent/40 p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-biblio-text">
            <span className="font-semibold text-biblio-accent">
              Nouveau prêt
            </span>{" "}
            pour{" "}
            <span className="font-medium">
              {pretEtudiant.prenom} {pretEtudiant.nom}
            </span>{" "}
            — rendez-vous sur la page{" "}
            <a
              href="/prets/nouveau"
              className="underline text-biblio-accent hover:text-biblio-accent-hover"
            >
              Nouveau prêt
            </a>{" "}
            (étudiant pré-sélectionné dans la session).
          </p>
          <button
            onClick={() => setPretEtudiant(null)}
            className="text-biblio-muted hover:text-biblio-text shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="bg-biblio-danger/10 text-biblio-danger p-4 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-biblio-muted" />
        <input
          type="text"
          value={recherche}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Rechercher un étudiant (nom, prénom, email, numéro, téléphone)…"
          className="w-full bg-biblio-card border border-white/10 rounded-lg pl-10 pr-4 py-3 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent"
        />
      </div>

      {/* Filter bar + Sort */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleFilterChange(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                filterMode === opt.value
                  ? "bg-biblio-accent text-white"
                  : "bg-white/5 hover:bg-white/10 text-biblio-muted hover:text-biblio-text"
              }`}
            >
              {opt.label}
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  filterMode === opt.value
                    ? "bg-white/20 text-white"
                    : "bg-white/10 text-biblio-muted"
                }`}
              >
                {filterCounts[opt.value]}
              </span>
            </button>
          ))}
        </div>

        {/* Sort select */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-biblio-muted shrink-0" />
          <select
            value={sortMode}
            onChange={(e) => handleSortChange(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-biblio-text focus:outline-none focus:ring-2 focus:ring-biblio-accent"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-biblio-accent" />
        </div>
      ) : etudiantsFiltres.length === 0 ? (
        <div className="text-center py-12 text-biblio-muted">
          {debouncedRecherche || filterMode !== "tous"
            ? "Aucun étudiant trouvé."
            : "Aucun étudiant inscrit. Ajoutez-en un !"}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {etudiantsFiltres.map((etudiant) => (
              <EtudiantCard
                key={etudiant.id}
                etudiant={etudiant}
                livresEmpruntes={getLivresEmpruntes(etudiant.id)}
                hasRetard={hasRetard(etudiant.id)}
                onDelete={(id) => setConfirmDelete(id)}
                onEdit={openEdit}
                onNouveauPret={(e) => {
                  setPretEtudiant(e);
                  // Store in sessionStorage so Prets page can read it
                  sessionStorage.setItem(
                    "pretEtudiantPrefill",
                    JSON.stringify({ id: e.id, nom: e.nom, prenom: e.prenom }),
                  );
                  window.dispatchEvent(new Event("pretPrefillUpdated"));
                }}
              />
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            page={page}
            totalPages={totalPages}
            onPage={setPage}
          />
        </>
      )}

      {/* Modal édition étudiant */}
      {editEtudiant && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4">
          <div className="bg-biblio-card rounded-2xl border border-white/10 w-full max-w-xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Pencil className="w-5 h-5 text-biblio-accent" /> Modifier
                l'étudiant
              </h2>
              <button
                onClick={() => setEditEtudiant(null)}
                className="text-biblio-muted hover:text-biblio-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSave} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-biblio-muted block mb-1">
                    Prénom *
                  </label>
                  <input
                    required
                    value={editForm.prenom}
                    onChange={(e) =>
                      setEditForm({ ...editForm, prenom: e.target.value })
                    }
                    placeholder="Prénom"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-biblio-muted block mb-1">
                    Nom *
                  </label>
                  <input
                    required
                    value={editForm.nom}
                    onChange={(e) =>
                      setEditForm({ ...editForm, nom: e.target.value })
                    }
                    placeholder="Nom"
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-biblio-muted block mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm({ ...editForm, email: e.target.value })
                    }
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-biblio-muted block mb-1">
                    Numéro étudiant
                  </label>
                  <input
                    value={editForm.numero_etudiant}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        numero_etudiant: e.target.value,
                      })
                    }
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-biblio-muted block mb-1 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Téléphone
                  </label>
                  <input
                    value={editForm.telephone}
                    onChange={(e) =>
                      setEditForm({ ...editForm, telephone: e.target.value })
                    }
                    placeholder="+213…"
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-biblio-muted block mb-1 flex items-center gap-1">
                    <StickyNote className="w-3 h-3" /> Notes administrateur
                  </label>
                  <textarea
                    rows={2}
                    value={editForm.notes_admin}
                    onChange={(e) =>
                      setEditForm({ ...editForm, notes_admin: e.target.value })
                    }
                    className={INPUT_CLASS + " resize-none"}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-biblio-muted block mb-2">
                    Champs personnalisés
                  </label>
                  <CustomFieldsEditor
                    fields={editForm.champs_custom}
                    onChange={(v) =>
                      setEditForm({ ...editForm, champs_custom: v })
                    }
                  />
                </div>
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
                  onClick={() => setEditEtudiant(null)}
                  className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg font-medium transition-colors"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDelete !== null && (
        <ConfirmModal
          title="Supprimer l'étudiant"
          message="Supprimer cet étudiant ? Ses prêts associés seront également supprimés. Cette action est irréversible."
          danger
          onConfirm={() => handleDeleteConfirmed(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {showExportModal && (
        <ExportModal
          title="Exporter les étudiants"
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
        />
      )}

      {showImportModal && (
        <ImportCSVModal
          onClose={() => setShowImportModal(false)}
          onImported={() => {
            fetchData();
          }}
        />
      )}
    </div>
  );
}
