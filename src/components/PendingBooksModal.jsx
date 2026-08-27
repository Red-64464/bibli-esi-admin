import { useEffect, useState } from "react";
import { AlertCircle, BookOpen, Loader2, PlusCircle, X } from "lucide-react";
import { supabase } from "../lib/supabase";

const STATUS = {
  pending: "À identifier",
  researching: "En préparation",
  ready: "Prêt à ajouter",
  added: "Ajouté",
  rejected: "Écarté",
};

export default function PendingBooksModal({ onClose, onAdd }) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        if (active) setError(queryError.message);
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
              <div className="grid grid-cols-2 gap-2">{book.coverUrl && <img src={book.coverUrl} alt="Couverture privée" className="h-36 w-full rounded-lg object-contain bg-black/20" />}{book.evidenceUrl && <img src={book.evidenceUrl} alt="Photo d'identification privée" className="h-36 w-full rounded-lg object-contain bg-black/20" />}</div>
              <div className="mt-3 space-y-1"><p className="font-medium">{book.titre_suggere || "Titre non encore identifié"}</p><p className="text-xs text-biblio-muted">{book.auteur_suggere || "Auteur inconnu"}{book.isbn ? ` · ISBN ${book.isbn}` : ""}</p><p className="text-xs text-biblio-accent">{STATUS[book.status] || book.status}</p>{book.notes && <p className="text-xs text-biblio-muted">Note : {book.notes}</p>}</div>
              <button onClick={() => prepareAdd(book)} className="mt-4 flex items-center gap-2 rounded-lg bg-biblio-accent px-3 py-2 text-sm text-white"><PlusCircle className="h-4 w-4" /> Préparer l'ajout</button>
            </article>)}
          </div>
        </div>
      </div>
    </div>
  );
}
