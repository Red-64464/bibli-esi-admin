import { Trash2, BookOpen, Pencil, Phone } from "lucide-react";

export default function EtudiantCard({
  etudiant,
  livresEmpruntes = [],
  onDelete,
  onEdit,
}) {
  const customFields = etudiant.champs_custom
    ? Object.entries(etudiant.champs_custom)
    : [];

  return (
    <div className="bg-biblio-card rounded-xl border border-white/10 p-5 space-y-3 transition-all hover:border-white/20">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold text-biblio-text">
            {etudiant.prenom} {etudiant.nom}
          </h3>
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
    </div>
  );
}
