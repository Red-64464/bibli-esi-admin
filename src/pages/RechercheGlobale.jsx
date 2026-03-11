import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useDebounce, formatDate, getPretStatut } from "../lib/utils";
import {
  Search,
  Loader2,
  BookOpen,
  Users,
  ArrowLeftRight,
  AlertCircle,
} from "lucide-react";

const SECTION_ICONS = {
  livres: BookOpen,
  etudiants: Users,
  prets: ArrowLeftRight,
};
const SECTION_LABELS = {
  livres: "Livres",
  etudiants: "Étudiants",
  prets: "Prêts",
};

export default function RechercheGlobale() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQ);
  const debouncedQuery = useDebounce(query, 400);
  const [results, setResults] = useState({ livres: [], etudiants: [], prets: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  // Raccourci clavier Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("global-search-input")?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const doSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 2) {
      setResults({ livres: [], etudiants: [], prets: [] });
      setHasSearched(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      const term = q.trim();

      const [livresRes, etudRes, pretsRes] = await Promise.all([
        supabase
          .from("livres")
          .select("id, titre, auteur, isbn, statut, disponible")
          .or(`titre.ilike.%${term}%,auteur.ilike.%${term}%,isbn.ilike.%${term}%`)
          .limit(10),
        supabase
          .from("etudiants")
          .select("id, nom, prenom, email, numero_etudiant")
          .or(`nom.ilike.%${term}%,prenom.ilike.%${term}%,email.ilike.%${term}%,numero_etudiant.ilike.%${term}%`)
          .limit(10),
        supabase
          .from("prets")
          .select("id, date_pret, rendu, statut, date_retour_prevue, livres(titre), etudiants(nom, prenom)")
          .or(`livres.titre.ilike.%${term}%,etudiants.nom.ilike.%${term}%,etudiants.prenom.ilike.%${term}%`)
          .limit(10),
      ]);

      setResults({
        livres: livresRes.data || [],
        etudiants: etudRes.data || [],
        prets: pretsRes.data || [],
      });
      setHasSearched(true);
    } catch (err) {
      setError("Erreur de recherche : " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    doSearch(debouncedQuery);
    if (debouncedQuery) {
      setSearchParams({ q: debouncedQuery });
    } else {
      setSearchParams({});
    }
  }, [debouncedQuery, doSearch, setSearchParams]);

  // Sync avec query param initial
  useEffect(() => {
    if (initialQ) doSearch(initialQ);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalResults =
    results.livres.length + results.etudiants.length + results.prets.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Search className="w-8 h-8 text-biblio-accent" />
          Recherche globale
        </h1>
        <p className="text-biblio-muted mt-1">
          Recherchez parmi les livres, étudiants et prêts
        </p>
      </div>

      {/* Barre de recherche */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-biblio-muted pointer-events-none" />
        <input
          id="global-search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un livre, un étudiant, un prêt… (Ctrl+K)"
          autoFocus
          className="w-full pl-12 pr-4 py-4 bg-biblio-card border border-white/10 rounded-xl text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent text-base"
        />
        {loading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-biblio-accent" />
        )}
      </div>

      {error && (
        <div className="bg-biblio-danger/10 text-biblio-danger p-4 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Résultats */}
      {hasSearched && !loading && (
        <>
          {totalResults === 0 ? (
            <div className="text-center py-12 text-biblio-muted">
              Aucun résultat pour &laquo; {debouncedQuery} &raquo;
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-sm text-biblio-muted">
                {totalResults} résultat{totalResults !== 1 ? "s" : ""} pour{" "}
                &laquo; {debouncedQuery} &raquo;
              </p>

              {/* Livres */}
              {results.livres.length > 0 && (
                <ResultSection
                  label="Livres"
                  icon={BookOpen}
                  count={results.livres.length}
                >
                  {results.livres.map((l) => (
                    <Link
                      key={l.id}
                      to="/livres"
                      className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-biblio-text line-clamp-1">
                          {l.titre}
                        </p>
                        <p className="text-xs text-biblio-muted">
                          {l.auteur || "Auteur inconnu"} · ISBN: {l.isbn}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ml-3 shrink-0 ${
                          l.disponible
                            ? "bg-biblio-success/20 text-biblio-success"
                            : "bg-biblio-warning/20 text-biblio-warning"
                        }`}
                      >
                        {l.disponible ? "Disponible" : "Emprunté"}
                      </span>
                    </Link>
                  ))}
                </ResultSection>
              )}

              {/* Étudiants */}
              {results.etudiants.length > 0 && (
                <ResultSection
                  label="Étudiants"
                  icon={Users}
                  count={results.etudiants.length}
                >
                  {results.etudiants.map((e) => (
                    <Link
                      key={e.id}
                      to={`/etudiants/${e.id}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-biblio-text">
                          {e.prenom} {e.nom}
                        </p>
                        <p className="text-xs text-biblio-muted">
                          {e.email || "Pas d'email"}
                          {e.numero_etudiant && ` · N° ${e.numero_etudiant}`}
                        </p>
                      </div>
                      <span className="text-xs text-biblio-accent hover:underline shrink-0 ml-3">
                        Voir profil →
                      </span>
                    </Link>
                  ))}
                </ResultSection>
              )}

              {/* Prêts */}
              {results.prets.length > 0 && (
                <ResultSection
                  label="Prêts"
                  icon={ArrowLeftRight}
                  count={results.prets.length}
                >
                  {results.prets.map((p) => {
                    const statut = getPretStatut(p);
                    return (
                      <Link
                        key={p.id}
                        to="/prets"
                        className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-biblio-text line-clamp-1">
                            {p.livres?.titre || "—"}
                          </p>
                          <p className="text-xs text-biblio-muted">
                            {p.etudiants
                              ? `${p.etudiants.prenom} ${p.etudiants.nom}`
                              : "—"}{" "}
                            · {formatDate(p.date_pret)}
                          </p>
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ml-3 shrink-0 ${
                            statut === "retourné"
                              ? "bg-biblio-success/20 text-biblio-success"
                              : statut === "en_retard"
                                ? "bg-biblio-danger/20 text-biblio-danger"
                                : "bg-biblio-warning/20 text-biblio-warning"
                          }`}
                        >
                          {statut === "retourné"
                            ? "Rendu"
                            : statut === "en_retard"
                              ? "En retard"
                              : "En cours"}
                        </span>
                      </Link>
                    );
                  })}
                </ResultSection>
              )}
            </div>
          )}
        </>
      )}

      {!hasSearched && !loading && (
        <div className="text-center py-12 text-biblio-muted">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Tapez au moins 2 caractères pour rechercher</p>
          <p className="text-sm mt-1 opacity-60">
            Raccourci : Ctrl+K (Windows/Linux) ou Cmd+K (Mac)
          </p>
        </div>
      )}
    </div>
  );
}

function ResultSection({ label, icon: Icon, count, children }) {
  return (
    <div className="bg-biblio-card rounded-xl border border-white/10 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
        <Icon className="w-4 h-4 text-biblio-accent" />
        <h3 className="text-sm font-semibold text-biblio-text">{label}</h3>
        <span className="text-xs text-biblio-muted ml-1">({count})</span>
      </div>
      <div className="divide-y divide-white/5">{children}</div>
    </div>
  );
}
