import { useState, useEffect, useRef } from "react";
import {
  getSettings,
  saveSettings,
  SETTING_DEFAULTS,
  DEFAULT_HOURS,
  applyAccentColor,
} from "../lib/settings";
import { logActivity } from "../lib/activityLog";
import { useAuth } from "../contexts/AuthContext";
import ConfirmModal from "../components/ConfirmModal";
import {
  Settings,
  Save,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Library,
  Mail,
  Clock,
  Bell,
  Palette,
  RotateCcw,
  CalendarDays,
  AlertOctagon,
} from "lucide-react";

const INPUT_CLASS =
  "bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent w-full text-sm";

function Section({ icon: Icon, title, children }) {
  return (
    <div className="bg-biblio-card rounded-xl border border-white/10 p-5 space-y-4">
      <h2 className="text-base font-semibold flex items-center gap-2 border-b border-white/5 pb-3">
        <Icon className="w-4 h-4 text-biblio-accent" />
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-biblio-muted block mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-biblio-muted mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-white/5 last:border-0">
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

const SETTINGS_LABELS = {
  library_name: "Nom de la bibliothèque",
  library_email: "Email",
  library_logo_url: "Logo URL",
  default_loan_days: "Durée de prêt (jours)",
  max_books_per_student: "Livres max/étudiant",
  send_reminder_emails: "Emails automatiques",
  reminder_days_before: "Rappel avant retour (jours)",
  remind_on_due_date: "Rappel jour du retour",
  notify_overdue: "Notification retard",
  accent_color: "Couleur d'accentuation",
  library_hours: "Horaires d'ouverture",
  library_closed_message: "Message de fermeture",
  library_is_closed: "Fermeture exceptionnelle",
};

function formatSettingVal(key, val) {
  if (val === "true") return "Oui";
  if (val === "false") return "Non";
  if (key === "library_hours") return "(voir horaires)";
  return val || "(vide)";
}

const ACCENT_COLORS = [
  { key: "indigo", label: "Indigo", hex: "#6366f1" },
  { key: "violet", label: "Violet", hex: "#8b5cf6" },
  { key: "cyan", label: "Cyan", hex: "#06b6d4" },
  { key: "emerald", label: "Émeraude", hex: "#10b981" },
  { key: "orange", label: "Orange", hex: "#f97316" },
  { key: "rose", label: "Rose", hex: "#f43f5e" },
];

const JOURS = [
  { key: "lundi", label: "Lundi" },
  { key: "mardi", label: "Mardi" },
  { key: "mercredi", label: "Mercredi" },
  { key: "jeudi", label: "Jeudi" },
  { key: "vendredi", label: "Vendredi" },
  { key: "samedi", label: "Samedi" },
  { key: "dimanche", label: "Dimanche" },
];

export default function Parametres() {
  const { session } = useAuth();
  const originalFormRef = useRef(null);
  const [form, setForm] = useState(null);
  const [hours, setHours] = useState(null); // parsed library_hours
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setForm(s);
        originalFormRef.current = { ...s };
        applyAccentColor(s.accent_color);
        try {
          setHours(JSON.parse(s.library_hours));
        } catch {
          setHours({ ...DEFAULT_HOURS });
        }
      })
      .catch((e) =>
        setError("Impossible de charger les paramètres : " + e.message),
      )
      .finally(() => setLoading(false));
  }, []);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const setHour = (jour, field, value) =>
    setHours((prev) => ({
      ...prev,
      [jour]: { ...prev[jour], [field]: value },
    }));

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");
      const payload = { ...form, library_hours: JSON.stringify(hours) };
      await saveSettings(payload);

      // Construire une description détaillée des changements
      const orig = originalFormRef.current || {};
      const changed = Object.keys(SETTING_DEFAULTS).filter((key) => {
        if (key === "library_hours")
          return JSON.stringify(hours) !== orig.library_hours;
        return (form[key] ?? "") !== (orig[key] ?? "");
      });
      let description = "Paramètres de la bibliothèque mis à jour";
      if (changed.length > 0) {
        const details = changed.map((k) => {
          if (k === "library_hours") return "Horaires d'ouverture";
          const label = SETTINGS_LABELS[k] || k;
          const from = formatSettingVal(k, orig[k]);
          const to = formatSettingVal(k, form[k]);
          return `${label} : ${from} → ${to}`;
        });
        description = `Paramètres modifiés — ${details.join(" | ")}`;
      }
      originalFormRef.current = { ...payload };

      await logActivity({
        action_type: "settings_modifie",
        description,
        user_info: session?.username || "",
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError("Erreur lors de la sauvegarde : " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      setSaving(true);
      setError("");
      await saveSettings(SETTING_DEFAULTS);
      setForm({ ...SETTING_DEFAULTS });
      setHours({ ...DEFAULT_HOURS });
      await logActivity({
        action_type: "settings_modifie",
        description: "Paramètres réinitialisés aux valeurs par défaut",
        user_info: session?.username || "",
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError("Erreur lors de la réinitialisation : " + err.message);
    } finally {
      setSaving(false);
      setShowConfirmReset(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-biblio-accent" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl mx-auto">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
          <Settings className="w-7 h-7 text-biblio-accent" />
          Paramètres
        </h1>
        <p className="text-biblio-muted mt-1 text-sm">
          Configuration générale de la bibliothèque.
        </p>
      </div>

      {error && (
        <div className="bg-biblio-danger/10 text-biblio-danger p-4 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Section : Identité */}
      <Section icon={Library} title="Identité">
        <Field label="Nom de la bibliothèque">
          <input
            type="text"
            value={form.library_name}
            onChange={(e) => set("library_name", e.target.value)}
            placeholder="Bibl'ESI"
            className={INPUT_CLASS}
          />
        </Field>

        <Field
          label="URL du logo"
          hint="Lien direct vers votre logo (PNG, JPG). Laissez vide pour utiliser le logo par défaut."
        >
          <input
            type="url"
            value={form.library_logo_url}
            onChange={(e) => set("library_logo_url", e.target.value)}
            placeholder="https://example.com/logo.png"
            className={INPUT_CLASS}
          />
          {form.library_logo_url && (
            <img
              src={form.library_logo_url}
              alt="Aperçu logo"
              className="mt-2 h-12 object-contain rounded border border-white/10"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          )}
        </Field>
      </Section>

      {/* Section : Contact */}
      <Section icon={Mail} title="Contact">
        <Field label="Email de la bibliothèque">
          <input
            type="email"
            value={form.library_email}
            onChange={(e) => set("library_email", e.target.value)}
            placeholder="bibliotheque@esi.dz"
            className={INPUT_CLASS}
          />
        </Field>
      </Section>

      {/* Section : Règles de prêt */}
      <Section icon={Clock} title="Règles de prêt">
        <Field
          label="Durée de prêt par défaut (jours)"
          hint="Utilisée lors de la création d'un nouveau prêt."
        >
          <input
            type="number"
            min="1"
            max="365"
            value={form.default_loan_days}
            onChange={(e) => set("default_loan_days", e.target.value)}
            className={INPUT_CLASS + " max-w-[140px]"}
          />
        </Field>

        <Field
          label="Nombre maximum de livres par étudiant"
          hint="0 = pas de limite."
        >
          <input
            type="number"
            min="0"
            max="50"
            value={form.max_books_per_student}
            onChange={(e) => set("max_books_per_student", e.target.value)}
            className={INPUT_CLASS + " max-w-[140px]"}
          />
        </Field>
      </Section>

      {/* Section : Notifications */}
      <Section icon={Bell} title="Notifications">
        <Toggle
          checked={form.send_reminder_emails === "true"}
          onChange={(v) => set("send_reminder_emails", String(v))}
          label="Activer les emails automatiques"
          description="Envoyer des emails de rappel aux étudiants."
        />

        <Toggle
          checked={form.remind_on_due_date === "true"}
          onChange={(v) => set("remind_on_due_date", String(v))}
          label="Rappel le jour du retour"
          description="Envoyer un rappel le jour exact de la date de retour prévue."
        />

        <Toggle
          checked={form.notify_overdue === "true"}
          onChange={(v) => set("notify_overdue", String(v))}
          label="Notification de retard"
          description="Notifier quand un livre n'est pas retourné à la date prévue."
        />

        <Field
          label="Rappel avant retour (nombre de jours)"
          hint="Nombre de jours avant la date de retour pour envoyer un rappel."
        >
          <input
            type="number"
            min="1"
            max="30"
            value={form.reminder_days_before}
            onChange={(e) => set("reminder_days_before", e.target.value)}
            className={INPUT_CLASS + " max-w-[140px]"}
          />
        </Field>
      </Section>

      {/* Section : Apparence */}
      <Section icon={Palette} title="Apparence">
        <Field label="Couleur d'accentuation">
          <div className="flex flex-wrap gap-3 mt-1">
            {ACCENT_COLORS.map(({ key, label, hex }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  set("accent_color", key);
                  applyAccentColor(key);
                }}
                title={label}
                className={`w-9 h-9 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-biblio-bg ${
                  form.accent_color === key
                    ? "ring-2 ring-offset-2 ring-offset-biblio-bg scale-110"
                    : "hover:scale-105 opacity-80 hover:opacity-100"
                }`}
                style={{
                  backgroundColor: hex,
                  outlineColor: hex,
                  "--tw-ring-color": hex,
                }}
              />
            ))}
          </div>
          <p className="text-xs text-biblio-muted mt-2">
            Couleur sélectionnée :{" "}
            <span className="text-biblio-text font-medium capitalize">
              {ACCENT_COLORS.find((c) => c.key === form.accent_color)?.label ||
                form.accent_color}
            </span>
          </p>
        </Field>
      </Section>

      {/* Section : Horaires */}
      <Section icon={CalendarDays} title="Horaires d'ouverture">
        {/* Fermeture exceptionnelle */}
        <Toggle
          checked={form.library_is_closed === "true"}
          onChange={(v) => set("library_is_closed", String(v))}
          label="Fermeture exceptionnelle"
          description="Marque la bibliothèque comme fermée indépendamment des horaires habituels."
        />
        {form.library_is_closed === "true" && (
          <Field
            label="Message de fermeture"
            hint="Affiché aux étudiants à la place des horaires."
          >
            <input
              type="text"
              value={form.library_closed_message || ""}
              onChange={(e) => set("library_closed_message", e.target.value)}
              placeholder="Ex : Fermée du 10 au 15 mars pour les vacances"
              className={INPUT_CLASS}
            />
          </Field>
        )}

        {/* Grille 7 jours */}
        <div className="space-y-2 mt-2">
          <div className="hidden sm:grid grid-cols-[110px_60px_1fr_16px_1fr] gap-2 items-center mb-1">
            <span className="text-xs text-biblio-muted">Jour</span>
            <span className="text-xs text-biblio-muted text-center">
              Ouvert
            </span>
            <span className="text-xs text-biblio-muted">Ouverture</span>
            <span />
            <span className="text-xs text-biblio-muted">Fermeture</span>
          </div>
          {hours &&
            JOURS.map(({ key, label }) => {
              const jour = hours[key] || { ouvert: false, debut: "", fin: "" };
              return (
                <div
                  key={key}
                  className={`grid grid-cols-[110px_60px_1fr_16px_1fr] gap-2 items-center rounded-lg px-2 py-1.5 transition-colors ${
                    jour.ouvert ? "bg-white/5" : "opacity-50"
                  }`}
                >
                  <span className="text-sm text-biblio-text font-medium">
                    {label}
                  </span>

                  {/* Toggle ouvert */}
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => setHour(key, "ouvert", !jour.ouvert)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                        jour.ouvert ? "bg-biblio-accent" : "bg-white/20"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          jour.ouvert ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Heure début */}
                  <input
                    type="time"
                    value={jour.debut}
                    disabled={!jour.ouvert}
                    onChange={(e) => setHour(key, "debut", e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-biblio-text text-sm focus:outline-none focus:ring-2 focus:ring-biblio-accent w-full disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ colorScheme: "dark" }}
                  />

                  <span className="text-biblio-muted text-center text-xs">
                    →
                  </span>

                  {/* Heure fin */}
                  <input
                    type="time"
                    value={jour.fin}
                    disabled={!jour.ouvert}
                    onChange={(e) => setHour(key, "fin", e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-biblio-text text-sm focus:outline-none focus:ring-2 focus:ring-biblio-accent w-full disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ colorScheme: "dark" }}
                  />
                </div>
              );
            })}
        </div>
      </Section>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="submit"
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
        <button
          type="button"
          onClick={() => setShowConfirmReset(true)}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-biblio-muted hover:text-biblio-text rounded-lg font-medium transition-colors text-sm disabled:opacity-60"
        >
          <RotateCcw className="w-4 h-4" />
          Réinitialiser par défaut
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-biblio-success">
            <CheckCircle className="w-4 h-4" />
            Paramètres enregistrés
          </span>
        )}
      </div>

      {showConfirmReset && (
        <ConfirmModal
          title="Réinitialiser les paramètres"
          message="Tous les paramètres seront remis à leurs valeurs par défaut. Cette action est irréversible."
          danger
          onConfirm={handleReset}
          onCancel={() => setShowConfirmReset(false)}
        />
      )}
    </form>
  );
}
