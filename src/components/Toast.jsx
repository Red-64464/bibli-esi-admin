import { useEffect } from "react";
import { CheckCircle, XCircle, AlertTriangle, X } from "lucide-react";

const ICONS = {
  success: <CheckCircle className="w-5 h-5 text-biblio-success shrink-0" />,
  error: <XCircle className="w-5 h-5 text-biblio-danger shrink-0" />,
  warning: <AlertTriangle className="w-5 h-5 text-biblio-warning shrink-0" />,
};

const BG = {
  success: "bg-biblio-success/10 border-biblio-success/30",
  error: "bg-biblio-danger/10 border-biblio-danger/30",
  warning: "bg-biblio-warning/10 border-biblio-warning/30",
};

/**
 * Composant Toast individuel.
 * Props: id, type ("success"|"error"|"warning"), message, onClose
 */
export function Toast({ id, type = "success", message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(id), 4000);
    return () => clearTimeout(timer);
  }, [id, onClose]);

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm w-full animate-in slide-in-from-right-5 fade-in duration-200 ${BG[type]}`}
    >
      {ICONS[type]}
      <p className="text-sm text-biblio-text flex-1 leading-snug">{message}</p>
      <button
        onClick={() => onClose(id)}
        className="text-biblio-muted hover:text-biblio-text transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/**
 * Conteneur des toasts — à placer en bas à droite du layout.
 * Props: toasts (array), onClose (fn)
 */
export function ToastContainer({ toasts, onClose }) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 items-end">
      {toasts.map((t) => (
        <Toast key={t.id} {...t} onClose={onClose} />
      ))}
    </div>
  );
}
