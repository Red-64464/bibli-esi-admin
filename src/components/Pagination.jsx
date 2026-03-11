import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Composant pagination réutilisable.
 *
 * Props :
 *   page       {number}   Page courante (commence à 1)
 *   totalPages {number}   Nombre total de pages
 *   onPage     {Function} Callback (newPage: number)
 */
export default function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const delta = 2;
  const left = Math.max(1, page - delta);
  const right = Math.min(totalPages, page + delta);

  for (let i = left; i <= right; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-center gap-1 flex-wrap">
      {/* Précédent */}
      <button
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-biblio-muted hover:text-biblio-text"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Première page si hors fenêtre */}
      {left > 1 && (
        <>
          <button
            onClick={() => onPage(1)}
            className="w-9 h-9 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 text-biblio-muted hover:text-biblio-text transition-colors"
          >
            1
          </button>
          {left > 2 && (
            <span className="w-9 h-9 flex items-center justify-center text-biblio-muted text-sm">
              …
            </span>
          )}
        </>
      )}

      {/* Pages dans la fenêtre */}
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPage(p)}
          className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
            p === page
              ? "bg-biblio-accent text-white"
              : "bg-white/5 hover:bg-white/10 text-biblio-muted hover:text-biblio-text"
          }`}
        >
          {p}
        </button>
      ))}

      {/* Dernière page si hors fenêtre */}
      {right < totalPages && (
        <>
          {right < totalPages - 1 && (
            <span className="w-9 h-9 flex items-center justify-center text-biblio-muted text-sm">
              …
            </span>
          )}
          <button
            onClick={() => onPage(totalPages)}
            className="w-9 h-9 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 text-biblio-muted hover:text-biblio-text transition-colors"
          >
            {totalPages}
          </button>
        </>
      )}

      {/* Suivant */}
      <button
        onClick={() => onPage(page + 1)}
        disabled={page === totalPages}
        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-biblio-muted hover:text-biblio-text"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
