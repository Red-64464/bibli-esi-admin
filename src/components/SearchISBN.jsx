import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle, Loader2, Search } from "lucide-react";
import { supabase } from "../lib/supabase";
import { OTHER_CATEGORY, resolveCategorySelection } from "../lib/categories";

export default function SearchISBN({ onBookFound, onCopyAdded, categories = [], defaultIsbn, onDefaultIsbnUsed, onUnresolved }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [bookData, setBookData] = useState(null);
  const [results, setResults] = useState([]);
  const [lookupSource, setLookupSource] = useState("");
  const [lookupSources, setLookupSources] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [shelfLetter, setShelfLetter] = useState("");
  const [shelfNumber, setShelfNumber] = useState("");
  const [letterKeyboard, setLetterKeyboard] = useState(false);

  const handleSearch = async (override) => {
    const value = (override ?? query).trim();
    if (!value) return;
    setLoading(true);
    setError("");
    setMessage("");
    setBookData(null);
    setResults([]);
    setLookupSource("");
    setLookupSources([]);
    setSelectedCategory("");
    setCustomCategory("");
    setShelfLetter("");
    setShelfNumber("");
    try {
      // Les requêtes catalogues passent toutes par l'Edge Function : aucune
      // clé fournisseur et aucun appel externe ne sont exposés au navigateur.
      const { data, error: lookupError } = await supabase.functions.invoke("bibli-book-lookup", { body: { query: value } });
      if (lookupError) {
        const details = await lookupError.context?.json?.().catch(() => null);
        setError(details?.error || "Aucun livre trouvé avec ces informations.");
        // Une absence ou une indisponibilité des catalogues permet de mettre
        // le livre de côté, sans confondre une panne avec un ISBN absent.
        if ([404, 503].includes(lookupError.context?.status)) onUnresolved?.(value);
      } else if (data?.book) {
        setBookData(data.book);
        setLookupSource(data.source || "catalogues");
        setLookupSources(Array.isArray(data.sources) ? data.sources : []);
        if (data.source === "catalogue") {
          const match = String(data.book.emplacement || "").trim().toUpperCase().match(/^(?:([1-5])([A-E])|([A-E])([1-5]))$/);
          if (match) { setShelfNumber(match[1] || match[4]); setShelfLetter(match[2] || match[3]); }
        }
      } else if (data?.results?.length) {
        setResults(data.results);
      } else {
        setError("Aucun livre trouvé. Envoyez deux photos pour l’identifier plus tard.");
        onUnresolved?.(value);
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
    void handleSearch(defaultIsbn);
    onDefaultIsbnUsed?.();
  }, [defaultIsbn]); // handleSearch intentionally uses the scanned value once

  const confirm = async (book) => {
    if (!shelfLetter || !shelfNumber) {
      setError("Choisissez obligatoirement la lettre et le chiffre de l’étagère.");
      return;
    }
    if (lookupSource === "catalogue") {
      setLoading(true); setError("");
      try {
        const { data, error: copyError } = await supabase.rpc("bibli_add_book_copy", { book_id: bookData.id, shelf: `${shelfNumber}${shelfLetter}` });
        if (copyError) throw copyError;
        setBookData({ ...bookData, nb_exemplaires: data, emplacement: bookData.emplacement || `${shelfNumber}${shelfLetter}` });
        setMessage(`Exemplaire ajouté : ${data} exemplaires au total.`);
        onCopyAdded?.();
      } catch (err) { setError(err.message || "Impossible d'ajouter l'exemplaire."); }
      finally { setLoading(false); }
      return;
    }
    const categorie = resolveCategorySelection(selectedCategory, customCategory);
    if (!categorie) {
      setError("Choisissez une catégorie ou indiquez le nom de la nouvelle catégorie.");
      return;
    }
    onBookFound({ ...(book || bookData), categorie, emplacement: shelfLetter ? `${shelfNumber}${shelfLetter}` : null });
    setBookData(null);
    setResults([]);
    setLookupSource("");
    setLookupSources([]);
    setQuery("");
    setSelectedCategory("");
    setCustomCategory("");
    setShelfLetter("");
    setShelfNumber("");
  };

  const selectResult = (book) => {
    if (book.isbn) { setQuery(book.isbn); void handleSearch(book.isbn); return; }
    setBookData(book);
    setResults([]);
    setLookupSource("catalogues");
  };

  return (
    <div className="w-full min-w-0 space-y-4 rounded-xl border border-white/10 bg-biblio-card p-4 sm:p-6">
      <h2 className="flex min-w-0 items-center gap-2 text-lg font-semibold leading-tight"><Search className="h-5 w-5 shrink-0 text-biblio-accent" /> <span className="min-w-0">Ajouter un livre par ISBN ou titre</span></h2>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
        <input type="text" inputMode={letterKeyboard ? "text" : "numeric"} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && handleSearch()} placeholder="ISBN (ex. 9782070360024) ou titre du livre" className="min-w-0 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent sm:flex-1" />
        <button onClick={() => handleSearch()} disabled={loading || !query.trim()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-biblio-accent px-5 py-3 font-medium text-white transition-colors hover:bg-biblio-accent-hover disabled:opacity-50 sm:w-auto sm:px-6">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Rechercher</button>
      </div>
      <button type="button" onClick={() => setLetterKeyboard((value) => !value)} className="text-xs text-biblio-accent underline">{letterKeyboard ? "Utiliser le clavier numérique pour l’ISBN" : "Utiliser les lettres pour un titre ou un ISBN avec X"}</button>
      {loading && <p className="text-xs text-biblio-muted">Recherche dans les catalogues ; si nécessaire, l’ISBN peut aussi être recherché sur le web avec l’IA.</p>}
      {error && <div className="flex flex-wrap items-center gap-2 rounded-lg bg-biblio-danger/10 p-3 text-sm text-biblio-danger"><AlertCircle className="h-4 w-4 shrink-0" /><span className="flex-1">{error}</span>{onUnresolved && <button type="button" onClick={() => onUnresolved(query)} className="rounded-md border border-biblio-danger/40 px-3 py-1.5 text-xs font-medium hover:bg-biblio-danger/10">Identifier avec 2 photos</button>}</div>}
      {message && <p role="status" className="rounded-lg bg-biblio-success/10 p-3 text-sm text-biblio-success">{message}</p>}
      {bookData && <>{lookupSource === "openai_web" && <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"><p><strong>Proposition de l’IA — à vérifier.</strong> Compare l’ISBN, le titre et l’édition avec le livre avant de l’ajouter. Les pages ci-dessous ont été consultées par la recherche et ne garantissent pas chaque information.</p><p className="flex flex-wrap gap-2">{lookupSources.map((item) => <a className="underline" key={item.url} href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>)}</p><button type="button" onClick={() => onUnresolved?.(query)} className="underline">Mettre plutôt dans « À identifier »</button></div>}<BookResult busy={loading} book={bookData} source={lookupSource} categories={categories} selectedCategory={selectedCategory} customCategory={customCategory} onCategoryChange={(value) => { setSelectedCategory(value); if (value !== OTHER_CATEGORY) setCustomCategory(""); }} onCustomCategoryChange={setCustomCategory} onConfirm={() => confirm()} />{<fieldset className="grid grid-cols-2 gap-3"><legend className="mb-2 text-sm font-medium">Emplacement sur l'étagère (obligatoire)</legend><label className="text-sm">Lettre<select aria-label="Lettre de l'emplacement" value={shelfLetter} onChange={(event) => setShelfLetter(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"><option value="">Choisir A à E</option>{["A", "B", "C", "D", "E"].map((letter) => <option key={letter} value={letter}>{letter}</option>)}</select></label><label className="text-sm">Chiffre<select aria-label="Chiffre de l'emplacement" value={shelfNumber} onChange={(event) => setShelfNumber(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2"><option value="">Choisir 1 à 5</option>{[1, 2, 3, 4, 5].map((number) => <option key={number} value={number}>{number}</option>)}</select></label><p className="col-span-2 text-xs text-biblio-muted">{shelfLetter && shelfNumber ? `Emplacement : ${shelfLetter}${shelfNumber}` : "Exemple : A1"}</p></fieldset>}</>}
      {results.length > 0 && <div className="space-y-2"><p className="text-xs text-biblio-muted">{results.length} résultat(s) : choisissez le bon livre, puis sa catégorie avant l&apos;ajout.</p>{results.map((book, index) => <button key={`${book.isbn}-${index}`} onClick={() => selectResult(book)} className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-left transition-colors hover:bg-white/10">{book.couverture_url ? <img src={book.couverture_url} alt="" className="h-14 w-10 rounded object-contain" /> : <span className="h-14 w-10 rounded bg-white/10" />}<span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-biblio-text">{book.titre}</span><span className="block truncate text-xs text-biblio-muted">{book.auteur || "Auteur inconnu"}</span><span className="text-xs text-biblio-muted">{book.annee}{book.editeur ? ` · ${book.editeur}` : ""}</span></span><CheckCircle className="h-5 w-5 shrink-0 text-biblio-success" /></button>)}</div>}
    </div>
  );
}

function BookResult({ busy, book, source, categories, selectedCategory, customCategory, onCategoryChange, onCustomCategoryChange, onConfirm }) {
  return <div className="flex min-w-0 flex-col gap-4 rounded-lg border border-biblio-accent/30 bg-white/5 p-4 sm:flex-row">{book.couverture_url && <img src={book.couverture_url} alt={book.titre} className="h-36 w-24 shrink-0 rounded object-contain" />}<div className="min-w-0 flex-1 space-y-3"><div className="space-y-1"><h3 className="break-words font-semibold text-biblio-text">{book.titre}</h3><p className="break-words text-sm text-biblio-muted">{book.auteur || "Auteur inconnu"}</p>{book.editeur && <p className="break-words text-xs text-biblio-muted">Éditeur : {book.editeur}</p>}{book.annee && <p className="text-xs text-biblio-muted">Année : {book.annee}</p>}{book.isbn && <p className="break-all font-mono text-xs text-biblio-muted">ISBN : {book.isbn}</p>}{source === "catalogue" && <p className="text-xs text-biblio-success">Ce livre est déjà dans votre catalogue. Souhaitez-vous ajouter un exemplaire ? Actuellement : {book.nb_exemplaires || 1}.</p>}</div><div style={{ display: source === "catalogue" ? "none" : undefined }}><label className="mb-1 block text-xs font-medium text-biblio-muted">Catégorie</label><select value={selectedCategory} onChange={(event) => onCategoryChange(event.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-biblio-text focus:outline-none focus:ring-2 focus:ring-biblio-accent"><option value="">— Choisir une catégorie —</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}<option value={OTHER_CATEGORY}>Autre (créer une catégorie)</option></select>{selectedCategory === OTHER_CATEGORY && <input value={customCategory} onChange={(event) => onCustomCategoryChange(event.target.value)} placeholder="Nom de la nouvelle catégorie" maxLength={80} className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent" />}</div></div><button onClick={onConfirm} disabled={busy} className="flex w-full items-center justify-center rounded-lg bg-biblio-success px-5 py-2.5 font-medium text-white disabled:opacity-50 sm:w-auto sm:self-center"><CheckCircle className="mr-2 inline h-4 w-4" />{source === "catalogue" ? "Ajouter un exemplaire" : "Ajouter"}</button></div>;
}
