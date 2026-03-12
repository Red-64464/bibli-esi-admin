import { useState, useEffect } from "react";
import { Search, Loader2, CheckCircle, AlertCircle } from "lucide-react";

const isIsbn = (q) => /^[\d\-\s]{9,17}$/.test(q.trim());

const extractBook = (item, fallbackIsbn = "") => {
  const info = item.volumeInfo;
  const isbn13 = info.industryIdentifiers?.find(
    (i) => i.type === "ISBN_13",
  )?.identifier;
  const isbn10 = info.industryIdentifiers?.find(
    (i) => i.type === "ISBN_10",
  )?.identifier;
  return {
    isbn: isbn13 || isbn10 || fallbackIsbn,
    titre: info.title || "Titre inconnu",
    auteur: info.authors?.join(", ") || "",
    editeur: info.publisher || "",
    couverture_url:
      info.imageLinks?.thumbnail?.replace("http://", "https://") ||
      info.imageLinks?.smallThumbnail?.replace("http://", "https://") ||
      "",
    annee: info.publishedDate?.slice(0, 4) || "",
  };
};

export default function SearchISBN({
  onBookFound,
  defaultIsbn,
  onDefaultIsbnUsed,
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [bookData, setBookData] = useState(null); // résultat unique (ISBN)
  const [results, setResults] = useState([]); // liste (titre)
  const [error, setError] = useState("");

  // Pré-remplir l'ISBN si scanné via caméra
  useEffect(() => {
    if (defaultIsbn) {
      setQuery(defaultIsbn);
      onDefaultIsbnUsed?.();
      setTimeout(() => handleSearch(defaultIsbn), 100);
    }
  }, [defaultIsbn]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = async (override) => {
    const q = (override ?? query).trim();
    if (!q) return;

    setLoading(true);
    setError("");
    setBookData(null);
    setResults([]);

    try {
      let url;
      if (isIsbn(q)) {
        const cleanIsbn = q.replace(/[-\s]/g, "");
        url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(cleanIsbn)}&maxResults=1`;
      } else {
        url = `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(q)}&maxResults=8&langRestrict=fr`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (!data.items?.length) {
        setError(
          "Aucun livre trouvé. Essayez un autre terme ou ajoutez manuellement.",
        );
        return;
      }

      if (isIsbn(q)) {
        setBookData(extractBook(data.items[0], q.replace(/[-\s]/g, "")));
      } else {
        setResults(data.items.map((item) => extractBook(item)));
      }
    } catch {
      setError(
        "Erreur de connexion à Google Books. Vérifiez votre connexion internet.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = (book) => {
    onBookFound(book ?? bookData);
    setBookData(null);
    setResults([]);
    setQuery("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="bg-biblio-card rounded-xl border border-white/10 p-6 space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Search className="w-5 h-5 text-biblio-accent" />
        Ajouter un livre par ISBN ou titre
      </h2>

      {/* Champ de recherche */}
      <div className="flex gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="ISBN (ex: 9782070360024) ou titre du livre"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent"
        />
        <button
          onClick={() => handleSearch()}
          disabled={loading || !query.trim()}
          className="px-6 py-3 bg-biblio-accent hover:bg-biblio-accent-hover disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          Rechercher
        </button>
      </div>

      {/* Message d'erreur */}
      {error && (
        <div className="flex items-center gap-2 text-biblio-danger text-sm bg-biblio-danger/10 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Résultat unique (recherche ISBN) */}
      {bookData && (
        <div className="flex gap-4 bg-white/5 p-4 rounded-lg border border-biblio-accent/30">
          {bookData.couverture_url && (
            <img
              src={bookData.couverture_url}
              alt={bookData.titre}
              className="w-24 h-36 object-contain rounded"
            />
          )}
          <div className="flex-1 space-y-1">
            <h3 className="font-semibold text-biblio-text">{bookData.titre}</h3>
            <p className="text-sm text-biblio-muted">
              {bookData.auteur || "Auteur inconnu"}
            </p>
            {bookData.editeur && (
              <p className="text-xs text-biblio-muted">
                Éditeur : {bookData.editeur}
              </p>
            )}
            {bookData.annee && (
              <p className="text-xs text-biblio-muted">
                Année : {bookData.annee}
              </p>
            )}
            <p className="text-xs text-biblio-muted font-mono">
              ISBN : {bookData.isbn}
            </p>
          </div>
          <button
            onClick={() => handleConfirm()}
            className="self-center px-5 py-2.5 bg-biblio-success hover:bg-biblio-success/80 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Ajouter
          </button>
        </div>
      )}

      {/* Liste de résultats (recherche par titre) */}
      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-biblio-muted">
            {results.length} résultat(s) — cliquez sur un livre pour l'ajouter :
          </p>
          {results.map((book, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-white/5 hover:bg-white/10 p-3 rounded-lg border border-white/10 cursor-pointer transition-colors"
              onClick={() => handleConfirm(book)}
            >
              {book.couverture_url ? (
                <img
                  src={book.couverture_url}
                  alt={book.titre}
                  className="w-10 h-14 object-contain rounded shrink-0"
                />
              ) : (
                <div className="w-10 h-14 bg-white/10 rounded shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-biblio-text text-sm truncate">
                  {book.titre}
                </p>
                <p className="text-xs text-biblio-muted truncate">
                  {book.auteur || "Auteur inconnu"}
                </p>
                <p className="text-xs text-biblio-muted">
                  {book.annee}
                  {book.editeur ? ` · ${book.editeur}` : ""}
                </p>
              </div>
              <CheckCircle className="w-5 h-5 text-biblio-success shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
