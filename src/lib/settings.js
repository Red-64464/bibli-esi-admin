import { supabase } from "./supabase";

export const SETTING_DEFAULTS = {
  library_name: "BiblioGest",
  library_email: "",
  library_logo_url: "",
  default_loan_days: "14",
  max_books_per_student: "3",
  send_reminder_emails: "false",
  reminder_days_before: "3",
  remind_on_due_date: "true",
  notify_overdue: "true",
};

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
