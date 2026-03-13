import { useState, useEffect } from "react";
import { Search, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { normalizeCategory } from "../lib/categories";

const isIsbn = (q) => /^[\d\-\s]{9,17}$/.test(q.trim());

const LANG_MAP = {
  fr: "Français",
  en: "Anglais",
  ar: "Arabe",
  es: "Espagnol",
  de: "Allemand",
  it: "Italien",
  pt: "Portugais",
  zh: "Chinois",
  ja: "Japonais",
  ru: "Russe",
  nl: "Néerlandais",
  pl: "Polonais",
  tr: "Turc",
  ko: "Coréen",
  sv: "Suédois",
  da: "Danois",
  fi: "Finnois",
  no: "Norvégien",
  cs: "Tchèque",
  hu: "Hongrois",
};

const extractBook = (item, fallbackIsbn = "") => {
  const info = item.volumeInfo;
  const isbn13 = info.industryIdentifiers?.find(
    (i) => i.type === "ISBN_13",
  )?.identifier;
  const isbn10 = info.industryIdentifiers?.find(
    (i) => i.type === "ISBN_10",
  )?.identifier;

  const langCode = info.language || "";
  const langue = LANG_MAP[langCode] || langCode || "";

  return {
    isbn: isbn13 || isbn10 || fallbackIsbn,
    titre: info.title || "Titre inconnu",
    auteur: info.authors?.join(", ") || "",
    editeur: info.publisher || "",
    couverture_url:
      info.imageLinks?.large?.replace("http://", "https://") ||
      info.imageLinks?.thumbnail?.replace("http://", "https://") ||
      info.imageLinks?.smallThumbnail?.replace("http://", "https://") ||
      "",
    annee: info.publishedDate?.slice(0, 4) || "",
    // Nouveaux champs
    resume: info.description || "",
    langue: langue,
    categorie: normalizeCategory(info.categories?.[0] || ""),
    nb_pages: info.pageCount || null,
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

  // ── Fetch Google Books par ISBN → book object ou null ──
  const fetchGoogleBooks = async (isbn) => {
    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&maxResults=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.items?.length) return null;
    return extractBook(data.items[0], isbn);
  };

  // ── Fetch Open Library par ISBN → book object ou null ──
  const fetchOpenLibrary = async (isbn) => {
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
    const res = await fetch(url);
    const data = await res.json();
    const entry = data[`ISBN:${isbn}`];
    if (!entry) return null;

    const langRaw = entry.languages?.[0]?.key?.split("/").pop() || "";
    const OL_LANG_MAP = {
      fre: "Français",
      fra: "Français",
      eng: "Anglais",
      ara: "Arabe",
      spa: "Espagnol",
      deu: "Allemand",
      ita: "Italien",
      por: "Portugais",
      zho: "Chinois",
      jpn: "Japonais",
      rus: "Russe",
    };
    const rawCat =
      entry.subjects?.[0]?.name || entry.subject_places?.[0]?.name || "";
    const notes = entry.notes;

    return {
      isbn,
      titre: entry.title || "",
      auteur: entry.authors?.map((a) => a.name).join(", ") || "",
      editeur: entry.publishers?.[0]?.name || "",
      couverture_url:
        entry.cover?.large || entry.cover?.medium || entry.cover?.small || "",
      annee: entry.publish_date?.match(/\d{4}/)?.[0] || "",
      resume: typeof notes === "string" ? notes : notes?.value || "",
      langue: OL_LANG_MAP[langRaw] || "",
      categorie: normalizeCategory(rawCat),
      nb_pages: entry.number_of_pages || null,
    };
  };

  // ── Fetch BnF (Bibliothèque nationale de France) par ISBN → book object ou null ──
  // Meilleure couverture pour les livres techniques français (Eyrolles, Dunod, etc.)
  const fetchBnF = async (isbn) => {
    const query = encodeURIComponent(`bib.isbn all "${isbn}"`);
    const url = `https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&query=${query}&recordSchema=dublincore&maximumRecords=1`;
    const res = await fetch(url);
    const text = await res.text();

    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "text/xml");

    const countEl = xml.getElementsByTagName("numberOfRecords")[0];
    if (!countEl || countEl.textContent.trim() === "0") return null;

    // Helpers pour extraire les champs en ignorant le préfixe de namespace (dc:title, etc.)
    const getFirst = (localName) =>
      [...xml.getElementsByTagName("*")]
        .find((n) => n.localName === localName)
        ?.textContent?.trim() || "";
    const getAll = (localName) =>
      [...xml.getElementsByTagName("*")]
        .filter((n) => n.localName === localName)
        .map((n) => n.textContent.trim());

    // Titre : "Les réseaux : édition 2011 (7e éd.) Guy Pujolle..."
    // On garde uniquement la partie avant " : " ou " / "
    const rawTitle = getFirst("title");
    const titre = rawTitle.split(/\s+[:/]\s+/)[0].trim() || rawTitle;

    // Auteur : "Pujolle, Guy (1949-....). Auteur du texte" → "Guy Pujolle"
    const rawCreator = getFirst("creator");
    let auteur = rawCreator
      .replace(/\s*\(\d{4}[^)]*\)[^,)]*$/g, "") // retirer "(1949-....)"
      .replace(
        /\.\s*(Auteur|Éditeur|Directeur|Traducteur|Collaborateur)[^,]*$/i,
        "",
      )
      .trim();
    if (auteur.includes(",")) {
      const [last, first] = auteur.split(",").map((s) => s.trim());
      auteur = first ? `${first} ${last}` : last;
    }

    // Éditeur : "Eyrolles (Paris)" → "Eyrolles"
    const rawPublisher = getFirst("publisher");
    const editeur = rawPublisher.replace(/\s*\([^)]+\)\s*$/, "").trim();

    // Langue : la BnF renvoie ["fre", "français"]
    const langs = getAll("language");
    const BNF_LANG_MAP = {
      fre: "Français",
      fra: "Français",
      fren: "Français",
      eng: "Anglais",
      ara: "Arabe",
      spa: "Espagnol",
      deu: "Allemand",
      ger: "Allemand",
    };
    const langue = BNF_LANG_MAP[langs[0]] || langs[1] || langs[0] || "";

    const annee = getFirst("date").match(/\d{4}/)?.[0] || "";

    // Sujets (souvent vides pour la BnF mais on essaie quand même)
    const rawSubject = getAll("subject").join(" ");

    // Couverture via l'ARK BnF
    const identifiers = getAll("identifier");
    const arkUrl = identifiers.find((id) => id.includes("ark:")) || "";
    const arkPath = arkUrl
      .replace("http://catalogue.bnf.fr/", "")
      .replace("https://catalogue.bnf.fr/", "");
    const couverture_url = arkPath
      ? `https://catalogue.bnf.fr/couverture?appName=NE&idArk=${arkPath}&couverture=1`
      : "";

    return {
      isbn,
      titre: titre || "Titre inconnu",
      auteur,
      editeur,
      couverture_url,
      annee,
      resume: "",
      langue,
      categorie: normalizeCategory(rawSubject),
      nb_pages: null,
    };
  };

  // ── Fusion intelligente des 3 sources : prend le meilleur champ par champ ──
  const mergeBooks = (gb, ol, bnf) => {
    const sources = [gb, ol, bnf].filter(Boolean);
    if (!sources.length) return null;

    // Pick : première valeur non vide et non "Titre inconnu", dans l'ordre de priorité
    const pick = (...vals) =>
      vals.find((v) => v && v !== "Titre inconnu" && v !== "") || vals[0] || "";
    // Longest : texte le plus long (résumé, auteur)
    const longest = (...vals) =>
      vals.reduce(
        (best, v) => ((v?.length || 0) > (best?.length || 0) ? v : best),
        "",
      );
    // bestCat : évite "Autre" si une source plus précise existe
    const bestCat = (...vals) => {
      const precise = vals.find((v) => v && v !== "Autre" && v !== "");
      return precise || vals.find(Boolean) || "";
    };

    return {
      isbn: pick(gb?.isbn, ol?.isbn, bnf?.isbn),
      // Titre : BnF le plus propre pour les livres FR, puis Google, puis OL
      titre: pick(bnf?.titre, gb?.titre, ol?.titre),
      // Auteur : Google le plus propre (format naturel), puis BnF nettoyé, puis OL
      auteur: pick(gb?.auteur, bnf?.auteur, ol?.auteur),
      // Éditeur : BnF référence officielle française, puis Google, puis OL
      editeur: pick(bnf?.editeur, gb?.editeur, ol?.editeur),
      // Couverture : Google HD, puis OL, puis BnF
      couverture_url: pick(
        gb?.couverture_url,
        ol?.couverture_url,
        bnf?.couverture_url,
      ),
      // Année : BnF précis, puis Google, puis OL
      annee: pick(bnf?.annee, gb?.annee, ol?.annee),
      // Résumé : Google le plus complet, puis OL
      resume: longest(gb?.resume, ol?.resume, bnf?.resume),
      // Langue : BnF référence, puis Google, puis OL
      langue: pick(bnf?.langue, gb?.langue, ol?.langue),
      // Catégorie : la plus précise des 3
      categorie: bestCat(gb?.categorie, ol?.categorie, bnf?.categorie),
      nb_pages: gb?.nb_pages || ol?.nb_pages || null,
    };
  };

  const handleSearch = async (override) => {
    const q = (override ?? query).trim();
    if (!q) return;

    setLoading(true);
    setError("");
    setBookData(null);
    setResults([]);

    try {
      if (isIsbn(q)) {
        const cleanIsbn = q.replace(/[-\s]/g, "");

        // Appel PARALLÈLE des 3 sources simultanément
        const [gbResult, olResult, bnfResult] = await Promise.allSettled([
          fetchGoogleBooks(cleanIsbn),
          fetchOpenLibrary(cleanIsbn),
          fetchBnF(cleanIsbn),
        ]);

        const gb = gbResult.status === "fulfilled" ? gbResult.value : null;
        const ol = olResult.status === "fulfilled" ? olResult.value : null;
        const bnf = bnfResult.status === "fulfilled" ? bnfResult.value : null;

        const merged = mergeBooks(gb, ol, bnf);
        if (merged) {
          setBookData(merged);
          return;
        }

        setError(
          "Aucun livre trouvé pour cet ISBN. Vérifiez le numéro ou ajoutez manuellement.",
        );
      } else {
        const url = `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(q)}&maxResults=8&langRestrict=fr`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.items?.length) {
          setError(
            "Aucun livre trouvé. Essayez un autre terme ou ajoutez manuellement.",
          );
          return;
        }
        setResults(data.items.map((item) => extractBook(item)));
      }
    } catch {
      setError("Erreur de connexion. Vérifiez votre connexion internet.");
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
