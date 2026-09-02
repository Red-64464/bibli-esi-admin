import { useEffect, useState } from "react";
import { AlertCircle, BookOpen, ChevronLeft, ChevronRight, Copy, ExternalLink, Loader2, PlusCircle, Search, Trash2, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { usePermissions } from "../contexts/PermissionsContext";
import ConfirmModal from "./ConfirmModal";

const STATUS = {
  pending: "À identifier",
  researching: "En préparation",
  ready: "Prêt à ajouter",
  added: "Ajouté",
  rejected: "Écarté",
};

export default function PendingBooksModal({ onClose, onAdd }) {
  const { can } = usePermissions();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedIsbn, setCopiedIsbn] = useState("");
  const [preview, setPreview] = useState(null);
  const [bookToDelete, setBookToDelete] = useState(null);
  const [deletingId, setDeletingId] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const { data, error: queryError } = await supabase
        .from("bibli_pending_books")
        .select("id, status, isbn, raw_scan, titre_suggere, auteur_suggere, notes, cover_path, evidence_path, ocr_text, created_at")
        .in("status", ["pending", "researching", "ready"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (queryError) {
        if (active) {
          setError(queryError.message);
          setLoading(false);
        }
        return;
      }
      const bucket = supabase.storage.from("bibli-pending-books");
      const withUrls = await Promise.all((data || []).map(async (book) => {
        const [cover, evidence] = await Promise.all([bucket.createSignedUrl(book.cover_path, 600), bucket.createSignedUrl(book.evidence_path, 600)]);
        return { ...book, coverUrl: cover.data?.signedUrl || "", evidenceUrl: evidence.data?.signedUrl || "" };
      }));
      if (active) setBooks(withUrls);
      if (active) setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  const prepareAdd = async (book) => {
    const { error: updateError } = await supabase
      .from("bibli_pending_books")
      .update({ status: "researching", updated_at: new Date().toISOString() })
      .eq("id", book.id);
    if (updateError) return setError(updateError.message);
    onAdd(book);
  };

  const deleteBook = async () => {
    if (!bookToDelete) return;
    setDeletingId(bookToDelete.id);
    setError("");
    try {
      const paths = [bookToDelete.cover_path, bookToDelete.evidence_path].filter(Boolean);
      if (paths.length) {
        const { error: storageError } = await supabase.storage
          .from("bibli-pending-books")
          .remove(paths);
        if (storageError) throw storageError;
      }
      const { error: deleteError } = await supabase
        .from("bibli_pending_books")
        .delete()
        .eq("id", bookToDelete.id);
      if (deleteError) throw deleteError;
      setBooks((current) => current.filter((book) => book.id !== bookToDelete.id));
      setBookToDelete(null);
    } catch (deleteError) {
      setError(`Suppression impossible : ${deleteError.message}`);
    } finally {
      setDeletingId("");
    }
  };

  const openPreview = (book, index) => {
    const photos = [
      book.coverUrl && { url: book.coverUrl, label: "Couverture" },
      book.evidenceUrl && { url: book.evidenceUrl, label: "Dos / code-barres" },
    ].filter(Boolean);
    if (photos.length) setPreview({ book, photos, index });
  };

  const movePreview = (direction) => {
    setPreview((current) => {
      if (!current) return current;
      const nextIndex = (current.index + direction + current.photos.length) % current.photos.length;
      return { ...current, index: nextIndex };
    });
  };

  const copyIsbn = async (isbn) => {
    if (!isbn) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(isbn);
      } else {
        const fallback = document.createElement("textarea");
        fallback.value = isbn;
        fallback.setAttribute("readonly", "");
        fallback.style.position = "fixed";
        fallback.style.opacity = "0";
        document.body.appendChild(fallback);
        fallback.select();
        if (!document.execCommand("copy")) throw new Error("copy_failed");
        fallback.remove();
      }
      setCopiedIsbn(isbn);
      window.setTimeout(() => setCopiedIsbn((value) => value === isbn ? "" : value), 1800);
    } catch {
      setError(`Copie impossible automatiquement. ISBN à copier : ${isbn}`);
    }
  };

  const searchLinks = (book) => {
    const query = encodeURIComponent(book.isbn || book.titre_suggere || book.raw_scan || "");
    if (!query) return [];
    return [
      { label: "Google Books", url: `https://books.google.com/books?q=${query}` },
      { label: "Open Library", url: `https://openlibrary.org/search?q=${query}` },
      { label: "BnF", url: `https://catalogue.bnf.fr/rechercher.do?motRecherche=${query}` },
    ];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 py-8">
      <div className="w-full max-w-4xl rounded-2xl border border-white/10 bg-biblio-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div><h2 className="flex items-center gap-2 text-lg font-semibold"><BookOpen className="h-5 w-5 text-biblio-accent" /> Livres à identifier</h2><p className="mt-1 text-sm text-biblio-muted">Deux photos privées sont conservées pour chaque livre non reconnu.</p></div>
          <button onClick={onClose} className="text-biblio-muted hover:text-biblio-danger" aria-label="Fermer"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6">
          {loading && <div className="flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-biblio-accent" /></div>}
          {error && <p className="flex gap-2 rounded-lg bg-biblio-danger/10 p-3 text-sm text-biblio-danger"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
          {!loading && !error && books.length === 0 && <p className="py-10 text-center text-sm text-biblio-muted">Aucun livre en attente : parfait. 🎉</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            {books.map((book) => <article key={book.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="grid grid-cols-2 gap-2">
                {book.coverUrl && (
                  <button type="button" onClick={() => openPreview(book, 0)} className="group overflow-hidden rounded-lg bg-black/20 focus:outline-none focus:ring-2 focus:ring-biblio-accent" aria-label="Agrandir la couverture">
                    <img src={book.coverUrl} alt="Couverture privée" className="h-36 w-full object-contain transition-transform group-hover:scale-105" />
                  </button>
                )}
                {book.evidenceUrl && (
                  <button type="button" onClick={() => openPreview(book, book.coverUrl ? 1 : 0)} className="group overflow-hidden rounded-lg bg-black/20 focus:outline-none focus:ring-2 focus:ring-biblio-accent" aria-label="Agrandir la photo du dos ou du code-barres">
                    <img src={book.evidenceUrl} alt="Photo d'identification privée" className="h-36 w-full object-contain transition-transform group-hover:scale-105" />
                  </button>
                )}
              </div>
              <div className="mt-3 space-y-1"><p className="font-medium">{book.titre_suggere || "Titre non encore identifié"}</p><p className="text-xs text-biblio-muted">{book.auteur_suggere || "Auteur inconnu"}{book.isbn ? ` · ISBN ${book.isbn}` : ""}</p><p className="text-xs text-biblio-accent">{STATUS[book.status] || book.status}</p>{book.notes && <p className="text-xs text-biblio-muted">Note : {book.notes}</p>}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {book.isbn && (
                  <button type="button" onClick={() => copyIsbn(book.isbn)} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-biblio-text hover:bg-white/20">
                    <Copy className="h-3.5 w-3.5" /> {copiedIsbn === book.isbn ? "ISBN copié ✓" : "Copier ISBN"}
                  </button>
                )}
                {searchLinks(book).map((link) => (
                  <a key={link.label} href={link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-biblio-text hover:bg-white/20">
                    <Search className="h-3.5 w-3.5" /> {link.label}<ExternalLink className="h-3 w-3 opacity-70" />
                  </a>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => prepareAdd(book)} className="flex items-center gap-2 rounded-lg bg-biblio-accent px-3 py-2 text-sm text-white"><PlusCircle className="h-4 w-4" /> Préparer l'ajout</button>
                {can("livres_supprimer") && (
                  <button type="button" onClick={() => setBookToDelete(book)} disabled={deletingId === book.id} className="inline-flex items-center gap-2 rounded-lg bg-biblio-danger/15 px-3 py-2 text-sm text-biblio-danger hover:bg-biblio-danger/25 disabled:opacity-50">
                    <Trash2 className="h-4 w-4" /> Supprimer
                  </button>
                )}
              </div>
            </article>)}
          </div>
        </div>
      </div>
      {preview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={() => setPreview(null)}>
          <div className="relative flex h-full max-h-[92vh] w-full max-w-5xl flex-col" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-3 text-white">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{preview.book.titre_suggere || "Livre à identifier"}</p>
                <p className="text-xs text-white/70">{preview.photos[preview.index].label} · {preview.index + 1}/{preview.photos.length}</p>
              </div>
              <button type="button" onClick={() => setPreview(null)} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-slate-950 shadow-xl hover:bg-slate-200" aria-label="Fermer la photo agrandie">
                <X className="h-7 w-7" />
              </button>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center rounded-xl bg-black/40">
              {preview.photos.length > 1 && (
                <button type="button" onClick={() => movePreview(-1)} className="absolute left-2 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Photo précédente">
                  <ChevronLeft className="h-6 w-6" />
                </button>
              )}
              <img src={preview.photos[preview.index].url} alt={preview.photos[preview.index].label} className="max-h-full max-w-full rounded-lg object-contain" />
              {preview.photos.length > 1 && (
                <button type="button" onClick={() => movePreview(1)} className="absolute right-2 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Photo suivante">
                  <ChevronRight className="h-6 w-6" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {bookToDelete && (
        <ConfirmModal
          title="Supprimer ce livre à identifier"
          message="Les deux photos privées et la fiche seront supprimées définitivement."
          danger
          onConfirm={deleteBook}
          onCancel={() => setBookToDelete(null)}
        />
      )}
    </div>
  );
}
