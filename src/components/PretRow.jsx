import { Eye, Pencil, RotateCcw, Printer } from "lucide-react";
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
export function PretCard({ pret, onReturn, onEdit, onView }) {
  const statut = getPretStatut(pret);
  const isRetourne = statut === "retourné";
  const isRetard = statut === "en_retard";
  const livre = pret.livres ?? pret.bibli_livres;
  const etudiant = pret.etudiants ?? pret.bibli_etudiants;

  return (
    <div
      className={`bg-biblio-card rounded-xl border p-4 space-y-3 ${
        isRetard ? "border-biblio-danger/30" : "border-white/10"
      }`}
    >
      {/* Titre + badge statut */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-biblio-text leading-snug">
          {livre?.titre || "—"}
        </p>
        <StatusBadge statut={statut} pret={pret} />
      </div>

      {/* Infos */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-biblio-muted">
        <div>
          <span className="block text-biblio-muted/60">Étudiant</span>
          <span className="text-biblio-text">
            {etudiant
              ? `${etudiant.prenom} ${etudiant.nom}`
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

      <div className="flex gap-2">
        <button onClick={() => onView(pret)} title="Visualiser le prêt" className="flex items-center justify-center rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-biblio-text transition-colors hover:bg-white/20" aria-label="Visualiser le prêt">
          <Eye className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onEdit(pret)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Modifier
        </button>
        {!isRetourne && (
          <button
            onClick={() => onReturn(pret.id, pret.livre_id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-biblio-accent hover:bg-biblio-accent-hover text-white rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retourner
          </button>
        )}
      </div>
    </div>
  );
}

/** Ligne de tableau desktop */
export default function PretRow({ pret, onReturn, onEdit, onView }) {
  const statut = getPretStatut(pret);
  const isRetard = statut === "en_retard";
  const isRetourne = statut === "retourné";
  const livre = pret.livres ?? pret.bibli_livres;
  const etudiant = pret.etudiants ?? pret.bibli_etudiants;

  return (
    <tr
      className={`border-b border-white/5 ${isRetard ? "bg-biblio-danger/5" : ""}`}
    >
      <td className="px-4 py-3 text-sm font-medium text-biblio-text">
        {livre?.titre || "—"}
      </td>
      <td className="px-4 py-3 text-sm text-biblio-muted">
        {etudiant
          ? `${etudiant.prenom} ${etudiant.nom}`
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
          <button onClick={() => onView(pret)} title="Visualiser le prêt" className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-biblio-text hover:bg-white/20" aria-label="Visualiser le prêt">
            <Eye className="h-3.5 w-3.5" />
            Visualiser
          </button>
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
            onClick={() => onEdit(pret)}
            className="p-1.5 rounded-lg text-biblio-muted hover:text-biblio-text hover:bg-white/10 transition-colors"
            title="Modifier"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
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
