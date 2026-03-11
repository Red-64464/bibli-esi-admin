import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  Users, Loader2, UserPlus, Search, Download, X, Save, Pencil,
  Plus, Trash2, Phone, StickyNote, AlertCircle,
} from "lucide-react";
import EtudiantCard from "../components/EtudiantCard";
import ExportModal from "../components/ExportModal";
import { exportCSV, exportJSON, exportExcel } from "../lib/exports";

const INPUT_CLASS =
  "bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent w-full text-sm";

const emptyForm = {
  nom: "", prenom: "", email: "", numero_etudiant: "",
  telephone: "", notes_admin: "", champs_custom: [],
};

export default function Etudiants() {
  const [etudiants, setEtudiants] = useState([]);
  const [pretsActifs, setPretsActifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recherche, setRecherche] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editEtudiant, setEditEtudiant] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editLoading, setEditLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [etudRes, pretsRes] = await Promise.all([
        supabase.from("etudiants").select("*").order("date_inscription", { ascending: false }),
        supabase.from("prets").select("*, livres(titre)").eq("rendu", false),
      ]);
      if (etudRes.error) throw etudRes.error;
      if (pretsRes.error) throw pretsRes.error;
      setEtudiants(etudRes.data || []);
      setPretsActifs(pretsRes.data || []);
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
    return Object.entries(raw).map(([key, value]) => ({ key, value: String(value) }));
  };

  // Transforme [{ key, value }] → { key: value } pour stockage
  const serializeCustomFields = (arr) => {
    const obj = {};
    arr.forEach(({ key, value }) => { if (key.trim()) obj[key.trim()] = value; });
    return obj;
  };

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
        if (err.code === "23505") setError("Cet email ou numéro étudiant existe déjà.");
        else throw err;
        return;
      }
      setForm(emptyForm);
      setShowForm(false);
      setError("");
      await fetchData();
    } catch (err) {
      setError("Erreur lors de l'ajout : " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet étudiant ?")) return;
    try {
      const { error: err } = await supabase.from("etudiants").delete().eq("id", id);
      if (err) throw err;
      setEtudiants((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError("Erreur lors de la suppression : " + err.message);
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
      const { error: err } = await supabase.from("etudiants").update(payload).eq("id", editEtudiant.id);
      if (err) throw err;
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
      "Date inscription": e.date_inscription ? new Date(e.date_inscription).toLocaleDateString("fr-FR") : "",
      Notes: e.notes_admin || "",
    }));
    const filename = `etudiants_${new Date().toISOString().slice(0, 10)}`;
    if (format === "csv") exportCSV(rows, filename);
    else if (format === "excel") exportExcel(rows, filename, "Étudiants");
    else exportJSON(rows, filename);
  };

  const getLivresEmpruntes = (etudiantId) =>
    pretsActifs.filter((p) => p.etudiant_id === etudiantId).map((p) => p.livres?.titre || "Titre inconnu");

  const etudiantsFiltres = etudiants.filter((e) => {
    const q = recherche.toLowerCase();
    return (
      e.nom?.toLowerCase().includes(q) ||
      e.prenom?.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q) ||
      e.numero_etudiant?.toLowerCase().includes(q) ||
      e.telephone?.toLowerCase().includes(q)
    );
  });

  // Formulaire custom fields helper
  const CustomFieldsEditor = ({ fields, onChange }) => {
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
            <button type="button" onClick={() => removeField(i)} className="text-biblio-muted hover:text-biblio-danger transition-colors shrink-0">
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
            {etudiants.length} étudiant{etudiants.length !== 1 ? "s" : ""} inscrit{etudiants.length !== 1 ? "s" : ""}
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
            <UserPlus className="w-5 h-5" />
            Ajouter un étudiant
          </button>
        </div>
      </div>

      {/* Formulaire d'ajout */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-biblio-card rounded-xl border border-white/10 p-6 space-y-5">
          <h2 className="text-lg font-semibold">Nouvel étudiant</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-biblio-muted block mb-1">Prénom *</label>
              <input required value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} placeholder="Prénom" className={INPUT_CLASS} />
            </div>
            <div>
              <label className="text-xs font-medium text-biblio-muted block mb-1">Nom *</label>
              <input required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Nom" className={INPUT_CLASS} />
            </div>
            <div>
              <label className="text-xs font-medium text-biblio-muted block mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className={INPUT_CLASS} />
            </div>
            <div>
              <label className="text-xs font-medium text-biblio-muted block mb-1">Numéro étudiant</label>
              <input value={form.numero_etudiant} onChange={(e) => setForm({ ...form, numero_etudiant: e.target.value })} placeholder="Numéro étudiant" className={INPUT_CLASS} />
            </div>
            <div>
              <label className="text-xs font-medium text-biblio-muted block mb-1 flex items-center gap-1"><Phone className="w-3 h-3" /> Téléphone</label>
              <input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="+213…" className={INPUT_CLASS} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-biblio-muted block mb-1 flex items-center gap-1"><StickyNote className="w-3 h-3" /> Notes administrateur</label>
              <textarea rows={2} value={form.notes_admin} onChange={(e) => setForm({ ...form, notes_admin: e.target.value })} placeholder="Notes internes…" className={INPUT_CLASS + " resize-none"} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-biblio-muted block mb-2">Champs personnalisés</label>
              <CustomFieldsEditor fields={form.champs_custom} onChange={(v) => setForm({ ...form, champs_custom: v })} />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="px-5 py-2.5 bg-biblio-success hover:bg-biblio-success/80 text-white rounded-lg font-medium transition-colors">Enregistrer</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg font-medium transition-colors">Annuler</button>
          </div>
        </form>
      )}

      {error && (
        <div className="bg-biblio-danger/10 text-biblio-danger p-4 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {/* Recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-biblio-muted" />
        <input
          type="text"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un étudiant (nom, prénom, email, numéro, téléphone)…"
          className="w-full bg-biblio-card border border-white/10 rounded-lg pl-10 pr-4 py-3 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent"
        />
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-biblio-accent" /></div>
      ) : etudiantsFiltres.length === 0 ? (
        <div className="text-center py-12 text-biblio-muted">
          {recherche ? "Aucun étudiant trouvé." : "Aucun étudiant inscrit. Ajoutez-en un !"}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {etudiantsFiltres.map((etudiant) => (
            <EtudiantCard
              key={etudiant.id}
              etudiant={etudiant}
              livresEmpruntes={getLivresEmpruntes(etudiant.id)}
              onDelete={handleDelete}
              onEdit={openEdit}
            />
          ))}
        </div>
      )}

      {/* Modal édition étudiant */}
      {editEtudiant && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4">
          <div className="bg-biblio-card rounded-2xl border border-white/10 w-full max-w-xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Pencil className="w-5 h-5 text-biblio-accent" /> Modifier l'étudiant
              </h2>
              <button onClick={() => setEditEtudiant(null)} className="text-biblio-muted hover:text-biblio-text">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSave} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-biblio-muted block mb-1">Prénom *</label>
                  <input required value={editForm.prenom} onChange={(e) => setEditForm({ ...editForm, prenom: e.target.value })} placeholder="Prénom" className={INPUT_CLASS} />
                </div>
                <div>
                  <label className="text-xs font-medium text-biblio-muted block mb-1">Nom *</label>
                  <input required value={editForm.nom} onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })} placeholder="Nom" className={INPUT_CLASS} />
                </div>
                <div>
                  <label className="text-xs font-medium text-biblio-muted block mb-1">Email</label>
                  <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className={INPUT_CLASS} />
                </div>
                <div>
                  <label className="text-xs font-medium text-biblio-muted block mb-1">Numéro étudiant</label>
                  <input value={editForm.numero_etudiant} onChange={(e) => setEditForm({ ...editForm, numero_etudiant: e.target.value })} className={INPUT_CLASS} />
                </div>
                <div>
                  <label className="text-xs font-medium text-biblio-muted block mb-1 flex items-center gap-1"><Phone className="w-3 h-3" /> Téléphone</label>
                  <input value={editForm.telephone} onChange={(e) => setEditForm({ ...editForm, telephone: e.target.value })} placeholder="+213…" className={INPUT_CLASS} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-biblio-muted block mb-1 flex items-center gap-1"><StickyNote className="w-3 h-3" /> Notes administrateur</label>
                  <textarea rows={2} value={editForm.notes_admin} onChange={(e) => setEditForm({ ...editForm, notes_admin: e.target.value })} className={INPUT_CLASS + " resize-none"} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-biblio-muted block mb-2">Champs personnalisés</label>
                  <CustomFieldsEditor fields={editForm.champs_custom} onChange={(v) => setEditForm({ ...editForm, champs_custom: v })} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={editLoading} className="flex-1 py-2.5 bg-biblio-accent hover:bg-biblio-accent-hover disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
                  {editLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Enregistrer
                </button>
                <button type="button" onClick={() => setEditEtudiant(null)} className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg font-medium transition-colors">Annuler</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showExportModal && (
        <ExportModal
          title="Exporter les étudiants"
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
        />
      )}
    </div>
  );

}
