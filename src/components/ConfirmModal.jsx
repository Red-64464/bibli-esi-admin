import { X, AlertTriangle } from "lucide-react";

/**
 * Modale de confirmation générique — remplace window.confirm().
 *
 * Props :
 *   title     {string}   Titre de la modale
 *   message   {string}   Message de confirmation
 *   onConfirm {Function} Callback quand l'utilisateur confirme
 *   onCancel  {Function} Callback quand l'utilisateur annule
 *   danger    {boolean}  Si true, le bouton Confirmer est rouge (défaut: false)
 */
export default function ConfirmModal({
  title = "Confirmer l'action",
  message = "Êtes-vous sûr de vouloir effectuer cette action ?",
  onConfirm,
  onCancel,
  danger = false,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modale */}
      <div className="relative bg-biblio-card border border-white/10 rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
        {/* Close */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-biblio-muted hover:text-biblio-text transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icône + Titre */}
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-full ${danger ? "bg-biblio-danger/10" : "bg-biblio-warning/10"}`}
          >
            <AlertTriangle
              className={`w-5 h-5 ${danger ? "text-biblio-danger" : "text-biblio-warning"}`}
            />
          </div>
          <h2 className="text-lg font-semibold text-biblio-text">{title}</h2>
        </div>

        {/* Message */}
        <p className="text-sm text-biblio-muted leading-relaxed">{message}</p>

        {/* Boutons */}
        <div className="flex gap-3 justify-end pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-biblio-text text-sm font-medium transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors ${
              danger
                ? "bg-biblio-danger hover:bg-biblio-danger/80"
                : "bg-biblio-accent hover:bg-biblio-accent-hover"
            }`}
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}
