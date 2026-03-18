import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { getSettings, saveSettings } from "../lib/settings";
import { sendEmail, buildReminderEmail } from "../lib/email";
import {
  Bell,
  Mail,
  Clock,
  AlertTriangle,
  Save,
  Loader2,
  CheckCircle,
  CalendarCheck,
  RefreshCw,
  Send,
  CalendarClock,
  PenLine,
  X,
  Search,
  User,
  BookOpen,
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

  // Composer un rappel manuel
  const [showComposer, setShowComposer] = useState(false);
  const [composerTab, setComposerTab] = useState("reminder"); // "reminder" | "custom"
  const [composerSearch, setComposerSearch] = useState("");
  const [composerStudents, setComposerStudents] = useState([]);
  const [composerStudent, setComposerStudent] = useState(null); // {id, nom, prenom, email}
  // Onglet « Rappel de prêt »
  const [composerLoans, setComposerLoans] = useState([]);
  const [composerLoansLoading, setComposerLoansLoading] = useState(false);
  const [sendingLoanId, setSendingLoanId] = useState(null);
  const [sentLoanId, setSentLoanId] = useState(null);
  // Onglet « Message personnalisé »
  const [customSubject, setCustomSubject] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [customSending, setCustomSending] = useState(false);
  const [customSent, setCustomSent] = useState(false);
  const [composerError, setComposerError] = useState("");
  // Test de template
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [testError, setTestError] = useState("");

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

  const sendManualReminder = async (loan) => {
    openComposer(loan);
  };

  // Recherche étudiants pour le composer
  useEffect(() => {
    if (!composerSearch.trim()) {
      setComposerStudents([]);
      return;
    }
    const q = composerSearch.toLowerCase();
    supabase
      .from("etudiants")
      .select("id, nom, prenom, email")
      .or(`nom.ilike.%${q}%,prenom.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(8)
      .then(({ data }) => setComposerStudents(data || []));
  }, [composerSearch]);

  // Charge les prêts actifs de l'étudiant sélectionné (onglet Rappel)
  useEffect(() => {
    if (!composerStudent || !showComposer) {
      setComposerLoans([]);
      return;
    }
    setComposerLoansLoading(true);
    supabase
      .from("prets")
      .select("*, livres(titre)")
      .eq("etudiant_id", composerStudent.id)
      .eq("rendu", false)
      .order("date_retour_prevue", { ascending: true })
      .then(({ data }) => {
        setComposerLoans(data || []);
        setComposerLoansLoading(false);
      });
  }, [composerStudent, showComposer]);

  const openComposer = (prefillLoan = null) => {
    setComposerTab("reminder");
    setComposerError("");
    setComposerSearch("");
    setComposerStudents([]);
    setSendingLoanId(null);
    setSentLoanId(null);
    setCustomSubject("");
    setCustomBody("");
    setCustomSent(false);
    if (prefillLoan) {
      const s = prefillLoan.etudiants;
      setComposerStudent({ id: prefillLoan.etudiant_id, ...s });
    } else {
      setComposerStudent(null);
      setComposerLoans([]);
    }
    setShowComposer(true);
  };

  const handleSendLoanReminder = async (loan) => {
    if (!composerStudent?.email) return;
    setSendingLoanId(loan.id);
    setComposerError("");
    try {
      const emailData = buildReminderEmail({
        prenom: composerStudent.prenom,
        nom: composerStudent.nom,
        titre: loan.livres?.titre || "",
        dateRetour: loan.date_retour_prevue,
      });
      await sendEmail({
        to: composerStudent.email,
        toName: `${composerStudent.prenom} ${composerStudent.nom}`,
        subject: emailData.subject,
        text: emailData.text,
        titre: emailData.titre,
        dateRetour: emailData.dateRetour,
        templateType: emailData.templateType,
      });
      setSentLoanId(loan.id);
      setTimeout(() => setSentLoanId(null), 3000);
    } catch (err) {
      setComposerError(err.message || "Erreur inconnue.");
    } finally {
      setSendingLoanId(null);
    }
  };

  const handleSendCustom = async () => {
    if (!composerStudent?.email || !customSubject.trim()) return;
    setCustomSending(true);
    setComposerError("");
    try {
      await sendEmail({
        to: composerStudent.email,
        toName: `${composerStudent.prenom} ${composerStudent.nom}`,
        subject: customSubject,
        text: customBody,
        templateType: "custom",
      });
      setCustomSent(true);
      setTimeout(() => {
        setShowComposer(false);
        setCustomSent(false);
        setCustomSubject("");
        setCustomBody("");
      }, 1500);
    } catch (err) {
      setComposerError(err.message || "Erreur inconnue.");
    } finally {
      setCustomSending(false);
    }
  };

  const handleTestReminder = async () => {
    if (!testEmail.trim()) return;
    setTestSending(true);
    setTestError("");
    setTestSent(false);
    try {
      await sendEmail({
        to: testEmail.trim(),
        toName: "Admin Test",
        subject: "⚠️ [TEST] Retard de retour : Harry Potter",
        text: "Ceci est un email de test de retard. Le livre aurait dû être retourné il y a 3 jours.",
        titre: "Harry Potter — test",
        dateRetour: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        templateType: "reminder",
      });
      setTestSent(true);
      setTimeout(() => setTestSent(false), 4000);
    } catch (err) {
      setTestError(err.message || "Erreur inconnue.");
      setTimeout(() => setTestError(""), 5000);
    } finally {
      setTestSending(false);
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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <Bell className="w-7 h-7 text-biblio-accent" />
            Notifications
          </h1>
          <p className="text-biblio-muted mt-1 text-sm">
            Configurez les rappels automatiques pour les prêts.
          </p>
        </div>
        <button
          onClick={() => openComposer()}
          className="flex items-center gap-2 px-4 py-2 bg-biblio-accent hover:bg-biblio-accent-hover text-white rounded-lg text-sm font-medium transition-colors shrink-0"
        >
          <PenLine className="w-4 h-4" />
          Nouveau rappel
        </button>
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
                  <Send className="w-3.5 h-3.5" />
                  Rappel
                </button>
              </div>
            ))}
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

        {/* Test des templates email */}
        <div className="mt-4 pt-4 border-t border-white/5">
          <label className="text-xs font-medium text-biblio-muted block mb-2">
            Tester le mail de retard
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="votre@email.com"
              className={INPUT_CLASS + " flex-1"}
            />
            <button
              onClick={handleTestReminder}
              disabled={testSending || !testEmail.trim()}
              className="shrink-0 flex items-center gap-2 px-4 py-2 bg-biblio-accent/20 hover:bg-biblio-accent/30 text-biblio-accent text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {testSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Tester
            </button>
          </div>
          {testSent && (
            <p className="text-xs text-biblio-success flex items-center gap-1.5 mt-2">
              <CheckCircle className="w-3.5 h-3.5" /> Email de test envoyé !
            </p>
          )}
          {testError && (
            <p className="text-xs text-biblio-danger flex items-center gap-1.5 mt-2">
              <AlertTriangle className="w-3.5 h-3.5" /> {testError}
            </p>
          )}
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
                    <Send className="w-3 h-3" />
                    Rappel
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



      {/* Composer modal */}
      {showComposer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-biblio-card rounded-2xl border border-white/10 w-full max-w-lg p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Mail className="w-4 h-4 text-biblio-accent" />
                Composer un rappel
              </h2>
              <button
                onClick={() => setShowComposer(false)}
                className="text-biblio-muted hover:text-biblio-text transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
              <button
                onClick={() => { setComposerTab("reminder"); setComposerError(""); }}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  composerTab === "reminder"
                    ? "bg-biblio-accent text-white"
                    : "text-biblio-muted hover:text-biblio-text"
                }`}
              >
                Rappel de prêt
              </button>
              <button
                onClick={() => { setComposerTab("custom"); setComposerError(""); }}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  composerTab === "custom"
                    ? "bg-biblio-accent text-white"
                    : "text-biblio-muted hover:text-biblio-text"
                }`}
              >
                Message personnalisé
              </button>
            </div>

            {/* Destinataire (partagé entre les onglets) */}
            <div>
              <label className="text-xs font-medium text-biblio-muted block mb-1">
                Destinataire
              </label>
              {composerStudent ? (
                <div className="flex items-center justify-between gap-2 bg-biblio-accent/10 border border-biblio-accent/20 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-biblio-accent shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-biblio-text">
                        {composerStudent.prenom} {composerStudent.nom}
                      </p>
                      <p className="text-xs text-biblio-muted">
                        {composerStudent.email || (
                          <span className="text-biblio-danger">Pas d'email</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setComposerStudent(null);
                      setComposerSearch("");
                      setComposerLoans([]);
                      setSentLoanId(null);
                    }}
                    className="text-biblio-muted hover:text-biblio-text"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-biblio-muted" />
                  <input
                    type="text"
                    value={composerSearch}
                    onChange={(e) => setComposerSearch(e.target.value)}
                    placeholder="Rechercher un étudiant..."
                    className="bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent w-full text-sm"
                    autoFocus
                  />
                  {composerStudents.length > 0 && (
                    <div className="absolute top-full mt-1 left-0 right-0 bg-biblio-card border border-white/10 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                      {composerStudents.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => {
                            setComposerStudent(s);
                            setComposerSearch("");
                            setComposerStudents([]);
                            if (composerTab === "custom" && !customSubject)
                              setCustomSubject("Rappel de la bibliothèque ESI");
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-left transition-colors"
                        >
                          <User className="w-4 h-4 text-biblio-muted shrink-0" />
                          <div>
                            <p className="text-sm text-biblio-text">
                              {s.prenom} {s.nom}
                            </p>
                            <p className="text-xs text-biblio-muted">
                              {s.email || (
                                <span className="text-biblio-danger">pas d'email</span>
                              )}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── ONGLET RAPPEL DE PRÊT ── */}
            {composerTab === "reminder" && (
              <div>
                {!composerStudent ? (
                  <p className="text-sm text-biblio-muted text-center py-4">
                    Sélectionnez un étudiant pour voir ses prêts actifs.
                  </p>
                ) : !composerStudent.email ? (
                  <p className="text-xs text-biblio-danger flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Cet étudiant n'a pas d'email. Ajoutez-en un dans sa fiche.
                  </p>
                ) : composerLoansLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-biblio-accent" />
                  </div>
                ) : composerLoans.length === 0 ? (
                  <p className="text-sm text-biblio-muted text-center py-4">
                    Aucun prêt actif pour cet étudiant.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-biblio-muted mb-1">
                      Prêts actifs — cliquez sur un prêt pour envoyer le rappel adapté :
                    </p>
                    {composerLoans.map((loan) => {
                      const isOverdue =
                        loan.date_retour_prevue &&
                        new Date(loan.date_retour_prevue) < new Date();
                      const isSent = sentLoanId === loan.id;
                      const isSending = sendingLoanId === loan.id;
                      return (
                        <div
                          key={loan.id}
                          className={`flex items-center justify-between gap-3 p-3 rounded-lg ${
                            isOverdue ? "bg-biblio-danger/10" : "bg-biblio-warning/10"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-biblio-muted shrink-0" />
                              <p className="text-sm font-medium text-biblio-text truncate">
                                {loan.livres?.titre || "—"}
                              </p>
                            </div>
                            <p className="text-xs text-biblio-muted mt-0.5 ml-5">
                              Retour :{" "}
                              {loan.date_retour_prevue
                                ? new Date(loan.date_retour_prevue).toLocaleDateString("fr-FR")
                                : "—"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                isOverdue
                                  ? "bg-biblio-danger/20 text-biblio-danger"
                                  : "bg-biblio-warning/20 text-biblio-warning"
                              }`}
                            >
                              {isOverdue ? "Retard" : "Bientôt dû"}
                            </span>
                            <button
                              onClick={() => handleSendLoanReminder(loan)}
                              disabled={isSending || isSent}
                              title={
                                isOverdue
                                  ? "Envoyer le mail de retard"
                                  : "Envoyer le rappel de veille"
                              }
                              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-60 ${
                                isSent
                                  ? "bg-biblio-success/20 text-biblio-success"
                                  : isOverdue
                                  ? "bg-biblio-danger/20 hover:bg-biblio-danger/40 text-biblio-danger"
                                  : "bg-biblio-warning/20 hover:bg-biblio-warning/40 text-biblio-warning"
                              }`}
                            >
                              {isSent ? (
                                <>
                                  <CheckCircle className="w-3.5 h-3.5" /> Envoyé
                                </>
                              ) : isSending ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <>
                                  <Send className="w-3 h-3" /> Rappel
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── ONGLET MESSAGE PERSONNALISÉ ── */}
            {composerTab === "custom" && (
              <>
                {!composerStudent ? (
                  <p className="text-sm text-biblio-muted text-center py-2">
                    Sélectionnez un étudiant ci-dessus.
                  </p>
                ) : (
                  <>
                    <div>
                      <label className="text-xs font-medium text-biblio-muted block mb-1">
                        Sujet
                      </label>
                      <input
                        type="text"
                        value={customSubject}
                        onChange={(e) => setCustomSubject(e.target.value)}
                        placeholder="Sujet du message..."
                        className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent w-full text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-biblio-muted block mb-1">
                        Message
                      </label>
                      <textarea
                        value={customBody}
                        onChange={(e) => setCustomBody(e.target.value)}
                        rows={5}
                        placeholder="Votre message..."
                        className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent w-full text-sm resize-none"
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {/* Erreur */}
            {composerError && (
              <p className="text-xs text-biblio-danger flex items-center gap-2 bg-biblio-danger/10 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {composerError}
              </p>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                onClick={() => setShowComposer(false)}
                className="px-4 py-2 text-sm text-biblio-muted hover:text-biblio-text transition-colors"
              >
                Fermer
              </button>
              {composerTab === "custom" && composerStudent?.email && (
                <button
                  onClick={handleSendCustom}
                  disabled={customSending || !customSubject.trim() || customSent}
                  className="flex items-center gap-2 px-5 py-2 bg-biblio-accent hover:bg-biblio-accent-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {customSent ? (
                    <>
                      <CheckCircle className="w-4 h-4" /> Envoyé !
                    </>
                  ) : customSending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Envoi...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Envoyer
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
