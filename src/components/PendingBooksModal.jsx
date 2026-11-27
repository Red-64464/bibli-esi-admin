import { AnimatePresence } from "motion/react";
import MotionOverlay from "./MotionOverlay";
/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import { AlertCircle, BookOpen, Camera, ChevronLeft, ChevronRight, Copy, ExternalLink, ImageOff, Loader2, PlusCircle, Search, Trash2, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { usePermissions } from "../contexts/PermissionsContext";
import ConfirmModal from "./ConfirmModal";
import Pagination from "./Pagination";
import { formatShelfLocation } from "../lib/shelfLocation";

const PAGE_SIZE = 20;
const PHOTO_URL_LIFETIME = 1800;

function BookPhoto({ url, label, onClick, onRetry, eager = false }) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <div className="flex h-36 flex-col items-center justify-center gap-2 rounded-lg border border-[var(--library-line)] bg-biblio-bg/40 px-2 text-center text-xs text-biblio-muted">
        <ImageOff className="h-5 w-5" aria-hidden="true" />
        <span>{label} indisponible</span>
        <button type="button" onClick={onRetry} className="font-medium text-biblio-accent hover:underline">Réessayer</button>
      </div>
    );
  }

  return (
    <button type="button" onClick={onClick} className="group overflow-hidden rounded-lg bg-black/20 focus:outline-none focus:ring-2 focus:ring-biblio-accent" aria-label={`Agrandir ${label.toLowerCase()}`}>
      <img src={url} alt={label} loading={eager ? "eager" : "lazy"} decoding="async" onError={() => setFailed(true)} className="h-36 w-full object-contain transition-transform group-hover:scale-105" />
    </button>
  );
}

const STATUS = {
  pending: "À identifier",
  researching: "En préparation",
  ready: "Prêt à ajouter",
  added: "Ajouté",
  rejected: "Écarté",
};

export default function PendingBooksModal({ onClose, onAdd, onCreate }) {
  const { can } = usePermissions();
  const scrollRef = useRef(null);
  const [books, setBooks] = useState([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [photoErrorCount, setPhotoErrorCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedIsbn, setCopiedIsbn] = useState("");
  const [preview, setPreview] = useState(null);
  const [bookToDelete, setBookToDelete] = useState(null);
  const [deletingId, setDeletingId] = useState("");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      setPhotoErrorCount(0);
      const from = (page - 1) * PAGE_SIZE;
      const { data, count, error: queryError } = await supabase
        .from("bibli_pending_books")
        .select("id, status, isbn, raw_scan, emplacement, titre_suggere, auteur_suggere, notes, cover_path, evidence_path, ocr_text, created_at", { count: "exact" })
        .in("status", ["pending", "researching", "ready"])
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (!active) return;
      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }
      const bucket = supabase.storage.from("bibli-pending-books");
      const paths = [...new Set((data || []).flatMap((book) => [book.cover_path, book.evidence_path]).filter(Boolean))];
      const photoUrls = new Map();
      if (paths.length) {
        const { data: signed, error: signingError } = await bucket.createSignedUrls(paths, PHOTO_URL_LIFETIME);
        if (!signingError) {
          for (const item of signed || []) {
            if (item.path && item.signedUrl && !item.error) photoUrls.set(item.path, item.signedUrl);
          }
        } else {
          // Older Storage servers may not support signing several paths at once.
          for (let i = 0; i < paths.length; i += 4) {
            const results = await Promise.all(paths.slice(i, i + 4).map((path) => bucket.createSignedUrl(path, PHOTO_URL_LIFETIME)));
            results.forEach((result, index) => {
              if (result.data?.signedUrl) photoUrls.set(paths[i + index], result.data.signedUrl);
            });
          }
        }
      }
      if (!active) return;
      setBooks((data || []).map((book) => ({
        ...book,
        coverUrl: photoUrls.get(book.cover_path) || "",
        evidenceUrl: photoUrls.get(book.evidence_path) || "",
      })));
      setTotalCount(count || 0);
      setPhotoErrorCount(paths.length - photoUrls.size);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [page, reloadKey]);

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
      setTotalCount((current) => Math.max(0, current - 1));
      setBookToDelete(null);
      if (page > 1 && books.length === 1) setPage((current) => current - 1);
      else setReloadKey((current) => current + 1);
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

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const retryPhotos = () => setReloadKey((current) => current + 1);
  const changePage = (nextPage) => {
    setPage(nextPage);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  return (
    <MotionOverlay ref={scrollRef} className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-3 py-5 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="pending-books-title">
      <div data-motion-panel className="w-full max-w-4xl rounded-2xl border border-white/10 bg-biblio-card shadow-2xl">
        <div className="relative border-b border-white/10 px-4 py-5 sm:flex sm:items-start sm:justify-between sm:gap-4 sm:px-6">
          <div className="pr-9"><h2 id="pending-books-title" className="flex items-center gap-2 text-lg font-semibold"><BookOpen className="h-5 w-5 shrink-0 text-biblio-accent" /> Livres à identifier</h2><p className="mt-1 text-sm text-biblio-muted">Deux photos privées sont conservées pour chaque livre non reconnu.</p></div>
          <button type="button" onClick={onCreate} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-biblio-accent px-3 py-2 text-sm font-medium text-white hover:bg-biblio-accent-hover sm:mr-7 sm:mt-0 sm:w-auto sm:shrink-0"><Camera className="h-4 w-4" /> Ajouter des photos</button>
          <button type="button" onClick={onClose} className="absolute right-4 top-5 rounded-md p-1 text-biblio-muted hover:text-biblio-danger sm:right-6" aria-label="Fermer"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-4 sm:p-6">
          {loading && <div className="flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-biblio-accent" /></div>}
          {error && <p className="flex gap-2 rounded-lg bg-biblio-danger/10 p-3 text-sm text-biblio-danger"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
          {!loading && !error && totalCount > 0 && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--library-line)] pb-4">
              <p className="text-sm text-biblio-muted"><span className="font-semibold text-biblio-text">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)}</span> sur {totalCount} livres</p>
              <nav aria-label="Pages des livres à identifier"><Pagination page={page} totalPages={totalPages} onPage={changePage} /></nav>
            </div>
          )}
          {!loading && photoErrorCount > 0 && <p className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-biblio-muted"><ImageOff className="h-4 w-4" aria-hidden="true" /> {photoErrorCount} photo{photoErrorCount > 1 ? "s" : ""} indisponible{photoErrorCount > 1 ? "s" : ""}. <button type="button" onClick={retryPhotos} className="font-medium text-biblio-accent hover:underline">Réessayer les photos</button></p>}
          {!loading && !error && books.length === 0 && <p className="py-10 text-center text-sm text-biblio-muted">Aucun livre en attente : parfait. 🎉</p>}
          {!loading && !error && <div className="grid gap-4 sm:grid-cols-2">
            {books.map((book, index) => <article key={book.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="grid grid-cols-2 gap-2">
                <BookPhoto key={`${book.id}-cover-${book.coverUrl}`} url={book.coverUrl} label="Couverture" onClick={() => openPreview(book, 0)} onRetry={retryPhotos} eager={index < 2} />
                <BookPhoto key={`${book.id}-evidence-${book.evidenceUrl}`} url={book.evidenceUrl} label="Dos ou code-barres" onClick={() => openPreview(book, book.coverUrl ? 1 : 0)} onRetry={retryPhotos} eager={index < 2} />
              </div>
              <div className="mt-3 space-y-1"><p className="font-medium">{book.titre_suggere || "Titre non encore identifié"}</p><p className="text-xs text-biblio-muted">{book.auteur_suggere || "Auteur inconnu"}{book.isbn ? ` · ISBN ${book.isbn}` : ""}</p>{book.emplacement && <p className="text-xs text-biblio-muted">Rangée : {formatShelfLocation(book.emplacement)}</p>}<p className="text-xs text-biblio-accent">{STATUS[book.status] || book.status}</p>{book.notes && <p className="text-xs text-biblio-muted">Note : {book.notes}</p>}</div>
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
                <button onClick={() => prepareAdd(book)} className="flex items-center gap-2 rounded-lg bg-biblio-accent px-3 py-2 text-sm text-white"><PlusCircle className="h-4 w-4" /> Préparer l&apos;ajout</button>
                {can("livres_supprimer") && (
                  <button type="button" onClick={() => setBookToDelete(book)} disabled={deletingId === book.id} className="inline-flex items-center gap-2 rounded-lg bg-biblio-danger/15 px-3 py-2 text-sm text-biblio-danger hover:bg-biblio-danger/25 disabled:opacity-50">
                    <Trash2 className="h-4 w-4" /> Supprimer
                  </button>
                )}
              </div>
            </article>)}
          </div>}
          {!loading && !error && totalPages > 1 && <nav aria-label="Pages des livres à identifier, bas de liste" className="mt-6 border-t border-[var(--library-line)] pt-5"><Pagination page={page} totalPages={totalPages} onPage={changePage} /></nav>}
        </div>
      </div>
      <AnimatePresence>
        {preview && (
          <MotionOverlay className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={() => setPreview(null)}>
            <div data-motion-panel className="relative flex h-full max-h-[92vh] w-full max-w-5xl flex-col" onClick={(event) => event.stopPropagation()}>
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
          </MotionOverlay>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {bookToDelete && (
          <ConfirmModal
            title="Supprimer ce livre à identifier"
            message="Les deux photos privées et la fiche seront supprimées définitivement."
            danger
            onConfirm={deleteBook}
            onCancel={() => setBookToDelete(null)}
          />
        )}
      </AnimatePresence>
    </MotionOverlay>
  );
}
