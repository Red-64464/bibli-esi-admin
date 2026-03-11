import { supabase } from "./supabase";

const DEFAULT_HOURS = {
  lundi: { ouvert: true, debut: "08:00", fin: "17:00" },
  mardi: { ouvert: true, debut: "08:00", fin: "17:00" },
  mercredi: { ouvert: true, debut: "08:00", fin: "17:00" },
  jeudi: { ouvert: true, debut: "08:00", fin: "17:00" },
  vendredi: { ouvert: true, debut: "08:00", fin: "14:00" },
  samedi: { ouvert: false, debut: "09:00", fin: "12:00" },
  dimanche: { ouvert: false, debut: "", fin: "" },
};

export const SETTING_DEFAULTS = {
  library_name: "Bibl'ESI",
  library_email: "",
  library_logo_url: "",
  default_loan_days: "14",
  max_books_per_student: "3",
  send_reminder_emails: "false",
  reminder_days_before: "3",
  remind_on_due_date: "true",
  notify_overdue: "true",
  accent_color: "indigo",
  library_hours: JSON.stringify(DEFAULT_HOURS),
  library_closed_message: "",
  library_is_closed: "false",
};

export { DEFAULT_HOURS };

/** Charge tous les paramètres depuis Supabase et merge les valeurs par défaut */
export async function getSettings() {
  const { data } = await supabase.from("settings").select("key, value");
  const result = { ...SETTING_DEFAULTS };
  (data || []).forEach(({ key, value }) => {
    result[key] = value;
  });
  return result;
}

/** Sauvegarde un objet entier de paramètres {@link {[key]: value}} */
export async function saveSettings(obj) {
  const rows = Object.entries(obj).map(([key, value]) => ({ key, value }));
  const { error } = await supabase.from("settings").upsert(rows);
  if (error) throw error;
}

/** Sauvegarde un seul paramètre */
export async function saveSetting(key, value) {
  const { error } = await supabase.from("settings").upsert({ key, value });
  if (error) throw error;
}

export const ACCENT_COLOR_HEX_MAP = {
  indigo: { color: "#6366f1", hover: "#818cf8" },
  violet: { color: "#8b5cf6", hover: "#a78bfa" },
  cyan: { color: "#06b6d4", hover: "#22d3ee" },
  emerald: { color: "#10b981", hover: "#34d399" },
  orange: { color: "#f97316", hover: "#fb923c" },
  rose: { color: "#f43f5e", hover: "#fb7185" },
};

/** Applique la couleur d'accentuation via CSS custom properties */
export function applyAccentColor(key) {
  const colors = ACCENT_COLOR_HEX_MAP[key] || ACCENT_COLOR_HEX_MAP.indigo;
  document.documentElement.style.setProperty(
    "--color-biblio-accent",
    colors.color,
  );
  document.documentElement.style.setProperty(
    "--color-biblio-accent-hover",
    colors.hover,
  );
}
