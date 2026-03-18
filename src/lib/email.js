import emailjs from "@emailjs/browser";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const TEMPLATE_REMINDER_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_REMINDER_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

/**
 * Envoie un email via EmailJS.
 * Si isOverdue=true et VITE_EMAILJS_TEMPLATE_REMINDER_ID défini, utilise le template retard stylé.
 * Variables envoyées : to_email, to_name, subject, message, titre, date_retour, jours_retard
 */
export async function sendEmail({
  to,
  subject,
  text,
  toName = "",
  titre = "",
  dateRetour = "",
  isOverdue = false,
}) {
  if (!to) throw new Error("Adresse email manquante.");
  if (!SERVICE_ID || !PUBLIC_KEY)
    throw new Error("EmailJS non configuré. Renseignez VITE_EMAILJS_SERVICE_ID et VITE_EMAILJS_PUBLIC_KEY dans .env.");

  let joursRetard = 0;
  if (isOverdue && dateRetour) {
    const diff = Date.now() - new Date(dateRetour).getTime();
    joursRetard = Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }

  const templateId = isOverdue && TEMPLATE_REMINDER_ID ? TEMPLATE_REMINDER_ID : TEMPLATE_ID;
  if (!templateId)
    throw new Error("VITE_EMAILJS_TEMPLATE_ID manquant dans .env.");

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

/** Construit le message de confirmation de prêt */
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
    isOverdue: false,
  };
}

/** Construit le message de rappel/retard de retour */
export function buildReminderEmail({ prenom, nom, titre, dateRetour }) {
  const dueDateStr = dateRetour ? new Date(dateRetour).toLocaleDateString("fr-FR") : "—";
  const isOverdue = !!(dateRetour && new Date(dateRetour) < new Date());
  if (isOverdue) {
    return {
      subject: `⚠️ Retard de retour : ${titre}`,
      text: `Bonjour ${prenom} ${nom},\n\nLe livre "${titre}" aurait dû être retourné le ${dueDateStr}.\n\nMerci de le retourner dès que possible.\n\nCordialement,\nLa Bibliothèque ESI`,
      titre,
      dateRetour,
      isOverdue: true,
    };
  }
  return {
    subject: `📚 Rappel de retour : ${titre}`,
    text: `Bonjour ${prenom} ${nom},\n\nLe livre "${titre}" doit être retourné le ${dueDateStr}.\n\nMerci de le retourner à temps.\n\nCordialement,\nLa Bibliothèque ESI`,
    titre,
    dateRetour,
    isOverdue: false,
  };
}
