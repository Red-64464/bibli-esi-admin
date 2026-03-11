import { Trash2 } from "lucide-react";

export default function LivreCard({ livre, onDelete }) {
  return (
    <div className="bg-biblio-card rounded-xl border border-white/10 overflow-hidden flex flex-col transition-transform hover:scale-[1.02]">
      {/* Couverture */}
      <div className="h-52 bg-white/5 flex items-center justify-center overflow-hidden">
        {livre.couverture_url ? (
          <img
            src={livre.couverture_url}
            alt={livre.titre}
            className="h-full w-full object-contain p-2"
          />
        ) : (
          <div className="text-biblio-muted text-sm">Pas de couverture</div>
        )}
      </div>

      {/* Infos */}
      <div className="p-4 flex-1 flex flex-col gap-2">
        <h3 className="font-semibold text-biblio-text line-clamp-2 leading-tight">
          {livre.titre}
        </h3>
        <p className="text-sm text-biblio-muted">
          {livre.auteur || "Auteur inconnu"}
        </p>
        {livre.editeur && (
          <p className="text-xs text-biblio-muted">{livre.editeur}</p>
        )}
        <p className="text-xs text-biblio-muted font-mono">
          ISBN : {livre.isbn}
        </p>

        {/* Badge disponibilité */}
        <div className="mt-auto pt-3 flex items-center justify-between">
          <span
            className={`text-xs font-medium px-3 py-1 rounded-full ${
              livre.disponible
                ? "bg-biblio-success/20 text-biblio-success"
                : "bg-biblio-danger/20 text-biblio-danger"
            }`}
          >
            {livre.disponible ? "Disponible" : "Emprunté"}
          </span>

          <button
            onClick={() => onDelete(livre.id)}
            className="p-2 rounded-lg text-biblio-muted hover:text-biblio-danger hover:bg-biblio-danger/10 transition-colors"
            title="Supprimer ce livre"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
