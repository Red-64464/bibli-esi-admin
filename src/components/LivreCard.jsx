import { Trash2, Pencil, History, QrCode } from "lucide-react";

const STATUT_STYLE = {
  disponible: "bg-biblio-success/20 text-biblio-success",
  emprunte: "bg-biblio-warning/20 text-biblio-warning",
  // legacy accented fallbacks
  emprunté: "bg-biblio-warning/20 text-biblio-warning",
  reserve: "bg-biblio-accent/20 text-biblio-accent",
  réservé: "bg-biblio-accent/20 text-biblio-accent",
  perdu: "bg-biblio-danger/20 text-biblio-danger",
  en_reparation: "bg-white/10 text-biblio-muted",
  "en réparation": "bg-white/10 text-biblio-muted",
};

const STATUT_LABEL = {
  disponible: "Disponible",
  emprunte: "Emprunté",
  reserve: "Réservé",
  perdu: "Perdu",
  en_reparation: "En réparation",
};

export default function LivreCard({
  livre,
  onDelete,
  onEdit,
  onHistorique,
  onQrCode,
}) {
  const statut = livre.statut || (livre.disponible ? "disponible" : "emprunte");
  const badgeClass = STATUT_STYLE[statut] || "bg-white/10 text-biblio-muted";

  return (
    <div className="bg-biblio-card rounded-xl border border-white/10 overflow-hidden flex flex-col transition-all hover:border-white/20">
      {/* Couverture */}
      <div className="h-48 bg-white/5 flex items-center justify-center overflow-hidden">
        {livre.couverture_url ? (
          <img
            src={livre.couverture_url}
            alt={livre.titre}
            className="h-full w-full object-contain p-2"
          />
        ) : (
          <div className="text-biblio-muted text-xs">Pas de couverture</div>
        )}
      </div>

      {/* Infos */}
      <div className="p-4 flex-1 flex flex-col gap-1.5">
        <h3 className="font-semibold text-biblio-text line-clamp-2 leading-tight text-sm">
          {livre.titre}
        </h3>
        <p className="text-xs text-biblio-muted">
          {livre.auteur || "Auteur inconnu"}
        </p>
        {livre.categorie && (
          <p className="text-xs text-biblio-accent">{livre.categorie}</p>
        )}
        <p className="text-xs text-biblio-muted font-mono">
          ISBN : {livre.isbn}
        </p>
        {livre.emplacement && (
          <p className="text-xs text-biblio-muted">📍 {livre.emplacement}</p>
        )}

        {/* Badge statut + actions */}
        <div className="mt-auto pt-3 flex items-center justify-between gap-1">
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full ${badgeClass}`}
          >
            {STATUT_LABEL[statut] ||
              statut.charAt(0).toUpperCase() + statut.slice(1)}
          </span>
          <div className="flex items-center gap-1">
            {onQrCode && (
              <button
                onClick={() => onQrCode(livre)}
                className="p-1.5 rounded-lg text-biblio-muted hover:text-biblio-accent hover:bg-biblio-accent/10 transition-colors"
                title="QR Code"
              >
                <QrCode className="w-3.5 h-3.5" />
              </button>
            )}
            {onHistorique && (
              <button
                onClick={() => onHistorique(livre)}
                className="p-1.5 rounded-lg text-biblio-muted hover:text-biblio-accent hover:bg-biblio-accent/10 transition-colors"
                title="Historique"
              >
                <History className="w-3.5 h-3.5" />
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => onEdit(livre)}
                className="p-1.5 rounded-lg text-biblio-muted hover:text-biblio-text hover:bg-white/10 transition-colors"
                title="Modifier"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => onDelete(livre.id)}
              className="p-1.5 rounded-lg text-biblio-muted hover:text-biblio-danger hover:bg-biblio-danger/10 transition-colors"
              title="Supprimer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
