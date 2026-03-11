import { Trash2, BookOpen } from "lucide-react";

export default function EtudiantCard({
  etudiant,
  livresEmpruntes = [],
  onDelete,
}) {
  return (
    <div className="bg-biblio-card rounded-xl border border-white/10 p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-biblio-text text-lg">
            {etudiant.prenom} {etudiant.nom}
          </h3>
          <p className="text-sm text-biblio-muted">
            {etudiant.email || "Pas d'email"}
          </p>
          <p className="text-xs text-biblio-muted font-mono mt-1">
            N° {etudiant.numero_etudiant || "—"}
          </p>
        </div>
        <button
          onClick={() => onDelete(etudiant.id)}
          className="p-2 rounded-lg text-biblio-muted hover:text-biblio-danger hover:bg-biblio-danger/10 transition-colors"
          title="Supprimer cet étudiant"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

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
                className="text-sm text-biblio-text pl-2 border-l-2 border-biblio-accent"
              >
                {titre}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
