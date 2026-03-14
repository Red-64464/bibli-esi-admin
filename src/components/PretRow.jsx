import { RotateCcw, Printer } from "lucide-react";
import { getPretStatut, joursRetard, formatDate } from "../lib/utils";
import { printFichePret } from "../lib/print";

// Re-export pour la compatibilité avec les imports existants
export { getPretStatut };

function StatusBadge({ statut, pret }) {
  const jours = joursRetard(pret);
  const map = {
    en_cours: (
      <span className="text-xs px-2 py-1 rounded-full bg-biblio-warning/20 text-biblio-warning">
        En cours
      </span>
    ),
    en_retard: (
      <span className="text-xs px-2 py-1 rounded-full bg-biblio-danger/20 text-biblio-danger font-medium">
        Retard +{jours}j
      </span>
    ),
    retourné: (
      <span className="text-xs px-2 py-1 rounded-full bg-biblio-success/20 text-biblio-success">
        Rendu {pret.date_retour ? formatDate(pret.date_retour) : ""}
      </span>
    ),
    perdu: (
      <span className="text-xs px-2 py-1 rounded-full bg-biblio-danger/20 text-biblio-danger">
        Perdu
      </span>
    ),
  };
  return (
    map[statut] || (
      <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-biblio-muted">
        {statut}
      </span>
    )
  );
}

/** Carte mobile pour un prêt — visible uniquement sur petits écrans */
export function PretCard({ pret, onReturn }) {
  const statut = getPretStatut(pret);
  const isRetourne = statut === "retourné";
  const isRetard = statut === "en_retard";

  return (
    <div
      className={`bg-biblio-card rounded-xl border p-4 space-y-3 ${
        isRetard ? "border-biblio-danger/30" : "border-white/10"
      }`}
    >
      {/* Titre + badge statut */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-biblio-text leading-snug">
          {pret.livres?.titre || "—"}
        </p>
        <StatusBadge statut={statut} pret={pret} />
      </div>

      {/* Infos */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-biblio-muted">
        <div>
          <span className="block text-biblio-muted/60">Étudiant</span>
          <span className="text-biblio-text">
            {pret.etudiants
              ? `${pret.etudiants.prenom} ${pret.etudiants.nom}`
              : "—"}
          </span>
        </div>
        <div>
          <span className="block text-biblio-muted/60">Date prêt</span>
          <span className="text-biblio-text">{formatDate(pret.date_pret)}</span>
        </div>
        <div>
          <span className="block text-biblio-muted/60">Retour prévu</span>
          <span className="text-biblio-text">
            {formatDate(pret.date_retour_prevue)}
          </span>
        </div>
        {pret.notes && (
          <div className="col-span-2">
            <span className="block text-biblio-muted/60">Notes</span>
            <span className="text-biblio-text">{pret.notes}</span>
          </div>
        )}
      </div>

      {/* Action */}
      {!isRetourne && (
        <button
          onClick={() => onReturn(pret.id, pret.livre_id)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-biblio-accent hover:bg-biblio-accent-hover text-white rounded-lg transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Marquer comme retourné
        </button>
      )}
    </div>
  );
}

/** Ligne de tableau desktop */
export default function PretRow({ pret, onReturn }) {
  const statut = getPretStatut(pret);
  const isRetard = statut === "en_retard";
  const isRetourne = statut === "retourné";

  return (
    <tr
      className={`border-b border-white/5 ${isRetard ? "bg-biblio-danger/5" : ""}`}
    >
      <td className="px-4 py-3 text-sm font-medium text-biblio-text">
        {pret.livres?.titre || "—"}
      </td>
      <td className="px-4 py-3 text-sm text-biblio-muted">
        {pret.etudiants
          ? `${pret.etudiants.prenom} ${pret.etudiants.nom}`
          : "—"}
      </td>
      <td className="px-4 py-3 text-sm text-biblio-muted">
        {formatDate(pret.date_pret)}
      </td>
      <td className="px-4 py-3 text-sm text-biblio-muted">
        {formatDate(pret.date_retour_prevue)}
      </td>
      <td className="px-4 py-3">
        <StatusBadge statut={statut} pret={pret} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {!isRetourne && (
            <button
              onClick={() => onReturn(pret.id, pret.livre_id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-biblio-accent hover:bg-biblio-accent-hover text-white rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retourner
            </button>
          )}
          <button
            onClick={() => printFichePret(pret)}
            className="p-1.5 rounded-lg text-biblio-muted hover:text-biblio-text hover:bg-white/10 transition-colors"
            title="Imprimer fiche"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
