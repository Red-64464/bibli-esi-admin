/**
 * Liste officielle des catégories de la bibliothèque ESI.
 * Toujours utiliser ces valeurs pour stocker en base.
 */
export const CATEGORIES = [
  "Algorithmique",
  "Architecture des ordinateurs",
  "Bases de données",
  "Développement Web",
  "Électronique",
  "Génie logiciel",
  "Informatique générale",
  "Intelligence artificielle",
  "Mathématiques",
  "Physique",
  "Programmation",
  "Réseaux & Télécoms",
  "Sécurité informatique",
  "Systèmes d'exploitation",
  "Économie & Gestion",
  "Langue & Communication",
  "Littérature",
  "Sciences",
  "Technologie & Ingénierie",
  "Autre",
];

/**
 * Convertit une catégorie brute (souvent en anglais, issue de Google Books
 * ou d'un import CSV) vers la catégorie française normalisée la plus proche.
 * Retourne une chaîne vide si raw est vide (l'admin choisira manuellement).
 */
export const normalizeCategory = (raw) => {
  if (!raw || !raw.trim()) return "";
  const lower = raw.toLowerCase();

  if (
    lower.includes("network") ||
    lower.includes("réseau") ||
    lower.includes("reseaux") ||
    lower.includes("telecom") ||
    lower.includes("télécommunication") ||
    lower.includes("telecommunication")
  )
    return "Réseaux & Télécoms";

  if (
    lower.includes("algorithm") ||
    lower.includes("algorithmique") ||
    lower.includes("data structure") ||
    lower.includes("structure de données") ||
    lower.includes("structure donnée")
  )
    return "Algorithmique";

  if (
    lower.includes("database") ||
    lower.includes("base de données") ||
    lower.includes("bases de données") ||
    lower.includes("base donnée") ||
    lower.includes(" sql") ||
    lower === "sql" ||
    lower.includes("nosql")
  )
    return "Bases de données";

  if (
    lower.includes("security") ||
    lower.includes("sécurité") ||
    lower.includes("securite") ||
    lower.includes("cryptograph") ||
    lower.includes("cybersecurity") ||
    lower.includes("cybersécurité")
  )
    return "Sécurité informatique";

  if (
    lower.includes("operating system") ||
    lower.includes("système d'exploitation") ||
    lower.includes("systemes d'exploitation") ||
    lower.includes("linux") ||
    lower.includes("unix")
  )
    return "Systèmes d'exploitation";

  if (
    lower.includes("artificial intelligence") ||
    lower.includes("intelligence artificielle") ||
    lower.includes("machine learning") ||
    lower.includes("apprentissage automatique") ||
    lower.includes("deep learning") ||
    lower.includes("neural network") ||
    lower.includes("réseau de neurone")
  )
    return "Intelligence artificielle";

  if (
    lower.includes("web") ||
    lower.includes("html") ||
    lower.includes("css") ||
    lower.includes("javascript") ||
    lower.includes("internet application") ||
    lower.includes("application web")
  )
    return "Développement Web";

  if (
    lower.includes("software engineering") ||
    lower.includes("génie logiciel") ||
    lower.includes("genie logiciel") ||
    lower.includes("software development") ||
    lower.includes("développement logiciel")
  )
    return "Génie logiciel";

  if (
    lower.includes("computer architecture") ||
    lower.includes("architecture des ordinateurs") ||
    lower.includes("architecture ordinateur") ||
    lower.includes("microprocessor") ||
    lower.includes("microprocesseur") ||
    lower.includes("embedded system") ||
    lower.includes("système embarqué")
  )
    return "Architecture des ordinateurs";

  if (
    lower.includes("programming") ||
    lower.includes("programmation") ||
    lower.includes("coding") ||
    lower.includes("langage de programmation") ||
    lower.includes("programming language")
  )
    return "Programmation";

  if (
    lower.includes("electronic") ||
    lower.includes("électronique") ||
    lower.includes("electronique") ||
    lower.includes("circuit") ||
    lower.includes("signal processing") ||
    lower.includes("traitement du signal")
  )
    return "Électronique";

  if (
    lower.includes("mathemat") ||
    lower.includes("mathématique") ||
    lower.includes("mathematique") ||
    lower.includes("algebra") ||
    lower.includes("algèbre") ||
    lower.includes("calculus") ||
    lower.includes("analyse mathématique") ||
    lower.includes("statistic") ||
    lower.includes("statistique") ||
    lower.includes("probabilit")
  )
    return "Mathématiques";

  if (
    lower.includes("physic") ||
    lower.includes("physique") ||
    lower.includes("mechanic") ||
    lower.includes("quantum") ||
    lower.includes("thermodynamic")
  )
    return "Physique";

  if (
    lower.includes("econom") ||
    lower.includes("business") ||
    lower.includes("management") ||
    lower.includes("finance") ||
    lower.includes("gestion") ||
    lower.includes("comptabilit")
  )
    return "Économie & Gestion";

  if (
    lower.includes("language arts") ||
    lower.includes("linguist") ||
    lower.includes("langue et communication") ||
    lower.includes("communication") ||
    lower.includes("expression écrite") ||
    lower.includes("writing")
  )
    return "Langue & Communication";

  if (
    lower.includes("fiction") ||
    lower.includes("novel") ||
    lower.includes("literary") ||
    lower.includes("literature") ||
    lower.includes("littérature") ||
    lower.includes("roman") ||
    lower.includes("poésie") ||
    lower.includes("poesie")
  )
    return "Littérature";

  if (lower.includes("computer") || lower.includes("informatique"))
    return "Informatique générale";

  if (
    lower.includes("technolog") ||
    lower.includes("engineering") ||
    lower.includes("ingénierie") ||
    lower.includes("ingenierie")
  )
    return "Technologie & Ingénierie";

  if (lower.includes("science")) return "Sciences";

  return "Autre";
};
