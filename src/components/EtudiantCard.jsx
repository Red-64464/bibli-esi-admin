import { Trash2, BookOpen, Pencil, Phone, User, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

// Normalise champs_custom : supporte array [{key,value}] ou object {key:value}
function normalizeCustomFields(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((item) => [item.key, item.value]);
  return Object.entries(raw);
}

export default function EtudiantCard({
  etudiant,
  livresEmpruntes = [],
  hasRetard = false,
  onDelete,
  onEdit,
  onNouveauPret,
}) {
  const customFields = normalizeCustomFields(etudiant.champs_custom);
  const initials =
    (etudiant.prenom?.[0] || "").toUpperCase() +
    (etudiant.nom?.[0] || "").toUpperCase();

  return (
    <div className="bg-biblio-card rounded-xl border border-white/10 p-5 space-y-3 transition-all hover:border-white/20">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 min-w-0">
          {/* Avatar */}
          {etudiant.photo ? (
            <img
              src={etudiant.photo}
              alt={`${etudiant.prenom} ${etudiant.nom}`}
              className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-biblio-accent/20 flex items-center justify-center text-biblio-accent text-sm font-bold border border-biblio-accent/20 shrink-0">
              {initials || <User className="w-4 h-4" />}
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-biblio-text">
                {etudiant.prenom} {etudiant.nom}
              </h3>
              {hasRetard && (
                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-biblio-danger/20 text-biblio-danger font-medium shrink-0">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  RETARD
                </span>
              )}
            </div>
            <p className="text-sm text-biblio-muted truncate">
              {etudiant.email || "Pas d'email"}
            </p>
            <p className="text-xs text-biblio-muted font-mono mt-0.5">
              N° {etudiant.numero_etudiant || "—"}
            </p>
            {etudiant.telephone && (
              <p className="text-xs text-biblio-muted flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3" />
                {etudiant.telephone}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onEdit && (
            <button
              onClick={() => onEdit(etudiant)}
              className="p-1.5 rounded-lg text-biblio-muted hover:text-biblio-text hover:bg-white/10 transition-colors"
              title="Modifier"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onDelete(etudiant.id)}
            className="p-1.5 rounded-lg text-biblio-muted hover:text-biblio-danger hover:bg-biblio-danger/10 transition-colors"
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Champs personnalisés */}
      {customFields.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {customFields.map(([key, value]) => (
            <span
              key={key}
              className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-biblio-muted border border-white/10"
            >
              {key}: <span className="text-biblio-text">{value}</span>
            </span>
          ))}
        </div>
      )}

      {/* Livres empruntés */}
      {livresEmpruntes.length > 0 && (
        <div className="pt-2 border-t border-white/10">
          <p className="text-xs text-biblio-muted mb-2 flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            Livres empruntés ({livresEmpruntes.length})
          </p>
          <div className="space-y-1">
            {livresEmpruntes.map((titre, i) => (
              <p
                key={i}
                className="text-sm text-biblio-text pl-2 border-l-2 border-biblio-accent line-clamp-1"
              >
                {titre}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Notes admin */}
      {etudiant.notes_admin && (
        <div className="pt-2 border-t border-white/10">
          <p className="text-xs text-biblio-muted italic line-clamp-2">
            {etudiant.notes_admin}
          </p>
        </div>
      )}

      {/* Actions bas de carte */}
      <div className="flex gap-2 pt-2 border-t border-white/10">
        <Link
          to={`/etudiants/${etudiant.id}`}
          className="flex-1 text-center px-3 py-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 text-biblio-muted hover:text-biblio-text rounded-lg transition-colors"
        >
          Voir profil
        </Link>
        {onNouveauPret && (
          <button
            onClick={() => onNouveauPret(etudiant)}
            className="flex-1 px-3 py-1.5 text-xs font-medium bg-biblio-accent/10 hover:bg-biblio-accent/20 text-biblio-accent rounded-lg transition-colors"
          >
            + Nouveau prêt
          </button>
        )}
      </div>
    </div>
  );
}
