import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle, Loader2, Search } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function SearchISBN({ onBookFound, defaultIsbn, onDefaultIsbnUsed, onUnresolved }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [bookData, setBookData] = useState(null);
  const [results, setResults] = useState([]);
  const [lookupSource, setLookupSource] = useState("");
  const [error, setError] = useState("");

  const handleSearch = async (override) => {
    const value = (override ?? query).trim();
    if (!value) return;
    setLoading(true);
    setError("");
    setBookData(null);
    setResults([]);
    setLookupSource("");
    try {
      // Les requêtes catalogues passent toutes par l'Edge Function : aucune
      // clé fournisseur et aucun appel externe ne sont exposés au navigateur.
      const { data, error: lookupError } = await supabase.functions.invoke("bibli-book-lookup", { body: { query: value } });
      if (lookupError) {
        const details = await lookupError.context?.json?.().catch(() => null);
        setError(details?.error || "Aucun livre trouvé avec ces informations.");
      } else if (data?.book) {
        setBookData(data.book);
        setLookupSource(data.source || "catalogues");
      } else if (data?.results?.length) {
        setResults(data.results);
      } else {
        setError("Aucun livre trouvé. Envoyez deux photos pour l’identifier plus tard.");
      }
    } catch {
      setError("Erreur de connexion. Vérifiez votre connexion internet.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!defaultIsbn) return;
    setQuery(defaultIsbn);
    onDefaultIsbnUsed?.();
    const timer = setTimeout(() => void handleSearch(defaultIsbn), 100);
    return () => clearTimeout(timer);
  }, [defaultIsbn]); // handleSearch intentionally uses the scanned value once

  const confirm = (book) => {
    onBookFound(book || bookData);
    setBookData(null);
    setResults([]);
    setLookupSource("");
    setQuery("");
  };

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-biblio-card p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><Search className="h-5 w-5 text-biblio-accent" /> Ajouter un livre par ISBN ou titre</h2>
      <div className="flex gap-3">
        <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && handleSearch()} placeholder="ISBN (ex. 9782070360024) ou titre du livre" className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent" />
        <button onClick={() => handleSearch()} disabled={loading || !query.trim()} className="flex items-center gap-2 rounded-lg bg-biblio-accent px-6 py-3 font-medium text-white transition-colors hover:bg-biblio-accent-hover disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Rechercher</button>
      </div>
      {error && <div className="flex flex-wrap items-center gap-2 rounded-lg bg-biblio-danger/10 p-3 text-sm text-biblio-danger"><AlertCircle className="h-4 w-4 shrink-0" /><span className="flex-1">{error}</span>{onUnresolved && <button type="button" onClick={() => onUnresolved(query)} className="rounded-md border border-biblio-danger/40 px-3 py-1.5 text-xs font-medium hover:bg-biblio-danger/10">Identifier avec 2 photos</button>}</div>}
      {bookData && <BookResult book={bookData} source={lookupSource} onConfirm={() => confirm()} />}
      {results.length > 0 && <div className="space-y-2"><p className="text-xs text-biblio-muted">{results.length} résultat(s) : cliquez sur le bon livre pour l&apos;ajouter.</p>{results.map((book, index) => <button key={`${book.isbn}-${index}`} onClick={() => confirm(book)} className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-left transition-colors hover:bg-white/10">{book.couverture_url ? <img src={book.couverture_url} alt="" className="h-14 w-10 rounded object-contain" /> : <span className="h-14 w-10 rounded bg-white/10" />}<span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-biblio-text">{book.titre}</span><span className="block truncate text-xs text-biblio-muted">{book.auteur || "Auteur inconnu"}</span><span className="text-xs text-biblio-muted">{book.annee}{book.editeur ? ` · ${book.editeur}` : ""}</span></span><CheckCircle className="h-5 w-5 shrink-0 text-biblio-success" /></button>)}</div>}
    </div>
  );
}

function BookResult({ book, source, onConfirm }) {
  return <div className="flex gap-4 rounded-lg border border-biblio-accent/30 bg-white/5 p-4">{book.couverture_url && <img src={book.couverture_url} alt={book.titre} className="h-36 w-24 rounded object-contain" />}<div className="flex-1 space-y-1"><h3 className="font-semibold text-biblio-text">{book.titre}</h3><p className="text-sm text-biblio-muted">{book.auteur || "Auteur inconnu"}</p>{book.editeur && <p className="text-xs text-biblio-muted">Éditeur : {book.editeur}</p>}{book.annee && <p className="text-xs text-biblio-muted">Année : {book.annee}</p>}{book.isbn && <p className="font-mono text-xs text-biblio-muted">ISBN : {book.isbn}</p>}{source === "catalogue" && <p className="text-xs text-biblio-success">Ce livre est déjà dans votre catalogue.</p>}</div><button onClick={onConfirm} disabled={source === "catalogue"} className="self-center rounded-lg bg-biblio-success px-5 py-2.5 font-medium text-white disabled:opacity-50"><CheckCircle className="mr-2 inline h-4 w-4" />{source === "catalogue" ? "Déjà ajouté" : "Ajouter"}</button></div>;
}
