import { supabase } from "./supabase";

/**
 * Envoie un email via la Supabase Edge Function "send-email".
 * Si la fonction n'est pas déployée, ouvre un lien mailto: en fallback.
 *
 * @returns {{ ok: boolean, method: "edge_function" | "mailto" | "no_email" }}
 */
export async function sendEmail({ to, subject, text }) {
  if (!to) return { ok: false, method: "no_email" };

  try {
    const { error } = await supabase.functions.invoke("send-email", {
      body: { to, subject, text },
    });
    if (error) throw error;
    return { ok: true, method: "edge_function" };
  } catch {
    // Fallback : ouvre le client mail natif
    const sub = encodeURIComponent(subject || "");
    const body = encodeURIComponent(text || "");
    window.open(`mailto:${to}?subject=${sub}&body=${body}`);
    return { ok: false, method: "mailto" };
  }
}

/** Construit le message de confirmation de prêt */
export function buildLoanConfirmationEmail({
  prenom,
  nom,
  titre,
  datePret,
  dateRetour,
}) {
  const dueDateStr = dateRetour
    ? new Date(dateRetour).toLocaleDateString("fr-FR")
    : "—";
  const pretDateStr = datePret
    ? new Date(datePret).toLocaleDateString("fr-FR")
    : "—";
  return {
    subject: `Confirmation de prêt : ${titre}`,
    text: `Bonjour ${prenom} ${nom},

Votre emprunt a bien été enregistré.

📚 Livre    : ${titre}
📅 Date du prêt : ${pretDateStr}
🔔 Retour prévu : ${dueDateStr}

Merci de retourner le livre avant cette date.

Cordialement,
La Bibliothèque ESI`,
  };
}

/** Construit le message de rappel de retour */
export function buildReminderEmail({ prenom, nom, titre, dateRetour }) {
  const dueDateStr = dateRetour
    ? new Date(dateRetour).toLocaleDateString("fr-FR")
    : "—";
  const isOverdue = dateRetour && new Date(dateRetour) < new Date();
  if (isOverdue) {
    return {
      subject: `Retard de retour : ${titre}`,
      text: `Bonjour ${prenom} ${nom},

Nous vous informons que le livre "${titre}" aurait dû être retourné le ${dueDateStr}.

Merci de le retourner dès que possible.

Cordialement,
La Bibliothèque ESI`,
    };
  }
  return {
    subject: `Rappel de retour : ${titre}`,
    text: `Bonjour ${prenom} ${nom},

Nous vous rappelons que le livre "${titre}" doit être retourné le ${dueDateStr}.

Merci de le retourner à temps.

Cordialement,
La Bibliothèque ESI`,
  };
}
