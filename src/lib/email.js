import { supabase } from "./supabase";

export function normalizeNotificationRecipient(value) {
  const recipient = String(value || "").trim().toLowerCase();
  return /^\d+$/.test(recipient) ? `${recipient}@etu.he2b.be` : recipient;
}

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

  let joursRetard = 0;
  if (templateType === "reminder" && dateRetour) {
    const diff = Date.now() - new Date(dateRetour).getTime();
    joursRetard = Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }

  const { data, error } = await supabase.functions.invoke("send-email", {
    body: {
      to,
      subject: subject ?? "",
      text: text ?? "",
      templateType,
      // Ces informations restent utiles aux futurs fournisseurs, mais le
      // serveur ne laisse jamais l'adresse ou le contenu être envoyés sans
      // session et permission de notification.
      toName,
      titre,
      dateRetour,
      joursRetard,
    },
  });
  if (error || !data?.ok)
    throw new Error(data?.error || error?.message || "Impossible d'envoyer l'e-mail.");

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
