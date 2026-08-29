import { z } from "zod";

const optionalTrimmed = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().nullable().optional(),
);

const isbnSchema = optionalTrimmed.refine(
  (value) => !value || /^(?:\d{9}[\dXx]|\d{13})$/.test(value.replace(/[-\s]/g, "")),
  "ISBN invalide.",
);

export const bookSchema = z.object({
  titre: z.string().trim().min(1, "Le titre est obligatoire.").max(220, "Titre trop long."),
  sous_titre: optionalTrimmed,
  auteur: optionalTrimmed,
  isbn: isbnSchema.transform((value) => value ? value.replace(/[-\s]/g, "").toUpperCase() : null),
  editeur: optionalTrimmed,
  annee: optionalTrimmed.refine(
    (value) => !value || /^\d{4}$/.test(value),
    "L'année doit contenir 4 chiffres.",
  ),
  langue: optionalTrimmed,
  categorie: optionalTrimmed,
  tags: z.array(z.string().trim().min(1)).default([]),
  emplacement: optionalTrimmed,
  nb_exemplaires: z.coerce.number().int().min(1, "Minimum 1 exemplaire.").max(500, "Nombre trop élevé."),
  statut: z.enum(["disponible", "emprunte", "reserve", "perdu", "en_reparation"]).default("disponible"),
  couverture_url: optionalTrimmed.refine(
    (value) => !value || /^https?:\/\//i.test(value),
    "L'URL de couverture doit commencer par http:// ou https://.",
  ),
  resume: optionalTrimmed,
  description: optionalTrimmed,
});

export const externalBookSchema = bookSchema
  .partial()
  .extend({
    titre: z.string().trim().min(1, "Le titre est obligatoire.").max(220, "Titre trop long."),
  })
  .transform((book) => ({
    ...book,
    nb_exemplaires: book.nb_exemplaires || 1,
    statut: book.statut || "disponible",
  }));

export const studentSchema = z.object({
  nom: z.string().trim().min(1, "Le nom est obligatoire.").max(120, "Nom trop long."),
  prenom: z.string().trim().min(1, "Le prénom est obligatoire.").max(120, "Prénom trop long."),
  numero_etudiant: z.string().trim().regex(/^\d{4,12}$/, "Le matricule doit contenir uniquement des chiffres."),
  notes_admin: optionalTrimmed,
  champs_custom: z.any().optional(),
}).transform((student) => ({
  ...student,
  email: `${student.numero_etudiant}@etu.he2b.be`,
}));

export const loanSchema = z.object({
  livre_id: z.string().min(1, "Choisissez un livre."),
  etudiant_id: z.string().min(1, "Choisissez un étudiant."),
  date_pret: z.string().min(1, "La date de prêt est obligatoire."),
  date_retour_prevue: optionalTrimmed,
  date_rappel: optionalTrimmed,
  notes: optionalTrimmed,
}).refine(
  (loan) => !loan.date_retour_prevue || loan.date_retour_prevue >= loan.date_pret,
  { path: ["date_retour_prevue"], message: "La date de retour doit être après la date de prêt." },
).refine(
  (loan) => !loan.date_rappel || !loan.date_retour_prevue || loan.date_rappel <= loan.date_retour_prevue,
  { path: ["date_rappel"], message: "La date de rappel ne peut pas être après le retour." },
);

export function parseOrMessage(schema, value) {
  const result = schema.safeParse(value);
  if (result.success) return { data: result.data, error: "" };
  return {
    data: null,
    error: result.error.issues.map((issue) => issue.message).join(" "),
  };
}
