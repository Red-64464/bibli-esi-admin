import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getPretStatut, formatDate } from "../lib/utils";
import {
  ArrowLeft,
  User,
  BookOpen,
  Loader2,
  AlertCircle,
  Phone,
  Mail,
  Hash,
  Clock,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

function StatusBadge({ statut }) {
  const map = {
    en_cours: "bg-biblio-warning/20 text-biblio-warning",
    en_retard: "bg-biblio-danger/20 text-biblio-danger",
    retourné: "bg-biblio-success/20 text-biblio-success",
    perdu: "bg-biblio-danger/20 text-biblio-danger",
  };
  const labels = {
    en_cours: "En cours",
    en_retard: "En retard",
    retourné: "Rendu",
    perdu: "Perdu",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[statut] || "bg-white/10 text-biblio-muted"}`}
    >
      {labels[statut] || statut}
    </span>
  );
}

export default function EtudiantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [etudiant, setEtudiant] = useState(null);
  const [prets, setPrets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [etudRes, pretsRes] = await Promise.all([
        supabase.from("etudiants").select("*").eq("id", id).single(),
        supabase
          .from("prets")
          .select("*, livres(titre, isbn, auteur)")
          .eq("etudiant_id", id)
          .order("date_pret", { ascending: false }),
      ]);
      if (etudRes.error) throw etudRes.error;
      if (pretsRes.error) throw pretsRes.error;
      setEtudiant(etudRes.data);
      setPrets(pretsRes.data || []);
    } catch (err) {
      setError("Impossible de charger le profil : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const pretsEnCours = prets.filter((p) => {
    const s = getPretStatut(p);
    return s === "en_cours" || s === "en_retard";
  });
  const historique = prets.filter((p) => getPretStatut(p) === "retourné");
  const hasRetard = prets.some((p) => getPretStatut(p) === "en_retard");

  // Normalise champs_custom : supporte array [{key, value}] ou object {key: value}
  const normalizeCustomFields = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map((item) => [item.key, item.value]);
    return Object.entries(raw);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-biblio-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-biblio-danger/10 text-biblio-danger p-4 rounded-lg flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        {error}
      </div>
    );
  }

  if (!etudiant) return null;

  const customFields = normalizeCustomFields(etudiant.champs_custom);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-biblio-muted hover:text-biblio-text transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <User className="w-7 h-7 text-biblio-accent" />
            {etudiant.prenom} {etudiant.nom}
          </h1>
          <p className="text-biblio-muted text-sm mt-0.5">
            Profil étudiant
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Carte profil */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-biblio-card rounded-xl border border-white/10 p-6 space-y-4">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              {etudiant.photo ? (
                <img
                  src={etudiant.photo}
                  alt={`${etudiant.prenom} ${etudiant.nom}`}
                  className="w-20 h-20 rounded-full object-cover border-2 border-biblio-accent"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-biblio-accent/20 flex items-center justify-center text-biblio-accent text-2xl font-bold border-2 border-biblio-accent/30">
                  {etudiant.prenom?.[0]?.toUpperCase()}
                  {etudiant.nom?.[0]?.toUpperCase()}
                </div>
              )}
              <div className="text-center">
                <h2 className="font-semibold text-biblio-text">
                  {etudiant.prenom} {etudiant.nom}
                </h2>
                {hasRetard && (
                  <span className="inline-flex items-center gap-1 mt-1 text-xs px-2 py-0.5 rounded-full bg-biblio-danger/20 text-biblio-danger font-medium">
                    <AlertTriangle className="w-3 h-3" />
                    RETARD
                  </span>
                )}
              </div>
            </div>

            {/* Infos contact */}
            <div className="space-y-2 text-sm border-t border-white/10 pt-4">
              {etudiant.email && (
                <div className="flex items-center gap-2 text-biblio-muted">
                  <Mail className="w-4 h-4 shrink-0" />
                  <span className="truncate">{etudiant.email}</span>
                </div>
              )}
              {etudiant.telephone && (
                <div className="flex items-center gap-2 text-biblio-muted">
                  <Phone className="w-4 h-4 shrink-0" />
                  <span>{etudiant.telephone}</span>
                </div>
              )}
              {etudiant.numero_etudiant && (
                <div className="flex items-center gap-2 text-biblio-muted">
                  <Hash className="w-4 h-4 shrink-0" />
                  <span className="font-mono">{etudiant.numero_etudiant}</span>
                </div>
              )}
              {etudiant.created_at && (
                <div className="flex items-center gap-2 text-biblio-muted">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>Inscrit le {formatDate(etudiant.created_at)}</span>
                </div>
              )}
            </div>

            {/* Champs personnalisés */}
            {customFields.length > 0 && (
              <div className="border-t border-white/10 pt-4">
                <p className="text-xs font-medium text-biblio-muted mb-2">
                  Champs personnalisés
                </p>
                <div className="space-y-1">
                  {customFields.map(([key, value]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-biblio-muted">{key}</span>
                      <span className="text-biblio-text font-medium">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes admin */}
            {etudiant.notes_admin && (
              <div className="border-t border-white/10 pt-4">
                <p className="text-xs font-medium text-biblio-muted mb-1">
                  Notes
                </p>
                <p className="text-xs text-biblio-text italic">
                  {etudiant.notes_admin}
                </p>
              </div>
            )}

            {/* Stats rapides */}
            <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-biblio-accent">
                  {pretsEnCours.length}
                </p>
                <p className="text-xs text-biblio-muted">En cours</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-biblio-success">
                  {historique.length}
                </p>
                <p className="text-xs text-biblio-muted">Rendus</p>
              </div>
            </div>
          </div>
        </div>

        {/* Prêts en cours + historique */}
        <div className="lg:col-span-2 space-y-6">
          {/* Prêts en cours */}
          <div className="bg-biblio-card rounded-xl border border-white/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-biblio-accent" />
              <h3 className="font-semibold text-biblio-text">
                Prêts en cours ({pretsEnCours.length})
              </h3>
            </div>
            {pretsEnCours.length === 0 ? (
              <div className="flex items-center gap-2 px-6 py-4 text-biblio-muted text-sm">
                <CheckCircle className="w-4 h-4 text-biblio-success" />
                Aucun prêt en cours
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {pretsEnCours.map((p) => {
                  const statut = getPretStatut(p);
                  return (
                    <div key={p.id} className="px-6 py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-biblio-text line-clamp-1">
                          {p.livres?.titre || "—"}
                        </p>
                        <p className="text-xs text-biblio-muted">
                          Prêté le {formatDate(p.date_pret)}
                          {p.date_retour_prevue && ` · Retour prévu : ${formatDate(p.date_retour_prevue)}`}
                        </p>
                      </div>
                      <StatusBadge statut={statut} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Historique */}
          <div className="bg-biblio-card rounded-xl border border-white/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10">
              <h3 className="font-semibold text-biblio-text">
                Historique ({historique.length})
              </h3>
            </div>
            {historique.length === 0 ? (
              <p className="px-6 py-4 text-biblio-muted text-sm">
                Aucun prêt dans l&apos;historique.
              </p>
            ) : (
              <div className="divide-y divide-white/5">
                {historique.map((p) => (
                  <div key={p.id} className="px-6 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-biblio-text line-clamp-1">
                        {p.livres?.titre || "—"}
                      </p>
                      <p className="text-xs text-biblio-muted">
                        Prêté {formatDate(p.date_pret)}
                        {p.date_retour && ` · Rendu ${formatDate(p.date_retour)}`}
                      </p>
                    </div>
                    <StatusBadge statut="retourné" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
