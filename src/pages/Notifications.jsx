import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { getSettings, saveSettings } from "../lib/settings";
import { sendEmail, buildReminderEmail } from "../lib/email";
import {
  Bell,
  Mail,
  AlertTriangle,
  Save,
  Loader2,
  CheckCircle,
  CalendarCheck,
  RefreshCw,
  Send,
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

  // Prêts en retard pour la prévisualisation
  const [overdueLoans, setOverdueLoans] = useState([]);
  const [overdueLoading, setOverdueLoading] = useState(false);

  // Composer un rappel de retard
  const [showComposer, setShowComposer] = useState(false);
  const [composerSearch, setComposerSearch] = useState("");
  const [composerStudents, setComposerStudents] = useState([]);
  const [composerStudent, setComposerStudent] = useState(null); // {id, nom, prenom, email}
  const [composerLoans, setComposerLoans] = useState([]);
  const [composerLoansLoading, setComposerLoansLoading] = useState(false);
  const [sendingLoanId, setSendingLoanId] = useState(null);
  const [sentLoanId, setSentLoanId] = useState(null);
  const [composerError, setComposerError] = useState("");
  // Test du template retard
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
      await loadOverdue();
    } catch (err) {
      setError("Impossible de charger les paramètres : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadOverdue = async () => {
    try {
      setOverdueLoading(true);
      const todayStr = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("prets")
        .select("*, livres(titre), etudiants(nom, prenom, email)")
        .eq("rendu", false)
        .lt("date_retour_prevue", todayStr)
        .order("date_retour_prevue", { ascending: true });
      setOverdueLoans(data || []);
    } catch {
      /* silently ignore */
    } finally {
      setOverdueLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      await saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
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

  // Charge les prêts EN RETARD de l'étudiant sélectionné
  useEffect(() => {
    if (!composerStudent || !showComposer) {
      setComposerLoans([]);
      return;
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    setComposerLoansLoading(true);
    supabase
      .from("prets")
      .select("*, livres(titre)")
      .eq("etudiant_id", composerStudent.id)
      .eq("rendu", false)
      .lt("date_retour_prevue", todayStr)
      .order("date_retour_prevue", { ascending: true })
      .then(({ data }) => {
        setComposerLoans(data || []);
        setComposerLoansLoading(false);
      });
  }, [composerStudent, showComposer]);

  const openComposer = (prefillLoan = null) => {
    setComposerError("");
    setComposerSearch("");
    setComposerStudents([]);
    setSendingLoanId(null);
    setSentLoanId(null);
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
            Envoyez manuellement les emails de retard aux étudiants concernés.
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

      {/* Prêts en retard */}
      <div className="bg-biblio-card rounded-xl border border-white/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-biblio-accent" />
            Prêts en retard
            {overdueLoans.length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-biblio-danger/20 text-biblio-danger text-xs rounded-full font-semibold">
                {overdueLoans.length}
              </span>
            )}
          </h2>
          <button
            onClick={loadOverdue}
            className="text-biblio-muted hover:text-biblio-text transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {overdueLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-biblio-accent" />
          </div>
        ) : overdueLoans.length === 0 ? (
          <p className="text-center text-biblio-muted text-sm py-4">
            Aucun prêt en retard pour l'instant. 🎉
          </p>
        ) : (
          <div className="space-y-2">
            {overdueLoans.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 rounded-lg bg-biblio-danger/10"
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
                    {" · Prévu le "}{
                      p.date_retour_prevue
                        ? new Date(p.date_retour_prevue).toLocaleDateString("fr-FR")
                        : "—"
                    }
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openComposer(p)}
                  title="Envoyer le mail de retard"
                  className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-biblio-danger/20 hover:bg-biblio-danger/40 text-biblio-danger transition-colors"
                >
                  <Send className="w-3 h-3" />
                  Envoyer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>



      {/* Section : test du template retard */}
      <div className="bg-biblio-card rounded-xl border border-white/10 p-5">
        <h2 className="text-base font-semibold flex items-center gap-2 mb-3">
          <Send className="w-4 h-4 text-biblio-accent" />
          Tester l'email de retard
        </h2>
        <p className="text-xs text-biblio-muted mb-3">
          Envoie un email de test pour v\u00e9rifier que le template EmailJS fonctionne correctement.
        </p>
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
            <CheckCircle className="w-3.5 h-3.5" /> Email de test envoy\u00e9 !
          </p>
        )}
        {testError && (
          <p className="text-xs text-biblio-danger flex items-center gap-1.5 mt-2">
            <AlertTriangle className="w-3.5 h-3.5" /> {testError}
          </p>
        )}
      </div>

      {/* Composer modal — envoi d'un email de retard */}
      {showComposer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-biblio-card rounded-2xl border border-white/10 w-full max-w-lg p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Mail className="w-4 h-4 text-biblio-accent" />
                Envoyer un email de retard
              </h2>
              <button
                onClick={() => setShowComposer(false)}
                className="text-biblio-muted hover:text-biblio-text transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Destinataire */}
            <div>
              <label className="text-xs font-medium text-biblio-muted block mb-1">
                \u00c9tudiant
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
                    placeholder="Rechercher un \u00e9tudiant..."
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

            {/* Liste des prêts EN RETARD de l'étudiant */}
            <div>
              {!composerStudent ? (
                <p className="text-sm text-biblio-muted text-center py-4">
                  S\u00e9lectionnez un \u00e9tudiant pour voir ses livres en retard.
                </p>
              ) : !composerStudent.email ? (
                <p className="text-xs text-biblio-danger flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Cet \u00e9tudiant n'a pas d'email. Ajoutez-en un dans sa fiche.
                </p>
              ) : composerLoansLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-biblio-accent" />
                </div>
              ) : composerLoans.length === 0 ? (
                <p className="text-sm text-biblio-muted text-center py-4">
                  Aucun livre en retard pour cet \u00e9tudiant.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-biblio-muted mb-1">
                    Livres en retard \u2014 cliquez pour envoyer le mail de retard :
                  </p>
                  {composerLoans.map((loan) => {
                    const isSent = sentLoanId === loan.id;
                    const isSending = sendingLoanId === loan.id;
                    return (
                      <div
                        key={loan.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg bg-biblio-danger/10"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-biblio-muted shrink-0" />
                            <p className="text-sm font-medium text-biblio-text truncate">
                              {loan.livres?.titre || "\u2014"}
                            </p>
                          </div>
                          <p className="text-xs text-biblio-muted mt-0.5 ml-5">
                            Pr\u00e9vu le{" "}
                            {loan.date_retour_prevue
                              ? new Date(loan.date_retour_prevue).toLocaleDateString("fr-FR")
                              : "\u2014"}
                          </p>
                        </div>
                        <button
                          onClick={() => handleSendLoanReminder(loan)}
                          disabled={isSending || isSent}
                          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-60 ${
                            isSent
                              ? "bg-biblio-success/20 text-biblio-success"
                              : "bg-biblio-danger/20 hover:bg-biblio-danger/40 text-biblio-danger"
                          }`}
                        >
                          {isSent ? (
                            <><CheckCircle className="w-3.5 h-3.5" /> Envoy\u00e9</>
                          ) : isSending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <><Send className="w-3 h-3" /> Envoyer</>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {composerError && (
              <p className="text-xs text-biblio-danger flex items-center gap-2 bg-biblio-danger/10 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {composerError}
              </p>
            )}

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setShowComposer(false)}
                className="px-4 py-2 text-sm text-biblio-muted hover:text-biblio-text transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
