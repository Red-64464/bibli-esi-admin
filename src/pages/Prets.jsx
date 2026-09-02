import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { logActivity } from "../lib/activityLog";
import { useAuth } from "../contexts/AuthContext";
import { getPretStatut, useDebounce, formatDate } from "../lib/utils";
import { getSettings } from "../lib/settings";
import { sendEmail, buildLoanConfirmationEmail } from "../lib/email";
import { useRealtimeTables } from "../lib/realtime";
import {
  ArrowLeftRight,
  Loader2,
  Plus,
  Download,
  AlertCircle,
  Search,
  Save,
  X,
} from "lucide-react";
import PretRow, { PretCard } from "../components/PretRow";
import ExportModal from "../components/ExportModal";
import ConfirmModal from "../components/ConfirmModal";
import ISBNScanner from "../components/ISBNScanner";
import Pagination from "../components/Pagination";
import { exportCSV, exportJSON, exportExcel } from "../lib/exports";
import { loanSchema, parseOrMessage } from "../lib/validation";
import { enqueueOfflineAction, shouldQueueWriteError } from "../lib/offlineQueue";

const INPUT_CLASS =
  "bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent";

const PAGE_SIZE = 25;

export default function Prets() {
  const { session } = useAuth();
  const location = useLocation();
  const [prets, setPrets] = useState([]);
  const [livres, setLivres] = useState([]);
  const [etudiants, setEtudiants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [filtre, setFiltre] = useState("en_cours");
  const [showExportModal, setShowExportModal] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounce(searchInput, 300);
  const [page, setPage] = useState(1);
  const [confirmReturn, setConfirmReturn] = useState(null); // {pretId, livreId}
  const [maxBooks, setMaxBooks] = useState(3);
  const [showStudentScanner, setShowStudentScanner] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [editPret, setEditPret] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

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
    getSettings().then((s) =>
      setMaxBooks(parseInt(s.max_books_per_student) || 3),
    );
  }, []);

  useEffect(() => {
    const livreId = location.state?.livreId;
    if (!livreId) return;
    setForm((current) => ({ ...current, livre_id: livreId }));
    setShowForm(true);
  }, [location.state?.livreId]);

  useRealtimeTables(["bibli_prets", "bibli_livres", "bibli_etudiants", "bibli_settings"], () => fetchData());

  // Reset page quand filtre ou search change
  useEffect(() => {
    setPage(1);
  }, [filtre, search]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pretsRes, livresRes, etudiantsRes] = await Promise.all([
        supabase
          .from("bibli_prets")
          .select("*, livres:bibli_livres(titre, isbn), etudiants:bibli_etudiants(nom, prenom, email, numero_etudiant)")
          .order("date_pret", { ascending: false }),
        supabase
          .from("bibli_livres")
          .select("id, titre, isbn")
          .eq("disponible", true),
        supabase
          .from("bibli_etudiants")
          .select("id, nom, prenom, email, numero_etudiant"),
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

  const filteredEtudiantsForForm = etudiants.filter((etudiant) => {
    const q = studentSearch.trim().toLowerCase();
    if (etudiant.id === form.etudiant_id || etudiant.id === editForm?.etudiant_id) return true;
    if (!q) return true;
    return (
      etudiant.numero_etudiant?.toLowerCase().includes(q) ||
      etudiant.email?.toLowerCase().includes(q) ||
      etudiant.nom?.toLowerCase().includes(q) ||
      etudiant.prenom?.toLowerCase().includes(q) ||
      `${etudiant.prenom || ""} ${etudiant.nom || ""}`.toLowerCase().includes(q)
    );
  });

  const openEditPret = (pret) => {
    setEditPret(pret);
    setStudentSearch("");
    setEditForm({
      livre_id: pret.livre_id || "",
      etudiant_id: pret.etudiant_id || "",
      date_pret: pret.date_pret || today,
      date_retour_prevue: pret.date_retour_prevue || "",
      date_rappel: pret.date_rappel || "",
      notes: pret.notes || "",
    });
  };

  const handleCreatePret = async (e) => {
    e.preventDefault();
    if (!form.livre_id || !form.etudiant_id) return;
    try {
      const { data: validatedLoan, error: validationError } = parseOrMessage(loanSchema, form);
      if (validationError) {
        setError(validationError);
        return;
      }
      const { data: currentBook, error: bookCheckError } = await supabase
        .from("bibli_livres")
        .select("id, titre, disponible")
        .eq("id", validatedLoan.livre_id)
        .maybeSingle();
      if (bookCheckError) throw bookCheckError;
      if (!currentBook || !currentBook.disponible) {
        setError("Ce livre vient d'être emprunté. Actualisez la liste et choisissez un autre livre.");
        await fetchData();
        return;
      }
      // Vérifier le quota max_books_per_student
      const { count } = await supabase
        .from("bibli_prets")
        .select("id", { count: "exact", head: true })
        .eq("etudiant_id", validatedLoan.etudiant_id)
        .eq("rendu", false);
      if (maxBooks > 0 && (count || 0) >= maxBooks) {
        setError(
          `Cet étudiant a déjà ${count} prêt(s) en cours. Le maximum autorisé est ${maxBooks}.`,
        );
        return;
      }

      const { data: createdLoan, error: err1 } = await supabase.from("bibli_prets").insert([
        {
          ...validatedLoan,
          statut: "en_cours",
          rendu: false,
        },
      ]).select("id").single();
      if (err1) throw err1;

      const { error: err2 } = await supabase
        .from("bibli_livres")
        .update({ disponible: false, statut: "emprunte" })
        .eq("id", validatedLoan.livre_id);
      if (err2) {
        await supabase.from("bibli_prets").delete().eq("id", createdLoan.id);
        throw err2;
      }

      // Journaliser l'activité
      const livreNom =
        livres.find((l) => l.id === validatedLoan.livre_id)?.titre || validatedLoan.livre_id;
      const etudNom = etudiants.find((e) => e.id === validatedLoan.etudiant_id);
      await logActivity({
        action_type: "pret_cree",
        description: `${etudNom ? `${etudNom.prenom} ${etudNom.nom}` : "Étudiant"} a emprunté « ${livreNom} »`,
        user_info: session?.username || "",
      });

      // Envoyer email de confirmation si l'étudiant a un email
      if (etudNom?.email) {
        const { subject, text, titre: t, dateRetour: dr, templateType } = buildLoanConfirmationEmail({
          prenom: etudNom.prenom,
          nom: etudNom.nom,
          titre: livreNom,
          datePret: validatedLoan.date_pret,
          dateRetour: validatedLoan.date_retour_prevue,
        });
        sendEmail({ to: etudNom.email, toName: `${etudNom.prenom} ${etudNom.nom}`, subject, text, titre: t, dateRetour: dr, templateType }); // fire & forget
      }

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
      if (shouldQueueWriteError(err)) {
        const { data: validatedLoan } = parseOrMessage(loanSchema, form);
        if (validatedLoan) {
          await enqueueOfflineAction({
            type: "loan:create",
            label: `Prêt : ${livres.find((l) => l.id === validatedLoan.livre_id)?.titre || "livre"}`,
            payload: {
              ...validatedLoan,
              statut: "en_cours",
              rendu: false,
            },
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
          setError("Supabase est indisponible : le prêt est sauvegardé localement et sera synchronisé plus tard.");
          return;
        }
      }
      setError("Erreur lors du prêt : " + err.message);
    }
  };

  const handleEditPretSave = async (e) => {
    e.preventDefault();
    if (!editPret || !editForm?.livre_id || !editForm?.etudiant_id) return;
    setEditLoading(true);
    setError("");
    try {
      const oldLivreId = editPret.livre_id;
      const isActivePret = getPretStatut(editPret) !== "retourné";
      const { data: validatedLoan, error: validationError } = parseOrMessage(loanSchema, editForm);
      if (validationError) {
        setError(validationError);
        return;
      }
      const newLivreId = validatedLoan.livre_id;
      if (isActivePret && oldLivreId !== newLivreId) {
        const { data: replacementBook, error: replacementError } = await supabase
          .from("bibli_livres")
          .select("id, titre, disponible")
          .eq("id", newLivreId)
          .maybeSingle();
        if (replacementError) throw replacementError;
        if (!replacementBook || !replacementBook.disponible) {
          setError("Le nouveau livre n'est plus disponible. Choisissez un livre disponible.");
          await fetchData();
          return;
        }
      }
      if (isActivePret && validatedLoan.etudiant_id !== editPret.etudiant_id && maxBooks > 0) {
        const { count, error: countError } = await supabase
          .from("bibli_prets")
          .select("id", { count: "exact", head: true })
          .eq("etudiant_id", validatedLoan.etudiant_id)
          .eq("rendu", false)
          .neq("id", editPret.id);
        if (countError) throw countError;
        if ((count || 0) >= maxBooks) {
          setError(`Cet étudiant a déjà ${count} prêt(s) en cours. Le maximum autorisé est ${maxBooks}.`);
          return;
        }
      }
      const payload = {
        ...validatedLoan,
      };

      const { error: updateError } = await supabase
        .from("bibli_prets")
        .update(payload)
        .eq("id", editPret.id);
      if (updateError) throw updateError;

      if (isActivePret && oldLivreId !== newLivreId) {
        const { error: oldBookError } = await supabase
          .from("bibli_livres")
          .update({ disponible: true, statut: "disponible" })
          .eq("id", oldLivreId);
        if (oldBookError) throw oldBookError;
        const { error: newBookError } = await supabase
          .from("bibli_livres")
          .update({ disponible: false, statut: "emprunte" })
          .eq("id", newLivreId);
        if (newBookError) throw newBookError;
      }

      const livreNom = livres.find((l) => l.id === newLivreId)?.titre || editPret.livres?.titre || editPret.bibli_livres?.titre || "Livre";
      const etudiant = etudiants.find((item) => item.id === validatedLoan.etudiant_id);
      await logActivity({
        action_type: "pret_modifie",
        description: `Prêt « ${livreNom} » modifié${etudiant ? ` pour ${etudiant.prenom} ${etudiant.nom}` : ""}`,
        user_info: session?.username || "",
      });

      setEditPret(null);
      setEditForm(null);
      await fetchData();
    } catch (err) {
      setError("Erreur lors de la modification du prêt : " + err.message);
    } finally {
      setEditLoading(false);
    }
  };

  const handleReturn = async (pretId, livreId) => {
    // Ouvrir la modale de confirmation
    setConfirmReturn({ pretId, livreId });
  };

  const doReturn = async (pretId, livreId) => {
    try {
      const { error: err1 } = await supabase
        .from("bibli_prets")
        .update({
          rendu: true,
          date_retour: new Date().toISOString(),
          statut: "retourné",
        })
        .eq("id", pretId);
      if (err1) throw err1;
      const { error: err2 } = await supabase
        .from("bibli_livres")
        .update({ disponible: true, statut: "disponible" })
        .eq("id", livreId);
      if (err2) throw err2;

      // Journaliser le retour
      const pret = prets.find((p) => p.id === pretId);
      await logActivity({
        action_type: "pret_retourne",
        description: `Livre « ${(pret?.livres ?? pret?.bibli_livres)?.titre || "—"} » retourné${(pret?.etudiants ?? pret?.bibli_etudiants) ? ` par ${(pret.etudiants ?? pret.bibli_etudiants).prenom} ${(pret.etudiants ?? pret.bibli_etudiants).nom}` : ""}`,
        user_info: session?.username || "",
      });

      await fetchData();
    } catch (err) {
      setError("Erreur lors du retour : " + err.message);
    } finally {
      setConfirmReturn(null);
    }
  };

  const handleExport = async (format) => {
    const { data } = await supabase
      .from("bibli_prets")
      .select("*, livres:bibli_livres(titre, isbn), etudiants:bibli_etudiants(nom, prenom, email)");
    const rows = (data || []).map((p) => ({
      Livre: (p.livres ?? p.bibli_livres)?.titre || "",
      ISBN: (p.livres ?? p.bibli_livres)?.isbn || "",
      Étudiant: (p.etudiants ?? p.bibli_etudiants) ? `${(p.etudiants ?? p.bibli_etudiants).prenom} ${(p.etudiants ?? p.bibli_etudiants).nom}` : "",
      Email: (p.etudiants ?? p.bibli_etudiants)?.email || "",
      "Date de prêt": formatDate(p.date_pret),
      "Retour prévu": formatDate(p.date_retour_prevue),
      Rappel: formatDate(p.date_rappel),
      Statut: getPretStatut(p),
      Notes: p.notes || "",
    }));
    const filename = `prets_${new Date().toISOString().slice(0, 10)}`;
    if (format === "csv") exportCSV(rows, filename);
    else if (format === "excel") exportExcel(rows, filename, "Prêts");
    else exportJSON(rows, filename);
  };

  const handleStudentScan = (raw) => {
    setShowStudentScanner(false);
    // Try matching by numero_etudiant, email, or ID
    const cleaned = raw.trim();
    const found = etudiants.find(
      (e) =>
        e.numero_etudiant === cleaned ||
        e.email === cleaned ||
        e.id === cleaned,
    );
    if (found) {
      setForm((f) => ({ ...f, etudiant_id: found.id }));
    } else {
      setError(`Aucun étudiant trouvé pour le code scanné: ${cleaned}`);
    }
  };

  const pretsFiltres = prets.filter((p) => {
    const s = getPretStatut(p);
    // Filtre par statut
    if (filtre === "en_cours" && s !== "en_cours") return false;
    if (filtre === "en_retard" && s !== "en_retard") return false;
    if (filtre === "historique" && s !== "retourné") return false;
    // Filtre par recherche
    if (search) {
      const q = search.toLowerCase();
      const livreMatch = ((p.livres ?? p.bibli_livres)?.titre || "").toLowerCase().includes(q);
      const etudiant = p.etudiants ?? p.bibli_etudiants;
      const etudMatch = etudiant
        ? `${etudiant.prenom} ${etudiant.nom} ${etudiant.email || ""} ${etudiant.numero_etudiant || ""}`.toLowerCase().includes(q)
        : false;
      if (!livreMatch && !etudMatch) return false;
    }
    return true;
  });

  const pretsEnRetardCount = prets.filter(
    (p) => getPretStatut(p) === "en_retard",
  ).length;

  const totalPages = Math.max(1, Math.ceil(pretsFiltres.length / PAGE_SIZE));
  const pretsPaged = pretsFiltres.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );
  const editBookOptions = editPret && !livres.some((livre) => livre.id === editPret.livre_id)
    ? [
        {
          id: editPret.livre_id,
          titre: (editPret.livres ?? editPret.bibli_livres)?.titre || "Livre actuel",
          isbn: (editPret.livres ?? editPret.bibli_livres)?.isbn || "",
        },
        ...livres,
      ]
    : livres;

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
              <input
                type="search"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Chercher par matricule, nom ou prénom"
                className={INPUT_CLASS + " w-full mb-2"}
              />
              <div className="flex gap-2">
                <select
                  value={form.etudiant_id}
                  onChange={(e) =>
                    setForm({ ...form, etudiant_id: e.target.value })
                  }
                  required
                  className={INPUT_CLASS + " flex-1"}
                  style={{ colorScheme: "dark" }}
                >
                  <option value="">-- Choisir un étudiant --</option>
                  {filteredEtudiantsForForm.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.prenom} {e.nom} ({e.numero_etudiant || "sans numéro"})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowStudentScanner(true)}
                  className="px-3 py-2 bg-biblio-accent/20 text-biblio-accent rounded-lg hover:bg-biblio-accent/30 transition-colors text-xs font-medium whitespace-nowrap"
                >
                  Scanner carte
                </button>
              </div>
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

      {/* Barre de recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-biblio-muted pointer-events-none" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Rechercher par livre ou étudiant…"
          className={INPUT_CLASS + " w-full pl-10"}
        />
      </div>

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
                  {pretsPaged.map((pret) => (
                    <PretRow
                      key={pret.id}
                      pret={pret}
                      onReturn={handleReturn}
                      onEdit={openEditPret}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile : cartes */}
          <div className="md:hidden space-y-3">
            {pretsPaged.map((pret) => (
              <PretCard
                key={pret.id}
                pret={pret}
                onReturn={handleReturn}
                onEdit={openEditPret}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPage={setPage} />
          )}
        </>
      )}

      {editPret && editForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4">
          <div className="bg-biblio-card rounded-2xl border border-white/10 w-full max-w-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-biblio-accent" />
                Modifier le prêt
              </h2>
              <button
                onClick={() => {
                  setEditPret(null);
                  setEditForm(null);
                }}
                className="text-biblio-muted hover:text-biblio-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditPretSave} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-biblio-muted block mb-1">
                    Livre *
                  </label>
                  <select
                    value={editForm.livre_id}
                    onChange={(e) => setEditForm({ ...editForm, livre_id: e.target.value })}
                    required
                    className={INPUT_CLASS + " w-full"}
                    style={{ colorScheme: "dark" }}
                  >
                    <option value="">-- Choisir un livre --</option>
                    {editBookOptions.map((livre) => (
                      <option key={livre.id} value={livre.id}>
                        {livre.titre} (ISBN: {livre.isbn || "—"})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-biblio-muted block mb-1">
                    Étudiant *
                  </label>
                  <input
                    type="search"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Chercher par matricule, nom ou prénom"
                    className={INPUT_CLASS + " w-full mb-2"}
                  />
                  <select
                    value={editForm.etudiant_id}
                    onChange={(e) => setEditForm({ ...editForm, etudiant_id: e.target.value })}
                    required
                    className={INPUT_CLASS + " w-full"}
                    style={{ colorScheme: "dark" }}
                  >
                    <option value="">-- Choisir un étudiant --</option>
                    {filteredEtudiantsForForm.map((etudiant) => (
                      <option key={etudiant.id} value={etudiant.id}>
                        {etudiant.prenom} {etudiant.nom} ({etudiant.numero_etudiant || "sans numéro"})
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
                    value={editForm.date_pret}
                    onChange={(e) => setEditForm({ ...editForm, date_pret: e.target.value })}
                    className={INPUT_CLASS + " w-full"}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-biblio-muted block mb-1">
                    Date de retour prévue
                  </label>
                  <input
                    type="date"
                    value={editForm.date_retour_prevue}
                    onChange={(e) => setEditForm({ ...editForm, date_retour_prevue: e.target.value })}
                    className={INPUT_CLASS + " w-full"}
                    min={editForm.date_pret}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-biblio-muted block mb-1">
                    Date de rappel
                  </label>
                  <input
                    type="date"
                    value={editForm.date_rappel}
                    onChange={(e) => setEditForm({ ...editForm, date_rappel: e.target.value })}
                    className={INPUT_CLASS + " w-full"}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-biblio-muted block mb-1">
                    Notes
                  </label>
                  <textarea
                    rows={2}
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    placeholder="Notes sur le prêt…"
                    className={INPUT_CLASS + " w-full resize-none"}
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
                  onClick={() => {
                    setEditPret(null);
                    setEditForm(null);
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

      {showExportModal && (
        <ExportModal
          title="Exporter les prêts"
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
        />
      )}

      {confirmReturn && (
        <ConfirmModal
          title="Confirmer le retour"
          message="Marquer ce prêt comme retourné ?"
          onConfirm={() =>
            doReturn(confirmReturn.pretId, confirmReturn.livreId)
          }
          onCancel={() => setConfirmReturn(null)}
        />
      )}

      {showStudentScanner && (
        <ISBNScanner
          onScan={handleStudentScan}
          onClose={() => setShowStudentScanner(false)}
        />
      )}
    </div>
  );
}
