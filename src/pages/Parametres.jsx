import { useState, useEffect } from "react";
import { getSettings, saveSettings } from "../lib/settings";
import { logActivity } from "../lib/activityLog";
import { useAuth } from "../contexts/AuthContext";
import {
  Settings,
  Save,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Library,
  Mail,
  Clock,
  Calendar,
  RefreshCcw,
  Receipt,
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

export default function Parametres() {
  const { session } = useAuth();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getSettings()
      .then(setForm)
      .catch((e) =>
        setError("Impossible de charger les paramètres : " + e.message),
      )
      .finally(() => setLoading(false));
  }, []);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");
      await saveSettings(form);
      await logActivity({
        action_type: "settings_modifie",
        description: "Paramètres de la bibliothèque mis à jour",
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

        <Field label="Téléphone">
          <input
            type="tel"
            value={form.library_phone}
            onChange={(e) => set("library_phone", e.target.value)}
            placeholder="+213 XX XX XX XX"
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Adresse">
          <input
            type="text"
            value={form.library_address}
            onChange={(e) => set("library_address", e.target.value)}
            placeholder="Ex : Bâtiment principal, Rue de l'ESI, Alger"
            className={INPUT_CLASS}
          />
        </Field>
      </Section>

      {/* Section : Informations */}
      <Section icon={Calendar} title="Informations">
        <Field
          label="Horaires d'ouverture"
          hint="Affiché à titre indicatif dans le panneau d'administration."
        >
          <input
            type="text"
            value={form.library_hours}
            onChange={(e) => set("library_hours", e.target.value)}
            placeholder="Ex : Dim–Jeu 8h–17h, Fermé vendredi et samedi"
            className={INPUT_CLASS}
          />
        </Field>

        <Field
          label="Année académique"
          hint="Utilisée pour les exports et rapports."
        >
          <input
            type="text"
            value={form.academic_year}
            onChange={(e) => set("academic_year", e.target.value)}
            placeholder="Ex : 2024-2025"
            className={INPUT_CLASS + " max-w-[180px]"}
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

      {/* Section : Renouvellements */}
      <Section icon={RefreshCcw} title="Renouvellements">
        <Toggle
          checked={form.allow_renewals === "true"}
          onChange={(v) => set("allow_renewals", String(v))}
          label="Autoriser les renouvellements"
          description="Permet de prolonger la durée d'un prêt en cours depuis la page Prêts."
        />

        {form.allow_renewals === "true" && (
          <Field
            label="Durée de prolongation (jours)"
            hint="Nombre de jours ajoutés à la date de retour lors d'un renouvellement."
          >
            <input
              type="number"
              min="1"
              max="60"
              value={form.renewal_days}
              onChange={(e) => set("renewal_days", e.target.value)}
              className={INPUT_CLASS + " max-w-[140px]"}
            />
          </Field>
        )}
      </Section>

      {/* Section : Pénalités de retard */}
      <Section icon={Receipt} title="Pénalités de retard">
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Pénalité par jour de retard"
            hint="Saisissez 0 pour désactiver les pénalités."
          >
            <input
              type="number"
              min="0"
              step="any"
              value={form.fine_per_day}
              onChange={(e) => set("fine_per_day", e.target.value)}
              placeholder="0"
              className={INPUT_CLASS}
            />
          </Field>

          <Field
            label="Devise"
            hint="Ex : DA, €, $, MAD…"
          >
            <input
              type="text"
              value={form.fine_currency}
              onChange={(e) => set("fine_currency", e.target.value)}
              placeholder="DA"
              className={INPUT_CLASS}
            />
          </Field>
        </div>

        {parseFloat(form.fine_per_day) > 0 && (
          <p className="text-xs text-biblio-warning mt-1">
            Les pénalités calculées s&apos;affichent sur la page Prêts pour les emprunts en retard.
          </p>
        )}
      </Section>

      {/* Actions */}
      <div className="flex items-center gap-3">
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
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-biblio-success">
            <CheckCircle className="w-4 h-4" />
            Paramètres enregistrés
          </span>
        )}
      </div>
    </form>
  );
}
