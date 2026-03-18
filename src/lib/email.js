import emailjs from "@emailjs/browser";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const TEMPLATE_REMINDER_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_REMINDER_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

/**
 * Envoie un email via EmailJS.
 * - templateType "confirmation" → TEMPLATE_ID (envoi auto à la création d'un prêt)
 * - templateType "reminder"     → TEMPLATE_REMINDER_ID (livre en retard, envoi manuel)
 * Variables : to_email, to_name, subject, message, titre, date_retour, jours_retard
 */
export async function sendEmail({
  to,
  toName = "",
  subject,
  text,
  titre = "",
  dateRetour = "",
  templateType = "confirmation",
}) {
  if (!to) throw new Error("Adresse email manquante.");
  if (!SERVICE_ID || !PUBLIC_KEY)
    throw new Error("EmailJS non configuré. Renseignez VITE_EMAILJS_SERVICE_ID et VITE_EMAILJS_PUBLIC_KEY dans .env.");

  let joursRetard = 0;
  if (templateType === "reminder" && dateRetour) {
    const diff = Date.now() - new Date(dateRetour).getTime();
    joursRetard = Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }

  const templateId = templateType === "reminder"
    ? (TEMPLATE_REMINDER_ID || TEMPLATE_ID)
    : TEMPLATE_ID;
  if (!templateId)
    throw new Error("Template EmailJS manquant dans .env.");

  const result = await emailjs.send(
    SERVICE_ID,
    templateId,
    {
      to_email: to,
      to_name: toName,
      subject: subject ?? "",
      message: text ?? "",
      titre,
      date_retour: dateRetour ? new Date(dateRetour).toLocaleDateString("fr-FR") : "—",
      jours_retard: String(joursRetard),
    },
    PUBLIC_KEY,
  );

  if (result.status !== 200)
    throw new Error(`EmailJS erreur : ${result.text}`);

  return { ok: true };
}

/** Construit les données pour la confirmation de prêt (envoi automatique depuis Prêts) */
export function buildLoanConfirmationEmail({
  prenom,
  nom,
  titre,
  datePret,
  dateRetour,
}) {
  const dueDateStr = dateRetour ? new Date(dateRetour).toLocaleDateString("fr-FR") : "—";
  const pretDateStr = datePret ? new Date(datePret).toLocaleDateString("fr-FR") : "—";
  return {
    subject: `Confirmation de prêt : ${titre}`,
    text: `Bonjour ${prenom} ${nom},\n\nVotre emprunt a bien été enregistré.\n\nLivre : ${titre}\nDate du prêt : ${pretDateStr}\nRetour prévu : ${dueDateStr}\n\nMerci de retourner le livre avant cette date.\n\nCordialement,\nLa Bibliothèque ESI`,
    titre,
    dateRetour,
    templateType: "confirmation",
  };
}

/** Construit les données pour un email de retard (livre non rendu après la date prévue) */
export function buildReminderEmail({ prenom, nom, titre, dateRetour }) {
  const dueDateStr = dateRetour ? new Date(dateRetour).toLocaleDateString("fr-FR") : "—";
  return {
    subject: `⚠️ Retard de retour : ${titre}`,
    text: `Bonjour ${prenom} ${nom},\n\nLe livre "${titre}" aurait dû être retourné le ${dueDateStr}.\n\nMerci de le retourner dès que possible.\n\nCordialement,\nLa Bibliothèque ESI`,
    titre,
    dateRetour,
    templateType: "reminder",
  };
}
