import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Users, Loader2, UserPlus, Search } from "lucide-react";
import EtudiantCard from "../components/EtudiantCard";

export default function Etudiants() {
  const [etudiants, setEtudiants] = useState([]);
  const [pretsActifs, setPretsActifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recherche, setRecherche] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    email: "",
    numero_etudiant: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Charger étudiants et prêts actifs en parallèle
      const [etudRes, pretsRes] = await Promise.all([
        supabase
          .from("etudiants")
          .select("*")
          .order("date_inscription", { ascending: false }),
        supabase.from("prets").select("*, livres(titre)").eq("rendu", false),
      ]);

      if (etudRes.error) throw etudRes.error;
      if (pretsRes.error) throw pretsRes.error;

      setEtudiants(etudRes.data || []);
      setPretsActifs(pretsRes.data || []);
    } catch (err) {
      setError("Impossible de charger les données : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Ajouter un étudiant
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.nom.trim() || !form.prenom.trim()) return;

    try {
      const { error: err } = await supabase.from("etudiants").insert([form]);
      if (err) {
        if (err.code === "23505") {
          setError("Cet email ou numéro étudiant existe déjà.");
        } else {
          throw err;
        }
        return;
      }
      setForm({ nom: "", prenom: "", email: "", numero_etudiant: "" });
      setShowForm(false);
      setError("");
      await fetchData();
    } catch (err) {
      setError("Erreur lors de l'ajout : " + err.message);
    }
  };

  // Supprimer un étudiant
  const handleDelete = async (id) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet étudiant ?"))
      return;

    try {
      const { error: err } = await supabase
        .from("etudiants")
        .delete()
        .eq("id", id);
      if (err) throw err;
      setEtudiants((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError("Erreur lors de la suppression : " + err.message);
    }
  };

  // Obtenir les livres empruntés par un étudiant
  const getLivresEmpruntes = (etudiantId) => {
    return pretsActifs
      .filter((p) => p.etudiant_id === etudiantId)
      .map((p) => p.livres?.titre || "Titre inconnu");
  };

  // Filtrage
  const etudiantsFiltres = etudiants.filter((e) => {
    const q = recherche.toLowerCase();
    return (
      e.nom?.toLowerCase().includes(q) ||
      e.prenom?.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q) ||
      e.numero_etudiant?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Users className="w-8 h-8 text-biblio-accent" />
            Gestion des étudiants
          </h1>
          <p className="text-biblio-muted mt-1">
            {etudiants.length} étudiant{etudiants.length !== 1 ? "s" : ""}{" "}
            inscrit{etudiants.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-5 py-2.5 bg-biblio-accent hover:bg-biblio-accent-hover text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <UserPlus className="w-5 h-5" />
          Ajouter un étudiant
        </button>
      </div>

      {/* Formulaire d'ajout */}
      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-biblio-card rounded-xl border border-white/10 p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold">Nouvel étudiant</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text"
              value={form.prenom}
              onChange={(e) => setForm({ ...form, prenom: e.target.value })}
              placeholder="Prénom *"
              required
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent"
            />
            <input
              type="text"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              placeholder="Nom *"
              required
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent"
            />
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email"
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent"
            />
            <input
              type="text"
              value={form.numero_etudiant}
              onChange={(e) =>
                setForm({ ...form, numero_etudiant: e.target.value })
              }
              placeholder="Numéro étudiant"
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="px-5 py-2.5 bg-biblio-success hover:bg-biblio-success/80 text-white rounded-lg font-medium transition-colors"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg font-medium transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Erreur */}
      {error && (
        <div className="bg-biblio-danger/10 text-biblio-danger p-4 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-biblio-muted" />
        <input
          type="text"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un étudiant (nom, prénom, email, numéro)..."
          className="w-full bg-biblio-card border border-white/10 rounded-lg pl-10 pr-4 py-3 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent"
        />
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-biblio-accent" />
        </div>
      ) : etudiantsFiltres.length === 0 ? (
        <div className="text-center py-12 text-biblio-muted">
          {recherche
            ? "Aucun étudiant trouvé."
            : "Aucun étudiant inscrit. Ajoutez-en un !"}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {etudiantsFiltres.map((etudiant) => (
            <EtudiantCard
              key={etudiant.id}
              etudiant={etudiant}
              livresEmpruntes={getLivresEmpruntes(etudiant.id)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
