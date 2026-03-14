import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { formatDate } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { logActivity } from "../lib/activityLog";
import { useRealtimeTable } from "../lib/realtime";
import {
  BookMarked,
  Loader2,
  Plus,
  AlertCircle,
  CheckCircle,
  Trash2,
  ArrowLeftRight,
} from "lucide-react";
import ConfirmModal from "../components/ConfirmModal";

const INPUT_CLASS =
  "bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent";

const STATUT_STYLE = {
  en_attente: "bg-biblio-warning/20 text-biblio-warning",
  confirmee: "bg-biblio-accent/20 text-biblio-accent",
  convertie: "bg-biblio-success/20 text-biblio-success",
  annulee: "bg-white/10 text-biblio-muted",
};

const STATUT_LABEL = {
  en_attente: "En attente",
  confirmee: "Confirmée",
  convertie: "Convertie en prêt",
  annulee: "Annulée",
};

export default function Reservations() {
  const { session } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [livres, setLivres] = useState([]);
  const [etudiants, setEtudiants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    livre_id: "",
    etudiant_id: "",
    date_souhaitee: "",
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  // Realtime: auto-refresh on reservations changes
  useRealtimeTable("reservations", () => fetchData());

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resRes, livresRes, etudRes] = await Promise.all([
        supabase
          .from("reservations")
          .select("*, livres(titre, isbn), etudiants(nom, prenom)")
          .order("created_at", { ascending: false }),
        supabase.from("livres").select("id, titre, isbn, disponible, statut"),
        supabase.from("etudiants").select("id, nom, prenom, numero_etudiant"),
      ]);
      if (resRes.error) throw resRes.error;
      setReservations(resRes.data || []);
      setLivres(livresRes.data || []);
      setEtudiants(etudRes.data || []);
    } catch (err) {
      setError("Erreur de chargement : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.livre_id || !form.etudiant_id) return;
    try {
      const { error: err } = await supabase.from("reservations").insert([
        {
          livre_id: form.livre_id,
          etudiant_id: form.etudiant_id,
          date_reservation: today,
          date_souhaitee: form.date_souhaitee || null,
          notes: form.notes,
          statut: "en_attente",
        },
      ]);
      if (err) throw err;

      const livreNom =
        livres.find((l) => l.id === form.livre_id)?.titre || form.livre_id;
      const etud = etudiants.find((e) => e.id === form.etudiant_id);
      await logActivity({
        action_type: "reservation_creee",
        description: `Réservation de « ${livreNom} » par ${etud ? `${etud.prenom} ${etud.nom}` : "étudiant"}`,
        user_info: session?.username || "",
      });

      setShowForm(false);
      setForm({ livre_id: "", etudiant_id: "", date_souhaitee: "", notes: "" });
      setError("");
      await fetchData();
    } catch (err) {
      setError("Erreur lors de la réservation : " + err.message);
    }
  };

  const handleConvertToPret = async (res) => {
    try {
      // Créer le prêt
      const defaultRetour = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const { error: err1 } = await supabase.from("prets").insert([
        {
          livre_id: res.livre_id,
          etudiant_id: res.etudiant_id,
          date_pret: today,
          date_retour_prevue: defaultRetour,
          statut: "en_cours",
          rendu: false,
        },
      ]);
      if (err1) throw err1;

      // Marquer le livre comme emprunté
      await supabase
        .from("livres")
        .update({ disponible: false, statut: "emprunté" })
        .eq("id", res.livre_id);

      // Marquer la réservation comme convertie
      const { error: err2 } = await supabase
        .from("reservations")
        .update({ statut: "convertie" })
        .eq("id", res.id);
      if (err2) throw err2;

      await logActivity({
        action_type: "reservation_convertie",
        description: `Réservation de « ${res.livres?.titre} » convertie en prêt`,
        user_info: session?.username || "",
      });

      await fetchData();
    } catch (err) {
      setError("Erreur lors de la conversion : " + err.message);
    }
  };

  const handleCancel = async (id) => {
    try {
      const { error: err } = await supabase
        .from("reservations")
        .update({ statut: "annulee" })
        .eq("id", id);
      if (err) throw err;
      await fetchData();
    } catch (err) {
      setError("Erreur : " + err.message);
    } finally {
      setConfirmDelete(null);
    }
  };

  const activeReservations = reservations.filter(
    (r) => r.statut === "en_attente" || r.statut === "confirmee",
  );
  const doneReservations = reservations.filter(
    (r) => r.statut === "convertie" || r.statut === "annulee",
  );

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BookMarked className="w-8 h-8 text-biblio-accent" />
            Réservations
          </h1>
          <p className="text-biblio-muted mt-1">
            {activeReservations.length} réservation
            {activeReservations.length !== 1 ? "s" : ""} active
            {activeReservations.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-5 py-2.5 bg-biblio-accent hover:bg-biblio-accent-hover text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> Nouvelle réservation
        </button>
      </div>

      {/* Formulaire */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-biblio-card rounded-xl border border-white/10 p-6 space-y-5"
        >
          <h2 className="text-lg font-semibold">Nouvelle réservation</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-biblio-muted block mb-1">
                Livre *
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
                    {l.titre} {!l.disponible ? "(non disponible)" : ""}
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
                Date souhaitée
              </label>
              <input
                type="date"
                value={form.date_souhaitee}
                onChange={(e) =>
                  setForm({ ...form, date_souhaitee: e.target.value })
                }
                className={INPUT_CLASS + " w-full"}
                min={today}
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
                placeholder="Notes…"
                className={INPUT_CLASS + " w-full resize-none"}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="px-5 py-2.5 bg-biblio-success hover:bg-biblio-success/80 text-white rounded-lg font-medium transition-colors"
            >
              Créer la réservation
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

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-biblio-accent" />
        </div>
      ) : (
        <>
          {/* Réservations actives */}
          <div className="bg-biblio-card rounded-xl border border-white/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10">
              <h2 className="font-semibold text-biblio-text">
                Réservations actives ({activeReservations.length})
              </h2>
            </div>
            {activeReservations.length === 0 ? (
              <div className="flex items-center gap-2 px-6 py-4 text-biblio-muted text-sm">
                <CheckCircle className="w-4 h-4 text-biblio-success" />
                Aucune réservation active.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {activeReservations.map((r) => (
                  <div
                    key={r.id}
                    className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-biblio-text">
                        {r.livres?.titre || "—"}
                      </p>
                      <p className="text-xs text-biblio-muted">
                        {r.etudiants
                          ? `${r.etudiants.prenom} ${r.etudiants.nom}`
                          : "—"}{" "}
                        · Réservé le {formatDate(r.date_reservation)}
                        {r.date_souhaitee &&
                          ` · Souhaité pour ${formatDate(r.date_souhaitee)}`}
                      </p>
                      {r.notes && (
                        <p className="text-xs text-biblio-muted italic mt-0.5">
                          {r.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_STYLE[r.statut] || "bg-white/10 text-biblio-muted"}`}
                      >
                        {STATUT_LABEL[r.statut] || r.statut}
                      </span>
                      <button
                        onClick={() => handleConvertToPret(r)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-biblio-accent hover:bg-biblio-accent-hover text-white rounded-lg transition-colors"
                        title="Convertir en prêt"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        Prêt
                      </button>
                      <button
                        onClick={() => setConfirmDelete(r.id)}
                        className="p-1.5 rounded-lg text-biblio-muted hover:text-biblio-danger hover:bg-biblio-danger/10 transition-colors"
                        title="Annuler"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Historique des réservations */}
          {doneReservations.length > 0 && (
            <div className="bg-biblio-card rounded-xl border border-white/10 overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10">
                <h2 className="font-semibold text-biblio-text">
                  Historique ({doneReservations.length})
                </h2>
              </div>
              <div className="divide-y divide-white/5">
                {doneReservations.map((r) => (
                  <div
                    key={r.id}
                    className="px-6 py-3 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-biblio-text line-clamp-1">
                        {r.livres?.titre || "—"}
                      </p>
                      <p className="text-xs text-biblio-muted">
                        {r.etudiants
                          ? `${r.etudiants.prenom} ${r.etudiants.nom}`
                          : "—"}{" "}
                        · {formatDate(r.date_reservation)}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_STYLE[r.statut] || "bg-white/10 text-biblio-muted"}`}
                    >
                      {STATUT_LABEL[r.statut] || r.statut}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Annuler la réservation"
          message="Êtes-vous sûr de vouloir annuler cette réservation ?"
          danger
          onConfirm={() => handleCancel(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
