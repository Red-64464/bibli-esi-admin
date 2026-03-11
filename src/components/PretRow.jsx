import { RotateCcw } from "lucide-react";

export default function PretRow({ pret, onReturn }) {
  // Calculer le nombre de jours depuis le prêt
  const joursEcoules = Math.floor(
    (new Date() - new Date(pret.date_pret)) / (1000 * 60 * 60 * 24),
  );
  const enRetard = !pret.rendu && joursEcoules > 30;

  return (
    <tr
      className={`border-b border-white/5 ${enRetard ? "bg-biblio-danger/5" : ""}`}
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
      <td className="px-4 py-3 text-sm">
        {pret.rendu ? (
          <span className="text-xs px-2 py-1 rounded-full bg-biblio-success/20 text-biblio-success">
            Rendu le {new Date(pret.date_retour).toLocaleDateString("fr-FR")}
          </span>
        ) : enRetard ? (
          <span className="text-xs px-2 py-1 rounded-full bg-biblio-danger/20 text-biblio-danger">
            En retard ({joursEcoules} jours)
          </span>
        ) : (
          <span className="text-xs px-2 py-1 rounded-full bg-biblio-warning/20 text-biblio-warning">
            En cours ({joursEcoules} jours)
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        {!pret.rendu && (
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
