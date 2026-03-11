import { RotateCcw } from "lucide-react";

const getPretStatut = (p) => {
  if (p.statut && p.statut !== "en_cours") return p.statut;
  if (p.rendu) return "retourné";
  const ref = p.date_retour_prevue
    ? new Date(p.date_retour_prevue)
    : new Date(new Date(p.date_pret).getTime() + 30 * 24 * 60 * 60 * 1000);
  return new Date() > ref ? "en_retard" : "en_cours";
};

export default function PretRow({ pret, onReturn }) {
  const statut = getPretStatut(pret);
  const isRetard = statut === "en_retard";
  const isRetourne = statut === "retourné";

  const joursDepuisPret = Math.floor(
    (new Date() - new Date(pret.date_pret)) / (1000 * 60 * 60 * 24),
  );

  const statusBadge = {
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
        {statusBadge[statut] || (
          <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-biblio-muted">
            {statut}
          </span>
        )}
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
