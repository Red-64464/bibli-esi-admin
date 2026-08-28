import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const googleBooksApiKey = Deno.env.get("GOOGLE_BOOKS_API_KEY");
const contactEmail = Deno.env.get("BIBLIESI_CONTACT_EMAIL");
const allowedOrigin = "https://bibliesi-admin.75.119.140.201.nip.io";
const rateLimits = new Map<string, { count: number; resetAt: number }>();

type Book = Record<string, string | number | null>;

function headers(request: Request) {
  const origin = request.headers.get("origin");
  return {
    "Access-Control-Allow-Origin": origin === allowedOrigin ? origin : allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  };
}

function reply(request: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: headers(request) });
}

function normalizeIsbn(value: string) {
  const isbn = value.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (/^\d{13}$/.test(isbn)) {
    const total = [...isbn].slice(0, 12).reduce((sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
    return (10 - (total % 10)) % 10 === Number(isbn[12]) ? isbn : null;
  }
  if (/^\d{9}[\dX]$/.test(isbn)) {
    const total = [...isbn].reduce((sum, digit, index) => sum + (digit === "X" ? 10 : Number(digit)) * (10 - index), 0);
    return total % 11 === 0 ? isbn : null;
  }
  return null;
}

function language(code = "") {
  const labels: Record<string, string> = { fr: "Français", fre: "Français", fra: "Français", en: "Anglais", eng: "Anglais", nl: "Néerlandais", nld: "Néerlandais", de: "Allemand", deu: "Allemand", es: "Espagnol", spa: "Espagnol", it: "Italien", ita: "Italien", ar: "Arabe", ara: "Arabe" };
  return labels[code.toLowerCase()] || code;
}

function stripXml(value: string) {
  return value.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim();
}

async function safeFetch(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return response.ok ? response : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function googleBook(item: any, fallbackIsbn = ""): Book | null {
  const info = item?.volumeInfo;
  if (!info) return null;
  const ids = info.industryIdentifiers || [];
  return {
    isbn: ids.find((entry: any) => entry.type === "ISBN_13")?.identifier || ids.find((entry: any) => entry.type === "ISBN_10")?.identifier || fallbackIsbn,
    titre: info.title || "", auteur: info.authors?.join(", ") || "", editeur: info.publisher || "",
    couverture_url: (info.imageLinks?.large || info.imageLinks?.thumbnail || "").replace("http://", "https://"),
    annee: info.publishedDate?.slice(0, 4) || "", resume: info.description || "", langue: language(info.language),
    categorie: info.categories?.[0] || "Autre", nb_pages: info.pageCount || null,
  };
}

async function googleByIsbn(isbn: string) {
  const key = googleBooksApiKey ? `&key=${encodeURIComponent(googleBooksApiKey)}` : "";
  const response = await safeFetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&maxResults=1${key}`);
  return googleBook(response ? (await response.json())?.items?.[0] : null, isbn);
}

async function googleByTitle(query: string): Promise<Book[]> {
  const key = googleBooksApiKey ? `&key=${encodeURIComponent(googleBooksApiKey)}` : "";
  const response = await safeFetch(`https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(query)}&maxResults=8${key}`);
  const items = response ? (await response.json())?.items || [] : [];
  return items.map((item: any) => googleBook(item)).filter(Boolean) as Book[];
}

async function openLibraryByIsbn(isbn: string): Promise<Book | null> {
  const userAgent = contactEmail ? `BiblESI/1.0 (${contactEmail})` : "BiblESI/1.0";
  const response = await safeFetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`, { headers: { "User-Agent": userAgent } });
  const entry = response ? (await response.json())?.[`ISBN:${isbn}`] : null;
  if (!entry) return null;
  return { isbn, titre: entry.title || "", auteur: entry.authors?.map((author: any) => author.name).join(", ") || "", editeur: entry.publishers?.[0]?.name || "", couverture_url: entry.cover?.large || entry.cover?.medium || entry.cover?.small || "", annee: entry.publish_date?.match(/\d{4}/)?.[0] || "", resume: typeof entry.notes === "string" ? entry.notes : entry.notes?.value || "", langue: language(entry.languages?.[0]?.key?.split("/").pop()), categorie: entry.subjects?.[0]?.name || "Autre", nb_pages: entry.number_of_pages || null };
}

async function openLibraryByTitle(query: string): Promise<Book[]> {
  const userAgent = contactEmail ? `BiblESI/1.0 (${contactEmail})` : "BiblESI/1.0";
  const response = await safeFetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(query)}&limit=8`, { headers: { "User-Agent": userAgent } });
  const docs = response ? (await response.json())?.docs || [] : [];
  return docs.map((doc: any) => ({ isbn: doc.isbn?.find((value: string) => /^97[89]\d{10}$/.test(value)) || doc.isbn?.[0] || "", titre: doc.title || "", auteur: doc.author_name?.join(", ") || "", editeur: doc.publisher?.[0] || "", couverture_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : "", annee: doc.first_publish_year || "", resume: "", langue: language(doc.language?.[0]), categorie: doc.subject?.[0] || "Autre", nb_pages: doc.number_of_pages_median || null }));
}

async function bnfByIsbn(isbn: string): Promise<Book | null> {
  const query = encodeURIComponent(`bib.isbn all "${isbn}"`);
  const response = await safeFetch(`https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&query=${query}&recordSchema=dublincore&maximumRecords=1`);
  const xml = response ? await response.text() : "";
  if (!/<[^>]*numberOfRecords[^>]*>[1-9]/.test(xml)) return null;
  const first = (tag: string) => stripXml(xml.match(new RegExp(`<[^>]*:${tag}[^>]*>([\\s\\S]*?)<\\/[^>]*:${tag}>`, "i"))?.[1] || "");
  const all = (tag: string) => [...xml.matchAll(new RegExp(`<[^>]*:${tag}[^>]*>([\\s\\S]*?)<\\/[^>]*:${tag}>`, "gi"))].map((match) => stripXml(match[1])).filter(Boolean);
  const creator = first("creator").replace(/\s*\([^)]*\)\s*/g, "").trim();
  const author = creator.includes(",") ? creator.split(",").reverse().map((part) => part.trim()).join(" ") : creator;
  const ark = all("identifier").find((value) => value.includes("ark:"))?.match(/ark:\/[^\s"']+/)?.[0];
  return { isbn, titre: first("title").split(/\s+[:/]\s+/)[0].trim(), auteur: author, editeur: first("publisher").replace(/\s*\([^)]+\)\s*$/, ""), couverture_url: ark ? `https://catalogue.bnf.fr/couverture?appName=NE&idArk=ark:/${ark.replace("ark:/", "")}&couverture=1` : "", annee: first("date").match(/\d{4}/)?.[0] || "", resume: "", langue: language(first("language")), categorie: all("subject")[0] || "Autre", nb_pages: null };
}

function pick(...values: Array<string | number | null | undefined>) {
  return values.find((value) => value !== null && value !== undefined && value !== "" && value !== "Autre") ?? values.find((value) => value !== null && value !== undefined) ?? "";
}

function merge(isbn: string, google: Book | null, openLibrary: Book | null, bnf: Book | null): Book | null {
  if (!google && !openLibrary && !bnf) return null;
  const descriptions = [google?.resume, openLibrary?.resume, bnf?.resume].map((value) => String(value || ""));
  return { isbn: pick(google?.isbn, openLibrary?.isbn, bnf?.isbn, isbn), titre: pick(bnf?.titre, google?.titre, openLibrary?.titre), auteur: pick(google?.auteur, bnf?.auteur, openLibrary?.auteur), editeur: pick(bnf?.editeur, google?.editeur, openLibrary?.editeur), couverture_url: pick(google?.couverture_url, openLibrary?.couverture_url, bnf?.couverture_url), annee: pick(bnf?.annee, google?.annee, openLibrary?.annee), resume: descriptions.reduce((best, value) => value.length > best.length ? value : best, ""), langue: pick(bnf?.langue, google?.langue, openLibrary?.langue), categorie: pick(google?.categorie, bnf?.categorie, openLibrary?.categorie, "Autre"), nb_pages: pick(google?.nb_pages, openLibrary?.nb_pages) };
}

function uniqueResults(books: Book[]) {
  const seen = new Set<string>();
  return books.filter((book) => {
    const key = `${String(book.titre || "").toLowerCase()}|${String(book.auteur || "").toLowerCase()}`;
    if (!book.titre || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

function allowRequest(userId: string) {
  const now = Date.now();
  const current = rateLimits.get(userId);
  if (!current || current.resetAt <= now) {
    rateLimits.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (current.count >= 20) return false;
  current.count += 1;
  return true;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(request) });
  if (request.method !== "POST" || !supabaseUrl || !anonKey || !serviceRoleKey) return reply(request, 400, { error: "Requête ou configuration invalide." });
  const token = request.headers.get("authorization");
  if (!token?.startsWith("Bearer ")) return reply(request, 401, { error: "Connexion requise." });
  const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: token } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData } = await caller.auth.getUser();
  if (!userData.user) return reply(request, 401, { error: "Session invalide." });
  if (!allowRequest(userData.user.id)) return reply(request, 429, { error: "Trop de recherches. Réessayez dans une minute." });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile } = await admin.from("bibli_profiles").select("id").eq("id", userData.user.id).maybeSingle();
  if (!profile) return reply(request, 403, { error: "Accès réservé au personnel de la bibliothèque." });
  const body = await request.json().catch(() => null) as { query?: unknown; isbn?: unknown } | null;
  const rawQuery = typeof body?.query === "string" ? body.query : typeof body?.isbn === "string" ? body.isbn : "";
  const query = rawQuery.trim().slice(0, 160);
  if (!query) return reply(request, 400, { error: "Entrez un ISBN ou un titre." });
  const looksLikeBarcode = /^[\d\s-]{9,17}$/.test(query) || /^\d{9}[\dXx]$/.test(query.replace(/[-\s]/g, ""));
  const isbn = normalizeIsbn(query);
  if (looksLikeBarcode && !isbn) return reply(request, 400, { error: "ISBN invalide. Vérifiez le code-barres du livre." });
  if (!isbn) {
    const [googleResult, openLibraryResult] = await Promise.allSettled([googleByTitle(query), openLibraryByTitle(query)]);
    const results = uniqueResults([...(googleResult.status === "fulfilled" ? googleResult.value : []), ...(openLibraryResult.status === "fulfilled" ? openLibraryResult.value : [])]);
    return results.length ? reply(request, 200, { results, source: "catalogues", sources: ["Google Books", "Open Library"] }) : reply(request, 404, { error: "Aucun livre trouvé. Essayez l'ISBN ou envoyez deux photos." });
  }
  // Ne sélectionner que les colonnes présentes dans le schéma de production.
  // Les catalogues externes peuvent toutefois continuer à fournir nb_pages
  // dans leurs métadonnées : le front filtre ces champs avant insertion.
  const { data: localBook } = await admin.from("bibli_livres").select("isbn, titre, auteur, editeur, couverture_url, annee, resume, langue, categorie").eq("isbn", isbn).maybeSingle();
  if (localBook) return reply(request, 200, { book: localBook, source: "catalogue" });
  const { data: cached } = await admin.from("bibli_book_lookup_cache").select("metadata, sources, found, failure_reason").eq("isbn", isbn).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (cached?.found && cached.metadata) return reply(request, 200, { book: cached.metadata, source: "cache", sources: cached.sources });
  if (cached && !cached.found) return reply(request, 404, { error: cached.failure_reason || "Aucun livre trouvé. Envoyez deux photos pour l'identifier plus tard." });
  const [googleResult, openLibraryResult, bnfResult] = await Promise.allSettled([googleByIsbn(isbn), openLibraryByIsbn(isbn), bnfByIsbn(isbn)]);
  const google = googleResult.status === "fulfilled" ? googleResult.value : null;
  const openLibrary = openLibraryResult.status === "fulfilled" ? openLibraryResult.value : null;
  const bnf = bnfResult.status === "fulfilled" ? bnfResult.value : null;
  const book = merge(isbn, google, openLibrary, bnf);
  const sources = [google && "Google Books", openLibrary && "Open Library", bnf && "BnF"].filter(Boolean);
  const now = new Date().toISOString();
  if (!book) {
    await admin.from("bibli_book_lookup_cache").upsert({ isbn, metadata: null, sources: [], found: false, failure_reason: "Aucun résultat dans Google Books, Open Library ou BnF.", last_checked_at: now, expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), updated_at: now });
    return reply(request, 404, { error: "Aucun livre trouvé. Envoyez deux photos pour qu'il soit identifié plus tard." });
  }
  await admin.from("bibli_book_lookup_cache").upsert({ isbn, metadata: book, sources, found: true, failure_reason: null, last_checked_at: now, expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(), updated_at: now });
  return reply(request, 200, { book, source: "catalogues", sources });
});
