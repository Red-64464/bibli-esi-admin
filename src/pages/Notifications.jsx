import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { getSettings, saveSettings } from "../lib/settings";
import {
  Bell,
  Mail,
  Clock,
  AlertTriangle,
  Save,
  Loader2,
  CheckCircle,
  Info,
  CalendarCheck,
  RefreshCw,
  Send,
  CalendarClock,
  ClipboardCheck,
} from "lucide-react";

const INPUT_CLASS =
  "bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent w-full text-sm";

function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-white/5 last:border-0">
      <div>
        <p className="text-sm font-medium text-biblio-text">{label}</p>
        {description && (
          <p className="text-xs text-biblio-muted mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-biblio-accent focus:ring-offset-2 focus:ring-offset-biblio-bg ${
          checked ? "bg-biblio-accent" : "bg-white/20"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

export default function Notifications() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Rappels du jour (date_rappel = today)
  const [todayReminders, setTodayReminders] = useState([]);
  const [todayLoading, setTodayLoading] = useState(false);

  // Prêts bientôt dus / en retard pour la prévisualisation
  const [previewLoans, setPreviewLoans] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Feedback de copie presse-papiers
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const s = await getSettings();
      setSettings(s);
      await Promise.all([
        loadTodayReminders(),
        loadPreview(parseInt(s.reminder_days_before, 10) || 3),
      ]);
    } catch (err) {
      setError("Impossible de charger les paramètres : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadTodayReminders = async () => {
    try {
      setTodayLoading(true);
      const todayStr = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("prets")
        .select("*, livres(titre), etudiants(nom, prenom, email)")
        .eq("rendu", false)
        .eq("date_rappel", todayStr)
        .order("date_retour_prevue", { ascending: true });
      setTodayReminders(data || []);
    } catch {
      /* silently ignore if date_rappel column doesn't exist */
    } finally {
      setTodayLoading(false);
    }
  };

  const loadPreview = async (daysBefore) => {
    try {
      setPreviewLoading(true);
      const today = new Date();
      const futureDate = new Date(
        today.getTime() + daysBefore * 24 * 60 * 60 * 1000,
      );
      const futureDateStr = futureDate.toISOString().slice(0, 10);
      const todayStr = today.toISOString().slice(0, 10);

      // Prêts dans la fenêtre de rappel (bientôt dus)
      const { data: upcoming } = await supabase
        .from("prets")
        .select("*, livres(titre), etudiants(nom, prenom, email)")
        .eq("rendu", false)
        .gte("date_retour_prevue", todayStr)
        .lte("date_retour_prevue", futureDateStr)
        .order("date_retour_prevue", { ascending: true });

      // Prêts en retard
      const { data: overdue } = await supabase
        .from("prets")
        .select("*, livres(titre), etudiants(nom, prenom, email)")
        .eq("rendu", false)
        .lt("date_retour_prevue", todayStr)
        .order("date_retour_prevue", { ascending: true });

      setPreviewLoans([
        ...(upcoming || []).map((p) => ({ ...p, _type: "upcoming" })),
        ...(overdue || []).map((p) => ({ ...p, _type: "overdue" })),
      ]);
    } catch {
      /* silently ignore */
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      await saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await loadPreview(parseInt(settings.reminder_days_before, 10) || 3);
    } catch (err) {
      setError("Erreur lors de la sauvegarde : " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const buildReminderMessage = (loan) => {
    const student = loan.etudiants;
    const book = loan.livres;
    const dueDate = loan.date_retour_prevue
      ? new Date(loan.date_retour_prevue).toLocaleDateString("fr-FR")
      : "—";
    return `Bonjour ${student?.prenom || ""} ${student?.nom || ""},\n\nNous vous rappelons que le livre "${book?.titre || "—"}" devait être retourné le ${dueDate}.\n\nMerci de le retourner dès que possible.\n\nCordialement,\nLa Bibliothèque ESI`;
  };

  const sendManualReminder = async (loan) => {
    const message = buildReminderMessage(loan);
    const email = loan.etudiants?.email;
    const title = loan.livres?.titre || "livre";

    try {
      await navigator.clipboard.writeText(message);
      setCopiedId(loan.id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      /* clipboard not available, fall through to mailto */
    }

    if (email) {
      const subject = encodeURIComponent(`Rappel de retour : ${title}`);
      const body = encodeURIComponent(message);
      window.open(`mailto:${email}?subject=${subject}&body=${body}`);
    }
  };

  const set = (key, value) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-biblio-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
          <Bell className="w-7 h-7 text-biblio-accent" />
          Notifications
        </h1>
        <p className="text-biblio-muted mt-1 text-sm">
          Configurez les rappels automatiques pour les prêts.
        </p>
      </div>

      {error && (
        <div className="bg-biblio-danger/10 text-biblio-danger p-4 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Rappels du jour */}
      <div className="bg-biblio-card rounded-xl border border-white/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-biblio-accent" />
            Rappels du jour
            {todayReminders.length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-biblio-accent/20 text-biblio-accent text-xs rounded-full font-semibold">
                {todayReminders.length}
              </span>
            )}
          </h2>
          <button
            onClick={loadTodayReminders}
            className="text-biblio-muted hover:text-biblio-text transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {todayLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-biblio-accent" />
          </div>
        ) : todayReminders.length === 0 ? (
          <p className="text-center text-biblio-muted text-sm py-4">
            Aucun rappel programmé pour aujourd'hui.
          </p>
        ) : (
          <div className="space-y-2">
            {todayReminders.map((loan) => (
              <div
                key={loan.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-biblio-accent/10"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-biblio-text truncate">
                    {loan.livres?.titre || "—"}
                  </p>
                  <p className="text-xs text-biblio-muted">
                    {loan.etudiants
                      ? `${loan.etudiants.prenom} ${loan.etudiants.nom}`
                      : "—"}
                    {loan.etudiants?.email ? ` · ${loan.etudiants.email}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => sendManualReminder(loan)}
                  title="Envoyer un rappel manuel"
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-biblio-accent/20 hover:bg-biblio-accent/40 text-biblio-accent text-xs font-medium rounded-lg transition-colors"
                >
                  {copiedId === loan.id ? (
                    <>
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      Copié !
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Rappel
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bloc : Email général */}
      <div className="bg-biblio-card rounded-xl border border-white/10 p-5 space-y-2">
        <h2 className="text-base font-semibold flex items-center gap-2 mb-4">
          <Mail className="w-4 h-4 text-biblio-accent" />
          Configuration email
        </h2>

        <Toggle
          checked={settings.send_reminder_emails === "true"}
          onChange={(v) => set("send_reminder_emails", String(v))}
          label="Activer les emails automatiques"
          description="Envoyer des emails de rappel aux étudiants via Supabase Edge Function."
        />

        {settings.send_reminder_emails === "true" && (
          <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
            <div>
              <label className="text-xs font-medium text-biblio-muted block mb-1">
                Email expéditeur de la bibliothèque
              </label>
              <input
                type="email"
                value={settings.library_email}
                onChange={(e) => set("library_email", e.target.value)}
                placeholder="bibliotheque@esi.dz"
                className={INPUT_CLASS}
              />
            </div>

            {/* Note sur l'Edge Function */}
            <div className="mt-2 p-3 bg-biblio-accent/10 border border-biblio-accent/20 rounded-lg flex items-start gap-2">
              <Info className="w-4 h-4 text-biblio-accent shrink-0 mt-0.5" />
              <p className="text-xs text-biblio-muted">
                L'envoi d'emails nécessite une{" "}
                <strong className="text-biblio-text">
                  Supabase Edge Function
                </strong>{" "}
                configurée avec Resend ou SendGrid. Voir{" "}
                <code className="text-biblio-accent">
                  supabase/functions/send-email/
                </code>
                .
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bloc : Rappels */}
      <div className="bg-biblio-card rounded-xl border border-white/10 p-5">
        <h2 className="text-base font-semibold flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-biblio-accent" />
          Paramètres de rappel
        </h2>

        <Toggle
          checked={settings.notify_overdue === "true"}
          onChange={(v) => set("notify_overdue", String(v))}
          label="Notification de retard"
          description="Notifier quand un livre n'est pas retourné à la date prévue."
        />

        <Toggle
          checked={settings.remind_on_due_date === "true"}
          onChange={(v) => set("remind_on_due_date", String(v))}
          label="Rappel le jour du retour"
          description="Envoyer un rappel le jour exact de la date de retour prévue."
        />

        <div className="mt-4 pt-4 border-t border-white/5">
          <label className="text-xs font-medium text-biblio-muted block mb-1">
            Rappel avant retour (nombre de jours)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="1"
              max="30"
              value={settings.reminder_days_before}
              onChange={(e) => set("reminder_days_before", e.target.value)}
              className={INPUT_CLASS + " max-w-[120px]"}
            />
            <span className="text-sm text-biblio-muted">
              jours avant la date de retour
            </span>
          </div>
        </div>
      </div>

      {/* Bouton de sauvegarde */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-biblio-accent hover:bg-biblio-accent-hover text-white rounded-lg font-medium transition-colors disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Enregistrer
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-biblio-success">
            <CheckCircle className="w-4 h-4" />
            Paramètres enregistrés
          </span>
        )}
      </div>

      {/* Aperçu des prêts concernés */}
      <div className="bg-biblio-card rounded-xl border border-white/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-biblio-accent" />
            Prêts concernés ({previewLoans.length})
          </h2>
          <button
            onClick={() =>
              loadPreview(parseInt(settings.reminder_days_before, 10) || 3)
            }
            className="text-biblio-muted hover:text-biblio-text transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {previewLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-biblio-accent" />
          </div>
        ) : previewLoans.length === 0 ? (
          <p className="text-center text-biblio-muted text-sm py-4">
            Aucun prêt ne nécessite de rappel pour l'instant.
          </p>
        ) : (
          <div className="space-y-2">
            {previewLoans.map((p) => (
              <div
                key={p.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  p._type === "overdue"
                    ? "bg-biblio-danger/10"
                    : "bg-biblio-warning/10"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-biblio-text truncate">
                    {p.livres?.titre || "—"}
                  </p>
                  <p className="text-xs text-biblio-muted">
                    {p.etudiants
                      ? `${p.etudiants.prenom} ${p.etudiants.nom}`
                      : "—"}
                    {p.etudiants?.email ? ` · ${p.etudiants.email}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <button
                    type="button"
                    onClick={() => sendManualReminder(p)}
                    title="Envoyer un rappel manuel"
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                      p._type === "overdue"
                        ? "bg-biblio-danger/20 hover:bg-biblio-danger/40 text-biblio-danger"
                        : "bg-biblio-warning/20 hover:bg-biblio-warning/40 text-biblio-warning"
                    }`}
                  >
                    {copiedId === p.id ? (
                      <>
                        <ClipboardCheck className="w-3 h-3" />
                        Copié !
                      </>
                    ) : (
                      <>
                        <Send className="w-3 h-3" />
                        Rappel
                      </>
                    )}
                  </button>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      p._type === "overdue"
                        ? "bg-biblio-danger/20 text-biblio-danger"
                        : "bg-biblio-warning/20 text-biblio-warning"
                    }`}
                  >
                    {p._type === "overdue"
                      ? "En retard"
                      : `Dû le ${new Date(p.date_retour_prevue).toLocaleDateString("fr-FR")}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Guide Edge Function */}
      <div className="bg-biblio-card rounded-xl border border-white/10 p-5">
        <h2 className="text-base font-semibold flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-biblio-accent" />
          Comment configurer l'envoi d'emails ?
        </h2>
        <ol className="text-sm text-biblio-muted space-y-2 list-decimal list-inside">
          <li>
            Créer une Edge Function Supabase :{" "}
            <code className="text-biblio-accent text-xs">
              supabase functions new send-reminders
            </code>
          </li>
          <li>Connecter à un service email (Resend, SendGrid, Mailgun).</li>
          <li>
            Configurer un <strong className="text-biblio-text">Cron Job</strong>{" "}
            dans Supabase (Dashboard → Edge Functions → Cron) pour exécuter la
            fonction chaque jour à minuit.
          </li>
          <li>
            La fonction lit les prêts en{" "}
            <code className="text-biblio-accent text-xs">prets</code> dont la{" "}
            <code className="text-biblio-accent text-xs">
              date_retour_prevue
            </code>{" "}
            correspond aux paramètres ci-dessus.
          </li>
        </ol>
      </div>
    </div>
  );
}
