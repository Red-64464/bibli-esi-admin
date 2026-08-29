import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useRealtimeTables } from "../lib/realtime";
import { formatDate } from "../lib/utils";
import { Calendar, Loader2, AlertCircle, ChevronLeft, ChevronRight, Download, ExternalLink, BookOpen, User, Clock } from "lucide-react";

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

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function dateKey(year, month, day) {
  return toDateKey(new Date(year, month, day));
}

function getLoanEndDate(pret) {
  return pret.date_retour || pret.date_retour_prevue || pret.date_pret;
}

function isBetweenDays(day, start, end) {
  const current = new Date(`${day}T00:00:00`).getTime();
  const startTime = new Date(`${start}T00:00:00`).getTime();
  const endTime = new Date(`${end}T00:00:00`).getTime();
  return current >= startTime && current <= endTime;
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
  const events = pretsToExport.flatMap((pret) => {
    const title = pret.livres?.titre || "Livre à retourner";
    const student = pret.etudiants
      ? `${pret.etudiants.prenom || ""} ${pret.etudiants.nom || ""}`.trim()
      : "";
    const loanDate = pret.date_pret || pret.date_retour_prevue;
    const returnDate = pret.date_retour_prevue;
    const description = [
      `Livre : ${title}`,
      student ? `Etudiant : ${student}` : "",
      loanDate ? `Pret : ${formatDate(loanDate)}` : "",
      `Retour prevu : ${formatDate(returnDate)}`,
    ].filter(Boolean).join("\\n");

    const periodEvent = [
      "BEGIN:VEVENT",
      `UID:bibliesi-loan-${pret.id}@bibliesi`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${addDays(loanDate, 0)}`,
      `DTEND;VALUE=DATE:${addDays(returnDate, 1)}`,
      `SUMMARY:${escapeIcsText(`Prêt - ${title}`)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      "STATUS:CONFIRMED",
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    ];

    const returnEvent = [
      "BEGIN:VEVENT",
      `UID:bibliesi-return-${pret.id}@bibliesi`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${addDays(returnDate, 0)}`,
      `DTEND;VALUE=DATE:${addDays(returnDate, 1)}`,
      `SUMMARY:${escapeIcsText(`Retour livre - ${title}`)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE",
      "BEGIN:VALARM",
      `TRIGGER:${trigger}`,
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcsText(`Retour livre - ${title}`)}`,
      "END:VALARM",
      "END:VEVENT",
    ];

    return [periodEvent.join("\r\n"), returnEvent.join("\r\n")];
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
        .select("id, date_retour_prevue, date_retour, date_pret, date_rappel, rendu, statut, notes, livres:bibli_livres(titre, isbn), etudiants:bibli_etudiants(nom, prenom, email, numero_etudiant)")
        .lte("date_pret", end)
        .or(`date_retour_prevue.gte.${start},date_retour.gte.${start},and(date_retour_prevue.is.null,date_retour.is.null)`)
        .order("date_pret", { ascending: true });

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
  useRealtimeTables(["bibli_prets", "bibli_livres", "bibli_etudiants"], () => fetchPrets());

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

  // Grouper les prêts par jour couvert par la période du prêt
  const pretsByDay = {};
  prets.forEach((p) => {
    if (!p.date_pret) return;
    const start = p.date_pret;
    const end = getLoanEndDate(p);
    for (let day = 1; day <= getDaysInMonth(year, month); day += 1) {
      const key = dateKey(year, month, day);
      if (!isBetweenDays(key, start, end)) continue;
      if (!pretsByDay[day]) pretsByDay[day] = [];
      pretsByDay[day].push(p);
    }
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
        .select("id, date_retour_prevue, date_pret, rendu, livres:bibli_livres(titre), etudiants:bibli_etudiants(nom, prenom)")
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
            Télécharge un fichier calendrier avec tous les retours actifs, puis ouvre Google Calendar pour l&apos;importer dans ton calendrier personnel.
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

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 pb-4 text-xs text-biblio-muted">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-biblio-success" />Début du prêt</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-biblio-accent" />Prêt en cours</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-biblio-danger" />Retour prévu</span>
          <span className="text-[11px]">Clique sur un jour pour voir tous les prêts.</span>
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
                    className={`h-20 rounded-lg flex flex-col items-stretch justify-start p-1.5 transition-colors relative text-left
                      ${dayPrets.length ? "bg-biblio-accent/10 border border-biblio-accent/25" : "border border-transparent"}
                      ${isSelected ? "bg-biblio-accent/20 border-biblio-accent" : "hover:bg-white/5"}
                      ${isToday ? "ring-1 ring-biblio-accent" : ""}
                    `}
                  >
                    <span
                      className={`text-sm font-medium text-center ${isToday ? "text-biblio-accent" : "text-biblio-text"}`}
                    >
                      {day}
                    </span>
                    {dayPrets.length > 0 && (
                      <div className="mt-1 space-y-1 overflow-hidden">
                        {dayPrets.slice(0, 2).map((pret) => {
                          const key = dateKey(year, month, day);
                          const isStart = pret.date_pret === key;
                          const isEnd = getLoanEndDate(pret) === key;
                          return (
                            <span
                              key={pret.id}
                              className={`block truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                isEnd
                                  ? "bg-biblio-danger/25 text-biblio-danger"
                                  : isStart
                                    ? "bg-biblio-success/25 text-biblio-success"
                                    : "bg-biblio-accent/20 text-biblio-accent"
                              }`}
                            >
                              {isStart ? "Début" : isEnd ? "Retour" : "Prêt"} · {pret.livres?.titre || "Livre"}
                            </span>
                          );
                        })}
                        {dayPrets.length > 2 && (
                          <span className="block text-center text-[10px] font-semibold text-biblio-muted">
                            +{dayPrets.length - 2}
                          </span>
                        )}
                      </div>
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
              Prêts du {selectedDay} {MONTH_NAMES[month]} {year}
              <span className="ml-2 text-biblio-muted text-sm font-normal">
                ({selectedPrets.length} prêt{selectedPrets.length !== 1 ? "s" : ""})
              </span>
            </h3>
          </div>
          {selectedPrets.length === 0 ? (
            <p className="px-6 py-4 text-sm text-biblio-muted">
              Aucun prêt actif sur cette journée.
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {selectedPrets.map((p) => (
                <div key={p.id} className="px-6 py-4 space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-biblio-text flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-biblio-accent shrink-0" />
                        <span className="line-clamp-1">{p.livres?.titre || "—"}</span>
                      </p>
                      {p.livres?.isbn && (
                        <p className="mt-1 text-xs font-mono text-biblio-muted">
                          ISBN : {p.livres.isbn}
                        </p>
                      )}
                    </div>
                    <span className="w-fit rounded-full bg-biblio-accent/15 px-2.5 py-1 text-xs font-medium text-biblio-accent">
                      {p.rendu ? "Rendu" : "En cours"}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-xs text-biblio-muted sm:grid-cols-2">
                    <p className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-biblio-accent" />
                      <span className="text-biblio-text">
                        {p.etudiants
                          ? `${p.etudiants.prenom} ${p.etudiants.nom}`
                          : "Étudiant inconnu"}
                      </span>
                      {p.etudiants?.numero_etudiant && (
                        <span className="font-mono">· {p.etudiants.numero_etudiant}</span>
                      )}
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-biblio-accent" />
                      <span>Prêt : {formatDate(p.date_pret)}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-biblio-danger" />
                      <span>Retour prévu : {formatDate(p.date_retour_prevue)}</span>
                    </p>
                    {p.date_rappel && (
                      <p className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-biblio-warning" />
                        <span>Rappel : {formatDate(p.date_rappel)}</span>
                      </p>
                    )}
                  </div>
                  {p.notes && <p className="rounded-lg bg-white/5 p-3 text-xs text-biblio-muted">{p.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
