const intervalMs = 15 * 60 * 1000;

const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VITE_EMAILJS_SERVICE_ID",
  "VITE_EMAILJS_TEMPLATE_REMINDER_ID",
  "VITE_EMAILJS_PUBLIC_KEY",
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date, amount) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function daysLate(date) {
  return Math.max(1, Math.floor((Date.now() - new Date(`${date}T00:00:00Z`).getTime()) / 86400000));
}

function dateFr(date) {
  return date ? new Date(`${date}T00:00:00Z`).toLocaleDateString("fr-FR") : "—";
}

function config() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Configuration manquante: ${missing.join(", ")}`);
  return {
    url: process.env.SUPABASE_URL.replace(/\/$/, ""),
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

async function api(path, options = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

async function setting(key) {
  const rows = await api(`bibli_settings?select=value&key=eq.${encodeURIComponent(key)}&limit=1`);
  return rows?.[0]?.value;
}

async function sendEmail(loan, overdue) {
  const student = loan.bibli_etudiants || {};
  const book = loan.bibli_livres || {};
  const title = book.titre || "Livre emprunté";
  const name = `${student.prenom || ""} ${student.nom || ""}`.trim() || "Étudiant";
  const subject = overdue ? `⚠️ Retard de retour : ${title}` : `Rappel de retour : ${title}`;
  const message = overdue
    ? `Bonjour ${name},\n\nLe livre « ${title} » aurait dû être retourné le ${dateFr(loan.date_retour_prevue)}.\n\nMerci de le retourner dès que possible.\n\nLa Bibliothèque ESI`
    : `Bonjour ${name},\n\nLe retour du livre « ${title} » est prévu le ${dateFr(loan.date_retour_prevue)}.\n\nMerci de penser à le rapporter à temps.\n\nLa Bibliothèque ESI`;
  const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: process.env.VITE_EMAILJS_SERVICE_ID,
      template_id: process.env.VITE_EMAILJS_TEMPLATE_REMINDER_ID,
      user_id: process.env.VITE_EMAILJS_PUBLIC_KEY,
      template_params: {
        to_email: student.email,
        to_name: name,
        subject,
        message,
        titre: title,
        date_retour: dateFr(loan.date_retour_prevue),
        jours_retard: String(overdue ? daysLate(loan.date_retour_prevue) : 0),
      },
    }),
  });
  if (!response.ok) throw new Error(`EmailJS ${response.status}: ${await response.text()}`);
}

async function alreadySent(loanId, kind, date) {
  const rows = await api(`bibli_notification_logs?select=id&pret_id=eq.${loanId}&kind=eq.${kind}&scheduled_for=eq.${date}&limit=1`);
  return rows.length > 0;
}

async function markSent(loanId, kind, date, email) {
  await api("bibli_notification_logs", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({ pret_id: loanId, kind, scheduled_for: date, recipient_email: email, sent_at: new Date().toISOString() }),
  });
}

async function logActivity(loan, kind, email) {
  const title = loan.bibli_livres?.titre || "Livre emprunté";
  await api("bibli_activity_logs", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      action_type: "notification_envoyee",
      description: `Rappel automatique envoyé pour « ${title} » (${kind}) (Destinataire: ${email})`,
      user_info: "worker automatique",
    }),
  });
}

async function run() {
  const now = today();
  const enabled = (await setting("send_reminder_emails")) === "true";
  if (!enabled) return console.log(`[reminders] désactivés (${now})`);
  const before = Math.min(30, Math.max(1, Number.parseInt(await setting("reminder_days_before"), 10) || 3));
  const dueToday = (await setting("remind_on_due_date")) === "true";
  const overdueEnabled = (await setting("notify_overdue")) !== "false";
  const loans = await api("bibli_prets?select=id,date_retour_prevue,etudiant_id,bibli_livres(titre),bibli_etudiants(nom,prenom,email)&rendu=eq.false&date_retour_prevue=not.is.null&order=date_retour_prevue.asc");
  for (const loan of loans) {
    const email = loan.bibli_etudiants?.email;
    if (!email) continue;
    const due = loan.date_retour_prevue;
    const reminderDate = addDays(due, -before);
    const candidate = due < now && overdueEnabled ? ["overdue", true] : due === now && dueToday ? ["due_today", false] : due === reminderDate ? ["before_due", false] : null;
    if (!candidate || await alreadySent(loan.id, candidate[0], now)) continue;
    await sendEmail(loan, candidate[1]);
    await markSent(loan.id, candidate[0], now, email);
    await logActivity(loan, candidate[0], email);
    console.log(`[reminders] envoyé ${candidate[0]} pour ${loan.id}`);
  }
}

async function loop() {
  try { await run(); } catch (error) { console.error("[reminders] échec", error.message); }
  setTimeout(loop, intervalMs);
}

loop();
