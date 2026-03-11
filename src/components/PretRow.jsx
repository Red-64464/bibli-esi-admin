import { RotateCcw } from "lucide-react";

export const getPretStatut = (p) => {
  if (p.statut && p.statut !== "en_cours") return p.statut;
  if (p.rendu) return "retourné";
  const ref = p.date_retour_prevue
    ? new Date(p.date_retour_prevue)
    : new Date(new Date(p.date_pret).getTime() + 30 * 24 * 60 * 60 * 1000);
  return new Date() > ref ? "en_retard" : "en_cours";
};

function StatusBadge({ statut, joursDepuisPret, pret }) {
  const map = {
    en_cours: (
      <span className="text-xs px-2 py-1 rounded-full bg-biblio-warning/20 text-biblio-warning">
        En cours
      </span>
    ),
    en_retard: (
      <span className="text-xs px-2 py-1 rounded-full bg-biblio-danger/20 text-biblio-danger font-medium">
        Retard +{joursDepuisPret}j
      </span>
    ),
    retourné: (
      <span className="text-xs px-2 py-1 rounded-full bg-biblio-success/20 text-biblio-success">
        Rendu{" "}
        {pret.date_retour
          ? new Date(pret.date_retour).toLocaleDateString("fr-FR")
          : ""}
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
  const joursDepuisPret = Math.floor(
    (new Date() - new Date(pret.date_pret)) / (1000 * 60 * 60 * 24),
  );

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
        <StatusBadge
          statut={statut}
          joursDepuisPret={joursDepuisPret}
          pret={pret}
        />
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
          <span className="text-biblio-text">
            {new Date(pret.date_pret).toLocaleDateString("fr-FR")}
          </span>
        </div>
        <div>
          <span className="block text-biblio-muted/60">Retour prévu</span>
          <span className="text-biblio-text">
            {pret.date_retour_prevue
              ? new Date(pret.date_retour_prevue).toLocaleDateString("fr-FR")
              : "—"}
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
  const joursDepuisPret = Math.floor(
    (new Date() - new Date(pret.date_pret)) / (1000 * 60 * 60 * 24),
  );

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
        {new Date(pret.date_pret).toLocaleDateString("fr-FR")}
      </td>
      <td className="px-4 py-3 text-sm text-biblio-muted">
        {pret.date_retour_prevue
          ? new Date(pret.date_retour_prevue).toLocaleDateString("fr-FR")
          : "—"}
      </td>
      <td className="px-4 py-3">
        <StatusBadge
          statut={statut}
          joursDepuisPret={joursDepuisPret}
          pret={pret}
        />
      </td>
      <td className="px-4 py-3">
        {!isRetourne && (
          <button
            onClick={() => onReturn(pret.id, pret.livre_id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-biblio-accent hover:bg-biblio-accent-hover text-white rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retourner
          </button>
        )}
      </td>
    </tr>
  );
}
