import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { BookOpen, Loader2, Search } from "lucide-react";
import SearchISBN from "../components/SearchISBN";
import LivreCard from "../components/LivreCard";

export default function Livres() {
  const [livres, setLivres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recherche, setRecherche] = useState("");

  // Charger tous les livres au montage
  useEffect(() => {
    fetchLivres();
  }, []);

  const fetchLivres = async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("livres")
        .select("*")
        .order("date_ajout", { ascending: false });

      if (err) throw err;
      setLivres(data || []);
    } catch (err) {
      setError("Impossible de charger les livres : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Ajouter un livre trouvé via ISBN
  const handleAddBook = async (bookData) => {
    try {
      const { error: err } = await supabase.from("livres").insert([bookData]);
      if (err) {
        if (err.code === "23505") {
          setError("Ce livre (ISBN) existe déjà dans la base.");
        } else {
          throw err;
        }
        return;
      }
      setError("");
      await fetchLivres();
    } catch (err) {
      setError("Erreur lors de l'ajout : " + err.message);
    }
  };

  // Supprimer un livre
  const handleDelete = async (id) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce livre ?"))
      return;

    try {
      const { error: err } = await supabase
        .from("livres")
        .delete()
        .eq("id", id);
      if (err) throw err;
      setLivres((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      setError("Erreur lors de la suppression : " + err.message);
    }
  };

  // Filtrer les livres par recherche
  const livresFiltres = livres.filter((l) => {
    const q = recherche.toLowerCase();
    return (
      l.titre?.toLowerCase().includes(q) ||
      l.auteur?.toLowerCase().includes(q) ||
      l.isbn?.includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-biblio-accent" />
          Gestion des livres
        </h1>
        <p className="text-biblio-muted mt-1">
          {livres.length} livre{livres.length !== 1 ? "s" : ""} dans le
          catalogue
        </p>
      </div>

      {/* Recherche ISBN */}
      <SearchISBN onBookFound={handleAddBook} />

      {/* Message d'erreur */}
      {error && (
        <div className="bg-biblio-danger/10 text-biblio-danger p-4 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Barre de recherche locale */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-biblio-muted" />
        <input
          type="text"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un livre (titre, auteur, ISBN)..."
          className="w-full bg-biblio-card border border-white/10 rounded-lg pl-10 pr-4 py-3 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent"
        />
      </div>

      {/* Grille de livres */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-biblio-accent" />
        </div>
      ) : livresFiltres.length === 0 ? (
        <div className="text-center py-12 text-biblio-muted">
          {recherche
            ? "Aucun livre ne correspond à votre recherche."
            : "Aucun livre dans le catalogue. Ajoutez-en un par ISBN !"}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {livresFiltres.map((livre) => (
            <LivreCard key={livre.id} livre={livre} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
