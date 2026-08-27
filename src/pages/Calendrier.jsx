import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { formatDate } from "../lib/utils";
import { Calendar, Loader2, AlertCircle, ChevronLeft, ChevronRight, Download, ExternalLink } from "lucide-react";

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const REMINDER_OPTIONS = [
  { value: 0, label: "Le jour même" },
  { value: 1, label: "1 jour avant" },
  { value: 2, label: "2 jours avant" },
  { value: 3, label: "3 jours avant" },
  { value: 7, label: "1 semaine avant" },
];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  // 0=Sun → convert to Mon-based
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function escapeIcsText(value = "") {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function buildCalendarFile(pretsToExport, reminderDays) {
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const trigger = reminderDays === 0 ? "PT0M" : `-P${reminderDays}D`;
  const events = pretsToExport.map((pret) => {
    const title = pret.livres?.titre || "Livre à retourner";
    const student = pret.etudiants
      ? `${pret.etudiants.prenom || ""} ${pret.etudiants.nom || ""}`.trim()
      : "";
    const description = [
      `Livre : ${title}`,
      student ? `Etudiant : ${student}` : "",
      pret.date_pret ? `Pret : ${formatDate(pret.date_pret)}` : "",
      `Retour prevu : ${formatDate(pret.date_retour_prevue)}`,
    ].filter(Boolean).join("\\n");

    return [
      "BEGIN:VEVENT",
      `UID:bibliesi-return-${pret.id}@bibliesi`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${addDays(pret.date_retour_prevue, 0)}`,
      `DTEND;VALUE=DATE:${addDays(pret.date_retour_prevue, 1)}`,
      `SUMMARY:${escapeIcsText(`Retour livre - ${title}`)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      "BEGIN:VALARM",
      `TRIGGER:${trigger}`,
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcsText(`Retour livre - ${title}`)}`,
      "END:VALARM",
      "END:VEVENT",
    ].join("\r\n");
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BiblESI//Calendrier des retours//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Bibl'ESI - Retours de livres",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

function downloadIcs(content, filename) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function Calendrier() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [prets, setPrets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDay, setSelectedDay] = useState(null);
  const [reminderDays, setReminderDays] = useState(1);
  const [exporting, setExporting] = useState(false);

  const fetchPrets = useCallback(async () => {
    try {
      setLoading(true);
      const start = new Date(year, month, 1).toISOString().slice(0, 10);
      const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);

      const { data, error: err } = await supabase
        .from("bibli_prets")
        .select("id, date_retour_prevue, date_pret, rendu, bibli_livres(titre), bibli_etudiants(nom, prenom)")
        .eq("rendu", false)
        .gte("date_retour_prevue", start)
        .lte("date_retour_prevue", end);

      if (err) throw err;
      setPrets(data || []);
    } catch (err) {
      setError("Erreur : " + err.message);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchPrets();
  }, [fetchPrets]);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  // Grouper les prêts par jour de retour
  const pretsByDay = {};
  prets.forEach((p) => {
    if (!p.date_retour_prevue) return;
    const day = new Date(p.date_retour_prevue).getDate();
    if (!pretsByDay[day]) pretsByDay[day] = [];
    pretsByDay[day].push(p);
  });

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const selectedPrets = selectedDay ? (pretsByDay[selectedDay] || []) : [];

  const exportToGoogleCalendar = async () => {
    try {
      setExporting(true);
      setError("");

      const { data, error: err } = await supabase
        .from("bibli_prets")
        .select("id, date_retour_prevue, date_pret, rendu, bibli_livres(titre), bibli_etudiants(nom, prenom)")
        .eq("rendu", false)
        .not("date_retour_prevue", "is", null)
        .order("date_retour_prevue", { ascending: true });

      if (err) throw err;
      const activePrets = data || [];
      if (activePrets.length === 0) {
        setError("Aucun retour actif à exporter pour le moment.");
        return;
      }

      const ics = buildCalendarFile(activePrets, Number(reminderDays));
      downloadIcs(ics, `bibliesi-retours-${new Date().toISOString().slice(0, 10)}.ics`);
      window.open("https://calendar.google.com/calendar/u/0/r/settings/export", "_blank", "noopener,noreferrer");
    } catch (err) {
      setError("Export impossible : " + err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Calendar className="w-8 h-8 text-biblio-accent" />
          Calendrier des retours
        </h1>
        <p className="text-biblio-muted mt-1">
          Retours prévus pour {MONTH_NAMES[month]} {year}
        </p>
      </div>

      <div className="bg-biblio-card rounded-xl border border-white/10 p-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-biblio-text">
            Ajouter les retours dans Google Calendar
          </p>
          <p className="text-xs text-biblio-muted max-w-2xl">
            Télécharge un fichier calendrier avec tous les retours actifs, puis ouvre Google Calendar pour l'importer dans ton calendrier personnel.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="text-xs text-biblio-muted">
            Rappel
            <select
              value={reminderDays}
              onChange={(e) => setReminderDays(Number(e.target.value))}
              className="mt-1 w-full sm:w-44 rounded-lg border border-white/10 bg-biblio-bg px-3 py-2 text-sm text-biblio-text focus:outline-none focus:ring-2 focus:ring-biblio-accent/60"
            >
              {REMINDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={exportToGoogleCalendar}
            disabled={exporting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-biblio-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-biblio-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Exporter Google Calendar
            <ExternalLink className="h-3.5 w-3.5 opacity-80" />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-biblio-danger/10 text-biblio-danger p-4 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-biblio-card rounded-xl border border-white/10 overflow-hidden">
        {/* Navigation mois */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-white/10 text-biblio-muted hover:text-biblio-text transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="font-semibold text-biblio-text">
            {MONTH_NAMES[month]} {year}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-white/10 text-biblio-muted hover:text-biblio-text transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-biblio-accent" />
          </div>
        ) : (
          <div className="p-4">
            {/* En-têtes jours */}
            <div className="grid grid-cols-7 mb-2">
              {DAY_NAMES.map((d) => (
                <div
                  key={d}
                  className="text-center text-xs font-medium text-biblio-muted py-2"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Grille jours */}
            <div className="grid grid-cols-7 gap-1">
              {/* Cases vides au début */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="h-14" />
              ))}

              {/* Jours du mois */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayPrets = pretsByDay[day] || [];
                const isToday =
                  day === today.getDate() &&
                  month === today.getMonth() &&
                  year === today.getFullYear();
                const isSelected = selectedDay === day;

                return (
                  <button
                    key={day}
                    onClick={() =>
                      setSelectedDay(selectedDay === day ? null : day)
                    }
                    className={`h-14 rounded-lg flex flex-col items-center justify-start pt-1.5 transition-colors relative
                      ${isSelected ? "bg-biblio-accent/20 border border-biblio-accent" : "hover:bg-white/5 border border-transparent"}
                      ${isToday ? "ring-1 ring-biblio-accent" : ""}
                    `}
                  >
                    <span
                      className={`text-sm font-medium ${isToday ? "text-biblio-accent" : "text-biblio-text"}`}
                    >
                      {day}
                    </span>
                    {dayPrets.length > 0 && (
                      <span className="mt-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-biblio-warning/20 text-biblio-warning text-[10px] font-bold px-1">
                        {dayPrets.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Détail du jour sélectionné */}
      {selectedDay && (
        <div className="bg-biblio-card rounded-xl border border-white/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <h3 className="font-semibold text-biblio-text">
              Retours prévus le {selectedDay} {MONTH_NAMES[month]} {year}
              <span className="ml-2 text-biblio-muted text-sm font-normal">
                ({selectedPrets.length} prêt{selectedPrets.length !== 1 ? "s" : ""})
              </span>
            </h3>
          </div>
          {selectedPrets.length === 0 ? (
            <p className="px-6 py-4 text-sm text-biblio-muted">
              Aucun retour prévu ce jour.
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {selectedPrets.map((p) => (
                <div key={p.id} className="px-6 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-biblio-text line-clamp-1">
                      {p.livres?.titre || "—"}
                    </p>
                    <p className="text-xs text-biblio-muted">
                      {p.etudiants
                        ? `${p.etudiants.prenom} ${p.etudiants.nom}`
                        : "—"}
                    </p>
                  </div>
                  <span className="text-xs text-biblio-muted">
                    {formatDate(p.date_retour_prevue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
