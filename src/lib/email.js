import emailjs from "@emailjs/browser";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const TEMPLATE_REMINDER_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_REMINDER_ID;
const TEMPLATE_EXPIRY_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_EXPIRY_ID;
const TEMPLATE_CUSTOM_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_CUSTOM_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

/**
 * Résout le template EmailJS à utiliser selon le type d'email.
 * - "confirmation" → TEMPLATE_ID (confirmation de prêt, envoi auto)
 * - "reminder"     → TEMPLATE_REMINDER_ID (livre en retard)
 * - "expiry"       → TEMPLATE_EXPIRY_ID (livre bientôt dû, veille J-1 etc.)
 *                    fallback → TEMPLATE_REMINDER_ID si non configuré
 * - "custom"       → TEMPLATE_CUSTOM_ID (message libre admin)
 *                    fallback → TEMPLATE_ID si non configuré
 */
function resolveTemplateId(templateType) {
  switch (templateType) {
    case "confirmation": return TEMPLATE_ID;
    case "reminder":     return TEMPLATE_REMINDER_ID || TEMPLATE_ID;
    case "expiry":       return TEMPLATE_EXPIRY_ID || TEMPLATE_REMINDER_ID || TEMPLATE_ID;
    case "custom":       return TEMPLATE_CUSTOM_ID || TEMPLATE_ID;
    default:             return TEMPLATE_ID;
  }
}

/**
 * Envoie un email via EmailJS.
 * Variables envoyées : to_email, to_name, subject, message, titre, date_retour, jours_retard
 * @param {object} opts
 * @param {string} opts.templateType - "confirmation" | "reminder" | "expiry" | "custom"
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

  const templateId = resolveTemplateId(templateType);
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

/** Construit les données pour un rappel de retour ou une notification de retard */
export function buildReminderEmail({ prenom, nom, titre, dateRetour }) {
  const dueDateStr = dateRetour ? new Date(dateRetour).toLocaleDateString("fr-FR") : "—";
  const isOverdue = !!(dateRetour && new Date(dateRetour) < new Date());
  if (isOverdue) {
    return {
      subject: `⚠️ Retard de retour : ${titre}`,
      text: `Bonjour ${prenom} ${nom},\n\nLe livre "${titre}" aurait dû être retourné le ${dueDateStr}.\n\nMerci de le retourner dès que possible.\n\nCordialement,\nLa Bibliothèque ESI`,
      titre,
      dateRetour,
      templateType: "reminder",
    };
  }
  return {
    subject: `📅 Rappel de retour : ${titre}`,
    text: `Bonjour ${prenom} ${nom},\n\nLe livre "${titre}" doit être retourné le ${dueDateStr}.\n\nMerci de le retourner à temps.\n\nCordialement,\nLa Bibliothèque ESI`,
    titre,
    dateRetour,
    templateType: "expiry",
  };
}
