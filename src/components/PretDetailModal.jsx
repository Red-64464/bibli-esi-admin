import { CalendarDays, CircleUserRound, FileText, LibraryBig, Mail, X } from "lucide-react";
import { formatDate, getPretStatut } from "../lib/utils";

function Detail({ label, value, icon: Icon }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-1 flex items-center gap-2 text-xs text-biblio-muted">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <p className="break-words text-sm text-biblio-text">{value || "—"}</p>
    </div>
  );
}

export default function PretDetailModal({ pret, onClose }) {
  if (!pret) return null;
  const livre = pret.livres ?? pret.bibli_livres ?? {};
  const etudiant = pret.etudiants ?? pret.bibli_etudiants ?? {};
  const statut = getPretStatut(pret);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="pret-detail-title">
      <button aria-label="Fermer" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-biblio-card shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-biblio-card px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-biblio-muted">Fiche du prêt</p>
            <h2 id="pret-detail-title" className="text-lg font-semibold text-biblio-text">{livre.titre || "Prêt"}</h2>
          </div>
          <button aria-label="Fermer" title="Fermer" onClick={onClose} className="rounded-lg p-2 text-biblio-muted hover:bg-white/10 hover:text-biblio-text">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid gap-5 sm:grid-cols-[128px_1fr]">
            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 aspect-[3/4]">
              {livre.couverture_url ? (
                <img src={livre.couverture_url} alt={`Couverture de ${livre.titre || "livre"}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center text-xs text-biblio-muted">
                  <LibraryBig className="h-8 w-8" />
                  Couverture indisponible
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-biblio-warning/20 px-2.5 py-1 text-xs text-biblio-warning">{statut === "retourné" ? "Rendu" : statut === "en_retard" ? "En retard" : "En cours"}</span>
                {livre.isbn && <span className="text-xs text-biblio-muted">ISBN {livre.isbn}</span>}
              </div>
              <h3 className="text-base font-semibold text-biblio-text">{livre.titre || "Livre non renseigné"}</h3>
              <p className="text-sm text-biblio-muted">{livre.auteur || "Auteur non renseigné"}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Detail label="Éditeur" value={livre.editeur} />
                <Detail label="Année" value={livre.annee} />
                <Detail label="Catégorie" value={livre.categorie} />
                <Detail label="Emplacement" value={livre.emplacement} />
              </div>
            </div>
          </div>

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-biblio-text"><CircleUserRound className="h-4 w-4 text-biblio-accent" />Emprunteur</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <Detail label="Nom complet" value={`${etudiant.prenom || ""} ${etudiant.nom || ""}`.trim()} />
              <Detail label="Matricule" value={etudiant.numero_etudiant} />
              <Detail label="E-mail" value={etudiant.email} icon={Mail} />
            </div>
          </section>

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-biblio-text"><CalendarDays className="h-4 w-4 text-biblio-accent" />Dates du prêt</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              <Detail label="Prêt le" value={formatDate(pret.date_pret)} />
              <Detail label="Retour prévu" value={formatDate(pret.date_retour_prevue)} />
              <Detail label="Retour effectif" value={pret.date_retour ? formatDate(pret.date_retour) : "Pas encore retourné"} />
            </div>
          </section>

          <Detail label="Rappel" value={formatDate(pret.date_rappel)} icon={CalendarDays} />
          {pret.notes && <Detail label="Notes" value={pret.notes} icon={FileText} />}
        </div>
      </div>
    </div>
  );
}
