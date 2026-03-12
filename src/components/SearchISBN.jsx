import { useState, useEffect } from "react";
import { Search, Loader2, CheckCircle, AlertCircle } from "lucide-react";

export default function SearchISBN({
  onBookFound,
  defaultIsbn,
  onDefaultIsbnUsed,
}) {
  const [isbn, setIsbn] = useState("");
  const [loading, setLoading] = useState(false);
  const [bookData, setBookData] = useState(null);
  const [error, setError] = useState("");

  // Pré-remplir l'ISBN si scanné via caméra
  useEffect(() => {
    if (defaultIsbn) {
      setIsbn(defaultIsbn);
      onDefaultIsbnUsed?.();
      // Lancer la recherche automatiquement
      setTimeout(() => handleSearchByIsbn(defaultIsbn), 100);
    }
  }, [defaultIsbn]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearchByIsbn = async (isbnValue) => {
    const cleanIsbn = (isbnValue || isbn).replace(/[-\s]/g, "").trim();
    if (!cleanIsbn) return;

    setLoading(true);
    setError("");
    setBookData(null);

    try {
      // Google Books API — base de données très complète, gratuite, sans clé
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(cleanIsbn)}`,
      );
      const data = await response.json();

      if (!data.items?.length) {
        setError(
          "Aucun livre trouvé pour cet ISBN. Vous pouvez l'ajouter manuellement.",
        );
        return;
      }

      const info = data.items[0].volumeInfo;
      const result = {
        isbn: cleanIsbn,
        titre: info.title || "Titre inconnu",
        auteur: info.authors?.join(", ") || "",
        editeur: info.publisher || "",
        couverture_url:
          info.imageLinks?.thumbnail?.replace("http://", "https://") ||
          info.imageLinks?.smallThumbnail?.replace("http://", "https://") ||
          "",
        annee: info.publishedDate?.slice(0, 4) || "",
      };
      setBookData(result);
    } catch {
      setError(
        "Erreur de connexion à Google Books. Vérifiez votre connexion internet.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Confirmer l'ajout du livre trouvé
  const handleConfirm = () => {
    if (bookData) {
      onBookFound(bookData);
      setBookData(null);
      setIsbn("");
    }
  };

  // Saisie clavier : Entrée pour rechercher
  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearchByIsbn();
  };

  const handleSearch = () => handleSearchByIsbn();

  return (
    <div className="bg-biblio-card rounded-xl border border-white/10 p-6 space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Search className="w-5 h-5 text-biblio-accent" />
        Ajouter un livre par ISBN
      </h2>

      {/* Champ de recherche */}
      <div className="flex gap-3">
        <input
          type="text"
          value={isbn}
          onChange={(e) => setIsbn(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Entrez un ISBN (ex: 9782070360024)"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent"
        />
        <button
          onClick={handleSearch}
          disabled={loading || !isbn.trim()}
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

      {/* Aperçu du livre trouvé */}
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
            onClick={handleConfirm}
            className="self-center px-5 py-2.5 bg-biblio-success hover:bg-biblio-success/80 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Ajouter
          </button>
        </div>
      )}
    </div>
  );
}
